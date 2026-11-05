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

### 上游 tag 放 `refs/upstream-tags/`，不進本機 `refs/tags/`

`tests/ci-workflows/release-version-line.test.ts` 讀本機 `git tag --list 'v*'`，斷言 `package.json` 版本不落後最高 release tag；
那個「最高 tag」應該只指 fork 自己的 release tag。`git fetch upstream --tags` 會把上游 tag 混進去，上游一發版本機測試就紅（CI 不抓上游 tag 所以綠）。
所以上游 tag 一律抓進獨立命名空間，並讓 `upstream` remote 不自動抓 tag：

```powershell
git config remote.upstream.tagOpt --no-tags          # 每個 clone 設一次
git fetch --no-tags upstream main "+refs/tags/*:refs/upstream-tags/*"
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

目前水位為 **2026-09-08**：已審查並合併上游 `v2.47.0` promotion 與 final roster correction
（`f7f890ff72a5ccccadb5a935c1ea106922562cd2`）、PR `#3943` 與 platform issue `#3661`。下一次只做增量檢查：

```powershell
git fetch --no-tags upstream main "+refs/tags/*:refs/upstream-tags/*"
bun tools/check-upstream-updates.ts --strict
```

報告會同時列出未審 commit、closed-unmerged PR 與水位之後的新 `platform` issue。處理完後推進相應水位，並把判斷寫進本檔。（2026-10-06 更正：fork 維持壓縮歷史、與上游沒有共同祖先，同步一律以 tag 間的 diff 套用，不建立 ancestry bridge，且絕不推送上游。）

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
git fetch --no-tags upstream "+refs/tags/*:refs/upstream-tags/*"
git checkout -b fork/replay-v2.34.0 refs/upstream-tags/v2.34.0
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

## 2026-09-01：bounded review

Fork `f03d3a507ae7`；upstream `54e2274cff231631c0ea2ff12574ff03829d5fe6`。`80fff9a..upstream`
有 264 commits；只檢視 `790a581cf`、`2a0ab4be6`、`63941b583`（Grok proxy、terminal controls、ownership）。
範圍同時含 workflow、assets、devlog 與 proxy 合約，故不 raw merge、不推水位。下一切片只讀後十筆
`src/`/`tests/` commit；採用前跑 `pwsh -NoProfile -File tools\dev_check.ps1`。

## 2026-09-06：v2.43.0 replay 與增量 ticket 分流

本 fork 在上游穩定 tag `v2.43.0`（`06ec553630fa2ee51a96b5cbf694089021249194`）重放維護 overlay；
因此 commit 水位推到該 tag，而不是把舊 orphan line 與 upstream raw merge。產品樹包含上游的
`gpt-6-astra` native/API catalog、context/effort、pricing、identity neutralization 與 Astra-first
subagent migration，沒有 fork 版重作。

### Closed-unmerged PR（`#2768`–`#3717`）

- 已標記 `landed-via-maintainer` 的 `#3490 #3492 #3515 #3519 #3525 #3528 #3529 #3531 #3547 #3551 #3554 #3556 #3557 #3559 #3566 #3567 #3570 #3574 #3577 #3580 #3581 #3583 #3585 #3590 #3594 #3599 #3611 #3621 #3628 #3638 #3653 #3658 #3669 #3671 #3672 #3673`：不另行移植；其正式落地內容由 v2.43.0 commit 軸處理。
- `#3489 #3502 #3524 #3536 #3568 #3571 #3576 #3625 #3631 #3649 #3654 #3659 #3679 #3717`：仍是關閉未合併的提案或 hygiene-blocked/review-ready 草案；未證明有本 fork 專屬且不在 stable release 的修正，故不採用。

以上 50 筆均已分流，`reviewed_pr_through` 推至 `#3717`。

### platform issue（`#2766`–`#3661`）

- `#3245`、`#3464` 是 macOS streaming/launchd 路徑；`#3449`、`#3494` 是 Docker/VS Code 功能提案：不在本 fork Windows overlay 範圍。
- `#3320`（非 ASCII Windows 排程）、`#3522`（continuation spill）、`#3661`（routed V2 subagent）屬 upstream runtime 行為：v2.43.0 作為完整產品來源，不另疊舊 fork patch。
- `#3376` 是 account-pool 排程功能提案：等待上游穩定產品決策，不在 maintenance overlay 自行實作。

以上 8 筆均已分流，`reviewed_issue_through` 推至 `#3661`。

## 2026-09-07：v2.44.0 replay 與 closed-unmerged PR 採用

本 fork 已從上游穩定 tag `v2.44.0`
(`07b48da8fd63881e848d26e0bd50087864f5573e`) 重放維護 overlay。`06ec553..07b48da`
的 350 個 commits 以穩定 release tree 整體採用，不把舊 fork 產品 patch 與上游
raw merge。GPT-6 Astra 繼續來自上游原生 catalog、pricing、context/effort 與
Astra-first subagent 遷移；fork 只保留英文／繁中語系、workflow guard、維護工具與
Windows full-suite runner。
因為 replay 後的 fork HEAD 已不是 `v2.44.0` tag 指向的 commit，`package.json` 使用
`2.45.0` 作本 fork 的 post-release development line；這不表示上游已發布 v2.45.0。

### Closed-unmerged PR（`#3718`–`#3744`）

