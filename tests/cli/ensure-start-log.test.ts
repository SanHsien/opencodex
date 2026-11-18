import { afterEach, beforeEach, expect, test } from "bun:test";
import { spawn } from "node:child_process";
import { appendFileSync, existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  describeEnsureStartFailure,
  ENSURE_START_LOG_MAX_BYTES,
  ENSURE_START_LOG_NAME,
  openEnsureStartLog,
  spawnWithEnsureStartLog,
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

test("a write failure after the log opened closes the descriptor and falls back to ignored stdio", () => {
  const closed: number[] = [];
  const log = openEnsureStartLog(dir, () => new Date(), {
    open: () => 77,
    write: () => { throw new Error("ENOSPC: no space left on device"); },
    close: fd => { closed.push(fd); },
  });
  expect(log.stdio).toBe("ignore");
  expect(log.header).toBeNull();
  expect(closed).toEqual([77]);
  expect(() => log.closeParentHandle()).not.toThrow();
  expect(closed).toEqual([77]); // the fallback handle owns nothing, so no second close
});

test("the failure report shows only this spawn's lines, never another ensure's earlier error", () => {
  const path = join(dir, ENSURE_START_LOG_NAME);
  writeFileSync(path, "\n[2026-11-17T00:00:00.000Z] ensure spawning ocx start (parent pid 1)\nerror: another ensure's port clash\n");
  const log = openEnsureStartLog(dir);
  log.closeParentHandle();
  appendFileSync(path, "error: our own child failed\n");
  const lines = tailEnsureStartLog(path, 8, log.header);
  expect(lines.some(line => line.includes("our own child failed"))).toBe(true);
  expect(lines.some(line => line.includes("another ensure's port clash"))).toBe(false);
  expect(lines.some(line => line.includes("parent pid 1)"))).toBe(false);
  // A header that is no longer in the log (truncated by a concurrent ensure) shows nothing, not strangers' lines.
  writeFileSync(path, "error: someone else\n");
  expect(tailEnsureStartLog(path, 8, log.header)).toEqual([]);
});

test("spawn throwing synchronously still releases the parent's copy of the log handle", () => {
  const closed: number[] = [];
  const log = openEnsureStartLog(dir, () => new Date(), { open: () => 88, write: () => {}, close: fd => { closed.push(fd); } });
  expect(() => spawnWithEnsureStartLog(log, () => { throw new Error("spawn EINVAL"); })).toThrow("spawn EINVAL");
  expect(closed).toEqual([88]);
  // The normal path still passes the descriptor to the spawner and closes afterwards, once.
  const log2 = openEnsureStartLog(dir, () => new Date(), { open: () => 89, write: () => {}, close: fd => { closed.push(fd); } });
  expect(spawnWithEnsureStartLog(log2, stdio => stdio)).toBe(89);
  log2.closeParentHandle();
  expect(closed).toEqual([88, 89]);
});

// A winner that holds the lease for less than one poll interval never shows up in the lease
// polling, but the loser's own output still carries the lease-busy code.
function exitedChildWithLog(output: string, priorLog = "") {
  const path = join(dir, ENSURE_START_LOG_NAME);
  if (priorLog) writeFileSync(path, priorLog);
  const log = openEnsureStartLog(dir);
  log.closeParentHandle();
  appendFileSync(path, output);
  let listener: ((code: number | null, signal: NodeJS.Signals | null) => void) | undefined;
  const child = { pid: 4242, once: (_: "exit", l: typeof listener) => { listener = l; } };
  const watch = watchEnsureStartChild(child, path, Date.now(), () => null, log.header);
  return { watch, exit: () => listener?.(1, null) };
}

test("a lease-busy code in this spawn's output counts as contention even when the lease poll saw nothing", () => {
  const { watch, exit } = exitedChildWithLog("   code: \"OWNERSHIP_MUTATION_LEASE_BUSY\"\n");
  expect(watch.anotherStartHoldsLease()).toBe(false); // child still running: nothing to read yet
  exit();
  expect(watch.anotherStartHoldsLease()).toBe(true);
  expect(watch.report()).toContain("another ocx start held the runtime ownership lease");
});

test("a lease-busy code from an earlier ensure is not contention for this one", () => {
  const prior = "\n[2026-11-17T00:00:00.000Z] ensure spawning ocx start (parent pid 1)\n   code: \"OWNERSHIP_MUTATION_LEASE_BUSY\"\n";
  const { watch, exit } = exitedChildWithLog("error: port 10100 already owned\n", prior);
  exit();
  expect(watch.anotherStartHoldsLease()).toBe(false);
});
