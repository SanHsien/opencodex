#!/usr/bin/env bun
/** Report upstream commits that have not yet been reviewed by this fork. */

import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const REPO_ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
export const BASELINE_PATH = resolve(REPO_ROOT, "tools", "upstream_baseline.json");
const UPSTREAM_REF_PREFIX = "refs/upstream-check";
const REQUIRED_FIELDS = ["repo", "branch", "reviewed_through", "reviewed_date"] as const;
const FULL_SHA_LENGTH = 40;
const UNIT_SEPARATOR = "\u001f";

export class UpstreamCheckError extends Error {}

export type Baseline = {
  repo: string;
  branch: string;
  reviewed_through: string;
  reviewed_date: string;
};

export type Commit = {
  sha: string;
  short: string;
  date: string;
  subject: string;
  files: string[];
};

export function loadBaseline(path = BASELINE_PATH): Baseline {
  if (!existsSync(path)) {
    throw new UpstreamCheckError(`missing baseline file: ${path}`);
  }
  let baseline: Baseline;
  try {
    baseline = JSON.parse(readFileSync(path, "utf8")) as Baseline;
  } catch (error) {
    throw new UpstreamCheckError(`invalid baseline file: ${path}: ${String(error)}`);
  }
  const missing = REQUIRED_FIELDS.filter((field) => !baseline[field]);
  if (missing.length > 0) {
    throw new UpstreamCheckError(`baseline missing fields: ${missing.join(", ")}`);
  }
  if (String(baseline.reviewed_through).length !== FULL_SHA_LENGTH) {
    throw new UpstreamCheckError("reviewed_through must be a full 40-character SHA");
  }
  return baseline;
}

export function runGit(args: string[], cwd: string): string {
  const result = Bun.spawnSync(["git", ...args], {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  });
  if (result.exitCode !== 0) {
    const stderr = new TextDecoder().decode(result.stderr).trim();
    throw new UpstreamCheckError(`git ${args.join(" ")} failed: ${stderr}`);
  }
  return new TextDecoder().decode(result.stdout);
}

export function fetchUpstream(baseline: Baseline, repoDir: string): string {
  const ref = `${UPSTREAM_REF_PREFIX}/${baseline.branch}`;
  runGit(
    ["fetch", "--quiet", baseline.repo, `+refs/heads/${baseline.branch}:${ref}`],
    repoDir,
  );
  return ref;
}

export function collectNewCommits(
  baseline: Baseline,
  repoDir: string,
  ref: string,
): Commit[] {
  const raw = runGit(
    [
      "log",
      "--reverse",
      "--date=short",
      `--format=%H${UNIT_SEPARATOR}%ad${UNIT_SEPARATOR}%s`,
      `${baseline.reviewed_through}..${ref}`,
    ],
    repoDir,
  );
  const commits: Commit[] = [];
  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    const parts = line.split(UNIT_SEPARATOR);
    if (parts.length < 3) {
      throw new UpstreamCheckError(`unexpected git log line: ${JSON.stringify(line)}`);
    }
    const [sha, date, subject] = parts;
    const files = runGit(["show", "--name-only", "--format=", sha], repoDir)
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean);
    commits.push({
      sha,
      short: sha.slice(0, 7),
      date,
      subject,
      files,
    });
  }
  return commits;
}

export function renderMarkdown(
  baseline: Baseline,
  commits: Commit[],
  error?: string,
): string {
  const lines = [
    "# Upstream review report",
    "",
    `- Upstream: \`${baseline.repo}\` (\`${baseline.branch}\`)`,
    `- Reviewed through: \`${baseline.reviewed_through.slice(0, 7)}\``,
    `- Last review date: ${baseline.reviewed_date}`,
    "",
  ];
  if (error) {
    lines.push("## Check failed", "", "```text", error, "```", "");
    return `${lines.join("\n")}\n`;
  }
  if (commits.length === 0) {
    lines.push("## Result", "", "No new upstream commits. Nothing to review.", "");
    return `${lines.join("\n")}\n`;
  }
  lines.push(
    "## Result",
    "",
    `${commits.length} upstream commit(s) require review.`,
    "",
    "| Commit | Date | Subject | Files |",
    "| --- | --- | --- | --- |",
  );
  for (const commit of commits) {
    const subject = commit.subject.replaceAll("|", "\\|");
    let files = commit.files
      .slice(0, 8)
      .map((item) => item.replaceAll("|", "\\|"))
      .join("<br>");
    if (commit.files.length > 8) {
      files += `<br>… +${commit.files.length - 8} more`;
    }
    lines.push(
      `| \`${commit.short}\` | ${commit.date} | ${subject} | ${files || "(none)"} |`,
    );
  }
  lines.push(
    "",
    "Review each commit, record adopt/skip decisions in `docs/fork/DECISIONS.md`, ",
    "then advance `tools/upstream_baseline.json` only after verification.",
    "",
  );
  return `${lines.join("\n")}\n`;
}

function parseArgs(args: string[]) {
  const options = {
    output: "upstream-review-report.md",
    repoDir: REPO_ROOT,
    githubOutput: false,
    strict: false,
  };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--strict") options.strict = true;
    else if (arg === "--github-output") options.githubOutput = true;
    else if (arg === "--output" && args[index + 1]) {
      options.output = args[index + 1] ?? options.output;
      index += 1;
    } else if (arg === "--repo-dir" && args[index + 1]) {
      options.repoDir = args[index + 1] ?? options.repoDir;
      index += 1;
    }
  }
  return options;
}

export function main(args = Bun.argv.slice(2)): number {
  const options = parseArgs(args);
  let baseline: Baseline = {
    repo: "unknown",
    branch: "unknown",
    reviewed_through: "0".repeat(FULL_SHA_LENGTH),
    reviewed_date: "unknown",
  };
  let commits: Commit[] = [];
  let error: string | undefined;

  try {
    baseline = loadBaseline();
    const ref = fetchUpstream(baseline, options.repoDir);
    commits = collectNewCommits(baseline, options.repoDir, ref);
  } catch (caught) {
    if (!(caught instanceof UpstreamCheckError)) throw caught;
    error = caught.message;
  }

  const report = renderMarkdown(baseline, commits, error);
  writeFileSync(options.output, report, "utf8");
  process.stdout.write(report);

  if (options.githubOutput && process.env.GITHUB_OUTPUT) {
    appendFileSync(
      process.env.GITHUB_OUTPUT,
      [
        `needs_attention=${commits.length > 0 || Boolean(error) ? "true" : "false"}`,
        `check_failed=${error ? "true" : "false"}`,
        `report_path=${options.output}`,
        "",
      ].join("\n"),
    );
  }

  if (error) return 2;
  if (options.strict && commits.length > 0) return 1;
  return 0;
}

if (import.meta.main) {
  process.exit(main());
}
