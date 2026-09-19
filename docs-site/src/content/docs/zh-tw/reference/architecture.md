---
title: 架構
description: opencodex 內部機制 —— 模組圖、請求解析器、AdapterEvent 橋接與快取。
---

opencodex 執行在單個 Bun 程序中。請求以 OpenAI Responses 格式進入，規範化為內部模型後完成
路由，再由 adapter 傳送到 provider，最後橋接回 Responses SSE。端到端流程參見
[運作原理](/zh-tw/getting-started/how-it-works/)。

## 模組圖

```text
src/
├── cli/                # ocx command dispatch, init, status, provider commands
├── server/             # Bun.serve, /v1/* proxy, /api/* management API, WS bridge
├── codex/              # Codex config injection, catalog sync, auth/account integration
├── providers/          # provider metadata, API-key pool, quota and labels
├── adapters/           # wire adapters, shared guards/utilities, Cursor protobuf transport
├── oauth/              # OAuth providers, API-key catalog, token store/refresh
├── usage/              # request usage extraction, JSONL logs, summaries, totals
├── lib/                # runtime, process, retry, privacy, token estimate helpers
├── web-search/         # web-search sidecar (synthetic tool, loop, executor, parser)
├── vision/             # vision sidecar (describe + plan)
├── config.ts           # ~/.opencodex/config.json, defaults, PID, env resolution
├── router.ts           # model id → provider + adapter
├── bridge.ts           # AdapterEvent stream → Responses SSE / JSON
├── reasoning-effort.ts # reasoning-effort translation, clamping, and catalog levels
├── responses/
│   ├── parser.ts       # Responses request → OcxParsedRequest
│   ├── schema.ts       # Zod validation
│   └── compaction.ts   # remote compaction prompts, envelopes, compact history
├── service.ts          # launchd / systemd / Task Scheduler background service
├── types.ts            # core interfaces + helpers (modelInList, namespacedToolName)
└── index.ts            # public entry
```

原先的三個大型入口檔案現在是相容性 facade：`codex/catalog.ts` 匯出 7 個
`codex/catalog/*.ts` 模組，`server/management-api.ts` 分派到 9 個
`server/management/*.ts` 模組，而 `server/responses.ts` 匯出 5 個
`server/responses/*.ts` 模組。

## 請求流程

`server/index.ts` 負責 HTTP 邊界，並把 Responses data plane 交給 `server/responses.ts` facade
及其 `server/responses/*.ts` 模組：

1. `server/index.ts` 應用 CORS 和 API 認證，在 drain 期間拒絕新請求，並記錄請求生命週期
   metadata。它提供 `GET /v1/models`、`POST /v1/responses`、
   `POST /v1/responses/compact`、`POST /v1/images/generations` / `POST /v1/images/edits`
   （供 Codex 內建 `image_gen` 工具使用——由 `server/images.ts` 中繼到 OpenAI 繫上遊）、
   `POST /v1/live` / `POST /v1/realtime/calls`（ChatGPT / Codex App 語音與 OpenAI Realtime
   建連，由 `server/live.ts` 中繼）、`/v1/live/{callId}` 旁路 WebSocket，
   以及 `/v1/responses` 上可選的 WebSocket upgrade。
2. `server/responses/core.ts` 解壓並解析 JSON；如果本機記住了對應輸入，則展開
   `previous_response_id`，隨後呼叫 `responses/parser.ts`。
3. `router.ts` 解析 bare id 或 `provider/model` id。server 隨後確定 Codex account affinity，
   必要時重新整理 provider OAuth，並把選中的 credential 應用到 route。
4. 主請求發出前，`vision/` 會為 `noVisionModels` 中的模型描述圖像。如果沒有安全的 sidecar
   路徑，則移除圖像，而不是把它傳送給純文字上游。
5. `server/adapter-resolve.ts` 應用模型級 wire override，並構造已註冊 adapter 之一。Responses
   passthrough 直接轉發原始 body；Cursor 執行雙向 `runTurn` transport；其餘轉換型 adapter
   則建置、取得並解析上游請求。
6. 路由模型請求託管的 `web_search` 工具時，`web-search/` 會暴露一個合成函式，經設定的後端
   （OpenAI/ChatGPT sidecar 或 Anthropic）執行真實搜尋，把結果送回路由模型，並在設定的迴圈
   上限內重複。這個迴圈只支援標準 HTTP 路徑；實作 `runTurn` 的 adapter（例如 Cursor）會繞過它。
7. `bridge.ts` 生成 Responses SSE 或 JSON。`server/request-log.ts` 與 `usage/` 在不改變回應的
   前提下收集終止狀態、延遲、provider/model 標籤和盡力估算的 token usage。

## 解析器

