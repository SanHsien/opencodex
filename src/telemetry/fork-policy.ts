// Fork telemetry policy (SanHsien/opencodex, docs/fork/DECISIONS.md 2026-11-14, decision D1).
//
// Upstream sends anonymous daily usage to its own collector (a constant URL in sender.ts and
// profile/client.ts, deliberately not configurable). A fork build sending to that collector would
// mix fork installs into the upstream project's public statistics and ship users' data to a third
// party this fork cannot answer for. So the telemetry code is adopted whole, but a fork build never
// asks for consent and never sends: the default is blocked.
//
// Same shape as src/update/fork-source.mjs: the gate opens only for the test suite
// (NODE_ENV=test plus the dedicated variable, set by tests/preload.ts) so upstream's telemetry
// tests keep running. A production process never sees both.
// tests/usage/usage-telemetry-fork-policy.test.ts pins the shipped default.
export const FORK_TEST_TELEMETRY_ENV = "OCX_FORK_TEST_TELEMETRY";

export const FORK_TELEMETRY_BLOCKED_REASON = "telemetry is disabled in this fork build";

export function forkTelemetryBlocked(env: Record<string, string | undefined> = process.env): boolean {
  return !(env.NODE_ENV === "test" && env[FORK_TEST_TELEMETRY_ENV] === "1");
}
