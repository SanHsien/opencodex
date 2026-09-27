---
title: "組合：failover 與負載平衡"
description: 將一個虛擬模型路由到多個供應商，以進行 failover 或加權負載平衡。
---

**combo** 是一個虛擬模型，背後代表一個有序的真實供應商/模型目標清單。你的客戶端請求 `combo/<id>`；opencodex 選擇一個目標，將請求改寫為該具體的 `provider/model`，並可在第一個目標發生可重試失敗時嘗試另一個目標。

這在你想要以下任一情況時有用：

- **Failover：** 偏好一個模型，但隨時備有後備。
- **負載平衡：** 以加權批次將成功請求分散到多個模型或供應商。

Combo 位於一般供應商路由之前。若 `provider/model` 選擇器對你而言是新的，請先閱讀[模型路由](/zh-tw/guides/model-routing/)。

## 60 秒快速入門

此範例建立 `combo/main`，Anthropic 在前、OpenAI 在後。兩個供應商必須已存在且已啟用。

```bash
ocx combo set main --targets anthropic/claude-opus-4-8,openai/gpt-5.6-sol
```

預設策略為 failover，因此正常請求會送往 `anthropic/claude-opus-4-8`。若該次嘗試發生可重試失敗，opencodex 可跳到 `openai/gpt-5.6-sol`。

在你平常會提供模型 id 的任何地方使用該虛擬模型：

```json
{
  "model": "combo/main",
  "input": "Explain why the sky looks blue."
}
```

確認已儲存的定義：

```bash
ocx combo show main
```

:::tip
從 failover 與等權重開始。只有在你刻意要分散流量時才切換到 round-robin，且只有在等量分配不適當時才加入權重。
:::

## Combo 名稱如何運作

`ocx combo set <id>` 中的 combo id 必須以字母或數字開頭。其後可含字母、數字、`.`、`_` 或 `-`，總長最多 64 字元。其規範模型 id 始終為 `combo/<id>`；例如 id `main` 變成 `combo/main`。

設定 combo 時，`combo/` 命名空間會被保留。名為 `combo` 的供應商無法佔用它，且 combo id 不能與已設定的供應商名稱重複。

可選的別名給 combo 一個不同的公開模型名稱。別名：

- 使用與 id 相同的字元；
- 可為裸名（例如 `daily-fast`），或含一個 `/`（例如 `team/daily-fast`）；
- 不能是 `combo` 或以 `combo/` 開頭；
- 不能與另一個 combo 別名重複；且
- 通常不能是以 `gpt-`、`o1-`、`o3-`、`o4-` 或 `codex-` 開頭的裸原生 OpenAI 系列名稱——下方明確的
  Desktop 相容模式是唯一例外。

即使設定了別名，規範的 `combo/<id>` 形式仍可解析。規範查詢在別名匹配之前執行，因此別名無法接管另一個 combo 的規範 id。

:::note
別名改變客戶端請求的公開名稱；不改變 combo 儲存的 id 或其背後的具體供應商/模型選擇器。
:::

## 切換 combo 後的 compaction

當客戶端在切換 combo 後使用裸模型名稱進行 compaction 時，opencodex 可以回想該對話線路上最近一次
成功完成的 combo。模型必須與已完成的回應相符，且該 combo 及其目標必須仍存在於目前設定中。之後的
請求會依正常的 combo 選擇與 failover 流程進行。

明確的供應商／combo 選擇器與已設定的 combo 別名優先於這項回想。失敗、未完成或已取消的回應不會
取代最後一次成功的選擇。回想是行程本機的，且以對話線路為單位，上限 256 條、保留 30 分鐘；它不會
儲存帳號憑證。若沒有可用的對話身分或有效的記憶狀態，則套用一般的 compaction 路由。重新啟動會
清除記憶狀態。

## Codex Desktop 原生 allowlist 相容性

