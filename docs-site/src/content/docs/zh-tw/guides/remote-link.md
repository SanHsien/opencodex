---
title: 遠端連結
description: 透過 SSH 連接 OpenCodex Home 電腦與 Child 電腦。
---

機器連結透過 SSH 連接 OpenCodex **Home** 電腦與 **Child** 電腦。Home 透過 SSH 通道為 Child 提供服務，兩台電腦各自繼續在 `10100` 連接埠執行本機 OpenCodex 服務。儀表板會透過 SSH 傳送 Child 專用的連結金鑰，因此不需要手動輸入權杖。

## 需求

- Home 可以使用 OpenSSH 金鑰登入 Child。
- 對於由 Child 發起的連結，Child 必須能使用 OpenSSH 金鑰登入 Home（不支援密碼登入）。
- Child 已安裝 OpenCodex 2.66.0 或更新版本（由 Child 發起的連結也要求 Home 符合）。
- 兩台電腦執行 macOS 或 Linux。
- 從 Home 新增 Child 的儀表板需在 Home 上開啟，或使用已配對的 Hub 工作階段。將目前電腦轉換為 Child 需要由操作者配對的儀表板工作階段；未經憑證簽發的本機工作階段不能提交這項路由變更。

密碼 SSH 和 Windows 不在目前流程中。連結可以從任一端發起：依下文從 Home 發起，或依「將這台電腦連線為 Child」一節從 Child 發起。

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
ocx link reconnect --link-id <id> [--json]
```

非互動式終端（非 TTY）必須提供 `--expect-fingerprint`。互動式終端中可省略此參數，但必須明確確認提供的指紋。

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

### Windows computers

`ocx link add` and the dashboard refuse a Windows computer during the probe or host confirmation, before any link key is issued or tunnel started. The refusal covers Windows OpenSSH with Git Bash, MSYS2 or Cygwin as its shell (`uname -s` reports MINGW, MSYS or CYGWIN) and with cmd or PowerShell as its shell. Connect a Windows computer in Hub mode instead: run `ocx hub invite` on a Hub and run the printed `ocx connect` command on the Windows computer.

A Windows Child linked by an older release keeps its link. Run `ocx link cleanup` on the Home to find such links; add `--link-id <id>` to check one, or `--json` for a machine-readable report. It asks each Home-initiated Child for its platform over the link's pinned SSH trust and changes nothing. For each Windows Child it prints the recovery order: run `ocx disconnect` and `ocx restart` on the Windows computer, then `ocx link revoke --link-id <id> --force --yes` on the Home, then connect it in Hub mode. A plain revoke fails on these Children because its remote disconnect runs a POSIX command that Windows refuses.
