---
title: "邊車：Web Search 與 Vision"
description: 透過原生 ChatGPT 邊車，讓路由模型獲得真實 web search，並讓純文字模型理解圖像。
---

不是所有路由模型都提供託管 **Web Search** 或原生**圖像輸入**。opencodex 用兩個邊車補齊這些能力。
兩者都支援 ChatGPT 登入（`forward`）provider 或已儲存的 Anthropic OAuth provider；web search
另外還可以透過明確的 `xai` backend 使用已儲存的 Grok OAuth。邊車錯誤會變成長度受限的工具結果或
圖像提示，不會讓整個 turn 失敗。

:::note[自動選擇後端]
明確的 `backend` 設定優先。`backend` 省略時，兩個邊車的預設值不同：**web search** 一律預設
`openai`——只有明確設定時才會執行 `anthropic`。**Vision** 在已啟用的 Anthropic OAuth provider
有一個未標記 `needsReauth` 的可用帳號時預設 `anthropic`，否則預設 `openai`。明確指定 `anthropic`
卻沒有該憑證時會關閉失敗。明確指定 `xai` 需要一個可用的已儲存 Grok OAuth 帳號，且不會退回。
`openai` 同時需要 ChatGPT 登入驗證與已啟用的 `forward` provider。
:::

### 額外的 web-search 後端（僅限明確設定）

除了 ChatGPT 與 Claude 路徑之外，還有三個 web-search 後端。每一個都**僅限明確設定**——絕不會
因為憑證存在就自動啟用——並且**關閉失敗**：缺少憑證時不會產生邊車計劃，請求會走一般的路由路徑。

| 後端 | 執行內容 | 憑證 | 備註 |
| --- | --- | --- | --- |
| `xai` | 在 `api.x.ai` Responses 上執行 Grok 託管 `web_search`（可選加入 `x_search`） | 已儲存的 Grok OAuth（`ocx login xai`） | `webSearchSidecar.xSearch` 啟用 X search，可搭配 `allowedXHandles`／`excludedXHandles`（最多 20 個、互斥）與 ISO 格式的 `fromDate`／`toDate`。預設模型 `grok-4.6`。 |
| `gemini` | 在 Antigravity 傳輸層上執行 `google_search` grounding | 已儲存且已偵測到專案的 Antigravity OAuth（`ocx login google-antigravity`） | 預設模型 `gemini-3.8-flash`；reasoning 會選擇對應的等級。 |
| `exa` | Exa Search API（非 LLM 結果摘要） | `webSearchSidecar.exaApiKey` | 該金鑰透過管理 API 只能寫入（絕不回顯，日誌中會遮蔽）。不套用任何邊車模型。 |

## Web-search 邊車

當 Codex 為非透傳的路由模型請求託管 `web_search` 時，opencodex 會：

1. **移除**託管的 `web_search` 工具，改為向路由模型提供一個合成的
   `web_search(query)` function 工具。原託管工具的選項會保留並用於邊車呼叫。
2. 讓路由模型在一個小型 **agentic 迴圈**中執行。模型呼叫 `web_search` 時，opencodex 使用所選
   後端：OpenAI 預設以 `gpt-5.6-luna` 執行託管 `web_search`；Anthropic 預設以
   `claude-sonnet-5` 執行 `web_search_20250305`。串流的答案及引用會解析為工具結果。xAI 預設以
   `grok-4.6` 執行託管 `web_search`，並在啟用時將託管的 `x_search` 加入同一請求。
3. **迴圈**直到模型回答，或真實查詢總數達到 `maxSearchesPerTurn`（預設 3），然後移除 search
   工具並強制生成最終答案。如果模型呼叫 `apply_patch` 或 shell 等真實用戶端工具，這些呼叫會結束
   目前 turn，以便到達 Codex。

路由模型的每次迭代都會向上游請求 `stream: true`，但預設情況下 opencodex 會在決定搜尋還是回傳
最終答案前，在內部完整緩衝所有語義事件。只有第一次迭代的最終 header／status 和 429 key
rotation 會被提前取得。因此，合成搜尋呼叫和中間輸出絕不會作為用戶端可見的模型輸出暴露出去。

選用設定 `webSearchSidecar.streamRoutedModelOutput`（預設 `false`）會改成即時串流每次迭代開頭的
文字／思考 delta——用戶端會在模型產生輸出的當下就看到，就跟沒有邊車時一樣。即時視窗會在第一個
工具呼叫邊界永久關閉，因此攔截 `web_search` 的判斷仍保持原子性，內容也絕不會被傳送兩次（結尾
重播會跳過已經串流過的部分）。取捨：模型在**決定搜尋之前**產生的文字——緩衝模式下會被悄悄
捨棄——會變得可見，並可能在搜尋後的答案中局部重複。儀表板總覽頁面把這個選項顯示為 web-search
邊車卡片上的**即時串流答案**切換開關（`PUT /api/sidecar-settings` 搭配
`webSearch.streamRoutedModelOutput`）。

