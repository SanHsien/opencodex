import { Database } from "bun:sqlite";
import { afterEach, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { existsSync, linkSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  codexHomeDatabaseName,
  RUNTIME_LOCK_FAMILIES,
  snapshotRuntimeLocks,
  sweepRuntimeLocksCreatedSince,
} from "../../scripts/lib/test-runtime-lock-sweep";
import { removeTreeWithRetry } from "../helpers/remove-tree";
import { repoPath } from "../helpers/repo-root";

const roots: string[] = [];
const held: Database[] = [];

afterEach(() => {
  for (const database of held.splice(0)) database.close();
  for (const root of roots.splice(0)) removeTreeWithRetry(root);
});

function runtimeRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "ocx-runtime-lock-sweep-"));
  roots.push(root);
  for (const family of RUNTIME_LOCK_FAMILIES) mkdirSync(join(root, family));
  return root;
}

function lockName(seed: string): string {
  return `${seed.repeat(64).slice(0, 64)}.sqlite`;
}

function createLock(root: string, family: string, name: string): string {
  const path = join(root, family, name);
  new Database(path, { create: true }).close();
  return path;
}

describe("per-user runtime lock sweep", () => {
  test("removes lock databases created after the snapshot and keeps the ones that existed before", () => {
    const root = runtimeRoot();
    const existing = createLock(root, "catalog-write-locks", lockName("a"));
    const snapshot = snapshotRuntimeLocks(root);
    const leaked = createLock(root, "catalog-write-locks", lockName("b"));
    writeFileSync(`${leaked}-journal`, "");
    const leakedNative = createLock(root, "native-write-locks", lockName("c"));

    expect(sweepRuntimeLocksCreatedSince(snapshot)).toEqual({ removed: 2, kept: 0 });
    expect(existsSync(existing)).toBe(true);
    expect(existsSync(leaked)).toBe(false);
    expect(existsSync(`${leaked}-journal`)).toBe(false);
    expect(existsSync(leakedNative)).toBe(false);
  });

  test("never sweeps a protected real-home database even when it first appears during the run", () => {
    const root = runtimeRoot();
    const name = lockName("7");
    const snapshot = snapshotRuntimeLocks(root, undefined, [name]);
    const native = createLock(root, "native-write-locks", name);

    expect(sweepRuntimeLocksCreatedSince(snapshot)).toEqual({ removed: 0, kept: 0 });
    expect(existsSync(native)).toBe(true);
  });

  test("maps a canonical Codex home to the database name opencodex derives for it", () => {
    const home = mkdtempSync(join(tmpdir(), "ocx-runtime-lock-home-"));
    roots.push(home);
    const canonical = realpathSync.native(home);

    expect(codexHomeDatabaseName(canonical)).toBe(`${createHash("sha256").update(canonical).digest("hex")}.sqlite`);
  });

  test("keeps a new lock that another connection still holds", () => {
    const root = runtimeRoot();
    const snapshot = snapshotRuntimeLocks(root);
    const path = createLock(root, "history-write-locks", lockName("d"));
    const holder = new Database(path);
    held.push(holder);
    holder.exec("BEGIN IMMEDIATE");

    expect(sweepRuntimeLocksCreatedSince(snapshot)).toEqual({ removed: 0, kept: 1 });
    expect(existsSync(path)).toBe(true);
  });

  test("ignores names that are not lock databases", () => {
    const root = runtimeRoot();
    const snapshot = snapshotRuntimeLocks(root);
    const notes = join(root, "catalog-write-locks", "notes.txt");
    const upper = join(root, "catalog-write-locks", lockName("A"));
    writeFileSync(notes, "keep");
    writeFileSync(upper, "");

    expect(sweepRuntimeLocksCreatedSince(snapshot)).toEqual({ removed: 0, kept: 0 });
    expect(existsSync(notes)).toBe(true);
    expect(existsSync(upper)).toBe(true);
  });

  test("keeps a new name that is hardlinked or is not a SQLite database", () => {
    const root = runtimeRoot();
    const snapshot = snapshotRuntimeLocks(root);
    const linked = createLock(root, "catalog-write-locks", lockName("f"));
    linkSync(linked, join(root, "native-write-locks", lockName("f")));
    const garbage = join(root, "history-write-locks", lockName("9"));
    writeFileSync(garbage, "this is not a sqlite database, only padding to fill a header page".repeat(4));

    expect(sweepRuntimeLocksCreatedSince(snapshot)).toEqual({ removed: 0, kept: 3 });
    expect(existsSync(linked)).toBe(true);
    expect(existsSync(garbage)).toBe(true);
  });

  test("tolerates a runtime root whose lock families do not exist yet", () => {
    const root = mkdtempSync(join(tmpdir(), "ocx-runtime-lock-sweep-empty-"));
    roots.push(root);
    const snapshot = snapshotRuntimeLocks(root);

    expect(sweepRuntimeLocksCreatedSince(snapshot)).toEqual({ removed: 0, kept: 0 });
  });

  test("counts a lock it could not remove as kept", () => {
    const name = lockName("e");
    const snapshot = { root: "/runtime", families: new Map<string, Set<string>>() };
    const result = sweepRuntimeLocksCreatedSince(snapshot, {
      listDir: path => (path.includes("catalog-write-locks") ? [name] : []),
      isPlainFile: path => path.endsWith(".sqlite"),
      isIdle: () => true,
      remove: () => { throw Object.assign(new Error("busy"), { code: "EBUSY" }); },
    });

    expect(result).toEqual({ removed: 0, kept: 1 });
  });
});

describe("test wrapper wiring", () => {
  const wrapper = readFileSync(repoPath("scripts", "test.ts"), "utf8");
  const main = wrapper.slice(wrapper.indexOf("if (import.meta.main)"));

  test("only the outermost wrapper snapshots, before the run clock starts", () => {
    const gate = main.indexOf(
      'if (!process.env[TEST_RUN_ID_ENV]?.trim() && process.env[TEST_RUN_NO_QUEUE_ENV] !== "1")',
    );
    const snapshot = main.indexOf("snapshotRuntimeLocks(");
    expect(gate).toBeGreaterThan(-1);
    expect(snapshot).toBeGreaterThan(gate);
    expect(main.indexOf("const startedAt = Date.now();")).toBeGreaterThan(snapshot);
  });

  test("sweeps in the finally block before releasing the test-run lock", () => {
    const finallyBlock = main.slice(main.lastIndexOf("} finally {"));
    const sweep = finallyBlock.indexOf("sweepRuntimeLocksCreatedSince(runtimeLocks)");
    expect(sweep).toBeGreaterThan(-1);
    expect(finallyBlock.indexOf("lock.release();")).toBeGreaterThan(sweep);
  });
});
