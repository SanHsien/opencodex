---
title: Codex 整合
description: opencodex 如何將自身注入 Codex、同步模型目錄、安裝 shim，並乾淨地恢復。
---

opencodex 透過修改 Codex 會讀取的兩項內容，讓 Codex 經由 proxy 路由：其設定
（`$CODEX_HOME/config.toml`，預設為 `~/.codex/config.toml`）與模型目錄。每項修改都是冪等且可逆的。

**Connect** 總覽頁有一個 Codex 開關，對應這項原生整合。開關顯示的是 OpenCodex 設定中最近儲存的期望狀態（包含切換後立即的狀態），徽章則回報目前觀察到 Codex 是否確實在使用 proxy；在清理過程中，兩者可能短暫不一致，徽章會持續回報觀察到的狀態。停用時會指名生效中的 Codex 設定檔、移除 OpenCodex 產生的路由產物，並讓 proxy 繼續為其他用戶端執行。重新啟用會依當下可用的模型重建目錄，因此不會逐位元組還原 Codex 檔案。

對於裸原生 Codex 模型與 OpenCodex 產生的帳號選擇器列，目錄會攜帶已驗證的存取方案中繼資料。裸模型使用主 Codex 帳號；帳號限定的模型則使用其選定的帳號。當上游變更帳號的存取方案時，重新整理整合會更新這些列。
OpenCodex 會把已登入主帳號的即時模型可用性提示帶到裸原生模型列上。

proxy 提供一條裸 `openai` Codex 登入路徑，可使用 Pool（預設）與 Direct 帳號模式，另提供
`openai-apikey/<model>` 給已設定的 API 金鑰。Pool 包含主帳號與新增帳號；Direct 只使用 caller／主登入
bearer。這些路徑不會彼此 fallback。shipped v1 設定會遷移到 marker 2，並保留
`config.json.pre-openai-tiers-v2.bak` 供手動恢復。

Pool 選定新增帳號時，OpenCodex 會把請求標頭或 client metadata 中已有的 installation 識別碼，
換成該帳號與此 OpenCodex home 專屬的穩定識別碼。token 更新時識別碼不變，切換帳號則改變。Direct 模式與
原生主帳號保留你原本的值；原本不存在的 installation metadata 仍保持不存在。切換原生 profile 時，
OpenCodex 不會改動 Codex 自己的 `installation_id` 檔。若本機 installation secret 無法安全讀取，請求會在
送到 ChatGPT 之前回傳可重試的 503。同樣的隔離也涵蓋已驗證的 live 通話 session，以及之後的
realtime／sideband WebSocket 幀。Pool 的 turn metadata 超過 32 KiB 會在送出前被拒絕（HTTP 回 503，
WebSocket 幀則關閉連線）；Direct 與原生主帳號的值維持不變。

在 Pool 模式下，當已選定的儲存帳號正在冷卻、且沒有合格的儲存替代帳號或復原探測可用時，帶有已驗證
原生 Codex 登入的請求可以使用那個登入。這也涵蓋在送出前就被擋下的新請求，遵循與上游拒絕之後相同
的呼叫端驗證。既有的模型權限與主帳號政策檢查仍然適用。這個後備會保留儲存帳號的冷卻狀態，且不會
把呼叫端憑證持久化為 Pool 選擇。一個精確的帳號綁定仍會保持綁定在那個帳號上。手動 Pool 釘選只是偏好，
而不是精確的帳號綁定：它仍可使用這條後備路徑。當請求必須留在單一帳號上時，請使用帳號限定模型。
暫停已觀測到的原生主帳號會封鎖與其相符之呼叫端憑證的後備；它不會識別或暫停無關的呼叫端自有登入。

若要讓自動 Pool 路由完全不使用原生主登入，請設定 `"codexPool": {"poolOnly": true}`。
此時 Pool 只會服務已註冊且符合資格的新增帳號：它絕不會排列或保留主帳號作為選取對象，絕不會使用上述的呼叫端主帳號後備，
並會將主帳號上的手動釘選視為無釘選。當所有允許的帳號都在冷卻中或不可用時，請求會被拒絕，而不是消耗主帳號。
帳號限定模型（包含以 `__main__` 限定的模型）與 Direct 模式屬於明確選擇，仍可抵達主帳號。此設定預設關閉。

新增或重新認證池帳號時，會拒絕與原生主登入重複的帳號，並回報 `Account is already configured as the native Codex main account.`。
該檢查會比對 ChatGPT 帳號 ID、個人／工作區訂閱桶與電子郵件；缺少電子郵件並不代表是不同身分。
不同的工作區、不同的工作區成員，以及分開的個人與工作區訂閱仍受支援。失敗的用量查詢不會丟棄登入 token 所帶的訂閱方案。

既有的重複帳號仍會保留儲存，但無法被選為第二個 Pool 帳號。帳號清單會公開
`selectionExcludedReason: "duplicate_main"` 與一個可執行的 `selectionExcludedAction`。請明確使用原生主帳號，
或先將原生 Codex 登入到另一個帳號再重用已儲存的項目。偵測依循最新擁有的原生登入觀測，包含之後的原生重新登入；
被動帳號清單查詢與呼叫端自有的請求不會開啟原生憑證來重新整理該觀測。

## 設定注入

`ocx sync` 會從目錄中移除所選 Codex 執行期不支援的推理強度。當其執行期身分、被移除的強度或受影響的模型改變時，
它會回報一次夾限；未變更的同步會保留診斷時間戳記且不會重複該通知。這項相容性投影不需要執行 `ocx doctor`。
若夾限曾經清除而之後又回來，它會再次回報。

OpenCodex 會序列化對 Codex 設定的寫入。在 Windows 上，暫時被另一個程序開啟鎖住的檔案會進行短暫、有界的重試。
若存取持續忙碌，請稍後重試該操作；OpenCodex 會保留既有的鎖定證據，不會利用該存取失敗去搶接另一個寫入者的鎖。

`ocx init`、`ocx start` 與 `ocx sync` 都會呼叫注入器。在預設 loopback 繫結下，它會保留 Codex
內建的 `openai` provider id，並將該 provider 指向 opencodex：

```toml
# root keys, before the first table
model_catalog_json = "/absolute/path/to/opencodex-catalog.json"
# Auto-injected by opencodex (undo: ocx restore)
openai_base_url = "http://127.0.0.1:10100/v1"
# Auto-injected by opencodex (undo: ocx restore)
experimental_realtime_ws_base_url = "http://127.0.0.1:10100/v1"

# only when fastMode is set; unset adds no [features] table
[features]
fast_mode = true
```

第二個 key 是語音旁帶覆寫。Codex 會透過 `openai_base_url` 建立一個 WebRTC 語音通話，但自 codex
0.146（openai/codex#35830）起，除非 `experimental_realtime_ws_base_url` 重新導向，它會直接在
`api.openai.com` 加入該通話的旁帶 WebSocket。在 Pool 模式下，通話是在 opencodex 選定的帳號底下
建立的，所以直接以 app 自己的登入加入會失敗，回傳 `realtime websocket handshake failed`（404）。
被注入的 key 會把加入請求送回 opencodex（`GET /v1/live/{callId}`），由 Pool 重用它為那個
session／執行緒組合所綁定的帳號（一個行程本地的綁定）。由用戶端自行建立的通話則是例外：當 ChatGPT 語音將通話交接給
Codex 執行緒，或 Codex Desktop 自行建立通話時，該通話屬於你的 ChatGPT 登入且只有其旁帶加入請求會抵達 opencodex，
因此 opencodex 會以呼叫端自己的 ChatGPT 憑證而非 Pool 帳號來轉發該加入請求。在 Direct 模式下，兩端本來就已經使用呼叫端
目前的 bearer，所以這個 key 只是讓加入動作維持走 proxy 路徑。它只會寫在 loopback 形式的
`openai_base_url` 上，並隨它一起被移除，且絕不會覆寫使用者自有的 `experimental_realtime_ws_base_url`。

### 語音傳輸與任務交接

Codex 擁有麥克風與喇叭、WebRTC 媒體協商、字幕、靜音控制，以及切換執行緒時的語音清理。OpenCodex
只轉送通話建立與旁帶連線；語音委派的工作使用一般的 Responses 路由路徑。選擇一個文字供應商不會取代
即時語音模型，也不會在不支援語音的客戶端上啟用語音。

