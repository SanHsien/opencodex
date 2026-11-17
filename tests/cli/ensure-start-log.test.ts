import { afterEach, beforeEach, expect, test } from "bun:test";
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  describeEnsureStartFailure,
  ENSURE_START_LOG_MAX_BYTES,
  ENSURE_START_LOG_NAME,
  openEnsureStartLog,
  tailEnsureStartLog,
  watchEnsureStartChild,
} from "../../src/cli/ensure-start-log";

let dir = "";
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "ocx-ensure-start-log-")); });
afterEach(() => { if (dir && existsSync(dir)) rmSync(dir, { recursive: true, force: true }); });

// Field case (2026-11-17, v2.100.11): 4 of 21 shim ensures printed only "Proxy did not become
// healthy after starting." because the spawned ocx start ran with stdio ignored.
test("an early-exiting start child leaves its output and exit code for the failure report", async () => {
  const log = openEnsureStartLog(dir);
  expect(log.stdio).not.toBe("ignore");
  const child = spawn(process.execPath, ["-e", "console.error('port 10100 already owned'); process.exit(3)"], {
    stdio: ["ignore", log.stdio, log.stdio],
    windowsHide: true,
  });
  log.closeParentHandle();
  const code = await new Promise<number | null>(resolve => child.once("exit", resolve));
  expect(code).toBe(3);

  const tail = tailEnsureStartLog(log.path);
  expect(tail.some(line => line.includes("ensure spawning ocx start"))).toBe(true);
  expect(tail.some(line => line.includes("port 10100 already owned"))).toBe(true);
  const report = describeEnsureStartFailure({ childExited: true, exitCode: 3, signal: null, livedMs: 120, waitedMs: 8_200 }, log.path, tail);
  expect(report).toContain("exited (code 3)");
  expect(report).toContain("after 120 ms");
  expect(report).toContain("port 10100 already owned");
});

test("lease contention counts only another live holder, never our own child, and is reported", () => {
  let listener: ((code: number | null, signal: NodeJS.Signals | null) => void) | undefined;
  const child = { pid: 4242, once: (_: "exit", l: typeof listener) => { listener = l; } };
  let holder: { pid: number | null; alive: boolean | null } | null = { pid: 4242, alive: true };
  const watch = watchEnsureStartChild(child, join(dir, "absent.log"), Date.now(), () => holder);
  expect(watch.anotherStartHoldsLease()).toBe(false); // our own child holding it is not contention
  holder = { pid: 5150, alive: false };
  expect(watch.anotherStartHoldsLease()).toBe(false); // a dead recorded holder is a stale lease
  holder = { pid: 5150, alive: true };
  expect(watch.anotherStartHoldsLease()).toBe(true);
  listener?.(1, null);
  expect(watch.exited()).toBe(true);
  expect(watch.report()).toContain("another ocx start held the runtime ownership lease");
});

test("the log is truncated once it exceeds its cap instead of growing forever", () => {
  const path = join(dir, ENSURE_START_LOG_NAME);
  writeFileSync(path, "x".repeat(ENSURE_START_LOG_MAX_BYTES + 10));
  const log = openEnsureStartLog(dir);
  log.closeParentHandle();
  expect(statSync(path).size).toBeLessThan(1_000);
  expect(readFileSync(path, "utf8")).toContain("ensure spawning ocx start");
});

test("an unopenable log falls back to ignored stdio so ensure still starts the proxy", () => {
  const log = openEnsureStartLog(join(dir, "missing", "nested"));
  expect(log.stdio).toBe("ignore");
  expect(() => log.closeParentHandle()).not.toThrow();
  expect(tailEnsureStartLog(log.path)).toEqual([]);
});
