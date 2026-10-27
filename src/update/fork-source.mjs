// Fork update policy (SanHsien/opencodex). The fork publishes no npm package, so every
// registry-based self-update (npm/pnpm/bun view + install of @bitkyc08/opencodex) would fetch the
// UPSTREAM build and silently replace the fork. Fork builds are installed from the fork's own
// GitHub releases (MSI), never from a registry. See docs/fork/DECISIONS.md (2026-10-27).
export const FORK_REPO = "SanHsien/opencodex";
export const FORK_RELEASES_URL = `https://github.com/${FORK_REPO}/releases/latest`;
export const FORK_SELF_UPDATE_HINT =
  `Self-update is disabled in this fork build: the registry only carries the upstream package. Download the newer build from ${FORK_RELEASES_URL}`;

/**
 * Set by tests/preload.ts so subprocesses the suite spawns (update helpers, the copied launcher)
 * also run the upstream update machinery. Honoured only together with NODE_ENV=test, which
 * `bun test` sets; a production process never sees both.
 */
export const FORK_TEST_REGISTRY_UPDATE_ENV = "OCX_FORK_TEST_REGISTRY_UPDATE";

/**
 * Mutable only so the test suite (tests/preload.ts) can exercise the upstream update machinery in
 * isolation; no production code writes it. `tests/update/fork-update-policy.test.ts` pins the default.
 */
export const forkUpdatePolicy = {
  selfUpdateAllowed: process.env.NODE_ENV === "test" && process.env[FORK_TEST_REGISTRY_UPDATE_ENV] === "1",
};

export function forkSelfUpdateBlocked() {
  return !forkUpdatePolicy.selfUpdateAllowed;
}
