import { afterEach, beforeEach, expect, test } from "bun:test";
import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import {
  WindowsServiceMutationBusyError,
  probeWindowsServiceMutation,
  waitForWindowsServiceMutationIdle,
  withWindowsServiceMutationLock,
} from "../../src/lib/windows-service-mutation-lock";
import { removeTreeWithRetry } from "../helpers/remove-tree";
import { repoPath, repoRoot } from "../helpers/repo-root";

// The lock path is injected throughout so the suite never opens the real per-user lock and
// therefore never serializes against a genuine `ocx service` run on the developer machine.
let testRoot = "";
let lockPath = "";

const noHardening = {
  hardenDirectory: () => {},
  hardenFile: () => {},
};

async function waitForPath(path: string): Promise<void> {
  for (let attempt = 0; attempt < 500; attempt += 1) {
    if (existsSync(path)) return;
    await Bun.sleep(10);
  }
  throw new Error(`Timed out waiting for child marker ${path}`);
}

async function waitForOwnedChild(child: ReturnType<typeof Bun.spawn>): Promise<number> {
  const result = await Promise.race([
    child.exited.then(exitCode => ({ exitCode })),
    Bun.sleep(10_000).then(() => null),
  ]);
  if (result) return result.exitCode;
  child.kill();
  await child.exited;
  throw new Error("Timed out waiting for owned Windows service mutation lock child");
}

function spawnHolder(source: string): ReturnType<typeof Bun.spawn> {
  return Bun.spawn([process.execPath, "-e", source], {
    cwd: repoRoot(),
    env: { ...process.env },
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
  });
}

beforeEach(() => {
  testRoot = mkdtempSync(join(import.meta.dir, ".tmp-windows-service-mutation-lock-"));
  lockPath = join(testRoot, "windows-service-mutation.sqlite");
});

afterEach(async () => {
  // Windows keeps the SQLite file mapped briefly after a child exits, so a single
  // immediate remove can still see EBUSY. Retry, then leave the temp dir behind rather
  // than failing an otherwise green assertion on a cleanup race.
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      removeTreeWithRetry(testRoot);
      return;
    } catch (error) {
      if ((error as { code?: string }).code !== "EBUSY") throw error;
      await Bun.sleep(25);
    }
  }
});

test("a second service mutation is refused while another process holds the lock", async () => {
  const readyPath = join(testRoot, "holder-ready");
  const releasePath = join(testRoot, "holder-release");
  const lockModuleUrl = pathToFileURL(repoPath("src/lib/windows-service-mutation-lock.ts")).href;
  const child = spawnHolder(`
    import { existsSync, writeFileSync } from "node:fs";
    import { withWindowsServiceMutationLock } from ${JSON.stringify(lockModuleUrl)};
    await withWindowsServiceMutationLock(async () => {
      writeFileSync(${JSON.stringify(readyPath)}, "ready");
      while (!existsSync(${JSON.stringify(releasePath)})) Bun.sleepSync(10);
    }, { lockPath: ${JSON.stringify(lockPath)}, hardenDirectory: () => {}, hardenFile: () => {} });
  `);

  try {
    try {
      await waitForPath(readyPath);
    } catch (error) {
      child.kill();
      await child.exited;
      const stderr = await new Response(child.stderr).text().catch(() => "");
      throw new Error(`${(error as Error).message}\nchild stderr: ${stderr}`);
    }

    // Contention fails fast and, critically, without running the operation: a blocked
    // `ocx service repair` must never reach `schtasks` behind the holder's back.
    let ran = false;
    const startedAt = performance.now();
    await expect(withWindowsServiceMutationLock(async () => {
      ran = true;
    }, { lockPath, ...noHardening })).rejects.toBeInstanceOf(WindowsServiceMutationBusyError);
    expect(ran).toBe(false);
    expect(performance.now() - startedAt).toBeLessThan(2_000);
  } finally {
    writeFileSync(releasePath, "release");
    expect(await waitForOwnedChild(child)).toBe(0);
  }

  // Once the holder exits, the next mutation plans and runs normally.
  let planned = 0;
  await withWindowsServiceMutationLock(async () => { planned += 1; }, { lockPath, ...noHardening });
  expect(planned).toBe(1);
});

test("an autostart probe reports a held service mutation as busy and a released one as idle", async () => {
  // Field case (2026-11-16): ensure respawned the proxy while `ocx service install/stop` held
  // this lock, so the stop's port check failed. The probe is what ensure consults first.
  const readyPath = join(testRoot, "probe-holder-ready");
  const releasePath = join(testRoot, "probe-holder-release");
  const lockModuleUrl = pathToFileURL(repoPath("src/lib/windows-service-mutation-lock.ts")).href;
  expect(probeWindowsServiceMutation({ lockPath, platform: "win32" })).toBe("idle"); // never created
  const child = spawnHolder(`
    import { existsSync, writeFileSync } from "node:fs";
    import { withWindowsServiceMutationLock } from ${JSON.stringify(lockModuleUrl)};
    await withWindowsServiceMutationLock(async () => {
      writeFileSync(${JSON.stringify(readyPath)}, "ready");
      while (!existsSync(${JSON.stringify(releasePath)})) Bun.sleepSync(10);
    }, { lockPath: ${JSON.stringify(lockPath)}, hardenDirectory: () => {}, hardenFile: () => {} });
  `);
  try {
    await waitForPath(readyPath);
    expect(probeWindowsServiceMutation({ lockPath, platform: "win32" })).toBe("busy");
  } finally {
    writeFileSync(releasePath, "release");
    expect(await waitForOwnedChild(child)).toBe(0);
  }
  expect(probeWindowsServiceMutation({ lockPath, platform: "win32" })).toBe("idle");
});

