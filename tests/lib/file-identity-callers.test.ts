import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { repoPath } from "../helpers/repo-root";

// NTFS file IDs exceed 2^53; these modules compare file identity, which must come from stat
// calls made with { bigint: true }. A lexical tripwire over the named declarations, not a
// full parser: it catches the regression forms below and fails closed on scopes it cannot find.
const scopes: Record<string, string[]> = {
  "src/config/initialize.ts": ["identifiesDescriptor"],
  "src/service/state-lock.ts": ["readLockSnapshot"],
  "src/oauth/store.ts": ["snapshot", "createOAuthFileLock"],
  "src/claude/intercept/proxy-auth.ts": ["assertSameNode", "readPinnedToken", "ensurePrivateDirectory", "ensureClaudeInterceptProxyToken"],
  "src/claude/desktop-remote-store-io.ts": ["read"],
  "src/lib/spend-pool-alias-validation.ts": ["readExistingSpendSalt"],
  "src/integrations/droid-settings.ts": ["assertDroidSettingsUnambiguous"],
  "src/integrations/aside-profile-context.ts": ["storeGuard"],
  "src/integrations/hermes-profiles.ts": ["lstatOrNull"],
  "src/adapters/command-code-project-context.ts": ["openedFileIsConfined"],
  "src/codex/catalog/write-audit.ts": ["appendCatalogWriteAudit"],
  "src/service/ownership-mutation-lease.mjs": ["readOwner", "readIncompleteOwner"],
  "src/update/transactional-install.mjs": ["readOwnedStageMarker"],
  "src/update/pnpm-read-policy.mjs": ["withPnpmCommandCwd"],
};

const REGEX_PRECEDES = new Set(["", "(", ",", "=", ":", "[", "!", "&", "|", "?", "{", "}", ";", "+", "-", "*", "%", "<", ">", "~", "^"]);
const REGEX_KEYWORDS = /(?:^|[^\w$])(?:return|typeof|instanceof|in|of|new|delete|void|throw|case|do|else|yield|await)$/;

/**
 * Blank literal text (strings, template text, regex literals, comments) keeping offsets, so only
 * code is balanced or matched. Template ${...} expressions stay code.
 */
function maskNonCode(source: string): string {
  const out = source.split("");
  const blank = (from: number, to: number) => { for (let at = from; at < to; at++) if (out[at] !== "\n") out[at] = " "; };
  const regexMayStart = (at: number): boolean => {
    let back = at - 1;
    while (back >= 0 && /\s/.test(out[back]!)) back--;
    if (back < 0 || REGEX_PRECEDES.has(out[back]!)) return true;
    return REGEX_KEYWORDS.test(out.slice(Math.max(0, back - 11), back + 1).join(""));
  };
  const templateDepths: number[] = [];
  let braces = 0;
  let index = 0;
  const scanTemplate = (from: number): number => {
    let at = from;
    while (at < source.length) {
      if (source[at] === "\\") { at += 2; continue; }
      if (source[at] === "`") { blank(from, at); return at + 1; }
      if (source[at] === "$" && source[at + 1] === "{") { blank(from, at); templateDepths.push(braces); braces++; return at + 2; }
      at++;
    }
    blank(from, at);
    return at;
  };
  while (index < source.length) {
    const char = source[index]!;
    const next = source[index + 1];
    if (char === "/" && next === "/") { const end = source.indexOf("\n", index); const stop = end < 0 ? source.length : end; blank(index, stop); index = stop; continue; }
    if (char === "/" && next === "*") { const end = source.indexOf("*/", index + 2); const stop = end < 0 ? source.length : end + 2; blank(index, stop); index = stop; continue; }
    if (char === "'" || char === '"') {
      let at = index + 1;
      while (at < source.length && source[at] !== char && source[at] !== "\n") at += source[at] === "\\" ? 2 : 1;
      blank(index + 1, at); index = at + 1; continue;
    }
    if (char === "`") { index = scanTemplate(index + 1); continue; }
    if (char === "/" && regexMayStart(index)) {
      let at = index + 1;
      let inClass = false;
      while (at < source.length && source[at] !== "\n" && (inClass || source[at] !== "/")) {
        if (source[at] === "\\") { at += 2; continue; }
        if (source[at] === "[") inClass = true;
        else if (source[at] === "]") inClass = false;
        at++;
      }
      blank(index + 1, at); index = at + 1; continue;
    }
    if (char === "{") braces++;
    if (char === "}") {
      braces--;
      if (templateDepths.length > 0 && braces === templateDepths[templateDepths.length - 1]) {
        templateDepths.pop(); index = scanTemplate(index + 1); continue;
      }
    }
    index++;
  }
  return out.join("");
}

