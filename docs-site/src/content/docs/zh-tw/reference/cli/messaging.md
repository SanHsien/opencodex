---
title: Local Codex Messaging
description: Discover loaded local Codex sessions and submit one correlated queued message.
---

`ocx message` is an opt-in surface for existing Codex sessions.
It starts no proxy or app-server, resumes no thread and installs no skill.
Linux/macOS Unix sockets are supported; Windows fails explicitly. The existing
Codex daemon must support experimental `thread/queue/add`. No CLI version pin or
`CODEX_CLI_PATH` selection is required.

## 選擇性啟用：讀取已儲存的回合回覆

在 MCP 佇列主機（`ocx message mcp`）既有的參數後加上 `--allow-reply-read`，會多開放第三個工具 `codex_read_reply`。不加這個旗標時，原有的兩個工具與只含中繼資料的探索行為完全不變。這個選項明確允許對話文字抵達 MCP 用戶端；本機使用者能存取所選家目錄，並不等於對個別專案或對話串的授權。用戶端訊息 ID 只是對應資料，不是憑證，也不代表使用者許可。

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

### Bounded reply waiting

`codex_wait_reply` 接受與 `codex_read_reply` 相同的 thread、receipt 與選用 cursor，另加選用的整數 `waitMs`（1 到 20,000，預設 20,000）。它最多做三次讀取快照，每次之間暫停兩秒。時間預算包含所有 helper 與暫停；每個快照都重用既有的範圍限定讀取驗證與文字限制。每次等待最多可能有九次循序 helper 呼叫。觀察年齡從最後一次成功快照的開始起算，包含其中繼資料讀取與 helper 清理。等待與主機的四個操作上限共用。每次等待在整個存續期間占用一個名額：最多 20 秒的等待，加上終止其 helper 的時間。四個並行的等待可能使傳送與中繼資料呼叫回傳忙碌；超出的呼叫會被拒絕而不是排隊。需要保留傳送容量時，請減少平行等待。

等待只讀取已儲存的資料；它不會恢復未載入的接收端。需要繼續工作時，使用者透過原生 Codex 用戶端開啟／恢復所選對話。訊息送出與回覆等待維持為各自獨立的呼叫。

符合資格的最終文字會立即回傳 `waitOutcome: reply_observed`，即使該文字早已存在。這不是新訊息訂閱，也不是獨占回覆所有權。有歧義的輸入回傳 `ambiguous`。沒有符合資格文字但下一頁非空時回傳 `needs_pagination`；把 `nextCursor` 傳回以繼續。此工具不會默默掃描所有歷史。

否則，工具會重新整理已比對的回合，或重複相同的搜尋位置，直到時間或快照上限，並以最後一次成功的觀察回傳 `wait_exhausted`。`attempts` 計算嘗試的快照數，`lastObservationAgeMs` 描述該觀察的年齡。只有在其背後每次讀取都於期限前完成時，快照才算數；在期限之後才完成的 helper 關閉不會丟棄這種快照，而讀取較晚完成的快照即使資料看起來有效也視為已過期。沒有任何成功觀察的逾時、讀取失敗或取消為 unavailable。讀取失敗不會被轉換成空的成功等待。

來自另一個 helper 的已儲存 `turnStatus` 可能與執行中伺服器的即時狀態不同，所以即使已儲存的終止狀態也不會讓等待提早結束。重新整理會重訪部分寫入的項目；呼叫者仍要自行管理分頁與更新項目 ID。取消／中斷連線會清除暫停並回收其擁有的 helper。主機不新增背景監看、自動投遞、建立或恢復工作階段。

## Discover and send

```bash
ocx message sessions --json
printf '%s\n' 'Please review the current change and send your findings back.' |
  ocx message send --name 'reviewer' --stdin --json
```

Discovery returns only loaded thread IDs, names and runtime statuses, not history,
preview or working directories. Use one exact UUID (`--thread`) or a unique exact
name (`--name`). Missing, duplicate, incomplete or unloaded destinations fail;
there is no fuzzy matching or fallback to stored sessions.

The existing control socket is resolved under effective `CODEX_HOME`, using the
same home policy as other Codex integration commands. Before connecting, the
resolved socket must be owned by your uid and be a socket. Every real parent
through root must be owned by your uid or root and must not be group/other
writable, except root-owned sticky directories such as `/tmp`. Symlinked homes
are allowed when their resolved paths pass. Untrusted paths fail with
`untrusted_socket` and no resolved-path details.

