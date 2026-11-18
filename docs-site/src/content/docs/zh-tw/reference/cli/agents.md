---
title: CLI 代理、路由與整合
description: 多代理、組合、可觀測性、存取、整合、系統與設定指令。
---

這些指令控制代理政策與路由、檢查即時代理，並將支援的客戶端連接至 opencodex。

## 代理政策

### `ocx agent <status|injection|effort|subagents|fallback|roles|sidecar|memory-models|compaction-routing> ...`

管理無頭多代理名冊、推理強度上限、提示詞注入、備援與旁路設定。
使用 `status` 查看目前的政策。表面模式、委派、推理強度與備援行為如何搭配，請見[子代理表面](/zh-tw/guides/sub-agent-surface/)。

```bash
ocx agent subagents set ark/model-a,openai/gpt-5.5
```

`ocx agent roles` 用於 omo（Codex / LazyCodex）。它會列出 `$CODEX_HOME/agents` 中每個 Codex 代理角色、其模型釘選，
以及 `~/.omo/omo.jsonc` 是否可更新；若未安裝 LazyCodex 則會說明，此時 `set` 會被拒絕。
`ocx agent roles set <role> <model> [--effort <level>]` 只改寫該角色根層級的 `model` 行，搭配 `--effort` 時也改寫其 `model_reasoning_effort` 行，
並把兩者以 `model` 與 `reasoning` 鏡射到 omo.jsonc 的 `[codex].agents.<role>`。LazyCodex 沒有對應等級的推理強度（例如 `ultra`）只會寫入角色檔案。
缺少 omo.jsonc，或其中含有註解時，會維持不變，且指令會說明這一點。請見 [omo（Codex / LazyCodex）角色模型](/zh-tw/guides/integrations/#omocodex--lazycodex角色模型)。

```bash
ocx agent roles set explorer xai/grok-4.5 --effort medium
```

`ocx agent roles suggest` 僅適用於 omo（Codex / LazyCodex），未安裝 LazyCodex 時與 `set` 一樣會被拒絕。
它以對預設 Codex 模型（或 `--model`）的一次呼叫來評估每個角色的規模，並為每個角色輸出建議的模型與推理強度，不寫入任何東西。
`--apply` 會透過與 `set` 相同的寫入路徑寫入每項建議，並略過且點名模型與推理強度已經相符的角色。
請見[自動指派](/zh-tw/guides/integrations/#自動指派)。

人類可讀的建議輸出會把終端機控制字元顯示為可見的跳脫序列。需要原始建議值而不經呈現跳脫時，請使用 `--json`。

`ocx agent injection suggest <work>` 對委派模型做同樣的事：它評估所描述工作的規模，從委派選擇器的清單中建議最便宜且足夠的模型與推理強度，
除非傳入 `--apply`，否則不寫入任何東西；`--apply` 會透過與 `injection set` 相同的寫入路徑儲存。
請見[委派模型與推理強度](/zh-tw/guides/sub-agent-surface/#委託模型與推理強度)。

`ocx agent sidecar web --list` 與 `ocx agent sidecar vision --list` 會輸出伺服器目前為每個旁路提供的模型——
也就是儀表板選擇器顯示的那組精確過濾後集合（選擇器可見的列，加上登入授權的 Luna／Haiku 認證槽位，
網路搜尋與執行者可用性取交集，視覺則排除可證實僅支援文字的模型）。人類可讀的清單會在括號中顯示每個模型的後端。
網路搜尋的 `--model` 寫入會解析該伺服器提供的列，並把它的後端與模型一起保存，所以切換到 Anthropic 選項時不會殘留 OpenAI 後端（反之亦然）。
寫入走的是與 GUI 相同的管理路由，並受相同的逐旁路閘門約束：網路搜尋會拒絕不在所列集合內的後端／模型組合（封閉成員資格），
而視覺只拒絕可證實無法看圖的模型（未知的 ID 仍可寫入）。

```bash
ocx agent sidecar web --list
ocx agent sidecar web --model gpt-5.6-luna
ocx agent sidecar web --enabled off
```

`--enabled off` 與儀表板的 Off 列是同一個開關：OpenCodex 停止執行該旁路，且 Codex 整合會把 `web_search = "disabled"` 寫入 `~/.codex/config.toml`，
這讓 MCP 搜尋伺服器成為唯一的搜尋路徑。`--enabled on` 會再次移除該標記所擁有的那一行。
當儲存確實移動了開關時，指令會回報它所觸發的 Codex 端寫入（`--json` 中為 `codexWebSearch`，否則為最後一行 `Codex config:`），
並在無法完成時指向 `ocx sync`；讓開關維持原狀的儲存沒有東西可回報，也不會輸出 `Codex config:` 那一行。此旗標對 `vision` 同樣適用。

### 注入預設值與旁路執行階段設定

```bash
ocx agent injection status --json
ocx agent injection set --sync-codex-defaults off --json
ocx agent injection status --json
ocx agent sidecar web --stream-routed-output on --json
ocx agent sidecar vision --timeout-ms 30000 --json
ocx agent sidecar status --json
```

執行寫入時只套用所要求的變更。注入的 `--sync-codex-defaults on|off` 會更新 `syncCodexSubagentDefaults`；
省略的 model／effort／prompt／guidance 維持不變，而 `-` 會清除 model／effort／prompt。
收據帶有實際正規化後的 `model`、`effort`、`prompt`、`multiAgentGuidanceEnabled` 與 `syncCodexSubagentDefaults`，而不是捏造的目錄結果。

網路的 `--reasoning` 仍受支援。`--max-descriptions` 與 `--timeout-ms` 僅適用於視覺；逾時接受 1 到 2147483647 毫秒的整數。
`--stream-routed-output` 僅適用於網路。部分寫入會保留同層設定。
新選項的收據只公開選定的公開 `webSearch` 或 `vision` 狀態與 `codexWebSearch` 的套用報告。
`{applied:false, reason, retryable}` 區分原生套用的延後／拒絕與已儲存的設定；缺少或不相符的新設定視為未驗證並以非零結束。
完整的觀察設定（包括網路推理）請讀取 status。遇到擁有權拒絕時不要盲目重試。

### `ocx v2 <status|on|off|mode <v1|default|v2|v2-plaintext>|threads <n>>`

管理 Codex 的 `multi_agent_v2` 功能旗標與四態多代理介面模式。

| 子指令 | 動作 |
| --- | --- |
| `status`（預設） | 回報目前 v2 旗標、多代理模式與執行緒並行數。 |
| `on` | 啟用 `multi_agent_v2` 功能並重新同步目錄；`v2-plaintext` 或混合 pin 生效時會拒絕，因為全域強制會蓋過目錄 pin。 |
| `off` | 停用 `multi_agent_v2` 功能並重新同步目錄。 |
| `mode v1` | 將所有模型強制為 v1、停用原生 v2，並保留現用執行緒上限。 |
| `mode default` | 遵循上游模型介面 pin。 |
| `mode v2` | 將所有模型設為 v2 並保留執行緒上限；`keep-native-v1` 關閉時啟用全域原生 v2，開啟時關閉全域強制並使用目錄 pin。 |
| `mode v2-plaintext --acknowledge-plaintext-agent-messages` | 為新工作階段選擇 V2、關閉全域強制，並以明文傳遞符合條件的工作。進入需要 `--acknowledge-plaintext-agent-messages`。 |
| `keep-native-v1 on\|off` | 在 `mode v2` 下讓原生 ChatGPT 使用 v1、路由模型使用 v2；啟用時關閉全域 V2 強制。 |
| `mode-hint <text>` | 為所有模型與推理強度設定主動委派提示。 |
| `mode-hint --clear` | 移除提示，恢復依推理強度決定的策略。 |
| `threads <n>` | 將現用 v1/v2 執行緒上限設為不小於 1 的整數。 |
| `mode-hint <text>` | 為每個模型與 effort 設定 Proactive delegation hint（Ultra 模式）。 |
| `mode-hint --clear` | 移除該提示，恢復依 effort 決定的政策（ultra = proactive）。 |

```bash
ocx v2 status
ocx v2 mode v1
ocx v2 mode default
ocx v2 on
ocx v2 threads 16
ocx v2 mode-hint "Proactive multi-agent delegation is active."
ocx v2 mode-hint --clear
```

`mode` 子指令將 `multiAgentMode` 寫入 opencodex 設定並重新同步 Codex 目錄。模式與旗標轉換會在有效的 v1/v2 Codex key 之間移動目前的數值執行緒上限；失敗的轉換會還原原始的 `config.toml`。目錄介面變更套用於新的 Codex session，執行中的 session 則保留其 pin；啟用明文編譯也會影響既有 V2 session 的後續合格請求。Subagents 的 Ultra 開啟開關需要已啟用原生功能且模式為 `v2`，或選擇 `v2-plaintext`（其全域強制保持關閉）；僅執行 `ocx v2 on` 不符合條件。

Codex 會在套用所選模型的目錄 pin 之前，先解析已啟用的全域 `multi_agent_v2` 覆寫。因此混合式
`keep-native-v1` 合約會讓那個全域覆寫保持關閉；否則一個標記為 `v1` 的原生列仍會以 V2 啟動，
並產生後端加密的子任務。

即使 `multi_agent_v2` 目前被停用，`mode-hint` 仍會把
`features.multi_agent_v2.multi_agent_mode_hint_text` 寫入 Codex 的 `$CODEX_HOME/config.toml`。
這個指令只會持久化該覆寫；它不會啟用或停用該功能，所以提示會在相符的 Codex 介面啟用時才生效。
該提示會覆寫 codex-rs 依 effort 決定的多代理政策，因此任何模型與任何 reasoning effort 都會收到
Proactive delegation 提示。它**不會**改變 reasoning effort 本身。缺少引數或只有空白字元的值會被
拒絕；只有 `--clear` 會移除該提示。Subagents 儀表板的 Ultra 模式**開啟**開關有更嚴格的門檻：
它要求原生功能已啟用，且介面明確為 v2（`ocx v2 mode v2`）；單獨執行 `ocx v2 on` 無法滿足該儀表板
門檻。

#### 明確的 v2 目標與結果

```bash
ocx v2 status --json
ocx v2 status --live --json
ocx v2 mode v1 --live --json
ocx v2 status --live --json
```

即時寫入使用既有的管理路由。只有明確的即時 `mode` 接受 `--acknowledge-surface-advisory`；只有在要求確認該建議時才加上它。
本機 mode 與 status／on／off／keep-native／threads／hint 會拒絕它。不會自動確認。

若要使用字面上的保留提示文字，請在 `--` 之後傳入一個加引號的運算元：

```bash
ocx v2 mode-hint --live --json -- '--clear'
```

這會儲存字面上的 `--clear`；沒有 `--` 時，`mode-hint --clear` 會移除提示。後綴不會被掃描說明、即時、JSON 或清除控制項；控制項必須放在 `--` 之前。
多餘的運算元與重複的旗標會在變更之前被拒絕。

本機 JSON 為 `{ok, target:"local", action, changed, state, sync}`，使用寫入後的實際狀態。
Mode／keep-native 與有變更的 on／off，即使沒有探索到連接埠，也保留其真實的同步嘗試；threads／hints 與沒有變更的 on／off 不增加同步。
缺少或格式錯誤的同步結果會變成未驗證並以 1 結束，而不是成功。失敗之後 `changed` 或 state 可能未知；不要宣稱已回滾。
即時 status 以 `target:"live"` 回報已驗證的狀態／建議／推薦；寫入會加上 `ok:true` 與 `catalogRefresh`。只有已提交且未降級的重新整理才以 0 結束。
HTTP 502 可能表示原生狀態被部分套用：重試之前請先檢查。本機用法錯誤維持結束碼 1；新的即時用法錯誤使用結束碼 2。

## 組合路由

### `ocx combo <list|show|set|remove|stats> ...` · `ocx route combo ...`

管理 combo 容錯移轉與輪詢式虛擬模型。`ocx route combo` 是階層式別名；combo 與路由設定檔是不同的資源。
Combo 目標使用 `provider/model[:weight],provider/model[:weight]`。

```bash
ocx combo list
ocx route combo set reliable --targets ark/model-a:2,openai/gpt-5.5
```

`set` 接受 `--strategy`、`--sticky`、`--effort`、`--alias`、`--rename-from`、`--native-alias` 與 `--display-name <label|->`（`-` 會清除標籤）。
原生別名只擷取一個目前支援、不含限定詞的裸 OpenAI 模型 ID。裸的 `gpt-5.6-*` 原生別名使用 Codex Pool／Direct 憑證。
帳號限定的 OpenAI 路由仍然是各自獨立的，而供應商限定的路由（例如 `openai-apikey/gpt-5.6-*`）使用它們已設定的 API 金鑰，絕不會落到原生別名上。
啟用相容性配對之前，請閱讀指南中的安全與可見性契約。
僅使用 `--strategy jev` 時，決策方法由兩個互斥旗標之一選定。
`--decision-provider <provider|->` 指名一個已設定的 `jev-decision` 列（例如自行架設的 Ollama `tev1`），作為相容 System One 的伺服器。
`--decision-model <route|->` 指名一個一般的 opencodex 路由（例如 `ollama/qwen3:4b`），以 JSON 回答同一個選擇；它不能是此 combo 或任何 JEV combo。
兩者都省略則使用 TypeSafe。`--decision-timeout <ms|->` 設定決策期限（1000–120000，預設 4000）；`-` 會清除這三者中的任何一個。

`ocx combo test [--combo <id>] [--decision-provider <provider|jev> | --decision-model <route>]
[--decision-timeout <ms>]` 會透過已儲存 combo 的方法或未儲存的選擇送出一個合成決策探測，並回報閘門、後端與延遲；它可能花費一次決策呼叫。
`ocx combo discover [--query <text>]` 會列出已設定的 System One 列，以及看起來像決策模型的目錄模型，並附上推導出的端點。

要取得結構化的目標中繼資料，請檢視離線說明與目前的 combo：

```bash
ocx combo set --help
ocx combo list --json
ocx combo show reliable --json
```

`--targets-file` 文件是一個非空且有順序的陣列，例如下列形狀（請把 provider／model 的值換成實際設定的候選者）：

```json
[{"provider":"example","model":"raw/model","weight":1,"reasoningEfforts":["high"],"modelProfile":"Reasoning tasks","lastResort":false}]
```

選用欄位為 `weight`、`reasoningEfforts`、`modelProfile` 與 `lastResort`。
推理強度是 `low`、`medium`、`high`、`xhigh`、`max`、`ultra` 中不重複的非空清單；空／none／minimal 的自訂模型語意不適用。
檔案或明確以管線傳入的 `-` 有 4 MiB 上限與 30 秒讀取期限；序列化後的管理本文也必須符合 4 MiB。未知欄位會在寫入之前被拒絕。

```bash
ocx combo set reliable --targets-file targets.json --image-input auto --reasoning-effort-mode strict --json
ocx combo show reliable --json
```

`--targets-file` 與 `--targets` 互斥。兩者都省略時，部分編輯會保留完整的目標中繼資料；替換檔案會保留順序與明確的 `lastResort: false`。
`--image-input auto|disabled` 與 `--reasoning-effort-mode strict|adaptive` 保留省略狀態，而明確的 `auto` 與 `strict` 會覆寫已儲存的 disabled／adaptive 值。
推理強度模式與 `--effort-mode fallback|force` 是分開的，後者管理的是預設推理強度。
`--allow-metered-targets on|off` 會在僅限 loopback 的 proxy 上，授予或清除對已標記 combo 目標的操作者同意；公開與已連結的呼叫端仍需要已設定的金鑰同意。
`--native-alias on|off` 保留明確的 false；舊式的裸旗標代表 true。關閉它可能需要明確的別名清除 `--native-alias off --alias -`，以避免殘留不相容的原生別名。
Set／rename 是沒有 CAS 的 upsert，所以變更之後請重新讀取。收據為 `{success, id, model, combo, catalogRefresh}`；
目錄重新整理被略過、失敗或降級時，在儲存之後以非零結束。

### 觀察 combo 決策統計

```bash
ocx combo stats reliable --range 30d --json
```

請使用 list／show 中儲存的確切 combo ID，而不是它的公開模型或別名。範圍為 `7d`、`30d`（預設）與 `all`。
這會讀取已記錄的 JEV 觀察，而不執行付費的決策探測。請分別檢視決策、模型嘗試、已量測嘗試、模型權杖與決策權杖。
請把 `measuredModelAttempts/modelAttempts` 與 `decisionUsageReported/decisions` 的涵蓋比例與總數放在一起。可為 null 的平均值表示不可用，而不是零。
請保留 `usageIncomplete`、`historyTruncated`、`entriesTruncated`、被丟棄的項目數與快照視窗邊界。零筆觀察不能證明成功。
此報告沒有金額成本或比較性節省的欄位。

路由行為與設定指引請見 [Combos](/zh-tw/guides/combos/)。

## 關閉備援

### `ocx fallback <status|off|on|clear|local> ...`

```bash
ocx fallback status --json
ocx fallback off --kind provider
ocx fallback on --route combo/coding
ocx fallback clear --provider anthropic --kind model
ocx fallback local on --device mac-studio
```

`off`、`on` 與 `clear` 接受 `--kind model|provider|all`（預設 `all`）以及最多一個範圍：`--provider <name>`、`--route <selector>` 或 `--device <id|alias>`；都沒有時設定全域開關。
設為 off 的裝置一律拒絕；否則路由優先於供應商，供應商優先於全域。`local` 記錄裝置在 Home 無法連線時，是否可使用它自己的供應商——這是 GOAT 讀取的權限；OpenCodex 本身在該情況下仍回答 `home_unreachable`。
這些指令與執行中的 proxy 通訊；在 Remote Link Child 上，`status` 讀取 Home，而寫入會被拒絕。請見[關閉備援](/zh-tw/guides/fallback-off/)。

## 路由設定檔

既有的設定檔支援透過即時 API 檢視與評估：

```bash
ocx route policy list --json
ocx route policy show reliable --json
ocx route policy dry-run reliable --model-context 128000 --tools --image --structured-output --json
```

只有在有權在目標上啟用 Lab 時才執行此評估。管理 POST 可以啟用 Lab，並啟動該處已啟用的自動化，包括上游探測。若要觀察而不產生該啟用效果，請使用 list／show。

請把 `reliable` 換成列出的 ID。`evaluate` 是 `dry-run` 的別名；兩者都會在沒有推論請求的情況下，把需求送到已儲存設定檔的評估器。
建立、更新與刪除使用下方明確的檔案／修訂流程。Combo 寫入編輯的是另一個資源。找不到的設定檔以結束碼 4 結束，缺少運算元以 2 結束。

### 依觀察到的修訂編輯路由設定檔

建立／更新可以啟用 Lab 與已啟用的自動化，包括上游探測。請只在有該權限時才執行。List／show 是觀察性的；請先讀取離線說明並儲存預期的設定檔：

```bash
ocx route policy update --help
ocx route policy show reliable --json > profile.observed.json
jq 'del(.id, .model, .revision) | if .alias == null then del(.alias) else . end' profile.observed.json > profile.next.json
```

編輯並檢視下一個檔案；觀察到的檔案保持不變。輸入只含可編輯的 `alias`、`candidates`、`require`、`optimize`、`limits`、`unknownEvidence` 與 `compatibility`，及其受支援的巢狀欄位。
`id`、`model`、`revision`、未知的鍵與 null 的別名都不是可編輯的輸入。伺服器仍會驗證供應商、別名與政策語意。
`--file -` 接受管線傳入的 stdin；一般的 UTF-8 檔案／stdin 適用 4 MiB 與 30 秒的有界讀取契約。

```bash
ocx route policy update reliable --file profile.next.json --expected-revision '<exact-revision-from-observed-show>' --json
ocx route policy show reliable --json
```

請明確使用原始的不透明修訂。HTTP 409／結束碼 5 表示重新讀取 show、檢視並行變更並重建編輯。絕不默默擷取替換修訂、重試，或把更新轉成建立。
對於已授權的新 ID，請使用 `ocx route policy create <new-id> --file profile.next.json --json` 且不帶修訂。已授權的移除是
`ocx route policy remove <id> --yes --json`，且沒有修訂防護。

建立／更新回傳 `{success, id, model, profile, catalogRefresh}`，附有新的 `profile.revision`；移除回傳 `{success, id, catalogRefresh}`。
只有已提交且未降級的重新整理才以 0 結束。已儲存的收據若重新整理被略過／失敗／降級則以 1 結束：請先檢查再復原，而不是重複設定寫入。

## 相容性 Lab

Lab 是本機檢視**以及**明確的證據／自動化管理。讀取使用本機投影，不需要執行中的管理 API：

```bash
ocx lab status --json
ocx lab catalog --json
ocx lab subjects --limit 10 --json
ocx lab automation status --json
ocx lab automation runs --limit 10 --json
ocx lab public community --json
```

`subject`、`observations`、`event`、`artifact` 與 `production-signals` 依循本機證據譜系。公開的家族提供以重複的 `--event <id>` 做預覽／匯出、
以 `--file <bundle.json>` 做驗證／匯入，以及社群上下文。匯出與匯入會寫入本機證據。當 bundle 在密碼學上無效時，驗證仍可輸出其結果並以非零結束。

自動化的啟用／停用會變更本機政策；手動 `lab run` 會選擇一個層與情境，且可能花費上游配額。在這些已授權的操作之前，請閱讀 `ocx help lab` 與相關的子指令。
已儲存的本機政策不能證明另外執行的 proxy 的排程器已採用它。這些 CLI 控制項未公開完整的自動化政策編輯與執行取消。

## 可觀測性與除錯

### `ocx observe <logs|usage|storage|memory|debug|claude-inbound|injection> ...`

檢查代理請求、用量、儲存、記憶體與除錯資料。直接別名如下：

| 別名 | 等效資源 |
| --- | --- |
| `ocx logs [filters] [--follow] [--json|--jsonl]` | `ocx observe logs` |
| `ocx usage [--range <today|1d|7d|30d|all>] [--since <timestamp> --until <timestamp>] [--surface <all|codex|claude|grok>] [--provider <name>] [--model <id>] [--json]` | `ocx observe usage` |
| `ocx storage [--json]` | `ocx observe storage` |
| `ocx memory [--json]` | `ocx observe memory` |

```bash
ocx observe usage --range 30d --json
ocx usage --since 2026-09-01T09:00:00Z --until 2026-09-01T10:59:59.999Z --json
```

`--since` 與 `--until` 必須同時提供。它們接受整數的 epoch 毫秒，或帶有明確時區的完整 ISO
日期時間，會包含兩端點，並會覆寫 `--range`。無效或前後顛倒的範圍會在送出請求前失敗。人類可讀
輸出會印出所請求的區間；`--json` 會包含 `customWindow`、`since` 與 `until`。既有的
surface／provider／model 篩選條件仍然適用。這些指令查詢的是執行中的代理；它們不提供離線報告。

`--range today`（別名 `1d`）回報目前的本機當日資料。`--provider` 與 `--model` 會把報表縮小到
單一上游目標——這與 `--surface` 不同，`--surface` 選擇的是發出呼叫的客戶端（Codex、Claude Code、
Grok），而不是實際服務請求的供應商。

預設檢視會印出請求數、token 數與估計成本總計，以及依供應商與依模型的細分。成本是 API 牌價的
對應值，不是計費收據：訂閱方案與供應商配額是分開計費的，而沒有對應價格列的請求會被計為
`unpriced`/`unmetered`，而不是併入為零。

```bash
ocx usage --range today --provider xai
```

部分用量記錄無法納入時，人類可讀輸出會顯示警告，即使沒有可讀取的記錄也是如此。顯示的總數僅反映可讀取的記錄。如果篩選條件沒有符合的可讀取記錄，輸出將顯示警告和提示，而不顯示總數列；被略過的記錄可能包含符合項目。`--json` 原樣保留回應中的 `usageIncomplete` 診斷及原因。

### 與前一個等長視窗比較範圍

```bash
ocx usage compare --range today --json
ocx usage compare --range 7d --provider xai
```

`ocx observe usage compare` 是對等的家族形式。該指令會讀取兩次 `GET /api/usage`：以現在為結尾的指定範圍，然後是提早一個等長視窗所評估的同一範圍
（`today`／`1d` 為一個本機日、`7d` 為七個、`30d` 為三十個）。預設範圍是 `30d`。
`--range all` 會被拒絕，因為開放式歷程沒有前一個等長視窗。`--since` 與 `--until` 不被接受；視窗是推導出來的。
Surface、供應商、模型與 API 金鑰的過濾條件同時套用於兩次讀取。人類可讀的輸出會顯示目前值、前一個值、帶正負號的差值與百分比變化。
`--json` 為 `{schemaVersion,range,current,previous,delta,change,incomplete}`。兩次讀取是依序進行，不是原子快照。
每個回應上的自訂 `since`／`until` 必須符合所要求的視窗。兩次讀取使用同一個連線與憑證。若連線、帳號或憑證在指令執行期間變更，
它會回報擁有者不符並要求你重試，而不是輸出比較結果。

### 分頁讀取已索引的請求歷程

```bash
ocx logs history --provider xai --status 200 --limit 50 --json
ocx logs history --cursor '<nextCursor>' --json
ocx logs get <request-id> --json
```

`ocx observe logs history` 與 `ocx observe logs get` 是對等的家族形式。它們讀取的是衍生的請求歷程索引，而不是最近的 `ocx logs` 環形緩衝。
`--limit` 為 1–100（預設 50）。`--from` 與 `--to` 接受 epoch 毫秒或含時區的完整 ISO 日期時間，且為包含邊界。
`--json` 回傳 `{entries,hasMore,nextCursor,index}`。`--jsonl` 只輸出列；還有更多頁時，`nextCursor=…` 會輸出到 stderr，讓呼叫端可以接續，而不會把權杖混進列串流。
沒有符合的結果仍為成功。`get` 依請求 ID 回傳一個標準列；`ocx logs explain` 仍是同一個 ID 的路由決策檢視。

### 篩選有界的日誌快照

```bash
ocx logs filter --surface claude --status errors --time-window 1h --scan-limit 2000 --limit 50 --json
```

`ocx observe logs filter` 是對等的家族形式。它讀取一個最近的視窗，在本機過濾，然後依原本順序保留最新的符合項目。
`--scan-limit` 控制擷取的列數（1–2000，預設 2000）；`--limit` 控制回傳的列數（1–2000，預設 200）。JSON 回報
`{schemaVersion:1,logs,cursor,filters,window:{scanLimit,loaded,matched,returned,limit}}`。計數描述的是這個觀察到的視窗，不是全部歷程。
JSONL 只輸出列；沒有符合的結果仍為成功。游標中繼資料不是可接續的搜尋權杖。

選擇器包括 `--surface all|codex|claude|grok`、`--status all|success|errors`、`--time-window all|15m|1h|24h`、`--model`、`--provider`、
`--conversation`（別名 `--conversationId`）、`--intercepted-only`、`--min-tok-per-sec`、`--max-tok-per-sec`，以及
`--protocol-mode all|native|translated|legacy-bridge|blocked|none`。模型／供應商的相等比較會去除空白且不分大小寫，包括已解析／實際服務的模型與嘗試。
Claude 包含 Desktop；Codex 指的是沒有 surface。成功為 HTTP 200–299，錯誤為 400–599。時間下限為包含邊界。
速度使用觀察到的 value-kind tok/s，最小值包含邊界、最大值不含；不可用的值會使啟用的速度過濾失敗。
Protocol none 包含沒有或無效的追蹤。對話比對使用與一般日誌相同的雜湊感知 ID。攔截會選取字串值的改寫標記。

未知／重複／互相衝突的旗標、無效的界線，以及 follow／events，都會在探索之前失敗。格式錯誤、過大或失敗的讀取為非零，而不是空結果。
要縮小回應大小，請降低掃描上限；降低輸出上限不會改變擷取。需要串流時，請使用下方獨立的 follow 形式。

### 搜尋用量模型列

```bash
ocx usage --range 7d --search 'model-a' --json
```

`--search` 在讀取報告之後，會以去除空白且不分大小寫的子字串，比對模型、供應商或已解析的模型。它依總權杖數遞減排序模型列（並列時順序穩定），預設最多保留 100 列。
JSON 會加上 `modelView:{query,matchedModelCount,returnedModelCount,limit:100,truncated}`；人類可讀的輸出會標示該檢視並顯示其選出的模型列。
報告總計、供應商／日期／帳號列、精確過濾條件與不完整／視窗中繼資料維持不變。沒有符合的模型不代表報告中沒有用量。

明確的空白查詢（`--search=`）會選取前 100 檢視；省略 search 則維持既有輸出。精確的 `--provider`／`--model` 仍會限定底層報告的範圍。
Search 不會放寬選定金鑰或已連線用戶端的自身範圍，也絕不會作為新的 Hub API 查詢參數送出。

`ocx usage --top 25`（也可用 `ocx observe usage --top 25`）把人類可讀的模型表格上限設為 1 到 1000 的整數。預設為 10，使用 `--search` 時為 100；上限在搜尋過濾之後套用。它只改變本機顯示：報告總計、供應商／帳號列與 API 參數保持不變。搭配 `--json` 時，有效的 `--top` 會被忽略；JSON 仍維持既有的完整報告或 100 列的搜尋檢視。無效的上限在擷取之前以結束碼 2 回傳。

### 已儲存的伴隨用量總計

```bash
ocx companion show --json
ocx companion usage --json
```

第二個指令會讀取已儲存的伴隨設定，然後在同一個管理執行階段上依序讀取今日與 30d 用量。它套用已儲存的 `models` 與 `hiddenProviders` 偏好，並保留未知／未量測的成本與權杖。
Null 的模型選擇表示全部；空的選擇表示沒有。它不會變更設定、操作原生視窗，或透過已連線的用戶端轉送。

JSON 回傳 `schemaVersion:1`、`filters`、`settingsUpdatedAt`、`settingsCorrupt`、`settingsFallback`、`ranges` 與 `partial`。
每個範圍帶有 `status:"available"` 與過濾後的 `data`，或 `status:"unavailable"`。不可用的範圍會設定 partial 並以 1 結束，同時保留另一個範圍。
可用但不完整的資料保留它自己的中繼資料；它不是量測到的零。有效的伺服器預設值保留 null 的設定時間戳並設定 fallback；
損毀檔案的預設值另外設定 corrupt，並在人類可讀的輸出中警告。格式錯誤的設定會在讀取用量之前停止。這些讀取不是原子快照。
每個 GET 在探索之後有 10 秒的擷取／本文期限與 32 MiB 的回應上限；這不是整個指令的期限。訊號以 130／143 結束，且沒有遲到的結果。

### 追蹤請求視窗或注入序列

```bash
ocx logs --help
ocx logs --limit 200 --json
ocx logs --follow --events --limit 200
```

`--events` 需要 follow 並隱含 JSONL；多餘的 `--jsonl` 會被接受。`--json` 維持單次，並與 follow／events 衝突。
每一行 events-v1 為 `{schemaVersion:1,type:"snapshot"|"append",rows,cursor,limit}`。收到 snapshot 時取代消費端視窗，收到 append 時附加／修剪，並保留順序與重複的 ID。
初始為空，以及重設／移除的 snapshot 會被輸出；穩定為空的輪詢維持靜默。舊式陣列是 cursor 為 null 的 snapshot，不會憑空產生 cursor。
這些是觀察到的視窗，不是對輪詢之間或環形緩衝逐出後遺漏流量的無損重播。

`ocx logs --follow --jsonl --limit 200` 保留列形狀的輸出。它會重新輸出有變化的出現項目，包括相同 ID 的狀態／權杖修正與重複的 ID。
不要依請求 ID 全部合併。此舊式輸出無法編碼移除、重設或精確的視窗順序；當這些差異重要時，請選擇 events。日誌 follow 上限為 1–2000，預設 200。

```bash
ocx observe injection --limit 500 --json
ocx observe injection --follow --jsonl --limit 500
```

注入會輸出有順序的 `{seq,at,line}` 列，其中 `at` 為 epoch 毫秒；內部的 `after` 隨 seq 前進。Follow 上限為 1–2000，預設 500。
JSON 為單次，JSONL 需要 follow。觀察不會啟用擷取。空的輪詢無法辨識擷取已停用，也不能證明沒有缺口。
可偵測的執行階段漂移會停止；沒有 API 的 epoch／缺口標記，就無法排除不可偵測的重新啟動／最新 N 筆缺口。

兩種 follow 迴圈都使用循序的一秒等待、10 秒的擷取／本文期限與 32 MiB 的回應上限。格式錯誤／過大／傳輸錯誤會以 stderr 停止並以 1 結束，不自動重試／重新連線。
視窗過大時請降低上限。SIGINT／Ctrl-C 以 130 結束、SIGTERM 以 143 結束，之後沒有輪詢或輸出。請檢查結束狀態與保留的列，而不要把取消當成完整歷程。

### 伴隨時間軸與金鑰範圍用量

```bash
ocx companion timeline --help
ocx companion timeline --hours 24 --bucket-minutes 60 --metric total --aggregation sum --grouping model --model example/model-a --hide-provider excluded-provider --json
```

請把虛構的 ID 換成選定的過濾條件。對個別的 provider／model ID 重複使用 `--model`（允許巢狀斜線；不是 CSV）；重複使用 `--hide-provider` 以排除供應商。
不支援正向的 `--provider`。小時數為 6／24／72／168，bucket 分鐘數 1–1440 且最多 2000 個 bucket，指標為 total／input／output／cached，
聚合為 sum／average／max，分組為 model／modelAccount。API 將過濾輸入限制在 100 個項目。這會讀取用量，且不變更伴隨設定。

請檢查 `appliedFilters.models/hiddenProviders`。時間軸界線為 epoch 秒，結尾不含，與一般用量以毫秒計的自訂視窗不同。
結尾必須符合請求當下的 bucket；若請求跨越 bucket 邊界，則為其緊接的下一個；較舊的對齊視窗會被拒絕。空的序列保留 bucket／過濾中繼資料。
`missingMeasurements` 與 `truncated` 必須保持可見：以零填補的點不能證明完整的零用量。

在非用戶端的管理主機上：

```bash
ocx access key list --json
ocx usage --api-key-id key-example --range 7d --json
```

請使用非機密的實際金鑰 ID。CLI 要求回應中的 `filter.apiKeyId` 有精確的確認；被忽略的過濾條件會失敗，而不是顯示未限定範圍的總計。
未知但已被確認的 ID 可能回傳 `matched:false` 與空流量，而不是 404。請保留不完整／自訂視窗的事實。
已連線的用戶端會在存取已登記金鑰或傳輸之前拒絕 `--api-key-id`；請對既有僅限自身的 Hub 用量省略它，或在 Hub 上執行選定金鑰檢視。資料金鑰不授予管理權限。

### `ocx debug <provider|usage|injection|claude> <on|off|status|reset|logs [-f]>`

透過執行中代理的管理 API 讀取或變更執行階段除錯覆寫。

```bash
ocx debug provider on|off|status|reset
ocx debug provider logs [-f|--follow]
ocx debug usage on|off|status|reset
ocx debug usage logs [-f|--follow]
```

無 scope 時，`ocx debug` 印出用量，並在代理停止時印出下次啟動的環境預設值。供應商除錯預設來自 `OCX_DEBUG=1`（舊版 `OCX_DEBUG_FRAMES=1` 亦可）；用量除錯預設來自 `OPENCODEX_USAGE_DEBUG=1`。

## API 存取

### `ocx access <key|endpoints|models|test|audio> ...`

使用 access 家族檢視准入金鑰、外部端點與模型。`ocx api-key` 是 access 金鑰家族的別名。建立與開始輪替會在文字與 JSON 輸出中回傳一次性的明文憑證。
代理必須把這些步驟留給代理工作階段之外、由人操作的終端機；只要求確認與非機密的金鑰／輪替 ID，絕不索取憑證。

```bash
ocx access key list --json
```

在人設定並驗證替換金鑰之後，提交其輪替或移除舊金鑰需要另外明確的撤銷授權。安全的非機密後續動作為
`ocx access key rotate commit <id> <rotation-id> --json` 與 `ocx access key rotate abort <id> <rotation-id> --json`，且需具備所選動作的授權。
之後請重新列出。僅憑缺少待處理狀態不能證明已提交：到期或中止也可能清除它。不要直接發出回傳機密的管理請求來繞過同意。

### 重新命名一個金鑰而不變更其存取政策

```bash
ocx access key rename key-example 'Research client' --json
ocx access key list --json
```

請使用實際唯一的 ID 或不含歧義的名稱。重新命名只送出 `{id,name}` 並保留供應商／模型範圍；它不會輪替／刪除金鑰。
回應包含 id／name／createdAt 與選用的 allowedProviders／allowedModels，絕不含明文或前綴。清單仍為遮罩。名稱不含控制字元、已去除空白、非空，且最多 64 個 JavaScript 字串單元。
讀取／重新命名的序列不是 CAS；結果不明時，請先檢查遮罩後的名冊再重試。根層的 `api-key rename` 別名使用同一個指令。

### 明確指定金鑰的模型與音訊檢查

不連絡上游即可探索已安裝的語法：

```bash
ocx access test --help
ocx access audio transcribe --help
ocx access audio live-check --help
```

模型請求、音訊上傳與即時工作階段檢查，需要操作者針對該特定上游操作與可能的配額／成本給予明確授權。操作者在代理工作階段之外、由人操作的終端機中，
從經核准的私有 stdin 來源提供選定的金鑰。代理不得擷取它或在聊天中索取它。絕不把它放進 argv／環境變數。
以下是該私有管線的 ocx 這一側，不是直接的互動式金鑰提示，也不是代理執行的批次：

```bash
ocx access test example/model --protocol responses --api-key-stdin --json
ocx access audio transcribe sample.wav --model gpt-4o-mini-transcribe --api-key-stdin --json
ocx access audio live-check --model gpt-live-1-codex --api-key-stdin --json
```

只選擇已授權的任務與真實的模型／檔案。TTY 輸入會被拒絕。輸入限制為 4096 位元組／30 秒、有效的 UTF-8 可列印 ASCII，且不含外層空白、控制字元或額外行；允許一個結尾的 LF／CRLF。
這刻意只涵蓋目前核發的金鑰，不是伺服器設定可能接受的每個 Unicode 值。允許的文字中出現的、完全一致的所提供金鑰，會變成 `[redacted]`；不保證偵測任意編碼。不會輸出經編碼的金鑰載體。

目標是已檢查的本機服務來源，或既有且已正規化的已登記 Hub 來源，並在非同步工作前後檢查身分。沒有自訂來源、管理員或已登記金鑰的備援、不跟隨重新導向、不快取憑證，也不自動重試。操作者只向代理回報非機密的結果。

#### 模型控制與回應限制

協定為 chat（預設）、responses 或 messages。選定金鑰模式會先對該端點送出一個不帶憑證、JSON 格式錯誤的控制請求。只有原生需要金鑰的 401 才會推進到一個固定的 16 權杖模型請求，並使用所提供的金鑰。
控制請求有 5 秒／4096 位元組的回應預算；該請求有 60 秒／2 MiB 的回應預算（含讀取本文）。無驗證／無法辨識的控制請求會在推論之前停止。本機日誌／准入記帳仍可能發生。

JSON 為 `{schemaVersion:1,control:{outcome,status?},request:{outcome,status?},response?}`。安全的回應包含協定、有順序的文字、完整／受限的完成狀態，以及選用的量測權杖數。
可用但受長度限制的回覆為 `limited`；拒絕／內容過濾／僅工具或格式錯誤的回應即使 HTTP 為 2xx 也是不支援。錯誤中繼資料、ID、工具與推理不會輸出。
操作失敗會保留一份有版本的報告，加上固定的 stderr／結束碼 1；無效的語法／金鑰輸入以 2 結束，且不產生捏造的報告。

成功時只會輸出：“Credentialless request was refused; the model request using the supplied key succeeded.”
兩次呼叫之間，listener／政策仍可能變更；這不能證明金鑰範圍、原子准入或計費身分。沒有 `--api-key-stdin` 時，舊式的測試 JSON 維持其原始承載，且對新選定的金鑰不提供任何資訊。

#### 轉錄與即時就緒

轉錄需要一個非空的一般檔案，上限 25,000,000 位元組並有 30 秒的本機讀取限制，且 multipart 本文上限 32 MiB。
模型為 gpt-4o-transcribe、gpt-4o-mini-transcribe 或 whisper-1，視目標支援而定。上傳／回應共用 130 秒；回應上限 2 MiB。
成功時只回傳 `{text}`（含空文字），並做精確金鑰遮蔽。失敗時 stdout 為空，並輸出固定的 stderr／非零結束；沒有 JSON 錯誤信封或原始本文。

音訊使用明確金鑰的准入，不含模型控制。Live-check 只送出固定的 session.update 與 session.close。
就緒需要在 15 秒內收到帶有非空白原生工作階段 ID 的 session.started 或 session.updated；僅 socket 開啟或 session.created 並不足夠。
就緒之後，它最多再等 2 秒等待正常的 code-1000 關閉。每個 UTF-8 框上限 64 KiB，總計 2 MiB；不保留框歷程。

即時 JSON 為 `{schemaVersion:1,ready,close:"confirmed"|"unverified",check:"session-readiness",event?}`。操作失敗會保留該觀察，且不含原始框。
部分就緒但關閉未驗證時以 1 結束；之後的正常關閉不能抹除較早的錯誤。訊號以 130／143 結束。
這只檢查就緒／關閉，不檢查麥克風、上傳、工具執行、完整語音往返或伺服器租約釋放。開啟上游工作階段不保證免費。不會自動重新連線或重試。

### `ocx api <protocols|explain|policy> ...`

檢查並設定請求在用戶端 API 與供應商線路之間如何傳送。詞彙說明見
[協定路徑](/zh-tw/guides/protocol-paths/)。

| 指令 | 路由 | 是否改變狀態 |
| --- | --- | --- |
| `ocx api protocols [--provider <name>] [--json]` | `GET /api/protocols` | 否 |
| `ocx api explain --model <id> --inbound <responses\|chat\|messages> [--feature <key>]... [--json]` | `POST /api/protocols/plan` | 否 |
| `ocx api policy [--json]` | `GET /api/protocols` | 否 |
| `ocx api policy [--messages <on\|off>] [--unrepresentable <legacy\|reject>] [--rollout <switch>=<on\|off>]... [--json]` | `PATCH /api/protocols/settings` | 是 |

- `protocols` 印出合約版本、每個用戶端 API 是否被服務與原因、無法表示的政策、每個分階段開關，
  以及政策修訂版本。`--provider` 會加上該供應商實際收到的上游線路格式、由誰決定，以及在另一個
  線路格式上的模型。
- `explain` 預覽模型從某個用戶端 API 出發會走的路徑。`--feature` 可重複指定，也接受逗號分隔的
  清單；`ocx api protocols --json` 會列出已知的功能鍵。預覽是從設定計算出來的：不會送出任何內容
  給上游，不會推進組合輪換，輸入也不會被記錄。
- `policy` 沒有設定旗標時只會讀取。帶上旗標時，會向執行中的代理送出單一變更，代理驗證後儲存
  設定並回傳新政策。`--messages off` 也會關閉 Claude 整合，如同儀表板的切換開關。開關名稱與
  組合會由代理驗證；例如除非在同一指令中 `managedMessagesNative` 已開啟或同時開啟，否則
  `--rollout managedMessagesNativeOAuth=on` 會被拒絕。

```bash
ocx api explain --model combo/main --inbound chat --feature request.seed,request.tools
ocx api policy --rollout shadowPlan=on
```

用法錯誤會在送出任何請求之前以 exit 2 結束。`--json` 會原樣印出管理 API 的回應內容。
確認新金鑰已設定並通過連線驗證，不等於核准撤銷舊金鑰。確認輪替或刪除舊金鑰前，必須另行取得撤銷該金鑰的明確授權。執行獲准的操作後，請再次檢視清單。不要透過直接呼叫 API 繞過此流程。

## 客戶端整合

### 基本整合指令

| Command | Action |
| --- | --- |
| `ocx integration client status [--client <id>] [--profile <id>] [--json]` | Read all managed file integrations, one client, or Aside profiles. `show` and `list` alias `status`. |
| `ocx integration client history [--client <id>] [--profile <id>] [--json]` | Read rollback operations and snapshot availability. `journal` aliases `history`. |
| `ocx integration client enable --client <id> [--profile <id>] [--overwrite-conflict] [--json]` | Apply the managed file integration. Overwriting a conflicting block requires the explicit flag. |
| `ocx integration client disable --client <id> [--profile <id>] [--json]` | Remove the selected managed integration through its runtime owner. |
| `ocx integration client restore --op <opId> [--client aside --profile <id>] [--confirm-drift] [--json]` | Restore a recorded operation; replacing later edits requires explicit drift confirmation. |
| `ocx integration native [list] [--json]` | Read native integration state. |
| `ocx integration native <claude\|claude-desktop\|codex\|grok> <on\|off> [--json]` | Write the selected native client's configuration through its runtime owner. |

這些指令需要執行中的 proxy。`--profile` 選擇非負的 Aside 帳號 ID 並需要 `--client aside`；省略 profile 時，讀取選擇彙總，未綁定的 enable／disable 則套用到所有 profile。
原生開關會變更用戶端設定；Cursor 另有下方唯讀的檢視指令。預覽與綁定寫入選項請繼續參考下方的範例。

### 預覽並復原受管理的檔案整合

```bash
ocx integration client preview --client hermes --operation apply --json
ocx integration client restore --op op-example --preview --json
```

`op-example` 是虛構的；請使用歷程中的 ID。預覽操作為 apply、overwrite 與 disable；restore 在其既有指令上使用 `--preview`。
請檢視結構性變更與 `canApply`／`willChange`；有效的拒絕／無操作以 0 結束且不套用。Enable／disable／restore 接受選用的 `--plan-fingerprint` 以做明確的綁定提交。
直接的舊式寫入仍然可用。Aside 的預覽或綁定寫入需要 `--client aside --profile N`。漂移確認與覆寫絕不自動進行；過期的綁定以 5 結束，stdout 為空，並在 stderr 給出重新預覽的指示。
請依循[完整的預覽／提交與漂移範例](/zh-tw/guides/integrations/#preview-and-bind-a-terminal-write)。

Droid 的 apply／overwrite 支援重複的 `--reasoning-default MODEL=EFFORT` 以完整取代對應表，或獨占的 `--clear-reasoning-defaults` 以得到 `{}`。省略則保留對應表。
請在預覽與提交中重複相同的完整對應表；請見 [Droid 預設值](/zh-tw/guides/integrations/#factory-droid)。

移除歷程無法復原，且需要精確的 opId 加上 `--yes`：`ocx integration client history remove --op op-example --yes --json` 指向全域日誌。
只有 `--client aside` 與選用的 `--profile N` 提供較窄的刪除範圍。最新的一列受到保護。`snapshotRemoved:false` 在退役之後以 1 結束，表示清理未完成；請不要重試刪除或宣稱已回滾。

`ocx integration client sync --client aside --json` 透過已驗證的擁有者重新整理符合資格的 profile，沒有 profile 選擇器或本機備援。
空的 `results` 表示成功觀察到沒有符合資格的 profile；有失敗的列會讓彙總為非零，同時保留其他成功項目。重試之前請先讀取 status 與復原事實；
[Aside 控制](/zh-tw/guides/integrations/#aside-profile-controls)說明 profile 意圖與檔案狀態的差異。

### 檢視 Cursor 而不安裝

```bash
ocx integration native cursor status --json
ocx integration native cursor local-installer --json
```

Status 可以收集模型清單；安裝程式查詢可能會取得公開的 manifest。它們不會下載／安裝或切換 Cursor。Status 會區分憑證與預留位置閘道模式；預留位置不是存取憑證。
安裝程式的 `{available:false,url:null,version:null,reason:null}` 是有效的，包括 Private Inference 已安裝時。有效的不可用讀取以 0 結束。

### `ocx integration <claude|grok> ...`

管理支援的 Claude 與 Grok 整合。下方的直接指令家族暴露其客戶端專屬控制。

### `ocx claude [claude args...]`

確保代理正在執行，然後以 `ANTHROPIC_BASE_URL`、
`ANTHROPIC_AUTH_TOKEN`、`CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY=1`，以及來自
`config.claudeCode` 的模型插槽啟動 Claude Code。在 Claude Code 2.1.129 或更新版本中，路由模型會透過穩定的插槽別名出現在原生 `/model` 選擇器中。在舊版本上，請用 `ANTHROPIC_MODEL` 或 `/model <id>` 選擇。使用者匯出的 `ANTHROPIC_*` 變數恆優先。

Claude Desktop 設定檔指令如下：

```text
ocx claude desktop [apply]                         儲存並套用四家族設定檔
ocx claude desktop show [--json]                   顯示路由、家族與預設值
ocx claude desktop status [--json]                 顯示已套用狀態、drift 與健康狀況
ocx claude desktop move <route> <family> [--default]
ocx claude desktop default <family> <route|none>
ocx claude desktop export <path|->                 匯出版本化 JSON（`-` = stdout）
ocx claude desktop import <path> [--apply]         驗證並匯入 JSON
```

家族為 `opus`、`fable`、`sonnet` 與 `haiku`；新路由從 `opus` 開始。`none` 僅在該家族為空時有效。舊版套用旗標 `--static`、`--hybrid` 與 `--discovery-only` 仍受支援。請用 `ocx claude config <status|set> ...` 管理 Claude Code 設定。

#### 讀取或儲存所選執行階段的 Desktop 設定檔

上方既有的 show／import 指令是本機的。`profile` 家族以執行中的管理執行階段為目標，並可收集模型清單：

```bash
ocx claude desktop profile show --json > desktop-observed.json
jq '.profile' desktop-observed.json > desktop-profile.json
```

編輯／檢視有版本的設定檔，保留伺服器擁有的已套用標記。對於已授權的儲存，接著讀回：

```bash
ocx claude desktop profile import desktop-profile.json --json
ocx claude desktop profile show --json
```

Import 接受設定檔本身，而不是外層的 `{profile,models,rendered,port}` 回應，使用有界的一般 JSON 檔案或明確的 stdin `-`（4 MiB／30 秒）。
它會回傳那些觀察到的欄位加上 `ok:true`，意思只是已儲存。`--apply` 與原生模式旗標會被拒絕；執行階段儲存失敗時沒有本機備援。
Apply 是在其機器上另一個既有的 Desktop 動作，所以選擇它之前請先確認主機／上下文。已轉譯的模型不能證明已套用到原生。

### `ocx codex [codex args...]`

只有設定及其命名空間受到保護、其他主體無法修改時才提供金鑰；目前使用者和特權 OS 主體受到信任。同一使用者的程序受到信任：具有該使用者寫入權限的主體已能讀取該使用者的 OpenCodex 金鑰檔案。驗證與原生啟動之間由同一使用者替換設定不在此威脅模型內，啟動器不會在交接時凍結設定。

一般 Windows 安裝的預設 ProgramData 權限允許其他使用者建立目錄。因此即使 `ProgramData\OpenAI\Codex` 不存在，也會暫緩自動憑證。ProgramData 下的系統 Codex 設定資料夾必須存在，且僅 Administrators/SYSTEM 可寫入；其祖先目錄也必須防止其他使用者替換。請管理員檢查目錄原則。opencodex 絕不自行修改 ACL，也不提供設定目錄的命令。

您也可以自行提供金鑰，例如匯出 `OPENCODEX_API_AUTH_TOKEN` 環境變數；`ocx codex` 會保留其值不變。既有系統設定檔仍會阻止自動憑證，需另行檢查。每種暫緩原因都會輸出一行簡短明確的 stderr 診斷，不含金鑰值、金鑰檔案內容或路徑。

單字提示前請加 `--`，以免選取未知的 Codex 子命令。

即使系統設定檔不存在，也必須阻止其他使用者建立這些檔案。無法驗證 Windows ProgramData/OpenAI/Codex 路徑保護時不自動注入權杖，也不建立目錄。macOS 接受僅拒絕的 ACL 與唯讀允許項。任何允許寫入、附加、刪除、修改屬性、安全或擁有者的項目都會被拒絕，即使前面已有拒絕項。未知標籤與檢查錯誤也會被拒絕。

只有 argv 位於下方允許清單內、環境中沒有非空 HTTP(S)/ALL proxy 或 `CODEX_*`/`OPENAI_*`/`AZURE_OPENAI_*` 覆寫（允許標準的 `CODEX_HOME`），且主目錄、設定與系統命名空間通過擁有權檢查時，才讀取新服務權杖。設定必須只包含已稽核鍵與準確的受管 loopback provider，沒有額外憑證消費者或設定層。`-c`/`--config`、`-p`/`--profile`、未知旗標和 `resume`/`fork` 等清單外引數都會暫緩權杖，並輸出不含值的診斷；明確提供的使用者憑證與原始引數保持不變。

標準主目錄與 `config.toml` 必須屬於目前使用者。POSIX 拒絕 group/other 寫入權限；Windows 驗證擁有者 SID，並拒絕目前使用者、SYSTEM、Administrators 以外的 DACL 寫入授權。也會檢查祖先路徑替換權限。macOS 還要求不存在強制 Codex 設定 preference。這些檢查無法隔離相同使用者或管理員執行的惡意程序。

| 允許清單 | 旗標 |
| --- | --- |
| 開關 | `--no-daemon`, `--json`, `--ephemeral`, `--skip-git-repo-check`, `--no-alt-screen`, `--full-auto`, `--dangerously-bypass-approvals-and-sandbox`, `--search` |
| 單一值 | `--model`/`-m`, `--sandbox`/`-s`, `--ask-for-approval`/`-a`, `--image`/`-i` |



自動憑證讀取會將 `CODEX_HOME` 中的 `~` 與空白視為字面路徑，驗證後將同一個正規絕對路徑傳給子程序。無法讀取主目錄時不讀取權杖。只要存在非空的 `HTTP_PROXY`、`HTTPS_PROXY` 或 `ALL_PROXY`（不分大小寫），就會略過自動讀取，不受 `NO_PROXY` 影響；拒絕的啟動和使用者匯出的憑證保持不變。傳遞新權杖時，子程序的 `NO_PROXY` 與 `no_proxy` 會保留既有排除項目並加入 `127.0.0.1` 和 `::1`。啟用 `features.respect_system_proxy` 或傳入 `--enable`/`--disable` 會略過自動讀取。

使用原始引數啟動 Codex 前嘗試啟動代理。路由仍由 Codex 設定擁有，啟動器不會改寫。原生及其他閘道路由略過代理啟動；未知路由會警告並嘗試啟動，失敗後仍警告並繼續。說明、版本及 `login`、`doctor`、`help` 等內部命令略過代理啟動和自動權杖讀取。

只有所選 provider 的完整傳輸設定與本次安裝的回環監聽器或已儲存的本機用戶端連線對應的管理區塊一致時，才從本次安裝的 `service-api-token` 讀取缺少的 `OPENCODEX_API_AUTH_TOKEN`。名稱或注入註解本身不構成授權。未知或遠端目的地、預設 profile、專案設定、`OPENAI_BASE_URL` 及傳入的 `-c`/`--config`、`-p`/`--profile`、`-C`/`--cd`、`--remote` 都會略過自動讀取。保留使用者匯出的憑證與引數，拒絕權杖檔案覆寫和管理權杖衝突。

只有比對成功（`matched`）的 autostart wrapper 才直接啟動背後的 Codex。未知狀態（包括檢查例外）必須通過 bypass 驗證；受管 Windows CMD wrapper 必須與目前產生的範本完整一致，才以 `OCX_SHIM_BYPASS=1` 執行。一般 npm 啟動器仍受支援。無法驗證或過時的 wrapper 以結束代碼 1 拒絕，且不啟動 Codex；請用 `ocx codex-shim install` 更新。本次啟動不修復 shim；內容檢查不證明 Windows backing 檔案來源，也不防止並行路徑替換。

啟動器說明為 `ocx help codex`，Codex 說明為 `ocx codex --help`。之後直接執行一般 `codex` 的行為保持不變。

### `ocx opencode [opencode args...]`

確保代理正在執行，然後在 OpenCode 的內嵌執行階段層（`OPENCODE_CONFIG_CONTENT`）中以生成的 `provider.opencodex` 與 `providers.opencodex` 區塊啟動 opencode。既有的內嵌設定會被保留，本次啟動僅替換這兩個鍵。全域或專案的 `opencode.json` 檔案可能被讀取以警告既有的覆寫，但磁碟上的檔案永不修改。路由模型以
`opencodex/<provider>/<model>` 出現。之後啟動普通 `opencode` 的行為與之前完全相同。

### `ocx grok <status|exclude|include|set|clear|apply> ...`

管理並套用 Grok Build 模型圍欄。

## 客戶端設定匯出

### `ocx export --client <opencode|pi|omp|hermes|openclaw|kimi|gajae|dsh|mcode|zcode|prime|aside|raycast|omo|cline|kilo|droid>`

印出連接到執行中代理的客戶端設定。此指令會用所選客戶端的原生格式，序列化含有 base URL、模型清單，以及適用的環境變數參考或 loopback 佔位符的 `opencodex` provider 區塊。

代理必須正在執行；指令解析其即時連接埠、讀取 `/api/models`，並只輸出 Codex 目前可見的模型。

| 旗標 | 動作 |
| --- | --- |
| `--client <opencode\|pi\|omp\|hermes\|openclaw\|kimi\|gajae\|dsh\|mcode\|zcode\|prime\|aside\|raycast\|omo\|cline\|kilo\|droid>` | 必填。選擇客戶端設定格式。 |
| `--json` | 在 stdout 印出產生的文件的 JSON 版本，供指令碼使用。即使所選客戶端的原生格式是 YAML、TOML 或 JSON5，這裡輸出的仍是 JSON。 |
| `--out <path>` | 將設定寫入 `<path>`。拒絕覆寫既有檔案。 |
| `--force` | 允許 `--out` 覆寫既有檔案。 |

```bash
ocx export --client opencode                     # 設定加上目的地、合併警告與計數
ocx export --client pi --json > pi-models.json   # 供 pipe 或 diff 用的逐位元組 JSON
ocx export --client omp --out ./omp-models.yml    # 原生 OMP YAML
ocx export --client opencode --out ~/opencodex-opencode.json
```

未指定 `--json` 時，會先輸出客戶端的原生設定格式，接著是標準目的地路徑、合併警告、客戶端專屬提示，以及附帶有多少列省略 context limit 的模型計數（客戶端會對那些套用自身預設值）。

| 客戶端 | 標準目的地 | 下載檔名 | 環境變數 |
| --- | --- | --- | --- |
| `opencode` | `~/.config/opencode/opencode.json`（`XDG_CONFIG_HOME` 設定時優先） | `opencode.json` | `OPENCODEX_OPENCODE_API_KEY` |
| `pi` | `~/.pi/agent/models.json` (設定後 `PI_CODING_AGENT_DIR` 優先；相對路徑會被拒絕) | `pi-models.json` | 無——區塊帶有字面值 `opencodex-loopback` |
| `omp` | `~/.omp/agent/models.yml`（即使是空值，`OMP_PROFILE` 仍優先於 `PI_PROFILE`；具名設定檔會使用相對於 home 目錄的 `PI_CONFIG_DIR` 目錄名稱，並忽略 `PI_CODING_AGENT_DIR`，而預設設定檔則讓 `PI_CODING_AGENT_DIR` 優先） | `omp-models.yaml` | 無——loopback 佔位符 |
| `hermes` | `~/.hermes/config.yaml` | `hermes-config.yaml` | `OPENCODEX_HERMES_API_KEY` |
| `openclaw` | `~/.openclaw/openclaw.json` | `openclaw.json5` | `OPENCODEX_OPENCLAW_API_KEY` |
| `kimi` | `~/.kimi-code/config.toml` | `kimi-config.toml` | 無——loopback 佔位符 |
| `gajae` | `~/.gjc/agent/models.yml` | `gajae-models.yaml` | 非機密的回送佔位值 |
| `dsh` | `$DSH_HOME/settings.yaml`（預設 `~/.dsh/settings.yaml`） | `settings.yaml` | 無——非秘密的 loopback bearer 佔位符 |
| `mcode` | `~/.minimax/config.yaml` (設定後 `MINIMAX_DATA_DIR` 優先，其次為舊的 `MAVIS_DATA_DIR`；相對路徑會被拒絕) | `mcode-config.yaml` | 無——loopback 佔位符 |
| `zcode` | `~/.zcode/v2/config.json` (設定後 `ZCODE_DATA_DIR` 優先；相對路徑會被拒絕) | `config.json` | 無——loopback 佔位符 |
| `prime` | `~/.prime/agent/models.json` (設定後 `PRIME_AGENT_CODING_AGENT_DIR` 優先；相對路徑會被拒絕) | `prime-models.json` | 無——loopback 佔位符 |
| `aside` | `~/.aside/u/<account>/models.json`，對應 Aside 自己的 `accounts.json` 指定的目前帳戶；資訊清單無法讀取時會被拒絕，而不是退回任一帳戶 | `aside-models.json` | 無——loopback 佔位符 |
| `raycast` | `~/.config/raycast/ai/providers.yaml`（macOS 與 Windows 相同；Raycast 不遵循 `XDG_CONFIG_HOME`） | `raycast-providers.yaml` | 無——僅限 loopback，不會寫入 `api_keys` 項目 |
| `omo` | `~/.omo/agent/models.json`（設定後依序由 `OMO_CODING_AGENT_DIR`、`SENPI_CODING_AGENT_DIR`、`PI_CODING_AGENT_DIR` 優先；相對路徑會被拒絕） | `omo-models.json` | 無——loopback 佔位符 |
| `kilo` | `~/.config/kilo` 下最先存在的 `kilo.jsonc`、`kilo.json`、`opencode.jsonc`、`opencode.json` 或 `config.json`（`XDG_CONFIG_HOME` 可變更該目錄）；皆不存在時使用 `kilo.jsonc` | `kilo.jsonc` | `OPENCODEX_KILO_API_KEY` |
| `droid` | `~/.factory/settings.json` (`%USERPROFILE%\.factory\settings.json` on Windows) | `factory-settings.json` | 僅限迴環；不需環境變數 |

受管理的 DSH 匯出需要 DSH 0.1.0-rc.6 或更新版本，且只擁有 `llm-pi-ai.providers.opencodex`。DSH
會熱重載該 provider；使用者的預設模型與 `deepseek-official` 維持不變。這項匯出僅支援 loopback，
且不含真實憑證。

opencode 會插值 `{env:OPENCODEX_OPENCODE_API_KEY}`。產生的 Pi 與 OMP 匯出不需要環境變數：兩者都
帶有字面值 `opencodex-loopback` 佔位符。這一點很關鍵，因為這兩個客戶端在建立模型清單時都會解析
`apiKey`，並在既有設定含有未設定的環境變數參考時隱藏整個 provider。代理在 loopback 上永不檢查
產生的佔位符。OMP 支援 provider 層級的標頭，但這次初期整合刻意維持僅限 loopback；遠端
`x-opencodex-api-key` 的接線工作延後處理。

Raycast 匯出是一份獨立的 `providers.yaml` 文件，在 `providers` 序列中只有一個 `id: opencodex` 元素：`name: OpenCodex`、proxy 的 `/v1` base URL，以及每個路由模型及其 `abilities`（`tools` 與 `system_message` 一律支援，`vision` 依目錄的輸入模態而定，`reasoning_effort` 在模型有 effort 階梯時設定，`temperature` 對推理模型關閉）。Custom Providers 是 Raycast Pro 功能，且 Raycast 會監看該檔案，因此儲存後的變更不需重新啟動即可生效。格式說明見 [manual.raycast.com/ai/custom-providers](https://manual.raycast.com/ai/custom-providers)。不會寫入任何 `api_keys` 項目，所以此匯出僅限 loopback，非 loopback 的 bind 會被拒絕。

MCode、ZCode 與 Prime 的匯出基於相同原因僅限 loopback，同樣帶有 `opencodex-loopback` 佔位符
而非真實憑證。Prime Agent 讀取與 Pi 相同的 `models.json` 合約，所以這兩項匯出會產生相同的文件；
只有目的地不同。這三個環境變數覆寫中，任何一個使用相對路徑都會被拒絕，因為代理與客戶端可能有
不同的工作目錄，否則雙方會對「指的是哪個檔案」產生分歧。

ZCode 3.8.1 可能會把執行階段衍生的 `reasoning`、`limit.output` 與預設 context 中繼資料，寫回
產生的 `provider.opencodex.models` 項目中。受管理整合狀態只把這些有文件記載的新增內容視為
可重新整理的漂移。Provider 身分與連線設定——包括 `options.baseURL`、模型成員、名稱、模態，以及
OpenCodex 具權威性發出的任何 context 上限——仍受保護；編輯它們會回報 `conflict / foreign-edit`，
而不是覆寫該檔案。由較舊 OpenCodex 版本建立的所有權紀錄，在產生的目錄其餘部分未變動時可以自動
復原。若目錄與該區塊都變動了，請先檢視檔案再重新套用，因為較舊的紀錄無法證明哪個變動是
ZCode 造成的。

:::caution[合併，而非取代]
`ocx export` 永不寫入你的真實客戶端設定。目的地僅印出供你手動合併，而 `--out` 在沒有 `--force` 時拒絕覆寫既有檔案，因為取代設定檔會毀掉其中已有的其他供應商、代理與 MCP 項目。
:::

金鑰永不被序列化。設定只帶有文件化的環境變數參考，或非秘密的 loopback 佔位符。loopback 代理（`127.0.0.1`，預設值）完全不需要准入金鑰。只有客戶端 schema 支援、且代理綁定超出 loopback 時，才設定被引用的變數；關於准入金鑰的簽發方式，請見[遠端存取](/zh-tw/reference/configuration/server/#遠端存取)。上游 provider 本身的金鑰是完全不同的事，依[供應商](/zh-tw/guides/providers/)個別設定。

產生的 gjc 整合使用非機密的本機回環佔位值，不需要環境變數。此整合僅支援本機回環，不設定遠端存取憑證。

相同的 payload 亦由 `GET /api/client-config` 提供，並在儀表板的 API 分頁渲染，因此 CLI、API 與 GUI 使用相同的位元組。

## 執行階段與設定

### `ocx system <status|settings|startup|diagnostics|sync|codex-app-server|codex-restart|update|codex-cli-update> ...`

管理無頭執行階段設定、啟動、同步、診斷與更新。

`ocx system codex-restart --yes` 透過與 `ocx sync --restart-codex` 相同的模組重新啟動 Codex app-server。
當應用程式在目前的模型目錄寫入之前啟動，或本次請求變更了它的 `model_catalog_json` 繫結時，它會結束並重新啟動 Codex 桌面應用程式，因為模型選擇器是在啟動時建立的。
否則應用程式維持開啟，重新產生它自己的 app-server，並保留未儲存的草稿與待處理的核准。若無法讀取應用程式或目錄狀態，則採取完整重新啟動。
當 proxy 本身正在 Codex 應用程式內執行時，桌面重新啟動會以可採取行動的訊息拒絕，而不是承諾一個它無法完成的交接。

即使 shell 是在目錄檔案寫入之後才啟動，本次請求所變更的 `model_catalog_json` 繫結同樣會強制桌面重新啟動。

```bash
ocx system settings --stream-mode eager-relay
```

其他系統布林值接受 on／off：`--show-codex-credits`、`--account-picker`、`--main-account-hard-lock`、`--ultra-fast-tier` 與 `--fast-rows`。
它們只寫入明確的欄位，並可與既有的系統選項合併使用。顯示額度是顯示偏好，不是付費額度的選擇啟用；系統的 Ultra Fast 與供應商的 Fast 是分開的。

Ultra Fast 是選擇啟用的設定，預設關閉。使用 `--ultra-fast-tier on` 時，產生的目錄會在原生的 `gpt-6-astra` 與 `gpt-6.1-sol`（包括帳號綁定的列）加入 Ultrafast 速度選項，
讓 Codex 選擇器在 Fast 旁邊提供它。Ultrafast 需要符合資格的 ChatGPT 方案；目錄無法檢查這一點，所以只有在你的方案包含它時才開啟此設定。其他模型與預設速度維持不變。

對於經路由的模型，sync 與目錄收斂會保留既有經路由列中，由操作者提供的 `service_tiers` 與 `additional_speed_tiers` 內的 `ultrafast` 項目，並與其目前的 Fast 能力並存。
宣告屬於精確的 provider／model slug；不會複製到其他模型。此設定不會建立缺少的宣告，也不會還原已移除的模型。
關閉它會在下一次目錄重新產生時，從一般的經路由列與產生的原生選項中移除 Ultra Fast。

proxy 的 Fast 模式決定什麼會抵達後端：未設定時，選定的 Ultrafast 請求會以 `service_tier: "ultrafast"` 轉送；`fastMode: true` 會把任何層級取代為 Fast（`priority`），而 `fastMode: false` 會移除該層級。
請讓 Fast 模式保持未設定以使用 Ultrafast。

```bash
ocx system settings --json
ocx system settings --show-codex-credits on --json
ocx system settings --json
```

新選項的寫入會回報 `{ok:true, settings: observedFields, catalogRefreshPending}`。Ultra Fast 會做同一目標的 GET 讀回，因為 PUT 省略了該值。
缺少／不相符／讀取失敗的觀察，在接受之後維持 `verification:"unverified"` 並附帶 `unverifiedFields`，且以非零結束；要求的值絕不會取代觀察值。
合併的桌面開關會保留已儲存／有效與套用的事實。待處理的目錄或延後／被拒絕的原生套用，與已儲存的設定是不同的。偽的待處理狀態不能證明每個用戶端都已重新載入。

`ocx system update` 會更新 OpenCodex 本身。獨立的 Codex CLI 檢視介面為：

```bash
ocx system codex-cli-update check --json
```

`check` 不發出套件登錄庫請求，並檢視有界的已設定候選者來源證據，包括經遮蔽的執行檔位置與擁有權證據。受信任的已發布 launcher 上下文驗證的是候選者快照，而不是 Codex 成功執行。
在 POSIX 上，只有當執行階段解析器在不執行它的情況下選到同一個標準環境候選者時，選擇才算被驗證。連結的 npm-global manifest 在證明擁有權、且（若有回報候選版本）該版本與 manifest 相符時，可以確立 `managed: true`；持久化的候選者仍未驗證。
JSON 報告公開 `candidateAvailable`、`candidateVersion`、`candidateSource` 與 `selectionAttested`。檢視已設定的候選者需要受信任的已發布 launcher 上下文；
直接的 Bun／原始碼啟動沒有這種證明，會忽略環境與持久化的候選者狀態，並可能在 POSIX 上回報 `candidate_unavailable`。
在 Windows x64 上，經證明擷取的絕對標準 npm `codex.cmd`，在持有的本機 handle 繫結其套件、一組位於前綴本機的 Node／npm，或與 launcher 架構相連的擷取 PATH 中繼資料配對，以及第一個位於前綴內的平台後援時，可以是受管理的。
這組中繼資料配對不能證明之後 CMD 呼叫會選擇的直譯器。計畫路徑與已設定的版本管理器根目錄必須使用其標準的長 DOS 名稱；別名、不可用的根目錄與重新解析點會讓安裝維持未受管理。其他 Windows 配置仍為延後或未受管理。
Windows 絕不查詢持久化的狀態，所以沒有擷取到環境候選者的執行會回報 `windows_inspection_deferred` 而不是 `candidate_unavailable`：指令無法觀察 Codex CLI 是否已安裝，因此它回報延後，而不是斷言沒有候選者存在。
此指令不執行 Codex 或套件管理員、不修復 shim、不寫入設定或快取狀態、不停止程序，也不安裝任何東西。應用程式內建、已辨識的版本管理器、未驗證的獨立安裝，以及含糊的 shim 狀態，都會被回報為未受管理或未知，且絕不分類為受管理。

在 Windows 上，擷取到的裸指令（例如 `CODEX_CLI_PATH=codex`）、遠端路徑或裝置路徑，會改為回報 `candidate_path_unavailable`。這些情況有擷取到的候選者；其路徑不符合此檢視的資格。

#### 已確認的 Codex CLI 套用與工作狀態

```bash
ocx system codex-cli-update apply --plan-id <32-hex> --yes --request-id <stable-key> --json
ocx system codex-cli-update status <job-id> --json
```

套用支援所選的、受管的、非 shim 的 npm 全域 CLI（Linux／macOS），以及受限的 Windows x64 npm 配置。
它會在安裝租約之下重新驗證已核准的計畫，驗證確切的主套件／平台封存，以離線並停用生命週期腳本的方式安裝，
並檢查已安裝的檔案與所選 CLI 的版本。既有的 Codex 工作階段絕不會被停止；觀測到有作用中或未知的處理程序時會拒絕更新。
Windows 支援具有已驗證 ACL 且沒有重新分析點路徑的共用前綴。觀測範圍包含不相關的套件與 shim，上限為 4,096 個項目、合計 512 MiB、單一檔案 384 MiB。
它們的位元組與身分必須保留。更大或不安全的前綴、ARM64、shim 修復、原生應用程式與其他安裝管理員仍不支援。
子處理程序存活時間未知，或控制代碼清理不完整時，會保留暫存區與安裝租約；請勿刪除其鎖定檔來重試。
讀回包含輔助檔案、新增／不存在的後援根目錄與 npm 的隱藏鎖定檔。`not_applied` 表示觀察到受範圍限定的安裝狀態沒有改變，
並不表示 npm 在任何地方都沒有做過 I/O。
安裝目錄與暫存區要求整個上層路徑具有受信任的 POSIX 擁有者與權限。不安全的安裝路徑會回報 `installation_prefix_unsupported`
或 `installation_paths_untrusted`；不安全的暫存根目錄會回報 `staging_path_untrusted`。
請使用位於受信任上層目錄之下的私有暫存目錄（支援由 root 擁有、帶 sticky 位元的暫存根目錄）。
在安裝與讀回期間，受擁有的工作階段啟動、桌面重新啟動，以及執行階段／shim 選擇變更都會回報忙碌。
未確認的安裝程式或驗證子處理程序會讓准入保持關閉。當證明受擁有的處理程序群組已消失（包含在回收期限之後才關閉的驗證子處理程序）時，准入會恢復。
提交之前的工作程序遺失也會恢復准入；提交之後單獨的工作程序關閉則不會。持久的復原記錄會在代理重新啟動之間保留這項排他。
在 Windows 上，復原會檢查確切的安裝程式／驗證程式 Job 與原始的處理程序建立身分；所有 Job 成員都必須已結束。
存取失敗會讓准入保持關閉，且絕不停止安裝程式。缺少子身分、記錄不完整或無法取得存活證據時，需要檢查。
在發布重新命名之前留下的完整終止寫入，當其確切擁有者與目前的父層／群組不存在都獲得驗證時，可在重新啟動後恢復准入。
在 Windows 上，完整的待處理子身分也可以在符合以下條件時恢復准入：它符合已武裝的擁有者與 Job、守衛的終止證明有效，
且父層、確切的子處理程序存活時間與每個 Job 成員都已證明消失。缺少證明、不完整或已武裝的待處理寫入仍需要檢查；單憑守衛死亡不能重新開啟准入。
復原不會改變含糊的工作結果、重試安裝，或回收被遺棄的安裝租約。
沒有復原歷史時，符號連結的 `OPENCODEX_HOME`（或 home 的上層目錄）允許這些一般操作。有歷史時，准入會讀取受保護的正規 home 目標；
不安全的復原路徑仍回報忙碌。這不會放寬更新程式的安裝或設定路徑資格。Shim 修復、原生應用程式與其他安裝管理員仍不支援。

只有 `applied` 的工作會讓套用以 0 結束；`not_applied`、`refused`、`ambiguous` 與待處理的重複工作都以 1 結束，包含使用 `--json` 時。
狀態讀取的是同一份私有工作記錄，不需要執行中的代理或 GUI 權杖。回應遺失後，請重用同一個選用的請求 ID：
相同的鍵與計畫會回傳原本的工作；用該鍵搭配改變的計畫則會被拒絕。私有帳本最多保留 64 個工作（包含已完成的工作），不會自動修剪。
到達該上限時，新的請求 ID 會以 `store_full` 拒絕；既有且相符的重試仍會回傳原本的工作。
容量與營運人員復原仍是另一項後續工作，且必須保留這項去重契約。忙碌的准入帳本會回報 `job_store_busy`
（HTTP 503 並帶 `Retry-After: 1`）；永久的准入失敗沒有重試延遲標頭。缺少或無法讀取 CLI 狀態會回傳 `job_unavailable` 與非零結束碼。
完成寫入的持久化失敗不會重新執行安裝程式，也不會把不確定的工作變成已確認的成功。
含糊的結果絕不會自動重試或回復。擁有者重新啟動後，未完成的工作會回報擁有權未知，而不是宣稱舊的處理程序已停止。
請檢查工作的結果、子處理程序／租約狀態與清理錯誤；單靠指令的結束狀態並不能確立安裝結果。

管理 API 提供經過驗證的計畫／狀態讀取，以及已確認的、可信任迴路 GUI 工作階段套用准入。已發布的 Node `ocx start`
會提供所需的檢查快照；直接的 Bun 或編譯後的附屬程式啟動不提供該證明。儀表板更新面板是另一項後續工作。

#### 唯讀的 Codex CLI 更新計畫

```bash
ocx system codex-cli-update plan --channel latest --json
```

請透過已發布的 Node launcher 執行，並在 shell 環境中設定預期的 `CODEX_CLI_PATH`。計畫需要經驗證的 npm-global 安裝與已連結的套件 manifest 版本。
Windows 只支援明確的絕對標準 npm `codex.cmd`，搭配持有繫結的 Node／npm 工具鏈——有的話為前綴本機者，否則為與 launcher 架構相連的擷取 PATH 配對；
僅 PATH 的選擇、OpenCodex 自動啟動包裝程式與全域／vendor 備援仍為延後。它使用 launcher 擷取的 PATH 與隔離的暫時 npm 設定、快取與日誌，
向官方 npm 登錄庫查詢精確的版本、SHA-512 完整性與同源 tarball。Proxy 設定與 `NODE_EXTRA_CA_CERTS` 仍受支援；清理為盡力而為。不會執行任何 Codex 指令。

適用的計畫會回報 `applicable: true` 與一個確定性的 `planId`，繫結平台、安裝根目錄／內容摘要、已安裝版本、頻道與精確的主要／平台構件。計畫絕不持久化。
它會拒絕降級、已是最新的版本、使用中的 Codex 工作階段與不完整的程序觀察。受支援的 Windows 中繼資料查詢使用在相符持有 handle 下觀察到的 Node／npm。
Windows x64 只有在有界的 npm 前綴具備已驗證的寫入權限時才可能適用；其他觀察到的前綴保留 `windows_apply_disabled`。使用中／未知的工作階段仍會更早拒絕。不支援的 Windows 配置會在登錄庫／程序查詢之前回傳 `windows_inspection_deferred`。
拒絕以 0 結束：請檢查 `applicable` 與 `refusal`。輸出的安裝 argv 僅供參考；此指令不安裝任何東西、不變更任何應用程式狀態，也絕不對工作階段發送訊號。
單獨的計畫 ID 不是安裝授權：套用需要另外明確的確認。

#### 明確觀測 Windows x64 安裝

```text
ocx system codex-cli-update attest [--json]
ocx system codex-cli-update attest --candidate <absolute-path> --npm-prefix <absolute-path> --npm-cli <absolute-path> --node <absolute-path> [--json]
```

`attest` 是選用的唯讀操作，用於觀測所選或明確指定的 Windows x64 npm 安裝。不帶任何選項時，指令會觀測由可信 launcher 快照識別的所選候選項（已設定的 `CODEX_CLI_PATH` 或所擷取 PATH 中的第一個 `codex`），其中 opencodex 包裝腳本會解析到其重新命名的 `codex.opencodex-real.cmd` npm 備份。提供全部四個絕對路徑可覆寫自動識別；自動識別僅提出路徑，持有控制代碼的觀測才是最終依據。`--candidate` 必須是標準 npm `<prefix>/codex.cmd` 或 `<prefix>/node_modules/@openai/codex/bin/codex.js`。`--npm-cli` 必須以 `node_modules/npm/bin/npm-cli.js` 結尾，`--node` 明確指定 `node.exe`。應用程式封裝、已識別的版本管理工具配置、缺少 npm 備份的 opencodex 自有 shim 與自訂包裝腳本皆會被拒絕。

在有限讀取期間，原生控制代碼保持上層目錄與檔案開啟。未支援的平台、重新剖析點/junction、衝突的寫入者、不安全的路徑及超過大小限制的檔案皆會被拒絕。固定格式報告不含路徑：`status` 為 `observed` 或 `refused`，並提供 `installationIdentityObserved`；`selectionAttested`、`managed` 與 `applyAllowed` 一律為 `false`。回報拒絕時也可能回傳結束代碼 0，因此應檢查 `status`。

識別值或摘要僅描述觀測當下的檔案，不是持續有效的更新許可，也不證明選用的執行階段、過去的安裝程式、實際 npm 設定或工具真實性。明確指定的 Node 也只是被觀測，不能證明啟動器會選用它。命令不會執行目標、請求套件 registry、安裝、寫入設定或控制程序。現有 Windows `check` 仍不執行候選項或設定的檔案系統 I/O。

### `ocx config <show|get|set|unset|validate|export|import> ...`

檢查並安全地修改已驗證的 OpenCodex 設定。`show` 與 `get` 會遮罩秘密。匯入在寫入前驗證且需要 `--yes`。

### 從已連線的用戶端查看用量

`ocx usage` 會用這個用戶端已註冊的資料金鑰讀取已連線的 hub。人類可讀輸出會標明 hub 來源與用戶端
金鑰範圍；`--json` 回傳同一份受範圍限制的資料。區間、介面、供應商／模型過濾條件與自訂的
`--since`／`--until` 邊界都仍然可用。帳號層級的細分與其他用戶端的紀錄不會被分享。過舊或無法使用
的 hub 會產生明確錯誤，而不是拿本機用量頂替；若 hub 不支援這項讀取，請升級它。

唯讀的資料平面端點是 `GET /v1/usage`，使用 `x-opencodex-api-key` 搭配已設定的用戶端金鑰。環境
層級與管理用金鑰會被拒絕。它接受 `range`、`surface`、`provider`、`model`、`since` 與 `until`；
未知或重複的選項，以及呼叫端自選的金鑰 ID 都會被拒絕。被略過的過大資料列仍保有明確的歷史不完整
警告。

## 說明列出的請求

人類可讀的 `ocx logs` 輸出包含 `id=<request-id>`。把該值傳給 `ocx logs explain <request-id>` 以檢視路由決策。沒有 ID 或 ID 含有控制字元的列，會省略該欄位，而不是顯示一個不同的查詢鍵。JSON 與 JSONL 輸出保留既有的 schema。

## 路由設定檔查詢狀態

`ocx route policy show <id>` 在設定檔不存在時以結束碼 4 結束。缺少或無效的指令引數以結束碼 2 結束。腳本可以區分缺少的設定檔與不正確的用法。

## 上游錯誤細節

當上游錯誤封套包含多個訊息欄位時，OpenCodex 會依既定的優先順序使用第一個非空白的字串。空的或格式錯誤的欄位不再遮蔽有效的後備診斷。
### 強制 Claude Code 子代理模型

Subagents 頁面提供**強制所有子代理使用同一個模型**，預設關閉。請選擇一個已公開的名冊式 ID，例如 `combo/tev-auto`，然後啟用開關。名冊會優先提供；不可用的已儲存名冊項目不能作為強制目標。

`ocx agent subagents force combo/tev-auto` 會設定 `claudeCode.subagentModelForce`；`ocx agent subagents force -` 會清除它。`ocx agent status` 會回報該設定。`GET /api/subagent-models` 回傳 `force`、`forceAvailable` 與 `forceStatus`；`PUT` 接受 `{ "force": "combo/tev-auto" }` 或 `{ "force": null }`，且不更動名冊。省略 `force` 則維持不變。無效或未公開的目標在寫入時會被拒絕；過期的目標會被回報並在啟動時略過。

這會在**下一次經路由的 `ocx claude` 啟動**生效，注入 `CLAUDE_CODE_SUBAGENT_MODEL` 作為明確的 proxy 別名（只有在權威的百萬權杖視窗時才加 `[1m]`；原生 Claude 目標使用可逆的原生別名）與 `CLAUDE_CODE_SUBAGENT_MODEL_FORCE=1`。每個非空、由 shell 匯出的變數各自優先。原生啟動兩個變數都不注入；一般的 `claude` 不受影響。此設定不會修改任何外掛檔案或 `settings.json`。

FORCE 需要 Claude Code **2.1.257 或更新版本**。外掛與內建代理（包括 Explore／Plan）及每次呼叫的模型引數都會被覆寫。使用 `model: inherit` 的 fork 與子代理 skill 維持主對話的模型。主迴圈與 Haiku／small-fast 旁路不受影響。既有的名冊檔案仍可使用。

儀表板會對舊的或未知的 CLI 版本、不可用的目標，以及 `settings.json` → `env` 中已存在的任一變數（它會覆寫啟動環境）發出警告。偵測是唯讀且限於伺服器本機：它無法檢查另一個啟動 shell、另一台機器或專案本機的設定。未知的結果不證明支援 force。

### 記憶與壓縮路由覆寫

```bash
ocx agent memory-models show --json
ocx agent memory-models set --extract-model <route> --extract-effort high --consolidation-model <route> --json
ocx agent memory-models show --json
ocx agent compaction-routing show --json
ocx agent compaction-routing set --model <route> --effort high --triggers manual,auto --sources '<exact-source>,<provider>/*' --json
ocx agent compaction-routing show --json
```


每次 set 取代整個區塊。記憶設定接受 extract／consolidation 模型及各自可選的 effort；只給 effort 而沒有對應模型會被拒絕。省略的階段使用既有／預設路由，不會停掉管線。`--file memory.json` 可改讀區塊本身：

```json
{"extract":{"model":"example/model","reasoningEffort":"high"}}
```


記憶檔明確的 `{}` 有效，保留空覆寫區塊；`ocx agent memory-models clear --json` 寫入 null，兩者都不代表停用記憶處理。檔案模式與逐欄選項互斥。一般 UTF-8 檔或 `--file -` 管線輸入遵循 4 MiB／30 秒上限，序列化請求同樣限 4 MiB。

壓縮檔必須含 `model`，可含 `reasoningEffort`、不重複的 `manual`／`auto` triggers 與 `sourceModels`。來源選擇器須精確且不重複，或使用 provider/*。省略 triggers 使用伺服器預設，省略來源表示全部來源，不沿用舊範圍。`ocx agent compaction-routing clear --json` 寫 null 還原一般路由，不停用壓縮；儲存時不做合成模型呼叫。

讀取僅回傳 `{memoryModels: blockOrNull}` 或 `{compactionRouting: blockOrNull}`。寫入另含 `catalogRefreshPending`：false 時 exit 0，不保證每個用戶端已套用；true 時已儲存但 exit 1。證據缺少或無效時為 null、`verification:"unverified"` 且 exit 1。復原前先讀回。

### `ocx effort [status|set|clear]`

透過執行中的代理檢查或修改主代理／子代理推理強度上限；無代理時使用本機設定。上限可為 `low`、`medium`、`high`、`xhigh`、`max`、`ultra`，`-` 清除指定上限。`none` 與 `minimal` 不是上限，即使同一命令的其他選項有效，也會在探測或寫入前拒絕；它們仍可用於獨立的 `--injection`。

```bash
ocx effort status --json
ocx effort set --main high --subagent low
ocx effort set --subagent -
```


status 保留既有值，並在 `warnings` 與人類輸出指出不支援而忽略的欄位及修正命令，不自行修復。忽略子代理欄位不會清掉有效主代理上限。clear 清除兩者，保留獨立 injection effort。適用的請求介面見[子代理](/zh-tw/guides/sub-agent-surface/)。
