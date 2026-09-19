---
title: 供應商設定
description: 供應商項目、認證、端點、模型目錄、配額、context 上限與供應商專屬選項。
---

供應商告訴 opencodex 模型在哪裡、它使用哪種 wire adapter，以及請求如何被認證。

## 首次註冊時的模型選擇

新的非 OAuth 連線會先等待可靠的模型清單，再公開模型。如果該清單中相異的 Models 分頁列至少有 20 個，所有模型開關初始為 OFF，但供應商本身保持 ACTIVE。OAuth 與 ChatGPT 登入的連線則依有效的認證模式保留各自的預設值。

這只在首次註冊供應商時執行；既有選擇會在更新、重新登入與更換金鑰後存活。初始化後，可在 Models 或使用以下 CLI 指令啟用所需模型；後續新增模型的獨立政策不變。請將 `<model-id>` 換成清單中的 ID。

```sh
ocx models live --provider openrouter
ocx models enable '<model-id>'
ocx models disable '<model-id>'
ocx models provider openrouter on
```

在介面中完成註冊或 OAuth 登入後，確認對話框可讓你開啟 Models 頁面。CLI 註冊與登入會印出模型管理指令，JSON 也包含結構化的後續步驟。`--no-wait` 表示登入仍在等待中，不代表已完成。使用即時模型指令前，請先以 `ocx start` 啟動代理。

## Z.ai Coding Plan 配額端點

