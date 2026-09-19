---
title: CLI 代理、路由與整合
description: 多代理、組合、可觀測性、存取、整合、系統與設定指令。
---

這些指令控制代理政策與路由、檢查即時代理，並將支援的客戶端連接至 opencodex。

## 代理政策

### `ocx agent <status|injection|effort|subagents|fallback|sidecar> ...`

管理無頭多代理名冊、effort 上限、prompt 注入、fallback 與 sidecar 設定。使用 `status` 查看目前政策。關於介面模式、委派、effort 與 fallback 行為如何搭配運作，請見[子代理介面](/zh-tw/guides/sub-agent-surface/)。

```bash
ocx agent subagents set ark/model-a,openai/gpt-5.5
```

`ocx agent sidecar web --list` 與 `ocx agent sidecar vision --list` 會印出伺服器目前為每個
sidecar 提供的模型——正是儀表板選擇器所顯示的那組精確過濾清單（picker 可見的列，加上具登入
資格的 Luna/Haiku 認證槽位，並與 web search 的執行器可用性取交集，減去對 vision 已證明僅支援
純文字的模型）。人類可讀的清單會以中括號顯示每個模型的後端。寫入 web-search 的 `--model` 會解析
成該伺服器提供的那一列，並把其後端與模型一起持久化，因此切換到 Anthropic 選項無法保留
OpenAI 後端（反之亦然）。寫入走與 GUI 相同的管理路由，並受相同的 per-sidecar 閘門限制：
web search 會拒絕不在清單內的後端/模型組合（封閉成員資格），而 vision 只拒絕已證明無法識圖的
模型（未知 id 仍可寫入）。

```bash
ocx agent sidecar web --list
ocx agent sidecar web --model gpt-5.6-luna
```

### `ocx effort [status|set|clear]`

透過執行中的代理檢查或變更主要與子代理的 reasoning-effort 上限；沒有代理時則作用於本機設定。
上限值可為 `low`、`medium`、`high`、`xhigh`、`max` 與 `ultra`；`-` 會清除所選的上限。`none` 與
`minimal` 不是上限層級，會在探測代理或送出更新之前就被拒絕，即使同一個指令中的其他選項有效也
一樣。這兩個值對 `--injection` 仍然有效，因為它設定的是獨立的注入 effort，而不是上限。

```bash
ocx effort status --json
ocx effort set --main high --subagent low
ocx effort set --subagent -
```

Status 會保留既有已儲存／執行階段的上限值，並在 `warnings` 中回報不受支援的值（沒有不支援值時
為空陣列）。人類可讀輸出中會出現相同的警告，並指名被忽略的欄位以及對應的修正指令。Status 絕不會
修復或改寫這些值。被忽略的子代理欄位不會移除有效的主要上限。`ocx effort clear` 會清除兩個上限，
同時保留獨立的注入 effort 設定。關於上限適用的請求介面，請見[子代理介面](/zh-tw/guides/sub-agent-surface/)。

### `ocx v2 <status|on|off|mode <v1|default|v2>|keep-native-v1 <on|off>|threads <n>|mode-hint <text|--clear>>`

管理 Codex 的 `multi_agent_v2` 功能旗標與三態多代理介面模式。

| 子指令 | 動作 |
| --- | --- |
| `status`（預設） | 回報目前 v2 旗標、多代理模式與執行緒並行數。 |
| `on` | 啟用全域 `multi_agent_v2` 功能並重新同步目錄。當 v2 混合 pin 生效中時會被拒絕，因為全域覆寫會破壞它。 |
| `off` | 停用 `multi_agent_v2` 功能並重新同步目錄。 |
| `mode v1` | 將所有模型強制為 v1、停用原生 v2，並保留現用執行緒上限。 |
| `mode default` | 遵循上游模型介面 pin。 |
| `mode v2` | 將模型強制為 v2，並保留現用執行緒上限。當 `keep-native-v1` 關閉時，啟用全域原生 v2；開啟時，停用全域覆寫並改用目錄 pin。 |
| `keep-native-v1 on\|off` | 在 `mode v2` 下，讓 ChatGPT 原生模型維持 v1、路由模型維持 v2。啟用它會在目錄同步前停用全域 V2 覆寫。 |
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

