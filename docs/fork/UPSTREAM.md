# 上游維護

## Remote

- Fork：`origin` → `https://github.com/SanHsien/opencodex.git`
- 原作者：`upstream` → `https://github.com/lidge-jun/opencodex.git`
- 追蹤分支：`main`（發版線）。上游另有 `dev`（PR 整合）與 `preview`（prerelease），需要時再 `git fetch upstream dev`。

## 檢查新提交

```powershell
git fetch upstream main
bun tools/check-upstream-updates.ts --strict
```

工具以 `tools/upstream_baseline.json` 的 `reviewed_through` 為起點，列出所有未審查提交。
有新提交或檢查失敗時，`--strict` 回傳非零；排程 workflow 也會因此明確失敗。

## 審查清冊

每次只做一次批次審查：

1. 讀 commit 主旨與變更檔案。
2. 判斷是否與 Windows gate、fork 文件、workflow guard 或測試衝突。
3. 可直接同步的提交用 merge；只需要部分修正時 cherry-pick 或最小重做。
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

目前水位見文末 **2026-08-27**（已審查到 `v2.34.0`、尚未合併）。操作仍是：

```powershell
git fetch upstream main
bun tools/check-upstream-updates.ts --strict
```

報告會同時列出「未審 commit」與「水位之後的新 `platform` issue」。處理完後同時推進
`reviewed_through` 與 `reviewed_issue_through`，並把判斷寫進本檔。
下次把上游帶進來時，照 2026-08-27 節在 `v2.34.0` 上重放 overlay，不要 merge。

## 2026-08-23：重評「隨 release 進來」這個結論，並引用一支 dev 上的 Windows 修正

前一輪對 43 個 open PR 的結論是「base 都在 `dev`，合併後會隨 release 進 `main`，本 fork 的取用點
是 release commit」。**那個結論漏掉一個量測**：`git rev-list --left-right --count
upstream/main...upstream/dev` 回報 **25 / 58**——`dev` 已經領先 `main` 58 個 commit，而且兩線
已經分岔。「隨 release 進來」在時間上不是「很快」，可能是好幾週。

所以判準要修正為：**`dev` 上有沒有本 fork 現在就會痛的修正**。有就引用，沒有才等 release。

### 已引用：`a3bbcdb0` — Windows 桌面 app 的 model picker 重啟

