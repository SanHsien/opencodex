---
title: Codex 整合
description: opencodex 如何將自身注入 Codex、同步模型目錄、安裝 shim，並乾淨地恢復。
---

opencodex 透過修改 Codex 會讀取的兩項內容，讓 Codex 經由 proxy 路由：其設定
（`$CODEX_HOME/config.toml`，預設為 `~/.codex/config.toml`）與模型目錄。每項修改都是冪等且可逆的。

**Integrations** 總覽頁有一個 Codex 開關，對應這項原生整合。開關顯示的是 OpenCodex 設定中的期望
狀態，徽章則回報目前觀察到 Codex 是否確實在使用 proxy；在清理過程中，兩者可能短暫不一致，徽章會
持續回報觀察到的狀態。停用時會指名生效中的 Codex 設定檔、移除 OpenCodex 產生的路由產物，並讓
proxy 繼續為其他用戶端執行。重新啟用會依當下可用的模型重建目錄，因此不會逐位元組還原 Codex
檔案。

proxy 提供一條裸 `openai` Codex 登入路徑，可使用 Pool（預設）與 Direct 帳號模式，另提供
`openai-apikey/<model>` 給已設定的 API 金鑰。Pool 包含主帳號與新增帳號；Direct 只使用 caller／主登入
bearer。這些路徑不會彼此 fallback。shipped v1 設定會遷移到 marker 2，並保留
`config.json.pre-openai-tiers-v2.bak` 供手動恢復。

在 Pool 模式下，當已選定的儲存帳號正在冷卻、且沒有合格的儲存替代帳號或復原探測可用時，帶有已驗證
原生 Codex 登入的請求可以使用那個登入。這也涵蓋在送出前就被擋下的新請求，遵循與上游拒絕之後相同
的呼叫端驗證。既有的模型權限與主帳號政策檢查仍然適用。這個後備會保留儲存帳號的冷卻狀態，且不會
把呼叫端憑證持久化為 Pool 選擇。一個精確的帳號綁定仍會保持綁定在那個帳號上。

## 設定注入

`ocx init`、`ocx start` 與 `ocx sync` 都會呼叫注入器。在預設 loopback 繫結下，它會保留 Codex
內建的 `openai` provider id，並將該 provider 指向 opencodex：

