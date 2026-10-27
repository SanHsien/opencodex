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


// 3. Windows-only at file level (docs/fork/DECISIONS.md, 2026-10-28). Everything below existed only
//    for macOS or Linux and was deleted from this fork. An upstream sync must not bring it back:
//    the sync replays the deletion list first, and this guard fails the build if a path, a CI job,
//    or a non-Windows runner label returns. In-file POSIX/darwin branches of shared modules are
//    deliberately NOT guarded; only whole files, jobs and runner labels are.

/** Directories removed whole. A directory counts as back when any file exists under it. */
export const REMOVED_DIRECTORIES = [
  "app", // macOS WidgetKit / MenuBarCore / NativeTray (Swift)
  "docker", // container bootstrap helpers
];

/** Files removed whole (macOS/Linux scripts, packaging, tests that only ran there). */
export const REMOVED_FILES = [
  ".dockerignore",
  "Dockerfile",
  "compose.yaml",
  "desktop/scripts/appimage-patchelf.py",
  "desktop/scripts/build-widget.sh",
  "desktop/scripts/linux-packaged-e2e.ts",
  "desktop/scripts/verify-linux-sidecar.sh",
  "desktop/scripts/verify-macos-runtime.sh",
  "docs-site/src/content/docs/guides/macos-menu-bar.md",
  "docs-site/src/content/docs/zh-tw/guides/macos-menu-bar.md",
  "scripts/OCX-RUN.md",
  "scripts/bun-gc-relief-eval.ts",
  "scripts/ci/docker-smoke.ts",
  "scripts/ci/sample-macos-stall.sh",
  "scripts/ci/select-test-lane.sh",
  "scripts/darwin-eager-abort-stress-child.ts",
  "scripts/darwin-eager-abort-stress.ts",
  "scripts/install.sh",
  "scripts/macos-rss-retention-harness-child.ts",
  "scripts/macos-rss-retention-harness.ts",
  "scripts/macos-rss-retention-sampler.ts",
  "scripts/macos-rss-retention-single-reader-child.ts",
  "scripts/ocx-restart.sh",
  "scripts/ocx-run",
  "structure/decisions/ADR-0081-container-deployment-recipe.md",
  "structure/decisions/ADR-5493-linux-packaged-shell-acceptance.md",
  "tests/ci-workflows/assert-mergeable-review.test.ts",
  "tests/ci-workflows/ci-crash-disposition.test.ts",
  "tests/ci-workflows/ci-scope-reduction.test.ts",
  "tests/ci-workflows/ci-test-lane.test.ts",
  "tests/ci-workflows/linux-desktop-packaged-ci.test.ts",
  "tests/ci-workflows/linux-desktop-packaged-e2e.test.ts",
  "tests/ci-workflows/macos-serial-lanes.test.ts",
  "tests/ci-workflows/test-runner-spawnsync-finalizer.test.ts",
  "tests/ci-workflows/zz-ci-api-usage-isolation.test.ts",
  "tests/ci-workflows/zz-ci-storage-policy-isolation.test.ts",
  "tests/cli/cli-client-start-owner-e2e.test.ts",
  "tests/cli/ocx-launcher-fixture-trust.test.ts",
  "tests/clients/desktop-widget-entry.test.ts",
  "tests/clients/link-ssh-argv-discovery.test.ts",
  "tests/clients/remote-workspace-linux-confinement.test.ts",
  "tests/codex-integration/codex-shim-ensure-failure.test.ts",
  "tests/codex-integration/codex-shim-migration.test.ts",
  "tests/codex-integration/codex-shim-overlay-candidates.test.ts",
  "tests/codex-integration/codex-shim-overlay-readiness.test.ts",
  "tests/codex-integration/codex-shim-overlay-transaction.test.ts",
  "tests/codex-integration/codex-shim-overlay.test.ts",
  "tests/codex-integration/messaging-local-send.test.ts",
  "tests/codex-integration/messaging-remote-enrollment-gaps.test.ts",
  "tests/codex-integration/messaging-remote-gaps.test.ts",
  "tests/codex-integration/messaging-remote-interop.test.ts",
  "tests/codex-integration/messaging-remote-native.test.ts",
  "tests/codex-integration/messaging-remote-replies.test.ts",
  "tests/codex-integration/messaging-remote-scratch.test.ts",
  "tests/codex-integration/messaging-remote-send.test.ts",
  "tests/fixtures/macos-stall-observer.sh",
  "tests/fixtures/spawnsync-finalizer-drift-child.ts",
  "tests/service/container-bootstrap.test.ts",
  "tests/service/service-desktop-startup-linux.test.ts",
];

/** Jobs removed from workflows that stay. A returning job of the same name is a regression. */
export const REMOVED_CI_JOBS: Record<string, string[]> = {
  "ci.yml": [
    "test", "storage-policy", "api-usage", "platform-macos", "macos-control", "docker-smoke",
    "npm-global-smoke", "widget", "desktop-shell",
  ],
  "service-lifecycle.yml": ["linux-systemd", "macos-launchd"],
  "desktop-installed-gate.yml": ["macos", "linux"],
};

/**
 * Runner labels this fork never uses. release.yml is the one exception: it is the upstream-only
 * publication pipeline (every job is guarded to lidge-jun/opencodex), kept byte-identical to
 * upstream so syncs replay cleanly. See docs/fork/UPSTREAM.md.
 */
export const NON_WINDOWS_RUNNER_LABEL = /\b(?:macos-[\w.]+|opencodex-gate-(?:macos|linux))\b/i;
export const NON_WINDOWS_RUNNER_EXEMPT_WORKFLOWS = new Set(["release.yml"]);

export function findRemovedPaths(
  exists: (path: string) => boolean,
  listDirectory: (path: string) => string[] = () => [],
): string[] {
  const problems: string[] = [];
  for (const file of REMOVED_FILES) {
    if (exists(file)) problems.push(`${file}: removed macOS/Linux-only file is back`);
  }
  for (const directory of REMOVED_DIRECTORIES) {
    if (!exists(directory)) continue;
    const files = listDirectory(directory);
    problems.push(`${directory}/: removed macOS/Linux-only directory is back${files.length ? ` (${files.slice(0, 3).join(", ")}${files.length > 3 ? ", ..." : ""})` : ""}`);
  }
  return problems;
}

/** `jobsOf` returns the job ids of a workflow file, or undefined when the file does not exist. */
export function findRemovedCiJobs(jobsOf: (workflow: string) => string[] | undefined): string[] {
  const problems: string[] = [];
  for (const [workflow, removed] of Object.entries(REMOVED_CI_JOBS)) {
    const jobs = jobsOf(workflow);
    if (!jobs) continue;
    for (const job of removed) {
      if (jobs.includes(job)) problems.push(`.github/workflows/${workflow}: removed macOS/Linux-only job \`${job}\` is back`);
    }
  }
  return problems;
}

/** `workflows` maps a workflow file name to its text. Comment lines are ignored. */
export function findNonWindowsRunners(workflows: Map<string, string>): string[] {
  const problems: string[] = [];
  for (const [name, text] of workflows) {
    if (NON_WINDOWS_RUNNER_EXEMPT_WORKFLOWS.has(name)) continue;
    text.split("\n").forEach((line, index) => {
      if (line.trimStart().startsWith("#")) return;
      const match = line.match(NON_WINDOWS_RUNNER_LABEL);
      if (match) problems.push(`.github/workflows/${name}:${index + 1}: non-Windows runner label \`${match[0]}\``);
    });
  }
  return problems;
}
