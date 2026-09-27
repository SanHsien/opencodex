---
title: 代理 API 格式
description: Responses、Chat Completions、Anthropic Messages、模型目錄、WebSocket、realtime 與 compaction 介面的 wire 層級參考。
---

opencodex 以多種客戶端方言呈現一個本機代理。Codex 客戶端可說 Responses API，OpenAI 相容的 app 可說 Chat Completions，而 Claude Code 可說 Anthropic Messages，而不需要每個上游供應商實作每種格式。

正常轉譯路徑為：

```text
client dialect → internal Responses model → provider adapter → provider wire format
provider events → internal adapter events → client dialect
```

Responses 表示是橋接的中心。原生相容的路由可跳過部分轉譯並 passthrough 請求，但認證、路由、許可控制與回應安全仍在代理邊界發生。在[設定](/zh-tw/reference/configuration/)中設定監聽器與許可金鑰；當一個公開模型 id 應在多個目標間選擇時使用[組合](/zh-tw/guides/combos/)。

## 上游重新導向

攜帶憑證的模型、圖片、影片和搜尋請求不會自動跟隨 HTTP 重新導向，包括同源重新導向。請設定最終上游 API URL，而非會重新導向的別名。伺服器不會向重新導向目標再次傳送憑證或請求內文。各回應處理路徑保留原有的錯誤處理或轉送行為；原生 Responses 和 compact 路徑仍可向用戶端回傳原始 3xx 與 `Location`。用戶端的重新導向行為與此伺服器傳輸政策屬於不同邊界。

## Console 上傳拒絕

規範 OpenCode Zen/Go 生成端點回傳的一模一樣的 Console 或 Console Go `Invalid upload request.`
HTTP 400，會在 800 毫秒後獲得一次重試。代理重用相同的序列化請求，並在 Logs 中記錄這次復原。
其他 400 錯誤、自訂目的地、取消動作與重複的上傳拒絕仍維持失敗。這不會重試被過濾的模型回應
或中斷的串流。

## 搜尋回答為空

hosted search 之後，若移除工具、保留既有結果重試一次仍得到乾淨但空的強制回答，會再嘗試一次
回答。這可能招致另一次模型請求。第二次空回答即失敗；格式錯誤的呼叫，以及 provider 拒絕或
截斷的結果，都不會套用這次重試。

## xAI policy refusals

部分 xAI Chat Completions 拒絕不是以 HTTP 200 加 `finish_reason: content_filter` 回傳，而是以 HTTP 403 加上一句完全相符的拒絕語句（例如 `I can't help with that request.`）回傳。Codex 把 403 視為傳輸失敗，因此使用者回合不會被記錄，同一個請求會被重送。

在非 combo 的 Responses 請求上，OpenCodex 會把這種在允許清單中的 403 改寫為 HTTP 200 的 Responses 內容，帶有 `status: "incomplete"` 與 `incomplete_details.reason: "content_filter"`。改寫同時作用於 openai-chat 轉接器路徑與 openai-responses 直通（grok-4.6 / grok-4.5 OAuth）。串流使用相同的 incomplete 邊界。空白的 403 本文仍是錯誤。訂閱、點數、權限與 `not allowed to use this model` 的 403 仍是錯誤。Combo failover 仍看到原始的 HTTP 403。

## Cursor context 溢出

Cursor 第一次裸的 context 溢出會直接呈現給用戶端。之後在同一個保留範圍內、帶有穩定客戶端
執行緒的合格請求，最多可以透過三次對話 remint 復原。此記憶體內額度會在閒置一小時、被驅逐或
重啟後過期。沒有穩定執行緒的請求、獨立的 helper、工具結果的續傳、部分輸出、compaction 與
配額錯誤都不使用這個復原機制。持續合格的溢出會讓既有額度保持有效，即使已耗盡也不會補充；
這不會推論任務是否有進展。

## Live sideband 連線失敗

代理會在接受用戶端 WebSocket 之前，先完成上游 live sideband 的 handshake。上游拒絕會讓升級
以 502 失敗；十秒的 handshake 逾時回傳 504，用戶端取消回傳 499。Bun 不會暴露確切的上游
handshake 狀態，因此目前無法精確轉發上游的 404/410。成功的連線會依序保留最初的 session
frame。此 handshake 政策與 Responses WebSocket 傳輸是分開的。

## 端點概覽

| 客戶端介面 | 端點 | 成功的非串流結果 | 成功的串流或 socket 結果 |
| --- | --- | --- | --- |
| OpenAI Responses | `POST /v1/responses` | Responses JSON | Responses SSE，或 WebSocket 上的 Responses JSON text frame |
| OpenAI Chat Completions | `POST /v1/chat/completions` | `chat.completion` JSON | `chat.completion.chunk` SSE，以 `[DONE]` 結束 |
| Anthropic Messages | `POST /v1/messages` | Anthropic `message` JSON | Anthropic Messages SSE |
| Anthropic token 計數 | `POST /v1/messages/count_tokens` | `{ "input_tokens": number }` | 不適用 |
| 模型探索 | `GET /v1/models` | 目錄或明確指定的 Desktop 快照 | 不適用 |
| 檔案轉寫 | `POST /v1/audio/transcriptions` | `{ "text": string }` 或純文字 | 這個檔案端點不支援 |
| 串流聽寫 | `WS /v1/audio/transcriptions/stream` | 不適用 | Desktop 聽寫 JSON 事件 |
| 語音與 Realtime | `POST /v1/live`, `POST /v1/realtime/calls` | 中繼的 call-creation 回應 | 一個獨立的 sideband WebSocket 雙向中繼 frame |
| Responses compaction | `POST /v1/responses/compact` | 取代歷史 JSON | 不適用 |

## 檔案轉寫

Connections > API keys 有各自獨立的**聽寫**與**即時語音**區塊。請輸入 OpenCodex 的資料金鑰，
而不是供應商或管理金鑰。聽寫會上傳你選取的檔案，並提供取消與複製逐字稿的功能。即時語音的
**檢查連線**會在不使用麥克風存取或音訊 frame 的情況下開啟一個 session，等待供應商的 session
確認，並在一分鐘後或你離開面板時斷線。金鑰只會留在該面板的記憶體中。**已設定，尚未驗證**描述
的是供應商設定，不是帳號健康狀態或權限。請使用明確的動作來觀察結果。範例使用金鑰佔位符，絕不
包含實際輸入的密鑰。沒有音訊中繼資料的較舊伺服器，會讓這些控制項無法使用。

