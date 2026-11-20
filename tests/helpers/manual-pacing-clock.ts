import { setProviderRequestPacingRuntimeForTest } from "../../src/providers/request-pacing";

type ManualTimer = { at: number; callback: () => void };

/**
 * Gives request pacing a clock that moves only when the test calls `advance`, so a waiter
 * that must be observed in the queue stays there however slowly the machine reaches it.
 * `onTimerArmed` runs whenever pacing arms a timer; `runQueue` arms its wake-up timer only
 * after a waiter is queued and blocked, which makes it the event for "a request is waiting".
 * `resetProviderRequestPacingForTest()` restores the real clock.
 */
export function installManualPacingClock(onTimerArmed?: () => void): { advance(ms: number): void } {
  let now = Date.now();
  const timers = new Set<ManualTimer>();
  setProviderRequestPacingRuntimeForTest({
    now: () => now,
    setTimer: (callback, delayMs) => {
      const timer = { at: now + delayMs, callback };
      timers.add(timer);
      onTimerArmed?.();
      return timer;
    },
    clearTimer: handle => { timers.delete(handle as ManualTimer); },
    enqueueMicrotask: callback => queueMicrotask(callback),
  });
  return {
    advance(ms) {
      now += ms;
      for (const timer of [...timers]) {
        if (timer.at > now || !timers.delete(timer)) continue;
        timer.callback();
      }
    },
  };
}