`mode` 子指令將 `multiAgentMode` 寫入 opencodex 設定並重新同步 Codex 目錄。模式與旗標轉換會在有效的 v1/v2 Codex key 之間移動目前的數值執行緒上限；失敗的轉換會還原原始的 `config.toml`。變更套用於新的 Codex session，執行中的 session 則保留其 pin 的介面。

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

## 組合路由

### `ocx combo <list|show|set|remove> ...` · `ocx route combo ...`

管理組合 failover 與 round-robin 虛擬模型。`ocx route combo` 是階層式別名；組合是目前支援的路由資源。目標使用
`provider/model[:weight],provider/model[:weight]`。

```bash
ocx combo list
ocx route combo set reliable --targets ark/model-a:2,openai/gpt-5.5
```

`set` 接受 `--strategy`、`--sticky`、`--effort`、`--alias`、`--rename-from`、`--native-alias` 與
`--display-name <label|->`（`-` 清除該標籤）。原生別名只能捕捉一個目前受支援、未限定的裸
OpenAI 模型 id。裸的 `gpt-5.6-*` 原生別名使用 Codex Pool/Direct 憑證。帳號限定的 OpenAI 路由仍
維持獨立，而供應商限定的路由（如 `openai-apikey/gpt-5.6-*`）使用它們已設定的 API 金鑰，永不落回
原生別名。啟用這組相容性設定前，請先閱讀指南中的安全性與可見性規範。

關於路由行為與設定指引，請見[組合](/zh-tw/guides/combos/)。

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

### `ocx access <key|endpoints|models|test> ...`

管理 OpenCodex 許可 API 金鑰並檢查外部端點與模型。`ocx api-key
<list|create|remove> ...` 是 `ocx access key` 的別名。

```bash
ocx access key create deployment
```

## 客戶端整合

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

### `ocx opencode [opencode args...]`

確保代理正在執行，然後在 OpenCode 的內嵌執行階段層（`OPENCODE_CONFIG_CONTENT`）中以生成的 `provider.opencodex` 與 `providers.opencodex` 區塊啟動 opencode。既有的內嵌設定會被保留，本次啟動僅替換這兩個鍵。全域或專案的 `opencode.json` 檔案可能被讀取以警告既有的覆寫，但磁碟上的檔案永不修改。路由模型以
`opencodex/<provider>/<model>` 出現。之後啟動普通 `opencode` 的行為與之前完全相同。

### `ocx grok <status|exclude|include|set|clear|apply> ...`

管理並套用 Grok Build 模型圍欄。

## 客戶端設定匯出

### `ocx export --client <opencode|pi|omp|hermes|openclaw|kimi|gajae|dsh|mcode|zcode|prime|aside|raycast|omo>`

印出連接到執行中代理的客戶端設定。此指令會用所選客戶端的原生格式，序列化含有 base URL、模型清單，以及適用的環境變數參考或 loopback 佔位符的 `opencodex` provider 區塊。

代理必須正在執行；指令解析其即時連接埠、讀取 `/api/models`，並只輸出 Codex 目前可見的模型。

| 旗標 | 動作 |
| --- | --- |
| `--client <opencode\|pi\|omp\|hermes\|openclaw\|kimi\|gajae\|dsh\|mcode\|zcode\|prime\|aside\|raycast\|omo>` | 必填。選擇客戶端設定格式。 |
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
| `gajae` | `~/.gjc/agent/models.yml` | `gajae-models.yaml` | `OPENCODEX_GAJAE_API_KEY` |
| `dsh` | `$DSH_HOME/settings.yaml`（預設 `~/.dsh/settings.yaml`） | `settings.yaml` | 無——非秘密的 loopback bearer 佔位符 |
| `mcode` | `~/.minimax/config.yaml` (設定後 `MINIMAX_DATA_DIR` 優先，其次為舊的 `MAVIS_DATA_DIR`；相對路徑會被拒絕) | `mcode-config.yaml` | 無——loopback 佔位符 |
| `zcode` | `~/.zcode/v2/config.json` (設定後 `ZCODE_DATA_DIR` 優先；相對路徑會被拒絕) | `config.json` | 無——loopback 佔位符 |
| `prime` | `~/.prime/agent/models.json` (設定後 `PRIME_AGENT_CODING_AGENT_DIR` 優先；相對路徑會被拒絕) | `prime-models.json` | 無——loopback 佔位符 |
| `aside` | `~/.aside/u/<account>/models.json`，對應 Aside 自己的 `accounts.json` 指定的目前帳戶；資訊清單無法讀取時會被拒絕，而不是退回任一帳戶 | `aside-models.json` | 無——loopback 佔位符 |
| `raycast` | `~/.config/raycast/ai/providers.yaml`（macOS 與 Windows 相同；Raycast 不遵循 `XDG_CONFIG_HOME`） | `raycast-providers.yaml` | 無——僅限 loopback，不會寫入 `api_keys` 項目 |
| `omo` | `~/.omo/agent/models.json`（設定後依序由 `OMO_CODING_AGENT_DIR`、`SENPI_CODING_AGENT_DIR`、`PI_CODING_AGENT_DIR` 優先；相對路徑會被拒絕） | `omo-models.json` | 無——loopback 佔位符 |

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