test("a service mutation that starts while an autostart probe holds the lock still runs", async () => {
  // The probe takes the lock for an instant; a service command arriving in that instant must
  // wait it out instead of reporting "another operation is in progress".
  const lockModuleUrl = pathToFileURL(repoPath("src/lib/windows-service-mutation-lock.ts")).href;
  const readyPath = join(testRoot, "brief-holder-ready");
  const child = spawnHolder(`
    import { writeFileSync } from "node:fs";
    import { Database } from "bun:sqlite";
    const db = new Database(${JSON.stringify(lockPath)}, { create: true });
    db.exec("PRAGMA busy_timeout = 0; BEGIN IMMEDIATE");
    writeFileSync(${JSON.stringify(readyPath)}, "ready");
    Bun.sleepSync(150);
    db.exec("ROLLBACK"); db.close();
  `);
  await waitForPath(readyPath);
  let ran = false;
  await withWindowsServiceMutationLock(async () => { ran = true; }, { lockPath, ...noHardening });
  expect(ran).toBe(true);
  expect(await waitForOwnedChild(child)).toBe(0);
});

// Field case (2026-11-17, v2.100.10): the lock became visible only ~11 s into each service
// command because hardening (icacls + identity lookup) ran before BEGIN IMMEDIATE.
test("the service lock is already visible to autostarts while its directory and file are hardened", async () => {
  const seen: string[] = [];
  const probeDuring = (step: string) => () => {
    // The probe opens the lock read-write; the holder's own process must see it held too.
    seen.push(`${step}:${probeWindowsServiceMutation({ lockPath, platform: "win32" })}`);
  };
  await withWindowsServiceMutationLock(async () => {}, {
    lockPath,
    hardenDirectory: probeDuring("dir"),
    hardenFile: probeDuring("file"),
  });
  expect(seen).toEqual(["dir:busy", "file:busy"]);
});

test("a hardening failure after the lock is taken still releases it", async () => {
  await expect(withWindowsServiceMutationLock(async () => {}, {
    lockPath,
    hardenDirectory: () => { throw new Error("icacls failed"); },
    hardenFile: () => {},
  })).rejects.toThrow();
  let ran = false;
  await withWindowsServiceMutationLock(async () => { ran = true; }, { lockPath, ...noHardening });
  expect(ran).toBe(true);
});

test("waiting for an idle service mutation is bounded and reports busy when it never ends", async () => {
  let now = 0;
  const state = await waitForWindowsServiceMutationIdle({
    maxWaitMs: 2_000,
    pollMs: 500,
    probe: () => "busy",
    now: () => now,
    sleep: async ms => { now += ms; },
  });
  expect(state).toBe("busy");
  expect(now).toBe(2_000);

  let announced = 0;
  await waitForWindowsServiceMutationIdle({
    maxWaitMs: 1_000, pollMs: 250, probe: () => "busy", now: () => now, sleep: async ms => { now += ms; },
    onBusy: () => { announced++; },
  });
  expect(announced).toBe(1);

  let probes = 0;
  const released = await waitForWindowsServiceMutationIdle({
    maxWaitMs: 2_000,
    pollMs: 500,
    probe: () => (++probes < 3 ? "busy" : "idle"),
    now: () => 0,
    sleep: async () => {},
  });
  expect(released).toBe("idle");
  expect(probes).toBe(3);
});

test("the probe is idle off Windows and never opens a database there", () => {
  let opened = false;
  expect(probeWindowsServiceMutation({
    lockPath,
    platform: "linux",
    openDatabase: () => { opened = true; throw new Error("must not open"); },
  })).toBe("idle");
  expect(opened).toBe(false);
});

test("an abruptly exited holder releases the OS-backed transaction without stale recovery", async () => {
  const enteredPath = join(testRoot, "crashed-holder-entered");
  const lockModuleUrl = pathToFileURL(repoPath("src/lib/windows-service-mutation-lock.ts")).href;
  const child = spawnHolder(`
    import { writeFileSync } from "node:fs";
    import { withWindowsServiceMutationLock } from ${JSON.stringify(lockModuleUrl)};
    await withWindowsServiceMutationLock(async () => {
      writeFileSync(${JSON.stringify(enteredPath)}, "entered");
      process.exit(0);
    }, { lockPath: ${JSON.stringify(lockPath)}, hardenDirectory: () => {}, hardenFile: () => {} });
  `);

  expect(await waitForOwnedChild(child)).toBe(0);
  expect(existsSync(enteredPath)).toBe(true);

  // No stale-lock reclamation is needed, because the OS dropped the transaction on exit.
  let ran = false;
  await withWindowsServiceMutationLock(async () => { ran = true; }, { lockPath, ...noHardening });
  expect(ran).toBe(true);
});

test("a failing mutation releases the lock instead of wedging later service commands", async () => {
  await expect(withWindowsServiceMutationLock(async () => {
    throw new Error("repair failed");
  }, { lockPath, ...noHardening })).rejects.toThrow("repair failed");

  let ran = false;
  await withWindowsServiceMutationLock(async () => { ran = true; }, { lockPath, ...noHardening });
  expect(ran).toBe(true);
});

test("nested acquisition in the same process is refused rather than silently reentered", async () => {
  await expect(withWindowsServiceMutationLock(async () => {
    await withWindowsServiceMutationLock(async () => {}, { lockPath, ...noHardening });
  }, { lockPath, ...noHardening })).rejects.toBeInstanceOf(WindowsServiceMutationBusyError);

  let ran = false;
  await withWindowsServiceMutationLock(async () => { ran = true; }, { lockPath, ...noHardening });
  expect(ran).toBe(true);
});
