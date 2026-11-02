import { expect, test } from "bun:test";
import { fileIdentityKey, sameFileIdentity, identityStats, storedFileIdentity, sameFileInode, validStoredFileIdentity } from "../../src/lib/file-identity";

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
  expect(a.mtimeMs).toBe(Number(exact.mtimeNs) / 1e6);
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
