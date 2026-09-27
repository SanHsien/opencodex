---
title: 模型排序
description: opencodex 如何確定 Codex 模型選擇器和 spawn_agent 模型 override 的順序。
---

Codex 模型選擇器不會保留 opencodex 設定中 provider 的宣告順序或模型陣列順序。最終順序由目錄
priority 決定；priority 相同的路由模型則使用確定性的字母順序。

## Codex 應用的規則

Codex 的 models-manager 按 `priority` 升序排列選擇器中可見的目錄條目。目錄陣列本身的順序會被
丟棄，因此在生成的 JSON 陣列中把某個條目前移，並不會讓它在選擇器中前移。該約束直接記錄在
`src/codex/catalog/sync.ts` 中。

因此，opencodex 透過分配更低的 priority 控制置頂位置，而不依賴陣列位置。除非另有說明，以下
固定 priority 與範例描述的是沒有符合條件的 Codex 帳號選擇器（selector）的目錄。當存在 `N` 個
符合條件的選擇器時，精選（featured）priority 會以 `N` 作為間隔：設定排名為 `i` 的裸原生選擇
會展開成多列 selector 列，priority 為 `i * N + j`（`j` 是該 selector 從零開始的位置）；路由
選擇使用 `i * N`；精確指定 selector 的選擇則對該 selector 使用 `i * N + j`。未被選中的路由列
會被移到這些 selector 群組之外。Codex 仍然只公佈前五個選擇器中可見的列。

在未啟用完整選擇器排序的情況下，相關的 priority 如下：

| 目錄條目 | Priority | 來源 |
| --- | ---: | --- |
| `subagentModels[i]` | `i`（`0` 至 `4`） | `src/codex/catalog/sync.ts` 中的 featured rank map |
| 其他路由模型 | `5` | `src/codex/catalog/sync.ts` 中建立路由條目的邏輯 |
| 列在 `modelPickerOrder` 中的非精選路由模型 | `1000 + i` | `src/codex/catalog/sync.ts` 中僅供顯示用的選擇器排名邏輯 |
| 預設原生 GPT slug | `9` | `src/codex/catalog/sync.ts` 中建立原生條目的邏輯 |
| 存在 featured 列表時未選中的原生模型 | 至少為 `featured.length + 100` | `src/codex/catalog/sync.ts` 中合併原生目錄的邏輯 |

管理 API 在 `src/server/management/agent-settings-routes.ts` 中使用 `slice(0, 5)`，把
`subagentModels` 限制為最多五項。這與 Codex `spawn_agent` 介面只公佈前五個模型 override 的行為
一致。五項之外的模型仍可繼續顯示在主選擇器中，也可透過精確 id 呼叫。

## Priority 相同時如何排序

所有普通路由模型的 priority 都是 `5`，因此需要處理並列順序。在建立目錄條目之前，
`gatherRoutedModels()` 會先按 provider 名稱、再按模型 id 對路由模型列表進行字母排序
（`src/codex/catalog/provider-fetch.ts`）。

因此，以下設定順序不會影響最終順序：

- `providers` 物件中各 key 的宣告順序；
- 每個 provider 的 `models` 陣列中各 id 的排列順序。

隨後，`orderForSubagents()` 使用穩定排序，把 featured 模型按 `subagentModels` 中的順序移到最前。
非 featured 模型會保持之前確定的 provider/id 字母相對順序
（`src/codex/catalog/sync.ts`）。建立條目時，featured rank 還會轉換為 `0` 至 `4` 的
priority，因此 Codex 的 priority 排序會保留這個開頭序列。

## 可見性與排序彼此獨立

`selectedModels` 和 `disabledModels` 只決定暴露哪些路由模型，不控制排序。
`filterCatalogVisibleModels()` 會把兩類選擇轉換為 `Set` 查詢，並在不把陣列當作 rank 的情況下過濾
已收集的列表（`src/codex/catalog/provider-fetch.ts`）。

因此，調整 `selectedModels` 或 `disabledModels` 的陣列順序不會改變模型在選擇器中的位置，只會
影響模型是否包含在內。

## 最終選擇器順序

在沒有符合條件的帳號 selector、且 featured 列表非空時，最終順序為：

1. 嚴格按照設定的 `subagentModels` 順序排列，priority 為 `0` 至 `4`；
2. 所有剩餘路由模型，先按 provider、再按模型 id 的字母順序排列，priority 為 `5`；
3. 在目錄合併過程中被移到 featured 區塊之後的未選中原生模型。

