---
title: CLI 供應商、帳號與模型
description: 供應商設定、憑證、配額與模型目錄指令。
---

這些指令設定上游供應商、認證帳號、管理憑證池，並控制暴露給 Codex 的模型目錄。

來自 `account list`、`account current`、原生主設定檔與供應商指令的剩餘引數錯誤會對憑證選項的值進行遮罩，包括 `--code`、`--token`、`--api-key`、`--key`、`--secret`、`--password` 與 `--admin-token`，涵蓋 `--option value` 與 `--option=value` 兩種形式。本機供應商註冊使用 `ocx provider add <name> --api-key <key>`；內嵌寫法的 `--api-key=<key>` 會被拒絕並遮罩其值。`ocx provider edit` 不接受 `--api-key`。

## 供應商

### `ocx provider <subcommand>`

非互動式供應商管理。Registry 項目依名稱播種；自訂名稱需要同時提供 `--adapter` 與 `--base-url`。

| 子指令 | 支援的旗標 | 動作 |
| --- | --- | --- |
| `list` | `--json`, `--jsonl` | 列出已設定的供應商與剩餘的 registry 項目；`--jsonl` 為每個已設定的供應商輸出一行 JSON 物件。 |
| `add <name>` | `--adapter <adapter>`, `--base-url <url>`, `--api-key <key>`, `--responses-path <path>`, `--auth-mode <key\|forward\|oauth\|local>`, `--default-model <model>`, `--set-default`, `--force`, `--json`, `--sync`, `--live` | 預設儲存至本機；`--sync` 在任一輸出模式下皆會嘗試用戶端同步。`--live` 會透過執行中的代理寫入，且不能與 `--sync` 併用。`--force` 允許覆寫。 |
| `edit <name>` | 供應商欄位旗標、`--headers <json>`、`--model-context-tier <model=default\|long_context>`, `--upstream-http-version <http1.1\|->`, `--fast <on\|off>`, `--context-window <N\|->`, `--json` | 編輯已驗證的即時供應商欄位而不替換金鑰池。可重複指定 `--model-context-tier` 以設定多個 Copilot 模型。`--headers` 合併自訂請求標頭；傳入 `{}` 或 `-` 可清除它們。 |
| `test <name>` | `--model <id>`, `--yes`, `--json` | 檢查模型探索；搭配 `--model` 時請求一次已確認的完成測試。 |
| `show <name>` | `--json` | 顯示設定，API 金鑰已遮罩。 |
| `remove <name>` | `--json`, `--live`, `--yes` | 本機移除會拒絕移除預設供應商與最後一個供應商。即時移除需要 `--yes`，並使用伺服器相依性檢查、預設重新指派與帳號／自訂模型清理。 |
| `set-default <name>` | `--json`, `--live` | 選擇本機預設供應商，或以 `--live` 更新執行中的代理。 |
| `pacing <name>` | `--json`, `--enabled <on\|off>`, `--rpm <number>`, `--min-interval-ms <integer>`, `--max-concurrent <integer>`, `--file <FILE\|->` | 讀取已設定規則與執行期狀態；更新純量值或從檔案取代規則。檔案旗標與純量旗標互斥。 |
| `snapshot` | `--json` | 從執行中的代理讀取已遮罩且經檢驗的公開供應商編輯器文件。 |
| `apply` | `--baseline <FILE\|->`, `--file <FILE\|->`, `--yes`, `--json` | 搭配基準比對套用經審閱的編輯器文件；移除／重新命名需要 `--yes`。 |
| `selected <name>` | `--set <ids>`, `--clear`, `--json` | 讀取或更新供應商模型允許清單。 |
| `quota` | `--refresh`, `--json` | 讀取供應商配額報告。 |
| `resets` | `--limit <n>`, `--json` | 列出最近偵測到的配額窗口重置事件。 |
| `presets` | `--json` | 列出儀表板供應商預設。 |
| `account-mode` | `pool`, `direct`, `--json` | 選擇池化或直接的 Codex 帳號路由。 |
| `import-cc-switch` | `--source <FILE>`, `--provider <id>`, `--apply`, `--restore`, `--allow-private-network`, `--json` | 從 CC-Switch SQLite（`cc-switch.db`）或舊版 JSON 檔案預覽、選擇性套用或還原無金鑰供應商項目。 |

```bash
ocx provider list --json
ocx provider list --jsonl        # 每個已設定的供應商輸出一行 JSON 物件
ocx provider test ark
ocx provider add anthropic --set-default --sync
ocx provider add local-dev --adapter openai-chat --base-url http://localhost:11434/v1
ocx provider show anthropic --json
ocx provider edit github-copilot --model-context-tier gpt-5.6-luna=long_context
ocx models --provider anthropic --json
ocx models live --provider ark --json
```

`--jsonl` 僅輸出已設定的供應商，每行一個 JSON 物件，並且省略 `--json` 中的 `registryCount` 摘要。每個物件的欄位與 `--json` 輸出中 `configured` 陣列的元素相同。可用於逐行處理已設定供應商物件的指令碼。`--json` 與 `--jsonl` 不能同時使用。

每個已設定列也包含 `active`。當這台裝置連線到 Home（Remote Link Child 或 Hub 模式用戶端）時它為 `false`：該列屬於會被 Home 的供應商遮蔽的本機設定，因此在連線期間不會服務請求。當該列實際提供服務時（包含無法讀取連線狀態的情況）則為 `true`。輸出列絕不帶有憑證值：`baseUrl` 會移除內嵌的 userinfo 並遮罩如 `key` 或 `token` 等憑證形態的查詢參數，同時保留如 `api-version` 等一般參數。

:::caution[自訂標頭不是憑證通道]
`--headers` 用於非機密的請求中繼資料——路由提示、租戶或專案選擇器、追蹤 id。它**不是**放置驗證資料的地方，驗證器會拒絕標準憑證標頭名稱（`Authorization`、`X-Api-Key`、`Cookie` 等），並指向 `apiKey` / `authMode`。

驗證器無法辨識任意名稱（例如 `X-My-Token`），所以這條界線需要你自己遵守。這很重要的兩個原因：

- JSON 是命令列引數，所以其中的機密會留在 shell 歷史紀錄與行程清單中，在 CLI 進行任何遮罩之前，機器上的其他行程就能讀到它。
- 標頭值以明文形式持久化在 `config.json` 中，不像 API 金鑰有自己的儲存與遮罩路徑。

機密輸入請一律使用支援的憑證登入或標準輸入（stdin）流程。請勿將金鑰放進代理對話紀錄，也不要複製進指令範例中。
:::

### 本機儲存與即時供應商狀態

先從離線探索開始：`ocx provider --help`，接著查看子指令的 `--help`。`list` 與 `show` 讀取本機設定；除非加上 `--live`，否則 `add`、`remove` 與 `set-default` 也使用本機設定。下方其他供應商管理操作皆需執行中的代理。在執行即時操作前，先檢查 `ocx ready --json` 與 `ocx status --json` 以確認目標與版本正確。本機列表無法證明代理已採用已儲存的變更。

本機的 `provider add <name> --json` 會回報 `needsSync: true`。加上 `--sync` 會在 JSON 與人類輸出模式下實際嘗試同步。其回執會加上 `sync: {status, ok}`；只有 `status: "applied"` 且 `ok: true` 才會清除 `needsSync`。沒有代理（`not-running`）、遭拒絕的同步或失敗的同步都會以非零結束碼結束，同時保留本機儲存結果。因政策略過或僅限目錄的結果可能以 0 結束並維持 `needsSync: true`；它們不屬於已套用的用戶端同步。目錄擁有權或已儲存設定的安全拒絕會保留目錄不變、回傳結束碼 1，並在人類輸出顯示復原指引或在 JSON 顯示 `sync.warning`，即使設定注入已經成功亦然。

針對已授權的即時變更：

```bash
ocx provider snapshot --json
ocx provider add anthropic --live --json
ocx provider set-default anthropic --live --json
ocx provider snapshot --json
```

即時新增會使用目標的預設設定，若觀測到供應商已存在且未加 `--force` 則會拒絕。檢查與伺服器端 upsert 並非原子操作：並行變更可能發生競爭。自訂供應商仍需 `--adapter` 與 `--base-url`；若目標並未將該名稱提供為預設，且未同時提供這兩者，會以 2 結束並輸出指明該名稱的訊息；當目標缺少其預設時，標準名稱 `openai` 亦同。這兩種情況都不會寫入任何內容。`--live` 絕不會退回本機儲存；與 `--sync` 併用屬於無效用法。憑證屬於受支援的人工登入或 stdin 流程，而非 CLI 範例。

若要移除已授權的供應商，請使用 `ocx provider remove <name> --live --yes --json`。伺服器會檢查相依性，並套用預設重新指派與帳號／自訂模型清理。寫入後請檢查回執並重新讀取目標狀態。

即時回執可能長得像 `{"success":true,"name":"example","catalogRefresh":{"status":"committed","changed":true,"degraded":false,"notices":[]}}`。`success` 表示設定已持久化；它本身不證明目錄已收斂。舉例來說，`{"success":true,"name":"example","catalogRefresh":{"status":"skipped","reason":"busy","retryable":true}}` 即使儲存成功仍會回傳結束碼 1。失敗的重新整理，或因 `stale`、`refused` 與 `catalog-unavailable` 造成的略過，同樣回傳非零結束碼。請保留降級通知。null、缺省或 `not-requested` 的重新整理可以在未執行用戶端同步的情況下以 0 結束。在執行復原前請先回讀狀態；請勿重複已持久化的寫入來修復目錄收斂。錯誤訊息一律透過 stderr 以安全純文字輸出（包含在 JSON 模式下），而非 JSON 錯誤封套。

不加 `--model` 的 `provider test <name>` 會檢查上游模型探索連線能力。連線失敗以 1 結束；成功或沒有適用探索端點的靜態目錄以 0 結束。`applicable: false` 是靜態目錄的預期結果，既非成功推論，也非連線失敗。

若要針對選定模型發送單次完成請求，請使用：

```bash
ocx provider test my-relay --model my-model
ocx provider test my-relay --model my-model --yes --json
```

此測試可能產生供應商計費費用。互動式終端機會要求確認；`--yes` 表示接受計費警告。非互動式環境與 `--json` 必須使用 `--yes`。未指定 `--model` 而使用 `--yes` 屬於用法錯誤。拒絕確認不會發送請求並以 1 結束。此指令使用執行中代理的管理 API。

完成測試會發送固定提示詞 `Reply exactly OK.`、請求 32 token 輸出上限、於 20 秒或 64 KiB 後停止，且絕不重試或容錯移轉。它支援金鑰認證或本機 OpenAI Chat 與 Responses 供應商，包含逐模型的連線協定覆寫。停用、OAuth、轉送認證以及不支援的轉接器或傳輸設定會在不發送完成請求的情況下回傳適用性原因。TLS 設定檔、HTTP 版本釘選、已啟用的請求節流以及帶有供應商代理覆寫的自訂執行器目前不支援。

結果包含首個文字增量時間（TTFT）、總延遲、請求與實際線上的模型 id、經清理的上游模型中繼資料，以及明確的符合、不符或未知比對結果。缺失或衝突的中繼資料皆判為未知。比對使用的是遮罩前的上游 id，與經過別名及後綴處理後實際發送的 id 進行比較。供應商回報的中繼資料無法驗證模型真實身分：`identityVerified` 一律為 `false`。不會回傳產生的文字內容。失敗的完成測試以 1 結束；成功與不適用的結果以 0 結束。

### 傳輸設定與請求節流

`provider edit` 已是即時操作。使用 `--upstream-http-version http1.1` 可釘選該協定，或使用 `--upstream-http-version -` 清除它。`--fast on|off` 切換 Fast 模式；`--context-window N` 設定正數的供應商覆寫值，而 `--context-window -` 清除它。省略的設定維持不變；0 並非清除操作。

```bash
ocx provider pacing anthropic --json
ocx provider pacing anthropic --enabled on --rpm 30 --min-interval-ms 1000 --max-concurrent 2 --json
ocx provider pacing anthropic --json
```

讀取會回傳 `{provider, rules, status}`。`rules: null` 代表未設定；`status` 包含獨立的執行期佇列與計時觀測值。單獨提供數值旗標不會啟用未設定的區塊；`--enabled off` 會停用節流。RPM 接受經檢驗的正數小數值。間隔與並行數則需要正整數。

純量編輯會保留已觀測到的模型規則，但 PATCH 會在沒有 CAS 的情況下替換整個區塊，因此並行編輯可能遭覆寫。需要基準比對時請改用下方的 snapshot/apply。若要設定包含模型專屬規則的完整規則物件，請使用 `ocx provider pacing anthropic --file pacing.json --json`。最小化的規則檔為 `{"enabled":true,"requestsPerMinute":30}`。檔案模式會替換整個區塊，且不可與純量旗標併用。`--file -` 從管線 stdin 讀取；適用下方的輸入限制。

### 以基準進行快照、編輯與套用

在這些步驟之間請維持相同的目標主機與 CLI 情境。目標鎖定僅在單次呼叫內有效；快照不包含目標身分 token。

```bash
ocx provider snapshot --json > providers.baseline.json
cp providers.baseline.json providers.next.json
```

在保留原始基準的同時編輯下一版檔案並檢視差異。每份文件僅包含 `{defaultProvider, providers}`。Snapshot 是唯讀且已遮罩的編輯器投影，而非原始設定匯出。請勿加入機密、衍生或未知欄位：憑證、任何 `headers` 欄位與顯示標記（`hasApiKey`、`hasHeaders`、`xaiResponsesOptInState`、`initialModelSelection`）皆不可批次編輯。原始設定匯出可能暴露憑證，應只在代理對話之外的人工操作終端機中進行。

