---
title: CLI 供應商、帳號與模型
description: 供應商設定、憑證、配額與模型目錄指令。
---

這些指令設定上游供應商、認證帳號、管理憑證池，並控制暴露給 Codex 的模型目錄。

## 供應商

### `ocx provider <subcommand>`

非互動式供應商管理。Registry 項目依名稱播種；自訂名稱需要同時提供 `--adapter` 與 `--base-url`。

| 子指令 | 支援的旗標 | 動作 |
| --- | --- | --- |
| `list` | `--json`, `--jsonl` | 列出已設定的供應商與剩餘的 registry 項目。 `--jsonl` 為每個已設定的供應商輸出一行 JSON 物件。 |
| `add <name>` | `--adapter <adapter>`, `--base-url <url>`, `--api-key <key>`, `--default-model <model>`, `--set-default`, `--force`, `--json`, `--sync` | 新增 registry／自訂供應商。`--force` 覆寫；`--sync` 在人類輸出模式下重新整理執行中的代理。 |
| `edit <name>` | 供應商欄位旗標、`--headers <json>`、`--json` | 編輯已驗證的即時供應商欄位而不替換金鑰池。`--headers` 合併自訂請求標頭；傳入 `{}` 或 `-` 可清除它們。 |
| `test <name>` | `--json` | 探測真實上游模型端點。 |
| `show <name>` | `--json` | 顯示設定，API 金鑰已遮罩。 |
| `remove <name>` | `--json` | 移除非預設供應商；最後一個供應商無法被移除。 |
| `set-default <name>` | `--json` | 選擇既有供應商作為預設。 |
| `selected <name>` | `--set <ids>`, `--clear`, `--json` | 讀取或更新供應商模型允許清單。 |
| `quota` | `--refresh`, `--json` | 讀取供應商配額報告。 |
| `resets` | `--limit <n>`, `--json` | 列出最近偵測到的配額窗口重置事件。 |
| `presets` | `--json` | 列出儀表板供應商預設。 |
| `account-mode` | `pool`, `direct`, `--json` | 選擇池化或直接的 Codex 帳號路由。 |

```bash
ocx provider list --json
ocx provider list --jsonl        # 每個已設定的供應商輸出一行 JSON 物件
ocx provider test ark
ocx provider add anthropic --api-key sk-ant-... --set-default --sync
ocx provider add local-dev --adapter openai-chat --base-url http://localhost:11434/v1
ocx provider show anthropic --json
ocx models --provider anthropic --json
ocx models live --provider ark --json
```

`--jsonl` 僅輸出已設定的供應商，每行一個 JSON 物件，並且省略 `--json` 中的 `registryCount` 摘要。每個物件的欄位與 `--json` 輸出中 `configured` 陣列的元素相同。指令碼可以逐行處理這些物件。`--json` 與 `--jsonl` 不能同時使用。

:::caution[自訂標頭不是憑證通道]
`--headers` 用於非機密的請求中繼資料——路由提示、租戶或專案選擇器、追蹤 id。它**不是**放置驗證資料的地方，驗證器會拒絕標準憑證標頭名稱（`Authorization`、`X-Api-Key`、`Cookie` 等），並指向 `apiKey` / `authMode`。

驗證器無法辨識任意名稱（例如 `X-My-Token`），所以這條界線需要你自己遵守。這很重要的兩個原因：

- JSON 是命令列引數，所以其中的機密會留在 shell 歷史紀錄與行程清單中，在 CLI 進行任何遮罩之前，機器上的其他行程就能讀到它。
- 標頭值以明文形式持久化在 `config.json` 中，不像 API 金鑰有自己的儲存與遮罩路徑。

機密請一律使用 `--api-key` 或 OAuth 登入。
:::

## 認證

### 診斷缺失的主帳號配額

當該操作嘗試進行 WHAM 用量讀取時，`ocx account list openai --quota --refresh --json` 會在主帳號那一列附上一個 `quotaRefresh` 物件。既有的 `GET /api/codex-auth/accounts?refresh=1` 回應會暴露相同的診斷資訊。

其 `status` 可能是 `ok`、`not_reported`（成功回應中沒有可解析的配額）、`http_error`、`timeout`、`network_error`、`invalid_response` 或 `internal_error`。只有 `http_error` 包含數字的 `httpStatus`。這個物件不包含任何原始回應、錯誤訊息、憑證或帳號識別碼。僅限快取的讀取、憑證延遲，以及已失效的帳號快照都會省略它；較舊的伺服器同樣會省略。缺席不代表成功。即使錯誤內文無法讀取，非成功的 HTTP 狀態仍會回報為 `http_error`；`timeout` 與 `network_error` 描述的是收到標頭之前，或在讀取一個成功回應期間發生的失敗。

