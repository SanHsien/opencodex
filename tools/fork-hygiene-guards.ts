// Fork hygiene guards shared by tests/ci-workflows/fork-hygiene.test.ts (run by tools/dev_check.ps1).
//
// 1. Hangul: the fork ships English and Traditional Chinese only. Korean text in product code
//    (CLI output, errors, GUI strings, comments) is a regression. The only Hangul allowed is on
//    the exact lines below, kept because they MATCH Korean text produced by users or models.
//    Adding a line here needs a reason that is not "it is easier". Rule documented in FORK.md.
// 2. Update paths: nothing that checks, links, downloads or announces a new version may point at
//    upstream (`lidge-jun/opencodex`); the fork updates from SanHsien/opencodex releases only.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

export const HANGUL = /[\u1100-\u11FF\u3130-\u318F\uAC00-\uD7AF\uA960-\uA97F\uD7B0-\uD7FF]/;

export interface HangulAllowance {
  file: string;
  reason: string;
  /** Exact trimmed line text. A changed line must be re-reviewed, so no wildcards. */
  lines: string[];
}

export const HANGUL_ALLOWLIST: HangulAllowance[] = [
  {
    file: "src/adapters/cursor/tool-guidance.ts",
    reason: "Matches Korean text in USER prompts (tool-count demo requests) and lists Korean words the model must not emit; not UI copy.",
    lines: [
      "/아무\\s*(?:tool|tools?|도구|툴)/i,",
      "/(?:tool|tools?|도구|툴)\\s*\\d+\\s*(?:개|번)?/i,",
      "/\\d+\\s*(?:개|번)?\\s*(?:tool|tools?|도구|툴)/i,",
      "/(?:도구|툴).{0,12}(?:써|사용|호출).{0,12}\\d+\\s*(?:개|번)?/i,",
      "/(?:tool|tools?|도구|툴)\\s*(\\d+)\\s*(?:개|번)?/i,",
      "/(\\d+)\\s*(?:개|번)?\\s*(?:tool|tools?|도구|툴)/i,",
      "/(?:도구|툴).{0,12}(?:써|사용|호출).{0,12}(\\d+)\\s*(?:개|번)?/i,",
      "&& !/(?:리소스|플러그인|깃허브|github)/i.test(trimmed);",
      "? \"Tool-selection commentary is forbidden: for any shell, read, grep, list, or file operation, your FIRST visible action is the bridge call itself — never a sentence about which tool you will use, which tool was redirected, or switching surfaces. Words like 차단/전환/blocked/switching must not appear in your output for tool-routing reasons.\"",
    ],
  },
  {
    file: "src/adapters/cursor/envelope-echo.ts",
    reason: "Detects Korean model output narrating a native-tool redirect; the match must stay Korean.",
    lines: [
      "const ROUTING_NATIVE_TOOL_NAME = /\\b(shell|read|grep|list|bash)\\b|(?<![\\p{L}\\p{M}\\p{N}_])네이티브\\s*(?:셸|쉘)/giu;",
      "/(?:\\b(?:shell|read|grep|list|bash)\\b|exec_command|shell_command|브리지|네이티브\\s*(?:셸|쉘))/iu;",
      "/(?:blocked|unavailable|interrupted|차단|중단|막혀)/iu;",
      "/(?:exec_command|shell_command|\\bexec\\b|브리지|redirected|fallback|switch(?:ed|ing)?|전환|우회|통과(?:되|하)|다른\\s*(?:도구|경로)|경로로)/iu;",
    ],
  },
  {
    file: "gui/src/components/codex-set/prompt-lint.ts",
    reason: "Lint rule that detects Korean 'you are Claude/Grok/...' identity text pasted into prompt layers.",
    lines: [
      "pattern: /(?:(?:당신은|너는)\\s*(?:claude|grok|gemini|chatgpt|gpt)\\b)|(?:(?:당신은|너는)\\s*(?:클로드|그록|제미나이|챗gpt))/gi,",
    ],
  },
  {
    file: "scripts/structure-ssot.ts",
    reason: "Matches the Korean decision-log label that structure/decisions/ADR files (upstream) still carry.",
    lines: [
      "if (/\\[decision log\\]/i.test(line) || /^-\\s*(?:목적과 의도|Purpose and intent)\\s*:/.test(line.trim())) {",
    ],
  },
];

