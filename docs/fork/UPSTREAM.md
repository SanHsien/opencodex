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

目前水位為 **2026-09-08**：已審查並合併上游 `v2.47.0` promotion 與 final roster correction
（`f7f890ff72a5ccccadb5a935c1ea106922562cd2`）、PR `#3943` 與 platform issue `#3661`。下一次只做增量檢查：

```powershell
git fetch upstream main --tags
bun tools/check-upstream-updates.ts --strict
```

報告會同時列出未審 commit、closed-unmerged PR 與水位之後的新 `platform` issue。處理完後推進相應水位，並把判斷寫進本檔。2026-09-06 的 ancestry-only bridge 已恢復共同祖先；後續採一般、範圍受限的上游審查與整合，不再重放 orphan history，且絕不推送上游。

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