`POST /v1/audio/transcriptions` 接受以 `Authorization: Bearer`、`x-opencodex-api-key` 或
`x-api-key` 送出的 OpenCodex 資料平面金鑰，包括在本機監聽器上。明確提供但無效的金鑰會被拒絕。
請以 multipart `file` 上傳一個音訊檔案，並為已連接的 ChatGPT 帳號提供
`model=gpt-4o-transcribe`。OpenCodex 會自行解析上游憑證；絕不要把 ChatGPT token 當成客戶端 API
金鑰提供。

```bash
curl "$OPENCODEX_BASE_URL/audio/transcriptions" \
  -H "Authorization: Bearer $OPENCODEX_API_KEY" \
  -F 'model=gpt-4o-transcribe' \
  -F 'file=@recording.wav' \
  -F 'language=ko'
```

請把 `OPENCODEX_BASE_URL` 設成你的 proxy URL，並以 `/v1` 結尾。選用欄位有 `prompt`、`language`
與 `response_format`（`json` 為預設，或 `text`）。JSON 結果只包含 `text`。檔案必須非空，且不得
超過 25,000,000 位元組；multipart 主體上限為 32 MiB，文字欄位上限為 16 KiB。已設定的監聽器主體
上限可能會施加更低的上限。重複或不支援的欄位（包括 `stream`）會被拒絕。這個端點不保證提供
時間戳記、語者分離、字幕或 token 用量中繼資料。

ChatGPT 訂閱路徑使用 `gpt-4o-transcribe` 作為相容性識別碼，不會把模型名稱送到那個私有的轉寫
端點。這不代表 backend 內部使用的就是那個模型。啟用的 OpenAI API-key 供應商也支援
`gpt-4o-mini-transcribe` 與 `whisper-1`；當選擇的是 ChatGPT 供應商時，一次認證失敗不會悄悄切換
到那個要另外付費的供應商。Direct 模式在既有的 profile 准入規則下使用已儲存的 main 帳號；Pool
模式使用選定的已儲存帳號。憑證缺失、過期或正在耗盡都會回傳錯誤。取消會停止出站請求，且音訊內容
不會被寫入請求日誌。

## 串流聽寫

`WS /v1/audio/transcriptions/stream` 是給已連接 ChatGPT 帳號使用的 OpenCodex 擴充功能。它與
OpenAI 公開的 Realtime 轉寫協定是分開的。認證方式與檔案轉寫相同，使用相同的 proxy-key 標頭。
瀏覽器客戶端則改為提供以下這兩個 WebSocket 子協定：

```text
opencodex-audio
opencodex-key.<canonical-base64url-of-UTF8-proxy-key>
```

回應中只會選定 `opencodex-audio`。編碼只是傳輸語法，不是加密。明確的 HTTP 憑證標頭優先。
ChatGPT token 只留在 proxy 上；一個只有 API-key 的上游無法服務這個聽寫協定。

連線後，請送出：

```json
{"type":"session.start","config":{"input_audio_format":"pcm16","sample_rate_hz":48000,"num_channels":1,"max_buffer_size_bytes":4194304,"max_utterance_duration_ms":30000,"session_ttl_ms":300000,"provider_mode":"streaming_sse","transcript_delivery_mode":"segment","vad":{"type":"server_vad","threshold":0.5,"prefix_padding_ms":300,"silence_duration_ms":500}}}
```

請使用單聲道 PCM16 音訊實際的取樣率。等待 `session.started`，然後送出
`{"type":"audio.append","audio":"<base64 PCM bytes>"}`。這些是 JSON text frame，不是 WAV 檔案
或二進位 WebSocket frame。閘道接受 8,000 到 192,000 Hz 之間的取樣率；上游是否支援取決於帳號／
服務。客戶端 frame 上限 64 KiB，session 上限五分鐘。不受支援或格式錯誤的事件／設定欄位會以
代碼 1008 關閉串流。

`transcript.segment` 與 `transcript.final` 包含 `utterance_id`、`revision` 與 `text`。當同一個
utterance 的 revision 增加時，請取代先前的文字；不要把各版本串接起來。以
`{"type":"session.close"}` 結束，並等待最終文字與 `session.status="closed"` 的
`session.updated`。

## `POST /v1/responses`

這是原生 opencodex data-plane 結構。請求 body 必須是帶有非空 `model` 的 JSON 物件。`input` 可為字串或 Responses 項目陣列。

### 接受的請求欄位

| 區域 | 接受的結構 |
| --- | --- |
| 模型與輸入 | 必填的非空 `model`；可選字串 `input` 或項目陣列 |
| 訊息項目 | `user`、`developer`、`system` 與 `assistant` 訊息；字串內容或適合該角色的型別內容區塊 |
| 內容區塊 | Text、輸入圖片、輸入檔案、輸出文字、拒絕，以及 reasoning summary/text 區塊（在其父項目允許時） |
| 工具歷史 | `function_call`、`function_call_output`、`custom_tool_call` 與 `custom_tool_call_output` 項目 |
| 工具 | Function 工具加上鬆散的內建或代管工具項目；`tool_choice` 接受 `auto`、`none`、`required`、具名 function/custom 選擇、代管選擇或 `allowed_tools` |
| Reasoning | `reasoning.effort` 與 `reasoning.summary`（`auto`、`concise`、`detailed` 或 `none`） |
| 接續與快取 | `previous_response_id`、`store` 與 `prompt_cache_key` |
| 生成控制 | `max_output_tokens`、`temperature`、`top_p`、`stop`、`presence_penalty` 與 `frequency_penalty` |
| 服務與執行 | `stream`、`service_tier`、`parallel_tool_calls`、`instructions`、`metadata` 與 `user` |
| 延伸 Responses 欄位 | `background`、`include`、`prompt`、`text` 與 `truncation` 對相容路由被接受 |