Discovery, the final loaded-target check and queueing use one connection to that
socket. No native CLI helper, installation, repair or reconnection occurs. A
daemon without local queue support returns `unsupported_queue`.

Only UTF-8 stdin is accepted, at most 16 KiB of nonempty text without NUL. One
30-second deadline covers input, discovery, revalidation and submission. Each RPC
is capped at 10 seconds. The complete envelope is limited to 32 KiB. Message text
is sent over the Unix RPC connection and never placed in spawned process arguments.

## Sender and replies

The wrapper generates a message UUID and attaches sender ID/name from a loaded
`CODEX_THREAD_ID` and daemon metadata. This context is **not authenticated peer
authority** and never grants user approval or escalation. An invalid/unloaded
claimed sender fails; absent context stays unknown, without guessing a reply route.
Peer messages are queued as text, not permission approvals or configuration
overrides. The receiving agent's harness enforces its permissions; envelope
guidance is not a technical authorization boundary or a guarantee of model behavior.

The default kind is `request`. Answer by using the generated `replyCommand` in
the envelope, or explicitly correlate a response:

```bash
printf '%s\n' 'Review findings: ...' |
  ocx message send --thread <sender-thread-uuid> --kind response \
    --in-reply-to <request-message-uuid> --stdin --json
```

`response` requires `--in-reply-to`; other kinds reject it. Use `--kind notification`
for an FYI. Responses and notifications do not request acknowledgements. A normal
agent final answer is not sent back to its peer; missing routes must not be guessed.
No global prompt changes or acknowledgement loops are introduced.

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

## Receipts and exit codes

`--json` emits one versioned receipt (`ocx-message/1`) containing message UUID,
kind, response correlation, sender/target metadata and submission status. It never
includes body text or raw daemon output. Input/setup failures before a receipt
exists use `ocx-message-error/1` with `not_sent`; discovery failures use the same
error schema without a send status. Invalid usage exits 64 on stderr before I/O.

| Status | Exit | Meaning |
| --- | --- | --- |
| `not_sent` | 1 | Validation/discovery/revalidation failed, no queue frame was written, or the daemon explicitly rejected it. |
| `queued` | 0 | A correlated daemon response acknowledged submission, **not processing** by the recipient. |
| `unknown` | 3 | A submission may have occurred, but acknowledgement was lost, malformed, mismatched or cancelled. **Do not replay.** |

The application message UUID is also the queue request's `clientUserMessageId`.
The daemon's submission ID is separate; neither proves recipient processing.
Queueing is not steering and can wait for a busy turn to end. OpenCodex performs
no automatic replay, follow-up probing, persistence or delivery monitoring.
The final loaded-target check and queue submission are not atomic: if the target
unloads afterwards, an explicit rejection is `not_sent` with `queue_rejected`;
a lost or invalid reply is `unknown`. OpenCodex does not resume it or retry.

## Explicit remote peers

Remote messaging is independent of Remote Link and normal proxy startup. It does
not redirect providers, share provider credentials or start a native daemon.
Both nodes need a compatible OpenCodex CLI and an existing queue-capable daemon.
Linux has isolated interoperability evidence; macOS requires its own qualification.
Windows remote transport is unsupported.

On each node, explicitly enable messaging. On the receiving node, keep the
foreground owner running:

```bash
ocx message enable --port 39176 --json
ocx message serve --json
```

On the initiating node, use your existing OpenSSH destination/alias. Check the
offered fingerprint against a trusted source before confirming it:

```bash
ocx message hosts probe --ssh worker --json
ocx message hosts add worker --ssh worker --fingerprint 'SHA256:<confirmed-key>' --json
ocx message hosts list --json
ocx message serve --host worker --json
```

Private probe records keep their alias-prefixed format even when your normal SSH
configuration enables `HashKnownHosts`; your normal known_hosts file is not changed.
Each enrollment attempt uses its own transaction-qualified pinned-key scratch file,
removed after its SSH helper settles, including failures, without depending on another
mutation owner's lock. If cleanup cannot be confirmed, the command reports an unknown
storage outcome, not success. The recovery journal is separate.

