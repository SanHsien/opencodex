---
title: 整合
description: 從儀表板把 opencodex 連接到 OpenCode、Pi、Gentle Shell、OMP、Hermes、OpenClaw、Kimi Code、gjc、DeepSeek Harness、MiniMax Code、ZCode、Prime Agent、Aside、Raycast、omo、Qoder、Cline CLI、Kilo、Command Code、Factory Droid 與 T3 Code——每個客戶端一個開關，每次寫入前都會先備份。
---

**Connect** 分頁會把 opencodex 的 provider 區塊寫入客戶端自己的設定檔，也會把它移除。以下每個客戶端都有自己的開關：

| 客戶端 | 設定檔 | 格式 | 變更生效時機 | 憑證 |
|---|---|---|---|---|
| OpenCode | `~/.config/opencode/opencode.json` | JSON | 下次直接啟動 | `OPENCODEX_OPENCODE_API_KEY` |
| Pi | `~/.pi/agent/models.json` | JSON | 新 sessions | loopback 佔位符 |
| Gentle Shell | `~/.gentle-shell/agent/models.json`（持久化的選取家目錄） | JSON | 重新啟動 Gentle Shell 後 | loopback 佔位符 |
| OMP | `~/.omp/agent/models.yml` | YAML | 重新啟動 OMP 後 | `opencodex-loopback` 佔位符 |
| Hermes | `~/.hermes/config.yaml` | YAML | 新 sessions | `OPENCODEX_HERMES_API_KEY` |
| OpenClaw | `~/.openclaw/openclaw.json` | JSON5 | 立即，在執行中的 gateway 上 | `OPENCODEX_OPENCLAW_API_KEY` |
| Kimi Code | `~/.kimi-code/config.toml` | TOML | 重新啟動時，或 `/reload` | loopback 佔位符 |
| gjc | `~/.gjc/agent/models.yml` | YAML | 新 sessions，或當你開啟 `/model` 時 | 非機密 loopback 佔位符 |
| DeepSeek Harness (DSH) | `$DSH_HOME/profiles/desktop/cordis.patch.yml`（預設 `~/.dsh/profiles/desktop/cordis.patch.yml`）；DSH Desktop 建立該 profile 之前為 `$DSH_HOME/settings.yaml` | YAML | 熱重載 | 非機密的 loopback bearer 佔位符 |
| MiniMax Code | `~/.minimax/config.yaml` | YAML | 新 sessions，或開啟模型選擇器後 | loopback 佔位符 |
| Prime Agent | `~/.prime/agent/models.json` | JSON | 新 sessions | loopback 佔位符 |
| ZCode | `~/.zcode/v2/provider_config.json`（schemaVersion 1）；舊版備援路徑：`~/.zcode/v2/config.json` | JSON | 重新啟動時 | loopback 佔位符 |
| Aside | `~/.aside/u/<account>/models.json` | JSON | 完全結束並重新開啟 Aside 後 | loopback 佔位符 |
| Raycast | `~/.config/raycast/ai/providers.yaml` | YAML | 儲存後立即生效——Raycast 會監看該檔案 | 無——僅限 loopback |
| omo (Pi / senpi) | `~/.omo/agent/models.json` | JSON | 新工作階段 | loopback 佔位符 |
| Qoder | `$QODER_CONFIG_DIR` 下的 `settings.json`，預設 `~/.qoder` | JSON | 新工作階段 | loopback 佔位符 |
| Qoder CN | `$QODERCN_CONFIG_DIR` 下的 `settings.json`，預設 `~/.qoder-cn` | JSON | 新工作階段 | loopback 佔位符 |
| WorkBuddy (CN) | `~/.workbuddy/models.json` | JSON | 自動重載／新工作階段 | loopback 佔位符 |
| WorkBuddy AI | `~/.workbuddy-ai/models.json` | JSON | 自動重載／新工作階段 | loopback 佔位符 |
| Cline CLI | `~/.cline/data/settings/providers.json` 及同層的 `models.json` | JSON 組 | 結束並重新啟動 Cline 後 | loopback 佔位符 |
| Kilo | `~/.config/kilo` 下最先存在的 `kilo.jsonc`、`kilo.json`、`opencode.jsonc`、`opencode.json` 或 `config.json` | JSONC | 新工作階段 | `OPENCODEX_KILO_API_KEY` |
| Command Code | `~/.commandcode/providers.json`（Windows 使用預設家目錄時：僅當 `HOME ?? USERPROFILE` 的值非空、非純空白且為 Windows 絕對路徑時使用，否則使用 `homedir()`；另行傳入的家目錄保持不變；附加 `.commandcode\providers.json`） | JSON | 下次啟動 Command Code 時 | 無——無金鑰迴路（`apiKey: false`）；桌面應用程式需要自行登入，opencodex 絕不寫入 `auth.json` |
| Factory Droid | `~/.factory/settings.json`（Windows 上為 `%USERPROFILE%\.factory\settings.json`） | JSON | 透過檔案監看立即生效 | 無——無金鑰迴路 |
| T3 Code | `$T3CODE_HOME/userdata/settings.json`（預設 `~/.t3/userdata/settings.json`） | JSON | 立即生效——T3 Code 會監看該檔案 | 非機密 loopback 標記 |

