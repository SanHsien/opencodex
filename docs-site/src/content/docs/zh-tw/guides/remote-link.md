---
title: 遠端連結
description: 透過 SSH 連接 OpenCodex Home 電腦與 Child 電腦。
---

機器連結透過 SSH 連接 OpenCodex **Home** 電腦與 **Child** 電腦。Home 透過 SSH 通道為 Child 提供服務，兩台電腦各自繼續在 `10100` 連接埠執行本機 OpenCodex 服務。儀表板會透過 SSH 傳送 Child 專用的連結金鑰，因此不需要手動輸入權杖。

## 需求

- Home 可以使用 OpenSSH 金鑰登入 Child。
- 對於由 Child 發起的連結，Child 必須能使用 OpenSSH 金鑰登入 Home（不支援密碼登入）。
- Child 已安裝 OpenCodex 2.66.0 或更新版本（由 Child 發起的連結也要求 Home 符合）。
- 兩台電腦可執行 macOS、Linux 或 Windows x64。Windows 需要 OpenSSH Server 和 Windows PowerShell，不需要 Git Bash 或 curl。
- 從 Home 新增 Child 的儀表板需在 Home 上開啟，或使用已配對的 Hub 工作階段。將目前電腦轉換為 Child 需要由操作者配對的儀表板工作階段；未經憑證簽發的本機工作階段不能提交這項路由變更。

不支援密碼 SSH。可從 Home 或 Child 發起連結。Windows 透過相同固定主機金鑰的 OpenSSH 連線執行 PowerShell。

## 從 `#remote` 新增 Child

1. 開啟儀表板的 `#remote`，開啟 Remote Link。
2. 選擇 **Home**，然後按 **Continue**。SSH 主機列表會開啟。
3. 從 SSH 候選主機選擇主機，或輸入 SSH 設定別名。
4. 執行連線測試，並將顯示的主機指紋與目標電腦的指紋比較。比較指紋可在 SSH 信任主機前發現錯誤的電腦或已變更的主機金鑰。
5. 確認指紋，然後連接 Child。

儀表板不會要求輸入權杖。它會先探測主機，只有明確確認指紋後才能套用連結。

新增 Child 視窗會說明 Child 透過 SSH 使用此 Home 的供應商，並列出上述必要條件。別名來自執行 OpenCodex 的 Home 上的 `~/.ssh/config`，不一定是顯示瀏覽器的電腦。如果探索成功但沒有主機，請新增如下 `Host` 項目後重新掃描。也可以手動輸入現有別名；選取或輸入別名後即可啟用連線測試。視窗還提供本指南的連結。

```sshconfig
Host devbox
  HostName devbox.example.com
  User you
  IdentityFile ~/.ssh/id_ed25519
```

如果探索失敗，視窗會顯示載入失敗、可用的請求原因和重試按鈕，而不是聲稱清單為空。連線測試失敗的具體原因與清理後的 SSH 提示只在作用中視窗顯示，不會在背後重複顯示。檢查原因，必要時使用下方 SSH 診斷方法，然後重試。重新掃描會保留輸入的別名，但連線前必須重新檢查指紋。

## 將這台電腦連線為 Child

在要使用 Home 供應商的電腦上：

1. 在儀表板中開啟 `#remote` 並開啟 Remote Link。
2. 選擇 **Child**。SSH 主機清單會開啟。
3. 選擇 Home 的 SSH 主機，執行連線測試，然後比較並確認其主機指紋。
4. 閱讀提示後選擇 **Connect as Child**。

連線會重新啟動這台電腦上的 OpenCodex。已在執行的 Codex 請求會先完成，重新啟動期間新的請求可能在最多一分鐘內失敗。之後儀表板會自動重新載入並顯示 Child 連結。Codex 會繼續使用這台電腦上的 `http://127.0.0.1:<port>/v1`，不需要設定權杖或環境變數：本機 OpenCodex 會把每個請求轉送給 Home，由 Home 以它自己的供應商與帳戶提供服務。

如果 **Child** 提示先配對這台電腦，請在這台電腦上開啟設定的 HTTP 回環 IP 位址儀表板，例如 `http://127.0.0.1:<configured-port>`。只有在缺少配對且儀表板與 API 使用相同的回環來源時，才會顯示本機配對表單。複製表單中的 `ocx gui pair --origin "http://127.0.0.1:<configured-port>"` 命令，在這台電腦的終端機中執行，再將一次性代碼貼到表單中。必須使用表單顯示的確切來源；供應商 API 金鑰或管理員權杖不是配對代碼。缺少配對與設定的連接埠不符是不同的原因。

選擇 **Child** 角色還要求 OpenCodex 以獨立執行模式在其設定的連接埠上執行，因為 Child 會在正好這個連接埠上重新啟動。如果儀表板提示 OpenCodex 未在其設定的連接埠上執行，請先在該連接埠上重新啟動它。

## 連結狀態

- **Connected** 表示 SSH 通道已準備好，Child 可以使用 Home 連結。
- **Reconnecting** 表示正在重試通道。重試期間請求可能暫時回傳帶有 `Retry-After` 的 `503`。在從自己的儀表板連線的 Child 上，請求會先最多等待 15 秒讓通道恢復。
- **Failed** 表示連結需要處理。請檢查 SSH 驗證、已確認的主機金鑰、轉送或逾時原因。建立 SSH 通道的一方會在睡眠、故障或重新啟動後自動重試（Home 新增的 Child 由 Home 重試，從自己的儀表板連線的 Child 由 Child 重試）：逾時或轉送錯誤後先在一分鐘後重試，之後每次重試失敗等待時間加倍，最長五分鐘一次；驗證錯誤後每五分鐘一次。主機金鑰變更時不會重試。要立即重新連線，請在 Home 的儀表板中選擇 **Retry**，或在 Home 上執行 `ocx link reconnect --link-id <id>`。這只會重新啟動該連結的通道，不會重新啟動 OpenCodex。

連結失敗時不會靜默切換到本機供應商。