Kiro 的 commentary 與這個選項無關：commentary 階段的文字在緩衝模式下本來就會搶先在結尾事件之前
串流，這條旁路不受影響——不論有沒有開啟 `streamRoutedModelOutput`，只有搜尋判斷相關的事件（工具
呼叫，以及第一個工具呼叫邊界之後的一切）會為了 `web_search` 判斷的原子性而保持緩衝。

注入結果會包裹在不可信資料邊界中，限制長度，並按來源 URL 去重。在結構化輸出 turn
（`json_schema` / `json_object`）中，結果會以緊湊 JSON 而不是普通文字傳入。若路由模型是純文字
模型，search 模型還會收到指令，用文字描述相關圖像並附上來源 URL。

```json
{
  "webSearchSidecar": {
    "enabled": true,
    "backend": "anthropic",
    "model": "claude-sonnet-5",
    "reasoning": "low",
    "maxSearchesPerTurn": 3,
    "routedModelStallTimeoutMs": 200000,
    "timeoutMs": 200000,
    "streamRoutedModelOutput": false
  }
}
```

明確指定的 xAI 後端使用 `ocx login xai` 建立的已儲存憑證。其中選用的 `xSearch` 區塊可以啟用
X search，並可限制為一份帳號清單與一段 ISO 日期範圍：

```json
{
  "webSearchSidecar": {
    "backend": "xai",
    "model": "grok-4.6",
    "xSearch": {
      "enabled": true,
      "allowedXHandles": ["xai"],
      "fromDate": "2026-08-01",
      "toDate": "2026-08-21"
    }
  }
}
```

`allowedXHandles` 與 `excludedXHandles` 互斥，各自最多接受 20 個字串。日期格式為 `YYYY-MM-DD`。
格式錯誤的管理寫入會回傳 `400`；已持久化的錯誤區塊會在規劃階段關閉失敗，而不是悄悄放寬搜尋
範圍。

託管後端不允許在 `minimal` reasoning 下使用工具，因此不會使用該等級。搜尋失敗時，路由模型會
收到長度受限的錯誤結果，仍可依據已有上下文繼續回答。

此路徑採用四個相互獨立的時鐘。`stallTimeoutSec` 是基礎 bridge event-stall 預算。
`connectTimeoutMs`（預設 `200000`）只限制 DNS/TCP/TLS 和最終回應 header。僅可在設定檔中
設定的 `webSearchSidecar.routedModelStallTimeoutMs`（預設 `200000`，整數
`1..2147483647`）限制每次路由模型迭代中原始回應 byte 連續無活動的時間，並在收到每個非空 byte
時重置。`webSearchSidecar.timeoutMs` 獨立限制單次託管搜尋請求。實際 bridge watchdog 為
`max(基礎 stall, connect timeout, 路由模型 stall, sidecar timeout) + 30 秒`。路由模型 stall
不是總生成 timeout。SSE 開始前的失敗會回傳非 2xx JSON；回應 header 開始後發生的生成失敗則以
`response.failed` SSE 傳遞。

## Vision 邊車

圖像路由會判斷能力。在傳送含圖像的上游請求之前，opencodex 會綜合執行期 provider 證據、維運方
明確宣告、backend／registry metadata 與產生的廠商 metadata，解析出所選模型的實際輸入模態。確定
為純文字的目標會先經過 Vision 邊車：圖像會在主要呼叫**之前**被描述，並就地以文字取代。確定支援
圖像的目標則直接收到圖像。未知的自訂模型維持既有的相容行為，不會被猜測成純文字。

對於標準的 ChatGPT Codex 路徑，opencodex 使用 `openai-codex` metadata 套件，而不是公開的
OpenAI API metadata，因此會尊重各 backend 特有的模態差異。原生 Chat 快速路徑使用同一道關卡，
無法繞過已確認的純文字判定。若沒有可用的邊車計劃，原始圖像會在送到已證實為純文字的 backend
之前被移除。

只有當每個 combo 成員都能原生或透過邊車接受圖像，且該 combo 的 `imageInput` 設定未停用時，
combo 才會宣告支援圖像輸入；如此 Codex 應用程式等用戶端會允許附件，而不是在邊車執行前就擋下
它們。當 `visionSidecar.model` 不存在或為空白時，OpenAI 執行路徑、儀表板與管理 API 會使用
`gpt-5.6-luna` 這個回退值。啟動時仍會把明確持久化的舊 `gpt-5.4-mini` 值遷移成
`gpt-5.6-luna`；這個遷移只套用在已儲存的值，不套用在缺漏的 model 欄位。