- 這正是本檔上一節登記為「等上游修好隨 release 進來」的 issue
  [#2292](https://github.com/lidge-jun/opencodex/issues/2292)。修正已經在 `dev`，還沒進 `main`。
- **為什麼本 fork 現在就痛**：`ocx sync --restart-codex` 只送訊號給 codex app-server 與
  code-mode-host；擁有 model picker 的 Electron 外殼不在比對範圍。macOS 上重生的 app-server 會
  重發 `codex-app-server-initialized`，renderer 因此丟掉快取；**Windows MSIX 不會**，picker 會一直
  顯示舊目錄，直到整個 app 重開。本 fork 是 Windows 線。
- 上游把它做成獨立的 `--restart-desktop-app` 旗標而不是擴大 `--restart-codex`——關掉桌面 app 會
  結束進行中的對話，那是與「重啟背景 helper」不同的同意層級。這個設計判斷本 fork 認同，原樣採用。
- **驗證**：cherry-pick 乾淨套用（7 檔、+699/−7，其中兩支是新檔）；`bun run typecheck` 乾淨；
  `bun test tests/desktop-app-restart.test.ts` 全過；`fork-hygiene` 18 pass；`privacy:scan` 通過；
  `tools/dev_check.ps1` 全綠。`tests/codex-app-server-processes.test.ts` 有一個
  memoization 測試在本機失敗，但**在引用前的 `HEAD~1` 用同一個 worktree 跑也一樣失敗**（本機時序
  敏感），與本次引用無關。
- **已知代價**：cherry-pick 產生的 SHA 與上游未來釋出的不同，等它進 `main` 再同步時，這 7 個檔案
  會衝突。這是有意識的取捨——Windows 使用者現在就會遇到 picker 不更新，而衝突是可解的一次性成本。

### `dev` 上其餘掃過但不引用的（本輪逐條看過主旨與檔案）

| commit | 內容 | 結論 |
| --- | --- | --- |
| `9551bbd4a` | `fix(codex): avoid TOML marker regex backtracking` | 值得，但它改的是 `dev` 上重寫過的 TOML marker 路徑；本 fork 的 `main` 版該函式結構不同，硬移植等於自行改寫。**觸發條件**：本線出現 TOML 解析卡住的實例，或該修正隨 release 進 `main`。 |
| `a9cb7661b` | `fix(tools): repair integral floats in native u64 tool fields` | 同上：依賴 `dev` 的 native tool 欄位重構。 |
| `e2424f33c` | catalog 排除不可呼叫的 opencode 模型 | 產品目錄策略，與本 fork 的 provider 設定無關。 |
| 其餘 ~50 筆 | 幾乎都是 `devlog:` 工作紀錄與 WP 系列的流程檔 | 上游自己的專案管理紀錄，沒有可套用的程式改動。 |

### 判準（下次照這個做，不要再用「隨 release 進來」打發）

1. 先量 `main` 與 `dev` 的距離。差距大就不能假設「很快會進來」。
2. 掃 `dev` 上的 **fix(** 與 **feat(** commit，只挑：Windows／路徑／編碼、fail-closed 行為、
   安全性，以及本檔 issue 表裡已登記為「等上游修」的項目。
3. 挑中的先確認它只依賴 `main` 已有的檔案（`git cat-file -e upstream/main:<file>`），
   再 cherry-pick，並記下未來同步時會衝突的檔案。

## 2026-08-23（第二輪）：`--state all` 補查，並引用兩支「無上限讀取」修正

### 先修一個查法上的缺口

上一輪查 PR／issue 用的是 `--state open`。那看不到**未合併就關閉**的項目，而那正是「上游拒收、
但可能對本 fork 有價值」的一類——已合併的項目遲早會經由 commit 路徑抵達，被關掉的永遠不會。
本輪起一律 `--state all`。

用 `--state all` 重查水位（PR `#2383`／issue `#2379`）之後的增量：**33 個 PR、55 個 issue**。
其中 12 個 PR 已合併，但**合併進的是 `dev` 不是 `main`**（實測：`#2398` 的 merge commit
`383279cd2` 在 `upstream/dev`、不在 `upstream/main`；`dev` 目前領先 `main` 69 個 commit）。
本 fork 的取用點是 `main`，所以這 12 筆**還沒**被 commit 水位涵蓋——判準仍是上一節那條：
**`dev` 上有沒有本 fork 現在就會痛的修正**。

### 已引用（兩支，都是「讀取沒有上限」）

| 來源 | 本 fork 的實查證據 | 移植內容 |
| --- | --- | --- |
| [PR #2395](https://github.com/lidge-jun/opencodex/pull/2395) `fix(usage): bound incremental append reads`（`3611850c5`） | `src/usage/log.ts` 的 `readUsageEntriesIncrementally()` 只擋「檔案縮小」，沒有擋「一次 append 太多」。兩次輪詢之間灌進來的位元組不論多大，都會走增量路徑整批讀進來並逐行解析——**繞過 `maxReadBytes` 這個唯一的記憶體上限，而且是在帳本長最快的時候繞過**。 | 4 行守衛：`size - retained.coveredThroughBytes > maxReadBytes` 時回 `null`，交還給有上限的 full-tail reader。 |
| [PR #2398](https://github.com/lidge-jun/opencodex/pull/2398) `fix(responses): bound upstream error body reads`（`383279cd2`）的**前半** | `src/lib/bounded-body.ts` 的兩個進入點（`readBoundedResponseBytes:118`、`readBoundedResponseBody:211`）在 signal 已經 aborted 時**先 throw 再說**，此時還沒有 reader 掛上去，原始 body 因此沒有被結束——fetch 背後的 stream 會把一個被拒絕的 read 留著。 | 新增 `cancelBodyWithoutWaiting()`，兩個進入點在 throw 之前先結束 body。 |

**驗證**：兩支各補一條測試（取自上游同一個 PR 的測試，改寫成本 fork 的檔案結構）。把 src 改動
stash 掉重跑，兩條都紅（`bounded-body` 1 fail、`api-usage` 1 fail），確認測試有牙齒；改動放回
全綠（`bounded-body` 27 pass、`api-usage` 25 pass）。

**不引用 #2398 的後半**（`readDisplaySafeErrorText`，`src/server/responses/core.ts` +65 行）：那是
錯誤路徑的重構，依賴 `dev` 上的 `bounded-body` 新介面，硬移植等於自行改寫。**觸發條件**：隨
release 進 `main`，或本線出現「上游錯誤內容被原樣顯示」的實例。

### 其餘 31 個 PR

- **已合併進 `dev` 的另外 10 筆**：`devlog:` 工作紀錄與 `fix(zcode)`／`fix(auth)`／`fix(gui)` 等，
  逐條看過主旨與檔案，都不是本 fork 現在會痛的路徑；等 release。
- **open／closed-未合併的 21 筆**：`fix(xai)`、`fix(codex)`、`fix(catalog)`、`feat(test)` 這類，
  base 都在 `dev`，且改的是本 fork 沒有啟用的 provider 路徑或上游自己的測試工具鏈。它們是**提案**，
  不是上游已接受的變更；採用未合併的提案等於接手維護一份上游還沒定案的補丁。**觸發條件**：合併
  進 `dev` 且屬「本 fork 現在會痛」那一類，或隨 release 進 `main`。

### 55 個 issue

以「會不會改變本 fork 要驗什麼」為判準逐條掃過標題。多數是 provider 目錄、xAI／Kiro／OpenRouter
的路由行為與上游自己的 App 問題。沒有一條指向本 fork 已知的 Windows 行為缺口——`#2292`（Windows
model picker）那條已於本檔上一節引用 `a3bbcdb0` 解決。

### 水位（2026-08-23 當下）

- commit：`6ae83b1`（當時 `6ae83b1..upstream/main` 為 0）
- PR：**#2433**、issue：**#2434**（首次以 `--state all` 查過）

## 2026-08-27：發版線已到 `v2.34.0`，水位推進、合併延後

`bun tools/check-upstream-updates.ts` 對 08-23 水位回報 **514** 筆未審 commit。
first-parent 是四次穩定發版：

| 時間（+0900） | tag / 主旨 |
|---|---|
| 2026-08-24 19:00 | `v2.32.0` |
| 2026-08-25 10:37 | `v2.32.1` |
| 2026-08-25 20:25 | `v2.33.0` |
| 2026-08-27 22:06 | `v2.34.0`（`80fff9a7f47332a4445df2b26ea175053fa55b0b`） |

週一排程檢查（2026-08-24 03:53 UTC）仍綠，是因為 `v2.32.0` 當日 10:00 UTC 才進
`main`。不是 checker 壞了。

### 本線已引用、現已在上游 `main` 的三支

`a3bbcdb0`（`#2292` 桌面重啟）、`3611850c5`（`#2395` usage 增量上限）、
`383279cd2`（`#2398` 前半 abort-cancel）都已是 `upstream/main` 的祖先。
本線那幾份檔案相對 2.34 已過期。其中桌面重啟在 `v2.33.0` 被 `#2557` 修過：
`listPackageProcesses` 必須用換行（或分號）串 PowerShell，探針失敗不得回 `[]`。
本線仍是 `.join(" ")`。單元測試 mock `execFile`，綠燈不代表命令在 Windows 能跑。

### 為什麼不 merge

`git merge-base HEAD upstream/main` 為空。2026-08-23 壓縮歷史把本線變成 orphan。
下次同步：

```powershell
git fetch upstream --tags
git checkout -b fork/replay-v2.34.0 v2.34.0
# 重放 overlay：FORK/NOTICE/CLAUDE/SKILL/REVIEW、docs/fork、tools、
# workflow guard、語系刪除、CodeQL、Dependabot。產品檔改吃上游版。
```

不要 `git merge --allow-unrelated-histories upstream/main`。

進 2.34 時額外要做：給新檔 `.github/workflows/cleanup-closed-pr-branches.yml`
加上 `github.repository == 'lidge-jun/opencodex'`。這支排程有 `contents: write`，
會刪「關閉但未合併的 PR」留下的 branch。

### `platform` issue 增量（水位 `#2434` 之後）

本線現在會痛、且修正已在上游的：

| Issue | 狀態 | 對本 fork |
|---|---|---|
| [`#2557`](https://github.com/lidge-jun/opencodex/issues/2557) 無效 PowerShell | closed | **本線仍有這個洞**。重放時吃上游 `desktop-app-restart.ts`。 |
| [`#2292`](https://github.com/lidge-jun/opencodex/issues/2292) model picker | closed | 引用原因已進 `main`。 |
| [`#2605`](https://github.com/lidge-jun/opencodex/issues/2605) 大份 SQLite 擋 proxy | closed | Windows；隨 2.34 重放進來，不單挑。 |
| [`#2459`](https://github.com/lidge-jun/opencodex/issues/2459) npm 重裝混版模組 | closed | 同上。 |

仍 open、本輪不移植：`#2718`（re-auth / catalog）、`#2701`／`#2696`（launchd，
macOS）、`#2697`（CLI 對 management API 失敗仍 exit 0）。

未合併的 PR 仍不採用。今日看到的最新編號：issue `#2765`、PR `#2767`。

### 水位（2026-08-27）

- commit：`80fff9a7f47332a4445df2b26ea175053fa55b0b`（已審查、**未合併**）
- PR：**#2767**、issue：**#2765**
