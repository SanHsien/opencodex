import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  statSync,
  symlinkSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, posix, win32 } from "node:path";
import { createIsolatedTestEnvironment } from "../../scripts/test";
import {
  recoverStaleTestTempArtifacts,
  removeTestTempTree,
  TEST_TEMP_OWNER_FILE,
  TEST_TEMP_RECOVERY_AGE_MS,
} from "../../scripts/test-temp";
import { removeTreeWithRetry } from "../helpers/remove-tree";
import { SPAWN_BUDGET_MS } from "../helpers/test-budget";

// Split out of test-runner.test.ts to keep that file under the file-size ratchet cap
// (fork merge of upstream v2.88.0 pushed it over 2000 lines).

function pathIsContainedBy(parent: string, candidate: string, platform: "posix" | "win32"): boolean {
  const path = platform === "win32" ? win32 : posix;
  const relative = path.relative(path.resolve(parent), path.resolve(candidate));
  return relative === "" || (!relative.startsWith(`..${path.sep}`)
    && relative !== ".." && !path.isAbsolute(relative));
}

describe("test runner transpiler cache isolation", () => {
  test("places the default executable cache inside its owned sandbox", () => {
    const isolated = createIsolatedTestEnvironment({});
    try {
      const cache = isolated.env.BUN_RUNTIME_TRANSPILER_CACHE_PATH!;
      expect(cache).toBe(join(isolated.root, "bun-transpiler-cache"));
      const entry = lstatSync(cache);
      expect(entry.isDirectory()).toBe(true);
      expect(entry.isSymbolicLink()).toBe(false);
      if (process.platform !== "win32") {
        expect(entry.uid).toBe(process.geteuid!());
        expect(entry.mode & 0o777).toBe(0o700);
        expect(lstatSync(isolated.root).mode & 0o777).toBe(0o700);
        expect(lstatSync(isolated.env.TMPDIR!).mode & 0o777).toBe(0o700);
      }
    } finally { isolated.cleanup(); }
    expect(existsSync(isolated.root)).toBe(false);
  });

  test("independent sandboxes neither reuse nor remove another default cache", () => {
    const first = createIsolatedTestEnvironment({});
    const second = createIsolatedTestEnvironment({});
    try {
      const firstCache = first.env.BUN_RUNTIME_TRANSPILER_CACHE_PATH!;
      const secondCache = second.env.BUN_RUNTIME_TRANSPILER_CACHE_PATH!;
      expect(firstCache).not.toBe(secondCache);
      writeFileSync(join(firstCache, "fixture"), "first");
      writeFileSync(join(secondCache, "fixture"), "second");
      first.cleanup();
      expect(existsSync(firstCache)).toBe(false);
      expect(readFileSync(join(secondCache, "fixture"), "utf8")).toBe("second");
    } finally { first.cleanup(); second.cleanup(); }
  });

  test("nested home isolation inherits the parent's cache and leaves its lifetime to the owner", () => {
    const parent = createIsolatedTestEnvironment({});
    const child = createIsolatedTestEnvironment(parent.env);
    try {
      const cache = parent.env.BUN_RUNTIME_TRANSPILER_CACHE_PATH!;
      expect(child.root).not.toBe(parent.root);
      expect(child.env.BUN_RUNTIME_TRANSPILER_CACHE_PATH).toBe(cache);
      writeFileSync(join(cache, "fixture"), "parent-owned");
      child.cleanup();
      expect(readFileSync(join(cache, "fixture"), "utf8")).toBe("parent-owned");
    } finally { child.cleanup(); parent.cleanup(); }
  });

  test("keeps an explicit cache path without creating or reclaiming it", () => {
    const fixture = mkdtempSync(join(tmpdir(), "ocx-cache-override-"));
    const override = join(fixture, "operator-selected");
    const isolated = createIsolatedTestEnvironment({ BUN_RUNTIME_TRANSPILER_CACHE_PATH: override });
    try {
      expect(isolated.env.BUN_RUNTIME_TRANSPILER_CACHE_PATH).toBe(override);
      expect(existsSync(override)).toBe(false);
      expect(existsSync(join(isolated.root, "bun-transpiler-cache"))).toBe(false);
      mkdirSync(override);
      writeFileSync(join(override, "fixture"), "operator-owned");
      isolated.cleanup();
      expect(readFileSync(join(override, "fixture"), "utf8")).toBe("operator-owned");
    } finally { isolated.cleanup(); removeTreeWithRetry(fixture); }
  });

  test.each(["", "0"])("preserves cache-disable value %j without allocating a default cache", value => {
    const isolated = createIsolatedTestEnvironment({ BUN_RUNTIME_TRANSPILER_CACHE_PATH: value });
    try {
      expect(isolated.env.BUN_RUNTIME_TRANSPILER_CACHE_PATH).toBe(value);
      expect(existsSync(join(isolated.root, "bun-transpiler-cache"))).toBe(false);
    } finally { isolated.cleanup(); }
  });

  test.each(["directory", "symlink"])("does not adopt or alter a pre-existing shared cache %s", kind => {
    const fixture = mkdtempSync(join(tmpdir(), "ocx-cache-legacy-"));
    const legacy = join(fixture, "ocx-test-bun-transpiler-cache");
    const target = join(fixture, "foreign-cache");
    mkdirSync(target);
    writeFileSync(join(target, "fixture"), "leave-unchanged");
    if (kind === "symlink") symlinkSync(target, legacy, process.platform === "win32" ? "junction" : "dir");
    else { mkdirSync(legacy); writeFileSync(join(legacy, "fixture"), "leave-unchanged"); }
    const before = lstatSync(legacy);
    const oldEnv = { TMPDIR: process.env.TMPDIR, TMP: process.env.TMP, TEMP: process.env.TEMP };
    let isolated: ReturnType<typeof createIsolatedTestEnvironment> | undefined;
    try {
      process.env.TMPDIR = fixture; process.env.TMP = fixture; process.env.TEMP = fixture;
      isolated = createIsolatedTestEnvironment({});
      expect(dirname(isolated.root)).toBe(fixture);
      expect(isolated.env.BUN_RUNTIME_TRANSPILER_CACHE_PATH).toBe(join(isolated.root, "bun-transpiler-cache"));
      isolated.cleanup();
      expect(readFileSync(join(legacy, "fixture"), "utf8")).toBe("leave-unchanged");
      expect(lstatSync(legacy).ino).toBe(before.ino);
      expect(lstatSync(legacy).mode).toBe(before.mode);
      expect(lstatSync(legacy).isSymbolicLink()).toBe(kind === "symlink");
    } finally {
      isolated?.cleanup();
      for (const [name, value] of Object.entries(oldEnv)) {
        if (value === undefined) delete process.env[name]; else process.env[name] = value;
      }
      removeTreeWithRetry(fixture);
    }
  });

  test("Bun children with different homes reuse only the selected private cache", () => {
    const isolated = createIsolatedTestEnvironment({ ...process.env, BUN_RUNTIME_TRANSPILER_CACHE_PATH: undefined });
    try {
      const cache = isolated.env.BUN_RUNTIME_TRANSPILER_CACHE_PATH!;
      const source = join(isolated.root, "cacheable-fixture.ts");
      // Above the pinned Bun runtime's cache threshold; no production code or credential is loaded.
      writeFileSync(source, `const value: string = ${JSON.stringify("x".repeat(70_000))}; console.log(value.length);`);
      // A hit only reads; a miss for the identical input must add or rewrite an entry. Seal the
      // first home's entries at a sentinel mtime, then the second home proves reuse by adding
      // nothing, rewriting nothing, and leaving no cache anywhere else in the sandbox.
      const sealedAt = new Date("2001-01-01T00:00:00Z");
      const sandboxPiles = () => readdirSync(isolated.root, { recursive: true })
        .map(String)
        .filter(entry => entry.endsWith(".pile"))
        .sort();
      let sealed: string[] | undefined;
      for (const name of ["first-home", "second-home"]) {
        const home = join(isolated.root, name);
        mkdirSync(home);
        const child = Bun.spawnSync([process.execPath, source], {
          cwd: isolated.root,
          env: { ...isolated.env, HOME: home, USERPROFILE: home },
          stdout: "pipe", stderr: "pipe", timeout: SPAWN_BUDGET_MS,
        });
        expect(child.exitCode, new TextDecoder().decode(child.stderr)).toBe(0);
        expect(new TextDecoder().decode(child.stdout).trim()).toBe("70000");
        expect(readdirSync(home)).toEqual([]);
        const piles = sandboxPiles();
        if (sealed === undefined) {
          expect(piles.length).toBeGreaterThan(0);
          for (const entry of piles) {
            const file = join(isolated.root, entry);
            expect(pathIsContainedBy(cache, file, process.platform === "win32" ? "win32" : "posix"))
              .toBe(true);
            utimesSync(file, sealedAt, sealedAt);
          }
          sealed = piles;
        } else {
          expect(piles).toEqual(sealed);
          for (const entry of sealed) {
            expect(statSync(join(isolated.root, entry)).mtimeMs).toBe(sealedAt.getTime());
          }
        }
      }
      expect(dirname(cache)).toBe(isolated.root);
    } finally { isolated.cleanup(); }
  }, { timeout: SPAWN_BUDGET_MS * 3 });
});

