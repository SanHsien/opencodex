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
| `codexAccountAutoSwitchThresholds?` | `Record<string,number>` | — | 各帳號對 `autoSwitchThreshold` 的覆寫：帳號 ID → `0`–`100` 的整數。沒有項目時繼承全域值；`0` 只停用從該帳號發起的使用量主動切換。支援主帳號 `__main__`。可在 Codex Auth 的帳號卡片中管理。 啟用覆寫時，會將目前全域閾值複製為固定的帳號值。覆寫值（包括 `0`）在之後修改全域閾值時仍優先。停用時傳送 `threshold: null`，刪除項目，並恢復繼承目前全域閾值及其未來的變更。 |
| `accountPoolStrategy?` | `"quota" \| "round-robin" \| "fill-first" \| "reset-first"` | `"quota"` | 新／未綁定 Codex 請求的指派策略。當請求沒有即時（父執行緒 id、配額 scope）親和性時即為未綁定；可見的既有任務在代理重啟或親和性重置後可變為未綁定。`quota` 在無現用帳號時選擇最低用量的合格帳號，將合格現用帳號保持在 `autoSwitchThreshold` 以下，且在閾值後可將未綁定請求移至較低用量的合格帳號。綁定任務預設會保留到帳號耗盡（已知用量 100%）或無法繼續服務，改綁時只前往確有額度餘裕且用量嚴格更低的帳號。關閉該設定後，也可在閾值將綁定任務的下一個請求改綁到確有額度餘裕且用量嚴格更低的帳號。`round-robin` 均勻分配未綁定請求；`fill-first` 持續將未綁定請求指派到現用帳號直到冷卻、不可用或設定的排空閾值。  `reset-first`: 在低於用量門檻的帳號中，優先選擇下次5小時或週額度重設最早的帳號。已綁定任務遵循設定的親和策略。獨立模型額度按用量排序。 此排序不使用月額度重設時間。 |
| `pool.cacheAffinity?` | `boolean` | `true` | 綁定 Codex 執行緒的 cache-affinity 排序，獨立於 `pool.kernel`。預設開啟；省略該鍵或設為 `true` 即為開啟，格式錯誤視為開啟。即時綁定優先於配額餘裕：`quota` 不會只因用量越過 `autoSwitchThreshold` 就移動執行緒。帳號暫停、無法使用或真正耗盡（已知用量 100%）時仍會離開，且只改綁到確有額度餘裕且用量嚴格更低的帳號。用量未知的帳號不會作為綁定任務的改綁目標。設為 `false` 可恢復依閾值重新綁定。親和性是重排而非釘死。 |
| `accountPoolStickyLimit?` | `number` | `1` | 在前進一個 round-robin 選擇前保留的新／未綁定任務指派；計數器在任務綁定時前進，而非在上游成功後。範圍 1–100。 |
| `upstreamFailoverThreshold?` | `number` | `3` | 未來新 session 容錯移轉前的連續暫時性失敗。設 `0` 停用。對一般 Responses 與原生 compact 傳送而言，已證實的連線建立前 DNS/TCP 可達性失敗會在供應商主機層級被追蹤：它們絕不會影響帳號健康狀態、帳號冷卻、執行緒／session 親和性、現用帳號選擇或池路由，也絕不會計入這個閾值。 |
| `upstreamHostCircuitThreshold?` | `number` | `0` | 針對原生 OpenAI forward Responses 與 compact 傳送上已證實的連線建立前 DNS/TCP 失敗，選用的斷路器閾值。`0` 停用；`1`–`20` 表示在該數量的終端邏輯請求後，開啟 30 秒的供應商來源冷卻。開啟期間，請求會在帳號選擇或上游傳送之前就收到帶 `Retry-After` 的 `503`；冷卻結束後，會放行一個半開請求。逾時與任何 HTTP 回應都不計入，任何 HTTP 回應都會關閉斷路器。只適用於沒有釘選帳號的 Codex Pool 路由；對 `codexAccountMode: "direct"` 與帳號限定選擇器無效。 |
| `maxUpstreamBodyBytes?` | `number` | `0` | 選用的上限（位元組），套用於序列化後的原生 Responses **passthrough** 請求主體。`0` 或省略即停用——不會為任何目的地推斷限制。設定後，超過上限的已建構主體會在傳送前於本機被拒絕：串流回合會收到終端的 `response.failed` / `context_length_exceeded`，讓客戶端改為壓縮而非重送；非串流回合則收到 `413`，其中指出大小、內嵌 `input_image` 項目的數量，以及大約代表多少 MB 的影像資料。此檢查會在每個建構與重建點執行，包括 OAuth 重新整理後的重播與替代帳號重試。轉譯後的 adapter 路徑不在涵蓋範圍內。這裡刻意沒有預設值：唯一有實測上限的是 WebSocket 傳輸，而它對超大回合本來就會退回 HTTP，所以預設值會拒絕目前能成功的請求。當你的閘道有已知的請求大小限制，而你寧可看到可處理的本機錯誤而非不透明的上游失敗時，才設定它。 |
| `maxInboundBodyBytes?` | `number` | `0` | 選用的上限（位元組），套用於解壓縮後的**進站**資料平面請求主體——是上面 `maxUpstreamBodyBytes` 的鏡像。`0` 或省略維持內建的 256 MiB 預設值。當大 context session 已經無法壓縮時，請調高它：Codex 會把整段歷史重播給壓縮模型，因此在 922k token 選擇加入視窗上，壓縮請求本身就是超過上限的那一個，讓 session 卡在唯一能讓它縮小的操作上。範圍限制在 1 MiB–512 MiB。這個上限沒有商量餘地：讀取器會將主體具現化好幾次（線上位元組、解碼後位元組、解碼後字串，以及解析出的物件圖），所以尖峰記憶體是被允許大小的倍數，不設上限就是一個記憶體耗盡的槓桿。適用於 `/v1/responses`、`/v1/responses/compact`、`/v1/chat/completions` 與 `/v1/messages`。監聽器的接受大小在代理繫結時就固定，所以變更要重新啟動才會生效。超過限制的主體會在本機以 HTTP 413 拒絕，並附上 `code: "inbound_body_too_large"`，這與供應商大小拒絕產生的 `context_length_exceeded` 413 刻意不同。 |
| `modelCacheTtlMs?` | `number` | `300000` | Per-供應商 `/models` 快取的新鮮度視窗。 |
| `cacheRetention?` | `"none" \| "short" \| "long"` | `"short"` | Anthropic prompt-cache 政策：停用、5 分鐘臨時或 1 小時延長。 |
| `tokenGuardian?` | `OcxTokenGuardianConfig` | off | 可選的主動 OAuth refresh 與 Codex 帳號暖機政策。 |

這些策略均使用各帳戶的有效閾值：存在 `codexAccountAutoSwitchThresholds` 項目時使用該值，否則繼承全域 `autoSwitchThreshold`。覆寫值為 0 僅關閉基於用量的主動切換；啟動綁定、硬鎖、冷卻、模型使用資格檢查和故障復原仍然生效。

`codexAccountNamespaces` key 是公開選擇器：1–64 字元，以 ASCII 字母或數字開頭與結尾，中間為字母、數字、`.`、`_` 或 `-`。保留的 JavaScript 物件名稱被拒絕。每個值是有效的池帳號 id（絕非內部 `__main__`）或代表 Codex Desktop 帳號的 `"@main"`。供應商與保留的 `openai` / `combo` 衝突以不區分大小寫方式檢查。保持原始帳號 id 與電子郵件私密；選擇器是公開名稱。

