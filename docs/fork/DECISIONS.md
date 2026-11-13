# 維護決策

## 2026-11-11：桌面 app 每次啟動都問「A runtime is already listening. Take it over?」——排程 service 不再被提供接管，「Stay a guest」會被記住

**症狀（維護者實查，維護者機器）**：10100 埠是排程 `opencodex-proxy` 經 `~/.opencodex/opencodex-service-launcher.vbs` → `opencodex-service.cmd`（每 5 秒無限重開 `ocx start`）跑起來的 `C:\Program Files\OpenCodex\ocx.exe start --port 10100`。這三樣是 `ocx service install` 產生的（`src/service/state.ts` 的 `TASK`、`windowsServiceScriptPath`／`windowsLauncherVbsPath`；排程註冊與 wrapper 內容在 `src/service/windows-scheduler.ts`／`windows-taskxml.ts`）。桌面 app 每次開啟都跳接管對話框，按「Take over」會跟排程迴圈搶埠。

**根因（兩個，疊在一起）**：
1. 擁有權紀錄存在共用的 service install state（`ServiceInstallState.ownership`，格式 `{owner: "cli"|"desktop", installId, consentGeneration}`，只有 `ocx service claim` 經 app 核准後才寫；`install`／`repair`／`update` 只保留它，從不新增）。排程 service 安裝後沒有這個欄位，`ocx resolve` 回 `ownership: {kind:"none"}`，而 `none` 的設計語意是「註冊 service 的 CLI 安裝擁有 runtime」——app 的 `ownership::consent` 因此回 `AskFirstTime`，且 resolve 對「已註冊 service＋ownership-aware 的 CLI」回 `takeover: supported`，於是提示成立。
2. 該提示是「問一次、同意後永久擁有」的設計（`devlog/_fin/260921_app_runtime_ownership/070_decisions.md`），只有「同意」會留下紀錄（claim）；「Stay a guest」什麼都不留，所以拒絕的人每次啟動都被重問。

