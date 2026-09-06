#!/usr/bin/env bun
/** Report upstream commits that have not yet been reviewed by this fork. */

import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const REPO_ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
export const BASELINE_PATH = resolve(REPO_ROOT, "tools", "upstream_baseline.json");
const UPSTREAM_REF_PREFIX = "refs/upstream-check";
const REQUIRED_FIELDS = ["repo", "branch", "reviewed_through", "reviewed_date"] as const;
/**
 * Upstream tickets the fork tracks.
 *
 * Not all of them: upstream runs ~40 open pull requests and ~55 open issues at
 * any moment, all of it arriving here through releases on `main` anyway (see
 * `docs/fork/DECISIONS.md`). Reporting that stream weekly would be a check that
 * cries wolf, and one that cries wolf gets ignored.
 *
 * `platform` is the label whose issues change what this fork has to verify on
 * Windows, so it is the one worth a standing question.
 */
const TRACKED_ISSUE_LABEL = "platform";
const FULL_SHA_LENGTH = 40;
const UNIT_SEPARATOR = "\u001f";

export class UpstreamCheckError extends Error {}

export type Baseline = {
  repo: string;
  branch: string;
  reviewed_through: string;
  reviewed_date: string;
  /** Highest upstream issue number already triaged; only higher ones are reported. */
  reviewed_issue_through?: number;
  /** Highest upstream pull request number already triaged; only higher ones are reported. */
  reviewed_pr_through?: number;
};

export type Ticket = {
  number: number;
  title: string;
  labels: string[];
};

export type Commit = {
  sha: string;
  short: string;
  date: string;
  subject: string;
  files: string[];
};

function escapeMarkdownTableCell(value: string): string {
  return value
    .replace(/[\r\n\u2028\u2029]+/g, " ")
    .replaceAll("\\", "\\\\")
    .replaceAll("|", "\\|");
}

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

/** Owner/name from the upstream clone URL, for `gh --repo`. */
export function upstreamSlug(repoUrl: string): string | undefined {
  const match = /github\.com[:/](?<owner>[^/]+)\/(?<name>[^/]+?)(?:\.git)?$/.exec(repoUrl);
  const { owner, name } = match?.groups ?? {};
  return owner && name ? `${owner}/${name}` : undefined;
}

/**
 * Open upstream issues above the watermark that carry the tracked label.
 *
 * Returns `undefined` — not an empty list — when `gh` cannot answer, so a
 * missing CLI or an unauthenticated shell reads as "not checked" in the report
 * instead of the much worse "nothing to review".
 */
export function collectNewIssues(baseline: Baseline): Ticket[] | undefined {
  const slug = upstreamSlug(baseline.repo);
  if (!slug) return undefined;
  const result = Bun.spawnSync(
    ["gh", "issue", "list", "--repo", slug, "--state", "open", "--label", TRACKED_ISSUE_LABEL,
     "--limit", "100", "--json", "number,title,labels"],
    { stdout: "pipe", stderr: "pipe" },
  );
  if (result.exitCode !== 0) return undefined;
  let parsed: { number: number; title: string; labels?: { name: string }[] }[];
  try {
    parsed = JSON.parse(new TextDecoder().decode(result.stdout));
  } catch {
    return undefined;
  }
  const watermark = Number(baseline.reviewed_issue_through ?? 0);
  return parsed
    .filter((item) => item.number > watermark)
    .sort((left, right) => left.number - right.number)
    .map((item) => ({
      number: item.number,
      title: item.title,
      labels: (item.labels ?? []).map((label) => label.name),
    }));
}

/**
 * Upstream pull requests that were closed **without merging**, above the watermark.
 *
 * The fork's reason for not tracking pull requests at all was that upstream's
 * work arrives here through releases on `main` anyway. That holds for merged
 * pull requests and only for those: one closed without merging never becomes a
 * commit, so it never arrives, and `reviewed_pr_through` sat in the baseline
 * with nothing reading it while that whole class went unwatched.
 *
 * Narrowing to unmerged keeps the check from crying wolf for the same reason
 * `TRACKED_ISSUE_LABEL` does: upstream closes far fewer pull requests unmerged
 * than it merges, and those are the ones a person here still has to judge.
 */
export function collectUnmergedPullRequests(baseline: Baseline): Ticket[] | undefined {
  const slug = upstreamSlug(baseline.repo);
  if (!slug) return undefined;
  const result = Bun.spawnSync(
    ["gh", "pr", "list", "--repo", slug, "--state", "closed",
     "--limit", "200", "--json", "number,title,mergedAt,labels"],
    { stdout: "pipe", stderr: "pipe" },
  );
  if (result.exitCode !== 0) return undefined;
  let parsed: {
    number: number;
    title: string;
    mergedAt?: string | null;
    labels?: { name: string }[];
  }[];
  try {
    parsed = JSON.parse(new TextDecoder().decode(result.stdout));
  } catch {
    return undefined;
  }
  const watermark = Number(baseline.reviewed_pr_through ?? 0);
  return parsed
    .filter((item) => item.number > watermark && !item.mergedAt)
    .sort((left, right) => left.number - right.number)
    .map((item) => ({
      number: item.number,
      title: item.title,
      labels: (item.labels ?? []).map((label) => label.name),
    }));
}

