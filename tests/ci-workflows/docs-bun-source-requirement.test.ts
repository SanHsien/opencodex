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
  const translated = await Bun.file(repoPath("docs-site/src/content/docs/zh-tw/contributing.md")).text();
  const versions = /測試使用 Bun (\d+\.\d+\.\d+)（testRunnerBun），發行版 runtime 為 (\d+\.\d+\.\d+)。/.exec(translated);
  expect(versions?.slice(1)).toEqual([pkg.testRunnerBun, pkg.dependencies.bun]);
});

test("architecture transport notes identify the current bundle and historical runtime", async () => {
  const pkg = await Bun.file(repoPath("package.json")).json();
  for (const [path, statement] of [
    ["zh-tw/reference/architecture.md", /目前套件內附 Bun \*\*(\d+\.\d+\.\d+)\*\*/],
    ["reference/architecture.md", /current package bundles Bun \*\*(\d+\.\d+\.\d+)\*\*/],
  ] as const) {
    const text = await Bun.file(repoPath(`docs-site/src/content/docs/${path}`)).text();
    expect(statement.exec(text)?.[1], path).toBe(pkg.dependencies.bun);
    expect(text, path).not.toMatch(/Bundled Bun 1\.3\.14|El Bun 1\.3\.14 incluido/);
  }
});

test("Windows memory guidance reports the shipped runtime in every current-bundle statement", async () => {
  const pkg = await Bun.file(repoPath("package.json")).json();
  const cases = [
    ["troubleshooting/windows-memory.md", /current package bundles Bun\s*\**(\d+\.\d+\.\d+)/g],
    ["zh-tw/troubleshooting/windows-memory.md", /(?:現在套件內附 Bun|目前內附 Bun)\s*\**(\d+\.\d+\.\d+)/g],
  ] as const;
  for (const [path, statement] of cases) {
    const text = await Bun.file(repoPath(`docs-site/src/content/docs/${path}`)).text();
    const versions = [...text.matchAll(statement)].map(match => match[1]);
    expect(versions.length, `${path} intro and recovery guidance`).toBe(2);
    expect(versions, path).toEqual([pkg.dependencies.bun, pkg.dependencies.bun]);
    expect(text, `${path} historical investigation remains historical`).toContain("1.3.14");
  }
});
