import { Database } from "bun:sqlite";
import { createHash } from "node:crypto";
import { lstatSync, readdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";

/**
 * Database families keyed by `sha256(canonical CODEX_HOME)` under the per-user runtime root.
 * Catalog and history are pure locks; `native-write-locks` is the Codex coordinator database
 * and holds per-home transition state, so a real home's file must never be swept.
 *
 * The root comes from the effective token's known folder and deliberately ignores HOME,
 * USERPROFILE and LOCALAPPDATA, so the test sandbox cannot redirect it: every test that
 * touches a throwaway CODEX_HOME leaves one database here. A full suite run left about
 * 1,700 of them, and 97,000 accumulated on one developer machine until hardening the
 * runtime directory ACL outran its icacls budget and Claude Desktop writes failed.
 * Only the `bun run test` wrapper sweeps; a bare `bun test` still leaves its files behind.
 */
export const RUNTIME_LOCK_FAMILIES = ["catalog-write-locks", "native-write-locks", "history-write-locks"] as const;

const LOCK_FILE = /^[0-9a-f]{64}\.sqlite$/;
const SQLITE_SIDECARS = ["-journal", "-wal", "-shm"] as const;

export interface RuntimeLockSweepDeps {
  listDir(path: string): string[];
  isPlainFile(path: string): boolean;
  /** True only when nobody holds the lock: a held one must never be unlinked (POSIX allows it). */
  isIdle(path: string): boolean;
  remove(path: string): void;
}

export interface RuntimeLockSnapshot {
  root: string;
  families: Map<string, Set<string>>;
}

export interface RuntimeLockSweepResult {
  removed: number;
  kept: number;
}

function isLockIdle(path: string): boolean {
  let database: Database | undefined;
  try {
    database = new Database(path, { readwrite: true, create: false });
    database.exec("PRAGMA busy_timeout = 0; BEGIN IMMEDIATE");
    database.exec("ROLLBACK");
    return true;
  } catch {
    return false;
  } finally {
    try { database?.close(); } catch { /* a failed close leaves the file in place */ }
  }
}

const defaultDeps: RuntimeLockSweepDeps = {
  listDir: path => {
    try { return readdirSync(path); } catch { return []; }
  },
  isPlainFile: path => {
    try {
      const stat = lstatSync(path);
      return stat.isFile() && !stat.isSymbolicLink() && stat.nlink === 1;
    } catch {
      return false;
    }
  },
  isIdle: isLockIdle,
  remove: path => { unlinkSync(path); },
};

/** The database name for a canonical CODEX_HOME path (as returned by `canonicalizeCodexHome`). */
export function codexHomeDatabaseName(canonicalHomePath: string): string {
  return `${createHash("sha256").update(canonicalHomePath).digest("hex")}.sqlite`;
}

/**
 * Record which databases already exist before the run starts. `protectedNames` (the
 * developer's real homes) count as existing even if the live proxy first creates them
 * during the run, so their coordinator state survives the sweep.
 */
export function snapshotRuntimeLocks(
  root: string,
  deps: RuntimeLockSweepDeps = defaultDeps,
  protectedNames: Iterable<string> = [],
): RuntimeLockSnapshot {
  const families = new Map<string, Set<string>>();
  const kept = [...protectedNames];
  for (const family of RUNTIME_LOCK_FAMILIES) {
    families.set(family, new Set([...deps.listDir(join(root, family)), ...kept]));
  }
  return { root, families };
}

/**
 * Remove the databases this run created and nobody holds anymore. Anything present before
 * the snapshot or protected is left alone; one that is held or cannot be removed is kept.
 */
export function sweepRuntimeLocksCreatedSince(
  snapshot: RuntimeLockSnapshot,
  deps: RuntimeLockSweepDeps = defaultDeps,
): RuntimeLockSweepResult {
  let removed = 0;
  let kept = 0;
  for (const family of RUNTIME_LOCK_FAMILIES) {
    const directory = join(snapshot.root, family);
    const before = snapshot.families.get(family) ?? new Set<string>();
    for (const name of deps.listDir(directory)) {
      if (before.has(name) || !LOCK_FILE.test(name)) continue;
      const path = join(directory, name);
      if (!deps.isPlainFile(path) || !deps.isIdle(path)) {
        kept += 1;
        continue;
      }
      try {
        deps.remove(path);
      } catch {
        kept += 1;
        continue;
      }
      removed += 1;
      for (const suffix of SQLITE_SIDECARS) {
        const sidecar = `${path}${suffix}`;
        if (!deps.isPlainFile(sidecar)) continue;
        try { deps.remove(sidecar); } catch { /* an orphaned sidecar is harmless */ }
      }
    }
  }
  return { removed, kept };
}
