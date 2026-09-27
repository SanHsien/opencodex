import { closeSync, fstatSync, lstatSync, openSync, readSync, type Stats } from "node:fs";

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
  let lexicalBefore: Stats;
  try {
    lexicalBefore = lstatSync(path);
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
    fd = openSync(path, "r");
  } catch (error) {
    const code = errorCode(error);
    if (code === "ENOENT") return { kind: "absent" };
    return { kind: "refused", reason: "unreadable", ...(code ? { code } : {}) };
  }

  try {
    const before = fstatSync(fd);
    if (!before.isFile()) return { kind: "refused", reason: "not-a-regular-file" };
    if (before.size > maxBytes) return { kind: "refused", reason: "too-large" };

    const buffer = Buffer.allocUnsafe(before.size);
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

    const after = fstatSync(fd);
    let lexicalAfter: Stats;
    try {
      lexicalAfter = lstatSync(path);
    } catch {
      return { kind: "refused", reason: "changed-while-reading" };
    }
    if (before.dev !== after.dev || before.ino !== after.ino || before.size !== after.size
      || before.mtimeMs !== after.mtimeMs || before.ctimeMs !== after.ctimeMs
      || lexicalBefore.dev !== before.dev || lexicalBefore.ino !== before.ino
      || lexicalAfter.isSymbolicLink() || lexicalAfter.dev !== after.dev || lexicalAfter.ino !== after.ino) {
      return { kind: "refused", reason: "changed-while-reading" };
    }
    return { kind: "present", bytes: buffer, content: buffer.toString("utf8"), stat: after };
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
