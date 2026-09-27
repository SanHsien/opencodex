---
title: 整合
description: 從儀表板把 opencodex 連接到 OpenCode、Pi、OMP、Hermes、OpenClaw、Kimi Code、gjc、DeepSeek Harness、MiniMax Code、ZCode、Prime Agent、Aside、Raycast、omo 與 Cline CLI——每個客戶端一個開關，每次寫入前都會先備份。
---

**整合（Integrations）** 分頁會把 opencodex 的 provider 區塊寫入客戶端自己的設定檔，也會把它移除。共有十五個客戶端以這種方式運作，每個都有一個開關：

| 客戶端 | 設定檔 | 格式 | 變更生效時機 | 憑證 |
|---|---|---|---|---|
| OpenCode | `~/.config/opencode/opencode.json` | JSON | 下次直接啟動 | `OPENCODEX_OPENCODE_API_KEY` |
| Pi | `~/.pi/agent/models.json` | JSON | 新 sessions | loopback 佔位符 |
| OMP | `~/.omp/agent/models.yml` | YAML | 重新啟動 OMP 後 | `opencodex-loopback` 佔位符 |
| Hermes | `~/.hermes/config.yaml` | YAML | 新 sessions | `OPENCODEX_HERMES_API_KEY` |
| OpenClaw | `~/.openclaw/openclaw.json` | JSON5 | 立即，在執行中的 gateway 上 | `OPENCODEX_OPENCLAW_API_KEY` |
| Kimi Code | `~/.kimi-code/config.toml` | TOML | 重新啟動時，或 `/reload` | loopback 佔位符 |
| gjc | `~/.gjc/agent/models.yml` | YAML | 新 sessions，或當你開啟 `/model` 時 | non-secret loopback placeholder |
| DeepSeek Harness (DSH) | `$DSH_HOME/settings.yaml`（預設 `~/.dsh/settings.yaml`） | YAML | 熱重載 | 非秘密的 loopback bearer 佔位符 |
| MiniMax Code | `~/.minimax/config.yaml` | YAML | 新 sessions，或開啟模型選擇器後 | loopback 佔位符 |
| Prime Agent | `~/.prime/agent/models.json` | JSON | 新 sessions | loopback 佔位符 |
| ZCode | `~/.zcode/v2/config.json` | JSON | 重新啟動時 | loopback 佔位符 |
| Aside | `~/.aside/u/<account>/models.json` | JSON | 完全結束並重新開啟 Aside 後 | loopback 佔位符 |
| Raycast | `~/.config/raycast/ai/providers.yaml` | YAML | 儲存後立即生效——Raycast 會監看該檔案 | 無——僅限 loopback |
| omo | `~/.omo/agent/models.json` | JSON | 新工作階段 | loopback 佔位符 |
| Cline CLI | `~/.cline/data/settings/providers.json` 及同層的 `models.json` | JSON 組 | 結束並重新啟動 Cline 後 | loopback 佔位符 |

產生的目錄只包含每個 provider 選擇中已啟用的模型。這適用於下載檔案，也適用於受管理整合，
包括 Pi 與 Aside。管理端的模型清單仍會顯示完整名單，方便你啟用更多模型。

若要使用 Gajae 內建預設集，請在 `~/.gjc/agent/config.yml` 中保留你的路由選擇：

```yaml
modelProfile:
  proxyProvider: opencodex
  proxyMode: always
```

保留你選擇的 `modelProfile.default`，讓純 `gjc` 啟動時套用它。受管理整合只擁有 `models.yml`
中的 `providers.opencodex`；重新整理或停用該 provider 不會覆寫你的預設集選擇。變更匯出的模型
選擇後，請重新整理該整合。

受管理的 OpenCode 整合擁有兩個片段：`provider.opencodex`（opencode V1）與
`providers.opencodex`（opencode V2）。只有 V2 區塊帶有逐模型的 reasoning-effort 變體，
所以兩者都會寫入並保持同步；它們指名相同的 provider 與 model id，opencode V2 會把它們合併
成一個 provider 項目。Apply、Refresh、Disable 與 Restore 會同時作用於這兩個片段，你的其他
provider、agent、按鍵綁定與 MCP 項目都不會被動到。

