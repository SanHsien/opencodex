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
| `README.md` | 繁體中文產品說明（主文件）；英文在 `README.en.md` |
| GUI / docs-site 語系 | 只保留英文與繁體中文；其餘語系刪除 |
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

- `origin/main`：SanHsien 維護主線。目前停在上游 `v2.31.0` 加上 overlay 與選擇性引用；上游 `main` 已到 `v2.34.0`。
- `upstream/main`：上游發版線；`upstream/dev` 是上游 PR 整合線，需要時再 fetch。
- 2026-08-23 曾把歷史壓成無父提交，與上游沒有共同祖先。下次同步在 `v2.34.0` 上重放 overlay，不要 `git merge upstream/main`。詳見 [`docs/fork/UPSTREAM.md`](docs/fork/UPSTREAM.md)。
- 本 fork 的一般修改**直接推 `origin/main`**，不開功能分支、不開維護 PR（維護者 2026-08-22 指示，與其他 repo 一致）。
  只有在需要他人審查、或改動風險高到值得先讓 CI 在 PR 上跑一輪時，才退回 branch → PR → CI → squash merge。
- **合併任何 PR 前必須讀完整 diff**（`gh pr diff <編號>`），包含 Dependabot 開的。CI 綠燈證明的是
  「測試沒紅」，不是「改了什麼、該不該進 main」；核准或合併訊息要寫出讀到什麼、為什麼可接受。
- 不要把 fork-only 的維護差異送到 upstream。上游的 `dev` 整合政策只適用於回貢，不適用本 fork 的日常 PR。

### 開 PR 的硬規則

日常 PR **只能**打進 `SanHsien/opencodex`：

根因是機制不是粗心：`gh` 在 fork clone 的**預設 repo 就是上游**，所以第一件事是把它釘住。

```powershell
gh repo set-default SanHsien/opencodex   # 每個 clone 先跑一次
gh repo set-default --view               # 必須回 SanHsien/opencodex
git remote -v
gh pr create --repo SanHsien/opencodex --base main --head <分支>
```

建完後核對印出的 URL 必須是 `https://github.com/SanHsien/opencodex/pull/...`。
裸跑 `gh pr create`（不加 `--repo`）會打到上游 `lidge-jun/opencodex`——2026-08-22 一天內兩個工具階段
各誤開一次（本 repo 的 `#2373`、另一個 fork 的 `hamanpaul/paulsha-cortex#787`，皆已關閉），禁止再犯。
兩次都是「指令成功了」的錯覺：開錯的 owner 就寫在輸出的 URL 裡。本機另有 `PreToolUse` hook
（Claude Code／Codex／Cursor 三者皆已安裝）攔截沒帶 `--repo SanHsien/...` 的 `gh ... create`。

對上游開 PR 的**唯一例外**：維護者在這次對話明確同意回貢。下列都不是例外：fork、建置開發環境、開 PR、比照其他 repo、合併回 main。

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

## 相鄰的維護中 repo

opencodex 決定 agent **背後跑哪個 LLM**，不約束 agent 做什麼。約束行為的是另外四個 repo，各治理一層：

| 層 | Repo | 做什麼 |
| --- | --- | --- |
| 派工決策 | [agent-advisor](https://github.com/SanHsien/agent-advisor) | 風險分流路由 `solo`／`delegate`／`audit`／`full` |
| 動作攔截 | [harness-guard](https://github.com/SanHsien/harness-guard) | agent runtime hook，實際攔截危險指令、無證據宣稱、紅燈提交 |
| 產出品質 | [ai-quality-gates](https://github.com/SanHsien/ai-quality-gates) | 覆蓋率、突變測試、圈複雜度、依賴結構、有界 loop policy |
| 交付流程 | [paulsha-cortex](https://github.com/SanHsien/paulsha-cortex) | Candidate → Verify → Independent Review → Delivery → CompletionRecord |

這一節寫在 `FORK.md` 而不是 `README.md`：README 跟隨上游，加 fork 專屬內容會讓每次同步都產生衝突。
