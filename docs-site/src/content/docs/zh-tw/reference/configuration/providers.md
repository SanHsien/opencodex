---
title: 供應商設定
description: 供應商項目、認證、端點、模型目錄、配額、context 上限與供應商專屬選項。
---

供應商告訴 opencodex 模型在哪裡、它使用哪種 wire adapter，以及請求如何被認證。

## Runcrate 免費供應商目錄項目

Runcrate 已列入免費供應商目錄，透過 OpenAI 相容的 `https://api.runcrate.ai/v1` 端點連線，需要 API 金鑰。目錄預載六個有有限免費額度的開放模型，也會探索完整付費目錄。免費額度要求 GitHub 帳號至少建立 30 天，受每個 session 與每週限制，並由 workspace 共用。其他探索到的模型須付費。當免費額度用完或免費容量忙碌時，有餘額的 workspace 會繼續產生付費流量；沒有餘額則停止請求，直到額度或容量恢復。使用前請確認 [Runcrate 免費方案條款](https://www.runcrate.ai/inference/free)。

## DeepSeek：token 與影像位元組

DeepSeek 記載了另一項獨立的 [48 MiB 請求主體上限](https://api-docs.deepseek.com/guides/files_api/)。
充滿大量螢幕截圖的工作階段可能在 token 上下文填滿前就先觸及該上限；調高
`model_auto_compact_token_limit` 無法防止這件事。

上傳功能**預設關閉**。如果你接受影像在 DeepSeek 的伺服器上獨立保存一小時，請在你的供應商上設定
`modelCapabilities: { "deepseek-flash": { deepseekImageFiles: true } }`。
對該軸或模型項目 PATCH `null` 可清除此選擇加入。

對於第一方 Responses URL 上選擇加入的模型，超過 40 MiB 的請求主體會將較舊的內嵌影像替換成
[Files API 參照](https://api-docs.deepseek.com/guides/files_api/)，目標降至 32 MiB。
影像位元組、歷史紀錄與 token 用量維持不變。檔案會要求一小時到期；即使生成失敗，
已完成的部分上傳仍會保留到到期為止。有界的參照快取依憑證隔離，最長持續 50 分鐘
（若供應商回報更早到期則更短）。重試可重用成功上傳的檔案；另一個憑證會上傳自己的複本。

只有 `user` 與 `developer` 訊息影像以及工具輸出影像會被上傳；DeepSeek 會拒絕其他角色中的影像，
因此那些絕不會被持久化。
外部閘道與 Chat Completions 維持不變。明確的 `detail: low` 會保持內嵌，因為檔案參照會忽略它。
失敗時會直接停止，不會丟棄影像或重試生成。修復作業有 60 秒的上傳期限、128 MiB 的輸入上限，
以及最多同時兩個準備作業；供應商的節流／並行控制依然適用。過大的文字或無法轉換的影像仍需要壓縮；
這項傳輸修復不會擴展模型的上下文視窗。

## Mistral：每個請求的圖片數量

Mistral 限制單一 API 請求可攜帶的圖片數量，且計入重放歷史中每一輪的圖片。其[視覺指南](https://docs.mistral.ai/capabilities/vision/)記載為 8 張，多數 Mistral 視覺模型會以 HTTP 400 拒絕第 9 張。有些模型可接受更多：實測上限為 `deepseek-v4-1-flash-1017` 20 張（超過時回覆不透明的 HTTP 503、代碼 `3800`）、`mistral-large-4` 與其別名 `mistral-large-4-0` 100 張，`zai-glm-5-3-flash` 則到 256 張都沒有被拒絕。若不修剪，含大量螢幕截圖的長工作階段會在每一輪失敗，即使 token 上下文仍有空間。

對第一方 Chat 目的地（`https://api.mistral.ai/v1/chat/completions`），opencodex 只在送出的請求中保留上限內最新的圖片，並把較舊的圖片換成簡短的文字說明；轉譯後的 Responses 輪次與原生 Chat Completions 請求都適用。用戶端歷史與壓縮維持不變；token 用量是 Mistral 針對實際送出（替換之後）的請求所回報的數字。從工具結果提升而來的圖片與其他圖片一樣計算。實測上限以 registry 的 `modelCapabilities` 列提供，所以改名但仍指向 Mistral 目的地的供應商會保留它們；其他模型一律使用 8。要為某個模型宣告自己的上限，請使用 `modelCapabilities: { "mistral-small-2603": { mistralMaxImages: 8 } }`（1 到 1000 的整數）。宣告的優先順序高於 registry 列，對該軸 PATCH `null` 會移除它。
只有 `image_url` 或 `image_url.url` 中含有非空字串的 `image_url` 部分才會計入上限；此檢查不會驗證 URL 語法或可達性。抵達限制器時影像參照缺失、空白或非字串的部分，會在對外複本中被替換為 `[image omitted: missing or malformed image URL]` 而不消耗上限，即使有效影像數量低於上限亦同。對於轉譯後的 Responses 請求，剖析器會在限制器執行之前丟棄沒有可用影像 URL 或檔案 ID 的 `input_image` 區塊。在訊息內容或工具輸出中帶有非空 `file_id` 卻沒有非空 `image_url` 的項目，會在派送給 Mistral 之前被轉譯後轉接器的媒體防護拒絕；而在重放的 `agent_message` 內（其內容不受該防護檢查），剖析器則會改為發出 `[image: <file id>]` 文字標記，作為一般文字傳送且不消耗影像上限。

修剪不會新增獨立的上傳或持久化；保留在上限內的圖片會隨送出的請求傳給 Mistral，其他目的地不變。

## GPT-6.1 Terra

[GPT-6.1 Terra](https://openai.com/index/introducing-gpt-6-1-terra/) 於 2026 年 10 月 26 日發布，作為 GPT-5.6 Terra 的後繼。`gpt-6.1-terra` 與 `gpt-5.6-terra` 並存可用；預設模型與子代理名冊皆不變。GitHub Copilot 使用 Responses；OpenRouter 列出 `openai/gpt-6.1-terra`，上下文 1,050,000，每 1M token 輸入 $1.00／輸出 $5.00。

原生 Codex：預設上下文 500,000，長上下文上限 872,000，預設 effort 為 `low`，階梯為 `low`、`medium`、`high`、`xhigh`、`max`、`ultra`。原生 `ultra` 在線路上以 `max` 送出。原生資料列只提供 Fast。

[OpenAI API](https://developers.openai.com/api/docs/models/gpt-6.1-terra)：上下文 1,050,000，最大輸出 128,000；文字／圖片輸入與文字輸出；知識截止日 2026-06-01。Effort：`none`、`low`、`medium`（預設）、`high`、`xhigh`、`max`。端點：`v1/responses` 與 `v1/chat/completions`；工具呼叫需要 Responses。

每 1M token：輸入 $1.00、快取輸入 $0.05、快取寫入 $1.25（30 分鐘）、輸出 $5.00。輸入超過 272,000 token 時，整個請求的輸入／快取按 2×、輸出按 1.5× 計價：分別為 $2.00 / $0.10 / $2.50 / $7.50。Fast 模式費用為 2×。

## 自訂供應商的上下文視窗

當自訂供應商省略模型的上下文視窗時，OpenCodex 可以從內建的模型中繼資料推斷它。此功能預設關閉：
在供應商上設定 `inferContextWindow: true` 即可開啟。未開啟時，沒有視窗的模型會改用已啟用的 Context cap 作為其視窗，
若無則退回至 128k 相容性後備。開啟後，優先順序為：探索到／已設定的上限（較小者勝出）、Azure 中繼資料、
模型 ID 中繼資料、已啟用的 Context cap 作為視窗，然後是 128k。已啟用的 Context cap 仍會限制結果。
內建供應商維持既有行為並忽略此旗標。

`GET /api/providers` 僅在已設定時才包含 `inferContextWindow`，同時保留 `true` 與 `false`。若要變更它，
`PATCH /api/providers?name=<provider>` 接受 `true`、`false`，或 `null` 以清除設定並恢復預設關閉行為；其他型別回傳 `400`。
省略它會保留目前設定。同名的 `POST /api/providers` 也會保留被省略的設定，包括 `false` 與儲存驗證期間提交的任何變更。
送出的布林值一律勝出，包括 `false`，即使原本儲存的值為 `true`。

```json
{ "providers": { "my-relay": { "adapter": "anthropic", "baseUrl": "https://relay.example/v1", "inferContextWindow": true } } }
```

原廠廠商 API 資料表優先於聚合器資料表。精確 ID 優先；只有在沒有歧義時才會接受大小寫與點／連字號變體。
未知 ID、浮動的 `~` 別名與衝突的比對不會被猜測。OpenAI API 視窗並不代表 Codex 訂閱上限。
推斷出的視窗會影響 Codex 的壓縮預算及其他已連線用戶端的目錄（包括 Claude 長上下文選取），
但會與斷言的路由容量分開記錄。

相符的模型 ID **並不**代表已驗證你的中繼站實際容量。如果它實際提供的容量小於廠商視窗，
請在進行長工作階段之前先設定 `modelContextWindows` 或該供應商的 **Context cap**。
OpenCodex 不會自動啟用上限或探測模型。較小請求的成功並不能證明推斷的完整視窗都能運作。既有的已設定視窗仍保有控制權。

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
| `disabledModels?` | `string[]` | — | 對 Codex 目錄與 `/v1/models` 隱藏的模型，但不阻擋直接代理呼叫。路由 id 從清單中移除；帳號限定原生 id 只隱藏該選擇器列；裸原生 GPT id 會隱藏裸列以及該模型的每個帳號選擇器列。儀表板的 Models 頁面只顯示路由列與裸原生列；若要隱藏單一選擇器限定列，請直接使用此設定欄位。將 [`omitDisabledNativeModels`](/zh-tw/reference/configuration/catalog/) 設為 `true` 可改為省略已停用的原生列；預設關閉。 |
| `providerContextCaps?` | `Record<string, number>` | `{}` | 各供應商目前生效的上下文上限。一般視窗只能縮小；支援長視窗的原生模型可以擴展到該模型支援的上限。 |
| `providerContextCapValues?` | `Record<string, number>` | `{}` | 各供應商最後選擇的上限，停用後仍保留。僅儲存這些值不會啟用上限。生效中的值優先於儲存的選擇值。 |
| `contextCapValue?` | `number` | `350000` | 首次啟用時使用的預設值。再次啟用時恢復該供應商的選擇值。修改全域值時附帶 `setAll: true` 只會更新已啟用的上限；不帶值的 `setAll: true` 會以目前全域值啟用所有已設定供應商的上限。 |
| `codexAccounts?` | `CodexAccount[]` | `[]` | 由 Codex Auth 管理的 ChatGPT/Codex 池帳號中繼資料。秘密分別存在 `codex-accounts.json`。 |
| `pausedCodexAccountIds?` | `string[]` | `[]` | 被排除於池選擇直到恢復的帳號，包含暫停時的主 `__main__` 帳號。手動暫停與恢復也會更新同一帳號與工作區的既有主帳號與池項目。 |
| `codexUseRemainingQuotaAccountIds?` | `string[]` | `[]` | 選擇加入「使用剩餘內含配額」的帳號。停用所列帳號的主動用量切換；對於 `__main__`，生效的短／長硬鎖門檻會變成 100%。原始門檻仍會保留，停用此選項後恢復套用。暫停、認證、資格檢查、冷卻與付費點數權限仍然適用。由 `ocx account use-remaining openai <id-or-main> on` 管理；此持久化偏好不會選取該帳號。 |
| `creditCodexAccountIds?` | `string[]` | `[]` | 允許在達到用量上限後繼續使用 ChatGPT 點數服務的帳號，包含主 `__main__` 帳號。上游不會拒絕在 100% 時仍持有點數的帳號；它會處理請求並扣除餘額。消費點數為選擇加入：未列於此處的帳號，當其任一用量視窗（週或月，30 天方案僅有月，或 5 小時視窗）讀數為 100% 且重設時間尚未到時，選擇器會略過它，直到重設時間過後才恢復。沒有重設時間的週或月讀數不會保留該帳號；沒有重設的 100% 五小時讀數只有在該讀數仍新鮮時才會保留它。當沒有其他帳號可用時，自動選擇會回報找不到帳號，而不會消耗點數。當請求指名或攜帶未列名的 `__main__` 憑證時，該帳號也會如同硬鎖拒絕一樣被拒絕。將 `__main__` 列入此處不會解除主帳號硬鎖（預設在 98% 開啟），它仍會先擋下主登入；請關閉硬鎖才能讓主帳號消耗點數（100% 的鎖仍會在 100% 擋下）。新帳號預設不列入。由 Codex Auth 頁首的 **Use credits** 開關與各帳號卡片 **⋯** 選單中的 **Use credits after limit** 開關管理。 |
| `codexQuotaAutoRefresh?` | `Record<string, object>` | `{}` | 在 Pool 模式下，每個 Codex 登入帳號可選擇加入的 `fiveHour` 與 `weekly` 視窗自動啟用；Direct 模式不執行此背景工作。在 Providers／Codex Auth 的**進階設定**中，一個控制項可為目前所有 main 與已新增帳號一次啟用或停用這兩個支援的視窗。新帳號不會自動選擇加入。啟用時會略過即時 WHAM 資料中不存在的視窗；停用時也會清除過期的已啟用視窗。介面重用細粒度的 `/api/settings` 寫入、協調部分失敗，並重試原本的開／關意圖，不會取代不相關的設定或已完成的重設標記。API 仍會以 HTTP 409 拒絕啟用一個不可用的視窗。在回報的重設時間點，opencodex 會用該帳號的配額送出一則最小、不儲存的 Codex 訊息，並持久化已啟用的時間戳記。這不適用於 API-key 供應商。 |
| `codexAccountNamespaces?` | `Record<string, string>` | — | 從任意公開模型選擇器到已儲存 Codex 帳號目標的選用映射。啟用帳號限定 picker 列時，每個目標存在的選擇器都會為 Codex picker 新增獨立的 `<selector>/<native-openai-model>` 列；每一列只使用該帳號。只要有任一選擇器生效，picker 中的裸原生列就會被隱藏，但除非明確停用，其 id 仍可路由，並會列在原始的 `/v1/models` 中。 |
| `codexAccountPickerEnabled?` | `boolean` | map 為空時關閉 | 控制合格的 `codexAccountNamespaces` 映射是否產生帳號限定的 Codex picker 列。`true` 允許已映射的列出現。若省略且 map 非空，為向下相容視為啟用；若 map 為空，則視為關閉。`false` 會隱藏產生的列並恢復裸原生 picker 列，但不會刪除映射，也不會停用精確的 `<selector>/<native-openai-model>` 路由。 |
| `activeCodexAccountId?` | `string` | — | 為下一個請求手動選擇的池帳號。選擇清除執行緒親和性；進行中的請求保留擷取的憑證。 |
| `codexAccountPriorities?` | `Record<string, number>` | — | Codex 池的逐帳號選擇順序：帳號 ID → `-100` 到 `100` 的整數，**數值越大越優先使用**，省略代表 `0`。這是排序邊界而非資格邊界：選擇會先將已具備資格的帳號縮小至仍有配額餘裕的最高層級，再由 `accountPoolStrategy` 在該層級內挑選。只有當層級內每位成員都達到或超過各自非零的有效用量門檻（帳號覆寫或全域預設）、正在冷卻、被軟性避開、已暫停或需要重新認證時，該層級才會被跳過——未知配額絕不會排空一個層級。排序絕不會讓無資格的帳號變得可選，且預設絕不會重新綁定已經有帳號的執行緒。主 `__main__` 帳號以平等地位參與，這正是讓 Codex Desktop 登入最後才耗盡的方式。沒有項目時，池行為與先前完全一致。格式錯誤的 map 會發出主控台警告並被忽略（關閉排序，不修復設定）。由 `ocx account priority` 與 Codex Auth 頁面管理。 |
| `activeCodexAccountPinned?` | `string` | — | 操作人員上次手動選取的帳號 ID。設定期間，較高的 `codexAccountPriorities` 層級無法搶占它，直到該釘選因耗盡、排除、刪除或明確容錯移轉／提升離開而釋放。上限層級內的普通 round-robin 移動不會釋放它。寫入任何 `codexAccountPriorities` 項目也會釋放該釘選，因此建立順序之前的釘選不會壓過之後設定的順序。`GET /api/codex-auth/active` 會同時回報生效帳號是否被釘選（`pinned`）以及承載上限的帳號（`pinnedAccountId`）。 |
| `codexPreserveSignedInAccount?` | `boolean` | `false` | 優先於符合其所選工作區與成員電子郵件的原生主帳號與一般項目，先使用其他合格的 Codex 池身分。各群組內保留既有的自訂優先順序。健康的綁定與手動釘選維持不變；精確帳號路由與 Direct 模式不受影響。後備仍可能在所有既有防護下消耗已登入配額。請使用 [account preserve-signed-in](/zh-tw/reference/cli/providers-accounts/#ocx-account-preserve-signed-in-openai-onoffstatus---apply-to-bound---json) 查看狀態或進行明確的下一次請求綁定轉換。 |
| `codexAccountPriorityFailback?` | `boolean` | `false` | 選擇加入在 `quota` 策略下將進行中的 Codex 池任務送回可用的更高優先順序帳號。請求最多每五分鐘觸發一次背景配額重新整理（含失敗的重試嘗試）。當近期的配額觀測顯示有餘裕時，即使目前帳號低於門檻，下一個請求也可能會重新綁定。此明確偏好可能會丟棄溫熱的 prompt 快取；它不改變預設的快取親和性。沒有請求就不會輪詢。手動釘選、模型存取、冷卻、暫停與重新認證排除依然適用；進行中的請求保留其擷取的帳號。要求目前來源帳號的有效門檻必須為正數（覆寫為 0 會停用它；正數覆寫可搭配全域 0 運作）；精確帳號路由與 Direct 模式不受影響。 |
| `autoSwitchThreshold?` | `number` | `80` | 配置新／未綁定工作的主動切換用量閾值。`quota` 可在下一個請求時重新評估未綁定任務。綁定任務預設（`pool.cacheAffinity`）在越過閾值後仍會保留帳號，直到該帳號耗盡或無法繼續服務，並且只改綁到確有額度餘裕且用量嚴格更低的帳號。將 `pool.cacheAffinity` 設為 `false` 才會在此閾值重新評估綁定任務。`fill-first` 僅將其用作未綁定指派的排空點；`round-robin` 僅在新／未綁定工作指派時使用它：只要仍有低於自身有效閾值的合格帳號，就略過達到或超過閾值的帳號，且不會因此移動已綁定任務。分數使用最熱的已知 5h、週或 30d 配額視窗。`0` 僅停用基於用量的主動切換，而非未綁定指派或失敗復原。 |
| `codexAccountAutoSwitchThresholds?` | `Record<string, number>` | — | 各帳號對 `autoSwitchThreshold` 的覆寫：帳號 ID → `0`–`100` 的整數。沒有項目時繼承全域值；`0` 只在該帳號作為來源時停用使用量主動切換。`quota` 在評估綁定任務重評估與未綁定切換時使用目前來源帳號的有效門檻。Fill-first 排空與選擇順序層級餘裕則是對照每個帳號自己的有效門檻來評估；主帳號釘選與子代理後備也使用相關帳號的有效門檻。支援主帳號 `__main__`。格式錯誤的 map 會發出警告並被忽略。可在 Codex Auth 頁面的各帳號卡片中管理；停用覆寫會移除該項目。啟用覆寫時，會將目前全域閾值複製為固定的帳號值。覆寫值（包括 `0`）在之後修改全域閾值時仍優先。停用時傳送 `threshold: null`，刪除項目，並恢復繼承目前全域閾值及其未來的變更。 |
| `accountPoolStrategy?` | `"quota" \| "round-robin" \| "fill-first" \| "reset-first"` | `"quota"` | 新／未綁定 Codex 請求的指派策略。當請求沒有即時（父執行緒 id、配額 scope）親和性時即為未綁定；帶有工作階段 ID 的請求（包括一般 Codex CLI 和 App 回合及子代理），或錨定到直接父任務的無工作階段請求，其綁定在關閉時最後一次親和性儲存成功的情況下，代理正常重啟後可保留，閒置時間最長為 24 小時。更深層的無工作階段鏈和 Codex App 主要登入的綁定僅保留在記憶體中，重啟後會重新指派；驅逐、帳號刪除、重新登入、崩潰或親和性重置仍可能使任務未綁定。`quota` 在無現用帳號時選擇最低用量的合格帳號，將合格現用帳號保持在 `autoSwitchThreshold` 以下，且在閾值後可將未綁定請求移至較低用量的合格帳號。綁定任務依循 `pool.cacheAffinity`（預設開啟），會保留到帳號耗盡（已知用量 100%）或無法繼續服務，改綁時只前往確有額度餘裕且用量嚴格更低的帳號。將該旗標設為 `false` 可在閾值將綁定任務的下一個請求主動改綁到確有額度餘裕且用量嚴格更低的帳號。`round-robin` 在有效 `autoSwitchThreshold` 以下的合格帳號間均勻分配未綁定請求，若全部達到或超過閾值則在所有合格帳號間分配；`fill-first` 持續將未綁定請求指派到現用帳號直到冷卻、不可用或設定的排空閾值。`reset-first`：在低於用量門檻的帳號中，優先選擇下次 5 小時或週額度重設最早的帳號。已綁定任務遵循設定的親和策略。獨立模型額度按用量排序。此排序不使用月額度重設時間。在所有策略下，透過 `/v1/messages` 抵達 Codex 帳號路由的 Claude Code 回合，會依其 Claude 工作階段綁定：優先使用呼叫端的 `session_id`/`session-id` 別名，否則使用 metadata session，再否則使用 `x-claude-code-session-id`；綁定以伺服器持有的密鑰繫結至已准入的憑證（或本機 loopback 使用），使呼叫端無法共用、猜測或重用其他憑證的綁定。綁定只用來挑選帳號；送往上游的標頭不變。產生（spawn）回合以及已帶有 `x-codex-parent-thread-id`、`thread-id` 或完整 session/thread 配對的回合會保留自己的身分。已綁定的工作階段通常會停留在同一個帳號；上述的親和性與失敗復原規則仍可移動它。 |
| `pool.cacheAffinity?` | `boolean` | `true` | 綁定 Codex 執行緒的 cache-affinity 排序，獨立於 `pool.kernel`。預設開啟；省略該鍵或設為 `true` 會讓綁定任務留在其帳號直到該帳號真的無法服務。只有明確設為 `false` 才會恢復依閾值重新綁定。即時綁定優先於配額餘裕：`quota` 不會只因用量越過 `autoSwitchThreshold` 就移動執行緒。帳號暫停、無法使用或真正耗盡（已知用量 100%）時仍會離開，且只改綁到確有額度餘裕且用量嚴格更低的帳號。在任一設定下，用量未知的帳號絕不會作為綁定任務的改綁目標，因此當所有帳號都高於閾值時任務會留在原地。親和性是重排而非釘死。 |
| `pool.credentialGroups?` | `Array<{ id: string; credentials: string[]; note?: string }>` | `[]` | 已接受並驗證，但尚未被路由消耗：宣告群組在消費層實作落地前不會改變任何路由決策。操作者宣告的配額網域：確實共享同一上游用量上限的憑證群組。同一群組的成員對可用容量只計為一次，而群組內的配額拒絕也不會藉由輪換到另一名成員來處理——上限是同一個，移動只會付出冷前綴代價而得不到新容量。宣告的群組只針對配額；共享上限並不代表 prompt 快取相容性，那部分分開分類。每個成員以供應商限定形式寫為 `"<provider>:<credential-id>"`，因為憑證 ID 只在所屬供應商內有意義；供應商區段接受常見別名（`chatgpt:` 與 `codex:` 皆指 OpenAI）。群組 ID 必須唯一，`credentials` 不可為空，且同一憑證最多只能出現在一個群組中——有歧義的宣告在寫入時會被拒絕，在載入時會發出警告並丟棄，而不會依最先列出的群組來決斷，以免合併兩個無關的配額網域。格式錯誤的清單只會損失分組：`pool.kernel` 與 `pool.cacheAffinity` 會保留。省略或空陣列代表沒有宣告分組，未設定的安裝行為與先前完全相同。 |
| `accountPoolStickyLimit?` | `number` | `1` | 在前進一個 round-robin 選擇前保留的新／未綁定任務指派；計數器在任務綁定時前進，而非在上游成功後。範圍 1–100。 |
| `upstreamFailoverThreshold?` | `number` | `3` | 未來新 session 容錯移轉前的連續暫時性失敗。設 `0` 停用。對一般 Responses 與原生 compact 傳送而言，已證實的連線建立前 DNS/TCP 可達性失敗會在供應商主機層級被追蹤：它們絕不會影響帳號健康狀態、帳號冷卻、執行緒／session 親和性、現用帳號選擇或池路由，也絕不會計入這個閾值。 |
| `codexFailureWindow?` | `boolean` | `true` | 用於新 Codex 執行緒的 60 秒滑動暫時性失敗率，與連續計數併用。至少 20 個樣本且失敗率 ≥25% 時會將帳號標記為降級；比率維持 ≤10% 達 30 秒後清除。降級帳號只會在挑選新執行緒時被跳過，已有綁定的執行緒會留在原帳號。設 `false` 則只依連續計數導向。 |
| `codexPinnedTransientPolicy?` | `"hold" \| "detour-new-threads"` | `"hold"` | 手動釘選帳號處於失敗視窗時，`hold` 會繼續把新執行緒送給它並記錄降級警告；`detour-new-threads` 只把新執行緒放到其他帳號。絕不會移動進行中的回合，也不會重送已送出的回合。 |
| `codexWsReuseAcrossTurns?` | `boolean` | `false` | 選擇加入同一帳號與執行緒的 Codex WebSocket 跨回合重用。開啟後，忙碌中的 socket 在再次撥號前最多等待 750ms，模型或 service tier 變更時最多保留兩個 socket，而 turn-state 標頭會留在每則訊息而非握手中。認證、帳號、代理或撥號 URL 變更仍會淘汰舊 socket。 |
| `upstreamHostCircuitThreshold?` | `number` | `0` | 針對原生 OpenAI forward Responses 與 compact 傳送上已證實的連線建立前 DNS/TCP 失敗，選用的斷路器閾值。`0` 停用；`1`–`20` 表示在該數量的終端邏輯請求後，開啟 30 秒的供應商來源冷卻。開啟期間，請求會在帳號選擇或上游傳送之前就收到帶 `Retry-After` 的 `503`；冷卻結束後，會放行一個半開請求。逾時與 HTTP 回應都不計入，任何 HTTP 回應都會關閉斷路器。只適用於沒有釘選帳號的 Codex Pool 路由；對 `codexAccountMode: "direct"` 與帳號限定選擇器無效。 |
| `maxUpstreamBodyBytes?` | `number` | `0` | 選用的上限（位元組），套用於序列化後的原生 Responses **passthrough** 請求主體。`0` 或省略即停用——不會為任何目的地推斷限制。設定後，超過上限的已建構主體會在傳送前於本機被拒絕：串流回合會收到終端的 `response.failed` / `context_length_exceeded`，讓客戶端改為壓縮而非重送；非串流回合則收到 `413`，其中指出大小、內嵌 `input_image` 項目的數量，以及大約代表多少 MB 的影像資料。此檢查會在每個建構與重建點執行，包括 OAuth 重新整理後的重播與替代帳號重試。轉譯後的 adapter 路徑不在涵蓋範圍內。這裡刻意沒有預設值：唯一有實測上限的是 WebSocket 傳輸，而它對超大回合本來就會退回 HTTP，所以預設值會拒絕目前能成功的請求。當你的閘道有已知的請求大小限制，而你寧可看到可處理的本機錯誤而非不透明的上游失敗時，才設定它。 |
| `maxInboundBodyBytes?` | `number` | `0` | 選用的上限（位元組），套用於解壓縮後的**進站**資料平面請求主體——是上面 `maxUpstreamBodyBytes` 的鏡像。`0` 或省略維持內建的 256 MiB 預設值。當大 context session 已經無法壓縮時，請調高它：Codex 會把整段歷史重播給壓縮模型，因此在 922k token 選擇加入視窗上，壓縮請求本身就是超過上限的那一個，讓 session 卡在唯一能讓它縮小的操作上。範圍限制在 1 MiB–512 MiB。這個上限沒有商量餘地：讀取器會將主體具現化好幾次（線上位元組、解碼後位元組、解碼後字串，以及解析出的物件圖），所以尖峰記憶體是被允許大小的倍數，不設上限就是一個記憶體耗盡的槓桿。適用於 `/v1/responses`、`/v1/responses/compact`、`/v1/chat/completions`、`/v1/messages`，以及[傳入主體准入](/zh-tw/reference/inbound-body-admission/)所列的圖片、搜尋與 token 計數路由。監聽器的接受大小在代理繫結時就固定，所以變更要重新啟動才會生效。超過限制的主體會在本機以 HTTP 413 拒絕，並附上 `code: "inbound_body_too_large"`，這與供應商大小拒絕產生的 `context_length_exceeded` 413 刻意不同。生效上限超過 256 MiB 時，也會啟用由 `maxConcurrentInboundBodyBytes` 控制的共用准入閘門；僅提高此單次請求上限不會提高該預算。 |
| `maxConcurrentInboundBodyBytes?` | `number` | `536870912` (512 MiB) | 選用的頂層共用准入預算，單位為位元組，只在生效的 `maxInboundBodyBytes` 超過 256 MiB 時啟用。省略、`0` 或無效值都會使用不變的 512 MiB 預設值。有效的正整數在使用時限制在 512 MiB 至 2 GiB（`536870912` 至 `2147483648`）範圍內。變更後必須重新啟動；同一程序內的所有監聽器共用一個預算。這是准入計量，並非預先配置的記憶體、RSS 上限或依 RAM 自動調整的容量。2 GiB 必須由操作者明確選擇。設定範例、佇列及回應生命週期的取捨，以及預設預算為何在解析前只允許一個完整 512 MiB 上傳，請見[傳入主體准入](/zh-tw/reference/inbound-body-admission/)。 |
| `upstreamRequestCompression?` | `"off" \| "gzip" \| "zstd"` | `"off"` | 選擇加入原生 ChatGPT Responses HTTP 請求主體的壓縮。Codex 每一輪都會重送整段對話，而該輪走 HTTP 時 OpenCodex 原本會不經壓縮直接轉發到 `chatgpt.com`；在計量或長距離出口連線上，該次上傳是主要成本。設定後，送往 `https://chatgpt.com/backend-api/codex/responses` 與 `/compact` 且大小在 1 KiB 到 16 MiB 之間的字串主體，會在最後傳送時壓縮並標上 `Content-Encoding`。WebSocket 回合、其他所有目的地、已宣告 `Content-Encoding` 的主體，以及超出該大小視窗的主體會維持原樣送出，而編解碼器失敗會退回未壓縮傳送。`zstd` 是 Codex CLI 自身與該後端搭配使用的編碼，也是大量圖片回合較快的選擇；同時也提供 `gzip`（level 1）。在本機量測中，大量程式碼歷史約縮減 2–4×，而內嵌圖片幾乎不會縮小。壓縮會在代理的事件迴圈上同步執行，因此每個符合資格的傳送都會短暫延遲其他進行中的請求——在近期筆電 CPU 上每 MiB 文字約 2–3 ms，不可壓縮資料使用 `gzip` 會更久。例如 `maxUpstreamBodyBytes` 等位元組上限仍以未壓縮主體計算。請使用 `ocx config set upstreamRequestCompression zstd`（未知值會被拒絕）或編輯 `config.json`（未知值會被忽略）來設定，然後重新啟動代理以套用。 |
| `modelCacheTtlMs?` | `number` | `300000` | Per-供應商 `/models` 快取的新鮮度視窗。 |
| `cacheRetention?` | `"none" \| "short" \| "long"` | Anthropic 官方端點：`"long"`；其他 Anthropic 相容端點：`"short"` | Anthropic prompt-cache 政策：停用、5 分鐘臨時或 1 小時延長。未設定時，送往 `api.anthropic.com`（API 金鑰或 OAuth 帳號池）的請求使用 1 小時 TTL，因為代理回合常停頓超過五分鐘，且 1 小時寫入（2× 基礎輸入而非 1.25×）在第一次重用時就能回本；Anthropic 相容閘道與廠商端點維持 5 分鐘 TTL，因為它們的 1 小時支援沒有文件記載。在原生 `/v1/messages` passthrough 上，未帶 `ttl` 的呼叫端斷點會取得 `"1h"`，除非請求將任何斷點釘選為 `"5m"`，此時會原樣轉發。在轉譯後的 `/v1/messages` 路由上，全部要求 `ttl: "1h"` 的呼叫端斷點代表 `"long"`，任何明確的 `"5m"` 則代表 `"short"`。明確設定的值一律優先。變更 TTL 會使每個開啟中的對話再寫入一次快取，因為 5 分鐘與 1 小時項目是分開的。成本估算對回報為 1 小時的寫入按 1 小時費率計價。 |
| `tokenGuardian?` | `OcxTokenGuardianConfig` | off | 可選的主動 OAuth refresh 與 Codex 帳號暖機政策。 |

選擇加入且內含用量視窗已滿的池帳號，會從年齡滿三分鐘起透過既有的背景掃描重新整理其點數證據。一般回應標頭不會重新整理點數餘額。失敗的中繼資料讀取絕不會延長五分鐘的消費證據有效時間。

這些策略均使用各帳戶的有效閾值：存在 `codexAccountAutoSwitchThresholds` 項目時使用該值，否則繼承全域 `autoSwitchThreshold`。覆寫值為 0 僅關閉基於用量的主動切換；啟動綁定、硬鎖、冷卻、資格檢查和故障復原仍然生效。

將帳號的切換閾值設為 `0` 並不會停用主帳號硬鎖、啟動保護、冷卻或模型資格檢查。在 Pool 模式下，符合已觀測主帳號的釘選呼叫端憑證無法繞過該帳號適用的冷卻：會改用合格的池替代帳號，或拒絕該請求。無關的呼叫端憑證不會繼承主帳號的冷卻；明確的 Direct 行為不變。

選擇器名稱是使用者自選的公開標籤；opencodex 不賦予它們帳號角色語意。`codexAccountNamespaces` key 是 1–64 字元，以 ASCII 字母或數字開頭與結尾，中間為字母、數字、`.`、`_` 或 `-`。保留的 JavaScript 物件名稱被拒絕。每個值是有效的池帳號 id（絕非內部 `__main__`）或代表 Codex Desktop 帳號的 `"@main"`。供應商與保留的 `openai` / `combo` / `policy` 衝突以不區分大小寫方式檢查；具命名空間的組合或路由設定檔別名不能重複使用選擇器作為其命名空間前綴，且已設定的池 ID 或選擇器目標也不能重複使用選擇器。保持原始帳號 id 與電子郵件私密；選擇器是公開名稱。精確選取行為與優先順序請見[路由設定](/zh-tw/reference/configuration/routing/)。

Codex Auth 儀表板控制項擁有帶有明確 `codexAccountPickerEnabled` 欄位的對照表。啟用一個空的受管理對照表會建立隱私安全的選擇器；之後新增的帳號即使在 picker 列隱藏期間也會擴展該對照表，且不會重新命名既有選擇器。省略該旗標的手寫對照表維持手動管理，絕不會自動擴展。刪除帳號會保留其映射，讓精確路由在缺少期間 fail closed；重新加入相同的帳號 ID 會還原既有的公開選擇器，而非配置新的。

## 保留的 OpenAI 供應商

`openai` 與 `openai-apikey` 是固定的保留 id。`openai.codexAccountMode` 預設為 `"pool"` 並在 main 加上新增帳號之間選擇；`"direct"` 僅使用目前呼叫者／main 登入。API 僅使用其設定的 API 金鑰或金鑰池。使用裸模型或 `openai-apikey/<model>`；無跨路由憑證後備。API GPT-5.6 列帶有 1,050,000 context / 922,000 max input 中繼資料，而 Pro 虛擬 id 以 `reasoning.mode: "pro"` 重寫為基礎 wire 模型。

`openaiProviderTierVersion: 2` 標記目前的單一供應商 projection。在遷移已出貨的 v1 設定前，opencodex 會在不替換不同備份的情況下建立 `config.json.pre-openai-tiers-v2.bak`，並將已知的舊版命名空間 selected id 重寫為裸 id。

### GPT-6 Astra、Sol、Luna 與 Astra Minor

`gpt-6-astra` 使用 Codex 登入路由；`openai-apikey/gpt-6-astra` 使用你自己的 API 金鑰。可用性仍取決於上游帳號。原生 Astra 保留出貨時的 Codex 預設值：272,000 context、`low` reasoning，以及 `low`/`medium`/`high`/`xhigh`/`max`/`ultra` 階梯。它在 Fast 目錄中的描述是 **2 倍速度**；那不是計費倍率。

將 `providerContextCaps.openai` 設為 `922000` 可讓原生群組選擇加入長 context；Astra 自身的上限止步於 **872,000**。每個模型的 `providers.openai.modelContextWindows` 與 `modelAutoCompactTokenLimits` 可縮小它的視窗與軟性壓縮預算。例如 `modelAutoCompactTokenLimits: { "gpt-6-astra": 700000 }` 會把長視窗預設值 784,800 調低。明確設定的較小供應商上限或目標限制仍會勝出，包括原生別名組合。

沒有設定硬性上限時，原生目錄會將廣告的 `max_context_window` 與預設的 `context_window` 分開保留（Astra 為 872,000 對 272,000）。壓縮仍使用生效的預設視窗。若要給某個模型 500,000 token 而給其他模型 300,000，請將 `providers.openai.contextWindow` 設為 `300000` 並將 `providers.openai.modelContextWindows` 設為 `{ "gpt-6.1-sol": 500000 }`。逐模型的值會覆寫供應商視窗；`providerContextCaps.openai` 啟用時仍是所有原生模型的上限，在此範例中至少必須為 `500000`。每個模型自身的容量仍會限制結果。

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

[GPT-6.1 Sol](https://openai.com/index/introducing-gpt-6-1-sol/)（於 2026 年 9 月 29 日發布）是 GPT-6 Sol 的升級版；Astra 與 Luna 沒有推出 6.1 版本。它列為 `gpt-6.1-sol`（**GPT-6.1-Sol**），像 Sol 一樣不受帳號限制，其資料列來自 Codex 目錄，在該處需要 `client_version` **0.153.0 或更新版本**且是 Codex 預設模型。GPT-6 Sol 仍維持列出。

| 模型 | 預設 context | 選用上限 | 預設 effort | Reasoning 階梯 |
| --- | ---: | ---: | --- | --- |
| `gpt-6.1-sol` | 500,000 | 872,000 | `low` | `low` 到 `ultra` |

OpenAI 於 2026 年 10 月 11 日將 Codex 與 Work 中 GPT-6.1 Sol 的預設 context 從 272,000 調高至 500,000 token，因此原生列現在預設為 500,000 並在 450,000 進行壓縮。內建的 Codex 目錄仍記載為 272,000，因此由 opencodex 自行設定新的預設值。已設定的視窗或供應商上限仍可降低它，且長視窗選擇加入仍止於 872,000：OpenAI 將模型最大值描述為 1M，但未說明它如何對應到 Codex 的視窗與輸入上限，因此 opencodex 不會廣告超過它能驗證的上限。

Sol 與 Luna 套用與 Astra 相同的 `providerContextCaps.openai`、`modelContextWindows` 與 `modelAutoCompactTokenLimits` 控制項。在 OpenAI API（`openai-apikey`）上，`gpt-6.1-sol` 具有 1,050,000 context、922,000 最大輸入、128,000 最大輸出與 `low` 到 `max` 的 effort，定價為每 1M token 輸入 $2、快取輸入 $0.10、輸出 $10（超過 272K 的提示詞按長 context 費率計費）。GitHub Copilot、OpenRouter、Vercel AI Gateway、Kilo 與 OpenCode Zen 也有列出它。

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

Codex-login 供應商上列出的每個裸 `gpt-*` id（此處為 **GPT-6-Nova**），都會以 GPT-6.1 Sol
的 reasoning 階梯、預設 effort 與模態，加上 272,000-token 預設 context 與 872,000-token 選用上限，顯示為
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

供應商可以公開一個內建簡寫，例如 `google-antigravity` 的 `agy`。已設定的供應商名稱或明確別名會以不區分大小寫的方式取得該簡寫；此時另一個供應商的內建簡寫，無論在目錄名稱或別名路由中都會被抑制。舉例來說，設定一個名為 `agy` 的供應商後，Google 的模型仍留在 `google-antigravity/<model>` 底下，而 `agy/<model>` 則會選到你設定的供應商。規範供應商名稱仍需精確比對大小寫，未識別的前綴保留既有的模型路由後備行為。選擇加入的逐供應商 `aliasTemplate` 可替沒有別名的模型命名；詳見[模型別名範本](/zh-tw/guides/model-routing/#模型別名範本)。

## 供應商項目（`OcxProviderConfig`）

| 欄位 | 型別 | 意義 |
| --- | --- | --- |
| `adapter` | `string` | `openai-chat`、`openai-responses`、`anthropic`、`claude-cli`、`google`、`kiro`、`cursor`、`ollama-native`、`azure-openai`（或別名 `azure`）、`codebuddy`、`qoder` 之一。 |
| `baseUrl` | `string` | 上游 API 基礎 URL。多數內建固定端點會忽略不相符的值；防碰撞的金鑰預設集會保留較舊的同名自訂目的地。 |
| `proxy?` | `string \| null` | 各供應商的對外出口路由。省略以繼承全域代理決定；使用 `"direct"` 或 `null` 強制直接對外連線；或提供絕對的 `http://`、`https://`、`socks5://` 或 `socks5h://` 代理 URL。空字串會被拒絕。 |
| `noProxy?` | `string \| string[]` | 此供應商直接連線的目的地，使用 `NO_PROXY` 主機模式語法。相符時會同時略過此供應商自己的代理與繼承的全域代理。 |
| `requestPacing?` | `{ enabled, requestsPerMinute?, minIntervalMs?, maxConcurrentRequests?, models?, keySelection?, keys? }` | 選用的用戶端側對外請求啟動節流，與上游用量、計費及速率限制指標分開。RPM 會換算為均勻間隔；`minIntervalMs` 可強制更長的間隔。`maxConcurrentRequests` 是進行中請求數的正整數上限。供應商或模型規則可單獨使用並行上限；供應商限制套用於所有模型，而 `models` 項目使用精確的上游模型 ID（例如 `nvidia/llama-3.1-nemotron-ultra-253b-v1`）且只能增加延遲或縮窄並行數。佇列等待不會消耗上游回應標頭逾時。HTTP 與明確的轉接器 `fetchResponse`/`runTurn` 派送皆受涵蓋。設有並行上限的標準 Responses WebSocket 回合會改用 HTTP/SSE，以便在回應主體完成、出錯或取消時釋放租約。對於包含 Cursor 在內的 `runTurn` 轉接器，上限計算的是活躍回合而非實體傳送：單一回合內的 RunSSE 與 BidiAppend 可以重疊，同時其他回合則需等待。後續傳送仍遵守啟動間隔。 |
| `requestPacing.keySelection?` | `"active"`, `"round-robin"` | 一般請求的金鑰選取。預設 `active` 保留已儲存的金鑰與既有的失敗輪換；`round-robin` 將請求本地的選取分散到符合資格的 API 金鑰池參照之間，而不改變已儲存的現用金鑰。它平衡的是配置次數，而非 token 或成本。 |
| `requestPacing.keys?` | `{ requestsPerMinute?, minIntervalMs?, maxConcurrentRequests? }` | 跨模型共享、統一的逐金鑰參照 RPM、最小啟動間隔與並行上限。這些限制會與供應商和精確模型上限組合生效。重複的參照共用同一個桶；同一個上游專案中的不同參照並不代表獨立配額。不會強制執行 TPM 與每日配額。 |
| `upstreamHttpVersion?` | `"auto" \| "http1.1" \| "h1" \| "http2" \| "h2"` | 固定對這個供應商發出上游請求時使用的 HTTP 版本。預設為 `auto`，由 Bun 協商。明確固定需要 HTTPS 目標，無法遵守時會在本機失敗。當某供應商的 HTTP/2 SSE 串流停滯而不送出事件時請設為 `http1.1`——症狀是長時間執行的串流請求毫無輸出並最終逾時。對 Cursor 而言，`http1.1`/`h1` 會選擇其 `RunSSE` + `BidiAppend` 相容傳輸進行推論，同時也固定即時模型探索。管理介面 `POST`/`PATCH` 接受 `null` 以清除並回到 `auto`。 |
| `tlsProfile?` | `"antigravity-browser"` | **風險自負。** 針對標準 `google-antigravity` OAuth 供應商選擇加入類似瀏覽器的 TLS 握手（透過選用的 `wreq-js` 相依套件）。它只改變連線在網路上的外觀；它不是官方 Google 用戶端，也不改變 Google 條款所允許的範圍。Google 仍可能偵測、限流、停權或封鎖你登入的帳號，該風險完全由你自行承擔。預設關閉，且僅在搭配 Google 轉接器、Cloud Code Assist 模式及 Google 標準 HTTPS Antigravity 主機時接受。重新導向保持手動處理。供應商自己的 `proxy`/`noProxy` 路由會由該 TLS 傳輸承載；無法維持的路由會使請求失敗，而不會改走其他路徑，這也包含在設定了 `HTTP_PROXY`、`HTTPS_PROXY` 或 `ALL_PROXY` 時的任何直連路由。`GET /api/providers` 會將設定檔狀態回報為 `pending`、`active` 或 `failed`。省略該欄位則保留一般的 Bun 傳輸且絕不載入該相依套件。 |
| `responsesPath?` | `string` | 金鑰認證 `openai-responses` 請求的相對資源路徑。必須以 `/` 開頭，且不可含 scheme、查詢字串或 fragment。 |
| `chatCompletionsPath?` | `string` | `openai-chat` 請求的相對資源路徑，對應 `responsesPath` 並受相同格式規則約束。當同一個上游在不同前綴下提供 Chat Completions 與 Responses 時需要它：逐模型的線路覆寫會切換轉接器但不動 `baseUrl`，因此少了這個設定，選擇加入的 Chat 請求就會被送到 Responses 基礎路徑。Z.AI 是內建的範例。 |
| `allowEncryptedV2AgentTasks?` | `boolean` | 預設停用。信任直接的金鑰認證 `openai-responses` 供應商原封不動地消費或中繼不透明的加密 V2 子代理任務。符合資格的路由會略過 `agentTaskRecovery`；其他所有路由保留既有的復原或 fail-closed 行為。OpenCodex 不會解密、轉譯或復原透過此選擇加入送出的任務。 |
| `projectResponsesLiteHostedSearchHistory?` | `boolean` | 預設關閉。僅實際布林值 `true` 可為此供應商明確啟用有損 hosted-search 歷史投影，且只作用於最終目的地精確為標準 ChatGPT Codex `/responses`、明確選擇 Responses Lite 的一般請求及原生 v2 `compaction_trigger` 壓縮請求。省略或設為 `false` 時保留結構化歷史；字串和數字無效。不會啟用 Lite、變更傳輸，也不影響原生 v1 `/responses/compact`、公開 OpenAI API／其他目的地或既有 portable/routed compaction 投影。詳見[Lite 搜尋歷史](/zh-tw/reference/proxy-formats/#codex-native-ordinary-lite-hosted-search-history)。 |
| `upstreamWebsocket?` | `boolean` | `openai-responses` 請求選擇加入上游 Responses WebSocket 傳輸（預設 false）。僅對第一方 `https://api.openai.com/v1` 上游有效；自訂供應商端點一律使用有界 HTTP/SSE，因為 Bun 無法在配置完整訊息之前強制執行傳入 WebSocket 訊息上限。對標準 ChatGPT `openai` 供應商而言，省略時會在符合資格的回合維持上游 WebSocket，明確設為 `false` 會透過 HTTP/SSE 傳送串流回合，而供應商管理介面會拒絕 `true`；設為 `false` 時，原生對話中途 steering 與注入無法使用。此欄位獨立於面對用戶端的 `websockets` 設定，既不改變端點也不改變憑證。純 HTTP 維持在 SSE；非 Responses 路徑與 `openai-chat` 請求維持在 HTTP。 |
| `supportsServiceTier?` | `boolean` | 三態的規範 Fast 能力後備。`true` 會在目錄中發布 Fast、滿足 service-tier 路由需求、貢獻受支援指紋，並讓 fast 模式在相容的最終轉接器上注入供應商的規範線路值。`false` 會剝除該欄位且絕不注入，且精確模型宣告無法重新開啟它。省略時使該供應商保持未分類：fast 模式不會注入或正規化規範呼叫端值，而呼叫端值遵守最終線路的轉發權限（Chat 上的 `chatServiceTier`；Responses 上的透傳）。登錄檔將標準 OpenAI 分類為 `true`、DeepSeek 與火山引擎 Ark 分類為 `false`；只為真正支援層級的自訂閘道明確設定它。 |
| `responseTierAuthoritative?` | `boolean` | 回應層級能否確認或否認 Fast。對回應中繼資料不具權威性的路由明確設為 `false`；省略保留既有行為。這不會啟用 Fast 或變更對外參數。詳見[回應 service tier 權威性](#回應-service-tier-權威性)。 |
| `fastEnabled?` | `boolean` | 供應商 Fast 通道的操作開關。`false` 關閉 Fast（無 Fast 開關、無 `--fast` 列、無 fast 線路欄位）並覆寫 `supportsServiceTier`。`true` 啟用登錄檔標記為選擇加入的通道。省略則保留登錄檔預設值：`anthropic` 與 `anthropic-apikey` 預設關閉（因兩者的 fast 模式以 2 倍價格消耗用量點數），其餘供應商維持不變。儀表板 Models 頁面會為選擇加入的供應商顯示 Off/On 列。 |
| `modelSupportsServiceTier?` | `Record<string, boolean>` | 精確的上游模型能力覆寫。精確 `true` 為該模型啟用規範 Fast；精確 `false` 縮窄供應商預設值。明確的供應商層級 `supportsServiceTier: false` 仍保持 fail-closed 且無法被重新開啟。精確 `true` 不授權在 Chat 上轉發外來呼叫端層級。未宣告的模型回退至供應商整體行為。管理端 `PATCH /api/providers` 會合併項目，並接受 `null` 來清除單一項目。 |
| `chatServiceTier?` | `boolean` | 供應商層級的 Chat 線路選擇加入，用於轉發呼叫端的 `service_tier` 值。在已分類路由上，它控管例如 `flex` 等外來值，而非通過能力驗證後的代理自有規範 Fast；在未分類路由上，因為沒有任何 Fast 能力經過驗證，它會控管所有呼叫端值。精確模型能力不授權外來轉發。Responses 路由保留其基於能力的呼叫端轉發行為。 |
| `promptCacheKey?` | `boolean` | 為整個 `openai-chat` provider 啟用 `prompt_cache_key` 轉送。adapter 只轉送收到的 key，不自行產生，但 Claude Messages 轉換會從 `metadata.user_id`，或在沒有 metadata 時從模型／系統／工具群組衍生 key。除非供應商預設宣告，否則預設關閉；Mistral 依其[提示快取契約](https://docs.mistral.ai/studio/conversations/advanced/prompt-caching)啟用，明確的 `false` 可停用。僅在上游明確支援時啟用，嚴格閘道可能以 HTTP 400 拒絕未知欄位。 |
| `preserveResponsesReasoningContent?` | `boolean` | 自訂供應商預設關閉。在 **Providers → Settings** 中，只有當自訂 Responses 端點接受此歷史時才啟用 **Replay plaintext reasoning**。這會把先前的明文推理送往該端點，且可能增加 token 用量。這會在重放的 Responses 推理項目上保留明文推理內容而非將其清空（包括自訂原生 v1 compact 輸入；清空是 ChatGPT 後端的規則）。對契約接受推理重放的上游（例如 DeepSeek 或在 vLLM 上自架的 Kimi）可啟用它。代理鑄造的 `ocxr1` 封套一律會被剝除。未設定此項目的手動設定 `openai-responses` 供應商，在第一次丟棄明文推理時會依主機記錄一筆警告。`preserveReasoningContentModels` 不影響此線路。 |
| `preserveResponsesInputItemIds?` | `boolean` | 預設關閉。針對明確信任且需要回合身分的中繼啟動器，在 `store: false` 時保留有效的 `input[].id`。一般 Responses 供應商會繼續剝除 ID；xAI 自訂呼叫 ID 修復保持啟用。 |
| `preserveResponsesMessageMetadata?` | `boolean` | 預設關閉。針對明確信任的中繼啟動器，在輸入項目上保留私有的 `internal_chat_message_metadata_passthrough`（包括自訂原生 v1 compact 請求）。這會把私有回合／工作階段中繼資料轉發到該目的地；切勿對一般閘道啟用。 |
| `dropResponsesReasoningItems?` | `boolean` | 從延續輸入中完全移除重放的 Responses `reasoning` 項目（包括自訂原生 v1 compact 請求），而不是清空內容後再轉發。這是有損操作：摘要、項目 ID 與 `encrypted_content` 都會一併消失，因此轉發的輸入中不會留有上一回合的任何推理項目。它不會移除 `previous_response_id`，因此自行保有回合狀態的上游仍可存取它。僅針對徹底拒絕推理重放的上游啟用——內建的火山引擎 Ark Coding Plan 預設有設定它，因為經驗證的工具延續否則會回應 `400 InvalidParameter`。在該供應商上將其設為 `false` 可再次轉發推理項目。 |
| `disabled?` | `boolean` | 將供應商保留在磁碟上，但從路由與模型／目錄清單中排除。 |
| `apiKey?` | `string` | API 金鑰、`${ENV_VAR}` / `$ENV_VAR` 參照，或由 `ocx provider keychain <name> store` 寫入的 `keychain:<provider>` 參照。參照會在請求時解析。詳見[在 OS 金鑰圈中儲存金鑰](#在-os-金鑰圈中儲存金鑰)。 |
| `apiKeyTransport?` | `"x-api-key" \| "bearer"` | Anthropic 金鑰標頭樣式。預設為原生的 `x-api-key`；僅對金鑰認證的 `anthropic` 供應商有效。 |
| `apiKeyPool?` | `ApiKeyPoolEntry[]` | 多金鑰池。`apiKey` 鏡像現用項目；每個項目包含 `id`、`key`、選用的 `label` 與選用的數字 `addedAt`。 |
| `apiKeyPoolStrategy?` | `"round-robin" \| "fill-first" \| "quota"` | 當已承諾的金鑰正在冷卻時，如何在第一次嘗試**之前**挑選溫熱金鑰。省略則維持純被動輪換：金鑰池在 429 或 401 之後才會移動，不會事先移動。`round-robin` 取池中下一把金鑰，`fill-first` 保留第一把合格金鑰，而 `quota` 偏好剩餘餘裕最多的金鑰，對於逐金鑰配額未知的供應商則回退至 `fill-first` 順序。配額排序使用已存在於本機快取中的新鮮、憑證綁定推論證據；僅供顯示的視窗（例如 Synthetic 搜尋與 Mistral 預算）不參與金鑰排名。缺失或不可用的推論證據視為未知，且選取時不會主動探測。健康的已承諾金鑰絕不會被覆寫，因此手動金鑰選取仍然有效。 |
| `cacheAffinity?` | `"auto" \| "session" \| "turn" \| "off"` | 優先使用處理上一次成功回合的金鑰，以重用其上游 prompt 快取。適用於至少有兩個項目的金鑰池並搭配 `apiKeyPoolStrategy`；排除 OAuth／forward 路由。搭配 `quota` 時，經量測已耗盡的已綁定金鑰會讓位給經量測仍有餘裕的合格金鑰；未知配額或仍有餘裕則保留親和性。綁定比對精確的供應商與路由模型：不同模型不會繼承該綁定。已停用、已移除、冷卻中或達節流上限的項目不會被偏好，且 429/401 輪換仍會進行。搭配 round-robin 請求節流時，復原保持在請求本地且不會變更已儲存的現用金鑰。日誌僅在符合的綁定被移除時回報 `released`。代理產生的拒絕會保留健康的綁定；上游拒絕只釋放與實際提供服務的供應商和池項目相符的綁定。`auto`（預設）在讀取或寫入 ≥1024 token 時保留溫熱綁定，**或在偵測到工具結果延續時即使低於該門檻也保留**。溫熱狀態維持 5 分鐘，或在回報長保留寫入後維持 1 小時。讀取同一個仍溫熱的長前綴會保留其原本的截止時間，即使伴隨短寫入亦同；讀取不會延長那一小時。後續回合仍有自己的 5 分鐘視窗。未回報快取寫入計數器時，送出的提示詞計為已寫入；明確的零值會被尊重。這也會固定不做快取的供應商，因此在更重視負載分散時請使用 `off`。`session` 在項目保持合格期間忽略溫熱與 token 門檻；`turn` 只偏好溫熱的工具結果延續。**每個綁定在最後一次記錄成功後 24 小時過期**，重啟會遺忘所有綁定。手動變更現用金鑰不會覆蓋即時綁定；請使用 `off` 或停用其池項目來覆寫親和性。無關的儀表板供應商儲存會保留省略的模式，包含 `off`。日誌列公開 `cacheAffinity`/`cacheAffinityReason`。 |
| `defaultModel?` | `string` | 選取此供應商但未指定明確模型時使用的模型。 |
| `models?` | `string[]` | 種子／後備模型清單。當 `liveModels: false` 時，非空的 `models` 清單後接 `retainModels`；空或省略的 `models` 清單則改為播種 `defaultModel`（若有設定），再接 `retainModels`，並依首次出現順序移除重複 ID。 |
| `liveModels?` | `boolean` | 在啟動／同步時擷取即時目錄（預設 `true`）。自訂供應商使用 `${baseUrl}/models`；內建供應商可使用登錄檔 URL 與過濾器。 |
| `modelDiscovery?` | `{ skipInvalidRows?: boolean }` | 針對 `/models` 清單含有格式錯誤列的閘道所做的即時探索相容性設定。預設情況下，一筆無效列就會拒絕整份清單，且警告會指名第一筆無效列與無效列的數量。設為 `skipInvalidRows: true` 時，非物件或 ID 缺失、非字串、空字串或其他無效的列會改為被略過，並發出一次性警告回報略過數量（絕不印出內容）。回應大小與列數上限仍計入所有收到的列；去重、供應商過濾與 ID 前綴剝除則套用於剩下的列。若略過後沒有任何列留下，清單仍會被拒絕，而不會被當作空目錄。適用於 OpenAI 風格清單；特定供應商剖析器保留各自規則。與儲存新模型政策狀態的頂層 `modelDiscovery` 區塊無關。 |
| `selectedModels?` | `string[]` | 探索後的目錄允許清單。非空時僅公開那些 ID；空或省略時公開所有探索到的模型。 |
| `retainModels?` | `string[]` | 即使即時探索省略仍保留在目錄中的 ID。不需在 `models` 中重複列出。空或省略時保留目前行為。 |
| `modelDisplayNames?` | `Record<string, string>` | 僅供顯示使用的持久標籤，以該供應商精確的上游模型 ID 為鍵。標籤優先於供應商目錄中繼資料、在探索重新整理與供應商編輯後存活，且絕不會改變認證、轉接器行為、計費、上游請求建構、路由的 `provider/model` 選擇器，或供應商已知 ID 的線路模型。唯一路由例外：當直接的 `provider/model` 選擇器未匹配任何已知 ID、別名或 `retainModels` ID（例如即時名冊仍處於冷狀態）時，其編碼形式相符的鍵會作為原生 ID 送出。鍵為精確比對且區分大小寫。未知模型 ID 會保留，以便暫時消失的模型回來時重新取得其標籤。此映射最多接受 2,000 個項目，與探索上限相符。 |
| `contextWindow?` | `number` | 當上游中繼資料缺席時的供應商層級 context 後備值；否則作為保留較小即時中繼資料的上限。登錄檔預設值無法覆寫較低的已設定上限；明確的 `modelContextWindows` 項目優先。Models 儀表板會將其與 `providerContextCaps` 分開顯示。 |
| `modelContextWindows?` | `Record<string, number>` | 逐模型的 context 後備值／上限。這些值會覆寫 `contextWindow`：未知視窗會使用設定的值，而較小的即時中繼資料仍具權威性。 |
| `inferContextWindow?` | `boolean` | 僅限自訂供應商，預設關閉。`true` 會從內建的模型 ID 中繼資料填入缺失的視窗（[詳情](#自訂供應商的上下文視窗)）；該值為估算值，並非已驗證的中繼站容量。 |
| `modelContextTiers?` | `Record<string, "default" \| "long_context">` | `github-copilot` 的逐模型上游層級。`long_context` 會送出 `contextTier: "long_context"`。只有當精確的逐模型 `modelContextWindows` 值記載了受支援視窗時，目錄中繼資料才會擴展；該值優先於供應商上限。未知模型保留其觀測到的視窗。未設定的透傳請求在任何供應商上都保留呼叫端提供的 `contextTier` 欄位。 |
| `modelInputModalities?` | `Record<string, string[]>` | 逐模型輸入提示，例如 `["text"]` 或 `["text", "image"]`。 |
| `modelMaxInputTokens?` | `Record<string, number>` | 用於目錄自動壓縮提示的正數逐模型最大輸入上限。 |
| `modelAutoCompactTokenLimits?` | `Record<string, number>` | 正安全整數的逐模型軟性自動壓縮預算。數值只能降低生效的 90% context／最大輸入封套，且在未解析出 context 視窗時省略。對於標準 `openai`，鍵必須是精確的受支援原生模型 ID，不可含供應商或帳號選擇器前綴。供應商 PATCH 會合併項目；將某個鍵設為 `null` 可刪除它，或將整個欄位設為 `null` 以清空對照表。這些 `null` 墓碑僅限 PATCH 使用。 |
| `minMaxOutputTokens?` | `number` | `azure-openai`/`azure` Responses 路由上明確正數 `max_output_tokens` 預算的選用正整數下限。未設定時保留呼叫端的上限。設定它會授權調高較小的上限，這可能增加輸出用量。省略或無效的請求預算維持不變。 |
| `defaultMaxOutputTokens?` | `number` | 當用戶端省略 `max_output_tokens` 時，供應商層級的 `openai-chat` 後備值。未設定此欄位的 `anthropic` 列會使用其所服務 Claude 模型的登錄檔輸出上限（`api.anthropic.com` 上的任何模型為 64000），若模型 ID 未列在登錄檔中則為 8192。你在此處或 `modelMaxOutputTokens` 中設定的值一律勝出。 |
| `modelMaxOutputTokens?` | `Record<string, number>` | 正數的逐模型 `openai-chat` 後備預算；精確／模式比對優先於供應商預設值。 |
| `modelCosts?` | `Record<string, ProviderCostOverlay>` | 逐模型顯示價格（每百萬 token 美元），以該供應商精確的上游模型 ID 為鍵——而非供應商識別碼或路由後的 `provider/model` 標籤，例如 `{ "deepseek-v4-flash": { "input": 0.14, "output": 0.28, "cacheRead": 0.0028, "cacheWrite": 0 } }`。任何模型 ID 都是有效鍵——自訂供應商可透過 `openai-chat` 轉接器指向任何 OpenAI 相容端點，即使未出現在內建目錄中的本機或內部供應商 ID 也能運作。使用者設定的價格在日誌 `~$` 與用量估算中優先於內建目錄；歷史項目會依目前覆寫重新計價，因此編輯價格可能會改變過去的總計。後備順序為：使用者 `modelCosts` → 精確官方修正 → jawcode 目錄 → 預期價格覆寫 → 模型層級廠商後備；明確的全零使用者項目代表已知為零的估算，刪除該模型項目可恢復自動定價。全零的目錄中繼資料仍會繼續往下穿透。每個費率都必須是不超過 1,000,000（每百萬 token 美元）的非負有限數字；超出範圍的列會在管理邊界被拒絕並在載入時丟棄。僅供顯示時估算：覆寫絕不影響路由、帳號選取、配額或計費。 |
| `headers?` | `Record<string, string>` | 額外的上游標頭。對於傳統 OpenAI web-search sidecar，在合併設定與選取的標頭後，會以不區分大小寫方式移除 `x-openai-internal-codex-responses-lite`；其他轉發的標頭則保留。Authorization、cookie、API 金鑰標頭、內嵌換行與無效名稱會被拒絕。行經供應商對外包裝器的請求——模型探索、連線測試，以及其他代理發起的診斷（例如 Ollama show 探測）——會送出 `User-Agent: opencodex`，除非此處或供應商預設已設定 User-Agent。實驗性中繼站可使用 `x-opencodex-tool-completion: block-stop-v1` 協商更早傳送已完成的工具呼叫；嵌入殼層必須提供經認證的持久回合成員資格，而中繼站必須確認相同的回應標頭並實作精確的呼叫綁定完成標記。其他供應商請保持未設定。提早傳送僅適用於符合資格的結構化呼叫；後續的錯誤或取消無法撤回已傳送的呼叫。 |
| `forwardClientHeaders?` | `string[]` | 僅限 `openai-responses`：選擇加入在供應商尚未設定該標頭時，將具名的傳入用戶端中繼資料標頭複製到推論請求上。憑證與傳輸擁有的名稱（如 `Authorization`、cookie、API 金鑰標頭、`Content-Type`、`Content-Length`、`Host` 與 `x-oai-attestation`）會被拒絕，且在執行期也會過濾。標頭名稱不區分大小寫且不可重複。`headers` 仍具權威性；當兩者皆未設定時，既有的呼叫端 `User-Agent` 後備依然適用。支援的名稱：`originator`、`x-client-request-id`、`x-codex-app-version`、`user-agent`、`x-codex-window-id`、`x-codex-installation-id`；其他名稱一律拒絕。 |
| `supportsNativeCompactionTrigger?` | `boolean` | 僅限 `openai-responses`：宣告支援原生 v2 `compaction_trigger` 輸入項目。非標準閘道預設關閉；保留原生壓縮而非請求可攜式文字摘要。獨立於 v1 端點與 blob 重放能力。 |
| `supportsNativeCompactEndpoint?` | `boolean` | 僅限 `openai-responses`：宣告支援原生 v1 `POST /responses/compact`。自訂閘道預設關閉。金鑰／本機／forward 路由使用供應商的 Responses URL 加上 `/compact` 及其一般傳輸認證；OAuth 保留路由壓縮及其既有憑證生命週期。不會啟用 v2 觸發器，也不授予官方 OpenAI 身分。 |
| `decodesNativeCompactionBlobs?` | `boolean` | 宣告此目的地能重放原生的非 `ocx1:` 壓縮 blob。獨立於兩種生成能力之外；已知的服務供應商不符仍會使外部密文降級。請僅在同一個後端上測試 compact 與後續回合之後再啟用。 |
| `openRouterRouting?` | `OpenRouterProviderRouting` | 預設的 OpenRouter `order`、`only` 與 `allowFallbacks` 偏好；僅對搭配 `openai-chat` 的標準 OpenRouter 有效。 |
| `modelOpenRouterRouting?` | `Record<string, OpenRouterProviderRouting>` | 取代供應商整體 OpenRouter 偏好的精確模型 ID 覆寫。 |
| `vercelGatewayRouting?` | `VercelGatewayRouting` | 預設的 Vercel AI Gateway `order`、`only` 與 `sort`（`"cost"` \| `"ttft"` \| `"tps"`）偏好；僅對搭配 `openai-chat` 的標準 Vercel AI Gateway 有效。 |
| `modelVercelGatewayRouting?` | `Record<string, VercelGatewayRouting>` | 取代供應商整體 Vercel AI Gateway 偏好的精確模型 ID 覆寫。 |
| `authMode?` | `"key" \| "forward" \| "oauth" \| "local"` | 認證模式（預設 `key`）。OAuth／訂閱憑證儲存在 `config.json` 之外；`local` 限於登錄檔項目允許的供應商。 |
| `codexAccountMode?` | `"pool" \| "direct"` | 僅限標準 `openai`；預設為 Pool。Direct 會繞過池狀態。 |
| `refreshPolicy?` | `"proactive" \| "lazy-only" \| "disabled"` | 覆寫此 OAuth 供應商的 Token Guardian 政策。 |
| `reasoningEfforts?` | `string[]` | 供應商層級要廣告與送出的 Codex 推理標籤。對 `google` 轉接器供應商而言，設定的階梯同時會斷言 `thinkingLevel` 能力：直接與 Vertex 非影像請求會將選取的強度作為 `generationConfig.thinkingConfig.thinkingLevel` 送出，而 Cloud Code Assist 則使用其封套專屬路徑。 |
| `modelReasoningEfforts?` | `Record<string, string[]>` | 逐模型標籤。空清單會隱藏強度控制項。與 `reasoningEfforts` 相同，每個設定的 `google` 轉接器階梯會斷言 `thinkingLevel` 能力；直接與 Vertex 非影像請求使用扁平的 Gemini 路徑，而 Cloud Code Assist 則在其請求封套下送出。自帶逐模型表的轉接器（目前為 `command-code`）在線路上會讓自己的表優先於它已知的模型，因此若要拓寬這類列請同時設定 `modelReasoningEffortsAuthoritative`。 |
| `modelReasoningEffortsAuthoritative?` | `boolean` | 在線路上將此供應商的 `modelReasoningEfforts` 視為權威，而不只是在目錄中。未設定時，自帶逐模型強度表的轉接器（目前為 `command-code`）會在選擇器中廣告你拓寬後的階梯，然後在送出時剝除額外的階梯。此選項需要選擇加入，因為預設組合本身會以內建表播種，單靠儲存列無法證明是你自己寫的還是舊版留下的。設定後，上游拒絕的階梯會直接作為該錯誤回傳，而不會悄悄改為不帶強度重試——是你要求它的，所以你會看到回應。 |
| `modelSuppressSyntheticMax?` | `Record<string, boolean>` | 僅限目錄的逐模型開關。`true` 會防止 OpenCodex 補上缺失的合成 `max` 階梯，同時保留供應商宣告的 `max` 並繼續將 `ultra` 加入支援推理的階梯。原本已包含 `max` 的保留列會保留它，直到健康的探索重建該列，因為目錄不會持久化舊的 `max` 是否為合成。若已設定的預設值指向被抑制的缺失 `max`，目錄會回退至其下方最高的真實階梯。Codex 對選擇器與明確的 `spawn_agent` 強度驗證使用同一套階梯成員資格，因此明確以 `max` 產生子代理可能會在代理夾限之前就在用戶端側失敗；`ultra` 仍是受支援的 harness 路徑。 |
| `modelSupportsReasoningSummaries?` | `Record<string, boolean>` | 將某個模型設為 `false` 可停止廣告摘要並剝除摘要傳遞欄位。 |
| `modelReasoningSummaryDelivery?` | `Record<string, "sequential" \| "sequential_cutoff" \| "concurrent" \| "concurrent_cutoff">` | 逐模型 Responses 傳遞列舉值；會改寫既有的傳遞欄位。 |
| `thinkingDisplay?` | `"auto" \| "summarized" \| "updates" \| "omitted"` | 此供應商的 Anthropic 自適應 `thinking.display` 政策。未設定與 `auto` 維持內建選擇：`api.anthropic.com` 上的原生 Claude Opus 5.5 會送出 `updates`（進度解說），其他自適應模型送出 `summarized`。`summarized` 會對兩者強制啟用推理摘要。`updates` 僅在轉接器原本就會送出它的地方有效——原生 Opus 5.5——其他所有模型都視為 `auto`。`omitted` 會送出不帶 display 欄位的自適應思考，等同於隱藏思考；此時串流只會攜帶僅含簽章的思考區塊，因此 Chat 用戶端在長思考期間只會看到串流心跳。明確的請求 `reasoning.summary` 為 `concise` 或 `detailed` 時仍會強制 `summarized`。儀表板供應商編輯器與 `PATCH /api/providers` 接受 `null` 以清除它。`ocx config set providers.<name>.thinkingDisplay summarized` 可直接寫入。 |
| `modelThinkingDisplay?` | `Record<string, "auto" \| "summarized" \| "updates" \| "omitted">` | `thinkingDisplay` 的逐模型覆寫，以精確的上游模型 ID 為鍵（例如 `claude-opus-5-5`）。項目永遠優先於供應商整體值，包括讓單一模型回到內建行為的明確 `auto`；沒有項目的模型使用供應商值。套用相同的值規則，包括 `updates` 在從未接收過該顯示方式的模型上降級為 `auto`。`PATCH /api/providers` 會合併項目，並接受對單一項目或整個對照表傳入 `null` 來清除。 |
| `modelAdapters?` | `Record<string, string>` | 針對混合線路閘道的逐模型 `openai-chat` 或 `openai-responses` 線路覆寫。明確項目優先於登錄檔預設值。OpenCode Go 預設為 `gpt-5.6-luna` 選用 Responses 而讓同系列模型保留在各自記載的線路上；DeepSeek 可為 `deepseek-v4-flash` 選用原生 Responses；Alibaba Token Plan（北京）僅對 Responses 傳入請求將 `qwen3.8-flash`、`qwen3.7-plus` 與 `glm-5.3` 固定至其原生 Responses API（已在該閘道實機驗證，含明文推理重放；Chat 與 Anthropic 傳入維持在 Chat，同系列其餘模型也可在此處選擇加入）；而 GitHub Copilot 為以下模型宣告了僅限 Responses 的預設值（`gpt-5.3-codex`、`gpt-5.4`、`gpt-5.4-mini`、`gpt-5.5`、`gpt-5.6-luna`、`gpt-5.6-sol`、`gpt-5.6-terra`、`gpt-6.1-sol`、`gpt-6.1-terra`、`gpt-6-astra`、`grok-4.5`、`grok-4.6`、`mai-code-1.1-flash`、`mai-code-1-flash-picker`），因為這些模型在代理流量上拒絕 `/chat/completions`。沒有內建預設值的模型（例如 `gpt-5.4-nano`）可在此處選擇加入。單一線路的上游固定與標準 ChatGPT forward 會拒絕覆寫。 |
| xAI Chat Completions（儀表板／CLI） | switch | Grok 4.5/4.6 OAuth Responses 請求預設使用 Responses。升級時既有的 Chat 覆寫會遷移一次；之後的 Chat 選擇會被保留。開啟可為兩個模型選用 Chat，關閉則選用 Responses。CLI：`ocx provider edit xai --xai-chat on` 或 `--xai-chat off`（需要執行中代理）。Mixed 表示目前只有一個模型使用 Chat。其他覆寫與層級政策維持不變。API 金鑰與轉譯後的 Chat/Anthropic 預設值維持不變。Grok 4.7 透過其登錄檔線路預設在 OAuth 上預設為 Responses，並可透過明確的 `modelAdapters["grok-4.7"] = "openai-chat"` 覆寫改用 Chat。 |
| `xaiResponsesXSearch?` | `boolean` | 預設停用。在 xAI Responses 目的地上，只有當即時的 `web_search` 工具在最終請求正規化後仍留存時，才附加供應商託管的 `x_search` 宣告。既有的宣告不會重複，呼叫端的 `tool_choice`/`allowed_tools` 選擇器絕不會被放寬，且這與 web-search sidecar 的 `search.xSearch` 選項分開。 |
| `modelPreferHostedTools?` | `Record<string,string[]>` | 針對保留託管工具命名空間的非 forward Responses 閘道的精確模型選擇加入。目前僅接受 `["image_generation"]`；符合的模型必須使用 `openai-responses` 線路並支援該託管工具。它會移除衝突的用戶端 `image_gen` 宣告並改寫其選擇器以保留呼叫端的工具選擇。對 OpenAI API 虛擬 `-pro` 模型而言，會先比對選取的公開 ID，再以解析出的基礎線路模型 ID 作為後備。`modelAdapters` 先解析公開 ID，再解析基礎 ID；第二次解析決定最終線路。其他模型保留一般別名行為。 |
| `annotateEmptyToolOutputs?` | `boolean` | 在存在但內容為空的工具結果抵達模型前，將其替換為簡短標記，避免空白結果被誤讀為缺失。適用於空字串與純文字部分陣列；圖片、檔案與加密部分絕不會被碰觸。內建登錄檔對 DeepSeek 預設為 `true`，其餘則未設定。設為 `false` 可將供應商退出——明確的 `false` 在後續省略該欄位的編輯中仍會保留。`PATCH /api/providers?name=<provider>` 接受 `true`、`false`，或 `null` 以清除覆寫並回到登錄檔預設行為。 |
| `promoteAdditionalTools?` | `boolean` | 將 Codex Desktop 的 `additional_tools` 輸入項目提升至頂層 `tools`，並從 `input` 移除包裝。OpenCode Go 與 xAI（`api.x.ai`、`cli-chat-proxy.grok.com`）在非 forward 模式自動啟用；`authMode: "forward"` 時需要明確設為 `true`；其他對 `input` 中的未知項目型別回傳 HTTP 422 的嚴格 OpenAI 第三方閘道也可在此選擇加入。`PATCH /api/providers?name=<provider>` 接受布林值或 `null`（清除覆寫）。 |
| `unsupportedHostedTools?` | `string[]` | 此 Responses 目的地拒絕的託管工具宣告，因此它們會從 `tools`、用戶端載入的 `additional_tools` 與 `tool_choice` 中被剝除，而不是轉發後遭上游拒絕。適用於能力集較窄的 OpenAI 相容閘道——例如接受一般 Responses 請求與 `function` 工具，但對託管 `web_search` 回傳 HTTP 400 的閘道——避免純文字提示因根本不需要的能力而失敗。僅接受託管工具類型名稱（`web_search`、`web_search_preview`、`file_search`、`computer_use_preview`、`computer_use`、`code_interpreter`、`image_generation`、`image_gen`、`mcp`、`tool_search`、`local_shell`、`x_search`）；未識別的名稱會被拒絕而不會靜默忽略。同一能力的拼法變體互為別名，因此 `["web_search"]` 也會同時拒絕 `web_search_preview`。同一供應商不能同時在此處拒絕某託管工具又在 `modelPreferHostedTools` 中偏好它。小米 MiMo Responses 目的地（`xiaomimimo.com` 及其子網域，包含 `api.xiaomimimo.com` 與 `token-plan-cn.xiaomimimo.com`）會自動剝除 `web_search` 與 `web_search_preview` 同時保留函式工具；這些主機不需額外宣告。此選項獨立於 `supportsResponsesCustomTools`；對於同時拒絕原生自訂工具的閘道請兩者都設定。`PATCH /api/providers?name=<provider>` 接受陣列或 `null`（清除）。 |
| `unsupportedHostedToolsWithClientTools?` | `string[]` | 僅當同一請求也宣告了用戶端工具（在 `tools`、用戶端載入的 `additional_tools` 或 `tool_search_output` 結果中的 `function` 或 `custom` 工具，或帶有成員的 `namespace`）時，此 Responses 目的地才拒絕的託管工具宣告。這類請求會像 `unsupportedHostedTools` 一樣把具名的託管宣告從 `tools`、`additional_tools` 與 `tool_choice` 中剝除，因此針對被移除工具的強制選擇器會變成 `"none"`。僅宣告託管工具的請求則保留它們。適用於單獨提供託管 `web_search` 或單獨提供 function calling 都正常、但兩者並用就會回傳 HTTP 400 的閘道，例如回應 `Please enable tool_config.include_server_side_tool_invocations to use Built-in tools with Function calling.` 的 Gemini 後端 Responses 閘道。接受與 `unsupportedHostedTools` 相同的託管工具類型名稱與拼法別名；未識別的名稱會被拒絕。`unsupportedHostedTools` 仍具權威性：列於該處的工具一律被剝除。與該清單相同，供應商不能同時在 `modelPreferHostedTools` 中偏好此處列出的工具。未設定或 `[]` 不會造成任何改變。`PATCH /api/providers?name=<provider>` 接受陣列或 `null`（清除）。 |
| `reasoningEffortMap?` | `Record<string, string>` | 供應商層級的推理標籤線路別名。將某標籤映射至 `"__omit__"` 可從上游請求中完全省略該推理欄位：在 OpenAI 相容線路上為 `reasoning_effort`，在 Ollama 原生轉接器上為 Ollama 原生的 `think` 欄位（#2356）。 |
| `modelReasoningEffortMap?` | `Record<string, Record<string, string>>` | 逐模型的推理標籤線路別名。將某標籤映射至 `"__omit__"` 可從上游請求中完全省略該推理欄位。 |
| `reasoningWireFormat?` | `"gateway-object"` | 適用於接受 `reasoning: { enabled, effort }` 而非 `reasoning_effort` 的 OpenAI 相容閘道。對自訂 Responses 目的地而言，這也會明確允許 OCX 的 `reasoning.enabled` 擴充欄位；其他 Responses 目的地會剝除該內部欄位。單靠模型的思考能力不會自動啟用此線路格式。ClinePass 預設集會自動設定它。保留目的地的供應商儲存會保留它；見[儲存供應商時會保留什麼](#儲存供應商時會保留什麼)。`PATCH` 接受 `"gateway-object"` 或 `null` 以清除它。 |
| `noReasoningModels?` | `string[]` | 拒絕推理／思考參數的模型。 |
| `noTemperatureModels?` | `string[]` | 拒絕呼叫端指定 `temperature` 的模型。 |
| `noTopPModels?` | `string[]` | 拒絕呼叫端指定 `top_p` 的模型。 |
| `noStopModels?` | `string[]` | 拒絕呼叫端指定 `stop` 的模型。`openai-chat` 轉接器、Chat passthrough 與 Responses passthrough 會對這些 ID 省略該欄位。內建 `xai` 預設集列出了 xAI 記載為拒絕該欄位的推理模型（`grok-4.7`、`grok-4.6`、`grok-4.5`、`grok-4.3`、`grok-4.20-multi-agent-0309`、`grok-4.20-0309-reasoning`、`grok-build-0.1`）；`grok-4.20-0309-non-reasoning`、`grok-composer-2.5-fast` 則保留呼叫端 `stop`。 |
| `noPenaltyModels?` | `string[]` | 拒絕 presence/frequency penalties 的模型。內建 `xai` 預設集列出了 xAI 記載為拒絕這些參數的推理模型（`grok-4.7`、`grok-4.6`、`grok-4.5`、`grok-4.3`、`grok-4.20-multi-agent-0309`、`grok-4.20-0309-reasoning`、`grok-build-0.1`）；非推理 ID 則保留呼叫端的 penalties。 |
| `noStructuredOutputModels?` | `string[]` | 其 `openai-chat` 端點拒絕 `response_format` 的精確模型 ID。只有精確匹配所請求模型時才會省略該欄位；其餘所有 `openai-chat` 模型仍維持啟用結構化輸出轉譯。 |
| `noJsonSchemaModels?` | `string[]` | 其 `openai-chat` 端點拒絕 `json_schema` 形式 `response_format` 但仍接受 `json_object` 的精確模型 ID。這類請求會降級為 `json_object` 而非被丟棄，因此要求 JSON 的呼叫端仍會拿到 JSON。同一模型同時列在兩份清單時，以 `noStructuredOutputModels` 為準。`opencode go` 與 `opencode zen` 預設已為其 DeepSeek 路由內建。 |
| `foldDeveloperRoleToSystem?` | `boolean` | 記錄某個 `openai-chat` 目的地是否接受 `developer` 角色。`foldDeveloperRoleToSystem` 未設定時以 `system` 傳送，`true` 時以 `system` 傳送，`false` 時以 `developer` 傳送。未設定表示尚未記錄該目的地的情況；`true` 記錄上游拒絕該角色；`false` 記錄其接受該角色。除非啟用了 [single-leading-system 相容性](/zh-tw/guides/lm-studio/)，否則訊息在每種情況下都保留對話中的原有位置——只有角色改變。拒絕該角色的目的地會回應 `400 role 'developer' is not allowed`，該回合根本無法開始，這就是未記錄狀態預設摺疊的原因。保留目的地的供應商儲存會保留它；見[儲存供應商時會保留什麼](#儲存供應商時會保留什麼)。`PATCH` 接受布林值或 `null` 以清除它。 |
| `omitReasoningEffortWithToolsModels?` | `string[]` | 在一般回合接受 reasoning-effort 欄位、但一旦存在函式工具就拒絕它的精確 `openai-chat` 模型 ID。模型仍保留其廣告的強度階梯；OpenCodex 只會對帶有工具的請求省略該線路欄位，改由上游預設值生效。範圍比 `noReasoningModels` 窄（後者會從所有請求剝除推理並完全取消該模型的選擇器）。保留目的地的供應商儲存會保留它；見[儲存供應商時會保留什麼](#儲存供應商時會保留什麼)。 |
| `parallelToolCalls?` | `boolean` | 切換平行工具呼叫。OpenAI Chat 預設開啟；非 chat adapter 僅在明確 `true` 時廣告。 |
| `terminalContinuationGuard?` | `boolean` | 讓 `openai-chat` 供應商選擇加入：當可執行的回合宣告將進行工作卻未帶工具呼叫即乾淨停止時，進行一次有界的內部重新詢問。預設為 `false`；明確 `false` 的行為與省略相同。排除組合嘗試與路由壓縮回合，非 `openai-chat` 轉接器會忽略此選項。 |
| `responsesItemIdRepair?` | `{ message?: string[]; reasoning?: string[]; repairMissingTerminalIds?: boolean; repairInvalidIds?: boolean }` | 預設停用的下游 SSE 修復，用於精確佔位 ID、缺失的終端 ID，以及（搭配 `repairInvalidIds` 時）缺少標準 `msg_`/`rs_` 前綴的訊息／推理 ID。Function-call ID 永不被重寫。內建 DeepSeek 預設啟用後兩者。 |
| `responsesSnapshotRepair?` | `boolean` | 預設停用的面向用戶端修復，用於 SSE 與 JSON 中稀疏的 Responses 生命週期快照。補齊缺失的標準狀態、輸出與工具中繼資料，同時維持原始檢查與持久化不變。 |
| `messagePhaseInference?` | `boolean` | 預設關閉。對 Responses passthrough 串流，在完成時推斷缺失的訊息階段：若有後續協定事件則產生 `commentary`；終端事件或 `[DONE]` 則產生 `final_answer`。明確的 `commentary`/`final_answer` 階段會被保留（null 或未知值視同缺失而進行推斷），keepalive 不決定階段，而 completed/incomplete 快照在缺少階段時會重用逐項目的判斷。等待訊息完成分類期間，即時文字仍會繼續串流。保留的狀態使用該請求的轉譯器預算。也適用於從上游 SSE 重建的 JSON；一般的上游 JSON 維持不變。 |
| `webSearchBridge?` | `{ enabled?: boolean; backend?: "ollama" \| "openai" \| "anthropic" \| "xai" \| "gemini" \| "exa"; maxSearches?: number; timeoutMs?: number; endpoint?: string }` | 僅限金鑰認證的 `openai-responses` passthrough 供應商。預設關閉。Codex 一律宣告託管的 `web_search` 工具，而 passthrough 假設目的地會執行它而直接中繼。沒有執行託管搜尋的閘道會以名為 `web_search` 的 `function_call` 回應，導致沒有東西去執行它，而未宣告工具防護會結束該回合。設為 `enabled: true` 並指定明確的 `backend` 時，OpenCodex 會攔截該呼叫、自行執行搜尋、將結果餵回同一個上游，並向 Codex 顯示一個託管的 `web_search_call` 單元格。絕不會為 `authMode: "forward"`（ChatGPT 自己就能搜尋）或已在上游執行託管搜尋的供應商武裝。`backend` 為必填；沒有隱含預設值，若指定後端缺少憑證會讓橋接保持未武裝，不會跌落到另一個付費搜尋。`ollama` 會在 `POST <origin>/api/web_search` 上重用此供應商自己的 API 金鑰，因此除非操作者明確指定 `endpoint`，否則 origin 必須是 `https://ollama.com`。`openai` / `anthropic` / `xai` / `gemini` / `exa` 會重用對應的 sidecar 執行器及其憑證（Exa 使用 `webSearchSidecar.exaApiKey`）。只有當 `webSearchSidecar.backend` 解析為與此橋接同名的後端時，搜尋模型才會取自 `webSearchSidecar.model`；否則橋接會執行該後端自己的預設模型，因為為某家廠商挑選的模型會被另一家拒絕。未設定的 `webSearchSidecar.backend` 會解析為 `openai`，因此未設定後端時的模型只會送達 `openai` 橋接。沒有逐供應商的橋接模型覆寫。僅限串流回合。將 `web_search` 與另一個用戶端工具呼叫混合的回合仍會 fail closed，不會丟棄用戶端的呼叫。像類 XML `<web_search>` 的助理純文字不會被執行。預設值：`maxSearches: 3`（1..10），`timeoutMs: 60000`（1000..600000）。 |
| `retryOn429?` | `{ enabled?: boolean; attempts?: number; intervalMs?: number; maxIntervalMs?: number; respectRetryAfter?: boolean }` | 僅限 API-key provider（`authMode: "key"`）。未設定時關閉，但標準端點上採 key-auth 的 OpenCode Go 與 Command Code，以及標準 Mistral 的 `openai-chat` 例外：預設 replay 6 次、間隔 10 秒、上限 60 秒。設定物件即啟用；`enabled: false` 也會停用該預設策略。串流開始前的 HTTP 429 會依 `Retry-After` 或固定間隔等待，然後在 key 容錯移轉前以同一 key 重播相同請求——涵蓋主文字回合復原迴圈、Responses passthrough 線路、圖片／影片橋接、web-search 輔助服務及終端續接；自訂 `runTurn` 傳輸不在 HTTP 重試迴圈範圍內。`attempts` 計算第一個 429 後的同 key replay 次數（總傳送次數 = `attempts` + 1），是主復原迴圈、終端防護續接與橋接重試共用的單一請求範圍預算。耗盡時僅停止同 key replay，接著依可用目標執行一般 key 容錯移轉或最終錯誤處理；金鑰認證 passthrough 沒有容錯移轉，會原樣回傳 429。標準 Mistral Chat 的明確上游延遲超過允許等待時間時，停止同 key replay（池中另一個 key 仍可能處理請求）並保留原始 `Retry-After`；其他 provider 仍將等待截斷至上限。Mistral 依 credential／模型共用重試期限；`requestPacing.enabled: false` 或 `retryOn429.respectRetryAfter: false` 可停用。沒有重試時間的 429 在確認每分鐘預算不足時觸發保守的 60 秒復原等待，隨後只探測一次，成功即恢復一般流量。正常流量不預測下一次 token 成本。策略使用公告額度，排除已知耗盡的月額度，不承諾精確重設時間，也不觸發歷史壓縮。Codex 本身不重試 429，因此這是單一金鑰供應商的唯一防線。物件預設值：`enabled: true`、`attempts: 3`、`intervalMs: 5000`、`maxIntervalMs: 60000`（單次等待上限，設定最大 600000）、`respectRetryAfter: true`。 |
| `transientRetryOn5xx?` | `{ enabled?: boolean; attempts?: number }` | 僅限使用金鑰認證的 `openai-chat` 與 `openai-responses` 供應商。`authMode: "forward"` 的供應商（ChatGPT 帳號池）從不讀取此選項，維持預設階梯。選擇性重試串流開始前的暫時性上游狀態（500、502、503、504、520、521、522）：未設定時停用；只要有此物件即啟用，除非 `enabled: false`。涵蓋初始 `Responses` 請求、Responses passthrough 通道及其每個復原環節（OAuth-401 重播、同目標 429 重播、經驗證的重建）、終端防護續接，以及原生 `/v1/chat/completions`。`attempts` 是單一請求允許傳送至上游的**總**次數，包含第一次（1..10，預設 3）——這是與連線重設復原共用的單一預算，因此 `3` 表示最多只有三個實際請求會送達供應商。在 Responses passthrough 通道上，設定的值還會與請求範圍的傳送額度取交集，因此低於該額度的值會精確縮窄階梯，而高於該額度的值不會提高上限。每個 Combo 目標都把預先預約的首次傳送計入該目標設定的總次數；`attempts: 1` 只傳送一次，不會退還預約來增加額度，也不會擴大共用 Combo 上限。傳送前的本機拒絕或取消會釋放未使用的預約。等待採固定 400 毫秒、上限 5 秒的指數退避，並遵循 `Retry-After`。此機制獨立於處理速率限制的 `retryOn429`；串流中的失敗絕不重播。 |
| `retryOnReset?` | `{ enabled?: boolean; replacements?: number }` | 適用於原生 `openai-responses` 供應商（包含 `authMode: "forward"`），以及收到上游回應標頭之前的通用轉換 Responses 傳送路徑。可選擇性地替換一次在呼叫端尚未觀察到任何內容時就失敗的傳送：未設定時停用；只要有此物件即啟用，除非 `enabled: false`。涵蓋兩個不確定階段——回應標頭抵達前連線中斷，以及標頭之後 SSE 內文只載有控制事件時中斷。標準 ChatGPT 上游 WebSocket 在 create 訊框送出之後、任何 Responses 事件抵達之前關閉或出錯時，也以相同方式處理，其替換傳送改走 HTTP。只有自我完備的請求才會被替換：`store: false`、完整的 `input`、沒有 `previous_response_id`／`conversation`／`stream_id`，且僅使用由用戶端執行的工具。若鏈式輪次的 `previous_response_id` 已由本代理依自身重放狀態展開，該 ID 會在傳送前移除，因此該輪次同樣符合條件。重置未被替換時，服務日誌會記錄原因：`ambiguous-no-policy`、`ambiguous-request-not-replayable` 或 `ambiguous-allowance-spent`。`replacements` 是**單一**邏輯請求在所有環節與所有組合子請求中可進行的替換傳送次數（1..2，預設 1）——既不是各環節的重試次數，也不是傳送預算，因此替換傳送仍必須落在該環節既有的傳送額度之內。已經產生輸出或工具呼叫的請求，無論此值為何都不會被替換。若上游已經開始第一次推論，被替換的推論仍可能計費，因此此選項預設停用。通用轉換傳送路徑的首次傳送和重建後的傳送都支援標頭之前連線重設後的替換，使用同一授權和傳送預算。配接器自行管理的傳輸，以及收到上游回應標頭之後的轉換串流故障，均不在此選項範圍內。 |
| `autoToolChoiceOnlyModels?` | `string[]` | 其 `tool_choice` 僅接受 `auto` 或 `none` 的模型；強制選擇被降級。 |
| `preserveReasoningContentModels?` | `string[]` | 需要在 chat 歷史中保留先前 assistant `reasoning_content` 的模型。送往 `api.mistral.ai` 的轉譯 Chat 請求會改為在助理文字之前重建原生思考區塊；所有託管系列預設重放提供的思考，而明確清單（包括 `[]`）會覆寫納入狀態。不會憑空捏造佔位思考或簽章。送往標準 Mistral 的原生 Chat passthrough 絕不會重放 `reasoning_content`，並會丟棄用戶端在歷史中送出的任何複本，因為 Mistral 會拒絕該欄位。保留目的地的供應商儲存會保留已儲存的清單（包括 `[]`）；見[儲存供應商時會保留什麼](#儲存供應商時會保留什麼)。`PATCH /api/providers?name=<provider>` 接受陣列，或傳入 `null` 清除該欄位。 |
| `inlineThinkTagModels?` | `string[]` | 針對沒有伺服器端推理剖析器的 `openai-chat` 閘道所做的選擇加入復原。開頭的 `<think>` / `<thinking>` / `<reasoning>` 區塊（可接在空白字元之後）會在串流與緩衝回覆中啟動切分。所有回答空白字元皆會保留。後續標籤在任何位置皆作為分隔符號，包含同一行交錯與程式碼圍欄；此模式不解譯 Markdown。第一個標籤之前出現一般文字或程式碼圍欄會讓整份回覆保持原樣。預設關閉；有支援時請優先使用結構化上游推理或 `reasoningSplitModels`。 |
| `reasoningDetailsModels?` | `string[]` | 以結構化 `reasoning_details` 陣列回傳思考內容的模型（啟用 `reasoning_split` 的 MiniMax M 系列）；串流增量為累積快照，以前綴差分處理，保留的推理以 `reasoning_details` 陣列而非 `reasoning_content` 字串重播。 |
| `requiresReasoningPlaceholderModels?` | `string[]` | 上游會拒絕缺少 `reasoning_content` 的 tool_call 續接訊息的模型（DeepSeek thinking 模式）；重播快取未命中時會注入最小的佔位內容。預設沿用 `preserveReasoningContentModels`；設為 `[]` 可明確關閉。保留目的地的供應商儲存會保留已儲存的清單（包括 `[]`）；見[儲存供應商時會保留什麼](#儲存供應商時會保留什麼)。`PATCH /api/providers?name=<provider>` 接受陣列，或傳入 `null` 清除該欄位。 |
| `showThinkingSummary?` | `boolean` | 當 Responses 用戶端省略 `reasoning.summary` 時顯示供應商產生的摘要。明確的線路 `"none"` 勝出；無法區分將偏好序列化為省略的用戶端。原始推理仍保留為內容，絕不會重新標記為摘要。`google-antigravity` 預設集預設為 `true`；明確的 `false` 會停用該預設。啟用顯示時，符合資格的 CCA、Vertex 與直接 Gemini 請求也會選擇加入 `generationConfig.thinkingConfig.includeThoughts`；圖片、Claude、gpt-oss 與無階梯 Vertex 請求則不會。這不會變更用戶端設定或全域目錄摘要預設值。 |
| `hideRawReasoning?` | `boolean` | 將路由供應商的原始思維鏈保留在面對用戶端的內容通道之外（openai-chat `reasoning_content`、kiro 標籤、`response.reasoning_text.*`），同時供應商產生的摘要仍會在摘要通道上串流。明確的線路 `reasoning.summary: "none"` 會繼續隱藏兩者。這控制的是用戶端顯示的內容；並不會向用戶端隱瞞文字。Responses 橋接路由仍會在推理項目的 `encrypted_content` 內以 `ocxr1` 重放封套傳送它（那是 base64 JSON 而非加密），讓用戶端能在下一回合回顯。直接 Chat 與 Messages 編碼器在線路上沒有封套，因此這些用戶端不會收到複本，重放則來自伺服器端的推理重放快取。無論如何，`preserveReasoningContentModels` 重放與 DeepSeek 風格的延續都不受影響。預設關閉；原生 passthrough 路由會中繼上游自己的訊框並忽略此選項。同一供應商名稱的儲存即使在變更目的地後仍會保留被省略的值；`PATCH` 接受布林值或 `null` 以清除。 |
| `thinkingToggleModels?` | `string[]` | 使用 `thinking.enabled` 而非 effort 階梯的 chat 模型。 |
| `thinkingBudgetModels?` | `string[]` | 使用整數 `thinking_budget` 的 chat 模型；effort 映射為預算比例。 |
| `noVisionModels?` | `string[]` | 透過視覺 sidecar 發送的純文字模型；比對容忍 Ollama `:size` 標籤。 |
| `escapeBuiltinToolNames?` | `boolean` | 為 Anthropic 相容閘道轉義內建工具名稱，並在回傳的呼叫中還原它們。 |
| `anthropicEofTolerance?` | `boolean` | 僅當已收到可見文字或完整的 JSON 物件工具輸入時，允許 Anthropic 相容閘道完成在 `message_stop` 之前就結束的串流。預設關閉。 |
| `forwardAdvisorTool?` | `boolean` | 在轉譯後的 Messages 路徑上使用 Claude Code 的具型別 Advisor 伺服器工具（`advisor_20260301`）。省略時：只有第一方 `https://api.anthropic.com` 上的 `anthropic` 轉接器供應商會收到該宣告、用戶端已完成的 Advisor 交換紀錄以及 `advisor-tool-2026-03-01` beta。`true`：執行 Advisor 的 Anthropic 相容閘道也會收到它們。`false`：絕不轉發，包含第一方。其他目的地會丟棄該宣告，並在沒有建議的情況下執行該回合。作用中的 OpenCodex Advisor 在其回合中擁有 `advisor` 名稱。詳見[轉換路由上的 Anthropic Advisor 工具](/zh-tw/guides/claude-code/#轉換路由上的-anthropic-advisor-工具)。同目的地的儲存會保留被省略的值，變更目的地則會丟棄它；`PATCH` 接受布林值或 `null` 以清除。 |
| `googleMode?` | `"ai-studio" \| "vertex" \| "cloud-code-assist"` | Google 傳輸／認證模式。預設 `ai-studio`。 |
| `googleToolSchemaPolicy?` | `"compatible" \| "reject-lossy"` | 僅限 Google。省略或設為 `compatible` 時保留相容結構描述與既有的非直接 400 修復。`reject-lossy` 會在派送前拒絕初始損失或結果不確定的有界比較，並阻止會放寬限制的 Vertex 或 Cloud Code Assist 修復。直接 AI Studio 不會執行該修復。 |
| `directGeminiWireRenames?` | `boolean` | 僅限 Google。套用於 AI Studio 模式，包含自訂的 Google 相容 URL。省略或設為 `true` 時為 Gemini Flash ID 保留 `-tiered` 線路重新命名（`gemini-3.7-flash` -> `gemini-3.7-flash-tiered`）；`false` 則將請求的裸 ID 原樣送到線上。無論此設定為何，Vertex 與標準金鑰認證 OpenCode Zen 路由皆保留所請求的模型 ID；Cloud Code Assist 路由不變。當設定的上游仍提供裸 ID 時請設為 `false`。 |
| `project?` | `string` | Vertex 或 Antigravity Cloud Code Assist 專案 id。設定後，Vertex API 金鑰使用專案端點；未設定時，即使有 `GOOGLE_CLOUD_PROJECT` 也使用 express 模式。ADC 後備為 `GOOGLE_CLOUD_PROJECT` / `GCLOUD_PROJECT`。設為 `"auto"` 時，每把 Vertex API 金鑰各自解析所屬專案（解析成功的結果依金鑰快取；解析失敗的金鑰會在後續請求中再次探測），同一個金鑰池可跨多個專案；ADC 不接受 `"auto"`。 |
| — | — | Antigravity 帳號配額探測（`retrieveUserQuota` 與 `retrieveUserQuotaSummary`）無論是否設定 `baseUrl`，一律透過固定的對外傳輸前往 Google 自己的 Cloud Code 主機；帳號的 bearer 絕不會被送到操作者設定的端點，且任何重新導向都會中止探測。只有模型清單後備仍遵循 `baseUrl`。 |
| — | — | Antigravity 配額摘要會以 Antigravity CLI 的 User-Agent 請求，這是 Google 唯一會在回應中包含 Gemini 4 Argon 配額群組的用戶端家族。若對有效的 OAuth 帳號回傳 403，OpenCodex 會以相同的 token 與專案、改用舊版 `antigravity/1.0` User-Agent 重試該端點一次。401 不會重試。非 Argon 推論與模型清單配額後備仍維持 IDE User-Agent。 |
| — | — | Antigravity 配額會在 Gem 與 Cla 旁邊將 Gemini 4 Argon 顯示為獨立的 `Argon` / `Argon (Weekly)` 視窗。它們僅供顯示：帳號排名、配額耗盡、重設排序與重設通知仍使用 Gemini 與 Claude 視窗，而 Argon 請求也仍以 Gemini 視窗判斷。 |
| — | — | 重新整理 Antigravity 探索時，會聯集可用帳號已啟用的模型，並保留每個帳號自己的名冊六小時。啟用帳號容錯移轉時，只有當 CCA 404 的完整原始錯誤不超過 4 KiB 且包含一個 `resourceName` 精確符合 `models/<sent-model>` 的模型 ResourceInfo 時，才會嘗試另一個合格帳號。僅含訊息的錯誤、其他資源以及過大、不完整或發生錯誤的主體會保留原始 HTTP 狀態，不會產生模型拒絕或輪換。已確認的拒絕最多持續 24 小時，直到在該請求之後開始的正面探索或憑證替換為止；較舊的探索無法清除它，也無法取代較新的正面名冊。耗盡會指名模型，並區分不可用帳號與憑證、准入或傳送預算失敗。不會推斷任何付費／試用分類。 |
| `location?` | `string` | Vertex 位置。API 金鑰的專案端點預設為 `global`，並忽略 `GOOGLE_CLOUD_LOCATION`；ADC 需要此欄位或 `GOOGLE_CLOUD_LOCATION` 後備。Gemini 4 Argon 支援 `global`、`us` 與 `eu`。 |
| `mcpServers?` | `Record<string, CursorMcpServerConfig>` | 僅限 Cursor：stdio 或 Streamable HTTP MCP 伺服器。 |
| `desktopExecutor?` | `DesktopExecutorConfig` | 僅限 Cursor：外部的電腦操作（computer-use）與螢幕錄製指令。 |
| `unsafeAllowNativeLocalExec?` | `boolean` | Cursor 舊版布林值，僅在較新欄位未設定時等同於 `nativeLocalExec: "on"`。 |
| `nativeLocalExec?` | `"off" \| "codex-sandbox" \| "on"` | Cursor 本機執行政策。預設為 `off`；`codex-sandbox` 目前如同 `off` 一樣 fail closed。 |

對原生 Responses 而言，相同開關也涵蓋只收到生命週期事件後正常結束的 EOF。自包含請求與替換次數限制仍然適用。超出這些限制的請求不會被檢查，其串流也不會被暫扣。直接串流即使上游仍無回應，也會在 200 毫秒內收到原始回應標頭。只有在回傳該回應標頭之前選定替換回應時，替換回應才會帶有其自身的狀態和回應標頭：直接串流的重設或 EOF 必須發生在這 200 毫秒內，且替換回應標頭必須在原始回應到達後 15 秒內（若停滯逾時更短則以其為準）到達。彙整為 JSON 的非串流請求與組合目標沒有 200 毫秒視窗，在回應彙整或選定之前不會向用戶端回傳標頭，因此選擇標頭前可能等待同樣的時間。回傳回應標頭之後，是否替換取決於串流如何結束：讀取錯誤保留重設通道的既有行為，替換內文照舊發佈在原始回應標頭之後；只有生命週期事件後正常結束的 EOF 更嚴格，因為它是以另一次嘗試回答同一輪請求，替換回應必須與已提交的標頭在狀態、狀態文字、content-type 媒體類型、`openai-model` 和 `x-codex-turn-state` 上一致。易變與逐跳標頭（`date`、請求 id、`cf-ray`、`server-timing`、`x-ratelimit-*`、`openai-processing-ms`、`content-length`、`transfer-encoding`、`connection`、`keep-alive`）無需一致，因為用戶端已持有原始標頭的值，而真實上游每次嘗試都會變動這些標頭。不一致時保留原始串流及其錯誤。此後仍在檢查的直接串流會隨回應標頭收到一則 SSE keepalive 註解，此後每 15 秒再收到一則；組合預檢會在選定回應前暫扣這些註解。

Command Code 內建的逐模型 effort 預設值包含即時 API 實測結果。DeepSeek v4/v4.1 Flash（含 v4 Flash Vision）、GLM-5.3 與 GLM-5.3-Flash、Qwen3.8-Flash 與 Gemini-3.7-Flash 支援 `low`、`medium`、`high`、`xhigh` 與 `max`。階梯仍依模型而異：`poolside/laguna-s-2.1-free` 只提供 `medium`，而 Gemini-3.8-Flash 與 MiMo-v2.5-Pro 提供 `low`、`medium` 與 `high`。若要覆寫已釘選的 Command Code 列，請將 `modelReasoningEffortsAuthoritative: true` 與該模型的 `modelReasoningEfforts` 清單一併設定。

註冊或替換供應商（`POST /api/providers`）時，會先驗證 `responsesPath` 和 `chatCompletionsPath`，再修改記憶體或磁碟中的設定。`PATCH /api/providers?name=<provider>` 會將請求內容與已儲存的供應商合併；除僅更新 `requestPacing` 的請求外，凡是修改 `disabled` 以外欄位的更新，都會在儲存前以同樣方式驗證合併後供應商的路徑，若保留的既有路徑無效則回傳 `400`，且不變更設定。載入設定檔時也適用相同的路徑規則。

例如，這會對供應商整體套用並行上限，並對單一精確模型套用更嚴格的上限，而不設定間隔：

```json
{
  "requestPacing": {
    "enabled": true,
    "maxConcurrentRequests": 8,
    "models": {
      "nvidia/llama-3.1-nemotron-ultra-253b-v1": {
        "maxConcurrentRequests": 2
      }
    }
  }
}
```

並行插槽會一直被佔用，直到上游請求完成（包括最後的串流回應位元組）。超過適用供應商與模型上限的請求會在節流佇列中等待；當插槽釋放時，下一個符合資格的請求會獲准進入。佇列等待不會消耗上游回應標頭逾時。

對於多個 API 金鑰池項目，可與既有的失敗選取 `apiKeyPoolStrategy` 分開選擇加入一般請求分散：

```json
{
  "requestPacing": {
    "enabled": true,
    "keySelection": "round-robin",
    "maxConcurrentRequests": 10,
    "keys": { "requestsPerMinute": 15, "maxConcurrentRequests": 1 }
  }
}
```

這會在整個供應商允許最多十個活躍請求，且每個憑證參照最多一個活躍請求，每個參照的啟動至少間隔四秒。這些是本機上限，並非對上游容量的保證。供應商整體的 RPM 設定（若存在）仍為總量上限，不會隨金鑰數量倍增。金鑰限制跨模型套用；模型規則仍為額外限制。共用配額的專案需要適當的總量上限；此處不會追蹤 TPM 與每日配額。

Round-robin 逐請求選取金鑰，且不會儲存新的現用金鑰。已知的 401/429 冷卻會被略過；當沒有任何金鑰保持合格時，新請求會收到可重試的 429，而非反覆送出。已排隊的工作通常保留其選取的金鑰，即使另一個金鑰閒置也可能會排在該金鑰後方等待。若該選取進入冷卻或失效，請求會重新選取一個合格金鑰並重新取得其節流准入；有界佇列會到期而不會無限等待。選取與診斷皆為程序本機狀態，重啟後重設，且不等同於平衡的 token 用量或計費。啟動次數計算的是節流准入次數，包含在派送前取消的工作。OAuth 與轉發憑證保留既有選取方式。儀表板只會顯示金鑰控制代碼、啟動數、進行中工作、排隊工作與已知冷卻，絕不會顯示機密金鑰值。這些限制涵蓋推論節流執行器，不涵蓋獨立 Images 中繼的直接擷取。

### Azure OpenAI 模型中繼資料探索

對於主機名稱以 `.openai.azure.com` 結尾的 base URL，即使供應商使用自訂名稱，探索也會補齊缺失的圖片／文字輸入支援與 context／輸出上限。單靠 Azure `/models` 推論與 chat 旗標無法描述圖片支援或 token 上限。opencodex 會以公開的 [models.dev 目錄](https://models.dev)補充它們，在內建的 Azure 中繼資料與其他廠商套件之前優先使用其 Azure 列。模型 ID 查詢為精確或不區分大小寫比對；新發布的模型不需要新版 opencodex。

公開中繼資料快照會在探索期間最多每 24 小時重新整理一次，期限為兩秒，主體上限為 16 MiB。它儲存在 opencodex 設定目錄下的 `azure-model-metadata-cache.json`。不會有任何 Azure 憑證被送往公開目錄。離線探索會保留過期的快取中繼資料或退回內建提示；生成請求不會擷取此快照。

明確的輸入宣告與回報的模態保有優先順序，包括回報的 `vision: false`。既有的視覺 sidecar 涵蓋範圍依然適用。回報／設定的上限仍具權威性，供應商上限也會夾限它們。中繼資料描述的是模型支援能力，而非特定部署的容量。任意的部署別名（例如 `my-production-model`）無法從 Azure 推論旗標對映；需要時請為該精確 ID 設定 `modelInputModalities` 與 `modelContextWindows`。未知 ID 不會被猜測。

### 儲存供應商時會保留什麼

以既有供應商的名稱呼叫 `POST /api/providers`，會以根據請求建立的列取代已儲存的列。儀表板的新增/編輯表單無法傳送所有欄位，因此儲存時會保留請求省略的部分已儲存欄位。其中十四個記錄的是某個上游的行為：`preserveReasoningContentModels`、`preserveResponsesReasoningContent`、`requiresReasoningPlaceholderModels`、`foldDeveloperRoleToSystem`、`singleLeadingSystemMessage`、`reasoningWireFormat`、`omitReasoningEffortWithToolsModels`、`promoteAdditionalTools`、`retryOn429`、`transientRetryOn5xx`、`retryOnReset`、`unsupportedHostedTools`、`unsupportedHostedToolsWithClientTools` 與 `forwardAdvisorTool`。

| 儲存 | 十四項設定 | 已儲存的 `apiKeyPool` |
| --- | --- | --- |
| 目的地相同，欄位省略 | 保留已儲存的值，包括明確的 `[]` 或 `false` | 保留 |
| 新目的地，欄位省略 | 不保留；可能套用新目的地的登錄檔預設值 | 不保留 |
| 請求中傳送了該欄位 | 請求中的值 | 請求中的值 |

目的地指轉接器、base URL（比較協定與主機時不分大小寫，忽略結尾斜線），以及請求有指定時的驗證模式。把供應商移到其他目的地時，描述舊上游的十四項設定和為舊上游核發的金鑰池都不會帶過去。儲存絕不會把舊列的其餘部分合併進新列。供應商層級的 `modelDiscovery` 區塊遵循相同的目的地規則：同目的地且省略它的儲存會保留它，移動則丟棄它。

`hideRawReasoning` 是操作者的顯示政策，因此同名供應商的儲存在請求省略它時會保留已儲存的值，即使在目的地移動之後亦同。請求中傳送的值會勝出，包括 `false`。

選用的 `inferContextWindow` 設定也會在省略它的同名儲存中存活，包括目的地移動。其讀取、更新與清除行為說明於[自訂供應商的上下文視窗](#自訂供應商的上下文視窗)。

`PATCH /api/providers?name=<provider>` 只修改它指定的欄位，無論目的地為何都保留其他所有已儲存欄位。它接受全部這些設定，`null` 表示清除。它也接受 `modelDiscovery`，其中 `null` 或 `{}` 會清除它。它也接受布林值 `hideRawReasoning` 或 `null` 來清除。對於兩個推理清單，空陣列會作為明確的退出選項儲存，而不會被刪除。

啟用 `webSearchBridge` 時，搜尋延續會保持綁定在服務第一次請求的 API 金鑰選取上。在搜尋或供應商節流期間變更選取的金鑰、其參照或解析值、認證模式或 base URL，會在發出下一個供應商請求之前以橋接錯誤結束該回合。改走別處再改回來同樣會結束該延續。請開啟新回合來使用新的選取。在第一次供應商傳送之前的選取變更仍保留一般重選行為。

橋接的搜尋結果只會在同一位呼叫端、對話、供應商、模型與所選金鑰下，於對話的下一回合再次展示給供應商。呼叫端是依其出示的 opencodex API 金鑰識別，因此未送出 opencodex API 金鑰的用戶端不會獲得這類重放：它先前的搜尋單元格會原封不動送達供應商，與未啟用橋接的供應商相同。

明確的 `inlineThinkTagModels` 清單會取代相符的登錄檔預設值；`[]` 會停用復原。

帶有已驗證有效推理強度的轉譯 Responses 請求，在省略 `reasoning.summary` 時會保留原始推理。明確的 `"none"` 會使其在重放時保持隱藏；沒有有效強度的省略同樣保持隱藏。只有在呼叫端尚未選擇摘要模式時，注入的組合預設值才會加上 `summary: "auto"`。原始推理絕不會被重新標記為供應商產生的摘要，而 Codex 仍以 `show_raw_agent_reasoning` 控制其顯示。

自訂模型的 `reasoningEfforts` 通常會覆寫探索到的供應商中繼資料。有界的例外是其模型 ID 帶有固定原生 Codex 能力的明確自訂列（包括任意閘道上的 Astra 或 Daybreak）：其廣告的清單會與該模型固定的原生能力取交集。完整的原生身分仍需要標準的 `openai` Codex-forward 目的地。明確的空清單維持為空且沒有預設值；非空但不相容的清單會回退至原生預設值作為單一選項。預設值必須屬於最終清單。這只改變目錄投影，不改變儲存的設定。詳見[自訂原生目錄範例](/zh-tw/guides/codex-app-models/)。

### 各供應商的對外連線

當某個上游需要與全程序代理不同的出口時，請在供應商上設定 `proxy`：

- 省略 `proxy` 即繼承全域代理與 `NO_PROXY` 的判斷。
- 把 `proxy` 設為 `"direct"` 或 `null`，可強制此供應商直接連線，即使設定了全域代理也一樣。
- 把 `proxy` 設為絕對的 `http://` 或 `https://` URL，此供應商就使用該 HTTP 代理。
- 把 `proxy` 設為絕對的 `socks5://` 或 `socks5h://` URL，此供應商就使用該 SOCKS5 代理。

空字串或僅含空白的字串會被刻意拒絕。被清除的欄位不得無聲地從「繼承全域代理」變成「強制直接連線」；
請移除欄位以繼承，或寫 `"direct"` 來明確選擇直接對外連線。

`noProxy` 接受以逗號分隔的字串，或 `NO_PROXY` 語法的字串陣列。它會針對每個請求評估。符合的目的地一律直接連線，
無論供應商原本會使用自己的 `proxy` 還是繼承全域代理。

#### 此路由涵蓋的範圍

此路由套用於路由推論、供應商探索與連線測試，以及 API 金鑰配額探測。有些傳輸無法承載它，OpenCodex 會明說，而不是假裝沒有這回事：

- **OAuth 權杖交換與重新整理**仍使用全程序的代理。這些請求由不持有任何供應商設定的程式碼送往固定的廠商端點，
  所以即使供應商被固定使用自己的代理或 `"direct"`，仍會透過全域路由重新整理其憑證。以 OAuth 為基礎的配額探測與 API 金鑰驗證探測也一樣。
- **Responses WebSocket 快速通道**在撥號時選定其代理，無法承載逐供應商的路由，所以宣告了路由的供應商，會改以 HTTP/SSE 提供這些回合，並記錄一次性通知。
- **Cursor 預設的 HTTP/2 傳輸**、**CodeBuddy 與 Qoder 子處理程序供應商**（其子環境省略代理變數），以及**相容性實驗室**固定的傳送端，都不套用它。
- 不路由模型的端點——圖片產生與編輯、音訊轉錄、即時與 realtime 呼叫，以及未限定的 `/v1/alpha/search`——沒有可套用的供應商路由。

設定了自訂 `fetch` 執行器的供應商會被拒絕，而不是被執行器自己的路由無聲送出。

此範例對一般流量保留全域代理、讓一個供應商經由區域 HTTP 代理送出，並把另一個供應商固定為直接連線：

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

### 營運人員固定的推理強度

在既有的供應商上設定 `pinnedReasoningEffort`，可覆寫傳入的 effort 選擇，或對個別上游模型 ID 使用 `modelPinnedReasoningEfforts`。
逐模型的供應商固定值優先於供應商層級的固定值；根 `modelPinnedEfforts` 對照表是後備。這些是營運人員設定，不是供應商登錄的預設值。
它們不會改變模型探索或對外宣告的 effort 階梯。

```json
{
  "pinnedReasoningEffort": "high",
  "modelPinnedReasoningEfforts": {
    "example-model": "max"
  }
}
```

請把這些欄位合併到既有的供應商資料列。可接受的值為 `none`、`minimal`、`low`、`medium`、`high`、`xhigh`、`max` 與 `ultra`。
**`none` 會移除明確的 effort 欄位**；它使用供應商的預設行為，並不保證關閉推理。適用的 effort 上限仍會在固定值之後執行，
供應商的線路對應／正規化可能降低或省略不支援的值。`ultra` 在抵達上游線路之前會先被正規化。壓縮維護請求不受固定值影響。

`PATCH /api/providers?name=<provider>` 接受這些欄位。省略欄位即保留它；用 `null` 清除純量或整個對照表。
設為 `null` 或 `""` 的對照表項目會移除該項目並保留其他項目。格式錯誤的寫入在儲存之前就會被拒絕。
手動編輯的檔案中格式錯誤的選用固定值，在載入時會被忽略，而不會丟棄其餘設定。

### 自動審查（核准）模型選擇

Codex 從目前回合所用模型的目錄資料列讀取 `auto_review_model_override`，以選擇審查核准請求的模型。
`$CODEX_HOME/config.toml` 中的根 `auto_review_model` 設定則提供 Codex 的後備。儀表板模型設定中的全域**自動審查覆寫**，
會把 `autoReviewOverride` 存入 `~/.opencodex/config.json`，並優先於該後備；下方以供應商為範圍的欄位，在各自的資料列上仍然優先。
全域設定必須啟用且指定一個模型。已啟用但沒有模型的設定維持未套用，Codex 的後備仍然生效。
目錄重新整理是另一種狀態：儲存之後它可能維持待處理，模型頁會回報此狀態，讓你可用 `ocx sync` 重試。
CLI 使用者可用 `ocx models auto-review status` 讀取設定，或用 `ocx models auto-review set <model|-> [--enabled <on|off>]` 變更；用 `-` 清除模型。
當重新整理可以重試時，CLI 輸出會建議執行 `ocx sync`。若重新整理失敗，設定仍保持已儲存，且指令以 1 結束。同步之前請先解決失敗原因。
[供應商指南](/zh-tw/guides/providers/#每個供應商各自的核准審查者)有營運流程與實際範例。

當包含原生 OpenAI 資料列、且最終目錄中除了 Reserve 之外還有一般的裸原生資料列（隱藏的資料列也算）時，OpenCodex 會保留隱藏的 `codex-auto-review` 資料列，
讓 Codex 在沒有設定覆寫時，可選擇它偏好的核准審查者。它不會出現在模型選擇器、子代理選項、Desktop 清單與公開的 `/v1/models` 清單中。
供應商與根審查者覆寫保留各自的優先順序，也不會在這個內部資料列上蓋章。沒有一般裸原生資料列的目錄（包含僅有 Reserve 的目錄）會省略它，並保留 Codex 退回使用任務模型的行為。
審查者收到的多代理模式投影，與一般原生資料列相同。

`autoReviewModel` 是供應商層級的審查者目標。值可以是同一供應商的裸模型 ID（目錄資料列會正規化為 `provider/model` 代稱），
或完整的公開目錄代稱，例如 `opencode-go/deepseek-v4-flash`。裸值會先對照該供應商的資料列，再對照裸目錄資料列，
原生模型（例如 `gpt-5.6-terra`）就是這樣被指名的；落在該供應商之外的裸值，會印出一則說明實際提供審查者的資料列的備註；兩者都不符的值則保持未解析。
`autoReviewModelOverrides` 的鍵是該供應商確切的上游模型 ID，或供應商為其發布的別名（`modelAliases`）；兩種寫法指向同一個路由資料列，其代稱帶有上游 ID。
項目在其模型上優先於供應商層級的值。供應商的蓋章在自己的路由資料列上優先於根選擇器，而根選擇器仍是原生資料列與沒有供應商蓋章的路由資料列的後備。
移除供應商選擇器只會清除該供應商的蓋章；移除根選擇器絕不會清除供應商蓋章。含有斜線的模型 ID 可以寫成原始形式或編碼後的目錄形式；兩種寫法都解析到同一個路由資料列。模型鍵保留大小寫。
每次同步時，選擇器會對最終目錄各自獨立解析，並各自封閉式失敗：未解析的 `autoReviewModel` 會發出診斷並且不替供應商層級的資料列蓋章，
未解析的 `autoReviewModelOverrides` 項目會發出診斷並且不蓋逐模型覆寫，所以有效的供應商層級目標仍是其後備。凡是能解析的選擇器仍會套用。
沒有供應商蓋章的資料列保留根選擇器，或在根選擇器未設定時使用一般的上游自動審查行為。標準的 `openai` 供應商不接受這些欄位。

移除根選擇器會清除每個資料列上的根蓋章，包含早期版本、在 OpenCodex 的來源標記出現之前蓋章的原生資料列。
該清理以形狀辨識舊版蓋章——整個目錄中的同一個值、且某個路由資料列也帶有它——所以符合該形狀的真正逐列值會一併被清除，
而之後已偏離該形狀的目錄需要手動同步一次。供應商蓋章絕不會因為移除根選擇器而被動到。

`PATCH /api/providers?name=<provider>` 接受這兩個欄位。用 `null` 清除純量或整個對照表；用 `null` 或 `""` 的對照表項目移除該模型並保留其他項目。
不相關的供應商儲存會保留先前設定的值。

這些欄位可用於 `config.json`、供應商管理 API 與儀表板的原始 JSON 供應商編輯器。目前沒有專用的表單控制項。
原生根蓋章會記錄先前的值，並在蓋章值沒有被外部改動時於移除時還原。

### 探索到的模型顯示名稱

當供應商回傳機器友善的 ID、而 Codex 模型選擇器需要較短的標籤時，請使用 `modelDisplayNames`。這個對照表屬於單一供應商，
所以同一個模型 ID 在另一個供應商底下可以有不同的標籤。請把欄位加到 `config.json` 中既有的供應商資料列，並保留所有其他供應商設定。
範例包含周圍必要的欄位以供對照：

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

本機 Codex 目錄中受支援的裸原生 GPT 資料列，也接受 `providers.openai.modelDisplayNames` 中的確切標籤，例如 `"gpt-6-astra": "GPT 6 Astra"`。
啟動同步與本機目錄收斂都會重新套用這些標籤。移除標籤時，只有在資料列的顯示名稱仍與已套用的覆寫相符時，才會還原原本的原生名稱。
較新的外部顯示名稱會依既有的原生中繼資料正規化規則保留；例如 Astra（`gpt-6-astra`）仍會把未固定的名稱換成其固定的原生名稱。
標籤疊加層不會改變模型 ID、中繼資料（包含能力）、排序、路由的組合別名與帶帳號限定的資料列。
`GET /api/models` 也會為裸原生列公開這些標籤，因此用戶端匯出與 `ocx opencode` 啟動器會使用它們。
OpenCode 會保留其既有後綴，例如 `sol (native)`。重新啟動 `ocx opencode` 或重新整理受管理的整合即可更新產生的設定。
若無覆寫，既有匯出標籤維持不變。`/v1/models` 與虛擬的 `*-pro` 資料列不變。

生效的標籤順序是：營運人員的 `modelDisplayNames`，然後是供應商目錄中繼資料，最後是一般的 `provider/model` 後備。
路由選擇器仍是 `xai/grok-4.6`，而上游線路模型仍是 `grok-4.6`。標籤僅供顯示。它們不會改變驗證、轉接器行為、路由、計費或上游請求的組成。
移除對照表項目只會重設其標籤。對於內建的 OpenAI API 模型，請使用 `providers.openai-apikey.modelDisplayNames`；標籤在目錄重新整理後仍會保留。
管理用戶端可用 `PUT /api/providers/:provider/model-display-names`，搭配 `{ "modelId": "grok-4.6", "displayName": "Grok 4.6" }` 的內容，
設定或重設單一標籤；送出 `displayName: null` 即可重設。供應商的 `PATCH` 不會編輯這個對照表。請使用這個專用的 `PUT` 端點來變更或移除標籤。

儀表板在**模型**頁提供同樣的持久設定。展開供應商、找到探索到的模型，然後選擇**名稱**。對話框會在你儲存易讀標籤時，持續顯示確切的 `provider/model` 選擇器。
選擇**重設名稱**可回到供應商中繼資料或一般的選擇器後備。**名稱**只改變呈現；另一個別名鉛筆圖示改的是簡短的路由別名，並不是顯示名稱編輯器。
原生 OpenAI 與自訂模型資料列保留既有的控制項。

若變更已儲存、但重新整理失敗，對話框會反映已儲存的覆寫，並保留**重試**可用。伺服器回報收斂失敗時，重試會重做目錄收斂；
只有列表請求失敗時，則重新載入列表。重設的復原會保留重設操作，不會還原舊名稱。請求有 60 秒的期限，涵蓋寫入及其後續的列表重新整理。
逾時不會復原寫入：請在做另一次變更之前，使用**重試**檢查目前的名稱。

Claude Code 的 `/model` 選擇器（Anthropic 風格的 `GET /v1/models`）會把具有確切標籤的路由資料列顯示為 `<label> (<provider>)`，例如 `Sonnet 5.5 (anthropic2)` 與 `Sonnet 5.5 (anthropic2) · 1M`；沒有項目的資料列則保持 `<model id> (<provider>)`；當全域 `fastMode` 以易讀樣式把 Cursor 資料列改寫為其 fast ID 時，該資料列保留列出的 ID，而不是設定的標籤。別名與目錄中繼資料不會重新標示它；ID 與原生資料列不變。

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

### 回應 service tier 權威性

當某個供應商回應中的 `service_tier` 無法確立 Fast 是否被授予時，請在 `config.json` 中把 `providers.<name>.responseTierAuthoritative` 設為 `false`。這是操作者對整條供應商路由所做的宣告，獨立於 `supportsServiceTier` 與 `fastWire`。它既不會啟用 Fast，也不會改變送出的 `service_tier`。

例如，把這個欄位加到一個既有的閘道供應商，其 Codex 後端的回應中繼資料不具權威性：

```json
{ "responseTierAuthoritative": false }
```

**閘道支援需選擇加入。** 只更新 OpenCodex 不會把這項宣告加到既有的供應商。沒有它時，符合資格的 priority 請求之後出現 `service_tier: "default"`，會維持舊有的 `response-declined` 解讀。只有在已知該路由的回應中繼資料不具權威性時，才設定 `false`。

對於序列化為 `priority` 的符合資格請求，`default` 與 `priority` 的回聲都仍然只是觀察。記錄會保留 `responseServiceTier`，並記下 `tierOutcome.responseTierAuthoritative: false`、`fastOutcome: "applied"` 與 `confirmation: "assumed"`，而不帶 `response-declined`。這裡 **applied 的意思是請求參數已送出**，而 **assumed 的意思是實際的 Fast 效果未經確認**。模型提示會以該確認狀態分別顯示請求與原始回應。這個設定與這些記錄都不能證明有加速或有計費的 tier。

成本估計使用既有的請求 tier 後備值，而不是把原始回聲當成已確認的價格 tier；需要回應確認的定價規則不能使用那個回聲。沒有權威性旗標的歷史記錄維持它們先前的解讀。

這個欄位只接受布林值。省略與明確的 `true` 對其他目的地（包括官方 API 與未宣告的閘道）維持以回應為基礎的確認。標準的 `https://chatgpt.com/backend-api/codex` 搭配 `authMode: "forward"` 仍然自動視為不具權威性，即使設定了 `true`。閘道名稱與 URL 絕不會被推斷。如果同一個閘道混用不同的回應契約，請為那些路由使用不同的供應商項目，並只對相關的項目套用這項宣告。

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

內建的 `anthropic`（已儲存的 Claude OAuth）與 `anthropic-apikey` 項目只為 `claude-fable-5-2`、
`claude-opus-5-5`、`claude-opus-5` 與 `claude-opus-4-8` 宣告 Fast。其他 Claude 模型（含 Fable 5 與 5.1）未分類；這些項目沒有
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
缺失的回顯則視為未確認。只有確認生效的 Fast 用量才會取得 2 倍牌價估算（Fable 5.2 每百萬
token 輸入 $16／輸出 $80；Opus 5.5 輸入 $8／輸出 $40；Opus 5 與 4.8 輸入 $10／輸出 $50）。若第一次 fast 送出因需要
用量額度、組織停用 Fast、模型拒絕 `speed`，或 fast pool 為空而被拒絕，主轉接器分派可以
進行一次有預算的 standard-speed 重送。一般速率限制與容量錯誤維持既有處理方式。該請求
之後的建構都維持在 standard speed；新的一輪對話可能再次遇到拒絕。

Pro/Max 上的訂閱 Fast 需要用量額度；Team/Enterprise 組織還需要管理員啟用。第一方 API 的
Fast 是需要存取權的研究預覽。存取與計費條款請見
[Anthropic Fast mode](https://platform.claude.com/docs/en/build-with-claude/fast-mode) 與
[Claude Code Fast mode](https://code.claude.com/docs/en/fast-mode)。

### Cursor Fast（`cursor-variant`）

Cursor 沒有 `service_tier` 欄位。它的 fast 產品是不同的**模型變體**——`claude-opus-5-thinking-high-fast`、
Grok 4.5/4.6 的 `{id:"fast",value:"true"}` 請求參數，或 Grok 4.7 的扁平化 `grok-4.7-{effort}-fast`
線路 ID——因此 Cursor 項目宣告 `fastWire.kind: "cursor-variant"`，並由請求建構器解析該變體，而非設定請求欄位。

只有實際宣告了 fast 變體的基礎模型才會廣告 Fast：`claude-opus-4-7`、`claude-opus-4-8`、`claude-opus-5`、
`claude-opus-5-5`、`grok-4.5`、`grok-4.6`、`grok-4.7`。其餘每個 Cursor 列都會發布 `supportsServiceTier: false`，
讓 Codex 不顯示開關，而非顯示一個無效的開關。

其傘狀列（umbrella row）路由思考的基礎模型會升級至其 **thinking-fast** 變體，而非一般的 fast 兄弟變體——
後者是具有較短 effort 階梯的另一款產品，且對 `claude-opus-5` 而言，其一般系列在上游遭到隔離。

`fastMode` 在不同介面上的行為不同，因為只有 Codex 擁有自己的 Fast 開關：

| 介面 | `fastMode: true` |
|---|---|
| Codex | 資料列維持傘狀列；由應用程式的 Fast 開關選取變體 |
| Claude Code (`?ids=cli`) | 列出 fast 身分，例如 `ocx-claude-cursor--claude-opus-5-thinking-fast` |
| OpenAI `/v1/models` | 列出 `cursor/claude-opus-5-thinking-fast` |
| Claude Desktop (3P) | 不變——它的別名由模型名稱雜湊產生 |
| 儀表板 `/api/models` | 列 ID 不變；它們是啟用／停用鍵 |

兩種方式都會將請求升級：啟用 `fastMode: true` 時，選取傘狀 ID 仍會解析為 fast 變體，
因此其儲存設定早於該開關的用戶端不需要重新探索。每個舊版變體 ID 都維持既有路由不變。

### xAI 優先處理

內建的 `xai` 預設組合在它的兩種傳輸上都支援 Fast，但範圍不同。API 金鑰模式以 `https://api.x.ai/v1` 為目標；
解析到 `openai-chat` 的路由會透過 Chat Completions 送出 `service_tier: "priority"`，而模型預設值與覆寫也可以改選 `openai-responses` 傳輸。
`ocx login xai` 則會儲存 Grok 訂閱閘道（`https://cli-chat-proxy.grok.com/v1`；這些憑證會自動重新整理）的 OAuth 憑證，
在那裡 Fast 是逐模型分類的（2026-09-13 與 2026-09-23 實測）：grok-4.7、grok-4.6、grok-4.5、grok-4.3、grok-4.20-0309-reasoning、
grok-4.20-0309-non-reasoning、grok-build-0.1 與 grok-composer-2.5-fast 在 Grok OAuth 上接受 `service_tier: "priority"` 並回聲該值，
所以這些資料列會宣告 Fast、接受 `--fast` 選擇器，並在任一線路上轉送呼叫端送來的層級。grok-4.20-multi-agent-0309 被排除：
送出 `priority` 時閘道回應的是 `service_tier: "default"`，所以它維持未分類，其呼叫端層級不會被轉送。未列出的模型在兩種傳輸上都維持未分類。

在 OAuth 閘道上，Grok 4.7 的 Fast 運作方式不同。閘道還列出 `grok-4.7-build-fast`，這是在較快服務硬體上的同一個模型，實測約比 `grok-4.7` 快 1.6×。
`grok-4.7` 上的優先處理實測並沒有更快，每個輸出 token 卻消耗約 6× 的訂閱用量。因此模型清單只顯示一列 Grok 4.7。
選擇它的 Fast 資料列（`xai/grok-4.7--fast`）、送出 `service_tier: "priority"`，或開啟 Fast 模式，都會以 `grok-4.7-build-fast` 且不帶服務層級送出請求。
請求記錄把模型保留為 `grok-4.7`，並把 `grok-4.7-build-fast` 記為線路模型。API 金鑰模式不變：build-fast 不在 xAI 的公開 API 上，
所以那裡的 Grok 4.7 Fast 仍代表優先處理。較早設定中明確的 `xai/grok-4.7-build-fast` 選擇仍可繼續運作。

未設定明確的供應商 `fastWire` 時，受 `allowedModels` 限制的 opencodex API 金鑰，必須允許 `xai/grok-4.7-build-fast`（或其裸模型 ID），才能用於 OAuth Fast。
只允許 `xai/grok-4.7` 並不授權這個 Fast 模型變體。只允許 Fast 線路模型的金鑰可以使用它；一般請求或停用 Fast 時，仍需要 `xai/grok-4.7`。
若有明確的供應商 `fastWire`，則改為允許實際的線路模型。例如，`service-tier` 線路維持 `xai/grok-4.7`，並要求該模型的權限。供應商的限制仍然適用。
這些規則適用於 Responses、Chat Completions、Messages 與路由的壓縮請求。

xAI 對優先處理按標準 token 價格的 2× 計費，涵蓋輸入、輸出、快取與推理 token；快取折扣在乘數之前套用。
只有 xAI 的回應確認 `service_tier: "priority"` 時，成本估算才使用這個加價。缺少或無法解析的回應層級不算確認，
回聲的 `default` 是降級；這三種情況都維持標準價格。

對於 `grok-4.6` 與 `grok-4.7`，每 1M token 的標準費率是輸入 $2.00、快取輸入 $0.50、輸出 $6.00。
提示詞達 200,000 token 以上時，整個請求改按 $4.00 / $1.00 / $12.00 計價。xAI 尚未公布這個長上下文區間如何與優先處理疊加。
因此當長上下文回應確認了 `priority`，儀表板會以 `≥` 標記與下限說明顯示已公布的長上下文成本；它絕不會自行編造疊加的乘數。

### OpenRouter Fast

標準的 `https://openrouter.ai/api/v1` 預設組合僅對以下精確的 OpenAI 後端模型代稱廣告 Fast：

- `openai/gpt-5.6-sol`
- `openai/gpt-5.6-terra`
- `openai/gpt-6.1-terra`
- `openai/gpt-5.6-luna`

`anthropic/claude-sonnet-5` 與未宣告的 OpenRouter 模型維持未分類。供應商層級的 `supportsServiceTier` 預設刻意省略，
而使用者設定的 `supportsServiceTier: false` 仍會停用這些精確模型宣告。登錄檔宣告只在供應商仍指向標準 OpenRouter base URL 時才適用；
同名的自訂目的地不會被假定共享 OpenRouter 的契約。

Fast 會送出 `service_tier: "priority"`。它不會新增或改寫 `provider.only`、`provider.order` 或 `provider.allow_fallbacks`。
OpenRouter 將優先端點記載為第一路由選擇，並在優先容量不可用時平順回退到其他端點。計費依循實際使用的端點，
而回應會回報實際的頂層 `service_tier`。因此固定層級端點並停用回退只會降低可用性，而不會提升計費安全性。

請求日誌會以該回應回聲為準。`priority` 確認已套用 Fast；`default` 記錄為降級並使用標準價格估算；缺失欄位則讓該嘗試保持假定狀態，
而非猜測發生降級。OpenRouter 的優先倍率依上游而異，不會內建於此處。當確認為 priority 但未知確切的優先價格時，
儀表板會將標準價格估算保留為文件化的下限並加上 `≥` 前綴；已降級的嘗試沒有下限標記。

API-key 供應商可以持有明文金鑰，或環境變數參照。OAuth 供應商使用由 `ocx login` 寫入的憑證存放區；
訂閱制 Claude Code 的啟動行為則在 [`claudeCode.authMode`](/zh-tw/reference/configuration/server/#claude-codeclaudecode) 下設定。

OrcaRouter 明確提供兩種形式：`orcarouter` 是手動 API-key 供應商，
`orcarouter-oauth` 則以 S256 PKCE 執行瀏覽器同意流程，再把回傳的長效 API 金鑰存成帳號憑證。
公開預設值刻意將驗證（`https://www.orcarouter.ai`）
與推論（`https://api.orcarouter.ai/v1`）分開。
若是單一來源的自架部署，請在第一次帳號登入前設定 `ORCAROUTER_BASE_URL`；若驗證與推論使用不同來源，則改用
`ORCAROUTER_AUTH_BASE_URL` 與 `ORCAROUTER_API_BASE_URL`。
若是 loopback／私有網路的自架端點，請**在第一次登入前**建立或更新 `providers["orcarouter-oauth"]`，
設定 `adapter: "openai-chat"`、預期的 `baseUrl`、`authMode: "oauth"`，並明確加上 `allowPrivateNetwork: true`。
登入會保留該操作者設定，且絕不會因 URL 覆寫而自動授予它。沒有這項設定時，目的地驗證會拒絕該本機端點，使推論與模型探索都無法使用。
OAuth 瀏覽器回呼監聽器本身不需要這項供應商選擇加入。請參閱 [OrcaRouter 設定範例](/zh-tw/guides/providers/)。

## 供應商診斷對外安全

儀表板連線測試與即時模型探索使用有界的 GET-only 傳輸。在沒有對外代理的情況下，opencodex 解析主機名稱一次並僅連接到該已驗證位址。HTTPS 保留原始 Host、SNI 與憑證驗證；供應商設定無法停用憑證檢查。

當本機處理尚未準備好接收更多資料時，直接回應下載會暫停，包含 gzip 與 deflate 回應。這種暫停不計入供應商無活動時間；請求的整體期限與取消仍然適用。

這些操作使用[伺服器設定的對外 fetch](/zh-tw/reference/configuration/server/)。以 `config.proxy` 設定或繼承自 SOCKS5 `ALL_PROXY` 的伺服器 SOCKS5 代理，在目標不符合 `NO_PROXY` 時使用 OpenCodex 的內建通道。`HTTP_PROXY` 與 `HTTPS_PROXY` 保留 Bun 的原生 HTTP(S) 處理，而非 SOCKS 的 `ALL_PROXY` 不是原生 HTTP fetch 路由。URL 與字面位址檢查仍會執行，但所選代理會決定最終路由、DNS 答案與對等端，因此 opencodex 無法 pin 或驗證該對等端。這是明確的安全限制。

私有／本機目的地需要 `allowPrivateNetwork: true`，且當對外代理活躍時需要相符的 `NO_PROXY` 項目。回送會自動加入；請明確列出每個 LAN 主機，因為 CIDR 項目不被解讀。比對器支援精確主機、網域後綴、可選連接埠、方括號 IPv6 與 `*`；例如，明確列出 `192.168.1.50`。中繼資料與 link-local 目標保持被封鎖。診斷請求拒絕重新導向並回報已剝離憑證的目標。普通供應商請求的重新導向審查與此診斷防護分開。

針對 Clash / Surge / Mihomo 使用者的 fake-IP DNS 例外有兩種，且都只作用於 DNS *回應*——URL 中的字面位址仍會被拒絕。IANA 基準區段 `198.18.0.0/15`（含 IPv4-mapped IPv6 寫法）在該主機適用對外代理時被接受。Mihomo 預設的 IPv6 fake-IP 區段 `fdfe:dcba:9876::/48` 採更嚴格的門檻：必須設定與 URL 協定相符的代理變數（`https:` 對應 `HTTPS_PROXY`，`http:` 對應 `HTTP_PROXY`）或 SOCKS5 的 `ALL_PROXY`（非 SOCKS 的 `ALL_PROXY` 不算），主機不得命中 `NO_PROXY`，之後請求會被明確綁定到該代理。其他 ULA、相鄰前綴，或與真實私網回應混合的 fake-IP 回應仍需要 `allowPrivateNetwork: true`。提供者儲存時的驗證不套用此 IPv6 例外。

## Codex 帳號池

在儀表板中使用 **Codex Auth** 新增池帳號並重新整理配額。`config.json` 儲存非秘密中繼資料；access 與 refresh token 使用強化的憑證存放。池路由將新／未綁定指派、基於用量的主動切換與失敗復原分開。綁定任務通常保留親和性。預設（`pool.cacheAffinity`）下，`quota` 不會只因越過用量閾值就重新綁定它；該重新綁定會等到綁定帳號耗盡或無法繼續服務，並且只改綁到確有額度餘裕且用量嚴格更低的帳號。設 `pool.cacheAffinity: false` 可恢復依閾值重新綁定綁定任務，但仍只前往該類目標。暫停、冷卻、重新認證與配額拒絕仍會立即釋放即時綁定。連續暫時性失敗會先由另一個帳號服務請求並保留綁定，待原帳號恢復後任務即返回；10 分鐘後該綁定會正常釋放。未綁定請求沒有即時帳號綁定。帶有工作階段 ID 的請求（包括一般 Codex CLI 和 App 回合及子代理），或錨定到直接父任務的無工作階段請求，其綁定在關閉時最後一次親和性儲存成功的情況下，代理正常重啟後可保留，閒置時間最長為 24 小時。更深層的無工作階段鏈和 Codex App 主要登入的綁定僅保留在記憶體中，重啟後會重新指派；驅逐、帳號刪除、重新登入、崩潰或親和性重置仍可能使任務未綁定。Pre-stream 的 429 或 402，或其有界主體明確回報配額耗盡的 5xx 回應，會在同一個請求中於一個合格的備用帳號上重試一次，即使基於用量的主動切換關閉。一般的暫時性 5xx 政策會先執行，因此包著配額錯誤的回應在輪換帳號池之前，可能會在耗盡帳號上進行最多三次傳送。帳號變更保留並重播對話 context，但跨帳號的供應商端 prompt-cache 重用不保證，cache 可能需要重新暖機。

在 **401/403** 時，App 登入清除該帳號的行程本地親和性並要求重新認證。
在 **429** 時，opencodex 遵循 `Retry-After`、啟動帳號冷卻、清除親和性，並可能將請求輪換到另一個合格的池帳號。這些失敗轉換在 `autoSwitchThreshold: 0` 時仍然活躍；該設定僅停用基於用量的主動切換。

暫停帳號會保留其配額中繼資料，但將其排除於切換、容錯移轉、復原探測與手動啟用之外，同時清除該帳號的執行緒親和性。進行中的請求仍保留已擷取的憑證；後續回合則改道處理。若所有帳號皆已暫停，池路由會失敗而非靜默選取一個。**Pause exhausted** 會以可用憑證重新整理合格帳號，並僅暫停最新確認達 100% 的帳號；未知或失敗的重新整理保持不變。

| 策略 | 行為 |
| --- | --- |
| `quota`（預設） | 若無現用帳號，跨 5 小時、週與 30 天視窗選擇最低用量的合格帳號。否則將合格現用帳號保持在 `autoSwitchThreshold` 以下；在超過閾值後，未綁定請求可移至較低用量的合格帳號。預設下綁定任務保留 cache affinity 直到帳號耗盡（已知用量 100%）或無法繼續服務（暫停、不可用），改綁時只前往確有額度餘裕且用量嚴格更低的目標帳號，因此當所有帳號都超過閾值或唯一較空閒的帳號用量未知時，任務會留在原地。將 `pool.cacheAffinity` 設為 `false` 可讓綁定任務的下一個請求在閾值移動，但仍只前往該類目標。`0` 停用此用量驅動的重新評估，而非失敗復原。 |
| `round-robin` | 在合格帳號間均勻指派未綁定請求。輪替以計數器為基礎。新指派在仍有低於有效 `autoSwitchThreshold` 的合格帳號時，略過達到或超過閾值的帳號（帳號覆寫值或全域預設值，評分與 `quota` 相同）；用量未知或閾值為 `0` 均視為低於閾值。操作者的手動選擇會在每個配額 scope 中取得下一次指派，不論其用量；該 scope 中對此帳號的請求成功後，此選擇即被消耗，之後在該 scope 的指派會再次套用閾值。當所有合格帳號均達到或超過閾值時，輪替涵蓋全部帳號。已綁定任務超過閾值仍保留帳號，僅在帳號無法服務（冷卻、配額拒絕、容錯移轉、暫停）時移動；活躍對話的子任務從父任務使用的帳號開始。共用優先順序層級篩選以相同方式評估餘裕。`accountPoolStickyLimit`（1–100）計數一次選擇上的指派，而非成功的上游回應。 |
| `fill-first` | 將未綁定請求指派到現用帳號直到冷卻、重新認證或該帳號的有效排空閾值（帳號覆寫值，未設定則使用全域值）；未知用量不強制切換。健康的綁定任務保留親和性。 |

輪替無法防範供應商執法；多帳號使用可能違反供應商條款。

### `anthropicAccountPool`（實驗性）

此選擇加入功能池化已儲存在 `auth.json` 中的多個 Anthropic OAuth 帳號。預設關閉且屬實驗性質，Anthropic 並未背書自動帳號池化。同一組織中的帳號可能共享配額，而切換帳號無法防範供應商限制。此池所適用的訂閱與用戶端條件請見 [Claude Code 指南](/zh-tw/guides/claude-code/#claude-oauth-帳號池實驗性)。

| Key | 型別 | 預設值 | 說明 |
| --- | --- | --- | --- |
| `anthropicAccountPool.enabled?` | `boolean` | `false` | 啟用 sticky 工作階段親和性與依配額排序的新工作階段選擇。**429 容錯移轉不由此開關控制**：只要儲存了兩個以上可用帳號就會生效，與其他多憑證供應商一致，且無法關閉。 |
| `anthropicAccountPool.nativeMessages?` | `boolean` | `true` | 啟用池化時，對符合資格的直接 Anthropic 路由優先使用原生 Claude Messages。明確的原生推出退出選項依然適用。`false` 會為池化請求選用舊版橋接；關閉池時保留明確的推出行為。 |
| `anthropicAccountPool.autoSwitchThreshold?` | `number` | `80` | 對於新 session，當現用帳號達到此閾值時，選擇設定視窗中已知快取用量最低的帳號，並優先選擇低於自身閾值的帳號；所選帳號本身不必達到或超過閾值。`0` 僅停用**主動的**基於用量切換——新 session 選擇與符合條件的 429 後路由復原仍會使用 `quotaWindow`。 |
| `anthropicAccountPool.strategy?` | `"quota" \| "round-robin" \| "fill-first"` | `"quota"` | 新 session 策略。`quota` 保留現用帳號，直到其 `quotaWindow` 用量達到有效 `autoSwitchThreshold`（預設 80）或無法服務，再轉到用量最低的帳號，優先選擇低於自身閾值的帳號；用量未知時保留現用帳號。`round-robin` 不讀取用量閾值，輪替新 session。`fill-first` 在 `quotaWindow` 中評估排空閾值。 |
| `anthropicAccountPool.quotaWindow?` | `"five-hour" \| "weekly" \| "max-utilization"` | `"five-hour"` | 使用量型帳號選擇所採用、由供應商回報並快取的用量列。`five-hour` 保留原有行為。`weekly` 評分每週用量列，並在仍有其他可用帳號時略過 5 小時用量已用盡的帳號；若沒有其他帳號，則退回使用耗盡的候選帳號。`max-utilization` 評分已知值中的最高條，因此每週用量尚未取得時仍可使用 5 小時用量；兩者都未知時，帳號遵循 unknown 用量排序。僅在選擇加入的 `weekly` 與 `max-utilization` 視窗下，已知用量才會排在 unknown 之前；省略或明確指定 `five-hour` 時保留舊版排序。若所有可用帳號都是 unknown，仍會依可用順序選出一個。完成前述較低 5 小時用量的同分判定後，完全相同時也保留可用順序。不會主動重新平衡健康且已有親和性的 session。當 `quota` 選擇替代帳號時（現用帳號達到閾值或無法服務的新 session，或符合條件的 429 後復原），優先選擇低於自身閾值的候選帳號並依此視窗排序；`fill-first` 依此視窗的門檻與用盡規則按穩定順序前進；`round-robin` 忽略此設定。冷卻狀態、容錯移轉上限與重新驗證資格仍是獨立的本機狀態。每個帳號的每週用量來自用量探測或觀察到的回應標頭。 |
| `anthropicAccountPool.stickyLimit?` | `number` | `1` | 在一次 round-robin 選擇上保留的成功新 session 綁定。範圍 1–100。 |
| `anthropicAccountPool.routes?` | `{name, match, accounts, fallback?}[]` | — | 已啟用 Anthropic OAuth 池的有序模型路由。`match` 為完整的區分大小寫模型 ID 萬用模式（`*` 與 `?`）；採用第一個符合的規則。`accounts` 包含儲存的帳號 ID，而非別名。初始選取與 429 重試時，合格帳號僅限於該路由所列帳號。未設 fallback 時，空路由會回傳本機 401；若其宣告的所有帳號都在冷卻，則回傳帶有路由範圍 `Retry-After` 的 429。設為 `fallback: true` 時，全部冷卻的一般池會回傳帶有其最早可用冷卻時間的 429，即使已儲存的路由帳號已被移除亦同；用戶端回應絕不指名該路由；代理日誌會以 `route:#<n>` 記錄該規則以 1 為基底的位置。`fallback: true` 僅在沒有路由帳號合格時才放寬範圍；`fill-first` 接著使用一般池順序。沒有符合的規則會保留一般選取；停用池會使已儲存的路由變為非作用中。無效規則會使驗證寫入失敗並阻止路由派送直到修正。透過設定 API 傳入 `null` 可清除路由。 |

Anthropic OAuth 的視覺與網頁搜尋輔助工具會各自以自己的模型比對這些路由，獨立於主請求模型。每個輔助工具都使用其路由帳號進行認證，這可能不同於全域現用帳號。若嚴格的輔助工具路由沒有合格帳號，該輔助工具會在發出任何供應商請求前於本機失敗；它不會悄悄改用路由之外的帳號。當主請求運作正常但圖片描述或網頁搜尋失敗時，請檢查該輔助工具設定的模型，以及該模型路由下的合格帳號。

共用配額的 429（被拒絕的共用 5 小時／7 天視窗）會冷卻服務帳號並可在合格的兄弟帳號上復原。`Retry-After` 優先，否則使用最新的有效被拒重設時間，沒有可用期限時預設為 60 秒。暫時速率節流只會暫停該帳號的准入、保留親和性，並允許每個請求最多一次短暫的同帳號重試及最多一次兄弟帳號繞道。沒有標頭的 429 只允許在同帳號上最多一次短暫重試、保持帳號健康不變，且不新增合成的 `Retry-After`。這些重試共用實體傳送預算，並在取消或已提交串流輸出時停止。預設單帳號行為不變。請求模型的共用 5 小時／每週及家族每週證據決定其池准入。僅限 Fable 的拒絕會讓 Sonnet 在同一帳號上保持合格。被動 Fable 證據在 30 分鐘或已知重設時間後到期，並由一次服務請求依序重新驗證。用量門檻仍是軟偏好，全部候選耗盡時保留原有退回機制，不是硬性用量或帳單上限。主動用量探測除非回應權威地列舉限制，否則會保留缺席的家族視窗。用量讀取優先採用可識別的 `limits` 列而非舊版配額桶。Pro、Max 5x 與 Team 會保留量測到的 5 小時與每週計量，以目前具約束力者為準。共用用量即使在非作用中時仍影響准入與冷卻復原。明確為 null 的 5 小時桶只有在 Anthropic 將有限的工作階段計量標為作用中時才會建立計量。模型範圍的每週限制在作用中時僅限制該模型家族；全模型每週限制則套用於每個模型。舊版 Pro/Max 用量桶仍受支援。

[Ultra 取代了 Max 20x](https://support.claude.com/en/articles/17728952-what-is-the-ultra-plan)；上游仍可能將其識別為 `claude_max_20x`（顯示為 `max_20x`）。沒有作用中 5 小時上限的 Ultra 帳號僅顯示每週用量。層級名稱屬於顯示中繼資料（包含未來未知的層級），絕不代表額外配額或 API 點數。重設贈點仍為選用、明確的動作，各有其資格與到期時間；讀取用量絕不會消耗它。以 `access_denied` 拒絕的配額讀取也可能代表帳號的 access token 已過期；方案更名不會修復憑證。

親和性為行程本地且有界。Token 更新憑證失敗保留現有重新認證規則。已分類的輸出前訂閱／帳號計費 403 會清除親和性並按 `Retry-After` 或預設十分鐘冷卻帳號，然後再嘗試合格的替代帳號。一般或請求層級的 403 仍為終端錯誤；見 [Claude 帳號復原](/zh-tw/guides/claude-code/)。若所有合格帳號都在冷卻，用戶端會收到附帶已知 `Retry-After` 的 429，而非認證錯誤。

當請求可用的每個帳號都因配額耗盡而被保留（共用 5 小時或每週視窗，或所請求模型家族的每週視窗）時，這個 429 是用量上限而非速率限制：Responses 本文的 `error.type` 與 `error.code` 為 `usage_limit_reached`；若每個被保留帳號的上游重設時間都已知，還會附上 `resets_at`（最早重設的 epoch 秒）。Codex 會停止並顯示何時可再試，而不是一路重試到 "exceeded retry limit"。最後一個帳號因配額耗盡被拒且沒有可替換帳號時，也會得到相同回應。只要有一個被保留帳號只是暫時限速、正在重新驗證模型家族或因權限被拒，回應就維持可重試的 `rate_limit_exceeded`。Combo 目標維持速率限制形式，讓 combo 能轉到下一個目標。原生 `/v1/messages` 維持 Anthropic 的 `rate_limit_error` 類型，訊息中會說明用量上限。

只要一次新的用量讀取（儀表板的提供者頁面，或 `ocx account list anthropic --quota --refresh`）顯示每個被拒絕的視窗都低於 100%，配額冷卻就會提前解除，不論它來自 `Retry-After` 或視窗重設。這適用於升級方案或視窗提早重新開放的情況。在拒絕之前開始的讀取永遠不會解除它，權限類 403 冷卻會等到其截止時間。

Anthropic 的回應也會回報服務端帳號的 5 小時與每週使用率，一則回應帶有這兩者中的哪一個，就會記錄在該帳號上——兩個視窗各自獨立，無論是拒絕還是成功的回應都會記錄。因此用量感知選擇可以直接從你實際使用的帳號運作，不必等儀表板的 Providers 頁面去輪詢它們。這些讀數會刷新既有的列，而不是取代它，所以只有 usage 端點才會回報的、model-scoped 的每週列，會在其已知重設時間之前被保留。過期的量測值會變成未知，包括被後續標頭省略的既有標準視窗。一個只帶重設時間的標頭無法延長一個較舊的使用率量測值。沒有已知重設時間的值維持既有行為；缺席的量測值絕不會被替換成零用量。

標頭觀測不會延後用量探測，也不會清除一次失敗探測的不可用狀態。重新啟動後，快取的 Anthropic 觀測值仍然可用，同時下一次配額讀取會再次探測，因為儲存的觀測值不包含探測時鐘。

:::caution[實驗性]
除非你了解 Anthropic 帳號政策風險，否則保持停用。不確定時偏好手動 `ocx account use anthropic <id>` 切換。
:::

### Anthropic · Pool 2 (`anthropic2`)

`anthropic2`（「Anthropic · Pool 2」）是第二個內建的 Anthropic OAuth 供應商，擁有自己的帳號池。它執行與 `anthropic` 相同的 Anthropic 實作：相同的登入流程、線路格式、原生 Messages 與 Responses 橋接，以及模型中繼資料。只有帳號和圍繞它們的池是分開的。使用模型前綴來選擇池：`anthropic/claude-sonnet-5` 使用主池，而 `anthropic2/claude-sonnet-5` 使用 Pool 2。

Pool 2 在你新增它之前會保持休眠。使用 `ocx login anthropic2` 登入，或在儀表板 Providers 頁面新增 **Anthropic · Pool 2**。首次成功登入會建立帶有 `"anthropicOAuthInstance": "anthropic2"` 標記的 `providers.anthropic2`。Pool 2 絕不會成為預設供應商：裸 `claude-*` 模型名稱、預設模型與 Claude Code 呼叫端轉發仍持續解析至 `anthropic`。你先前自行建立的未標記 `anthropic2` 項目會保留其自訂意義；登入會拒絕名稱碰撞，既不會改寫該項目也不會改寫你的憑證。

Pool 2 從自己的供應商項目讀取其池設定。鍵名、預設值與行為皆與頂層的 [`anthropicAccountPool`](#anthropicaccountpool實驗性) 相同，且不會從主池繼承任何設定。`providers.anthropic.anthropicAccountPool`，或在任何其他供應商上的該欄位，都會被拒絕。

```json
{
  "anthropicAccountPool": { "enabled": true, "strategy": "quota" },
  "providers": {
    "anthropic2": {
      "adapter": "anthropic",
      "authMode": "oauth",
      "baseUrl": "https://api.anthropic.com",
      "anthropicOAuthInstance": "anthropic2",
      "anthropicAccountPool": { "enabled": true, "strategy": "round-robin" }
    }
  }
}
```

兩個池在 opencodex 內部彼此隔離：

- **憑證：** Pool 2 帳號儲存在受保護憑證存放區中自己的 `anthropic2` 鍵底下。若登入的 token 或已驗證 Anthropic 帳號已儲存在另一個池中，該登入會被拒絕。
- **池設定與執行期狀態：** 選取、工作階段親和性、冷卻、暫停、模型路由與逐帳號門檻皆隸屬於單一池。路由 `fallback: true` 只會在同一個池內放寬。
- **配額與用量：** 用量探測、配額快取與用量歸屬皆按池分別記錄，因此同時存在於兩個池中的帳號 ID 仍會有兩筆獨立紀錄。
- **重設贈點：** Pool 2 在主池未變動的日誌旁保留自己的日誌（`anthropic2-reset-grant-ledger.json`）。
- **復原：** 直接的 `anthropic2/<model>` 請求絕不會回退至主池，且 Pool 2 的速率限制或拒絕絕不會冷卻主池帳號。明確指名兩個池的組合會保留你宣告的目標。

這種隔離是 opencodex 內部的路由邊界。它不會改變 Anthropic 如何看待你的帳號，也不會改變上述的[帳號政策風險](#anthropicaccountpool實驗性)。

Pool 2 帳號只能透過瀏覽器 OAuth 新增。與 `anthropic` 不同，Pool 2 絕不會匯入、收編或寫回 Claude Code CLI token；這項差異是刻意設計的。Pool 2 起始為空，沒有可用 Pool 2 帳號的 Pool 2 請求會以認證錯誤失敗，而不會借用主池或 Claude Code 憑證。

帳號指令與管理 API 會以名稱指定該池：`ocx account pool anthropic2 …`、`ocx account auto-switch anthropic2 …`、`ocx account routes anthropic2 …` 與 `ocx account anthropic-reset-grants --provider anthropic2`。池設定與重設贈點端點接受 `provider: "anthropic2"`；省略它會維持主池。

#### 輔助工具池選取（`anthropicInstance`）

Web-search 與視覺輔助工具在全域 `webSearchSidecar` 與 `visionSidecar` 設定中，以及 Claude Code 覆寫 `claudeCode.webSearchSidecar` 與 `claudeCode.visionSidecar` 中，接受選用的 `anthropicInstance`。當輔助工具後端為 Anthropic 時，儀表板會將其顯示為 **Pool** 下拉選單。

| 值 | 行為 |
| --- | --- |
| 未設定（預設） | 跟隨目前請求的池：`anthropic2/<model>` 請求使用 Pool 2，而 `anthropic/<model>` 請求使用主池。來自其他供應商的請求保留既有的輔助工具探索，絕不會選取 Pool 2。 |
| `"anthropic"` | 一律使用主池。 |
| `"anthropic2"` | 一律使用 Pool 2。 |

此欄位僅在輔助工具的後端解析為 Anthropic 時套用。搭配其他後端設定它屬於驗證錯誤；因為網頁搜尋預設為 OpenAI，請同時設定 `"backend": "anthropic"`。以另一個池限定的輔助工具模型（例如 `"anthropicInstance": "anthropic2"` 搭配 `anthropic/claude-sonnet-5`）也會被拒絕。若所選的池沒有可用帳號，輔助工具會在送出任何內容之前失敗；它不會切換到另一個池。主請求接著會在沒有該輔助工具的情況下繼續執行。未設定的選擇會儲存為缺席，絕不存為 `"anthropic"`。

```json
{
  "webSearchSidecar": { "backend": "anthropic", "anthropicInstance": "anthropic2" }
}
```

:::caution[降級]
沒有 Pool 2 的版本無法理解 `anthropic2` 項目。在安裝較舊版本之前，請先停止代理、備份 `config.json` 與 `auth.json`，並從 `config.json` 移除 `providers.anthropic2`。主池憑證絕不會被 Pool 2 移動或改寫。不支援在仍有作用中 Pool 2 的情況下就地降級。
:::

### `oauthAccountFailover`

針對沒有獨立帳號池的 OAuth 供應商（xAI、Cursor、Kimi、GitHub Copilot、Google Antigravity 與 Nous），當一個已登入帳號受到速率限制時，輪換至同一供應商的另一個已登入帳號。

**登入第二個帳號即開啟此功能，且沒有開關能將其關閉。** 只要這些供應商持有 2 個或以上未被標記為需要重新認證的帳號，輪換就會啟動——這與 `apiKeyPool` 已對 2 把以上金鑰池套用的規則相同。僅儲存一個帳號的供應商，其行為與先前完全相同。

此處的輪換只會在上游已經拒絕請求*之後*才執行，因此停用開關唯一能提供的選擇，是在「重試你刻意登入的第二個帳號」與「在該帳號閒置時回傳 429」之間二選一。拒絕輪換的表達方式就是不要儲存第二個帳號。

| 鍵 | 型別 | 預設值 | 說明 |
| --- | --- | --- | --- |
| `oauthAccountFailover.enabled?` | `boolean` | 依存在與否決定 | 僅針對**派送前帳號偏好**的全域覆寫。`false` 會停止將健康請求導向已知餘裕較多的帳號。它**不會**停用 429 輪換。 |
| `providers.<name>.oauthAccountFailover.enabled?` | `boolean` | 繼承 | 針對相同偏好的逐供應商覆寫；無論任一方向皆優先於全域設定。即使全域設為 `true`，`false` 仍會為此供應商停用偏好；即使全域設為 `false`，`true` 仍會讓此供應商選擇加入。被動 429 輪換在兩種情況下皆不受影響。 |
| `providers.<name>.oauthAccountFailover.sessionAffinity?` | `"conversation" \| "none"` | `"none"` | 通用 OAuth 池的選擇加入對話釘選。需要主動偏好的 `enabled: true`（供應商自身或繼承的全域值）。既有工作階段在帳號變得不可用之前，會優先於新工作階段策略而保留其帳號。 |
| `providers.<name>.oauthAccountFailover.strategy?` | `"quota" \| "round-robin" \| "fill-first" \| "reset-first" \| "least-loaded"`（僅限 Kiro） | — | Kiro 的 `least-loaded` 會挑選進行中請求最少的合格帳號，同分時使用帳號順序。它需要 `pool.kernel` 與主動偏好；其他策略保留各自既有規則。`reset-first` 同樣需要 `pool.kernel`：在未耗盡的合格帳號中，首次嘗試（在主動偏好開啟期間）與 429 輪換都會優先選擇配額最快重設的帳號（若有回報週視窗則看週視窗，否則看 5 小時視窗），同分時以餘裕較多者勝出。已耗盡帳號排在最後。沒有配額證據，或被動供應商只有部分帳號有證據時，會退回依餘裕排序。Anthropic 池不接受此值。 |
| `providers.kiro.oauthAccountFailover.maxConcurrentPerAccount?` | 整數 1–100 | 無限制 | 程序本機的逐帳號佇列會持有一個插槽直到回應完成或取消。已滿的所選帳號最多等待 250 ms，然後回傳帶有 `Retry-After: 1` 的 503 `account_capacity`。此上限不會將請求移至另一個帳號。 |
| `providers.<name>.oauthAccountFailover.autoSwitchThreshold?` | `number` | `80` | `fill-first` 從現用帳號前進離開的 0–100 用量百分比（#695）。以 `ocx account auto-switch <provider> threshold <n>` 設定。僅在搭配 `pool.kernel` 與 `strategy: "fill-first"` 時讀取；沒有實測用量的帳號視為低於門檻。 |
| `providers.<name>.oauthAccountFailover.stickyLimit?` | `number` | `1` | 在一次 `round-robin` 選擇上保留的成功派送次數，1–100（#695）。僅在搭配 `pool.kernel` 與 `strategy: "round-robin"` 時讀取。 |

若要針對某個你不想測試其條款的供應商停用主動帳號導向，同時仍保留從速率限制復原的能力：

```json
{
  "providers": {
    "cursor": {
      "oauthAccountFailover": { "enabled": false }
    }
  }
}
```

該設定在登入、新增帳號與重新認證後都會存活。

通用 OAuth 供應商（Google Antigravity、xAI、Cursor、Kimi、GitHub Copilot、Nous，以及 Codex 與 Anthropic 池之外的任何其他 OAuth 供應商）也會透過 `GET`/`PUT /api/oauth/accounts/pool?provider=<name>` 以及 `ocx account strategy` / `ocx account auto-switch` / `ocx account sticky` 指令，在同一個鍵上接受 `strategy` 與 `autoSwitchThreshold`。回應只會對這三個欄位帶有 `"inert"`——在儲存但未被消費期間為 `true`，一旦 `pool.kernel` 開啟且它們實際參與選取帳號則為 `false`——而 `enabled` 一律即時生效並控管派送前偏好。`quotaWindow` 不屬於通用契約的一部分。Codex（`/api/codex-auth`）與 Anthropic（`anthropicAccountPool`）保留各自的契約不變。

將 `providers.<name>.oauthAccountFailover.sessionAffinity` 設為 `"conversation"` 並搭配 `enabled: true`，可讓對話保留在其獲准入的帳號上。工作階段身分依序使用用戶端執行緒標記、工作階段標頭、執行緒標頭，然後是 `prompt_cache_key`；排除共用的 Desktop 快取群組。綁定依供應商、設定家目錄與已認證呼叫端主體隔離。未認證的本機呼叫端共用本機範圍。沒有工作階段標記就不會建立綁定。

新工作階段使用既有策略（`pool.kernel` 仍控制 round-robin/fill-first）。即使另一個帳號有更多配額，既有工作階段仍維持釘選。暫停、需要重新認證、家族冷卻或不相容的模型名冊會釋放綁定；既有的有界失敗復原則會綁定獲准的替代帳號。Kiro 的並行上限仍會等待或拒絕，而不會僅為了平衡負載就移動健康的已綁定對話。

在此模式下，包含無鍵請求與容錯移轉在內的自動選擇會維持在請求本地：儀表板所選帳號仍是操作者的選擇。請求歷史仍會歸屬於實際提供服務的帳號。手動選擇、同帳號重選以及名冊／政策修訂變更會使供應商綁定失效，包括來自另一個程序的寫入。一般重新整理會保留相同帳號。Fill-first 在記憶體中保留其目前帳號，而不變更已儲存的選擇。綁定在沒有准入的 24 小時後過期、全程序限制為最多 2,000 筆項目（含 fill-first 游標），並在重啟後遺失。設為 `sessionAffinity: "none"` 或停用主動偏好可釋放它們。Codex 與 Anthropic 保留各自的親和性契約。

Codex 池與 Anthropic 池被排除並保留各自的輪替；啟用此功能不會改變兩者。僅儲存單一帳號的供應商屬於嚴格的無動作（no-op），也不會為其記錄任何冷卻。

派送之前，通用 OAuth 會先為合格名冊拍快照。遇到 429 時，失敗的帳號會依出現的 `Retry-After`（上限 15 分鐘）或預設退避進行冷卻，請求則會在從即時名冊選出的下一個帳號上重播。穩定的輪替上限為每個請求 `max(3, min(eligibleCount, 6) - 1)` 次；即時選取仍會過濾冷卻中的帳號，且被標記為需要重新認證的帳號絕不會被選取。冷卻為程序本機狀態，重啟後會遺忘。

當至少有兩個帳號合格時，進站擁有的預設傳送額度涵蓋每個合格帳號最多三次傳送，最多計算六個帳號，因此無論登記多少帳號，一個請求最多不會進行超過 18 次傳送。單一合格帳號保留既有的基礎額度三次與總額度四次。明確的呼叫端上限與組合範圍維持既有限制。

輪替會攜帶替代帳號的**完整**憑證快照，而不只是 bearer，因此把路由中繼資料與 token 配對的供應商（例如 Antigravity 的 Cloud Code Assist 專案 ID）絕不會發生把一個帳號的 token 配上另一個帳號中繼資料的情況。

對於透過 Google 轉接器主派送執行的主要 Antigravity 推論，遇到 401 會先重新整理並重播同一個帳號。若該次重播仍然是 401，或重新整理因需要重新認證的終端憑證拒絕而失敗，請求可以切換一次到合格的即時兄弟帳號。該兄弟請求保留轉接器一般的暫時性重試，而每次實體傳送都會計入該請求既有的傳送預算。暫時性的重新整理失敗會保留已淨化的認證錯誤。已暫停、需要重新認證與冷卻中的帳號會被跳過；失敗的憑證只在目前世代有效期間取得 60 秒的程序內冷卻。當 Google 的有界錯誤正規化找到完整的結構化 `VALIDATION_REQUIRED` 原因時，同一個主派送也可以在 403 上切換一次。401 與 403 路徑共用每個請求一次兄弟嘗試的額度；無關或不完整的 403 保留其原始錯誤。被拒絕的兄弟帳號、取消或耗盡的傳送預算不會引發另一次上游傳送。基於 fetch 的網頁搜尋迴圈在遇到此結構化 403 原因時也會輪換一次，使用兄弟帳號的 OAuth token 與相符的 Cloud Code Assist 專案。它只接受帶有 `error.details[].reason === "VALIDATION_REQUIRED"` 的完整有界 Google 錯誤封套；單憑驗證字樣不授權輪換，且此路徑不會持久化重新認證標記。每次實體傳送（含 429 重試）皆精確消耗同一份請求預算一次。停用的池、取消、耗盡的預算或無可用兄弟帳號會保留失敗結果。若兄弟請求建構或派送失敗，原始的有界 403 仍作為錯誤；在實體派送前被拒絕的重播會退還未使用的傳送額度。延續、原生 Responses passthrough、影像 sidecar 以及已送出給用戶端的輸出不使用此輪替。

目前涵蓋範圍為一般的 Responses 請求路徑。Cursor 將速率限制回報為轉接器事件而非 HTTP 狀態碼，而獨立的 Antigravity 影像端點有自己的請求路徑；兩者目前皆不輪替。

:::caution[實驗性]
跨訂閱帳號輪替會消耗第二個帳號的配額，且可能違反部分供應商的條款。如果這不是你想要的取捨，請在全域或針對該供應商設為 `enabled: false`。
:::

### 受管記錄結構

`apiKeys[]` 項目包含 `id`、`name`、生成的 `key` 與 ISO `createdAt` 字串。選用的 `allowMeteredComboTargets: true` 明確允許標記為 `metered: true` 的目標；省略或設為 `false` 則拒絕它們。環境變數 token 絕不具備資格。純本機 loopback 呼叫端可改用逐組合的 `allowMeteredTargets: true`；已設定金鑰與連結的呼叫端仍需要金鑰同意。詳見[計量後備同意](/zh-tw/guides/combos/#metered-fallback-consent)。
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

路由會在進入轉接器之前先解析供應商端點。對於多數內建供應商，登錄檔端點優先於設定的 `baseUrl`。有四種項目會保留已設定的 URL：

- 允許覆寫的供應商：`ollama`、`vllm`、`lm-studio`、`litellm`、`qwen-cloud` 與 `alibaba-token-plan-intl`；
- 由使用者填入的登錄檔範本，例如 `azure-openai` 與 `cloudflare-ai-gateway`；
- 保留較舊同名自訂目的地的已升級固定 API 金鑰預設集；以及
- 不在登錄檔中的供應商。

轉接器之後仍可調整解析出的 URL。例如 Kiro 會針對標準 `runtime.{region}.kiro.dev` 跟隨匯入憑證的 API 區域。詳見[轉接器](/zh-tw/reference/adapters/)。

當路由捨棄 `baseUrl` 時，opencodex 會記錄登錄檔端點，並僅記錄設定的 origin；設定的路徑本身可能含有憑證。請移除未使用的 URL，或選擇符合預期區域的供應商項目。`alibaba-token-plan` 固定為北京，而 `alibaba-token-plan-intl` 涵蓋國際端點。

對於行為異常的 `openai-responses` 閘道，修復設定屬於供應商物件：

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

佔位符清單為精確比對。對於一般／有狀態的 Responses 供應商請保持該欄位未設定，讓 passthrough 維持逐位元組完全一致。

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

原生 Cursor 視覺對能原生看圖的模型（其中包括 Claude、Gemini、GPT、Kimi 與 Grok）使用 `SelectedImage`（JPEG 軟上限 + `blobIdWithData`），僅使用目前回合的 `data:` 影像。較早回合的影像會重放為 `[image attached]` 文字標記；遠端或無法解碼的影像會變成省略標記。Auto、Composer 系列與 GLM（`glm-5.2`、`glm-5.3`）則留在策劃的 `noVisionModels` 清單中，並改用視覺描述 sidecar。

Cursor 由伺服器驅動的本機工具預設停用。Codex 會繼續使用自己的工具（例如 `apply_patch` 與 `exec_command`）及其自己的核准與沙盒政策：

- `"off"`（預設）拒絕 Cursor 原生的 `read`、`write`、`delete`、`ls`、`grep`、`shell` 與 `fetch` 執行。
- `"on"` 選擇加入受信任的本機執行並繞過 Codex 的核准／沙盒語意，但前景原生 shell 執行除外，它仍然無法使用。
- `"codex-sandbox"` 為相容性而保留，但會如同 `"off"` 一樣 fail closed；請求文字本身不是可信的沙盒證明。

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

請將 `nativeLocalExec` 設定在 `providers.cursor` 上，而非頂層。在儀表板中使用 **Providers → Cursor → Edit JSON**，儲存後再重新啟動。舊版的 `unsafeAllowNativeLocalExec: true` 僅在 `nativeLocalExec` 未設定時等同於 `nativeLocalExec: "on"`。MCP、螢幕錄製與電腦操作則分別由 `mcpServers` 與 `desktopExecutor` 控制。

對於已啟用的原生 `grep` 目錄搜尋，`glob` 會過濾檔案名稱：`*.ts` 匹配任意深度，而 `src/**/*.ts` 匹配相對於所選搜尋目錄的路徑（`./` 為選用）。在每個平台上都請使用 `/` 作為模式分隔符號。支援字元類別與大括號替代項；Bun 1.4.4 也支援諸如 `**/!(*.test).ts` 的 extglob 與諸如 `part-{1..3}.ts` 的範圍。這些過濾器不會變更所選目錄或啟用原生執行。

前景的 `shellArgs` 與 `shellStreamArgs` 請求在 Windows、macOS 與 Linux 上都會在建立程序之前被拒絕，即使設為 `nativeLocalExec: "on"` 亦同。它們需要這份實作未提供的核心支援後代擁有者；請改用用戶端的 shell 工具。串流形式仍會回傳啟動、中止結束、具型別的失敗與串流關閉，讓 Cursor 回合能夠結束。它不收集 stdout/stderr，也沒有作用中的輸出位元組額度。此限制不會改變背景 shell 執行或其他明確的執行器選擇加入項目。

每個 `mcpServers.<name>` 接受 `command`（stdio）或 `url`（Streamable HTTP）。Stdio 也接受 `args`、`env` 與 `cwd`；HTTP 接受 `headers`。兩者皆支援 `enabled`（預設 true）與 `toolPrefix`。`desktopExecutor` 接受 `computerUseCommand`、`recordScreenCommand`、`cwd`、`env` 與 `timeoutMs`（預設 `30000`）。指令透過 `sh -c` 執行，從 stdin 讀取一筆 JSON 請求，並必須將一筆 JSON 結果寫入 stdout。

:::caution[安全性]
預設的 loopback 繫結會不經認證接納任何本機程序，包含多使用者主機上的其他使用者。除非所有資料平面呼叫端都受信任，且你刻意接受繞過 Codex 的核准與沙盒語意，否則請讓本機執行保持關閉。
:::

## Zed 供應商（`adapter: "zed"`）

Zed Hosted AI 橋接是實驗性的，且僅限登入。使用前請先執行 `ocx login zed`；登入會把 Zed 帳號身分與它的原生 app 存取 token，一起存進一般的 OAuth 儲存區。

```json
{
  "providers": {
    "zed": {
      "adapter": "zed",
      "baseUrl": "https://cloud.zed.dev",
      "authMode": "oauth",
      "defaultModel": "auto"
    }
  }
}
```

橋接會取得短效的託管推論 token，並送出 `POST /completions`。即時的 `/models` 清單只用於帳號專屬的 picker 中繼資料：任意的模型 id 仍可轉送，後端家族則從即時的供應商欄位或模型名稱推斷。

:::caution[非官方——風險自負]
Zed 並未提供或認可這項整合，它也可能超出 Zed 的服務條款。Zed 可能限制或停權使用它的帳號。這個供應商絕不會預設啟用。
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

## 在 OS 金鑰圈中儲存金鑰

API 金鑰與憑證參照可以儲存在作業系統的憑證存放區（macOS Keychain、Windows 認證管理員、Linux Secret Service）中，而非 `config.json`。遷移指令、儲存規則與無頭服務注意事項的詳情，請見[在 OS 金鑰圈中儲存金鑰](/zh-tw/reference/configuration/keychain/)。

## 靜態模型允許清單

`zhipu-bigmodel-responses` 預設為 `https://open.bigmodel.cn/api/v1` 播種 `glm-5.3`、`glm-5.3-flash` 與 `glm-5-turbo`，並設定 `liveModels: false`。它的靜態名單與 per-model 的 context、effort 與摘要中繼資料，來自 [BigModel Responses 指南](/zh-tw/guides/providers/#bigmodel-coding-plan-over-responses)。官方的本機 `models.json` 範例不會建立一個即時的 `/models` API。

`liveModels: false` 時，若 `models` 為空或省略，會先播種已設定的 `defaultModel`，再接 `retainModels`；重複的 id 會被移除，同時保留首次出現的順序。明確設定的非空 `models` 清單則改為播種 `models` 後接 `retainModels`，不會隱含加入另一個 `defaultModel`。那個預設值仍可以明確寫進 `models` 或 `retainModels`。若這些欄位都沒有提供任何 id，靜態播種就是空的。這是播種順序，不是最終 picker 順序的保證。`selectedModels`、`disabledModels` 與供應商停用政策仍然適用。`authMode: "forward"` 保留它自己獨立的分支，不使用這個路由過的靜態播種。這些規則不會改變即時探索失敗時的後備行為。

即時探索在快取前會拒絕超過 4 MiB 或 2,000 個原始模型列；內建預設可能使用較低的限制，並過濾到 chat 合格列。過大或格式錯誤的結果會遵循過時／設定的後備。一個有效但零筆合格的結果仍具權威性，不會被靜默取代或截斷。

當探索應該照常執行，但只有選定的 id 應該出現在 Codex 與 `/v1/models` 中時，請使用 `selectedModels`。儀表板會保留完整的探索清單，供日後變更允許清單使用。

`retainModels` 用來解決相反的問題：某個供應商的 `/models` 端點漏掉了一個仍然可呼叫的 id（私有部署、預覽 id，或清單不完整的 OpenAI 相容閘道）。列出的 id 會以與 `models` 相同的 context 與 effort 提示保留在路由目錄中，即使 `liveModels: false` 也一樣存活。`selectedModels` 仍會縮小可見範圍，所以在啟用允許清單時，一個 id 必須同時出現在兩份清單中。保留一個 id 並不會讓上游接受它；錯誤的 id 仍會在請求時以上游錯誤失敗。從 CLI：`ocx provider edit <name> --retain-models gemini-3.7-flash,other-id`（`-` 可清空）。

預覽版 GPT-5.6 後備項目使用相同機制。OpenAI API-key 預設以 context `1050000` 與 max input `922000` 播種基礎與 Pro id；OpenRouter 以 context `1050000` 播種 `openai/gpt-5.6-sol`、`openai/gpt-5.6-terra` 與 `openai/gpt-5.6-luna`。原生池／Direct 視窗依循[保留的 OpenAI 供應商政策](#保留的-openai-供應商)。同步目錄廣告 `max`，同時讓 `xhigh` 保持獨立。

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

要做出以原生優先的 picker，請把原生 id 加進 `modelPickerOrder`，後面接路由 id。這會為整個 picker 排序，同時保留 OpenCodex 各自獨立的自然優先順序指引計算。原生 Codex 廣告的那五個模型會跟隨 picker 優先順序，且可能改變；精確名稱覆寫的資格不限於那份廣告清單。純路由順序保留它們先前的行為。見[排序遷移說明](/zh-tw/guides/model-ordering/#遷移提醒現有列表中的原生-id)。供應商上的 `modelDisplayNames` 控制可讀標籤，不會改變 wire id。

## 路由過的 agent 訊息

透過 [`openai-responses` adapter](/zh-tw/reference/adapters/#openai-responses)，當 `authMode` 不是 `"forward"`（例如 `"key"`）時，包含非空、受支援純文字部分陣列的 Codex `agent_message` 項目，會變成使用者訊息。使用 `authMode: "forward"` 的供應商會原封不動保留這些項目。`agent_message` 是 ChatGPT Codex backend 私有的，目前回報過的路由目的地會用 `422 unknown item type "agent_message"` 拒絕整個請求；Codex 會在之後每一個回合重播子代理的歷史，所以在該項目被轉換之前，這條執行緒會持續失敗。作者與收件者仍是明確的文字中繼資料，內容部分會被保留。對於標準連接埠上的 HTTPS `api.x.ai` 與 `cli-chat-proxy.grok.com`，非 forward 的 Responses 派送也接受一個非空白字串的子結果，並把它轉成一個 `input_text` 部分。原始字串——包括開頭／結尾的空白與換行——會被保留。其他目的地讓字串值的 agent 訊息維持不變。空字串或只有空白的字串維持不變，不完整以及混合加密／未知形狀的內容也是如此。加密與未知內容不會被正規化；原生加密任務仍需要獨立選擇加入的[任務復原](/zh-tw/reference/configuration/agents/#加密-v2-任務復原)。

啟用任務復原時，被重播的 `NEW_TASK`、`MESSAGE`、`FOLLOWUP_TASK` 與 `FINAL_ANSWER` 項目，只有在驗證呼叫端並比對父執行緒 scope 之後，才會重用一個快取的指派。重播還原不會發出新的復原請求，也不會延長快取的到期時間。過期或未見過的密文不會被取代。全新的加密 `NEW_TASK`、`MESSAGE`、`FOLLOWUP_TASK` 與 `FINAL_ANSWER` 項目使用同一個選擇加入的復原路徑，包括原生父層的 `send_message` 傳遞。訊息類型、寄件者、收件者、父層 scope 與呼叫端憑證，仍是驗證或快取身分的一部分。缺少 `Task name` 行的 `FINAL_ANSWER` 沒有可交叉比對的標頭位址，但其收件者仍會限制快取範圍。

當一個請求包含好幾則 agent 訊息時，快取的重播還原會各自獨立檢查每一則訊息。快取會在已准入的呼叫端／帳號與父層 scope 內，區分訊息類型、寄件者、收件者與密文。全新的復原只處理目前的尾端訊息（忽略尾隨的 `compaction_trigger` 或 `additional_tools` 中繼資料）。它不會批次復原未見過的歷史訊息；那些訊息維持不變。一次快取未命中或過期，不會延長歷史復原契約。

路由過的 Responses 上的寄件者與收件者，是給接收模型的脈絡，不是一個新的機器可讀路由協定。工具路由繼續使用既有的協作契約。

### 個別模型能力宣告

`modelCapabilities` 以精確的上游模型 ID 為 key，儲存明確的宣告。ID 會保留大小寫，且不得含前後空白。每個項目可以包含 `inputModalities`（`text`、`image`、`audio`、`video`）、`contextTier`（`default`、`long_context`）、`video.processing`（`static`、`agentic`）、`deepseekImageFiles`（布林值；見 [DeepSeek 影像位元組](#deepseektoken-與影像位元組)）、`mistralMaxImages`（整數 1–1000；見 [Mistral 每個請求的圖片數量](#mistral每個請求的圖片數量)）與 `responsesCustomTools`（`boolean`）。這些是維運方的宣告，不是供應商支援的證明。Context-tier 與 video 欄位目前只記錄意圖，不會啟動上游行為，也不會增加目錄視窗。`responsesCustomTools` 會對該精確最終線路模型覆寫 `supportsResponsesCustomTools`；未設定的模型值會繼承供應商值（操作者設定或登錄檔預設，例如 xAI 與 OpenGateway 為 `false`），而兩者皆未設定時會保留原生 Responses 自訂工具。

原始的供應商編輯器與供應商 API 都公開這個 map。POST／PUT 會取代明確提供的 map，並拒絕 null 項目。PATCH 會合併個別軸；`null` 會清除一個 map、模型、軸或 video processing 值，`{}` 則不做任何變更。省略的供應商覆寫會保留既有的 map。格式錯誤、手動編輯的檔案會保留有效的獨立軸，並把格式錯誤的明確輸入模態當成純文字處理，同時發出診斷訊息。

明確的 `modelCapabilities.<id>.inputModalities` 現在對該精確路由模型而言，會優先於舊版的模態提示。純文字宣告會使用既有的視覺 sidecar，把影像換成描述；若沒有可用的 sidecar，請求會在派送前收到一個明確的省略標記。原生 Chat 影像請求會透過這條路徑分流。目錄仍可以廣告影像附件支援，因為代理提供了這個描述步驟。Context-tier 與 video processing 宣告在其傳輸支援到位之前，仍維持不生效。

**自訂模型列**上的輸入模態宣告——Models 分頁中的 Input modalities 核取方塊，或 `customModels[]` 上的 `inputModalities`——對該精確供應商與模型 ID 同樣優先於供應商的舊版視覺提示（`noVisionModels`、`modelInputModalities`）。在自訂列上宣告 `text, image`，即使供應商列將其列為純文字，影像仍會送達該模型；只宣告 `text` 則會經由視覺 sidecar 路由。這與目錄原本就套用的優先順序相同，使廣告出來的列與請求現在趨於一致。`modelCapabilities` 仍在其上方，因為那是專用的逐模型能力軸——包含由 `ocx provider edit <provider> --model <id> --text-only` 所做的寫入。將模態留空的自訂列會繼承供應商列，而不是宣稱純文字。每個回答「這個模型能否接收影像」的使用者都會對該宣告套用同一條規則：清單中缺少 image。因此只宣告 `audio` 或 `video` 的列會計為不具影像能力，而不會被一個判斷式當成文字模型、卻被另一個當成影像目標。

### 提示長度計價

在 **Models → Price** 中保留四個基礎費率並選擇一種提示長度模式：

- **Automatic** 保留目錄的 context 規則。這也是未設定政策的既有四費率覆寫的行為。
- **Flat rate** 在所有提示長度下都使用基礎費率，停用目錄 context 調整。
- **Custom threshold** 使用 `>` 或 `≥` 與一個 token 門檻選取四個絕對替代費率。自訂政策會在門檻兩側取代目錄 context 規則。

在扣除可計費輸入之前，所有提示詞 token（包含快取讀取與寫入）都會計入。輸出不計入門檻。
一旦跨過門檻，替代費率會套用於整個請求（包含輸出），而不只限於超出的 token。
自訂費率屬於標準速度費率：適用的 Fast／Priority 加價會在費率選定後套用一次，並遵循該模型在目錄中
Priority 與長 context 計價之間的關係。只有當目錄將該關係宣告為 `lower-bound`（例如未公布合併費率的 xAI Grok）時，
已確認的 Priority 請求才會將自訂估算顯示為下限。沒有目錄 context 規則的模型會套用一次任何 Priority 倍率。
這些設定控制估算值；不會改變供應商計費。
**Reset to automatic** 會刪除整個覆寫並還原目錄價格與規則。儲存或編輯設定會更新即時估算與歷史總計。

例如，嚴格高於 100,000 提示詞 token 時改用替代費率的 Haiku 5.5 覆寫：

```json
{
  "modelCosts": {
    "claude-haiku-5-5": {
      "input": 0.10,
      "output": 0.50,
      "cacheRead": 0.01,
      "cacheWrite": 0.125,
      "promptLengthPricing": {
        "mode": "custom",
        "thresholdTokens": 100000,
        "comparison": "gt",
        "rates": { "input": 0.50, "output": 2.50, "cacheRead": 0.05, "cacheWrite": 0.625 }
      }
    }
  }
}
```

這是使用者自訂價格的範例，並非官方的 Haiku 價格表。
支援任何正安全整數門檻，包括 `272000`；包含等號的比較請使用 `"gte"`。
四個替代費率皆為必填，並遵循含零在內的基礎費率限制。另一種政策是 `{ "mode": "flat" }`。
省略 `promptLengthPricing` 可連同你的基礎價格保留自動 context 規則；明確的 `{ "mode": "automatic" }` 也可接受且意義相同，
從儀表板或 API 儲存時會將其存為缺席欄位。

舊版 `openai-multi` 模型價格覆寫在啟動時遷移至 `openai` 時會保留有效的提示長度政策，包括以 `openai-multi/<model>` 為鍵的覆寫。

### 重新命名的 API-key 預設

當一個以其他名稱儲存的供應商（例如 `CommandCode`）的 adapter 與固定 API-key 端點，與某個登錄檔預設相符時，它會繼承缺失的 reasoning-effort 中繼資料。你明確設定的 per-model 清單（包括 `[]`）仍具權威性。省略的供應商範圍清單會繼承預設值；明確設定的清單維持不變。這不適用於 OAuth、不相關的端點，或模板化／自訂端點預設。

### Azure 模型驗證輸出預算

部分 Azure Responses 部署會拒絕 Claude Code 極小的模型切換驗證預算。若你的部署回報 `max_output_tokens` 低於其下限，
請在該 Azure 供應商上將 `minMaxOutputTokens` 設定為你端點所需的最小值（例如對回報該最小值的端點設為 `16`）。
這是選擇加入的設定：它會調高該供應商上每一個較小的正整數預算，而不只限於驗證請求。較大的預算會被保留，
其他轉接器在這項變更中不套用此設定。花費准入會在派送前先預留生效的輸出預算，包含每個 Combo 目標的預付傳送。
因此已設定的花費上限可能會拒絕因調高輸出額度而超過該上限的請求。

```json
{
  "providers": {
    "azure": {
      "adapter": "azure-openai",
      "baseUrl": "https://YOUR_RESOURCE.openai.azure.com/openai/v1",
      "apiKey": "${AZURE_OPENAI_API_KEY}",
      "minMaxOutputTokens": 16
    }
  }
}
```

### 原生 Chat 思考重放

這些 Chat 推理清單也適用於原生 `/v1/chat/completions` 的工具呼叫延續。代理會保留提供的 `reasoning_content`，
並使用工具呼叫 ID 從上游 JSON 或 SSE 回應還原被省略的推理。原始推理重放要求每個請求上都帶有穩定的
`thread-id`、`session_id` 或 `session-id` 標頭，以及相同的供應商、端點、模型與憑證。此快取為程序本機且有界；
重啟、過期、驅逐或缺少對話標頭時會改用設定的最小佔位內容。佔位內容無法重建遺失的推理。
為了可靠的恢復對話，用戶端應在其 assistant 歷史中保留上游的 `reasoning_content`。

當 `preserveReasoningContentModels` 未設定時，會跨版本識別 DeepSeek Flash/Pro 模型名稱，
包括 `deepseek-v4.1-flash`、具命名空間 ID 與閘道後綴。明確清單仍具權威性：`preserveReasoningContentModels: []`
會停用自動修復，而 `requiresReasoningPlaceholderModels: []` 會停用佔位內容但仍允許使用快取的原始推理。
其他模型家族需要保留宣告。啟用工具的 DeepSeek 請求也要求較早不含工具呼叫的 assistant 回答上帶有推理。
設定的佔位內容會填補這些省略；無法從工具呼叫快取中恢復那些回合的原始推理。為了完整保真，請保留它們原本提供的推理。

## 遭永久拒絕帳戶的自動暫停

設定、符合條件的拒絕與復原請見[帳戶自動暫停](/zh-tw/reference/configuration/account-auto-pause/)。

對於自訂 Ark Kimi Responses 供應商，請將 `arkKimiResponsesModels` 設為拒絕 encrypted-output includes 與孤兒推理重放的精確上游模型或端點 ID 陣列。預設未設定；請使用上游 ID，而非顯示別名。
