---
title: CLI 參考
description: 命令分派、離開碼，以及每個 ocx 命令家族的連結。
---

opencodex 的命令列工具是 `ocx`。它依第一個命令名稱分派，有記載的別名如
`setup`/`init`、`restore`/`eject`、`models`/`model` 都會到達相同操作。
未知命令與無效的命令形狀都是錯誤。

執行 `ocx help`（或 `ocx --help` / `ocx -h`）檢視頂層用法。對幫助表中註冊的命令，
執行 `ocx help <command>`、`ocx <command> --help` 或 `ocx <command> -h`。幫助與版本
命令均為只讀：它們不會啟動、停止、安裝、解除安裝或改寫 Codex／opencodex 狀態。

## 命令家族

### `ocx alias`

`ocx alias list [--json]` 顯示生效中的使用者別名與內建別名。使用 `ocx alias set <provider>[/<native-model-id>] <alias>` 與 `ocx alias rm <provider>[/<native-model-id>]` 編輯它們。原生模型 id 可能含有額外的斜線，因為選擇器只在第一個斜線處分割。使用 `ocx alias defaults on|off [--provider <name>]` 啟用內建預設別名。

### `ocx remote-workspace`

`ocx remote-workspace pair <hub-url> --pairing-code-stdin --root <absolute-path>` 把本機電腦註冊為僅限 OCX 的 Executor。重複 `--root` 可核准更多資料夾，使用 `--name` 可覆寫主機名稱。重複 `--toolchain-root <absolute-directory>` 可在命令沙箱內以唯讀方式公開使用者自行安裝的 Node、Rust、Go 或其他工具鏈目錄。在 macOS 與 Windows 的私有 dogfood 建置上，`bun run build:remote-workspace-helper` 會建立 pair 命令自動探索到的 Rust 輔助程式；`--executor-helper <absolute-file>` 可選擇另一個經明確審查的建置，並把其 digest 釘選進本機 Executor 狀態。`ocx remote-workspace agent` 維持出站的加密連線；`ocx remote-workspace status [--json]` 回報 Hub、裝置、roots 與宣告的能力，不會印出其 bearer 或私鑰。詳見 [Remote Workspace](/zh-tw/guides/remote-workspace/)。

- [生命週期](/zh-tw/reference/cli/lifecycle/) — 設定、代理與服務生命週期、健康狀態、
  診斷、目錄同步、儀表板與更新。
- [Providers、帳號與模型](/zh-tw/reference/cli/providers-accounts/) — provider 設定、
  認證、憑證池、配額、自訂模型、可見性、選定模型與 context 上限。
- [Agents、路由與整合](/zh-tw/reference/cli/agents/) — multi-agent 控制、combos、
  可觀測性、admission key、用戶端整合、執行環境設定、已驗證的設定，以及唯讀的
  Codex CLI 更新檢查。

## 無頭（headless）行為

管理命令往返於執行中代理的管理 API，使用記錄的執行環境埠與身分檢查，而非維護第二條
設定路徑。停止或無法連線的代理以 HTTP 503 呈現，並產生非零的 CLI 離開碼。明確記載為
離線設定操作的命令，可以在沒有執行中代理的情況下驗證與編輯設定檔。

`ocx system codex-cli-update check` 不需要執行中的代理，也不會向套件 registry 發出請求。它只會在限定範圍內檢查設定中的安裝候選項來源中繼資料，包括經過遮罩的可執行檔位置與所有權證據。正式發布的 launcher 所提供的可信內容只會驗證該候選項快照，並不證明 Codex 已成功執行。由於這個單次檢查命令絕不會執行 Codex，來自環境變數與持久化記錄的候選項只供報告（`managed: false`，通常為 `selection_unattested`）；JSON 輸出包含 `candidateAvailable`、`candidateVersion` 與 `candidateSource`，而 `selectionAttested` 維持 `false`。檢查設定中的安裝候選項時，必須有正式發布的 launcher 所提供的可信內容；直接使用 Bun 啟動或從原始碼執行時不具備這項證明，因此會忽略來自環境與持久化記錄的候選項狀態，並可能報告 POSIX 下的 `candidate_unavailable` 或 Windows 下的 `windows_inspection_deferred`。在 Windows 上，這個首個切片不會對候選路徑或設定路徑執行任何檔案系統 I/O。只有由可信 launcher 擷取的絕對環境候選項可以取得應用程式封裝或版本管理工具的純詞彙標籤；其他所有 Windows 候選項都會以失敗關閉方式處理。此命令不會安裝或修復軟體、不會執行 Codex 或 npm、不會控制執行中的程序，也不會寫入設定或快取狀態。

觀測 Windows x64 安裝的方式請參閱 [`attest` 命令](/zh-tw/reference/cli/agents/)。未提供明確路徑時，該命令會觀測由受證明約束的啟動器快照識別出的已選候選項；它不授予更新權限，也不證明執行階段選擇。

