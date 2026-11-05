---
title: Claude Code 指南
description: 在 Claude Code 中使用任意已路由模型——opencodex 在同一埠提供 Anthropic Messages API 和閘道器模型發現功能。
---

opencodex 在 `/v1/responses` 之外還提供 `POST /v1/messages`（以及 `count_tokens`），因此 Claude
Code 可以使用每一個已路由的供應商——包括 OAuth 登入、帳號池、金鑰故障轉移和 sidecar——
而無需進行任何額外的身分驗證設定。

## Tier defaults for CLI and external launchers

In the Claude Code tab, select an Opus, Sonnet, Haiku or Fable default and **Save**.
These `claudeCode.tierModels` defaults are passed to new `ocx claude` launches. They do not
change the currently selected main model, reasoning effort or Desktop family assignments.

Applications that launch `claude` directly do not receive the `ocx` launcher's environment.
After saving, choose **Preview Claude settings**, review the `ANTHROPIC_DEFAULT_*_MODEL`
changes, then **Apply to Claude settings**. This changes the OpenCodex host's Claude user
settings, not a remote browser's computer. Start a new Claude process to use the new values;
the operation does not stop or restart existing sessions. It does not configure routing or
authentication, so the direct caller must already be connected to OpenCodex.

Selected routing aliases are paired with `ANTHROPIC_DEFAULT_*_MODEL_NAME` labels, using the
same readable names as the model picker. Preview includes both IDs and label changes; the
alias remains the submitted model ID. An existing label is managed only if it exactly matches
the generated name for its current alias. Other labels, including empty values, are preserved.
A manually entered label identical to that generated name is indistinguishable from a managed label.

Only explicitly selected tier IDs are applied. An unset tier leaves its existing model ID
and its display label untouched. Replacing an alias with a first-party
ID or another non-alias also removes its matching generated label. Preview shows label removal
as an empty replacement; custom labels and unrelated settings remain intact.
Missing files are supported, but existing empty or corrupt files are
refused. Changes since preview require a new preview. Apply briefly moves the current
document into a private `model-default-backups/apply-*/settings.json` directory under the
Claude config directory, validates the captured document, then publishes exclusively.
It never replaces a concurrent writer's new file, including during rollback. Avoid editing
or launching Claude while applying: another reader can see the brief missing-file interval.
The filesystem must support same-volume moves and hard links; unsupported operations fail
without an overwrite fallback. After an interrupted apply or a failed automatic restore,
inspect this backup location and reconcile newer edits before restoring. Windows/Linux
filesystem behavior must be verified separately; a local test is not cross-platform proof.
Verify the resolved provider/model in request logs: selecting a tier is not proof of the
actual model served. This is especially useful for external classifiers requesting Sonnet.

## Claude OAuth 帳號池（實驗性）

你可以透過 Providers 儀表板登入多個 Claude 帳號（`ocx login anthropic` / add-account）。預設
每個請求只使用**作用中**帳號。

**實驗性、opt-in** 的 Claude 帳號池（`anthropicAccountPool.enabled`）會在這些 OAuth 帳號之間加入
sticky session affinity 與依用量的新工作階段選擇。它**不**控制 429 容錯移轉：只要儲存了兩個以上可用帳號，被限流的請求無論此開關開或關都會切換到另一個帳號，且無法關閉。僅對**新**工作階段，`anthropicAccountPool.strategy`
會在合格帳號之間選擇：`quota`（預設）保留現用帳號，直到 `anthropicAccountPool.quotaWindow` 所設定視窗的用量
（`five-hour` 為預設，亦可選 `weekly` 或 `max-utilization`）達到 `autoSwitchThreshold`
（預設 80），然後轉到用量最低的帳號，並優先選擇低於自身閾值的帳號；
`round-robin` 平均分散（`stickyLimit`，預設 `1`）；`fill-first` 一直使用作用中帳號直到冷卻、重新認證
或達到閾值，然後前進。它**預設關閉**，仍屬實驗性功能。

儀表板會列出帳號池的適用條件：你本人擁有或獲授權使用的訂閱、官方 Claude Code 用戶端，以及有人看顧的工作階段。
Anthropic 未認可自動帳號池；同一組織的帳號可能共用配額（新增帳號不一定能增加容量），切換帳號也無法避免供應商的
執行處置。OpenCodex 不會傳送保溫（keep-warm）請求，預設也不會在背景更新 Claude 權杖或讀取用量：只有儀表板、選單列
應用程式或 `ocx` 指令要求時才會讀取用量。門檻是選擇帳號的偏好，而非用量或計費上限。以上為產品說明，並非法律意見；
請查閱 Anthropic 的現行條款。

帳戶池啟用時，`anthropicAccountPool.routes` 依模型第一個符合的規則，將首次選擇和 429 重試限制在已儲存帳戶內。沒有可用帳戶時會在本機拒絕；`fallback: true` 才允許使用一般帳戶池。規則不代表帳戶確實有模型權限。

啟用時的營運契約：

- 上游 **429** 會讓該帳號冷卻（有 `Retry-After` 時使用它，否則用預設 backoff），
  並可能在同一個請求內輪換到另一個合格帳號（有上限）。只有共享配額拒絕會清除 affinity；暫時限流會保留綁定。
- Affinity 可在相同設定目錄及提供者實例中跨 proxy 重啟保留（閒置 24 小時，最多 2,000 筆）。快照只存工作階段摘要及登入識別圍欄，不存原始工作階段金鑰或 token。沒有持久登入識別的舊帳號在再次登入前僅保留程序內綁定；一般 token 更新保留綁定，重新登入、移除、暫停、需要重新驗證或執行期間手動選擇帳號則使其失效。暫時限流的替代帳號不會覆寫原綁定。
- Token 更新失敗保留既有 `needsReauth` 規則。明確的訂閱或帳號計費 403 可在輸出前切換帳號，冷卻遵循 `Retry-After` 或預設十分鐘；一般權限拒絕不切換。詳見[帳號復原](/zh-tw/guides/claude-code/)。
- 如果每個合格帳號都在冷卻，proxy 會回傳 **429**（不是 401），並在已知時附上 `Retry-After`。
- 復原（包括 429 容錯移轉）會使用 `quotaWindow` 為合格的替代帳號排序，且不改變現有的冷卻或
  容錯移轉上限；`round-robin` 會忽略 `quotaWindow`。
- `autoSwitchThreshold: 0` 只會關閉**主動的**依用量切換。新工作階段的選擇與 429 復原仍會參考 `quotaWindow`，所以該窗口只有在 `round-robin` 下才會失效。`fill-first` 會在所選窗口中評估其耗盡閾值。

