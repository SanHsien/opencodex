import { closeSync, constants, fstatSync, lstatSync, openSync, readSync, type BigIntStats, type Stats } from "node:fs";

/**
 * Read a small local file that has to be a plain file and has to stay one while it is read.
 *
 * The pattern this replaces is `statSync(path)` to check the type and size, then
 * `readFileSync(path)` to get the bytes. Those are two independent resolutions of the same
 * name, and every check made by the first one describes whatever the name pointed at then --
 * not what the second one opens. Swapping the name for a symlink in between is enough to make
 * a size-bounded read of a config file into an unbounded read of anything the process can
 * reach. Every caller here reads state under the user's own config directory, so the realistic
 * case is another local process rather than a remote attacker, but the fix costs one helper.
 *
 * The descriptor is the subject: open once, then ask the DESCRIPTOR what it is and how big it
 * is, and read from the descriptor. `lstatSync` before the open refuses a symlink outright
 * (opening one would follow it, and fstat would then describe the target as a perfectly
 * ordinary file); the identity comparison afterwards catches a file replaced mid-read, which
 * a size check alone reports as a short read rather than as tampering.
 *
 * Extracted from the Codex shim's own state reader, which needed exactly this and had it
 * right; the shim now calls this and words the failures itself.
 */

export type BoundedFileRefusal =
  /** The name is a symlink, a directory, a device -- anything but a plain file. */
  | "not-a-regular-file"
  /** Present, but the process could not stat or open it. */
  | "unreadable"
  /** Larger than the caller's limit, measured on the open descriptor. */
  | "too-large"
  /** Identity or size moved between the open and the last byte: the read is not trustworthy. */
  | "changed-while-reading";

export type BoundedFileRead =
  | { kind: "absent" }
  /**
   * `code` is the errno code of a failed stat, open, or read (`reason: "unreadable"` only), so a
   * caller can still tell a transient lock (EBUSY, EACCES from a scanner on Windows) from
   * a real failure.
   */
  | { kind: "refused"; reason: BoundedFileRefusal; code?: string }
  /** `stat` is the DESCRIPTOR's stat, so a mode check on it describes the bytes just read. */
  | { kind: "present"; bytes: Buffer; content: string; stat: Stats };

function errorCode(error: unknown): string | undefined {
  return error && typeof error === "object" && "code" in error
    ? String((error as { code?: unknown }).code)
    : undefined;
}

export function readBoundedRegularFile(path: string, maxBytes: number): BoundedFileRead {
  // The lexical lstat refuses a symlink or a FIFO before anything is opened; Windows has no
  // O_NOFOLLOW, and opening a FIFO without O_NONBLOCK would block.
  let lexicalBefore: BigIntStats;
  try {
    lexicalBefore = lstatSync(path, { bigint: true });
  } catch (error) {
    const code = errorCode(error);
    if (code === "ENOENT") return { kind: "absent" };
    return { kind: "refused", reason: "unreadable", ...(code ? { code } : {}) };
  }
  if (lexicalBefore.isSymbolicLink() || !lexicalBefore.isFile()) {
    return { kind: "refused", reason: "not-a-regular-file" };
  }

  let fd: number;
  try {
    fd = openSync(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0) | (constants.O_NONBLOCK ?? 0));
  } catch (error) {
    const code = errorCode(error);
    if (code === "ENOENT") return { kind: "absent" };
    if (code === "ELOOP" || code === "EISDIR") {
      return { kind: "refused", reason: "not-a-regular-file" };
    }
    return { kind: "refused", reason: "unreadable", ...(code ? { code } : {}) };
  }

  try {
    const before = fstatSync(fd, { bigint: true });
    if (!before.isFile()) return { kind: "refused", reason: "not-a-regular-file" };
    if (!sameIdentity(before, lexicalBefore) || !hasTrustedIdentity(before) || !hasTrustedIdentity(lexicalBefore)) {
      return { kind: "refused", reason: "changed-while-reading" };
    }
    if (before.size > BigInt(maxBytes)) return { kind: "refused", reason: "too-large" };

    const buffer = Buffer.allocUnsafe(Number(before.size));
    let offset = 0;
    while (offset < buffer.length) {
      const bytesRead = readSync(fd, buffer, offset, buffer.length - offset, offset);
      if (bytesRead === 0) return { kind: "refused", reason: "changed-while-reading" };
      offset += bytesRead;
    }
    // One byte past the size fstat reported. A file that grew during the read is over the
    // limit as far as this caller is concerned, not a file that happens to be truncated here.
    const extra = Buffer.allocUnsafe(1);
    if (readSync(fd, extra, 0, 1, offset) !== 0) return { kind: "refused", reason: "too-large" };

    const after = fstatSync(fd, { bigint: true });
    let lexicalAfter: BigIntStats;
    try {
      lexicalAfter = lstatSync(path, { bigint: true });
    } catch {
      return { kind: "refused", reason: "changed-while-reading" };
    }
    // Mode and owner are compared too (v2.88 hardening of the shim state reader): a chmod/chown
    // between the lexical stat, the open and the last byte is not a trustworthy read.
    if (!sameIdentity(before, after) || !hasTrustedIdentity(after) || before.size !== after.size
      || before.mtimeMs !== after.mtimeMs || before.ctimeMs !== after.ctimeMs
      || before.mode !== after.mode || before.uid !== after.uid
      || lexicalBefore.mode !== before.mode || lexicalBefore.uid !== before.uid
      || lexicalAfter.isSymbolicLink() || !lexicalAfter.isFile()
      || !sameIdentity(lexicalAfter, after) || !hasTrustedIdentity(lexicalAfter)
      || lexicalAfter.mode !== after.mode || lexicalAfter.uid !== after.uid) {
      return { kind: "refused", reason: lexicalAfter.isSymbolicLink() || !lexicalAfter.isFile() ? "not-a-regular-file" : "changed-while-reading" };
    }
    return { kind: "present", bytes: buffer, content: buffer.toString("utf8"), stat: fstatSync(fd) };
  } catch (error) {
    // A byte-range lock taken after the open (EBUSY/EACCES on Windows) lands here, not on the
    // open; keep its code so callers can still treat it as transient.
    const code = errorCode(error);
    return { kind: "refused", reason: "unreadable", ...(code ? { code } : {}) };
  } finally {
    closeSync(fd);
  }
}

