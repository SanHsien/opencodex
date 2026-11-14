---
title: 遙測與隱私
description: 匿名每日使用統計、同意與代理邊界、停用控制、payload 預覽與收集器保留政策。
---

opencodex 內含匿名的每日使用遙測，讓維護者與社群得知實際上使用了哪些版本、平台、安裝管道、
provider 種類與粗略的模型家族，以及請求失敗發生在哪裡。專案層級的每日彙總（活躍與新增安裝數、
365 天活躍安裝熱圖、活躍分鐘數、請求結果、五個 bucket 的 token 總量、每日與區間的 provider 種類與
模型家族占比、前 50 名版本數、OS/CPU 平台與安裝管道計數，以及錯誤原因計數）由收集器唯讀的
`GET /v1/stats` 端點公開提供給[公開專案儀表板](/zh-tw/dashboard/)；每日安裝雜湊（`installDayHash`）
與速率限制雜湊（`ip_hash`）絕不會由 `/v1/stats` 回傳。

遙測**預設開啟**，且**在有人看過告知之前不會送出任何資料**。

> **本 fork 的建置不送出任何遙測。** 這個只支援 Windows 的 SanHsien/opencodex fork 採用了遙測程式碼，
> 但從不詢問同意、也從不送出：`src/telemetry/fork-policy.ts` 的 `forkTelemetryBlocked()` 預設為
> `true`，所有狀態讀取都會透過 `OCX_TELEMETRY` 覆寫回報遙測已停用，兩個對外模組（匿名送出器與公開
> 個人檔案客戶端）也拒絕呼叫 `fetch`。fork 的 MSI 同樣不顯示遙測頁。本頁其餘內容描述的是上游行為。

## 同意與預設開啟規則如何運作

全新安裝，或升級到含遙測的版本且沒有已儲存決定的既有安裝，會從 `awaiting-notice` 狀態開始。處於
`awaiting-notice` 時，代理不送出任何遙測。

只有在有人看過揭露內容或記錄了選擇之後，才會開始送出：

1. **Web 儀表板彈窗（`TelemetryConsentCard`）** — 在獨立或 Home 代理上，首次執行或更新後若沒有記錄
   決定、也沒有設定環境變數停用，就會開啟（已連線的 Remote Link Child 代理把遙測管理交給其 Home 代理）。
   **Share anonymous daily usage statistics** 核取方塊預設勾選。按下 **Continue** 會經由
   `PUT /api/telemetry` 儲存 `decision: "accepted"`（取消勾選則為 `"declined"`）、`decidedAt` 與
   `noticeShownAt`。以 Escape、背景或關閉按鈕關閉對話框，或只是載入頁面而未按 **Continue**，都**不會記錄
   任何東西**（`decision` 與 `noticeShownAt` 維持未設定，也沒有只記錄告知的端點）。在未決定期間，每次
   應用程式啟動或儀表板載入時彈窗都會再出現，直到你按下 **Continue**，或在 **Proxy details** 或 CLI
   記錄選擇。
2. **互動式終端機提示** — `ocx start`、`ocx init` 與 `ocx service install` 會先印出揭露區塊（會送出
   什麼、絕不送出什麼、專案層級彙總公開於 `opencodex.me/dashboard`、如何以 `ocx telemetry status --json`
   檢視確切 payload，以及如何以 `ocx telemetry disable`、`OCX_TELEMETRY=0`、`DO_NOT_TRACK=1` 或
   **Proxy details** 開關關閉遙測），然後在 stdin 與 stdout 皆為互動式 TTY（`isatty`）、未設定
   `OCX_SERVICE` 且 `isAgentDriven()` 為 false 時，詢問一次 `Share anonymous usage statistics? [Y/n]`。
   按 Enter 或 `y` 會記錄 `decision: "accepted"`（加上 `decidedAt` 與 `noticeShownAt`）；`n` 會記錄
   `decision: "declined"`。