金鑰永不被序列化。設定只帶有文件化的環境變數參考，或非秘密的 loopback 佔位符。loopback 代理（`127.0.0.1`，預設值）完全不需要准入金鑰。只有客戶端 schema 支援、且代理綁定超出 loopback 時，才設定被引用的變數；關於准入金鑰的簽發方式，請見[遠端存取](/zh-tw/reference/configuration/#remote-access)。上游 provider 本身的金鑰是完全不同的事，依[供應商](/zh-tw/guides/providers/)個別設定。

gjc 是例外：`OPENCODEX_GAJAE_API_KEY` 只會從環境提供 provider 憑證，但其 schema 無法傳送遠端准入 header，因此產生的 gjc 整合仍僅支援 loopback。

相同的 payload 亦由 `GET /api/client-config` 提供，並在儀表板的 API 分頁渲染，因此 CLI、API 與 GUI 使用相同的位元組。

## 執行階段與設定

### `ocx system <status|settings|startup|diagnostics|sync|codex-app-server|codex-restart|update|codex-cli-update> ...`

管理無頭執行階段設定、啟動、同步、診斷與更新。

`ocx system codex-restart --yes` 透過與 `ocx sync --restart-codex` 相同的模組重啟 Codex app-server，並完全結束再重新啟動 Codex 桌面應用程式。若代理本身在 Codex 應用程式內部執行，此命令會給出可執行提示並拒絕，而不是承諾無法完成的移交。

```bash
ocx system settings --stream-mode eager-relay
```

`ocx system update` 更新 OpenCodex 本身。Codex CLI 使用以下獨立唯讀檢查指令：

```bash
ocx system codex-cli-update check --json
```

`check` 不會向套件 registry 發出請求，只會在限定範圍內檢查設定中的安裝候選項來源證據，包括經過遮罩的可執行檔位置與所有權證據。正式發布的 launcher 所提供的可信內容只會驗證該候選項快照，並不證明 Codex 已成功執行。由於這個單次命令絕不會執行 Codex，來自環境變數與持久化記錄的候選項只供報告（`managed: false`，通常為 `selection_unattested`）；JSON 輸出包含 `candidateAvailable`、`candidateVersion` 與 `candidateSource`，而 `selectionAttested` 維持 `false`。檢查設定中的安裝候選項時，必須有正式發布的 launcher 所提供的可信內容；直接使用 Bun 啟動或從原始碼執行時不具備這項證明，因此會忽略來自環境與持久化記錄的候選項狀態，並可能報告 `candidate_unavailable`。在 Windows 上，這個首個切片不會對候選路徑或設定路徑執行任何檔案系統 I/O。只有由可信 launcher 擷取的絕對環境候選項可以取得應用程式封裝或版本管理工具的純詞彙標籤；其他所有 Windows 候選項都會以失敗關閉方式處理。此命令不會執行 Codex 或套件管理工具、不會修復 shim、不會寫入設定或快取、不會停止程序，也不會安裝任何內容。隨應用程式封裝的候選項、位於已識別版本管理工具路徑中的候選項、未經驗證的獨立候選項，以及 shim 狀態不明確的候選項，都會報告為 `unmanaged` 或 `unknown`，絕不會歸類為 `managed`。

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