function matching(code: string, open: number, left: string, right: string): number {
  let depth = 0;
  for (let at = open; at < code.length; at++) {
    if (code[at] === left) depth++;
    else if (code[at] === right && --depth === 0) return at;
  }
  return -1;
}

/** The body of NAME's declaration: a function, or a method head whose body opens on the same line. */
function declarationBody(code: string, name: string): [number, number] | null {
  const head = new RegExp(`(?:\\bfunction\\s+|^[ \\t]*(?:(?:export|async|public|private|protected|static|override)\\s+)*)${name}\\s*\\(`, "gm");
  for (const match of code.matchAll(head)) {
    const close = matching(code, match.index! + match[0].length - 1, "(", ")");
    if (close < 0) continue;
    let at = close + 1;
    while (code[at] === " " || code[at] === "\t") at++;
    if (code[at] === ":") {
      at++;
      while (/\s/.test(code[at] ?? "")) at++;
      if (code[at] === "{") at = matching(code, at, "{", "}") + 1;
      while (at < code.length && code[at] !== "{" && code[at] !== ";" && code[at] !== "\n") at++;
    }
    if (code[at] !== "{") continue;
    const end = matching(code, at, "{", "}");
    if (end > 0) return [at, end + 1];
  }
  return null;
}

/** The last top-level argument of a call's masked argument text. */
function lastArgument(args: string): string {
  let depth = 0;
  let start = 0;
  for (let at = 0; at < args.length; at++) {
    const char = args[at]!;
    if ("([{".includes(char)) depth++;
    else if (")]}".includes(char)) depth--;
    else if (char === "," && depth === 0) start = at + 1;
  }
  return args.slice(start).trim();
}