某些 Codex Desktop 版本會在 app-server 已載入 `model_catalog_json` 之後，套用只允許原生的遠端
`available_models` allowlist。因此 `Nova1/codex-gpt-5.6-sol` 這類正常路由 id 在 CLI 可用，卻不會
出現在 Desktop 的選擇器中。這是上游的 [Codex Desktop bug](https://github.com/openai/codex/issues/19694)，
由 [opencodex #241](https://github.com/lidge-jun/opencodex/issues/241) 追蹤。

當你控制一個等效的路由目標時，combo 可以明確接管一個原生 slug：

```bash
ocx combo set nova-sol \
  --targets Nova1/codex/gpt-5.6-sol \
  --alias gpt-5.6-sol \
  --native-alias \
  --display-name 'Nova1 - codex-gpt-5.6-sol'
```

此模式刻意採 opt-in，而且必須同時具備 `--native-alias` 與非空的顯示標籤。別名必須是這個
opencodex 版本支援的原生模型 id 之一；僅有原生系列前綴不會被接受，因為移除時必須能恢復具權威性的
中繼資料。當路由目標的 discovery 回應只提供模型 id 時，相容性列會從它所取代的原生 id 補上缺少的
context、modality 與 reasoning 中繼資料。明確的目標限制仍然優先，因此這個 fallback 永遠不會提高
context 上限或覆寫已宣告的能力。它會改變精確路由的優先順序：`gpt-5.6-sol` 的請求會先解析到
`combo/nova-sol`，然後才是規範的 OpenAI 原生系列路由。目錄只包含一個帶所設定顯示標籤的裸列，
而不是重複的原生列與 combo 列。只會捕捉裸的 `gpt-5.6-sol` slug。帳號限定列（如
`main/gpt-5.6-sol`）與供應商限定列（如 `openai-apikey/gpt-5.6-sol`）仍是不同的 OpenAI 路由；
供應商限定的 API-key 路由永遠不會落到原生別名上。

可見性鍵依然明確：

- `combo/nova-sol` 把相容性 combo 從 discovery 中隱藏。
- `disabledModels` 中的裸 `gpt-5.6-sol` 項目仍然指休眠的原生 OpenAI 列；它不會隱藏目前擁有該
  公開 slug 的 combo。
- 只要仍設定至少一個原生別名，被停用的裸原生列就會從有效 Codex 目錄中省略，而不是保留為
  `visibility: "hide"`。這可以防止 Desktop 的 allowlist 復活不該顯示的列。Models 頁面仍會列出
  未被遮蔽的原生開關，重新啟用其中一個會恢復其保留或目前的原生中繼資料。

:::caution
原生別名刻意接管一個看起來像第一方模型的 id。只有在目標營運上等效、且誠實標示選擇器列時才使用它。
移除 combo 會在下次 sync 時恢復正常原生路由與目錄身份。
:::

## 選擇策略

### Failover：有序的主與後備

`failover` 依設定順序選擇第一個合格目標。當目標的供應商存在、已啟用、未冷卻中、且能處理任何特殊請求限制時即為合格。權重與 `stickyLimit` 不影響此策略。

給定此順序：

1. `anthropic/claude-opus-4-8`
2. `openai/gpt-5.6-sol`
3. `google/gemini-3-pro`

每個請求從 Anthropic 開始。Anthropic 的可重試失敗會將該請求移到 OpenAI；OpenAI 的可重試失敗可將它移到 Google。終端錯誤會立即停止，而不嘗試剩餘目標。

### Round-robin：平滑加權批次

`round-robin` 使用平滑加權輪詢。較大的目標權重讓該目標隨時間獲得較大份額，而不會將其所有份額一次送出為一長區塊。`stickyLimit` 控制在下次加權選擇前有多少成功請求留在所選目標上。

建立一個 2:1 combo，每兩個成功請求為一批：

```bash
ocx combo set balanced \
  --targets anthropic/claude-opus-4-8:2,openai/gpt-5.6-sol:1 \
  --strategy round-robin \
  --sticky 2
```

稱目標 **A**（權重 2）與 **B**（權重 1），前六次加權選擇為
`A, B, A, A, B, A`。因為 `stickyLimit` 為 2，每次選擇維持活躍兩個成功請求：

| 成功請求 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 目標 | A | A | B | B | A | A | A | A | B | B | A | A |

長期份額仍為 2:1。可重試失敗會結束目前 sticky 批次、冷卻該目標，並為同一請求選擇另一個合格目標。

:::caution
權重是相對的，不是百分比。權重 `2,1` 與 `200,100` 表達同一比例。偏好能傳達意圖的小數值。
:::

### Random：每個請求的加權抽選

`random` 針對每個請求抽選一個合格目標，中選機率與 `weight` 成正比。每個請求都是獨立抽選，因此流量會分散至各目標，同時不會呈現 `round-robin` 的確定性模式或黏著性。`stickyLimit` 不影響此策略。

### Least-used：優先選擇成功次數最少的目標

`least-used` 將每個請求路由至這個 opencodex 行程所記錄成功請求數最少的合格目標。重新啟動後，計數從零開始；若計數相同，則維持設定順序。權重與 `stickyLimit` 不影響此策略。

### Reset-window：跟隨最早的配額重設

`reset-window` 將每個請求路由至快取供應商配額快照顯示下一個時段最早重設的合格目標（五小時、每週、每月或自訂）。這會優先使用最早重新取得額度的供應商。沒有最新配額資料的目標，以及發生平手時，皆維持設定順序。權重與 `stickyLimit` 不影響此策略。

此排序與傳送前的供應商排除，需要適用於目前單一 API 金鑰全部模型推論的最新限額資訊。OAuth／目前帳戶摘要、轉送呼叫者憑證的路由、多金鑰，以及憑證或目的地位址已變更的快照，在這項預先判斷中僅供顯示。透過 `Authorization`、`x-api-key` 或 `x-goog-api-key` 標頭覆寫憑證時也適用相同規則；僅供搜尋或 MCP 使用的時段不參與判斷。若所有符合條件的目標都沒有適用的重設時間，則依設定順序選擇。實際帳戶選擇與重試仍套用一般限制。

### JEV：由決策引導的第一選擇

`jev` 會請 [TypeSafe JEV](https://console.typesafe.ai) 為目前請求選擇第一個合格目標與相容的
推理 effort。這是選擇加入的：新增 TypeSafe 憑證不會改變既有的模型、別名、預設值或 Combo 行為。
只有在你建立一個策略為 `jev` 的 Combo 之後，才會出現由 JEV 支援的模型。

最快的設定方式是：

1. 開啟 **Providers**，新增 **TypeSafe JEV**，輸入 TypeSafe API key，並測試連線。
2. 在該 provider 的 Overview 中選擇 **Create JEV Auto**。也可以在
   **Models → Combos** 底下使用相同動作。
3. 檢視預先填好的 Astra → Sol → Luna 目標。可在建立 Combo 前新增、移除、重新排序或替換它們。
   目前合格的第一列會標記為 fail-open 目標，每個已知的推理階梯也會顯示在其所在列旁邊。

此範本會建立 id 與別名皆為 `jev-auto` 的 Combo，使用 adaptive 推理能力，並維持為一般可編輯的
Combo。它不會成為預設模型。其目標即完整的允許清單：JEV 永遠不會選出清單之外的
provider/model 配對，而原始目標模型仍會出現在它們平常的選擇器分組中。

無頭設定時，請明確儲存金鑰，或參照 TypeSafe 環境變數：

```bash
ocx provider add jev --api-key "${TYPESAFE_API_KEY}"
```

當 provider 沒有已儲存的金鑰時，決策客戶端也接受直接使用 `TYPESAFE_API_KEY`，以及
`ocx provider add` 印出的標準 provider 衍生別名 `JEV_API_KEY`。

```json
{
  "providers": {
    "jev": {
      "adapter": "jev-decision",
      "baseUrl": "https://api.typesafe.ai/v1/systemone",
      "authMode": "key",
      "apiKey": "${TYPESAFE_API_KEY}",
      "liveModels": false
    }
  },
  "combos": {
    "jev-auto": {
      "alias": "jev-auto",
      "strategy": "jev",
      "reasoningEffortMode": "adaptive",
      "targets": [
        { "provider": "openai", "model": "gpt-6-astra" },
        { "provider": "openai", "model": "gpt-5.6-sol" },
        { "provider": "openai", "model": "gpt-5.6-luna" }
      ]
    }
  }
}
```

OpenCodex 會向固定的 `https://api.typesafe.ai/v1/systemone` 端點送出一個有邊界的決策請求，
使用模型 `jev-latest`。只有目前合格的已設定目標才會被提供給它選擇。JEV 會一起選出目標與
effort；effort 仍受該目標所公告的階梯限制。若選中的目標發生可重試的失敗，不會再次詢問
JEV——既有的 Combo 冷卻與 fallback 迴圈會繼續嘗試剩餘已設定的目標。

每次邏輯上的模型呼叫都各自決定，不會有整段對話的固定 pin。因此同一個 session 的連續輪次可能
落在不同的目標上，而每次切換都會啟動一次全新（冷）的供應商 prompt cache，所以混用差異很大的
目標可能反而比省下的還多花輸入 token。請把允許清單維持在你能接受互相輪替的目標範圍內。標記為
`lastResort` 的目標，在 `cooldownWaitPolicy: "before-last-resort"` 下，只要還有任何一般目標
可用就會被排除在 JEV 之外，只有在沒有其他目標可達時才會被提供。

當金鑰缺失、沒有可用的安全任務／工具／圖像決策狀態、四秒的決策期限已到、服務發生重新導向或
回傳錯誤，或回應格式錯誤或選了未列出的選項時，這個決策邊界會 fail open。在這些情況下，
OpenCodex 會使用目前合格的第一個目標，並在該目標支援時偏好 `medium`。呼叫者取消的情況不同：
它會取消這次決策與模型請求，而不是改派 fail-open 目標。

決策狀態刻意設有邊界：最多 500 字元的目前使用者任務、240 字元的前一則 assistant 尾段、
520 字元的最新工具輸出尾段、工具名稱，以及布林的圖像／工具訊號，可能會送給 TypeSafe。它不包含
JEV 憑證、請求標頭、原始圖像位元組、工具引數、加密推理內容與完整對話歷史。如果你不希望
TypeSafe 處理某些內容，請不要為它選擇 `jev-auto`。已識別的 OpenCodex 機器內容信封會從全部三個
文字樣本中移除，但一般的 assistant 與工具輸出文字並非經過機密掃描，仍可能包含敏感內容。
TypeSafe 聲明 Jev 不會用客戶請求進行訓練，但其條款並未為送出的狀態設定固定的保留期限，
且只有企業方案才提供零資料保留（[模型](https://docs.typesafe.ai/models)、
[法律條款](https://docs.typesafe.ai/legal)）。TypeSafe 也在文件中說明英文是 Jev 最準確的
語言，因此非英文工作的決策請先自行檢查再依賴它。日誌只包含選中的目標／effort、粗略的決策
關卡、延遲、可選的信心／機率，以及數值用量。自動化測試使用模擬的 TypeSafe 回應，加上一個
無金鑰 fail-open 的煙霧測試；真正呼叫 TypeSafe 的決策需要維運方自行提供金鑰，不會被隱含執行。

Combo 服務過請求之後，開啟 **Models → Combos → jev-auto → Stats** 即可檢視 JEV 的選擇，
而不會取代一般的模型選擇器或 Usage 頁面。該分頁會把 TypeSafe 決策 token 與實際模型傳送回報
的 token 分開呈現，並顯示決策關卡、fail-open 選擇、推理 effort、重試／fallback、快取
token、延遲、信心，以及每個模型 7 天、30 天或全部可用歷史的總計。統計資料來自本機的
只附加用量帳本；其中只包含上述有邊界的決策中繼資料，不含 prompt 或憑證。

## 目標失敗時會發生什麼

Combo 失敗分為**跳轉**失敗與**終端**失敗。

| 結果 | 行為 |
| --- | --- |
| HTTP 401、403、404、408、429 或任何 5xx | 冷卻目標並跳到下一個合格目標。 |
| HTTP 410，且帶有明確的模型終止使用、已退役、已棄用、已停用或不再提供的訊號 | 冷卻該目標並跳轉。不相關的 410 回應仍視為終端錯誤。 |
| 分類為認證、訂閱、配額、限流、過載或上游伺服器錯誤 | 冷卻目標並跳轉，即使單靠狀態碼不足。 |
| 客戶端取消（499）、`origin_rejected`、cyber-policy 拒絕、上下文溢出或其他無效請求 | 停止並回傳錯誤；另一個目標不會讓請求變為有效。 |
| 結構化 HTTP 400，明確拒絕 `user`、對 `reasoning.effort`/`reasoning_effort` 回傳不支援值，或回傳模型特定影像輸入拒絕（`param: input`） | 在輸出開始前跳轉到下一個符合條件的目標，且不記錄冷卻時間；參見下方選用參數相容性。 |
| 由行程內轉接器（`runTurn`）執行的 Responses 回合中，目前請求未宣告的第一個工具呼叫（在任何輸出與不可重播的副作用之前） | 讓該目標進入冷卻，並以相同的工具目錄跳轉到下一個目標。出現可見輸出或不可重播的副作用之後，拒絕即為最終結果。Chat Completions 與 Anthropic Messages 請求不受影響。 |
| 任何其他未分類錯誤 | 停止並回傳錯誤。 |

跳轉的目標預設進入 60 秒冷卻。若上游回應包含有效的 `Retry-After` 值，opencodex 改用它。接受數字秒與 HTTP-date 值。明確的上游 `Retry-After` 最長為 24 小時；重設推導、設定與預設冷卻最長為 10 分鐘。

### 最後手段目標

若不特別標記，偏好目標短暫冷卻時，路由會直接跳到清單中下一個目標——包括你原本只想在緊急狀況
才使用的目標。標記它，並告訴 combo 先等待：

```json
{
  "strategy": "failover",
  "cooldownWaitPolicy": "before-last-resort",
  "waitForCooldownMs": 10000,
  "targets": [
    { "provider": "provider-a", "model": "model-a" },
    { "provider": "provider-b", "model": "model-b" },
    { "provider": "provider-c", "model": "model-c", "lastResort": true }
  ]
}
```

設定該政策後，選擇會先嘗試一般目標。若它們只是在冷卻中，且最早的冷卻會在 `waitForCooldownMs`
之內到期，請求會改為等待那個到期，而不是直接派發最後手段目標。這個延遲與是否等待無關：只要有
任何一般目標可用，`lastResort` 目標就會被跳過，對每種策略皆是如此，而在 `round-robin` 或
`random` 下它完全不會加入輪替。`waitForCooldownMs` 只為冷卻中的一般目標加上等待，因此在預設值
`0` 時什麼都不等：一旦沒有一般目標可用，最後手段就會立即被使用。失敗一次之後，下一次選擇仍依
同一規則。

**這個政策永遠只是延後，不會扣留。** 當沒有任何一般目標可以到達——全部冷卻超過預算、已嘗試過，
或已被排除——最後手段目標會照常被派發。若政策能夠扣留它，就會把備援變成中斷，那比它想避免的
提前路由還糟。combo 的目標**全部**標記為 `lastResort` 時同樣適用：它會照常派發。

`lastResort` 在未設定 `cooldownWaitPolicy` 時是無作用的，兩者預設皆省略，因此既有 combo 不受
影響。只有精確字串 `before-last-resort` 才會啟用它。

目前請求絕不會重試同一個已嘗試過的目標。後續請求會略過冷卻中的目標，直到冷卻到期；請求層級目標
相容性的拒絕不會讓目標進入冷卻。已經過期的 `Retry-After` HTTP-date 同樣會被視為立即的上游指示，
如同 `Retry-After: 0`。設定 `waitForCooldownMs` 可讓後續請求等待最早合格目標的冷卻結束，每次選擇
嘗試最多等到該上限，然後再進行一次全新選擇。因此，跨越多次 failover 跳轉時，一個請求最多可能等待
`hops × waitForCooldownMs`。預設值為 `0`，代表當所有合格目標都在冷卻時立即以 HTTP 503 關閉失敗；
該 `combo_unavailable` 503 會帶有 `Retry-After` 標頭，其值等於最早剩餘冷卻時間，無條件進位到整數
秒且最少為 1。等待不會加入隨機抖動，因此可能出現同步喚醒。被中止的請求會取消這次等待，並回傳一般
的 `client_cancelled` 回應；取消後不會派發備援目標。combo 目標的冷卻是每個 combo 各自的行程本機
狀態，與原生帳號路由使用的帳號層級 Codex 配額冷卻是分開的。

:::note
Failover 是刻意受限的。它有助於目標特定的可用性、認證、配額與過載失敗；不會隱藏呼叫者錯誤或策略拒絕。
在非 combo 的 Responses 請求上，允許清單中的 xAI 政策 403 會在 Codex 將其當作傳輸失敗重試之前，改寫為 HTTP 200 `incomplete/content_filter`；參見 [xAI policy refusals](/zh-tw/reference/proxy-formats/#xai-policy-refusals)。Combo 跳轉仍把原始 HTTP 403 當作一次跳轉。
:::

對於串流請求，上游 HTTP 狀態不是最終決定。OpenCodex 會為所選子請求的 Responses SSE 緩衝一段有界
的輸出前置區段。若串流在任何文字、reasoning、工具呼叫或其他輸出事件之前，回報可重試的
`response.failed` 終止事件，該子請求會被記錄為失敗，combo 可以嘗試下一個合格目標。一旦任何輸出
事件開始，該目標即被視為已確定：之後的串流失敗會直接回傳給用戶端，絕不會在另一個供應商上重播，
以避免重複的文字與工具執行。若輸出前置緩衝區在沒有終止事件或輸出邊界的情況下達到其安全上限，
OpenCodex 同樣會確定使用目前目標，而不是無限成長記憶體。

## 請求層級目標相容性

在把 Claude Code 路由到規範的 ChatGPT Codex 後端時，OpenCodex 會移除不受支援的頂層 `user` 中繼
資料欄位，且不會改變 session/cache key、輸入訊息、工具 schema 或安全識別碼。公開的 Responses API
與非規範的 forward 閘道器仍保留該欄位。

當一個完整的 HTTP 400 `invalid_request_error` 明確拒絕 `user`、對 `reasoning.effort`/
`reasoning_effort` 回報 `unsupported_value`，或針對 `param: input` 回報精確的模型範圍
`does not support image inputs` 拒絕時，combo 同樣可以繼續嘗試下一個目標。這只代表該請求與該
目標不相符，不代表該目標不健康，因此不會記錄冷卻。這項相容性復原不會悄悄把 `none` 改成其他
effort 值，也不會把這個例外擴大到任意的無效請求。政策拒絕、取消與已經確定的輸出仍然不可重播。
單一目標的請求仍會回傳未解決的上游拒絕。

## 預設推理 effort

當 combo 設定非 null 預設值且目標支援清單已知且非空時，`defaultEffort` 會補入省略的 `reasoning.effort`。目標支援設定值時保留該值，否則選擇不高於設定值的最高支援層級；若沒有更低層級，則使用最低支援層級。未知或空清單不會注入預設值。

預設值補入會保留既有 effort 與其他 reasoning 欄位。下述能力正規化可另外移除不支援的 effort/thinking 控制。預設值支援 `low`、`medium`、`high`、`xhigh`、`max`、`ultra`；省略欄位或設為 `null` 可關閉注入。

### 混合能力群組（`reasoningEffortMode`）

combo 公開的 effort 層級是其所有目標公開層級的交集。明確宣告**沒有** effort 控制的目標也會參與
這個交集運算，所以只要有一個不支援 effort 的後備目標，就會清空整個 combo 的 effort 選擇器——
即使其他目標確實支援調整也一樣。

把 `reasoningEffortMode` 設為 `"adaptive"`，可以改為在計算公開交集時排除那些空清單。選擇器接著
會顯示其餘目標共有的層級，而那個不支援 effort 的目標仍保有被路由的資格。清單狀態單純*未知*的
目標，在兩種模式下都會被當成萬用字元處理。

```json
{
  "combos": {
    "mixed": {
      "targets": [
        { "provider": "openai-apikey", "model": "gpt-5.6-luna" },
        { "provider": "local", "model": "no-effort-model" }
      ],
      "reasoningEffortMode": "adaptive"
    }
  }
}
```

預設值是 `"strict"`，維持原本的選擇器行為。這項設定不會改變目標順序或 failover 政策。在派發時，
明確為空的目標清單，無論在哪種模式下都會移除不支援的 effort/thinking 控制，同時保留受支援的非
effort reasoning 欄位（例如 `reasoning.summary`）；`"adaptive"` 會對未知的目標能力套用相同的
正規化處理，而已知且非空的目標則維持其既有的個別 effort 解析方式。在儀表板中，這是 combo 的
Capabilities 區段裡的 **Adaptive reasoning ladder** 開關。

## 圖像／多模態能力

依預設，combo 會公開其所有目標輸入模態的**交集**（只有當每個目標都宣告支援圖像時，圖像才會被
啟用）。將 `imageInput` 設為 `"disabled"` 可強制純文字，即使每個目標都支援圖像——目錄會從
`inputModalities` 中移除 `image`，且帶有圖像的請求會在呼叫任何目標之前就以 HTTP 400 被拒絕。
`"auto"`（或省略此欄位）維持自動交集。

## 加密的 v2 子代理任務

Codex v2 子代理有一個重要限制（[issue #92](https://github.com/lidge-jun/opencodex/issues/92)）。原生父代只能將新生成 worker 的任務以為原生 ChatGPT 後端鑄造的密文發送。外部供應商無法讀取該 payload。

對於此類請求，combo 將其合格目標過濾為規範的原生 ChatGPT 路由，包括可重試失敗之後。若 combo 無可解密目標，opencodex 在分派前停止並回傳 HTTP 400：

```json
{
  "error": {
    "type": "invalid_request_error",
    "code": "unreadable_encrypted_agent_task"
  }
}
```

這保護任務不被送往一個會收到無法讀取指令的供應商。可讀的明文任務使用正常 combo 策略。

你有四個恢復選項：

1. 為子任務選擇原生 ChatGPT 模型。
2. 在 combo 中新增規範的原生 ChatGPT 目標。
3. 對跨不同供應商的委派使用 v1 介面。
4. 若你控制呼叫者，將任務以明文 v2 `agent_message` 內容重送。

關於 v1/base/v2 模式與完整的加密任務工作流程，請見[子代理介面](/zh-tw/guides/sub-agent-surface/)。

## 管理 combo

### 儀表板

開啟本機儀表板並選擇 **Combos**。該工作區可建立、編輯、重新命名與移除 combo，且其目標 picker 會排除已停用的模型與巢狀 combo。

每個目標也會顯示即時額度徽章：**可用**、**額度已用盡**或**額度未知**。只有當每個可用目標均有目前有效的伺服器確認，顯示其所設定憑證的推論限額已耗盡時，編輯器才會因配額而停用儲存與建立。僅供顯示的帳戶、模型、搜尋與 MCP 配額，以及缺失或已過期的路由依據，都不會觸發此限制。此限制會在適用的重設時間或資料有效期限結束時解除，並在頁面變為作用中或可見狀態時重新檢查；重新整理會同時重新載入 Combo 資料與配額。儀表板編輯器目前尚未公開 `cooldownMs` 或 `waitForCooldownMs`；在後續 UI 工作完成前，請使用設定檔或管理 API。

### CLI

主要指令為：

```bash
ocx combo list
ocx combo show <id>
ocx combo set <id> --targets provider/model[:weight],...
ocx combo remove <id> --yes
```

`set` 也接受 `--strategy`、`--sticky`、`--effort`、`--alias`、`--native-alias`、
`--display-name` 與 `--rename-from`。用 `-` 作為 `--effort`、`--alias` 或 `--display-name` 的值
可清除該欄位。`--native-alias` 需要一個目前受支援的裸原生模型別名，並搭配非空的顯示名稱。
`create` 與 `update` 為 `set` 的別名；`delete` 為 `remove` 的別名；且相同子指令在
`ocx route combo` 下也可用。

### 管理 API

無頭客戶端在 `/api/combos` 上使用 `GET`、`PUT` 與 `DELETE`。`GET` 列出規範化的 combo 定義，`PUT` 建立或取代一個（且可重新命名一個），`DELETE` 接受 id 查詢參數。認證與請求/回應細節請見
[管理 API 參考](/zh-tw/reference/management-api/)。當 `PUT` 主體省略 `cooldownMs` 或
`waitForCooldownMs` 時，API 會保留該 combo 已儲存的值；要變更時請明確傳送新值。明確設定的
`cooldownMs`（即使是 `60000`）會原樣持久化，因為它會覆寫請求速率退回值。已儲存的 `cooldownMs`
只能透過編輯設定檔來移除；由於精簡序列化器會省略預設值，當 `PUT` 明確傳送 `0` 時，
`waitForCooldownMs` 會重設為其預設值。省略這兩個欄位會保留原值，且儀表板目前尚未公開它們。

完整的持久化設定請見[設定](/zh-tw/reference/configuration/)。

## 設定參考

Combo 儲存於頂層 `combos` 物件中，以 combo id 為 key：

```json
{
  "combos": {
    "balanced": {
      "targets": [
        { "provider": "anthropic", "model": "claude-opus-4-8", "weight": 2 },
        { "provider": "openai", "model": "gpt-5.6-sol", "weight": 1 }
      ],
      "strategy": "round-robin",
      "stickyLimit": 2,
      "defaultEffort": "high",
      "alias": "team/balanced"
    }
  }
}
```

| 欄位 | 必填 | 預設值 | 規則 |
| --- | --- | --- | --- |
| `targets` | 是 | — | 已設定 `{ provider, model, weight? }` 目標的非空有序陣列。重複的供應商/模型對會被拒絕。 |
| `targets[].weight` | 否 | `1` | 1 到 10,000 的整數。由 `round-robin` 與 `random` 使用；`failover`、`least-used` 與 `reset-window` 忽略。 |
| `strategy` | 否 | `"failover"` | 可用值為 `"failover"`、`"round-robin"`、`"random"`、`"least-used"`、`"reset-window"`、`"jev"`。JEV 只決定第一個符合條件的目標與 effort；後續嘗試由一般 Combo fallback 處理。 |
| `stickyLimit` | 否 | `1` | 僅適用於 `round-robin`：每次選擇的成功請求數，1 到 100 的整數。 |
| `cooldownMs` | 否 | 未設定 → 上游退回值（請求速率 429 代碼 `1302`/`1305` 為 5 秒，否則為 60 秒） | 1 到 600000 的整數。設定時，會在沒有可用的上游 `Retry-After` 或 Codex reset 訊號時套用為每個目標的冷卻時間，包含請求速率 429；未設定時使用上游退回值。 |
| `waitForCooldownMs` | 否 | `0` | 0 到 600000 的整數。回傳 `combo_unavailable` 之前，等待最早合格冷卻目標的最長時間；中止會取消等待。 |
| `defaultEffort` | 否 | `null` | `low`、`medium`、`high`、`xhigh`、`max` 或 `ultra`；僅在呼叫者省略 effort 且目標宣告支援時套用。 |
| `reasoningEffortMode` | 否 | `"strict"` | `"strict"` 會取所有已知目標清單的交集，所以只要有一個目標宣告沒有 effort 控制，就會清空整個 combo 的選擇器。`"adaptive"` 會在計算公開交集時排除那些空清單。派發時，明確為空或 adaptive 下未知的清單都會移除不支援的 effort/thinking 控制，同時保留受支援的非 effort reasoning 欄位（例如 `reasoning.summary`）；已知且非空的目標則維持既有的 effort 解析方式。 |
| `imageInput` | 否 | `"auto"` | `"auto"` 或 `"disabled"`。`"auto"` 只在每個目標都支援圖像時才公開圖像支援；`"disabled"` 強制純文字（從公開模態中移除 image，並在派發前拒絕帶圖像的請求）。 |
| `alias` | 否 | 無 | 可選的修剪後公開模型 id；使用上述別名規則。空值儲存為無別名。 |
| `nativeAlias` | 否 | `false` | 明確允許目前受支援的裸原生 `alias` 取得路由與目錄的優先權。絕不會從別名自動推斷。 |
| `displayName` | 否 | 無 | 有長度上限、僅供顯示的目錄標籤。當 `nativeAlias` 為 `true` 時為必填且不可為空。 |

## 疑難排解

### 為什麼 `combo/<id>` 回傳 404？

Combo id 未知。回應為 HTTP 404 並帶 type `invalid_request_error`。執行 `ocx combo list`、檢查拼字與大小寫，並確認你的管理指令寫入的是同一個接收模型請求的執行中 opencodex 實例。

### 為什麼我得到 `combo_unavailable`？

每個目標目前都不合格：例如其供應商已停用、冷卻中、已為此請求嘗試過，或加密 v2 任務排除它。檢查目標供應商狀態與近期上游錯誤。對於冷卻，等待 60 秒預設或上游 `Retry-After` 期間（明確的上游 `Retry-After` 最長 24 小時，其他冷卻最長 10 分鐘），然後重試。

### 為什麼我的別名被拒絕？

先檢查別名文法與保留名稱。重複別名或無效形狀以 HTTP 400 拒絕；第一段為已設定 Codex 帳號命名空間的斜線別名以 HTTP 409 拒絕；請選擇不同的別名命名空間。CLI 與儀表板會顯示伺服器的精確驗證訊息。

### 為什麼 failover 在第一個錯誤後就停止了？

該錯誤是終端的而非目標特定的。修正無效輸入、縮減過大的上下文、處理策略拒絕，或更正被拒的請求來源。Combo 對那些情況不會跳轉。
