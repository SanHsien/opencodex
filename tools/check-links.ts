#!/usr/bin/env bun
/**
 * 檢查本 fork 維護文件之間的相對連結。
 *
 * 只掃 SanHsien overlay 與根目錄維護檔，不掃上游 README / docs-site。
 *
 *     bun tools/check-links.ts
 */
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const LINK_PATTERN = /!\[[^\]]*\]\(([^)]+)\)|\[[^\]]*\]\(([^)]+)\)/g;
const SKIP_PREFIXES = ["http://", "https://", "mailto:", "tel:", "#"];

const ROOT_DOCS = [
  "AGENTS.md",
  "AGENTS_INSTALL.md",
  "CLAUDE.md",
  "FORK.md",
  "NOTICE.md",
  "REVIEW.md",
  "SECURITY.md",
  "SKILL.md",
];

export function iterDocuments(): string[] {
  const documents = ROOT_DOCS.map((name) => join(ROOT, name)).filter((path) =>
    existsSync(path),
  );
  const forkDocs = join(ROOT, "docs", "fork");
  if (existsSync(forkDocs)) {
    for (const name of readdirSync(forkDocs)) {
      if (name.endsWith(".md")) documents.push(join(forkDocs, name));
    }
  }
  return documents.sort();
}

export function checkDocument(path: string): string[] {
  const problems: string[] = [];
  const text = readFileSync(path, "utf8");
  for (const match of text.matchAll(LINK_PATTERN)) {
    const target = (match[1] ?? match[2] ?? "").trim().replace(/^<|>$/g, "");
    if (!target || SKIP_PREFIXES.some((prefix) => target.startsWith(prefix))) {
      continue;
    }
    const filePart = decodeURIComponent(target.split("#", 1)[0] ?? "");
    if (!filePart) continue;
    const resolved = filePart.startsWith("/")
      ? resolve(ROOT, filePart.replace(/^\/+/, ""))
      : resolve(dirname(path), filePart);
    const relToRoot = relative(ROOT, resolved);
    // Windows: 當目標落在**另一個磁碟機**（runner 的工作區在 D:，TEMP 在 C:），
    // `relative` 給不出相對路徑，會回傳目標的絕對路徑——不以 ".." 開頭，
    // 於是「逃出 repo」的判斷在 Windows 上整個失效。絕對路徑同樣算逃出。
    const escapesRoot = relToRoot.startsWith("..") || isAbsolute(relToRoot);
    if (escapesRoot || relToRoot === "") {
      if (escapesRoot) {
        problems.push(`${target} → 連結逃出 repo 根目錄`);
      }
      continue;
    }
    if (!existsSync(resolved)) {
      problems.push(`${target} → 找不到 ${relToRoot.replaceAll("\\", "/")}`);
    }
  }
  return problems;
}

function main(): number {
  const documents = iterDocuments();
  if (documents.length === 0) {
    console.log("找不到任何維護用 Markdown 檔");
    return 1;
  }

  let failures = 0;
  for (const path of documents) {
    const problems = checkDocument(path);
    const rel = relative(ROOT, path).replaceAll("\\", "/");
    if (problems.length > 0) {
      failures += 1;
      for (const problem of problems) {
        console.log(`FAIL ${rel}: ${problem}`);
      }
    } else {
      console.log(`OK   ${rel}`);
    }
  }

  console.log(`\n共 ${documents.length} 份文件，${failures} 份有斷掉的相對連結。`);
  return failures ? 1 : 0;
}

if (import.meta.main) {
  process.exit(main());
}
