import { windowsInstallerConfig, windowsInstallerVersion } from "../../desktop/scripts/windows-installer-config";
import { describe, expect, test } from "bun:test";
import { createHash, generateKeyPairSync, sign as ed25519Sign } from "node:crypto";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { bundlesByTarget, collectReleaseAssets } from "../../desktop/scripts/collect-release-assets";
import {
  runBuildLocal,
  summarizeAttempts,
  type ArtifactEntry,
  type BuildLocalDeps,
} from "../../desktop/scripts/build-local";
import { buildUpdaterManifest, platformFiles, writeUpdaterManifest } from "../../desktop/scripts/updater-manifest";
import { standaloneArchiveName, standaloneTargets } from "../../scripts/standalone-targets";
import {
  expectedReleaseAssets,
  parseMinisignPublicKey,
  releaseMatrixTargets,
  verifyChecksums,
  verifyReleaseAssets,
  verifyUpdaterSignature,
} from "../../desktop/scripts/verify-release-assets";
import { repoPath } from "../helpers/repo-root";

function temporaryDirectory(): string {
  return mkdtempSync(join(tmpdir(), "opencodex-release-"));
}

describe("desktop release scripts", () => {
  test("MSI uses numeric core while public SemVer metadata remains external", () => {
    for (const version of ["2.61.0", "2.61.0-preview.20260922", "2.61.0-preview.20260922.1+build.7"]) {
      expect(windowsInstallerVersion(version)).toBe("2.61.0");
      expect(windowsInstallerConfig(version)).toEqual({ bundle: { windows: { wix: { version: "2.61.0" } } } });
    }
    expect(windowsInstallerVersion("255.255.65535")).toBe("255.255.65535");
    for (const version of ["256.1.0", "1.256.0", "1.1.65536", "2.01.0", "2.1.0-01", "v2.1.0", "2.1", "2.1.0;evil", "999999999999999999.0.0"]) {
      expect(() => windowsInstallerVersion(version)).toThrow();
    }
  });

  test("renames macOS DMG and updater archive and copies signatures", () => {
    const root = temporaryDirectory();
    try {
      const bundleRoot = join(
        root,
        "desktop",
        "src-tauri",
        "target",
        "aarch64-apple-darwin",
        "release",
        "bundle",
      );
      const dmg = join(bundleRoot, "dmg");
      const macos = join(bundleRoot, "macos");
      mkdirSync(dmg, { recursive: true });
      mkdirSync(macos, { recursive: true });
      writeFileSync(join(dmg, "OpenCodex_2.61.0_aarch64.dmg"), "dmg");
      writeFileSync(join(macos, "OpenCodex.app.tar.gz"), "archive");
      writeFileSync(join(macos, "OpenCodex.app.tar.gz.sig"), "archive-signature");

      const out = join(root, "release");
      const files = collectReleaseAssets({
        version: "2.61.0",
        target: "aarch64-apple-darwin",
        out,
        repoRoot: root,
      });

      // The paths come back from `join`, so on Windows they are separated by backslashes and a
      // "/" split returns the whole path. Asking the platform for the last segment keeps this
      // assertion about the asset names it is written to check.
      expect(files.map(path => basename(path))).toEqual([
        "OpenCodex-2.61.0-macos.dmg",
        "OpenCodex-2.61.0-macos.dmg.sha256",
        "OpenCodex-2.61.0-macos.app.tar.gz",
        "OpenCodex-2.61.0-macos.app.tar.gz.sig",
        "OpenCodex-2.61.0-macos.app.tar.gz.sha256",
      ]);
      expect(readFileSync(join(out, "OpenCodex-2.61.0-macos.app.tar.gz.sha256"), "utf8")).toMatch(
        /^[0-9a-f]{64}  OpenCodex-2\.61\.0-macos\.app\.tar\.gz\n$/,
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("renames desktop bundles and writes checksums", () => {
    const root = temporaryDirectory();
    try {
      const bundle = join(
        root,
        "desktop",
        "src-tauri",
        "target",
        "x86_64-pc-windows-msvc",
        "release",
        "bundle",
        "msi",
      );
      mkdirSync(bundle, { recursive: true });
      writeFileSync(join(bundle, "OpenCodex_2.61.0_x64_en-US.msi"), "bundle");
      writeFileSync(join(bundle, "OpenCodex_2.61.0_x64_en-US.msi.sig"), "signed");

      const out = join(root, "release");
      const files = collectReleaseAssets({
        version: "2.61.0",
        target: "x86_64-pc-windows-msvc",
        out,
        repoRoot: root,
      });

      expect(files.map(path => basename(path))).toEqual([
        "OpenCodex-2.61.0-windows-x64.msi",
        "OpenCodex-2.61.0-windows-x64.msi.sig",
        "OpenCodex-2.61.0-windows-x64.msi.sha256",
      ]);
      expect(readFileSync(join(out, "OpenCodex-2.61.0-windows-x64.msi.sha256"), "utf8")).toMatch(
        /^[0-9a-f]{64}  OpenCodex-2\.61\.0-windows-x64\.msi\n$/,
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("collects Linux formats from an explicitly staged isolated bundle root", () => {
    const root = temporaryDirectory();
    try {
      const bundleRoot = join(root, "isolated-linux-bundles");
      mkdirSync(join(bundleRoot, "appimage"), { recursive: true });
      mkdirSync(join(bundleRoot, "deb"), { recursive: true });
      writeFileSync(join(bundleRoot, "appimage", "OpenCodex.AppImage"), "appimage");
      writeFileSync(join(bundleRoot, "deb", "OpenCodex.deb"), "deb");

      const files = collectReleaseAssets({
        version: "2.61.0",
        target: "x86_64-unknown-linux-gnu",
        out: join(root, "release"),
        repoRoot: root,
        bundleRoot,
      });

      expect(files.map(path => basename(path))).toEqual([
        "OpenCodex-2.61.0-linux-x86_64.AppImage",
        "OpenCodex-2.61.0-linux-x86_64.AppImage.sha256",
        "OpenCodex-2.61.0-linux-amd64.deb",
        "OpenCodex-2.61.0-linux-amd64.deb.sha256",
      ]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("rejects ambiguous bundle matches", () => {
    const root = temporaryDirectory();
    try {
      const bundleRoot = join(
        root,
        "desktop",
        "src-tauri",
        "target",
        "aarch64-apple-darwin",
        "release",
        "bundle",
      );
      const dmg = join(bundleRoot, "dmg");
      const macos = join(bundleRoot, "macos");
      mkdirSync(dmg, { recursive: true });
      mkdirSync(macos, { recursive: true });
      writeFileSync(join(dmg, "OpenCodex_2.61.0_aarch64.dmg"), "dmg");
      writeFileSync(join(dmg, "OpenCodex_2.61.0_universal.dmg"), "dmg");
      writeFileSync(join(macos, "OpenCodex.app.tar.gz"), "archive");

      expect(() =>
        collectReleaseAssets({
          version: "2.61.0",
          target: "aarch64-apple-darwin",
          out: join(root, "release"),
          repoRoot: root,
        }),
      ).toThrow(/Multiple dmg bundles found/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("generates signed updater platforms and skips missing signatures", () => {
    const root = temporaryDirectory();
    try {
      writeFileSync(join(root, "OpenCodex-2.61.0-macos.app.tar.gz.sig"), "mac-signature\n");
      writeFileSync(join(root, "OpenCodex-2.61.0-windows-x64.msi.sig"), "win-signature\n");
      writeFileSync(join(root, "OpenCodex-2.61.0-linux-x86_64.AppImage.sig"), "appimage-signature\n");
      const warnings: string[] = [];
      const manifest = buildUpdaterManifest({
        version: "2.61.0",
        dir: root,
        repo: "lidge-jun/opencodex",
        out: join(root, "latest.json"),
        warn: message => warnings.push(message),
      });

      expect(manifest.platforms).toEqual({
        "darwin-aarch64": {
          signature: "mac-signature",
          url: "https://github.com/lidge-jun/opencodex/releases/download/v2.61.0/OpenCodex-2.61.0-macos.app.tar.gz",
        },
        "darwin-x86_64": {
          signature: "mac-signature",
          url: "https://github.com/lidge-jun/opencodex/releases/download/v2.61.0/OpenCodex-2.61.0-macos.app.tar.gz",
        },
        "windows-x86_64": {
          signature: "win-signature",
          url: "https://github.com/lidge-jun/opencodex/releases/download/v2.61.0/OpenCodex-2.61.0-windows-x64.msi",
        },
        // The AppImage keeps the plugin's default Linux key so already-released AppImage
        // installs keep resolving their updates; deb installs select the explicit key.
        "linux-x86_64": {
          signature: "appimage-signature",
          url: "https://github.com/lidge-jun/opencodex/releases/download/v2.61.0/OpenCodex-2.61.0-linux-x86_64.AppImage",
        },
      });
      expect(warnings).toHaveLength(1);
      expect(warnings[0]).toContain("linux-x86_64-deb");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("does not write a manifest when no signed updater platforms remain", () => {
    const root = temporaryDirectory();
    try {
      const out = join(root, "latest.json");
      expect(() =>
        writeUpdaterManifest({
          version: "2.61.0",
          dir: root,
          repo: "lidge-jun/opencodex",
          out,
        }),
      ).toThrow("No signed updater platforms");
      expect(existsSync(out)).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("requires every updater platform signature when requested", () => {
    const root = temporaryDirectory();
    try {
      writeFileSync(join(root, "OpenCodex-2.61.0-macos.app.tar.gz.sig"), "mac-signature\n");
      writeFileSync(join(root, "OpenCodex-2.61.0-windows-x64.msi.sig"), "win-signature\n");
      writeFileSync(join(root, "OpenCodex-2.61.0-linux-x86_64.AppImage.sig"), "appimage-signature\n");

      expect(() =>
        buildUpdaterManifest({
          version: "2.61.0",
          dir: root,
          repo: "lidge-jun/opencodex",
          out: join(root, "latest.json"),
          requireAll: true,
        }),
      ).toThrow("Missing signed updater platforms: linux-x86_64-deb");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

/**
 * The widget extension is the one piece of the macOS app that the Tauri bundler copies but
 * never signs: `copy_custom_files_to_bundle` places `macOS.files` into the bundle and does not
 * add them to `sign_paths`, so whatever signature `build-widget.sh` leaves is the signature
 * that ships. That signature was ad-hoc, because the release step that builds the widget
 * carried no signing environment at all while the very next step did. macOS does not register
 * an extension signed that way, so the app would have installed with no widget and nothing in
 * the build would have said so.
 */
describe("local bundle builds", () => {
  type Script = Record<string, number | null>;
  const depsFor = (
    scripted: Script,
    opts: { platform?: string; initialArtifacts?: ArtifactEntry[]; argv?: string[] } = {},
  ) => {
    const calls: string[][] = [];
    const logs: string[] = [];
    const errors: string[] = [];
    const artifacts = (opts.initialArtifacts ?? []).map(entry => ({ ...entry }));
    const deps: BuildLocalDeps = {
      spawn: args => {
        calls.push(args);
        const format = args[args.indexOf("--bundles") + 1]!;
        const verbose = args.includes("--verbose");
        const key = verbose ? `${format}#v` : format;
        const status = Object.hasOwn(scripted, key) ? scripted[key]! : 0;
        // A successful non-verbose build refreshes the artifact, like the real bundler.
        if (status === 0 && !verbose) {
          const existing = artifacts.find(entry => entry.path.includes(format));
          if (existing) existing.mtimeMs += 1;
          else artifacts.push({ path: `/out/OpenCodex-test_${format}`, mtimeMs: 200 });
        }
        return { status };
      },
      log: line => { logs.push(line); },
      error: line => { errors.push(line); },
      listArtifacts: () => artifacts.map(entry => ({ ...entry })),
      argv: opts.argv ?? [],
      platform: opts.platform ?? "linux",
    };
    return { calls, logs, errors, deps };
  };

  test("a failing format does not destroy the formats that build", () => {
    // Observed on a real GNOME desktop (120_install_verification.md): one shared
    // invocation died on the AppImage and the deb was never attempted.
    const { calls, logs, deps } = depsFor({ appimage: 1, deb: 0 });
    expect(runBuildLocal(deps)).toBe(1);
    const formats = calls.map(args => args[args.indexOf("--bundles") + 1]);
    expect(formats).toContain("appimage");
    expect(formats).toContain("deb");
    expect(logs.some(line => line.includes("appimage: FAILED"))).toBe(true);
    expect(logs.some(line => line.includes("deb: ok"))).toBe(true);
    expect(logs.some(line => line.includes("/out/OpenCodex-test_deb"))).toBe(true);
    expect(logs.some(line => line.includes("updater artifacts skipped"))).toBe(false);
  });

  test("a failing format is retried verbosely so the bundler's own stderr surfaces", () => {
    const { calls, errors, deps } = depsFor({ appimage: 1, deb: 0 });
    runBuildLocal(deps);
    expect(errors.some(line => line.includes("rerunning with --verbose"))).toBe(true);
    const verboseCalls = calls.filter(args => args.includes("--verbose"));
    expect(verboseCalls).toHaveLength(1);
    expect(verboseCalls[0]?.slice(0, 3)).toEqual(["tauri", "--verbose", "build"]);
    expect(verboseCalls[0]).toContain("appimage");
    expect(verboseCalls.some(args => args.includes("deb"))).toBe(false);
  });

  test("a verbose retry that succeeds does not change the recorded failure", () => {
    const { logs, deps } = depsFor({ appimage: 1, "appimage#v": 0, deb: 0 });
    expect(runBuildLocal(deps)).toBe(1);
    expect(logs.some(line => line.includes("appimage: FAILED"))).toBe(true);
  });

  test("stale bundle output is not reported as this run's artifact", () => {
    const { logs, deps } = depsFor(
      { appimage: 1, deb: 0 },
      { initialArtifacts: [{ path: "/out/OpenCodex-test_appimage", mtimeMs: 100 }] },
    );
    runBuildLocal(deps);
    expect(logs.some(line => line.includes("/out/OpenCodex-test_appimage"))).toBe(false);
    expect(logs.some(line => line.includes("/out/OpenCodex-test_deb"))).toBe(true);
  });

  test("a spawn that never started counts as a failure", () => {
    const { logs, deps } = depsFor({ appimage: null, deb: 0 });
    expect(runBuildLocal(deps)).toBe(1);
    expect(logs.some(line => line.includes("appimage: FAILED"))).toBe(true);
  });

  test("a spawn error reports the launch failure", () => {
    const errors: string[] = [];
    const deps = depsFor({ deb: 0 }).deps;
    const originalSpawn = deps.spawn;
    deps.error = line => { errors.push(line); };
    deps.spawn = args => (args.includes("appimage") ? { status: null, error: new Error("spawn bunx ENOENT") } : originalSpawn(args));
    expect(runBuildLocal(deps)).toBe(1);
    expect(errors.some(line => line.includes("could not start tauri"))).toBe(true);
  });

  test("the invocation shape is one tauri build per format, extra argv forwarded everywhere", () => {
    const { calls, deps } = depsFor({ appimage: 1, deb: 0 }, { argv: ["--target", "x86_64-unknown-linux-gnu"] });
    runBuildLocal(deps);
    expect(calls[0]?.slice(0, 5)).toEqual(["tauri", "build", "--ci", "--bundles", "appimage"]);
    expect(calls[1]?.slice(0, 5)).toEqual(["tauri", "--verbose", "build", "--ci", "--bundles"]);
    for (const call of calls) {
      expect(call.slice(-2)).toEqual(["--target", "x86_64-unknown-linux-gnu"]);
    }
  });

  test("a fully successful build exits zero and keeps the updater note", () => {
    const { logs, deps } = depsFor({});
    expect(runBuildLocal(deps)).toBe(0);
    expect(logs.some(line => line.includes("updater artifacts skipped"))).toBe(true);
  });

  test("macOS hosts build app and dmg", () => {
    const { calls, deps } = depsFor({}, { platform: "darwin" });
    expect(runBuildLocal(deps)).toBe(0);
    const formats = calls.map(args => args[args.indexOf("--bundles") + 1]);
    expect(formats).toEqual(["app", "dmg"]);
    for (const args of calls) {
      const config = JSON.parse(args[args.indexOf("--config") + 1]!);
      expect(config.bundle.macOS.signingIdentity).toBe("-");
      expect(config.bundle.createUpdaterArtifacts).toBe(false);
    }
  });

  test("local signing is macOS-only and retains the release signing configuration", () => {
    const { calls, deps } = depsFor({}, { platform: "win32" });
    expect(runBuildLocal(deps)).toBe(0);
    expect(JSON.parse(calls[0]![calls[0]!.indexOf("--config") + 1]!).bundle.macOS).toBeUndefined();
    const config = JSON.parse(readFileSync(repoPath("desktop/src-tauri/tauri.conf.json"), "utf8"));
    // Fork: updater artifacts are off in the committed config (no upstream updater key or endpoint).
    expect(config.bundle.createUpdaterArtifacts).toBe(false);
    expect(config.bundle.macOS.signingIdentity).toBeUndefined();
    const entitlements = readFileSync(repoPath("desktop/src-tauri", config.bundle.macOS.entitlements), "utf8");
    expect([...entitlements.matchAll(/<key>([^<]+)<\/key>/g)].map(match => match[1]))
      .toEqual(["com.apple.security.cs.allow-jit"]);
    expect(entitlements).toMatch(/<key>com\.apple\.security\.cs\.allow-jit<\/key>\s*<true\s*\/>/);
  });

  test("summarizeAttempts decides the exit code from the per-format outcomes", () => {
    expect(summarizeAttempts([{ format: "appimage", status: 0 }, { format: "deb", status: 0 }]).exitCode).toBe(0);
    expect(summarizeAttempts([{ format: "appimage", status: 1 }, { format: "deb", status: 0 }]).exitCode).toBe(1);
    expect(summarizeAttempts([{ format: "appimage", status: 1 }, { format: "deb", status: 1 }]).lines[0]).toContain("FAILED");
  });
});

describe("the desktop build toolchain carries the bundle-type marker", () => {
  // updater.rs selects the deb updater target from tauri_utils::platform::bundle_type(),
  // which reads a marker the tauri-bundler patches into the binary at packaging time.
  // Bundlers before 2.5.0 (tauri-cli < 2.7.0) never patch: every packaged artifact then
  // reports "unknown" and a deb install would resolve the AppImage payload it cannot
  // apply. Verified statically at tag tauri-cli-v2.11.1: crates/tauri-bundler/src/
  // bundle.rs maps Deb and AppImage to their marker values, patches per package type,
  // signs after patching, and restores the unpatched binary between formats.
  const minimumCliWithBundlePatch = { major: 2, minor: 7 };

  test("the pinned Tauri CLI is new enough to patch the bundle type into each Linux artifact", () => {
    const manifest = JSON.parse(readFileSync(repoPath("desktop", "package.json"), "utf8")) as {
      devDependencies?: Record<string, string>;
    };
    const version = manifest.devDependencies?.["@tauri-apps/cli"];
    expect(version).toBeDefined();
    const [major, minor] = version!.split(".").map(Number);
    expect(
      major! > minimumCliWithBundlePatch.major
        || (major === minimumCliWithBundlePatch.major && minor! >= minimumCliWithBundlePatch.minor),
    ).toBe(true);
  });

  test("the release workflow gives AppImage and deb independent Cargo targets", () => {
    const workflow = Bun.YAML.parse(
      readFileSync(repoPath(".github", "workflows", "release.yml"), "utf8"),
    ) as {
      jobs?: Record<string, {
        steps?: Array<{ name?: string; if?: string; run?: string; env?: Record<string, string> }>;
      }>;
    };
    const steps = workflow.jobs?.["package-desktop"]?.steps ?? [];
    const appImage = steps.find(step => step.name === "Build Linux AppImage bundle");
    const deb = steps.find(step => step.name === "Build Linux deb bundle");
    expect(appImage?.env?.CARGO_TARGET_DIR).toContain("opencodex-appimage-target");
    expect(deb?.env?.CARGO_TARGET_DIR).toContain("opencodex-deb-target");
    expect(appImage?.env?.CARGO_TARGET_DIR).not.toBe(deb?.env?.CARGO_TARGET_DIR);
    expect(appImage?.run).toContain("--bundles appimage");
    expect(deb?.run).toContain("--bundles deb");

    const stage = steps.find(step => step.name === "Stage isolated Linux release bundles");
    expect(stage?.run).toContain("$APPIMAGE_TARGET/$DESKTOP_TARGET/release/bundle/appimage/.");
    expect(stage?.run).toContain("$DEB_TARGET/$DESKTOP_TARGET/release/bundle/deb/.");
    expect(stage?.run).toContain('chmod -R a-w "$bundle_root"');
    const collect = steps.find(step => step.run?.includes("collect-release-assets.ts"));
    expect(collect?.run).toContain('--bundle-root "$DESKTOP_BUNDLE_ROOT"');
  });
});

describe("release asset verification", () => {
  const VERSION = "2.61.0";

  function writeAsset(dir: string, name: string, payload: Buffer): void {
    const digest = createHash("sha256").update(payload).digest("hex");
    writeFileSync(join(dir, name), payload);
    writeFileSync(join(dir, `${name}.sha256`), `${digest}  ${name}\n`);
  }

  function makeMinisignKeypair(keyIdHex: string): {
    pubkeyText: string;
    keyId: Buffer;
    signPayload: (payload: Buffer, rawBytes?: boolean) => string;
  } {
    const { publicKey, privateKey } = generateKeyPairSync("ed25519");
    const raw = Buffer.from(publicKey.export({ format: "der", type: "spki" })).subarray(-32);
    const keyId = Buffer.from(keyIdHex, "hex");
    const pubkeyText = `untrusted comment: test public key\n${Buffer.concat([Buffer.from("Ed"), keyId, raw]).toString("base64")}\n`;
    const signPayload = (payload: Buffer, rawBytes = false): string => {
      const signed = rawBytes ? payload : createHash("blake2b512").update(payload).digest();
      const signature = ed25519Sign(null, signed, privateKey);
      const trusted = "timestamp:1\tfile:original-before-collection.msi";
      const packet = Buffer.concat([Buffer.from("ED"), keyId, signature]).toString("base64");
      const global = ed25519Sign(null, Buffer.concat([signature, Buffer.from(trusted)]), privateKey).toString("base64");
      return Buffer.from(`untrusted comment: test signature\n${packet}\ntrusted comment: ${trusted}\n${global}\n`).toString("base64");
    };
    return { pubkeyText, keyId, signPayload };
  }

  test("accepts the upstream minisign 0.7.3 prehashed vector in Tauri encoding", () => {
    const fixture = JSON.parse(readFileSync(repoPath("tests/fixtures/minisign/prehashed-vector.json"), "utf8")) as {
      payload: string; publicKeyBase64: string; signatureBox: string;
    };
    const dir = temporaryDirectory();
    try {
      const asset = join(dir, "renamed-release.bin");
      const key = parseMinisignPublicKey(`untrusted comment: upstream key\n${fixture.publicKeyBase64}\n`);
      writeFileSync(asset, fixture.payload);
      writeFileSync(`${asset}.sig`, Buffer.from(fixture.signatureBox).toString("base64"));
      expect(() => verifyUpdaterSignature(asset, key)).not.toThrow();
      writeFileSync(asset, "tampered");
      expect(() => verifyUpdaterSignature(asset, key)).toThrow(/Signature verification failed/);
      writeFileSync(asset, fixture.payload);
      writeFileSync(`${asset}.sig`, Buffer.from(fixture.signatureBox.replace("file:test", "file:changed")).toString("base64"));
      expect(() => verifyUpdaterSignature(asset, key)).toThrow(/Comment signature verification failed/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("derives the expected set from the real release matrices and producer tables", () => {
    const workflow = readFileSync(repoPath(".github", "workflows", "release.yml"), "utf8");
    const { standaloneTargets: workflowStandalone, desktopTargets } = releaseMatrixTargets(workflow);
    // The workflow matrix and the builder's shared target set must agree exactly.
    expect([...workflowStandalone].sort()).toEqual([...standaloneTargets].sort());
    expect(desktopTargets).toHaveLength(3);

    const expected = expectedReleaseAssets({
      version: VERSION,
      desktopTargets,
      requireSignatures: true,
    });
    for (const name of [
      `ocx-${VERSION}-bun-windows-x64.zip`,
      `ocx-${VERSION}-bun-linux-x64.tar.gz`,
      `ocx-${VERSION}-bun-darwin-arm64.tar.gz.sha256`,
      `OpenCodex-${VERSION}-macos.dmg`,
      `OpenCodex-${VERSION}-macos.app.tar.gz.sig`,
      `OpenCodex-${VERSION}-windows-x64.msi`,
      `OpenCodex-${VERSION}-linux-x86_64.AppImage`,
      `OpenCodex-${VERSION}-linux-amd64.deb`,
    ]) {
      expect(expected).toContain(name);
    }
    // Signature presence follows the updater table exactly: a bundle is signed
    // precisely when platformFiles names it as an updater target, so a new updater
    // target changes this contract by itself rather than needing a hand edit here.
    const updaterSuffixes = new Set(Object.values(platformFiles));
    for (const bundle of desktopTargets.flatMap(target => bundlesByTarget[target]!)) {
      expect(expected).toContain(`OpenCodex-${VERSION}-${bundle.name}`);
      expect(expected.includes(`OpenCodex-${VERSION}-${bundle.name}.sig`))
        .toBe(updaterSuffixes.has(bundle.name));
    }
    expect(expected.some(name => name.includes("/"))).toBe(false);
  });

  test("verifies every recorded checksum and refuses a directory-prefixed record", () => {
    const dir = temporaryDirectory();
    try {
      writeAsset(dir, "ocx-1.0.0-bun-linux-x64.tar.gz", Buffer.from("payload"));
      expect(verifyChecksums(dir)).toBe(1);

      const digest = createHash("sha256").update(Buffer.from("payload")).digest("hex");
      writeFileSync(join(dir, "bad.sha256"), `${digest}  ocx-1.0.0-bun-linux-x64.tar.gz\n`);
      expect(() => verifyChecksums(dir)).toThrow(/must record its own payload/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("verifies Windows binary checksum records without weakening payload binding", () => {
    const dir = temporaryDirectory();
    const name = "ocx-1.0.0-bun-windows-x64.zip";
    const asset = join(dir, name);
    const checksum = `${asset}.sha256`;
    // Standard sha256sum binary marker observed in release run 35728908862.
    const digest = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
    try {
      writeFileSync(asset, "");
      for (const newline of ["\n", "\r\n"]) {
        writeFileSync(checksum, `${digest} *${name}${newline}`);
        expect(verifyChecksums(dir)).toBe(1);
      }
      writeFileSync(checksum, `${digest} *different.zip\n`);
      expect(() => verifyChecksums(dir)).toThrow(/must record its own payload/);
      for (const record of [`${digest} ?${name}\n`, `${digest}*${name}\n`, `${digest} *${name}\nextra\n`]) {
        writeFileSync(checksum, record);
        expect(() => verifyChecksums(dir)).toThrow(/Malformed checksum record/);
      }
      writeFileSync(checksum, `${digest} *${name}\n`);
      writeFileSync(asset, "changed");
      expect(() => verifyChecksums(dir)).toThrow(/Checksum mismatch/);
      rmSync(asset);
      expect(() => verifyChecksums(dir)).toThrow(/which is missing/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("rejects a tampered payload and a missing payload", () => {
    const dir = temporaryDirectory();
    try {
      writeAsset(dir, "ocx-1.0.0-bun-linux-x64.tar.gz", Buffer.from("payload"));
      writeFileSync(join(dir, "ocx-1.0.0-bun-linux-x64.tar.gz"), Buffer.from("tampered"));
      expect(() => verifyChecksums(dir)).toThrow(/Checksum mismatch/);

      rmSync(join(dir, "ocx-1.0.0-bun-linux-x64.tar.gz"));
      expect(() => verifyChecksums(dir)).toThrow(/which is missing/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("verifies updater signatures against the pinned key and refuses lookalikes", () => {
    const dir = temporaryDirectory();
    try {
      const { pubkeyText, signPayload } = makeMinisignKeypair("0123456789abcdef");
      const key = parseMinisignPublicKey(pubkeyText);
      const payload = Buffer.from("signed payload bytes");
      const asset = join(dir, "OpenCodex-1.0.0-macos.app.tar.gz");
      writeFileSync(asset, payload);
      writeFileSync(`${asset}.sig`, signPayload(payload));
      expect(() => verifyUpdaterSignature(asset, key)).not.toThrow();

      writeFileSync(asset, Buffer.from("tampered payload"));
      expect(() => verifyUpdaterSignature(asset, key)).toThrow(/Signature verification failed/);
      writeFileSync(asset, payload);

      const other = makeMinisignKeypair("fedcba9876543210");
      writeFileSync(`${asset}.sig`, other.signPayload(payload));
      expect(() => verifyUpdaterSignature(asset, key)).toThrow(/not the pinned updater key/);

      const valid = signPayload(payload);
      writeFileSync(`${asset}.sig`, signPayload(payload, true));
      expect(() => verifyUpdaterSignature(asset, key)).toThrow(/Signature verification failed/);
      const lines = Buffer.from(valid, "base64").toString("utf8").trimEnd().split("\n");
      const encode = (box: string[]) => Buffer.from(`${box.join("\n")}\n`).toString("base64");
      const packet = Buffer.from(lines[1]!, "base64");
      packet[10] = packet[10]! ^ 1;
      writeFileSync(`${asset}.sig`, encode([lines[0]!, packet.toString("base64"), lines[2]!, lines[3]!]));
      expect(() => verifyUpdaterSignature(asset, key)).toThrow(/Signature verification failed/);
      packet[10] = packet[10]! ^ 1;
      packet.write("Ed", 0);
      writeFileSync(`${asset}.sig`, encode([lines[0]!, packet.toString("base64"), lines[2]!, lines[3]!]));
      expect(() => verifyUpdaterSignature(asset, key)).toThrow(/Unsupported signature algorithm/);

      writeFileSync(`${asset}.sig`, encode([lines[0]!, lines[1]!, "trusted comment: changed", lines[3]!]));
      expect(() => verifyUpdaterSignature(asset, key)).toThrow(/Comment signature verification failed/);
      writeFileSync(`${asset}.sig`, encode([lines[0]!, lines[1]!, lines[2]!, Buffer.alloc(64).toString("base64")]));
      expect(() => verifyUpdaterSignature(asset, key)).toThrow(/Comment signature verification failed/);
      const sameIdOtherKey = parseMinisignPublicKey(makeMinisignKeypair("0123456789abcdef").pubkeyText);
      writeFileSync(`${asset}.sig`, valid);
      expect(() => verifyUpdaterSignature(asset, sameIdOtherKey)).toThrow(/Signature verification failed/);

      for (const malformed of [valid + "!", encode(lines.slice(0, 3)), encode([...lines, "extra"]),
        encode([lines[0]!, Buffer.alloc(73).toString("base64"), lines[2]!, lines[3]!]),
        encode([lines[0]!, lines[1]!, lines[2]!, Buffer.alloc(65).toString("base64")]),
        Buffer.from([0xff]).toString("base64"),
        Buffer.from(`\uFEFF${lines.join("\n")}`).toString("base64"),
        lines.slice(0, 2).join("\n")]) {
        writeFileSync(`${asset}.sig`, malformed);
        expect(() => verifyUpdaterSignature(asset, key)).toThrow();
      }
      writeFileSync(`${asset}.sig`, encode(["untrusted comment: changed", ...lines.slice(1)]));
      expect(() => verifyUpdaterSignature(asset, key)).not.toThrow();
      writeFileSync(`${asset}.sig`, Buffer.from(`${lines.join("\r\n")}\r\n`).toString("base64"));
      expect(() => verifyUpdaterSignature(asset, key)).not.toThrow();
      writeFileSync(`${asset}.sig`, ` \n${valid}\n`);
      expect(() => verifyUpdaterSignature(asset, key)).not.toThrow();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("runs the full pre-publication verification and writes the receipt", () => {
    const root = temporaryDirectory();
    try {
      const { pubkeyText, signPayload } = makeMinisignKeypair("0123456789abcdef");
      // The verifier reads the matrices and the pinned key from the repo root, so the
      // scratch root gets the real workflow and a conf carrying the fixture key.
      mkdirSync(join(root, ".github", "workflows"), { recursive: true });
      writeFileSync(
        join(root, ".github", "workflows", "release.yml"),
        readFileSync(repoPath(".github", "workflows", "release.yml"), "utf8"),
      );
      mkdirSync(join(root, "desktop", "src-tauri"), { recursive: true });
      writeFileSync(
        join(root, "desktop", "src-tauri", "tauri.conf.json"),
        JSON.stringify({ plugins: { updater: { pubkey: Buffer.from(pubkeyText, "utf8").toString("base64") } } }),
      );

      const dir = join(root, "dist", "release");
      mkdirSync(dir, { recursive: true });
      // The fixture derives from the producer tables — the standalone target module,
      // the bundle table, and the updater platform table — assembled independently
      // of the function under test. Building it with expectedReleaseAssets would
      // hide an omission in the expected set; hand-writing it would go stale the
      // next time a target is added (which is exactly the union failure this test
      // once carried: the deb became an updater target and this oracle missed its
      // signature).
      const desktopTargets = releaseMatrixTargets(
        readFileSync(join(root, ".github", "workflows", "release.yml"), "utf8"),
      ).desktopTargets;
      const produced = [
        ...standaloneTargets.map(target => standaloneArchiveName(VERSION, target)),
        ...desktopTargets.flatMap(target =>
          bundlesByTarget[target]!.map(bundle => `OpenCodex-${VERSION}-${bundle.name}`)),
      ];
      const updaterSuffixes = new Set(Object.values(platformFiles));
      const signed = new Set(
        produced.filter(name => updaterSuffixes.has(name.slice(`OpenCodex-${VERSION}-`.length))),
      );
      for (const name of produced) {
        writeAsset(dir, name, Buffer.from(`payload:${name}`));
        if (signed.has(name)) {
          writeFileSync(join(dir, `${name}.sig`), signPayload(readFileSync(join(dir, name))));
        }
      }

      // The derivation is checked against the oracle, not trusted: the expected set
      // must be exactly the produced payloads plus their companions.
      const expected = expectedReleaseAssets({
        version: VERSION,
        desktopTargets,
        requireSignatures: true,
      });
      const oracle = produced.flatMap(name =>
        signed.has(name) ? [name, `${name}.sha256`, `${name}.sig`] : [name, `${name}.sha256`]);
      expect([...expected].sort()).toEqual([...oracle].sort());

      const receiptPath = join(root, "verification", "receipt.json");
      const manifestPath = join(dir, "latest.json");
      const receipt = verifyReleaseAssets({
        version: VERSION,
        dir,
        repo: "lidge-jun/opencodex",
        sha: "0123456789abcdef0123456789abcdef01234567",
        repoRoot: root,
        manifestOut: manifestPath,
        receiptOut: receiptPath,
        requireSignatures: true,
      });

      expect(receipt.expectedFiles).toBe(expected.length);
      expect(receipt.checksumsVerified)
        .toBe(produced.length);
      expect(receipt.signaturesVerified).toBe(signed.size);
      // Same rule as the signed set: the platform list is the updater table's keys,
      // not a copy of them.
      expect(receipt.manifestPlatforms).toEqual(Object.keys(platformFiles).sort());
      expect(JSON.parse(readFileSync(receiptPath, "utf8"))).toEqual(receipt);

      const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
        platforms: Record<string, { url: string }>;
      };
      expect(manifest.platforms["linux-x86_64"]!.url)
        .toBe(`https://github.com/lidge-jun/opencodex/releases/download/v${VERSION}/OpenCodex-${VERSION}-linux-x86_64.AppImage`);

      // Anything beyond the expected set is refused rather than published.
      writeFileSync(join(dir, "stray.txt"), "stray");
      expect(() => verifyReleaseAssets({
        version: VERSION,
        dir,
        repo: "lidge-jun/opencodex",
        sha: "0123456789abcdef0123456789abcdef01234567",
        repoRoot: root,
        manifestOut: manifestPath,
        requireSignatures: true,
      })).toThrow(/Unexpected files/);
      rmSync(join(dir, "stray.txt"));

      rmSync(join(dir, `OpenCodex-${VERSION}-windows-x64.msi`));
      expect(() => verifyReleaseAssets({
        version: VERSION,
        dir,
        repo: "lidge-jun/opencodex",
        sha: "0123456789abcdef0123456789abcdef01234567",
        repoRoot: root,
        requireSignatures: true,
      })).toThrow(/Missing expected release assets/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