沒有歧義時，list 或 status 是預設。使用 `--json` 取得結構化快照，並以
`ocx observe logs --follow --jsonl` 取得串流的請求 log feed。佈景主題、語言、導覽與
其他純視覺的瀏覽器狀態沒有 CLI 對應；Cloudflare Tunnel 設定不在此命令集內。

## 存活探測上限覆寫

`ocx health`、`ocx status`、`ocx account *`、`ocx login codex` 與 `ocx ready` 透過短時存活探測尋找執行中的代理：預設每次 750 ms，停止與啟動判斷使用含重試的 1500 ms。若安全層（內容過濾器或 EDR 類網路擴充）替每個回送連線增加固定延遲，健康的代理可能來不及回應就已逾時。

在這類主機上可設定 `OCX_PROBE_TIMEOUT_MS` 提高上限，例如 `OCX_PROBE_TIMEOUT_MS=5000 ocx status`。值為 1 到 30000 的整數毫秒。覆寫只會提高上限：750 ms 預設值與 1500 ms 停止／啟動預算保留下限，因此 `1000` 只會延長預設探測。未設定、空值、小數、負數、0 或更大的值都會被忽略。

## 離開碼與確認

成功的命令離開 0。無效用法、未知命令或資源、失敗的 API 操作以及無法使用的必要服務
會以非零離開。`ocx health` 特別只在代理健康時離開 0，否則離開 1，因此可作為服務探針。
腳本應測試離開碼，而不是解析人類可讀的輸出。

具體的離開碼集中定義在單一位置，因此每個管理命令的結果一致：

| 碼 | 原因 |
|---|---|
| 0 | 成功 |
| 2 | 用法錯誤——引數錯誤、缺失或未知；沒有送出任何請求 |
| 4 | HTTP 404——指名的帳號、provider、金鑰或路由不存在 |
| 5 | HTTP 409——衝突；鎖被持有，或狀態已在底層變更 |
| 1 | 其他所有情況，包含傳輸失敗與其他 HTTP 錯誤 |

離開 0 代表沒有回報錯誤。預覽性質的動詞（例如未帶 `--yes` 的 `ocx storage cleanup`）同樣會離開 0 且不做任何變更。命令絕不會在印出錯誤的同時離開 0。

宣告需要確認的破壞性移除、匯入、信用消耗與更新操作，在非互動使用時需要 `--yes`。
該旗標是明確的 opt-in；省略它不得靜默確認該動作。

`ocx storage cleanup` 更進一步：未帶 `--yes` 時，它會執行預覽並印出*將會*釋放的內容，然後在沒有做任何變更的情況下離開 0。這些命令都沒有互動式確認——自動化呼叫端能回答的提示不是安全邊界，所以旗標本身才是邊界。

## 從 agent 驅動 CLI

`ocx capabilities --json` 是每個命令、它所驅動的管理路由、其旗標，以及是否會變更狀態的機器可讀索引。請從這裡開始，而不是解析說明文字：

```bash
ocx capabilities --json
ocx capabilities --mutating-only --json
ocx capabilities --route /api/logs
```

不相符的 `--route` 會離開 4，而不是回報空的成功。儲存庫在 `skills/ocx/` 出貨了更完整的操作指南，其介面對照表由同一份資料產生。

## 近期行為變更

以下是對先前錯誤回報自身結果之命令的修正：

- `doctor` 與 `sync-cache` 現在會在失敗時以非零離開。它們先前會印出失敗卻離開 0，導致腳本無法區分成功與失敗。
- 來自 `account` 的用戶端錯誤現在會把 HTTP 404 對應到離開碼 4、HTTP 409 對應到離開碼 5，而不是全部塌縮成 1。
- `--json` 現在在任何引數位置都會被遵循，包含 `ocx restore back --json`，該旗標先前會被接受卻遭忽略。
- `ocx logs --model` 現在真的會過濾。先前它會被接受並靜默忽略，導致輸出看起來像過濾過，實際上卻顯示每一列。
- `ocx storage` 新增了 `cleanup`、`trash` 與 `policy` 子命令。單獨的 `ocx storage` 仍會印出儲存報告，如同它先前作為 `ocx observe storage` 別名時的行為。

## 版本與內部分派目標

`ocx --version`、`ocx -v` 與 `ocx version` 會列印一行適合腳本使用的版本行並結束。

有兩個分派目標刻意不顯示在一般幫助中：`__refresh-version [preview]` 在分離的
程序中重新整理更新通知快取，`__gui-update-worker <job-id> [latest|preview] [restart]`
執行儀表板更新任務。它們是實作細節，不是穩定的使用者面向命令。儀表板會記錄 worker
PID、恢復 worker 已死但仍在進行中的任務、把超過十分鐘且沒有 PID 的舊 active 記錄
視為過期，並保護執行中的 worker 免受並行更新影響。
