---
title: 整合
description: 從儀表板把 opencodex 連接到 OpenCode、Pi、OMP、Hermes、OpenClaw、Kimi Code、gjc、DeepSeek Harness、MiniMax Code、ZCode、Prime Agent、Aside、Raycast、omo、Cline CLI、Kilo、Command Code 與 Factory Droid——每個客戶端一個開關，每次寫入前都會先備份。
---

**連線** 分頁會把 opencodex 的 provider 區塊寫入客戶端自己的設定檔，也會把它移除。共有十八個客戶端以這種方式運作，每個都有一個開關：

在 Windows 上，要求絕對路徑的覆寫值必須包含磁碟機代號（`C:\Users\me\client`）或 UNC 共用（`\\server\share\client`）。`\Users\me\client` 和 `/client/config` 依賴目前的磁碟機，因此會被拒絕。明確支援 `~` 的選擇器仍以有效家目錄展開；Gentle Shell 不展開 `~`。

| 客戶端 | 設定檔 | 格式 | 變更生效時機 | 憑證 |
|---|---|---|---|---|
| OpenCode | `~/.config/opencode/opencode.json` | JSON | 下次直接啟動 | `OPENCODEX_OPENCODE_API_KEY` |
| Pi | `~/.pi/agent/models.json` | JSON | 新 sessions | loopback 佔位符 |
| OMP | `~/.omp/agent/models.yml` | YAML | 重新啟動 OMP 後 | `opencodex-loopback` 佔位符 |
| Hermes | `~/.hermes/config.yaml` | YAML | 新 sessions | `OPENCODEX_HERMES_API_KEY` |
| OpenClaw | `~/.openclaw/openclaw.json` | JSON5 | 立即，在執行中的 gateway 上 | `OPENCODEX_OPENCLAW_API_KEY` |
| Kimi Code | `~/.kimi-code/config.toml` | TOML | 重新啟動時，或 `/reload` | loopback 佔位符 |
| gjc | `~/.gjc/agent/models.yml` | YAML | 新 sessions，或當你開啟 `/model` 時 | non-secret loopback placeholder |
| DeepSeek Harness (DSH) | `$DSH_HOME/profiles/desktop/cordis.patch.yml`（預設 `~/.dsh/profiles/desktop/cordis.patch.yml`）；DSH Desktop 建立該 profile 之前為 `$DSH_HOME/settings.yaml` | YAML | 熱重載 | 非秘密的 loopback bearer 佔位符 |
| MiniMax Code | `~/.minimax/config.yaml` | YAML | 新 sessions，或開啟模型選擇器後 | loopback 佔位符 |
| Prime Agent | `~/.prime/agent/models.json` | JSON | 新 sessions | loopback 佔位符 |
| ZCode | `~/.zcode/v2/provider_config.json` (schemaVersion 1)；舊版備援路徑：`~/.zcode/v2/config.json` | JSON | 重新啟動時 | loopback 佔位符 |
| Aside | `~/.aside/u/<account>/models.json` | JSON | 完全結束並重新開啟 Aside 後 | loopback 佔位符 |
| Raycast | `~/.config/raycast/ai/providers.yaml` | YAML | 儲存後立即生效——Raycast 會監看該檔案 | 無——僅限 loopback |
| omo | `~/.omo/agent/models.json` | JSON | 新工作階段 | loopback 佔位符 |
| Cline CLI | `~/.cline/data/settings/providers.json` 及同層的 `models.json` | JSON 組 | 結束並重新啟動 Cline 後 | loopback 佔位符 |
| Kilo | `~/.config/kilo` 下最先存在的 `kilo.jsonc`、`kilo.json`、`opencode.jsonc`、`opencode.json` 或 `config.json`（`XDG_CONFIG_HOME` 會移動該目錄；若都不存在則建立 `kilo.jsonc`） | JSONC | 新工作階段 | `OPENCODEX_KILO_API_KEY` |
| Command Code | `~/.commandcode/providers.json` (Windows 使用預設家目錄時：僅當 `HOME ?? USERPROFILE` 的值非空、非純空白且為 Windows 絕對路徑時使用，否則使用 `homedir()`；另行傳入的家目錄保持不變；檔案位於其下的 `.commandcode\providers.json`) | JSON | 下次啟動 Command Code 時 | 無 — 無金鑰迴環 (`apiKey: false`)；桌面應用程式需要自行登入，opencodex 絕不寫入 `auth.json` |
| Factory Droid | `~/.factory/settings.json` (`%USERPROFILE%\.factory\settings.json` Windows 上) | JSON | 檔案變更時立即生效 | 無金鑰迴環 |

產生的目錄只包含每個 provider 選擇中已啟用的模型。這適用於下載檔案，也適用於受管理整合，
包括 Pi 與 Aside。管理端的模型清單仍會顯示完整名單，方便你啟用更多模型。

受管理的 OpenCode 整合擁有兩個片段：`provider.opencodex`（opencode V1）與
`providers.opencodex`（opencode V2）。只有 V2 區塊帶有逐模型的 reasoning-effort 變體，
所以兩者都會寫入並保持同步；它們指名相同的 provider 與 model id，opencode V2 會把它們合併
成一個 provider 項目。Apply、Refresh、Disable 與 Restore 會同時作用於這兩個片段，你的其他
provider、agent、按鍵綁定與 MCP 項目都不會被動到。

具有受支援推理強度階梯的 GJC 模型會匯出 `reasoning: true`、`thinking.levels` 與 `compat.supportsReasoningEffort`，讓 GJC 提供強度選擇。原生 Codex 模型即使未在目錄中列出階梯，也會取得標準階梯。沒有已知階梯的模型會省略這些欄位；`none` 不傳送強度，`ultra` 在傳輸時會折疊成 `max`，因此不會列為選項。重新整理整合即可更新模型選項。

受管理 DSH 支援的相容性下限是 **DSH 0.1.0-rc.6**。DSH 0.1.7 及以上版本從
`$DSH_HOME/profiles/desktop/cordis.patch.yml` 中的 `[id=llm-pi-ai].config.providers.opencodex` 列讀取 provider 路由。
Desktop profile 與補丁都存在時，OpenCodex 只寫入該列。若 `$DSH_HOME/profiles/desktop/package.json` 存在但缺少 `cordis.patch.yml`，Apply 會拒絕執行：請建立內容為 `[]` 的 `cordis.patch.yml`（DSH 為新 profile 寫入的空補丁），然後重新啟用整合；僅在沒有 Desktop profile 時，才使用
`$DSH_HOME/settings.yaml` 中的 `llm-pi-ai.providers.opencodex`：Apply 與 Refresh 會取代該片段，Disable 只移除該片段，
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

### Qoder CN and WorkBuddy editions

In **Connect**, enable **Qoder CN**, **WorkBuddy (CN)** or **WorkBuddy AI**, then choose
an OpenCodex model in the client's custom-model picker. The proxy must stay running.
The first enable saves a snapshot; disable removes only the generated contribution,
and Undo restores the snapshot. Existing models and unrelated settings remain intact.
These are separate connections from Global Qoder and from each other.

The same operations are available through the CLI (replace `workbuddy` with
`workbuddy-ai` or `qoder-cn` for the other editions):

```bash
ocx integration client enable --client workbuddy
ocx export --client workbuddy --json
ocx integration client disable --client workbuddy
```