```bash
ocx provider apply --baseline providers.baseline.json --file providers.next.json --json
ocx provider snapshot --json
```

僅在經審閱且已授權的移除或重新命名時才加上 `--yes`。批次 PUT 會保留未觸及的私有值，並使用公開基準偵測衝突。它**不會**執行單一供應商 DELETE 的 OAuth 帳號清理作業。HTTP 409 會回傳結束碼 5：請重新抓取新快照、檢視並行變更並重建擬定的編輯。請勿替換基準或自動重試。未知的寫入結果需要檢查確認，而非假設已回滾。

請使用一般 UTF-8 JSON 檔案或明確指定管線 `-`；最多只能有一個批次輸入來自 stdin。每個輸入上限為 4 MiB 且讀取逾時為 30 秒。序列化後的 `{baseline,next}` 請求合計也必須在 4 MiB 以內。互動式 stdin、特殊檔案、衝突旗標、無效欄位以及未經確認的移除會在異動前拒絕並以 2 結束。輸入錯誤絕不回顯送出的值。

### 無金鑰匯入 CC-Switch 供應商

```bash
ocx provider import-cc-switch --source ~/.cc-switch/cc-switch.db
ocx stop
ocx provider import-cc-switch --source ~/.cc-switch/cc-switch.db --provider my-provider --apply
# 在另一個終端機啟動代理（或執行 ocx ensure），再新增金鑰：
ocx start
printf '%s\n' "$API_KEY" | ocx account add-key my-provider

# 獨立的回滾路徑（先停止代理；僅移除未修改的無金鑰項目）：
ocx stop
ocx provider import-cc-switch --restore
```

`ocx provider import-cc-switch` 僅從一般本機 CC-Switch SQLite 資料庫或舊版 JSON 檔案投射明確白名單內的非機密中繼資料欄位（供應商 ID、應用類型、base URL、協定轉接器與預設模型）。為掃描輸入會暫時讀取來源與內嵌設定位元組，但金鑰／憑證欄位、自由文字顯示名稱與 TOML 註解會在位元組層級略過，絕不解碼為字串、寫入磁碟或記錄日誌，且暫存位元組緩衝區會在 `finally` 中清零。窄化 base URL 路徑規則（`http(s)://host[:port]` 配空路徑或 1–4 個小寫 `[a-z0-9._-]` API 路徑段，如 `/v1`、`/api/v1` 或 `/compatible-mode/v1`）與識別碼／模型語法檢查僅作為縱深防禦並拒絕不合規值（不回顯原值）。來源檔案透過 `O_NOFOLLOW | O_NONBLOCK` 描述元驗證單次開啟，SQLite 在記憶體中唯讀反序列化且不寫入暫存檔；具有多個硬連結（`nlink > 1`）的 SQLite 檔案會被拒絕以防透過別名路徑繞過附屬檔檢查，若同層 `-wal` 或 `-journal` 檔案非空則會拒絕匯入並提示先關閉 CC-Switch（或執行資料庫 checkpoint）再重試。請僅從受信任的本機 CC-Switch 來源檔案匯入，並在新增憑證前核對輸出的每個 ID、模型與 `baseUrl`：

- **預覽（預設）：** 需要 `--source <FILE>`，不寫入任何內容，回報發現、可用、衝突與無效項目數量。
- **套用（`--apply`）：** 需要 `--source <FILE>` 且代理已停止（`ocx stop`），在 Remote Link Child 上會被拒絕。重複指定 `--provider <id>` 可僅匯入所選項目，傳入 `--allow-private-network` 可允許迴路或私有網路 base URL。即使未事先預覽，`--apply` 也會在寫入無金鑰供應商項目與回滾日誌 `$OPENCODEX_HOME/cc-switch-provider-import-journal.json` 之前輸出每個匯入供應商的 ID、預設模型與目標 URL（文字模式輸出至 `stdout`，`--json` 模式輸出至 `stderr`）；存在使用中回滾日誌時再次執行 `--apply` 會被拒絕。核對輸出項目後啟動代理（在另一終端機執行 `ocx start` 或執行 `ocx ensure`），再透過 `printf '%s\n' "$API_KEY" | ocx account add-key <provider>`（管線標準輸入）或 `ocx login <provider>` 新增憑證。
- **還原（`--restore`）：** 獨立的回滾路徑（而非新增憑證的後續步驟），要求代理已停止（`ocx stop`），在 Remote Link Child 上會被拒絕，且不接受 `--source`、`--provider` 或 `--allow-private-network`。它會以唯讀位元組方式檢查 `auth.json`（無法讀取或格式損毀時安全保留），僅從使用中日誌移除仍維持匯入時無金鑰狀態、未被選為 `defaultProvider`，且未被路由、組合（combos）、回退策略（fallback policy）、OAuth 帳號或 API 金鑰參照的供應商。

## 認證

### 診斷缺失的主帳號配額

當該操作嘗試進行 WHAM 用量讀取時，`ocx account list openai --quota --refresh --json` 會在主帳號那一列附上一個 `quotaRefresh` 物件。既有的 `GET /api/codex-auth/accounts?refresh=1` 回應會暴露相同的診斷資訊。

其 `status` 可能是 `ok`、`not_reported`（成功回應中沒有可解析的配額）、`http_error`、`timeout`、`network_error`、`invalid_response` 或 `internal_error`。只有 `http_error` 包含數字的 `httpStatus`。這個物件不包含任何原始回應、錯誤訊息、憑證或帳號識別碼。僅限快取的讀取、憑證延遲，以及已失效的帳號快照都會省略它；較舊的伺服器同樣會省略。缺席不代表成功。即使錯誤內文無法讀取，非成功的 HTTP 狀態仍會回報為 `http_error`；`timeout` 與 `network_error` 描述的是收到標頭之前，或在讀取一個成功回應期間發生的失敗。

有效的登入不保證這個獨立的用量請求會成功。這些分類不會改變認證、帳號選擇或配額新鮮度規則，也不會把未知配額變成零用量。這項診斷目前只涵蓋原生主帳號，不包含池帳號的重新整理。回報配額缺失時，請提供分類與 HTTP 狀態，而不是憑證檔案或原始網路擷取。

### `ocx login <provider>`

啟動供應商已註冊的登入流程。OAuth 供應商會開啟瀏覽器並在 `~/.opencodex/` 下儲存憑證（可重新整理的 token 會自動輪替；像 OrcaRouter 這類耐久金鑰授權則會重複使用，直到供應商撤銷它們）；API-key 登入供應商會開啟其金鑰儀表板、提示輸入金鑰、在可能時驗證它，並儲存產生的供應商設定。當名稱缺失或未知時，指令會印出目前接受的 OAuth 與 API-key 供應商 id。

失敗的 OAuth 登入會以狀態碼 1 結束並印出固定診斷資訊：當供應商有回傳時印出 HTTP 狀態與標準 OAuth 錯誤碼（例如 `invalid_grant`）；無法連線至供應商時印出 `network_error` 或 `timeout`；本機設定（例如 Codex 帳號命名空間）阻擋登入時印出 `configuration_error` 與原因；其餘情況印出 `oauth_authentication_failed`。當自訂供應商佔用了該名稱或其設定檔無法讀取或解析時，Pool 2（`anthropic2`）同樣會在提示前先回報 `configuration_error`。

在 `ocx status` / `ocx doctor` 回報需要重新認證或終端 refresh 失敗後，請使用相同指令**重新認證**（或在儀表板中使用 Reauthenticate）。Codex pool 帳號不是上面那些 OAuth／API key 供應商，但 `ocx login codex` 可以到達：它會轉到帳號池登入，所以 `ocx login codex --reauth` 等同於 `ocx account reauth codex`。儀表板的 Codex 帳號池（Reauthenticate）也可以。這條路徑跑在 proxy 內部，需要 proxy 正在執行。

對於 ChatGPT OAuth 供應商，明確確認 refresh 授權已過期或遭撤銷的終端 OAuth 錯誤碼才會要求重新登入。單純的自由文字描述絕不要求重新認證。暫時性的 token 服務失敗、逾時與取消仍會讓帳號保有後續重新整理的資格。瀏覽器 token 交換與重新整理每次 fetch 皆有 30 秒逾時上限（涵蓋標頭與內文）。來自 HTTP 的錯誤只顯示狀態碼與白名單內的 OAuth 錯誤碼。取消、逾時與傳輸失敗使用固定訊息，不含原始原因或根因。

```bash
ocx login xai
ocx login anthropic
ocx login orcarouter-oauth # 瀏覽器同意 + S256 PKCE
ocx login orcarouter       # 貼上既有的 API 金鑰
ocx login anthropic --headless # 不開瀏覽器、不綁定本機連接埠
```

`--headless` 執行適用於瀏覽器無法連回代理迴路回呼位址的主機（容器、遠端伺服器）之**顯示授權碼（code-display）**登入。該指令會印出授權 URL；在任一瀏覽器核准後，供應商會顯示一組 `code#state` 字串供貼回提示列。不會綁定回呼連接埠，也不會啟動瀏覽器。`anthropic` 與 `anthropic2` 支援此模式。`xai` 沒有授權碼頁面，因此 `--headless` 會改跑裝置登入：指令會印出 URL 與一組短碼，你在任一瀏覽器確認該短碼後即自行完成，無須貼上任何字串。其他供應商則會結束並列出支援的供應商清單。針對 Codex 帳號請改用裝置碼登入 `ocx account login codex --device`——`ocx login codex --headless` 會被拒絕而非轉送。顯示授權碼登入的貼上有效期限為 10 分鐘，且每次登入只接受一組授權碼：若交換失敗，請啟動新的登入。成功的登入會成為該供應商的現用帳號，與瀏覽器登入完全相同。

OAuth 重新認證會保留維運方的設定，例如模型選擇、價格覆寫與帳號容錯移轉偏好。登入擁有的傳輸／驗證欄位與 registry 擁有的目錄中繼資料會被重新整理。即時探索供應商會保留其選定的預設模型；靜態供應商可以用重新整理後目錄中仍存在的模型，替換一個已不存在的預設模型。

對於 Antigravity，上游的 `401` 可以重新整理被拒絕帳號的 OAuth 憑證，並重試該請求一次。重試使用該憑證的 Cloud Code Assist 專案。若重新整理失敗，或沒有可用的專案，請求會回傳認證錯誤；請使用上方的重新認證流程。第二次 `401` 不會啟動另一輪重新整理／重試循環。要求驗證帳號的 `403` 會把該憑證隔離為 `needs-reauth(verify)`；當啟用帳號容錯移轉時，該請求可在另一個合格帳號上重試。請完成 Google 的帳號驗證，再執行 `ocx login google-antigravity`。靜默 token 重新整理不會清除此驗證要求。若 OpenCodex 無法儲存該隔離狀態，此轉接器交換會保留原始的 `403` 而不再發送復原請求，因為該帳號尚未被持久隔離。若無法建構或准許發送同組替代請求，該交換會透過正常錯誤格式回傳原始 `403`。外層的 combo 或政策路由仍可套用既有的回退規則。

對於基於 fetch 的網頁搜尋請求，自動切換同組替代帳號僅接受包含 `error.details[].reason === "VALIDATION_REQUIRED"` 的完整且有界的 Google 錯誤封套。僅出現驗證字樣不會觸發輪替。此請求範圍內的復原會使用同組帳號的 token 與專案，但不寫入永久性的 `needs-reauth` 標記；取消、已提交輸出、預算耗盡或沒有可用的同組帳號時會保留原失敗。

已在執行的 proxy 會在不重啟的情況下取得新憑證：CLI 會要求它從磁碟重新載入該供應商，而請求本身不帶任何憑證。若執行中的 proxy 無法接受該請求——最常見的原因是它啟動自早於 attested reload 的建置——登入仍會成功，憑證仍會寫入磁碟，但正在執行的行程會繼續使用舊憑證。CLI 會說明這一點並要求你重新啟動：

```
⚠️  A proxy is running but could not reload this provider (unattested-target).
   The credential is saved to disk; the running proxy keeps using the previous one.
   Restart it to pick this up: ocx restart
```

### `ocx logout <provider>`

預設會在本地移除已儲存的 OAuth 憑證。`--json` 會回報 `{schemaVersion:1, ok, provider, removed}`；找不到憑證時回傳 `reason: "not_found"` 並以 4 結束，移除成功則以 0 結束。

若要在執行中的代理上請求登出，`ocx logout <provider> --live --json` 接受公開的 OAuth 供應商並回傳 `{schemaVersion:1, success:true, provider, live:true}`。它不會登出 Codex／原生主帳號，也不會移除單一指定帳號。在即時請求執行前它絕不會刪除本機憑證，失敗後也不會退回本地刪除。

## 帳號與金鑰池

### 池政策、帳號門檻與付費點數意圖

修改目標政策前，先讀取離線說明，再讀取選定目標的政策：

```bash
ocx account pool --help
ocx account pool openai --json
ocx account pool anthropic --json
```