3. **明確啟用** — 在儀表板 **Proxy details** 開啟 **Share anonymous usage statistics** 會立即記錄
   `decision: "accepted"`（面板已顯示會送出什麼）。在互動式的人類終端機（stdin 與 stdout 皆為 TTY、
   非 `OCX_SERVICE`、非 `isAgentDriven()`）執行 `ocx telemetry enable [--json]` 會印出相同的揭露區塊，
   詢問 `[Y/n]` 確認（預設為是），確認後記錄 `decision: "accepted"`。

`resolveTelemetryStatus`（`src/telemetry/consent.ts`）依下列精確的優先順序評估有效狀態：

| 條件（第一個符合者優先） | 有效狀態 | 狀態 `reason` |
| --- | --- | --- |
| `OCX_TELEMETRY` 為 `0`、`false`、`off` 或 `no` | 停用 | `env-ocx-telemetry` |
| `DO_NOT_TRACK` 為 `1`、`true` 或 `yes` | 停用 | `env-do-not-track` |
| `telemetry.decision === "declined"` | 停用 | `declined` |
| `telemetry.decision === "accepted"` | 啟用 | `accepted` |
| `telemetry.decision` 未設定且 `telemetry.noticeShownAt` 已設定 | 啟用 | `default-on` |
| `telemetry.decision` 未設定且 `telemetry.noticeShownAt` 未設定 | 停用 | `awaiting-notice` |

## 代理驅動的啟動永遠不會啟用遙測

AI 程式碼代理或自動化工具絕不能代你回答遙測提示或確認揭露：

- 當 `ocx start`、`ocx init` 或 `ocx service install` 在代理或 CI 環境（`CLAUDECODE`、
  `CODEX_THREAD_ID`、`CURSOR_TRACE_ID`、`CI` 等由 `isAgentDriven()` 檢查的標記）、非 TTY shell 或背景
  服務（`OCX_SERVICE=1`）下執行時，opencodex 會略過提示，每個版本最多印出一次單行通知（記錄於
  `<OPENCODEX_HOME>/.telemetry-deferred`），且**既不**寫入 `noticeShownAt` 也不寫入 `decision`。
  該安裝維持在 `awaiting-notice`，在你自行使用儀表板或代理之外的終端機工作階段之前不會送出任何資料。
- `PUT /api/telemetry` 需要有效的人類儀表板瀏覽器工作階段（`hasHumanDashboardSession`）。只用管理員
  token 或記住裝置工作階段認證的請求會被以 HTTP `403`（`code: "agent_consent_required"`）拒絕。
- `ocx telemetry enable` 需要互動式的人類終端機（stdin 與 stdout 皆為 `isatty`、非 `OCX_SERVICE`、
  非 `isAgentDriven()`）。否則會以非零（`1`）結束，回傳 `agent_consent_required` 或 `tty_required`，並
  引導你到儀表板。
- `ocx config set telemetry` 與 `ocx config unset telemetry` 對所有呼叫者都會被拒絕，`ocx config import`
  對每個呼叫者都會忽略匯入的 `telemetry` 區塊，並保持已儲存的 `telemetry` 設定不變。
- 以 `ocx telemetry disable`、`OCX_TELEMETRY=0` 或 `DO_NOT_TRACK=1` 停用永遠被允許，包含從腳本與代理
  工作階段執行。

如同 GitHub 加星，這些檢查針對代理工具（`AGENT_ENV_VARS`）與管理員 token 呼叫者，保護標準 CLI 與管理
API 路徑；並搭配政策規則：以你的本機使用者身分執行的代理，絕不可編輯 `config.json`，或建立回送工作階段
來代你記錄同意。

## 如何關閉遙測

你隨時都可以透過下列任一控制停用遙測：