| PR | 決定 | 理由與採用範圍 |
| --- | --- | --- |
| [`#3728`](https://github.com/lidge-jun/opencodex/pull/3728) | **採用** | `creditsUsd.percent` 在 v2.44 後端已存在但 quota bars 漏顯示；採用原 PR 三個 commits，含 canonical label 去重、排序與 urgency 測試。原作者／co-author metadata 保留。 |
| [`#3740`](https://github.com/lidge-jun/opencodex/pull/3740) | **採用** | canonical ChatGPT WebSocket 在輸出前收到 4xx 拒絕時，v2.44 仍會轉成 200 SSE + `adapter_eof`，使 quota/token recovery 看不到真實 HTTP status。採用原 PR 三個 commits；4xx/pre-commit 轉 HTTP，5xx 與 mid-stream 仍保留 SSE。 |
| [`#3744`](https://github.com/lidge-jun/opencodex/pull/3744) | **採用** | `/v1/responses/compact` 會緩衝完整上游回應，v2.44 卻漏掉 request idle-timeout opt-out，長壓縮可在 255 秒被斷線。採用原 PR 單一 commit 與契約測試。 |

三筆都在上游被 maintainer 關閉但未合併，且 maintainer 的審查評論均建議合併；
它們不會由 commit 軸進入 stable，因此本 fork 依關閉時的 exact PR heads
`fdc238e1c`、`cb7f561aa`、`baba44709` 重放並保留 attribution。

### Platform issue 與水位

`#3661` 後沒有新的 `platform` issue，所以 issue 水位不動。本輪水位：

- commit：`07b48da8fd63881e848d26e0bd50087864f5573e`
- PR：`#3744`
- issue：`#3661`

## 2026-09-08：同步 v2.48.0 stable（`f7f890ff..9a27e869`）

上游 `main` 在本輪 fetch 的穩定邊界為 tag `v2.48.0`，exact SHA
`9a27e86992d7a014e0aa92c046199b9fac148201`（promotion `#4011`）。相對本 fork
交付基線 `b2d14b616f14aa70db3b611879c36057faca822f` 有 73 個 commits；以一般 merge
完整採用 stable tree，不提前採用後續 `dev` 或 open PR。fork 維持繁中／英文語系限制、官方
repo-only workflow guard、Windows 71 fresh-process batch runner 與 run-lock hardening。
上游 release 版本為 `2.48.0`，fork package 前推為 post-release development version
`2.49.0`，不代表本 fork 發布 npm 套件。

### Closed-unmerged PR（`#3944`–`#4000`）

| 分流 | PR | 結論 |
| --- | --- | --- |
| 已由 v2.48.0 commit 軸涵蓋 | `#3944 #3949 #3950 #3951 #3953 #3995` | 以 maintainer landing／stable 修正完整採用：proxy v2 guidance、Go session affinity、Santiago DST fixture、server-owned delegation preset、quota capture retention、manual credit-reset cooldown。不重放原 PR head。 |
| 等下一 stable 或本 fork 可重現 | `#3988 #3990 #4000` | Google model-tail、Hermes source-preserving YAML 與 AI Studio discovery 僅在後續 dev carry；尚非本次 `main` 的祖先。未證明本 fork 目前獨有缺陷，不拆取會帶入未發布依賴的 patch。 |
| 不採用 | `#3999` | Cockpit clipboard auth import 尚未進 stable，且修改九語 locale（與 fork 英／繁中政策衝突）並擴大 credential/UI surface；若要採用須先有明確產品授權與繁中／英文重作。 |

以上 closed-unmerged PR 均已查閱 state、labels、檔案與可用 maintainer/stable landing；
`reviewed_pr_through` 推到 `#4000`。`#4010`／`#4011` 是已合併 preview/main release
promotion，已由 stable commit 軸處理，不是 closed-unmerged item。

### platform issue（`#4023`、`#4032`）

| Issue | 決定 | 理由與觸發條件 |
| --- | --- | --- |
| [`#4023`](https://github.com/lidge-jun/opencodex/issues/4023) | defer | macOS launchd dashboard Stop 可能在 native restore 前卸載自己；本 fork 的 Windows-first overlay 不改寫 macOS lifecycle。若 Windows Task Scheduler 或 native restore 出現同類未完成 teardown，或 upstream stable 修復時再審。 |
| [`#4032`](https://github.com/lidge-jun/opencodex/issues/4032) | defer | provider-hub chained client 將 per-model context window 落到 128k fallback；目前是 Ubuntu/macOS hub/client 報告，沒有本 fork Windows 本地重現，且尚無 stable fix。若 fork 使用 hub topology 重現、或上游修復進 stable，採完整 stable tree。 |

兩筆均實際 read-only 查閱內容，非空結果推論；`reviewed_issue_through` 推到 `#4032`。

### 水位

- stable tag / commit：`v2.48.0` / `9a27e86992d7a014e0aa92c046199b9fac148201`
- PR：`#4000`
- issue：`#4032`

## 2026-09-09：合併 v2.49.0 stable（`9a27e869..2f3f736`）

上游 `main` 已標記 `v2.49.0`，exact SHA 為
`2f3f736299dca38861f8fb9c4326a4b4d7c664bc`（promotion `#4117`）。本 fork 以一般 merge
完整採用 stable tree，不提前拆取 `dev` 或重放已由維護者 carry 的 PR head。上游
發布版本為 `2.49.0`；fork package 則前推為 post-release development
version `2.50.0`，不代表發布 npm 套件。英文／繁中 locale、official-repo-only
workflow guards、Windows long-suite runner 與 run-lock hardening 均保留。

### Closed-unmerged PR（`#4004`–`#4107`）

| 分流 | PR | 結論 |
| --- | --- | --- |
| 維護者 landing 已在 stable 採用 | `#4004 #4006 #4008 #4012 #4014 #4015 #4018 #4025 #4034 #4039 #4041 #4043 #4059 #4065 #4081` | 這些 closed PR 均有 `landed-via-maintainer` 標籤；對應 carry、修正與測試已在 `v2.49.0` stable tree。由 commit 軸完整採用，不重放原 PR head。 |
| superseded 且 stable 已有等價行為 | `#4016` | 維護者明確以 `#3954` supersede；`v2.49.0` 已含 Muse Spark free model 的 Responses 路由與 web-search 相容處理。原 head 含舊 `dev` 基底與被審查指出的重複結構，不重放。 |
| reject | `#4107` | contributor 確認為誤開至 upstream `main`，且 PR 是 draft、wrong-branch；沒有維護者 landing。若未來在 fork 重現計畫用量上限被 429 retry 掩蓋，或 upstream 將完整修正納入 stable，再以完整 landing 重審。 |

指定範圍內的 promotion/main merged PR 一律由 stable commit 軸採用，不另行
重放。strict report 對 `#4032` 之後沒有新 platform issue，所以 issue 水位維持 `#4032`。

### 水位

- stable tag / commit：`v2.49.0` / `2f3f736299dca38861f8fb9c4326a4b4d7c664bc`
- PR：`#4107`
- issue：`#4032`

### 2026-09-09 incremental triage：`#4137`

| 分流 | PR | 結論與重審條件 |
| --- | --- | --- |
| defer 至 stable | [`#4137`](https://github.com/lidge-jun/opencodex/pull/4137) | draft、base `dev` 的單一 head `292e382…` 在準備期間已被 merged `#4128`／`b2142586…` supersede。後者以 `{ modelId }` options API 將 Spark 5h header 歸入 `customWindows`，並覆蓋 HTTP、WebSocket、compact 與較完整的 Spark/non-Spark/legacy regression；原 PR 的第五個 positional `quotaScope` 會與該 landing 衝突。`#4128` 尚未進本輪 stable，所以不重放 `#4137`；下一個 stable 納入 `#4128` 時採完整 commit tree。若 Windows fork 在該前重現 Spark 5h header 被誤寫至 account `short*` 欄位，才依當時 maintainer landing 重新審查。 |

`reviewed_pr_through` 推至 `#4137`；沒有新 upstream commit 或 platform issue，commit／issue
水位分別維持 `2f3f736…`／`#4032`。

## 2026-09-10：同步 v2.50.0 stable（`2f3f736..2d4d7a2`）

上游 `main` 的新穩定邊界為 tag `v2.50.0`、exact SHA
`2d4d7a22381a2e497c2442902104619e25f937c7`（promotion `#4195`）。相對 v2.49 的
129 commits 以一般 merge 完整採用，沒有 cherry-pick `dev` head。fork package 前推為
post-release development version `2.51.0`；保留英文／繁中 locale、official-repo-only
workflow guards、Windows 71 fresh-process batch runner（每 batch <=600 秒、整體 <=120 分鐘、
serial lanes、124=incomplete）及 run-lock hardening。

上游的 README 翻譯 parity test 與 `readme/i18n-manifest.json` 假定所有多語 README 都存在，
與本 fork 只保留英文／繁中的已記錄政策直接不相容；兩者及非保留 locale 一併移除。既有
`fork-hygiene.test.ts` 繼續驗證繁中主 README、英文 README 與 fork guard，沒有弱化
fork-owned CI / CodeQL / upstream-check。繁中 README 保留原翻譯並補入 v2.50 的私密漏洞
回報說明，不以未翻譯的英文 README 取代它。

### Closed-unmerged PR

查詢 `#4137` 之後沒有新的 closed-unmerged PR；`reviewed_pr_through` 維持 `#4137`。
promotion `#4195` 與此範圍的 merged PR 均由 stable commit 軸採用，不另行重放。

### platform issue（`#4106 #4131 #4141 #4182`）

| Issue | 決定 | 理由與觸發條件 |
| --- | --- | --- |
| [`#4106`](https://github.com/lidge-jun/opencodex/issues/4106) | defer | Windows non-ASCII username/codepage report被 issue-template bot 以 `not_planned` 自動關閉，沒有 stable fix。若以合格 template 重開並有 maintainer landing，或 fork 實際重現，再審。 |
| [`#4131`](https://github.com/lidge-jun/opencodex/issues/4131) | superseded | issue 自述由 `#4141` 取代，不單獨採用。 |
| [`#4141`](https://github.com/lidge-jun/opencodex/issues/4141) | stable 採用 | macOS launchd update/repair 的 bootout recovery 已由 `#4164` / `95a3f6a` 落地並包含在 v2.50；取完整 stable tree。 |
| [`#4182`](https://github.com/lidge-jun/opencodex/issues/4182) | defer，Windows re-review required | issue 因空 Summary 被 bot 關閉，但後續 maintainer comment 證實 fresh `schtasks /create` 缺 `/f` 會令 elevation classifier 到不了 locale-independent fallback；尚無 stable landing。不得在 stable-only sync 拆取 patch。若 Windows fork 重現此 fresh-install denial，或上游以完整 maintainer landing 發布 stable，優先重審。 |

上述 issue 均以 read-only 內容與 comment 實查；`reviewed_issue_through` 推至 `#4182`。

### 水位

- stable tag / commit：`v2.50.0` / `2d4d7a22381a2e497c2442902104619e25f937c7`
- PR：`#4137`
- issue：`#4182`

### 2026-09-11：v2.50 merge 後的 remote ledger refresh（無新 stable commit）

`upstream/main` 仍為 `2d4d7a22381a2e497c2442902104619e25f937c7`；strict 查詢只發現
closed-unmerged PR 與 platform issue，沒有可加入本 stable-only merge 的新 commit。

| 項目 | 決定 | 理由與重新審查條件 |
| --- | --- | --- |
| PR [`#4184`](https://github.com/lidge-jun/opencodex/pull/4184) | defer | closed-unmerged，owner 說明已由 dev `#4226` / `9e75542ff` 取代；這是 request-scoped OpenCode Go session affinity，沒有 v2.50 stable landing。待 maintainer stable promotion 後按該完整 landing 審查。 |
| PR [`#4188`](https://github.com/lidge-jun/opencodex/pull/4188) | defer | closed-unmerged，owner 說明由 dev maintainer landing `#4230` / `ad36a595` 取代；ChatGPT Free warmup 的 400/404 fallback 屬後續 dev 工作，不能從 closed PR 拆取。待 stable landing 再審。 |
| Issue [`#4200`](https://github.com/lidge-jun/opencodex/issues/4200) | defer | remote-hub 文件的缺失 parent-object 與 macOS data-TLS 範例問題仍 open，沒有 stable docs landing；下一個 stable 文件整合或 fork 實際重現時再審。 |
| Issue [`#4204`](https://github.com/lidge-jun/opencodex/issues/4204) | defer，Windows re-review required | stale standalone CLI 可把 Desktop 已支援的 max/ultra 從 shared catalog clamp 掉；仍是 open 的設計問題，沒有 stable landing。若本 fork 安裝後重現 catalog rung 遺失，或 maintainer landing 進 stable，優先審查。 |
| Issue [`#4236`](https://github.com/lidge-jun/opencodex/issues/4236) | defer，macOS service re-review required | 回報 launchd repair 可能中斷健康 hub 且不能可靠復原；範圍大於 v2.50 的 `#4141` bootout recovery，仍 open、未進 stable。不得在 stable-only sync 自行重設計 service lifecycle；maintainer stable landing 或可重現的 fork macOS incident 時再審。 |

水位前推：closed-unmerged PR `#4188`、platform issue `#4236`。

### 2026-09-11：post-v2.50 closed-PR refresh（無新 stable commit）

`upstream/main` 仍為 `2d4d7a22381a2e497c2442902104619e25f937c7`；這兩筆 PR 都以
`dev` 為 base、closed-unmerged，不能加入 stable-only candidate。

| PR | 決定 | 理由與重新審查條件 |
| --- | --- | --- |
| [`#4203`](https://github.com/lidge-jun/opencodex/pull/4203) | defer 至 stable | pnpm global self-update 修正帶有 `landed-via-maintainer` 標籤，但 PR 本身未 merge，且目前 reviewed stable SHA 不含它。保留 maintainer 的完整後續 landing，等其 promotion 至 stable；若 Windows pnpm-managed global 安裝實際重現 updater 在 proxy shutdown 後失敗，再依當時 maintainer landing 審查。 |
| [`#4210`](https://github.com/lidge-jun/opencodex/pull/4210) | defer 至 stable | BigModel Responses quota-reader omission 的 closed contributor PR 沒有 maintainer landing 證據，作者亦明確未聲稱本機 product test 綠。不得從未發布 head 拆取 credential／quota 變更；待 maintainer stable landing，或 fork 實際重現這個 preset 缺 quota visibility 時再審。 |

兩筆均以 read-only `gh pr view` 實查其 closed-unmerged 狀態、`dev` base、標籤與作者的
驗證聲明；platform issue 沒有超過既有 `#4236` 的新項目。水位前推：closed-unmerged PR
`#4210`，platform issue 維持 `#4236`。

## 2026-09-12：同步 v2.51.0 stable（`2d4d7a2..c155cc7`）

上游 `main` 發布穩定版本 tag `v2.51.0`、exact SHA
`c155cc7923dbc0102e27d79185505a85d4357b2c`（promotion `#4271`）。相對 v2.50.0 的
34 個 commits 以一般 merge 完整採用。fork post-release 版本線前推為 `2.52.0`。
保留英文／繁中 locale overlay、official-repo-only workflow guard、Windows full-suite runner。

本輪帶入的核心產品能力：
- One-port Hub 同埠 loopback companion listener 與閘道通知（`#4250`）
- Hub 資料平面 Token 自動核發、`ocx hub invite` 與狀態面板（`#4252`、`#4255`）
- Pool 降級帳號排除：自動移出輪替避免無效重試（`#4211`、`#4238`）
- 無 session 請求配置獨立 session lane（`#4226`）
- Integrations 設定檔持有者防覆寫保護（`#4227`）
- ChatGPT Free 新帳號暖機機制（`#4230`）
- BigModel Responses Coding Plan 配額讀取支援（`#4231`）
- Qoder CLI 腳手架防禦（`#4234`）
- 原生 pnpm global 自我更新支援（`#4235`）

解衝突處理：上游重新加入的非英／繁中 docs-site（`fr, ja, ko, ru, tr, zh-cn`）依既有政策
予以刪除；test layout 登錄檔（`scripts/test-layout/layout.json` 與 `tests/fixtures/test-layout-expected.json`）
已加入 upstream 新增之 docs 與 watchdog 測試條目。

### Closed-unmerged PR（`#4211`–`#4293`）

| PR | 決定 | 理由與重新審查條件 |
| --- | --- | --- |
| [`#4258`](https://github.com/lidge-jun/opencodex/pull/4258) | stable 採用 | Command Code v4.1-flash 與 Qwen3.8-Flash effort ladders；帶有 `landed-via-maintainer` 標籤，已隨 maintainer landing 進入 v2.51.0 stable commit 軸。 |
| [`#4272`](https://github.com/lidge-jun/opencodex/pull/4272) | defer 至 stable | 處理 bare tools 被提供者誤加 default. 命名空間問題；closed-unmerged，已由 dev maintainer landing `#4264` / `391e40d` 取代（含完整回歸測試）。待下一 stable promotion 隨完整產品樹採用。 |
| [`#4291`](https://github.com/lidge-jun/opencodex/pull/4291) | superseded | OpenCode attachment/modalities 導出修正，已被 `#4293` 取代。 |
| [`#4293`](https://github.com/lidge-jun/opencodex/pull/4293) | defer 至 stable | OpenCode 圖片與模態能力導出；closed-unmerged，已由 dev maintainer landing `#4300` / `ad09340` 取代。待下一 stable promotion 隨完整產品樹採用。 |

上述 4 筆均以 read-only `gh pr view` 實查其狀態、標籤與 maintainer replacement；`reviewed_pr_through` 推至 `#4293`。

### Platform issue

`#4236` 之後無新的 `platform` issue；`reviewed_issue_through` 維持 `#4236`。

### 水位

- stable tag / commit：`v2.51.0` / `c155cc7923dbc0102e27d79185505a85d4357b2c`
- PR：`#4293`
- issue：`#4236`

## 2026-09-07：同步 v2.46.0，分流 `#3745`–`#3862`

本 fork 已一般 merge 上游穩定 tag `v2.46.0`
（`bba63222d3eeb5c8e397edae35798225e4fa1a6f`）。相對 v2.44.0 的 167 個
`main` commits 全部由 stable tree 採用；合併前的 fork overlay、英／繁中語系限制、
官方-repo-only workflow guard 與 Windows full-suite runner 保留。fork 的 post-release
版本線因此由 `2.45.0` 推進到 `2.47.0`，不表示上游已發布 v2.47.0。

### Closed-unmerged PR（`#3745`–`#3862`）

| 分流 | PR | 結論 |
| --- | --- | --- |
| 已由 v2.46.0 commit 軸涵蓋 | `#3747 #3779 #3780 #3809 #3815 #3816` | 原 PR 雖關閉未合併，但 maintainer 的 carry／重作已進 `main`；容器 Codex home、Chat JSON-to-SSE、provider JSONL、Anthropic rate headers、Claude envelope、Grok control-frame 行為都直接取 stable 版本，不重放原 PR head。 |
| 已落 `dev`，等待下一 stable | `#3769 #3837 #3839 #3840 #3841 #3843 #3845 #3849 #3856 #3858 #3860 #3862` | maintainer 已在 `#3866`–`#3881` 的 release train 內 carry／重作，且多筆含原 PR 沒有的 review 修正；截至本次水位都不是 `upstream/main` 的祖先。沒有本 fork 專屬重現證據時，不從仍前進的 113-commit `dev` train 拆半套。觸發條件是下一個 stable tag，或本機先重現相同缺陷後引用完整 maintainer landing。 |
| 拒絕 | `#3853` | `[WRONG BRANCH]`，把 workflow YAML 寫進並覆蓋 `SECURITY.md`；既不會執行又會移除正式安全政策。 |

以上 19 筆逐一讀過狀態、labels、檔案與 maintainer landing／關閉說明；
`reviewed_pr_through` 推到 `#3862`。`#3661` 後仍沒有新的 `platform` issue，issue 水位不動。

### 水位

- commit：`bba63222d3eeb5c8e397edae35798225e4fa1a6f`（`v2.46.0`，已合併）
- PR：`#3862`
- issue：`#3661`

## 2026-09-08：stable 無增量；分流 OrcaRouter `#3908`

`upstream/main` 仍是 `bba63222d3eeb5c8e397edae35798225e4fa1a6f`，沒有可同步的新
stable commit，也沒有 `#3661` 之後的新 `platform` issue。`upstream/dev` 則從
`f802f71122c8f166cf775e4d5ed8f47c2b909084` 前進 19 commits 到
`09f669a75c397d05c2063de87728a6b7d769505f`；其中唯一新的產品 landing 是 OrcaRouter，
其餘是 sponsor／release-train 文件與開啟 2.48.0 dev 的版本提交。

| 分流 | PR | 結論 |
| --- | --- | --- |
| 已由 maintainer 落 `dev`，等待 stable | `#3908` | contributor PR 已關閉未合併並標記 `landed-via-maintainer`；上游以 `#3921`／`c41232aa5e9981284acece3cedf81a36859dab05` 重作 PKCE、安全檢查、live catalog、GUI 與英／中說明。maintainer landing 保留原作者 attribution 並修正原 PR 的 raster icon 問題。功能未解本 fork 已登記的 Windows／安全缺陷，且會碰本 fork 刪除的多語 locale；不拆取仍未發布的 auth surface，等下一個 stable。 |

`reviewed_pr_through` 推到 `#3908`；commit 與 issue 水位不動。下一次 stable 同步時直接採用
maintainer landing，不重放 `#3908` 的原 head `9e90d8271e4b8dc9b229b478196270c0c4eae7bb`。

### 水位

- commit：`bba63222d3eeb5c8e397edae35798225e4fa1a6f`（`v2.46.0`，已合併）
- PR：`#3908`
- issue：`#3661`

### 同日後續：同步 v2.47.0 promotion

在 fork 的 v2.46 候選完成遠端 CI 後，`upstream/main` 新增
`6f71931dec81dffdfe40053d8df5074d40b3c406`（`release: promote 2.47.0 to main (#3929)`）。
本 fork 重新 fetch 並審查 `bba63222d..6f71931d` 的 152 commits／262 files，採一般 merge
完整接收 stable tree；先前暫緩的 OrcaRouter `#3908` 已由 maintainer landing `#3921`
及其後續 OAuth／GUI 修正進入此 stable，不再重放原 PR head。

衝突只出現在 fork 明確維護的語系與 README overlay：非英／繁中的 GUI、docs-site 與 README
仍維持刪除，繁中主 README 保留；其餘產品碼全部採 stable。上游 package 是 `2.47.0`，fork
post-release 版本前推至 `2.48.0`。`#3661` 後仍沒有新的 `platform` issue。

更新後水位：

- commit：`6f71931dec81dffdfe40053d8df5074d40b3c406`（v2.47.0 promotion，已合併）
- PR：`#3908`（已由 stable commit 軸涵蓋）
- issue：`#3661`

### 同日後續：同步 v2.47.0 final roster correction

完整 suite 執行期間，`upstream/main` 又新增 `#3933`，把 `#3931` 的 GUI subagent fallback
roster 修正套到 stable main。增量範圍 `6f71931d..f7f890ff` 只有 7 commits、3 個 GUI
檔案；本 fork 以一般 merge 完整接收，沒有額外衝突。

PR `#3909`–`#3943` 已逐筆分流：`#3929` 與 `#3933` 已進 stable；其餘 open/dev
workstream 不提前拆取。closed-unmerged `#3917`／`#3934` 分別已有 `#3942`／`#3937`
的 maintainer dev landing，等下一個 stable 再隨完整產品樹採用。`#3661` 後仍沒有新的
`platform` issue。

更新後水位：

- commit：`f7f890ff72a5ccccadb5a935c1ea106922562cd2`（v2.47.0 final roster correction，已合併）
- PR：`#3943`
- issue：`#3661`

## 2026-09-12：同步 v2.51.0 與 v2.52.0

### v2.51.0 同步摘要（commit `c155cc7`）
- 合併上游 `v2.51.0`（497 commits）：包含 One-port Hub、Pool 降級保護、Sessionless requests 隔離與 pnpm 更新支援。
- 衝突處理：移除非英／繁中 docs-site 與 GUI i18n 檔案；適配 Windows 環境下的 `tests/update/update-pnpm.test.ts`（以 `canSymlink` 探針跳過符號連結測試，並略過 POSIX 權限檢查）。
- closed-unmerged PR：`#3944`–`#4271` 均已結案；platform issue 水位維持至 `#4236`。

### v2.52.0 同步摘要（commit `4d37c35`）
- 合併上游 `v2.52.0`（`4d37c35155fe283722566d32892b8753c1230be7`）：
  - **Devin / Devin CLI**：引進 Cognition 雲端支援與本地 ACP stdio Devin CLI（修正 Windows 平台 APPDATA 路徑語意）。
  - **xAI Grok Coupons**：支援透過 gRPC-Web 讀取並兌換重置券。
  - **Cline CLI**：支援 Cline CLI 整合與 catalog sync。
  - **Context History Relay**：Codex 歷史 relay 機制與 loopback 認證強化。
  - **Codex 避讓機制**：引進配額拒絕避讓窗口與 clear-cooldown 解除。
  - **測試適配**：採納上游原生之 `writeHostShims`（`#4379`），使 pnpm update 測試在 Windows 原生環境正常通過。
- Closed-unmerged PR：
  - `#4313`（Codex history pagination writes）與 `#4386`（Cline registration contracts）均標記為 `landed-via-maintainer`，已由 maintainer 隨 release train 正式進主幹。
- Platform issue：檢查至 `#4414` 無新增條目。

### 水位更新
- commit：`4d37c35155fe283722566d32892b8753c1230be7`（`v2.52.0`，已合併）
- PR：`#4414`
- issue：`#4414`

## 2026-09-25：同步 v2.65.0 stable（v2.55.0..87a78e5）

**決定**：把上游穩定版本 `v2.65.0`（`87a78e5f26f81373bf57c39495037849bd7996f0`）以一般 merge
完整採用，`tools/upstream_baseline.json` 的 `reviewed_through` 推進到同一 SHA、
`reviewed_date` 為本次日期。fork package development version 由 `2.65.0` 前推至 `2.66.0`。

**為什麼現在同步**：上游 `#5743`／`#5694` 把主帳號 98% 硬鎖設為預設開啟，是 Codex Desktop
在 100% 用量時停用 Send 按鈕這個回歸（`#5797`）的正式修正；只有整棵 stable tree 帶著它，
不拆取單一 commit。

**衝突處理**：179 個 delete/delete 衝突（非保留 locale 的 docs-site、GUI i18n、
`readme/i18n-manifest.json` 等）由主 agent 於本輪開始前先行 `git rm`。本輪處理剩餘 52 個
UU/AA 衝突：

- `docs-site/src/content/docs/zh-tw/**`（29 個 AA/UU）、`docs-site/astro.config.mjs`：
  upstream 現在原生附帶 zh-tw 翻譯，一律採 `theirs`；`astro.config.mjs` 的側邊欄
  `translations` 物件只留 `zh-TW` 鍵，其餘語言鍵全部剃除，維持只保留英文／繁中的政策。
- `README.md`：五段全部採 `ours`（fork 的繁中版）。
- `.gitignore`、`.github/workflows/release.yml`：union 兩側內容；`release.yml` 的舊
  `publish:` 單體 job（帶 `if: github.repository == 'lidge-jun/opencodex'`）已被上游拆成
  `preflight → package-standalone/package-desktop → verify-release → attach-release →
  publish` 多階段流水線，官方-repo-only guard 留在最上游的 `validate-dispatch`，其餘所有
  job 都 `needs` 到它，guard 透過依賴鏈間接保留，不需要在新結構裡另加。
- `gui/`：`QuotaBars.tsx`、`ProviderCapacityQuota.tsx` 的 `bcp47()` 只留 `en`／`zh-TW`
  分支；`i18n/catalogs.ts`、`i18n/shared.ts`、`i18n/vision-reasoning-labels.ts`、
  `i18n/zh-TW.ts` 一併剃除 ru/ja/tr/vi 等非保留 locale，`zh-TW.ts` 補上 upstream 新增的
  `models.fastProvider` 系列翻譯鍵。`gui/package.json` 的 `doctor`／`doctor:full` 保留 fork
  自己的 `scripts/run-react-doctor.ts` 包裝（比對過就是同一個 npx 呼叫的 wrapper），採用
  upstream 新增的 `test:sidebar-version`。新測試 `subagent-surface-warning.test.tsx`、
  `logs-cost-plain-dollar.test.ts` 的 locale 計數維持 fork 既有的「2」而非 upstream 的
  「10」。新增的 `gui/src/i18n/native-main-translations.ts`（closed nine-locale namespace）
  同樣剃到只留 en/zh-TW，`satisfies Record<...>` 型別跟著收斂。
- `scripts/test-layout/layout.json`、`tests/fixtures/test-layout-expected.json`：union
  兩側新增的測試條目；upstream 側的 `docs-provider-discovery-limits.test.ts`、
  `docs-provider-preset-counts.test.ts`、`docs-readme-memory-inventory.test.ts`、
  `docs-readme-translation-parity.test.ts` 四個條目不採用（見下方「新增非保留 locale 內容」）。
- `scripts/test.ts`、`tests/ci-workflows/test-runner.test.ts`：保留 fork 的 fresh-process
  batch runner（`resolveBunTestPlan` 走 `BunTestPlanOptions` 形狀、非 serial 分支固定
  `15 * 60 * 1000`），upstream 側改用單一 `OCX_TEST_MAIN_TIMEOUT_MS` 主 lane 的設計不採用；
  對應的 `"a control budget is bounded and changes only the main lane"` 測試一併移除。兩檔
  `node:fs` import 取 union（`readdirSync`／`rmSync`／`realpathSync`／`symlinkSync`／
  `utimesSync` 等都有呼叫端）。

**新增非保留 locale 內容（隨 merge 自動新增，非衝突）**：`gui/src/i18n/vi.ts`（新
Vietnamese GUI catalog）直接刪除，沒有任何呼叫端引用。三個新 `tests/ci-workflows/` 文件
測試（`docs-provider-discovery-limits.test.ts`、`docs-provider-preset-counts.test.ts`、
`docs-readme-memory-inventory.test.ts`）分別斷言 `docs-site` 的 fr/ja/ko/ru/tr/zh-cn 頁面與
`readme/README.{fr,ja,ko,ru,tr,zh-CN}.md`，這些檔案在本 fork 不存在（同 v2.50 sync 移除
`readme-translation-parity.test.ts` 的政策），三個都刪除並同步移出兩份 test-layout 登錄檔。

**src/ 逐檔決策**（`v2.55.0..HEAD` 只有以下 6 個檔案帶 fork-only 安全／穩健性修正）：

| 檔案 | fork commit | 判定 | 理由 |
| --- | --- | --- | --- |
| `src/codex/catalog/provider-fetch.ts` | `34ba80918` | 移植 | upstream 把整個檔案拆成 barrel re-export（`filesystem-evidence`／`gather-capture`／`model-hints`／`combo-member`／`model-visibility`／`provider-models`／`routed-gather`），`fetchProviderModelsWithAuth` 移到新檔 `provider-models.ts`，且該檔仍是舊的 `hostname.endsWith("aiplatform.googleapis.com")` 與未清洗的 destination-policy log。採 `theirs` 的 barrel 結構，把 Vertex host 精確比對與 `sanitizeLogMetadataString` 兩處修正移植進 `provider-models.ts`。 |
| `src/codex/history-provider.ts` | `919223f5d` | 部分移植 | 實際修正（`inspectFirstLineProvider`／`readFirstLineProviderValue`／`assertLegacyHistoryWritable`／`readBackupStrict` 全部改走描述符）已隨 merge 乾淨落地，唯一衝突是 `MAX_ROLLOUT_ZST_DECOMPRESSED_BYTES` 常數：upstream 把它移到新檔 `history-rollout-read.ts` 並以 `export { ... } from` re-export，fork 原地重複定義會撞名。採 `theirs` 的 re-export，保留 fork 新增的 `MAX_HISTORY_MANIFEST_BYTES`。 |
| `src/codex/shim.ts` | `919223f5d` | 移植（改址） | upstream 把 `windowsBatchValue`／`windowsBatchSet`／`psString`／`readShimStateFile`／`readStateResult`／`readState`／`statePath`／`writeState`／`gitBashPath` 全部拆到 `shim-templates.ts` 與新檔 `shim-state-file.ts`，且 shim.ts 本身已經 import 這些符號。fork 原地保留的整段舊定義是純重複，刪除；`shim-state-file.ts` 裡新落地的 `readBoundedRegularFile` 仍是修正前的版本，改成呼叫共用 `lib/bounded-file-read`（同 shim.ts 原本 `readShimStateFile` 的包法）。 |
| `src/lib/service-secrets.ts` | `919223f5d` | 已由自動合併涵蓋 | `readServiceApiTokenState`／`readTokenBackupState` 的函式體本身無衝突，merge 已保留 fork 修正過的版本；只有 import 列表衝突（fork 只需 `readBoundedRegularFile`，upstream 新增的 `hardenReusedServiceApiToken` 需要 `constants`／`fchmodSync`／`fstatSync`／`lstatSync`／`readSync`）。Union 兩側 import，捨棄 upstream 側不再使用的 `existsSync`。 |
| `src/server/index.ts` | `f56fd719b` | 判定 upstream 已有等價修正 | upstream 把整個 `Bun.serve` fetch handler（原本 fork 內的 ~1700 行路由分派）拆進新檔 `src/server/index/serve-options.ts` 的 `createServeOptions()`；該檔的 `/v1/responses/compact` 分支已經用 `onRequestBodyRead: () => disableResponsesRequestTimeout(req, requestServer)` 達成與 fork 修正相同的效果（讀到 body 才解除 idle timeout，時機甚至更精確）。採 `theirs` 整棟新架構，不移植。 |
| `src/server/responses/codex-ws-exchange.ts` | `02212a64d`／`52c76de43`／`3b9f4412f` | 全部保留 | 三支修正（wrapped-rejection 4xx 短路、`REBUILT_REJECTION_DROPPED_HEADERS` 剃除代表性標頭、`sanitizeLogMetadataString` 清洗轉發錯誤訊息）與 upstream 新增的 native-steering 功能落在不同函式，merge 只在 import 列表衝突。Union 兩側 import。 |

**驗證**：見下方 VERIFIED 區塊；`bun run typecheck`、聚焦測試、`structure:check`、
`privacy:scan`、`tools\dev_check.ps1` 全綠（詳細輸出見同輪 IMPLEMENTATION REPORT）。

**本輪未做**：PR／issue 觸接維持 `#4414`／`#4414`，本輪未逐筆重新盤點——上游 stable
tree 整棵採用已涵蓋 v2.52.0 之後所有已 merge 的 commit，未合併/關閉的 PR 與新
`platform` issue 留給下一次批次審查。

## 2026-09-26：同步 v2.66.0 stable（87a78e5..e70b3d8）

**決定**：把上游穩定版本 `v2.66.0`（`e70b3d86fb1201d7951dfeb25e09b7871c433047`，
`v2.65.0..v2.66.0` 共 48 個 commit）以一般 merge 完整採用，`tools/upstream_baseline.json`
的 `reviewed_through` 推進到同一 SHA、`reviewed_date` 為本次日期。fork package
development version 由 `2.66.0` 前推至 `2.67.0`。

**為什麼現在同步**：延續上游 stable 發版節奏；這 48 個 commit 帶了 PF-01..PF-12
協定路徑分階段開關（`0f4c8d4a0`）、機器連結（`ocx link`，`e12919ed5`／`89aa88031`／
`20c8922ba`／`2f641cc44`／`2858ac3b1`／`88b9da8c5`）與多項安全/穩健性修正
（`929d4ff8e` cursor shell containment、`818256264` Claude 攔截代理驗證、
`66241a113` proxy transport 上的 admin token 隔離等），整棵 stable tree 一起帶著採用。

**衝突處理**：76 個 delete/delete 衝突（非保留 locale 的 docs-site、GUI i18n、
`readme/i18n-manifest.json` 等）以 `git rm` 批次處理，做法與上次相同。本輪處理剩餘 7 個
UU/AA 衝突：

- `README.md`：全部採 `ours`（fork 的繁中版），沿用既有政策。
- `docs-site/astro.config.mjs`：側邊欄 `items` 採 upstream 新順序與新條目（`Remote Link`、
  `Protocol Paths`），`translations` 物件只留 `zh-TW` 鍵，其餘語言鍵剃除。
- `docs-site/src/content/docs/zh-tw/guides/remote-hub.md`：採 `theirs`——upstream 這輪把
  Remote Hub 的管理平面說明改寫（新增管理埠不對外發布、不用 Tailscale Funnel 的限制），並
  加了指向新頁「遠端連結」（`zh-tw/guides/remote-link`）的連結；fork 舊翻譯已過時。
- `docs-site/src/content/docs/zh-tw/reference/cli/lifecycle.md`：`ocx service` 一節
  upstream 把 Linux／macOS 的啟動器路徑說明拆成兩段獨立段落（英文源已是這個結構），採
  `theirs` 的拆分方式，但補回 fork 原有、theirs 沒帶到的 Windows 包裝程式驗證段落
  （英文源該段落仍在，位置在 Linux／macOS 兩段之前）。
- `docs-site/src/content/docs/zh-tw/reference/cli/providers-accounts.md`：4 處衝突，
  皆因 upstream 把 `ocx account` 的 `login`／`remove`／`add-key`／`reset-credits`／
  `grok-reset-coupons` 子指令說明從 `priority` 之後移到其之前，並補上新的 `alias`／
  `history`／`pause`／`resume`／`pause-exhausted`／`strategy`／`sticky`／`clear-cooldown`／
  `import`／`import-orca`／`main` 用法列。採 `theirs`；但這個大範圍搬移讓 3-way merge
  在同一份檔案裡留下一組舊序位、內容較舊的重複區塊（`login`／`remove`／`add-key`／
  `reset-credits`／`grok-reset-coupons` 各兩份），額外刪除了舊序位那份重複區塊，只保留
  內容較完整（含裝置碼登入說明、`catalogRefreshPending` 欄位、reset-credit 復原細節）、
  順序與英文源一致的那份。新增的 `zh-tw/guides/protocol-paths.md`（英文源新頁，upstream
  未附 zh-tw 翻譯）補上最小翻譯，heading（8）與 fence（4）計數與英文源一致。
- `gui/tests/locale-parity.test.ts`：兩處衝突皆採 `theirs`（`LOCALES.map(l => l.code)`
  取代硬寫陣列、新增的 Cursor 分頁與 Aside 三事實測試），`DSH_VISIBLE_COPY` 依既有政策
  剃除 upstream 新增的 `vi` 項目，只留 `en`／`zh-TW`。
- `src/adapters/exec-tool-result-normalize.ts`：fork 在 v2.65.0 之後已把空輸出偵測改寫成
  左到右字串解析（`isEmptyExecOutputWrapper`，避免正規表達式），upstream 這輪則保留原本
  正規表達式並加上 atomic-group 式 pin（`(?=(X))\1`）修同一個 ReDoS 洞。兩者對合法輸入
  行為等價；`tests/adapters/exec-tool-result-normalize.test.ts`（含 upstream 這輪新增的三組
  測試）直接對 `EMPTY_EXEC_OUTPUT_REGEX` 斷言。判定：保留 `isEmptyExecOutputWrapper` 作為
  唯一實際呼叫路徑（所有 caller 已用這個名字），同時保留 upstream 修好的
  `EMPTY_EXEC_OUTPUT_REGEX` 匯出供既有測試與外部呼叫者使用，兩者並存、互不覆蓋。

**新增非保留 locale 內容（隨 merge 自動新增，非衝突）**：upstream 新增機器連結指南時，
`docs-site/src/content/docs/{fr,ja,ko,ru,tr,zh-cn}/guides/remote-link.md` 六個非保留
locale 檔案在 merge 過程中乾淨新增（沒有對應舊檔可觸發 delete/delete 衝突），已個別
`git rm` 移除。

**src/ 逐檔決策**：`v2.65.0..v2.66.0` 之間，fork 在 `main` 上對這段區間也有修改的 src
檔案只有 4 個（`src/adapters/exec-tool-result-normalize.ts`、`src/client/connect.ts`、
`src/remote-control/workspace-hub.ts`、`src/server/responses/codex-ws-exchange.ts`）；
除上述 `exec-tool-result-normalize.ts` 外，其餘 3 個檔案 upstream 改動的行與 fork 改動的行
不重疊，`git merge` 全部自動合併，無需手動判定。

**驗證**：`bun install`、`bun run typecheck`、`bun run structure:check`、
`bun run privacy:scan`、`pwsh tools/dev_check.ps1` 全綠；詳細輸出見同輪
IMPLEMENTATION REPORT。

### Closed-unmerged PR（`#4415`–`#5851`，共 50 筆）

| 分流 | PR | 結論 |
| --- | --- | --- |
| 已由 v2.66.0 stable 涵蓋（47） | `#5605 #5606 #5607 #5630`（bundle `#5672`）、`#5614 #5620 #5647`（`#5680`）、`#5621 #5622 #5628 #5665`（`#5678`）、`#5629 #5633 #5646 #5659`（`#5675`）、`#5667 #5668 #5669`（`#5676`）、`#5683 #5704 #5706 #5714`（`#5738`）、`#5693`（`#5739`）、`#5700`（`#5740`）、`#5703 #5713`（`#5743`）、`#5627 #5709 #5711 #5735`（`#5742`）、`#5715 #5716 #5717 #5736`（`#5741`）、`#5766`（由 `#5771` 取代）、`#5623`（由 `#5599` 取代）、`#5808`–`#5819` PF 系列（bundle `#5820`） | 關閉留言都寫明 maintainer bundle／squash SHA，逐一以 `git merge-base --is-ancestor <sha> upstream/main` 確認已是 v2.66.0 的祖先。不重放原 PR head。 |
| defer | `#5795` | 維護者改以 Claude Agent SDK 重做，後續在 open PR `#5800`；等它進 stable 再審。 |
| reject | `#5726` | draft、推測性的 Qoder tool bridge，無 landing，與本 fork 的 Windows／安全面無關；`#5270` 有 stable landing 時再看。 |
| reject | `#5851` | `[WRONG BRANCH]`、`intake: hygiene-blocked`，同 `#3853` 前例。 |

結論：**沒有需要另外 cherry-pick 的項目。**

### Platform issue（`#4956 #4997 #5833 #5853`）

| Issue | 決定 | 理由與重審條件 |
| --- | --- | --- |
| [`#4956`](https://github.com/lidge-jun/opencodex/issues/4956) | defer，Windows re-review required | Bun 子程序不再輸出且不結束；P1、open、尚無 stable 修正。標題點名 Windows CI（內文紀錄都是 macOS）。stable 修正時，或本 fork 的 Windows batch runner 出現無聲卡住的 batch 時重審。 |
| [`#4997`](https://github.com/lidge-jun/opencodex/issues/4997) | 不適用 | macOS control lane 逾時；本 fork 用自己的 Windows fresh-process runner。 |
| [`#5833`](https://github.com/lidge-jun/opencodex/issues/5833) | defer | 帳號池閒置 warmup 功能提案，無 stable landing；比照 `#3376`，不搶在上游產品決策前自行實作。 |
| [`#5853`](https://github.com/lidge-jun/opencodex/issues/5853) | 不適用 | macOS 系統 proxy 偵測（`#1525` 第二段）；Windows 段已隨 stable 進來。 |

### 上游分支（114 條，扣掉 `dev`／`main`／`preview`）

4 條已是 `upstream/main` 的祖先；其餘 110 條逐一以 `gh api repos/lidge-jun/opencodex/commits/<sha>/pulls`、分支名搜尋 PR 與內容抽查比對：`feat/pf0N-*`（PF 子 PR，已由 `#5820` 落地）、`devin/*-p1-*`（`#5825` bundle 的逐 issue 工作）、`rebase/pr-NNNN`（maintainer 重放用副本）、`stack/*`／`codex/lane-*`／`codex/carry-*`（bundle 組裝用分支）、`takeover/desktop-claim-5459`（已關閉的 `#5459`）、`devin/…-claude-agent-sdk-process-owner`（屬 open PR `#5800`）。**沒有「帶獨有 commit 又不屬於任何 PR」的孤兒分支。** open PR（48 筆）依既有規則不逐筆評估。

### 水位

- stable tag / commit：`v2.66.0` / `e70b3d86fb1201d7951dfeb25e09b7871c433047`
- PR：`#5851`
- issue：`#5853`

## 2026-09-26（續）：同步 v2.67.0 stable（e70b3d8..4bc9229）

**決定**：把上游穩定版本 `v2.67.0`（`4bc92294aa23a7edba75805095808d892efa72e2`，
`e70b3d86f..4bc9229` 共 59 個 commit）以一般 merge 完整採用，`tools/upstream_baseline.json`
的 `reviewed_through` 推進到同一 SHA、`reviewed_date` 為本次日期。fork package
development version 由 `2.67.0` 前推至 `2.68.0`。

**為什麼現在同步**：上游在 v2.66.0 同步作業進行中時就發了 v2.67.0；本 fork 對穩定
tag 一律整棵採用，不拆取單一 commit，因此接續合併。

**衝突處理**：26 個 delete/delete 衝突（非保留 locale）以 `git rm` 批次處理，做法與前兩輪相同：
`docs-site/src/content/docs/{fr,ja,ko,ru,tr,zh-cn}/guides/claude-code.md`、
`.../guides/web-dashboard.md`、`.../reference/cli/providers-accounts.md`、
`.../reference/configuration/server.md`（6 語 × 4 頁 = 24），以及
`gui/src/i18n/{de,fr,ja,ko,ru,tr,vi,zh}.ts`（8 檔，`zh-TW.ts` 不在其中，維持自動合併）。
本輪未有新增的非保留 locale 檔案隨 merge 乾淨新增（已檢查 `git status` 無 fr/ja/ko/ru/tr/zh-cn/vi/de
命名的新增項目）。剩餘 2 個 UU 內容衝突：

- `docs-site/src/content/docs/zh-tw/guides/claude-code.md`：Desktop 第一方模式段落。pristine
  `v2.67.0` 的 zh-tw 翻譯完全缺少「Desktop itself is not reconfigured」這段引言與其 `HTTPS_PROXY`/
  `NODE_EXTRA_CA_CERTS` JSON 範例——對照英文源（`docs-site/src/content/docs/guides/claude-code.md`
  第 171-183 行）確認這段仍存在且未變，是上游自身翻譯的既有缺口，非本輪新增。採 `ours`
  的引言與 JSON 範例，接上 `theirs` 改寫過的結尾句（Code 分頁與子代理路由說明，對應英文源第 185
  行的最新用詞）。`ours` 原本結尾多帶一句「CA 不會安裝到作業系統信任儲存區」，英文源現在完全沒有
  這個宣稱（同一頁面全文搜尋 trust/CA 皆無對應段落），判定為過時內容，予以刪除而非移植。
- `docs-site/src/content/docs/zh-tw/reference/cli/providers-accounts.md`：`ocx models` 的
  `context` 與 `shadow` 兩個子指令表格列。`context` 列採 `ours`——pristine `v2.67.0` 的 zh-tw
  仍是缺少 `--set-all`／`provider ... on --value` 的舊版翻譯，而 `--set-all` 早在 `e70b3d86f`
  之前就已進入英文源，`ours` 的翻譯已經跟上、`theirs` 沒有。`shadow` 列採 `theirs`——這輪英文源
  把預設 helper slug 從單一 `gpt-5.6-luna` 改成 `gpt-6-luna`、`gpt-5.6-luna` 兩個，並把
  `gpt-5.4-mini` 標記為已退役，`theirs` 的翻譯已同步、`ours` 還是舊描述。

另有一處不是衝突、而是 fork 自己補的翻譯：英文 `guides/remote-workspace.md` 本輪新增
「RPC compatibility and timeouts」一節，上游沒有動 zh-tw 版，因此 fork 依英文源補上
「## RPC 相容性與逾時」（v2、65 秒、1–120,000 ms），讓 `docs-zh-tw-parity` 維持綠燈。
`zh-tw/guides/claude-code.md` 也因上游把「Claude Code CLI compatibility」改名為
「Claude Code CLI first-party」，合併後留下舊標題的重複段落，已把 4 個要點移到新標題下、刪除舊標題。

**src 逐檔決策**：`e70b3d86f..v2.67.0` 之間上游改動了 48 個 `src/` 檔案。fork 相對 v2.66.0
有 22 個自己修改過的 `src/` 檔案（`git diff e70b3d86f 78ecab5d9 -- src`），兩個集合沒有交集，
因此不需要逐檔判定或移植，全部由 `git merge` 自動採用上游版本。fork 的 src 差異在
HEAD↔v2.66.0 與 index↔v2.67.0 之間逐位元組相同（審查時核對）。

**驗證**：`bun run typecheck`、`structure:check`、`privacy:scan`、`tools\dev_check.ps1`、
嚴格版 `check-upstream-updates.ts` 全綠；fork 關鍵測試 258 pass／0 fail。完整套件（fork runner，
108 批）有 42 個測試檔失敗：38 個在本機既有的環境限定清單上（Codex inject／journal／
transition-state 鎖、claude-desktop first-party、shim `driver.cmd`、symlink 等；上一輪已證實在
pristine 上游有相同 pass/fail）。其餘 4 個逐檔在 pristine `v2.67.0` worktree 對照：
`release-outcome-report`（fork 在 `release-outcomes` 加了官方 repo guard，測試預期值已同步修改）；
`claude-desktop-remote-hub`、`claude-desktop-first-party`（第 14 批逾時的來源）兩邊 pass/fail 相同；
`token-guardian` 單獨跑兩邊都全過（套件內偶發）；`issue-914-transport-attribution` 是測試留下的
空 ACL 暫存資料夾造成 EPERM，清掉後 6/6 通過。

### Closed-unmerged PR（`#5852`–`#5894`，共 10 筆）

| 分流 | PR | 結論 |
| --- | --- | --- |
| defer 至 stable | `#5865 #5867 #5869 #5885 #5888 #5889 #5891 #5892` | 已由 maintainer 以 bundle `#5901`（`dd1e3279ab092527e163b6c28595bc076238bafe`）落在 `dev`，尚非 v2.67.0 的祖先。下一個 stable 隨完整產品樹採用，不重放原 PR head。 |
| defer 至 stable | `#5894` | 502 用量耗盡的 combo 冷卻；由涵蓋結構化錯誤碼的 `#5874` 取代，隨 bundle `#5902`（`f09dd2aebe`）落在 `dev`，未進 v2.67.0。 |
| reject | `#5883` | 作者撤回：`GET /healthz` 本來就不需驗證，401 來自作者自己的 LAN 反向代理。 |

前一輪的 defer 重查：`#5795`（其後續 open PR `#5800` 仍未合併）維持 defer；`#5726` 維持 reject。

### Platform issue

| Issue | 決定 | 理由與重審條件 |
| --- | --- | --- |
| [`#5864`](https://github.com/lidge-jun/opencodex/issues/5864) | defer | Windows junction 型態的 `CODEX_HOME` 讀不到帳號；修正 `#5865` 在 `dev` bundle `#5901`，未進 v2.67.0。本機 `~/.codex` 是一般資料夾（非 junction），不受影響，所以不提前拆取。本機改用 junction，或下個 stable 時再審。 |
| `#4956` `#5833` | defer（不變） | v2.67.0 仍無修正。 |

### 分支

115 條（前一輪 114）。新增的 `codex/bug-train-2` 屬 open PR `#5902`；`dev`／`preview`／`pr-assets` 移動屬正常。**沒有孤兒分支。** 採用清單：**無**。

### 水位

- stable tag / commit：`v2.67.0` / `4bc92294aa23a7edba75805095808d892efa72e2`
- PR：`#5894`
- issue：`#5864`

## 2026-09-30：分組審查 `v2.67.0..v2.74.0`（395 commits，全部 adoption pending）

**決定**：`4bc9229..cae9b553e`（`v2.68.0`–`v2.74.0`，395 commits、1947 檔差異）只做分組判定，**不採用任何 commit**；
`reviewed_through` 推進到 `cae9b553e9b882dd13781a7f3ee6f68c0dcc8c4f`（`v2.74.0`）僅代表已審。

**為什麼不合併**：`git merge-base HEAD upstream/main` 為空——`origin/main` 已再次被壓成 5 個 commit 的 root 歷史
（`87ddc1cd3`），2026-09-06 的 ancestry bridge 已不在，一般 merge 會變成全樹 unrelated-history 合併。
本 fork 對穩定版一律整棵採用，不拆取單一 commit；本輪不具備「整棵採用並跑完整 Bun 分片」的驗收條件。
採用前提：先由維護者決定是否重建 ancestry bridge（`merge -s ours` 接到 `v2.67.0` 的 `4bc92294a`，不改樹），
之後才能以 `git merge v2.74.0` 增量處理；locale 檔會再出現與前幾輪相同的 delete/delete 衝突。

### Commit 分組（395）

| 組別 | 約數 | 判定 |
| --- | --- | --- |
| 版本／release／CI／devlog／Cargo 與依賴／macOS 簽章公證 | 約 45 | follow-upstream：本 fork 不發版；CI 與簽章屬官方 repo |
| 文件與非保留 locale（fr／ja／ko／ru／tr／zh-cn／de／vi） | 約 80 | not-applicable：fork 只保留 en + zh-TW |
| 測試穩定化（Windows 冷啟動、fixture、layout 登錄） | 約 22 | follow-upstream：隨對應產品碼一併採用 |
| 新功能：Kiro／Devin／TokenLab／MiniMax／Sonnet 5.5／GPT-6.1 Sol 目錄、Droid／Kilo 匯出、memory phase 路由、JEV notes、Anthropic／OAuth 帳號 pause 與 per-model 路由、Codex 低額度保護、macOS 系統 proxy、desktop menu bar | 約 40 | follow-upstream：產品增量，非缺陷；無 fork 特有需求 |
| 一般 provider／adapter／combo／catalog 修正（GLM、MiMo、CodeBuddy、Cursor、command-code、combo 冷卻十分鐘、quota window、Claude strict／picker） | 約 130 | adoption pending：整組隨 stable 採用，需 `bun run test` 分片驗證 |
| Windows 相關修正（`21ccf35db` proxy ABOVE_NORMAL 優先度、`43b02ef7e` 與 `be218ba68` service manager／standalone wrapper 判定、`fa255e0d8` junction 型 `CODEX_HOME`（issue `#5864`）、`87bee294a` dashboard 探測不阻塞 proxy、`390b69f2c` Windows system proxy 檢查） | 約 10 | adoption pending：本機主線平台，優先切片；需 Windows service／codex 測試 |
| 安全邊界（link relay 認證與憑證剝除 `e1c894367`／`5747a5c4b`／`d0157e0f5`／`33b1920cc`、OAuth 與 keyring、plugin ACL `e89de8f53`、picker CA `2948775b7`／`6d7af977a`、redaction、usage ledger fail-closed `32f4ea1de`） | 約 30 | adoption pending：本 fork 在 `e9de140d..e78ea34a9` 另有 CWE-367 lstat／FIFO 修正，涉及同一批檔案；採用前需逐檔比對並讓對應 focused tests 通過，不得無測試合併 |

### Closed-unmerged PR（`#6058`–`#6316`，共 61 筆）

| 分流 | PR | 結論 |
| --- | --- | --- |
| 已由 merge-train／carry commit 落在 `main` | 其中約 55 筆（例：`#6058→3cd78023c`、`#6064→159085ed6`、`#6109→ae88364b7`、`#6115→7618c83f9`、`#6260→f9bfca0d0`、`#6316→6c32c4da3`） | 隨 stable 採用一併處理，不重放原 PR head |
| reject | `#6125` `#6253`（`[WRONG BRANCH]`）、`#6084`（`#6085` 重複） | 上游自己判定不合格或重複 |
| defer／無內容 | `#6086`（clippy／MSRV）、`#6095` `#6206`（規劃文件）、`#6214`（Kiro 隱藏未發布模型） | 非缺陷或無 landing；`#6214` 待有 stable landing 再看 |

### Platform issue（`#6135 #6196 #6288 #6290 #6291 #6314`）

| Issue | 決定 | 理由與重審條件 |
| --- | --- | --- |
| `#6288` | defer | Windows `ocx update` 的 npm cache 預檢在 dangling junction 上 ENOTDIR；截至 `cae9b553e` 仍 OPEN、無修正 commit。fork 有 `src/update/npm-cache-preflight.mjs`。上游出修正或本機遇到 dangling `npm-cache` junction 時重審。 |
| `#6290` | defer | Windows service wrapper 的 `%DATE%` 含括號（ko-KR）會中止；fork 的 `src/service/windows-taskxml.ts` 同樣使用 `[%DATE% %TIME%]`，本機 zh-TW 區域不受影響。上游出修正或改用其他 locale 時重審。 |
| `#6135` `#6196` `#6291` `#6314` | defer | `#6135` Bun 記憶體用量待 needs-info；其餘三筆為 macOS 專屬。全部仍 OPEN、無修正。 |

### 分支

未逐條盤點（本輪不採用任何 commit，分支結論沿用前一輪）。採用清單：**無**。

### 水位

- stable tag / commit：`v2.74.0` / `cae9b553e9b882dd13781a7f3ee6f68c0dcc8c4f`
- PR：`#6316`
- issue：`#6314`

## 2026-10-03：分組審查 `v2.74.0..v2.76.0`（84 commits，採用候選 4 筆待決、本輪不移植）

**決定**：`cae9b553e..249462bf5`（`v2.75.0` `ef0297f86c4540c7d757c8595170d66f9c584aec`、`v2.76.0`
`249462bf570555aad103957025eea96f7489c7eb`）共 84 commits（80 非 merge）、642 檔差異（`src/` 226 檔）。
逐組判定完成，**本輪不移植任何 commit**；`reviewed_through` 推進到 `v2.76.0` 僅代表已審。

| 判定 | 數量（80 非 merge commit） |
| --- | --- |
| adopt now（候選，待維護者決定是否手移植） | 4 |
| defer（隨 stable 整棵採用，附重審條件） | 53 |
| skip（非缺陷、macOS 專屬、fork 不發版等） | 23 |

另有 1 項 fork 自有的 action item（不是上游 commit，見下「`ocx-*` agent 說明」）。

**為什麼仍不合併**：`git merge-base HEAD upstream/main` 仍為空（exit 1），與 2026-09-30 條目同因；
上一輪登記的觸發條件「上游修正 Windows `#6288`／`#6290`」本輪已成立（`09cd45daa`／`8a3a7762f`，兩 issue 均已 closed-completed），
所以其中的 Windows 修正列為採用候選。其餘仍走整棵 stable 採用。

### Commit 分組（80 非 merge）

| 組別 | 數 | 判定 |
| --- | --- | --- |
| 版本／release／devlog／文件／structure 行數預算（`64294638a` `6c91540e8` `7ea77aaaf` `4f3182292`） | 4 | skip（follow-upstream）：fork 不發版；本段 `.github/` 0 檔變動，無 workflow guard 需核對 |
| 純測試穩定化（`82a495519` `665e2bc15` `95f21f438`） | 3 | skip（follow-upstream）：隨對應產品碼一併採用 |
| 新功能：OpenGateway、Zed Hosted AI、Antigravity TLS profile、JEV 決策方法、Claude 頁面與 CLI `/model` picker、LazyCodex 角色模型與委派建議、Codex 主帳號硬鎖門檻、macOS quota-gate shim | 12 | skip 11（產品增量，fork 無特有需求）；defer 1：`10428d012` 把「100% 切換帳號、花 ChatGPT credits 改 opt-in（`creditCodexAccountIds`）」做成預設行為變更，影響計費，整合 stable 時須確認預設值 |
| Windows／service／update（`09cd45daa` `8a3a7762f` `89db85ff0` `21aed9fee` `cfde16743` `17d6e8498` `0f2ec7adb` `6d84e4468` `a9d5a80c2` `137164e3e`） | 10 | **adopt 3**（見下表）；defer 6；skip 1（`137164e3e` Tauri desktop 啟動預算，fork 不出 desktop） |
| 安全邊界與有界化（`f5e9fdaba` `58a26f0c1` `6e5101115` `22c890c8d` `0f6026ddc` `742951354` `57fc9cc57` `b933aa292` `faf946e8b` `72e65439f` `4448e98a6` `328ce9581`） | 12 | **adopt 1**（`f5e9fdaba`）；defer 11（安全相關逐項見下） |
| Claude／Anthropic：帳號池 429／403 failover 與 per-model 週額度、thinking 與 128K 輸出上限、rate-limit header 轉送、passthrough 失敗紀錄、picker snapshot 重建、intercept 隨需啟動 | 9 | defer（adoption pending）：整組依賴 v2.68–74 的 Claude 帳號池與 picker 重構，單挑會自行改寫 |
| CLI 驗證／診斷（`fc0f24a57`、`af358141e`）與 GUI 文案（`933bd03cb` `8ad261e00` `50b3dd48d`） | 5 | defer（follow-upstream）：GUI 檔含 `zh-TW.ts` 與非保留 locale，整合時照既有 locale 政策處理 |
| 一般 provider／adapter／combo／catalog／subagents 修正（Devin ×4、Kiro ×4、xAI ×3、models policy ×2、`09a86e1ab` pickerOrder、Antigravity 輪替、combo 429 冷卻、Eliza、`b0d275dc7` pool quota 證據、`2713b60e3` TOML） | 17 | defer（adoption pending）：整組隨 stable 採用，需 `bun run test` 分片驗證 |
| responses／streaming 修正（`470758088` SSE CR、`a207452b3`、`5444d343e`、`0328373fb`）與 macOS 專屬（`7f6b5b738` `5ea63751d` `ff1ce7e8c` `0202cc68e`） | 8 | defer 4；skip 4（macOS 專屬，fork 為 Windows 線） |

### 採用候選（adopt now）：缺陷已在 fork 程式碼中確認

「乾淨套用」指 `git show <sha> -- src bin tests | git apply --check` 對本 fork `HEAD` 通過（只檢查、未套用）。

| 優先 | 上游 commit | 缺陷證據（fork） | 影響檔案 | 大小與套用 |
| --- | --- | --- | --- | --- |
| 1 | `f5e9fdaba`（#6325）redaction 的 XML 屬性掃描有界化 | `src/lib/redact.ts:103-108` 的 XML 規則含 `(?=[^>]*?…)[\s\S]*`，對未閉合標籤是 O(n²)。實測 `redactSecretString("<a ".repeat(n))`：n=2000／4000／8000／16000 → 35／84／261／995 ms（每倍約 ×3–4）。這是 log 與上游錯誤本文的遮罩路徑，大型惡意或損壞本文會拖住事件迴圈。 | `src/lib/redact.ts`、`tests/lib/redact.test.ts`（另 `structure/transports/byte-accounting.md`） | src +54／−8、tests +65／−1；**乾淨套用**。fork 在此檔只改了 `sanitizeLogMetadataString`（:287–297），不重疊。 |
| 2 | `89db85ff0`（#6403）Windows manager 指令加 timeout | `src/service/windows-scheduler.ts:50-55` `runFile` 的 `execFileSync` 無 timeout；`src/lib/winsw.ts:180-181`（`runWinsw`）、`:195`（`scQc`）、`:268`（`queryScmForService`）與 `uninstallWinswService` 的 `sc stop/delete` 同。Task Scheduler／SCM 卡住時 CLI 會永遠掛住。 | `src/service/windows-scheduler.ts`、`src/lib/winsw.ts`、`tests/windows/winsw-stop-hardening.test.ts`、`tests/windows/windows-scheduler-install-verification.test.ts` | src +28／−6、tests +34；**乾淨套用**。fork 沒有 v2.68–74 的 guarded stop，所以收益只有「不會無限掛住」，判定語意不變。 |
| 3 | `09cd45daa`（#6395，closes #6288）npm cache root 檢查與 `--cache` 固定 | `src/update/npm-cache-preflight.mjs:165-167` `runNpmCachePreflight` 在 win32 直接回 `windows_skip`，dangling `npm-cache` junction 到 staged install 才以 ENOTDIR 失敗（此時 proxy 已停）；`src/update/transactional-install.mjs:446` 的 `install -g --prefix` 沒固定 `--cache`，會改變 npm globalconfig。 | `bin/ocx.mjs`、`src/update/npm-cache-preflight.{mjs,d.mts}`、`src/update/transactional-install.{mjs,d.mts}`、`tests/update/*` | 10 檔 +408／−41（src／bin 約 +190／−27）；**乾淨套用**，與 fork 在 `transactional-install.mjs` 的 lstat 修正（16 行）無衝突。只影響 npm-global 的 `ocx update` 路徑；本機服務 wrapper（`~/.opencodex/opencodex-service.cmd`，2026-09-26）指向 `%USERPROFILE%\opencodex\…`，該目錄目前不存在，本機是否走此路徑**未驗證**。 |
| 4 | `8a3a7762f`（#6391，closes #6290）service wrapper 容忍含括號的 locale 日期 | `src/service/windows-taskxml.ts:102`、`:109`（兩個 `if not exist … (` 區塊內的 `echo [%DATE% %TIME%]`）與 `:134`（`for … do (` 區塊內）。ko-KR／ja-JP 的 `%DATE%` 含 `)` 會提早結束區塊，wrapper 每次啟動都中止。本機 zh-TW `%DATE%` 為 `2026/10/03 週六`，**不會觸發**，所以優先度最低。 | `src/service/windows-taskxml.ts`、`tests/windows/windows-service-wrappers.test.ts` | src +14／−10、tests +58；**不乾淨**（`windows-taskxml.ts:101` hunk 失敗）：fork 的 wrapper 仍是 v2.67 形狀，缺 v2.68–74 的 `WINDOWS_WRAPPER_STAY_OUT_EXIT_CODE`／`goto stopped`，需手移植「把含 `%DATE%` 的 echo 移到頂層 label」。**移植時請用 `dev` 上後續 `115fa0322`（#6455，尚未進 main）的最終形**：`:backup_restored` 輸出固定字串，不要把 `%%B` 經 `OCX_RESTORED_BACKUP` 帶進 echo（該 commit 正是修這個）。 |

`21aed9fee`（#6441，wrapper 等待 npm Bun placeholder）疊在 `8a3a7762f` 的 label 結構上，且只對 npm 原地安裝有意義，判 defer；
若手移植 `8a3a7762f`，可一併評估。

### fork 自有 action item：`ocx-*` agent 說明（issue `#6358`，無上游修正）

- **缺陷**：`src/claude/agents-inject.ts:305` 的 `NO_MODEL_ARG` 對每個 `ocx-*` agent 寫入「Pass model: "haiku" as a placeholder」。
  當載入 `~/.claude/agents/ocx-*.md` 的 Claude Code session **沒有**經過 opencodex proxy（例如另一個 Claude Code／桌面 app session），
  該 `model` 參數會覆寫 agent frontmatter 的 pin，subagent 靜默跑真正的 Haiku，回報標籤卻仍是 GPT-6.1 Sol。
- **上游狀態**：`#6358` 於 2026-10-01 被 issue-template bot 以 `not_planned` 關閉，沒有修正 commit；
  `upstream/main`（`v2.76.0`）`src/claude/agents-inject.ts:309` 仍是同一句。
- **本機證據**：`~/.claude/agents/` 目前有 5 個 generated 檔（`ocx-gpt-6-1-sol`、`ocx-gpt-6-astra`、`ocx-gpt-6-luna`、`ocx-gpt-6-sol`、`ocx-self`），內文含該句，pin 為 `ocx-claude-native--…`／`claude-opus-5-5[1m]`。
  是否真的發生過替換**未驗證**。
- **建議**：fork 自行改文案（例如「請省略 `model` 參數；在 opencodex proxy 之外它會覆寫 pin」）並補測試，約 1–3 行；改完需重新產生已寫出的 agent 檔（屬 `~/.claude`，本輪未動）。
  `#6504`（OPEN，`/compact` 在 `ocx-claude-native--gpt-6.1-sol` 上 502）同樣走 `ocx-*` 路徑，但尚無修正。
- **命名／pin 變動**：本段 84 commits 對 `ocx-claude-native--` 前綴、`ocx-route` 標記、`generated-by: opencodex` 標記**零變動**（`git log -G` 查 `src/` 無結果）。

### 安全相關項目（含 defer／skip 的理由）

| commit | 內容 | 判定與理由 |
| --- | --- | --- |
| `58a26f0c1`（#6396，carry #6380） | policy fallback 的 redirect 可逃出原 eligible provider／model 集合 | defer，**高優先**。缺陷存在：`src/server/responses/policy-fallback.ts:188` 仍只以 `rankPolicyFallbackCandidates(initialTrace, tried)[0]` 選下一個，fork 缺 `policy-request-scope.ts`。不乾淨（`router.ts:89`、`core-options.ts:19` hunk 失敗），src 8 檔約 +190 行、tests +536。本機 `~/.opencodex/config.json` 無 policy／routing profile 字樣（只數 key 次數，0），實際暴露低。重審條件：啟用 policy routing，或整合 stable。 |
| `22c890c8d`（#6371） | Anthropic vision／web-search helper 改走 per-model 帳號路由 | defer。缺陷存在：`src/vision/anthropic-describe.ts:160`、`src/web-search/anthropic-executor.ts:171` 仍 `getValidAccessToken(providerName)`。僅在 Anthropic 帳號池啟用時有差別（`isAnthropicAccountPoolEnabled`）；本機 config 無 `accountPool`。不乾淨，11 檔。 |
| `0f6026ddc`（#6442）、`6256cb4f8`（#6376）、`de4b2e2a2`（#6373）、`459b4ec16`（#6372）、`a300b57c8`（#6443） | Claude 原生 metadata 綁定服務帳號、Kiro failover 後 continuation 重新綁定帳號、xAI Fast wire model 納入 allowlist、Antigravity 單次輪替、Claude 帳號池 429 | defer：皆為帳號池／授權邊界，與帳號池使用方式綁定，整組隨 stable；單挑會自行改寫。 |
| `6e5101115`（#6375） | owner registry 發佈改 no-follow、owner-only | defer（fork 缺 `src/config/owner-registry.ts`，缺陷尚未進入 fork）。與 fork 的 CWE-367 修正同方向；整合時要保留 fork 的 lstat 語意並跑 `tests/config/owner-registry-acl.test.ts`。 |
| `faf946e8b`（#6323） | command-code 專案 confinement 不再小寫化 Windows 路徑（`PROJECT` 可冒充專案目錄） | defer（fork 缺 `src/adapters/command-code-project-context.ts`，該檔隨 stable 才進來）。 |
| `742951354`（#6369）、`57fc9cc57`（#6315）、`b933aa292`（#6319）、`72e65439f`（#6368） | Gemini schema 正規化線性化、Devin 簽章 payload 有界、Cursor installer manifest 有界、model metadata 拒絕未配對 surrogate | defer：有界化／輸入驗證；`742951354`、`b933aa292`、`72e65439f` 的目標檔在 fork 不存在，`57fc9cc57` patch 不乾淨。 |
| `a9d5a80c2`（#6397，carry #6379） | census delegation 前驗證 service manager 身分 | defer：依賴 `src/config/serving-runtimes.ts` 的 v2.68–74 重構；本機單一服務，無多 runtime 委派情境。 |
| `4448e98a6`（#6398）、`328ce9581`（#6414） | spend ledger 拒絕原因具名、macOS 同步資料夾警告 | defer：診斷與 macOS 專屬，不放寬任何安全檢查。 |
| `6d84e4468`（#6402） | guarded stop 重新驗證穩定化 | defer。注意：fork 的 `src/service/managing-cli.ts:65-69`（CodeQL 修正）以字元白名單拒絕含空白的 shim 路徑，回 `unknown`（fail-closed），所以上游要修的「路徑含空白被 `cmd /c` 截斷」在 fork 不會發生；整合時不得為了套用該 commit 放寬這份白名單。 |

與 fork 已修過的檔案交集（本段 84 commits 對 fork 改過的 `src/` 檔案）：`src/lib/redact.ts`（`f5e9fdaba` 乾淨）、`src/update/transactional-install.mjs`（`09cd45daa` 乾淨）、
`src/service/windows-taskxml.ts`（`8a3a7762f` `21aed9fee`，fork 只改 `taskXmlWithoutCommentsAndCdata`，失敗原因是 wrapper 形狀而非該改動）、
`src/service/managing-cli.ts`（`6d84e4468`，見上）、`src/router.ts`（`58a26f0c1`，fork 只改變數名）、`src/adapters/anthropic.ts`（`7b2deb805` 乾淨，僅 thinking 預算）、
`src/codex/catalog/provider-models.ts`（`1c9227159` Zed，新功能）。沒有任何一筆會削弱 fork 的 symlink／lstat／FIFO／CWE-367 修正。
GUI 方面，`gui/src/i18n/zh-TW.ts` 與 fork 改過的 `gui/tests/{i18n-locales,jev-stats-panel,remote-link}.test.tsx` 會在 `10428d012`、`06cc3815c`、`933bd03cb`、`03ed9a3b1` 等 commit 被觸及，整合 stable 時按既有 locale 政策逐檔處理。

### Closed-unmerged PR（編號 > `#6316`；全部 163 筆中 99 merged、44 open、20 closed-unmerged）

| 分流 | PR | 結論 |
| --- | --- | --- |
| 已由 carry commit 落在 `main`（隨 stable 處理，不重放 PR head） | `#6379→a9d5a80c2`、`#6380→58a26f0c1`、`#6439→470758088`、`#6429 #6431 #6432 #6433 #6434 #6435 #6437 #6438→fc0f24a57`、`#6422→10428d012`、`#6339→6f2f6ae9c`（經 #6341）、`#6348`（併入 `#6302`，落地為 `06cc3815c`） | 同上表對應 commit 的判定 |
| superseded | `#6406`（`#6290` 的另一個修法，被 `8a3a7762f` 取代；維護者留言逐項核對過括號區塊內 `%VAR%` 展開） | 不另採 |
| 已落在 `dev`、尚未進 `main` | `#6463`（`f5572a003`）、`#6470`（`a85a43755`）、`#6471`（`9d3e6e252`） | 等進 `main` 再看；不從 `dev` 單挑 |
| 撤回／無 landing | `#6476`（作者撤回）、`#6421`（hygiene-blocked，無維護者回覆） | 無內容可採 |

44 筆 open PR 全是提案（多數 base 在 `dev`，另有 3 筆疊在 `codex/cli-*` 分支：`#6498` `#6500` `#6503`），不採用。與 fork 已強化範圍重疊、值得之後追的：
`#6460`（LazyCodex role mirror 讀取改 nonblocking descriptor、FIFO 回歸；與 fork 的 FIFO 修正同方向，該檔 `src/clients/omo-role-models.ts` 為 v2.75 新增）、
`#6453`（chatgpt bundle 還原前驗證信任）、`#6479`（Windows desktop Start at Login 路徑加引號，對應 issue `#6473`，fork 不出 desktop）、`#6477`（Tailscale 位址下 `ocx update` 停機判定）。

### Issue（編號 > `#6314`，共 26 筆：16 closed、10 open；`platform` 標籤 3 筆）

| Issue | 決定 | 理由與重審條件 |
| --- | --- | --- |
| `#6288` `#6290`（上一輪登記為 defer） | 觸發成立 → 見採用候選 3、4 | 兩者 2026-10-01 closed-completed；同批 `#6291`（macOS，對應 `0202cc68e`）、`#6196`（macOS）也已 closed-completed，皆 skip |
| `#6491`（Windows，closed `not_planned`） | defer | 排程工作被 `/Disable` 後 `ocx status` 報 stale、`ocx service repair` 回「not a recognized legacy OpenCodex definition」。**fork 有同一缺陷**：`src/service/windows-taskxml.ts:562`（`settings` 的 `Enabled` 必須為 `true`）與 `src/service/repair.ts:237`。上游被 template bot 關閉、無修正 commit。暫行解：`schtasks /Change /TN "\opencodex-proxy" /ENABLE`。重審條件：上游修正，或本機實際停用過排程工作。 |
| `#6473`（Windows desktop，open） | defer | HKCU Run 未加引號；draft 修正 `#6479` 未合併，且 fork 不出 desktop。 |
| `#6410`（macOS，closed） | skip | macOS `codex-restart` 跨 `CODEX_HOME`。 |
| `#6314`（macOS，REOPENED）、`#6135`（Bun 記憶體，needs-info；上一輪登記的舊 issue 複查） | defer | 仍 OPEN；`#6314` 只有診斷強化 `4448e98a6`。 |
| `#6358`（closed `not_planned`） | **fork action item** | 見上節。 |
| `#6492`、`#6502`、`#6504`、`#6456`、`#6469`、`#6478`、`#6499`、`#6386`、`#6387` | defer | 全部 OPEN 的功能請求或 provider 相容性問題，無修正；`#6502` 為 Windows 上 `google-antigravity/claude-sonnet-5-5` 404（上游 `#6497` 在處理目錄），`#6492` 為 service lease 診斷。 |
| 其餘 closed（`#6327 #6334 #6337 #6338 #6350 #6408 #6409 #6420 #6425 #6464 #6465 #6480 #6481`） | skip／follow-upstream | 功能請求、provider 目錄、template bot 關閉或已由對應 commit／`dev` 修正（例：`#6338`→`09a86e1ab`、`#6420`→`af358141e`）。`#6465` 的修正 `6ef255fd0`（#6466 carry）在 `dev`，尚未進 `main`。 |

### 分支

未逐條盤點（沿用前一輪結論）。本次 fetch 新出現 `upstream/codex/cli-ux-recovery`；`upstream/dev` 領先 `main` 81 個非 merge commit，
其中與本 fork 相關、尚未進 `main` 者：`115fa0322`（Windows wrapper backup 名稱不進 cmd log，採用候選 4 的後續）、
`0358e72c8`（#6453 bundle 信任驗證）、`1108236af`／`f54830340`（有界展開）、`2b01f50f1`（Scoop home 正規化）。下次 release 後再看。

### 水位

- stable tag / commit：`v2.76.0` / `249462bf570555aad103957025eea96f7489c7eb`
- PR：`#6507`
- issue：`#6504`


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

## 2026-11-05：全版 tag diff 重放 `v2.93.0..v2.97.0`（進行中；水位不動）

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
| 採用（重放後與 `v2.97.0` blob 逐位元相同） | 1563 | 含乾淨採用、新增檔，以及衝突全取上游者；每檔來源類別見 TSV 的 `fork_before` 欄 |
| 適配（重放後與上游不同，fork 保留／改寫部分 hunk） | 150 | 逐檔原因在 TSV 備註欄；安全邊界檔另見 `DECISIONS.md` 同日條目 |
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
| `client-link-stop`「a separate sync finishes before signal restoration (catalog)」（未解） | CI 還原後 catalog 為空，本機因 MSIX 的 history lock 命名空間無法重現；`src` 與上游相同 | 測試失敗時輸出子行程 stdout／stderr 與目錄清單（`link-sync-stop diagnostics`），待下一輪 CI 日誌定因 |

### 尚未完成（所以水位不動）

- 635 個被觸及的測試檔中，單獨跑完約 327 個後背景批次中斷，其餘約 308 個未跑；已跑檔案中的失敗檔與乾淨 `HEAD` 對照狀態見 `REVIEW.md` 或 `ROADMAP.md` 該列。
- gui 完整 `bun test --isolate tests`：370 個檔、3675 pass／5 fail，5 個失敗全在 `login-url-block`、`models-empty-provider`、`usage-custom-range`（計時型，系統滿載時發生），三檔單獨重跑 62 案全過。`docs-site` build、`tools/dev_check.ps1`、全量 `bun run test` 未跑。
- `tools/check-upstream-updates.ts --strict` 仍會因 `reviewed_through` 未推進而 exit 1。`integrated_tag`／`integrated_through`／`reviewed_*` 全部維持 `v2.93.0`／`88aaa754`。