`responses/parser.ts` 使用 `responses/schema.ts`（Zod）校驗傳入請求，然後建置
`OcxParsedRequest`：

- **訊息（Messages）** —— `input` 條目會變成規範化的 `OcxMessage[]`：user / developer /
  assistant / toolResult。`reasoning` 條目變成 thinking block；`function_call`、
  `custom_tool_call`、`tool_search_call` 條目變成工具呼叫；對應的 `*_output` 條目變成工具結果。
- **工具（Tools）** —— function 工具直接透傳；**帶名稱空間的（MCP）工具會被扁平化**為
  `namespace__name`，並在回傳時還原；**自由格式（freeform）**工具（如 `apply_patch`）和
  **tool_search** 發現工具會被標記；**託管工具（hosted tools）**（`web_search`、圖像生成等）
  會被移除，只有 sidecar 確定會處理時才重新注入。
- **圖像（Images）** —— 作為真實 content part（data URL 或遠端 https）保留，絕不會內聯成
  文字。
- **功能標誌（Feature flags）** —— `_webSearch`（請求了託管網路搜尋）、
  `_structuredOutput`（`text.format` 為 json_schema / json_object）和
  `_compactionRequest`（remote compaction v2）。

## 橋接器

`bridge.ts` 把 adapter 的內部 `AdapterEvent` 流轉換回 Codex 能理解的 Responses SSE：

| AdapterEvent | 發出的 Responses SSE |
| --- | --- |
| `text_delta` | `response.output_text.delta` → `…done`、`response.content_part.done`、`response.output_item.done` |
| `thinking_delta` | `response.reasoning_summary_text.delta` → `…done`、item close |
| `reasoning_raw_delta` | 原始 `reasoning_text` item（或隱藏的往返 envelope） |
| `thinking_signature` / `redacted_thinking` | 儲存在 `encrypted_content` reasoning envelope 中 |
| `tool_call_start` | `response.output_item.added`（type：`function_call` / `custom_tool_call` / `tool_search_call`） |
| `tool_call_delta` | `response.function_call_arguments.delta`（freeform / tool_search 會跳過） |
| `tool_call_end` | `response.function_call_arguments.done` → `response.output_item.done` |
| `web_search_call_begin` / `web_search_call_end` | 一個即時 `web_search_call` item，加上 URL citation |
| `heartbeat` | 標記上游仍在活動；不產生使用者可見的輸出 item |
| `done` | `response.completed`（帶 usage） |
| `error` | `response.failed`（帶 `last_error`） |

橋接器還會執行**心跳保活**（RC3）：上游沒有資料時，每 2 秒傳送一個 SSE 註解行
（`: opencodex heartbeat`）來重新啟動 Codex 的空閒計時器。註解行會被每個
eventsource 解析器丟棄而不會產生任何事件，因此嚴格的 Responses 解碼器永遠不會
遇到未知 variant。預設**停滯截止時間**為 300 秒（`stallTimeoutSec`）；達到該時限後
會中止上游，並發出 reason 為 `upstream_stall_timeout` 的 `response.incomplete`，
避免掛起的連線無限期阻塞 Codex。

解析器捕獲的名稱空間對映、freeform 集合與 tool-search 集合會把工具呼叫區分為三種 Responses
item，因此 MCP 名稱空間、`apply_patch` 風格的 freeform 工具和用戶端執行的 `tool_search` 都能
完整往返。`buildResponseJSON()` 變體會用同一批 event 生成單個非流式回應物件。

## 管理 API、OAuth 與用量

`server/management-api.ts` 為儀表板提供後端，並把專門的 route 分派給
`server/management/*.ts`。其 `/api/*` route 涵蓋安全的設定/設定、provider
CRUD 與 key pool、模型選擇/context cap/v2 控制、catalog sync、診斷與 debug log、usage 與
quota、sidecar 設定、更新、生成用戶端 API key、OAuth 登入/狀態/登出與帳號選擇、Codex 帳號
管理，以及 graceful stop。proxy 繫結到 loopback 之外時，`server/auth-cors.ts` 會要求
`/api/*` 和 `/v1/*` 都提供 `OPENCODEX_API_AUTH_TOKEN`；設定的 `corsAllowOrigins` 會擴充套件本機
origin allowlist。

OAuth 實作在 `oauth/` 中；每次路由呼叫前都會即時載入或重新整理 access token，而
`oauth/token-guardian.ts` 只會主動重新整理策略允許的 provider。重新整理由 process 內
single-flight、per-account 檔案鎖與 generation CAS 協調，確保並行寫入者不會覆蓋較新的
credential。共用的健康狀態投影（`oauth/health.ts`）供 `ocx status`、`ocx doctor`、管理 API 與
儀表板使用。Codex/ChatGPT pool credential 與 process-local thread affinity 位於 `codex/` 下，
不會出現在管理 API 回應中；affinity 會在 `401` / `403` / `429` 時清除（rate limit 不會固定
affinity），且不會跨重新啟動持久化。請求用量會規範化為 `OcxUsage`，顯示在 Responses 終止
event 中，並由 `usage/` 彙總，供儀表板和可選的 JSONL 診斷使用。

