import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { repoPath } from "../helpers/repo-root";
import {
  FORK_TEST_REGISTRY_UPDATE_ENV,
  FORK_RELEASES_URL,
  FORK_SELF_UPDATE_HINT,
  forkSelfUpdateBlocked,
  forkUpdatePolicy,
} from "../../src/update/fork-source.mjs";
import { latestVersionAsync } from "../../src/update/async-check";
import { latestVersion, runUpdate, updateCommand } from "../../src/update";
import { startUpdateJob, UpdateJobError } from "../../src/update/job";

// The fork never installs or announces a registry build: the registry only carries the upstream
// package. These tests run with the gate in its SHIPPED state (preload opens it for the rest of
// the suite).
describe("fork update policy (shipped default)", () => {
  let previous = true;
  beforeEach(() => { previous = forkUpdatePolicy.selfUpdateAllowed; forkUpdatePolicy.selfUpdateAllowed = false; });
  afterEach(() => { forkUpdatePolicy.selfUpdateAllowed = previous; process.exitCode = 0; });

  test("release notes point at the fork's own releases", () => {
    expect(FORK_RELEASES_URL).toBe("https://github.com/SanHsien/opencodex/releases/latest");
    expect(FORK_SELF_UPDATE_HINT).toContain(FORK_RELEASES_URL);
    expect(forkSelfUpdateBlocked()).toBe(true);
  });

  test("registry lookups answer nothing, so no upstream version is ever announced", async () => {
    let spawned = 0;
    const spawnStub = (() => { spawned++; throw new Error("must not spawn"); }) as never;
    expect(latestVersion("latest", "npm", undefined, spawnStub)).toBeNull();
    expect(await latestVersionAsync("latest", "npm", { ownerFn: async () => null, spawnFn: spawnStub })).toBeNull();
    expect(spawned).toBe(0);
  });

  test("no install command can be built", () => {
    for (const installer of ["npm", "pnpm", "bun"] as const) {
      expect(() => updateCommand(installer, "latest", "9.9.9")).toThrow(FORK_SELF_UPDATE_HINT);
    }
  });

  test("ocx update refuses before touching the proxy or a package manager", async () => {
    const error = spyOn(console, "error").mockImplementation(() => {});
    spyOn(console, "log").mockImplementation(() => {});
    try {
      await runUpdate();
      expect(process.exitCode).toBe(1);
      expect(error.mock.calls.flat().join("\n")).toContain(FORK_RELEASES_URL);
    } finally { error.mockRestore(); }
  });

  test("the dashboard update job is refused", () => {
    try {
      startUpdateJob("latest", true);
      throw new Error("expected refusal");
    } catch (error) {
      expect(error).toBeInstanceOf(UpdateJobError);
      expect((error as UpdateJobError).code).toBe("fork_self_update_disabled");
    }
  });
});

describe("fork update policy: the test-only opener", () => {
  const probe = (env: Record<string, string | undefined>) => {
    const childEnv: Record<string, string> = {};
    for (const [key, value] of Object.entries({ ...process.env, ...env })) if (value !== undefined) childEnv[key] = value;
    const result = spawnSync(process.execPath, ["-e", `
      const m = await import(${JSON.stringify(repoPath("src/update/fork-source.mjs"))});
      process.stdout.write(String(m.forkSelfUpdateBlocked()));
    `], { env: childEnv, encoding: "utf8", timeout: 15_000 });
    return result.stdout.trim();
  };

  test("a fresh process stays blocked without the test env var", () => {
    expect(probe({ NODE_ENV: "test", [FORK_TEST_REGISTRY_UPDATE_ENV]: undefined })).toBe("true");
  });

  test("the env var alone does not open a non-test process", () => {
    expect(probe({ NODE_ENV: "production", [FORK_TEST_REGISTRY_UPDATE_ENV]: "1" })).toBe("true");
    expect(probe({ NODE_ENV: undefined, [FORK_TEST_REGISTRY_UPDATE_ENV]: "1" })).toBe("true");
  });

  test("spawned test helpers inherit an open gate", () => {
    expect(probe({ NODE_ENV: "test", [FORK_TEST_REGISTRY_UPDATE_ENV]: "1" })).toBe("false");
  });
}, 60_000);