Qoder CN honors `QODERCN_CONFIG_DIR`. Both WorkBuddy editions honor their native
`WORKBUDDY_CONFIG_DIR`, then `CODEBUDDY_CONFIG_DIR`; unset overrides keep the regional
roots in the table. Overrides must be absolute, `~`, or start with `~/` or `~\`. WorkBuddy's legacy
array configuration and its object-form `models` list are both supported. If an existing
`availableModels` restriction excludes OpenCodex models, remove that restriction in
WorkBuddy before enabling. Project-level settings can override user-level models.

Connections require an unauthenticated loopback listener; no upstream credentials are
copied into these clients. WorkBuddy receives the full Chat Completions URL and the
capabilities declared by the OpenCodex catalog. Restart the client or start a new session
if its model picker has not reloaded yet. Configuration/lifecycle tests do not establish
end-to-end compatibility with every upstream model or every client release.

Doubao Desktop and Devin currently have no verified arbitrary-provider configuration
contract in this integration. They have no enable switch; adding a local JSON file alone
would not make their model pickers consume it.

Qoder IDE / qodercli supports export and managed configuration through the Dashboard and CLI:

```bash
ocx export --client qoder --json
ocx integration client enable --client qoder
ocx integration client disable --client qoder
```

Qoder uses `settings.json` in `QODER_CONFIG_DIR` when that variable is set, and
`~/.qoder/settings.json` otherwise; a relative `QODER_CONFIG_DIR` is refused. Enable merges only `providers.opencodex`, preserving other providers, custom models,
and settings. Models appear once in the provider catalog; duplicating them in
`modelConfigs.customModels` causes Qoder to reject the provider. Refreshing an older managed
integration removes its recorded duplicate rows; user-edited rows remain conflicts. Disable removes the recorded OpenCodex entries; restore uses the existing
snapshot workflow. The provider's default model is the first model in the sorted export.
If `modelConfigs.customModels` already holds an `opencodex` row for an exported model that
OpenCodex did not write, enable, refresh, overwrite and disable report a conflict and leave the
file unchanged; remove or rename that row in Qoder's settings, then try again. Rows for other
providers or for models outside the export are left alone.
Provider models use their catalog `contextWindow`, falling back to 128000 input tokens.
Restart Qoder after refreshing an existing integration to reload the provider registry.
The generated API key is a non-secret placeholder: Qoder integration requires loopback
access and refuses an authenticated non-loopback bind. When the dedicated unauthenticated
loopback listener is enabled, exports point Qoder at that listener. `ocx sync` and catalog
changes refresh an already enabled Qoder integration like the other managed clients.
Model IDs containing `,` or `]` (for example `kimi/k3[1m]`) are exported like any other model.

## Gentle Shell

選擇 **Connect → Gentle Shell**，或使用同樣的受管整合指令：

```bash
ocx export --client gentle-shell --json
ocx integration client enable --client gentle-shell
ocx integration client disable --client gentle-shell
```

Gentle Shell 的目的地與回復歷史與 Pi 分開。只有 `providers.opencodex` 受管；其他供應商與偏好維持不變。
目錄變更會重新整理已連線且未變動的區塊。既有、手動複製的區塊屬於衝突，而不是允許覆寫：
請檢視預覽，只有在你確實要取代它時才使用明確的覆寫確認。

`~/.gentle-shell/config.json` 中儲存的 `home` 決定目的地。已儲存的自訂路徑優先；隔離／預設模式使用
`GENTLE_SHELL_HOME` 或 `~/.gentle-shell/agent`。`GENTLE_SHELL_CONFIG` 選擇另一份啟動器設定。
這些環境變數必須設定在 **OpenCodex 處理程序**上，而不是只設在之後的 shell。選擇器必須是絕對路徑；
字面的 `~` 與相對路徑會被拒絕。一次性的 `gentle-shell --home` 旗標無法被背景代理發現。

連結模式，或與 Pi 共用同一個 home 的別名，會被拒絕並附上 Pi 整合的補救方式；請改用 **Connect → Pi** 處理該共用檔案。
OpenCodex 不會變更啟動器偏好。無法讀取或不安全的啟動器設定會被拒絕；格式錯誤的 JSON 會退回隔離模式，與啟動器一致。
若你移動了已連線的 home，請先用原本的選擇器停用它，再連線新的 home。目錄更新之後請重新啟動 Gentle Shell。
此整合沿用 Pi 僅限迴路的匯出策略，且不儲存任何真實的 API 金鑰。

「omo」指的是共用 `~/.omo` 資料夾的三個產品。**omo** 分頁管理以 Pi 為基礎的 omo（senpi 引擎），
經由 `~/.omo/agent/models.json`，如上表所示。以 Codex 為基礎的 omo（LazyCodex）在同一分頁有自己的區段，
只在偵測到 LazyCodex 時才顯示，說明見 [omo（Codex／LazyCodex）角色模型](#omocodex--lazycodex角色模型)。
以 OpenCode 為基礎的 omo（oh-my-opencode）把自己的設定留在 OpenCode 之下；opencodex 不讀取也不寫入它。

受管的 Pi 型 omo 區塊預設使用 Chat 方言（`api: "openai-completions"`）。Chat 會在跨工具呼叫時丟棄上一步的推理，
這是 omo 的長工具迴圈會注意到的。若要讓啟用與每次重新整理都改寫成 Responses 方言，請在你的 opencodex 設定中設定這個僅限設定檔的鍵：

```json
{ "omoClientExport": { "api": "openai-responses" } }
```

請重新啟動代理以載入編輯後的設定（服務安裝用 `ocx service restart`，或先 `ocx stop` 再 `ocx start`），
然後在儀表板的 **Connect → omo** 重新整理 omo 整合。單獨重新整理使用的是執行中代理的設定，不會重新載入設定檔。

此設定只適用於 omo；Pi、Gentle Shell 與其他 Pi 格式的用戶端維持 `openai-completions`。
要回到 Chat，請移除該鍵、以同樣方式重新啟動代理，再重新整理 **Connect → omo**。未知的值會被忽略。
opencodex 仍只擁有 `~/.omo/agent/models.json` 中的 `providers.opencodex`，該檔案中的其他供應商維持原狀。

## T3 Code

[T3 Code](https://github.com/pingdotgg/t3code) 驅動機器上已安裝的 Codex 與 Claude Code CLI。
啟用 [Codex 整合](/zh-tw/guides/codex-integration/)後，它的 Codex 對話串會經由 opencodex 路由，
因為 T3 Code 透過 `codex app-server` 列出 Codex 模型，而它和所有 Codex 用戶端一樣讀取 `$CODEX_HOME/config.toml`。
只要 T3 Code 執行 Codex 時使用 opencodex 所管理的同一個 Codex home（`CODEX_HOME`，預設 `~/.codex`），
路由模型就會出現在 Codex 底下，不需要任何 T3 Code 開關。指向其他 home 的 T3 Code Codex 實例看不到路由目錄。

**T3 Code** 開關加入 Claude 這一側。它需要 Messages API（每個 Claude 回合都會用到）：
API 頁面上的 Messages 關閉時，啟用與重新整理會被拒絕，停用仍可運作。

```bash
ocx export --client t3code --json
ocx integration client enable --client t3code
ocx integration client disable --client t3code
```

啟用會在 T3 Code 的伺服器設定中寫入一個供應商實例 `providerInstances.opencodex`，並保留其他每個實例與設定。
它是名為 **opencodex** 的 Claude 實例，執行你自己的 `claude` 執行檔，並把 `ANTHROPIC_BASE_URL` 設為代理，
`ANTHROPIC_AUTH_TOKEN` 使用非機密的 `opencodex-proxy` 標記，`ANTHROPIC_API_KEY` 明確設為空，
並設定 `CLAUDE_CODE_PROVIDER_MANAGED_BY_HOST=1`，讓你 Claude 設定中的 `settings.json` env 區塊無法重新指向。
每個路由模型都是以其 opencodex 選擇器（`provider/model`）為鍵的自訂模型，T3 Code 會原樣送出。
它會出現在 T3 Code 模型選擇器的 **opencodex** 底下。T3 Code 會自行重新載入該檔案，所以不需要重新啟動；
目錄變更與 `ocx sync` 會重新整理該實例。

T3 Code 在設定了 `T3CODE_HOME` 時把資料放在該處，否則放在 `~/.t3`。若你搬動了它，請在 opencodex 處理程序上設定同一個變數；
相對值會被拒絕。在 Windows 上，請使用完整限定的磁碟機路徑（`C:\shared\t3`）或 UNC 路徑（`\\server\share\t3`）；
沒有磁碟機的路徑，例如 `\shared\t3` 或 `/shared/t3`，會被拒絕。`~` 會依有效的使用者 home 展開。
標記不是憑證，所以此整合需要迴路存取，並且會拒絕已驗證的非迴路綁定，除非啟用了未驗證的迴路監聽器。

請把這個實例視為 opencodex 的。在 T3 Code 中把它的某個變數標為**敏感**、替它加入自訂模型，或將它關閉，都會改寫該區塊。
開關這時會顯示衝突，而不是覆寫你的編輯，並由**取代**還原產生的區塊。若要使用不同的設定，請在 T3 Code 中於它旁邊加入你自己的 Claude 實例。

Generated catalogs include only enabled models from each provider selection. This applies to both
downloads and managed integrations, including Pi and Aside. The management model list still shows
the full roster so you can enable additional models.

`ocx uninstall` disables recorded integrations, including all owned Aside profiles, before deleting
OpenCodex's recovery state. Unreadable ownership, missing profile registration or a conflicting edit
stops that deletion. Cleanup is sequential: earlier successful disables are not undone when a later
one fails. If compensation also fails, a client file may be left in an intermediate state. Inspect
the reported client files and retained recovery snapshots before retrying; retained state does not
mean every client was restored or left unchanged.

For Gajae built-in presets, keep the routing choice in `~/.gjc/agent/config.yml`:

```yaml
modelProfile:
  proxyProvider: opencodex
  proxyMode: always