## 傳輸與 compaction

`server/index.ts` 預設在 `/v1/responses` 上提供 HTTP/SSE。當 `websockets` 為 `false` 而 Codex
嘗試 Responses WebSocket upgrade 時，opencodex 會回傳 `426 upgrade_required`，Codex 隨後在該
session 中回退到 HTTP。設定 `"websockets": true` 後，同一 endpoint 會接受 upgrade 並使用
WebSocket bridge。

獨立於該用戶端可見設定之外，canonical ChatGPT 轉送請求若帶有根層級的 `stream: true`，在
穩定版 Bun 1.4.0 或更新版本上可能使用 Codex 的上游 WebSocket transport。canonical ChatGPT
路徑會在 WS 訊框中繼資料中保留 HTTP Responses Lite 的意圖，並根據實際傳送的模型與 service
tier 推導其路由提示。初始的上游 quota/model metadata 會轉為有界的 HTTP 回應標頭；之後的
quota 更新會歸屬於服務中的帳號，不會回溯加進已送出的標頭。WS 請求送出後發生的失敗不會
觸發自動 HTTP 重送。若後端在任何輸出之前送出拒絕，以帶有 4xx `status_code` 的單一 `error`
訊框呈現，會以該 HTTP 狀態回傳：訊框標頭除了 framing 與編碼相關標頭外會被複製，
`content-type` 為 `application/json`，`cache-control` 為 `no-store`，body 為 `{"error": ...}`
JSON，因此與 HTTP 路徑相同的重新整理、quota 與帳號輪替處理都適用。這些對映不會啟用用戶端
可見的 WebSocket 設定，也不會改變其他 provider 的 transport 選擇。內附的 Bun 1.3.14、
prerelease 與無法驗證的 runtime 身分一律使用 HTTP/SSE。成功的上游 WS 回應會維持下游 SSE
合約，並透過有界的 eager single-reader relay 繞過 `tee()`（每個原始/封裝訊框 4 MiB，
producer queue 8 MiB）。Queue 溢位會關閉上游，並發出一個終止的下游 `response.failed`
event，接著是 `[DONE]`。

當最終傳送的模型為 `gpt-5.3-codex-spark` 時，canonical ChatGPT 轉送會在 HTTP 請求標頭與
原生 WS 訊框中繼資料中明確關閉 Responses Lite，透過別名選擇 Spark 時也一樣；但僅限於傳送本文
不含帶有非空 `tools` 陣列的 `additional_tools` 群組的情況。該群組本身就是 Lite 的工具傳遞形態，因此仍使用它的 Spark
本文會保持 Lite 開啟，無論呼叫端或設定的標頭為何。Lite 識別值
改變時，舊 socket 會停止使用；後續識別值相同且符合重用條件的請求可以重用新 socket。
其他模型與閘道保留既有 Lite 政策。原生中繼資料格式不合法時，仍會退回 HTTP，並保持
請求本文不變。

當 provider 在 SSE 開始前就以 HTTP 413 拒絕串流請求時，OpenCodex 會發出一個帶有
`context_length_exceeded` 的終止 `response.failed` event，而不是中繼那個可重試的未知
狀態。這讓 Codex 能停止重新連線迴圈，並在下一輪套用自己的 context-compaction 政策。
OpenCodex 不會悄悄刪除 prompt 或圖像；請縮減目前輸入，或在 compaction 後重試。非串流
API 呼叫端仍會收到 provider 的 HTTP 413。

Codex context compaction 同樣適用於路由模型。`server/responses/compact.ts` 處理
`POST /v1/responses/compact`，執行一次內部路由 summarization turn 並回傳壓縮後的歷史；
`responses/parser.ts` 與 `bridge.ts` 則處理 remote compaction v2 的 `compaction_trigger` turn，
準確發出一個合成的 `compaction` 輸出 item。

## 快取與目錄

- `codex/model-cache.ts` 為每個 provider 維護即時 `/models` 結果的記憶體 TTL 快取（預設 5 分鐘，
  與 Codex 自身快取一致），取得失敗時會回退到舊資料。
