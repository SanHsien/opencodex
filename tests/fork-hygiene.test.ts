import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { checkDocument, iterDocuments } from "../tools/check-links";
import {
  loadBaseline,
  renderIssueSection,
  renderMarkdown,
  UpstreamCheckError,
  upstreamSlug,
} from "../tools/check-upstream-updates";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const NEWLINE = String.fromCharCode(10);
const OFFICIAL_REPO_GUARD = "github.repository == 'lidge-jun/opencodex'";
const FORK_OWNED_WORKFLOWS = new Set([
  "fork-maintenance.yml",
  "upstream-check.yml",
  "codeql.yml",
]);
const KEEP_RUNNING_UPSTREAM_WORKFLOWS = new Set([
  "ci.yml",
  "react-doctor.yml",
  "issue-quality-tests.yml",
]);

describe("fork maintainer files", () => {
  test("required overlay files exist", () => {
    const required = [
      "FORK.md",
      "NOTICE.md",
      "CLAUDE.md",
      "SKILL.md",
      "REVIEW.md",
      "SECURITY.md",
      "AGENTS.md",
      "README.md",
      "LICENSE",
      "docs/fork/UPSTREAM.md",
      "docs/fork/DECISIONS.md",
      "docs/fork/DEVELOPMENT.md",
      "tools/dev_check.ps1",
      "tools/check-upstream-updates.ts",
      "tools/check-links.ts",
      "tools/upstream_baseline.json",
    ];
    const missing = required.filter((rel) => !existsSync(join(ROOT, rel)));
    expect(missing).toEqual([]);
  });

  test("README is Traditional Chinese; English lives in README.en.md", async () => {
    const agents = await Bun.file(join(ROOT, "AGENTS.md")).text();
    const fork = await Bun.file(join(ROOT, "FORK.md")).text();
    const readme = await Bun.file(join(ROOT, "README.md")).text();
    const readmeEn = await Bun.file(join(ROOT, "README.en.md")).text();

    expect(agents).toContain("SanHsien 維護型 fork overlay");
    expect(fork).toContain("繁體中文產品說明");
    expect(fork).toContain("gh pr create --repo SanHsien/opencodex");
    expect(fork).toContain("唯一例外");
    expect(readme).toContain("ChatGPT 帳號池");
    expect(readmeEn).toContain("ChatGPT account pool");
    expect(existsSync(join(ROOT, "README.en.md"))).toBe(true);
    expect(existsSync(join(ROOT, "README.zh-Hant.md"))).toBe(false);
  });

  test("gitignore covers generated reports", async () => {
    const gitignore = await Bun.file(join(ROOT, ".gitignore")).text();
    expect(gitignore).toContain("upstream-review-report.md");
  });
});

describe("upstream workflow isolation", () => {
  test("non-fork workflows that must not run here have the official-repo guard", async () => {
    const workflows = join(ROOT, ".github", "workflows");
    const glob = new Bun.Glob("*.yml");
    let scanned = 0;
    for await (const name of glob.scan({ cwd: workflows })) {
      if (FORK_OWNED_WORKFLOWS.has(name) || KEEP_RUNNING_UPSTREAM_WORKFLOWS.has(name)) {
        continue;
      }
      scanned += 1;
      const text = await Bun.file(join(workflows, name)).text();
      expect(text.includes(OFFICIAL_REPO_GUARD)).toBe(true);
    }
    expect(scanned).toBeGreaterThanOrEqual(8);
  });

  test("product CI and fork-owned workflows stay enabled on this fork", async () => {
    const ci = await Bun.file(join(ROOT, ".github/workflows/ci.yml")).text();
    expect(ci).not.toContain(OFFICIAL_REPO_GUARD);

    for (const name of FORK_OWNED_WORKFLOWS) {
      const text = await Bun.file(join(ROOT, ".github/workflows", name)).text();
      expect(text.includes(OFFICIAL_REPO_GUARD)).toBe(false);
    }
  });
});

