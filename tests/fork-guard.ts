/**
 * Fork-owned test helper.
 *
 * This fork isolates the upstream governance workflows by prefixing their job
 * conditions with `github.repository == 'lidge-jun/opencodex' && …`, so they
 * stay inert here (see `docs/fork/DECISIONS.md`). Upstream's own tests assert
 * those conditions by exact string, which is the right check for upstream and
 * would otherwise fail here for a reason that is not a regression.
 *
 * Stripping the prefix keeps the upstream assertion doing its real job: the
 * condition underneath still has to match upstream's exactly, so a genuine
 * change to the gate is still caught the moment it lands.
 */
export const FORK_REPOSITORY_GUARD = "github.repository == 'lidge-jun/opencodex' && ";

export function stripForkGuard(value: string | undefined): string | undefined {
  if (typeof value !== "string") return value;
  return value.startsWith(FORK_REPOSITORY_GUARD)
    ? value.slice(FORK_REPOSITORY_GUARD.length)
    : value;
}

/** Same idea for whole-file assertions: `if: <guard> && X` reads as `if: X`. */
export function stripForkGuardFromText(text: string): string {
  return text.replaceAll(FORK_REPOSITORY_GUARD, "");
}