這些屬於即時管理讀取操作。回應包含 `provider`、`kind`、`supported`、可為 null 的已儲存政策、`enabledEffective` 與選用的 `inert`。只有 `supported` 列出的欄位才能寫入；`null` 不等於 `false`，且無效用（inert）的政策代表未啟用池化。門檻設為 0 與 `enabled: false` 彼此獨立。僅在支援處使用 `--enabled on|off`、`--threshold 0..100`、`--strategy`、`--sticky 1..100` 與 `--quota-window`。OpenAI 不支援池的 enabled／window 寫入；`reset-first` 僅適用於 OpenAI 與通用 OAuth 池（絕不適用於 Anthropic），`least-loaded` 僅限 Kiro，而 Anthropic 視窗為 `five-hour`、`weekly`、`max-utilization`。省略的欄位維持不變。讀取回來的 DTO 欄位（例如 routes、逐帳號並行數或 Anthropic `nativeMessages`）並不表示此指令有對應的設定旗標；請僅使用列出的 CLI 選項。若儲存回傳 `warning: "config_bookkeeping_failed"`，代表變更已持久化，但需要重新讀取以確認即時狀態。

```bash
ocx account pool anthropic --threshold 80 --quota-window five-hour --json
ocx account pool anthropic --json
ocx account auto-switch openai status --account <id-or-alias-or-main> --json
```

明確指定 `--account` 會選取 OpenAI 的單一帳號門檻。動作包含 `status`、`on`（80）、`off`（0）、`inherit`（null）或 `threshold N`（0–100）。不加 `--account` 時，既有的 auto-switch 指令維持以整個池為範圍。結果為 `{ok, id, autoSwitchThresholdOverride, autoSwitchThreshold}`；請分別解讀可為 null 的覆寫值與觀測到的生效值。

內含配額用盡後使用付費點數屬於獨立政策，需要明確的消費授權意圖。`ocx account credits openai <id-or-alias-or-main> on|off --json` 鎖定單一帳號。`ocx account credits openai --all on|off --json` 與該選擇器互斥：開啟會記錄目前可選取的 ID 加上主帳號，關閉則清空清單。回執格式為 `{ok, id, creditsAfterLimit}` 或 `{ok, all, ids}`；請保留實際回傳的 ID 並回讀 `ocx account list openai --json`。透過 `--show-codex-credits` 顯示點數餘額不會啟用此政策。請勿為了從失敗的登入或配額讀取復原而啟用點數。

### 配額啟用與重設補助觀測

```bash
ocx account quota-activation openai <id-or-alias-or-main> --window fiveHour off --json
ocx account list openai --json
ocx account anthropic-reset-grants --json
```

配額啟用接受 `fiveHour` 或 `weekly`，刻意與 Anthropic 池的 `five-hour` 區隔。它只寫入單一帳號／視窗開關；啟用時可能排程配額重新整理。`{ok, id, window, enabled, available}` 回報的是政策與觀測到的可用性，而非已完成的重新整理。於不可用時嘗試啟用可能回傳 409；停用則始終允許。它絕不會消耗任何重設補助。

Anthropic 重設補助接受選用的精確 Anthropic 帳號 ID，而非 Codex 別名／`main` 選擇器；省略時使用既有的現用／回退選擇。此 GET 可能會連線至上游狀態服務。它回報資格與原因、補助數量、可為 null 的日期、冷卻時間、待處理操作以及日誌可用性。空的補助清單不等同於不可用狀態。它絕不會消耗補助或恢復待處理的支出。消耗補助仍屬於人類透過 GUI 執行的操作。

### 使用剩餘的內含配額

若要讓選定帳號在超過主動切換門檻或主帳號保護門檻後仍繼續使用，請明確啟用其剩餘配額偏好設定：

```bash
ocx account use-remaining openai main on
ocx account use openai main
ocx account use-remaining openai main status --json
ocx account use-remaining openai main off
```

將 `main` 替換為唯一的池帳號 ID 或別名即可鎖定已新增的帳號。啟用此設定會停用該帳號的主動用量切換。針對主登入帳號，它也會將兩個生效的硬鎖定門檻提高到 100%，因此 95% 的讀數仍可受理請求。此偏好會在重啟後持續生效直到關閉；原始門檻設定仍會保留，並在停用此偏好後恢復套用。它本身不會主動選取帳號，也不會覆蓋輪詢排程、手動／自動暫停、權益檢查、重新認證或上游冷卻。付費點數許可仍是獨立設定；啟用此項目絕不會讓帳號加入點數使用或兌換重設補助。預設開啟的主帳號硬鎖定在達到 100% 時仍會拒絕請求。

`GET /api/codex-auth/accounts/use-remaining?id=<account-id>` 讀取即時政策。`PUT /api/codex-auth/accounts/use-remaining` 接受 `{ id, useRemainingQuota: boolean }`。

### 主帳號額度保護

在 **Codex settings → Multi-auth → Advanced settings** 中，**Block main account** 預設開啟，位於 Ultra Fast 旁邊。關閉它會立即生效；重新開啟時會先顯示後果，取消則不會改變設定。即使 Advanced settings 已關閉，主帳號卡片仍會顯示監控中、未知用量或目前的政策封鎖狀態。