describe("fork markdown links", () => {
  test("check-links scans overlay docs and not README", () => {
    const rels = iterDocuments().map((path) =>
      relative(ROOT, path).replaceAll("\\", "/"),
    );
    expect(rels).toContain("FORK.md");
    expect(rels).toContain("docs/fork/UPSTREAM.md");
    expect(rels).not.toContain("README.md");
  });

  test("check-links rejects a path outside the repo", () => {
    const dir = mkdtempSync(join(tmpdir(), "opencodex-fork-links-"));
    const doc = join(dir, "note.md");
    writeFileSync(doc, "[here](.)\n", "utf8");
    const problems = checkDocument(doc);
    expect(problems.some((item) => item.includes("逃出"))).toBe(true);
  });

  test("maintainer markdown links resolve", () => {
    const failures: string[] = [];
    for (const path of iterDocuments()) {
      for (const problem of checkDocument(path)) {
        failures.push(`${path}: ${problem}`);
      }
    }
    expect(failures).toEqual([]);
  });
});

describe("upstream checker", () => {
  test("baseline file is valid and complete", () => {
    const baseline = loadBaseline();
    expect(baseline.repo.endsWith("opencodex.git")).toBe(true);
    expect(baseline.branch).toBe("main");
    expect(baseline.reviewed_through).toHaveLength(40);
    expect(baseline.reviewed_date).toBe("2026-08-22");
  });

  test("workflow is scheduled and fails on unreviewed commits", async () => {
    const workflow = await Bun.file(
      join(ROOT, ".github/workflows/upstream-check.yml"),
    ).text();
    expect(workflow).toContain("schedule:");
    expect(workflow).toContain("cron:");
    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).toContain("tools/check-upstream-updates.ts");
    expect(workflow).toContain("fetch-depth: 0");
    expect(workflow).toContain("exit 1");
  });

  test("renderMarkdown reports no new commits", () => {
    const baseline = {
      repo: "https://example.invalid/upstream.git",
      branch: "main",
      reviewed_through: "a".repeat(40),
      reviewed_date: "2026-08-22",
    };
    const report = renderMarkdown(baseline, []);
    expect(report).toContain("No new upstream commits");
  });

  test("renderMarkdown surfaces check failure", () => {
    const baseline = {
      repo: "https://example.invalid/upstream.git",
      branch: "main",
      reviewed_through: "a".repeat(40),
      reviewed_date: "2026-08-22",
    };
    const report = renderMarkdown(baseline, [], "git fetch failed");
    expect(report).toContain("Check failed");
    expect(report).toContain("git fetch failed");
  });

  test("loadBaseline rejects a missing file", () => {
    expect(() => loadBaseline(join(ROOT, "tools", "nope.json"))).toThrow(
      UpstreamCheckError,
    );
  });

  test("issue triage watermark is recorded", () => {
    // Without it every weekly run re-asks about the same upstream issues, and a
    // check that asks a question already answered stops being read.
    const baseline = loadBaseline();
    expect(typeof baseline.reviewed_issue_through).toBe("number");
    expect(baseline.reviewed_issue_through!).toBeGreaterThan(0);
  });

  test("upstreamSlug reads owner/name from the clone URL", () => {
    expect(upstreamSlug("https://github.com/lidge-jun/opencodex.git")).toBe("lidge-jun/opencodex");
    expect(upstreamSlug("git@github.com:lidge-jun/opencodex")).toBe("lidge-jun/opencodex");
    expect(upstreamSlug("https://example.invalid/thing.git")).toBeUndefined();
  });

  test("an unavailable gh reads as 'not checked', never as 'nothing to review'", () => {
    const baseline = loadBaseline();
    const unchecked = renderIssueSection(baseline, undefined).join(NEWLINE);
    const empty = renderIssueSection(baseline, []).join(NEWLINE);
    expect(unchecked).toContain("Not checked");
    expect(unchecked).not.toContain("No new");
    expect(empty).toContain("No new");
  });

  test("only issues above the watermark are listed, with the number to bump", () => {
    const baseline = loadBaseline();
    const section = renderIssueSection(baseline, [
      { number: 9001, title: "[Bug][Windows]: something | with a pipe", labels: ["bug", "platform"] },
    ]).join(NEWLINE);
    expect(section).toContain(`Triaged through \`#${baseline.reviewed_issue_through}\``);
    expect(section).toContain("#9001");
    expect(section).toContain("with a pipe");
    expect(section).toContain("reviewed_issue_through");
  });

  test("baseline matches the decisions record", async () => {
    const decisions = await Bun.file(join(ROOT, "docs/fork/DECISIONS.md")).text();
    const upstream = await Bun.file(join(ROOT, "docs/fork/UPSTREAM.md")).text();
    const baseline = loadBaseline();
    expect(decisions).toContain(baseline.reviewed_date);
    expect(upstream).toContain(baseline.reviewed_through);
  });
});
