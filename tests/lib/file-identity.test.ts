import { expect, test } from "bun:test";
import { fileIdentityKey, sameFileIdentity, identityStats, storedFileIdentity, sameFileInode, statTimeMs, validStoredFileIdentity } from "../../src/lib/file-identity";
import { readCodexHomeJournal } from "../../src/codex/codex-home-owner";
import { readBoundedCodexConfig } from "../../src/codex/inject/bounded-config-reader";
import { readBoundedLocalFile } from "../../src/codex/orca-auth-source";

import { readBoundedRegularFile } from "../../src/lib/bounded-file-read";
import { mkdtempSync, writeFileSync } from "node:fs";
import * as fs from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spyOn } from "bun:test";
import { removeTreeWithRetry } from "../helpers/remove-tree";
import { RemoteWorkspaceExecutor } from "../../src/remote-control/workspace-executor";

test("stored identities reject coerced non-primitive JSON fields", () => {
  for (const value of [null, true, [1], {}, "1.0", "01", Number.MAX_SAFE_INTEGER + 1]) {
    expect(validStoredFileIdentity({ dev: value, ino: "1" } as any)).toBe(false);
    expect(validStoredFileIdentity({ dev: "1", ino: value } as any)).toBe(false);
  }
});

test("workspace rejects an adjacent large root ID even when numeric stats would collide", async () => {
  const root = mkdtempSync(join(tmpdir(), "ocx-workspace-exact-id-"));
  const realLstat = fs.lstatSync;
  let ino = 2n ** 53n;
  const lexical = spyOn(fs, "lstatSync").mockImplementation(((path: any, options: any) => {
    const stat = realLstat(path, options);
    Object.defineProperty(stat, "ino", { value: options?.bigint ? ino : Number(ino), configurable: true });
    return stat;
  }) as typeof fs.lstatSync);
  try {
    const executor = new RemoteWorkspaceExecutor({ deviceId: "fixture", roots: [{ id: "root", path: root }] });
    ino++;
    expect(Number(ino)).toBe(Number(ino - 1n));
    const result = await executor.invoke({ requestId: "read", sessionId: "fixture", executorDeviceId: "fixture",
      rootId: "root", tool: "list_directory", arguments: {} });
    expect(result).toMatchObject({ ok: false, error: expect.stringContaining("root identity changed") });
  } finally { lexical.mockRestore(); removeTreeWithRetry(root); }
});

test("bounded reader retains distinct adjacent large file IDs", () => {
  const root = mkdtempSync(join(tmpdir(), "ocx-exact-id-"));
  const path = join(root, "fixture");
  writeFileSync(path, "fixture");
  const realLstat = fs.lstatSync;
  const realFstat = fs.fstatSync;
  const id = 2n ** 53n + 1n;
  const rewrite = (value: any, options: any) => {
    Object.defineProperty(value, "ino", { value: options?.bigint ? id : Number(id), configurable: true });
    return value;
  };
  const lexical = spyOn(fs, "lstatSync").mockImplementation(((p: any, options: any) => rewrite(realLstat(p, options), options)) as typeof fs.lstatSync);
  const descriptor = spyOn(fs, "fstatSync").mockImplementation(((fd: number, options: any) => rewrite(realFstat(fd, options), options)) as typeof fs.fstatSync);
  try {
    expect(Number(id)).toBe(Number(id - 1n));
    const result = readBoundedRegularFile(path, 64);
    expect(result.kind).toBe("present");
    if (result.kind === "present") expect(String(result.identity.ino)).toBe(String(id));
  } finally { lexical.mockRestore(); descriptor.mockRestore(); removeTreeWithRetry(root); }
});

