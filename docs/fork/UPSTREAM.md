# 上游維護

## Remote

- Fork：`origin` → `https://github.com/SanHsien/opencodex.git`
- 原作者：`upstream` → `https://github.com/lidge-jun/opencodex.git`
- 追蹤目標：上游的 **stable release tag**（`vX.Y.Z`，不含 `-preview.*`）。上游已於 2026-11-08 刪除 `main`，遠端 HEAD 改為 `dev`（PR 整合線，不追蹤）；`preview` 是 prerelease，也不追蹤。決定與理由見 [`DECISIONS.md`](DECISIONS.md) 2026-11-09。

## 檢查新提交

```powershell
bun tools/check-upstream-updates.ts --strict
```

工具自己抓上游 tag（`+refs/tags/v*:refs/upstream-check/tags/v*`，不進 `refs/tags/`），找出比 `tools/upstream_baseline.json` 的 `integrated_tag` 更新的最高 stable tag，並以 `reviewed_through` 為起點列出該 tag 帶來的未審查提交。沒有更新的 stable tag 就回報沒有新提交。`track` 欄位預設為 `branch`（比對 `branch` 的頭），本 fork 設為 `stable-tags`。

### 上游 tag 放 `refs/upstream-tags/`，不進本機 `refs/tags/`

`tests/ci-workflows/release-version-line.test.ts` 讀本機 `git tag --list 'v*'`，斷言 `package.json` 版本不落後最高 release tag；
那個「最高 tag」應該只指 fork 自己的 release tag。`git fetch upstream --tags` 會把上游 tag 混進去，上游一發版本機測試就紅（CI 不抓上游 tag 所以綠）。
所以上游 tag 一律抓進獨立命名空間，並讓 `upstream` remote 不自動抓 tag：

```powershell
git config remote.upstream.tagOpt --no-tags          # 每個 clone 設一次
git fetch --no-tags upstream "+refs/tags/*:refs/upstream-tags/*"
```

之後引用上游 tag 一律寫 `refs/upstream-tags/vX.Y.Z`，例如 `git diff refs/upstream-tags/v2.93.0 refs/upstream-tags/v2.94.0`、
`git worktree add <dir> refs/upstream-tags/v2.94.0`。不要再跑 `git fetch upstream --tags`。
（此節之前的歷史條目寫的 `v2.x.y` 是當時本機 `refs/tags/` 裡的上游 tag，現在對應 `refs/upstream-tags/v2.x.y`。）
有新提交或檢查失敗時，`--strict` 回傳非零；排程 workflow 也會因此明確失敗。

## PR 關閉截止日與逐筆清單（2026-11-03 起）

`reviewed_pr_closed_before = 2026-10-28`（UTC）與 `reviewed_pr_through = 8086` 組成歷史覆蓋範圍：
編號不超過水位且在截止日前關閉的 PR 不報；截止日當天及之後關閉的 PR 一律報，
除非已在 `reviewed_pr_numbers`。合併 PR 由 release commit 軸處理。
查詢使用 `--search "is:unmerged closed:>=2026-10-28"` 並要求 `closedAt`，避免列舉全部歷史 PR。

截止日依據是 `12c5057c3`（2026-10-28）與下方同日兩批分類，當時 PR 水位到 7794；
`f24f0532c`（2026-11-03）另分類 15 筆至 8086，這 15 筆保留在逐筆清單。
選較早的截止日補抓當時仍 open、後來關閉的舊編號 PR，不把 11 月 3 日前的所有關閉事件視為已審。
截止日不是每次執行自動前移的日期；分類後先記錄逐筆判定與理由，再只把對應編號加入清單。

舊 baseline 沒有截止日欄位時維持原本的數字水位過濾，並排除逐筆清單（缺清單視為空）；
這條相容路徑仍無法捕捉水位以下後來關閉的 PR，因此出貨 baseline 必須帶截止日。
對真實上游（約 1883 筆 closed-unmerged PR）而言，未加日期篩選的 `is:unmerged` 查詢必定填滿 1000 筆頁面，所以舊路徑一律以「Not checked」（exit 2）結束：安全失敗，既不會灌出大量項目，也不會靜默通過。
查詢失敗或結果達 1000 筆上限仍報「Not checked」、exit 2；不可把截斷當成沒有待審。
性質測試讀取真實 baseline，驗證查詢帶日期篩選、索取 `closedAt`，且歷史資料超過上限時仍能完成近期 PR 軸。

2026-11-03 實跑（fork 基準 `13e0f0e453fb`）：`bun tools/check-upstream-updates.ts --strict`
完整列出 2 筆待審 PR：#7614（owned Windows CLI child lifetime）、#7618（separate Windows metadata toolchains）；
另有 209 筆待審 commit、0 筆新 platform issue，exit 1。PR 軸已檢查，沒有截斷；
紅燈來自實際待審項目，這兩筆當時尚未分類，不加入已審清單（2026-11-04 已逐筆判定並加入，見文末同日節）。

## 審查清冊

每次只做一次批次審查：

1. 讀 commit 主旨與變更檔案。
2. 判斷是否與 Windows gate、fork 文件、workflow guard 或測試衝突。
3. 本 fork 刻意維持壓縮歷史、不帶入上游歷史（2026-10-06 確認），所以不 merge 上游：整版同步用 `git diff refs/upstream-tags/<integrated_tag> refs/upstream-tags/<新 tag>` 套到 `main`（tag 命名空間見上節）；只需要部分修正時 cherry-pick 或最小重做。同步完成後推進 `tools/upstream_baseline.json` 的 `integrated_through`／`integrated_tag`。
4. 跑 `pwsh -NoProfile -File tools\dev_check.ps1`。產品檔有改再跑 `bun run typecheck` 與 `bun run test`。
5. 在 `docs/fork/DECISIONS.md` 記錄採用／略過理由。
6. 驗證完成後才把 baseline 推進到已審查的完整 40 字元 SHA。

Baseline 代表「已審查」，不代表「全部已合併」。

帳號池、provider、routing 的產品修正通常直接同步。workflow 變更必須核對官方-repo-only guard 是否仍在。

## 2026-08-22：fork 起點

本 fork 自上游 `main` `6ae83b1f189c353935d4977bb01227484fbdb52b`
（`release: v2.31.0`）建立。此 SHA 設為第一個 `reviewed_through`。
之後的上游 commit 才需要進入審查清冊。

## 上游的 PR、issue、分支：一次評估，之後只看增量

2026-08-22 對 `lidge-jun/opencodex` 做過一次整體盤點（**43 個 open PR、56 個 open issue、
71 個分支**，`main` 自本 fork 的 baseline 之後 0 個新 commit）。結論如下，之後不必重做。

### PR：不逐筆評估

43 個 open PR **全部** base 在 `dev`，那是上游的整合線；合併後會隨 release 進 `main`，
再由 commit 審查處理。逐筆看 PR 等於把同一份改動看兩次，而且看的是還會變的版本。

- 本 fork 的審查單位是 **`main` 上的 release commit**，不是 PR。
- 例外只有一種：某個 PR 動到本 fork 已改過的檔案（workflow guard、fork 文件、
  `tests/fork-guard.ts` 涵蓋的測試），那要在合併衝突時處理，不需要事前追。
  本次盤點的 43 個 PR 全部落在 `src/`、`gui/`、`docs-site/`，沒有一個動到上述檔案。

### 分支：比對過，不是只數數量

71 個分支中，扣掉 43 個 open PR 的 head 之後剩下的，逐一與 `main` 比對：全部都是 `codex/*`
功能線，內容不是已經在 open PR 裡，就是已併進 `dev` 等著隨 release 進 `main`。**沒有任何一條
帶著「沒進 PR、也沒進 dev」的獨佔修正**，所以分支這個面向沒有可引用的東西。

fork 只 fetch `main`（需要時才 fetch `dev`）。下次重看分支的觸發條件是：某個分支相對 `main`
有獨佔 commit 且**不屬於任何 open PR**——那才代表有東西被丟在分支上沒走流程。

### Issue：只追 `platform` 標籤，並記水位

56 個 open issue 大多是功能請求，會隨 release 進來。真正會改變「本 fork 要在 Windows 上
驗什麼」的是帶 `platform` 標籤的那些，所以只追這一類，其餘不追。

`tools/upstream_baseline.json` 的 `reviewed_issue_through` 記下已分流到哪個編號，
`check-upstream-updates.ts` 只報比它大的 `platform` issue——**同一個 issue 不會被問第二次**。
`gh` 不可用時報「未檢查」，不會假裝成「沒有待審」。

本次分流到 `#2379`（issue）與 `#2383`（PR，`reviewed_pr_through`：記下「PR 這條線盤點到哪」，
即使規則是不逐筆追，下次也才知道是從哪之後開始的新東西）。三筆與本 fork 直接相關的結論：

| Issue | 上游狀態 | 對本 fork 的意義 |
|---|---|---|
| [`#2152`](https://github.com/lidge-jun/opencodex/issues/2152) Windows CI 六個既有失敗 | open | **解釋了我們看到的現象**：`ci.yml` 的 `windows <shard>/4` job 條件是 `github.event_name == 'workflow_dispatch'`，平常（含上游）根本不跑，所以本 fork 的 Cross-platform CI 綠燈**不包含**那套 shard。本 fork 的 Windows 覆蓋來自 `keyring windows`、`npm-global windows-latest` 與自己的 `fork gate (windows-latest)`。不要把那個 skipped 當成壞掉。 |
| [`#2292`](https://github.com/lidge-jun/opencodex/issues/2292) `ocx sync --restart-codex` 後 Windows model picker 仍是舊清單 | open | 純 Windows 使用者體驗問題，正是本 fork 的主戰場。等上游修好隨 release 進來；本線不自行 patch。 |
| [`#1525`](https://github.com/lidge-jun/opencodex/issues/1525) Windows 系統 proxy 自動偵測 | open | 功能請求，與本 fork 的 Windows 服務情境相符，但屬產品功能，等上游。 |

其餘 `platform` 以外的 issue（帳號池、catalog、provider 相容性等）一律不追：它們的結果
會以 release commit 的形式送到審查清冊。

## 下一次要做什麼

目前水位只看 `tools/upstream_baseline.json`（`integrated_tag`、`reviewed_through`、`reviewed_date`），不要在這裡寫死日期或 commit：寫死的水位會過期（這一節曾停在 2026-09-08）。下一次只做增量檢查：

```powershell
git fetch --no-tags upstream "+refs/tags/*:refs/upstream-tags/*"
bun tools/check-upstream-updates.ts --strict
```

報告會同時列出新 stable tag 帶來的未審 commit、closed-unmerged PR 與水位之後的新 `platform` issue。處理完後推進相應水位，並把判斷寫進本檔。（2026-10-06 更正：fork 維持壓縮歷史、與上游沒有共同祖先，同步一律以 tag 間的 diff 套用，不建立 ancestry bridge，且絕不推送上游。）

## 2026-08-23 至 2026-10-03 的紀錄

v2.34.0 到 v2.76.0 之間的分組審查、replay 與 PR／issue 分流（本檔原第 135 至 1043 行）已逐字搬到 [`UPSTREAM-archive-2026-08-to-10.md`](UPSTREAM-archive-2026-08-to-10.md)，原因是檔案行數上限。搬移前後各節內容不變。

## 2026-10-03：stable 整合 v2.76.0（ancestry bridge；採用 4 筆候選）

前一條（同日）的 4 筆採用候選與「整棵採用 stable 的前提」已成立，本輪完成整合：
`sync/v2.76.0` 由 tag `v2.76.0`（`249462bf570555aad103957025eea96f7489c7eb`）長出，重放 `git diff v2.67.0 main` 的 fork overlay。
分支與上游共享 `v2.76.0` 為祖先，所以 `git merge-base sync/v2.76.0 upstream/main` 不再為空。逐項分類、手動解衝突的檔案與安全邊界逐檔判定見
[`DECISIONS.md`](DECISIONS.md) 同日條目。

### 採用狀態（前一條的候選 1–4）

| 候選 | commit | 狀態 |
| --- | --- | --- |
| 1 redaction ReDoS | `f5e9fdaba` | 已含在 `v2.76.0`（`src/lib/redact.ts` 的 XML 識別屬性掃描；fork 的換行 barrier 併存） |
| 2 Windows manager 指令 timeout | `89db85ff0` | 已含在 `v2.76.0`（`src/lib/winsw.ts`、`src/service/windows-scheduler.ts`） |
| 3 npm cache root（#6288） | `09cd45daa` | 已含在 `v2.76.0`（`src/update/npm-cache-preflight.mjs`、`transactional-install.mjs` 的 `--cache` pin） |
| 4 locale 日期括號（#6290） | `8a3a7762f` | 已含在 `v2.76.0`；最終形 `115fa0322`（`dev`，#6455）**不在** `v2.76.0`，已從 `upstream/dev` cherry-pick（`09bd49e31`），含 `tests/windows/windows-service-wrappers.test.ts` 與 `tests/fixtures/windows-standalone-pre-placeholder.cmd` |

下次 `v2.77.0`（或其後 stable）若已含 `115fa0322`，同步時該 commit 會乾淨地併入（內容相同）。

### 其他

- fork 專屬：`NO_MODEL_ARG`（`src/claude/agents-inject.ts`）改為要求省略 Agent `model` 參數（上游 `#6358` `not_planned`）。
- 新增上游 workflow `codex-queue-helpers.yml`：加官方 repo-only guard。
- 本輪沒有新增 PR／issue 審查；水位維持 `reviewed_through = v2.76.0`、PR `#6507`、issue `#6504`。
- 下次同步改走一般 merge：`git fetch --no-tags upstream main "+refs/tags/*:refs/upstream-tags/*" && bun tools/check-upstream-updates.ts --strict`。


## 2026-10-19：stable 整合 v2.88.0（`v2.76.0..v2.88.0`）

`sync/v2.88.0` 由 tag `v2.88.0`（`6936d9885d8a9bda9301737affcbaf1a4ff00e17`）長出，重放 `git diff v2.76.0 main` 的 fork overlay，方法同 2026-10-03 的 `v2.76.0` 整合，
逐項判定見 [`DECISIONS.md`](DECISIONS.md) 同日條目。要點：

- 52 個衝突檔：src 6 個（`bounded-file-read` add/add 並存、`shim-state-file`、`scripts/test.ts` 等）、workflow 1 個、zh-tw 文件 16 頁、GUI／語系 20 餘個、generated fixture 3 個（以上游為底補 fork 條目，`Cargo.lock` 取上游）。
- 語系：上游新增的 `pt` 與 6 份 `advisor.md` 譯本剃除；新增的 `desktop-compatibility-copy.ts` 縮為 en／zh-TW；寫死其他語系的上游測試改寫或刪除。
- 新 workflow：`catalog-async-contracts.yml` 保留執行；新增 fork 專屬 `fork-release-windows.yml`（`SanHsien/opencodex` guard，未簽章 MSI 附到 fork release）。
- 桌面自動更新停用：`createUpdaterArtifacts: false`、updater `endpoints: []`。
- 水位：`integrated_tag = v2.88.0`、`integrated_through`／`reviewed_through = 6936d9885`、`reviewed_date = 2026-10-19`；issue／PR 水位維持（`#6504`／`#6507`），本輪沒有新增 PR／issue 審查。
- 本機驗證限制：測試固定 Bun `1.4.3`（`package.json testRunnerBun`），本機只有 `1.4.2`，經 `scripts/test.ts` 的測試與 Windows symlink 權限案例（`keyring-smoke`）在本機無法通過，需在 CI 或安裝 Bun 1.4.3 後確認。

## 2026-10-23：stable 整合 v2.91.0（`v2.88.0..v2.91.0`）

`v2.91.0`（`83ec4f75a4cc97030c2fa7857e05e2ce222f376f`）整合，重放 `git diff v2.88.0 main` 的 fork overlay，方法同前兩次；逐項判定見 [`DECISIONS.md`](DECISIONS.md) 同日條目。要點：

- 上游 77 個 commit、873 個檔案變更；overlay 398 個刪除全數套用，251 個新增／修改以 3-way patch 套用，9 個衝突檔手動解（README 兩份、`astro.config.mjs`、4 頁 zh-tw 文件、test-layout 兩個 JSON 與 `test-runner.test.ts`）。
- 安全邊界：fork 加固與上游改動同檔者共 8 個，逐檔判定在 `DECISIONS.md`；`#7470`（AgentAssertion）與 B5（OAuth 登入／匯入、service／update、shim token）在 fork 沒有重疊修正的路徑一律採上游。
- 語系：沒有新增語系，非保留語系的更新隨刪除清單丟棄；上游新增的 `account-pause-display` 測試改為 en／zh-TW。
- 新 workflow `windows-signing-test.yml` 加官方 repo-only guard；`fork-release-windows.yml` 不變，MSI 仍未簽署，updater `endpoints` 仍為空。
- 水位：`integrated_tag = v2.91.0`、`integrated_through`／`reviewed_through = 83ec4f75a4cc97030c2fa7857e05e2ce222f376f`、`reviewed_date = 2026-10-23`；issue／PR 水位維持（`#6504`／`#6507`），本輪沒有新增 PR／issue 審查。
- 版本維持上游 `2.91.0`，發版 tag 為 `v2.91.0`（推 tag 時用 `git push origin <main SHA>:refs/tags/v2.91.0`；本機 `v2.91.0` 是上游的 tag）。
- 本機驗證（Windows，Bun `1.4.3` 作測試 runner）：`typecheck`（3 個 tsc）、`structure:check`、`privacy:scan`、`skill:surface:check`、`dev_check.ps1`、`gui` lint／build／`bun test --isolate tests`（3438 個測試；寫死 fr／ko 的 4 個 `account-pause-display` 案例改寫後該檔 6/6 通過）、`docs-site` build（149 頁、21005 個內部連結、0 錯誤）皆綠。完整 `bun run test` 160 批：本機失敗的測試檔（至少 70 個）在乾淨 `v2.91.0` 上同樣失敗（symlink EPERM、Claude Desktop／Codex 設定寫入鎖等環境問題），其餘 4 個檔單獨重跑兩邊皆過（負載造成的逾時）；fork 造成的失敗（zh-tw parity、file-size ratchet）已修。

## 2026-10-25：stable 整合 v2.92.0（`v2.91.0..v2.92.0`）

`v2.92.0`（`9f0d40a25f8b842c33ab233d466d0bd991d86052`）整合，方法同前（`git diff v2.91.0 v2.92.0` 以 3-way 套到 `main`）；逐項判定見 [`DECISIONS.md`](DECISIONS.md) 同日條目。要點：

- 46 個 commit、361 個檔案；排除非保留語系後 318 個檔案；3 個衝突檔（`src/router.ts`、zh-tw 兩頁 providers 文件）手動解。
- 水位：`integrated_tag = v2.92.0`、`integrated_through`／`reviewed_through = 9f0d40a2…`、`reviewed_date = 2026-10-25`；`reviewed_pr_through = 7713`、`reviewed_issue_through = 7716`（本輪完成 PR 與 platform issue 軸補審）。
- 檢查器修正：PR 清單上限 200 → 1000，且被截斷時回「未檢查」（原本會少列 206 筆）。
- 排程 CI：無 `dev` 的 fork 改測 main head。
- 下一次：`git fetch --no-tags upstream main "+refs/tags/*:refs/upstream-tags/*" && bun tools/check-upstream-updates.ts --strict`；`v2.93.0` 出版時一併重看 `#7527`／`#7659`。

## 2026-10-27：stable 整合 v2.93.0（`v2.92.0..v2.93.0`）

`v2.93.0`（`88aaa754566d119b6b8fc898f8fb47602387d82e`）整合，重放 `git diff v2.92.0 main` 的 fork overlay（刪除清單與 3-way patch 分開套）；逐項判定見 [`DECISIONS.md`](DECISIONS.md) 同日條目。要點：

- 上游 103 個 commit、694 個檔案；overlay 398 個刪除全數套用（另剃除上游重新帶回的 `docs-site/.../tr/` 10 頁），272 個新增／修改以 3-way patch 套用，12 個衝突檔手動解。
- 水位：`integrated_tag = v2.93.0`、`integrated_through`／`reviewed_through = 88aaa754…`、`reviewed_date = 2026-10-27`；`reviewed_pr_through = 7713`、`reviewed_issue_through = 7716` 維持（本輪沒有新增 PR／issue 審查）。
- `#7527`、`#7659` 隨版進來（2026-10-25 條目的觸發條件已成立）。
- 同日另有兩項 fork 修正隨同一次提交：更新路徑只認 fork releases、韓文剃除，見 [`DECISIONS.md`](DECISIONS.md)「更新路徑只認 fork releases」條目。



## 2026-10-28：上游 PR／issue 分類（無新 commit）

`reviewed_through` 仍是 `88aaa754566d119b6b8fc898f8fb47602387d82e`（上游 `main` 沒有新 commit）。本輪只分類 Upstream check 列出的新項目，水位改為 `reviewed_pr_through = 7783`、`reviewed_issue_through = 7834`。

上游未合併關閉的 PR（7 筆，fork 全部不採用，跟隨上游）：

| PR | 判定 |
| --- | --- |
| #7717 antigravity 多帳號模型探索 | 不採用：本機已停用 Antigravity provider（Antigravity 訂閱不給 agent 用），上游也未合併。 |
| #7727 WebSocket ingress replay 歸因 | 不採用：上游未合併，等上游正式修正。 |
| #7739 MiniMax Flash metadata（WRONG BRANCH） | 不採用：投錯分支；fork 不使用中國服務。 |
| #7752 reasoning_raw_delta／inlineThinkTagModels | 不採用：上游未合併（#7750 仍待上游處理）。 |
| #7755 GUI 顯示 Terra 記憶背景模型 | 不採用：上游未合併。 |
| #7765 Withdrawn | 不採用：作者撤回。 |
| #7783 PR fast lane 探針（WRONG BRANCH） | 不採用：上游 CI 測試用，非產品變更。 |

`platform` issue（7 筆，皆 open）：

| Issue | 判定 |
| --- | --- |
| #7756 macOS Homebrew Cask | 不適用：fork 只支援 Windows。 |
| #7771 Windows desktop 卡在 taking-over（npm 執行環境＋Task Scheduler 服務） | 相關：本機 2026-10-28 已移除指向舊 npm 安裝的 `\opencodex-proxy` 排程，現況只由 desktop 啟動，不重現；等上游修正，下次同步確認。 |
| #7808 Windows client path 接受無磁碟代號的根路徑 | 相關：等上游修正，下次同步確認。 |
| #7810 長 TEMP 路徑或本機代理運作時部分 CLI 測試失敗 | 相關：與本機完整測試的環境性失敗同類；等上游修正。 |
| #7815 config root 寫入與 ACL 加固重疊 | 相關：等上游修正，下次同步確認。 |
| #7827 start 在 liveness 探測漏判時復原仍在使用的 Codex journal | 相關：等上游修正，下次同步確認。 |
| #7834 atomicWriteFile 的 icacls 逾時記憶不會重置 | 相關：等上游修正，下次同步確認。 |

Windows 相關的 6 筆在下次同步時逐筆確認是否已隨版修正；未修正且影響本機使用的，才在 fork 自行處理並記入 `DECISIONS.md`。


## 2026-10-28（續）：上游 PR／issue 分類第二批

上游當天又關閉／開出一批，水位改為 `reviewed_pr_through = 7794`、`reviewed_issue_through = 7860`。

- PR #7785–#7794（10 筆，jsonc／search／retry／adapters／lib／config／streams 小修正）：上游未直接合併，而是由 #7821 一次 squash 帶進 `dev`（504417f0e）。判定：不另行採用，隨上游下一個穩定版進來。
- Issue #7854（Windows hosted runner 上 desktop-compatibility build probe 的 PowerShell 子行程 10 秒逾時）：相關（fork 只跑 Windows CI）；等上游修正，下次同步確認。
- Issue #7860（macOS app-bundle 執行驗證）：不適用，fork 只支援 Windows。

## 2026-10-28：Windows-only 刪除清單（下次同步照這份處理）

本 fork 從這一天起只支援 Windows，macOS／Linux 專屬檔案與 CI 以檔案層級移除（理由見 [`DECISIONS.md`](DECISIONS.md) 同日條目）。下次同步的做法：

1. **先套刪除清單**：清單的唯一來源是 `tools/fork-hygiene-guards.ts` 的 `REMOVED_DIRECTORIES`（`app`、`docker`）與 `REMOVED_FILES`。重放 `git diff <integrated_tag> main` 時這些刪除會自動帶上；上游若在新 tag 改動了這些檔案，刪除優先，不要為了讓 patch 乾淨而還原。
2. **新增的 macOS／Linux 專屬檔案**：上游新 tag 若又加了同類檔案（launchd／systemd 打包、`.sh` 安裝器、Swift、Docker、只在非 Windows 跑的測試、只服務它們的 docs 頁），照同一規則刪除並補進 `REMOVED_FILES`；被共用 source 靜態 import 的 launchd／systemd／darwin／linux 模組不要刪。
3. **會與上游衝突的檔案內編輯**（3-way patch 時手動解，原則是取上游為底、重新套掉 macOS／Linux 部分）：`.github/workflows/ci.yml`（移除 `test`、`storage-policy`、`api-usage`、`platform-macos`、`macos-control`、`docker-smoke`、`npm-global-smoke`、`widget`、`desktop-shell` 與其 filter／aggregate gate 條目；`keyring-smoke` 只跑 Windows）、`service-lifecycle.yml`、`desktop-installed-gate.yml`、`codex-queue-helpers.yml`、`catalog-async-contracts.yml`、`package.json`／`desktop/package.json` 的 script 條目、`docs-site/astro.config.mjs` 側欄、`remote-hub` 兩頁、`structure/` 的數個章節、以及 `tests/ci-workflows/` 內被改過的測試（`ci-scope-gaps`、`ci-review-lanes`、`ci-workflows`、`ci-structure-gate`、`installed-gate-drivers`、`install-scripts`、`release-desktop-scripts`、`keyring-smoke`、`docs-*`、`cold-spawn-warmup`）。
4. **`release.yml` 原樣照上游**：它是官方 repo 專用線，不改；其中 macOS／Linux 腿和已刪腳本（`build-widget.sh`、`verify-*`、`appimage-patchelf.py`）的引用在 fork 是死碼。`fork-hygiene` 的非 Windows runner 標籤檢查對它例外。
5. **同步後驗證**：`bun test tests/ci-workflows/fork-hygiene.test.ts` 會在任何被刪路徑、被刪 job 或 `macos-*`／`opencodex-gate-(macos|linux)` runner 標籤回來時失敗；再跑 `bun run structure:check`、`tests/test-layout*.test.ts`，並從 `scripts/test-layout/*.json`、`tests/fixtures/test-layout-expected.json`、`scripts/ci/test-durations*.tsv` 移除新被刪測試的條目。

## 2026-11-03：Upstream check PR／issue 分類；commit 軸仍待審

開工確認最新 [Upstream check run 41430272684](https://github.com/SanHsien/opencodex/actions/runs/41430272684) 為 failure，HEAD 為 `91a176f94bb20c3059ba6f870a0d8958b4b11abb`。本機 strict 檢查另列出 209 筆新 commit（上游 main `684ad75d254ae96a9971387d09ae428b96ada9c2`）、15 筆 closed-unmerged PR、0 筆新 open platform issue。逐筆讀取下表 PR 本文與留言後，PR 水位由 7794 推到 8086；issue 無新增，水位保持 7860，不能虛增。

2026-11-03 僅分類，沒有採用產品 diff。`reviewed_through` 保持 `88aaa754566d119b6b8fc898f8fb47602387d82e`，`integrated_tag` 保持 v2.93.0，`integrated_through` 不變；`reviewed_date` 保持 2026-10-28（它跟著 commit 軸推進）。最新 stable 已為 v2.96.0，但整版整合屬另一個路線圖項目。strict 的 commit 軸仍為紅，不能以票單分類代替 commit 審查；原路線圖列保留，未達整列驗收。

| PR | 判定與理由 |
| --- | --- |
| [#7843](https://github.com/lidge-jun/opencodex/pull/7843) atomic writer ACL timeout memo | 不另採原 PR：上游已由 #7891（c7f3928a21）重作並關閉原案；含額外子行程退出保護，隨 stable 整合，避免覆蓋較完整版本。 |
| [#7863](https://github.com/lidge-jun/opencodex/pull/7863) Hermes／Command Code alias | 不另採：作者確認由 #7867（3b8414d3d）取代；原分支後續修正不等於上游已接受，隨正式版本整合。 |
| [#7879](https://github.com/lidge-jun/opencodex/pull/7879) protected-tree 路徑元件 | 不另採：上游明示重複於 #7884（463a0ee0b），隨 stable 取正式修正。 |
| [#7895](https://github.com/lidge-jun/opencodex/pull/7895) TensorFold tool rejection | 暫不採：closed、未合併；涉及翻譯 adapter 的終止與用量語意，沒有足夠依據把未接受實作帶入 fork，等上游正式方案。 |
| [#7906](https://github.com/lidge-jun/opencodex/pull/7906) Claude CLI schema offline fixtures | 不採：closed、未合併、intake: hygiene-blocked，且沒有有效需求說明；不能把 fixture 分支當正式修正。 |
| [#7932](https://github.com/lidge-jun/opencodex/pull/7932) Windows test timing | 暫不採：closed、未合併；調整管理回應與 stream fixture 的時間預算，未證明對本 fork 目前 shard 2／7 問題有效，不藉此放寬測試。 |
| [#7933](https://github.com/lidge-jun/opencodex/pull/7933) release 2.94.0 | 不採：上游明示被 #7940 的新 frozen tip 取代；fork 只按 stable tag diff 整合，不重放上游 promotion PR。 |
| [#7953](https://github.com/lidge-jun/opencodex/pull/7953) Azure include | 不另採：上游 carry #7988（d389699c96）已落 dev；隨 stable 取正式版本。 |
| [#7962](https://github.com/lidge-jun/opencodex/pull/7962) CR-delimited sidecar SSE | 不另採：上游 carry #7989（d42b9b1b23）已落 dev；隨 stable 取正式版本。 |
| [#7969](https://github.com/lidge-jun/opencodex/pull/7969) Meta Muse tool catalog | 不另採：carry #7985（1e1620f3d9）另修歷史 catalog 驗證邊界；原 PR 不如正式版本完整，隨 stable 整合。 |
| [#7971](https://github.com/lidge-jun/opencodex/pull/7971) routed slug | 不另採：carry #7979（d82d7ee739）另保留 retained-id 優先序；隨 stable 取正式版本。 |
| [#8028](https://github.com/lidge-jun/opencodex/pull/8028) Claude session pool affinity | 不採原機制：上游 #8094（b14a35afe）改用 principal-scoped 私有身分，避免把 session headers 帶往其他讀取路徑；等包含該 carry 的 stable。只有 x-session-id 的直接 Responses 路徑仍未涵蓋。 |
| [#8056](https://github.com/lidge-jun/opencodex/pull/8056) Anthropic Ultra quota | 不另採：原 PR closed、未合併；main 已有 #8055（e972776ec）的 quota／subscription names 正式實作，隨 stable 整合，不疊加競爭版本。 |
| [#8073](https://github.com/lidge-jun/opencodex/pull/8073) T3 Code 文件 | 不採：作者明示暫不繼續整合並關閉；保留正式文件，避免把個別部署觀察當通用契約。 |
| [#8086](https://github.com/lidge-jun/opencodex/pull/8086) LLMTR free directory | 暫不採：closed、未合併；免費配額與供應商入口尚未成為上游正式目錄，不在 fork 自行增加。 |

Windows 指定 issue 複查（讀取 issue 本文與維護者留言）：

- [#7771](https://github.com/lidge-jun/opencodex/issues/7771)：仍 open。#7973（db7bdc5e3d）只完成拒絕原因診斷；Task Scheduler wrapper 存活／重啟與 Desktop taking-over 死路仍未解，不能記為已修復。
- [#7808](https://github.com/lidge-jun/opencodex/issues/7808)：closed，#7824（07161c5b95）在 dev 拒絕 Windows 無磁碟代號根路徑；尚未整合至本 fork 的 v2.93.0 基底。
- [#7810](https://github.com/lidge-jun/opencodex/issues/7810)：closed；#7823（95cfa30ec7）修 long-TEMP recovery，#7852（fb22d055e0）隔離 Windows Known Folder fixture。上游已完整修復，尚待 stable 整合進 fork；不再沿用「純環境性失敗」歸因。


## 2026-11-03：stable 整合的獨立前置區段（#7795、#7781）

以 GitHub release 清單複查：最新 stable 仍為 v2.96.0（2026-11-01），上游 main 為 `684ad75d254ae96a9971387d09ae428b96ada9c2`。`v2.93.0..upstream/main` 共 209 筆；`v2.93.0..v2.94.0` 涉及 1198 個檔案。先完成下列兩筆獨立判定與最小產品修正，沒有宣稱整版已整合。

| Commit | 判定 | 逐筆核對與理由 |
| --- | --- | --- |
| `736fa5087c0b807cc2c7fd54ebae1548e6b2d4cb` | skip（已具備） | #7795 僅把 package、Cargo manifest／lock 與 Tauri 產品版本升到 2.94.0；四處已具備此版本。不重放整個檔案，保留 fork 關閉 updater 與 Cargo 安全修正。 |
| `dd8bf1d657577c889169b8cb34afd6ff28341284` | adopt | #7781 完整五檔 diff：新增 rollback admission helper，替換 CLI apply、management apply 與 native toggle 三個呼叫點；測試新增 timeout／unexpected error／success 三條性質，另補 model-defaults barrier-entry handshake。原 ACL barrier、診斷遮罩與其他 fork 修改保留。 |

停止點是 `dd8bf1d65`，下一筆為 `f94e95ce5`（structural tool turns）。這是逐筆審查的停止點，**不是可推進的 main 水位**：`git merge-base --is-ancestor v2.93.0 dd8bf1d65` exit 1，`dd8bf1d65..v2.93.0` 尚有 189 筆歷史 commit。把 scalar 水位改成該來源分支 SHA 會使檢查器重報舊項目。因此 `reviewed_through`、`reviewed_date`、`integrated_tag`、`integrated_through` 全部保持；其餘 207 筆仍需審查，strict 仍列出 209 筆（包含已在本節記錄的兩筆）。PR／issue 水位也不變。完整 tag 整合須接續審查並保留 Windows-only 刪除清單。

安全邊界逐檔判定與回歸證據見 `DECISIONS.md`、`REVIEW.md` 同日區段。


## 2026-11-03：獨立整合區段（#7561 defer、#7726 adopt）

GitHub release 清單複查最新 stable 為 v2.96.0（2026-11-01），符合 stable 整合觸發條件。
以 `083465382` 為 fork 基準，接續前節的兩筆判定：

| Commit | 判定 | 範圍與理由 |
| --- | --- | --- |
| `f94e95ce5`（#7561） | defer（2026-11-05 已改採用，見文末同日節；此列保留當時判定） | 31 檔、885 行新增，包含 Responses 結構重排、durable principal、HMAC membership、ingress 與 adapter 投影。已讀 scope 清單、`src/server/auth-cors.ts` 與兩個 turn-membership 模組；尚未完成其餘完整 diff／安全審查與跨 ingress 回歸，不採部分身分鏈、不計為完成程式碼審查。補審範圍只在 `ROADMAP.md` 追蹤。 |
| `42549ba1b00a7fe792f0c1d87771845ca538c472`（#7726） | adopt | 完整讀取五檔 diff；採用 Runcrate 目錄、獨立測試與兩份 layout 登錄及 fixture。測試的驗證日期改驗 ISO 日期格式，避免釘住會更新的快照日期；模型 id 仍驗正式六筆 seed。同步英／繁中使用說明及 structure 合約。 |

這是可獨立成立的目錄區段，沒有重放整版產品。先核對 Windows-only 刪除清單：
此 commit 沒有新增已移除平台路徑／workflow、語系或安裝腳本，所有 fork overlay 保留。
官方 Chat Completions 文件確認 API root；免費額度資料沿用上游 2026-10-27 的驗證快照，
不把它改寫為 2026-11-03 的免費條款 live 驗證。沒有呼叫付費推論或使用登入資料。

逐筆游標到 `42549ba1b`；下一筆是 `15b38cb0e`。`f94e95ce5` 的 defer 另行保留，
不能因游標向前就當作採用或完整審查完成。兩個來源 SHA 都不是目前 main scalar 的可替代基準，
且本段沒有整合完整 stable tag，因此 `reviewed_through`／`reviewed_date`、`integrated_tag`／
`integrated_through` 全部不變；PR／issue 水位也不變。整版整合列保留。
驗證結果見 `REVIEW.md`，逐檔邊界判定見 `DECISIONS.md` 同日區段。


## 2026-11-03：v2.96.0 逐筆分類清冊（205 筆）

範圍以 `git log --reverse --topo-order --stat v2.93.0..v2.96.0` 為準：209 筆中，前四筆
`736fa5087`、`dd8bf1d65`、`f94e95ce5`、`42549ba1b` 已於前兩節逐筆記錄；其餘從
`15b38cb0e` 至 `v2.96.0`（`684ad75d254ae96a9971387d09ae428b96ada9c2`）共 205 筆如下。
不可用 `15b38cb0e^..v2.96.0` 代替：兩條發版 ancestry 不同，該集合另含已處理的舊歷史，共 394 筆。
2026-11-03 以 GitHub release 清單確認 v2.96.0 為最新 stable（2026-11-01 發布）。

本表是主旨、逐檔 stat 與功能依賴的分類判定，**不是每個 defer 的完整 diff／安全審查通過證明**。
`skip` 表示不重放；`defer` 表示保留採用／依賴審查，不表示不存在缺陷或已有等價修正。
檔案 identity 與 long-TEMP 差異另依下方實作證據記錄；前兩節已採用者的歸屬保持。
純測試 skip 不刪除 fork 測試，也不承諾永遠拒收；若相關產品改動採用，須重新核對配套測試。
「只分類、未審」不是 defer 審查結論；沒有逐筆 fork 證據就不推進 reviewed 水位。

Windows-only 刪除清單、英／繁中語系、官方 workflow guard、fork 更新來源與隱私／ACL 防線
均不重放。發版封裝六筆另外比對 promotion tree 與 frozen tip，再比 merge tree 與 promotion，
三組 `git diff --shortstat` 都是空，故不把 merge 當作另一批產品修正。

分類狀態合計（2026-11-04）：defer 52、只分類、未審 104、skip 42、adopt 1、已審：採用 6（含 2026-11-03 兩筆與本日四筆）；候選 skip／defer 不代表已完成 fork 等價審查。2026-11-05 另有 `67bdeb03a`、`fb22d055e`、`07161c5b9` 三筆改為已審：採用（本行合計未重算，逐筆以各列為準）。

| Commit（主旨） | 類別 | 判定 | 一句理由 |
| --- | --- | --- | --- |
| `15b38cb0e2a64b258ec6e56f931cfb5a4baff532` chore(ci): take every Bun pin from package.json (#7818) | CI／工具鏈 | defer | Bun pin 涉及 workflow、型別與 lockfile；fork 保留官方 repo guard，工具鏈變更另做安全審查。 |
| `2b5148b124cb012e039bbec76ed7daaa42c43515` fix(xai): publish the subscription lane's widest context rung for Grok 4.5-4.7 (#7701) | 需要採用的修正 | 只分類、未審 | 僅依主旨與 stat 分類，尚無 fork 對應檔案:行號與觸發條件；原候選分類不構成採用或略過判定。 |
| `9a757f540857c6bf352fce561660c8072805814c` perf(google): avoid rescanning fragmented SSE records (#7766) | 需要採用的修正 | 只分類、未審 | 僅依主旨與 stat 分類，尚無 fork 對應檔案:行號與觸發條件；原候選分類不構成採用或略過判定。 |
| `e72f5d666e46dbed778e3708d75d7a4f0d65335f` fix(claude): expire idle picker uploads while preserving backpressure (#7784) | 需要採用的修正 | 只分類、未審 | 僅依主旨與 stat 分類，尚無 fork 對應檔案:行號與觸發條件；原候選分類不構成採用或略過判定。 |
| `962546affc489f476d751d7688a9c0be3e8a1f25` fix(openai-chat): preserve native Mistral thinking on replay (#7814) | 需要採用的修正 | 只分類、未審 | 僅依主旨與 stat 分類，尚無 fork 對應檔案:行號與觸發條件；原候選分類不構成採用或略過判定。 |
| `1fe3dd758fc102c648a8ff587714cbb7a5a9d97c` fix(windows): preserve bounded ACL failure diagnostics (#7773) | 需要採用的修正 | defer | ACL 診斷重構超過千行；須與 853508eb6、12c0ec6ed 的 ACL 鏈一起審，保留遮罩與有界輸出。 |
| `d9f594b01106522621123bb58cd3588934f14abd` feat(integrations): refresh connected Hermes configs after catalog changes (#7704) (#7719) | 依賴／跨模組大功能 | 只分類、未審 | 僅依主旨與 stat 分類，尚無 fork 對應檔案:行號與觸發條件；原候選分類不構成採用或略過判定。 |
| `04f1988ffc97c3a0cec816c8526abfcd3328a9bc` fix(claude): preserve append-only client tool discovery on opted-in Responses routes (#7453) | 依賴／跨模組大功能 | 只分類、未審 | 僅依主旨與 stat 分類，尚無 fork 對應檔案:行號與觸發條件；原候選分類不構成採用或略過判定。 |
| `d519ab07bfc2db1bf60e7a9fef5fc947a4a483f3` fix(responses): frame retained requests before portable compaction checkpoints (#7822) | 需要採用的修正 | 只分類、未審 | 僅依主旨與 stat 分類，尚無 fork 對應檔案:行號與觸發條件；原候選分類不構成採用或略過判定。 |
| `e25be531f066cd639087f85f8f738aad95e72b3d` fix(combos): scope cooldown reprobes to reserving request (#7764) | 需要採用的修正 | 只分類、未審 | 僅依主旨與 stat 分類，尚無 fork 對應檔案:行號與觸發條件；原候選分類不構成採用或略過判定。 |
| `377fa522379111c2661f352ce6fc260780e530fe` test(providers): fix ASL server fixture cleanup and budgets (#7778) | 純測試 | skip | 僅調整 `tests/providers/aistupidlevel-provider.test.ts` 等測試 fixture／斷言／預算；產品不變，保留 fork 現有回歸，不整批覆蓋測試。 |
| `98e6f0c72206de16b66ed88da7099e52d8e8a566` fix(google): honor Retry-After floor and recognize the Cloud Code Assist ToS account ban (#7819) | 需要採用的修正 | 只分類、未審 | 僅依主旨與 stat 分類，尚無 fork 對應檔案:行號與觸發條件；原候選分類不構成採用或略過判定。 |
| `102ccee612414da8b0c18f0c682afea1dc00e8b9` fix(providers): guard MiniMax seed refresh by destination (#7829) | fork 刻意不收的功能面 | skip | MiniMax 目的地修正屬未使用的中國供應商，fork 不擴充此功能面。 |
| `1112f5b958797b0e49e6b9fc1bd838ac555b59b0` fix(qoder): forward Qoder CN images through shared coding-agent projection (#7536) | 需要採用的修正 | defer | Qoder CN 圖片轉接包含共用 coding-agent 投影，不能只憑 CN 功能不使用而跳過共用差異審查。 |
| `4118b90ba40076c62af66fd922421943204bb041` feat(codex): add confirmed POSIX CLI updates and durable job status (#7586) | 依賴／跨模組大功能 | defer | POSIX 更新不是 Windows 需求，但此 75 檔提交亦建立 Windows updater 共用基礎，須與 8178745ba／63820c415／c655484d9 成套審查。 |
| `41bd7e45ebe9f1ed0dfc45900146c6b2c5c3ea1b` fix(startup): verify live Desktop recovery before CLI cold start (#7797) | 依賴／跨模組大功能 | defer | Desktop recovery 同時更動 Rust supervisor 與 CLI 活性證據，須以 Windows 冷啟動／復原流程驗收。 |
| `95cfa30ec72f201818b1c80ff9b03fe70c7a8a0e` fix(windows): support long compaction recovery paths (#7823) | Windows 路徑修正 | adopt | src/codex/ocx-compaction-history.ts:17,83：backup／temp 路徑超過 MAX_PATH 時，在 ACL 呼叫使用 toNamespacedPath；原 path memo key 保持，先紅後綠見 REVIEW.md。 |
| `0c32c8132d0fd2731e8f772aac1b62874e8041a0` fix(claude): expose native Fast selectors with 1M context (#7748) | 需要採用的修正 | 只分類、未審 | 僅依主旨與 stat 分類，尚無 fork 對應檔案:行號與觸發條件；原候選分類不構成採用或略過判定。 |
| `e04aae068e0a920bc1badf2b7f2ab947159f682a` fix(anthropic): align Claude Code 2.1.280 OAuth profile and isolate session/device IDs (#7838) | 需要採用的修正 | defer | OAuth profile、device/session identity 與多個轉送入口同改，須逐檔審查憑證與身分隔離。 |
| `ba880dfaecce0c3abff383a39c6ee05056d8993c` fix(codex): isolate pooled installation IDs, scrub turn-state on account switch, and align JSON token refresh (#7840) | 需要採用的修正 | defer | 帳號切換 scrub 與 installation identity 必須和 007dbfd89 最終修正一起核對，不能只採中間狀態。 |
| `1d91861dc6077073987a3d306f3cc2e21f432add` fix(google,cursor): isolate Antigravity session/replay and Cursor H2 pool/JWT sub scope (#7842) | 需要採用的修正 | defer | 雖停用 Antigravity，此提交也改 Cursor H2／JWT scope；不能整筆當作不使用的 provider 略過。 |
| `f4a3312ffa1ca95456570936f8e9d301445e8ec9` fix(oauth): harden multi-account pool cooldowns, affinity eviction, and deactivated exclusion (#7844) | 需要採用的修正 | defer | 跨 provider OAuth failover 與停用帳號政策，須驗證 affinity／cooldown 不跨帳號污染。 |
| `48a0f9eca8232ffa06a206ad1347308b36566494` fix(zed): relay OpenAI tool calls instead of ending on the first sentence (#7599) | 依賴／跨模組大功能 | 只分類、未審 | 僅依主旨與 stat 分類，尚無 fork 對應檔案:行號與觸發條件；原候選分類不構成採用或略過判定。 |
| `c4dbcc0ae74d8edfdc3d1df3512db24f46e9ace9` fix(service): explain elevated scheduler uninstall failures on Windows (#7825) | 需要採用的修正 | 只分類、未審 | 僅依主旨與 stat 分類，尚無 fork 對應檔案:行號與觸發條件；原候選分類不構成採用或略過判定。 |
| `7deb359ff2b60cacb1b599dce1f4f0a962c6ede4` fix(logs): preserve replay refusal attribution on WebSocket ingress (#7830) | 需要採用的修正 | 只分類、未審 | 僅依主旨與 stat 分類，尚無 fork 對應檔案:行號與觸發條件；原候選分類不構成採用或略過判定。 |
| `a5ecb912928df697ec0bb0645ff74e6e121b8a5a` test(messaging): reserve distinct remote fixture ports (#7820) | 純測試 | skip | 僅調整 `tests/codex-integration/messaging-remote-send.test.ts` 等測試 fixture／斷言／預算；產品不變，保留 fork 現有回歸，不整批覆蓋測試。 |
| `611f403dec6e71d53fd6e41f375bdc5ec134d056` docs(gui): clarify subagent spawn_agent fill behavior in order hint (#7537) | 純文件／i18n | skip | 純 subagent order hint 與 tooltip 測試；fork 不維護德文，保留英／繁中現有提示（gui/src/i18n/en.ts、zh-TW.ts 的 orderHint），不涉及 spawn_agent 實作或 picker 排序。 |
| `3481acea5a758d14ecf0e5d06a73f0206195b363` fix(chat): deliver upstream raw reasoning to Chat clients without a generation opt-in (#7833) | 需要採用的修正 | 只分類、未審 | 僅依主旨與 stat 分類，尚無 fork 對應檔案:行號與觸發條件；原候選分類不構成採用或略過判定。 |
| `c5c21962d1d682db7c664286661b9315dfa576ac` fix(antigravity): request quota summary with the CLI fingerprint so Argon usage shows (#7804) | fork 刻意不收的功能面 | skip | Antigravity quota fingerprint 功能面已停用；不為不可用路線引入額外辨識資訊。 |
| `343c87bcfb3f6ced3f5e349656ff52c755ff02fd` fix(antigravity): consolidate multi-account discovery and model-denial routing (#7835) | fork 刻意不收的功能面 | skip | Antigravity discovery／model-denial 路由功能面已停用；不擴充該路線。 |
| `8145d52f9020bc4ef0c08cafbce59a905e9c64d4` fix(responses): enforce required tools in native combo streams (#7831) | 依賴／跨模組大功能 | 只分類、未審 | 僅依主旨與 stat 分類，尚無 fork 對應檔案:行號與觸發條件；原候選分類不構成採用或略過判定。 |
| `38fcb22c5ddf2e9653e181615fff810939f449b3` fix(server): reclaim inbound body capacity with a configurable budget (#7428) | 依賴／跨模組大功能 | 只分類、未審 | 僅依主旨與 stat 分類，尚無 fork 對應檔案:行號與觸發條件；原候選分類不構成採用或略過判定。 |
| `dc0ed96077bbb7d2b631db7bb0593f171664c4e3` docs(agents): treat lane=all as a batched dev check, not a per-PR gate (#7855) | 純 docs／文件登錄 | skip | 僅文件或其 layout／structure 登錄（`AGENTS.md`）；不重放上游多語系或以其驗收聲明取代 fork 證據。 |
| `a09e882ae5c12125a02f35b5fe8418fa76599246` fix(cli): attest connected-stop preflight reads (#7762) | 需要採用的修正 | 只分類、未審 | 僅依主旨與 stat 分類，尚無 fork 對應檔案:行號與觸發條件；原候選分類不構成採用或略過判定。 |
| `d9ae8e595eab2db76a00b844e8cb22abc0fc2df7` fix(anthropic): keep pool session affinity across restarts and transient detours (#7828) | 需要採用的修正 | 只分類、未審 | 僅依主旨與 stat 分類，尚無 fork 對應檔案:行號與觸發條件；原候選分類不構成採用或略過判定。 |
| `0fc96b02793180ba2d3c7011830917679da38ee6` feat(claude): label routed /v1/models rows from modelDisplayNames (#7817) | 功能新增（feat） | 只分類、未審 | 新增 routed /v1/models 顯示名稱功能，非 bug fix；需核對 src/claude/model-info.ts 與 modelDisplayNames 的 fork 對應行為。 |
| `ce608abc03ddf33d4375dfe818a7ac0ebdfacccc` docs: keep the provider configuration reference under the file-size cap (#7856) | 純 docs／文件登錄 | skip | 僅文件或其 layout／structure 登錄（`docs-site/src/content/docs/reference/configuration/providers.md`）；不重放上游多語系或以其驗收聲明取代 fork 證據。 |
| `338bcf53194d903ceb70864d33275e0413949241` fix(codex): preserve native source priority behind featured subagent models (#7839) | 依賴／跨模組大功能 | 只分類、未審 | 僅依主旨與 stat 分類，尚無 fork 對應檔案:行號與觸發條件；原候選分類不構成採用或略過判定。 |
| `86da61358616e0b3d3b9d01c277989cc21d586cc` fix(codex): keep native main available after keyring migration (#7774) | 依賴／跨模組大功能 | 只分類、未審 | 僅依主旨與 stat 分類，尚無 fork 對應檔案:行號與觸發條件；原候選分類不構成採用或略過判定。 |
| `b33fc566561ca714c5b521eb4efbed33028ef1d1` feat(cli): add `ocx codex` launcher mirroring `ocx claude` (#7346) | 依賴／跨模組大功能 | 只分類、未審 | 僅依主旨與 stat 分類，尚無 fork 對應檔案:行號與觸發條件；原候選分類不構成採用或略過判定。 |
| `6bc511d1b5f74160cf07e7a90a5e28a53d8d59e8` fix(windows): gate config and Desktop writer phases on config-root ACL settlement (#7826) | 需要採用的修正 | defer | config-root ACL writer barrier 涉及既有 fork 加固，與 fdc6dd82d／19ab11394 成組補安全審查。 |
| `abc932d1434f85e7aa9714d5a43b1d5374792cc0` fix(desktop): provide paired authority for compatibility controls (#7775) | 依賴／跨模組大功能 | 只分類、未審 | 僅依主旨與 stat 分類，尚無 fork 對應檔案:行號與觸發條件；原候選分類不構成採用或略過判定。 |
| `f7b4fd6c79122fbb931ddd55446682d7a05390ec` feat(link): Windows Remote Link Children and Child credential/connection attestation (#7832) | 依賴／跨模組大功能 | defer | Remote Link 新增 Windows Child 憑證與 attestation，須整體審查信任鏈與停止還原流程。 |
| `a4e4cda1deb6f396023f74aab541ffc2ea52db03` test: stop rebinding released loopback ports (#7847) | 純測試 | skip | 僅調整 `tests/claude-integration/claude-intercept-proxy-auth.test.ts` 等測試 fixture／斷言／預算；產品不變，保留 fork 現有回歸，不整批覆蓋測試。 |
| `504417f0efdc4e56dc835704b263fb14dc062fe3` fix: land ten small jsonc, search, retry, plain-data and stream fixes (#7821) | 需要採用的修正 | defer | 十項修正混合於同一提交，不能當單一獨立低風險修正；須拆檢 JSONC／retry／stream 各合約。 |
| `0eb589768265abb8b896f352991f98cf2c704ddf` fix(responses): recognize exact case-insensitive media types (#7768) | 需要採用的修正 | 只分類、未審 | 僅依主旨與 stat 分類，尚無 fork 對應檔案:行號與觸發條件；原候選分類不構成採用或略過判定。 |
| `96f2f47725b278ff4a9d9fc61d8847a149eb8e8b` feat(codex): restore LazyCodex role models from a change history (#7693) | 依賴／跨模組大功能 | 只分類、未審 | 僅依主旨與 stat 分類，尚無 fork 對應檔案:行號與觸發條件；原候選分類不構成採用或略過判定。 |
| `4bf5728ff3e18697d2a990d64785fc6f20948152` fix(dsh): export a known output limit as `maxTokens` (#7763) | 需要採用的修正 | 只分類、未審 | 僅依主旨與 stat 分類，尚無 fork 對應檔案:行號與觸發條件；原候選分類不構成採用或略過判定。 |
| `e1976daf13fe2221d0dbf761f32d72b063d8f330` fix(advisor): preserve captured caller admission scope (#7718) | 依賴／跨模組大功能 | 只分類、未審 | 僅依主旨與 stat 分類，尚無 fork 對應檔案:行號與觸發條件；原候選分類不構成採用或略過判定。 |
| `1997c69c5c10a467ed9c6322b9d2ceb308bbb37a` fix(openai-chat): keep captured usage on an invalid negotiated completion (#7849) | 需要採用的修正 | 只分類、未審 | 僅依主旨與 stat 分類，尚無 fork 對應檔案:行號與觸發條件；原候選分類不構成採用或略過判定。 |
| `fb22d055e0dc39e076dec9272052fb298409ec19` test: isolate Windows fixture children from the account-wide runtime namespace (#7852) | 需要採用的修正（測試隔離） | 已審：採用（兩個測試檔適配、一個不適用） | 2026-11-05 補審，見文末同日節：preload／owner helper 與 catalog 測試原樣採用，`sibling-home-client-sync` 手動適配，`cli-start-auxiliary-bind` 不適用（依賴 `a4e4cda1d`）。 |
| `8178745ba4d3ba3af780a30af3944f4221c38eeb` feat(codex): add proof-bound Windows CLI update planning (#7596) | 依賴／跨模組大功能 | defer | 依賴 4118b90ba 的更新基礎；Windows proof-bound planning 必須和 protected store／apply 交易成套驗收。 |
| `4cdcb50d9d318302777840cb5906feae66d37edd` perf(tooling): use Bun 1.4.4 native type checking (#7632) | CI／工具鏈 | defer | 改型別檢查器與 package 工具鏈，分類為工具鏈而非純效能修正，須另驗三個工作區型別檢查。 |
| `a18de03d4dfc76c72da062a3c98f9000161a1ddf` feat(clients): add T3 Code as an export and integration client (#7529) | 依賴／跨模組大功能 | 只分類、未審 | 僅依主旨與 stat 分類，尚無 fork 對應檔案:行號與觸發條件；原候選分類不構成採用或略過判定。 |
| `c0014da53f428f349237112ad4ecf46f09a57b47` fix(codex): validate macOS app trust at execution boundaries (#7758) | 需要採用的修正 | defer | 主題為 macOS trust，但修改共用 exec-boundary／runtime／workspace；Windows-only 不代表可整筆跳過。 |
| `4b2fc8dea945caf1ee5c7a2734d48468713f818a` test: assert the specific refusal gate in the fixture preload tests (#7861) | 純測試 | skip | 僅調整 `tests/ci-workflows/fixture-windows-runtime-preload.test.ts` 等測試 fixture／斷言／預算；產品不變，保留 fork 現有回歸，不整批覆蓋測試。 |
| `f26d6e8177ef85ff99cf62c6c346bf52ed5944a4` fix(responses): preserve combo replay-refusal attribution (#7864) | 需要採用的修正 | 只分類、未審 | 僅依主旨與 stat 分類，尚無 fork 對應檔案:行號與觸發條件；原候選分類不構成採用或略過判定。 |
| `aef4b6a9231bf5166e811b7a6793831d911f190f` Kiro: drop the private final answer when a real tool call shares the turn (#7434) | 需要採用的修正 | 只分類、未審 | 僅依主旨與 stat 分類，尚無 fork 對應檔案:行號與觸發條件；原候選分類不構成採用或略過判定。 |
| `d67feddd73a87ad0305a0e5ace3b0df367bd72d8` docs(responses): register and document citation replay coverage (#7865) | 純 docs／文件登錄 | skip | 僅文件或其 layout／structure 登錄（`scripts/test-layout/layout.json`）；不重放上游多語系或以其驗收聲明取代 fork 證據。 |
| `6f0d5eb37469ea4f0bc871b472803dae73fb74e9` fix: Stream completion-stable canonical apply_patch input (#7506) | 需要採用的修正 | 只分類、未審 | 僅依主旨與 stat 分類，尚無 fork 對應檔案:行號與觸發條件；原候選分類不構成採用或略過判定。 |
| `a7072ec664b9e2c1200e2f25f1ef0787cb02ef84` fix(quota-pool): compute pooled windows from held account rows (#7862) | 需要採用的修正 | 只分類、未審 | 僅依主旨與 stat 分類，尚無 fork 對應檔案:行號與觸發條件；原候選分類不構成採用或略過判定。 |
| `08d80f24a9afc9fb65411ff08c1d47e9585ff06a` fix(link): restore local routing when a Link Child stops (#7736) | 依賴／跨模組大功能 | 只分類、未審 | 僅依主旨與 stat 分類，尚無 fork 對應檔案:行號與觸發條件；原候選分類不構成採用或略過判定。 |
| `3ca99278d9da20e56f3c3d28f07b7fc83e2d4f24` fix(router,combos): hop and cool provider on upstream account quota exhaustion (#7625) | 需要採用的修正 | 只分類、未審 | 僅依主旨與 stat 分類，尚無 fork 對應檔案:行號與觸發條件；原候選分類不構成採用或略過判定。 |
| `4db877256697ee4599655d52bff203b386e4d886` fix(gui): avoid quota refresh failures from paused accounts (#7628) | 需要採用的修正 | 只分類、未審 | 僅依主旨與 stat 分類，尚無 fork 對應檔案:行號與觸發條件；原候選分類不構成採用或略過判定。 |
| `f209d4283b86f5ba29a22ee2922dc4f62c298f58` feat(dashboard): revocable server-side remembered device sessions (#7593) | 依賴／跨模組大功能 | defer | 持久 GUI session 改認證與撤銷機制，須核對 fork 的 consent／dashboard session 防線後整體採用。 |
| `07161c5b951ac94e602e9829536ac711b9bcc03a` fix(clients): reject drive-less rooted Windows path overrides (#7824) | 需要採用的修正 | 已審：採用（T3 Code 與多語系文件不適用） | 2026-11-05 補審，見文末同日節：`isAbsoluteClientPath` 共用判斷式已套到 fork 現有的全部 client 路徑解析點。 |
| `cd26e920c3528161c3dd06e18ba9995c82b73926` test: stop restarting the proxy per row in the bearer admission matrix (#7866) | 純測試 | skip | 僅調整 `tests/codex-integration/bearer-admission-routed-provider.test.ts` 等測試 fixture／斷言／預算；產品不變，保留 fork 現有回歸，不整批覆蓋測試。 |
| `7a1565bb968b343f68eddd6ea266222fcfd95ff1` fix(cli): recheck live ownership before journal recovery (#7851) | 依賴／跨模組大功能 | 只分類、未審 | 僅依主旨與 stat 分類，尚無 fork 對應檔案:行號與觸發條件；原候選分類不構成採用或略過判定。 |
| `63820c415f8c13faaff73dc7f6775b8a0c32357b` feat(codex): add protected Windows CLI update job storage (#7626) (#7626) | 依賴／跨模組大功能 | defer | 依賴 4118b90ba／8178745ba，protected store 與 Windows ACL 不可拆開驗收。 |
| `100ab90fb60e90cdd26cddf8fdf871868611eddd` fix: disable header-arrival deadline for local upstreams by default (#7472) | 依賴／跨模組大功能 | 只分類、未審 | 僅依主旨與 stat 分類，尚無 fork 對應檔案:行號與觸發條件；原候選分類不構成採用或略過判定。 |
| `713fdfbe22e2c7b33851435dc0065659269f8a1b` fix(config): keep a protected recovery copy before persisting the opencode-free retirement (#7836) | 依賴／跨模組大功能 | 只分類、未審 | 僅依主旨與 stat 分類，尚無 fork 對應檔案:行號與觸發條件；原候選分類不構成採用或略過判定。 |
| `86b821696a4627238f0b059f0f729a46bc35f4a2` test(claude): isolate first-party desktop lifecycle locks (#7868) | 測試／依賴功能 | 只分類、未審 | 僅依主旨與 stat 分類，尚無 fork 對應檔案:行號與觸發條件；原候選分類不構成採用或略過判定。 |
| `c655484d9cccf316f3da41047d508bf10d92070a` feat(codex): apply Windows CLI updates with owned transactions (#7648) (#7648) | 依賴／跨模組大功能 | defer | 依賴 updater planning／protected store，75 檔 owned transaction 要與 recovery／observation 成套審查。 |
| `3b8414d3d69af33921781be2aa8169a10b52adea` feat(integrations): add opt-in alias naming for Hermes and Command Code exports (#7867) | 依賴／跨模組大功能 | 只分類、未審 | 僅依主旨與 stat 分類，尚無 fork 對應檔案:行號與觸發條件；原候選分類不構成採用或略過判定。 |
| `f716508b7303d38439659b7b5a419f4d5317cff8` feat(shadow-call): add per-source interception toggles (#7760) | 依賴／跨模組大功能 | 只分類、未審 | 僅依主旨與 stat 分類，尚無 fork 對應檔案:行號與觸發條件；原候選分類不構成採用或略過判定。 |
| `f9e7d939d125c810aa3f3d700dcb8b0cb4129a0f` fix(update): preserve service-home authority during recovery (#7154) | 依賴／跨模組大功能 | defer | 104 檔跨 updater、service-home 與程序控制；fork 自動更新刻意關閉，仍須辨識共用啟停修正，不能整筆略過。 |
| `492c1a15228d3af69e313e1191be3e42dbb15e55` ci: bound frozen installs and retry only deadline stalls (#7870) | CI／工具鏈 | defer | frozen-install 新增 deadline／retry 合約，與 508349e51／88de3762f 同鏈審查，保留 fork Windows CI。 |
| `fdc6dd82d930295880dcf6d10bbb9f2c61994574` fix(windows): admit local config writer phases after config-root ACL settlement (#7869) | 依賴／跨模組大功能 | defer | 依賴 config-root barrier 設計，先與 6bc511d1b 核對 CLI mutation／management 的寫入授權。 |
| `1f840573466667fc97e881d11c2bba7d5828b737` test(claude): isolate the remaining Desktop lifecycle-lock fixtures (#7877) | 測試／依賴功能 | 只分類、未審 | 僅依主旨與 stat 分類，尚無 fork 對應檔案:行號與觸發條件；原候選分類不構成採用或略過判定。 |
| `5b701743163f82e08366dba95d96c7ed336127a6` test: bound desktop compatibility fixture port recovery (#7897) | 測試／依賴功能 | 只分類、未審 | 僅依主旨與 stat 分類，尚無 fork 對應檔案:行號與觸發條件；原候選分類不構成採用或略過判定。 |
| `508349e5166bc2ed3e8da63f855ceb8bbefea9e6` fix(ci): rerun interrupted postinstalls after install timeout (#7898) | CI／工具鏈 | defer | 依賴 492c1a152 的 frozen-install helper；須連同 88de3762f 的 deadline 分類驗收。 |
| `e7778fe7d202693d10bae12c931e58c46342a365` fix(ci): keep the bun install command non-empty for macOS bash 3.2 (#7900) | CI／非 Windows 測試 | skip | 僅修 macOS bash 3.2 install command；fork 不維護 macOS CI，且尚未採其前置 frozen-install helper。 |
| `6ed7d6e487a0466f9a81813f5ba34535d8691918` test: copy macOS bundle binary in remote workspace fixture (#7901) | CI／非 Windows 測試 | skip | 只修 macOS bundle fixture；fork 不維護該平台驗收。 |
| `12c0ec6edbcb002fdd25882db0add10c4e657573` fix(windows): verify private lifecycle runtime roots before ACL propagation (#7903) | 依賴／跨模組大功能 | defer | ACL propagation 的私有 runtime-root 驗證須與 1fe3dd758／6bc511d1b 核對，不單獨覆蓋 fork ACL。 |
| `83062fcf7cd21fa02965ccf5148dbb4161080a0c` test: expose Windows recovery proof state and drain failed fixtures (#7902) | 測試／依賴功能 | 只分類、未審 | 僅依主旨與 stat 分類，尚無 fork 對應檔案:行號與觸發條件；原候選分類不構成採用或略過判定。 |
| `7eab2439c1aba2e387f97bcec82d5aaf813ee1c4` fix(windows): recover interrupted Codex CLI child publication (#7909) | 依賴／跨模組大功能 | defer | 依賴 Windows updater job store／recovery 新交易，不在舊基底孤立採用。 |
| `b46db27b554891f3ff53f8a94776e5be867ab332` test: separate recovery PID evidence and budget cold Windows fetches (#7915) | 測試／依賴功能 | 只分類、未審 | 僅依主旨與 stat 分類，尚無 fork 對應檔案:行號與觸發條件；原候選分類不構成採用或略過判定。 |
| `be6b6b9556b0c075c350687ce515d0d024adfd69` test: stub the owner-ACL verifier in mocked config-root fixtures and canonicalize the history probe path (#7914) | 測試／依賴功能 | 只分類、未審 | 僅依主旨與 stat 分類，尚無 fork 對應檔案:行號與觸發條件；原候選分類不構成採用或略過判定。 |
| `f5a5e5bcf09136b310b420f71a139efbc2b33311` test: partition Windows apply coverage and refresh shard weights (#7917) | 測試／依賴功能 | 只分類、未審 | 僅依主旨與 stat 分類，尚無 fork 對應檔案:行號與觸發條件；原候選分類不構成採用或略過判定。 |
| `f29091a5319399f46e7795932b265b7e4989d52a` fix(restart): retire drained parent ownership and preserve bind scope (#7874) | 依賴／跨模組大功能 | 只分類、未審 | 僅依主旨與 stat 分類，尚無 fork 對應檔案:行號與觸發條件；原候選分類不構成採用或略過判定。 |
| `53a98e9f45696a379788c5aa9ea90118ce517cb3` fix(codex): address Windows updater release and observation reviews (#7875) | 依賴／跨模組大功能 | defer | 依賴 Windows updater apply／observation；須與 c655484d9、7eab2439c 成套驗收。 |
| `b383b1fa83623b0316161a5abf73fd9656116630` test(link): give Windows Child HTTP non-deadline scenarios a realistic budget (#7921) | 測試／依賴功能 | 只分類、未審 | 僅依主旨與 stat 分類，尚無 fork 對應檔案:行號與觸發條件；原候選分類不構成採用或略過判定。 |
| `b16bc0978b2eef1799f38042084809b5a0cd11bf` ci(windows): refresh weights and spread suite over eleven shards (#7923) | CI／工具鏈 | defer | 上游十一分片與 fork 九分片政策不同；不以整檔重放覆蓋 fork Windows CI，另評估權重。 |
| `e7b8cdfdaf16e8ec3fdb5333a655207a09dc70c3` docs: generate a client support matrix from the client registries (#7924) | 依賴／跨模組大功能 | defer | 生成 client support matrix 會改 scripts／package；須與尚未採用的 client registry 新功能同步驗證。 |
| `640a40f6d57fe7613624a4b827b09c8501e277b6` test(claude): make CONNECT upstream failure deterministic (#7929) | 純測試 | skip | 僅調整 `tests/claude-integration/claude-intercept-proxy.test.ts` 等測試 fixture／斷言／預算；產品不變，保留 fork 現有回歸，不整批覆蓋測試。 |
| `06ec878822f21ad0497e9be202534efe8266d7ab` test(service): stabilize native recovery fixture compilation (#7930) | 測試／依賴功能 | 只分類、未審 | 僅依主旨與 stat 分類，尚無 fork 對應檔案:行號與觸發條件；原候選分類不構成採用或略過判定。 |
| `386c3bbadba06e19f50124fce9373e212cb789d3` docs: lead with one local gateway for every coding tool (#7925) | 純 docs／文件登錄 | skip | 僅文件或其 layout／structure 登錄（`README.md`）；不重放上游多語系或以其驗收聲明取代 fork 證據。 |
| `d2a3186d38978c072d678200c76b70514eeefe38` fix(gui): show provider connection and model tests on the served dashboard (#7922) | 需要採用的修正 | 只分類、未審 | 僅依主旨與 stat 分類，尚無 fork 對應檔案:行號與觸發條件；原候選分類不構成採用或略過判定。 |
| `8eb970d9dcd63d119c9a9d20de4c18a27ca542c2` fix(claude): fail native Messages streams that end before message_stop (#7928) | 需要採用的修正 | 已審：採用 | 完整 diff（8 檔）已審並重放。baseline `src/server/messages-shared.ts` 的 `tapAnthropicSseForLog` 在讀到 done 時無條件 `finalize(200)`（HEAD :218-224），上游 clean EOF 的半截 turn 被記成 200 且客戶端沒有 terminal；重放後 `:278-325` 依 terminalSeen／lastDeliveredStop／tailClean／`eofTolerant` 判定，其餘記 502＋`api_error` frame。`src/server/messages-native.ts:881-884` 帶入 `anthropicEofTolerance`；`src/claude/outbound.ts` 的 non-stream fold 改為 CRLF／CR 正規化與 data-only frame 命名。`tests/claude-integration/messages-native-clean-eof.test.ts` 先紅（27 fail）後綠（104 pass）。細節見下方 2026-11-04 節。 |
| `9c33e4658b7b180ec8dd20f0e6a21daf3699f76e` ci(macos): split suite across four weighted shards (#7926) | CI／非 Windows 測試 | skip | macOS 四分片屬 fork 明確移除的 CI 功能面，不重放 workflow 或 runner。 |
| `da721e33a30a46c12a5e2f1414fb1b6b842c6c1e` docs: record runtime-verified client results on the support page (#7927) | 純 docs／文件登錄 | skip | 僅文件或其 layout／structure 登錄（`docs-site/src/content/docs/fr/reference/client-support.md`）；不重放上游多語系或以其驗收聲明取代 fork 證據。 |
| `dc75a3e5115ad4be10a33617600c93c8fcdfe7c5` fix(cursor): parse model variants without delimiter backtracking (#7938) | 需要採用的修正 | 只分類、未審 | 僅依主旨與 stat 分類，尚無 fork 對應檔案:行號與觸發條件；原候選分類不構成採用或略過判定。 |
| `300a73ab0e1e7c5a0fcef79f32378eb0fecab8be` chore(release): open dev at 2.95.0 before releasing 2.94.0 (#7934) | 純版本號 | skip | 只推進上游 package／Cargo／Tauri 版本；未整合整版產品，不宣稱 fork 已升至該版本。 |
| `24d176efdfe0975a0eb55fc01fd515e2c3b68b7e` feat(gui): show distinct first-response states on the provider overview (#7939) | 依賴／跨模組大功能 | 只分類、未審 | 僅依主旨與 stat 分類，尚無 fork 對應檔案:行號與觸發條件；原候選分類不構成採用或略過判定。 |
| `ef1ca714ca3d8c56132ed33f21809142887ccf88` fix(anthropic): honor explicit Opus 5.5 reasoning summaries (#7728) (#7881) | 需要採用的修正 | 只分類、未審 | 僅依主旨與 stat 分類，尚無 fork 對應檔案:行號與觸發條件；原候選分類不構成採用或略過判定。 |
| `8ed7b453d7f37f111f011bc2b5d4e89dc4816294` fix(codex): report main-pool affinity decisions in request logs (#7883) | 需要採用的修正 | 只分類、未審 | 僅依主旨與 stat 分類，尚無 fork 對應檔案:行號與觸發條件；原候選分類不構成採用或略過判定。 |
| `d588ca9d22a905a1ab5efef3f31151723229df8a` test(windows): warm the PowerShell ancestry probe before its timed run (#7854) (#7885) | 測試／依賴功能 | 只分類、未審 | 僅依主旨與 stat 分類，尚無 fork 對應檔案:行號與觸發條件；原候選分類不構成採用或略過判定。 |
| `4179e8a1dff47e7a05109da6704600f46b75d288` perf(usage): fast-path ASCII metadata folding (#7886) | 需要採用的修正 | defer | redact-folding 涉及隱私遮罩等價性，雖是 ASCII 快路徑仍須差分測試，不當低風險純效能修改。 |
| `93b8a5e18bff30252a5ec0900970006fb7b5e1da` fix(codex): keep local account cooldowns from quarantining combo targets (#7887) | 需要採用的修正 | 只分類、未審 | 僅依主旨與 stat 分類，尚無 fork 對應檔案:行號與觸發條件；原候選分類不構成採用或略過判定。 |
| `69c1c6ed6bc7779fedb50734d42a96f72daf6ffd` fix(messaging): reserve SSH forward ports until handoff and recover lost candidates (#7893) | 依賴／跨模組大功能 | 只分類、未審 | 僅依主旨與 stat 分類，尚無 fork 對應檔案:行號與觸發條件；原候選分類不構成採用或略過判定。 |
| `c7f3928a21f2ff3c47ba7a2dd91c193ad4cf1273` fix(config): re-arm the atomic writer's ACL timeout memo per destination (#7891) | 需要採用的修正 | defer | 需要採用的 ACL memo re-arm 修正；須與 config writer barrier 核對 destination 隔離及 timeout 回歸。 |
| `041d87f0bc12a8e6cb954410f15c20aba2f01ac2` fix: preserve tool safety on translated Messages fallbacks (#7919) | 依賴／跨模組大功能 | 只分類、未審 | 僅依主旨與 stat 分類，尚無 fork 對應檔案:行號與觸發條件；原候選分類不構成採用或略過判定。 |
| `92e7350c0d70d11ae5192727eb671a08067834f9` test: add offline fixtures for claude-cli schema-constrained output (#7908) | 純測試 | skip | 僅調整 `tests/providers/claude-cli-adapter.test.ts` 等測試 fixture／斷言／預算；產品不變，保留 fork 現有回歸，不整批覆蓋測試。 |
| `392b786bcfee4078caa575e3fd0dee5b68eaf290` fix(openai-responses): drop the include entry xAI rejects (#7911) | 需要採用的修正 | 只分類、未審 | 僅依主旨與 stat 分類，尚無 fork 對應檔案:行號與觸發條件；原候選分類不構成採用或略過判定。 |
| `cac6f7265b680aa0448808f5f6b4bfc803e8a5e9` fix(gui): preserve Muse reset countdown after quota exhaustion (#7730) | 需要採用的修正 | 只分類、未審 | 僅依主旨與 stat 分類，尚無 fork 對應檔案:行號與觸發條件；原候選分類不構成採用或略過判定。 |
| `2e447c868b07bce47f5caa9fce50d9c1eb5c5d65` Kiro: log the usage Kiro reports on every wire, and forward combo child usage after commit (#7433) | 依賴／跨模組大功能 | 只分類、未審 | 僅依主旨與 stat 分類，尚無 fork 對應檔案:行號與觸發條件；原候選分類不構成採用或略過判定。 |
| `0e6ac986a87331cd1a3552f7524035b56442cf4a` feat(claude-desktop): per-client model visibility for the Desktop list (#7769) | 依賴／跨模組大功能 | 只分類、未審 | 僅依主旨與 stat 分類，尚無 fork 對應檔案:行號與觸發條件；原候選分類不構成採用或略過判定。 |
| `6c49278cb7764939f57735ff42935243a0ee32ae` fix(oauth): explain why Antigravity project discovery failed (#7888) | fork 刻意不收的功能面 | skip | Antigravity project discovery 診斷屬停用功能，不擴充其登入路線。 |
| `e1a60c218ce290ca4c828412b9154fd8bf209291` feat(kiro): add IAM Identity Center login to dashboard (#7690) | 依賴／跨模組大功能 | 只分類、未審 | 僅依主旨與 stat 分類，尚無 fork 對應檔案:行號與觸發條件；原候選分類不構成採用或略過判定。 |
| `e42c3749518271f7b0f5c06aeb75ff5fa38a91f0` fix(test-layout): keep layout.json under the file-size threshold (#7943) | 純測試 | skip | 僅調整 `scripts/test-layout/layout.json` 等測試 fixture／斷言／預算；產品不變，保留 fork 現有回歸，不整批覆蓋測試。 |
| `ad3e3d187182ef9b3cbd8f9ed6091de624ffa7a5` fix(providers): default Moonshot API to K3.1 Pro and retire K2.5 (#7880) | fork 刻意不收的功能面 | skip | Moonshot 中國供應商預設模型遷移非 fork 使用需求，不推進其產品預設。 |
| `e3ebd82a5b51926d964e5d0e86dd0177aed9e2da` fix(openai-chat): send LM Studio one leading system message (#7882) | 依賴／跨模組大功能 | 只分類、未審 | 僅依主旨與 stat 分類，尚無 fork 對應檔案:行號與觸發條件；原候選分類不構成採用或略過判定。 |
| `49775ecaf9dc2004b27c90bb53aaec0c6f03a508` feat(catalog): opt in to omitting disabled native models (#7889) | 依賴／跨模組大功能 | 只分類、未審 | 僅依主旨與 stat 分類，尚無 fork 對應檔案:行號與觸發條件；原候選分類不構成採用或略過判定。 |
| `fb81e53e96b00a58df49030be8f9709a5a1a4818` fix(service): treat headless GUI-domain launchctl 125 as an unreachable domain (#7697) (#7745) | fork 刻意不收的功能面 | skip | 只處理 launchctl GUI-domain 125，fork 不維護 macOS service 啟停。 |
| `b09c9302c4832a12c17da5f57f5d2240fe20f817` test(codex): retain bounded Windows plan refusal diagnostics (#7937) | 需要採用的修正 | defer | 標題雖為 test，亦更動 Windows plan provenance 產品碼；依賴 8178745ba，不歸純測試。 |
| `524c019c7b82384aa7574ce4dfd11abe380d2cb9` fix(combos): fail over when a target rejects a request for context length (#7892) | 需要採用的修正 | 只分類、未審 | 僅依主旨與 stat 分類，尚無 fork 對應檔案:行號與觸發條件；原候選分類不構成採用或略過判定。 |
| `8a6cea9c168666733d97dd8172cbe6296b1b0104` fix(advisor): support manual consultations during web search (#7858) | 依賴／跨模組大功能 | 只分類、未審 | 僅依主旨與 stat 分類，尚無 fork 對應檔案:行號與觸發條件；原候選分類不構成採用或略過判定。 |
| `f4eef7b23ef2154d6d004077c5522d754a72c0d5` fix(search): consume the final Responses data line at EOF (#7873) | 需要採用的修正 | 已審：採用 | 完整 diff 已審；`src/web-search/parse.ts:311-319` 僅在正常 EOF flush decoder／data 尾列，保留 byte／decoded cap 與讀取失敗邊界；`tests/web-search/web-search-eof.test.ts:21-84` 驗完成、失敗、分片 Unicode、缺 terminal 與上限。不依賴 504417f0e 或 d42b9b1b2，詳見獨立修正證據。 |
| `fc17ac23a118e37c43c5981f59fe2430ce3ccb83` test(windows): resolve the atomic-write fixture root before matching cleanup paths (#7945) | 測試／依賴功能 | 只分類、未審 | 僅依主旨與 stat 分類，尚無 fork 對應檔案:行號與觸發條件；原候選分類不構成採用或略過判定。 |
| `9b78a16f4fe0c300527e6b183052407269bb941d` test(windows): budget hosted fixture phases without weakening contracts (#7946) | 純測試 | skip | 僅調整 `tests/claude-integration/claude-native-passthrough.test.ts` 等測試 fixture／斷言／預算；產品不變，保留 fork 現有回歸，不整批覆蓋測試。 |
| `26224ad6c4bae6f3a31f768be450d4ce4a17bea8` test(codebuddy): feed the abort fixture's stdout once (#7948) | 純測試 | skip | 僅調整 `tests/providers/codebuddy-adapter.test.ts` 等測試 fixture／斷言／預算；產品不變，保留 fork 現有回歸，不整批覆蓋測試。 |
| `b9fb2c7366cf9606136d243bebe81a2ceff942db` test(windows): use a never-allocated PID for the pending-child recovery fixture (#7949) | 測試／依賴功能 | 只分類、未審 | 僅依主旨與 stat 分類，尚無 fork 對應檔案:行號與觸發條件；原候選分類不構成採用或略過判定。 |
| `8131535cdd53a2161d2fd2e317b3445a52f1dd73` test(claude): give native passthrough success paths the internal header deadline (#7951) | 純測試 | skip | 僅調整 `tests/claude-integration/claude-native-passthrough.test.ts` 等測試 fixture／斷言／預算；產品不變，保留 fork 現有回歸，不整批覆蓋測試。 |
| `9c96ce5729939c69448a508d482050ce5da2dc6a` feat(gui): link completion probe failures to recovery, re-verification, and disconnect scope (#7947) | 依賴／跨模組大功能 | 只分類、未審 | 僅依主旨與 stat 分類，尚無 fork 對應檔案:行號與觸發條件；原候選分類不構成採用或略過判定。 |
| `095ddf64dae1f1e32cd2df8aa47fab55c891a455` test(config): publish the overlap fixture after the recheck budget is spent (#7950) | 測試／依賴功能 | 只分類、未審 | 僅依主旨與 stat 分類，尚無 fork 對應檔案:行號與觸發條件；原候選分類不構成採用或略過判定。 |
| `463a0ee0b7bebd82b3fbd9ab5766e6f161d1c33d` fix(test): judge protected-tree containment per path component (#7884) | 需要採用的修正 | defer | 雖名為 fix(test)，改共用 test-home-guard containment，須保留 Windows 磁碟與路徑邊界測試。 |
| `7aae44dabbcc17a13b034b8f5919929537daba58` perf(anthropic): scan SSE inspection fragments incrementally (#7913) | 需要採用的修正 | 只分類、未審 | 僅依主旨與 stat 分類，尚無 fork 對應檔案:行號與觸發條件；原候選分類不構成採用或略過判定。 |
| `6c2cdd111d8ad1297ba3499098e15bf45e372a42` feat(providers): test all models of a provider and disable the failures (#7742) | 依賴／跨模組大功能 | 只分類、未審 | 僅依主旨與 stat 分類，尚無 fork 對應檔案:行號與觸發條件；原候選分類不構成採用或略過判定。 |
| `a391835c235d6a173460a7b606058a3c151da157` feat(responses): complete gracefully on max_output_tokens (#7770) | 依賴／跨模組大功能 | 只分類、未審 | 僅依主旨與 stat 分類，尚無 fork 對應檔案:行號與觸發條件；原候選分類不構成採用或略過判定。 |
| `297f29939c5479a9da28da3c8806afea90e654ec` fix(advisor): apply the caller's paid-combo consent and device fallback policy (#7894) | 依賴／跨模組大功能 | defer | paid-combo consent 與 captured admission policy 橫跨 ingress／vision／sidecar；須逐檔安全審查，保留付費同意邊界。 |
| `96e0e009e2c9134441ec01a3a60b01a364894199` feat(clients): let the omo integration write the Responses dialect (#7890) | 依賴／跨模組大功能 | 只分類、未審 | 僅依主旨與 stat 分類，尚無 fork 對應檔案:行號與觸發條件；原候選分類不構成採用或略過判定。 |
| `f5f47b057997c0d60ec420456d9450e109ca4ed1` feat(provider): add keyless CC-Switch provider import with preview, apply and restore (#7935) | 依賴／跨模組大功能 | defer | CC-Switch 匯入新增 SQLite／檔案讀取與 apply／restore，須補完整 preview／同意與資料隔離驗收。 |
| `3ea89653f5727aea41948ddbd5e833f74afe3e36` fix(gui): explain upstream request failures (#7936) | 需要採用的修正 | 只分類、未審 | 實質差異在 gui/src/pages/Logs.tsx、src/usage/log.ts、src/server/request-log.ts，以及 logs-failure-summary；需核對多次嘗試／normalization loss 的 fork 行為，不能以 de.ts 為理由。 |
| `8143cc0537d4c674b178d6743e1688a84a3edc36` build(deps): bump rustls from 0.23.45 to 0.23.46 in /desktop/src-tauri (#7942) | fork 已有等價修正 | skip | fork Cargo.lock 已有 rustls 0.23.46 與相同 checksum；等價依賴修正已具備，避免覆蓋其他 Cargo 安全修正。 |
| `88de3762fdabb7ef6038c2ea0313fb34b0f34c36` fix(ci): distinguish install failures from owned deadlines (#7977) | CI／工具鏈 | defer | 依賴 492c1a152／508349e51 的 helper，須一起驗證 owned deadline 與真正 install failure。 |
| `2c4e580e23f902af929f93f3294e13b687467308` test(xai): cover encrypted Responses tool continuation (#7975) | 純測試 | skip | 僅調整 `tests/providers/xai/xai-responses-adjacency.test.ts` 等測試 fixture／斷言／預算；產品不變，保留 fork 現有回歸，不整批覆蓋測試。 |
| `3a70dd4788db76701df546c8629c8d8e17c2680d` fix(volcengine): keep Kimi K3.1 Pro tool continuations valid (#7944) | 需要採用的修正 | defer | Volcengine Kimi 工具延續涉及共用 openai-chat/messages.ts，不能因未使用中國 provider 而略過整筆。 |
| `4998194755f3698005409a6e75408f4e80a7a81b` perf(responses): count snapshot text bytes incrementally (#7957) | 需要採用的修正 | 只分類、未審 | 僅依主旨與 stat 分類，尚無 fork 對應檔案:行號與觸發條件；原候選分類不構成採用或略過判定。 |
| `572467f21d82b30bc2070c48e8753438492ff97d` perf(history): move integrity scans off the serving thread (#7972) | 依賴／跨模組大功能 | defer | history integrity worker 與 rebuild 協定為跨模組功能，連同 227811fd7 的等待上限驗收。 |
| `0cc5a5958d5435444a0185bf06e424843916716f` fix(workflow-budget): make per-task ceilings configurable from config and dashboard (#7960) | 依賴／跨模組大功能 | defer | workflow ceilings 更動 schema／dashboard／send budget，須驗證零值、互動預留與持久設定一致性。 |
| `899cc4fe4da796006dbd526039777499c67927c5` docs(config): say when the workflow send ceiling is checked (#7987) | 純 docs／文件登錄 | skip | 僅文件或其 layout／structure 登錄（`docs-site/src/content/docs/reference/configuration/server.md`）；不重放上游多語系或以其驗收聲明取代 fork 證據。 |
| `4fc870074e8030cd1e0a35a6a5c707f208e51b93` fix(kiro): exclude runtime callbacks from retry snapshot (#7981) | 需要採用的修正 | 只分類、未審 | 僅依主旨與 stat 分類，尚無 fork 對應檔案:行號與觸發條件；原候選分類不構成採用或略過判定。 |
| `853508eb629abe05fe290e84b0f6687d9682a7ad` fix(windows): snapshot ACL failure diagnostics (#7970) | 需要採用的修正 | defer | 依賴 1fe3dd758 的 ACL 診斷重構，須一起驗證快照與遮罩，不覆蓋現有 Windows 防線。 |
| `db7bdc5e3d233aed8425420e77fbd66fe20ec947` fix(cli): explain tracked runtime stop refusals (#7973) | 需要採用的修正 | 只分類、未審 | 僅依主旨與 stat 分類，尚無 fork 對應檔案:行號與觸發條件；原候選分類不構成採用或略過判定。 |
| `d82d7ee739d7bcd2aa55d9e2ca2bbae669b11812` fix(router): decode routed slugs via modelDisplayNames ids (#7979) | 需要採用的修正 | 只分類、未審 | 僅依主旨與 stat 分類，尚無 fork 對應檔案:行號與觸發條件；原候選分類不構成採用或略過判定。 |
| `1e1620f3d9c2bee0c45591f3d074ae5f141fccea` fix(responses): normalize Codex tool catalogs and include for Meta Muse (#7985) | 需要採用的修正 | 只分類、未審 | 僅依主旨與 stat 分類，尚無 fork 對應檔案:行號與觸發條件；原候選分類不構成採用或略過判定。 |
| `ac0833bc55cce392d79d42fa2b952b2ccbe9d9b3` fix(windows): bigint probe identity in runtime preflight; release CC-Switch F3 WAL handles (#7986) | 需要採用的修正 | defer | bigint runtime identity 與 CC-Switch WAL handle 混合，須拆核前置 runtime preflight／import 合約。 |
| `6218a9a63ba1ae7807c0eb94bec2a184d89e42f2` fix(combo): skip Meta Muse targets for mandatory tool_choice (#7982) | 需要採用的修正 | 只分類、未審 | 僅依主旨與 stat 分類，尚無 fork 對應檔案:行號與觸發條件；原候選分類不構成採用或略過判定。 |
| `d42b9b1b231a6a5b1dadde9262dfb63736823488` fix(sidecars): accept CR-delimited Responses events (#7989) | 需要採用的修正 | defer | 需要採用的 CR-delimited parser 修正；同檔 f4eef7b23／504417f0e 有前置差異，合併回歸後再採。 |
| `d389699c96db753931a5f785f7a6a78c3ff94a1e` fix(azure): omit unsupported Responses encrypted output include (#7988) | 需要採用的修正 | 只分類、未審 | 僅依主旨與 stat 分類，尚無 fork 對應檔案:行號與觸發條件；原候選分類不構成採用或略過判定。 |
| `a2ae4825350813b41d92abf2231924ed8950ef63` fix(codex): validate CLI and desktop launcher execution boundaries (#7876) | 依賴／跨模組大功能 | defer | launcher execution authority 依賴 b33fc5665／c0014da53，須核對 Windows 可執行邊界及還原權限。 |
| `eea1454782be464848b66e8a9483c453c2189a97` fix(credentials): stop Windows ancestor-watch feedback loops (#7976) | 需要採用的修正 | defer | Windows ancestor-watch feedback loop 涉及 credential inventory／generation，須驗證監看停止與身分失效。 |
| `1eca7a32938507706321c10c8e9b7988fb5c525e` fix(discovery): name the invalid model row and the static-list workaround (#7990) | 需要採用的修正 | 只分類、未審 | 僅依主旨與 stat 分類，尚無 fork 對應檔案:行號與觸發條件；原候選分類不構成採用或略過判定。 |
| `0c74947006604918a0821ba77463ce66cda095ba` fix(codex): stop scoring an elapsed 5-hour window against a pool account (#7994) | 需要採用的修正 | 只分類、未審 | 僅依主旨與 stat 分類，尚無 fork 對應檔案:行號與觸發條件；原候選分類不構成採用或略過判定。 |
| `b692a8a33399007baae29de60c6646da091497ea` test(history): corrupt the index the health query plan actually reads (#7995) | 測試／依賴功能 | 只分類、未審 | 僅依主旨與 stat 分類，尚無 fork 對應檔案:行號與觸發條件；原候選分類不構成採用或略過判定。 |
| `ba0556d001dbca25aaef46680a56fd3150c4b19c` fix(codex): retire a pool account's carried 5-hour window when WHAM shows none (#7980) | 需要採用的修正 | 只分類、未審 | 僅依主旨與 stat 分類，尚無 fork 對應檔案:行號與觸發條件；原候選分類不構成採用或略過判定。 |
| `03d8bd0ce9dd707e1cfb0ac678b4a53f02f813d1` fix(claude): keep web_search native when no sidecar backend can run (#7991) | 需要採用的修正 | 只分類、未審 | 僅依主旨與 stat 分類，尚無 fork 對應檔案:行號與觸發條件；原候選分類不構成採用或略過判定。 |
| `8063be23e47822240b45c0456f3243102d4a0d9d` fix(providers): keep the quota report cache when pool readings are only restamped (#7992) | 需要採用的修正 | 只分類、未審 | 僅依主旨與 stat 分類，尚無 fork 對應檔案:行號與觸發條件；原候選分類不構成採用或略過判定。 |
| `d9e0c057881200d32b0398c5a1bc38144c1da73e` fix(responses): promote additional_tools to top-level tools for xAI and strict gateways (#7983) | 依賴／跨模組大功能 | defer（2026-11-05 已逐檔改判，見文末同日節；保留原盤點） | 45 檔 additional_tools／namespace／destination 聯動，含認證入口，須先核對與 f94e95ce5 等工具回放變更的相依性。 |
| `a022a67fd8152045268405145d73ef696ff5afdd` fix(claude): prune generated agents when the Claude integration is turned off (#7993) | 需要採用的修正 | 只分類、未審 | 僅依主旨與 stat 分類，尚無 fork 對應檔案:行號與觸發條件；原候選分類不構成採用或略過判定。 |
| `227811fd70886f78a379ca478be84f2368fa3cb8` fix(history): bound the integrity check wait (#7997) | 需要採用的修正 | defer | 依賴 572467f21 的 integrity worker，等待上限要和 worker 生命週期合測。 |
| `9922f8159a9e5327fcc4ead930c309faa57755ec` test(history): corrupt the health index through a cold connection (#8000) | 測試／依賴功能 | 只分類、未審 | 僅依主旨與 stat 分類，尚無 fork 對應檔案:行號與觸發條件；原候選分類不構成採用或略過判定。 |
| `cb483626c8f6af0c0120642179d3336e42b68151` fix(codex): await recovery ACL checks in async parent admission (#7931) | 依賴／跨模組大功能 | defer | 跨 38 檔將 recovery ACL admission 改 async，依賴 updater 鏈並需驗證 synchronous activation 不被破壞。 |
| `236a886f77c95c8d1191c339b845d5a84b7272e3` feat(codex): tier role auto-assign candidates by measured capability (#7624) | 依賴／跨模組大功能 | 只分類、未審 | 僅依主旨與 stat 分類，尚無 fork 對應檔案:行號與觸發條件；原候選分類不構成採用或略過判定。 |
| `3bda3e5fe074d67c1ac20f7380d32f43675d93e3` test(codex): assert the cold keyring refusal kind and report its cause (#8001) | 純測試 | skip | 僅調整 `tests/codex-integration/main-quota-provenance.test.ts` 等測試 fixture／斷言／預算；產品不變，保留 fork 現有回歸，不整批覆蓋測試。 |
| `b53b5d26e22a8284fd7d46035432422d6643b05d` test(cc-switch): finalize the F1/F2 fixture statements before cleanup (#8002) | 測試／依賴功能 | 只分類、未審 | 僅依主旨與 stat 分類，尚無 fork 對應檔案:行號與觸發條件；原候選分類不構成採用或略過判定。 |
| `261131d3726d95b4ad3335cf416254a868963e08` fix(update): refuse dashboard restart under a systemd unit OpenCodex does not own (#7996) | 需要採用的修正 | defer | systemd ownership 為非 Windows 功能，但改共用 management/config-routes 與 update worker；不得只按標題略過。 |
| `19ab113945530483f4524ae3e6f8374d16572976` fix(windows): admit config-root cache writes after the optional config-root ACL flight (#7998) | 需要採用的修正 | defer | config-root cache writer admission 與 6bc511d1b／fdc6dd82d 同鏈，須核對 quota cache 非同步安全。 |
| `8e58c9683d7d1e0fd2dbb3604cf05dca62b02b99` test(cli): name the pinned-port holder when a sibling misses its deadline (#8003) | 純測試 | skip | 僅調整 `tests/cli/cli-start-journal-order.test.ts` 等測試 fixture／斷言／預算；產品不變，保留 fork 現有回歸，不整批覆蓋測試。 |
| `3cab4a74e4eec15ee5ff3bdd59dcab8ede938372` test(anthropic): await the admitted provider quota cache write (#8004) | 需要採用的修正 | defer | 標題為 test 但改 account-quota-disk.ts，依賴 19ab11394 的 admitted write 合約。 |
| `c34d26ff2bde9516517fe7fd58c2bcda70ca5e03` test(claude): report the hardened local-CA ACL in the first-party apply suite (#8016) | 純測試 | skip | 僅調整 `tests/claude-integration/claude-desktop-first-party.test.ts` 等測試 fixture／斷言／預算；產品不變，保留 fork 現有回歸，不整批覆蓋測試。 |
| `86b72a689c21b97b0a425303e64b54ccceeb530a` fix: compare file identity with bigint stat (#8019) | Windows identity 精度修正 | 已審：採用（identity 範圍） | fork 全域 bigint identity（86 個 caller）沿用，2026-11-04 補審見下節：後續 `6c86d0fad`／`51030653f` 的 identity 部分在 fork 有等價實作並補上缺的 adjacent-ID 行為測試；發現並修正 3 處 bigint `*Ms` 截斷到毫秒的穩定性比對（改比 `*Ns`）。先前記為 coordinator 的 path is redirected 紅燈，根因是本機 Claude 桌面 MSIX 對 `%LOCALAPPDATA%\OpenCodex` 的虛擬化，不是 identity 缺陷。完整產品套件未跑，不宣稱全套綠燈。 |
| `6c86d0fad2e1690358bf1adbe5e3687f9cc28bc8` fix: compare Codex and remote workspace file identity with bigint stat (#8023) | 依賴／跨模組大功能 | 已審：採用（部分重放） | 29 檔完整 diff 已審：identity 比對在 fork 皆有等價（見下節逐檔表）；採用 `statTimeMs` 精確毫秒公式（`src/lib/file-identity.ts:46,58`、`src/oauth/store.ts:436`）並移植 adjacent-ID 行為測試。`shim-wrapper-write.ts` 不存在（屬 c655484d9 鏈，延後）、`ShimPathFingerprint.identity` 欄位與 guard 的 declarationBody 修正不適用於 fork 設計。 |
| `c618c77b1e81aa8952422e2d3657439ed6d5f8fe` test: select injected stat targets by canonical path (#8029) | 測試／依賴功能 | 只分類、未審 | 僅依主旨與 stat 分類，尚無 fork 對應檔案:行號與觸發條件；原候選分類不構成採用或略過判定。 |
| `51030653fcf95e83c491388ec3eb5f0fbc613198` fix: compare CLI install and update artifact identity with bigint stat (#8031) | 依賴／跨模組大功能 | 已審：採用（等價）；artifact 檔不適用 | `cli-install-provenance.ts` 的正式讀取路徑在 fork 已用 bigint helper（`:513-531`、`:875-888`），無需改碼。`src/codex/cli-update-artifacts.ts` 在 baseline 不存在（#7586 `4118b90ba`，defer），該檔 hunk 與 `codex-cli-update-artifacts` 測試待該鏈整合時一併重放。注入 stat 縫（僅測試用）維持數字，fork 以 fail-closed 測試釘住。 |
| `c68885b5f16a2a36d8eaa9877ffcae7235128c1b` test: give the Windows apply x64 fixture compile the shared spawn budget (#8032) | 測試／依賴功能 | 只分類、未審 | 僅依主旨與 stat 分類，尚無 fork 對應檔案:行號與觸發條件；原候選分類不構成採用或略過判定。 |
| `63de499e1add6bd05e3baaeecd16402fa65d0095` chore(release): open dev at 2.96.0 before releasing 2.95.0 (#8033) | 純版本號 | skip | 只推進上游 package／Cargo／Tauri 版本；未整合整版產品，不宣稱 fork 已升至該版本。 |
| `eb6f1e52c1bbe9229499459b4dc357793d82f0c1` feat(messaging): add opt-in MCP tools for stored Codex queues (#7999) | 依賴／跨模組大功能 | 只分類、未審 | 僅依主旨與 stat 分類，尚無 fork 對應檔案:行號與觸發條件；原候選分類不構成採用或略過判定。 |
| `cc23d5d3ca4089b01c44947ea0e9d7e54a61a983` fix(combo): exclude Meta for direct hosted tool choices (#8010) | 需要採用的修正 | 只分類、未審 | 僅依主旨與 stat 分類，尚無 fork 對應檔案:行號與觸發條件；原候選分類不構成採用或略過判定。 |
| `b2e47bd26d52d12935e2319f74d3749931ccb93f` perf(ollama): count fragmented NDJSON bytes incrementally (#8015) | 需要採用的修正 | 只分類、未審 | 僅依主旨與 stat 分類，尚無 fork 對應檔案:行號與觸發條件；原候選分類不構成採用或略過判定。 |
| `468e635abd1d88f5fcb8ae3b274b9f3ac764b448` fix(grok): honor disable and shutdown during startup sync (#8017) | 需要採用的修正 | 只分類、未審 | 僅依主旨與 stat 分類，尚無 fork 對應檔案:行號與觸發條件；原候選分類不構成採用或略過判定。 |
| `2ee32ab25f40a8eef1e99311abd4011ca9e5bbb5` fix(qoder): bound CN PNG raster dimensions (#8021) | 需要採用的修正 | defer | Qoder CN raster 上限依賴 1112f5b95 新 image-input 模組，待共用投影與影像邊界一起審。 |
| `afafe6d360120f315aeba48122274400942cdc89` fix(cli): preserve server-issued batch for role suggestion --apply (#8022) | 需要採用的修正 | 只分類、未審 | 僅依主旨與 stat 分類，尚無 fork 對應檔案:行號與觸發條件；原候選分類不構成採用或略過判定。 |
| `2f7f1d113ec061e5e08e1a46228240a0ac3064e1` fix(responses): strip rejected reasoning toggle from native passthrough (#8025) | 需要採用的修正 | 已審：採用 | 完整 diff 已審；能力正規化拒絕已解析 toggle 時，`src/server/responses/core-normalize.ts:349-359` 同步移除 raw reasoning.enabled，保留 summary；`tests/responses/reasoning-effort-summary-default.test.ts:114-132` 先紅後綠。不增加 import 或未採用 commit 的介面依賴。 |
| `67bdeb03a3a3e6d3b59435527d4bf5b6a232b731` fix(adapters): strip safety_identifier at the canonical ChatGPT forward destination (#8030) | 需要採用的修正 | 已審：採用 | 2026-11-05 補審，見文末同日節：fork 的 `stripUnsupportedForwardParams` 同構，canonical 目的地補丟 `safety_identifier`；非 canonical 保留。 |
| `e972776eced1b266692b780263828635f47b2754` fix(anthropic): support Ultra quota windows and show subscription names (#8055) | 依賴／跨模組大功能 | 只分類、未審 | 僅依主旨與 stat 分類，尚無 fork 對應檔案:行號與觸發條件；原候選分類不構成採用或略過判定。 |
| `d5708c37c0235194c1d7bdba63bdc587099f6fcf` test(messaging): observe descriptor closure without probing reused fd numbers (#8058) | 純測試 | skip | 僅調整 `tests/codex-integration/messaging-remote-store.test.ts` 等測試 fixture／斷言／預算；產品不變，保留 fork 現有回歸，不整批覆蓋測試。 |
| `98bd8c07bdb999e883c68c89e1a932c3598912bb` test(cli): await sibling startup signal instead of polling deadline (#8062) | 純測試 | skip | 僅調整 `tests/cli/cli-start-journal-order.test.ts` 等測試 fixture／斷言／預算；產品不變，保留 fork 現有回歸，不整批覆蓋測試。 |
| `007dbfd8950a6af778297b15c858863420e69171` fix(codex): isolate Pool installation identity per account (#8065) | 依賴／跨模組大功能 | defer | 帳號 installation identity 最終修正橫跨 57 檔與 HTTP／WebSocket／sidecar，須連同 ba880dfae 審完整身分鏈。 |
| `df5a95c059304a754cfbe5ea72b204672f8a7f9c` release: promote frozen tip dc75a3e5115ad4be10a33617600c93c8fcdfe7c5 to main as 2.94.0 (ours merge of main) | 版本號／發版封裝 | skip | promotion／merge 的產品 tree 與其 frozen tip 相同；修正以表內來源 commit 分類，避免重放整棵上游 tree。 |
| `d844ff4af67c98271be1c1451e7583d36c323527` Merge pull request #7940 from lidge-jun/codex/promote-main-2.94.0-r2 | 版本號／發版封裝 | skip | promotion／merge 的產品 tree 與其 frozen tip 相同；修正以表內來源 commit 分類，避免重放整棵上游 tree。 |
| `0c9edcb46e6e3c6eb6e60167b4b7246fedfd3c29` release: promote frozen tip c68885b5f1 to main as 2.95.0 | 版本號／發版封裝 | skip | promotion／merge 的產品 tree 與其 frozen tip 相同；修正以表內來源 commit 分類，避免重放整棵上游 tree。 |
| `9df4f6a56483ffe62526e29c7d9c6eeed3e742f4` Merge pull request #8034 from lidge-jun/release/promote-main-2.95.0 | 版本號／發版封裝 | skip | promotion／merge 的產品 tree 與其 frozen tip 相同；修正以表內來源 commit 分類，避免重放整棵上游 tree。 |
| `cb487a1f575d60fca510399556decbe1b8eaac13` release: promote frozen tip 007dbfd895 to main as 2.96.0 | 版本號／發版封裝 | skip | promotion／merge 的產品 tree 與其 frozen tip 相同；修正以表內來源 commit 分類，避免重放整棵上游 tree。 |
| `684ad75d254ae96a9971387d09ae428b96ada9c2` Merge pull request #8069 from lidge-jun/release/promote-main-2.96.0 | 版本號／發版封裝 | skip | promotion／merge 的產品 tree 與其 frozen tip 相同；修正以表內來源 commit 分類，避免重放整棵上游 tree。 |

連續 commit 軸：清冊涵蓋範圍不等於逐筆審查完成。`reviewed_through` 保持
`88aaa754566d119b6b8fc898f8fb47602387d82e`，`reviewed_date` 保持 2026-10-28。
未建立每筆 fork 檔案:行號與觸發條件的連續前綴，故不前移 scalar；strict exit 1 是預期缺口。
`integrated_tag = v2.93.0` 與 integrated／PR／issue 其餘水位保持。
後續採用順序與 structural tool turns 補審統一由 `ROADMAP.md` 追蹤。

## 2026-11-03：兩筆獨立修正的完整 diff 與 fork 證據

比對基準為 fork `06aa61fb01e600b1f8b1d42bfad4a997b5e78e79`。以 `git show <sha>` 讀取兩筆全部變更，沒有整檔覆蓋 fork runtime，也沒有帶入韓文文件或其他平台專用檔案。

| Commit | 依賴檢查與採用範圍 | fork 觸發條件與防線 |
| --- | --- | --- |
| `2f7f1d113` | 三檔完整 diff：core-normalize、Responses 結構文件、既有 reasoning 測試。fork 已有 normalizeThinkingOptions、stripEmptyLadderEffort、raw body 與 native clamp 分支；沿用原 hunk，不需任何新增 import／介面。 | 自訂 gateway-object 的目的模型拒絕已解析 thinking toggle 時，options 清除了開關而 raw body 仍有 enabled。`src/server/responses/core-normalize.ts:349-359` 同步清除並在空物件時移除 reasoning；`tests/responses/reasoning-effort-summary-default.test.ts:114-132` 證明保留 summary。native snapshot effort clamp 與既有隱私處理維持原路徑。 |
| `f4eef7b23` | 七檔完整 diff：parser、測試、雙 layout 登錄、結構文件、英／韓文件。只重放 EOF hunk 與測試，登錄現有 layout 並同步英／繁中。fork 已有 reader、decoder、sseFieldValue、handle 及兩種 cap；504417f0e 的形狀／逐 part 累積重構不參與 EOF 接線，d42b9b1b2 的 CR 分隔不屬前置依賴，兩者均不混入。 | `src/web-search/parse.ts:311-319` 只在 reader.read 的 done 消費尾列；同一 handle 計算 decoded 上限、完成與錯誤。`tests/web-search/web-search-eof.test.ts:21-84` 涵蓋兩種完成事件、DONE、三種失敗、逐 byte UTF-8、缺 terminal、無效 JSON、wire cap、decoded cap、讀取失敗。上限中止不 flush；既有 malformed frame 記錄只含長度／分類，不新增內容記錄。 |

驗證：兩筆各自紅燈 exit 1；套用後五檔 113 pass／0 fail，相關 31 檔 477 pass／0 fail。完整命令與 gate 結果見 `REVIEW.md` 的同日獨立修正段。Windows-only 與隱私防線另由 fork gate／privacy scan 驗證。

這兩筆不構成從 `88aaa754` 起的連續已審前綴；`reviewed_through`、`reviewed_date`、`integrated_through`、`integrated_tag` 全部保持原值，完整 stable 整合列保留在 `ROADMAP.md`。作者與 co-author 以 `git show -s --format='%an <%ae>%n%(trailers)' <sha>` 原始 metadata 為準；整合提交須保留相應作者歸屬。

## 2026-11-04：#8019 全域 identity 補審與 Messages stream 提前結束

fork 基準 `14964e312`。以 `git show` 讀 `86b72a689`／`6c86d0fad`／`51030653f`／`8eb970d9d` 全部 diff（含測試）。逐筆游標到 `8eb970d9d`；**不是連續已審前綴**（清冊其餘仍為未審／defer），
`reviewed_through`／`reviewed_date`／`integrated_*`／PR／issue 水位全部保持。

### `6c86d0fad`（#8023）與 `51030653f`（#8031）：fork 檔案:行號對照

fork 的設計與上游不同：共用 `identityStats()`（`src/lib/file-identity.ts:52-61`）回傳數字 metadata＋同一次 bigint 觀察的 exact dev／ino，所有 caller 經 `sameFileIdentity()`／`fileIdentityKey()` 比對。逐檔判定：

| 上游檔案 | fork 證據 | 判定 |
| --- | --- | --- |
| codex-home-owner | `src/codex/codex-home-owner.ts:60-74` bigint＋`sameFileIdentity` | 等價；`:74` 原比 bigint `*Ms`（截斷毫秒）已改 `*Ns` |
| coordinator-doctor | `src/codex/coordinator-doctor.ts:69,76,117` | 等價 |
| history-provider | `src/codex/history-provider.ts:299-300,384-387,747` | 等價 |
| bounded-config-reader | `src/codex/inject/bounded-config-reader.ts:25,41-42,55-60` | 等價 |
| main-account | `src/codex/main-account.ts:177,287` | 等價 |
| native-main-lock-file | `src/codex/native-main-lock-file.ts:71,87-91,114` | 等價 |
| native-residue | `src/codex/native-residue.ts:103,127,149,500-504,594` | 等價 |
| orca-auth-source | `src/codex/orca-auth-source.ts:29-49` | 等價 |
| shim-fingerprint／shim-inspect／shim-restore-lock | fingerprint 直接持 bigint dev／ino；`src/codex/shim-inspect.ts:115,155`；`src/codex/shim-restore-lock.ts` 以 `sameFileIdentity(identity, current.fingerprint)` | 等價（不採上游 `identity` 欄位） |
| shim-state-file | 委由 `src/lib/bounded-file-read.ts:82-114`；`:114` 原比 bigint `*Ms`，已改 `*Ns` | 等價＋修正 |
| shim-wrapper-write | 檔案不存在（c655484d9 鏈）；fork 在 `src/codex/shim.ts:366-440` 有 bigint 等價（私有函式） | 不適用，鏈整合時再看 |
| transition-state | `src/codex/transition-state.ts:528-552` `fileIdentityKey` | 等價 |
| oauth/store | `src/oauth/store.ts:436` 改用 `statTimeMs` | 採用 |
| workspace-executor | `src/remote-control/workspace-executor.ts:174-180,220-223,260` | 等價 |
| state-lock | `src/service/state-lock.ts:81,99-130`；`:134` 的 `Number(bigint mtimeMs)` 只供 stale 年齡判斷 | 等價（上游僅換 ms 公式，無安全差異） |
| file-identity `statTimeMs` | fork `identityStats` 原用 `Number(ns)/1e6`；實測 400 個 utimes 檔 103 個與數字 stat 的 `mtimeMs` 不等，公式 `statTimeMs` 0 個不等 | **採用**（`src/lib/file-identity.ts:46,58`） |
| `cli-install-provenance.ts`（#8031） | 正式路徑 `src/codex/cli-install-provenance.ts:513-531,875-888` 用 helper；注入縫 `:549,810-830` 為數字，`sameFileIdentity` 對不安全整數 fail closed | 等價；不改注入縫 |
| `cli-update-artifacts.ts`（#8031） | baseline 無此檔（4118b90ba 在 v2.93.0 之後、v2.96.0 之內，defer） | 不適用；觸發條件：#7586／#7596／#7626／#7648 鏈整合 |
| guard 測試 declarationBody 修正 | fork 的 `scopes` 無物件型別回傳的宣告；全檔 guard 另有 `identityCallers` | 不適用 |

fork 自己的發現（上游沒有）：`codex-home-owner.ts:74`、`bounded-file-read.ts:114`、`adapters/codebuddy/mcp-server.ts:74-75` 對 `BigIntStats` 比 `*Ms`（bigint，截斷到毫秒），讀取穩定性檢查的時間粒度比原本的數字 stat 粗；改比 `*Ns`。codebuddy 為獨立子行程，無法 spy，僅靠 code review。

測試：`tests/lib/file-identity.test.ts`（statTimeMs、journal／config／local file 的 adjacent-ID、次毫秒時間變動）、
`codex-shim-windows-revision`（probe／state read／restore lock）、`codex-history-provider`（2）、`codex-main-account-refresh`、`codex-native-residue`、`native-main-owner-lifetime`、`remote-workspace`、
`codex-coordinator-doctor`、`codex-transition-state`、`codex-cli-install-provenance`（注入縫 fail closed）、`codex-shim-migration-time`（舊毫秒捨入 journal 容差仍受測）。
把 `sameFileIdentity`／`fileIdentityKey` 改成 `Number()` 比對的突變，會使 stable lock、main-account、residue、remote-workspace、shim 三案、coordinator、transition 等測試轉紅（history no-op snapshot 與 provenance 注入縫案例未做突變驗證）。coordinator／transition 兩個測試在本機因 MSIX 虛擬化無法原生執行，僅在暫時繞過路徑檢查（已還原）下驗證，詳見 `REVIEW.md`。

### `8eb970d9d`（#7928）

上游 diff 共 8 檔（src 3、structure 1、tests 3、layout 登錄 1）：其中 6 檔乾淨套用，2 個 layout 登錄（`layout-clients.json`、`test-layout-expected.json`；後者是測試側 fixture）因 fork 內容與上游不同，手動對應。
安全邊界：記錄與計費的 200 只留給客戶端已收到 terminal（`message_stop`／upstream `error` event）或最後 message event 為非 error `stop_reason` 且沒有被截斷的尾端；其餘 clean EOF 與重置同等處理（502、`terminalStatus: failed`、`api_error` frame）。
事件名與 payload `type` 必須一致才算證據；`anthropicEofTolerance` provider 保留內容式 EOF；done 讀取在 client abort 後算 499 cancel。

## 2026-11-04：Upstream check PR／issue 軸分類（#7614、#7618、#8161）

開工 `bun tools/check-upstream-updates.ts --strict`（fork 基準 `9d0efeb52`；上游 main `cab7eb7d0332ae0ebb4289d7c6bac1de666b6e40` 即 v2.97.0，2026-11-03 發布）列出：2 筆 closed-unmerged PR（#7614、#7618）、1 筆新 `platform` issue（#8161）、254 筆待審 commit（2026-11-03 為 209 筆，差額是 v2.96.0 之後到 v2.97.0 的新 commit），exit 1。本節只處理 PR 軸與 issue 軸；commit 軸（含 v2.97.0 新增的 45 筆）屬 `ROADMAP.md` 的 stable 整合列，`reviewed_through`、`reviewed_date`、`integrated_tag`、`integrated_through` 全部保持原值。

水位變動：`reviewed_pr_numbers` 加入 7614、7618（`reviewed_pr_through` 維持 8086、`reviewed_pr_closed_before` 維持 2026-10-28）；`reviewed_issue_through` 7860 → 8161。工具只列「open 且帶 `platform` 標籤」的 issue，這次水位以上只有 #8161 一筆，7861–8160 之間沒有待審項目，所以不是跳號推進。

| PR | 上游事實 | fork 證據 | 判定與觸發條件 |
| --- | --- | --- | --- |
| [#7614](https://github.com/lidge-jun/opencodex/pull/7614) owned Windows CLI child lifetime | closed 2026-10-28、未合併（作者 luvs01，96 檔 +7897/−335，含整條 updater stack）。新增 Windows x64 helper `src/codex/windows-cli-child.ts`／`-native.ts`／`-pipe.ts`：以 Job object 擁有行程樹、suspended 建立、STARTUPINFOEXW 限制繼承 handle、overlapped named pipe 讀輸出。PR 本文自述「No production consumer imports this helper yet, and Windows apply remains disabled」。維護者關閉理由：branch 的每個 commit 都在 #7648 內，已以 `c655484d9` 落 `dev`。`git show --stat c655484d9` 含這三檔（+260／+119／+87）與 fixtures；v2.96.0 tree 的 `windows-cli-child.ts:72`（`class WindowsCliChild`）、`:193,197`（`CreateJobObjectW`）同在。 | `src/codex/` 沒有任何 `windows-cli-child*.ts`，也沒有 `cli-update-apply`／`cli-update-job*`（只有 `cli-update-plan.ts`）；`src/codex/cli-update-plan.ts:501-502` 在 win32 一律回 `windows_inspection_deferred` 拒絕，不 spawn 任何 installer／npm 子行程。沒有 consumer，缺這個 helper 目前不造成行為缺口。 | 不另採：被 #7648（`c655484d9`）取代，該 commit 已在上方 205 筆清冊列為 defer（updater 鏈），隨整合列處理；上游明示不要並行落地兩個版本，所以不引用 PR 分支。觸發條件：#7586→#7596→#7626→#7648 這條鏈整合時，以 `c655484d9` 的最終版整體審 Job object、handle 繼承、ACL 邊界，並在非虛擬化 Windows 終端驗收。 |
| [#7618](https://github.com/lidge-jun/opencodex/pull/7618) separate Windows metadata toolchains | closed 2026-10-28、未合併（luvs01，20 檔 +252/−60，src 只動 `src/codex/cli-windows-plan-provenance.ts` +14/−5）。唯一的 src hunk：`if (pathNode) return fallback;` 改為 `if (pathNode && !deps.arch) return fallback;`，content proof 標籤 `windows-npm-read-only-plan-v2` → `v3`；意思是 PATH 解析出的獨立 Node/npm 只在 launcher 架構錨點存在時才當作 metadata 載具。PR 本文：預設 Windows 路徑仍 `target_unresolved` 拒絕、不 spawn npm metadata；並註明「read-only refusal tests here must not be copied unchanged over #7648's distinct verified-authority contract」。關閉理由同上（被 #7648 取代）；v2.96.0 `cli-windows-plan-provenance.ts:181,186` 已含 `pathNode && !deps.arch` → `refuse("launcher-arch")`。 | `cli-windows-plan-provenance.ts` 在 v2.93.0 基底不存在（`git cat-file -e refs/upstream-tags/v2.93.0:src/codex/cli-windows-plan-provenance.ts` 失敗），fork 沒有對應檔；Windows plan 由 `src/codex/cli-update-plan.ts:501-502` 直接拒絕。 | 不另採，理由與觸發條件同 #7614。整合時不得把本 PR 的 `codex-cli-windows-plan.test.ts` 與 drift-worker 測試單獨移植，須對照 #7648 的最終契約。 |

| Issue | 上游事實 | fork 證據 | 判定與觸發條件 |
| --- | --- | --- | --- |
| [#8161](https://github.com/lidge-jun/opencodex/issues/8161) macOS：5 秒 timeout 殺掉被 Keychain 解鎖提示卡住的 `security`，造成 securityd 當機與無限密碼提示 | open（2026-11-04 開，標籤 bug／account-pool／platform／service，回報版本 2.97.0／macOS 27）。`readClaudeKeychain`、`readClaudeKeychainAsync`、`keychainProbe` 在 login keychain 鎖定時以 5 秒 timeout 殺掉 `security`，觸發 Apple securityd 的 mutex race。回報者建議 keychain 鎖定時略過讀取，或不要殺阻塞中的子行程。尚無維護者回覆或修正 PR。 | 三個讀取點在 fork 都先以 `process.platform !== "darwin"` 早退：`src/oauth/local-token-detect.ts:78`、`:114`，`src/claude/auth-detect.ts:207`，Windows 上永不 spawn `security`。`src/claude/intercept/picker-trust.ts:17` 的 `/usr/bin/security` 只在 darwin 分支，`:69` win32 走 PowerShell runner。`src/oauth/meta-muse-keychain.ts:22-24` 沒有平台判斷，但 Windows 上 spawn 失敗只會落成 `keychain-unreadable`，且 issue 明示此檔不在範圍（120 秒 timeout，不殺使用者輸入密碼中的提示）。 | 不適用：fork 只支援 Windows，故障是 Apple securityd 的 macOS 專屬行為，fork 的執行路徑不會觸及。不是 fork 受影響的安全問題，不開 ROADMAP 近期列。重新評估條件：fork 重新支援 macOS，或這三個讀取點被改成跨平台。 |

### 監控中的 issue 複查（2026-11-04，讀 issue 與留言）

| Issue | 現況 | 與 2026-11-03 相比 | fork 對應 |
| --- | --- | --- | --- |
| #7771 Windows desktop 卡在 taking-over | 仍 open；2026-11-02 與 11-04 有新留言（kevin3669 回報 npm 2.96.0 的 `ocx service restart` 顯示「restarted and serving」，但舊 serving PID 與 wrapper 沒換；另一位貢獻者以 `dev` `72e80d280d` 靜態閱讀確認同一成因）。留言明說不是 taking-over 的重現，是同一個 wrapper 生命週期問題的另一面，尚無修正 PR。 | 有變動：新增一個獨立症狀。 | **fork 同構、未修**：`src/service/repair.ts:259` 只呼叫 `stopWindows`，`src/service/windows-ops.ts:842-848` 的 `stopWindows` 吞掉非 benign 的 `/end` 錯誤；`repair.ts:378` 之後直接 `/run`；`src/service/health.ts:59-78` 的 `confirmServiceServing` 只問該埠是否有任何 OpenCodex 在回應，`health.ts:160` 就印「service … and serving」。舊 listener 活著時會被當成成功。這是 Windows 主戰場的真實缺陷，但尚未在本機實測重現。判定：延後，不在 fork 自行 patch。觸發條件：上游修正或 PR 合併（隨整合列 `db7bdc5e3`／wrapper 生命週期相關 commit 一併審），或本機實際遇到重啟後舊 PID 存活，屆時升為 ROADMAP 近期列。 |
| #7808 | closed（2026-10-28），修正 `07161c5b9` | 無變動 | 仍在 ROADMAP 整合列 ③，未整合。 |
| #7810 | closed（2026-10-28），修正 `95cfa30ec`（已採用）、`fb22d055e`（defer） | 無變動 | 同上。 |
| #7815 config-root ACL 與 writer 重疊 | 仍 open；維護者以 #7826（`6bc511d1b`）、#7869（`fdc6dd82d`）、#7998（`19ab11394`）部分處理，同步 writer API 仍未涵蓋 | 新增 #7998 部分修正（10-30） | 三筆在清冊皆為 defer，隨整合列的 ACL 鏈一併審。 |
| #7827 | closed（2026-10-28），修正對應 `7a1565bb9`（#7851） | 狀態由 open 轉 closed | 清冊為「只分類、未審」，隨整合列。 |
| #7834 | closed（2026-10-29），修正 `c7f3928a2`（#7891） | 狀態由 open 轉 closed | ROADMAP 整合列 ④。 |
| #7854 | closed（2026-10-29），修正 `d588ca9d2`（#7885，僅測試暖機） | 狀態由 open 轉 closed | 清冊為「只分類、未審」，隨整合列。 |

這些「closed」只代表上游已修，fork 尚未整合（基底仍是 v2.93.0），不可記為 fork 已修復。

## 2026-11-04：多帳號 session／device／installation ID 隔離（`e04aae068`、`ba880dfae`、`007dbfd89`）

三筆作者皆為 JUN（上游 `lidge-jun`；信箱與 `Co-authored-by` trailer 以 `git log -1 <sha>` 為準，不抄進文件，`privacy:scan` 會擋）。上游 diff 以 `git diff <sha>^ <sha>` 讀全（24／18／57 檔）；`ba880dfae` 的 installation ID 衍生法（以 caller ID 與帳號做 HMAC）被 `007dbfd89` 整套取代（改為 config home 內的私有 secret），所以只重放最終狀態，中間狀態不落地。`reviewed_through`、`integrated_*`、PR／issue 水位全部不動（不是連續前綴）。

| 筆 | 判定 | 上游事實 | fork 證據（重放前，基底 `3281a4312`） |
| --- | --- | --- | --- |
| `e04aae068`（#7838）ID 隔離部分 | **採用** | pooled Claude OAuth 帳號各自的 `metadata.user_id.device_id` 改為 `sha256("ocx-claude-code-device-v1:" + 帳號 UUID)`；`X-Claude-Code-Session-Id` 由「每個 OAuth token 一個」改為「token＋對話 key」，key 取自 `_codexOwnThreadId`／`_clientThreadId`／`promptCacheKey`／caller 的 session 標頭或 `metadata.user_id.session_id` | `src/adapters/anthropic/account-metadata.ts:8-17` 只改 `account_uuid`，`device_id` 原樣轉給每個帳號（帳號 A、B 對上游共用同一 device）；`src/adapters/client-fingerprint.ts:35` `claudeCodeSessionId(token)` 同 token 的所有對話共用一個 session id；呼叫點 `src/adapters/anthropic.ts:1246`、`src/adapters/anthropic/passthrough.ts:302`、`src/server/messages-native.ts:485` 都不帶對話 key |
| `e04aae068`（#7838）Claude Code 2.1.280 profile 對齊 | **採用**（2026-11-04 後補；原判延後，維護者 2026-11-04 指示：上游做法合法可用即採用） | `User-Agent` `@anthropic-ai/sdk/0.74.0` → `0.112.1` 與 OAuth 路徑改用 `claude-cli/…`；`X-Stainless-OS/Arch` 改命名（`Windows`、`x64`）；新增 `anthropic-dangerous-direct-browser-access`；`X-Stainless-Runtime-Version` 固定 `v26.3.0`；`beta-allowlist.ts` 把 5 個 beta 從 unforwarded 移到 native-client；vision／web-search 兩處 UA | 重放前：`src/adapters/anthropic.ts:559`、`src/adapters/client-fingerprint.ts:16-27`、`src/vision/anthropic-describe.ts:182`、`src/web-search/anthropic-executor.ts:191` 仍是 `0.74.0`。重放後：`src/providers/claude-cli-identity.ts:13-14`（`CLAUDE_CLI_SDK_PACKAGE_VERSION`／`CLAUDE_CLI_RUNTIME_VERSION`）、`src/adapters/client-fingerprint.ts:20-56`（`stainlessOsName`／`stainlessArchName`、`anthropic-dangerous-direct-browser-access`）、`src/adapters/anthropic.ts:560`（key／相容路徑 SDK UA）與 `:589`（OAuth 路徑 `claude-cli` UA）、`src/adapters/anthropic/beta-allowlist.ts:51-87`（5 個 beta 改列 native-client）、`src/vision/anthropic-describe.ts:183`、`src/web-search/anthropic-executor.ts:192`。這 6 個檔與上游 `e04aae068` 的 tree 逐字相同（`git diff e04aae068 -- <檔>` 為空），其餘 hunk 在首輪已重放 |
| `ba880dfae`（#7840）turn-state scrub | **採用** | 帳號切換時刪除 `x-codex-turn-state` 標頭與 `client_metadata["x-codex-turn-state"]`，且不再因「對話狀態可攜」就提早 return | `src/server/responses/account-change-state.ts:260` 在可攜時直接 return、只掃 body；`:199` 之後沒有處理 `client_metadata`；轉送標頭清單 `src/adapters/openai-responses/transport.ts:13` 含 `x-codex-turn-state`，帳號 A 的 turn-state 會原樣帶到帳號 B |
| `ba880dfae`（#7840）installation ID 衍生 | **不適用（被取代）** | HMAC(caller installation ID＋帳號) 衍生 | 被 `007dbfd89` 取代；沒有任何 fork 發行版含過中間版，無需遷移 |
| `ba880dfae`（#7840）JSON token refresh、`ORIGINATOR` | **採用**（2026-11-04 後補；原判延後，維護者 2026-11-04 指示：上游做法合法可用即採用） | pool／main／`chatgpt.ts` 的 refresh 改送 JSON body；登入 `originator` 由 `opencodex` 改 `codex_cli_rs`；refresh 回應缺 `access_token` 即拋錯 | 重放前：`src/codex/account-store.ts:1381`、`src/codex/main-account.ts:117`、`src/oauth/chatgpt.ts:46,118` 為 form-urlencoded 與 `opencodex`，檔內註解寫「與 codex-rs 的刻意分歧」。重放後：`src/codex/account-store.ts:1380-1403`（JSON body＋`Accept`；缺 `access_token` 或空白即拋錯）、`src/codex/main-account.ts:115-126`、`src/oauth/chatgpt.ts:44-51`（`chatGptTokenRequest` 依 body 型別選 JSON 或 form；authorization_code 交換仍是 form）、`:122`（`ORIGINATOR = "codex_cli_rs"`）。`src/oauth/chatgpt.ts` 與上游 `ba880dfae` 的 blob 逐字相同（`git hash-object` 為 `9bd8aad6c`）；`main-account.ts`、`account-store.ts` 的 refresh hunk 與上游一致，其餘部分是 fork 自己的內容。`src/oauth/chatgpt-device.ts:166` 的 device flow 不在上游 diff 內，未動 |
| `ba880dfae`（#7840）`version` 標頭轉發 | **採用**（2026-11-04 後補；原判延後，維護者 2026-11-04 指示：上游做法合法可用即採用） | `FORWARD_HEADERS` 新增 `version` | 重放前 `src/adapters/openai-responses/transport.ts:10-15` 不含（首輪之後清單已搬到 `src/codex/forward-transport-headers.ts`）。重放後 `src/codex/forward-transport-headers.ts:17`；`headersForCodexAuthContext`、`buildResponsesTransport`、compact／chat／Claude 橋接都走同一份清單，Codex CLI 的 `version` 標頭會隨 pool／main／direct 轉送 |
| `007dbfd89`（#8065） | **採用**（除下列例外） | `src/codex/installation-id.ts`：config home 內私有 32 位元組 `codex-installation-secret`（無替換發布、`O_NOFOLLOW`、Windows 在寫入任何 key 位元組之前先對目錄與空暫存檔做 required ACL），每個帳號的 ID = HMAC(secret, 帳號)（UUIDv4 版面）；pool 帳號的標頭、turn metadata、`client_metadata` 一律以選定帳號 ID 取代，`main`／`main-pool` 與原本不存在的欄位保持原狀；secret 缺損時 pool 送出回可重試 503，不送出；`isCredential` 拒絕空白帳號 ID | `src/adapters/openai-responses/transport.ts:70-72` 只覆寫 `authorization`／`chatgpt-account-id`，caller 的 `x-codex-installation-id` 與 turn metadata 原樣帶給每個 pool 帳號；`src/codex/auth-context.ts:1811,1841,1925` 同；旁路面全部沒有隔離：`src/server/ws-bridge.ts:125-133`、`src/server/context-history.ts:137`、`src/server/search.ts:199`、`src/server/images.ts:777`、`src/server/live.ts:774`、`src/vision/describe.ts:74`、`src/web-search/executor.ts:89`、audio live／dictation 與 live-sideband 的 WebSocket 幀 |
| `007dbfd89` 例外 | **不適用** | `claude-messages.ts` 的 web-search 可用性探測遇 `CodexInstallationIdUnavailableError` 視為 helper 不可用；`claude-installation-helper.test.ts`；`passthrough-build-error.ts` 內的 `MuseToolCatalogCompatibilityError`；`compact.ts` 的 `resolveConnectTimeoutMs` | fork 的 `src/server/claude-messages.ts` 沒有 `bridge-only-policy`／`webSearchBackendAvailable` 區塊（`git grep -c webSearchBackendAvailable 3281a4312 -- src/server/claude-messages.ts` 為 0）；`muse-tool-catalog.ts` 不存在；`compact.ts:1062` 仍是 `config.connectTimeoutMs ?? 200_000`。觸發條件：整合上游這些功能時，一併補上探測的 installation 失敗分支與對應測試 |

**手動調整**（上游 diff 無法原樣套用或依賴 fork 沒有的上游中間 commit）：`src/server/claude-messages.ts` 的 hunk 整段不套用；`src/server/responses/compact.ts` 保留 fork 的 `connectMs`；`passthrough-dispatch.ts` 的錯誤分類改走新檔 `passthrough-build-error.ts`（移除 fork 沒有的 `MuseToolCatalogCompatibilityError`）；`src/server/responses/adapter-dispatch.ts` 兩處呼叫收成單行，因為該檔恰在 1999 行、上限 2000（`tests/responses/responses-core-modules.test.ts`）；`structure/transports/responses.md` 把新增的 3 行併成 0 行淨增，維持 600 行預算；`codex-installation-acl.test.ts` 的 `verifySecretPathAcl`（fork 沒有 `windows-owner-acl`）改為本檔內以 `icacls` 輸出確認無繼承 ACE 的輔助函式；`codex-installation-invalid-account.test.ts` 刪掉 fork 沒有的 `inspectLocalCodexCredentialSlots` 斷言；`codex-metadata-integrity.test.ts` 當時刪掉的 `version` 標頭斷言已於同日後補時加回；`scripts/test-layout/layout-codex-collision.json`、`tests/fixtures/test-layout-expected.json` 登錄 11 個新測試檔；`structure/INDEX.md` 由 manifest 重新產生；zh-tw `codex-integration.md` 補一段繁中說明。

**持久化相容性**：Claude 側 device／session ID 都是確定性衍生，沒有任何新檔；升級後同一帳號每次得到同一 device ID（與升級前不同，這是預期的隔離效果，無法保留舊值因為舊值是 caller 的）。Codex 側新增 `<config home>/codex-installation-secret`：升級前不存在，第一次 pool 送出時以無替換方式建立；已存在且長度為 32 的檔案原樣採用，長度不符或不可讀一律拒絕、不覆寫、不輪替（`tests/codex-integration/codex-installation-id.test.ts` 兩個新案例釘住）。`codex-accounts.json` 格式未變，但 `chatgptAccountId` 為空白的紀錄現在不被視為有效憑證（讀取為 null，同檔的其他帳號不受影響，`codex-installation-invalid-account.test.ts` 新案例釘住）；這類紀錄原本送出時帶空的 `chatgpt-account-id`，無法對 ChatGPT 成功。降版後 secret 檔只是閒置檔案，舊版不讀它。

**行為變更**：pool 帳號對上游看到的 `x-codex-installation-id` 由 Codex CLI 自己的值改成該帳號專屬值；Direct 與原生主帳號不變。secret 無法安全讀寫時（例如 config home 在不支援 ACL 的磁碟、icacls 失敗）pool 送出回 503 而不是靜默沿用 caller 的 ID。這是上游刻意的 fail-closed 設計。

**測試**：見 `docs/fork/DECISIONS.md` 同日條目。

## 2026-11-05：canonical forward 的 `safety_identifier`、Windows fixture 命名空間隔離、無磁碟代號根路徑（`67bdeb03a`、`fb22d055e`、`07161c5b9`）

三筆的上游 diff 都以 `git show <sha>` 讀全（3／8／26 檔），fork 基底 `eea76a63b`。`67bdeb03a` 作者 Harsha Vardhan（GitHub noreply 信箱）；`fb22d055e`、`07161c5b9` 作者 JUN，`Co-authored-by` trailer 為上游 `lidge-jun`；信箱以 `git show -s --format='%an <%ae>' <sha>` 為準，不抄進文件（`privacy:scan` 會擋）。`reviewed_through`、`integrated_*`、PR／issue 水位全部不動（這三筆不是連續前綴）。

| 筆 | 判定 | 上游事實 | fork 證據 |
| --- | --- | --- | --- |
| `67bdeb03a`（#8030） | **採用** | canonical-only 丟棄清單由 `metadata`、`max_output_tokens` 加上 `safety_identifier`（上游 `src/adapters/openai-responses/canonical-forward.ts:110-112`）；droid 的 BYOK 會依模型名稱附帶該欄位，ChatGPT Codex 後端以嚴格 allowlist 回 400 `Unsupported parameter: safety_identifier`。其餘 100 餘行是上游 formatter 重排，不重放 | 重放前 `src/adapters/openai-responses/canonical-forward.ts:83` 是 `canonical ? ["metadata","max_output_tokens"] : ["metadata"]`，唯一呼叫點 `src/adapters/openai-responses/passthrough.ts:272` 以 `isCanonicalOpenAiForwardProvider(provider)` 傳入。重放後 `canonical-forward.ts:88-92`；`tests/responses/responses-forward-prompt-envelope.test.ts` 兩個案例改釘「canonical 丟 `user`＋`safety_identifier`、其他目的地兩者都保留」。`tests/responses/responses-canonical-only-top-level-fields.test.ts:89-95`（第三方 key 閘道保留 `safety_identifier`）不變且仍綠 |
| `fb22d055e`（#7852）preload／owner helper、catalog 測試 | **採用**（原樣） | `tests/helpers/fixture-namespace-owner.ts`（nonce 標記檔）、`tests/helpers/fixture-windows-runtime-preload.ts`（子行程 preload：fixture home 必須在受保護樹之外、擁有者 nonce 相符，才把 `resolveWindowsLocalAppData` 指向 fixture 私有目錄）、`tests/ci-workflows/fixture-windows-runtime-preload.test.ts`（31 案）、`catalog-auto-review-row` 的子行程改走 preload | fork 的依賴齊全：`src/codex/windows-local-appdata.ts:79` 的 `resolveWindowsLocalAppData`、`src/lib/test-home-guard.ts:125,130,135,176,243,434`（preload 呼叫的 guard 匯出）。重放前 `tests/codex-integration/catalog-auto-review-row.test.ts` 與 v2.93.0 逐位元相同，子行程直接讀帳戶共用的 `%LOCALAPPDATA%` 命名空間 |
| `fb22d055e` `sibling-home-client-sync` | **採用（手動適配）** | 「lone custom-home start」的 `start`／`ensure` 子行程加 `--preload` 與 owner 環境變數 | 上游補丁因中間的 `a4e4cda1d`（本表判 skip）而無法套用：fork 的 `tests/cli/sibling-home-client-sync.test.ts:402-430` 用 `reservation` 預留埠並傳 `--port`。手動把同樣的兩處 spawn 改為 preload＋`createFixtureNamespaceOwner(fx.root)`，其餘不動。重放前（HEAD 版本）該案例逾時失敗兩次，重放後通過兩次，見 `DECISIONS.md` 同日條目 |
| `fb22d055e` `cli-start-auxiliary-bind` | **不適用** | 把對「被佔住的 public canary」的 `fetch` 改為 `directLocalHttpFetch`，避免環境 `HTTP(S)_PROXY` 代答 | fork 的 `tests/cli/cli-start-auxiliary-bind.test.ts:53-54` 沒有該 `fetch`（只做 `Bun.serve` 重綁再停止），canary 是 `a4e4cda1d`（#7847，上游測試重構）才加入。觸發條件：之後若採用 `a4e4cda1d`，同時補上這個探測 |
| `07161c5b9`（#7824）client 路徑 | **採用** | `src/clients/client-path.ts` 新增 `isAbsoluteClientPath(raw, platform)`（Windows 要求磁碟代號或 UNC，拒絕 `\Users\x`、`/x` 這類依賴目前磁碟的根路徑），`absoluteClientPath` 多一個 `platform` 參數；所有原本直接呼叫 `isAbsolute` 的 client 路徑解析點改走它 | 重放前 `src/clients/client-path.ts:28`、`src/clients/config-export.ts:398`（DSH）、`:473`（ZCode bootstrap）、`:495`（Command Code，`win32.isAbsolute`）、`src/clients/gentle-shell-path.ts:14`、`src/clients/config-export/agent-clients.ts:18`、`src/clients/config-export/qoder.ts:19` 都用 `node:path.isAbsolute`，在 Windows 接受 `\Users\x`。重放後全部改用 `isAbsoluteClientPath`（`client-path.ts:25`）；Qoder／WorkBuddy 的 resolver 收斂成 `absoluteClientPath`。新增 `tests/clients/client-path.test.ts`（39 案，跨平台語意在任何主機驗證），既有 6 個測試檔的假路徑改為有磁碟代號的值 |
| `07161c5b9` T3 Code、五語系文件 | **不適用** | `t3code.ts` 的 `T3CODE_HOME`、`t3code-client-lifecycle.test.ts`；fr／ja／ko／ru／tr／zh-cn 的 integrations 文件 | fork 沒有 `src/clients/config-export/t3code.ts` 與該測試（`git apply --check` 回 No such file）；docs-site 只保留英文與 zh-tw。英文與 zh-tw 的說明段已加。觸發條件：整合到引入 T3 Code client 的上游提交時，`t3code.ts` 的 `absoluteClientPath(..., platform)` 一併帶入 |

**手動調整**：`scripts/test-layout/layout-clients.json`、`tests/fixtures/test-layout-expected.json`、`structure/clients/integrations.md`（fork 的 module 列較短，把上游新增句併入同一列）、`src/clients/gentle-shell-path.ts` 三處在 `git apply` 失敗後手動套用，內容與上游相同。

**行為變更**：Windows 上 `QODER_CONFIG_DIR`、`QODERCN_CONFIG_DIR`、`WORKBUDDY_CONFIG_DIR`／`CODEBUDDY_CONFIG_DIR`、`PI_CODING_AGENT_DIR` 等覆寫值，過去接受的 `\Users\x`、`/x` 現在以 `ClientPathError` 拒絕（訊息提示用磁碟代號或 UNC）；canonical ChatGPT 目的地不再收到 `safety_identifier`。安全邊界逐檔判定與測試證據見 `docs/fork/DECISIONS.md` 同日條目。

## 2026-11-05：ACL memo 復原與 Responses CR 分隔（`c7f3928a2`、`d42b9b1b2`）

fork 基準 `6f7bfbe46999df18c43af8e7bcee50b651d2419d`。兩筆 `git show` 完整 diff 已讀（7／5 檔）；依技術可用性、Windows 適用性及安全回歸採用。兩筆作者皆為 JUN；`c7f3928a2` 另列 JohnnyXu、`d42b9b1b2` 另列 oocheol 的共同作者 trailer。整合提交用的信箱從 `git show -s --format='%an <%ae>' <sha>` 與原提交 trailers 取得，不寫入文件。`f94e95ce5` 不在此區段；`tools/upstream_baseline.json` 完全不動。

| 提交／上游檔案 | 判定 | fork 證據與觸發條件 |
| --- | --- | --- |
| `c7f3928a2` `src/config/atomic-write.ts` | 採用（適配既有 writer） | 重放前 `:205,245,268,303,446` 的五個 harden 呼叫均未 opt in，首次逾時會讓後續同目的地寫入被 timeout memo 永久拒絕。重放後 `:230,270,293,331,477` 明確 opt in；`:37-55` 追蹤 resolved destination 的所有暫存檔，只有保留未回收 ACL child 時拒絕新寫入；`:366,503` 的 cleanup 不消耗復原，`:395,539` 在實際 child reap 後釋放 admission。fork 的 bigint file identity、no-follow、owner manifest 與 residual-temp 流程保留，不帶入上游後續 exclusive publication 擴充 |
| `c7f3928a2` `tests/windows/windows-atomic-write-acl-rearm.test.ts` | 採用（原樣） | 23 案涵蓋 sync／streamed／async、五個 harden 呼叫、重設時間界線、denied、清理、健康重疊、多個 retained child 及實際回收後復原；runner 與 clock 均為確定性注入 |
| `c7f3928a2` `tests/server/config.test.ts` | 採用 | `:3443-3447` 保留 required 與 destination 的精準斷言，加上 `retryTimedOutOnce: true` |
| `c7f3928a2` `scripts/test-layout/layout.json`、`tests/fixtures/test-layout-expected.json` | 採用 | 兩份對應表均在既有 `windows-acl-start-cost` 後登錄新檔；layout 與 tooling guard 分別 2／27 pass |
| `c7f3928a2` `structure/config.md` | 採用（適配現有段落） | `:73` 說明 admission、五分鐘復原及 fail-closed；以 suite 名稱描述回歸涵蓋範圍 |
| `c7f3928a2` 英文 `troubleshooting/windows-acl-timeouts.md` | 採用 | 原樣新增使用者說明，並新增同名 zh-tw 翻譯；不更改 ACL 時間常數、不新增 timer |
| `d42b9b1b2` `src/web-search/parse.ts` | 採用 | 重放前 `:323` 只按 LF split，CR-only 事件黏成同一行，可能漏掉文字／引用／terminal，甚至多讀一次 transport。重放後 `:323-324` 採用上游的 CR／LF／CRLF regex；跨 chunk CRLF 只多出會被忽略的空行。既有 clean EOF、wire／decoded 上限及取消 reader 不變 |
| `d42b9b1b2` `tests/web-search/web-search-eof.test.ts` | 採用（新增區塊原樣） | `:86-143` 驗證四種 line ending、一個 chunk／單 byte UTF-8 chunk、引用、失敗訊息、缺 terminal 與立即取消；原 EOF／size limit 案例保留 |
| `d42b9b1b2` `structure/data-planes/search.md` | 採用（適配現有段落） | `:63` 的 EOF 契約加上 line ending 與 cancellation 說明 |
| `d42b9b1b2` 英文 `guides/sidecars.md` | 採用 | `:287` 加上 CR／LF／CRLF 與跨 chunk 說明，zh-tw `:217` 同步 |
| `d42b9b1b2` 韓文 `ko/guides/sidecars.md` | 不適用 | fork 只保留英文與 zh-tw，該檔不存在；不恢復已移除語系，若恢復韓文時再帶入相同說明 |

`structure/INDEX.md` 所列相關 runtime、native-reasoning-retention、fallback-policy、anthropic-progress、providers-and-adapters 已覆核；其局部說明仍正確，不複製 config／search 的權威契約。安全邊界逐檔判定見 `DECISIONS.md` 同日「ACL memo／CR」節，實測紅綠與 gate 見 `REVIEW.md`。完整 stable tag 重放與連續 commit 審查尚未完成，因此不推進 integrated／reviewed 水位。

## 2026-11-05：`f94e95ce5` structural tool turns（durable principal／HMAC membership／ingress）

fork 基準 `7b3c6ec1d`。`git show f94e95ce5` 的 31 檔完整 diff 已讀；原 defer 的理由是「尚未讀完整 diff 與跨 ingress 回歸」，現已補齊。作者 Platinum-Scripts，共同作者 JUN；兩者的 trailer 取自 `git show -s --format='%an <%ae>' f94e95ce5` 與原提交訊息，保留在整合提交，文件不寫信箱。`git apply --check` 顯示所有 `src/`、`tests/`、`docs-site/`、`structure/manifest.json` hunk 無衝突（最多偏移 25 行），唯二需手工合併的是 `structure/INDEX.md`（fork 有 codex-installation-identity 列，依字母序併入）與 `tests/fixtures/test-layout-expected.json`（單行 JSON，插入新測試）。整筆重放，無部分採用。

功能性質：**預設關閉**。只有行程環境變數 `OPENCODEX_RESPONSE_TURN_SIGNING_KEY`（`dr_turn_v1_` 加 43 字 base64url，解出恰好 32 bytes）存在，且請求帶有效的 `x-opencodex-api-key`、自己的 `thread-id`，才啟用簽章輸出 item ID 與入口重排；另需 provider 設定 `x-opencodex-tool-completion: block-stop-v1` 並由上游回同值標頭，才會提早送出已完成的 tool call。fork 未設定這些，行為與重放前逐位元相同（`tests/bridge`＋`tests/adapters/openai` 40 檔 972 pass／0 fail）。唯一例外（上游刻意設計）：金鑰未設定時，`src/adapters/openai-chat.ts:104` 會從送出的 header 副本移除 provider 設定裡的 `x-opencodex-tool-completion`，provider 設定本身不變；格式錯誤的金鑰會讓功能靜默關閉、不記警告。

| 上游檔案 | 判定 | fork 證據 |
| --- | --- | --- |
| `src/responses/turn-membership.ts`（新，111 行） | 採用 | `TurnTokenCodec` `:56`；tag 驗證 `:89` 以 `timingSafeEqual` 比較等長 16 bytes；`normalizeGroups` `:18`。fork 無對應功能，無衝突 |
| `src/server/responses/turn-membership.ts`（新） | 採用 | env 金鑰格式與長度驗證、僅取請求自己的 `thread-id`（不用 parent／session cohort）、未啟用回 `undefined` |
| `src/server/auth-cors.ts` `resolveDurableReplayPrincipal` | 採用 | `:517`。用既有 `resolveDataPlaneAdmissionSecret`（`:449`）驗證 dedicated header，不改既有 `resolveContextPrincipal`（`:500`）。fork 獨有的 `linkIngress` 白名單（`:461`）不被削弱：link 入口的 admission 由 dedicated header 先決（`:646,673`），此處再解同一 header，要求 kind 與 keyId 相同，否則拒絕 |
| `src/server/responses/request-prepare.ts` | 採用 | 解析前呼叫 `normalize`（`:471`）；`completedToolBlocks` 僅在 `responses` 入口、串流且非 compaction 時為真（`:1652`） |
| `src/server/responses/adapter-delivery.ts`、`adapter-dispatch.ts`、`request-transport.ts` | 採用 | 簽章 ID 工廠僅在 openai-chat 串流、非 chat／anthropic 入站、非 compaction／advisor／client encoder 且回應標頭協商成功時建立（`adapter-delivery.ts:134`）；initial、retry、queued rebuild 都傳同一旗標（`adapter-dispatch.ts:340,657`、`request-transport.ts:913`）。continuation 與 sidecar 路徑未傳 context，等於不啟用 |
| `src/bridge/sse.ts` | 採用 | 七處 `uuid()` 改為 `outputItemId(...)`（`:417,446,469,937,992,1051,1111`），未提供工廠時回退原 `prefix_uuid`，輸出不變 |
| `src/adapters/base.ts`、`openai-chat.ts`、`openai-chat/completed-tool-blocks.ts`（新）、`required-tool-result.ts`、`serialized-tool-call-content.ts`、`unique-tool-call-ids.ts` | 採用 | 沒有 per-exchange context 時 `buildRequest` 刪除協商標頭（`openai-chat.ts:105`）；`completedToolBlocksEnabled`（`:295`）要求 context、provider 標頭、回應標頭三者齊備且非 inline-think 模型；錯誤序列直接終止（`:511-512`）；`hasHeldEvents` 避免工具超前於暫存文字。fork 的 `workbuddy.ts:49`、`anthropic-progress.ts:60`、`zed.ts` 等其他 wrapper 不轉送 context，故永遠不啟用，這是刻意的保守（上游也未改） |
| `tests/responses/turn-membership.test.ts`、`turn-membership-ingress.test.ts`、`tests/server/data-plane-admission-identity.test.ts`、`tests/adapters/openai/openai-chat-parallel-stream.test.ts`、`tests/helpers/*` | 採用（原樣） | 見下方紅綠；ingress 測試走實際 `handleResponses`，不 mock 目標模組 |
| `scripts/test-layout/layout-replay.json`、`tests/fixtures/test-layout-expected.json` | 採用（fixture 手工合併） | 兩個新測試登錄為 `responses`；`tests/test-layout*.test.ts` 2／27 pass |
| `structure/**`、docs-site `providers.md` | 採用（INDEX 手工合併） | 新增 `providers/completed-tool-blocks.md`、`transports/response-turn-membership.md`；`bun run structure:check` 通過。docs-site 英文 `headers?` 列加實驗性說明，zh-tw 同列（該列本就是英文原文）同步加上 |

紅綠：先只放入測試檔（舊 runtime）——`turn-membership.test.ts` 0 pass／1 fail（模組不存在）、`turn-membership-ingress.test.ts` 0／1、`data-plane-admission-identity.test.ts` 0／1（缺 `resolveDurableReplayPrincipal` 匯出）、`openai-chat-parallel-stream.test.ts` 46 pass／5 fail（五個 negotiated block-stop 案例：提早送出、重複標記終止、跨 index／ID 偽造、24 個反序標記、後續錯誤保留已關閉呼叫）。重放後 53／2／28（原 25）／51（原 39）全部 pass、0 fail。

仍不推進任何水位：`tools/upstream_baseline.json` 不動。全版 tag diff（含 `d9e0c057881` 之類依賴本筆的 additional_tools 變更）與 Windows-only 重放驗收是另一項工作，記在 `ROADMAP.md`。

## 2026-11-05：`d9e0c057881` additional_tools／current catalog 隔離

fork 基準 `688b04a0e3a00a417e0b7492b8d682ed07d1b174`。已讀上游 45 檔完整 diff，逐檔採用／改寫／不適用與 fork 行號見 `DECISIONS.md` 同日節。依賴 `f94e95ce5` 已重放；此項只讀取內部 replay prefix，不修改 durable principal／簽章 scope。

採用官方 xAI／OpenCode Go 的工具目錄提升、forward 明確 opt-in、任何 provider 都可用 `promoteAdditionalTools: true` 明確啟用（含 forward）、historical/live symbol provenance、discovery 合併前過濾、namespace 分離去重，以及管理 API 的 validation／carry／DTO。fork 缺少 Zed 提升前置流程，補入最小 helper／caller；Meta catalog 專屬 hunk 因模組不存在判不適用。六個已刪語系不恢復；英文／繁中保留 keychain 原位，僅同步本設定及 carry 契約。

上游作者 JUN，共同作者 Omar；歸屬取自 `git show -s --format='%an <%ae>' d9e0c057881` 與原提交 Co-authored-by；整合提交須保留這兩人的 Co-authored-by 歸屬，文件不寫 email。紅綠與逐檔測試／fork gate 證據見 `REVIEW.md` 同日節。

`tools/upstream_baseline.json` 完全不動；integrated／reviewed、PR／issue 水位維持原值。這筆的審查不代表其餘 defer 項或完整 stable 區段已通過。

## 2026-11-05：全版 tag diff 重放 `v2.93.0..v2.97.0`（2026-11-06 驗收完成，水位已推進）

`git diff refs/upstream-tags/v2.93.0 refs/upstream-tags/v2.97.0` 共 1980 個檔案（658 新增、1322 修改、0 刪除；`v2.97.0` = `cab7eb7d0332ae0ebb4289d7c6bac1de666b6e40`），
以單一 parent、不 merge 上游的 tag-diff 法套到 `main`（fork 基準 `ed36b929a`）。逐檔清冊（路徑、上游狀態、重放前分類、重放後與上游 blob 的關係、判定、備註）在
[`upstream-v2.93.0-v2.97.0-files.tsv`](upstream-v2.93.0-v2.97.0-files.tsv)，由 blob 雜湊比對機器產生，**不手改**；本節只寫方法、數字與例外。

### 方法

1. 以 `git ls-tree` 比對三個 blob（`v2.93.0`、`v2.97.0`、fork `HEAD`）分類：fork 與 `v2.97.0` 相同＝已等價；fork 與 `v2.93.0` 相同＝乾淨採用（直接取上游 blob）；
   上游新增而 fork 沒有＝新增；其餘（fork 與雙方都不同）以 `git merge-file --diff3` 三方合併，衝突逐 hunk 判定。
2. Windows-only 刪除清單先套：`REMOVED_FILES`／`REMOVED_DIRECTORIES` 命中者、已刪語系（`FORK.md` 差異表：docs-site 的 fr／ja／ko／ru／tr／zh-cn、`readme/` 譯本、`gui/src/i18n` 非 en／zh-tw）一律不重放。
3. 生成物（`scripts/ci/test-durations*.tsv`、`scripts/test-layout/*.json`、`tests/fixtures/test-layout-expected.json`、`structure/manifest.json`、`structure/INDEX.md`）取上游版再剔除 fork 沒有的測試、補回 fork 獨有條目，不手工逐行合。

### 計數（1980 個上游變更檔）

| 判定 | 檔數 | 說明 |
| --- | --- | --- |
| 已等價（重放前 fork blob 即與 `v2.97.0` 相同） | 76 | 2026-11-04／05 零星重放過的檔案 |
| 採用（重放後與 `v2.97.0` blob 逐位元相同） | 1556 | 含乾淨採用、新增檔，以及衝突全取上游者；每檔來源類別見 TSV 的 `fork_before` 欄 |
| 適配（重放後與上游不同，fork 保留／改寫部分 hunk） | 157 | 逐檔原因在 TSV 備註欄；安全邊界檔另見 `DECISIONS.md` 同日條目 |
| 不適用 | 191 | 已刪語系 188（docs-site 六語系頁、`readme/`、`gui/src/i18n`、`gui/tests/fr-localization`）、Windows-only 刪除清單 3 |
| defer | 0 | 沒有以 defer 結案的檔案；未完成項見下方「尚未完成」 |

### 適配重點（不是單純取上游）

- **檔案 identity 叢集**：上游 `#8019` 系列把比對統一成 `lstat/fstat(…, { bigint: true })` 加 `sameFileIdentity`。fork 先前自建 `identityStats`／`statFileIdentity` 一組 helper，兩者語意等價（2026-11-04 清冊已記）。
  本輪**採上游設計**：identity-only 的 15 個 caller 整檔取上游（`native-residue`、`native-main-lock-file`、`shim-fingerprint`、`shim-restore-lock`、`transition-state`、`workspace-executor` 等），
  `native-residue.ts` 改回單次 bigint stat，使 `codex-native-residue` 的「相鄰大 file ID」測試轉綠（先前 `statFileIdentity` 路徑下該測試回 `clean`）。fork 的 `src/lib/file-identity.ts` helper 超集保留（`validStoredFileIdentity`、`storedFileIdentity` 仍被 `shim-state-file`、`shim-migration`、`shim-overlay`、`filesystem-evidence` 的持久化格式使用）。
  `src/lib/bounded-file-read.ts`、`src/codex/shim-state-file.ts` 保留 fork 版（上游 hunk 只是 identity 換寫法）；`src/codex/history-provider.ts` 保留 fork 的 TOCTOU 加固並套上游 `withWriteGuard` 與三個 bigint scope（`tests/lib/file-identity-callers.test.ts` 29 案過）。
- **`src/config/atomic-write.ts`** 整檔取上游（含 `c7f3928a2` 的完整後續與 exclusive publication）；先前 2026-11-05 的 fork 適配版是它的子集。逐檔安全判定見 `DECISIONS.md`。
- **CI**：`ci.yml` 保留 fork 的 Windows-only 結構，套用上游的 Windows 11 分片、`bash scripts/ci/bun-install-frozen.sh`、`setup-project-bun` 與 `bun@1.4.4` pin；macOS／Linux／docker 的 job、filter 與輸出不重放（`REMOVED_CI_JOBS` 不變）。
- **語系**：`scripts/client-support-matrix/locales.ts` 剔除 fr／ko／zh-cn／ru／ja／tr 區塊（Hangul 與非保留語系）；`docs-site/astro.config.mjs` 側欄只加 zh-TW 標籤；`tests/usage/request-outcome-agreement.test.ts` 還原 fork 的 `LOCALES = ["en", "zh-TW"]`（重放曾把它換回上游十一語系）。
  zh-tw 頁面中原先以英文原文補入的區段（三個新頁 `guides/lm-studio`、`reference/configuration/catalog`、`reference/configuration/keychain` 與其餘約 30 個區段）已逐段譯為繁體中文；章節標題改譯後，站內 `#fragment` 連結同步改指新 slug（`docs-zh-tw-parity`、`docs-link-targets`、`docs-developer-role-policy` 通過）。
  刻意保留英文的是：程式碼區塊內的指令與 JSON、產品與端點名稱，以及基準 `ed36b929a` 就已是英文的段落中被上游改動的零星行（`reference/cli/agents.md` Codex CLI 更新計畫段、`reference/cli/lifecycle.md`／`messaging.md`／`configuration/server.md` 的少數接續行），這些屬舊有的英文段落，不是為了過 parity 而補入。
- **還原一項刪除**：`tests/clients/link-ssh-argv-discovery.test.ts` 在 `v2.97.0` 新增 7 個 Windows 原生案例（Windows 遠端連結的 PowerShell Job 容器、OpenSSH 通道）。它已不是「只在非 Windows 跑」的測試，故從 `REMOVED_FILES` 移除並採用上游版（POSIX 案例仍 `skipIf(win32)`）。
- **README.md** 不重放：fork 的 `README.md` 是繁中主文件、`README.en.md` 是 fork 自寫英文版，上游的橫幅與 npm 安裝說明對 fork 不成立。
- **版本**：`package.json`、`desktop/src-tauri/Cargo.toml`／`Cargo.lock`／`tauri.conf.json` 取 `2.97.0`（updater 設定不變）。

### 本機驗證

- `bun install --frozen-lockfile` 還原 `@types/bun` `1.4.4` 後 `bun run typecheck` exit 0（2,305 個檔案）。
- `privacy:scan`、`structure:check`、`file-size-ratchet`、`docs:clients:check` 通過；`docs-zh-tw-parity`、`docs-link-targets`、`docs-developer-role-policy` 通過。
- **orchestrated update 閘門**：上游新增的 orchestrated 子程序與 apply 路徑（`bin/ocx.mjs` 的 `runPackageManagerSelfUpdate(…, childArgs)` 與 `applyNodeOrchestratedUpdate`）先前排在 fork 的 `update` 拒絕之前，會直接安裝上游 registry 版本。
  已在它們之前加 `if (orchestratedUpdate && forkSelfUpdateBlocked())`：apply 輸出 `ocx.update.result/1`（`error: "fork-self-update-disabled"`）並 exit 10，plan 輸出 `canApply: false`，child 模式 exit 10。
  `src/update/index.ts` 的 `runUpdate`、`job.ts` 的 `startUpdateJob`、`async-check.ts`／`latestVersion` 的 registry 查詢、`updateCommand` 原本就被擋。`tests/update/fork-update-policy.test.ts` 新增 4 案釘住（含閘門在所有安裝呼叫之前的順序檢查）。
- 新的 `tests/update/update-mutation-guard.test.ts` 對 `fork-source.mjs` 的 import 與新增的 `process.exit` 站點報未審查；已把這五個 import 登記到 `tests/helpers/update-import-policy.ts`，並把 `update-process-allowlist.ts` 的 `process.exit(0／1／10)` 次數各加 1。
- `tests/ci-workflows/ci-bun-install-frozen.test.ts` 的 Ubuntu 工作清單縮為 fork `ci.yml` 實有的 `test-changed`、`gates`。
- `codex-native-residue`：3 個失敗皆是 `readCodexTransitionState()` 回 `unavailable`（MSIX 虛擬化 `%LOCALAPPDATA%` 的 coordinator 路徑，已知環境限制）。

### CI 後續修正（`ci/tagdiff-v2.97.0`，全量 run 42036121637 的首個失敗）

重放把 fork 先前硬化過的檔案整檔取上游，或把 fork 獨有測試錯放；下列逐項已修。TSV 清冊是重放當下的機器產物，不手改，所以以下各檔的
「與 `v2.97.0` 逐位元相同」描述以本節為準。

| 失敗 | 原因 | 修正 |
| --- | --- | --- |
| `routing-policy-surface-parity`：no-eligible 的 chat 回應 | 上游 `projectLocalModelRefusalLog`（`#8108`）在 Chat Completions 把含未知候選的 `routeDecision` 清掉，fork 的測試要求四個 wire 都保留評估 trace；上游 `chat-error-body-normalization` 則釘住 Chat 文字為 `No eligible candidates for policy profile: <client selector>`，與 fork 測試的固定小寫句互斥 | `src/server/chat-completions.ts`：訊息維持上游文字，只在投影後把 `err.trace` 放回 `logCtx.routeDecision`；fork 的 parity 測試對 chat wire 改驗上游前綴，其餘三個 wire 仍驗固定句與不含 profile id |
| `responses-native-main-refresh`：JSON 更新 body 測試 | 重放時 `install401ThenRefreshHarness` 取了上游版（不記 `wires`），fork 的 `#7840` 測試被重複貼到 `describe` 外 | `tests/responses/responses-native-main-refresh.test.ts`：harness 還原為記錄 `wires` 的 fork 版，移除檔尾重複測試 |
| `codex-legacy-config-keys`：超過 1 MiB 回 `not_a_file` | `src/codex/inject/bounded-config-reader.ts` 整檔取上游，失去 fork 的 `EFBIG`（`configTooLarge`）區分；改回 fork 的 `statFileIdentity` 版又違反上游 `tests/lib/file-identity-callers.test.ts` 的 bigint tripwire | 以上游版為底（`statSync(…, { bigint: true })`），只加 `configTooLarge()`：非一般檔仍丟 `not a bounded regular file`，超過 1 MiB 丟 `EFBIG` |
| `fork-hygiene`：maintainer markdown links | `/docs/` 在 `.gitignore`，新 TSV 沒有 `git add -f`，CI checkout 找不到 | `git add -f docs/fork/upstream-v2.93.0-v2.97.0-files.tsv` |
| `codex-cli-windows-plan`：unsafe ledger 回 403 | 上游 `#8008` 要求 paired dashboard session（`ctx.sessionControl.isPaired`），上游沒更新這個 Windows 專用測試（macOS／Linux 皆 skip） | 測試 ctx 加 `sessionControl: { isPaired: () => true }` |
| `codex-profile-preservation`：refusing to run against a Codex profile outside a test home | 守衛的允許清單用 `userInfo().homedir` 辨認沙盒 HOME；Windows 上它跟隨 USERPROFILE，沙盒把它換掉後與 `HOME` 相同，且 preload 的 `CODEX_HOME` 不一定在 `HOME` 底下（POSIX 取自 passwd，不受影響） | `tests/codex-integration/codex-profile-preservation.test.ts`：守衛改為只拒絕落在真實 Codex home（`protectedCodexHomeForTests()`）之下的 profile 路徑 |
| `windows-codex-cli-job-store`：HTTP apply 回 403 | 同 `#8008`，上游未更新這個 Windows 專用 fixture | 測試 `managementCtx` 加 `sessionControl: { isPaired: () => true }` |
| `messaging-remote-store`：temporary／post-rename ACL 案例回 `unsafe_remote_storage` | 合併後測試的 `fstatSync` mock 回到上游的數字 `uid`／`mode`，fork 的 `remote-files.ts` 走 `fstatFileIdentity`（bigint stat） | 還原 fork 的 `fstatSync(fd, options)` mock（`uid: 1234n`、`mode: 0o100600n`） |
| `chat-error-body-normalization`：policy alias refusal 的 request row | 先前我在 chat 投影後把 `err.trace` 放回，trace 內含 profile id，違反上游 row 不得含 profile id；上游行為為準 | `src/server/chat-completions.ts` 與上游逐位元相同；parity 測試對 chat wire 不要求 `routeDecision` |
| `client-link-stop`「a separate sync finishes before signal restoration (catalog)」 | 上游測試用 `realpathSync(root)` 讓 fixture 的 native 備份與 sync 記錄的正規路徑同拼寫，但 JS 版 `realpathSync` 不展開 Windows 8.3 短名（CI 的 `RUNNER~1`），sync 記錄長名、備份雜湊用短名，還原找不到 native 備份而得空 catalog；`src` 與上游相同，是上游測試只在 macOS 驗證過的可攜性缺口 | `tests/clients/client-link-stop.test.ts`：改用 `realpathSync.native`；失敗時輸出 `link-sync-stop diagnostics` 保留 |
| `responses-pool-401-refresh`：pool JSON refresh 測試 | 與 native main 同型：重放取了上游 harness（不記 `refreshWires`），fork 測試被重複貼到 `describe` 外 | harness 還原為記錄 `refreshWires` 的 fork 版，移除檔尾重複測試 |
| `codex-catalog-write-audit`、`codex-history-provider`、`zed-hosted-provider` | 同型：fork 獨有測試在檔尾又多貼一份（以測試名對照上游 `v2.97.0` 與基準 `ed36b929a` 機器掃描全 repo，只有這三檔與上面兩檔） | 移除檔尾重複區塊，保留原位置的那份 |

### 驗收與水位推進（2026-11-06）

驗收依據：`ci/tagdiff-v2.97.0` 在 Windows 上的完整 CI run `42063145190` 全綠（含 Windows shards 與 aggregate `ci`），其後 `CI 後續修正` 表內每一項皆已逐檔對帳；本機另跑 `typecheck`、`privacy:scan`、`structure:check`、`file-size-ratchet`、`fork-hygiene`、`tools/dev_check.ps1` 與 docs-site build。
清冊 TSV 在後續修正中有 9 列與事實不符，已更正：`bounded-config-reader.ts`、`client-link-stop.test.ts`、`codex-cli-windows-plan.test.ts`、`codex-profile-preservation.test.ts`、`windows-codex-cli-job-store.test.ts`、`ci-bun-install-frozen.test.ts`、`update-import-policy.ts`、`update-process-allowlist.ts` 由「採用」改為「適配」（原因寫在備註欄），`zed-hosted-provider.test.ts` 因移除重複區塊由「適配」改為「採用」。更正後計數：已等價 76、採用 1556、適配 157、不適用 191（合計 1980）。`scripts/ci/bun-install-frozen.sh` 只差檔案模式（blob 相同，Windows 上無可執行位），仍算採用。

水位：`integrated_tag = v2.97.0`、`integrated_through`／`reviewed_through = cab7eb7d0332ae0ebb4289d7c6bac1de666b6e40`、`reviewed_date = 2026-11-06`。`reviewed_through` 可以推進，是因為 `88aaa754..cab7eb7d0` 的 254 筆 commit 全部落在 `v2.93.0..v2.97.0` 全版 tag diff 內，逐檔判定都在清冊與上列 CI 表中；個別 commit 的作者歸屬保留在整合提交。PR 水位不動（`reviewed_pr_through = 8086`、17 筆 `reviewed_pr_numbers`）。

issue 軸：strict 新列出 `#8181`（desktop takeover 在預設 bind 時，`runtime-port.json` 缺 `hostname` 欄位，`tracked-runtime-inspection.ts:150` 讀成 `""`，而 liveness 讀成 `127.0.0.1`，`stop-approval.ts` 比對時永遠回 `approvalChanged`）。判定：**適用但延後**。fork 有同一份程式（`src/config/tracked-runtime-inspection.ts:150`、`src/cli/stop-approval.ts:95,148`、`src/cli/index.ts:608`），Windows desktop 的 approved takeover 同樣會踩到；回報者在 macOS／launchd，但根因與平台無關。延後理由：該 issue 在上游仍 open、尚無修正，動的是 stop-approval 的授權比對（安全邊界），不在沒有上游設計的情況下自行改；觸發條件是上游出修正，或維護者在 Windows 上實際遇到 takeover 失敗。`reviewed_issue_through` 8161 → 8181，延後項記在 `ROADMAP.md` 中期列。

殘留（不阻擋推進，已列入 `ROADMAP.md`）：`codex-native-residue` 的 3 個案例在 MSIX 虛擬化終端回 `unavailable`，須於非虛擬化 Windows 終端複驗；其餘英文原文行與計時型 flaky 測試見路線圖。

## 2026-11-07：上游 `cab7eb7d0` 之後 56 筆 commit 的前 49 筆與 5 筆 platform issue

開工事實：Upstream check run 42376151305 為 failure（56 筆 commit、0 筆 closed-unmerged PR、5 筆新 platform issue）；上游 `main` 在 2026-11-07 為 `36aa9e8f7`，並已發 stable `v2.98.0`（同一 SHA，`gh release list` 為 Latest），所以 `ROADMAP.md` 的「整合下一個 stable」觸發條件已成立。本輪不做整版 tag diff，只做 commit 軸的前 49 筆（`git rev-list --reverse` 順序，止於 `7b514759e`）與 issue 軸。+/- 取自 `git diff-tree --numstat`，含已刪語系。

### platform issue（逐筆讀本文與留言）

| Issue | 判定 | 理由 |
| --- | --- | --- |
| [#8246](https://github.com/lidge-jun/opencodex/issues/8246) Windows Desktop 沒有已驗證的 headless updater，MSI 升級後舊 runtime 繼續服務 | 部分適用、延後 | headless updater 部分不適用：fork 關閉 updater（`desktop/src-tauri/tauri.conf.json:20`、`:68`），MSI 未簽章（`.github/workflows/fork-release-windows.yml:99-106`）。「MSI 成功但舊 runtime 仍在服務」適用：fork 的 MSI 設定只覆寫 ProductVersion（`desktop/scripts/windows-installer-config.ts:21`），沒有處理執行中 runtime。上游 issue 仍 open 且無修正 PR；觸發條件：上游出修正，或在 Windows 以 MSI 升級執行中的安裝後 `healthz` 仍回舊版。 |
| [#8260](https://github.com/lidge-jun/opencodex/issues/8260) dev 批次 CI 在 Windows 紅 | 資訊 | 上游 `dev` 分支問題。三個根因 fork 已各自處理：`client-link-stop` 的 8.3 短名由 fork 的 `realpathSync.native` 修正（UPSTREAM.md「CI 後續修正」），CLI plan ledger 的 `isPaired` 已補（`tests/codex-integration/codex-cli-windows-plan.test.ts:258`）；overflow corpus 逾時的測試檔（`messages-overflow-*`）fork 全 tree 沒有，隨 `895a859` 叢集進來時才相關。 |
| [#8262](https://github.com/lidge-jun/opencodex/issues/8262) 2.98.0 hosted Windows quarantine 追蹤 | 資訊，不採 quarantine | 上游以 `GITHUB_ACTIONS` 條件跳過五組測試。fork 不遮蔽：`main-quota-provenance` 已有 fork 自己的診斷補強與重審條件（`ROADMAP.md` 中期列），`client-link-connect` 的 service-exported 案例採用上游的 fixture 修正而非跳過。 |
| [#8280](https://github.com/lidge-jun/opencodex/issues/8280) macOS 15 以前 traffic lights 對不齊 | 不適用 | macOS 專屬（`TitleBarStyle::Overlay`），fork 只支援 Windows（`FORK.md` 差異表）。 |
| [#8281](https://github.com/lidge-jun/opencodex/issues/8281) macOS WKWebView chips 變方角 | 不適用 | 本文明述 Windows（WebView2）與 Chromium 顯示正常，僅 macOS WKWebView。 |

`reviewed_issue_through` 8181 到 8281。

### commit 軸（49 筆：不適用 2、延後 8、採用 37、不另採 2）

| Commit | +/- | 判定 | 證據與理由 |
| --- | --- | --- | --- |
| `345c428` chore(release): open dev at 2.98.0 before releasing 2.97.0 (#8135) | 4 檔 +4/-4 | 不適用 | release 版號 bump（`package.json`、`Cargo.*`、`tauri.conf.json`）。fork 版號跟整合 tag（`FORK.md` 分支與 remote），2.98.0 等 stable 整合一併取。 |
| `a98a6bf` test(diagnostics): use executable catalog fixture on macOS (#8136) | 1 檔 +9/-5 | 延後 | Rust 診斷測試（`scripts/diagnostics/windows-version-control/tests/async_contracts.test.rs`），fork blob 與上游前態相同可乾淨套用，但本機沒有 `cargo`／`rustc`，無法先紅後綠。重審條件：stable 整合時在有 Rust 工具鏈處跑該測試。 |
| `b7e01c1` security(desktop): bump updater to 2.14.1 and align Rust 1.90 (#8039) | 3 檔 +673/-551 | 延後 | `tauri-plugin-updater` 2.9.0 到 2.14.1、`tauri` 2.12.5、Rust 1.90（`Cargo.lock` +667/-545）。fork 的 `Cargo.lock`／`Cargo.toml` 與上游前態不同（`git apply --check` 在 `Cargo.lock:62`、`Cargo.toml:22` 失敗，含 2026-10-31 關閉 `zip` feature 的差異），沒有 `cargo` 無法重產鎖檔。fork 的 updater 已關閉（`desktop/src-tauri/tauri.conf.json:20` 為 `createUpdaterArtifacts=false`、`:68` 起 updater 區段 `endpoints` 空），但相依仍會編譯，所以不是不適用。重審條件：stable 整合時用 `cargo` 做含 `zip` feature 的 3-way 合併，或 Dependabot／code scanning 對 Cargo 出現告警。 |
| `c43a86b` fix(service): pin resolved homes in service definitions (#8111) | 30 檔 +1242/-120 | 採用 | 服務定義釘住解析後的 `CODEX_HOME`／`OPENCODEX_HOME`；Windows wrapper 的 `set` 值改為絕對路徑、`^` 不加倍、`%` 加倍（`src/service/windows-taskxml.ts`），WinSW 的 `CODEX_HOME` 解析走 `resolveCodexHomeDir`（`src/lib/winsw.ts`）。安全邊界：新增 `GET /api/native-main-profiles/admission` 只讀 startup gate，不建 manager、不跑 doctor 掃描，並列入 local read capability，`native-profile-route-security.test.ts` 與 `local-management-capability.test.ts` 釘住。先紅（24 fail）後綠；`structure/runtime.md` 兩行以整行替換手動合併（`git apply` 在 `:128` 失敗）。殘餘紅燈見 `REVIEW.md` 2026-11-07 節。 |
| `911443e` fix(qoder): 30 s background discovery, still-discovering answer for sl | 10 檔 +597/-38 | 採用 | Qoder 30 秒背景探索與 dashboard 測試「仍在探索」回應（新 `src/server/management/qoder-provider-probe.ts`）。fork 保留所有 provider。先紅（缺模組）後綠，乾淨套用。 |
| `cd8d26d` fix(kiro): emulate structured output instead of refusing it (#8071) | 25 檔 +2747/-89 | 採用 | Kiro 以私有終端工具模擬 structured output（不再拒絕 `text.format`），與平台無關，乾淨套用。先紅（缺 `structured-output` 模組）後綠，`tests/providers/kiro/*`、`tests/server/server-kiro-*` 全過。 |
| `af3f8f8` Serialize uninstall manifest updates under one cross-process lock (#81 | 16 檔 +1600/-94 | 採用 | config ownership manifest 以單一跨行程鎖序列化（`src/lib/config-ownership.ts` +579）。`src/service/logging.ts` 與 fork 的 `sameFileIdentity` 改寫（`logging.ts:21`）3-way 合併 rc=0。Windows 注意：持有 handle 的鎖檔不能 unlink，上游以 `63ff32a`（平台排除）、`7ea41c3`（首次註冊 `SQLITE_BUSY` 重試）、`5001aa5`（symlink 權限情境）修測試，三者已一併採用。 |
| `bc11b07` fix: bound Kiro diagnostics and service logs during uninstall (#8138) | 6 檔 +75/-7 | 採用 | Kiro 診斷與 service log 在 uninstall 時有界化；`af3f8f8` 之後乾淨套用。 |
| `fdad3da` fix(config): remove owned paths relative to the config root (#8141) | 21 檔 +1500/-44 | 採用 | uninstall 以 config root 相對路徑移除擁有的路徑，提權執行時要求 root 屬於執行帳號（新 `src/lib/config-ownership-removal.ts`、`src/lib/windows-owner-acl.ts`）。安全邊界；先紅後綠，3-way 合併 `config-ownership.ts` 乾淨。 |
| `72e80d2` fix(codex): validate legacy shim restore paths before restoring (#8143 | 15 檔 +944/-31 | 採用 | Windows Codex shim 的 legacy 記錄（`codex-shim.json` 無 schema／mode）在 uninstall／auto-restore／install refresh 前先驗證路徑（新 `src/codex/shim-legacy-record.ts`），純 Windows 安全邊界。`shim-windows-refresh.ts` 與 fork 的 `sameFileIdentity`（`:39`）3-way rc=0；上游 `codex-shim-migration.test.ts` 在 fork 不存在（Windows-only 刪除清單），該 +4 行略過；`structure/runtime.md` 保留 fork 的 migration 時間比較句並加上游新句。 |
| `ad6a80e` feat(providers): list Perch as a reference-only directory entry (#7311 | 2 檔 +8/-2 | 採用 | 免費目錄加 Perch（參考列，無 runtime destination）。先紅後綠。 |
| `895a859` fix(messages): normalize Messages error responses and Anthropic header | 89 檔 +5426/-361 | 延後 | Messages 錯誤回應與 Anthropic header 正規化叢集（89 檔，24 個全新測試檔）。fork 在 `src/server/claude-messages.ts:964-966` 刻意把 no-eligible 的 404 訊息固定為 `no eligible candidates for routing policy`（UPSTREAM.md「CI 後續修正」`chat-error-body-normalization` 列；不得洩漏 profile id），與本 commit 對同檔 +118/-64 衝突（`git apply --check` 失敗）；`test-layout-expected.json` 與 `structure/*` 生成物也要同合。與 `0a30c55`、`8d7d48d`、`0d2de73`、`7757a2f` 共用 helper，單挑會留下半套。重審條件：stable 整合時整叢重放，先對 fork 的 404 固定訊息逐項判定。 |
| `0a30c55` fix(messages): normalize streamed Messages error events (#8164) | 63 檔 +1643/-171 | 延後 | Messages 串流錯誤事件正規化（63 檔、33 個全新測試檔）；`messages-shared.ts` +92/-63，`messages-native.ts`／`claude-messages.ts` 衝突。同叢集，重審條件同上。 |
| `8d7d48d` fix(claude): normalize direct context overflow errors with parity cove | 6 檔 +64/-11 | 延後 | 直連 context overflow 錯誤正規化；依賴叢集內的 `tests/helpers/messages-overflow-assertions.ts`（fork 全 tree 不存在）。同叢集。 |
| `b9ddb31` fix(responses): lower ocx envelopes on native v1 compact (#8042) (#815 | 5 檔 +76/-3 | 採用 | native `/responses/compact` 對非 gateway 目的地也把 `ocx1:`／`ocx2:` 封套降級為文字（`src/server/responses/compact.ts` +4/-1），修的是 canonical ChatGPT／官方 OpenAI 的 `invalid_encrypted_content`。先紅（兩案）後綠。與 ROADMAP 中期「compact 剝除不支援參數」不同缺陷，該列不變。 |
| `68a8f60` fix(codex): preserve pre-output hold across safe WS heartbeats (#8188) | 4 檔 +200/-9 | 採用 | WS 預輸出拒絕保留跨安全 heartbeat（`codex-ws-wire.ts`）；replay-unsafe 標記非 `false` 一律 fail closed。先紅（8 案）後綠。 |
| `b855356` fix(terminal-guard): pass completion summaries that follow tool result | 2 檔 +107/-0 | 採用 | terminal guard 對工具結果之後的完成摘要放行，避免重跑工具迴圈。先紅後綠。 |
| `723b2aa` fix(mistral): keep replayed images within each model's per-request cap | 14 檔 +231/-13 | 採用 | Mistral 重放圖片依各模型上限截斷（新 `mistral-image-limit.ts`、`mistralMaxImages` 設定驗證）。先紅後綠。 |
| `d0c8151` fix(openai-chat): flatten root tool schemas for Claude chat gateways ( | 6 檔 +347/-14 | 採用 | Claude 經 Chat Completions gateway 時展平根層 union tool schema。`test-layout-expected.json` 3-way rc=0。先紅（約 15 案）後綠。 |
| `8f43924` test(service): make service definition probes portable (#8201) | 2 檔 +27/-16 | 採用 | 服務定義探針可攜（測試）。是 `c43a86b` 新測試在 Windows 的 `/bin/sh` ENOENT 修正，必要相依。 |
| `f202b2d` fix(responses): join repeated tool outputs for one call (#8199) | 10 檔 +366/-12 | 採用 | 同一 call 的重複 tool output 合併。`tool-output-recovery.ts` 與 fork 的韓文註解譯文（fork 與 `v2.97.0` blob 差 +6/-6）3-way rc=0，上游動的區段不重疊；Hangul 檢查由 `fork-hygiene` 覆蓋。先紅後綠。 |
| `13d2184` fix(transport): release disposed SOCKS5 readers and timeout closures ( | 6 檔 +300/-12 | 採用 | SOCKS5 reader／逾時閉包釋放。先紅（10 案）後綠。 |
| `0d2de73` fix(claude): avoid retries for definite context overflow (#8211) | 12 檔 +335/-28 | 延後 | definite context overflow 不重試；`src/protocols/encoders/messages.ts` 與 `error-detail.md` 衝突，依賴 `8d7d48d`。同叢集。 |
| `3b23d46` fix(antigravity): include Argon level with thought summaries (#8208) | 8 檔 +148/-30 | 採用 | Antigravity Argon 摘要需同送 level。先紅（5+ 案）後綠。 |
| `3dc4060` fix(claude): preserve translated system cache boundary (#8212) | 8 檔 +133/-21 | 採用 | 翻譯 Claude 通道保留 system cache 邊界。依賴 `cd8d26d` 動過的 `request-prepare.ts`，其後乾淨套用。先紅（2 案）後綠。 |
| `62578b5` fix(web-search): strip Lite marker from classic search (#8202) | 4 檔 +74/-6 | 採用 | classic web-search 去掉 Responses Lite marker。先紅（3 案）後綠。 |
| `708cd06` fix(web-search): report incomplete Anthropic search results (#8210) | 4 檔 +353/-27 | 採用 | Anthropic web-search 不完整結果回報。測試檔 3-way rc=0。 |
| `650cbc6` fix(web-search): separate consumer and upstream inactivity (#8213) | 7 檔 +308/-10 | 採用 | web-search 消費端與上游不活動計時分離。先紅後綠。 |
| `7757a2f` test(messages): restore Windows fixture coverage (#8214) | 6 檔 +149/-25 | 延後 | 還原 Messages 的 Windows fixture 覆蓋；6 個測試檔在 fork 全不存在（屬 `895a859` 叢集）。同叢集。 |
| `99c5153` docs(credits): record #8176 credit lost in #8214's squash (#8219) | 1 檔 +9/-0 | 採用 | `CREDITS.md` 補記 #8176。乾淨套用。 |
| `092b496` fix(responses): preserve adapter body stall status (#8200) | 9 檔 +154/-14 | 採用 | adapter body stall 狀態保留為 504／`upstream_stall_timeout`。`structure/data-planes/error-detail.md` 衝突來自缺叢集內容：保留 fork 該表並只加本 commit 的一行。綠。 |
| `fc6997d` fix(tests): isolate Codex profile cases on Windows (#8217) | 2 檔 +148/-65 | 不另採 | Codex profile 測試的 Windows 隔離；fork 已有等價但不同的修正：`tests/codex-integration/codex-profile-preservation.test.ts:13,30` 以 `protectedCodexHomeForTests()` 判定（UPSTREAM.md「CI 後續修正」`codex-profile-preservation` 列），`git apply --check` 失敗。重審條件：stable 整合。 |
| `5001aa5` fix(tests): isolate Windows uninstall privilege scenarios (#8218) | 2 檔 +56/-2 | 採用 | Windows uninstall 權限情境隔離（測試），是 `af3f8f8`／`fdad3da` 測試在無 symlink 權限帳號下的必要相依。 |
| `c637be2` fix(tests): pair Windows job store route fixture (#8225) | 2 檔 +299/-32 | 不另採 | job-store 路由 fixture 配對；fork 已在 `tests/windows/windows-codex-cli-job-store.test.ts:260` 補 `sessionControl: { isPaired: () => true }`（同上 CI 後續修正表）。重審條件：stable 整合。 |
| `92e8f87` fix(tests): use native homes in systemd probe fixtures (#8226) | 1 檔 +31/-4 | 採用 | systemd probe fixture 用原生 home（測試），與 `c43a86b` 改同一檔。 |
| `a0d4b40` fix(models): list router-known IDs with effective metadata (#8215) | 21 檔 +811/-79 | 採用 | `ocx models` 列出 router 已知 ID 並套用有效 metadata。乾淨套用；zh-tw 文件 3-way rc=0。先紅（約 30 案）後綠。 |
| `b19daa4` fix(gui): prioritize critical credits in quota summary (#8223) | 11 檔 +118/-9 | 採用 | GUI quota summary 優先顯示 critical credits；`bun test gui/tests/quota-summary.test.ts` 8 pass。 |
| `b4cc5e8` fix(update): validate configuration before stopping services (#8227) | 11 檔 +546/-42 | 採用 | `ocx update` 停服務前先驗證設定（`src/update/config-preflight.ts`）。fork 的 update 路徑本就被 `forkSelfUpdateBlocked()` 擋，此檢查唯讀無副作用，採用以縮小下次重放差異；需連同 `6b3044f` 的 import 政策。 |
| `553a621` fix(ci): rebalance Ubuntu tests across five shards (#8233) | 7 檔 +2928/-2848 | 不適用 | Ubuntu 測試重新分五片。fork 的 `ci.yml` 只留 Windows 測試分片（`REMOVED_CI_JOBS`），`git apply --check` 在 `ci.yml:213` 失敗；`test-durations.tsv` 等生成物於 stable 整合時由上游版重產。 |
| `aec37c1` feat(gui): design system v2 — redesigned dashboard, navigation and des | 450 檔 +58007/-6559 | 延後 | GUI design system v2（470 以上個檔案：圖示、儀表板、導覽、桌面殼），單一 commit 無法逐檔判定也無法局部驗證；`desktop/src-tauri/src/lib.rs:402-414` 的 macOS traffic light 區段與其相關。重審條件：stable 整合時依 TSV 清冊流程逐檔分類（排除 macOS 專屬）。 |
| `250ef01` fix(cli): preserve default bind identity for guarded stops (#8221) | 21 檔 +388/-47 | 採用 | 預設 bind 的 guarded stop 保留身分：舊記錄缺 hostname 時，其餘核准與擁有權檢查一致才接受預設 loopback，記錄含 hostname 則必須完全相符（`stop-approval.ts`、`tracked-runtime-inspection.ts`、`system-restart-client.ts`、`update-restart*.ts`）。**直接修掉 `#8181` 的 fork 缺陷**，不放寬 pid／port／attestation。先紅（8 案）後綠；ROADMAP 中期 `#8181` 列已刪。 |
| `f1d1a32` fix(cli): keep Desktop CLI selected when its executable is missing (#8 | 11 檔 +136/-49 | 採用 | Desktop CLI 的 handoff 目標缺失時維持選取。fork 文件寫明 Windows 永遠走 package 路徑（`structure/runtime.md` 的 `bin/ocx.mjs` 列），handoff 為 POSIX 程式路徑，行為對 Windows 為 no-op；仍採用以免重放差異。`ocx-launcher-desktop-handoff.test.ts` 先紅後綠。 |
| `63ff32a` test(config): honor ownership test platform exclusions on Bun (#8239) | 1 檔 +27/-8 | 採用 | config ownership 測試尊重平台排除（提前採用，見 `af3f8f8`）。 |
| `7ea41c3` test(config): retry busy first ownership registrations (#8238) | 1 檔 +16/-9 | 採用 | 首次 ownership 註冊遇 busy 重試（測試，提前採用）。 |
| `540100d` fix(sync): report skipped connected children as partial (#8248) | 14 檔 +71/-17 | 採用 | sync 對已連線但被略過的 Child 回報 partial。先紅後綠。 |
| `3924f21` fix(sync): defer supervised client restart after apply (#8250) | 9 檔 +113/-15 | 採用 | sync 套用後延後 supervised client 重啟。先紅後綠（`cli-sync-expect-link` 在預設 5 秒下受主機負載逾時，`--timeout 120000` 下 30 pass）。 |
| `cdb64a9` fix(link): report stale Child connection readiness (#8249) | 7 檔 +112/-4 | 採用 | Child 連線 readiness 回報過期。先紅後綠。 |
| `ebeb1dc` fix(link): preserve orphan token files for confirmed recovery (#8253) | 15 檔 +859/-13 | 採用 | 明確授權下保留 orphan token 檔供復原（新 `src/client/orphan-token-recovery.ts`）。安全邊界：Windows 以 `hardenSecretDir`／`hardenSecretPath({required:true})` 加 pinned handle 與 file-ID 比對，symlink／hardlink／service-exported admission 皆拒絕。**fork 差異**：上游以 Number 比 `dev`／`ino`（NTFS file ID 超過 2^53），fork 改用 `lstatFileIdentity`／`fstatFileIdentity` 加 `sameFileIdentity`（`nlink`、`size` 維持 Number），並把此模組加進 `tests/lib/file-identity-callers.test.ts` 的 scopes，理由見 `DECISIONS.md` 2026-11-07 決定七。symlink 案例在無 symlink 權限的帳號以能力探測 skip（hardlink 案例照跑）；service-exported 案例由 `47f9e2d` 的 fixture 變更處理。 |

| `7b51475` fix(link): follow up orphan-token and client_state_changed reviews (#8243) (#8256) | 24 檔 +149/-25 | 採用（部分） | 採用 `src/`、`tests/`、`structure/runtime.md`、`docs-site/.../remote-link.md` 與 en／zh-TW 字串：`releasePins()` 在中斷的 Windows 復原後釋放 `.<name>.identity` 硬連結，並以具名訊息拒絕 `nlink > 1`（`src/client/orphan-token-recovery.ts`）；`link-readiness.ts`／`machine-listener.ts` 的 readiness 收斂。先紅（`client-link-connect` 3 案、`client-machine-listener` 1 案）後綠。**不採用 GUI 接線**（`gui/src/App.tsx`、`api-targets.ts`、`connect-pairing*.tsx`、`gui/tests/*` 與其餘語系字串）：fork 的 `gui/src/connect-pairing.tsx` 與上游前態不同（`git apply` 在 `:119` 失敗），留待 `v2.98.0` 重放；在那之前 `connection.clientStateChanged` 字串沒有 GUI 使用者。 |

表外提前採用（順序在 `7b514759e` 之後，但為上列採用項的必要相依）：
- `6b3044f` test(update): classify read-only config preflight (#8241)：提前採用（`b4cc5e8` 的 update import 政策測試輔助）
- `2c8b397` fix(tests): use native homes in launchd fixture (#8245)：提前採用（`c43a86b` launchd 測試 fixture 用原生 home）
- `47f9e2d` test: quarantine hosted Windows CI failures for 2.98.0 (#8264)：只提前採用 `tests/clients/client-link-connect.test.ts` 的 fixture 變更；`tests/helpers/windows-ci-quarantine.ts` 的 hosted-Windows 隔離不採用，fork 不遮蔽紅燈，其餘 quarantine 檔未動

## 2026-11-08：全版 tag diff 重放 `v2.97.0..v2.98.0`（`36aa9e8f7`），收掉 8 筆延後項與最後 7 筆 commit

`git diff refs/upstream-tags/v2.97.0 refs/upstream-tags/v2.98.0` 共 868 個檔案（322 新增、545 修改、1 刪除；`v2.98.0` = `36aa9e8f7933807dc2c873bb93051c7c9c00f4e6`），以單一 parent、不 merge 上游的 tag-diff 法套到 `main`（fork 基準 `a13d292e9`）。逐檔清冊在 [`upstream-v2.97.0-v2.98.0-files.tsv`](upstream-v2.97.0-v2.98.0-files.tsv)（欄位與 2026-11-05 那份相同，由 blob 雜湊比對機器產生，**不手改**；`/docs/` 在 `.gitignore`，要 `git add -f`）。方法、Windows-only 刪除清單、已刪語系與生成物規則同 2026-11-05 節；本節只寫數字與例外。

### 計數（868 個上游變更檔）

| 判定 | 檔數 | 說明 |
| --- | --- | --- |
| 已等價（重放前 fork blob 即與 `v2.98.0` 相同） | 197 | 2026-11-07 commit 軸前 49 筆與提前採用項已帶進來的檔案 |
| 採用（重放後與 `v2.98.0` blob 逐位元相同） | 551 | 乾淨採用、新增檔（含 GUI v2 的 `gui/classic`、`gui/src` 新檔）、3-way 無衝突者 |
| 適配（重放後與上游不同，fork 保留／改寫部分 hunk） | 85 | 多數是先前已適配的 fork 差異原樣保留；逐檔原因在 TSV 備註欄 |
| 不適用 | 35 | 已刪語系 32（docs-site 六語系頁 23、`gui/src/i18n` 九個非 en／zh-TW 語系檔 9）、Windows-only 刪除清單 2（`codex-shim-migration.test.ts`、`gui/tests/fr-localization.test.ts`）、`tests/helpers/windows-ci-quarantine.ts` 1 |

分類中途的修正：第一版分類用 `gui/src/i18n/(?!en|zh-tw|…)` 判已刪語系，大小寫不符會把 `zh-TW.ts` 誤當已刪語系，已改走 3-way；`shell-v2-copy.ts` 與 `v2-pages/*-copy.ts` 是 11 欄列表，不是單一語系檔，改成保留 en／zh-TW 兩欄（決定見 `DECISIONS.md` 同日決定三）。

### 最後 7 筆 commit（`6b3044f` 起）

| Commit | 判定 | 證據與理由 |
| --- | --- | --- |
| `6b3044f` test(update): classify read-only config preflight (#8241) | 採用 | 2026-11-07 已提前採用，tag diff 內為已等價。 |
| `2c8b397` fix(tests): use native homes in launchd fixture (#8245) | 採用 | 同上。 |
| `fc60746` fix(tests): pair Windows CLI update plan session (#8228) | 採用 | `codex-cli-windows-plan.test.ts` 與 5 個 `tests/helpers/windows-*` 子行程輔助檔（unsafe-ledger 案例搬進子行程並自帶 `isPaired`）。整檔取上游，取代 fork 2026-11-06 補的 `isPaired` 一行（`DECISIONS.md` 決定六）；`git diff` 顯示 fork 對上游前態的唯一差異就是那一行。 |
| `a589903` test(link): hand the stop/sync fixtures the native CODEX_HOME spelling (#8265) | 採用（已等價） | `client-link-stop.test.ts` 的 `realpathSync.native` 與 fork 2026-11-06 的修正逐字相同，只採上游的註解文字。 |
| `47f9e2d` test: quarantine hosted Windows CI failures for 2.98.0 (#8264) | 部分採用 | 只留 `client-link-connect.test.ts` 的 fixture 修正（2026-11-07 已採）；`windows-ci-quarantine.ts` 與五個使用點不採（`DECISIONS.md` 決定五）。 |
| `247ad32` release: promote frozen tip `47f9e2d` to main as 2.98.0 | 採用 | ours merge，樹與 `47f9e2d` 完全相同（`git diff 47f9e2dc4 247ad32cb` 為空），所以內容就是上面的 tag diff；版號 2.98.0（`package.json`、`Cargo.toml`／`Cargo.lock`、`tauri.conf.json`）由 2026-11-07 判「等整合一併取」的 `345c428` 帶入。 |
| `36aa9e8` Merge pull request #8267 | 不適用 | merge commit，樹與 `247ad32` 相同（`git diff 247ad32cb 36aa9e8f7` 為空）；`reviewed_through` 直接停在它。 |

### 8 筆延後項的結案

| 延後項 | 結果 | 證據 |
| --- | --- | --- |
| Messages 錯誤正規化叢集 `895a859`、`0a30c55`、`8d7d48d`、`0d2de73`、`7757a2f` | 整叢採用；`claude-messages.ts` 的 no-eligible 404 保留 fork 固定句 | tag diff 內為同一批檔案，無半套問題；`claude-messages.ts` 3-way 只有該分支一個衝突，解法與理由見 `DECISIONS.md` 決定二；`routing-policy-surface-parity` 釘住「不含 profile id」。叢集的新測試與 `tests/helpers/messages-*` 輔助檔都在樹內（`structure:check` 通過）。`server-kiro-structured-output-e2e.test.ts` 的期望字串隨叢集改為上游版。 |
| `aec37c1` GUI design system v2 | 依 TSV 流程採用，語系收斂為 en／zh-TW | 決定三；`gui` 的 `tsc -b` 與兩個 vite 建置通過，`bun run typecheck` 2,323 檔 0 錯誤；macOS 專屬的 `lib.rs` traffic light 區段沒有進 tag diff（`desktop/src-tauri/src` 兩 tag 間無差異）。 |
| `b7e01c1` updater 2.14.1／Rust 1.90 | 採用，取代 fork 的 `zip` feature 關閉 | `cargo metadata --locked`、`cargo check --lib --locked` exit 0；鎖檔 `zip` 9.1.3 ≥ 9.0.5（決定四）。 |
| `a98a6bf` Rust 診斷測試 | 採用 | `cargo test --locked`（`scripts/diagnostics/windows-version-control`）16 案過。 |

### 適配重點（不是單純取上游）

- `src/client/orphan-token-recovery.ts`：維持 bigint 檔案身分（2026-11-07 決定七）；上游自 `7b51475` 起未再改這檔。
- `.github/workflows/ci.yml`、`tests/ci-workflows/ci-workflows.test.ts`、`ci-review-lanes.test.ts`：Ubuntu 五片 `test` job 與 `changes` 對它的輸出不重放。
- `structure/runtime.md`、`structure/ops/docs-and-release.md`：fork 句子與上游新句並存或擇一，見 `DECISIONS.md` 決定七。
- `scripts/ci/test-durations.tsv`、`scripts/test-layout/layout.json`、`tests/fixtures/test-layout-expected.json`、`structure/manifest.json`、`structure/INDEX.md`：上游版剔除 fork 沒有的測試、補回 fork 條目（前兩者的衝突以程式化方式合併，再驗 JSON 解析與檔案存在）。
- 語系：`docs-site` 六個已刪語系頁不重放；`zh-tw` 的三處衝突（`claude-code.md`、`reference/cli/lifecycle.md`、`providers-accounts.md`）取上游新繁中段落，英文原文行不新增。
- `gui/classic`（上游把舊版 GUI 保留為 `/classic/`）：安裝連結改 `SanHsien/opencodex`、10 行 Hangul 註解與 1 處 Hangul 範例改英文、`main.tsx` 的 `installApiAuthFetch()` 維持無條件；`fork-hygiene` 的 Hangul 與「不連上游 releases」掃描根加入 `gui/classic/src`。
- `tests/helpers/messages-overflow-assertions.ts`（切片 timeout 改 `COLD_SPAWN_BUDGET_MS`）與 `tests/claude-integration/messages-sse-continuation.test.ts`（冷啟動暖機）：取代上游 quarantine 的 fork 側修法，見 `DECISIONS.md` 決定九。
- zh-tw 文件補 `web-dashboard.md`「經典儀表板」與 `providers.md`「Mistral：每個請求的圖片數量」兩節，並把取自上游的三個英文路徑連結改為 `/zh-tw/...`。
- `src/server/claude-messages.ts` 的 no-eligible 分支：fork 固定句實際生效（`localError.message`），overflow 判定仍讀上游 `err.message`，見 `DECISIONS.md` 決定十一。
- `scripts/ci/test-durations.windows.tsv`：先用 run 42403141711 的 11 份 Windows job log 量測，補上 75 個新檔的權重；之後改用 run 42415040854 與 run 42412302217 兩個 run 共 22 份 Windows job log 取每檔平均（現行表的來源），shard 數由 11 增為 12，見 `DECISIONS.md` 決定十二。
- 本機驗證與殘留：見 `REVIEW.md` 2026-11-08 節與 `ROADMAP.md`。

### 水位

**已推進（2026-11-08）**：`tools/upstream_baseline.json` 的 `integrated_tag` 由 `v2.97.0` 推到 `v2.98.0`，`integrated_through`／`reviewed_through` 為 `36aa9e8f7933807dc2c873bb93051c7c9c00f4e6`，`reviewed_date` 為 2026-11-08（`--strict` 回到通過）。依據：分支 `ci/tagdiff-v2.98.0` 在 `7de8aac44` 的 `Cross-platform CI` run 42424520793 12 個 Windows shard 與 aggregate `ci` 全 success，且 `cab7eb7d0..36aa9e8f7` 的 56 筆全落在這份 tag diff 內；理由與修復經過見 `DECISIONS.md` 2026-11-08 決定一、十一、十二與其後的推進節。PR 水位不動（`reviewed_pr_through = 8086`、17 筆 `reviewed_pr_numbers`），`reviewed_issue_through` 8281 → 8320（逐筆判定見下一節）。

### Upstream check issue 軸（2026-11-08：#8317、#8318、#8320）

水位推進後跑 `bun tools/check-upstream-updates.ts --strict`：commit 軸「No new upstream commits」，PR 軸無待審，issue 軸列出 3 筆新的 open `platform` issue（2026-11-07 開，皆回報 2.98.0）。三筆都以 `curl -o` 存 JSON 後讀全文（留言：#8320 只有 coderabbitai bot 一則；其餘 0 則），均尚無維護者回覆或修正 PR。

| Issue | 上游事實 | fork 證據 | 判定與觸發條件 |
| --- | --- | --- | --- |
| [#8317](https://github.com/lidge-jun/opencodex/issues/8317) macOS：`codex-shim.autorestore.lock/` 內有兩個 owner 檔且行程都已死，鎖永遠不被回收，`ocx codex-shim install` 一直回 "already in progress" | open（bug／cli／platform）。`readShimRestoreLockSnapshot()` 在目錄項目不是剛好 1 個 `.json` 時回 `null`，`reclaimStaleRestoreLock()` 因此直接回 `false`，stale 判定從不執行。兩個 owner 怎麼進同一目錄回報者沒證明（兩檔同一毫秒，推測是 acquire／retry 競態）；回報者以搬走鎖目錄解開，並建議多 owner 且全死時回收、單一寫入者、清理 `.stage`／`.probe-*`、錯誤訊息列出鎖路徑。 | **同一份程式碼在 fork**：`src/codex/shim-restore-lock.ts:56` 是同一句 `if (entries.length !== 1 || !entries[0].endsWith(".json")) return null;`，`:85` 起 `reclaimStaleRestoreLock` 對 `null` 回 `false`，`tryAcquireShimRestoreLock` 兩次嘗試後回 `null`。檔內沒有 `process.platform` 判斷；`src/codex/shim-overlay.ts:458,489,512` 在三個入口取這把鎖，`shim-overlay.ts` 的 path-overlay 狀態記錄 `platform: process.platform`，Windows 一樣走這條路。所以不是 macOS 專屬，Windows 理論上同樣可能卡住；本機沒有重現（上游也只有「觀察到的狀態」、沒有可重現步驟）。 | **適用但延後**。這是鎖回收的併發邊界：「所有 owner 都死」的判定與單一寫入者的改法一旦寫錯，會讓兩個行程同時改 shim，不是順手的小修；上游尚未提出修正，原因（兩 owner 如何產生）也未查明，fork 不先行發明語意。登記 `ROADMAP.md` 中期列。觸發：上游出修正，或 fork 在 Windows 實際遇到 `ocx codex-shim install` 回 already in progress 且 設定目錄（`getConfigDir()`）下的 `codex-shim.autorestore.lock` 內有兩個以上 `.json`。暫行處置同回報者：把該鎖目錄搬走再重跑 install。 |
| [#8318](https://github.com/lidge-jun/opencodex/issues/8318) Windows：`hostname` 設成本機自己的 Tailscale IP 時，Desktop 重啟後不啟動 runtime（`ocx resolve` 1500 ms 探測逾時） | open（bug／cli／platform／service，Windows 11 Pro 10.0.26300、Tailscale 1.104.4）。`hostname` 設為本機 Tailscale IP 且啟用 Hub 後，`ocx resolve` 對該 IP 的連線被拒要約 2 秒才失敗，超過 1500 ms 探測上限，判成「無法解析」，Desktop 不啟動 runtime 也不顯示原因；`hostname 0.0.0.0` 時 0.7 秒 exit 0。回報者建議：綁定位址屬本機時改探測 127.0.0.1、把 refused 當作「未執行」、探測逾時可設定或加長、Desktop 顯示原因、文件註明 Windows 不要用自己的 Tailscale IP 當 `hostname`。 | **同一條路徑在 fork**：`src/cli/resolve.ts` 檔頭寫明用 `START_OWNERSHIP_LIVENESS` 預算；`src/server/proxy-liveness.ts:111` `OWNERSHIP_PROBE_FLOOR_MS = 1500`、`:147-150` 的 `START_OWNERSHIP_LIVENESS` 為 `timeoutMs` 1500（可被覆寫抬高）／`attempts` 3；`probeHostname`（`:225`）只把空值或萬用位址換成 `127.0.0.1`，其他 `hostname` 原樣探測，所以設成本機 Tailscale IP 時探測的就是那個 IP。`src/cli/uninstall-plan.ts:58` 的 `endpointsToProve` 也用設定的 `hostname`。fork 已有的逃生口：環境變數 `OCX_PROBE_TIMEOUT_MS`（`proxy-liveness.ts:113,125`）可把上限調高（程式碼層面推得出，未在有 Tailscale 的主機實測）。逾時一律當 unknown、unknown 不當作 absent，是 `resolve.ts` 檔頭明訂的安全契約（#5004：避免重複啟動 proxy），本機沒有 Tailscale 介面，無法重現 2 秒的拒絕延遲。 | **適用但延後，不改探測語意**。回報者的第一條建議（本機位址改探 127.0.0.1）不安全：綁在特定 IP 的 listener 不一定也聽 loopback，探 127.0.0.1 可能把活著的 runtime 判成 absent 而重複啟動，正是 #5004 要避免的；只有把 refused 與逾時分開、並且有證據證明該 IP 屬本機網卡，才可能放寬。上游尚未回應。登記 `ROADMAP.md` 中期列。觸發：上游出修正，或維護者在 Windows 上以自己的 Tailscale IP 當 `hostname` 遇到 Desktop 不啟動；屆時先在該主機量 refused 延遲，再決定「refused 視為 dead」或預算設定化。暫行處置：`hostname` 用 `0.0.0.0` 搭配 Tailscale Serve 指到 `http://127.0.0.1:<port>`，或設 `OCX_PROBE_TIMEOUT_MS`。 |
| [#8320](https://github.com/lidge-jun/opencodex/issues/8320) macOS：`ocx connect --clients codex` 之後，Dock 啟動的 GUI Codex app 拿不到 Hub 金鑰（要求提示或 LaunchAgent 以 `launchctl setenv` 提供） | open（enhancement／gui／cli／platform）。macOS GUI app 的環境來自 launchd，只有 shell 啟動器 `~/.opencodex/bin/codex` 會把 `OPENCODEX_API_AUTH_TOKEN` 放進環境；回報者要求至少警告，更好是由 `ocx connect` 安裝不含金鑰的 per-user LaunchAgent。延續 #2713（Linux 側已收）。 | 需求本身綁 `launchctl`／LaunchAgent／Dock 啟動，fork 只支援 Windows（`FORK.md` 差異表），沒有對應程式。Windows 上 GUI 程式的環境變數來源（使用者環境變數／登錄檔）是另一個機制，這個 issue 沒有描述，這次沒有查，也不把它當成已知問題。 | **不適用（macOS 專屬）**，與 #8161、#8280、#8281 同類處理。若日後在 Windows 看到 GUI Codex app 報 "Missing environment variable"，那是新的 Windows 問題，另開判定，不引用本條。 |

`reviewed_issue_through` 8281 到 8320。#8317、#8318 的延後項登記在 `ROADMAP.md` 中期表。

## 2026-11-08（續）：上游 PR／issue 分類（#7608、#7619、#8224、#8314、#8315 與 issue #8336；Windows 複查 #7771、#7808、#7810）

本輪針對 Upstream check 報告列出的 5 筆未合併關閉 PR 與 1 筆新 open `platform` issue 進行分類，並複查 Windows 相關 issue。

### 上游未合併關閉的 PR（5 筆，fork 全部不採用）

| PR | 標題 | 上游狀態與事實 | 判定與理由 |
| --- | --- | --- | --- |
| #7608 | docs(responses): register and document citation replay coverage | 關閉未合併（Draft，2026-10-28 關閉）。僅記錄 URL-citation 重放回歸測試與文件，作者因工作負載期限與未完成當前 head CI 維持 Draft，上游維護者已把它 carry 成 #7865（squash d67feddd7，在 v2.94.0 內），已由 #7865 併入、fork 隨 v2.94.0 整合取得。 | **不另採**。跟隨上游關閉；已由 #7865 併入且 fork 隨 v2.94.0 整合取得，不另行採用未完成的 Draft PR 分支。 |
| #7619 | feat(codex): verify Windows CLI archive and shim layouts | 關閉未合併（2026-10-28 關閉）。驗證 Windows x64 Codex CLI 封存檔與安裝 layout。上游維護者以 #7648 consolidation commit（`c3a6b27903b`）明確取代 #7614、#7618 與 #7619。 | **不採用（已被 #7648 取代）**。跟隨上游維護者處置，不重疊採用已關閉分支；相關功能隨 #7648 整合（fork 早前已記錄 #7614、#7618 之相同判定）。 |
| #8224 | fix(gui): show WorkBuddy credits in quota summary | 關閉未合併（2026-11-06 關閉）。在 GUI QuotaSummaryBar 顯示 WorkBuddy 餘額明細。上游維護者 `lidge-jun` 判定因 stale quota freshness 與 safe validation 尚未解決而 defer 此 PR；關聯 issue #8131 已在 2026-11-08 06:29Z 關閉（上游 #8323 於 06:28Z 合進 dev，比 v2.99.0 晚，會隨下一個 stable 進來）。 | **不採用**。跟隨上游維護者決策關閉；上游修復已由 #8323 合進 dev，待隨下一個 stable 整合。 |
| #8314 | [WRONG BRANCH] release: promote frozen tip eedbb2b0a9 to preview as 2.99.0-preview.20261108 | 關閉未合併（2026-11-07 關閉）。發版 PR 投錯分支（標題載明 `[WRONG BRANCH]`），由作者關閉。 | **不採用**。發版操作失誤投錯分支，非產品變更。 |
| #8315 | [WRONG BRANCH] release: promote frozen tip eedbb2b0a9 to main as 2.99.0 | 關閉未合併（2026-11-07 關閉）。發版 PR 投錯分支（標題載明 `[WRONG BRANCH]`），關閉後由後續 PR #8322（`release/promote-main-2.99.0-r2`）取代。 | **不採用**。發版操作失誤投錯分支，後續由 #8322 取代。 |

### 上游 platform issue（1 筆：#8336）

| Issue | 上游事實 | fork 證據與判定 |
| --- | --- | --- |
| [#8336](https://github.com/lidge-jun/opencodex/issues/8336) Use independent expected paths in Windows release contract test | open（bug／platform）。指出上游開放中 PR #8335（修復 release attachment contract 測試 harness）裡的 Windows release-contract PATH 單元斷言使用與實作相同的 win32 操作構造期望值，建議改用獨立期望值。 | **相關但延後**。指涉上游尚未合併之 PR #8335，且本 fork 專注於 Windows runtime / proxy 與自有的 `fork-release-windows.yml`，不跑上游的 npm release pipeline。待上游 PR #8335 與 #8336 落地於下一個 stable tag 時，隨穩定版 tag diff 檢視適配。 |

### Windows 相關上游 issue 複查（#7771、#7808、#7810）

- **#7771**（`[Bug][Windows]: desktop 2.92.0 stuck at taking-over when an npm package runtime runs under the Task Scheduler service; ocx stop / service stop do not free the port`）：上游仍 open。本機 2026-10-28 已移除指向舊 npm 安裝的 `\opencodex-proxy` 排程，現況只由 desktop 啟動，本機不重現；持續等上游修正。
- **#7808**（`[Bug]: Windows client path overrides accept drive-less rooted paths`）：上游已於 2026-10-28 由 PR #7824（commit `07161c5b951`）修復關閉（Windows client path override 要求 drive letter 或 UNC share，拒絕無磁碟代號的根路徑如 `\tmp\client`）。本 fork 在整合 `v2.93.0`..`v2.97.0` 時已包含此修復。
- **#7810**（`[Bug]: some CLI tests fail on Windows workstations with a long TEMP path or a running local proxy`）：上游已於 2026-10-28 由 commit `95cfa30ec`（#7823，長 TEMP 下 `\\?\` 擴充路徑）及 `fb22d055e`（#7852，私有 known-folder namespace 隔離 client lifecycle 鎖）修復關閉。本 fork 已包含此修復。

### 水位更新

- `reviewed_pr_numbers`：加入 7608, 7619, 8224, 8314, 8315（共 22 筆）。
- `reviewed_issue_through`：8320 推進至 8336。
- 執行 `bun tools/check-upstream-updates.ts` 後，PR 軸與 issue 軸兩節皆回報無新項目待審。

## 2026-11-09：`v2.98.0..v2.99.0` commit 軸整合前審查（28 筆，未整合）

上游已於 2026-11-08 05:26Z 發布 `v2.99.0`（release tag 指向 `667662903a6c139524506667d12656d9ad50fad0`）。本節針對 `36aa9e8f7..refs/upstream-tags/v2.99.0` 間的 28 筆 commit 進行逐筆整合前審查（逐檔 numstat 皆以 `git diff --numstat <c>^1 <c>` 實算，對 fork 影響使用 `git log origin/main -- <path>` 查驗 fork 獨有 commit）。
本節**僅建立 commit 軸之逐筆審查文件，不執行整合**（不 merge、不改動產品碼、不推進 `tools/upstream_baseline.json` 水位，待後續獨立 CI 分支依 tag diff 重放）。

### Commit 軸清冊（28 筆）

| Commit | 日期 | 變更規模 | 標記 | 判定 | 主旨 |
| --- | --- | --- | --- | --- | --- |
| `e804cd418` | 2026-11-07 | 4 檔 +4/-4 | — | 採用 | chore(release): open dev at 2.99.0 before releasing 2.98.0 (#8263) |
| `afd76e0b8` | 2026-11-07 | 9 檔 +172/-10 | — | 採用 | fix(mistral): ship per-model effort ladders and fold native Chat ultra (#8259) |
| `e838c30f2` | 2026-11-07 | 6 檔 +343/-16 | Windows 修正 | 採用（適配） | test: bound Windows overflow slices and preserve child cleanup (#8229) |
| `508a53563` | 2026-11-07 | 3 檔 +5/-3 | — | 適配 | fix(link): hedge leftover-pin refusal and count in-flight readiness reads (#8261) |
| `05eaaa388` | 2026-11-07 | 11 檔 +335/-206 | Windows 修正 | 採用（適配） | test: stabilize Windows fixture setup and source checks (#8176) |
| `06764fddc` | 2026-11-07 | 5 檔 +93/-6 | — | 採用 | perf(kiro): count streamed tool argument bytes incrementally (#8140) |
| `af92fb4e9` | 2026-11-07 | 12 檔 +120/-14 | 安全 | 採用 | fix(ollama): bound tool-call validation work (#8147) |
| `f1ce135e8` | 2026-11-07 | 35 檔 +1551/-183 | — | 採用 | fix(responses): preserve mandatory tool choices through routing and recovery (#8146) |
| `a369a4a32` | 2026-11-07 | 15 檔 +1074/-29 | — | 採用 | fix(responses): preserve late Devin signatures for DSH clients (#8230) |
| `803d6c0b4` | 2026-11-07 | 60 檔 +2069/-167 | — | 採用 | fix(anthropic): batch affinity writes and confirm operator resets (#8020) |
| `4b821cf29` | 2026-11-07 | 58 檔 +3092/-272 | Windows 修正 | 採用 | fix(workflows): enforce root send ceilings at physical admission (#8149) |
| `41f316f40` | 2026-11-07 | 21 檔 +540/-28 | — | 採用 | feat(messaging): add opt-in stored Codex turn reply reads (#8053) |
| `35d5010f5` | 2026-11-07 | 44 檔 +397/-108 | — | 採用 | Fix dashboard switch and combo layout regressions (#8269) |
| `bc635c805` | 2026-11-07 | 22 檔 +779/-73 | — | 採用 | Fix clipped Models rows and dashboard control layout (#8272) |
| `883bf0fd7` | 2026-11-07 | 65 檔 +1500/-169 | Windows 修正、安全 | 採用 | Clarify Desktop startup safety and mask OAuth account labels (#8271) |
| `19d14bc79` | 2026-11-07 | 6 檔 +78/-25 | — | 採用 | fix(qoder): accept unambiguous selected tool aliases (#8235) |
| `05408a312` | 2026-11-07 | 30 檔 +542/-36 | — | 採用 | fix(mistral): sanitize Chat fields and normalize native thinking content (#8278) |
| `66e5b12e0` | 2026-11-07 | 4 檔 +68/-5 | — | 採用 | Fix omitted effort on dual-control Chat wires (#8279) |
| `a503cd708` | 2026-11-07 | 42 檔 +1139/-221 | — | 採用 | Show app breakdowns and client chips (#8282) |
| `ac2e7dfb0` | 2026-11-07 | 3 檔 +66/-5 | — | 採用 | Honor max omission before native ultra clamping (#8284) |
| `c61e95790` | 2026-11-07 | 7 檔 +174/-9 | — | 適配 | fix(desktop,gui): align macOS traffic lights on Sequoia and keep chips rounded in WKWebView (#8285) |
| `1b87631d5` | 2026-11-07 | 6 檔 +151/-1 | — | 採用 | test: isolate Codex CLI update fixture process scans (#8283) |
| `aaa3c20f3` | 2026-11-07 | 14 檔 +190/-72 | Windows 修正 | 採用 | Fix launcher signal race and chat-completions network flake (#8289) |
| `6df9e1176` | 2026-11-07 | 3 檔 +68/-7 | — | 採用 | perf(command-code): measure fragmented NDJSON incrementally (#8277) |
| `eedbb2b0a` | 2026-11-08 | 1 檔 +5/-2 | — | 採用 | test(config): retain uninstall refusal diagnostics (#8242) |
| `de411020e` | 2026-11-08 | 2 檔 +30/-1 | 安全 | 採用 | fix(privacy): keep masked account label validation linear (#8316) |
| `ee0e275e6` | 2026-11-08 | 0 檔 +0/-0 | — | 不適用 | release: promote frozen tip de411020ed5e6df2a2223589bbeeedb412f57bfb to main as 2.99.0 (ours merge of main) |
| `667662903` | 2026-11-08 | 410 檔 +14575/-1662 | Windows 包含 | 整版整合 | Merge pull request #8322 from lidge-jun/release/promote-main-2.99.0-r2 |

### 逐筆審查細節與 fork 影響分析

#### 1. `e804cd418` chore(release): open dev at 2.99.0 before releasing 2.98.0 (#8263)
- **實算規模**：4 檔 +4/-4（`desktop/src-tauri/Cargo.lock`, `desktop/src-tauri/Cargo.toml`, `desktop/src-tauri/tauri.conf.json`, `package.json`）。
- **內容說明**：上游在發布 2.98.0 前將 dev 分支版號推進至 2.99.0。
- **對 fork 影響**：4 個檔案皆為 fork 既有維護檔（fork 目前為 2.98.0）。本 fork 不獨立重放版號推進 commit，待後續 stable tag diff 整合時統一更新版號。
- **衝突預判與調整**：無衝突；判定為**採用**（隨 tag diff 整版重放）。

#### 2. `afd76e0b8` fix(mistral): ship per-model effort ladders and fold native Chat ultra (#8259)
- **實算規模**：9 檔 +172/-10（`docs-site/.../providers.md`, `scripts/test-layout/layout.json`, `src/adapters/openai-chat/passthrough.ts`, `src/adapters/openai-chat/reasoning-wire.ts`, `src/providers/registry/entries-extended.ts`, `structure/catalog.md`, `tests/codex-integration/model-pinned-effort.test.ts`, `tests/fixtures/test-layout-expected.json`, `tests/providers/mistral-reasoning-efforts.test.ts`）。
- **內容說明**：Mistral 依模型提供 reasoning effort 階梯，並折疊原生 Chat ultra；新增 `mistral-reasoning-efforts.test.ts`。
- **對 fork 影響**：變更碰觸 fork 的 `passthrough.ts`、`reasoning-wire.ts` 與 `entries-extended.ts`。fork 在這些檔案均為標準 proxy 適配，無 fork 特有邏輯分歧。
- **衝突預判與調整**：無衝突；判定為**採用**。

#### 3. `e838c30f2` test: bound Windows overflow slices and preserve child cleanup (#8229) 【Windows 修正】
- **實算規模**：6 檔 +343/-16（`scripts/ci/test-durations.windows.tsv`, `tests/claude-integration/messages-overflow-baseline-contract.test.ts`, `tests/helpers/messages-overflow-assertions.ts`, `tests/helpers/messages-overflow-child.ts`, `tests/helpers/messages-overflow-differential.ts`, `tests/helpers/messages-overflow-spawn-tracker.ts`）。
- **內容說明**：Windows 專用測試修復：針對 Windows 限制 messages overflow 切片並保留子行程清理。新增 `messages-overflow-child.ts` 與 `messages-overflow-spawn-tracker.ts`。
- **對 fork 影響**：直接改善 Windows CI 與本機 messages overflow 測試的行程殘留與逾時問題。需特別注意 `scripts/ci/test-durations.windows.tsv`：fork 在 commit `15a0686b0` 與 `b34464034` 已獨立調校 Windows shard 權重，而 12 個 shard 與 cold-start budget 是在 `73c0a8ec4` 於 `ci.yml` 等檔配置。
- **衝突預判與調整**：測試與 helper 變更直接採用；`test-durations.windows.tsv` 需適配保留 fork 自行維護的分片權重配置，避免被上游覆蓋。判定為**採用（適配）**。

#### 4. `508a53563` fix(link): hedge leftover-pin refusal and count in-flight readiness reads (#8261)
- **實算規模**：3 檔 +5/-3（`docs-site/src/content/docs/guides/remote-link.md`, `src/client/orphan-token-recovery.ts`, `tests/clients/client-machine-listener.test.ts`）。
- **內容說明**：Remote Link 對 leftover-pin 拒絕增加避險，並計算 in-flight readiness reads。
- **對 fork 影響**：`src/client/orphan-token-recovery.ts` 在 fork 上曾針對 Windows NTFS file identity 進行重要適配（commit `a13d292e9`，改用 `lstatFileIdentity`／`fstatFileIdentity` 與 `sameFileIdentity`，並納入 `tests/lib/file-identity-callers.test.ts` 守衛）。上游本 commit 僅在 `:208` 微調 pin 拒絕字串與 listener 計數。
- **衝突預判與調整**：整合時不可直接整檔覆蓋 `orphan-token-recovery.ts`，必須手動保留 fork 的 bigint file identity 比對實作。判定為**適配**。

#### 5. `05eaaa388` test: stabilize Windows fixture setup and source checks (#8176) 【Windows 修正】
- **實算規模**：11 檔 +335/-206（`AGENTS.md`, `tests/adapters/anthropic/anthropic-image-retry-e2e.test.ts`, `tests/claude-integration/claude-529-mapping.test.ts`, `tests/claude-integration/messages-error-contracts.test.ts`, `tests/helpers/messages-overflow-case.ts`, `tests/helpers/messages-overflow-differential.ts`, `tests/helpers/remove-tree.ts`, `tests/providers/forward-admission-separation.test.ts`, `tests/providers/kiro/kiro-pool-load-settings.test.ts`, `tests/providers/kiro/kiro-quota-metrics.test.ts`, `tests/windows/windows-tray.test.ts`）。
- **內容說明**：Windows 專用穩定性修正：`remove-tree.ts` 新增常數 `BACKGROUND_WORK_TEARDOWN_TIMEOUT_MS = 2 * REMOVE_RETRY_BUDGET_MS + 5_000`（+4/-0）、`windows-tray.test.ts` 在 probe 就緒時等待 PID 寫入、強化 source checks 與 fixture 初始化。
- **對 fork 影響**：對 Windows 執行環境有直接益處。需注意 `AGENTS.md`：上游更新了測試說明，但 fork 頂部有專屬的維護型 fork overlay（`origin`、`upstream`、`FORK.md` 規則等）。
- **衝突預判與調整**：測試與 helper 程式碼直接採用；`AGENTS.md` 需手動保留 fork overlay 檔頭。判定為**採用（適配）**。

#### 6. `06764fddc` perf(kiro): count streamed tool argument bytes incrementally (#8140)
- **實算規模**：5 檔 +93/-6（`scripts/test-layout/layout.json`, `src/adapters/kiro/stream.ts`, `structure/transports/byte-accounting.md`, `tests/fixtures/test-layout-expected.json`, `tests/providers/kiro/kiro-tool-byte-accounting.test.ts`）。
- **內容說明**：Kiro adapter 在串流工具參數時改為增量計算位元組，提升高頻 tool-call 效能；更新架構文件並新增測試。
- **對 fork 影響**：純 runtime 效能改善與 layout 更新，fork 無相依分歧。
- **衝突預判與調整**：無衝突；判定為**採用**。

#### 7. `af92fb4e9` fix(ollama): bound tool-call validation work (#8147) 【安全】
- **實算規模**：12 檔 +120/-14（8 份 `ollama-clients.md`〔英文 1＋7 語系〕、`src/protocols/codecs/ollama.ts`、`structure/data-planes/ollama-inbound.md`、`tests/responses/responses-ollama-codec.test.ts`、`tests/server/server-ollama-inbound.test.ts`，共 12 檔）。
- **內容說明**：限制 Ollama inbound protocol 中的 tool-call 驗證工作量，防止惡意請求造成 CPU 密集阻塞。
- **對 fork 影響**：Ollama 協議編解碼器改進；依同檔「2026-11-05：全版 tag diff 重放」方法第 2 點，已刪語系（fr／ja／ko／ru／tr／zh-cn，fork 的 `docs-site/src/content/docs/` 下僅保留 `zh-tw`）不重放，只採英文與 zh-tw。
- **衝突預判與調整**：無衝突；判定為**採用**。

#### 8. `f1ce135e8` fix(responses): preserve mandatory tool choices through routing and recovery (#8146)
- **實算規模**：35 檔 +1551/-183（`src/server/responses/` 下多個模組、`src/server/request-log.ts`、新增 `tests/responses/responses-direct-chat-tool-choice.test.ts` 等）。
- **內容說明**：重大 pipeline 修正：在請求 routing 與 recovery 過程中完整保留強制的 tool choice（`tool_choice: "required"` / `"tool"`），防止重試或降級時丟失 tool choice。
- **對 fork 影響**：變更涵蓋 responses 核心流程。fork 在 `src/server/responses/` 曾適配 401 refresh wires 與參數剝除，需在整合時檢視 `request-transport.ts` 與 `adapter-dispatch.ts` 的邊界。
- **衝突預判與調整**：預期無邏輯衝突；整合時執行 `bun test tests/responses/` 完整驗證。判定為**採用**。

#### 9. `a369a4a32` fix(responses): preserve late Devin signatures for DSH clients (#8230)
- **實算規模**：15 檔 +1074/-29（Devin adapter continuation、reasoning envelope、新增 `tests/providers/devin-reasoning-continuation.test.ts` 等）。
- **內容說明**：為 DSH clients 保留 late Devin signatures，修復 reasoning continuation 簽名遺失問題。
- **對 fork 影響**：Devin provider 專屬邏輯，fork 在此無分歧。
- **衝突預判與調整**：無衝突；判定為**採用**。

#### 10. `803d6c0b4` fix(anthropic): batch affinity writes and confirm operator resets (#8020)
- **實算規模**：60 檔 +2069/-167（Anthropic session pool affinity 模組、新增 `tests/helpers/claude-endpoint-lifetime.ts`、多項 session 測試等）。
- **內容說明**：優化 Anthropic 帳號池 affinity 寫入機制（批次化寫入）並確認 operator reset 行為，減少高並發磁碟 I/O。
- **對 fork 影響**：affinity 寫入改為批次化，對 Windows 本機磁碟 I/O 延遲有正面改善。
- **衝突預判與調整**：無衝突；判定為**採用**。

#### 11. `4b821cf29` fix(workflows): enforce root send ceilings at physical admission (#8149) 【Windows 修正】
- **實算規模**：58 檔 +3092/-272（`src/server/responses/core.ts`、新增 `tests/responses/responses-workflow-send-ceiling.test.ts`、`tests/responses/responses-websocket-workflow-ceiling.test.ts` 等）。
- **內容說明**：在 physical admission 層強制執行 root send 預算上限，健全 workflow 執行控制；測試新增 `flushWindowsSecretAclReapsBeforeRemoval` 確保 Windows 秘密目錄清理。
- **對 fork 影響**：改動了核心請求路徑 `src/server/responses/core.ts`。AGENTS.md 明文規定 `src/server/responses/core.ts` 絕對不可引入 `src/lab/`。
- **衝突預判與調整**：整合時必須以 `bun test tests/lab/core-lab-boundary.test.ts` 驗證 core-lab boundary 未被打破。判定為**採用**。

#### 12. `41f316f40` feat(messaging): add opt-in stored Codex turn reply reads (#8053)
- **實算規模**：21 檔 +540/-28（`src/messaging/`、CLI 命令、docs 文件、新增 `tests/codex-integration/messaging-mcp-replies.test.ts` 等）。
- **內容說明**：新增 opt-in 的 stored Codex turn 回覆讀取功能與 MCP 佇列支援。
- **對 fork 影響**：messaging 擴充功能。實際 fork 在 messaging 的分歧是 `src/messaging/remote-files.ts` 改用 file-identity，這筆 commit 沒動那個檔，所以無衝突。
- **衝突預判與調整**：無衝突；判定為**採用**。

#### 13. `35d5010f5` Fix dashboard switch and combo layout regressions (#8269)
- **實算規模**：44 檔 +397/-108（GUI 控制元件、CSS 樣式、瀏覽器 fixture 與測試）。
- **內容說明**：修復 GUI dashboard switch 切換器與 combo layout 的樣式回歸問題。
- **對 fork 影響**：純 GUI 前端元件與測試，fork 無衝突。
- **衝突預判與調整**：無衝突；判定為**採用**。

#### 14. `bc635c805` Fix clipped Models rows and dashboard control layout (#8272)
- **實算規模**：22 檔 +779/-73（`gui/src/pages/Models.tsx`, `quota-summary-bar.css`, browser tests 等）。
- **內容說明**：修復 Models 頁面中的項目被截斷問題及 dashboard 控制項配置。
- **對 fork 影響**：純 GUI 前端變更，fork 無衝突。
- **衝突預判與調整**：無衝突；判定為**採用**。

#### 15. `883bf0fd7` Clarify Desktop startup safety and mask OAuth account labels (#8271) 【Windows 修正、安全】
- **實算規模**：65 檔 +1500/-169（`desktop/src-tauri/src/native_tray_accounts.rs`, `src/lib/privacy.ts`, `tests/service/service-desktop-supervision-windows.test.ts` 等）。
- **內容說明**：Windows 托盤與桌面啟動安全性改善，並遮罩 OAuth 帳號標籤；更新 i18n（含 zh-TW）。
- **對 fork 影響**：直接改善 Windows 托盤帳號顯示安全，符合 fork `privacy:scan` 零個資洩漏標準；`gui/src/i18n` 的 de／fr／ja／ko／pt／ru／tr／vi／zh 9 檔為 fork 已刪語系不重放，fork 只有 `en.ts` 與 `zh-TW.ts`。
- **衝突預判與調整**：Rust 托盤程式碼與 Windows 服務監督測試皆適用；需確認 `bun run privacy:scan` 通過，且重放時排除已刪語系檔。判定為**採用**。

#### 16. `19d14bc79` fix(qoder): accept unambiguous selected tool aliases (#8235)
- **實算規模**：6 檔 +78/-25（`src/adapters/qoder.ts`, `tests/providers/qoder-adapter.test.ts` 等）。
- **內容說明**：Qoder adapter 支援明確的選定工具別名解析。
- **對 fork 影響**：純 adapter 功能修復，fork 無分歧。
- **衝突預判與調整**：無衝突；判定為**採用**。

#### 17. `05408a312` fix(mistral): sanitize Chat fields and normalize native thinking content (#8278)
- **實算規模**：30 檔 +542/-36（Mistral Chat 欄位過濾、thinking 內容正規化與測試）。
- **內容說明**：淨化 Mistral Chat 欄位，並將 native thinking content 統一正規化。
- **對 fork 影響**：無衝突；判定為**採用**。

#### 18. `66e5b12e0` Fix omitted effort on dual-control Chat wires (#8279)
- **實算規模**：4 檔 +68/-5（`src/adapters/openai-chat/reasoning-wire.ts`, `tests/adapters/openai/openai-chat-reasoning-wire-policy.test.ts` 等）。
- **內容說明**：修復在雙控制 Chat wires 上遺漏傳遞 effort 參數的缺陷。
- **對 fork 影響**：無衝突；判定為**採用**。

#### 19. `a503cd708` Show app breakdowns and client chips (#8282)
- **實算規模**：42 檔 +1139/-221（`src/usage/app-breakdown.ts`, GUI 元件, usage tests 等）。
- **內容說明**：在 GUI 與用量統計中新增 app 分類明細與 client chips 顯示。
- **對 fork 影響**：純 usage 統計與前端展示擴充，無衝突。
- **衝突預判與調整**：無衝突；判定為**採用**。

#### 20. `ac2e7dfb0` Honor max omission before native ultra clamping (#8284)
- **實算規模**：3 檔 +66/-5（`src/adapters/openai-chat/reasoning-wire.ts` 等）。
- **內容說明**：在執行 native ultra clamping 前遵循 max omission 設定。
- **對 fork 影響**：無衝突；判定為**採用**。

#### 21. `c61e95790` fix(desktop,gui): align macOS traffic lights on Sequoia and keep chips rounded in WKWebView (#8285)
- **實算規模**：7 檔 +174/-9（`desktop/src-tauri/src/lib.rs`, `desktop/src-tauri/src/traffic_lights.rs`, GUI theme 等）。
- **內容說明**：macOS Sequoia traffic light 排版對齊與 WKWebView 圓角修正。
- **對 fork 影響**：`traffic_lights.rs` 為 macOS 專屬實作。fork 是 Windows-only，需確認在 Windows 建置時該檔案被 `#[cfg(target_os = "macos")]` 隔離，避免引入非 Windows 平台相依。
- **衝突預判與調整**：需確保 Windows cargo build / typecheck 不受影響；判定為**適配**。

#### 22. `1b87631d5` test: isolate Codex CLI update fixture process scans (#8283)
- **實算規模**：6 檔 +151/-1（`tests/codex-integration/codex-cli-update-process-fixture.test.ts` 等）。
- **內容說明**：隔離 Codex CLI 更新測試 fixture 的行程掃描，避免跨測試進程污染。
- **對 fork 影響**：測試穩定性優化，對 Windows 的行程釋放與鎖定問題特別有益。
- **衝突預判與調整**：無衝突；判定為**採用**。

#### 23. `aaa3c20f3` Fix launcher signal race and chat-completions network flake (#8289) 【Windows 修正】
- **實算規模**：14 檔 +190/-72（`bin/ocx.mjs`, `src/lib/launcher-signal-forwarding.mjs`, `tests/cli/ocx-launcher-desktop-handoff.test.ts` 等）。
- **內容說明**：修復 launcher 信號競爭問題（`launcher-signal-forwarding.mjs` 在 win32 只轉發 SIGINT／SIGTERM），並降低 chat-completions 網路測試 flake。
- **對 fork 影響**：`bin/ocx.mjs` 為 CLI 啟動入口。fork 在 `structure/runtime.md` 規定 Windows 永遠走 package 路徑（跳過 POSIX desktop handoff）。
- **衝突預判與調整**：整合時需確認 Windows 上的啟動路徑不退化，信號轉發模組在 Windows 下正常運作。判定為**採用**。

#### 24. `6df9e1176` perf(command-code): measure fragmented NDJSON incrementally (#8277)
- **實算規模**：3 檔 +68/-7（`src/adapters/command-code.ts`, `structure/transports/byte-accounting.md`, `tests/providers/command-code-buffer-budget.test.ts`）。
- **內容說明**：Command Code adapter 增量計量分段 NDJSON 效能優化。
- **對 fork 影響**：純 adapter 效能改善，無衝突。
- **衝突預判與調整**：無衝突；判定為**採用**。

#### 25. `eedbb2b0a` test(config): retain uninstall refusal diagnostics (#8242)
- **實算規模**：1 檔 +5/-2（`tests/config/config-ownership-concurrent-record.test.ts`）。
- **內容說明**：在測試中保留 config 卸載拒絕時的診斷訊息。
- **對 fork 影響**：無衝突；判定為**採用**。

#### 26. `de411020e` fix(privacy): keep masked account label validation linear (#8316) 【安全】
- **實算規模**：2 檔 +30/-1（`src/lib/privacy.ts`, `tests/lib/privacy-mask-account.test.ts`）。
- **內容說明**：使遮罩帳號標籤的驗證維持線性時間複雜度，修復隱私欄位驗證可能出現的效能瓶頸（防 DoS 安全改善）。
- **對 fork 影響**：提升 privacy 驗證效能，無衝突。
- **衝突預判與調整**：無衝突；判定為**採用**。

#### 27. `ee0e275e6` release: promote frozen tip de411020ed5e6df2a2223589bbeeedb412f57bfb to main as 2.99.0 (ours merge of main)
- **實算規模**：0 檔 +0/-0（First parent 為 `de411020e`，second parent 為 `36aa9e8f7`）。
- **內容說明**：上游 release promotion commit，採用 ours merge 將 frozen tip 提拔至發布狀態。
- **對 fork 影響**：發版流程專屬 commit，無實際程式碼改動。本 fork 採 tag diff 整合，不重放 promotion PR。
- **衝突預判與調整**：判定為**不適用**。

#### 28. `667662903` Merge pull request #8322 from lidge-jun/release/promote-main-2.99.0-r2 【Windows 包含】
- **實算規模**：410 檔 +14575/-1662（First parent 為 `36aa9e8f7` 即 `v2.98.0`，second parent 為 `ee0e275e6`）。
- **內容說明**：上游 PR #8322 將 2.99.0 發版 tip 合併回 main 分支，為 release tag `v2.99.0` 的所在節點。
- **對 fork 影響**：此 commit 匯總了 `v2.98.0` 至 `v2.99.0` 的所有變更（上述 1～26 項之總和）。fork 依據維護守則，將在後續整版整合時以 `git diff refs/upstream-tags/v2.98.0 refs/upstream-tags/v2.99.0` 全版重放至 `main`。
- **衝突預判與調整**：待後續獨立 CI 分支依下節清單進行適配重放。判定為**整版整合**。

### 整合時注意與調整清單（Checklist）

在後續獨立分支進行 `v2.99.0` 整版 tag diff 重放時，需特別核對以下 7 處 fork 特有差異：

1. **Windows CI Shard 權重**（`scripts/ci/test-durations.windows.tsv`，涉及 `e838c30f2`）：
   - fork 在 commit `15a0686b0` 與 `b34464034` 已獨立配置 Windows shard 權重（12 個 shard 與 cold-start budget 則由 `73c0a8ec4` 在 `ci.yml` 配置）；重放時不可直接覆蓋，需保留 fork 專屬分片權重。
2. **NTFS Bigint File Identity 比對**（`src/client/orphan-token-recovery.ts`，涉及 `508a53563`）：
   - fork 在 commit `a13d292e9` 將其改為 `lstatFileIdentity`／`fstatFileIdentity` 與 `sameFileIdentity`（處理 NTFS 64-bit file ID），重放上游 pin refusal 微調時需手動保留此邏輯，切勿回退為上游 Number 比對。
3. **AGENTS.md 檔頭 Overlay**（`AGENTS.md`，涉及 `05eaaa388`）：
   - 上游修訂測試說明時會更動 `AGENTS.md`，重放時需完整保留 fork 頂部的 SanHsien 維護型 fork overlay 宣告。
4. **macOS 專屬 Rust 程式碼隔離**（`desktop/src-tauri/src/traffic_lights.rs`，涉及 `c61e95790`）：
   - fork 為 Windows-only 環境，需確認該模組在 Windows 上具備完整的 `#[cfg(target_os = "macos")]` 條件編譯，或由 fork hygiene 排除，避免 Windows cargo check 失敗。
5. **CLI 啟動路徑**（`bin/ocx.mjs`，涉及 `aaa3c20f3`）：
   - fork 規定 Windows 環境永遠使用 package 路徑（不走 POSIX desktop handoff），信號轉發更新需維持此行為契約。
6. **Core-Lab 邊界守衛**（`src/server/responses/core.ts`，涉及 `4b821cf29`）：
   - responses core 大幅改動後，重放後必須執行 `bun test tests/lab/core-lab-boundary.test.ts` 確認零 lab 模組滲漏至 core 路徑。
7. **已刪語系不重放**（涉及 `af92fb4e9`、`883bf0fd7` 等）：
   - 整份 tag diff 有 36 個已刪語系檔（docs-site 的 fr／ja／ko／ru／tr／zh-cn 27 檔、`gui/src/i18n` 非 en／zh-TW 的 9 檔）；依維護規則（同檔「2026-11-05：全版 tag diff 重放」方法第 2 點）一律不重放，僅採英文與 zh-tw / zh-TW。

### 上游分支狀態事實紀錄

經由 `git ls-remote --symref https://github.com/lidge-jun/opencodex.git HEAD` 實查，上游已刪除 `main` 分支，目前遠端 HEAD 指向 `refs/heads/dev`。因 `tools/upstream_baseline.json` 當時設定 `"branch": "main"`，`tools/check-upstream-updates.ts` 執行時 fetch `+refs/heads/main` 會失敗。追蹤目標已於同日整合時決定：改追 stable release tag（`DECISIONS.md` 2026-11-09 決定二）。

## 2026-11-09（續）：全版 tag diff 重放 `v2.98.0..v2.99.0`（`667662903`）

`git diff refs/upstream-tags/v2.98.0 refs/upstream-tags/v2.99.0` 共 410 個檔案（60 新增、350 修改、0 刪除；+14575／-1662；`v2.99.0` = `667662903a6c139524506667d12656d9ad50fad0`，2026-11-08 發布），以單一 parent、不 merge 上游的 tag-diff 法套到 `main`（fork 基準 `af0cf157f`）。分支 `ci/tagdiff-v2.99.0`。逐檔清冊在 [`upstream-v2.98.0-v2.99.0-files.tsv`](upstream-v2.98.0-v2.99.0-files.tsv)（欄位與前兩份相同，由 blob 雜湊比對機器產生，**不手改**；`/docs/` 在 `.gitignore`，要 `git add -f`）。方法、Windows-only 刪除清單、已刪語系與生成物規則同「2026-11-05：全版 tag diff 重放」節；本節只寫數字與例外。上面「整合前審查」的 28 筆 commit 全落在這份 tag diff 內。

### 計數（410 個上游變更檔）

| 判定 | 檔數 | 說明 |
| --- | --- | --- |
| 已等價（重放前 fork blob 即與 `v2.99.0` 相同） | 1 | `gui/tests/codex-stale-banner.test.ts` |
| 採用（重放後與 `v2.99.0` blob 逐位元相同） | 330 | 乾淨採用 271（fork 與 `v2.98.0` 相同）＋新增檔 59 |
| 適配（重放後與上游不同，fork 保留／改寫部分 hunk） | 42 | 3-way 合併的 41 個檔案（31 個無衝突、10 個有衝突）加 1 個新增檔（`gui/tests/usage-app-breakdown.test.tsx`，CI 後語系迴圈縮成 en／zh-TW）；逐檔原因在 TSV 備註欄 |
| 不適用 | 37 | 已刪語系 36（docs-site 的 fr 4、ja 4、ko 6、ru 4、tr 5、zh-cn 4 共 27，`gui/src/i18n` 九個非 en／zh-TW 語系檔 9）、Windows-only 刪除清單 1（`tests/service/service-desktop-startup-linux.test.ts`） |

36 個已刪語系檔與整合前審查清單第 7 條的數字相同。生成物（`scripts/ci/test-durations.windows.tsv`、`scripts/test-layout/layout.json`、`tests/fixtures/test-layout-expected.json`、`structure/manifest.json`、`structure/INDEX.md`）依方法第 3 點處理，見下。

### 10 個有衝突的檔案

| 檔案 | 衝突 | 取捨 |
| --- | --- | --- |
| `scripts/ci/test-durations.windows.tsv` | 2 | 整份保留 fork 的量測值（決定十二兩個 run 的平均），不取上游。上游只動 7 個既有列，這 7 檔 fork 的值本來就是自己量的：`messages-overflow-baseline-contract` 65 → 上游 224、`-builtin` 366149 → 391302、`-collectors` 10872 → 9197、`-native` 365986 → 290644、`-stream` 8678 → 8748、`-translated` 311167 → 346067、`-verdicts` 330663 → 255760（毫秒）。重放後 `git diff` 此檔為空。60 個新增檔沒有列，依 runner 慣例以中位數計；下一次完整 run 再用 CI log 刷新 |
| `scripts/test-layout/layout.json` | 1 | 保留 fork 版，只補上游新增的 5 個條目（`chat-native-mistral-content`、`kiro-tool-byte-accounting`、`messaging-mcp-replies`、`mistral-reasoning-efforts`、`openai-chat-mistral-policy`）；JSON 解析通過，`tests/test-layout*.test.ts` 過 |
| `tests/helpers/messages-overflow-assertions.ts` | 3 | 以上游 `v2.99.0` 為底，採用它在 Windows 慢速 lane 的 16 列切片（`e838c30f2`，與 fork 決定九的 30 秒預算問題同源，上游自己的修法）；移除 `hostedWindowsQuarantine` 匯入與 `test.skipIf`（決定五：fork 不遮蔽紅燈）；timeout 仍用 `COLD_SPAWN_BUDGET_MS` 而不是上游的字面 `30000` |
| `tests/claude-integration/messages-error-contracts.test.ts` | 1 | `messages-native.ts` 取上游 5（新增的是 owned workflow refusal projection）；`claude-messages.ts` 保留 fork 的 31（決定十一，上游仍是 30） |
| `tests/responses/responses-pool-401-refresh.test.ts` | 1 | 取上游新增的 `configuredOutboundFetch` 攔截區塊，harness 回傳值保留 fork 的 `refreshWires`（fork `#7840` 的兩個測試依賴它）。合併後剛好 2000 行，碰到 `file-size-ratchet` 的 `NEW_OVERSIZED` 門檻，故把 fork 兩個測試中三次的 5 行 `handleResponses(...)` 呼叫各併成一行（檔案 1992 行），沒有改斷言 |
| `tests/web-search/web-search-anthropic.test.ts` | 1 | 取上游的型別匯入（新增 `AdapterEvent`、`OcxParsedRequest`、`ProviderAdapter`），保留 fork 的 `CLAUDE_CLI_USER_AGENT` 匯入 |
| `gui/src/i18n/v2-pages/logs-copy.ts`、`usage-copy.ts` | 各 1 | fork 版已是 en／zh-TW 兩欄，上游是 11 欄。不取上游，只把上游新增的列（logs 3 列：`client`、`clientUnknown`、`clientOther`；usage 4 列：`app`、`unclassified`、`appsUnavailable`、`appsEmpty`）機器縮成 en（第 0 欄）與 zh-TW（第 5 欄）後插入 |
| `docs-site/src/content/docs/zh-tw/guides/web-dashboard.md` | 2 | 第一處 fork 的「帳號選擇」與上游新增的「依應用程式查看用量」都是新增段，兩者並存；第二處（篩選請求日誌的結尾段）上游把英文刪成較短版（`v2.98.0` 的「重設後鍵盤焦點移回 All 控制項」與「方向鍵／Home／End」兩句在 `v2.99.0` 的英文都不存在），繁中跟著刪 |
| `docs-site/src/content/docs/zh-tw/reference/management-api.md` | 1 | 取上游 `PUT /api/oauth/accounts/active` 與 `.../pause` 兩列新增的 503 `affinity_reset_not_persisted` 說明，保留 fork 的 `/api/pool/settings` 與舊版 `accounts/pool` 兩列（英文版也是這樣） |

另一個需要手動補的不是衝突：`docs-site/src/content/docs/zh-tw/reference/cli/messaging.md` 沒有上游 `41f316f40` 新增的「Opt-in stored turn replies」段，而 `docs-zh-tw-parity` 的段落數與程式碼區塊數就此各差一（5／6、18／20）。已補譯成繁中（一個程式碼區塊，段落數 6／6、fence 20／20）。同時發現這頁 zh-tw 本來就缺英文版的「MCP queue host」段，段落數原本相等是巧合（頁內留著英文的「Sender and replies」段又加繁中的「寄件者與回覆」段），列入 `ROADMAP.md` 近期列。

### 整合前審查清單 7 條的結果

| # | 項目 | 結果 |
| --- | --- | --- |
| 1 | Windows CI shard 權重（`e838c30f2`） | 保留 fork 的量測值，見上表第一列；shard 數與 `timeout-minutes` 不動（`ci.yml` 不在這份 tag diff 內） |
| 2 | `orphan-token-recovery.ts` bigint identity（`508a53563`） | 無衝突：3-way 只帶進上游改的一行拒絕訊息，`lstatFileIdentity`／`fstatFileIdentity`／`sameFileIdentity` 原樣保留；`tests/lib/file-identity-callers.test.ts` 過 |
| 3 | `AGENTS.md` overlay（`05eaaa388`） | 無衝突：檔頭 fork overlay 保留，只帶進上游 `devlog/` 一段的改寫 |
| 4 | `traffic_lights.rs` macOS 隔離（`c61e95790`） | 新模組在 `lib.rs` 以 `#[cfg_attr(not(target_os = "macos"), allow(dead_code))]` 宣告，使用處（`traffic_lights::X`、`y_for`）在 `#[cfg(target_os = "macos")]` 區塊內；Windows 編譯結果見 `REVIEW.md` 2026-11-09 節 |
| 5 | `bin/ocx.mjs` 啟動路徑（`aaa3c20f3`） | 無衝突：信號轉發搬到新的 `src/lib/launcher-signal-forwarding.mjs`（win32 只轉 SIGINT／SIGTERM），Windows 走 package 路徑的行為未動；launcher 三個測試檔結果見 `REVIEW.md` |
| 6 | core-lab 邊界（`4b821cf29`） | `tests/lab/core-lab-boundary.test.ts` 過 |
| 7 | 已刪語系 36 檔 | 不重放，見計數表 |

### 其他適配

- 版號：`package.json`、`desktop/src-tauri/Cargo.toml`、`Cargo.lock`、`tauri.conf.json` 取 `2.99.0`（updater 設定不變）。
- `tests/helpers/windows-ci-quarantine.ts` 與 5 個使用點在 `v2.99.0` 與 `v2.98.0` 相同（上游這輪沒有解除隔離），fork 不採，見決定五；唯一需要動的是上游這輪新改的 `messages-overflow-assertions.ts`（上表）。
- `tests/fixtures/test-layout-expected.json`、`scripts/test-layout/layout-clients.json`、`structure/manifest.json`、`structure/INDEX.md`：3-way 合併後沒有衝突，剔除與補回的結果由 `tests/test-layout*.test.ts` 與 `structure:check` 驗證。
- 檔案行數上限：`docs/fork/UPSTREAM.md` 在整合前審查那一版已是 2123 行，超過 `scripts/file-size-ratchet.ts` 的 2000 行門檻（`NEW_OVERSIZED`），上限只能靠搬移處理，所以把 2026-08-23 至 2026-10-03 的 909 行歷史逐字搬到 [`UPSTREAM-archive-2026-08-to-10.md`](UPSTREAM-archive-2026-08-to-10.md)，並刷新檔頭過時的「追蹤分支」「下一次要做什麼」與兩處行號引用。
- 追蹤目標與工具變更：`DECISIONS.md` 2026-11-09 決定二。

### CI 後續修正（分支 `ci/tagdiff-v2.99.0`）

| Run（head） | 結果 | 失敗與修正 |
| --- | --- | --- |
| 42627438708（`eaa0b2520`） | `gates` 與 `windows 5/12` 失敗，其餘 11 片、`keyring windows`、Fork maintenance 42627443847、Catalog async contracts 42627449712 成功 | (1) `gates` 的 GUI 測試：新增檔 `gui/tests/usage-app-breakdown.test.tsx` 的「App breakdown copy is present in all eleven locales」對 `ko` 等九個 fork 已刪語系取文案，`Expected and actual values must be numbers or bigints`；迴圈縮成 `["en", "zh-TW"]`（`d01c71cd6`，清冊該列改為適配）。(2) `windows 5/12` batch 40/43 的 `update-mutation-guard`「known-pattern lint finds no unclassified update primitive references」與「known-pattern helper inventory has explicit control-site contracts」：`src/update/orchestrated-live-identity.ts` 在 2026-11-09 的 `595ee1e27`（CodeQL #623 的 bigint identity 修正，不在這份 tag diff 內）改 import 為 `lstatFileIdentity`／`fstatFileIdentity` 後，`tests/helpers/update-review-orchestrated-entry.ts` 的審查列仍寫舊的 `node:fs` import，所以 `main` 本身就是紅的，只是 `main` 沒有跑 Windows 全量；審查列更新後該檔 4 pass／0 fail（`df6a0ad47`） |
| 42631654245（`df6a0ad47`） | `ci` success：12 個 Windows shard、`keyring windows`、`gates` 全 success | shard 1 到 12 的耗時依序為 22.1、15.4、19.0、15.8、23.9、20.2、25.6、25.4、22.6、25.1、21.7、23.8 分鐘（取自各 job 的 startedAt／completedAt），最長 25.6 分鐘，距 30 分鐘上限只剩約 4.4 分鐘；60 個新增檔當時沒有權重列 |
| 42637255094（`3357585fd`） | success：12 個 Windows shard 與 aggregate `ci` 全 success；shard 1 到 12 耗時 26.1、22.4、25.1、23.9、19.9、24.0、26.9、21.8、21.7、17.6、24.7、26.7 分鐘，最長 26.9 | 以 24 份 job log（上列兩個 run 的 12 片各一）重新量測 `scripts/ci/test-durations.windows.tsv`（2948 檔全部有量測值，模擬 12 片分配每片 1248 秒），`3357585fd` |

### 水位

**已推進（2026-11-09）**：`tools/upstream_baseline.json` 的 `integrated_tag` 由 `v2.98.0` 推到 `v2.99.0`，`integrated_through`／`reviewed_through` 為 `667662903a6c139524506667d12656d9ad50fad0`，`reviewed_date` 為 2026-11-09，PR 水位新增 #8252（共 23 筆 `reviewed_pr_numbers`，判定見 `DECISIONS.md` 決定五），`reviewed_issue_through` 維持 8336。依據：分支 `ci/tagdiff-v2.99.0` 的 `Cross-platform CI` run 42631654245（`df6a0ad47`）與 run 42637255094（`3357585fd`，權重刷新後）12 個 Windows shard 與 aggregate `ci` 全 success，且 `36aa9e8f7..667662903` 的 28 筆 commit 全落在這份 tag diff 內。推進後 `bun tools/check-upstream-updates.ts --strict` 的結果見 `REVIEW.md` 2026-11-09 節。

## 2026-11-14：`v2.99.0..v2.100.2` commit 軸整合前審查（163 筆，未整合）

範圍為 `refs/upstream-tags/v2.99.0`（`667662903a6c139524506667d12656d9ad50fad0`）至 `refs/upstream-tags/v2.100.2`（`61147ec681bc8374d350e0eae08b71c117c6df30`），共 163 筆 commit，無 merge commit；tag diff 為 1236 檔（370 新增、866 修改、0 刪除），+129468/-13987。fork 基準為 `025dd546ad63ac2cc5290400aaf95fcc48c63a2c`（2.99.2）。中間 tag 為 `v2.100.0`（`0d691be83`）與 `v2.100.1`（`00c02163e`）。

本節只建立 commit 軸整合前審查；不執行重放，不推進 `tools/upstream_baseline.json` 的審查或整合水位。判定「採用」表示後續隨 tag diff 帶入；「適配」表示採用並保留或改寫 fork 差異；「不採」指相關 hunk 不進 fork；「不適用」指在 tag 淨結果中無須另行帶入。判定不表示已整合。

### 主題審查與 fork 影響（T1–T11）

| 主題 | 內容 | 筆數 | 判定 | fork 影響與整合時處理 |
| --- | --- | --- | --- | --- |
| T1 | 發版流程與分支政策 | 12 | 適配 | 採用不執行的 release scripts 與 version-line 檔案；保留官方 repo guard。不採 ci.yml、service-lifecycle.yml、catalog-async-contracts.yml 的 dev-only 限制及移除 push／schedule；保留 fork 的 main 觸發與夜間排程。release-evidence-policy.json 的上游 CI blob 雜湊須配合 fork 差異；gates 維持不加 node --test release-evidence.test.cjs。四個版本來源的上游 blob 均為 2.100.0，整合時以 release-version-sources.ts sync 2.100.2 設定版號。 |
| T2 | CI 與測試基礎 | 13 | 採用／適配／不採 | 1c97e3c16 的 Windows native-claim 診斷 job 與 helper 採用，if 改成 fork main 可用條件；f8dfc2f83 保留診斷與 fork 不隔離紅燈的斷言。28b38f915 的 LIDGE_RUNNERS 自架 runner 不採，維持 ubuntu-latest。3842ebcc5 保留 fork Windows 權重，CI 成功後重新量測；5cb7d6591 共用權重採上游並剔除不存在的測試；b967316b2 按生成物規則合併。Rust toolchain 與其餘測試穩定化修正採用。 |
| T3 | 遙測 | 10 | 適配（D1） | 程式採用，fork 預設不送、不詢問；collector 固定為 telemetry.opencodex.me，fork 不部署 collector 或站台。新增 fork-policy.ts 的 forkTelemetryBlocked() 預設 true，僅測試環境與專用變數同時成立才放行；consent.ts 的 isTelemetryEnvOptOut() 回 OCX_TELEMETRY，sender.ts 與 profile/client.ts 兩個出口另設閘門。MSI 不連結 fragmentPaths／componentGroupRefs；installer_telemetry.rs 與 wix fragment 保留，沒有登錄值時不動作。以測試固定 effective: false、兩出口不呼叫 fetch、Tauri 不連結 fragment，並調整上游安裝頁測試；英／繁中 telemetry 文件與 FORK 差異同步說明。政策可逆，重新評估條件為要參與上游統計或有 fork 自用 collector。 |
| T4 | 更新 | 3 | 採用 | 10972dd96 新增 minisign、signed-supply、update 模組與 trust-root 共 21 檔，尚未接上執行路徑；forkSelfUpdateBlocked() 閘門保留。2f40e96aa 的 update import-policy 與 process allowlist 採用；整合後整個 tests/update 以 fresh-process 執行。 |
| T5 | 撤回與重新合入 | 29 | 以 tag diff 淨結果為準 | 0fac612a9 撤回 14 筆原始 PR，原始 commit 不單獨重放；12 筆重新合入與 fb814f90a、15f39a303 後續修正採用。#8299 與 #8276 未重新合入，詳見下文。f3657d3f3 回收多個已死 owner 的 shim restore 鎖，整合並滿足 #8317 驗收後才刪 ROADMAP 對應列；9129c0e23 涉及 launcher、update、install.ps1 與 update-job，確認 fork 閘門在所有安裝呼叫之前。 |
| T6 | Remote Link 與 Rust ocx-child | 13 | 採用 | f14a2c104 新增 native/ocx-child 獨立 Rust crate（22 檔、+13737）及 package scripts／files；fork MSI 不建它，確認 fork-release-windows.yml 與 prepare-sidecar.ts 不增加必要步驟。e5e757afd 的 SSH 遠端部署與 9e7b3ea9b 的私有本機控制 socket 屬安全邊界，整合時逐檔判定；remote-windows.ts、link-pinned-sync-argv 與 link-tunnel-history 保留 fork 差異。 |
| T7 | Windows／服務／設定／Lab | 12 | 採用／適配 | a72c52220 的唯讀 catalog、35d96de88 的 JSONC BOM、f1a132eec 的 launchd 與 80d79b51a 的 Keychain 修正採用。0c3fd3fbb 的 bind 啟動復原須按 #8318 驗收，尚不能認定已解決。25a1bfc69／8c28f5f2b 的 config ownership 適配並逐檔判定；fabc69ee1 的 Lab 六檔以 OS 鎖與 bigint identity 的上游設計處理。Windows 服務 wrapper、guest_choice 與 prompt-lock-claim 不在本輪上游變更內；桌面 startup.rs／lib.rs／sidecar.rs 變更為遙測安裝選項掛點。 |
| T8 | Anthropic／Claude／帳號 | 16 | 採用 | 產品修正採用；00c02163e 將 Claude Code 對外版本升至 2.1.321，SDK 改為 0.128.0／v26.12.1，client-fingerprint 的舊版寫死值須同步。claude-messages.ts、cli/claude.ts、oauth/store.ts 保留 fork 差異。這組依主旨與規模分類，未逐筆讀 diff。 |
| T9 | Combos／Responses／sidecar／adapter／provider | 39 | 採用 | 依產品修正慣例同步；保留 compact.ts、request-prepare.ts、request-log.ts、router.ts、tool-schema.ts、vendor-probes-key.ts、entries-core.ts、quota.ts、types/config.ts 的 fork 差異。550d0d669 整合後重查 /responses/compact 追蹤列；provider-models.ts 的 4e83a8e36／9e88602b0 須解衝突。combo-management-api 測試避免重複貼入 fork 案例。這組依主旨與規模分類，未逐筆讀 diff。 |
| T10 | GUI 與用量 | 14 | 採用（語系適配） | 九個已刪的非 en／zh-TW 語系不重放；新增多語系欄位表與寫死十一語系的測試縮成 en／zh-TW。295159fb5、79ba4f29f、a1441404b 新增 SQLite filter index 與 WAL sidecar，測試限隔離設定目錄。這組依主旨與規模分類，未逐筆讀 diff。 |
| T11 | 文件與站台 | 2 | 適配／採用 | 573c1dc61 不覆蓋繁中 README.md；readme/README.zh-TW.md 保留 fork 並補需要的新段落。4a22eda84 首頁、導覽與主題改版採用；astro.config.mjs 側欄只加 zh-TW 標籤，已刪語系不恢復。 |

`0fac612a9` 撤回的 14 筆中，12 筆已重新合入；**#8299（`9aeffab72`，relay 未分類 SSE 錯誤）與 #8276（`83c9c3e6c`，#8274／#8276 link route intent，173 檔）被撤回後未重新合入，不在 `v2.100.2` 的淨變更內**，不另行 cherry-pick。清冊保留原始 commit 與撤回 commit，整合以兩個 tag 的淨 diff 為準。

### Commit 軸清冊（163 筆）

依 commit 拓樸由舊到新排列。規模逐筆使用 `git diff --numstat <c>^1 <c>` 實算（`MSYS_NO_PATHCONV=1`），檔數為 numstat 列數，加刪行數逐列加總；各筆累計包含撤回與重新合入，不等於 tag 淨 diff 的規模。

| Commit | 日期 | 變更規模 | 主題 | 判定 | 主旨 |
| --- | --- | --- | --- | --- | --- |
| `0627a2c25` | 2026-11-08 | 4 檔 +4/-4 | T1 | 適配 | chore(release): open dev at 2.100.0 before releasing 2.99.0 (#8313) |
| `5279c91bf` | 2026-11-08 | 57 檔 +1378/-96 | T10 | 採用 | fix(gui): configure Google Vertex ADC (#8311) |
| `573c1dc61` | 2026-11-08 | 9 檔 +225/-179 | T11 | 適配 | docs(readme): GOAT link, official-API commercial note, account pool under Advanced usage (#8006) |
| `56d9ab4db` | 2026-11-08 | 14 檔 +2672/-0 | T4 | 採用 | docs: plan automatic update parity (#8275) |
| `b3373c96c` | 2026-11-08 | 22 檔 +222/-13 | T10 | 採用 | fix(gui): show WorkBuddy credit balance in quota bar (#8323) |
| `b670ddb3e` | 2026-11-08 | 31 檔 +1444/-122 | T9 | 採用 | fix(combo): stop the prompt-cache usage leak — replay native Messages on Anthropic children (#7374) |
| `569bacd67` | 2026-11-08 | 56 檔 +4941/-3140 | T1 | 適配 | Release preview and stable from verified dev commits (#8328) |
| `cf46eac26` | 2026-11-08 | 1 檔 +46/-13 | T1 | 適配 | fix(tests): use native Windows paths for release shell (#8335) |
| `a235ef5d1` | 2026-11-08 | 30 檔 +1143/-48 | T10 | 採用 | fix(gui): show verified Claude account in provider overview (#8334) |
| `f8dfc2f83` | 2026-11-08 | 2 檔 +224/-6 | T2 | 適配 | Diagnose Windows native-main claim setup failures (#8341) |
| `35d96de88` | 2026-11-08 | 7 檔 +63/-5 | T7 | 採用 | Fix leading BOM handling in JSONC configuration (#8205) |
| `e5c9e3fc2` | 2026-11-08 | 8 檔 +97/-16 | T9 | 採用 | Fix supplementary Han token estimates (#8207) |
| `d16ba6cc6` | 2026-11-08 | 5 檔 +39/-3 | T9 | 採用 | Stop sidecar parsing at terminal events (#8209) |
| `a5455803b` | 2026-11-08 | 5 檔 +98/-2 | T9 | 採用 | Preserve final sidecar citation titles (#8198) |
| `fabc69ee1` | 2026-11-08 | 14 檔 +498/-461 | T7 | 適配 | fix: serialize Lab public-evidence mutation with an OS-held lock and compare Lab file identity with bigint stat (#8035) |
| `7fe985a5b` | 2026-11-08 | 8 檔 +334/-13 | T9 | 採用 | fix(combos): keep Codex metadata frames from committing a combo child (#8152) |
| `1c97e3c16` | 2026-11-08 | 9 檔 +271/-31 | T2 | 適配 | ci: add targeted Windows native claim diagnostic lane (#8345) |
| `10972dd96` | 2026-11-08 | 44 檔 +2987/-58；1 個二進位檔 | T4 | 採用 | Add offline signed-update verification and checkpoint codec (#8294) |
| `fac611ea5` | 2026-11-08 | 7 檔 +617/-0 | T3 | 適配（D1） | docs(devlog): plan default-on (opt-out) telemetry and the opencodex.me usage dashboard (#8293) |
| `2c01f5648` | 2026-11-08 | 2 檔 +394/-0 | T6 | 採用 | docs(devlog): design Child-to-Home account move over Remote Link (OCX-4) (#7495) |
| `687dec84e` | 2026-11-08 | 13 檔 +676/-94 | T8 | 採用 | Show observed Claude CLI quota for the current account (#7916) |
| `f14a2c104` | 2026-11-09 | 54 檔 +16650/-33 | T6 | 採用 | feat(link): add lightweight Rust ocx-child ephemeral Child relay and offline journal (#8237) |
| `9d7473f9e` | 2026-11-09 | 11 檔 +84/-15 | T10 | 採用 | fix(gui): show Claude account email when privacy.maskEmails is false (#8364) |
| `f1c895e97` | 2026-11-09 | 1 檔 +5/-1 | T1 | 適配 | test: use independent expected paths in the Windows release PATH contract (#8336) (#8366) |
| `afd487b6d` | 2026-11-09 | 2 檔 +33/-5 | T1 | 適配 | fix(release): stream progress while watching a dispatched release (#8330) (#8367) |
| `ae350ddcd` | 2026-11-08 | 4 檔 +91/-16 | T1 | 適配 | docs(release): describe history reconciliation and attested resume (#8346) |
| `4bef566e7` | 2026-11-08 | 22 檔 +737/-74 | T8 | 採用 | Support image inputs for Claude CLI (#7978) |
| `e5e757afd` | 2026-11-09 | 51 檔 +3823/-272 | T6 | 採用 | feat(link): zero-preinstall SSH ocx-child planting, --purge detach, and #remote UX (#8255) |
| `578c8bde0` | 2026-11-09 | 8 檔 +973/-42 | T9 | 採用 | Reconcile sidecar text snapshots (#8197) |
| `28b38f915` | 2026-11-09 | 2 檔 +15/-5 | T2 | 不採 | ci: run heavy Linux jobs on the lidge self-hosted pool for trusted runs (#8369) |
| `399925164` | 2026-11-08 | 1 檔 +197/-0 | T10 | 採用 | test(gui): cover verified Claude Overview account labels |
| `f6506e727` | 2026-11-09 | 1 檔 +32/-0 | T1 | 適配 | ci: pin release evidence policy to the current ci.yml (#8377) |
| `df4b71b39` | 2026-11-09 | 2 檔 +21/-1 | T7 | 採用 | fix(integrations): keep Aside aggregate current when unselected profiles are absent (#8373) |
| `9e7b3ea9b` | 2026-11-09 | 17 檔 +1541/-9 | T6 | 採用 | fix(link): serve ocx link status over a private local control socket (#8370) |
| `77d97d290` | 2026-11-09 | 6 檔 +77/-22 | T6 | 採用 | fix(link): raise Child preflight output cap and name the limit (#8380) |
| `8cf05824d` | 2026-11-09 | 71 檔 +628/-775 | T1 | 適配 | chore: remove retired release branch references (#8381) |
| `74fb6f0b4` | 2026-11-09 | 1 檔 +53/-25 | T10 | 採用 | test(gui): restore Overview account-label test globals exactly (#8375) |
| `295159fb5` | 2026-11-09 | 14 檔 +3413/-84 | T10 | 採用 | perf(usage): index filtered ledger queries and resume append ingestion (#8391) |
| `c813ecc5c` | 2026-11-09 | 27 檔 +116/-20 | T10 | 採用 | fix(gui): explain a refused Remember instead of reporting the admin token unverifiable (#8374) |
| `a72c52220` | 2026-11-09 | 14 檔 +424/-7 | T7 | 採用 | fix(codex): retry a read-only Windows catalog replacement (#8382) |
| `534adadae` | 2026-11-09 | 1 檔 +5/-2 | T2 | 採用 | test(responses): skip sockets when checking assertion persistence (#8400) |
| `e5a22fe2f` | 2026-11-08 | 3 檔 +27/-4 | T7 | 採用 | fix(cli): report an unavailable provider preset as a usage error (#8310) |
| `83c9c3e6c` | 2026-11-09 | 173 檔 +11681/-246 | T5 | 不適用（已撤回） | feat(link): sync route intent and materialize clients per device (#8274) (#8276) |
| `6ce65a5a4` | 2026-11-09 | 4 檔 +75/-10 | T5 | 不適用（已撤回） | fix(quota): read Kimi Coding Plan usage from the regional kimi.ai origin (#8399) |
| `57cb4bb35` | 2026-11-09 | 8 檔 +134/-8 | T5 | 不適用（已撤回） | fix(codex): probe the app-bundled CLI when no Codex CLI resolves (#8395) |
| `4995e7c42` | 2026-11-09 | 9 檔 +9/-8 | T5 | 不適用（已撤回） | docs: scope the Remember proxy refusal to standalone dashboards and list its code (#8394) |
| `b684b46aa` | 2026-11-09 | 21 檔 +516/-8 | T5 | 不適用（已撤回） | feat(anthropic): add opt-in thinking display policy (#8392) |
| `d5034499e` | 2026-11-09 | 8 檔 +133/-10 | T5 | 不適用（已撤回） | fix(link): show the Child's own reason when ocx link add fails (#8390) |
| `1176557e3` | 2026-11-09 | 3 檔 +85/-9 | T5 | 不適用（已撤回） | fix(copilot): keep Auto negotiation off real DNS in tests and survive a mid-negotiation account switch (#8389) |
| `ff2f5dee4` | 2026-11-09 | 53 檔 +386/-89 | T5 | 不適用（已撤回） | fix(update): keep bun's postinstall enabled on npm 11 and diagnose a skipped one (#8387) |
| `62bba4843` | 2026-11-09 | 25 檔 +632/-68 | T5 | 不適用（已撤回） | fix(gui): recover Aside overwrite previews instead of failing silently (#8384) |
| `0a1d59e5f` | 2026-11-09 | 2 檔 +20/-9 | T5 | 不適用（已撤回） | fix(integrations): leave an uninstalled owned client alone on implicit refresh (#8353) |
| `d38d2e316` | 2026-11-09 | 4 檔 +178/-0 | T5 | 不適用（已撤回） | docs(providers): add custom gateway verification guide (#8350) |
| `9fb295bfd` | 2026-11-09 | 3 檔 +116/-31 | T5 | 不適用（已撤回） | fix(codex): reclaim stale shim restore lock with several dead owners (#8349) |
| `9aeffab72` | 2026-11-09 | 6 檔 +185/-23 | T5 | 不適用（已撤回） | fix(relay): report an untyped SSE error envelope as response.failed (#8299) |
| `e76511d66` | 2026-11-09 | 4 檔 +104/-6 | T5 | 不適用（已撤回） | fix(google): clear replayed thought signatures on a real HTTP 400 (#8054) (#8150) |
| `0c3fd3fbb` | 2026-11-08 | 5 檔 +372/-7 | T7 | 採用 | Fix startup recovery on specific bind addresses (#8046) |
| `9633acde4` | 2026-11-09 | 1 檔 +231/-2 | T8 | 採用 | Add Claude CLI schema output fixtures (#8078) |
| `0fac612a9` | 2026-11-09 | 305 檔 +525/-14254 | T5 | 採用（撤回） | Revert 14 PRs admin-merged on CI alone without required review (#8402) |
| `b263b0866` | 2026-11-09 | 4 檔 +75/-10 | T5 | 採用 | fix(quota): read Kimi Coding Plan usage from the regional kimi.ai origin (#8399) (#8403) |
| `f40c97b10` | 2026-11-09 | 8 檔 +134/-8 | T5 | 採用 | fix(codex): probe the app-bundled CLI when no Codex CLI resolves (#8395) (#8404) |
| `9573456d5` | 2026-11-09 | 9 檔 +9/-8 | T5 | 採用 | docs: scope the Remember proxy refusal to standalone dashboards and list its code (#8394) (#8405) |
| `fa4341a57` | 2026-11-09 | 21 檔 +516/-8 | T5 | 採用 | feat(anthropic): add opt-in thinking display policy (#8392) (#8406) |
| `364e8a9ad` | 2026-11-09 | 8 檔 +133/-10 | T5 | 採用 | fix(link): show the Child's own reason when ocx link add fails (#8390) (#8407) |
| `01e94ff65` | 2026-11-09 | 3 檔 +85/-9 | T5 | 採用 | fix(copilot): keep Auto negotiation off real DNS in tests and survive a mid-negotiation account switch (#8389) (#8408) |
| `9129c0e23` | 2026-11-09 | 53 檔 +386/-89 | T5 | 採用 | fix(update): keep bun's postinstall enabled on npm 11 and diagnose a skipped one (#8387) (#8409) |
| `8c812be7f` | 2026-11-09 | 25 檔 +632/-68 | T5 | 採用 | fix(gui): recover Aside overwrite previews instead of failing silently (#8384) (#8410) |
| `6dac51166` | 2026-11-09 | 2 檔 +20/-9 | T5 | 採用 | fix(integrations): leave an uninstalled owned client alone on implicit refresh (#8353) (#8411) |
| `d079eccaf` | 2026-11-09 | 4 檔 +178/-0 | T5 | 採用 | docs(providers): add custom gateway verification guide (#8350) (#8412) |
| `f3657d3f3` | 2026-11-09 | 3 檔 +116/-31 | T5 | 採用 | fix(codex): reclaim stale shim restore lock with several dead owners (#8349) (#8413) |
| `1d16d7932` | 2026-11-09 | 4 檔 +104/-6 | T5 | 採用 | fix(google): clear replayed thought signatures on a real HTTP 400 (#8054) (#8150) (#8414) |
| `b33fab71c` | 2026-11-09 | 11 檔 +1224/-74 | T10 | 採用 | feat(usage): extend opt-in cache continuation diagnostics (#7479) |
| `e6df67e41` | 2026-11-09 | 21 檔 +214/-18 | T9 | 採用 | feat(providers): add cheapaimodel API-key preset (#7899) |
| `be5c40eef` | 2026-11-09 | 4 檔 +70/-7 | T9 | 採用 | fix(t3code): declare model efforts and tint the provider badge (#8085) |
| `97d26c75e` | 2026-11-09 | 7 檔 +116/-6 | T9 | 採用 | fix(exports): honor native OpenAI display name overrides (#8234) |
| `f2f3c6a81` | 2026-11-09 | 9 檔 +249/-15 | T9 | 採用 | fix(dictation): extend streaming protocol support and allow ten-minute recordings (#8232) |
| `0428e0d34` | 2026-11-09 | 4 檔 +55/-5 | T9 | 採用 | fix(responses): keep OpenGateway lifecycle output_text from reading as an empty completion (#8376) |
| `80d79b51a` | 2026-11-09 | 6 檔 +593/-26 | T7 | 採用 | fix(oauth): stop killing blocked Claude Keychain reads (#8327) |
| `ee3626986` | 2026-11-09 | 9 檔 +114/-3 | T9 | 採用 | Fix encrypted orphan reasoning replay for opted-in Ark Kimi endpoints (#8097) |
| `fb814f90a` | 2026-11-09 | 4 檔 +9/-2 | T5 | 採用 | docs: follow-ups to the re-landed Remember, custom gateway and owned-refresh changes (#8418) |
| `15f39a303` | 2026-11-09 | 6 檔 +91/-15 | T5 | 採用 | fix(codex): borrow the app-bundled catalog only when no Codex CLI resolved (#8419) |
| `036d0b201` | 2026-11-09 | 9 檔 +120/-5 | T9 | 採用 | fix: preserve Chat tool defaults on OpenAI Responses routes (#8144) |
| `d97bfe45f` | 2026-11-09 | 4 檔 +49/-4 | T8 | 採用 | fix(claude): keep a Claude Code session's cache key and pooled account across turns (#8371) |
| `f1a132eec` | 2026-11-09 | 4 檔 +257/-5 | T7 | 採用 | fix(service): wait out a manual launchd bootout before reporting failure (#8385) |
| `2bf8ec6c1` | 2026-11-09 | 18 檔 +550/-38 | T9 | 採用 | fix(providers): classify Meta's Muse Code refusal as a plan restriction (#8396) |
| `c0fedf266` | 2026-11-09 | 63 檔 +5397/-38 | T3 | 適配（D1） | feat(telemetry): default-on anonymous telemetry core with a human-only consent boundary (#8300) |
| `25a1bfc69` | 2026-11-09 | 3 檔 +135/-21 | T7 | 適配 | fix(config): wait for complete owner metadata during first registration (#8270) |
| `9e863b181` | 2026-11-09 | 26 檔 +1386/-35 | T3 | 適配（D1） | feat(desktop): Windows installer page to disclose telemetry and opt out at install time (#8348) |
| `6ea0e35ba` | 2026-11-09 | 16 檔 +1962/-10 | T3 | 適配（D1） | feat(gui): telemetry consent popup on first run and after updates, with an Advanced toggle (#8303) |
| `ad5110c69` | 2026-11-09 | 8 檔 +32/-25 | T8 | 採用 | docs(claude-code): note that the per-turn tk token is dropped from session identity (#8421) |
| `2817da817` | 2026-11-09 | 17 檔 +3773/-15 | T3 | 適配（D1） | feat(telemetry-collector): Cloudflare Worker + D1 collector and public stats API (#8304) |
| `5511f62a6` | 2026-11-09 | 33 檔 +812/-74 | T3 | 適配（D1） | docs(telemetry): telemetry and privacy guide plus configuration reference (#8305) |
| `289727dda` | 2026-11-09 | 17 檔 +6304/-17 | T3 | 適配（D1） | feat(docs-site): public usage dashboard at opencodex.me/dashboard (#8308) |
| `f0f34d09a` | 2026-11-09 | 6 檔 +177/-11 | T6 | 採用 | fix(link): run the install serving the Child before Desktop or PATH copies (#8424) |
| `8d290153e` | 2026-11-09 | 78 檔 +5695/-27 | T3 | 適配（D1） | feat(telemetry): opt-in public profile and personal usage rank (#8393) |
| `c81be32a7` | 2026-11-09 | 33 檔 +309/-38 | T9 | 採用 | feat(combo): add jevEffortMode to keep JEV from re-tiering a cache-sensitive target (#8041) |
| `3580fc9d6` | 2026-11-09 | 16 檔 +651/-13 | T9 | 採用 | fix(responses): preserve Codex client metadata on routed requests (#8193) |
| `50961560c` | 2026-11-09 | 1 檔 +33/-5 | T2 | 採用 | test(usage): state the filter index availability contract Windows can reach (#8440) |
| `a1d7d05ea` | 2026-11-09 | 1 檔 +10/-3 | T1 | 適配 | test(release): run the attach step from a script file so Windows keeps its backslashes (#8437) |
| `2f40e96aa` | 2026-11-09 | 6 檔 +68/-6 | T4 | 採用 | test(update): review the signed-update verification modules in the update lint (#8445) |
| `79ba4f29f` | 2026-11-09 | 3 檔 +103/-18 | T10 | 採用 | fix(usage): wait for a concurrently created filter index instead of calling it foreign (#8439) |
| `1e8e7e7e9` | 2026-11-09 | 1 檔 +28/-23 | T2 | 採用 | test(clients): give each Desktop lifecycle case the budget its child process already has (#8441) |
| `4a22eda84` | 2026-11-09 | 17 檔 +2764/-191 | T11 | 採用 | docs(site): redesign landing, navigation, and theme (#8005) |
| `33726958e` | 2026-11-09 | 98 檔 +7944/-731 | T10 | 採用 | fix(gui): preserve provider drafts and bind saves to their dashboard target (#8438) |
| `a1441404b` | 2026-11-10 | 3 檔 +145/-4 | T10 | 採用 | fix(usage): keep the filter index's WAL sidecars so filtered queries stop churning the config directory (#8442) |
| `e963af305` | 2026-11-10 | 1 檔 +20/-6 | T2 | 採用 | test(usage): name the input that moved when the warm aggregate rebuilds (#8459) |
| `4b38e9a07` | 2026-11-10 | 4 檔 +66/-32 | T2 | 採用 | test(rust): derive toolchain homes from the rustup proxy and report them on failure (#8458) |
| `3842ebcc5` | 2026-11-10 | 2 檔 +2939/-2782 | T2 | 適配 | ci: refresh the Windows shard durations from batch 42694893702 (#8463) |
| `8cab7040a` | 2026-11-10 | 1 檔 +32/-2 | T2 | 採用 | test(usage): read the warm base after the stage's work and name a Windows ChangeTime move (#8462) |
| `5cb7d6591` | 2026-11-10 | 2 檔 +3031/-2934 | T2 | 採用 | ci: refresh the shared shard durations from Ubuntu and macOS logs (#8465) |
| `0d691be83` | 2026-11-10 | 19 檔 +645/-38 | T8 | 採用 | feat(anthropic): add Claude Fable 5.2 pricing, fast mode and provider rows (#8466) |
| `7877b6417` | 2026-11-10 | 2 檔 +6/-1 | T1 | 適配 | fix(release): publish the verified npm tarball as a local path (#8467) |
| `05cb4d576` | 2026-11-10 | 3 檔 +114/-6 | T1 | 適配 | fix(release): start the 2.100.0 changelog at the reviewed legacy baseline (#8468) |
| `1bea09454` | 2026-11-10 | 9 檔 +201/-12 | T8 | 採用 | fix(anthropic): rank Fable accounts by its share of the weekly limit (#8469) |
| `b534ca133` | 2026-11-10 | 5 檔 +65/-6 | T3 | 適配（D1） | feat(gui): show a spinner while telemetry consent and profile actions wait (#8471) |
| `550d0d669` | 2026-11-10 | 9 檔 +137/-6 | T9 | 採用 | fix(responses): reject malformed retained compact input before routing (#8433) |
| `05d517e96` | 2026-11-10 | 3 檔 +15/-2 | T3 | 適配（D1） | fix(telemetry-collector): attach telemetry.opencodex.me as a Custom Domain (#8472) |
| `bab23a90f` | 2026-11-10 | 5 檔 +118/-4 | T9 | 採用 | fix(sidecars): preserve identities across partial snapshots (#8401) |
| `809033329` | 2026-11-10 | 11 檔 +148/-17 | T9 | 採用 | fix(mistral): bound image pruning memory and normalize malformed references (#8434) |
| `7e2641c25` | 2026-11-10 | 2 檔 +20/-1 | T9 | 採用 | fix(kiro): list Identity Center profiles without an oversized page (carry of #8084) (#8473) |
| `8c28f5f2b` | 2026-11-10 | 2 檔 +101/-3 | T7 | 適配 | fix(config): revalidate ownership before honoring a spent publication wait (#8422) |
| `5f8a1938d` | 2026-11-10 | 8 檔 +197/-12 | T9 | 採用 | fix(venice): upscale inline images below the 64px minimum edge (#8083) |
| `00c02163e` | 2026-11-10 | 4 檔 +74/-6 | T8 | 採用 | fix(anthropic): present Claude Code 2.1.321 so Fable 5.2 is accepted (#8474) |
| `da76b2733` | 2026-11-10 | 12 檔 +204/-14 | T7 | 採用 | fix(integrations): seed Command Code's auth store so the desktop app can open (#8340) |
| `9e88602b0` | 2026-11-10 | 59 檔 +1632/-113 | T9 | 採用 | feat(providers): complete manual pause and resume for API key pools (#7636) |
| `fdcf20b74` | 2026-11-10 | 5 檔 +142/-42 | T6 | 採用 | fix(link): keep the census reader quiet and bound to the first record (#8431) |
| `3c497c63a` | 2026-11-10 | 8 檔 +374/-13 | T8 | 採用 | fix(quota): expire a carried weekly reading once its window is over (#8185) |
| `101aee79e` | 2026-11-10 | 4 檔 +65/-10 | T1 | 適配 | fix(release): wait for npm to serve a new version before verifying it (#8477) |
| `758d81bbd` | 2026-11-10 | 14 檔 +503/-26 | T10 | 採用 | fix(gui): match the Getting started startup step to OpenCodex Desktop (#8476) |
| `d8084c5a6` | 2026-11-10 | 17 檔 +1496/-55 | T9 | 採用 | fix(combo): fail over zero-output max_output_tokens terminal (#8222) |
| `e9fdc0043` | 2026-11-11 | 16 檔 +485/-21 | T9 | 採用 | feat(messaging): add bounded waits for stored Codex replies (#8090) |
| `97bfb91af` | 2026-11-11 | 31 檔 +1305/-66 | T9 | 採用 | Show Mistral API and Vibe budget usage (#8295) |
| `a5d088f1b` | 2026-11-11 | 4 檔 +31/-3 | T8 | 採用 | docs: clarify Claude OAuth client version errors (#8482) |
| `bf7cd1864` | 2026-11-11 | 11 檔 +395/-17 | T9 | 採用 | feat(combos): persist target cooldowns across restarts (#8117) |
| `937c8192f` | 2026-11-11 | 31 檔 +567/-77 | T8 | 採用 | fix(anthropic): show inactive model-scoped quota rows without routing on them (#8186) |
| `5f2fe0bae` | 2026-11-11 | 10 檔 +269/-10 | T8 | 採用 | fix(quota): pool-wide capacity estimate for the Anthropic account pool card (#8137) |
| `00680193c` | 2026-11-11 | 13 檔 +177/-128 | T7 | 採用 | fix(integrations): leave Command Code credentials to the client (#8481) |
| `df0e6ccc4` | 2026-11-10 | 10 檔 +714/-18 | T9 | 採用 | fix(combo): recognize generic context-window overflow wording (#8130) |
| `b967316b2` | 2026-11-11 | 3 檔 +4/-7 | T2 | 適配 | fix(ci): bring layout.json and the Anthropic pool doc back under their caps (#8485) |
| `31665f9d9` | 2026-11-11 | 7 檔 +139/-11 | T9 | 採用 | fix(combo): preserve compatible native Messages requests (#8488) |
| `61151e345` | 2026-11-11 | 15 檔 +336/-23 | T9 | 採用 | fix(logs): keep the provider's closed error class and finishReason on failure rows (#8489) |
| `c2258732e` | 2026-11-11 | 14 檔 +177/-19 | T9 | 採用 | fix(responses): let retryOnReset replace chained native turns (#8486) |
| `dd9764d46` | 2026-11-11 | 2 檔 +16/-0 | T8 | 採用 | docs(claude): explain rate limits on caller-owned native passthrough (#8494) |
| `6364d9898` | 2026-11-11 | 10 檔 +47/-33 | T8 | 採用 | docs(claude): describe tool search behind a gateway for current Claude Code (#8493) |
| `e95669090` | 2026-11-11 | 9 檔 +46/-14 | T9 | 採用 | fix(cursor): name the CallDynamicTool path for deferred client tools (#8492) |
| `3dcdc49a5` | 2026-11-11 | 5 檔 +39/-12 | T9 | 採用 | fix(quota): keep the Mistral budget helper off the core load path (#8498) |
| `6083e2287` | 2026-11-11 | 5 檔 +54/-5 | T9 | 採用 | fix(sidecars): let a later final citation fill a missing title (#8491) |
| `851b1ec16` | 2026-11-11 | 20 檔 +4577/-110 | T9 | 採用 | fix(combo): continue reasoning effort fallback (#8173) |
| `29dc0893f` | 2026-11-11 | 25 檔 +544/-111 | T9 | 採用 | feat(providers): strip named hosted tools only beside client tools (#8499) |
| `4bf2ec8de` | 2026-11-11 | 22 檔 +1104/-74 | T8 | 採用 | feat(claude): keep the Chat tool catalog stable across ToolSearch loads (opt-in dispatcher) (#8502) |
| `4e83a8e36` | 2026-11-11 | 27 檔 +711/-30 | T9 | 採用 | feat(providers): opt-in skip of invalid model discovery rows (#8503) |
| `42e3e040d` | 2026-11-11 | 4 檔 +72/-3 | T9 | 採用 | fix(devin): flatten root tool-schema compositions for Claude uids (#8490) |
| `dfc54804e` | 2026-11-11 | 23 檔 +1293/-54 | T9 | 採用 | fix(combo): hop on opaque upstream 400 errors (#8162) |
| `ddee2c200` | 2026-11-11 | 15 檔 +7298/-0 | T6 | 採用 | docs(devlog): roadmap for Home-orchestrated Child updates and operations (#8500) |
| `41536f6da` | 2026-11-11 | 8 檔 +165/-6 | T6 | 採用 | fix(cli): explain a rejected hub invite and startup-only config keys (#8495) |
| `29a5278c1` | 2026-11-11 | 17 檔 +1467/-99 | T6 | 採用 | feat(link): gated remote ocx, Child update contract and observation cache (#8505) |
| `15cf4c901` | 2026-11-11 | 9 檔 +278/-11 | T6 | 採用 | fix(link): show a Child's tunnel state in ocx connect status (#8496) |
| `bceee7fe7` | 2026-11-11 | 16 檔 +270/-17 | T10 | 採用 | fix(gui): remove unavailable Claude Desktop assignments from the dashboard (#8497) |
| `e10c9ba6a` | 2026-11-11 | 6 檔 +52/-25 | T6 | 採用 | fix(link): retry a timed-out or refused-forward Child every minute from the Home (#8509) |
| `87e005f93` | 2026-11-11 | 60 檔 +2708/-113 | T6 | 採用 | feat(link): show Child version, install kind and catalog freshness; ocx link check (#8508) |
| `10bf0d289` | 2026-11-11 | 24 檔 +787/-18 | T8 | 採用 | feat(accounts): explicit health-gated resume, and login that clears an automatic pause (#8515) |
| `5197322e2` | 2026-11-11 | 4 檔 +41/-14 | T9 | 採用 | fix(antigravity): send Gemini 4 Carbon requests with the CLI User-Agent (#8483) |
| `61147ec68` | 2026-11-11 | 1 檔 +25/-4 | T2 | 採用 | test(link): keep the constrained-mode prefix out of the cmd.exe budget (#8517) |

## 2026-11-14（續）：`v2.99.0..v2.100.2` 整合前的上游 PR／issue 軸分類（3 筆 PR、1 筆 platform issue；複查 #7771、#7808、#7810、#8246、#8317、#8318）

輸入是 `bun tools/check-upstream-updates.ts --strict` 在 2026-11-14 的輸出（exit 1）。三點先讀：

- **報告的 commit 軸是 333 筆，不是 163 筆。** 工具追蹤「`integrated_tag` 之上最新的 stable tag」，而上游在同日（2026-11-14）又發了 `v2.100.3`（`873ec9b3b`，`refs/upstream-check/tags/v2.100.3`，與 `v2.100.2` 相差 170 筆）。本次整合的目標仍是 `v2.100.2`（163 筆，`refs/upstream-tags/v2.100.2` 實算 `git rev-list --count v2.99.0..v2.100.2` = 163）。**含意：步驟 6 推進水位到 `v2.100.2` 之後，`--strict` 仍會因 `v2.100.3` 的 170 筆而 exit 1**，要等下一輪整合 `v2.100.3`；步驟 6 的「`--strict` exit 0」驗收在 `v2.100.2` 水位上不可能成立，不是回歸。
- 這份報告的 PR 軸與 issue 軸沒有出現「未檢查」，兩節都有實查結果。
- 以下四個 PR／issue 編號的判定在本輪寫下，`tools/upstream_baseline.json` 的 `reviewed_pr_numbers`／`reviewed_issue_through` 依計畫留到步驟 6 一起寫（本節不動水位檔）。

### 上游未合併關閉的 PR（3 筆，fork 全部不採用）

| PR | 標題 | 上游狀態與事實 | 判定與理由 |
| --- | --- | --- | --- |
| #7941 | refactor(codex): write the native-main auth.json through one module (#7345 part 1b) | 關閉未合併（2026-11-09 21:17Z，標籤 `chore`、`intake: hygiene-blocked`）。作者把它併入 #7918（1a），hygiene 因 `src/codex/auth-collision.ts` 報 `unsponsored_surface`；維護者 `lidge-jun` 回覆要合成單一 reader／writer PR 並先回答 #7345 的 retention 問題。#7918 已合入 dev（`a80a329e1`），在 `v2.100.3` 之後的範圍，**不在 `v2.100.2` 內**。 | **不另採**。無行為變更的 auth.json 寫入重構，已由 #7918 合併取代；fork 隨 `v2.100.3` 整合時取得。不重疊採用已關閉分支。 |
| #8504 | fix(anthropic-pool): lift 429 quota cooldowns from a background usage read | 關閉未合併（2026-11-11 09:36Z，標籤 `bug`）。維護者把它 carry 成 #8531（merge `34a872c3b`，作者保留 Co-authored-by），修掉 CodeRabbit 的五個問題。#8531 在 `v2.100.2..v2.100.3` 之間，**不在 `v2.100.2` 內**。 | **不另採（已由 #8531 取代）**。功能（Anthropic 429 冷卻由背景用量讀取解除）隨 `v2.100.3` 整合進來；採用的會是 carry 後的版本。 |
| #8650 | docs(es): mirror the pnpm global-store update step into the Spanish update-failed page | 關閉未合併（2026-11-13，標籤 `documentation`）。維護者自己關閉：#8648（`741d4d4c3`）已把同一段鏡像到西班牙文頁，此分支已無內容。 | **不採用**。只改 `docs-site/.../es/` 頁；fork 的 docs-site 只保留 en／zh-tw，西班牙文頁不在 fork 內（且上游自己判定是重複）。 |

### 上游 platform issue（1 筆：#8545）

| Issue | 上游事實 | fork 證據與判定 |
| --- | --- | --- |
| [#8545](https://github.com/lidge-jun/opencodex/issues/8545) Restart and disconnect for a client runtime whose owner cannot be proven (legacy bare-flag service children and companion proxies) | open（`enhancement`、`platform`、`service`）。是 #8529（`de0914a1a`，Home 透過 SSH 讓桌面 app 或服務管理員擁有的 Child 離開／重新連線）review 後留下的設計題：只帶 bare `OCX_SERVICE=1` 的舊服務子行程與 `ocx claude`／`codex`／`opencode` 的 detached proxy 無法判斷 owner。留言附帶 Windows 情境（以父行程命令列推斷 Task Scheduler wrapper／WinSW host）。尚無實作。 | **相關但延後**。#8529 在 `v2.100.3` 範圍、不在 `v2.100.2`；fork 的 Windows wrapper 設的 marker 與 #8529 引入的辨識方式要等該版整合時再對照。目前沒有程式碼可採，也沒有需要 fork 自己處理的 Windows 回歸，所以只記錄、不新增 ROADMAP 列；`v2.100.3` 整合時重查 `ocx disconnect`／`restart` 對 fork wrapper 子行程的分類。`reviewed_issue_through` 預定由 8336 推進到 8545。 |

### 複查既有追蹤項（`gh` 實查；`--strict` 清單外）

| 項目 | 現況（2026-11-14） | 對 fork 的結論 |
| --- | --- | --- |
| #7771（Windows desktop 在 Task Scheduler 服務擁有 npm runtime 時卡在 `taking-over`） | 上游仍 open。#8487（`ff9f9463e`，2026-11-11）已讓 Windows x64 在行程內讀 process command line（`NtQueryInformationProcess`），處理 `process-unverifiable` 部分；Option B（保證等到 port 釋放的 Windows stop）只有設計（#8546，`7796c67f6`），尚未實作。兩者都在 `v2.100.3` 範圍，**不在 `v2.100.2`**。 | 維持持續觀察；本機沒有該排程服務、不重現。 |
| #7808、#7810 | 先前已記為上游修復關閉並已含於 fork，狀態未變。 | 無動作。 |
| #8246（MSI 升級後舊 runtime 繼續服務） | 上游仍 open，`v2.100.2` 內無對應修正（`git log` 沒有以它為主題的 commit）。 | `ROADMAP.md` 中期列保留，行號與證據在步驟 6 一併重查。 |
| #8317（shim restore 鎖有兩個已死 owner 永不回收） | 上游於 2026-11-09 關閉；修正是 #8349（`f3657d3f3`），**在 `v2.100.2` 內**。 | 觸發條件成立：隨本次重放帶入 `src/codex/shim-restore-lock.ts`；`ROADMAP.md` 該列於步驟 6 在跑過該列驗收測試後刪除。 |
| #8318（Windows 以本機 Tailscale IP 當 `hostname`，Desktop 不啟動 runtime） | 上游仍 open（`needs-info`）。`0c3fd3fbb`（特定 bind 位址的啟動復原）在 `v2.100.2` 內，但回報者在 2.99.0 上量到 `OCX_PROBE_TIMEOUT_MS` 調到 30000 也不影響耗時（探測預算不是主因），**不能認定 `0c3fd3fbb` 已修掉**。 | `ROADMAP.md` 該列保留，整合後照該列驗收方式判斷，不直接刪列。 |

## 2026-11-14（續二）：全版 tag diff 重放 `v2.99.0..v2.100.2`（`61147ec68`；分支 `ci/tagdiff-v2.100.2`，尚未推送、水位未動）

`git diff refs/upstream-tags/v2.99.0 refs/upstream-tags/v2.100.2` 共 1236 個檔案（370 新增、866 修改、0 刪除；+129468／-13987；`v2.100.2` = `61147ec681bc8374d350e0eae08b71c117c6df30`），以單一 parent、不 merge 上游的 tag-diff 法套到 `main`（fork 基準 `025dd546a`，2.99.2）。重放 commit 是 `133061f40`；逐檔清冊在 [`upstream-v2.99.0-v2.100.2-files.tsv`](upstream-v2.99.0-v2.100.2-files.tsv)（欄位同前三份，由 blob 雜湊比對機器產生；後續修正造成的判定變更才手改該列並在下方記錄；`/docs/` 在 `.gitignore`，要 `git add -f`）。方法、Windows-only 刪除清單、已刪語系與生成物規則同「2026-11-05：全版 tag diff 重放」節。上游在同日又發了 `v2.100.3`，本輪刻意不納入（見上一節）。

### 計數（1236 個上游變更檔）

| 判定 | 重放 commit `133061f40` | 目前（含本機驗證修正） | 說明 |
| --- | --- | --- | --- |
| 已等價 | 0 | 0 | — |
| 採用（與 `v2.100.2` blob 逐位元相同） | 948 | 947 | 乾淨採用 585（fork 與 `v2.99.0` 相同）＋新增檔 362；`scripts/lint-gui-if-changed.ts` 因本機驗證修正由採用改為適配 |
| 適配 | 144 | 145 | 三方合併無衝突 83＋備註寫「衝突手解」23＋其他 39（備註寫具體原因的衝突檔 21 與其他調整 5＝26、新增檔為 fork 閘門調整 7、採用後又改過 6）；逐檔原因在 TSV 備註欄，44 個衝突檔的取捨見下表 |
| 不適用 | 144 | 144 | 已刪語系 125（docs-site：ko 25、tr 22、zh-cn 21、fr／ja／ru 各 19）＋`gui/src/i18n` 九個非 en／zh-TW 語系檔 9＋`readme/` 譯本 7＋`scripts/install.sh`、`tests/ci-workflows/ci-scope-reduction.test.ts`、`tests/ci-workflows/linux-desktop-packaged-ci.test.ts` 各 1 |

生成物（`scripts/ci/test-durations.windows.tsv`、`scripts/ci/test-durations.tsv`、`scripts/test-layout/layout.json`、`layout-usage.json`、`tests/fixtures/test-layout-expected.json`、`structure/manifest.json`、`structure/INDEX.md`）依方法第 3 點處理。

### 44 個衝突檔的取捨

| 檔案 | 衝突 | 取捨 |
| --- | --- | --- |
| `.github/workflows/ci.yml` | 16 | 以 fork 版為底（`push main`／`preview`、夜間排程、12 片 Windows shard、`timeout-minutes: 30`）。只採 `run-name`、`windows-native-claim` lane（`if` 去掉 `refs/heads/dev` 條件、不帶 quarantine 環境變數）與 `changes`／`ci` 彙整的對應 guard。不採：拿掉 `push`／`schedule`、「Validate dispatch source」、`LIDGE_RUNNERS` 自架 runner、macOS／Linux job |
| `service-lifecycle.yml`、`catalog-async-contracts.yml` | 3／1 | 保留 fork 版；上游每個變更都是只准 `dev` 的觸發政策（`source_sha`、`validate-source`、evidence-policy checkout） |
| `.github/workflows/release.yml` | 1 | 取上游全部，把官方 repo guard 放回（`validate-dispatch` 與 `release-outcomes` 的 `if`） |
| `src/lab/artifacts/secure-fs.ts`、`fabric/scratch.ts`、`public/file-safety.ts`、`mutation-lock.ts`、`private-file.ts` | 8／9／7／5／2 | 整檔取上游（`fabc69ee1`：bigint identity 與 OS 鎖）；fork 的 `06aa61fb0` 做的是同一件事，語意等價時採上游設計 |
| `tests/codex-integration/main-quota-provenance.test.ts` | 3 | 取上游的 claim 診斷，僅保留 fork 經允許清單限制的 refusal／detail／reads 欄位，不輸出原始 stderr；沒有 quarantine 的 `skipIf`；新增 `tests/helpers/native-main-claim-diagnostics.ts` 時移除 `skipInvalidQuotaTag`（`hostedWindowsQuarantine` 的 opt-in，fork 不遮蔽紅燈） |
| `src/codex/catalog/provider-models.ts` | 1 | 兩邊都要：上游的 `skipInvalidRows` 警告併入，fork 的 host 精確比對與 log 欄位過濾保留，新警告裡的名稱也過 fork 的 scrub |
| `tests/clients/client-fingerprint.test.ts` | 1 | 保留 fork 的 Stainless OS／arch 測試，版本常數改成上游新值（SDK `0.128.0`、runtime `v26.12.1`） |
| `tests/ci-workflows/` 的 `ci-bun-install-frozen`、`ci-review-lanes`、`ci-scope-gaps`、`ci-structure-gate`、`ci-workflows`（4）、`install-scripts`、`release-desktop-scripts`、`release-outcome-report`、`release-version-line` | 各 1 | 斷言 `ci.yml` 形狀的保留 fork，斷言 `release.yml` 的取上游；`ci-bun-install-frozen` 的 Ubuntu job 清單是 fork 實有的 `test-changed`、`gates`；`ci-review-lanes` 加 `windows-native-claim` 彙整 guard 與診斷 checkout 計數；`install-scripts` 的 `install.sh` 案例維持刪除；`release-version-line` 取上游新寫法 |
| `scripts/ci/test-durations.windows.tsv` | 9 | 整份保留 fork 量測值，新增檔沒有列；CI 綠後用 job log 刷新 |
| `scripts/ci/test-durations.tsv`、`scripts/test-layout/layout.json`、`tests/fixtures/test-layout-expected.json` | 8／1／3 | 取上游，剔除 fork 沒有的測試，補回 fork 獨有條目；`tests/test-layout*.test.ts` 驗證 |
| `package.json` | 1 | 版號 `2.100.2`；保留 `assets/demo.gif` 與拿掉 `test:macos`；採上游 `native/ocx-child` 三列 `files` 與 `build:ocx-child`／`test:ocx-child`；依賴維持 fork 的版本 |
| `desktop/src-tauri/tauri.conf.json`、`Cargo.toml`、`Cargo.lock` | 1／1／1 | 版號 `2.100.2`（`bun scripts/release-version-sources.ts sync 2.100.2`，`check 2.100.2` exit 0；上游三個 tag 的版本來源都停在 2.100.0）；updater 設定不變；**不連結** wix fragment（D1） |
| `docs-site/package.json` | 1 | 保留 fork 的 `sharp ^0.35.5` 與 `rolldown 1.1.7` override，加上游兩個字型套件；`bun.lock` 用 `bun install --ignore-scripts` 重新產生（+6 行） |
| `docs-site/astro.config.mjs` | 1 | 取上游新增項，只加 zh-TW 標籤 |
| `gui/src/i18n/v2-pages/proxy-copy.ts`、`shell-v2-copy.ts` | 2／1 | 保留 fork 的兩欄表，上游新列縮成 en（第 0 欄）與 zh-TW（第 5 欄）後插入 |
| `README.md`、`readme/README.zh-TW.md` | 14／1 | `README.md` 不重放（fork 的繁中主文件）；`README.zh-TW.md` 保留 fork 版並補上游新段 |
| `docs-site/.../guides/remote-hub.md`、`structure/desktop-shell.md`、`structure/ops/docs-and-release.md` | 2／1／1 | 保留 fork 的刪減，取上游對保留段落的修改；`docs-and-release.md` 的 shard 片數維持 12 |
| `docs-site/.../zh-tw/` 的 `reference/configuration/providers.md`、`server.md`、`reference/cli/lifecycle.md`、`guides/combos.md`、`guides/remote-hub.md`、`contributing.md` | 2／1／1／1／1／2 | 以 fork 譯文為底照英文變更補譯；`zh-tw/contributing.md` 維持 fork 的 `main` 政策 |

### 其他適配

- **D1 遙測預設關閉**（決定寫在 `DECISIONS.md`，水位 commit 時補）：新增 `src/telemetry/fork-policy.ts` 的 `forkTelemetryBlocked()`（預設 `true`；只有 `NODE_ENV=test` 且 `OCX_FORK_TEST_TELEMETRY=1` 才放行，`tests/preload.ts` 設定）；`consent.ts` 的 `isTelemetryEnvOptOut()` 回 `OCX_TELEMETRY`，`sender.ts` 與 `profile/client.ts` 兩個出口各再擋一次（在 `fetch` 之前）；`tauri.conf.json` 不連結 wix fragment，`desktop-telemetry-installer.test.ts` 的「連結 fragment」案例改成斷言 fork 沒有連結；測試 `tests/usage/usage-telemetry-fork-policy.test.ts`（6 案）。`grep telemetry.opencodex.me src gui/src` 只出現在已擋的 `sender.ts`、`profile/client.ts` 與顯示用字串（`disclosure.ts`、`proxy-copy.ts`）。`FORK.md` 差異表與 `guides/telemetry.md`（en／zh-tw）已加說明。
- **語系**：`telemetry-profile-copy.ts` 的 11 欄表縮成 en／zh-TW；新增三頁 zh-tw（`dashboard.mdx`、`guides/custom-gateway.md`、`guides/telemetry.md`）與 claude-code、remote-link、messaging、providers-accounts、desktop-app、adapters、proxy-formats、contributing 的新段落；`docs-zh-tw-parity` 過。**殘留的英文對繁中文字落差**（段落數與程式碼區塊數相等，所以 parity 測試抓不到，下次動到這些頁時補）：`claude-code`（fable fast list、quota bar 說明、rate-limit passthrough、`prompt_cache_key`、remove-unavailable 段、ToolSearch 文字各一行）、`remote-link`（prerequisites、step 5、disconnect 幾行、`ocx connect status`）、`providers-accounts`（preset exit code 2 一句）、`desktop-app`（autostart checklist）、`proxy-formats`（session TTL、compact `ocx2` 400）、`combos`（zh-tw 整段缺「選用參數相容性」，重放前就缺）。
- **檔案行數上限**：`combo-management-api.test.ts` 的 import 區塊壓縮、英文 `providers.md` 四行手動換行併回，沒有改斷言與內容。
- **`tests/ci-workflows` 契約測試**依「改測試去符合 fork 的 workflow，不改 workflow 去符合上游測試」：`ci-concurrency-groups`（斷言 fork 的觸發集合，移除 dev 限制與 macOS job 案例）、`ci-privacy-gate`（保留 fork 的 push 路徑斷言）、`release-pipeline-contract`（service-lifecycle 觸發案例用 fork 形式）、`docs-link-targets`（README 與已刪語系檢查）。
- **官方 repo guard**：`release.yml` 以外的 workflow（`cleanup-*`、`enforce-*`、`pr-*`、`deploy-docs` 等）由 `tests/ci-workflows/fork-hygiene.test.ts` 驗證 guard 仍在。
- `native/ocx-child`、`services/telemetry-collector` 照上游採用；`fork-release-windows.yml` 與 `desktop/scripts/prepare-sidecar.ts` 沒有任何 `ocx-child` 參照，MSI 流程不需要新增步驟。

### CI 後續修正（分支 `ci/tagdiff-v2.100.2`）

「重放時修掉」列併入 `133061f40`；「本機驗證」列是之後各自獨立的 commit。遠端失敗的判定以 run `43582644150`（`ce988fe85`）的對應案例與子行程注入模式區分。

| 來源 | 失敗與原因 | 修正 |
| --- | --- | --- |
| 重放時修掉 | `ci-concurrency-groups`：上游測試斷言 `ci.yml` 只有 `pull_request`／`workflow_dispatch`、三個 workflow 都有只准 `dev` 的「Validate dispatch source」、`platform-macos` 存在，fork 的 `ci.yml` 都不是 | 測試改斷言 fork 的實際觸發（含 `push`、`schedule`），刪除 dev 限制與 macOS 案例（TSV 備註） |
| 重放時修掉 | `ci-bun-install-frozen`：Ubuntu job 清單與 `LIDGE_JOBS` 自架 runner 路由 | 改成 fork 實有的 job，不採 runner 路由 |
| 重放時修掉 | `release-pipeline-contract` 的 service-lifecycle 觸發案例斷言上游觸發政策 | 保留 fork 形式（`push main`／`preview`） |
| 重放時修掉 | `docs-link-targets`：README 與已刪語系的連結檢查指向 fork 沒有的檔案 | 檢查改成 fork 版，保留 CI push 路徑檢查 |
| 重放時修掉 | `file-size-ratchet`：`combo-management-api.test.ts` 與英文 `providers.md` 超過 2000 行門檻 | 壓縮 import 區塊、併回手動換行，不調門檻 |
| 重放時修掉 | Hangul hygiene：`telemetry-profile-copy.ts` 的 11 欄表含韓文 | 縮成 en／zh-TW 兩欄 |
| 重放時修掉 | `docs-zh-tw-parity`／連結：三個新英文頁沒有繁中對應頁，新段落數與程式碼區塊數不等 | 補譯三頁與各頁新段 |
| 本機驗證（`2e69d8d9e`） | zh-tw `custom-gateway.md`、`telemetry.md` 的頁內錨點用英文 slug，但繁中標題產生的 slug 是中文（`#靜態模型允許清單`、`#首次註冊時的模型選擇`、`#遙測telemetry`）；`cli-telemetry.test.ts` 的 D12 迴圈逐檔讀 `README.md` 與已刪的六個 `readme/` 譯本，fork 的 `README.md` 沒有遙測段 | 錨點改成實際 slug；D12 改成：`README.md` 不得含舊的「不傳送任何資訊」說法，`readme/README.zh-TW.md` 與 `code-signing.md` 必須含四個揭露字串（沒有放寬；前一位工人留下的未提交版本只驗 `code-signing.md`，強度較低，已補回） |
| 本機驗證（`2c6f0bcd7`） | `scripts/doctor-gui-if-changed.ts` 與 `lint-gui-if-changed.ts` 在沒有 `@{u}` 時的 fallback 範圍被上游從 `origin/main` 改成 `origin/dev`，fork 沒有 `dev`，結果是找不到範圍、掃描靜默略過 | 還原 `origin/main`／`main`（TSV 兩列改為適配）。`typecheck-gui-if-changed.ts` 與 `scripts/test.ts` 的 `dev` 參照是前幾輪就帶進來的，未動 |
| run `43582644150`，Windows 5/12 | `link-child-update-contract` 的 `update --plan --json parses and classifies as source-checkout`：整合適配遺漏。TSV 原為 adopt，測試與上游 tag 相同，但 CLI fixture 自訂 env 丟掉 preload 的 `NODE_ENV` 與 `OCX_FORK_TEST_REGISTRY_UPDATE`。fork 的 `runOrchestratedUpdate` 因而輸出 `reason: fork-self-update-disabled`，上游 `parseChildUpdatePlan` 的封閉原因集合不接受它 | 僅在該 fixture 的子行程傳入 `NODE_ENV=test` 與既有測試閘門，仍要求完整 plan 可解析並分類為 `source-checkout`；不改產品的自更新封鎖或 parser |
| run `43582644150`，Windows 12/12 | `verified replacement`：不是本輪新增的暫時性 ACL 失敗。正式案例在 10:05:43Z 通過；10:05:52Z 與 10:06:08Z 的同名失敗是外層診斷測試啟動的子測試。`OCX_TEST_CLAIM_REGRESSION=exit` 注入 open 錯誤（`EICACLS`、`/inheritance:r`、`child_result`、`timedOut:false`）；`timeout` 在 hardening 刻意停滯 | 維持真實 claim 的 fail-closed 行為與原有重審條件，不增加重試。`native-main-lock-file.ts` 與上游 tag 相同；`native-main-claim.ts` 僅保留 fork 的 `fileIdentityKey` identity 表示差異，沒有改 ACL 呼叫 |
| run `43582644150`，Windows 12/12 | `positive selection exit failure reports sanitized claim diagnostics`：整合回歸。TSV 原為 adapt，合併時保留 fork 原始 stderr 尾端，與上游只輸出允許清單診斷的契約衝突；刻意拋出的 `private-marker-child-stderr` 透過失敗物件外洩 | exit code 恢復上游的精確純量斷言，selection 失敗物件僅留已限制的 refusal／detail／reads；移除兩處原始 stderr，保留 `not.toContain("private-marker")` 斷言 |
| run `43582644150`，Windows 12/12 | `forced claim setup timeout reports the latest sanitized phase`：同一整合回歸。helper 刻意輸出敏感標記後停在 hardening；最新診斷正確是 `phase: hardening`，但 fork 的失敗物件又印出原始 stderr | 同上，僅輸出已清理診斷；保留最新 phase、私密路徑、token 與標記的全部斷言，維持原逾時 |

### 水位

**未推進**。`tools/upstream_baseline.json` 仍是 `integrated_tag = v2.99.0`；遠端 `Cross-platform CI` 全綠後才用獨立 commit 推進（計畫步驟 6）。
