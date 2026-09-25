---
title: 伺服器與執行階段設定
description: 監聽器、遠端存取、許可金鑰、逾時、儲存、sidecar、shadow call 與啟動行為。
---

伺服器設定控制本機代理如何監聽、保護遠端流量、管理資源，並在供應商請求周圍執行輔助功能。

## 伺服器欄位

| 欄位 | 型別 | 預設值 | 意義 |
| --- | --- | --- | --- |
| `port` | `number` | `10100` | 代理監聽連接埠。 |
| `hostname?` | `string` | `"127.0.0.1"` | 綁定位址。非回送綁定需要 `OPENCODEX_API_AUTH_TOKEN`。 |
| `proxy?` | `string` | — | 對外 HTTP(S) 或 SOCKS5 代理 URL（`socks5://host:port`）或 `${ENV_VAR}`。HTTP URL 僅在那些變數未設定時套用至 `HTTP_PROXY` / `HTTPS_PROXY`。SOCKS5 URL 使用內建的真實 SOCKS5 通道，也會套用至 `ALL_PROXY`（`ocx start --socks5`），並清除此行程繼承的 `HTTP(S)_PROXY`。回送保留在 `NO_PROXY` 中。 |
| `emptyCompletionRetry?` | `boolean` | `false` | 明確啟用：當 Responses 完成時沒有文字或工具呼叫，以相同請求重試一次。重試可能產生費用。`OCX_EMPTY_COMPLETION_RETRY=0` 可在不變更設定的情況下停用；combo 與 routed-compaction turn 不適用。 |
| `dropCodexSafetyBuffering?` | `boolean` | `false` | 從規範的 Codex Responses 透傳中移除選用的、面向客戶端的提示：兩個 `x-codex-safety-buffering-enabled` / `x-codex-safety-buffering-faster-model` 回應標頭、中繼資料類型為 `safety_buffering` 的 `response.metadata` 事件，以及頂層的 `safety_buffering` 欄位。其他標頭、回應資料、政策拒絕與失敗都會保留。這不會停用供應商的安全機制或上游緩衝。原生的 `codex.response.metadata.headers` WebSocket 中繼資料與 `/responses/compact` 不受此過濾影響。 |
| `stallTimeoutSec?` | `number` | `300` | 上游無有效進展的秒數，適用於 Responses 與原生 Chat；最小 1 秒。 |
| `oauthOpenBrowser?` | `boolean` | `true` | 登入是否可以在執行 proxy 的機器上開啟瀏覽器。缺省與 `true` 都會開啟，所以既有安裝不受影響；只有明確的 `false` 才會拒絕。當你需要在不同的瀏覽器設定檔中開啟授權連結，或儀表板不在 proxy 所在機器上時，請選擇拒絕——登入仍會開始，URL 仍會被回傳並顯示。`POST /api/oauth/login` 與 `POST /api/codex-auth/login` 接受可覆寫此設定的逐請求 `openBrowser` 布林值，儀表板也在登入按鈕旁提供相同選項。裝置碼流程無論如何都不會開啟瀏覽器。 |
| `connectTimeoutMs?` | `number` | `200000` | 每次嘗試的 DNS/TCP/TLS/final-header 截止時間；它在 body 生成前結束。 |
| `shutdownTimeoutMs?` | `number` | `5000` | 在中止活躍回合前的優雅排空截止時間。 |
| `websockets?` | `boolean` | `false` | 廣告並允許面向 client 的 Responses WebSocket 路徑。False 時 client 使用 HTTP/SSE；不會停用符合條件的 canonical ChatGPT upstream WS 最佳化。 |
| `corsAllowOrigins?` | `string[]` | `[]` | 額外的精確 CORS 來源。回送來源恆被允許。 |
| `apiKeys?` | `OcxApiKey[]` | `[]` | 生成的 `ocx_…` data-plane 准入憑證（用於非回送綁定）。它們不授權管理 API；管理存取使用[管理 API 參考](/zh-tw/reference/management-api/)中說明的獨立憑證。由儀表板管理。 |
| `storageCleanupPolicy?` | `StorageCleanupPolicy` | 停用 | 選擇加入的已封存 session 清理政策。永不隱含啟用。 |
| `appOwnedMemoryBudgetMb?` | `number` | `256` | 以 MiB 為單位、可被驅逐的 app 擁有日誌、快取、blob 與 continuation payload 上限。範圍 64–4096；非 RSS 上限。 |
| `metricsExport.enabled?` | `boolean` | `false` | 在已驗證的 `GET /api/metrics` 啟用程序本機的彙總請求指標。需要重新啟動；停用時路徑回傳 404，且不會啟動任何匯出活動。 |
| `codexAutoStart?` | `boolean` | `true` | 讓 Codex shim 在啟動 Codex 前執行 `ocx ensure`。False 使 ensure 為 no-op。 |
| `codexShimAutoRestore?` | `boolean` | `true` | 在完成的外部 Codex 更新取代已安裝的 shim 後還原它。環境退出：`OPENCODEX_CODEX_SHIM_AUTO_RESTORE=0`。 |
| `codexDesktopAuthless?` | `boolean` | `false` | 在回送綁定上選擇加入無驗證的 Codex Desktop 路由：注入專屬的 `opencodex` 供應商並設定 `requires_openai_auth = false`，讓 Desktop 不需要 ChatGPT 登入即可開啟。在非回送綁定上會被忽略。`ocx system settings --desktop-authless on`。詳見 [Codex 整合](/zh-tw/guides/codex-integration/#authless-codex-desktop-opt-in)。 |
| `codexClientCompaction?` | `boolean` | `false` | 在已驗證的回送綁定上選擇加入 Codex 用戶端壓縮。使用專屬的 `opencodex` 供應商身分並設定 `requires_openai_auth = true`，防止新的路由壓縮儲存 OpenCodeX 擁有的 `ocx1:` 狀態。兩者都啟用時，`codexDesktopAuthless` 優先，並維持 `requires_openai_auth = false`。V2 子代理路由不受影響。`ocx system settings --client-compaction on`。詳見 [Codex 整合](/zh-tw/guides/codex-integration/#client-side-compaction-opt-in)。 |
| `resetCreditAutoRedeem?` | `{ enabled?: boolean; leadTimeMinutes?: number }` | 關閉 | 選擇加入：在主要 Codex 帳號最快到期的 reset credit 過期前 `leadTimeMinutes` 分鐘（1–60，預設 10）兌換它。每次嘗試都會先重新讀取上游的 credit 清單，若該 credit 已消失（例如已被手動兌換）則跳過；呼叫前會先把 `redeem_request_id` 記錄到 `$OPENCODEX_HOME/reset-credit-auto-redeem.json`，因此當機後重播的是同一個冪等請求，而不會消耗第二個 credit。共享這個設定目錄的多個伺服器會協調保留與結算，避免一個行程覆寫另一個行程的請求紀錄。日誌只帶有經雜湊的帳號金鑰。 |
| `syncResumeHistory?` | `boolean` | `true` | 可逆的 Codex App 歷史相容性。原始中繼資料由 `ocx stop` / `ocx restore` 備份並還原。 |
| `shadowCallIntercept?` | `{ enabled?: boolean; model?: string; sourceModels?: string[] }` | off | 將識別的 Codex helper/shadow call 重定向到所選模型，並保留為請求設定的 reasoning effort。預設來源前綴為 `gpt-5.6-luna`；0.144.x 及更舊的客戶端使用 `gpt-5.4-mini`，可透過 `sourceModels` 恢復。 |
| `webSearchSidecar?` | `OcxWebSearchSidecarConfig` | 可用時開啟 | 網頁搜尋 sidecar 選項。 |
| `visionSidecar?` | `OcxVisionSidecarConfig` | 可用時開啟 | 圖片描述 sidecar 選項。 |
| `images?` | `OcxImagesConfig` | 自動 OpenAI 選擇 | Codex `image_gen` 的獨立 Images 中繼選項。 |

當規範的 ChatGPT 上游 WebSocket 在送出 create frame 後等待第一個 Responses 事件時，它監看的是
存活訊號而不是固定的截止時間。當該 socket 支援協定層級的 ping 時，proxy 每 15 秒 ping 它一次。
任何進來的 frame——配額、回應中繼資料，或一個 pong——都會重設一個 90 秒的靜默計時器，所以即使
socket 不支援 ping，只要有自己的 frame 就仍會維持存活；只有完全沒有任何東西持續 90 秒，請求才會
以 HTTP 504、帶著 `upstream_no_response` 錯誤結束。因此一個緩慢但存活的來源，會等待客戶端自己的
截止時間或 `connectTimeoutMs`（預設 200 秒）兩者較早者；在送出 create frame 之後才觸發的連線
逾時，同樣以那個 504 結束。在第一個 Responses 事件之前就關閉或出錯的 socket，會以 HTTP 502、帶著
`upstream_closed_before_response` 結束。這些狀態絕不會在 proxy 內部重試——該 frame 可能已經在
上游執行，所以客戶端會套用它自己的重試政策，就跟直接連到後端時一樣。一旦回應已經開始，之後的
斷線仍會照舊在串流中顯現。`stallTimeoutSec` 與這個時間窗無關。

`noProxy` 接受逗號分隔的字串或陣列。兩種形式都是新增項目，不會取代繼承的 `NO_PROXY`：

```jsonc
{ "proxy": "http://proxy.corp:8080", "noProxy": "internal.example,10.0.0.0/8" }
```

```jsonc
{ "proxy": "http://proxy.corp:8080", "noProxy": ["internal.example", "10.0.0.0/8"] }
```

SOCKS5（包括 Clash 混合連接埠監聽器）屬於 `ALL_PROXY`，不是 `HTTP_PROXY`：

```jsonc
{ "proxy": "socks5://127.0.0.1:10808" }
```

若較舊的開發組建在備份支援存在前變更了 resume-history 中繼資料，請執行 `ocx recover-history --legacy-openai --yes` 以強制原生供應商復原。
此命令會重新標記所有含有使用者訊息的 `opencodex` row，其中也包含正常的專用 provider 歷史；執行前請查看 lifecycle reference 中的完整範圍警告。

### 原生 Chat 的逾時與完成狀態

原生 Chat 等待上游輸出時也使用 `stallTimeoutSec`。非空文字、推理、拒絕內容、工具更新及完成事件會重設等待額度；保活註解、僅角色事件及單獨的用量資訊不會。等待慢速用戶端讀取時暫停計時。逾時產生 `upstream_stall_timeout`：串流請求收到錯誤事件，非串流請求回傳 HTTP 502。終態結果到達前取消請求會回傳取消錯誤，不會將部分答案當成成功。緩衝的 Chat 結果支援 LF 與 CRLF 兩種 SSE 格式，包含多行 data。

## Codex 配額網路診斷

主 Codex 帳號列在嘗試過配額查詢時，可能會包含 `quotaRefresh`。這描述的是那次查詢本身，不是剩餘
配額、模型存取權限或重試許可。快取讀取，以及未執行查詢的列，可能會省略它；缺席不代表成功。
`null` 的配額值代表無法取得，不是零配額。

在 PowerShell 中請求最新資料並只顯示診斷資訊：

```powershell
$quotaReport = ocx account list openai --quota --refresh --json | ConvertFrom-Json
$quotaReport.accounts |
    ForEach-Object { if ($_.quotaRefresh) { $_.quotaRefresh } } |
    ConvertTo-Json -Depth 3
```

若不存在診斷資訊，這個投影不會產生任何診斷物件。比較網路模式時，請只分享這些欄位，而不是
完整的帳號清單。

| `quotaRefresh.status` | 意義 |
| --- | --- |
| `ok` | 查詢完成，且成功解析出配額物件。 |
| `not_reported` | 回應中沒有可用的配額物件。 |
| `http_error` | 上游回傳 HTTP 失敗；`httpStatus` 帶有其狀態碼。 |
| `timeout` | 配額查詢逾時。 |
| `network_error` | 請求在得到已分類的 HTTP 回應之前就失敗。 |
| `invalid_response` | 回應不是可用的配額文件。 |
| `internal_error` | 內部重新整理步驟失敗。 |

只有 `http_error` 帶有 `httpStatus`。其他狀態並不代表 HTTP 0 或帳號權益問題。

### 使用的是哪一條 proxy 路徑？

執行中的 proxy 服務負責取得配額。它使用自己的環境，而不是之後執行 `ocx account list` 的互動式
shell。請設定該服務的 proxy 選項或環境變數，然後重新啟動它；在另一個終端機變更變數不會更新
一個已經在執行的服務。

未設定 `proxy` 會維持既有的代理變數不變。明確的 HTTP(S) 代理 URL 只會在 `HTTP_PROXY` 與
`HTTPS_PROXY` 未設定時才填入它們。`"proxy": "auto"` 只在啟動時讀取一次 Windows 靜態 WinINET
代理；既有的代理環境變數優先。自動偵測不會處理 PAC/WPAD、僅支援 SOCKS 的設定或即時的代理變更。
需要時請改用受支援的靜態 HTTP 代理設定，或明確的 HTTP(S) 代理 URL。

請在同一台機器、同一個帳號上，於兩種網路模式下比較這項診斷。單靠一次成功的 TUN 測試，無法判斷
服務的 HTTP 代理路徑為何失敗，也無法確立一個通用的修復方式。

## 特定上游主機的連線重用

有些上游會在停止服務某條連線之後仍讓它保持開啟。下一個請求會重用那個池化的 socket，並在連不到
provider 的情況下失敗。`OCX_FRESH_CONNECTION_HOSTS` 指名永不重用池化連線的主機，這是一個環境
變數而不是設定欄位，因此可以只套用在單一機器上而不必修改共用設定：

```bash
OCX_FRESH_CONNECTION_HOSTS="api.example.com, relay.example.net" ocx start
```

此值是以逗號分隔的主機名稱清單。比對不分大小寫，涵蓋每個指名主機及其子網域，並忽略開頭的點，
因此 `.example.com` 與 `example.com` 都會比對到 `api.example.com`。請不要包含 scheme、連接埠
或路徑。未設定或空字串會維持預設的連線行為不變。

符合條件的送出會帶有 `Connection: close`，並以停用 keep-alive 的方式發送。判斷依據是實際在
連線上使用的位址，因此即使 provider transport 在憑證選擇之後重寫了目的地，這個規則仍會套用。
這些主機的每次請求延遲會略微上升，因為每個請求都要付出一次全新的 TCP 與 TLS 交握；只指名真正
需要的主機。

## 遠端存取

預設的 `127.0.0.1` 綁定僅限回送。如 `0.0.0.0` 或 tailnet IP 的非回送位址，需要在 `/api/*` 與
data plane 上都進行 token 認證。

你不需要自己產生那個 token。`ocx service install` 會在非回送綁定上依下列順序準備一個：
安裝時 shell 中的 `OPENCODEX_API_AUTH_TOKEN`，接著是既有的、僅擁有者可讀的 `service-api-token`
檔案，最後是 32 個全新的隨機位元組。結果會以 `0600` 權限寫入，啟動包裝程式（launchd plist、
systemd unit、Windows wrapper）會在啟動時讀取該檔案，因此該值絕不會進入服務定義或 argv。前景
執行的 `ocx start` 套用相同的優先順序——環境變數、然後 `OCX_API_TOKEN_FILE`、然後已安裝的
`service-api-token`——所以它同樣可以在沒有匯出 token 的情況下綁定非回送主機名稱。

**管理用的 admin token** 出現在它可能出現的任一位置時都會被拒絕——環境變數或被沿用的
`service-api-token` 檔案——而且訊息會指名該處的修正方式：取消設定該變數，或刪除該檔案後執行
`ocx service repair`。這兩項檢查都在迴路短路之前執行，因為啟動包裝程式無論主機名稱為何，都會把
該檔案讀進 `OPENCODEX_API_AUTH_TOKEN`，所以即使是回送綁定，一個 admin-token 檔案也會把管理 API
關閉。`ocx status` 在 hub 上會把這個狀態回報為 `admin-collision (file)`。

若維運方想自行掌管這個值，仍然支援自行設定該變數：

```bash
export OPENCODEX_API_AUTH_TOKEN="your-secret-token"
ocx start
```

客戶端應發送：

```text
x-opencodex-api-key: your-secret-token
```

| 端點 | `Authorization: Bearer` | `x-opencodex-api-key` | `x-api-key` |
| --- | --- | --- | --- |
| `/v1/responses` | 不接受 | **必填** | 不接受 |
| `/v1/chat/completions` | 不接受 | **必填** | 不接受 |
| `/v1/messages` | 接受 | 接受 | 接受 |
| `/v1/messages/count_tokens` | 接受 | 接受 | 接受 |
| `/v1/models` | 接受 | 接受 | 接受 |

Responses 與 Chat Completions 為可能的 Codex Direct passthrough 保留 `Authorization`，因此那裡僅接受專屬的許可標頭。儀表板生成的 `apiKeys` 可在啟動後取代環境 token；候選值以常數時間比對。

Messages 與 `count_tokens` 為相容路由客戶端仍接受三種許可形式。但在非回環綁定上，原生 Anthropic 透傳只透過
`x-opencodex-api-key` 接受代理許可，並將 `Authorization` 與 `x-api-key` 保留給 Anthropic
憑證。放在這些供應商標頭中的代理許可密鑰會在轉發前移除。

:::caution[LAN 暴露]
`0.0.0.0` 綁定將代理與設定的供應商存取暴露給 LAN。僅在受信任的網路上搭配強 token 使用。
:::

### 無法接收 token 的本機用戶端

遠端綁定要求每個呼叫者都要有憑證，包括本機呼叫者。這會破壞一個特定情境：由 host process 啟動、
直接解析 Codex entrypoint（`require.resolve('@openai/codex/bin/codex.js')`）的 `codex app-server`
永遠不會經過生成的 `codex` shim，因此它不會繼承 `OPENCODEX_API_AUTH_TOKEN`，每次模型呼叫都會在
stream 開啟前以 `401` 失敗。

`unauthenticatedLoopbackListener` 會開啟第二個綁定到 `127.0.0.1` 的 listener，不要求憑證即可
放行。主 listener 不受影響——遠端呼叫者仍需要 token。

```json
{
  "hostname": "0.0.0.0",
  "port": 10100,
  "unauthenticatedLoopbackListener": { "enabled": true, "port": 10200 }
}
```

接著 `ocx sync` 會把 `base_url = "http://127.0.0.1:10200/v1"` 寫入受管的 Codex provider 區塊，
並省略 auth header，因此直接生成的 app-server 不需要任何憑證管線即可運作。

該 port 是必填的，且必須與 proxy port 不同。它絕不會由 OS 指派：臨時 port 會在重啟時改變，而
已執行的 app-server 仍保留先前的 `base_url`。

省略 `port` 會選擇**companion**形式——該 listener 會在 `127.0.0.1` 上綁定 proxy 的連接埠：

```json
{
  "hostname": "100.76.170.81",
  "port": 10100,
  "unauthenticatedLoopbackListener": { "enabled": true }
}
```

遠端客戶端用憑證撥打 `100.76.170.81:10100`；本機行程則不帶憑證撥打 `127.0.0.1:10100`。這正是
每個本機整合早就會寫入的位址，所以 `ocx claude`、Claude Desktop、Cursor 與 system-env 注入，在
一台它們連不到其公開綁定的主機上仍能繼續運作。companion 形式只有在 `hostname` 是明確的非回送、
非萬用位址時才會被接受：在 `127.0.0.1`、`localhost` 或 `0.0.0.0` 上，公開的 listener 已經佔用該
回送位址，所以 OpenCodex 會在寫入當下與啟動時拒絕這組配對，而不是讓第二次綁定失敗。在那些綁定上
你根本不需要這個 listener——回送綁定本來就會放行本機呼叫者。

設定了 `port` 時，本機整合會跟隨該 listener：`ocx claude`、`system-env` 注入、Claude Desktop 設定檔、
Cursor 閘道值與路由過的 vision helper，全都會寫入 `http://127.0.0.1:<listener port>`，也就是
`ocx sync` 寫入 Codex 的同一個連接埠。在 companion 形式中，這些相同的整合仍會寫入 proxy 的連接埠，
那正是 companion socket 所在之處。

**變更此欄位後，無論哪種形式都請重新啟動 proxy。** socket 只在啟動時綁定一次，匯出的客戶端值也是
依解析後的連接埠寫出，所以執行中的 proxy 會維持先前的答案——在帶連接埠的 listener 上，這正是
一個請求被正常服務、還是從 listener 收到 `404` 的差別。

在 `runtimeRole: "hub"` 上，這個欄位也是 hub 是否改寫**自己**本機客戶端設定的閘門。當 listener
關閉時，`ocx sync`、`ocx ensure` 與 `ocx restore back` 會略過 hub 自己的 Codex/Grok/Claude 寫入
並說明原因，指名的是 `unauthenticatedLoopbackListener`，而不是 `clientIntegrations` 開關。

該 listener 只服務 `POST /v1/responses`、其 WebSocket upgrade、`POST /v1/responses/compact`、
`POST /v1/messages`（Claude Code 與 Claude Desktop 所使用的 Anthropic 線路）、
`POST /v1/chat/completions`（Cursor 與 vision helper 所使用的 OpenAI chat 線路）、
`POST /v1/alpha/search`（原生 Codex 網頁搜尋中繼）、`GET /v1/models`，以及即時語音介面：獨立的
WebSocket upgrade、WebRTC 通話建立（`POST /v1/live`、`POST /v1/realtime/calls`），以及帶金鑰的
旁路加入 upgrade（`/v1/live/{callId}`、`/v1/realtime/calls/{callId}`、
`/v1/realtime?call_id=`）。其他所有東西，包括 `/api/*`、`/healthz`、`/readyz` 與儀表板，都會回傳
`404`——像 `ocx claude` 的探索呼叫這類本機管理讀取，會帶著管理憑證走已驗證的管理介面，絕不會走
這裡。

:::danger[這是一個未認證的介面]
機器上的每個 process 都可以使用此 listener。它會耗用帳號配額與付費 provider 憑證，也可能耗盡
已認證遠端用戶端依賴的共享 turn 容量。請勿在共用或多租戶主機上啟用。

綁定到 `127.0.0.1` 表示 kernel 會拒絕遠端連線，但不會阻止瀏覽器：你造訪的頁面可以讓瀏覽器連到
`127.0.0.1`。因此該 listener 套用與一般 loopback 綁定相同的 `Host` 與 `Origin` 檢查。預設關閉。
:::

### SSH 連接埠轉發

遠端使用不需要遠端綁定。保持回送並轉發它：

```bash
ssh -L 20100:localhost:10100 you@remote
```

任何本機連接埠皆可。Host 解析為 `localhost`、`127.0.0.1` 或 `::1` 的請求，不論連接埠皆保持回送，因此 `http://localhost:20100/v1` 可運作。在客戶端設定該 base URL；`ocx` 僅將預設的本機 `127.0.0.1` 位址寫入受管客戶端設定。

供應商 OAuth callback 在固定遠端連接埠監聽。在遠端機器上登入或也轉發該連接埠：

```bash
ssh -L 20100:localhost:10100 -L 1455:localhost:1455 you@remote
```

若已註冊的 callback 連接埠已被佔用，且該登入介面提供手動輸入選項，OpenCodex 會保留已註冊的
redirect URI，並仍然回傳供應商的授權 URL。請完成供應商登入，然後把瀏覽器網址列中最終的
redirect URL，或授權碼，貼進 OpenCodex。等待中的流程會保留 state 與 PKCE 驗證。沒有手動輸入選項
的呼叫者仍會 fail closed。

:::caution[轉發的回送未認證]
普通 `ssh -L` 在你的本機回送上監聽，對預設的未認證綁定是安全的。請勿使用 `ssh -g -L`、廣泛的容器發布，或將客戶端暴露在 `0.0.0.0` 上的轉發模式。不確定時請用 `ssh -L 127.0.0.1:20100:localhost:10100` 明確綁定。
:::

## 帳號電子郵件遮罩（`privacy`）

已儲存的帳號電子郵件，在離開 proxy 的每個地方都會被遮罩——儀表板帳號清單、
`GET /api/codex-auth/accounts`、`GET /api/oauth/status`，以及 `ocx status` 的登入區段，全都會
顯示 `p***n@example.com` 而不是實際存檔的地址。

| 欄位 | 型別 | 預設值 | 意義 |
| --- | --- | --- | --- |
| `privacy.maskEmails?` | `boolean` | `true` | 設為 `false` 可完整顯示已儲存的帳號電子郵件。缺省、`true`，以及任何格式錯誤的值都會維持遮罩，所以只有刻意設定的 `false` 才會揭露地址。 |

當你在自己掌控的機器上執行很多帳號、且無法從遮罩形式分辨它們時，可以關閉此選項。請把這個旗標
當成一個揭露決策，而不是顯示偏好：管理介面不一定只在回送上——在設定了 `remoteGui` 的 hub 上，
未遮罩的地址會傳達給每一個能連到該 hub 的管理主體，不只是坐在那台機器前的人。這個旗標只會影響
電子郵件欄位——token、refresh token 與帳號識別碼無論如何都會保持遮罩。

```json
{ "privacy": { "maskEmails": false } }
```

`ocx config set privacy.maskEmails false` 在該區塊存在之前會以 `config parent path not found`
失敗，因為 `config set` 只會走進既有物件，絕不會建立它們。請改為寫入整個物件——
`ocx config set privacy '{"maskEmails":false}'`——或手動把該區塊加進 `config.json`。

## 儲存清理

`storageCleanupPolicy` 預設停用。啟用時，它在已封存位元組超過 `trigger.archivedBytesOver` 後於 `startup`、`daily`、`weekly` 或 `manual` 執行。它朝 `target.reduceToBytes` 或 `target.removeOldestPercent` 選擇最舊的封存。`mode` 預設為 `quarantine`；僅將 `permanent` 作為明確的破壞性選擇。政策持久化 `lastRun` 與 `nextRun`。在 Storage 頁面或以 `GET`/`PUT /api/storage/cleanup-policy` 設定它；以 `POST /api/storage/cleanup-policy/run` 觸發手動執行。

## 用量歷史大小

`usageLedgerMaxBytes` 預設未設定，未設定代表 `usage.jsonl` 中的請求歷史會無限制成長。沒有
你沒要求刪除的歷史會被刪除。

設定一個位元組上限，代理會在某次附加寫入超過上限之後修剪檔案，保留最新的完整資料列並捨棄
最舊的。它會修剪到略低於上限，而不是精確等於上限，這樣下一次附加寫入不會立即再次超過那條線。
接受的最小值是 1 MiB；較小的數字，或不是安全整數的值，會讓上限維持關閉，而不是讓設定失敗。

資料列是逐位元組複製、絕不重寫的，因此每個欄位都能在修剪後存活——包括較新版本寫入、較舊版本
看不懂的欄位。若修剪執行期間有任何內容附加到帳本，替換動作會直接拒絕，因此修剪期間記錄的請求
絕不會遺失；下一次附加會再試一次。修剪也會更新儀表板顯示的內容，因此 `/api/logs` 會停止提供
帳本已經沒有的資料列。

目前還沒有對應的儀表板控制項；請在 `config.json` 中設定，或使用
`ocx config set usageLedgerMaxBytes <bytes>`。

## 配額重置通知（`quotaResetNotify`）

預設關閉。當這個區塊缺席時，不會執行偵測、不會啟動計時器，也不會寫入任何狀態檔案。

啟用它可以在用量窗口重置時收到通知——包含可預期的排程重置，以及無法預期的 out-of-band 重置：

```json
{
  "quotaResetNotify": {
    "enabled": true,
    "webhookUrl": "https://hooks.slack.com/services/...",
    "kinds": ["scheduled", "surprise"],
    "pollSeconds": 900
  }
}
```

| 欄位 | 預設值 | 意義 |
| --- | --- | --- |
| `enabled` | `false` | 主開關。同時需要至少一個下方的接收端。 |
| `kinds` | 兩者皆有 | `scheduled`（期限已過）或 `surprise`（配額提前恢復）。 |
| `pollSeconds` | `900` | 閒置輪詢間隔；下限 600。`0` 只觀察即時流量。 |
| `webhookUrl` | — | 接收事件 JSON 的 `https` POST 目標。視為機密。 |
| `allowPrivateNetwork` | `false` | 允許回送或私有網路的 webhook 目標。 |
| `timeoutMs` | `5000` | Webhook 逾時。 |
| `command` | — | 以事件 JSON 作為 stdin 執行的 argv 陣列。 |

`enabled: true` 但 `webhookUrl` 與 `command` 皆未設定時會被視為關閉：一個已啟用、卻無處可送達的
子系統是設定錯誤，不是半開啟狀態。

下限是 600 秒，因為更快的輪詢看不到任何新東西：觀察受限於每帳號 10 分鐘的快取，所以更短的間隔
只會為一個本來就會限流的配額端點增加負擔。已設定的值會在下一個 tick 生效，不需要重新啟動。

只有在你能接受「proxy 閒置期間發生的重置，要到下一次請求才會被注意到，而不是在它發生時」的情況下，
才把 `pollSeconds` 設為 `0`。這個輪詢之所以存在，是因為過夜的情況正是值得知道的那種情況。

### 送達的事件

```json
{
  "type": "quota_reset",
  "kind": "surprise",
  "scope": "codex",
  "accountTag": "k3f9x2ab",
  "window": "weekly",
  "percentBefore": 96,
  "percentAfter": 4,
  "previousResetAt": 1772000000000,
  "resetAt": 1772400000000,
  "detectedAt": 1771900000000
}
```

`accountTag` 是每次安裝各自加鹽的雜湊，不是帳號識別碼：它讓你可以分辨自己的多個帳號，但不會告訴
接收端它們是誰。絕不會包含任何電子郵件、token、路徑或 URL。

`detectedAt` 是 proxy 注意到的時間，不是重置實際發生的時間。觀察受限於供應商 5 分鐘的快取，以及
每帳號 10 分鐘的快取，所以重置的確切時刻只能被夾在兩次觀察之間。

### 安全性附註

`webhookUrl` 是一種憑證——對 Slack 與 Discord 而言，持有這個 URL 就足以發文——所以它會被
`ocx config show` 遮罩，並被 `ocx config export` 排除。

若 webhook 目標解析為私有或回送位址，除非你設定 `allowPrivateNetwork: true`，否則會被拒絕。
proxy 能連到你瀏覽器連不到的主機，包括雲端中繼資料端點，所以預設假設接收端是外部的。

`webhookUrl` 必須使用 `https`。payload 本身與 URL 都是敏感資料，`http` 目標會讓它們以明文傳送；
寫入設定時 `http` 值會被直接拒絕，而不是被靜默降級。

重新導向會被拒絕而不是被跟隨。上面的目的地檢查驗證的是你設定的 URL，若跟隨一個 `3xx`，payload
就會被送到一個未經驗證的地方——一個公開端點可能會把 POST 彈跳到回送位址或中繼資料位址。請直接
設定最終的 URL；被重新導向的傳送會回報 `blocked-destination`。

`command` 是一個 argv 陣列，絕不會透過 shell 傳遞，所以它的值不可能變成 shell 注入面。傳送只會
嘗試一次；沒有重試。

用 `ocx provider resets` 或 `GET /api/quota-resets` 讀取最近的偵測結果。

## Claude Code（`claudeCode`）

這些設定治理 `/v1/messages`、`/v1/messages/count_tokens`、`ocx claude` 啟動器與 Claude 儀表板頁面。

| Key | 型別 | 預設值 | 說明 |
| --- | --- | --- | --- |
| `claudeCode.bodyStallSec?` | `number` | `90` | 原生 passthrough body 在讀取待決時的不活動預算（秒），非總持續時間。最小 1；精確 `0` 停用。 |
| `claudeCode.bodyMaxBytes?` | `number` | `67108864` | 串流與緩衝回應的累積原生 passthrough body 上限。精確 `0` 停用。 |
| `claudeCode.compatibility?` | `"shadow" \| "enforce"` | 未設定 | 針對轉換後的 `/v1/messages` 請求的選用相容性准入。`shadow` 會記錄不支援的功能並繼續；`enforce` 會在推論前回傳 Anthropic 形狀的 400。原生 Anthropic 透傳不受影響。 |
| `claudeCode.authMode?` | `"proxy" \| "subscription"` | 自動 | 啟動如何處理 `ANTHROPIC_AUTH_TOKEN`。自動每次啟動偵測認證；明確值永不被覆寫。 |
| `claudeCode.authModeMigratedAt?` | `string` | 未設定 | 內部一次性升級標記。請勿手動設定。 |
| `claudeCode.classifierModel?` | `string` | 未設定 | Claude Code Auto Mode 分類器回合的明確目標，格式為限定的 `provider/model`（例如 `RelayA/claude-opus-5`）。Auto Mode 會送出像 `claude-opus-5` 這樣不帶供應商的裸安全檢查，若沒有這個設定，它們會落到 `defaultProvider`——而該供應商可能根本不支援 Anthropic 協定。這裡不會自動推斷任何東西：只有你在此宣告的目標才會被使用。 |
| `claudeCode.classifierFallbacks?` | `string[]` | 未設定 | 當 `classifierModel` 未設定時使用的有序分類器目標清單。採用相同的限定 `provider/model` 格式；第一個可用的項目會勝出。分類器模型的明確 `modelMap` 項目仍然優先於兩者。 |
| `claudeCode.subagentEffort?` | `"low" \| "medium" \| "high" \| "xhigh" \| "max"` | 繼承 | 寫入生成的 `~/.claude/agents/ocx-*.md` 的 effort；與 Codex guidance 與代理上限分開。透過 `ocx claude` 重啟以重新生成。 |

自動認證在找到已儲存的 Claude 認證時選擇訂閱，無認證時選擇 proxy，偵測不明確時選擇訂閱並附帶警告。請見[Claude Code 認證模式](/zh-tw/guides/claude-code/#認證模式)。

## Compaction 路由

在**儀表板 → Overview → Compaction routing**中，選擇一個模型、它適用的觸發條件，以及選填的
reasoning effort，然後點擊**儲存**。選擇**使用對話模型**並儲存可移除該覆寫。變更會套用到下一次
compaction 請求，不需要重啟代理。

在 OpenCodex 的 `config.json` 中設定 `compactionRouting`，可覆寫 Codex compaction 請求使用的
模型。省略時此設定為停用。

```json
{
  "compactionRouting": {
    "model": "provider/model-id",
    "reasoningEffort": "low",
    "triggers": ["manual"]
  }
}
```

`model` 接受原生模型 ID、供應商限定的模型 ID，以及已設定的 combo。`reasoningEffort` 為選填；
省略時保留原始的 effort。支援的宣告值為 `none`、`minimal`、`low`、`medium`、`high`、`xhigh`、
`max` 與 `ultra`。既有的 provider effort 規則仍會套用。原生的 `/responses/compact` 端點維持
既有行為，不轉發 reasoning 設定。

`triggers` 指名此覆寫涵蓋哪些 compaction 請求，使用 Codex 自己的 `compaction.trigger` 值：
你手動輸入 `/compact` 對應 `"manual"`，Codex 在對話接近 context 上限時自動執行的 compaction
對應 `"auto"`。省略 `triggers` 時，覆寫只套用於手動 `/compact`，自動 compaction 完全維持
現在的路由方式。使用 `["auto"]` 或 `["manual", "auto"]` 可讓自動 compaction 也被路由。

路由自動 compaction 正是讓路由供應商上的長對話，能在規範 OpenAI 配額耗盡時繼續進行的關鍵。
Codex 會為 compaction 這一輪選擇一個裸原生模型，而 OpenCodex 只要有已啟用的規範 `openai`
provider 就會保留它給該用途，因此即使對話本身在別處執行，compaction 仍會在該輪開始前就以
配額錯誤失敗。在這裡指名 `"auto"`，會把 compaction 指向一個帶有自己憑證與配額的供應商限定
模型。

OpenCodex 只會變更帶有明確 `request_kind: "compaction"` 中繼資料、且 `compaction.trigger`
是你列出的其中一個值、送往 `/v1/responses/compact` 或帶有 `compaction_trigger` 輸入項目的
`/v1/responses` 的請求。之後的對話回合維持原始的路由與設定。缺失、格式錯誤或衝突的中繼資料
不會啟用此覆寫，包括在沒有 trigger 中繼資料的較舊客戶端上；當提供多份中繼資料時，它們必須
指名相同的 trigger。WebSocket 請求使用每個 frame 自己的中繼資料，而不是連線先前 handshake
時的中繼資料。

所選模型的供應商會收到整份對話以進行摘要，包括通常在另一個供應商上執行的對話。combo
選擇器會把它送給每個 combo 目標，包括 failover 目標。選定模型後，儀表板面板會在模型選擇器
旁說明這一點，並指名目的地供應商，或 combo 的目標供應商。當覆寫涵蓋自動 compaction 時，這種
轉移會在你沒有要求的情況下發生，時機由 Codex 決定何時 compaction；儀表板面板也會如此說明。
此覆寫重用既有的 compaction 處理器與摘要格式。當所選模型與對話模型共用相同的供應商與帳號路由
身分（供應商名稱、Codex 帳號模式與帳號命名空間）時，請求會保留呼叫者的憑證，並可能使用該
後端的原生 compact 端點。否則——包括任一方是 combo，或對話模型被記為 combo 目標的情況——
OpenCodex 會改用可攜式摘要器，這樣當對話在自己的模型上恢復時摘要仍可讀，且呼叫者的憑證不會
跨到另一個供應商。所選模型必須支援輸入大小與內容。手動編輯 `config.json` 後請重啟代理。
儀表板儲存會立即套用。

## Shadow call

Codex 使用小型 helper 模型處理如標題與 commit 訊息等任務。啟用 `shadowCallIntercept` 以將識別的來源模型前綴重定向到另一個已設定的模型。替換後仍會保留為請求設定的 reasoning effort。僅在客戶端使用不同的 helper id 時設定 `sourceModels`。
攔截是以模型為基礎的：任何裸模型 id 符合 `sourceModels` 的請求都可能被重新導向，包括一般的
`request_kind: "turn"` 請求。`x-codex-turn-metadata` 不會讓相符的請求豁免。

```json
{
  "shadowCallIntercept": {
    "enabled": true,
    "model": "gpt-5.5",
    "sourceModels": ["gpt-5.6-luna"]
  }
}
```

### 目標無法使用時

替換目標是操作者選定的唯一目的地，因此無法再解析的目標會讓輔助呼叫失敗，而不是把它送到別處。當目標的供應商被停用或刪除，或其組合已不存在時，被攔截的請求會在向上游送出任何內容之前回傳 `409` 與錯誤代碼 `intercept_target_unavailable`。請求記錄會記下相同代碼。請求不會直通給原生輔助模型，也不會退回預設供應商，因為兩者都會在你未選擇的情況下改變目的地、憑證與費用。組合或路由設定檔目標仍會在自身成員之間容錯移轉。像 `provider/model` 這樣的限定目標，若其供應商部分未指向任何已設定項目，也以相同方式處理，設定 API 會拒絕儲存。透過預設供應商解析的不帶前綴模型 ID 仍然有效。

停用（帶 `disabled: true` 的 `PATCH /api/providers?name=<provider>`）或刪除目標所解析到的供應商仍會成功；回應會加入 `dependentShadowIntercept: { model, enabled }`，儀表板會顯示警告。重新啟用該供應商或選擇其他目標即可恢復攔截。

## Sidecar

### `images`（`OcxImagesConfig`）

| 欄位 | 型別 | 預設值 | 意義 |
| --- | --- | --- | --- |
| `provider?` | `string` | 自動 OpenAI 選擇 | 用於 `/v1/images/generations` 與 `/v1/images/edits` 的明確自訂 API-key `openai-responses` 供應商。Registry 管理的 id 被拒絕。 |
| `timeoutMs?` | `number` | `300000` | 一個獨立 Images 請求的整體請求逾時。 |

明確選擇在供應商缺失、停用、不相容或缺少可用金鑰時 fail closed；它永不後退到另一個付費上游。端點必須實作 Codex 預期的 OpenAI Images API 路徑與回應結構。

### `webSearchSidecar`（`OcxWebSearchSidecarConfig`）

| 欄位 | 型別 | 預設值 | 意義 |
| --- | --- | --- | --- |
| `enabled?` | `boolean` | 可用時開啟 | 主開關。為 `false` 時，OpenCodex 停止攔截 `web_search`，且 Codex 整合會把 `web_search = "disabled"` 寫入 `~/.codex/config.toml`。 |
| `backend?` | `"openai" \| "anthropic" \| "xai" \| "gemini" \| "exa"` | `openai` | 明確設定優先；省略時一律使用 `openai`。`anthropic` 與 `xai` 僅在明確設定時執行；`gemini` 與 `exa` 在 executor 推出前仍為保留值。 |
| `model?` | `string` | 視 backend 而定 | OpenAI 為 `gpt-5.6-luna`、Anthropic 為 `claude-sonnet-5`、xAI 為 `grok-4.6`。舊版明確 `gpt-5.4-mini` 在啟動時遷移。 |
| `exaApiKey?` | `string` | 無 | `exa` backend 的操作員金鑰。僅可寫入：管理讀取永遠不會傳回已儲存的值。 |
| `xSearch?` | `object` | 省略 | xAI 專用的託管 `x_search` opt-in：`enabled`、互斥的 `allowedXHandles` / `excludedXHandles` 陣列（最多 20 項），以及 ISO `fromDate` / `toDate`（`YYYY-MM-DD`）。 |
| `reasoning?` | `string` | `low` | Sidecar effort。`minimal` 在網頁搜尋時被拒絕。 |
| `maxSearchesPerTurn?` | `number` | `3` | 每個主模型回合允許的實際搜尋。 |
| `routedModelStallTimeoutMs?` | `number` | `200000` | 僅設定檔的路由模型原始 body 不活動截止時間。整數 1–2147483647；每個非空 chunk 重置它。 |
| `timeoutMs?` | `number` | `60000` | 一個代管搜尋的截止時間。 |

OpenAI backend 需要 ChatGPT 登入與啟用的 ChatGPT `forward` 供應商。Claude-inbound 路由重播將主 ChatGPT 認證注入內部請求。Anthropic backend 使用來自已啟用 Anthropic OAuth 供應商的現用已儲存憑證。明確選擇的 Anthropic backend 在無可用帳號時 fail closed 而非後退。Anthropic 執行器使用其原生 `web_search_20250305` 工具。xAI backend 需要可用的已儲存 Grok OAuth 帳號，使用託管 `web_search`，並在 `xSearch.enabled` 為 true 時加入託管 `x_search`。格式錯誤的 `xSearch` 管理輸入會傳回 `400`；格式錯誤的持久化區塊會在規劃期間 fail closed。`gemini` 與 `exa` 通道絕不會因憑證探索或 fallback 而啟用；操作員必須明確選擇它們。`exaApiKey` 可在寫入時接受，但會從管理回應中省略。

四個時鐘治理搜尋：基礎 `stallTimeoutSec`、`connectTimeoutMs`、路由模型不活動與代管搜尋逾時。有效的橋接看門狗為最大值加 30 秒。路由停滯是不活動防護，而非總生成截止時間。

### `visionSidecar`（`OcxVisionSidecarConfig`）

| 欄位 | 型別 | 預設值 | 意義 |
| --- | --- | --- | --- |
| `enabled?` | `boolean` | 可用時開啟 | 主圖片描述開關。 |
| `backend?` | `"openai" \| "anthropic"` | 自動 | 明確值優先；未設定時優先使用可用的已儲存 Anthropic OAuth 憑證，否則使用 `openai`。 |
| `model?` | `string` | 視 backend 而定 | OpenAI 為 `gpt-5.6-luna` 或 Anthropic 為 `claude-sonnet-5`。 |
| `maxDescriptionsPerTurn?` | `number` | `8` | 每個主回合允許的新描述快取未命中。`0` 停用呼叫；無效值使用預設。 |
| `timeoutMs?` | `number` | `45000` | Sidecar 擷取逾時。整數 1–2147483647。 |

視覺僅對發送到其供應商 `noVisionModels` 中模型的圖片啟用。OpenAI 的登入／forward 需求與搜尋相同；明確選擇的 Anthropic 在無可用憑證時 fail closed。成功的 `data:` 描述使用以 backend、模型、細節、圖片位元組與正規化訊息 context 為 key 的有界快取。命中與同回合重複不消耗限制。遠端 `https:` 圖片與失敗或空的描述不被快取。

Anthropic OAuth sidecar 重用 opencodex 既有的 Claude Code OAuth 指紋。請對預期帳號與工作負載進行浸泡測試。

## Remote Hub 金鑰與預設值

`runtimeRole` 預設為 `standalone`。Hub 會使用 `hub.managementPublicOrigin`、僅限迴路的
`hub.managementIngress`（缺席時為 `enabled:false`），以及精確比對的
`remoteGui.allowedTailscaleUsers`（缺席時為空）。用戶端的資料金鑰保存在 `service-api-token`，
絕不會在 `config.json` 中；輪替期間可能暫時建立 `service-api-token.prev`。用量儲存不會互相鏡像。

| 鍵 | 型別 | 缺席時的預設值 | 作用 |
| --- | --- | --- | --- |
| `hub.managementPublicOrigin` | string | 未設定 | hub 對外宣告的、瀏覽器可連到的規範管理 origin，例如 Tailscale Serve 印出的 HTTPS origin。這是 `runtimeRole` 為 `hub` 時，`/readyz` 回報為 `managementUrl` 的值；未設定時，hub 會退回使用每個請求實際抵達時所用的 origin，所以位於不同前端後面的客戶端，可能會被交付一個它連不到的位址。 |
| `hub.dataPublicOrigin` | string | 未設定 | 遠端客戶端應該撥打的**資料**平面規範 origin，例如 TLS 前端在 tailnet 綁定前面發布的 HTTPS origin。僅供參考：它絕不是綁定位址，變更它不會移動任何 socket。`ocx hub invite` 會把它印成 `ocx connect` 那一行的位置參數 URL，未設定時退回 `http://<hostname>:<port>`——這是遠端機器可能無法透過 TLS 連到的 LAN/tailnet 位址，所以任何有前端的 hub 都應該設定這個值。與大多數選用鍵不同，它在格式錯誤時**不會**被靜默捨棄：打錯字會在寫入當下被拒絕，因為避免退回到綁定位址，正是這個欄位存在的目的。 |
| `hub.managementIngress` | `{enabled:false}` 或 `{enabled:true, port}` | `{enabled:false}` | 一個額外的、僅供管理使用的 listener，給本機 HTTPS 前端使用。主機名稱不可設定：啟用時該 socket 一律綁定 `127.0.0.1`，且只放行 GUI、session-bootstrap 與管理 API 路由。資料平面路由會在派發前就被拒絕。 |
| `remoteGui.allowedTailscaleUsers` | string[] | `[]`（空——沒有人） | 允許自動簽發遠端 GUI session 的精確 Tailscale 登入身分。`Tailscale-User-Login` 標頭**只**在獨立的管理 ingress 上受信任；空清單代表沒有任何遠端身分可以簽發 session，這是安全的預設值，不是疏漏。身分比對是精確比對，所以打錯字會靜默拒絕存取。 |
| `remoteGui.allowInsecureHttp` | boolean | 未設定 | **已淘汰——沒有作用。** 它曾經允許透過非迴路的明文 HTTP 進行一次性配對交換。配對授權現在只會經過迴路或已驗證的 HTTPS。這個鍵仍會被解析，讓既有的 `config.json` 能繼續載入（schema 是嚴格的，直接拿掉這個鍵會讓較舊的設定完全無法載入）；持久化的 `true` 只會被回報一次，之後就會被忽略。請把它從你的設定中移除。 |

一個可以從瀏覽器連到的 hub，需要 `hub.managementPublicOrigin`，以及 `remoteGui.allowedTailscaleUsers`
中至少一筆項目。只設定 origin 而沒有使用者清單，會產生一個能正確宣告自己、卻拒絕每個 session 的
hub；只設定使用者清單而沒有 origin，會產生指向請求恰好使用的那個 origin 的 session。

`dataPublicOrigin` 與 `managementPublicOrigin` 是兩個獨立的宣告，在實際部署中它們是兩個不同的
socket：管理是發布在 443 上、僅限迴路的 ingress，資料則是發布在自己 HTTPS 連接埠上的 tailnet
綁定。它們正是 `ocx hub invite` 印出內容的兩半，而 `managementPublicOrigin` 是兩者中較嚴格的
一個——一份配對授權會把它記錄成該授權自己的伺服器 origin，交換時會拿它來比對，這就是為什麼
`ocx hub invite --management-url` 只能*確認*已設定的值，而拒絕一個不同的值。`--data-url` 則
真的是一個覆寫，因為沒有任何東西綁定在它上面。當 `dataPublicOrigin` 與 `--data-url` 都未設定時，
`invite` 會退回使用綁定位址——而在迴路或萬用綁定上，那會解析成這台機器自己的迴路位址，此時它會
拒絕，而不是去宣告一個另一台機器用不到的位址。

一個同時服務自己本機客戶端的 hub，也會設定
[`unauthenticatedLoopbackListener`](#local-clients-that-cannot-receive-the-token)。它不帶連接埠的
companion 形式，正是讓 hub 成為單一連接埠部署的原因，而它在迴路或萬用 `hostname` 上會被拒絕，
因為公開的 listener 已經佔用了 `127.0.0.1:<連接埠>`。

## 實驗性原生回應控制

`codexNativeSteering` 與 `codexNativeInjection` 啟用兩條獨立、預設關閉的原生 WebSocket
控制路徑。詳見規範指南中的
[支援的 steering 路由與設定](/zh-tw/guides/codex-integration/#steering-continuation-settings)、
[型別化結果與核准的續傳](/zh-tw/guides/codex-integration/#rich-tool-results-and-explicit-approvals-after-response-completion)，
以及[確認期限與保留的內容](/zh-tw/guides/codex-integration/#steering-confirmation-deadlines-and-retained-context)。
