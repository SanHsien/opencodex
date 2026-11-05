import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
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
import { runOrchestratedUpdate } from "../../src/update/orchestrated-entry";
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

// The Node launcher handles `update` before Bun starts. Upstream's orchestrated child and apply
// paths run there and install a registry build (the upstream package), so each needs the gate
// before it, not only the legacy `update` refusal that sits further down the file.
describe("fork update policy: the Node launcher's orchestrated entry points", () => {
  const nodePath = Bun.which("node");
  const closedGateEnv = (extra: Record<string, string> = {}) => {
    const env: Record<string, string> = {};
    for (const [key, value] of Object.entries(process.env)) if (value !== undefined) env[key] = value;
    delete env[FORK_TEST_REGISTRY_UPDATE_ENV];
    delete env.OCX_UPDATE_ORCHESTRATED_CHILD;
    return { ...env, NODE_ENV: "test", ...extra };
  };
  const run = (args: string[], extra: Record<string, string> = {}) =>
    spawnSync(nodePath!, [repoPath("bin/ocx.mjs"), "update", ...args], {
      env: closedGateEnv(extra), encoding: "utf8", timeout: 45_000, windowsHide: true, cwd: repoPath("."),
    });
  const lastJson = (stdout: string) => JSON.parse(stdout.trim().split(/\r?\n/).at(-1)!);

  test.skipIf(!nodePath)("`update --yes --json` is refused with a machine-readable result and exit 10", () => {
    const result = run(["--yes", "--json"]);
    expect(result.status).toBe(10);
    expect(result.stderr).toContain(FORK_RELEASES_URL);
    expect(lastJson(result.stdout)).toMatchObject({ schema: "ocx.update.result/1", applied: false, error: "fork-self-update-disabled" });
  });

  test.skipIf(!nodePath)("`update --plan --json` reports canApply false and never a target version", () => {
    const result = run(["--plan", "--json"]);
    expect(result.status).toBe(0);
    expect(lastJson(result.stdout)).toMatchObject({ schema: "ocx.update.plan/1", canApply: false, reason: "fork-self-update-disabled", targetVersion: null });
  });

  test.skipIf(!nodePath)("the orchestrated child mode is refused before it reads its capability", () => {
    const result = run(["--orchestrated-expect=AA", "--orchestrated-result=x", "--yes", "--json"], { OCX_UPDATE_ORCHESTRATED_CHILD: "1" });
    expect(result.status).not.toBe(0);
    expect(result.stdout + result.stderr).not.toContain("Orchestrated update preflight");
  });

  test("the gate precedes every launcher call that can install a registry build", () => {
    const source = readFileSync(repoPath("bin/ocx.mjs"), "utf8");
    const gate = source.indexOf("if (orchestratedUpdate && forkSelfUpdateBlocked())");
    expect(gate).toBeGreaterThan(0);
    for (const call of ["await runPackageManagerSelfUpdate(installMethod, childArgs)", "await applyNodeOrchestratedUpdate(", "await runNpmSelfUpdate()", "await runPnpmSelfUpdate()"]) {
      expect(source.indexOf(call), call).toBeGreaterThan(gate);
    }
  });
});

// The Bun-direct path (src/cli/dispatch.ts) reaches runOrchestratedUpdate without the Node launcher.
// The gate must be its own, not a side effect of latestVersion() returning null.
describe("fork update policy: the Bun-direct orchestrated entry", () => {
  let previous = true;
  beforeEach(() => { previous = forkUpdatePolicy.selfUpdateAllowed; forkUpdatePolicy.selfUpdateAllowed = false; });
  afterEach(() => { forkUpdatePolicy.selfUpdateAllowed = previous; });
  const capture = async (argv: string[]) => {
    const logs: string[] = [];
    const log = spyOn(console, "log").mockImplementation((...a: unknown[]) => { logs.push(a.join(" ")); });
    const err = spyOn(console, "error").mockImplementation(() => {});
    try { return { code: await runOrchestratedUpdate(argv), json: JSON.parse(logs.at(-1)!), stderr: err.mock.calls.flat().join("\n") }; }
    finally { log.mockRestore(); err.mockRestore(); }
  };

  test("--yes --json is refused with exit 10 and the fork-disabled result", async () => {
    const out = await capture(["--yes", "--json"]);
    expect(out.code).toBe(10);
    expect(out.stderr).toContain(FORK_RELEASES_URL);
    expect(out.json).toMatchObject({ schema: "ocx.update.result/1", applied: false, error: "fork-self-update-disabled" });
  });

  test("--plan --json reports canApply false with no target version", async () => {
    const out = await capture(["--plan", "--json"]);
    expect(out.code).toBe(0);
    expect(out.json).toMatchObject({ schema: "ocx.update.plan/1", canApply: false, reason: "fork-self-update-disabled", targetVersion: null });
  });

  test("the gate runs before the plan is observed, so a resolvable target cannot bypass it", () => {
    const source = readFileSync(repoPath("src/update/orchestrated-entry.ts"), "utf8");
    const fn = source.slice(source.indexOf("export async function runOrchestratedUpdate"));
    const gate = fn.indexOf("forkSelfUpdateBlocked()");
    expect(gate).toBeGreaterThan(0);
    expect(fn.indexOf("observeOrchestratedPlan(")).toBeGreaterThan(gate);
    expect(fn.indexOf("applyOrchestratedBun(")).toBeGreaterThan(gate);
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