/** The pull request section: the closed-unmerged ones, or why they were not asked for. */
export function renderPullRequestSection(
  baseline: Baseline,
  pullRequests: Ticket[] | undefined,
): string[] {
  const watermark = baseline.reviewed_pr_through ?? 0;
  const lines = [
    "## Upstream pull requests closed without merging",
    "",
    `Triaged through \`#${watermark}\`.`,
    "",
  ];
  if (pullRequests === undefined) {
    lines.push(
      "Not checked: `gh` was unavailable or unauthenticated. This is reported rather than",
      "treated as \"nothing to review\" — the difference matters.",
      "",
    );
    return lines;
  }
  if (pullRequests.length === 0) {
    lines.push("None since that number. Merged pull requests arrive with releases.", "");
    return lines;
  }
  lines.push(
    `${pullRequests.length} pull request(s) upstream declined, still to triage here.`,
    "",
    "| PR | Labels | Title |",
    "| --- | --- | --- |",
  );
  for (const pullRequest of pullRequests) {
    lines.push(
      `| #${pullRequest.number} | ${escapeMarkdownTableCell(pullRequest.labels.join(", "))} | ${escapeMarkdownTableCell(pullRequest.title)} |`,
    );
  }
  lines.push(
    "",
    "Record the verdict in `docs/fork/UPSTREAM.md`, then raise `reviewed_pr_through`",
    "so the same pull request is never re-triaged.",
    "",
  );
  return lines;
}

/** The issue section: what still needs a human's judgement, or why it was not asked. */
export function renderIssueSection(baseline: Baseline, issues: Ticket[] | undefined): string[] {
  const watermark = baseline.reviewed_issue_through ?? 0;
  const lines = ["## Upstream platform issues", "", `Triaged through \`#${watermark}\`.`, ""];
  if (issues === undefined) {
    lines.push(
      "Not checked: `gh` was unavailable or unauthenticated. This is reported rather than",
      "treated as \"nothing to review\" — the difference matters.",
      "",
    );
    return lines;
  }
  if (issues.length === 0) {
    lines.push("No new `platform` issues since that number.", "");
    return lines;
  }
  lines.push(
    `${issues.length} new \`platform\` issue(s) to triage.`,
    "",
    "| Issue | Labels | Title |",
    "| --- | --- | --- |",
  );
  for (const issue of issues) {
    lines.push(
      `| #${issue.number} | ${escapeMarkdownTableCell(issue.labels.join(", "))} | ${escapeMarkdownTableCell(issue.title)} |`,
    );
  }
  lines.push(
    "",
    "Record the verdict in `docs/fork/UPSTREAM.md`, then raise `reviewed_issue_through`",
    "so the same issue is never re-triaged.",
    "",
  );
  return lines;
}

export function renderMarkdown(
  baseline: Baseline,
  commits: Commit[],
  error?: string,
  issues?: Ticket[] | undefined,
  pullRequests?: Ticket[] | undefined,
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
    lines.push(...renderPullRequestSection(baseline, pullRequests));
    lines.push(...renderIssueSection(baseline, issues));
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
  lines.push(...renderPullRequestSection(baseline, pullRequests));
  lines.push(...renderIssueSection(baseline, issues));
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
  let issues: Ticket[] | undefined;
  let pullRequests: Ticket[] | undefined;
  let error: string | undefined;

  try {
    baseline = loadBaseline();
    const ref = fetchUpstream(baseline, options.repoDir);
    commits = collectNewCommits(baseline, options.repoDir, ref);
    issues = collectNewIssues(baseline);
    pullRequests = collectUnmergedPullRequests(baseline);
  } catch (caught) {
    if (!(caught instanceof UpstreamCheckError)) throw caught;
    error = caught.message;
  }

  const report = renderMarkdown(baseline, commits, error, issues, pullRequests);
  writeFileSync(options.output, report, "utf8");
  process.stdout.write(report);

  // Fail closed. A run that could not ask `gh` must not read as a clean bill of
  // health just because the commit axis was quiet: "not checked" and "nothing
  // to review" look identical in a green report, and only one of them is true.
  const ticketsUnavailable =
    !error && (issues === undefined || pullRequests === undefined);

  if (options.githubOutput && process.env.GITHUB_OUTPUT) {
    appendFileSync(
      process.env.GITHUB_OUTPUT,
      [
        `needs_attention=${commits.length > 0 || (issues?.length ?? 0) > 0 || (pullRequests?.length ?? 0) > 0 || Boolean(error) || ticketsUnavailable ? "true" : "false"}`,
        `check_failed=${error || ticketsUnavailable ? "true" : "false"}`,
        `report_path=${options.output}`,
        "",
      ].join("\n"),
    );
  }

  if (error) return 2;
  if (ticketsUnavailable) {
    process.stderr.write("ERROR: gh could not enumerate the upstream issues or pull requests.\n");
    return 2;
  }
  // A new `platform` issue upstream changes what this fork has to verify on
  // Windows, so it fails the weekly check the same way a new commit does. So
  // does a pull request upstream closed without merging: that one never becomes
  // a commit, so the release stream will never bring it here.
  // Clearing either means triaging it and raising the watermark, not muting.
  if (
    options.strict
    && (commits.length > 0 || (issues?.length ?? 0) > 0 || (pullRequests?.length ?? 0) > 0)
  ) {
    return 1;
  }
  return 0;
}

if (import.meta.main) {
  process.exit(main());
}
