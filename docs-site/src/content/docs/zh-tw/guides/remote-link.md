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
- **Failed** 表示連結需要處理。請檢查 SSH 驗證、已確認的主機金鑰、轉送或逾時原因。建立 SSH 通道的一方會在睡眠、故障或重新啟動後自動重試（Home 新增的 Child 由 Home 重試，從自己的儀表板連線的 Child 由 Child 重試）：逾時或轉送錯誤後大約每分鐘一次，驗證錯誤後每五分鐘一次。主機金鑰變更時不會重試。要立即重新連線，請在 Home 的儀表板中選擇 **Retry**，或在 Home 上執行 `ocx link reconnect --link-id <id>`。這只會重新啟動該連結的通道，不會重新啟動 OpenCodex。

連結失敗時不會靜默切換到本機供應商。

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