有效的登入不保證這個獨立的用量請求會成功。這些分類不會改變認證、帳號選擇或配額新鮮度規則，也不會把未知配額變成零用量。這項診斷目前只涵蓋原生主帳號，不包含池帳號的重新整理。回報配額缺失時，請提供分類與 HTTP 狀態，而不是憑證檔案或原始網路擷取。

### `ocx login <provider>`

啟動供應商已註冊的登入流程。OAuth 供應商會開啟瀏覽器並在 `~/.opencodex/` 下儲存憑證（可重新整理的 token 會自動輪替；像 OrcaRouter 這類耐久金鑰授權則會重複使用，直到供應商撤銷它們）；API-key 登入供應商會開啟其金鑰儀表板、提示輸入金鑰、在可能時驗證它，並儲存產生的供應商設定。當名稱缺失或未知時，指令會印出目前接受的 OAuth 與 API-key 供應商 id。

在 `ocx status` / `ocx doctor` 回報需要重新認證或終端 refresh 失敗後，請使用相同指令**重新認證**（或在儀表板中使用 Reauthenticate）。Codex pool 帳號不是上面那些 OAuth／API key 供應商，但 `ocx login codex` 可以到達：它會轉到帳號池登入，所以 `ocx login codex --reauth` 等同於 `ocx account reauth codex`。儀表板的 Codex 帳號池（Reauthenticate）也可以。這條路徑跑在 proxy 內部，需要 proxy 正在執行。

```bash
ocx login xai
ocx login anthropic
ocx login orcarouter-oauth # 瀏覽器同意 + S256 PKCE
ocx login orcarouter       # 貼上既有的 API 金鑰
```

OAuth 重新認證會保留維運方的設定，例如模型選擇、價格覆寫與帳號容錯移轉偏好。登入擁有的傳輸／驗證欄位與 registry 擁有的目錄中繼資料會被重新整理。即時探索供應商會保留其選定的預設模型；靜態供應商可以用重新整理後目錄中仍存在的模型，替換一個已不存在的預設模型。

對於 Antigravity，上游的 `401` 可以重新整理被拒絕帳號的 OAuth 憑證，並重試該請求一次。重試使用該憑證的 Cloud Code Assist 專案。若重新整理失敗，或沒有可用的專案，請求會回傳認證錯誤；請使用上方的重新認證流程。第二次 `401` 不會啟動另一輪重新整理／重試循環。

已在執行的 proxy 會在不重啟的情況下取得新憑證：CLI 會要求它從磁碟重新載入該供應商，而請求本身不帶任何憑證。若執行中的 proxy 無法接受該請求——最常見的原因是它啟動自早於 attested reload 的建置——登入仍會成功，憑證仍會寫入磁碟，但正在執行的行程會繼續使用舊憑證。CLI 會說明這一點並要求你重新啟動：

```
⚠️  A proxy is running but could not reload this provider (unattested-target).
   The credential is saved to disk; the running proxy keeps using the previous one.
   Restart it to pick this up: ocx restart
```

### `ocx logout <provider>`

移除供應商已儲存的 OAuth 憑證。

## 帳號與金鑰池

### 主帳號 99% 保護

在 **Codex settings → Multi-auth → Advanced settings** 中，**Block main account at 99%** 是 Ultra Fast 旁邊一個獨立的選擇加入選項。啟用時會先顯示後果；取消不會改變設定。即使 Advanced settings 已關閉，主帳號卡片仍會顯示監控中、未知用量或目前的政策封鎖狀態。

此政策在存在時使用 **5 小時窗口**，否則使用週窗口。僅有月配額的帳號使用其月窗口。它不會取所有窗口中的最高百分比。在開關保持開啟的情況下，一次全新的 **0%** 觀測會自動解除封鎖；下一次 99% 觀測會再次封鎖。未知用量不會被捏造成零，缺失的讀數也不會抹除已經量測到的封鎖狀態組。單靠預測的重置時間並不會解鎖。封鎖期間，既有的每分鐘一次背景週期會檢查全新的自有用量；失敗或無效的讀數會維持封鎖。其他暫停、重新認證與上游限制彼此獨立。

