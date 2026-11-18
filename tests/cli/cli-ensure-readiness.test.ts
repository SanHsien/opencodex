import { describe, expect, test } from "bun:test";
import { appendFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openEnsureStartLog, watchEnsureStartChild } from "../../src/cli/ensure-start-log";
import {
  ENSURE_EXITED_CHILD_TIMEOUT_MS,
  ENSURE_READY_TIMEOUT_MS,
  ensureKeepWaiting,
  waitForLiveProxy,
} from "../../src/cli/ensure-readiness";

function fakeClock() {
  let t = 1_000;
  return {
    now: () => t,
    sleep: async (ms: number) => { t += ms; },
    advance: (ms: number) => { t += ms; },
  };
}

describe("ocx ensure readiness wait", () => {
  test("a live child that answers after 8 s is still reported running", async () => {
    const clock = fakeClock();
    const spawnedAt = clock.now();
    const readyAt = spawnedAt + 20_000;
    const live = await waitForLiveProxy({
      find: async () => (clock.now() >= readyAt ? { port: 10100 } : null),
      timeoutMs: ENSURE_READY_TIMEOUT_MS,
      keepWaiting: ensureKeepWaiting(spawnedAt, () => false, clock.now),
      now: clock.now,
      sleep: clock.sleep,
    });
    expect(live).toEqual({ port: 10100 });
    expect(clock.now() - spawnedAt).toBeGreaterThanOrEqual(20_000);
  });

  test("an exited child keeps the old 8 s bound", async () => {
    const clock = fakeClock();
    const spawnedAt = clock.now();
    let probes = 0;
    const live = await waitForLiveProxy({
      find: async () => { probes += 1; return null; },
      timeoutMs: ENSURE_READY_TIMEOUT_MS,
      keepWaiting: ensureKeepWaiting(spawnedAt, () => true, clock.now),
      now: clock.now,
      sleep: clock.sleep,
    });
    expect(live).toBeNull();
    const waited = clock.now() - spawnedAt;
    expect(waited).toBeGreaterThanOrEqual(ENSURE_EXITED_CHILD_TIMEOUT_MS);
    expect(waited).toBeLessThan(ENSURE_EXITED_CHILD_TIMEOUT_MS + 1_000);
    expect(probes).toBeGreaterThan(1);
  });

  test("a child that exits mid-wait still gets one more observation before failing", async () => {
    const clock = fakeClock();
    const spawnedAt = clock.now();
    clock.advance(ENSURE_EXITED_CHILD_TIMEOUT_MS + 5_000);
    let probes = 0;
    const live = await waitForLiveProxy({
      find: async () => { probes += 1; return null; },
      timeoutMs: ENSURE_READY_TIMEOUT_MS,
      keepWaiting: ensureKeepWaiting(spawnedAt, () => true, clock.now),
      now: clock.now,
      sleep: clock.sleep,
    });
    expect(live).toBeNull();
    expect(probes).toBe(1);
  });

  // Field case (2026-11-17, v2.100.12): two ensures woke when a service operation ended and both
  // spawned ocx start. The loser's child exited on OWNERSHIP_MUTATION_LEASE_BUSY within ~4-7 s,
  // and its ensure gave up 8 s after spawn while the winner was still becoming healthy.
  test("an exited child keeps waiting to the ceiling once another start was seen holding the lease", async () => {
    const clock = fakeClock();
    const spawnedAt = clock.now();
    const readyAt = spawnedAt + 20_000;
    let leaseChecks = 0;
    const live = await waitForLiveProxy({
      find: async () => (clock.now() >= readyAt ? { port: 10100 } : null),
      timeoutMs: ENSURE_READY_TIMEOUT_MS,
      // Another start holds the lease only briefly, then releases it while still warming up.
      keepWaiting: ensureKeepWaiting(spawnedAt, () => true, clock.now, () => ++leaseChecks <= 2),
      now: clock.now,
      sleep: clock.sleep,
    });
    expect(live).toEqual({ port: 10100 });
    expect(clock.now() - spawnedAt).toBeGreaterThanOrEqual(20_000);
  });

  // The winner held the lease for less than one poll interval, so no sample ever saw it. The
  // loser's own output still names the lease-busy code, and that alone must keep ensure waiting.
  test("a lease-busy code in the exited child's log keeps waiting although the lease poll always reads empty", async () => {
    const clock = fakeClock();
    const spawnedAt = clock.now();
    const readyAt = spawnedAt + 20_000;
    const dir = mkdtempSync(join(tmpdir(), "ocx-ensure-readiness-"));
    try {
      const log = openEnsureStartLog(dir);
      log.closeParentHandle();
      appendFileSync(log.path, "   code: \"OWNERSHIP_MUTATION_LEASE_BUSY\"\n");
      let onExit: ((code: number | null, signal: NodeJS.Signals | null) => void) | undefined;
      const watch = watchEnsureStartChild({ pid: 4242, once: (_, l) => { onExit = l; } }, log.path, spawnedAt, () => null, log.header);
      onExit?.(1, null);
      const live = await waitForLiveProxy({
        find: async () => (clock.now() >= readyAt ? { port: 10100 } : null),
        timeoutMs: ENSURE_READY_TIMEOUT_MS,
        keepWaiting: ensureKeepWaiting(spawnedAt, watch.exited, clock.now, watch.anotherStartHoldsLease),
        now: clock.now,
        sleep: clock.sleep,
      });
      expect(live).toEqual({ port: 10100 });
      expect(clock.now() - spawnedAt).toBeGreaterThanOrEqual(20_000);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("seen contention still ends at the readiness ceiling when nobody becomes healthy", async () => {
    const clock = fakeClock();
    const spawnedAt = clock.now();
    const live = await waitForLiveProxy({
      find: async () => null,
      timeoutMs: ENSURE_READY_TIMEOUT_MS,
      keepWaiting: ensureKeepWaiting(spawnedAt, () => true, clock.now, () => true),
      now: clock.now,
      sleep: clock.sleep,
    });
    expect(live).toBeNull();
    const waited = clock.now() - spawnedAt;
    expect(waited).toBeGreaterThanOrEqual(ENSURE_READY_TIMEOUT_MS);
    expect(waited).toBeLessThan(ENSURE_READY_TIMEOUT_MS + 1_000);
  });

  test("an exited child with no other start in sight keeps the 8 s bound", async () => {
    const clock = fakeClock();
    const spawnedAt = clock.now();
    const live = await waitForLiveProxy({
      find: async () => null,
      timeoutMs: ENSURE_READY_TIMEOUT_MS,
      keepWaiting: ensureKeepWaiting(spawnedAt, () => true, clock.now, () => false),
      now: clock.now,
      sleep: clock.sleep,
    });
    expect(live).toBeNull();
    expect(clock.now() - spawnedAt).toBeLessThan(ENSURE_EXITED_CHILD_TIMEOUT_MS + 1_000);
  });

  test("a child that never answers fails at the readiness ceiling", async () => {
    const clock = fakeClock();
    const started = clock.now();
    const live = await waitForLiveProxy({
      find: async () => null,
      timeoutMs: ENSURE_READY_TIMEOUT_MS,
      keepWaiting: ensureKeepWaiting(started, () => false, clock.now),
      now: clock.now,
      sleep: clock.sleep,
    });
    expect(live).toBeNull();
    expect(clock.now() - started).toBeGreaterThanOrEqual(ENSURE_READY_TIMEOUT_MS);
  });
});