describe("Windows test TEMP recovery", () => {
  const age = (path: string, milliseconds: number) => {
    const date = new Date(milliseconds);
    utimesSync(path, date, date);
  };

  /** Stamp a candidate the way `writeTestTempOwner` does, then age the marker and the directory. */
  const ownRoot = (path: string, createdAtMs: number, pid = 4_294_967_295) => {
    writeFileSync(join(path, TEST_TEMP_OWNER_FILE), JSON.stringify({
      schemaVersion: 1,
      kind: "opencodex-test-root",
      root: realpathSync(path),
      createdAtMs,
      pid,
    }) + "\n");
    age(join(path, TEST_TEMP_OWNER_FILE), createdAtMs);
    age(path, createdAtMs);
  };

  test("removes a root it can prove it owns and leaves an unstamped look-alike alone", () => {
    // The distinction this pins is the whole safety property: reclamation is decided by the
    // ownership marker, never by the name. The thousands of directories already sitting in a
    // user's TEMP were written by versions that stamped nothing, so they are scanned, skipped,
    // and left for the user to clear. This release changes future runs.
    const tempRoot = mkdtempSync(join(tmpdir(), "opencodex-recovery-fixture-"));
    const nowMs = Date.now();
    const stale = nowMs - TEST_TEMP_RECOVERY_AGE_MS - 1_000;
    const owned = join(tempRoot, "opencodex-test-Ab12Cd");
    const unstamped = join(tempRoot, "opencodex-test-Zx98Yw");
    const young = join(tempRoot, "opencodex-test-Qq11Ww");
    const legacyName = join(tempRoot, "ocx-runtime-Rr22Tt");
    const unrelated = join(tempRoot, "application-cache-Ab12Cd");
    for (const path of [owned, unstamped, young, legacyName, unrelated]) mkdirSync(path);
    ownRoot(owned, stale);
    ownRoot(young, nowMs - TEST_TEMP_RECOVERY_AGE_MS + 60_000);
    age(unstamped, stale);
    age(legacyName, stale);
    age(unrelated, stale);

    try {
      const result = recoverStaleTestTempArtifacts({
        tempRoot,
        platform: "win32",
        nowMs,
        processIsAlive: () => false,
      });
      // Only the three `opencodex-test-*` names are candidates at all; the legacy `ocx-*` shape
      // never carried a marker, so widening the scan to it could only ever produce skips.
      expect(result).toMatchObject({ scanned: 3, removed: 1, skipped: 2, errors: 0 });
      expect(existsSync(owned)).toBe(false);
      expect(existsSync(unstamped)).toBe(true);
      expect(existsSync(young)).toBe(true);
      expect(existsSync(legacyName)).toBe(true);
      expect(existsSync(unrelated)).toBe(true);
    } finally {
      removeTreeWithRetry(tempRoot);
    }
  });

  test("fails closed for invalid ownership metadata and linked trees", () => {
    const tempRoot = mkdtempSync(join(tmpdir(), "opencodex-recovery-fixture-"));
    const nowMs = Date.now();
    const invalidOwner = join(tempRoot, "opencodex-test-Aa11Bb");
    const linked = join(tempRoot, "opencodex-test-Cc22Dd");
    const liveOwner = join(tempRoot, "opencodex-test-Ee33Ff");
    const linkTarget = join(tempRoot, "link-target");
    mkdirSync(invalidOwner);
    mkdirSync(linked);
    mkdirSync(liveOwner);
    mkdirSync(linkTarget);
    writeFileSync(join(invalidOwner, TEST_TEMP_OWNER_FILE), JSON.stringify({ schemaVersion: 1 }));
    writeFileSync(join(liveOwner, TEST_TEMP_OWNER_FILE), JSON.stringify({
      schemaVersion: 1,
      kind: "opencodex-test-root",
      root: realpathSync(liveOwner),
      createdAtMs: nowMs - TEST_TEMP_RECOVERY_AGE_MS - 1_000,
      pid: process.pid,
    }));
    symlinkSync(linkTarget, join(linked, "redirect"), process.platform === "win32" ? "junction" : "dir");
    // Stamped and long dead, so the only thing left to refuse it is the link in its tree.
    ownRoot(linked, nowMs - TEST_TEMP_RECOVERY_AGE_MS - 1_000);
    age(invalidOwner, nowMs - TEST_TEMP_RECOVERY_AGE_MS - 1_000);
    age(join(liveOwner, TEST_TEMP_OWNER_FILE), nowMs - TEST_TEMP_RECOVERY_AGE_MS - 1_000);
    age(liveOwner, nowMs - TEST_TEMP_RECOVERY_AGE_MS - 1_000);

    try {
      const result = recoverStaleTestTempArtifacts({
        tempRoot,
        platform: "win32",
        nowMs,
        processIsAlive: pid => pid === process.pid,
      });
      expect(result).toMatchObject({ scanned: 3, removed: 0, skipped: 3, errors: 0 });
      expect(existsSync(invalidOwner)).toBe(true);
      expect(existsSync(linked)).toBe(true);
      expect(existsSync(liveOwner)).toBe(true);
      expect(existsSync(linkTarget)).toBe(true);
    } finally {
      removeTreeWithRetry(tempRoot);
    }
  });

  test("bounds recovery and leaves remaining candidates for a later run", () => {
    const tempRoot = mkdtempSync(join(tmpdir(), "opencodex-recovery-fixture-"));
    const nowMs = Date.now();
    for (const name of ["opencodex-test-Aa11Bb", "opencodex-test-Cc22Dd"]) {
      const path = join(tempRoot, name);
      mkdirSync(path);
      ownRoot(path, nowMs - TEST_TEMP_RECOVERY_AGE_MS - 1_000);
    }

    try {
      const result = recoverStaleTestTempArtifacts({
        tempRoot,
        platform: "win32",
        nowMs,
        maxCandidates: 1,
        processIsAlive: () => false,
      });
      expect(result).toMatchObject({ scanned: 1, removed: 1, errors: 0, truncated: true });
      expect(readdirSync(tempRoot)).toHaveLength(1);
    } finally {
      removeTreeWithRetry(tempRoot);
    }
  });

  test("retries transient release races and preserves terminal failures", () => {
    let attempts = 0;
    const sleeps: number[] = [];
    removeTestTempTree("fixture", {
      delays: [7, 7],
      remove: () => {
        attempts += 1;
        if (attempts < 3) throw Object.assign(new Error("busy"), { code: "EBUSY" });
      },
      sleep: milliseconds => { sleeps.push(milliseconds); },
    });
    expect(attempts).toBe(3);
    expect(sleeps).toEqual([7, 7]);
    expect(() => removeTestTempTree("fixture", {
      remove: () => { throw Object.assign(new Error("denied"), { code: "EACCES" }); },
    })).toThrow("denied");
  });
});

/**
 * Without `--parallel`, `--isolate` re-evaluates the module graph once per file on a single
 * core. Past ~900 files that stops reading as slow and starts reading as hung: measured at
 * 1 h 29 m with zero output, ~57 % CPU and 8.5 MB RSS. Four workers keep the suite inside a
 * few minutes without the deadline-sensitive failures observed when Bun selected all ten cores.
 * These pin the argv so the bound cannot be dropped again silently.
 */
