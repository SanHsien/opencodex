/** A one-use restart handoff from a running sibling to its own replacement. */
import { randomBytes } from "node:crypto";
import { realpathSync, renameSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { atomicWriteFile } from "../config/atomic-write";
import { getConfigDir } from "../config/paths";
import { readRuntimePort } from "../config/process-state";
import { readBoundedRegularFile } from "../lib/bounded-file-read";
import { assertNotRealHomeUnderTest } from "../lib/test-home-guard";
import { siblingOfLivePort } from "./sibling-start";

const NONCE_RE = /^[A-Za-z0-9_-]{43}$/;
const MAX_HANDOFF_AGE_MS = 2 * 60_000;
const MAX_RECORD_BYTES = 512;

function handoffPath(home: string, nonce: string): string {
  return join(home, `sibling-handoff-${nonce}.json`);
}

/** Issue only while this home's runtime record still identifies the running sibling. */
export function issueSiblingHandoff(ownerPort: number): string {
  const home = getConfigDir();
  assertNotRealHomeUnderTest(home);
  const runtime = readRuntimePort(process.pid);
  if (siblingOfLivePort() !== ownerPort || !runtime
    || runtime.siblingOfPort !== ownerPort || runtime.port === ownerPort) {
    throw new Error("Cannot hand off sibling status without this home's live sibling record.");
  }
  const nonce = randomBytes(32).toString("base64url");
  const record = {
    version: 1,
    nonce,
    home: realpathSync(home),
    issuerPid: process.pid,
    issuerPort: runtime.port,
    ownerPort,
    issuedAt: Date.now(),
  };
  atomicWriteFile(handoffPath(home, nonce), JSON.stringify(record));
  return nonce;
}

/** Atomically claim and consume the record; a copied env cannot replay it. */
export function consumeSiblingHandoff(ownerPort: number, nonce: string | undefined): boolean {
  if (!nonce || !NONCE_RE.test(nonce)) return false;
  const home = getConfigDir();
  let canonicalHome: string;
  try { canonicalHome = realpathSync(home); }
  catch { return false; }
  const source = handoffPath(home, nonce);
  const claimed = `${source}.claimed-${process.pid}`;
  try { renameSync(source, claimed); }
  catch { return false; }
  try {
    // Type, size, mode and bytes all come from one descriptor, so the claimed name cannot be swapped
    // between the check and the read (CodeQL js/file-system-race).
    const read = readBoundedRegularFile(claimed, MAX_RECORD_BYTES);
    if (read.kind !== "present" || read.bytes.length === 0) return false;
    const stat = read.stat;
    if (process.platform !== "win32" && ((stat.mode & 0o077) !== 0 || stat.uid !== process.getuid?.())) return false;
    const record = JSON.parse(read.content) as Record<string, unknown>;
    const issuedAt = record.issuedAt;
    const now = Date.now();
    return record.version === 1 && record.nonce === nonce && record.home === canonicalHome
      && record.ownerPort === ownerPort && Number.isSafeInteger(record.issuerPid)
      && Number(record.issuerPid) > 0 && Number.isInteger(record.issuerPort)
      && Number(record.issuerPort) > 0 && Number(record.issuerPort) <= 65535
      && record.issuerPort !== ownerPort && typeof issuedAt === "number"
      && issuedAt <= now && now - issuedAt <= MAX_HANDOFF_AGE_MS;
  } catch {
    return false;
  } finally {
    try { unlinkSync(claimed); } catch { /* already consumed */ }
  }
}
