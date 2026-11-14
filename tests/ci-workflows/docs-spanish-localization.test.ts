import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { repoPath } from "../helpers/repo-root";
import { codeBlockLocale } from "../../docs-site/src/data/code-block-locale";

const source = (path: string): string => readFileSync(path, "utf8").replace(/\r\n/g, "\n");
const config = source(repoPath("docs-site/astro.config.mjs"));
/** Locate quoted or indented fences; a close needs the same marker and at least its opening length. */
function fencedBlocks(markdown: string): { start: number; end: number; content: string }[] {
  const lines = [...markdown.matchAll(/[^\n]*(?:\n|$)/g)].filter(line => line[0].length);
  const blocks: { start: number; end: number; content: string }[] = [];
  const unquote = (line: string): string => line.replace(/^(?:[ \t]*>[ \t]?)+/, "");
  const quoteDepth = (line: string): number => (line.match(/^(?:[ \t]*>[ \t]?)+/)?.[0].match(/>/g) ?? []).length;
  for (let i = 0; i < lines.length; i++) {
    const depth = quoteDepth(lines[i]![0]);
    const opening = /^[ \t]*(`{3,}|~{3,})([^\n]*)\n?$/.exec(unquote(lines[i]![0]));
    if (!opening || (opening[1]![0] === "`" && opening[2]!.includes("`"))) continue;
    const start = lines[i]!.index!;
    const contentStart = start + lines[i]![0].length;
    let closing = i + 1;
    for (; closing < lines.length; closing++) {
      if (quoteDepth(lines[closing]![0]) !== depth) continue;
      const fence = /^[ \t]*(`+|~+)[ \t]*\n?$/.exec(unquote(lines[closing]![0]))?.[1];
      if (fence?.[0] === opening[1]![0] && fence.length >= opening[1]!.length) break;
    }
    const contentEnd = lines[closing]?.index ?? markdown.length;
    const end = closing < lines.length ? contentEnd + lines[closing]![0].length : markdown.length;
    blocks.push({ start, end, content: markdown.slice(contentStart, contentEnd) });
    i = closing;
  }
  return blocks;
}
/** Preserve fenced example bytes so translations cannot silently change executable commands. */
function codeBlocks(markdown: string): string[] {
  return fencedBlocks(markdown).map(block => block.content);
}
/** Remove the same detected fence ranges before checking identifiers in translated prose. */
function withoutFencedCode(markdown: string): string {
  let prose = "", previous = 0;
  for (const block of fencedBlocks(markdown)) {
    prose += markdown.slice(previous, block.start) + "\n";
    previous = block.end;
  }
  return prose + markdown.slice(previous);
}
/** Read prose code spans, respecting escaped openers, matching backtick runs and wrapped lines. */
function inlineCode(markdown: string): Set<string> {
  const prose = withoutFencedCode(markdown);
  const values = new Set<string>();
  const escaped = (at: number): boolean => {
    let slashes = 0;
    for (let i = at - 1; i >= 0 && prose[i] === "\\"; i--) slashes++;
    return slashes % 2 === 1;
  };
  for (let at = 0; at < prose.length; at++) {
    if (prose[at] !== "`" || escaped(at)) continue;
    let length = 1;
    while (prose[at + length] === "`") length++;
    const closing = new RegExp("(?<!`)`{" + length + "}(?!`)", "g");
    closing.lastIndex = at + length;
    // Backslashes are literal inside code spans, including immediately before the closing run.
    const match = closing.exec(prose);
    if (!match || /\n[ \t]*\n/.test(prose.slice(at + length, match.index))) { at += length - 1; continue; }
    // Markdown code spans can cross lines; their rendered whitespace is normalized.
    values.add(prose.slice(at + length, match.index).replace(/\s*\n\s*/g, " ").trim());
    at = match.index + length - 1;
  }
  return values;
}
/** Read backslash-escaped code spans, which render as literal backtick-delimited text, not <code>. */
function escapedCodeSpans(markdown: string): Set<string> {
  const prose = withoutFencedCode(markdown);
  const values = new Set<string>();
  for (let at = 0; at < prose.length; at++) {
    if (prose[at] !== "\\" || prose[at + 1] !== "`") continue;
    const closing = prose.indexOf("\\`", at + 2);
    if (closing < 0) break;
    const value = prose.slice(at + 2, closing);
    if (!/[\n]/.test(value)) values.add(value.trim());
    at = closing + 1;
  }
  return values;
}
/** Find exact canonical code identifiers absent from the translation, across all model families. */
function missingInlineIdentifiers(english: string, spanish: string): string[] {
  const translated = inlineCode(spanish);
  return [...inlineCode(english)].filter(value => !translated.has(value));
}

