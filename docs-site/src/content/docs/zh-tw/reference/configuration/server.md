---
title: 伺服器與執行階段設定
description: 監聽器、遠端存取、許可金鑰、逾時、儲存、sidecar、shadow call 與啟動行為。
---

伺服器設定控制本機代理如何監聽、保護遠端流量、管理資源，並在供應商請求周圍執行輔助功能。

## 伺服器欄位

| Field | Type | Default | Meaning |
| --- | --- | --- | --- |
| `port` | `number` | `10100` | Proxy listen port. |
| `hostname?` | `string` | `"127.0.0.1"` | Bind address. A non-loopback bind requires a data-admission token, resolved from `OPENCODEX_API_AUTH_TOKEN`, then `OCX_API_TOKEN_FILE`, then the installed owner-only `service-api-token` — nothing has to be exported by hand. See [Remote access](#遠端存取). |
| `proxy?` | `string` | — | Outbound HTTP(S) or SOCKS5 proxy URL (`socks5://host:port`), `${ENV_VAR}`, or `"auto"`. HTTP URLs apply to `HTTP_PROXY` / `HTTPS_PROXY` when those are unset. SOCKS5 URLs use OpenCodex's real SOCKS5 transport and are also exposed through `ALL_PROXY` (`ocx start --socks5`); inherited `HTTP(S)_PROXY` is cleared in this process. Loopback stays in `NO_PROXY`. `"auto"` reads Windows WinINET or macOS static HTTP/HTTPS settings once at startup. Inherited HTTP(S) proxy variables skip discovery; on macOS, inherited `ALL_PROXY`/`all_proxy` also skips it. Windows keeps separate `http=` and `https=` entries; a bare `ProxyServer` applies to both. macOS translates IP literals, `*`, and a valid `*.<domain>` glob to Bun's `.<domain>` bypass. That glob also bypasses the bare apex `<domain>`. The exact link-local ranges `169.254/16`, `169.254.0.0/16`, and `fe80::/10` are omitted with a diagnostic: link-local IP literals use the proxy. Other CIDRs, globs, and simple-host exceptions refuse discovery without changing the proxy environment. Disabled, malformed, PAC/WPAD, SOCKS-only, and live changes are not followed. Restart after changing system settings. |
| `noProxy?` | `string \| string[]` | — | Hosts that bypass `proxy`, merged with inherited `NO_PROXY` and loopback entries. A string may use comma-separated `NO_PROXY` syntax or `${ENV_VAR}`. |
| `emptyCompletionRetry?` | `boolean` | `false` | Opt in to one identical Responses retry when a turn has no text or tool call, including a stream that ends before a terminal event and a Vertex AI `MALFORMED_FUNCTION_CALL` failure that arrives before any output. The retry may be billable. `OCX_EMPTY_COMPLETION_RETRY=0` disables it without changing config; combo and routed-compaction turns remain excluded. |
| `dropCodexSafetyBuffering?` | `boolean` | `false` | Remove optional client-facing hints from canonical Codex Responses passthrough: the two `x-codex-safety-buffering-enabled` / `x-codex-safety-buffering-faster-model` response headers, `response.metadata` events whose metadata type is `safety_buffering`, and top-level `safety_buffering` fields. Other headers, response data, policy refusals and failures are preserved. This does not disable provider safety enforcement or upstream buffering. Native `codex.response.metadata.headers` WebSocket metadata and `/responses/compact` are outside this filter. |
| `stallTimeoutSec?` | `number` | `300` (public) / disabled (local) | Seconds without meaningful upstream progress (Responses and native Chat) before the stream is cut. Unset, a **local** upstream (loopback, private, or a `.local`/`.lan` name) defaults to disabled and a public upstream to 300 s; a positive value applies to both (minimum 1 s); `0` disables the silence watchdog everywhere. Disabled leaves a silent-but-healthy local model connected (keep-alives still flow). Canonical ChatGPT Responses folded from SSE into non-streaming JSON retain a separate 15-minute whole-turn ceiling even when the silence watchdog is disabled. Pending `/v1/responses/compact` body reads share this budget but default to 300 s even for a local upstream — the route buffers the complete body while holding an active-turn lease — and an explicit value, including `0`, still wins. |
| `oauthOpenBrowser?` | `boolean` | `true` | Whether a login may open a browser on the machine running the proxy. Absent and `true` both open, so an existing install is unchanged; only an explicit `false` declines. Decline when you need the authorization link in a different browser profile, or when the dashboard is not on the proxy's machine — the login still starts and the URL is still returned and displayed. `POST /api/oauth/login` and `POST /api/codex-auth/login` accept a per-request `openBrowser` boolean that overrides this, and the dashboard exposes the same choice beside the login button. Both routes report the outcome as `browserLaunch`: `started`, `failed` (nothing could be opened; the dashboard says so), or `skipped`. Device-code flows never open a browser either way. |
| `connectTimeoutMs?` | `number` | `200000` | Per-attempt DNS/TCP/TLS/final-header deadline; it ends before body generation. |
| `shutdownTimeoutMs?` | `number` | `5000` | Graceful drain deadline before active turns are aborted. |
| `websockets?` | `boolean` | `false` | Advertise and admit the client-facing Responses WebSocket path. False keeps clients on HTTP/SSE; it does not disable an eligible canonical ChatGPT upstream WS optimization. Complete-input requests may reuse an upstream connection within the same selected credential, account, thread and turn; changed handshake policy or missing identity keeps requests on separate connections. This does not trim HTTP input or create previous-response IDs. |
| `codexNativeSteering?` | `boolean` | `false` | Experimental, native-only mid-turn steering on the Responses WebSocket endpoint. Requires `websockets: true`, a compatible upstream/client, and a pinned account/model/tool surface. Validated generation settings can change in explicit saved-result continuations. Does not enable translated models or HTTP fallback. See [native steering](/zh-tw/guides/codex-integration/#實驗性原生對話中途-steering). |
| `codexNativeInjection?` | `boolean` | `false` | Experimental saved function-result injection on compatible native multi-agent WebSocket turns. Requires `websockets: true`, explicit `multi_agent.enabled`, and an eligible provider. Separate from steering; no automatic tool rerun or recovery create. See [native injection](/zh-tw/guides/codex-integration/#實驗性原生-function-result-注入). |
| `nativeReasoningRetention?` | `{ modelSwitch?: boolean; accountSwitch?: boolean }` | both `false` | Permit reasoning ciphertext forwarding across a known model or account change on the same canonical ChatGPT backend. Account retention is experimental. See [Native reasoning retention](#native-reasoning-retention). |
| `corsAllowOrigins?` | `string[]` | `[]` | Additional exact origins allowed by CORS. Loopback origins are always allowed. Authority-based browser extension origins such as `chrome-extension://<extension-id>` are supported; `*` is not a wildcard. Firefox and Safari regenerate the extension UUID (per install / per browser launch), so update the entry when the origin changes. |
| `apiKeys?` | `OcxApiKey[]` | `[]` | Generated `ocx_…` data-plane admission credentials on non-loopback binds. They do not authorize management APIs; management access uses the separate credential documented in the [management reference](/zh-tw/reference/management-api/). Dashboard-managed. |
| `storageCleanupPolicy?` | `StorageCleanupPolicy` | disabled | Opt-in archived-session cleanup policy. Never enabled implicitly. |
| `usageLedgerMaxBytes?` | `number` | unset | Opt-in ceiling in bytes for `usage.jsonl`. Absent means the request history grows without limit, which stays the default. See [usage history size](#用量歷史大小). |
| `appOwnedMemoryBudgetMb?` | `number` | `256` | Cap in MiB for evictable app-owned logs, caches, blobs, and continuation payloads. Range 64–4096; not an RSS cap. |
| `metricsExport.enabled?` | `boolean` | `false` | Enable process-local aggregate request metrics at authenticated `GET /api/metrics`. Restart required; disabled mode returns 404 and starts no exporter activity. |
| `serviceHealthRecovery.enabled?` | `boolean` | `false` | Opt-in recovery for the background service: a small sentinel process probes `/healthz` and, when the proxy stays alive but answers nothing for about a minute of back-to-back probes, terminates it so the service manager (Task Scheduler, launchd, systemd, WinSW) restarts it. Only the managed service child starts one; requests the stuck process held are not replayed. At most three recoveries per hour. Restart required. Automatic recovery requires a numeric bind address (or the default localhost/wildcard mapping); DNS bind names are not monitored. A changed recorded address or port stops monitoring. |
| `spend?` | `{ root?: { maxTokens?: number }; identity?: { maxTokens?: number }; pool?: { maxTokens?: number }; retentionDays?: number }` | unset | Durable token ceilings, off unless you write one. Each scope bounds settled spend plus in-flight reservations plus unresolved spend: `root` is one task including its whole fan-out, `identity` is one account across every task it serves, and `pool` is one provider pool. They intersect, so a request is admitted only when all three have room — which is what holds a ceiling against a client that mints a new task id per request. A reservation is the request's whole input plus its enforceable output ceiling, counted as if every cached prefix misses. Observe-only mode still journals, so every server owns the state directory's single-writer lease; an explicit sibling must use a separate `OPENCODEX_HOME`. Spend survives an ordinary process restart when its writes reached the filesystem, but the journal does not promise survival across host power loss because each append is not fsynced. Raising or removing a ceiling changes the allowance for requests started afterward; requests already running keep their starting policy. `maxTokens` must be a positive integer (0 would refuse everything), `retentionDays` is 1–365 and defaults to 7, and an unknown key in this section is rejected rather than ignored. A refusal is a local HTTP 429 carrying `x-opencodex-local-refusal: workflow_spend_exhausted`, and its message names the scope and the ceiling; no provider is contacted. With an applicable ceiling, dispatch is also refused if its token reservation cannot be booked, including full tracking capacity. Requests without an applicable ceiling remain observe-only. |

| `codexAutoStart?` | `boolean` | `true` | Let the Codex shim run `ocx ensure` before launching Codex. False makes ensure a no-op. |
| `codexShimAutoRestore?` | `boolean` | `true` | Restore an installed shim after a completed external Codex update replaces it. Environment opt-out: `OPENCODEX_CODEX_SHIM_AUTO_RESTORE=0`. |
| `codexDesktopAuthless?` | `boolean` | `false` | Opt-in authless Codex Desktop routing on a loopback bind: inject the dedicated `opencodex` provider with `requires_openai_auth = false` so Desktop opens without a ChatGPT login. Ignored on non-loopback binds. `ocx system settings --desktop-authless on`. See [Codex integration](/zh-tw/guides/codex-integration/#免登入-codex-desktop選擇加入). |
| `codexAccountPickerEnabled?` | `boolean` | unset | Whether generated account-qualified catalog rows (`<selector>/<model>`) are advertised. Enabling it once fills an absent or empty `codexAccountNamespaces` with default selectors; `false` hides the generated rows without deleting exact routing bindings. An omitted flag keeps a non-empty hand-written selector map enabled. The Luna Reserve row is account-qualified, so it is written only when a selector targets the main Codex account; when it is suppressed, catalog sync logs the reason and the action that restores it. |
| `codexAccountNamespaces?` | `Record<string, string>` | unset | Public selector to Codex account mapping. The main login maps to the config-only sentinel `@main`; added accounts map to their account id. Normally generated by enabling `codexAccountPickerEnabled` rather than hand-authored. An empty map means no account-qualified rows exist, including the Luna Reserve row. |
| `codexClientCompaction?` | `boolean` | `false` | Opt into Codex client-side compaction on an authenticated loopback bind. Uses the dedicated `opencodex` provider identity with `requires_openai_auth = true`, preventing new routed compactions from storing OpenCodeX-owned `ocx1:` state. `codexDesktopAuthless` takes precedence when both are enabled and keeps `requires_openai_auth = false`. V2 sub-agent routing is unchanged. `ocx system settings --client-compaction on`. See [Codex integration](/zh-tw/guides/codex-integration/#用戶端側壓縮選擇加入). |
| `codexProviderDisplayName?` | `string` | `"OpenCodex Proxy"` | Label Codex shows for the injected `opencodex` provider, written as its `name` field in `config.toml` and the reference profile. Presentation only: routing resolves through the provider id `opencodex`, so a rename never moves `model_provider = "opencodex"` or the `[model_providers.opencodex]` header and cannot orphan threads already tagged with that id. Codex refuses to load a provider with no name, so there is no way to omit the field — choose a neutral label instead. A blank, over-128-character, or control-character value is ignored and the default label is written. |
| `codexMainAccountHardLock?` | `boolean` | `true` | Block new identity-matched main-account requests at their per-window threshold. Only explicit `false` opts out. See [main-account protection](/zh-tw/reference/cli/providers-accounts/#主帳號額度保護). |
| `codexMainAccountHardLockThresholds?` | `{ short?: number; long?: number }` | `{ short: 90, long: 98 }` | Independent 5h and weekly/monthly thresholds. Integers 80–100, with `short <= long`. Invalid persisted fields fall back to defaults; the settings API rejects invalid writes before mutation. |
| `codexMainAccountHardLockFallback?` | `{ enabled?: boolean; model?: string; reasoningEffort?: string }` | off | Extended hard-lock settings: while the lock blocks and no Codex account can serve the request, qualifying native-Codex-model requests reroute to `model` with `reasoningEffort` instead of failing. `enabled: false` pauses the reroute and keeps the model. An absent section or model keeps the refusal behavior; a usable Pool account still serves first. `reasoningEffort` must be a declared effort; invalid persisted sections degrade to off and the settings API rejects invalid writes before mutation. See [main-account protection](/zh-tw/reference/cli/providers-accounts/#主帳號額度保護). |
| `nativeMainRefresh?` | `"codex" \| "opencodex"` | auto | Who refreshes the native main ChatGPT login in `CODEX_HOME`. `"codex"` asks the Codex binary (app-server `getAuthStatus`, Codex 0.130.0 or newer, found through the same runtime resolution as `ocx sync`, including the ChatGPT app bundle) and never writes `auth.json`; this also works when Codex stores its login in the OS keyring. `"opencodex"` keeps OpenCodex's guarded `auth.json` writer. Unset picks `"codex"` when a supported binary is found; without one, both unset and `"codex"` fall back to the guarded writer. `ocx doctor` shows the active mode under Native main refresh. |
| `resetCreditAutoRedeem?` | `{ enabled?: boolean; leadTimeMinutes?: number }` | off | Opt-in: redeem the main Codex account's soonest-expiring reset credit `leadTimeMinutes` (1–60, default 10) before it expires. Every attempt re-reads the upstream credit list first and skips when the credit is gone (for example, redeemed by hand); the `redeem_request_id` is journaled in `$OPENCODEX_HOME/reset-credit-auto-redeem.json` before the call so a crash replays the same idempotent request instead of spending a second credit. Servers sharing this configuration directory coordinate reservations and settlements so one process does not replace another's request record. Logs carry a hashed account key only. |
| `syncResumeHistory?` | `boolean` | `true` | Reversible Codex App history compatibility. Original metadata is backed up and restored by `ocx stop` / `ocx restore`. |
| `spendPoolAliases?` | `Record<string, string>` | unset | Explicit historical salted pool-alias to canonical provider mappings. Keep this key at the top level, outside `spend`. See [Historical pool continuity](#historical-pool-continuity). |
| `shadowCallIntercept?` | `{ enabled?: boolean; model?: string; sourceModels?: string[] }` | off | Redirect recognized Codex helper/shadow calls to a chosen model while preserving the request's configured reasoning effort. The default source prefixes are `gpt-6-luna` and `gpt-5.6-luna`; older clients through 0.144.x used `gpt-5.4-mini`, which `sourceModels` can restore. |
| `memoryModels?` | `{ extract?: { model: string; reasoningEffort?: string }; consolidation?: { model: string; reasoningEffort?: string } }` | off | Route Codex's two memory phases to a chosen model, with an optional reasoning effort per phase. See [Memory routing](#記憶體路由). |
| `webSearchSidecar?` | `OcxWebSearchSidecarConfig` | on when usable | Web-search sidecar options. |
| `visionSidecar?` | `OcxVisionSidecarConfig` | on when usable | Image-description sidecar options. |
| `images?` | `OcxImagesConfig` | automatic OpenAI selection | Standalone Images relay options for Codex `image_gen`. |

On Linux x64/arm64 with pidfd support, service health recovery binds termination to the proxy's
kernel process identity, so PID reuse cannot redirect it. The sentinel's watching log ends in
`(pidfd)`. Unsupported kernels or architectures retain the existing live-parent PID check and log
that fallback; other binding failures disable recovery for that proxy. macOS retains the live-parent
check, and Windows retains its process handle binding.
## Native reasoning retention

The dashboard overview exposes two independent opt-ins: retain reasoning when switching models, and retain it when switching accounts. Both default off. The same policy can be saved in `config.json`:

```jsonc
{
  "nativeReasoningRetention": {
    "modelSwitch": true,
    "accountSwitch": false
  }
}
```

This example retains reasoning `encrypted_content` on a known model switch within the same native ChatGPT destination and credential. Set `accountSwitch` to `true` only to opt into experimental cross-account forwarding. When both model and account change, both switches must be enabled. The policy applies to each actual native Combo target and pool retry; it does not grant retention to third-party or API-key destinations.

Retention means that OpenCodex may forward the carried ciphertext. It cannot confirm that the upstream accepts or reuses that reasoning. A detected decrypt rejection still enters the existing bounded cleanup recovery, and the rejection memo takes precedence over either switch. Response and conversation references, foreign reasoning item ids, uploaded-file account restrictions and cache isolation continue using their own ownership rules. Native compaction blocks keep their existing cleanup behavior; direct native `/v1/responses/compact` sanitization is unchanged.

Use `GET /api/native-reasoning-retention` to read the resolved booleans and `PUT` with a partial boolean object to update them. `PUT` with JSON `null` restores both defaults. Invalid fields or unknown keys are rejected; a malformed file block disables retention with a warning. Dashboard/API changes apply to subsequent requests. Local `ocx config set/unset` edits require a restart to converge the running proxy.

## Upstream transport recovery

While the canonical ChatGPT upstream WebSocket waits for the first Responses event after
sending the create frame, it watches for liveness rather than a fixed deadline. When the socket
supports protocol pings, the proxy pings it every 15 seconds. Any inbound frame — quota,
response metadata, or a pong — resets a 90-second silence clock, so a socket without ping
support still stays alive on its own frames, and only 90 seconds with nothing at all settles the request as an
HTTP 504 with an `upstream_no_response` error. A slow but alive origin therefore waits for the
client's own deadline or for `connectTimeoutMs` (default 200s), whichever comes first; a
connect timeout that fires after the create frame was sent settles as the same 504. A socket
that closes or errors before the first Responses event settles as an HTTP 502 with
`upstream_closed_before_response`. The proxy does not retry either status on its own: the frame
may already be executing upstream, so the client applies its own retry policy exactly as it would
when connected to the backend directly. The one exception is that 502 on a provider that opted
into `retryOnReset`, described below. Once the response has started, a later drop
surfaces inside the stream as before. `stallTimeoutSec` is unrelated to this window.

An ordinary HTTP send has a third case. When the connection dies before any response header
arrives, the proxy cannot tell whether the model already processed the request, so it refuses
to send it again and answers HTTP 429 with `upstream_reset_replay_refused`. The status is
deliberate: a 5xx here is an instruction to most clients, including Codex, to send the whole
turn again, which is the duplicate the refusal exists to prevent. No `Retry-After` is
attached, and the response carries `x-should-retry: false`, which the official OpenAI and
Anthropic SDKs read before their own status rules — without it those clients retry a 429 on
their own schedule and resend the turn anyway. The same replay-refusal behavior applies on
`/v1/responses` and `/v1/chat/completions`, whether the request is forwarded natively or translated.
Routed `/v1/messages` requests translate through Responses and project the same status, code, and
retry headers into an Anthropic-shaped error envelope. The proxy
performs no key rotation, account failover or same-target replay on it, nor does it record the
refusal as rate-limit or quota evidence against the credential it was holding. Tool-call side
requests such as vision and web search are replayed normally, because repeating them cannot
duplicate a turn.

Native ChatGPT Responses and compact HTTP requests whose serialized JSON strings are at least
1 MiB in UTF-8 use byte-buffer uploads to avoid Bun resetting a large string upload before response
headers arrive. This preserves the request
contents and does not enable automatic retries. A genuine connection reset still follows the
replay-refusal policy above.

A native Responses provider can opt into replacing that send with
[`retryOnReset`](/zh-tw/reference/configuration/providers/#供應商項目ocxproviderconfig). The same grant covers the
case where the connection survives the header and the SSE body then dies carrying only control
events, because the caller has observed nothing in either one. It also covers the canonical
ChatGPT WebSocket above: a socket that closes or errors before the first Responses event is
replaced by one HTTP send, never by a second socket. A silent socket keeps its 504, and a native
steering or injection turn is never replaced. A replacement happens only when
the request is self-contained (`store: false`, complete input, client-executed tools only, no
server-side continuation state), and one logical request gets the configured number of
replacements in total — across every recovery leg and every combo child, not one each. The
refusal returns as soon as that grant is spent, the leg has no send left, or a replacement fails
for any other reason. A request that already emitted output or a tool call keeps the refusal
regardless. A caller that cancels mid-replacement gets the cancellation, not the refusal.

For WebSocket recovery, “before the first Responses event” is stricter than “before the
first text”: even `response.created`, a tool event or a usage-bearing response closes the
replacement window. Ping/pong and quota metadata alone do not. A later socket close cannot
turn an already settled cancellation or connect/silence timeout into an HTTP retry.

`noProxy` accepts either a comma-separated string or an array. Both forms add entries without
replacing an inherited `NO_PROXY`:

```jsonc
{ "proxy": "http://proxy.corp:8080", "noProxy": "internal.example,10.0.0.0/8" }
```

```jsonc
{ "proxy": "http://proxy.corp:8080", "noProxy": ["internal.example", "10.0.0.0/8"] }
```

SOCKS5 (Clash mixed-port listeners included) belongs on `ALL_PROXY`, not `HTTP_PROXY`:

```jsonc
{ "proxy": "socks5://127.0.0.1:10808" }
```

`ocx start --socks5` writes that value; `ocx start --socks5-off` clears it.

HTTPS requests through SOCKS5 have a separate 30-second TLS handshake deadline.
A stalled handshake fails without disabling certificate verification; caller
cancellation can stop it sooner.

If an older development build changed resume-history metadata before backup support existed, run
`ocx recover-history --legacy-openai --yes` to force native-provider recovery.
It force-relabels every user-message `opencodex` row, including legitimate dedicated-provider
history; review the full-scope warning in the lifecycle reference before running it.

### 原生 Chat 的逾時與完成狀態

原生 Chat 等待上游輸出時也使用 `stallTimeoutSec`。非空文字、推理、拒絕內容、工具更新及完成事件會重設等待額度；保活註解、僅角色事件及單獨的用量資訊不會。等待慢速用戶端讀取時暫停計時。逾時產生 `upstream_stall_timeout`：串流請求收到錯誤事件，非串流請求回傳 HTTP 502。終態結果到達前取消請求會回傳取消錯誤，不會將部分答案當成成功。緩衝的 Chat 結果支援 LF 與 CRLF 兩種 SSE 格式，包含多行 data。

## Codex 配額網路診斷

主 Codex 帳號列在嘗試過配額查詢時，可能會包含 `quotaRefresh`。這描述的是那次查詢本身，不是剩餘
配額、模型存取權限或重試許可。快取讀取，以及未執行查詢的列，可能會省略它；缺席不代表成功。
`null` 的配額值代表無法取得，不是零配額。

在 PowerShell 中請求最新資料並只顯示診斷資訊：

```powershell
$quotaReport = ocx account list openai --quota --refresh --json | ConvertFrom-Json
$quotaReport.accounts |
    ForEach-Object { if ($_.quotaRefresh) { $_.quotaRefresh } } |
    ConvertTo-Json -Depth 3
```

若不存在診斷資訊，這個投影不會產生任何診斷物件。比較網路模式時，請只分享這些欄位，而不是
完整的帳號清單。

| `quotaRefresh.status` | 意義 |
| --- | --- |
| `ok` | 查詢完成，且成功解析出配額物件。 |
| `not_reported` | 回應中沒有可用的配額物件。 |
| `http_error` | 上游回傳 HTTP 失敗；`httpStatus` 帶有其狀態碼。 |
| `timeout` | 配額查詢逾時。 |
| `network_error` | 請求在得到已分類的 HTTP 回應之前就失敗。 |
| `invalid_response` | 回應不是可用的配額文件。 |
| `internal_error` | 內部重新整理步驟失敗。 |

只有 `http_error` 帶有 `httpStatus`。其他狀態並不代表 HTTP 0 或帳號權益問題。

### 使用的是哪一條 proxy 路徑？

執行中的 proxy 服務負責取得配額。它使用自己的環境，而不是之後執行 `ocx account list` 的互動式
shell。請設定該服務的 proxy 選項或環境變數，然後重新啟動它；在另一個終端機變更變數不會更新
一個已經在執行的服務。

未設定 `proxy` 會維持既有的代理變數不變。明確的 HTTP(S) 代理 URL 只會在 `HTTP_PROXY` 與
`HTTPS_PROXY` 未設定時才填入它們。`"proxy": "auto"` 只在啟動時讀取一次 Windows 靜態 WinINET
代理；既有的代理環境變數優先。自動偵測不會處理 PAC/WPAD、僅支援 SOCKS 的設定或即時的代理變更。
需要時請改用受支援的靜態 HTTP 代理設定，或明確的 HTTP(S) 代理 URL。

請在同一台機器、同一個帳號上，於兩種網路模式下比較這項診斷。單靠一次成功的 TUN 測試，無法判斷
服務的 HTTP 代理路徑為何失敗，也無法確立一個通用的修復方式。

## 特定上游主機的連線重用

有些上游會在停止服務某條連線之後仍讓它保持開啟。下一個請求會重用那個池化的 socket，並在連不到
provider 的情況下失敗。`OCX_FRESH_CONNECTION_HOSTS` 指名永不重用池化連線的主機，這是一個環境
變數而不是設定欄位，因此可以只套用在單一機器上而不必修改共用設定：

```bash
OCX_FRESH_CONNECTION_HOSTS="api.example.com, relay.example.net" ocx start
```

此值是以逗號分隔的主機名稱清單。比對不分大小寫，涵蓋每個指名主機及其子網域，並忽略開頭的點，
因此 `.example.com` 與 `example.com` 都會比對到 `api.example.com`。請不要包含 scheme、連接埠
或路徑。未設定或空字串會維持預設的連線行為不變。

符合條件的送出會帶有 `Connection: close`，並以停用 keep-alive 的方式發送。判斷依據是實際在
連線上使用的位址，因此即使 provider transport 在憑證選擇之後重寫了目的地，這個規則仍會套用。
這些主機的每次請求延遲會略微上升，因為每個請求都要付出一次全新的 TCP 與 TLS 交握；只指名真正
需要的主機。

## 遠端存取

預設的 `127.0.0.1` 綁定僅限回送。如 `0.0.0.0` 或 tailnet IP 的非回送位址，需要在 `/api/*` 與
data plane 上都進行 token 認證。

你不需要自己產生那個 token。`ocx service install` 會在非回送綁定上依下列順序準備一個：
安裝時 shell 中的 `OPENCODEX_API_AUTH_TOKEN`，接著是既有的、僅擁有者可讀的 `service-api-token`
檔案，最後是 32 個全新的隨機位元組。結果會以 `0600` 權限寫入，啟動包裝程式（launchd plist、
systemd unit、Windows wrapper）會在啟動時讀取該檔案，因此該值絕不會進入服務定義或 argv。前景
執行的 `ocx start` 套用相同的優先順序——環境變數、然後 `OCX_API_TOKEN_FILE`、然後已安裝的
`service-api-token`——所以它同樣可以在沒有匯出 token 的情況下綁定非回送主機名稱。

**管理用的 admin token** 出現在它可能出現的任一位置時都會被拒絕——環境變數或被沿用的
`service-api-token` 檔案——而且訊息會指名該處的修正方式：取消設定該變數，或刪除該檔案後執行
`ocx service repair`。這兩項檢查都在迴路短路之前執行，因為啟動包裝程式無論主機名稱為何，都會把
該檔案讀進 `OPENCODEX_API_AUTH_TOKEN`，所以即使是回送綁定，一個 admin-token 檔案也會把管理 API
關閉。`ocx status` 在 hub 上會把這個狀態回報為 `admin-collision (file)`。

若維運方想自行掌管這個值，仍然支援自行設定該變數：

```bash
export OPENCODEX_API_AUTH_TOKEN="your-secret-token"
ocx start
```

客戶端應發送：

```text
x-opencodex-api-key: your-secret-token
```

| 端點 | `Authorization: Bearer` | `x-opencodex-api-key` | `x-api-key` |
| --- | --- | --- | --- |
| `/v1/responses` | 不接受 | **必填** | 不接受 |
| `/v1/chat/completions` | 不接受 | **必填** | 不接受 |
| `/v1/messages` | 接受 | 接受 | 接受 |
| `/v1/messages/count_tokens` | 接受 | 接受 | 接受 |
| `/v1/models` | 接受 | 接受 | 接受 |

Responses 與 Chat Completions 為可能的 Codex Direct passthrough 保留 `Authorization`，因此那裡僅接受專屬的許可標頭。儀表板生成的 `apiKeys` 可在啟動後取代環境 token；候選值以常數時間比對。

Messages 與 `count_tokens` 為相容路由客戶端仍接受三種許可形式。但在非回環綁定上，原生 Anthropic 透傳只透過
`x-opencodex-api-key` 接受代理許可，並將 `Authorization` 與 `x-api-key` 保留給 Anthropic
憑證。放在這些供應商標頭中的代理許可密鑰會在轉發前移除。

:::caution[LAN 暴露]
`0.0.0.0` 綁定將代理與設定的供應商存取暴露給 LAN。僅在受信任的網路上搭配強 token 使用。
:::

### 無法接收 token 的本機用戶端

遠端綁定要求每個呼叫者都要有憑證，包括本機呼叫者。這會破壞一個特定情境：由 host process 啟動、
直接解析 Codex entrypoint（`require.resolve('@openai/codex/bin/codex.js')`）的 `codex app-server`
永遠不會經過生成的 `codex` shim，因此它不會繼承 `OPENCODEX_API_AUTH_TOKEN`，每次模型呼叫都會在
stream 開啟前以 `401` 失敗。

`unauthenticatedLoopbackListener` 會開啟第二個綁定到 `127.0.0.1` 的 listener，不要求憑證即可
放行。主 listener 不受影響——遠端呼叫者仍需要 token。

```json
{
  "hostname": "0.0.0.0",
  "port": 10100,
  "unauthenticatedLoopbackListener": { "enabled": true, "port": 10200 }
}
```

接著 `ocx sync` 會把 `base_url = "http://127.0.0.1:10200/v1"` 寫入受管的 Codex provider 區塊，
並省略 auth header，因此直接生成的 app-server 不需要任何憑證管線即可運作。

該 port 是必填的，且必須與 proxy port 不同。它絕不會由 OS 指派：臨時 port 會在重啟時改變，而
已執行的 app-server 仍保留先前的 `base_url`。

省略 `port` 會選擇**companion**形式——該 listener 會在 `127.0.0.1` 上綁定 proxy 的連接埠：

```json
{
  "hostname": "100.76.170.81",
  "port": 10100,
  "unauthenticatedLoopbackListener": { "enabled": true }
}
```

遠端客戶端用憑證撥打 `100.76.170.81:10100`；本機行程則不帶憑證撥打 `127.0.0.1:10100`。這正是
每個本機整合早就會寫入的位址，所以 `ocx claude`、Claude Desktop、Cursor 與 system-env 注入，在
一台它們連不到其公開綁定的主機上仍能繼續運作。companion 形式只有在 `hostname` 是明確的非回送、
非萬用位址時才會被接受：在 `127.0.0.1`、`localhost` 或 `0.0.0.0` 上，公開的 listener 已經佔用該
回送位址，所以 OpenCodex 會在寫入當下與啟動時拒絕這組配對，而不是讓第二次綁定失敗。在那些綁定上
你根本不需要這個 listener——回送綁定本來就會放行本機呼叫者。

設定了 `port` 時，本機整合會跟隨該 listener：`ocx claude`、`system-env` 注入、Claude Desktop 設定檔、
Cursor 閘道值與路由過的 vision helper，全都會寫入 `http://127.0.0.1:<listener port>`，也就是
`ocx sync` 寫入 Codex 的同一個連接埠。在 companion 形式中，這些相同的整合仍會寫入 proxy 的連接埠，
那正是 companion socket 所在之處。

**變更此欄位後，無論哪種形式都請重新啟動 proxy。** socket 只在啟動時綁定一次，匯出的客戶端值也是
依解析後的連接埠寫出，所以執行中的 proxy 會維持先前的答案——在帶連接埠的 listener 上，這正是
一個請求被正常服務、還是從 listener 收到 `404` 的差別。

在 `runtimeRole: "hub"` 上，這個欄位也是 hub 是否改寫**自己**本機客戶端設定的閘門。當 listener
關閉時，`ocx sync`、`ocx ensure` 與 `ocx restore back` 會略過 hub 自己的 Codex/Grok/Claude 寫入
並說明原因，指名的是 `unauthenticatedLoopbackListener`，而不是 `clientIntegrations` 開關。

該 listener 只服務 `POST /v1/responses`、其 WebSocket upgrade、`POST /v1/responses/compact`、
`POST /v1/messages`（Claude Code 與 Claude Desktop 所使用的 Anthropic 線路）、
`POST /v1/chat/completions`（Cursor 與 vision helper 所使用的 OpenAI chat 線路）、
`POST /v1/alpha/search`（原生 Codex 網頁搜尋中繼）、`GET /v1/models`，以及即時語音介面：獨立的
WebSocket upgrade、WebRTC 通話建立（`POST /v1/live`、`POST /v1/realtime/calls`），以及帶金鑰的
旁路加入 upgrade（`/v1/live/{callId}`、`/v1/realtime/calls/{callId}`、
`/v1/realtime?call_id=`）。其他所有東西，包括 `/api/*`、`/healthz`、`/readyz` 與儀表板，都會回傳
`404`——像 `ocx claude` 的探索呼叫這類本機管理讀取，會帶著管理憑證走已驗證的管理介面，絕不會走
這裡。

:::danger[這是一個未認證的介面]
機器上的每個 process 都可以使用此 listener。它會耗用帳號配額與付費 provider 憑證，也可能耗盡
已認證遠端用戶端依賴的共享 turn 容量。請勿在共用或多租戶主機上啟用。

綁定到 `127.0.0.1` 表示 kernel 會拒絕遠端連線，但不會阻止瀏覽器：你造訪的頁面可以讓瀏覽器連到
`127.0.0.1`。因此該 listener 套用與一般 loopback 綁定相同的 `Host` 與 `Origin` 檢查。預設關閉。
:::

### SSH 連接埠轉發

遠端使用不需要遠端綁定。保持回送並轉發它：

```bash
ssh -L 20100:localhost:10100 you@remote
```

任何本機連接埠皆可。Host 解析為 `localhost`、`127.0.0.1` 或 `::1` 的請求，不論連接埠皆保持回送，因此 `http://localhost:20100/v1` 可運作。在客戶端設定該 base URL；`ocx` 僅將預設的本機 `127.0.0.1` 位址寫入受管客戶端設定。

供應商 OAuth callback 在固定遠端連接埠監聽。在遠端機器上登入或也轉發該連接埠：

```bash
ssh -L 20100:localhost:10100 -L 1455:localhost:1455 you@remote
```

若已註冊的 callback 連接埠已被佔用，且該登入介面提供手動輸入選項，OpenCodex 會保留已註冊的
redirect URI，並仍然回傳供應商的授權 URL。請完成供應商登入，然後把瀏覽器網址列中最終的
redirect URL，或授權碼，貼進 OpenCodex。等待中的流程會保留 state 與 PKCE 驗證。沒有手動輸入選項
的呼叫者仍會 fail closed。

:::caution[轉發的回送未認證]
普通 `ssh -L` 在你的本機回送上監聽，對預設的未認證綁定是安全的。請勿使用 `ssh -g -L`、廣泛的容器發布，或將客戶端暴露在 `0.0.0.0` 上的轉發模式。不確定時請用 `ssh -L 127.0.0.1:20100:localhost:10100` 明確綁定。
:::

## 帳號電子郵件遮罩（`privacy`）

已儲存的帳號電子郵件，在離開 proxy 的每個地方都會被遮罩——儀表板帳號清單、
`GET /api/codex-auth/accounts`、`GET /api/oauth/status`，以及 `ocx status` 的登入區段，全都會
顯示 `p***n@example.com` 而不是實際存檔的地址。

| 欄位 | 型別 | 預設值 | 意義 |
| --- | --- | --- | --- |
| `privacy.maskEmails?` | `boolean` | `true` | 設為 `false` 可完整顯示已儲存的帳號電子郵件。缺省、`true`，以及任何格式錯誤的值都會維持遮罩，所以只有刻意設定的 `false` 才會揭露地址。 |

當你在自己掌控的機器上執行很多帳號、且無法從遮罩形式分辨它們時，可以關閉此選項。請把這個旗標
當成一個揭露決策，而不是顯示偏好：管理介面不一定只在回送上——在設定了 `remoteGui` 的 hub 上，
未遮罩的地址會傳達給每一個能連到該 hub 的管理主體，不只是坐在那台機器前的人。這個旗標只會影響
電子郵件欄位——token、refresh token 與帳號識別碼無論如何都會保持遮罩。

```json
{ "privacy": { "maskEmails": false } }
```

`ocx config set privacy.maskEmails false` 在該區塊存在之前會以 `config parent path not found`
失敗，因為 `config set` 只會走進既有物件，絕不會建立它們。請改為寫入整個物件——
`ocx config set privacy '{"maskEmails":false}'`——或手動把該區塊加進 `config.json`。

## 儲存清理

`storageCleanupPolicy` 預設停用。啟用時，它在已封存位元組超過 `trigger.archivedBytesOver` 後於 `startup`、`daily`、`weekly` 或 `manual` 執行。它朝 `target.reduceToBytes` 或 `target.removeOldestPercent` 選擇最舊的封存。`mode` 預設為 `quarantine`；僅將 `permanent` 作為明確的破壞性選擇。政策持久化 `lastRun` 與 `nextRun`。在 Storage 頁面或以 `GET`/`PUT /api/storage/cleanup-policy` 設定它；以 `POST /api/storage/cleanup-policy/run` 觸發手動執行。

## 用量歷史大小

`usageLedgerMaxBytes` 預設未設定，未設定代表 `usage.jsonl` 中的請求歷史會無限制成長。沒有
你沒要求刪除的歷史會被刪除。

設定一個位元組上限，代理會在某次附加寫入超過上限之後修剪檔案，保留最新的完整資料列並捨棄
最舊的。它會修剪到略低於上限，而不是精確等於上限，這樣下一次附加寫入不會立即再次超過那條線。
接受的最小值是 1 MiB；較小的數字，或不是安全整數的值，會讓上限維持關閉，而不是讓設定失敗。

資料列是逐位元組複製、絕不重寫的，因此每個欄位都能在修剪後存活——包括較新版本寫入、較舊版本
看不懂的欄位。若修剪執行期間有任何內容附加到帳本，替換動作會直接拒絕，因此修剪期間記錄的請求
絕不會遺失；下一次附加會再試一次。修剪也會更新儀表板顯示的內容，因此 `/api/logs` 會停止提供
帳本已經沒有的資料列。

目前還沒有對應的儀表板控制項；請在 `config.json` 中設定，或使用
`ocx config set usageLedgerMaxBytes <bytes>`。

## Catalog 自動更新（`catalogAutoRefresh`）

當 OpenCodex 管理你的本機 Codex 用戶端時預設啟用：該區段或 `enabled` 可以不存在。Proxy 每 60 分鐘更新一次它的模型目錄，並在啟動後約三分鐘進行一次初始更新。當 Codex 整合被關閉，或這個實例以 hub 身分執行或與另一個存活的 proxy 並存時，背景更新只在明確的 `"enabled": true` 下執行，而且絕不讀取 Codex 來源。

```json
{
  "catalogAutoRefresh": { "enabled": true, "intervalMinutes": 60 }
}
```

| 欄位 | 預設值 | 意義 |
| --- | --- | --- |
| `enabled` | `true` | 設為 `false` 以停用自動更新。 |
| `intervalMinutes` | `60` | 更新週期；低於 15 的正值會被夾限為 15。`0` 停用更新。 |

每次更新都會觀察所選 Codex runtime 內附的目錄，再暖機已認證的 Codex 模型清單，然後才收斂所提供的清單。來源失敗會使用既有的證據，並在之後的週期重試。週期與啟用的編輯，會在後續的週期生效。

你的 ChatGPT 帳號的 Codex 清單中列出、但這個 OpenCodex 版本尚不認識的原生 OpenAI 模型，會以上游為它發布的中繼資料（名稱、reasoning 等級、上下文視窗）加入。OpenCodex 會把這類模型記在它 home 目錄中的 `discovered-native-models.json`，並忘記 14 天沒有再看到的項目。之後帶有該模型的版本會接手它的列。

執行中的 Codex session 會保留記憶體內的模型清單。當 Codex app-server 正在執行、而提供的集合改變時，proxy 會記錄重新啟動的提示，並在它的自動更新狀態中記下 `reloadRequired`。準備好重新啟動那些 session 時，請執行 `ocx sync --restart-codex`。自動更新絕不會重新啟動它們。

## 配額重置通知（`quotaResetNotify`）

預設關閉。當這個區塊缺席時，不會執行偵測、不會啟動計時器，也不會寫入任何狀態檔案。

啟用它可以在用量窗口重置時收到通知——包含可預期的排程重置，以及無法預期的 out-of-band 重置：

```json
{
  "quotaResetNotify": {
    "enabled": true,
    "webhookUrl": "https://hooks.slack.com/services/...",
    "kinds": ["scheduled", "surprise"],
    "pollSeconds": 900
  }
}
```

| 欄位 | 預設值 | 意義 |
| --- | --- | --- |
| `enabled` | `false` | 主開關。同時需要至少一個下方的接收端。 |
| `kinds` | 兩者皆有 | `scheduled`（期限已過）或 `surprise`（配額提前恢復）。 |
| `pollSeconds` | `900` | 閒置輪詢間隔；下限 600。`0` 只觀察即時流量。 |
| `webhookUrl` | — | 接收事件 JSON 的 `https` POST 目標。視為機密。 |
| `allowPrivateNetwork` | `false` | 允許回送或私有網路的 webhook 目標。 |
| `timeoutMs` | `5000` | Webhook 逾時。 |
| `command` | — | 以事件 JSON 作為 stdin 執行的 argv 陣列。 |

`enabled: true` 但 `webhookUrl` 與 `command` 皆未設定時會被視為關閉：一個已啟用、卻無處可送達的
子系統是設定錯誤，不是半開啟狀態。

下限是 600 秒，因為更快的輪詢看不到任何新東西：觀察受限於每帳號 10 分鐘的快取，所以更短的間隔
只會為一個本來就會限流的配額端點增加負擔。已設定的值會在下一個 tick 生效，不需要重新啟動。

只有在你能接受「proxy 閒置期間發生的重置，要到下一次請求才會被注意到，而不是在它發生時」的情況下，
才把 `pollSeconds` 設為 `0`。這個輪詢之所以存在，是因為過夜的情況正是值得知道的那種情況。

### 送達的事件

```json
{
  "type": "quota_reset",
  "kind": "surprise",
  "scope": "codex",
  "accountTag": "k3f9x2ab",
  "window": "weekly",
  "percentBefore": 96,
  "percentAfter": 4,
  "previousResetAt": 1772000000000,
  "resetAt": 1772400000000,
  "detectedAt": 1771900000000
}
```

`accountTag` 是每次安裝各自加鹽的雜湊，不是帳號識別碼：它讓你可以分辨自己的多個帳號，但不會告訴
接收端它們是誰。絕不會包含任何電子郵件、token、路徑或 URL。

`detectedAt` 是 proxy 注意到的時間，不是重置實際發生的時間。觀察受限於供應商 5 分鐘的快取，以及
每帳號 10 分鐘的快取，所以重置的確切時刻只能被夾在兩次觀察之間。

### 安全性附註

`webhookUrl` 是一種憑證——對 Slack 與 Discord 而言，持有這個 URL 就足以發文——所以它會被
`ocx config show` 遮罩，並被 `ocx config export` 排除。

若 webhook 目標解析為私有或回送位址，除非你設定 `allowPrivateNetwork: true`，否則會被拒絕。
proxy 能連到你瀏覽器連不到的主機，包括雲端中繼資料端點，所以預設假設接收端是外部的。

`webhookUrl` 必須使用 `https`。payload 本身與 URL 都是敏感資料，`http` 目標會讓它們以明文傳送；
寫入設定時 `http` 值會被直接拒絕，而不是被靜默降級。

重新導向會被拒絕而不是被跟隨。上面的目的地檢查驗證的是你設定的 URL，若跟隨一個 `3xx`，payload
就會被送到一個未經驗證的地方——一個公開端點可能會把 POST 彈跳到回送位址或中繼資料位址。請直接
設定最終的 URL；被重新導向的傳送會回報 `blocked-destination`。

`command` 是一個 argv 陣列，絕不會透過 shell 傳遞，所以它的值不可能變成 shell 注入面。傳送只會
嘗試一次；沒有重試。

用 `ocx provider resets` 或 `GET /api/quota-resets` 讀取最近的偵測結果。

## API surfaces（`apiSurfaces`）

Responses（`/v1/responses`）與 Chat Completions（`/v1/chat/completions`）永遠會被服務。
Messages API（`/v1/messages` 與 `/v1/messages/count_tokens`）可以單獨關閉。

| 鍵 | 型別 | 預設值 | 說明 |
| --- | --- | --- | --- |
| `apiSurfaces.messages.enabled?` | `boolean` | 繼承 | `true` 會服務 Messages API，`false` 會讓兩條路由都以 403 拒絕。未設定時繼承 `claudeCode.enabled`，因此關閉 Claude 整合也會關閉 Messages。 |

存在但格式錯誤的值（非物件的 `apiSurfaces` 或 `messages`，或非布林的 `enabled`）會關閉
Messages API，而不是退回繼承值。兩條路由永遠一致。

儀表板的 API 頁面會為每個 API 顯示一張卡片，說明設定來源（明確設定、從 Claude 設定繼承，
或無效），以及 Messages 的切換開關。在那裡關閉 Messages 會在同一次儲存中同時寫入
`apiSurfaces.messages.enabled: false` **與** `claudeCode.enabled: false`，因此比這個設定更
舊、只讀取 `claudeCode.enabled` 的代理版本，在降級後仍會保持端點關閉。開啟它則只會寫入
`apiSurfaces.messages.enabled: true`；較舊版本仍會遵循 `claudeCode.enabled`，可能仍保持
Messages 關閉，這是安全的方向。

## Protocol paths（`protocols`）

Chat Completions 或 Messages 請求可能如何送達供應商。每個值預設維持這些鍵存在之前的行為；
傳送模式、預覽與逐請求追蹤請見[協定路徑](/zh-tw/guides/protocol-paths/)。

| 鍵 | 型別 | 預設值 | 說明 |
| --- | --- | --- | --- |
| `protocols.unrepresentable?` | `"legacy" \| "reject"` | `"legacy"` | `legacy` 會送出路徑會捨棄某功能的請求，並在追蹤紀錄中記下遺失。`reject` 會在送出前以 HTTP 400 拒絕，只指名功能鍵。 |
| `protocols.rollout.nativeChatCombos?` | `boolean` | `false` | 讓組合中符合資格的 Chat 候選項以自己那份用戶端主體的副本以 native 方式送出。 |
| `protocols.rollout.managedMessagesNative?` | `boolean` | `false` | 讓 Messages 以 native 方式直接送給以金鑰驗證的 Anthropic 供應商，而不經由內部 Responses 橋接。 |
| `protocols.rollout.managedMessagesNativeOAuth?` | `boolean` | `false` | 為未納入帳號池的 `anthropic` OAuth 供應商於 `api.anthropic.com` 上啟用 native Messages。除非 `managedMessagesNative` 已開啟，否則視為關閉；納入帳號池的帳號集仍維持橋接。 |
| `protocols.rollout.directEncoders?` | `boolean` | `false` | 對於非 Responses 上游，直接從適配器事件編碼 Chat 與 Messages 的回應。 |
| `protocols.rollout.shadowPlan?` | `boolean` | `false` | 比較每個 Chat 或 Messages 請求的路徑與預覽所預測的方案，並在其日誌列標記不一致為
`planMismatch`。不會多送出任何東西。 |

格式錯誤的 `protocols` 區塊會被還原為這些預設值，因為每個預設值都是保守的那一個。只有
`true` 會開啟某個開關。

```json
{
  "protocols": {
    "unrepresentable": "legacy",
    "rollout": { "shadowPlan": true }
  }
}
```

`ocx api policy` 會顯示已解析的值，並透過執行中的代理變更它們
（`--unrepresentable <legacy|reject>`、`--rollout <switch>=<on|off>`、`--messages <on|off>`
對應 [`apiSurfaces`](#api-surfacesapisurfaces)）。只有在給定設定旗標時才會寫入。儀表板的
API 頁面與 `PATCH /api/protocols/settings` 使用相同的驗證。

## Claude Code（`claudeCode`）

這些設定治理 `/v1/messages`、`/v1/messages/count_tokens`、`ocx claude` 啟動器與 Claude 儀表板頁面。

| Key | 型別 | 預設值 | 說明 |
| --- | --- | --- | --- |
| `claudeCode.bodyStallSec?` | `number` | `90` | 原生 passthrough body 在讀取待決時的不活動預算（秒），非總持續時間。最小 1；精確 `0` 停用。 |
| `claudeCode.bodyMaxBytes?` | `number` | `67108864` | 串流與緩衝回應的累積原生 passthrough body 上限。精確 `0` 停用。 |
| `claudeCode.compatibility?` | `"shadow" \| "enforce"` | 未設定 | 針對轉換後的 `/v1/messages` 請求的選用相容性准入。`shadow` 會記錄不支援的功能並繼續；`enforce` 會在推論前回傳 Anthropic 形狀的 400。原生 Anthropic 透傳不受影響。 |
| `claudeCode.authMode?` | `"proxy" \| "subscription"` | 自動 | 啟動如何處理 `ANTHROPIC_AUTH_TOKEN`。自動每次啟動偵測認證；明確值永不被覆寫。 |
| `claudeCode.authModeMigratedAt?` | `string` | 未設定 | 內部一次性升級標記。請勿手動設定。 |
| `claudeCode.classifierModel?` | `string` | 未設定 | Claude Code Auto Mode 分類器回合的明確目標，格式為限定的 `provider/model`（例如 `RelayA/claude-opus-5`）。Auto Mode 會送出像 `claude-opus-5` 這樣不帶供應商的裸安全檢查，若沒有這個設定，它們會落到 `defaultProvider`——而該供應商可能根本不支援 Anthropic 協定。這裡不會自動推斷任何東西：只有你在此宣告的目標才會被使用。 |
| `claudeCode.classifierFallbacks?` | `string[]` | 未設定 | 當 `classifierModel` 未設定時使用的有序分類器目標清單。採用相同的限定 `provider/model` 格式；第一個可用的項目會勝出。分類器模型的明確 `modelMap` 項目仍然優先於兩者。 |
| `claudeCode.subagentEffort?` | `"low" \| "medium" \| "high" \| "xhigh" \| "max"` | 繼承 | 寫入生成的 `~/.claude/agents/ocx-*.md` 的 effort；與 Codex guidance 與代理上限分開。透過 `ocx claude` 重啟以重新生成。 |

自動認證在找到已儲存的 Claude 認證時選擇訂閱，無認證時選擇 proxy，偵測不明確時選擇訂閱並附帶警告。請見[Claude Code 認證模式](/zh-tw/guides/claude-code/#認證模式)。

## Retained requests after compaction

For translated providers and routed Responses gateways, OpenCodex automatically frames
plain-text user requests before the latest readable Codex checkpoint as historical context.
Requests the checkpoint reports as completed should not be repeated; retained text remains
available for unfinished work within its existing authorization. Later user input takes priority,
including pauses, cancellations and changes of scope. A checkpoint grants no new permission.

This is enabled by default and needs no setting. Original request text and canonical thread/replay
history are preserved. Native OpenAI Responses passthrough, summarizer turns, context wrappers,
images/files and assistant/tool items are unchanged. The framing applies to plaintext checkpoints
beginning with Codex's summary prefix; decoded OpenCodex checkpoints retain their existing
continuation guidance. Client-side summarizer turns using Codex's standard compaction prompt
also bypass framing. Framing is a prompt instruction, so model behavior can vary.

## Compaction 路由

在**儀表板 → Overview → Compaction routing**中，選擇一個模型、它適用的觸發條件，以及選填的
reasoning effort，然後點擊**儲存**。選擇**使用對話模型**並儲存可移除該覆寫。變更會套用到下一次
compaction 請求，不需要重啟代理。

在 OpenCodex 的 `config.json` 中設定 `compactionRouting`，可覆寫 Codex compaction 請求使用的
模型。省略時此設定為停用。

```json
{
  "compactionRouting": {
    "model": "provider/model-id",
    "reasoningEffort": "low",
    "triggers": ["manual"]
  }
}
```

`model` 接受原生模型 ID、供應商限定的模型 ID，以及已設定的 combo。`reasoningEffort` 為選填；
省略時保留原始的 effort。支援的宣告值為 `none`、`minimal`、`low`、`medium`、`high`、`xhigh`、
`max` 與 `ultra`。既有的 provider effort 規則仍會套用。原生的 `/responses/compact` 端點維持
既有行為，不轉發 reasoning 設定。

`triggers` 指名此覆寫涵蓋哪些 compaction 請求，使用 Codex 自己的 `compaction.trigger` 值：
你手動輸入 `/compact` 對應 `"manual"`，Codex 在對話接近 context 上限時自動執行的 compaction
對應 `"auto"`。省略 `triggers` 時，覆寫只套用於手動 `/compact`，自動 compaction 完全維持
現在的路由方式。使用 `["auto"]` 或 `["manual", "auto"]` 可讓自動 compaction 也被路由。

路由自動 compaction 正是讓路由供應商上的長對話，能在規範 OpenAI 配額耗盡時繼續進行的關鍵。
Codex 會為 compaction 這一輪選擇一個裸原生模型，而 OpenCodex 只要有已啟用的規範 `openai`
provider 就會保留它給該用途，因此即使對話本身在別處執行，compaction 仍會在該輪開始前就以
配額錯誤失敗。在這裡指名 `"auto"`，會把 compaction 指向一個帶有自己憑證與配額的供應商限定
模型。

OpenCodex 只會變更帶有明確 `request_kind: "compaction"` 中繼資料、且 `compaction.trigger`
是你列出的其中一個值、送往 `/v1/responses/compact` 或帶有 `compaction_trigger` 輸入項目的
`/v1/responses` 的請求。之後的對話回合維持原始的路由與設定。缺失、格式錯誤或衝突的中繼資料
不會啟用此覆寫，包括在沒有 trigger 中繼資料的較舊客戶端上；當提供多份中繼資料時，它們必須
指名相同的 trigger。WebSocket 請求使用每個 frame 自己的中繼資料，而不是連線先前 handshake
時的中繼資料。

所選模型的供應商會收到整份對話以進行摘要，包括通常在另一個供應商上執行的對話。combo
選擇器會把它送給每個 combo 目標，包括 failover 目標。選定模型後，儀表板面板會在模型選擇器
旁說明這一點，並指名目的地供應商，或 combo 的目標供應商。當覆寫涵蓋自動 compaction 時，這種
轉移會在你沒有要求的情況下發生，時機由 Codex 決定何時 compaction；儀表板面板也會如此說明。
此覆寫重用既有的 compaction 處理器與摘要格式。當所選模型與對話模型共用相同的供應商與帳號路由
身分（供應商名稱、Codex 帳號模式與帳號命名空間）時，請求會保留呼叫者的憑證，並可能使用該
後端的原生 compact 端點。否則——包括任一方是 combo，或對話模型被記為 combo 目標的情況——
OpenCodex 會改用可攜式摘要器，這樣當對話在自己的模型上恢復時摘要仍可讀，且呼叫者的憑證不會
跨到另一個供應商。所選模型必須支援輸入大小與內容。手動編輯 `config.json` 後請重啟代理。
儀表板儲存會立即套用。

### Reasoning retention during compaction

Readable reasoning retention is an advanced, explicit opt-in and is **off by default**.
Only `reasoningRetention.enabled: true` enables it; an omitted block, `enabled: false`,
or legacy limits without `enabled: true` leave ordinary compaction behavior unchanged.
When enabled for routed v1 `POST /v1/responses/compact` and routed v2 `compaction_trigger` requests, readable reasoning stays local while the selected
model summarizes other context. After a readable summary succeeds, exact retained text returns
alongside it in framed historical context messages, not as new assistant reasoning or instructions.
Repeated compaction withholds those messages again. Ordinary subsequent turns replay them as history.

```json
{
  "reasoningRetention": {
    "enabled": true,
    "maxContextPercent": 20,
    "maxTokens": 100000
  }
}
```

Both limit fields are optional and, **when enabled**, default at runtime to `20` percent and `100000` estimated tokens.
The effective limit is the smaller of the percentage of the compacting model's context window
and the absolute token cap; when the context window is unknown, only the absolute cap applies.
The estimate includes each retained message's historical-context frame, not just its reasoning text.
Above the limit, readable text is written verbatim under the resolved OpenCodex home's
`reasoning-archive/` (normally `~/.opencodex/reasoning-archive/`). The summarizer receives a
path note instead of the text, and the finished readable summary includes a notice naming that file.
New archives are private to the user on POSIX. An archive is provisional until successful replacement history
returns its path, either in a readable summary or in a separate notice alongside a native result
after routed v1 Combo failover. Failures, cancellation, and invalid summaries remove
the current attempt's file. Internal retries reuse it; previously successful archives are preserved.
Failed compaction returns no replacement history.

The percentage/token limits bound reasoning returned in context, **not cumulative archive storage**.
Each archive contains only readable reasoning admitted in that request; request admission is bounded
by `maxInboundBodyBytes` (256 MiB by default, configurable up to 512 MiB), plus small block separators.
There is **no aggregate archive byte/file limit, automatic expiry, or background archive cleanup**.
Successful archives remain until you manually delete their files, including after disabling retention
or resetting the setting. They are plaintext, contain potentially sensitive conversation reasoning,
and share the resolved OpenCodex home of that proxy instance. Deleting an archive makes any existing
path notice unable to recover its contents; save anything you need first. A process crash or failed
filesystem write/cleanup can also leave a provisional file requiring manual cleanup.

**Dashboard → Overview → Advanced settings → Reasoning retention** provides the explicit switch
and both limits; **Reset and turn off** removes the override and switches retention off. GET/PUT `/api/settings` exposes `reasoningRetention`: null clears the block,
and omission preserves it. `enabled` must be a boolean when present. Percentages must be greater than 0 and at most 100; token caps must
be positive integers, and unknown fields are rejected. Invalid hand edits disable only this
block with a warning, keeping unrelated providers and settings.

Private provider ciphertext and signatures are not decrypted or copied into portable retained
messages. An upstream native opaque compaction response retains its exact output item and
ciphertext. If routed v1 Combo failover reaches a native result after withholding readable reasoning,
replacement history also includes the retained historical messages or a notice naming their archive.
Native compact endpoints keep their existing behavior.

Routed v2 still returns exactly one compaction item. Its proxy-owned `ocx2:` envelope stores
the summary and retained historical reasoning separately as JSON/Base64; this is encoding,
not provider encryption. Subsequent requests restore separate historical messages, and
repeated compaction withholds the reasoning again. Old `ocx1:` summaries remain supported.
Opt-in emergency compaction recovery also preserves this separation for JSON and SSE.
Explicit native-history recovery restores separate summary and historical reasoning messages too.

## 記憶體路由

在 **Dashboard → Overview → Memory routing** 中，為 Codex 的兩個記憶體階段各自選擇一個模型與選用的 reasoning effort，然後按 **Save**。選擇 **Off** 並儲存即可移除覆寫。變更會套用到下一個記憶體請求，不需要重新啟動 proxy。

在 OpenCodex 的 `config.json` 中設定 `memoryModels` 以路由那些請求。省略這個區塊時，兩個階段都保持它們既有的路由。兩個階段彼此獨立：設定其中一個不會動到另一個。

```json
{
  "memoryModels": {
    "extract": { "model": "provider/model-id", "reasoningEffort": "low" },
    "consolidation": { "model": "provider/model-id", "reasoningEffort": "medium" }
  }
}
```

`extract` 是把單一已結束的 session 摘要成原始記憶的階段；`consolidation` 是把那些原始記憶合併進 `$CODEX_HOME/memories` 底下檔案的單次代理執行。`model` 接受原生模型 ID、帶供應商前綴的模型 ID，以及已設定的 combo。`reasoningEffort` 是選用的；省略它就保留 Codex 所要求的 effort。支援的宣告有 `none`、`minimal`、`low`、`medium`、`high`、`xhigh`、`max` 與 `ultra`。Codex 對 extract 寫死 `low`，對 consolidation 寫死 `medium`，所以設定的 effort 會取代那個值。

OpenCodex 從 Codex 自己的回合中繼資料辨識這些請求：`x-codex-turn-metadata` 標頭中的 `request_kind: "memory"` 標示 extract 階段，而 `thread_source: "memory_consolidation"` 標示 consolidation 對話串。在 HTTP 上，`x-openai-subagent` 標頭指名 `memory_consolidation` 的請求，只有在回合中繼資料缺席時才算 consolidation 階段。明確的非記憶體中繼資料優先於這個後備。模型 id 刻意不是訊號：extract 階段與 Codex 用於標題與 commit 訊息的是同一個 helper 模型，所以以模型為基礎的規則也會捕捉到一般的 helper 呼叫。缺少、格式錯誤或互相矛盾的中繼資料不會啟用覆寫；提供多份中繼資料時，它們必須指名同一個階段。WebSocket 請求使用每個 frame 的中繼資料，而不是連線稍早握手時的中繼資料——橋接會把握手的 `x-openai-subagent` 標頭重新附加到每個 frame，所以那個標頭指名的是連線，而不是目前的階段，也不是 websocket 的訊號。

當 `shadowCallIntercept` 會比對到同一個請求時，已設定的階段優先。關閉的階段保持它目前的路由，包括任何比對到它模型的既有 shadow-call 規則。所選模型的供應商會收到 Codex 為記憶體所摘要的 session 文字，包括通常在另一個供應商上執行的 session；儀表板面板會在模型選擇器旁邊說明這點。目標不再能解析的階段——供應商被停用或刪除，或它的 combo 不再存在——會以 `409` 與錯誤碼 `memory_model_target_unavailable` 讓該記憶體呼叫失敗，而不是退回預設供應商。請求記錄會把階段（`memory-extract` 或 `memory-consolidation`）列為路由原因。手動編輯 `config.json` 後請重新啟動 proxy。儀表板儲存會立即套用。

## Shadow call

Codex 使用小型 helper 模型處理如標題與 commit 訊息等任務。啟用 `shadowCallIntercept` 以將識別的來源模型前綴重定向到另一個已設定的模型。替換後仍會保留為請求設定的 reasoning effort。僅在客戶端使用不同的 helper id 時設定 `sourceModels`。
攔截是以模型為基礎的：任何裸模型 id 符合 `sourceModels` 的請求都可能被重新導向，包括一般的
`request_kind: "turn"` 請求。`x-codex-turn-metadata` 不會讓相符的請求豁免。

裸模型 ID 符合 `sourceModels` 的請求可被攔截，但 `x-codex-turn-metadata` 同時包含 `request_kind: "turn"` 和 `thread_source: "user"` 的使用者回合保留所選模型。連線標頭 `x-openai-subagent: collab_spawn`（HTTP 請求或 WebSocket 交握） 或中繼資料中的 `subagent_kind: "thread_spawn"` 標記的子代理也保留模型。WebSocket 的回合中繼資料僅依據每個框架的 `client_metadata["x-codex-turn-metadata"]`，不使用交握中的回合中繼資料分類後續框架。中繼資料缺失或格式錯誤時保留原有攔截行為。輔助呼叫也可能帶有 `request_kind: "turn"`，因此單憑此欄位不能豁免。這些規則適用於具體模型與 combo 目標。

```json
{
  "shadowCallIntercept": {
    "enabled": true,
    "model": "gpt-5.5",
    "sourceModels": ["gpt-6-luna", "gpt-5.6-luna"]
  }
}
```

### 目標無法使用時

替換目標是操作者選定的唯一目的地，因此無法再解析的目標會讓輔助呼叫失敗，而不是把它送到別處。當目標的供應商被停用或刪除，或其組合已不存在時，被攔截的請求會在向上游送出任何內容之前回傳 `409` 與錯誤代碼 `intercept_target_unavailable`。請求記錄會記下相同代碼。請求不會直通給原生輔助模型，也不會退回預設供應商，因為兩者都會在你未選擇的情況下改變目的地、憑證與費用。組合或路由設定檔目標仍會在自身成員之間容錯移轉。像 `provider/model` 這樣的限定目標，若其供應商部分未指向任何已設定項目，也以相同方式處理，設定 API 會拒絕儲存。透過預設供應商解析的不帶前綴模型 ID 仍然有效。

停用（帶 `disabled: true` 的 `PATCH /api/providers?name=<provider>`）或刪除目標所解析到的供應商仍會成功；回應會加入 `dependentShadowIntercept: { model, enabled }`，儀表板會顯示警告。重新啟用該供應商或選擇其他目標即可恢復攔截。

## Sidecar

### `images`（`OcxImagesConfig`）

| 欄位 | 型別 | 預設值 | 意義 |
| --- | --- | --- | --- |
| `provider?` | `string` | 自動 OpenAI 選擇 | 用於 `/v1/images/generations` 與 `/v1/images/edits` 的明確自訂 API-key `openai-responses` 供應商。Registry 管理的 id 被拒絕。 |
| `timeoutMs?` | `number` | `300000` | 一個獨立 Images 請求的整體請求逾時。 |

明確選擇在供應商缺失、停用、不相容或缺少可用金鑰時 fail closed；它永不後退到另一個付費上游。端點必須實作 Codex 預期的 OpenAI Images API 路徑與回應結構。

### `webSearchSidecar`（`OcxWebSearchSidecarConfig`）

| 欄位 | 型別 | 預設值 | 意義 |
| --- | --- | --- | --- |
| `enabled?` | `boolean` | 可用時開啟 | 主開關。為 `false` 時，OpenCodex 停止攔截 `web_search`，且 Codex 整合會把 `web_search = "disabled"` 寫入 `~/.codex/config.toml`。 |
| `backend?` | `"openai" \| "anthropic" \| "xai" \| "gemini" \| "exa"` | `openai` | 明確設定優先；省略時一律使用 `openai`。`anthropic` 與 `xai` 僅在明確設定時執行；`gemini` 與 `exa` 在 executor 推出前仍為保留值。 |
| `model?` | `string` | 視 backend 而定 | OpenAI 為 `gpt-5.6-luna`、Anthropic 為 `claude-sonnet-5`、xAI 為 `grok-4.6`。舊版明確 `gpt-5.4-mini` 在啟動時遷移。 |
| `exaApiKey?` | `string` | 無 | `exa` backend 的操作員金鑰。僅可寫入：管理讀取永遠不會傳回已儲存的值。 |
| `xSearch?` | `object` | 省略 | xAI 專用的託管 `x_search` opt-in：`enabled`、互斥的 `allowedXHandles` / `excludedXHandles` 陣列（最多 20 項），以及 ISO `fromDate` / `toDate`（`YYYY-MM-DD`）。 |
| `reasoning?` | `string` | `low` | Sidecar effort。`minimal` 在網頁搜尋時被拒絕。 |
| `maxSearchesPerTurn?` | `number` | `3` | 每個主模型回合允許的實際搜尋。 |
| `routedModelStallTimeoutMs?` | `number` | `200000` | 僅設定檔的路由模型原始 body 不活動截止時間。整數 1–2147483647；每個非空 chunk 重置它。 |
| `timeoutMs?` | `number` | `60000` | 一個代管搜尋的截止時間。 |

OpenAI backend 需要 ChatGPT 登入與啟用的 ChatGPT `forward` 供應商。Claude-inbound 路由重播將主 ChatGPT 認證注入內部請求。Anthropic backend 使用來自已啟用 Anthropic OAuth 供應商的現用已儲存憑證。明確選擇的 Anthropic backend 在無可用帳號時 fail closed 而非後退。Anthropic 執行器使用其原生 `web_search_20250305` 工具。xAI backend 需要可用的已儲存 Grok OAuth 帳號，使用託管 `web_search`，並在 `xSearch.enabled` 為 true 時加入託管 `x_search`。格式錯誤的 `xSearch` 管理輸入會傳回 `400`；格式錯誤的持久化區塊會在規劃期間 fail closed。`gemini` 與 `exa` 通道絕不會因憑證探索或 fallback 而啟用；操作員必須明確選擇它們。`exaApiKey` 可在寫入時接受，但會從管理回應中省略。

四個時鐘治理搜尋：基礎 `stallTimeoutSec`、`connectTimeoutMs`、路由模型不活動與代管搜尋逾時。有效的橋接看門狗為最大值加 30 秒。路由停滯是不活動防護，而非總生成截止時間。

### `visionSidecar`（`OcxVisionSidecarConfig`）

| 欄位 | 型別 | 預設值 | 意義 |
| --- | --- | --- | --- |
| `enabled?` | `boolean` | 可用時開啟 | 主圖片描述開關。 |
| `backend?` | `"openai" \| "anthropic"` | 自動 | 明確值優先；未設定時優先使用可用的已儲存 Anthropic OAuth 憑證，否則使用 `openai`。 |
| `model?` | `string` | 視 backend 而定 | OpenAI 為 `gpt-5.6-luna` 或 Anthropic 為 `claude-sonnet-5`。 |
| `maxDescriptionsPerTurn?` | `number` | `8` | 每個主回合允許的新描述快取未命中。`0` 停用呼叫；無效值使用預設。 |
| `timeoutMs?` | `number` | `45000` | Sidecar 擷取逾時。整數 1–2147483647。 |

視覺僅對發送到其供應商 `noVisionModels` 中模型的圖片啟用。OpenAI 的登入／forward 需求與搜尋相同；明確選擇的 Anthropic 在無可用憑證時 fail closed。成功的 `data:` 描述使用以 backend、模型、細節、圖片位元組與正規化訊息 context 為 key 的有界快取。命中與同回合重複不消耗限制。遠端 `https:` 圖片與失敗或空的描述不被快取。

Anthropic OAuth sidecar 重用 opencodex 既有的 Claude Code OAuth 指紋。請對預期帳號與工作負載進行浸泡測試。

## Remote Hub 金鑰與預設值

`runtimeRole` 預設為 `standalone`。Hub 會使用 `hub.managementPublicOrigin`、僅限迴路的
`hub.managementIngress`（缺席時為 `enabled:false`），以及精確比對的
`remoteGui.allowedTailscaleUsers`（缺席時為空）。用戶端的資料金鑰保存在 `service-api-token`，
絕不會在 `config.json` 中；輪替期間可能暫時建立 `service-api-token.prev`。用量儲存不會互相鏡像。

| 鍵 | 型別 | 缺席時的預設值 | 作用 |
| --- | --- | --- | --- |
| `hub.managementPublicOrigin` | string | 未設定 | hub 對外宣告的、瀏覽器可連到的規範管理 origin，例如 Tailscale Serve 印出的 HTTPS origin。這是 `runtimeRole` 為 `hub` 時，`/readyz` 回報為 `managementUrl` 的值；未設定時，hub 會退回使用每個請求實際抵達時所用的 origin，所以位於不同前端後面的客戶端，可能會被交付一個它連不到的位址。 |
| `hub.dataPublicOrigin` | string | 未設定 | 遠端客戶端應該撥打的**資料**平面規範 origin，例如 TLS 前端在 tailnet 綁定前面發布的 HTTPS origin。僅供參考：它絕不是綁定位址，變更它不會移動任何 socket。`ocx hub invite` 會把它印成 `ocx connect` 那一行的位置參數 URL，未設定時退回 `http://<hostname>:<port>`——這是遠端機器可能無法透過 TLS 連到的 LAN/tailnet 位址，所以任何有前端的 hub 都應該設定這個值。與大多數選用鍵不同，它在格式錯誤時**不會**被靜默捨棄：打錯字會在寫入當下被拒絕，因為避免退回到綁定位址，正是這個欄位存在的目的。 |
| `hub.managementIngress` | `{enabled:false}` 或 `{enabled:true, port}` | `{enabled:false}` | 一個額外的、僅供管理使用的 listener，給本機 HTTPS 前端使用。主機名稱不可設定：啟用時該 socket 一律綁定 `127.0.0.1`，且只放行 GUI、session-bootstrap 與管理 API 路由。資料平面路由會在派發前就被拒絕。 |
| `remoteGui.allowedTailscaleUsers` | string[] | `[]`（空——沒有人） | 允許自動簽發遠端 GUI session 的精確 Tailscale 登入身分。`Tailscale-User-Login` 標頭**只**在獨立的管理 ingress 上受信任；空清單代表沒有任何遠端身分可以簽發 session，這是安全的預設值，不是疏漏。身分比對是精確比對，所以打錯字會靜默拒絕存取。 |
| `remoteGui.allowInsecureHttp` | boolean | 未設定 | **已淘汰——沒有作用。** 它曾經允許透過非迴路的明文 HTTP 進行一次性配對交換。配對授權現在只會經過迴路或已驗證的 HTTPS。這個鍵仍會被解析，讓既有的 `config.json` 能繼續載入（schema 是嚴格的，直接拿掉這個鍵會讓較舊的設定完全無法載入）；持久化的 `true` 只會被回報一次，之後就會被忽略。請把它從你的設定中移除。 |

一個可以從瀏覽器連到的 hub，需要 `hub.managementPublicOrigin`，以及 `remoteGui.allowedTailscaleUsers`
中至少一筆項目。只設定 origin 而沒有使用者清單，會產生一個能正確宣告自己、卻拒絕每個 session 的
hub；只設定使用者清單而沒有 origin，會產生指向請求恰好使用的那個 origin 的 session。

`dataPublicOrigin` 與 `managementPublicOrigin` 是兩個獨立的宣告，在實際部署中它們是兩個不同的
socket：管理是發布在 443 上、僅限迴路的 ingress，資料則是發布在自己 HTTPS 連接埠上的 tailnet
綁定。它們正是 `ocx hub invite` 印出內容的兩半，而 `managementPublicOrigin` 是兩者中較嚴格的
一個——一份配對授權會把它記錄成該授權自己的伺服器 origin，交換時會拿它來比對，這就是為什麼
`ocx hub invite --management-url` 只能*確認*已設定的值，而拒絕一個不同的值。`--data-url` 則
真的是一個覆寫，因為沒有任何東西綁定在它上面。當 `dataPublicOrigin` 與 `--data-url` 都未設定時，
`invite` 會退回使用綁定位址——而在迴路或萬用綁定上，那會解析成這台機器自己的迴路位址，此時它會
拒絕，而不是去宣告一個另一台機器用不到的位址。

一個同時服務自己本機客戶端的 hub，也會設定
[`unauthenticatedLoopbackListener`](#無法接收-token-的本機用戶端)。它不帶連接埠的
companion 形式，正是讓 hub 成為單一連接埠部署的原因，而它在迴路或萬用 `hostname` 上會被拒絕，
因為公開的 listener 已經佔用了 `127.0.0.1:<連接埠>`。

## 實驗性原生回應控制

`codexNativeSteering` 與 `codexNativeInjection` 啟用兩條獨立、預設關閉的原生 WebSocket
控制路徑。詳見規範指南中的
[支援的 steering 路由與設定](/zh-tw/guides/codex-integration/#steering-續傳設定)、
[型別化結果與核准的續傳](/zh-tw/guides/codex-integration/#回應完成後的豐富工具結果與明確核准)，
以及[確認期限與保留的內容](/zh-tw/guides/codex-integration/#steering-確認期限與保留的-context)。

### Forced Claude Code subagent model

The Subagents page offers **Force all subagents onto one model**, off by default. Select an exposed roster-style id, such as `combo/tev-auto`, then enable the switch. The roster is offered first; unavailable saved roster entries cannot be force targets.

`ocx agent subagents force combo/tev-auto` sets `claudeCode.subagentModelForce`; `ocx agent subagents force -` clears it. `ocx agent status` reports the setting. `GET /api/subagent-models` returns `force`, `forceAvailable`, and `forceStatus`; `PUT` accepts `{ "force": "combo/tev-auto" }` or `{ "force": null }` without changing the roster. Omitting `force` leaves it unchanged. Invalid or unexposed targets are rejected on write; stale targets are reported and skipped at launch.

This takes effect on the **next routed `ocx claude` launch**, injecting `CLAUDE_CODE_SUBAGENT_MODEL` as an explicit proxy alias (with `[1m]` only for an authoritative million-token window; native Claude targets use a reversible native alias) and `CLAUDE_CODE_SUBAGENT_MODEL_FORCE=1`. Each nonempty shell-exported variable independently wins. Native launches inject neither variable; plain `claude` is not affected. No plugin files or `settings.json` are modified by this setting.

Claude Code **2.1.257 or newer** is required for FORCE. Plugin and built-in agents (including Explore/Plan) and per-call model arguments are overridden. Forks and subagent skills with `model: inherit` keep the main conversation model. The main loop and Haiku/small-fast sidecars are unaffected. Existing roster files remain available.

The dashboard warns about old or unknown CLI versions, unavailable targets, and either variable already present in `settings.json` → `env` (which overrides launch env). Detection is read-only and server-local: it cannot inspect another launch shell, another machine, or project-local settings. An unknown result is not proof of force support.

## Historical pool continuity

Provider-pool ceilings use the canonical routed provider. For every currently configured provider
`P`, OpenCodex automatically binds its salted pool alias, `h(pool, P)`, to `P` when reading
balances. No manual self-mapping or salt calculation is needed for independent
provider ceilings. This rule also applies to retained historical balances with that exact alias.

Request logs still use account-specific display labels. A different historical label, including an
account ordinal, does not establish provider ownership. With `spend.pool.maxTokens`, each original
balance contributes once to its bound provider group or, when still unbound and positive, to every
candidate pool. Settled, reserved and unresolved usage all count; unknown usage is not a refund.
Unbound history may therefore restrict an otherwise unused pool. Current account order and display
names do not resolve that history. Root and identity ceilings remain independent.

For distinct historical labels whose ownership you have verified, add mappings to the top-level
`spendPoolAliases` object in `config.json`. Each key is an exact 32-character lowercase hexadecimal
pool alias from this installation's journal; each value is the exact ID of a verified, currently
configured canonical provider, with no surrounding whitespace.
Keep evidence for the mapping and keep the journal and salt private.

Automatic self-bindings and explicit mappings apply only when balances are read. They do not move
original balances or persist identity links in the journal. Removing an explicit historical mapping
makes that history unbound again unless its alias is a currently configured provider's own alias.
Keep `spendPoolAliases` outside `spend`, because older versions reject unknown fields inside that
strict section. Invalid mappings are rejected on writes; invalid hand edits retain ceilings and
refuse pool admission. A configured provider's own salted pool alias cannot map to another provider.
This is checked again when the provider set changes. Validation reads an existing salt without
creating one.

Dormant unbound history expires only after its last activity is strictly older than
`spend.retentionDays`. Capacity pressure cannot shorten that interval for positive unknown history.
Live reservations and seed targets remain protected, even at zero tokens. Cleanup persists a normal
journal deletion record before admission uses the reduced total. Known groups keep the ordinary
active/exhausted protections. No automatic tool reconstructs unverifiable mappings.

### Token reservations and reporting

When a root, identity or pool ceiling applies, the first physical send for each selected target/key
requires a normal-capacity reservation. If that cannot be recorded, the send is refused before it
reaches upstream. Stable retries reuse that reservation's scopes; a different target/key needs a
new one. `L` is the request-wide physical-send limit, frozen when the request starts
(default four; the existing bounded OAuth request profile allows up to eighteen).
Every additional physical send shares this finite limit.

The enforcement state, applicable root/identity/pool token ceilings, and `L` are captured when each
request starts. Configuration changes apply only to requests started after the change. Requests
already running keep their starting policy for all retries and continuations: enabling or lowering
a ceiling does not tighten them, and raising or removing a ceiling does not relax them. A request
that started in observe-only mode remains observe-only until it finishes.

Delayed reports retain already-started usage. Terminal settlement waits for reporters, and send IDs
are forgotten only after their accounting is durable; forgetting an ID does not remove its balance.
The limit bounds retries, not the final bill: actual usage or already-started retries can exceed a
token estimate, and their full liability remains counted. With no applicable ceiling, behavior stays
observe-only, including omitted bookings when tracking capacity is full. No identity checkpoints are
added for unconfigured traffic.

Claude CLI, CodeBuddy and Qoder count each CLI invocation as one send. Their first invocation
still needs a normal reservation and is refused if that reservation cannot be obtained. Internal
CLI retries and tool turns do not separately consume this request-wide send limit; their cost
settles from actual reported usage, including amounts above the initial estimate. This exception preserves CLI use with configured
spend ceilings while limiting the number of child invocations.

### Rollback to 2.80.0: contract C

New records use the existing v1 format and `pool` alias domain. **Unmodified 2.80.0 reads them using
its own per-label rules**, including ordinary compaction and retention. There is no required
backport, launcher fence or reconciliation command. Keep the current journal and salt: restoring
an older copy loses the spend recorded since that copy.

This does not preserve canonical aggregation after downgrade, nor promise the same remaining
allowance that 2.80.0 would have calculated for identical traffic without the upgrade. It may book
new traffic under account labels. On re-upgrade, current configured-provider self-bindings and explicit
alias mappings apply to the original balances still retained by 2.80.0. New checkpoints contain no identity-link metadata that
an older reader must preserve.

Journals written by unpublished experimental builds with `pool-current` aliases or `poolContinuity`
metadata are excluded from this compatibility contract, including later checkpoints carrying those
aliases. Their original balances and send targets remain conservative unbound history until normal
retention expires them; they are not converted or immediately deleted.

A complete invalid journal record (including a final `null`) causes configured admission to refuse.
Compaction can still preserve valid accounting in a clean checkpoint; the live refusal remains until
a clean restart replays it. A torn, unparseable final line keeps the existing recovery behavior.
Storage/corruption denials use `workflow_spend_undurable`; unsafe files and ownership failures remain
storage errors. Alias validation failures use `workflow_pool_history_unresolved`.
