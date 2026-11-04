import { fstatSync, lstatSync, statSync, Stats, type BigIntStats, type PathLike } from "node:fs";

/** Acquire stats with { bigint: true }; never widen a Number to form an identity. */
export type FileIdentity = Readonly<{ dev: bigint; ino: bigint }>;
export type StoredFileIdentity = Readonly<{ dev: string | number; ino: string | number }>;
type IdentityInput = FileIdentity | StoredFileIdentity;

function exactPart(value: bigint | string | number): string | null {
  if (typeof value === "bigint") return String(value);
  // Safe numeric fields are accepted only for older JSON records / injected test seams.
  if (typeof value === "number") return Number.isSafeInteger(value) ? String(value) : null;
  return typeof value === "string" && /^-?(?:0|[1-9][0-9]*)$/.test(value) ? value : null;
}

export function validStoredFileIdentity(id: IdentityInput): boolean {
  return exactPart(id.dev) !== null && exactPart(id.ino) !== null;
}

export function sameFileIdentity(a: IdentityInput, b: IdentityInput): boolean {
  return validStoredFileIdentity(a) && validStoredFileIdentity(b)
    && fileIdentityKey(a) === fileIdentityKey(b);
}

/** Persisted APFS ownership intentionally ignores a device number that changes after reboot. */
export function sameFileInode(a: IdentityInput, b: IdentityInput): boolean {
  const ino = exactPart(a.ino);
  return ino !== null && ino === exactPart(b.ino);
}

export function fileIdentityKey(id: IdentityInput): string {
  const dev = exactPart(id.dev), ino = exactPart(id.ino);
  if (dev === null || ino === null) throw new Error("Inexact file identity");
  return `${dev}:${ino}`;
}

export function storedFileIdentity(id: FileIdentity): StoredFileIdentity {
  return { dev: String(id.dev), ino: String(id.ino) };
}

/**
 * A bigint *Ns timestamp as the runtime's own numeric *Ms: whole seconds times 1e3 plus the
 * nanosecond remainder over 1e6. Number(ns) / 1e6 rounds differently (about a quarter of real
 * Windows mtimes differ), so a bigint observation would not compare equal to a numeric or
 * persisted one for the same file.
 */
export function statTimeMs(ns: bigint): number {
  return Number(ns / 1_000_000_000n) * 1e3 + Number(ns % 1_000_000_000n) / 1e6;
}

/** Preserve numeric metadata APIs while taking identity from the SAME bigint observation. */
export type IdentityStats = Omit<Stats, "dev" | "ino"> & FileIdentity;
export function identityStats(exact: BigIntStats): IdentityStats {
  if (typeof exact.dev !== "bigint" || typeof exact.ino !== "bigint") throw new Error("Bigint stat required");
  const result = Object.assign(Object.create(Stats.prototype), exact);
  for (const key of ["mode", "nlink", "uid", "gid", "rdev", "size", "blksize", "blocks", "atimeMs", "mtimeMs", "ctimeMs", "birthtimeMs"] as const) {
    result[key] = Number(exact[key]);
  }
  for (const key of ["atime", "mtime", "ctime", "birthtime"] as const) result[`${key}Ms`] = statTimeMs(exact[`${key}Ns`]);
  return result;
}
export const statFileIdentity = (path: PathLike): IdentityStats => identityStats(statSync(path, { bigint: true }));
export const lstatFileIdentity = (path: PathLike): IdentityStats => identityStats(lstatSync(path, { bigint: true }));
export const fstatFileIdentity = (fd: number): IdentityStats => identityStats(fstatSync(fd, { bigint: true }));