第一方 DeepSeek 的 `deepseek-flash` 模型原生支援多模態（`text` 與 `image`），預設不會使用這個
邊車。明確設定的 `noVisionModels` 或純文字宣告仍具最高權威。第一方的 `deepseek-chat`、
`deepseek-reasoner` 與 `deepseek-v4-flash` 預設仍由邊車支援；Zen 路由未變動，本次更新也未對其
進行檢測。

- 圖像可以來自 user、developer 與 tool-result 訊息，也包括 Codex 的 `view_image` 結果。
- 在 OpenAI 路徑（ChatGPT 登入透傳）上，每張圖像會透過 Responses 端點，以所選的
  `reasoning.effort`（預設 `low`）送給設定的 vision 模型，描述結果會就地替換圖像部分。
  Anthropic 路徑使用 Messages 端點與自己的 thinking-budget 對應方式，並忽略這個 OpenAI 專屬
  設定。
- 對於有已知能力 metadata 的原生模型，不支援的 reasoning 會被正規化為不超過請求等級中最高的
  可用等級；若不存在，則使用最低的可用等級。當缺乏可靠的能力 metadata 時，未知或自訂模型維持
  寬鬆處理。
- 描述任務以有限並行度執行（同時最多 3 張，保留輸入順序）。傳給描述模型的使用者上下文上限為
  800 個字元，每則注入的描述上限為 2,000 個字元。請求不會傳送 ChatGPT 後端會拒絕的
  `max_output_tokens`。
- 圖像 URL 會在轉發前驗證：data URL 必須是 `png` / `jpeg` / `jpg` / `webp` / `gif`，base64
  資料限制在約 20 MB。只接受 `data:` 與 `https:` scheme；遠端 `https` 圖像由 OpenAI 後端取得，
  而不是由 proxy 取得。
- `noVisionModels` 的比對會忽略 Ollama 風格的 `:size` 字尾，因此一個 `gpt-oss` 項目也會涵蓋
  `gpt-oss:120b`。
- 若描述失敗，模型會收到簡短的處理錯誤提示。（若沒有可用的邊車計劃，則完全不會嘗試描述——原始
  圖像會如上所述被移除。）
- `maxDescriptionsPerTurn`（預設 8）限制每個主模型 turn 的新增描述次數。快取命中與同一 turn
  內的重複請求不會消耗這個配額。成功的 `data:` 圖像描述會依 backend、模型、detail、圖像位元組
  與訊息上下文快取——OpenAI 金鑰還會加上 reasoning effort（Anthropic 金鑰不含此項，因為該欄位
  在那裡會被忽略）；內容可變的 `https:` 圖像不會被快取。

管理 API 與儀表板選單會列出能接受圖像輸入的模型。當對應 backend 可用時，`gpt-5.6-luna`
（OpenAI）與 `claude-haiku-4-5`（Anthropic）一律會作為基準選項提供。`PUT /api/sidecar-settings`
可以保留一個未知的自訂／領先目錄的 id。因此，明確設定的路由 Vision 邊車只要沒有能力證據證明該
模型不能接受圖像，就可以使用；這樣既能保留維運方自選的自訂邊車，又不會讓已知的純文字邊車收到
圖像位元組。

```json
{
  "visionSidecar": {
    "enabled": true,
    "backend": "openai",
    "model": "gpt-5.6-luna",
    "reasoning": "medium",
    "maxDescriptionsPerTurn": 8,
    "timeoutMs": 45000
  }
}
```

純文字模型按 provider 標記：

```json
{
  "providers": {
    "ollama-cloud": {
      "baseUrl": "https://ollama.com/v1",
      "noVisionModels": ["glm-5.2", "gpt-oss", "qwen3-coder", "deepseek-v4-flash"]
    }
  }
}
```

## 儀表板設定與停用

儀表板的 Vision 邊車卡片可以啟用或停用邊車，並設定 `maxDescriptionsPerTurn` 和
`timeoutMs`，同時保留既有的模型、後端和推理強度控制。停用不會刪除這些設定；重新啟用後仍會
保留原來的模型、後端、推理強度、逾時和次數上限。

`PUT /api/sidecar-settings` 接受相同欄位。部分更新會保留未提交的鍵。`timeoutMs` 使用執行時
整數邊界（1–2147483647 毫秒）。

如果更想直接改檔案，仍可在 `config.json` 中把 `enabled` 設為 `false`。Anthropic OAuth 搜尋和
圖像描述沿用現有 Claude Code OAuth fingerprint 先例，但仍應使用目標帳號和實際負載充分
soak test。

所有欄位見[設定參考](/reference/configuration/#sidecars)。
</content>
