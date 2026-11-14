---
title: 供應商設定
description: 供應商項目、認證、端點、模型目錄、配額、context 上限與供應商專屬選項。
---

供應商告訴 opencodex 模型在哪裡、它使用哪種 wire adapter，以及請求如何被認證。

## Runcrate 免費供應商目錄項目

Runcrate 已列入免費供應商目錄，透過 OpenAI 相容的 `https://api.runcrate.ai/v1` 端點連線，需要 API 金鑰。目錄預載六個有有限免費額度的開放模型，也會探索完整付費目錄。免費額度要求 GitHub 帳號至少建立 30 天，受每個 session 與每週限制，並由 workspace 共用。其他探索到的模型須付費。當免費額度用完或免費容量忙碌時，有餘額的 workspace 會繼續產生付費流量；沒有餘額則停止請求，直到額度或容量恢復。使用前請確認 [Runcrate 免費方案條款](https://www.runcrate.ai/inference/free)。

## DeepSeek: tokens versus image bytes

DeepSeek documents a separate [48 MiB request-body limit](https://api-docs.deepseek.com/guides/files_api/).
A screenshot-heavy session can reach that limit before its token context fills; increasing
`model_auto_compact_token_limit` cannot prevent it.

Uploads are **off by default**. Set `modelCapabilities: { "deepseek-flash": { deepseekImageFiles: true } }`
on your provider if you accept separately persisted images on DeepSeek's servers for one hour.
PATCH `null` on the axis or model entry clears the opt-in.

For opted-in models on first-party Responses URLs, bodies above 40 MiB replace older inline images
with [Files API references](https://api-docs.deepseek.com/guides/files_api/), aiming for 32 MiB.
Image bytes, history and token usage stay unchanged. Files request one-hour expiry; successful
partial uploads remain until expiry even if generation fails. The bounded reference cache is
credential-isolated and lasts at most 50 minutes (less if the provider reports earlier expiry).
A retry can reuse successful uploads; another credential uploads its own copy.

Only `user` and `developer` message images and tool-output images are uploaded; DeepSeek rejects
images in other roles, so those are never persisted.
Foreign gateways and Chat Completions are unchanged. Explicit `detail: low` stays inline because
file references ignore it. Failures stop without discarding images or retrying generation. Repairs
have a 60-second upload deadline, a 128 MiB input cap and at most two simultaneous preparations;
provider pacing/concurrency still applies. Oversized text or unconvertible images still need
compaction; this transport repair does not extend the model's context window.

## Mistral：每個請求的圖片數量

Mistral 限制單一 API 請求可攜帶的圖片數量，且計入重放歷史中每一輪的圖片。其[視覺指南](https://docs.mistral.ai/capabilities/vision/)記載為 8 張，多數 Mistral 視覺模型會以 HTTP 400 拒絕第 9 張。有些模型可接受更多：實測上限為 `deepseek-v4-1-flash-1017` 20 張（超過時回覆不透明的 HTTP 503、代碼 `3800`）、`mistral-large-4` 與其別名 `mistral-large-4-0` 100 張，`zai-glm-5-3-flash` 則到 256 張都沒有被拒絕。若不修剪，含大量螢幕截圖的長工作階段會在每一輪失敗，即使 token 上下文仍有空間。

對第一方 Chat 目的地（`https://api.mistral.ai/v1/chat/completions`），opencodex 只在送出的請求中保留上限內最新的圖片，並把較舊的圖片換成簡短的文字說明；轉譯後的 Responses 輪次與原生 Chat Completions 請求都適用。用戶端歷史與壓縮維持不變；token 用量是 Mistral 針對實際送出（替換之後）的請求所回報的數字。從工具結果提升而來的圖片與其他圖片一樣計算。實測上限以 registry 的 `modelCapabilities` 列提供，所以改名但仍指向 Mistral 目的地的供應商會保留它們；其他模型一律使用 8。要為某個模型宣告自己的上限，請使用 `modelCapabilities: { "mistral-small-2603": { mistralMaxImages: 8 } }`（1 到 1000 的整數）。宣告的優先順序高於 registry 列，對該軸 PATCH `null` 會移除它。修剪不會新增獨立的上傳或持久化；保留在上限內的圖片會隨送出的請求傳給 Mistral，其他目的地不變。

## GPT-6.1 Terra

[GPT-6.1 Terra](https://openai.com/index/introducing-gpt-6-1-terra/) 於 2026 年 10 月 26 日發布，作為 GPT-5.6 Terra 的後繼。`gpt-6.1-terra` 與 `gpt-5.6-terra` 並存可用；預設模型與子代理名冊皆不變。GitHub Copilot 使用 Responses；OpenRouter 列出 `openai/gpt-6.1-terra`，上下文 1,050,000，每 1M token 輸入 $1.00／輸出 $5.00。

原生 Codex：預設上下文 500,000，長上下文上限 872,000，預設 effort 為 `low`，階梯為 `low`、`medium`、`high`、`xhigh`、`max`、`ultra`。原生 `ultra` 在線路上以 `max` 送出。原生資料列只提供 Fast。

[OpenAI API](https://developers.openai.com/api/docs/models/gpt-6.1-terra)：上下文 1,050,000，最大輸出 128,000；文字／圖片輸入與文字輸出；知識截止日 2026-06-01。Effort：`none`、`low`、`medium`（預設）、`high`、`xhigh`、`max`。端點：`v1/responses` 與 `v1/chat/completions`；工具呼叫需要 Responses。

每 1M token：輸入 $1.00、快取輸入 $0.05、快取寫入 $1.25（30 分鐘）、輸出 $5.00。輸入超過 272,000 token 時，整個請求的輸入／快取按 2×、輸出按 1.5× 計價：分別為 $2.00 / $0.10 / $2.50 / $7.50。Fast 模式費用為 2×。

## 自訂供應商的上下文視窗

When a custom provider omits a model's context window, OpenCodex can infer it from the bundled
model metadata. This is off by default: set `inferContextWindow: true` on the provider to turn it
on. Without it, a model with no window uses the enabled Context cap as its window, then the 128k
compatibility fallback. With it, the order is: discovered/configured limits (the smaller wins),
Azure metadata, model-ID metadata, enabled Context cap as the window, then 128k. An enabled
Context cap still limits the result. Built-in providers keep their existing behavior and ignore the flag.

`GET /api/providers` includes `inferContextWindow` only when configured, preserving both `true` and
`false`. To change it, `PATCH /api/providers?name=<provider>` accepts `true`, `false`, or `null` to
clear the setting and restore the default-off behavior; other types return `400`. Omitting it keeps
the current setting. A same-name `POST /api/providers` also keeps an omitted setting, including
`false` and any change committed while the save was validating. A submitted boolean wins, including
`false`, even if the stored value is `true`.

```json
{ "providers": { "my-relay": { "adapter": "anthropic", "baseUrl": "https://relay.example/v1", "inferContextWindow": true } } }
```

Original-vendor API tables take precedence over aggregator tables. Exact IDs are preferred;
case and dot/hyphen variants are accepted only when unambiguous. Unknown IDs, floating `~` aliases
and conflicting matches are not guessed. OpenAI API windows do not describe Codex subscription
limits. An inferred window affects Codex's compaction budget and other connected clients' catalogs,
including Claude long-context selection, but is recorded separately from asserted routing capacity.

A matching model ID does **not** verify your relay's actual capacity. If it serves less than the
vendor window, set `modelContextWindows` or the provider's **Context cap** before using long sessions.
OpenCodex does not enable a cap automatically or probe the model. Successful smaller requests do not
prove the full inferred window works. Existing configured windows remain in control.

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
| `disabledModels?` | `string[]` | — | 對 Codex 目錄與 `/v1/models` 隱藏的模型，但不阻擋直接代理呼叫。路由 id 從清單中移除；裸原生 GPT id 取得 `visibility: "hide"`。 |
| `omitDisabledNativeModels?` | `boolean` | `false` | 預設值為 `false`。在 `config.json` 中設定 `"omitDisabledNativeModels": true` 並執行 `ocx sync`，即可從目錄、快取與 Codex 格式的 HTTP 模型清單中移除已停用的 native 列。移除前經過驗證的繼承範本會另外保留，因此 routed 列的中繼資料不變，直接請求的路由也不變。 |
| `providerContextCaps?` | `Record<string, number>` | `{}` | 各供應商目前生效的上下文上限。一般視窗只能縮小；支援長視窗的原生模型可以擴展到該模型支援的上限。 |
| `providerContextCapValues?` | `Record<string, number>` | `{}` | 各供應商最後選擇的上限，停用後仍保留。僅儲存這些值不會啟用上限。生效中的值優先於儲存的選擇值。 |
| `contextCapValue?` | `number` | `350000` | 首次啟用時使用的預設值。再次啟用時恢復該供應商的選擇值。修改全域值時附帶 `setAll: true` 只會更新已啟用的上限；不帶值的 `setAll: true` 會以目前全域值啟用所有已設定供應商的上限。 |
| `codexAccounts?` | `CodexAccount[]` | `[]` | 由 Codex Auth 管理的 ChatGPT/Codex 池帳號中繼資料。秘密分別存在 `codex-accounts.json`。 |
| `pausedCodexAccountIds?` | `string[]` | `[]` | 被排除於池選擇直到恢復的帳號，包含暫停時的 main `__main__` 帳號。 |
| `codexQuotaAutoRefresh?` | `Record<string, object>` | `{}` | 在 Pool 模式下，每個 Codex 登入帳號可選擇加入的 `fiveHour` 與 `weekly` 視窗自動啟用；Direct 模式不執行此背景工作。在 Providers／Codex Auth 的**進階設定**中，一個控制項可為目前所有 main 與已新增帳號一次啟用或停用這兩個支援的視窗。新帳號不會自動選擇加入。啟用時會略過即時 WHAM 資料中不存在的視窗；停用時也會清除過期的已啟用視窗。介面重用細粒度的 `/api/settings` 寫入、協調部分失敗，並重試原本的開／關意圖，不會取代不相關的設定或已完成的重設標記。API 仍會以 HTTP 409 拒絕啟用一個不可用的視窗。在回報的重設時間點，opencodex 會用該帳號的配額送出一則最小、不儲存的 Codex 訊息，並持久化已啟用的時間戳記。這不適用於 API-key 供應商。 |
| `codexAccountNamespaces?` | `Record<string, string>` | — | 從任意公開模型選擇器到已儲存 Codex 帳號目標的選用映射。啟用帳號限定 picker 列時，每個目標存在的選擇器都會為 Codex picker 新增獨立的 `<selector>/<native-openai-model>` 列；每一列只使用該帳號。只要有任一選擇器生效，picker 中的裸原生列就會被隱藏，但除非明確停用，其 id 仍可路由，並會列在原始的 `/v1/models` 中。 |
| `codexAccountPickerEnabled?` | `boolean` | map 為空時關閉 | 控制合格的 `codexAccountNamespaces` 映射是否產生帳號限定的 Codex picker 列。`true` 允許已映射的列出現。若省略且 map 非空，為向下相容視為啟用；若 map 為空，則視為關閉。`false` 會隱藏產生的列並恢復裸原生 picker 列，但不會刪除映射，也不會停用精確的 `<selector>/<native-openai-model>` 路由。 |
| `activeCodexAccountId?` | `string` | — | 為下一個請求手動選擇的池帳號。選擇清除執行緒親和性；進行中的請求保留擷取的憑證。 |
| `autoSwitchThreshold?` | `number` | `80` | 主動切換的用量閾值。`quota` 可在下一個請求時重新評估未綁定任務。綁定任務預設（`pool.cacheAffinity`）在越過閾值後仍會保留帳號，直到該帳號耗盡或無法繼續服務，並且只改綁到確有額度餘裕且用量嚴格更低的帳號。將 `pool.cacheAffinity` 設為 `false` 才會在此閾值重新評估綁定任務。`fill-first` 僅將其用作未綁定指派的排空點；`round-robin` 僅在新／未綁定工作指派時使用它：只要仍有低於自身有效閾值的合格帳號，就略過達到或超過閾值的帳號，且不會因此移動已綁定任務。分數使用最熱的已知 5h、週或 30d 配額視窗。`0` 僅停用基於用量的主動切換，而非未綁定指派或失敗復原。 |
| `codexAccountAutoSwitchThresholds?` | `Record<string,number>` | — | 各帳號對 `autoSwitchThreshold` 的覆寫：帳號 ID → `0`–`100` 的整數。沒有項目時繼承全域值；`0` 只停用從該帳號發起的使用量主動切換。支援主帳號 `__main__`。可在 Codex Auth 的帳號卡片中管理。 啟用覆寫時，會將目前全域閾值複製為固定的帳號值。覆寫值（包括 `0`）在之後修改全域閾值時仍優先。停用時傳送 `threshold: null`，刪除項目，並恢復繼承目前全域閾值及其未來的變更。 |
| `accountPoolStrategy?` | `"quota" \| "round-robin" \| "fill-first" \| "reset-first"` | `"quota"` | 新／未綁定 Codex 請求的指派策略。當請求沒有即時（父執行緒 id、配額 scope）親和性時即為未綁定；帶有工作階段 ID 的請求（包括一般 Codex CLI 和 App 回合及子代理），或錨定到直接父任務的無工作階段請求，其綁定在關閉時最後一次親和性儲存成功的情況下，代理正常重啟後可保留，閒置時間最長為 24 小時。更深層的無工作階段鏈和 Codex App 主要登入的綁定僅保留在記憶體中，重啟後會重新指派；驅逐、帳號刪除、重新登入、崩潰或親和性重置仍可能使任務未綁定。`quota` 在無現用帳號時選擇最低用量的合格帳號，將合格現用帳號保持在 `autoSwitchThreshold` 以下，且在閾值後可將未綁定請求移至較低用量的合格帳號。綁定任務預設會保留到帳號耗盡（已知用量 100%）或無法繼續服務，改綁時只前往確有額度餘裕且用量嚴格更低的帳號。關閉該設定後，也可在閾值將綁定任務的下一個請求改綁到確有額度餘裕且用量嚴格更低的帳號。`round-robin` 在有效 `autoSwitchThreshold` 以下的合格帳號間均勻分配未綁定請求，若全部達到或超過閾值則在所有合格帳號間分配；`fill-first` 持續將未綁定請求指派到現用帳號直到冷卻、不可用或設定的排空閾值。  `reset-first`: 在低於用量門檻的帳號中，優先選擇下次5小時或週額度重設最早的帳號。已綁定任務遵循設定的親和策略。獨立模型額度按用量排序。 此排序不使用月額度重設時間。 |
| `pool.cacheAffinity?` | `boolean` | `true` | 綁定 Codex 執行緒的 cache-affinity 排序，獨立於 `pool.kernel`。預設開啟；省略該鍵或設為 `true` 即為開啟，格式錯誤視為開啟。即時綁定優先於配額餘裕：`quota` 不會只因用量越過 `autoSwitchThreshold` 就移動執行緒。帳號暫停、無法使用或真正耗盡（已知用量 100%）時仍會離開，且只改綁到確有額度餘裕且用量嚴格更低的帳號。用量未知的帳號不會作為綁定任務的改綁目標。設為 `false` 可恢復依閾值重新綁定。親和性是重排而非釘死。 |
| `accountPoolStickyLimit?` | `number` | `1` | 在前進一個 round-robin 選擇前保留的新／未綁定任務指派；計數器在任務綁定時前進，而非在上游成功後。範圍 1–100。 |
| `upstreamFailoverThreshold?` | `number` | `3` | 未來新 session 容錯移轉前的連續暫時性失敗。設 `0` 停用。對一般 Responses 與原生 compact 傳送而言，已證實的連線建立前 DNS/TCP 可達性失敗會在供應商主機層級被追蹤：它們絕不會影響帳號健康狀態、帳號冷卻、執行緒／session 親和性、現用帳號選擇或池路由，也絕不會計入這個閾值。 |
| `upstreamHostCircuitThreshold?` | `number` | `0` | 針對原生 OpenAI forward Responses 與 compact 傳送上已證實的連線建立前 DNS/TCP 失敗，選用的斷路器閾值。`0` 停用；`1`–`20` 表示在該數量的終端邏輯請求後，開啟 30 秒的供應商來源冷卻。開啟期間，請求會在帳號選擇或上游傳送之前就收到帶 `Retry-After` 的 `503`；冷卻結束後，會放行一個半開請求。逾時與任何 HTTP 回應都不計入，任何 HTTP 回應都會關閉斷路器。只適用於沒有釘選帳號的 Codex Pool 路由；對 `codexAccountMode: "direct"` 與帳號限定選擇器無效。 |
| `maxUpstreamBodyBytes?` | `number` | `0` | 選用的上限（位元組），套用於序列化後的原生 Responses **passthrough** 請求主體。`0` 或省略即停用——不會為任何目的地推斷限制。設定後，超過上限的已建構主體會在傳送前於本機被拒絕：串流回合會收到終端的 `response.failed` / `context_length_exceeded`，讓客戶端改為壓縮而非重送；非串流回合則收到 `413`，其中指出大小、內嵌 `input_image` 項目的數量，以及大約代表多少 MB 的影像資料。此檢查會在每個建構與重建點執行，包括 OAuth 重新整理後的重播與替代帳號重試。轉譯後的 adapter 路徑不在涵蓋範圍內。這裡刻意沒有預設值：唯一有實測上限的是 WebSocket 傳輸，而它對超大回合本來就會退回 HTTP，所以預設值會拒絕目前能成功的請求。當你的閘道有已知的請求大小限制，而你寧可看到可處理的本機錯誤而非不透明的上游失敗時，才設定它。 |
| `maxInboundBodyBytes?` | `number` | `0` | 選用的上限（位元組），套用於解壓縮後的**進站**資料平面請求主體——是上面 `maxUpstreamBodyBytes` 的鏡像。`0` 或省略維持內建的 256 MiB 預設值。當大 context session 已經無法壓縮時，請調高它：Codex 會把整段歷史重播給壓縮模型，因此在 922k token 選擇加入視窗上，壓縮請求本身就是超過上限的那一個，讓 session 卡在唯一能讓它縮小的操作上。範圍限制在 1 MiB–512 MiB。這個上限沒有商量餘地：讀取器會將主體具現化好幾次（線上位元組、解碼後位元組、解碼後字串，以及解析出的物件圖），所以尖峰記憶體是被允許大小的倍數，不設上限就是一個記憶體耗盡的槓桿。適用於 `/v1/responses`、`/v1/responses/compact`、`/v1/chat/completions` 與 `/v1/messages`。監聽器的接受大小在代理繫結時就固定，所以變更要重新啟動才會生效。超過限制的主體會在本機以 HTTP 413 拒絕，並附上 `code: "inbound_body_too_large"`，這與供應商大小拒絕產生的 `context_length_exceeded` 413 刻意不同。 |

| `codexFailureWindow?` | `boolean` | `true` | 60 秒滑動失敗率，與連續計數併用。至少 20 次且失敗率 ≥25% 時帳號降級，只讓新執行緒避開；比率 ≤10% 並持續 30 秒後恢復。`false` 只使用連續計數。 |
| `codexPinnedTransientPolicy?` | `"hold" \| "detour-new-threads"` | `"hold"` | 手動釘選帳號降級時，`hold` 繼續使用並記錄警告；`detour-new-threads` 只把新執行緒放到其他帳號。不會改派進行中的請求。 |
| `codexWsReuseAcrossTurns?` | `boolean` | `false` | 選用：同一帳號與執行緒的 Codex WebSocket 跨回合重用。開啟後忙碌 socket 最多等待 750ms，模型或層級變更時最多保留 2 個 socket。 |
| `maxInboundBodyBytes?` | `number` | `0` | 單一傳入 JSON 請求主體解碼後大小的位元組上限。省略或設為 `0` 會保留 256 MiB 預設值；設定值限制在 1 至 512 MiB。變更後必須重新啟動。超限會回傳本機 HTTP 413，錯誤碼為 `inbound_body_too_large`。生效上限超過 256 MiB 時，也會啟用 `maxConcurrentInboundBodyBytes` 共用閘門；僅提高單次請求上限不會提高共用預算。涵蓋的路徑與詳情請見[傳入主體准入](/zh-tw/reference/inbound-body-admission/)。 |
| `maxConcurrentInboundBodyBytes?` | `number` | `536870912` (512 MiB) | 選用的頂層共用准入預算，單位為位元組，只在生效的 `maxInboundBodyBytes` 超過 256 MiB 時啟用。省略、`0` 或無效值都會使用不變的 512 MiB 預設值。有效的正整數在使用時限制在 512 MiB 至 2 GiB（`536870912` 至 `2147483648`）範圍內。變更後必須重新啟動；同一程序內的所有監聽器共用一個預算。這是准入計量，並非預先配置的記憶體、RSS 上限或依 RAM 自動調整的容量。2 GiB 必須由操作者明確選擇。設定範例、佇列及回應生命週期的取捨，以及預設預算為何在解析前只允許一個完整 512 MiB 上傳，請見[傳入主體准入](/zh-tw/reference/inbound-body-admission/)。 |
| `modelCacheTtlMs?` | `number` | `300000` | Per-供應商 `/models` 快取的新鮮度視窗。 |
| `cacheRetention?` | `"none" \| "short" \| "long"` | Anthropic 官方端點：`"long"`；其他 Anthropic 相容端點：`"short"` | Anthropic prompt-cache 政策：停用、5 分鐘臨時或 1 小時延長。未設定時，送往 `api.anthropic.com`（API 金鑰或 OAuth 帳號池）的請求使用 1 小時 TTL，相容閘道與廠商端點維持 5 分鐘 TTL。明確設定的值一律優先。 |
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

| Field | Type | Meaning |
| --- | --- | --- |
| `adapter` | `string` | One of `openai-chat`, `openai-responses`, `anthropic`, `claude-cli`, `google`, `kiro`, `cursor`, `ollama-native`, `azure-openai` (or alias `azure`), `codebuddy`, `qoder`. |
| `baseUrl` | `string` | Upstream API base URL. Most built-in fixed endpoints ignore a mismatch; collision-safe key presets preserve an older same-named custom destination. |
| `proxy?` | `string \| null` | Per-provider egress route. Omit it to inherit the global proxy decision; use `"direct"` or `null` to force direct egress; or provide an absolute `http://`, `https://`, `socks5://`, or `socks5h://` proxy URL. An empty string is rejected. |
| `noProxy?` | `string \| string[]` | Destinations this provider reaches directly, using `NO_PROXY` host-pattern syntax. A match bypasses both this provider's own proxy and an inherited global proxy. |
| `requestPacing?` | `{ enabled, requestsPerMinute?, minIntervalMs?, maxConcurrentRequests?, models?, keySelection?, keys? }` | Optional client-side outbound request-start pacing, separate from upstream usage, billing, and rate-limit indicators. RPM is converted to an even interval; `minIntervalMs` may impose a longer interval. `maxConcurrentRequests` is a positive integer cap on in-flight requests. A provider or model rule may use the concurrency cap alone; provider limits apply across all models, while `models` entries use exact upstream model IDs (for example `nvidia/llama-3.1-nemotron-ultra-253b-v1`) and can only add delay or narrow concurrency. Queue waits do not consume the upstream response-header timeout. HTTP and explicit adapter `fetchResponse`/`runTurn` dispatches are covered. A concurrency-capped canonical Responses WebSocket turn uses HTTP/SSE so its lease can be released when the response body completes, errors, or is cancelled. For `runTurn` adapters, including Cursor, the cap counts active turns rather than physical sends: RunSSE and BidiAppend may overlap within one turn, while another turn waits. Follow-up sends still obey start intervals. |
| `requestPacing.keySelection?` | `"active"`, `"round-robin"` | Normal-request key selection. Default `active` preserves the saved key and existing failure rotation; `round-robin` distributes request-local selections across eligible API-key pool references without changing the saved active key. It balances allocations, not tokens or cost. |
| `requestPacing.keys?` | `{ requestsPerMinute?, minIntervalMs?, maxConcurrentRequests? }` | Uniform per-key-reference RPM, minimum start interval and concurrency limits, shared across models. These compose with provider and exact-model upper bounds. Duplicate references share a bucket; separate references in one upstream project do not imply independent quota. TPM and daily quotas are not enforced. |
| `upstreamHttpVersion?` | `"auto" \| "http1.1" \| "h1" \| "http2" \| "h2"` | Pin the HTTP version used for upstream requests to this provider. Defaults to `auto`, which lets Bun negotiate. An explicit pin requires an HTTPS target and fails locally when it cannot be honored. Set `http1.1` when a provider's HTTP/2 SSE stream stalls instead of delivering events — the symptom is a long-running streaming request that produces nothing and eventually times out. For Cursor, `http1.1`/`h1` selects its `RunSSE` + `BidiAppend` compatibility transport for inference and also pins live model discovery. Management `POST`/`PATCH` accept `null` to clear it back to `auto`. |
| `tlsProfile?` | `"antigravity-browser"` | **Use at your own risk.** Opt-in browser-like TLS handshake (through the optional `wreq-js` dependency) for the canonical `google-antigravity` OAuth provider. It changes only how the connection looks on the wire; it is not an official Google client, and it does not change what Google's terms allow. Google can still detect, rate-limit, suspend, or ban the account you signed in with, and you alone carry that risk. It is off by default and accepted only with the Google adapter, Cloud Code Assist mode, and Google's canonical HTTPS Antigravity hosts. Redirects stay manual. The provider's own `proxy`/`noProxy` route is carried by the TLS transport; a route it cannot keep fails the request instead of leaving by another path, which includes any direct route while `HTTP_PROXY`, `HTTPS_PROXY`, or `ALL_PROXY` is set. `GET /api/providers` reports the profile state as `pending`, `active`, or `failed`. Omitting the field keeps the normal Bun transport and never loads the dependency. |
| `responsesPath?` | `string` | Relative resource path for key-auth `openai-responses` requests. It must start with `/` and contain no scheme, query, or fragment. |
| `chatCompletionsPath?` | `string` | Relative resource path for `openai-chat` requests, the mirror of `responsesPath` and subject to the same shape rules. Needed when one upstream serves Chat Completions and Responses under different prefixes: a per-model wire override changes the adapter and leaves `baseUrl` alone, so without this an opted-in Chat request would be sent to the Responses base. Z.AI is the shipped example. |
| `allowEncryptedV2AgentTasks?` | `boolean` | Disabled by default. Trust a direct key-auth `openai-responses` provider to consume or relay opaque encrypted V2 sub-agent tasks unchanged. Eligible routes skip `agentTaskRecovery`; all other routes keep the existing recovery or fail-closed behavior. OpenCodex does not decrypt, translate, or recover tasks sent through this opt-in. |
| `projectResponsesLiteHostedSearchHistory?` | `boolean` | 預設關閉。僅實際布林值 `true` 可為此供應商明確啟用有損 hosted-search 歷史投影，且只作用於最終目的地精確為標準 ChatGPT Codex `/responses`、明確選擇 Responses Lite 的一般請求及原生 v2 `compaction_trigger` 壓縮請求。省略或設為 `false` 時保留結構化歷史；字串和數字無效。不會啟用 Lite、變更傳輸，也不影響原生 v1 `/responses/compact`、公開 OpenAI API／其他目的地或既有 portable/routed compaction 投影。詳見[Lite 搜尋歷史](/zh-tw/reference/proxy-formats/#codex-native-ordinary-lite-hosted-search-history)。 |
| `upstreamWebsocket?` | `boolean` | Opt-in upstream Responses WebSocket transport for `openai-responses` requests (default false). Honored only for the first-party `https://api.openai.com/v1` upstream; custom-provider endpoints always use bounded HTTP/SSE because Bun cannot enforce an inbound WebSocket message limit before allocating the complete message. For the canonical ChatGPT `openai` provider, omitting it keeps the upstream WebSocket on eligible turns, an explicit `false` sends streaming turns over HTTP/SSE, and provider management rejects `true`; with `false`, native mid-turn steering and injection are unavailable. The field is independent of the client-facing `websockets` setting and changes neither the endpoint nor the credential. Plain HTTP remains on SSE; non-Responses paths and `openai-chat` requests stay on HTTP. |
| `supportsServiceTier?` | `boolean` | Tri-state canonical Fast capability fallback. `true` publishes Fast in the catalog, satisfies service-tier routing requirements, contributes a supported fingerprint, and lets fast mode inject the provider's canonical wire value on a compatible final adapter. `false` strips the field and never injects, and exact model declarations cannot reopen it. Absent leaves the provider unclassified: fast mode does not inject or normalize a canonical caller value, and caller values obey the final wire's forwarding permission (`chatServiceTier` on Chat; passthrough on Responses). The registry classifies canonical OpenAI (`true`), DeepSeek, and Volcengine Ark (`false`); set it explicitly only for custom gateways that genuinely support tiers. |
| `responseTierAuthoritative?` | `boolean` | Whether the response tier can confirm or deny Fast. Set `false` explicitly for routes with non-authoritative response metadata; omission preserves existing behavior. This does not enable Fast or change outbound parameters. See [Response service-tier authority](#codex-帳號池). |
| `fastEnabled?` | `boolean` | Operator switch for the provider's Fast lane. `false` turns Fast off (no Fast toggle, no `--fast` row, no fast wire field) and overrides `supportsServiceTier`. `true` enables a lane the registry marks opt-in. Absent keeps the registry default: off for `anthropic` and `anthropic-apikey`, whose fast mode spends usage credits at 2x price, and unchanged for every other provider. The dashboard Models page shows an Off/On row for opt-in providers. |
| `modelSupportsServiceTier?` | `Record<string, boolean>` | Exact upstream model capability overrides. Exact `true` enables canonical Fast for that model; exact `false` narrows provider defaults. An explicit provider-level `supportsServiceTier: false` remains fail-closed and cannot be reopened. Exact `true` does not authorize foreign caller-tier forwarding on Chat. Undeclared models fall back to provider-wide behavior. Management `PATCH /api/providers` merges entries and accepts `null` to clear one. |
| `chatServiceTier?` | `boolean` | Provider-wide Chat-wire opt-in for forwarding caller `service_tier` values. On a classified route it governs foreign values such as `flex`, not proxy-owned canonical Fast after capability validation; on an unclassified route it governs every caller value because no Fast capability has been validated. Exact model capability does not authorize foreign forwarding. Responses routes retain their capability-based caller forwarding behavior. |
| `promptCacheKey?` | `boolean` | Provider-wide `openai-chat` opt-in for forwarding a `prompt_cache_key`. The adapter forwards the key it is given and never invents one, but the key is not always the caller's: Claude Messages translation derives one from `metadata.user_id`, or from a model/system/tools cohort when no metadata is sent. Default off. Enable only when the upstream documents support, because strict gateways may reject the unknown field with HTTP 400. |
| `preserveResponsesReasoningContent?` | `boolean` | Default off for custom providers. In **Providers → Settings**, enable **Replay plaintext reasoning** for a custom Responses endpoint only if it accepts this history. This sends prior plaintext reasoning to that endpoint and may increase token use. Keep plaintext reasoning content on replayed Responses reasoning items instead of blanking it, including custom native v1 compact input (blanking is the ChatGPT backend's rule). Enable for upstreams whose contract accepts reasoning replay, such as DeepSeek or a self-hosted Kimi on vLLM. Proxy-minted `ocxr1` envelopes are always stripped. A hand-configured `openai-responses` provider without it logs one warning per host the first time plaintext reasoning is dropped. `preserveReasoningContentModels` does not affect this wire. |
| `preserveResponsesInputItemIds?` | `boolean` | Default off. Preserve valid `input[].id` when `store: false` for explicitly trusted launcher relays that require turn identity. Ordinary Responses providers keep stripping IDs; xAI custom-call ID repair remains active. |
| `preserveResponsesMessageMetadata?` | `boolean` | Default off. Preserve private `internal_chat_message_metadata_passthrough` on input items for explicitly trusted launcher relays, including custom native v1 compact requests. This forwards private turn/session metadata to that destination; do not enable for ordinary gateways. |
| `dropResponsesReasoningItems?` | `boolean` | Remove replayed Responses `reasoning` items from continuation input entirely, including custom native v1 compact requests, instead of forwarding them with blanked content. This is lossy: summaries, item ids, and `encrypted_content` go with them, so no reasoning item from the previous turn remains in the forwarded input. It does not remove `previous_response_id`, so an upstream holding its own turn state may still reach it. Enable only for an upstream that rejects reasoning replay outright — the built-in Volcengine Ark Coding Plan preset sets it because validated tool continuations answered `400 InvalidParameter` otherwise. Set it to `false` on that provider to forward reasoning items again. |
| `disabled?` | `boolean` | Keep the provider on disk but exclude it from routing and model/catalog listings. |
| `apiKey?` | `string` | API key, an `${ENV_VAR}` / `$ENV_VAR` reference, or a `keychain:<provider>` reference written by `ocx provider keychain <name> store`. References resolve at request time. See [Storing keys in the OS keychain](#在-os-金鑰圈中儲存金鑰). |
| `apiKeyTransport?` | `"x-api-key" \| "bearer"` | Anthropic key header style. Defaults to native `x-api-key`; valid only for key-auth `anthropic` providers. |
| `apiKeyPool?` | `ApiKeyPoolEntry[]` | Multi-key pool. `apiKey` mirrors the active entry; each item has `id`, `key`, optional `label`, and optional numeric `addedAt`. |
| `apiKeyPoolStrategy?` | `"round-robin" \| "fill-first" \| "quota"` | How a warm key is chosen **before** the first attempt when the committed key is already cooling. Omitted keeps rotation reactive-only: the pool moves after a 429 or 401 and not before. `round-robin` takes the next key in the pool, `fill-first` keeps the first eligible one, and `quota` prefers the key with the most remaining headroom, falling back to `fill-first` order for a provider whose per-key quota is unknown. A healthy committed key is never overridden, so a manual key selection stands. |
| `defaultModel?` | `string` | Model used when this provider is selected without an explicit model. |
| `models?` | `string[]` | Seed/fallback model list. With `liveModels: false`, a nonempty `models` list is followed by `retainModels`; an empty or omitted `models` list instead seeds `defaultModel` (if configured), then `retainModels`, removing duplicate ids in first-seen order. |
| `liveModels?` | `boolean` | Fetch the live catalog on start/sync (default `true`). Custom providers use `${baseUrl}/models`; built-ins may use a registry URL and filter. |
| `selectedModels?` | `string[]` | Catalog allowlist after discovery. Non-empty exposes only those ids; empty or omitted exposes all discovered models. |
| `retainModels?` | `string[]` | Ids kept in the catalog even when live discovery omits them. They need not be repeated in `models`. Empty or omitted keeps today's behavior. |
| `modelDisplayNames?` | `Record<string, string>` | Durable labels used only for display, keyed by this provider's exact upstream model id. Labels win over provider catalog metadata, survive discovery refreshes and provider edits, and never change authentication, adapter behavior, routing, billing, upstream request construction, the routed `provider/model` selector, or the upstream wire model. Keys are exact and case sensitive. Unknown model ids are kept so a temporarily missing model receives its label when it returns. The map accepts at most 2,000 entries, matching the discovery limit. |
| `contextWindow?` | `number` | Provider-wide context fallback when upstream metadata is absent; otherwise a cap that retains smaller live metadata. The Models dashboard exposes this separately from `providerContextCaps`. |
| `modelContextWindows?` | `Record<string, number>` | Per-model context fallbacks/caps. These override `contextWindow`: an unknown window uses the configured value, while smaller live metadata remains authoritative. |
| `inferContextWindow?` | `boolean` | Custom providers only, default off. `true` fills a missing window from bundled model-ID metadata ([details](#自訂供應商的上下文視窗)); the value is an estimate, not verified relay capacity. |
| `modelContextTiers?` | `Record<string, "default" \| "long_context">` | Per-model upstream tier for `github-copilot`. `long_context` sends `contextTier: "long_context"`. Catalog metadata grows only with an exact per-model `modelContextWindows` value that documents the supported window; that value wins before the provider cap. An unknown model keeps its observed window. Unconfigured passthrough requests retain a caller-supplied `contextTier` field on any provider. |
| `modelInputModalities?` | `Record<string, string[]>` | Per-model input hints such as `["text"]` or `["text", "image"]`. |
| `modelMaxInputTokens?` | `Record<string, number>` | Positive per-model max input limits used for catalog auto-compaction hints. |
| `modelAutoCompactTokenLimits?` | `Record<string, number>` | Positive safe-integer per-model soft auto-compaction budgets. Values can only lower the effective 90%-of-context/max-input envelope and are omitted when no context window is resolved. For canonical `openai`, keys must be exact supported native model IDs without provider or account-selector prefixes. Provider PATCH merges entries; set a key to `null` to delete it or the whole field to `null` to clear the map. These `null` tombstones are PATCH-only. |
| `minMaxOutputTokens?` | `number` | Optional positive integer floor for explicit positive `max_output_tokens` budgets on `azure-openai`/`azure` Responses routes. Unset preserves the caller's cap. Setting it authorizes raising a smaller cap, which can increase output usage. Omitted or invalid request budgets are unchanged. |
| `defaultMaxOutputTokens?` | `number` | Provider-wide `openai-chat` fallback when the client omits `max_output_tokens`. |
| `modelMaxOutputTokens?` | `Record<string, number>` | Positive per-model `openai-chat` fallback budgets; exact/pattern matches beat the provider default. |
| `modelCosts?` | `Record<string, ProviderCostOverlay>` | Per-model display prices (USD per 1M tokens), keyed by that provider's exact upstream model id — not a provider identifier or a routed `provider/model` label, e.g. `{ "deepseek-v4-flash": { "input": 0.14, "output": 0.28, "cacheRead": 0.0028, "cacheWrite": 0 } }`. Any model id is a valid key — custom providers may target any OpenAI-compatible endpoint through the `openai-chat` adapter, and local or internal provider ids work even when they are absent from the built-in catalogs. User-configured prices win over the built-in catalogs in the Logs `~$` and Usage estimates; historical entries are repriced from the current overlay, so editing a price can move past totals. The fallback order is user `modelCosts` → exact official correction → jawcode catalog → expected-price overlay → model-level vendor fallback, and an explicit all-zero user entry means a known-zero estimate; delete that model entry to restore automatic pricing. All-zero catalog metadata still falls through. Each rate must be a non-negative finite number at most 1,000,000 (USD per 1M tokens); out-of-range rows are rejected by the management boundary and dropped on load. Display-time estimation only: overlays never affect routing, account selection, quotas, or billing. |
| `headers?` | `Record<string, string>` | Extra upstream headers. Authorization, cookies, API-key headers, embedded newlines, and invalid names are rejected. Requests that ride the provider outbound wrapper — model discovery, connection tests, and other proxy-originated diagnostics such as the Ollama show probe — send `User-Agent: opencodex` unless a User-Agent is set here or by the provider preset. An experimental relay may negotiate earlier completed-tool delivery with `x-opencodex-tool-completion: block-stop-v1`; the embedding shell must supply authenticated durable turn membership, and the relay must acknowledge the same response header and implement exact call-bound completion markers. Leave it unset for other providers. Early delivery applies only to eligible structured calls; later errors or cancellation cannot retract a call already delivered. |
| `forwardClientHeaders?` | `string[]` | `openai-responses` only: opt in to copying named inbound client metadata headers onto inference requests when the provider has not already set that header. Credential and transport-owned names such as `Authorization`, cookies, API-key headers, `Content-Type`, `Content-Length`, `Host`, and `x-oai-attestation` are rejected and also filtered at runtime. Header names are case-insensitive and may not repeat. `headers` remains authoritative; the existing caller `User-Agent` fallback still applies when neither surface sets one.  Supported names: `originator`, `x-client-request-id`, `x-codex-app-version`, `user-agent`; all other names are refused. |
| `supportsNativeCompactionTrigger?` | `boolean` | `openai-responses` only: declare support for native v2 `compaction_trigger` input items. Defaults off for noncanonical gateways; preserves native compaction rather than requesting a portable text summary. Independent of the v1 endpoint and blob replay capabilities. |
| `supportsNativeCompactEndpoint?` | `boolean` | `openai-responses` only: declare support for native v1 `POST /responses/compact`. Defaults off for custom gateways. Key/local/forward routes use the provider's Responses URL plus `/compact` and its normal transport authentication; OAuth keeps routed compaction and its existing credential lifecycle. Does not enable v2 triggers or grant official OpenAI identity. |
| `decodesNativeCompactionBlobs?` | `boolean` | Declare that this destination can replay native, non-`ocx1:` compaction blobs. Independent of either generation capability; a known serving-provider mismatch still degrades foreign ciphertext. Enable only after testing compact and a subsequent turn on the same backend. |
| `openRouterRouting?` | `OpenRouterProviderRouting` | Default OpenRouter `order`, `only`, and `allowFallbacks` preferences; valid only for canonical OpenRouter with `openai-chat`. |
| `modelOpenRouterRouting?` | `Record<string, OpenRouterProviderRouting>` | Exact model-id overrides that replace the provider-wide OpenRouter preference. |
| `vercelGatewayRouting?` | `VercelGatewayRouting` | Default Vercel AI Gateway `order`, `only`, and `sort` (`"cost"` \| `"ttft"` \| `"tps"`) preferences; valid only for canonical Vercel AI Gateway with `openai-chat`. |
| `modelVercelGatewayRouting?` | `Record<string, VercelGatewayRouting>` | Exact model-id overrides that replace the provider-wide Vercel AI Gateway preference. |
| `authMode?` | `"key" \| "forward" \| "oauth" \| "local"` | Authentication mode (default `key`). OAuth/subscription credentials are stored outside `config.json`; `local` is limited to providers whose registry entry permits it. |
| `codexAccountMode?` | `"pool" \| "direct"` | Canonical `openai` only; defaults to Pool. Direct bypasses pool state. |
| `refreshPolicy?` | `"proactive" \| "lazy-only" \| "disabled"` | Override this OAuth provider's Token Guardian policy. |
| `reasoningEfforts?` | `string[]` | Provider-wide Codex reasoning labels to advertise and send. For `google`-adapter providers, a configured ladder also asserts `thinkingLevel` capability: direct and Vertex non-image requests send the selected effort as `generationConfig.thinkingConfig.thinkingLevel`, while Cloud Code Assist uses its envelope-specific path. |
| `modelReasoningEfforts?` | `Record<string, string[]>` | Per-model labels. An empty list hides effort control. As with `reasoningEfforts`, each configured `google`-adapter ladder asserts `thinkingLevel` capability; direct and Vertex non-image requests use the flat Gemini path, while Cloud Code Assist sends it under its request envelope. An adapter that ships its own per-model table (currently `command-code`) lets that table win at the wire for models it knows, so set `modelReasoningEffortsAuthoritative` as well to widen such a row. |
| `modelReasoningEffortsAuthoritative?` | `boolean` | Treat this provider's `modelReasoningEfforts` as authoritative at the wire, not only in the catalog. Without it, an adapter that ships its own per-model effort table (currently `command-code`) advertises your widened ladder in the picker and then strips the extra rung on the way out. It is opt-in because presets are seeded with the shipped table, so a stored row alone cannot prove you wrote it rather than an older release. With it set, a rung the upstream refuses is returned as that error instead of being silently retried without the effort — you asked for it, so you see the answer. |
| `modelSuppressSyntheticMax?` | `Record<string, boolean>` | Catalog-only per-model switch. `true` prevents OpenCodex from adding a missing synthetic `max` rung while retaining a provider-declared `max` and continuing to add `ultra` to reasoning-capable ladders. A preserved row that already contains `max` keeps it until healthy discovery rebuilds that row, because the catalog does not persist whether an older `max` was synthetic. If a configured default names a suppressed missing `max`, the catalog falls back to the highest real rung below it. Codex uses the same ladder membership for the picker and explicit `spawn_agent` effort validation, so an explicit `max` spawn can fail client-side before proxy clamping; `ultra` remains the supported harness path. |
| `modelSupportsReasoningSummaries?` | `Record<string, boolean>` | Set a model to `false` to stop advertising summaries and strip summary-delivery fields. |
| `modelReasoningSummaryDelivery?` | `Record<string, "sequential" \| "sequential_cutoff" \| "concurrent" \| "concurrent_cutoff">` | Per-model Responses delivery enum; rewrites an existing delivery field. |
| `modelAdapters?` | `Record<string, string>` | Per-model `openai-chat` or `openai-responses` wire override for mixed-wire gateways. Explicit entries beat registry defaults. The OpenCode Go preset selects Responses for `gpt-5.6-luna` while leaving sibling models on their documented wires; DeepSeek can select native Responses for `deepseek-v4-flash`; Alibaba Token Plan (Beijing) pins `qwen3.8-flash`, `qwen3.7-plus`, and `glm-5.3` to its native Responses API for Responses inbound only (live-verified on that gateway, including plaintext reasoning replay; Chat and Anthropic inbound stay on Chat, and the rest of the family can be opted in here); and GitHub Copilot declares Responses-only defaults for the following models (`gpt-5.3-codex`, `gpt-5.4`, `gpt-5.4-mini`, `gpt-5.5`, `gpt-5.6-luna`, `gpt-5.6-sol`, `gpt-5.6-terra`, `gpt-6-astra`, `grok-4.5`, `grok-4.6`, `mai-code-1.1-flash`, `mai-code-1-flash-picker`) because those models reject `/chat/completions` for agent traffic. Models without a built-in default (for example `gpt-5.4-nano`) can be opted in here. Single-wire upstream pins and canonical ChatGPT forward reject overrides. GitHub Copilot 為 `gpt-6.1-sol` 與 `gpt-6.1-terra` 使用 Responses。 |
| xAI Chat Completions (dashboard / CLI) | switch | Grok 4.5/4.6 OAuth Responses requests default to Responses. Existing Chat overrides are migrated once on upgrade; later Chat choices are preserved. Turn on to select Chat for both models, off to select Responses. CLI: `ocx provider edit xai --xai-chat on` or `--xai-chat off` (running proxy required). Mixed means only one model currently uses Chat. Other overrides and tier policy stay unchanged. API-key and translated Chat/Anthropic defaults are unchanged. Grok 4.7 defaults to Responses on OAuth through its registry wire default and can use Chat through an explicit `modelAdapters["grok-4.7"] = "openai-chat"` override. |
| `xaiResponsesXSearch?` | `boolean` | Disabled by default. On an xAI Responses destination, append the provider-hosted `x_search` declaration only when a live `web_search` tool survives final request normalization. Existing declarations are not duplicated, caller `tool_choice`/`allowed_tools` selectors are never widened, and this is separate from the web-search sidecar's `search.xSearch` options. |
| `modelPreferHostedTools?` | `Record<string,string[]>` | Exact-model opt-in for non-forward Responses gateways that reserve a hosted-tool namespace. Currently accepts only `["image_generation"]`; a matching model must use the `openai-responses` wire and support that hosted tool. It removes colliding client `image_gen` declarations and rewrites their selectors to preserve caller tool choice. For OpenAI API virtual `-pro` models, the selected public ID is matched first and the resolved base wire-model ID is a fallback. `modelAdapters` resolves the public ID first, then the base ID; the second resolution determines the final wire. Other models retain normal alias behavior. |
| `annotateEmptyToolOutputs?` | `boolean` | Replace a present-but-empty tool result with a short marker before it reaches the model, so a blank result is not read as a missing one. Applies to blank strings and text-only part arrays; image, file, and encrypted parts are never touched. Defaults to `true` for DeepSeek from the built-in registry and is otherwise unset. Set `false` to opt a provider out — an explicit `false` is preserved across later edits that omit the field. `PATCH /api/providers?name=<provider>` accepts `true`, `false`, or `null` to clear the override and return to registry-default behavior. |
| `promoteAdditionalTools?` | `boolean` | 將 Codex Desktop 的 `additional_tools` 輸入項目提升至頂層 `tools`，並從 `input` 移除包裝。OpenCode Go 與 xAI（`api.x.ai`、`cli-chat-proxy.grok.com`）在非 forward 模式自動啟用（設為 `false` 也不會關閉這個自動提升）；`authMode: "forward"` 必須明確設為 `true`，其他拒絕私有輸入項目的嚴格閘道也可選用。歷史目錄只供回放，不授予當前工具權限。`PATCH /api/providers?name=<provider>` 接受布林值或 `null`（清除覆寫）。 |
| `unsupportedHostedTools?` | `string[]` | Hosted tool declarations this Responses destination rejects, so they are stripped from `tools`, from client-loaded `additional_tools`, and from `tool_choice` instead of being forwarded and rejected upstream. Use it for an OpenAI-compatible gateway with a narrower capability set — one that accepts plain Responses requests and `function` tools but returns HTTP 400 for hosted `web_search` — so a text-only prompt is not failed by a capability it never needed. Accepts only hosted tool type names (`web_search`, `web_search_preview`, `file_search`, `computer_use_preview`, `computer_use`, `code_interpreter`, `image_generation`, `image_gen`, `mcp`, `tool_search`, `local_shell`, `x_search`); an unrecognized name is rejected rather than silently ignored. Spelling variants of one capability are aliased, so `["web_search"]` also denies `web_search_preview`. A provider cannot both deny a hosted tool here and prefer it in `modelPreferHostedTools`. Xiaomi MiMo Responses destinations (`xiaomimimo.com` and its subdomains, including `api.xiaomimimo.com` and `token-plan-cn.xiaomimimo.com`) automatically strip `web_search` and `web_search_preview` while preserving function tools; no declaration is needed for these hosts. This is independent of `supportsResponsesCustomTools`; set both for a gateway that also rejects native custom tools. `PATCH /api/providers?name=<provider>` accepts an array or `null` to clear it. |
| `reasoningEffortMap?` | `Record<string, string>` | Provider-wide wire aliases for reasoning labels. Map a label to `"__omit__"` to drop the reasoning field from the upstream request entirely: `reasoning_effort` on an OpenAI-compatible wire, and Ollama's native `think` field on the Ollama native adapter (#2356). |
| `modelReasoningEffortMap?` | `Record<string, Record<string, string>>` | Per-model wire aliases for reasoning labels. Map a label to `"__omit__"` to drop the reasoning field from the upstream request entirely. |
| `reasoningWireFormat?` | `"gateway-object"` | For OpenAI-compatible gateways that accept `reasoning: { enabled, effort }` instead of `reasoning_effort`. The ClinePass preset sets this automatically. A provider save that keeps the destination keeps it; see [What a provider save keeps](#儲存供應商時會保留什麼). `PATCH` accepts `"gateway-object"` or `null` to clear it. |
| `noReasoningModels?` | `string[]` | Models that reject reasoning/thinking parameters. |
| `noTemperatureModels?` | `string[]` | Models that reject caller-specified `temperature`. |
| `noTopPModels?` | `string[]` | Models that reject caller-specified `top_p`. |
| `noStopModels?` | `string[]` | Models that reject caller-specified `stop`. The `openai-chat` adapter, the Chat passthrough and the Responses passthrough omit the field for those ids. The built-in `xai` preset lists its reasoning models (`grok-4.7`, `grok-4.6`, `grok-4.5`, `grok-4.3`, `grok-4.20-multi-agent-0309`, `grok-4.20-0309-reasoning`, `grok-build-0.1`), which xAI documents as rejecting it; `grok-4.20-0309-non-reasoning`, `grok-composer-2.5-fast` keep caller `stop`. |
| `noPenaltyModels?` | `string[]` | Models that reject presence/frequency penalties. The built-in `xai` preset lists its reasoning models (`grok-4.7`, `grok-4.6`, `grok-4.5`, `grok-4.3`, `grok-4.20-multi-agent-0309`, `grok-4.20-0309-reasoning`, `grok-build-0.1`), which xAI documents as rejecting them; non-reasoning ids keep caller penalties. |
| `noStructuredOutputModels?` | `string[]` | Exact model IDs whose `openai-chat` endpoint rejects `response_format`. Only an exact requested-model match omits the field; structured-output translation stays enabled for every other `openai-chat` model. |
| `noJsonSchemaModels?` | `string[]` | 其 `openai-chat` 端點拒絕 `json_schema` 形式但仍接受 `json_object` 的精確模型 ID。這類請求會降級為 `json_object` 而非被丟棄，因此要求 JSON 的呼叫端仍會拿到 JSON。同一模型同時列在兩份清單時，以 `noStructuredOutputModels` 為準。`opencode go`、`opencode zen` 預設已為其 DeepSeek 路由內建。 |
| `foldDeveloperRoleToSystem?` | `boolean` | 記錄某個 `openai-chat` 目的地是否接受 `developer` 角色。`foldDeveloperRoleToSystem` 未設定時以 `system` 傳送，`true` 時以 `system` 傳送，`false` 時以 `developer` 傳送。未設定表示尚未記錄該目的地的情況；`true` 記錄上游拒絕該角色；`false` 記錄其接受該角色。未啟用 `singleLeadingSystemMessage` 時，訊息保留在對話中的原有位置，只有角色改變。拒絕該角色的目的地會回應 `400 role 'developer' is not allowed`，該回合根本無法開始，這就是未記錄狀態預設摺疊的原因。 |
| `parallelToolCalls?` | `boolean` | 切換平行工具呼叫。OpenAI Chat 預設開啟；非 chat adapter 僅在明確 `true` 時廣告。 |
| `responsesItemIdRepair?` | `{ message?: string[]; reasoning?: string[]; repairMissingTerminalIds?: boolean }` | 預設停用的下游 SSE 修復，用於精確佔位 id 與缺失的終端 id。Function-call id 永不被重寫。 |
| `promptCacheKey?` | `boolean` | 為整個 `openai-chat` provider 啟用 `prompt_cache_key` 轉送。adapter 只轉送收到的 key，不自行產生，但 Claude Messages 轉換會從 `metadata.user_id`，或在沒有 metadata 時從模型/系統/工具組合衍生 key。除非 preset 宣告，否則預設關閉；Mistral 依其[提示快取契約](https://docs.mistral.ai/studio/conversations/advanced/prompt-caching)啟用，明確的 `false` 可停用。僅在上游明確支援時啟用，嚴格閘道可能以 HTTP 400 拒絕未知欄位。 |
| `retryOn429?` | `{ enabled?: boolean; attempts?: number; intervalMs?: number; maxIntervalMs?: number; respectRetryAfter?: boolean }` | 僅限 API-key provider（`authMode: "key"`）。未設定時關閉，但標準端點的 OpenCode Go 與 Command Code，以及標準 Mistral 的 `openai-chat` 例外：預設 replay 6 次、間隔 10 秒、上限 60 秒。設定物件即啟用；`enabled: false` 也會停用該預設策略。串流開始前的 HTTP 429 會依 `Retry-After` 或固定間隔等待，然後在 key 容錯移轉前以同一 key 重播相同請求。涵蓋文字回合復原、Responses passthrough、圖片/影片橋接、web-search 輔助服務及終端續接；自訂 `runTurn` 不在範圍內。`attempts` 計算第一個 429 後的同 key replay 次數（總傳送次數 = `attempts` + 1），預算由整個請求共用。耗盡時僅停止同 key replay，接著依可用目的地執行一般 key 容錯移轉或最終錯誤處理；金鑰認證 passthrough 沒有容錯移轉，會原樣回傳 429。標準 Mistral Chat 的明確上游延遲超過允許等待時間時，停止同 key replay 並保留原始 `Retry-After`；pool 中另一個 key 仍可能處理請求。其他 provider 仍將等待截斷至上限。Mistral 依 credential/模型共用重試期限；`requestPacing.enabled: false` 或 `retryOn429.respectRetryAfter: false` 可停用。沒有重試時間的 429 在確認每分鐘預算不足時觸發保守的 60 秒復原等待，隨後只探測一次，成功即恢復一般流量。正常流量不預測下一次 token 成本。策略使用公告額度，排除已知耗盡的月額度，不承諾精確重設時間，也不觸發歷史壓縮。Codex 本身不重試 429。物件預設值：`enabled: true`、`attempts: 3`、`intervalMs: 5000`、`maxIntervalMs: 60000`（單次等待上限，設定最大 600000）、`respectRetryAfter: true`。 |
| `transientRetryOn5xx?` | `{ enabled?: boolean; attempts?: number }` | 僅限使用金鑰認證的 `openai-chat` 與 `openai-responses` 供應商。`authMode: "forward"` 的供應商（ChatGPT 帳號池）從不讀取此選項，維持預設重試次數。選擇性重試串流開始前的暫時性上游狀態（500、502、503、504、520、521、522）：未設定時停用；只要有此物件即啟用，除非 `enabled: false`。涵蓋初始 `Responses` 請求、終止防護續接、原生 `/v1/chat/completions`，以及 429／帳號復原的重新擷取。`attempts` 是單一請求允許傳送至上游的總次數，包含第一次（1..10，預設 3）；這是與連線重設復原共用的單一請求範圍預算，因此 `3` 表示最多只有三個實際請求會送達供應商。等待採固定 400 毫秒、上限 5 秒的指數退避，並遵循 `Retry-After`。此機制獨立於處理速率限制的 `retryOn429`；串流中的失敗絕不重播。 每個 Combo 目標都把預先預約的首次傳送計入該目標設定的總次數；`attempts: 1` 只傳送一次，不會退還預約來增加額度，也不會提高共用上限。傳送前的本機拒絕或取消會釋放未使用的預約。 |
| `retryOnReset?` | `{ enabled?: boolean; replacements?: number }` | 適用於原生 `openai-responses` 供應商（包含 `authMode: "forward"`），以及收到上游回應標頭之前的通用 Responses 轉換傳送路徑。可選擇性地替換一次在呼叫端尚未觀察到任何內容時就失敗的傳送：未設定時停用；只要有此物件即啟用，除非 `enabled: false`。涵蓋兩個不確定階段——回應標頭抵達前連線中斷，以及標頭之後 SSE 內文只載有控制事件時中斷。canonical ChatGPT upstream WebSocket 在 create 訊框送出之後、任何 Responses 事件抵達之前關閉或出錯時，也以相同方式處理，其替換傳送改走 HTTP。只有自我完備的請求才會被替換：`store: false`、完整的 `input`、沒有 `previous_response_id`／`conversation`／`stream_id`，且僅使用由用戶端執行的工具。若鏈式輪次的 `previous_response_id` 已由本代理依自身重放狀態展開，該 ID 會在傳送前移除，因此該輪次同樣符合條件。重置未被替換時，服務日誌會記錄原因：`ambiguous-no-policy`、`ambiguous-request-not-replayable` 或 `ambiguous-allowance-spent`。`replacements` 是單一邏輯請求在所有環節與所有組合子請求中可進行的替換傳送次數（1..2，預設 1）；它既不是各環節的重試次數，也不是傳送預算，因此替換傳送仍必須落在該環節既有的傳送額度之內。已經產生輸出或工具呼叫的請求，無論此值為何都不會被替換。若上游已經開始第一次推論，被替換的推論仍可能計費，因此此選項預設停用。 通用轉換傳送路徑的首次傳送和重建後的傳送都支援標頭之前連線重設後的替換，使用同一授權和傳送預算。配接器自行管理的傳輸，以及收到上游回應標頭之後的轉換串流故障，均不在此選項範圍內。 |
| `autoToolChoiceOnlyModels?` | `string[]` | 其 `tool_choice` 僅接受 `auto` 或 `none` 的模型；強制選擇被降級。 |
| `preserveReasoningContentModels?` | `string[]` | 需要在 chat 歷史中保留先前 assistant `reasoning_content` 的模型。從儀表板儲存時會保留已儲存的清單（包括 `[]`）。`PATCH /api/providers?name=<provider>` 接受陣列，或傳入 `null` 清除該欄位。將供應商改到其他轉接器、base URL 或驗證模式的儲存不會保留該清單（見下文）。 |
| `reasoningDetailsModels?` | `string[]` | 以結構化 `reasoning_details` 陣列回傳思考內容的模型（啟用 `reasoning_split` 的 MiniMax M 系列）；串流增量為累積快照，以前綴差分處理，保留的推理以 `reasoning_details` 陣列而非 `reasoning_content` 字串重播。 |
| `requiresReasoningPlaceholderModels?` | `string[]` | 上游會拒絕缺少 `reasoning_content` 的 tool_call 續接訊息的模型（DeepSeek thinking 模式）；重播快取未命中時會注入最小的佔位內容。預設沿用 `preserveReasoningContentModels`；設為 `[]` 可明確關閉。從儀表板儲存時會保留已儲存的清單（包括 `[]`）。`PATCH /api/providers?name=<provider>` 接受陣列，或傳入 `null` 清除該欄位。將供應商改到其他轉接器、base URL 或驗證模式的儲存不會保留該清單（見下文）。 |
| `thinkingToggleModels?` | `string[]` | 使用 `thinking.enabled` 而非 effort 階梯的 chat 模型。 |
| `thinkingBudgetModels?` | `string[]` | 使用整數 `thinking_budget` 的 chat 模型；effort 映射為預算比例。 |
| `noVisionModels?` | `string[]` | 透過視覺 sidecar 發送的純文字模型；比對容忍 Ollama `:size` 標籤。 |
| `escapeBuiltinToolNames?` | `boolean` | 為 Anthropic 相容閘道轉義內建工具名稱，並在回傳的呼叫中還原它們。 |
| `googleMode?` | `"ai-studio" \| "vertex" \| "cloud-code-assist"` | Google 傳輸／認證模式。預設 `ai-studio`。 |
| `googleToolSchemaPolicy?` | `"compatible" \| "reject-lossy"` | 僅限 Google。省略或設為 `compatible` 時保留相容結構描述與既有的非直接 400 修復。`reject-lossy` 會在傳送前拒絕初始損失或結果不確定的有界比較，並阻止會放寬限制的 Vertex 或 Cloud Code Assist 修復。直接 AI Studio 不會執行該修復。 |
| `project?` | `string` | Vertex 或 Antigravity Cloud Code Assist 專案 id。設定後，Vertex API 金鑰使用專案端點；未設定時，即使有 `GOOGLE_CLOUD_PROJECT` 也使用 express 模式。ADC 後備為 `GOOGLE_CLOUD_PROJECT` / `GCLOUD_PROJECT`。設為 `"auto"` 時，每把 Vertex API 金鑰各自解析所屬專案（解析成功的結果依金鑰快取；解析失敗的金鑰會在後續請求中再次探測），同一個金鑰池可跨多個專案；ADC 不接受 `"auto"`。 |
| `location?` | `string` | Vertex 位置。API 金鑰的專案端點預設為 `global`，並忽略 `GOOGLE_CLOUD_LOCATION`；ADC 需要此欄位或 `GOOGLE_CLOUD_LOCATION` 後備。 |
| `mcpServers?` | `Record<string, CursorMcpServerConfig>` | Cursor only: stdio or Streamable HTTP MCP servers. |
| `desktopExecutor?` | `DesktopExecutorConfig` | Cursor only: external computer-use and record-screen commands. |
| `unsafeAllowNativeLocalExec?` | `boolean` | Cursor legacy boolean, equivalent to `nativeLocalExec: "on"` only when the newer field is unset. |
| `nativeLocalExec?` | `"off" \| "codex-sandbox" \| "on"` | Cursor local-exec policy. `off` is default; `codex-sandbox` currently fails closed like `off`. |

LM Studio 指示相容性：`singleLeadingSystemMessage: true` 會把僅含文字的 system／developer 訊息合併成一則開頭的 system 訊息，覆寫依時間順序的 Chat 指示位置。LM Studio 預設組合預設啟用它；設為 `false` 可停用合併。


註冊或替換供應商（`POST /api/providers`）時，會先驗證 `responsesPath` 和 `chatCompletionsPath`，再修改記憶體或磁碟中的設定。`PATCH /api/providers?name=<provider>` 會將請求內容與已儲存的供應商合併；除僅更新 `requestPacing` 的請求外，凡是修改 `disabled` 以外欄位的更新，都會在儲存前以同樣方式驗證合併後供應商的路徑，若保留的既有路徑無效則回傳 `400`，且不變更設定。載入設定檔時也適用相同的路徑規則。

Provider registration and replacement (`POST /api/providers`) validate `responsesPath` and `chatCompletionsPath` before changing live configuration or disk state. `PATCH /api/providers?name=<provider>` merges the request body with the stored provider; updates touching fields beyond `disabled` — except `requestPacing`-only updates — validate the merged provider's paths the same way before saving, and an invalid retained path returns `400` with the configuration unchanged. The same path rules apply when loading a configuration file.

For example, this applies a provider-wide concurrency cap and a stricter cap to one exact model, without configuring an interval:

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

The concurrency slot stays occupied until the upstream request finishes, including the final streamed response bytes. Requests above the applicable provider and model limits wait in the pacing queue; when a slot is released, the next eligible request is admitted. Queue waiting does not consume the upstream response-header timeout.

For multiple API-key pool entries, opt into normal-request distribution separately from the existing failure-selection `apiKeyPoolStrategy`:

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

This admits at most ten active requests across the provider and one per credential reference, with starts on each reference at least four seconds apart. These are local upper bounds, not a promise of upstream capacity. A provider-wide RPM setting, when present, remains an aggregate limit and does not multiply with key count. Key limits span models; model rules remain additional restrictions. Projects sharing quota need an appropriate aggregate limit; TPM and daily quotas are not tracked here.

Round-robin selects keys per request without saving a new active key. Known 401/429 cooldowns are skipped; when none remains eligible, new requests receive a retryable 429 instead of repeatedly sending. Already queued work normally retains its selected key and may wait behind that key even when another is idle. If that selection becomes cooled or invalid, the request selects an eligible key again and reacquires pacing admission for it; the bounded queue expires rather than waiting forever. Selection and diagnostics are process-local, reset on restart, and do not equal balanced token usage or billing. Starts count pacing admissions, including work cancelled before dispatch. OAuth and forwarded credentials keep their existing selection. The dashboard shows key handles, starts, in-flight work, queued work and known cooldowns, never secret key values. These limits cover the inference pacing executor, not the standalone Images relay's direct fetch.

### Azure OpenAI model metadata discovery

For a base URL whose hostname ends in `.openai.azure.com`, discovery fills missing image/text
input support and context/output limits even when the provider has a custom name. Azure
`/models` inference and chat flags alone do not describe image support or token limits.
opencodex supplements them with the public [models.dev catalog](https://models.dev), using its
Azure rows before bundled Azure metadata and other vendor bundles. Model-id lookup is exact
or case-insensitive; a newly published model does not require a new opencodex release.

The public metadata snapshot refreshes during discovery at most once per 24 hours, with a
two-second deadline and a 16 MiB body limit. It is stored in `azure-model-metadata-cache.json`
under the opencodex config directory. No Azure credentials are sent to the public catalog.
Offline discovery keeps stale cached metadata or falls back to bundled hints; generation
requests do not fetch this snapshot.

Explicit input declarations and reported modalities retain precedence, including reported
`vision: false`. Existing vision sidecar coverage still applies. Reported/configured limits
remain authoritative and provider caps still clamp them. Metadata describes model support,
not a particular deployment capacity. Arbitrary deployment aliases such as
`my-production-model` cannot be mapped from Azure inference flags; set `modelInputModalities`
and `modelContextWindows` for that exact id when needed. Unknown ids are not guessed.

### 儲存供應商時會保留什麼

以既有供應商的名稱呼叫 `POST /api/providers`，會以根據請求建立的列取代已儲存的列。儀表板的新增/編輯表單無法傳送所有欄位，因此儲存時會保留請求省略的部分已儲存欄位。其中十三個記錄的是某個上游的行為：`preserveReasoningContentModels`, `preserveResponsesReasoningContent`, `requiresReasoningPlaceholderModels`, `foldDeveloperRoleToSystem`, `singleLeadingSystemMessage`, `reasoningWireFormat`, `omitReasoningEffortWithToolsModels`, `promoteAdditionalTools`, `retryOn429`, `transientRetryOn5xx`, `retryOnReset`, `unsupportedHostedTools`, `unsupportedHostedToolsWithClientTools`。

| 儲存 | 十三項設定 | 已儲存的 `apiKeyPool` |
| --- | --- | --- |
| 目的地相同，欄位省略 | 保留已儲存的值，包括明確的 `[]` 或 `false` | 保留 |
| 新目的地，欄位省略 | 不保留；可能套用新目的地的登錄檔預設值 | 不保留 |
| 請求中傳送了該欄位 | 請求中的值 | 請求中的值 |

目的地指轉接器、base URL（比較協定與主機時不分大小寫，忽略結尾斜線），以及請求有指定時的驗證模式。把供應商移到其他目的地時，描述舊上游的十三項設定和為舊上游核發的金鑰池都不會帶過去。儲存絕不會把舊列的其餘部分合併進新列。

`PATCH /api/providers?name=<provider>` 只修改它指定的欄位，無論目的地為何都保留其他所有已儲存欄位。它接受全部十三項設定，`null` 表示清除。對於兩個推理清單，空陣列會作為明確的退出選項儲存，而不會被刪除。

## 供應商診斷對外安全

儀表板連線測試與即時模型探索使用有界的 GET-only 傳輸。在沒有對外代理的情況下，opencodex 解析主機名稱一次並僅連接到該已驗證位址。HTTPS 保留原始 Host、SNI 與憑證驗證；供應商設定無法停用憑證檢查。

這些操作使用[伺服器設定的對外 fetch](/zh-tw/reference/configuration/server/)。以 `config.proxy` 設定或繼承自 SOCKS5 `ALL_PROXY` 的伺服器 SOCKS5 代理，在目標不符合 `NO_PROXY` 時使用 OpenCodex 的內建通道。`HTTP_PROXY` 與 `HTTPS_PROXY` 保留 Bun 的原生 HTTP(S) 處理，而非 SOCKS 的 `ALL_PROXY` 不是原生 HTTP fetch 路由。URL 與字面位址檢查仍會執行，但所選代理會決定最終路由、DNS 答案與對等端，因此 opencodex 無法 pin 或驗證該對等端。這是明確的安全限制。

私有／本機目的地需要 `allowPrivateNetwork: true`，且當對外代理活躍時需要相符的 `NO_PROXY` 項目。回送會自動加入；請明確列出每個 LAN 主機，因為 CIDR 項目不被解讀。比對器支援精確主機、網域後綴、可選連接埠、方括號 IPv6 與 `*`；例如，明確列出 `192.168.1.50`。中繼資料與 link-local 目標保持被封鎖。診斷請求拒絕重新導向並回報已剝離憑證的目標。普通供應商請求的重新導向審查與此診斷防護分開。

針對 Clash / Surge / Mihomo 使用者的 fake-IP DNS 例外有兩種，且都只作用於 DNS *回應*——URL 中的字面位址仍會被拒絕。IANA 基準區段 `198.18.0.0/15`（含 IPv4-mapped IPv6 寫法）在該主機適用對外代理時被接受。Mihomo 預設的 IPv6 fake-IP 區段 `fdfe:dcba:9876::/48` 採更嚴格的門檻：必須設定與 URL 協定相符的代理變數（`https:` 對應 `HTTPS_PROXY`，`http:` 對應 `HTTP_PROXY`）或 SOCKS5 的 `ALL_PROXY`（非 SOCKS 的 `ALL_PROXY` 不算），主機不得命中 `NO_PROXY`，之後請求會被明確綁定到該代理。其他 ULA、相鄰前綴，或與真實私網回應混合的 fake-IP 回應仍需要 `allowPrivateNetwork: true`。提供者儲存時的驗證不套用此 IPv6 例外。

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
這項本機目錄覆寫不會重新標示 HTTP 模型列表或虛擬的 `*-pro` 資料列。

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

## Codex 帳號池

在儀表板中使用 **Codex Auth** 新增池帳號並重新整理配額。`config.json` 儲存非秘密中繼資料；access 與 refresh token 使用強化的憑證存放。池路由將新／未綁定指派、基於用量的主動切換與失敗復原分開。綁定任務通常保留親和性。預設（`pool.cacheAffinity`）下，該重新綁定會等到綁定帳號耗盡或無法繼續服務，並且只改綁到確有額度餘裕且用量嚴格更低的帳號；所有帳號都高於閾值時，綁定任務留在原帳號。關閉該設定後，`quota` 可在超過用量閾值後的下一個請求時重新綁定它，但仍只改綁到確有額度餘裕且用量嚴格更低的帳號。暫停、冷卻、重新認證與失敗處理可獨立清除或移動路由。未綁定請求沒有即時帳號綁定；帶有工作階段 ID 的請求（包括一般 Codex CLI 和 App 回合及子代理），或錨定到直接父任務的無工作階段請求，其綁定在關閉時最後一次親和性儲存成功的情況下，代理正常重啟後可保留，閒置時間最長為 24 小時。更深層的無工作階段鏈和 Codex App 主要登入的綁定僅保留在記憶體中，重啟後會重新指派；驅逐、帳號刪除、重新登入、崩潰或親和性重置仍可能使任務未綁定。Pre-stream 的 429 或 402 在同一個請求中於一個合格的備用帳號上重試一次，即使基於用量的主動切換關閉。帳號變更保留並重播對話 context，但跨帳號的供應商端 prompt-cache 重用不保證，cache 可能需要重新暖機。

在 **401/403** 時，App 登入清除該帳號的行程本地親和性並要求重新認證。
在 **429** 時，opencodex 遵循 `Retry-After`、啟動帳號冷卻、清除親和性，並可能將請求輪換到另一個合格的池帳號。這些失敗轉換在 `autoSwitchThreshold: 0` 時仍然活躍；該設定僅停用基於用量的主動切換。

For example, add this field to an existing gateway provider whose Codex backend has
non-authoritative response metadata:

| 策略 | 行為 |
| --- | --- |
| `quota`（預設） | 若無現用帳號，跨 5 小時、週與 30 天視窗選擇最低用量的合格帳號。否則將合格現用帳號保持在 `autoSwitchThreshold` 以下；在超過閾值後，未綁定請求可移至較低用量的合格帳號。預設下 cache affinity 優先於配額餘裕，綁定任務會保留到帳號耗盡（已知用量 100%）或無法繼續服務，改綁時只前往確有額度餘裕且用量嚴格更低的帳號。關閉該設定後，也可在閾值將綁定任務的下一個請求改綁到確有額度餘裕且用量嚴格更低的帳號。`0` 停用此用量驅動的重新評估，而非失敗復原。 |
| `round-robin` | 輪替以計數器為基礎。新指派在仍有低於有效 `autoSwitchThreshold` 的合格帳號時，略過達到或超過閾值的帳號（帳號覆寫值或全域預設值，評分與 `quota` 相同）；用量未知或閾值為 `0` 均視為低於閾值。所有合格帳號均達到或超過閾值時，輪替涵蓋全部帳號。已綁定任務超過閾值仍保留帳號，僅在帳號無法服務（冷卻、配額拒絕、容錯移轉、暫停）時移動；活躍對話的子任務從父任務使用的帳號開始。共用優先順序層級篩選以相同方式評估餘裕。操作者的手動選擇會在每個配額 scope 中取得下一次指派，不論其用量；該 scope 中對此帳號的請求成功後，此選擇即被消耗，之後在該 scope 的指派會再次套用閾值。 `accountPoolStickyLimit`（1–100）計數一次選擇上的指派，而非成功的上游回應。 |
| `fill-first` | 將未綁定請求指派到現用帳號直到冷卻、重新認證或該帳號的有效排空閾值（帳號覆寫值，未設定則使用全域值）；未知用量不強制切換。健康的綁定任務保留親和性。 |

**Gateway support is opt-in.** Updating OpenCodex alone does not add this declaration to
existing providers. Without it, an eligible priority request followed by `service_tier: "default"`
retains the legacy `response-declined` interpretation. Configure `false` only when the
route's response metadata is known to be non-authoritative.

For an eligible request serialized as `priority`, both a `default` and a `priority` echo remain
observations. Logs preserve `responseServiceTier` and record
`tierOutcome.responseTierAuthoritative: false`, `fastOutcome: "applied"`, and
`confirmation: "assumed"`, without `response-declined`. Here **applied means the request parameter
was sent**, and **assumed means the actual Fast effect is unconfirmed**. The model tooltip shows
the request and raw response separately with that confirmation. Neither this setting nor these
records prove an acceleration or a billed tier.

Cost estimates use the existing requested-tier fallback instead of treating the raw echo as a
confirmed price tier; pricing rules requiring response confirmation cannot use that echo. Historical records
without an authority flag retain their previous interpretation.

The field accepts only booleans. Omission and explicit `true` retain response-based confirmation
for other destinations, including the official API and undeclared gateways. Canonical
`https://chatgpt.com/backend-api/codex` with `authMode: "forward"` remains automatically
non-authoritative, even if `true` is configured. Gateway names and URLs are never inferred.
If one gateway mixes response contracts, use separate provider entries for those routes and
apply the declaration only to the relevant entry.

### `anthropicAccountPool`（實驗性）

此選擇加入功能池化已儲存在 `auth.json` 中的多個 Anthropic OAuth 帳號。預設關閉且未經實戰考驗。同一組織中的帳號可能共享配額，而自動輪換可能觸發供應商限制。

| Key | 型別 | 預設值 | 說明 |
| --- | --- | --- | --- |
| `anthropicAccountPool.enabled?` | `boolean` | `false` | 啟用 sticky 工作階段親和性與依用量的新工作階段選擇。**429 容錯移轉不由此開關控制**：只要儲存了兩個以上可用帳號就會生效，與其他多憑證供應商一致，且無法關閉。 |
| `anthropicAccountPool.autoSwitchThreshold?` | `number` | `80` | 對於新 session，當現用帳號達到此閾值時，選擇設定視窗中已知快取用量最低的帳號，並優先選擇低於自身閾值的帳號；所選帳號本身不必達到閾值。`0` 僅停用基於用量的主動切換；新 session 選擇與符合條件的 429 後路由復原仍會使用 `quotaWindow`。 |
| `anthropicAccountPool.strategy?` | `"quota" \| "round-robin" \| "fill-first"` | `"quota"` | 新 session 策略。`quota` 保留現用帳號，直到其 `quotaWindow` 用量達到有效 `autoSwitchThreshold`（預設 80）或無法服務，再轉到用量最低的帳號，優先選擇低於自身閾值的帳號；用量未知時保留現用帳號。`round-robin` 不讀取用量閾值，輪替新 session。`fill-first` 在 `quotaWindow` 中評估排空閾值。 |
| `anthropicAccountPool.quotaWindow?` | `"five-hour" \| "weekly" \| "max-utilization"` | `"five-hour"` | 使用量型帳號選擇所採用、由供應商回報並快取的用量列。`five-hour` 保留原有行為。`weekly` 使用每週用量列，並在仍有其他可用帳號時略過 5 小時用量已用盡的帳號；若沒有其他帳號，則退回使用這些帳號。`max-utilization` 使用已知值中的最高值，因此每週用量尚未取得時仍可使用 5 小時用量；兩者都未知時，帳號遵循 unknown 用量排序。已知用量排在 unknown 之前，但若所有可用帳號都是 unknown，仍會依可用順序選出一個。完成前述較低 5 小時用量的同分判定後，完全相同時也保留可用順序。不會主動重新平衡健康且已有 affinity 的 session。當 `quota` 選擇替代帳號時（現用帳號達到閾值或無法服務的新 session，或符合條件的 429 後復原），優先選擇低於自身閾值的候選帳號並依此視窗排序；`fill-first` 依此視窗的門檻與用盡規則按穩定順序前進；`round-robin` 忽略此設定。冷卻狀態、容錯移轉上限與重新驗證資格仍是獨立的本機狀態。每個帳號的每週用量來自用量探測或觀察到的回應標頭。 |
| `anthropicAccountPool.stickyLimit?` | `number` | `1` | 在一次 round-robin 選擇上保留的成功新 session 綁定。範圍 1–100。 |

只有共用5小時或每週額度明確拒絕的429才會冷卻帳號並切換。暫時速率限制保留親和性，只暫停該帳號的請求准入；每個請求最多一次短暫的同帳號重試及一次合格兄弟帳號切換。沒有依據回應標頭的429只允許一次同帳號短暫重試，不冷卻帳號，也不產生Retry-After。預設單帳號行為不變。Fable專屬拒絕不限制Sonnet；手動選擇和親和性均檢查請求模型的共用與家族額度。被動家族資訊在30分鐘或已知重設時到期，由一個服務請求依序重新驗證。用量門檻仍是軟偏好，全部候選耗盡時保留原有退回機制，不是用量或帳單硬上限。親和性為行程本地且有界。Token 更新失敗保留原有重新認證規則。已分類的訂閱或帳號計費 403 可在輸出前切換帳號，並按 `Retry-After` 或預設十分鐘冷卻；一般權限拒絕不切換。若所有合格帳號都在冷卻，客戶端收到附帶已知 `Retry-After` 的 429，而非認證錯誤。

Anthropic 的回應也會回報服務端帳號的 5 小時與每週使用率，一則回應帶有這兩者中的哪一個，就會記錄在該帳號上——兩個視窗各自獨立，無論是拒絕還是成功的回應都會記錄。因此用量感知選擇可以直接從你實際使用的帳號運作，不必等儀表板的 Providers 頁面去輪詢它們。這些讀數會刷新既有的列，而不是取代它，所以只有 usage 端點才會回報的、model-scoped 的每週列，會在其已知重設時間之前被保留。過期的量測值會變成未知，包括被後續標頭省略的既有標準視窗。一個只帶重設時間的標頭無法延長一個較舊的使用率量測值。沒有已知重設時間的值維持既有行為；缺席的量測值絕不會被替換成零用量。

標頭觀測不會延後用量探測，也不會清除一次失敗探測的不可用狀態。重新啟動後，快取的 Anthropic 觀測值仍然可用，同時下一次配額讀取會再次探測，因為儲存的觀測值不包含探測時鐘。

`anthropicAccountPool.routes` 將模型綁定至已儲存的 Anthropic OAuth 帳戶 ID。啟用帳戶池後，區分大小寫的 `match` 萬用模式依順序採用第一個符合的規則，限制首次選擇與 429 重試。僅當該規則沒有可用帳戶時，`fallback: true` 才會回退到一般帳戶池。

當請求可用的每個帳號都因配額耗盡而被保留（共用 5 小時或每週視窗，或所請求模型家族的每週視窗）時，這個 429 是用量上限而非速率限制：Responses 本文的 `error.type` 與 `error.code` 為 `usage_limit_reached`；若每個被保留帳號的上游重設時間都已知，還會附上 `resets_at`（最早重設的 epoch 秒）。Codex 會停止並顯示何時可再試，而不是一路重試到 "exceeded retry limit"。最後一個帳號因配額耗盡被拒且沒有可替換帳號時，也會得到相同回應。只要有一個被保留帳號只是暫時限速、正在重新驗證模型家族或因權限被拒，回應就維持可重試的 `rate_limit_exceeded`。Combo 目標維持速率限制形式，讓 combo 能轉到下一個目標。原生 `/v1/messages` 維持 Anthropic 的 `rate_limit_error` 類型，訊息中會說明用量上限。

只要一次新的用量讀取（儀表板的提供者頁面，或 `ocx account list anthropic --quota --refresh`）顯示每個被拒絕的視窗都低於 100%，配額冷卻就會提前解除，不論它來自 `Retry-After` 或視窗重設。這適用於升級方案或視窗提早重新開放的情況。在拒絕之前開始的讀取永遠不會解除它，權限類 403 冷卻會等到其截止時間。

:::caution[實驗性]
除非你了解 Anthropic 帳號政策風險，否則保持停用。不確定時偏好手動 `ocx account use anthropic <id>` 切換。
:::

### `oauthAccountFailover`

The built-in `anthropic` (stored Claude OAuth) and `anthropic-apikey` entries advertise Fast only
for `claude-opus-5-5`, `claude-opus-5`, and `claude-opus-4-8`. Other Claude models are unclassified;
the entries have no provider-wide Fast default.

Anthropic Fast is **off by default** because it spends usage credits (subscription) or fast-mode
access (API) at 2x price. Turn it on per provider with the Off/On row on the dashboard Models page,
or set `providers.anthropic.fastEnabled: true` (or the same field on `anthropic-apikey`). While it is
off, those models publish no Fast toggle or `--fast` row and the proxy never sends `speed`, even with
a global `fastMode: true`. Claude Code native passthrough still forwards a `speed` field the caller
sends itself (for example Claude Code `/fast`), because that request never reaches the proxy's Fast
policy. Cursor Fast and other providers are unaffected.

When enabled, an eligible `--fast` or Fast selector sends
`speed: "fast"` and adds `fast-mode-2026-02-01` to the existing `anthropic-beta` header. The proxy
preserves OAuth beta values and sends one deduplicated header. `fastMode: false` disables this
injection.

Anthropic's `usage.speed` echo determines the outcome: `fast` confirms Fast, `standard` records a
downgrade, and a missing echo is unconfirmed. Only confirmed Fast usage receives the 2x list-price
estimate (Opus 5.5 $8 input / $40 output; Opus 5 and 4.8 $10 input / $50 output per million tokens).
If the first fast send is rejected because usage credits are required, an organization disabled Fast,
the model rejects `speed`, or the fast pool is empty, the main adapter dispatch can make one budgeted
standard-speed resend. Generic rate limits and capacity errors keep their usual handling. Subsequent
builds of that request stay at standard speed; a new turn may encounter the refusal again.

Subscription Fast on Pro/Max needs usage credits; Team/Enterprise organizations also need admin
enablement. First-party API Fast is a research preview that requires access. See
[Anthropic Fast mode](https://platform.claude.com/docs/en/build-with-claude/fast-mode) and
[Claude Code Fast mode](https://code.claude.com/docs/en/fast-mode) for access and billing terms.

### 受管記錄結構

`apiKeys[]` 項目包含 `id`、`name`、生成的 `key` 與 ISO `createdAt` 字串。
`codexAccounts[]` 項目需要 `id`、`email` 與 `isMain`，可選 `plan`、
`chatgptAccountId` 與隱私安全的 `logLabel`。這些記錄通常由儀表板管理。

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

The canonical `https://openrouter.ai/api/v1` preset advertises Fast only for these exact
OpenAI-backed model slugs:

- `openai/gpt-5.6-sol`
- `openai/gpt-5.6-terra`
- `openai/gpt-5.6-luna`

`anthropic/claude-sonnet-5` and undeclared OpenRouter models remain unclassified. A provider-level
`supportsServiceTier` default is intentionally absent, and a user-set `supportsServiceTier: false`
still disables the exact-model declarations. The registry declarations apply only while the
provider still targets the canonical OpenRouter base URL; a same-named custom destination is not
assumed to share OpenRouter's contract.

Fast sends `service_tier: "priority"`. It does not add or rewrite `provider.only`,
`provider.order`, or `provider.allow_fallbacks`. OpenRouter documents priority endpoints as the
first routing choice, followed by graceful fallback to other endpoints when priority capacity is
unavailable. Billing follows the endpoint actually used, and the response reports the actual
top-level `service_tier`. Pinning tier endpoints and disabling fallback would therefore reduce
availability without improving billing safety.

Request logs use that response echo as the authority. `priority` confirms Fast as applied;
`default` records a downgrade and uses the standard-price estimate; a missing field leaves the
attempt assumed rather than guessing a downgrade. OpenRouter's priority multiplier varies by
upstream and is not bundled here. When priority is confirmed but no exact priority price is known,
the dashboard keeps the standard-price estimate as a documented lower bound and prefixes it with
`≥`; downgraded attempts have no lower-bound marker.

API-key providers may hold a literal key or an environment reference. OAuth providers use the
credential store populated by `ocx login`; subscription-backed Claude Code launch behavior is
configured under [`claudeCode.authMode`](/zh-tw/reference/configuration/server/#claude-codeclaudecode).

OrcaRouter exposes both forms explicitly: `orcarouter` is the manual API-key provider and
`orcarouter-oauth` runs browser consent with S256 PKCE, then stores the returned durable API key as
an account credential. The public defaults intentionally split authentication
(`https://www.orcarouter.ai`) from inference (`https://api.orcarouter.ai/v1`). Set
`ORCAROUTER_BASE_URL` before the first account login for a one-origin self-hosted deployment, or use
`ORCAROUTER_AUTH_BASE_URL` and `ORCAROUTER_API_BASE_URL` for separate origins.
For a loopback/private self-hosted endpoint, **before the first login**, create or update
`providers["orcarouter-oauth"]` with `adapter: "openai-chat"`, the intended `baseUrl`,
`authMode: "oauth"`, and an explicit `allowPrivateNetwork: true`. Login preserves that operator
setting and never grants it from a URL override. Without it, destination validation rejects the
local endpoint for inference and model discovery. The OAuth browser callback listener itself
does not require this provider opt-in. See the [OrcaRouter setup example](/zh-tw/guides/providers/).

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

Use **Codex Auth** in the dashboard to add pool accounts and refresh quotas. `config.json` stores
non-secret metadata; access and refresh tokens use the hardened credential store. Pool routing
separates new/unbound assignment, usage-based proactive switching, and failure recovery. A bound task
normally keeps affinity. By default (`pool.cacheAffinity`) `quota` does not rebind it merely because
the usage threshold is crossed; that rebind waits until the bound account is exhausted or otherwise
cannot serve, and then only onto an account with genuine quota headroom and strictly lower usage.
Set `pool.cacheAffinity: false` to restore threshold rebinding of bound tasks, still only onto such
a destination. Pause, cooldown, reauthentication, and quota refusals still release a live binding
immediately. A transient-failure streak serves the request from another account while keeping the
binding, and the task returns once that account serves again; after 10 minutes the binding is
released normally. An unbound request has no live account binding; this can include an existing visible
task after proxy restart or affinity reset. A pre-stream 429 or 402, or a 5xx response whose bounded
body explicitly reports quota exhaustion, retries once on an eligible alternate account in the same
request, even when usage-based proactive switching is off. The ordinary transient-5xx policy runs
first, so a wrapped quota response may make up to three sends on the exhausted account before pool
rotation. Account changes preserve and replay the conversation context, but provider-side
prompt-cache reuse across accounts is not guaranteed and the cache may need to warm again.

On a **401/403**, App login clears that account's process-local affinity and requires reauthentication.
On a **429**, opencodex honors `Retry-After`, starts the account cooldown, clears affinity, and may
rotate the request to another eligible Pool account. These failure transitions remain active with
`autoSwitchThreshold: 0`; that setting disables only usage-based proactive switching.

Pausing an account preserves its quota metadata but excludes it from switching, failover, recovery
probes, and manual activation. It also clears that account's thread affinities. In-flight requests keep
captured credentials; later turns are rerouted. If every account is paused, Pool routing fails rather
than silently choosing one. **Pause exhausted** refreshes eligible accounts with available credentials
and pauses only accounts freshly confirmed at 100%; unknown or failed refreshes remain unchanged.

| Strategy | Behaviour |
| --- | --- |
| `quota` (default) | If no active account exists, choose the lowest-usage eligible account across 5-hour, weekly, and 30-day windows. Otherwise retain an eligible active account below `autoSwitchThreshold`; after it crosses the threshold, an unbound request can move to a lower-usage eligible account. Bound tasks keep cache affinity by default and stay until the account is exhausted (known usage at 100%) or cannot serve (paused, unusable); a move then requires genuine quota headroom and strictly lower usage on the destination, so the task stays put when every account is over the threshold or the only cooler account has unknown usage. Set `pool.cacheAffinity: false` to let a bound task's next request move at the threshold, still only onto such a destination. `0` disables this usage-driven re-evaluation, not failure recovery. |
| `round-robin` | Evenly assign unbound requests across eligible accounts. Rotation is counter-based and ignores usage thresholds, but the shared priority-tier filter still evaluates each account's headroom using its effective threshold (account override or global default). `accountPoolStickyLimit` (1–100) counts assignments on one pick, not successful upstream responses. |
| `fill-first` | Assign unbound requests to the active account until cooldown, reauthentication, or that account's effective drain threshold (account override or global default); unknown usage does not force a switch. Healthy bound tasks keep affinity. |

Rotation does not protect against provider enforcement; multi-account use may violate provider terms.

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

### Anthropic · Pool 2 (`anthropic2`)

`anthropic2` ("Anthropic · Pool 2") is a second builtin Anthropic OAuth provider with its own
account pool. It runs the same Anthropic implementation as `anthropic`: the same login flow, wire
format, native Messages and Responses bridge, and model metadata. Only the accounts and the pool
around them are separate. Choose a pool with the model prefix: `anthropic/claude-sonnet-5` uses the
primary pool and `anthropic2/claude-sonnet-5` uses Pool 2.

Pool 2 stays dormant until you add it. Log in with `ocx login anthropic2` or add **Anthropic · Pool 2**
on the dashboard Providers page. A successful first login creates `providers.anthropic2` with the
marker `"anthropicOAuthInstance": "anthropic2"`. Pool 2 never becomes the default provider: bare
`claude-*` model names, the default model, and Claude Code caller forwarding keep resolving to
`anthropic`. An unmarked `anthropic2` entry you created yourself earlier keeps its custom meaning;
login refuses the name collision and rewrites neither the entry nor your credentials.

Pool 2 reads its pool settings from its own provider entry. The keys, defaults and behavior match
the top-level [`anthropicAccountPool`](#codex-目錄與根層級-configtoml-設定), and nothing is inherited
from the primary pool. `providers.anthropic.anthropicAccountPool`, or the field on any other provider,
is rejected.

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

The two pools are isolated inside opencodex:

- **Credentials:** Pool 2 accounts are stored under their own `anthropic2` key in the protected
  credential store. A login whose token or verified Anthropic account is already stored in the other
  pool is rejected.
- **Pool settings and runtime state:** selection, session affinity, cooldowns, pauses, model routes
  and per-account thresholds belong to one pool. Route `fallback: true` widens only within the same
  pool.
- **Quota and usage:** usage probes, quota caches and usage attribution are recorded per pool, so an
  account ID that exists in both pools still has two separate records.
- **Reset grants:** Pool 2 keeps its own journal (`anthropic2-reset-grant-ledger.json`) next to the
  primary pool's unchanged journal.
- **Recovery:** a direct `anthropic2/<model>` request never falls back to the primary pool, and a
  Pool 2 rate limit or refusal never cools a primary-pool account. An explicit combo that names both
  pools keeps the targets you declared.

This separation is a routing boundary inside opencodex. It does not change how Anthropic treats your
accounts or the [account policy risk](#codex-目錄與根層級-configtoml-設定) described above.

Pool 2 accounts are added only through browser OAuth. Unlike `anthropic`, Pool 2 never imports,
adopts or writes back a Claude Code CLI token; this difference is intentional. Pool 2 starts empty,
and a Pool 2 request with no usable Pool 2 account fails with an authentication error instead of
borrowing a primary-pool or Claude Code credential.

Account commands and management APIs take the pool by name: `ocx account pool anthropic2 …`,
`ocx account auto-switch anthropic2 …`, `ocx account routes anthropic2 …`, and
`ocx account anthropic-reset-grants --provider anthropic2`. The pool settings and reset-grant
endpoints accept `provider: "anthropic2"`; omitting it keeps the primary pool.

#### Helper pool selection (`anthropicInstance`)

The web-search and vision helpers accept an optional `anthropicInstance`, in the global
`webSearchSidecar` and `visionSidecar` settings and in the Claude Code overrides
`claudeCode.webSearchSidecar` and `claudeCode.visionSidecar`. The dashboard shows it as a **Pool**
select when the helper backend is Anthropic.

| Value | Behavior |
| --- | --- |
| unset (default) | Follow the pool of the current request: an `anthropic2/<model>` request uses Pool 2 and an `anthropic/<model>` request uses the primary pool. A request from another provider keeps the existing helper discovery, which never selects Pool 2. |
| `"anthropic"` | Always use the primary pool. |
| `"anthropic2"` | Always use Pool 2. |

The field only applies when the helper's backend resolves to Anthropic. Setting it with another
backend is a validation error; because web search defaults to OpenAI, set
`"backend": "anthropic"` as well. A helper model qualified with the other pool, such as
`anthropic/claude-sonnet-5` with `"anthropicInstance": "anthropic2"`, is also rejected. If the chosen
pool has no usable account, the helper fails before sending anything; it does not switch to the other
pool. The main request then continues without that helper. An unset choice is saved as absent, never
as `"anthropic"`.

```json
{
  "webSearchSidecar": { "backend": "anthropic", "anthropicInstance": "anthropic2" }
}
```

:::caution[Downgrading]
Versions without Pool 2 do not understand the `anthropic2` entry. Before installing an older
version, stop the proxy, back up `config.json` and `auth.json`, and remove
`providers.anthropic2` from `config.json`. Primary-pool credentials are never moved or rewritten by
Pool 2. An in-place downgrade with an active Pool 2 is not supported.
:::

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

Routing resolves a provider endpoint before the adapter. For most built-ins, the registry endpoint
wins over configured `baseUrl`. Four entry types keep the configured URL:

- override-enabled providers: `ollama`, `vllm`, `lm-studio`, `litellm`, `qwen-cloud`, and
  `alibaba-token-plan-intl`;
- registry templates filled by the user, such as `azure-openai` and `cloudflare-ai-gateway`;
- promoted fixed API-key presets preserving an older same-named custom destination; and
- providers absent from the registry.

Adapters can adjust the resolved URL afterward. Kiro, for example, follows the imported credential's
API region for canonical `runtime.{region}.kiro.dev`. See [Adapters](/zh-tw/reference/adapters/).

When routing discards `baseUrl`, opencodex logs the registry endpoint and only the configured origin;
a configured path may itself contain a credential. Remove the unused URL or choose the provider entry
matching the intended region. `alibaba-token-plan` is pinned to Beijing, while
`alibaba-token-plan-intl` covers international endpoints.

For a broken `openai-responses` gateway, repair belongs on the provider object:

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

Placeholder lists are exact matches. Leave the field unset for normal/stateful Responses providers
so passthrough stays byte-for-byte identical.

### OpenRouter Fast

Native Cursor vision uses `SelectedImage` (JPEG soft-cap + `blobIdWithData`) for models that can
see images natively — Claude, Gemini, GPT, Kimi, and Grok among them — using active-turn `data:`
images only. Earlier-turn images replay as `[image attached]` text markers; remote or undecodable
images become omission markers. Auto, the Composer family, and GLM (`glm-5.2`, `glm-5.3`) stay on
the curated `noVisionModels` list and use the vision describe sidecar instead.

Cursor server-driven local tools are disabled by default. Codex continues using its own tools such as
`apply_patch` and `exec_command` with its own approval and sandbox policy:

- `"off"` (default) rejects Cursor-native `read`, `write`, `delete`, `ls`, `grep`, `shell`, and
  `fetch` execution.
- `"on"` opts into trusted-local execution and bypasses Codex approval/sandbox semantics,
  except foreground native shell execution, which remains unavailable.
- `"codex-sandbox"` is retained for compatibility but fails closed like `"off"`; request prose is
  not trustworthy sandbox attestation.

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

Set `nativeLocalExec` on `providers.cursor`, not at the top level. In the dashboard use **Providers
→ Cursor → Edit JSON**, save, then restart. Legacy `unsafeAllowNativeLocalExec: true` equals
`nativeLocalExec: "on"` only when `nativeLocalExec` is unset. MCP, screen recording, and computer use
are controlled separately by `mcpServers` and `desktopExecutor`.

Foreground `shellArgs` and `shellStreamArgs` requests are rejected before process creation on
Windows, macOS, and Linux, including with `nativeLocalExec: "on"`. They require a kernel-backed
descendant owner that this implementation does not provide; use the client's shell tool instead.
The streaming form still returns start, aborted exit, a typed failure, and stream close so the
Cursor turn can finish. It collects no stdout/stderr and has no active output-byte allowance.
This restriction does not change background shell execution or the other explicit executor opt-ins.

Each `mcpServers.<name>` accepts either `command` (stdio) or `url` (Streamable HTTP). Stdio also
accepts `args`, `env`, and `cwd`; HTTP accepts `headers`. Both support `enabled` (default true) and
`toolPrefix`. `desktopExecutor` accepts `computerUseCommand`, `recordScreenCommand`, `cwd`, `env`,
and `timeoutMs` (default `30000`). Commands run through `sh -c`, read one JSON request from stdin,
and must write one JSON result to stdout.

:::caution[Security]
The default loopback bind admits any local process without auth, including other users on a
multi-user host. Leave local exec off unless every data-plane caller is trusted and you deliberately
accept bypassing Codex approval and sandbox semantics.
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

要做出以原生優先的 picker，請把原生 id 加進 `modelPickerOrder`，後面接路由 id。這會為整個 picker 排序，同時保留 OpenCodex 各自獨立的自然優先順序指引計算。原生 Codex 廣告的那五個模型會跟隨 picker 優先順序，且可能改變；精確名稱覆寫的資格不限於那份廣告清單。純路由順序保留它們先前的行為。見[排序遷移說明](/zh-tw/guides/model-ordering/#遷移提醒現有列表中的原生-id)。供應商上的 `modelDisplayNames` 控制可讀標籤，不會改變 wire id。

## 路由過的 agent 訊息

透過 [`openai-responses` adapter](/zh-tw/reference/adapters/#openai-responses)，當 `authMode` 不是 `"forward"`（例如 `"key"`）時，包含非空、受支援純文字部分陣列的 Codex `agent_message` 項目，會變成使用者訊息。使用 `authMode: "forward"` 的供應商會原封不動保留這些項目。`agent_message` 是 ChatGPT Codex backend 私有的，目前回報過的路由目的地會用 `422 unknown item type "agent_message"` 拒絕整個請求；Codex 會在之後每一個回合重播子代理的歷史，所以在該項目被轉換之前，這條執行緒會持續失敗。作者與收件者仍是明確的文字中繼資料，內容部分會被保留。對於標準連接埠上的 HTTPS `api.x.ai` 與 `cli-chat-proxy.grok.com`，非 forward 的 Responses 派送也接受一個非空白字串的子結果，並把它轉成一個 `input_text` 部分。原始字串——包括開頭／結尾的空白與換行——會被保留。其他目的地讓字串值的 agent 訊息維持不變。空字串或只有空白的字串維持不變，不完整以及混合加密／未知形狀的內容也是如此。加密與未知內容不會被正規化；原生加密任務仍需要獨立選擇加入的[任務復原](/zh-tw/reference/configuration/agents/#加密-v2-任務復原)。

啟用任務復原時，被重播的 `NEW_TASK` 與 `MESSAGE` 項目，只有在驗證呼叫端並比對父執行緒 scope 之後，才會重用一個快取的指派。重播還原不會發出新的復原請求，也不會延長快取的到期時間。過期或未見過的密文不會被取代。全新的加密 `NEW_TASK` 與 `MESSAGE` 項目使用同一個選擇加入的復原路徑，包括原生父層的 `send_message` 傳遞。訊息類型、寄件者、收件者、父層 scope 與呼叫端憑證，仍是驗證或快取身分的一部分。

當一個請求包含好幾則 agent 訊息時，快取的重播還原會各自獨立檢查每一則訊息。快取會在已准入的呼叫端／帳號與父層 scope 內，區分訊息類型、寄件者、收件者與密文。全新的復原只處理目前的尾端訊息（忽略尾隨的 `compaction_trigger` 或 `additional_tools` 中繼資料）。它不會批次復原未見過的歷史訊息；那些訊息維持不變。一次快取未命中或過期，不會延長歷史復原契約。

路由過的 Responses 上的寄件者與收件者，是給接收模型的脈絡，不是一個新的機器可讀路由協定。工具路由繼續使用既有的協作契約。

### 個別模型能力宣告

`modelCapabilities` 以精確的上游模型 ID 為 key，儲存明確的宣告。ID 會保留大小寫，且不得含前後空白。每個項目可以包含 `inputModalities`（`text`、`image`、`audio`、`video`）、`contextTier`（`default`、`long_context`）與 `video.processing`（`static`、`agentic`）。這些是維運方的宣告，不是供應商支援的證明。Context-tier 與 video 欄位目前只記錄意圖，不會啟動上游行為，也不會增加目錄視窗。

原始的供應商編輯器與供應商 API 都公開這個 map。POST／PUT 會取代明確提供的 map，並拒絕 null 項目。PATCH 會合併個別軸；`null` 會清除一個 map、模型、軸或 video processing 值，`{}` 則不做任何變更。省略的供應商覆寫會保留既有的 map。格式錯誤、手動編輯的檔案會保留有效的獨立軸，並把格式錯誤的明確輸入模態當成純文字處理，同時發出診斷訊息。

明確的 `modelCapabilities.<id>.inputModalities` 現在對該精確路由模型而言，會優先於舊版的模態提示。純文字宣告會使用既有的視覺 sidecar，把影像換成描述；若沒有可用的 sidecar，請求會在派送前收到一個明確的省略標記。原生 Chat 影像請求會透過這條路徑分流。目錄仍可以廣告影像附件支援，因為代理提供了這個描述步驟。Context-tier 與 video processing 宣告在其傳輸支援到位之前，仍維持不生效。

### Prompt-length pricing

In **Models → Price**, keep four base rates and choose a prompt-length mode:

- **Automatic** keeps the catalog context rules. It is also the behavior of existing four-rate overrides without a policy.
- **Flat rate** uses the base rates at every prompt length, disabling catalog context adjustments.
- **Custom threshold** selects four absolute alternative rates using `>` or `≥` and one token threshold. The custom policy replaces the catalog context rule on both sides of the threshold.

All prompt tokens count, including cache reads and writes, before billable-input subtraction.
Output does not count toward the threshold. Once crossed, the alternative rates apply to the
entire request, including output, not only the excess tokens. Custom rates are standard-speed
rates: an applicable Fast/Priority premium applies once after the rates are selected and follows
the catalog's relation between Priority and long-context pricing for that model. A confirmed
Priority request shows the custom estimate as a lower bound only when the catalog declares that
relation as `lower-bound`, as for xAI Grok, which publishes no combined rate. A model with no
catalog context rule applies any Priority multiplier once. These settings control estimates; they
do not change provider billing.
**Reset to automatic** deletes the entire override and restores catalog prices and rules. Saving or
editing the config updates live estimates and historical totals.

For example, a Haiku 5.5 override with alternative rates strictly above 100,000 prompt tokens:

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

This is an example of user-defined prices, not an official Haiku price list.
Any positive safe-integer threshold, including `272000`, is supported; use `"gte"` for inclusive
comparison. All four alternative rates are required and follow the base-rate limits, including zero.
The other policy is `{ "mode": "flat" }`. Omit `promptLengthPricing` to retain automatic context
rules with your base prices; an explicit `{ "mode": "automatic" }` is accepted and means the same,
and saves from the dashboard or API store it as an absent field.

Legacy `openai-multi` model price overrides retain valid prompt-length policies when startup
migrates them to `openai`, including overrides keyed by `openai-multi/<model>`.

### 重新命名的 API-key 預設

當一個以其他名稱儲存的供應商（例如 `CommandCode`）的 adapter 與固定 API-key 端點，與某個登錄檔預設相符時，它會繼承缺失的 reasoning-effort 中繼資料。你明確設定的 per-model 清單（包括 `[]`）仍具權威性。省略的供應商範圍清單會繼承預設值；明確設定的清單維持不變。這不適用於 OAuth、不相關的端點，或模板化／自訂端點預設。

### Azure model-validation output budgets

Some Azure Responses deployments reject Claude Code's tiny model-switch validation budget.
If your deployment reports that `max_output_tokens` is below its minimum, configure
`minMaxOutputTokens` on that Azure provider to the minimum your endpoint requires (for
example, `16` for an endpoint that reports that minimum). This is opt-in: it raises every
smaller positive integer budget on that provider, not just validation requests. Larger
budgets are preserved, and other adapters do not apply this setting in this change.
Spend admission reserves the effective output budget before dispatch, including each Combo
target's prepaid send. A configured spend ceiling can therefore reject a request whose
raised output allowance would exceed that ceiling.

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

### Native Chat thinking replay

These Chat reasoning lists also apply to native `/v1/chat/completions` tool-call continuation.
The proxy preserves supplied `reasoning_content` and restores omitted reasoning from upstream
JSON or SSE responses using tool-call ids. Original reasoning replay requires a stable
`thread-id`, `session_id`, or `session-id` header on each request and the same provider, endpoint,
model and credential. The cache is process-local and bounded; a restart, expiry, eviction, or
missing conversation header uses the configured minimal placeholder instead. A placeholder
cannot reconstruct lost reasoning. Clients should retain upstream `reasoning_content` in their
assistant history for reliable resumed conversations.

When `preserveReasoningContentModels` is unset, DeepSeek Flash/Pro model names are recognized
across versions, including `deepseek-v4.1-flash`, namespaced ids and gateway suffixes. Explicit
lists remain authoritative: `preserveReasoningContentModels: []` disables automatic repair,
while `requiresReasoningPlaceholderModels: []` disables placeholders and still allows cached
original reasoning. Other model families require the preserve declaration.
Tool-enabled DeepSeek requests also require reasoning on earlier assistant answers without tool
calls. The configured placeholder fills these omissions; no original reasoning can be recovered
from the tool-call cache for those turns. Preserve their supplied reasoning for full fidelity.

## Auto-pause permanently refused accounts

`providers.<provider>.accountAutoPause` is opt-in and defaults to off. It applies to that
provider's OAuth accounts, Codex pool accounts (including the main account in pool mode),
and configured API-key pool entries. For example:

```sh
ocx config set providers.anthropic.accountAutoPause.enabled true
ocx config set providers.anthropic.accountAutoPause.consecutiveFailures 2
```

`consecutiveFailures` is an integer from 1 to 100; omitting it uses 2. Only exact,
account-scoped HTTP 401/403 refusals qualify: an organization forbidding OAuth, an inactive
or expired subscription, an account denied API/Claude Code access, or a downgrade to a free
plan with no credits. A model permission error, expired access token, quota window, 429,
5xx, malformed response or network failure never pauses an account.

The counter is process-local, serialized per account, and resets on a successful HTTP
response, explicit resume or a new login. Token refresh alone does not reset an OAuth
account's streak. Transient errors leave the counter unchanged. Restarting the proxy clears
counters; completed pauses, their fixed reason codes and timestamps persist. Independent
proxy processes maintain independent counters. Changing, disabling or re-enabling the policy, disabling the provider,
or changing its endpoint discards in-flight refusal observations, so a refusal from a request
sent under the earlier policy can never pause an account afterwards. A refusal counts only for the credential that actually
reached the upstream: when a local plugin rewrites the credential or destination of a send, that
send never counts toward a pause. For Codex pool accounts this includes the workspace
(`chatgpt-account-id`) the request was sent for.

At the threshold, OpenCodex excludes the account using its existing pause mechanism and
attempts an eligible sibling for the current request within the existing retry/send budget.
Fixed Codex account selectors and account-bound uploaded files retain their restrictions.
A pause never cancels already dispatched work or changes credentials. It emits one generic
log line without account identifiers or upstream error text.

`ocx account list <provider>` shows the pause reason. The dashboard's Paused badge exposes
the reason and time. Use `ocx account resume <provider> <account-id-or-alias>` to clear the
reason and allow selection again. On an API-key row, clicking Resume also activates the key.
This policy never resumes an account automatically.
