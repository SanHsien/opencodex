---
title: CLI 生命週期
description: 安裝、啟動、停止、服務、診斷、同步與更新指令。
---

這些指令安裝、執行、檢查、修復並更新本機 opencodex 代理及其 Codex 整合。

內部 Codex 探測與輔助命令會設定 `OCX_SHIM_BYPASS=1`。自訂 Codex wrapper 必須遵守此變數，跳過 `ocx ensure`，版本與說明查詢也應直接執行 Codex。

## 啟動服務前先探索

`ocx help`、`ocx help <family>` 與 `ocx help <family> <leaf>` 皆為離線。
精簡的根說明不夠用時，請使用 `ocx help --all`。說明、本機設定驗證與本機 Lab 檢視都不需要啟動 proxy。

執行即時管理流程之前，先執行 `ocx ready --json` 與 `ocx status --json`。
就緒狀態會區分 `pending`、`failed` 與 `unreachable`；只有 `ready: true` 才確認已就緒。
請檢查目標與 `versionSkew.relation`：`unknown` 不能證明版本相符。版本不一致時，應先釐清要使用的安裝，
而不是反覆對較舊的伺服器嘗試較新的旗標。

輸出與結束碼慣例依指令而異。`ready` 與 `resolve` 以 64 拒絕無效引數，而 `doctor --json` 不受支援，會以 2 結束。
本機儲存成功或重新啟動請求被接受，都不能證明已收斂；請在要求的操作之後讀取指令收據並重新檢查狀態。

即時目標探索找不到 proxy 時，政策／目錄指令、金鑰範圍的用量與 Aside 設定檔同步會回報：
“Proxy is not running. Start the intended proxy with: ocx start. No request was sent.”
已送出的管理請求仍可能有不確定的寫入結果；重試之前請先從預期目標讀回。舊式用戶端整合的拒絕訊息，
會依拒絕原因附上固定的復原指引（絕不使用寫入者自己的文字）；備份與殘留復原的通知仍然可用。

`ocx system update run --yes` 會輸出已接受的工作 ID 與觀察到的工作狀態。請接著用
`ocx system update status <job-id>` 追蹤；被接受不代表安裝或重新啟動已成功。`--json` 會保留完整的伺服器回應。

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

### `ocx stop [--json] [--deadline-ms <ms>]`

無人監督的 Link Child 處理結束訊號時，會在每次寫入前核對連線，並在關閉接聽器前還原 Codex 原生設定及受管理的 Grok。服務/Desktop、sibling、重新啟動交接和父程序 stop 收據會保留設定。結束中的重新啟動要求回傳 `409 runtime_stopping`。強制終止可能略過訊號處理，仍需父程序 `ocx stop` 的還原路徑。

停止執行中的代理（依 PID）、移除 PID 檔案，並還原原生 Codex。若已安裝受管背景服務，`ocx stop` 也會先停止它，使其無法重新生成代理。網頁儀表板側欄的代理拉桿拉到底時，在多數後端執行相同動作（`POST /api/stop`），但 Windows 工作排程器除外：工作結束後包裝程序仍可能重新啟動 Proxy，因此儀表板會以 `respawnable_service` 拒絕、不做任何變更，並請你改用 `ocx stop`。

對已連線的 hub 用戶端，`ocx stop`（包括成功的 API 停止）會保留連線擁有的 Codex 路由、目錄和 Grok 設定，`ocx start` 會再次提供服務。明確停止 Remote Link Child 時，若共用設定還原成功，則會還原原生 Codex 路由、目錄與已備份的續接歷程中繼資料，並移除受管理的 Grok 設定。已儲存的 Home 連線會保留，可用 `ocx disconnect` 移除。

要在還原後再次從 Codex 使用 Home，請先執行 `ocx start`（已安裝服務時使用 `ocx service start`），再執行 `ocx sync --restart-codex`。僅啟動不會重新套用路由；sync 不會重新建立 Grok 設定區塊。若在停止服務前無法確認連線擁有權，停止 API 會回傳 HTTP 409 與 `sharedTeardown: "refused"`，並讓 Proxy 與服務管理員繼續執行。請等待進行中的連線或中斷連線作業完成後再試。

### `ocx restart`

一般情況下，代理正在執行時，指令會向身分已驗證的特定 PID 與連接埠請求原地重新啟動，等待正常排空，並確認同一連接埠上出現不同的執行階段 PID。此路徑會保留受管路由與服務監督；若請求結果不確定，不會將其重試為獨立的停止與啟動。只有代理未執行時，才會回退至一般的 `ensure` 啟動。