**決定（候選 (a)(b) 的組合，不做 (c)）**：
- **(a')** `ocx resolve` 在「有已觀察到的 service-registration（或 install state 遺失時，設定目錄裡仍有排程 wrapper 腳本／launcher 且 Task Scheduler 沒有證明該工作已不存在，`windowsServiceWrapperPresent`；已證明不存在、且沒有存活 wrapper 行程帶著該路徑的殘留檔不算登記——手動刪掉排程工作不會停掉已在跑的 wrapper 迴圈，它仍會拉起 `ocx start`；行程表讀不到、查不到排程、或有讀不到命令列的 wscript/cscript/cmd（已知 runtime pid 時只算它的祖先鏈，否則整張表）時保留為證據、方向是只會變訪客；沒有檔案就不查，行程列舉只在「有檔案且排程 absent」時做一次，上限沿用 `windowsProcessList` 的 5 秒）、且擁有者為無紀錄或 `cli`」時，把本來的 `supported` 改成 `blocked`／`service-managed`（`declineTakeoverOfRegisteredService`，`src/cli/resolve.ts`）。app 對任何 blocked 本來就走「以訪客附著、不問、不停任何東西」（`attach_plan` 的 `Blocked` 分支，沿用既有 supervisor 對非自己 runtime 的寬限復原），所以 Rust 端不需要新協定。選擇「resolve 時推導」而不是「service 啟動時寫入 owner＝service」的理由：(1) 不用新增 `ServiceOwner` 成員——`owner` 的聯集同時被 Node launcher 的契約（`install-state-contract.mjs`）、`preservedConsent`、`orchestrated-entry` 讀，改它是跨契約變更；(2) 維護者機器上的 service 是舊安裝，推導不需要重新安裝 service、也不需要等它重啟；(3) 「紀錄存在」要靠某次寫入，寫入點（install／repair）已被多個互鎖的租約與 CAS 守住，為了一個 UI 判斷去動它風險不成比例。代價：判斷看的是 service 登記是否存在，而不是「眼前這個 runtime 是不是它啟動的」；對這個問題無影響，因為只要登記還在，排程迴圈就會把停掉的 runtime 重開，接管本來就會跟它競爭。
- **(b)** 「Stay a guest」被 app 記住（`desktop/src-tauri/src/guest_choice.rs`，`guest-choice.json` 放在 app config 目錄，與 install id 同處）。鍵是「設定目錄＋擁有者宣告（owner／installId／consentGeneration）」，**不含 record revision**——service repair、update 會推進 revision 但不改擁有者，若含 revision 就會被日常維護洗掉。擁有者變了或換設定目錄就重問；核准接管會清掉該設定目錄先前的「不」；看到 `service-managed` 也會清掉（先前的「不」是在沒有 service 時給的，service 移除後擁有者又是 none，不清的話鍵會命中、`ocx service uninstall` 後的接管提示永遠不再出現）；只有真的按了按鈕才記，重試造成的 sender 被丟棄（`Err`）不算決定；檔案缺失／損毀／寫入失敗都退回「問」，不會變成靜默接管。
- **不做 (c)**（app 擁有 runtime、安裝時不建排程）：維護者已有排程 service 且依賴它保活與開機啟動；(c) 要改安裝流程並要求使用者重裝，且會讓 app 沒開時 `ocx-*` 子 agent 路由失效。

**「Take over 會搶埠」的處理**：被排程監管的 runtime 不再提供 Take over（上面 (a')）。想讓 app 擁有它的人走明確流程：`ocx service uninstall`（會刪 wrapper 三檔；完整解除安裝路徑 `uninstallServiceDetailed` 在排程工作已不存在時也會清掉殘留的 wrapper 檔，`removeWindowsServiceWrapperResidue`：有存活 wrapper 行程先停，停後最多重查三次（每次隔一秒，因 Stop-Process 非同步）；停不掉、讀不到行程表、或剩下讀不到命令列的 wscript/cscript/cmd（他人或提升權限的行程，kill 比對命令列所以看不到也停不掉，訊息請使用者從提升權限終端機重試）就不刪；kill 只殺 wrapper／launcher、不殺它拉起的 `ocx start`，所以完整解除安裝的前提是先停 proxy——`handleUninstall` 已是「proxy stopped」在「service removed」之前，測試釘住順序；kill 只比對完整絕對路徑 token，wrapper 鏈路徑都是產生時寫入的絕對路徑，相對或 8.3 別名不比對；檔案被鎖定不丟例外，回 `failed` 並印出檔名），之後 app 才會（問一次）接管。`ocx service claim` 沒有被這條規則擋住，也不需要擋：claim 要帶 `ocx resolve` 發的 compatibility token，而 `service-managed` 是 blocked，blocked 不發 token，app 因此沒有 token 可以 claim；claim 內部重驗的 `assessServiceTakeoverCompatibility` 並未套用 `service-managed` 規則（規則只在 resolve 層），所以手動帶有效 token 的 claim 行為與以前相同。

**行為變更與風險**：
- 有已註冊 service 的使用者不再能在 app 內一鍵接管（需先 `ocx service uninstall`）；這是刻意的取捨，換掉原本「按了就搶埠」。
- `ocx resolve --json` 的 `takeover.reason` 多一個值 `service-managed`（沿用 `ownership-unknown` 的做法，只在 resolve 層產生，不進 `ServiceTakeoverCompatibility` 的聯集）；舊版 app 不認得的 reason 只會當一般 blocked 處理。
- 擁有者為 `desktop`（本機或另一個安裝）的紀錄不套用 `service-managed`：service 對 desktop claim 會讓位，別的安裝要接管仍是真問題。
- 機器上既有的「Take over」對話框只在舊版 app 出現；裝新版後不需重裝 service。

**上游檔改寫**：`src/cli/resolve.ts`、`desktop/src-tauri/src/{ownership,startup,lib}.rs`、`structure/ops/desktop-supervision.md`、`structure/manifest.json`、`docs-site/src/content/docs/{,zh-tw/}guides/desktop-app.md` 與 `tests/cli/cli-resolve.test.ts` 是上游檔；`desktop/src-tauri/src/guest_choice.rs` 是 fork 新增檔。下次整合上游 tag 時，若上游同檔有改動，保留上游版本，再重放：`resolve.ts` 的 `declineTakeoverOfRegisteredService` 及其呼叫、`ownership.rs` 的 `Consent::Declined`／`consent_with_choice`／`subject_key`、`startup.rs` 的 `launch_consent`／`remember_guest_choice`／`forget_guest_choice` 與 `Declined` 分支。`tests/cli/cli-resolve.test.ts` 中原「both managers at or above the floor answer supported with a token」改為「無 service 登記」情境（有登記的情境現在是 `service-managed`）。

**驗證**：見 `ROADMAP.md` 近期表「維護者機器驗收桌面 app 不再跳接管對話框」。

## 2026-11-10：補回 `js/polynomial-redos` 修補（`1d102c6db`）的非結尾回傳值斷言與 Zen 計時覆蓋

**決定**：`1d102c6db` 把 `cursorLiveRosterScope`、Zen／Ark 的 base URL 正規化與 `normalizeProxyHostname` 的結尾斜線／點正規式換成線性掃描，cursor、Ark、proxy 三處各附一條 200k 非結尾連續字元（後接一字元）的計時測試，但那些測試不斷言回傳值。舊工作樹另有一批配套沒進 main，本次逐條比對後只補缺的部分：在 `tests/providers/cursor/cursor-catalog.test.ts`、`tests/providers/volcengine-ark-assistant-content.test.ts`、`tests/server/proxy-env.test.ts` 各加一條回傳值斷言（結尾 run 被剝除、後面接文字的 run 保留），不重複計時；在 `tests/adapters/openai/openai-chat-bounded-tool-names.test.ts` 加 Zen 長斜線測試（該呼叫點原本沒有任何覆蓋，故保留 1 秒計時；新增 `toolsToChatFormatForProvider` 匯入）。說明段落補在 `structure/providers/cursor.md` 與 `structure/transports/inventory.md`（含 `tool-schema.ts` 的 Zen／Ark base URL 辨識；`structure/providers/chat-compat.md` 已達 600 行上限，不擠進去）。

**上游檔改寫**：以上都是上游檔，改動只新增測試與說明段落，不動既有斷言與產品碼；下次整合上游 tag 時，若上游同檔有改動，保留上游版本再重放這幾段即可。

**價值驗證**：把三個產品檔（`src/adapters/cursor/catalog.ts`、`src/adapters/openai-chat/tool-schema.ts`、`src/lib/proxy-env.ts`）暫時還原到 `1d102c6db^`：main 既有的 200k 計時測試同樣變紅（本機 BelowNormal 實測約 21–22 秒），Zen 新測試也紅（超過 1 秒上限）；還原回現行版後皆綠。cursor、Ark、proxy 的新回傳值斷言保護的是「非結尾 run 不被誤剝」這個語意，與計時測試互補。

**略過**：舊工作樹 diff 中的產品碼與 `Cargo.lock` rustls 已在 main，不重複。

## 2026-11-04：多帳號 session／device／installation ID 隔離（`e04aae068`、`ba880dfae`、`007dbfd89`）

**決定一（採用，重放最終狀態）**：Pool 帳號對上游的身分識別碼不再共用。Claude OAuth：`metadata.user_id.device_id` 由帳號 UUID 確定性衍生，`X-Claude-Code-Session-Id` 由 token＋對話 key 衍生（`e04aae068`）。Codex Pool：`x-codex-installation-id`、`x-codex-turn-metadata.installation_id`、`client_metadata` 內的兩個欄位一律換成該帳號專屬 ID，涵蓋 Responses HTTP／WebSocket、compact、context-history、search、images、live、audio live／dictation、live-sideband 幀、vision 與 web-search 兩個 sidecar（`007dbfd89`）；帳號切換時 `x-codex-turn-state` 標頭與 body 內欄位一併清除（`ba880dfae`）。`ba880dfae` 的 HMAC(caller ID) 衍生被 `007dbfd89` 的私有 secret 方案整套取代，中間版不落地。

**決定二（原判延後；2026-11-04 同日改判為採用，已重放）**：首輪把三項視為「不是 ID 隔離、各自改變對外 wire 契約或客戶端身分宣稱」而延後。理由：維護者 2026-11-04 指示：上游做法合法可用即採用，不延後。因此後補（上游 `e04aae068`、`ba880dfae`，fork 檔案：行號見 `UPSTREAM.md` 同日節）：
- Claude Code 2.1.280 profile 對齊：OAuth 路徑 `User-Agent` 為 `claude-cli/2.1.280 (external, cli)`，key／相容路徑為 `@anthropic-ai/sdk/0.112.1`；`X-Stainless-Package-Version` 0.74.0→0.112.1、`X-Stainless-Runtime-Version` 固定 `v26.3.0`、`X-Stainless-OS`／`Arch` 改 SDK 命名（`Windows`、`x64`）、新增 `anthropic-dangerous-direct-browser-access: true`；`thinking-token-count`、`mid-conversation-tool-changes`、`advanced-tool-use`、`effort`、`extended-cache-ttl` 五個 beta 由「已知不轉送」改列「native client 可轉送」；vision 與 web-search 兩個 sidecar 的 UA 改 `claude-cli/…`。
- pool／main／`chatgpt.ts` 的 token refresh 改送 JSON body（`Content-Type` 與 `Accept` 皆 `application/json`，欄位 `client_id`、`grant_type`、`refresh_token`）；authorization_code 交換維持 form-urlencoded。pool refresh 回應缺 `access_token`（或為空白字串）即拋錯，不寫入憑證。登入 `originator` 由 `opencodex` 改 `codex_cli_rs`。
- `FORWARD_HEADERS` 新增 `version`，pool／main／direct 路徑把 Codex CLI 的 `version` 標頭轉送給上游。

**決定三（不適用）**：`claude-messages.ts` 的 web-search 可用性探測分支與 `claude-installation-helper.test.ts`（fork 沒有該探測）；`MuseToolCatalogCompatibilityError` 分類；`resolveConnectTimeoutMs`。

**行為變更與風險**：
- 後補項（決定二）的對外效果：Anthropic 看到的 Claude Code／SDK 指紋整批前進到 2.1.280／0.112.1，`X-Stainless-Runtime-Version` 是固定字串而非本機 Node 版本；token 端點收到的 refresh 是 JSON 而非 form，登入頁面看到的 `originator` 是 `codex_cli_rs`。兩者都是「讓 opencodex 的請求更像官方客戶端」，不改變授權範圍；若 `auth.openai.com` 之後拒絕 JSON refresh，現有的失敗分類（`classifyChatgptRefreshFailure`）會把它記成 refresh 失敗而不是靜默成功。回復方式是還原這三個 refresh 呼叫點的 body／header，不涉及持久化資料。
- 後補項的指紋值（`0.112.1`、`v26.3.0`、`2.1.280`）是上游釘的字串，fork 沒有對照真實 CLI 與 Anthropic 回應核對；沿用 `claude-cli-identity.ts` 的規則：升版時與 live GET 一起核對。
- Pool 帳號看到的 installation ID 不再是 Codex CLI 自己的值；Direct 與原生主帳號不變。
- secret 無法安全讀寫時 Pool 送出 503（fail closed），不沿用 caller 的 ID。Windows 要求 `<config home>/codex-installation-secret` 與其目錄先通過 required ACL 才寫入 key 位元組；config home 若在不支援 ACL 的磁碟，Pool 送出會持續 503。需要時的處置是把 config home 移到 NTFS，不是放寬檢查。
- `chatgptAccountId` 為空白的 `codex-accounts.json` 紀錄不再被視為憑證（同檔其他帳號不受影響）。
- 降版安全：secret 檔只是閒置檔案。Claude 側沒有新檔。

**驗證不自驗的範圍**：Windows 原生 ACL 案例（`codex-installation-acl.test.ts` 的 `native protected secret survives parent ACL propagation`）在本機 NTFS 實跑；因 fork 沒有 `verifySecretPathAcl`，以 `icacls` 輸出無繼承 ACE 作為「受保護 DACL」的判準（已確認未保護檔案會輸出 `(I)`）。

**水位**：`reviewed_through`、`reviewed_date`、`integrated_*`、PR、issue 水位全部不動；本批不是連續前綴。作者歸屬：三筆上游作者為 JUN，trailer 保留於採用提交訊息。

## 2026-11-04：CodeQL #602、#603（`js/file-system-race`）判 false positive，補一條 O_EXCL 釘住測試

**範圍**：2026-11-02 在 `3e40d628` 新出現的兩筆（這兩個檔案自該 commit 以來沒有改動）。與 2026-10-28 條目的判定一致：CodeQL 看到「lstat → open」就標，看不到之後的 fstat 身分比對。逐筆讀過資料流，兩筆都沒有「檢查後換檔仍被信任」的路徑。

| 告警 | 位置 | 判定 | 可在程式碼驗證的理由 |
| --- | --- | --- | --- |
| #602 | `src/claude/intercept/proxy-auth.ts:49` | false positive | `:45` lstat 要求自己擁有的一般檔、大小 43～45；`:49` 以 `O_NOFOLLOW｜O_NONBLOCK` 開檔；`:51-54` fstat 必須同為自己擁有的一般檔，且 bigint dev／ino 與 `:45` 的 lstat 相等（`sameFileIdentity`）；有界讀取後 `:67-68` 再比對大小與 mtime，`:69-70` 重驗路徑與父目錄身分才回傳 token。檔案或連結在中間被換掉，身分不符即拋錯，內容不被採信。Windows 沒有 `O_NOFOLLOW`，靠的是 `:53` 的身分比對，不是旗標 |
| #603 | `src/codex/catalog/write-audit.ts:129` | false positive | Windows：任何已存在的檔案在 `:125` 就被拒絕（`regularPrivateFile` 在 Windows 恆為 false），所以 `:129` 只會是 `O_CREAT｜O_EXCL` 建立一個不存在的路徑，路徑被搶先建立就 EEXIST；`:133-140` 再確認 fd 與路徑身分相同才加固 ACL。POSIX：`O_NOFOLLOW` 加 `:142` fstat 與 lstat 的 dev／ino／size／mtime／ctime 全等，`:146` 讀取後再比一次。任何不符回傳 `"skipped"`，審計本來就是 best-effort，不影響 catalog 結果 |

**不改產品碼的理由**：兩處的缺口（換檔）已由 fd 上的身分比對封住；再改成別的寫法只會換個 CodeQL 看得懂的形狀，不增加保護。#597（`link/diagnostics`）當時只靠 `O_NOFOLLOW`，在 Windows 不成立所以改為修正；這兩處在 Windows 靠的是 fd 身分比對與 `O_EXCL`，不依賴 `O_NOFOLLOW`。

**釘住性質**：`#602` 已有 `tests/claude-integration/claude-intercept-proxy-auth.test.ts`「adjacent NTFS IDs above 2^53 cannot substitute the credential」（fd 與 lstat 身分不同即回 null）。`#603` 原本沒有任何測試釘住 `O_EXCL`，新增 `tests/codex-integration/codex-catalog-write-audit.test.ts`「a file that appears between the absence check and the open is never adopted or written」：lstat 第一次回報不存在、隨後路徑上出現一個空檔，必須回 `"skipped"`、檔案維持空、不呼叫 `hardenSecretPath`。驗證：把 `O_CREAT | O_EXCL` 暫時改成 `O_CREAT`，該測試紅（Expected `"skipped"`，Received `"created"`），還原後綠。

**處置**：#602、#603 以 `false positive` dismiss，理由（含檔案：行號）寫在 GitHub 的 dismiss 說明（上限 280 字元）。查詢 `code-scanning/alerts?state=open` 回到 0 筆。

## 2026-11-04：CodeQL #604（`js/insufficient-password-hash`）判 false positive

**位置**：`src/adapters/client-fingerprint.ts:70`（告警建立於 `107bb8066` 時為 `:40`），`claudeCodeSessionId` 內的 `createHash("sha256")`。

**判定理由**：輸入是 `claude-code-session:<token>[:conv:<key>]`，`<token>` 為高熵的 API key 或 OAuth 綁定值，不是人選的密碼。輸出只被改寫成 UUIDv4 形狀放進 `X-Claude-Code-Session-Id` header（`:66-75`；沒有 token 時退回固定字串 `opencodex-anon`，不涉及秘密），讓並行對話拿到不同但可重現的 id；不儲存、不拿來驗證任何憑證。CodeQL 規則防的是「可猜的密碼被快速雜湊後遭字典攻擊」，對高熵 token 換成慢速 KDF 不增加保護，只增加每個請求的延遲。

**處置**：以 `false positive` dismiss，理由寫在 GitHub 的 dismiss 說明。不改產品碼。

## 2026-11-09：CodeQL 34 筆 open 警示逐筆判讀：修 4 筆（其中 #618、#623 仍 dismiss）、dismiss 32 筆

**範圍**：`code-scanning/alerts?state=open` 在 `57c5a284e` 有 34 筆。逐筆對照 `refs/upstream-tags/v2.98.0` 後，28 個被標檔案中 26 個與上游逐位元相同；只有 `provider-models.ts`（log 清洗、Vertex host 比對，與告警位置無關）與 `bounded-config-reader.ts`（只把過大檔的錯誤分類成 `EFBIG`，不動 `openSync` 與身分比對）有 fork 修正。判準沿用 2026-10-28 條目：CodeQL 看到「檢查再使用」就標；先看使用端是否在同一個 descriptor 上做了身分比對，有就是 false positive，沒有而且讀的是憑證或解除安裝清單才改。

**修正 4 筆（上游碼，沿用 2026-10-28 的 fork 修正作法：改走 `readBoundedRegularFile`／bigint 身分）**：

| 告警 | 位置 | 問題 | 修法與釘住測試 |
| --- | --- | --- | --- |
| #633 `js/file-system-race` | `src/lib/config-ownership.ts` `readBoundedJsonSized` | `lstat` 確認一般檔後以路徑 `readFileSync`，兩次解析同一個名稱；解除安裝清單（`.opencodex-uninstall.json`）在其間被換成別的檔就會被當成要刪的清單 | 改由同一個 descriptor 決定型別、大小與位元組。`tests/config/config-ownership-uninstall.test.ts`「a manifest swapped in after the type check is not adopted as the uninstall list」：讀取清單的那次 `lstat` 之後把清單換成多列 `victim.txt` 的版本，`victim.txt` 必須留著。先紅：還原原碼，`victim.txt` 被刪（`ENOENT`）；後綠 |
| #477 `js/file-system-race` | `src/oauth/store.ts` `readLegacyBackupEntries` | 同型：`lstat` 後以路徑讀舊憑證備份 `auth.json.pre-multiauth`，再把剩餘項目寫回備份；被換掉的檔案內容會寫進備份 | 改走 `readBoundedRegularFile`（上限 16 MiB）；備份不存在仍拋 `ENOENT` 讓呼叫端靜默略過，不可讀或被換掉回空物件（備份被移除，與原本「不可讀就移除」一致）。`tests/oauth/oauth-store-multi.test.ts`「a legacy credential backup swapped in after the type check is not rewritten into the backup」。先紅：原碼下備份內容為換進來的 `swapped-in-entry`；後綠 |
| #618 `js/file-system-race` | `src/codex/cli-update-files.ts` `observeCodexCliFileSet` | descriptor 身分比對已在，但 `lstatSync`／`fstatSync` 取的是 Number 型別 dev／ino；NTFS 檔案編號超過 2^53 時，只差最後一位的兩個檔案會被判為同一個 | 改用 `lstatFileIdentity`／`fstatFileIdentity`（bigint 身分，其餘欄位維持 Number），比對端不用改（兩側皆 bigint）。**先紅的方式**：無法造出編號超過 2^53 的檔案，也沒有可抽出的比對函式（比對寫在函式內）；改把 `observeCodexCliFileSet` 登記進 `tests/lib/file-identity-callers.test.ts` 的 `scopes`，該測試逐一檢查範圍內每個 stat 呼叫都帶 `{ bigint: true }` 或走 `*FileIdentity` helper。原碼下兩個新範圍各紅（`numeric stat: lstatSync(path)`／`fstatSync(fd)`），修正後綠；超過 2^53 的鄰近編號判為不同，則由既有 `tests/lib/file-identity.test.ts` 對 `sameFileIdentity` 的案例釘住 |
| #623 `js/file-system-race` | `src/update/orchestrated-live-identity.ts` `readRuntimeRecord` | 同 #618 | 同 #618（登記範圍 `readRuntimeRecord`） |

兩個 TOCTOU 測試都只在「讀取那一次」的 `lstat` 之後換檔（以呼叫堆疊上的函式名判斷），避免被其他函式對同一路徑的探測提早觸發。

**行為改變（#633、#477 的副作用）**：讀不出可信檔案編號（file index／ino 為 0，例如部分網路磁碟）時，`readBoundedRegularFile` 回 `untrusted-identity`。解除安裝清單的讀取因此改為拒絕，ownership 判 null，解除安裝不刪任何 owned 檔（偏保守）；舊憑證備份在不可讀、超過 16 MiB 或編號不可信時回 `{}`，整個備份檔被刪，不再只刪指定 provider 的項目。

**dismiss 32 筆（28 false positive、4 won't fix）；其中 #618、#623 已改 bigint 但仍保留 dismiss**，理由逐筆（含檔案：行號）寫在 GitHub 的 dismiss 說明：

| 規則 | 告警 | 判定 | 依據 |
| --- | --- | --- | --- |
| `js/insufficient-password-hash` | #607 #608 #609 #610 #611 #612 #630 #631 | false positive | 雜湊的是高熵 API key／PAT／識別碼，只用來當行程內或檔名的鍵（H2 連線池、探索 flight、模型快取範圍、affinity 檔名、turn-state 綁定）或 HMAC 證明；沒有任何一處儲存或驗證密碼，換成慢速 KDF 只增加每個請求的延遲。與 2026-11-04 #604 同判 |
| `js/stack-trace-exposure` | #614 #634 | false positive | `.stack` 只在 `crash-guard.ts` 與 `cli/secret-args.ts` 讀取（寫入日誌）；回應本文經 `ownedChatErrorPayload` 只含固定或白名單訊息；#634 的 `new Response` 是行程內重讀有界本文用，不送給客戶端 |
| `js/file-system-race`（身分已綁定） | #493 #479 #618 #619 #620 #621 #622 #623 #624 #625 | false positive | 讀取前後都在 descriptor 上比對 dev／ino（多數加 size、mtime、mode），換檔或換連結即拒絕。與 2026-11-04 #602、#603 同型。#618、#623 另已改 bigint 身分（見上表）；CodeQL 的 file-system-race 規則不模型化這個修正（它只看 lstat 後開檔的形狀），預期重掃後仍會標記，所以保留 dismiss |
| `js/file-system-race`（不改） | #480 #626 #627 #617 | won't fix | #480 的標記檔只決定是否刪除一個已驗為真目錄的暫存區，換檔無法改變刪除目標；#626、#627 讀隨套件安裝的宣告檔且 fork 關閉自我更新（`selfUpdateAllowed: false`），路徑不會執行；#617 是開發者文件產生器，只讀寫自己的 checkout |
| `js/file-access-to-http` | #615 #616 | false positive | 主機固定為 `127.0.0.1`，或為經身分檢查的 live proxy 自己記錄的 host／port（`runtimeBaseUrl()`），與其他 `ocx` 管理指令相同；2026-09-19 已有同型判定 |
| `js/polynomial-redos` | #605 #606 | false positive | 該正規式只在 `JSON.parse(args)` 成功之後執行（`tool-argument-integers.ts:317`），有效 JSON 的字串一定有結尾，全域掃描是線性；CodeQL 的最壞情況（未結尾字串）進不來 |
| 其他 | #632 #613 #628 #629 | false positive | #632 跳脫的是編譯期常數檔名；#613 的輸入是 repo 自己提交的資料檔；#628 寫入前已通過固定白名單 `boundKeys`（`path`、`pathext`、傳輸環境名），`__proto__` 進不去；#629 是 Bun Worker 與父執行緒的私有通道，沒有 origin，且處理器自己驗 request id、job id 與訊息形狀 |

**不改產品碼的理由**：上述 32 筆的缺口若存在（#618、#623 的 Number 精度缺口已另修），都已由使用端的描述子身分比對、固定白名單或前置的 `JSON.parse` 封住；為了讓 CodeQL 看得懂而改寫只會換形狀，還會讓每次上游整合在這些檔案上衝突。#633、#477 是唯二「檢查與使用各解析一次名稱、而且使用端沒有身分比對」的地方。

**處置**：dismiss 清單由維護者核對後執行；#633、#477 隨修正推送後由下一次 CodeQL 掃描關閉；#618、#623 預期仍被標記，重掃後若重現就依清單 dismiss。

## 2026-11-04：上游 tag 放 `refs/upstream-tags/`，不進本機 `refs/tags/`

**問題**：`tests/ci-workflows/release-version-line.test.ts` 讀本機 `git tag --list 'v*'`，要求 `package.json` 版本不落後最高 release tag。`UPSTREAM.md` 的同步流程用 `git fetch upstream --tags` 把上游 tag 拉進本機 tag 命名空間；本機有上游 `v2.94.0`～`v2.96.0` 時，`package.json` 還在 `2.94.0`，測試報 `package.json version 2.94.0 is BEHIND the highest release tag v2.96.0`。CI 不抓上游 tag 所以綠，本機紅。上游每次發版都會重現。

**證據**：`git ls-remote --tags origin` 只有 `v2.93.0`（fork 自己的 release tag，`c6360071`）；本機 `refs/tags/` 原有 313 筆，其中 306 筆 `v*` 不在 origin，全是上游 tag（另 6 筆 `compat-lab-*` 非 `v*`，未動），包含與 origin 同名但指向上游 commit 的 `v2.93.0`（`88aaa754`）。

**決定**：
- 上游 tag 一律抓進 `refs/upstream-tags/*`：`git fetch --no-tags upstream main "+refs/tags/*:refs/upstream-tags/*"`，並 `git config remote.upstream.tagOpt --no-tags`（每個 clone 設一次）。tag diff 重放法不變，只是把 tag 名寫成 `refs/upstream-tags/vX.Y.Z`。
- 測試不放寬：它在 fork 的意義正是「不落後 fork 自己發過的 release tag」。放寬會讓真正的版本回退也過關。測試註解補一句範圍說明。
- 本機整理只搬 ref：本機有、origin 沒有的 `v*` tag（306 筆）先 `git update-ref refs/upstream-tags/<tag> <物件>` 再 `git tag -d`；origin 已有的名稱（`v2.93.0`）不動，只在 `refs/upstream-tags/` 另存一份上游物件。
- `tools/check-upstream-updates.ts` 不讀本機 tag（只用 `upstream/main` 與 GitHub API），不受影響。

**新慣例**：不要再跑 `git fetch upstream --tags`；`refs/tags/` 只放 fork 自己的 release tag。

## 2026-10-23：stable 整合 v2.91.0（不帶入上游歷史）

**決定**：在以 tag `v2.91.0`（`83ec4f75a4cc97030c2fa7857e05e2ce222f376f`）為起點的暫存 worktree 上重放 `git diff v2.88.0 main` 的 fork overlay（398 刪除、251 新增／修改走 3-way patch，其中 9 個衝突檔），
方法與 `v2.76.0`、`v2.88.0` 相同：`main` 以單一 parent 的 commit 採用該 tree，不建立 ancestry bridge、不推送上游。`tools/upstream_baseline.json` 推進到 `v2.91.0`
（`reviewed_through`／`integrated_through` 同為 `83ec4f75a`，`reviewed_date` 2026-10-23；issue／PR 水位未動）。這一輪納入上游 77 個 commit，包含 `#7470`（拒絕 Codex runtime AgentAssertion 認證、限縮 dual_header assertion）與 `#7397`（OAuth 登入／匯入、service／update 路徑與 shim token 的加固，B5）；fork 在這些路徑沒有重疊修正者，全數直接採上游。

**版本**：`package.json`／`desktop/src-tauri/Cargo.toml`／`Cargo.lock`／`tauri.conf.json` 維持上游 `2.91.0`（`release-version-sources check 2.91.0` 通過四個來源一致），不前推；發版沿用 tag `v2.91.0`，MSI 版本為純數字 `2.91.0`。

**語系**：398 個既有刪除清單全數套用；上游這一輪沒有新增檔案層級的語系，但 `gui/src/i18n/*.ts` 與 `readme/*` 譯本的更新隨刪除一併丟棄，`docs-site/astro.config.mjs` 以 `.tmp/astro_tx.py` 對 v2.91.0 檔重新轉換（只留 `zh-TW` 翻譯，並維持 fork 拿掉 `Platform Support` 外部連結的差異）。
上游新增的 `gui/tests/account-pause-display.test.tsx` 寫死 fr／ko，改為 en／zh-TW。

**手動解的衝突檔**（9 個）
- `README.md`：取 fork 繁中版，補上游新增的「Code signing policy」段落（繁中，並註明 fork 的 MSI 未簽署）；上游 Windows 下載表的措辭改動不適用（fork README 沒有該表）。`README.en.md` 同步補同一段英文。
- `docs-site/astro.config.mjs`：見語系。新增側欄項目 `Fallback off`、`Windows Code Signing`。
- `docs-site/.../zh-tw/guides/combos.md`：取 fork 版為底，補上游新增的 `--description` 旗標與 `description` 欄位列。
- `docs-site/.../zh-tw/reference/cli/lifecycle.md`：取 fork 版為底，`/readyz` 身分欄位補上游新增的 `features` 及其說明（繁中）。
- `docs-site/.../zh-tw/reference/configuration/providers.md`：取 fork 版為底，逐列套用上游改動的 5 列（`cacheRetention`、`projectResponsesLiteHostedSearchHistory`、`noJsonSchemaModels`、`project`、`location`）；跨頁錨點改為 fork 保留的英文 heading slug。
- `docs-site/.../zh-tw/reference/proxy-formats.md`：fork 在此頁保留英文的 `Codex-native ordinary Lite hosted-search history` 段，改以上游 v2.91.0 英文新段取代。
- `scripts/test-layout/layout.json`、`tests/fixtures/test-layout-expected.json`：以上游為底（含新的 `test-home-guard-unpreloaded`），補 fork 的 `test-runner-temp-isolation`。
- `tests/ci-workflows/test-runner.test.ts`：維持 fork 已搬走 transpiler cache／TEMP 兩個 describe 的版本；上游在該 describe 新增的 `TMPDIR` 0700 斷言移到 `test-runner-temp-isolation.test.ts`。

**zh-tw 文件同步（`docs-zh-tw-parity`）**：上游 2.88→2.91 在英文頁新增的段落與程式碼區塊，以英文原文（連結改 `/zh-tw/`）插入 11 頁 zh-tw（`codex-integration`、`combos`、`remote-link`、`web-dashboard`、`cli/agents`、`cli/lifecycle`、`cli/providers-accounts`、`configuration/providers`、`management-api`、`proxy-formats`、`cli/messaging`）；`messaging` 的 fork 頁本來就是英文，整頁換成 v2.91.0 正文。新增 `guides/fallback-off`、`reference/code-signing` 兩頁（標題與描述繁中，正文暫英文；後者加 fork MSI 未簽署的提醒）。已翻譯段落的內文漂移不在結構 oracle 範圍，維持原狀。
**檔案大小 ratchet**：`scripts/test-layout/layout.json` 合併後 2001 行超過 2000 行上限，把 fork 的 `bounded-file-read`、`ci-watchdog` 兩筆併到相鄰行（1999 行），不調高任何 cap。

**新增 workflow**：上游新增 `windows-signing-test.yml`（SignPath 測試簽署，需祕鑰；只 `workflow_dispatch`），兩個 job 加官方 repo-only guard，fork 不執行。`fork-release-windows.yml` 不變：仍不使用 SignPath 或上游簽章祕鑰，MSI 未簽署。
`release.yml` 的上游簽署步驟隨上游進來，原有官方 repo guard 仍在。

**自動更新不指向上游**：`createUpdaterArtifacts: false`、updater `endpoints: []` 在新 tree 驗證仍成立。

**安全邊界逐檔判定**（上游與 fork 加固同檔者；原則：上游已提供相同保護就採上游，只在上游沒有時保留 fork 修正）

| 檔案 | 判定 | 理由 |
| --- | --- | --- |
| `src/lib/service-secrets.ts` | 合併 | 上游新增 `loadServiceTokenFromFile` 的 no-follow／有界／單行檢查（B5）；fork 的 `readServiceApiTokenState`、`readTokenBackupState` 改走單一 descriptor 的有界讀取，兩邊是不同函式，並存 |
| `src/oauth/store.ts` | 合併 | 上游加暫停細節、roster 通知、設定鎖；備份讀取沒有等效保護，保留 fork 的 lstat＋fstat dev/ino 比對 |
| `src/codex/auth-collision.ts` | 合併 | 上游新增主帳號碰撞身分與 `readMainAuth`（建立在 `readCodexTokensResult` 之上）；上游沒有 token／account id 字元集驗證，保留 fork 的嚴格驗證 |
| `src/lib/redact.ts` | 合併 | 上游把 `x-openai-agent-assertion` 加入敏感標頭與標籤清單（#7470）採上游；fork 的換行 barrier 保留 |
| `src/server/responses/codex-ws-exchange.ts` | 合併 | 上游只加 metadata seed；fork 對失敗訊息的 redact／單行／長度上限保留 |
| `src/client/connect.ts` | 合併 | 上游加 link apply lock 與 apply receipt；fork 的 `readBoundedRegularFile` 單次 open 保留 |
| `scripts/test-temp.ts` | 合併 | 上游加 `mkdir` mode `0o700`；fork 的 marker fd 讀取保留 |
| `tests/service/service-secrets.test.ts` | 合併 | 上游新增 token 檔案載入案例；fork 對 fd 讀取與 fsync 模式的案例保留 |
| 其餘 fork 加固檔（`shim-probe`、`shim-state-file`、`proxy-auth`、`orca-auth-source`、`state-lock`、`windows-taskxml`、`transactional-install`、`managing-cli`、`vendor-probes-key`、`spill-inspect` 等） | 保留 fork | 上游這一輪沒有動這些檔 |

審查筆記（攻擊面推理）只放在 `.tmp/`，不入庫。

**本機驗證**：見 `UPSTREAM.md` 同日條目。

## 2026-10-19：stable 整合 v2.88.0（不帶入上游歷史）

**決定**：在以 tag `v2.88.0`（`6936d9885d8a9bda9301737affcbaf1a4ff00e17`）為起點的分支 `sync/v2.88.0` 上重放 `git diff v2.76.0 main` 的 fork overlay（391 刪除、3-way patch 後 52 個衝突檔），
方法與 `v2.76.0` 相同：`main` 以單一 parent 的 commit 採用該分支的 tree，不建立 ancestry bridge。`tools/upstream_baseline.json` 推進到 `v2.88.0`（`reviewed_through`／`integrated_through` 同為 `6936d9885`，`reviewed_date` 2026-10-19；issue／PR 水位未動）。

**版本**：`package.json`／`Cargo.toml`／`tauri.conf.json` 維持上游 `2.88.0`，不再前推 `2.89.0`——本次要用 tag `v2.88.0` 直接發 fork 的 Windows MSI（MSI 版本須純數字），前推會讓版本來源檢查與 tag 不符。`Cargo.lock` 取上游。

**語系**：非保留 locale 持續剃除，包含上游新增的 `pt`（`gui/src/i18n/pt.ts`、各翻譯表的 pt 區塊）與 `docs-site/.../{fr,ja,ko,ru,tr,zh-cn}/reference/configuration/advisor.md`；
`lab-translations.ts`、`desktop-compatibility-copy.ts`（新）、`status-codes.ts`、`vision-reasoning-labels.ts`、`native-main-translations.ts` 只留 en／zh-TW；`gui/index.html`、`shared.ts`、`catalogs.ts`、兩個 `bcp47()` 同步縮減。
上游測試中寫死 ko／ja／ru／pt／vi／de 的案例，改為 en／zh-TW 或刪除（`compaction-routing-panel` 的 ja／ru、`i18n-locales` 的 pt、`i18n-language-switch` 的 French、`theme-switch-dom` ko→zh-TW、`remote-link-route` vi→en 等）。

**衝突判定**（其餘依 v2.76.0 的原則：以上游為底、重新套 fork 修正）
- `src/lib/bounded-file-read.ts`／`tests/lib/bounded-file-read.test.ts`：add/add。上游新增同步 `readBoundedRegularFileSync(path, limit): Buffer`（`gentle-shell-path`、`integrations/config-io` 使用），fork 的 `readBoundedRegularFile`（判別聯集）早已被十幾處呼叫；兩者並存，測試合併為同一檔。上游對 shim state 讀取新增的 mode／uid 比對移植進 fork 的共用 reader。
- `src/codex/shim-state-file.ts`：保留 fork 以共用 reader 取代本地實作的結構，補上上游新增的 overlay state（`decodeOverlayState`、`stat` 回傳、`schema 2`）；對 `shim-migration`／`shim-overlay` 仍以原簽章匯出（`readShimStateFile as readBoundedRegularFile`）。
- `scripts/test.ts`：保留 fork 的 fresh-process 分批 runner，採上游新的 `getTestRunnerBun()`（固定 Bun 版本）並把 `testRunner` 傳入每個 lane 與重試；`resolveTestLaneEnvironment` 保留。
- `codex-app-server-processes.test.ts`：採上游新的 CIM 列舉寫法（取代 fork 的輪詢），保留 fork 新增的 fixture 測試所需 import。
- `.github/workflows/service-lifecycle.yml`：上游改成 PR 只跑 Linux 腿；與 fork 的官方 repo guard 合併成 `repository == 'lidge-jun/opencodex' && event_name != 'pull_request'`。
- `tests/ci-workflows/test-runner.test.ts`：auto-merge 後 2102 行超過 file-size ratchet 上限，將「transpiler cache isolation」與「Windows test TEMP recovery」兩個 describe 原樣搬到 `test-runner-temp-isolation.test.ts`（layout.json 與 expected fixture 同步登記），不調高任何 cap。
- `layout.json`／`test-layout-expected.json`／`file-size-baseline.json`：以上游為底，只補 fork 自有的 `ci-watchdog`、`fork-hygiene` 並移除 `docs-readme-translation-parity`。
- `structure/runtime.md`：取上游列（已含 fork 的 service.ts 句子）。
- zh-tw 文件（16 頁）：保留 fork 的繁中翻譯為底，把上游新增／改寫段落帶入（上游新段落未翻譯者先以英文呈現）；`docs-zh-tw-parity` 因此補齊 27 頁的段落、程式碼區塊與連結，並新增 `reference/cli/messaging.md`。英文 heading 錨點改為對應繁中 slug，`docs-site` 建置的 missing-fragment 清零。

**新增 workflow**：`catalog-async-contracts.yml` 為產品回歸（無祕鑰、不改 issue／PR），保留在 fork 執行；`dev-version-bump`、`cleanup-orphaned-workflows`、`codex-queue-helpers`、`desktop-installed-gate` 沿用官方 repo guard。
新增 fork 專屬 `fork-release-windows.yml`（guard `SanHsien/opencodex`；`workflow_dispatch(tag)` 或推 `v*` tag；windows-latest 建置未簽章 MSI，以 `GITHUB_TOKEN` 的 `gh release create/upload --repo SanHsien/opencodex` 發佈）。

**自動更新不指向上游**：`tauri.conf.json` 的 `bundle.createUpdaterArtifacts` 改 false、`plugins.updater.endpoints` 清空（保留 `pubkey`，plugin 設定反序列化與 `verify-release-assets` 需要它）。Rust 端 `tauri_plugin_updater` 仍註冊以維持可編譯；
無 endpoint 時檢查會在本機回報 EmptyEndpoints，不會連線上游（未改 Rust，本機無 Rust 工具鏈，交由 CI 編譯驗證）。`release-desktop-scripts.test.ts` 的期望值同步改為 false。

**審查後 nit**：`legacy-config-keys` 過大檔不再誤報 `not_a_file`，新增 `too_large` 原因（`readBoundedCodexConfig` 對過大檔丟出 code `EFBIG`，與 `prompt-text-probe` 的詞彙一致），補專屬測試；`context-compat.ts` 移除過時的註解。

## 2026-10-07：修復 v2.76.0 整合後 main CI（docs 建置、GUI 測試、test-runner 鎖測試）

- docs-site：`Header.astro` 語言選單只留 English／繁體中文（原列 8 個語系，造成 840 筆 missing-page）；zh-tw 頁面內的英文 heading 錨點改成對應的繁中 slug（約 40 筆 missing-fragment）。
- GUI 測試：`anthropic-pool-conditions`／`oauth-tos-warning-modal` 的語系數量斷言改為 `["en", "zh-TW"]`，韓文文案斷言換成 zh-TW 實際文案；`native-main-confirmation-layout` 改用仍存在的 `en`（原用已移除的 `de`，translator 在 CSS 斷言前就丟錯）。
- `tests/ci-workflows/test-runner.test.ts`：「bun test user lock」的 10 個案例漏傳 `env: queuedTestEnv`；CI 工作流設了 `OCX_TEST_NO_QUEUE=1` 時 `acquireTestRunLock` 直接回傳 `owner: null`，POSIX 5 案因此失敗。鎖實作與強化邏輯未動，測試補上隔離 env。

## 2026-10-03：stable 整合 v2.76.0（不帶入上游歷史）；4 筆採用候選已採用

**決定**：在以 tag `v2.76.0`（`249462bf570555aad103957025eea96f7489c7eb`）為起點的分支 `sync/v2.76.0` 上重放 fork overlay
（`git diff v2.67.0 main`：28 新增／193 修改／391 刪除），使 fork 產品程式碼回到「上游 v2.76.0 + overlay」。
`main` 以**單一 parent 的 commit** 採用這個分支的 tree，**不建立 ancestry bridge、不把上游歷史帶進 fork**：
本 fork 的壓縮歷史是維護者刻意的選擇（2026-10-06 確認）。已同步到哪一版記在 `tools/upstream_baseline.json` 的 `integrated_through`／`integrated_tag`。
package development version 照慣例前推到 `2.77.0`（package.json、`desktop/src-tauri/Cargo.toml`、`Cargo.lock`、`tauri.conf.json`）。

**重放分類**

| 類別 | 筆數 | 處理 |
| --- | --- | --- |
| a. 語系政策 | 391 刪除 | 全數剃除（上游在 v2.67.0 後新增的非保留 locale 檔也一併處理）；`astro.config.mjs` 以腳本對 v2.76.0 檔做同一組轉換（只留 `zh-TW` 翻譯），並驗證同一腳本對 v2.67.0 檔產生與舊 fork 檔逐位元組相同 |
| b. fork 新增檔 | 28 | 原樣帶入，上游沒有動這些路徑 |
| c. fork 修改、上游未動 | 128 | 直接採 fork 版 |
| c. 兩邊都動 | 65 | 40 個 3-way 自動合併、25 個手動解（見下） |
| d. 安全邊界檔 | 見下節 | 逐檔判定 |
| e. workflow 隔離 | 1 | 上游新增 `codex-queue-helpers.yml`，加官方 repo-only guard；其餘 guard 沿用 |
| f. 版本 | 4 檔 | `2.77.0` |

**手動解的衝突檔**：`README.md`（取 fork zh-TW 版，補上游新增的 OpenGateway preset）、`README.en.md`（同上）、`package.json`／`Cargo.toml`／`Cargo.lock`／`tauri.conf.json`（版本 2.77.0；serde／serde_json 與 Cargo.lock 取上游較新者）、
`docs-site/astro.config.mjs`、11 個 zh-tw 文件（`guides/claude-code`、`integrations`、`pi`、`providers`；`reference/adapters`、`cli/agents`、`configuration/{agents,providers,server}`、`management-api`、`proxy-formats`，逐段對照 v2.76.0 英文源決定採哪邊或兩邊併存）、
`gui/tests/locale-parity.test.ts`（以上游 v2.76.0 為底、剃除非保留 locale 的 DSH 文案區塊）、`gui/tests/remote-link.test.tsx`（`LOCALES` 長度斷言維持 fork 的 2）、`tests/adapters/anthropic/anthropic-pool-toggle-copy.test.ts`、
`tests/gui/oauth-tos-warning.test.ts`（locale 清單只留 en／zh-TW）、`tests/ci-workflows/test-runner.test.ts`（採上游新測試，改用 fork 的 `fullSuitePlan` 夾具）。

**安全邊界逐檔判定**（四筆 fork 安全 commit：`e9de140d8`／`6ff58ac72`／`c9fc69bed`／`e78ea34a9`）

| 檔案 | 判定 | 理由 |
| --- | --- | --- |
| `src/adapters/anthropic.ts` | 採上游 | 上游已用 `indexOf` 掃 `{…}` placeholder，修的是同一個 ReDoS，fork patch 丟棄 |
| `src/providers/quota/vendor-probes-key.ts` | 合併 | 採上游 MiniMax endpoint 重寫；fork 的精確主機比對（`matchesHostname`）重新套在 minimax-cn／Moonshot |
| `src/service/managing-cli.ts` | 合併 | 採上游的逐段加引號 `cmd /c` 與一次重試；保留 fork 對 Windows shim 不安全 argv 的白名單拒絕（改為允許空白，因上游引號處理已涵蓋） |
| `src/oauth/store.ts` | 合併 | 上游新增大量帳號欄位；fork 的 lstat＋fstat dev/ino 備份讀取保留 |
| `src/codex/shim-probe.ts` | 合併 | 上游只改 `BUN_BE_BUN` 環境；fork 的 fd 讀取保留 |
| `src/update/transactional-install.mjs` | 合併 | 上游加 `--cache` pin（#6288）；fork 的 marker fd 讀取保留 |
| `src/router.ts` | 合併 | 上游加 blocked-model redirect；fork 的快取身分變數改名保留 |
| `src/codex/catalog/provider-models.ts` | 合併 | 上游新增 Kiro／CodeBuddy 探索；fork 的精確 host 比對與 log 清理保留 |
| `src/client/connect.ts` | 合併 | 上游新增 sibling／abort signal；fork 的 `readBoundedRegularFile` 單次 open 保留 |
| `src/lib/redact.ts` | 合併 | 採上游 `f5e9fdaba` 的 XML 掃描重寫；fork 的換行 barrier 保留 |
| `src/service/windows-taskxml.ts` | 合併 | 上游重寫 wrapper（#6290／#6455）；fork 的左到右 comment／CDATA 剝除保留 |
| `src/client/state.ts`、`src/codex/auth-collision.ts`、`src/codex/orca-auth-source.ts`、`src/lib/bounded-file-read.ts`、`src/responses/state/spill-inspect.ts`、`src/service/ownership-mutation-lease.mjs`、`src/service/state-lock.ts`、`src/claude/intercept/proxy-auth.ts`、`scripts/test-temp.ts`、`scripts/setup-hooks.ts`、`scripts/file-size-ratchet.ts`、`desktop/scripts/linux-packaged-e2e.ts`、`gui/src/main.tsx`、`tests/service/service-secrets.test.ts` | 保留 fork 修正 | 上游沒有動這些檔，fork 修正原樣保留 |
| `src/adapters/cursor/catalog.ts` | 合併 | 上游只加 Sonnet 5.5 條目；fork 的 `-thinking-<level>` 後綴比對（ReDoS）保留 |

**4 筆採用候選**：`f5e9fdaba`（redaction ReDoS）、`89db85ff0`（Windows manager 指令 timeout）、`09cd45daa`（npm cache root，#6288）、`8a3a7762f`（locale 日期括號，#6290）
皆已含在 `v2.76.0`，**已採用**。`8a3a7762f` 的最終形在 `dev` 的 `115fa0322`（#6455，不在 `v2.76.0`）：
自 `upstream/dev` 選擇性採用（cherry-pick，保留原作者），含其測試與 `tests/fixtures/windows-standalone-pre-placeholder.cmd`。

**fork 專屬修正**：`src/claude/agents-inject.ts` 的 `NO_MODEL_ARG` 不再要求 dispatcher 傳 `model: "haiku"` 佔位符，改為「省略 `model` 參數」。
Claude Code 的 Agent 工具 `model` 參數優先於 frontmatter 與 `CLAUDE_CODE_SUBAGENT_MODEL`，呼叫沒有經過 proxy 時佔位值會真的讓子代理跑在 Haiku（上游 #6358 以 `not_planned` 關閉）。
`tests/claude-integration/claude-agents-inject.test.ts` 與兩份 `guides/claude-code.md` 同步；`~/.claude/agents/ocx-*.md` 需另行重新產生。

**Fork 的 workflow guard**：新增的 `codex-queue-helpers.yml` 只在官方 repo 跑；其餘沿用 2026-08-22 的清單。

**審查後修正（fix-first 四項）**
- `context-compat.ts`／`legacy-config-keys.ts`／`workspace-codex-sandbox.ts` 改用 `readBoundedCodexConfig`：與上游一致讀穿 symlink 的 `config.toml`（dotfile manager），上限改為該 reader 的 1 MiB，缺檔／過大／不可讀的行為不變（sandbox 檢查仍 fail closed）；`readBoundedRegularFile` 保留給 opencodex 自有 state 檔。
- `claude/intercept/proxy-auth.ts` 的 `readPinnedToken` 還原 open 前 `lstatSync`＋`assertOwnedNode` 與 open 後 dev/ino 比對（Windows 的 NOFOLLOW 為 0），保留 fork 的 `ensurePrivateDirectory` 重構。
- `shim-probe.ts`／`state-lock.ts`／`ownership-mutation-lease.mjs`／`transactional-install.mjs`／`oauth/store.ts` 的 lstat→open→fstat 讀取改以 `O_RDONLY | O_NOFOLLOW | O_NONBLOCK`（未定義者補 0）開檔，避免 lstat 後被換成 FIFO 而阻塞。
- `service/managing-cli.ts` 的 Windows shim 白名單加入 `~`（8.3 短檔名）；非 ASCII 的使用者 profile 路徑仍落到 "unknown"（fail closed）。

**之後的同步方式**：以 `integrated_tag` 為起點，`git diff <integrated_tag> <新 tag>` 套到 fork `main`（`git apply --3way`，衝突逐檔判定），驗證後推進 `integrated_through`／`integrated_tag`。`upstream` 只作本機參照，不推送、不 merge 上游歷史。啟用 policy routing／Anthropic 帳號池（`58a26f0c1`／`22c890c8d`）與 `#6491` 仍如前一條記載。

## 2026-10-03：v2.74.0..v2.76.0 只審不採（adoption pending；4 筆採用候選待決）

**決定**：84 commits（80 非 merge）／163 個 PR（其中 20 closed-unmerged）／26 個 issue 分組判定完成，未移植任何 commit；水位推進到
`v2.76.0`（`249462bf570555aad103957025eea96f7489c7eb`）、PR `#6507`、issue `#6504`。判定為 adopt 4／defer 53／skip 23，
逐組結論與缺陷證據見 `UPSTREAM.md` 同日條目。

**理由**：`git merge-base HEAD upstream/main` 仍為空，整棵採用 stable 的前提（ancestry bridge）與 2026-09-30 相同。
上一輪的觸發條件（上游修正 `#6288`／`#6290`）已成立，故列出 4 筆採用候選：`f5e9fdaba`（redaction ReDoS，fork 實測 O(n²)）、
`89db85ff0`（Windows manager 指令 timeout）、`09cd45daa`（npm cache root，`#6288`）、`8a3a7762f`（locale 日期括號，`#6290`；需手移植且應用 `dev` 上 `115fa0322` 的最終形）。
另有 fork 自有項目：`ocx-*` agent 說明要求傳 `model: "haiku"`（`#6358`，上游 `not_planned`、無修正）。

**觸發條件**：維護者決定移植上述候選或重建 ancestry bridge；啟用 policy routing 或 Anthropic 帳號池（`58a26f0c1`／`22c890c8d` 的缺陷在 fork 存在，目前本機設定未啟用）；上游修正 `#6491`（Windows 排程工作被停用後 `repair` 死胡同）。

## 2026-09-30：v2.67.0..v2.74.0 只審不採（adoption pending）

**決定**：395 commits／61 closed-unmerged PR／6 platform issue 分組判定完成，未採用任何 commit；水位推進到
`v2.74.0`（`cae9b553e9b882dd13781a7f3ee6f68c0dcc8c4f`）、PR `#6316`、issue `#6314`。逐組結論見 `UPSTREAM.md` 同日條目。

**理由**：`origin/main` 已壓成 root 歷史、與上游無共同祖先，整棵採用 stable 需先決定是否重建 ancestry bridge；
安全邊界檔（link relay、OAuth、keyring、plugin ACL）與 fork 的 CWE-367 修正重疊，須逐檔比對並讓 focused tests 通過才可採用。

**觸發條件**：維護者決定重建 ancestry bridge 並安排一次 stable 整合；或上游修正 Windows platform issue `#6288`／`#6290`。

## 2026-09-26（續）：一般 merge v2.67.0；src 交集為空、僅 2 個 zh-tw 內容衝突

**決定**：把上游穩定版本 `v2.67.0`（`4bc92294aa23a7edba75805095808d892efa72e2`）一般 merge 進本
fork，package development version 由 `2.67.0` 前推至 `2.68.0`。

**src 逐檔判定**：`e70b3d86f..v2.67.0` 上游改了 48 個 `src/` 檔案。fork 相對 v2.66.0 有 22 個
自己修改過的 `src/` 檔案（`git diff e70b3d86f 78ecab5d9 -- src`），兩個集合沒有交集，全部自動
採用上游版本，不需逐檔判定；fork 的 src 差異在 v2.66.0 與 v2.67.0 兩次合併前後逐位元組相同。

**語系**：延續既有政策，非保留 locale 的 26 個 delete/delete 衝突一併剃除；本輪沒有新增的
非保留 locale 檔案。`docs-site/src/content/docs/zh-tw/guides/claude-code.md` 與
`.../reference/cli/providers-accounts.md` 各有一處內容衝突，均以英文源逐句核對後判定
（見 `docs/fork/UPSTREAM.md` 同日條目），不是單純套用 `ours` 或 `theirs`。

## 2026-09-26：一般 merge v2.66.0；exec-tool-result-normalize.ts 雙軌並存

**決定**：把上游穩定版本 `v2.66.0`（`e70b3d86fb1201d7951dfeb25e09b7871c433047`）一般 merge 進本 fork，package development version 前推至 `2.67.0`。

**src 逐檔判定**：`src/adapters/exec-tool-result-normalize.ts` 的空輸出偵測，fork 在 v2.65.0 之後已把原本的 ReDoS 正規表達式改寫成左到右字串解析（`isEmptyExecOutputWrapper`），upstream 這輪則保留原本正規表達式但加上 atomic-group 式的 pin（`(?=(X))\1`）修同一個 ReDoS 洞。兩者對 well-formed 輸入行為等價，且既有測試 `tests/adapters/exec-tool-result-normalize.test.ts` 直接對 `EMPTY_EXEC_OUTPUT_REGEX` 斷言（upstream 這輪新增的三組測試也是）。判定：保留 fork 的 `isEmptyExecOutputWrapper` 作為實際呼叫路徑（所有 caller 已使用這個名字），同時保留 `EMPTY_EXEC_OUTPUT_REGEX`（採 upstream 修好的版本）供既有測試與外部呼叫者使用，不刪除任一方的公開介面。

**語系**：延續既有政策，非保留 locale（fr/ja/ko/ru/tr/zh-cn/de/vi）新增內容一併剃除，包含 upstream 這次新增的 `docs-site` 六語 `guides/remote-link.md`。`docs-site` 新增頁面 `guides/protocol-paths.md` 補上缺失的 zh-tw 翻譯（heading／fence 計數與英文源一致）。`docs-site/src/content/docs/zh-tw/reference/cli/providers-accounts.md` 合併時出現章節重複（`ocx account login/remove/add-key/reset-credits/grok-reset-coupons` 各兩份，因 upstream 把這些子指令的順序移到 `priority` 之前），已刪除舊序位的重複區塊，只保留內容較完整、順序與英文源一致的版本。

## 2026-08-28：最小移植 `#2557`，不提前重放 2.34

**決定**：把上游 `v2.33.0` 的桌面 app 探針修正接到本線：`listPackageProcesses` 用換行串 PowerShell，失敗回 `process_probe_failed`，CLI 不再說「沒在跑」。不因此把整棵 `v2.34.0` merge 進來。

**理由**：這是本線自己引用 `#2292` 之後立刻會痛的 Windows 洞。完整重放 overlay 仍是下一步，但使用端現在就可能打 `--restart-desktop-app`。

## 2026-08-27：批次審查 `v2.32.0`–`v2.34.0`，暫不合併；下次在 tag 上重放 overlay

**決定**：把 `6ae83b1f189c353935d4977bb01227484fbdb52b` 到
`80fff9a7f47332a4445df2b26ea175053fa55b0b`（`v2.34.0`）這段發版線當一批看完，
水位推進，但**不把上游 merge 進本線**。下次同步在 `v2.34.0` 上重放 overlay，
不要 `git merge` / `merge --allow-unrelated-histories`。

**理由**：

1. 2026-08-23 的 `chore: 壓縮歷史為單一提交` 是無父提交。本線與上游沒有
   merge-base。硬 merge 會變成兩棵不相關的樹對撞，衝突不可審。
2. 本線為 Windows 引用的 `--restart-desktop-app` 已在上游被 `#2557` 證明壞掉
  （PowerShell 用空白串陳述、探針失敗誤報成沒在跑）。正確解法是改吃上游檔，
   不是在 2.31 副本上再 cherry-pick 一次。
3. 上游多了 `cleanup-closed-pr-branches.yml`（排程、`contents: write`、刪關閉
   PR 的 branch）。進本 fork 前必須加官方-repo-only guard。
4. 514 筆 commit 的內容會隨重放進來；本輪不逐檔移植 Kiro／xAI／catalog 那些
   本線沒在用的路徑。

**維持不變**：不採用未合併的 open PR。不在本 fork 發 npm、不部署 docs-site。

## 2026-08-23：PR／issue 一律 `--state all`，並在 `dev` 上選擇性引用

**決定**：修正 2026-08-22 那條「上游的 PR 不是本 fork 的審查單位」。審查單位仍是 `main` 上的
release commit，但增加兩條：

1. 查 PR 與 issue **一律用 `--state all`**。未合併就關閉的 PR 永遠不會經由 commit 路徑抵達，
   而那正是「上游拒收、但可能對本 fork 有價值」的一類。
2. 已合併但只在 `dev` 的修正，若**本 fork 現在就會痛**，就選擇性引用，不等 release。

**理由**：`dev` 目前領先 `main` 69 個 commit，實測 `#2398` 的 merge commit 在 `dev` 不在 `main`
——「合併後會隨 release 進 `main`」在時間上可能是好幾週。本輪依此引用了兩支「讀取沒有上限」的
修正（`#2395`、`#2398` 前半），兩者的缺陷都在本 fork 的程式碼裡實查確認過。

**維持不變**：不逐筆採用未合併的 open PR。那是提案，不是上游已接受的變更；採用等於接手維護一份
還會變動的補丁。逐項證據與觸發條件記在 [`UPSTREAM.md`](UPSTREAM.md)。

## 2026-08-22：上游的 PR 與分支不是本 fork 的審查單位，issue 只追 platform

**決定**：不逐筆評估上游的 open PR（43 個，全部 base 在 `dev`）與分支（71 個，多為那些 PR 的
head）。審查單位是 `main` 上的 release commit。issue 只追 `platform` 標籤，並在
`tools/upstream_baseline.json` 記 `reviewed_issue_through` 水位；`check-upstream-updates.ts`
只報水位之後的新 issue，`gh` 不可用時報「未檢查」而不是「沒有待審」。本次分流到 `#2379`。

**理由**：上游 PR 合併後本來就會隨 release 進 `main`，事前逐筆看等於把同一份改動看兩次，
而且看的是還會變動的版本。反過來，把 40 幾個 PR 與 50 幾個 issue 每週報一次，會讓這支檢查
變成固定紅燈——喊狼來了的檢查沒有人看。`platform` 是唯一會改變「本 fork 要在 Windows 上驗
什麼」的類別，值得每週問一次。

**已知結論**（避免下次重推）：`ci.yml` 的 `windows <shard>/4` job 只有 `workflow_dispatch`
會跑，所以 Cross-platform CI 的綠燈不包含那套 shard；上游 `#2152` 記錄了那套 shard 既有的
六個失敗。本 fork 的 Windows 覆蓋來自 `keyring windows`、`npm-global windows-latest` 與
`fork gate (windows-latest)`。逐項證據見 [`UPSTREAM.md`](UPSTREAM.md)。


## 2026-08-22：文件與語系只留繁中、英文

**決定**：`README.md` 以繁體中文為主，英文另存 `README.en.md`。GUI 與 docs-site 只保留英文與繁體中文，刪除法文、日文、韓文、俄文、土耳其文、簡體中文。簡體中文瀏覽器對應到繁中。

**理由**：維護線以繁中溝通；多語系會跟上游每週翻譯衝突，也不符合本 fork 的使用場景。

## 2026-08-22：fork 可管理多帳號的 lidge-jun/opencodex

**決定**：fork [`lidge-jun/opencodex`](https://github.com/lidge-jun/opencodex)，保留 MIT 授權與完整歷史，預設分支維持 `main`。本線聚焦 Windows 開發 gate、fork CI、危險 workflow 隔離，以及逐筆審查的上游追蹤。產品 README 以繁體中文為主，英文另存 `README.en.md`。

**理由**：要的是「可管理多帳號」的那一個。此專案在 dashboard 管理 ChatGPT / Codex account pool（配額、affinity、failover），並把任意 LLM 接到 Codex / Claude Code。GitHub 上另有遠端桌面中介與 OpenCode 改名專案，名稱相近但不是這個。fork 當下 HEAD 為 `6ae83b1f189c353935d4977bb01227484fbdb52b`（`release: v2.31.0`）。

**限制**：

- 不把 fork 包裝成原創專案，不移除原作者與 MIT 標示。
- `README.md` 為繁體中文產品說明；英文在 `README.en.md`。
- GUI 與 docs-site 只保留英文、繁體中文語系。
- `CONTRIBUTING.md`、`MAINTAINERS.md`、`SECURITY.md`、`src/` 以上游為準。
- 上游更新必須逐筆審查。
- 本 fork 不發 npm、不部署 GitHub Pages。
- 帳號池只做路由與韌性，不拿來規避 provider 條款。
- 日常 PR 只打 `SanHsien/opencodex`。對上游開 PR 必須維護者這次對話明確同意回貢。

## 2026-08-22：禁止裸跑 gh pr create

**決定**：本 fork 開 PR 一律 `gh pr create --repo SanHsien/opencodex`。建完核對 URL owner。對上游開 PR 的唯一例外是維護者明確同意回貢。

**理由**：2026-08-22 裸跑 `gh pr create` 把維護骨架打進 `lidge-jun/opencodex#2373`。GitHub CLI 在有 `upstream` 的 fork clone 上預設 target 是母 repo。已關閉該 PR。禁止再犯。

## 2026-08-22：隔離會在 fork 上造成傷害或噪音的上游 workflow

**決定**：下列 workflow 加上 `github.repository == 'lidge-jun/opencodex'`，只在官方 repo 跑：

- `release.yml`（npm Trusted Publishing）
- `deploy-docs.yml`（GitHub Pages）
- `service-lifecycle.yml`
- issue / PR 治理：`enforce-issue-quality.yml`、`enforce-pr-target.yml`、`issue-triage.yml`、`pr-hygiene.yml`、`pr-labeler.yml`、`stale-needs-info.yml`、`cleanup-orphaned-workflows.yml`

**保留在本 fork 跑**：`ci.yml`（產品回歸）、`react-doctor.yml`、`issue-quality-tests.yml`。

**理由**：`release.yml` 在 fork 上若被手動觸發，有機會對 npm 做 Trusted Publishing。`enforce-pr-target` 會把 PR 逼去上游的 `dev` 線，與本 fork 的 `main` 工作流衝突。治理 bot 在個人 fork 沒有對應的 Copilot / CodeRabbit 設定，只會製造失敗與亂關 issue。

## 2026-08-22：本 fork 日常走 main，不跟上游的 dev PR 政策

**決定**：SanHsien 維護線以 `main` 為整合分支。只有維護者在這次對話明確同意回貢時，才對 `lidge-jun/opencodex` 的 `dev` 開 PR。

**理由**：上游 `main` 是 release 線、`dev` 是 PR 整合線。fork 若同時模仿兩條線，Windows gate 與上游同步都會加倍。clone 時已用 `--default-branch-only` 對齊 `main`。

## 2026-08-22：Dependabot 不啟用 npm

**決定**：不幫上游的 `bun.lock` / `package.json` 開 npm Dependabot。fork-owned workflow 的 action pin 用 CodeQL / checkout SHA，之後若要自動升，只開 `github-actions`。

**理由**：上游幾乎每天發版。對 lockfile 開 Dependabot 會與上游 merge 持續衝突。


## 2026-08-29：上游 PR 面向補上「關閉未合併」那一類

**決定**：`tools/check-upstream-updates.ts` 新增 `collectUnmergedPullRequests()` 與
`renderPullRequestSection()`，只列**上游關閉但未合併**、且編號大於 `reviewed_pr_through` 的 PR；
併進報告、`needs_attention` 與 `--strict` 的 exit code。workflow 補 `GH_TOKEN`。issue 面向維持
原本的 `platform` 標籤窄化，不動。

**理由**：本檔原本的判斷是「上游的東西反正會經由 `main` 的 release 進來，所以不追 PR」。那句話
對**已合併**的 PR 成立，而且只對它成立——**關閉但未合併**的 PR 永遠不會變成 commit，所以永遠
不會進來。`reviewed_pr_through: 2767` 就一直躺在 baseline 裡沒有任何程式讀，那一整類從頭到尾
沒人看。

窄化到「未合併」跟 `TRACKED_ISSUE_LABEL` 是同一個道理：上游關閉未合併的 PR 遠少於合併的，
所以這支檢查不會變成每週喊狼來了的那種——而喊狼來了的檢查會被忽略。

**fail closed**：`gh` 列舉不到時回 `undefined` 而不是空陣列，報告寫 Not checked，
`needs_attention` 與 exit 2 一起紅。「沒查到」和「沒有」在綠色報告裡長得一樣，只有一個是真的。

**證據**：`bun run typecheck` 乾淨；`tests/fork-hygiene.test.ts` 21 pass（新增 3 條）；實跑檢查器
發現 `#2767` 之後有 **23 筆**上游關閉未合併的 PR——移植前這 23 筆一律不會出現在任何報告裡。

**觸發條件**：逐筆讀那 23 筆、把採用／不採用理由寫進 `docs/fork/UPSTREAM.md`，再推進
`reviewed_pr_through`。在那之前每週的 upstream-check 會是紅的，那是真實狀態不是故障。


## 2026-08-30：31 筆「關閉未合併」的分類（水位不推進）

`tix` 補上之後，`#2767` 以上出現 **31 筆上游關閉但未合併**的 PR——這一類永遠不會經由 commit 軸
抵達，正是本 fork 只補這一類的理由（見上方 2026-08-29 條目）。本輪把它們分成三類：

| 類別 | 筆數 | 依據 |
| --- | --- | --- |
| 帶 `landed-via-maintainer` 標籤 | **11** | 上游自己的標籤，意思是維護者已另行落地。內容會經由 commit 軸抵達，不需要在 PR 軸另行決定 |
| `[WRONG BRANCH]` | **4** | 標題自述推錯分支（`#2823`／`#2824`／`#2829` 等 promote／release 動作）。沒有內容，只有分支機制 |
| **需逐筆讀 diff** | **16** | 下表 |

### 需逐筆判斷的 16 筆，以及它們與本 fork 的檔案重疊

重疊數字是「該 PR 動到的檔案裡，本 fork 也有幾個」——用來排優先序，不是判準本身。

| PR | 標籤 | 重疊 | 題目 |
| --- | --- | --- | --- |
| `#2793` | bug, hygiene-blocked | **51/78** | keyring 管理的原生 passthrough |
| `#2902` | bug | 6/18 | GUI sidecar 提示的行內保留 |
| `#2950` | bug | 6/9 | 額度到期無法解析時保留 capacity panel |
| `#2796` | bug | 3/4 | agentrouter 支援 openai-chat 身分與 framing |
| `#2927` | bug | **3/3** | service 每次啟動列舉一次機器，而不是每次檢查 |
| `#2949` | bug, review-ready | 3/4 | Bun 測試鎖的範圍限縮到使用者 |
| `#2884` | bug | 2/3 | 比對 `codex.opencodex-real` launcher 備份 |
| `#2935` | bug, review-ready | **2/2** | 把輪替後的 refresh grant 帶給閒置同帳號 |
| `#2947` | bug | **2/2** | proxy 設定持有 schema 不接受的值時仍能啟動 |
| `#2795` | enhancement | 1/5 | cursor 觀察串流中的 envelope echo 與 call-id 損壞 |
| `#2807` | bug | 1/2 | 每次 OAuth 429 輪替重新綁定憑證身分 |
| `#2904` | bug, hygiene-blocked | **1/1** | GUI log 表格依動態視窗高度設上限 |
| `#2938` | bug, review-ready | 1/3 | 用行掃描分類失敗的 exec wrapper |
| `#2951` | bug, review-ready | 1/2 | 丟掉沒有任何日期格式器能解析的到期時間戳 |
| `#2870` | bug, review-ready | 0/4 | 合併 prompt 探測並取消已放棄的探測 |
| `#2770` | documentation | 0/20 | devlog 紀錄 |

### 為什麼水位不推進

`reviewed_pr_through` 是單一數字，最低一筆未判定就不能往上推——推了等於宣稱中間全部審過。
`#2770` 是最低的一筆，所以本輪維持 `2767`。

同時 commit 軸上還有 **112 個 commit** 未審。

**下一步**：從重疊最高、且標籤是 `bug` 的幾筆開始逐筆讀 diff（`#2793`／`#2927`／`#2935`／
`#2947`／`#2904` 是 2/2、3/3、1/1 這種「動到的檔本 fork 幾乎都有」的），確認缺陷在本 fork
是否存在，再決定。做完最低編號那一筆才動水位。

## 2026-09-01：264 commits 維持 bounded defer

只看三筆入口修正，未證明其測試與 proxy 前提可分離；`80fff9a` 仍是唯一真 watermark。下一切片為
十筆 runtime/test commits，通過 Windows `tools\dev_check.ps1` 才能採用。

## 2026-09-06：在 v2.43.0 重放 overlay，不重作產品 patch

**決定**：從 `v2.43.0`（`06ec553630fa2ee51a96b5cbf694089021249194`）建立 replay tree，僅重放
fork 文件、Windows 維護工具、workflow guard、英語／繁中 locale 與 upstream watermarks；最後以
`ours` merge 保留舊 `origin/main` 為第二父系。`src/`、產品測試與 Astra 實作全部取 stable upstream。

**理由**：舊 fork 是 orphan history，直接 merge 會把過期的產品補丁與 v2.43.0 對撞。上游已完整提供
`gpt-6-astra` 支援，fork 再實作一份會造成 catalog、pricing、identity 與 subagent migration 漂移。

**ticket 水位**：已分流 closed-unmerged PR `#2768`–`#3717`（含 36 個
`landed-via-maintainer`，由 commit 軸處理；其餘 14 個不採用）及 8 個 `platform` issue
`#3245 #3320 #3376 #3449 #3464 #3494 #3522 #3661`；baseline 更新為 commit `06ec553...`、PR `3717`、issue `3661`。

## 2026-09-07：重放 v2.44.0，並採用三個關閉未合併 PR

**決定**：以上游 `v2.44.0` (`07b48da8fd63881e848d26e0bd50087864f5573e`) 作產品
tree，重放 fork overlay 與 Windows full-suite runner，再以 `ours` merge 保留舊 main
ancestry。另外保留原作者 commits 採用 `#3728`、`#3740`、`#3744`。
fork HEAD 不可重用已發布 tag 的 `2.44.0` 版本身分，因此本線將 `package.json`
推進到 `2.45.0`；這是 fork development line，不是上游 v2.45.0 release 聲明。

**理由**：v2.44.0 是 350 commits 的已發布穩定邊界，replay 可令產品檔案以上游為準，
且不帶回舊 fork patch。三個 PR 都被關閉未合併，所以不會自動隨之後 release
進入；其中兩個是可在本 fork 實查的 Responses 錯誤，一個是已有後端資料但 GUI
漏顯示的小型修補。上游 maintainer 對三者的審查均建議合併，原 PR 也有聚焦
回歸測試。

**維持不變**：本 fork 不發 npm、不部署 docs-site、對外不寫 upstream；GUI 與
docs-site 只保留英文／繁中。`reviewed_issue_through` 仍是 `3661`，因為本輪沒有新
`platform` issue。

## 2026-09-07：一般 merge v2.46.0；dev carry 等 stable

**決定**：把 `upstream/main` 的 `v2.46.0`
（`bba63222d3eeb5c8e397edae35798225e4fa1a6f`）一般 merge 進 fork，保留既有 overlay，
版本推到 `2.47.0`。commit 水位推到該 SHA，closed-unmerged PR 水位推到 `#3862`，
platform issue 水位維持 `#3661`。

**PR 分流**：`#3747 #3779 #3780 #3809 #3815 #3816` 的 maintainer landing 已在
v2.46 stable，不重放原 head；`#3769 #3837 #3839 #3840 #3841 #3843 #3845 #3849
#3856 #3858 #3860 #3862` 只在 v2.46 後的 `dev` release train，等待下一 stable 或本機
重現後再引用完整 landing；`#3853` 會以 workflow YAML 覆寫 `SECURITY.md`，拒絕。

**理由**：後一組不是「沒看」，而是 maintainer carry 已加入原 PR 沒有的 review 修正，且彼此
疊在仍前進的 `dev` train。直接搬原 PR head 會漏修，搬 stacked merge 會引入未發布依賴；在沒有
本 fork 專屬重現的情況下，stable `main` 是可驗證且可維護的採用邊界。

## 2026-09-08：OrcaRouter maintainer carry 等 stable

**決定**：`upstream/main` 沒有新 commit，platform issue 也沒有增量；closed-unmerged PR
`#3908` 的內容已由 maintainer 以 `#3921`／`c41232aa5e9981284acece3cedf81a36859dab05`
重作並合併到 `dev`。本 fork 不引用原 PR head，也不提前拆取 maintainer landing；
`reviewed_pr_through` 推到 `#3908`，其餘水位不動。

**理由**：這是新的 OAuth／credential／live-catalog 安全面，maintainer landing 已修正原 PR
的 provider icon 問題並保留 attribution；直接採原 head會漏修，提前採 dev landing 則會帶入
未發布依賴與本 fork 已刪除的多語 locale 衝突。它也沒有對應本 fork 現在已重現的缺陷，所以下一個
stable 是成本最低且可完整驗證的採用邊界。

## 2026-09-08：上游 v2.47.0 promotion 出現後立即轉為 stable merge

**決定**：在 v2.46 候選的 exact-SHA CI 完成後重新 fetch，發現 `upstream/main` 已新增
`6f71931dec81dffdfe40053d8df5074d40b3c406`（`release: promote 2.47.0 to main (#3929)`）。
一般 merge 此 152-commit stable 範圍，保留 fork 的繁中 README、英／繁中語系限制、workflow
guard 與 Windows runner；fork package 前推到 `2.48.0`。commit 水位更新到 promotion SHA，
PR／issue 水位維持 `#3908`／`#3661`。

**理由**：`#3908` 的 OrcaRouter 功能、maintainer `#3921` landing 與其後續修正現在已成為
stable 的一部分，先前「不拆 auth surface」的等待條件已滿足。採完整 promotion tree 可保留
上游審查與回歸修正；只需解已知 locale／README overlay 衝突，不再承擔 dev-only 依賴。

## 2026-09-08：納入 v2.47.0 final roster correction

**決定**：完整 suite 執行期間再次 fetch，發現 `upstream/main` 新增
`f7f890ff72a5ccccadb5a935c1ea106922562cd2`（`release: apply final roster correction to main
(#3933)`）。一般 merge 此 7-commit／3-file GUI-only stable 修正；PR 水位推到 `#3943`，
platform issue 水位維持 `#3661`。

**理由**：`#3933` 修正 refreshed subagent roster 與 fallback choices 的隔離，屬 v2.47 stable
勘誤；不採用會使 fork 與上游正式 stable 行為不同。其餘新 PR 仍在 dev 或 open，closed-unmerged
項目已有 maintainer landing，等待下一次 stable 可避免拆取未發布依賴。

## 2026-09-08：一般 merge v2.48.0，defer 未發布 PR 與 platform issue

**決定**：把 tag `v2.48.0` / `9a27e86992d7a014e0aa92c046199b9fac148201` 的完整 stable
tree 一般 merge 到 fork，將 package development version 由 upstream release `2.48.0` 前推為
`2.49.0`。保留 fork 的英文／繁中語系、官方 repo-only workflow guards、Windows long-suite
runner（71 fresh-process batches、每 batch <=600 秒、整體 <=120 分鐘、serial lanes、124=incomplete）
及 run-lock hardening。

**理由**：相對 `b2d14b6` 的 73 commits 已是已標記 stable release；完整 merge 保留上游原始
attribution、整合測試及修正相依。closed-unmerged `#3944 #3949 #3950 #3951 #3953 #3995` 的
maintainer landing 已在此 stable commit 軸，不能也不需重放原 PR。`#3988 #3990 #4000` 仍只在
dev carry，`#3999` 還違反 fork locale 及 credential-surface 限制，均不提前採用。新 platform
issues `#4023`（macOS launchd stop ordering）與 `#4032`（hub context-window metadata）均未在
Windows fork 重現、亦無 stable fix；記錄 defer 與明確 re-review trigger，不自行改產品碼。

## 2026-09-09：一般 merge v2.49.0；不重放 superseded closed PR

**決定**：將 `v2.49.0` / `2f3f736299dca38861f8fb9c4326a4b4d7c664bc` 的完整 stable tree
以一般 merge 納入，package development version 由 upstream release `2.49.0` 前推至
`2.50.0`。保留 fork 的繁中 README、英文／繁中 locale、official-repo-only
workflow guards、Windows long-suite runner 與 run-lock hardening。

**理由**：`#4004 #4006 #4008 #4012 #4014 #4015 #4018 #4025 #4034 #4039 #4041
#4043 #4059 #4065 #4081` 均已有 `landed-via-maintainer` 的 stable carry；必須取 commit
軸而非重放 contributor head。`#4016` 由維護者以 `#3954` supersede，現行 stable
已含等價 Muse Spark Responses 路由行為；原 branch 同時帶有舊基底與審查發現的重複
結構，不宜再用。`#4107` 是 contributor 確認的 wrong-branch draft，未有 maintainer
landing，拒絕；僅在 Windows fork 重現或上游 stable landing 時重審。沒有新 platform
issue 超過 `#4032`，故 issue 水位不動；PR 水位則推進至 `#4107`。

## 2026-09-09：#4137 Spark quota header attribution 等 stable

**決定**：不採用 closed-unmerged `#4137` head；PR 水位推進至 `#4137`，commit 與 issue
水位維持不變。

**理由**：作者在關閉說明中確認 `#4137` 已被 merged `#4128` supersede。`#4137` 的
`CodexQuotaScope` positional API 與 `#4128` 已落 `dev` 的 `{ modelId }` API 不相容，且後者
已將 Spark 5h 歸入 `customWindows`、保留 shared/custom windows，並包含較強的跨路徑回歸覆蓋。
目前 `upstream/main` 沒有新的 commit，因此以 fork-only 重放舊 head 會製造未發布依賴與未來
衝突。下一個 stable 若包含 `#4128` 即完整採用；若此前 Windows fork 重現同一 header attribution
缺陷，再以當時 maintainer landing 重新審查。

## 2026-09-10：一般 merge v2.50.0；保留 fork locale policy

**決定**：將 `v2.50.0` / `2d4d7a22381a2e497c2442902104619e25f937c7` 一般 merge 進候選，
並將 package development version 前推至 `2.51.0`。移除上游重新加入的非英／繁中 GUI、docs-site
與 README locale；同時移除只適用於完整多語 README 集合的 upstream parity test / manifest，並從
test-layout 登錄移除其條目。fork 既有 `fork-hygiene.test.ts` 保留為此政策的機器驗證。

**理由**：上游 parity test 的正確前提是每個 registered locale 都在磁碟；fork 的明確產品政策是
只維護英文與繁中，保留該 test 會讓每次上游文件同步產生假失敗。這不是停用任何 fork CI、CodeQL、
upstream-check 或 runner safeguard。主 README 採既有繁中完整說明、同步 stable version，並翻譯私密
漏洞回報通道；英文 README 保留英文入口。

**platform 分流**：`#4141` 的 launchd recovery 已由 v2.50 stable 完整採用；`#4106` 與
`#4182` 雖指出 Windows codepage / fresh scheduler-elevation 風險，均被 template bot 關閉且無
stable maintainer landing，故不在本次 stable-only sync 製造 fork patch。`#4182` 對 Windows
fork 是必須重審項：本機重現 fresh-install access denial 或出現 stable landing 時即重新檢視。

**merge 後 ledger refresh**：closed-unmerged `#4184`（OpenCode Go session affinity）與 `#4188`
（ChatGPT Free warmup fallback）都由 maintainer 在 `dev` 以後續 landing 取代，沒有 stable
commit，均 defer 至 stable promotion。open platform `#4200`（remote-hub docs）、`#4204`
（Windows stale CLI catalog clamp）與 `#4236`（macOS launchd repair）也沒有 stable landing；其中
`#4204`、`#4236` 是實際平台重現時的優先重審項，但不在 stable-only merge 補未發布 patch。

**2026-09-11 closed-PR refresh**：`#4203` 的 pnpm self-update 雖帶
`landed-via-maintainer` 標籤，仍是 base `dev` 的 closed-unmerged PR，reviewed stable
`2d4d7a2` 不含該後續 landing，故等待完整 stable promotion。`#4210` 是未有 maintainer landing
證據的 BigModel Responses quota-reader contributor PR，且作者未宣稱本機 product tests 綠；不從
未發布 head 拆取 quota／credential surface。兩者僅在 maintainer stable landing 或 fork 實際重現時
重審。closed-unmerged PR 水位推至 `#4210`；platform issue 水位維持 `#4236`。

## 2026-09-12：一般 merge v2.51.0；package 前推至 2.52.0

**決定**：將上游穩定版本 `v2.51.0`（`c155cc7923dbc0102e27d79185505a85d4357b2c`，promotion `#4271`）一般 merge 進本 fork，package development version 前推至 `2.52.0`。維持英文／繁中 locale overlay，清除非保留之 docs-site 語系，test layout 合併 upstream 新增之測試清單。

**理由**：v2.51.0 包含完整的 One-port Hub 同埠本機/連線管理、Pool 降級保護、Sessionless requests 隔離及 pnpm 更新支援，具備高度穩定性與架構價值。先前在 v2.50 deferred 的 `#4203`（pnpm 自我更新）、`#4210`（Responses preset quota）、`#4184`（Go session affinity）、`#4188`（ChatGPT Free warmup）均已隨 maintainer release train 正式進入 stable `main`，無須手動拆取補丁。

**PR 與 Issue 分流**：
- closed-unmerged PR `#4258`（effort ladder）已由 stable commit 涵蓋。
- closed-unmerged PR `#4272`（bare tool 命名空間）與 `#4293`（OpenCode 圖片能力）已分別由 maintainer landing `#4264` 與 `#4300` 合併至 `dev`，無本 fork 專屬痛點前不拆取未發布依賴，等待下一 stable。
- platform issue `#4236` 之後無新 issue；既有 `#4204`（Windows stale CLI catalog clamp）維持 PARKED design。
- 水位更新：commit `c155cc7923dbc0102e27d79185505a85d4357b2c`、PR `#4293`、issue `#4236`。

## 2026-09-12：一般 merge v2.52.0；納入 Devin、Cline、Grok Coupons 與 Context Relay

**決定**：將上游穩定版本 `v2.52.0`（`4d37c35155fe283722566d32892b8753c1230be7`，promotion `#4407`）一般 merge 進本 fork。維持英文／繁中 locale overlay，清理非保留之 docs-site 語系（ko, tr, fr, ja 等）及非繁中 i18n 檔。採納上游原生之 host-native pnpm shim 測試修復（`#4379`）。

**理由**：v2.52.0 帶來多項重大架構強化與新供應商適配：
- **Codex 配額與路由避讓機制**：引進 quota refusal 避讓窗口與 clear-cooldown 解除（#4396, #4397, #4368）。
- **Devin 與 Devin CLI 供應商**：支援 Cognition 雲端模型與基於 ACP stdio 的本地 Devin CLI，並修正 Windows 平台路徑語意（#4285, #4288, #4322, #4335, #4400）。
- **xAI Grok Reset Coupons**：支援透過 gRPC-Web 讀取並兌換重置券（#4306, #4330）。
- **Cline CLI 整合**：新增 Cline CLI 整合、日誌化設定寫入與 catalog sync（#4371, #4390）。
- **最小權限 Context History Relay**：Codex 歷史 relay 機制與 loopback 認證強化（#4360）。
- **GUI 目錄搜尋與 Local 頁籤**：跨頁籤統一搜尋、Local 獨立頁籤與長備註彈跳窗（#4325, #4328, #4331）。

**PR 與 Issue 分流**：
- closed-unmerged PR `#4313`（Codex history pagination writes）與 `#4386`（Cline registration contracts）均標記為 `landed-via-maintainer`，已由 maintainer landing 隨 release train 正式進主幹。
- platform issues 檢查至 `#4414` 無新增條目。
- 水位更新：commit `4d37c35155fe283722566d32892b8753c1230be7`、PR `#4414`、issue `#4414`。



## 2026-09-19：CodeQL 警示清零政策；runtime pin 失效時改取最新 build

**決定（一）**：CodeQL 只掃產品碼，不掃測試工具。`.github/codeql/codeql-config.yml` 的 `paths-ignore` 納入 `tests`、`devlog`、`gui/tests`、`docs-site`、`scripts/test-layout`、`scripts/disposable-host`、`scripts/ci`。

**理由**：2026-09-19 時 205 則開啟警示中有 151 則在 `tests/` 底下，其中 108 則只是兩條規則在描述測試本身在做它該做的事——61 則 `js/insecure-temporary-file`（用 `mkdtempSync` 在系統 temp 建沙箱的套件）與 47 則 `js/incomplete-url-substring-sanitization`（斷言 URL 含有某片段）。四分之三是雜訊的待辦清單比沒有掃描更糟，因為真實發現就此看不見了。`scripts/ci` 同理：`docker-smoke.ts` 是在自己擁有的 checkout 裡備份一個產生檔，跑在 hosted runner 上，改寫 CI harness 去關一個它跟自己賽跑的窗口沒有意義。

**決定（二）**：剩餘 38 則逐則處置，結果為開啟數 0——21 則改程式、15 則標記（14 則 false positive、1 則 won't fix）、2 則進 paths-ignore。每一則標記前都讀過該處程式碼，理由寫在 dismissal comment 裡。

**理由**：標記的四大類都不是缺陷。`js/insufficient-password-hash` 的 17 處全是 HMAC-SHA256 的 capability MAC 或日誌／快取用的識別碼，沒有任何一處儲存密碼或拿雜湊去驗證；`js/file-access-to-http` 的 4 處讀的是本行程自己記下的 port 與 hostname，打的是它自己管理的本機 proxy；`js/http-to-file-access` 的 2 處把抓回來的東西寫進檔案正是該指令的功能本身；`js/indirect-command-line-injection` 的 2 處來源是本 CLI 自己的 `process.env` / `process.argv`，匯點是 `commandInvocation` 的 cross-spawn 跳脫。唯一的 won't fix 是 `codex-ws-wire.ts:146`：那個訊息是 relay 刻意產生、供 client 解析以達成與直連路徑相同判斷的階段記錄，`ws-upstream` 有斷言在守它，因此保留契約並改為先 redact、壓成單行、截到 400 字元。

**決定（三）**：pin 指向的 Codex 執行檔不存在時，改選**版本最新**的有效候選，而不是沿用優先序。

**理由**：上游 issue 4204 說明確的 pin 是使用者的決定、不可被靜默取代——那條規則講的是**仍然解析得到**的 pin。指向的檔案已經不存在的 pin 根本無法被遵守，此時退回優先序會優先採用 PATH 而非帶版本的安裝目錄，那是靜默降級，不是尊重。Codex Desktop 讓這件事變成常態而非邊角案例：它把每個 build 裝在各自的 content-hash 目錄下，所以每次自動更新都會刪掉被 pin 的路徑。2026-09-19 實測：pin 指向 `...\Codex\bin\cdef5aaf3e41ab53\codex.exe`，更新寫入 `...\247581e40ee272fb\codex.exe`（0.155.0-alpha.9.2），解析卻退回 PATH 上的 0.150.0；`ocx doctor --fix-codex-runtime` 再寫一個新 hash 的 pin，下次更新又刪掉，形成迴圈。兩邊都要報得出版本才比得出高低，未知版本不視為升級。

**連帶**：`src/lib/bounded-file-read.ts` 成為本 fork 讀取本機狀態檔的共用入口（open 一次、驗描述子、讀描述子、再比對身分）。它不是新設計，是把 `src/codex/shim.ts` 裡原本就寫對的那段抽出來共用。新增測試檔因 `server` domain 的 `bounded-` seed 與實際模組位置 `src/lib/` 不一致，已加入 `layout.json` 的 `explicit` 表與 tooling oracle 的 pinned-overrides。

## 2026-09-25：一般 merge v2.65.0；6 個 src fork 修正逐檔判定

**決定**：把上游穩定版本 `v2.65.0`（`87a78e5f26f81373bf57c39495037849bd7996f0`）一般 merge 進本 fork，package development version 前推至 `2.66.0`。理由是 `#5743`／`#5694` 把主帳號 98% 硬鎖設為預設開啟，正式修掉 Codex Desktop 在 100% 用量時停用 Send 按鈕的回歸（`#5797`）。

**src 逐檔判定**（詳見 `UPSTREAM.md` 同日條目的完整表格）：`provider-fetch.ts` 的 Vertex host 比對與 log 清洗修正移植進 upstream 拆出的新檔 `provider-models.ts`；`history-provider.ts`、`shim.ts`、`service-secrets.ts`、`codex-ws-exchange.ts` 的修正已隨自動合併或小幅補丁落地在 upstream 拆分後的對應新檔；`server/index.ts` 的 compact route timeout 修正判定 upstream 的 `createServeOptions()` 已有等價（且時機更精確的）處理，不移植、整棵採用 upstream 新架構。

**理由**：這輪 upstream 對多個大檔（`provider-fetch.ts`、`shim.ts`、`server/index.ts`）做了拆分成多個小檔的重構，逐檔比對後確認 fork 的安全/穩健性修正要點沒有一項被 upstream 真正涵蓋以外的情況遺漏——凡是 upstream 已有等價修正就採 upstream，凡是沒有就移植到新檔位置，不在舊檔位置留重複定義製造未來衝突。

**測試與語系**：`gui/`、`docs-site/` 的非保留 locale（ru/ja/tr/vi/fr/ko/zh-cn 等）延續既有政策一併剃除，包含 upstream 這次新增的 `gui/src/i18n/vi.ts`、`native-main-translations.ts` 的 7 個非保留 locale 區塊，以及 3 個假設多語 README／docs-site 存在的新 `tests/ci-workflows/` 測試（`docs-provider-discovery-limits`、`docs-provider-preset-counts`、`docs-readme-memory-inventory`）。`scripts/test.ts` 的 fresh-process batch runner 保留 fork 版本，不採 upstream 改成的單一 `OCX_TEST_MAIN_TIMEOUT_MS` 主 lane 設計。

## 2026-10-24：Dependabot security updates 不適用 Bun，不加 bun 條目

**現象**：2026-10-23 Dependabot security update（警示 `#4`，`zod` < 4.6.6，GHSA-mrhx-c7xc-m3w5）失敗：`Dependabot detected that Bun is misconfigured ... This project has a bun.lock file but no package-lock.json ... npm_and_yarn ecosystem cannot update`。

**查證**：GitHub 官方「Dependabot supported ecosystems and repositories」表（2026-10-24 讀取）：`bun` 支援 version updates，**不支援 security updates**。security updates 是 repo 設定觸發，不看 `dependabot.yml`，遇到 Bun 專案一律走 `npm_and_yarn`，所以在 `dependabot.yml` 加 `package-ecosystem: "bun"` 修不了這個錯。

**決定**：
- `dependabot.yml` 維持只追 `github-actions`；不加 `bun` 的 version updates——理由同 2026-08-22：`package.json`／`bun.lock` 屬上游，lockfile PR 會與每次同步衝突。
- npm 生態的警示由上游處理：本 fork 產品依賴跟隨上游，`zod` 修正等上游升級後隨下次同步進來（上游 `main` 此時仍是 `zod 4.4.3`）。
- 建議維護者在 repo **Settings → Code security → Dependabot security updates** 關閉，避免每次警示都產生失敗的 job；Dependabot alerts 保留，作為同步時的檢查清單。Rust 警示（`#1` `glib` 0.18.5，Tauri 間接依賴）同樣跟隨上游。
- 若 GitHub 日後宣布 Bun 支援 security updates，再重新評估。


## 2026-10-25：整合 v2.92.0；PR 軸補審（257 筆）；排程 CI 在無 dev 的 fork 改測 main

**決定（一）**：整版採用 `v2.92.0`（`9f0d40a25f8b842c33ab233d466d0bd991d86052`，與 `upstream/main` 同一點），46 個 commit、361 個檔案。方法同前：`git diff v2.91.0 v2.92.0` 以 3-way 套到 `main`，非保留語系（`docs-site` 的 fr/ja/ko/ru/tr/zh-cn、`gui/src/i18n` 的 de/fr/ja/ko/pt/ru/tr/vi/zh）排除；3 個衝突檔手動解：

- `src/router.ts`：fork 的 CodeQL 修正（2026-09 把明文 `key` 改名為 `cacheIdentityMaterial`）保留，上游新增的 WorkBuddy 分支沿用同名變數（`workBuddyCatalogIdentity(cacheIdentityMaterial, …)`）。
- zh-tw 兩頁 providers 文件：fork 側為底，補上游的 Qwen Token plan 網址、Abliteration 額度段落、`messagePhaseInference`、`project: "auto"`。

**理由**：產品碼本來就以上游為準；`7416f18`／`44e4ed2`／`9f0d40a` 三個依賴安全修正（Bun 1.4.4、zod 4.6.6、body-parser 2.4.0、gui happy-dom 21.0.4）正好對應本 repo 開著的 Dependabot 警示（zod、happy-dom），整版採用比逐筆移植便宜。workflow：新增的官方限定 guard 沒被動到（`release.yml` 與 `windows-signing-test.yml` 的 `github.repository == 'lidge-jun/opencodex'` 條件仍在）。

**決定（二）**：PR 軸補審。檢查器原本 `gh pr list --limit 200`，上游已有 257 筆「關閉未合併、編號大於 6507」的 PR，檢查器只看得到最新 51 筆（6508–7367 的 206 筆從未被列出，而報告仍寫「51 筆待審」），**水位若照報告推進會把 206 筆標成已審**。已把上限改 1000，並加護欄：一整頁且最舊一筆仍新於水位時回「未檢查」，不回看似完整的短清單。

**判定（257 筆，水位推進到 `#7713`）**：

- 165 筆的編號出現在 `upstream/main` 的 commit 訊息（`carry #N`、bundle 的 `(#N)`），已被上游 main 引用（carry 或 bundle 落地），隨 release 抵達本 fork。
- 其餘 92 筆逐筆比對：檔案與本 fork 分歧產品檔（`git diff upstream/main --name-only`，40 個 src／bin 檔）的重疊，扣掉 generated 的 `scripts/test-layout/layout.json` 後只有 `src/router.ts`（`#6803`、`#6841`、`#7318`）、`src/client/connect.ts`（`#7116`）、`src/codex/auth-collision.ts`（`#7344`）、`src/server/responses/codex-ws-exchange.ts`（`#7465`）、`src/providers/quota/vendor-probes-key.ts`（`#7275`、`#7446`）、`src/codex/catalog/provider-models.ts`（`#7318`）。逐筆讀上游結案說明：全部是「已 carry 進 dev 的 bundle 並隨 2.90–2.92 出貨」、「維護者拒絕並寫明理由」（`#6628` 重導向會繞過 send budget、`#7116` 與刻意保留的安全決定衝突）、「作者自行關閉」（`#7460`、`#7486`、`#7384`、`#7386`）、`[WRONG BRANCH]`（`#7168`、`#7169`、`#7446`、`#7454`、`#7594`）或 i18n（`#7406`、`#7432`；本 fork 只保留 en／zh-TW）。`#6865` 的「full-width」是 64 位元 file ID 的測試（Rust 診斷目錄），不是 CJK 全形字，與本 fork 無關。
- Windows／CJK 例外類別（判準六）只有 `#7595`（Windows 優先 `.exe`）與 `#7553`（`ocx sync` 保留使用者編輯的 `config.toml`）：兩者上游都改由 dev 上的 `#7527`（`9534c0c94b`）與 `#7659`（`e9df82cb5`）取代，**尚未進 `main`**。
- 隱藏內容掃描（判準八）：只對 `#7595` 的目前 head（`4db7da314`）做了（無長空白夾內容、無超長行、無 `eval`／`new Function`／`global.require`、無長 base64／hex）；其餘沒有移植任何 PR 內容，不需掃。

**不引進（附觸發條件）**：
- `#7527`（Qoder CN／CodeBuddy 等 coding-agent CLI 的 Windows `.cmd` shim 空參數問題）：影響的是維護者沒在用的 Qoder／CodeBuddy 轉接器，且只在 dev。**觸發**：`v2.93.0`（含 `9534c0c94b`）出版時隨整版進來；或維護者實際用到這些轉接器。
- `#7659`（`ocx sync` 覆寫 `~/.codex/config.toml` 的使用者編輯，上游 issue `#7425`，該 issue 仍在要求最小重現）：只在 dev，未被證實在本 fork 重現，且為 15 檔／375 行的改動。**觸發**：`v2.93.0` 出版；或維護者回報 `ocx sync` 吃掉自己的 Codex 設定。

**決定（三）platform issue**：`#7207`（防毒誤判 bun，上游已確認 MSI 摘要相同、尚無結論）、`#7425`（見上）、`#7515`／`#7716`（上游 Windows CI 測試清理與 Bun 1.4.4 逾時）。本 fork 的 push CI 不跑 Windows shard，皆為資訊；不採取行動。**觸發**：`#7207` 若上游結論為 Bun 1.4.4 本身被誤判，重新評估 `fork-release-windows.yml` 是否改鎖 Bun 版本。

**決定（四）排程 CI**：上游 `ci.yml` 的夜間排程會 `gh api repos/…/commits/dev`，本 fork 沒有 `dev`，2026-10-24 的第一次排程在 `changes` 工作失敗（26 秒、全部後續工作 skipped、`ci` 斷言紅）。改為：解析不到 `dev` 且倉庫是 `SanHsien/opencodex` 時改測 `GITHUB_SHA`（main head），並在日誌留 `::notice::`；其他倉庫行為不變（仍然 error）。**理由**：這條排程是上游「Windows shard 與 macOS control 的夜間保險」，改測 main 比停用更符合本 fork 要的覆蓋；如夜間結果持續紅且與本 fork 無關，再改為停用該排程。

## 2026-10-27：整合 v2.93.0；安全邊界逐檔判定（一律「上游已有等價保護就採上游」）

**決定**：整版採用 `v2.93.0`（`88aaa754566d119b6b8fc898f8fb47602387d82e`，與 `upstream/main` 同一點），103 個 commit、694 個檔案。方法同前：由 tag 長出暫存 worktree，重放 `git diff v2.92.0 main` 的 fork overlay（398 個刪除先套用，272 個新增／修改以 3-way patch 套用），單一 parent 接 `main`，不 merge、不建 ancestry bridge。上游 `#7527`（Windows `.cmd` shim 空參數）與 `#7659`（`ocx sync` 保留使用者編輯的 `config.toml`）隨版進來，2026-10-25 條目的兩個觸發條件成立。

**衝突 12 個，手動解**：
- `.github/workflows/enforce-pr-target.yml`：上游新增 `attribution-approved` 標籤；fork 的 `github.repository == 'lidge-jun/opencodex'` guard 多包一層括號，兩者並存。
- `scripts/test-run-lock.ts` 與 `tests/ci-workflows/test-runner.test.ts`：整檔採上游（見下），fork 的 Windows `bun:ffi` 版本與對應 5 個測試丟棄；上游新增的測試保留，補回 `utimesSync` import。
- `tests/server/api-catalog-route.test.ts`：上游新增 `spyOn`（MiMo 測試）與 fork 新增 `existsSync`（temp 清理斷言），import 取聯集。
- `gui/tests/i18n-locales.test.ts`：上游新增 Turkish／Portuguese 斷言，fork 無這兩個語系，整段丟棄。
- `scripts/test-layout/layout.json`、`tests/fixtures/test-layout-expected.json`：兩側各新增的測試檔名取聯集。
- zh-tw 文件 5 頁：以 fork 側為底，補上游新增內容（`providers.md` 的 OpenGateway 段、`ocx account list` 無原生 Codex 目錄段、`codex-app-models.md` 的穩定模型涵蓋章節與 `gpt-6.1-terra`、`sub-agent-surface.md` 的 `gpt-6.1-terra`）；fork 側 `codex-app-models.md` 原本把「目前穩定模型涵蓋範圍」標題放在錯的位置、整張表遺失，順手還原。
- 上游重新帶回的 `docs-site/src/content/docs/tr/`（10 頁）依語系政策剃除。

**安全邊界（每項一行；上游已有等價保護時採上游）**：
- `scripts/test-run-lock.ts`（PID 重用）：上游 `#7508` 已有跨平台的 process-start identity（Windows、Linux `/proc` 開機 id＋ticks、macOS），涵蓋 fork 以 `GetProcessTimes` 做的保護且更完整；**採上游，丟 fork 版**。
- `src/bridge/errors.ts`：fork 的 `clientSafeErrorMessage`（錯誤 envelope 不洩漏本機 stack frame）與上游新增的 `model_not_in_plan`／required-tool 程式碼互不重疊；**兩者並存**。
- `src/client/connect.ts`：fork 的 `readBoundedRegularFile`（單次 open 再驗描述子）上游沒有對應；**保留 fork**，上游新增部分一併保留。
- `src/codex/catalog/provider-models.ts`：fork 的 Vertex host 精確比對與 log 清洗與上游改動不同段；**兩者並存**。
- `src/server/responses/codex-ws-exchange.ts`：fork 的 relay 失敗訊息 redact＋單行＋截斷，上游沒有對應；**保留 fork**，上游新增部分一併保留。
- `src/service/ownership-mutation-lease.mjs`：上游新增 lease generation（舊 handle 不能釋放新租約），與 fork 的 fd 驗證讀 owner 紀錄是不同的洞；**兩者並存**。
- `src/update/transactional-install.mjs`：上游新增 npm process-tree exit 確認（未確認就不刪 staging），與 fork 的 fd 驗證讀 marker 不同洞；**兩者並存**。
- `desktop/src-tauri/tauri.conf.json`：上游版本號改 2.93.0，`createUpdaterArtifacts: false`、`plugins.updater.endpoints: []` 維持；桌面更新仍停用。

**版本**：`package.json`、`desktop/src-tauri/Cargo.toml`／`Cargo.lock`、`tauri.conf.json` 皆為 `2.93.0`（MSI 的四段數字版本由 `fork-release-windows.yml` 從 tag 推出，不用改）。發版 tag 為 `v2.93.0`，推送時用 `git push origin <main SHA>:refs/tags/v2.93.0`（本機 `v2.93.0` 是上游的 tag）。

## 2026-10-27：更新路徑只認 fork releases；韓文從產品碼剃除；兩個防回歸檢查

**現象**：維護者的機器被靜默換回官方 `2.92.0`（fork 修正全失）。查到 fork 內仍有幾條路通往上游：`src/update/job.ts`、`src/update/notify.ts` 的 release notes 連結與 `gui/src/pages/usage-companion-panel.tsx` 的下載連結都指向 `lidge-jun/opencodex` 的 `releases/latest`；更根本的是 `ocx update`、dashboard 更新工作、啟動時的版本查詢都走 npm registry 的 `@bitkyc08/opencodex`——本 fork 不發 npm 套件，registry 只會回上游版本，裝下去就是上游建置。

**決定（更新）**：
- 新增 `src/update/fork-source.mjs`：`FORK_RELEASES_URL = https://github.com/SanHsien/opencodex/releases/latest`，並以 `forkUpdatePolicy.selfUpdateAllowed`（預設 `false`）一個閘門封住所有 registry 路徑。被封住的入口：`latestVersion`／`latestVersionAsync`（回 `null`，不再宣稱有新版）、`updateCommand`（丟錯）、`runUpdate`（印指向 fork releases 的訊息、exit 1）、`startUpdateJob`（丟 `fork_self_update_disabled`）、Node launcher 的 `ocx update`（mise 分支之後、npm／pnpm 自更新之前）。另於 `runOrchestratedUpdate`（`src/update/orchestrated-entry.ts`，Bun 直跑 CLI 時由 `src/cli/dispatch.ts` 進入）開頭加獨立閘門（縱深防禦，不依賴 `latestVersion` 回 `null`）：`--yes` 輸出 `ocx.update.result/1`、`error: fork-self-update-disabled`、exit 10；`--plan` 輸出 `canApply: false`、exit 0，與 `bin/ocx.mjs` 同形。
- release notes 連結（`job.ts`、`notify.ts`）與 GUI 下載連結改指 `SanHsien/opencodex`；standalone 的提示改成「到 fork releases 下載新版重裝」。
- 桌面 Tauri updater 維持停用（`endpoints: []`、`createUpdaterArtifacts: false`）；`update.html` 早已指向 fork。
- 為什麼不做「查 fork releases 再通知」：fork 的唯一發行物是未簽章 MSI，沒有安全的 in-app 安裝路徑，通知了也只能叫人手動下載；而上游的更新機制整套（stop proxy → 替換套件 → 重啟）一旦指向非 npm 來源就沒有驗證（integrity、staging）可依靠。維護者本人就是發版者，不需要輪詢自己。
- 測試：`tests/preload.ts` 只在測試行程內把閘門打開，讓上游更新機制的既有測試照跑；出貨預設由 `tests/update/fork-update-policy.test.ts` 釘住。
- **防回歸**（`tests/ci-workflows/fork-hygiene.test.ts`，`dev_check.ps1` 會跑）：`src/update`、launcher、桌面 updater 設定與 UI 出現 `lidge-jun/opencodex` 即失敗；`src`、`gui/src`、`bin`、`desktop/*` 出現上游 releases／`api.github.com/repos/lidge-jun` 即失敗；`tauri.conf.json` 的 updater 設定與閘門預設值也被斷言。

**決定（韓文）**：`src/`、`gui/src/`、`scripts/`、`desktop/`、`bin/` 掃到 33 檔 226 行 Hangul，逐行分類：
- 給人看的輸出改英文（`src/cli/claude-desktop.ts`、`claude.ts`、`src/claude/desktop-3p.ts`、`management/agent-settings-routes.ts` 的 CLI 訊息與 API 錯誤，對應測試一併更新）。`gui/src/i18n/log-guard-*-labels.ts`、`routing-compatibility-labels.ts` 的非保留語系區塊（含 ko）整段剃除，`format-tokens.ts` 去掉 ko 單位。
- 註解改英文（decision-log 標籤與內文、`types/config.ts` JSDoc、`styles.css`）；`scripts/structure-ssot.ts` 的 decision-log 偵測同時認英文標籤。
- 功能性比對保留並加英文註解：Cursor 工具敘述偵測（`tool-guidance.ts`、`envelope-echo.ts`）、prompt-lint 的韓文身分規則、`structure-ssot.ts` 偵測上游 ADR 的韓文標籤。逐行 allowlist 在 `tools/fork-hygiene-guards.ts`，規則寫在 `FORK.md`。
- 測試 fixture 中的 Hangul（`scripts/codex-queue.test.mjs`、`native_tray.rs` 單元測試）換成繁中字串，語意不變。
- **不處理**：`docs-site/`（`Header.astro`、`Landing.astro`、`frontier-i18n.ts` 等的位置式多語 `t(en, ko, zh, …)` 表）。fork 只發布 en／zh-tw，這些韓文是不會被顯示的死資料，剃除要改寫整串位置參數、每次同步都衝突；`deploy-docs` 在 fork 也不執行。`structure/` 與 `devlog/` 是上游開發者文件，不在檢查範圍。

**同步後測試修補（2026-10-27）**：`docs-zh-tw-parity` 抓到上游 v2.93.0 在 8 個英文頁新增的段落（codex-app-models、combos、integrations、providers、lifecycle、codex-retry-diagnostics、proxy-formats、update-failed）zh-tw 沒有，依慣例以英文原文補進對應位置（連結改 `/zh-tw/`）；`update-failed` 舊的步驟清單被上游改放進新的「Retry or reinstall」小節，刪掉 zh-tw 舊清單以免重複；`integrations` 的兩個舊程式碼區塊改縮排（不改內容）以維持 fence 數對得上。`docs-gpt61-terra` 要求的 `modelAdapters?` 列補上 Copilot 的 `gpt-6.1-*` 說明。`.github/workflows/ci.yml` 因 fork 的排程 CI 改動比上游多 7 行、超過 2000 行，登記到 `tests/fixtures/file-size-baseline.json`（2003）。`release-version-line` 在本機會因為本機的 `v2.93.0` tag 是上游的而失敗；fork 在這個 commit 上打 `v2.93.0` 後即通過（CI 的 fork 倉庫沒有上游 tag）。


## 2026-10-28：fork 只支援 Windows——檔案層級移除 macOS／Linux 專屬內容

**決定**：維護者只用 Windows，要一個乾淨的 repo。以「檔案層級」移除只為 macOS 或 Linux 存在的東西：整個目錄、打包與安裝腳本、CI job 與 workflow job、只在那些平台跑的測試、對應的 docs 頁面與段落。**不處理檔案內的平台分支**——共用模組裡的 `process.platform === "win32" ? … : …`、POSIX 程式路徑、混合測試檔裡的 `skipIf(process.platform === "win32")` 全部保留。

**為什麼只動檔案層級**：fork 同步上游的方法是把 `git diff <integrated_tag> main` 重放到每個新上游 tag：先套刪除清單，再 3-way patch（見 `FORK.md`、`UPSTREAM.md`）。整檔刪除會自動重放，和剔除非英文／繁中語系的做法完全一樣；檔案內的編輯則在每次上游動到同一檔時都會衝突。所以共用 source 不為了拿掉非 Windows 分支而改動，`src/service/launchd.ts`、`systemd.ts`、`src/codex/desktop-app/darwin.ts`／`linux.ts` 等被共用模組靜態 import 的檔案全部留下。

**刪除範圍**（共 105 個檔案（含 `app/`、`docker/` 兩個目錄）；完整清單即 `tools/fork-hygiene-guards.ts` 的 `REMOVED_DIRECTORIES`／`REMOVED_FILES`）
- 目錄：`app/`（macOS WidgetKit／MenuBarCore／NativeTray）、`docker/`。
- 根目錄：`Dockerfile`、`compose.yaml`、`.dockerignore`。
- 腳本：`scripts/install.sh`、`ocx-restart.sh`、`ocx-run`＋`OCX-RUN.md`、`darwin-eager-abort-stress*.ts`、`macos-rss-retention-*.ts`、`bun-gc-relief-eval.ts`、`scripts/ci/docker-smoke.ts`、`sample-macos-stall.sh`、`select-test-lane.sh`；`desktop/scripts/` 的 `build-widget.sh`、`verify-macos-runtime.sh`、`verify-linux-sidecar.sh`、`appimage-patchelf.py`、`linux-packaged-e2e.ts`。
- 測試：全部測試在 win32 都被跳過的檔案（`codex-shim-overlay*`、`messaging-remote-*`、`service-desktop-startup-linux` 等）、只測上述被刪檔案的測試（`container-bootstrap`、`desktop-widget-entry`、`macos-serial-lanes`、`ci-scope-reduction` 等）。混合檔案不動。
- 文件：`macos-menu-bar` 頁（英文＋zh-tw）、`remote-hub` 的 Docker Compose 與 macOS 服務操作兩節、`structure/` 的 Linux 打包與 widget 章節、兩份 ADR（容器部署、Linux packaged shell）。
- CI：`ci.yml` 移除 `test`（Ubuntu 四分片）、`storage-policy`、`api-usage`、`platform-macos`、`macos-control`、`docker-smoke`、`npm-global-smoke`、`widget`、`desktop-shell`；`keyring-smoke` 改成只跑 Windows；`setup-action`／`remote-helper` 拿掉 macOS 腿；`service-lifecycle.yml` 移除 `linux-systemd`、`macos-launchd`；`desktop-installed-gate.yml` 移除 `macos`、`linux`；`codex-queue-helpers.yml`、`catalog-async-contracts.yml` 拿掉 macOS 腿。保留的 gate 都是平台中立的：`gates`、`test changed`、`docs-site-build`、`structure-gate`、`privacy-gate`，以及 `platform-windows` 九分片完整測試（排程與手動 dispatch）、`fork-release-windows.yml`。

**刻意保留**
- `release.yml`、`scripts/release.ts` 與其 helper：上游專用發版線（每個 job 有官方 repo guard，fork 不執行）。改它每次同步都衝突，且它的 asset 清單是資料驅動；其中 macOS／Linux 腿與已刪腳本的引用在 fork 是死碼，同步時照上游原樣。
- 所有被共用 source 靜態 import 的 launchd／systemd／darwin／linux 模組與它們不被 win32 跳過的測試；`desktop/src-tauri/Entitlements.plist`（`tauri.conf.json` 引用）、`scripts/codex-queue.sh`（其測試跑 bash 與 pwsh 兩種 shell）、`native/remote-workspace-helper` 的 macOS sandbox。

**防回歸**：`tools/fork-hygiene-guards.ts` 加 `REMOVED_DIRECTORIES`／`REMOVED_FILES`／`REMOVED_CI_JOBS` 與非 Windows runner 標籤檢查（`release.yml` 例外），`tests/ci-workflows/fork-hygiene.test.ts` 在被刪路徑、被刪 job 或 `macos-*`／`opencodex-gate-(macos|linux)` 標籤回來時失敗；已用重新加入的樣本驗證為紅、還原後為綠。

**代價與注意**：Ubuntu 測試腿移除後，PR 只剩 `test changed`，完整套件只在 Windows 的排程與手動 dispatch 跑；`ci.yml` 與數個測試檔的檔案內編輯在同步時會與上游衝突，需手動解（見 `UPSTREAM.md` 的「Windows-only 刪除清單」）。

## 2026-10-28：安全警示逐筆處理；Dependabot 自動安全修正維持關閉

**決定**：GitHub 開啟中的 57 個 CodeQL 與 5 個 Dependabot 警示逐筆判讀，不批量關閉。真問題在程式碼修正，其餘附具體、可在程式碼驗證的理由個別 dismiss。

- 修正 20 筆（`1d102c6db` 與其後續提交）：3 個 polynomial-redos 改成線性掃描；12 個 file-system-race 讀取改走 `readBoundedRegularFile`（同一個 descriptor 決定型別、大小與內容）或補上 lstat／fstat 身分比對；`restart-replacement` 截斷 log 前比對 bigint dev／ino；`link/diagnostics` 在 ACL 加固與寫入前確認檔名本身就是開啟的檔案（Windows 沒有 `O_NOFOLLOW`）。另外 6 處身分比對改用 bigint（NTFS 檔案編號會超過 2^53）。`rustls` 升到 0.23.46（Dependabot 4 筆）。
- dismiss 42 筆：41 個 CodeQL（31 false positive、10 won't fix），理由逐筆寫在 GitHub 的 dismiss 說明。`glib`（Dependabot #1）以 `not_used` 關閉：只由 Linux GTK 依賴鏈引入，`cargo tree --target x86_64-pc-windows-msvc -i glib` 為空；Tauri／GTK3 鎖 `^0.18`，無法升到 0.20。
- 判讀過程經 fresh Opus 審查：原本以「O_NOFOLLOW」為理由的 #597 在 Windows 不成立，改為修正；5 筆說明改寫成與程式碼一致。

**Dependabot 自動安全修正（`security_fixes`）維持關閉**，並在 `.github/dependabot.yml` 加 `fleet-waiver: security_fixes`：repo 的自動安全修正遇到 `bun.lock` 一律走 npm_and_yarn 並失敗（2026-10-24 條目），開了只會產生紅燈 run；`Cargo.lock` 的警示量少，由維護者逐筆處理，比照本條。

## 2026-10-31：`tauri-plugin-updater` 關閉 `zip` feature

Dependabot #10、#11、#12 都是 `zip` 4.6.1，只由 updater 帶入。改為 `default-features = false, features = ["rustls-tls"]`，不升級 updater：2.14.1 才改 `zip ^9`，但需要 `tauri ^2.12`，本 fork 釘 `=2.11.6`。桌面更新維持停用（`endpoints: []`、`createUpdaterArtifacts: false`）。整合上游時保留此設定；日後重新啟用桌面更新或升到 tauri 2.12 以上時重新評估。


## 2026-11-02：夜間 Windows shard 紅燈分類；保留排程與失敗硬閘門

**範圍與證據**：調查 [40968258056](https://github.com/SanHsien/opencodex/actions/runs/40968258056)、[41137391838](https://github.com/SanHsien/opencodex/actions/runs/41137391838)，並比對目前 HEAD `888f2d075f5fc08a594aa80196025be90a96f7b6` 的 [41354967821](https://github.com/SanHsien/opencodex/actions/runs/41354967821)。同 commit 的 push [41098559653](https://github.com/SanHsien/opencodex/actions/runs/41098559653) 沒有執行 Windows 完整九分片，不能拿它的 success 排除夜間缺陷。

| 項目 | 判定與決定 |
| --- | --- |
| shard 2：`ci-bun-crash-classifier.test.ts` | 真實的測試契約過期。Windows-only 移除 `test`、`platform-macos`、`macos-control` 後，測試仍直接讀其 `steps`，造成載入時 TypeError。名單與呼叫數改為唯一保留的 `platform-windows`；不使用跳過缺失 job 的方式，保留簽章不得內嵌、共同 classifier 必須被呼叫及不得重試成綠燈的斷言。 |
| shard 7：`codex-agent-role-routes.test.ts` | 真實的故障注入過期。角色檔已用 bounded reader，`readFileSync` spy 不再觸發；改攔截最終 `renameSync`，讓測試繼續驗證原有 raw filesystem error → HTTP 500、固定錯誤碼、路徑遮蔽，並驗證原角色檔保持不變。開檔被拒由 bounded reader 轉成安全的 409，不能用它替代原有 500 測試。產品讀寫與安全保護不變。 |
| `stall-timeout.test.ts` | 非失敗來源。兩個指定 run 中八個案例全部 pass，本機也通過；不改 resolver、預算或 watchdog。原路線圖將同批次的通過檔誤列為失敗檔。 |
| shard 9：`codex-cli-update-plan.test.ts` | run 41137391838 的兩個 real npm probe 分別在 15s／30s 發生 `cmd.exe ETIMEDOUT`，不是 stall timeout。判為暫時環境／子程序執行逾時，確切底層原因未證實；目前 HEAD 的下一輪 41354967821 shard 9 success，本機以 CI 相同 `--timeout 60000` 跑此檔通過。保留子程序 deadline、離線與 HOME 隔離斷言，不增加重試、不把逾時視為通過、不改產品碼。 |

**保守決定**：保留夜間排程；兩個持續失敗與 fork 的測試契約有關，不符合「與 fork 無關才停用」的既定條件。本輪僅交付未提交的修正，不推送、不觸發 workflow。`ROADMAP.md` 原列保留，待維護者提交後由下一次實際 schedule 的九個 Windows shards 與 aggregate `ci` 全部 success 才能刪列；本機通過不能代替這項遠端驗收。

**本機先紅後綠**（Windows、Bun 1.4.4）：原樹執行 `bun run test -- tests/ci-workflows/ci-bun-crash-classifier.test.ts tests/lib/stall-timeout.test.ts tests/server/codex-agent-role-routes.test.ts`，exit 1，`26 pass / 1 fail / 1 error`（缺失 job TypeError、故障注入 `denied = 0`）。修正後使用 CI 的 60s test timeout 驗證，結果見 `REVIEW.md`。另一次未帶 timeout 的 npm 單檔本機執行碰到 Bun 預設 5s test timeout；該條件不同於 CI，不能用它歸因夜間 15s／30s 子程序逾時。

## 2026-11-07：手動 Cross-platform CI 的 `windows 7/11` 在 `main-quota-provenance` 首案例紅燈；判為無法重現的暫時性失敗，只補可讀的失敗輸出，不改產品碼、不放寬斷言

**範圍與證據**：[42376149161](https://github.com/SanHsien/opencodex/actions/runs/42376149161)（`workflow_dispatch`，2026-11-07T13:15Z，HEAD `2c6d8fa4af0e29f4b15c1e1b819d68a7094bafed`）。11 個 Windows shard 中只有 `windows 7/11` failure，aggregate `ci` 只報 `windows 7/11 did not report success`。失敗：`tests/codex-integration/main-quota-provenance.test.ts:415` `expect(result.selected).toBe(scenario.selected)`，`Expected: true / Received: false`，案例 `cold keyring Pool preserves quota unless replacement is proven: verified replacement [17101.86ms]`。同一批次（shard 7/11 batch 20/51）的總計是 `85 pass / 1 fail`；同檔其餘案例（包含同迴圈後面七個情境、含另一個 `selected: true` 的 `startup file replacement`）全 pass。同一 job 的失敗案例是該迴圈的第一個子行程。

| 對照 | 結果 |
| --- | --- |
| 失敗案例的子行程 | 日誌時間戳 13:25:48.12（暖機結束）到 13:25:49.96（斷言失敗），約 1.8s；同迴圈其餘七個子行程各 0.32～0.61s（紀錄的案例時間 319～609ms） |
| 失敗案例的收尾 | `[test-temp] final EPERM` 落在 `.opencodex-native-main.claim.sqlite`（`rename:ok`、`icacls` 與 `attrib` 都正常、檔案不是唯讀），暫存樹被搬到 `.trash-*` 延後刪除，整個案例記 17.1s；其餘案例沒有這一段 |
| 同檔在同一份程式碼上的歷史 | 前一個 HEAD 到 `2c6d8fa4a` 之間只有 `2c6d8fa4a`（`cli-start-owner-absence` 測試與文件）；`git diff abca9cb 2c6d8fa4a -- src/codex tests/codex-integration tests/helpers src/lib/windows-secret-acl.ts` 為空。`abca9cb0d` 上的 [42130890278](https://github.com/SanHsien/opencodex/actions/runs/42130890278) 與 [42309802238](https://github.com/SanHsien/opencodex/actions/runs/42309802238) 的 `windows 7/11` 都是 success |
| 本機重現 | 單檔 `CI=true bun test tests/codex-integration/main-quota-provenance.test.ts` 連跑 3 次、`TZ=UTC` 1 次、同時 8 個程序並行 1 輪，皆 `38 pass / 0 fail`，重現不到 |

**排除**：
- 不是日期或時刻相依。夾具的 `weeklyResetAt` 是 `Date.now() / 1000 + 3600`，JWT `exp` 是 `Math.floor(Date.now() / 1000) + 3600`，沒有任何寫死的時間戳或週重置邊界；今天（2026-11-07）本機與 `TZ=UTC` 都是綠，同一天同一 job 內其餘七個情境用同一份夾具也是綠。因此沒有需要注入的時鐘，也沒有可改成確定性的時間來源。
- 不是回歸。見上表第三列：程式碼與前兩個綠燈 run 相同。

**判定**：Windows 執行器上的暫時性失敗，且是「第一個子行程」才付的冷啟動成本；底層原因**未證實**。與日誌一致的最具體機制是：子行程在 `resolveCodexAuthContext` 內丟出錯誤（`selected` 為 false、子行程 exit 0、`before.weeklyPercent` 100、`stored` 33、`paused` 為空陣列這些其他斷言全部成立，所以不是程序崩潰或夾具寫壞），而 native-main 宣告檔（claim）在開檔／硬化階段遇到非 `SQLITE_BUSY` 的錯誤時，`mapClaimSetupError` 會直接映成 `NATIVE_MAIN_CLAIM_UNAVAILABLE` 且不重試（只有 busy 會在 30s 內重試），預設硬化器在 Windows 又是 `required: true` 的 icacls。暫時把 claim 開檔注入一個 `EPERM` 後，同一個案例的症狀完全相同（`Expected: true / Received: false`，子行程 exit 0），舊斷言形式什麼原因都不顯示。注入只證明「這類失敗會長成這個樣子」，**不證明 CI 上發生的就是它**；收尾那個 claim 檔的 EPERM 與它一致，也可能只是防毒掃描新建檔案的另一個症狀。

**決定**：
1. **不改產品碼**。沒有證據指向 claim 的行為錯誤，把一個沒看到錯誤訊息的紅燈當成理由去放寬一個 fail-closed 的 ACL 硬化路徑，與 2026-11-07 前一條「不放寬等待界限」同理。
2. **不放寬任何斷言**，也不加重試。`selected` 與 `exitCode` 仍然要求精確值；改的只是失敗時的輸出：兩個斷言都改成對一個物件做 `toMatchObject`，失敗時會列出子行程的 `failure`（錯誤類別）、`failureDetail`（訊息、cause、code）、`reads` 與 stderr 結尾 1500 字元。原先 `child.stderr` 從未被讀、`failure` 在 `selected` 斷言之後才有機會被看到，所以這次紅燈沒有任何可指認原因的資料。
3. **先紅後綠（診斷面）**：注入 claim 開檔 `EPERM` 並把測試還原為 `HEAD` 版，輸出只有 `Expected: true / Received: false`；同一注入換成新版斷言，輸出列出 `"failure": "CodexAuthContextError"`、`"code": "NATIVE_MAIN_CLAIM_UNAVAILABLE"` 與子行程 stderr 的注入行。注入已還原，`src/codex/native-main-claim.ts` 與 `HEAD` 無差異。
4. **保留夜間排程**：停用條件（連續紅燈且與本 fork 無關）不成立，這是手動觸發的一次、一個 shard、一個案例。

**下次再紅時怎麼讀**：看失敗物件的 `detail` 與 `stderr`。`NATIVE_MAIN_CLAIM_UNAVAILABLE` 加 stderr 有 `ACL hardening` 字樣＝claim 檔的 icacls 硬化失敗或逾時（再往下看是 `ETIMEDOUT` 還是 sharing violation）；`CodexMainAccountHardLockError` 或 `CodexPoolAuthenticationError`＝政策判定本身變了，是真實缺陷；`reads` 與預期不同＝選擇路徑改了。到那時才有依據討論讓 claim 的暫時性硬化失敗在其等待窗內重試（需連同 `retryTimedOutOnce` 與逾時備忘的語意一起評估，見 `ROADMAP.md` 中期列）。

## 2026-11-07：夜間 Windows shard 2/11 的 `cli-start-owner-absence` 逾時；判為執行器暫停，補暖機與可讀的子行程界限，不放寬等待界限

**範圍與證據**：夜間 `Cross-platform CI` 最新一次紅燈 [42309802238](https://github.com/SanHsien/opencodex/actions/runs/42309802238)（schedule，2026-11-06T23:08Z，HEAD `abca9cb0d6d79558ecbe7fe0094985e22b55f9f5`）。24 個 job 中只有 `windows 2/11` failure，其餘十個 Windows shard、gates、structure gate 皆 success；aggregate `ci` 的錯誤只有 `windows 2/11 did not report success`。失敗訊息：`Test failure in shard 2/11 batch 11/46 (exit 1)`，案例 `consecutive transport misses preserve PID and journal for connected-client [47729.46ms] ^ this test timed out after 45000ms`，同檔下一個案例 `an exited recorded owner on a refused port still recovers its journal and stale PID` 雖然通過卻花 37523ms。

| 對照 | 結果 |
| --- | --- |
| 同一 HEAD 的前一晚 schedule [42130890278](https://github.com/SanHsien/opencodex/actions/runs/42130890278)（2026-11-05T23:38Z） | 11 個 Windows shard 與 aggregate `ci` 全部 success；這個檔案的八個案例各 963～1566ms |
| 紅燈 run 同檔的前六個案例 | 6371、5201、4490、4046、2890、7871ms，是前一晚的 2.7～7.9 倍 |
| 紅燈 run 的最後兩個案例 | 47729ms（逾時）、37523ms，是前一晚的 40 倍、24 倍 |
| 兩個 run 共同出現的 1290 個案例 | 紅燈 run 合計 490.9s，前一晚 321.6s，1.53 倍；不是整個 shard 均勻變慢，也不是只有一個案例慢 |

**排除**：同一個 commit 的程式碼沒變，所以不是產品或測試回歸；「connected-client」案例與其他六個場景用同一份子行程腳本，差別只在被 stub 的 `readClientConnectionState`，沒有自己的慢路徑。`start` 場景的子行程在本機以暫時的 spawn 記錄量測：生命期內零個孫行程（沒有 WMIC／PowerShell／icacls 探測），記錄用的暫時改動已還原；本機 `CI=true` 八個案例各 2.1～3.4s 全過，重現不到。

**判定**：執行器層級的暫停（Bun 子行程啟動與載入模組圖時的 I/O 或排程），底層原因（防毒掃描、磁碟、CPU 搶占）**未證實**。舊測試用 `Bun.spawn` 加 `Promise.all` 等子行程，測試計時器先到就殺掉並丟棄子行程輸出（只剩 `Received: 143`），所以日誌裡沒有任何能指出哪一段花了時間的資料。這與 `tests/helpers/test-budget.ts` 記錄的 `COLD_SPAWN_BUDGET_MS` 起因同型（run 35118018849 的第一個子行程 50.7s、下一個 1.8s）。

**決定**：
1. **不放寬子行程的等待界限**。子行程界限仍是 `watchdogMs(30_000)`（Windows CI 45s、本機 30s），沒有提高；案例計時器只多出回收餘裕（見第 3 點）。`test-budget.ts` 要求「等待是斷言本身」與「還原被測行為後仍會紅」兩項都成立；沒有分段資料就無法證明第二項，`cold-spawn-warmup.ts` 也明文拒絕以 `watchdogMs` 放寬子行程界限。
2. **暖機**（repo 對「計時中的子行程第一次載入模組圖」的既定補法）：`beforeAll` 以 `warmModuleGraph` 預載這個檔案兩個子行程腳本 `import` 區段的聯集（各子行程仍保留自己原本的 import 清單，所以暖機子行程可能多載一個該子行程用不到的模組，代價只是暖機多做一點事），圖名 `cli-start-owner-absence/children`；暖機失敗是 setup 失敗而不是重試。本機暖機 3.1s，整個檔案由 25.1s 降到 19.5s。
3. **子行程界限可讀**：兩個案例改用 `spawnTestChild`，子行程界限維持原本的 `watchdogMs(30_000)`（Windows CI 45s），案例計時器 = 子行程界限 + 一段回收預留（`TEST_CHILD_REAP_RESERVE_MS`，5s；`spawnTestChild` 只在界限到期擊殺後啟動一次回收預留，所以最壞情況就是界限加一段），Windows CI 由 45s 變 50s、本機由 30s 變 35s，只增加回收餘裕，使案例計時器不再是終止卡住子行程的那一個。子行程在每個階段把 `[owner-absence-child] <階段> at <ms>` 寫到 stderr；逾時時失敗訊息列出已走到的階段。已用暫時注入的 60s 停頓與 3s 界限確認訊息為 `child killed at the 3000ms deadline; exit=null elapsedMs=3048` 加 `[owner-absence-child] modules-loaded at 1317ms`，注入已還原。
4. **保留夜間排程**。`ROADMAP.md` 中期列「停用夜間排程」記的停用條件（連續紅燈且與本 fork 無關）不成立：前一晚全綠，這次只有一個 shard 的一個檔案，且是 fork 自己的測試。

**下次再逾時時怎麼讀**：看失敗訊息的階段行。`modules-loaded` 之前沒有出現＝模組圖載入（暖機沒生效或磁碟停頓）；`fixture-owner-exited` 沒出現＝fixture 的 `bun --version` 孫行程；`recovery-returned` 或 `command-returned` 沒出現＝被測的恢復或命令本體。到那時才有依據討論預算或平台層處理。

## 2026-11-03：Upstream check PR／issue 分類；commit 軸仍待審

開工確認最新 [Upstream check run 41430272684](https://github.com/SanHsien/opencodex/actions/runs/41430272684) 為 failure，HEAD 為 `91a176f94bb20c3059ba6f870a0d8958b4b11abb`。本機 strict 檢查另列出 209 筆新 commit（上游 main `684ad75d254ae96a9971387d09ae428b96ada9c2`）、15 筆 closed-unmerged PR、0 筆新 open platform issue。逐筆讀取下表 PR 本文與留言後，PR 水位由 7794 推到 8086；issue 無新增，水位保持 7860，不能虛增。

2026-11-03 僅分類，沒有採用產品 diff。`reviewed_through` 保持 `88aaa754566d119b6b8fc898f8fb47602387d82e`，`integrated_tag` 保持 v2.93.0，`integrated_through` 不變；`reviewed_date` 保持 2026-10-28（它跟著 commit 軸推進）。最新 stable 已為 v2.96.0，但整版整合屬另一個路線圖項目。strict 的 commit 軸仍為紅，不能以票單分類代替 commit 審查；原路線圖列保留，未達整列驗收。

| PR | 判定與理由 |
| --- | --- |
| [#7843](https://github.com/lidge-jun/opencodex/pull/7843) atomic writer ACL timeout memo | 不另採原 PR：上游已由 #7891（c7f3928a21）重作並關閉原案；含額外子行程退出保護，隨 stable 整合，避免覆蓋較完整版本。 |
| [#7863](https://github.com/lidge-jun/opencodex/pull/7863) Hermes／Command Code alias | 不另採：作者確認由 #7867（3b8414d3d）取代；原分支後續修正不等於上游已接受，隨正式版本整合。 |
| [#7879](https://github.com/lidge-jun/opencodex/pull/7879) protected-tree 路徑元件 | 不另採：上游明示重複於 #7884（463a0ee0b），隨 stable 取正式修正。 |
| [#7895](https://github.com/lidge-jun/opencodex/pull/7895) TensorFold tool rejection | 暫不採：closed、未合併；涉及翻譯 adapter 的終止與用量語意，沒有足夠依據把未接受實作帶入 fork，等上游正式方案。 |
| [#7906](https://github.com/lidge-jun/opencodex/pull/7906) Claude CLI schema offline fixtures | 不採：closed、未合併、intake: hygiene-blocked，且沒有有效需求說明；不能把 fixture 分支當正式修正。 |
| [#7932](https://github.com/lidge-jun/opencodex/pull/7932) Windows test timing | 暫不採：closed、未合併；調整管理回應與 stream fixture 的時間預算，未證明對本 fork 目前 shard 2／7 問題有效，不藉此放寬測試。 |
| [#7933](https://github.com/lidge-jun/opencodex/pull/7933) release 2.94.0 | 不採：上游明示被 #7940 的新 frozen tip 取代；fork 只按 stable tag diff 整合，不重放上游 promotion PR。 |
| [#7953](https://github.com/lidge-jun/opencodex/pull/7953) Azure include | 不另採：上游 carry #7988（d389699c96）已落 dev；隨 stable 取正式版本。 |
| [#7962](https://github.com/lidge-jun/opencodex/pull/7962) CR-delimited sidecar SSE | 不另採：上游 carry #7989（d42b9b1b23）已落 dev；隨 stable 取正式版本。 |
| [#7969](https://github.com/lidge-jun/opencodex/pull/7969) Meta Muse tool catalog | 不另採：carry #7985（1e1620f3d9）另修歷史 catalog 驗證邊界；原 PR 不如正式版本完整，隨 stable 整合。 |
| [#7971](https://github.com/lidge-jun/opencodex/pull/7971) routed slug | 不另採：carry #7979（d82d7ee739）另保留 retained-id 優先序；隨 stable 取正式版本。 |
| [#8028](https://github.com/lidge-jun/opencodex/pull/8028) Claude session pool affinity | 不採原機制：上游 #8094（b14a35afe）改用 principal-scoped 私有身分，避免把 session headers 帶往其他讀取路徑；等包含該 carry 的 stable。只有 x-session-id 的直接 Responses 路徑仍未涵蓋。 |
| [#8056](https://github.com/lidge-jun/opencodex/pull/8056) Anthropic Ultra quota | 不另採：原 PR closed、未合併；main 已有 #8055（e972776ec）的 quota／subscription names 正式實作，隨 stable 整合，不疊加競爭版本。 |
| [#8073](https://github.com/lidge-jun/opencodex/pull/8073) T3 Code 文件 | 不採：作者明示暫不繼續整合並關閉；保留正式文件，避免把個別部署觀察當通用契約。 |
| [#8086](https://github.com/lidge-jun/opencodex/pull/8086) LLMTR free directory | 暫不採：closed、未合併；免費配額與供應商入口尚未成為上游正式目錄，不在 fork 自行增加。 |

Windows 指定 issue 複查（讀取 issue 本文與維護者留言）：

- [#7771](https://github.com/lidge-jun/opencodex/issues/7771)：仍 open。#7973（db7bdc5e3d）只完成拒絕原因診斷；Task Scheduler wrapper 存活／重啟與 Desktop taking-over 死路仍未解，不能記為已修復。
- [#7808](https://github.com/lidge-jun/opencodex/issues/7808)：closed，#7824（07161c5b95）在 dev 拒絕 Windows 無磁碟代號根路徑；尚未整合至本 fork 的 v2.93.0 基底。
- [#7810](https://github.com/lidge-jun/opencodex/issues/7810)：closed；#7823（95cfa30ec7）修 long-TEMP recovery，#7852（fb22d055e0）隔離 Windows Known Folder fixture。上游已完整修復，尚待 stable 整合進 fork；不再沿用「純環境性失敗」歸因。


## 2026-11-03：採用 #7781 的 first-party rollback 逾時回報

來源：上游公開 commit `dd8bf1d657577c889169b8cb34afd6ff28341284`（JUN，#7781）。僅採用其完整五檔 diff，不重放整版產品或 fork overlay；commit 清冊與 scalar 水位限制見 `UPSTREAM.md` 同日區段。

| 安全邊界檔案 | 判定 |
| --- | --- |
| `src/claude/desktop-first-party.ts` | 採用 `rollbackDesktopFirstPartySettled`：仍先等既有 ACL barrier；只有 `WindowsSecretAclSettleTimeoutError` 映成 false，timeout 不執行回復；其他錯誤繼續拋出。不讀取或記錄憑證。 |
| `src/cli/claude-desktop.ts` | 僅把 gateway cleanup 失敗後的回復入口換成 helper；保留 changed 判斷與 mode marker 保存，回報既有 rollback did not complete 警告。其他 ACL barrier 呼叫保留。 |
| `src/server/management/agent-settings-routes.ts` | 同步 management apply 的回復入口與 dynamic import；保留 body size／JSON 驗證、權限、transition lock 與 mode persistence。其他 first-party rollback 的既有 catch 不變。 |
| `src/server/management/native-integration-routes.ts` | 同步 native toggle 回復入口，timeout 走既有 postCommitRefusal 500，而非泛用錯誤；保留 cleanup、ownership 與使用者同意邊界。 |
| `tests/claude-integration/claude-intercept-acl-barrier.test.ts` | 採用 timeout 不執行、非 timeout 錯誤不吞掉、成功執行且傳回結果的測試，以及 model-defaults barrier-entry 握手；不放寬時間限制。 |

本區段不修改 workflow、更新來源、語系、Cargo 或 provider 行為；Windows 與隱私護欄沿用。上游版本開線 #7795 已在四個版本欄位具備，判 skip，避免覆蓋 fork updater／依賴安全差異。沒有新增 release tag，產品整合 tag 仍為 v2.93.0。

採用原作者程式碼的提交須保留：

上游 #7781 的 JUN Co-authored-by trailer（由 `git show --format=full dd8bf1d65` 取得；保留在提交訊息，不寫入產品文件）。


## 2026-11-03：Runcrate 目錄採用；structural tool turns 延後完整審查

採用上游 #7726（`42549ba1b`）的完整目錄變更，維持實驗性、需 key、hybrid discovery。
免費 seed 與付費 live catalog 分開說明，保留帳號年齡、共用額度及有餘額時轉付費的限制。
API root 由 [官方 Chat Completions 文件](https://www.runcrate.ai/docs/models/chat-completions)
核對；免費條款頁未能由查證工具取得，保留上游 2026-10-27 快照日期，不宣稱重新驗證免費資格。

| 邊界／檔案 | 判定 |
| --- | --- |
| `src/providers/free-directory.ts` | 只增 Runcrate 的群組、OpenAI Chat endpoint、模型 seeds 與有界免費額度說明。沒有 credential 讀寫／log、OAuth、帳號池、權限或自動更新變更；不新增 canonical registry entry。 |
| `scripts/test-layout/layout.json`／`layout-providers.json`、`tests/fixtures/test-layout-expected.json` | 僅登錄新的 sibling test；不改執行器、安裝、release 或 CI 權限。保留所有 fork 原有映射。 |
| `tests/providers/free-directory-runcrate.test.ts` | 驗目錄投影、需要 key、免費／付費限制、live discovery 與 canonical credential destination 隔離。日期驗格式，沒有依賴套件版本斷言，也不呼叫外部服務。 |
| 英／繁中 providers 說明與 `structure/providers-and-adapters.md` | 同步目錄用途與計費限制，不宣稱整個 catalog 免費；其餘 owning docs 的 runtime、subagent、transport、Anthropic pool、xAI 合約未變。 |

#7561（`f94e95ce5`）新增 durable principal 與簽章結構 membership；僅完成 scope 與三個
身分／membership 模組的初讀，尚未完成整個 31 檔 diff 與 ingress／adapter 驗收，判 defer。
它是獨立 opt-in 功能，不是 Runcrate 的依賴；不混合採用部分身分鏈，也不前移 scalar 水位。
延後項與後續逐筆游標統一記在 `ROADMAP.md`。（2026-11-05 更新：`f94e95ce5` 已完整審查並重放，見文末「structural tool turns 的安全邊界逐檔判定」；此段保留當時判定。）

作者歸屬：#7726 原作者 Nirupam Bhowmick，上游另帶 JUN co-author；兩筆 trailer 保留在採用提交訊息。


## 2026-11-03：分類水位更正與 Windows 精度／路徑差異

205 筆清冊中，依 stat 第一檔產生的樣板理由只標「只分類、未審」，不當成 fork 等價證據。
`reviewed_through`／`reviewed_date` 保持基準 `d8b305993` 的 88aaa754566d119b6b8fc898f8fb47602387d82e／2026-10-28；
integrated、PR、issue 軸保持。沒有證據足以推進任何連續前綴，strict 的未審 commit 警示保留。

`95cfa30ec`：採用 compaction recovery 的 namespace path，ACL 使用 extended Windows spelling，
memo key 仍用原路徑；備份、exclusive create、fsync、digest recheck 與 atomic rename 邊界保持。
`86b72a689`：對憑證 lstat→open→fstat、初始 config publication、OAuth／service locks、
catalog audit、desktop store 與 integration guards 使用 bigint identity；不從 rounded Number 放大。
共用 bounded reader 保留既有 numeric metadata API，另回傳同一次 descriptor observation 的 exact identity。
全域 identity 擴展涵蓋 Codex catalog、workspace、CLI、Lab、usage／history；比較與精確字串保存共用 file-identity helper。
獨立 Node updater／lease 與無模組的 runtime probe child 保留原生 bigint 比較，不引入 TypeScript 載入依賴；CLI legacy numeric 欄位只供協定 metadata，授權使用 exact fileId。
Windows catalog 實體 file symlink 測試在能力探測遇 EPERM 時 skip；其他錯誤照常失敗，沒有改變產品路徑比對語意。

兩筆上游作者皆 JUN，均帶 JUN 的 Co-authored-by trailer；完整作者行由 git show 的提交 metadata 查詢，不複製個人信箱到產品文件。
驗收命令與紅綠結果見 `REVIEW.md` 的新段落；全版 stable 整合與其餘候選保留於路線圖。

## 2026-11-03：採用兩筆獨立 Responses 修正

採用 `2f7f1d113` 的 rejected reasoning toggle 清理與 `f4eef7b23` 的正常 EOF 尾列解析。完整上游 diff 與 fork 檔案／行號證據見 `UPSTREAM.md` 的同日獨立修正段，紅綠測試見 `REVIEW.md`。兩者均可沿用 fork 現有介面，不帶入 504417f0e 的多項 parser 重構或 d42b9b1b2 的 CR 分隔改動；只維持英文／繁中說明。EOF 不是完成訊號，wire／decoded cap 與讀取失敗不放寬；native snapshot effort clamp 與 payload 去敏記錄維持原狀。

採用獨立 commit 不代表其間 commit 已審，scalar reviewed／integrated 水位維持 `88aaa754`／v2.93.0。完整 stable 的其餘驗收依 `ROADMAP.md` 繼續追蹤。重新評估條件為完整 tag diff 重放或相關 parser／能力正規化合約改變。

## 2026-11-03：bigint identity 的持久化相容性

決定在 `src/codex/shim-migration.ts` 的持久化 journal 比對容許時間轉換捨入差，不變更共用 `identityStats()` 的時間來源，也不額外以 pathname 做第二次 numeric stat。容差為 `min(0.001 ms, Number.EPSILON * max(abs(left), abs(right)))`，只接受有限數字；同一執行中的 journal 檢查與復原後檢查仍用嚴格時間相等。dev／ino 必須精確相等，mode、size 與 symlink target 必須完全相同。這讓舊版 numeric stat 記錄的中斷遷移可在 bigint 版續做，同時拒絕 0.01ms 或更大的時間差與其他 metadata／身分變更。（2026-11-04 已由「2026-11-04：#8019 identity 補審與 native Messages stream 提前結束」決定一取代：`identityStats()` 改用 `statTimeMs`；shim-migration 的持久化容差保留。）

持久化 dev／ino 的十進位字串保留完整身分；新版只接受精確字串或安全範圍內的舊整數，不猜測已捨入的大整數。降版不相容是刻意保留的 fail-closed 邊界：舊版可能因字串形狀或嚴格數字比較拒絕新版 journal／overlay／其他所有權紀錄。降版前先以新版完成中斷遷移／復原；不要把字串強轉 Number、刪除復原證據或放寬 inode 比對來繞過拒絕。

`src/routing/history/ingest.ts` 的 `sourceMtimeMs` 是可重建 SQLite 投影的來源 metadata；時間浮點尾數變動可能多觸發一次 reindex，不改寫 canonical usage JSONL、不遷移帳號資料。維持既有精確 freshness 比對，避免把 journal 的相容容差擴散到歷史索引。重新評估條件為 journal 時間格式、numeric stat 轉換或持久化 identity schema 改變；Unix 分支的跨版續做以 Windows 上真實檔案／hard link 搭配還原式平台與 stat 替身驗證，原生 Unix 執行不屬於 Windows-only fork 的本機驗收。

## 2026-11-03：docs-site 的 sharp 下限提高到 0.35.5

**決定**：`docs-site/package.json` 的直接依賴 `sharp` 由 `^0.35.4` 改為 `^0.35.5`，`docs-site/bun.lock` 隨之解析為 `sharp@0.35.5`（預建 libvips 為 `1.3.4`，內含 librsvg 2.63.2）。
理由是 sharp 安全公告 GHSA-wq5f-xc86-pv6w（CVE-2026-96889，內含的 librsvg 記憶體安全問題，glibc Linux 上特定條件可導致 RCE）將受影響範圍定為 `< 0.35.5`。
`astro` 7.4.5 自身仍宣告 `sharp ^0.35.4`，所以升 astro 解不了；sharp 本來就是 docs-site 的直接依賴，直接抬高下限即可，不需要 `overrides`。

**與上游的差異**：這是 fork 對上游 `docs-site/package.json` 的一行差異。移除條件為上游（或 astro）的鎖定解析到 sharp `>= 0.35.5`，屆時可還原成上游寫法。
**重新評估條件**：sharp 發布新的安全公告，或 docs-site 開始處理不受信任的 SVG 輸入（目前只在建置時處理 repo 內的圖片）。

## 2026-11-04：#8019 identity 補審與 native Messages stream 提前結束

**決定一（採用 `statTimeMs`，取代 2026-11-03「不變更 `identityStats()` 時間來源」）**：`src/lib/file-identity.ts` 新增 `statTimeMs(ns)`（整秒×1e3＋奈秒餘數／1e6，即 runtime 數字 stat 的公式），`identityStats()` 與 `src/oauth/store.ts` 改用。理由是實測 `Number(ns)/1e6` 與數字 `mtimeMs` 在約四分之一的真實檔案上不等，持久化或數字觀察的比對因此失準。`src/codex/shim-migration.ts` 的持久化容差保留：舊版（以 `Number(ns)/1e6` 寫入）的 journal 仍可續做，並新增測試覆蓋。`structure/runtime.md` 同步。歷史索引的 `sourceMtimeMs` 只是顯示 metadata（`request-history-routes.ts`），不參與 freshness 比對，不受影響。重新評估條件：runtime 改變數字 stat 的毫秒公式。

**決定二（`*Ms` 截斷）**：`BigIntStats` 的 `*Ms` 是截斷毫秒；`codex-home-owner.ts`、`lib/bounded-file-read.ts`、`adapters/codebuddy/mcp-server.ts` 的讀取穩定性檢查改比 `*Ns`，避免同一毫秒內同大小的改寫漏檢。`state-lock.ts`／`ownership-mutation-lease.mjs` 的 `*Ms` 只做 stale 年齡判斷，不改。

**決定三（不重放的部分）**：`cli-update-artifacts.ts`、`shim-wrapper-write.ts`（皆屬 #7586／#7648 updater 鏈，defer）；上游注入 stat 縫改 bigint 與 `ShimPathFingerprint.identity` 欄位（fork 設計不同、正式路徑已等價）；guard 測試 declarationBody 修正。觸發條件：updater 鏈整合時一併重放並重評注入縫。

**決定四（`8eb970d9d` 採用）**：native Messages stream 在 clean EOF 但沒有 terminal 時，不再記 200／補完成，改為失敗 turn（502、`api_error` frame、`streamAborted`）。這會讓過去被當成完成的半截回應對客戶端可見為錯誤，是刻意的行為變更；相容 provider 若省略 `message_stop`，只要最後一個完整 message event 帶非 error `stop_reason` 即仍算完成，`anthropicEofTolerance` provider 保留內容式 EOF。

水位：`reviewed_through`、`reviewed_date`、`integrated_*`、PR、issue 全部保持原值；四筆審查不構成連續前綴。作者歸屬：四筆上游作者為 JUN，trailer 保留於採用提交訊息。

## 2026-11-04：Upstream check PR／issue 軸清空；commit 軸仍紅

**決定一（#7614、#7618 不另採）**：兩筆都是上游已關閉、未合併的 Windows updater stack 子分支（作者 luvs01），關閉理由是內容已全部併入 #7648（`c655484d9`，`dev`）。fork 沒有 `src/codex/windows-cli-child*.ts`、`cli-windows-plan-provenance.ts`、`cli-update-apply`／`cli-update-job*`，`src/codex/cli-update-plan.ts:501-502` 在 Windows 一律拒絕 plan，所以缺少這些檔案沒有行為缺口。不引用 PR 分支版本，因為上游明示不要並行落地兩個版本，且 #7618 的拒絕測試不能原樣套在 #7648 的 verified-authority 契約上。處理點是整合列：updater 鏈（#7586→#7596→#7626→#7648）整合時以 `c655484d9` 最終版整體審。逐筆事實與檔案:行號見 `UPSTREAM.md` 2026-11-04 節。

**決定二（#8161 不適用）**：macOS Keychain 的 `security` 被 timeout 殺掉而觸發 Apple securityd 當機，fork 的三個讀取點（`src/oauth/local-token-detect.ts:78,114`、`src/claude/auth-detect.ts:207`）都以 `process.platform !== "darwin"` 早退，Windows 不會 spawn `security`。不構成 fork 受影響的安全問題，不開路線圖列。重新評估條件：fork 重新支援 macOS。

**決定三（#7771 新症狀延後）**：2026-11-02／11-04 的新留言指出 `ocx service restart` 可在舊 serving 行程仍活著時回報成功。fork 的對應程式（`src/service/repair.ts:259`、`src/service/windows-ops.ts:842-848`、`src/service/health.ts:59-78,160`）與上游描述同構，成因是只驗證「有 OpenCodex 在回應」而非「新 runtime 取代了舊 runtime」。尚未在本機重現、上游也無修正，所以不在 fork 單獨 patch（避免與上游即將的 restart 驗證設計分歧）。觸發條件：上游修正合併，或本機實際遇到重啟後舊 PID 存活；屆時升為路線圖近期列。

**水位**：`reviewed_pr_numbers` 加入 7614、7618；`reviewed_issue_through` 7860 → 8161（水位以上只有 #8161 一筆 open `platform` issue）。`reviewed_pr_through`、`reviewed_pr_closed_before`、`reviewed_through`、`reviewed_date`、`integrated_*` 全部不動。

**為什麼 `Upstream check` workflow 仍會紅**：`tools/check-upstream-updates.ts` 在 `--strict` 下只要 `commits.length > 0`、新 issue 或待審 PR 任一不為零就回 1（`main()` 末段），`.github/workflows/upstream-check.yml` 再把 step 失敗轉成 job 失敗。PR 軸與 issue 軸清空後，剩下的 254 筆 commit（`88aaa754..cab7eb7d0`，v2.97.0）仍會讓它回 1；只有 stable 整合列完成、`reviewed_through` 推進到已審的連續前綴後才會轉綠。這是設計如此，不是工具壞；不為了轉綠而放寬判定或把 `reviewed_through` 推到沒有逐筆證據的位置。

## 2026-11-05：`safety_identifier`、fixture 命名空間隔離、無磁碟代號路徑（`67bdeb03a`、`fb22d055e`、`07161c5b9`）

維護者政策：上游做法合法可用即採用，只判技術適配、Windows 適用性與安全回歸。逐筆事實見 `docs/fork/UPSTREAM.md` 同日節。

**決定一（`67bdeb03a` 採用）**：canonical ChatGPT 轉送目的地丟棄 `safety_identifier`，其餘目的地（官方 API key 面、第三方閘道）保留，因為它是公開的 OpenAI 平台參數。紅燈：`responses-forward-prompt-envelope.test.ts` 在舊程式 11 pass／2 fail（`Object.hasOwn(body,"safety_identifier")` 為 true）；綠燈：13 pass／0 fail。

**決定二（`fb22d055e` 採用、一檔不適用）**：fixture 子行程的 `%LOCALAPPDATA%` 命名空間隔離。`sibling-home-client-sync` 的「lone custom-home start」案例單獨跑，HEAD 版本兩次都逾時失敗（37 s、30 s，`expect(...).toBe` 失敗），套用後兩次通過（19.9 s、24.3 s）。`cli-start-auxiliary-bind` 不適用（見 UPSTREAM 同日節，觸發條件：採用 `a4e4cda1d`）。

**決定三（`07161c5b9` 採用）**：Windows 的 client 路徑覆寫必須帶磁碟代號或 UNC。這是行為收緊：過去被接受的 `\Users\x`、`/x` 會依行程目前磁碟解析，背景 proxy 與前景 client 可能指到不同檔案；現在以 `ClientPathError` 拒絕。紅燈：新增的 `client-path.test.ts` 在舊 `src/clients` 為 8 pass／31 fail；綠燈 39 pass／0 fail。

**安全邊界逐檔判定**（上游等價保護與 fork 現況一致就採上游）：

| 檔案 | 判定 | 理由 |
| --- | --- | --- |
| `src/adapters/openai-responses/canonical-forward.ts` | 採用 | 只改 canonical-only 丟棄清單；不碰憑證、標頭、ACL 或轉送目的地判斷（`isCanonicalOpenAiForwardProvider` 未動），非 canonical 路徑位元組不變，`access_programs` 等既有 strip 測試仍綠 |
| `src/clients/client-path.ts`、`src/clients/gentle-shell-path.ts`、`src/clients/config-export.ts`、`src/clients/config-export/agent-clients.ts`、`src/clients/config-export/qoder.ts` | 採用 | 路徑驗證只收緊不放寬：Windows 的 `isAbsolute` 接受的集合是 `isAbsoluteClientPath` 的超集；Command Code home 在不合格時回落到 `homedir()`（原行為）；不改寫入、備份、鎖或 ACL 流程 |
| `tests/helpers/fixture-windows-runtime-preload.ts`、`tests/helpers/fixture-namespace-owner.ts` | 採用（原樣） | 防線方向是保護真實 home：fixture home 與 local-appdata 必須在擁有者根之內、不與受保護樹重疊（含大小寫與 symlink 別名）、nonce 相符，否則在 `mkdir` 與 mock 註冊之前拒絕；31 個測試釘住每個拒絕分支。依賴的 `src/lib/test-home-guard.ts` 未改 |
| `src/lib/test-home-guard.ts`、`src/codex/windows-local-appdata.ts` | 不變 | 上游這三筆沒有修改它們；preload 只呼叫既有匯出 |

**測試證據（每檔單獨 `bun test <file> --timeout=60000`）**：全 0 fail 的檔案——`responses-forward-prompt-envelope` 13、`responses-canonical-only-top-level-fields` 5、`client-path` 39、`omo-client` 9、`prime-client` 7、`client-config-export-new-clients` 34、`minimax-clients` 19、`zcode-client` 19（2 skip）、`management-client-config-route` 43、`fixture-windows-runtime-preload` 31、`test-layout` 2、`test-layout-tooling` 27、`structure-ssot` 51、`fork-hygiene` 39，以及其餘走路徑解析點的 18 個既有檔。`tsc --noEmit` 與 `privacy:scan` 通過。

**本機環境失敗（HEAD 同樣失敗，與本次改動無關）**：`catalog-auto-review-row` 的「retained-sync」案例在 `finally` 清理 `.tmp\…` 時 `EBUSY: resource busy or locked, rm`（HEAD 版本 1 fail、套用後 1–2 fail，同一個 EBUSY 簽章，斷言本身通過）；`sibling-home-client-sync` 整檔跑時約 20–30 秒的重案例（HEAD 版為「lone custom-home start」與「registry-only discovered owner」，套用後為「secondary ensure parent」）會碰到 30 秒測試逾時，單獨跑 `secondary ensure parent` 為 18 s 通過。這些是本機慢速檔案系統／防毒負載造成的逾時與鎖，需在非虛擬化 Windows 終端複驗。

水位：`reviewed_through`、`reviewed_date`、`integrated_*`、PR、issue 全部不動。

## 2026-11-05：ACL memo／CR 的安全邊界逐檔判定

依據：`c7f3928a2`、`d42b9b1b2` 完整公開 diff；fork 基準 `6f7bfbe46999`。維護政策是上游方案合法可用即採用，依技術、Windows 適用性及安全回歸判定，不另設產品政策門檻。

| 安全邊界檔案 | 判定 | 核對證據與理由 |
| --- | --- | --- |
| `src/config/atomic-write.ts` | 採用，依 fork writer 適配 | `:230,270,293` 的空暫存檔仍在寫入 secret 前 required harden；`:331,477` 的發布前 harden 仍必須成功。`:37-55` 只對尚未 reap 的 retained child 阻止同目的地 admission，不阻止健康重疊；以 canonical parent＋basename、Windows 小寫 key 統一目的地。`:366,503` 先切 cleanup 模式，`:395,539` finally 保留其他 writer 的所有權並等實際 reap 才釋放。保留 descriptor/path bigint identity、symlink/no-follow、原目的地內容、殘留檔與 scrub 錯誤分類。23 個注入 clock／runner 案例全部通過，含 denial、重複 cooldown、不同目的地、多 writer／多 retained child |
| `src/lib/windows-secret-acl.ts` | 不變，沿用現有機制 | `:83` 的五分鐘常數、`:563` 的實際 child 回收 barrier、`:1033-1035` 的單次復原及重設窗均已存在。writer 只是明確 opt in；不放寬 ACL、不吞 permission-denied、不增加背景 timer |
| `src/lib/windows-user-principal.ts` | 不變 | 新測試在 teardown 還原 sync／async principal runner 後才 reset principal cache；不把 fixture SID 帶入後續 native ACL 測試 |
| `src/web-search/parse.ts` | 採用 | `:323-324` 只換 line splitter；`:310-318` clean EOF 才 flush、`:319-321` wire byte cap、`:329-346` decoded／terminal／wire 中止規則均未改。CRLF 分在兩個 chunk 時空行無 data field；單 byte UTF-8 不破壞 TextDecoder 狀態。23 案包含最後一行、超限不 flush、傳輸失敗不 flush、CR 失敗訊息與 terminal 立即取消 |
| `tests/server/config.test.ts`、`tests/windows/windows-atomic-write-acl-rearm.test.ts` | 採用 | required＋destination＋retry opt-in 的精準斷言，以及五個 call sites、cleanup、retained child 的行為回歸；未以 mock 取代測試目標 writer 的 default hardener |
| `tests/web-search/web-search-eof.test.ts` | 採用 | 追加上游 11 個 line-ending 案例，保留既有 12 個 EOF／limit 案例；未降低 byte／decoded 上限 |
| layout／fixture 對應表及英／繁中文件 | 採用 | 僅登錄新測試與同步已驗證行為，不改 runtime、安裝、workflow、權限或憑證。韓文文件因 fork 不含該語系判不適用 |

回歸證據：舊碼指 fork HEAD 原始 runtime 加新測試；ACL 7 pass／16 fail → 23 pass／0 fail，EOF／CR 17 pass／6 fail → 23 pass／0 fail。既有 config 193 pass／6 skip／0 fail；其餘指令與限制見 `REVIEW.md` 同日節。若日後改動 destination normalization、ACL reap barrier 或 SSE terminal／limit 順序，需重新驗證這些性質。integrated／reviewed scalar 與 PR／issue 水位不動。

## 2026-11-05：structural tool turns 的安全邊界逐檔判定（`f94e95ce5`）

依據：上游 `f94e95ce5` 完整 31 檔 diff；fork 基準 `7b3c6ec1d`。維護政策是合法可用即採用，只依技術適配、Windows 適用性與安全回歸判定。整筆重放，功能預設關閉（需 `OPENCODEX_RESPONSE_TURN_SIGNING_KEY`）。fork 在此之前沒有 durable principal、簽章 item ID 或提早 tool 完成機制，所以每一項都是新增的防線，沒有被取代的 fork 版本；「不弱於 fork」的比較對象是 fork 既有的 `contextPrincipalId`／`linkIngress`／provider-opaque ownership，這三者全部不改。

| 安全邊界檔案 | 判定 | 威脅與核對 |
| --- | --- | --- |
| `src/server/auth-cors.ts` `resolveDurableReplayPrincipal`（`:517`） | 採用 | 威脅：他人（或同機另一憑證）偽造或重用別人的簽章 ID 取得重排權。對策：只認 `x-opencodex-api-key`，不吃 thread-id／User-Agent／loopback／upstream bearer；憑證須通過既有 `resolveDataPlaneAdmissionSecret`；admission 非 loopback 時 kind 與 keyId 必須一致（`configured` 另比 keyId）；簽章金鑰長度不是 32 bytes 一律拒絕；principal 是 HMAC(金鑰, 憑證)，不含明文，憑證或金鑰輪替即換 scope。不弱於 fork：`linkIngress` 白名單（`:461`）下，admission 與此處解的是同一個 dedicated header（`:646,673` 優先序），白名單外的 key 或 environment token 在 admission 階段已被拒，kind／keyId 比對再擋不一致；loopback 路徑與 `resolveContextPrincipal`（`:500`）同樣接受任何有效 key，沒有放寬。測試 `data-plane-admission-identity.test.ts` +3 案（穩定 scope、不含明文、缺 admission／錯 key／無 key／bearer only／named admission 不一致／短金鑰皆拒、輪替換 scope），28 pass |
| `src/responses/turn-membership.ts` | 採用 | 威脅：偽造 `*_ocxt1_*` item ID 讓不屬於同回合的 call／result 被重排，或藉重排混入他人歷史。對策：ID 內含 key id、nonce、序號、kind 碼與 HMAC-SHA256 前 16 bytes，HMAC 綁定 principal＋thread＋header 並有 domain-separation 字串；`timingSafeEqual` 前先驗長度；任何以保留前綴開頭卻驗證失敗的 item 使整個輸入原樣返回（fail closed）；群組內序號須嚴格遞增、call_id 唯一、每個 call 恰一個型別相符的結果、span 內不得夾入其他 item，否則原樣返回；上限 65,536 items、8 把金鑰、金鑰長度 32-64；建構時複製金鑰 bytes，呼叫端清空 Buffer 不影響。僅證明「分組」，不證明 payload、完成狀態、執行權限；不產生、不寫碟、不從歷史恢復金鑰。測試 53 案 |
| `src/server/responses/turn-membership.ts` | 採用 | 威脅：金鑰格式錯誤或 parent／sibling thread 混入。對策：嚴格 regex＋base64url 往返比對＋32 bytes；只取請求自己的 `thread-id`，缺少即不啟用；未設定即 `undefined`，整條路徑不改輸入 |
| `src/server/responses/request-prepare.ts`（`:471,1652`） | 採用 | 在 `parseRequest` 之前只做重排；`completedToolBlocks` 僅對 responses 入口、串流、非 compaction 的已驗證請求為真，客戶端 JSON 無法自行設定 |
| `src/server/responses/adapter-delivery.ts`（`:134`）、`adapter-dispatch.ts`（`:340,657`）、`request-transport.ts`（`:913`） | 採用 | 威脅：把簽章 ID 套到原生／sidecar／compaction／advisor 等其他擁有者的 output。對策：僅 openai-chat 活動 adapter、非 chat／anthropic 入站、非 compaction／advisor／client encoder、且回應標頭協商成功才建工廠；continuation 與 sidecar 路徑不傳 context。三個 buildRequest 站點一致傳旗標，缺旗標則提早送出關閉 |
| `src/bridge/sse.ts` | 採用 | 七處 item ID 改走工廠，無工廠時為原 `prefix_uuid`；同一 item 的 added／delta／done／completed 取得同一 ID（ingress 測試逐框驗證）。不改 reasoning envelope、budget、heartbeat |
| `src/adapters/openai-chat.ts`、`openai-chat/completed-tool-blocks.ts`、`serialized-tool-call-content.ts` | 採用 | 威脅：上游或偽造標記讓同一 tool call 被執行兩次，或提早送出未完成的呼叫。對策：需 per-exchange context＋provider 設定標頭＋回應標頭三者齊備；標記必須同 index、同非空 call ID、無 function 欄位、不得重複，違者以 error 終止；提早送出只限名稱非空、arguments 為字串且解析成不含 `input` 的物件、非 freeform、前方無 held 文字或 reasoning；已送出的呼叫不重送。無 context 時建請求會刪除協商標頭。測試 +12 案（含 24 個反序標記、後續錯誤保留已關閉呼叫） |
| `src/adapters/base.ts`、`required-tool-result.ts`、`unique-tool-call-ids.ts` | 採用 | 只轉送新增的第四參數；call ID 重鑄與必要工具結果守衛不變 |
| 其餘 wrapper（`workbuddy.ts`、`anthropic-progress.ts`、`zed.ts`、web-search loop） | 不適用／不需改 | 不轉送 context，故永不啟用提早完成；這是保守方向 |
| 測試、layout 對應表、`structure/`、docs-site | 採用 | 只登錄新測試並描述已驗證契約；英文與 zh-tw 的 `headers?` 列加實驗性警語。無 runtime、安裝、workflow、權限或憑證變更 |

Windows 適用性：只用 `node:crypto` 與環境變數，不碰檔案系統、路徑或 ACL；測試在本機 Windows 通過，未出現 symlink EPERM 或 MSIX 路徑差異。未解決風險：若未來把 `OPENCODEX_RESPONSE_TURN_SIGNING_KEY` 注入服務環境，金鑰會進入行程環境，須比照其他 secret 避免寫入 log；本 fork 預設不設。紅綠與 gate 見 `UPSTREAM.md` 同日節。

## 2026-11-05：additional_tools 提升與回放權限逐檔判定（`d9e0c057881`）

基準 `688b04a0e3a00a417e0b7492b8d682ed07d1b174`；依賴 `f94e95ce5` 已在該 HEAD 重放。已讀上游完整 45 檔 diff，按技術適配、Windows 適用性與安全回歸判定，合法可用的實作採用。作者 JUN、共同作者 Omar；提交歸屬資料由原提交取得，文件不保存信箱。下列行號指此項適配後的 fork。

```text
原始 input -> 複製並標記 historical/live -> 修復／重排／工具 lowering
                                               |
                     current discovery/catalog -> tools -> JSON（無 symbol）
                     historical catalog        -> 只供回放，不授權 current tool
```

| 上游檔案（完整清單） | 判定 | fork 對照 | 技術／安全理由 |
| --- | --- | --- | --- |
| `docs-site/src/content/docs/fr/reference/configuration/providers.md` | 不適用 | `FORK.md:20` | fork 只留英文與繁中，不恢復已刪語系。 |
| `docs-site/src/content/docs/ja/reference/configuration/providers.md` | 不適用 | `FORK.md:20` | fork 只留英文與繁中，不恢復已刪語系。 |
| `docs-site/src/content/docs/ko/reference/configuration/providers.md` | 不適用 | `FORK.md:20` | fork 只留英文與繁中，不恢復已刪語系。 |
| `docs-site/src/content/docs/reference/configuration/keychain.md` | 不適用 | `docs-site/src/content/docs/reference/configuration/providers.md:1593` | 這是既有 keychain 說明搬頁，非 additional_tools 前置需求；保留英文／繁中原位置與 anchor，避免新增單語文件及無關搬移。 |
| `docs-site/src/content/docs/reference/configuration/providers.md` | 改寫 | `docs-site/src/content/docs/reference/configuration/providers.md:376` | 同步英／繁中設定、forward 邊界、歷史目錄權限與 save carry；依 fork 欄位清單移除易過時的固定數字，keychain 原位保留。 |
| `docs-site/src/content/docs/ru/reference/configuration/providers.md` | 不適用 | `FORK.md:20` | fork 只留英文與繁中，不恢復已刪語系。 |
| `docs-site/src/content/docs/tr/reference/configuration/providers.md` | 不適用 | `FORK.md:20` | fork 只留英文與繁中，不恢復已刪語系。 |
| `docs-site/src/content/docs/zh-cn/reference/configuration/providers.md` | 不適用 | `FORK.md:20` | fork 只留英文與繁中，不恢復已刪語系。 |
| `docs-site/src/content/docs/zh-tw/reference/configuration/providers.md` | 改寫 | `docs-site/src/content/docs/zh-tw/reference/configuration/providers.md:290` | 同步英／繁中設定、forward 邊界、歷史目錄權限與 save carry；依 fork 欄位清單移除易過時的固定數字，keychain 原位保留。 |
| `scripts/test-layout/layout-providers.json` | 改寫 | `scripts/test-layout/layout-providers.json:1` | 只在 fork 現有 mapping 增補三個新測試，保留原有 Runcrate row，不帶入其他待審功能的登錄。 |
| `src/adapters/openai-responses/muse-tool-catalog.ts` | 不適用 | `src/adapters/openai-responses/passthrough.ts:350` | fork 無 muse-tool-catalog 模組與 normalizeMuseToolCatalog 呼叫，故不引進整個 Meta catalog 功能；共用 discovery 過濾已採用並由既有 Meta 測試驗證。 |
| `src/adapters/openai-responses/passthrough.ts` | 改寫 | `src/adapters/openai-responses/passthrough.ts:50` | 在 identity／input 修復前複製並標記來源；採用官方 xAI／Go 自動提升及 forward 明確 opt-in，保留 fork 的 usage、帳號 ID 隔離與未採用的 Meta 分支。 |
| `src/adapters/openai-responses/prompt-cache.ts` | 採用 | `src/adapters/openai-responses/prompt-cache.ts:75` | 重建物件保留 symbol；刪除 prompt cache 私有欄位的原有遞迴預算不變。 |
| `src/adapters/openai-responses/request-strips.ts` | 採用 | `src/adapters/openai-responses/request-strips.ts:274` | 抽出相同 private-item predicate；既有 destination 條件、未知項目保留行為不變。 |
| `src/adapters/openai-responses/tool-output-recovery.ts` | 採用 | `src/adapters/openai-responses/tool-output-recovery.ts:354` | bridge 還原、外部 task、orphan replacement 與 synthetic output 逐一繼承來源，不以位置猜測。 |
| `src/adapters/openai-responses/tool-schema.ts` | 採用 | `src/adapters/openai-responses/tool-schema.ts:199` | discovery 在合併前按來源過濾；歷史 discovery 不得啟用當前工具，也不覆蓋 live wrapper。 |
| `src/adapters/opencode-go-additional-tools.ts` | 採用 | `src/adapters/opencode-go-additional-tools.ts:30` | HTTPS 官方 hostname／標準 port 比對；合法 wrapper 才提升，畸形 tools 保留原樣；原 Go export 保留相容性。 |
| `src/adapters/routed-agent-messages.ts` | 採用 | `src/adapters/routed-agent-messages.ts:41` | 替換 agent message 保留 historical/live 標記；混合密文拒絕與內容轉換不變。 |
| `src/adapters/xai-web-search.ts` | 採用 | `src/adapters/xai-web-search.ts:268` | hosted x_search 注入只認 current wrapper；歷史 x_search 不抑制當前搜尋，原 selector 限制不變。 |
| `src/adapters/zed-additional-tools.ts` | 改寫 | `src/adapters/zed-additional-tools.ts:17` | fork 無此前置 helper，補入上游實作與必要 caller；只提升 current 目錄，已有頂層宣告優先，type/name 去重。 |
| `src/adapters/zed.ts` | 改寫 | `src/adapters/zed.ts:75` | fork 尚無 pre-delegation lift，補入最小 clone＋lift，取代上游刪除不存在之第二次 lift 的 hunk；其餘 Zed stream／OAuth 流程保留。 |
| `src/config/schema/leaf-validators.ts` | 採用 | `src/config/schema/leaf-validators.ts:362` | 只接受 optional boolean，沒有預設開啟自訂閘道。 |
| `src/providers/model-rename-fields.ts` | 採用 | `src/providers/model-rename-fields.ts:32` | 明列非 model selector，rename 不改其值；exhaustive typecheck 覆蓋新增欄位。 |
| `src/responses/custom-tool-compat.ts` | 採用 | `src/responses/custom-tool-compat.ts:235` | recursive clone 保留 symbol，不把 historical wrapper 誤當 current；既有 custom-call 修復契約不變。 |
| `src/responses/item-provenance.ts` | 採用 | `src/responses/item-provenance.ts:1` | JSON 不可表達 symbol，不能由外部 payload 偽造；標記只屬本次請求投影，不取代 principal／HMAC membership，不寫入 JSON。 |
| `src/responses/namespace-tool-compat.ts` | 採用 | `src/responses/namespace-tool-compat.ts:345` | historical/current 宣告分別建 plan 與 emitted set，歷史名稱不壓掉 current 宣告；alias／selector 邊界維持。 |
| `src/server/auth-cors.ts` | 採用 | `src/server/auth-cors.ts:1090` | 欄位維持 editor policy；admin-token DTO 不新增 secret，data-plane admission／CORS／durable principal 完全不改。 |
| `src/server/management/provider-overwrite-carry.ts` | 改寫 | `src/server/management/provider-overwrite-carry.ts:54` | 沿用 fork 的欄位清單，僅新增本設定；同 destination overwrite 保留省略值，destination 移動不 carry；PATCH boolean／null，POST 非 boolean 拒絕。 |
| `src/server/management/provider-routes.ts` | 採用 | `src/server/management/provider-routes.ts:910` | GET 回傳 optional boolean，不序列化憑證；寫入仍走現有 editor、destination validation 與 atomic config。 |
| `src/server/responses-undeclared-tool-guard.ts` | 採用 | `src/server/responses-undeclared-tool-guard.ts:140` | 內部標記優先於 stale prefix，current catalog 排除歷史 hosted-tool 權限；無 tag 呼叫端仍用 numeric prefix。 |
| `src/server/responses/passthrough-dispatch.ts` | 採用 | `src/server/responses/passthrough-dispatch.ts:469` | JSON 後不可再按原 prefix 切 input；原 current wrappers 已先取授權，outbound 只補頂層 adapter 宣告，避免 historical discovery 授權執行。 |
| `src/types/provider.ts` | 採用 | `src/types/provider.ts:444` | 明載 opt-in 與 forward 例外；沒有金鑰、端點或帳號池新路徑。 |
| `structure/gui-and-management-api.md` | 改寫 | `structure/gui-and-management-api.md:278` | 依 fork 現有模組記錄 provenance、current catalog 與 management boolean 契約；沒有 Meta catalog 模組的段落不移入。 |
| `structure/transports/responses-wire-shapes.md` | 改寫 | `structure/transports/responses-wire-shapes.md:160` | 依 fork 現有模組記錄 provenance、current catalog 與 management boolean 契約；沒有 Meta catalog 模組的段落不移入。 |
| `structure/transports/responses.md` | 採用 | `structure/transports/responses.md:208` | 依 fork 現有模組記錄 provenance、current catalog 與 management boolean 契約；沒有 Meta catalog 模組的段落不移入。 |
| `tests/adapters/routed-agent-messages.test.ts` | 採用 | `tests/adapters/routed-agent-messages.test.ts:1` | 保留上游回歸／fixture；逐檔獨立執行，驗證 actual outbound body、raw input 不變及歷史權限隔離，不釘依賴版本。 |
| `tests/fixtures/test-layout-expected.json` | 採用 | `tests/fixtures/test-layout-expected.json:1` | 保留上游回歸／fixture；逐檔獨立執行，驗證 actual outbound body、raw input 不變及歷史權限隔離，不釘依賴版本。 |
| `tests/providers/xai/xai-additional-tools.test.ts` | 採用 | `tests/providers/xai/xai-additional-tools.test.ts:1` | 保留上游回歸／fixture；逐檔獨立執行，驗證 actual outbound body、raw input 不變及歷史權限隔離，不釘依賴版本。 |
| `tests/providers/xai/xai-loaded-tool-provenance.test.ts` | 採用 | `tests/providers/xai/xai-loaded-tool-provenance.test.ts:1` | 保留上游回歸／fixture；逐檔獨立執行，驗證 actual outbound body、raw input 不變及歷史權限隔離，不釘依賴版本。 |
| `tests/providers/xai/xai-replay-provenance.test.ts` | 採用 | `tests/providers/xai/xai-replay-provenance.test.ts:1` | 保留上游回歸／fixture；逐檔獨立執行，驗證 actual outbound body、raw input 不變及歷史權限隔離，不釘依賴版本。 |
| `tests/providers/zed-hosted-provider.test.ts` | 改寫 | `tests/providers/zed-hosted-provider.test.ts:530` | 相同行為案例適配 fork 既有 mock catalog fixture；HEAD runtime 先紅，新增 pre-delegation lift 後綠。 |
| `tests/responses/openai-responses-passthrough.test.ts` | 採用 | `tests/responses/openai-responses-passthrough.test.ts:1` | 保留上游回歸／fixture；逐檔獨立執行，驗證 actual outbound body、raw input 不變及歷史權限隔離，不釘依賴版本。 |
| `tests/responses/responses-muse-tool-choice.test.ts` | 不適用 | `tests/responses/responses-muse-tool-choice.test.ts:1` | 新增案例依賴 fork 不存在的 normalizeMuseToolCatalog；保留既有 Meta choice 回歸，以共用 loaded-tool 測試驗證來源過濾。 |
| `tests/server/management-provider-compat-carry.test.ts` | 採用 | `tests/server/management-provider-compat-carry.test.ts:1` | 保留上游回歸／fixture；逐檔獨立執行，驗證 actual outbound body、raw input 不變及歷史權限隔離，不釘依賴版本。 |
| `tests/server/server-xai-responses-streaming.test.ts` | 採用 | `tests/server/server-xai-responses-streaming.test.ts:1` | 保留上游回歸／fixture；逐檔獨立執行，驗證 actual outbound body、raw input 不變及歷史權限隔離，不釘依賴版本。 |

安全覆核結論：只有本機 adapter 建立的 symbol 可作為這個投影的來源標記；它不等同 f94e95ce5 的 durable principal 或簽章工具分組證據。HTTP／WS 的 admission、CORS、key scope、bearer、帳號隔離、簽章與既有 undeclared-call guard 保持原邊界。管理欄位不擴權；只增加 editor 可設定的 optional boolean，跨 destination 不繼承。Zed helper／caller 是此項所需的最小適配，不帶入 stream、OAuth 或 diagnostic redesign。Windows 不需新 symlink、ACL、原生元件或相依套件。

重新覆核條件：新增 input replacement／重排、改寫 serialization 邊界、改變 current catalog 收集或新增同名 provider overwrite 路徑時，須重新跑來源隔離、兩回合 undeclared-tool guard 與 management carry 測試。原 `tools/upstream_baseline.json` 所有水位保持不動；完整 stable 整合仍由 ROADMAP 追蹤。

## 2026-11-05：全版 tag diff 重放 `v2.93.0..v2.97.0` 的安全邊界逐檔判定

判準依維護者政策：上游做法合法可用就採用，只從技術適配、Windows 適用性與安全回歸判斷。逐檔清冊與計數見 [`UPSTREAM.md`](UPSTREAM.md) 同日節與
[`upstream-v2.93.0-v2.97.0-files.tsv`](upstream-v2.93.0-v2.97.0-files.tsv)。下列是 fork 先前加固過、與上游改動同檔的安全邊界檔案。

| 檔案 | 判定 | 理由與回歸證據 |
| --- | --- | --- |
| `src/config/atomic-write.ts` | 採用上游整檔 | 上游版包含 `c7f3928a2` 的 ACL timeout 復原（五個 harden 呼叫 opt in、目的地暫存追蹤）與後續的 exclusive publication／stable-identity 檢查；fork 2026-11-05 的適配版是其子集，沒有獨有行為。`requireStableIdentity` 只在 exclusive recovery copy 要求非零 dev／ino，一般存檔仍可在回報零 identity 的檔案系統上運作。回歸：`tests/windows/windows-atomic-write-acl-rearm.test.ts`、`tests/server/config.test.ts`（待逐檔跑完，見 `UPSTREAM.md` 尚未完成）。 |
| 檔案 identity 叢集（`native-residue`、`native-main-lock-file`、`native-profile-manager`、`shim-fingerprint`、`shim-inspect`、`shim-restore-lock`、`shim.ts`、`transition-state`、`codex-home-owner`、`workspace-executor`、`droid-settings`、`coordinator-doctor`、`orca-auth-source`、`state-lock`、`oauth/store`、`proxy-auth`、`config/initialize`、`spend-pool-alias-validation`、`cli-install-provenance`、`transactional-install`） | 採用上游整檔 | fork 先前的差異全是把 `lstat/fstat/stat` 換成自建 `*FileIdentity` helper（identity-only，逐檔以 fork-vs-`v2.93.0` 差異行過濾確認）；上游版直接以 `{ bigint: true }` 加 `sameFileIdentity` 達成相同的「不把 64 位 file ID 降成 Number」保證，並由 `tests/lib/file-identity-callers.test.ts` 對具名函式做詞法檢查。`native-residue` 改回單次 bigint stat 後，「相鄰大 file ID」案例由 `clean`（漏判）轉為 `indeterminate`（正確）。 |
| `src/codex/history-provider.ts` | 保留 fork 加固＋套用上游 | fork 在 `openSync` 以錯誤碼判斷缺檔（原本是 `existsSync` 後再開，兩次解析名稱）與 manifest 以描述元讀取，上游 `v2.97.0` 沒有；上游改動是 identity 寫法與 `withWriteGuard`。兩者不衝突，故以 fork 檔為底，手工套上游 `withWriteGuard` 與三個 bigint scope。回歸：`file-identity-callers`（29 案）、fork 獨有的「manifest 被他處持有時維持可重試」案例保留。 |
| `src/lib/bounded-file-read.ts`、`src/codex/shim-state-file.ts` | 保留 fork 版 | 上游改動只是 `sameIdentity` → `sameFileIdentity` 與 `statTimeMs`；fork 的 `readBoundedRegularFile` 家族有約 20 個 caller，上游版沒有這組 API。語意等價，不替換。 |
| `src/lib/file-identity.ts` | 保留 fork 超集 | 上游 20 行只有 `FileIdentity`、`statTimeMs`、`sameFileIdentity`、`fileIdentityKey`；fork 版全部包含且簽名相容，另有持久化格式用的 `storedFileIdentity`／`validStoredFileIdentity`／`sameFileInode`。 |
| `src/update/index.ts`、`src/update/job.ts`、`bin/ocx.mjs` | 保留 fork 更新封鎖 | `forkSelfUpdateBlocked()`、`FORK_RELEASES_URL` 逐 hunk 保留；上游新增的 `orchestratedUpdate` 條件併入 `ocx.mjs` 的 `update` 分支。**orchestrated 更新路徑是否在所有進入點都被封鎖尚未逐路徑驗證**，列為尚未完成。 |
| `.github/workflows/ci.yml`、`deploy-docs.yml`、`cleanup-orphaned-workflows.yml` | 採用（Windows-only 結構保留） | 官方 repo guard 與 `REMOVED_CI_JOBS` 不變；`fork-hygiene` 39 案通過。 |
| `src/bridge/errors.ts`、`src/server/responses/compact.ts`、`src/codex/catalog/provider-models.ts` | 上游＋fork 加固並存 | fork 的 stack frame 擦除、routing-policy 404 對映與 log 注入擦除（`sanitizeLogMetadataString`）上游沒有，保留；上游的配額來源溯源、`resolveConnectTimeoutMs`、`projectAdmissionModelDeniedLog` 一併採用。 |
| 韓文介面字串（`src/cli/claude-desktop.ts`、`src/types/config.ts`、`scripts/client-support-matrix/locales.ts`） | 取上游邏輯、字串維持英文 | `fork-hygiene` 的 Hangul 檢查要求 `src/`、`scripts/` 無韓文。 |


## 2026-11-06：v2.97.0 整合驗收與水位推進

**決定一（推進水位）**：`tools/upstream_baseline.json` 的 `integrated_tag` 由 `v2.93.0` 推到 `v2.97.0`，`integrated_through`／`reviewed_through` 為 `cab7eb7d0332ae0ebb4289d7c6bac1de666b6e40`，`reviewed_date` 為 2026-11-06。理由：`v2.93.0..v2.97.0` 全版 tag diff（1980 檔）已逐檔判定（`docs/fork/upstream-v2.93.0-v2.97.0-files.tsv`；`docs/fork/UPSTREAM.md` 的「CI 後續修正」表補記重放後被修正的檔案），分支 `ci/tagdiff-v2.97.0` 在 Windows 的全量 CI run 42063145190 全綠，`88aaa754..cab7eb7d0` 的 254 筆 commit 全落在這份 diff 內，所以連續前綴的條件成立。PR 水位與 17 筆 `reviewed_pr_numbers` 不動。

**決定二（`#8181` 適用但延後）**：desktop takeover 在預設 bind 時，`runtime-port.json` 缺 `hostname`，`tracked-runtime-inspection.ts` 讀成空字串、liveness 讀成 `127.0.0.1`，`stop-approval.ts` 比對永遠回 `approvalChanged`。fork 有同一份程式，Windows 同樣受影響（回報者在 macOS，但根因與平台無關）。這是 stop 授權比對的安全邊界，上游尚未提出修正，因此不自行放寬比對；`reviewed_issue_through` 推到 8181，延後項與觸發條件寫在 `ROADMAP.md` 中期列。

**未處理的限制**：MSIX 虛擬化終端下 `codex-native-residue` 的 3 個案例回 `unavailable`（環境限制），需在非虛擬化 Windows 終端複驗，記在 `ROADMAP.md`。

## 2026-11-07：commit 軸前 49 筆（審查止於 `7b514759e`）與 5 筆 platform issue 的審查；`reviewed_through` 維持 `cab7eb7d0`，`reviewed_issue_through` 推到 8281，`#8181` 由 `250ef01` 修掉

逐筆證據在 `docs/fork/UPSTREAM.md` 同日節。決定：

**決定一（水位）**：`reviewed_issue_through` 8181 到 8281（5 筆 platform issue 全數分類）。`reviewed_through` **不動**，維持 `cab7eb7d0`。理由是工具語意，不是審查不足：上游把 dev 歷史以「ours merge」併回 main（`36aa9e8f7` 的第一父是 `cab7eb7d0`，第二父 `247ad32cb` 才帶入 dev 線），所以 `cab7eb7d0` 之後的 56 筆全在 dev 線上；`tools/check-upstream-updates.ts` 用 `reviewed_through..upstream/main`，把 `reviewed_through` 設成 dev 線中途的 `ebeb1dc8a`（當時的審查終點）實測會讓待審數從 56 變成 205（把 `cf762b1` 起所有 main 線的舊 release merge 又列回來）。因此前 49 筆（止於 `7b514759e`）的判定只記在 `docs/fork/UPSTREAM.md` 同日節，水位要等整合 `v2.98.0`（`reviewed_through` 直接跳到 `36aa9e8f7`）或讓檢查工具同時排除 `integrated_through` 才能前進。`integrated_*` 與 PR 水位不動。前 49 筆內有 8 筆以「延後」結案（Messages 錯誤正規化叢集 `895a859`、`0a30c55`、`8d7d48d`、`0d2de73`、`7757a2f`，GUI design system v2 `aec37c1`，Cargo 相依 `b7e01c1`，Rust 診斷測試 `a98a6bf`），每筆都有重審條件，一律併入「整合 `v2.98.0`」那一列；前綴之後還有 7 筆未審（`6b3044f` 起；其中 `6b3044f`、`2c8b397` 與 `47f9e2d` 的 fixture 已提前採用）。

**決定二（`v2.98.0` 觸發成立）**：上游 `main` 與 stable `v2.98.0` 同為 `36aa9e8f7`，`ROADMAP.md` 的整合觸發條件已成立。這輪沒有做整版 tag diff，原因是 commit 軸逐筆審查先釐清哪些叢集與 fork 的刻意差異衝突（尤其 `src/server/claude-messages.ts:964-966` 的固定 404 訊息、`Cargo.lock` 的 `zip` feature），整版重放時直接帶著這份清單。

**決定三（`#8181`）**：fork 缺陷成立，上游已由 `250ef01`（#8221）修正：舊 runtime 記錄缺 hostname 時，只在其餘核准與擁有權檢查一致時接受預設 loopback，記錄含 hostname 則必須完全相符；pid／port／attestation 比對沒有放寬。已採用並先紅（8 案）後綠，`ROADMAP.md` 中期 `#8181` 列刪除。

**決定四（不採 hosted-Windows quarantine）**：上游 `47f9e2d`／`#8262` 用 `GITHUB_ACTIONS` 條件在 hosted Windows 跳過五組測試。fork 不遮蔽紅燈，只提前採用 `client-link-connect.test.ts` 的 fixture 修正（改用模擬 home，這個案例原本就是在 Windows 上模擬 Linux systemd 檢查，與產品行為無關）；`main-quota-provenance` 維持 `ROADMAP.md` 既有的重審條件。

**決定五（提前採用的相依）**：`8f43924`、`2c8b397`、`92e8f87`（`c43a86b` 新測試在 Windows 的 `/bin/sh`、原生 home 修正）、`5001aa5`、`63ff32a`、`7ea41c3`（`af3f8f8` 的鎖檔、首次註冊 `SQLITE_BUSY`、symlink 權限情境）、`6b3044f`（`b4cc5e8` 的 update import 政策）。沒有它們，被採用 commit 的新測試在 Windows 上先天紅。

**決定六（#8246 延後）**：「MSI 成功但舊 runtime 繼續服務」在 fork 成立，上游尚無修正，不在沒有上游設計時自改 MSI 流程。觸發條件寫在 UPSTREAM.md 同日節。

**本機環境限制（不是產品缺陷，也沒有放寬任何斷言）**：(1) 此帳號沒有建立 symlink 的權限，`client-link-connect` 的 symlink 案例原本回 `EPERM`，現依本 repo 的能力探測慣例（2026-11-03 條目，只在 win32 且 `EPERM` 時 skip，hardlink 案例照跑）skip；(2) 主機負載高時預設 5 秒的 `cli-sync-expect-link`、`client-link-connect`、`oauth-store-multi` 的 manifest 填滿案例逾時，`--timeout 120000` 下全過；(3) `tests/codex-integration/doctor.test.ts` 的 7 個端到端案例在未修改的 HEAD 版本同樣 5 秒逾時（已用 HEAD 版的 `doctor.ts` 與測試對照），不是本輪引入。(4) `bun run structure:check` 與 `tests/ci-workflows/structure-ssot.test.ts` 以 `git ls-files` 判斷檔案存在，新檔案未暫存時會誤報「this tree does not have」；提交者暫存新檔案後才會綠，本輪用暫存索引驗證通過。

**決定七（`ebeb1dc` 的 fork 差異：bigint 檔案身分）**：上游 `src/client/orphan-token-recovery.ts` 用 Number 的 `lstatSync`／`fstatSync` 比 `dev`／`ino`，會在 NTFS 大 file ID 上失去精度，違反 `86b72a689` 起的精確身分規則（見 2026-11-03 條目）。fork 版改用 `src/lib/file-identity.ts` 的 `lstatFileIdentity`／`fstatFileIdentity` 與 `sameFileIdentity`，`nlink`、`size` 維持 Number；`OpenSource`／`Sources` 的 `dev`／`ino` 改 `bigint`。`tests/lib/file-identity-callers.test.ts` 的 scopes 加入 `openSource`、`readSources`、`verifyPinnedFile`、`releasePins`、`moveToPrivateBackup`，tripwire 也改為把這三個 helper 視為合格的 bigint 觀察（並保留對同函式內數值 `lstatSync` 的拒絕）。先紅（上游版本在該 scope 回 `numeric stat`）後綠。下次重放 `v2.98.0` 時此檔不得整檔取上游。

**決定八（`7b51475` 部分採用）**：採用 `src/`、`tests/`、`structure/runtime.md`、remote-link 文件與 en／zh-TW 字串；GUI 接線（`App.tsx`、`api-targets.ts`、`connect-pairing*.tsx`、`gui/tests/*`）不採，因 fork 的 `connect-pairing.tsx` 與上游前態不同、需與 `v2.98.0` 重放一起合；在那之前 `connection.clientStateChanged` 沒有 GUI 使用者（無害的未用字串）。修的是：中斷的 Windows 復原留下與原 token 硬連結的 `.<name>.identity`，之後每次復原都因 `nlink > 1` 被拒且訊息不明；現在 `releasePins()` 在失敗路徑釋放、拒絕訊息具名。

**決定九（`client-link-connect`「link disconnect restores the prior catalog」不是移植造成的）**：在 `git archive fa81b4d4f` 的乾淨基底（`node_modules` 以 junction 共用）與移植後的工作樹各以 `bun test --timeout 120000 tests/clients/client-link-connect.test.ts -t "link disconnect restores the prior catalog"` 跑 3 次：基底 1 pass、2 fail，移植後 1 pass、2 fail，失敗訊息相同（`Config mutation already in progress`，接著 `EBUSY … rm ocx-client-link-contract-*`）。判定為既有不穩（單案約 12 秒，遠高於其他案例），移植 `af3f8f8`／`ebeb1dc`／`7ea41c3` 沒有改變失敗率。同檔整檔執行時，其後的「cancellation during catalog download …」與「a new link enrollment succeeds after explicitly preserving the orphan token」偶爾跟著失敗，錯誤同為 `Config mutation already in progress`／`EBUSY`（上一案留下的鎖與暫存樹連鎖），兩案單獨跑皆 1 pass。追蹤在 `ROADMAP.md` 中期「釐清只在合併程序失敗的測試」。

**決定十（追蹤）**：`#8246` MSI 舊 runtime 與只在合併程序失敗的測試各有 `ROADMAP.md` 中期列，不再只記在 UPSTREAM／REVIEW。

## 2026-11-08：重放上游 stable `v2.98.0`（`36aa9e8f7`）的內容，8 筆延後項收掉；水位待遠端 Windows 全量 CI 後再推

逐檔清冊在 `docs/fork/upstream-v2.97.0-v2.98.0-files.tsv`（`/docs/` 被 `.gitignore` 擋，要 `git add -f`），逐項證據與計數在 `docs/fork/UPSTREAM.md` 同日節。方法同 2026-11-05 的 `v2.93.0..v2.97.0`：`git diff refs/upstream-tags/v2.97.0 refs/upstream-tags/v2.98.0`（868 檔）以單一 parent、不 merge 上游的 tag-diff 法重放，先套 Windows-only 刪除清單與已刪語系，再依 blob 比對分類。

**決定一（水位暫不推進，與 v2.97.0 整合同樣分兩個 commit）**：這個 commit 只重放 `v2.97.0..v2.98.0` 的內容與版號（`package.json`、`desktop/src-tauri/Cargo.toml`、`Cargo.lock`、`tauri.conf.json` 為 2.98.0），`tools/upstream_baseline.json` 維持 `integrated_tag = v2.97.0`、`integrated_through`／`reviewed_through = cab7eb7d0332ae0ebb4289d7c6bac1de666b6e40`、`reviewed_date = 2026-11-06`，所以 `--strict` 仍回報 56 筆 commit（exit 1）。理由：2026-11-06 的 `v2.97.0` 整合是先在分支跑完 Windows 全量 CI 才推水位；這次本機驗證不完整（結果與未跑完的群組見 `REVIEW.md` 2026-11-08 節），遠端 Windows 全量 CI 要 push 後才有。**推進條件**（後續單獨 commit）：`Cross-platform CI` 的 Windows shard（決定十二再補記後為 12 個）與 aggregate `ci` 全 success，且本節決定九的重審條件（`client-link-stop` 與 `codex-cli-windows-plan` 的 8.3 案）已查清；推進內容為 `integrated_tag = v2.98.0`、`integrated_through`／`reviewed_through = 36aa9e8f7933807dc2c873bb93051c7c9c00f4e6`、`reviewed_date` 為當天。屆時 `reviewed_through` 可直接跳到 `36aa9e8f7`，因為 `cab7eb7d0..36aa9e8f7` 的 56 筆 commit 全落在這份 tag diff 內：前 49 筆在 2026-11-07 逐筆判定、其餘 7 筆（`6b3044f`、`2c8b397`、`fc60746`、`a589903`、`47f9e2d`、`247ad32`、`36aa9e8`）在這輪判定（見 UPSTREAM.md），這也解掉 2026-11-07 決定一記的「檢查工具把 dev 線中途當水位會讓待審數變 205」限制。PR 水位與 `reviewed_pr_numbers` 不動，`reviewed_issue_through` 維持 8281。

**決定二（Messages 錯誤正規化叢集整叢採用，保留 fork 的固定 404 文字）**：`895a859`、`0a30c55`、`8d7d48d`、`0d2de73`、`7757a2f` 在 tag diff 內是同一批檔案（`src/lib/messages-error-body.ts`、`messages-sse-error-presentation.ts`、`src/server/messages-sse-error-filter.ts`、`src/claude/failure-verdict.ts`、33＋24 個新測試檔與 fixtures），一次取上游，單挑會留下半套的疑慮不再成立。唯一與 fork 的刻意差異是 `src/server/claude-messages.ts` 的 `NoEligiblePolicyCandidateError` 分支：上游 `anthropicErrorBody(404, err.message, …)` 的 `err.message` 是 `No eligible candidates for policy profile: <profileId>`，會把 policy profile id 帶給用戶端，違反 `routing-policy-surface-parity` 的「不含 profile id」斷言。fork 版保留固定句 `no eligible candidates for routing policy`，但走上游新的 `ownedAnthropicErrorResponse`／`messagesRelayedOverflowPresentation` 路徑，所以回應仍帶正規化後的形狀。Chat Completions 那條（`chat-error-body-normalization` 釘住上游文字）維持 2026-11-06 的處理，不動。

**決定三（`aec37c1` GUI design system v2 採用，語系收斂為 en／zh-TW）**：450 個檔案逐檔依 blob 分類（`clean` 直接取、`new` 新增、`merge` 3-way），沒有逐檔手改。與 fork 語系政策的衝突只有兩處：(1) `gui/src/i18n/shell-v2-copy.ts` 與 `gui/src/i18n/v2-pages/*-copy.ts` 是 11 欄（en、ko、de、fr、zh、zh-TW、ru、ja、tr、vi、pt）的列表，保留 en 與 zh-TW 兩欄並把 `Locale`／`Row`／`locales` 型別收成兩欄（機器轉換、再由 `tsc -b` 擋遺漏，無 Hangul）；(2) 4 處註解範例含 Hangul（`usage-activity.tsx`、`base.css`、`bridge.css`），改成不含韓文的範例，`fork-hygiene` 的 Hangul 檢查才會過。另 `usage-companion-sections.tsx` 的安裝連結指向上游 releases，改為 `SanHsien/opencodex` releases（`fork-hygiene` 的「不連上游 releases」）。`gui/tests/i18n-language-switch.test.tsx` 的法語案例與 `gui/tests/fr-localization.test.ts` 依既有已刪語系政策不採。`gui` 的 `bun run build`（`tsc -b`、主版與 `classic` 兩個 vite 建置）成功。

**決定四（Rust／Cargo 兩筆延後項改為採用，因為驗證得到了）**：2026-11-07 記「本機沒有 `cargo`」不成立：`%USERPROFILE%\.cargo\bin` 有 `cargo`／`rustc`（1.95.0、1.98.1 工具鏈），只是不在 PATH。`b7e01c1`：`desktop/src-tauri/Cargo.toml`／`Cargo.lock` 整份取上游（`tauri` 2.12.5、`tauri-plugin-updater` 2.14.1、`rust-version` 1.90），`cargo metadata --locked` 與 `cargo check --lib --locked`（以 `TAURI_CONFIG` 清空 `externalBin`／`resources` 避開需先建的 sidecar）都 exit 0。這同時取代 fork 2026-10-31 的 `default-features = false`（關 `zip` feature 避開 GHSA-m665-v7pm-7grj 等三則）：新鎖檔的 `zip` 是 9.1.3，高於修正版 9.0.5，所以不再需要關 feature，`cargo tree -i zip` 只剩 updater 一條路徑。fork 的 updater 仍關閉（`tauri.conf.json` 的 `createUpdaterArtifacts=false`、`endpoints` 空），此決定只影響相依。`a98a6bf`：`scripts/diagnostics/windows-version-control` 的 `cargo test --locked` 16 個案例全過。Dependabot 對 Cargo 的告警仍由維護者逐筆確認（`ROADMAP.md` 中期「處理新出現的安全告警」）。

**決定五（不採 hosted-Windows quarantine；不跳過就必須綠，所以逐組找根因）**：`47f9e2d` 的 `tests/helpers/windows-ci-quarantine.ts` 不加；tag diff 帶進 5 個檔案的 `hostedWindowsQuarantine` 使用點一律還原為不跳過（`grep -r hostedWindowsQuarantine tests` 為空）。不跳過的前提是這些測試在 fork 側要能過，不能把已知紅燈的測試放進 commit（核心規則 11），所以上游曾隔離的每一組都判定（逐組結果見決定九）。

**決定六（fork 版測試修正被上游重寫取代者，改採上游）**：`fc60746`（#8228）把 `codex-cli-windows-plan.test.ts` 的 unsafe-ledger 案例搬進 `tests/helpers/windows-cli-plan-unsafe-case.ts` 子行程並自帶 `isPaired` 配對，取代 fork 2026-11-06 在該檔補的 `sessionControl: { isPaired: () => true }`；上游同批重寫 `codex-profile-preservation.test.ts`（子行程自有 home、`assertNotRealCodexHomeUnderTest`），取代 fork 的 `protectedCodexHomeForTests()` 守衛。兩檔整檔取上游，fork 的安全意圖（不碰真實 Codex home、需配對 session）由上游版本涵蓋。`a589903` 的 `realpathSync.native` 與 fork 2026-11-06 的修正逐字相同。

**決定七（fork 專屬保留）**：`src/client/orphan-token-recovery.ts` 維持 bigint 檔案身分（2026-11-07 決定七），上游這檔自 `7b51475` 起未再動，不取上游。`.github/workflows/ci.yml`、`tests/ci-workflows/ci-workflows.test.ts`、`ci-review-lanes.test.ts` 的 Ubuntu 五片 `test` job 與其斷言不重放（`553a621` 的重整也不適用）。`tests/clients/client-link-connect.test.ts` 保留 fork 的 symlink 能力探測。`structure/runtime.md` 保留 fork 的 file-identity 與 journal mtime 句子並套上游新句；`scripts/ci/test-durations.tsv` 與 `tests/fixtures/test-layout-expected.json` 為上游版剔除 fork 沒有的測試、補回 fork 條目。

**決定八（native Messages web-search 可用性探測：已存在，不適用）**：`ROADMAP.md` 舊列寫「fork 沒有該探測」不成立，`007dbfd89` 的 `CodexInstallationIdUnavailableError → nativeSelector.webSearchBackendAvailable = false` 已隨 `v2.97.0` 重放進 `src/server/claude-messages.ts`（v2.97.0 與 `v2.98.0` 都有，現行檔 :1086-1094），沒有缺口，該列刪除。

**決定九（上游 #8262 隔離過的六組：逐組根因與處置）**：
1. **Messages overflow 矩陣（`tests/helpers/messages-overflow-assertions.ts`，lane `native-http`／`native-fold`／`native-fold-builtin`／`translated-fold`／`translated-http`／`translated-json`）— (a) fork 側修**。根因：每個 test 起一個子行程跑 64 列，Windows 上每列約 0.5 秒（直接執行 `bun tests/helpers/messages-overflow-differential.ts head … translated-fold <offset> 64`，兩個切片各 33 秒、exit 0），超過上游寫死的 `30000` 毫秒 test timeout，被殺成 `Head slice exited 143`；不是掛住，是預算不符。修法：timeout 改用 `COLD_SPAWN_BUDGET_MS`（win32 為 90 秒，repo 既有的 Windows 子行程預算），切片大小與斷言不變。紅：未修版本在本機 12 個切片 30000ms 逾時；綠：見 `REVIEW.md` 2026-11-08 節的取樣切片。
2. **`messages-sse-continuation`「split error delimiter resumes ping and EOF」— (a) fork 側修**。根因：2500 毫秒 deadline 量的是「之後的 ping 與 EOF 送達」，但計時從第一個 Bun 子行程啟動開始，第一個案例吃到冷啟動（單獨跑 7 pass／1 fail，失敗案例 2537ms）。修法：`beforeAll` 先用 `COLD_SPAWN_BUDGET_MS` 跑一次拋棄式子行程，量測案例仍用 2500 毫秒。紅：7 pass／1 fail；綠：8 pass／0 fail。
3. **`client-link-stop`「a separate sync … signal restoration (catalog)」（:250）— (b) 不採 skip，維持原樣，重審條件寫明**。本機該檔 15 案失敗（`Link Child Codex routing restore refused`），在 `git archive a13d292e9` 的未改動基底以相同名單同樣 15 案失敗，所以不是這次整合引入，也不是 8.3 短名問題（`realpathSync.native` 已與上游相同）。fork 的 `v2.97.0` 整合在 Windows 全量 CI（run 42063145190）綠，所以這是這台主機的環境因素。重審條件：遠端 Windows CI 該檔仍紅，或在乾淨主機本機也紅，就當真實缺陷查 restore 失敗原因，不加 skip。
4. **`desktop-compatibility-build-probe`— 不需處置**。本機通過，沒有跳過它的理由。
5. **`codex-cli-windows-plan`— 不需處置（一案為既有失敗）**。被隔離的「unsafe Windows ledger」與「npm toolchain drift」案本機通過；同檔「native 8.3 spellings cannot promote version-manager ownership or query metadata」失敗，在未改動基底同樣失敗（這台磁碟區可能未啟用 8.3 短名），列為既有環境項，與 `client-link-stop` 同一重審條件。
6. **`main-quota-provenance`— 不需處置**。本機通過；`ROADMAP.md` 中期既有的重審條件不變。

**決定十（`tests/service/service-status-json.test.ts:460` 既有失敗）**：「the real CLI leaves every isolated home byte-for-byte unchanged」會看到本機真實的 schtasks 項目（`opencodex-proxy`）。在 `git archive a13d292e9` 的未改動基底與整合後的樹各跑一次，結果相同（17 pass／1 fail，同一案例），所以是這台主機有安裝 OpenCodex 服務造成，不是這次引入；在沒有該排程工作的主機（CI）不會觸發。

**決定十一（Messages 的 no-eligible 404：固定句要寫在實際輸出的欄位，overflow 判定仍讀上游訊息）— (a) fork 側修**。遠端 Windows 全量 CI（run 42403141711，`ci/tagdiff-v2.98.0` 的 `ca6480ed6`）兩處紅燈同一根因：決定二把固定句 `no eligible candidates for routing policy` 只寫進被攜帶的 `legacy` 內部證據，但 `ownedAnthropicErrorResponse` 輸出的是 `localError.message`（仍是上游的 `No eligible candidates for policy profile`），而 overflow 布林又改讀 fixed 版 `legacy`，於是 (1) `routing-policy-surface-parity`「no-eligible policies retain their trace but not their profile id on every wire」（shard 10/11）在 Messages 路徑收到上游句而不是固定句；(2) `messages-overflow-collectors`「local-envelope: origin/dev rows 1-63」（shard 4/11）的 `sweep-local-policy-empty-phrase` 一列，profile id 即是 `prompt is too long …`，上游由 `err.message` 判為 overflow（`clientRecognizes` true，輸出常數句），fork 讀固定句後變 false。兩案在本機也會紅（不是 Windows 專屬，也不是 flaky）。修法：`localError.message` 改為固定句，`overflow` 仍由 `anthropicErrorBody(404, err.message, …)` 判定，所以線上輸出不含 profile id，且與上游基線的辨識結果一致；`legacy` 維持固定句。紅：surface-parity 一案 fail（`Received: "No eligible candidates for policy profile"`）、`local-envelope` rows 1-63 fail（`Expected: true / Received: false`）；綠：兩者見 `REVIEW.md` 2026-11-08 節「CI 後續修正」。沒有放寬任何斷言。第二輪 CI（run 42412302217）shard 10 又紅一案：`messages-error-contracts`「W1/W3 envelope writers are covered by explicit dispositions」，因為修法讓 `src/server/claude-messages.ts` 多了一行 `anthropicErrorBody(` 呼叫（30 → 31），這張表逐檔計數是刻意的寫入點清冊；該列改為 31 並在說明欄寫明新增的是 no-eligible 404 的 overflow 判定，不是放寬計數方式。教訓：改到 `src/` 下的錯誤 envelope 呼叫，要跑 `messages-error-contracts`，不能只跑 focused 的兩個檔。

**決定十二（Windows shard 權重表補上 v2.98.0 新檔；2/11 與 11/11 是 30 分鐘 job 上限，不是掛住）— (d) CI 容量／權重過期，非測試缺陷**。run 42403141711 的 `windows 2/11`、`windows 11/11` 為 cancelled，`windows 3/11` 在 30:00 邊緣才成功；三者的最後一行都是正常輸出的測試（`quota-pool-relay`、`update-npm-timeout`），隨後 `##[error]The operation was canceled.`，也就是 `timeout-minutes: 30` 的取消，沒有失敗案例。根因：`scripts/ci/test-durations.windows.tsv` 沒有 v2.98.0 新增的 75 個檔案，runner 對沒有紀錄的檔案一律當中位數 416ms，但這 75 檔在該 run 實測合計 1794 秒（`messages-overflow-native` 421 秒、`-builtin` 392、`-translated` 359、`-verdicts` 234，上游自己的表是 21／19／21／13 秒，Windows 約 19 倍）。它們被當成輕檔，集中在 shard 2、3、11。重現：以 fake `bun` 在本機跑 runner（`RUNNER_OS=Windows`、批次 6、舊表），分批數 53／47／46／49／47／46／53／51／49／53／49 與該 run 的 `batch N/M` 逐片相同，最重一批 474 秒與 CI shard 2 batch 9 的 474.13 秒吻合；以新量測成本計舊分配的每片負載為 1064／1759／1652／1336／1299／1364／1110／1386／936／1296／1718 秒（shard 2、3、11 > 1650 秒，加 setup 約 2.4 分鐘就碰到 30 分鐘），新表分配每片 1356 秒、最重一批 421 秒。修法：用 `scripts/ci/test-durations.ts refresh --table scripts/ci/test-durations.windows.tsv` 吃該 run 的 11 份 job log（2601 檔實測；shard 4、10 因失敗提早停止、shard 2、11 被取消，只計跑完的檔案，其餘列保留）。仍有 9 檔沒有紀錄、其餘列保留舊值，下一輪完整 run 再刷新。

**決定十二補記（第二、三輪 CI）**：run 42412302217（`b34464034`）除 shard 10 的 envelope 計數（決定十一）外全綠，11 份 job 全部在 17.5–27 分鐘內完成；run 42415040854（`689c2d11f`）shard 4 在 batch 39/47、測試已跑 28.2 分鐘時被 30 分鐘 job 上限取消，沒有失敗案例，同一個 shard 在前一輪 25 分鐘完成。各片預測負載一致（1356 秒），實際 17–28 分鐘，表示單輪變異約 ±3 分鐘，貼著上限。本輪把兩個 run 的 22 份 job log（shard 4、10 只計跑完的檔案）一起餵給 `refresh`，每檔取兩個樣本的平均，降低單輪雜訊。**不改** `timeout-minutes: 30` 或 shard 數：`ci.yml` 註解與 `ci-workflows.test.ts` 把 30 分鐘上限釘為維護者決定，增片（11 → 12）或調上限屬容量決定，不在這次修復範圍；若下一輪仍因上限取消，那個決定要交給維護者。

**決定十二再補記（第四輪：規劃長決定增片，並修冷啟動預算）**：規劃長於 2026-11-08 決定 Windows shard 由 11 片增為 12 片，`timeout-minutes: 30` 維持不變。理由：片時 17–28 分鐘已貼著上限，增片比調高上限更容易改回來。`ci.yml`（job 名稱 `/12`、matrix、`TEST_SHARD`、aggregate `shards=12`）、`tests/ci-workflows/ci-workflows.test.ts` 的 matrix 釘子、`AGENTS.md` 與 `structure/ops/docs-and-release.md` 的片數一起改；權重表沿用上一輪 22 份 log 的平均，以 fake `bun` 在本機跑 runner（`RUNNER_OS=Windows`、批次 6）重新分片：12 片每片預測 1322 秒，同一張表的 11 片是 1442 秒，單片少約 8%。同一輪第三輪 run 42418480772 的 shard 10 失敗是 `tests/cli/cli-start-journal-order.test.ts`「startup preserves only a client journal matching the final committed api key id」：案例的 budget 寫死 30_000，低於它自己等待 child runtime record 的內部期限（`OWNER_WAIT_MS`，CI 上 Windows 為 45 秒），child 一慢就由 Bun 的逾時先砍，看不到自己的錯誤訊息；實證根因就是「30 秒案例預算 < 45 秒內部期限」。同檔在前兩輪的 shard 8 通過，其第一案曾有 52 秒的啟動。**不用** `COLD_SPAWN_BUDGET_MS`：該案例之前已有 6 個 `#7827` 案例 spawn 過 Bun child，不是這個檔的第一個 child，而 `tests/helpers/test-budget.ts` 規定冷啟動預算只給檔案第一個 child 的 readiness 等待用一次。修法：等待維持 `OWNER_WAIT_MS`，案例預算改為 `3 * OWNER_WAIT_MS`（兩個循序 child 的等待各一份，再加一份給三個本機 HTTP 請求、SIGTERM 退出與兩輪 fixture 清理），本機（非 CI）仍是 30 秒；所有斷言原樣保留。**不加 committed 測試的理由**：「Windows 表須涵蓋重檔」這個性質在每次上游整合時，替換共用表的 commit 會先紅、而補列的唯一正規方式（吃 CI log）要等 push 後才有，會變成無解的順序陷阱；預測負載平均本來就由表建構而成，檢查它沒有訊號。證據改為上述可重跑的 runner 模擬。**殘留風險**：`messages-overflow-native` 單檔 421 秒，佔單批 480 秒上限的 88%，上游沒有把它拆檔；若下一輪該批逾時，優先把 `BUN_TEST_BATCH_TIMEOUT_SECONDS` 或該檔切片數調整記成新的決定，不要放寬斷言。

**未處理的限制**：(1) 遠端 Windows 全量 CI：首輪 run 42403141711 為紅，決定十一與十二修正後，run 42424520793（`7de8aac44`）12 個 Windows shard 與 aggregate `ci` 全 success，水位已推進（見下節）；(2) 夜間 shard 的 `main-quota-provenance`、`cli-start-owner-absence` 兩條觀察列不變；(3) `#8246`（MSI 升級後舊 runtime）上游仍未修，維持中期列。

## 2026-11-08（續）：v2.98.0 整合驗收與水位推進

**決定（推進水位）**：`tools/upstream_baseline.json` 的 `integrated_tag` 由 `v2.97.0` 推到 `v2.98.0`，`integrated_through`／`reviewed_through` 為 `36aa9e8f7933807dc2c873bb93051c7c9c00f4e6`，`reviewed_date` 為 2026-11-08。理由：決定一寫的推進條件成立。`v2.97.0..v2.98.0` 全版 tag diff（868 檔）已逐檔判定（`docs/fork/upstream-v2.97.0-v2.98.0-files.tsv`），分支 `ci/tagdiff-v2.98.0` 在 `7de8aac44` 的 `Cross-platform CI` run 42424520793 的 12 個 Windows shard 與 aggregate `ci` 全 success（CodeQL、Fork maintenance、Catalog async contracts 同為 success），`cab7eb7d0..36aa9e8f7` 的 56 筆 commit 全落在這份 diff 內，連續前綴成立。到這個結果前的 run：42403141711（決定十一、十二的根因）、42412302217、42415040854、42418480772、42421667819 與 42424520793，每一輪的失敗與修法見決定十一、十二及其補記。PR 水位與 17 筆 `reviewed_pr_numbers` 不動，`reviewed_issue_through` 由 8281 推到 8320：水位推進後的 `--strict` 列出 #8317、#8318、#8320 三筆新 `platform` issue，已逐筆判定（#8317、#8318 適用但延後並登記 `ROADMAP.md` 中期列，#8320 macOS 專屬不適用），見 `UPSTREAM.md` 2026-11-08 的 issue 軸一節。決定一提到的決定九重審條件（`client-link-stop` 與 `codex-cli-windows-plan` 的 8.3 案）：這些案例在遠端 Windows 全量 CI 都過了，本機既有失敗的差異沒有另外查證，維持決定九的記載。

## 2026-11-08（續）：上游 PR（#7608、#7619、#8224、#8314、#8315）與 issue（#8336）分類；Windows 相關 issue 複查（#7771、#7808、#7810）

逐筆證據在 `docs/fork/UPSTREAM.md` 同日節。決定：

**決定一（PR 軸 5 筆全部不採用，加入 `reviewed_pr_numbers`）**：
- #7608（URL-citation 重放覆蓋文件／測試）：上游維護者已把它 carry 成 #7865（squash d67feddd7，在 v2.94.0 內），已由 #7865 併入、fork 隨 v2.94.0 整合取得；維持不另採。
- #7619（Windows CLI archive 驗證）：已被上游 #7648 consolidation 取代，不重複採用。
- #8224（GUI WorkBuddy 餘額）：上游維護者因 stale quota freshness 與 safe validation 未決而關閉；關聯 issue #8131 已在 2026-11-08 06:29Z 關閉（上游 #8323 於 06:28Z 合進 dev，比 v2.99.0 晚，會隨下一個 stable 進來）；跟隨上游關閉。
- #8314、#8315（2.99.0 發版 PR）：標記 `[WRONG BRANCH]` 投錯分支關閉，非產品程式碼變更（#8315 已由 #8322 取代）。
逐筆加入 `tools/upstream_baseline.json` 的 `reviewed_pr_numbers`（共 22 筆）。

**決定二（issue #8336 相關但延後，水位推至 8336）**：
- #8336 指出上游未合併 PR #8335 中 release contract 測試 harness 的 PATH 期望值構造問題。本 fork 走 `fork-release-windows.yml`，不執行上游 release 流程；待上游合併至日後 stable tag 後再隨整合處理。`reviewed_issue_through` 推進至 8336。

**決定三（Windows 相關 issue 複查）**：
- #7771 上游仍 open，本機無排程服務不重現，持續觀察。
- #7808、#7810 上游均已修復關閉（#7824、#7823、#7852），本 fork 均已包含其修正。

**決定四（ROADMAP 中期列維持）**：
- Upstream check 報告的 PR 與 issue 兩節已清空，中期的「分類 Upstream check 列出的新 PR／issue」屬反覆觸發項目維持保留，證據欄更新為這次的分類結果（5 筆未合併關閉 PR 與 1 筆 platform issue 已分類，PR 與 issue 兩節清空；commit 軸 28 筆待隨 v2.99.0 整合清空）。

## 2026-11-09：重放上游 stable `v2.99.0`（`667662903`）；上游已刪 `main`，追蹤目標改為 stable tag

逐檔清冊在 `docs/fork/upstream-v2.98.0-v2.99.0-files.tsv`（`/docs/` 被 `.gitignore` 擋，要 `git add -f`），計數、衝突取捨與整合前審查清單 7 條的結果在 `docs/fork/UPSTREAM.md` 同日（續）節。

**決定一（重放方式：tag diff、單一 parent，不 git merge；水位另一個 commit）**：「合上游 tag」在本 fork 的意思是 `git diff refs/upstream-tags/v2.98.0 refs/upstream-tags/v2.99.0`（410 檔）逐檔套到 `main`，不是 `git merge`。這不是偏好：`git merge-base HEAD refs/upstream-tags/v2.99.0` 輸出為空、exit 1，fork 與上游沒有共同祖先（2026-10-06 維護者確認的壓縮歷史），真的 merge 會把整棵樹當成雙方新增。做法與 2026-11-05、11-08 相同：fork 與 `v2.98.0` blob 相同取上游、fork 與 `v2.99.0` 相同略過、其餘 3-way，已刪語系與 Windows-only 刪除清單先套。分支 `ci/tagdiff-v2.99.0`，只推這條分支；`tools/upstream_baseline.json` 的 `integrated_tag`／`reviewed_through` 不在重放 commit 內推進，等 Windows 12 片 CI 全綠後另開 commit（決定一在 11-08 的同一套理由：先驗證、再宣稱）。

**決定二（追蹤目標：stable release tag，不追 `dev`）— (a) 改工具**。事實：2026-11-08 起上游沒有 `main`，遠端 HEAD 是 `dev`（`git ls-remote --symref` 實查），所以 `tools/check-upstream-updates.ts` 對 `+refs/heads/main` 的 fetch 會失敗，`Upstream check` 每週一都會變成「檢查失敗」而不是「有新東西」。可選的三條：

| 選項 | 實測 | 取捨 |
| --- | --- | --- |
| 改追 `dev`（`branch: "dev"`） | `dev` 頭 `4a22eda84998d4b64dbb2d3a7c478c48ce8bcc4a`；`git merge-base --is-ancestor refs/upstream-tags/v2.99.0 refs/upstream-check/dev` exit 1（發版是 ours-merge，tag 不在 `dev` 的祖先鏈上）；`reviewed_through = 667662903` 之後 `667662903..dev` 仍有 103 筆，`36aa9e8f7..dev` 為 129 筆 | `dev` 是 PR 整合線，含尚未發版的 commit。fork 只在 stable 時整合（`ROADMAP.md`「維護方式」：不跟 dev／preview），103 筆未發版 commit 會讓每週檢查永遠紅，被當成雜訊而忽略 |
| 維持 `main` | fetch 失敗 | 不可行 |
| 改追 stable tag | 新工具對真實上游實跑（`bun tools/check-upstream-updates.ts --strict`，水位尚在 `v2.98.0`）：「stable release tags above `v2.98.0`」、28 筆待審 commit，與整合前審查的 28 筆相同，exit 1 | 採用：`v2.98.0..v2.99.0` 的第一父鏈就是 `reviewed_through..tag`，且推進水位後（`integrated_tag = v2.99.0`）會回到「沒有新 commit」 |

實作（最小改動）：`upstream_baseline.json` 新增 `track` 欄位，`"stable-tags"` 時不再需要 `branch`，改要求 `integrated_tag` 是 `vX.Y.Z`；預設（沒有 `track`）維持原本的 `branch` 行為，所以舊基準檔仍可讀。`fetchUpstream` 在 stable-tags 模式抓 `+refs/tags/v*:refs/upstream-check/tags/v*`（不進本機 `refs/tags/`，避免上游 tag 混進 `release-version-line.test.ts` 讀的 tag 清單，`UPSTREAM.md`「上游 tag 放 `refs/upstream-tags/`」那節的同一個理由），以 `--prune` 抓取（只修剪 `refs/upstream-check/tags/` 這個命名空間，上游撤掉的 tag 不會殘留成「最新」；本機 `refs/tags` 不動），只認 `^v\d+\.\d+\.\d+$`，以數字排序（不是字典序：`v2.100.0` 要大於 `v2.99.0`），取比 `integrated_tag` 高的最高一個；`-preview.*` 不算。沒有更高的 stable tag 時比較範圍是 `reviewed_through..reviewed_through`（空），回報「沒有新 commit」；**抓完一個 stable tag 都找不到會拋錯**，不回報「沒有新東西」，因為那等於把壞掉的 fetch 當成健康（核心原則：查不到不等於沒有）。PR 與 issue 兩條軸（`gh`）不變。釘住的測試在 `tests/ci-workflows/fork-hygiene.test.ts`：數字排序與 pre-release 排除、基準檔驗證（stable-tags 缺 `integrated_tag` 或帶 pre-release tag 會拒絕、branch 模式缺 `branch` 會拒絕、不認得的 `track` 會拒絕）、以及一個沒有 `main`、釋出 commit 不在 `dev` 祖先鏈上的本機假上游（有較新 stable tag 時回正好那些 commit、整合到最新時回空、branch 模式仍可用、只有 pre-release tag 時拋錯、本機 `refs/tags` 不被污染）。

**決定三（Messages overflow 矩陣：採上游 16 列切片、不採隔離，timeout 預算維持 fork 的）**：`e838c30f2`（#8229）在 Windows 慢速 lane（`passthrough`、`count_tokens`、`native-http`、`native-fold`、`native-fold-builtin`、`translated-http`、`translated-fold`、`translated-json`）把切片由 64 列改 16 列，並新增 `messages-overflow-child.ts`／`messages-overflow-spawn-tracker.ts` 保證子行程清理。這與決定九第 1 點（64 列 × 約 0.5 秒 > 30 秒字面預算）是同一個問題，上游的修法比 fork 的預算更根本，所以採用。兩處不跟上游：(1) 該檔仍用上游的 `hostedWindowsQuarantine`（#8262）跳過慢速 lane，fork 不採隔離（決定五），匯入與 `test.skipIf` 一起移除；(2) 每個切片的 timeout 維持 `COLD_SPAWN_BUDGET_MS`（Windows 90 秒）而不是上游的 `30000`，16 列的預期時間約 8 秒，留著較寬的預算只是冷啟動緩衝，斷言沒有動。

**決定四（`docs/fork/UPSTREAM.md` 超過行數上限：把 2026-08-23 至 2026-10-03 的 909 行搬去歸檔）**：整合前審查那一版的 `UPSTREAM.md` 是 2123 行，`bun scripts/file-size-ratchet.ts` 回報 `NEW_OVERSIZED docs/fork/UPSTREAM.md 2123`（門檻 2000，Markdown 也在掃描範圍；`AGENTS.md` 明寫上限只能靠搬移、不能調數字）。搬移 909 行（`v2.34.0` 到 `v2.76.0` 之間的分組審查與 replay）到 `docs/fork/UPSTREAM-archive-2026-08-to-10.md`，逐字未改，原處留一節指向它。順便更正檔頭三處過時敘述：「追蹤分支：`main`」「下一次要做什麼」寫死的 2026-09-08 水位，以及兩處引用行號 `L1654`（搬移後行號會變，改成節名）。同一個 gate 還抓到 `tests/responses/responses-pool-401-refresh.test.ts` 合併後剛好 2000 行，見 `UPSTREAM.md` 衝突表。

**決定五（`#8252` 判定）**：Upstream check 的 PR 軸新列出一筆關閉未合併的 PR：[#8252](https://github.com/lidge-jun/opencodex/pull/8252) `fix(chat): convert Mistral typed content on native Chat passthrough`（Draft，2026-11-08 22:52Z 關閉，作者留言：被 #8278 取代，同一做法）。`#8278` 是整合前審查的第 17 筆 `05408a312`，在這次 tag diff 內（含 `tests/responses/chat-native-mistral-content.test.ts` 與 `src/server/chat-native*.ts`）。**不另採**，已由 `v2.99.0` 帶入。

**決定六（CI 兩個紅燈的根因與修法；`main` 本身的潛在紅燈）**：首輪 Windows 全量 CI（run 42627438708）只有兩處紅燈，都不是上游新碼的缺陷。(1) GUI 測試：上游新測試寫死十一個語系，fork 只有 en 與 zh-TW，是語系政策的老問題；迴圈縮成保留的語系，斷言本身不放寬。(2) `update-mutation-guard`：`595ee1e27`（2026-11-09，CodeQL #623 的 bigint identity 修正，在此次整合之前就在 `main`）改了 `src/update/orchestrated-live-identity.ts` 的 import，卻沒有更新 `tests/helpers/update-review-orchestrated-entry.ts` 的審查列，所以 `main` 在那個 commit 起就會在 `tests/update/update-mutation-guard.test.ts` 紅；沒被發現是因為 Windows 全量 CI 不在 push 上跑。**教訓**：改 `src/update/` 下檔案的 import 或 identity 呼叫，要跑 `update-mutation-guard`，focused 範圍不能只含 `file-identity-callers`。這一類「改 src 後忘了同步審查表」的缺口，以後在整合驗收前用整個 `tests/update` 做 fresh-process 跑一次當作檢查。

**決定七（Windows 權重表用兩個分支 run 重新量測）**：run 42631654245 全綠，但 12 片耗時 15.4–25.6 分鐘，最長一片只剩約 4.4 分鐘餘裕，原因是 v2.99.0 新增的 60 個測試檔沒有權重列、依 runner 慣例一律當中位數。用 `scripts/ci/test-durations.ts refresh --table scripts/ci/test-durations.windows.tsv` 吃兩個 run 各 12 份 Windows job log（共 24 份；首輪 shard 5 在 batch 40/43 停止，只計跑完的檔案），2948 個檔全部有量測值，沒有缺列。以本機貪婪分配模擬（最重檔先給負載最低的一片，12 片）每片預測負載 1248 秒；刷新後的 run 42637255094（`3357585fd`）全綠，12 片耗時 17.6 至 26.9 分鐘，最長一片 26.9 分鐘：**最長片沒有變短**（刷新前 25.6），單輪變異約 ±3 分鐘，餘裕仍只有約 3 分鐘。負載較平均（刷新前最短 15.4 分鐘、刷新後最短 17.6），但這個表只能壓平均、壓不掉單檔重量（`messages-overflow-native` 單檔約 290–420 秒）。若任何一片再被 30 分鐘上限取消，下一步是把 shard 增為 13 或調整 `BUN_TEST_BATCH_TIMEOUT_SECONDS`，記成新的決定，不放寬斷言（登記 `ROADMAP.md` 中期列）。`timeout-minutes: 30` 與 shard 數不動（決定十二再補記的立場）。

**決定八（水位推進）**：`tools/upstream_baseline.json` 的 `integrated_tag` 由 `v2.98.0` 推到 `v2.99.0`，`integrated_through`／`reviewed_through` 為 `667662903a6c139524506667d12656d9ad50fad0`，`reviewed_date` 為 2026-11-09；`reviewed_pr_numbers` 加入 8252；`reviewed_issue_through` 維持 8336（本次沒有新 `platform` issue）。理由：決定一寫的推進條件成立（12 個 Windows shard 與 aggregate `ci` 全 success，Fork maintenance、Catalog async contracts 同為 success），且整合前審查的 28 筆 commit 全落在 tag diff 內（連續前綴成立）。`bun tools/check-upstream-updates.ts --strict` 在推進後的結果見 `REVIEW.md` 2026-11-09 節。

## 2026-11-12：獨立覆核 `b94d6ac61..08927752d`（接管對話框修正）的五項修正

覆核找到的問題與修法如下；每項的測試與證據在本節末。

**決定一（殺行程與「可讀包裝檔」判定限定包裝宿主映像；M1，中）**：原本只比命令列上的包裝檔完整路徑 token，於是使用者用記事本開著 `opencodex-service.cmd`，`ocx service uninstall` 的殘留移除會強制結束記事本，`ocx resolve` 也會把它算成服務代管。修法：包裝檔只能由 wscript／cscript／cmd 執行，所以殺行程的 PowerShell 與 TypeScript 端的 `wrapperProcessesAlive`、`ancestorWrapperPids`、`isUnreadableWrapperCandidate` 都先要求映像名稱屬於 `WRAPPER_HOST_IMAGE_NAMES`（定義在 `src/lib/windows-service-wrappers.ts`，兩端共用同一份集合）。不採「列出 launcher」：launcher 的 `.vbs` 本來就由 wscript 執行，不需要另列。WinSW 的宿主 exe 不在 `wrapperPaths` 內，不受影響。`windows-ops.ts` 的註解與 `structure/ops/desktop-supervision.md` 同步改寫。

**決定二（包裝檔刪除失敗改為 typed failed 並命名檔案；L2，低）**：`uninstallWindows` 在工作排程已確定刪除後才 `unlinkSync` 包裝檔，鎖檔時會丟出未命名的例外。修法：新增 `WrapperFileRemovalError`（帶 `file`），`uninstallServiceDetailed` 的 present 分支只接住它，記下檔名後繼續移除原生服務，最後回 `failed` 並保留安裝狀態，與 residue 分支的形狀一致。其他錯誤（排程刪除失敗、schtasks 拒絕）照舊往外拋。

**決定三（staging 清理；L4，低）**：`guest_choice.rs` 的 `fs::write(staging)` 失敗時，部分寫入的 `.tmp` 不再殘留。與 rename 失敗的清理同形。這條分支沒有單元測試，因為無法不改程式就讓 `fs::write` 在中途失敗；已由程式審讀與 clippy 覆蓋。

**決定四（「Stay a guest」的復原方式：寫進文件，不加 UI；M2，文件）**：沒有 app 內的重新詢問入口，所以 docs-site 的 desktop-app 頁（en／zh-tw）寫出復原法：刪除 `%APPDATA%\com.opencodex.desktop\guest-choice.json`（Tauri 的 `app_config_dir`，與 install id 同目錄，由 `guest_choice::directory` 取得）。刪檔會一次忘記所有代理的選擇，這點寫明。ROADMAP「中期」加一列「app 內提供重新詢問入口」，觸發條件是有人回報刪檔不便。

**決定五（排程狀態不明的錯誤訊息導向提權終端機；L1，文件）**：排程查詢與 CSV 都失敗時，完整移除仍然在刪任何檔案之前丟出 `Could not determine Task Scheduler state`，但訊息現在要求以系統管理員身分執行移除，並附 `schtasks /query /tn` 指令。`structure/ops/desktop-supervision.md` 同步描述。

**證據**：
- 紅燈（M1 的測試先寫、程式後改）：修法之前，`tests/windows/windows-service-wrappers.test.ts`、`tests/windows/windows-guarded-manager.test.ts`、`tests/cli/cli-resolve.test.ts`、`tests/cli/uninstall.test.ts` 這 4 檔共 203 測試中 6 個失敗：記事本路徑在 guarded、ancestor、resolve、residue 四處被算成包裝檔，以及殺行程腳本沒有映像名稱過濾。
- 綠燈：修法之後，`bun test tests/service/service.test.ts tests/windows tests/update tests/cli/uninstall.test.ts tests/cli/cli-resolve.test.ts --timeout 60000` 共 2488 測試，4 失敗，全部是 `tests/update/update-tree-ownership.test.ts` 的 `EPERM: operation not permitted, symlink`（這台 Windows 沒有建立符號連結的權限，與本次改動無關）。
- `tools/dev_check.ps1` 全綠（fork hygiene 42 pass、Markdown 連結檢查通過）；`bun run typecheck` 無型別錯誤；`cargo test --lib guest_choice` 10 通過（臨時在 gitignored 的 `binaries/`、`resources/` 放空的建置輸入，跑完已刪除）；`cargo clippy --lib --all-targets -- -D warnings` 通過。
- 未驗證：`ocx service uninstall` 的實機殺行程行為（依規則不執行；只靠單元測試與腳本內容的規則比對）；L2 的新測試是與程式同批寫入，沒有先紅。

**補記（PowerShell 單引號跳脫；Windows 路徑含 `’` 時殺行程腳本語法錯誤）**：PowerShell 把 U+2018–U+201B 也當成單引號字串的結束符，原本各處只加倍 ASCII `'`，使用者名稱為 `O’Brien` 的 home 會讓 kill 腳本解析失敗而靜默不做事。現在全部經由 `src/lib/powershell-quote.ts` 的共用 helper 產生字面值，`update-failure-guidance.mjs` 與 `scripts/codex-queue.test.mjs` 因不能 import 而就地實作同一規則；紅燈先寫在 `tests/windows/powershell-single-quote-parse.test.ts`（以 PowerShell Parser 只解析、不執行）。

## 2026-11-13：回收 Codex 寫入鎖的 claim-init 暫存檔

`prompt-lock-claim.ts` 的暫存檔位於設定目錄，清理改以該父目錄為 witness，避免 `.claims` 被同伴移除後連自己的暫存檔也無法清理；成功獨占寫入才取得清理資格，`finally` 仍經 `guarded()` 比對檔案身分與完整內容，capture 失敗時只重取符合本次寫入內容的 entry，替換檔與移走的 ownPath 均保留。取得鎖前只掃同一 lock 前綴且 token 為 16 位小寫十六進位的 `.claim-init-`，共用 `ownerState(record, deps)` 並在 `guarded()` 內再判一次，只有 host 符合本機、正整數安全 PID 確認死亡且 processStart 沒有不符時才刪除；異機／缺失 host、processStart 不符、活 PID、未知／拋錯、內容或格式不符、symlink 與變動中的 entry 均保留。整個掃描為 best-effort，包含 `readdirSync` 的一般 I/O 錯誤及重試耗盡的 `LockFileBusy` 都略過掃描，繼續正常取鎖，其餘 namespace 與取鎖檢查仍照常執行。回歸先在舊碼證明 link／unlink 前目錄消失、capture 失敗及死 PID 殘留四項紅燈，再修補驗證；不操作本機 runtime，也不清理真實使用者設定目錄。

獨立審查後補測 host／processStart 不符與 guarded 內證據改變（含缺失 host）先紅後綠；另以 EIO、EPERM、EBUSY、EACCES 注入目錄掃描失敗，先證明拋錯或誤回 busy，再確認仍能取得鎖且殘留保留。