這個預設來自主帳號耗盡時對 Codex Desktop 的影響：一旦 ChatGPT 帳號視窗回報剩餘 **0%**，Desktop 會停用它的送出按鈕，帳號在視窗重設之前也不再接受回合。讓 ocx 自己的流量停留在那個點之下，可以讓帳號保持可用（[#5694](https://github.com/lidge-jun/opencodex/issues/5694)）。代價是 Luna Reserve：封鎖生效期間，該主帳號上的 Reserve 無法啟動。若要讓主帳號跑到耗盡再交給 Reserve，請關閉這個開關。

**5 小時視窗與週視窗各自獨立封鎖**：5 小時視窗達到 90% 或週視窗達到 98% 時立即封鎖，即使另一個視窗仍有餘裕。僅有月配額的帳號使用其月視窗。在開關保持開啟的情況下，只要每個造成封鎖的視窗都回報了低於其門檻的全新讀數（0% 的重設也算），封鎖就會自動解除；下一次在門檻處的觀測會再次封鎖。請在 `config.json` 中設定 `codexMainAccountHardLockThresholds`，可選的 `short` 與 `long` 百分比，例如 `{ "short": 90, "long": 98 }`。兩者都必須是 80 到 100 的整數，且 `short` 不可超過 `long`；省略的欄位使用預設值。設定 API 接受相同的物件，並在 `mainAccountHardLock.thresholds` 中回傳實際生效的值。

**鎖定阻擋請求期間，請求可退回至另一個模型而非直接失敗。** **Fallback while blocked** 那一列位於保護開關旁邊，運作方式類似 shadow-call 列：挑選一個模型（例如 `deepseek/deepseek-chat`）會立即開啟重導向，選用的思考強度會套用至該模型，而該開關會暫停重導向但不會忘記已選模型。當封鎖生效且沒有 Codex 帳號能服務原生 Codex 模型的請求時，該請求會改為路由至備援模型（搭配設定的思考強度）而非遭到拒絕。若有可用的池帳號仍會優先服務；帶供應商前綴的選擇器、combos、指定帳號列與 Luna Reserve 各自維持其目的地；而備援設定本身若指向原生 Codex 模型會被忽略，因為把 `gpt-*` 重導向至 `gpt-*` 只會再次進入相同的拒絕。鎖定本身不變：它仍照常自動解除，重導向也隨之結束。可在 `config.json` 中設定 `codexMainAccountHardLockFallback` 為 `{ "model": "deepseek/deepseek-chat", "reasoningEffort": "low" }`；`enabled: false` 會在保留模型的同時暫停重導向。缺少該區段、省略模型或區段格式錯誤時，請求會照常被拒絕；`reasoningEffort` 必須是已宣告的強度值。設定 API 接受相同物件，會在異動前拒絕無效寫入，且傳入 `null` 會清除該區段。

當全新的讀數在同一個重設週期內上升至少一個百分點，且最近沒有經過這個 proxy 的主帳號活動時，儀表板與 `ocx status` 會顯示**可能有 opencodex 以外的用量**。這是參考性的觀察，不是證據：長時間執行的回合也可能造成它。這個鎖定可能無法防止來自外部流量的耗盡。程序本機的通知會在身分或重設改變時清除，並在六小時後或在觀測到的重設時（以先到者為準）過期。當有即時的管理證據時，`ocx status --json` 會在 `mainAccountHardLock` 下公開狀態、生效的門檻、造成封鎖的視窗種類，以及選用的 `externalUsage` 警告。

無法讀取的 5 小時讀數不能隱藏週封鎖。未知的用量不會被捏造成零，缺失的讀數也不會抹除已經量測到的封鎖狀態組。單靠預測的重設時間並不會解鎖。封鎖期間，復原機制會依上限為 5/10/20/40/60 分鐘的排程檢查自有帳號的用量中繼資料，因此若在 opencodex 之外兌換了重設，會在預測重設時間之前就被察覺；第一次檢查等待五分鐘，每次檢查至少間隔五分鐘，而下一次檢查會提前對齊到最新已知的封鎖重設時間。已暫停或需要重新認證的主帳號在預測重設前不會收到檢查。較長的 `Retry-After` 也會延後設定檔與 token 的準備。只有全新的有效用量，或有權威的視窗缺席證據，才能解除封鎖。在 Pool 模式下，額度 `--refresh` 會繞過快取新鮮度，但仍遵守失敗讀取的節奏；被延後的讀取不會產生新的診斷嘗試。其他暫停、重新認證與上游限制彼此獨立。

當一次全新有效的 WHAM 用量回應，其主視窗明確持續**至少 24 小時**並回報有效用量，或其主視窗明確為 `null` 且量測到的次要視窗提供週用量時，保護會把它視為舊 5 小時讀數的替代。在這兩種情況下，次要／第三視窗都必須明確為 `null`，或明確持續至少 24 小時並回報有效用量。這遵循解析器的 short/long 邊界，所以一天的視窗與週／月視窗一樣符合資格。目前的視窗仍使用相同設定的長視窗門檻（預設 98%）。這依賴單一回報的快照；不需要重複觀測。任何被省略的視窗欄位、未知的持續時間，或不完整的回應標頭，都不能清除先前的封鎖。只帶有點數與補充性僅月讀數的全 null 回應，也不能建立復原。套用延遲的回應之前，proxy 會再次檢查儲存的憑證。無法讀取的檔案或被取代的 bearer，不能更新用量快取、解除鎖定或隔離新的憑證，即使是沒有第二次額度讀取的同一個帳號也一樣。它解析出的一般用量仍可回傳給發出請求的呼叫者，但不會更新共享狀態，也不會成為復原證據。帳號卡片顯示已發布的快取用量，讓它的額度與鎖定狀態保持一致；Direct 供應商額度會省略未發布的回應與它較舊的快取報告。身分衝突與過期的 401/403 回覆會保留目前快取的資訊，並且不能清除或設定目前帳號的重新認證狀態。

使用已識別主憑證發出的請求，其回應會透過配額標頭更新該主憑證的快取用量，無論是由代理代為替換已儲存憑證，或是由呼叫端自行送出相同憑證皆然。只有在回應抵達時該憑證仍是目前觀測到的主憑證才會套用更新；屬於其他帳號或工作區的呼叫端自有憑證絕不會更新主帳號的用量。

持久化的選項是 OpenCodex `config.json` 中的 `"codexMainAccountHardLock"`。缺少該鍵或為 `true` 代表開啟；只有明確的 `false` 才會關閉，而關閉設定時儲存的正是這個值。這裡改變了預設：這個政策過去是選擇加入，舊的開關在關閉時會移除該鍵，所以曾經關閉過的安裝現在會讀成開啟。如果你想要舊的行為，請把它關閉一次以記錄選擇退出。保護涵蓋的是使用已識別主帳號的新請求，不是最後那 2% 本身：已在執行的請求、不相符的呼叫者自有 keyring 憑證，以及 proxy 之外的流量仍可以消耗額度。已新增的帳號與其他供應商仍可使用。

啟用保護時，一次自有的啟動會在原生設定檔復原與清理之後，還原主憑證的記憶體內身分繫結，所以持久化的政策封鎖在重啟後仍會存續。呼叫者自有的 Direct、exact-main、main-fallback 與 main-pin 請求，在繫結尚未完成期間可能短暫收到 503；健康的已儲存池帳號全程保持合格。這項初始化不會從外來或未確認的服務 home 讀取任何憑證。

當此政策封鎖主帳號時，該帳號上的 Luna Reserve 也會被封鎖。維持在一般額度耗盡之前可能會阻止 Reserve 啟用。關閉這個開關會恢復一般的本機處理方式，不會授予額外的上游權益。請使用帳號額度重新整理動作來取得一次全新的觀測；不會自動消耗 reset credit。

### Luna Reserve 與路由模型並存

選用的[免登入 Desktop 模式](/zh-tw/guides/codex-integration/#免登入-codex-desktop選擇加入)會讓 Desktop 原生的 Reserve-only 選擇器閘門保持停用。它也會停用 Desktop 自動的 Reserve 處理：Reserve 是明確的模型選擇，不是自動退回。

在 ChatGPT-forward 模式下保持內建 OpenAI 供應商啟用、啟用帳號模型選擇器，並為已儲存的主帳號設定公開選擇器。在有效的迴路 authless 模式啟用時，`ocx sync` 會在路由供應商模型旁納入 `<main-selector>/gpt-reserve`。裸 `gpt-reserve`、已新增帳號的選擇器，以及 API-key 模型探索都不會被加入目錄。對於遠端用戶端路由，或需要准入標頭的監聽器，authless 設定會被忽略。當公開與本機監聽器同時執行時，Reserve 相容性只適用於由本機監聽器准入的請求。已認證的公開請求即使源自同一台機器，仍走一般路徑；請求標頭無法選擇本機政策。

用 `ocx system settings --desktop-authless on` 啟用 authless Desktop 模式，執行 `ocx sync`，然後完全結束並重新開啟 Codex Desktop，讓它重新載入改寫後的設定與目錄。請遵循[標準 authless Desktop 工作流程](/zh-tw/guides/codex-integration/#免登入-codex-desktop選擇加入)。

每個相容性請求都會檢查一次綁定憑證的伺服器授權，最多快取 60 秒。OpenCodex 在一次自有主帳號用量讀取上發送 Reserve 能力標頭，並要求一般用量被拒絕、出現 Luna Reserve 橫幅，且恰好有一個獲准的 Reserve bucket。缺失、被拒絕、過期或不相符的證據會拒絕該請求；它不會切換帳號，也不會悄悄改用一般的 Luna。被動用量可以撤銷授權，但無法建立授權。全域冷卻、暫停、重新認證與主帳號硬鎖定仍然適用。若想在已耗盡的主帳號上使用 Reserve，請關閉硬鎖定；這麼做不會授予伺服器端的權益。這條相容性路徑支援對話請求與壓縮，Reserve 不能作為視覺或網頁搜尋輔助工具，也不能作為獨立的搜尋轉送模型。這些輔助用途請改選其他模型。

選擇器偏好真正的 Reserve 中繼資料。當尚未觀測到任何資料時，它會使用明確標記的 Luna 中繼資料轉接，依循 Desktop 的 Reserve-or-Luna 預設對應。可見的項目不代表可用性的證明。已檢查過 Desktop 原始碼與以 fixture 為基礎的路徑；尚未使用實際 Reserve 啟用中的帳號驗證這條相容性路徑。

### `ocx account <subcommand>`

透過執行中的代理列出並切換供應商帳號與 API-key 池。隨附的說明介面如下：

```text
Usage: ocx account <list|history|current|use|clear|refresh|auto-switch|alias|priority|pause|resume|reset-affinity|pause-exhausted|strategy|sticky|remove|clear-cooldown|add-key|import|import-orca|login|reauth|code|cancel|reset-credits|grok-reset-coupons|main> ...

list [provider]     Codex 帳號池、OAuth 帳號與 API 金鑰（識別碼依 API 回傳遮罩顯示）。
history openai <pool-account-id> [--limit <1-200>]  單一 Codex 帳號池帳號的近期路由決策。
current <provider>  顯示現用帳號或金鑰。
use <provider> <id|alias|main|auto> 切換現用憑證；'main' 選擇 Codex App 登入，'auto' 清除選擇，除非有帳號的 id 恰為此值。
clear <provider>  無條件清除 Codex 帳號的手動選擇。
refresh <provider>  強制重新整理 Codex 或供應商配額報告。
auto-switch <provider> <on|off|status|threshold N>  控制 Codex 池閾值。
alias <provider> <id|alias> <display-name|->  設定或清除帳號顯示名稱；'-' 表示清除。
priority <provider> <id|alias|main> [first|earlier|normal|later|last|-100..100|reset]  選擇順序；省略取值即讀取目前值。
pause <provider> <id|alias|main>  將帳號移出自動選擇。
resume <provider> <id|alias|main>  將暫停的帳號放回自動選擇。
pause-exhausted <provider>  暫停所有配額已用盡的帳號。
clear-cooldown <openai|anthropic> <id|alias|main>  清除上游失敗後設定的冷卻。
reset-affinity <anthropic|anthropic2> [--json]  確認所有工作階段綁定均已清除，即使沒有帳號也適用；帳號選擇與暫停狀態保持不變。請在 Home 執行；Remote Link Child 只會指出 Home，不會傳送請求。
strategy <provider> [<quota|round-robin|fill-first|least-loaded|reset-first>]  帳號池放置策略；least-loaded 僅限 Kiro。
sticky <provider> [<1-100>]  已綁定執行緒在同一帳號上保留的請求數；省略取值即讀取目前值。
remove <provider> <id|alias|main> --yes  在存在檢查後移除已儲存的帳號或金鑰。
add-key <provider> [--label <label>]  僅從 piped stdin 讀取並新增金鑰。
login/reauth/code/cancel  從無頭 shell 執行瀏覽器或手動 code 認證。
reset-credits <id|main> [--consume --yes]  檢查或消耗 Codex reset credits。
grok-reset-coupons [<id>] [--consume --yes] [--token-id <token-id>] [--operation-id <uuid>]  檢查或兌換 Grok reset coupons。
import <provider> --format <format> (--file <path>|--stdin)  從指定的外部格式匯入憑證。
import-orca --source <dir> --registry <file> [--apply]  預覽或套用來自 Orca 管理的 Codex home 的匯入。
main <doctor|list|register|add|reauth|switch|recover>  管理帳號池稱為 'main' 的 Codex App 登入。
切換現用帳號會立即生效；執行中的執行緒會在下一個請求時切換，而進行中的請求仍保留其擷取的帳號。
選擇順序變更自下一個未繫結的請求起套用，且絕不會移動已繫結的執行緒。
```

除 `import-orca` 外，子指令都需要代理正在執行，CLI 自動解析其記錄的 runtime 連接埠；`import-orca` 的預覽完全在本機進行，而 `import-orca --apply` 需要代理已停止。成功的操作離開 0。無效用法、未知供應商或帳號／金鑰 id、不可達的代理或 API 失敗通常以 1 結束。但 `reset-affinity` 遇到 HTTP 404 時結束碼為 4，遇到 HTTP 409 時為 5；其他 API 失敗與未確認的結果則為 1。憑證欄位完全依管理 API 回傳的方式顯示（包含其遮罩）；原始 API 金鑰與 OAuth token 永不回傳。顯示便利性在客戶端合成，與儀表板相同：`main` 是 `openai` 帳號池中 Codex App 登入的 CLI 別名，無電子郵件的 OAuth 帳號顯示為 `Account N`，而 plan／label 欄位在 plan、遮罩電子郵件、label 與遮罩金鑰之間回退。

`--json` 帳號列使用此通用結構（不可用時省略可選欄位）：

```json
{
  "provider": "openai",
  "type": "codex | oauth | api-key",
  "id": "__main__",
  "label": "plus",
  "email": "m***@example.com",
  "plan": "plus",
  "masked": "sk-ab****wxyz",
  "priority": 0,
  "active": true,
  "needsReauth": false,
  "quota": null
}
```

### `ocx account import-orca --source <orca-data-directory> --registry <orca-data.json> [--apply] [--json]`

重用本機由 Orca 管理的 Codex 登入，不需要再次瀏覽器登入。來源目錄必須包含 `codex-accounts/<account>/home/auth.json`。請明確提供 Orca 資料目錄，以及所選 profile 的 `orca-data.json`。只有登記在該 profile 中的帳號會被納入考量；殘留或已移除的帳號 home 不會被匯入。每個 home 都必須帶有 Orca 相符的 `.orca-managed-home` 標記。此指令不會掃描不相關的 home 或遠端主機。

```powershell
# Windows：僅預覽；不會註冊任何帳號。
ocx account import-orca --source "$env:APPDATA\orca" --registry "$env:APPDATA\orca\profiles\local-default\orca-data.json" --json

# 套用前先完成進行中的代理請求並停止代理。
ocx stop
ocx account import-orca --source "$env:APPDATA\orca" --registry "$env:APPDATA\orca\profiles\local-default\orca-data.json" --apply
ocx start
```

較舊的 Orca profile 可能把 `orca-data.json` 直接放在資料目錄下。在其他平台上，請以相同的目錄結構傳入本機 Orca 資料目錄與 profile registry。匯入器會略過已存在於原生主登入、帳號池或憑證儲存中的身分，包括來源內部的重複項目。這刻意把 ChatGPT 帳號 ID 當作保守的分組依據：共用同一個 workspace 帳號 ID 的不同成員也會被略過，不會被合併或個別匯入。重複執行匯入會保留既有帳號。如果先前的匯入在儲存憑證與註冊帳號池項目之間中斷，只有在未被動過的待處理紀錄仍與來源相符時，重試才能用相同的 ID 完成該次註冊。無效項目會依固定的原因代碼計數。只要有至少一個合格帳號，混合結果就會成功結束；若每一筆發現的項目都無效，則以非零狀態結束。輸出只包含計數與原因代碼，不含電子郵件、帳號識別碼、路徑或 token。

**Orca 保留 refresh 的所有權。** OpenCodex 只儲存一個唯讀的來源連結，以及一份 access-token 快照，絕不儲存 Orca 的 refresh token。解析憑證時，它會重新讀取來源，並驗證其仍屬於被匯入的身分。Orca 必須讓該登入持續可用並保持已更新。來源憑證缺失、格式錯誤、已過期或身分不符時，會 fail closed；OpenCodex 不會退回使用舊快照，也不會自行 refresh 來源登入。這是一個本機連結，不是可攜式匯出，也不是 refresh 所有權的轉移。已經送往上游的請求仍使用它們當時取得的憑證。

新帳號會以**驗證待處理**狀態註冊。啟動代理之後，開啟 **Codex Auth** 並點擊**重新整理配額**以授權既有的模型驗證步驟，這可能會消耗少量配額。離線匯入與 JWT 解析並不會建立上游認證。單靠 CLI 的配額重新整理也不會執行那項驗證。匯入器永不啟動或停止任一應用程式、變更 Orca 檔案，或變更目前使用中的帳號池帳號。

### `ocx account list [provider] [--json] [--all] [--quota [--refresh]]`

即使主機沒有原生 Codex 主目錄，仍可列出已儲存的 ChatGPT 池帳號，包括在儀表板中及重新整理帳號時。列出帳號不會建立 Codex 主目錄，也不會將原生主帳號登出。停用 Codex 用戶端整合不會停用對既有原生登入的額度觀測；明確設定但無效的 `CODEX_HOME` 路徑仍會回報設定錯誤。若 `OPENCODEX_HOME` 儲存空間不安全，即使原生 Codex 主目錄不存在，也會回報錯誤。解析預設 Codex 主目錄路徑時，若該路徑是檔案、目標不存在的符號連結，或父目錄無法遍歷，也會回報錯誤。

未指定供應商時，列出 Codex 池、OAuth 帳號與已設定的 API-key 池。除非存在 `--all`，否則空的供應商會被跳過。指定供應商時，僅列出該憑證家族。人類輸出使用 `PROVIDER TYPE ID PLAN/LABEL PRIORITY STATUS`；手動選擇的 Codex 列標記為 `selected`。`PRIORITY` 是帶正負號的 Codex 選擇順序（未設定時為 `0`），對於順序不適用的列（例如 OAuth 帳號與 API 金鑰）則顯示 `-`。當已儲存兩個 Kiro 帳號時，速率限制、已確認的月配額耗盡與停權拒絕可在輸出送出前輪換至合格帳號；在套用一般池策略前，會優先考量具備正面快取模型清單證據的合格帳號。此被動輪替由帳號存在與否驅動，無法關閉——`oauthAccountFailover.enabled: false` 拒絕的是送出前的帳號偏好，而非拒絕復原，且供應商覆寫設定具有優先權；`ocx account login kiro` 每次將一個帳號加入池中。空結果仍為成功。`--json` 回傳：

```text
{ accounts: AccountRow[], notes: string[] }
```

Codex 的 JSON 列包含 `slotId`（已註冊的 `id`）與 `slotKind`（`native-main` 或 `pool`）。當代理能同時驗證上游帳號與使用者身分時，也會包含 `upstreamAccountKey`（`uai1_` 後接 64 個小寫十六進位字元）。在 `openai` 供應商內相同的鍵值代表屬於同一位上游使用者的插槽；請分別保留各個插槽及其配額狀態。此鍵值僅限於本機安裝使用，並在管理員 token 輪替時可能改變。若缺少該鍵值，請勿依遮罩後的電子郵件或配額數值推斷兩者相符。原始上游 ID、使用者宣告與憑證皆不會列出。

空的供應商清單會在人類輸出與 JSON `notes` 中給出下一步指令：OAuth／Codex 為 `ocx account login <provider>`，API 金鑰則為搭配人類控制管線 stdin 來源的 `ocx account add-key <provider>`。全域清單為空時會指向 `ocx account login <provider>` 與 `ocx help account login`。

帳號列包含經檢驗的 `health` 標籤，且當有復原路徑時包含 `healthAction`。人類輸出會在表格下方印出復原指引。重新認證會使用 `ocx account reauth <provider> --id <id>` 鎖定已儲存帳號；原生主帳號則使用 `ocx account main reauth --device`。供應商驗證、憑證衝突與等待驗證各自保留明確的指引。Codex 列會在 list/current JSON 中保留伺服器回傳的布林值 `creditsAfterLimit`；人類輸出僅在啟用權限時顯示 `paid-credits: on`。這些讀取操作不會變更付費點數權限。

`--quota` 為支援 per-account 探測的供應商（目前是 Anthropic、Kiro、Google Antigravity 與 Devin）加上一個 `QUOTA` 欄位，顯示每個帳號自己的用量。這是選擇加入的，因為 proxy 會對每個已儲存的憑證探測一次上游；預設清單仍是本機讀取。`--refresh` 會略過快取結果。沒有 per-account 配額的帳號顯示 `-`，探測失敗的帳號顯示 `unavailable`——空白會被誤讀為「沒有用量」而非「未量測」。`--json` 帶有每個帳號的完整細分，而不只是彙總後的窗口。

API-key 池也支援 `ocx account list <provider> --quota [--refresh]`。未加 `--quota` 時，其列表不會請求配額探測。此選擇性讀取會使用每把已儲存金鑰的配額擁有者；`--refresh` 會向該擁有者請求全新證據並可能連線至上游供應商。它不會替換已儲存的金鑰，也不會讀取 `account refresh` 回傳的供應商整體彙總資料。

API-key JSON 列會保留 `quotaMode`（`probe`、`passive`、`unsupported`）、可為 null 的選用 `quota`，以及回傳時的 `quotaUnavailable`。公開配額可包含自訂視窗、美元點數餘額、Kiro 點數與更新時間，不限於 Codex 樣式的百分比。人類輸出會區分不支援、未量測、不可用與實際量測結果。未知不等於零；觀測到的零會被保留。格式錯誤的已消耗欄位或缺少 quota-mode 證據的回傳金鑰列會直接失敗，而非捏造支援狀態。空的池仍然有效。金鑰保持遮罩。

當餘額未知時，該列會在 `quotaUnknownReason` 說明原因：`no_balance_source`（OpenCodex 沒有此目的地的餘額讀取器）、`passive_not_observed`（被動式供應商尚未觀測到用量）、`read_failed`（存在讀取器且上次讀取失敗）、`not_read`（存在讀取器但尚未讀取，例如已暫停的金鑰）或 `not_reported`（讀取成功且供應商未回報可計量餘額）。Probe 列也會帶有 `quotaReadAt`（以 epoch 毫秒計的最後讀取時間，不論成功或失敗）。只有具備餘額讀取器的目的地（`quotaMode: "probe"`，例如 OpenRouter、DeepSeek、Ollama Cloud、Moonshot、Venice 與 Abliteration）才會顯示數值。人類輸出例如顯示 `unsupported: balance UNKNOWN (no balance source)` 或 `probe: mo 12%; read 3 min ago`，且絕不為未知餘額印出零。較舊的 CLI 會忽略這兩個欄位，而本 CLI 不認識的原因代碼會被捨棄。尚無觀測的被動式 OAuth 帳號同樣帶有 `passive_not_observed`，顯示為 `UNKNOWN (not observed yet)`。

Google Antigravity 列帶有與供應商層級配額相同的 `Gem` / `Cla` 窗口，是根據該帳號自己的憑證與 Cloud Code Assist 專案 id 計算出來的。per-account 探測一律透過固定的對外傳輸與 Google 的 Cloud Code Assist 主機通訊，無論是否設定了 `baseUrl`：自訂的 base URL 是請求的路由選擇，不是已儲存憑證的 Google 帳務第二來源。沒有專案 id 的帳號，或探測被重新導向或失敗的帳號，會顯示 `unavailable`。當後備模型探索提供配額讀數時，詳細顯示會以明確有界的標籤保留最多 256 筆模型診斷。這些列不會影響供應商摘要標題、嚴重性、帳號排名、路由或重設通知。

Devin 列來自針對該帳號自有金鑰發送至其白名單 API 伺服器主機的 Cognition `GetUserStatus`。若較舊的憑證沒有記錄主機，探測會使用在白名單內的已設定供應商 base URL，或採用美國預設主機。它們會顯示方案暴露的帶日期每日與每週視窗，並僅在有回報點數餘額的點數計費方案上顯示每月點數視窗；未知計費策略僅在兩個重設日期皆缺席時才使用該點數後備方案。已過期的每日與每週視窗會保持隱藏，不會轉為每月點數配額。無上限餘額或完全沒有餘額的狀態不會顯示點數視窗。只有遭拒的金鑰（401）會清除快取讀數；其他探測失敗會保留上次讀數。

```text
$ ocx account list anthropic --quota
PROVIDER   TYPE   ID        PLAN/LABEL         PRIORITY  STATUS  QUOTA
anthropic  oauth  1278f8da  a***r@examp***.com  -                5h 7% wk 62%
anthropic  oauth  e112f28b  k***1@examp***.net  -        active  5h 9% wk 45%
```

Kiro 按月計費額度且不回報更短的窗口，所以它的帳號會改為呈現 `mo` 數值：

```text
$ ocx account list kiro --quota
PROVIDER  TYPE   ID        PLAN/LABEL         PRIORITY  STATUS  QUOTA
kiro      oauth  3f0a91c2  a***r@examp***.com  -        active  mo 15%
kiro      oauth  8b24de70  k***1@examp***.net  -                mo 88%
```

`ocx account list kiro` 會將被排除在自動選擇之外的帳號標記為 `not-auto-selected(<reason>)`。JSON 帶有 `autoSelectable`，當其為 false 時帶有封閉列舉 `skipReason`（`paused`、`needs_reauth`、`suspended`、`cooldown` 或 `quota_exhausted`）。處於現用狀態的單一帳號池或全部被排除的池仍可能發送請求。Kiro `providerCredits` 來自實測的 `meteringEvent` 數值：單一實體回應內會保留最後一次讀數，而分開計費的發送會累加至請求花費中。點數絕不會從 token 數量估算。

當登入了兩個以上的 Kiro 帳號時，請求速率限制、已確認的月配額耗盡與已確認的停權拒絕可在輸出送出前輪換。月配額耗盡僅排除該次登入直到重設或證據過期；成功的服務會清除較舊的判定。配額拒絕包含 HTTP 400 或 429 上確切的 `MONTHLY_REQUEST_COUNT` 與 `OVERAGE_REQUEST_LIMIT_EXCEEDED` 原因。允許超額使用（overage）的方案在月計量達到 100% 後仍可繼續提供服務。當主動帳號偏好關閉時，被動輪替依然可用。帳號是逐一新增的——`ocx account login kiro` 會交給 Kiro CLI 處理，並把新帳號附加到池中。在儀表板中，登入與新增帳號在 Kiro CLI 選項旁也提供 Builder ID、Google 與 GitHub 裝置登入；原生裝置登入會在不登出 CLI 的情況下新增帳號。同一個組織（IAM Identity Center）設定檔的使用者會共用其設定檔 ARN，因此 Kiro CLI 帳號是由該設定檔加上 `kiro-cli whoami` 為該工作階段回報的電子郵件共同識別。同一組織的兩位使用者因此會維持為獨立帳號，同一位使用者再次登入則會更新該使用者的帳號。當 `kiro-cli whoami` 未回報使用者時，仍照舊僅以設定檔識別帳號。若該設定檔已有具已知使用者的帳號，這類登入只會重新整理其接續儲存 Kiro CLI 工作階段的帳號；任何其他登入都會遭到拒絕而非覆寫帳號，且「新增帳號」登入會把 Kiro CLI 切回先前的階段。執行 `kiro-cli whoami` 確認已登入使用者後再重試。針對在使用者尚未知悉前儲存的帳號進行重新認證時，會記錄簽入的使用者，除非該使用者在相同設定檔下已有另一個帳號。若要在不透過 Kiro CLI 的情況下新增帳號，請使用 `ocx account login kiro --method builder-id`、`--method google` 或 `--method github`。開啟印出的驗證 URL、輸入使用者代碼並等待核准。`--no-wait` 會印出流程 ID；可用 `ocx account cancel kiro --flow <flow-id>` 取消。原生登入僅能新增帳號；若要重新認證請先移除再重新加入。重複的社群設定檔 ARN 會建立另一個插槽並印出 `duplicate_profile_arn`；每個插槽各自保有獨立的配額與負載狀態。Kiro 可以在開啟 `pool.kernel` 與帳號偏好設定時選擇加入主動的 `least-loaded` 放置策略。主動模型偏好同樣要求全域或針對 Kiro 明確啟用帳號偏好設定；未設定或 false 會讓健康的現用帳號保持在位。模型清單是在帳號提供服務後才學習到的，因此未曾使用的同組帳號最初可能沒有證據。任何快取清單中皆缺席的模型 ID 仍會送往上游。其選用的 `maxConcurrentPerAccount` 上限是一個有界的逐帳號佇列：已滿的選定帳號最多等待 250 毫秒，接著回傳 503 `account_capacity` 與 `Retry-After: 1`。此上限僅作用於各別代理行程本機且不會移動請求；拒絕後被動輪替依然可用。

### `ocx account current <provider> [--json]`

顯示現用帳號或金鑰。無手動 pin 的 Codex 池會回報具優先權意識的自動選擇：先選出優先權最高的合格層級，再在該層級內依配額路由選出用量最低的帳號；另一個無現用憑證的家族回報該狀態並仍離開 0。`--json` 回傳：

```text
{ provider, type, activeId: string | null, autoSwitchThreshold?: number, account: AccountRow | null }
```

### `ocx account use <provider> <account-or-key-id|alias|main|auto> [--json]`

`auto` 會清除手動選擇，讓池重新依自身策略分配工作 — 但若 Codex 帳號的 id 恰為 `auto`，則精確 id 比對優先；`ocx account clear <provider>` 一律還原自動選擇。Codex 帳號可以用 `ocx account alias` 設定的別名代替 id 來指定；`priority`、`pause`、`resume`、`clear-cooldown`、`remove` 與 `alias` 亦然。對於 Codex 帳號，`auto`、`main` 和 `__main__` 為保留字（不區分大小寫），不能設為別名。OAuth 帳號與 API 金鑰的顯示名稱仍遵循原有規則。

選擇既有的 Codex 帳號、OAuth 帳號或 API 金鑰。對於 `openai`，`main` 選擇 Codex App 登入。Codex 池選擇清除親和性並套用於下一個請求，包含來自既有可見任務的請求；帶有工作階段 ID 的請求（包括一般 Codex CLI 和 App 回合及子代理），或錨定到直接父任務的無工作階段請求，其綁定在關閉時最後一次親和性儲存成功的情況下，代理正常重啟後可保留，閒置時間最長為 24 小時。更深層的無工作階段鏈和 Codex App 主要登入的綁定僅保留在記憶體中，重啟後會重新指派；驅逐、帳號刪除、重新登入、崩潰或親和性重置仍可能使任務未綁定，而進行中的請求保留其擷取的帳號。這僅控制池路由；Direct 模式繼續使用呼叫者擁有／原生的 main 憑證。基於用量的主動切換、401/403 重新認證、429/retry-after 冷卻、排除，以及 pre-output 429/402 失敗復原稍後可能選擇另一個合格的池帳號。當基於用量的切換關閉時，這些復原路徑仍然活躍。OpenCodex 在帳號變更後重播對話，但供應商端的 prompt cache 可能是冷的。未知的供應商或 id 離開 1。
在 **401/403** 時，App 登入清除該帳號的行程本地親和性並要求重新認證。
在 **429** 時，opencodex 遵循 `Retry-After`、啟動帳號冷卻、清除親和性，並可能將請求輪換到另一個合格的池帳號。這些失敗轉換在 `autoSwitchThreshold: 0` 時仍然活躍；該設定僅停用基於用量的主動切換。
`--json` 回傳：

```text
{ ok: true, provider, type, activeId }
```

### `ocx account clear <provider> [--json]`

不解析帳號 id 即清除 Codex 帳號的手動選擇，即使存在名為 `auto` 的帳號仍有效。僅適用於 Codex 池；其他提供者類型沒有可還原的自動選擇。

### `ocx account pause|resume <provider> <id|alias|main> [--json]`

由選擇加入的[逐供應商自動暫停政策](/zh-tw/reference/configuration/providers/#遭永久拒絕帳戶的自動暫停)所暫停的帳號使用相同指令。列表會顯示固定的暫停原因；resume 會清除它。

暫停或恢復 Codex、Anthropic、通用 OAuth 或 API-key 供應商池中的單一帳號或金鑰，包括 `google-antigravity`。在 Codex 池中，`main` 僅代表 Codex 內建帳號；OAuth 帳號必須用 id 或唯一別名識別。已暫停的 OAuth 帳號不會參與請求選帳、429 輪替或主動 Token 刷新，也不能手動選取。若暫停目前使用中的帳號，系統會在有其他可用帳號時切換過去。若全部帳號都已暫停，需要該池的請求會回覆 403，直到恢復其中一個帳號。

Anthropic 和通用 OAuth 供應商可用帳號 id，或唯一且完全相符／不區分大小寫的別名識別帳號。JSON 回應會提供帳號 id、暫停狀態與目前 active 帳號 id。

Anthropic 暫停不受帳號池啟用開關影響，包含工作階段綁定與 429 後繼選帳。重新啟動或登入仍保留暫停，憑證與健康狀態不會清除，已送出的請求不會中斷。刪除帳號會一併刪除暫停狀態；個別帳號的自動切換門檻不在此功能範圍內。

Anthropic 的自動暫停後備會保留帳號順序、略過已暫停與需要重新認證的帳號，並排除將於 60 秒內過期的 Claude Code 匯入帳號。沒有記錄來源的舊版帳號仍保持合格，僅使用它們自己儲存的憑證與正常的已儲存 token 重新整理；它們絕不會採用 CLI 磁碟憑證。剩餘時間更長且仍有效的 Claude Code 匯入帳號可被選取。後續的自動重新採用接受共有且非空的 access 或 refresh token。若兩個 token 皆已輪替，OpenCodex 會要求已儲存與已匯入 bearer 兩者都具備經過認證的帳號 UUID 證明。當登入、重新整理或設定檔查詢提供該證明時，它會私下保存；帳號標籤、電子郵件、組織與憑證檔案位置皆不能取代它。

當舊 bearer 已過期且未儲存綁定的帳號證明時，自動復原可能無法進行。無法取得的設定檔或未經檢驗的輪替配對會保留已儲存帳號不變，且不會重播可能已被消耗的 refresh token。請使用明確登入來匯入目前的 Claude Code 憑證。匯入會保留無關的無身分插槽並可能建立獨立帳號；請在檢查過後選取目標帳號並移除過時插槽。設定檔查詢失敗也可能讓新匯入項目處於無身分狀態，並帶有相同的自動復原限制。

若無允許的後備帳號留下，配額與即時模型探索會等待可用的現用帳號。你可以用 `ocx account use anthropic <account-id-or-alias>` 明確選取既有的未暫停舊版帳號；即使未記錄其原始憑證來源，它自己的有效憑證與正常已儲存 token 重新整理仍可使用。

```bash
ocx account pause google-antigravity <account-id-or-alias>
ocx account resume google-antigravity <account-id-or-alias>
ocx account resume anthropic <account-id-or-alias> --if-healthy
```

#### 健康時恢復

無人值守的 supervisor 可以執行 `ocx account resume <provider> <account-id-or-alias> --if-healthy`。只有在對該帳號自己的用量做一次新的讀取成功之後，它才會恢復帳號：Codex 池帳號為 WHAM 配額讀取，Anthropic OAuth 帳號為使用已儲存 token 的用量讀取。由[自動暫停](/zh-tw/reference/configuration/providers/#遭永久拒絕帳戶的自動暫停)記錄為 `oauth_organization_disabled` 或 `account_permission_denied` 的暫停絕不會以此方式恢復。已過期的 Anthropic token 不會為了檢查而刷新：指令回報 `credential_expired`，需重新登入才能回來。其他 OAuth provider 與主 Codex 帳號回報 `health_check_unsupported`；API-key 池會拒絕該旗標。被拒絕的恢復以結束碼 3 結束並印出原因，使用 `--json` 時則印出 `{ "ok": false, "resumed": false, "reason": ... }`。

對已暫停的 OAuth 或 Codex 池帳號明確登入或重新認證，會清除自動暫停記錄的暫停，因為該證據描述的是已被此次登入取代的憑證。手動設定的暫停會持續到 `ocx account resume`。

### `ocx account clear-cooldown <openai|anthropic> <id|alias|main> [--json]`

清除行程本地的失敗冷卻，但不變更已儲存的憑證。Codex 池帳號使用 `openai`，Anthropic OAuth 帳號使用 `anthropic`；其他供應商會被拒絕。兩種形式都接受帳號 id 或唯一別名，而 `main` 僅適用於 Codex 池。

```bash
ocx account clear-cooldown anthropic <id-or-alias>
```

即使沒有作用中的冷卻，命令也會成功，JSON 中的 `cleared` 為 `false`。清除 Anthropic 冷卻也會推進帳號 generation，因此舊的 quota probe 無法恢復已清除狀態或發布過期的配額資格。

若 Anthropic 429 配額冷卻明確列出遭到拒絕的用量視窗，它也會自行解除。對於已啟用的 OAuth 實例，代理會在背景巡檢中重新讀取該帳號的用量（約每分鐘一次，若該視窗仍處於耗盡狀態則退避至每十分鐘一次），只要所有被拒絕的視窗都顯示出餘裕（例如在 Claude 應用程式中度過重設或升級方案之後），就會將帳號放回可選名單。僅帶有 `Retry-After` 而無可視窗重讀的 429 會維持冷卻直到該截止時間為止。兩者皆仍可使用 `clear-cooldown` 手動覆寫。

### `ocx account refresh <provider> [--json]`

對於 Codex 池，請使用 `ocx account refresh openai [--json]`。它強制重新整理帳號配額並印出可用的週／月百分比與重置時間；缺失的配額資料被回報為未知，而非 0%。其 JSON 封裝為 `{ accounts: AccountRow[] }`，每個 Codex 列上有 `quota`。

對於 OAuth 與 API-key 供應商，這會強制重新整理供應商配額報告端點；它不是 token 重新登入或普通的帳號清單重新讀取。`--json` 回傳 `{ provider, report: ProviderQuotaReport | null }`。無支援配額報告的供應商會印出 `no quota report available for <provider>` 並離開 0。未知供應商與管理 API 失敗離開 1；失敗或逾時的上游配額探測會降級為 null 或過時報告（離開 0），與儀表板的配額列一致。

### `ocx account auto-switch <provider> <on|off|status|threshold <0-100>> [--json]`

控制 `openai` Codex 帳戶池閾值，或儲存通用 OAuth 帳戶池閾值。`on` 儲存 80%，`off` 儲存 0%，`threshold <n>` 接受 0–100。通用池的閾值只有在 `pool.kernel` 開啟且 `strategy: "fill-first"` 時才參與選擇；旗標關閉時，儲存閾值不會啟用閾值切換。兩種情況下都不會改變供應商啟用設定或停用 429 錯誤後的輪替。通用池的查詢與修改結果使用伺服器確認值。通用池的 `poolEnabled` 是已儲存的供應商設定，`null` 表示未指定，並不代表繼承後的實際狀態。`inert: true` 表示閾值已儲存但未套用，`inert: false` 表示帳戶池正在套用它。沒有 `inert` 欄位表示能力未知，此時同樣不會回報 `enabled: true`。API 金鑰供應商與無效值會被拒絕。

### `ocx account auto-switch anthropic … --account <id>`

Anthropic OAuth 使用 `ocx account auto-switch anthropic threshold 90 --account <id>` 儲存帳戶專屬整數 0–100。`off --account <id>` 設為 0，`on --account <id>` 設為 80，`inherit --account <id>` 恢復繼承，`status --account <id>` 唯讀查詢；可加 `--json`。帳戶卡片提供相同控制。未設定/null 繼承 `anthropicAccountPool.autoSwitchThreshold`（預設 80）；0 只停用該帳戶依用量切換。設定在重啟和重新登入後保留，刪除帳戶時移除。手動選擇、affinity、未知或全部耗盡時的後備行為與模型路由限制不變。集區停用時不套用門檻；暫停與 429 復原仍有效。

```text
openai: { provider, autoSwitchThreshold: number, enabled: boolean }
generic OAuth: { provider, autoSwitchThreshold: number | null, enabled: boolean, poolEnabled: boolean | null, inert: boolean | null }
```

### `ocx account preserve-signed-in openai [on|off|status] [--apply-to-bound] [--json]`

選擇加入**優先使用其他合格帳號，並將已登入的 ChatGPT／Codex Desktop 身分保留作為備援**。單獨呼叫或加上 `status` 會讀取執行中代理的政策、受影響項目 ID、手動釘選與下一個未繫結選擇。`on` 會持久化 `codexPreserveSignedInAccount: true`；`off` 則還原你既有的自訂帳號順序，不會改寫任何優先權數值。

保留群組包含原生的 `__main__`，以及擁有相同所選 ChatGPT 帳號／工作區**且**正規化成員電子郵件相同的一般池項目。僅共用工作區並不足以歸入。此群組跟隨代理之原生登入生命週期所觀測到的最新實體登入；任何傳入請求憑證都無法定義它。若缺少成員／工作區證據，`identityKnown: false` 會回報目前僅能辨識主帳號。`status` 會取得一次自有的最新觀測；若原生設定檔忙碌或無法讀取，會回傳 503 且不套用變更。

四種 Codex 策略都會優先選擇仍有配額餘裕的其他身分，並在各群組內維持自訂順序。當優先層級耗盡時，保留項目仍會擔任備援。**備援會消耗已登入帳號的配額**，並受限於既有的模型存取、暫停、冷卻、重新認證、硬鎖定與付費點數同意檢查。此政策不會授予付費點數同意權。

健康的既有繫結會留在原地，且手動釘選與精確指定帳號的模型路由優先於此偏好。若要將它套用至進行中的工作，請執行：

```bash
ocx account preserve-signed-in openai on --apply-to-bound
```

這會明確只釋放受影響的繫結與任何受影響的手動釘選，供**下一個請求**重新選帳；進行中的請求仍保有其擷取的帳號。無關的繫結與釘選維持不變。移動工作可能會失去暖 prompt 快取，而限定帳號的上傳檔案或接續狀態可能阻止移動。`codexAccountPriorityFailback` 仍是獨立的選擇加入設定，保有既有的配額策略、正門檻與新觀測條件；它也可以將工作移往優先群組。

若要**絕不透過池使用此身分**，請改用 `ocx account pause openai main`：連動暫停會排除主帳號與相符的池項目，且不更動桌面登入檔案。僅有抵達 OpenCodex 的請求會受控。這不會解鎖已停用的桌面輸入框，也不保證修正用戶端自身的配額閘門。

### `ocx account priority <provider> <account-id|alias|main> [<-100..100|first|earlier|normal|later|last|reset>] [--json]`

讀取或設定某個 Codex pool account 的選擇順序：**數值越高越早使用**，預設為 `0`，範圍是 `-100` 到 `100`。只有 `openai` Codex pool 有順序，其他 provider 會以 exit 1 結束。`main` 指定 Codex Desktop 登入，它與其他 pool account 一樣有順序——`ocx account priority openai main last` 只會調低該項目的順序；若要連同其相符的一般池項目一起保留，請使用上方的 `preserve-signed-in`。

預設字詞代表小整數：`first` 是 `+2`、`earlier` 是 `+1`、`normal` 是 `0`、`later` 是 `-1`、`last` 是 `-2`。`reset` 把帳號回復到預設並刪除其儲存條目。**省略數值時讀取**目前順序，而不是寫入一個。

順序決定哪些帳號優先被考慮，而不是哪些可用：選取仍在合格帳號之間進行，取仍有配額餘裕的最高順序層級，並讓 `accountPoolStrategy` 在該層級內選擇。暫停、冷卻與重新認證不受影響。變更從**下一個未繫結請求**開始生效，而不只是新啟動的 session：一旦較高的順序恢復餘裕，preemption 就會優先移動未繫結的請求。已繫結到某個帳號的執行緒通常會保留到該帳號被耗盡；重新認證失敗或配額冷卻仍可能提前解除繫結。一連串暫時失敗（5xx 與其他非配額失敗達到 `upstreamFailoverThreshold`，預設 3）不再刪除仍有效的執行緒繫結：請求會改由其他帳號處理，繫結保留，該帳號恢復服務後任務會回到原帳號；若 10 分鐘後仍在失敗，繫結才會按常規解除。此保留獨立於 `pool.cacheAffinity`。任何接受的寫入也都會釋放手動「立即使用此帳號」的 pin——無論 pin 在哪個帳號上——包括寫入一個帳號已經持有的順序；這是清除 pin 同時保留目前選取帳號的唯一方式。（透過管理 API 清除 active account 也會釋放 pin，但會一併丟掉該選取。）代理無法連線、未知的帳號 id 或超出接受集合的值會以 exit 1 結束。`--json` 回傳：

```text
{ ok: true, provider, id, priority: number, preset: string | null }
```

### `ocx account login|reauth|code|cancel ...`

從無頭 shell 執行基於瀏覽器或手動 code 的帳號認證。請使用 `ocx account --help` 查看供應商專屬的指令形式。若已儲存 Codex 帳號登入，但其驗證或模型目錄重新整理仍待處理，人類與 JSON 模式皆會以 1 結束。已儲存的登入仍會維持可見；請勿僅因後續作業待處理而重新啟動認證。針對待處理的目錄，人類輸出會在 stderr 印出固定的 `ocx sync` 復原指引。`--json` 讓 stdout 保持可解析並保留待處理旗標，不附加人類可讀的警告。

新增的登入選項依流程而定：

| 流程 | `--open-browser on\|off` | `--add-account on\|off` |
| --- | --- | --- |
| 全新一般供應商 OAuth | 支援具備瀏覽器能力的供應商 | 支援；省略時預設新增帳號 |
| 一般供應商重新認證 | 僅限具備瀏覽器能力的流程 | 拒絕；省略時保留重新認證行為 |
| Codex 瀏覽器登入 | 支援 | 拒絕 |
| Codex 裝置登入、xAI 裝置授權，或原生僅限裝置登入的 `kimi`/`nous`/`github-copilot` | 拒絕 | Codex 拒絕；其他供應商依一般 OAuth 規則 |
| 原生 Kiro `--method` | 拒絕 | 拒絕；此流程僅供新增 |

明確指定 add-account off 允許使用既有的匯入偏好；它不會移除任何帳號。省略時保留先前的 CLI 預設行為。操作者必須親自完成瀏覽器／裝置驗證。請分開保留 `flowId`、帳號 ID 與驗證碼；回傳的裝置授權並不代表瀏覽器已成功啟動。`--no-wait --json` 回報的是交接資訊，而非已完成的登入。請保留 pending、expired、cancelled、validation-pending 與 catalog-pending 狀態；絕不要為操作者靜默重啟流程、擷取憑證或代為完成驗證。

`ocx account login openai --device` 執行 OpenAI 的裝置碼登入，而非瀏覽器回呼。當 proxy 主機沒有瀏覽器，或沒有任何東西能連到它的 `localhost:1455`（例如容器、VPS 或透過 SSH 連線的 hub）時使用它：

```bash
ocx account login openai --device --no-wait --json
# 讀取回傳的 flowId、URL 與 deviceCode；由操作者完成驗證。
```

在任何其他機器上開啟該 URL、輸入短碼，登入就會完成。不加 `--no-wait` 時，指令會輪詢直到完成為止；對於 Codex 池，裝置授權的有效期是 15 分鐘，而不是瀏覽器登入允許的 5 分鐘，因為重點就是要讓你走去另一台裝置操作。

`ocx account login xai --device` 會改用 xAI 的裝置授權，而非其 `127.0.0.1:56121` 回呼。它會印出驗證 URL 與一組短碼供在任一瀏覽器確認，並依供應商間隔輪詢一次，完成時無須貼上任何字串。截止期限取自該授權回應中 xAI 回傳的 `expires_in`，因此應視為由供應商核發而非固定值，上限為 30 分鐘且輪詢頻率不快於每秒一次；逾期的授權會回報失敗而非重試。若 xAI 對輪詢回覆 `429` 或 `5xx`，其 `Retry-After` 會決定該次等待時間而非固定間隔，且仍不超過授權期限。任一裝置請求若收到重導向會立即拒絕而非跟隨，並直接將該登入判為認證失敗，不會當作網路或驗證碼問題重試。`kimi`、`nous` 與 `github-copilot` 會把這個旗標當成 no-op 接受，因為它們唯一的登入方式本來就是裝置流程；沒有裝置授權的供應商會拒絕它。裝置登入沒有可貼上的字串，因此 `--device` 與 `--code` 併用會被拒絕。針對 xAI 裝置登入，`--json` 必須搭配 `--no-wait`：`ocx account login xai --device --no-wait --json` 會回傳一筆包含驗證 URL、短碼與流程 ID 的 JSON 交接資訊。請在瀏覽器完成授權；代理會在背景繼續完成登入。可用 `ocx account cancel xai --flow <flow-id>` 取消該次嘗試；省略 `--flow` 會取消最新一次嘗試。

儀表板並未以此方式暴露供應商的裝置授權。在 add-account 彈窗上，**"Don't open a browser on the proxy machine"** 核取方塊只會停止讓代理啟動瀏覽器：它仍保留該流程原有的 `callback` 模式協定，並由你自行完成回傳的授權 URL。若有支援裝置流程，它是獨立且明確的控制項——Codex 帳號彈窗有 **Device code login** 入口，而原生 Kiro 裝置登入從其專屬面板啟動——絕不會由該核取方塊觸發。儀表板沒有啟動 xAI 裝置授權的控制項，因此請為此使用 `ocx account login xai --device`。

### `ocx account remove <provider> <id|alias|main> --yes [--json]`

此受保護的非互動刪除需要 `--yes`。刪除前，它驗證 id 存在；缺失的 id 離開 1 而不發送 DELETE。主要的 Codex App 登入無法被移除，因此 `remove openai main --yes` 被拒絕。刪除後，家族會再次讀取：移除 pin 的 Codex 帳號會清除 pin 並回到自動選擇；OAuth 提升第一個剩餘帳號或回報無；API-key 池提升第一個剩餘金鑰或回報無。`--json` 成功與失敗結構為：

```text
{ ok: true, provider, id, removedActive: boolean, promotedActiveId: string | null, catalogRefreshPending?: boolean }
{ error: string } // stderr, exit 1
```

`catalogRefreshPending` 僅出現在 Codex 移除操作中。當它是 `true` 時，帳號刪除已經儲存；人類輸出會在 stderr 印出通用的 `ocx sync` 復原指引，並仍離開 0。OAuth 帳號與 API-key 移除的回傳結構不會有這個欄位。

### `ocx account add-key <provider> [--label <label>] [--json]`

為 API-key 供應商新增並啟用金鑰。金鑰僅從非 TTY piped／重新導向的 stdin 讀取；互動式 TTY 輸入、空輸入、OAuth／Codex 供應商與 API 失敗離開 1。金鑰永不回顯，即使它出現在 label 中時亦然。偏好使用密碼管理員或 here-string：

```bash
ocx account add-key openrouter --label personal <<< "$OPENROUTER_API_KEY"
security find-generic-password -w openrouter | ocx account add-key openrouter --json
```

`--json` 回傳 `{ ok: true, id: string | null, label?: string }` 且永不包含金鑰。

### `ocx account reset-credits <id|main> [--consume --yes]`

檢查帳號的 Codex reset credits。消耗 credit 是破壞性的，需要同時提供 `--consume` 與 `--yes`。

確認 `reset` 之後，一次全新的用量讀取可以復原同一個帳號合格的既有共享 reset 衍生冷卻。已暫停的帳號、需要重新認證的帳號，以及被進行中探測擁有的冷卻，都排除在這項復原之外。確認消耗後若用量重新整理失敗或忙碌，不需要再消耗另一個 credit：請重新檢查用量，而不是重複 `--consume`。消耗成功不保證可路由；reset／重播、新鮮度與範圍限制請見[管理 API 復原合約](/zh-tw/reference/management-api/#codex-認證委派)。

### `ocx account grok-reset-coupons [<account-id>] [--consume --yes [--token-id <id>] [--operation-id <uuid>]] [--json]`

檢查或兌換 xAI / Grok 帳號剩餘的 reset coupons。

未加上 `--consume` 呼叫時，回傳可用的 coupon token 與其有效期間：

```bash
ocx account grok-reset-coupons
ocx account grok-reset-coupons acc_xai_01 --json
```

兌換 reset coupon 會改變計費狀態，並永久消耗一個 coupon token。`--consume` 嚴格要求同時提供 `--yes`：

```bash
ocx account grok-reset-coupons --consume --yes
ocx account grok-reset-coupons --consume --yes --token-id <token-id>
```

傳入 `--operation-id <uuid>`（必須是有效的 UUIDv4）可保證結算具備冪等性。當網路中斷或命令重試時，相同的 operation id 會重播已持久化的結果，而不會再消耗一個 coupon。

除非結算碼為 `redeemed`（包含重播的 `redeemed`），否則該指令以非零狀態結束。當結果尚未確認（缺少或無法辨識的結算碼、`attempt_unresolved`、`attempt_in_progress`、`attempt_reconcile_failed`、`operation_state_changed`、`operation_token_mismatch`、`attempt_mark_failed`，或帶有 operation ID 的 `ledger_unavailable`/`capacity`）時，它會印出應保留的 `--operation-id`；請使用同一組 ID 重試，而非另啟新操作。已記錄的拒絕（`auth_failed`、`fetch_resets_failed`、`no_coupons_available`、`coupon_unavailable` 或 `token_unresolved`），例如重播的失敗結果，會印出 `Coupon was not redeemed (<code>)`；其他任何結算碼皆視為未確認。

### `ocx account main <subcommand>`

管理具名的原生 Codex main-login 設定檔，不變更 OpenCodex account-pool 路由：

```text
ocx account main doctor [--json]
ocx account main list [--json]
ocx account main register <label> [--json]
ocx account main add <label>
ocx account main reauth --device [--no-wait] [--json]
ocx account main reauth status --flow <id> [--json]
ocx account main reauth cancel --flow <id> [--json]
ocx account main switch <profile-id-or-label> --yes [--json]
ocx account main recover [--rollback --yes] [--json]
```

空的原生設定檔清單會在人類輸出與 JSON `notes` 中建議 `ocx account main add <label>`；它不會假設已有可用的原生登入。

`ocx account main reauth --device --no-wait --json` 成功時只會向 stdout 輸出一個 JSON 物件，不會輸出供人閱讀的 `follow up:` 提示行。將回傳的 `flowId` 傳給 `ocx account main reauth status --flow <id> --json` 即可查看進度。

每個會變更狀態的命令都會回報執行中代理回傳的 canonical 有效 `CODEX_HOME`。這個路徑可能與呼叫端的 `CODEX_HOME` 不同；支援 JSON 的命令以 `effectiveCodexHome` 暴露同一個值。

Version 1 支援基於檔案的 Codex 認證，以 AES-256-GCM 加密儲存的設定檔，並把加密金鑰放在作業系統的憑證儲存中。`add` 在匯入產生的憑證之前先執行正式的 Codex 登入流程。切換設定檔前請先關閉 Codex；成功的切換會保留本機任務與歷史記錄，然後要求重新啟動 Codex。使用 `doctor` 檢查設定檔狀態，使用 `recover` 完成或復原中斷的轉換。`switch` 接受設定檔 id 或其 label。

`reauth` 用 OpenAI 裝置碼（#3898）重新認證*既有*的原生主要身分，而不是註冊一個新設定檔。這是無頭 hub 的復原路徑：不需要本機 Codex App、`codex` 執行檔或 OS keyring。裝置登入必須為已持有原生主要位置的同一個 ChatGPT 帳號完成；憑證寫入被獨佔宣告與一份路徑／雜湊／inode 快照圍住，而指令輸出只帶有 flow id、驗證 URL、裝置碼與狀態。池登入路徑仍然只限池使用，並持續拒絕 `__main__`；對應的儀表板介面是 Codex Auth 主要卡片的「Re-login with device code」控制項。

v1 復原矩陣涵蓋交易檔已透過 rename 發布後 OpenCodex 程序退出的情況。它不宣稱在 OS 或 kernel 崩潰、突然斷電下仍具持久性：`atomicWriteFileAsync()` 不會 `fsync` 檔案或其父目錄。

加密 vault、切換 journal、復原標記與 journal quarantine 位於 canonical `<real CODEX_HOME>/.opencodex-native-main-profiles` 目錄，因此共享該 Codex home 的每個 OpenCodex 實例只看到一個 owner 與一個復原狀態。明文登入暫存保持隔離在各個 `<OPENCODEX_HOME>/native-main-profile-staging` 目錄下。

在原生 main 流量或 journal 復原被受理前，lifetime owner 取得獨佔的憑證請求，且只清除精確的 `auth.json.ocx.<pid>.<sequence>.tmp` crash 殘留。每個候選都必須是未變更 canonical `CODEX_HOME` 下的單一連結 regular file；它會被截斷、flush 再 unlink。link/reparse 替換、身分變更與其他歧義會讓原生 main 流量保持關閉，而近似名稱的檔案絕不會被自動移除。這保護的是合作的 OpenCodex 崩潰，不是已經以相同 OS 使用者身分執行的惡意程序。該使用者與含有 `CODEX_HOME` 的檔案系統仍被視為可信，且截斷不保證從 copy-on-write 儲存、快照或 SSD 殘留中實體抹除。

Preview 建置使用 `<OPENCODEX_HOME>/native-main-profiles`。該配置絕不會被靜默匯入。如果 `doctor` 回報舊版設定檔狀態，請停止共享相同 `CODEX_HOME` 的每個 OpenCodex proxy。然後把相符的 `*.vault.json`、`*.journal.json`、復原標記與任何被引用的 journal-quarantine 檔案一起備份並移動到 canonical 目錄，同時保留 owner-only 權限；或移除舊 preview 組合並重新執行 `ocx account main register`。在多個舊 root 之間選擇，或在任何共享 proxy 作用中時同時執行兩種配置，都不被允許。在 Windows 上，以舊的大小寫摺疊 home 身分為鍵的 preview 狀態必須重設而不是移動，因為其加密 AAD 與 OS keyring 身分刻意不重複使用。

## 模型

### `ocx models [subcommand]` · `ocx model <subcommand>`

`ocx model` 是 `ocx models` 的別名。無子指令時，列出已儲存及路由器已知的模型 ID，包括 registry 預設、自訂模型和目前 CLI 程序的探索快取。新 CLI 程序的快取可能為空，這不是執行中代理的目錄。部分舊版金鑰預設在變更連線位址後仍可能保留 registry 預設。`--provider` 過濾一個已設定的供應商，而 `--json` 回傳模型中繼資料。`live` 讀取執行中的目錄；`add`、`edit`、`remove` 與 `list-custom` 管理手動目錄項目；`enable`、`disable` 與 `provider` 控制可見性；`selected` 控制供應商允許清單；`context` 控制供應商 context 上限；而 `shadow` 管理背景 shadow-call 攔截。

`reasoningEfforts` 清單僅在使用 `--json` 時顯示。`null` 表示清單未知或未查詢，包括查詢需要開啟系統鑰匙圈的情況。空陣列 `[]` 表示明確設定了空清單，或該模型的推理強度已停用，例如透過 `noReasoningModels` 停用。使用 `ocx models live` 查看執行中代理的目錄。

模型價格為每百萬 token 的美元估計值。`ocx models --json` 包含一個帶有 `cost4` 費率與其來源的 `price` 物件；`ocx models price --json` 會將已儲存的覆寫保留在 `cost` 中，並在 `effectiveCost` 回報解析後的費率。手動價格（包含零）最優先，其次是共享目錄與經驗證的官方價格後備。未知模型回傳 `null`；不會憑空編造價格。自動預設值是在讀取時推導而得，不會寫入設定中的 `modelCosts`，因此目錄更新能持續生效。使用 `set-price` 可儲存供應商專屬費率。

`price --json` 也會在 `cost` 中保留已儲存的 `promptLengthPricing` 政策；四個 `effectiveCost` 費率則是在評估請求提示詞長度或層級之前的基礎費率。請使用 **Models → Price** 或管理 API 編輯提示詞長度政策。既有的 `set-price` 指令會替換四個基礎費率，並保留該模型已儲存的固定（Flat）或自訂（Custom）門檻政策；`--auto` 則會一併移除費率與任何政策。

執行即時操作前請先以 `ocx models --help` 探索指令語法。`list-custom` 讀取本機設定；`add` 與 `remove` 除非加上 `--live` 否則儲存於本機。本機自訂項目的寫入會在存在代理時適機同步。其餘模型管理操作皆使用執行中的代理。在即時呼叫前請檢查就緒與版本狀態；離線檢查無需啟動代理。已探索模型的顯示名稱覆寫擁有專屬指令，與自訂模型的 `edit` 分開。

| 子指令 | 支援的旗標 | 動作 |
| --- | --- | --- |
| `list`（預設） | `--provider <name>`, `--json` | 列出本機已儲存及路由器已知的模型，含估計的輸入／輸出價格。 |
| `live` | `--provider <name>`, `--json` | 讀取執行中的目錄，包含 runtime 探索的模型。列標記為 `native`/`routed`、`custom` 與 `enabled`/`disabled`。 |
| `price <provider/model>` | `--json` | 讀取已儲存的手動覆寫與生效價格，包含自動目錄預設值。 |
| `set-price <provider/model>` | `--input <rate>`, `--output <rate>`, `--cache-read <rate>`, `--cache-write <rate>`, `--auto`, `--json` | 以每百萬 token 的美元設定顯示價格。設定時必須提供 input/output；省略的 cache 費率會變為零。`--auto` 只移除這個模型的覆寫。 |
| `add <provider> <modelId>` | `--display-name <name>`, `--context-window <tokens>`, `--modalities <text,image,audio>`, `--reasoning-efforts <levels>`, `--default-reasoning-effort <level>`, `--live`, `--json` | 在本機註冊自訂模型，或搭配 `--live` 在執行中的代理註冊。 |
| `edit <custom-id>` | `--model-id <id>`, `--display-name <name\|->`, `--context-window <tokens\|0>`, `--modalities <text,image,audio\|->`, `--json` | 編輯自訂模型。`-` 清除欄位；`0` 清除 context window。 |
| `remove <custom-id\|provider/modelId>` | `--yes`, `--live`, `--json` | 在本機或即時目標上刪除自訂模型。即時移除與本機 JSON 移除必須加 `--yes`；本機文字模式保留互動式確認。 |
| `display-name <provider/raw-model-id>` | `--set <text>` 或 `--clear`, `--json` | 設定或清除已探索模型的顯示覆寫；保留原始上游 ID。 |
| `order status` | `--json` | 讀取已儲存的順序／模式、路由候選與已知精選狀態。 |
| `order set` | `--models <CSV>` 或 `--mode <default\|alphabetical\|provider\|most-used>`, `--json` | 設定完整的路由模型排列或套用預設排序模式。 |
| `order reset` | `--json` | 清除已儲存的順序與模式，保留精選選擇。 |
| `list-custom` | `--json` | 顯示所有自訂模型及其 `custom-id`（其他子指令所採用）。 |
| `enable <provider/model\|native-model>` | `--native`, `--json` | 使一個模型對 Codex 可見。 |
| `disable <provider/model\|native-model>` | `--native`, `--json` | 對 Codex 隱藏一個模型。 |
| `provider <name> <on\|off>` | `--json` | 在單次寫入中啟用或停用一個供應商的所有模型。 |
| `selected <provider>` | `--set <id,id...>`, `--clear`, `--json` | 讀取或替換供應商模型允許清單。`--clear` 移除允許清單，使每個模型都被提供。 |
| `preset show` | `--provider <name>`, `--json` | 讀取內附的預設版本與已套用模式，可選填單一供應商。 |
| `preset apply <provider>` | `--all`, `--json` | 套用精選預設；`--all` 會清除允許清單。零符合項目的預設會保留原有選擇並回報 `fallback: "preset-empty"`。 |
| `new-policy [on\|off\|admit]` | `--provider <name>`, `--json` | 讀取或變更最新探索模型的暴露政策；省略供應商則選取全域政策。`admit` 會將新抵達的模型附加至自訂 `selectedModels`。讀取單一供應商時可能回報 `inherit`。 |
| `new-arrivals` | `--json` | 依供應商讀取已記錄的近期新探索模型；不會強制觸發新的上游探索。 |
| `context <status\|value <tokens> [--set-all]\|provider <name> on [--value <tokens>]\|provider <name> off\|all <on\|off>>` | `--json` | 讀取或設定 context-window 上限，全域或依供應商設定。`value <tokens> --set-all` 也會重新指向每個路由供應商（如同儀表板的切換開關）；不加此旗標時，該值只會成為預設值。`provider ... on --value <tokens>` 只為該供應商設定明確上限（`--value` 僅在搭配 `on` 時有效）。 |
| `shadow <status\|set> [model\|-]` | `--enabled <on\|off>`, `--json` | 讀取或設定 Codex 背景 helper 呼叫的替換模型。`-` 清除模型。`status` 亦回報 `sourceModels`，即代理攔截的 helper slug（預設：`gpt-6-luna`、`gpt-5.6-luna`；0.144.x 以前的用戶端使用 `gpt-5.4-mini`，可透過明確的 `sourceModels` 覆寫還原）。 |

```bash
ocx models live --json                                  # Codex 目前實際可見的模型
ocx models disable anthropic/claude-haiku-4             # 隱藏一個路由模型
ocx models enable gpt-5.6-sol                           # 無斜線，因此被視為原生
ocx models provider zenmux off                          # 批量隱藏一個吵雜的供應商
ocx models selected anthropic --set claude-opus-5,claude-fable-5
ocx models selected anthropic --clear                   # 再次卸下允許清單
ocx models add deepseek deepseek-v4 --display-name 'DeepSeek V4' --context-window 128000 --modalities text,image
ocx models list-custom --json                           # 讀取用於 edit/remove 的 custom-id
ocx models remove deepseek/deepseek-v4 --yes
```

帶斜線的模型選擇器為路由（`anthropic/claude-opus-5`）；裸 id 被視為原生 OpenAI 模型，因此 `--native` 僅在需要對一個否則看起來是路由的 id 強制該判讀時才需要。

`--modalities` 僅接受 `text`、`image` 與 `audio`。Codex 將該欄位解析為封閉列舉，並拒絕包含任何其他值的整個目錄，因此 `add`、`edit` 與管理 API 都會拒絕錯誤值，而非儲存目錄寫入器稍後必須剝除的內容（#759）。

### 即時自訂模型與本機儲存結果

請使用已設定的供應商名稱與原始上游模型 ID。針對已授權的即時新增或刪除，先檢查擬定的目標，並在操作後回讀確認：

```bash
ocx ready --json
ocx status --json
ocx models add <provider> <raw-model-id> --live --display-name 'Research model' --context-window 128000 --modalities text --json
ocx models live --json
```

保留回傳的已儲存 `id`。移除時使用 `ocx models remove <complete-stored-id> --live --yes --json`，或該目標上無歧義的 provider/model 選擇器。顯示標籤與 ID 前綴皆不可作為選擇器。沒有本機後備、受修訂版本保護的刪除或替代 ID 重試。`models list-custom --json` 屬於本機清單，並非針對其他目標的即時註冊表讀取。

未加 `--live` 時，add/remove 的 JSON 回傳 `{action, model, needsSync, sync}`。沒有代理時會回傳 `sync: {"status":"not-attempted","ok":false}`、`needsSync: true` 與結束碼 0：代表本機儲存已成功，且未嘗試適機同步。實際嘗試同步失敗或遭拒時會在保留儲存結果的同時以非零碼結束。唯有完整套用的同步才會清除 `needsSync`；因政策略過的成功可能以 0 結束並維持它為 `true`。即使在互動式終端機中，JSON 移除也必須加上 `--yes`。

### 顯示名稱與選擇器身分

```bash
ocx models display-name <provider>/<raw-model-id> --set 'Research model' --json
ocx models live --json
```

此指令會在第一個斜線處分割，並保留原始上游模型 ID 中其餘的每一個斜線。請勿以編碼後的公開選擇器 ID 或別名取代。`--clear` 與 `--set` 互斥並會發送 null。標籤覆寫不會變更定價或公開身分。已辨識為儲存成功但重新整理失敗的結果會回傳 `saved: true` 與結束碼 1；進行下一次寫入前請先檢查狀態。

```bash
ocx models order status --json
ocx models live --json
ocx models order set --models '<complete-public-id-permutation>' --json
ocx models order status --json
```

手動排序使用 `pickerAvailable` 中的公開 ID，每個路由候選模型剛好出現一次，且目前的精選模型必須依其規定的確切領先順序排列。空白、重複、缺漏、未知與歧義項目都會遭到拒絕。CLI 會在執行手動 PUT 前緊接著重新讀取設定與模型身分；狀態若已變更會回傳衝突。這是一項觀測性檢查，而非 CAS，因此事後請務必回讀確認。它絕不會靜默丟棄原生身分或修改精選選擇。

或者也可以選擇 `--mode alphabetical`、`--mode provider` 或 `--mode most-used`。這些預設模式不會前置手動精選前綴。`most-used` 會讀取所有時間、所有介面的用量，保留未排名的候選項目，並在歷史資料不完整時拒絕執行。手動與非預設模式都會拒絕包含裸原生 ID 的已儲存順序。若意在清除該已儲存順序，請先執行 `ocx models order reset --json` 或 `ocx models order set --mode default --json`。遭拒時請勿自動重設。

即時自訂模型與順序寫入皆包含 `catalogRefresh`。唯有已提交且未降級的重新整理會以 0 結束；遭略過、失敗或降級的重新整理會連同已儲存的回執以 1 結束。順序回執中的 `applied` 代表的是精選名單，而非用戶端已收斂。未知結果需要檢查確認，而非假設已回滾。

### 套用預設並驗證選擇

```bash
ocx models preset show --provider anthropic --json
ocx models preset apply anthropic --json
ocx models selected anthropic --json
ocx models new-policy --provider anthropic --json
ocx models new-policy off --provider anthropic --json
ocx models new-policy --provider anthropic --json
ocx models new-arrivals --json
```

這些寫入操作需要變更模型選擇或探索政策的明確意圖。請回讀選擇結果與政策；已儲存的預設後備行為可能讓先前的選擇保持原樣。`preset apply <provider> --all` 是受支援的全模型模式；儀表板中已停用的自訂預設不會增加另一種可選模式。

### 把一個模型標記為純文字

註冊供應商時可使用 `ocx provider add mine --adapter openai-chat --base-url https://example.com/v1 --default-model model-a --text-only`；針對既有供應商則使用 `ocx provider edit mine --model model-a --text-only`。`add` 可以使用 `--model` 或其預設模型；`edit` 則要求提供 `--model`。這個旗標只會把該確切模型的 `modelCapabilities.inputModalities` 更新為 `["text"]`，保留其他模型與軸向不變。

### 已快取的配額歷史

OpenAI 帳號自動耗盡檢查會區分購買的用量點數與重設券。付費消費預設為關閉：請為該帳號啟用 **Use credits**（儲存於 `creditCodexAccountIds`）。唯有同時具備該選擇加入設定，以及新鮮的正數可用餘額或無上限點數，才能讓帳號在內含用量達到 100% 後仍維持合格；上游拒絕或超額上限仍會阻擋該證據。點數證據會在五分鐘後過期，且用量標頭不會更新其計時器。`pause-exhausted` 使用相同規則。單靠重設券絕不會授予自動餘裕，僅含點數的回應也無法清除請求冷卻。預設開啟的主帳號硬鎖定仍是獨立的本機政策，不會因為開啟點數開關而解除。

`ocx account history openai <pool-account-id> [--limit 1-200] [--json]` 在不聯繫供應商的情況下讀取已儲存的觀測值。輸出會區分實際觀測時間、WHAM 或回應標頭來源、窗口家族與用量百分比。每個帳號最多保留 200 筆觀測值，保存 30 天，並有全域儲存上限。

當同一池帳號持續回報兩個不同的七日視窗（例如一個已用 100% 且幾小時後重設，隨後回報已用 24% 且下週重設）時，該帳號列會帶有 `weeklyQuotaConflicts`，包含每個視窗的用量、重設時間、來源與最後觀測時間。`ocx account list openai --quota` 的 `QUOTA` 欄會加上 `(weekly windows conflict)`，而儀表板卡片也會說明所顯示的重設時間未必能恢復完整額度。OpenCodex 不會自行挑選其中一個視窗，也不會因此改變帳號選擇、硬鎖定或點數使用。一旦較早的重設時間過去，警告就會自動清除。

一般的 token 重新整理會保留歷史。重新認證、移除或帳號替換會讓舊的發布記錄退役。原生 main 與在登入發布之前執行的探測不會被包含在內。缺少歷史代表觀測不足，不是零用量。這個指令不會消耗配額。在觀測值支援的情況下，有效估計值帶有下方的限制。

當同一窗口的觀測值與可歸因用量足以支援時，歷史輸出也會包含有效回報 token 估計值。每個估計值都附有樣本數與低信賴度標示。配額捨入、外部用量與假設的 log-label 連續性會限制這項推論；它不是你的供應商 token 額度。缺失或被截斷的帳本證據會回傳證據不足。`--limit` 控制顯示的歷史筆數，不影響有界估計值的輸入。

### `ocx account routes anthropic`

讀取已儲存的 Anthropic OAuth 模型路由、用本機 JSON 陣列取代它們，或清除它們：

```sh
ocx account routes anthropic --json
ocx account routes anthropic --file routes.json
ocx account routes anthropic --clear
```

檔案上限為 64 KiB。伺服器會驗證每條路由，並把它們儲存在 `anthropicAccountPool.routes` 之下；寫入需要正在執行的 proxy。請使用 `ocx account list anthropic --json` 中已儲存的帳號 ID。規則只影響已啟用的帳號池，且絕不聲稱某個帳號有權使用某個模型。請求記錄會把符合的規則標示為 `route:#<n>`（清單中從 1 起算的位置），不含它的操作者名稱。

Vision 與 web-search helper 各自獨立比對自己的模型，當它們的嚴格路由沒有合格帳號時，可能在本機失敗。請見 [Anthropic helper 帳號路由](/zh-tw/reference/configuration/providers/#anthropicaccountpool實驗性)。