/** Roots whose text must stay Hangul-free (outside the allowlist). */
export const HANGUL_ROOTS = ["src", "gui/src", "scripts", "desktop", "bin"];
const SKIP_DIRS = new Set(["node_modules", "target", "gen", "dist", ".git"]);
const SKIP_EXT = /\.(png|jpe?g|gif|ico|icns|woff2?|ttf|otf|lock|zip|gz|wasm|node|exe|dll)$/i;

export function listTextFiles(root: string, roots: string[]): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      if (SKIP_DIRS.has(name)) continue;
      const full = join(dir, name);
      const st = statSync(full);
      if (st.isDirectory()) walk(full);
      else if (st.isFile() && !SKIP_EXT.test(name)) out.push(relative(root, full).split("\\").join("/"));
    }
  };
  for (const r of roots) if (existsSync(join(root, r))) walk(join(root, r));
  return out;
}

/** `read` returns the file text, or undefined for binary / unreadable files. */
export function findHangulViolations(
  files: string[],
  read: (file: string) => string | undefined,
  allowlist: HangulAllowance[] = HANGUL_ALLOWLIST,
): string[] {
  const problems: string[] = [];
  const allowed = new Map(allowlist.map(entry => [entry.file, new Set(entry.lines)]));
  const seen = new Map<string, Set<string>>();
  for (const file of files) {
    const text = read(file);
    if (text === undefined) continue;
    text.split("\n").forEach((line, index) => {
      if (!HANGUL.test(line)) return;
      const trimmed = line.trim();
      if (allowed.get(file)?.has(trimmed)) {
        if (!seen.has(file)) seen.set(file, new Set());
        seen.get(file)!.add(trimmed);
        return;
      }
      problems.push(`${file}:${index + 1}: Hangul outside the allowlist: ${trimmed.slice(0, 80)}`);
    });
  }
  for (const entry of allowlist) {
    if (!files.includes(entry.file)) continue;
    for (const line of entry.lines) {
      if (!seen.get(entry.file)?.has(line)) problems.push(`${entry.file}: stale allowlist line (no longer present): ${line.slice(0, 80)}`);
    }
  }
  return problems;
}

export function readTextOrUndefined(root: string, file: string): string | undefined {
  const buf = readFileSync(join(root, file));
  if (buf.includes(0)) return undefined;
  return buf.toString("utf8").replace(/\r\n/g, "\n");
}

/** Runtime update surfaces: any upstream repo reference here is a way to fetch an upstream build. */
export const UPDATE_PATH_ROOTS = ["src/update", "bin", "desktop/ui", "desktop/src-tauri/src", "desktop/src-tauri/tauri.conf.json"];
export const UPSTREAM_REPO = /lidge-jun\/opencodex/i;
/** Anywhere in product code: an upstream release/latest link or API call. */
export const UPSTREAM_RELEASE_REF = /lidge-jun\/opencodex\/releases|api\.github\.com\/repos\/lidge-jun/i;

export function findUpstreamUpdateRefs(files: string[], read: (file: string) => string | undefined, pattern: RegExp): string[] {
  const problems: string[] = [];
  for (const file of files) {
    const text = read(file);
    if (text === undefined) continue;
    text.split("\n").forEach((line, index) => {
      if (pattern.test(line)) problems.push(`${file}:${index + 1}: upstream update reference: ${line.trim().slice(0, 100)}`);
    });
  }
  return problems;
}