持久化的選項是 OpenCodex `config.json` 中的 `"codexMainAccountHardLock": true`，預設為關閉。這保護的是使用已識別主帳號的新請求，不是最後那 1% 本身：已在執行的請求、不相符的呼叫者自有 keyring 憑證，以及 proxy 之外的流量仍可以消耗配額。已新增的帳號與其他供應商仍可使用。

啟用保護時，一次自有的啟動會在原生設定檔復原與清理之後，還原主憑證的記憶體內身分繫結，所以持久化的 99% 封鎖在重啟後仍會存續。呼叫者自有的 Direct、exact-main、main-fallback 與 main-pin 請求，在繫結尚未完成期間可能短暫收到 503；健康的已儲存池帳號全程保持合格。這項初始化不會從外來或未確認的服務 home 讀取任何憑證。

當此政策封鎖主帳號時，該帳號上的 Luna Reserve 也會被封鎖。維持在一般配額耗盡之前可能會阻止 Reserve 啟用。關閉這個開關會恢復一般的本機處理方式，不會授予額外的上游權益。請使用帳號配額重新整理動作來取得一次全新的觀測；不會自動消耗 reset credit。

### Luna Reserve 與路由模型並存

選用的 [authless Desktop mode](/guides/codex-integration/#authless-codex-desktop-opt-in) 會讓 Desktop 原生的 Reserve-only 選擇器閘門保持停用。它也會停用 Desktop 自動的 Reserve 處理：Reserve 是明確的模型選擇，不是自動退回。

在 ChatGPT-forward 模式下保持內建 OpenAI 供應商啟用、啟用帳號模型選擇器，並為已儲存的主帳號設定公開選擇器。在有效的迴路 authless 模式啟用時，`ocx sync` 會在路由供應商模型旁納入 `<main-selector>/gpt-reserve`。裸 `gpt-reserve`、已新增帳號的選擇器，以及 API-key 模型探索都不會被加入目錄。對於遠端用戶端路由，或需要准入標頭的監聽器，authless 設定會被忽略。當公開與本機監聽器同時執行時，Reserve 相容性只適用於由本機監聽器准入的請求。已認證的公開請求即使源自同一台機器，仍走一般路徑；請求標頭無法選擇本機政策。

用 `ocx system settings --desktop-authless on` 啟用 authless Desktop 模式，執行 `ocx sync`，然後完全結束並重新開啟 Codex Desktop，讓它重新載入改寫後的設定與目錄。請遵循[標準 authless Desktop 工作流程](/guides/codex-integration/#authless-codex-desktop-opt-in)。

每個相容性請求都會檢查一次綁定憑證的伺服器授權，最多快取 60 秒。OpenCodex 在一次自有主帳號用量讀取上發送 Reserve 能力標頭，並要求一般用量被拒絕、出現 Luna Reserve 橫幅，且恰好有一個獲准的 Reserve bucket。缺失、被拒絕、過期或不相符的證據會拒絕該請求；它不會切換帳號，也不會悄悄改用一般的 Luna。被動用量可以撤銷授權，但無法建立授權。全域冷卻、暫停、重新認證與 99% 硬鎖定仍然適用。若想在已耗盡的主帳號上使用 Reserve，請停用硬鎖定；這麼做不會授予伺服器端的權益。這條相容性路徑支援對話請求與壓縮，Reserve 不能作為視覺或網頁搜尋輔助工具，也不能作為獨立的搜尋轉送模型。這些輔助用途請改選其他模型。

選擇器偏好真正的 Reserve 中繼資料。當尚未觀測到任何資料時，它會使用明確標記的 Luna 中繼資料轉接，依循 Desktop 的 Reserve-or-Luna 預設對應。可見的項目不代表可用性的證明。已檢查過 Desktop 原始碼與以 fixture 為基礎的路徑；尚未使用實際 Reserve 啟用中的帳號驗證這條相容性路徑。

### `ocx account <subcommand>`

透過執行中的代理列出並切換供應商帳號與 API-key 池。隨附的說明介面如下：

```text
Usage: ocx account <list|current|use|refresh|auto-switch|priority|login|reauth|code|cancel|remove|add-key|reset-credits|grok-reset-coupons> ...

list [provider]     Codex 帳號池、OAuth 帳號與 API 金鑰（識別碼依 API 回傳遮罩顯示）。
current <provider>  顯示現用帳號或金鑰。
use <provider> <id> 切換現用憑證；'main' 選擇 Codex App 登入。
refresh <provider>  強制重新整理 Codex 或供應商配額報告。
auto-switch <provider> <on|off|status|threshold N>  控制 Codex 池閾值。
priority <provider> <id|main> [first|earlier|normal|later|last|-100..100|reset]  選擇順序；省略數值則讀取。
remove <provider> <id> --yes  在存在檢查後移除已儲存的帳號或金鑰。
add-key <provider> [--label <label>]  僅從 piped stdin 讀取並新增金鑰。
login/reauth/code/cancel  從無頭 shell 執行瀏覽器或手動 code 認證。
reset-credits <id|main> [--consume --yes]  檢查或消耗 Codex reset credits。
grok-reset-coupons [<id>] [--consume --yes] [--token-id <token-id>] [--operation-id <uuid>]  檢查或兌換 Grok reset coupons。
切換現用帳號會立即生效；執行中的執行緒會在下一次請求時套用，進行中的請求則保留其擷取的帳號。
選擇順序的變更從下一個未繫結請求開始套用，絕不會移動已繫結的執行緒。
```

所有子指令都需要代理正在執行；CLI 自動解析其記錄的 runtime 連接埠。成功的操作離開 0。無效用法、未知供應商或帳號／金鑰 id、不可達的代理或 API 失敗則離開 1。憑證欄位完全依管理 API 回傳的方式顯示（包含其遮罩）；原始 API 金鑰與 OAuth token 永不回傳。顯示便利性在客戶端合成，與儀表板相同：`main` 是 `openai` 帳號池中 Codex App 登入的 CLI 別名，無電子郵件的 OAuth 帳號顯示為 `Account N`，而 plan／label 欄位在 plan、遮罩電子郵件、label 與遮罩金鑰之間回退。

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

### `ocx account list [provider] [--json] [--all] [--quota [--refresh]]`

未指定供應商時，列出 Codex 池、OAuth 帳號與已設定的 API-key 池。除非存在 `--all`，否則空的供應商會被跳過。指定供應商時，僅列出該憑證家族。人類輸出使用 `PROVIDER TYPE ID PLAN/LABEL PRIORITY STATUS`；手動選擇的 Codex 列標記為 `selected`。`PRIORITY` 是帶正負號的 Codex 選擇順序（未設定時為 `0`），對於順序不適用的列（例如 OAuth 帳號與 API 金鑰）則顯示 `-`。預設情況下，當儲存了兩個以上符合資格的 Kiro 帳號時，429 會自動輪換至另一個帳號，並優先選擇已知剩餘額度最多的帳號；輪換由帳號存在與否驅動，且無法關閉——`oauthAccountFailover.enabled: false` 拒絕的是送出前的帳號優選，而非 429 復原；`ocx account login kiro` 每次將一個帳號加入池中。空結果仍為成功。`--json` 回傳：

```text
{ accounts: AccountRow[], notes: string[] }
```

`--quota` 為支援 per-account 探測的供應商（目前是 Anthropic、Kiro 與 Google Antigravity）加上一個 `QUOTA` 欄位，顯示每個帳號自己的用量。這是選擇加入的，因為 proxy 會對每個已儲存的憑證探測一次上游；預設清單仍是本機讀取。`--refresh` 會略過快取結果。沒有 per-account 配額的帳號顯示 `-`，探測失敗的帳號顯示 `unavailable`——空白會被誤讀為「沒有用量」而非「未量測」。`--json` 帶有每個帳號的完整細分，而不只是彙總後的窗口：

Google Antigravity 列帶有與供應商層級配額相同的 `Gem` / `Cla` 窗口，是根據該帳號自己的憑證與 Cloud Code Assist 專案 id 計算出來的。per-account 探測一律透過固定的對外傳輸與 Google 的 Cloud Code Assist 主機通訊，無論是否設定了 `baseUrl`：自訂的 base URL 是請求的路由選擇，不是已儲存憑證的 Google 帳務第二來源。沒有專案 id 的帳號，或探測被重新導向或失敗的帳號，會顯示 `unavailable`。

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

當登入了兩個以上的 Kiro 帳號時，429 會自動輪換到另一個帳號，並優先選擇剩餘額度最多的帳號。帳號是逐一新增的——`ocx account login kiro` 會交給 Kiro CLI 處理，並把新帳號附加到池中。

### `ocx account current <provider> [--json]`

顯示現用帳號或金鑰。無手動 pin 的 Codex 池會回報具優先權意識的自動選擇：先選出優先權最高的合格層級，再在該層級內依配額路由選出用量最低的帳號；另一個無現用憑證的家族回報該狀態並仍離開 0。`--json` 回傳：

```text
{ provider, type, activeId: string | null, autoSwitchThreshold?: number, account: AccountRow | null }
```

### `ocx account use <provider> <account-or-key-id|main> [--json]`

選擇既有的 Codex 帳號、OAuth 帳號或 API 金鑰。對於 `openai`，`main` 選擇 Codex App 登入。Codex 池選擇清除行程本地親和性並套用於下一個請求，包含來自既有可見任務的請求；代理重啟或親和性驅逐也可能使任務未綁定，而進行中的請求保留其擷取的帳號。這僅控制池路由；Direct 模式繼續使用呼叫者擁有／原生的 main 憑證。基於用量的主動切換、401/403 重新認證、429/retry-after 冷卻、排除，以及 pre-output 429/402 失敗復原稍後可能選擇另一個合格的池帳號。當基於用量的切換關閉時，這些復原路徑仍然活躍。OpenCodex 在帳號變更後重播對話，但供應商端的 prompt cache 可能是冷的。未知的供應商或 id 離開 1。
在 **401/403** 時，App 登入清除該帳號的行程本地親和性並要求重新認證。
在 **429** 時，opencodex 遵循 `Retry-After`、啟動帳號冷卻、清除親和性，並可能將請求輪換到另一個合格的池帳號。這些失敗轉換在 `autoSwitchThreshold: 0` 時仍然活躍；該設定僅停用基於用量的主動切換。
`--json` 回傳：

```text
{ ok: true, provider, type, activeId }
```

### `ocx account refresh <provider> [--json]`

對於 Codex 池，請使用 `ocx account refresh openai [--json]`。它強制重新整理帳號配額並印出可用的週／月百分比與重置時間；缺失的配額資料被回報為未知，而非 0%。其 JSON 封裝為 `{ accounts: AccountRow[] }`，每個 Codex 列上有 `quota`。

對於 OAuth 與 API-key 供應商，這會強制重新整理供應商配額報告端點；它不是 token 重新登入或普通的帳號清單重新讀取。`--json` 回傳
`{ provider, report: ProviderQuotaReport | null }`。無支援配額報告的供應商會印出
`no quota report available for <provider>` 並離開 0。未知供應商與管理 API 失敗離開 1；失敗或逾時的上游配額探測會降級為 null 或過時報告（離開 0），與儀表板的配額列一致。

### `ocx account auto-switch <provider> <on|off|status|threshold <0-100>> [--json]`

控制 `openai` Codex 帳戶池閾值，或儲存通用 OAuth 帳戶池閾值。`on` 儲存 80%，`off` 儲存 0%，`threshold <n>` 接受 0–100。通用池的閾值只有在 `pool.kernel` 開啟且 `strategy: "fill-first"` 時才參與選擇；旗標關閉時，儲存閾值不會啟用閾值切換。兩種情況下都不會改變供應商啟用設定或停用 429 錯誤後的輪替。通用池的查詢與修改結果使用伺服器確認值。通用池的 `poolEnabled` 是已儲存的供應商設定，`null` 表示未指定，並不代表繼承後的實際狀態。`inert: true` 表示閾值已儲存但未套用，`inert: false` 表示帳戶池正在套用它。沒有 `inert` 欄位表示能力未知，此時同樣不會回報 `enabled: true`。API 金鑰供應商、Anthropic 與無效值會被拒絕。

```text
openai: { provider, autoSwitchThreshold: number, enabled: boolean }
generic OAuth: { provider, autoSwitchThreshold: number | null, enabled: boolean, poolEnabled: boolean | null, inert: boolean | null }
```

### `ocx account priority <provider> <account-id|main> [<-100..100|first|earlier|normal|later|last|reset>] [--json]`

讀取或設定某個 Codex pool account 的選擇順序：**數值越高越早使用**，預設為 `0`，範圍是
`-100` 到 `100`。只有 `openai` Codex pool 有順序，其他 provider 會以 exit 1 結束。
`main` 指定 Codex Desktop 登入，它與其他 pool account 一樣有順序——`ocx account priority
openai main last` 就是把它保留為後備的方式。

預設字詞代表小整數：`first` 是 `+2`、`earlier` 是 `+1`、`normal` 是 `0`、`later` 是
`-1`、`last` 是 `-2`。`reset` 把帳號回復到預設並刪除其儲存條目。**省略數值時讀取**
目前順序，而不是寫入一個。

順序決定哪些帳號優先被考慮，而不是哪些可用：選取仍在合格帳號之間進行，取仍有配額
餘裕的最高順序層級，並讓 `accountPoolStrategy` 在該層級內選擇。暫停、冷卻與重新認證
不受影響。變更從**下一個未繫結請求**開始生效，而不只是新啟動的 session：一旦較高的
順序恢復餘裕，preemption 就會優先移動未繫結的請求。已繫結到某個帳號的執行緒通常會保留到該帳號被耗盡；重新認證失敗或配額冷卻仍可能提前解除繫結。一連串暫時失敗不再刪除仍有效的執行緒繫結：請求會改由其他帳號處理，繫結保留，該帳號恢復服務後任務會回到原帳號；若 10 分鐘後仍在失敗，繫結才會按常規解除。任何接受的
寫入也都會釋放手動「立即使用此帳號」的 pin——無論 pin 在哪個帳號上——包括寫入一個
帳號已經持有的順序；這是清除 pin 同時保留目前選取帳號的唯一方式。（透過管理 API 清除
active account 也會釋放 pin，但會一併丟掉該選取。）代理無法連線、未知的帳號 id 或超出
接受集合的值會以 exit 1 結束。`--json` 回傳：

```text
{ ok: true, provider, id, priority: number, preset: string | null }
```

### `ocx account login|reauth|code|cancel ...`

從無頭 shell 執行基於瀏覽器或手動 code 的帳號認證。請使用 `ocx account --help` 查看供應商專屬的指令形式。若已儲存 Codex 帳號登入，但其模型目錄的重新整理仍待處理，人類輸出仍會成功結束，並在 stderr 印出固定的 `ocx sync` 復原指引。`--json` 讓 stdout 保持可解析，並在完成的登入狀態中帶上 `catalogRefreshPending: true`，不附加人類可讀的警告。

`ocx account login openai --device` 執行 OpenAI 的裝置碼登入，而非瀏覽器回呼。當 proxy 主機沒有瀏覽器，或沒有任何東西能連到它的 `localhost:1455`（例如容器、VPS 或透過 SSH 連線的 hub）時使用它：

```bash
ocx account login openai --device --no-wait --json
# { "flow": "...", "url": "https://auth.openai.com/codex/device", "deviceCode": "ABCD-EFGH" }
```

在任何其他機器上開啟該 URL、輸入短碼，登入就會完成。不加 `--no-wait` 時，指令會輪詢直到完成為止；裝置授權的有效期是 15 分鐘，指令會等待這麼久，而不是瀏覽器登入允許的 5 分鐘，因為重點就是要讓你走去另一台裝置操作。`kimi`、`nous` 與 `github-copilot` 會把這個旗標當成 no-op 接受，因為它們唯一的登入方式本來就是裝置流程；沒有裝置授權的供應商會拒絕它。

在儀表板中，相同的登入方式由 add-account 對話框上的 **「Don't open a browser on the proxy machine」** 核取方塊選取。該設定本身就意味著維運方不在 proxy 主機前，而這正是回呼 URL 派不上用場的時候——所以勾選它會把 Codex 登入切換為裝置流程，改為顯示可複製的代碼。

### `ocx account remove <provider> <id|main> --yes [--json]`

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

確認 `reset` 之後，一次全新的用量讀取可以復原同一個帳號合格的既有共享 reset 衍生冷卻。已暫停的帳號、需要重新認證的帳號，以及被進行中探測擁有的冷卻，都排除在這項復原之外。確認消耗後若用量重新整理失敗或忙碌，不需要再消耗另一個 credit：請重新檢查用量，而不是重複 `--consume`。消耗成功不保證可路由；reset／重播、新鮮度與範圍限制請見[管理 API 復原合約](/reference/management-api/#codex-authentication-delegation)。

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

每個會變更狀態的命令都會回報執行中代理回傳的 canonical 有效 `CODEX_HOME`。這個路徑可能與
呼叫端的 `CODEX_HOME` 不同；支援 JSON 的命令以 `effectiveCodexHome` 暴露同一個值。

Version 1 支援基於檔案的 Codex 認證，以 AES-256-GCM 加密儲存的設定檔，並把加密金鑰放在
作業系統的憑證儲存中。`add` 在匯入產生的憑證之前先執行正式的 Codex 登入流程。切換設定檔
前請先關閉 Codex；成功的切換會保留本機任務與歷史記錄，然後要求重新啟動 Codex。使用
`doctor` 檢查設定檔狀態，使用 `recover` 完成或復原中斷的轉換。`switch` 接受設定檔 id
或其 label。

`reauth` 用 OpenAI 裝置碼（#3898）重新認證*既有*的原生主要身分，而不是註冊一個新設定檔。這是無頭 hub 的復原路徑：不需要本機 Codex App、`codex` 執行檔或 OS keyring。裝置登入必須為已持有原生主要位置的同一個 ChatGPT 帳號完成；憑證寫入被獨佔宣告與一份路徑／雜湊／inode 快照圍住，而指令輸出只帶有 flow id、驗證 URL、裝置碼與狀態。池登入路徑仍然只限池使用，並持續拒絕 `__main__`；對應的儀表板介面是 Codex Auth 主要卡片的「Re-login with device code」控制項。

v1 復原矩陣涵蓋交易檔已透過 rename 發布後 OpenCodex 程序退出的情況。它不宣稱在 OS 或
kernel 崩潰、突然斷電下仍具持久性：`atomicWriteFileAsync()` 不會 `fsync` 檔案或其父目錄。

加密 vault、切換 journal、復原標記與 journal quarantine 位於 canonical
`<real CODEX_HOME>/.opencodex-native-main-profiles` 目錄，因此共享該 Codex home 的每個
OpenCodex 實例只看到一個 owner 與一個復原狀態。明文登入暫存保持隔離在各個
`<OPENCODEX_HOME>/native-main-profile-staging` 目錄下。

在原生 main 流量或 journal 復原被受理前，lifetime owner 取得獨佔的憑證請求，且只清除
精確的 `auth.json.ocx.<pid>.<sequence>.tmp` crash 殘留。每個候選都必須是未變更 canonical
`CODEX_HOME` 下的單一連結 regular file；它會被截斷、flush 再 unlink。link/reparse 替換、
身分變更與其他歧義會讓原生 main 流量保持關閉，而近似名稱的檔案絕不會被自動移除。這保護
的是合作的 OpenCodex 崩潰，不是已經以相同 OS 使用者身分執行的惡意程序。該使用者與含有
`CODEX_HOME` 的檔案系統仍被視為可信，且截斷不保證從 copy-on-write 儲存、快照或 SSD
殘留中實體抹除。

Preview 建置使用 `<OPENCODEX_HOME>/native-main-profiles`。該配置絕不會被靜默匯入。如果
`doctor` 回報舊版設定檔狀態，請停止共享相同 `CODEX_HOME` 的每個 OpenCodex proxy。然後
把相符的 `*.vault.json`、`*.journal.json`、復原標記與任何被引用的 journal-quarantine
檔案一起備份並移動到 canonical 目錄，同時保留 owner-only 權限；或移除舊 preview 組合並
重新執行 `ocx account main register`。在多個舊 root 之間選擇，或在任何共享 proxy 作用中
時同時執行兩種配置，都不被允許。在 Windows 上，以舊的大小寫摺疊 home 身分為鍵的 preview
狀態必須重設而不是移動，因為其加密 AAD 與 OS keyring 身分刻意不重複使用。

## 模型

### `ocx models [subcommand]` · `ocx model <subcommand>`

`ocx model` 是 `ocx models` 的別名。無子指令時，列出已設定供應商中靜態播種的模型。`--provider` 過濾一個已設定的供應商，而 `--json` 回傳模型中繼資料。`live` 讀取執行中的目錄；`add`、`edit`、`remove` 與 `list-custom` 管理手動目錄項目；`enable`、`disable` 與 `provider` 控制可見性；`selected` 控制供應商允許清單；`context` 控制供應商 context 上限；而 `shadow` 管理背景 shadow-call 攔截。

儀表板提供的每個 per-model 操作在此皆可用，因此無頭安裝永不需要 GUI 來管理目錄。`add`、`remove` 與 `list-custom` 針對設定檔運作並透過目錄同步套用於執行中的代理；其餘與即時管理 API 通訊並需要代理正在執行（`ocx start` 或已安裝的服務）。

| 子指令 | 支援的旗標 | 動作 |
| --- | --- | --- |
| `list`（預設） | `--provider <name>`, `--json` | 列出已設定供應商中播種的模型。 |
| `live` | `--provider <name>`, `--json` | 讀取執行中的目錄，包含 runtime 探索的模型。列標記為 `native`/`routed`、`custom` 與 `enabled`/`disabled`。 |
| `price <provider/model>` | `--json` | 讀取模型已儲存的手動價格覆寫；無覆寫代表使用自動定價。 |
| `set-price <provider/model>` | `--input <rate>`, `--output <rate>`, `--cache-read <rate>`, `--cache-write <rate>`, `--auto`, `--json` | 以每百萬 token 的美元設定顯示價格。設定時必須提供 input/output；省略的 cache 費率會變為零。`--auto` 只移除這個模型的覆寫。 |
| `add <provider> <modelId>` | `--display-name <name>`, `--context-window <tokens>`, `--modalities <text,image,audio>` | 註冊供應商目錄未廣告的模型。 |
| `edit <custom-id>` | `--model-id <id>`, `--display-name <name\|->`, `--context-window <tokens\|0>`, `--modalities <text,image,audio\|->`, `--json` | 編輯自訂模型。`-` 清除欄位；`0` 清除 context window。 |
| `remove <custom-id\|provider/modelId>` | `--yes` | 刪除自訂模型。stdin 非互動終端時需要 `--yes`。 |
| `list-custom` | `--json` | 顯示所有自訂模型及其 `custom-id`（其他子指令所採用）。 |
| `enable <provider/model\|native-model>` | `--native`, `--json` | 使一個模型對 Codex 可見。 |
| `disable <provider/model\|native-model>` | `--native`, `--json` | 對 Codex 隱藏一個模型。 |
| `provider <name> <on\|off>` | `--json` | 在單次寫入中啟用或停用一個供應商的所有模型。 |
| `selected <provider>` | `--set <id,id...>`, `--clear`, `--json` | 讀取或替換供應商模型允許清單。`--clear` 移除允許清單，使每個模型都被提供。 |
| `context <status\|value <tokens> [--set-all]\|provider <name> on [--value <tokens>]\|provider <name> off\|all <on\|off>>` | `--json` | 讀取或設定 context-window 上限，全域或依供應商設定。`value <tokens> --set-all` 也會重新指向每個路由供應商（如同儀表板的切換開關）；不加此旗標時，該值只會成為預設值。`provider ... on --value <tokens>` 只為該供應商設定明確上限（`--value` 僅在搭配 `on` 時有效）。 |
| `shadow <status\|set> [model\|-]` | `--enabled <on\|off>`, `--json` | 讀取或設定 Codex 背景 helper 呼叫的替換模型。`-` 清除模型。`status` 亦回報 `sourceModels`，即代理攔截的 helper slug（預設：`gpt-5.6-luna`；0.144.x 以前的用戶端使用 `gpt-5.4-mini`，可透過明確的 `sourceModels` 覆寫還原）。 |

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

### 把一個模型標記為純文字

註冊供應商時可使用 `ocx provider add mine --adapter openai-chat --base-url https://example.com/v1 --default-model model-a --text-only`；針對既有供應商則使用 `ocx provider edit mine --model model-a --text-only`。`add` 可以使用 `--model` 或其預設模型；`edit` 則要求提供 `--model`。這個旗標只會把該確切模型的 `modelCapabilities.inputModalities` 更新為 `["text"]`，保留其他模型與軸向不變。

### 已快取的配額歷史

`ocx account history openai <pool-account-id> [--limit 1-200] [--json]` 在不聯繫供應商的情況下讀取已儲存的觀測值。輸出會區分實際觀測時間、WHAM 或回應標頭來源、窗口家族與用量百分比。每個帳號最多保留 200 筆觀測值，保存 30 天，並有全域儲存上限。

一般的 token 重新整理會保留歷史。重新認證、移除或帳號替換會讓舊的發布記錄退役。原生 main 與在登入發布之前執行的探測不會被包含在內。缺少歷史代表觀測不足，不是零用量。這個指令不會消耗配額。在觀測值支援的情況下，有效估計值帶有下方的限制。

當同一窗口的觀測值與可歸因用量足以支援時，歷史輸出也會包含有效回報 token 估計值。每個估計值都附有樣本數與低信賴度標示。配額捨入、外部用量與假設的 log-label 連續性會限制這項推論；它不是你的供應商 token 額度。缺失或被截斷的帳本證據會回傳證據不足。`--limit` 控制顯示的歷史筆數，不影響有界估計值的輸入。