function inspect(source: string, names: string[], droid = false): string[] {
  const code = maskNonCode(source);
  const problems: string[] = [];
  for (const name of names) {
    const range = declarationBody(code, name);
    if (!range) { problems.push(`missing declaration: ${name}`); continue; }
    let observed = 0;
    for (const match of code.slice(range[0], range[1]).matchAll(/\b(?:lstatSync|fstatSync|statSync|lstat|stat|handle\.stat)\s*\(/g)) {
      const start = range[0] + match.index!;
      const close = matching(code, start + match[0].length - 1, "(", ")");
      if (close < 0) { problems.push(`unbalanced stat call in: ${name}`); continue; }
      const call = source.slice(start, close + 1);
      if (droid && /^lstatSync\(root\)$/.test(call)) continue;
      // The standalone updater checks the stage directory's type, not its identity.
      if (name === "readOwnedStageMarker" && call === "lstatSync(dir)") continue;
      observed++;
      if (!/^\{\s*bigint\s*:\s*true\s*\}$/.test(lastArgument(code.slice(start + match[0].length, close)))) problems.push(`numeric stat: ${call}`);
    }
    if (observed === 0) problems.push(`no stat call in: ${name}`);
  }
  if (/\bNumber\s*\([^)]*\.(?:ino|dev)\b/.test(code)) problems.push("numeric identity");
  return problems;
}

describe("file identity caller stats", () => {
  test("detects a numeric identity observation", () => {
    expect(inspect("function check() { const s = lstatSync(path); return s.ino === 1; }", ["check"]))
      .toEqual(["numeric stat: lstatSync(path)"]);
    expect(inspect("function check() { const s = lstatSync(join(root, name)); return s.ino === 1; }", ["check"]))
      .toEqual(["numeric stat: lstatSync(join(root, name))"]);
    expect(inspect("function check() { return lstatSync(join(root, name), { bigint: true }).ino; }", ["check"])).toEqual([]);
    expect(inspect("function check() { return lstatSync(p, convert({ bigint: true })).ino; }", ["check"]))
      .toEqual(["numeric stat: lstatSync(p, convert({ bigint: true }))"]);
    expect(inspect("function check() { const s = lstatSync(path, { bigint: true }); return Number(s.ino); }", ["check"]))
      .toEqual(["numeric identity"]);
  });

  test("strings, templates, regexes and comments cannot hide or invent a call", () => {
    expect(inspect('function check() { const a = lstatSync(join(root, "(")); const b = lstatSync(p, { bigint: true }); }', ["check"]))
      .toEqual(['numeric stat: lstatSync(join(root, "("))']);
    expect(inspect('function check() { const b = lstatSync(join(root, ")"), { bigint: true }); /* lstatSync(x) */ }', ["check"])).toEqual([]);
    expect(inspect("function check() { const b = lstatSync(p, { bigint: true }); return `${lstatSync(q).ino}`; }", ["check"]))
      .toEqual(["numeric stat: lstatSync(q)"]);
    expect(inspect("function check() { const r = /'(/; const a = lstatSync(p); // '\n}", ["check"]))
      .toEqual(["numeric stat: lstatSync(p)"]);
    expect(inspect("function check() { lstatSync(p, { bigint: true }); if (x) return /'/.test(y); lstatSync(q); // '\n}", ["check"]))
      .toEqual(["numeric stat: lstatSync(q)"]);
    expect(inspect("function check() { const half = a / b; const s = lstatSync(p, { bigint: true }); return half / 2; }", ["check"])).toEqual([]);
  });

  test("resolves the declaration, not an earlier call, and needs a real observation", () => {
    expect(inspect("function caller() { return check(); }\nfunction check() { return lstatSync(path).ino; }", ["check"]))
      .toEqual(["numeric stat: lstatSync(path)"]);
    expect(inspect("check()\n{ lstatSync(p, { bigint: true }); }\nfunction check() { return lstatSync(path).ino; }", ["check"]))
      .toEqual(["numeric stat: lstatSync(path)"]);
    expect(inspect("function check() { return 1; }", ["check"])).toEqual(["no stat call in: check"]);
    expect(inspect("function check() { lstatSync(root); }", ["check"], true)).toEqual(["no stat call in: check"]);
  });

  for (const [path, names] of Object.entries(scopes)) {
    test(path, () => expect(inspect(readFileSync(repoPath(path), "utf8"), names, path.endsWith("droid-settings.ts"))).toEqual([]));
  }
});

// Every filesystem identity owner is listed, including exact serialized and Node-only boundaries.
const identityCallers = [
  "src/adapters/codebuddy/mcp-server.ts",
  "src/adapters/command-code-project-context.ts",
  "src/claude/desktop-3p-library.ts",
  "src/claude/desktop-remote-store-io.ts",
  "src/claude/intercept/local-ca-files.ts",
  "src/claude/intercept/picker-ca-persistence.ts",
  "src/claude/intercept/proxy-auth.ts",
  "src/cli/update-restart-child.ts",
  "src/cli/update-restart-home.ts",
  "src/cli/update-restart-service-record.ts",
  "src/client/link-tunnel.ts",
  "src/client/state.ts",
  "src/clients/aside-profiles.ts",
  "src/clients/gentle-shell-path.ts",
  "src/clients/omo-role-models.ts",
  "src/codex/account-store.ts",
  "src/codex/catalog/filesystem-evidence.ts",
  "src/codex/catalog/heal-observation.ts",
  "src/codex/catalog/write-audit.ts",
  "src/codex/cli-install-provenance.ts",
  "src/codex/codex-home-owner.ts",
  "src/codex/config-write-lock.ts",
  "src/codex/context-compat.ts",
  "src/codex/coordinator-doctor.ts",
  "src/codex/desktop-compatibility/native-identity.ts",
  "src/codex/features.ts",
  "src/codex/history-provider.ts",
  "src/codex/inject/bounded-config-reader.ts",
  "src/codex/log-guard/inspect.ts",
  "src/codex/log-guard/maintenance.ts",
  "src/codex/main-account.ts",
  "src/codex/native-main-auth-temp.ts",
  "src/codex/native-main-claim.ts",
  "src/codex/native-main-lock-file.ts",
  "src/codex/native-profile-manager.ts",
  "src/codex/native-profile-stage-store.ts",
  "src/codex/native-profile-store.ts",
  "src/codex/native-residue.ts",
  "src/codex/orca-auth-source.ts",
  "src/codex/prompt-lock-claim.ts",
  "src/codex/prompt-lock-evidence.ts",
  "src/codex/shim-fingerprint.ts",
  "src/codex/shim-inspect.ts",
  "src/codex/shim-migration.ts",
  "src/codex/shim-overlay.ts",
  "src/codex/shim-restore-lock.ts",
  "src/codex/shim-state-file.ts",
  "src/codex/shim-windows-refresh.ts",
  "src/codex/shim.ts",
  "src/codex/transition-state.ts",
  "src/config/atomic-write.ts",
  "src/config/initialize.ts",
  "src/integrations/aside-profile-context.ts",
  "src/integrations/droid-settings.ts",
  "src/integrations/hermes-profiles.ts",
  "src/lab/artifacts/secure-fs.ts",
  "src/lab/fabric/scratch.ts",
  "src/lab/public/community.ts",
  "src/lab/public/file-safety.ts",
  "src/lab/public/mutation-lock.ts",
  "src/lab/public/private-file.ts",
  "src/lib/bounded-file-read.ts",
  "src/lib/bun-runtime-preflight.ts",
  "src/lib/gui-pair-intent.ts",
  "src/lib/package-tree-integrity.ts",
  "src/lib/service-secrets.ts",
  "src/lib/spend-pool-alias-validation.ts",
  "src/lib/windows-secret-acl.ts",
  "src/link/diagnostics.ts",
  "src/messaging/remote-files.ts",
  "src/oauth/store.ts",
  "src/remote-control/workspace-command-runner.ts",
  "src/remote-control/workspace-executor.ts",
  "src/routing/history/indexer.ts",
  "src/routing/history/ingest.ts",
  "src/server/live.ts",
  "src/server/restart-replacement.ts",
  "src/service/desktop-startup.ts",
  "src/service/logging.ts",
  "src/service/ownership-mutation-lease.mjs",
  "src/service/state-lock.ts",
  "src/update/pnpm-read-policy.mjs",
  "src/update/transactional-install.mjs",
  "src/usage/ledger-retention.ts",
  "src/usage/log.ts",
  "src/usage/user-cost-overlay-reconciler.ts"
];
// Numeric observations below are type/size/mode/time metadata only. Bare stat/lstat
// calls in provenance and update-home are injected functions: production defaults use
// the shared exact wrappers / bigint options. Identity must never be read from these
// numeric metadata observations. Multiplicity is pinned so a new numeric call fails.
const metadataOnlyStats: Record<string, string[]> = {
  "src/adapters/command-code-project-context.ts": [
    "lstat(candidate)",
    "stat(canonical)"
  ],
  "src/claude/desktop-remote-store-io.ts": [
    "lstatSync(absolute)"
  ],
  "src/claude/intercept/picker-ca-persistence.ts": [
    "lstatSync(canonical)"
  ],
  "src/cli/update-restart-home.ts": [
    "stat(canonical)"
  ],
  "src/codex/account-store.ts": [
    "statSync(path)"
  ],
  "src/codex/cli-install-provenance.ts": [
    "lstat(path)",
    "lstat(probe)",
    "stat(canonicalOwnershipPath)",
    "stat(path)",
    "stat(path)",
    "stat(path)",
    "stat(req.path)",
    "stat(req.path)",
    "stat(req.path)"
  ],
  "src/codex/codex-home-owner.ts": [
    "lstatSync(path)",
    "statSync(own)",
    "statSync(physical)",
    "statSync(realpathSync.native(parent))"
  ],
  "src/codex/log-guard/maintenance.ts": [
    "statSync(`${databasePath}-wal`)",
    "statSync(databasePath)"
  ],
  "src/codex/native-main-auth-temp.ts": [
    "lstatSync(path)"
  ],
  "src/codex/native-profile-manager.ts": [
    "lstatSync(expected)",
    "lstatSync(path)",
    "lstatSync(path)",
    "lstatSync(path)",
    "lstatSync(path)"
  ],
  "src/codex/native-profile-store.ts": [
    "lstatSync(path)",
    "lstatSync(path)",
    "lstatSync(path)",
    "lstatSync(path)",
    "lstatSync(root)",
    "statSync(absolute)",
    "statSync(cursor)"
  ],
  "src/codex/shim-inspect.ts": [
    "lstatSync(stateFile)"
  ],
  "src/integrations/droid-settings.ts": [
    "lstatSync(root)"
  ],
  "src/link/diagnostics.ts": [
    "file.stat()",
    "file.stat()",
    "lstat(backup)",
    "lstat(dir)"
  ],
  "src/oauth/store.ts": [
    "lstatSync(path)"
  ],
  "src/server/restart-replacement.ts": [
    "fstatSync(fd)"
  ],
  "src/update/transactional-install.mjs": [
    "lstatSync(dir)",
    "statSync(full)",
    "statSync(launcher)"
  ],
  "src/usage/ledger-retention.ts": [
    "fstatSync(sourceFd)"
  ],
  "src/usage/log.ts": [
    "fstatSync(fd)",
    "fstatSync(fd)",
    "fstatSync(fd)",
    "fstatSync(fd)"
  ]
};

function numericObservations(source: string): string[] {
  const code = maskNonCode(source), calls: string[] = [];
  for (const match of code.matchAll(/(?<![\w.])(?:lstatSync|fstatSync|statSync|lstat|stat|(?:handle|file)\.stat)\s*\(/g)) {
    const close = matching(code, match.index! + match[0].length - 1, "(", ")");
    const options = lastArgument(code.slice(match.index! + match[0].length, close));
    if (!/^\{\s*bigint\s*:\s*true\s*\}$/.test(options)) calls.push(source.slice(match.index!, close + 1));
  }
  return calls.sort();
}

for (const path of identityCallers) {
  test(`exact-identity contract: ${path}`, () => {
    const source = readFileSync(repoPath(path), "utf8");
    expect(numericObservations(source), path).toEqual(metadataOnlyStats[path] ?? []);
    // The child marker validates legacy protocol fields, delegating identity equality to home.ts.
    const standaloneNode = path.endsWith(".mjs") || path === "src/cli/update-restart-child.ts";
    expect(standaloneNode ? /Exact identity boundary:/.test(source) : /from ["'][^"']*\/file-identity["']/.test(source), path).toBe(true);
    // Ordinary runtime comparisons belong to the helper; nonzero validity checks are separate.
    if (!standaloneNode) expect(maskNonCode(source), path).not.toMatch(/\.(?:ino|dev)\s*[!=]==?\s*\w+\.(?:ino|dev)\b/);
  });
}

test("the owner roster cannot silently omit a new identity consumer", () => {
  const known = new Set([...identityCallers, "src/lib/file-identity.ts"]);
  for (const path of new Bun.Glob("src/**/*.{ts,mjs}").scanSync({ cwd: repoPath(), onlyFiles: true })) {
    const source = readFileSync(repoPath(path), "utf8");
    if (/\.ino\b/.test(maskNonCode(source)) || /from ["'][^"']*\/file-identity["']/.test(source)) {
      expect(known.has(path.replaceAll("\\", "/")), path).toBe(true);
    }
  }
});

// These formerly numeric owners must obtain identity through a bigint observation or the
// shared stat wrappers. Other owners also have type/size-only stats, covered by their tests.
const migratedOwners = [
  "src/config/atomic-write.ts", "src/client/link-tunnel.ts", "src/usage/user-cost-overlay-reconciler.ts",
  "src/lab/artifacts/secure-fs.ts", "src/lab/public/file-safety.ts", "src/lab/public/community.ts",
  "src/lab/public/private-file.ts", "src/lab/public/mutation-lock.ts", "src/lab/fabric/scratch.ts",
  "src/lib/bun-runtime-preflight.ts", "src/messaging/remote-files.ts",
  "src/remote-control/workspace-executor.ts", "src/remote-control/workspace-command-runner.ts",
  "src/codex/main-account.ts", "src/codex/shim.ts", "src/codex/shim-fingerprint.ts",
  "src/codex/shim-overlay.ts", "src/codex/shim-migration.ts", "src/codex/shim-restore-lock.ts",
  "src/codex/coordinator-doctor.ts", "src/codex/history-provider.ts", "src/codex/context-compat.ts",
  "src/codex/native-main-lock-file.ts", "src/codex/native-residue.ts", "src/codex/cli-install-provenance.ts",
  "src/codex/features.ts", "src/codex/transition-state.ts", "src/codex/orca-auth-source.ts",
  "src/codex/inject/bounded-config-reader.ts", "src/adapters/codebuddy/mcp-server.ts",
  "src/service/ownership-mutation-lease.mjs", "src/update/pnpm-read-policy.mjs",
];

test("migrated owners never restore numeric filesystem observations", () => {
  for (const path of migratedOwners) {
    const source = readFileSync(repoPath(path), "utf8"), code = maskNonCode(source);
    for (const match of code.matchAll(/(?<![\w.])(?:lstatSync|fstatSync|statSync|handle\.stat)\s*\(/g)) {
      const close = matching(code, match.index! + match[0].length - 1, "(", ")");
      const options = lastArgument(code.slice(match.index! + match[0].length, close));
      expect(/^\{\s*bigint\s*:\s*true\s*\}$/.test(options), `${path}: ${source.slice(match.index!, close+1)}`).toBe(true);
    }
  }
});