`hosts add worker` authorizes outbound messages to `worker`, **not arbitrary messages
back into this initiating node**. The SSH control exchange authorizes that outbound
direction at the receiving node using your existing SSH login. The enrollment receipt
and `hosts list` show each node's local inbound policy. On the initiating node the
default is `responses-only`: the peer can see and reply only to original local sender
sessions awaiting a correlated response to a request this node sent. A response must
match the request UUID, enrollment and original local destination; it cannot target
another session or become an unsolicited request/notification.

To grant broader access on either node, explicitly run on that node:

```bash
ocx message hosts allow-inbound <peer-alias-or-machine-uuid> --json
# Withdraw the broad grant without removing enrollment:
ocx message hosts deny-inbound <peer-alias-or-machine-uuid> --json
```

`allow-inbound` permits all three message kinds into **any loaded local Codex session**
and exposes their directory metadata to that peer. It is not a responses-only grant.
Consent changes apply to existing connections before subsequent reads/submissions.
Older records without a local inbound policy default to `responses-only`, not broad access.
Reply routes are bounded to 256 outstanding requests per foreground owner and expire
after 24 hours or owner retirement/restart. No sender context means no reply route.
A queued or uncertain response consumes its route; a definite native rejection does not.
An expired/lost route requires explicit operator/sender reconciliation, never automatic replay.

Each `serve` is foreground-owned: keep it running and use a separate terminal
for messaging. At most four distinct `--host` selections may be supplied. Nothing
installs a service or starts an owner automatically. SSH uses confirmed pinned
host keys and your configured keys/agent; password prompts are disabled. The
wrapper owns loopback-only forward and return routes, so the receiving node can send
correlated replies without an SSH login back to the initiator, subject to the policy above.

```bash
ocx message status --json
ocx message sessions --host worker --json
printf '%s\n' 'Please review and reply using the supplied route.' |
  ocx message send --host worker --name reviewer --stdin --json
```

`--host` selects an exact enrolled alias or machine UUID. Reply commands include
the validated source machine UUID and thread UUID; source identity is resolved on
the source daemon, not guessed from a remote directory. Without sender context,
there is no invented reply command. Local commands without `--host` retain their
no-state/no-SSH/no-listener path.
The receiver validates the complete canonical envelope against the authenticated
machine and native message UUID, including reply host/command and standard peer guidance.
A peer cannot label the wrapper as another machine or omit its non-user-message warning.
Session names and thread IDs remain descriptive claims by that machine, not per-session authentication.

Receiver-issued directional capabilities live in private messaging state under
`OPENCODEX_HOME` (or the default OpenCodex configuration home). They never appear in
normal command output, helper arguments, URLs or message envelopes. Mutual proofs
authenticate the actual WebSocket connection before native/body frames. A separate
health probe is not sufficient identity evidence. This is an OpenCodex gateway
protocol: raw `codex queue --remote` does not implement its authentication handshake.
The gateway uses the same native experimental `thread/queue/add` contract; it does
not alter Codex's own `--ws-auth`, configuration or native bearer-token listeners.
It exposes only loaded metadata and text queueing, not general app-server control.

Status distinguishes enabled configuration, a running owner and initiated/leased
routes. Return leases expire after 25 seconds without refresh; they are not delivery
or processing receipts. Losing a route or changing owner configuration requires
explicit owner restart. Transport recovery never resends an uncertain message.

```bash
ocx message hosts remove worker --json
ocx message disable --json
```

Removal revokes local admission first; an unconfirmed remote cleanup exits 3 and
requires removal on that peer too. Each outgoing removal uses an independent pinned-key
scratch file; a failure preparing that file still reports local removal and unconfirmed
remote cleanup. Scratch cleanup is attempted on both success and failure. Generated cleanup guidance uses
`hosts remove <machine-uuid> --transaction <enrollment-uuid> --json`; the transaction
guard refuses an old receipt rather than removing a newer enrollment. Ordinary removal
without this optional guard still removes the currently selected peer.
Disable retires the current owner generation;
dispatch refuses new work immediately, and the foreground owner notices changed
configuration within its ten-second maintenance interval. The sender checks local
authority again immediately before dispatch; revocation after dispatch cannot recall
an in-flight message or already accepted native work. A lost enrollment response retains one private
transaction: repeat the exact same add command to reconcile, rather than enrolling
under another name within the same enabled generation. Disable/re-enable or port
changes invalidate that recovery generation. Completed or revoked transactions cannot
restore a removed peer or erase another enrollment's recovery record.
If the saved local journal has malformed JSON, record shapes or field values,
`hosts add`, `hosts list`, `status` and `hosts abandon` refuse with
`invalid_enrollment_journal`. Its bytes are preserved for explicit operator recovery;
OpenCodex does not repair, replace or delete it automatically. `hosts add` sends no
enrollment control request in this case, although its preliminary host-key probe may run.
Unsafe storage or a busy mutation lock retains its separate error classification.
If a valid journal can no longer be reconciled, inspect `ocx message hosts list --json` or
`ocx message status --json` for `pendingEnrollment` (alias, transaction UUID and whether
its generation is stale), then explicitly abandon that exact local journal:

```bash
ocx message hosts abandon --transaction <pending-transaction-uuid> --json
```

Abandonment works while disabled too. It leaves existing peers unchanged, does not retry
enrollment and exits 3 because remote cleanup is unconfirmed. Follow its cleanup guidance
on the remote node if an orphan enrollment remains. Stale journals are not silently deleted.
A full receiver returns `peer_capacity` without enrolling; free a slot and repeat the same
transaction or explicitly abandon it. Malformed or lost control replies remain uncertain.
Existing trusted 0755 configuration homes are accepted without chmod; messaging's own
subdirectory remains private. An immediate owner restart can replace a stale return lease
after the new endpoint authenticates and the old endpoint no longer authenticates within a
one-second check. A still-authenticating old endpoint retains its lease until expiry;
temporary unreachability can permit takeover, not replay. Unexpected tunnel loss visibly
retires the foreground owner; deliberate peer removal leaves unrelated routes running.
Crash mutation locks fail closed and need operator recovery;
the wrapper never guesses that an old lock is abandoned.
State and recovery-journal publication sync the file and containing directory before dependent
remote work; journal removal also syncs its directory. `remote_storage_unknown` (exit 3) means
the storage change's crash durability could not be confirmed. On macOS, an ACL refusal or probe
failure after file replacement also reports this code: the new state is already visible, but its
ACL privacy and crash durability are unconfirmed. Inspect state and permissions before explicit
recovery rather than automatically retrying or rolling back. A safely readable journal with malformed
JSON or schema does not block peer removal, but is retained for operator recovery; unsafe storage and
failure to invalidate a matching journal still refuse removal.

The foreground owner shares finite connection/request/helper/buffer limits across
all peers and rejects overload without an unbounded queue: enrolled peers together may
hold twelve authenticated connections, four more stay reserved for the owner's own
control, outgoing probes and renewal, and at most eight tunnel
children and two transient control/inspection helpers, ten total. Setup is bounded by
30 seconds across the whole selected peer batch. A final lease renewal precedes startup
success. If SSH reports that a selected forward port was lost, setup closes the owned
pair and selects fresh ports, up to three attempts within that same deadline. SSH forward
confirmation, loopback checks and authenticated peer readiness must all succeed. Other
setup failures stop immediately; published routes do not reconnect automatically. Final
and periodic renewal batches have five-second deadlines, within the setup
deadline where applicable, and periodic maintenance runs every ten seconds.
Cancellation stops only owned
SSH helpers/listeners; it leaves Codex daemons, threads and unrelated proxies alone.
Cleanup joins withdrawn tunnel routes too. Direct-child exit and natural pipe EOF must
both settle within the three-second cleanup ceiling; otherwise cleanup is incomplete and
the helper reservation remains charged. Cancelling retained pipes does not prove descendants
exited. Detached descendants or descendants that close inherited pipes are not tracked.
Helper stdout capture is limited to 64 KiB; stderr is discarded without being printed or stored.
After capture overflow, the helper is stopped and discarded output is drained to natural EOF.
Successful cleanup reports the original output error; genuinely incomplete cleanup remains
`cleanup_incomplete` and keeps its helper reservation charged.
Same-uid processes can read private enrollment state; machine authentication does
not establish non-forgeable per-agent identity. Native traffic bypassing this gateway
is not controlled by it.

Mesh, dashboard/cache controls, isolation, Claude messaging, managed skills and
idle notifications remain outside this contribution.