1. **Windows 安裝程式** — 上游的 MSI 有一個頁面，含此摘要、[隱私聲明](/zh-tw/reference/code-signing/#privacy)
   連結，以及預設勾選的 **Send anonymous usage statistics** 核取方塊。取消勾選，或在靜默 `msiexec /qn`
   安裝時傳入 `OCX_TELEMETRY_CHOICE=optout`，桌面應用程式會在電腦上每個帳號第一次啟動它時、在解析或啟動
   任何代理之前儲存 `"decision": "declined"`（全新安裝時，在 `config.json` 存在之前，該拒絕會保存在
   `telemetry-state.json`，因此 `ocx init` 仍會執行設定）。這個選擇是針對整台電腦記錄的，因此也涵蓋由
   管理員或部署工具執行的靜默安裝，且應用程式內更新會保留它（只有 `send` 會保持遙測開啟；任何大小寫的
   `optout` 或其他任何值都會關閉遙測）。每個帳號的停用只套用一次：執行較新的安裝程式並在不更動核取方塊
   的情況下繼續，會保持先前的決定，所以不會再覆蓋你之後在儀表板做出的選擇。若儲存失敗，應用程式啟動的
   代理會以 `OCX_TELEMETRY=0` 執行，應用程式會在背景與下次啟動時重試。保持勾選本身不會開始送出，也絕不會
   讓已關閉遙測的帳號重新開啟；下方的彈窗仍會先出現。由 `ocx service install` 安裝的背景服務可能在登入時
   不經應用程式就啟動代理，因此後來的安裝程式記錄的停用，會在應用程式下次啟動時才傳達到它；請執行
   `ocx telemetry disable` 立即停止。**本 fork 的 MSI 沒有這個頁面。**
2. **GUI 同意彈窗** — 首次執行或更新後對話框出現時，取消勾選 **Share anonymous daily usage statistics**
   並按 **Continue**。
3. **Proxy details 開關** — 開啟 [Web 儀表板](/zh-tw/guides/web-dashboard/)的 Overview 頁，前往
   **Proxy details** 底下的 **Telemetry** 區段（`#proxy-telemetry`），關閉 **Share anonymous usage
   statistics**。
4. **CLI 指令**：

   ```bash
   ocx telemetry disable
   ```

   這會把 `"decision": "declined"` 寫入 `config.json`，並在該拒絕確實持久化之後刪除
   `<OPENCODEX_HOME>/telemetry-id.json`。若 `ocx telemetry enable` 或 `ocx telemetry disable` 期間
   `mutatePersistedConfig` 回傳 `unavailable` 或拋出例外，CLI 會以非零結束並給出可採取行動的錯誤，不印出
   成功訊息，且除非拒絕已持久化，否則不會刪除 `telemetry-id.json`。
5. **`OCX_TELEMETRY=0`** — 在代理環境設定 `OCX_TELEMETRY=0`（或 `false`、`off`、`no`，不分大小寫）。
6. **`DO_NOT_TRACK=1`** — 在代理環境設定 `DO_NOT_TRACK=1`（或 `true`、`yes`，不分大小寫）。

這兩個環境變數只會影響繼承它們的代理。以背景服務（透過 `ocx service install` 的 systemd、launchd 或
Task Scheduler）執行的代理看不到你在互動式 shell 匯出的變數；請把它們設定在服務自己的環境，或使用上面的
持久性控制。`ocx telemetry status` 會詢問執行中的代理，因此顯示的是該代理實際使用的狀態。

兩個環境變數都會立即覆寫 `config.json`，且不修改已儲存的檔案。每當觀察到 `OCX_TELEMETRY` 或
`DO_NOT_TRACK` 停用——在代理啟動時的 `src/server/background-lifecycle.ts`（即使排程器計時器未啟動）以及
每個排程器週期——opencodex 也會透過原子的 no-follow 寫入，在 `<OPENCODEX_HOME>/telemetry-state.json`
持久化設為今天 UTC 日期（`YYYY-MM-DD`）的 `ineligibleThroughDay` 與 `envOptOutActiveSince` 標記，並刪除
`<OPENCODEX_HOME>/telemetry-id.json`。以該變數啟動的代理只讀取一次，因此該標記涵蓋該代理持續執行的每一天。
停用期間在該代理乾淨停止時結束；若它崩潰，則在第一個沒有該變數的排程器週期結束；無論哪種情況，
`ineligibleThroughDay` 都會移到那一天。若你之後移除環境變數，停用所涵蓋的任何一天（包含結束的那一天）
都絕不會被送出，且下次有資格送出時會產生新的安裝 ID。只要任一變數存在，儀表板開關就會停用並標明目前
生效的變數。

## 如何查看確切的 payload

`GET /api/telemetry` 與 `ocx telemetry status [--json]` 會為**排程器下次會送出的同一個已完成 UTC 日**
建立 `preview`（7 天視窗內最舊的、有資格且未送出的 UTC 日，帶 `previewEligible: true`）。當目前沒有已完成
的 UTC 日有資格送出（例如給予同意之前、記錄同意的那個 UTC 日、停用期間，或所有有資格的日子都已送出），
快照會預覽最近一個已完成的 UTC 日供檢視，並回傳 `previewEligible: false`，因此絕不暗示該日會被送出：

- **CLI（人類可讀＋JSON 預覽）**：

  ```bash
  ocx telemetry status
  ```

- **CLI（機器可讀快照）**：

  ```bash
  ocx telemetry status --json
  ```

  代理執行中時這會查詢 `GET /api/telemetry`；代理停止時，會從 `config.json` 與 `usage.jsonl` 在本機建立
  相同的快照。
- **Web 儀表板** — 在首次執行／更新後的同意對話框內，或 **Proxy details** 的 **Share anonymous usage
  statistics** 開關旁，點選 **Preview the JSON**，檢視 **What is sent** / **Never sent** 摘要與確切的
  JSON payload。

在第一份報告送出之前——或遙測停用且 `telemetry-id.json` 被移除之後——磁碟上沒有本機安裝 ID，所以預覽中的
`installDayHash` 顯示為 64 個零（`0000000000000000000000000000000000000000000000000000000000000000`）。

## 會收集什麼

每份報告涵蓋一個已完成的 UTC 日曆日（`YYYY-MM-DD`），並在離開代理之前與在收集器上，都由
`validateTelemetryPayloadV1`（`src/telemetry/contract.ts`）驗證。未知的鍵與不在下列封閉詞彙內的字串都會
被拒絕。

以下是 `buildTelemetryPayloadV1`（`src/telemetry/payload.ts`）產生的真實範例 payload：

```json
{
  "schemaVersion": 1,
  "batchId": "c2bf1164-d009-4111-a8a6-902d55f727c7",
  "day": "2026-11-06",
  "installDayHash": "456b15e3a95d8665bbd9a40ac2cae49986aec3f03b78b6dd601df49abfc406d4",
  "newInstall": false,
  "env": {
    "version": "2.99.0",
    "releaseChannel": "latest",
    "os": "darwin",
    "arch": "arm64",
    "installChannel": "npm-global"
  },
  "activeMinutes": 312,
  "requests": {
    "completed": 840,
    "failed": 12,
    "incomplete": 3,
    "aborted": 5
  },
  "models": [
    {
      "providerKind": "anthropic",
      "modelFamily": "claude-opus",
      "requests": 400,
      "inputTokens": 184200,
      "cacheReadTokens": 6410000,
      "cacheWriteTokens": 512000,
      "outputTokens": 96400,
      "reasoningTokens": 28100
    },
    {
      "providerKind": "chatgpt",
      "modelFamily": "gpt-6",
      "requests": 460,
      "inputTokens": 210500,
      "cacheReadTokens": 5890000,
      "cacheWriteTokens": 0,
      "outputTokens": 112300,
      "reasoningTokens": 44800
    }
  ],
  "errors": {
    "rate-limit": 7,
    "upstream-fault": 5
  }
}
```

| 欄位 | 內容 |
| --- | --- |
| `schemaVersion` | 固定整數 `1`。 |
| `batchId` | 建立 payload 時產生的隨機 UUID v4。 |
| `day` | 已完成的 UTC 日曆日期（`YYYY-MM-DD`），在最近 7 個已完成的 UTC 日之內。 |
| `installDayHash` | `sha256(installId + ":" + day)`，64 個小寫十六進位字元。每個 UTC 日輪替。 |
| `newInstall` | 只有在目前本機 `telemetry-id.json` 送出的第一份報告為 `true`，之後為 `false`。 |
| `env.version` | 符合 `^\d+\.\d+\.\d+(-preview\.\d{8}(\.\d+)?)?$` 的版本（例如 `2.40.1`、`2.6.15-preview.20260701`、`2.6.15-preview.20260701.1` 或 `2.7.9-preview.20260712.2`）；任何 `+build` 中繼資料會被客戶端移除，並被 `validateTelemetryPayloadV1` 拒絕。 |
| `env.releaseChannel` | `"latest"` 或 `"preview"`。 |
| `env.os` | `"darwin"`、`"linux"`、`"win32"` 或 `"other"`。 |
| `env.arch` | `"x64"`、`"arm64"` 或 `"other"`。 |
| `env.installChannel` | `"npm-global"`、`"pnpm-global"`、`"bun-global"`、`"mise"`、`"standalone"`、`"desktop"`、`"docker"`、`"source"` 或 `"unknown"`。 |
| `activeMinutes` | `day` 當天在 `usage.jsonl` 中至少記錄了一個請求的相異 UTC 分鐘數（`0`–`1440`）。 |
| `requests` | 依封閉結果類別的請求計數：`completed`、`failed`、`incomplete` 與 `aborted`。 |
| `models` | 每天最多 64 列，依下方封閉名冊中唯一的 `(providerKind, modelFamily)` 配對分組（若一天出現超過 64 組，保留依請求與總 token 排序的前 63 列，其餘合併為 `"other"` / `"other"`）。多次嘗試的 `combo` 請求會把每次嘗試歸到底層 provider 與模型，所以 `models[].requests` 的總和可能大於頂層 `requests`。每列回報 `requests` 與五個互斥的 token 計數器——`inputTokens`（未快取輸入）、`cacheReadTokens`、`cacheWriteTokens`、`outputTokens`（非推理輸出）與 `reasoningTokens`——其總和等於該請求顯示的總 token（`usageDisplayTotalTokens`）。 |
| `errors` | 以封閉失敗原因名冊為鍵的未完成請求計數（`transport-unsent`、`transport-ambiguous`、`upstream-declined`、`rate-limit`、`quota-exhausted`、`credential-rejected`、`policy-refusal`、`parameter-rejected`、`ciphertext-refusal`、`payload-too-large`、`payload-rejected`、`upstream-fault`、`empty-output`、`client-cancelled`、`local-refusal`）。 |

封閉的 `providerKind` 值（26 個）：`openai`、`chatgpt`、`anthropic`、`claude-subscription`、`google`、`vertex`、`xai`、`deepseek`、`moonshot`、`qwen`、`zai`、`minimax`、`mistral`、`openrouter`、`groq`、`cerebras`、`together`、`fireworks`、`cursor`、`kiro`、`copilot`、`devin`、`ollama`、`lmstudio`、`local-other`、`other`。

封閉的 `modelFamily` 值（19 個）：`gpt-6`、`gpt-5`、`gpt-4`、`o-series`、`codex`、`claude-opus`、`claude-sonnet`、`claude-haiku`、`gemini-3`、`gemini-2`、`grok`、`deepseek`、`qwen`、`kimi`、`glm`、`minimax`、`mistral`、`llama`、`other`。

## 絕不會收集什麼

opencodex 絕不會在遙測 payload 中包含下列任何內容：

- 提示、completion、推理軌跡、工具參數，或任何請求或回應本文。
- API 金鑰、OAuth 存取或更新 token、工作階段 cookie，或管理／資料平面 token。
- 帳號 ID、電子郵件地址、組織識別碼，或帳單／方案細節。
- 使用者自訂的 provider 名稱或鍵、不在上述封閉 `modelFamily` bucket 內的自訂模型 ID（未知模型對應到
  `"other"`），或自訂 `baseUrl` 與代理 URL。
- 主機名稱、本機或上游 IP 位址、MAC 位址、硬體序號、工作目錄或檔案路徑。
- 原始或自由格式的上游錯誤訊息或堆疊追蹤。
- 記錄同意或揭露的那個 UTC 日曆日（`formatUtcDay(decidedAt ?? noticeShownAt)`）或更早任何 UTC 日的使用量——只有嚴格晚於同意／揭露日的已完成 UTC 日曆日（`day > formatUtcDay(decidedAt ?? noticeShownAt)`）才會被送出。
- 被 `OCX_TELEMETRY=0` 或 `DO_NOT_TRACK=1` 停用所涵蓋的任何 UTC 日曆日的使用量，包含以其啟動的代理持續執行的每一天與停用結束的那一天（`day <= ineligibleThroughDay`，且在設定 `envOptOutActiveSince` 期間完全不送）。

## 公開個人檔案與排名（選擇加入）

與上述匿名遙測分開，你可以連接**公開個人檔案**，出現在[排行榜](/zh-tw/dashboard/#leaderboard)，並查看自己的
使用量在最近一天、一週與一個月的排名。除非你自己連接，否則它是關閉的，且絕不改變你的匿名遙測選擇；連接
需要匿名遙測為開啟，因為個人檔案的總量來自同一份本機每日彙總。

- **連接**：從儀表板 Home 的 *Public profile & rank* 卡片，或在互動式終端機以
  `ocx telemetry profile connect --handle <handle> [--name <display name>] [--avatar <colour>]`（提示預設為
  否）。你選擇 handle（3–24 個小寫字母、數字或連字號）、顯示名稱，以及固定色盤中的頭像顏色。不會要求電子
  郵件地址或帳號。收集器回傳一個 secret，代理將其儲存在 `<OPENCODEX_HOME>/telemetry-profile.json`
  （模式 `0600`）；它不會被儀表板 API 顯示、列印或回傳，收集器只保留其 SHA-256 雜湊。如同遙測決定，連接
  會被代理（`agent_consent_required`）、非互動式終端機（`tty_required`）與記住裝置的儀表板工作階段拒絕。
- **公開的內容**：handle、顯示名稱與顏色、你的排名，以及每天的請求數、五個 token bucket，與各模型家族
  （封閉的 `modelFamily` 清單）的請求與 token 總量。收集器的個人檔案與排行榜回應帶有
  `x-robots-tag: noindex`；[儀表板](/zh-tw/dashboard/#leaderboard)頁面在瀏覽器中呈現它們，且本身是公開頁面。
- **送出的內容**：每個嚴格晚於你連接當天的已完成 UTC 日送出一次，每個週期最多一天、最多回溯 7 天，以
  `POST /v1/profiles/me/days` 送出恰好這些總量。個人檔案提交不帶安裝 ID、安裝日雜湊、批次 ID、版本、平台、
  安裝管道、provider 名稱或種類、錯誤、提示、輸出、金鑰、帳號或路徑，並以自己的計時器執行。匿名遙測關閉時
  （`OCX_TELEMETRY=0`、`DO_NOT_TRACK=1`、已拒絕或等待告知）不會送出任何東西；個人檔案保持連接，在遙測重新
  開啟時恢復。
- **查看**：`ocx telemetry profile status` 顯示個人檔案、下一個會送出之日的摘要與你的排名；
  `ocx telemetry profile status --json` 以 `preview` 包含確切 payload。卡片顯示個人檔案與排名。
- **隨時中斷連接**：從卡片或以 `ocx telemetry profile disconnect`（永遠允許，包含代理、代理已停止與遙測
  關閉時）。它會在收集器上刪除個人檔案及其提交的每一天。若無法連到收集器，刪除會維持待處理，不再送出任何
  資料，代理會在每個週期與下次啟動時重試。中斷後再重新連接也是更換 secret 的方法。
- **排名**：對每個期間，收集器對總量為正的個人檔案使用標準競賽排名（平手共享名次）。總量是自行回報的，
  並檢查一致性與每日上限，每天只接受一次，且該日第一次提交優先。
- **濫用控制**：保留 handle、1–32 個字母、數字、空格與 `. _ ' -` 且不能看起來像網址的顯示名稱、每個網路
  每小時五次建立個人檔案、每個個人檔案的提交限制、從不提交的個人檔案 14 天後移除，維護者可以從所有公開
  檢視中隱藏個人檔案。
- **以 GitHub 登入**目前尚未提供：它需要維護者尚未建立的 GitHub OAuth app。

## 儲存、保留與收集器原始碼

- **本機安裝 ID 與每日雜湊輪替** — 遙測送出第一份報告時，代理建立 `<OPENCODEX_HOME>/telemetry-id.json`
  （模式 `0600`），內含隨機 UUID v4。原始 UUID 絕不離開你的機器；每份報告只送出
  `sha256(installId + ":" + day)`。因為 UTC 日期與 UUID 一起雜湊，安裝的雜湊每天都會改變，伺服器端無法
  跨日連結。拒絕遙測，或以 `OCX_TELEMETRY=0` 或 `DO_NOT_TRACK=1` 執行，會立即刪除 `telemetry-id.json`，
  之後重新啟用會產生新的 UUID。
- **串流式單日彙總** — `src/telemetry/aggregate.ts` 透過 `scanUsageLedgerCooperatively` 掃描
  `usage.jsonl`，只在目標 UTC 日的 `onEntry` 回呼內累計計數器；它從不在記憶體中保留帳本列。
- **背景排程與不回補** — unref 的背景計時器（`src/telemetry/scheduler.ts`）在啟動後執行一次（30–60 秒
  抖動），之後每 6 小時（含抖動）執行，完全不在請求路徑上。每個週期帶有一個 `AbortSignal`，於關閉
  （`stopProcessLoops`）或同意改變（`nudgeTelemetryScheduler`）時取消，從磁碟重新讀取 `config.json`，且每個
  週期最多送出**一個**已完成的 UTC 日（最舊的未送出日優先，在最近 7 個已完成 UTC 日內），以 10 秒逾時送到
  `https://telemetry.opencodex.me/v1/events`。只有嚴格晚於同意／揭露 UTC 日
  （`day > formatUtcDay(decidedAt ?? noticeShownAt)`）且嚴格晚於 `ineligibleThroughDay`
  （`day > ineligibleThroughDay`）的已完成 UTC 日曆日才會被送出。在傳送之前，排程器會重新讀取已持久化的
  同意與環境變數，若遙測不再有效就中止而不送出。若收集器回傳 HTTP `429` 或 `503`，客戶端會在
  `<OPENCODEX_HOME>/telemetry-state.json` 持久化 `retryAfterUntil` 並略過週期直到該時間：有 `Retry-After`
  標頭時遵守，否則退避約 15–20 分鐘。`telemetry-state.json` 中已送出的日期標記在 30 天後修剪。若收集器尚未
  部署或無法連線，10 秒的送出嘗試會在背景安靜地失敗，不影響代理流量，也不會把該日標記為已送出。
- **每個安裝每天一份報告** — 收集器在 `daily_installs`、`daily_totals`、`daily_models` 與 `daily_errors`
  之間，以單一原子條件式 D1 批次對 `(day, install_day_hash)` 去重。對相同的 `installDayHash` 重送同一天是
  no-op，絕不重複計算。
- **用於速率限制的加鹽每小時雜湊（不儲存原始 IP 位址）** — 收集器從不儲存原始用戶端 IP 位址。為了濫用
  速率限制（每個鍵**每小時 120 份報告**，為共享 NAT／CGNAT 位址設計，回傳帶 `Retry-After` 的 HTTP
  `429`），ingest 只從 Cloudflare 的 `cf-connecting-ip` 推導鍵（IPv4 位址原樣，IPv6 位址收斂到 /64 前綴，
  讓單一主機無法輪替繞過限制；忽略 `x-forwarded-for`），與必要的祕密鹽值及目前 UTC 小時一起雜湊
  （`sha256(RATE_LIMIT_SALT + "\0" + bucketHour + "\0" + key)`）存入 `rate_limits`，每小時的排程工作
  （`15 * * * *`）會在約 2 小時 15 分鐘內刪除每個 bucket。
- **安裝日、小群組保護與未驗證的自行回報數字** — 因為 `installDayHash` 每個 UTC 日輪替，
  `GET /v1/stats` 的 `totals.activeInstalls` 與各分項的 `installs` 計數衡量的是**安裝日**（所選區間內每日
  回報安裝數的總和），而 `totals.avgDailyActiveInstalls` 回報 `install-days / 區間天數`，四捨五入到小數
  一位（儀表板顯示為 **Avg daily active installs**，tooltip 內含安裝日）。小群組保護是依天、依相異安裝套用：
  分項列（`providers`、`models`、`versions`、`platforms`、`channels`、`errors` 與 `dailyByProvider` 的每一天）
  只有在當天至少 **10 個相異安裝**回報該鍵時才包含該日的值，之後才把各日加總進所選區間。因此單一安裝無法
  藉由多天回報或透過多個 provider 或模型家族獨自達到門檻（`daily_models`、`daily_errors`、
  `daily_provider_installs` 與 `daily_family_installs` 對每個鍵每份報告只計一次）。低於門檻的版本、平台與
  管道列會併入當天的 `"other"`，只有達到 10 才發布；低於門檻的 provider、模型與錯誤列會被捨棄。
  `totals`、`daily` 與 `heatmap` 維持未過濾，所以被隱藏的值仍可從公布的總量以相減方式近似。此外，送到
  `POST /v1/events` 的報告**未經驗證**，可以在每鍵速率限制與 payload 範圍內被偽造。偽造的報告也可能把真實
  安裝推過門檻：同一天對罕見鍵的 9 份偽造報告加上一個真實安裝就成為 10 個相異安裝，送出者可以扣掉自己的
  份額來還原該安裝對該鍵的數字。安裝仍然匿名，速率限制提高成本但不能阻止它。公開儀表板因此把所有數字標示為
  **"self-reported by opencodex installs"**。
- **每日彙總保留** — `daily_installs` 列（只含每日雜湊、版本、發行管道、OS、CPU 架構、安裝管道、
  `new_install` 與 `active_minutes`）在 400 天後修剪；`daily_totals`、`daily_models` 與 `daily_errors` 只含
  專案層級的每日計數器，沒有每個安裝的列，並無限期保留。
- **收集器優先的合約推出與可稽核的原始碼** — 客戶端實作位於
  [`src/telemetry/`](https://github.com/lidge-jun/opencodex/tree/main/src/telemetry)，Cloudflare Worker + D1
  收集器位於
  [`services/telemetry-collector/`](https://github.com/lidge-jun/opencodex/tree/main/services/telemetry-collector)。
  兩者都匯入 `src/telemetry/contract.ts` 的封閉名冊，因此任何名冊或線上合約的新增都採用**收集器優先
  （collector-first）**的推出方式（先部署到收集器，之後客戶端版本才會送出）。
  `config.json` 結構與環境變數請見[伺服器與執行階段設定](/zh-tw/reference/configuration/server/#遙測telemetry)。
