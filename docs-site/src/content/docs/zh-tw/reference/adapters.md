---
title: 轉接器
description: provider adapter 的目標、請求建置方式與各自特性。
---

**adapter** 負責在 opencodex 的內部請求/回應模型與某個 provider 的 wire 格式之間轉換。每個
adapter 都實作 `ProviderAdapter` 介面（`src/adapters/base.ts`）：

```ts
interface ProviderAdapter {
  name: string;
  buildRequest(parsed: OcxParsedRequest, incoming: IncomingMeta): AdapterRequest | Promise<AdapterRequest>;
  fetchResponse?(request: AdapterRequest, ctx?: AdapterFetchContext): Promise<Response>;
  parseStream(response: Response, budget: TranslatorBudget): AsyncGenerator<AdapterEvent>;
  parseResponse?(response: Response, budget: TranslatorBudget): Promise<AdapterEvent[]>;
  runTurn?(parsed: OcxParsedRequest, incoming: IncomingMeta, emit: (event: AdapterEvent) => void): Promise<void>;
}
```

`buildRequest` 把 `OcxParsedRequest` 轉成上游 HTTP 請求；`parseStream` / `parseResponse` 把 provider
回覆轉回內部 `AdapterEvent`。`fetchResponse` 允許 adapter 自己負責重試和 timeout；`runTurn` 支援
無法表示成一次 HTTP fetch 加一條回應流的 transport。隨後
[`bridge.ts`](/zh-tw/reference/architecture/#the-bridge) 把 event 轉成 Responses SSE。

## 翻譯後 Responses 路由上的外部任務輸入

Codex task coordination 可以用帶有非空 `id`、`name` 與 `namespace` 欄位、且沒有 `call_id`
屬性的 `function_call_output` 傳入輸入。OpenCodex 會在 adapter 轉換之前，把這個完整的
envelope 對映成一則使用者訊息。其輸出必須是非空文字，或是完全受支援的文字與
`input_image` URL part 陣列。文字與圖像順序會被保留；圖像 detail `original` 對映為 `high`。

空內容、格式錯誤或不透明的 part、僅有 file-id 的圖像，以及不完整的 envelope 仍視為無效。
一般的 function/custom 工具結果仍需要非空的 `call_id`。這個 envelope metadata 只是標示一種
相容形狀，不會授予額外權限。原生 passthrough 與 compaction 保留各自的原始 body 規則。

## `openai-chat`

**目標：** OpenAI **Chat Completions**（`POST {baseUrl}/chat/completions`；`baseUrl` 結尾的
`/chat/completions` 或 `/` 會先被移除）以及所有相容 provider——xAI、Kimi、DeepSeek、GLM、
Groq、OpenRouter、Ollama（本機）等。
**認證：** `key`（Bearer）。

對 xAI 而言，解析後的上游 adapter 可能是 `openai-chat` 或 `openai-responses`，取決於模型預設
值與明確的 `modelAdapters` override。兩者都支援公開的 xAI API key 認證與 Grok CLI OAuth。
usage log 的 [`attempts[].credentialSource`](/zh-tw/reference/management-api/) 會跟隨那個
解析後的 transport，而不是從傳入協定推斷訂閱歸屬。

- 把內部訊息轉換成 OpenAI role；工具對映為 `{type:"function", function:{…}}` 和
  `tool_choice`（`auto`/`none`/`required` 或具名函式）。
- **工具結果圖像**會在工具回合結束後，放進一則後續的使用者 vision 訊息（`image_url`
  part）中送出，因為 `role:"tool"` 內容只能是文字；`[image]` marker 仍留在工具訊息中作為
  錨點。
- **重寫 Codex 的 GPT-5 身份提示詞**，改成與模型無關的介紹，避免路由模型自稱 OpenAI。
- 精確層級不可用時，**把 `reasoning_effort` 限制到模型公佈的子集**；除非 provider 顯式設定
  alias，`xhigh` 與 `max` 保持為不同標籤。對於 `provider.noReasoningModels` 中的 id，adapter
  會**完全省略**該引數。
- 流式輸出 `delta.content`（文字）、`delta.reasoning_content`（thinking）和
  `delta.tool_calls[]`，並收集 `usage`。列在 `reasoningDetailsModels`（MiniMax M 系列）中的
  provider 改為讀取結構化的 `delta.reasoning_details` 片段，其中 `text` 以累積快照方式抵達，
  經前綴差異比對後還原，並把保留的 reasoning 重播為 `reasoning_details` 陣列。
- ClinePass 使用經即時驗證的 gateway 格式 `reasoning: { enabled: true, effort }`（關閉
  reasoning 時為 `{ enabled: false }`）；其公開 API 文件目前未說明這個請求形狀。adapter 會
  保留請求的 `low`、`medium`、`high`、`xhigh`、`max` 層級，接受來自 `delta.reasoning_content`
  或 `delta.reasoning` 的 reasoning delta，以 `stream_options.include_usage` 請求串流
  usage，並從非串流回應 envelope 讀取 usage。

串流工具呼叫在 provider 先送出一個 ID、之後把該 ID 與一個 index 建立關聯、再送出僅含
index 的引數片段時，仍會保留身分：這些片段會被組裝成一個具有原始名稱與完整引數的呼叫；
並行呼叫維持各自獨立的身分。出現串流工具呼叫 index 時，必須是非負的安全整數。非數字值，
以及負數、小數或不安全的數字，會在身分比對之前以上游錯誤終止串流。缺失與 null 的 index
仍維持「無 index」佔位狀態；數字字串不會被強制轉型。

## `ollama-native`

**目標：** Ollama 自身的 **Chat API**（`POST /api/chat`），而非其 OpenAI 相容介面。內建的
`ollama-cloud` 提供者由 registry 選擇到此 adapter；也可以在另外命名的自訂 / 自架 Ollama
提供者上設定 `adapter: "ollama-native"`。
**驗證：** cloud / 自訂端點使用 `key`（Bearer）；loopback 或 `authMode: "local"` 端點不會
收到任何憑證。

- **registry 選擇具有決定性。** 內建 `ollama-cloud` 列保留 `https://ollama.com/v1` 作為
  `/v1/models` 動態探索的基礎 URL，同時推論會正規化到 `POST https://ollama.com/api/chat`。
  對該提供者列，設定中的 `adapter` 會被丟棄。一般內建本機 Ollama 仍在 `openai-chat`；為本機
  或自架端點選擇 `ollama-native` 是明確的提供者設定決定，並依主機判別，因此非 Ollama 目的
  地不會被默默改寫。
- **模型中繼資料：** `/v1/models` 不攜帶任何模型級中繼資料，因此在正典 Ollama Cloud 上，
  提供者會透過 *有界限的* `POST /api/show`（每回應 256 KiB、每請求 8 秒、並行 4、48 個請求、
  整階段 12 秒期限）補上每個被探索 id 的真實 context window 與 vision 能力。show 請求同源
  且絕不跟隨重新導向；失敗只會降級該模型，不會讓探索本身失敗。
- **串流：** Ollama 原生 NDJSON。文字與 `message.thinking` delta 隨到隨轉發；回合僅在
  `done: true` 終止記錄上完成，緩衝的 `done: false` 或缺少終端會完全抑制部分文字與工具呼叫。
- **Reasoning：** 對映到 Ollama 原生 `think` 欄位（`low`/`medium`/`high`/`max`，外加布林值），
  依模型宣告的層級夾限，並遵守上游設定的 `__omit__` sentinel 語義。
- **圖像：** 在模型具備 vision 能力時，原樣放進訊息的 `images` 陣列送出；video 會被拒絕而非
  誤送，遠端圖像 URL 不會被擷取。
- **工具：** 以 Ollama 原生形狀宣告；串流 tool call 是 `arguments` 為物件的整呼叫記錄，
  tool result 重播按 call id 與工具名嚴格配對。`tool_choice: "none"` 與 `auto` 正常運作；
  **`required` 或精確名稱選擇會 fail closed**，因為 Ollama 的 `/api/chat` 沒有可用來強制它的
  `tool_choice` 欄位。
- **正典 Ollama Cloud 上拒絕結構化輸出。** Ollama 目前在文件中說明其 Cloud 不支援結構化輸出，
  且 Cloud 不會強制 `format` 欄位，因此 OpenCodex 會讓該請求顯式失敗，而不是在 schema 指定的
  請求上回傳不受約束的散文。本機 / 自訂 `ollama-native` 端點保留 Ollama 原生的 `format` 映射
  （`json_object` → `"json"`，`json_schema` → schema 物件本身）。

## `openai-responses`

**目標：** OpenAI **Responses API**。**`passthrough: true`** —— 一般會轉發原始請求 body 與
回應，對路由過的 gateway 有少量相容性改寫。
**認證：** 正典 OpenAI 的 `forward` 只會中繼安全的呼叫端 header allowlist；非正典的
`forward` 使用設定的靜態 header，不會中繼呼叫端 authorization；`key` 使用設定的 provider
key。

Adapter 的選擇不會決定上游 transport。符合資格的請求可以使用
[上游 WebSocket proxy 路由](/zh-tw/reference/proxy-formats/#json-and-sse-output)；無效或不受支援的
WebSocket proxy 設定會退回 HTTP/SSE。以 HTTP fetch 為基礎的 Responses 處理使用 Bun 的 HTTP
proxy 規則，不會繼承 WSS 專用的 `ALL_PROXY` 退路。

非正典的 Responses gateway 會收到 Codex 的用戶端執行 `tool_search` 宣告，形式是一個避免
碰撞的公開 function 工具。對應的請求歷史與 JSON/SSE function call 會被轉換回用戶端可見的
私有 `tool_search` 生命週期。正典 OpenAI forward 則保留原生的私有型別不變。

`authMode` 不是 `"forward"` 的請求，會把 Codex 的 `agent_message` 條目（其內容為受支援的
純文字 part 之非空陣列）轉換成公開的使用者訊息，同時保留這些 part 與可讀的
作者/收件者中繼資料。`agent_message` 是 ChatGPT Codex backend 私有的欄位，而目前已知的
路由目的地會以 `422 unknown item type "agent_message"` 拒絕整個 body——而且因為 Codex 每回合
都會重播子代理歷史，這個失敗會在該對話串剩餘部分一再重複。這個轉換不會更動加密或未知的
內容。使用 `authMode: "forward"` 的 provider 會保留這些條目不變。對於使用標準連接埠的
HTTPS `api.x.ai` 或 `cli-chat-proxy.grok.com` 上的 xAI Responses，非空的字串型子結果也會
轉換成保留精確空白與換行的 `input_text` part。其他目的地保留字串值條目；空白字串與混合
加密/未知 part 不會被部分轉換。獨立選用（opt-in）的加密任務復原行為另見
[agent 訊息](/zh-tw/reference/configuration/providers/#routed-agent-messages)。

正典 ChatGPT Codex forward 目的地還會規範化兩種其較嚴格的 backend 會拒絕的公開 Responses
形狀：`input` 中完全為文字的 `system` 訊息會依請求順序附加到頂層的 `instructions` 字串，而
頂層的 `truncation` 欄位會被移除。這個改寫只限定在該目的地。key 認證的公開/自訂 Responses
provider 與非正典 forward gateway 都會保留這兩個欄位不變；多模態的 system 訊息絕不會被部分
折疊或悄悄丟棄。

對於正典 forward 的延續請求，僅限用戶端使用的 `prompt_cache_breakpoint` 屬性會在有界的
遍歷限制內被遞迴移除。當 `store: false` 時，`item_reference` 列也會被省略，因為目的地無法
解析它未持久化的條目。Function/工具的 `call_id` 配對與 `reasoning.effort` 會被保留。

[Luna Reserve 相容性](/zh-tw/reference/cli/providers-accounts/#luna-reserve-alongside-routed-models)
使用的是這條正典 ChatGPT-forward 路徑，而不是 key 認證或任意的 Responses gateway。它保留
這裡描述的安全呼叫端 header allowlist 與目的地限定的請求規範化。OpenCodex 會在自有主帳號的
usage 查詢上傳送其 Reserve 能力標頭；該標頭本身不是權限。符合資格的相容性請求會在派送時
重新檢查憑證綁定的授權。對話與 compaction 受支援；vision helper、web-search helper 與獨立
搜尋中繼則不支援。

對於 `key` 認證，[`retryOn429`](/zh-tw/reference/configuration/) 在這裡同樣適用：pre-stream
的 429 會等待，並在任何其他處理之前，用同一把 key 重播完全相同的請求，與轉換型
`openai-chat` / Anthropic 請求路徑完全一樣。自訂的 `runTurn` transport 不在 HTTP 重試迴圈
範圍內。

- DeepSeek 的 stateless Responses parser 會收到按 provider 範圍的歷史正規化：hook 注入的內容
  會移動到明確的 tool-call/result 批次之後。並行呼叫保持在其對應輸出之前分組，因此每個呼叫
  都留在承載推理的 assistant 回合中。寬容的 provider 和歧義的（重複、缺失或亂序的）call ID
  保留原始輸入順序。

- `forward` URL → `{baseUrl}/responses`。`key` provider 預設保留原有的 `{baseUrl}/v1/responses`
  構造。
- `key` provider 可設定經過驗證的相對 `responsesPath`；adapter 會移除 `baseUrl` 末尾的一個
  `/`，並向 `{trimmedBaseUrl}{responsesPath}` 傳送請求。Ark Agent Plan 使用
  `baseUrl: "https://ark.cn-beijing.volces.com/api/plan/v3"` 和 `responsesPath: "/responses"`。
- `forward` 模式只會轉發安全的 header allowlist（`FORWARD_HEADERS`）：authorization、ChatGPT
  account id 和 OpenAI beta/originator/session header。這條 ChatGPT 登入路徑也為
  [sidecar](/zh-tw/guides/sidecars/) 提供支援。

## Command Code session affinity

OAuth 的 `command-code` adapter 會從用戶端 thread 身分推導出一個不透明的 `x-session-id`，
其次是 reasoning-replay 對話身分。兩者都沒有時，只有在整合明確把某個 prompt-cache key
歸類為屬於單一對話時，才會使用該 key。共用或未分類的 cache key 不會建立 session
affinity；沒有可用身分的請求會收到一個全新的 session ID。復原與快取歷史重播會保留這個
分類結果。

使用 API key 的 `commandcode` provider 採用 `openai-chat` adapter，並支援轉發
`prompt_cache_key`。這與 OAuth adapter 的 session header 是分開的機制，也不保證會命中
provider 的快取。

## `anthropic`

**目標：** Anthropic **Messages**（`/v1/messages`）。
**認證：** `key`（預設 `x-api-key`，或設定 `apiKeyTransport: "bearer"` 時使用
`Authorization: Bearer`）或 `oauth`（Bearer + `anthropic-beta`，用於 Claude Pro/Max）。

- 把訊息轉換成 Anthropic content block（text、base64 image、`tool_use`、`thinking`）。
- 轉換型 Anthropic Messages 的 reasoning 重播與請求轉換 budget 共用額度，包括編碼/解碼的
  複製開銷。超出額度的請求會回傳帶有 `translation_buffer_limit` 的 HTTP 413；簽章與不透明的
  reasoning 資料絕不會被截斷以符合額度。原生 Anthropic passthrough 使用其獨立的 body-size
  合約。
- **Extended thinking 計算：** Anthropic 要求 `max_tokens > thinking.budget_tokens`。adapter 把
  reasoning effort 對映成 budget（minimal 1024 … max 32000），再計算留有輸出餘量的安全
  `max_tokens`；啟用 thinking 後會**移除 `temperature`/`top_p`**，因為 Anthropic 禁止此組合。
- **結構化輸出：** 帶有 `type: "json_schema"` 的 Responses `text.format` 與 Chat Completions
  `response_format` 請求會變成 Anthropic 的 `output_config.format`。該格式會合併進既有的
  adaptive-thinking 輸出設定，並保留相容的 `output_config.effort`。路由過的 Anthropic
  Messages 請求透過已儲存的 OAuth 轉換保留相同格式。adapter 對映 Anthropic TypeScript SDK
  支援的 JSON Schema 子集：不支援的限制條件會移入 `description` 作為模型指引，`oneOf` 會
  變成 `anyOf`，物件 schema 會加上 `additionalProperties: false`。根層級的 `$ref` 會保留其
  相鄰的 `$defs`，讓本機參照維持可解析。OpenAI envelope 欄位如 schema `name`、envelope
  `description` 與 `strict` 不屬於 Anthropic wire 格式的一部分。沒有 schema 的 JSON object
  模式在 Anthropic 沒有對應，不會被轉換。
- 始終傳送 `anthropic-version: 2023-06-01`。流式輸出 `content_block_delta`（`text_delta`、
  `thinking_delta`、相容的 `reasoning_delta`、`input_json_delta`）。SSE 解碼器會跨 fetch
  chunk 保留事件狀態，並接受沒有結尾換行的終止 `message_stop`。
- 對於帶有用戶端工具的路由 Anthropic Responses 回合，一個有界的終止防護會偵測高信心情況：
  使用者要求了一個動作，但 Claude 以「已執行」的宣稱結束卻沒有工具呼叫。它最多執行一次
  內部續寫；一般回答、澄清提問、使用工具的回合與 transport 未完成的回應都不會被自動重試。

## `google`

**目標：** Google **Gemini**、**Vertex AI** 和 Antigravity **Cloud Code Assist**。AI Studio 使用
`/v1beta/models/{model}:streamGenerateContent`，其他模式使用各自的 Google 原生 endpoint。
**認證：** 根據 `googleMode` 選擇 API key、Vertex ADC 或 Google Antigravity OAuth。

- **地區拒絕是權限錯誤，不是無效請求。** Google 會以 HTTP 400
  `FAILED_PRECONDITION: User location is not supported for the API use.` 拒絕不支援的地理
  或資料中心地區。proxy 會把這回報為 `… location not supported: …`，並分類成
  `permission_error`、代碼 `location_not_supported`，讓用戶端不會把「網路地區被拒」誤讀成
  格式錯誤的 prompt。直接的 HTTP 回應保留上游的 400；僅有訊息的終止路徑會推斷為 403（權限
  類別）。這項限制來自 Google 本身——proxy 不會繞過它。
- 系統提示詞 → `systemInstruction`；訊息 → `contents[]`（assistant → `model`）；工具 →
  `functionDeclarations`；data URL 圖像 → `inline_data`。
- Gemini 省略 tool-call id 時會合成 id。Vertex 與 Antigravity 會保留並重放不透明的
  `thoughtSignature` 值，讓工具結果的延續回合維持 Gemini reasoning 的連續性。簽章快取會
  快照到設定目錄，因此延續也能撐過 proxy 重新啟動。
- **格式錯誤的回應形狀會顯式失敗。** 若宣稱的 candidate、其 `content` 或 `content.parts`
  不是文件所述的容器，該回合會以 `google response contained invalid …` 錯誤終止，訊息會
  指名結構性原因與違規值的型別——但絕不包含其內容。缺席與損毀分開處理：缺席的、`null`
  的或空的 `content` 或 `parts` 仍會讓回合正常完成；`candidates` 缺席、`null` 或為空的
  串流 chunk 會被跳過，讓回合在稍後的終止 frame 上完成；完全不含任何 candidate 的緩衝回應
  則回傳 `google response contained no candidates`。根層級的 `data: null` keepalive frame
  仍會被當作填充而跳過。
- 工具呼叫批次由緊接其後、包含每個可表示呼叫恰好一個有序 `functionResponse` 的單一使用者
  回合收尾。被中斷的歷史會收到明確的缺失結果標記；重複或單獨出現的結果會以標記文字（及
  圖像旁支）保留，而不是以無效、未配對的 `functionResponse` part 發出。
- **內嵌圖像輸出：** 當模型是明確支援圖像的 chat id 之一（`gemini-3.1-flash-image`、
  `gemini-2.0-flash-preview-image-generation` 或 `gemini-3-pro-image-preview`）時，adapter
  會傳送 `responseModalities: ["TEXT", "IMAGE"]`。獨立的媒體生成 id（如
  `gemini-3-pro-image`）不包含在內。回傳的 `inlineData` part 會具現化到設定的 OpenCodex
  `artifacts/` 目錄下，並以 markdown 圖像連結的形式呈現為已認證的不透明路由
  `/v1/opencodex/artifacts/<id>`（不是 `file:` URI 或主機檔案系統路徑）。每張圖像上限
  50 MB，每個回應上限 100 MB 的解碼資料；格式錯誤的 base64 payload 會被拒絕。artifact
  數量超過 200 個檔案時會自動清理。

## `kiro`

**目標：** Kiro 使用的 Amazon CodeWhisperer Streaming `GenerateAssistantResponse` 服務
（`https://runtime.{region}.kiro.dev/`）。
**認證：** 作為 Bearer 的 Kiro OAuth access token，加上來自 Kiro credential 的 region/profile
metadata。

- 建置 Kiro `conversationState`，對映 Codex 工具和工具結果，並傳送 Kiro wire 支援的 image
  block。
- 把來自同一個原始工具呼叫的相鄰輸出合併成一個 Kiro 結果。文字維持順序，圖像保留既有的
  每則訊息上限，任何錯誤旗標都會保留。使用者、開發者、assistant 或另一個工具的輸出會結束
  這個群組。對映到同一個正規化 Kiro ID 的不同原始 ID 會被拒絕。
- 合併後的輸出會保留真實文字與失敗資訊，而不會為稍後出現的空白 chunk 插入空輸出提示。
  單一結果保留其既有的正規化；整個群組皆為空文字時只會收到一個回退值，含圖像或錯誤旗標時
  用語會保持中性。
- 把用戶端的 `parallel_tool_calls: true` 值視為許可而非 wire 要求。Kiro 仍維持序列化：路由
  目錄不會公佈任何 parallel-tool 能力，adapter 也不會向上游傳送 parallel 控制欄位，但一般
  的 Codex 工具回合不會僅因用戶端允許並行而被拒絕。
- 接受非結構化輸出的 Responses `text` 控制——`text.verbosity` 與
  `text.format: {"type":"text"}`——但不會轉發它們。Kiro 沒有對應的 wire 欄位，因此這些值
  會被忽略而非拒絕。結構化輸出（`json_schema` 或 `json_object` 型別的 `text.format`）仍會
  被拒絕：Kiro 的 wire 無法限制回應形狀，否則期待 JSON 的呼叫端只會收到散文。
- 解碼 `application/vnd.amazon.eventstream`，重建 text/thinking/tool event，檢測被截斷的
  工具 JSON，並因為上游不回傳 token 數量而估算 usage。
- 自訂 `baseUrl` 時原樣使用。正典的 `runtime.{region}.kiro.dev` URL 會跟隨匯入憑證的 API
  地區；只有這個正典形狀才符合資格，在 endpoint、簽章、DNS 或連線失敗後可一次性回退到
  `q.{region}.amazonaws.com`。
- 擁有可重播、安全的連線重設復原、上述單一符合資格的 endpoint 回退、HTTP 401 後的一次
  OAuth 重新整理/重播，以及對暫時性 Kiro 429 的有界復原。共用的冷卻與單一的冷卻後探測會
  防止並行請求耗盡各自獨立的重試額度；硬性 quota 失敗與一般服務錯誤不會被重播。
- 其非串流 parser 會為 web-search loop 排空同一個 event stream。
- 回報每帳號用量。`https://management.{region}.kiro.dev/` 上的
  `AmazonCodeWhispererService.GetUsageLimits` 會回傳方案額度，成為該帳號的月配額視窗；
  免費試用餘額會回報為自己獨立的視窗。地區來自帳號的 profile ARN，其次是其儲存的
  API/SSO 地區。無法讀取或無法辨識的回應會回報為未知，而不是回報為零用量；超額仍可用的
  帳號不會僅因超過額度就被視為已耗盡。這個操作未被 AWS 記載於文件中，請把數字當作
  best-effort。
- 參與多帳號輪替。兩個以上已登入的 Kiro 帳號會啟用 429 時的自動 failover，輪替會優先選擇
  剩餘額度最多的帳號；額度確實耗盡的帳號會被冷卻直到其視窗重置（介於五分鐘到一天之間），
  而不是每分鐘都重試。每個輪替中的 bearer 都攜帶自己的 profile ARN 與地區。

### 完成語義

Kiro 的 assistant 文字本身沒有可靠的回合結束階段。其終止的 `metadataEvent` 可以攜帶原生的
`stopReason`，但 Kiro 可能把進度散文標記為 `END_TURN`。在啟用工具的回合中，`END_TURN` 與
`STOP_SEQUENCE` 因此只能證明推理已停止；一般文字仍是 commentary，並進入唯一的、有界的
完成驗證。

`END_TURN`、`STOP_SEQUENCE` 或缺失的 stop reason 可以走相容路徑。其他明確的原因已經在上游
終止了推理，因此 adapter 會直接回報它們，而不是再花一次模型請求：輸出 token 上限表現為
用戶端可以續寫的 incomplete output；context window 耗盡表現為不可重試的 context-length
錯誤，而不是被截斷的輸出。過濾與 guardrail 停止表現為 filtered incomplete output；沒有
真實工具呼叫卻出現的 `TOOL_USE` stop 會被回報為矛盾，而不是被當作進度。

當存在一般用戶端工具時，opencodex 會為上游請求加入一個私有的 `codex_kiro_final_answer`
工具；進度文字會以 commentary 的形式串流，且不能結束回合。adapter 會消費這個私有呼叫，
把它的回答發出為最終文字，並且絕不向 Codex 或 Claude Code 揭露這個私有工具。因為 stop
reason 只在串流結尾才會出現，啟用工具回合中的 assistant 文字會被保留，直到出現真實工具
呼叫或串流結束，然後才把它釋出為 commentary，除非私有工具已經提供了最終答案。web-search
sidecar 啟用時，已釋出的 commentary 仍會在終止 event 之前串流；只有判斷模型是否要求
合成搜尋所需的 event 才會被緩衝。

模型無法在沒有回答的情況下繼續，這種情況本身也算一個最終答案。注入的契約告訴路由模型：
當它需要一個只有使用者能給出的決定、一項資訊或一次澄清時，應該透過
`codex_kiro_final_answer` 送出那個問題並停止，而不是把問題寫成一般文字後繼續。這樣的回合
會像任何其他已完成的回答一樣抵達：以結束回合的最終文字呈現，而不是 commentary，也不是
用戶端工具呼叫。若沒有這個機制，契約只描述了「仍在進行」與「已完全完成」，而持有阻塞性
問題的模型無法表達——實際觀察到的結果是：一則訊息中同時出現問題與自我推翻，接著又是同一次
推理發出的另一個工具呼叫。

若 Kiro 在沒有呼叫完成工具的情況下停止，adapter 會做一次續寫。純 reasoning 的重試會保留
原本合法的使用者/工具結果回合，而不是生造一則空的 assistant 訊息；可見的進度會以一個
adapter 自有的非空指示重播。傳輸之前，產生的對話會被檢查角色是否交替、結構性回合是否
非空，以及工具使用/結果 id 是否配對。空的工具輸出會收到一個中性的非空佔位內容。這個重試
不能遞迴：空的或純 reasoning 的重試會回傳為可重試的 incomplete，而真正的用戶端工具呼叫
則讓回合保持開啟。完成工具的回答一律以 `final_answer` 發出，即使它與先前的 commentary
完全重複，因為階段的正確性比表面上的去重更重要。不含工具的請求維持一般的文字完成行為。

### Reasoning effort

GPT-5.6 系列使用 `additionalModelRequestFields.reasoning.effort`，`claude-opus-5` 使用
`additionalModelRequestFields.output_config.effort`。`gpt-5.6-luna` 和 `gpt-5.6-terra`
只透過原生欄位傳送已驗證的 `low`、`medium`、`high` 和 `max`。
這兩個模型的原生 `xhigh` 尚未驗證，因此仍使用原有的有界 thinking 指令模擬。
`gpt-5.6-sol` 和 `claude-opus-5` 保留現有原生檔位（`low`、`medium`、`high`、`xhigh`、`max`）。
其他 Kiro 模型使用模擬推理；提供 effort 選項不代表原生支援。

## `cursor`

**目標：** 預設經 HTTP/2 Connect streaming 連往 `api2.cursor.sh` 的
`agent.v1.AgentService/Run`。設定 `upstreamHttpVersion: "http1.1"`（或 `"h1"`）時，改用
Cursor 的 HTTP/1.1 相容配對：伺服器輸出用 `agent.v1.AgentService/RunSSE`，用戶端訊息用
`aiserver.v1.BidiService/BidiAppend`。
**認證：** 來自 `provider.apiKey` 或轉發 authorization header 的 Cursor OAuth/access token。

- 使用 `runTurn`，而不是常規 fetch/parse 路徑。請求、server event、工具引數、usage
  checkpoint 和 client reply 由 `cursor/gen/agent_pb.ts` 中的 `@bufbuild/protobuf` schema 編碼，
  並 frame 成 Connect message。
- 經 content-addressed blob 重放對話狀態，把 server tool call 對映回 Codex，用 protobuf
  `GetUsableModels` RPC 發現即時 Cursor 模型，並且只在 run request 尚未 commit 到 wire 前重試。
- 一次成功的無工具回合之後，adapter 會把 Cursor 回傳的 ConversationStateStructure 存進
  process-local 儲存，並在下一次通過驗證的線性延續中重用該 checkpoint，而不是重建完整的
  root 歷史。工具結果回合會在已知涵蓋訊息邊界時，重用最後一個已完成回合的 checkpoint 加上
  尚未涵蓋的尾段。無參照的前綴查找需要一個記得住的 Cursor 對話或穩定的用戶端 thread
  （包含有界的 Desktop session/thread 回退），以及一個屬於同一個 provider 對話的
  checkpoint；否則會完整重放。Compaction、helper/shadow 隔離、帳號/模型不符、缺失參照、
  解碼失敗、強制重新開始的復原，以及 invalid_argument 重試都會回退到既有的完整重放。
  process 重新啟動會清空這個記憶體儲存並完整重放。Cursor Connect 仍不公開可信賴的
  `cache_read_tokens`，所以 OpenCodex 的 usage 不是快取命中計數器。這個有界的 Desktop
  回退只會儲存 process-local、由 HMAC 導出的擁有者標記；原始的 session/thread header 與
  OAuth/authorization 資料絕不會寫入 checkpoint 狀態。Cursor 以 OAuth 為基礎的即時
  transport 與帳號過濾後的模型發現仍屬實驗性；登入與 transport 設定見
  [provider 指南](/zh-tw/guides/providers/) 與
  [Cursor provider 設定](/zh-tw/reference/configuration/providers/#cursor-provider-adapter-cursor)。
  checkpoint 重用本身是自動的，沒有使用者可設定的選項。
- 對即時模型探索與推論都遵循 `upstreamHttpVersion`。`auto`、`http2` 與 `h2` 保留既有的
  HTTP/2 transport；只有 `http1.1` 與 `h1` 會選用相容模式。
- 把 Cursor Router 公開為 `cursor/auto`，外加明確的 `cursor/auto-cost`、
  `cursor/auto-balance` 與 `cursor/auto-intelligence` 項目。明確的等級會編碼在
  `requested_model.parameters` 中，而舊有的 `cursor/auto` 項目維持帳號/團隊的預設值。
- 一般的 `cursor/grok-4.5` 層級會使用 Cursor 精確的即時探索 wire id
  （`cursor-grok-4.5-low`、`-medium` 或 `-high`）傳送。`cursor/grok-4.5-fast` 仍可選擇，
  傳送時使用正典的 `grok-4.5` 模型，搭配獨立的 `effort` 與 `fast=true` 參數。
- Cursor 原生本機 filesystem/shell/network 執行預設被拒絕。顯式 `mcpServers` 與
  `desktopExecutor` 整合分別需要 opt-in；`nativeLocalExec: "on"` 會啟用更廣泛的內建
  executor，並繞過 Codex 審批和 sandbox 語義；舊的 `unsafeAllowNativeLocalExec: true` 僅在
  `nativeLocalExec` 未設定時等效。
- 拒絕回覆是一種措辭跟隨請求目錄的靜默重新導向。目錄中若帶有 `shell_command`/
  `exec_command` 或統一的 `exec`，就維持 bridge 的措辭；目錄中兩者皆無時——例如只公開自己
  Responses 工具的 orchestrator 用戶端——則會重新導向到請求中實際存在的 wire 名稱，讓模型
  指向一個真實存在的工具，而不是它看不到的別名。
- 已識別的 Cursor 資料政策關卡，會連同其標題、需要採取的動作，以及 Cursor Dashboard 的
  審核 URL 一起回報，而不是一句原始的 `failed_precondition: Error`。識別範圍僅限已知的
  結構化細節：未知或格式錯誤的細節會保留一般的 Connect 錯誤，不會轉發或執行任何上游文字、
  按鈕、URL 或同意動作，而且該失敗維持不可重試。審核並接受資料政策仍是使用者在 Cursor 本身
  的動作。

Codex 相容的 shell schema 保留 sandbox 權限、justification、可重用的前綴規則與登入模式。
Freeform 工具公開一個必要的字串 `input`，並保留其工具專屬的指引（例如必要的 patch
envelope）；`exec_command` 與 `shell_command` 這兩個裸名稱保留給非 freeform 的 shell
bridge。若自訂的 freeform 工具使用其中任一名稱，請為它加上命名空間。這些 schema 宣告不會
授予審批，也不會改變執行政策。

## `devin`

**目標：** Cognition 的 `exa.api_server_pb.ApiServerService/GetChatMessage`（`server.codeium.com`，Connect 串流）。
**認證：** 來自 `provider.apiKey` 或轉送 authorization 標頭的 Devin/Cognition API 金鑰。登入會先嘗試匯入已安裝 Devin CLI 已持有的憑證：`devin auth login` 會完成 CLI 自身的 PKCE 登入並把 `devin-session-token` 寫入它自己的 `credentials.toml`，這與 `SeatManagementService.RegisterUser` 為瀏覽器登入簽發的憑證相同。沒有可用的 CLI 憑證時，登入回退到 Auth0 瀏覽器頁面，再透過 `RegisterUser` 把貼上的權杖換成長期金鑰。`devin-cli` 僅作為已棄用的別名保留：`ocx login devin-cli` 仍會路由到 `devin`，以舊 id 儲存的設定會在啟動時被重寫。

- 使用 `runTurn` 而非一般的 fetch/parse 路徑。請求與伺服器事件由 `devin/cloud-direct/wire.ts` 中手寫的 protobuf 分幀處理；一般的 `buildRequest` / `parseStream` 路徑已停用。
- 透過 `GetCascadeModelConfigs` 進行即時模型發現；靜態種子清單會依帳號的即時名冊過濾，方案未涵蓋的模型會在清單階段就被濾除，而不是到請求時才失敗。
- 工具定義編碼在請求中，工具呼叫事件從回應串流解碼。Cognition 對每個工具說明設有長度上限（6,998 字元）與完全比對的封鎖清單；adapter 會在編碼前改寫已知觸發詞並截斷過長說明。
- Devin/Cognition API 金鑰不會自動更新。金鑰過期或被撤銷時，請重新執行 `ocx login devin`。
- 只有在使用 CLI 匯入路徑時，本機才擁有憑證。無論哪條路徑，回合本身都會送往 Cognition，因此匯入路徑與瀏覽器登入路徑唯一的差異只在憑證的來源。請用
  `curl -fsSL https://cli.devin.ai/install.sh | bash` 或 `brew install --cask devin-cli` 安裝 CLI，執行一次
  `devin auth login`，再新增這個 provider。
- 較早的版本曾在 id `devin-cli` 下提供第二個 adapter，把回合當成對本機 `devin acp` 子行程的 Agent Client Protocol session 來執行。該 adapter 已移除。仍引用該 adapter 的已儲存設定會在啟動時被重寫為 `devin`，包括像 `"devin-acp"` 這種自訂命名的列。
- 這個聊天請求是校準過的，不是猜出來的。三件事共同把關：憑證是 session token 雙份、以連字號串接放進 `Authorization: Basic` header，而 protobuf body 本身仍保留一份；請求 envelope 以未壓縮方式送出；`Metadata` 第 31 個欄位帶有一個 732 字元的裝置指紋，服務只檢查其長度而非內容。在 `CompletionConfiguration` 內部，第 2 個欄位是輸出上限，第 3 個欄位是 context window；把這兩者對調會讓每個回合都以一個難以理解的 `invalid_argument` 失敗。剛好等於 0 的 temperature 會被拒絕，因此會被夾限到可接受的最小值。
- 屬於實驗性、非官方的橋接；預設不會出現在儀表板預設清單中。登入說明見 [provider 指南](/zh-tw/guides/providers/)。

對於 SWE-2，明確指定的 reasoning effort 會覆寫模型 id 中的 effort 後綴。例如
`swe-2-high` 搭配 `medium` 會選擇原生的 `swe-2-medium` UID；`xhigh`、`ultra` 與 `max` 會選擇
`swe-2-max`。低於 Medium 的值會選擇 Medium，且不會停用 SWE-2 的 reasoning。沒有明確指定
effort 時，帶後綴的模型 id 會被保留。這適用於共用 adapter 下的每一個 Devin 帳號，無論
credential 是由哪條登入路徑鑄造的；其他模型家族維持既有的後綴優先權。

## `azure-openai`（別名：`azure`）

**目標：** **Azure OpenAI**。封裝 `openai-responses`，因此同樣是 `passthrough: true`。
**認證：** 用 `api-key` header 進行 `key` 認證，而非 Bearer。

- 把請求建置交給 Responses passthrough，驗證 `baseUrl` 不含未解析的 template placeholder，
  再用 `api-key` 替換 `Authorization`。設定的 URL 直接指向 Azure v1 Responses API，因此 adapter
  不會追加 `api-version`。
- 與 Responses 共用針對其他 provider 所產生推理狀態的復原：收到 `400 invalid_encrypted_content`
  後，去掉該狀態（加密內容與推理項的 `rs_…` id）並只重送一次。

## 圖像工具（`image.ts`）

支援視覺的 adapter 共用以下 helper：

- `parseDataUrl(url)` —— 把 `data:<type>;base64,<data>` URL 拆成 `{ mediaType, base64 }`，供
  Anthropic/Google image block 使用。
- `contentPartsToText(content)` —— 為純文字工具訊息把 content part 扁平化成文字。未描述的圖像
  會變成簡短的 `[image]` marker，而不是導致 token 暴漲的 base64 blob。

## Grok Build 終止快照

帶有 `x-opencodex-grok: 1` 標記的請求，會選用一項範圍狹窄的 Responses 終止修復。若
`response.completed.response.output` 缺失或為空，opencodex 可以從真實、具有唯一索引、
連續的 `output_item.done` item（其原始欄位符合受支援的形狀）重建它。單靠 delta 不會產生
輸出。格式錯誤、矛盾、重複、有缺口或過大的證據，都會讓空的終止狀態維持不變；失敗與
未完成的回應絕不會變成成功。

這個標記是用戶端自行選擇的相容性選項，不是已認證的身分或權限授予。未標記的用戶端維持
既有行為。這項修復會在獨立的 provider `responsesSnapshotRepair` 選項之前執行，且不會
啟用那項更廣泛的生命週期修復。既有的 tool-search、custom-tool、function-completion 與
未宣告工具的處理順序維持不變。
