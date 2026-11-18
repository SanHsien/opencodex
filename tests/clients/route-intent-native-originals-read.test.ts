import { afterEach, beforeEach, expect, spyOn, test } from "bun:test";
import * as fs from "node:fs";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { nativeIntentOriginalsPath, readNativeIntentOriginals } from "../../src/client/route-intent-native-originals";
import { removeTreeWithRetry } from "../helpers/remove-tree";

// Reader only: no config write and no mutation lock, so these cases run wherever a temp dir does.
let root: string;
let previous: string | undefined;
const record = (original: boolean | null) => JSON.stringify({ version: 1, fields: { codex: { original, published: false } } });
beforeEach(() => {
  previous = process.env.OPENCODEX_HOME;
  root = mkdtempSync(join(tmpdir(), "ocx-native-originals-read-"));
  process.env.OPENCODEX_HOME = root;
  mkdirSync(dirname(nativeIntentOriginalsPath()), { recursive: true });
});
afterEach(() => {
  if (previous === undefined) delete process.env.OPENCODEX_HOME; else process.env.OPENCODEX_HOME = previous;
  removeTreeWithRetry(root);
});

test("an originals record swapped in after the type check is not adopted", () => {
  const path = nativeIntentOriginalsPath();
  writeFileSync(path, record(null));
  const forgedPath = join(root, "forged-originals.json");
  // A well-formed record naming a different original: a restore would write it back into the config.
  writeFileSync(forgedPath, record(true));
  const lstat = fs.lstatSync;
  const spy = spyOn(fs, "lstatSync");
  let swapped = false;
  try {
    spy.mockImplementation(((target: fs.PathLike, options?: fs.StatOptions) => {
      const stat = lstat(target, options as never);
      if (!swapped && String(target) === path && new Error().stack?.includes("readBoundedRegularFile")) {
        swapped = true;
        fs.renameSync(forgedPath, path);
      }
      return stat;
    }) as typeof fs.lstatSync);
    expect(() => readNativeIntentOriginals()).toThrow("unreadable");
  } finally {
    spy.mockRestore();
  }
  expect(swapped).toBe(true);
});

test("a missing record reads null, a valid one reads back, and an oversized one is refused", () => {
  expect(readNativeIntentOriginals()).toBeNull();
  writeFileSync(nativeIntentOriginalsPath(), record(true));
  expect(readNativeIntentOriginals()?.fields.codex).toEqual({ original: true, published: false });
  writeFileSync(nativeIntentOriginalsPath(), " ".repeat(16 * 1024 + 1));
  expect(() => readNativeIntentOriginals()).toThrow("unreadable");
});