```

Keep your chosen `modelProfile.default` to apply it when plain `gjc` starts. The managed integration owns only `providers.opencodex` in `models.yml`; refreshing or disabling that provider does not rewrite your preset choice. Refresh the integration after changing the exported model selection.

GJC models with a supported reasoning-effort ladder export `reasoning: true`, `thinking.levels`, and `compat.supportsReasoningEffort`, so GJC can offer an effort choice. Native Codex models receive their standard ladder even when the catalog omits it. Models without a known ladder omit these fields; `none` and `ultra` are not offered because `none` sends no effort and `ultra` folds to `max` on the wire. Refresh the integration to update these model options.

The managed OpenCode integration owns two fragments: `provider.opencodex` (opencode V1) and
`providers.opencodex` (opencode V2). Both carry the same declared per-model reasoning choices and
defaults — the legacy block spells a model's default in its options and its choices as a variant
map, the V2 block uses the model's settings and a native variant array — so both are written and
kept in sync; they name the same provider and model ids, and opencode V2 merges them into one
provider entry. Apply, Refresh, Disable, and Restore act on both fragments, and your other
providers, agents, keybinds, and MCP entries stay untouched.

Both fragments are built from the effective canonical model metadata — as are the Kilo export and
the `ocx opencode` launcher. An explicit custom override always wins, and a ladder you cleared to
empty stays empty; a reasoning ladder or default is never invented for a model that declares none.
An authoritative context limit is carried with an output budget beside it: a known output value —
explicit or from catalog metadata — wins, otherwise the schema-required 32000 fallback clamped to
the context, and without an authoritative context the whole limit block is omitted. Capabilities,
effort ladders, defaults, and an optional input limit appear only when known; the V2 block's
native capabilities object requires a known tools value, so when tool support is unknown it is
omitted entirely rather than written partially, and the legacy modality declarations stand.
"No ladder invented" still writes the controls, never choices: the V2 block always carries an
explicit variant array — empty when nothing is declared, because omitting it would make OpenCode
synthesize low/medium/high — and a model with known fixed reasoning but no adjustable ladder gets
disabled-only suppression instead of an effort: the legacy OpenCode block and Kilo both disable
every rung id the client would otherwise generate. Neither adds a selectable effort. The
selectable variants override the per-model
default — `none` included, offered only when the model's own declared ladder contains it. Whatever
the client selects, the proxy's pinned upstream reasoning policy still governs the request that
leaves it.

Managed DSH support has a compatibility floor of **DSH 0.1.0-rc.6**. DSH 0.1.7+ reads provider
routes from `[id=llm-pi-ai].config.providers.opencodex` in the Desktop profile patch,
`$DSH_HOME/profiles/desktop/cordis.patch.yml`, which DSH hot reloads. OpenCodex writes that row when the Desktop profile and its patch exist. If
`$DSH_HOME/profiles/desktop/package.json` exists but `cordis.patch.yml` is missing, Apply refuses:
create `cordis.patch.yml` containing `[]` (the empty patch DSH writes for a new profile), then
enable the integration again. Only when there is no Desktop profile does OpenCodex use
`llm-pi-ai.providers.opencodex` in `$DSH_HOME/settings.yaml`. OpenCodex owns only that provider
fragment: Apply and Refresh replace it, Disable removes it, and Restore puts back a recorded
snapshot. These operations do not change the user's default model or the native
`deepseek-official` provider.
The managed DSH integration is currently loopback-only and never writes a real credential.

MiniMax Code follows `MINIMAX_DATA_DIR`, then `MAVIS_DATA_DIR`, before falling
back to `~/.minimax`. Its managed block owns only `custom_provider.opencodex`.
It does not change `defaultModel`, the selected MiniMax credential source, or
the user's MiniMax login. Choose a `custom_provider:opencodex/<provider/model>`
entry in MCode after connecting it. Refreshing the integration also refreshes
authoritative per-model context windows and reasoning-effort choices; unknown
capabilities are omitted, and MCode's session-owned current effort is preserved.

Prime Agent follows `PRIME_AGENT_CODING_AGENT_DIR` before falling back to
`~/.prime/agent`; a relative value is refused so the proxy and the agent cannot
disagree about which file is meant. Its managed block owns only
`providers.opencodex`, so other providers and any `modelOverrides` you have set
stay untouched. Prime Agent reads `models.json` when a session starts, so start
a new session after connecting it.

Aside keeps a separate model catalog for each registered profile, including local profiles. OpenCodex lists
all registered profiles, including local profiles, and can synchronize them together or control
one profile at a time. Switching an integration never changes Aside's active account. A prior
Aside connection enables all profiles by default; individual exclusions survive later syncs.

One caveat specific to Aside: the running app rewrites `models.json` itself, so
fully quit and reopen Aside after applying, the same way Claude Desktop needs a
restart. Aside's block is loopback-only and never carries a real credential.

The managed Raycast integration supports **macOS and Windows**. Custom Providers
is a **Raycast Pro** feature: on a free plan the file is still written, but
`ocx integration client status --client raycast` and the **Connect** page report
a warning, because Raycast will not read it. On macOS or Windows, open Raycast →
Settings → AI → **Reveal Providers Config** once so the `ai` folder exists.
On these supported platforms, opencodex uses that folder as its install signal
and reports the client as not installed until it exists. Linux is unsupported,
even if the folder exists.

The status field `aiDirPresent` reports only whether `~/.config/raycast/ai` exists,
independently of whether the Raycast app is installed or the platform is supported.
It does not prove that Raycast is installed or usable. The CLI prints `plan` on a
separate line and adds the macOS/Windows setup instruction when `aiDirPresent` is
false; `--json` preserves the raw status, including the nested `raycast` block.
Raycast reads `~/.config/raycast/ai/providers.yaml` on macOS and Windows alike and
does not honor `XDG_CONFIG_HOME`, so that path is not relocatable.

The managed block is one element, `id: opencodex`, in the file's `providers`
sequence: `name: OpenCodex`, `base_url: http://<host>:<port>/v1`, and every
routed model with its `abilities` — the exporter sets `tools` and `system_message` to
`true` as a client-export convention, `vision` follows the catalog's input modalities, `reasoning_effort`
is set when the model has an effort ladder, and `temperature` is turned off for
reasoning models. Other providers in the file are preserved, and disable removes
only the OpenCodex element. Raycast picks up the change as soon as the file is
saved, no restart needed; the models appear in Raycast's model picker grouped
under **OpenCodex**. Raycast supports optional `api_keys`, but OpenCodex intentionally
omits them and refuses non-loopback or admission-authenticated targets; this integration
cannot supply OpenCodex's required admission header.