在 Child 上，`GET /healthz` 只代表 OpenCodex 正在執行。`GET /readyz`（以及 `ocx ready`）還會告訴你連結此刻能否承載請求：不能時回 `503`，帶 `Retry-After: 1`、`"status": "pending"` 與 `link` 物件，例如 `{ "state": "unavailable", "reason": "home_unreachable" }`；可以時回 `200`，帶 `"status": "ready"` 與 `{ "state": "available" }`。原因有 `tunnel_connecting`、`tunnel_failed`、`tunnel_idle`、`tunnel_unavailable`、`sidecar_invalid`、`home_unreachable`、`home_unauthorized`、`link_auth_failed`、`link_credential_unavailable` 與 `link_unverified`。從自己的儀表板連線的 Child 依自己的通道回答；由 Home 新增的 Child 本身沒有通道可看，所以透過通道，用每個轉送請求一開始都會做的那個不帶憑證的檢查去問 Home；這個檢查最多每五秒重複一次，Home 在半秒內沒有回應時回答 `link_unverified`。

## What a Child shows and manages

A Child runs on the Home's providers, accounts and settings, so the Home is where you change them.

- **Dashboard.** The Child's dashboard shows the Home's state read-only and says "Managed by Home <name> over Remote Link". Dashboard and Providers read the Home through the link, and the usage strip in the header shows the Home's quota. The model list is not shown on a Child, because building it runs provider discovery on the Home; Codex on the Child already offers the Home's models. For the same reason, the delegation and sidecar model pickers on a Child list the native models and the Home's current choices, not the Home's full routed list. Saving a change there is refused with a message that names the Home; make the change in the Home's dashboard. The Child's browser never receives a Home credential.
- **Codex settings.** `ocx sync` on the Child (and connecting it) applies the Codex settings OpenCodex manages on the Home: Fast mode, the multi-agent mode, the web search sidecar switch, and the native sub-agent defaults when the Home syncs them. `ocx sync` and `ocx status` list the values that came from the Home. The default reasoning effort and the effort levels shown in the Codex app's model picker are Codex app settings on each computer; OpenCodex does not manage them on any computer.
- **CLI.** Commands that only read, such as `ocx account list`, `ocx provider quota` and `ocx usage`, read the Home. They show what the Home has already observed: a read from a Child never makes the Home probe a provider, refresh a token or start a process, so quota and account details are as fresh as the Home's own activity keeps them. Reads that only exist to run provider discovery or a forced refresh, such as `ocx models live`, `ocx models preset show` and `ocx account list --quota`, are refused like changes. Commands that change configuration are refused with one message that names the Home and the link and says no request was sent. `ocx status` describes the Home and the link. `ocx provider list` and `ocx config get` still show this computer's own configuration, labelled as local and inactive while the computer is linked. `ocx config set`, `ocx config unset` and `ocx config import` still write locally, each with the same note, and `ocx provider add`, `remove` and `set-default` are refused because those providers are not used while linked.

These reads need an OpenCodex version with the Remote Link management relay on both the Home and the Child. An older Home answers with a message asking you to upgrade it.

## 移除 Child

選擇 Child 的 **Disconnect** 並確認別名。Home 會停止通道、撤銷該 Child 的連結金鑰，並刪除已儲存的連結記錄。

如果 Home 無法連到 Child 來執行中斷連線命令，請選擇 **Remove here only**。這只會刪除本機的通道、金鑰與記錄。然後登入 Child 並執行：

```bash
ocx disconnect
```

若要中斷由 Child 發起的連結，請在 Child 上執行 `ocx disconnect`。這個命令會中斷用戶端通道，並透過 SSH 在 Home 上撤銷連結。如果 Home 撤銷失敗，命令會輸出：`Home revoke failed; run ocx link revoke --link-id <linkId> on the home.`

## 疑難排解

某個步驟失敗時，儀表板會顯示原因，且在 SSH 有回報時，於訊息下方顯示取自其最後一行非空錯誤的簡短、已清理的提示。即使遠端 shell 輸出非 UTF-8 文字，遠端 shell 的錯誤也可以出現在那裡；OpenCodex 會移除終端控制碼、連結金鑰與 URL 查詢字串，並限制提示的長度。

- **無法連線到 SSH 主機**：主機必須不經密碼提示就接受你的 SSH 金鑰；在終端機中 `ssh -o BatchMode=yes <alias> true` 必須成功。像 `cloudflared` 這類 `ProxyCommand` helper，必須安裝在 `/opt/homebrew/bin`、`/usr/local/bin`、`~/.bun/bin`、`~/.local/bin`，或 OpenCodex 執行時 PATH 上的其他目錄。
- **在遠端電腦上找不到 ocx**：OpenCodex 會先在非互動 SSH session 的 PATH 上尋找 `ocx`，再找 `~/.bun/bin`、`~/.local/bin`、`/opt/homebrew/bin` 與 `/usr/local/bin`。如果它安裝在別處，請把該目錄加入遠端 shell 在非互動 session 會讀取的檔案中的 PATH，例如 zsh 的 `~/.zshenv`。
- **遠端電腦上的 OpenCodex 太舊**：在那台電腦上執行 `ocx update`。Remote Link 需要 2.66.0 或更新版本。
- **遠端電腦沒有回報 OpenCodex 版本**：那台電腦上的 `ocx --version` 印出了別的東西，例如不受支援的 Windows 安裝所印出的用法文字。

- **Home 睡眠或換網路後，Home 連結一直是 Failed 並帶轉送錯誤**：在 Home 上執行 `ocx link status --json`。它的 `tunnel` 欄位會顯示自連結上次連線以來的嘗試次數、`nextRetryAt` 與最後一次失敗。`lastFailure.cause` 為 `remote_forward_conflict` 表示 Child 的 SSH 伺服器仍為隨 Home 舊連線一起死掉的 session 佔著通道連接埠，在它放手之前，每條新通道都會被拒絕。OpenCodex 會持續重試，連接埠一釋出就自動連上；它絕不會停止 Child 上的任何行程。Child 的 SSH 伺服器只有在探測時才會發現死掉的 session；如果 Child 的 `sshd_config` 沒有 `ClientAliveInterval`，可能要等到作業系統的 TCP keepalive（macOS 預設兩小時）。在那裡設定 `ClientAliveInterval 15` 與 `ClientAliveCountMax 3`，可讓它約一分鐘內丟掉這類 session。

### 可重試的 503 診斷