如果沒有 `subagentModels`，路由模型保持 priority `5`，原生 GPT 條目使用正常 priority
（opencodex 建立的條目通常為 `9`），路由組內部仍按 provider/id 字母排序。

## 示例

假設 `subagentModels` 按以下順序包含五個 id：

```toml
subagentModels = [
  "gpt-5.5",
  "opencode-go/glm-5.2",
  "anthropic/claude-opus-4-6",
  "gpt-5.6-sol",
  "gpt-5.6-terra",
]
```

選擇器開頭的實際順序如下：

| 選擇器位置 | 模型 | Priority | 出現在此處的原因 |
| ---: | --- | ---: | --- |
| 1 | `gpt-5.5` | `0` | 第一個 `subagentModels` 選擇 |
| 2 | `opencode-go/glm-5.2` | `1` | 第二個選擇，即使其 provider 在字母順序上位於 `anthropic` 之後 |
| 3 | `anthropic/claude-opus-4-6` | `2` | 第三個選擇 |
| 4 | `gpt-5.6-sol` | `3` | 第四個選擇 |
| 5 | `gpt-5.6-terra` | `4` | 第五個選擇 |
| 6 | `anthropic/claude-fable-5` | `5` | 剩餘路由模型中按 provider/id 字母排序的第一項 |
| 第 7 項起 | 其餘路由模型 | `5` | 先按 provider 字母排序，再按模型 id 字母排序 |
| 路由模型之後 | 其餘原生模型 | `featured.length + 100` 或更高 | 未選中的原生模型移到 featured 區塊之後 |

前五個條目是向 `spawn_agent` 公佈的 override，其餘模型繼續按普通選擇器順序排列。當存在帳號
selector 時，五項上限是在裸原生選擇展開成 selector 限定的群組之後才套用的。

## 更改順序

使用 `subagentModels` 選擇並排序 Codex 也會公佈給 `spawn_agent` 的前導模型。儀表板的
**Sub-agents** 頁面可以重新排列裸原生與路由 id。要精確指定
`<selector>/<native-openai-model>` 這類選擇，請使用 `ocx agent subagents set` 或直接編輯
opencodex 設定；一旦儲存，儀表板會保留這些 id，包括目前不可用的選擇。最多使用五個設定的 id。
在有帳號 selector 的情況下，一個裸原生選擇可能展開成多列 selector 限定的目錄列，所以設定的
選擇數與公佈出來的列數不必然是一對一。

如果沒有任何已設定的帳號支援某個受帳號限制的原生模型，請求會以「無效模型選擇」失敗。如果
支援的帳號存在，只是暫時額度用盡或無法使用，則會以「可重試的速率限制」失敗。這些狀態絕不會
被回報成「無效 API 金鑰」；請改選其他可用模型，或等待具備能力的帳號額度視窗重新開啟。

使用 `modelPickerOrder` 為 featured 區塊之外的路由 `<provider>/<model>` 列做純顯示用的排序：

```json
{
  "modelPickerOrder": [
    "tyler/deepseek-v4-flash",
    "jd-chat/kimi-k3",
    "jd-chat/glm-5.2"
  ]
}
```

列出的路由列會依設定順序出現。陣列中省略的路由列會保留正常 priority，因此仍排在
`modelPickerOrder` 的顯示區間之前；想控制相對位置的每個路由列都要列進去。同時列在
`subagentModels` 中的列會保留其 featured priority。若清單只包含路由列，原生列會維持正常
位置。

要對整個選擇器排序，請加入一個裸原生 id：

```json
{
  "modelPickerOrder": ["gpt-5.6-sol", "opencode-go/glm-5.3"]
}
```

列出的項目按陣列順序排在最前面，未列出的項目隨後按原有優先級排列。比對使用精確的目錄 ID：
`gpt-5.6-sol` 和 `openai/gpt-5.6-sol` 是不同的列。同一路由 ID 的原始寫法和編碼寫法也可比對，
但精確比對優先於等價比對。空項目會被忽略。帳號限定列必須使用包含 selector 的完整 ID。

### 遷移提醒：現有列表中的原生 ID

