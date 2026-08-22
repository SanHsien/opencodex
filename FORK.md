# Fork 維護說明

本 repo fork 自 [`lidge-jun/opencodex`](https://github.com/lidge-jun/opencodex)，
沿用 MIT License 與完整 Git 歷史。這是**可管理多個 ChatGPT / Codex 帳號**的那一個 OpenCodex：本機 proxy + dashboard 的 account pool，不是遠端桌面中介，也不是 OpenCode 的改名 fork。

## 為什麼維護 fork

- 在 Windows 11 本機跑 `ocx`：把 Claude、Gemini、Grok、DeepSeek、Ollama 等接到 Codex / Claude Code。
- 使用並審查 **ChatGPT account pool**（多帳號、配額、thread affinity）。
- 上游仍在快速發版；本線要能逐筆審查 `upstream/main`，而不是盲目跟。
- 不當成第二個官方產品站，也不在本 fork 發 `@bitkyc08/opencodex`。

**回貢判準：修的是上游 proxy / 帳號池 / 測試的 bug 就送回 `lidge-jun/opencodex`；這裡獨創的文件／Windows 維護骨架留在這裡。**

## 與上游的差異

| 項目 | 說明 |
|---|---|
| `README.md` | **不翻譯、不改寫。** 產品說明與帳號池條款以上游英文為準 |
| `AGENTS.md` 開頭 overlay | 指向本檔；下文仍是上游產品規則 |
| `FORK.md` / `NOTICE.md` / `CLAUDE.md` / `SKILL.md` / `REVIEW.md` | 本 fork 的維護入口 |
| `docs/fork/` | Windows 開發、上游審查、決策 |
| `tools/dev_check.ps1` | Windows 本機一鍵 fork gate |
| `.github/workflows/fork-maintenance.yml` | fork 文件與連結檢查 |
| `.github/workflows/upstream-check.yml` | 每週對 `upstream/main` 做未審查 commit 檢查 |
| 上游 `release.yml` / `deploy-docs.yml` / issue·PR 治理 workflow | 加上只在官方 `lidge-jun/opencodex` 執行的 guard |
| 上游 `ci.yml` | **保留並在本 fork 跑**，這是產品回歸 |

上游 `CONTRIBUTING.md`、`MAINTAINERS.md`、`SECURITY.md`、`docs-site/`、`src/` 以上游為準，除非有已記錄的 fork 修正。

## 分支與 remote

- `origin/main`：SanHsien 維護主線（fork 當下對齊上游 release `main`）。
- `upstream/main`：上游發版線；`upstream/dev` 是上游 PR 整合線，需要時再 fetch。
- 本 fork 的一般修改從 `main` 建短期 branch，開 PR、讀完整 diff，等 CI 通過後再 squash merge 回 `main`。
- 不要把 fork-only 的維護差異送到 upstream。上游的 `dev` 整合政策只適用於回貢，不適用本 fork 的日常 PR。

不要 `git push upstream`。同步方式見 [`docs/fork/UPSTREAM.md`](docs/fork/UPSTREAM.md)。

## 換一台電腦怎麼開發

```powershell
git clone https://github.com/SanHsien/opencodex.git
cd opencodex
bun install --frozen-lockfile
pwsh -NoProfile -File tools\dev_check.ps1
```

完整產品回歸（較久）：

```powershell
bun run typecheck
bun run test
```

只想當使用者跑 proxy、不開發時：

```powershell
npm install -g @bitkyc08/opencodex
ocx start
```

然後打開 http://localhost:10100 設定 provider 與 ChatGPT 帳號池。