relay 產生的 `503` 會帶一個由伺服器產生的 `x-opencodex-link-request-id`。用它對照 Child 的 OpenCodex 設定目錄下的本機證據：`link/diagnostics.jsonl` 與一份輪替備份 `link/diagnostics.jsonl.1`。每個檔案上限 256 KiB，權限為私有（POSIX 上目錄 0700、檔案 0600；Windows 上為私有 ACL）。紀錄只含固定的事件／結果／狀態類別、產生的關聯 ID、數值的時間／世代／嘗試次數中繼資料與時間戳，絕不含祕密、請求本文、標頭、URL、帳號識別碼或原始錯誤。每個事件／結果組合每秒最多一筆；下一筆紀錄會帶被抑制事件的計數，所以缺少紀錄不代表沒有失敗。牆鐘往回調整會開啟新的限速視窗（寫入佇列已滿時亦同），並保留抑制計數。非同步寫入器最多保留 56 筆待寫紀錄，溢出計入抑制，並在 Windows ACL 作業進行時讓出。記錄是盡力而為，不會改變請求是否被放行。優雅的訊號關閉與獨立程序的回收最多會等一秒讓佇列中的診斷寫出再結束；儲存停滯、強制終止與斷電仍可能遺失紀錄。

`owner_lookup` 記錄被拒絕的擁有者檢查；例行成功的檢查不留紀錄。`owner_lookup.elapsedMs` 量的是擁有者查詢本身。對 `auth_timeout`，`relay_retry` 與 `relay_failure` 在 `elapsedMs` 回報實際的傳輸嘗試時間（通常約五秒）。結果為 `recovered` 的 `relay_recovered` 事件，只有在重試收到 `upstream.ok`（HTTP 2xx）的上游回應後才會發出；它不證明串流本文已完成。限速使請求 ID 對照成為抽樣證據，而不是每個失敗請求的完整追蹤。

Home 也會在自己的設定目錄下為它執行的通道寫同類檔案。Home 發起的通道每次狀態變更都是一筆 `tunnel_transition` 紀錄，含 `previousState`、`state`、以 `outcome` 表示的原因（`auth`、`hostkey`、`forward`、`remote_forward_conflict`、`timeout`、`network`、`unknown`、`spawn_failed` 或 `listener_unavailable`；沒有失敗時為 `connected`、`spawned` 或 `stopped`）、自連結上次連線以來的 `attempt` 次數、連結的 `tunnelPort`，以及排定重試時的 `retryAfterMs`。失敗連結的重試若再次失敗也會記錄，所以一次中斷每次嘗試都留下一筆。限速規則相同，且跨所有連結計算。

在送出資料之前，OpenCodex 對擁有者查詢期限，或明確辨識的五秒驗證期限，允許一次共用的預檢重試。重試會在需要時取得新的擁有者證明與新的實體 socket，並在送出連結憑證或本文之前先驗證該 socket。它不會重用快取的擁有者核准、不繞過安全檢查、不重啟 SSH 或 OpenCodex，也不重播已送出的請求本文。每次嘗試的兩秒擁有者查詢期限與五秒驗證期限不變；其他失敗不適用這次預檢重試。