以前 `modelPickerOrder` 中的裸原生 ID 會被忽略。現在，現有列表只要包含這類 ID，就會啟用
整個選擇器的排序，包括置頂列。要保留以前只調整路由列的行為，請移除裸 ID。
未設定、空列表以及只有路由 ID 的列表都保留原有行為；OpenCodex 按原有優先級計算指引候選的
邏輯不變。

`modelPickerOrder` 保留 OpenCodex 按原有優先級計算最多五個偏好候選項的規則，供子代理指引使用。
每個移動列的原有優先級與原生 `priority` 分開儲存；僅改變選擇器順序不得改變這項計算結果。
它也不會限制以精確模型名稱指定 override 的資格：公佈的列表不是允許清單，既有的驗證、模型、
effort 與後端限制仍然適用。

原生 Codex 按原生 `priority` 排序，從符合條件且在選擇器中可見的模型中取前五個，公佈在
`spawn_agent` 中。這適用於 V1，以及開放模型 override 的 V2。因此，即使 OpenCodex 的偏好候選項
不變，原生公佈的五個模型仍可能隨選擇器順序改變。V1 不接收 OpenCodex 注入的偏好模型列表。
V2 在用戶端目錄狀態允許時，可以額外接收基於原有優先級的 OpenCodex 指引；這些指引不會重排
原生工具公佈的列表。

`disabledModels` 和各供應商的 `selectedModels` 仍是可見性欄位，不是排序控制項。沒有獨立的
`modelOrder`、`providerOrder` 或優先級對應表設定。

## 儀表板排序預設

在 **Models** 選擇 **Default**、**A–Z by model**、**Group by provider** 或 **Most used snapshot**，
然後**套用順序（Apply order）**。這會儲存目前可見的路由 id 與 `modelPickerOrderMode`
（`alphabetical`、`provider` 或 `most-used`）。Most used 套用時只讀取一次保留的全部用量；重新
載入時會還原快照，不會再抓一次用量。新增或移除模型不會自動重新計算它。手動儲存的順序（包括
完整／原生順序）會維持不動，直到你明確套用替換為止。即使沒有可用的路由模型，Default 也能清除
這兩個欄位。

這些控制項使用 `GET/PUT /api/subagent-models`：`chosen` 與 `available` 保留已儲存的 roster
選擇，包括已停用或遺失的模型；`pickerAvailable` 只包含符合條件的路由目錄 id。Models 頁只會送出
`pickerOrder` 與 `pickerOrderMode`，絕不送出 `models`。只儲存 roster 不會影響排序設定。無效的
合併更新與持久化失敗都會保留先前的排序／roster 狀態。

只調整路由順序的預設會保留既有的 featured／原生 priority 區間。它們會影響 Codex 目錄與
Claude 探索清單的路由群組；Claude 的原生前綴，以及明確的 Desktop profile／alias 歸屬不變。
OpenCodex 的指引排名與已設定的 fallback 設定會被保留，但原生 Codex 公佈的前五名與建議的
預設模型可能隨顯示 priority 改變。儲存不會重新啟動用戶端；目錄更新可能仍在等待中，持有舊目錄
的用戶端可能需要重新開啟。

### 自訂路由順序

在 Models 選擇**自訂順序**以載入一份全新的路由快照。把可移動的列拖曳到另一列之前，或使用
它的上／下按鈕，然後**儲存草稿**。精選（featured）路由列會維持在最前面、依設定的排名固定，
無法移動。原生列不會顯示；這不是完整原生選擇器的預覽。保留下來的已儲存列會維持相對順序，
新加入的候選則依目前的候選清單排列。每次儲存都會送出完整的路由清單，且不會變動精選名單。

包含裸原生 ID 的順序會維持受保護狀態，直到你明確套用某個路由預設或 Default 為止。單純選擇
另一個選項本身不會取代它。未知的精選狀態會阻擋編輯。儲存前，編輯器會檢查一份最新快照；有
變動時會保留你的草稿並阻擋儲存，直到**重新載入並捨棄草稿**載入目前設定為止。請求失敗時會
保留草稿。已接受的儲存仍可能有待處理的目錄更新；再次編輯前請先重新載入。

編輯器也要求每個路由候選都要有明確的模型識別。如果模型目錄不完整，請先重新整理 Models 頁
再編輯；只重新載入選擇器設定無法補回遺失的目錄識別。精選選項會採精確比對、不會修剪空白；
重複的選項會採用最後一次設定的位置，且規範 ID 優先於原始 ID。
</content>