未知的項目型別被接受為鬆散的型別項目以向前相容。轉譯的 adapter 僅處理它識別的項目型別，且可能拒絕其供應商無法表示的功能。
在規範的 ChatGPT Codex forward 路由上，純文字的 `system` 輸入訊息會被併入頂層的 `instructions`，
`truncation` 則會被移除，因為那個目的地會拒絕這兩種公開的 Responses 形狀。其他 Responses 目的地
會保留它們。同一個規範邊界也會移除巢狀、僅限客戶端使用的 `prompt_cache_breakpoint` 標記，並且
只在 `store: false` 的延續請求上捨棄 `item_reference` 項目；工具呼叫／結果的配對不受影響。

圖片檔案 ID 是供應商範圍內的參考，不是可攜的圖片位元組。Responses passthrough 會保留它們；
轉譯的 adapter 則會為訊息或 function／自訂工具輸出中只有檔案 ID 的圖片部分，收到一個
`[image: file_id]` 的文字標記。當轉譯後的模型需要看到圖片時，請改用一個圖片 URL 或 base64
data URL。託管的 `computer_call_output` 項目需要一條 Responses passthrough 路由；轉譯路由會
回傳 HTTP 400，而不是悄悄丟掉截圖。若只是要觀察一張截圖、不需要託管電腦工具語意，請改用使用者
的 `input_image`。

### JSON 與 SSE 輸出

在 `stream: true` 時，回應為 `text/event-stream`。橋接發出 Responses 事件如 `response.created`、output-item 與 text/tool delta，以及恰好一個終端 `response.completed`、`response.failed` 或 `response.incomplete` 事件。正常串流以 `data: [DONE]` 結束。

在 `stream: false` 或無 `stream` 時，相同的 adapter 事件被收集為一個 Responses JSON 物件。兩種形式都保留所選模型、輸出項目、終端狀態與 usage。

當供應商過濾或截斷一個回應時，一個未完成的工具呼叫在 JSON 與 SSE 中都會維持 `incomplete`。
部分輸出會被保留，橋接不會為那個開放中的呼叫發出引數完成事件。已完成的呼叫維持它們的狀態。這
保留了供應商本身的結果；客戶端對不完整回應的重試行為不受影響。

在 #4112 待處理的 `dev` 實作上，這個介面上最終的上游 HTTP 413，會被分類為
`invalid_request_error` / `context_length_exceeded`。非串流的呼叫端維持 HTTP 413 搭配一個 JSON
`error`；串流的呼叫端維持終端 SSE 失敗。兩者都使用一個固定訊息，而不會暴露上游的錯誤主體。路由
過的合成壓縮會傳播這個已分類的失敗；這不會縮小輸入或重試壓縮。原生 compact passthrough 與本機
的准入大小限制錯誤，仍維持各自獨立的契約。

對原生 HTTP/SSE passthrough 而言，一次沒有觀測到上游終端事件的客戶端取消，會被記錄為 `499`，
`closeReason: "client_cancel"`，且不會懲罰帳號池。這適用於 tee 檢視與 eager relay，包括
Windows 改寫流量，即使在回應主體取消掛鉤執行之前，上游讀取就先被拒絕也一樣。在有界的斷線後
排空期間所捕捉到的終端事件，會保留它實際的結果。

若原生 passthrough 改寫失敗，包括超過轉譯緩衝預算的情況，relay 會直接回報失敗，不等上游檢視
結束。它會取消上游的工作，並依序發出 `response.failed` 與 `data: [DONE]`；緩衝超額時使用
`translation_buffer_limit` 錯誤碼。

面向客戶端的 Responses SSE frame，每個 frame 上限 4 MiB，以 SSE 區塊分隔符之前的原始位元組計算。
在 HTTP 上，一個超過限制、未終結的上游 frame，會以一個合成的 `response.failed` 事件搭配後續的
`data: [DONE]` fail closed。在 Responses WebSocket 橋接上，同樣的情況會發出一個 502
`websocket_protocol_error` 並取消上游讀取器。一個完整的 Responses 終端 frame 具權威性：終端事件
之後過大或格式錯誤的尾端位元組會被丟棄，而不會讓一次已完成的回合被一個傳輸失敗取代。