請見 [Configuration](/zh-tw/reference/configuration/providers/#anthropicaccountpool實驗性)。

### Native Messages with account pooling

Managed native Messages show validated caller effort in Logs and `usage.jsonl`, including each
attempt: an explicit effort such as `xhigh` or `low`, `none` for disabled thinking, or
`budget:<tokens>` for an enabled thinking budget. An explicit effort takes precedence over the
thinking fallback. Adaptive thinking without an explicit effort stays blank. These labels describe
request controls; they do not confirm what effort the upstream applied or change the wire body.

An enabled Anthropic account pool prefers native Messages for eligible direct Anthropic routes
when neither native rollout flag explicitly disables that path. In Providers → Anthropic →
Account pooling → **How account selection works**, **Preserve native Claude requests** stores
`anthropicAccountPool.nativeMessages` (default true). Turning it off selects the legacy bridge
for pooled requests. With pooling off, the explicit native rollout settings keep their behavior.

Explicit `protocols.rollout.managedMessagesNative: false` disables both native paths;
`managedMessagesNativeOAuth: false` disables native OAuth. Invalid present settings fail closed.
The checkbox shows the saved preference, so an enabled checkbox does not override these flags
or a route that requires proxy translation. Native requests retain history/cache breakpoints,
session affinity, model routes, pause/cooldown exclusions and bounded pre-output recovery.

Recognized native CLI and Desktop Code requests retain their billing/identity preamble and
supported feature beta headers. Generated requests keep the SDK identity shape. Declared custom
tools use consistent names across deferred references and inline additions/removals, while
arguments, schemas and cache markers remain unchanged. Ambiguous declarations are rejected.
An account switch may start a cold cache; this does not transfer caches or guarantee cache hits.
For inline tool changes in system messages, send the required `inline-tools-2026-09-15` beta;
the first-party native builder preserves it with typed blocks independently of client recognition.
See [Claude’s inline tool contract](https://platform.claude.com/docs/en/build-with-claude/mid-conversation-system-messages).

## 快速入門

```bash
ocx claude
```

`ocx claude` 會確保代理正在執行，然後在接好環境變數的情況下啟動 Claude Code：

| 變數 | 值 |
| --- | --- |
| `ANTHROPIC_BASE_URL` | `http://127.0.0.1:<port>` |
| `ANTHROPIC_AUTH_TOKEN` | 僅在代理要求 API 金鑰時設定——否則不會設定，因此你的 claude.ai 登入（訂閱 + 聯結器）會保持有效 |
| `CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY` | `1`（原生 `/model` 選擇器發現） |
| `CLAUDE_CODE_AUTO_COMPACT_WINDOW` | 自動上下文壓縮閾值（預設 `829800`）；僅在啟用自動上下文時注入 |
| `ANTHROPIC_MODEL` | `claudeCode.model`（可選） |
| `ANTHROPIC_DEFAULT_HAIKU_MODEL` | `claudeCode.tierModels.haiku ?? claudeCode.smallFastModel`（可選，也包括舊版 `ANTHROPIC_SMALL_FAST_MODEL`） |
| `ANTHROPIC_DEFAULT_{OPUS,SONNET,FABLE}_MODEL` | `claudeCode.tierModels.*`（以訂閱方式啟動且未設定時為原生 `claude-opus-5-5[1m]` / `claude-sonnet-5-5[1m]` / `claude-fable-5-1[1m]`） |
| `ANTHROPIC_DEFAULT_{OPUS,SONNET,FABLE,HAIKU}_MODEL_NAME` | OpenCodex 將層級槽位設為路由別名時對應的 `/model` 標籤（例如 `ocx-claude-native--gpt-6.1-sol` → `gpt-6.1-sol (native)`）。launchd 系統環境與 shell 掛鉤中也成對寫入。模型 ID 仍為別名。您自行設定的槽位或標籤不會被修改 |
| `CLAUDE_CODE_ALWAYS_ENABLE_EFFORT` | 啟用 `alwaysEnableEffort` 時設為 `1`（條件注入） |
| `ENABLE_TOOL_SEARCH` | 設定 `claudeCode.toolSearch` 時注入（條件注入，預設關閉） |
| `CLAUDE_CODE_MAX_CONTEXT_TOKENS` | 設定 `maxContextTokens` 時使用的舊版上下文覆蓋項（條件注入） |
你自行匯出的變數始終優先。額外引數會直接透傳：`ocx claude -p "hello"`。

有一個例外和優先順序無關，而是關於變數*從哪裡來*。內建的 Bun runtime 會自動載入專案的
`.env` / `.env.local`，所以你恰好從某個目錄啟動時，該目錄裡一個不小心留下的
`ANTHROPIC_API_KEY` 過去看起來會和刻意匯出的變數一模一樣——並悄悄地讓一個健康的
claude.ai 訂閱改用 API 計費。`ocx claude` 現在會忽略只由專案 dotenv 引入的 Anthropic
憑證。你在 shell 中自行匯出的值在任何認證模式下仍然優先。若要刻意使用 API 金鑰，請
匯出它（`export ANTHROPIC_API_KEY=...`），而不是把它留在專案檔案裡。

### Claude 路由關閉時的原生回退

以前當 Claude 路由被關閉時，`ocx claude` 會直接報錯結束。現在它會改為啟動原生 `claude`
執行檔，因此在關閉路由的情況下該指令仍然可用：

| 路由關閉的位置 | 行為 |
| --- | --- |
| 設定中的 `claudeCode.enabled: false` | 原生啟動，並提示路由已停用 |
| 執行中的代理在 `GET /api/claude-code` 回傳 `enabled: false` | 原生啟動，並提示重新啟用後重啟服務 |
| `claudeCode.enabled` 缺少或為 `true` | 與以往一致，經代理路由 |

只有明確的 `false` 才會觸發回退，因此早於該欄位的舊代理仍會維持路由。代理不存在同樣不是觸發
條件——只要路由是開啟的，`ocx claude` 仍會照常啟動代理。

原生工作階段不應繼承代理狀態，因此回退只移除能夠**證明**屬於 OpenCodex 的值：僅當
`ANTHROPIC_BASE_URL` 指向本代理自身的回送位址與設定連接埠、且配對的 admission token 確實由代理
簽發時才移除；此外還會移除 `CLAUDE_CODE_*` 的探索與自動上下文開關，以及只能經由代理解析的模型
槽位（路由別名與 `provider/model` 形式）。其餘都屬於你自己的設定並會保留——無關的
`http://localhost:8080` 閘道器和你自己的 `sk-ant-` 憑證都會保留。

若儲存的 `/model` 選擇器預設值是僅限代理的模型，當 `claudeCode.model` 可在原生環境使用時會
回退到它，否則會警告你傳入 `--model <Anthropic 模型>`。明確的 `--model` 引數始終優先。

## 認證模式

Claude Code 需要在 `ANTHROPIC_AUTH_TOKEN` 中有 token 才能與閘道器通訊，但設定該變數也會停用
你的 claude.ai 登入及其聯結器。你要哪一種，取決於 opencodex 可以查到的狀態，因此預設會自動判斷。

在 **連線 → Claude** 中把 **認證模式** 保持為 **自動**（預設值），opencodex 會在每次
啟動時決定：

| 偵測結果 | 行為 |
| --- | --- |
| 有 Claude 登入（`~/.claude.json` 的 OAuth 帳號、`.credentials.json`、macOS keychain，或已匯出的 `ANTHROPIC_API_KEY`） | 不設定 token，讓你的訂閱與聯結器繼續運作 |
| 完全沒有 Claude 認證 | 注入佔位 token，讓 Claude Code 不再要求登入，並經由代理路由 |
| 無法判斷（keychain 無法讀取、檔案損毀） | 假設為訂閱並印出警告——讀取失敗時絕不會把付費訂閱者改成走代理 |

此判斷會在每次啟動時重新計算，不會被記住，因此登入或登出會在下一次 `ocx claude` 時自動生效，
無需重新設定。

若要固定行為，請明確選擇 **Subscription** 或 **Proxy**。明確選擇會寫入 `claudeCode.authMode`，
之後即使登入狀態改變，偵測也不會覆寫——包括你稍後登入或登出。切回自動即可把決定權交回。

在 macOS 上，自動連線（`claudeCode.systemEnv`）也遵循相同解析邏輯，因此在 `ocx` 之外直接啟動的
`claude` 行為一致。該檔案是代理啟動或你儲存設定時重新整理的快照，而 `ocx claude` 則一律即時解析。

## macOS 系統環境整合

## Claude Desktop 模式：閘道（預設）與第一方

在儀表板的 **連線 → Claude Desktop → 連線模式**，或透過
`ocx claude desktop apply --first-party|--gateway` 選擇互斥的模式。

套用第一方模式時，若閘道清理失敗，且 Windows ACL 作業讓設定回復無法在期限內開始，
OpenCodex 會明確回報設定回復未完成。該次回復不會改寫設定；重試前請先檢查目前連線模式。

### 閘道（預設）

新安裝預設套用閘道設定檔：包含聊天分頁在內的整個應用程式都使用 OpenCodex。
僅限 claude.ai 的功能無法使用。舊版 `--static`、`--hybrid` 和 `--discovery-only`
選項也會選擇閘道。

#### 選擇 Claude Desktop 列出哪些模型

**Connect → Claude Desktop → Desktop 模型清單**中，每個模型都有一個核取方塊。可依名稱搜尋或依供應商篩選，
再用**全選符合項目**或**清除符合項目**一次變更所有符合的項目，包含藏在**顯示更多**後面的資料列。
按下**儲存並套用**即可把清單寫入 Desktop。只有 Claude Desktop 的清單會改變：供應商的模型設定、
Claude Code、Codex 與其他用戶端仍保有所有模型。

**新發現的模型**決定供應商之後新增模型時的行為。**自動列出**會把它加入 Desktop；
**勾選前先隱藏**則在你勾選之前不列出。選取結果存在 `claudeCode.desktopModelVisibility`，
目錄重新整理與重新套用後仍會保留。**進階**底下的階層系列維持選用，不影響顯示哪些模型。
被隱藏的模型保有其 Desktop ID，因此已在使用它的對話仍可繼續。

卡片會分別顯示已選取、可用與已套用的數量。已選取但不再可用的模型會單獨計數，也不會被寫入。
若選取結果使可用模型為零，寫入器會退回使用所有可用模型，包含平常隱藏的路由；請更新選取內容後再次套用以縮小範圍。
套用之前，卡片會預覽所選設定檔將新增與移除的模型 ID。已套用數量讀自該檔案，並不會驗證 Desktop 處理程序實際載入了哪些模型。
在已儲存的清單寫入設定檔之前，狀態列會顯示**已儲存 — 套用以更新 Desktop**。請重新啟動 Desktop 以載入設定檔變更。
套用會取代 OpenCodex 的 Desktop 設定檔中的模型清單，包含在那裡手動編輯過的清單。
僅探索模式（`--discovery-only`）不會寫入清單，因此不使用這個選取結果。儀表板不會儲存使所有可用模型都被隱藏的選取結果。

### 第一方（自行選擇）

:::caution[帳號風險]
第一方模式會讓你的 Claude 訂閱流量經過本機攔截代理。
Anthropic 可能認為這違反其條款並停用你的帳號。預設模式是閘道；
只有接受這項風險時才選擇第一方模式。
:::

Desktop 本身不會被重新設定：它維持 claude.ai 登入，聊天、連接器和遠端控制仍可使用。OpenCodex 只在
`~/.claude/settings.json`（支援 `CLAUDE_CONFIG_DIR`）的 `env` 中寫入 `HTTPS_PROXY`
與 `NODE_EXTRA_CA_CERTS`。

```json
{
  "env": {
    "HTTPS_PROXY": "http://127.0.0.1:10200",
    "NODE_EXTRA_CA_CERTS": "<home>/.opencodex/claude-intercept/ca.pem"
  }
}
```

Desktop 第一方模式透過 OpenCodex 處理 Code 分頁及其子代理。獨立的 Claude Code CLI 有單獨開關。
兩者讀取同一份 `settings.json` 代理與 CA 設定：只啟用其中一個時，另一個仍會經過本機代理，TLS
在本機終止，但 Messages 請求會原樣轉送給 Anthropic。其他 Anthropic 路徑會原樣轉送，不相關的主機
則維持盲通道。

模式儲存在 `claudeCode.desktopMode`。先前明確套用第一方模式或在此版本之前套用的安裝
會保留第一方模式；現有閘道安裝也維持不變。沒有明確設定時，依序檢查 OpenCodex 擁有的
已選閘道項目、儲存的閘道指紋、`settings.json` 中屬於 OpenCodex 的第一方設定；
都沒有時採用閘道。僅為 CLI 第一方模式寫入的環境變數，不能證明 Desktop 處於第一方模式。目錄同步和模型清單更新絕不會在已解析為第一方模式的安裝上
寫入閘道設定檔。若 `claudeCode.intercept.enabled: false`，現有第一方安裝的套用操作
會以 `intercept_disabled` 拒絕，新安裝則套用閘道。不會覆寫其他代理的設定。
切換模式後請完全結束並重新開啟 Desktop。


在 連線 → Claude 開啟 CLI 開關，或執行 `ocx claude config set --first-party on`；關閉時使用 `off`。若本機代理無法使用、CA 無法準備、設定無法讀取，或代理鍵由其他程式擁有，開啟要求會被拒絕。關閉仍可儲存。只有 Desktop 第一方模式開啟時，若要讓終端機完全原生直連，請在 shell 設定 `NO_PROXY='*'`。上述帳號風險也適用於 CLI。 第一方模式開啟期間，OpenCodex 也會在 `~/.claude/settings.json` 的 `NO_PROXY` 加入 `127.0.0.1`、`localhost`、`::1` 和 `0.0.0.0`，讓本機 MCP 伺服器（包括 `*.localhost` 名稱）略過代理；其他 `127.x` 位址請自行加入。既有的 `NO_PROXY` 只會補上缺少的項目，關閉後，若 OpenCodex 已成功記錄原本的值且你之後未修改，就會還原原本的值；否則保留目前的值（包括新增的項目）。
### Picker 模式：在第一方 Code 分頁顯示 opencodex 模型

Picker 模式是第一方模式的一部分。在 macOS 和 Windows 上選擇第一方時預設開啟；設定
`claudeCode.intercept.picker: false` 後會保持關閉。它會修改第一方 Desktop 的 Code 分頁模型選擇器，
依名稱列出可用的 opencodex 模型。首次開啟時，macOS 可能會要求你在登入鑰匙圈中、Windows 可能會要求你在目前使用者根存放區中信任本機憑證授權單位。
該授權單位限制為 `claude.ai` 及其子網域。可匯出的簽章身分由 OS 認證資料儲存區保護，一般重新啟動會重用相同的憑證與金鑰。
OpenCodex 設定目錄不會儲存明文 Picker 簽章金鑰。受限 CA 的完整驗證與 OS 信任檢查仍然適用(Windows 按精確指紋與已驗證葉片驗證)。
已核准的身分不變且認證資料儲存區可用時，重新啟動不會新增或移除 macOS 憑證信任設定。啟動復原與狀態檢查絕不會安裝信任：
若信任缺失、遭撤銷或無法確認，Picker 會維持待處理狀態。請明確執行 `ocx claude desktop picker on`
或 `ocx claude desktop picker trust` 來授予信任(Windows 需要時含確認)。

從舊身分進行一次性移轉時，清除原有信任可能需要同意。清理未完成時，Picker 無法使用，已套用的設定檔
會使用不解密的中繼。macOS 也可能另外要求解鎖鑰匙圈或核准應用程式存取憑證，重新啟動或升級時也可能出現這些提示。Windows 上明確執行 `on` 或 `trust` 可能顯示新增根的確認。
Linux 仍不支援 Picker，不會啟動 Picker CA、認證資料儲存區或代理作業。主要 Claude 攔截功能仍可用，
其本機 CA 檔案受到擁有者、符號連結、檔案權限及 Windows ACL 檢查保護。

Picker 模式開啟期間，Claude Desktop 會透過 OpenCodex 存取網路。如果 OpenCodex 停止，Desktop 會離線，
直到你完全重新啟動 Desktop 或關閉 Picker 模式。使用 `ocx claude desktop picker status` 查看狀態，
使用 `ocx claude desktop picker trust` 重複信任步驟，或使用 `ocx claude desktop picker off` 關閉。
儀表板的 **連線 → Claude Desktop** 也有相同的切換開關。選取 Picker 設定檔後，請完全結束並重新開啟 Claude Desktop。

Picker 模式屬於第一方模式，因此[第一方帳號風險](#第一方自行選擇)同樣適用。

在上游首次回應之前，Picker 上傳若連續 60 秒沒有進展就會關閉。逾時會中斷上傳，不會回傳成功回應；HTTP/2 僅重設受影響的串流。上游背壓導致傳輸暫停時，閒置計時也會暫停；上傳完成或上游首次回應後，計時器會被移除。此閒置保護機制不會額外限制上傳總時長，現有執行階段與通訊協定限制仍然適用。回應串流不受此計時器限制。

### 在 Desktop 的 Code 分頁使用 opencodex 模型（第一方綁定）

在第一方模式下，Code 分頁的模型選擇器屬於 claude.ai：其中的資料列（Opus 5.5、Sonnet 5、Haiku 4.5，
以及**更多模型**底下較舊的模型）來自你的帳號，任何本機設定都無法加入 opencodex 資料列。
抵達 OpenCodex 的是每個請求上選擇器的 Anthropic 模型 ID，因此你要做的是把選擇器的某一列綁定到 opencodex 路由：

```bash
ocx claude desktop bind claude-sonnet-4-6 xai/grok-4.7
ocx claude desktop bind claude-opus-4-6 native/gpt-6.1-sol
ocx claude desktop unbind claude-opus-4-6
```

或在儀表板使用 **Connect → Claude Desktop → Code 分頁模型綁定**。之後在 Code 分頁選擇 **Sonnet 4.6**，
就會由 `xai/grok-4.7` 提供服務。選擇器仍顯示 Anthropic 的標籤，而且 Claude Code 的系統提示詞仍會讓模型自認是那個 Claude 模型，
因此建議選你平常不會用到的資料列（**更多模型**裡的項目是不錯的候選）。綁定在下一個請求生效，Desktop 不需要重新啟動。

- 路由使用 Desktop 的路由詞彙：`provider/model`，或原生 OpenAI 池使用的 `native/<slug>`。
  路由必須是儀表板列為可用的路由。
- 帶日期的選擇器 ID（`claude-haiku-4-5-20251001`）會符合不帶日期的綁定（`claude-haiku-4-5`），
  `[1m]` 與快速模式的選擇也沿用同一個綁定。
- 綁定儲存在 `claudeCode.intercept.modelMap`，只套用於經由本機攔截代理抵達的 Claude Code 流量：
  也就是第一方模式下 Desktop 的 Code 分頁與獨立的 `claude` CLI。`ocx claude` 工作階段與公開的
  `/v1/messages` 端點會忽略這些綁定；全域的 `claudeCode.modelMap` 仍然到處適用，同一個 ID 以綁定優先。
- `ocx claude desktop status --json` 會在 `firstParty.modelBindings` 底下回報目前生效的綁定。

### Claude Code CLI 第一方模式

在 Connect → Claude 開啟 CLI 開關，或執行 `ocx claude config set --first-party on`；用 `off` 關閉。此開關立即生效，並會在儲存任何欄位之前拒絕 `{enabled:false, cliFirstParty:true}`；若本機攔截不可用、無法準備 CA、無法讀取設定，或有外來的代理設定佔用了這些鍵，也可能拒絕開啟。即使攔截不可用，關閉仍會保存；單獨停用 Claude 路由則不會動到已擁有的設定環境變數。若只開啟 Desktop 第一方、又要讓終端機流量完全原生，請在 shell 中設定 `NO_PROXY='*'`。這仍帶有上文所述的第一方帳號風險。
停用 Claude 路由不會動到已擁有的設定環境變數。只要已綁定的監聽器仍在執行，每個 Messages 請求都會原樣轉送；它停止之後，在 OpenCodex 執行或 Desktop／CLI 第一方關閉之前，一般的 `claude` 無法連線。原生 `ocx claude` 只有在已擁有的環境變數且沒有外來繼承的 `HTTPS_PROXY`／`https_proxy` 時，才會設定 `NO_PROXY=*`。遇到外來代理時，它會保留該值並警告設定所擁有的攔截仍然生效；請關閉 Desktop／CLI 第一方，或取消該設定。
UI 會區分以下情況：無法確定設定是否仍指向它的代理（unknown）、帶權杖的 opencodex 代理搭配外來 CA（foreign：請手動修正 HTTPS_PROXY／NODE_EXTRA_CA_CERTS），以及不帶權杖的迴路代理搭配外來 CA（local：無法確認擁有權；若未使用請移除 HTTPS_PROXY）。當已套用的設定相符、監聽器已綁定但 Claude 路由為關閉時，disabled 表示綁定期間請求原樣轉送；請關閉第一方以移除設定。有擁有的 URL 但沒有監聽器為 stopped；監聽器已綁定、CA 為己有但連接埠或權杖不符則為 broken，即使路由關閉也一樣。當意圖為開啟時，stopped 或 broken 再加上攔截不符資格，會顯示 routingOff：Claude 路由或攔截為關閉，或這台機器是另一個 opencodex 中樞的用戶端；請在這台機器啟用攔截，或關閉第一方以移除設定。攔截停止時，可使用**啟動攔截**或 `ocx claude intercept start`，在執行中的 OpenCodex 服務內重試。儲存第一方設定時也會自動啟動它。拒絕時會回報路由已停用、用戶端角色、暫時性公開連接埠、連接埠被占用或啟動失敗。連接埠被占用時，請釋放它或設定 `claudeCode.intercept.port`。啟動時只有在攔截代理成功綁定之後，才會用其綁定的連接埠更新既有的受管 Claude 代理環境變數；連接埠被占用時 Claude 設定維持不變。若一組代理已綁定在不同的連接埠，回應會指出兩個連接埠；請使用已綁定的連接埠或還原設定的值。沒有代理的 CLI 意圖不會被套用；一個意圖搭配執行中的代理會收到共用轉送通知；兩種意圖都沒有的其餘代理則為 residual，除非 unknown、foreign 或 local 優先。

- 不使用閘道探索（`/model` → 「From gateway」），因為 Claude Code 只會對已設定的閘道查詢
  `GET /v1/models`。路由模型以另一種方式進入選擇器；請見
  [CLI 中的模型選擇器](#cli-中的模型選擇器)。你也可以把內建的 Anthropic
  模型 ID 綁定到某個路由（上述的 `ocx claude desktop bind`），或使用 `modelMap`。
- `ANTHROPIC_SMALL_FAST_MODEL` 與 `CLAUDE_CODE_SUBAGENT_MODEL` 由 CLI 在送出請求之前就決定。
  一般的第一方 `claude` 使用你的 `settings.json` 值。經路由的
  `ocx claude` 也在子代理頁面與 CLI 提供[子代理強制設定](#forced-claude-code-subagent-model)。
- `ocx claude` 與第一方可並存：用 `ocx claude` 啟動的工作階段連到
  `ANTHROPIC_BASE_URL`（迴路上的純 HTTP），而 `HTTPS_PROXY` 並不涵蓋它，因此該處理程序直接連到 OpenCodex，
  代理只是看不到它的流量。
- Claude Code 依文件對企業代理遵守 `HTTPS_PROXY`／`NODE_EXTRA_CA_CERTS`；
  若某個 CLI 版本不再這麼做，後果是停止路由，而不是登入失效。

#### CLI 中的模型選擇器

開啟 CLI 第一方開關並啟用 Claude 路由後，啟動新的 `claude` 並開啟 `/model`。你的 opencodex 模型會出現在帳號提供的
Claude 模型旁邊，標示類似「Grok 4.7 (xai)」，並以其路由作為說明（`opencodex · xai/grok-4.7`）。
選擇其中一個，就會把該工作階段路由到那個模型，效果和綁定相同。

- 只有新的 `claude` 工作階段會取得這份清單。開關開啟或關閉時已在執行的工作階段，請重新啟動。
- Claude Code 會把清單保存約一小時。開關開啟或關閉，以及 `ocx ensure`，都會清除這份保存的副本，
  所以下一次啟動 `claude` 會取得新的清單。若缺少路由模型（OpenCodex 啟動後的第一次啟動，
  可能因模型仍在探索而缺少），請執行 `ocx ensure` 並重新啟動 `claude`。
- 資料列使用 Claude 風格的 ID（例如 `claude-opus-4-8-…`），因為 CLI 只提供形狀像 Claude 模型的 ID。
  Claude Desktop 的 Code 分頁不受影響；它仍使用
  [第一方綁定](#在-desktop-的-code-分頁使用-opencodex-模型第一方綁定)。

## Claude Desktop 設定檔

只有閘道模式會將以下設定檔寫入 Desktop。

Claude Desktop 使用與 Claude Code 分開的設定檔。在儀表板開啟 **連線 → Claude Desktop**，可把每條
可用路由放到四個系列之一：Opus、Fable、Sonnet 或 Haiku。新設定檔中所有路由一開始都在 Opus。
第一個 Opus 路由會成為整體初始預設，且每個非空系列都一定會有一個系列預設。

若要改系列，可以把列拖到另一個系列。拖曳是可選的：每一列也都有可用滑鼠、觸控或鍵盤操作的
移動控制項。使用 **設為預設** 選擇系列預設，再選 **儲存並套用到 Desktop**。允許空系列。若已
儲存的預設暫時不可用，會改用該系列中第一個可用路由，直到原預設回來。

你也可以用命令列管理同一份設定檔：

以下設定檔編輯說明適用於本機設定檔；連接遠端 hub 時的套用方式另見下節。

```bash
ocx claude desktop [apply]
ocx claude desktop show [--json]
ocx claude desktop status [--json]
ocx claude desktop move <route> <opus|fable|sonnet|haiku> [--default]
ocx claude desktop default <opus|fable|sonnet|haiku> <route|none>
ocx claude desktop export <path|->
ocx claude desktop import <path> [--apply]
```

`ocx claude desktop` 與 `apply` 會套用選定模式：第一方寫入 Claude Code 代理環境變數，
閘道則寫入 Desktop 設定檔。`show` 提供可讀摘要；加上
`--json` 方便腳本使用。`export -` 會把帶版本的 JSON 寫到標準輸出。Import 會在儲存前驗證完整
檔案，因此無效檔案不會改動目前設定檔。加上 `--apply` 可在匯入有效設定檔後立即寫入 Desktop。
`none` 僅適用於空系列；每個非空系列都必須保留一個預設。

非 Anthropic 路由會得到穩定別名，例如 `claude-fable-5-p01q`，其後綴是以 `p` 開頭的四字元代碼。OpenCodex 仍會在內部保留合成日期槽位，
以維持既有設定檔配置的穩定性，但不會把日期當成 Desktop 模型 ID；目前的 Desktop 版本在比較作用中工作階段的模型時會移除尾端日期，
因而可能抑制模型切換。
真正的 Anthropic Claude 路由保留真實 id。新路由預設落在 Opus
系列，但移動路由不會改變它所呼叫的供應商或模型。舊版 apply 旗標 `--static`、`--hybrid` 與
`--discovery-only` 仍可供既有腳本使用。

## 系統環境整合

當 `claudeCode.systemEnv` 設定為 `true`（預設：**關閉**）時，`ocx start` 會使用 `launchctl setenv`
在系統範圍內注入 `ANTHROPIC_BASE_URL` 和相關的 Claude Code 環境變數。因此，新開啟的終端視窗和
標籤頁可以直接透過代理路由普通的 `claude` 命令，無需使用 `ocx claude` 包裝器。已經開啟的
shell 不受影響，必須重新開啟。

`ocx stop` 和代理關閉操作會**取消設定已注入的鍵**（不會恢復之前的值——只會移除 opencodex
注入的鍵）。代理還會寫入 `~/.opencodex/claude-env.sh`；`ocx start` 會安裝一個 `.zshrc`
source hook，以自動載入該檔案，但僅限 `PATH` 中存在可執行的 Claude Code CLI。Claude Code
不存在或系統環境整合未啟用時，啟動程序和 `ocx ensure` 會移除 OpenCodex 自己寫入的 hook。
Claude Desktop 使用獨立 profile，不會觸發 shell hook 安裝。

可以在設定中設定 `claudeCode.systemEnv: false`，或使用 GUI 開關來停用。此功能僅適用於
macOS；在其他平臺上，請使用 `ocx claude`。

## 原生 Claude 透傳（訂閱直通）

未設定身分驗證覆蓋時，Claude Code 會保留其 claude.ai OAuth 登入，並將其傳送給代理。
對於未被任何別名或模型對映佔用的真正 `claude*`/`anthropic*` 模型，請求會連同你的憑證
**原樣**轉發到 `api.anthropic.com`——beta、思考簽名、提示快取和計費身份都保持完全原生，
而已路由模型仍可在同一會話中透過選擇器別名使用。

**標頭處理：**轉發前一律移除逐跳標頭以及 `host`、`content-length`、
`accept-encoding`、`x-opencodex-api-key` 和 `origin`。在非回環綁定上，原生透傳還要求透過
`x-opencodex-api-key` 提供有效的代理許可憑證；此時 `Authorization` 與 `x-api-key` 僅屬於
Anthropic。若任一供應商標頭含有代理許可密鑰，該密鑰會被移除，而另一標頭中的真正供應商
憑證會保留。以逗號合併的模糊憑證標頭不會被轉發。

只有同時滿足以下所有條件時才會觸發透傳：`nativePassthrough` 不為 `false`；模型以
`claude` 或 `anthropic` 開頭；bearer token 或 `x-api-key` 以 `sk-ant-` 開頭；並且別名/模型對映
解析後回傳的模型保持不變；且在非回環綁定上，專用代理許可標頭有效。這也意味著使用 `ocx claude` 時不再出現
"claude.ai connectors are disabled"警告。

請求本文中唯一會改動的是工具呼叫 ID。Anthropic 會拒絕的 `tool_use.id` 或 `tool_result.tool_use_id`（含 `a-zA-Z0-9_-` 以外的字元或超過 64 個字元，例如工作階段早先由路由模型產生的 ID）會被改寫為合規 ID，並保持呼叫與結果的配對。合規 ID 原樣送出，空 ID 會在本地直接回傳 400。

可以設定 `claudeCode.nativePassthrough: false` 來停用；也可以透過
`claudeCode.anthropicBaseUrl` 指向其他位置。

## 連接遠端 hub 的 Claude Desktop

已連接的機器執行 `ocx claude desktop apply` 或 `ocx claude desktop` 時，會讀取 hub 的
Desktop 快照，將 hub origin 和 hub 發出的完整模型 ID 原樣寫入本機 Desktop 設定，不再於本機
產生別名。static/hybrid 模式也複製模型清單；discovery-only 模式使用 hub origin，不嵌入清單。

Desktop 設定檔、模型家族分組及預設值由 hub 管理。在 hub 上修改後，請在客戶端重新套用，
並在 Desktop 中重新選擇模型。以前只在客戶端產生的別名也需要重新套用、重新選擇，不會自動
移轉。`show`、本機編輯及 import/export 仍只操作本機設定。連接期間不支援
`ocx claude desktop import <path> --apply`，會在儲存前拒絕；不帶 `--apply` 的 import 仍是本機操作。

讀取使用現有連線的資料存取憑證，不需要管理員權杖，也不會上傳設定檔。舊版 hub 不支援快照、
回應無效或 Desktop 清單為空時，套用會失敗，不會改用本機目錄或回環位址。
請更新或設定 hub 後重新套用。

本次別名修改不解決 [#3719](https://github.com/lidge-jun/opencodex/issues/3719) 中獨立的 `thinking` / `redacted_thinking` 重播與提示快取請求。
只有代理存取憑證不會啟用原生 Anthropic 透傳，但經過轉換的 Anthropic 路由仍可使用提示快取。
重播保真與快取命中率比較仍是獨立工作。


也可以在儀表板中透過 **連線 → Claude Desktop → Code 分頁模型綁定** 完成同樣操作。綁定之後，在
### 金鑰輪換、復原與中斷連線

金鑰輪換和復原會同步更新本機連線憑證與該連線管理的 Desktop 設定中的金鑰，無須為了移轉
金鑰而手動重新 apply。模型 ID、家族分組、預設值及目前設定選擇都會保留；輪換不會重新選取
管理設定，也不會啟用已關閉的整合。CLI JSON 的 `rotation: "committed"` 表示新金鑰已生效，
`rotation: "rolled_back"` 表示保留或還原了舊金鑰，不代表新金鑰已提交或舊金鑰已撤銷。
結果不確定或復原未完成時，不會回報輪換成功。

首次連線套用會儲存原先的管理設定和選擇，以供還原；後續 apply 和輪換不會覆寫這份初始紀錄。
`ocx disconnect` 還原連線管理的設定，同時保留使用者新增欄位和其他設定檔。只有管理設定檔
仍被選取時才還原之前的選擇；使用者後來選取的其他有效設定檔保持不變。新建設定檔若已有
使用者新增內容，會保留為可讀取的標準模式，而不是刪除這些內容。`--keep-catalog` 保留的是
目錄，不是 Desktop 連線金鑰。

沒有原始紀錄的舊管理設定檔，只要能明確確認屬於目前 hub 和已識別的連線金鑰，就能移轉。
apply、輪換/復原或直接 disconnect 均可處理，無須新參數或事先重新 apply。系統會警告：
先前的設定未記錄，中斷連線時將使用標準模式。只移除連線擁有的閘道設定，保留使用者欄位和
另行選取的有效設定檔；結果標為標準回退，而非還原原始設定。

管理欄位衝突、無法識別的憑證或損壞的還原紀錄會保留並回報，不會覆寫。中斷的清理僅針對
同一連線繼續，不會刪除新連線，也不會在還原未完成時宣稱完成。中斷前先完成待處理的金鑰
輪換復原；重試中斷時保持原來的目錄保留選項。

套用、輪換/復原或還原設定後，請完全退出並重新開啟 Claude Desktop。修改磁碟檔案不會替換
執行中應用程式持有的金鑰，也不會自動退出或重新啟動應用程式。中斷連線在本機完成，不會
自動撤銷 hub 金鑰或刪除外部副本；如有需要，請另行在 hub 撤銷。

## /model 選擇器（"From gateway"）

Claude Code 2.1.129+ 透過 `GET /v1/models?limit=1000` 發現閘道器模型，並在原生 `/model`
選擇器中列出。沒有 `description` 的列會顯示為“From gateway”；opencodex 會為 Claude Code CLI 的每一列送出
`description`（`Routed by OpenCodex to <provider>/<model>`；原生列為 `Routed by OpenCodex to native <model>`，Fast 列末尾加上 ` · Fast`，1M 列沿用基礎描述），Claude Code 2.1.257+ 會改為顯示它。
Claude Code 2.1.278 接受包含 `claude` 或 `anthropic` 的 ID。以 `claude-` 開頭的未知 ID 在不關閉 compact 時按 200k 計算，因此 opencodex 會將已路由模型公開為包含 `claude`、但不以 `claude-` 開頭的穩定且可逆別名：

| 介面 | 格式 | 示例 |
| --- | --- | --- |
| Claude Code CLI | `ocx-claude-<provider>--<model>`（plain）或 `ocx-claude2-…`（escaped） | `ocx-claude-native--gpt-5.6-sol` |
| Claude Desktop 3P | `claude-fable-5-p<code>`（3 字元 base36 設定檔槽位） | `claude-fable-5-p01q` |

代理會按請求選擇別名族：`?ids=cli` 或 `?ids=desktop` 優先；否則，`claude-code/*`
user-agent 會獲得易讀的 CLI 形式，其他用戶端會獲得 Desktop 代碼形式。兩種別名族都會永久
保持可解碼——以任一形式儲存在 `settings.json` 中的模型都能繼續工作。
每個條目帶有誠實的顯示名（如 `gemini-3-pro (gemini)`），並以官方 ModelInfo 形態附帶完整模型
能力（推理強度階梯、thinking 型別），使 Claude Desktop 的第三方閘道器模式能夠提供其推理強度
選擇器。真實 Anthropic 模型保留其規範 id。合成的 2026 日期是內部槽位，不是釋出日期。舊版雜湊
別名與較舊設定中的 `claude-ocx-<provider>--<model>` id 仍可解析，跳脫的 `claude-ocx2-<provider>--<model>`
也同樣可解析。已儲存的舊 id 仍會路由，但 Claude Code 對它仍按 200k 計算。把已儲存的 `claude-ocx-`
重新選一次對應的 `ocx-claude-`，跳脫的 `claude-ocx2-` 重新選一次 `ocx-claude2-`，即可同時用上真實上下文
視窗與 compact。
目錄中的有效上下文視窗為 1M 或不低於預設壓縮閾值（829,800）的模型會多出一個 `…[1m]` 選擇器列：選中後 Claude Code 會按完整 1M 上下文
計算該模型（自動壓縮仍開啟）——代理在路由前會去掉該標記。
選中後會儲存到 Claude Code 的 `settings.json` `model` 欄位；入站請求會將別名解析回路由
模型。在較舊的 Claude Code 版本中，選擇器保持原生——可透過 `ANTHROPIC_MODEL` 設定槽位，或在
`/model` 中輸入任意已路由 id（Claude Code 會原樣傳遞字串）。

**別名語法規則：**provider 不得包含 `/` 或 `--`，也不得等於 `native`。
不含 `/` 或 `~` 的一般 model ID 使用 v1 前綴 `ocx-claude-…`。包含 `/` 或 `~` 的 model ID
使用 v2 前綴 `ocx-claude2-…` 並跳脫（`/` → `~s`，`~` → `~t`），例如
`openrouter/anthropic/claude-opus-4-8` → `ocx-claude2-openrouter--anthropic~sclaude-opus-4-8`。
v1 別名按字面解碼（歷史上 model ID 中包含的兩字元序列 `~s` / `~t` 會被保留）；v2 別名會展開跳脫。
易讀形式無法表達的路由會回退到雜湊別名。模型 ID **可以**包含 `--`（解析時只按第一個
`--` 拆分）；包含 `--` 的原生 slug 會回退到雜湊形式。

**模型解析順序：**移除 `[1m]` 標記 → 解碼易讀別名 → 解碼 Desktop 雜湊別名 →
`modelMap` 精確匹配 → 移除日期後的匹配（移除 `-20250514`）→ 透傳。

<a id="desktop-alias-resolution"></a>

無法解析的日期型 Desktop ID 也可能是探索結果中缺少的真實原生模型 ID。現有資訊不足以
解析該 ID 時，Messages 和 count-tokens 回傳 HTTP 503 及固定錯誤 `desktop_model_mapping_unavailable`；這不代表
模型無效。未知的舊版雜湊別名仍回傳 HTTP 400。兩種情況都不會移除日期或回退到其他路由。
已知 ID、已註冊映射、精確 `modelMap` 匹配及已識別的真實原生 ID 維持原有處理方式。
請重新整理模型探索或重新套用已連接 hub 的設定後再試；僅重試本身不能保證解決。

每個條目都帶有類似 `gemini-3-pro (gemini)` 的顯示名稱，以及官方 `ModelInfo` 結構中的完整
模型能力（推理強度階梯、思考型別）。真正的 Anthropic 模型在兩個介面上都保留其規範 ID。

### 上下文變體 `[1m]` 標記

這些判斷使用目錄中的有效視窗，其中可能包含[自訂供應商的推斷值](/zh-tw/reference/configuration/providers/#自訂供應商的上下文視窗)。推斷值並不證明中轉的實際容量。

目錄中的有效上下文視窗為 1M 或不低於預設壓縮閾值（829,800）的模型會多出一個帶 `…[1m]` 的選擇器條目。
該下限是固定的，修改壓縮值不會降低它；Anthropic 路由上的 Claude 模型必須真正達到 1M；關閉自動上下文後只對 1M 模型生效。
超出真實視窗時會回傳 `prompt is too long` 錯誤，Claude Code 會自動壓縮。選擇它後，Claude Code 會按完整的 1M 上下文計算。
代理會在進行別名解析和路由之前移除不區分大小寫的 `[1m]` 字尾。

## 自動上下文（突破 200k 上限的大上下文模型）

對於任何無法識別的模型，Claude Code 都會按 200k token 計算。預設開啟的**自動上下文**可解決
這一問題：

1. 啟動環境槽位會在目錄中的有效視窗大於 200k **且**至少達到所設定的自動壓縮閾值時帶上
   `[1m]` 標記。探索列表和 Desktop 選擇器條目不跟隨該閾值：它們使用固定的 829,800 token 下限（Anthropic 路由上的 Claude 模型必須真正達到 1M）。
2. 系統會注入 `CLAUDE_CODE_AUTO_COMPACT_WINDOW`（預設 `829800`，範圍 `100000`–`1000000`），
   使對話在該位置自動進行摘要。

設定有三種狀態：

- **缺省 / `true`：**啟用（預設）
- **`false`：**停用——不新增標記，也不注入壓縮視窗
- **設定了舊版 `maxContextTokens`：**隱式停用自動上下文

可以在 Claude 頁面調整壓縮值。**警告：**如果將其提高到超過模型的實際視窗，該模型將無法正常
工作——聊天會在觸發摘要之前報錯。

正規化上下文超限錯誤時，只使用提供方錯誤訊息的前 65,536 個 UTF-16 程式碼單元。
後面的診斷資訊或 token 數可能被捨棄，且不會新增截斷標記。
詳細限制和 token 數處理條件請參閱[英文指南](/zh-tw/guides/claude-code/#自動上下文突破-200k-上限的大上下文模型)。

低於 1M 的原生 Anthropic 模型絕不會被自動標記。你自行匯出的壓縮值在啟動槽位標記上始終優先（代理會使用**你的**
值來判斷哪些模型可以安全標記）。探索列表忽略該匯出值並保持固定下限。手動編輯設定時填入的無效值會回退到 829,800。

### Context accounting (1M by default, 200k opt-in)

`claudeCode.contextAccounting` decides what opencodex picks by default. Absent (`1m`, the
default), long-window models are offered at 1M in the launch env slots, the Desktop pickers,
Desktop 3P (`prefer1m`) and generated subagents. Set `200k` to opt out: nothing is marked `[1m]`
automatically, `CLAUDE_CODE_AUTO_COMPACT_WINDOW` is not injected, and Desktop 3P drops `prefer1m`
while keeping `supports1m`. A selector you mark `[1m]` yourself stays available (generated and
forced subagents still drop a marker the model's window cannot carry), and discovery still lists
the `· 1M` rows of models with catalog windows of at least 1M. `200k` wins over auto-context: a
compact window you export no longer turns automatic marking on, though opencodex leaves your own
export in place.

```bash
ocx claude config set --context-accounting 200k
```

### 有效模型環境變數

`effectiveModelEnv` 會計算由 `ocx claude` / 系統環境 / shell 檔案注入的六個槽位：
`ANTHROPIC_MODEL`、四個 `ANTHROPIC_DEFAULT_{OPUS,SONNET,HAIKU,FABLE}_MODEL`，以及舊版
`ANTHROPIC_SMALL_FAST_MODEL`。有效 Haiku 值為 `tierModels.haiku ?? smallFastModel`，並會
提供給兩個 Haiku 變數。

以訂閱模式啟動 `ocx claude` 時，Claude Code 自身的登入會把 `claude-sonnet-5` 這類裸 Claude ID 直接送給 Anthropic，因此無論其他供應商為同一 ID 列出什麼，這些 ID 的上下文視窗都取自供應商登錄表。未設定的 Opus、Sonnet 或 Fable 槽位會填入 Claude Code 為該別名解析出的原生 ID，並帶上 `[1m]` 標記，因為在閘道之後，Claude Code 會把不帶標記的 ID 按 200k 計算。上限低於 1M 的 `anthropic` 列或 `claudeCode.modelMap` 項目會讓對應 ID 保持無標記，Haiku 永遠不會被填入或標記。以代理驗證啟動或關閉 `nativePassthrough` 時，由路由器決定，只有路由列的視窗生效。系統環境和 shell 檔案會讓未設定的槽位保持為空，因為它們的值也會傳到經由 hub 的啟動。

當 `tierModels.haiku` 和 `smallFastModel` 均未設定時，OpenCodex 會讓兩個輔助模型變數保持未設定；隨後 Claude Code 會選擇其原生輔助模型（目前為 Sonnet），並可能產生原生供應商費用。

## 名冊代理（injectAgents）

Proxy 啟動／ensure、`ocx claude` 與相關的儀表板儲存操作，會把你的精選子代理名冊（Subagents
標籤頁，最多 5 個模型）和 `ocx-self` 同步到 `~/.claude/agents/ocx-*.md`。

- **`ocx-self`** 固定你在 `/model` 選擇器中的預設模型（回退到 `claudeCode.model`）；兩者均
  不存在時省略。它**不**使用模型繼承。
- 每個代理正文都包含一條 `<!-- ocx-route: <model> -->` 指令——代理使用該指令固定實際路由。
  派發時請省略 Agent 工具的 `model` 參數：它的優先順序高於代理定義，傳入任何佔位值，在呼叫未經代理路由時都會讓子代理實際跑在該模型上。
- Frontmatter 攜帶別名；路由由指令驅動。
- 只有包含 `generated-by: opencodex` 且透過標記驗證的 `ocx-*.md` 檔案才會被覆蓋或清理；
  你自己的代理絕不會被改動。
- 檔案按單個檔案進行原子同步（寫入 + 重新命名）。
- `enabled: false` 或 `injectAgents: false` 會清理所有經驗證歸屬的定義。
- GUI PUT 與名冊變更會立即重新同步；每次前景或背景的 proxy 啟動／ensure，都會在稍後的
  Claude Code 啟動讀取這些檔案之前，先協調好這些擁有的檔案。

派發方式：`subagent_type: "ocx-gpt-5-6-sol"`。支援 1M 的目標會自動攜帶 `[1m]`。

## 內建技能省略（blockedSkills）

Claude Code 內建的 `claude-api` 技能會注入約 840KB（約 136k token）的 Anthropic 文件內容，
並在提及 Claude 模型時自動觸發。已路由模型並未針對該文件包進行訓練，因此預設情況下，
opencodex 會在**已路由**請求中將該技能內容替換為一個短佔位說明。原生 Anthropic 透傳不受影響。

**會處理兩種載體：**

1. **工具結果載體：**assistant 的 `Skill(...)` 呼叫——當轉為小寫的 JSON 輸入包含被遮蔽名稱時，
   與之配對的 `tool_result` 正文會被替換為佔位說明。
2. **文字塊載體：**以 `Base directory for this skill: ` 開頭且不少於 10,000 字元的使用者
   文字塊——當目錄 basename 等於被遮蔽名稱時匹配（不區分大小寫）。目錄行最多只檢查 4,096 個
   UTF-16 程式碼單元；更長的行會原樣送出，包括沒有結尾換行的情況。

透過 `claudeCode.blockedSkills` 設定（預設 `["claude-api"]`；`[]` 會完全停用省略）。
佔位說明會保持工具呼叫/結果的配對關係不變。

## 模型對映（攔截）

`claudeCode.modelMap` 會在路由前重寫傳入的 Anthropic 模型 ID：

```json
{
  "claudeCode": {
    "modelMap": {
      "claude-sonnet-4-5": "gemini/gemini-3-pro",
      "claude-haiku-4-5": "gemini/gemini-3-flash"
    }
  }
}
```

查詢順序：發現別名 → 精確 ID → 移除日期字尾的 ID（`-20250514`）→ 透傳。

拒絕規則請見 [Desktop 別名解析](#desktop-alias-resolution)。

## Sidecar 矩陣：Web Search 與圖像理解

不同路由模型擁有的託管工具和圖像能力並不相同。opencodex 會在主模型回答前補齊這些能力：

- **Web-search sidecar** 執行真實的託管搜尋，再把答案和來源作為工具結果交給路由模型。
- **Vision sidecar** 在呼叫 `noVisionModels` 中的模型前描述附件圖像，並用文字描述替換圖像。

兩個 sidecar 都可使用以下任一後端：

| 後端 | 執行方式 | 所需條件 |
| --- | --- | --- |
| `openai` | 透過 ChatGPT `forward` provider 呼叫小型 GPT 模型 | ChatGPT 登入，以及已啟用的 `authMode: "forward"` provider |
| `anthropic` | 透過已儲存的 Anthropic OAuth 呼叫 Claude；Web Search 使用 `web_search_20250305`，Vision 讓 Claude 描述圖像 | 已啟用的 `adapter: "anthropic"`、`authMode: "oauth"` provider，且其活動帳號未標記 `needsReauth` |

顯式設定的 `backend` 始終優先。省略時，**web-search** sidecar 一律選擇 `openai`（只有明確
設定時才會使用 `anthropic`）；而 **vision** sidecar 在存在可用的已儲存 Anthropic OAuth 帳號時
選擇 `anthropic`，否則選擇 `openai`。顯式選擇 `anthropic` 卻沒有可用憑證時會**關閉失敗
（fail closed）**：opencodex 不會悄悄借用 ChatGPT 憑證，也不會切換後端。同樣地，缺少登入驗證
與 forward 供應商時，OpenAI 後端也會保持關閉。

Claude 入站的路由重放會把主 ChatGPT 登入附加到內部請求，因此即使 Claude Code 的 bearer 僅用於
代理認證，OpenAI sidecar 仍可存取。該 ChatGPT bearer 不會傳送給主路由 provider。

```json
{
  "webSearchSidecar": {
    "backend": "anthropic",
    "model": "claude-sonnet-5",
    "maxSearchesPerTurn": 3
  },
  "visionSidecar": {
    "backend": "anthropic",
    "model": "claude-sonnet-5",
    "maxDescriptionsPerTurn": 8
  }
}
```

`maxDescriptionsPerTurn` 限制一個主模型 turn 中新增的圖像描述次數。快取命中和同一 turn 內重複的
進行中描述不會消耗配額。成功的 `data:` 圖像描述會按後端、模型、detail、圖像位元組和請求上下文
快取，避免每次重放都重複描述同一圖像與上下文。內容可能變化的遠端 `https:` 圖像不會快取。

全部設定項見[設定參考](/zh-tw/reference/configuration/server/#sidecar)。Anthropic OAuth Web
Search 和圖像描述沿用儲存庫已有的 Claude Code OAuth fingerprint 先例，但在用於長時間無人值守任務前，
仍應使用你的帳號和實際負載進行充分 soak test。

<!-- TODO(WP5 GUI): GUI 控制元件完成後補充 sidecar 設定頁面操作說明。 -->

## Client tools on Cursor routes

When Claude Code uses a Cursor-backed model, OpenCodex preserves recognized client tool names
such as `Bash`, `Read`, `Write`, `Edit`, `Grep`, `Glob`, and `Task` in the Cursor catalog, tool
guidance, and replayed calls. This keeps the names consistent with Claude Code's instructions.
Denied Cursor-native execution frames direct the model to the client tools available that turn.

A mixed catalog containing a bare Codex `exec_command` or `shell_command` bridge uses wire
aliases such as `ocx_client_Read` to avoid Cursor tool collisions; calls returned to Claude Code
still use its original tool names. Namespaced MCP tools keep their namespaced identities.
OpenCodex includes these aliases in Cursor's transport byte budget, so a tool whose definition
would exceed the limit is omitted for that turn.

## 推理強度

對於從 Messages 轉換為 Responses 的請求，Claude Code 的 `/effort` 設定依下表對映：

| 傳輸格式 | 對映 |
| --- | --- |
| `thinking.type: "adaptive"` + `output_config.effort` | 直接傳遞強度（`minimal`\|`low`\|`medium`\|`high`\|`xhigh`\|`max`\|`ultra`） |
| `thinking.type: "enabled"` + `budget_tokens` | ≤4096→`low`，≤16384→`medium`，更高→`high` |
| `thinking.type: "disabled"` | `reasoning: { effort: "none" }`；省略摘要 |

對於轉換後的請求，對映得到的等級會顯示在請求日誌的 **Reasoning effort** 欄中。
受管理的原生 Messages 請求在沒有可識別的 `output_config.effort` 時，將啟用的 thinking 預算記錄為
`budget:<tokens>`；此日誌記錄不會變更傳輸的請求本文。

## 入站轉換（Messages → Responses）

代理會將每個 Anthropic Messages API 請求轉換為 Codex Responses API 格式：

| Messages 輸入 | Responses 輸出 |
| --- | --- |
| 頂層 `system` | `instructions`（文字塊以 `\n\n` 連線） |
| `messages[].role: "system"` | 同樣合併到 `instructions` |
| 使用者文字 / 圖像 | `input_text` / `input_image`（base64 → data URL） |
| Assistant 文字 | `output_text` |
| Assistant `tool_use` | `function_call`（`input` → JSON 字串化的 `arguments`） |
| 使用者 `tool_result` | `function_call_output`（`is_error` → `[tool error]` 字首） |
| 重放 `thinking` / `redacted_thinking` | `reasoning` 項目；簽名與遮蔽載荷保存在有界 `ocxr1` 信封中 |
| Function 工具 | `{type: "function"}`（`web_search*` → `{type: "web_search"}`） 帶有 `allowed_domains`、`blocked_domains` 或 `user_location` 的託管搜尋會從轉換後的 Responses/Chat 路由中移除；強制呼叫已移除的搜尋會回傳 400。有效的 `defer_loading` 函式定義仍可作為一般函式呼叫。參見[轉換限制](/zh-tw/guides/claude-code/#轉換路由上的搜尋限制與延遲載入工具)。 |
| `tool_choice` | `auto`→`auto`，`none`→`none`，`any`→`required`，指定名稱 function→`{type:"function",name}`，hosted WebSearch/web_search→`{type:"web_search"}` |
| `max_tokens` | `max_output_tokens` |
| `stop_sequences` | `stop` |

Claude Code 自動模式總是傳送 `stop_sequences`。對於路由目標提供者 `noStopModels` 清單中的模型，OpenCodex 在 Chat Completions 與 Responses 兩種線路上都會省略 `stop`，因此 grok-4.7、grok-4.6 等 xAI 推理模型不會回傳 `400 invalid-argument` 並被標記為暫時無法使用。參見 [`noStopModels`](/zh-tw/reference/configuration/providers/)。

在預期的 Anthropic 適配器上，保留未隱藏的簽名區塊（包括空 thinking）和不透明的 redacted 區塊。`hideThinkingSummary` 政策不變：不會向 Claude 用戶端公開本地隱藏的簽名文字，尚未證明經過此隱藏邊界的無損重播。舊版組合信封在串流文字發出後無法恢復原始區塊順序。`claudeCode.compatibility: "enforce"` 仍拒絕 thinking 重播。這不證明真實 Anthropic 接受請求或快取命中改善；[#3719](https://github.com/lidge-jun/opencodex/issues/3719) 仍未關閉。

**錯誤情況（400）：**JSON 格式錯誤；缺少/空的 `model`；缺少/空的 `messages`；不支援的
role；`tool_result` 缺少 `tool_use_id`；`tool_use` 缺少 id/name；指定名稱的 `tool_choice`
缺少 name。

### 轉換路由上的搜尋限制與延遲載入工具

當 `web_search*` 工具提供 `allowed_domains`、`blocked_domains` 或 `user_location` 時，
OpenCodex 會從轉換後的 Responses／Chat 目錄中省略代管搜尋，包含組合備援與搜尋附屬服務。
這些目的地無法一致地保留這些限制；搜尋絕不會被無聲放寬。重複的搜尋宣告無法繞過這條規則。
若強制使用代管搜尋，但沒有任何宣告留存，會回傳 HTTP 400。
第一方 Anthropic 目的地在轉換繼續進行時，仍會經由既有的伺服器工具通道收到原始的型別宣告；
原生直通則直接保留它們。不受限制的轉換搜尋，在既有的附屬服務與准入規則下仍然可用。

帶有 `defer_loading: true` 的有效函式定義，在轉換後的組合路由上仍可當作一般函式呼叫。
這種改為預先載入的降級本身不會造成相容性拒絕。強制模式仍會拒絕不支援的頂層延遲、沒有結構描述的延遲工具、
伺服器端執行的探索，以及不支援的探索歷史。符合資格的直接 Responses 路由可使用
[僅附加選用機制](#在用戶端工具載入時保留快取前綴)。

### 工具 schema 中的 Unicode 屬性樣式

為 JavaScript 撰寫的 JSON Schema `pattern` 可能使用 Unicode 屬性跳脫，例如 `\p{Cc}` 或
`\P{L}`。OpenAI 家族後端會用 Python 的 `re` 編譯 `pattern` 來驗證，而 `re` 不支援這些跳脫；
無法編譯的 schema 會被整個拒絕——所以單一內建工具上的一個這種樣式，會讓該工作階段中的每個
請求都失敗，而不只是該工具的呼叫。

為了讓一般的 Artifact 參數繼續運作，`openai-chat` 與 `openai-responses` 適配器路徑會在一般的
正向 schema 位置省略包含 Unicode 屬性跳脫的純量 `pattern` 限制。同層的其他限制、`required`、
字面資料與受支援的正規表達式則會保留。工具實作必須自行驗證輸入，因為被省略的限制不會由本
代理強制執行。

`patternProperties` 匹配器及其值 schema 維持不變。移除一個匹配器可能改變祖先層
`unevaluatedProperties` 所評估的鍵，所以單看局部的開放性不足以證明轉換是安全的。`not`、
`oneOf`、`if`、`contains`、`$defs` 與 `definitions` 底下的樣式同樣維持不變：放寬這些子樹可能
改變否定邏輯、分支選擇、匹配數量或參照的意義。

目的端會驗證這些保留下來的 schema。相容 ECMA 的目的端可以使用原始的正規表達式；無法編譯它的
目的端可能會拒絕該 schema。OpenCodex 不會悄悄用一份禁止先前有效引數的合約取而代之。

這是所選適配器路徑上的正規化處理，不是供應商層級的保證。供應商設定與驗證不受影響，使用不同
適配器的供應商也不受影響。

這是一項相容性措施，不代表每個自訂的 OpenAI 相容後端都會拒絕這些樣式。它的代價值得了解：
被省略的正規表達式不會被保留在任何地方，也不會在上游被強制執行，所以工具實作應自行驗證輸入，
而不是依賴 schema 來拒絕格式錯誤的引數。

## 出站轉換（Responses → Messages SSE）

| Responses 事件 | Messages SSE |
| --- | --- |
| `response.created` | `message_start` + `ping` |
| 心跳 | `ping` |
| 文字增量 | `content_block_start` → `content_block_delta`（文字）→ `content_block_stop` |
| 推理摘要/文字 | 帶重播簽名或有界 `ocxr1` 備援信封的 `thinking` 塊 |
| 遮蔽推理 | 從推理信封重播的 `redacted_thinking` 塊 |
| Function-call 幀 | 帶 `input_json_delta` 的 `tool_use` 塊 |
| 終止事件 | `message_delta` → `message_stop` |
| 在終止事件前 EOF | 502 風格的 `api_error` |

**停止原因對映：**`completed` → `tool_use`（如果有工具呼叫）或 `end_turn`；
`incomplete/max_output_tokens` → `max_tokens`；`incomplete/content_filter` → `refusal`。

**錯誤分類：**400 `invalid_request_error`、401 `authentication_error`、
402 `billing_error`、403 `permission_error`、404 `not_found_error`、409 `conflict_error`、
413 `request_too_large`、429 `rate_limit_error`、504 `timeout_error`、529 `overloaded_error`，
其他 5xx 為 `api_error`。`Retry-After` 以整數秒傳送（HTTP 日期會換算為剩餘秒數），上限為 8 天。

## 提示快取與 token 用量

**Anthropic 路由請求：**適配器會管理工具、系統內容和倒數第二條使用者訊息的快取斷點，以及頂層
自動 `cache_control`。穩定輪次通常能達到約 99.9% 的快取命中率。

**原生 OpenAI/ChatGPT 路由：**派生會話範圍的 `prompt_cache_key`（存在時取自
`metadata.user_id`，否則回退到系統內容雜湊）和用於快取親和性的 `session_id` 標頭。
快取鍵包含模型和完整的工具 schema。

**Token 計算：**Anthropic 輸出會從 `input_tokens` 中減去 `cached_tokens` 和
`cache_write_tokens`，並將它們分別公開為 `cache_read_input_tokens` 和
`cache_creation_input_tokens`。請求日誌會將其對映回包含這些值的 `inputTokens`，讀取量同時
記錄在 `cachedInputTokens` 和 `cacheReadInputTokens` 中，寫入量記錄在
`cacheCreationInputTokens` 中。Usage 頁面會分別報告快取命中和快取建立。

**count_tokens：**已路由模型使用近似值（序列化後的 system + messages + tools）。使用
`sk-ant-` 憑證的原生 Anthropic 模型會將請求透傳到真實的 Anthropic
`/v1/messages/count_tokens` 端點。

## 除錯捕獲

`ocx debug claude on|off|status|reset`、`OCX_CLAUDE_DEBUG=1` 或
`PUT /api/debug {"claude": true}` 控制入站捕獲。`GET /api/claude/inbound-debug` 回傳
`{enabled, entries}`（最新條目在前，環形緩衝區大小為 20）。

每個條目記錄：`at`、`endpoint`、`model`、`resolvedModel`、`stream`、`maxTokens`、
`thinkingType`、`thinkingBudgetTokens`、`outputConfigEffort`、`metadataKeys`、
`hasMetadataUserId`、`hasSystem`、原始 `anthropicBeta`，以及 user id / system 的八字元
HMAC 等值標籤。**不會儲存提示文字、原始物件或跨執行穩定的雜湊。**停用 Claude 除錯會立即
清空環形緩衝區。

## GUI（Claude 頁面）

儀表板的 **連線 → Claude** 在同一頁面顯示 Claude Code 設定。**Claude Desktop** 是 **連線** 下的另一個分頁。連線概覽中的 Claude 卡片也提供同一個連線開關。
頁面由上到下依序顯示：

- **Claude Code CLI 第一方** 開關。
- **開始使用**：`ocx claude` 和手動環境變數區塊。
- **一般**：Fast Mode、自動上下文、壓縮閾值和子代理自動註冊設定。
- **背景輔助模型**：選擇用於聊天摘要、主題識別等背景工作的模型。
- **模型攔截**：將特定模型請求重新導向其他模型的 `modelMap` 編輯器。
- **可用模型**：`/model` 選單中模型別名的即時預覽。
- **Claude 連線** 開關。

頁面底部的儲存列在捲動時保持可見，顯示 **沒有變更** 或 **有未儲存的變更**。**還原** 撤銷未儲存的設定變更；**儲存** 儲存編輯後的設定。**Claude 連線** 和 **Claude Code CLI 第一方** 開關立即生效；**儲存** 永遠不會改變這兩個開關的狀態。

`GET /api/claude-code` 回傳有效預設值、設定、上下文視窗登錄表、有效環境變數、可用路由 ID、
別名和埠。`PUT /api/claude-code` 接受部分更新並保留省略的欄位；`null` 會重置
context/blocklist/compact-window 值。

## 疑難排解

#### 同時提供 GPT 的閘道後方的 Claude 模型

`appendOnlyToolLoadingModels` 無法修正經由 Responses 閘道路由的 Claude 模型。這類閘道可能把 `additional_tools`
提升回 Claude 最初的 `tools` 陣列，而 Claude 會在系統提示詞之前快取工具，所以載入工具的那個請求仍會未命中。
對於同時提供 Anthropic Messages、以金鑰驗證的閘道，請原生送出 Claude 模型，並用 `modelAdapters` 讓其他模型維持 Responses：

```json
{
  "protocols": { "rollout": { "managedMessagesNative": true } },
  "providers": {
    "my-gateway": {
      "adapter": "anthropic",
      "modelAdapters": { "gpt-example": "openai-responses" }
    }
  }
}
```

請在 `modelAdapters` 中列出供應商提供的每一個非 Claude 模型；未列出的會被當成 Messages 送出。
原生 Messages 會讓 Claude Code 的延遲工具定義與 `tool_reference` 結果留在原位，所以載入工具是附加到已快取的前綴，而不是取代它。
`claudeCode.stabilizePromptCache` 不適用於該路徑，在那裡也不需要；它仍有助於任何留在橋接上的 Claude 請求。
組合、策略、固定的 effort、合成資料列、網頁搜尋附屬服務與視覺前處理，都會讓請求留在橋接上，
詳見[轉換開關](/zh-tw/guides/protocol-paths/#分階段開關)。第三方相容供應商不會收到呼叫端的 `anthropic-beta` 值，
因此閘道必須能在沒有這些值的情況下接受這些請求。

### 在用戶端工具載入時保留快取前綴

對於**已驗證接受 `additional_tools` 的直接 Responses 路由**，可用選用設定保留用戶端 ToolSearch 的載入歷史，
而不是把每個探索到的函式加進最初的目錄：

```json
{
  "claudeCode": {
    "appendOnlyToolLoadingModels": ["my-gateway/gpt-example"]
  }
}
```

選擇器比對的是解析後的 `provider/model` 名稱，而不是選擇器別名。單一的結尾萬用字元（例如 `my-gateway/gpt-*`）
會選取一個已驗證的模型系列；不接受全域的 `*`。清單預設為關閉，最多 128 個項目，每個最多 512 個字元。
只有最終實體路由為直接 Responses 供應商的請求，才會得到對外送出的改寫。在晚期子代理備援或替換之後綁定轉接器時，
會再次檢查目的地；選取原始路由並不授權另一個備援。請求原本的目錄仍可供其他嘗試使用。
組合或策略請求即使被選取，仍會保留原本的目錄，因為它的備援可能無法維持依時間順序的位置。

OpenCode Go 的 Responses 端點與官方 xAI Responses 主機，即使被選取，也會保留原本完整的工具目錄。
這些目的地會把 `additional_tools` 攤平或拒絕，因此無法保留這種依時間順序的載入前綴。
對任何其他會把探索結果提升到頂層 `tools` 的閘道，請讓這個選用設定保持關閉。

這項最佳化需要字串型的 `metadata.user_id`，以及一個預先宣告的 `ToolSearch` 函式。
未使用的延遲定義在探索之前與之後，都不在最初的目錄中；成功的結構化 ToolSearch 結果，會在該位置加入它們目前已宣告的定義。
它絕不會依據參照文字授予工具，也不會恢復已撤銷的定義。在被探索之前就已使用的工具，以及被明確強制的未探索工具，仍留在最初的目錄中。
結構描述、嚴格性與呼叫／結果配對都會保留。缺少中繼資料、設定不存在或為空，以及原生 Anthropic 直通，維持既有行為。
格式錯誤的設定在寫入時會被拒絕；載入時的復原只會停用這個選用設定，而不會丟棄供應商。

這不是伺服器端延遲工具搜尋的支援，也不會改變相容性強制的准入，或在用戶端開啟工具搜尋。它適用於用戶端本來就會探索工具的情況。
它不保證快取命中：結構描述變更、撤銷、模型切換、壓縮與上游快取可用性，仍可能需要新的前綴。

### Windows Desktop 套用回報 `client_lifecycle_lock_failed`

若在存在許多舊鎖檔時 Desktop 套用停滯，請更新 OpenCodex。生命週期取得流程現在會先驗證已為私有的執行階段目錄，
再重複權限變更。必要的權限強化失敗時，它仍會拒絕套用。請保留現有的執行階段鎖檔；
在用戶端執行時移除它們，可能破壞處理程序之間的協調。

**Claude Code 顯示「Did 0 searches」** — 目前的版本會把已完成的 Responses `web_search_call` 項目，
轉換成成對的 Anthropic `server_tool_use` 與 `web_search_tool_result` 區塊，
包含 `usage.server_tool_use.web_search_requests`。若較舊的版本已完成搜尋、Claude Code 卻仍計為零，請更新 opencodex。

**附屬服務未啟用** — 對 `backend: "openai"`，請確認你已登入 ChatGPT，且有一個啟用的 `authMode: "forward"` 供應商。
對 `backend: "anthropic"`，請確認使用中的已儲存 Anthropic OAuth 帳號未被標記為 `needsReauth`。
沒有該憑證卻明確選擇 Anthropic 時，依設計會封閉式失敗。

**「claude.ai connectors are disabled」** — 你的 shell 中設定了 `ANTHROPIC_API_KEY` 或 `ANTHROPIC_AUTH_TOKEN`。
`ocx claude` 刻意不設定 `ANTHROPIC_API_KEY`；如果你已匯出它，請取消設定。
`ocx claude` 會注入 `ANTHROPIC_BASE_URL`、探索、自動上下文與已設定的模型槽位，但絕不會注入 `ANTHROPIC_API_KEY`。

**模型沒有出現在 /model 選擇器** — 確認已設定 `CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY=1`（`ocx claude` 會自動設定）。
執行 `ocx claude` 以重新整理位於 `~/.claude/cache/gateway-models.json` 的閘道模型快取。檢查 `claudeCode.enabled` 不是 `false`。

**連接埠變更後環境變數過期** — 若代理連接埠變了，舊的 shell 可能還留著過期的 `ANTHROPIC_BASE_URL`。
請開新的終端機，或重新執行 `ocx claude`。

**大模型卻仍有 200k 上下文上限** — 在選擇器選取 `[1m]` 變體，或啟用自動上下文（預設開啟）。
若選擇器沒有 `[1m]` 資料列，表示該模型的有效目錄上下文視窗可能低於固定的 829,800 token 下限。

**技能載入造成 token 數偏高** — 內建的 `claude-api` 技能（約 136k token）會在提到 Claude 模型時自動載入。
這對原生直通是正常的；在經路由的模型上，opencodex 預設會把它改成存根（`blockedSkills: ["claude-api"]`）。

**MCP 工具結構描述在第一輪就塞滿上下文** — 只要 `ANTHROPIC_BASE_URL` 不是第一方 Anthropic 主機，Claude Code 就會關閉 MCP 工具延遲載入。
這項檢查依主機而不是依模型判斷，所以適用於每一個 `ocx claude` 工作階段：設定了許多連接器時，
在你輸入任何內容之前，每個工具結構描述就已全部內嵌。請用下列設定重新啟用延遲載入：

```json
{ "claudeCode": { "toolSearch": true } }
```

此設定預設仍為關閉。**原生 Anthropic 直通**會保留 Anthropic 的伺服器端工具搜尋：用戶端仍會送出延遲定義，
Anthropic 則在探索之前不讓它們進入模型上下文。預設的轉換路徑並未實作該伺服器工具；
它會丟棄型別化的搜尋宣告，通常預先送出函式結構描述，這可能使用戶端的上下文計算低估供應商的輸入量。

對於以 [`claudeCode.appendOnlyToolLoadingModels`](#在用戶端工具載入時保留快取前綴) 選取的已驗證 Responses 目的地上、
由**用戶端執行的 `ToolSearch`**，另有一個狹窄的例外。對於該最終實體路由，這個選用設定會讓未使用的延遲定義留在最初的目錄之外，
並在成功的結構化探索結果處加入目前的定義。用戶端搜尋必須已能運作，且必須宣告一個預先載入的 `ToolSearch` 函式。
啟動器的 `toolSearch` 設定可在用戶端支援時啟用用戶端探索，但本身並不會啟用這個選用設定，也不提供伺服器端搜尋。
請在啟用之前驗證這組用戶端與閘道的組合；對其他第三方路由請保持關閉。相容性強制的准入不變，仍可能拒絕不支援的延遲請求。
這兩項設定都不保證快取命中，也不保證與原生工具搜尋完全等同。

可接受的值遵循 Claude Code 自己的解析器：`true`、`"auto"`、`"auto:N"`（N 至少 100）與 `"force"`。
你自行匯出的值永遠優先於注入的值。

**子代理派到錯誤的模型** — 名冊代理（`ocx-*`）使用 `<!-- ocx-route: ... -->` 指令，而不是 Agent 工具的 `model` 參數。
請確認指令符合預期的路由。請省略 `model` 參數，而不要傳入佔位值。

在 `config.json` 中把 `claudeCode.stabilizePromptCache` 設為 `true`，即可在轉換後的路由上，從系統指示中剝除受支援的結尾 Claude 駕馭層通知。可辨識的 `<total_tokens>N tokens left</total_tokens>` 頁尾（包含重複出現的頁尾）會被丟棄。TaskCreate 提醒仍會移到結尾的使用者訊息；若只剝除了 token 頁尾，則不會新增輸入訊息。預設為 `false`。只有在這種角色變更適合你的用戶端時才啟用。它會保留圍欄範例與不相符的文字；原生 Anthropic 直通不變。沒有中繼資料的提示詞快取鍵之後會跟隨穩定後的指示。這不會建立對話身分，也不保證上游快取命中。

在每一條轉換後的 Chat 路由上，時間軸提醒都保留在對話中的位置，位於任何待處理的工具結果之後。
這樣可避免新附加的提醒改寫開頭的 system 提示詞，也避免對話中途的指示比它本應跟隨的回合更早送達。
該位置所帶的角色另行決定：提醒以 `system` 送出，除非供應商記錄了 `foldDeveloperRoleToSystem: false`
（表示上游接受 `developer` 角色，並會原位轉送）。不接受它的上游會回應 `400 role 'developer' is not allowed`，該回合也就無法開始，所以未記錄的目的地會折疊。
無論有沒有 `stabilizePromptCache` 都適用，原生 Anthropic 直通不變。快取重用仍需要穩定的工作階段身分與上游快取可用性。
較早的指示或工具的變更，以及對話壓縮，仍可能影響快取命中；僅保留提醒順序並不保證重用。

### 攔截權杖復原

執行中已通過驗證的代理會針對每個新的 CONNECT 請求驗證目前的權杖。明確重新套用第一方模式會
重新建立缺失的權杖，並重新整理自有的設定，不需要重啟代理；既有的通道不會被撤銷。無效、連結、
超大或非權杖的檔案會被拒絕而不會被覆寫。遇到這類項目時請先檢查，只移除已確認過時的權杖檔案，
再重新套用第一方模式；絕不要刪除其連結目標。

### 第一方 picker 的上下文標記

Desktop Code 分頁的 picker 會對權威上下文視窗至少一百萬 token 的路由模型加上 `[1m]`，讓 Claude 使用它的 1M 計算方式，而不是較小的自訂模型後備值。標籤、設定檔順序與供應商路由維持不變。未知與不到百萬的視窗維持不加標記，包括原生的長視窗選擇加入：picker 無法保證 Desktop 或遠端 runner 會收到相符的壓縮環境。`ocx claude` 搭配的自動上下文設定不變。既有的對話會保留它已儲存的選擇器，直到你從重新整理後的 picker 再次選擇該模型。

### Forced Claude Code subagent model

The Subagents page offers **Force all subagents onto one model**, off by default. Select an exposed roster-style id, such as `combo/tev-auto`, then enable the switch. The roster is offered first; unavailable saved roster entries cannot be force targets.

`ocx agent subagents force combo/tev-auto` sets `claudeCode.subagentModelForce`; `ocx agent subagents force -` clears it. `ocx agent status` reports the setting. `GET /api/subagent-models` returns `force`, `forceAvailable`, and `forceStatus`; `PUT` accepts `{ "force": "combo/tev-auto" }` or `{ "force": null }` without changing the roster. Omitting `force` leaves it unchanged. Invalid or unexposed targets are rejected on write; stale targets are reported and skipped at launch.

This takes effect on the **next routed `ocx claude` launch**, injecting `CLAUDE_CODE_SUBAGENT_MODEL` as an explicit proxy alias (with `[1m]` when the effective catalog window reaches the fixed 829,800-token floor, and only for a genuine 1M window on Anthropic Claude models and bare `claude-*` selectors; native Claude targets use a reversible native alias) and `CLAUDE_CODE_SUBAGENT_MODEL_FORCE=1`. Each nonempty shell-exported variable independently wins. Native launches inject neither variable; plain `claude` is not affected. No plugin files or `settings.json` are modified by this setting.

Claude Code **2.1.257 or newer** is required for FORCE. Plugin and built-in agents (including Explore/Plan) and per-call model arguments are overridden. Forks and subagent skills with `model: inherit` keep the main conversation model. The main loop and Haiku/small-fast sidecars are unaffected. Existing roster files remain available.

The dashboard warns about old or unknown CLI versions, unavailable targets, and either variable already present in `settings.json` → `env` (which overrides launch env). Detection is read-only and server-local: it cannot inspect another launch shell, another machine, or project-local settings. An unknown result is not proof of force support.

Explicit gateway selectors on a generated agent request take precedence over its legacy `ocx-route` fallback, even if the saved force setting changes after launch. For shell or settings overrides of generated roster agents, use an explicit gateway alias; bare Claude ids retain the older-client fallback behavior. Native aliases restore their bare model before the existing credential and model-map checks. Connected launches validate force targets against a fresh authenticated gateway catalog; failed discovery skips automatic force injection, and cached context windows alone never prove availability.
