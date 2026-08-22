# Repository review（Windows-first）

- Review date: 2026-08-22
- Review baseline: 上游 `main` `6ae83b1f189c353935d4977bb01227484fbdb52b`（`release: v2.31.0`）
- Primary environment: Windows 11、PowerShell、Bun 1.3.14（本機）、產品宣告 Bun 1.4.0
- Status: fork 維護骨架已建立；上游產品程式未改

## 結論

這個 fork 適合作為 Windows 本機使用與追蹤上游的維護線。產品是本機 provider proxy，含 ChatGPT / Codex **account pool**。

本輪只做 fork 骨架與危險 workflow 隔離。**沒有**改 `src/`、**沒有**改帳號池行為、**沒有**回貢、**沒有**發 npm。

## 已做

| ID | 項目 | 說明 |
|---|---|---|
| F-01 | GitHub fork | `SanHsien/opencodex`，`upstream` = `lidge-jun/opencodex` |
| F-02 | 維護文件 | `FORK.md`、`NOTICE.md`、`CLAUDE.md`、`SKILL.md`、`docs/fork/` |
| F-03 | Windows gate | `tools/dev_check.ps1` + `tests/fork-hygiene.test.ts` |
| F-04 | 上游追蹤 | `tools/check-upstream-updates.ts` + weekly workflow |
| F-05 | 發佈隔離 | `release.yml` / `deploy-docs.yml` / 治理 workflow 加官方 repo guard |

## 刻意不修

| ID | 項目 | 理由 |
|---|---|---|
| U-01 | 上游 `dev` 整合線與 PR 模板 | 那是官方專案流程。本 fork 日常走 `main`。 |
| U-02 | 翻譯 README / docs-site | 上游每週都在改；翻譯無法審查。 |
| U-03 | 本機 Bun 1.3.14 vs 套件宣告 1.4.0 | 先用現有 Bun 驗證 fork gate；產品 CI 會裝 `package.json` 宣告的版本。 |

## 本輪實證

### 本機（Windows 11）

```text
bun install --frozen-lockfile
→ 103 packages installed

pwsh -NoProfile -File tools\dev_check.ps1
→ fork-hygiene 14 pass / 0 fail
→ check-links：11 份文件，0 斷連結
→ WINDOWS DEV CHECK GREEN

bun run typecheck
→ bun x tsc --noEmit 成功（exit 0）

bun tools/check-upstream-updates.ts
→ No new upstream commits（仍在 6ae83b1f）
```

### 尚未宣稱範圍

- **沒有**本機跑完整 `bun run test`（約數分鐘；交給 GitHub `ci.yml`）。
- **沒有**用真實 ChatGPT 多帳號做 pool 端到端 smoke。
- **不宣稱**本 fork 會發自己的 npm 套件。