從 CLI 執行 `ocx integration client enable|disable --client <id>` 只會變更這台機器，與儀表板開關相同。在使用路由意圖（route intent）的 Remote Link Home 上，該變更會記錄為 Home 自己的決定，因此 `ocx sync` 會保留它，而連結的 Children 則保留其預設值。若要變更 Children 繼承的值，請使用 `ocx route to <client> on|off`。在 Remote Link Child 上，一般的開關會被拒絕並印出該裝置的 Home 指令；若要在該處將該 Child 退出路由，請使用 `ocx route to <client> off --local`。見 [Remote Link](/zh-tw/guides/remote-link/#依裝置指定用戶端路由)。

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
只在偵測到 LazyCodex 時才顯示，說明見 [omo（Codex / LazyCodex）角色模型](#omocodex--lazycodex角色模型)。
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

### Qoder CN 與 WorkBuddy 版本

在 **Connect** 中啟用 **Qoder CN**、**WorkBuddy (CN)** 或 **WorkBuddy AI**，然後在用戶端的自訂模型選擇器中
選擇一個 OpenCodex 模型。代理必須保持執行。首次啟用會儲存一份快照；停用只會移除產生的片段，
而 Undo 會還原該快照。既有的模型與無關設定皆保持不變。這些連線各自獨立於 Global Qoder 與彼此之間。

相同的操作也可透過 CLI 執行（若為其他版本，請將 `workbuddy` 替換為 `workbuddy-ai` 或 `qoder-cn`）：

```bash
ocx integration client enable --client workbuddy
ocx export --client workbuddy --json
ocx integration client disable --client workbuddy
```

Qoder CN 會遵循 `QODERCN_CONFIG_DIR`。兩個 WorkBuddy 版本都會依序遵循原生的
`WORKBUDDY_CONFIG_DIR`，再遵循 `CODEBUDDY_CONFIG_DIR`；未設定覆寫時會保留表格中的地區根目錄。
覆寫值必須是絕對路徑、`~`，或以 `~/` 或 `~\` 開頭。WorkBuddy 的舊版陣列設定與物件形式的 `models` 清單
皆受支援。如果既有的 `availableModels` 限制排除了 OpenCodex 模型，請在啟用前先在 WorkBuddy 中移除該限制。
專案層級的設定可以覆寫使用者層級的模型。

這些連線需要無驗證的 loopback 監聽器；不會把任何上游憑證複製到這些用戶端中。
WorkBuddy 會收到完整的 Chat Completions URL 與 OpenCodex 目錄宣告的能力。
若其模型選擇器尚未重新載入，請重新啟動用戶端或開啟新的工作階段。
設定／生命週期測試並不代表保證與每個上游模型或每個用戶端版本端對端相容。

Doubao Desktop 與 Devin 目前在這項整合中沒有經過驗證的任意供應商設定契約。
它們沒有啟用開關；單靠加入本機 JSON 檔案不會讓它們的模型選擇器讀取它。

Qoder IDE / qodercli 支援透過儀表板與 CLI 進行匯出與受管設定：

```bash
ocx export --client qoder --json
ocx integration client enable --client qoder
ocx integration client disable --client qoder
```

Qoder 在設定了 `QODER_CONFIG_DIR` 時會使用該目錄下的 `settings.json`，否則使用 `~/.qoder/settings.json`；
相對路徑的 `QODER_CONFIG_DIR` 會被拒絕。啟用僅合併 `providers.opencodex`，並保留其他供應商、自訂模型與設定。
模型只會在供應商目錄中出現一次；在 `modelConfigs.customModels` 中重複它們會導致 Qoder 拒絕該供應商。
重新整理較舊的受管整合會移除它所記錄的重複列；使用者編輯過的列仍視為衝突。
停用會移除已記錄的 OpenCodex 項目；還原則使用既有的快照工作流程。該供應商的預設模型是已排序匯出清單中的第一個模型。
若 `modelConfigs.customModels` 中針對某個已匯出模型已經存有非 OpenCodex 寫入的 `opencodex` 列，
啟用、重新整理、覆寫與停用都會回報衝突並讓檔案保持不變；請先在 Qoder 設定中移除或重新命名該列，再重試一次。
其他供應商或匯出清單以外模型的列會保持不動。
供應商模型會使用其目錄中的 `contextWindow`，若無則回退至 128000 個輸入 token。
重新整理既有整合後請重新啟動 Qoder，以重新載入供應商登錄檔。
產生的 API 金鑰為非機密佔位符：Qoder 整合需要 loopback 存取，並會拒絕已驗證的非 loopback 繫結。
當專用的無驗證 loopback 監聽器啟用時，匯出會把 Qoder 指向該監聽器。
與其他受管用戶端相同，`ocx sync` 與目錄變更會重新整理已啟用的 Qoder 整合。
包含 `,` 或 `]` 的模型 ID（例如 `kimi/k3[1m]`）會與其他模型一樣正常匯出。

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
具有努力階梯的模型會宣告該階梯，因此 T3 Code 會提供其努力強度控制，並能在指定努力強度下於該模型上啟動子代理。
它會出現在 T3 Code 模型選擇器的 **opencodex** 底下。T3 Code 會自行重新載入該檔案，所以不需要重新啟動；
目錄變更與 `ocx sync` 會重新整理該實例。

T3 Code 在設定了 `T3CODE_HOME` 時把資料放在該處，否則放在 `~/.t3`。若你搬動了它，請在 opencodex 處理程序上設定同一個變數；
相對值會被拒絕。在 Windows 上，請使用完整限定的磁碟機路徑（`C:\shared\t3`）或 UNC 路徑（`\\server\share\t3`）；
沒有磁碟機的路徑，例如 `\shared\t3` 或 `/shared/t3`，會被拒絕。`~` 會依有效的使用者 home 展開。
標記不是憑證，所以此整合需要迴路存取，並且會拒絕已驗證的非迴路綁定，除非啟用了未驗證的迴路監聽器。

請把這個實例視為 opencodex 的。在 T3 Code 中把它的某個變數標為**敏感**、替它加入自訂模型，或將它關閉，都會改寫該區塊。
開關這時會顯示衝突，而不是覆寫你的編輯，並由**取代**還原產生的區塊。若要使用不同的設定，請在 T3 Code 中於它旁邊加入你自己的 Claude 實例。

產生的目錄只包含每個 provider 選擇中已啟用的模型。這適用於下載檔案，也適用於受管理整合，
包括 Pi 與 Aside。管理端的模型清單仍會顯示完整名單，方便你啟用更多模型。

`ocx uninstall` 在刪除 OpenCodex 的復原狀態之前，會先停用已記錄的整合（包含所有受擁有的 Aside 設定檔）。
無法讀取的所有權、遺失的設定檔登錄或衝突的編輯都會中止該刪除操作。清理是依序執行的：
當較後面的停用失敗時，前面已成功的停用不會被復原。若補償動作也失敗，用戶端檔案可能會留在中間狀態。
重試之前，請先檢查回報的用戶端檔案與保留的復原快照；保留的狀態並不代表每個用戶端都已還原或保持未變更。

對於 Gajae 內建預設集，請將路由選擇保留在 `~/.gjc/agent/config.yml`：

```yaml
modelProfile:
  proxyProvider: opencodex
  proxyMode: always
```

請保留你選取的 `modelProfile.default`，以便在直接執行 `gjc` 時套用。受管整合僅擁有 `models.yml` 中的 `providers.opencodex`；
重新整理或停用該供應商不會改寫你的預設集選擇。變更匯出的模型選取後，請重新整理整合。

具有受支援推理強度階梯的 GJC 模型會匯出 `reasoning: true`、`thinking.levels` 與 `compat.supportsReasoningEffort`，讓 GJC 提供強度選擇。原生 Codex 模型即使未在目錄中列出階梯，也會取得標準階梯。沒有已知階梯的模型會省略這些欄位；`none` 與 `ultra` 不會列為選項，因為 `none` 不傳送強度，而 `ultra` 在傳輸時會折疊成 `max`。重新整理整合即可更新這些模型選項。

受管理的 OpenCode 整合擁有兩個片段：`provider.opencodex`（opencode V1）與
`providers.opencodex`（opencode V2）。兩者都帶有相同的逐模型推理選項與預設值——舊版區塊在
options 中拼寫模型的預設值並以 variant map 表示選項，V2 區塊則使用模型的 settings 與原生
variant 陣列——因此兩者都會寫入並保持同步；它們指名相同的 provider 與 model id，opencode V2 會把它們合併
成一個 provider 項目。Apply、Refresh、Disable 與 Restore 會同時作用於這兩個片段，你的其他
provider、agent、按鍵綁定與 MCP 項目都不會被動到。

這兩個片段都由實際生效的規範模型中繼資料建構而成——Kilo 匯出與 `ocx opencode` 啟動器亦同。
明確的自訂覆寫永遠優先，而你清空為空的階梯也會維持空白；絕不會為未宣告任何階梯的模型憑空捏造推理階梯或預設值。
權威的 context 上限會附帶一個輸出預算：已知的輸出值（無論明確指定或來自目錄中繼資料）優先，
否則使用 schema 要求的 32000 回退值並夾限在 context 範圍內；若沒有權威的 context 上限，則整個 limit 區塊都會省略。
能力、努力階梯、預設值與選用的輸入上限只有在已知時才會出現；V2 區塊的原生能力物件需要已知的 tools 值，
因此當工具支援狀態未知時會整個省略而非部分寫入，並保留舊版的模態宣告。
「不憑空捏造階梯」仍會寫入控制項，但絕不寫入選項：V2 區塊一律帶有明確的 variant 陣列——未宣告任何項目時為空陣列，
因為省略該陣列會讓 OpenCode 自行合成 low/medium/high——而已知具備固定推理能力但沒有可調階梯的模型，
會取得僅停用的抑制設定，而非努力選項：舊版 OpenCode 區塊與 Kilo 都會停用用戶端原本會產生的每一個階梯 ID。
兩者都不會新增可選的努力強度。可選的 variant 會覆寫逐模型的預設值——包含 `none`，
但僅在模型自身宣告的階梯包含它時才會提供。不論用戶端選擇什麼，代理端固定的上游推理政策仍會主導送出的請求。

受管理 DSH 支援的相容性下限是 **DSH 0.1.0-rc.6**。DSH 0.1.7 及以上版本從
`$DSH_HOME/profiles/desktop/cordis.patch.yml` 中的 `[id=llm-pi-ai].config.providers.opencodex` 列讀取 provider 路由，DSH 會熱重載該檔案。
Desktop profile 與補丁都存在時，OpenCodex 會寫入該列。若 `$DSH_HOME/profiles/desktop/package.json` 存在但缺少 `cordis.patch.yml`，Apply 會拒絕執行：請建立內容為 `[]` 的 `cordis.patch.yml`（DSH 為新 profile 寫入的空補丁），然後重新啟用整合；僅在沒有 Desktop profile 時，OpenCodex 才使用
`$DSH_HOME/settings.yaml` 中的 `llm-pi-ai.providers.opencodex`。OpenCodex 只擁有該供應商片段：Apply 與 Refresh 會取代該片段，Disable 只移除該片段，
Restore 則放回已記錄的快照。這些操作不會改動使用者的
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
免費方案下檔案仍會被寫入，但 `ocx integration client status --client raycast` 與 **Connect** 頁面
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

OpenClaw 有數個環境變數，各自負責不同的工作。`OPENCLAW_CONFIG_PATH` 選擇檔案；`OPENCLAW_STATE_DIR`、`OPENCLAW_PROFILE` 與 `OPENCLAW_HOME` 選擇狀態目錄，而偵測看的也是狀態目錄——所以 profile 或搬移過的家目錄仍會被視為已安裝，而 config 路徑覆寫只移動檔案。如果你還在用舊的 `.clawdbot` 設定，那也會被找到：現代目錄存在時勝出，只有舊目錄存在時才使用舊的。

在 Windows 上，要求絕對路徑的覆寫值必須包含磁碟機代號（`C:\Users\me\client`）或 UNC 共用（`\\server\share\client`）。沒有磁碟機的根目錄形式，例如 `\Users\me\client` 和 `/client/config`，依賴目前的磁碟機，因此會被拒絕。文件中標明支援 `~` 的選擇器仍依有效家目錄展開；Gentle Shell 不展開 `~`。

這些必須是**絕對路徑**或以 `~` 開頭。相對路徑會被拒絕而非解析，因為它會指向各程序恰巧啟動時所在的目錄——而該路徑會與備份一起儲存，所以它明天必須指向與今天相同的檔案。

opencodex 從自己的環境讀取這些變數。如果你的 gateway 以 profile 或搬移過的家目錄執行，請以相同的變數啟動 opencodex，否則它會正確地遵循另一個安裝。

## 其他五個介面不是開關

**API Keys** 管理 opencodex 自己的憑證，根本不是客戶端。**Codex CLI** 由 proxy 服務本身連接——啟動 opencodex 即套用，停止即回復原生路由——所以沒有什麼需要逐檔切換。**Claude** 保留自己的啟用旗標與 Desktop 的 Save/Apply 流程，**Grok Build** 保留其先選後套用的模型圍欄（model fence）。那些語意早於這項功能，且維持不變。**Cursor** 完全不會寫入任何內容：其分頁會顯示偵測結果、gateway 值，以及最近一次看到的請求，其餘則在 Cursor Private Inference 內部進行。

## 回復（Rollback）

每次成功的寫入都會*先*為你的檔案拍快照，所以你原本的狀態永遠可以回復：

- **Undo** 會出現在最新操作上，當你的檔案仍與我們寫入的內容相符時。
- **Restore this point…** 會出現在較舊的操作上，或當檔案在那次操作之後有變更時。跨過這樣的變更做回復會再詢問一次，才覆蓋你的較新編輯——並且也會備份它們，所以那次的回復本身也可以復原。
- 每個客戶端保留十份備份。超過之後，最舊的快照檔案會被移除，其歷史列顯示為 **Backup expired**。

停用只移除 opencodex 記錄為自己寫入的條目。如果你的檔案在我們寫入之後有變更，後續行為取決於我們自己的條目是否完好，以及檔案的格式。對於嚴格 JSON 設定檔（OpenCode、Pi），在我們的區塊**旁邊**進行的編輯——例如新增 MCP 伺服器或你自己的 provider——會顯示為**需要更新**：重新整理會在保留你的條目的前提下合併寫入，但格式可能會被正規化。例外情況是 JSON 無法精確重寫的內容——例如 `1e999` 這類非有限數字、重寫會被四捨五入的數字（極大的整數，或小到會塌縮成零的數字）、`-0`、同一個物件裡重複出現的鍵，或巢狀層數超過 1000 層——此時開關會鎖定，確保沒有任何值被悄悄改動或刪除。**OMP、DSH 與 Hermes** 同樣不受旁邊編輯影響，但原因不同：它們的 writer 只逐位元組修補自己管理的 provider 片段，檔案其餘部分從不會被重寫。至於其餘可以包含註解的格式（OpenClaw、Kimi Code、gjc、MiniMax Code、Raycast——以整份文件寫出的 JSON5 與 TOML，或不保留原始碼的一般 YAML），或當我們自己的條目被編輯過時，開關會鎖定，停用會拒絕執行，而不是猜測哪些編輯是你的。

這個鎖定不再是死路。發生衝突的客戶端會在開關旁邊顯示 **Replace**，同時出現在概覽卡片與客戶端自己的頁面上。它會用 opencodex 要寫入的區塊取代目前持有我們設定的內容，而且會先詢問：對話框會指名檔案、說明會遺失什麼內容，並指出讓該次操作可復原的快照。開關本身仍維持鎖定，因為開關無法知道你想保留哪些編輯——只有你能決定。除此之外沒有放寬任何限制：無法剖析的檔案，或無法推論其結構的檔案，仍然會拒絕。

## Hermes session 親和性

產生的 `providers.opencodex` 區塊為所有模型加入 `session_affinity_header: session-id`。
請保留這個產生的預設值，除非你刻意只想要日誌關聯（log-only correlation）：把 `session_affinity_header`
從 `session-id` 改成 `x-hermes-conversation-id` 會替換 Hermes 送出的標頭。由於 OpenCodex 嚴格把
`x-hermes-conversation-id` 視為請求日誌關聯的回退欄位，而非原生的路由或回合終止識別，
切換成 `x-hermes-conversation-id` 會在請求日誌中關聯代理迴圈的同時，移除原生的工作階段親和性與車道指派。
這只是指名一個標頭；實際的動態對話識別碼由 Hermes 提供。OpenCodex 不會寫入共用的靜態識別碼，
也不會改動 `api_mode` 來啟用親和性。

請使用支援 [per-provider request options](https://hermes-agent.nousresearch.com/docs/user-guide/configuring-models#per-provider-request-options)
的 Hermes 版本。較舊版本可能會忽略或捨棄該選項；設定本身有效並不能證明 Hermes 真的送出了這個標頭。
對話隔離、compaction lineage 與輔助／子請求都依循 Hermes 自身的親和性語意。此設定不保證特定的快取命中率。

對於既有的受管整合，開啟 **Connect → Hermes**，檢視 **Apply** 並確認更新。在此之前，
它會顯示為**需要更新**，且隱含的 catalog 重新整理不會變更它，包括其模型清單。單純讀取此頁不會
升級設定。Apply 之後，正常的 catalog 重新整理會恢復並保留此設定；**Replace** 也會包含它。

如果你已經在受管區塊內精確加入 `session_affinity_header: session-id`，只要其他受管設定仍與
所有權記錄相符，Apply 就能接納它。這是上述衝突規則的唯一例外：其他編輯、不同的標頭名稱，
或沒有相符所有權記錄的區塊，仍需要衝突處理。無關的 YAML 設定與註解不受影響，既有的快照與
Restore 流程同樣適用於這次升級。

## Hermes 設定檔

Hermes 會為每個 bot 設定檔各自保留一個家目錄。預設設定檔使用
`~/.hermes/config.yaml`（在 Windows 上為 `%LOCALAPPDATA%\hermes\config.yaml`，或 `$HERMES_HOME/config.yaml`），
而每個以 `hermes profile create <name>` 建立的具名設定檔則使用
`<Hermes home>/profiles/<name>/config.yaml`。詳見 Hermes 的
[profiles guide](https://hermes-agent.nousresearch.com/docs/user-guide/profiles)。

當存在具名設定檔時，**Connect → Hermes** 會列出每個設定檔及其各自狀態。選取一個設定檔即可單獨對該設定檔執行
套用、停用、取代或復原 OpenCodex；每個設定檔都會各自保留自己的備份與回滾歷史，其餘設定檔保持不變。
每個設定檔都會保留自己的 `model.default` 與其他供應商：OpenCodex 只新增 `providers.opencodex`。
若沒有具名設定檔，此頁面的運作方式與先前相同，並變更預設設定檔。

目錄變更與 `ocx sync` 只會自動重新整理從執行中代理的環境（包含 `HERMES_HOME`）解析出的預設設定檔。
具名設定檔會保留其先前的目錄。變更模型選取後，請開啟 **Connect → Hermes**，選取每個顯示
**Update needed** 的具名設定檔，然後檢視並確認 **Apply**。CLI 沒有具名設定檔選擇器。
在目錄未變更的情況下，即使編輯了 `providers.opencodex` 以外的註解或設定，重新整理仍會保持 **Current**；
它既不會變更檔案，也不會變更已記錄的基準線。當有目錄更新等待套用時，自動重新整理會拒絕任何自上次 Apply 後曾被變更的 Hermes 檔案，
包括那些無關的編輯。當目錄顯示 **Update needed** 時，請檢視並 Apply 待處理的目錄變更以恢復自動更新。
在目錄未變更時執行 Apply 會是無動作（no-op），且不會接受新的檔案基準線。

管理 API 在 `/api/client-integrations/hermes` 上以 `profile=<name>` 選取設定檔，並在預覽、日誌與復原端點上使用
`client=hermes&profile=<name>`；`GET /api/client-integrations/hermes/profiles` 會列出所有設定檔。
`profiles/` 底下的目錄只有在 Hermes 也會列出它時才會計入：有效名稱、例如 `config.yaml` 或 `SOUL.md` 等 Hermes 身分檔案，
且沒有刪除標記。經由符號連結或聯接點（junction）到達的設定檔不會被列出。若 `HERMES_HOME` 之後指向不同的 Hermes 家目錄，
該處同名的設定檔在解除連線原本的那一個之前會被拒絕，讓 OpenCodex 絕不會遺失它所變更檔案的追蹤。

## 預覽並確認變更

在儀表板中，套用、取代、停用與回復都會先顯示預覽。對話框會明確列出哪些受管理的設定將會變更，
包括範圍有限的變更路徑，以及每項變更是新增、更新或移除值。請先檢視計畫，再進行確認。

當計畫顯示沒有變更時，表示受管理的用戶端文件已處於要求的狀態。對選取的 Aside 設定檔，
即使受管理的文件沒有變更，確認後仍可能儲存該設定檔的同步偏好。

如果檔案在你檢視後又有變更，寫入會因計畫過期而被拒絕。對話框會用更新後的計畫取代舊
計畫，並要求你再次明確確認；它絕不會自動重試寫入。如果預覽表示尚未載入模型目錄，對話框會保持開啟並
提供 **Load catalog and retry**：它會再次讀取整合清單——即保留目錄的一般載入，絕不會執行收集模型的預覽——然後再重新要求計畫。

Aside 會對一次選取的單一設定檔使用相同的預覽與確認流程，且一份計畫只精確描述該設定檔的檔案。
由於單一計畫無法描述多個各自獨立變更的檔案，處於衝突狀態的 Aside 概覽卡片會以 **Choose profile** 開啟 **Connect → Aside**，
而非直接提供取代動作；請在該設定檔自己的頁面取代區塊。**Sync all profiles** 仍是獨立的批次操作，
不會綁定到單一合併預覽。

## 誠實的預期

如果產生的受管路徑無法安全地表示，該用戶端會回報不安全狀態，且其預覽會拒絕該操作。嘗試套用、覆寫或停用會回傳 HTTP 409，且不變更設定。其他用戶端仍可使用。

**受管理的設定檔大小上限為 4 MiB（4,194,304 UTF-8 位元組）。**
共用的整合讀取器會將較大的檔案視為不安全讀取而拒絕，而寫入器在合併後的設定超過相同上限時也會以 `write_failed` 拒絕，
並讓原本的設定保持不變。Cline 的復原標記也有此上限；它包含兩個檔案變更前後的內容加上中繼資料，
因此即使個別檔案小於 4 MiB，Cline 仍可能觸及此上限。

請先自行備份用戶端設定，再移除不需要的項目或縮減匯出的模型清單後重試。**Replace** 不會繞過此上限。
如果設定檔必須維持較大體積，請改為手動管理，而不要使用 Connect 開關。

**格式通常不會被保留。** 套用會解析設定並重新寫出，所以 JSON、JSON5 與 TOML 可能被重新格式化，JSON5 或 TOML 中的註解會遺失。OMP、DSH 與 Hermes 是例外：OMP 與 Hermes 只修補 `providers.opencodex`；DSH 在有 Desktop profile 補丁時只修補其中的 `[id=llm-pi-ai].config.providers.opencodex`，沒有 Desktop profile 時則只修補 `settings.yaml` 中的 `llm-pi-ai.providers.opencodex`。它們的 YAML writer 會逐位元組保留無關的 provider 註解與格式。如果無法安全地識別那個確切的來源範圍，操作會拒絕執行。對其他客戶端，當你需要先前的檔案位元組時請使用 Restore：快照是逐字的副本。

**如果某個值無法忠實重寫，開關會拒絕執行。** 往返覆蓋這些格式在實務上會用到的值種類；當它做不到時——例如使用 `inf` 或 `nan` 的 TOML 檔案，我們可用的 parser 無法準確讀回——套用會停止並說明，而不是寫入被改動的值然後宣稱成功。你會看到檔案被指名，磁碟上沒有任何東西被移動。手動編輯那個檔案仍然有效；只有我們的自動重寫會拒絕。

TOML 日期與時間值也會阻止受管理的重寫：合併步驟會將這些帶有型別的值轉成加引號的字串，這也包括陣列與行內表格中的值。原本就加引號的日期字串仍受支援；若要保留不加引號的日期型別，請手動編輯設定。

**Pi、Kimi Code、gjc、MiniMax Code、Prime Agent、Aside、Raycast、omo 與受管理 DSH 整合只能對 loopback bind 運作。** 前四者的設定沒有非 loopback bind 所需的 `x-opencodex-api-key` header 欄位。DSH 雖然提供通用 headers map，但 rc.6 並未把這個專用准入 header 記錄為受支援的整合契約，因此受管理 writer 會選擇安全拒絕，而不自行猜測。Prime Agent 的 provider 區塊確實接受 headers，但遠端憑證連線設定在最初的整合中被延後。請改用 SSH tunnel，或由本機 forwarder 加上該 header 後再以 loopback 存取。

**產生的 OMP 整合也刻意只支援 loopback。** OMP 確實支援 provider 層級的 headers，但這個最初的整合不會發出遠端 `x-opencodex-api-key` 憑證連線。手動的遠端 OMP 設定目前不在受管理的整合範圍內。

**Kimi Code 無法持有環境變數參考，** 所以它的設定攜帶的是 `opencodex-loopback` 佔位符而非金鑰。絕不會有任何真實憑證被寫入任何客戶端設定。

**對 `ocx opencode` 而言，launcher 的 provider 區塊勝出。** 那個 launcher 透過 `OPENCODE_CONFIG_CONTENT` 注入 `provider.opencodex` 與 `providers.opencodex`，比磁碟上相同的條目優先——你其餘的 opencode 設定仍照常套用。那些區塊是使用與匯出相同的有效規範模型中繼資料建構而成，因此啟動器與受管理整合描述的是相同的模型、上限與推理選項。當你直接啟動 `opencode` 時，這裡的開關才是關鍵。

## 從終端機

相同的操作也可以無頭（headless）方式執行：

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

### 預覽並繫結終端機寫入

既有的直接指令仍然受支援。若要將寫入繫結到已檢視的觀測結果，請先檢查狀態並儲存預覽：

```bash
ocx integration client preview --help
ocx integration client status --client hermes --json
ocx integration client preview --client hermes --operation apply --json > hermes-preview.json
```

檢視 `state`、`foreignEdit`、結構化的 `changes`、`canApply` 與 `willChange`。
有效的拒絕計畫與無變更計畫都會以 0 結束，因為檢查已成功且未套用任何內容。
計畫不包含機密值或完整檔案 diff，且僅使用現有的被動目錄證據，絕不暗中重新整理供應商。
若目錄不可用，請先另行解決目錄可用性問題，再重新要求預覽。

只有在檢視可套用的計畫並決定執行寫入之後，再執行：

```bash
PLAN_FINGERPRINT="$(jq -er 'select(.canApply == true) | .fingerprint' hermes-preview.json)"
ocx integration client enable --client hermes --plan-fingerprint "$PLAN_FINGERPRINT" --json
ocx integration client status --client hermes --json
```

指紋（fingerprint）是並行證據，而非授權。提交接受 `pN:` 後接 32 個小寫十六進位字元；
被拒絕的 `pN:unbound` 無法提交。請重複提供完全相同的用戶端／動作／設定檔／選項。
預覽的 `overwrite` 對應到帶 `--overwrite-conflict` 的 `enable`；預覽的 `disable` 對應到 `disable`。
過期的提交會以結束碼 5 離開，在 stderr 印出重新預覽的指引，並讓 stdout 保持空白。
它絕不會自動採用替代指紋或重試。其他失敗會使用結束碼 2（用法錯誤）、4（找不到）或 1（執行期／格式錯誤），
並輸出安全的 stderr 訊息而非 JSON 錯誤封套。

### 取代前先檢查還原漂移

請使用真實的歷史 `opId`；下方的 `op-example` 為虛構範例：

```bash
ocx integration client history --client aside --profile 1 --json
ocx integration client restore --op op-example --client aside --profile 1 --preview --json
```

若因漂移而被拒絕，請先檢查編輯內容。當你明確打算取代這些編輯時，請先加上 `--confirm-drift` 進行預覽、
檢視後再繫結相同的意圖：

```bash
ocx integration client restore --op op-example --client aside --profile 1 --preview --confirm-drift --json > restore-preview.json
```

檢視後執行：

```bash
RESTORE_FINGERPRINT="$(jq -er 'select(.canApply == true) | .fingerprint' restore-preview.json)"
ocx integration client restore --op op-example --client aside --profile 1 --confirm-drift --plan-fingerprint "$RESTORE_FINGERPRINT" --json
ocx integration client status --client aside --profile 1 --json
```

Aside 的預覽／繫結寫入必須指定單一設定檔，不可使用彙總目標。一般的 restore 會省略 client/profile；
伺服器會從 `opId` 推導出非 Aside 用戶端。回傳的計畫不會包含 `opId` 或所有原始指令輸入，因此請保留該上下文。
`--preview` 不可與 `--plan-fingerprint` 併用。

### 淘汰舊的復原紀錄

此操作會永久淘汰該紀錄與備份，不會還原或停用整合。在檢查歷史紀錄並決定放棄該復原點後執行：

```bash
ocx integration client history remove --op op-example --client aside --profile 1 --yes --json
ocx integration client history --client aside --profile 1 --json
```

請使用實際選取的 `opId`。沒有任何選擇器可以指向全域日誌；`--client aside` 指向彙總的 Aside 歷史，
加上選用的 `--profile` 可再縮小範圍。其他用戶端選擇器在刪除時會被拒絕。最新一列受到保護。
帶有 `snapshotRemoved:false` 的收據代表已提交淘汰但清理未完成，並以 1 結束；
這不是回滾，也不可重複觸發刪除。`journal remove` 是它的別名。

`--overwrite-conflict` 是 **Replace** 的終端機形式：

```bash
ocx integration client enable --client zcode --overwrite-conflict
```

與 `--confirm-drift` 一樣，它絕不會被假定套用——不帶此旗標時，衝突仍會被拒絕。
它僅適用於 `enable`；在衝突上強制執行 *disable* 會刪除我們從未寫入的區塊，因此該組合會被拒絕。

對於 MiniMax Code，請先連線供應商一次，再透過經過檢查的包裝器啟動：

```bash
ocx integration client enable --client mcode
ocx mcode
```

一旦連線，設定檔擁有權就會讓 `ocx sync` 與 `POST /api/sync` 以目前的模型選取、context window 與推理強度階梯，
重新整理受擁有的 MCode、Pi、Aside、Raycast、omo、OpenCode、Kilo 與 Hermes 目錄。背景目錄變更也會在無人看管下
重新整理已連線的 Hermes 預設設定檔；若有待處理目錄更新的 Hermes 檔案遭到編輯，則會被拒絕並回報；
從未連線或已停用的整合會保持不動。具名設定檔需要[明確套用](#hermes-設定檔)。代理啟動時會重新整理受擁有的 Raycast 目錄。
模型可見度、供應商選取或預設集的變更，也會重新整理已連線的 Pi、Aside、Raycast、omo、OpenCode、Kilo 與 Hermes 目錄。
缺失、被外部編輯或不安全的區塊會保持不動，你手動移除的先前受擁有區塊亦同。
已啟用的 Aside 設定檔是一般「僅限受擁有項目」重新整理的例外：若其帳號目錄存在且從未有過受擁有區塊，
當該插槽為空時，同步可能會建立它的第一個區塊。先前的 Aside 連線預設會為所有已註冊設定檔啟用此行為。
同步不會建立缺失的帳號目錄，也不會取代手動區塊。
被拒絕或重疊的重新整理會依各用戶端分別回報。請開啟新的 Pi、OpenCode 或 Kilo 工作階段，
或完全結束並重新開啟 Aside，以載入更新後的檔案。Aside 重新整理需要[相容的執行中代理](#aside-設定檔控制)。

如果 Models 回報 **“Model selection saved”** 並伴隨用戶端重新整理警告，代表選取本身已經儲存；
只是有一個或多個用戶端檔案無法更新。該警告會指名受影響的用戶端與 Aside 設定檔（若適用），並說明拒絕原因。
開啟 **Connect** 先檢查該用戶端或設定檔，再開始新的工作階段。解決回報的問題後，再重試 `ocx sync`；
若有重疊中的操作，必須先等它完成。若警告包含備份路徑或表示復原未完成，請在重試前先檢查該復原狀態。
單靠選取儲存成功，並不能確認用戶端檔案已完成復原。

獨立的 MiniMax 平台 CLI（`mmx`）不是檔案切換式的整合。它的文字指令使用 MiniMax 的 Anthropic 相容端點，
因此 OpenCodex 提供了一個憑證隔離、僅限 loopback 的啟動器：

```bash
ocx mmx text chat --model anthropic/claude-opus-5 --message "Hello"
ocx mmx text repl --model openai/gpt-5.6-sol
```

只有 `mmx text chat` 與 `mmx text repl` 會經過代理。執行原生 MiniMax 的圖片、影片、語音、音樂、視覺、
搜尋、配額、認證、設定、檔案與更新指令時，請直接執行純 `mmx`。此包裝器使用僅含非機密 loopback 佔位符的暫存設定；
它絕不會載入你的 `~/.mmx` OAuth 或 API 金鑰憑證，且會拒絕 `--api-key`、`--base-url` 與 `--region` 覆寫。
完整工作流程與限制請見 [MiniMax 用戶端](/zh-tw/guides/minimax/)。

`--confirm-drift` 絕不會被假定套用。如果你正在還原的操作之後檔案已有變更，指令會拒絕並告知你，
因為是否取代你較新的編輯必須由你自行決定。

各用戶端的詳細資訊皆已對照各專案自身的設定格式驗證；檢查項目與時間請見研究筆記
`devlog/_fin/260802_client_toggle_api/002_client_toggle_matrix.md`。

## Aside 設定檔控制

Aside 設定檔控制以及由 `ocx sync` 執行的 Aside 重新整理，需要一個支援 Aside 設定檔 API 的執行中 ocx 代理。
僅更新 CLI 並不會更新已在執行中的代理。若代理無法連線或版本過舊，Aside 操作將無法完成；
CLI 絕不會退回由本機直接寫入 Aside 設定檔。

請升級代理所使用的 ocx 安裝，然後重新啟動代理（若已停止則啟動它）。再重試 `ocx sync` 或設定檔指令。
設定檔成功更新後，請完全結束並重新開啟 Aside，讓它載入新的目錄。

```bash
ocx integration client status --client aside --json
ocx integration client enable --client aside
ocx integration client disable --client aside --profile 1
ocx integration client history --client aside --profile 1
ocx integration client restore --client aside --profile 1 --op <opId>
```

設定檔編號是狀態指令顯示的帳號 ID。在 Aside 開關上省略 `--profile` 會將期望狀態套用到每個已註冊的設定檔。
單一設定檔的變更不會影響其他設定檔。期望的同步設定會在變更檔案之前儲存；每個設定檔的實際狀態與任何拒絕原因都會分別回報。
部分成功的批次結果不代表全部套用成功，CLI 會以非零碼結束。Undo 會同時還原所選設定檔的同步意圖與其檔案，
因此後續的同步不會靜默反轉 Undo。

[profile API](/zh-tw/reference/management-api/#aside-profile-controls) 在批次操作全部成功時回傳 HTTP 200；
若有任一設定檔拒絕，則回傳 HTTP 207 並帶有 `ok: false`。請檢查 `results` 中的每個項目：當其他設定檔失敗時，
已成功的設定檔不會被回滾。期望設定仍維持已儲存狀態，因此請在處理完受影響的設定檔後重試，不要誤以為整批變更都失敗了。
若儲存該設定本身失敗，則不會變更任何設定檔。

若要針對符合資格的 Aside 設定檔進行鎖定重新整理，而非廣域的目錄同步：

```bash
ocx integration client sync --client aside --json
ocx integration client status --client aside --json
```

這會使用既有的已驗證 Aside 擁有者，沒有設定檔選擇器或本機回退路徑。`{results:[]}` 會以 0 結束，
代表沒有符合資格的設定檔，而不是已套用寫入。任何失敗的列都會回傳結束碼 1，同時已成功的設定檔維持已更新。
請保留逐設定檔的拒絕、殘留狀態與獨立標記的遮罩備份資訊；在重試前先檢查受影響的設定檔。
此重新整理與各設定檔的預覽／繫結變更工作流程是分開的。

同步只會重新整理同步偏好為開啟的設定檔，因此空結果不是失敗。若 `ocx integration client status --client aside`
顯示某個設定檔為 `off (stale)`，狀態輸出會印出重新連線它的指令：請檢視
`ocx integration client preview --client aside --operation apply --profile N`，並且只有在預覽允許變更且你接受時，
才執行 `ocx integration client enable --client aside --profile N`。不會有任何項目被自動重新啟用。
`config.json` 中格式錯誤的 `asideProfileSync` 區塊會關閉所有設定檔，並在載入設定時記錄警告。

每個設定檔各有獨立的所有權與歷史。既有的使用者編輯、不安全的路徑與連結的目錄都會被拒絕；
既有的明確覆寫與漂移確認控制仍可使用。請完全結束並重新開啟 Aside 以載入已變更的模型檔案。

## ZCode 3.14 以後

預設情況下，ZCode 3.14 將其自訂供應商儲存在 `~/.zcode/v2/provider_config.json`，而讓 `~/.zcode/v2/config.json`
僅能透過在新檔案遺失時執行的一次性匯入來觸及。ZCode 在首次執行時就會建立新檔案，因此在任何曾經啟動過的安裝上，
該匯入都已經耗盡，寫入 `config.json` 不會觸及任何東西。

ZCode 可以透過 `~/.zcode/v2/setting.json` 中的絕對路徑 `dataBaseDir` 重新定位其資料根目錄。
此引導檔案（bootstrap file）永遠留在預設家目錄底下；供應商儲存區則移動到 `<dataBaseDir>/.zcode/v2/provider_config.json`。
`ZCODE_DATA_DIR` 優先，直接指定 `.zcode` 根目錄；`ZCODE_PERSONAL_PROVIDER_CONFIG_FILE` 則優先指定供應商檔案。
`ZCODE_DATA_BASE_DIR` 是另一個獨立的原生選擇器，不是 `ZCODE_DATA_DIR` 的別名。

無法讀取、格式錯誤或相對路徑的引導設定會讓作用中的根目錄成為未知。引導檔案必須是不超過 4 MiB 的一般檔案；
符號連結與特殊檔案在匯出與整合路徑探索期間會被拒絕。請修復引導檔案，或提供明確的 `ZCODE_DATA_DIR` 來選取預期的資料根目錄。
Apply、覆寫與重新整理會以修復訊息拒絕，而不會宣稱舊版寫入成功。既有的明確供應商檔案仍可確立作用中的儲存區。
記錄在原本預設設定檔或儲存區的所有權會保留其路徑、指紋與復原歷史；停用會先移除該原始區塊，之後的啟用才能使用重新定位後的儲存區。
當另一個路徑擁有該整合時，較舊的復原也會被拒絕。若先前的明確選擇器不再指向受擁有的檔案，請在停用前還原該選擇器；
opencodex 會保留該紀錄並拒絕放棄該區塊。

只要情況允許，opencodex 會直接寫入 `provider_config.json`。啟用整合會將 `opencodex` 供應商規則加入該檔案，
目錄重新整理會更新它，停用則精確移除 opencodex 放進去的內容。檔案中的其他每條規則都保持不動，
包括另一個供應商為同時出現在我們清單中的模型 ID 所保留的規則。帶著 `opencodex` ID 但非 opencodex 寫入的規則屬於衝突，
而非接管對象；請在 ZCode 中解決它，或使用明確覆寫。

無法讀取或非一般檔案的供應商儲存區也會拒絕寫入；它不會被當作允許舊版匯入的缺失儲存區。

另外兩種情況仍會拒絕而非寫入。若 opencodex 套用該區塊後 ZCode 才移動其儲存區，整合會留在 `config.json` 上：
請先在該處停用，再重新啟用以寫入新的儲存區。此外，若 `provider_config.json` 的 `schemaVersion` 不是 opencodex 觀測過的版本，
則會回報而不合併寫入，因為該檔案保存了 ZCode 所有的供應商，強行寫入形狀只會把靜默無效換成靜默遺失。
只要整合沒有寫入該檔案，狀態輸出都會指名 ZCode 讀取的檔案。

在第二種情況下，請在 ZCode 自己的設定中新增供應商：base URL 為 `http://127.0.0.1:10100/v1`（依實際繫結調整連接埠）、
任意非空金鑰，以及來自 `ocx export --client zcode` 的模型 ID。不支援透過刪除 `provider_config.json` 來重新觸發 ZCode 的匯入——那會丟棄 ZCode 保存在那裡的所有供應商。

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
設定，沒有 **Connect** 分頁開關，且與使用 Copilot 訂閱作為 opencodex 後端的上游
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

安裝 LazyCodex 後，omo 分頁會在 Pi 型 omo 控制項下方顯示一個 **omo (Codex / LazyCodex)** 區段，
列出 `$CODEX_HOME/agents/*.toml` 中找到的每個 Codex 代理角色，以及各自釘選的模型。
不論父層要求哪個模型，Codex 都會用該釘選執行角色，所以這裡才是真正決定角色模型的地方。
當 `omo@sisyphuslabs` Codex 外掛在 `$CODEX_HOME/config.toml` 中被啟用，且 `$CODEX_HOME/plugins/cache/sisyphuslabs/omo/`
底下的已安裝副本帶有它的外掛資訊清單或 `lazycodex-install.json` 時，LazyCodex 才算已安裝。
單單一個 `~/.omo` 資料夾不算，因為以 Pi 為基礎的 omo 也會建立它。沒有 LazyCodex 時，該區段會隱藏，
而命令列會回報它未安裝。在某一列選擇模型與推理強度並按 Save。沒有模型釘選的角色那一列可以單獨儲存強度；
該角色會繼續繼承其模型：

- opencodex 只更新該角色檔案根層級的 `model = "..."` 與 `model_reasoning_effort = "..."` 鍵。
  遺失的釘選會在靠近檔案開頭處插入。選擇每一列都有提供的 **Inherit effort** 會傳送 `"effort": null`
  來清除強度釘選，移除該行與其尾端註解。角色的指示、其他註解與其他鍵都完全保持原樣。
- 模型會寫入 `~/.omo/omo.jsonc` 中的 `[codex].agents.<role>.model`，這是 LazyCodex 5.1.1 與更新版本會讀取的位置，
  而變更後且 LazyCodex 支援的強度則會寫入同一項目中的 `[codex].agents.<role>.reasoning`。如果該檔案不存在，不會建立它。
  如果它含有註解，就維持原樣不動，因為儲存會移除它們；分頁會說明這點，你可以自己在那裡設定該值。
  符號連結與非一般檔案會被拒絕；在 macOS 與 Linux 上，FIFO 會直接拒絕而不會等待寫入端。略過鏡像寫入不會復原角色檔案的儲存。

如果角色檔案儲存成功但 `omo.jsonc` 寫入失敗，該列的按鈕會變成 **Retry omo.jsonc**，
它會重新送出相同的強度選擇，包括 **Inherit effort** 清除（`null`）。在該重試成功之前，
後續對該角色執行且未變更強度的 Save 或 Auto-assign Apply 會一併帶上這個待處理的選擇；明確選取的強度則會取代它。

在你按下 Save 之前什麼都不會發生；同步或重新啟動 opencodex 絕不會改變角色檔案。新的 Codex session 會取得變更。命令列上有相同的控制：

```bash
ocx agent roles
ocx agent roles set explorer xai/grok-4.5
```

`ocx agent roles set <role> <model> --effort <level>` 也會設定角色的推理強度：它會插入或取代角色檔案的
`model_reasoning_effort` 值，並在 LazyCodex 有該層級時寫入 `omo.jsonc` 中的 `[codex].agents.<role>.reasoning`
（`ultra` 只留在角色檔案中，既有的較舊 `reasoning` 會被移除）。在 `PUT /api/codex-agent-roles/{role}` 上，
省略 `effort` 會保留既有釘選，傳入層級則設定之，而 `null` 會移除角色檔案的 `model_reasoning_effort` 行、
其尾端註解與 `omo.jsonc` 的 `reasoning`。只變更模型的 Save 會讓兩個強度值保持原樣。
省略 `model` 會讓角色檔案的 `model` 釘選與 `omo.jsonc` 的 `model` 完全保持原樣，因此沒有模型釘選的角色在強度變更或清除時
仍會繼續繼承模型；儀表板對這類列會送出這個僅含強度的請求。當 `omo.jsonc` 可寫入時，該處尚未建立項目的角色
若儲存的強度屬於 LazyCodex 支援的項目，就會建立一個僅含 `reasoning` 的項目（`none` 會寫成 `off`）；
對此類角色而言，清除強度或儲存 `ultra` 不會新增項目。傳入 `null` 模型會以 400 `invalid_model` 拒絕，
因為儲存絕不會移除模型釘選；而既無 `model` 也無 `effort` 的請求會在讀取角色檔案或 `omo.jsonc` 之前以 400 `empty_update` 拒絕。
`ocx agent roles set` 一律需要模型。
只有現有的單行字串值能被移除；多行或非字串值會以 409 `unsupported_model_value` 拒絕，並讓兩個檔案保持不變。
清除只會移除角色自己的覆寫：接著 Codex 會像對待任何沒有覆寫的角色一樣解析強度（明確的啟動值、`[agents]` 預設值或父工作階段），
而非套用固定的模型預設值。

### 自動指派

自動指派是 omo（Codex / LazyCodex）的一部分：它位於該區段的角色表上方，只有偵測到 LazyCodex 時才存在。
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

Kilo CLI、VS Code 與 JetBrains 共用一份全域設定。這項整合只會把 `provider.opencodex` 寫入 `~/.config/kilo` 下
最先存在的檔案：`kilo.jsonc`、`kilo.json`、`opencode.jsonc`、`opencode.json` 與 `config.json`（`XDG_CONFIG_HOME` 會移動該目錄）。
若沒有任何候選檔，目的地會是 `kilo.jsonc`。專案層級的設定絕不會被寫入。
Kilo 會合併所有這些全域檔案。若另一個候選檔也定義 `provider.opencodex`，狀態會指名每個競爭檔案，
且 Apply 與 Replace 都會拒絕；在啟用整合前請先從那些檔案中移除 `provider.opencodex`。無法讀取或不安全的候選檔也會阻擋寫入。
即使另一個候選檔發生衝突或無法剖析，Disable 仍可移除已記錄檔案中由 OpenCodex 擁有的區塊；其他候選檔會保持不動。

OpenCodex 會將這些候選檔視為 JSONC 讀取。`//` 行註解會在 CR、LF 或 CRLF 換行符號處結束，
因此以任一種換行符號儲存的檔案都會保留接在註解後方的設定。

受擁有的片段只有 `provider.opencodex`（OpenCode V1 結構：`npm`、`options`、`models`）。
Kilo 公布的 schema 沒有 OpenCode V2 的 `providers` 鍵，因此不會產生該區塊；取而代之的是，
Kilo 會將逐模型的推理選項作為變體映射（variant map）寫入其供應商區塊內，該區塊使用與 OpenCode 匯出相同的有效規範中繼資料建構而成。
`$schema`、`model`、`enabled_providers`、MCP 與其他鍵仍歸使用者擁有。套用後請在 Kilo 中選擇 `opencodex/<provider/model>`。

Loopback 使用 `{env:OPENCODEX_KILO_API_KEY}` 作為 `options.apiKey`。非 loopback 繫結會把准入移至
`options.headers["x-opencodex-api-key"]`，且絕不序列化真實金鑰。套用會將整個全域檔案重新寫出為排版後的 JSON，
因此其他鍵中的註解與尾隨逗號不會被保留。Kilo 已納入隱含目錄扇出（fan-out）：`ocx sync`、`POST /api/sync`
以及可見度、供應商或預設集的變更，都會依循與其他所有用戶端相同的安全「僅限受擁有項目」規則來重新整理受擁有的 Kilo 區塊，
新的 Kilo 工作階段會載入更新後的檔案。

讀取這些候選檔時，OpenCodex 接受陣列元素或物件屬性後方的尾隨逗號。請將空陣列或空物件寫為 `[]` 或 `{}`；
`[,]` 與 `{,}` 會被視為格式錯誤而拒絕。

```bash
ocx integration client enable --client kilo
ocx export --client kilo --out ./kilo.jsonc
```

## Command Code

Command Code 將其自訂供應商儲存在 `~/.commandcode/providers.json`。這項整合會將 `provider.opencodex`
寫入該檔案，且僅限 loopback 使用。

**寫入哪個根鍵。** Command Code 以 `document.provider ?? document.providers` 解析其供應商映射，
因此只要單數根鍵存在就會優先。因此整合會先讀取目標檔案，並寫入該檔案已經使用的根鍵：
已經帶有 `providers` 映射的文件會保留它，讓你的其他供應商維持可讀。全新檔案則會取得單數的 `provider` 根鍵。
兩個根鍵都宣告為受管理路徑，因此 Disable 會從當初寫入的任一方移除該區塊。

**憑證形式。** 供應商會以 `apiKey: false` 寫入，這是文件記載針對不需要金鑰的端點所使用的形式。
純字串會被 Command Code 拒絕，且這項整合不會讀取、參照或匯出任何服務 token 檔案。

**桌面應用程式需要自行登入。** Command Code Desktop 絕不會讀取無金鑰的供應商形式：
在顯示工作區之前，它會先檢查 `~/.commandcode/auth.json`（或 `COMMAND_CODE_API_KEY`），若兩者皆無便會停留在登入畫面。
請在該處登入一次——或使用 `cmd login`——應用程式便會儲存自己的憑證。

opencodex 不會寫入該檔案。它屬於 Command Code，並與真實登入及其他每個供應商的 token 共用，
因此啟用這項整合只會寫入 `providers.json`；佔位符絕不會寫入 `auth.json`，且 Apply、覆寫、目錄重新整理與 Disable
都會讓該儲存區逐位元組保持原樣。

**家目錄解析。** 這裡沒有 `COMMANDCODE_HOME` 覆寫。已發行的用戶端會解析 `HOME ?? USERPROFILE`，
然後附加 `/.commandcode/providers.json`；它不會查詢該變數。如果這個整合遵循了某個覆寫但用戶端忽略它，
就會讓 Apply 在一個 Command Code 從未開啟的路徑上回報成功，因此路徑永遠是 `~/.commandcode/providers.json`。
在 Windows 上使用預設家目錄時，僅當選取的 `HOME ?? USERPROFILE` 值非空、非純空白且為 Windows 絕對路徑時，
整合才會使用它；否則使用 `homedir()`。另行傳入的家目錄會保持不變。因此 Git for Windows 或 MSYS2 所設定的 `HOME`
只有在通過上述檢查時才會被遵循。

若你之後將供應商移出 loopback，請自行貼入金鑰：Command Code 將金鑰儲存在 `~/.commandcode/auth.json`（透過 `/connect`），而非 `providers.json`。

```bash
ocx integration client enable --client commandcode
ocx export --client commandcode --out ./providers.json
```

`ocx commandcode restore --op <opId>` 只接受 Command Code 操作，包括 `--preview` 與 `--plan-fingerprint` 請求。
它會拒絕 client/profile 覆寫。執行中的代理必須支援限於用戶端範圍的復原；較舊的代理會直接回傳錯誤，
而不會退回使用通用的復原端點。
一般日誌請使用 `ocx integration client restore`，Aside 操作則請使用上方的明確 Aside 設定檔指令。

## Factory Droid

請先執行 Droid 一次以建立 `~/.factory`，再使用 `ocx integration client enable --client droid` 明確啟用這項整合。
OpenCodex 只會在使用無金鑰本機 Chat Completions 端點的前提下，將文件記載的 `customModels` 項目加入你個人的 `settings.json`。
請從 Droid 的 `/model` 選擇器中選取一列。Disable 會移除受管理列；Undo 會還原確切已儲存的檔案。
其他設定與自訂模型仍歸你所有。
如果 Droid 透過加入 `id` 或 `index` 來正規化 `customModels` 列，OpenCodex 在檢查所有權時會忽略這兩個用戶端欄位，
讓已儲存的推理預設值維持可用。

開啟 **Connect → Factory Droid**（`/#integrations/droid`）即可為每個已連線模型設定推理預設值。
從模型支援的強度中選擇、檢視變更，然後確認。**No default** 會清除該模型的草稿設定；
請使用 **Save / review changes** 並確認以套用移除。
沒有宣告強度清單的模型會顯示沒有可用的預設值。

CLI 在 Droid 套用／覆寫時也支援相同的預設值。例如，將下方虛構的模型替換為確切的已連線 ID 與受支援強度：

```bash
ocx integration client preview --client droid --operation apply --reasoning-default example/model-a=high --json > droid-preview.json
```

檢視可套用的計畫並決定執行寫入後：

```bash
DROID_FINGERPRINT="$(jq -er 'select(.canApply == true) | .fingerprint' droid-preview.json)"
ocx integration client enable --client droid --reasoning-default example/model-a=high --plan-fingerprint "$DROID_FINGERPRINT" --json
ocx integration client status --client droid --json
```

重複提供 `--reasoning-default MODEL=EFFORT` 以提交完整的取代映射。最後一個等號會分隔模型與強度；
大小寫與確切 ID 會被保留。重複的模型鍵會被拒絕。省略旗標會保留預設值；
`--clear-reasoning-defaults` 會明確送出空映射。若要清除，請帶該旗標進行預覽，並在對應的 enable 指令中重複提供它。
清除與項目不可同時併用。這些旗標僅限 Droid 使用，不適用於停用／復原。預覽與提交時請重複相同的映射；
伺服器會驗證特定模型的強度並拒絕過期的繫結，而不是靜默接受變更後的映射。

若要執行預期的完全清除，請先預覽該獨立動作：

```bash
ocx integration client preview --client droid --operation apply --clear-reasoning-defaults --json > droid-clear-preview.json
```

檢視並選擇該動作後：

```bash
DROID_CLEAR_FINGERPRINT="$(jq -er 'select(.canApply == true) | .fingerprint' droid-clear-preview.json)"
ocx integration client enable --client droid --clear-reasoning-defaults --plan-fingerprint "$DROID_CLEAR_FINGERPRINT" --json
```

此預設值僅在 Droid 請求未帶努力強度時套用。請求中明確指定的強度會優先於此預設值；既有的 OpenCodex 釘選與上限依然適用。
即使 OpenCodex 套用了已設定的預設值，Droid 仍可能繼續顯示 **Dynamic**。沒有帶 Droid 預設值標頭的請求不受影響；
該標頭只是請求偏好，而不是用戶端身分的證明。對於 combo 與路由政策，每個具體目標都會根據自己的強度清單檢查該偏好，
因此不相容的第一個目標不會把該偏好從相容的回退目標上移除。

當路由模型不再支援某個已儲存的預設值時，請求會忽略該預設值。若已連線模型宣告的強度清單不再包含已儲存的值，
它會從面板的預設值中省略，並在重新整理時從受管理列中移除。不經編輯直接檢視，可讓 OpenCodex 保留其餘受支援的預設值。

只要確切的 `provider/model` 選擇器保持連線且仍宣告已儲存的強度，重新整理就會保留預設值。
重新命名供應商、模型或 combo 別名會取代該受管理列並清除其預設值；請為重新命名後的列重新選取預設值。
Disable 會連同受管理模型列一起移除預設值，Undo 則會同時還原已儲存的列與其預設值。

ID 或顯示名稱包含 `,` 或 `]` 的模型會被略過，因為受管理選擇器無法安全地定址它們；匯出與受管理設定會顯示相同的列。
非空目錄但沒有任何可定址模型時會被拒絕。

Droid 也會讀取舊版 `config.json` 與本機 `settings.local.json`。啟用之前請先處理使用 OpenCodex 端點、
產生的模型 ID 或 `OpenCodex:` 顯示名稱的舊版列，以及任何本機 `customModels` 覆寫；
OpenCodex 會拒絕這些含糊不清的設定。它也會拒絕不安全的目標或自套用後被編輯過的列。
這項整合僅限 loopback，且絕不會複製供應商憑證。Factory 在 [BYOK schema](https://docs.factory.ai/model-independence/byok)
與 [personal settings path](https://docs.factory.ai/droid-cli/settings) 說明了相關格式。