## 保留的 OpenAI 供應商

`openai` 與 `openai-apikey` 是固定的保留 id。`openai.codexAccountMode` 預設為 `"pool"` 並在 main 加上新增帳號之間選擇；`"direct"` 僅使用目前呼叫者／main 登入。API 僅使用其設定的 API 金鑰或金鑰池。使用裸模型或 `openai-apikey/<model>`；無跨路由憑證後備。API GPT-5.6 列帶有 1,050,000 context / 922,000 max input 中繼資料，而 Pro 虛擬 id 以 `reasoning.mode: "pro"` 重寫為基礎 wire 模型。

`openaiProviderTierVersion: 2` 標記目前的單一供應商 projection。在遷移已出貨的 v1 設定前，opencodex 會在不替換不同備份的情況下建立 `config.json.pre-openai-tiers-v2.bak`，並將已知的舊版命名空間 selected id 重寫為裸 id。

### GPT-6 Astra、Sol、Luna 與 Astra Minor

`gpt-6-astra` 使用 Codex 登入路由；`openai-apikey/gpt-6-astra` 使用你自己的 API 金鑰。可用性仍取決於上游帳號。原生 Astra 保留出貨時的 Codex 預設值：272,000 context、`low` reasoning，以及 `low`/`medium`/`high`/`xhigh`/`max`/`ultra` 階梯。它在 Fast 目錄中的描述是 **2 倍速度**；那不是計費倍率。

將 `providerContextCaps.openai` 設為 `922000` 可讓原生群組選擇加入長 context；Astra 自身的上限止步於 **872,000**。每個模型的 `providers.openai.modelContextWindows` 與 `modelAutoCompactTokenLimits` 可縮小它的視窗與軟性壓縮預算。例如 `modelAutoCompactTokenLimits: { "gpt-6-astra": 700000 }` 會把長視窗預設值 784,800 調低。明確設定的較小供應商上限或目標限制仍會勝出，包括原生別名組合。

API 列有 1,050,000 context、922,000 最大輸入、128,000 最大輸出、文字／影像輸入，以及最高到 `max` 的 API reasoning effort。OpenCodex 路由過的合成 Ultra 控制項保留其既有的 wire-effort 映射；它不是額外的 API effort。沒有 Astra 的 `-pro` 別名。請使用既有的 `fastMode` 設定，或 Codex 的 `service_tier = "fast"` 搭配 `[features].fast_mode = true`；API 的 `fast` 與 `priority` 都是可接受的 Fast 拼法。