受管理 DSH 支援的相容性下限是 **DSH 0.1.0-rc.6**。OpenCodex 只擁有
`llm-pi-ai.providers.opencodex`：Apply 與 Refresh 會取代該片段，Disable 只移除該片段，
Restore 則放回已記錄的快照。DSH 會熱重載 provider 變更。這些操作不會改動使用者的
預設模型，也不會改動原生 `deepseek-official` provider。受管理 DSH 整合目前僅支援
loopback，而且絕不會寫入真實憑證。

MiniMax Code 依序遵循 `MINIMAX_DATA_DIR`、`MAVIS_DATA_DIR`，最後才回退到
`~/.minimax`。其受管理區塊只擁有 `custom_provider.opencodex`，不會變更
`defaultModel`、MiniMax 憑證來源或使用者的 MiniMax 登入。連接後請在 MCode
中選擇 `custom_provider:opencodex/<provider/model>`。重新整理整合也會更新有可靠來源的
逐模型 context window 與 reasoning-effort 選項；未知能力會省略，而 MCode session
目前選取的 effort 不會被覆寫。

Prime Agent 依循 `PRIME_AGENT_CODING_AGENT_DIR`，找不到才回退到 `~/.prime/agent`；
相對路徑會被拒絕，這樣 proxy 與 agent 才不會對「指的是哪個檔案」產生分歧。它的受管理
區塊只擁有 `providers.opencodex`，所以其他 provider 與你自訂的任何 `modelOverrides`
都不會被動到。Prime Agent 在 session 開始時讀取 `models.json`，所以連接後請開啟新
session。

Aside 為每個已註冊的 profile（包括本機 profile）各自維護獨立的模型目錄。OpenCodex 會列出
所有已註冊的 profile（包括本機 profile），可以一起同步，也可以逐一控制單一 profile。切換
整合絕不會變更 Aside 目前使用的帳號。先前的 Aside 連線預設會啟用所有 profile；個別排除
的設定在之後的同步中仍會保留。

Aside 有一個特別注意事項：執行中的應用程式自己會改寫 `models.json`，所以套用後請完全結束
並重新開啟 Aside，就像 Claude Desktop 需要重新啟動一樣。Aside 的區塊僅限 loopback，絕不
會攜帶真實憑證。

受管理的 Raycast 整合支援 **macOS 與 Windows**。Custom Providers 是 **Raycast Pro** 功能：
免費方案下檔案仍會被寫入，但 `ocx integration client status --client raycast` 與整合頁面
會回報警告，因為 Raycast 不會讀取它。在 macOS 或 Windows 上，請先開啟一次 Raycast →
Settings → AI → **Reveal Providers Config**，讓 `ai` 資料夾存在。在這些受支援的平台上，
opencodex 以該資料夾作為安裝訊號，在它存在之前都會回報客戶端尚未安裝。Linux 不受支援，
即使該資料夾存在也一樣。

狀態欄位 `aiDirPresent` 只回報 `~/.config/raycast/ai` 是否存在，與 Raycast 應用程式是否
已安裝或平台是否受支援無關。它不能證明 Raycast 已安裝或可用。CLI 會在獨立一行印出
`plan`，並在 `aiDirPresent` 為 false 時附上 macOS/Windows 的設定指示；`--json` 會保留原始
狀態，包括巢狀的 `raycast` 區塊。Raycast 在 macOS 與 Windows 上同樣讀取
`~/.config/raycast/ai/providers.yaml`，且不遵循 `XDG_CONFIG_HOME`，所以該路徑無法搬移。

受管理區塊是檔案 `providers` 序列中的單一元素 `id: opencodex`：`name: OpenCodex`、
`base_url: http://<host>:<port>/v1`，以及每個路由模型及其 `abilities`——`tools` 與
`system_message` 依匯出慣例設為 `true`，`vision` 依目錄的輸入模態而定，`reasoning_effort` 在模型有 effort
階梯時設定，`temperature` 對推理模型關閉。檔案中的其他 provider 會被保留，停用只移除 OpenCodex
元素。檔案一儲存 Raycast 就會套用變更，不需重新啟動；模型會在 Raycast 的模型選擇器中歸在
**OpenCodex** 群組下。Raycast 支援選填的 `api_keys`，但 OpenCodex 刻意省略該欄位，並拒絕
非 loopback 或需要准入驗證的目標，因為此整合無法提供 OpenCodex 要求的准入標頭。