/** `readBoundedRegularFile` for callers that only need the text and treat every refusal alike. */
export function readBoundedRegularFileText(path: string, maxBytes: number): string | null {
  const result = readBoundedRegularFile(path, maxBytes);
  return result.kind === "present" ? result.content : null;
}

// Upstream (v2.88) synchronous Buffer reader used by gentle-shell-path and integrations/config-io.
const MAX_BOUNDED_READ_BYTES = 64 * 1024 * 1024;
const READ_CHUNK_BYTES = 64 * 1024;

function sameIdentity(
  left: { dev: bigint; ino: bigint },
  right: { dev: bigint; ino: bigint },
): boolean {
  return left.dev === right.dev && left.ino === right.ino;
}

function hasTrustedIdentity(stat: { dev: bigint; ino: bigint }): boolean {
  return stat.dev !== 0n && stat.ino !== 0n;
}

export function readBoundedRegularFileSync(path: string, limit: number): Buffer {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > MAX_BOUNDED_READ_BYTES) {
    throw new RangeError("invalid bounded file read limit");
  }

  const windows = process.platform === "win32";
  const flags = constants.O_RDONLY | (windows ? 0 : constants.O_NONBLOCK | constants.O_NOFOLLOW);
  const entryBefore = windows ? lstatSync(path, { bigint: true }) : undefined;
  if (entryBefore && (entryBefore.isSymbolicLink() || !entryBefore.isFile())) {
    throw new Error("not a regular file");
  }
  const fd = openSync(path, flags);
  try {
    const opened = fstatSync(fd, { bigint: true });
    if (!opened.isFile() || opened.size > BigInt(limit)) throw new Error("file is not bounded regular data");
    if (entryBefore && (!sameIdentity(entryBefore, opened) || opened.ino === 0n)) {
      throw new Error("file entry changed while opening");
    }

    // Start near the observed size, but keep probing up to limit + 1 if the file grows.
    let bytes = Buffer.alloc(Number(opened.size) + 1);
    let length = 0;
    while (length < limit + 1) {
      if (length === bytes.length) {
        const capacity = Math.min(limit + 1, Math.max(bytes.length * 2, bytes.length + READ_CHUNK_BYTES));
        const next = Buffer.alloc(capacity);
        bytes.copy(next, 0, 0, length);
        bytes = next;
      }
      const count = readSync(fd, bytes, length, Math.min(READ_CHUNK_BYTES, bytes.length - length), null);
      if (count === 0) break;
      length += count;
    }
    if (length > limit) throw new Error("file exceeds byte limit");

    if (entryBefore) {
      const entryAfter = lstatSync(path, { bigint: true });
      if (entryAfter.isSymbolicLink() || !entryAfter.isFile() || !sameIdentity(opened, entryAfter)) {
        throw new Error("file entry changed while reading");
      }
    }
    return bytes.subarray(0, length);
  } finally {
    closeSync(fd);
  }
}