[GPT-6 Sol 與 Luna](https://openai.com/index/introducing-gpt-6-sol-and-luna/)（於 2026 年
9 月 22 日發布）是 Codex-login 原生模型：`gpt-6-sol` 與 `gpt-6-luna`，顯示為 **GPT-6-Sol**
與 **GPT-6-Luna**。與 Astra 一樣，它們在每次安裝時都會列出，不受帳號名冊限制；若你的帳號
還不能使用它們，請求仍會照常送出，你會看到上游錯誤。它們的中繼資料來自 Codex 的
`/models` 名冊，該名冊只把這兩列提供給 `client_version` **0.155.0 或更新版本**；opencodex
自帶這些列的副本，因此即使你安裝的 Codex 目錄早於它們發布，它們也會出現。

| 模型 | 預設 context | 選用上限 | 預設 effort | Reasoning 階梯 |
| --- | ---: | ---: | --- | --- |
| `gpt-6-sol` | 272,000 | 872,000 | `medium` | `low` 到 `ultra` |
| `gpt-6-luna` | 272,000 | 872,000 | `medium` | `low` 到 `max`（無 `ultra`） |

Sol 與 Luna 套用與 Astra 相同的 `providerContextCaps.openai`、`modelContextWindows` 與
`modelAutoCompactTokenLimits` 控制項。目前還沒有 `openai-apikey/` 列，也還沒有 Sol 或
Luna 的內建價格估算。

當 OpenAI 推出此版本尚未認識的 GPT 模型時，可透過設定加入它，而不必等待更新——就像新的
Claude id 加入 `providers.anthropic.models` 底下一樣：

```json
{
  "providers": {
    "openai": {
      "adapter": "openai-responses",
      "authMode": "forward",
      "baseUrl": "https://chatgpt.com/backend-api/codex",
      "models": ["gpt-6-nova"]
    }
  }
}
```

Codex-login 供應商上列出的每個裸 `gpt-*` id（此處為 **GPT-6-Nova**），都會以 GPT-6 Sol
的 reasoning 階梯與模態，加上 272,000-token 預設 context 與 872,000-token 選用上限，顯示為
原生模型。可用 `modelContextWindows` 調高或縮小它，例如
`"modelContextWindows": { "gpt-6-nova": 872000 }`。它永不受帳號限制：即使你的帳號不能
使用該模型，請求仍會照常送出，你會看到上游錯誤。已內建的 id 會被忽略，從清單移除某個 id
就會移除該模型。combo 的 `nativeAlias` 不能指向一個設定過的 id。

`gpt-6-astra-minor`（**GPT-6-Astra-Minor**）是尚未發布的 Astra 變體。它受帳號限制：在你
帳號的已驗證 Codex 名冊列出它之前，它會保持隱藏，且對它的請求會在本機被拒絕。出現時會
使用 Astra 的 context、階梯與模態。

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
| `chatCompletionsPath?` | `string` | `openai-chat` 請求的相對資源路徑，為 `responsesPath` 的對應項，適用相同的路徑規則。當同一上游以不同前綴提供 Chat Completions 與 Responses 時需要此設定：按模型的 wire override 只更換適配器而不改動 `baseUrl`，否則已啟用的 Chat 請求會送往 Responses base。隨附範例為 Z.AI。 |
| `upstreamWebsocket?` | `boolean` | 為 `openai-responses` 請求選用上游 Responses WebSocket 傳輸（預設 `false`）。僅對第一方 `https://api.openai.com/v1` 上游生效；自訂供應商端點一律使用有界 HTTP/SSE，因為 Bun 無法在配置完整訊息之前對傳入 WebSocket 訊息套用大小限制。對於規範 ChatGPT `openai` 供應商，省略此欄位會在符合條件的回合使用上游 WebSocket，`false` 會以 HTTP/SSE 傳送串流回合，`true` 會被拒絕；設為 `false` 時，原生回合中操控與注入無法使用。此欄位獨立於用戶端 `websockets` 設定，且不會變更端點或認證資料。一般 HTTP 仍使用 SSE；非 Responses 路徑與 `openai-chat` 請求仍使用 HTTP。 |
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
| `modelAdapters?` | `Record<string, string>` | 混合 wire 閘道的 Per-model `openai-chat` 或 `openai-responses` wire 覆寫。明確項目勝過 registry 預設；DeepSeek 的預設可為 `deepseek-v4-flash` 選擇原生 Responses。單一 wire 上游 pin 與規範 ChatGPT forward 拒絕覆寫。 |
| xAI Responses 選用（儀表板） | 開關 | 僅用於 `xai`，以原子方式設定或清除 `grok-4.5` 與 `grok-4.6` 的 `modelAdapters` 項目。若只有一個項目，會顯示混合狀態，直到下次開關寫入統一兩者。其他覆寫與層級行為不變。 Grok 4.7 在 OAuth 上透過登錄檔 wire 預設使用 Responses，也可透過明確的 `modelAdapters["grok-4.7"] = "openai-chat"` 項目切換至 Chat。 |
| `annotateEmptyToolOutputs?` | `boolean` | 在工具結果送達模型前，將已存在但為空的結果替換成簡短標記，使空白結果不會被解讀為遺漏的結果。適用於空白字串及僅含文字部分的陣列；影像、檔案及加密部分絕不會被更動。DeepSeek 透過內建登錄檔預設為 `true`，其他情況則不設定。設為 `false` 可讓供應商停用此功能；後續編輯即使省略此欄位，也會保留明確設定的 `false`。`PATCH /api/providers?name=<provider>` 接受 `true`、`false` 或 `null`；`null` 會清除覆寫並恢復使用登錄檔的預設行為。 |
| `xaiResponsesXSearch?` | `boolean` | 預設停用。在 xAI Responses 目的地上，僅當即時 `web_search` 工具通過最終請求正規化後仍保留時，才附加由供應商託管的 `x_search` 宣告。既有宣告不會重複，呼叫端的 `tool_choice`／`allowed_tools` 選擇器絕不會擴大，且此設定與網頁搜尋輔助服務的 `search.xSearch` 選項分開。 |
| `modelPreferHostedTools?` | `Record<string,string[]>` | 針對保留一個託管工具命名空間的非 forward Responses 閘道，精確模型的選擇加入。目前只接受 `["image_generation"]`；相符的模型必須使用 `openai-responses` wire 並支援那個託管工具。它會移除衝突的客戶端 `image_gen` 宣告，並重寫它們的選擇器以保留呼叫端的工具選擇。對於 OpenAI API 的虛擬 `-pro` 模型，會先比對選定的公開 ID，再以解析後的基礎 wire-model ID 作為後備。`modelAdapters` 會先解析公開 ID，再解析基礎 ID；第二次解析決定最終的 wire。其他模型保留一般的別名行為。 |
| `annotateEmptyToolOutputs?` | `boolean` | 在工具結果送達模型前，將已存在但為空的結果替換成簡短標記，使空白結果不會被解讀為遺漏的結果。適用於空白字串及僅含文字部分的陣列；影像、檔案及加密部分絕不會被更動。DeepSeek 透過內建登錄檔預設為 `true`，其他情況則不設定。設為 `false` 可讓供應商停用此功能；後續編輯即使省略此欄位，也會保留明確設定的 `false`。`PATCH /api/providers?name=<provider>` 接受 `true`、`false` 或 `null`；`null` 會清除覆寫並恢復使用登錄檔的預設行為。 |
| `reasoningEffortMap?` | `Record<string, string>` | 供應商範圍的 reasoning 標籤 wire 別名。把標籤對應到 `"__omit__"` 可以在上游請求中完全省略推理欄位：OpenAI 相容 wire 上是 `reasoning_effort`，在 Ollama 原生 adapter 上則是 Ollama 原生的 `think` 欄位（#2356）。 |
| `modelReasoningEffortMap?` | `Record<string, Record<string, string>>` | Per-model 的 reasoning 標籤 wire 別名。把標籤對應到 `"__omit__"` 可以在上游請求中完全省略推理欄位。 |
| `reasoningWireFormat?` | `"gateway-object"` | 針對接受 `reasoning: { enabled, effort }` 而非 `reasoning_effort` 的 OpenAI 相容閘道。ClinePass 預設會自動設定這個值。 |
| `noReasoningModels?` | `string[]` | 拒絕 reasoning/thinking 參數的模型。 |
| `noTemperatureModels?` | `string[]` | 拒絕呼叫者指定 `temperature` 的模型。 |
| `noTopPModels?` | `string[]` | 拒絕呼叫者指定 `top_p` 的模型。 |
| `noStopModels?` | `string[]` | 拒絕呼叫者指定 `stop` 的模型。`openai-chat` 轉接器、Chat 直通與 Responses 直通會為這些模型省略該欄位。內建 `xai` 預設在此列出 xAI 文件說明會拒絕該參數的推理模型(`grok-4.7`, `grok-4.6`, `grok-4.5`, `grok-4.3`, `grok-4.20-multi-agent-0309`, `grok-4.20-0309-reasoning`, `grok-build-0.1`)；`grok-4.20-0309-non-reasoning`, `grok-composer-2.5-fast` 保留呼叫者的 `stop`。 |
| `noPenaltyModels?` | `string[]` | 拒絕 presence/frequency penalty 的模型。 內建 `xai` 預設在此列出 xAI 文件說明會拒絕這些參數的推理模型(`grok-4.7`, `grok-4.6`, `grok-4.5`, `grok-4.3`, `grok-4.20-multi-agent-0309`, `grok-4.20-0309-reasoning`, `grok-build-0.1`)；非推理模型保留呼叫者的 penalty。 |
| `noStructuredOutputModels?` | `string[]` | 其 `openai-chat` 端點拒絕 `response_format` 的精確模型 ID。僅精確符合的請求模型會省略該欄位；structured-output 轉譯對其他每個 `openai-chat` 模型保持啟用。 |
| `noJsonSchemaModels?` | `string[]` | 其 `openai-chat` 端點拒絕 `json_schema` 形式但仍接受 `json_object` 的精確模型 ID。這類請求會降級為 `json_object` 而非被丟棄，因此要求 JSON 的呼叫端仍會拿到 JSON。同一模型同時列在兩份清單時，以 `noStructuredOutputModels` 為準。`opencode go`、`opencode zen`、`opencode free` 預設已為其 DeepSeek 路由內建。 |
| `foldDeveloperRoleToSystem?` | `boolean` | 記錄某個 `openai-chat` 目的地是否接受 `developer` 角色。`foldDeveloperRoleToSystem` 未設定時以 `system` 傳送，`true` 時以 `system` 傳送，`false` 時以 `developer` 傳送。未設定表示尚未記錄該目的地的情況；`true` 記錄上游拒絕該角色；`false` 記錄其接受該角色。無論何者，訊息都保留在對話中的原有位置，只有角色改變。拒絕該角色的目的地會回應 `400 role 'developer' is not allowed`，該回合根本無法開始，這就是未記錄狀態預設摺疊的原因。 |
| `parallelToolCalls?` | `boolean` | 切換平行工具呼叫。OpenAI Chat 預設開啟；非 chat adapter 僅在明確 `true` 時廣告。 |
| `responsesItemIdRepair?` | `{ message?: string[]; reasoning?: string[]; repairMissingTerminalIds?: boolean }` | 預設停用的下游 SSE 修復，用於精確佔位 id 與缺失的終端 id。Function-call id 永不被重寫。 |
| `transientRetryOn5xx?` | `{ enabled?: boolean; attempts?: number }` | 僅限使用金鑰認證的 `openai-chat` 與 `openai-responses` 供應商。`authMode: "forward"` 的供應商（ChatGPT 帳號池）從不讀取此選項，維持預設重試次數。選擇性重試串流開始前的暫時性上游狀態（500、502、503、504、520、521、522）：未設定時停用；只要有此物件即啟用，除非 `enabled: false`。涵蓋初始 `Responses` 請求、終止防護續接、原生 `/v1/chat/completions`，以及 429／帳號復原的重新擷取。`attempts` 是單一請求允許傳送至上游的總次數，包含第一次（1..10，預設 3）；這是與連線重設復原共用的單一請求範圍預算，因此 `3` 表示最多只有三個實際請求會送達供應商。等待採固定 400 毫秒、上限 5 秒的指數退避，並遵循 `Retry-After`。此機制獨立於處理速率限制的 `retryOn429`；串流中的失敗絕不重播。 |
| `retryOnReset?` | `{ enabled?: boolean; replacements?: number }` | 僅限原生 `openai-responses` 供應商，包含 `authMode: "forward"`。可選擇性地替換一次在呼叫端尚未觀察到任何內容時就失敗的傳送：未設定時停用；只要有此物件即啟用，除非 `enabled: false`。涵蓋兩個不確定階段——回應標頭抵達前連線中斷，以及標頭之後 SSE 內文只載有控制事件時中斷。canonical ChatGPT upstream WebSocket 在 create 訊框送出之後、任何 Responses 事件抵達之前關閉或出錯時，也以相同方式處理，其替換傳送改走 HTTP。只有自我完備的請求才會被替換：`store: false`、完整的 `input`、沒有 `previous_response_id`／`conversation`／`stream_id`，且僅使用由用戶端執行的工具。`replacements` 是單一邏輯請求在所有環節與所有組合子請求中可進行的替換傳送次數（1..2，預設 1）；它既不是各環節的重試次數，也不是傳送預算，因此替換傳送仍必須落在該環節既有的傳送額度之內。已經產生輸出或工具呼叫的請求，無論此值為何都不會被替換。若上游已經開始第一次推論，被替換的推論仍可能計費，因此此選項預設停用。 |
| `autoToolChoiceOnlyModels?` | `string[]` | 其 `tool_choice` 僅接受 `auto` 或 `none` 的模型；強制選擇被降級。 |
| `preserveReasoningContentModels?` | `string[]` | 需要在 chat 歷史中保留先前 assistant `reasoning_content` 的模型。從儀表板儲存時會保留已儲存的清單（包括 `[]`）。`PATCH /api/providers?name=<provider>` 接受陣列，或傳入 `null` 清除該欄位。將供應商改到其他轉接器、base URL 或驗證模式的儲存不會保留該清單（見下文）。 |
| `reasoningDetailsModels?` | `string[]` | 以結構化 `reasoning_details` 陣列回傳思考內容的模型（啟用 `reasoning_split` 的 MiniMax M 系列）；串流增量為累積快照，以前綴差分處理，保留的推理以 `reasoning_details` 陣列而非 `reasoning_content` 字串重播。 |
| `requiresReasoningPlaceholderModels?` | `string[]` | 上游會拒絕缺少 `reasoning_content` 的 tool_call 續接訊息的模型（DeepSeek thinking 模式）；重播快取未命中時會注入最小的佔位內容。預設沿用 `preserveReasoningContentModels`；設為 `[]` 可明確關閉。從儀表板儲存時會保留已儲存的清單（包括 `[]`）。`PATCH /api/providers?name=<provider>` 接受陣列，或傳入 `null` 清除該欄位。將供應商改到其他轉接器、base URL 或驗證模式的儲存不會保留該清單（見下文）。 |
| `thinkingToggleModels?` | `string[]` | 使用 `thinking.enabled` 而非 effort 階梯的 chat 模型。 |
| `thinkingBudgetModels?` | `string[]` | 使用整數 `thinking_budget` 的 chat 模型；effort 映射為預算比例。 |
| `noVisionModels?` | `string[]` | 透過視覺 sidecar 發送的純文字模型；比對容忍 Ollama `:size` 標籤。 |
| `escapeBuiltinToolNames?` | `boolean` | 為 Anthropic 相容閘道轉義內建工具名稱，並在回傳的呼叫中還原它們。 |
| `anthropicEofTolerance?` | `boolean` | 讓 Anthropic 相容閘道在 `message_stop` 之前結束的串流也能完成，但僅限於已收到可見文字或一個完整 JSON 物件工具輸入的情況。預設關閉。 |
| `googleMode?` | `"ai-studio" \| "vertex" \| "cloud-code-assist"` | Google 傳輸／認證模式。預設 `ai-studio`。 |
| `googleToolSchemaPolicy?` | `"compatible" \| "reject-lossy"` | 僅限 Google。省略或設為 `compatible` 時保留相容結構描述與既有的非直接 400 修復。`reject-lossy` 會在傳送前拒絕初始損失或結果不確定的有界比較，並阻止會放寬限制的 Vertex 或 Cloud Code Assist 修復。直接 AI Studio 不會執行該修復。 |
| `project?` | `string` | Vertex 或 Antigravity Cloud Code Assist 專案 id。 |
| — | — | Antigravity 帳號配額探測（`retrieveUserQuota` 與 `retrieveUserQuotaSummary`）一律透過釘選的出站傳輸，前往 Google 自己的 Cloud Code 主機，無論設定的 `baseUrl` 為何；帳號 bearer 絕不會送到維運方設定的端點，重新導向會中止探測。只有模型清單後備仍會遵循 `baseUrl`。 |
| `location?` | `string` | Vertex 位置；環境後備為 `GOOGLE_CLOUD_LOCATION`。 |
| `mcpServers?` | `Record<string, CursorMcpServerConfig>` | 僅 Cursor：stdio 或 Streamable HTTP MCP 伺服器。 |
| `desktopExecutor?` | `DesktopExecutorConfig` | 僅 Cursor：外部 computer-use 與 record-screen 指令。 |
| `unsafeAllowNativeLocalExec?` | `boolean` | Cursor 舊版布林值，僅在較新欄位未設定時等同於 `nativeLocalExec: "on"`。 |
| `nativeLocalExec?` | `"off" \| "codex-sandbox" \| "on"` | Cursor 本機執行政策。`off` 為預設；`codex-sandbox` 目前像 `off` 般 fail closed。 |

註冊或替換供應商（`POST /api/providers`）時，會先驗證 `responsesPath` 和 `chatCompletionsPath`，再修改記憶體或磁碟中的設定。`PATCH /api/providers?name=<provider>` 會將請求內容與已儲存的供應商合併；除僅更新 `requestPacing` 的請求外，凡是修改 `disabled` 以外欄位的更新，都會在儲存前以同樣方式驗證合併後供應商的路徑，若保留的既有路徑無效則回傳 `400`，且不變更設定。載入設定檔時也適用相同的路徑規則。

API-key 供應商可持有字面值金鑰或環境參考。OAuth 供應商使用由 `ocx login` 填入的憑證存放；訂閱支援的 Claude Code 啟動行為在 [`claudeCode.authMode`](/zh-tw/reference/configuration/server/#claude-codeclaudecode) 下設定。

### 儲存供應商時會保留什麼

以既有供應商的名稱呼叫 `POST /api/providers`，會以根據請求建立的列取代已儲存的列。儀表板的新增/編輯表單無法傳送所有欄位，因此儲存時會保留請求省略的部分已儲存欄位。其中五個記錄的是某個上游的行為：`preserveReasoningContentModels`, `requiresReasoningPlaceholderModels`, `foldDeveloperRoleToSystem`, `reasoningWireFormat`, `omitReasoningEffortWithToolsModels`。

| 儲存 | 五項設定 | 已儲存的 `apiKeyPool` |
| --- | --- | --- |
| 目的地相同，欄位省略 | 保留已儲存的值，包括明確的 `[]` 或 `false` | 保留 |
| 新目的地，欄位省略 | 不保留；可能套用新目的地的登錄檔預設值 | 不保留 |
| 請求中傳送了該欄位 | 請求中的值 | 請求中的值 |

目的地指轉接器、base URL（比較協定與主機時不分大小寫，忽略結尾斜線），以及請求有指定時的驗證模式。把供應商移到其他目的地時，描述舊上游的五項設定和為舊上游核發的金鑰池都不會帶過去。儲存絕不會把舊列的其餘部分合併進新列。

`PATCH /api/providers?name=<provider>` 只修改它指定的欄位，無論目的地為何都保留其他所有已儲存欄位。它接受全部五項設定，`null` 表示清除。對於兩個推理清單，空陣列會作為明確的退出選項儲存，而不會被刪除。

### 逐供應商 egress

當上游需要與行程全域代理不同的出口時，請在該供應商上設定 `proxy`：

- 省略 `proxy` 以繼承全域代理與 `NO_PROXY` 判斷。
- 將 `proxy` 設為 `"direct"` 或 `null`，即使有設定全域代理，也強制此供應商直接連線。
- 將 `proxy` 設為絕對的 `http://` 或 `https://` URL，讓此供應商使用該 HTTP 代理。
- 將 `proxy` 設為絕對的 `socks5://` 或 `socks5h://` URL，讓此供應商使用該 SOCKS5 代理。

空字串或僅含空白的字串會被刻意拒絕。清空欄位不應悄悄從「繼承全域代理」變成「強制直連」；
移除欄位以繼承，或明確寫入 `"direct"` 以選擇直連。

`noProxy` 接受逗號分隔字串，或 `NO_PROXY` 語法的字串陣列。每個請求都會評估一次。相符的
目的地會走直連，不論該供應商原本會使用自己的 `proxy` 或繼承全域代理。

#### 這條路由涵蓋哪些範圍

此路由適用於路由推理、供應商探索與連線測試，以及 API-key 配額探測。有些傳輸無法帶著它走，
OpenCodex 會如實說明，而不是假裝可以：

- **OAuth token 交換與 refresh** 仍使用行程全域代理。這些請求會從不持有供應商設定的程式碼
  連到固定的廠商端點，因此即使某個供應商 pin 了自己的代理或 `"direct"`，它的憑證仍會透過
  全域路由 refresh。以 OAuth 為後盾的配額探測與 API-key 驗證探測行為相同。
- **Responses WebSocket 快速通道**在建立連線時選擇自己的代理，無法帶著每供應商路由走，
  因此宣告了路由的供應商，這些回合會改走 HTTP/SSE，並記錄一次性提示。
- **Cursor 預設的 HTTP/2 傳輸**、**CodeBuddy 與 Qoder 子行程供應商**（它們的子環境省略代理
  變數），以及 **Compatibility Lab** 的 pinned sender，都不會套用它。
- 不路由模型的端點——圖片生成與編輯、音訊轉寫、live 與 realtime 呼叫，以及未限定的
  `/v1/alpha/search`——沒有供應商路由可套用。

設定了自訂 `fetch` executor 的供應商會被拒絕，而不是悄悄以該 executor 自己的路由送出。

以下範例讓一般流量維持使用全域代理，讓一個供應商經由區域 HTTP 代理，並將另一個供應商 pin
為直連：

```json
{
  "proxy": "http://global-proxy.example:8080",
  "providers": {
    "regional-gateway": {
      "adapter": "openai-chat",
      "baseUrl": "https://regional-api.example/v1",
      "proxy": "http://regional-proxy.example:3128"
    },
    "direct-gateway": {
      "adapter": "openai-chat",
      "baseUrl": "https://direct-api.example/v1",
      "proxy": "direct"
    }
  }
}
```

### 操作者 pin 的 reasoning effort

在既有供應商上設定 `pinnedReasoningEffort` 可覆寫傳入的 effort 選擇，或用
`modelPinnedReasoningEfforts` 針對個別上游模型 ID 設定。逐模型的供應商 pin 優先於供應商層級
的 pin；根層級的 `modelPinnedEfforts` 映射是後備。這些是操作者設定，不是 provider registry
的預設值。它們不會改變模型探索或宣告的 effort 階梯。

```json
{
  "pinnedReasoningEffort": "high",
  "modelPinnedReasoningEfforts": {
    "example-model": "max"
  }
}
```

把這些欄位合併進既有的供應商列。接受的值為 `none`、`minimal`、`low`、`medium`、`high`、
`xhigh`、`max` 與 `ultra`。**`none` 會移除明確的 effort 欄位**；此時採用供應商的預設行為，
不保證 reasoning 真的被停用。適用的 effort 上限仍會在 pin 之後套用，供應商的傳輸對映／
正規化也可能降低或省略不支援的值。`ultra` 會在送到上游線路前先被正規化。Compaction 維護
請求不受 pin 影響。

`PATCH /api/providers?name=<provider>` 接受這些欄位。省略欄位以保留；用 `null` 清除單一值
或整個映射。映射中某個項目設為 `null` 或 `""` 會移除該項目並保留其他項目。格式錯誤的寫入
會在儲存前被拒絕。手動編輯檔案中格式錯誤的選填 pin，載入時會被忽略，不會捨棄設定的其餘部分。

### 自動審查（核准）模型選擇

Codex 會從目前回合模型的目錄列讀取 `auto_review_model_override`，用以選擇審查核准請求的
模型。`$CODEX_HOME/config.toml` 中的根層級 `auto_review_model` 設定，會為每個目錄列套用
同一個審查者；下方的供應商範圍欄位會依供應商覆寫它。[供應商指南](/zh-tw/guides/providers/#每個供應商各自的核准審查者)
有操作者的工作流程與實作範例。

`autoReviewModel` 是供應商層級的審查者目標。其值可以是同一供應商的裸模型 id（目錄列會正規化
為 `provider/model` slug），或完整的公開目錄 slug，例如 `opencode-go/deepseek-v4-flash`。
裸值會先對照該供應商自己的列解析，再對照裸目錄列解析——這正是像 `gpt-5.6-terra` 這類原生
模型的命名方式——落在該供應商之外的裸值會印出說明，指名實際供應審查者的那一列；兩者都不相符
的值則維持未解析狀態。`autoReviewModelOverrides` 的鍵是該供應商的確切上游模型 id，或該
供應商發布的別名（`modelAliases`）；兩種寫法都指向同一個路由列，其 slug 帶有上游 id。
單一項目會覆寫該模型的供應商層級值。供應商層級標記優先於根層級選擇器（只在該供應商自己的
路由列上）；根層級選擇器仍是原生列與沒有供應商標記的路由列的後備。移除某個供應商選擇器只會
清除該供應商的標記；移除根層級選擇器永不清除供應商標記。含有斜線的模型 id 可以寫成原始形式
或編碼後的目錄形式；兩種寫法都解析到同一個路由列。模型鍵保留大小寫。每次同步時，選擇器都會
獨立對照最終目錄解析，且各自 fail closed：未解析的 `autoReviewModel` 會發出診斷並且不標記
任何供應商層級列，未解析的 `autoReviewModelOverrides` 項目會發出診斷並且不標記該模型的覆寫，
因此有效的供應商層級目標仍是其後備。任何確實解析成功的選擇器仍會被套用。沒有供應商標記的
列會保留根層級選擇器，若未設定則採用正常的上游自動審查行為。規範的 `openai` 供應商不接受
這些欄位。

移除根層級選擇器會清除每一列的根層級標記，包括早期版本標記的原生列——那些早於 OpenCodex
出處標記機制。這個清理動作是依形狀辨識舊版標記：整個目錄只有一個值、且該值也出現在某個路由
列上——因此符合這個形狀的真實逐列值也會一併被清除，若目錄已偏離這個形狀，需要手動同步一次。
供應商標記永不受根層級移除影響。

`PATCH /api/providers?name=<provider>` 接受這兩個欄位。用 `null` 清除單一值或整個映射；
用 `null` 或 `""` 的映射項目移除該模型並保留其他項目。不相關的供應商儲存操作會保留先前
設定的值。

這些欄位可透過 `config.json`、供應商管理 API 與儀表板的原始 JSON 供應商編輯器使用。沒有
專屬的表單控制項。原生根層級標記會記錄先前的值，並在該標記值未被外部改動時，於移除後還原它。

### 探索到的模型顯示名稱

當供應商回傳機器友善的 id、但 Codex 模型選擇器需要更短標籤時，請使用 `modelDisplayNames`。
此映射屬於單一供應商，因此同一個模型 id 在另一個供應商下可以有不同標籤。請在 `config.json`
既有的供應商列上加入此欄位，並保留所有其他供應商設定。以下範例包含周圍必要欄位以提供情境：

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

本機 Codex 目錄中受支援的裸原生 GPT 列，也接受 `providers.openai.modelDisplayNames` 中的
確切標籤，例如 `"gpt-6-astra": "GPT 6 Astra"`。啟動時同步與本機目錄收斂都會重新套用這些
標籤。移除標籤只有在該列的顯示名稱仍與套用的覆寫相符時，才會還原原生名稱。較新的外部顯示
名稱會依既有的原生中繼資料正規化規則保留；例如 Astra（`gpt-6-astra`）仍會用其 pin 的原生
名稱取代未 pin 的名稱。標籤覆蓋層不會改變模型 ID、中繼資料（包括能力）、順序、路由 combo
別名，以及帳號限定的列。此本機目錄覆寫不會重新標記 HTTP 模型清單或虛擬 `*-pro` 列。

有效的標籤順序是：操作者的 `modelDisplayNames`、接著是供應商目錄中繼資料、最後才是一般的
`provider/model` 後備。路由選擇器仍是 `xai/grok-4.6`，上游線路模型仍是 `grok-4.6`。標籤
只影響顯示，不會改變認證、轉接器行為、路由、計費或上游請求的構造。移除映射項目只會重設該
項目的標籤。管理端客戶端可以用 `PUT /api/providers/:provider/model-display-names`，搭配
`{ "modelId": "grok-4.6", "displayName": "Grok 4.6" }` 這樣的主體，設定或重設單一標籤；
送出 `displayName: null` 即可重設。供應商 `PATCH` 不會編輯此映射，請用這個專屬的 `PUT`
端點來變更或移除標籤。

儀表板在**模型**頁面暴露相同的持久設定。展開供應商、找到已探索的模型，選擇**名稱**。對話框
會在你儲存友善標籤的同時，持續顯示確切的 `provider/model` 選擇器。選擇**重設名稱**可回到
供應商中繼資料或一般的選擇器後備。**名稱**只改變呈現方式；另外的別名鉛筆圖示才是變更短
路由別名的地方，不是顯示名稱編輯器。原生 OpenAI 與自訂模型列保留其既有的控制項。

若變更已儲存但重新整理失敗，對話框會反映已儲存的覆寫，並保持**重試**可用。當伺服器回報
目錄收斂失敗時，重試會重複該收斂；若只是清單請求失敗，重試會重新載入清單。重設復原會保留
重設操作；它不會還原舊名稱。請求有 60 秒的期限，涵蓋寫入與其後續的清單重新整理。逾時不會
撤銷寫入：在再次變更之前，請用**重試**確認目前的名稱。

## 供應商診斷對外安全

儀表板連線測試與即時模型探索使用有界的 GET-only 傳輸。在沒有對外代理的情況下，opencodex 解析主機名稱一次並僅連接到該已驗證位址。HTTPS 保留原始 Host、SNI 與憑證驗證；供應商設定無法停用憑證檢查。

這些操作使用[伺服器設定的對外 fetch](/zh-tw/reference/configuration/server/)。以 `config.proxy` 設定或繼承自 SOCKS5 `ALL_PROXY` 的伺服器 SOCKS5 代理，在目標不符合 `NO_PROXY` 時使用 OpenCodex 的內建通道。`HTTP_PROXY` 與 `HTTPS_PROXY` 保留 Bun 的原生 HTTP(S) 處理，而非 SOCKS 的 `ALL_PROXY` 不是原生 HTTP fetch 路由。URL 與字面位址檢查仍會執行，但所選代理會決定最終路由、DNS 答案與對等端，因此 opencodex 無法 pin 或驗證該對等端。這是明確的安全限制。

私有／本機目的地需要 `allowPrivateNetwork: true`，且當對外代理活躍時需要相符的 `NO_PROXY` 項目。回送會自動加入；請明確列出每個 LAN 主機，因為 CIDR 項目不被解讀。比對器支援精確主機、網域後綴、可選連接埠、方括號 IPv6 與 `*`；例如，明確列出 `192.168.1.50`。中繼資料與 link-local 目標保持被封鎖。診斷請求拒絕重新導向並回報已剝離憑證的目標。普通供應商請求的重新導向審查與此診斷防護分開。

針對 Clash / Surge / Mihomo 使用者的 fake-IP DNS 例外有兩種，且都只作用於 DNS *回應*——URL 中的字面位址仍會被拒絕。IANA 基準區段 `198.18.0.0/15`（含 IPv4-mapped IPv6 寫法）在該主機適用對外代理時被接受。Mihomo 預設的 IPv6 fake-IP 區段 `fdfe:dcba:9876::/48` 採更嚴格的門檻：必須設定與 URL 協定相符的代理變數（`https:` 對應 `HTTPS_PROXY`，`http:` 對應 `HTTP_PROXY`）或 SOCKS5 的 `ALL_PROXY`（非 SOCKS 的 `ALL_PROXY` 不算），主機不得命中 `NO_PROXY`，之後請求會被明確綁定到該代理。其他 ULA、相鄰前綴，或與真實私網回應混合的 fake-IP 回應仍需要 `allowPrivateNetwork: true`。提供者儲存時的驗證不套用此 IPv6 例外。

## Codex 帳號池

在儀表板中使用 **Codex Auth** 新增池帳號並重新整理配額。`config.json` 儲存非秘密中繼資料；access 與 refresh token 使用強化的憑證存放。池路由將新／未綁定指派、基於用量的主動切換與失敗復原分開。綁定任務通常保留親和性。預設（`pool.cacheAffinity`）下，該重新綁定會等到綁定帳號耗盡或無法繼續服務，並且只改綁到確有額度餘裕且用量嚴格更低的帳號；所有帳號都高於閾值時，綁定任務留在原帳號。關閉該設定後，`quota` 可在超過用量閾值後的下一個請求時重新綁定它，但仍只改綁到確有額度餘裕且用量嚴格更低的帳號。暫停、冷卻、重新認證與失敗處理可獨立清除或移動路由。未綁定請求沒有即時帳號綁定；這可包含代理重啟或親和性重置後的既有可見任務。Pre-stream 的 429 或 402 在同一個請求中於一個合格的備用帳號上重試一次，即使基於用量的主動切換關閉。帳號變更保留並重播對話 context，但跨帳號的供應商端 prompt-cache 重用不保證，cache 可能需要重新暖機。

在 **401/403** 時，App 登入清除該帳號的行程本地親和性並要求重新認證。
在 **429** 時，opencodex 遵循 `Retry-After`、啟動帳號冷卻、清除親和性，並可能將請求輪換到另一個合格的池帳號。這些失敗轉換在 `autoSwitchThreshold: 0` 時仍然活躍；該設定僅停用基於用量的主動切換。

暫停帳號保留其配額中繼資料，但將其排除於切換、容錯移轉、復原探測與手動啟用。它也清除該帳號的執行緒親和性。進行中的請求保留擷取的憑證；後續回合被重新路由。若每個帳號都被暫停，池路由會失敗而非靜默選擇一個。**Pause exhausted** 會用可用憑證重新整理合格帳號，並僅暫停新確認為 100% 的帳號；未知或失敗的重新整理保持不變。

| 策略 | 行為 |
| --- | --- |
| `quota`（預設） | 若無現用帳號，跨 5 小時、週與 30 天視窗選擇最低用量的合格帳號。否則將合格現用帳號保持在 `autoSwitchThreshold` 以下；在超過閾值後，未綁定請求可移至較低用量的合格帳號。預設下 cache affinity 優先於配額餘裕，綁定任務會保留到帳號耗盡（已知用量 100%）或無法繼續服務，改綁時只前往確有額度餘裕且用量嚴格更低的帳號。關閉該設定後，也可在閾值將綁定任務的下一個請求改綁到確有額度餘裕且用量嚴格更低的帳號。`0` 停用此用量驅動的重新評估，而非失敗復原。 |
| `round-robin` | 在合格帳號間均勻指派未綁定請求。輪替本身以計數器為基礎，不使用用量閾值，但共用的優先順序層級篩選仍依各帳號自身的有效閾值（帳號覆寫值，未設定則使用全域值）檢查餘裕。`accountPoolStickyLimit`（1–100）計數一次選擇上的指派，而非成功的上游回應。 |
| `fill-first` | 將未綁定請求指派到現用帳號直到冷卻、重新認證或該帳號的有效排空閾值（帳號覆寫值，未設定則使用全域值）；未知用量不強制切換。健康的綁定任務保留親和性。 |

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

## Codex 目錄與根層級 `config.toml` 設定

這些設定屬於 `$CODEX_HOME/config.toml` 的根層級，與 `approvals_reviewer` 同層；它們不是
供應商欄位。

| 欄位 | 型別 | 意義 |
| --- | --- | --- |
| `auto_review_model` | `string` | `provider/model` 形式的公開目錄選擇器，例如 `opencode-go/deepseek-v4-flash`。每次目錄合併之後，OpenCodex 都會對照最終目錄解析它，並把去除空白的值標記為目錄項目的 `auto_review_model_override`。邊界空白會被移除；選擇器以斜線分隔的組成部分則不變。若該值缺失或空白，既有的路由覆寫會被清除，並保留正常的上游自動審查選擇。若其語法無效，或在最終目錄中找不到（包括供應商／模型被移除之後），OpenCodex 只會針對該覆寫 fail closed：清除失效的覆寫、保留正常上游行為，並發出診斷。之後的同步若重新加入該供應商／模型，設定的選擇器就能再次被標記。 |

此設定會在供應商探索、模型過濾、原生／帳號列投影與合併優先序之後才被評估，因此只有出現在
那次同步產生的目錄中的選擇器，才能成為覆寫。設定被清除或無法解析時，會保留原生上游值。
Codex 為目前回合的模型讀取的是持久化的目錄欄位，這就是為什麼一個有效的設定選擇器會被複製
到每個合格的項目上。供應商範圍的選擇器（見上方）優先於這個根層級後備，並在路由列上優先生效。

### FastWire B1 能力遷移

FastWire B1 之後，Fast 能力與任意 Chat 呼叫端層級轉發彼此獨立。上方的
[供應商欄位定義](#供應商項目ocxproviderconfig)仍是權威合約；既有設定會看到以下遷移差異：

1. 宣告為 Fast-capable 的 Chat 供應商／模型，不再需要 `chatServiceTier: true` 才能使用規範
   的 Fast。發布、路由資格與注入仍需要合格的政策，以及最終轉接器上相容的 FastWire 對映。
   在已分類的路由上，`fastMode: false` 仍會移除規範的 Fast。當路由不具 Fast 能力時，設定
   `supportsServiceTier: false` 或逐模型的 `false`。
2. 在合格的已分類路由上，呼叫端拼法 `fast` 與 `FAST` 會透過 `fastWire.canonicalToWire.priority`
   正規化；呼叫端的 `priority` 仍是規範值。只有在那確實是上游的規範值時，才設定對映到
   `fast`。未分類的路由維持既有的轉發行為。
3. 逐模型的 `true` 不再授權外來的 Chat 層級，例如 `flex` 或供應商專屬值。那些仍需要
   `chatServiceTier: true`；否則會被移除並記錄為被丟棄的呼叫端層級。

明確的能力 `false` 與 Responses 呼叫端層級轉發維持既有合約。

### Anthropic Fast（`anthropic-speed`）

內建的 `anthropic`（已儲存的 Claude OAuth）與 `anthropic-apikey` 項目只為 `claude-opus-5-5`、
`claude-opus-5` 與 `claude-opus-4-8` 宣告 Fast。其他 Claude 模型未分類；這些項目沒有
供應商層級的 Fast 預設值。

Anthropic Fast **預設關閉**，因為它會以 2 倍價格消耗用量額度（訂閱）或 fast-mode 存取權
（API）。可在儀表板 Models 頁面用開／關切換逐供應商啟用，或設定
`providers.anthropic.fastEnabled: true`（`anthropic-apikey` 上同一欄位亦可）。關閉時，
這些模型不會發布任何 Fast 開關或 `--fast` 列，即使全域 `fastMode: true`，代理也絕不會送出
`speed`。Claude Code 原生透傳仍會轉送呼叫端自己送出的 `speed` 欄位（例如 Claude Code
`/fast`），因為那個請求根本不會到達代理的 Fast 政策。Cursor Fast 與其他供應商不受影響。

啟用後，合格的 `--fast` 或 Fast 選擇器會送出 `speed: "fast"`，並在既有的 `anthropic-beta`
標頭中加入 `fast-mode-2026-02-01`。代理會保留 OAuth 的 beta 值，並送出一個去重後的標頭。
`fastMode: false` 會停用這項注入。

Anthropic 的 `usage.speed` 回顯決定結果：`fast` 確認 Fast 生效，`standard` 記錄為降級，
缺失的回顯則視為未確認。只有確認生效的 Fast 用量才會取得 2 倍牌價估算（Opus 5.5 每百萬
token 輸入 $8／輸出 $40；Opus 5 與 4.8 輸入 $10／輸出 $50）。若第一次 fast 送出因需要
用量額度、組織停用 Fast、模型拒絕 `speed`，或 fast pool 為空而被拒絕，主轉接器分派可以
進行一次有預算的 standard-speed 重送。一般速率限制與容量錯誤維持既有處理方式。該請求
之後的建構都維持在 standard speed；新的一輪對話可能再次遇到拒絕。

Pro/Max 上的訂閱 Fast 需要用量額度；Team/Enterprise 組織還需要管理員啟用。第一方 API 的
Fast 是需要存取權的研究預覽。存取與計費條款請見
[Anthropic Fast mode](https://platform.claude.com/docs/en/build-with-claude/fast-mode) 與
[Claude Code Fast mode](https://code.claude.com/docs/en/fast-mode)。

### Cursor Fast（`cursor-variant`）

Cursor 沒有 `service_tier` 欄位。它的 fast 產品是不同的**模型變體**——
`claude-opus-5-thinking-high-fast`、Grok 4.5/4.6 的 `{id:"fast",value:"true"}` 請求參數，
或 Grok 4.7 的扁平化 `grok-4.7-{effort}-fast` 線路 id——因此 Cursor 項目宣告
`fastWire.kind: "cursor-variant"`，由請求建構器解析該變體，而不是設定請求欄位。

只有確實宣告 fast 變體的基礎模型才會宣告 Fast：`claude-opus-4-7`、`claude-opus-4-8`、
`claude-opus-5`、`claude-opus-5-5`、`grok-4.5`、`grok-4.6`、`grok-4.7`。其他每個 Cursor
列都發布 `supportsServiceTier: false`，因此 Codex 不會顯示一個失效的開關，而是完全不顯示。

某個基礎模型的總覽列，會把 thinking 升級路由到它的**thinking-fast** 變體，而不是一般的
fast 同輩——那個同輩是不同的產品，effort 階梯較短，而且對 `claude-opus-5` 而言，它的一般
系列已在上游被隔離。

`fastMode` 在每個介面上的行為不同，因為只有 Codex 有自己的 Fast 開關：

| 介面 | `fastMode: true` |
|---|---|
| Codex | 列維持總覽列；應用程式的 Fast 開關選擇該變體 |
| Claude Code（`?ids=cli`） | 列出 fast 身分，例如 `ocx-claude-cursor--claude-opus-5-thinking-fast` |
| OpenAI `/v1/models` | 列出 `cursor/claude-opus-5-thinking-fast` |
| Claude Desktop（3P） | 不變——其別名是從模型名稱雜湊而來 |
| 儀表板 `/api/models` | 列 id 不變；它們就是啟用／停用的鍵 |

無論如何請求都會被升等：設定 `fastMode: true` 時，選擇總覽 id 仍會解析到 fast 變體，因此
儲存設定早於這次切換的客戶端不需要重新探索。每個舊版變體 id 都維持既有路由不變。

### xAI Priority Processing

內建的 `xai` 預設在兩種傳輸上都支援 Fast，範圍不同。API-key 模式指向
`https://api.x.ai/v1`；解析到 `openai-chat` 的路由透過 Chat Completions 送出
`service_tier: "priority"`，而模型預設值與覆寫可以改選 `openai-responses` 傳輸。
`ocx login xai` 則是儲存 Grok 訂閱 gateway 的 OAuth 憑證
（`https://cli-chat-proxy.grok.com/v1`；這些憑證會自動 refresh），在這裡 Fast 依模型分類
（2026-09-13 與 2026-09-23 實測）：grok-4.7、grok-4.6、grok-4.5、grok-4.3、
grok-4.20-0309-reasoning、grok-4.20-0309-non-reasoning、grok-build-0.1 與
grok-composer-2.5-fast 在 Grok OAuth 上接受 `service_tier: "priority"` 並回顯它，因此這些
列宣告 Fast、接受 `--fast` 選擇器，並在任一線路上轉發呼叫端送出的層級。
grok-4.20-multi-agent-0309 被排除：該 gateway 在收到 `priority` 時回答
`service_tier: "default"`，因此它維持未分類，其呼叫端層級不會被轉發。未列出的模型在兩種
傳輸上都維持未分類。

xAI 對 Priority Processing 的輸入、輸出、快取與 reasoning token 都收取標準 token 價格的
2 倍；快取折扣會在乘數之前套用。成本估算只有在 xAI 的回應確認 `service_tier: "priority"`
時才使用該溢價。缺失或無法解析的回應層級不算確認，回顯 `default` 則是降級；三種情況都維持
標準價格。

對 `grok-4.6` 與 `grok-4.7`，每百萬 token 的標準費率為輸入 $2.00、快取輸入 $0.50、輸出
$6.00。至少 200,000 token 的 prompt 會讓整個請求改用 $4.00 / $1.00 / $12.00 計價。xAI
尚未公布這個長 context 級別如何與 Priority Processing 疊加。當長 context 回應確認
`priority` 時，儀表板會顯示已公布的長 context 成本並加上 `≥` 標記與下界說明；它絕不會
自行發明疊加後的乘數。

### OpenRouter Fast

規範的 `https://openrouter.ai/api/v1` 預設只為以下確切的 OpenAI 後端模型 slug 宣告 Fast：

- `openai/gpt-5.6-sol`
- `openai/gpt-5.6-terra`
- `openai/gpt-5.6-luna`

`anthropic/claude-sonnet-5` 與未宣告的 OpenRouter 模型維持未分類。刻意不設定供應商層級的
`supportsServiceTier` 預設值，且使用者設定的 `supportsServiceTier: false` 仍會停用逐模型
宣告。這些登記值只在該供應商仍指向規範 OpenRouter base URL 時才適用；同名的自訂目的地不會
被假定共用 OpenRouter 的合約。

Fast 會送出 `service_tier: "priority"`。它不會新增或改寫 `provider.only`、`provider.order`
或 `provider.allow_fallbacks`。OpenRouter 文件說明 priority 端點是第一路由選擇，priority
容量不足時會優雅回退到其他端點。計費依實際使用的端點計算，回應會回報實際的頂層
`service_tier`。因此 pin 住層級端點並停用回退，只會降低可用性，而不會提升計費安全性。

請求日誌以該回應回顯為權威來源。`priority` 確認 Fast 已套用；`default` 記錄為降級並使用
標準價格估算；缺失的欄位會讓該次嘗試維持假定狀態，而不是猜測為降級。OpenRouter 的
priority 乘數依上游而異，此處不內建。當 priority 已確認但沒有已知的確切 priority 價格時，
儀表板會保留標準價格估算作為已記載的下界，並加上 `≥` 前綴；降級的嘗試沒有下界標記。

API-key 供應商可以持有字面金鑰或環境變數參照。OAuth 供應商使用 `ocx login` 填入的憑證
儲存區；訂閱後盾的 Claude Code 啟動行為設定在
[`claudeCode.authMode`](/zh-tw/reference/configuration/server/#claude-codeclaudecode)。

OrcaRouter 明確暴露兩種形式：`orcarouter` 是手動的 API-key 供應商，`orcarouter-oauth` 執行
帶 S256 PKCE 的瀏覽器同意流程，然後把回傳的持久 API 金鑰儲存為帳號憑證。公開預設值刻意把
認證（`https://www.orcarouter.ai`）與推論（`https://api.orcarouter.ai/v1`）分開。若要用
單一 origin 的自架部署，請在第一次帳號登入前設定 `ORCAROUTER_BASE_URL`；若要用分開的
origin，請用 `ORCAROUTER_AUTH_BASE_URL` 與 `ORCAROUTER_API_BASE_URL`。對於 loopback／私有
的自架端點，**在第一次登入之前**，請先建立或更新 `providers["orcarouter-oauth"]`，設定
`adapter: "openai-chat"`、預期的 `baseUrl`、`authMode: "oauth"`，並明確設定
`allowPrivateNetwork: true`。登入會保留這個操作者設定，絕不會從 URL 覆寫中授予它。若未設定，
目的地驗證會拒絕該本機端點用於推論與模型探索。OAuth 瀏覽器 callback 監聽器本身不需要這個
供應商選用設定。請見[OrcaRouter 設定範例](/zh-tw/guides/providers/)。

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
