import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { codexRemotePermissionProfileCompatibility } from "../../src/remote-control/workspace-codex-sandbox";

function withHome(run: (home: string, root: string) => void): void {
  const root = mkdtempSync(join(tmpdir(), "oc-sandbox-config-"));
  try {
    const home = join(root, "codex-home");
    mkdirSync(home);
    run(home, root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test("absent config is compatible", () => {
  withHome(home => {
    expect(codexRemotePermissionProfileCompatibility(home)).toEqual({ compatible: true });
  });
});

test("legacy sandbox_mode in a plain config is incompatible", () => {
  withHome(home => {
    writeFileSync(join(home, "config.toml"), 'sandbox_mode = "workspace-write"\n');
    expect(codexRemotePermissionProfileCompatibility(home).compatible).toBe(false);
  });
});

test("an unreadable config (a directory) fails closed", () => {
  withHome(home => {
    mkdirSync(join(home, "config.toml"));
    const result = codexRemotePermissionProfileCompatibility(home);
    expect(result.compatible).toBe(false);
    expect(result.reason).toContain("cannot be safely inspected");
  });
});

test.skipIf(process.platform === "win32")("a symlinked config.toml is read through, as Codex does", () => {
  withHome((home, root) => {
    const target = join(root, "dotfiles-config.toml");
    writeFileSync(target, 'model = "gpt-5"\n');
    symlinkSync(target, join(home, "config.toml"), "file");
    expect(codexRemotePermissionProfileCompatibility(home)).toEqual({ compatible: true });

    writeFileSync(target, 'sandbox_mode = "workspace-write"\n');
    expect(codexRemotePermissionProfileCompatibility(home).compatible).toBe(false);
  });
});