- `codex/catalog.ts` facade 匯出的 `codex/catalog/sync.ts` 把路由模型作為帶名稱空間的條目
  合併進 Codex 目錄，優先排列精選的
  [subagent 模型](/zh-tw/guides/codex-integration/#the-subagent-picker)，過濾
  `disabledModels`，並可從一次性備份中完整恢復原始目錄。

## Reasoning effort

`reasoning-effort.ts` 把 Codex 的 reasoning 標籤轉換為各 provider 的 wire 值。Codex 目錄會
公佈 Codex 接受的標籤（`low` / `medium` / `high` / `xhigh` / `max`），但上游 provider 可能只
支援更小的子集，或要求真實 alias。該模組會：

- 定義標準的 `CODEX_REASONING_LEVELS` 及其排序。
- 精確級別不可用時，把請求的 effort 限制到最接近的支援層級。
- 解析模型級和 provider 級 `reasoningEffortMap` override，用於自訂 wire 對映。
- 對 `noReasoningModels` 中的模型完全移除 effort。

Qwen3.8-Max 是舊版 Qwen3.x budget 合約的明確 direct-effort 例外。Alibaba Token Plan 把它的
上游支援階梯記錄為 `low`、`medium` 與 `xhigh`（預設值），並以 `reasoning_effort` 傳送生效值；
僅限 Codex 的相容性上限會在 wire 上限制為 `xhigh`。Runtime registry enrichment 會修復仍把
此模型分類為 `thinking_budget` 模型的較舊持久化 preset metadata。

## 核心型別

內部模型位於 `types.ts`：`OcxParsedRequest`、`OcxContext`、`OcxMessage` 聯合型別、
`OcxContentPart`（text / image）、`OcxToolCall`、`OcxTool`、`AdapterEvent`，以及設定型別
（`OcxConfig`、`OcxProviderConfig`）。兩個常用 helper 是 `namespacedToolName()` 和
`modelInList()`；後者會在匹配 `noVisionModels` / `noReasoningModels` 時容忍 `:size` 標籤。


### 不完整的配額終止

原生轉送回應若以 quota 或 rate-limit 證據結束在 `incomplete` 終止狀態，會記錄帳號 quota
失敗與 spawn-fallback 健康狀態。結構化的 `incomplete_details.reason` 與錯誤碼在沒有訊息時
也會被接受；一般的 output-limit、filtering、steering 與 stall incomplete 不會冷卻帳號。
Cyber-policy 分類保有優先權。終止狀態不會在輸出後重播，固定帳號的請求選擇維持固定。

Remote compact 請求可以把回應緩衝得比伺服器的 request-idle timeout 更久。該監聽器逾時
在請求 body 被接受後就會停用；用戶端取消與上游操作期限仍然適用。

緩衝的路由 compaction 會把非空的文字與 reasoning delta 視為進度，而不暴露部分摘要文字。
註解、空 delta 與閘道 keepalive 不會重設 adapter-event 停滯監控。預設停滯逾時維持 300
秒；加密的 compaction 內容維持不變並保留。

原生 compact 回應緩衝同樣使用 `stallTimeoutSec`（預設 300 秒）強制執行 body-byte 無活動
期限。非空區塊會重設該期限；停滯的 body 回傳 HTTP 504，用戶端取消維持 HTTP 499，清理程序
不會等待卡住的上游取消 promise。32 MiB 回應上限與原始 body bytes 都會保留。

canonical 上游 WebSocket 的 refused-create 錯誤只有在回應被提交之前、且經過串流關聯性
檢查之後，才能變成 HTTP 4xx。允許的 quota 標頭會被限制範圍並在不含上游 framing 標頭的
情況下重建；JSON 回應不可快取。提交後與 5xx 錯誤仍維持不重送路徑。

當加密 agent-task recovery 拒絕一個路由任務時，其既有的 400 錯誤可以包含一個有界的
`recovery_reason`：`unsupported_envelope`、`admission_denied`、`recovery_unavailable`、
`caller_cancelled`、`input_changed`、`recovery_http_rejected`、`recovery_timeout`、
`recovery_aborted`、`recovery_transport_error` 或 `recovery_invalid_output`。
HTTP 拒絕要求觀察到一次非成功回應。Invalid output 包含不合法的 UTF-8、過大的 body、
格式錯誤或不完整的 recovery 串流，以及無效或衝突的 assignment。呼叫端的取消優先於
自身持有的期限，而該期限又優先於解碼／transport 失敗。`recovery_aborted` 描述的是
獨立於該呼叫端而被取消的共用 recovery。Shared-flight 等待者會收到相同的底層失敗，
除非被個別取消；只有成功的明文會被快取。診斷內容不包含任何上游錯誤或 payload 文字。
沒有已分類的 recovery 結果時會省略此欄位，既有回傳原始目標失敗的 combo 分支則維持
原本的回應。`recovery_unavailable` 包含 cache/singleflight 容量問題，並不能證明曾經
嘗試過上游請求。不會啟用重試或更寬鬆的 envelope 接受方式。