這可以從這些暫時性的期限路徑中恢復，也有助於診斷未來的失敗。它並未確立 [#7297](https://github.com/lidge-jun/opencodex/issues/7297) 的歷史成因。

## 安全性

Child 會透過連結使用 Home 電腦上的供應商與供應商憑證。Home 會為每個 Child 建立獨立的連結金鑰；移除連結會撤銷該金鑰。確認前請比較主機指紋，避免誤接受錯誤電腦或已變更的主機金鑰。由 Tailscale 身分簽發的儀表板工作階段無法管理機器連結。 在 Child 上，金鑰只保留在 OpenCodex 內部：Codex 或 Claude Code 在 Child 上傳送的憑證不會轉送給 Home，Child 上任何能存取 `127.0.0.1:<port>` 的程式都可以不用金鑰使用 Home，這與獨立安裝給予本機程式的信任相同。來自其他網站的網頁會被拒絕。

## CLI 參考

```text
ocx link probe <alias> [--json]
ocx link add <alias> [--expect-fingerprint SHA256:…] [--json]
ocx link port [--json]
ocx link issue --alias <alias> --tunnel-port <port> [--json]
ocx link status [--json]
ocx link revoke --link-id <id> [--json]
ocx link recover (--link-id <id> | --operation-id <id>) [--json]
ocx link reconnect --link-id <id> [--json]
ocx link check (--link-id <id> | --all) [--no-wait] [--json]
ocx link update (--link-id <id> | --all) --yes [--no-wait] [--json]
ocx link sync (--link-id <id> | --all) [--no-wait] [--json]
ocx link sync --link-id <id> (--restart-app-server-only | --restart-codex --yes) [--no-wait] [--json]
ocx link restart-codex --link-id <id> [--scope app-server|codex] --yes [--no-wait] [--json]
```

非互動式終端（非 TTY）必須提供 `--expect-fingerprint`。互動式終端中可省略此參數，但必須明確確認提供的指紋。

在 Home 上，`ocx link check (--link-id <id> | --all)` 會讀取每個由 Home 新增的 Child 的已安裝版本、安裝類型和更新途徑：它透過連結的 SSH 連線在 Child 上執行 `ocx update --plan`（每台 Child 60 秒，同時最多三台），該命令只計算更新計畫，不會做任何修改。早於 2.97.0 的 Child 會顯示為 `owner-action`（`legacy-ocx`），其版本在 macOS 和 Linux 上透過再一次唯讀 SSH 呼叫取得，在 Windows 上則取自 Child 透過連結回報的版本。由 Child 發起的連結和 `ocx-child` Child 不經 SSH 直接回報。`ocx link status --json` 會為每一列加上 `child` 區塊（版本、版本差異、目錄是否最新、活動狀態、最近一次操作）。詳情與結束代碼請見 [Child install, catalog and activity](/zh-tw/guides/remote-link/#child-install-catalog-and-activity)（英文）。

### 從 Home 操作 Child

`ocx link sync`、`ocx link restart-codex` 和 `ocx link update` 會透過連結的 SSH 連線在由 Home 新增的 Child 上執行，並以 JSON 輸出工作。`sync` 執行固定的 `ocx sync --expect-link`（Child 需為 2.93.0 或更新版本）。`restart-codex` 會先同步，再重新啟動 Child 上的 Codex app-server，讓執行中的 Codex 載入目前的目錄；`--scope codex` 也會重新啟動桌面應用程式。重新啟動只能指定一個連結；`restart-codex` 和 `--restart-codex` 需要 `--yes`，而 `ocx link sync --link-id <id> --restart-app-server-only` 不需確認即可重新啟動 app-server。當 Home 正在為該 Child 中繼模型請求時，會略過重新啟動（`restart-skipped:link-active`）。對於早於 2.69 的 Child，非串流請求要到回應開始後才看得到。`update --yes` 會使用 Child 自己的更新程式，把 Child 的 OpenCodex 更新到這個 Home 的版本，絕不會更新到其他版本（Child 需為 2.97.0 或更新版本；npm 和 pnpm 安裝透過其 Node 啟動器套用更新，因此 `ocx link check` 也會在那裡以唯讀方式執行 `node --version`）。一次更新一台 Child，套用成功、失敗或回復後會再次同步；結果未知的套用不會重試也不會同步，請用 `ocx link check` 檢查。正在為該 Child 中繼的請求會中斷。Windows Child 只支援 `sync`，`ocx-child` Child 會將重新啟動和更新回報為不支援。CLI 需要繫結到 loopback 的 Home；在其他 Home 上無法執行這些操作，儀表板的 Remote Link 頁面會為由 Home 新增的 Child 提供相同的操作。詳情與結束代碼請見 [從 Home 操作 Child](/zh-tw/guides/remote-link/#從-home-操作-child)。 此保護僅為盡力而為：在檢查與重新啟動之間開始的請求仍可能被結束，因此需要保留回合時，請先暫停該 Child 上的新請求。 Home 也無法判斷 Codex 是否正處在執行工具而非模型請求的回合中，因此在重新啟動該 Child 上的 Codex 或更新其 OpenCodex 之前，請等待進行中的 Codex 回合結束。手動更新會重新啟動該 Child 的 OpenCodex，並結束仍為其轉送的任何回合；自動更新會等到 Child 閒置。 `ocx sync --restart-children`（或 `--restart-children=codex --yes`）在 Home 同步向外傳播時，對所有 Child 或以 `--child <linkId>` 指定的 Child 套用同一規則：每台 Child 都會同步，只有在有中繼請求進行時才略過其重新啟動（`restart-skipped:link-active`）。

### Child 版本與操作

在 Home 上，每個 Remote Link 列都會顯示 Home 最後得知的該 Child 資訊，由 Home 新增的列還帶有控制該 Child 的按鈕。徽章代表：

- Child 的版本，以及旁邊的 `Behind Home (<home version>)`、`Same version as Home` 或 `Newer than Home`；可以套用更新時還會顯示 `Update available: <home version>`。從 Child 自身儀表板開始的連結只顯示版本，沒有版本差異徽章；`ocx-child` Child 一律顯示 `unknown`。
- 安裝類型（`Desktop app`、`GOAT`、`Source checkout`），本版本未命名的類型以等寬字型顯示原始權杖。
- `Catalog current` 或 `Catalog out of date`。`Codex restart needed (<n>)` 與 `Codex not running` 徽章只有在 Child 回報其 Codex 狀態後才會出現，該回報將由後續版本加入；目前還沒有 Child 版本會傳送它，因此這兩個徽章現在還不會顯示。
- 上一次操作，顯示為 `Last <operation>: <state>`，原因以等寬字型顯示；工作佔用該連結期間則顯示正在執行的操作。

當 Home 無法自行更新該 Child 時，該列會說明應該改做什麼：在該 Child 的 OpenCodex Desktop 中使用 Check for Updates、手動更新、透過 `mise` 更新，或交給 GOAT 處理。未知原因會以權杖顯示，而不是猜測的句子。

這四個操作會啟動與 CLI 相同的工作，因此 Child 也需要相同的版本：

- **Check** 像 `ocx link check` 一樣讀取 Child 的安裝資訊。
- **Sync now** 在該處像 `ocx link sync` 一樣執行固定版本的 `ocx sync --expect-link`。
- **Restart Codex** 會開啟範圍選擇。`Codex app-servers` 重新啟動 Child 的背景 app-server，使其載入目前目錄；它不會重新整理 Codex 桌面應用程式本身的 app-server，因此這種情況請重新啟動桌面應用程式。`Codex desktop app` 也會結束並重新啟動桌面應用程式，其中開啟的對話會結束。
- **Update** 像 `ocx link update` 一樣，用 Child 自身的更新程式把 Child 的 OpenCodex 更新到本 Home 的版本。確認文字會說明 Child 的 OpenCodex 會重新啟動、仍為該 Child 轉送的任何回合會結束，且自動更新會等到 Child 閒置。

**Check all** 和 **Update all** 作用於所有符合條件的 Home 新增連結；Update all 仍然一次只處理一台 Child，且絕不針對其他版本。執行中的工作會為每台 Child 顯示一列，包含狀態、更新前後的版本、目錄同步結果與重新啟動結果。工作結束後面板消失，各列重新整理；Home 已不再知道的工作（因為 Home 重新啟動過）會如此說明，並以各列自身的狀態作為答案。工作佔用連結期間，該列的動作與 Disconnect 會停用；伺服器本來也會拒絕該請求。

列表下方的 **Child automation** 面板顯示並編輯與 `ocx link policy` 相同的原則檔案：目錄分發（預設自動）、Codex 重新啟動（預設從不）、更新（預設閒置時自動，本版本尚未啟用）以及閒置時間。儲存時只寫入你變更過的值。如果原則檔案已損毀，面板會說明自動目錄分發與自動更新已關閉，此時儲存會寫入全部設定，使你選擇的模式得以保留。這些控制項不會繞過伺服器：伺服器會在每個工作中重新檢查原則、連結狀態與 Child 活動。

不要連結你不擁有的機器：Home 會用你的 SSH 金鑰在那裡執行命令。

### 目錄自動分發與 Child 政策

目錄分發預設為開啟。當 Home 的目錄變更時（目錄自動重新整理回報變更，或每 5 分鐘一次的檢查發現在儀表板或管理 API 中所做的編輯），Home 會等待 60 秒讓編輯穩定下來（距第一次變更最多 5 分鐘）。之後不需要你做任何操作，它會在背景為每台符合條件的 Child 開啟一個 SSH 工作階段，執行與 `ocx link sync` 相同的固定 `ocx sync --expect-link`；除非你啟用（見下文 `childCodexRestart`），否則不會重新啟動 Codex。符合條件的 Child 是：由 Home 發起的連結、通道已連線、沒有其他操作在執行，而且此 Home 在那裡最後一次執行的同步早於這次變更；只下載過目錄的 Child 仍視為落後。正在中繼模型請求的 Child，只有在其 Codex 設定已經與 Home 一致、且套用這些設定後其 OpenCodex 用戶端執行環境已經重新啟動過時才會同步，否則同步會重新啟動該執行環境；否則會在它閒置後再同步。同步失敗會在 5 分鐘後重試，間隔逐次加倍，最長 6 小時；低於 2.93.0 的 Child 在回報其他版本之前不會重試。這些工作與其他工作顯示方式相同，帶有 `trigger: "auto"`。沒有連結的 Home 不會執行其中任何部分。

分發修正的是 Child 的目錄檔案。Child 上已經在執行的 Codex app-server 會繼續使用已載入的清單，直到重新啟動：請使用 `ocx link restart-codex --link-id <id> --yes` 或 `ocx sync --restart-children`，或以 `ocx link policy --child-codex-restart app-server-when-idle` 讓 Home 重新啟動 app-server；Home 只會在同步執行時仍然閒置的 Child 上這麼做。該設定從下一次自動同步起生效；目錄已是最新的 Child 不會被同步，因此也不會被重新啟動，請手動重新啟動它。

政策儲存在 Home 的 `<configDir>/link/child-policy.json` 中，不會寫入 `config.json`：

| 設定 | 預設值 | 可用值 |
|---|---|---|
| `catalogFanout` | `auto` | `auto`, `manual` |
| `childCodexRestart` | `never` | `never`, `app-server-when-idle` |
| `updates` | `auto-when-idle` | `off`, `notify`, `auto-when-idle` |
| `idleAfterMs` | `600000` (10 分鐘) | 1 到 60 分鐘 |

`updates` 預設會自動讓閒置的 Child 維持與 Home 相同的版本。本版本中自動更新尚未生效；該設定現在就會儲存，因此以 `ocx link policy --updates notify` 或 `--updates off` 做出的退出選擇，在自動更新推出時依然有效。`idleAfterMs` 表示 Child 在沒有被中繼的模型請求的情況下持續多久才算閒置；它也決定 `ocx link status` 中的 `activity.idle`。

```text
ocx link policy                                    # 讀取政策
ocx link policy --catalog-fanout manual            # 關閉目錄自動分發
ocx link policy --child-codex-restart app-server-when-idle
ocx link policy --updates off --idle-after-minutes 20 --json
```

`GET` 和 `PUT /api/link/children/policy` 讀取和變更相同的設定（迴路介面上的管理權杖，或儀表板工作階段）；`PUT` 只傳送要變更的設定。如果檔案損毀或包含未知的值，目錄自動分發和更新都會關閉，而且 `ocx link policy` 會提示這一點。儲存會清除警告，但未指定的設定仍保持關閉，請明確開啟，例如 `ocx link policy --catalog-fanout auto --updates auto-when-idle`。Home 從不自行改寫該檔案。

不要連結不屬於你的機器：Home 會用你的 SSH 金鑰在那裡執行指令。

## 相關指南

- [Remote Hub 部署](/zh-tw/guides/remote-hub/)
- [遠端工作區](/zh-tw/guides/remote-workspace/)

### Relay 認證相容性

升級到連線綁定的 relay 認證時，請同時更新 Home 與 Child。在送出被 relay 請求的連結憑證或本文之前，Child 會在它將用於該請求的同一條連線上驗證 Home。已關閉的連線不會被悄悄取代。沒有這個協定的 Home 會造成可重試的認證錯誤；請升級 Home 與 Child，並在儲存的連結不再被辨識時重新連結。沒有不安全的後備開關。尚未過期的待處理 API 金鑰輪換，在它過期或輪換被提交或中止之前仍然有效。

移除最後一個 Home 連結時，會先排空待處理的已認證 relay 請求，再釋放它的 listener。停止程序仍會取消作用中的連線。這不會改變哪些呼叫者憑證會被剝除，或哪些路由可以被 relay，也不會取代 SSH 的主機金鑰驗證。

`ocx link probe <alias> --json` · `ocx link add <alias> --expect-fingerprint SHA256:… --json` — [CLI, restart, relay verification and recovery](/zh-tw/guides/remote-link/#add-a-child-from-the-terminal).

### Home and Child versions

On the Home, `ocx link status --json` reports the Home's own `local` version, relay authentication version and features, and gives every link a `peer` block. Nothing is read over SSH: the Home learns about a Child from the relay authentication check the Child sends before each relayed request. From 2.91.0 that check also carries the Child's version and feature list. The Home keeps what it learned in memory, so after a Home restart a link reads `unknown` until its Child relays a request again.

| Part of the link | First release |
|---|---|
| `relay-auth/2`, connection-bound relay authentication | 2.69.0 |
| `link-management-relay`, read-only Home management on the Child | 2.84.0 |
| `link-peer-report/1`, the Child reports its version and features | 2.91.0 |

`peer.compatibility` is one of:

- `compatible`: the relay authentication versions match, and the Home serves every feature the Child reports. A Child older than 2.91.0 reports no version; `peer.version` is then `null` and `peer.versionRange` gives the range its relay authentication implies, for example `{ "min": "2.69.0", "below": "2.91.0" }`.
- `degraded`: the Child reports a feature this Home does not serve. Upgrade the Home.
- `incompatible`: the Child asked for a relay authentication version this Home does not speak, so its relayed requests are refused. `peer.reasons` names the side to upgrade.
- `unknown`: the Child has not relayed a request since the Home started, or it sent a version or feature list the Home could not read, so its features cannot be checked.

The version a Child reports is its own claim, bound to its link key. OpenCodex uses it for display and never for admission. Older `ocx` installations keep receiving the previous status document; only a 2.91.0 or newer CLI asks for these fields.

### Child install, catalog and activity

Home 上的 `ocx link status --json` 也會為每個連結提供 `child` 區塊。較舊的 Home 沒有它，較舊的 CLI 也不會要求它。

- `runningVersion` 是 Child 透過連結回報的版本。`installedVersion`、`installKind` 與 `update`（`route`、`reason`、`observedAt`）來自最近一次 `ocx link check`，在執行過之前維持 `null`。`versionSkew` 把已安裝版本（或執行中版本）與 Home 比較：`same`、`behind`、`ahead` 或 `unknown`；對 `ocx-child` Child 永遠是 `unknown`。
- `catalog.state` 在 Child 最近一次從 Home 下載的目錄就是 Home 目前的目錄時為 `current`，Home 的目錄之後有變動時為 `behind`，第一次下載之前為 `unknown`。Home 比較的是目錄內容而非檔案時間，所以還原較舊的目錄檔也會顯示 `behind`。下載只證明 Child 取得了目錄，不證明它已套用；`ocx link add` 在註冊時執行的檢查算作一次下載。
- `activity.idle` 在該連結上已有 10 分鐘沒有任何經中繼的模型請求時為 `true`。`inFlight` 計算目前正在執行的請求。token 計數、目錄與就緒讀取不算，早於連線綁定中繼認證的 Child 所發出的請求會計入每一個連結。
- `activeJob` 指出該連結上正在執行的操作，`lastOperation` 是最近完成的一個。`codex` 目前為 `null`。

`ocx link check --link-id <id>`（可重複）或 `ocx link check --all` 會向 Child 詢問其安裝資訊。對每個由 Home 發起的 Child，Home 透過該連結的 SSH 連線執行 Child 的 `ocx update --plan`，它只計算更新計畫、不改變任何東西；每次呼叫有 60 秒預算，同時執行三個。早於 2.97.0 的 Child 沒有該指令：該項目顯示為 `owner-action`、原因 `legacy-ocx`，Home 在 macOS 與 Linux 上以多一次唯讀 SSH 呼叫取得版本，在 Windows 上則使用 Child 透過連結回報的版本。在沒有記錄服務安裝的 npm 或 pnpm Child 上，指令會經由 `ocx` launcher 執行，因此 launcher 平常的啟動簿記會先執行，這與 Home 傳到那裡的每一次 `ocx sync` 相同。由 Child 從自己的儀表板發起的連結與 `ocx-child` Child 不經 SSH 回報。指令會等待工作並以 JSON 印出（`--no-wait` 則立即印出）；每個 Child 都回答時結束碼為 0，Child 忙碌、離線、太舊或無法檢查時為 6，失敗為 1，未知的連結或對此指令過舊的 Home 為 4，該連結上另有操作執行中為 5。

### Standalone pairing authorization

The existing `ocx gui pair --origin <local-origin>` command works while OpenCodex runs as a background service. Run it under the account that owns the service's private OpenCodex home, then enter the returned one-use code in the local dashboard. No server terminal, additional password, Windows Hello or hardware key is required. The CLI and server must use the same current version and configuration home; restart an older server after updating. Mixed-version Hub invitations also require updating the CLI and server together. Pairing refuses a symlinked configuration home or intent directory; use the actual protected directory as `OPENCODEX_HOME`.

Internally, the CLI creates a short-lived authorization commitment and attempts to remove it after use or failure. Reading runtime information alone does not authorize pairing, and the verifier is not stored on disk. This is a private-home write-access boundary, not biometric or human-presence authentication: a program with full access to that user's files is still trusted. Existing Hub invitation authorization is unchanged. If a pairing request fails, run a fresh command after resolving the reported problem. This does not add Windows SSH Remote Link support.

If a process is interrupted during pairing, rerun the command to obtain a new authorization. Do not manually remove pairing state while the service or a pairing command is running.

On Windows, pairing fails closed if the intent folder or record is not private to the serving account, or its owner and permissions cannot be verified. Both entries must be owned by that account; Administrators ownership is accepted only when Administrators is the serving token's default owner and its administrator role is enabled. The permission list must be protected from inheritance and contain an ordinary Full Control allow entry for the serving account. Besides that, only plain allow entries for SYSTEM and the Administrators group are accepted, because SYSTEM and an elevated administrator can already take ownership of any file; a non-elevated administrator gains nothing from that entry. Child inheritance is allowed on the folder only. This is the list as Windows reports it: compatible duplicate entries for the same account count as one, and entries that grant nothing are ignored. The check leaves refused records in place and does not repair their permissions or change ownership. Restore a private configuration home, then run a fresh pairing command.

The check covers the intent folder and record. It does not protect against replacement of ancestor folders, deletion rights on a parent folder, privileged restore operations or access through handles opened before permissions became private. A request with a matching commitment can block the server during a verification subprocess bounded at five seconds, even if its folder later fails the permission check. Executable lookup and process launch setup precede that timeout. CLI cleanup may perform one more verification. The five-second subprocess budget leaves room within the command's ten-second request timeout, but slow verification can still refuse pairing.

## Add a Child from the terminal

On the Home, run `ocx link probe child-a --json` to inspect the offered SSH fingerprint, key type and OpenCodex version. Verify the fingerprint through a trusted source. Then run `ocx link add child-a --expect-fingerprint SHA256:… --json`. The command probes again and refuses a mismatch before storing trust or issuing a key. Without the fingerprint flag, it requires an interactive terminal and an explicit `yes` after showing the fingerprint. It never prints the link key.

Home-initiated connections now restart the Child after saving its connection, including capable older Child installations. The Child must already serve standalone OpenCodex on its configured port, expose bound restart support, and have curl installed. Update or disconnect a Child that fails this preflight. Desktop and system OpenCodex installations take precedence over generic PATH shims; broken candidates are skipped. Windows Children remain unsupported.

Restart waits for running turns and may take several minutes. Success requires the restarted Child to serve the client role and relay a fresh complete catalog to this Home. SSH setup has a bounded allowance derived from measured latency; relay verification starts after restart with its own 15-second window. Errors name the failing phase. If an error reports residual Child configuration, run `ocx disconnect` and `ocx restart` on that Child before retrying. Home cleanup alone does not restore Child configuration. A CLI timeout reports an uncertain outcome; inspect Home `ocx link status` and Child `ocx connect status` first.

On a Home-initiated Child, `ocx link status` reports role `child`, link identity and tunnel port from its saved connection even though its Home-side link store is empty. Locally unobserved tunnel state is `idle`. `ocx status` calls the peer a Remote Link Home. When Home runs in Hub mode, status reads its supported projection through the local Child relay. A standalone Home reports that it does not publish Hub state. Child-initiated tunnel identity comes from its valid sidecar; unreadable evidence does not claim a direction.

### Ephemeral Child machines (`ocx-child`)

對於不需要安裝完整 Bun OpenCodex 執行環境的拋棄式 SSH devbox、容器與輕量雲端 VM，在 `#remote` 選擇 **Plant lightweight agent & connect**，或執行 `ocx link add <alias> --plant --expect-fingerprint SHA256:…`（互動式的 `ocx link add <alias>` 會在植入前詢問一次）時，Home 可以經由 SSH `stdin` 把經 SHA-256 驗證的獨立 `ocx-child` 執行檔（Child 上不需要 Node 或 Bun）串流到 `~/.cache/opencodex/bin/ocx-child`（Windows 為 `%LOCALAPPDATA%\opencodex\bin\ocx-child.exe`）。Child 不下載任何東西，因此不需要對外網路，但 POSIX Child 必須有 `sha256sum`、`shasum` 或 `openssl`：執行檔在安裝或執行之前會對照其 SHA-256 檢查，缺少這些工具時會拒絕植入（`hash_tool_unavailable`）。你也可以事先把 `ocx-child` 放在 `~/.local/bin/ocx-child`、`~/.cache/opencodex/bin/ocx-child` 或 `PATH`。註冊之前，Home 會先探測每個完整的 `ocx` 候選，沒有可執行的完整 `ocx` 時才退回 `ocx-child`；一旦 `$OPENCODEX_HOME/child/state.json` 存在，遠端指令會持續以 `ocx-child` 為目標，直到它 detach。

Home 只植入它能驗證的建置，也不會下載或自行建置。npm 套件與桌面應用程式都不附帶 `ocx-child` 建置，所以在封裝安裝上，探測會把裸主機回報為不可植入（`plantable: false`、`plantUnavailableReason: "artifact_not_found"`），直到你自行提供。Home 依序在下列位置尋找 Child 目標（`darwin-arm64`、`darwin-x64`、`linux-x64`、`linux-arm64` 或 `windows-x64`）的建置：

1. Home 上 `OPENCODEX_CHILD_BIN_DIR` 指定的目錄：`ocx-child-<target>`（Windows 為 `ocx-child-windows-x64.exe`）或 `<target>/ocx-child`，當 Child 與 Home 目標相同時也包含單純的 `ocx-child`。檔案必須列在同一目錄的 `SHA256SUMS` 檔中。
2. OpenCodex 原始碼或執行檔旁的 `native-bin/` 目錄，適用相同的 `SHA256SUMS` 規則。目前沒有任何 OpenCodex 套件提供這個目錄。
3. 僅限原始碼 checkout：當 Child 與 Home 目標相同時，`native/ocx-child/target/release/ocx-child`。
4. `$OPENCODEX_HOME/cache/ocx-child/<Home version>/ocx-child-<target>`，旁邊有 `SHA256SUMS` 檔。沒有任何東西會自動填入這個快取；請自行複製建置到那裡。

要準備建置，請在原始碼 checkout 中執行 `cargo build --release --locked --manifest-path native/ocx-child/Cargo.toml`（針對其他目標交叉編譯），把結果以 `ocx-child-<target>` 名稱複製到上述其中一個目錄，並用 `sha256sum ocx-child-<target> >> SHA256SUMS`（或 `shasum -a 256`）寫入其 `SHA256SUMS` 行。檔案不能是符號連結，也不能是群組或所有人可寫。

與完整的 `ocx` Child 不同，乾淨的 detach 狀態 `ocx-child` 主機在 `ocx link add` 之前不需要預先執行的背景 daemon：Home 在提交之前會檢查目標埠可用性與 `~/.codex/config.toml` 的擁有權（若埠 `10100` 被其他行程占用則 `409 child_port_busy`，若另一個模型 provider 或自訂 base URL 已擁有 `config.toml` 則 `409 child_external_provider_conflict`，兩者都不更動 Child 檔案並回復任何新植入的執行檔），經由 SSH stdin 傳送連結憑證，啟動 `ocx-child serve`，並確認一個通過認證的 `/v1/catalog` 中繼。`#remote` 中已連線的列會顯示 **Lightweight** / **Full install** 徽章與 **Home settings synced** / **Sync needed** 一致性徽章。執行 `ocx link revoke --link-id <id>` 會保留快取的執行檔以便快速重新連接，而 `ocx link revoke --link-id <id> --purge`（或在 Child 上執行 `ocx-child detach --purge`）也會從受管理的快取目錄刪除植入的執行檔。

在整個連線期間，請讓 `OPENCODEX_HOME` 與 `CODEX_HOME` 指向相同的目錄。若 detach 回報還原或關閉錯誤，請保留 Child 的復原檔案並先解決錯誤再重試。

### Windows computers

`ocx link add` and the dashboard refuse a Windows computer during the probe or host confirmation, before any link key is issued or tunnel started. The refusal covers Windows OpenSSH with Git Bash, MSYS2 or Cygwin as its shell (`uname -s` reports MINGW, MSYS or CYGWIN) and with cmd or PowerShell as its shell. Connect a Windows computer in Hub mode instead: run `ocx hub invite` on a Hub and run the printed `ocx connect` command on the Windows computer.

A Windows Child linked by an older release keeps its link. Run `ocx link cleanup` on the Home to find such links; add `--link-id <id>` to check one, or `--json` for a machine-readable report. It asks each Home-initiated Child for its platform over the link's pinned SSH trust and changes nothing. For each Windows Child it prints the recovery order: run `ocx disconnect` and `ocx restart` on the Windows computer, then `ocx link revoke --link-id <id> --force --yes` on the Home, then connect it in Hub mode. A plain revoke fails on these Children because its remote disconnect runs a POSIX command that Windows refuses.

## 同一 Child 的多條路由

Home 新增的 Child 可有多個 SSH 路由，例如同 LAN／tailnet 的直連別名與可從外部使用的 relay。Home 按保存順序連線，首個可用路由承載流量：

```text
ocx link routes --link-id <id>
ocx link routes add --link-id <id> --route <alias> [--position <n>]
ocx link routes remove --link-id <id> --route <alias>
ocx link routes order --link-id <id> --routes <alias,alias,...>
```


所有路由必須到同一台機器。原 link 別名是固定 pin，保留在清單，所有路由只能呈現已確認的同一主機金鑰。新增前以此金鑰嚴格探測；錯誤金鑰、拒絕登入或不回應不儲存，回 `route_unproven` 及 hostkey／auth／forward／transient 原因。私有 known_hosts 若為同一別名信任其他金鑰，拒絕 pin_mismatch／trust_file_unexpected。新增 Child 也拒絕 OpenCodex 不會產生的 wildcard、host-list、marker 行；移除該行再探測確認。舊版可能保存雜湊行，允許同別名多行但必須同一金鑰。既有 link 的別名不可直接確認新金鑰（link_pin_conflict），換機須刪 link 後重建。保存成功但 tunnel reload 失敗時回 routes_stored_reload_failed，保留設定，重啟 Home 使其套用。

新路由預設放在原別名前，可用 --position 指定。每次連線順序探測，各 10 秒；成功候選再有 30 秒取得遠端 listener、30 秒確認 ready。Child 必須透過 tunnel 用 link key 取回 Home 目錄才算連上，之前為 Connecting。網路失敗冷卻數秒，forward 拒絕一分鐘、auth 五分鐘、host key 十分鐘；只有全部路由都呈現錯誤金鑰才以 hostkey 失敗。

Home 異常停止後若 ssh 還占 port，多路由 link 會以 stale tunnel may hold the port 失敗，須等該 ssh 結束。PID 見 `<config dir>/link/<link id>.pid`；若 PID 已被其他程式重用，先證明沒有該 link 的 ssh，再刪 pid 檔重啟 Home。檔案不可讀也保持阻擋；恢復可讀後等原 ssh 退出，或確認無 ssh 後刪檔，下一秒／重試到期會恢復。

新增／重排不搬動執行中的 tunnel；較後路由保持可用時不切回。斷線或 `ocx link reconnect --link-id <id>` 才從頭選擇，後者會中斷該 link 的請求。JSON status 包含現用 route／起始時間、各 routes 的重試時間與上次結果及 routeBlocked。

Home 必須使用 OpenSSH，否則 ssh_client_unsupported；Child 在 POSIX 需 curl，在 Windows 需 PowerShell。命令以本機回送 admin API 執行，不能透過非回送 Hub 的 private control socket 修改。relay 只傳 SSH 加密位元組；別名可見於本機 status／route 命令，不進診斷日誌。舊版 Home 不接受多路由 store，降版前先移除額外路由。

## 依裝置指定用戶端路由

Home 持有路由意圖，每台 Child 依自己的安裝、路徑、listener port 與目錄套用，不複製 Home 的用戶端檔案或憑證。裝置覆寫優先於 Home 預設，內建預設只開 Codex／Claude Code。

Home 本身的 Codex、Claude Code、Grok、Claude Desktop 遵循自身開關，只有明確 false 才關閉；Home defaults／device overrides 不決定 Home 的這四項。未被路由寫入處理的 Grok／Desktop 只依啟動同步規則更新既有受管理設定，不建立新 Desktop profile 或變更模式；受管理檔案被改過則回衝突，未管理的 Desktop library 不變並視為 current。建立 Desktop profile 使用 `ocx route to claude-desktop on --device home`，不會因此開啟 Child 的 Grok／Desktop。

Child 依序讀 device override、已存 Home default、內建值，不讀 Home 現用開關。新增 Child 或無 --device 的 Home default 寫入時，Home 會先保存 Codex／Claude Code 當時狀態，Grok／Desktop 為 off。已有一般 Child 時，Home-only 整合變更、listener 啟動前會保存所有可繼承 default，之後 Home 開關只影響 Home。只含 ephemeral ocx-child 的 links 不需要此保護。listener 若保存失敗會背景重試；單純讀取 route status 不寫入。route-intent.json 不可讀時，已連結 Home 的相關變更與所有 route to 寫入會先拒絕並指名需修復的檔案。

用 `ocx route to <client> on|off` 修改 Child 繼承的 Home default，`--device home` 只改 Home，`--device <linkId>` 指定裝置。套用結果須逐裝置讀回；裝置使用自己的路徑與憑證，不能把 Home 的成功視為 Child 已完成。

### 擷取 SSH 診斷

預設關閉，只能由欲檢查 tunnel 所在機器的本機操作開啟：

```bash
ocx link capture start            # 15 minutes; --minutes accepts 1 to 60
ocx link capture status
ocx link capture stop
```


Home 擷取連往 Child 的 tunnel；Child 擷取自己連往 Home 的 tunnel，不需代理或 admin token。Home 同步、dashboard 或遠端請求不能開啟它。視窗內再次 start 更新到期時間並沿用同一檔案。

下次 SSH 嘗試改用 DEBUG1，現有連線直到重連才改變；Home 可 reconnect 立即重試。stop／到期後停止保存，下次恢復 ERROR。請求 admission 不變，額外診斷行不進 status 的失敗原因；但不認識的行仍計入原因，伺服器 banner 只在較高等級出現，因此含 Permission denied 等詞的 banner 可能改變原因與重試延遲。

每行先比對已知 OpenSSH 格式，再存 `link/ssh-capture/ssh-<start time>.jsonl`，包含時間、home／child、隨機 link ID、SSH 等級、固定事件與遮蔽文字。host、IP、使用者、port、路徑、金鑰／指紋、proxy 命令、環境值與 server 訊息都替換為預留文字；只保留標準演算法與認證方法名稱。未知行只存 unrecognized 計數，不存內容。

每視窗最多 1 MiB，滿時寫 capture_truncated 並停止；最多四檔，最後寫入 72 小時後刪除。啟動 OpenCodex／tunnel、capture 命令與執行中的到期計時都清理，停止期間到期者下次再清。stop 保留檔供分享，不再需要時可自行刪除。目錄／檔案在 POSIX 為 0700／0600，Windows 使用私有 ACL，不讀寫符號連結。

```sh
ocx route to status --device all --json
ocx route to aside on --accounts all
ocx route to aside on --device my-child --accounts stable-aside-user-id
ocx route to pi off --device my-child
ocx route to pi inherit --device my-child
ocx route to sync --device my-child
```