上游的
[WebRTC helper 變更](https://github.com/openai/codex/commit/1b53f6a44eff890b5169bde8d3bd5b12b8766946)
與
[TUI 語音整合](https://github.com/openai/codex/commit/b01c3986fd2e79b8a477a08d81430f52f22bc0dc)
描述了這些客戶端的職責，包括從語音交接中把最終答案唸出來。它們的合併日期不代表相同行為何時抵達
桌面應用程式。

選用的 `OCX_LIVE_FRAME_LOG` 診斷只會寫入幀的時間戳記、方向、種類、位元組數，以及一個替代字元旗標
（`ts`、`dir`、`kind`、`bytes`、`fffd`）。它們不會儲存語音文字或幀內容片段。對於二進位幀，UTF-8
解碼本身就可能產生替代字元，所以單靠這個旗標無法判斷損毀發生在哪裡。既有的日誌檔案不會被重寫。

### 快速模式

注入的 `fast_mode` 會遵循 `fastMode` 三態設定：`true` 寫入 `fast_mode = true`，`false` 寫入
`fast_mode = false`；未設定時會保留既有 `fast_mode`，且不新增 `[features]` table。

Fast 模式與語音傳輸是分開的。一個受支援模型的 service-tier 速度描述，並不保證透過 OpenCodex 能
取得更低的麥克風、WebRTC 或端對端語音延遲。

### ChatGPT 系列通道與延遲

透過 opencodex 以規範 ChatGPT 登入的 `openai` 供應商路由的請求——adapter 為 `openai-responses`、
`authMode: "forward"`，端點為 `https://chatgpt.com/backend-api/codex`，涵蓋 Pool 與 Direct 兩種
模式——都使用公開的 ChatGPT 端點。供應商路由或帳號選擇不會繞過這條上游 ChatGPT 通道。即使本機
proxy 與網路路徑都健康，上游仍可能在產生第一個輸出前花時間排隊該請求。

只有部分回合會走 ChatGPT websocket 傳輸——與 Codex CLI 預設使用的 `responses_websockets` 通道相同。
當 Bun runtime 支援這個有界的 relay、請求是對規範 Responses URL 或已設定的 WebSocket 路由發出的
`POST`，且其 JSON 主體在根層級把 `stream` 設為 `true` 時，該回合就合格。其他一切都留在 HTTP 上的
SSE，而一個合格的回合在請求無法準備、`response.create` 幀超過大小限制，或 proxy 路由無法承載該
socket 時，仍會退回 SSE。

若要讓內建的 ChatGPT 供應商保持在 HTTP/SSE 上，請在 `~/.opencodex/config.json` 中將 `providers.openai.upstreamWebsocket`
設為 `false` 並重新啟動代理。請將此欄位合併到既有的 `openai` 供應商中；保留其帳號模式與其他設定。
省略該欄位即可恢復預設的上游 WebSocket 選取。此設定不會改變面對用戶端的 `websockets` 開關，也不會改變請求所使用的 ChatGPT 帳號。
原生對話中途 steering 與注入需要上游 WebSocket，當它關閉時將無法使用。

**推理用量中繼資料（2.90.0 及以上）。** 對於標準 ChatGPT 路由上的 HTTP/SSE 用戶端，當 Bun 執行期公開實際的
`x-reasoning-included` 連線回應標頭時（包括在重用的連線上），上游 WebSocket 中繼會保留該標頭。
這會告訴 Codex 伺服器回報的用量已經包含較早的推理。第一個 Responses 事件之前送出的中繼資料優先；
較晚的中繼資料仍留在串流中，但無法改變已提交的標頭。中繼不會捏造此訊號或更動用量數字。
缺失的上游訊號與 Codex 自己的帳務生命週期仍是分開的問題，因此單靠這項變更並不能證明早期壓縮已修復。
面對用戶端的 WebSocket 連線在上游回應之前就已經完成升級，無法事後以升級標頭形式接收此訊號。

本機供應商節流也可能在請求根本尚未派送之前就先卡住它。所以第一個輸出慢，可能有好幾個因素，上游
排隊只是其中之一。`ocx doctor` 只分類設定，不會量測這些因素：下結論前請先比較實際的傳輸、節流、
網路與供應商觀測值。

決定一個請求是否走那條公開通道的，是它解析到的目的地，而不是供應商項目的名稱。一個解析到別處的
供應商——`openai-apikey`，或一個指向自己 API 的自訂項目——會直接抵達那個端點，不會遇到 ChatGPT
排隊。一個自訂命名的項目若解析到帶 forward 認證的 `https://chatgpt.com/backend-api/codex`，就會
和內建列走同一條公開通道，因為分類依據的是 adapter、認證模式與目的地，而不是項目的名稱。

`ocx doctor` 的提示比它描述的端點行為更窄：它只檢查內建的 `openai` 列，所以它沒出現，不代表任何
其他供應商解析到哪裡。

`service_tier: priority` 是一個請求偏好。在 ChatGPT backend 上，回顯的 `service_tier` 無法確認或
否認實際核發的分層：被排程為 priority 的回合仍可能回顯 `default`，所以請求日誌會把回應分層顯示為
一個確認狀態為 `assumed` 的觀測值。對延遲敏感的工作，請比較你實際使用的各供應商所觀測到的第一個
輸出時間，而不要假設某個特定通道比較快。

對於轉發到具有相同中繼資料限制的後端的閘道，請在該供應商上明確宣告
[`responseTierAuthoritative: false`](/zh-tw/reference/configuration/providers/#回應-service-tier-權威性)。
請求仍會送出 priority 並記錄原始回聲，同時實際的 Fast 排程保持未確認。未宣告的閘道與官方 API 保留既有的以回應為基礎的解讀。
只更新 OpenCodex 不會把這項宣告加到既有的閘道項目中：少了它，符合資格的 priority 請求之後收到 `default` 回聲時仍會記錄為 `response-declined`。

proxy 預設監聽 `10100` 埠，提供 `POST /v1/responses`、`POST /v1/responses/compact`、
`POST /v1/images/generations`、`POST /v1/images/edits`、`GET /v1/models`、`GET /healthz`
以及 `/api/*` 管理介面。

### 實驗性 context 管理（Codex 0.153+）

`model_auto_compact_token_limit` 在某些版本不會出現在官方的 Codex 基準設定參考中。若在你的測試中
`config.toml` 的該設定未生效，可以將其交給 `ocx` 代理接手管理。

這個功能預設為**關閉**。在設定中啟用後（例如在 `config.json` 中設定 `"codexContext": { "enabled": true }`，
或於儀表板與 CLI 開啟），代理會在每次收到 `/v1/responses` 請求時計算對話中最近的 context 佔用，
並與設定的閾值（預設為 `0.9` 等比例或指定的 token 數）比較。達到閾值時，OpenCodex 會主動在回應前
或適當時機透過選定的輔助模型發出壓縮請求，產出結構化的壓縮摘要並替換歷史紀錄，然後將較精簡的
context 送回主模型繼續執行。

預設的實驗性 context 管理目標模型為 `openai/gpt-5.6-luna`，並會在發生失敗或無權限時沿用其他可用的
候選模型。

既有的模型親和性、冷卻與重試規則不變。context 請求不會被自動重試，筆記寫入也一樣；ChatGPT forward
路由保留它既有的壓縮生命週期與封套。詳情與調整參數請見[設定參考](/zh-tw/reference/configuration/server/)。

### Codex App 中的託管圖像結果

當模型回傳內嵌的圖像生成結果（例如來自 `image_gen` 或 `image_generation` 工具的 `base64` 資料）時，
Codex App 預設會在訊息氣泡中直接渲染預覽，並在內部對話資料庫保留檔案參照。

OpenCodex 會保留原生 Responses 回應格式中的圖像結構與中繼資料，並透過本機代理端點安全地提供大型
圖像資料的載入，確保與原生行為一致。

### 內建圖像生成（`image_gen`）

Codex 的內建 `image_gen` 工具不會經過 `/v1/responses`。codex-rs 擴充套件會直接 POST 到
`{base_url}/images/generations`；附帶參考圖時則使用 `/images/edits`，並沿用聊天使用的 ChatGPT bearer
認證。由於注入的 `base_url` 指向 opencodex，proxy 會把這些呼叫中繼到 OpenAI 上游。

這與 [Image Bridge](/zh-tw/guides/image-bridge/) 是不同路徑。Image Bridge 只有在 **Responses** turn
列出 hosted `image_generation` 工具、且目前選的是非 OpenAI 模型時才會啟動。獨立的
`/images/generations` 呼叫不會進入該 bridge。

- **單一、感知模式的 forward 候選：** Pool 會選擇合格的主帳號或新增帳號，並使用其已儲存的 ChatGPT 憑證，
  即使客戶端是以代理准入 bearer 向 opencodex 認證亦同；Direct 使用 caller OAuth bearer，且無法轉發代理准入 token。
  圖像請求會一致遵循目前設定的模式。
- **OpenAI API-key provider：** 只有在沒有 forward 候選擁有認證失敗時才會使用。損壞或過期的 Pool
  憑證不會被另一條額外計費的 API 路徑掩蓋。
- **明確指定的自訂 provider：** 將 `images.provider` 設為某個自訂 API-key `openai-responses`
  provider id，而且其端點必須實作 OpenAI Images API。明確選擇時採 fail-closed，不會 fallback 到其他
  付費上游。此處不接受 registry 管理的 provider id；若要使用內建 OpenAI tiers，請省略
  `images.provider`。
- **xAI Imagine（Grok OAuth）relay：** 當 `images.bridgeEnabled` 為 `true`、`images.provider` 省略，
  且已設定 `xai` 供應商時，`/v1/images/generations` 與 `/v1/images/edits` 會被送到
  `https://api.x.ai/v1`。憑證取決於供應商的 `authMode`：`"oauth"` 時，relay 會重用
  `ocx login xai` 取得的 Grok CLI 授權；其他模式則使用供應商的 API 金鑰。一個 OAuth 登入不會啟動
  keyed 供應商，反之亦然。ChatGPT 憑證不會被轉送。若憑證缺失，proxy 會回傳 400，而不是向 ChatGPT
  計費。明確設定 `images.provider` 會把 `/v1/images` 直接交給那個供應商；它自己的驗證錯誤會原樣
  回傳，xAI relay 絕不會被嘗試。這個 relay 會把 Codex 的 `size` / `aspect_ratio` 對映到 xAI 的
  Imagine 主體，並回傳相同的 `{created, data:[{b64_json}]}` 形狀。整批（inline 的 `b64_json` 與
  下載的 URL）合計的解碼位元組與 base64 編碼輸出，必須維持在 100 MiB 以下；超過這個上限的一批會
  回傳 502。當 xAI 回傳的是圖片 URL 而非 inline 位元組時，proxy 會自行、不帶任何憑證地取得它：
  該 URL 必須是公開的 HTTPS（不接受重新導向、不接受 `file:`、不接受 loopback 或私有位址），每次
  下載上限 50 MiB，結果會被具現化為一個本機產物，且只透過已驗證的管理端點提供。這獨立於 Responses
  Image Bridge 迴圈（後者仍只限 API-key）。
- **Google Antigravity（CCA）fallback：** 若既沒有 OpenAI forward 候選，也沒有設定 keyed provider，
  `/v1/images/generations`（不包含 `/images/edits`）會 fallback 到 Antigravity **Cloud Code Assist**
  端點，使用 `gemini-3.1-flash-image` 模型。OpenAI 認證解析失敗後也會觸發此 fallback，例如 ChatGPT
  憑證過期或缺失，而不限於完全沒有設定 OpenAI 候選的情況。這需要先執行
  `ocx login google-antigravity`；OAuth token 只會傳送到固定的 CCA registry host，絕不會傳到設定層級
  的 `baseUrl` override。回應會轉成 Codex 預期的 `{created, data:[{b64_json}]}` 形狀。
- **都沒有：** proxy 會回傳明確錯誤，而不是模糊的 404。路由 provider（Cursor、Gemini、Kiro 等）
  無法提供 `image_generation` 工具 relay；若完全不想提供此工具，可在 Codex 執行
  `codex features disable image_generation`，等同於在 `config.toml` 設定
  `[features] image_generation = false`。

工具宣告仍會跟著模型的 Responses 請求傳送。對 API-key Responses provider，opencodex 會把 Codex
私有的 `image_gen` namespace 降為上游安全的 `image_gen__<inner-name>` alias，例如
`image_gen__imagegen`。當可用 alias 取代 client 宣告時，opencodex 會移除重複的 hosted
`image_generation` 宣告；在 Codex 看見 function call 前，再將其對映回明確的 `image_gen` namespace，
之後歷史重播到上游時則重新編碼成原生呼叫。這讓保留 namespace 或拒絕 dotted function name 的公開相容
上游仍能呼叫 client-side 圖像生成。ChatGPT forward 模式保持不變，繼續使用原生 Responses Lite
形狀。

若要使用 OpenAI 相容的自訂 gateway，可設定專用 provider，並只讓獨立 Images 請求使用它：

```json
{
  "providers": {
    "custom-images": {
      "adapter": "openai-responses",
      "baseUrl": "https://gateway.example.com/v1",
      "authMode": "key",
      "apiKey": "${IMAGE_GATEWAY_API_KEY}"
    }
  },
  "images": {
    "provider": "custom-images",
    "timeoutMs": 300000
  }
}
```

自訂端點必須接受 `POST /v1/images/generations` 與 `/v1/images/edits`，並回傳 Codex 預期的 OpenAI
Images response 形狀。上游請求會使用該 provider 設定的 key 取代任何 caller bearer。

> **注意：** 這裡只指 Codex 的 `image_generation` 工具（`/images/generations` relay）。支援圖像的
> Gemini 模型會透過 `google` adapter 原生產生 inline image（使用
> `responseModalities: ["TEXT", "IMAGE"]`），與此 relay 無關。參見
> [轉接器](/zh-tw/reference/adapters/#google)。

若 `hostname` 不是 loopback 地址，Codex 必須傳送產生的 API 認證標頭，因此注入器會改用專用
provider：

```toml
# root keys
model_provider = "opencodex"
model_catalog_json = "/absolute/path/to/opencodex-catalog.json"

# 追加到檔案末尾
# Auto-injected by opencodex (undo: ocx restore)
[model_providers.opencodex]
name = "OpenCodex Proxy"
base_url = "http://your-host:10100/v1"
wire_api = "responses"
requires_openai_auth = true
env_key = "OPENCODEX_API_AUTH_TOKEN"
# supports_websockets = true   # only when config.websockets is true
```

當 OpenCodex 擁有路由時，兩種模式都會把 `$CODEX_HOME/opencodex.config.toml` 寫成參考／fallback
設定。loopback 模式下，其中包含自動注入被移除時可手動合併的根級鍵；non-loopback 模式下，其中包含
專用 provider 形式。外部 provider 模式不會修改此 profile。

重新產生此檔案時，會保留 OpenCodex 不管理的一般根級鍵，因此你新增的 `stream_idle_timeout_ms` 或
`stream_max_retries` 等設定在下一次注入後仍會存在。保留的賦值會照原樣複製，包括跨多行的值與 64 位元
整數，並放在第一個表之前。表內的鍵以及 `a.b = 1` 這類點分根級鍵不會保留。發生衝突時一律以 OpenCodex
為準：它擁有的根級鍵（`model_provider`、`model_catalog_json`、`openai_base_url`）會依目前的路由模式
重寫；與 profile 寫入的表同名的根級鍵（例如 profile 寫入 `[features]` 時的內嵌 `features = { ... }`）
會被捨棄。若注入等待寫入鎖期間檔案有變動，注入會以可重試的錯誤停止，並保留你的修改。

:::caution
`openai_base_url`、`model_provider`、`model_catalog_json` 等根級鍵**必須**位於第一個 `[table]`
標頭之前。注入器會保證此位置、移除自己留下的舊值或重複項，而且絕不覆寫使用者自有的根級
`openai_base_url`；若該值存在，同步仍會更新模型目錄，但會回報路由未注入。

同步與還原也會保留根層級的 `model_context_window`，因為 OpenCodex 絕不會寫入該鍵。
Codex 會用它來取代各模型的目錄視窗（上限為該模型的最大視窗），因此若希望每個模型各自回報自己的視窗，請自行將它刪除。
:::

## 共享模型目錄

Codex CLI、TUI、App 與 SDK 都讀取同一個 Codex home。opencodex 會從 `CODEX_HOME` 解析該目錄，
未設定時 fallback 到 `~/.codex`，並管理：

```text
$CODEX_HOME/config.toml
$CODEX_HOME/opencodex.config.toml
$CODEX_HOME/opencodex-catalog.json
$CODEX_HOME/models_cache.json
```

在 macOS 上，opencodex 在明確選擇、shim、PATH、既有安裝路徑和可執行的裸 `codex` 後備命令之後，依序檢查 `/Applications/ChatGPT.app` 和 `~/Applications/ChatGPT.app` 中的 Codex 應用程式內建 CLI，要求其 XML `Info.plist` 識別碼為 `com.openai.codex`，且不會用應用程式候選項自動取代仍可執行的已儲存選擇。若完全找不到 Codex CLI，`ocx connect status` 就緒狀態背後的目錄探測也會嘗試這些內建位置，因此僅有應用程式內建 CLI 的 Child 會回報其支援的推理等級，而不是 `unverified`；執行時仍會套用下列檢查。

執行檢查也會辨識任意位置的 `Codex.app` 和 `ChatGPT.app`，包括移動後的應用程式套件、明確的
`CODEX_CLI_PATH` 或設定的執行階段命令，以及符號連結別名。名稱只觸發驗證，不代表可信。
每次執行前，正規化的套件和確切二進位檔都必須通過嚴格簽章驗證、OpenAI Team ID 及擁有權、
權限和祖先目錄政策。二進位檔必須位於套件的 `Contents/` 內（包含 `Codex.app` 的
`Contents/Resources/codex-aarch64-apple-darwin`）；無法正規化套件或二進位檔時拒絕執行。
一般非應用程式 CLI 和第三方套件保留原有執行政策。

在 WSL 中，如果未設定 `CODEX_HOME`，且 Linux 的 `~/.codex` 目錄不存在或不含任何 Codex 狀態（`config.toml`, `auth.json`, `sessions`, `history.jsonl`），opencodex 也會檢查
`/mnt/c/Users/*/.codex/config.toml` 下是否只有一個 Windows Codex Desktop home。候選項恰好只有一個時，
會使用該目錄，讓 WSL app-server mode 與 Windows Codex Desktop 共用相同的 config 與 auth 檔案。
若要覆蓋此偵測，請明確設定 `CODEX_HOME`。當 Windows Codex Desktop 在 WSL 內執行其 app-server 時，
它會將 Linux Codex 執行檔以 `bin/wsl/<hash>/codex` 的形式放在該 home 底下；當服務 PATH 中沒有 `codex` 時，
opencodex 會在檢查任何明確設定的執行期與 PATH 之後到那裡尋找它。

若 Codex 家目錄存在但 Codex 尚未寫入 `config.toml`（例如從未登入 OpenAI 的全新 Desktop 安裝），
opencodex 會在該處建立一個空的 `config.toml` 並繼續。若家目錄本身不存在，請啟動 Codex 一次讓它建立，或設定 `CODEX_HOME`。

Codex 可將 SQLite 支援的 thread state 放在另一個目錄。OpenCodex 的歷史操作採用與 Codex 相同的
優先順序：先讀 `config.toml` 根級的 `sqlite_home`，再讀 `CODEX_SQLITE_HOME`，最後使用實際的
`CODEX_HOME`。相對 SQLite home 會從目前工作目錄解析。若安裝或修復服務時明確設定了
`CODEX_SQLITE_HOME`，持久化 launcher 會保存安裝當下解析出的絕對路徑，讓背景 proxy 持續操作同一個
資料庫。若 `config.toml` 或其根級 `sqlite_home` 不存在，OpenCodex 會繼續使用環境變數／home fallback。
若檔案無法讀取或解析，或該鍵存在但為空白或非字串，SQLite-home 解析會停止，以免歷史操作誤用另一個
資料庫。

在 Windows 上，Orca shell 可能同時把 `CODEX_HOME` 與 `ORCA_CODEX_HOME` 指向 Orca 內建的 runtime
home，而 ChatGPT/Codex App 仍讀取 `%USERPROFILE%\\.codex`。`ocx status` 與 `ocx doctor` 會警告這個
明確的不一致，並輸出經過遮蔽的目標路徑。若背景服務是在原 Orca shell 中安裝，請先在原 shell 中解除
安裝，再將 `CODEX_HOME` 設為 App home、取消 `ORCA_CODEX_HOME`，重新同步／恢復後再安裝服務。

在專用 provider 模式下，`requires_openai_auth = true` 會讓 Codex App/TUI 的帳號門控介面與原生
Codex 保持一致。opencodex 也透過 WebSocket 提供 `/v1/responses`。專用 provider 只會在
`"websockets": true` 時宣告 `supports_websockets = true`；loopback 模式下，Codex 的內建 provider
可能先嘗試 WebSocket，若 proxy 未啟用此功能則回傳 `426`，讓 Codex fallback 到 HTTP/SSE。

proxy 最多接受 128 條面對用戶端的 Responses WebSocket 連線。當新連線發現 128 個插槽皆已佔用時，
會關閉最久未使用的閒置連線以騰出空間。有進行中回應、待處理用戶端工具或核准結果、原生 steering／注入工作階段，
或緩衝輸出的連線會受到保護。若沒有任何閒置連線可釋放，新連線會收到既有的 `503` 容量回應。
被回收的用戶端可在後續請求使用既有的延續處理機制重新連線。這只會在連線壓力下發生，不需要設定，
也不會改變語音連線或上游連線重用。

若規範的 ChatGPT forward 延續參照的本機重播狀態已過期或缺失，opencodex 會在送出任何內容到上游
之前，回傳 `previous_response_not_found`。Codex 的 WebSocket 客戶端能辨識這個錯誤，並可以在它正常
的串流重試預算內，帶著完整保留的 context（包括已完成的工具呼叫與其結果）重新連線。因此一個閒置的
任務不會只因為 proxy 一小時的快取過期就需要開新任務。重播延續狀態保留 24 小時，並受既有的記憶體、磁碟與項目上限限制；
這不能復原客戶端自己已經沒有的歷史。HTTP 客戶端必須明確處理這個錯誤，並在不使用
`previous_response_id` 的情況下重送完整的 context。只重試相同的 ID 無法復原遺失的狀態。

當參照的狀態屬於不同的用戶端任務範圍（包括新請求看起來帶有完整輸入的情況）時，也會適用相同的拒絕。
代理無法證明輸入是完整的，因此不會靜默移除 `previous_response_id`，也不會揭露相符的狀態是否存在。
啟用 `v2-plaintext` 模式或 `plaintextV2AgentMessages` 旗標時，本機重放要求同一個獲准的 OpenCodex 呼叫方，以及請求自身非空白的 `thread-id`。父執行緒、loopback 位址、上游憑證或預留位置金鑰都不是該身分。沒有獲准呼叫方主體身分的用戶端，以及沒有自身執行緒的請求，必須省略 `previous_response_id`，重新傳送完整對話。預設的 loopback Codex 與 DSH 設定不會建立該呼叫方身分。任一設定啟用期間保留的狀態在停用後仍維持綁定。預設 `v1` 對未綁定的狀態保留既有的父執行緒範圍續接行為，包括預設 loopback 呼叫方。這與上游原生擁有的 Responses ID 各自獨立。

相同的復原訊號適用於每個路由目的地，因為只有原生 Responses passthrough 能回答本代理遺失了歷史的回合——
它會把 `previous_response_id` 轉發到儲存了該鏈結的後端。其他所有線路都是從每個請求自己的輸入重建對話，
因此該處漏掉展開原本只會送出當前回合並靜默遺失對話。這包括三個看起來像有狀態的供應商：Devin 每一輪都會重送整段對話、
Cursor 的檢查點參照存於同一份過期儲存區中並會在沒有它時退回完整重播，而 Kiro 會從交給它的回合重建對話歷史。
它也適用於設定了 `statelessResponses: true` 的路由 Responses 供應商，以及一個自訂工具被降級成 function、但差異結果沒有本機呼叫可以確立其原始型別的路由請求。完整重播會把呼叫、結果與推理一起保留；opencodex 不會猜測結果型別或把它丟掉。有狀態的供應商仍會自行解析原生 function 與只支援原生的自訂延續。這些檢查依循選定的 wire 協定與工具宣告，而不是模型名稱。對於無法解析已儲存 response ID 的閘道，請在該供應商上啟用 `statelessResponses`；其他供應商維持各自的預設值。

### 用戶端側壓縮（選擇加入）

已認證的 loopback 路由通常會讓 Codex 留在它內建的 `openai` 供應商身分上。這保留了原生執行緒身分，
但也讓 Codex 請求原生遠端壓縮。當一個路由供應商無法回傳原生壓縮 blob 時，OpenCodeX 會把摘要存進它
自己的 `ocx1:` 封套。若 OpenCodeX 之後被移出請求路徑，原生 ChatGPT 就無法驗證那個封套。

在已認證的 loopback 路由上，啟用用戶端側壓縮可以保留 V2 子代理路由，同時防止產生新的 `ocx1:`
壓縮摘要。非 loopback 與 API-key 路由維持既有的供應商與認證行為：

```bash
ocx system settings --client-compaction on   # or "codexClientCompaction": true in config.json
ocx sync                                     # rewrites the active config (default: ~/.codex/config.toml); restart Desktop
```

此設定預設為關閉。對已認證的 loopback 路由，OpenCodeX 會選用它既有的專用供應商形式，帶
`requires_openai_auth = true`。若也啟用了 `codexDesktopAuthless`，那個相容性更強的設定會優先，
並寫入 `requires_openai_auth = false`：

```toml
model_provider = "opencodex"

[model_providers.opencodex]
name = "OpenCodex Proxy"
base_url = "http://127.0.0.1:10100/v1"
wire_api = "responses"
requires_openai_auth = true
```

之後 Codex 會自行負責壓縮，並儲存一份可攜的明文摘要，而不是新的 OpenCodeX 封套。壓縮請求仍會經
OpenCodeX 路由，並可能消耗選定供應商的配額。V2 子代理請求維持既有的供應商選擇與配額計算方式。
用戶端側壓縮不會改變明文傳遞、透過 `allowEncryptedV2AgentTasks` 的加密任務 passthrough，或既設定
的復原與後備行為。

這個偏好只影響未來的壓縮，它不會重寫任何設定中既有的 `ocx1:` payload，所以如果某個執行緒需要，請
使用明確的歷史復原流程。

resume-history 中繼資料是否被重新標記，取決於注入採用哪一種形式。單獨在一個已認證的 loopback
繫結上，用戶端側壓縮不會重新標記任何東西：它會改保留下方描述的根層級覆寫。若與
`codexDesktopAuthless` 一起啟用，或在非 loopback 繫結上，較強的那個形式會勝出，行為與目前完全
一樣，包括它們既有的、把 resume history 正向標記、並備份原始值以供還原的做法。

從其中一種形式回到單純的 Design B，會把重新標記過的執行緒遷移回去。關掉 `codexDesktopAuthless`
但保留用戶端側壓縮則不會：那會落到只做壓縮的形式，它會跳過歷史單元，所以已經標記為 `opencodex`
的執行緒會保留那個標記。它們仍會抵達這個 proxy，只是透過供應商表而不是根層級覆寫。

在只做壓縮的形式下，既有執行緒能繼續運作，因為注入會讓根層級的 `openai_base_url` 覆寫與供應商表
並存。新執行緒預設為 `opencodex`，取得用戶端側壓縮，而一個已標記為 `openai` 的既有執行緒仍會解析
到 Codex 內建的供應商——保留下來的覆寫仍然指向這個 proxy。沒有它，那個執行緒就會直接對著 OpenAI
恢復，連同已設定的路由一起遺失。authless 與非 loopback 形式無法使用根層級 key，這也是它們改為持續
重新標記的原因。

這項保證涵蓋的是 OpenCodeX 管理的覆寫。你自己寫的根層級 `openai_base_url` 絕不會被取代，在這種
情況下，內建供應商會維持你選擇的目的地，所以一個標記為 `openai` 的執行緒會遵循你自己的設定，而不
是這個 proxy。關閉此設定並同步，會移除該表並回到單純的 Design B 覆寫，除非 `codexDesktopAuthless`
或非 loopback 准入仍需要供應商表形式；這兩種形式無法使用根層級 key，維持不變。

此模式生效期間，即時語音旁帶覆寫（`experimental_realtime_ws_base_url`）不會被注入——專用的供應商表
形式無法攜帶它——所以 Codex Desktop 語音會使用它原生的端點，而不是這個 proxy。

### 緊急壓縮模型（選擇加入）

當 OpenCodeX 為 Google 等供應商轉換遠端壓縮時，如果之後存在明確的最終答案，它會把較早回合中的圖像換成簡短的重新開啟說明。既有的分析與檔案參照會留在摘要輸入中；最後一個最終答案之後的圖像會保留給尚未解決的工作。只有 commentary 與沒有階段標記的歷史會被保留。這只影響壓縮請求，不影響已儲存的附件或一般模型請求。它減少重複的視覺輸入，但不保證很長的文字歷史放得進供應商的上下文上限。

`compactionRecovery` 讓初始的壓縮留在對話所選的路由上。它只在受支援的、輸出之前的壓縮失敗之後，才允許一次緊急嘗試。它與 `compactionRouting`（在壓縮開始之前選擇另一個模型）以及 `codexClientCompaction`（改變 Codex 的供應商形式）是分開的。

```json
{
  "compactionRecovery": {
    "enabled": true,
    "model": "provider/emergency-model",
    "allowDevinInvalidArgument": false
  }
}
```

請使用獨立設定、已授權、且上下文足以容納失敗輸入的模型。啟用復原代表允許該模型的供應商接收壓縮歷史，並在復原執行時為額外的嘗試收費；一般成功的壓縮不會產生額外呼叫。這個選項在缺少或停用時是關閉的。既有的已認證管理 API 透過 `PUT /api/settings` 接受這個區塊；送出 `compactionRecovery: null` 可移除它。直接編輯檔案應遵循一般的停止 proxy 設定流程。這個設定不會改變登入、對話的一般模型、Codex 的供應商 ID，或桌面 composer。

復原不會在取消、語意輸出、工具副作用、送出預算用盡，或認證、准入或政策拒絕之後重播。一般的 `400` 錯誤不會啟用後備。Devin 對過大的歷史回應不透明的、輸出之前的 `invalid_argument`；當請求的估計大小達到或接近模型的輸入視窗時，adapter 會改為回報 `context_length_exceeded`，所以 Codex 會在一般回合壓縮，而失敗的壓縮也符合上下文溢出的條件，不需要任何 Devin 專屬的選項。估計使用經過 Cognition 清理與截斷後的工具描述，與送往上游的請求一致。較小的請求得到相同的代碼時，仍是單純的 `400`。另外選擇加入的 `allowDevinInvalidArgument` 情況只涵蓋其餘那些 `invalid_argument` 失敗，而且只針對已識別的壓縮請求。緊急嘗試與原始請求共用送出預算，且絕不會啟動第二次復原嘗試。

原生加密壓縮不在這條復原路徑之內：它保留原本的錯誤。沒有自動的本機截斷模式。回應被接受並不能證明長對話保留了它的目標；在把緊急摘要視為已復原的任務之前，請先在原本的模型上驗證下一回合。

### 免登入 Codex Desktop（選擇加入）

在 **Dashboard → Overview** 中，**Open Codex without signing in** 控制這個既有的選擇加入偏好。
當設定缺席或為 false 時，開關預設為**關閉**；一個既有的明確 `codexDesktopAuthless: true` 會維持
啟用。儀表板會儲存這個偏好並執行一次完整同步。變更後請重新啟動 Codex Desktop。若同步失敗，已儲存
的偏好會保留，儀表板會顯示錯誤；請在重新啟動前先重試 **Sync**。啟用時，某些帳號門控的 Desktop
功能可能無法使用。上游憑證、本機資格、遠端准入認證與使用者自有的閘道設定仍維持既有的要求。

只要現用供應商需要 OpenAI 認證，Codex Desktop 就會顯示它的 ChatGPT 登入畫面。若你的 OpenCodex 設定
從不使用 ChatGPT 憑證（只走路由供應商，或 `chatgpt.com` 被封鎖），你可以選擇跳過這道關卡：

```bash
ocx system settings --desktop-authless on    # or "codexDesktopAuthless": true in config.json
ocx sync                                     # rewrites ~/.codex/config.toml; restart Desktop
```

開關開啟時，loopback 繫結會改為注入專用供應商形式，而不是根層級 `openai_base_url` 覆寫：

```toml
model_provider = "opencodex"

[model_providers.opencodex]
name = "OpenCodex Proxy"
base_url = "http://127.0.0.1:10100/v1"
wire_api = "responses"
requires_openai_auth = false
```

之後 Desktop 會在不登入的情況下啟動，並讓每個回合都經過 proxy 路由。這個設定在 `ocx start`、
重新啟動、`ocx sync` 與 `ocx ensure` 之後都會存活；關閉它（`--desktop-authless off`）會讓下一次
同步恢復預設的 loopback 形式，`ocx restore` 也會像移除其他任何注入路由一樣把它剝除。開啟期間可以
預期：

- 受 ChatGPT 門控的 Desktop 介面元素（帳號、用量、Fast 模式）維持暗色：Codex 是依供應商的認證需求
  推導出這些介面的。
- 新執行緒會被標記為 `opencodex` 供應商，與非 loopback 繫結一樣，歷史處理方式也相同。
- 會依原生限定允許清單過濾模型選擇器的 Desktop 版本，在這個模式下也可能顯示空的或 `Custom` 選擇器；
  請求仍會使用已設定的模型。請依照
  [Desktop 遠端伺服器](/zh-tw/guides/codex-app-models/#desktop-remote-伺服器)
  所述，在 `config.toml` 中設定 `model = "<provider>/<id>"`。

這只改變 Desktop 的登入關卡。非 loopback 繫結無論開關為何都會維持 `requires_openai_auth = true`
與 `env_key` 准入憑證；它絕不會在沒有認證的情況下暴露一個 OpenCodex 監聽器。

## Thread identity 與歷史記錄

預設 loopback 形式會讓新 thread 保持使用 Codex 原生的 `openai` provider 標記，因此一般 resume
history 不需要重新對映。sync 與 restore 只套用和目前狀態資料庫相符的備份 manifest，並精確恢復每個
thread 原本的 provider、source 與 event marker。沒有 manifest 的 `opencodex` row 會保持不變；只有在明確
要強制執行舊式重新標記時才使用 `ocx recover-history --legacy-openai --yes`。此命令的作用範圍刻意很廣：它會把所有
含有使用者訊息且目前標記為 `opencodex` 的 thread 改標為 `openai`，將 `exec` 正規化為 `cli`，並設定 event
marker；正常的專用 provider 歷史也包含在內。請先備份狀態，而且只有在確實需要這個完整範圍時才使用。non-loopback 專用 provider 模式在
啟用期間仍會把歷史映射到 `opencodex` provider，退出時再恢復已備份的 metadata。設定
`syncResumeHistory: false` 可完全不修改歷史。

## 模型目錄同步

Codex 從磁碟上的目錄顯示模型，預設為 `$CODEX_HOME/opencodex-catalog.json`。啟動時與執行
`ocx sync` 時，opencodex 會：

1. **備份**一次原始目錄到 `~/.opencodex/catalog-backup.json`，讓置頂操作可逆。
2. **取得**符合條件的 provider 即時模型目錄，快取約 5 分鐘；失敗時先 fallback 到上一份正常列表，
   再 fallback 到已設定的 `models[]`。`forward` 認證沒有模型端點；Cursor 使用
   `GetUsableModels` RPC，而不是 `/models`。
3. **合併**路由模型為帶 namespace 的條目（`provider/model`），從原生 Codex 目錄 template 複製，
   讓 Codex 嚴格的 parser 能接受它們。
4. **過濾** `config.disabledModels` 與各 provider 非空的 `selectedModels` allowlist。
5. **重新排序**，讓置頂模型排在前面，然後把合併後的目錄寫回。

路由目錄條目也會把 GPT-5 identity 改寫成真正的上游模型名稱。reasoning 控制來自 provider／model
metadata，使用 Codex 的 `low | medium | high | xhigh | max | ultra` 檔位；不支援的值會在送往上游前
完成對映或下調。

### Coordinator 診斷與復原

原生的設定／歷史寫入使用一個以規範 `CODEX_HOME` 為 key 的 per-user SQLite coordinator。若某個行程
在 SQLite 初始建立的時間窗內終止，即使沒有任何權威的過渡列，也可能留下一個零位元組的 coordinator。
`ocx doctor` 會回報確切的 coordinator 路徑，並區分零位元組、未版本化、沒有資料列、有效、不安全與
無法讀取這幾種狀態，且不會建立 SQLite sidecar。自動同步只會容忍一個身分穩定、已靜置至少一秒、其
不可變 SQLite 快照版本為零且沒有任何 table 的零位元組檔案；一個剛建立的零位元組檔案會維持在
被鎖定的 coordinator 路徑上。

對於 doctor 已證實是零位元組建立殘留的狀態，請先停止 OpenCodex proxy／服務，再執行：

```bash
ocx doctor --recover-zero-byte-coordinator --yes
ocx sync
```

復原會把仍然相同的零位元組檔案移到同目錄下的 `.zero-byte-backup-*` 路徑；它不會刪除證據，也不會
採用舊版路由狀態。它會拒絕：proxy 正在執行、鎖被佔用、symlink／reparse point、外來的擁有者、已變更
的檔案、任何非空的資料庫，以及已經有權威資料列的 coordinator。Desktop 渲染端的過濾是獨立的一層：
一個正確的目錄與 coordinator 本身不會繞過 Codex App 的模型允許清單。

### 路由的本機工具

非原生路由目錄列使用 `tool_mode: "code_mode_only"`。這讓 Codex 能暴露官方 `exec` 入口點與巢狀 MCP
工具，包括 Browser 與 Computer Use，同時 opencodex 只路由模型的一般 function call。工具執行、權限
與確認仍留在 Codex 本機；opencodex 不會實作第二套瀏覽器或桌面控制 executor。

對不接受 Codex `exec` custom-tool grammar 的 key-auth Responses provider，opencodex 會把該宣告與其
歷史編碼成上游 function tool，再於 Codex 看見前將串流 function-call lifecycle 還原成
`custom_tool_call`。原生 OpenAI forward 路由與受支援的 `apply_patch` custom tool 維持不變。

若一個路由模型把完整的補丁當成整個 code-mode `exec` 輸入送出，opencodex 會在工具完成事件抵達
Codex 之前，把它轉換成巢狀的 `tools.apply_patch` 呼叫。原生自訂呼叫與轉換後的 function call 使用
相同的完成規則；補丁預覽會在其可執行形式尚未解析完成前被保留。只包含補丁文字的 JavaScript，以及
不相關的原生自訂 payload，都維持不變。

當路由模型雙重包裝一個可執行的自由格式主體時，opencodex 會移除一層只包含單一輸入字串的額外 JSON 物件。
這項修復適用於本機 exec 與 apply_patch 主體，讓其他工具文法與有歧義的物件維持不變，且不會遞迴解碼。
只有當主體仍有可能是一個這樣的包裝器時，才會暫扣其串流預覽；單純以物件或區塊開頭的 JavaScript 會隨著抵達持續串流。

路由模型也可能誤將諸如 `{"cmd":"git status --short"}` 的 shell 引數物件送到 code-mode `exec`。
對於已驗證的 code-mode 目錄，opencodex 會把無歧義的 shell 物件轉換成 `tools.exec_command(...)` JavaScript，
並透過 `text(...)` 轉發其輸出。shell 選項會被保留，而 Codex 仍會執行並授權該指令。有效的 JavaScript 後備欄位、
有歧義的物件與無關的工具命名空間不會被轉換。這項相容性修復不會繞過供應商速率限制或改變已設定的重試政策。

相同的修復也涵蓋 goal 輔助函式。當目錄只宣告 code-mode `exec` 時，若路由模型直接將 `create_goal`、`get_goal`
或 `update_goal`（或其 `default.` 前綴拼法）作為工具呼叫，該呼叫會被轉換成 `exec` 內對應的 `tools.<helper>(...)` 呼叫。
真正宣告裸 goal 工具的目錄會保留它；兩者皆未宣告的目錄仍會將該呼叫視為未宣告而拒絕。

在帶有已驗證自由格式 code-mode `exec` 目錄的路由轉換上，直接送到 `mcp__<server>__<tool>`（包含供應商加上的
`default.` 前綴）的結構化呼叫，也會被包裝成巢狀的主機工具呼叫。這可避免純粹因模型省略 `exec` 包裝而造成的重試。
明確宣告的 MCP 工具維持正常行為；名為 `exec` 的一般 JSON 函式不會啟用此修復。未知工具在主機端仍會失敗。
作為一般回答文字印出的工具呼叫紀錄不會被這項相容性規則執行。

對於路由的 Responses 回合，若請求的已宣告工具目錄不可用，明確的工具強制執行政策也會拒絕用戶端工具呼叫。
空的已宣告目錄會拒絕每一個用戶端工具呼叫；Chat 與 Anthropic 用戶端保留各自的工具驗證責任。

路由的 code-mode 回合也會在首次呼叫前收到主機對巢狀輔助工具的規則：`tools.apply_patch`
接收一個字串，開頭與結尾必須是沒有額外包裝的獨立補丁標記行；isolate 中沒有 `import`，長時間執行的
命令透過 `write_stdin` 輪詢。如果原生路由 Responses、Kiro 或 Cursor 路徑上的 code-mode exec
結果仍包含主機的某則失敗訊息，opencodex 會附加一行提示，指出對應規則。這項變更不會重寫模型的
程式碼或補丁文字。

一般路由 Responses function call 在完成時，也會使用原本宣告的參數綱要：整數欄位中的整數浮點數，
以及僅接受字串欄位中的整數數字都會被正規化，而分數與數字聯集則維持不變。一個明確設為空字串的已
完成引數會變成 `{}`。最終事件與本機儲存的延續歷史彼此一致。無歧義的點分命名空間拼法會被還原成宣告
的命名空間與工具名稱。

所選 provider 必須支援 function/tool calling。不支援 tool call 的純文字 provider 無法使用 `exec`、
Browser 或 Computer Use。原生 OpenAI 列保留上游 tool mode 不變。

`ocx sync` 變更這份 metadata 後，請重新啟動 Codex App 並開啟新任務。既有 app-server process 與任務
可能仍保留啟動時載入的目錄與 tool plan。

### 路由模型的行內視覺化

Codex App 的 Visualize 外掛會要求模型回覆一個用私用區字元（U+E200 … U+E201）包起來的參照。有些供應商會在模型看到之前就移除那些字元——我們檢查過的每一條 Claude 路由都是如此——所以模型過去會以一行裸的 `visualize{"path":…}` 回答，Codex App 把它當成文字印出。

opencodex 會在送給路由模型的對話文字中，把那些參照改寫成 app 自己會繪製的指令 `::codex-inline-vis{path="/absolute/path/chart.html"}`。任何模型都能讀取並重複那個形式，所以視覺化會行內繪製。原生 OpenAI 透傳請求會原樣轉送。已經以裸 `visualize{…}` 形式儲存的回覆維持原狀；請在新的回覆中再次要求該視覺化。

### 自訂模型顯示名稱

自訂模型可以帶一個可讀的**顯示名稱**，只覆寫 Codex 模型選擇器顯示的標籤，不改變任何路由行為。
顯示名稱只對應目錄條目的 `display_name` 欄位；路由 slug（`<provider>/<model>`）、alias collision 順序、
provider 與原生 OpenAI 行銷名稱都維持不動。

可從 CLI 新增顯示名稱；proxy 在線時會立即同步目錄：

```bash
ocx models add deepseek deepseek-v4 --display-name "DeepSeek V4" --context-window 128000
```

對於自訂供應商，省略明確的視窗後，目錄會使用包括模型 ID 推斷在內的[上下文視窗回退規則](/zh-tw/reference/configuration/providers/#自訂供應商的上下文視窗)。若中轉支援的容量低於廠商視窗，請明確設定視窗或 Context cap。

遠端 Codex client 可以使用一般的資料平面金鑰取得相同的產生目錄——與 `/v1/responses` 所用的憑證
相同，而非管理員 token：

```bash
dest="${CODEX_HOME:-$HOME/.codex}/opencodex-catalog.json"
tmp="$(mktemp "${dest}.XXXXXX")"
curl -fsS -H "x-opencodex-api-key: $OPENCODEX_API_AUTH_TOKEN" \
  "https://proxy.example.com/v1/catalog" > "$tmp" \
  && mv "$tmp" "$dest"
ocx sync-cache
```

回應是原始的 `opencodex-catalog.json` 文件，不包含 provider 憑證。若可用，
`x-opencodex-codex-version` 標頭會回報伺服器上的 Codex runtime 版本，讓 client 能辨識版本差異。

`GET /v1/catalog` 的存在，是為了讓讀取模型清單不需要花費 admin token。它是唯讀的（`GET` 與
`HEAD`），接受 `x-opencodex-api-key`、bearer token 或 `x-api-key`，並提供與管理路由完全相同的
位元組。回應帶有一個強 `ETag`——把它當作 `If-None-Match` 傳回可以重新驗證並取得 `304` 而非完整
文件——並帶有 `Cache-Control: private, no-cache`，因為主體本身就位於一個憑證之後。

在此被接納的資料平面金鑰，在管理平面上**沒有**取得任何額外能力：`/api/catalog` 與其他每一個
`/api/*` 路由，仍然需要 admin token 或一個儀表板 session。較舊的 `/api/catalog` 路由對儀表板，
以及已經持有 admin token 的指令碼而言，行為不變、照常運作。

也可以透過管理 API（`POST /api/custom-models`、`PUT /api/custom-models/<id>`，搭配 `displayName`
字串）與 web 儀表板設定或編輯它。`/` 會被拒絕，因為它會與路由 slug 的分隔符衝突。

顯示名稱**只用於顯示，且在重新產生時保持穩定**。每次 `ocx sync` 與目錄 refresh 都會從
`config.json`（包含 `customModels`）重新推導路由條目，因此會重新套用已設定名稱，而不會漂移回路由
slug。受管服務重啟後，也會在 proxy bind 後盡力同步一次。若這次啟動時的 best-effort 同步失敗，例如
離線登入，會保留先前已持久化的目錄，並在下一次成功的 `ocx sync` 重新套用設定名稱。真正的上游原生
名稱，例如 `gpt-5.6-sol` → "GPT-5.6-Sol"，來自固定的上游 snapshot，絕不會被自訂顯示名稱覆寫。

### 外部 provider 管理器

若 `config.toml` 已選用非 `openai` 或 `opencodex` 的 provider，OpenCodex 會保持檔案不變，並跳過
profile 寫入、目錄／cache refresh，以及立即與背景的 Codex 歷史中繼資料還原。管理自訂 provider 的工具常會把
既有 session 標上該 provider id；直接替換 active id 可能讓這些完好的 session 從 Codex 歷史檢視消失。
由舊版根級 profile 選到的外部 provider 也有同樣保護。

當外部供應商擁有 `config.toml` 時，`GET /api/settings` 與 `ocx system settings --json` 回傳的設定報告，
會把 Desktop authless 與用戶端側壓縮開關——以及 Codex 登入要求——描述為由該供應商控制，而非顯示 OpenCodex
本應產生的有效狀態。切換任一開關仍會儲存偏好，但不會改寫 `config.toml`；若你把 Codex 切回 OpenCodex
管理的供應商並重新執行 `ocx start`，已儲存的值就會生效。

若 `config.toml` 存在但無法讀取（權限問題，或讀取時恰好發生刪除競爭），同一份報告會將有效值與登入答案保留為未確定，
而非顯示 OpenCodex 在本機計算出的狀態。套用紀錄會保留這項說明——包含在因整合停用或代理停止而關閉注入閘門時的儲存——
並將其標記為可重試，使檔案再度可讀之後的 `ocx system settings --json` 讀取能回報已確定的答案。
在 Codex 整合停用期間，`ocx sync` 僅處理目錄，無法套用它。

請讓單一工具負責 Codex provider 設定。若要在既有 provider manager 後方使用 OpenCodex，請把該
provider 指向 `http://127.0.0.1:10100/v1`，並使用 Responses passthrough（Codex TOML 中
`wire_api = "responses"`），不要做 Chat Completions translation。啟用 proxy API auth 時，也需從
`OPENCODEX_API_AUTH_TOKEN` 傳入 `x-opencodex-api-key`，形式與上方 non-loopback provider 相同。若要讓
OpenCodex 直接注入路由，請先將 Codex 切回內建 `openai` provider，移除任何使用者自有的根級
`openai_base_url`，再重新執行 `ocx start`。

### 明確的 `tool_search` 疑難排解

路由的本機工具有兩條不同的探索路徑。在一般的路由 code mode 下，Codex 可以透過官方 `exec` 工具的
`tools` 全域變數與 `ALL_TOOLS`，暴露延遲載入的 MCP／app 工具；這條路徑不需要模型看到或呼叫
`tool_search`。

另外，`tool_search` 是一個由客戶端執行的 Codex 探索介面。它不是一個 OpenCodex 功能旗標，上游的
`tool_choice: "auto"` 值也不會建立或啟用它。只有當 Codex 在傳入的 Responses 請求中已經包含類似
這樣的宣告時，OpenCodex 才能轉送這個明確的介面：

```json
{
  "tools": [
    { "type": "tool_search", "description": "Load deferred tools" }
  ]
}
```

對路由的 chat／本機模型而言，OpenCodex 會把那個宣告暴露成一個名為 `tool_search` 的一般 function。
若模型呼叫它，OpenCodex 會把該呼叫轉換回一個 Responses 的 `tool_search_call`；Codex 執行搜尋，並在
之後的 `tool_search_output` 提供搜尋結果的工具定義。以這種方式載入的定義，會在下一個模型回合開始
可用。

在變更供應商設定之前，請先檢查失敗發生在哪個邊界：

1. **傳入的請求中沒有 `type: "tool_search"`：** 表示現用的 Codex 客戶端／session 沒有廣告這個
   明確的 `tool_search` 介面。OpenCodex 無法憑空捏造那個宣告。這不代表一般的 code-mode 工具不可用：
   請先確認路由模型能否使用 `exec`，並透過 `tools` / `ALL_TOOLS` 探索所需的巢狀工具。
2. **傳入的宣告存在，但沒有 `tool_search` function 送達路由請求：** 只擷取遮蔽過的工具型別／名稱
   清單，並回報一個 OpenCodex bug。絕不要附上 bearer、帳號 id、對話輸入、完整標頭或完整的請求主體。
3. **路由請求中含有 `tool_search`，但本機模型從不呼叫它：** relay 運作正常。請改用一個 function
   calling 可靠的模型／模板，並在指示中明確要求它去搜尋它需要的延遲載入工具。LM Studio 的
   `tool_choice: "auto"` 只是允許使用工具，不會強迫模型呼叫這個 function。
4. **一次呼叫被重複發出，或載入的工具始終無法使用：** 擷取遮蔽過的 `tool_search_call` /
   `tool_search_output` 項目型別與呼叫 id。OpenCodex 會把兩者都保留在歷史中，所以模型應該會看到
   已完成的搜尋，而不是永遠重複發出它。

明確的 wire 映射請見[解析器與橋接](/zh-tw/reference/architecture/#解析器)。沒有任何供應商層級的設定
可以補上一個缺失的 `tool_search` 宣告；一般的 code-mode 探索仍是一條獨立的路徑。

### 快取讀取診斷

在啟動代理之前設定 `OPENCODEX_CACHE_DEBUG=1`，會為每個已完成的請求寫入一筆診斷紀錄到
`<config-dir>/cache-debug.jsonl`。此開關預設關閉；設為 `0` 或移除即可停用擷取。此檔案
在強化過的設定目錄中僅供擁有者存取（`0600`），超過 200 行後會輪替，只保留最新的 100 行。

每筆 JSONL 紀錄包含協定、路由過的供應商／模型、快取計數器的存在與來源，帳號、prompt-cache
key 與允許清單中的 session 標頭的行程內相等性標籤，以及 instructions、tools 與
message/input block 的有序指紋。此診斷絕不儲存 prompt 或訊息文字、工具名稱、原始標頭、原始快取／session／帳號識別碼，
或由它們衍生的持久標籤。它的隨機 HMAC 金鑰在行程啟動時建立，與其他除錯金鑰分開，且永不
持久化；因此標籤只在同一個代理行程內比對值。

- `session.inboundHeaders` 與 `outboundHeaders` 分別記錄 `session_id`、`session-id`、`thread-id` 與
  `x-session-id`。跨越這些名稱與方向的相同值會有相同的標籤。未觀測到的一側會被省略，與觀測到缺席的標頭不同。
  這些標頭是診斷關聯輸入，並非帳號親和性的證明。
- `accountAffinity` 為每組觀測到的標頭集合記錄一個來自共用 Codex 對話身分推導的獨立標籤鍵。
  `derived-key-not-binding` 的字面意義就是如此：一個鍵並不是綁定已儲存、已選取或已重用的證據。回報的路由標籤是分開的。
- `prefix.comparison` 比較觀測到的傳入與傳出投影。`continuation` 則將每一側與上一個具有相同完整非空傳入
  session 標頭身分、已認證呼叫端範圍、協定、模型與設定目錄的已完成請求比較。呼叫端範圍來自於 Chat/Messages 橋接之前
  擷取到的已認證准入，而非來自改寫後的上游標頭。它只用於私有的記憶體內查詢鍵，絕不序列化。
  相同的已准入金鑰在受支援的認證標頭之間具有相同的範圍；不同的金鑰保持隔離。沒有已認證准入身分時（包含未認證 loopback），
  延續比較為 `uncomparable`；逐請求的傳入／傳出比較仍可使用。供應商變更不會重設此比較；提示鍵與明確的帳號標籤變更會分開回報。
  僅出現在傳出的工作階段識別碼與 prompt-cache key 絕不會補上缺失的關聯身分。
- 比較結果回報 `first`、`equal`、`append-only`、`different`、`truncated` 或 `uncomparable`。
  只有訊息尾端成長才算 `append-only`。頂層指令與系統內容位於工具之前；輸入／訊息列（含 system/developer 更新）
  維持原本順序。缺失的觀測與不支援的形狀皆為 `uncomparable`，絕不會假定等於空前綴。
- 每個區段最多保留 128 個標籤。未觀測到的共同尾端會回報 `truncated`，而非相等或精確的第一個分歧點。
  記憶體中最多保留 512 筆近期關聯歷史；被逐出的歷史在下一次觀測時會變成 `first`。

這些是在既有請求掛鉤處對已剖析主體的觀測，而非擷取的網路位元組或上游快取重用的證明。並行請求依完成順序而非送出順序比較。
此開關只改變診斷，不改變親和性選取或快取行為；原本符合資格的直接 Chat/Messages 通道在除錯模式下既有的橋接需求依然適用。

### 目錄疑難排解

若模型在 Codex 中缺失，或目錄順序／可見性看起來不正確，請依序檢查：

1. **provider 上的 `selectedModels`**：非空 allowlist 只會向 Codex 暴露列出的 id；空或省略則暴露所有
   已發現模型。不在 allowlist 中的 id 永遠不會進入目錄。
2. **`disabledModels`（頂層）**：會同時從目錄與 `/v1/models` 隱藏模型，並把裸原生 GPT slug 設為
   `visibility: "hide"`。
3. **`liveModels: false`** — `liveModels: false` 時，若 `models` 為空或省略，初始列表先加入已設定的 `defaultModel`，
   再加入 `retainModels`，重複 ID 僅保留首次出現的位置。若明確設定了非空 `models`，則按
   `models`、`retainModels` 順序建立，不會自動加入另一個 `defaultModel`；仍可將該模型明確寫入
   `models` 或 `retainModels`。這些欄位均未提供 ID 時，初始列表為空。此順序不保證最終選擇器的顯示順序。
   `selectedModels`、`disabledModels` 與供應商停用規則仍然適用。`authMode: "forward"` 保留原有獨立分支，
   不使用此靜態路由列表。這些規則不改變即時探索失敗時的後備行為。
4. **Cursor `GetUsableModels`**：Cursor adapter 透過 protobuf `GetUsableModels` RPC 探索模型，而不是
   `/models`，所以 Cursor 端變更可獨立改變可見 id。
5. **cache 與 `ocx sync`**：即時目錄約快取五分鐘（`modelCacheTtlMs`，預設 `300000`）。執行
   `ocx sync` 可強制重新抓取並立即重寫目錄。
6. **正在執行的 Codex `app-server`**：長時間執行的 Codex `app-server`（Desktop／CLI 背景 host）可能
   仍在記憶體保留舊列表，因此只重寫磁碟目錄還不夠。`ocx sync` 與 `ocx sync-cache` 偵測到這些
   process 時會警告。`ocx sync --restart-codex` 會重啟這些 process，並在 macOS、Linux 與 Windows
   上完全結束再重新啟動 Codex 桌面應用程式，讓選擇器重新讀取目錄。若要讓桌面應用程式繼續執行，請傳入
   `--restart-app-server-only`，或自行停止對應的 `app-server` process。

:::caution[其他本機寫入者]
目錄寫入（`opencodex-catalog.json`、`config.toml`）在 opencodex **內部**是原子的；這只避免兩個
opencodex 擁有的寫入者競爭時出現半寫入檔案。它**不會**阻止其他本機 process、file watcher 或 sync
agent 在 opencodex 寫入後改寫目錄可見性或順序。Codex 另有自己的 `models_cache.json`，可獨立 refresh，
因此可能在不重寫 `opencodex-catalog.json` 的情況下改變可見列表。若 proxy 執行中模型卻意外跳動，請
先停止或重新設定競爭的寫入者，再執行 `ocx sync`。這是外部寫入者風險，不是已確認的 opencodex
缺陷。
:::

## Proxy 連線錯誤

若 Codex 重試後報出類似
`stream disconnected before completion: error sending request for url (http://127.0.0.1:10100/v1/responses)`
的錯誤，或 Claude Code 出現類似連線失敗，代表 opencodex proxy 沒有執行：設定埠上沒有任何監聽，
client 只能顯示原始連線錯誤。請重新啟動 proxy：

```bash
ocx start              # foreground
ocx service install    # persistent: auto-starts on login and respawns on crash
```

`ocx status` 可檢視 proxy 是否執行，未執行時也會給出相同的重啟提示；`ocx doctor` 會回報重啟安全性
（service／shim 覆蓋情況）。

### 任何輸出前的上游過載

當 ChatGPT 後端在產生任何輸出前，以 `server_is_overloaded` 或其他伺服器錯誤拒絕池化的原生 Codex 回合時，
opencodex 會以短暫、有上限的退避重試同一個帳號，然後將該回合移往另一個符合資格的 Pool 帳號。
已釘選的帳號（帳號限定模型）會重試但絕不會移轉。一旦有任何輸出抵達 Codex，該回合就絕不會再次送出。
若每次嘗試皆遭拒絕，Codex 會收到與未重試時相同的錯誤。原生 compact 請求在遇到伺服器錯誤時也會以相同方式移往另一個 Pool 帳號。

### 執行期代理實例（Codex 0.164+）

當 `features.runtime_agent_instances` 啟用時（預設關閉），Codex 0.164 會以執行期代理斷言（runtime agent assertion）簽署每個請求。
opencodex 支援其兩種模式之一：

- `mode = "dual_header"` 會保留一般的 `Authorization: Bearer` 憑證，並加上 `x-openai-agent-assertion` 標頭。
  opencodex 會照常處理該請求。此斷言只會在該回合使用你自己的憑證前往 ChatGPT Direct 時轉發。
  當請求由 Pool 帳號、已儲存的主憑證、路由供應商或 sidecar 服務時，該標頭會被移除，因為它屬於 Codex 送出的憑證。
- `mode = "assertion_only"` 會以 `Authorization: AgentAssertion <jwt>` 取代 bearer。
  opencodex 會以 HTTP 400 與錯誤碼 `agent_assertion_unsupported` 拒絕這類請求。
  它絕不會以 Pool 或供應商憑證替換該斷言，也絕不會轉發或記錄該斷言。當 Codex 透過 opencodex 執行時，
  請使用 `dual_header` 或關閉此功能。

### 以 `ocx codex` 啟動

只有在設定及其命名空間受到保護、不被其他主體存取時，才會提供該金鑰；目前使用者與具特權的 OS 權限單位受到信任。同一使用者的處理程序受到信任：擁有你寫入權限的行為者本來就能讀取你的 OpenCodex 金鑰檔。驗證與原生啟動之間、同一使用者對設定的取代，不在此威脅模型之內；啟動器不會在交接時凍結設定。

在 Windows 上，預設的 ProgramData 建立權限會扣住該金鑰，即使 `ProgramData\OpenAI\Codex` 不存在也一樣。ProgramData 底下的系統 Codex 設定資料夾必須存在，而且只有 Administrators／SYSTEM 可寫入，其上層目錄也必須受到保護、不被其他使用者取代。請管理員檢視該目錄的原則。opencodex 本身絕不變更 ACL，也不提供佈建指令。另一種做法是匯出 `OPENCODEX_API_AUTH_TOKEN` 來提供你自己的金鑰；`ocx codex` 不會動它。請見[啟動器需求與診斷](/zh-tw/reference/cli/agents/#ocx-codex-codex-args)。其他拒絕情況也會產生一行簡短、具體、且不含金鑰值、金鑰檔內容或金鑰檔路徑的 stderr 訊息。

### Codex 自動啟動 shim

執行 `ocx codex-shim install` 可安裝選用的啟動器包裝器。它會在一般 Codex 啟動前先執行 `ocx ensure`，
再轉發原始引數與離開狀態。此指令也適用於桌面套件中隨附的獨立版 `ocx`：安裝探測與已安裝的包裝器都會使用該執行檔，
不需要額外安裝 Bun 或原始碼 checkout。

在 macOS 與 Linux 上，請在完成其他 PATH 設定後，於目前的 shell 中啟用私有包裝器。
使用預設 OpenCodex 家目錄時，請執行：

```sh
. "$HOME/.opencodex/codex-shell-env.sh"
```

使用自訂 `OPENCODEX_HOME` 時，請使用 `ocx codex-shim install` 印出的帶引號路徑。
在 shell 啟動檔的其他 PATH 設定之後加入該 source 行，即可在未來開啟的 shell 中啟用。
OpenCodex 不會編輯該檔案或變更父 shell。就地式的舊版 Unix shim 不會自動遷移；
請明確執行 `ocx codex-shim install` 來遷移它們。

中斷中的舊式 Unix 遷移可在升級 bigint 檔案身分後續做：journal 比對只容許微秒以內的
時間轉換捨入差，仍檢查檔案身分、mode、size 與 symlink target。舊版可能拒絕含十進位
字串身分的所有權紀錄；降版前請先完成復原。

使用 `ocx codex-shim status` 可檢查其狀態。在 macOS 與 Linux 上，`ocx codex-shim uninstall`
會移除私有覆蓋檔案並讓原生 Codex 保持完好。Windows 保留就地腳本包裝器；解除安裝會還原已儲存的啟動器。
請見 [CLI 生命週期參考](/zh-tw/reference/cli/lifecycle/#ocx-codex-shim-installstatusuninstallremove)。

## 實驗性 Windows 桌面相容性

**Codex Set → Desktop compatibility** 提供受限相容性試用的本機控制項，同時保留原生 Codex 登入。
這是一個實驗性中繼，不保證每個 Codex 組建或已耗盡帳號狀態都能恢復其輸入框。

在獨立的本機儀表板上，請先在代理電腦上執行面板顯示的指令，例如
`ocx gui pair --desktop --origin http://127.0.0.1:10100`，並貼上其一次性機密代碼。若 `ocx` 不可用，請先安裝 CLI。
私密家目錄權限拒絕必須先解決才能核發代碼。單靠一般的配對代碼或已經配對的儀表板並不能授權 Desktop 動作。
面板會在既有工作階段上將 Desktop 代碼交換為範圍權限，然後讀取 `/authorization` 加以驗證；
它不會建立或取代瀏覽器工作階段。這會在該工作階段中授權 Desktop 動作最多五分鐘；不會變更 Remote Link 或金鑰揭露權限。
API 契約請見 [Desktop 授權](/zh-tw/reference/management-api/#桌面授權)。
不支援從 Hub 與已連線用戶端執行 Desktop 寫入。
若授權不可用，請直接在代理電腦上透過 HTTP 連線已設定的 loopback 位址與連接埠使用獨立儀表板。
若設定的 `hostname` 為 `localhost` 或例如 `0.0.0.0` 等非 loopback 位址，請在 [config.json](/zh-tw/reference/configuration/)
中將其設為 `127.0.0.1` 或 `::1`、重新啟動代理，並重新開啟對應的位址與連接埠。其他狀況（包含轉發與不相符的連接埠或工作階段）
也可能使授權不可用；單靠變更主機名稱無法解決這些情況。
已記住的儀表板工作階段無法兌換 Desktop 授權。請在代理電腦上以私密瀏覽器視窗開啟相同的本機位址與連接埠、回到此面板，
並在該處要求新代碼。過期或登出後，請重新載入本機儀表板並再次授權。面板會重新整理狀態、指紋與設定修訂版；
請再次選取所需動作並確認同意。它絕不會重播先前的 POST。憑證過期或未知信任不會阻止這項本機 HTTP 授權；
清理、續期、停止與關閉開機啟動仍需要它。

1. 檢查狀態、準備加密憑證，並在註冊信任前檢視其指紋。Windows 可能會要求確認。
   信任僅套用於目前的 Windows 使用者，並允許本機中繼處理 `chatgpt.com` 流量。
2. 開始觀測。先儲存草稿、關閉 Codex，再使用此面板中的 **Open Codex** 以受管連線啟動封裝應用程式。
   面板絕不會強制關閉既有的應用程式。
3. 只有在觀測到符合資格的耗盡狀態後，**Run 3-minute trial** 才會提供另一項全帳號範圍的同意。
   它會調整已登入帳號的兩個介面旗標，而非僅針對所選模型。實際用量、點數、花費限制與伺服器上限維持不變。
   單靠產出回應並不能確立輸入框已恢復。

顯示仍有可用用量或受保護狀態的原始回應會立即結束試用。可用點數或作用中的 Luna Reserve 也會讓回應保持不變並結束試用，
即使一般用量已耗盡亦同。這會保留應用程式既有的權益狀態。若之後再次出現符合資格的耗盡狀態，必須再次取得明確試用同意；
先前的同意不會靜默重新啟用修正。

**Return to observation** 會解除修正。三分鐘上限限制的是回應修正，而非 Codex 重新整理其顯示畫面所需的時間。
到期與返回觀測都會請求一次全新的用量回應；在該回應抵達前，應用程式可能保留先前的顯示畫面。
面板會在試用同意前以及等待原始回應期間顯示這項限制；它無法確認應用程式的快取重新整理。
**Stop service** 會關閉其連線並保留憑證供重用；進行中的連線可能會中斷。若要續期或移除信任，
請先停止服務並關閉 Codex。續期會準備一張新的未受信任憑證；註冊前請先檢視新指紋。不確定的動作不會自動重試。
憑證僅限用於 TLS 伺服器認證。若狀態顯示 `renewal-required`，請停止服務並關閉 Codex，再於重新啟動前續期舊憑證。
原生 API URL 必須符合代理實際的監聽位址與連接埠。IPv4 與 IPv6 loopback 位址在此不可互換；模糊的 `localhost` 別名會被拒絕。
Codex 自動的 MCP 連線重新整理與設定格式化不會使觀測失效。模型、認證、設定檔與路由變更仍需要新的觀測脈絡；
服務不會在試用期間靜默採用這些變更。

服務會保留其 PAC 位址與本機連線連接埠，以便在重新啟動後重用。使用同一張受信任憑證，
已設定的應用程式可以透過快取的 PAC 重新連線；重新啟動服務絕不會恢復修正試用。若儲存的連接埠無法繫結或連線中繼資料無效，
啟動會拒絕，而不會靜默指派另一個位址。首次成功啟動會在 OpenCodex 家目錄下擁有
`codex-desktop-compatibility/connection.json`。不要把刪除該檔案當作例行重啟修復方式：不同的位址需要使用新的受管連線重新啟動應用程式。

目前支援僅限於經過評估的 Windows 組建 `26.924.2738.0` 及原生檔案登入。透過共用的對外政策支援 HTTP/HTTPS 代理與已認證的 SOCKS5 代理；
`NO_PROXY` 可明確選取直連路由。失敗的代理連線不會退回直接對外連線。這些控制項尚未支援 OpenCodex 受管用戶端模式。
對此桌面中繼而言，當 `HTTPS_PROXY` 未設定時，HTTP(S) `ALL_PROXY` 也適用。無效的 `HTTPS_PROXY` 會拒絕操作，而不會退回 `ALL_PROXY`。
未知的應用程式組建會拒絕修正；整合不會修補應用程式檔案，也不會切換為無登入模式。
原生根設定及其選定的設定檔必須將 `openai_base_url` 路由至此程序實際的本機資料監聽器。不同的供應商、目的地或不支援的覆寫會拒絕觀測啟動。
此檢查不會判斷對話選取的模型，也不會證明沒有專案層級覆寫。若試用期間路由或已安裝的應用程式組建發生變更，
修正會在下一個用量回應前被拒絕；定期檢查也會將閒置試用退回觀測模式。原始回應與其他應用程式流量會繼續中繼。
原生登入檔案替換或 token 輪替也會使試用失效，即使回到同一個帳號亦同。請先停止並重新啟動觀測以繫結目前登入，再執行另一次明確試用；
舊的回應無法授權替換後的工作階段。
對根 Codex 設定（其 MCP 伺服器表與格式除外）、供應商設定、模型別名、路由設定檔、後備、壓縮或記憶模型路由的變更，也會使觀測脈絡失效。
還原先前的設定不會恢復其同意：請停止並啟動觀測，然後在符合條件時確認新的試用。這偵測的是那些已設定路由的變更，而非對話實際選取的模型；
未變更的混合供應商設定並不能證明供應商隔離。

在準備憑證並成功手動啟動之後，可在同一面板啟用 **Resume observation when OpenCodex starts**。
選用的 OpenCodex 設定 `"desktopCompatibility": { "startOnProxyStart": true }` 會在模型代理啟動時恢復**僅限觀測**。
省略或 `false` 會停用此自動啟動。它會重用已儲存的端點與受信任憑證，絕不會啟動 Codex 或註冊信任，也絕不會恢復套用試用。
自動觀測會等待啟動設定同步完成。同步失敗或等待超過兩分鐘會讓觀測保持關閉；請在解決啟動問題後檢查其狀態並手動啟動。
模型代理仍會依循其自身的就緒政策。若缺少先決條件，觀測會保持關閉，而模型代理繼續執行。
儲存此偏好不會啟動或停止目前的服務。如需立即變更，請使用其獨立的服務控制項。若儲存無法確認，請在重試前先重新整理其狀態。

執行中的服務並不代表 Codex 已經透過它連線。一般的應用程式啟動或應用程式更新程式可能會省略受管連線引數。
請儲存草稿、關閉 Codex，再使用此面板中的 **Open Codex** 還原該連線。此控制項絕不會替你關閉應用程式。
Codex 更新之後，未經評估的應用程式版本在審查其相容性之前會拒絕修正；重新安裝憑證不會讓未經評估的組建變成受支援。

面板也可以將上一次已完成的組建檢查回報為診斷中繼資料：此組建當初對照評估的套件版本、該次檢查觀測到的套件版本、
兩者是否相符，以及檢查何時完成。這是過去的觀測紀錄，而不是對已安裝套件的即時讀數。服務停止、應用程式更新，或檢查仍在進行／曾中斷後，
它可能落後於實際安裝；只有已完成的探測才會重新整理它，且 `verified` 結果描述的是該次檢查時觀測到的套件，而非現在安裝的任何版本。

在 Windows 上，只有當目前的 OpenCodex 程序擁有服務中的相容性執行期時，明確的 OpenCodex 完整應用程式重啟才會保留已經啟用的 loopback 相容性 PAC 引數。
過期或外來的端點會在停止 Codex 之前被拒絕；重啟期間執行期被替換也會阻止受管重新啟動。應用程式會透過 Windows 套件啟用啟動。
它會在啟動後檢查套件身分與路由引數；無法讀取或衝突的主應用程式路由引數會在重啟前引發拒絕。這不會啟用相容模式、安裝憑證，或自動監看並重啟應用程式。
不帶該路由引數的正常啟動維持既有行為。

### 傳輸涵蓋範圍與復原證據

相容性面板將經過身分檢查的 JSON/SSE 用量回應與目前繫結的串流，與開啟中的連線分開回報。這些是整個生命週期的中繼觀測值，
包含診斷用戶端發出的請求。它們不會識別送出的原生程序、證明應用程式更新了其權威快取，或證明輸入框已恢復。
此診斷狀態不會加入任何請求主體、token、帳號 ID 或來源 IP。

[Issue #6196](https://github.com/lidge-jun/opencodex/issues/6196) 回報了一個 macOS 組建，其權威閘門請求源自內建的 Rust app-server，
並繞過 Chromium PAC 設定。健康的 PAC、憑證或合成請求無法建立對該傳輸的涵蓋。這項 Windows 實驗不是該 macOS 設計阻礙的修復方案。

在新增其他平台或傳輸之前，請先記錄並驗證以下順序：

1. 識別送出每筆權威閘門請求的實際程序與傳輸。
2. 與測試用戶端分開，證明來自應用程式本身的請求能抵達預期的中繼。
3. 針對確切的已安裝組建，驗證回應綱要與應用程式的快取／更新路徑。
4. 在自然的帳號耗盡情況下，驗證原始輸入框送出、獨立供應商完成回應，以及登入、Chat、既有對話串與遠端連線的保留。
5. 驗證關機、一般啟動、重啟與更新行為；不可從其中一項推論另一項。

目前政策只處理 `/backend-api/wham/usage` 與其 `/stream` 端點。對話初始化與其他端點（包含其 `blocked_features` 與 `limits_progress`）會原樣通過。
它們的存在並不代表有權限清除它們：它們可能代表無關的限制。Windows 組建的 renderer-to-Electron fetch 路徑並不能確立不同作業系統／組建或每個 app-server RPC 的網路路徑。
App-server 路由需要自己經過審查的設計；單靠變更模型供應商 URL 並不能證明帳號、登入或遠端控制流量走同一條路由。這些控制項不會安裝任何自動 app-server 包裝器、全域代理變更或登入改寫。

## Codex 保留模式下的路由模型

Codex Pool 可選擇在選取的 5 小時或週用量門檻保護已儲存的池帳號。Desktop／主帳號保留其獨立的 98% 硬鎖定。
在設定中設定 `codexPool.lowQuotaProtection` 以暫停帳號、記錄日誌與 API 警示，或兩者皆做；見[路由設定](/zh-tw/reference/configuration/routing/#codex-pool-低額度保護)。
暫停會立即對下一次選取生效，而寫入磁碟則會延後。池配額回應只有伴隨有效用量與仍然有效的擷取憑證時，才能授權暫停。
沒有該證明的回應可能會重新整理顯示的用量而不會暫停帳號。請檢查此伺服器經認證的 `GET /api/codex-auth/low-quota-events` 歷史紀錄，
以查看 `logged` 警示或儲存失敗。手動恢復在目前的配額事件期間維持有效。預設警示只會抵達日誌與 API。
加入 `actions.desktop: true` 也可以在執行代理的機器上顯示 macOS 或 Linux 通知；Windows 維持僅記錄日誌。

當 ChatGPT 的 5 小時配額耗盡時，Codex 可能會提供一個保留後備模型（`gpt-reserve` / Luna Reserve）。
在那個狀態生效期間，Codex 模型選擇器可能會讓**每一個其他項目都無法選取——包括 opencodex 路由過的
模型**，即使那些模型跑在獨立的供應商與憑證上，也完全不消耗那個已耗盡的配額。

**這是 Codex 客戶端自身的行為，proxy 無法改變它。** 保留狀態是從 ChatGPT backend、透過客戶端自己
已認證的連線抵達的，不經過 proxy。桌面應用程式會輪詢 `backend-api/wham/usage`，並在回應帶有
`rate_limit_upsell.banner_type = "luna_reserve"`、主要的 `rate_limit.allowed` 為 `false`，且
`additional_rate_limits[]` 中有一個 `limit_name = "gpt-reserve"` 且仍被允許的項目時，視為保留狀態
生效。只要這個狀態成立，app 就會把對話的模型設定強制改為 `gpt-reserve`，並把任何其他選擇都改回
它——選擇器被客戶端收攏到保留項目，`config.toml` 中的 `model =` 值也被同樣改寫。這一切都不會查詢
模型目錄，所以我們這邊沒有任何表示法參與這個決策。opencodex 沒有可以調整的保留概念，而另一個作法
——向你自己的客戶端謊報你自己的配額——會是比它想掩蓋的問題更糟的 bug。

**因應方式：** 模型本身仍然完全可用；被卡住的只有 Codex app 的模型選擇。請改用一個不會查詢 ChatGPT
用量快照的客戶端來使用它們：

- 透過 proxy 使用 Claude Code（`ocx claude`）。
- 任何對本機 `/v1` 端點發出請求的 HTTP 客戶端。
- 儀表板自己的請求路徑。

5 小時視窗重設後，正常的選擇器行為就會恢復。

**在該狀態生效期間，代理會如何回應。** 一旦應用程式將選擇器收攏，它便會送出 `gpt-reserve`，而沒有啟用
[免登入 Codex Desktop（選擇加入）](#免登入-codex-desktop選擇加入)時，opencodex 並沒有可隨之送出的 Reserve 權益。
過去該請求會被當作一般原生模型轉發，並從上游收到 `The usage limit has been reached`，既沒有指出真正的原因，
也沒有指出會改變它的設定。現在它會在本機以 HTTP 400 拒絕，說明 `codexDesktopAuthless` 已關閉，並給出將其開啟的指令
（`ocx system settings --desktop-authless on`）。不會有任何請求送往上游，也不會消耗任何配額。

這項拒絕刻意保持狹窄範圍。它只適用於原本會抵達標準 ChatGPT forward 路由的 loopback 准入請求上的 `gpt-reserve`。
由操作者建立別名或路由到另一個供應商上的 `gpt-reserve` 選擇器仍可正常運作，從非 loopback 監聽器准入的請求仍會轉發，
而以 `client` 執行期角色執行的代理也不受影響。啟用該選擇加入設定會恢復正常的 Reserve 路徑，而非這項拒絕。

## Subagent 選擇器

目錄同步會讓選定的 sub-agent 模型可供 Codex 使用；picker 排序請參見
[Codex App 模型選擇器](/zh-tw/guides/codex-app-models/#子代理選擇)，v1/base/v2 委派與 fallback
行為則參見 [Sub-agent Surface](/zh-tw/guides/sub-agent-surface/)。

## Codex 帳號預熱

新增或重新驗證 ChatGPT 帳號時，OpenCodex 通常會在儲存前對 Codex Responses 後端傳送小型串流請求進行驗證。它會等待 `response.completed`，預設使用 `gpt-5.6-luna`，HTTP 400 或 HTTP 404 時改用 `gpt-5.5` 重試。公開錯誤僅包含固定分類，不包含原始回應本文。

嘗試預熱時若收到 HTTP 429，會回報為 `codex_warmup_rate_limited`。請在暫時限制解除或用量上限重設後重試；重新登入不會重設這些上限。失敗的預熱嘗試不會新增帳號，也不會取代既有憑證。這與下方依配額確認的延後註冊不同——後者可在不送出模型請求的情況下儲存受限帳號。HTTP 401/403 失敗保留原有的認證指引。

若新 OAuth 憑證的已驗證用量查詢確認5小時、每週或每月額度耗盡，則不呼叫模型而直接儲存帳號，顯示**等待驗證**。即使重啟或重新整理權杖，它也無法處理池請求。額度恢復後，**Refresh quotas** 會完成驗證：帶有餘裕的新鮮完整用量讀數允許一次小型模型請求，且只有已完成的回應才會啟用該帳號。失敗或不完整的讀數以及失敗的驗證會保留該限制。被動帳號輪詢不會觸發延後驗證。首次註冊時用量未知仍保留一般預熱閘門。

`ocx account refresh openai` 和 `ocx account list openai --quota --refresh` 僅查詢用量。模型驗證會消耗配額，因此需要人類使用者的儀表板工作階段：配額恢復後，開啟 `ocx gui` 並點選 **Refresh quotas**。無介面主機也需要透過瀏覽器存取其儀表板；僅憑管理員權杖無法授權驗證。暫停的帳號可以完成驗證，但不會因此恢復或被選取。模型授權錯誤會持續顯示，直到驗證或重新登入成功。

在 **Codex Set → Multi-auth** 中，開啟 **Codex Auth** 標題列中的 **Codex credits** 開關，即可在 Week 下方顯示主帳號和各池帳號最近查詢到的點數。預設關閉，並儲存為 `showCodexCredits`。餘額按地區格式顯示；上游回報時會顯示無限額或超額使用上限警告。由於沒有點數總上限，長條表示可用狀態而非百分比。此開關僅控制顯示，新登入需等待其自身的查詢結果。

當帳號在某個用量視窗達到 100% 且仍持有點數時，上游仍會繼續服務它並扣除餘額。OpenCodex 預設不允許這種情況發生：當帳號的週或月視窗（30 天方案僅有月視窗）或 5 小時視窗已滿時，該帳號會被切換出去，直到該視窗重設後才再次使用。其他帳號的順序不會改變，且當沒有其他帳號可用時，選取會回報找不到帳號，而不會消耗點數。針對主帳號的請求會如同硬鎖定拒絕一樣被拒絕，直到重設為止。沒有重設時間的滿額 5 小時視窗只會在該讀數仍新鮮時保留該帳號。允許主帳號消耗點數不會解除其硬鎖定（預設在 98% 開啟），它仍會先擋下主帳號；若要讓主帳號消耗點數，請關閉該鎖定（100% 的鎖定仍會在 100% 時擋下它）。若要讓帳號繼續使用其點數運作，請開啟 Codex Auth 標題列中 **Codex credits** 開關旁的 **Use credits**。該開關會允許所有帳號。若要逐一選擇帳號，請開啟帳號卡片的 **⋯** 選單並使用其中的 **Use credits after limit**；當僅部分帳號開啟時，標題列開關會顯示中間狀態。被允許消費的帳號會在卡片上顯示 **Uses credits** 徽章。新帳號預設關閉。該選擇儲存在 `creditCodexAccountIds` 中，且絕不會兌換重設贈點；**Codex credits** 顯示開關只顯示餘額，絕不會改變路由。

對於已選擇加入、未暫停且內含用量視窗已滿的主帳號，背景復原週期會從年齡滿三分鐘起更新可花費點數的觀測，即使儀表板已關閉亦同。它會在進行已認證的用量查詢之前先準備有效權杖，使餘額能在五分鐘的新鮮度上限之前再度被觀測到。缺失、為零、受限或被撤回的點數，會讓帳號在既有的重試退避下保持符合復原查詢資格。請求會保持被拒絕，直到觀測到新鮮的正餘額或無限制點數；單靠 `has_credits` 或近似訊息計數並不能證明可花費餘額。在同意開啟的情況下，這種點數證據拒絕的 `Retry-After` 至多為五分鐘，或較早到來的內含配額重設時間；沒有同意時則仍依循內含配額重設時間。失敗或不完整的查詢不會刷新舊的餘額證據。獨立的主帳號硬鎖定、需重新認證隔離與上游重試延遲依然適用。這項中繼資料查詢不會送出模型驗證請求，也不會設定或清除帳號的需重新認證狀態。

對於已選擇加入且未暫停的主帳號，若其 5 小時或週視窗達到或超過預設門檻，背景復原會在冷卻後檢查用量；對於已啟用 **Use credits after limit** 的已儲存帳號，一旦內含用量視窗耗盡且點數觀測至少滿三分鐘，背景週期也會更新其點數證據。背景重新驗證是獨立功能，預設關閉。它需要 Token Guardian、`openai` 的 `proactive` 更新政策及 `tokenGuardian.codexWarmupEnabled`，並略過等待註冊驗證的帳號。

### ChatGPT 方案升級之後

變更 ChatGPT 方案後，請在 Codex Auth 中重新整理主帳號的配額。當已認證的用量回應確認長視窗已取代五小時視窗時，
opencodex 會同時從請求准入與帳號選取中移除舊的五小時讀數。帶有主要與次要視窗的允許回應可以省略選用的第三視窗。
這項復原使用你的方案內含額度，不需要啟用 **Use credits**。
部分或無效的用量資料會保留先前的封鎖，直到復原獲得確認。

已啟用 **Use credits after limit** 的儲存帳號，一旦內含用量視窗耗盡且點數觀測至少滿三分鐘，就會在既有的背景週期上更新其點數證據。
在 **Direct** 模式下，這也涵蓋明確綁定在 `codexAccountNamespaces` 中的已儲存帳號（例如子帳號選擇器）。你可以保留 Direct 模式並區分主／子身分；
這不會啟用 Pool 路由，也不會重新整理未綁定的帳號。已暫停與需要重新認證的帳號會被略過。中繼資料讀取不會驗證待處理帳號或送出模型請求。
失敗的讀取會保留退避，請求仍需要新鮮的可花費點數；一般回應的用量標頭不會更新點數餘額時間戳記。

### 取消主帳號裝置重新驗證

取消主帳號的裝置代碼重新驗證時，如果 DELETE 請求暫時失敗、發生網路錯誤，或回應狀態未知或尚未結束，系統會保留目前的流程和取消失敗提示，以便重試取消。通常狀態輪詢會繼續，因此仍能偵測到登入完成。如果流程處於 `pending` 或 `committing` 狀態時，可重試的取消失敗與 GET 狀態查詢的非 2xx HTTP 回應同時發生，無論回應抵達順序如何，系統都會保留或還原伺服器最後提供的裝置代碼、驗證 URL 和階段，讓同一流程仍可重試取消。GET 的 HTTP 失敗仍會停止輪詢，但無須傳送第二次登入 POST 即可重試取消。終止狀態為 `failed` 的回應會釋放流程並顯示正規化的失敗原因，只有 `succeeded` 才表示登入成功。確認狀態為 `cancelled` 的回應會釋放流程，以便開始新的裝置代碼登入。明確回傳 HTTP 404 且代碼為 `unknown_flow` 的回應也會釋放已過期的流程 ID，以便開始新的裝置代碼登入，但不會顯示登入成功或已確認取消。先前流程中延遲抵達的 POST、GET 或 DELETE 回應不能改變新流程，也不能將新流程回報為登入成功。

### 帳號停止處理請求的原因

帳號退出帳號池選擇時，原因會隨判定一起傳遞，而不是為了顯示重新計算，因此介面不會在路由已排除該帳號時仍顯示正常。`GET /api/codex-auth/accounts` 會在每個帳號的 `needsReauth` 旁回傳 `reauthReason`：從未儲存憑證為 `missing_credential`，更新持續失敗為 `refresh_failed`，用量查詢本身遭拒為 `quota_unauthorized`。

主帳號更新未完成時仍回傳帶 `Retry-After` 的 `503`，因為重試仍可能成功。訊息現在補充說明：若持續失敗，代表主帳號需要重新認證，而不只是再試一次。

### 請求擁有的對話親和性

`codexPool.requestOwnedAffinity` 是選用的布林值，預設為 `false`。設為 `true` 時，會讓帶有自己 ChatGPT bearer 的對話，
在每個配額範圍內固定使用一個符合資格的帳號。釋放與模型繞道仍可能讓它移動。這個綁定僅存在於處理程序內；
重新啟動代理或輪替 bearer 會開始新的綁定。沒有工作階段、多代的子代理鏈，可能會依執行緒個別綁定。

親和性標籤描述選擇回傳時的綁定。`unbound` 表示沒有儲存任何綁定；`request_owned` 表示呼叫端擁有的憑證沒有選用，
`no_conversation` 表示沒有可用的對話鍵。之後資格的變化，可能在選擇之後釋放綁定。

無論有沒有這個選項，帶有自己 bearer 的請求，都會在以該 bearer 為範圍的鍵底下記錄每個回合由哪個帳號服務。
當之後的回合由不同的帳號服務時（包含你手動切換帳號之後），OpenCodex 會在送出之前移除 `previous_response_id`，
並以 HTTP 400 拒絕攜帶的已上傳 `file_id` 參照，因為新帳號無法讀取它們。

### 選用的閒置視窗導向

`codexPool.startIdleWindows` 是選用的布林值，預設為 `false`。啟用時，新的、未綁定的真實請求，可能被放到一個符合資格的帳號上，該帳號觀察到的短額度視窗為 0%，且有證據顯示它的五小時計時尚未開始。這項檢查在對話與家族親和性之後執行，所以既有的綁定仍具權威性；明確的帳號 pin 或手動的帳號偏好也優先。獨立的模型額度範圍會被略過，共享的作用中游標不變。閒置視窗的選擇之後，其他對話恢復一般的策略選擇。

觀測不得超過五分鐘，且短視窗必須明確為 18,000 秒。它的重設必須在 `observation + 5h` 的 60 秒內被觀測到（而不是已在計時或已過期的重設）。同步的、程序本機的保留，會防止同一個帳號與視窗被重複選擇。保留的期限至少是選擇之後的 5 小時加一分鐘；在那個期限之後，同一個帳號要再被導向之前，需要一次新的觀測。保留會在 proxy 程序重新啟動時清除，絕不會持久化到磁碟。

在你既有的設定中啟用它：

```json
{
  "codexPool": { "startIdleWindows": true }
}
```

如果沒有帳號符合條件，就套用一般的路由。這個功能只導向實際進來的請求。它不建立合成請求，也不建立計時器。

### 讓降級的帳號退出輪換

`codexPool.excludedPlans` 列出自動帳號池選擇要略過的方案鍵，與每個帳號上儲存的方案不分大小寫比對。預設不存在，因此既有安裝的輪換完全不變。

```bash
ocx config set codexPool '{"excludedPlans":["free"]}'
```

這是選擇策略，不是封鎖。被排除的帳號保留憑證、用量紀錄與執行緒親和性，仍顯示在帳號清單中，也仍可透過 `work/gpt-5.5` 這類明確選擇使用。改變的只是自動輪換不再挑它，包括它已經是使用中帳號或已綁定執行緒的情況——訂閱到期後留下的正是這種狀態。

主 Codex 帳號不受方案排除策略影響；僅選擇模式不會讀取受保護的原生憑證。如果所有可用的池帳號都被排除，自動選取不會回傳帳號。明確指定帳號的路由仍可使用，並繼續檢查暫停、認證及模型權限。帳號卡片與 CLI 將被排除的路由方案與憑證健康狀態分開顯示。方案沒有全序關係，因此不提供 `minimumPlan` 設定。

## 恢復原生 Codex

`ocx stop` 會停止 proxy 與任何已安裝的背景服務，然後嘗試恢復原生 Codex。OpenCodex 只會移除已驗證
歸屬的路由產物，並在無法安全復原設定檔時，回報恢復未完成。

當日誌無法驗證目前的檔案時，復原可能需要人工檢視；見「沒有注入雜湊時的復原」一節。

```bash
ocx stop       # stop the proxy + service, restore native Codex
ocx restore    # restore without stopping  (alias: ocx eject)
ocx restore back # point plain Codex at the running proxy again
```

當 opencodex 作為受管的 [背景服務](/zh-tw/reference/cli/lifecycle/#ocx-service-installrepairrestartstartstopstatusuninstallremove) 執行時，會設定 `OCX_SERVICE=1`，
因此 service 驅動的 restart **不會**反覆改寫 Codex 設定；只有明確執行 `ocx stop` 或
`ocx service stop` 才會恢復原生 Codex。

### 沒有注入雜湊時的復原

日誌會儲存原始的 `config.toml` 與 `opencodex.config.toml`，以及 OpenCodex 注入之狀態的雜湊值。
一份舊版日誌，或在雜湊被記錄之前就發生的中斷，都無法證明之後的檔案內容確實屬於 OpenCodex。若任一
個檔案與它儲存的原始版本不同，且缺少自己的已注入狀態雜湊，自動日誌復原與原生恢復會回報失敗，且
不會更動任一個檔案或日誌。已儲存的原始版本仍可用於比對；在選擇手動復原動作之前，請將它與目前的
檔案一併檢視。

已經與其儲存原始版本相同的檔案，會被接受而不重新寫入。缺少檔案與空檔案是不同的狀態。已驗證的
注入雜湊仍允許正常的快照復原，帶雜湊備份設定中之後的編輯，也會保留既有的「歸屬欄位」清理行為。

同步與 `ocx restore back` 也會拒絕一個既有的路由設定，只要它的無雜湊日誌與注入前的基準不相符。
這可避免把一個新的注入雜湊，附加到一個較舊的原始版本上。一個真正原生的設定，可以在注入前被儲存
為一份全新的基準。明確的外部供應商選擇退出行為不變。

### 子代理後備與 V2 相容性

在 **Subagents → Delegation settings** 中，編輯有序的後備鏈與它的可用性輪詢間隔
（5000–600000 毫秒），然後把它與精選名單分開儲存。一個已設定但不再被廣告的目標，會一直留在鏈中
直到你移除它。名單與後備鏈是各自獨立的設定；這個編輯器不會讓名單取代後備政策。

當一個路由的偏好模型可能會從一個原生 ChatGPT 父層收到 V2 工作時，面板會說明上游加密任務的限制。
來自路由父層的可讀任務不受影響。這份指引使用 `/api/v2` 模式與原生 V1 釘選狀態；目前的 API 不會
公開復原啟用狀態或個別請求的資格，所以面板會把它們回報為未知。V1／明文相容的委派仍是一個替代方案。
實驗性的 V2 復原——在合格且明確啟用時——會增加配額用量、延遲、對 backend 的依賴，以及可能的保真度
損失；它不會修復上游協定本身。見[子代理介面](/zh-tw/guides/sub-agent-surface/)與
[上游的限制](https://github.com/lidge-jun/opencodex/issues/92)。

## 分頁歷史記錄安全拒絕

如果受影響的歷史儲存區支援分頁，提供者切換可能傳回 `history_paginated_requires_native_writer`。此原因不再拒絕寫入 Codex 設定、參考設定檔與模型目錄。`ocx sync` 與 `ocx start` 仍會寫入這些檔案並設定 `model_catalog_json`，因此 Codex 模型選擇器會繼續顯示所有經 OpenCodex 路由的模型。只有這一條原因會讓對話歷史的重新標記停手，因為分頁歷史序號由 Codex 自己的寫入器分配，重試也不會改變。無法讀取的狀態資料庫、身分已變的歷史檔案、未能執行的預檢等其他歷史預檢原因仍會拒絕整個切換並回復，因為那些情況以後可能成功。在此狀態下，OpenCodex 不會修改分頁歷史檔案或執行緒列。既有對話保留已標記的提供者，不會被遷移；新對話仍正常經代理路由。重新標記停手時，家目錄裡既有的 `[model_providers.opencodex]` 表會保留而不是撤下，即便是 root-override（loopback）形式也一樣，這樣列上標記為 `opencodex` 的對話仍能對應到還存在的提供者 id。可遷移儲存區中的 legacy 記錄也適用。CLI 會印出 `Codex resume history: left to Codex's native writer (history_paginated_requires_native_writer)`。

返回根 URL 覆寫模式時，即使歷史預檢通過，OpenCodex 也會在提交設定前保留既有的 `[model_providers.opencodex]` 定義。如此一來，即使 Codex 在提交後或背景歷史工作啟動時遷移歷史格式，舊的 `opencodex` 對話仍能找到其提供者。新對話繼續使用所選的根提供者；明確要求的還原仍執行原有的獨立刪除檢查。

`ocx restore`、`ocx stop` 與 `ocx uninstall` 不再因 `history_paginated_requires_native_writer` 被拒絕。它們會移除 OpenCodex 寫入的所有根路由鍵，並把 `[model_providers.opencodex]` 定義留在磁碟上，因此列上仍指向該提供者的對話依舊可以解析，而純 `codex` 不再指向代理。結果會回報為部分復原並列出保留的列；`ocx restore --remove-codex-provider-table` 會連這些列一併刪除，之後那些對話將無法開啟。

另外，在 Codex 已把 `openai` 標記對話遷移為分頁歷史的家目錄上啟用提供者表形式的整合，過去會以 `history_paginated_openai_requires_native_writer` 整體拒絕：什麼都不寫，整合維持關閉。現在 OpenCodex 會保留受管的根 `openai_base_url` 覆寫，與 `[model_providers.opencodex]` 表並存，藉此完成這次切換。Codex 會把該覆寫合併到內建 `openai` 提供者上，所以那些對話無需重新標記即可繼續抵達代理，歷史檔案與執行緒列都不會被更動。只有需要 `x-opencodex-api-key` 准入標頭的路由形式仍會拒絕，因為 Codex 內建提供者無法攜帶該標頭；此時訊息會點名兩個可行設定——讓 Codex 走回送監聽器以便保留該覆寫，或把 `syncResumeHistory` 設為 `false`，接受那些對話轉向 Codex 自己的 OpenAI 端點。

Codex 0.166 及更新版本只會在建立對話時所使用的供應商底下恢復或列出該對話（`This chat uses openai, but your current provider is opencodex`），因此一旦預設供應商變更，保留下來的覆寫便不再能讓那些對話維持可及。當 OpenCodex 知道所選的 Codex 為 0.166 或更新版本（透過執行期檢查或已儲存的選取）並發現此類對話時，它會以 `history_paginated_openai_provider_locked` 拒絕提供者表切換且不寫入任何內容。訊息會指名解決方式：將 `codexDesktopAuthless` 與 `codexClientCompaction` 維持關閉以保持這些對話可恢復，或將 `syncResumeHistory` 設為 `false` 以無論如何仍進行切換並接受它們留在 `openai` 供應商上。OpenCodex 不會替它們重新貼標籤。當 Codex 版本未知時，切換仍依先前做法保留覆寫。

### 遠端對話串列表的供應商過濾

Provider-table 路由會把新對話的預設供應商 id 改為 `opencodex`，而無法安全改標籤的歷史可能仍標記為 `openai`。有些原生 app-server／行動版本會把省略的 `thread/list.modelProviders` 過濾，當成只有目前的預設供應商，所以這些既有的對話可能從該遠端列表中消失，即使它們的資料庫列與 rollout 完好無缺。相容的列表用戶端可以送出 `modelProviders: []` 來要求所有供應商。OpenCodex 無法改寫那個 RPC，因為遠端用戶端是直接與 Codex 原生的 app-server 溝通，而不是推論 proxy。

`ocx sync` 與 `ocx start` 在套用 provider-table 路由時會包含這項警告。如果使用者自有的根 URL 讓指令走進不路由的分支，CLI 會省略警告。在用戶端壓縮模式下，CLI 可以保留該 URL、套用 `opencodex` provider table，並包含警告。當任一設定啟用時，儀表板會顯示另一個偏好提示。如果兩個設定都啟用，不論根 URL 為何，它只出現一次。該提示回報的是已啟用的偏好；並不代表 Authless Desktop 在目前的路由上有效。Authless Desktop 只適用於有效的 loopback authless 路由，對遠端用戶端路由或需要准入標頭的 listener 會被忽略。這項警告不是遷移：OpenCodex 不會只為了影響用戶端的列表過濾而編輯供應商標籤。請在原生 Codex 與 app-server／用戶端版本中驗證該對話；不要為了讓遠端列表包含它而改寫分頁歷史。

不要自行改寫進行中的分頁 rollout 或對話串列來遷移那些對話。任何復原之前，請先關閉受影響的對話，並在不上傳私人歷史的情況下，回報確切的錯誤與版本。單靠備份或成功的腳本，並不能證明對話再次可見。重新開啟後，請在 Codex 中檢查已還原的對話。

## 實驗性原生對話中途 steering

若使用規範 ChatGPT forward 路由上相容的模型，且客戶端會送出 `response.steer`，
請在 `~/.opencodex/config.json` 中啟用這兩個選項並重啟 OpenCodex，再開始一輪新對話：

```json
{
  "websockets": true,
  "codexNativeSteering": true
}
```

把這些鍵合併進既有設定；不要取代你的供應商／帳號設定。此選項預設關閉。它會把 steering
轉發到同一個明確設定的原生 WebSocket 連線與已選帳號，保留自動的後續回應與待處理的已儲存
工具結果續傳。接受代表已排入佇列，不代表已套用。

必需的工具結果或核准決定，請在同一條線路上、**每個父層一次**提供。結果可以在
`response.steer.pending` 之前送達：relay 也會比對已完成父層宣告的呼叫與核准。待處理的
function-output stub 上的 `name`，在結果中是選填的，與原生 schema 相同。這些結果可以附帶
額外的使用者訊息；system/developer 訊息、重複結果與不相關的 call ID 會被拒絕。請不要重跑
工具或重送已接受的 steering 文字。模型、帳號、工具宣告與路由維持不變。已驗證的生成設定可能
在下方描述的明確已儲存結果續傳中變更。其他變更需要一輪明確結束或完成的對話，並走一般的
新派送。多個獨立對話使用獨立連線。

HTTP 後備、非規範 gateway、公開 API-key 路由、轉換過的模型、sidecar、Combo 嘗試與明文 V2
還原都不支援此選項。它不會為缺少該能力的模型或客戶端新增 steering 能力。不支援的路由會
回傳協定錯誤，而不是悄悄忽略輸入。連線中斷或逾時的傳遞可能是未知狀態：永不自動重送工具或
steering 文字。待處理控制項每次送出都有固定 90 秒的確認期限；已儲存工具結果的等待上限為
30 分鐘。

此實作有合成的協定與回歸測試覆蓋，但沒有實際的 Astra／客戶端認證。在你的客戶端／模型路徑
經過驗證之前，正式環境請維持此選項關閉。將 `codexNativeSteering` 設為 `false` 並重啟，即可
還原既有的單一回應 relay；不需要刪除任何帳號或對話檔案。

### Steering 確認期限與保留的 context

每個送出的 steer 有固定 90 秒的確認視窗。其他輸出與額外的 steer 不會延長它。一旦被接受，
輸入會在目前回應到達安全邊界前保持排隊；一般的串流閒置檢查仍會套用。回應結束後，後續回應
必須在 90 秒內開始。要求工具結果或核准會從第一次那樣的通知起算，給 30 分鐘。重複的通知不會
更新這個等待。送出已儲存的結果會啟動一個新的 90 秒後續視窗，包括本機的節流／認證檢查。缺失
的確認仍受其各自較早的期限限制。

該連線本身沒有絕對的存活上限。最多 128 個回應可以共用它，且每一個都可能合法地消耗自己的
確認、後續、串流閒置與必要輸入等待，因此上述各階段的期限組合起來，最糟情況可達數十小時的
量級。在此期間，這一輪會持有一個實體 socket 與一個無法輪換的 pin 憑證，因為此通道刻意
永不重新進入帳號選擇。請把已啟用的 steering 連線視為長生命週期的 session 資源，而不是一般
的有界請求。

Steering frame 也共用代理設定的主體與記憶體限制。已建立的控制連線上，超過
[`maxInboundBodyBytes`](/zh-tw/reference/inbound-body-admission/) 的控制 frame 會在解析前
就被拒絕（初始 frame 仍會先被解析，才套用依類型而定的限制），而重建後送往上游的主體，
若超過 [`maxUpstreamBodyBytes`](/zh-tw/reference/configuration/providers/) 也會被拒絕。
每條連線的重播日誌上限為 32 MiB，並計入
[`appOwnedMemoryBudgetMb`](/zh-tw/reference/configuration/server/) 的 pin 狀態；接受一個
日誌會先降級可驅逐的快取，而不是直接失敗，所有存活日誌的合計上限為 128 MiB，不論設定的
預算為何。

逾時代表**傳遞狀態未知**，不代表伺服器拒絕了輸入。請不要自動重送已接受的指示或自動重跑
工具。請先檢視實際的任務狀態，再決定如何恢復。不會執行帳號切換或付費 API 後備。已經在
線路上收到的完成輸出，即使終端摘要省略了它，仍會保留在本機續傳歷史中。衝突的項目內容或
順序會導致明確的失敗，而不是靜默的 context 遺失。

若要做實際比對，請在隔離的測試對話中，對同一個受支援的客戶端版本、模型與帳號分別跑一次
不經代理、一次經代理啟用。使用一個唯讀任務，在輸出進行中時 steer，並比較接受情況與後續
回應對指示的實際遵循程度。在合成工具結果或核准待處理時，以及明確中斷連線之後，重複這個
測試。只記錄事件類型、相對時間與已遮罩的結果，不要記錄憑證或任務內容。通過模擬傳輸測試
不代表建立了實際客戶端／後端支援；這些指示也不代表暗示了任何真實帳號的煙霧測試。

## 實驗性原生 function-result 注入

若使用會送出 OpenAI multi-agent `response.inject` 訊息的相容客戶端，請把這些鍵合併進既有
的 OpenCodex 設定並在開始新一輪對話前重啟。不要取代你的供應商或帳號設定：

```json
{
  "websockets": true,
  "codexNativeInjection": true
}
```

初始的 `response.create` 必須明確包含 `"multi_agent": { "enabled": true }`。OpenCodex
不會依模型名稱自行啟用它。公開的 OpenAI API 供應商必須使用 `adapter: "openai-responses"`、
`baseUrl: "https://api.openai.com/v1"`、其一般的 API-key 認證，以及 `upstreamWebsocket: true`。
請透過該供應商設定的前綴路由初始模型。relay 只會在該公開 API 連線上加入必需的
`responses_multi_agent=v1` beta token，並保留其他已設定的 beta token。它不會替換訂閱憑證、
建立 API 帳號，或自動切換到另外計費的 API。

規範的 ChatGPT forward 連線也可以實驗性選擇加入同一種傳輸，但公開 API 合約**並不**代表建立
ChatGPT 訂閱或 Codex App/CLI 支援。仍需要相容的上游模型與執行模式。請見
[OpenAI multi-agent 協定](https://developers.openai.com/api/docs/guides/responses-multi-agent)。

在相符的 developer function call 完成之後，回傳一個已儲存的工具結果：

```json
{
  "type": "response.inject",
  "response_id": "resp_example",
  "input": [
    { "type": "function_call_output", "call_id": "call_example", "output": "saved result" }
  ]
}
```

請使用**同一條連線**的 response/call ID，而不是這裡的範例 ID。`response.inject` 只接受
字串值的 `function_call_output`。使用者／系統訊息、豐富的輸出陣列、託管工具結果，以及同時
存在的 `response.steer`，都不被這個操作接受。下方更廣義的已儲存結果續傳，是另一個獨立的
`response.create` 操作，不是被拒絕注入的隱藏轉換。多個已儲存的 function 結果可以共用一次
注入。每個呼叫只能送出一次，包括排隊期間也是。

平行的工具結果會排隊、逐一 frame 送出，因為成功事件辨識的是回應本身，而不是個別的注入。
relay 會保留 `response.inject.created` 與 `response.inject.failed`。在回應終止之後，只要
已送出的結果仍在等待確認，或宣告的呼叫仍在等待結果，它就會維持連線存活，因此延遲抵達的
非同步結果不會被丟棄。

當伺服器以 `response_already_completed` 拒絕一次注入時，請用它回傳的已儲存輸出，在**單一
由客戶端送出**的 `response.create` 中，搭配已完成的 `previous_response_id`、不變的
模型／設定與同一條線路。每個未完成的結果只包含一次；不要包含已被接受的輸出。relay 會讓
這次續傳留在原始帳號／socket 上，並保留一般的請求節流。它絕不會自己重跑工具或建立復原
請求。其他失敗仍會照常顯示給客戶端處理。

缺失的確認或連線中斷，代表傳遞狀態可能是**未知**。請不要自動重送結果、重啟工具，或換帳號
重試。待處理佇列上限為 32 個 frame 與 8 MiB，宣告的 function call 上限為 1,024 個，重播
日誌上限 32 MiB，每條已擁有的連線最多 128 個回應。注入日誌與 steering 日誌共用 pin 記憶體
預算與 128 MiB 的合計上限；見[steering 記憶體限制](#steering-確認期限與保留的-context)。
設定的上游主體限制，會在結果進入佇列前就檢查，即使另一個結果仍在等待確認也一樣。
`outbound_body_too_large` 拒絕會讓連線保持可用，可送出修正後的結果而不必重跑其工具。每個
送出的注入有 90 秒的確認期限，不相關的輸出無法延長它；已儲存結果的等待上限為 30 分鐘。
既有的 frame 限制與停滯逾時仍然適用。

轉換過的供應商、自訂 gateway、Combo/sidecar 路徑與 HTTP 後備都不會獲得注入支援。不支援的
嘗試會回傳明確的錯誤，而不是憑空消失。此選項預設關閉；合成的傳輸測試不是實際相容性認證。
將 `codexNativeInjection` 設為 `false` 並重啟即可回退。不需要移除任何帳號或對話檔案。

### 回應完成後的豐富工具結果與明確核准

啟用 `codexNativeInjection` 後，同一條已擁有連線上由客戶端送出的 `response.create`，現在
可以在 `response.completed` 之後回傳含有文字、圖片或檔案部分的**未送出**
function／custom 結果。請提供已完成回應的 `previous_response_id`、同一條線路，以及不變的
模型／設定。每個未完成的結果或被要求的核准只包含一次；已被接受的注入結果請省略。代理會用
原始帳號與 socket，搭配既有的派送檢查，轉發這次由呼叫端送出的續傳。

支援的續傳項目為 `function_call_output`、`custom_tool_call_output` 與
`mcp_approval_response`。工具輸出可以是字串，或 `input_text`、`input_image` 與
`input_file` 部分組成的陣列。圖片部分需要 `detail`（`auto`、`low`、`high` 或
`original`）；檔案的 detail 為選填（`auto`、`low`、`high`）。請只使用一種圖片／檔案來源。
內嵌檔案資料需要檔名。選填的 `prompt_cache_breakpoint: { "mode": "explicit" }` 會被保留。
不支援的欄位會被拒絕，而不是被移除。代理不會下載或重新上傳這些參照。每個結果最多 1,024
個內容部分，仍受既有的 8 MiB 請求上限限制。提供的程式呼叫端必須與宣告的呼叫相符；它不能
冒充另一個工具或代理。內容順序、檔案參照與原始拼寫都會保留。

對於伺服器發出的 `mcp_approval_request`，請傳入其 ID 作為 `approval_request_id`，並明確
給出 `approve: true` 或 `approve: false`。拒絕會被原樣轉發。代理不會自行決定、給預設值、
自動核准或執行被請求的工具。缺失或不相關的決定會被拒絕。託管的 `multi_agent_call` 動作與
其他伺服器端執行的工具，**不是** developer function：它們的事件、輸出與加密代理訊息會被
保留，OpenCodex 絕不會執行或注入它們。

這不會啟用豐富／自訂／核准的**回應中途注入**，也不會啟用對 multi-agent 回應同時 steering。
那些操作有不同的上游合約。不支援的注入會在保留該呼叫之前就被拒絕，因此未送出的結果仍可用於
之後的明確續傳。沒有自動轉換、重試、重跑工具或帳號／API 切換。單代理的 steering 對話可以
在一輪已完成的 multi-agent 對話之後，以一般路由發出一個新的明確請求接續。客戶端支援與後端
權益仍需要實際驗證。

## Steering 續傳設定

明確的已儲存結果 `response.create` 可以覆寫 `reasoning`（effort 與摘要）、`text`
（verbosity 與支援的結構化輸出格式）與 `stream_options`。訂閱路由會拒絕
`max_output_tokens` 覆寫，而不是靜默忽略它。一般的供應商 pin、子代理上限、effort 對映
與摘要／verbosity 能力排除規則仍然適用。

省略的設定會保留目前有效的值；明確的 null 會在上游接受 null 的情況下重設該設定。覆寫會
取代整個設定物件，不是個別的巢狀欄位。變更後的值會延續到之後的明確續傳。被拒絕的覆寫不會
保留那個已儲存的結果，因此可以送出修正後的請求而不必重跑其工具。伺服器仍會決定所選模型
接受哪些設定。模型、帳號、供應商、工具、指示或 service tier 的變更，需要另一輪一般對話。

原生 steering 僅限於規範的 ChatGPT 訂閱路由。公開的 API-key 與 gateway 路由不可 steer；
它們的一般回應會被保留，steering 嘗試會收到說明性的錯誤。這可防止在保留的 socket 上的
後續生成繞過一般的逐請求准入。另外受控管的公開 API multi-agent 注入路徑仍可使用。

### 可執行的直連對比代理線路探測

從原始碼 checkout 執行離線正向控制測試：

```sh
bun scripts/steering-smoke.ts --self-test
```

規劃一次比對，不讀取任何 token 也不開啟任何連線：

```sh
bun scripts/steering-smoke.ts --direct wss://api.openai.com/v1/responses \
  --proxy ws://127.0.0.1:1455/v1/responses --model <supported-model> \
  --proxy-model <provider-prefix/same-model>
```

若要比對訂閱路線，直連 URL 是 `wss://chatgpt.com/backend-api/codex/responses`。兩條路線
請選同一個實際模型與帳號；此腳本無法證明代理設定選到了相同帳號。代理 URL 必須是 loopback
的 Responses 端點，且不能包含憑證、查詢字串或 fragment。

**只有在檢視過計畫之後**，才透過你的 shell 環境提供 `STEERING_DIRECT_TOKEN` 與
`STEERING_PROXY_TOKEN`，並同時加上 `--live` 與 `--allow-model-requests`。直連 ChatGPT
可能還需要 `STEERING_DIRECT_ACCOUNT_ID`；該標頭絕不會被複製到公開 API 或代理。請不要把
憑證放進指令引數、日誌、截圖或 PR。此腳本不會讀取你已儲存的 Codex 登入、refresh token，
也不會變更設定。

實際執行會送出四個合成的初始請求（每條路線兩個情境），加上任何後續的回應或必要結果續傳，
**可能消耗模型用量**。一個情境檢查自動後續回應；另一個只為腳本自己宣告的 function 回傳
一個固定的合成結果，並在其明確續傳上變更 reasoning/verbosity。不會執行任何外部工具，也不會
推斷任何核准。沒有重試或自動復原請求。每個情境限制在 120 秒、5,000 個事件與 2 MiB 接收
資料以內。

JSON 報告只包含結果、時間與布林檢查點。通過需要排隊接受、建立後續回應，以及在其已完成
輸出中出現合成標記。缺失的確認為 `unknown`；若模型從未進入必要輸入路徑，結果為
`not_exercised`。兩者都不算通過。行程只有在全部四個實際情境都通過時才 exit 0，否則
exit 1，而無效引數或缺少憑證則 exit 2。這是一個**線路診斷**，不是端對端的 Codex App/CLI
介面測試、實際認證，或指示在正式環境啟用此實驗性功能。

## 串流換行符號

共用的 SSE 解碼器接受 LF、CRLF 與單獨的 CR 換行符號，即使分隔符跨越網路 chunk 也一樣。這讓相容的供應商可以串流事件，而不需要只用 LF 的分框。

### 帳號限定請求與點數

選用帳號限定模型並不會啟用點數消費。已儲存帳號在認證、準備憑證期間，以及在節流或重試等待之後進行 Responses HTTP 或 WebSocket 派送之前，
皆遵守 **Use credits after limit**。被保留的請求會回報點數政策，而非認證失敗；請等待重設、選擇另一個帳號，或明確啟用該帳號的點數消費。

已儲存帳號的視覺與網頁搜尋輔助工具在送出前（含重試）也會重新檢查此政策。若同意狀態變更或在選取輔助工具後達到上限，
輔助工具會回報政策拒絕而不送出該次嘗試。獨立的搜尋中繼會回傳受重設時間限制的 429。呼叫端自有的 Direct 憑證保留既有行為。

## 將自訂供應商選擇加入受管本機路由

例如 `chatgpt-http` 的自訂供應商可以使用 `supports_websockets = false` 來維持 HTTP 傳輸。
OpenCodex 預設不會更動自訂供應商。若只要將該供應商的 URL 委派給 OpenCodex，請執行：

```sh
ocx codex-provider allow chatgpt-http
ocx start
```

第一個指令會說明範圍並要求確認，預設為 No。對於已明確核准的腳本化操作，請使用 `allow chatgpt-http --yes`。
同意適用於所選 `CODEX_HOME` 中的該供應商 ID；它不會核准其他供應商或其他家目錄。
啟動與同步只會將其 `base_url` 更新為本機代理。其身分、WebSocket 設定、其他 TOML 欄位與歷史紀錄皆維持不變。
使用此路由時請讓代理保持執行。將 Codex 整合關閉也會阻止在啟動或同步時更新已核准供應商的 URL；
當你重新開啟它時，已儲存的供應商同意仍維持可用。

此模式支援帶有 `requires_openai_auth = true` 且無自訂憑證或標頭的明確 Responses 供應商資料表。
非 loopback 目標、免登入 Desktop 模式與用戶端側壓縮則需改用既有的專用整合。

`ocx stop` 與 `ocx restore` 會還原已記錄的 URL，同時保留同意以供之後啟動使用。執行 `ocx codex-provider status`
可列出已核准項目，或執行 `ocx codex-provider revoke chatgpt-http` 還原其受管 URL 並移除同意。
在 OpenCodex 之外變更過的 URL 會被保留，且需要撤銷後再重新核准；OpenCodex 不會靜默將替換後的值採納為新基準。
原始 URL 指派會保留在 `OPENCODEX_HOME` 下的私有復原中繼資料中，與原生設定日誌分開。

啟動安全檢查會將已核准供應商已記錄的受管 URL 辨識為 OpenCodex 路由。這不會安裝重啟保護：
手動啟動的代理仍需要可用的背景服務，才能在重啟後自動恢復。

## 原生 Desktop 中繼 CONNECT 驗證

Desktop 中繼既有的 HTTP/HTTPS CONNECT 傳輸現在會拒絕格式錯誤的代理回應標頭，以及包含冒號的模糊 HTTP Basic 使用者名稱。
解碼後的憑證配對上限為 4096 UTF-8 位元組。若你選用的代理被拒絕，請修正其設定或回應；中繼不會靜默切換為直接連線。

代理選取、SOCKS5/SOCKS5h 支援、憑證驗證與連線生命週期維持不變。兩種 SOCKS 拼法皆保留遠端目標 DNS 解析。