The macOS private preference is only an advisory Pro hint; Windows never reads it and
reports the plan as unknown. Plan detection does not authorize or block a write.
The export metadata has no authoritative tool-support flag, so `tools: true` does not
prove every routed model supports tools. Vision and effort flags follow catalog metadata;
turning temperature off for an effort ladder is conservative export behavior.
Provider values are preserved; YAML formatting and comments are not guaranteed to survive.
The format is documented at
[manual.raycast.com/ai/custom-providers](https://manual.raycast.com/ai/custom-providers).

Raycast CLI exports and dashboard downloads use the running server's destination and
admission policy, including a configured unauthenticated loopback listener. `ocx ensure`
does not refresh Raycast from its saved configuration snapshot: that can differ from the
running server. Server startup and explicit sync remain the catalog refresh paths.


Cursor has a tab but is not one of these switches. Regular Cursor calls custom endpoints from
its own backend, so a loopback proxy is unreachable without a public tunnel, and Cursor's
separate Private Inference build is configured inside Cursor. The **Cursor** tab is read-only:
it detects which build is installed, shows the Base URL and API Key to paste into Cursor, and
reports the last request Cursor made to the proxy. See
[Cursor Private Inference](/zh-tw/guides/cursor-private-inference/).

Paths honor each client's own environment override where it has one. For OMP,
`OMP_PROFILE` wins over `PI_PROFILE` by presence, even when explicitly empty. A named profile
uses `PI_CONFIG_DIR` as a directory name relative to the user's home and ignores `PI_CODING_AGENT_DIR`; without a named profile,
`PI_CODING_AGENT_DIR` wins. OMP supports provider-level headers, but this initial integration
is deliberately loopback-only; remote `x-opencodex-api-key` wiring is deferred. Relocated
`HERMES_HOME`, `KIMI_CODE_HOME`, and `XDG_CONFIG_HOME` paths are likewise followed rather than
guessed at. The table lists each client's default.

For native OpenAI models, the generated OMP block selects its model-level Responses API, preserving
image input and reasoning-effort controls. Routed models retain the provider's Chat Completions
dialect so their existing adapters remain compatible.

OpenClaw has several, and they do different jobs. `OPENCLAW_CONFIG_PATH` selects the
file; `OPENCLAW_STATE_DIR`, `OPENCLAW_PROFILE` and `OPENCLAW_HOME` select the state
directory, which is also what detection looks at — so a profile or relocated home
still reads as installed, while a config-path override moves only the file. If you
are still on the older `.clawdbot` layout, that is found too: the modern directory
wins when it exists, and the legacy one is used when it is the only one there.

在 Windows 上，需要絕對路徑的覆寫必須包含磁碟機代號（`C:\Users\me\client`）或 UNC 共用（`\\server\share\client`）。
沒有磁碟機的根目錄形式，例如 `\Users\me\client` 或 `/client/config`，因為依賴目前的磁碟機而會被拒絕。
文件中標明支援 `~` 的選擇器仍會依有效的 home 展開；Gentle Shell 不展開 `~`。

These must be **absolute paths** or start with `~`. A relative one is refused rather
than resolved, because it would mean whatever directory each process happened to
start in — and that path is stored with the backup, so it has to name the same file
tomorrow as it did today.

opencodex reads these from its own environment. If your gateway runs with a profile
or a relocated home, start opencodex with the same variables set, or it will
correctly follow a different installation.

## 其他五個介面不是開關

**API Keys** 管理 opencodex 自己的憑證，根本不是客戶端。**Codex CLI** 由 proxy 服務本身連接——啟動 opencodex 即套用，停止即回復原生路由——所以沒有什麼需要逐檔切換。**Claude** 保留自己的啟用旗標與 Desktop 的 Save/Apply 流程，**Grok Build** 保留其先選後套用的模型圍欄（model fence）。那些語意早於這項功能，且維持不變。**Cursor** 完全不會寫入任何內容：其分頁會顯示偵測結果、gateway 值，以及最近一次看到的請求，其餘則在 Cursor Private Inference 內部進行。

## 回復（Rollback）

每次成功的寫入都會*先*為你的檔案拍快照，所以你原本的狀態永遠可以回復：

- **Undo** 會出現在最新操作上，當你的檔案仍與我們寫入的內容相符時。
- **Restore this point…** 會出現在較舊的操作上，或當檔案在那次操作之後有變更時。跨過這樣的變更做回復會再詢問一次，才覆蓋你的較新編輯——並且也會備份它們，所以那次的回復本身也可以復原。
- 每個客戶端保留十份備份。超過之後，最舊的快照檔案會被移除，其歷史列顯示為 **Backup expired**。

停用只移除 opencodex 記錄為自己寫入的條目。如果你的檔案在我們寫入之後有變更，後續行為取決於我們自己的條目是否完好，以及檔案的格式。對於嚴格 JSON 設定檔（OpenCode、Pi），在我們的區塊**旁邊**進行的編輯——例如新增 MCP 伺服器或你自己的 provider——會顯示為**需要更新**：重新整理會在保留你的條目的前提下合併寫入，但格式可能會被正規化。例外情況是 JSON 無法精確重寫的內容——例如 `1e999` 這類非有限數字、重寫會被四捨五入的數字（極大的整數，或小到會塌縮成零的數字）、`-0`、同一個物件裡重複出現的鍵，或巢狀層數超過 1000 層——此時開關會鎖定，確保沒有任何值被悄悄改動或刪除。**OMP、DSH 與 Hermes** 同樣不受旁邊編輯影響，但原因不同：它們的 writer 只逐位元組修補自己管理的 provider 片段，檔案其餘部分從不會被重寫。至於其餘可以包含註解的格式（OpenClaw、Kimi Code、gjc、MiniMax Code、Raycast——以整份文件寫出的 YAML、JSON5 與 TOML），或當我們自己的條目被編輯過時，開關會鎖定，停用會拒絕執行，而不是猜測哪些編輯是你的。

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

## Hermes profiles

Hermes keeps a separate home for each bot profile. The default profile uses
`~/.hermes/config.yaml` (`%LOCALAPPDATA%\hermes\config.yaml` on Windows, or `$HERMES_HOME/config.yaml`),
and each named profile created with `hermes profile create <name>` uses
`<Hermes home>/profiles/<name>/config.yaml`. See Hermes'
[profiles guide](https://hermes-agent.nousresearch.com/docs/user-guide/profiles).

When named profiles exist, **Connect → Hermes** lists every profile with its own status. Select a
profile to apply, disable, replace, or restore OpenCodex for that profile alone; each profile keeps its
own backups and rollback history, and the other profiles stay unchanged. Every profile keeps its own
`model.default` and other providers: OpenCodex adds only `providers.opencodex`. With no named profiles,
the page works as before and changes the default profile.

The management API selects a profile with `profile=<name>` on `/api/client-integrations/hermes` and with
`client=hermes&profile=<name>` on the preview, journal, and restore endpoints;
`GET /api/client-integrations/hermes/profiles` lists the profiles. A directory under `profiles/` counts
only when Hermes would list it: a valid name, a Hermes identity file such as `config.yaml` or `SOUL.md`,
and no deletion marker. A profile reached through a symbolic link or junction is not offered. If
`HERMES_HOME` later points at a different Hermes home, a profile with the same name there is refused
until you disconnect the original one, so OpenCodex never loses track of a file it changed.

## 預覽並確認變更

套用、取代、停用與回復現在都會先顯示預覽。對話框會明確列出哪些受管理的設定將會變更，
包括範圍有限的變更路徑，以及每項變更是新增、更新或移除值。請先檢視計畫，再進行確認。

當計畫顯示沒有變更時，表示受管理的用戶端文件已處於要求的狀態。對選取的 Aside 設定檔，
即使受管理的文件沒有變更，確認後仍可能儲存該設定檔的同步偏好。

如果檔案在你檢視後又有變更，寫入會因計畫過期而被拒絕。對話框會用更新後的計畫取代舊
計畫，並要求你再次明確確認；它絕不會自動重試寫入。如果預覽表示尚未載入模型目錄，對話框會保持開啟並
提供 **載入目錄並重試**：它會重新讀取整合清單，再重新要求計畫。

Aside 會對一次選取的單一設定檔使用相同的預覽與確認流程。**同步所有設定檔**仍是獨立的
批次操作，不會綁定到單一合併預覽。一份計畫只描述一個設定檔的檔案，
因此處於衝突狀態的 Aside 概覽卡片會提供 **選擇設定檔**，請在該設定檔頁面取代設定區塊。

## 誠實的預期

**格式通常不會被保留。** 套用會解析設定並重新寫出，所以 JSON、JSON5 與 TOML 可能被重新格式化，JSON5 或 TOML 中的註解會遺失。OMP、DSH 與 Hermes 是例外：它們的 YAML writer 分別只修補 `providers.opencodex` 與 `llm-pi-ai.providers.opencodex`，逐位元組保留無關的 provider 註解與格式。如果無法安全地識別那個確切的來源範圍，操作會拒絕執行。對其他客戶端，當你需要先前的檔案位元組時請使用 Restore：快照是逐字的副本。

**如果某個值無法忠實重寫，開關會拒絕執行。** 往返覆蓋這些格式在實務上會用到的值種類；當它做不到時——例如使用 `inf` 或 `nan` 的 TOML 檔案，我們可用的 parser 無法準確讀回——套用會停止並說明，而不是寫入被改動的值然後宣稱成功。你會看到檔案被指名，磁碟上沒有任何東西被移動。手動編輯那個檔案仍然有效；只有我們的自動重寫會拒絕。

TOML 日期與時間值也會阻止受管理的重寫：合併步驟會將這些帶有型別的值轉成加引號的字串，這也包括陣列與行內表格中的值。原本就加引號的日期字串仍受支援；若要保留不加引號的日期型別，請手動編輯設定。

**Pi、Kimi Code、gjc、MiniMax Code、Prime Agent、Aside、Raycast、omo 與受管理 DSH 整合只能對 loopback bind 運作。** 前四者的設定沒有非 loopback bind 所需的 `x-opencodex-api-key` header 欄位。DSH 雖然提供通用 headers map，但 rc.6 並未把這個專用准入 header 記錄為受支援的整合契約，因此受管理 writer 會選擇安全拒絕，而不自行猜測。Prime Agent 的 provider 區塊確實接受 headers，但遠端憑證連線設定在最初的整合中被延後。請改用 SSH tunnel，或由本機 forwarder 加上該 header 後再以 loopback 存取。

**產生的 OMP 整合也刻意只支援 loopback。** OMP 確實支援 provider 層級的 headers，但這個最初的整合不會發出遠端 `x-opencodex-api-key` 憑證連線。手動的遠端 OMP 設定目前不在受管理的整合範圍內。

**Kimi Code 無法持有環境變數參考，** 所以它的設定攜帶的是 `opencodex-loopback` 佔位符而非金鑰。絕不會有任何真實憑證被寫入任何客戶端設定。

**對 `ocx opencode` 而言，launcher 的 provider 區塊勝出。** 那個 launcher 透過 `OPENCODE_CONFIG_CONTENT` 注入 `provider.opencodex` 與 `providers.opencodex`，比磁碟上相同的條目優先——你其餘的 opencode 設定仍照常套用。當你直接啟動 `opencode` 時，這裡的開關才是關鍵。

## 從終端機

The same operations are available headlessly:

```bash
ocx integration client status
ocx integration client enable --client hermes
ocx integration client disable --client hermes
ocx integration client history --client hermes
ocx integration client restore --op <opId> [--confirm-drift]
```

### 選用的別名模型名稱

Hermes 與 Command Code 接受 `--model-names alias|routed`。預設為 `routed`，與 `preferModelAliasIds` 無關。例如：

```bash
ocx export --client hermes --model-names alias --json
ocx integration client preview --client hermes --operation apply --model-names alias --json
ocx integration client enable --client hermes --model-names alias
ocx integration client enable --client commandcode --model-names alias
```

匯出只是預覽：它使用已載入的目前目錄，不會寫入任何用戶端設定或整合狀態。若該目錄不可用，請另外載入模型目錄後重試。
`--out` 會明確寫出匯出成品；它不會連線用戶端。

連線會儲存這個模式。之後的套用（包含儀表板）省略旗標時會保留它；明確的 `--model-names routed` 則會重設。
像 `AC/AC-model-x` 這樣的限定別名，只有在路由器證明供應商與模型相同時，才會取代 `acme/vendor-model-x`。
缺少或不安全的別名與衝突，會退回路由鍵。組合保留其既有的鍵。

別名重新命名或移除後，請執行 `ocx sync` 或明確套用該連線：下一次成功的受管重新整理，會把舊的鍵換成新驗證過的別名或路由後備。
別名編輯不會以原子方式更新用戶端檔案。重新整理維持冪等，並拒絕外來的編輯。
若別名在套用或重新整理等待期間改變，寫入會被拒絕；請對目前的目錄重試。
每個具名的 Hermes 設定檔各自儲存自己的模式；自動目錄重新整理只涵蓋預設設定檔，所以具名設定檔需要明確套用。其他匯出器保留路由名稱。

### Preview and bind a terminal write

The existing direct commands remain supported. To bind a write to a reviewed
observation, inspect status and save a preview first:

```bash
ocx integration client preview --help
ocx integration client status --client hermes --json
ocx integration client preview --client hermes --operation apply --json > hermes-preview.json
```

Review `state`, `foreignEdit`, structural `changes`, `canApply` and `willChange`.
Valid refused and no-op plans exit 0 because inspection succeeded; nothing was
applied. The plan contains no secret values or full file diff. It uses existing
passive catalog evidence and never secretly refreshes providers. If unavailable,
resolve catalog availability separately before requesting a new preview.

Only after reviewing an applicable plan and choosing the write:

```bash
PLAN_FINGERPRINT="$(jq -er 'select(.canApply == true) | .fingerprint' hermes-preview.json)"
ocx integration client enable --client hermes --plan-fingerprint "$PLAN_FINGERPRINT" --json
ocx integration client status --client hermes --json
```

Fingerprint is concurrency evidence, not authorization. Commit accepts `pN:`
followed by 32 lowercase hex digits; a refused `pN:unbound` cannot commit. Repeat
exact client/action/profile/options. Preview `overwrite` maps to enable with
`--overwrite-conflict`; preview `disable` maps to disable. Stale commit exits 5,
prints re-preview guidance on stderr and leaves stdout empty. It never adopts a
replacement fingerprint or retries. Other failures use usage 2, not-found 4,
runtime/malformed 1, with safe stderr rather than a JSON error envelope.

### Inspect restoration drift before replacing it

Use a real history opId; `op-example` below is fictional:

```bash
ocx integration client history --client aside --profile 1 --json
ocx integration client restore --op op-example --client aside --profile 1 --preview --json
```

If drift is refused, inspect the edits. When replacing them is explicitly intended,
preview with `--confirm-drift`, review, then bind that same intent:

```bash
ocx integration client restore --op op-example --client aside --profile 1 --preview --confirm-drift --json > restore-preview.json
```

After review:

```bash
RESTORE_FINGERPRINT="$(jq -er 'select(.canApply == true) | .fingerprint' restore-preview.json)"
ocx integration client restore --op op-example --client aside --profile 1 --confirm-drift --plan-fingerprint "$RESTORE_FINGERPRINT" --json
ocx integration client status --client aside --profile 1 --json
```

Aside preview/bound writes require one profile, not an aggregate target. Generic
restore omits client/profile; the server derives the non-Aside client from opId.
The returned plan does not contain opId or all original command inputs, so retain
that context. `--preview` cannot combine with `--plan-fingerprint`.

### Retire an old recovery record

This permanently retires the record and backup; it does not restore or disable
the integration. After inspecting history and choosing to lose that recovery point:

```bash
ocx integration client history remove --op op-example --client aside --profile 1 --yes --json
ocx integration client history --client aside --profile 1 --json
```

Use the actual selected opId. No selector addresses the global journal; `--client aside`
addresses aggregate Aside history and optional `--profile` narrows it. Other client
selectors are refused for deletion. The newest row is protected. A receipt with
`snapshotRemoved:false` is committed retirement with incomplete cleanup and exit 1;
it is not rollback and must not trigger repeated deletion. `journal remove` is an alias.

`--overwrite-conflict` is the terminal form of **Replace**:

```bash
ocx integration client enable --client zcode --overwrite-conflict
```

Like `--confirm-drift`, it is never assumed — without it a conflict is still refused.
It applies only to `enable`; forcing a *disable* over a conflict would delete a block
we never wrote, so that combination is rejected.

For MiniMax Code, connect the provider once and launch through the checked wrapper:

```bash
ocx integration client enable --client mcode
ocx mcode
```

Once connected, `ocx sync` and `POST /api/sync` refresh owned MCode, Pi, Aside,
Raycast, omo, OpenCode, and Kilo catalogs with the current model selection, context windows, and
reasoning-effort ladders. Proxy startup refreshes an owned Raycast catalog. Changes to
model visibility, provider selection, or presets also refresh connected Pi, Aside,
Raycast, omo, OpenCode, and Kilo catalogs.
Missing, foreign-edited, or unsafe blocks stay untouched, as do previously owned blocks
you removed manually.
An enabled Aside profile is an exception to the usual owned-only refresh: if its account
directory exists and it has never had an owned block, sync may create its first block when
that slot is empty. A prior Aside connection enables this behavior for all registered
profiles by default. Sync does not create missing account directories or replace manual blocks.
A refused or overlapping refresh is reported separately for each client. Start a new Pi,
OpenCode, or Kilo session or fully quit and reopen Aside to load the updated file.
Aside refresh requires a [compatible running proxy](#aside-profile-controls).

If Models reports **“Model selection saved”** together with a client-refresh warning, the
selection is already saved; one or more client files could not be updated. The warning names
the affected client and Aside profile, when applicable, and explains the refusal. Open
**Connect** to inspect that client or profile before starting a new session. Resolve the
reported issue, then retry `ocx sync`; an overlapping operation must finish first. If the
warning includes a backup path or says recovery did not finish, inspect that recovery state
before retrying. A successful selection save alone does not confirm client-file recovery.

The separate MiniMax platform CLI (`mmx`) is not a file-toggle integration. Its text
commands use MiniMax's Anthropic-compatible endpoint, so OpenCodex provides a
credential-isolated, loopback-only launcher:

```bash
ocx mmx text chat --model anthropic/claude-opus-5 --message "Hello"
ocx mmx text repl --model openai/gpt-5.6-sol
```

Only `mmx text chat` and `mmx text repl` are proxied. Run plain `mmx` for
MiniMax-native image, video, speech, music, vision, search, quota, auth, config, file
and update commands. The wrapper uses a temporary config containing only a non-secret
loopback placeholder; it never loads your `~/.mmx` OAuth or API-key credentials, and
it refuses `--api-key`, `--base-url` and `--region` overrides. See
[MiniMax clients](/zh-tw/guides/minimax/) for the complete workflow and limits.

`--confirm-drift` is never assumed. If the file changed after the operation you are
restoring, the command refuses and tells you, because replacing your newer edits is your
decision to make.

Client details were verified against each project's own configuration format; see the
research notes in `devlog/_fin/260802_client_toggle_api/002_client_toggle_matrix.md`
for what was checked and when.

## ZCode 3.14 以後

Aside profile controls and the Aside refresh performed by `ocx sync` require a running
ocx proxy that supports the Aside profile APIs. Updating the CLI alone does not update an
already-running proxy. If the proxy is unavailable or too old, the Aside operation cannot
complete; the CLI never falls back to writing Aside profile files locally.

Upgrade the ocx installation used by the proxy, then restart the proxy (or start it if it
is stopped). Retry `ocx sync` or the profile command. After the profile files update
successfully, fully quit and reopen Aside so it loads the new catalogs.

```bash
ocx integration client status --client aside --json
ocx integration client enable --client aside
ocx integration client disable --client aside --profile 1
ocx integration client history --client aside --profile 1
ocx integration client restore --client aside --profile 1 --op <opId>
```

The profile number is the account ID shown by the status command. Omitting `--profile` on an
Aside toggle applies the desired state to every registered profile. A per-profile change leaves
siblings unchanged. Desired sync settings are saved before file changes; actual state and any
refusal are reported for each profile. A partial bulk result is not an all-applied success and
the CLI exits nonzero. Undo restores the selected profile's synchronization intent as well as
its file, so a later sync does not silently reverse Undo.

The [profile API](/zh-tw/reference/management-api/#aside-profile-controls) returns HTTP 200 for a
successful bulk operation and HTTP 207 with `ok: false` if any profile refuses. Inspect every
entry in `results`: successful profiles are not rolled back when another fails. Desired
settings remain saved, so retry after addressing the affected profile rather than assuming
the entire change failed. If saving those settings fails, no profile files are changed.

For a targeted refresh of eligible Aside profiles, rather than broad catalog sync:

```bash
ocx integration client sync --client aside --json
ocx integration client status --client aside --json
```

This uses the existing attested Aside owner and has no profile selector or local
fallback. `{results:[]}` exits 0 and means no eligible profiles, not applied writes.
Any failed row returns exit 1 while successful profiles remain updated. Preserve
per-profile refusal, residual and separately labeled redacted backup information;
inspect the affected profile before retrying. This refresh is separate from each
profile's preview/bound mutation workflow.

Sync refreshes only profiles whose sync preference is on, so an empty result is not a failure.
If `ocx integration client status --client aside` shows a profile as `off (stale)`, status
prints the commands to reconnect it: review `ocx integration client preview --client aside
--operation apply --profile N`, and run `ocx integration client enable --client aside --profile N`
only if the preview permits the change and you accept it. Nothing is re-enabled automatically.
A malformed `asideProfileSync` block in `config.json` turns every profile off and logs a
warning when the config loads.

Each profile has separate ownership and history. Existing user edits, unsafe paths and linked
catalogs are refused; the existing explicit overwrite and drift-confirmation controls remain
available. Fully quit and reopen Aside to load changed model files.


## Aside profile controls

By default, ZCode 3.14 stores its custom providers in `~/.zcode/v2/provider_config.json` and left
`~/.zcode/v2/config.json` reachable only through a one-shot import that runs when the new file is
missing. ZCode creates the new file the first time it runs, so on any install that has ever been
launched the import is already spent and a write to `config.json` reaches nothing.

ZCode can relocate its data root with an absolute `dataBaseDir` in
`~/.zcode/v2/setting.json`. This bootstrap file always stays under the default home;
the provider store moves to `<dataBaseDir>/.zcode/v2/provider_config.json`.
`ZCODE_DATA_DIR` takes precedence and names the `.zcode` root directly, while
`ZCODE_PERSONAL_PROVIDER_CONFIG_FILE` takes precedence for the provider file.
`ZCODE_DATA_BASE_DIR` is a separate native selector and is not an alias for `ZCODE_DATA_DIR`.

Unreadable, malformed or relative bootstrap settings leave the active root unknown.
The bootstrap must be a regular file of at most 4 MiB; symbolic links and special files
are refused during export and integration path discovery. Repair the bootstrap file or
supply an explicit `ZCODE_DATA_DIR` to select the intended data root.
Apply, overwrite and refresh refuse with a repair message instead of claiming a successful
legacy write. An existing explicit provider file can still establish the active store.
Ownership recorded at the original default config or store keeps its path, fingerprints
and undo history; disable removes that original block before a later enable can use the
relocated store. An older undo also refuses while another path owns the integration.
If an earlier explicit selector no longer identifies the owned file, restore that selector
before disabling; opencodex retains the record and refuses to abandon the block.

opencodex writes `provider_config.json` directly where it can. Enabling the integration adds the
`opencodex` provider rule to that file, a catalog refresh updates it, and disabling removes exactly
what opencodex put there. Every other rule in the file is left alone, including a rule another
provider keeps for a model id that also appears under ours. A rule carrying the `opencodex` id that
opencodex did not write is a conflict rather than something to take over; resolve it in ZCode, or
use the explicit overwrite.

An unreadable or non-file provider store also refuses writes; it is not treated as an absent store that permits the legacy import.

Two other situations still refuse rather than write. A block opencodex applied before ZCode moved its
store keeps the integration on `config.json`: disable it there first, then enable it again to write
the new store. And a `provider_config.json` whose `schemaVersion` is not one opencodex has observed
is reported rather than merged into, because that file holds every provider ZCode has and asserting
a shape into it would trade a silent no-op for a silent loss. Status names the file ZCode reads
whenever the integration is not writing it.

In that second case, add the provider in ZCode's own settings: base URL
`http://127.0.0.1:10100/v1` (adjust the port to your bind), any non-empty key, and the model ids
from `ocx export --client zcode`. Deleting `provider_config.json` to re-trigger ZCode's import is
not supported — it discards every provider ZCode keeps there.

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

## omo（Codex / LazyCodex）角色模型

安裝 LazyCodex 後，Codex 分頁會顯示一個 **omo (Codex / LazyCodex)** 區段，列出 `$CODEX_HOME/agents/*.toml` 中找到的每個 Codex 代理角色，以及各自釘選的模型。不論父層要求哪個模型，Codex 都會用該釘選執行角色，所以這裡才是真正決定角色模型的地方。當 `omo@sisyphuslabs` Codex 外掛在 `$CODEX_HOME/config.toml` 中被啟用，且 `$CODEX_HOME/plugins/cache/sisyphuslabs/omo/` 底下的已安裝副本帶有它的 `lazycodex-install.json` 時，LazyCodex 才算已安裝。單單一個 `~/.omo` 資料夾不算，因為以 Pi 為基礎的 omo 也會建立它。沒有 LazyCodex 時，該區段會隱藏，而命令列會回報它未安裝。在某一列選擇模型並按 Save：

- opencodex 只改寫該角色檔案根層級的 `model = "..."` 那一行。角色的指示、註解與其他鍵都保持原樣。沒有釘選的角色會在檔案靠近開頭處新增一個。
- 相同的值會寫入 `~/.omo/omo.jsonc` 中的 `codex.agents.<role>.model`，這是 LazyCodex 5.1.1 與更新版本會讀取的位置。如果該檔案不存在，不會建立它。如果它含有註解，就維持原樣不動，因為儲存會移除它們；分頁會說明這點，你可以自己在那裡設定該值。

在你按下 Save 之前什麼都不會發生；同步或重新啟動 opencodex 絕不會改變角色檔案。新的 Codex session 會取得變更。命令列上有相同的控制：

```bash
ocx agent roles
ocx agent roles set explorer xai/grok-4.5
```

### 自動指派

自動指派是 omo（Codex／LazyCodex）的一部分：它位於該區段的角色表上方，只有偵測到 LazyCodex 時才存在。
沒有它時，儀表板兩者都不顯示，API 回應 409 `lazycodex_not_detected`，而 `ocx agent roles suggest` 會被拒絕。

自動指派會一次為每個角色提出模型建議。opencodex 向你的預設 Codex 模型（Codex `config.toml` 中的根 `model`）問一個問題：
對每個角色，依其描述與指示的開頭，它需要哪個能力層級（fast、standard 或 frontier）、多少推理（glance、measured、thorough 或 exhaustive），
以及哪個任務領域（coding、agentic、reasoning、writing、knowledge 或 general）？該模型從不挑選模型。
opencodex 接著從你的選擇器清單中，挑出達到該層級的最便宜模型：

- 在 opencodex 設定的 `codexRoleTiers`（`{ "fast": [...], "standard": [...], "frontier": [...] }`）中列出的模型，屬於該層級。
- 當其餘模型中有兩個或以上在該角色的領域有公布分數時，這些模型會依不同的分數值分層，不需要價格；
  分數相同者同屬一層，沒有分數的模型被排除。分數來自 [Artificial Analysis](https://artificialanalysis.ai)（在你加入自己的 API 金鑰之後，見下）。
  Artificial Analysis 已不再公布 Coding 或 Agentic 指數，所以每個領域都以其 Intelligence Index 計分。回應的 `capability` 區塊會指出所用的來源。
- 其他有已知價格的模型依價格排序，並平均分到三個層級。只有一個或兩個有價格的模型時，最貴的為 frontier，另一個（若有）為 standard。
- 當分層退回依價格時，沒有價格也沒有列出層級的模型不會被建議。請列出它們才會納入。

若要使用 Artificial Analysis，請在 [artificialanalysis.ai](https://artificialanalysis.ai/data-api/docs) 建立免費的 API 金鑰，
並設定為字面值、`${ENV}` 參照或金鑰圈參照：

```json
{
  "codexRoleCapability": {
    "artificialAnalysis": { "apiKey": "${ARTIFICIAL_ANALYSIS_API_KEY}" }
  }
}
```

opencodex 每天讀取一次免費語言模型清單（`/api/v2/language/models/free`），每頁一個請求，維持在免費方案每日請求上限之內。
其條款允許將資料用於你自己的決策，但禁止轉傳，所以自動指派把分數保留在內部：回應帶有每個模型得到的層級與出處標示，但不含分數。
若金鑰不存在或讀取失敗，自動指派會使用已設定的層級與價格；`capability.error` 會回報原因，出處標示欄位為 null。已淘汰的 `huggingFace` 設定會被忽略。

Artificial Analysis 會拒絕 HTTP 重新導向，最多讀取十頁與合計 16 MiB，並給每個請求 30 秒的逾時；較長的清單視為讀取失敗。
憑證只會送到它固定的 API 端點。

每個建議會顯示模型、層級、推理強度、一行理由，以及什麼會讓它上調或下調。模型無法明確評估的角色會顯示為未評估並附上原因，且無法套用。
在你按下某一列的套用或全部套用之前，不會寫入任何內容。套用使用與手動挑選相同的儲存。
每個已評估、且所選模型具有非空 effort 階梯的角色都會得到 effort 建議，而套用或 `--apply` 會插入或取代其 `model_reasoning_effort` 值。
effort 會放在所選模型自己的層級上：它的最低、預設、預設上一階，或最高。空的階梯不給 effort 建議（`proposedEffort: null`）；
套用會省略 `effort`，並保持既有的 effort 固定值不變。null 建議絕不會清除固定值。

```bash
ocx agent roles suggest
ocx agent roles suggest --model xai/grok-4.5 --apply
```

CLI 的 `--apply` 在一個歷史批次中最多接受 50 個變更的角色。較大的操作會在任何角色更新之前被拒絕；
請預覽它，並用 `ocx agent roles set` 套用個別選擇。中斷的操作會回報已確認的寫入與未確認的請求，並讓較早的寫入維持已套用。
重試之前請參閱 [CLI 套用與復原契約](/zh-tw/reference/cli/agents/)。

在表格下方，**變更歷史**列出儲存、自動指派套用或 `ocx agent roles set` 所寫入的最新變更，由新到舊，以完整批次為單位且不超過 50 筆，所以一次全部套用，其寫入的每個角色要嘛全部列出、要嘛完全不列出，並附上每個角色變更前後的模型與 effort。一次全部套用是一筆項目。**還原**會透過同一個儲存把較早的值寫回，所以還原本身也會被列出。儲存絕不移除模型固定值，所以原本沒有固定值的角色會保留目前的模型，只還原其 effort。歷史存放在 opencodex 設定目錄下的 `integrations/codex-agent-roles.jsonl`，最多保留 256 KiB 與 1000 列，方式是丟棄最舊的完整批次。壓縮的目標是 128 KiB，並在兩項上限都容得下時，把還原與其完整的來源批次一起保留，必要時丟棄不相關的較舊批次來騰出空間；隨著之後的寫入，歷史仍可能過期。寫入器會在附加之前擷取有界的歷史，所以還原不會在保留邊界逐出自己的來源；上方 omo 卡片的還原中心只追蹤 `~/.omo/agent/models.json`。每筆變更都記錄它所做的 Codex home，且只列出或還原目前 home 的變更，因此把 `CODEX_HOME` 指向別處後，清單會從空的開始，來自另一個 home 歷史的還原會被拒絕。若無法讀取歷史檔，該區段會就地說明，而不顯示清單，角色表仍可運作。

## Kilo

Kilo 只會把 `provider.opencodex` 寫入 `~/.config/kilo` 下最先存在的全域檔（`XDG_CONFIG_HOME` 會移動該目錄；若沒有任何候選檔則建立 `kilo.jsonc`）。若另一個候選檔也定義 `provider.opencodex`，狀態會回報衝突且套用會拒絕。其他鍵保持不變。套用會重寫整個檔案，因此不會保留註解與尾隨逗號。每個模型的推論選擇會以變體映射的形式寫入 provider 區塊，與 OpenCode 匯出使用相同的生效規範中繼資料。`ocx sync` 與 `POST /api/sync` 會重新整理 OpenCodex 擁有的 Kilo 區塊，新的 Kilo 工作階段會載入更新後的檔案。請在 Kilo 中選擇 `opencodex/<模型>`。

即使其他候選檔發生衝突或無法剖析，停用仍可移除已記錄檔案中由 OpenCodex 管理的區塊；其他候選檔不會變動。

```bash
ocx integration client enable --client kilo
```

## Command Code

Command Code keeps its custom providers in `~/.commandcode/providers.json`. This
integration writes `provider.opencodex` into that file and is loopback-only.

**Which root it writes.** Command Code resolves its provider map as
`document.provider ?? document.providers`, so the singular root wins whenever it
exists. The integration therefore reads the target file first and writes into the
root that file already uses: a document that already carries a `providers` map keeps
it, and your other providers stay readable. A fresh file gets the singular `provider`
root. Both roots are declared as managed paths, so Disable removes the block from
whichever one it was written into.

**The credential form.** The provider is written with `apiKey: false`, the documented
form for an endpoint that needs no key. A raw string is refused by Command Code, and
no service-token file is read, referenced, or exported by this integration.

**Home resolution.** There is no `COMMANDCODE_HOME` override here. The published
client resolves `HOME ?? USERPROFILE` and then appends `/.commandcode/providers.json`;
it does not consult that variable. An override this integration honoured but the
client ignored would make Apply report success at a path Command Code never opens, so
the path is always `~/.commandcode/providers.json`.
On Windows with the default home, the integration uses `HOME ?? USERPROFILE`
only when the selected value is nonblank and Windows-absolute; otherwise it uses
`homedir()`. A separately supplied home is preserved. A `HOME` set by Git for
Windows or MSYS2 is therefore honoured only when it passes those checks.

Paste the key yourself if you later move the provider off loopback: Command Code
stores keys in `~/.commandcode/auth.json` (via `/connect`), not in `providers.json`.

```bash
ocx integration client enable --client commandcode
ocx export --client commandcode --out ./providers.json
```

`ocx commandcode restore --op <opId>` accepts only Command Code operations, including
`--preview` and `--plan-fingerprint` requests. It rejects client/profile overrides.
The running proxy must support client-scoped restore; older proxies return an error
without falling back to the generic restore endpoint.
Use `ocx integration client restore` for the generic journal and the explicit Aside
profile commands above for Aside operations.

## Factory Droid

Run Droid once to create `~/.factory`, then explicitly enable this integration with
`ocx integration client enable --client droid`. OpenCodex adds only documented
`customModels` entries to your personal `settings.json`, using a keyless local
Chat Completions endpoint. Choose a row from Droid's `/model` picker. Disable
removes the managed rows; Undo restores the exact saved file. Other settings and
custom models remain yours.
If Droid normalizes a `customModels` row by adding `id` or `index`, OpenCodex ignores those two
client fields when checking ownership so saved reasoning defaults remain available.

Open **Connect → Factory Droid** (`/#integrations/droid`) to set a reasoning
default for each connected model. Choose from the model's supported efforts,
review the changes, then confirm. **No default** clears that model's draft setting;
use **Save / review changes** and confirm to apply the removal.
Models without a declared effort list show that no default is available.

The CLI supports the same defaults in Droid apply/overwrite. For example, replace
the fictional model below with an exact connected ID and supported effort:

```bash
ocx integration client preview --client droid --operation apply --reasoning-default example/model-a=high --json > droid-preview.json
```

After reviewing the applicable plan and choosing the write:

```bash
DROID_FINGERPRINT="$(jq -er 'select(.canApply == true) | .fingerprint' droid-preview.json)"
ocx integration client enable --client droid --reasoning-default example/model-a=high --plan-fingerprint "$DROID_FINGERPRINT" --json
ocx integration client status --client droid --json
```

Repeat `--reasoning-default MODEL=EFFORT` to submit the complete replacement map.
The last equals sign separates model and effort; case and exact IDs are preserved.
Duplicate model keys refuse. Omitted flags preserve defaults;
`--clear-reasoning-defaults` explicitly sends an empty map. To clear, preview with
that flag and repeat it in the matching enable command. Clear and entries cannot
combine. These flags are Droid-only and do not apply to disable/restore. Repeat
the same map in preview and commit; the server validates model-specific efforts
and refuses stale binding rather than silently accepting a changed map.

For an intended complete clear, preview that separate action:

```bash
ocx integration client preview --client droid --operation apply --clear-reasoning-defaults --json > droid-clear-preview.json
```

After reviewing and choosing it:

```bash
DROID_CLEAR_FINGERPRINT="$(jq -er 'select(.canApply == true) | .fingerprint' droid-clear-preview.json)"
ocx integration client enable --client droid --clear-reasoning-defaults --plan-fingerprint "$DROID_CLEAR_FINGERPRINT" --json
```

The default applies only when Droid omits an effort from its request. An explicit
request effort takes precedence over this default; existing OpenCodex pins and
caps still apply. Droid may continue to display **Dynamic** even when OpenCodex
applies the configured default. Requests without the Droid default header are
unaffected; the header is a request preference, not proof of client identity.
For combos and routing policies, each concrete target checks the preference
against its own effort list, so an incompatible first target does not remove it
from a compatible fallback.

A saved default that the routed model no longer supports is ignored for requests.
If the connected model's declared effort list no longer includes the saved value,
it is omitted from the panel's defaults and removed from the managed row on refresh.
Reviewing without editing lets OpenCodex preserve the remaining supported defaults.

Refresh preserves defaults while the exact `provider/model` selector remains
connected and declares the saved effort. Renaming a provider, model, or combo alias replaces that managed row
and clears its default; choose a default for the renamed row again. Disable
removes the defaults with the managed model rows, and Undo restores the saved
rows and their defaults together.

Models whose IDs or display names contain `,` or `]` are skipped because the
managed selector cannot address them safely; export and managed settings show
the same rows. A nonempty catalog with no addressable models is refused.

Droid also reads legacy `config.json` and local `settings.local.json`. Resolve
legacy rows that use the OpenCodex endpoint, a generated model ID, or an
`OpenCodex:` display name, and any local `customModels` override, before enabling;
OpenCodex refuses those ambiguous settings. It also refuses an
unsafe target or a row edited since apply. The integration is loopback only and
never copies provider credentials. Factory documents the [BYOK schema](https://docs.factory.ai/model-independence/byok)
and [personal settings path](https://docs.factory.ai/droid-cli/settings).