:::note
對原生 passthrough 而言，一個 Responses 終端事件具權威性。過早出現的 `data: [DONE]` 會被保留，
直到該事件出現。在一般的原生路徑上，一個乾淨的 HTTP 200 EOF、卻沒有解析出終端事件，會發出一個
`response.incomplete`，`incomplete_details.reason: "adapter_eof"`，接著是一個 `data: [DONE]`；
語法上合法、沒有分隔符的終端 JSON 只會被接受一次，格式錯誤或被截斷的 JSON 則維持 incomplete。
對選擇加入 model-scoped 終端修復的供應商，沒有框架的類終端後綴，以及 EOF 時過早出現的
`data: [DONE]`，在找不到任何可被提升的完整生命週期候選時，會以 `missing_terminal_event`
fail closed；一個完整的候選會被提升為 `response.completed`。高信心度的 `cyber_policy` 終端
形狀，會正規化為 `response.failed`，`error.code: "cyber_policy"`，用於語意層級的記錄／計費
（狀態 400），而一個已經開始串流的 HTTP 回應仍維持 200。這個已提交請求的邊界不會重試或重播，
也不會解決 [#2423](https://github.com/lidge-jun/opencodex/issues/2423) 或
[#2486](https://github.com/lidge-jun/opencodex/issues/2486)。
:::

對規範 ChatGPT forward 串流而言，穩定版 Bun 1.4.0 或更新版本，可能會透明地使用 Codex 的上游
WebSocket 傳輸。搭售的 Bun 1.3.14、預先發布版，以及無法驗證的 runtime 身分，會使用 HTTP/SSE。
上游的 WS adapter 保留與下游相同的 SSE 契約，把原始 JSON frame 與它的 SSE 封套都限制在 4 MiB，
並在它 8 MiB 的位元組佇列即將溢出時關閉上游。那次溢出會發出一個終端的下游 `response.failed`
事件，接著是 `[DONE]`。

上游 WebSocket 會先檢查 `NO_PROXY`/`no_proxy`。否則它會使用第一個非空的 `HTTPS_PROXY`、
`https_proxy`、`ALL_PROXY` 或 `all_proxy` 值；單獨的 `HTTP_PROXY` 不會代理一個 WSS 連線。HTTP
與 HTTPS 的代理 URL 會被傳給 Bun。若選定的值無效或使用不受支援的協定，opencodex 會跳過
WebSocket 嘗試，改用 HTTP/SSE，而不是直接連往上游。

這些規則屬於上游 WebSocket 傳輸，與所選的供應商 adapter 無關。以 HTTP fetch 為基礎的 Responses
請求，包括 SSE 後備，使用 Bun 的 HTTP 代理規則，不使用 `ALL_PROXY`。`config.proxy` 會填補缺少的
`HTTP_PROXY`/`HTTPS_PROXY` 值；解出的 scheme 專屬值，對 WebSocket 而言也會勝過既有的
`ALL_PROXY`。對需要代理的 HTTPS 上游，請設定 `HTTPS_PROXY` 或 `config.proxy`；單獨的
`HTTP_PROXY` 會讓 WSS 與它的 HTTPS 後備都沒有對應 scheme 的代理可用。

每個終端 Responses usage 物件都包含兩個 detail 物件，即使供應商未回報那些細節：

```json
{
  "input_tokens": 0,
  "output_tokens": 0,
  "total_tokens": 0,
  "input_tokens_details": { "cached_tokens": 0 },
  "output_tokens_details": { "reasoning_tokens": 0 }
}
```

可用時，`input_tokens_details` 亦可包含 `cache_write_tokens`。恆存在的 detail 物件是對嚴格 Responses 客戶端的相容性保證；零可能意指「未回報」，不一定是「供應商未執行此類工作」。

### 將回應與其請求日誌相互關聯

每個通過准入的 HTTP Responses 回覆都帶有 `x-opencodex-request-id` 標頭，其中保存代理產生、格式為 `ocx-<32 hex>` 的識別碼。它是將回應連結至請求日誌及用量報告中對應列的關鍵。

代理一律產生此值，並覆寫呼叫端提供或上游傳回的任何識別碼，因此它專屬於此代理，可安全信任為關聯鍵。該標頭列於 `Access-Control-Expose-Headers` 中，這讓瀏覽器中的 JavaScript 能跨來源讀取它；否則即使自訂 `x-` 標頭已在實際傳輸中，`response.headers.get()` 仍看不到它。

在認證或來源准入階段遭拒的 Responses 請求不會進入此包裝層，也不會帶有識別碼，因此缺少此標頭表示該請求在寫入日誌前已遭拒。

### 同路徑上的 WebSocket 升級

當 `websockets` 啟用時，客戶端可升級 `/v1/responses` 而非開啟 HTTP POST。認證與來源許可在 WebSocket 握手期間發生。它們不在每個 frame 內重複。

這個面向客戶端的升級，與上面描述的、透明的上游 ChatGPT WebSocket 選擇是分開的；`websockets`
這項設定只控制面向客戶端的端點。

客戶端發送 JSON text frame：

```json
{
  "type": "response.create",
  "model": "provider/model",
  "input": "Hello",
  "tools": [],
  "generate": true
}
```

除了 `type` 之外的一切成為 Responses 請求 body，且代理為該回合強制串流。新的 `response.create` 取代並取消該 socket 上的前一個回合。
`response.processed` 被接受為 no-op 確認。無法解析或不相關的 frame 型別被忽略。

伺服器 frame 為 JSON text frame。成功的串流輸出使用會出現在 SSE `data:` 列中的相同 JSON payload，而無 SSE 封裝或 `[DONE]`。非串流的內部結果被重新框架為 `response.created`、零或多個 `response.output_item.done` frame，然後是終端 frame。錯誤使用此封裝：

```json
{
  "type": "error",
  "status": 502,
  "error": {
    "type": "upstream_error",
    "message": "..."
  },
  "headers": {}
}
```

帶有 `generate: false` 的暖機 frame 不呼叫上游。它回傳合成的
`response.created` 後接 `response.completed`，兩者皆有空的回應 id 且無輸出。

:::note
當 WebSocket 停用時，升級嘗試收到附帶代碼 `upgrade_required` 的 HTTP 426。Codex 將該握手結果視為回退到該 session 的 HTTP 的信號。它不是失敗的模型回合。
:::

## `POST /v1/chat/completions`

此端點接受帶有必填 `model` 與非空 `messages` 陣列的 OpenAI 相容 Chat Completions 請求。它將 system、user、assistant 與 tool 訊息轉譯為內部 Responses 項目；轉譯 function 工具、tool choice、圖片、reasoning effort 與支援的回應格式；執行正常 Responses 路由管線；然後將結果轉譯回來。

圖片 URL 與 base64 data URL 使用 Chat 的 `image_url` 內容部分。轉譯會保留受支援的 `detail` 值
（`auto`、`low`、`high`）。在轉譯路由上，OpenCodex 也接受帶影像的工具結果陣列，作為一項相容性
擴充：Responses 路由保留結構化輸出，而 `openai-chat` adapter 會把工具影像放進之後的一則使用者
訊息，因為 Chat 的工具內容只能是文字。其他下游 adapter 各自擁有其供應商專屬的放置方式。純文字
結果仍維持字串。原生 passthrough 遵循它自己的上游契約；影像支援與否仍取決於選定的模型與供應商
設定。

Reasoning 是這項轉譯的一部分。`reasoning_effort`（或 `reasoning.effort`）會變成內部的
`reasoning.effort`。因為 Responses 解析器在 `reasoning.summary` 未設定或為 `none` 時會隱藏
思考內容，要求 effort 的 Chat Completions 請求預設會把 `reasoning.summary` 設為 `"auto"`，所以
思考內容會以 `delta.reasoning_content` 串流回傳。客戶端仍可用 `include_reasoning: false` 或
`reasoning.summary: "none"` 隱藏這些軌跡。明確設定的 `reasoning.summary`（`auto`、`concise`、
`detailed` 或 `none`）會勝過 `include_reasoning`。

結構化輸出是該轉譯的一部分：帶 `json_object` 或 `json_schema` 的 `response_format` 被轉發到路由的 `openai-chat` 模型。在 `POST /v1/responses` 上，等效請求欄位是 `text.format`：原生 Responses 路由在原始 Responses body 中保留它，並在模型路由到 `openai-chat` 供應商時轉譯為 `response_format`。列在供應商 `noStructuredOutputModels` 中的模型會在該 chat wire 上省略 `response_format`；同儕模型保留轉譯。未分類的後端收到該欄位並回傳自己的錯誤，而非由代理猜測其能力。

非串流輸出有 `object: "chat.completion"`。串流輸出使用帶有
`object: "chat.completion.chunk"`、choice delta、帶有 `finish_reason` 的終端 choice 與
`data: [DONE]` 的 SSE 物件。Tool-call 與 usage 資訊在來源事件帶有它們時被轉譯回來。

若一個串流的 Chat 請求在上游收到一個完整的 JSON Responses 結果，代理會從轉換後的完成結果合成
SSE。它會保留答案與 reasoning 內容、function 工具呼叫（每個呼叫各有獨立的串流 `index`）、
usage，以及轉換後的 `finish_reason`（包括 `tool_calls` 與 `length`）。這個後備會把已完成的結果
分塊送出；它無法在上游 JSON 回應抵達之前提供逐 token 的傳遞，也不會發出額外的推論請求。一個因
輸出 token 上限或內容過濾而不完整的回應，會維持 `length` 或 `content_filter`，即使它包含工具
輸出也一樣。其他不完整的邊界情況，會回傳一個上游錯誤，而不是宣稱正常完成。

拒絕文字與答案文字分開保存：JSON 完成結果使用可為 null 的 `message.refusal`，串流片段使用
`delta.refusal`。原生 Chat 的 JSON 轉 SSE 與 SSE 轉 JSON 轉換都會保留這個欄位；原生串流中繼會
保留供應商自己的拒絕差異片段。在轉譯後的 Responses 串流上，拒絕部分會被緩衝到終端事件，再依它們
原本輸出／內容的順序一次發出。相容的重複或稀疏快照不會重複或清除文字。互相矛盾的拒絕快照與緩衝
溢位，會產生一個有型別的錯誤，而不會有成功的完成或 `[DONE]`。這保留了上游的拒絕結果；它不會
引入一個代理自己的政策判斷。

由於內部執行路徑基於 Responses，供應商 adapter 可施加較窄的功能集。例如，所選 adapter 無法表示的請求功能以錯誤回傳，而非靜默變更其意義。

## `POST /v1/messages` 與 `count_tokens`

這些端點說 Claude Code 與相容客戶端使用的 Anthropic Messages 方言。多數請求被轉譯為 Responses、正常路由，然後轉譯回 Anthropic JSON 或 Anthropic SSE。

在轉譯後的 Messages 請求上，reasoning 重播會共用這次請求的轉譯預算。封套准入計算的是編碼／
解碼的複製額外開銷，不只是原始簽章的長度。超過這個預算的請求會回傳 HTTP 413，搭配
`translation_buffer_limit`；簽章與不透明的 reasoning 資料絕不會被截斷來讓請求塞得下。原生
Anthropic passthrough 維持它自己獨立的主體大小契約。

Base64 與 URL 圖片來源會在使用者訊息與巢狀工具結果中被轉譯。以檔案為後盾的圖片
（`source.type: "file"`）需要原生 Anthropic passthrough；轉譯路由會回傳一個固定的 HTTP 400
錯誤，要求提供 base64 或 URL 輸入。OpenCodex 不會代為解析另一個供應商的檔案儲存，也不會代表
呼叫端上傳所參照的圖片。

當重播的歷史中出現一個帶圖片的工具結果、卻沒有相鄰的呼叫時，Anthropic 與 Command Code adapter
會把圖片保留在一個標明來源的使用者載體中，而不是把它的位元組內嵌進提示文字。它們不會捏造一次
成功的工具呼叫。合法待處理呼叫的結果，仍會排在這些載體之前，維持上游的配對契約。

對 Cursor 外部模型而言，目前拖尾的工具結果批次中，data-URL 截圖會附加到延續請求上。既有的
12 張圖片現用附件上限，適用於整個批次。即使較舊的歷史被修剪，有界的來源標籤仍會留在附件旁邊。
原生 Composer／MCP 的處理方式、歷史圖片回想，以及遠端 URL 省略政策都不變；這不保證每個模型都能
看到每一種圖片來源。

原生 Anthropic passthrough 僅在以下全部為真時合格：

- 原生 passthrough 未在 Claude Code 設定中被停用；
- 請求的模型以 `claude` 或 `anthropic` 開頭；
- 請求帶有原生 Anthropic bearer 或 `x-api-key` 憑證；
- 在非回環 listener 上，請求還只透過 `x-opencodex-api-key` 攜帶有效代理許可；且
- 無設定的別名或模型映射為路由目標聲明該模型 id。

合格的請求以 Anthropic 方言轉發，使原生 beta 標頭、thinking 簽章與訂閱身分保持端到端。否則它走 Responses 往返。

專用許可標頭絕不轉發。`Authorization` 或 `x-api-key` 中的代理許可密鑰也會被移除，
而另一標頭中的真正 Anthropic 憑證會保留。以逗號合併的模糊憑證標頭會 fail closed。

`POST /v1/messages/count_tokens` 遵循相同的模型解析與 passthrough 決策。原生合格的請求被轉發到 Anthropic 的計數端點。其他請求使用基於 system 內容、訊息與工具的本機檔案式估計並回傳：

```json
{ "input_tokens": 123 }
```

無法解析的日期型 Desktop ID 也可能是探索結果中缺少的真實原生模型 ID。現有資訊不足以
解析該 ID 時，Messages 和 count-tokens 回傳 HTTP 503 及固定錯誤 `desktop_model_mapping_unavailable`；這不代表
模型無效。未知的舊版雜湊別名仍回傳 HTTP 400。兩種情況都不會移除日期或回退到其他路由。
已知 ID、已註冊映射、精確 `modelMap` 匹配及已識別的真實原生 ID 維持原有處理方式。
請重新整理模型探索或重新套用已連接 hub 的設定後再試；僅重試本身不能保證解決。

## `GET /v1/models`

未指定 `format=desktop-config` 時，使用以下一般目錄契約：

| 契約 | 觸發 | 頂層結構 | 模型 id 行為 |
| --- | --- | --- | --- |
| Anthropic 模型清單 | `anthropic-version` 標頭或 `?flavor=anthropic`，無 `client_version` | `{ "data": [...] }` 含 Anthropic model-info 項目 | Claude Code 收到可讀 id；Desktop 可收到其設定檔專屬的別名家族 |
| Codex 目錄 | `client_version` query 參數 | `{ "models": [...] }` | 原生與路由項目帶有更豐富的 Codex 目錄欄位、可見性、effort、WebSocket 與多代理中繼資料 |
| 普通 OpenAI 清單 | 無觸發 | `{ "object": "list", "data": [...] }` | 可見的原生 id 為裸 id；路由 id 為別名或 `provider/model` |

### Desktop 設定快照

`GET /v1/models?ids=desktop&format=desktop-config` 明確選擇 Desktop 快照，不依賴
user-agent。回應為 `{ "version": 1, "models": [...] }`，帶有 `Cache-Control: no-store`。
客戶端送出 `Accept: application/json`、`anthropic-version: 2023-06-01` 及現有資料存取憑證；
不需要管理員權杖，也不上傳設定檔。項目是 hub 發出的 Desktop 設定模型，不是 Codex 目錄列。

此格式與 `ids=cli` 或任何 `client_version` 一起使用時回傳 HTTP 400。未指定格式時，上述一般
契約維持不變。Claude 關閉時回傳 `{ "version": 1, "models": [] }`；已連接的 Desktop apply
會視為無法使用，不寫入替代設定。回傳一般目錄而非版本 1 的舊 hub 不受支援，客戶端不會改用
本機產生的 ID。

快照仍是唯讀模型清單，不是金鑰輪換或設定檔上傳 API。Desktop 金鑰移轉、復原與中斷由既有
客戶端連線流程處理。輪換保留模型項目和選擇；CLI 的 `rotation` 區分 `committed` 與
`rolled_back`。中斷會還原管理設定，或對已確認的舊設定檔回報標準回退，同時保留使用者欄位和
後來有效的選擇。衝突或未完成的復原不會標為完成。需要重新啟動 Desktop 才會讀取磁碟變更；
中斷不會自動撤銷 hub 金鑰。參見 [Claude Desktop 生命週期](/zh-tw/guides/claude-code/)。
thinking 重播與提示快取仍由獨立的 [#3719](https://github.com/lidge-jun/opencodex/issues/3719) 跟進。

## `POST /v1/live` 與 Realtime sideband

### 外部 API 金鑰

外部客戶端可以在任何支援的音訊憑證標頭中使用 OpenCodex 金鑰，或使用上面描述的瀏覽器子協定組合。
獨立的 `WS /v1/live?model=gpt-live-1-codex` 使用 Frameless 協定；省略模型時預設為這個識別碼，
`gpt-live-1` 是它的 proxy 別名。這不代表每一個公開的 OpenAI Realtime SDK 或 API 金鑰都支援
GPT-Live。

對一個全新的獨立連線，請在 socket 開啟後送出下面這個原始碼相容的初始化內容，並等待帶有非空
`session.id` 的 `session.started`。原生客戶端也接受形狀相同的 session 更新事件。

```json
{"type":"session.update","session":{"instructions":"","audio":{"output":{"voice":"cove"}},"delegation":{"type":"client"}}}
```

Frameless 使用 `input_audio.append` 與 `output_audio.delta`，不同於聽寫的 `audio.append`。
一次只檢查連線不需要麥克風或音訊 frame；就緒後送出 `{"type":"session.close"}` 並關閉 socket。
delegation 事件是工作請求，不是就緒訊號，外部客戶端擁有它們的執行與回應。

對 WebRTC 而言，請以 multipart 的 `sdp` 加上選用的 JSON `session`、JSON `{sdp, session?}`，或
原始的 `application/sdp`，POST 到 `/v1/live`。回應包含 answer 與一個帶有不透明 `rtc_ocx_` call
ID 的 proxy 相對 `Location`。請用同一把 proxy 金鑰加入那個 location。即使 Pool 選擇之後改變，
proxy 仍會解析建立通話時的那個供應商與實體帳號。未知、過期，或屬於其他金鑰的別名，會在建立上游
連線之前就失敗。客戶端金鑰輪替會依金鑰 ID 保留所有權；替換一個帶金鑰的上游憑證需要一次新的
call。既有 call 的旁帶連線不需要另一次 session 更新。

Call 綁定會維持 30 分鐘，每個伺服器上限 1024 筆，並在伺服器重新啟動時結束。Socket 的生命週期
是各自獨立計算的；媒體流量直接透過 WebRTC 傳輸，不經過 proxy。proxy 絕不會自己執行 delegation
請求。OpenAI 帳號的可用性，是由實際的上游回應決定的，而不是儀表板上是否出現一個模型名稱。

### 原生 Codex 相容性

在受信任的本機監聽器上，原生 API-key 模式的呼叫端，可以使用為規範 OpenAI API 層級設定的那把
精確憑證。其他呈現的 bearer 值，則需要一把已註冊的 proxy 金鑰，或一組明確、相符的 ChatGPT
token／帳號配對；任意的金鑰前綴不能證明它是原生憑證。不帶憑證、受信任本機的原生呼叫，維持它們
既有的行為。

`POST /v1/live` 接受 ChatGPT/Codex App 的 Frameless call-creation 介面。
`POST /v1/realtime/calls` 接受 OpenAI Realtime 的 call-creation 介面。opencodex 會選擇一個合格
的 OpenAI 家族路由、為上游認證模式正規化 call-creation 請求，並中繼有界的回應。

call 建立後，客戶端可以用任何支援的入站形式加入一個旁帶 WebSocket：

- `/v1/live/{callId}`
- `/v1/realtime/calls/{callId}`
- `/v1/realtime?call_id={callId}`

代理會正規化上游的 join URL，然後在兩個方向上透明中繼文字與二進位 frame。客戶端協定標頭會被
保留，而上游認證仍由 proxy 自己擁有。

call 建立與旁帶加入必須在同一個 OpenAI 帳號底下執行，否則加入會在上游被拒絕（`404`）。兩端都
帶有 Codex 的 `session-id` 與 `thread-id` 標頭；在 Pool 模式下，帳號選擇會綁定在那組配對上
（行程本地），所以一次抵達 proxy 的加入請求，會重用建立那次 call 的帳號，而 Direct 模式則在兩端
都轉送呼叫端目前的 bearer。被中繼的客戶端標頭精確地是 `openai-alpha`、`x-session-id`、
`session-id`、`thread-id`、`originator` 與 `x-oai-attestation`（`src/server/live.ts` 中的
`LIVE_CLIENT_PROTOCOL_HEADERS`）；在以 ChatGPT 為後盾的路由上，`Authorization` 與 ChatGPT 帳號 id
由 proxy 擁有（Pool 會用已儲存的帳號取代它們，Direct 會轉送已驗證的呼叫端 bearer），而一個
API-key 供應商則使用它自己的 bearer。只有當 `experimental_realtime_ws_base_url` 指向 proxy 時，
Codex 才會把加入請求送給它；`ocx start` 會把那個 key 注入在 `openai_base_url` 旁邊（見
[Codex 整合](/zh-tw/guides/codex-integration/)）。

## `POST /v1/responses/compact`

Compaction 為需要縮短長 Responses 對話的客戶端回傳取代歷史。

| 路由型別 | 行為 |
| --- | --- |
| 規範 ChatGPT 或官方 OpenAI 路由 | 以解析的帳號與模型認證嘗試原生的 `/responses/compact` 端點；HTTP 404 會退回一次一般的 Responses 壓縮回合 |
| 其他路由模型 | 執行一個內部、非串流、無工具的 compaction 回合，帶有 `compaction_trigger`；需要恰好一個合成的 `compaction` 項目，其 `encrypted_content` 為 `ocx1:` 封裝；將該摘要解碼為 v1 取代歷史 |

若原生 compact 端點回傳 HTTP 404，OpenCodex 會透過一個一般的 Responses 回合、使用相同的模型
選擇器與 session 標頭，重試壓縮。規範 ChatGPT 的後備回合使用上游 SSE；compact 的呼叫端仍會收到
JSON。一個已完成的原生不透明壓縮項目會被保留，而一個 `ocx1:` 摘要則會被解碼為取代用的使用者
歷史。失敗或不完整的後備回合會回傳一個錯誤，而不是取代歷史。其他原生 compact 狀態維持既有的
處理方式。

無論維運方把一般回合路由到哪個供應商，Codex 都會為它的壓縮回合指名一個裸的 OpenAI 家族模型
（例如 `gpt-5.6-sol`）。一般請求會把這類 id 保留給規範的 `openai` 供應商。只有在壓縮這個介面
上——`POST /v1/responses/compact`，以及帶有 `compaction_trigger` 的 `POST /v1/responses`
回合——一個沒有啟用規範 `openai` 供應商的裸原生模型，會退回已設定的 `defaultProvider` 作為摘要
產生者，而不是回傳 404。這個後備只有在預設供應商已啟用、且它本身不是 OpenAI 家族項目時才適用；
像 `side/gpt-5.6-sol` 這種帳號限定的選擇器仍會 fail closed。這個後備生效時，proxy 每個供應商
只會記錄一則通知。已啟用規範 `openai` 供應商的設定不受影響。

`/v1/responses` 與 `/v1/responses/compact` 兩者的進站主體，都遵循共用的 256 MiB wire／解壓縮
准入上限。應用層級的大小拒絕會回傳 HTTP 413，`type` 與 `code` 都是 `invalid_request_error`。它的
訊息包含一個有界的診斷後綴，例如：

```text
Decompressed request body exceeds 268435456 bytes [measurement=decoded_lower_bound; bytes=268435457]
```

| 量測方式 | `bytes` 的意義 |
| --- | --- |
| `declared_wire` | 傳送端宣告的數值 `Content-Length`；在讀取之前就被拒絕，不是一個量測到的解碼大小 |
| `observed_wire_lower_bound` | 讀取停止時已遇到的 wire 位元組數；完整主體可能更大 |
| `decoded_exact` | 送進 identity 解碼器、或由某個解碼器回傳的緩衝區確切大小 |
| `decoded_lower_bound` | 准入上限加一（在解壓縮中止之後）；一個下限，絕非確切的解碼大小 |

這個後綴只包含一個固定的分類與一個有限的數值位元組值。被拒絕的主體不會被進一步讀取或解壓縮、
不會被解析來計算項目數，也不會為了診斷而被保留。沒有量測來源的舊版錯誤，維持只有上限的訊息。
Bun 的監聽器可能在應用層診斷執行之前，就先拒絕一個過大的 wire 主體，所以不是每一個 413 都帶有
這個後綴。一個下限診斷無法確立完整 compact payload 的大小。准入上限與重試行為不變。

原生 compact 回應以 32 MiB 上限緩衝，包含其宣告的 `Content-Length` 已超過限制的回應。Compact 專屬失敗包含：

| 狀態 | 型別或代碼 | 意義 |
| --- | --- | --- |
| 400 | `invalid_request_error` | 無效 JSON/body 結構或缺失模型 |
| 404 | `invalid_request_error` | 請求的模型無法被路由 |
| 499 | `client_cancelled` | 客戶端在中繼或緩衝時取消 |
| 502 | `compact_response_too_large` | 原生 compact 輸出超過 32 MiB |
| 502 | `upstream_error` | 連線、讀取或合成 compaction 回合失敗 |
| 502 | `invalid_response_error` | 合成回合未產生恰好一個有效、非空的 `ocx1:` compaction 項目 |

## 認證矩陣

在僅回送綁定上，data-plane 許可不需要設定的金鑰。在遠端綁定上，請使用下方矩陣。「專屬」意指 `X-OpenCodex-API-Key`；其他欄意指 `Authorization: Bearer ...` 與 `x-api-key`。

| 介面 | 專屬 | Bearer | `x-api-key` |
| --- | --- | --- | --- |
| `/v1/responses` HTTP 與 WebSocket | 接受 | 接受 | 被拒 |
| `/v1/responses/compact` | 接受 | 接受 | 被拒 |
| `/v1/chat/completions` | 接受 | 接受 | 被拒 |
| `/v1/messages` 與 `/v1/messages/count_tokens` | 接受 | 接受 | 接受 |
| `/v1/models` | 接受 | 接受 | 接受 |
| `/v1/live`、`/v1/realtime/calls` 與 sideband join | 接受 | 接受 | 接受 |

Responses 系列和 Chat 請求接受專用標頭或 Bearer 欄位中的代理金鑰。在原生路由上，所選的已儲存 Codex 憑證會取代 admission bearer；其他路由會移除該 bearer。代理金鑰絕不會用作 upstream 憑證。如果還要提供獨立的 provider bearer，請將代理金鑰放在專用標頭中。

沒有金鑰且不使用 OAuth 的 Cursor 路由可以使用呼叫端另外提供的 bearer，但不能使用代理 secret 或自動補入的 ChatGPT main 憑證。Combo/policy 選擇及實際發生的 shadow/thread-spawn 路由改寫不會將呼叫端的原始憑證傳遞給新目標。正規 OpenAI 路由僅在 JWT 包含 ChatGPT 帳戶宣告，且任何明確提供的帳戶標頭都與該宣告相符時，才可在內部路由變更後還原呼叫端的單一非代理金鑰 bearer。 將呼叫端驗證轉送至選用的 OpenAI sidecar 時，需要單一 JWT，以及明確提供且相符的 `chatgpt-account-id`。即使明確提供了帳戶標頭，opaque bearer 也不會跨路由變更還原。 除此之外，最終目標必須擁有自己的設定、OAuth 或已儲存憑證，否則請求會在本機失敗。只有 thread-spawn 標記而沒有路由變更時，不會移除憑證。

對於未設定金鑰的 Cursor Chat 請求，只有實際規劃了 OpenAI 輔助呼叫且存在標準的 Direct 候選時，才會補充已儲存的 main 驗證。無關的 Cursor 請求不會透過此流程佔用 native main，因此不會延遲設定檔切換。輔助呼叫憑證仍受啟動和切換保護限制，並與 Cursor bearer 分離。Pool 及明確指定帳號的輔助呼叫保留現有帳號選擇。

Claude replay 只會以目前 turn 已取得所有權的記憶體 snapshot 保留 main 憑證，並且僅在最終目標為正規 ChatGPT 路由時還原它。

:::caution
Data-plane 金鑰不是管理憑證。管理 API 使用獨立的管理秘密；請見[管理 API](/zh-tw/reference/management-api/)。絕不為兩個平面重用同一個秘密。
:::

## 常見錯誤詞彙

錯誤在需要時使用客戶端方言的封裝，但這些狀態／代碼意義是穩定的：

| 狀態 | 型別或代碼 | 意義 |
| --- | --- | --- |
| 401 | `authentication_error` | 必填的代理許可憑證缺失或無效 |
| 403 | `origin_rejected` | Responses/OpenAI data-plane 請求或 WebSocket 升級來自不允許的來源 |
| 503 | `combo_unavailable` | 所選組合中的每個目標都不可用、在冷卻中、停用或因其他原因不合格 |
| 400 | `unreadable_encrypted_agent_task` | 加密的 v2 worker task 沒有可處理它的合格規範 ChatGPT 目標或明確信任的 Responses 目標 |
| 426 | `upgrade_required` | Responses WebSocket 傳輸被停用或升級失敗；請使用 HTTP |

Anthropic 來源的失敗以 Anthropic 的錯誤封裝渲染，因此該方言上的來源拒絕是 403 `permission_error`，而非 OpenAI 風格的 `origin_rejected` body。

## 加密內容衛生

代理將真實的後端密文視為不透明。結構有效的密文被逐位元組保留：opencodex 不解密它、轉譯其內容，或為另一個供應商重新加密它。

某些 agent hook 在歷史上曾將明文控制文字放入 `encrypted_content` 插槽。為相容性，代理將該明文分離為 text 部分，同時保留任何結構有效的 Fernet run 不變。若 `agent_message` 在該修復期間失去所有加密部分，它成為普通使用者訊息。若目前的 v2 task 保持真正加密但所選路由目標無法讀取原生 ChatGPT 密文，opencodex 以 `unreadable_encrypted_agent_task` 失敗，而非發送不可讀的位元組給該供應商。關於 worker task 周圍的客戶端行為，請見[子代理介面](/zh-tw/guides/sub-agent-surface/)。

### 在既有對話中切換供應商

重放的推理項攜帶的 `encrypted_content` 只有產生它的供應商與憑證才能讀取。若 opencodex 知道該對話上一次由另一個供應商處理，它會在送出前移除這個 blob，並保留該項的摘要。若那個供應商還使用了不同的 endpoint 或憑證，該項的 `rs_…` id 也會被移除，因為它指向新目標查不到的項目。若 opencodex 無從得知，例如代理重新啟動之後，新目標會拒絕這個 blob：OpenAI 與 Azure OpenAI 回傳 `400 invalid_encrypted_content`。此時 opencodex 會去掉上一個供應商的推理狀態（blob 與 `rs_…` id）後只重送一次請求；保留 id 會導致 `Item with id 'rs_…' not found`。

這項復原適用於所有使用 Responses 協定的 adapter，因此 `openai-responses` 與 `azure-openai` 的行為相同。復原成功後，該對話在同一目標上的後續輪次會在接下來五分鐘內於首次送出前移除這些狀態。重送計入請求的一般傳送預算。一般的 400 與 429 不會以這種方式重送，5xx 也不會，只有一個狹窄的例外：對於攜帶加密工具輸出的請求，回應本文恰好是該解密拒絕的 502 會得到同樣的一次重送。第二次拒絕會原樣回傳給客戶端。遇到這種情況，請在目標供應商上開始新的對話。