Z.ai 的配額探測會辨識國際版 coding Chat base
`https://api.z.ai/api/coding/paas/v4`、文件化的
[Claude Code Anthropic base](https://docs.z.ai/devpack/tool/claude)
`https://api.z.ai/api/anthropic`，以及文件化的
[Codex Responses base](https://docs.z.ai/devpack/tool/codex)
`https://api.z.ai/api/v1`。這三者都以 Bearer 認證從國際版監控端讀取配額；這不會改變推論
URL，也不代表不同 adapter 之間的配額消耗不同。既有的 BigModel CN 監控端選擇維持獨立。
完整的請求 URL（例如 `/api/v1/responses`）不是供應商 base URL。

## 供應商相關的頂層欄位

| 欄位 | 型別 | 預設值 | 意義 |
| --- | --- | --- | --- |
| `providers` | `Record<string, OcxProviderConfig>` | — | 供應商名稱到供應商設定的映射。 |
| `openaiProviderTierVersion?` | `2` | 由遷移設定 | 標記單一選項感知的 OpenAI projection 已完成。 |
| `disabledModels?` | `string[]` | — | 對 Codex 目錄與 `/v1/models` 隱藏的模型，但不會阻擋直接的代理呼叫。路由 id 會從清單中移除。帶帳號限定的原生 id 只會隱藏該選擇器列；裸原生 GPT id 會隱藏裸列以及該模型的每一個帳號選擇器列。儀表板 Models 頁面只公開路由列與裸原生列；要隱藏單一個帳號限定列，請直接使用這個設定欄位。 |
| `providerContextCaps?` | `Record<string, number>` | `{}` | 各供應商目前生效的上下文上限。一般視窗只能縮小；支援長視窗的原生模型可以擴展到該模型支援的上限。 |
| `providerContextCapValues?` | `Record<string, number>` | `{}` | 各供應商最後選擇的上限，停用後仍保留。僅儲存這些值不會啟用上限。生效中的值優先於儲存的選擇值。 |
| `contextCapValue?` | `number` | `350000` | 首次啟用時使用的預設值。再次啟用時恢復該供應商的選擇值。修改全域值時附帶 `setAll: true` 只會更新已啟用的上限；不帶值的 `setAll: true` 會以目前全域值啟用所有已設定供應商的上限。 |
| `codexAccounts?` | `CodexAccount[]` | `[]` | 由 Codex Auth 管理的 ChatGPT/Codex 池帳號中繼資料。秘密分別存在 `codex-accounts.json`。 |
| `pausedCodexAccountIds?` | `string[]` | `[]` | 被排除於池選擇直到恢復的帳號，包含暫停時的 main `__main__` 帳號。 |
| `codexQuotaAutoRefresh?` | `Record<string, object>` | `{}` | 在 Pool 模式下，每個 Codex 登入帳號可選擇加入的 `fiveHour` 與 `weekly` 視窗自動啟用；Direct 模式不執行此背景工作。在 Providers／Codex Auth 的**進階設定**中，一個控制項可為目前所有 main 與已新增帳號一次啟用或停用這兩個支援的視窗。新帳號不會自動選擇加入。啟用時會略過即時 WHAM 資料中不存在的視窗；停用時也會清除過期的已啟用視窗。介面重用細粒度的 `/api/settings` 寫入、協調部分失敗，並重試原本的開／關意圖，不會取代不相關的設定或已完成的重設標記。API 仍會以 HTTP 409 拒絕啟用一個不可用的視窗。在回報的重設時間點，opencodex 會用該帳號的配額送出一則最小、不儲存的 Codex 訊息，並持久化已啟用的時間戳記。這不適用於 API-key 供應商。 |
| `codexAccountNamespaces?` | `Record<string, string>` | — | 從任意公開模型選擇器到已儲存 Codex 帳號目標的選用映射。啟用帳號限定 picker 列時，每個目標存在的選擇器都會為 Codex picker 新增獨立的 `<selector>/<native-openai-model>` 列；每一列只使用該帳號。只要有任一選擇器生效，picker 中的裸原生列就會被隱藏，但除非明確停用，其 id 仍可路由，並會列在原始的 `/v1/models` 中。 |
| `codexAccountPickerEnabled?` | `boolean` | map 為空時關閉 | 控制合格的 `codexAccountNamespaces` 映射是否產生帳號限定的 Codex picker 列。`true` 允許已映射的列出現。若省略且 map 非空，為向下相容視為啟用；若 map 為空，則視為關閉。`false` 會隱藏產生的列並恢復裸原生 picker 列，但不會刪除映射，也不會停用精確的 `<selector>/<native-openai-model>` 路由。 |
| `activeCodexAccountId?` | `string` | — | 為下一個請求手動選擇的池帳號。選擇清除執行緒親和性；進行中的請求保留擷取的憑證。 |
| `codexAccountPriorities?` | `Record<string, number>` | — | Codex 池中各帳號的選擇順序：帳號 id → 介於 `-100` 到 `100` 的整數，**數值越高越先使用**，缺省為 `0`。這是順序邊界，不是資格邊界：選擇會把已合格的帳號縮小到仍有配額餘裕的最高分層，`accountPoolStrategy` 再從該分層內挑選。只有當某一分層的每個成員都超過 `autoSwitchThreshold`、正在冷卻、被軟性迴避、已暫停，或需要重新認證時，才會跳過該分層——未知的配額絕不會耗盡一個分層。順序絕不會讓一個不合格的帳號變成可選，也絕不會重新綁定一個已經有帳號的執行緒。main 的 `__main__` 帳號以同等地位參與，這也是為何 Codex Desktop 登入可以被設定為最後才耗用。沒有任何項目時，池的行為與先前完全相同。格式錯誤的 map 會被忽略並在主控台顯示警告（順序功能關閉，不會修復設定）。由 `ocx account priority` 與 Codex Auth 頁面管理。 |
| `activeCodexAccountPinned?` | `string` | — | 維運方最後一次手動選擇的帳號 id。設定期間，更高分層的 `codexAccountPriorities` 無法搶占它，直到該釘選被排空、排除、刪除，或明確的容錯移轉／升級移走才會釋放。分層上限內的一般 round-robin 移動不會釋放它。寫入任何 `codexAccountPriorities` 項目也會釋放這個釘選，所以在順序存在之前設定的釘選，無法凌駕之後設定的順序。`GET /api/codex-auth/active` 同時回報生效帳號是否被釘選（`pinned`）以及帶有此上限的帳號（`pinnedAccountId`）。 |
| `autoSwitchThreshold?` | `number` | `80` | 主動切換的用量閾值。`quota` 可在下一個請求時重新評估未綁定任務。綁定任務預設（`pool.cacheAffinity`）在越過閾值後仍會保留帳號，直到該帳號耗盡或無法繼續服務，並且只改綁到確有額度餘裕且用量嚴格更低的帳號。將 `pool.cacheAffinity` 設為 `false` 才會在此閾值重新評估綁定任務。`fill-first` 僅將其用作未綁定指派的排空點；一般 `round-robin` 選擇不使用它。分數使用最熱的已知 5h、週或 30d 配額視窗。`0` 僅停用基於用量的主動切換，而非未綁定指派或失敗復原。 |
| `accountPoolStrategy?` | `"quota" \| "round-robin" \| "fill-first" \| "reset-first"` | `"quota"` | 新／未綁定 Codex 請求的指派策略。當請求沒有即時（父執行緒 id、配額 scope）親和性時即為未綁定；可見的既有任務在代理重啟或親和性重置後可變為未綁定。`quota` 在無現用帳號時選擇最低用量的合格帳號，將合格現用帳號保持在 `autoSwitchThreshold` 以下，且在閾值後可將未綁定請求移至較低用量的合格帳號。綁定任務遵循 `pool.cacheAffinity`（預設開啟）：它們會保留到帳號耗盡（已知用量 100%）或無法繼續服務，改綁時只前往確有額度餘裕且用量嚴格更低的帳號。將該旗標設為 `false` 可在閾值時主動改綁一個已綁定任務，仍只前往確有額度餘裕且用量嚴格更低的帳號。`round-robin` 均勻分配未綁定請求；`fill-first` 持續將未綁定請求指派到現用帳號直到冷卻、不可用或設定的排空閾值。`reset-first`：在低於用量門檻的帳號中，優先選擇下次 5 小時或週額度重設最早的帳號。已綁定任務遵循設定的親和策略。獨立模型額度按配額排序。此排序不使用月額度重設時間。 |
| `pool.cacheAffinity?` | `boolean` | `true` | 綁定 Codex 執行緒的 cache-affinity 排序，獨立於 `pool.kernel`。預設開啟；省略此鍵或設為 `true`，會讓綁定任務留在原帳號，直到該帳號確實無法繼續服務為止。只有明確設為 `false` 才會恢復綁定任務依閾值重新綁定。即時綁定優先於配額餘裕：`quota` 不會只因用量越過 `autoSwitchThreshold` 就移動執行緒。帳號若無法繼續服務——暫停、無法使用，或真正耗盡（已知用量 100%）——執行緒仍會離開，且只會改綁到確有額度餘裕且用量嚴格更低的帳號。在任一設定下，用量未知的帳號都不會被選為綁定任務的改綁目標，因此當每個帳號都高於閾值時，任務會留在原地。親和性是重排，而非釘死。 |
| `accountPoolStickyLimit?` | `number` | `1` | 在前進一個 round-robin 選擇前保留的新／未綁定任務指派；計數器在任務綁定時前進，而非在上游成功後。範圍 1–100。 |
| `upstreamFailoverThreshold?` | `number` | `3` | 未來新 session 容錯移轉前的連續暫時性失敗。設 `0` 停用。對一般 Responses 與原生 compact 傳送而言，已證實的連線建立前 DNS/TCP 可達性失敗會在供應商主機層級被追蹤：它們絕不會影響帳號健康狀態、帳號冷卻、執行緒／session 親和性、現用帳號選擇或池路由，也絕不會計入這個閾值。 |
| `upstreamHostCircuitThreshold?` | `number` | `0` | 針對原生 OpenAI forward Responses 與 compact 傳送上已證實的連線建立前 DNS/TCP 失敗，選用的斷路器閾值。`0` 停用；`1`–`20` 表示在該數量的終端邏輯請求後，開啟 30 秒的供應商來源冷卻。開啟期間，請求會在帳號選擇或上游傳送之前就收到帶 `Retry-After` 的 `503`；冷卻結束後，會放行一個半開請求。逾時與任何 HTTP 回應都不計入，任何 HTTP 回應都會關閉斷路器。只適用於沒有釘選帳號的 Codex Pool 路由；對 `codexAccountMode: "direct"` 與帳號限定選擇器無效。 |
| `maxUpstreamBodyBytes?` | `number` | `0` | 選用的上限（位元組），套用於序列化後的原生 Responses **passthrough** 請求主體。`0` 或省略即停用——不會為任何目的地推斷限制。設定後，超過上限的已建構主體會在傳送前於本機被拒絕：串流回合會收到終端的 `response.failed` / `context_length_exceeded`，讓客戶端改為壓縮而非重送；非串流回合則收到 `413`，其中指出大小、內嵌 `input_image` 項目的數量，以及大約代表多少 MB 的影像資料。此檢查會在每個建構與重建點執行，包括 OAuth 重新整理後的重播與替代帳號重試。轉譯後的 adapter 路徑不在涵蓋範圍內。這裡刻意沒有預設值：唯一有實測上限的是 WebSocket 傳輸，而它對超大回合本來就會退回 HTTP，所以預設值會拒絕目前能成功的請求。當你的閘道有已知的請求大小限制，而你寧可看到可處理的本機錯誤而非不透明的上游失敗時，才設定它。 |
| `maxInboundBodyBytes?` | `number` | `0` | 選用的上限（位元組），套用於解壓縮後的**進站**資料平面請求主體——是上面 `maxUpstreamBodyBytes` 的鏡像。`0` 或省略維持內建的 256 MiB 預設值。當大 context session 已經無法壓縮時，請調高它：Codex 會把整段歷史重播給壓縮模型，因此在 922k token 選擇加入視窗上，壓縮請求本身就是超過上限的那一個，讓 session 卡在唯一能讓它縮小的操作上。範圍限制在 1 MiB–512 MiB。這個上限沒有商量餘地：讀取器會將主體具現化好幾次（線上位元組、解碼後位元組、解碼後字串，以及解析出的物件圖），所以尖峰記憶體是被允許大小的倍數，不設上限就是一個記憶體耗盡的槓桿。適用於 `/v1/responses`、`/v1/responses/compact`、`/v1/chat/completions` 與 `/v1/messages`。監聽器的接受大小在代理繫結時就固定，所以變更要重新啟動才會生效。超過限制的主體會在本機以 HTTP 413 拒絕，並附上 `code: "inbound_body_too_large"`，這與供應商大小拒絕產生的 `context_length_exceeded` 413 刻意不同。 |
| `modelCacheTtlMs?` | `number` | `300000` | Per-供應商 `/models` 快取的新鮮度視窗。 |
| `cacheRetention?` | `"none" \| "short" \| "long"` | `"short"` | Anthropic prompt-cache 政策：停用、5 分鐘臨時或 1 小時延長。 |
| `tokenGuardian?` | `OcxTokenGuardianConfig` | off | 可選的主動 OAuth refresh 與 Codex 帳號暖機政策。 |

選擇器名稱是使用者自訂的公開標籤；opencodex 不會賦予它們任何帳號角色語意。
`codexAccountNamespaces` 的 key 是 1–64 個字元，以 ASCII 字母或數字開頭與結尾，中間可含字母、
數字、`.`、`_` 或 `-`。保留的 JavaScript 物件名稱會被拒絕。每個值必須是有效的池帳號 id（絕不是
內部的 `__main__`），或代表 Codex Desktop 帳號的 `"@main"`。供應商與保留字 `openai` / `combo` /
`policy` 的衝突以不區分大小寫方式檢查；命名空間化的 combo 或路由設定檔別名不能把一個選擇器重複
用作自己的命名空間前綴，已設定的池 id 或選擇器目標也不能重複使用某個選擇器。請保持原始帳號 id
與電子郵件私密；選擇器才是公開名稱。精確選取行為與優先順序請見[路由設定](/zh-tw/reference/configuration/routing/)。

Codex Auth 儀表板控制項擁有帶明確 `codexAccountPickerEnabled` 欄位的 map。啟用一個空的受管
map 會建立隱私安全的選擇器；之後新增帳號時，即使 picker 列仍隱藏，也會延伸該 map，且不會重新
命名既有選擇器。手寫、省略該旗標的 map 維持手動狀態，絕不會被自動擴充。刪除一個帳號會保留它的
映射，讓精確路由在該帳號缺席時 fail closed；重新加入同一個帳號 id 會恢復既有的公開選擇器，而不
是配置一個新的。

## 保留的 OpenAI 供應商

`openai` 與 `openai-apikey` 是固定的保留 id。`openai.codexAccountMode` 預設為 `"pool"` 並在 main 加上新增帳號之間選擇；`"direct"` 僅使用目前呼叫者／main 登入。API 僅使用其設定的 API 金鑰或金鑰池。使用裸模型或 `openai-apikey/<model>`；無跨路由憑證後備。API GPT-5.6 列帶有 1,050,000 context / 922,000 max input 中繼資料，而 Pro 虛擬 id 以 `reasoning.mode: "pro"` 重寫為基礎 wire 模型。

`openaiProviderTierVersion: 2` 標記目前的單一供應商 projection。在遷移已出貨的 v1 設定前，opencodex 會在不替換不同備份的情況下建立 `config.json.pre-openai-tiers-v2.bak`，並將已知的舊版命名空間 selected id 重寫為裸 id。

### GPT-6 Astra

`gpt-6-astra` 使用 Codex 登入路由；`openai-apikey/gpt-6-astra` 使用你自己的 API 金鑰。可用性仍取決於上游帳號。原生 Astra 保留出貨時的 Codex 預設值：272,000 context、`low` reasoning，以及 `low`/`medium`/`high`/`xhigh`/`max`/`ultra` 階梯。它在 Fast 目錄中的描述是 **2 倍速度**；那不是計費倍率。

將 `providerContextCaps.openai` 設為 `922000` 可讓原生群組選擇加入長 context；Astra 自身的上限止步於 **872,000**。每個模型的 `providers.openai.modelContextWindows` 與 `modelAutoCompactTokenLimits` 可縮小它的視窗與軟性壓縮預算。例如 `modelAutoCompactTokenLimits: { "gpt-6-astra": 700000 }` 會把長視窗預設值 784,800 調低。明確設定的較小供應商上限或目標限制仍會勝出，包括原生別名組合。

API 列有 1,050,000 context、922,000 最大輸入、128,000 最大輸出、文字／影像輸入，以及最高到 `max` 的 API reasoning effort。OpenCodex 路由過的合成 Ultra 控制項保留其既有的 wire-effort 映射；它不是額外的 API effort。沒有 Astra 的 `-pro` 別名。請使用既有的 `fastMode` 設定，或 Codex 的 `service_tier = "fast"` 搭配 `[features].fast_mode = true`；API 的 `fast` 與 `priority` 都是可接受的 Fast 拼法。

定價於 2026 年 9 月 5 日核對：

| Astra API（每百萬 token，美元） | 輸入 | 快取輸入 | 快取寫入 | 輸出 |
| --- | ---: | ---: | ---: | ---: |
| 標準，輸入最多 272k | 10 | 1 | 12.5 | 50 |
| 標準，輸入超過 272k | 20 | 2 | 25 | 75 |
| Fast，輸入最多 272k | 20 | 2 | 25 | 100 |
| Fast，輸入超過 272k | 40 | 4 | 50 | 150 |

[API 定價表](https://developers.openai.com/api/docs/pricing)會對超過 272k 的**整個請求**重新計價，快取 token 也計入門檻。Fast 與長 context 費率會疊加；這也適用於已公開的 GPT-5.6 API 列與它們的 Pro 虛擬選擇。

所有內建的美元估算都使用 **API 參考價格**，包括 Codex 登入路由。因此 Astra 與 GPT-5.6 在 `openai` 與 `openai-apikey` 上使用相同的 API base／快取費率、**2 倍 Fast** 倍率與已公開的長 context 級距。兩個 Daybreak Blue 選擇器遵循 Sol 的 API 參考價格。這些是比較用的估算值，不是發票或額度餘額預測。明確的供應商／模型價格覆寫仍優先。

## 供應商命名空間別名

供應商可以公開一個內建簡寫，例如 `google-antigravity` 的 `agy`。已設定的供應商名稱或明確別名會以不區分大小寫的方式取得該簡寫；此時另一個供應商的內建簡寫，無論在目錄名稱或別名路由中都會被抑制。舉例來說，設定一個名為 `agy` 的供應商後，Google 的模型仍留在 `google-antigravity/<model>` 底下，而 `agy/<model>` 則會選到你設定的供應商。規範供應商名稱仍需精確比對大小寫，未識別的前綴保留既有的模型路由後備行為。

## 供應商項目（`OcxProviderConfig`）

| 欄位 | 型別 | 意義 |
| --- | --- | --- |
| `adapter` | `string` | `openai-chat`、`openai-responses`、`anthropic`、`google`、`kiro`、`cursor`、`ollama-native`、`azure-openai`（或別名 `azure`）、`codebuddy`、`qoder` 之一。 |
| `baseUrl` | `string` | 上游 API base URL。多數內建固定端點忽略不符；碰撞安全的金鑰預設保留較舊的同名自訂目的地。 |
| `requestPacing?` | `{ enabled, requestsPerMinute?, minIntervalMs?, models? }` | 選用的用戶端出站請求啟動節流，與上游用量、計費及限流指標彼此獨立。供應商限制適用於所有模型，`models` 依上游模型精確 ID 比對（例如 `nvidia/llama-3.1-nemotron-ultra-253b-v1`）且只能增加延遲。排隊等待不計入回應標頭逾時。涵蓋 HTTP、Responses WebSocket 及明確的適配器 `fetchResponse`/`runTurn` 呼叫。 |
| `upstreamHttpVersion?` | `"auto" \| "http1.1" \| "h1" \| "http2" \| "h2"` | 為此供應商的上游請求釘選使用的 HTTP 版本。預設為 `auto`，交由 Bun 協商。明確釘選需要 HTTPS 目標，且在無法遵守時會在本機失敗。當某供應商的 HTTP/2 SSE 串流卡住而不送出事件時，請設為 `http1.1`——徵狀是一個長時間執行的串流請求什麼都不產生，最終逾時。對 Cursor 而言，`http1.1`／`h1` 會為推論選用它的 `RunSSE` + `BidiAppend` 相容傳輸，同時也會釘選即時模型探索。管理用的 `POST`／`PATCH` 接受 `null` 以清回 `auto`。 |
| `responsesPath?` | `string` | Key-auth `openai-responses` 請求的相對資源路徑。必須以 `/` 開頭且不含 scheme、query 或 fragment。 |
| `chatCompletionsPath?` | `string` | `openai-chat` 請求的相對資源路徑，是 `responsesPath` 的鏡像，遵循相同的格式規則。當同一個上游用不同前綴分別服務 Chat Completions 與 Responses 時需要它：per-model 的 wire 覆寫只會改變 adapter，不會動 `baseUrl`，所以沒有這個欄位的話，選擇加入的 Chat 請求會被送到 Responses 的 base。Z.AI 是內建的範例。 |
| `allowEncryptedV2AgentTasks?` | `boolean` | 預設停用。信任一個直接使用 key-auth 的 `openai-responses` 供應商，原封不動地消費或轉送不透明加密的 V2 子代理任務。合格路由會跳過 `agentTaskRecovery`；其他所有路由保留既有的復原或 fail-closed 行為。OpenCodex 不會解密、轉譯或復原透過這個選項傳送的任務。 |
| `upstreamWebsocket?` | `boolean` | 為 `openai-responses` 請求選用上游 Responses WebSocket 傳輸（預設 `false`）。當上游支援此協定時，串流 POST 請求會使用設定的 Responses 路徑（預設 `/v1/responses`），透過 HTTPS 基礎 URL 以 WSS 連線，再重新編碼為一般流程使用的 SSE。forward 供應商使用 `{baseUrl}/responses`；key-auth 供應商使用 `responsesPath`，未設定時回退到傳統的 `/v1/responses`。此舉是為了對應 OpenAI 相容閘道（例如 sub2api）中，已被證實比 SSE 佇列快上許多的 ChatGPT backend 規範優化，其 WebSocket ingress 亦是如此。一般 HTTP 仍使用 SSE；非 Responses 路徑與 `openai-chat` 請求仍使用 HTTP。 |
| `supportsServiceTier?` | `boolean` | 三態的規範 Fast 能力後備。`true` 會在目錄中公開 Fast、滿足 service-tier 路由需求、貢獻一個受支援的指紋，並讓 fast 模式在相容的最終 adapter 上注入供應商自己的規範 wire 值。`false` 會剝除該欄位且絕不注入，精確模型宣告也無法重新開啟它。省略時該供應商未分類：fast 模式不會注入或正規化呼叫端的規範值，呼叫端的值則依最終 wire 的轉送權限而定（Chat 上是 `chatServiceTier`；Responses 上是 passthrough）。登錄檔將規範 OpenAI 分類為 `true`，DeepSeek 與 Volcengine Ark 分類為 `false`；只有真正支援分層的自訂閘道才需要明確設定它。 |
| `modelSupportsServiceTier?` | `Record<string, boolean>` | 精確的上游模型能力覆寫。精確的 `true` 為該模型啟用規範 Fast；精確的 `false` 會收窄供應商預設值。明確的供應商層級 `supportsServiceTier: false` 仍會 fail-closed，無法被重新開啟。精確的 `true` 不會授權在 Chat 上轉送外部呼叫端分層。未宣告的模型退回供應商層級的行為。管理用的 `PATCH /api/providers` 會合併項目，並接受 `null` 來清除一個。 |
| `chatServiceTier?` | `boolean` | 供應商層級、針對 Chat wire 轉送呼叫端 `service_tier` 值的選擇加入。在已分類的路由上，它管理的是像 `flex` 這類外部值，而不是通過能力驗證後、由代理自己擁有的規範 Fast；在未分類的路由上，因為沒有任何 Fast 能力被驗證過，它會管理每一個呼叫端的值。精確模型能力不會授權轉送外部值。Responses 路由保留其既有的、以能力為基礎的呼叫端轉送行為。 |
| `promptCacheKey?` | `boolean` | 供應商層級、針對 `openai-chat` 轉送 `prompt_cache_key` 的選擇加入。adapter 只會轉送它拿到的 key，絕不會自己發明一個，但這個 key 不總是呼叫端提供的：Claude Messages 轉譯會從 `metadata.user_id` 推導一個，或在沒有送出 metadata 時從模型／系統／工具的組合推導。預設關閉。只在上游文件記載支援時才啟用，因為嚴格的閘道可能會用 HTTP 400 拒絕未知欄位。 |
| `preserveResponsesReasoningContent?` | `boolean` | 在重播的 Responses reasoning 項目上保留明文推理內容，而不是清空它（清空是 ChatGPT backend 的規則）。對於契約接受推理重播的上游（例如 DeepSeek）啟用它。代理自行鑄造的 `ocxr1` 封套一律會被剝除。 |
| `disabled?` | `boolean` | 將供應商保留在磁碟上但排除於路由與模型／目錄清單。 |
| `apiKey?` | `string` | API 金鑰、`${ENV_VAR}` / `$ENV_VAR` 參考，或由 `ocx provider keychain <name> store` 寫入的 `keychain:<provider>` 參考。參考值在請求時解析。見「在 OS 金鑰圈中儲存金鑰」一節。 |
| `apiKeyTransport?` | `"x-api-key" \| "bearer"` | Anthropic 金鑰標頭風格。預設為原生 `x-api-key`；僅對 key-auth `anthropic` 供應商有效。 |
| `apiKeyPool?` | `ApiKeyPoolEntry[]` | 多金鑰池。`apiKey` 反映現用項目；每個項目有 `id`、`key`、可選 `label` 與可選數值 `addedAt`。 |
| `apiKeyPoolStrategy?` | `"round-robin" \| "fill-first" \| "quota"` | 當現用金鑰已在冷卻時，在第一次嘗試**之前**如何選擇一個可用金鑰。省略時輪替維持只在事後反應：池只會在收到 429 或 401 之後才移動，不會提前移動。`round-robin` 取池中下一個金鑰，`fill-first` 保留第一個合格金鑰，`quota` 偏好剩餘餘裕最多的金鑰，並在供應商的個別金鑰配額未知時退回 `fill-first` 順序。健康的現用金鑰絕不會被覆寫，所以手動選擇的金鑰維持不變。 |
| `defaultModel?` | `string` | 在未指定明確模型時選擇此供應商所使用的模型。 |
| `models?` | `string[]` | 初始／後備模型清單。`liveModels: false` 時，非空的 `models` 清單後面接著 `retainModels`；空的或省略的 `models` 清單，改為先播種 `defaultModel`（若有設定），再接 `retainModels`，並以首次出現的順序移除重複 id。 |
| `liveModels?` | `boolean` | 在啟動／同步時擷取即時目錄（預設 `true`）。自訂供應商使用 `${baseUrl}/models`；內建可能使用 registry URL 並過濾。 |
| `selectedModels?` | `string[]` | 探索後的目錄允許清單。非空時僅暴露那些 id；空或省略時暴露所有探索的模型。 |
| `retainModels?` | `string[]` | 即使即時探索遺漏，仍保留在目錄中的 id。它們不需要重複列在 `models` 裡。空或省略維持現有行為。 |
| `modelDisplayNames?` | `Record<string, string>` | 僅用於顯示的持久標籤，以此供應商精確的上游模型 id 為 key。標籤會勝過供應商目錄的中繼資料，在探索重新整理與供應商編輯後仍會存活，且絕不會改變認證、adapter 行為、路由、計費、上游請求建構、路由過的 `provider/model` 選擇器，或上游 wire 模型。key 精確且區分大小寫。未知的模型 id 會被保留，讓暫時消失的模型回來時仍能拿到它的標籤。這個 map 最多接受 2,000 個項目，與探索上限一致。 |
| `contextWindow?` | `number` | 當上游中繼資料缺席時的供應商範圍 context 後備；否則是一個仍保留較小即時中繼資料的上限。Models 儀表板會把它與 `providerContextCaps` 分開顯示。 |
| `modelContextWindows?` | `Record<string, number>` | Per-model context 後備／上限。這些會覆寫 `contextWindow`：未知的視窗使用設定值，而較小的即時中繼資料仍具權威性。 |
| `modelInputModalities?` | `Record<string, string[]>` | Per-model 輸入提示，如 `["text"]` 或 `["text", "image"]`。 |
| `modelMaxInputTokens?` | `Record<string, number>` | 用於目錄自動壓縮提示的正數 per-model max input 限制。 |
| `modelAutoCompactTokenLimits?` | `Record<string, number>` | Per-model 正安全整數型 soft 自動壓縮預算。此值只能降低「context 或 max input 的 90%」這個有效上限；沒有已知的權威 context window 時不會輸出。對 canonical `openai` 而言，key 必須是受支援的精確 native model ID，且不得含 provider 或 account-selector 前綴。Provider PATCH 會合併項目；將單一 key 設為 `null` 會刪除該 key，將整個欄位設為 `null` 會清空 map。這些 `null` tombstone 僅供 PATCH 使用。 |
| `defaultMaxOutputTokens?` | `number` | 當客戶端省略 `max_output_tokens` 時的供應商範圍 `openai-chat` 後備。 |
| `modelMaxOutputTokens?` | `Record<string, number>` | 正數 per-model `openai-chat` 後援預算；精確／模式比對勝過供應商預設。 |
| `modelCosts?` | `Record<string, Cost4>` | Per-model 顯示價格（每百萬 token 的美元），以該供應商精確的上游模型 id 為 key——不是供應商識別碼或路由過的 `provider/model` 標籤，例如 `{ "deepseek-v4-flash": { "input": 0.14, "output": 0.28, "cacheRead": 0.0028, "cacheWrite": 0 } }`。任何模型 id 都是合法的 key——自訂供應商可以透過 `openai-chat` adapter 指向任何 OpenAI 相容端點，本機或內部供應商 id 即使不在內建目錄中也能運作。使用者設定的價格會在 Logs 的 `~$` 與 Usage 估算中勝過內建目錄；歷史項目會依目前的覆寫重新計價，所以編輯一個價格可能會改變過去的總計。後備順序為使用者 `modelCosts` → 精確的官方修正 → jawcode 目錄 → 預期價格覆寫 → model 層級的供應商後備，明確設定全零的使用者項目代表一個已知為零的估算值；刪除該模型項目可恢復自動定價。全零的目錄中繼資料仍會繼續往下退。每個費率必須是介於 0 到 1,000,000（每百萬 token 美元）之間的非負有限數；超出範圍的列會被管理邊界拒絕，並在載入時被捨棄。僅用於顯示時的估算：覆寫絕不會影響路由、帳號選擇、配額或計費。 |
| `headers?` | `Record<string, string>` | 額外上游標頭。Authorization、cookie、API-key 標頭、內嵌換行與無效名稱被拒絕。 |
| `openRouterRouting?` | `OpenRouterProviderRouting` | 預設 OpenRouter `order`、`only` 與 `allowFallbacks` 偏好；僅對規範 OpenRouter 搭配 `openai-chat` 有效。 |
| `modelOpenRouterRouting?` | `Record<string, OpenRouterProviderRouting>` | 取代供應商範圍 OpenRouter 偏好的精確 model-id 覆寫。 |
| `vercelGatewayRouting?` | `VercelGatewayRouting` | 預設 Vercel AI Gateway `order`、`only` 與 `sort`（`"cost"` \| `"ttft"` \| `"tps"`）偏好；僅對規範 Vercel AI Gateway 搭配 `openai-chat` 有效。 |
| `modelVercelGatewayRouting?` | `Record<string, VercelGatewayRouting>` | 取代供應商範圍 Vercel AI Gateway 偏好的精確 model-id 覆寫。 |
| `authMode?` | `"key" \| "forward" \| "oauth" \| "local"` | 認證模式（預設 `key`）。OAuth／訂閱憑證儲存在 `config.json` 之外；`local` 僅限其 registry 項目允許的供應商。 |
| `codexAccountMode?` | `"pool" \| "direct"` | 僅規範 `openai`；預設為池。Direct 繞過池狀態。 |
| `refreshPolicy?` | `"proactive" \| "lazy-only" \| "disabled"` | 覆寫此 OAuth 供應商的 Token Guardian 政策。 |
| `reasoningEfforts?` | `string[]` | 供應商範圍的 Codex reasoning 標籤，用於廣告與發送。對 `google` adapter 的供應商而言，設定的階梯還會宣告 `thinkingLevel` 能力：direct 與 Vertex 的非影像請求會把選定的 effort 以 `generationConfig.thinkingConfig.thinkingLevel` 送出，Cloud Code Assist 則使用它專屬的封套路徑。 |
| `modelReasoningEfforts?` | `Record<string, string[]>` | Per-model 標籤。空清單會隱藏 effort 控制。與 `reasoningEfforts` 相同，每個設定的 `google` adapter 階梯都會宣告 `thinkingLevel` 能力；direct 與 Vertex 的非影像請求使用扁平的 Gemini 路徑，Cloud Code Assist 則在它的請求封套下送出。 |
| `modelSupportsReasoningSummaries?` | `Record<string, boolean>` | 將模型設為 `false` 以停止廣告摘要並剝離 summary-delivery 欄位。 |
| `modelReasoningSummaryDelivery?` | `Record<string, "sequential" \| "sequential_cutoff" \| "concurrent" \| "concurrent_cutoff">` | Per-model Responses delivery 列舉；重寫既有的 delivery 欄位。 |
| `modelAdapters?` | `Record<string, string>` | 混合 wire 閘道的 per-model `openai-chat` 或 `openai-responses` wire 覆寫。明確項目勝過登錄檔預設。OpenCode Go 預設為 `gpt-5.6-luna` 選擇 Responses，同時讓其他手足模型留在各自文件記載的 wire 上；DeepSeek 可以為 `deepseek-v4-flash` 選擇原生 Responses；GitHub Copilot 為以下模型宣告只用 Responses 的預設（`gpt-5.3-codex`、`gpt-5.4`、`gpt-5.4-mini`、`gpt-5.5`、`gpt-5.6-luna`、`gpt-5.6-sol`、`gpt-5.6-terra`、`gpt-6-astra`、`grok-4.5`、`grok-4.6`、`mai-code-1.1-flash`、`mai-code-1-flash-picker`），因為這些模型會拒絕代理流量的 `/chat/completions`。沒有內建預設的模型（例如 `gpt-5.4-nano`）可以在這裡選擇加入。單一 wire 的上游釘選與規範 ChatGPT forward 會拒絕覆寫。 |
| xAI Chat Completions（儀表板／CLI） | 開關 | Grok 4.5/4.6 的 OAuth Responses 請求預設為 Responses。既有的 Chat 覆寫會在升級時遷移一次；之後的 Chat 選擇會被保留。開啟會讓兩個模型都選 Chat，關閉則選 Responses。CLI：`ocx provider edit xai --xai-chat on` 或 `--xai-chat off`（需要 proxy 正在執行）。Mixed 表示目前只有一個模型使用 Chat。其他覆寫與分層政策不變。API-key 與轉譯後的 Chat／Anthropic 預設不變。 |
| `xaiResponsesXSearch?` | `boolean` | 預設停用。在 xAI Responses 目的地上，僅當即時 `web_search` 工具通過最終請求正規化後仍保留時，才附加由供應商託管的 `x_search` 宣告。既有宣告不會重複，呼叫端的 `tool_choice`／`allowed_tools` 選擇器絕不會擴大，且此設定與網頁搜尋輔助服務的 `search.xSearch` 選項分開。 |
| `modelPreferHostedTools?` | `Record<string,string[]>` | 針對保留一個託管工具命名空間的非 forward Responses 閘道，精確模型的選擇加入。目前只接受 `["image_generation"]`；相符的模型必須使用 `openai-responses` wire 並支援那個託管工具。它會移除衝突的客戶端 `image_gen` 宣告，並重寫它們的選擇器以保留呼叫端的工具選擇。對於 OpenAI API 的虛擬 `-pro` 模型，會先比對選定的公開 ID，再以解析後的基礎 wire-model ID 作為後備。`modelAdapters` 會先解析公開 ID，再解析基礎 ID；第二次解析決定最終的 wire。其他模型保留一般的別名行為。 |
| `annotateEmptyToolOutputs?` | `boolean` | 在工具結果送達模型前，將已存在但為空的結果替換成簡短標記，使空白結果不會被解讀為遺漏的結果。適用於空白字串及僅含文字部分的陣列；影像、檔案及加密部分絕不會被更動。DeepSeek 透過內建登錄檔預設為 `true`，其他情況則不設定。設為 `false` 可讓供應商停用此功能；後續編輯即使省略此欄位，也會保留明確設定的 `false`。`PATCH /api/providers?name=<provider>` 接受 `true`、`false` 或 `null`；`null` 會清除覆寫並恢復使用登錄檔的預設行為。 |
| `reasoningEffortMap?` | `Record<string, string>` | 供應商範圍的 reasoning 標籤 wire 別名。把標籤對應到 `"__omit__"` 可以在上游請求中完全省略推理欄位：OpenAI 相容 wire 上是 `reasoning_effort`，在 Ollama 原生 adapter 上則是 Ollama 原生的 `think` 欄位（#2356）。 |
| `modelReasoningEffortMap?` | `Record<string, Record<string, string>>` | Per-model 的 reasoning 標籤 wire 別名。把標籤對應到 `"__omit__"` 可以在上游請求中完全省略推理欄位。 |
| `reasoningWireFormat?` | `"gateway-object"` | 針對接受 `reasoning: { enabled, effort }` 而非 `reasoning_effort` 的 OpenAI 相容閘道。ClinePass 預設會自動設定這個值。 |
| `noReasoningModels?` | `string[]` | 拒絕 reasoning/thinking 參數的模型。 |
| `noTemperatureModels?` | `string[]` | 拒絕呼叫者指定 `temperature` 的模型。 |
| `noTopPModels?` | `string[]` | 拒絕呼叫者指定 `top_p` 的模型。 |
| `noPenaltyModels?` | `string[]` | 拒絕 presence/frequency penalty 的模型。 |
| `noStructuredOutputModels?` | `string[]` | 其 `openai-chat` 端點拒絕 `response_format` 的精確模型 ID。僅精確符合的請求模型會省略該欄位；structured-output 轉譯對其他每個 `openai-chat` 模型保持啟用。 |
| `noJsonSchemaModels?` | `string[]` | 其 `openai-chat` 端點拒絕 `json_schema` 形式但仍接受 `json_object` 的精確模型 ID。這類請求會降級為 `json_object` 而非被丟棄，因此要求 JSON 的呼叫端仍會拿到 JSON。同一模型同時列在兩份清單時，以 `noStructuredOutputModels` 為準。`opencode go`、`opencode zen`、`opencode free` 預設已為其 DeepSeek 路由內建。 |
| `omitReasoningEffortWithToolsModels?` | `string[]` | 精確的 `openai-chat` 模型 ID，這些模型在一般回合中接受 reasoning-effort 欄位，但一旦出現 function 工具就會拒絕它。模型保留其廣告的 effort 階梯；OpenCodex 只在帶工具的請求上省略這個 wire 欄位，其餘則套用上游預設值。比 `noReasoningModels` 更窄——後者會從每一個請求剝除 reasoning，讓模型整個失去 picker。 |
| `parallelToolCalls?` | `boolean` | 切換平行工具呼叫。OpenAI Chat 預設開啟；非 chat adapter 僅在明確 `true` 時廣告。 |
| `terminalContinuationGuard?` | `boolean` | 為 `openai-chat` 供應商選擇加入：當一個可執行的回合宣告要做的工作，卻乾淨地在沒有工具呼叫的情況下停止時，進行一次有界的內部再詢問。預設 `false`；明確的 `false` 與省略行為相同。組合嘗試與路由過的壓縮回合不在此列，非 `openai-chat` 的 adapter 會忽略這個選項。 |
| `responsesItemIdRepair?` | `{ message?: string[]; reasoning?: string[]; repairMissingTerminalIds?: boolean; repairInvalidIds?: boolean }` | 預設停用的下游 SSE 修復，用於精確佔位 id、缺失的終端 id，以及（搭配 `repairInvalidIds`）缺少規範 `msg_`／`rs_` 前綴的 message／reasoning id。Function-call id 絕不會被重寫。內建的 DeepSeek 預設啟用最後兩項。 |
| `responsesSnapshotRepair?` | `boolean` | 預設停用、面向客戶端的修復，用於 SSE 與 JSON 中稀疏的 Responses 生命週期快照。會補上缺失的規範狀態、輸出與工具中繼資料，而原始檢視與持久化保持不變。 |
| `webSearchBridge?` | `{ enabled?: boolean; backend?: "ollama" \| "openai" \| "anthropic" \| "xai" \| "gemini" \| "exa"; maxSearches?: number; timeoutMs?: number; endpoint?: string }` | 僅限 key-auth 的 `openai-responses` passthrough 供應商。預設關閉。Codex 一律宣告託管的 `web_search` 工具，passthrough 會在假設目的地會執行它的前提下轉送它。不執行託管搜尋的閘道，會回應一個叫做 `web_search` 的 `function_call`，但沒有東西真的會執行它，於是未宣告工具防護就會結束該回合。設定 `enabled: true` 與明確的 `backend` 後，OpenCodex 會攔截那次呼叫、自行執行搜尋、把結果餵回同一個上游，並向 Codex 顯示一個託管的 `web_search_call` 儲存格。在 `authMode: "forward"`（ChatGPT 本身已會搜尋）或在上游本身就會執行託管搜尋的供應商上，這個機制絕不會被啟動。`backend` 是必填；沒有隱含的預設值，指名 backend 缺少憑證時會讓橋接保持未啟動，而不是退到另一個要收費的搜尋服務。`ollama` 會重用此供應商自己的 API 金鑰，對 `POST <origin>/api/web_search` 發送，所以 origin 必須是 `https://ollama.com`，除非維運方明確指名 `endpoint`。`openai` / `anthropic` / `xai` / `gemini` / `exa` 會重用對應的 sidecar 執行器與該執行器自己的憑證（Exa 用 `webSearchSidecar.exaApiKey`）。搜尋模型只有在 `webSearchSidecar.backend` 解析為與這個橋接所指名相同的 backend 時，才會取自 `webSearchSidecar.model`；否則橋接會執行該 backend 自己的預設值，因為為某個廠商挑選的模型會被另一個廠商拒絕。未設定的 `webSearchSidecar.backend` 會解析為 `openai`，所以一個未設定 backend 的模型只會到達 `openai` 橋接，不會到別處。沒有針對個別供應商的橋接模型覆寫。僅限串流回合。一個混合了 `web_search` 與另一個客戶端工具呼叫的回合仍會 fail closed，而不是丟掉客戶端的呼叫。像 XML 風格的 `<web_search>` 這類助理文字不會被執行。預設值：`maxSearches: 3`（1..10）、`timeoutMs: 60000`（1000..600000）。 |
| `retryOn429?` | `{ enabled?: boolean; attempts?: number; intervalMs?: number; maxIntervalMs?: number; respectRetryAfter?: boolean }` | 僅限 API-key 供應商（`authMode: "key"`）。選擇加入的同目標 429 重試：省略 `retryOn429` 時此功能關閉；有這個物件存在即啟用，除非 `enabled: false`。收到 429 時，代理會等待（上游的 `Retry-After` 或固定間隔），並在任何金鑰容錯移轉之前，用同一把金鑰重播一模一樣的請求——涵蓋主要文字回合復原迴圈、Responses passthrough wire、影像／影片橋接、網頁搜尋 sidecar，以及終止延續。只有串流開始前的 HTTP 429 回應才符合重播資格；自訂的 `runTurn` 傳輸不在 HTTP 重試迴圈範圍內。`attempts` 計算第一次 429 之後的同金鑰重播次數（總傳送次數 = `attempts` + 1），是主要復原迴圈、終止防護延續與橋接重試共用的一個請求範圍預算。耗盡 `attempts` 只會停止進一步的同金鑰重播：接著會依可用目標套用正常的金鑰容錯移轉或最終錯誤處理——在 key-auth passthrough wire 上沒有容錯移轉，所以耗盡的 429 會原樣浮現。Codex 本身絕不重試 429，所以這是單一金鑰供應商唯一的防線。預設值：`enabled: true`、`attempts: 3`、`intervalMs: 5000`、`maxIntervalMs: 60000`（任何單次等待都以 `maxIntervalMs` 為上限，其本身上限為 600000）、`respectRetryAfter: true`。 |
| `transientRetryOn5xx?` | `{ enabled?: boolean; attempts?: number }` | 僅限 key-auth 的 `openai-chat` 供應商。選擇性重試串流開始前的暫時性上游狀態（500、502、503、504、520、521、522）：省略時代表停用；只要有這個物件即啟用，除非 `enabled: false`。涵蓋初始的 Responses 請求、終止防護延續，以及原生 `/v1/chat/completions`。`attempts` 是單一請求允許送往上游的總次數，包含第一次（1..10，預設 3）——這是與連線重設復原共用的單一預算，所以 `3` 代表最多只有三個真實請求會送達供應商。等待採固定 400 毫秒、上限 5 秒的指數退避，並遵循 `Retry-After`。獨立於處理速率限制的 `retryOn429`；串流中途的失敗絕不會被重播。 |
| `autoToolChoiceOnlyModels?` | `string[]` | 其 `tool_choice` 僅接受 `auto` 或 `none` 的模型；強制選擇被降級。 |
| `preserveReasoningContentModels?` | `string[]` | 需要在 chat 歷史中保留先前 assistant `reasoning_content` 的模型。 |
| `reasoningDetailsModels?` | `string[]` | 以結構化 `reasoning_details` 陣列回傳思考內容的模型（啟用 `reasoning_split` 的 MiniMax M 系列）；串流增量為累積快照，以前綴差分處理，保留的推理以 `reasoning_details` 陣列而非 `reasoning_content` 字串重播。 |
| `requiresReasoningPlaceholderModels?` | `string[]` | 上游會拒絕缺少 `reasoning_content` 的 tool_call 延續的模型（DeepSeek 思考模式）；重播快取未命中時會注入一個最小佔位。預設為 `preserveReasoningContentModels`；設為 `[]` 可選擇退出。 |
| `showThinkingSummary?` | `boolean` | 當 Responses 客戶端省略 `reasoning.summary` 時，顯示供應商自撰的摘要。明確的 wire `"none"` 會勝出；把偏好序列化成省略的客戶端無法被區分。原始推理內容仍是內容本身，絕不會被重新標記為摘要。`google-antigravity` 預設值為 `true`；明確的 `false` 會停用這個預設。啟用顯示時，CCA Gemini 請求也會選擇加入 `generationConfig.thinkingConfig.includeThoughts`；影像、Claude 與 gpt-oss 請求則不會。這不會改變客戶端設定或全域目錄摘要預設值。 |
| `thinkingToggleModels?` | `string[]` | 使用 `thinking.enabled` 而非 effort 階梯的 chat 模型。 |
| `thinkingBudgetModels?` | `string[]` | 使用整數 `thinking_budget` 的 chat 模型；effort 映射為預算比例。 |
| `noVisionModels?` | `string[]` | 透過視覺 sidecar 發送的純文字模型；比對容忍 Ollama `:size` 標籤。 |
| `escapeBuiltinToolNames?` | `boolean` | 為 Anthropic 相容閘道轉義內建工具名稱，並在回傳的呼叫中還原它們。 |
| `anthropicEofTolerance?` | `boolean` | 讓 Anthropic 相容閘道在 `message_stop` 之前結束的串流也能完成，但僅限於已收到可見文字或一個完整 JSON 物件工具輸入的情況。預設關閉。 |
| `googleMode?` | `"ai-studio" \| "vertex" \| "cloud-code-assist"` | Google 傳輸／認證模式。預設 `ai-studio`。 |
| `directGeminiWireRenames?` | `boolean` | 僅限 Google。只適用於直接的 AI Studio 請求。省略或 `true` 會保留 Gemini Flash id 的 `-tiered` wire 重命名（`gemini-3.7-flash` -> `gemini-3.7-flash-tiered`）；`false` 會把請求的裸 id 原樣送到 wire。Vertex 保留請求的模型 ID，Cloud Code Assist 路由不變。當設定的上游仍服務裸 id 時，請設為 `false`。 |
| `project?` | `string` | Vertex 或 Antigravity Cloud Code Assist 專案 id。 |
| — | — | Antigravity 帳號配額探測（`retrieveUserQuota` 與 `retrieveUserQuotaSummary`）一律透過釘選的出站傳輸，前往 Google 自己的 Cloud Code 主機，無論設定的 `baseUrl` 為何；帳號 bearer 絕不會送到維運方設定的端點，重新導向會中止探測。只有模型清單後備仍會遵循 `baseUrl`。 |
| `location?` | `string` | Vertex 位置；環境後備為 `GOOGLE_CLOUD_LOCATION`。 |
| `mcpServers?` | `Record<string, CursorMcpServerConfig>` | 僅 Cursor：stdio 或 Streamable HTTP MCP 伺服器。 |
| `desktopExecutor?` | `DesktopExecutorConfig` | 僅 Cursor：外部 computer-use 與 record-screen 指令。 |
| `unsafeAllowNativeLocalExec?` | `boolean` | Cursor 舊版布林值，僅在較新欄位未設定時等同於 `nativeLocalExec: "on"`。 |
| `nativeLocalExec?` | `"off" \| "codex-sandbox" \| "on"` | Cursor 本機執行政策。`off` 為預設；`codex-sandbox` 目前像 `off` 般 fail closed。 |

啟用 `webSearchBridge` 後，搜尋延續會一直綁定在服務第一個請求的 API-key 選擇上。在搜尋或供應商
節流期間，變更所選金鑰、它的參考或解析值、認證模式或 base URL，都會在送出下一個供應商請求之前，
以橋接錯誤結束該回合。切換離開又切回來同樣會結束那次延續。要使用新的選擇，請開始一個新回合。在
第一次供應商傳送之前變更選擇，仍保留正常的重新選擇行為。

自訂模型的 `reasoningEfforts` 通常會覆寫探索到的供應商中繼資料。有界的例外是：當一個明確的自訂
列，其模型 id 帶有釘選的原生 Codex 能力（包括在任意閘道上的 Astra 或 Daybreak）時，它廣告的清單
會與該模型釘選的原生能力取交集。完整的原生身分仍需要規範的 `openai` Codex-forward 目的地。明確
設為空清單時仍維持空清單，不套用預設值；非空但不相容的清單會退回原生預設值作為唯一選項。預設值
必須屬於最終清單。這改變的是目錄投影，不是儲存的設定。見[自訂原生目錄範例](/zh-tw/guides/codex-app-models/)。

### 手動釘選的 reasoning effort

在既有供應商上設定 `pinnedReasoningEffort` 可覆寫傳入的 effort 選擇，或對個別上游模型 ID 使用
`modelPinnedReasoningEfforts`。Per-model 的供應商釘選勝過供應商範圍的釘選；根層級的
`modelPinnedEfforts` map 是後備。這些是維運方設定，不是供應商登錄檔預設值。它們不會改變模型探索
或廣告的 effort 階梯。

```json
{
  "pinnedReasoningEffort": "high",
  "modelPinnedReasoningEfforts": {
    "example-model": "max"
  }
}
```

把這些欄位合併進既有的供應商列。接受的值為 `none`、`minimal`、`low`、`medium`、`high`、`xhigh`、
`max` 與 `ultra`。**`none` 會移除明確的 effort 欄位**；它會使用供應商的預設行為，且不保證推理會
被停用。適用的 effort 上限在釘選之後仍會執行，供應商的 wire 映射／正規化可能會降低或省略一個不
受支援的值。`ultra` 在到達上游 wire 之前會先被正規化。壓縮維護請求不受釘選影響。

`PATCH /api/providers?name=<provider>` 接受這些欄位。省略某欄位可保留它；用 `null` 可清除一個
純量或整個 map。將 map 項目設為 `null` 或 `""` 會移除該項目，同時保留其他項目。格式錯誤的寫入會
在儲存前被拒絕。手動編輯檔案中格式錯誤的選用釘選會在載入時被忽略，不會捨棄設定的其餘部分。

### 自動審查（核准）模型選擇

Codex 會從目前回合模型的目錄列讀取 `auto_review_model_override`，以選擇審查核准請求的模型。
`$CODEX_HOME/config.toml` 根層級的 `auto_review_model` 設定會為每一個目錄列套用同一個審查者；
下面這些供應商範圍的欄位會針對個別供應商覆寫它。[供應商指南](/zh-tw/guides/providers/#approval-reviewer-per-provider)
有維運方的操作流程與一個實作範例。

`autoReviewModel` 是供應商範圍的審查目標。值可以是同一供應商的裸模型 id（目錄列會被正規化為
`provider/model` slug），或是完整的公開目錄 slug，例如 `opencode-go/deepseek-v4-flash`。裸值會
先對照該供應商的列，再對照裸目錄列——這也是像 `gpt-5.6-terra` 這樣的原生模型的命名方式；落在
供應商之外的裸值會印出一則附註，指名實際提供審查者的那一列；兩者都不相符的值則維持未解析。
`autoReviewModelOverrides` 的 key 是該供應商精確的上游模型 id，或該供應商公開的別名
（`modelAliases`）；兩種拼法都指向同一個路由列，其 slug 帶有上游 id。對自己的模型而言，一個項目
會勝過供應商範圍的值。供應商戳記會勝過根選擇器在自己路由列上的效力，根選擇器仍是原生列與沒有
供應商戳記的路由列的後備。移除一個供應商選擇器只會清除該供應商的戳記；移除根選擇器絕不會清除
供應商戳記。包含斜線的模型 id 可以用原始寫法或編碼後的目錄形式書寫；兩種拼法都會解析到同一個
路由列。模型 key 保留大小寫。

選擇器會在每次同步時各自獨立地對照最終目錄解析，並各自獨立地 fail closed：未解析的
`autoReviewModel` 會發出診斷訊息，不為任何供應商範圍的列戳記；未解析的 `autoReviewModelOverrides`
項目會發出診斷訊息，不為該模型戳記覆寫，因此一個有效的供應商範圍目標仍會作為後備。任何真正解析
成功的選擇器仍會被套用。沒有供應商戳記的列會保留根選擇器，或在根選擇器未設定時採用一般的上游
自動審查行為。規範的 `openai` 供應商不接受這些欄位。

移除根選擇器會清除每一列上的根戳記，包括更早期版本、早於 OpenCodex 溯源標記出現之前就已戳記的
原生列。這項清理靠形狀辨認舊版戳記——整個目錄中只有一個值，而且一個路由列也帶有同樣的值——所以
一個真正符合該形狀的 per-row 值也會一併被清除，若某個目錄已經偏離那個形狀，就需要手動同步一次。
供應商戳記絕不會被根層級移除動作影響。

`PATCH /api/providers?name=<provider>` 接受這兩個欄位。用 `null` 可清除純量或整個 map；用值為
`null` 或 `""` 的 map 項目可移除該模型，同時保留其他項目。不相關的供應商儲存動作會保留先前設定
的值。

這些欄位可在 `config.json`、供應商管理 API 與儀表板的原始 JSON 供應商編輯器中使用。沒有專屬的
表單控制項。原生的根戳記會記錄先前的值，並在該戳記值未被外部改動時，於移除時恢復它。

### 探索到的模型顯示名稱

當供應商回傳機器友善的 id，但 Codex 模型 picker 需要更短的標籤時，使用 `modelDisplayNames`。這個
map 屬於單一供應商，所以同一個模型 id 在不同供應商下可以有不同的標籤。把這個欄位加到 `config.json`
中既有的供應商列，並保留其他所有供應商設定。以下範例包含周邊必要欄位以提供脈絡：

```json
{
  "providers": {
    "xai": {
      "adapter": "openai-chat",
      "baseUrl": "https://api.x.ai/v1",
      "modelDisplayNames": {
        "grok-4.6": "Grok 4.6"
      }
    }
  }
}
```

本機 Codex 目錄中支援的裸原生 GPT 列，也接受 `providers.openai.modelDisplayNames` 中的精確標籤，
例如 `"gpt-6-astra": "GPT 6 Astra"`。啟動時的同步與本機目錄收斂都會重新套用這些標籤。移除一個
標籤，只有在該列的顯示名稱仍與已套用的覆寫相符時，才會恢復原本的原生名稱。較新的外部顯示名稱會
依既有的原生中繼資料正規化規則被保留；例如 Astra（`gpt-6-astra`）仍會以它釘選的原生名稱取代一個
未釘選的名稱。標籤覆寫層不會改變模型 ID、中繼資料（包括能力）、順序、路由過的組合別名，以及帳號
限定列。這個本機目錄覆寫不會重新標記 HTTP 模型清單或虛擬 `*-pro` 列。

有效的標籤順序是：維運方的 `modelDisplayNames`，接著是供應商目錄中繼資料，最後才是一般的
`provider/model` 後備。路由選擇器仍是 `xai/grok-4.6`，上游 wire 模型仍是 `grok-4.6`。標籤只影響
顯示，不會改變認證、adapter 行為、路由、計費或上游請求建構。移除一個 map 項目只會重設它的標籤。
管理用的客戶端可以用 `PUT /api/providers/:provider/model-display-names`，搭配內容
`{ "modelId": "grok-4.6", "displayName": "Grok 4.6" }` 來設定或重設一個標籤；送出
`displayName: null` 可重設它。供應商的 `PATCH` 不會編輯這個 map。請使用這個專屬的 `PUT` 端點來
變更或移除標籤。

儀表板在 **Models** 頁面公開同一個持久設定。展開供應商、找到已探索到的模型，然後選擇 **Name**。
對話方塊在你儲存易讀標籤時，會持續顯示精確的 `provider/model` 選擇器。選擇 **Reset name** 可回到
供應商中繼資料，或一般的選擇器後備。**Name** 只改變呈現方式；獨立的別名鉛筆圖示則是改變短路由
別名，不是顯示名稱編輯器。原生 OpenAI 與自訂模型列保留既有的控制項。

若變更已儲存但重新整理失敗，對話方塊會反映已儲存的覆寫值，並持續提供 **Retry**。當伺服器回報
目錄收斂失敗時，Retry 會重新執行目錄收斂；只有清單請求失敗時，則會重新載入清單。重設復原會保留
重設操作，不會還原舊名稱。請求有 60 秒的總期限，涵蓋寫入及其後續的清單重新整理。逾時不會撤銷
寫入：進行下一個變更之前，請使用 **Retry** 檢查目前的名稱。

## Codex 目錄與根層級 `config.toml` 設定

這些設定屬於 `$CODEX_HOME/config.toml` 的根層級，與 `approvals_reviewer` 並列；它們不是供應商
欄位。

| 欄位 | 型別 | 意義 |
| --- | --- | --- |
| `auto_review_model` | `string` | `provider/model` 形式的公開目錄選擇器，例如 `opencode-go/deepseek-v4-flash`。每次目錄合併後，OpenCodex 會對照最終目錄解析它，並把修剪後的值戳記為目錄項目上的 `auto_review_model_override`。邊界空白會被移除，選擇器以斜線分隔的各部分則保持不變。若值缺席或空白，既有的路由覆寫會被清除，並保留一般的上游自動審查選擇。若它語法無效，或不在最終目錄中（包括供應商／模型被移除之後），OpenCodex 只會為覆寫本身 fail closed：清除失效的覆寫、保留一般的上游行為，並發出診斷訊息。稍後同步時重新加入該供應商／模型，會讓已設定的選擇器可以再次被戳記。 |

這項設定會在供應商探索、模型過濾、原生／帳號列投影與合併優先順序之後才被評估，所以只有出現在
該次同步所產生目錄中的選擇器，才能變成一個覆寫。設定被清除或未解析時，原生的上游值會被保留。
持久化的目錄欄位由 Codex 讀取，用於目前回合的模型，這也是為何一個有效、已設定的選擇器會被複製
到每一個適用的項目上。供應商範圍的選擇器（見上文）會先於這個根層級後備套用，並在路由列上勝出。

### FastWire B1 能力遷移

在 FastWire B1 之後，Fast 能力與任意 Chat 呼叫端分層轉送互相獨立。上方「供應商項目
（`OcxProviderConfig`）」小節中的欄位定義仍是權威依據；既有設定會看到以下遷移差異：

1. 一個宣告為 Fast 合格的 Chat 供應商／模型，不再需要 `chatServiceTier: true` 才能取得規範 Fast。
   發布、路由資格與注入仍需要一個合格的政策，以及最終 adapter 上相容的 FastWire 映射。在已分類的
   路由上，`fastMode: false` 仍會移除規範 Fast。當某路由不具備 Fast 能力時，請設定
   `supportsServiceTier: false` 或精確模型的 `false`。
2. 在一個合格的已分類路由上，呼叫端的拼法 `fast` 與 `FAST` 會透過
   `fastWire.canonicalToWire.priority` 正規化；呼叫端的 `priority` 仍是規範值。只有在確認那是上游
   的規範值時，才設定映射到 `fast`。未分類的路由保留它們既有的轉送行為。
3. 精確模型的 `true` 不再授權像 `flex` 或廠商專屬值這類外部 Chat 分層。這些仍需要
   `chatServiceTier: true`；否則會被移除，並記錄為被丟棄的呼叫端分層。

明確的能力 `false`，以及 Responses 呼叫端分層轉送，都保留既有的契約。

### Cursor Fast（`cursor-variant`）

Cursor 沒有 `service_tier` 欄位。它的 Fast 產品是不同的**模型變體**——`claude-opus-5-thinking-high-fast`，
或針對 Grok 的 `{id:"fast",value:"true"}` 請求參數——所以 Cursor 項目宣告
`fastWire.kind: "cursor-variant"`，由請求建構器解析變體，而不是設定一個請求欄位。

只有真正宣告了 Fast 變體的基礎模型才會廣告 Fast：`claude-opus-4-7`、`claude-opus-4-8`、
`claude-opus-5`、`grok-4.5`、`grok-4.6`。其餘每一個 Cursor 列都公開 `supportsServiceTier: false`，
所以 Codex 不會顯示開關，而不是顯示一個沒用的開關。

一個基礎模型的統攝列，會把思考升級路由到它的 **thinking-fast** 變體，而不是普通的 fast 手足模型
——那個手足模型是一個效果階梯較短的不同產品，而對 `claude-opus-5` 來說，它的一般家族在上游被
隔離。

`fastMode` 在不同介面上的行為不同，因為只有 Codex 有自己的 Fast 切換開關：

| 介面 | `fastMode: true` |
|---|---|
| Codex | 列維持統攝列；app 的 Fast 開關選擇變體 |
| Claude Code（`?ids=cli`） | 列出 fast 身分，例如 `claude-ocx-cursor--claude-opus-5-thinking-fast` |
| OpenAI `/v1/models` | 列出 `cursor/claude-opus-5-thinking-fast` |
| Claude Desktop（3P） | 不變——它的別名是從模型名稱雜湊出來的 |
| 儀表板 `/api/models` | 列 id 不變；它們是啟用／停用的 key |

無論哪種方式，請求都會被升級：`fastMode: true` 時，選擇統攝 id 仍會解析到 Fast 變體，所以設定
早於這次切換的客戶端不需要重新探索。每一個舊版變體 id 的路由都維持不變。

### xAI Priority Processing

內建的 `xai` 預設在它的兩種傳輸上都支援 Fast，範圍不同。API-key 模式目標是
`https://api.x.ai/v1`；解析到 `openai-chat` 的路由會透過 Chat Completions 送出
`service_tier: "priority"`，而模型預設值與覆寫也可以改選 `openai-responses` 傳輸。
`ocx login xai` 改為儲存 Grok 訂閱閘道的 OAuth 憑證（`https://cli-chat-proxy.grok.com/v1`；
這些憑證會自動重新整理），該處的 Fast 按模型分類（即時探測於 2026-09-13）：grok-4.6、grok-4.5、
grok-4.3、grok-4.20-0309-reasoning、grok-4.20-0309-non-reasoning、grok-build-0.1 與
grok-composer-2.5-fast 會在 Grok OAuth 上接受 `service_tier: "priority"` 並回顯它，所以這些列
會廣告 Fast、接受 `--fast` 選擇器，並在任一種 wire 上轉送呼叫端送出的分層。
grok-4.20-multi-agent-0309 被排除：該閘道在收到 `priority` 時會回答 `service_tier: "default"`，
所以它維持未分類，呼叫端的分層不會被轉送。未列出的模型在兩種傳輸上都維持未分類。

xAI 對 Priority Processing 收取標準 token 價格 2 倍的費用，涵蓋輸入、輸出、快取與推理 token；
快取折扣會在乘上倍率之前套用。成本估算只有在 xAI 的回應確認 `service_tier: "priority"` 時才會
使用這個溢價。缺席或無法解析的回應分層不算確認，回顯的 `default` 是降級；三種情況都維持標準
價格。

以 `grok-4.6` 為例，每百萬 token 的標準費率是輸入 $2.00、快取輸入 $0.50、輸出 $6.00。至少
200,000 token 的提示會把整個請求重新計價為 $4.00 / $1.00 / $12.00。xAI 尚未公布這個長 context
級距如何與 Priority Processing 疊加。當一個長 context 回應確認了 `priority`，儀表板就會顯示
已公開的長 context 成本，並附上 `≥` 標記與一個下限說明；它絕不會自己發明一個疊加倍率。

### OpenRouter Fast

規範的 `https://openrouter.ai/api/v1` 預設只為以下這些精確、由 OpenAI 支援的模型 slug 廣告 Fast：

- `openai/gpt-5.6-sol`
- `openai/gpt-5.6-terra`
- `openai/gpt-5.6-luna`

`anthropic/claude-sonnet-5` 與未宣告的 OpenRouter 模型維持未分類。供應商層級的
`supportsServiceTier` 預設值刻意缺席，使用者設定的 `supportsServiceTier: false` 仍會停用這些
精確模型宣告。這些登錄檔宣告只在供應商仍指向規範 OpenRouter base URL 時才適用；同名的自訂目的地
不會被假設共享 OpenRouter 的契約。

Fast 會送出 `service_tier: "priority"`。它不會新增或重寫 `provider.only`、`provider.order` 或
`provider.allow_fallbacks`。OpenRouter 的文件記載 priority 端點是第一個路由選擇，priority 容量
不可用時會優雅地退回其他端點。計費依實際使用的端點而定，回應會回報實際的頂層 `service_tier`。
因此釘選分層端點並停用退回，反而會在不提升計費安全性的情況下降低可用性。

請求日誌會以那個回應回顯作為權威依據。`priority` 確認 Fast 已生效；`default` 記錄一次降級，並
使用標準價格估算；缺席的欄位會讓那次嘗試維持假設狀態，而不是猜測一次降級。OpenRouter 的
priority 倍率因上游而異，這裡不會內建。當 priority 已確認，但沒有已知的精確 priority 價格時，
儀表板會保留標準價格估算作為一個有文件記載的下限，並加上 `≥` 前綴；降級的嘗試沒有下限標記。

API-key 供應商可以持有字面值金鑰或環境參考。OAuth 供應商使用由 `ocx login` 填入的憑證存放；
訂閱支援的 Claude Code 啟動行為在 [`claudeCode.authMode`](/zh-tw/reference/configuration/server/#claude-code)
下設定。

OrcaRouter 明確地公開兩種形式：`orcarouter` 是手動 API-key 供應商，`orcarouter-oauth` 執行帶
S256 PKCE 的瀏覽器同意流程，再把回傳的持久 API 金鑰儲存為帳號憑證。公開預設值刻意把認證
（`https://www.orcarouter.ai`）與推論（`https://api.orcarouter.ai/v1`）分開。若要做成單一 origin
的自架部署，請在第一次帳號登入前設定 `ORCAROUTER_BASE_URL`；若要用不同 origin，則使用
`ORCAROUTER_AUTH_BASE_URL` 與 `ORCAROUTER_API_BASE_URL`。對於迴路／私有的自架端點，**在第一次
登入之前**，請建立或更新 `providers["orcarouter-oauth"]`，帶上 `adapter: "openai-chat"`、你要的
`baseUrl`、`authMode: "oauth"`，以及明確的 `allowPrivateNetwork: true`。登入會保留這個維運方設定，
絕不會透過 URL 覆寫來授予它。沒有它時，目的地驗證會拒絕本機端點用於推論與模型探索。OAuth 瀏覽器
回呼監聽器本身不需要這個供應商選擇加入。見 [OrcaRouter 設定範例](/zh-tw/guides/providers/)。

## 供應商診斷對外安全

儀表板連線測試與即時模型探索使用有界的 GET-only 傳輸。在沒有對外代理的情況下，opencodex 解析主機名稱一次並僅連接到該已驗證位址。HTTPS 保留原始 Host、SNI 與憑證驗證；供應商設定無法停用憑證檢查。

當 `HTTP_PROXY`、`HTTPS_PROXY` 或 `ALL_PROXY` 適用時，這些操作保留 Bun 的原生 fetch。URL 與字面位址檢查仍會執行，但代理選擇最終路由、DNS 答案與對等端，因此 opencodex 無法 pin 或驗證該對等端。這是明確的安全限制。

私有／本機目的地需要 `allowPrivateNetwork: true`，且當對外代理活躍時需要相符的 `NO_PROXY` 項目。回送會自動加入；請明確列出每個 LAN 主機，因為 CIDR 項目不被解讀。比對器支援精確主機、網域後綴、可選連接埠、方括號 IPv6 與 `*`；例如，明確列出 `192.168.1.50`。中繼資料與 link-local 目標保持被封鎖。診斷請求拒絕重新導向並回報已剝離憑證的目標。普通供應商請求的重新導向審查與此診斷防護分開。

針對 Clash / Surge / Mihomo 使用者的 fake-IP DNS 例外有兩種，且都只作用於 DNS *回應*——URL 中的字面位址仍會被拒絕。IANA 基準區段 `198.18.0.0/15`（含 IPv4-mapped IPv6 寫法）在該主機適用對外代理時被接受。Mihomo 預設的 IPv6 fake-IP 區段 `fdfe:dcba:9876::/48` 採更嚴格的門檻：必須設定與 URL 協定相符的代理變數（`https:` 對應 `HTTPS_PROXY`，`http:` 對應 `HTTP_PROXY`，`ALL_PROXY` 不算），主機不得命中 `NO_PROXY`，之後請求會被明確綁定到該代理。其他 ULA、相鄰前綴，或與真實私網回應混合的 fake-IP 回應仍需要 `allowPrivateNetwork: true`。提供者儲存時的驗證不套用此 IPv6 例外。

## Codex 帳號池

在儀表板中使用 **Codex Auth** 新增池帳號並重新整理配額。`config.json` 儲存非秘密中繼資料；access 與 refresh token 使用強化的憑證存放。池路由將新／未綁定指派、基於用量的主動切換與失敗復原分開。綁定任務通常保留親和性。預設（`pool.cacheAffinity`）下，該重新綁定會等到綁定帳號耗盡或無法繼續服務，並且只改綁到確有額度餘裕且用量嚴格更低的帳號；所有帳號都高於閾值時，綁定任務留在原帳號。關閉該設定後，`quota` 可在超過用量閾值後的下一個請求時重新綁定它，但仍只改綁到確有額度餘裕且用量嚴格更低的帳號。暫停、冷卻、重新認證與失敗處理可獨立清除或移動路由。未綁定請求沒有即時帳號綁定；這可包含代理重啟或親和性重置後的既有可見任務。Pre-stream 的 429 或 402 在同一個請求中於一個合格的備用帳號上重試一次，即使基於用量的主動切換關閉。帳號變更保留並重播對話 context，但跨帳號的供應商端 prompt-cache 重用不保證，cache 可能需要重新暖機。

在 **401/403** 時，App 登入清除該帳號的行程本地親和性並要求重新認證。
在 **429** 時，opencodex 遵循 `Retry-After`、啟動帳號冷卻、清除親和性，並可能將請求輪換到另一個合格的池帳號。這些失敗轉換在 `autoSwitchThreshold: 0` 時仍然活躍；該設定僅停用基於用量的主動切換。

暫停帳號保留其配額中繼資料，但將其排除於切換、容錯移轉、復原探測與手動啟用。它也清除該帳號的執行緒親和性。進行中的請求保留擷取的憑證；後續回合被重新路由。若每個帳號都被暫停，池路由會失敗而非靜默選擇一個。**Pause exhausted** 會用可用憑證重新整理合格帳號，並僅暫停新確認為 100% 的帳號；未知或失敗的重新整理保持不變。

| 策略 | 行為 |
| --- | --- |
| `quota`（預設） | 若無現用帳號，跨 5 小時、週與 30 天視窗選擇最低用量的合格帳號。否則將合格現用帳號保持在 `autoSwitchThreshold` 以下；在超過閾值後，未綁定請求可移至較低用量的合格帳號。預設下 cache affinity 優先於配額餘裕，綁定任務會保留到帳號耗盡（已知用量 100%）或無法繼續服務，改綁時只前往確有額度餘裕且用量嚴格更低的帳號。關閉該設定後，也可在閾值將綁定任務的下一個請求改綁到確有額度餘裕且用量嚴格更低的帳號。`0` 停用此用量驅動的重新評估，而非失敗復原。 |
| `round-robin` | 在合格帳號間均勻指派未綁定請求。`autoSwitchThreshold` 不變更一般 round-robin 選擇。`accountPoolStickyLimit`（1–100）計數一次選擇上的指派，而非成功的上游回應。 |
| `fill-first` | 將未綁定請求指派到現用帳號直到冷卻、重新認證或設定的排空閾值；未知用量不強制切換。健康的綁定任務保留親和性。 |

輪換不保護免於供應商強制執行；多帳號使用可能違反供應商條款。

### `anthropicAccountPool`（實驗性）

此選擇加入功能池化已儲存在 `auth.json` 中的多個 Anthropic OAuth 帳號。預設關閉且未經實戰考驗。同一組織中的帳號可能共享配額，而自動輪換可能觸發供應商限制。

| Key | 型別 | 預設值 | 說明 |
| --- | --- | --- | --- |
| `anthropicAccountPool.enabled?` | `boolean` | `false` | 啟用 sticky 工作階段親和性與依用量的新工作階段選擇。**429 容錯移轉不由此開關控制**：只要儲存了兩個以上可用帳號就會生效，與其他多憑證供應商一致，且無法關閉。 |
| `anthropicAccountPool.autoSwitchThreshold?` | `number` | `80` | 對新 session 而言，當現用帳號達到此閾值時，會在設定的視窗中選擇已知快取用量最低的帳號；被選中的帳號本身不必達到或超過這個閾值。`0` 只停用**主動**的用量驅動切換——新 session 選擇，以及合格 429 之後的路由復原，仍會參考 `quotaWindow`。 |
| `anthropicAccountPool.strategy?` | `"quota" \| "round-robin" \| "fill-first"` | `"quota"` | 新 session 策略；`quota` 依 `quotaWindow` 指定的視窗為帳號排序，`fill-first` 也在同一視窗中判定其排空閾值。 |
| `anthropicAccountPool.quotaWindow?` | `"five-hour" \| "weekly" \| "max-utilization"` | `"five-hour"` | 用於用量感知帳號選擇的、已快取的供應商回報使用率列。`five-hour` 保留原本行為。`weekly` 為每週列評分，並在仍有其他合格帳號時跳過 5 小時列已耗盡的帳號，但當沒有這樣的帳號時，仍會退回耗盡的候選者。`max-utilization` 為已知的最高列評分，因此在每週用量尚未取得前也能使用 5 小時用量；若兩者都未知，該帳號依未知用量的排序規則處理。只有在選用的 `weekly` 與 `max-utilization` 視窗下，已知用量才會排在未知用量之前；省略或明確設為 `five-hour` 會保留舊有的排序方式。若每個合格帳號都是未知，選擇仍會依合格順序回傳一個。在前述「較低 5 小時優先」的同分判定之後，完全相同時仍保留合格順序。健康、已有 affinity 綁定的 session 不會被主動重新平衡。對於新 session 指派，以及合格 429 替換後的路由復原，`quota` 會直接用這個視窗為合格候選者排序；`fill-first` 會用這個視窗的閾值與耗盡規則，以穩定順序前進；`round-robin` 忽略它。冷卻狀態、容錯移轉上限與重新驗證資格仍是各自獨立的本機狀態。每個帳號的每週列，來自用量探測或觀察到的回應標頭。 |
| `anthropicAccountPool.stickyLimit?` | `number` | `1` | 在一次 round-robin 選擇上保留的成功新 session 綁定。範圍 1–100。 |

啟用時，429 會記錄一次冷卻，並可能在請求內輪換。冷卻時間來自一個可用的 `Retry-After`，否則來自 Anthropic 回報為 `rejected` 的速率限制視窗（包括週視窗）中，最新的有效重設時間。有效的上游期限不會被縮短到一個固定的冷卻上限；非有限或無法表示的期限會被忽略。若拒絕沒有可用的期限，會退回 60 秒的預設 backoff。親和性是行程本地且有界的。憑證 401/403 會把該帳號標記為需要重新認證。若所有合格帳號都在冷卻，客戶端會收到附帶已知 `Retry-After` 的 429，而不是認證錯誤。

Anthropic 的回應也會回報服務端帳號的 5 小時與每週使用率，一則回應帶有這兩者中的哪一個，就會記錄在該帳號上——兩個視窗各自獨立，無論是拒絕還是成功的回應都會記錄。因此用量感知選擇可以直接從你實際使用的帳號運作，不必等儀表板的 Providers 頁面去輪詢它們。這些讀數會刷新既有的列，而不是取代它，所以只有 usage 端點才會回報的、model-scoped 的每週列，會在其已知重設時間之前被保留。過期的量測值會變成未知，包括被後續標頭省略的既有標準視窗。一個只帶重設時間的標頭無法延長一個較舊的使用率量測值。沒有已知重設時間的值維持既有行為；缺席的量測值絕不會被替換成零用量。

標頭觀測不會延後用量探測，也不會清除一次失敗探測的不可用狀態。重新啟動後，快取的 Anthropic 觀測值仍然可用，同時下一次配額讀取會再次探測，因為儲存的觀測值不包含探測時鐘。

:::caution[實驗性]
除非你了解 Anthropic 帳號政策風險，否則保持停用。不確定時偏好手動 `ocx account use anthropic <id>` 切換。
:::

### `oauthAccountFailover`

當某個沒有自己帳號池的 OAuth 供應商——xAI、Cursor、Kimi、GitHub Copilot、Google Antigravity 與 Nous——其中一個帳號被限流時，輪替到同一供應商的另一個已登入帳號。

**登入第二個帳號就是啟用這個功能的開關，而且沒有任何東西能關掉它。** 只要這些供應商中任何一個儲存了 2 個以上、未被標記需要重新認證的帳號，輪換就會啟動——與 `apiKeyPool` 已經套用在 2 個以上金鑰池上的規則相同。只有一個已儲存帳號的供應商行為與先前完全相同。

這裡的輪換只會在上游**已經拒絕**該請求之後才執行，所以一個停用開關能提供的唯一選擇，是在「重試你刻意登入的第二個帳號」與「讓那個帳號閒置、回傳 429」之間二選一。拒絕輪換的表達方式就是不儲存第二個帳號。

| Key | 型別 | 預設值 | 說明 |
| --- | --- | --- | --- |
| `oauthAccountFailover.enabled?` | `boolean` | 依存在與否決定 | 僅針對**派送前的帳號偏好**的全域覆寫。`false` 會停止把健康的請求導向已知餘裕較多的帳號。它**不會**停用 429 輪換。 |
| `providers.<name>.oauthAccountFailover.enabled?` | `boolean` | 繼承 | 針對同一個偏好的個別供應商覆寫；無論方向都會勝過全域設定。即使全域設定為 `true`，`false` 也會讓這個供應商拒絕這個偏好；即使全域設定為 `false`，`true` 也會讓這個供應商選擇加入。無論哪種情況，反應式 429 輪換都不受影響。 |
| `providers.<name>.oauthAccountFailover.strategy?` | `"quota" \| "round-robin" \| "fill-first"` | — | 通用 OAuth 供應商的池策略（#695）。透過 `ocx account strategy <provider> <name>` 或 `PUT /api/oauth/accounts/pool` 持久化。只有在 `pool.kernel` 開啟時，選擇器才會依它運作；旗標關閉時，省略與設定行為相同。`quota` 無論哪種情況都是 kernel 之前的行為。 |
| `providers.<name>.oauthAccountFailover.autoSwitchThreshold?` | `number` | `80` | `fill-first` 離開現用帳號時所用的用量百分比（0–100）（#695）。用 `ocx account auto-switch <provider> threshold <n>` 設定。只有在 `pool.kernel` 開啟且 `strategy: "fill-first"` 時才會被讀取；沒有量測用量的帳號視為低於閾值。 |
| `providers.<name>.oauthAccountFailover.stickyLimit?` | `number` | `1` | 在一次 `round-robin` 選擇上保留的成功派送次數，1–100（#695）。只有在 `pool.kernel` 開啟且 `strategy: "round-robin"` 時才會被讀取。 |

若要為某個你不想測試其條款的供應商拒絕主動帳號導向，同時仍要從限流中復原：

```json
{
  "providers": {
    "cursor": {
      "oauthAccountFailover": { "enabled": false }
    }
  }
}
```

這個設定在登入、新增帳號與重新認證之後仍會存活。

通用 OAuth 供應商（Google Antigravity、xAI、Cursor、Kimi、GitHub Copilot、Nous，以及任何在 Codex 與 Anthropic 池之外的 OAuth 供應商）在同一個 key 下也接受 `strategy` 與 `autoSwitchThreshold`，透過 `GET`／`PUT /api/oauth/accounts/pool?provider=<name>`，以及 `ocx account strategy` / `ocx account auto-switch` / `ocx account sticky` 這些動詞。回應只對這三個欄位帶上 `"inert"`——它們被儲存但未被消費時為 `true`，一旦 `pool.kernel` 開啟且它們真的在選擇帳號時為 `false`——`enabled` 是即時生效的，管理派送前的偏好。`quotaWindow` 不屬於這個通用契約。Codex（`/api/codex-auth`）與 Anthropic（`anthropicAccountPool`）維持各自不變的契約。

刻意比 `anthropicAccountPool` 更窄：沒有 session 親和性、沒有依配額排序的選擇、沒有探測租約。它只回答一個問題——剛剛回傳 429 的那個帳號正在冷卻，還有沒有另一個可用的。

Codex 池與 Anthropic 池被排除在外，維持各自的輪換；啟用這個功能對它們沒有任何改變。只有一個已儲存帳號的供應商是徹底的 no-op，也不會為它記錄任何冷卻。

在 429 時，失敗的帳號會用 `Retry-After`（若存在，上限 15 分鐘）或一個預設 backoff 來冷卻，請求會在下一個合格帳號上重播，每個請求最多輪換三次。被標記需要重新認證的帳號絕不會被選中。冷卻是行程本地的，所以重新啟動會遺忘它們。

輪換會攜帶替代帳號的**完整**憑證快照，而不只是它的 bearer，所以一個把路由中繼資料與 token 配對的供應商——例如 Antigravity 的 Cloud Code Assist 專案 id——不會發生用一個帳號的 token 配上另一個帳號中繼資料的情況。

目前的範圍是一般的 Responses 請求路徑。Cursor 以 adapter 事件而非 HTTP 狀態回報速率限制，獨立的 Antigravity 影像端點有自己的請求路徑；兩者目前都還不會輪換。

:::caution[實驗性]
跨訂閱帳號輪換會消耗第二個帳號的配額，可能違反部分供應商的條款。若這不是你想要的取捨，請全域或針對特定供應商設定 `enabled: false`。
:::

### 受管記錄結構

`apiKeys[]` 項目包含 `id`、`name`、生成的 `key` 與 ISO `createdAt` 字串。
`codexAccounts[]` 項目需要 `id`、`email` 與 `isMain`，可選 `plan`、
`chatgptAccountId` 與隱私安全的 `logLabel`。這些記錄通常由儀表板管理。

### `tokenGuardian`（`OcxTokenGuardianConfig`）

| 欄位 | 型別 | 預設值 | 意義 |
| --- | --- | --- | --- |
| `enabled?` | `boolean` | `false` | 全域主動重新整理開關。 |
| `tickSeconds?` | `number` | `21600` | 掃描間隔（6 小時，最小 60 秒）。 |
| `jitterSeconds?` | `number` | `300` | 掃描前的隨機延遲。 |
| `concurrency?` | `number` | `3` | 最大同時重新整理。 |
| `leadSeconds?` | `number` | `900` | 超過一個 tick 的額外重新整理前置時間。 |
| `failureBackoffBaseSeconds?` | `number` | `300` | 初始暫時性失敗 backoff。 |
| `failureBackoffMaxSeconds?` | `number` | `3600` | Backoff 上限與永久失敗延遲。 |
| `codexWarmupEnabled?` | `boolean` | `false` | 選擇加入合成 Codex 池帳號驗證。 |
| `codexWarmupMaxAgeSeconds?` | `number` | `691200` | 8 天後重新驗證帳號。 |
| `codexWarmupModel?` | `string` | `gpt-5.6-luna` | 用於可選暖機的原生模型。 |

## 固定供應商端點

路由在 adapter 之前解析供應商端點。對於多數內建，registry 端點勝過設定的 `baseUrl`。四種項目類型保留設定的 URL：

- 啟用覆寫的供應商：`ollama`、`vllm`、`lm-studio`、`litellm`、`qwen-cloud` 與
  `alibaba-token-plan-intl`；
- 由使用者填入的 registry 模板，如 `azure-openai` 與 `cloudflare-ai-gateway`；
- 提升的固定 API-key 預設，保留較舊的同名自訂目的地；以及
- 不在 registry 中的供應商。

Adapter 可在之後調整解析的 URL。例如 Kiro 遵循匯入憑證的 API 區域，用於規範 `runtime.{region}.kiro.dev`。請見 [Adapters](/zh-tw/reference/adapters/)。

當路由丟棄 `baseUrl` 時，opencodex 記錄 registry 端點與僅設定的來源；設定的路徑本身可能包含憑證。移除未使用的 URL 或選擇符合預期區域的供應商項目。`alibaba-token-plan` 被 pin 到北京，而
`alibaba-token-plan-intl` 涵蓋國際端點。

對於故障的 `openai-responses` 閘道，修復屬於供應商物件：

```json
{
  "providers": {
    "custom-gateway": {
      "adapter": "openai-responses",
      "baseUrl": "https://gateway.example/v1",
      "apiKey": "${GATEWAY_KEY}",
      "responsesItemIdRepair": {
        "reasoning": ["rs_0"],
        "message": ["msg_0"],
        "repairMissingTerminalIds": true
      }
    }
  }
}
```

佔位清單為精確比對。對於正常／有狀態的 Responses 供應商，將欄位保持未設定，使 passthrough 保持逐位元組相同。

## Cursor 供應商（`adapter: "cursor"`）

Cursor 橋接為實驗性。在 `ocx login cursor` 後，新增或編輯 `providers.cursor`。

若某個代理無法承載 Cursor 預設的 HTTP/2 串流，請將 `upstreamHttpVersion` 設為 `"http1.1"` 或其
別名 `"h1"`。這會把推論切換到 Cursor 的 `RunSSE` + `BidiAppend` 相容傳輸，`GetUsableModels`
探索也一併使用 HTTP/1.1。這個值需要 HTTPS 的 `baseUrl`。未設定或使用 `"auto"` 則維持既有的
HTTP/2 行為。在儀表板中選擇 **Providers → Cursor → Settings → Cursor transport**。

Cursor Router 的最佳化階梯以獨立的 Codex id 暴露，因為 picker 無法渲染 Cursor 專屬的模型參數：

| Codex 模型 | Cursor Router 模式 |
| --- | --- |
| `cursor/auto` | 團隊／帳號預設 |
| `cursor/auto-cost` | 成本 |
| `cursor/auto-balance` | 平衡 |
| `cursor/auto-intelligence` | 智慧 |

明確變體以其 `optimization` 參數發送 Cursor 的 `default` 模型，在每個請求上保留選擇。當即時探索省略 `default` 時，它們仍可用。

### 視覺

原生 Cursor vision 對能夠原生看到影像的模型——包括 Claude、Gemini、GPT、Kimi 與 Grok——使用
`SelectedImage`（JPEG 軟上限 + `blobIdWithData`），且只使用現用回合的 `data:` 影像。更早回合的
影像會以 `[image attached]` 文字標記重播；遠端或無法解碼的影像會變成省略標記。Auto、Composer
家族與 GLM（`glm-5.2`、`glm-5.3`）留在精選的 `noVisionModels` 清單上，改用視覺描述 sidecar。

Cursor 伺服器驅動的本機工具預設停用。Codex 繼續使用其自身工具如 `apply_patch` 與 `exec_command` 及其自身的核准與沙箱政策：

- `"off"`（預設）拒絕 Cursor 原生的 `read`、`write`、`delete`、`ls`、`grep`、`shell` 與
  `fetch` 執行。
- `"on"` 選擇加入受信任的本機執行並繞過 Codex 核准／沙箱語意。
- `"codex-sandbox"` 為相容性而保留，但像 `"off"` 般 fail closed；請求文字不是可信的沙箱證明。

```json
{
  "providers": {
    "cursor": {
      "adapter": "cursor",
      "baseUrl": "https://api2.cursor.sh",
      "authMode": "oauth",
      "defaultModel": "auto",
      "nativeLocalExec": "off"
    }
  }
}
```

在 `providers.cursor` 上設定該欄位，而非頂層。在儀表板中使用 **Providers → Cursor
→ Edit JSON**，儲存後重啟。舊版 `unsafeAllowNativeLocalExec: true` 僅在 `nativeLocalExec` 未設定時等同於 `nativeLocalExec: "on"`。MCP、螢幕錄製與 computer use 分別由 `mcpServers` 與 `desktopExecutor` 控制。

每個 `mcpServers.<name>` 接受 `command`（stdio）或 `url`（Streamable HTTP）。Stdio 亦接受 `args`、`env` 與 `cwd`；HTTP 接受 `headers`。兩者皆支援 `enabled`（預設 true）與 `toolPrefix`。`desktopExecutor` 接受 `computerUseCommand`、`recordScreenCommand`、`cwd`、`env` 與 `timeoutMs`（預設 `30000`）。指令透過 `sh -c` 執行，從 stdin 讀取一個 JSON 請求，且必須向 stdout 寫入一個 JSON 結果。

:::caution[安全]
預設的回送綁定允許任何本機行程在無認證下存取，包含多使用者主機上的其他使用者。除非每個 data-plane 呼叫者都受信任且你刻意接受繞過 Codex 核可與沙箱語意，否則保持本機執行關閉。
:::

## OpenRouter 供應商路由

OpenRouter 可透過多個推論供應商提供一個模型。`openRouterRouting` 將請求保持在偏好的供應商上；`modelOpenRouterRouting` 為精確 model id 取代它。這對 prompt-cache 親和性很有用，因為 cache 支援、保留、命中率與定價因推論供應商而異。

供應商名稱為 OpenRouter slug。`allowFallbacks: false` 關閉失敗；`true` 在有序清單後允許另一個合格供應商。`only` 恆為允許清單。

```json
{
  "providers": {
    "openrouter": {
      "adapter": "openai-chat",
      "baseUrl": "https://openrouter.ai/api/v1",
      "apiKey": "${OPENROUTER_API_KEY}",
      "openRouterRouting": {
        "order": ["deepseek"],
        "allowFallbacks": false
      },
      "modelOpenRouterRouting": {
        "anthropic/claude-sonnet-5": {
          "only": ["anthropic"],
          "allowFallbacks": false
        }
      }
    }
  }
}
```

模型 key 為精確的原生 OpenRouter id，不含外層 opencodex 供應商前綴。選擇 `openrouter/anthropic-claude-sonnet-5` 會在套用模型規則前還原原生 `anthropic/claude-sonnet-5`。

## Vercel AI Gateway 供應商路由

Vercel AI Gateway 可在多個底層推論供應商之間路由一個模型。`vercelGatewayRouting` 設定供應商範圍偏好；`modelVercelGatewayRouting` 會針對精確模型 ID 取代它。若兩者皆未設定，`resolveVercelGatewayRouting()` 會回傳 `undefined`，因此 Chat 請求建構器會省略 `provider` 欄位，讓 Vercel AI Gateway 保留其預設的動態路由行為。

- `order`：依優先順序排列的 Vercel AI Gateway 上游供應商 slug。
- `only`：限制合格 Vercel AI Gateway 上游供應商的明確允許清單。
- `sort`：依 `"cost"`（最低成本）、`"ttft"`（首個權杖時間）或 `"tps"`（每秒權杖數）自動排序合格供應商。

```json
{
  "providers": {
    "vercel-ai-gateway": {
      "adapter": "openai-chat",
      "baseUrl": "https://ai-gateway.vercel.sh/v1",
      "apiKey": "${VERCEL_AI_GATEWAY_KEY}",
      "vercelGatewayRouting": {
        "sort": "ttft"
      },
      "modelVercelGatewayRouting": {
        "zai/glm-5.2": {
          "only": ["novita", "deepinfra"],
          "order": ["novita", "deepinfra"]
        }
      }
    }
  }
}
```

模型 key 是不含外層 OpenCodex 供應商前綴的 Vercel 公開模型選擇器。選擇 `vercel-ai-gateway/zai-glm-5.2` 時，會先還原原生 `zai/glm-5.2`，再套用模型規則。相同映射也適用於原生 `vercel/<model-id>` 選擇器：在 OpenCodex 中使用編碼後的 `vercel-ai-gateway/vercel-<model-id>` 選擇器，並保留 `vercel/<model-id>` 作為模型 key。

## 靜態模型允許清單

## 在 OS 金鑰圈中儲存金鑰

預設情況下，供應商的 `apiKey` 與 `apiKeyPool` 存放在 `config.json`（權限 0600，原子寫入）。若你想把金鑰材料留在檔案之外，可以把它搬進作業系統的憑證存放區：

```bash
ocx provider keychain deepseek status    # store: file | env | keychain，以及 keychain 是否能回應
ocx provider keychain deepseek store     # 把現用金鑰與池搬進 OS keychain
ocx provider keychain deepseek restore   # 把明文金鑰搬回來，並刪除 keychain 中的項目
```

相同的操作也是 `GET`／`POST /api/providers/keychain`。執行 `store` 之後，`config.json` 會存有 `"apiKey": "keychain:deepseek"`（池項目為 `keychain:deepseek/<id>`），密鑰則存放在 macOS Keychain、Windows 認證管理員，或 Linux Secret Service 中的 `opencodex.provider-api-key.v1` 服務下。因此 `config.json` 的備份只會帶有參考值。金鑰輪替與容錯移轉照常運作：池項目以參考值比對，所以輪替絕不會把明文寫回去。

在動到設定之前，`store` 會先寫入並讀回每一個項目；若 keychain 無法使用，或讀回的值不相符，它會以 503 拒絕並保持檔案原樣不變。在請求時，一個無法讀取的參考不會給出任何憑證，並會為每個金鑰各發出一次警告——依設計，這裡沒有明文後備。

何時不該選擇加入：以無頭服務（systemd、launchd、Task Scheduler）或容器方式執行的代理，通常沒有已解鎖的 keychain session，所以請求會 fail closed。在這種情況下，請改用服務環境中的 `${ENV_VAR}` 參考。環境變數參考不會被 `store` 動到。

`zhipu-bigmodel-responses` 預設為 `https://open.bigmodel.cn/api/v1` 播種 `glm-5.3`、`glm-5.3-flash` 與 `glm-5-turbo`，並設定 `liveModels: false`。它的靜態名單與 per-model 的 context、effort 與摘要中繼資料，來自 [BigModel Responses 指南](/zh-tw/guides/providers/#bigmodel-coding-plan-over-responses)。官方的本機 `models.json` 範例不會建立一個即時的 `/models` API。

`liveModels: false` 時，若 `models` 為空或省略，會先播種已設定的 `defaultModel`，再接 `retainModels`；重複的 id 會被移除，同時保留首次出現的順序。明確設定的非空 `models` 清單則改為播種 `models` 後接 `retainModels`，不會隱含加入另一個 `defaultModel`。那個預設值仍可以明確寫進 `models` 或 `retainModels`。若這些欄位都沒有提供任何 id，靜態播種就是空的。這是播種順序，不是最終 picker 順序的保證。`selectedModels`、`disabledModels` 與供應商停用政策仍然適用。`authMode: "forward"` 保留它自己獨立的分支，不使用這個路由過的靜態播種。這些規則不會改變即時探索失敗時的後備行為。

即時探索在快取前會拒絕超過 4 MiB 或 2,000 個原始模型列；內建預設可能使用較低的限制，並過濾到 chat 合格列。過大或格式錯誤的結果會遵循過時／設定的後備。一個有效但零筆合格的結果仍具權威性，不會被靜默取代或截斷。

當探索應該照常執行，但只有選定的 id 應該出現在 Codex 與 `/v1/models` 中時，請使用 `selectedModels`。儀表板會保留完整的探索清單，供日後變更允許清單使用。

`retainModels` 用來解決相反的問題：某個供應商的 `/models` 端點漏掉了一個仍然可呼叫的 id（私有部署、預覽 id，或清單不完整的 OpenAI 相容閘道）。列出的 id 會以與 `models` 相同的 context 與 effort 提示保留在路由目錄中，即使 `liveModels: false` 也一樣存活。`selectedModels` 仍會縮小可見範圍，所以在啟用允許清單時，一個 id 必須同時出現在兩份清單中。保留一個 id 並不會讓上游接受它；錯誤的 id 仍會在請求時以上游錯誤失敗。從 CLI：`ocx provider edit <name> --retain-models gemini-3.7-flash,other-id`（`-` 可清空）。

預覽版 GPT-5.6 後備項目使用相同機制。OpenAI API-key 預設以 context `922000` 與 max input `922000` 播種基礎與 Pro id；OpenRouter 以 context `922000` 播種 `openai/gpt-5.6-sol`、`openai/gpt-5.6-terra` 與 `openai/gpt-5.6-luna`。池／Direct 廣告 `922000`；同步目錄廣告 `max`，同時讓 `xhigh` 保持獨立。

```json
{
  "providers": {
    "openrouter": {
      "adapter": "openai-chat",
      "baseUrl": "https://openrouter.ai/api/v1",
      "apiKey": "${OPENROUTER_API_KEY}",
      "liveModels": false,
      "models": ["deepseek/deepseek-v4-flash", "qwen/qwen3-coder-plus"]
    }
  }
}
```

## 完整範例

```json
{
  "port": 10100,
  "defaultProvider": "openai",
  "providers": {
    "openai": {
      "adapter": "openai-responses",
      "baseUrl": "https://chatgpt.com/backend-api/codex",
      "authMode": "forward"
    },
    "anthropic": {
      "adapter": "anthropic",
      "baseUrl": "https://api.anthropic.com",
      "authMode": "oauth",
      "defaultModel": "claude-sonnet-4-6"
    },
    "ollama-cloud": {
      "baseUrl": "https://ollama.com/v1",
      "apiKey": "${OLLAMA_API_KEY}",
      "defaultModel": "glm-5.2",
      "noVisionModels": ["glm-5.2", "glm-5.3", "gpt-oss", "qwen3-coder", "deepseek-v4-flash"]
    }
  },
  "subagentModels": ["anthropic/claude-opus-5", "ollama-cloud/glm-5.2"],
  "disabledModels": [],
  "websockets": false,
  "webSearchSidecar": {
    "maxSearchesPerTurn": 3,
    "routedModelStallTimeoutMs": 200000,
    "timeoutMs": 60000
  },
  "visionSidecar": { "enabled": true }
}
```

## OpenCode Go Responses 相容性

對於解析端點為 `https://opencode.ai/zen/go/v1/responses` 的非 forward 請求，OpenCodex 會在工具與命名空間正規化之後，把 Codex 的 `additional_tools` 輸入宣告搬到頂層的 `tools`。受支援的託管工具會被保留到模型專屬過濾為止；格式錯誤的包裝維持不變。這不會丟棄密文，也不會丟棄未知的 agent-message 內容。這項檢查使用最終 URL，所以包含端點的 base URL，以及拆分的 `baseUrl`／`responsesPath` 設定，都會得到相同行為。解析到其他地方的自訂路徑則不會。

規範的 `opencode-go` 預設預設為 `statelessResponses: true`：請求使用明確的歷史紀錄搭配 `store: false`，不使用 `previous_response_id`、`conversation`、`background`、`metadata`，或已儲存的 `prompt` 參考。這避免了 Go 拒絕把推理密文與 `previous_response_id` 一起使用的情況。延續快取以回傳給客戶端的相同表示法記錄推理，包括可見內容轉摘要的重寫，所以用 `previous_response_id` 回顯完整歷史不會重複那段歷史。隱藏摘要的請求與不透明的推理 blob 保留其既有的表示法。快取命中也可以為差異延續提供更早的歷史；快取未命中後，代理會在上游派送之前回傳 `previous_response_not_found`，讓客戶端可以在不使用 `previous_response_id` 的情況下重送完整對話。無狀態修復會標記孤兒結果與缺失的工具結果；它無法重建遺失的歷史，也無法證明一次缺失的工具執行是否成功。

明確的 `statelessResponses: false` 會被保留。既有的規範預設設定，只有在該設定缺席時才會取得這個預設值；自訂重新命名的項目會保留它們已設定的值，不會因為目的地相符就取得這個預設值。Chat 模型路由保留它們既有的協定。這個無狀態旗標不會強迫 Responses 串流變成 JSON。

## OpenCode Go session 親和性

opencodex 路由到 OpenCode Go 目的地的每一個請求都帶有 `x-opencode-session` 標頭。上游從 2026-09-06 起開始拒絕沒有它的請求，所以這個標頭不是一項最佳化。

這個值取決於請求本身已經知道什麼：

- 維運方在供應商上設定的 `x-opencode-session` 會原樣保留。
- 帶有對話身分的請求——Codex 執行緒標頭、Claude 的 `metadata.user_id`、`session_id`，或一個傳入的 `x-opencode-session`——會被雜湊成一個穩定的 per-conversation 值，所以一次對話的每一個回合都會以相同的 session 抵達 Go。
- 完全沒有任何身分的請求，例如一次模型可用性探測，或任何對話中繼資料存在之前的第一個請求，會拿到一個為該請求配置一次的值。它與其他請求隔離，而非共用，並且在 opencodex 重建請求的每個地方都會存活：轉譯成內部 Responses 形狀、壓縮、組合子請求，以及把回合交給下一個候選者的政策後備重試。

非 Go 目的地不受影響：opencodex 絕不會為它們推導或新增這個 session 標頭。維運方在這類供應商上設定的標頭仍會被送出，因為 opencodex 不會去動那項設定。

## OpenCode Go reasoning effort

Go 目錄列會精確保留它們設定的 reasoning effort，包括在目錄同步期間。OpenCodex 不會為這些列附加合成的 `max` 或 `ultra` 選項。請對每個模型使用 `modelReasoningEfforts` 與 `modelDefaultReasoningEfforts` 來設定其接受的上游值。這些 per-provider map 的 key 是上游模型 ID，而不是路由過的 `opencode-go/<model-id>` 目錄 slug。舉例來說，一個設定為 `["high", "max"]` 的清單，就會精確保留那兩個選項；一個設定為 `["high", "xhigh"]` 的清單不會取得 `max`。目前的名單請見 [OpenCode Go 模型清單](https://opencode.ai/docs/go/#models)。一個設定的子集可以排除較低的分層。其他供應商保留既有行為。

要做出以原生優先的 picker，請把原生 id 加進 `modelPickerOrder`，後面接路由 id。這會為整個 picker 排序，同時保留 OpenCodex 各自獨立的自然優先順序指引計算。原生 Codex 廣告的那五個模型會跟隨 picker 優先順序，且可能改變；精確名稱覆寫的資格不限於那份廣告清單。純路由順序保留它們先前的行為。見[排序遷移說明](/zh-tw/guides/model-ordering/#migration-note-native-ids-in-existing-orders)。供應商上的 `modelDisplayNames` 控制可讀標籤，不會改變 wire id。

## 路由過的 agent 訊息

透過 [`openai-responses` adapter](/zh-tw/reference/adapters/#openai-responses)，當 `authMode` 不是 `"forward"`（例如 `"key"`）時，包含非空、受支援純文字部分陣列的 Codex `agent_message` 項目，會變成使用者訊息。使用 `authMode: "forward"` 的供應商會原封不動保留這些項目。`agent_message` 是 ChatGPT Codex backend 私有的，目前回報過的路由目的地會用 `422 unknown item type "agent_message"` 拒絕整個請求；Codex 會在之後每一個回合重播子代理的歷史，所以在該項目被轉換之前，這條執行緒會持續失敗。作者與收件者仍是明確的文字中繼資料，內容部分會被保留。對於標準連接埠上的 HTTPS `api.x.ai` 與 `cli-chat-proxy.grok.com`，非 forward 的 Responses 派送也接受一個非空白字串的子結果，並把它轉成一個 `input_text` 部分。原始字串——包括開頭／結尾的空白與換行——會被保留。其他目的地讓字串值的 agent 訊息維持不變。空字串或只有空白的字串維持不變，不完整以及混合加密／未知形狀的內容也是如此。加密與未知內容不會被正規化；原生加密任務仍需要獨立選擇加入的[任務復原](/zh-tw/reference/configuration/agents/#encrypted-v2-task-recovery)。

啟用任務復原時，被重播的 `NEW_TASK` 與 `MESSAGE` 項目，只有在驗證呼叫端並比對父執行緒 scope 之後，才會重用一個快取的指派。重播還原不會發出新的復原請求，也不會延長快取的到期時間。過期或未見過的密文不會被取代。全新的加密 `NEW_TASK` 與 `MESSAGE` 項目使用同一個選擇加入的復原路徑，包括原生父層的 `send_message` 傳遞。訊息類型、寄件者、收件者、父層 scope 與呼叫端憑證，仍是驗證或快取身分的一部分。

當一個請求包含好幾則 agent 訊息時，快取的重播還原會各自獨立檢查每一則訊息。快取會在已准入的呼叫端／帳號與父層 scope 內，區分訊息類型、寄件者、收件者與密文。全新的復原只處理目前的尾端訊息（忽略尾隨的 `compaction_trigger` 或 `additional_tools` 中繼資料）。它不會批次復原未見過的歷史訊息；那些訊息維持不變。一次快取未命中或過期，不會延長歷史復原契約。

路由過的 Responses 上的寄件者與收件者，是給接收模型的脈絡，不是一個新的機器可讀路由協定。工具路由繼續使用既有的協作契約。

### 個別模型能力宣告

`modelCapabilities` 以精確的上游模型 ID 為 key，儲存明確的宣告。ID 會保留大小寫，且不得含前後空白。每個項目可以包含 `inputModalities`（`text`、`image`、`audio`、`video`）、`contextTier`（`default`、`long_context`）與 `video.processing`（`static`、`agentic`）。這些是維運方的宣告，不是供應商支援的證明。Context-tier 與 video 欄位目前只記錄意圖，不會啟動上游行為，也不會增加目錄視窗。

原始的供應商編輯器與供應商 API 都公開這個 map。POST／PUT 會取代明確提供的 map，並拒絕 null 項目。PATCH 會合併個別軸；`null` 會清除一個 map、模型、軸或 video processing 值，`{}` 則不做任何變更。省略的供應商覆寫會保留既有的 map。格式錯誤、手動編輯的檔案會保留有效的獨立軸，並把格式錯誤的明確輸入模態當成純文字處理，同時發出診斷訊息。

明確的 `modelCapabilities.<id>.inputModalities` 現在對該精確路由模型而言，會優先於舊版的模態提示。純文字宣告會使用既有的視覺 sidecar，把影像換成描述；若沒有可用的 sidecar，請求會在派送前收到一個明確的省略標記。原生 Chat 影像請求會透過這條路徑分流。目錄仍可以廣告影像附件支援，因為代理提供了這個描述步驟。Context-tier 與 video processing 宣告在其傳輸支援到位之前，仍維持不生效。

### 重新命名的 API-key 預設

當一個以其他名稱儲存的供應商（例如 `CommandCode`）的 adapter 與固定 API-key 端點，與某個登錄檔預設相符時，它會繼承缺失的 reasoning-effort 中繼資料。你明確設定的 per-model 清單（包括 `[]`）仍具權威性。省略的供應商範圍清單會繼承預設值；明確設定的清單維持不變。這不適用於 OAuth、不相關的端點，或模板化／自訂端點預設。