若目前 CLI 比已驗證的獨立 POSIX 代理新，且符合嚴格的擁有權與監督條件，受保護的更新路徑會停止舊代理，確認其已停止後才從目前的安裝啟動新代理；此路徑不同於上述原地重新啟動。若資格或停止狀態無法確認，指令會回報失敗。條件與其他情況請參閱[重新啟動參考資料](/zh-tw/reference/cli/lifecycle/#ocx-restart)（英文）。

如果更新後的重新啟動回報執行階段紀錄中的主機名稱為空白，這次嘗試不會停止代理。請參閱[狀態與復原指引](/zh-tw/reference/cli/lifecycle/#狀態與健康)，先確認擁有權與實際綁定位址；若確認不完整，請洽擁有者或管理員。

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

當 `ocx uninstall` 以 root 身分或在已提升（系統管理員）權限的 Windows 提示字元中執行時，會先確認其他帳號無法變更設定目錄、其上層目錄以及其中的任何目錄，並確認設定目錄內沒有指向其外部的連結（在 Windows 上則是完全沒有連結）。只要有一項不符合，解除安裝就會在做出任何變更之前停止並說明原因。請以擁有設定目錄的帳號、不使用 `sudo` 或系統管理員權限執行 `ocx uninstall`，或將這些目錄限制為僅該帳號可寫入並移除此類連結，然後再次執行。在無法判斷提示字元是否已提升權限的 Windows ARM64 上也會進行相同檢查；若檢查無法完成，請先停止 opencodex，再手動移除設定目錄。

若某個已記錄項目在設定目錄內的上層目錄是連結（符號連結或連接點），該項目會保留原樣並列為剩餘路徑，本次執行以部分解除安裝結束。將該連結換成實際目錄或將其移除後，再次執行 `ocx uninstall` 即可完成。

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

根健康檢查是存活探針。系統健康檢查則是另一個管理觀察：
`{status:"ok",service:"opencodex",version,uptime,pid,spendLedger}`，其中 uptime 以秒計。
`system status` 仍是其設定／啟動／記憶體的彙總。有效的系統健康觀察即使支出日誌處於降級狀態也以 0 結束。
請讀取擁有權（held／unheld）、initialized、configured、degraded、persistFailures 與 corruptRecords；
狀態 ok 並不保證每個子系統都健康。失敗或格式錯誤的讀取仍以非零結束並輸出安全的 stderr，不會捏造健康的資料。

對於有界的診斷，[請求／注入追蹤](/zh-tw/reference/cli/agents/#追蹤請求視窗或注入序列)
遇到錯誤或偵測到目標變更時會停止，而不是自動重新連線。SIGINT 以 130 結束、SIGTERM 以 143 結束。
有版本的日誌事件只能重建已觀察到的視窗，無法還原輪詢之間遺漏的流量；注入 seq 無法排除重新啟動／逐出造成的缺口。

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

### `ocx sync [--expect-link <linkId> | --expect-hub-key <apiKeyId>] [--local-only] [--json] [--restart-codex] [--restart-app-server-only] [--child <linkId>]... [--restart-children[=app-server] | --restart-children=codex --yes]` <span id="ocx-sync---restart-codex---restart-app-server-only"></span>

在 Remote Link Home 上成功提交最新目錄後，`ocx sync` 也會向符合條件的已連結 Child 同步。`--local-only` 可停用這個傳播。`--json` 會輸出單一 `ocx.sync.fanout/1` 文件，包含 Home 的結果與各 Child 的狀態；遭略過的 Child 也會顯示原因。Home 自身的非零結束碼會原樣回傳。Home 成功時，若傳播時略過已連結的 Child，或 Child 失敗、逾時或連結儲存區無法讀取，指令以結束碼 6 結束。用戶端發起的連結和 `--local-only` 等刻意略過的情況保留原有行為；遭略過的已連結 Child 會附帶操作建議 `hint`。文字模式下，連結儲存區無法讀取的錯誤不包含路徑。結束碼 7 保留給進行中的更新。JSON 模式下若 Home 同步擲出例外，stdout 仍只包含一份結果文件，stderr 則輸出經安全轉義的診斷訊息。因 `--child` 未選取的連結（`not-selected`）以及正被 Child 操作占用的 Child（`child-busy`）同樣屬於刻意略過，不會產生結束碼 6；要求的 Child 重新啟動未能確定完成時，指令以結束碼 6 結束。

除非傳入 `--restart-children`（重新啟動 app-server）或 `--restart-children=codex --yes`（重新啟動 Codex 桌面應用程式，會結束進行中的對話，並需要該機器上已登入的桌面工作階段），傳播不會要求重新啟動 Child 上的 Codex。Home 會先同步每個選取的 Child，再重新讀取該 Child 的活動狀態，然後才透過第二次固定目標同步送出重新啟動。對於此刻正在中繼模型請求的 Child（`restart-skipped:link-active`）、無法讀取活動狀態的 Child（`restart-skipped:activity-unknown`）、Windows Child（`restart-skipped:windows`）以及 `ocx-child`（`restart-unsupported:ocx-child`），Home 照常同步、只略過重新啟動，並以結束碼 6 結束。未記錄 Child 類型的連結仍會在第二次同步中收到重新啟動旗標，Home 藉此得知它執行的是 `ocx-child`；`ocx-child` 會忽略該旗標。如果重新啟動未能送出，或已送出但結果未知，該 Child 的列會顯示 `restart-not-run` 或 `restart-result-unknown`，結束碼同樣為 6。與 `ocx link restart-codex` 相同，這項保護是盡力而為：在讀取活動狀態與重新啟動之間開始的請求仍可能被中斷。`--child <linkId>`（可重複）只向這些連結傳播，其餘連結回報為 `not-selected`。正被 `ocx link update` 等 Child 操作占用的 Child 會以 `child-busy` 略過。不過，Child 的固定目標同步在套用變更後的 Home 設定時，仍可能重新啟動它自己的 OpenCodex 用戶端執行階段。Home 逾時並停止本機 SSH 程序後，已開始的遠端同步仍可能在 Child 上繼續。

> **Remote Link Child：** 在完整 `ocx` Child 上，`ocx sync` 也會套用 Home 的 Codex 設定並在用戶端執行階段早於該次套用啟動時重新啟動它；重新啟動失敗時原有執行階段會繼續提供服務並以非零狀態結束。在輕量級 `ocx-child` 主機上，`ocx-child sync` 會在中繼未執行時啟動 `ocx-child serve`，在 `runtimeStartedAt < lastApplyAt` 時輪替程序，並在非 `stale` 同步時盡力回報 parity（若輪替失敗，舊中繼已停止且指令以非零狀態結束；Codex 桌面應用程式與長期執行的 `app-server` 程序如需重新載入請單獨重新啟動）。Child 上的 `ocx status --json`（或 `ocx-child status --json`）與 Home 上的 `ocx link status --json` 相關欄位請見 [Remote Link apply parity](/zh-tw/reference/cli/lifecycle/#remote-link-套用一致性)（英文）。 在 Home 上，`ocx link check (--link-id <id> | --all)` 透過 SSH 執行 `ocx update --plan`（每台 Child 60 秒，不修改安裝）讀取每個由 Home 新增的 Child 的已安裝版本和更新途徑，`ocx link status --json` 會為每一列加上 `child` 區塊；詳見 [Child install, catalog and activity](/zh-tw/guides/remote-link/#child-install-catalog-and-activity)（英文）。`ocx link sync`、`ocx link restart-codex --yes` 和 `ocx link update --yes` 會在這些 Child 上執行同步、Codex 重新啟動和更新工作，並輸出 `ocx.link.child-job/1` 文件；詳見 [從 Home 操作 Child](/zh-tw/guides/remote-link/#從-home-操作-child)。`ocx link policy` 讀取或變更 Home 的 Child 政策；目錄自動分發預設為開啟，Home 目錄變更後會透過 SSH 同步符合條件的 Child；請參閱 [目錄自動分發與 Child 政策](/zh-tw/guides/remote-link/#目錄自動分發與-child-政策)。

明確指定重新啟動旗標後，即使目錄和快取的位元組未變，成功提交 `config.toml` 變更也會觸發重新啟動。僅處理設定的操作若沒有變更、遭拒、只做預先檢查或寫入已回復，則不會觸發重新啟動。未指定重新啟動旗標時，sync 不會自動重新啟動 Codex。

從每個已設定的供應商擷取即時模型清單，並將合併後的目錄重新注入 Codex。在新增供應商後或要重新整理可用模型時執行它。

在供應商探索或目錄／快取替換之前，`ocx sync` 會先驗證受管的 Codex 設定是否可以被注入。
若該驗證拒絕該設定，指令會以非零狀態結束、在 stderr 印出具體原因，並讓既有的目錄與快取保持不變。
`ocx restore back` 在重新啟用路由之前，也使用相同的不寫入 preflight 檢查。

若長壽的 Codex `app-server` 仍在執行，`ocx sync` 會警告它們可能繼續提供先前的記憶體內模型清單，即使 `opencodex-catalog.json` / `models_cache.json` 已更新。傳入 `--restart-codex` 會重啟相符的 `codex … app-server` 與 `codex-code-mode-host` 進程，並在 macOS、Linux 與 Windows 上完全結束再重新啟動 Codex 桌面應用程式，讓模型選擇器重新讀取目錄。進行中的對話會結束。刻意避免廣泛的 `pkill -f codex` 比對。

`--restart-desktop-app` 是 `--restart-codex` 的已棄用別名。它仍然可用、會印出棄用提示，且不再僅限 Windows。

`--restart-app-server-only` 恢復先前的窄範圍行為：僅對目前使用者擁有的相符 app-server / code-mode-host 進程發送 `SIGTERM`，桌面應用程式保持執行（執行中的回合仍可能被中斷）。若與 `--restart-codex` 或 `--restart-desktop-app` 一起使用，窄範圍優先，因為失去進行中的對話無法復原，過期的選擇器可以。

當命令在 Codex 應用程式內部執行時，重啟會交給分離的 helper，此工作階段會隨應用程式一起結束。

**指定來源的同步。** `ocx sync --expect-link <linkId>`（Remote Link Child）與 `ocx sync --expect-hub-key <apiKeyId>`（hub 用戶端）只有在本機仍連線到該連結或使用該金鑰時才會同步。否則不會變更任何內容，也不會同步本機供應商，指令以結束碼 5 結束，stderr 最後一行為 `{"phase":"child_link_mismatch"|"hub_client_mismatch","reason":...}`。格式錯誤或重複的旗標以結束碼 2 結束。詳情請見[英文參考](/zh-tw/reference/cli/lifecycle/#僅從預期的-home-同步--expect-link-與---expect-hub-key)。

#### 僅從預期的 Home 同步：`--expect-link` 與 `--expect-hub-key`

```bash
ocx sync --expect-link <linkId> [--restart-codex]
ocx sync --expect-hub-key <apiKeyId> [--restart-codex]
```

腳本若先讀取 `ocx connect status --json` 再執行 `ocx sync`，就無法得知這期間機器是否已中斷連線，
或重新連結到另一個 Home；單純的 `ocx sync` 屆時會同步本機供應商或另一個 Home 的目錄。傳入你讀到的身分即可堵住這個缺口。
`--expect-link` 接受 Remote Link Child 的 `link.linkId`，`--expect-hub-key` 接受 hub 用戶端的 `apiKeyId`。
檢查在選擇同步路徑的同一把鎖之下執行，之後每一次寫入都綁定在通過檢查的那個連線上。

身分相符時，指令的行為就是上面所述的已連線同步。否則它不會變更任何東西（連其他指令會先執行的自動 Codex shim 修復也不做），
絕不同步本機供應商，以 **5** 結束，並先輸出一行人類可讀的訊息，接著在 stderr 的最後一行輸出一行 JSON：

```json
{"phase":"child_link_mismatch","reason":"other_link"}
```

`--expect-link` 的 `phase` 為 `child_link_mismatch`，`--expect-hub-key` 的 `phase` 為 `hub_client_mismatch`。

| `reason` | Machine state |
| --- | --- |
| `disconnected` | Not connected to any Home or hub |
| `invalid_state` | The client configuration or a connect marker cannot be read |
| `disconnect_pending` | A disconnect has started and not finished |
| `pending_operation` | A key rotation, a connect, or another sync is in progress (including one that holds the locks this check needs) |
| `hub_client` | `--expect-link` on a hub client |
| `link_client` | `--expect-hub-key` on a Remote Link Child |
| `other_link` / `other_key` | Connected, but to a different link or with a different key |

缺少或格式錯誤的值、重複的旗標，或同時使用兩個旗標，都會在讀取任何狀態之前以 2 結束。
檢查之後、擷取目錄期間才變更的連線，仍會像單純的已連線同步一樣失敗（結束碼 1，不寫入任何東西）。
沒有這些旗標的版本會忽略它們，因此請先檢查 `ocx --version`。

### `ocx sync-cache [--restart-codex] [--restart-app-server-only]`

使 Codex 的本機模型選擇器快取失效，使其從現用的 opencodex 目錄重建。與 `ocx sync` 相同的過時 `app-server` 警告與可選重啟旗標適用。

### 目錄寫入診斷

目錄寫入稽核會把有界的診斷記錄在 `CODEX_HOME` 下的 `opencodex-catalog-audit.jsonl`。
目錄或快取沒有變更時不產生事件；稽核失敗不會讓目錄發布失敗。

在 Windows 上，**最多只記錄成功建立新檔案的那一次事件**。檔案先以空白建立並完成強化，之後才寫入診斷資料。
之後所有事件都會略過既有檔案，無論在同一個程序內或重新啟動之後。強化失敗可能留下空檔案，之後的事件同樣略過它。
為了稽核，不會變更既有檔案及其 ACL，包括由另一個 OpenCodex home 擁有該目錄時。
這是以隱私優先的備援，不是完整的 Windows 稽核串流；此稽核路徑的原生 NTFS 行為尚未驗證。

POSIX 的稽核會持續附加並保留有界的記錄。Windows 的限制不會停用目錄保護或擁有者修復。
位於另一個 `CODEX_HOME` 的稽核檔案仍屬清理殘留，因為設定的解除安裝清單無法宣告其根目錄以外的路徑。

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

在 Windows 工作排程器上，即使外部工具以結束碼 0 終止 proxy，服務包裝程式也會在五秒後重新啟動它。
若另一個 opencodex proxy 已佔用該連接埠，包裝程式會刻意結束。請使用 `ocx stop` 或 `ocx service stop`
來停止服務及其重新啟動迴圈。升級既有安裝之後，請執行 `ocx service repair` 以更新產生的包裝程式。

把 opencodex 作為登入管理的背景服務執行（macOS **launchd**、Linux **systemd user unit**、Windows **工作排程器**），
登入時自動啟動並在當機時自動重新啟動。服務執行時會設定 `OCX_SERVICE=1`，使重新啟動不會擾動 Codex 設定。

Windows 工作排程器的安裝使用一般的程序優先順序（`Priority=4`）。較舊的背景優先順序（`7`，省略時也是排程器預設值）
在 CPU 競爭下可能延遲 proxy 的健康回應，使系統匣在程序仍存活時顯示離線。升級後，請執行 `ocx service repair`
以遷移該已登錄的優先順序並重新啟動服務。此遷移可能要求 UAC 核准；優先順序已是一般或高時，本身不會觸發取代。

Windows 包裝程式支援含括號的地區日期格式，包括韓文與日文日期格式。升級後，請執行 `ocx service repair`
以取代在這些地區設定下會於啟動 Bun 之前就結束的舊版產生包裝程式。

Windows 包裝程式在每次啟動嘗試之前，都會驗證其內建的 Bun 執行階段與 CLI 進入點。若中斷的套件更新移除了其中任一檔案，
它會記錄一則 `installation is incomplete` 訊息並停止，而不是每五秒重試同一個不存在的執行檔。請重新安裝 opencodex，
再執行 `ocx service repair`，以還原後的套件路徑更新該工作。

服務定義會從已儲存的 `PATH` 中省略 shell 本地的版本管理器 multishell 目錄。這包括以 `ocx service install --native`
安裝的原生 Windows 服務；請執行 `ocx service repair`，以具持久性的 `PATH` 重新產生較舊的 WinSW 定義。

在 Linux 上，systemd unit 會呼叫安裝時在 `PATH` 中找到的第一個一般、可執行的 `ocx` 檔案，而不是已安裝套件樹內的 Bun 與 CLI 路徑。
**mise** 與 **asdf** 等版本管理器會安裝到有版本的目錄，並在升級時刪除舊目錄；它們穩定的 shim 讓 unit 持續能解析。
沒有 `ocx` launcher 的原始碼 checkout 維持直接的 Bun + CLI 形式。在 Bun 啟動之前選定的受信任 `OPENCODEX_BUN_PATH`
會透過 shim 保留；套件內建的 Bun 路徑會在升級後重新探索。

在 macOS 上，launchd 則使用安裝或修復期間選定的套件內 Bun 與 CLI 路徑。這可防止可變動的 PATH shim 在之後重新啟動時收到服務 API 權杖與已設定的 proxy 環境。
升級版本管理器安裝之後，請在重新啟動服務之前先執行 `ocx service repair` 以更新這些路徑。
Launchd 會在當機或重新啟動交接失敗後重新啟動 proxy，但當服務因桌面應用程式擁有執行階段而刻意乾淨結束時，則維持停止。
請執行一次 `ocx service repair`，把這個行為套用到較舊版本安裝的服務。

在此變更之前安裝的定義仍帶有舊的版本化路徑，無法自行遷移——舊執行檔一旦被刪除，就沒有任何 opencodex 程式碼能執行來修正它。
請在升級後執行一次 `ocx service repair`。Linux 服務隨後會依循 launcher 啟動；macOS 的修復則會把新的套件路徑寫入 launchd 定義。
外部升級不會取代已在執行的 proxy：當已安裝的 CLI 比執行中的 proxy 新時，請執行 `ocx service restart` 讓新版本提供服務。
在 macOS 上，`repair` 在此並不夠用：定義沒有變更，而沒有變更的修復不會重新載入任何東西。
若是 proxy 比較新，請依 [`ocx status`](#ocx-status---json) 所述檢查 CLI 安裝與 `PATH`。

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

在 Windows 上，單純的 `ocx service` 只有在工作排程器與 WinSW 都確認不存在時才會執行安裝路徑。若任一狀態查詢無法下結論，
它會拒絕註冊任何東西並要求你執行 `ocx service status`；請在確認不存在之後才使用明確的 `ocx service install`。

### 執行期所有權

OpenCodex 桌面應用程式可以從 CLI 安裝接手背景 proxy。接手時，它會把交接記錄在共用的服務安裝狀態中，這筆記錄讓接手在重新啟動後仍然有效。
你的服務註冊會**被保留，絕不會被刪除**——記錄是取代它而不是替換它。

沒有擁有權記錄的狀態檔表示由 CLI 安裝擁有執行階段，這個功能出現之前的所有安裝都是如此。在應用程式接手之前，你不會看到任何變化。

受監督的服務子程序在啟動之前，以及在持有啟動擁有權租約、選擇連接埠或發布 PID 之前，都會再檢查一次記錄的擁有者。
若桌面應用程式在啟動期間宣告擁有執行階段，即使桌面 proxy 尚未開始監聽，服務子程序也會退讓。無法讀取的擁有權記錄有相同的退讓行為。

狀態記錄內的 Home 路徑，會依其實際解析到的實體目錄與目前的 home 比較，而不只是比較拼法。
記錄在較舊安裝下的 junction 或 symlink 仍指向同一個 home，搬移後仍可運作；無法再解析的別名，只有在其記錄的拼法也與目前的不同時才視為不同的 home，
因此過期的掛載點仍會產生外來擁有者的拒絕，而不是默默宣告取得執行階段。

當 CLI 以外的對象擁有執行階段時，會**啟用**你的註冊的子指令會拒絕執行：

| Subcommand | Behaviour under a foreign owner |
| --- | --- |
| `repair`, `restart` | Refuse before changing anything. The registration is not re-enabled, rewritten or restarted. |
| `start` | Refuses for the same reason, so an automatic tray start cannot put a second proxy beside the app's. |
| `stop`, `uninstall` | Unchanged. They deactivate, so they are never gated. |
| `install` | Takes the runtime back. It clears the ownership record after the registration succeeds, and reports whose it was. |

`ocx update` 的行為相同：應用程式擁有執行階段時，它既不會停止執行中的 proxy，也不會更新服務，
因為執行中的伺服器是應用程式自己內建的二進位檔，而更新會重新啟用已被接手取代的 launcher。應用程式會自行更新它的執行階段。

拒絕訊息會指出擁有的安裝與同意世代，例如：

```text
Background service repair stopped: the desktop app owns the runtime (install <id>, consent generation 2).
The service registration was left exactly as it is — not re-enabled, not rewritten and not restarted.
Quit the desktop app and run 'ocx service install' to hand the runtime back to this CLI.
```

無法讀取或無法解析的記錄會產生相同的拒絕，只是第一行不同，因為無法讀取的宣告不等於沒有宣告——
把它當成「沒有人擁有」，就是權限錯誤會默默重新啟用你的服務的原因。

**所有情況的復原方式都是 `ocx service install`。** 它刻意是唯一不受限制的動詞，
因此即使移除應用程式卻沒有交還執行階段，或狀態檔損毀，你仍有辦法把服務拿回來：

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

`install`、`start` 與 `repair` 在回報成功之前，都會確認確實有 proxy 在已安裝服務所寫入的連接埠上回應——三個平台皆然。
它們最多等待 20 秒，然後輸出提供服務的連接埠：

```
✅ opencodex service installed and serving on port 10100.
```

若沒有任何回應，它們會警告並**以非零結束**：

```
⚠️  Service installed, but no proxy answered on port 10100 within 20s.
   The manager registered the job; that is not the same as serving.
   Log:       ~/.opencodex/service.log
   Meanwhile: ocx start   (serves in the foreground)
```

此處的非零結束表示*已註冊但未提供服務*，而不是*未安裝*。服務管理員接受了這個工作；其背後的 proxy 從未綁定連接埠。
請讀取訊息中指名的日誌，並在期間使用 `ocx start` 於前景提供服務。

`ocx service status` 會回報相同的三種狀態，而不是原始的管理員輸出：

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

它不再輸出原始的 `launchctl list`／`systemctl status` 那一行；該行無論服務是在提供服務、沒有綁定任何東西，
或執行的是先前的定義，都會用相同方式回報已註冊的工作。`Diagnostics:` 那一行仍帶有日誌路徑與任何過期寫死路徑的發現。

在 Windows 上，排程器後端保留它自己較豐富的狀態輸出，該輸出原本就已把工作排程器的註冊與 proxy 的可連線性分開回報。

### 服務日誌

受管理的 proxy 會把 stdout 與 stderr 寫入 `~/.opencodex/service.log`（自訂 home 時為 `$OPENCODEX_HOME/service.log`）。
設定 `OCX_SERVICE` 時，`ocx start` 會在每一行主控台日誌（包括多行診斷）前面加上 UTC ISO-8601 時間戳記，
例如 `2026-10-14T03:04:05.678Z`。前景輸出與其他 CLI 指令維持既有格式。

服務會在啟動時以及每分鐘檢查日誌大小。超過 20 MiB 時，它會把最新的 20 MiB 複製到 `service.log.1`，
把先前的封存移到 `service.log.2`，並就地截斷使用中的檔案，讓服務管理員已開啟的附加 handle 仍可使用。
使用中的檔案在兩次檢查之間可能超過門檻；每個封存的上限為 20 MiB。輪替失敗不會停止服務。
複製後截斷可能遺失複製期間寫入的行，封存也可能從某一行的中途開始。既有的 Windows 包裝程式訊息維持其包裝程式格式。

在 macOS 上，這也涵蓋一個較隱微的失敗：`launchctl load` 會在 stderr 回報失敗卻以 0 結束，
因此沒有成功的載入過去會讓 launchd 繼續執行**先前**版本的服務定義，而指令卻印出打勾符號。
現在 `install` 在這種情況會明確失敗，並指出可清除過期工作的 `launchctl bootout` 指令。

在 Windows 上，`ocx service status` 會把工作排程器的註冊，與經過身分驗證的 OpenCodex proxy 可連線性分開回報。
它不會輸出在地化的 `schtasks` 表格，因此摘要在各種 Windows 字碼頁下都能讀取。
交易式備份復原會記錄固定的成功訊息，而不是備份目錄名稱；含有 shell 特殊字元的備份名稱不會在該日誌訊息中變成指令。

在 Windows 上，建立工作排程器項目需要提升權限。可辨識的在地化拒絕存取文字會沿用既有的引導路徑。
若該文字無法讀取，備援會要求自有的指令形狀 `/create /tn opencodex-proxy /xml <non-empty-path> /f`、狀態 1，
以及已確認為未提升權限的權杖；儀表板的 Startup Safety 動作隨後可自動要求 UAC。
若該備援無法判定權杖狀態，則保留原始的排程器錯誤。外來的工作與操作絕不可能發出自動提升權限的標記。
請核准儀表板的 UAC 提示，或在已提升權限的 PowerShell 視窗中重新執行 `ocx service install`。

全新安裝且已確認 OpenCodex 排程器工作不存在時，UAC 核准現在會在安裝程式停止任何既有 proxy 之前發生。
其唯一的註冊 XML 會暫存在 OpenCodex 設定根目錄之外、已強化 ACL 的私有目錄中，並且在不執行的情況下註冊工作。
只有在註冊成功之後，OpenCodex 才會移除該 XML、對真正全新的設定根目錄要求擁有權中繼資料、停止舊的 listener、
移除並以有界方式重新驗證任何原生 WinSW 註冊、發布服務資產，並啟動排程工作。
因此取消或拒絕 UAC，或無法安全宣告新的根目錄時，可運作的 proxy 及其 Codex 路由都會維持原狀。
既有或衝突的排程器註冊仍會失敗關閉，而不是被當成不安全的盡力回滾而刪除。

若啟動回報 `another process owns the runtime mutation lease`，或 `ocx service status` 顯示 `Runtime mutation lease busy`，
表示即使 proxy 沒有在執行，該租約也正阻擋啟動或服務變更。訊息包含鎖路徑、記錄的 PID、目前的存活狀態、
可取得時的執行檔名稱，以及租約年齡。程序身分並未驗證：該 PID 可能已被重複使用，因此存活狀態與執行檔名稱描述的是目前占用該 PID 的程序。
請等待操作完成後重試；不要只憑這個 PID 就刪除鎖或停止程序。之後的變更嘗試在租約年齡超過 30 秒且記錄的 PID 已不存在時，可以回收過期的租約；status 只會檢查它。

在 Windows 上，這個共用的 Node/Bun 診斷不會啟動執行檔來查詢映像名稱；記錄的 PID、存活狀態、租約年齡與復原指引仍然可用。

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

在 `http://127.0.0.1:<port>` 開啟[網頁儀表板](/zh-tw/guides/web-dashboard/)，若代理未執行則自動啟動它。在啟用管理 ingress 的 hub 上，開啟的是 `http://127.0.0.1:<管理埠>`。

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

#### 協調式更新

自動化可用 `ocx capabilities --contracts --json` 探索支援情況；`contracts` 陣列包含 `update.orchestrated/1`。
僅合約選項不能與 `--route` 或 `--mutating-only` 合用。

```bash
ocx update --plan --json [--tag latest|preview | --version <version>]
ocx update --yes --json [--version <version>] [--expect-plan <token>] [--not-after <unix-ms>]
```

Plan 會輸出一個 `ocx.update.plan/1` JSON 物件：`currentVersion`、`targetVersion`、`installer`、`runtimeOwner`、
`servingPath`、`cliPath`、`canApply`、選用的 `reason`、`restartRequired`、`planToken`、`updateInFlight` 與 `mutationBoundMs`。
計畫是唯讀的。原因包括 `desktop-app-owned`、`source-checkout`、`mise-managed`、`installer-unknown`、`plan-unavailable`、
`serving-install-unknown`、`cli-not-serving-install`、`runtime-ownership-refused`、`target-unresolved`、`downgrade-refused` 與 `up-to-date`。
`desktop-app-owned` 會把更新導向 Desktop 應用程式；無法確定提供服務的身分時會拒絕，而不是猜測。
再次規劃之前，請執行 `ocx start` 或 `ocx stop` 來處理過期的執行階段記錄。

Apply 會輸出一個 `ocx.update.result/1` 物件，包含 `applied`、`fromVersion`、`toVersion`、`installer`、`restarted`、`healthy`、`rolledBack`，
以及選用的 `error`。把計畫的 `planToken` 當作 `--expect-plan` 傳入，若所選的安裝或執行階段身分改變，就會以 `plan-changed` 拒絕。
`--not-after` 是正的安全整數 Unix 毫秒時間戳；超過該時間後，變更會以 `deadline-passed` 被拒絕。
`mutationBoundMs` 是 900000（15 分鐘）：逾時會回報不確定的結果，而不會終止進行中的交易。
只要更新仍可能變更內容，`updateInFlight` 就維持為 true，包含無法判斷其狀態的情況；單獨的同步不會設定它。
並行的同步可以用 `sync-in-progress` 拒絕套用，另一個更新則可用 `update-in-flight` 拒絕。

協調式 apply 在已驗證或已是最新時以 0 結束，拒絕時為 10，更新失敗但先前版本已驗證為使用中（必要時包含執行階段）時為 11，
結果未驗證或仍在執行時為 12，用法無效則為 64。只有在實際的安裝程式回復及其驗證成功時，`rolledBack` 才為 true。
plan 指令會輸出其計畫並以 0 結束；`canApply` 與 `reason` 欄位描述資格。

編譯後的獨立安裝（包含 Windows MSI 的 Desktop 套件），要透過 OpenCodex Desktop 的**檢查更新…**，或重新安裝獨立執行檔（取自 [GitHub Releases](https://github.com/lidge-jun/opencodex/releases)）來更新。`ocx system update check` 會回報 `installer: "standalone"`、`canUpdate: false` 與 `reason: "standalone_install"` 並附上該指引。`ocx update` 會以相同提示失敗結束；它不會對編譯後的執行檔執行套件管理員更新。真正的原始碼 checkout 仍回報 `installer: "source"` 與 `reason: "source_checkout"`。

透過 mise 安裝 OpenCodex 時，此指令會在停止代理或變更套件檔案之前失敗結束，並使用已驗證的本機 mise 別名顯示 `mise upgrade <tool>`。更新檢查仍可使用，並將該安裝回報為外部管理。無法讀取或不一致的 mise 擁有權記錄會封閉式失敗，不猜測工具名稱，而 `--tag preview` 絕不會改變 mise 設定的選擇。

在 Linux 上，記錄的啟動器是 mise 的套件啟動器（`<tool>/latest/node_modules/.bin/ocx`，不是 mise shim）的背景服務，會自行跟隨 `mise upgrade`：新版本穩定後約十秒內，它會排空使用中的請求並重新啟動到新版本；若 mise 之後修剪了它正在執行的版本，它也以同樣方式復原。在 macOS 上，透過 mise shim 安裝的服務以及前景代理，請在升級後自行重新啟動（macOS 上先執行 `ocx service repair`）。

從 npm 自我更新 opencodex。穩定版安裝使用 `@latest`；預覽版安裝除非你傳入 `--tag latest|preview`，否則維持在 `@preview`。
它會偵測原始碼 checkout，並改告訴你執行 `git pull && bun install`；若你已在該標籤的最新版本，則不做任何事。
在停止任何東西之前，npm 安裝會先執行有界的 Unix 快取擁有權與存取檢查。巢狀符號連結以 `lstat` 檢查但不跟隨；
Windows 會明確略過這項僅限 Unix 的檢查。失敗時會在系統匣與代理仍在執行時中止。
接著，執行中的代理會在檔案被取代之前停止；已安裝的服務會自動重建並啟動，前景安裝則會印出 `ocx start` 作為下一步。
儀表板的更新記錄會在儲存之前，遮蔽設定檔／快取路徑與 UID／GID 值。
當已停止的監聽器的字面 IP 位址會讓存活撥號被丟棄、而不是被拒絕（例如在 tailnet 上），更新程式會短暫嘗試綁定同一個位址與連接埠。
綁定成功可確認該瞬間監聽器不存在；綁定失敗或主機名稱探測無定論，仍會阻止更新。

在 Windows 上，Scoop 預設的 `nodejs` 與 `nodejs-lts` `npm` 安裝，在其 `current` 連接點留在 Node 應用程式目錄之內時，
可從使用者 home 目錄使用；預設的持久 `bin` 目錄也受支援。在該安裝內執行（包含其解析後的版本目錄或持久 `bin`）、
專案本機的 `npm`、`NO_JUNCTION` 版本目錄項目，以及 home 底下自訂的 Scoop 根目錄，仍被排除。

若安裝步驟失敗，先前的版本仍保持已安裝，其服務也會重新啟動；終端機輸出會指出下一步，
[Windows 上更新失敗](/zh-tw/troubleshooting/update-failed/)說明如何完成更新，以及失敗的嘗試可能留下的資料夾。

```bash
ocx update
ocx update --tag preview
```

[Release 工作流程](https://github.com/lidge-jun/opencodex/actions/workflows/release.yml)把新版本發布到 npm 之後，新版本才可取得。

## 儲存清理門檻但不啟動清理

```bash
ocx storage policy show --json
ocx storage policy set --archived-bytes-over 1073741824 --reduce-to-bytes 536870912 --json
ocx storage policy show --json
```

設定指令會寫入巢狀的 `trigger.archivedBytesOver` 與一個目標。位元組值為安全的非負整數。
也可以改選 `--remove-oldest-percent 10` 或舊式的 `--percent 10`；兩個百分比旗標與 reduce-to 互斥。
CLI 的百分比為整數，伺服器支援的範圍是 1–100。省略 `--enabled` 會保留已儲存的值；明確的值為 `true` 與 `false`。
Set 不會執行清理，但已啟用的排程仍然有效。除非有意為之，請不要加上 enable 或立即執行政策。

新欄位的收據為 `{ok:true,policy,job:{status}}`，附有觀察到的觸發條件、目標、模式、排程與選用的上次／下次執行事實。
`job.status` 描述的是既有的閒置／執行中狀態，不是這個指令啟動的清理。結果不明時請讀回，而不是重送寫入。

## Remote Link 套用一致性

Remote Link Child 會在連結時（在 Home 上執行 `ocx link add`）以及每次 `ocx sync` 時，套用其 Home 擁有的 OpenCodex Codex 設定。
有三項事實可讓對等端在不讀取任一台機器設定的情況下，檢查 Child 是否確實在它所套用的設定下執行。

任何裝置上的 `ocx status --json` 都帶有：

| Field | Meaning |
| --- | --- |
| `appliedCodexSettingsDigest` | Lowercase hex SHA-256 of the applied settings (below). On a Child, the values its last recorded apply wrote. On a Home or standalone install, the settings document it serves its Children right now, computed from its current configuration. `null` on a hub client, on a Child with no recorded apply, and on a Child whose apply of changed settings is in progress or failed (the previous digest is withdrawn first, so it is never reported for values Codex no longer has). |
| `lastApplyAt` | Child only: epoch milliseconds of the last successful apply that changed the applied settings. Re-applying the same values is not a new apply and keeps it, so an unchanged `ocx sync` never forces a restart. `null` elsewhere. |
| `runtimeStartedAt` | Child only: epoch milliseconds the running client runtime started. `null` when no client runtime answers. |

摘要是對下列精簡的 UTF-8 JSON 計算而得，鍵的順序必須完全一致、不含空白，並使用實際套用的值：

```json
{"version":1,"settings":{"fastMode":true,"multiAgentMode":"v1","webSearchSidecarEnabled":false,"subagentDefaults":null}}
```

`subagentDefaults` 未設定時為 `null`，否則依序為 `{"model":…,"reasoningEffort":…}`。
上例的雜湊為 `57c751eff89844f93db71a6ee4acdac03afbc29fec52734ade80a40193e826cd`。摘要絕不包含任何設定值，
Home 的名稱與版本也不屬於其中，因此套用相同值的 Home 與 Child 會回報相同的摘要。

在 Home 上，`ocx link status --json` 的每一列都帶有該 Child 最後回報的內容：`lastApplyAt`、`runtimeStartedAt`、
`appliedCodexSettingsDigest`（意義同上）與 `reportedAt`（epoch 毫秒，Home 的時鐘）。
已連結的 Child 會在其執行階段啟動後不久回報，之後每分鐘一次；Home 只把回報保存在記憶體，因此 Home 重新啟動後，這些欄位在下次回報前讀為 `null`。
執行階段早於 `lastApplyAt` 啟動的 Child，執行的是比其最後一次套用更舊的執行階段。

`ocx sync` 在 Child 上套用 Home 的設定後，若 Child 的用戶端執行階段早於 `lastApplyAt` 啟動，就會以與 `ocx restart` 相同的方式重新啟動它。
套用之後才啟動的執行階段不受影響；沒有用戶端執行階段在執行時不會啟動任何東西；重新啟動失敗時以非零結束，而先前的執行階段持續提供服務；
請再次執行 `ocx sync` 或 `ocx restart` 重試。同一個 Child 上的兩次套用絕不交錯：套用進行中再執行 `ocx sync` 會立即失敗且不變更任何東西。

## Remote Link 子節點證明

透過 Remote Link 子節點送出工作的對等端，可在子節點的 `ocx status --json` 中檢查另外兩項事實。
這兩個欄位在無法證明時都會省略，絕不會是 `null`。

| 欄位 | 意義 |
| --- | --- |
| `localCredentials` | `{count, generation}`。`count` 是這個安裝存放在這台機器上的供應商憑證數量：OAuth 帳號、供應商 API 金鑰槽位（包含已停用的項目，以及金鑰圈或環境變數參照）、Codex 帳號池記錄、原生 Codex `auth.json`，以及非使用中的原生 Codex 設定檔。連結金鑰、管理權杖與傳入的 API 金鑰不計入，Home 所服務的帳號也不計入。`generation` 是不透明值，每當儲存的憑證被新增、取代或移除就會改變，即使數量最後與開始時相同。只有在這台機器上的 OpenCodex 執行階段正在執行、且每個儲存區都完整讀取時才會回報。原生 Codex 設定的 `cli_auth_credentials_store` 不是 `file` 時會省略它。 |
| `link.connectionGeneration` | 在子節點上：不透明值，每當通往其 Home 的通道連線（包含保留同一連結的重新連線）以及任一執行階段重新啟動時都會改變。只有在子節點的執行階段就緒時才會回報。對於由 Home 啟動的連結，子節點從 Home 的簽署回應得知它，所以較舊版本的 Home 會省略它。 |

若子節點回報 `localCredentials.count` 為 0，且 `localCredentials.generation` 與 `link.connectionGeneration` 在一個請求前後都沒有改變，
表示該請求期間它沒有任何本機供應商憑證，也沒有觀察到通道重新連線。

對於由 Home 新增的連結，每一列也帶有 `tunnel`：`attempt`（自連結上次連線以來的 ssh 嘗試次數）、
`nextRetryAt`（下次排定重試的 ISO 時間，重試執行中或沒有待辦時為 `null`）、`lastTransition`（`{from, to, at, cause}`）
與 `lastFailure`（`{cause, at}`）。原因是 `auth`、`hostkey`、`forward`、`remote_forward_conflict`、`timeout`、`network`、
`unknown`、`spawn_failed` 與 `listener_unavailable` 之一。Home 把它保存在記憶體中，所以 Home 重新啟動後從空的開始。
`GET /api/link/status` 只有在以 `?diagnostics=1` 要求時才包含此欄位，因為較舊的 `ocx link status` 會拒絕它不認得的欄位。


## 強制撤銷連結與遠端復原

只有在明確打算略過遠端清理時，才使用實際選定的連結 ID（下方的 `lnk_0123456789abcdef` 為虛構）：

```bash
ocx link revoke --link-id lnk_0123456789abcdef --force --yes --json
```

`--force` 需要 `--yes`；單獨使用 `--yes` 無效。一般的撤銷不變。強制成功時回傳 `{linkId,remoteCleanup:"skipped",recovery}`。
冪等的「找不到連結」則回報 `remoteCleanup:"unverified"`。兩者都可能以 0 結束；這些事實來自 CLI 的意圖，而非伺服器的清理回報。
兩者都不代表已嘗試或已確認遠端中斷連線。請在獲得授權時，依復原指示在遠端用戶端執行 `ocx disconnect`。

## 從 Hub 觀察 Remote Workspace

```bash
ocx remote-workspace hub status --json
ocx remote-workspace hub runtimes --json
ocx remote-workspace hub sessions --json
```

這些固定的管理讀取與執行者本機的 `ocx remote-workspace status` 是分開的。執行階段可用性是以鍵為索引的物件；
可用但沒有裝置／工作階段的 Hub 是空的成功。已停用的 Hub 觀察可能以 HTTP 200 與 `available:false` 抵達，但仍以 1 結束；它不是空的成功。
內層的 HTTP 409 以 5 結束。讀取絕不登記裝置、建立工作階段或送出提示詞。
請見 [Hub 觀察與復原](/zh-tw/guides/remote-workspace/#inspect-the-hub-without-starting-a-session)。

## Remote Hub 用戶端生命週期

使用 `ocx connect <url> --pairing-code-stdin`、`ocx connect status`、`ocx sync` 與 `ocx connect rotate --pairing-code-stdin`。初次目錄下載會在五秒內沒有收到任何位元組時失敗，但進行中的傳輸可以執行更久；使用 `--catalog-timeout <seconds>`（1–120）可覆寫這個不活動時間窗。`ocx disconnect` 可離線還原本機狀態，但不會撤銷 hub 金鑰。仍連線時，`ocx connect revoke --admin-token-stdin` 會撤銷已保存的 `apiKeyId`；中斷後請使用 hub 的 **Integrations → API Keys**。秘密值只能透過 stdin 傳遞，不能放入 argv。

## Setup 連接埠驗證

`ocx init` 接受 1–65535 的 TCP 連接埠，且必須是十進位整數。按 Enter 使用 10100。像 `0`、`10100oops` 或 `1.5` 這類無效輸入絕不會被悄悄取代或截斷；setup 會回報並再次詢問連接埠。

## 登入註冊診斷

在 Linux 上，`ocx service install` 會在輸出開機建議之前檢查 `loginctl show-user <current-user> -p Linger`。已啟用的 linger 會回報為已啟用。停用的 linger 會得到 `loginctl enable-linger $USER` 提示；缺少或無法讀取的診斷會說明不確定性，且不會讓安裝失敗。

在 macOS 上，`ocx service status` 會區分已載入的 Desktop 登入項目，與等待下次登入的有效已啟用註冊。當同一個 Desktop 應用程式目前監督該 proxy 時，`ocx status` 會把後者計入重新啟動安全性。錯誤的 plist 標籤或指令、已停用的項目、未驗證的載入探測，或變更過的程序身分，仍然無法獲得保護。

## 自訂 Codex 供應商同意

`ocx codex-provider status` 會列出所選 Codex home 已核准的供應商 ID。
`ocx codex-provider allow <id>` 在允許於 start／sync 時僅以 URL 管理之前會先詢問；`--yes` 是對該指名供應商的明確非互動同意。
`ocx codex-provider revoke <id>` 會還原未變更的受管 URL 並撤銷權限。
這些指令是本機的，不需要執行中的 proxy。資格、還原行為與傳輸保留，請見
[自訂供應商路由](/zh-tw/guides/codex-integration/#將自訂供應商選擇加入受管本機路由)。

#### Windows 服務停止

Windows MSI 升級與修復會在 Restart Manager 檢查檔案占用前，呼叫已安裝舊版 CLI 的 checked `service stop`；停止失敗仍繼續安裝。安裝成功後只恢復既有且啟用的根排程 `opencodex-proxy`，解除安裝不執行這兩個動作。MSI 預設 `REBOOT=ReallySuppress`；回傳 3010 時需自行安排重新開機，被占用的檔案在此之前可能仍是舊版，重新開機後應確認執行版本。若停止後安裝失敗，先排除安裝錯誤，再手動啟動既有服務。

Windows 的 `ocx stop` 透過 checked stop 停止 Task Scheduler 或原生 WinSW：先結束工作，再只終止能以本 home 的 launcher／script 完整路徑、祖先關係與建立時間綁定的 wrapper，確認退出後才優雅停止代理。之後約六秒確認 port 未被重新占用且 wrapper 未重啟，避免迴圈在成功停止後重新啟動代理。

服務無法證明已停時，不向代理傳送停止請求、不還原用戶端設定，並回報失敗。JSON 保留 `outcome: "failed"`、`proxy: "unknown"`，另帶 `serviceStopReason`：

| 原因 | 意義與處理 |
| --- | --- |
| `access-denied` | 工作或 wrapper 終止被拒，請從提升權限終端執行 |
| `unbound-wrapper` | 路徑符合但無法綁定服務，請手動結束該 wrapper 後重試 |
| `evidence-unreadable` | 服務／行程或 port 證據讀不到，先查 service status |
| `unverified-budget` | 剩餘時間不足以確認停止，沒有修改；從終端重試 |

若本安裝的行程已退出但其他程式占用 port，停止仍成功，JSON 帶 `portHeldByForeign: true`。`serviceStopReason` 無資訊時省略；port 檢查執行過才帶 true／false 的 `portHeldByForeign`，不增加 outcome 種類。

`--deadline-ms <ms>` 從命令啟動起限制整輪停止時間；修改前會確認足夠容納最壞情況（已登記 scheduler 預設約 57 秒）。未指定時讀取 `OCX_STOP_DEADLINE_MS`，否則用 60 秒；macOS／Linux 忽略它們。

停止只結束現用執行個體，登入／解鎖觸發器保留；永久移除請用 `ocx service uninstall`。service stop／uninstall、完整 uninstall 與 install 都採同一停止契約；無法證明已停時，不刪除／取代工作，install 也拒絕被其他程式占用的 port。Windows Arm 尚不能終止 wrapper，需終止時回 evidence-unreadable，請手動處理後重試。

`ocx service stop` 與服務移除失敗時，輸出包含清除祕密與控制字元後的 `partA.reason` 與 `detail`，可用來辨識哪一步證據讀取失敗。
已知的本地化排程狀態（包含繁中「就緒」）會直接解析；未知狀態仍須在原預算內透過 PowerShell 備援確認，讀不到就拒絕確認停止。

`ocx service uninstall` 與完整移除都先執行 checked stop，再移除服務與 wrapper 檔案。即使排程已手動刪除，WMI 啟動的 wrapper 若是已驗明代理的祖先，且映像、完整腳本路徑與建立時間符合，仍屬 bound，可以被停止。缺少血緣證據的 unbound wrapper 不被終止，移除會拒絕。後面的 wrapper 殘留清理只刪檔，不終止行程；到了這個階段仍有可讀 wrapper、不可讀候選行程或讀不到行程表時，保留三個檔案並回 failed。

### 儲存狀態與同步分別讀取

模型、供應商、設定與 v2 回覆有不同完成契約。本機自訂模型儲存會盡可能同步；無代理仍儲存成功、`needsSync:true`、`sync.status:"not-attempted"`、exit 0。明確要求本機供應商 `--sync` 而無代理時，則在儲存後回非零。

設定使用 `catalogRefreshPending`，live v2／catalog 使用完整 `catalogRefresh` 結果。本機 v2 mode／keep-native 及有變更的 on／off 即使沒找到 port，也會嘗試既有同步；JSON 回報真實變更與證據，未確認或失敗時非零。threads／hints 與未變更的 on／off 不新增同步。

用同一目標的 `ocx v2 status --json` 或 `--live --json`、以及 `ocx system settings --json` 讀回。已儲存但 pending／unknown 不證明回滾，也不授權重送寫入。重設 grant 的 status 可能連上游，但不消耗或恢復 grant。

## 從 Home 操作 Child

```text
ocx link update (--link-id <id> | --all) --yes [--no-wait] [--json]
ocx link sync (--link-id <id> | --all) [--no-wait] [--json]
ocx link sync --link-id <id> (--restart-app-server-only | --restart-codex --yes) [--no-wait] [--json]
ocx link restart-codex --link-id <id> [--scope app-server|codex] --yes [--no-wait] [--json]
```


命令為 Home 發起的 Child 建立一個工作，以 `ocx.link.child-job/1` 文件回傳 `{schema, jobId, op, trigger, restart, state, createdAt, finishedAt, items}`。每項帶 linkId、alias、state、reason、startedAt、finishedAt，適用時另含 hint、版本、sync 結果與 restart 結果。restart 只接受一個 link；update、restart-codex 與 --restart-codex 需要 --yes。版本與平台限制見[從 Home 操作 Child](/zh-tw/guides/remote-link/#從-home-操作-child)。

exit 0 表示全部成功／up-to-date 且重啟已送出；--no-wait 的 0 只表示接受，需讀回結果。exit 6 包含 busy、offline、refused、owner-action、unsupported 或部分成功原因；exit 1 是 failed、uncertain、未知狀態、等待逾時或 Home 非回送綁定。exit 2 是引數錯誤，4 是未知 link／Home 不支援，5 是操作鎖、Child 發起的 link、沒有 link 或在 Child 執行。排隊時間不計入等待上限；工作持有 link 時刪除回 `409 link_operation_in_progress`。

## Home 的 Child 政策

```text
ocx link policy [--updates off|notify|auto-when-idle] [--catalog-fanout auto|manual] [--child-codex-restart never|app-server-when-idle] [--idle-after-minutes <1-60>] [--json]
```


此命令不啟動工作，也不回 child-job 文件。無旗標時讀取，有旗標時只改指定欄位。輸出每項一行或 JSON `{policy, warning}`。檔案損壞時 warning 為 `policy-file-invalid`，自動分發與更新保持關閉；儲存未指名的項目也保持關閉，需明確給 --catalog-fanout auto 與 --updates 才重新啟用。目錄分發預設開啟，Home 目錄變更後自動用 SSH 同步合格 Child。

exit 0 成功、2 引數錯誤、4 Home 不支援、5 runtime_role_client 衝突；1 為 Home 非回送綁定、無效回應或在 Remote Link Child 執行（送出前即拒絕）。

## Remote Link SSH 擷取

```text
ocx link capture start [--minutes <1-60>] [--json]
ocx link capture stop [--json]
ocx link capture status [--json]
```


控制本機短期擷取視窗，預設 15 分鐘、最多 60 分鐘。Remote Link SSH 在此期間採 `LogLevel=DEBUG1`，將遮蔽後內容存至 `<OPENCODEX_HOME>/link/ssh-capture/`。Home／Child 都可使用，不需代理或 admin token。回傳 enabled、logLevel、開始／到期時間、directory、retentionHours、maxMinutes、maxFileBytes、files、removed。stop 關閉視窗但保留檔案；start／status 刪除最後寫入超過 72 小時的檔案並回報數量。詳見[SSH 診斷](/zh-tw/guides/remote-link/#擷取-ssh-診斷)。無效引數 exit 2。

以精確 link ID 進行遠端復原，先讀回狀態，不重送不確定的撤銷：

```bash
ocx link recover --link-id lnk_0123456789abcdef --json
```
