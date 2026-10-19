import { expect, test } from "bun:test";
import { repoPath } from "../helpers/repo-root";

/**
 * Every contributor entry point must say that building from source needs a local `bun`, and
 * explain the bundled runtime and package-script PATH shadowing. Users who install `ocx`
 * never need their own Bun; contributors need the CLI and the separately pinned test runner.
 *
 * Each file is checked as one whole normalized paragraph rather than as scattered fragments.
 * Matching fragments independently across a whole file passes even after the explanatory
 * sentence is deleted, as long as the words survive somewhere else — that is a test that
 * cannot fail for the reason it exists. Whitespace normalization keeps a maintainer's
 * paragraph rewrap from breaking the suite over nothing.
 */
const PARAGRAPH_START = "Source development requires the `bun` CLI on your `PATH`";
const ZH_TW_PARAGRAPH_START = "從原始碼開發需要在 `PATH` 中有本機 `bun` CLI";

const CASES = [
  {
    path: "CONTRIBUTING.md",
    paragraph:
      "Source development requires the `bun` CLI on your `PATH`. The published npm package bundles its own"
      + " Bun runtime for end users. Package scripts such as `bun run test` and `bun run prepush` may resolve"
      + " Bun through that bundled dependency.",
  },
  {
    path: "README.en.md",
    paragraph:
      "Source development requires the `bun` CLI on your `PATH`. The published npm package bundles its own"
      + " Bun runtime for installed `ocx` commands; package scripts may also resolve Bun through that bundled dependency.",
  },
  {
    path: "README.md",
    paragraph:
      "從原始碼開發需要在 `PATH` 中有本機 `bun` CLI。已發佈的 npm 套件內附自己的 Bun 執行環境供已安裝的 `ocx` 指令使用；套件 scripts 也可能透過該內附相依解析 Bun。",
  },
  {
    path: "docs-site/src/content/docs/contributing.md",
    paragraph:
      "Source development requires the `bun` CLI on your `PATH`. The published npm package bundles its own"
      + " Bun runtime for users; package scripts may resolve Bun through that bundled dependency.",
  },
] as const;

/** The paragraph starting at `PARAGRAPH_START`, collapsed to single spaces. */
function normalizedRequirementParagraph(text: string, startText = PARAGRAPH_START): string | undefined {
  const start = text.indexOf(startText);
  if (start === -1) return undefined;
  const rest = text.slice(start);
  const end = rest.indexOf("\n\n");
  const paragraph = end === -1 ? rest : rest.slice(0, end);
  return paragraph.replace(/\s+/g, " ").trim();
}

test("source development docs require a local Bun CLI while preserving the bundled-runtime distinction", async () => {
  for (const entry of CASES) {
    const text = await Bun.file(repoPath(entry.path)).text();
    expect(normalizedRequirementParagraph(text, entry.path === "README.md" ? ZH_TW_PARAGRAPH_START : PARAGRAPH_START)).toBe(entry.paragraph);
  }
});

test("contributor docs report the test and shipped Bun pins from package.json", async () => {
  const pkg = await Bun.file(repoPath("package.json")).json();
  for (const path of ["CONTRIBUTING.md", "docs-site/src/content/docs/contributing.md"]) {
    const text = await Bun.file(repoPath(path)).text();
    const versions = /The suite uses Bun (\d+\.\d+\.\d+) \([^)]*testRunnerBun[^)]*\) while the shipped runtime is (\d+\.\d+\.\d+)\./.exec(text);
    expect(versions?.slice(1)).toEqual([pkg.testRunnerBun, pkg.dependencies.bun]);
  }
});
