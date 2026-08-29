# 維護決策

## 2026-08-28：最小移植 `#2557`，不提前重放 2.34

**決定**：把上游 `v2.33.0` 的桌面 app 探針修正接到本線：`listPackageProcesses` 用換行串 PowerShell，失敗回 `process_probe_failed`，CLI 不再說「沒在跑」。不因此把整棵 `v2.34.0` merge 進來。

**理由**：這是本線自己引用 `#2292` 之後立刻會痛的 Windows 洞。完整重放 overlay 仍是下一步，但使用端現在就可能打 `--restart-desktop-app`。

## 2026-08-27：批次審查 `v2.32.0`–`v2.34.0`，暫不合併；下次在 tag 上重放 overlay

**決定**：把 `6ae83b1f189c353935d4977bb01227484fbdb52b` 到
`80fff9a7f47332a4445df2b26ea175053fa55b0b`（`v2.34.0`）這段發版線當一批看完，
水位推進，但**不把上游 merge 進本線**。下次同步在 `v2.34.0` 上重放 overlay，
不要 `git merge` / `merge --allow-unrelated-histories`。

**理由**：

1. 2026-08-23 的 `chore: 壓縮歷史為單一提交` 是無父提交。本線與上游沒有
   merge-base。硬 merge 會變成兩棵不相關的樹對撞，衝突不可審。
2. 本線為 Windows 引用的 `--restart-desktop-app` 已在上游被 `#2557` 證明壞掉
  （PowerShell 用空白串陳述、探針失敗誤報成沒在跑）。正確解法是改吃上游檔，
   不是在 2.31 副本上再 cherry-pick 一次。
3. 上游多了 `cleanup-closed-pr-branches.yml`（排程、`contents: write`、刪關閉
   PR 的 branch）。進本 fork 前必須加官方-repo-only guard。
4. 514 筆 commit 的內容會隨重放進來；本輪不逐檔移植 Kiro／xAI／catalog 那些
   本線沒在用的路徑。

**維持不變**：不採用未合併的 open PR。不在本 fork 發 npm、不部署 docs-site。

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


## 2026-08-29：上游 PR 面向補上「關閉未合併」那一類

**決定**：`tools/check-upstream-updates.ts` 新增 `collectUnmergedPullRequests()` 與
`renderPullRequestSection()`，只列**上游關閉但未合併**、且編號大於 `reviewed_pr_through` 的 PR；
併進報告、`needs_attention` 與 `--strict` 的 exit code。workflow 補 `GH_TOKEN`。issue 面向維持
原本的 `platform` 標籤窄化，不動。

**理由**：本檔原本的判斷是「上游的東西反正會經由 `main` 的 release 進來，所以不追 PR」。那句話
對**已合併**的 PR 成立，而且只對它成立——**關閉但未合併**的 PR 永遠不會變成 commit，所以永遠
不會進來。`reviewed_pr_through: 2767` 就一直躺在 baseline 裡沒有任何程式讀，那一整類從頭到尾
沒人看。

窄化到「未合併」跟 `TRACKED_ISSUE_LABEL` 是同一個道理：上游關閉未合併的 PR 遠少於合併的，
所以這支檢查不會變成每週喊狼來了的那種——而喊狼來了的檢查會被忽略。

**fail closed**：`gh` 列舉不到時回 `undefined` 而不是空陣列，報告寫 Not checked，
`needs_attention` 與 exit 2 一起紅。「沒查到」和「沒有」在綠色報告裡長得一樣，只有一個是真的。

**證據**：`bun run typecheck` 乾淨；`tests/fork-hygiene.test.ts` 21 pass（新增 3 條）；實跑檢查器
發現 `#2767` 之後有 **23 筆**上游關閉未合併的 PR——移植前這 23 筆一律不會出現在任何報告裡。

**觸發條件**：逐筆讀那 23 筆、把採用／不採用理由寫進 `docs/fork/UPSTREAM.md`，再推進
`reviewed_pr_through`。在那之前每週的 upstream-check 會是紅的，那是真實狀態不是故障。
