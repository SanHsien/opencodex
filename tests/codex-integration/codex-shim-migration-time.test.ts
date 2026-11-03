import { expect, spyOn, test } from "bun:test";
import * as fs from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { migrateLegacyUnixShim } from "../../src/codex/shim-migration";
import { SHIM_MARKER, shQuote } from "../../src/codex/shim-templates";
import { removeTreeWithRetry } from "../helpers/remove-tree";

// Exercise the Unix recovery algorithm on Windows too, using real files/hard links.
// Only platform/ownership and timestamp observations are substituted, then restored.
function recover(options: { evacuated?: boolean; strings?: boolean; change?: string } = {}) {
  const root = fs.mkdtempSync(join(tmpdir(), "ocx-migration-time-"));
  const original = join(root, "codex");
  const backup = `${original}.opencodex-real`;
  const quarantine = `${original}.opencodex-migrating`;
  const journal = join(root, "codex-shim.migration.json");
  const native = "#!/bin/sh\necho native\n";
  const wrapper = `#!/bin/sh\n# ${SHIM_MARKER}\nexec ${shQuote(backup)} "$@"\n`;
  const oldHome = process.env.OPENCODEX_HOME;
  const platform = Object.getOwnPropertyDescriptor(process, "platform")!;
  const getuid = Object.getOwnPropertyDescriptor(process, "getuid");
  const realLstat = fs.lstatSync;
  const realFstat = fs.fstatSync;
  const ns = 1700000000000001100n;
  // The pre-bigint numeric stat conversion and the exact-stat helper round differently.
  const legacyMs = Number(ns / 1000000000n) * 1000 + Number(ns % 1000000000n) / 1e6;
  const currentMs = Number(ns) / 1e6;
  expect(legacyMs).not.toBe(currentMs);
  const ids = new Map<string, bigint>();
  const observe = (stat: any, bigint: boolean, exactIno: bigint) => {
    const key = String(exactIno);
    if (!ids.has(key)) ids.set(key, BigInt(ids.size + 1));
    Object.assign(stat, {
      dev: bigint ? 1n : 1, ino: bigint ? ids.get(key)! : Number(ids.get(key)),
      uid: bigint ? 1000n : 1000,
      mode: bigint ? BigInt(Number(stat.mode) & ~0o022) : Number(stat.mode) & ~0o022,
      mtimeMs: bigint ? ns / 1000000n : legacyMs,
      ...(bigint ? { mtimeNs: ns } : {}),
    });
    return stat;
  };
  const lexical = spyOn(fs, "lstatSync").mockImplementation(((path: any, opts: any) =>
    observe(realLstat(path, opts), !!opts?.bigint, realLstat(path, { bigint: true }).ino)) as typeof fs.lstatSync);
  const descriptor = spyOn(fs, "fstatSync").mockImplementation(((fd: number, opts: any) =>
    observe(realFstat(fd, opts), !!opts?.bigint, realFstat(fd, { bigint: true }).ino)) as typeof fs.fstatSync);
  try {
    process.env.OPENCODEX_HOME = root;
    Object.defineProperty(process, "platform", { ...platform, value: "linux" });
    Object.defineProperty(process, "getuid", { configurable: true, value: () => 1000 });
    fs.writeFileSync(original, wrapper, { mode: 0o700 });
    fs.writeFileSync(backup, native, { mode: 0o700 });
    const identity = (path: string) => {
      const stat = fs.lstatSync(path);
      return { dev: options.strings ? String(stat.dev) : stat.dev,
        ino: options.strings ? String(stat.ino) : stat.ino,
        mode: stat.mode, size: stat.size, mtimeMs: legacyMs };
    };
    const record = { original, backup, wrapper: identity(original), saved: identity(backup) };
    switch (options.change) {
      case "time": record.saved.mtimeMs += 1; break;
      case "submillisecond": record.saved.mtimeMs += 0.01; break;
      case "ino": record.saved.ino = options.strings ? "9007199254740993" : 99; break;
      case "unsafe": record.saved.ino = Number.MAX_SAFE_INTEGER + 1; break;
      case "mode": record.saved.mode ^= 0o100; break;
      case "size": record.saved.size++; break;
      case "link": Object.assign(record.saved, { link: "different-target" }); break;
      case "invalid": record.saved.mtimeMs = Infinity; break;
    }
    const bytes = JSON.stringify(record) + "\n";
    fs.writeFileSync(journal, bytes, { mode: 0o600 });
    if (options.evacuated) {
      fs.linkSync(original, quarantine);
      fs.unlinkSync(original);
    }
    const result = migrateLegacyUnixShim({ platform: "linux", wrapperPath: original,
      originalPath: original, backupPath: backup });
    if (options.change) {
      expect(result.status).toBe("refused");
      expect(fs.readFileSync(journal, "utf8")).toBe(bytes);
      expect(fs.readFileSync(backup, "utf8")).toBe(native);
      expect(fs.readFileSync(options.evacuated ? quarantine : original, "utf8")).toBe(wrapper);
    } else {
      expect(result).toEqual({ status: "native-restored", launcherPath: original });
      expect(fs.readFileSync(original, "utf8")).toBe(native);
      expect(fs.existsSync(backup)).toBe(false);
      expect(fs.existsSync(quarantine)).toBe(false);
      expect(fs.existsSync(journal)).toBe(false);
    }
  } finally {
    lexical.mockRestore(); descriptor.mockRestore();
    Object.defineProperty(process, "platform", platform);
    if (getuid) Object.defineProperty(process, "getuid", getuid);
    else Reflect.deleteProperty(process, "getuid");
    if (oldHome === undefined) delete process.env.OPENCODEX_HOME;
    else process.env.OPENCODEX_HOME = oldHome;
    removeTreeWithRetry(root);
  }
}

for (const strings of [false, true]) {
  for (const evacuated of [false, true]) {
    test(`resumes a cross-version journal (${strings ? "decimal" : "safe numeric"} identity, evacuated=${evacuated})`, () => {
      recover({ strings, evacuated });
    });
  }
}
for (const change of ["time", "submillisecond", "ino", "unsafe", "mode", "size", "link", "invalid"]) {
  test(`preserves recovery artifacts when ${change} differs beyond conversion rounding`, () => recover({ change }));
}
