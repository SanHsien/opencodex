---
title: Agent 設定
description: 多代理介面、委派指引、偏好模型、fallback 鏈、原生預設同步與 effort 上限。
---

Agent 設定控制要廣告哪個 Codex 協作介面，以及 opencodex 如何引導、路由並限制委派的工作。

## Agent 欄位

### Astra roster 升級

升級後第一次啟動時，既有的 `subagentModels` 清單會在最前面加入 `gpt-6-astra`。前四個不重複的非 Astra 選項會被保留，舊的第五個選項會被丟棄。若 `gpt-5.5` 被保留，它會移到最後。因此先前的預設清單會變成 Astra、Sol、Terra、Luna、5.5。未設定的清單會取得同樣的預設值；明確的空舊清單會變成 `["gpt-6-astra"]`。既有的 Astra 項目不會被重複加入。

內部的 `subagentModelsVersion: 1` 標記讓這只是一次性升級。之後你可以重新排序、移除 Astra，或儲存空清單，啟動程序不會再次更動你的選擇。已停用的模型仍保持停用。Astra 的可用性仍取決於你帳號的上游支援。

| 欄位 | 型別 | 預設值 | 意義 |
| --- | --- | --- | --- |
| `multiAgentMode?` | `"v1" \| "default" \| "v2"` | `"default"` | `v1` 將每個目錄模型標記為 v1；`v2` 將每個模型標記為 v2。`default` 還原上游 pin（Sol/Terra v2、Luna v1），否則遵循原生的 `multi_agent_v2` 旗標。套用於新 session。 |
| `subagentModels?` | `string[]` | `gpt-6-astra`, `gpt-6-sol`, `gpt-6-luna` | 最多五個原生或路由 id，在子代理 picker 中優先顯示。[Astra 一次性升級](/zh-tw/reference/configuration/agents/#astra-roster-upgrade)後，明確的空清單會被保留。 |
| `injectionModel?` | `string` | — | 在代理撰寫的 v2 委派指引中使用的偏好原生或路由子代理模型。 |
| `injectionEffort?` | `string` | — | 偏好 effort（`low` 到 `ultra`），僅在搭配 `injectionModel` 時有意義。 |
| `injectionPrompt?` | `string` | — | 取代內建指引本文。支援 `{{model}}`、`{{effort}}`、`{{roster}}` 與 `{{fallback}}`。只要設定了 `injectionModel` 就足以產生自訂 prompt。 |
| `multiAgentGuidanceEnabled?` | `boolean` | `true` | 僅控制 opencodex 撰寫的 v1/v2 開發者指引；不改變原生 agent 預設值、工具、路由、roster 或 effort 上限。 |
| `syncCodexSubagentDefaults?` | `boolean` | `false` | 選擇在 sync/restart 時將 `injectionModel` 與可選的 `injectionEffort` 寫入 Codex 的原生預設值。需要 `injectionModel`。 |
| `subagentModelFallback?` | `string[]` | `[]` | 為生成的子任務回合排序的全域 fallback 模型。 |
| `subagentModelFallbackByModel?` | `Record<string, string[]>` | `{}` | 以請求的主模型 id 為鍵的每一主模型 fallback 鏈。這是每角色 fallback metadata 受支援的存放位置；Codex agent TOML 中的 `model_fallback` 會讓 Codex 0.146+ 略過該角色（#1190）。 |
| `subagentModelFallbackPollMs?` | `number` | `60000` | 可用性探測快取間隔。低於 1000 ms 的值會回退到預設值。 |
| `effortCap?` | `string` | — | 合格 v2 主回合與標記的生成子回合的硬性上限。接受 `low` 到 `ultra`。 |
| `subagentEffortCap?` | `string` | — | 僅針對生成子回合的額外上限。當兩個上限都適用時，取較低者。 |
| `plaintextV2AgentMessages?` | `boolean` | —（未設定） | 實驗性選用功能。只有在明確設為 `true` 時才會運作，會要求合格的原生 ChatGPT v2 父層以明文方式發出 `spawn_agent`、`send_message` 與 `followup_task` 的訊息參數。詳見「明文 v2 代理訊息」一節。 |
| `agentTaskRecovery?` | `object` | — | 針對送往路由供應商之後端加密 v2 任務的實驗性選用復原機制。除非設定 `enabled: true`，否則停用；詳見「加密 v2 任務復原」一節。 |

使用儀表板或 `ocx v2 status|on|off|mode <v1|default|v2>|keep-native-v1 <on|off>|threads <n>|mode-hint <text|--clear>` 管理介面。模式變更套用於新 session。`maxConcurrentThreadsPerSession` 是 `PUT /api/v2` 欄位，不是 `config.json` key；`ocx v2 threads <n>` 在啟用 v2 後，將 `max_concurrent_threads_per_session` 寫入 Codex 的 `$CODEX_HOME/config.toml` 中 `[features.multi_agent_v2]` 之下。

Subagents → Advanced 中的**永遠主動委派**（前身為**Ultra 模式**）會改變委派觸發條件，但不會改變 reasoning effort。它的預設集會保留使用者指示、權限邊界、任務範圍與工具規則。儀表板切換開關、`PUT /api/v2` 欄位 `multiAgentModeHintText`，以及 `ocx v2 mode-hint` 都會把 `features.multi_agent_v2.multi_agent_mode_hint_text` 寫進 Codex 的 `$CODEX_HOME/config.toml`。即使 `multi_agent_v2` 已停用，CLI 的 `ocx v2 mode-hint` 命令仍會持久化此 key；它不會切換此功能本身。當該原生介面啟用時，此提示會取代 codex-rs 依 effort 推導的 multi-agent 策略。設為 `null` 會移除該 key，讓依 effort 推導的策略（ultra = 主動，否則為明確）恢復；空字串或僅含空白的值會被拒絕，因為存在一個空的覆寫值會連 ultra 推導出的「主動」訊息都一併抑制。Subagents 儀表板的**永遠主動委派**切換開關，需要同時具備原生功能與明確的 v2 介面（`multiAgentMode: "v2"`，等同於 `ocx v2 mode v2`）；單靠 `ocx v2 on` 無法滿足這道儀表板閘門。

`GET` 與 `PUT /api/v2` 也會回傳 `multiAgentModeHintRecommendation: { text, revision }`。啟用或還原預設集時，儀表板會使用這段伺服器提供的文字，沒有寫死的退路。若較舊的伺服器省略此建議值或回傳格式錯誤的值，預設集的安裝與還原就無法使用；編輯或清除既有的自訂提示仍然可用。**還原預設集**只會改動本機草稿；**儲存**才會持久化它。

讀取設定、不相關的更新與升級都不會遷移已儲存的提示。只有明確的提示更新、且逐位元組相符於兩個已知舊版 OpenCodex 預設集之一時，才會被目前的建議值取代。其他有效的自訂文字（包含僅有空白差異的版本）會逐位元組保留。寫入前仍會檢查 mode-hint 支援與否，變更套用於新的 Codex session。

管理 API 暴露 `GET`/`PUT /api/v2`、`/api/injection-model`、`/api/effort-caps`、`/api/subagent-models` 與 `/api/subagent-model-fallback`。注入模型更新為部分更新；自訂 prompt 是該 API 的 `prompt` 欄位。

Codex Auth 頁面也可以切換 Codex 自身的 `default_mode_request_user_input` feature flag（`GET`/`PUT /api/codex-auth/features/default-mode-request-user-input`）。啟用它會透過官方的 `codex features enable|disable` CLI（保留格式的編輯，停用時會再次移除），把 `[features] default_mode_request_user_input = true` 加進 Codex 的 `$CODEX_HOME/config.toml`，讓 Codex 可以在 Default 模式 session 中暫停，並用 `request_user_input` 工具向你提問。此旗標在上游仍在開發中，僅套用於新 session；當已安裝的 Codex 版本尚不認識此旗標時，切換會明確失敗，而不是靜默無效。

## Roster 與指引

有效的 v2 roster，是已設定、在 picker 中可見、依優先序排列的前五個模型，前提是它們存在於注入的目錄中，且未被明確標記為 `"disabled"`。明確的 `"v2"` pin 支援可遞迴的 worker；`"v1"`、`null`，以及未設定的 pin，仍具備成為 leaf worker 的資格。被排除的項目仍保留在設定中，以便日後變為合格。

介面偵測使用工具形狀。帶有 `send_input`、`resume_agent` 或 `close_agent` 的命名空間 `spawn_agent` 為 v1。帶有 `send_message`、`followup_task`、`interrupt_agent` 或 `list_agents` 的扁平 `spawn_agent` 為 v2。

V1 指引僅在 `max` 或 `ultra` 時為主動文字。V2 僅在存在偏好模型、合格 roster 或 fallback 鏈時，收到代理撰寫的開發者訊息。內建 v2 指引有 700 字元預算，必要時先丟棄 roster。指引會跨 replay 前綴去重，並插入在結尾的 `compaction_trigger` 之前。

內建 v2 子代理指引與自訂 `injectionPrompt` 本文都使用 `<opencodex_subagent_guidance>`，與 Codex 原生的 `<multi_agent_mode>` 訊息分開。內建文字只回報已解析出的偏好模型、roster 與 fallback 鏈，不會規定委派方式、模型覆寫或 `fork_turns`。自訂本文保留其 placeholder 替換與內容。除非啟用原生預設同步，否則 `injectionModel` 與 `injectionEffort` 僅為建議；缺失的自訂 placeholder 值仍會以空字串替換。

Replay 去重會比對每個標籤家族中最新的完整文字。當兩個值都使用新的 proxy 家族時，把自訂指引切回內建形式會附加目前的值；期間發生的原生模式變更不會讓未變動的 proxy 指引重複出現。既有的原生與舊版標籤歷史會被保留。這次 wrapper 變更不會辨識舊訊息的作者，也不會撤銷先前的指示。混合版本的歷史無法只憑舊標籤分類，跨這類歷史的轉換偵測不保證正確。

## 原生 Codex 預設同步

啟用時，`syncCodexSubagentDefaults` 寫入標記擁有的 `[agents] default_subagent_model` 與 `default_subagent_reasoning_effort` 欄位。既有的未標記使用者擁有目標欄位視為衝突並保持權威性；部分或歧義的 TOML 寫入會 fail closed。清除 `injectionModel` 也會清除此選項。這些預設值影響新建的 Codex 任務，本身不會觸發委派。

## Fallback 鏈

生成子任務的 fallback 順序為：

1. 請求的主模型；
2. 以主模型為鍵的 `subagentModelFallbackByModel` 每模型鏈；
3. 全域 `subagentModelFallback` 項目。

每角色的 fallback 鏈必須放在 opencodex 設定中。把 `model_fallback` 寫進 `$CODEX_HOME/agents/*.toml` 會讓 Codex 0.146+ 把整個角色檔視為含未知欄位而拒絕，並略過該角色（#1190）。為了向後相容，TOML 中的舊版 `model_fallback` 行仍會被讀取，但 `ocx doctor` 會標記它。

opencodex 會跳過已停用、不可路由、不健康、冷卻中或達到配額閾值的候選項。可用性快取保存 `subagentModelFallbackPollMs`。對於加密的子任務，候選鏈僅包含規範的原生 ChatGPT 目標，以及透過 `allowEncryptedV2AgentTasks: true` 明確信任的直接金鑰驗證 Responses 路由。若沒有目標能消化加密 payload，請求會直接失敗，不會把無法讀取的密文轉送到別處。組合會先嘗試可用的規範原生目標；若沒有可選擇的原生目標或原生嘗試已耗盡，且已啟用 `agentTaskRecovery`，會在路由到組合目標前對加密的 `NEW_TASK` 恢復一次。組合恢復僅在 spawn 出的子回合生效；直接路由路徑也會恢復對話中途的模型切換。

```json
{
  "multiAgentMode": "v2",
  "subagentModels": ["gpt-5.5", "anthropic/claude-sonnet-5"],
  "injectionModel": "gpt-5.5",
  "injectionEffort": "high",
  "syncCodexSubagentDefaults": true,
  "subagentModelFallback": ["gpt-5.6-luna"],
  "subagentModelFallbackByModel": {
    "gpt-5.5": ["gpt-5.6-luna"]
  },
  "subagentModelFallbackPollMs": 60000,
  "subagentEffortCap": "high"
}
```

## 明文 v2 代理訊息

全新設定中 `plaintextV2AgentMessages` 未設定，只有在明確設為 `true` 時才會運作。呼叫端必須使用 Responses 線路，且最終目的地必須使用規範的 ChatGPT Codex forward 傳輸：`adapter: "openai-responses"`、`authMode: "forward"`，以及確切的 base URL `https://chatgpt.com/backend-api/codex`。OpenAI API key 供應商、自訂的 OpenAI 相容 gateway、最終目的地是其他供應商的路由，以及非 Responses 的呼叫端，一律不會被改寫。

對於合格的 v2 請求，opencodex 透過頂層帶有直屬 `spawn_agent` 子項的 `collaboration` 命名空間來辨識目錄。它只會從 `spawn_agent`、`send_message` 與 `followup_task` 中移除 `parameters.properties.message.encrypted: true`（若存在）。ChatGPT 保留了 `collaboration` 命名空間與這三個工具名稱，因此請求對這四個識別項都使用固定的私有別名。在進行這項變更之前，opencodex 會檢查頂層與 `additional_tools` 目錄、巢狀命名空間、`tool_search_output` 宣告、`tool_choice`，以及先前的呼叫項目中是否已出現私有命名空間與固定別名。任何衝突都會讓整個請求維持不變。OpenCodex 只會在 Codex 收到工具呼叫之前，把請求範圍內的別名還原到 JSON、SSE 與 WebSocket 回應中。`encrypted_function_args: []` 欄位會被保留，讓相容的 Codex 用戶端能把訊息辨識為明文。

這條路徑不會新增復原請求，因此不會消耗 `agentTaskRecovery` 快取未命中時所使用的額外 ChatGPT 配額。它無法改變已經加密的任務。若請求本身已宣告私有別名或有衝突的參照，opencodex 會讓該請求維持不變；另外啟用的復原機制仍可處理之後被加密的路由任務。若 ChatGPT 拒絕或忽略修改過的 schema，或 Codex 用戶端無法辨識明文回應欄位，呼叫可能會失敗。OpenCodex 不會用原始 schema 重試父層請求，因為那麼做可能會讓配額使用或工具呼叫重複。

還原程序對每個回應 payload 使用 10,000 個識別項的遍歷預算。若某個 payload 耗盡該預算，有邊界的 JSON 會回傳 HTTP 502，串流則回傳 `response.failed`；這兩條路徑都不會把私有別名送給 Codex，也不會把被拒絕的回應保存供 `previous_response_id` 延續使用。

對於成功改寫的呼叫，此選項會移除代理訊息參數的應用層加密。HTTPS 仍會加密網路傳輸，但訊息文字可能出現在 Codex 任務歷史、路由供應商請求、`responses-state.json` 或其溢出檔案中，以及啟用 debug capture 時的 `usage-debug.jsonl` 中。此行為依賴未記載的 ChatGPT schema 與回應欄位，後端或用戶端更新後可能失效。啟用期間，啟動時會印出警告。

```json
{
  "plaintextV2AgentMessages": true
}
```

對應的 CLI 命令是 `ocx config set plaintextV2AgentMessages true`。變更此設定後請重新啟動 proxy。

## 加密 v2 任務復原

`agentTaskRecovery` 是針對送達路由供應商之後端加密 v2 任務的實驗性相容路徑。有兩種請求形狀符合資格：原生 ChatGPT 父層生成路由 v2 子層，以及從原生 ChatGPT 模型切換到路由模型的現存執行緒——其歷史紀錄在之後每一回合都會重播一則後端鑄造的加密代理訊息（[#4089](https://github.com/lidge-jun/opencodex/issues/4089)）。此功能預設停用。明確啟用後，若最終的路由任務含有原本無法讀取的 Fernet payload，opencodex 會以 forward 模式驗證，向固定的 `https://chatgpt.com/backend-api/codex/responses` 端點發出原始 Responses passthrough 請求。ChatGPT 會透過強制的 function call 回傳明文內容；opencodex 接著只把那個任務項目轉成標準使用者訊息，再進行路由供應商分派。

這不是本機解密，也不會修正 Codex 的線路協定。它依賴未記載的 ChatGPT 後端行為，後端變更後可能失效。復原出的內容是模型輸出，不是經密碼學驗證的明文，因此不保證逐位元組準確。範圍限定的快取未命中，可能會在路由請求之前額外加入一次已驗證的 ChatGPT 請求、消耗帳號配額並增加延遲。對同一個範圍限定任務的並行請求會共用一次復原請求。只要此功能啟用，啟動時就會印出警告。

准入與保留範圍刻意設得很窄：

- 復原功能只有在 proxy 繫結於迴路時才可用；
- 只有帶著相符 ChatGPT bearer／帳號組合的原生 Codex 呼叫端合格。這正是規範的 `openai` 供應商在 `authMode: "forward"` 下所使用的憑證形狀；復原只使用傳入請求上的那組憑證，絕不會替換成 API key 驗證、其他供應商憑證或另一個 Codex 帳號；
- 使用 `x-opencodex-api-key`、`x-api-key`、一般 API 憑證或 proxy 准入密鑰的呼叫端，會維持既有的 `unreadable_encrypted_agent_task` 失敗；
- 原始 ChatGPT 憑證只會送往寫死的 ChatGPT 端點，絕不會出現在請求主體、log、快取鍵或供應商請求中；記憶體內快取的範圍只使用呼叫端憑證與帳號的、以程序隨機值加鍵的摘要；
- 復原請求只會轉送 `authorization`、相符的 `chatgpt-account-id`、`originator`，以及選用的 `openai-beta` 與 `user-agent` metadata；`content-type` 與 `accept` 由 opencodex 自行設定，沒有其他呼叫端標頭會跨越這道邊界；
- 復原出的明文絕不會被記錄或持久化；程序內的本機快取以憑證、父執行緒與密文為範圍界定，15 分鐘後過期，並同時受設定項目數（預設 200，上限 512）與總計 8 MiB 的限制；
- 任何格式錯誤的信封、復原失敗、逾時或驗證失敗，都會維持既有的 fail-closed 錯誤；用戶端取消會回傳 499。這兩條路徑都不會把密文轉送給路由供應商。

復原功能接受一段連續、最多 32 個完整 Fernet 形狀加密片段的序列，合計密文最多 2 MiB。這些片段會在單一已驗證請求中保留其順序與邊界。快取身分包含此序列；在替換內容之前，原始輸入會被重新驗證。HTTP 失敗會保留既有、有邊界的診斷原因，不會觸發內部重試。

分割的 token 不會為了復原而被重組。一段有邊界的序列，只要其精確串接後具有 Fernet 結構，就會在明文欄位正規化過程中持續被分類為密文。若任務沒有獨立可讀的文字，就會直接 fail closed，不會發出復原或路由供應商請求。獨立可讀的文字仍維持既有的混合內容政策。其他片段表示方式仍不受支援；這不構成一般性的 token 分割復原機制，也不保證上游 multipart 的準確重現。

### 威脅模型

這條路徑假設本機的原生 Codex 呼叫端已經持有有效的 ChatGPT 憑證，且信任固定的 ChatGPT 端點來驗證它。它防範的是：一般 proxy／API key 呼叫端把此功能當成明文 oracle 使用、把憑證重新導向到其他目的地、跨帳號或跨執行緒的快取重用，以及敏感資料的記錄或持久化。每次查詢快取之前，准入檢查都會核對 token 的發行者、audience、Codex 用戶端、到期／生效時間邊界與確切的帳號相符；簽章權威仍是該端點本身。

它不能防範以同一個作業系統使用者身分執行的另一個程序、遭入侵的 ChatGPT 後端或復原模型、加密任務內部的 prompt injection、模型轉錄錯誤，或對執行中 proxy 的記憶體檢查。因此復原輸出必須被當成不受信任的模型輸出，而不是經過驗證的明文。

```json
{
  "agentTaskRecovery": {
    "enabled": true,
    "model": "gpt-5.6-sol",
    "timeoutMs": 45000,
    "cacheEntries": 200
  }
}
```

只有在可以接受額外的已驗證請求、配額使用、程序內明文邊界與對私有後端的依賴時，才啟用這個功能。若無法接受，請優先使用原生 ChatGPT 子層或 v1 異質委派。

這條復原路徑適用於直接路由的子層，以及加密 combo 的 `NEW_TASK` 生成。同時最多可有 32 個復原請求在進行中；超出的未命中會 fail closed。若 combo 有可用的規範原生目標，仍會直接傳送密文；只有在沒有原生目標可選時，才會執行復原。在已儲存的 Pool 帳號完成 refresh 與同帳號重播都耗盡之後，復原可以用傳入的呼叫端憑證，針對一個可用的路由目標使用一次，不會再嘗試另一個原生帳號。政策上的拒絕仍是終局的。復原失敗、目標耗盡或目標不可用時，仍會 fail closed，不會把密文轉送給路由供應商。

## Effort 上限

上限僅套用於 v2 協作功能：當主回合的工具暴露 v2 時該回合合格，而子回合在 `x-codex-turn-metadata` 中帶有精確的 codex-rs `x-openai-subagent: collab_spawn` 或 `"subagent_kind": "thread_spawn"` 標記時合格，即使葉工具不再暴露協作。V1 主回合、`multiAgentMode: "v1"`、壓縮、審查與記憶整合回合會略過上限。

上限僅會降低 effort。它們吸附到上限或以下的最高宣告級別。若模型沒有 effort 控制或沒有支援的級別符合，opencodex 會移除 effort 並讓供應商預設值套用。`max` 與 `ultra` 被接受，而儀表板提供 `low` 到 `xhigh`。

即使沒有設定模型 effort pin，符合條件的原生 Chat Completions 回合也會套用設定的上限。套用 pin 或上限改變值時才會對應為供應商的傳輸值；兩者皆未發生時，原生呼叫端值保留原始寫法。

關於 v1、default 與 v2 行為的入門導向說明，請見[子代理介面](/zh-tw/guides/sub-agent-surface/)。

## Global model effort pins

選用的根層級 `modelPinnedEfforts` 映射，在未設定 provider 模型 pin 或全 provider pin 時，用來填補或覆寫傳入的 effort 選擇。例如：

```json
{
  "modelPinnedEfforts": {
    "example-provider/example-model": "high"
  }
}
```

查詢會先檢查 provider 前綴正規化之前的最終選擇器，接著檢查限定的 `provider/model` 目的地，再檢查其裸上游模型 ID。原始的 combo 別名與合成 effort-row 選擇器 ID 都不是全域 pin 的鍵；請設定具體的目的地。合成 row 的 effort 與 combo 預設值，在套用 pin 之前會被保留為有效輸入。每個被選中的目的地會先解析自己的 pin，再套用適用的上限與傳輸正規化。壓縮請求不受此規則影響。`none` 代表省略 effort 並採用 provider 預設行為，不保證真的停用 reasoning。

`GET /api/effort-caps` 會包含這個映射。`PUT /api/effort-caps` 在既有上限之外也接受 `modelPinnedEfforts`：省略的欄位維持不變，`null` 會清空整個映射，映射中某個鍵設為 `null` 或 `""` 只會刪除那一個鍵。無效的合併更新會讓上限與 pin 都維持不變。儲存 pin 不會改變精選子代理 roster。
</content>
