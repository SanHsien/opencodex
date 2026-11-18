---
title: Codex 訊息傳遞
description: 在本機或透過明確指定的 SSH 對等端，把具關聯性的訊息排入已載入的 Codex 對話。
---

`ocx message sessions` 與 `ocx message send` 是針對既有 Codex 對話的選擇性啟用功能。
它不會啟動 proxy 或 app-server、不會恢復任何對話串，也不會安裝任何 skill。
支援 Linux／macOS 的 Unix socket；Windows 會明確失敗。既有的 Codex daemon 必須支援實驗性的
`thread/queue/add`。不需要固定 CLI 版本，也不需要選用 `CODEX_CLI_PATH`。

下方獨立的 [MCP 佇列主機](#mcp-佇列主機)可在沒有控制 socket 的情況下，對已儲存的對話 UUID 排入訊息。
它不會改變上述只處理已載入對話的指令。

## MCP 佇列主機

只有在你要讓 MCP 用戶端（例如 Claude Code 或 Claude Desktop）列出已儲存的 Codex 對話並排入純文字時，才執行 `ocx message mcp`。
主機使用 stdio，不開網路 listener，也不會自行註冊到任何用戶端。請在 MCP 用戶端中指定明確的 Codex CLI 與既有的 home：

```json
{
  "mcpServers": {
    "opencodex-queue": {
      "command": "ocx",
      "args": [
        "message", "mcp",
        "--codex", "/absolute/path/to/codex",
        "--codex-home", "/absolute/path/to/.codex"
      ]
    }
  }
}
```

請把兩個路徑換成實際的本機路徑；若用戶端沒有繼承 PATH，`ocx` 也請改用絕對路徑。
第一版支援 macOS 與 Linux；Windows 會明確拒絕。

- `codex_threads` 每頁最多列出 50 個已儲存且未封存的對話。把 `nextCursor` 當作 `cursor` 傳回即可取得下一頁。
  結果只含 ID 與名稱，不含歷史、預覽或工作目錄。`liveStateVerified: false` 表示它不證明對話已在應用程式中開啟，
  或已準備好處理訊息。
- `codex_queue_message` 接受精確的 `threadId` UUID 與 `message`。只排入使用者已授權的訊息。
  文字加上固定的 peer 標籤上限為 16 KiB；NUL 與空白文字會被拒絕。不猜測名稱、不覆寫模型、
  不授予權限，也不會自動回應。

每次佇列／中繼資料或已儲存內容的讀取工具呼叫，都會透過 stdio 啟動一個短命、明確選定的 Codex CLI app-server。
它使用 `thread/list`，或與 `codex queue` 相同的實驗性 `thread/queue/add` 方法，且不把文字放進子程序引數。
它不會發出啟動 daemon、登入、恢復對話、開始回合或引導（steer）的請求。一般的 OpenCodex 啟動不會啟動這些輔助程序。
原生 CLI 可在所選 home 內維護自己的狀態；本功能不建立任何 OpenCodex 儲存區。

`queued` 表示有一個具關聯性的佇列回應確認已儲存，**不代表已處理**。
明確拒絕為 `not_sent`；佇列寫入之後的斷線、逾時或無效收據為 `unknown`。不確定的送出切勿重送。
未載入的對話可能持續等待，而進行中的目標或回合可能延後消費。主機不會喚醒未載入的對話。
預設的佇列工具不會讀取後續的答案；明確讀取答案請見[選擇性啟用：讀取已儲存的回合回覆](#選擇性啟用讀取已儲存的回合回覆)。
依賴投遞行為之前，請先在你安裝的應用程式／CLI 組合上自行驗證。

每個主機最多同時進行四個輔助程序呼叫。每次操作的預算為 20 秒（含執行檔驗證），RPC 期限 12 秒、輸出上限 1 MiB。
清理在 600 ms 後升級為 SIGKILL。斷線／取消只會停止並回收該次呼叫擁有的輔助程序，絕不會停止收件者。
所選的 macOS 執行檔會通過既有的 bundle 執行信任檢查。MCP 存取與所選 home 是本機使用者的信任邊界，
不是針對個別專案或對話串的授權。收到的 peer 文字只是上下文，絕不證明使用者核准或授權代理。

這條已儲存佇列路徑與 `sessions`／`send` 分開：後者仍需在既有控制 socket 上完整探索已載入的對話，
且絕不啟動原生 CLI 輔助程序。遠端 peers、Claude 收件匣傳輸、持久交接、自動回覆投遞、引導（steer）
與用戶端自動設定都不在這個主機的範圍內。

## 選擇性啟用：讀取已儲存的回合回覆

在 MCP 佇列主機（`ocx message mcp`）既有的參數後加上 `--allow-reply-read`，會開放 `codex_read_reply` 與 `codex_wait_reply` 兩個工具。不加這個旗標時，原有的兩個工具與只含中繼資料的探索行為完全不變。這個選項明確允許對話文字抵達 MCP 用戶端；本機使用者能存取所選家目錄，並不等於對個別專案或對話串的授權。用戶端訊息 ID 只是對應資料，不是憑證，也不代表使用者許可。

```sh
ocx message mcp --codex /absolute/path/to/codex --codex-home /absolute/path/to/.codex --allow-reply-read
```

呼叫 `codex_read_reply` 時，帶入精確的 `threadId`，以及佇列收據中的 `clientMessageId`。每次呼叫最多搜尋一頁、共 50 個已儲存項目。比對到某筆輸入就確定一個回合，工具回傳該回合明確標示為 `final_answer` 的代理文字（一頁）；不回傳使用者內文、推理、指令、引用與工具輸出。整個呼叫共用 20 秒預算，最多依序執行三個輔助程序，另加自有程序的清理時間；每個輔助程序仍維持既有的 12 秒 RPC 期限與 1 MiB 輸出上限。每頁結果的文字上限為 16 KiB、保證是有效的 UTF-8，且每個項目都有明確的 `truncated` 旗標。`nextCursor` 接續的是項目，不是被截斷項目的剩餘位元組。

結果區分以下幾種觀察：

- `observed`：比對到該輸入。`replies` 仍可能是空的。關聯性固定為 `same_turn_not_exclusive`：結果是同一回合的最終文字，不保證是專屬於該輸入的答案；共用回合中，文字可能早於後續的輸入。`turnStatus` 取自最新 50 個回合摘要，超出該範圍時為 `unverified`；回合完成不代表目標完成。
- `not_observed`：這一頁搜尋中沒有比對到輸入。這不代表未送達、已刪除或沒有回應。`reachedHistoryEnd` 描述的是這次搜尋的位置，不是送達或處理狀態。要搜尋更舊的項目，請沿用非 null 的 `nextCursor`。
- `ambiguous`：這一頁搜尋中有多個符合的輸入，不回傳任何文字。
- `available: false`：存取被停用、輸入或游標無效、歷史格式錯誤、原生方法不可用或不支援、被取消，或其他讀取失敗。不公開原生診斷訊息，失敗也不會被當成空的成功結果。

把 `nextCursor` 當作 `cursor` 傳回，即可繼續搜尋或讀取已比對回合的下一頁。比對到之後，`refreshCursor` 會從該回合開頭重新掃描，使先前只有部分內容的項目在完成後得以出現。回合很長時請重看所有頁面；呼叫端要保留或更新項目 ID 以避免重複，主機本身不新增持久收件匣，也不在背景輪詢。`nextCursor` 為 null 只代表目前這份歷史快照結束，不代表之後不會有新輸出。

游標是有界、由呼叫端持有的位置資料，同時綁定兩個請求 ID，不是簽章過的權限。接續已比對回合時，會重新讀取該使用者項目，確認其 ID、回合與用戶端對應都相符，才投影回合文字。過期、格式錯誤或跨範圍的位置一律失敗關閉，不會重新從整份歷史開始。原生方法為 `thread/items/list`、`thread/items/read` 與 `thread/turns/list`，不會恢復對話、引導、開始回合或變更佇列。

這項選用契約是以 Codex CLI 0.166.0 觀察到的。較舊的版本或舊式儲存可能無法使用；沒有無上限的整份歷史備援。這些讀取不能證明收件端是否仍在運作、目標是否完成，或 Claude Desktop 是否已註冊，也不新增自動回覆投遞或反向的 Claude 傳輸。

### 有界的回覆等待

`codex_wait_reply` 接受與 `codex_read_reply` 相同的 thread、receipt 與選用 cursor，另加選用的整數 `waitMs`（1 到 20,000，預設 20,000）。它最多做三次讀取快照，每次之間暫停兩秒。時間預算包含所有 helper 與暫停；每個快照都重用既有的範圍限定讀取驗證與文字限制。每次等待最多可能有九次循序 helper 呼叫。觀察年齡從最後一次成功快照的開始起算，包含其中繼資料讀取與 helper 清理。等待與主機的四個操作上限共用。每次等待在整個存續期間占用一個名額：最多 20 秒的等待，加上終止其 helper 的時間。四個並行的等待可能使傳送與中繼資料呼叫回傳忙碌；超出的呼叫會被拒絕而不是排隊。需要保留傳送容量時，請減少平行等待。

等待只讀取已儲存的資料；它不會恢復未載入的接收端。需要繼續工作時，使用者透過原生 Codex 用戶端開啟／恢復所選對話。訊息送出與回覆等待維持為各自獨立的呼叫。

符合資格的最終文字會立即回傳 `waitOutcome: reply_observed`，即使該文字早已存在。這不是新訊息訂閱，也不是獨占回覆所有權。有歧義的輸入回傳 `ambiguous`。沒有符合資格文字但下一頁非空時回傳 `needs_pagination`；把 `nextCursor` 傳回以繼續。此工具不會默默掃描所有歷史。

否則，工具會重新整理已比對的回合，或重複相同的搜尋位置，直到時間或快照上限，並以最後一次成功的觀察回傳 `wait_exhausted`。`attempts` 計算嘗試的快照數，`lastObservationAgeMs` 描述該觀察的年齡。只有在其背後每次讀取都於期限前完成時，快照才算數；在期限之後才完成的 helper 關閉不會丟棄這種快照，而讀取較晚完成的快照即使資料看起來有效也視為已過期。沒有任何成功觀察的逾時、讀取失敗或取消為 unavailable。讀取失敗不會被轉換成空的成功等待。

來自另一個 helper 的已儲存 `turnStatus` 可能與執行中伺服器的即時狀態不同，所以即使已儲存的終止狀態也不會讓等待提早結束。重新整理會重訪部分寫入的項目；呼叫者仍要自行管理分頁與更新項目 ID。取消／中斷連線會清除暫停並回收其擁有的 helper。主機不新增背景監看、自動投遞、建立或恢復工作階段。

## 探索與傳送

```bash
ocx message sessions --json
printf '%s\n' 'Please review the current change and send your findings back.' |
  ocx message send --name 'reviewer' --stdin --json
```

探索只回傳已載入對話的 ID、名稱與執行狀態，不含歷史、預覽或工作目錄。請使用一個精確的 UUID（`--thread`）
或唯一且精確的名稱（`--name`）。目的地缺少、重複、不完整或未載入都會失敗；不做模糊比對，
也不會退回到已儲存的對話。

既有的控制 socket 會在有效的 `CODEX_HOME` 之下解析，採用與其他 Codex 整合指令相同的 home 政策。
連線之前，解析出的 socket 必須由你的 uid 擁有且確實是 socket。從它一路到根目錄的每一層真實父目錄，
都必須由你的 uid 或 root 擁有，且不得為群組／其他人可寫，但 `/tmp` 這類 root 擁有的 sticky 目錄除外。
符號連結的 home 在其解析後的路徑通過檢查時允許使用。不受信任的路徑會以 `untrusted_socket` 失敗，
且不顯示解析後的路徑細節。

探索、最後一次已載入目標檢查與排入佇列都使用同一條連到該 socket 的連線。不會使用原生 CLI 輔助程序，
也不會進行安裝、修復或重新連線。不支援本機佇列的 daemon 會回傳 `unsupported_queue`。

只接受 UTF-8 的 stdin，非空文字最多 16 KiB 且不得含 NUL。一個 30 秒的期限涵蓋輸入、探索、重新驗證與送出。
每個 RPC 上限為 10 秒。完整信封上限為 32 KiB。訊息文字透過 Unix RPC 連線傳送，絕不放進衍生程序的引數。

## 寄件者與回覆

包裝器會產生訊息 UUID，並從已載入的 `CODEX_THREAD_ID` 與 daemon 中繼資料附上寄件者 ID／名稱。
此上下文**不是經過驗證的對等授權**，也絕不授予使用者核准或權限提升。無效或未載入的宣稱寄件者會失敗；
沒有上下文時維持未知，不猜測回覆路由。對等訊息以文字排入佇列，不是權限核准或設定覆寫。
接收端代理的駕馭層會執行它自己的權限；信封中的指引不是技術上的授權邊界，也不保證模型行為。

預設種類是 `request`。請使用信封中產生的 `replyCommand` 回答，或明確關聯一個回應：

```bash
printf '%s\n' 'Review findings: ...' |
  ocx message send --thread <sender-thread-uuid> --kind response \
    --in-reply-to <request-message-uuid> --stdin --json
```

`response` 需要 `--in-reply-to`；其他種類會拒絕它。請用 `--kind notification` 發送知會。
回應與通知不要求確認。一般代理的最終答案不會回送給它的對等端；不得猜測缺少的路由。
不會引入全域提示詞變更或確認迴圈。

## 收據與結束碼

`--json` 會輸出一份有版本的收據（`ocx-message/1`），內含訊息 UUID、種類、回應關聯、寄件者／目標中繼資料與送出狀態。
它絕不包含內文或原始 daemon 輸出。收據產生之前的輸入／設定失敗使用 `ocx-message-error/1` 與 `not_sent`；
探索失敗使用同一個錯誤 schema，但沒有送出狀態。無效的用法會在任何 I/O 之前以結束碼 64 輸出到 stderr。

| 狀態 | 結束碼 | 意義 |
| --- | --- | --- |
| `not_sent` | 1 | 驗證／探索／重新驗證失敗、未寫入任何佇列框，或 daemon 明確拒絕。 |
| `queued` | 0 | 有具關聯性的 daemon 回應確認送出，**不代表**收件者已處理。 |
| `unknown` | 3 | 送出可能已發生，但確認遺失、格式錯誤、不相符或被取消。**不要重送。** |

應用程式的訊息 UUID 同時是佇列請求的 `clientUserMessageId`。daemon 的送出 ID 則是另一個值；
兩者都不能證明收件者已處理。排入佇列不是引導（steering），可能要等忙碌中的回合結束。
OpenCodex 不會自動重送、後續探測、持久化或監看投遞。最後一次已載入目標檢查與佇列送出不是原子操作：
若目標隨後被卸載，明確拒絕為帶有 `queue_rejected` 的 `not_sent`；回覆遺失或無效則為 `unknown`。
OpenCodex 不會恢復該對話，也不會重試。

## 明確指定的遠端對等端

遠端訊息傳遞獨立於 Remote Link 與一般的 proxy 啟動。它不會重新導向供應商、不共用供應商憑證，
也不會啟動原生 daemon。兩個節點都需要相容的 OpenCodex CLI 與既有、支援佇列的 daemon。
Linux 有獨立的互通性證據；macOS 需要自己的資格驗證。不支援 Windows 的遠端傳輸。

在每個節點上，明確啟用訊息傳遞。在接收端節點上，讓前景擁有者持續執行：

```bash
ocx message enable --port 39176 --json
ocx message serve --json
```

在發起端節點上，使用你既有的 OpenSSH 目的地／別名。確認之前，請先對照可信來源檢查所提供的指紋：

```bash
ocx message hosts probe --ssh worker --json
ocx message hosts add worker --ssh worker --fingerprint 'SHA256:<confirmed-key>' --json
ocx message hosts list --json
ocx message serve --host worker --json
```

即使你一般的 SSH 設定啟用了 `HashKnownHosts`，私有的探測記錄仍保留加別名前綴的格式；你一般的 known_hosts 檔案不會被更動。
每次登記嘗試都使用自己以交易區分、固定金鑰的暫存檔，並在其 SSH 輔助程序結束後移除（包含失敗時），
且不依賴另一個變更擁有者的鎖。若無法確認清理完成，指令會回報未知的儲存結果，而不是成功。復原日誌是獨立的。

`hosts add worker` 授權的是送往 `worker` 的外送訊息，**不是任意訊息傳回這個發起端節點**。
SSH 控制交換使用你既有的 SSH 登入，在接收端節點授權該外送方向。登記收據與 `hosts list` 會顯示每個節點的本機入站政策。
在發起端節點上預設為 `responses-only`：對等端只能看到並回覆原本的本機寄件對話，且僅限等候本節點所送請求的具關聯性回應。
回應必須符合請求 UUID、登記與原本的本機目的地；它不能指向另一個對話，也不能變成未經請求的 request／notification。

若要在任一節點授予更廣的存取，請在該節點上明確執行：

```bash
ocx message hosts allow-inbound <peer-alias-or-machine-uuid> --json
# Withdraw the broad grant without removing enrollment:
ocx message hosts deny-inbound <peer-alias-or-machine-uuid> --json
```

`allow-inbound` 允許三種訊息種類進入**任何已載入的本機 Codex 對話**，並向該對等端暴露它們的目錄中繼資料。
它不是 responses-only 的授權。同意變更會在後續讀取／送出之前套用到既有連線。
沒有本機入站政策的舊記錄預設為 `responses-only`，而不是廣泛存取。
回覆路由以每個前景擁有者 256 個未完成請求為上限，並在 24 小時後或擁有者退休／重新啟動時到期。
沒有寄件者上下文就沒有回覆路由。已排入佇列或不確定的回應會用掉其路由；明確的原生拒絕則不會。
到期或遺失的路由需要操作者／寄件者明確對帳，絕不自動重送。

每個 `serve` 都由前景擁有：請讓它持續執行，並使用另一個終端機進行訊息傳遞。最多可提供四個不同的 `--host` 選擇。
不會安裝任何服務，也不會自動啟動擁有者。SSH 使用已確認的固定主機金鑰與你設定的金鑰／agent；密碼提示已停用。
包裝器擁有僅限 loopback 的正向與回程路由，因此接收端節點可以在不需要 SSH 登入回發起端的情況下傳送具關聯性的回覆，並受上述政策約束。

```bash
ocx message status --json
ocx message sessions --host worker --json
printf '%s\n' 'Please review and reply using the supplied route.' |
  ocx message send --host worker --name reviewer --stdin --json
```

`--host` 選擇一個精確的已登記別名或機器 UUID。回覆指令包含已驗證的來源機器 UUID 與對話 UUID；
來源身分在來源 daemon 上解析，而不是從遠端目錄猜測。沒有寄件者上下文時，不會憑空產生回覆指令。
不帶 `--host` 的本機指令維持其無狀態／無 SSH／無 listener 的路徑。
接收端會對照已驗證的機器與原生訊息 UUID，驗證完整的標準信封，包含回覆主機／指令與標準的 peer 指引。
對等端不能把包裝器標示為另一台機器，也不能省略其「非使用者訊息」警告。
對話名稱與對話 ID 仍只是該機器的描述性宣稱，不是逐對話的驗證。

接收端核發的方向性憑證存放在 `OPENCODEX_HOME`（或預設的 OpenCodex 設定家目錄）下的私有訊息狀態中。
它們絕不出現在一般指令輸出、輔助程序引數、URL 或訊息信封裡。相互證明會在原生／內文框之前驗證實際的 WebSocket 連線。
單獨的健康探測不足以作為身分證據。這是 OpenCodex 閘道協定：原始的 `codex queue --remote` 並未實作它的驗證握手。
閘道使用相同的原生實驗性 `thread/queue/add` 契約；它不會更動 Codex 自己的 `--ws-auth`、設定或原生 bearer-token listener。
它只暴露已載入的中繼資料與文字排入佇列，不提供一般的 app-server 控制。

狀態會區分已啟用的設定、執行中的擁有者，以及已發起／已租用的路由。回程租約在 25 秒沒有更新後到期；
它們不是投遞或處理收據。路由遺失或擁有者設定變更，需要明確重新啟動擁有者。傳輸復原絕不重送不確定的訊息。

```bash
ocx message hosts remove worker --json
ocx message disable --json
```

移除時會先撤銷本機准入；未能確認遠端清理時以結束碼 3 結束，並且需要在該對等端也執行移除。
每次外送的移除都使用獨立、固定金鑰的暫存檔；準備該檔案失敗時，仍會回報本機已移除與遠端清理未確認。
無論成功或失敗，都會嘗試清理暫存檔。產生的清理指引使用
`hosts remove <machine-uuid> --transaction <enrollment-uuid> --json`；交易防護會拒絕舊的收據，而不是移除較新的登記。
沒有這個選用防護的一般移除，仍會移除目前選定的對等端。
停用（disable）會讓目前的擁有者世代退休；派送會立即拒絕新工作，前景擁有者會在其十秒的維護間隔內察覺設定變更。
寄件端在派送前會立刻再次檢查本機授權；派送之後的撤銷無法召回已在途中的訊息或已被接受的原生工作。
遺失登記回應時會保留一筆私有交易：請重複完全相同的 add 指令來對帳，而不是在同一個啟用世代內以另一個名稱重新登記。
停用／重新啟用或變更連接埠會使該復原世代失效。已完成或已撤銷的交易無法還原已移除的對等端，也無法抹除另一筆登記的復原記錄。
若已儲存的本機日誌含有格式錯誤的 JSON、記錄形狀或欄位值，`hosts add`、`hosts list`、`status` 與 `hosts abandon`
會以 `invalid_enrollment_journal` 拒絕。其位元組會保留供操作者明確復原；OpenCodex 不會自動修復、取代或刪除它。
此情況下 `hosts add` 不會送出登記控制請求，但其前置的主機金鑰探測仍可能執行。
不安全的儲存或忙碌中的變更鎖，仍保留各自獨立的錯誤分類。
若有效的日誌已無法再對帳，請檢查 `ocx message hosts list --json` 或 `ocx message status --json` 中的
`pendingEnrollment`（別名、交易 UUID，以及其世代是否已過期），然後明確放棄那份確切的本機日誌：

```bash
ocx message hosts abandon --transaction <pending-transaction-uuid> --json
```

放棄在停用狀態下也能運作。它不更動既有的對等端、不重試登記，並因為遠端清理未確認而以結束碼 3 結束。
若仍有孤立的登記殘留，請在遠端節點上依其清理指引處理。過期的日誌不會被默默刪除。
已滿的接收端會回傳 `peer_capacity` 且不登記；請釋出一個名額後重複相同的交易，或明確放棄它。
格式錯誤或遺失的控制回覆仍視為不確定。
既有且受信任的 0755 設定家目錄會被接受而不執行 chmod；訊息傳遞自己的子目錄仍維持私有。
立即重新啟動擁有者時，若新端點通過驗證，且舊端點在一秒的檢查內不再通過驗證，就可以取代過期的回程租約。
仍在通過驗證的舊端點會保有其租約直到到期；暫時無法連線可以允許接手，但不允許重送。
非預期的通道遺失會明顯地讓前景擁有者退休；刻意移除對等端則讓不相關的路由繼續執行。
當機造成的變更鎖會失敗關閉，需要操作者復原；包裝器絕不會猜測舊鎖已被遺棄。
狀態與復原日誌的發布，在相依的遠端工作之前，會同步檔案與其所在目錄；移除日誌時也會同步其目錄。
`remote_storage_unknown`（結束碼 3）表示無法確認該儲存變更的當機持久性。在 macOS 上，檔案取代之後的 ACL 拒絕或探測失敗也會回報此代碼：
新狀態已可見，但其 ACL 私密性與當機持久性未確認。請先檢查狀態與權限再進行明確復原，而不是自動重試或回滾。
可安全讀取但 JSON 或 schema 格式錯誤的日誌不會阻擋移除對等端，但會保留供操作者復原；不安全的儲存，
以及無法使相符日誌失效時，仍會拒絕移除。

前景擁有者在所有對等端之間共用有限的連線／請求／輔助程序／緩衝上限，並在過載時拒絕而不使用無上限佇列：
已登記的對等端合計最多可持有十二條已驗證連線，另外四條保留給擁有者自己的控制、外送探測與續租，
並且最多八個通道子程序與兩個暫時性的控制／檢查輔助程序，合計十個。整個選定對等端批次的設定受 30 秒限制。
啟動成功之前會先進行最後一次租約續租。若 SSH 回報選定的轉送連接埠遺失，設定會關閉所擁有的那一對並選擇新的連接埠，
在同一個期限內最多嘗試三次。SSH 轉送確認、loopback 檢查與已驗證的對等端就緒狀態都必須成功。
其他設定失敗會立即停止；已發布的路由不會自動重新連線。最後與定期的續租批次各有五秒期限（適用時在設定期限之內），
定期維護每十秒執行一次。取消只會停止所擁有的 SSH 輔助程序／listener；不會動 Codex daemon、對話與不相關的 proxy。
清理也會結算已撤回的通道路由。直接子程序的結束與管線的自然 EOF 都必須在三秒的清理上限內完成；否則清理即未完成，
輔助程序的名額仍持續計費。取消保留的管線並不證明後代程序已結束。分離的後代程序，或關閉了繼承管線的後代程序，不會被追蹤。
輔助程序的 stdout 擷取上限為 64 KiB；stderr 會被丟棄，不會顯示或儲存。擷取溢位之後，輔助程序會被停止，
被丟棄的輸出會讀取到自然 EOF 為止。成功的清理會回報原本的輸出錯誤；真正未完成的清理仍為 `cleanup_incomplete`，
並持續占用其輔助程序名額。同一 uid 的程序可以讀取私有登記狀態；機器驗證並不建立無法偽造的逐代理身分。
繞過此閘道的原生流量不受它控制。

Mesh、儀表板／快取控制、隔離、Claude 訊息傳遞、受管理的 skill 與閒置通知，仍不在這項貢獻的範圍內。

## 明確指定既有伺服器的恢復檢查

**缺少原生原子條件式 resume 支援，目前不執行恢復。** 這個待定的工具無法用已檢查的 Codex 0.166.0 API
安全地恢復未載入的對話。它只做有界的前置檢查並回傳拒絕，不執行排入佇列的工作。
佇列與已儲存回覆工具仍獨立可用。

要開放這個前置檢查工具，請設定全部三個引數：

```sh
ocx message mcp --codex /absolute/path/to/codex --codex-home /absolute/path/to/.codex --allow-reply-read --allow-resume --resume-socket /absolute/path/to/existing.sock --resume-permissions :read-only
```

socket 必須是既有、可信的本機 Unix App Server，且回報同一個標準 Codex home。不會安裝或啟動任何伺服器。
精確的對話 UUID 會先正規化，再做只查中繼資料的查詢。已觀察到載入且閒置／活躍的目標回傳 `already_loaded`；
不健康的目標則拒絕。對於未載入的目標，若政策受管理、API 不支援、中繼資料無效，或 profile 缺失／不允許／未觀測，一律拒絕。
profile 由主機設定，絕不由工具引數或排入佇列的訊息設定。此檢查在目標 cwd 中最多讀取一頁、50 個 profile 的有界目錄。

即使這些檢查通過，結果仍是 `not_resumed` 與 `resume_atomicity_unsupported`，不會送出 `thread/resume`。
另一個用戶端可能在中繼資料讀取與恢復之間載入並取消訂閱該對話；已檢查的原生伺服器可以用提供的權限取代該閒置快取項目。
用戶端鎖或第二次讀取無法消除這個視窗。要執行，需要原生的「僅限未載入」條件，並在變更執行中對話之前以原子方式強制；
已檢查的版本中沒有受支援的條件式 resume API。請勿繞過此拒絕，不要從版本字串推定安全，
也不要把確認當成撤回已啟動工作的方式。

`executionVerified` 永遠為 false。此工具不啟動對話或回合、不變更權限，也不回答核准請求。
每次呼叫共用 20 秒預算與主機的四個操作上限；同一 UUID 的重疊呼叫會被拒絕。
斷線只關閉 bridge 連線。網路／SSH 端點與 Windows 不在此工具的範圍內。
