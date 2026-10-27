// Fork update policy (SanHsien/opencodex). The fork publishes no npm package, so every
// registry-based self-update (npm/pnpm/bun view + install of @bitkyc08/opencodex) would fetch the
// UPSTREAM build and silently replace the fork. Fork builds are installed from the fork's own
// GitHub releases (MSI), never from a registry. See docs/fork/DECISIONS.md (2026-10-27).
export const FORK_REPO = "SanHsien/opencodex";
export const FORK_RELEASES_URL = `https://github.com/${FORK_REPO}/releases/latest`;
export const FORK_SELF_UPDATE_HINT =
  `Self-update is disabled in this fork build: the registry only carries the upstream package. Download the newer build from ${FORK_RELEASES_URL}`;

/**
 * Mutable only so the test suite (tests/preload.ts) can exercise the upstream update machinery in
 * isolation; no production code writes it. `tests/update/fork-update-policy.test.ts` pins the default.
 */
export const forkUpdatePolicy = { selfUpdateAllowed: false };

export function forkSelfUpdateBlocked() {
  return !forkUpdatePolicy.selfUpdateAllowed;
}
