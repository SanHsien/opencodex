import { expect, test } from "bun:test";
import { repoPath } from "../helpers/repo-root";

// Fork policy (FORK.md) ships only English and Traditional Chinese; upstream's other
// translated contributing pages (fr, tr, etc.) do not exist in this tree.
const CASES = [
  {
    path: "docs-site/src/content/docs/zh-tw/contributing.md",
    policy: "- 若 pull request 變更 `gui/` 下的檔案，請在描述中附上 UI 變更的螢幕截圖；`enforce-target` 會在 描述編輯時重新執行，直到附上截圖為止。請將圖片拖曳至描述中，不要 commit 到 PR 分支：否則 squash merge 會將圖片帶入 `dev`。透過命令列上傳的維護者應使用 `pr-assets` 分支，並以 commit SHA 連結圖片。",
  },
  {
    path: "MAINTAINERS.md",
    policy: "empty, thin, or malformed descriptions; PRs that change files under `gui/` must include a screenshot of the UI change in the description. Drag the image into the description instead of committing it to the PR branch; command-line uploads use the `pr-assets` branch and a commit-SHA link.",
  },
] as const;

test("GUI screenshot contributor guidance follows the changed-path gate and keeps images off PR branches", async () => {
  for (const { path, policy } of CASES) {
    const text = (await Bun.file(repoPath(path)).text()).replace(/\s+/g, " ");
    expect(text.includes(policy), path).toBe(true);
  }
});