test("compares and formats adjacent large file IDs", () => {
  const a = { dev: 7n, ino: 2n ** 53n };
  const b = { dev: 7n, ino: a.ino + 1n };
  expect(Number(a.ino)).toBe(Number(b.ino));
  expect(sameFileIdentity(a, a)).toBe(true);
  expect(sameFileIdentity(a, b)).toBe(false);
  expect(sameFileIdentity(a, { ...a, dev: 8n })).toBe(false);
  expect(fileIdentityKey(b).split(":").map(BigInt)).toEqual([b.dev, b.ino]);
});

test("metadata retains numeric methods while bigint identity survives JSON storage", () => {
  const exact = fs.statSync(import.meta.filename, { bigint: true });
  const a = identityStats(exact);
  expect(a.isFile()).toBe(true);
  expect(a.isDirectory()).toBe(false);
  expect(a.mode).toBe(Number(exact.mode));
  expect(a.mtimeMs).toBe(statTimeMs(exact.mtimeNs));
  expect(a.mtimeMs).toBe(fs.statSync(import.meta.filename).mtimeMs);
  const first = { dev: 2n ** 54n, ino: 2n ** 53n };
  const second = { dev: first.dev, ino: first.ino + 1n };
  const stored = JSON.parse(JSON.stringify(storedFileIdentity(second)));
  expect(sameFileIdentity(second, stored)).toBe(true);
  expect(sameFileIdentity(first, stored)).toBe(false);
  expect(sameFileIdentity(second, { dev: Number(second.dev), ino: Number(second.ino) })).toBe(false);
  expect(sameFileIdentity({ dev: 1n, ino: 2n }, { dev: 1, ino: 2 })).toBe(true);
  expect(sameFileInode(second, { dev: "1", ino: String(second.ino) })).toBe(true);
  expect(sameFileInode(first, stored)).toBe(false);
});

test("bigint-derived milliseconds equal the numeric stat milliseconds of the same file", () => {
  const root = mkdtempSync(join(tmpdir(), "ocx-stat-time-"));
  try {
    const path = join(root, "file");
    writeFileSync(path, "fixture");
    for (const time of [1793358320.9811772, 1793358320.5383171, 1700000000.123456789, 1.5]) {
      fs.utimesSync(path, time, time);
      const big = fs.lstatSync(path, { bigint: true });
      const numeric = fs.lstatSync(path);
      expect(statTimeMs(big.mtimeNs)).toBe(numeric.mtimeMs);
      expect(statTimeMs(big.ctimeNs)).toBe(numeric.ctimeMs);
      expect(identityStats(big).mtimeMs).toBe(numeric.mtimeMs);
      expect(identityStats(big).ctimeMs).toBe(numeric.ctimeMs);
    }
  } finally { removeTreeWithRetry(root); }
});

test("stat milliseconds use whole seconds plus the nanosecond remainder, not the whole nanosecond count", () => {
  // Dividing the whole nanosecond count rounds differently from the runtime's sec*1e3 + nsec/1e6.
  const ns = 1793358320981177200n;
  expect(statTimeMs(ns)).toBe(1793358320981.1772);
  expect(Number(ns) / 1e6).toBe(1793358320981.177);
});