macOS 私有偏好設定僅是一個提示性的 Pro 狀態提示；Windows 完全不讀取該設定，會回報方案為
未知。方案偵測既不會授權也不會阻擋寫入。匯出中繼資料沒有具權威性的工具支援旗標，所以
`tools: true` 不能證明每個路由模型都支援工具。Vision 與 effort 旗標依循目錄中繼資料；為
effort 階梯關閉 temperature 是保守的匯出行為。其他 provider 的值會保留，但不保證 YAML
格式與註解不變。格式說明見
[manual.raycast.com/ai/custom-providers](https://manual.raycast.com/ai/custom-providers)。

Raycast CLI 匯出與儀表板下載會使用執行中伺服器的目標位址和准入規則，包含已設定的
無驗證 loopback listener。`ocx ensure` 不會以可能與執行中伺服器不同的已儲存設定快照
重新整理 Raycast；伺服器啟動與明確執行的同步仍會更新目錄。

Cursor 有一個分頁，但不是這些開關之一。一般的 Cursor 從自己的後端呼叫自訂端點，所以
loopback proxy 在沒有公開通道的情況下連不到；Cursor 另外的 Private Inference 版本則是在
Cursor 內部設定。**Cursor** 分頁是唯讀的：它會偵測安裝了哪個版本、顯示要貼進 Cursor 的
Base URL 與 API Key，並回報 Cursor 最近一次對 proxy 發出的請求。見
[Cursor Private Inference](/zh-tw/guides/cursor-private-inference/)。

路徑遵循客戶端自己的環境覆寫（environment override）。對 OMP 而言，`OMP_PROFILE` 以存在與否優先於 `PI_PROFILE`，即使明確為空也一樣。具名 profile 會把 `PI_CONFIG_DIR` 當作相對於使用者家目錄的目錄名稱，並忽略 `PI_CODING_AGENT_DIR`；沒有具名 profile 時，`PI_CODING_AGENT_DIR` 勝出。OMP 支援 provider 層級的 headers，但這個最初的整合刻意只支援 loopback；遠端 `x-opencodex-api-key` 的連線設定被延後。搬移過的 `HERMES_HOME`、`KIMI_CODE_HOME` 與 `XDG_CONFIG_HOME` 路徑同樣會被遵循，而非猜測。表格列出每個客戶端的預設值。

對原生 OpenAI 模型，產生的 OMP 區塊會選用其模型層級的 Responses API，保留圖片輸入與 reasoning-effort 控制。路由模型則維持 provider 的 Chat Completions 方言，讓它們既有的 adapters 保持相容。

OpenClaw 有數個環境變數，各自負責不同的工作。`OPENCLAW_CONFIG_PATH` 選擇檔案；`OPENCLAW_STATE_DIR`、`OPENCLAW_PROFILE` 與 `OPENCLAW_HOME` 選擇狀態目錄，而偵測看的也是狀態目錄——所以 profile 或搬移過的家目錄仍會被視為已安裝，而 config 路徑覆寫只移動檔案。如果你還在用舊的 `.clawdbot` 配置，那也會被找到：現代目錄存在時勝出，只有舊目錄存在時才使用舊的。

這些必須是**絕對路徑**或以 `~` 開頭。相對路徑會被拒絕而非解析，因為它會指向各程序恰巧啟動時所在的目錄——而該路徑會與備份一起儲存，所以它明天必須指向與今天相同的檔案。

opencodex 從自己的環境讀取這些變數。如果你的 gateway 以 profile 或搬移過的家目錄執行，請以相同的變數啟動 opencodex，否則它會正確地遵循另一個安裝。

## 其他五個介面不是開關

**API Keys** 管理 opencodex 自己的憑證，根本不是客戶端。**Codex CLI** 由 proxy 服務本身連接——啟動 opencodex 即套用，停止即回復原生路由——所以沒有什麼需要逐檔切換。**Claude** 保留自己的啟用旗標與 Desktop 的 Save/Apply 流程，**Grok Build** 保留其先選後套用的模型圍欄（model fence）。那些語意早於這項功能，且維持不變。**Cursor** 完全不會寫入任何內容：其分頁會顯示偵測結果、gateway 值，以及最近一次看到的請求，其餘則在 Cursor Private Inference 內部進行。

## 回復（Rollback）

每次成功的寫入都會*先*為你的檔案拍快照，所以你原本的狀態永遠可以回復：

- **Undo** 會出現在最新操作上，當你的檔案仍與我們寫入的內容相符時。
- **Restore this point…** 會出現在較舊的操作上，或當檔案在那次操作之後有變更時。跨過這樣的變更做回復會再詢問一次，才覆蓋你的較新編輯——並且也會備份它們，所以那次的回復本身也可以復原。
- 每個客戶端保留十份備份。超過之後，最舊的快照檔案會被移除，其歷史列顯示為 **Backup expired**。

停用只移除 opencodex 記錄為自己寫入的條目。如果你的檔案在我們寫入之後有變更，後續行為取決於我們自己的條目是否完好，以及檔案的格式。對於嚴格 JSON 設定檔（OpenCode、Pi），在我們的區塊**旁邊**進行的編輯——例如新增 MCP 伺服器或你自己的 provider——會顯示為**需要更新**：重新整理會在保留你的條目的前提下合併寫入，但格式可能會被正規化。例外情況是 JSON 無法精確重寫的內容——例如 `1e999` 這類非有限數字、重寫會被四捨五入的數字（極大的整數，或小到會塌縮成零的數字）、`-0`、同一個物件裡重複出現的鍵，或巢狀層數超過 1000 層——此時開關會鎖定，確保沒有任何值被悄悄改動或刪除。**OMP、DSH 與 Hermes** 同樣不受旁邊編輯影響，但原因不同：它們的 writer 只逐位元組修補自己的 `providers.opencodex` 範圍，檔案其餘部分從不會被重寫。至於其餘可以包含註解的格式（OpenClaw、Kimi Code、gjc、MiniMax Code、Raycast——以整份文件寫出的 YAML、JSON5 與 TOML），或當我們自己的條目被編輯過時，開關會鎖定，停用會拒絕執行，而不是猜測哪些編輯是你的。

## Hermes session affinity

產生的 `providers.opencodex` 區塊為所有模型加入 `session_affinity_header: session-id`。
這只是指名一個標頭；實際的動態對話識別碼由 Hermes 提供。OpenCodex 不會寫入共用的靜態識別碼，
也不會改動 `api_mode` 來啟用親和性。

請使用支援[per-provider request options](https://hermes-agent.nousresearch.com/docs/user-guide/configuring-models#per-provider-request-options)
的 Hermes 版本。較舊版本可能會忽略或捨棄該選項；設定本身有效並不能證明 Hermes 真的送出了這個標頭。
對話隔離、compaction lineage 與輔助／子請求都依循 Hermes 自身的親和性語意。此設定不保證特定的快取命中率。

對於既有的受管整合，開啟 **Integrations → Hermes**，檢視 **Apply** 並確認更新。在此之前，
它會顯示為**需要更新**，且隱含的 catalog 重新整理不會變更它，包括其模型清單。單純讀取此頁不會
升級設定。Apply 之後，正常的 catalog 重新整理會恢復並保留此設定；**Replace** 也會包含它。

如果你已經在受管區塊內精確加入 `session_affinity_header: session-id`，只要其他受管設定仍與
所有權記錄相符，Apply 就能接納它。這是上述衝突規則的唯一例外：其他編輯、不同的標頭名稱，
或沒有相符所有權記錄的區塊，仍需要衝突處理。無關的 YAML 設定與註解不受影響，既有的快照與
Restore 流程同樣適用於這次升級。

## 預覽並確認變更

套用、取代、停用與回復現在都會先顯示預覽。對話框會明確列出哪些受管理的設定將會變更，
包括範圍有限的變更路徑，以及每項變更是新增、更新或移除值。請先檢視計畫，再進行確認。

當計畫顯示沒有變更時，表示受管理的用戶端文件已處於要求的狀態。對選取的 Aside 設定檔，
即使受管理的文件沒有變更，確認後仍可能儲存該設定檔的同步偏好。

如果檔案在你檢視後又有變更，寫入會因計畫過期而被拒絕。對話框會用更新後的計畫取代舊
計畫，並要求你再次明確確認；它絕不會自動重試寫入。如果預覽暫時無法使用，請正常重新
載入頁面，再重新開始該操作。

Aside 會對一次選取的單一設定檔使用相同的預覽與確認流程。**同步所有設定檔**仍是獨立的
批次操作，不會綁定到單一合併預覽。

## 誠實的預期

**格式通常不會被保留。** 套用會解析設定並重新寫出，所以 JSON、JSON5 與 TOML 可能被重新格式化，JSON5 或 TOML 中的註解會遺失。OMP、DSH 與 Hermes 是例外：它們的 YAML writer 分別只修補 `providers.opencodex` 與 `llm-pi-ai.providers.opencodex`，逐位元組保留無關的 provider 註解與格式。如果無法安全地識別那個確切的來源範圍，操作會拒絕執行。對其他客戶端，當你需要先前的檔案位元組時請使用 Restore：快照是逐字的副本。

**如果某個值無法忠實重寫，開關會拒絕執行。** 往返覆蓋這些格式在實務上會用到的值種類；當它做不到時——例如使用 `inf` 或 `nan` 的 TOML 檔案，我們可用的 parser 無法準確讀回——套用會停止並說明，而不是寫入被改動的值然後宣稱成功。你會看到檔案被指名，磁碟上沒有任何東西被移動。手動編輯那個檔案仍然有效；只有我們的自動重寫會拒絕。

TOML 日期與時間值也會阻止受管理的重寫：合併步驟會將這些帶有型別的值轉成加引號的字串，這也包括陣列與行內表格中的值。原本就加引號的日期字串仍受支援；若要保留不加引號的日期型別，請手動編輯設定。

**Pi、Kimi Code、gjc、MiniMax Code、Prime Agent、Aside、Raycast、omo 與受管理 DSH 整合只能對 loopback bind 運作。** 前四者的設定沒有非 loopback bind 所需的 `x-opencodex-api-key` header 欄位。DSH 雖然提供通用 headers map，但 rc.6 並未把這個專用准入 header 記錄為受支援的整合契約，因此受管理 writer 會選擇安全拒絕，而不自行猜測。Prime Agent 的 provider 區塊確實接受 headers，但遠端憑證連線設定在最初的整合中被延後。請改用 SSH tunnel，或由本機 forwarder 加上該 header 後再以 loopback 存取。

**產生的 OMP 整合也刻意只支援 loopback。** OMP 確實支援 provider 層級的 headers，但這個最初的整合不會發出遠端 `x-opencodex-api-key` 憑證連線。手動的遠端 OMP 設定目前不在受管理的整合範圍內。

**Kimi Code 無法持有環境變數參考，** 所以它的設定攜帶的是 `opencodex-loopback` 佔位符而非金鑰。絕不會有任何真實憑證被寫入任何客戶端設定。

**對 `ocx opencode` 而言，launcher 的 provider 區塊勝出。** 那個 launcher 透過 `OPENCODE_CONFIG_CONTENT` 注入 `provider.opencodex` 與 `providers.opencodex`，比磁碟上相同的條目優先——你其餘的 opencode 設定仍照常套用。當你直接啟動 `opencode` 時，這裡的開關才是關鍵。

## 從終端機

相同的操作可以無頭模式使用：

```bash
ocx integration client status
ocx integration client enable --client hermes
ocx integration client disable --client hermes
ocx integration client history --client hermes
ocx integration client restore --op <opId> [--confirm-drift]
```

`--overwrite-conflict` 是 **Replace** 的終端形式：

```bash
ocx integration client enable --client zcode --overwrite-conflict
```

和 `--confirm-drift` 一樣，它永遠不會被預設：沒有這個旗標，衝突仍然會被拒絕。
它只適用於 `enable`；對衝突強制 *disable* 會刪除我們從未寫入的區塊，因此這個組合會被拒絕。

MiniMax Code 先連接一次 provider，再透過會檢查設定的 launcher 啟動：

```bash
ocx integration client enable --client mcode
ocx mcode
```

完成一次連接後，`ocx sync` 與 `POST /api/sync` 會依目前的模型選擇、context window 與
reasoning-effort 階梯，更新 OpenCodex 已擁有的 MCode、Pi、Aside、Raycast 與 omo 目錄。
proxy 啟動時也會更新已擁有的 Raycast 目錄。模型可見性、provider 選擇或 preset 的變更同樣
會更新已連接的 Pi、Aside、Raycast 與 omo 目錄。已刪除、遭外部編輯或不安全的區塊會維持
原狀不動，你手動移除的先前受管理區塊也一樣。已啟用的 Aside profile 是「僅更新已擁有區塊」
這條一般規則的例外：如果它的帳號目錄存在，且從未有過受管理區塊，那麼在該欄位空著時，
sync 可能會建立它的第一個區塊。先前的 Aside 連線預設會為所有已註冊的 profile 啟用這個行為。
Sync 不會建立遺失的帳號目錄，也不會取代手動建立的區塊。被拒絕或重疊的重新整理會為每個
客戶端分別回報。請啟動新的 Pi session，或完全結束並重新開啟 Aside，以載入更新後的檔案。
Aside 的重新整理需要[相容的執行中 proxy](#aside-profile-controls)。

如果「模型」頁回報 **Model selection saved** 並同時附上客戶端重新整理的警告，代表選擇
本身已經儲存成功；只是一個或多個客戶端檔案未能更新。警告會指名受影響的客戶端與（如適用）
Aside profile，並說明拒絕的原因。請開啟**整合**頁檢查該客戶端或 profile，再開始新的
session。解決回報的問題後重試 `ocx sync`；重疊中的操作必須先結束。如果警告內含備份路徑，
或說明復原尚未完成，請在重試之前先檢查那個復原狀態。選擇儲存成功本身並不能證明客戶端檔案
已經復原。

另一個 MiniMax 平台 CLI（`mmx`）不是檔案開關整合。其文字命令使用 MiniMax 的
Anthropic 相容端點，因此 OpenCodex 提供憑證隔離、僅限 loopback 的 launcher：

```bash
ocx mmx text chat --model anthropic/claude-opus-5 --message "Hello"
ocx mmx text repl --model openai/gpt-5.6-sol
```

只有 `mmx text chat` 與 `mmx text repl` 會經過 proxy。要使用 MiniMax 原生的圖像、影片、
語音、音樂、視覺、搜尋、配額、驗證、設定、檔案與更新指令，請直接執行 `mmx`。wrapper 使用
只含非機密 loopback 佔位符的暫存設定；它絕不會讀取你的 `~/.mmx` OAuth 或 API key 憑證，
並拒絕 `--api-key`、`--base-url` 與 `--region` 覆寫。完整工作流程與限制見
[MiniMax clients](/zh-tw/guides/minimax/)。

`--confirm-drift` 永遠不會被擅自假設。如果檔案在你正要回復的操作之後有變更，指令會拒絕並告訴你，因為覆蓋你較新的編輯是你的決定。

客戶端細節是針對各專案自己的設定格式驗證過的；檢查了什麼、何時檢查，請見 `devlog/_fin/260802_client_toggle_api/002_client_toggle_matrix.md` 中的研究筆記。

## ZCode 3.14 以後

ZCode 3.14 把自訂供應商移到 `~/.zcode/v2/provider_config.json`，而本整合原本寫入的
`~/.zcode/v2/config.json` 只剩下一次性匯入會讀取，而那次匯入只在新檔案不存在時執行。ZCode 首次啟動
就會建立新檔案，因此只要曾經啟動過的安裝，匯入早已用掉，之後寫入 `config.json` 不會被任何東西讀到。

在可行的情況下，opencodex 現在直接寫入 `provider_config.json`。啟用整合會把 `opencodex` 供應商規則
加進該檔案，目錄重新整理會更新它，停用則精確移除 opencodex 放進去的內容。檔案中其他規則一律保持原樣，
包含其他供應商為某個同樣出現在我們這裡的模型 ID 所保留的規則。帶有 `opencodex` ID 但不是 opencodex
寫入的規則屬於衝突，而不是可以接管的東西：請在 ZCode 中處理，或使用明確的覆寫。

仍有兩種情況會拒絕而不寫入。ZCode 搬移儲存位置之前由 opencodex 寫入的區塊，會讓整合留在
`config.json`：請先在那裡停用，再重新啟用以寫入新的儲存檔。至於 `schemaVersion` 不是 opencodex
曾觀察過的 `provider_config.json`，則只會被回報而不會合併：該檔案存放 ZCode 的所有供應商，對它斷言
一種結構等於把靜默的無效果換成靜默的資料遺失。只要整合不是在寫那個檔案，狀態頁就會指出 ZCode 實際
讀取的檔案。

在第二種情況下，請在 ZCode 自己的設定中新增供應商：base URL 為 `http://127.0.0.1:10100/v1`
（請依實際繫結調整連接埠）、任意非空白金鑰，以及 `ocx export --client zcode` 列出的模型 ID。不支援
刪除 `provider_config.json` 來重新觸發 ZCode 的匯入：那會丟掉 ZCode 存放在其中的所有供應商。

## Aside profile controls

Aside profile controls，以及 `ocx sync` 執行的 Aside 重新整理，都需要一個支援 Aside
profile API、且正在執行的 ocx proxy。只更新 CLI 本身，並不會更新一個已經在執行的 proxy。
如果 proxy 無法使用或版本太舊，Aside 的操作就無法完成；CLI 絕不會退回到在本機直接寫入
Aside profile 檔案。

請升級 proxy 所使用的 ocx 安裝，然後重新啟動 proxy（若已停止則啟動它）。接著重試
`ocx sync` 或 profile 指令。profile 檔案成功更新後，請完全結束並重新開啟 Aside，讓它
載入新的目錄。

```bash
ocx integration client status --client aside --json
ocx integration client enable --client aside
ocx integration client disable --client aside --profile 1
ocx integration client history --client aside --profile 1
ocx integration client restore --client aside --profile 1 --op <opId>
```

profile 編號就是 status 指令顯示的帳號 ID。在 Aside 開關上省略 `--profile` 會把目標狀態
套用到每個已註冊的 profile。單一 profile 的變更不會影響其他 profile。期望的同步設定會在
檔案變更之前先儲存；每個 profile 的實際狀態與任何拒絕都會分別回報。部分成功的批次結果
不算全部套用成功，CLI 會以非零狀態結束。Undo 會同時還原所選 profile 的同步意圖與其檔案，
所以之後的一次 sync 不會悄悄推翻這次 Undo。

[profile API](/zh-tw/reference/management-api/#aside-profile-controls) 在批次操作全部成功時回傳
HTTP 200；只要有任一 profile 被拒絕，就回傳 HTTP 207 並附上 `ok: false`。請檢查 `results`
中的每一筆項目：另一個 profile 失敗時，已成功的 profile 不會被回滾。期望的設定仍會保留，
所以請在處理好受影響的 profile 後重試，而不要假設整個變更都失敗了。如果連儲存這些設定都
失敗，就不會有任何 profile 檔案被變更。

每個 profile 都有各自獨立的擁有權與歷史紀錄。既有的使用者編輯、不安全的路徑與連結的目錄
都會被拒絕；既有的明確覆寫與 drift 確認控制項仍然可用。請完全結束並重新開啟 Aside 以載入
變更後的模型檔案。

## Cline CLI

這項整合的目標是 Cline 目前的 CLI／共用 SDK provider 儲存區，其原生結構版本為 `version: 1`。
舊版 VS Code 擴充功能的 `globalState`／secret 儲存不會被這項整合遷移或偵測到。請先執行一次
Cline，以初始化它的設定目錄。

**在啟用、同步、停用或復原這項整合之前，請先結束 Cline。** OpenCodex 會把 `providers.opencodex`
寫進 `providers.json` 與同層的 `models.json` 這兩個檔案。第一個檔案存放帶有非機密 loopback
佔位符的 OpenAI Responses 連線；第二個檔案存放經過篩選的路由模型目錄，包括可用的 context
與圖像中繼資料。既有的 provider 項目與預設 provider 選擇都不會被變更。

```bash
ocx integration client list --json
ocx integration client enable --client cline
ocx integration client history --client cline
ocx integration client restore --op <operation-id>
```

啟用後，請重新啟動 Cline 並選擇 OpenCodex，或以
`cline --provider opencodex --model <provider/model>` 啟動。外部目錄變更只有在 Cline
重新啟動時才會被讀取。Cline 不在無人值守目錄重新整理的範圍內；變更路由模型選擇後，請先
結束 Cline，再執行 `ocx sync` 或重新啟用這項整合以更新它。已選擇的模型只要仍在路由範圍內
就會保留，若從匯出的目錄中被移除則會被清除。

`CLINE_PROVIDER_SETTINGS_PATH` 會覆寫主檔案。否則依序由 `CLINE_DATA_DIR` 選擇資料目錄，
再由 `CLINE_DIR` 選擇根目錄，最後才使用 `~/.cline`。模型檔案永遠是與所選 provider 檔案
同層的 `models.json`。覆寫值必須是絕對路徑或以 `~` 開頭。啟動 OpenCodex 時，請讓
`CLINE_PROVIDER_SETTINGS_PATH` 對應 Cline 指令列本身的 `--config` 路徑。若主檔案路徑被
指名為 `models.json` 會被拒絕，因為兩個檔案必須是不同的檔案。

每個檔案的替換都是原子性的，但沒有任何檔案系統操作能同時替換兩個檔案。一次日誌操作會為
兩個原始檔案拍快照；寫入或簿記失敗都會讓兩者一起補償復原。被中斷的操作會保留一份私有的
復原紀錄。狀態回報會把未完成的復原視為不安全，只有在檔案本身與其擁有權都沒有無關編輯時，
下一次明確的變更操作才會執行復原。如果復原被拒絕，請保留檔案與操作回報的復原路徑；解決
衝突後再重試。

Undo 會還原**兩個檔案原本的位元組字串**，包括原本就不存在的檔案。操作之後的編輯需要既有的
明確 `--confirm-drift`；被編輯過的這一對檔案會先被備份。已被佔用的 OpenCodex 項目需要既有的
`--overwrite-conflict` 選擇性加入。Disable 只移除這兩個受管理的項目；它不會還原先前的外部
項目——那要用 Undo。快照的保留與過期規則與其他整合相同。

下載檔 `cline-config-bundle.json` 內含兩個原生文件成員：`settings` 對應 `providers.json`，
`catalog` 對應 `models.json`。它本身不是一個 Cline 設定檔。建議優先使用整合指令，以取得
有日誌記錄的合併與回復能力。這個產生出來的整合不支援遠端准入連線；它需要無驗證的
loopback 存取。
</content>

## GitHub Copilot App

GitHub Copilot 桌面應用程式可以把 opencodex 當作相容 OpenAI 的模型供應商。這是手動的客戶端
設定，沒有 Integrations 分頁開關，且與使用 Copilot 訂閱作為 opencodex 後端的上游
`github-copilot` provider 是不同的東西。

1. 啟動 opencodex 並確認它有回應：

   ```bash
   curl http://127.0.0.1:10100/healthz
   curl http://127.0.0.1:10100/v1/models
   ```

2. 在 Copilot app 中開啟 **Settings → Model providers → Add provider**，填入：

   | 欄位 | 值 |
   |---|---|
   | Name | 任意標籤，例如 `OpenCodex` |
   | Base URL | `http://127.0.0.1:10100/v1`（依實際繫結調整連接埠） |
   | API key | 在 loopback 上留白 |

3. 從端點同步模型，或依 `provider/model` id 手動新增一個，然後選取它。

此應用程式使用 `GET /v1/models` 進行探索、`POST /v1/chat/completions` 進行對話。這些對話會
經過 opencodex 一般的模型路由，因此 provider 憑證、OAuth 帳號與 combo 都會照常套用。可接受
的請求欄位列於[代理格式參考](/zh-tw/reference/proxy-formats/)。

如果應用程式回報沒有模型，請確認 base URL 結尾是 `/v1` 而不是 `/v1/chat/completions`，並確認
`/v1/models` 回傳的 `data` 陣列非空。當 opencodex 監聽非 loopback 位址時，請在應用程式的
API key 欄位填入資料准入金鑰（見[遠端存取](/zh-tw/reference/configuration/server/#遠端存取)
所述的 token，或儀表板產生的 `ocx_…` 金鑰）。應用程式會以 `Authorization: Bearer` 送出，
`/v1/chat/completions` 會將其視為代理准入，絕不會轉發給上游；請見
[認證矩陣](/zh-tw/reference/proxy-formats/#認證矩陣)。
