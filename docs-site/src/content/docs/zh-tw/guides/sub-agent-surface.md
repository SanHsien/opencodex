---
title: 子代理介面（v1 / base / v2）
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
| **v1**（預設） | 經典的具名稱空間 `spawn_agent`、`send_input`、`resume_agent` 與 `close_agent` 工具。spawn 可以直接選擇另一個模型。 | 任何跨供應商委託的人，特別是原生轉路由的子代理。這是全新安裝出廠時所使用的模式。 |
| **base** | 上游模型 pin：GPT-5.6 Sol/Terra 使用 v2，Luna 使用 v1，未 pin 的模型遵循 Codex 的 `multi_agent_v2` 功能旗標。 | 想要使用 Codex 逐模型 pin，且父模型與子模型位於同一側供應商邊界的維運方。請注意其 pin 會把 Sol 與 Terra 放在 v2。 |
| **v2** | 扁平的 `spawn_agent`、`send_message`、`followup_task`、`interrupt_agent` 與代理清單工具，支援並行工作階段。 | 想要較新的並行工作流程、且理解模型繼承與下方加密任務限制的使用者。 |

在 **v2** 上，選用的**讓 ChatGPT 保持 v1**開關（`keepNativeChatGptOnV1`）會讓 Sol/Terra 留在 v1
介面，讓它們仍能生成 Grok 或 Claude 子代理。ChatGPT 原生的父代理會把 v2 的 `NEW_TASK` 內容加密；
路由模型無法讀取它們。路由父代理則留在 v2 上，其子任務是明文的。OpenCodex 會為這種混合模式停用
全域 `multi_agent_v2` 覆寫，因為 Codex 會在套用逐模型目錄 pin 之前先套用那個覆寫。這是 v2*內部*
的一個開關，不是第四種目錄模式。

:::tip[不確定該怎麼選？]
留在出廠預設的 **v1**。只有在你的父模型與子模型位於同一側供應商邊界時，才選擇 **base** 或
**v2**——在兩者中，一個從 ChatGPT 模型交給路由模型的任務會以加密形式送達並失敗。儀表板在你選擇
其中之一之前都會先詢問，並連結到[為什麼 v1 是預設值](/guides/subagent-v1-default/)。
:::

## 外部任務輸入

Codex 可能會以沒有 `call_id` 的、結果形狀的信封傳遞一個任務的初始輸入或後續輸入。在轉換路由上，
OpenCodex 只會辨識帶有非空白 `id`、`name` 與 `namespace`，以及受支援文字／圖像輸出的完整
`function_call_output` 形狀，並把它當成一個使用者回合處理。這也會在續接期間開啟新的對話邊界，
並清除上一回合待處理的 reasoning。產生的 developer 指引會被放在目前任務之前，無論是在解析後的
訊息中還是在儲存的原始歷史中，並在該歷史被重播時保留相同順序。

格式錯誤、空白、不透明或不完整的信封仍會驗證失敗。真正的工具結果仍保有其必要的 `call_id`；
原生透傳與 compaction 保留其既有的原始輸入處理方式。詳見
[adapter 合約](/reference/adapters/#external-task-input-on-translated-responses-routes)。

## 運作原理

所選模式會控制 Codex 讀取的每個目錄條目中的 `multi_agent_version` 欄位：

- **v1** 會在每個模型上標記 `multi_agent_version = "v1"`。
- **base** 恢復上游 pin。未 pin 的條目遵循原生 `multi_agent_v2` 功能旗標。
- **v2** 會在每個模型上標記 `multi_agent_version = "v2"`，但啟用**讓 ChatGPT 保持 v1**時例外：
  ChatGPT 原生列維持 `"v1"`，路由或 combo 列維持 `"v2"`。

opencodex 會把這個處理作為最後一步，同時套用到即時的 `/v1/models` 目錄與同步到磁碟的目錄。這就是
為什麼變更模式會一致地影響新建立的 App、CLI 與 TUI 工作階段。

對於 v2 名冊，資格有三種狀態：標記為 `"v2"`、明確設為 `null`，或沒有 `multi_agent_version`
欄位的條目都合格。真正的 `"v1"` pin 會被排除，因為它宣告該模型屬於另一個協作介面。

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
[Agent 設定：加密的 v2 任務復原](/reference/configuration/agents/#encrypted-v2-task-recovery)。

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

## 更改模式

### GUI

- **Dashboard** → 第一個狀態方塊：選擇 **v1**、**base** 或 **v2**。
- **Models** → 頂端列的分段控制元件：選擇相同的全域模式。
- **Dashboard** → **Sub-agent delegation**：設定指引模型／effort，以及原生預設值的 opt-in。
- **Subagents**：選擇並排序名冊，並設定全域 fallback 鏈。

### CLI

使用 `ocx v2` 設定協作介面與原生功能：

```bash
ocx v2 status
ocx v2 mode v1
ocx v2 mode default
ocx v2 mode v2
ocx v2 threads 8
```

使用 `ocx agent` 設定委託、名冊、effort 上限與 fallback：

```bash
ocx agent status
ocx agent injection set --model anthropic/claude-sonnet-5 --effort xhigh
ocx agent subagents set gpt-5.6-sol,anthropic/claude-sonnet-5
ocx agent fallback set gpt-5.6-luna,xai/grok-4.5 --poll-ms 60000
ocx effort set --subagent max
```

頂層的 `ocx effort` 指令是 effort 檢查與上限設定的標準入口（例如 `ocx effort high`、
`ocx effort status`、`ocx effort clear`），`ocx agent effort` 則作為向後相容的路徑保留。請注意
`ocx effort clear` 會移除現用的主要代理與子代理上限，但不會動到委託用的 `injectionEffort`
（請用 `ocx effort set --injection -` 或 `ocx agent injection set --effort -` 清除注入 effort）。

`-` 可用來清除可為 null 的 `ocx agent injection` 值，名冊或 fallback 清單則使用對應的 `clear`
動作。所有指令家族請見 [CLI 參考](/reference/cli/)。

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

### 模式變更會影響執行中的工作階段嗎？

不會。變更模式後請開啟新的 Codex 工作階段。若長時間執行的 App host 仍顯示過時的目錄狀態，請執行
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
[Agent 設定：明文 v2 agent 訊息](/reference/configuration/agents/#plaintext-v2-agent-messages)。
