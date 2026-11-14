---
title: 子代理介面（v1 / base / v2 / v2-plaintext）
description: 全域控制 Codex 在所有模型上生成和管理子代理的方式。
---

## 什麼是子代理

子代理是主代理為了專注任務而建立的一個獨立 Codex worker。它有自己的 context 與工具，因此多個
獨立任務可以平行執行。opencodex 控制哪些 Codex 協作介面會暴露這些 worker、Codex 為它們提供哪些
模型，以及失敗的模型如何回退。它不會決定你的主代理何時必須委託。

## 模式

選擇**新工作階段**要使用的模式。既有工作階段會維持它們啟動時所用的介面。

| 模式 | Codex 取得什麼 | 適合誰選擇 |
| --- | --- | --- |
| **v1**（全新安裝的預設值） | `multi_agent_v1` | 使用經典的名稱空間代理工具，以及 `send_input` / `close_agent` / `resume_agent`。`spawn_agent` 的模型覆蓋可以在其他模型上生成子代理。 |
| **base** | 上游固定值 | 恢復上游模型的固定值：gpt-5.6-sol、gpt-5.6-terra 和 gpt-6.1-terra 使用 v2，gpt-5.6-luna 使用 v1；未固定的模型遵循 Codex 的 `multi_agent_v2` 功能開關。生成行為取決於該模型最終使用的介面。 |
| **v2** | `multi_agent_v2` | 使用扁平的 `spawn_agent` 工具、併發會話，以及 `send_message` / `followup_task` / `wait_agent` / `interrupt_agent`。全量歷史 fork 時子代理繼承父模型；`fork_turns: "none"`（或部分 fork）時接受 `model` / `reasoning_effort` 覆蓋。如果原生→路由子代理只收到後端加密的任務內容，未明確信任的外部路由會回傳 `unreadable_encrypted_agent_task`；明確信任的直接金鑰驗證 Responses 路由可以原樣接收，而混合組合仍優先選擇可解密的原生目標（[#92](https://github.com/lidge-jun/opencodex/issues/92)）。 |
| **v2-plaintext** | V2 | 為新工作階段選擇 V2、關閉全域強制，並以明文傳遞符合條件的工作。進入需要 `--acknowledge-plaintext-agent-messages`。 |

## 運作原理

所選模式會控制 Codex 讀取的每個目錄條目中的 `multi_agent_version` 欄位：

- **v1** 會在每個模型上標記 `multi_agent_version = "v1"`。
- **base** 恢復上游 pin。未 pin 的條目遵循原生 `multi_agent_v2` 功能旗標。
- **v2** 會在每個模型上標記 `multi_agent_version = "v2"`，但啟用**讓 ChatGPT 保持 v1**時例外：
  ChatGPT 原生列維持 `"v1"`，路由或 combo 列維持 `"v2"`。

- **v1 模式**：強制所有條目使用 `multi_agent_version = "v1"`，覆蓋上游固定值。
- **base 模式**：恢復上游預設值。已固定的模型使用快照值；未固定的模型不寫入該欄位，交由 Codex 功能開關決定。
- **v2-plaintext 模式**：為新工作階段將所有目錄條目固定為 V2，關閉全域強制並啟用合格請求的明文編譯。
- **v2 模式**：強制所有條目使用 `multi_agent_version = "v2"`，覆蓋上游固定值；但啟用 **讓 ChatGPT 保持 v1** 時例外：ChatGPT 原生條目維持 `"v1"`，路由/組合條目仍為 `"v2"`。

對於 v2 名冊，資格有三種狀態：標記為 `"v2"`、明確設為 `null`，或沒有 `multi_agent_version`
欄位的條目都合格。真正的 `"v1"` pin 會被排除，因為它宣告該模型屬於另一個協作介面。

## `spawn_agent` 列出哪些模型

Codex 在 `spawn_agent` 工具說明中最多列出五個模型，並由 Codex 自己挑選：它將選擇器中可見的目錄列依 `priority` 由小到大排序，取前五個。**Subagents** 頁面上的名冊（`subagentModels`）只能透過依名冊順序為其中的模型指定最低的 priority（沒有帳號選擇器時為 `0` 到 `4`）來影響這份清單，不會將清單限制在名冊之內。

如果只設定一到四個模型，Codex 會依 priority 以接下來的列填滿其餘位置。這些列不是你選的，儀表板也不會顯示是哪些模型。實際是哪些列取決於目錄：

| 目錄 | 填補其餘位置的列 |
| --- | --- |
| 沒有 Codex 帳號選擇器 | 其他路由的 `provider/model` 列。它們的 priority 都是 `5`，因此依 provider 名稱、再依模型 id 的字母順序排列。未設定的原生 GPT 列的 priority 不低於 `100` 加上已設定 id 的數量，因此排在後面。 |
| 有 Codex 帳號選擇器 | 帳號限定的原生列（`<selector>/<native-model>`），緊接在已設定的列之後。未設定的路由列移到 priority `1005`，排在它們之後。 |

例如，沒有帳號選擇器且名冊如下時：

```json
{ "subagentModels": ["xai/grok-4.5", "anthropic/claude-sonnet-5"] }
```

| 位置 | 模型 | Priority | 原因 |
| ---: | --- | ---: | --- |
| 1 | `xai/grok-4.5` | `0` | 名冊第一項 |
| 2 | `anthropic/claude-sonnet-5` | `1` | 名冊第二項 |
| 3 | `deepseek/deepseek-v4-flash` | `5` | 依字母順序第一個剩餘的路由列 |
| 4 | `google/gemini-3-pro` | `5` | 下一個路由列 |
| 5 | `moonshot/kimi-k3` | `5` | 下一個路由列 |
| 6+ | `zai/glm-5.2`，接著是原生 GPT 列 | `5`，接著是 `102 + sourcePriority` | 不在前五之內 |

名冊為空時，opencodex 不固定任何列，前五個依目錄原有的 priority 決定。

被填補的位置與一般列出的模型相同，主代理可能會選用它們。這份清單也不是允許清單：主代理寫出確切名稱時，Codex 也接受前五之外的目錄模型。若要控制 Codex 列出的模型：

- 設定五個模型。名冊滿了就沒有可填補的位置。
- 對於永遠不想被提供的模型，將其停用，或不放進其 provider 的 `selectedModels`。已停用或未選取的模型會離開選擇器，不會填補位置。
- `modelPickerOrder` 會改變 Codex 排序所用的 priority。只含路由列的清單會將列出的未設定列移到 `1000` 以上，因此未列出的路由列會先填補位置。包含裸原生 id 的清單會為整個選擇器排序（包括已設定的列）：列出的列排在前面，先於任何未列出的列佔用列出位置。參見 [Model ordering](/zh-tw/guides/model-ordering/)。

在 v2 上，Codex 會在取前五個之前略過固定為 `"disabled"` 的列；其餘機制相同。opencodex 的 v2 指引名冊（`{{roster}}`）只列出位於前五之內的已設定名冊模型，因此填補的模型只會出現在 Codex 的工具說明中，不會出現在 opencodex 指引裡。Codex 在工作階段開始時讀取目錄，因此名冊的變更從新的工作階段開始生效。

## 委託模型與推理強度

儀表板的 **子代理委託** 控制三個相關設定：

- `injectionModel` 是 opencodex 指引中點名的偏好 worker 模型。
- `injectionEffort` 是為該模型要求選用的 `reasoning_effort`。
- `injectionPrompt` 取代內建的 v2 指引文字。

`multiAgentGuidanceEnabled` 預設開啟，是 opencodex 撰寫的指引在兩個介面上的主開關。關閉它會同時
抑制 v2 指定區塊與 v1 主動文字。

對於陣列形式的無狀態 Responses 請求，opencodex 會把產生的指引放在開頭的 system 與 developer
中繼資料（包括 developer 的 `additional_tools`）之後、對話輸入之前。有狀態的 `previous_response_id`
續接，只有在符合其受信任重播前綴中最新的標記項目時，才會重複使用帶標記的指引。其他產生的指引，
只有在該前綴中存在完全相符的產生 developer 項目時才會被重複使用。當指引變更時，開頭的工具協定
會保持在最前面，替換內容會插入在目前對話輸入之前。

這些是給主代理的指示，不是 proxy 端的 spawn 路由器。在 v2 上，全量歷史 fork 會繼承父模型並拒絕
模型或 effort 覆蓋。因此指引會告訴 Codex 在傳遞 `model` 或 `reasoning_effort` 時使用
`fork_turns: "none"`（或正數的部分回合數，例如 `"3"`），並讓任務訊息自足。

自訂 `injectionPrompt` 文字可以使用全部四個佔位符：

| 佔位符 | 取代為 |
| --- | --- |
| `{{model}}` | 本次請求的有效偏好模型。裸的原生 `injectionModel` 只有在請求本身指向明確的帳號選擇器時才以帳號限定。無法解析或歧義的裸值會變成空字串；無法解析的明確帳號限定或路由 id 保持不變 |
| `{{effort}}` | 設定的 `injectionEffort`，或空字串 |
| `{{roster}}` | 解析出的 picker 可見、介面相容名冊 |
| `{{fallback}}` | 設定的全域 fallback 指引 |

內建 v2 指引有 700 字元的預算。若會超過預算，opencodex 會先丟掉名冊而不是截斷核心 spawn 指示。
內建指引只在偏好模型、合格名冊或 fallback 鏈解析成功時觸發。設定了 `injectionModel` 就足以渲染
自訂提示詞；若裸值無法唯一解析，`{{model}}` 會展開為空字串。

在 v1 上，opencodex 只在 `max` 或 `ultra` 推理強度下注入與 v2 建議預設相同的主動委託指引。
僅改變委託的觸發條件：不再需要另外提出委託請求；使用者指示以及權限、任務範圍與協作工具規則仍然適用。
v1 不會附加偏好模型、
名冊、fallback 清單或自訂提示詞。

預設關閉的 `syncCodexSubagentDefaults` 選項與指引無關。當 opencodex 擁有作用中的 Codex 路由時，
sync 或 restart 可以把選定值寫成帶 marker 的 `[agents] default_subagent_model` 和
`default_subagent_reasoning_effort` 項目，放進 Codex TOML。opencodex 只更新或移除帶有自己 marker 的
欄位。若任一目標欄位為使用者所有，整對會保持不變而不部分寫入；有歧義的 TOML 會被拒絕而不寫入。
外部供應商管理器與使用者擁有的根路由仍然保持權威。

## Fallback 鏈

對生成的 worker，opencodex 建立這個優先順序：

1. 請求的主要模型。
2. opencodex 設定中 `subagentModelFallbackByModel` 的 per-model 鏈，以請求的主要模型為鍵。
3. opencodex 設定中的全域 `subagentModelFallback` 清單。

Per-role fallback 鏈屬於 opencodex 設定，而不是 `$CODEX_HOME/agents/*.toml`。Codex 0.146+ 嚴格
反序列化 agent role 檔案，並把 `model_fallback` 當作未知欄位拒絕，導致整個 role 定義被跳過（#1190）。
opencodex 仍可為了向後相容從 TOML 讀取舊版 `model_fallback` 列，但 `ocx doctor` 會對此發出警告，
而 Codex 本身會忽略受影響的 role。

重複的模型 id 會被移除，同時保留第一次出現者。選擇期間，opencodex 會跳過已停用、無法路由、由已
停用 provider 支撐、標記為不健康、在冷卻中、缺少可用 Pool 化 Codex 帳號，或超過設定配額閾值的
候選。可用性探測會快取 `subagentModelFallbackPollMs`（預設 60 秒）。

Fallback 不能讓不相容的加密任務變成可讀。當子任務是為 ChatGPT 加密時，即使其他外部模型在鏈中
出現得更早，選擇也只會包含規範的原生 ChatGPT 目標，以及透過
`allowEncryptedV2AgentTasks: true` 明確信任的直接金鑰驗證 Responses 路由。組合仍只使用規範的原生目標。

## 加密的 v2 任務傳輸

Codex 可能只以後端加密的 `encrypted_content` 傳送 v2 原生→路由子任務。該載荷可以被原生 ChatGPT
後端讀取，但外部 provider 無法讀取。這是已知的
[#92 限制](https://github.com/lidge-jun/opencodex/issues/92)。

opencodex 會安全失敗，而不是轉發空或無法讀取的任務：

- 不合格的直接非原生路由回傳 HTTP 400，帶有 `error.code = "unreadable_encrypted_agent_task"`，
  且不會回顯密文；一個合格、以 `allowEncryptedV2AgentTasks: true` 明確選擇加入的直接金鑰驗證
  Responses provider，則會改為接收該不透明密文並繞過這個錯誤。
- combo 會先考慮規範的原生 ChatGPT 目標。若沒有可用目標，或其嘗試已耗盡，已啟用的復原機制可以
  讓任務對一個可用的路由目標變成可讀。若復原未成功且沒有合格目標，無法讀取的密文絕不會被轉發。
- 可讀取的明文任務保持正常的路由與 fallback 行為。

恢復方法：選擇原生 ChatGPT 子代理、明確信任一個可以消費該不透明載荷的直接金鑰驗證 Responses
relay、在組合中加入原生 ChatGPT 目標、異構供應商委託改用 v1，或在你能控制呼叫方時將任務重新作為
明文 v2 `agent_message` 內容傳送。

實驗性、預設停用的 `agentTaskRecovery` 選項，可以透過對固定 ChatGPT `/responses` 端點的原始
Responses 透傳，使用規範 `openai` 供應商在 `authMode: "forward"` 下所用的相同傳入憑證形狀，來
復原這種特定的原生轉路由任務。這項復原只有在 proxy 綁定於 loopback 時才可用。它絕不會替換成
API-key 驗證、另一個供應商憑證，或另一個 Codex 帳號。只有 `authorization`、相符的
`chatgpt-account-id`、`originator`，以及選用的 `openai-beta`/`user-agent` 中繼資料會被轉發；
`content-type` 與 `accept` 是在本機產生的，其他呼叫者標頭都不會跨越這個邊界。它會消耗配額、增加
延遲、把復原後的明文短暫保留在一個有界的記憶體內快取中，並依賴未文件化的 ChatGPT 後端行為。因為
文字是由模型回傳復原的，所以不保證逐位元組保真。它會拒絕一般／API-key 的 proxy 呼叫者。在任何
原生嘗試之前失敗的復原會回傳 `unreadable_encrypted_agent_task`；在原生嘗試已經失敗之後，會保留
它們最後的錯誤。完整的信任邊界與設定請見
[Agent 設定：加密的 v2 任務復原](/zh-tw/reference/configuration/agents/#加密-v2-任務復原)。

同一套復原機制也涵蓋一個從原生 ChatGPT 模型切換到路由模型的現有執行緒。這種執行緒會在之後的每
一回合重播由後端鑄造的加密 agent 訊息，所以在 [#4089](https://github.com/lidge-jun/opencodex/issues/4089)
之前，它會在每一回合都關閉失敗，唯一的變通方法是開始一個新執行緒。那個切換回合並不是一次 spawn，
所以直接路由路徑不再把復原限制在已生成的子回合上；combo 復原則仍然如此限制。

對於加密任務，combo 路由偏好一個可選擇的規範原生 ChatGPT 目標。若沒有可用的，或原生授權嘗試已
耗盡，明確啟用的復原機制可以讓任務對一個可用的路由目標變成可讀。上面所有的復原信任與不持久化
防護仍然適用；一個已設定但停用或正在冷卻的原生目標不會阻擋這個 fallback，而取消動作絕不會變成
無法讀取任務的錯誤。

## 被拒絕的加密歷史

上游 Responses 伺服器可能會以 `Encrypted function output content could not be decrypted or decoded.`
拒絕先前 function／custom-tool 輸出或 `agent_message` 內容中的加密部分。在任何輸出被確定之前，
opencodex 會把那些部分替換為 `[encrypted content omitted]`，並重新建立一次請求。周圍可讀的內容
保持不變；被省略的內容不會因這次重試而被解密或復原。

若重建後的請求又收到一個裸 SSE `error` 後接 EOF，兩種轉送模式都會把錯誤訊息保留在一個
`response.failed` 終止事件中，而不是回報 `adapter_eof`。其他上游的 `response.failed` 事件仍視為
SSE 失敗。這項歷史復原不會改變上面描述的加密 v2 任務傳遞限制。

**明文 v2 任務訊息**

新設定中的 `plaintextV2AgentMessages` 預設未設定。明確設為 `true` 或選擇 `v2-plaintext` 模式都會啟用編譯器；離開模式不會改變獨立的布林值。它只處理 Responses 呼叫，且最終目的地必須是標準 ChatGPT Codex forward 路徑：`adapter: "openai-responses"`、`authMode: "forward"` 和 `https://chatgpt.com/backend-api/codex`。OpenAI API 金鑰 provider、自訂閘道、其他最終 provider 及非 Responses 呼叫不受改寫。

啟用後也會處理既有 V2 工作階段的後續合格請求；既有密文不會解密，已儲存歷史不會改寫，停用不會刪除已保留的副本。詳見[代理設定](/zh-tw/reference/configuration/agents/#明文-v2-代理訊息)。

## 更改模式

### GUI

- **Dashboard** → 第一個狀態單元：選擇 **v1**、**base**、**v2** 或 **v2-plaintext**；進入明文模式需要在 GUI 中確認。
- **Models** 頁面 → 使用頂部的分段控制元件。
- 兩個頁面都有 **?** 按鈕，可開啟幫助彈窗並返回本文。
- **Dashboard** → **子代理委託**：選擇首選模型和可選的推理強度。在 v2 上，注入的指引會要求以 `fork_turns: "none"` 生成，使模型覆蓋得以應用。如果原生→路由子代理只收到加密任務內容，請使用原生目標、v1，或明確信任的直接金鑰驗證 Responses relay；其他僅外部目標的傳輸會明確回傳 `unreadable_encrypted_agent_task`（[#92](https://github.com/lidge-jun/opencodex/issues/92)）。

### CLI

使用 `ocx v2` 設定協作介面與原生功能：

```bash
ocx v2 mode v1       # 強制所有模型使用 v1
ocx v2 mode default  # 恢復上游固定值
ocx v2 mode v2       # 強制所有模型使用 v2
ocx v2 mode v2-plaintext --acknowledge-plaintext-agent-messages # 選用明文任務
ocx v2 status        # 顯示目前模式和 Codex 功能開關
```

使用 `ocx agent` 設定委託、名冊、effort 上限與 fallback：

```bash
ocx agent status
ocx agent injection set --model anthropic/claude-sonnet-5 --effort xhigh
ocx agent subagents set gpt-5.6-sol,anthropic/claude-sonnet-5
ocx agent fallback set gpt-5.6-luna,xai/grok-4.5 --poll-ms 60000
ocx effort set --subagent max
```

首次進入 `v2-plaintext` 時，`PUT /api/v2` 必須同時提供 `plaintextAgentMessagesAcknowledged: true`。`/api/v2` 的 PUT 端點還接受 `enabled`（布林值，Codex 功能開關）和 `maxConcurrentThreadsPerSession`（整數）。它會驗證請求、儲存模式、重新同步目錄，並提示模式更改從新會話開始生效。

`-` 可用來清除可為 null 的 `ocx agent injection` 值，名冊或 fallback 清單則使用對應的 `clear`
動作。所有指令家族請見 [CLI 參考](/zh-tw/reference/cli/)。

### API

管理 API 暴露對應的 `GET` 與 `PUT` 端點：

| 端點 | 管理內容 |
| --- | --- |
| `/api/v2` | 介面模式、原生功能旗標與執行緒設定 |
| `/api/injection-model` | 偏好模型、effort、自訂提示詞、指引，以及原生預設值同步 |
| `/api/effort-caps` | 主要代理與子代理的 effort 上限 |
| `/api/subagent-models` | 最多五個模型的有序名冊 |
| `/api/subagent-model-fallback` | 全域 fallback 順序與輪詢間隔 |

例如：

```bash
curl -X PUT http://localhost:10100/api/v2 \
  -H 'Content-Type: application/json' \
  -d '{"multiAgentMode":"v2"}'

curl -X PUT http://localhost:10100/api/injection-model \
  -H 'Content-Type: application/json' \
  -d '{"model":"anthropic/claude-sonnet-5","effort":"xhigh"}'
```

## FAQ

### 選擇委託模型會強制 Codex 生成它嗎？

不會。指引可以推薦模型，原生預設同步可以提供 Codex 預設值，但主代理仍然決定是否委託。

### 為什麼我的 v2 子代理使用了父模型？

全量歷史 v2 fork 會繼承父模型。請在傳遞模型或 effort 覆蓋之前，使用把 `fork_turns` 設為 `"none"`
或正數部分計數的 spawn。

### 為什麼設定的模型沒有出現在 v2 名冊中？

它可能是 picker 隱藏、超出五個模型的顯示上限、不在目錄中，或固定為 v1。值為 `"v2"`、`null` 或缺
少介面值的項目合格；真正的 `"v1"` 固定值不合格。

### 為什麼 `spawn_agent` 列出了我沒有設定的模型？

Codex 依 priority 從目錄填入最多五個列出位置。設定的模型少於五個時，接下來的列會佔用其餘位置。參見上文「`spawn_agent` 列出哪些模型」一節。

### 模式變更會影響執行中的工作階段嗎？

目錄介面選擇適用於新工作階段；但啟用明文編譯後，既有 V2 工作階段的後續合格請求也會受影響。變更目錄介面後請開啟新的 Codex 工作階段。若長時間執行的 App host 仍顯示過時的目錄狀態，請執行
`ocx sync` 並重新啟動該 Codex 介面。

### 當 opencodex 無法信任目錄時會發生什麼？

opencodex 會將磁碟上的模型目錄與目前使用者擁有的每個 Codex app-server 啟動時間比較，產生四種狀態之一：

| 狀態 | 意義 | v2 指引 |
|---|---|---|
| `fresh` | 每個 app-server 都在目錄寫入之後啟動 | 完整指引：偏好模型、roster、fallback |
| `not_running` | 未偵測到 app-server | 完整指引 |
| `stale` | 至少一個 app-server 早於目錄 | **不新增或覆寫 opencodex 撰寫的模型指引** |
| `unknown` | 無法進行比較 | **不新增或覆寫 opencodex 撰寫的模型指引** |

對 `stale` 與 `unknown`，opencodex 會保留（不提供）其自身的磁碟衍生宣稱——偏好模型、roster、
fallback 與自訂指引——因為執行中的 Codex 可能無法生成磁碟目錄所廣告的內容。

它**不會**指示模型停止設定 `model` 或 `reasoning_effort`。該觀察對使用者擁有的每個 app-server 都是全域的，而入站請求不帶傳送者身分，因此無法將過時的 process 歸因於眼前的請求。基於此禁止覆寫會封鎖現用 `spawn_agent` 工具合法廣告的選項——而該 session 可能其實是新的。現用工具 schema 保持權威。

`unknown` 不是 `stale` 的同義詞。它表示比較本身失敗——目錄時間戳不可讀、process 啟動時間不可讀或 process 列舉失敗——並由 `ocx doctor` 分開回報。`stale` 僅在每個偵測到的 Codex app-server 都在最後一次目錄寫入後啟動時才清除；它不一定會清除 `unknown`。

在 Windows 上，這項建議性檢查在 v2 請求路徑上使用非同步的 PowerShell/CIM 探索。並行的冷啟動
檢查會共用同一次進行中的探索。已觀測到的狀態會快取 5 秒；`unknown` 失敗只快取 250 毫秒，讓暫時性
的 CIM 錯誤能快速重試。緩慢或失敗的 CIM 查詢，只會延遲或抑制 OpenCodex 撰寫的模型指引，不會阻擋
Bun 事件迴圈、`/healthz` 或不相關的 proxy 流量。明確的 CLI／服務生命週期操作仍保留同步、
fail-closed 的 process 收集器，因為它們可能會對 process 送出訊號。

只有真正的變動才算數。若一次同步的結果與磁碟上既有的目錄逐位元組相同，檔案就不會被改動，因此
重新啟動 proxy 或重新同步一組未變動的模型，都不會讓執行中的 Codex 看起來過時。

### 推理強度

`injectionEffort` 只會影響委託 worker 的指引，以及在明確啟用時的原生 Codex 子代理預設值。
它不會改變父工作階段的 effort。`ultra` 是一個面向客戶端的最高層級，Codex 會將其轉換為 `max`；
之後 opencodex 會為所選供應商對映或限制該值。

### Context 上限

模型的 context 上限與子代理模式彼此獨立。請在 Models 頁面設定它；原生 OpenAI 模型會保留其真實的
context 視窗。

實驗性的 `plaintextV2AgentMessages` 欄位在全新設定中未設定，只有在明確設為 `true` 時才會運作。
呼叫者必須使用 Responses 線路，且最終目的地必須使用 `adapter: "openai-responses"`、
`authMode: "forward"`，以及精確的 base URL `https://chatgpt.com/backend-api/codex`。OpenAI
API-key 供應商、自訂相容閘道器、指向其他供應商的路由，以及非 Responses 呼叫者都被排除在外。對於
一個合格的全新原生 ChatGPT v2 工具呼叫，這個選項會為該命名空間與三個保留的訊息工具名稱指派
請求範圍內的別名、移除訊息標記，並在回應中還原原始身分。它處理 `spawn_agent`、`send_message` 與
`followup_task`，且不會新增任何復原請求。HTTPS 仍維持加密，但任務文字可能會被保留在 Codex
歷史、路由供應商的請求，以及本機的回應／除錯狀態中。既有的密文不受影響，且這個選項依賴未
文件化的 ChatGPT 與 Codex 行為。詳見
[Agent 設定：明文 v2 agent 訊息](/zh-tw/reference/configuration/agents/#明文-v2-代理訊息)。

## 模型切換與側邊對話壓縮

Codex 可能在側邊對話第一輪之前或切換模型後壓縮繼承歷史。其中一個觸發條件會比較前後模型的 `comp_hash`：兩者都有值且不同時，即使歷史仍放得進目的模型，也會壓縮。

OpenCodex 用 `comp_hash: null` 表示路由模型的相容性未知，不捏造 `"opencodex"` 標記或複製原生範本。目錄重建也會清除探索中斷時保留的舊路由標記。原生模型與明確的 Codex-forward 別名保留上游標記，所以真正的原生不相容檢查仍有效。這與 v1／v2 介面及壓縮模型無關。

正常上下文與 token 上限壓縮仍適用；此變更只移除合成 hash 不相符，不決定側邊對話繼承哪些訊息，也不還原已壓縮的原始訊息。供應商內容支援仍是另一個限制。

## 外部任務輸入

Codex 可用不帶 `call_id` 的結果型封裝傳送初始任務或後續輸入。轉換路由只接受完整的 `function_call_output`，且 `id`、`name`、`namespace` 非空白，輸出為支援的文字／影像，再將其視為使用者回合。續接時也會開始新的對話邊界，清除上一輪待送的 reasoning。產生的 developer 指引在解析訊息與儲存原始歷史中都放在目前任務之前，讓重放順序一致。

格式錯誤、空白、不透明或不完整封裝仍會失敗；真正工具結果仍需 `call_id`。原生透傳與可攜式壓縮對原始內文採同一使用者回合對應；直接原生 `/responses/compact` 保留既有原始輸入處理。詳見[適配器契約](/zh-tw/reference/adapters/#翻譯後-responses-路由上的外部任務輸入)。
