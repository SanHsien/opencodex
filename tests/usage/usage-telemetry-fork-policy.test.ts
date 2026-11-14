import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { isTelemetryEnvOptOut, resolveTelemetryStatus } from "../../src/telemetry/consent";
import {
  FORK_TELEMETRY_BLOCKED_REASON,
  FORK_TEST_TELEMETRY_ENV,
  forkTelemetryBlocked,
} from "../../src/telemetry/fork-policy";
import { createProfile, deleteProfile, fetchOwnProfileRank, submitProfileDay } from "../../src/telemetry/profile/client";
import { sendTelemetryPayload } from "../../src/telemetry/sender";
import { repoPath } from "../helpers/repo-root";

// Fork decision D1 (docs/fork/DECISIONS.md, 2026-11-14): a fork build never asks for telemetry
// consent and never sends. tests/preload.ts opens the gate for the rest of the suite, so these tests
// close it again and run with the gate in its SHIPPED state.
describe("fork telemetry policy (shipped default)", () => {
  let savedGate: string | undefined;
  let savedNodeEnv: string | undefined;
  beforeEach(() => {
    savedGate = process.env[FORK_TEST_TELEMETRY_ENV];
    savedNodeEnv = process.env.NODE_ENV;
    delete process.env[FORK_TEST_TELEMETRY_ENV];
  });
  afterEach(() => {
    if (savedGate === undefined) delete process.env[FORK_TEST_TELEMETRY_ENV];
    else process.env[FORK_TEST_TELEMETRY_ENV] = savedGate;
    if (savedNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = savedNodeEnv;
  });

  test("the gate is closed unless NODE_ENV=test AND the dedicated variable are both set", () => {
    expect(forkTelemetryBlocked({})).toBe(true);
    expect(forkTelemetryBlocked({ NODE_ENV: "test" })).toBe(true);
    expect(forkTelemetryBlocked({ [FORK_TEST_TELEMETRY_ENV]: "1" })).toBe(true);
    expect(forkTelemetryBlocked({ NODE_ENV: "production", [FORK_TEST_TELEMETRY_ENV]: "1" })).toBe(true);
    expect(forkTelemetryBlocked({ NODE_ENV: "test", [FORK_TEST_TELEMETRY_ENV]: "true" })).toBe(true);
    // The test seam itself, so the rest of the suite can still exercise the upstream machinery.
    expect(forkTelemetryBlocked({ NODE_ENV: "test", [FORK_TEST_TELEMETRY_ENV]: "1" })).toBe(false);
    // With the real process environment (the variable deleted above) the shipped default holds.
    expect(forkTelemetryBlocked()).toBe(true);
  });

  test("consent resolves to effective:false and never reaches a prompt or accepted state", () => {
    // Even a stored acceptance, a shown notice and an environment that asks for nothing is off.
    const accepted = { telemetry: { decision: "accepted" as const, noticeShownAt: "2026-11-01T00:00:00.000Z" } };
    for (const config of [undefined, {}, accepted]) {
      const status = resolveTelemetryStatus(config, {});
      expect(status.effective).toBe(false);
      expect(status.reason).toBe("env-ocx-telemetry");
      expect(status.envOverride).toBe("OCX_TELEMETRY");
    }
    // Every caller (scheduler, profile sync, CLI prompt, dashboard dialog) treats a non-null
    // override as "do not send and do not ask".
    expect(isTelemetryEnvOptOut({})).toBe("OCX_TELEMETRY");
    expect(isTelemetryEnvOptOut(process.env)).toBe("OCX_TELEMETRY");
  });

  test("the anonymous sender never calls fetch", async () => {
    let calls = 0;
    const result = await sendTelemetryPayload({} as never, {
      fetch: (async () => { calls++; return new Response("{}", { status: 200 }); }) as unknown as typeof fetch,
    });
    expect(calls).toBe(0);
    expect(result).toEqual({ ok: false, error: FORK_TELEMETRY_BLOCKED_REASON });
  });

  test("no profile call reaches fetch", async () => {
    let calls = 0;
    const options = {
      fetch: (async () => { calls++; return new Response("{}", { status: 200 }); }) as unknown as typeof fetch,
    };
    const secret = "ocxp_" + "a".repeat(40);
    expect((await createProfile({} as never, options)).ok).toBe(false);
    expect((await submitProfileDay(secret, {} as never, options)).ok).toBe(false);
    expect((await fetchOwnProfileRank(secret, options)).ok).toBe(false);
    expect((await deleteProfile(secret, options)).deleted).toBe(false);
    expect(calls).toBe(0);
  });

  test("the collector host appears only in the gated modules and display text", () => {
    const allowed = new Set([
      "src/telemetry/sender.ts",
      "src/telemetry/profile/client.ts",
      "src/telemetry/disclosure.ts",
      "gui/src/i18n/v2-pages/proxy-copy.ts",
    ]);
    const hits: string[] = [];
    for (const dir of ["src", "gui/src"]) {
      for (const entry of readdirSync(repoPath(dir), { withFileTypes: true, recursive: true })) {
        if (!entry.isFile() || !/\.(ts|tsx|mjs|js)$/.test(entry.name)) continue;
        const rel = `${dir}/${join(relative(repoPath(dir), entry.parentPath), entry.name)}`.replaceAll("\\", "/");
        if (readFileSync(repoPath(rel), "utf8").includes("telemetry.opencodex.me")) hits.push(rel);
      }
    }
    expect(hits.filter(file => !allowed.has(file))).toEqual([]);
    // The two egress modules are exactly the ones carrying the fork gate.
    for (const file of ["src/telemetry/sender.ts", "src/telemetry/profile/client.ts"]) {
      expect(readFileSync(repoPath(file), "utf8")).toContain("forkTelemetryBlocked()");
    }
  });

  test("the Windows MSI links no telemetry installer page", () => {
    const conf = JSON.parse(readFileSync(repoPath("desktop", "src-tauri", "tauri.conf.json"), "utf8")) as {
      bundle?: { windows?: { wix?: Record<string, unknown> } };
    };
    const wix = conf.bundle?.windows?.wix ?? {};
    expect(wix.fragmentPaths).toBeUndefined();
    expect(wix.componentGroupRefs).toBeUndefined();
  });
});
