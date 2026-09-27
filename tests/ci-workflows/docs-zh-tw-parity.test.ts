/**
 * This fork ships English and Traditional Chinese only (FORK.md), and the zh-tw tree is meant to
 * carry the same content as its English source -- not a summary of it.
 *
 * It did not. Before 2026-09-18 the zh-tw pages were condensations: 34 of them were short by whole
 * sections, nine did not exist at all, and several described older product behaviour. The two that
 * mattered most were safety claims, not translation nits: reference/cli/lifecycle.md told readers
 * `ocx service restart` is an alias of `repair` when the English source says explicitly that it is
 * not, and guides/remote-hub.md still taught the `export OPENCODEX_API_AUTH_TOKEN=...` step that
 * upstream deleted in #4236 -- the step that put a management admin token in the data-plane
 * variable. Nothing caught either one, because nothing compared the two trees.
 *
 * Drift is the normal state here: every upstream merge edits the English pages and leaves zh-tw
 * untouched. This oracle exists so that edit fails the build instead of shipping a page that
 * quietly contradicts the product.
 *
 * It pins structure, not prose. Heading counts and link targets survive translation; sentences do
 * not, and an oracle that pinned sentences would be rewritten into uselessness on the first merge.
 * A missing section cannot hide from a heading count, which is the failure mode that actually
 * happened.
 *
 * The file walk covers `.md` AND `.mdx`. An earlier sweep scanned `.md` only and reported "every
 * page matches" while getting-started/how-it-works.mdx was missing sixteen lines on activating
 * idle rolling windows. Extension-blind is the whole point.
 */
import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const DOCS = join(ROOT, "docs-site", "src", "content", "docs");
const ZH_TW = join(DOCS, "zh-tw");
const PAGE_EXTENSIONS = [".md", ".mdx"] as const;

/** Locales upstream ships that this fork deletes; re-adding one is a policy regression. */
const REMOVED_LOCALES = ["fr", "ja", "ko", "ru", "tr", "zh-cn", "de", "es"] as const;

/** Absolute links into the docs tree start with one of these; anything else is external. */
const DOC_SECTIONS = [
  "guides",
  "reference",
  "getting-started",
  "troubleshooting",
  "contributing",
  "benchmarks",
] as const;

function isPage(name: string): boolean {
  return PAGE_EXTENSIONS.some(extension => name.endsWith(extension));
}

function walk(dir: string, skip?: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (skip && full === skip) continue;
    if (statSync(full).isDirectory()) {
      out.push(...walk(full, skip));
      continue;
    }
    if (isPage(entry)) out.push(full);
  }
  return out;
}

/** English pages, as paths relative to the docs root, with `/` separators on every platform. */
function englishPages(): string[] {
  return walk(DOCS, ZH_TW)
    .map(path => relative(DOCS, path).split(sep).join("/"))
    .sort();
}

function headings(path: string): string[] {
  return readFileSync(path, "utf8")
    .split(/\r?\n/)
    .filter(line => /^\s*#{2,4} /.test(line));
}

function fences(path: string): number {
  return readFileSync(path, "utf8")
    .split(/\r?\n/)
    .filter(line => /^\s*```/.test(line)).length;
}

describe("zh-tw documentation parity", () => {
  test("every English page has a Traditional Chinese counterpart", () => {
    const missing = englishPages().filter(page => !existsSync(join(ZH_TW, page)));
    expect(missing).toEqual([]);
  });

  test("each page carries the same sections as its English source", () => {
    // A count, not the titles: the titles are translated, so comparing them would fail on every
    // correct translation. A dropped section changes the count, and that is the defect seen.
    const drifted = englishPages()
      .filter(page => existsSync(join(ZH_TW, page)))
      .map(page => {
        const english = headings(join(DOCS, page)).length;
        const translated = headings(join(ZH_TW, page)).length;
        return { page, english, translated };
      })
      .filter(row => row.english !== row.translated)
      .map(row => `${row.page}: zh-tw has ${row.translated} of ${row.english} sections`);
    expect(drifted).toEqual([]);
  });

  test("each page carries the same code blocks as its English source", () => {
    // Commands are the part a reader copies. A translation that dropped or invented a fenced block
    // is either missing a step or teaching one the product does not have.
    const drifted = englishPages()
      .filter(page => existsSync(join(ZH_TW, page)))
      .map(page => ({ page, english: fences(join(DOCS, page)), translated: fences(join(ZH_TW, page)) }))
      .filter(row => row.english !== row.translated)
      .map(row => `${row.page}: zh-tw has ${row.translated} fence lines, English has ${row.english}`);
    expect(drifted).toEqual([]);
  });

  test("no removed locale has been reintroduced", () => {
    // Upstream keeps adding these back on merge; FORK.md says this fork ships two locales.
    const present = REMOVED_LOCALES.filter(locale => existsSync(join(DOCS, locale)));
    expect(present).toEqual([]);
  });

  test("zh-tw cross-page links stay in the zh-tw locale and resolve", () => {
    // An English-path link inside a Chinese page drops the reader out of the locale mid-sentence,
    // and a /zh-tw/ link to a page that does not exist is a 404. Both were real: the tree carried
    // 101 of the first kind until every target had a translation.
    const problems: string[] = [];
    for (const path of walk(ZH_TW)) {
      const page = relative(ZH_TW, path).split(sep).join("/");
      const source = readFileSync(path, "utf8");
      for (const match of source.matchAll(/\]\((\/[^)#\s]*)/g)) {
        const target = match[1]!;
        const section = target.split("/")[1] ?? "";
        if (DOC_SECTIONS.includes(section as (typeof DOC_SECTIONS)[number])) {
          problems.push(`${page}: ${target} is an English path, expected /zh-tw${target}`);
          continue;
        }
        if (!target.startsWith("/zh-tw/")) continue;
        const rel = target.replace(/^\/zh-tw\//, "").replace(/\/$/, "");
        const resolves = PAGE_EXTENSIONS.some(
          extension =>
            existsSync(join(ZH_TW, `${rel}${extension}`)) ||
            existsSync(join(ZH_TW, rel, `index${extension}`)),
        );
        if (!resolves) problems.push(`${page}: ${target} has no zh-tw page`);
      }
    }
    expect(problems).toEqual([]);
  });

  test("every zh-tw page declares a translated title and description", () => {
    // Starlight falls back to the English frontmatter silently, so a page can render an English
    // title over Chinese body text and look intentional.
    const problems: string[] = [];
    for (const path of walk(ZH_TW)) {
      const page = relative(ZH_TW, path).split(sep).join("/");
      const lines = readFileSync(path, "utf8").split(/\r?\n/);
      if (lines[0] !== "---") {
        problems.push(`${page}: no frontmatter`);
        continue;
      }
      const end = lines.indexOf("---", 1);
      const frontmatter = lines.slice(1, end === -1 ? lines.length : end);
      for (const field of ["title", "description"]) {
        if (!frontmatter.some(line => line.startsWith(`${field}:`))) {
          problems.push(`${page}: frontmatter has no ${field}`);
        }
      }
    }
    expect(problems).toEqual([]);
  });
});
