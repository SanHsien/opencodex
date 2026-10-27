---
title: CLI 生命週期
description: 安裝、啟動、停止、服務、診斷、同步與更新指令。
---

這些指令安裝、執行、檢查、修復並更新本機 opencodex 代理及其 Codex 整合。

## Discover before starting services

`ocx help`, `ocx help <family>` and `ocx help <family> <leaf>` are offline.
Use `ocx help --all` when the compact root is insufficient. Help, local config
validation and local Lab inspection do not require starting a proxy.

Before a live management workflow, run `ocx ready --json` and `ocx status --json`.
Readiness distinguishes `pending`, `failed` and `unreachable`; only `ready: true`
confirms readiness. Check the target and `versionSkew.relation`: `unknown` is not
proof of matching versions. A version mismatch calls for resolving the intended
installation, not repeatedly trying a newer flag against an older server.

Output and exit conventions are command-specific. `ready` and `resolve` reject
invalid arguments with 64, while `doctor --json` is unsupported and exits 2.
A successful local save or accepted restart request does not prove convergence;
read the command receipt and re-check status after the requested operation.

When live target discovery finds no proxy, policy/catalog commands, key-scoped usage and
Aside profile sync report: “Proxy is not running. Start the intended proxy with: ocx start.
No request was sent.” A management request that was sent can still have an uncertain write
outcome; read back from the intended target before retrying. Legacy client-integration
refusals add fixed recovery guidance keyed on the refusal reason (never the writer's own text);
backup and residual-recovery notices remain available.

`ocx system update run --yes` prints the accepted job ID and observed job state. Follow it
with `ocx system update status <job-id>`; acceptance does not establish successful installation
or restart. `--json` retains the complete server response.

## 安裝

### `ocx init` · `ocx setup`

互動式設定精靈（`setup` 是 `init` 的別名）。提示選擇供應商（預設或自訂）、API 金鑰（字面值或 `${ENV}`）、預設模型與代理連接埠；儲存 `~/.opencodex/config.json`；可選擇將代理注入 `$CODEX_HOME/config.toml`（預設 `~/.codex/config.toml`）；並可選擇安裝 Codex 自動啟動 shim。

## 代理生命週期

### `ocx start [--port <port>] [--socks5 [host:port] | --socks5-off]`

啟動代理伺服器（偏好連接埠 `10100`）。它寫入 PID/runtime-port 狀態，並拒絕啟動第二個即時實例。偏好連接埠被佔用時，`start` 會探測佔用者，且無論結果如何都會停止：若回應的是 opencodex，它會直接拒絕啟動；否則會回報無法識別的佔用者。它絕不會自行將監聽位置移到其他連接埠，因為這會讓第一個代理繼續執行，並將 Codex 重新指向第二個代理。即使明確指定不同的 `--port`，共用同一個 `OPENCODEX_HOME` 時仍會拒絕啟動，因為僅觀察模式和啟用上限的模式都會寫入同一份支出日誌。獨立的同層實例必須使用不同的 `OPENCODEX_HOME`；`port: 0` 只讓作業系統指派連接埠，不會隔離狀態。啟動時它將每個供應商的模型同步到 Codex 目錄。關閉時它還原原生 Codex——除非它是作為受管服務啟動的（`OCX_SERVICE=1`）。在已執行的代理旁啟動的同層實例兩者皆不做，即使透過 `ocx stop` 或訊號停止也一樣：它只在自己的連接埠上處理直接請求，Codex、Grok 和 Claude 仍指向原本已在執行的代理。 從另一個 `OPENCODEX_HOME` 啟動時，會依預設主目錄的執行階段記錄及受管理的 Grok、Codex 本機迴環位址檢查存活的擁有者。沒有存活擁有者的單獨自訂主目錄仍正常同步；明確執行的 `ocx sync` 和 `ocx grok apply` 也維持可用。

`--socks5`（預設 `127.0.0.1:10808`）會將 SOCKS5 URL 儲存到 `config.proxy`，並透過真正的 SOCKS5 通道轉送對外 HTTP(S) 請求。`--socks5-off` 只會清除已儲存的 SOCKS5 代理，不會刪除 HTTP 代理。此值儲存在設定中，因此會在 `ocx update` 後保留。URL 可以包含使用者名稱和密碼，但啟動記錄會隱藏它們。

```bash
ocx start
ocx start --port 8080
ocx start --port 10100 --socks5
ocx start --socks5-off
```

### `ocx stop`

停止執行中的代理（依 PID）、移除 PID 檔案，並還原原生 Codex。若已安裝受管背景服務，`ocx stop` 也會先停止它，使其無法重新生成代理。網頁儀表板的 **Stop** 按鈕在多數後端執行相同動作（`POST /api/stop`），但 Windows 工作排程器除外：工作結束後包裝程序仍可能重新啟動 Proxy，因此儀表板會以 `respawnable_service` 拒絕、不做任何變更，並請你改用 `ocx stop`。

儀表板在代理本身就是已安裝的 launchd 或 systemd 服務時同樣會拒絕。從 proxy 內部停止那個管理器，
會在原生 Codex 被還原之前就終止程序，讓你的用戶端設定指向一個已經消失的 proxy，所以儀表板會回傳
`self_unload_service`、不做任何變更，並請你執行 `ocx stop`——它會從外部停止服務並完成還原。

單靠 proxy 結束並不能確認共享的 Codex/Grok 還原已經成功。若 stop 的回應回報失敗、無法讀取，或
沒有確認已指派的拆卸模式，CLI 會在既有的擁有權與 respawn 檢查之後，把還原工作留給發起停止的父
程序處理。對於已經觀察到結束的程序，它不會進入強制停止的退路。有收據支持的延後處理，仍會把最終
還原與收據清理交給父程序；共享用戶端設定還原失敗時，stop 會維持失敗狀態，其收據也會維持未結案。

### `ocx restart`

當代理正在執行時，會要求那個確切、已驗證的 PID 與連接埠就地重啟，等待它正常排空，並確認同一個
連接埠上出現一個不同的 runtime PID。整個過程中受管路由與服務監督都保持安裝；不確定的請求會被
觀察而不是被當成另一次獨立的 stop/start 重播。若沒有代理正在執行，此指令會退回正常的 `ensure`
啟動流程。若一個存活的 listener 無法被驗證對應到某個 runtime PID（包括更新前的舊代理），重啟會
直接 fail closed，不會退回 `ensure` 或 stop/start。確認擁有權後，standalone 代理請使用
`ocx stop` 再接 `ocx start`。由服務管理的代理，請使用 `ocx stop` 接著 `ocx service start`，
以恢復監督。

停止或更新後的連接埠復原，即使 PID 是在關閉前記錄的，仍會尊重一次失敗的 OCX process 檢查。被
拒絕的現用持有者會繼續執行，並阻止 TCP-row 清理。若它始終無法被驗證，有時限的復原等待可能會在
連接埠仍被佔用的情況下逾時。請檢查目前的連接埠持有者，並在衝突解決後重試重啟。

### `ocx ensure`

冪等地確保背景代理正在執行，然後同步其即時模型目錄。若
`codexAutoStart` 為 `false`，它會印出自動啟動已停用並不做事。

### `ocx restore [back]` · `ocx eject [back]`

在不停止代理的情況下還原原生 Codex——剝除注入的設定行與路由目錄項目，使普通 `codex` 再次以原生方式運作。`eject` 是 `restore` 的別名。

還原後的目錄會排除已退役的原生模型，包括 `gpt-5.3-codex-spark` 的裸 ID 與可信的帳號限定項目。
無論是否有目錄備份，此規則皆適用；原始備份與使用者儲存的歷史模型選擇設定保持不變。

當已儲存的 journal 缺少對應的注入雜湊時，還原會回報失敗，而不是取代已變更的設定檔。目前的檔案
與 journal 仍可供檢視；詳見[沒有注入雜湊時的復原](/zh-tw/guides/codex-integration/#沒有注入雜湊時的復原)。

對任一拼法傳入 `back` 可在不變更代理生命週期的情況下，將普通 `codex` 重新指向已在執行的代理：

```bash
ocx restore back
ocx eject back
```

### `ocx recover-history --legacy-openai --yes`

針對在可逆備份支援存在前、重新對應 Codex App 歷史的舊開發組建進行明確復原。若其歷史資料庫被鎖定，請先關閉 Codex。

這是範圍很廣且具破壞性的重新標記：所有含有使用者訊息且目前標記為 `opencodex` 的 thread 都會改標為 `openai`，`exec` 會正規化為 `cli`，並設定 event marker。正常的專用 provider 歷史也包含在內。請先備份狀態，而且只有在確實需要這個完整範圍時才執行。

### `ocx recover-history --ocx-compaction <thread-id> --yes`

在透過原生 Codex 恢復曾由路由提供方壓縮的工作前，修復該工作的歷史記錄。此命令依 UUID 精確選取一個工作，先儲存私有的逐位元組備份，然後只把 OpenCodeX 自有的 `ocx1:`/`ocx2:` 壓縮狀態轉換成原生 Codex 可重播的普通摘要。原生加密內容與其他工作不會變更。執行前請關閉所選工作；若 rollout 在處理期間發生變化，復原會停止且不會取代原始檔案。

### `ocx uninstall` · `ocx remove`

停止服務與代理、移除服務與 Codex shim、還原原生 Codex，然後僅在所有還原步驟成功時移除 opencodex 本機設定。`remove` 是 `uninstall` 的別名。設定清理需要由全新安裝建立的擁有權中繼資料；舊版或共享目錄會被原樣保留。

## 狀態與健康

### `ocx status [--json]`

Status 與 `ocx doctor` 會比較這個 CLI 的版本與執行中 proxy 的版本。若 CLI 較新，請用預期的目前
安裝重新啟動 proxy；對於背景服務，請執行 `ocx service restart`——版本偏移不會改變服務定義的位元組
內容，所以 `ocx service repair` 不會重新載入任何東西，舊程序仍會繼續服務。若 proxy 較新，請升級
CLI，或修正 `PATH` 指向預期的安裝。這些診斷不會修復服務，也不會改變請求是否被允許。

相同的版本字串，以及 `unknown` / `0.0.0` 佔位符，都會抑制這個警告；沒有 proxy 版本時同樣如此。
Doctor 不會把佔位符回報為確認相符。當版本字串無法被嚴格解析為 SemVer，或只是 build metadata
不同時，不同的字串仍會產生一個中性警告；不會宣稱哪一邊比較舊。版本字串不會被裁剪，開頭的 `v`
也不會被正規化。JSON 在 `versionSkew` 中提供相同的建議，其欄位維持為 `cliVersion`、
`proxyVersion`、`skewed` 與 `warning`。

印出唯讀診斷摘要：代理 PID、`/healthz` 可達性、儀表板 URL、設定路徑、預設供應商、Codex 自動啟動設定、服務狀態、shim 狀態與遮罩後的有效 Codex home。只有明確、高信心的 Windows Orca runtime-home 簽章會加上可採取行動的 App-home 不符警告；它永不自動變更 `CODEX_HOME`。

人類可讀輸出還在 OAuth 登入摘要後包含一個 **OAuth 健康** 區塊：當每個已知帳號都健康時為 `OAuth health:
ok`，或在有任一非健康帳號時為 `OAuth health: warning`，每個非健康帳號一行遮罩資料（供應商、遮罩帳號 id、狀態如需要重新認證、速率或配額限制，或 refresh 衝突），加上可選的 `Action:` 提示。帳號 id 會被遮罩；token 與電子郵件永不印出。`--json` 契約目前不包含此健康區塊。

```bash
ocx status
ocx status --json
```

縮寫範例結構：

```json
{
  "schemaVersion": 1,
  "proxy": {
    "running": false,
    "pid": null,
    "health": {
      "ok": false,
      "url": "http://127.0.0.1:10100/healthz",
      "message": "unreachable"
    }
  },
  "dashboard": {
    "url": "http://localhost:10100/"
  },
  "paths": {
    "config": "/Users/example/.opencodex/config.json",
    "pid": "/Users/example/.opencodex/ocx.pid",
    "runtime": "/path/to/bun"
  },
  "runtime": {
    "source": "bundled"
  },
  "codexHome": {
    "effectiveCodexHome": "C:\\Users\\[USER]\\.codex",
    "appCodexHome": "C:\\Users\\[USER]\\.codex",
    "mismatch": false,
    "warning": null,
    "action": null
  },
  "codexAutostart": true,
  "defaultProvider": "openai",
  "service": {
    "summary": "not installed (logs: /Users/example/.opencodex/service.log)"
  },
  "codexShim": {
    "summary": "Codex autostart shim: not installed"
  }
}
```

實際物件還包含 `listen`（連接埠、主機名稱、runtime/config 來源）、設定載入診斷，以及 bundled Codex plugin 診斷。JSON schema 為附加式：未來版本可能新增欄位，但既有欄位應保持穩定。它刻意排除 API 金鑰、OAuth token、授權標頭、請求內容、電子郵件與帳號身分。

即時讀取會等待有時間上限的服務探測完成：診斷快取為空或已過期時，macOS/Linux 最多等待 6.5 秒，Windows 最多等待 16.5 秒。從快取讀取的結果會迅速回傳。逾時仍會退回本機診斷；僅憑 `/healthz` 健康，無法確認重新啟動保護已生效。

### `ocx health [--json]`

對即時代理進行身分檢查。人類可讀輸出回報 PID/連接埠；`--json` 輸出 `{ok, pid, port}`。此指令僅在健康時離開 0，否則離開 1，使其適合服務探測。

### `ocx system health [--json]`

```bash
ocx health --json
ocx system health --json
```

Root health is the liveness probe. System health is a separate management
observation: `{status:"ok",service:"opencodex",version,uptime,pid,spendLedger}`,
with uptime in seconds. `system status` remains its settings/startup/memory aggregate.
A valid system-health observation exits 0 even if the spend ledger is degraded.
Read ownership held/unheld, initialized, configured, degraded, persistFailures and
corruptRecords; status ok does not certify every subsystem healthy. Failed/malformed
reads remain nonzero with safe stderr, not fabricated healthy data.

For bounded diagnostics, [request/injection follow](/zh-tw/reference/cli/agents/#follow-request-windows-or-injection-sequences)
stops on error or detected target change instead of reconnecting automatically.
SIGINT exits 130 and SIGTERM 143. Versioned log events reconstruct observed windows,
not traffic missed between polls; injection seq cannot exclude restart/eviction gaps.

### `ocx ready [--json] [--wait [--timeout <seconds>]]`

透過免認證的 `GET /readyz` 端點檢查同步後的就緒狀態。就緒時回傳 `200`，或 `pending` 與終端 `failed` 時回傳附帶 `Retry-After: 1` 的 `503`。其淨化的 HTTP 身分為 `{service, version, uptime, pid, port, status}`，外加遠端 hub 協定欄位
`{protocol, minimumClientProtocol, managementUrl, features}`。`protocol` 是這個 proxy 所使用的 hub 協定，
`minimumClientProtocol` 是它仍接受的最舊用戶端協定，因此用戶端可以在送出任何其他內容之前，就
拒絕一次不相容的配對。`managementUrl` 是用戶端應該用於管理平面的 origin：當 `runtimeRole` 為
`hub` 時，是已設定的 `hub.managementPublicOrigin`；否則就是請求實際抵達時所用的 origin。沒有
HTTP(S) origin 的就緒請求會被拒絕，而不是用猜測的方式回答。`features` 列出此版本提供的對等功能，讓對等端不必比對版本就能檢查某項能力：`relay-auth/<n>` 是 Remote Link relay 認證版本，`link-management-relay` 是唯讀的 Remote Link 管理 relay，`link-peer-report/<n>` 表示 Remote Link Home 會在 `ocx link status` 回報各 Child 的版本與相容性，`quota-pool/1` 是 `GET /api/quota-pool` 管理讀取，`served-by-header` 是 `x-opencodex-served-by` 回應標頭。此版本不提供的功能不會出現。清單只含固定名稱，絕不含帳號或設定資料。
沒有 `/readyz` 的舊代理會以
`unreachable` 方式 fail closed；`/healthz` 是分開的存活檢查，而非就緒檢查。此指令預設執行一次
探測；`--wait` 輪詢直到就緒或逾時，但在觀察到終端 `failed` 狀態時立即退出。預設逾時為 45 秒；
`--timeout <seconds>` 需要 `--wait`，接受 1–300 的正整數秒。CLI 自己的 `--json` 輸出刻意比 HTTP
主體更精簡：它輸出 `{ready, status, pid, port}`，其中 `status` 為 `ready`、`pending`、`failed`
或 `unreachable`。離開碼為：就緒為 0；未就緒、pending、failed、逾時或 unreachable 為 1；無效
引數為 64。

### `ocx resolve [--json]`

解析 shell 需要的執行期事實，而不必自己重新實作：設定所在目錄、有效連接埠，以及經過身分驗證的
存活判定。`--json` 會輸出一份帶版本的文件（`schema: "ocx-resolve/1"`），內含 `cliVersion`、
`configHome`、`port`（`effective`、`configured` 與 `source`），以及 `liveness`（`status`、`pid`、
`port`、`source`，若正在運作的 proxy 有回報，還會有 `version`、`role` 與 `hostname`）。存活判定
有三種答案：`live`、`absent-proven`（每個記錄下或設定中的端點都明確拒絕或回應了非 opencodex 的
內容），以及未知——逾時的探測或不回應 `/healthz` 的監聽器會以 exit 1 結束，而不是視為不存在，
因此只有 `absent-proven` 才能授權啟動新的執行個體。當有 proxy 回應時，連接埠就是實際監聽的埠，
否則為設定的連接埠（預設 10100）。exit 0 代表可信的判定；exit 1 代表 CLI 無法解析——包括無效的
`config.json`，這裡永遠不會被修復成預設值——呼叫者必須拒絕猜測；任何未知引數都會以 exit 64 結束。
探測使用與 `ocx start` 相同、對所有權安全的探測預算，因為錯誤的「沒有東西在監聽」答案正是重複
proxy 產生的原因。這個動作是唯讀的，且會略過 shim 自動復原的 preflight。

### `ocx doctor`

預設報告包含原生寫入協調器的狀態與確切路徑，使用不可變的唯讀 SQLite 檢查取得。零位元組、空的
未版本化，以及沒有資料列等狀態，會與目錄／app-server 健康狀態分開顯示，因此一次成功的目錄重新
整理不會被誤認為成功的 Codex 設定注入。

停止 OpenCodex proxy／服務後，明確保留並搬移一個已證實為非權威的協調器，然後重試 sync：

```bash
ocx doctor --recover-zero-byte-coordinator --yes
ocx sync
```

這項復原只接受已證實的零位元組殘留物。對於任何非空、有效、未知、已變更、不安全或忙碌中的資料庫，
它一律拒絕，並在同一目錄建立 `.zero-byte-backup-*` 檔案，而不是刪除任何東西。

執行唯讀環境與連線診斷：狀態路徑與檔案系統類型、WSL 雙重安裝、代理環境／設定、ChatGPT 可達性、Codex plugin 與專案設定警告，以及待處理的歷史遷移。Codex app-home 定向區段也會偵測窄義的 Windows Orca runtime-home 不符，並在適用時說明服務遷移。此診斷顯示的路徑會遮罩 OS 使用者名稱。Doctor 印出修復提示但不套用它們。

專案設定診斷會忽略 TOML 多行字串內的供應商範例，包括 `developer_instructions` 中的範例。
結束分隔符之後的真正供應商與設定檔設定仍會被檢查，即使結束分隔符前面緊接著一個跳脫的引號也一樣。

**OAuth 可靠度** 區段回報憑證儲存是否可寫、是否可在 `OPENCODEX_HOME` 下建立 refresh single-flight／lock 檔案、非健康的 OAuth 或 Codex pool 帳號（遮罩 id）及其恢復 `Action:`，以及一個關於 Codex forward path 不偽造官方客戶端中繼資料的靜態 OK。Doctor 永不變更憑證或套用修復。

## 目錄同步

### Read saved state separately from synchronization

Model, provider, settings and v2 receipts have different completion contracts.
Local custom-model changes opportunistically sync: no proxy means a successful
save, `needsSync:true`, `sync.status:"not-attempted"` and exit 0. An explicit local
provider `--sync` without a proxy instead returns nonzero after saving.

Settings writes use `catalogRefreshPending`, while live v2/catalog writes use a
full `catalogRefresh` disposition. Local v2 mode/keep-native and changed on/off
still attempt their established sync even when no port was discovered. JSON
reports actual changed state and sync evidence; unverified/failed sync is nonzero.
Threads/hints and unchanged on/off do not introduce a new sync attempt.

Inspect the same target with `ocx v2 status --json` or `ocx v2 status --live --json`,
and use `ocx system settings --json` for settings read-back. A saved-but-pending or
unknown outcome does not prove rollback and is not permission to replay a write.
See [v2 outcomes](/zh-tw/reference/cli/agents/#explicit-v2-target-and-outcome) and
[account policy](/zh-tw/reference/cli/providers-accounts/#pool-policy-account-thresholds-and-paid-credit-intent)
for target, scope and spending boundaries. A reset-grant status read can contact
upstream status but never consumes or resumes a grant.

### `ocx sync [--restart-codex] [--restart-app-server-only]`

> **Remote Link Child：** `ocx sync` 也會套用 Home 的 Codex 設定；如果用戶端執行階段在該次套用之前啟動，即使沒有重新啟動旗標也會重新啟動執行階段。重新啟動失敗時，原有執行階段會繼續提供服務，指令以非零狀態結束。`ocx status --json` 與 `ocx link status --json` 的相關欄位請見 [Remote Link apply parity](/zh-tw/reference/cli/lifecycle/#remote-link-apply-parity)（英文）。

明確指定重新啟動旗標後，即使目錄和快取的位元組未變，成功提交 `config.toml` 變更也會觸發重新啟動。僅處理設定的操作若沒有變更、遭拒、只做預先檢查或寫入已回復，則不會觸發重新啟動。未指定重新啟動旗標時，sync 不會自動重新啟動 Codex。

從每個已設定的供應商擷取即時模型清單，並將合併後的目錄重新注入 Codex。在新增供應商後或要重新整理可用模型時執行它。

在供應商探索或目錄／快取替換之前，`ocx sync` 會先驗證受管的 Codex 設定是否可以被注入。
若該驗證拒絕該設定，指令會以非零狀態結束、在 stderr 印出具體原因，並讓既有的目錄與快取保持不變。
`ocx restore back` 在重新啟用路由之前，也使用相同的不寫入 preflight 檢查。

若長壽的 Codex `app-server` 仍在執行，`ocx sync` 會警告它們可能繼續提供先前的記憶體內模型清單，即使 `opencodex-catalog.json` / `models_cache.json` 已更新。傳入 `--restart-codex` 會重啟相符的 `codex … app-server` 與 `codex-code-mode-host` 進程，並在 macOS、Linux 與 Windows 上完全結束再重新啟動 Codex 桌面應用程式，讓模型選擇器重新讀取目錄。進行中的對話會結束。刻意避免廣泛的 `pkill -f codex` 比對。

`--restart-desktop-app` 是 `--restart-codex` 的已棄用別名。它仍然可用、會印出棄用提示，且不再僅限 Windows。

`--restart-app-server-only` 恢復先前的窄範圍行為：僅對目前使用者擁有的相符 app-server / code-mode-host 進程發送 `SIGTERM`，桌面應用程式保持執行（執行中的回合仍可能被中斷）。若與 `--restart-codex` 或 `--restart-desktop-app` 一起使用，窄範圍優先，因為失去進行中的對話無法復原，過期的選擇器可以。

當命令在 Codex 應用程式內部執行時，重啟會交給分離的 helper，此工作階段會隨應用程式一起結束。

**指定來源的同步。** `ocx sync --expect-link <linkId>`（Remote Link Child）與 `ocx sync --expect-hub-key <apiKeyId>`（hub 用戶端）只有在本機仍連線到該連結或使用該金鑰時才會同步。否則不會變更任何內容，也不會同步本機供應商，指令以結束碼 5 結束，stderr 最後一行為 `{"phase":"child_link_mismatch"|"hub_client_mismatch","reason":...}`。格式錯誤或重複的旗標以結束碼 2 結束。詳情請見[英文參考](/zh-tw/reference/cli/lifecycle/#sync-only-from-the-expected-home---expect-link-and---expect-hub-key)。

#### Sync only from the expected Home: `--expect-link` and `--expect-hub-key`

```bash
ocx sync --expect-link <linkId> [--restart-codex]
ocx sync --expect-hub-key <apiKeyId> [--restart-codex]
```

A script that reads `ocx connect status --json` and then runs `ocx sync` cannot tell whether the
machine was disconnected or relinked to another Home in between; a plain `ocx sync` would then
sync the local providers or the other Home's catalog. Passing the identity you read closes that
gap. `--expect-link` takes the `link.linkId` of a Remote Link Child and `--expect-hub-key` the
`apiKeyId` of a hub client. The check runs under the same lock that chooses the sync path, and
every later write is bound to the connection that passed it.

When the identity holds, the command is exactly the connected sync above. Otherwise it changes
nothing (not even the automatic Codex shim repair other commands run first), never syncs the local
providers, exits **5**, and prints a human line followed by one JSON line as the last line on stderr:

```json
{"phase":"child_link_mismatch","reason":"other_link"}
```

`phase` is `child_link_mismatch` for `--expect-link` and `hub_client_mismatch` for
`--expect-hub-key`.

| `reason` | Machine state |
| --- | --- |
| `disconnected` | Not connected to any Home or hub |
| `invalid_state` | The client configuration or a connect marker cannot be read |
| `disconnect_pending` | A disconnect has started and not finished |
| `pending_operation` | A key rotation, a connect, or another sync is in progress (including one that holds the locks this check needs) |
| `hub_client` | `--expect-link` on a hub client |
| `link_client` | `--expect-hub-key` on a Remote Link Child |
| `other_link` / `other_key` | Connected, but to a different link or with a different key |

A missing or malformed value, a repeated flag, or both flags together exit 2 before any state is
read. A connection that changes after the check, while the catalog is being fetched, still fails
as a plain connected sync does (exit 1, nothing written). Versions without these flags ignore
them, so check `ocx --version` first.

### `ocx sync-cache [--restart-codex] [--restart-app-server-only]`

使 Codex 的本機模型選擇器快取失效，使其從現用的 opencodex 目錄重建。與 `ocx sync` 相同的過時 `app-server` 警告與可選重啟旗標適用。

### Catalog write diagnostics

Catalog write auditing records bounded diagnostics in `opencodex-catalog-audit.jsonl` under
`CODEX_HOME`. An unchanged catalog or cache produces no event; an audit failure does not fail
catalog publication.

On Windows, **at most the successful new-file creation event is recorded**. The file is created
empty and hardened before diagnostic data is written. All later events skip the existing file,
both in the same process and after restart. A hardening failure may leave an empty file, which
later events also skip. Existing files and their ACLs are not changed for auditing, including
when another OpenCodex home owns the catalog. This is a privacy-first fallback, not a complete
Windows audit stream; native NTFS behavior for this audit path has not yet been validated.

POSIX auditing continues to append and retain bounded records. The Windows limitation does not
disable catalog protection or owner healing. Audit files in a separate `CODEX_HOME` remain
cleanup residuals because the config uninstall manifest cannot claim paths outside its own root.

### `ocx catalog pull <https-url> [--auth-env <NAME>] [--json] [--restart-codex] [--restart-app-server-only]`

安裝由另一個 OpenCodex 執行個體的 `/v1/catalog` 端點提供的完整目錄，接著同步 `models_cache.json`。
與 `ocx sync` 不同，此指令不會探索已設定的供應商，也不會注入 Codex 設定。與 `ocx sync-cache`
不同，它會先取代現用目錄，再重建快取。即使本機 Codex 整合的期望狀態是關閉的，它仍然可以運作。

URL 必須是 HTTPS；本機測試時允許 loopback HTTP。內嵌於 URL 的憑證、查詢字串、fragment、重新導向、
過大的回應、格式錯誤的 JSON、重複或不安全的 slug，以及未知的 `input_modalities`，都會在任何本機
寫入之前遭拒。

如果 `HTTP_PROXY` 或 `http_proxy` 生效，且 `NO_PROXY` 或 `no_proxy` 中沒有相符的略過規則，回送 HTTP 要求會在加入驗證標頭或送出要求之前遭拒。`ALL_PROXY`/`all_proxy` 以及僅設定 `HTTPS_PROXY`/`https_proxy` 的情況不會觸發此 HTTP 限制；仍允許透過 HTTPS 取得目錄。拒絕訊息不會包含代理位址或驗證權杖。 非空的 `http_proxy` 和 `no_proxy` 分別優先於 `HTTP_PROXY` 和 `NO_PROXY`。若要設定與 Bun 相容的代理略過規則，請使用主機名稱、相符的 `host:port`、`[::1]` 等含方括號的 IPv6 位址或 `*`，不要使用 URL、路徑或 `*.` 前綴。

驗證是選填的，且只透過環境變數參照讀取：

```bash
export OPENCODEX_CATALOG_AUTH_TOKEN='...'
ocx catalog pull https://proxy.example.com/v1/catalog \
  --auth-env OPENCODEX_CATALOG_AUTH_TOKEN
```

該值會以 Bearer token 送出，但絕不接受以 argv 值傳入。重新導向會遭拒，因此授權不會跨 origin 外流。
目錄與快取在共用的 Codex 目錄鎖與 atomic writer 之下寫入。fetch、驗證、取得鎖、目錄寫入或快取重建
任一失敗，都會保留 last-known-good 檔案。位元組完全相同時是保留 mtime 且不觸碰任何行程的無操作。
`--restart-codex`、`--restart-app-server-only` 以及已棄用別名 `--restart-desktop-app`，在這裡的含義
與 `ocx sync` / `ocx sync-cache` 相同，且僅在實際寫入之後才生效。

URL 必須指名主機根目錄下的 `/v1/catalog`；此指令不支援把端點放在路徑前綴之後的反向代理。

此指令會下載完整目錄並在本機比對位元組，而不是發出 `ETag` / `If-None-Match` 條件式請求。位元組
相同會視為完全無操作，因此目錄本身正確、但 `models_cache.json` 缺失或過期的 Codex home，不會被
此指令修復；請改用 `ocx sync-cache`。

`--json` 會在 stdout 印出一個穩定的信封。`schemaVersion`、`ok`、`status`、`catalogWritten`、
`cacheSynced` 與 `codexRestarted` 永遠存在。`codexRestarted` 仍然只代表 app-server。
`desktopAppRestarted` 只在請求了桌面重啟時才會出現，且只有在重新啟動真正開始時才為 `true`；
交接不代表成功。`status` 是 `updated`、`unchanged` 或 `failed`。成功的 pull 會加上 `modelCount`；
失敗則加上 `code`，這是腳本用來分支的欄位：

| `code` | 意義 | Exit |
| --- | --- | --- |
| `usage` | 引數不是有效的 `catalog pull` 呼叫 | 2 |
| `auth_env_missing` | `--auth-env` 指名的變數未設定 | 1 |
| `url_invalid`、`insecure_http_refused` | URL 在任何請求之前就被拒絕 | 1 |
| `request_failed`、`redirect_refused`、`http_error` | 請求未能產生可用的回應 | 1 |
| `body_too_large`、`body_invalid`、`catalog_invalid` | 回應在任何本機寫入之前就被拒絕 | 1 |
| `write_failed`、`lock_database`、`unsafe_path` | 協同寫入未完成；檔案未變更 | 1 |
| `lock_busy` | 另一個寫入者持有 Codex 目錄鎖 | 3 |
| `restart_incomplete` | 目錄與快取已落地，但 Codex app-server 在 `--restart-codex` 或 `--restart-app-server-only` 之後仍存活 | 1 |

`restart_incomplete` 是唯一會回報真實寫入的失敗：`catalogWritten` 與 `cacheSynced` 仍為 `true`、
`ok` 為 `false`，因為存活的 app-server 仍在記憶體中提供舊目錄。

## 背景服務

### `ocx service [install|repair|restart|start|stop|status|uninstall|remove]`

On Windows Task Scheduler, the service wrapper restarts the proxy after five seconds
even when an external tool terminates it with exit code 0. If another opencodex proxy
already owns the port, the wrapper exits deliberately. Use `ocx stop` or
`ocx service stop` to stop the service and its restart loop. After upgrading an
existing installation, run `ocx service repair` to refresh the generated wrapper.

Run opencodex as a login-managed background service (macOS **launchd**, Linux **systemd user unit**,
Windows **Task Scheduler**) that auto-starts on login and auto-restarts on crash. Service runs set
`OCX_SERVICE=1` so a restart does not churn the Codex config.

Windows Task Scheduler installs use normal process priority (`Priority=4`). The older background
priority (`7`, also the scheduler default when omitted) can delay the proxy's health responses under
CPU contention, making the tray report Offline even while the process is alive. After upgrading,
run `ocx service repair` to migrate that registered priority and restart the service. This migration
may request UAC approval; a priority already set to normal or high does not itself trigger replacement.

The Windows wrapper supports locale dates containing parentheses, including Korean and Japanese
date formats. After upgrading, run `ocx service repair` to replace an older generated wrapper
that exits before launching Bun on those locales.

The Windows wrapper verifies its baked Bun runtime and CLI entry before every start attempt. If an
interrupted package update removed either file, it logs one `installation is incomplete` message and
stops instead of retrying the same missing executable every five seconds. Reinstall opencodex, then
run `ocx service repair` to refresh the task with the restored package paths.

Service definitions omit shell-local version-manager multishell directories from their saved
`PATH`. This includes the native Windows service installed with `ocx service install --native`;
run `ocx service repair` to regenerate an older WinSW definition with a durable `PATH`.

On Linux, the systemd unit invokes the first regular, executable `ocx` file found on `PATH` at
install time rather than the Bun and CLI paths inside the installed package tree. Version managers
such as **mise** and **asdf** install into a versioned directory and delete the old one on upgrade;
their stable shim keeps the unit resolving. Source checkouts without an `ocx` launcher keep the
direct Bun + CLI form. A trusted `OPENCODEX_BUN_PATH` selected before Bun starts is preserved
through the shim; package-local bundled Bun paths are rediscovered after upgrades.

On macOS, launchd instead uses the package-local Bun and CLI paths selected during install or
repair. This prevents a mutable PATH shim from receiving the service API token and configured proxy
environment on a later restart. After upgrading a version-manager installation, run
`ocx service repair` to refresh those paths before restarting the service.
Launchd restarts the proxy after a crash or failed restart handoff, but leaves it stopped when
the service deliberately exits cleanly because the desktop app owns the runtime. Run
`ocx service repair` once to apply this behavior to a service installed by an older version.

Definitions installed before this change still carry the old versioned paths and cannot migrate
themselves — once the old executable is deleted, no opencodex code runs to fix it. Run
`ocx service repair` once after upgrading. Linux service starts then follow the launcher; macOS
repair writes the new package paths into the launchd definition.
An already-running proxy is not replaced by an external upgrade: when the installed CLI is newer
than the running proxy, run `ocx service restart` so the new build serves. On macOS, `repair` is not
enough there: the definition did not change, and a repair that changes nothing reloads nothing.
If the proxy is newer instead, check the CLI installation and `PATH` as described under
[`ocx status`](#ocx-status---json).

| Subcommand | Action |
| --- | --- |
| none | Install and start when absent; otherwise `repair` the existing service. A healthy Windows scheduler definition is reused; a stale definition may be re-registered and require elevation. |
| `install` | Create and start the service. Registers it, which on Windows needs elevation. |
| `repair` | Refresh an installed service in place. On macOS, the manager is reloaded only when something changed, so a healthy, unchanged job keeps running and the repair is not an outage. On Linux and Windows, the service is restarted; a healthy Windows scheduler definition is reused, while a stale definition may be re-registered and require elevation. |
| `restart` | The same refresh and a guaranteed restart on every platform. On macOS an unchanged, already-loaded job is kickstarted in place. Not an alias of `repair`. |
| `start` | Start an installed service. |
| `stop` | Stop the service and restore native Codex. |
| `status` | Report service and proxy diagnostics plus log paths. |
| `uninstall` | Remove the service and restore native Codex. |
| `remove` | Alias of `uninstall`. |

On Windows, a bare `ocx service` runs the install path only after both Task Scheduler and WinSW are
proven absent. If either status query is inconclusive, it refuses to register anything and asks you
to run `ocx service status`; use explicit `ocx service install` only after confirming absence.

### 執行期所有權

The OpenCodex desktop app can take the background proxy over from a CLI installation. When it does,
it records the handover in the shared service install state, and that record is what makes the
takeover survive a restart. Your service registration is **kept, never deleted** — the record
supersedes it rather than replacing it.

A state file with no ownership record means the CLI installation owns the runtime, which is what
every installation made before this feature is in. Nothing changes for you until an app takes over.

Supervised service children also check the recorded owner before startup and once more while
holding the startup ownership lease, before choosing a port or publishing a PID. If the desktop
app claims the runtime during startup, the service child stands down even if the desktop proxy
has not begun listening yet. An unreadable ownership record has the same stand-down behavior.

Home paths inside a state record are compared with the current home by the physical directory they
resolve to, not just their spelling. A junction or symlink recorded under an older install still
names the same home and keeps working after the move; an alias that no longer resolves is only
treated as a different home when its recorded spelling also differs from the current one, so a
stale mount still produces the foreign-owner refusal instead of silently claiming the runtime.

While something other than this CLI owns the runtime, the subcommands that would **activate** your
registration refuse instead:

| Subcommand | Behaviour under a foreign owner |
| --- | --- |
| `repair`, `restart` | Refuse before changing anything. The registration is not re-enabled, rewritten or restarted. |
| `start` | Refuses for the same reason, so an automatic tray start cannot put a second proxy beside the app's. |
| `stop`, `uninstall` | Unchanged. They deactivate, so they are never gated. |
| `install` | Takes the runtime back. It clears the ownership record after the registration succeeds, and reports whose it was. |

`ocx update` behaves the same way: it neither stops the running proxy nor refreshes the service
while the app owns the runtime, because the running server is the app's own bundled binary and the
refresh would re-enable the launcher the takeover superseded. The app updates its own runtime.

The refusal names the owning installation and the consent generation, for example:

```text
Background service repair stopped: the desktop app owns the runtime (install <id>, consent generation 2).
The service registration was left exactly as it is — not re-enabled, not rewritten and not restarted.
Quit the desktop app and run 'ocx service install' to hand the runtime back to this CLI.
```

A record that cannot be read or does not parse produces the same refusal with a different first
line, because an unreadable claim is not the same as no claim — treating it as "nobody owns this"
is how a permissions error would silently reactivate your service.

**Recovery in every case is `ocx service install`.** It is deliberately the one verb that is never
gated, so removing the app without handing the runtime back, or a corrupted state file, still leaves
you a way to take the service back:

```bash
ocx service install
```

```bash
ocx service
ocx service install
ocx service repair
ocx service restart
ocx service status
ocx service uninstall
```

`install`, `start`, and `repair` confirm that a proxy actually answers on the port
baked into the installed service before reporting success — on all three platforms.
They wait up to 20 seconds and then print the serving port:

```
✅ opencodex service installed and serving on port 10100.
```

If nothing answers, they warn and **exit non-zero**:

```
⚠️  Service installed, but no proxy answered on port 10100 within 20s.
   The manager registered the job; that is not the same as serving.
   Log:       ~/.opencodex/service.log
   Meanwhile: ocx start   (serves in the foreground)
```

A non-zero exit here means *registered but not serving* — not *not installed*. The
service manager accepted the job; the proxy behind it never bound the port. Read the
log named in the message, and use `ocx start` to serve in the foreground meanwhile.

`ocx service status` reports the same three states rather than raw manager output:

```
✅ installed and loaded (launchd; logs: …)
   Serving on port 10100.
```

```
⚠️  installed and loaded (launchd; logs: …)
   Registered, but no proxy is answering on port 10100.
   launchd is running an OLDER plist than the one on disk.
   Fix:    launchctl bootout gui/$(id -u)/com.opencodex.proxy && ocx service repair
   Log:    ~/.opencodex/service.log
   Repair: ocx service repair
   Meanwhile: ocx start           (serves in the foreground)
```

It no longer prints the raw `launchctl list` / `systemctl status` line, which
reported a registered job identically whether it was serving, bound to nothing, or
running a previous definition. The `Diagnostics:` line still carries the log path and
any stale-baked-path finding.

On Windows the scheduler backend keeps its own richer status output, which already
reported Task Scheduler registration separately from proxy reachability.

### Service logs

The managed proxy writes stdout and stderr to `~/.opencodex/service.log`
(or `$OPENCODEX_HOME/service.log` with a custom home). When `OCX_SERVICE` is set,
`ocx start` prefixes every console log line, including multiline diagnostics,
with a UTC ISO-8601 timestamp such as `2026-10-14T03:04:05.678Z`.
Foreground output and other CLI commands keep their existing format.

The service checks the log size at startup and once per minute. Above 20 MiB it
copies the newest 20 MiB into `service.log.1`, moves the previous archive to
`service.log.2`, and truncates the active file in place so the service manager's
open append handles remain usable. The active file can exceed the threshold
between checks; each archive is limited to 20 MiB. Rotation failures do not stop
the service. Copy-truncate can lose lines written during the copy, and an archive
may begin partway through a line. Existing Windows wrapper messages keep their
wrapper format.

On macOS this also covers a subtler failure: `launchctl load` reports failure on
stderr while exiting 0, so a load that did not take used to leave launchd running a
**previous** version of the service definition while the command printed a checkmark.
`install` now fails loudly in that case and names the `launchctl bootout` command that
clears the stale job.

On Windows, `ocx service status` reports Task Scheduler registration separately from
identity-verified OpenCodex proxy reachability. It does not print the localized `schtasks` table,
so the summary remains readable across Windows code pages. Transactional-backup recovery
logs a fixed success message rather than the backup directory name; backup names containing
shell metacharacters do not become commands in that log message.

On Windows, creating the Task Scheduler entry requires elevation. Recognized localized
access-denied text keeps the existing guidance path. If that text is unreadable, the fallback
requires the owned command shape `/create /tn opencodex-proxy /xml <non-empty-path> /f`, status 1,
and a confirmed non-elevated token; the dashboard's Startup Safety action can then request UAC
automatically. If that fallback cannot determine the token state, it retains the original scheduler
error. Foreign tasks and operations can never emit the automatic-elevation marker. Approve the
dashboard UAC prompt or rerun `ocx service install` in an elevated PowerShell window.

For a fresh install where the OpenCodex scheduler task is confirmed absent, UAC approval now
happens before the installer stops any existing proxy. Its unique registration XML is staged in
an ACL-hardened private directory outside the OpenCodex config root, and the task is registered
without being run. Only after
registration succeeds does OpenCodex remove that XML, require ownership metadata for a genuinely
new config root, stop the old listener, remove and boundedly re-verify any native WinSW
registration, publish the service assets, and start the scheduled task. Cancelling or denying UAC,
or failing to claim a new root safely, therefore leaves the working proxy and its Codex routing in
place. Existing or conflicting scheduler registrations continue to fail closed rather than being
deleted as an unsafe best-effort rollback.

If startup reports `another process owns the runtime mutation lease` or `ocx service status` shows
`Runtime mutation lease busy`, the lease is blocking startup or service changes even if the
proxy is not running. The message includes the lock path, recorded PID, current liveness,
executable name when available, and lease age. The process identity is unverified: the PID
may have been reused, so liveness and executable name describe whichever process occupies
that PID now. Wait for the operation to finish and retry; do not delete the lock or stop a
process based only on this PID. A later mutation attempt can reclaim a stale lease once its
age exceeds 30 seconds and the recorded PID is no longer alive; status only inspects it.

On Windows, this shared Node/Bun diagnostic does not launch an executable to look up the
image name; the recorded PID, liveness, lease age and recovery guidance remain available.

### `ocx codex-shim <install|status|uninstall|remove>`

在 macOS 與 Linux 上，`ocx codex-shim install` 會在解析後的 OpenCodex 主目錄安裝私有 wrapper `<OPENCODEX_HOME>/bin/codex` 與可由 shell 載入的 `<OPENCODEX_HOME>/codex-shell-env.sh`。原生啟動器保留在 brew、npm 或 fnm 安裝的位置，套件管理器升級及版本回復不需重新包裝。Windows 仍依原方式就地包裝指令碼啟動器，真實的 `codex.exe` 保持不動。若 Windows 安裝只提供 `codex.exe`，請使用 `ocx service install`。

在提交一次安裝或修復之前，OpenCodex 會在略過服務啟動的情況下，用 `--version` 執行已儲存的
launcher。當該 launcher 把 `codex` 解析回 shim 本身、以非零狀態結束、耗時超過五秒、留下仍在
執行的子行程，或無法被安全地驗證與清理時，它會拒絕這次變更並回滾。因此 `codex-shim install`
不是無條件成功的。若它被拒絕，請重新安裝 Codex，讓 `PATH` 項目變成一個具體的執行檔或
launcher，然後重試；當一個動態的指令管理器 launcher 無法通過這些檢查時，請改用
`ocx service install`。清理被拒絕時，會附上一個有界的診斷後綴，指出探測階段、一個已識別的
原生錯誤碼或訊號，以及在已知時的結束狀態。它不會包含 launcher 路徑或原始子行程輸出，也不會
放寬驗證或回滾檢查。升級期間，一個缺少目前驗證防護的已安裝 Unix shim，會被重新產生並探測。
若它已儲存的 launcher 不安全，OpenCodex 會移除那個過時的 shim，並還原原始 launcher，而不是
留下一個不安全的包裝程式。

僅僅安裝了 launcher，並不能證明 Codex 的請求就會使用 OpenCodex。在一次健康的安裝之後，此指令
會檢查目前的 Codex 路由，並在路由是外部的、由使用者擁有的，或無法驗證時，回報警告而不是綠色
結果。當對外代理變數只存在於目前行程、而 `config.proxy` 未設定或無法解析時，它也會警告，因為
Codex 的 launcher 與背景服務可能不會繼承那個環境。這些檢查都是唯讀的，絕不會印出代理值；請
先解決回報的交接問題，並在依賴自動啟動之前執行 `ocx doctor`。

若已完成的外部 Codex 更新覆寫了已安裝的 shim，下一個普通 `ocx` 指令會備份穩定的新啟動器並在分派前還原 shim。零副作用的檢查指令 `ocx system codex-cli-update check` 與保留的 `ocx system codex-cli-update` 命名空間中的無效呼叫都不會執行此修復。仍在變動中的啟動器保持不動並稍後重試。修復失敗會發出警告但不會使請求的指令失敗；手動後備：`ocx codex-shim install`。將 `codexShimAutoRestore` 設為 `false`，或設定 `OPENCODEX_CODEX_SHIM_AUTO_RESTORE=0` 以進行行程層級的退出。

完成 brew/fnm 等 PATH 設定後，執行安裝時顯示的啟用指令。預設主目錄對應：
```sh
. "$HOME/.opencodex/codex-shell-env.sh"
```
自訂主目錄請使用顯示的含引號路徑。重複載入會移除私有 bin 的重複項目，並將其放在 PATH 最前面。要在之後的 shell 啟用，請自行把這一行加在啟動檔的 PATH 設定之後；OpenCodex 從不編輯 shell 啟動檔，安裝指令也無法變更父 shell 的 PATH。只要 wrapper 可以執行，即使目前 shell 尚未啟用，安裝仍算成功；遭拒或無法執行則失敗。`ocx status`、`ocx codex-shim status`、`ocx doctor` 與 `ocx connect` 會將未被 PATH 選取的 wrapper 回報為 **not active**，並提供啟用指令。connect 警告不會改變結束狀態。別名、函式、桌面或服務的啟動環境需要另外設定。
舊的 Unix 就地 shim 只會透過明確執行 `ocx codex-shim install` 移轉。移轉會還原記錄的原生啟動器，但不覆寫已存在的較新啟動器，之後才安裝私有 wrapper。若還原後私有安裝失敗，原生啟動器會維持已還原狀態，操作可以重試。記錄的啟動器遺失或無法執行時，請透過套件管理器修復；OpenCodex 不會猜測其他安裝位置，也不會重新包裝套件管理器路徑。

那次還原需要 OpenCodex 存放在 shim 旁邊的原始 launcher。像 mise、asdf、volta 這類版本管理工具，
會在升級時重寫整個安裝目錄樹，這會同時摧毀 shim*與*那份備份，於是就沒有東西可以拿來還原了。
**版本管理工具的安裝目錄樹不是受支援的 shim 目標。** OpenCodex 會回報這個狀況並停止，而不是
把新安裝的執行檔包裝成一個替代的原始檔：那樣做會記錄一段從未發生過的歷史，而下一次升級又會
把它覆寫掉，所以這個修復會依版本管理工具自己的排程悄悄自我撤銷。

若你的 `codex` 是由版本管理工具擁有的，請改走 Codex 設定路由，而不是 launcher：`ocx start`
會寫入 `openai_base_url`，`ocx service install` 提供自動啟動。執行 `ocx status` 確認——它會
回報現用的路由，並在執行中的 proxy 不是 Codex 目前指向的那一個時發出警告。

| 子指令 | 動作 |
| --- | --- |
| `install` | 安裝 shim（若過時則修復）。 |
| `uninstall` | 移除 Unix 私有檔案，保留原生 Codex；Windows 上還原原始啟動器。 |
| `remove` | `uninstall` 的別名。 |
| `status` | 回報 shim 狀態及私有 wrapper 是否在 PATH 中啟用。 |

```bash
ocx codex-shim install
ocx codex-shim status
ocx codex-shim uninstall
```

:::note[Windows token 環境]
新產生的 Windows CMD 與 PowerShell shim，會在執行後還原呼叫者的 `OPENCODEX_API_AUTH_TOKEN`。
Codex 及其子行程仍可繼承該 token。

更新 OpenCodex 後，請用 `ocx codex-shim uninstall` 接著 `ocx codex-shim install`，重新建立
既有的 Windows shim，以取得這個行為。一般的更新不會重寫一個健康的 Windows shim。
:::
Unix 解除安裝後，請從 shell 啟動檔移除載入行，並重新啟動 shell 或從 PATH 移除私有 bin。只移除屬於 OpenCodex 的 wrapper、shell 環境檔與狀態，套件管理器啟動器保持不動。舊的 Unix 就地 shim 會利用已記錄的還原資訊解除包裝。

:::tip[服務 vs Shim]
使用 `ocx service` 作為常駐背景代理（推薦）。使用 `ocx codex-shim` 作為輕量、按需啟動而無 daemon——代理僅在 `codex` 啟動時才啟動。
:::

#### 把 token 注入 Codex

在非回送綁定上，注入的 provider 帶有 `env_key = "OPENCODEX_API_AUTH_TOKEN"`。這一行告訴 Codex
要讀取哪個變數；它不會建立這個變數。當該變數缺失時，Codex 會拒絕開始一次請求
（`Missing environment variable: OPENCODEX_API_AUTH_TOKEN`），proxy 也永遠不會被連到。這個值
存放在 `$OPENCODEX_HOME/service-api-token`；啟動的程序必須自行把它放進 Codex 的環境中。

請使用由 `ocx codex-shim install` 安裝的、有維護的 shim。當啟動情境解析到這個 shim 時，它會
讀取 OpenCodex 建立的 token 檔案，並把這個變數提供給 Codex。桌面、cron 與服務啟動方式，都
必須使用一個會選中這個 shim 的 `PATH` 或 launcher 路徑；安裝本身不會自動設定那些環境。Codex
自己的子行程仍可能繼承這個 token。

請不要從 shell 啟動檔匯出這個 bearer token，也不要把它複製進 `config.toml`。
`service-api-token` 檔案裡存放的是原始 token，不是 `NAME=value` 賦值形式，所以它不能直接當成
systemd 的 `EnvironmentFile=` 使用。

`opencodex-proxy.service` 上的 `EnvironmentFile=` 或 `OCX_API_TOKEN_FILE`，只會設定 proxy
本身的行程，絕不會流入一個獨立啟動的 `codex exec`。

一次取代 launcher 的 Codex 升級會移除 shim；下一個普通的 `ocx` 指令會還原它（見上文），但在
那之前執行的 `codex exec` 會失敗。`ocx doctor` 會在「Codex env_key launch readiness」底下回報
這個確切狀態（env_key 已設定、變數未設定、shim 缺失或不健康、token 檔案存在），並附上修復
指令，且絕不會印出這個 token。讀取這個 token 檔案不屬於已注入的 `env_key` 合約的一部分；啟動
的程序必須自行提供那個變數。

### `ocx tray <install|start|stop|status|uninstall|remove> [--json] [--no-start]`

安裝並控制 Windows 狀態列圖示。它在 Windows 登入時啟動並提供一鍵代理控制。`start` 與 `stop` 僅控制圖示；請用其選單控制代理。`--no-start` 適用於 `install`，並在不立即啟動它的情況下安裝 tray。
已淘汰：OpenCodex 桌面應用程式在 Windows、macOS 與 Linux 提供系統匣；沒有桌面應用程式的安裝仍可使用 `ocx tray`。
得知有較新的套件版本時，系統匣會在連線、警告或離線圖示上加上藍點，並顯示 **Update available**。系統匣約每分鐘檢查一次本機快取的徽章；結果過期或無法取得時會移除藍點。此選單項目會開啟儀表板，你可以在那裡開始套件更新。它不會自動安裝。

## 儀表板

### `ocx gui`

在 `http://localhost:<port>` 開啟[網頁儀表板](/zh-tw/guides/web-dashboard/)——或在啟用管理 ingress 的
hub 上開啟 `http://127.0.0.1:<管理埠>`——若代理未執行則自動啟動它。

## 更新

`ocx update` 更新的是 OpenCodex 本身，而不是 Codex CLI。請使用[系統檢查指令](/zh-tw/reference/cli/agents/)，對已設定的 Codex CLI 候選項進行有界、唯讀的 provenance 檢查。`ocx system codex-cli-update check` 不會查詢 package registry，也不會安裝更新。

### `ocx update [--tag latest|preview]`

當 OpenCodex 由 mise 安裝時，此命令會在停止代理或修改套件檔案之前以失敗狀態結束，並使用經過驗證的本機 mise 別名顯示 `mise upgrade <tool>`。更新檢查仍可使用，並會回報該安裝由外部管理。無法讀取或不一致的 mise 擁有權中繼資料也會阻止修改，且不會猜測工具名稱；`--tag preview` 絕不會變更 mise 中設定的選擇。

在 Linux 上，若背景服務記錄的啟動器是 mise 的套件啟動器（`<tool>/latest/node_modules/.bin/ocx`，而非 mise shim），服務會自動跟隨 `mise upgrade`：新版本穩定後約十秒內，它會排空進行中的請求並在新版本上重新啟動；若 mise 之後清除了它正在執行的版本，也會以相同方式復原。在 macOS 上、透過 mise shim 安裝的服務以及前景代理，請在升級後自行重新啟動（macOS 上先執行 `ocx service repair`）。

從 npm 自我更新 opencodex。穩定安裝使用 `@latest`；預覽安裝停留在 `@preview`，除非你傳入 `--tag latest|preview`。它偵測原始碼 checkout 並告訴你改用
`git pull && bun install`，且若你已是該 tag 的最新版本則為 no-op。在停止任何東西之前，npm 安裝
會先執行一次有界的 Unix 快取擁有權與存取檢查。巢狀的符號連結會用 `lstat` 檢查但不會被跟隨；
Windows 明確略過這項僅限 Unix 的檢查。檢查失敗時，會在 tray 與 proxy 仍在執行的狀態下中止。
執行中的代理會在檔案被替換前停止；已安裝的服務會自動重建並啟動，而前景安裝會印出 `ocx start`
作為下一步。儀表板的更新紀錄在持久化之前，會遮罩設定檔／快取路徑與 UID/GID 值。

```bash
ocx update
ocx update --tag preview
```

當 [Release workflow](https://github.com/lidge-jun/opencodex/actions/workflows/release.yml) 將新版本發布到 npm 時，新版本即可使用。

## Save cleanup thresholds without starting a cleanup

```bash
ocx storage policy show --json
ocx storage policy set --archived-bytes-over 1073741824 --reduce-to-bytes 536870912 --json
ocx storage policy show --json
```

The setter writes nested `trigger.archivedBytesOver` and one target. Byte values
are safe nonnegative integers. Alternatively choose `--remove-oldest-percent 10`
or legacy `--percent 10`; the two percentage flags and reduce-to are mutually
exclusive. CLI percentages are integers with server-supported range 1–100.
Omitted `--enabled` leaves the stored value unchanged; explicit values are `true`
and `false`. Set does not run cleanup, but an already-enabled schedule remains
in force. Do not add enable or an immediate policy run unless intended.

The new-field receipt is `{ok:true,policy,job:{status}}`, with observed trigger,
target, mode, schedule and optional last/next-run facts. `job.status` describes an
existing idle/running state, not a cleanup started by this command. Read back on
an unknown outcome rather than replaying the write.

## Remote Link apply parity

A Remote Link Child applies its Home's OpenCodex-owned Codex settings when it is linked
(`ocx link add` on the Home) and on every `ocx sync`. Three facts let a peer check that the
Child really runs under the settings it applied, without reading either machine's configuration.

`ocx status --json`, on any device, carries:

| Field | Meaning |
| --- | --- |
| `appliedCodexSettingsDigest` | Lowercase hex SHA-256 of the applied settings (below). On a Child, the values its last recorded apply wrote. On a Home or standalone install, the settings document it serves its Children right now, computed from its current configuration. `null` on a hub client, on a Child with no recorded apply, and on a Child whose apply of changed settings is in progress or failed (the previous digest is withdrawn first, so it is never reported for values Codex no longer has). |
| `lastApplyAt` | Child only: epoch milliseconds of the last successful apply that changed the applied settings. Re-applying the same values is not a new apply and keeps it, so an unchanged `ocx sync` never forces a restart. `null` elsewhere. |
| `runtimeStartedAt` | Child only: epoch milliseconds the running client runtime started. `null` when no client runtime answers. |

The digest is computed over this compact UTF-8 JSON, with the keys in exactly this order and no
whitespace, from the values actually applied:

```json
{"version":1,"settings":{"fastMode":true,"multiAgentMode":"v1","webSearchSidecarEnabled":false,"subagentDefaults":null}}
```

`subagentDefaults` is `null` when unset, otherwise `{"model":…,"reasoningEffort":…}` in that order.
The example above hashes to `57c751eff89844f93db71a6ee4acdac03afbc29fec52734ade80a40193e826cd`. The digest
never contains a setting value, and the Home's name and version are not part of it, so a Home and
a Child that applied the same values report the same digest.

On the Home, every row of `ocx link status --json` carries what that Child last reported:
`lastApplyAt`, `runtimeStartedAt`, `appliedCodexSettingsDigest` (same meanings as above) and
`reportedAt` (epoch milliseconds, the Home's clock). A linked Child reports shortly after its runtime
starts and then once a minute; the Home keeps reports in memory only, so after a Home restart the
fields read `null` until the next report. A Child whose runtime started before `lastApplyAt` is
running an older runtime than its last apply.

After `ocx sync` applies the Home's settings on a Child, it restarts the Child's client runtime when
that runtime started before `lastApplyAt`, using the same restart as `ocx restart`. A runtime that
already started after the apply is left alone, nothing is started when no client runtime is
running, and a failed restart exits nonzero while the previous runtime keeps serving; run
`ocx sync` or `ocx restart` again to retry. Two applies on one Child never interleave: a second
`ocx sync` while one is applying fails fast and changes nothing.

## Forced link revoke and remote recovery

Only when skipping remote cleanup is explicitly intended, use the actual selected
link ID (`lnk_0123456789abcdef` below is fictional):

```bash
ocx link revoke --link-id lnk_0123456789abcdef --force --yes --json
```

`--force` requires `--yes`; `--yes` alone is invalid. Ordinary revoke is unchanged.
A forced success returns `{linkId,remoteCleanup:"skipped",recovery}`. Idempotent
link-not-found instead reports `remoteCleanup:"unverified"`. Both can exit 0;
these facts derive from CLI intent, not a server cleanup report. Neither means
remote disconnect was attempted or confirmed. Follow the recovery instruction,
`ocx disconnect` on the remote client, when that action is authorized.

## Observe Remote Workspace from the Hub

```bash
ocx remote-workspace hub status --json
ocx remote-workspace hub runtimes --json
ocx remote-workspace hub sessions --json
```

These fixed management reads are separate from executor-local
`ocx remote-workspace status`. Runtime availability is a keyed object; an available
Hub with no devices/sessions is empty success. Disabled Hub observation can arrive
as HTTP 200 with `available:false` yet exits 1; it is not empty success. Inner
HTTP 409 exits 5. Reads never enroll devices, create sessions or submit prompts.
See [Hub observation and recovery](/zh-tw/guides/remote-workspace/#inspect-the-hub-without-starting-a-session).

## Remote Hub 用戶端生命週期

使用 `ocx connect <url> --pairing-code-stdin`、`ocx connect status`、`ocx sync` 與 `ocx connect rotate --pairing-code-stdin`。初次目錄下載會在五秒內沒有收到任何位元組時失敗，但進行中的傳輸可以執行更久；使用 `--catalog-timeout <seconds>`（1–120）可覆寫這個不活動時間窗。`ocx disconnect` 可離線還原本機狀態，但不會撤銷 hub 金鑰。仍連線時，`ocx connect revoke --admin-token-stdin` 會撤銷已保存的 `apiKeyId`；中斷後請使用 hub 的 **Integrations → API Keys**。秘密值只能透過 stdin 傳遞，不能放入 argv。

## Setup 連接埠驗證

`ocx init` 接受 1–65535 的 TCP 連接埠，且必須是十進位整數。按 Enter 使用 10100。像 `0`、`10100oops` 或 `1.5` 這類無效輸入絕不會被悄悄取代或截斷；setup 會回報並再次詢問連接埠。

## Login registration diagnostics

On Linux, `ocx service install` checks `loginctl show-user <current-user> -p Linger` before printing boot advice. Enabled linger is reported as already enabled. Disabled linger gets the `loginctl enable-linger $USER` hint; missing or unreadable diagnostics state the uncertainty and do not fail installation.

On macOS, `ocx service status` distinguishes a loaded Desktop login item from a valid enabled registration awaiting the next login. `ocx status` credits the latter in restart safety when the same Desktop app currently supervises the proxy. An incorrect plist label or command, a disabled entry, an unverified load probe, or changed process identity still cannot earn protection.

## Custom Codex provider consent

`ocx codex-provider status` lists the provider IDs approved for the selected Codex home.
`ocx codex-provider allow <id>` asks before allowing URL-only management on start/sync;
`--yes` is explicit noninteractive consent for that named provider.
`ocx codex-provider revoke <id>` restores an unchanged managed URL and revokes permission.
These commands are local and do not require a running proxy. See
[custom provider routing](/zh-tw/guides/codex-integration/#opt-in-a-custom-provider-to-managed-local-routing)
for eligibility, restore behavior and transport preservation.
