# 維護決策

## 2026-08-23：PR／issue 一律 `--state all`，並在 `dev` 上選擇性引用

**決定**：修正 2026-08-22 那條「上游的 PR 不是本 fork 的審查單位」。審查單位仍是 `main` 上的
release commit，但增加兩條：

1. 查 PR 與 issue **一律用 `--state all`**。未合併就關閉的 PR 永遠不會經由 commit 路徑抵達，
   而那正是「上游拒收、但可能對本 fork 有價值」的一類。
2. 已合併但只在 `dev` 的修正，若**本 fork 現在就會痛**，就選擇性引用，不等 release。

**理由**：`dev` 目前領先 `main` 69 個 commit，實測 `#2398` 的 merge commit 在 `dev` 不在 `main`
——「合併後會隨 release 進 `main`」在時間上可能是好幾週。本輪依此引用了兩支「讀取沒有上限」的
修正（`#2395`、`#2398` 前半），兩者的缺陷都在本 fork 的程式碼裡實查確認過。

**維持不變**：不逐筆採用未合併的 open PR。那是提案，不是上游已接受的變更；採用等於接手維護一份
還會變動的補丁。逐項證據與觸發條件記在 [`UPSTREAM.md`](UPSTREAM.md)。

## 2026-08-22：上游的 PR 與分支不是本 fork 的審查單位，issue 只追 platform

**決定**：不逐筆評估上游的 open PR（43 個，全部 base 在 `dev`）與分支（71 個，多為那些 PR 的
head）。審查單位是 `main` 上的 release commit。issue 只追 `platform` 標籤，並在
`tools/upstream_baseline.json` 記 `reviewed_issue_through` 水位；`check-upstream-updates.ts`
只報水位之後的新 issue，`gh` 不可用時報「未檢查」而不是「沒有待審」。本次分流到 `#2379`。

**理由**：上游 PR 合併後本來就會隨 release 進 `main`，事前逐筆看等於把同一份改動看兩次，
而且看的是還會變動的版本。反過來，把 40 幾個 PR 與 50 幾個 issue 每週報一次，會讓這支檢查
變成固定紅燈——喊狼來了的檢查沒有人看。`platform` 是唯一會改變「本 fork 要在 Windows 上驗
什麼」的類別，值得每週問一次。

**已知結論**（避免下次重推）：`ci.yml` 的 `windows <shard>/4` job 只有 `workflow_dispatch`
會跑，所以 Cross-platform CI 的綠燈不包含那套 shard；上游 `#2152` 記錄了那套 shard 既有的
六個失敗。本 fork 的 Windows 覆蓋來自 `keyring windows`、`npm-global windows-latest` 與
`fork gate (windows-latest)`。逐項證據見 [`UPSTREAM.md`](UPSTREAM.md)。


## 2026-08-22：文件與語系只留繁中、英文

**決定**：`README.md` 以繁體中文為主，英文另存 `README.en.md`。GUI 與 docs-site 只保留英文與繁體中文，刪除法文、日文、韓文、俄文、土耳其文、簡體中文。簡體中文瀏覽器對應到繁中。

**理由**：維護線以繁中溝通；多語系會跟上游每週翻譯衝突，也不符合本 fork 的使用場景。

## 2026-08-22：fork 可管理多帳號的 lidge-jun/opencodex

**決定**：fork [`lidge-jun/opencodex`](https://github.com/lidge-jun/opencodex)，保留 MIT 授權與完整歷史，預設分支維持 `main`。本線聚焦 Windows 開發 gate、fork CI、危險 workflow 隔離，以及逐筆審查的上游追蹤。產品 README 以繁體中文為主，英文另存 `README.en.md`。

**理由**：要的是「可管理多帳號」的那一個。此專案在 dashboard 管理 ChatGPT / Codex account pool（配額、affinity、failover），並把任意 LLM 接到 Codex / Claude Code。GitHub 上另有遠端桌面中介與 OpenCode 改名專案，名稱相近但不是這個。fork 當下 HEAD 為 `6ae83b1f189c353935d4977bb01227484fbdb52b`（`release: v2.31.0`）。

**限制**：

- 不把 fork 包裝成原創專案，不移除原作者與 MIT 標示。
- `README.md` 為繁體中文產品說明；英文在 `README.en.md`。
- GUI 與 docs-site 只保留英文、繁體中文語系。
- `CONTRIBUTING.md`、`MAINTAINERS.md`、`SECURITY.md`、`src/` 以上游為準。
- 上游更新必須逐筆審查。
- 本 fork 不發 npm、不部署 GitHub Pages。
- 帳號池只做路由與韌性，不拿來規避 provider 條款。
- 日常 PR 只打 `SanHsien/opencodex`。對上游開 PR 必須維護者這次對話明確同意回貢。

## 2026-08-22：禁止裸跑 gh pr create

**決定**：本 fork 開 PR 一律 `gh pr create --repo SanHsien/opencodex`。建完核對 URL owner。對上游開 PR 的唯一例外是維護者明確同意回貢。

**理由**：2026-08-22 裸跑 `gh pr create` 把維護骨架打進 `lidge-jun/opencodex#2373`。GitHub CLI 在有 `upstream` 的 fork clone 上預設 target 是母 repo。已關閉該 PR。禁止再犯。

## 2026-08-22：隔離會在 fork 上造成傷害或噪音的上游 workflow

**決定**：下列 workflow 加上 `github.repository == 'lidge-jun/opencodex'`，只在官方 repo 跑：

- `release.yml`（npm Trusted Publishing）
- `deploy-docs.yml`（GitHub Pages）
- `service-lifecycle.yml`
- issue / PR 治理：`enforce-issue-quality.yml`、`enforce-pr-target.yml`、`issue-triage.yml`、`pr-hygiene.yml`、`pr-labeler.yml`、`stale-needs-info.yml`、`cleanup-orphaned-workflows.yml`

**保留在本 fork 跑**：`ci.yml`（產品回歸）、`react-doctor.yml`、`issue-quality-tests.yml`。

**理由**：`release.yml` 在 fork 上若被手動觸發，有機會對 npm 做 Trusted Publishing。`enforce-pr-target` 會把 PR 逼去上游的 `dev` 線，與本 fork 的 `main` 工作流衝突。治理 bot 在個人 fork 沒有對應的 Copilot / CodeRabbit 設定，只會製造失敗與亂關 issue。

## 2026-08-22：本 fork 日常走 main，不跟上游的 dev PR 政策

**決定**：SanHsien 維護線以 `main` 為整合分支。只有維護者在這次對話明確同意回貢時，才對 `lidge-jun/opencodex` 的 `dev` 開 PR。

**理由**：上游 `main` 是 release 線、`dev` 是 PR 整合線。fork 若同時模仿兩條線，Windows gate 與上游同步都會加倍。clone 時已用 `--default-branch-only` 對齊 `main`。

## 2026-08-22：Dependabot 不啟用 npm

**決定**：不幫上游的 `bun.lock` / `package.json` 開 npm Dependabot。fork-owned workflow 的 action pin 用 CodeQL / checkout SHA，之後若要自動升，只開 `github-actions`。

**理由**：上游幾乎每天發版。對 lockfile 開 Dependabot 會與上游 merge 持續衝突。