```toml
# root keys, before the first table
model_catalog_json = "/absolute/path/to/opencodex-catalog.json"
# Auto-injected by opencodex
openai_base_url = "http://127.0.0.1:10100/v1"
# Auto-injected by opencodex
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
session／執行緒組合所綁定的帳號（一個行程本地的綁定）。在 Direct 模式下，兩端本來就已經使用呼叫端
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

proxy 預設監聽 `10100` 埠，提供 `POST /v1/responses`、`POST /v1/responses/compact`、
`POST /v1/images/generations`、`POST /v1/images/edits`、`GET /v1/models`、`GET /healthz`
以及 `/api/*` 管理介面。

### 實驗性 context 管理（Codex 0.153+）

對合格的 ChatGPT 帳號，請在 Codex 自己的 `config.toml` 中啟用這項實驗性功能（合併進既有的
`[features]` table）：

```toml
[features]
context_management.experimental_mode = true
```

在預設的內建 loopback 整合下，下一次 `ocx sync` 或 proxy 啟動會把受管的根層級 `openai_base_url`
改成 `http://127.0.0.1:10100/backend-api/codex`。Codex 會在啟用它的 `new_context`、歷史與筆記
工具之前檢查這個 backend 路徑。同步後請開始一個新的 Codex session。這項功能仍是選擇加入；使用者
自有的 base URL 與遠端自訂供應商注入不會被重寫。不需要也不會新增任何 context-window 或壓縮上限
覆寫。

這個 backend 前綴是既有資料平面路由的別名，包括 Responses WebSocket 升級。原本的 `/v1` 路由與
即時旁帶覆寫仍然可用。proxy 也會透過內建的 `openai` 供應商，以 `openai-responses` adapter 與規範
ChatGPT forward 目的地，轉送十個原生的 `alpha/history/v2/*` 與 `alpha/notes/v2/*` POST 端點。
Direct 使用目前呼叫者／main 登入；Pool 選擇一個 Codex 帳號。`openai-apikey` 使用它設定的 API
金鑰，自訂或非規範的 Responses 供應商不是這個 context relay 的候選者，也不會從它那裡取得任何
Codex 帳號憑證。其他模型供應商或 OpenAI API-key 路由都沒有實作這些私有端點。

呼叫端標頭限制在共用的 Codex forward 允許清單內：`authorization`、`chatgpt-account-id`，以及核准
的 OpenAI beta、originator、session 與 Codex 協定中繼資料。context relay 另外會轉送
`x-openai-encrypted-tool-arguments` 與 `x-openai-tool-output-truncation-policy`；任意的呼叫端
標頭（例如 cookie）不會被轉送。以 bearer 呈現的 proxy 資料平面金鑰會被替換成選定的 Codex 憑證
（Direct 模式下是已儲存的 main 登入）；缺少憑證會在轉送前就失敗。proxy 准入憑證絕不會送到上游。
加密的引數、回應主體與上游錯誤狀態都會被保留。

一次成功的 ChatGPT 模型回應，會把根 session 實際服務的帳號記錄在一個有界、行程本地的所有權登錄檔
中。歷史與筆記使用那個記錄下來的擁有者，包括一個明確選擇的帳號，即使目前的現用帳號改變也一樣。
儲存帳號的 token 重新整理可以繼續套用在同一個實體帳號上；被替換的帳號身分會被拒絕。Direct 模式下
呼叫端擁有的 session 會保留呼叫端憑證，不能被 proxy 的 bearer 接管。這不會在帳號之間遷移伺服器端
歷史。

所有權以核准該請求的 opencodex API 金鑰劃分，所以即使兩把金鑰都解析到同一個 ChatGPT 工作區，也絕
不會互相碰到對方的 session。工作區 id 代表一個組織而非一個人，所以登錄檔也會綁定上游憑證所帶的
穩定使用者：同一個使用者的一般 token 重新整理會延續 session，而同一工作區內的不同使用者則不會。
當被接受的憑證證明不了一個穩定使用者時，就只有那個精確的憑證能延續 session。那個主體就是請求呈現
的 opencodex API 金鑰。遠端繫結本來就需要一把金鑰，所以所有權機制在那裡可以運作。在預設的
loopback 繫結上，opencodex 接受請求時不會讀取金鑰，而內建的 loopback 注入也無法攜帶
`x-opencodex-api-key` 標頭，所以 Codex 不會出示任何 opencodex 金鑰，context 歷史會回傳 HTTP
403。**因此這個 relay 只在搭配已設定金鑰的遠端繫結上可用，或給自行送出 `x-opencodex-api-key` 的
客戶端使用，在預設的內建 loopback 整合上則不可用。** 一個 loopback 繫結的 proxy 究竟該不該能指名
呼叫端，目前仍是維護者尚未定案的問題，所以目前的行為是拒絕，而不是用猜的。

未知、過期、被驅逐、衝突，或因重啟而遺失的所有權，會在帳號選擇或上游 I/O 之前回傳 HTTP 409。
relay 不會從目前的現用帳號去猜測。既有 session 在啟用這項功能或重置 context 之前，應該先儲存一個
checkpoint 或其他持久摘要。啟用它不會回填更早的歷史或筆記，一次新的所有權觀測也不能證明較舊的
backend 內容確實存在。重新啟動後，請先以一次成功的模型請求建立所有權，才能使用 context 工具；當
所有權衝突時，請開始一個新 session。

既有的模型親和性、冷卻與重試規則不變。context 請求不會被自動重試，筆記寫入也一樣；ChatGPT forward
請求不使用同金鑰 429 重播。歷史流量不會消耗或結清一次模型配額復原探測。

整個 relay 操作只有一個 35 秒的期限，從讀取請求主體之前就開始計時，並涵蓋憑證選擇，所以一個卡住的
客戶端無法把一個已核准的回合插槽一直占著。客戶端斷線會回傳 499，逾期則回傳 504；無論哪一種，之後
都不會有任何東西被派送到上游。

要停用這項功能，請移除實驗性的 key（或設為 `false`）、執行 `ocx sync`，並開始一個新的 Codex
session。受管的根層級 base 會回到 `/v1`。

當這個 key 缺席或為 `false` 時，relay 就不存在：這十個端點對任何呼叫端都回答 404，包括直接對它們
發送請求的呼叫端，一次模型回合也不會記錄任何歷史所有權。opencodex 是靠讀取 Codex 自己的設定來
判定的，所以這個開關不取決於注入的 URL，也不取決於客戶端送出了什麼，關閉它不需要重新啟動就會生效。

### 內建圖像生成（`image_gen`）

Codex 的內建 `image_gen` 工具不會經過 `/v1/responses`。codex-rs 擴充套件會直接 POST 到
`{base_url}/images/generations`；附帶參考圖時則使用 `/images/edits`，並沿用聊天使用的 ChatGPT bearer
認證。由於注入的 `base_url` 指向 opencodex，proxy 會把這些呼叫中繼到 OpenAI 上游。

這與 [Image Bridge](/guides/image-bridge/) 是不同路徑。Image Bridge 只有在 **Responses** turn
列出 hosted `image_generation` 工具、且目前選的是非 OpenAI 模型時才會啟動。獨立的
`/images/generations` 呼叫不會進入該 bridge。

- **單一、感知模式的 forward 候選：** Pool 會選擇合格的主帳號或新增帳號；Direct 使用 caller OAuth
  bearer。圖像請求會一致遵循目前設定的模式。
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
> [轉接器](/reference/adapters/#google)。

若 `hostname` 不是 loopback 地址，Codex 必須傳送產生的 API 認證標頭，因此注入器會改用專用
provider：

```toml
# root keys
model_provider = "opencodex"
model_catalog_json = "/absolute/path/to/opencodex-catalog.json"

# appended at the end of the file
# Auto-injected by opencodex
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

:::caution
`openai_base_url`、`model_provider`、`model_catalog_json` 等根級鍵**必須**位於第一個 `[table]`
標頭之前。注入器會保證此位置、移除自己留下的舊值或重複項，而且絕不覆寫使用者自有的根級
`openai_base_url`；若該值存在，同步仍會更新模型目錄，但會回報路由未注入。
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

在 WSL 中，如果未設定 `CODEX_HOME`，且 Linux 的 `~/.codex/config.toml` 不存在，opencodex 也會檢查
`/mnt/c/Users/*/.codex/config.toml` 下是否只有一個 Windows Codex Desktop home。候選項恰好只有一個時，
會使用該目錄，讓 WSL app-server mode 與 Windows Codex Desktop 共用相同的 config 與 auth 檔案。
若要覆蓋此偵測，請明確設定 `CODEX_HOME`。

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

若規範的 ChatGPT forward 延續參照的本機重播狀態已過期或缺失，opencodex 會在送出任何內容到上游
之前，回傳 `previous_response_not_found`。Codex 的 WebSocket 客戶端能辨識這個錯誤，並可以在它正常
的串流重試預算內，帶著完整保留的 context（包括已完成的工具呼叫與其結果）重新連線。因此一個閒置的
任務不會只因為 proxy 一小時的快取過期就需要開新任務。這個快取仍是有界的；這不會延長保留期限，也
不能復原客戶端自己已經沒有的歷史。HTTP 客戶端必須明確處理這個錯誤，並在不使用
`previous_response_id` 的情況下重送完整的 context。只重試相同的 ID 無法復原遺失的狀態。

同樣的復原訊號也適用於設定了 `statelessResponses: true` 的路由 Responses 供應商，以及一個自訂
工具被降級成 function、但差異結果沒有本機呼叫可以確立其原始型別的路由請求。完整重播會把呼叫、
結果與推理一起保留；opencodex 不會猜測結果型別或把它丟掉。有狀態的供應商仍會自行解析原生 function
與只支援原生的自訂延續。這些檢查依循選定的 wire 協定與工具宣告，而不是模型名稱。對於無法解析已
儲存 response ID 的閘道，請在該供應商上啟用 `statelessResponses`；其他供應商維持各自的預設值。

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
  [Desktop 遠端伺服器](/guides/codex-app-models/#desktop-remote-servers)
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

### 自訂模型顯示名稱

自訂模型可以帶一個可讀的**顯示名稱**，只覆寫 Codex 模型選擇器顯示的標籤，不改變任何路由行為。
顯示名稱只對應目錄條目的 `display_name` 欄位；路由 slug（`<provider>/<model>`）、alias collision 順序、
provider 與原生 OpenAI 行銷名稱都維持不動。

可從 CLI 新增顯示名稱；proxy 在線時會立即同步目錄：

```bash
ocx models add deepseek deepseek-v4 --display-name "DeepSeek V4" --context-window 128000
```

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

明確的 wire 映射請見[解析器與橋接](/reference/architecture/#the-parser)。沒有任何供應商層級的設定
可以補上一個缺失的 `tool_search` 宣告；一般的 code-mode 探索仍是一條獨立的路徑。

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

## Codex 保留模式下的路由模型

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

## Subagent 選擇器

目錄同步會讓選定的 sub-agent 模型可供 Codex 使用；picker 排序請參見
[Codex App 模型選擇器](/guides/codex-app-models/#subagent-selection)，v1/base/v2 委派與 fallback
行為則參見 [Sub-agent Surface](/guides/sub-agent-surface/)。

## Codex 帳號預熱

新增或重新驗證帳號時，通常會在儲存前傳送小型模型請求並等待 `response.completed`。預設使用 `gpt-5.6-luna`，HTTP 400 或 HTTP 404 時改用 `gpt-5.5` 重試。公開錯誤僅包含固定分類，不包含原始回應本文。

若新 OAuth 憑證的已驗證用量查詢確認5小時、每週或每月額度耗盡，則不呼叫模型而直接儲存帳號，顯示**等待驗證**。重新啟動或更新權杖也不會使其可用。額度恢復後重新整理額度：只有完整的最新用量顯示有餘額，才會傳送小型驗證請求；請求完成後帳號才可用於路由。查詢或驗證失敗將保留等待狀態。一般狀態輪詢不會傳送該請求。首次註冊時用量未知仍需一般預熱驗證。

`ocx account refresh openai` 和 `ocx account list openai --quota --refresh` 僅查詢用量。模型驗證會消耗配額，因此需要使用者的儀表板工作階段：配額恢復後，開啟 `ocx gui` 並點選 **Refresh quotas**。無介面主機也需要透過瀏覽器存取其儀表板；僅憑管理員權杖無法授權驗證。暫停的帳號可以完成驗證，但不會因此恢復或被選取。模型授權錯誤會持續顯示，直到驗證或重新登入成功。

背景重新驗證是獨立功能，預設關閉。它需要 Token Guardian、`openai` 的 `proactive` 更新政策及 `tokenGuardian.codexWarmupEnabled`，並略過等待註冊驗證的帳號。

### 帳號停止處理請求的原因

帳號退出帳號池選擇時，原因會隨判定一起傳遞，而不是為了顯示重新計算，因此介面不會在路由已排除該帳號時仍顯示正常。`GET /api/codex-auth/accounts` 會在每個帳號的 `needsReauth` 旁回傳 `reauthReason`：從未儲存憑證為 `missing_credential`，更新持續失敗為 `refresh_failed`，用量查詢本身遭拒為 `quota_unauthorized`。

主帳號更新未完成時仍回傳帶 `Retry-After` 的 `503`，因為重試仍可能成功。訊息現在補充說明：若持續失敗，代表主帳號需要重新認證，而不只是再試一次。

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

當 opencodex 作為受管的 [背景服務](/reference/cli/#ocx-service) 執行時，會設定 `OCX_SERVICE=1`，
因此 service 驅動的重新啟動**不會**反覆改寫 Codex 設定；只有明確執行 `ocx stop` 或
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
損失；它不會修復上游協定本身。見[子代理介面](/guides/sub-agent-surface/)與
[上游的限制](https://github.com/lidge-jun/opencodex/issues/92)。

## 分頁歷史記錄安全拒絕

當受影響的歷史儲存區支援分頁紀錄時，供應商切換可能回傳 `history_paginated_requires_native_writer`。這個原因不再拒絕寫入 Codex 設定、參考設定檔或模型目錄。`ocx sync` 與 `ocx start` 仍會寫入這些檔案並設定 `model_catalog_json`，所以 Codex 模型選擇器會繼續顯示每一個 OpenCodex 路由過的模型。只有這一個原因會讓對話歷史的重新標記停手，因為分頁部署序號是由 Codex 自己的寫入器分配的，重試也不會改變這一點。其他任何歷史預檢原因——無法讀取的狀態資料庫、身分已變動的部署，或未能執行的預檢——仍會拒絕整個切換並回復，因為那些情況之後可能會成功。在這個狀態下，OpenCodex 絕不會修改分頁部署檔案或執行緒列。既有對話會保留它們已經標記的供應商，不會被遷移；新對話仍正常經 proxy 路由。當重新標記停手時，家目錄裡既有的 `[model_providers.opencodex]` 表會被保留而不是撤下，即便是根層級覆寫（loopback）形式也一樣，這樣標記為 `opencodex` 的對話列，仍能對應到一個依然存在的供應商 id。這也包括可遷移儲存區中的舊版列。CLI 會印出 `Codex resume history: left to Codex's native writer (history_paginated_requires_native_writer)`。

`ocx restore` 與移除 Codex 設定，仍會因 `history_paginated_requires_native_writer` 而被拒絕。在執行緒列仍參照它時剝除 `[model_providers.opencodex]` 定義，會讓那些對話變得無法解析，而復原路徑沒有辦法保留一個相容性供應商表。一個已經分頁的家目錄，目前無法透過本產品解除安裝；這是已知的未完成工作，而不是預期行為。

請勿為了自行遷移這些對話，而改寫一個現用的分頁部署或執行緒列。任何復原動作之前，請先關閉受影響的對話，並回報確切的錯誤與版本，不要上傳私人歷史。單靠備份或一個成功的指令碼，並不能證明對話已經重新可見。重新開啟後，請在 Codex 中確認該對話。