const adjacentIdReaders = [
  ["journal", (path: string) => expect(readCodexHomeJournal(path).kind).toBe("unknown")],
  ["config", (path: string) => expect(() => readBoundedCodexConfig(path)).toThrow("changed while it was read")],
  ["local file", (path: string) => expect(() => readBoundedLocalFile(path)).toThrow("Local credential file changed")],
] as const;
for (const [name, read] of adjacentIdReaders) {
  test(`${name} reader rejects a descriptor whose file ID is one above the path's beyond numeric precision`, () => {
    const root = mkdtempSync(join(tmpdir(), "ocx-reader-id-"));
    const path = join(root, "data");
    writeFileSync(path, JSON.stringify({ version: 1, originalConfig: "", originalProfile: null }));
    const id = 2n ** 53n;
    const realStat = fs.statSync, realLstat = fs.lstatSync, realFstat = fs.fstatSync;
    const rewrite = (value: any, options: any, ino: bigint) =>
      Object.assign(Object.create(Object.getPrototypeOf(value)), value, { ino: options?.bigint ? ino : Number(ino) });
    const stat = spyOn(fs, "statSync").mockImplementation(((target: any, options: any) => {
      const value = options?.bigint ? realStat(target, { bigint: true }) : realStat(target);
      return target === path ? rewrite(value, options, id) : value;
    }) as typeof fs.statSync);
    const lstat = spyOn(fs, "lstatSync").mockImplementation(((target: any, options: any) => {
      const value = options?.bigint ? realLstat(target, { bigint: true }) : realLstat(target);
      return target === path ? rewrite(value, options, id) : value;
    }) as typeof fs.lstatSync);
    const fstat = spyOn(fs, "fstatSync").mockImplementation(((fd: any, options: any) => {
      const value = options?.bigint ? realFstat(fd, { bigint: true }) : realFstat(fd);
      return rewrite(value, options, id + 1n);
    }) as typeof fs.fstatSync);
    try { expect(Number(id)).toBe(Number(id + 1n)); read(path); }
    finally { fstat.mockRestore(); lstat.mockRestore(); stat.mockRestore(); removeTreeWithRetry(root); }
  });
}

// A bigint stat's *Ms is truncated to whole milliseconds; the *Ns field is the exact timestamp, so a
// rewrite that lands within the same millisecond must still be seen as a change.
function withLaterSubMillisecondTimestamps<T>(path: string, afterObservation: number, body: () => T): T {
  const realLstat = fs.lstatSync, realFstat = fs.fstatSync;
  let lstatCalls = 0, fstatCalls = 0;
  const bump = (value: any, calls: number) => calls <= afterObservation ? value
    : Object.assign(Object.create(Object.getPrototypeOf(value)), value, { mtimeNs: value.mtimeNs + 1n, ctimeNs: value.ctimeNs + 1n });
  const lstat = spyOn(fs, "lstatSync").mockImplementation(((target: any, options: any) => {
    const value = options?.bigint ? realLstat(target, { bigint: true }) : realLstat(target);
    return options?.bigint && target === path ? bump(value, ++lstatCalls) : value;
  }) as typeof fs.lstatSync);
  const fstat = spyOn(fs, "fstatSync").mockImplementation(((fd: any, options: any) => {
    const value = options?.bigint ? realFstat(fd, { bigint: true }) : realFstat(fd);
    return options?.bigint ? bump(value, ++fstatCalls) : value;
  }) as typeof fs.fstatSync);
  try { return body(); } finally { fstat.mockRestore(); lstat.mockRestore(); }
}

test("journal reader treats a sub-millisecond timestamp change during the read as a change", () => {
  const root = mkdtempSync(join(tmpdir(), "ocx-reader-time-"));
  try {
    const path = join(root, "journal.json");
    writeFileSync(path, JSON.stringify({ version: 1, originalConfig: "", originalProfile: null }));
    expect(readCodexHomeJournal(path).kind).toBe("read");
    // lstat 1 and fstat 1 are the pre-read observations; the second lstat is the post-read one.
    expect(withLaterSubMillisecondTimestamps(path, 1, () => readCodexHomeJournal(path).kind)).toBe("unknown");
  } finally { removeTreeWithRetry(root); }
});

test("bounded reader treats a sub-millisecond timestamp change during the read as a change", () => {
  const root = mkdtempSync(join(tmpdir(), "ocx-reader-time-"));
  try {
    const path = join(root, "data");
    writeFileSync(path, "fixture");
    expect(readBoundedRegularFile(path, 64).kind).toBe("present");
    const result = withLaterSubMillisecondTimestamps(path, 1, () => readBoundedRegularFile(path, 64));
    expect(result).toMatchObject({ kind: "refused", reason: "changed-while-reading" });
  } finally { removeTreeWithRetry(root); }
});