describe("Documentation code-span and code-block localization", () => {
  test("code spans keep a trailing backslash literal without swallowing later identifiers", () => {
    const english = "Paths `~\\` and `~/` keep `models` unchanged.";
    const spanish = "Las rutas `~\\` y `~/` conservan `models`.";
    expect([...inlineCode(english)]).toEqual(["~\\", "~/", "models"]);
    expect(missingInlineIdentifiers(english, spanish)).toEqual([]);
    expect(missingInlineIdentifiers(english, spanish.replace("`~\\`", "`wrong-path`"))).toEqual(["~\\"]);
    expect(missingInlineIdentifiers(english, spanish.replace("`models`", "`other-models`"))).toEqual(["models"]);
    expect([...inlineCode("\\`ordinary prose\\` then `models`.")]).toEqual(["models"]);
  });

  test("code-block controls use the content locale on Windows and POSIX", () => {
    expect(codeBlockLocale({ path: "C:\\Work\\Docs Site\\src\\content\\docs\\zh-tw\\guides\\pi.md" })).toBe("zh-TW");
    expect(codeBlockLocale({ url: new URL("file:///C:/Work/Docs%20Site/src/content/docs/zh-tw/guides/pi.md") })).toBe("zh-TW");
    expect(codeBlockLocale({ path: "/workspace/docs-site/src/content/docs/zh-cn/guides/pi.md" })).toBe("zh-CN");
    expect(codeBlockLocale({ url: new URL("https://opencodex.me/zh-tw/guides/pi/") })).toBe("zh-TW");
    expect(codeBlockLocale({ path: "/workspace/docs-site/src/content/docs/guides/pi.md" })).toBe("en");
    expect(codeBlockLocale({})).toBe("en");
    expect(config).toContain("getBlockLocale");
  });

  test("compares list-indented command fences and excludes them from inline prose", () => {
    for (const [indent, fence] of [["", "```"], ["  ", "```"], ["   ", "~~~"], ["\t", "````"]]) {
      const canonical = ["1. Run `droid exec`:", "", `${indent}${fence}bash`,
        `${indent}droid exec --model glm-5.2 'Reply with DROID_OK only.'`,
        `${indent}printf '\`fenced-code-only\`'`, `${indent}${fence}`, ""].join("\n");
      expect(codeBlocks(canonical)).toHaveLength(1);
      expect(codeBlocks(canonical.replace("glm-5.2", "wrong-model"))).not.toEqual(codeBlocks(canonical));
      expect([...inlineCode(canonical)]).toEqual(["droid exec"]);
    }
  });

  test("longer closing fences cannot hide changed commands or leak code into prose", () => {
    for (const indent of ["", "  ", "   ", "\t"]) {
      for (const marker of ["`", "~"]) {
        const markdown = ["Run `ocx export`:", "", `${indent}${marker.repeat(3)}bash`,
          `${indent}ocx export --client pi`, `${indent}echo '\`code-only\`'`,
          `${indent}${marker.repeat(4)}`, "", "Then use `models.json`."].join("\n");
        expect(codeBlocks(markdown)).toHaveLength(1);
        expect(codeBlocks(markdown.replace("--client pi", "--client wrong"))).not.toEqual(codeBlocks(markdown));
        expect([...inlineCode(markdown)]).toEqual(["ocx export", "models.json"]);
        expect(withoutFencedCode(markdown)).not.toContain("code-only");
      }
    }
  });

  test("shorter or mixed fences stay inside the block and an unclosed block reaches EOF", () => {
    for (const marker of ["`", "~"]) {
      const other = marker === "`" ? "~" : "`";
      const body = ["ocx start", marker.repeat(3), other.repeat(5), "echo '`code-only`'", ""].join("\n");
      const opening = marker.repeat(4) + "bash\n";
      expect(codeBlocks(opening + body + marker.repeat(4) + "\n")).toEqual([body]);
      expect(codeBlocks(opening + body)).toEqual([body]);
      expect([...inlineCode(opening + body)]).toEqual([]);
    }
    expect(codeBlocks("```not `an opening`\nordinary prose\n")).toEqual([]);
  });

  test("checks commands inside quoted examples and removes them from prose", () => {
    const markdown = ["Read `config.json`:", "", "> ```bash", "> ocx start", "> echo '`quoted-code`'", "> ````", ""].join("\n");
    expect(codeBlocks(markdown)).toEqual(["> ocx start\n> echo '`quoted-code`'\n"]);
    expect(codeBlocks(markdown.replace("ocx start", "ocx wrong"))).not.toEqual(codeBlocks(markdown));
    expect([...inlineCode(markdown)]).toEqual(["config.json"]);
  });

  test("closing fences must match the opening quote context", () => {
    for (const quote of ["", "> ", "> > "]) {
      for (const marker of ["`", "~"]) {
        const fence = marker.repeat(3);
        const body = [`${quote}> ${fence}`, `${quote}ocx start`, `${quote}echo '\`code-only\`'`, ""].join("\n");
        const markdown = [`Read \`config.json\`:`, "", `${quote}${fence}text`, body + `${quote}${fence}`,
          "", "Then use `models.json`."].join("\n");
        expect(codeBlocks(markdown)).toEqual([body]);
        expect(codeBlocks(markdown.replace("ocx start", "ocx wrong"))).not.toEqual(codeBlocks(markdown));
        expect([...inlineCode(markdown)]).toEqual(["config.json", "models.json"]);
        expect(withoutFencedCode(markdown)).not.toContain("code-only");
      }
    }
  });

  test("model identifier parity rejects extended tokens across families and namespaces", () => {
    const identifiers = ["gpt-6-astra", "whisper-1", "claude-opus-5", "o1-mini", "o3-mini", "o4-mini",
      "codex-mini-latest", "qwen/qwen3-coder-plus", "tev1:4b"];
    const canonical = identifiers.map(id => `\`${id}\``).join(", ");
    expect(missingInlineIdentifiers(canonical, canonical)).toEqual([]);
    for (const id of identifiers) {
      const extended = canonical.replace(`\`${id}\``, `\`${id}-translated\``);
      expect(missingInlineIdentifiers(canonical, extended)).toEqual([id]);
    }
  });

});
