---
title: CLI 代理、路由與整合
description: 多代理、組合、可觀測性、存取、整合、系統與設定指令。
---

這些指令控制代理政策與路由、檢查即時代理，並將支援的客戶端連接至 opencodex。

## 代理政策

### `ocx agent <status|injection|effort|subagents|fallback|roles|sidecar|memory-models|compaction-routing> ...`

Manage the headless multi-agent roster, effort caps, prompt injection, fallback, and sidecar settings.
Use `status` for the current policy. See [Sub-agent surfaces](/zh-tw/guides/sub-agent-surface/) for how
surface modes, delegation, effort, and fallback behavior fit together.

```bash
ocx agent subagents set ark/model-a,openai/gpt-5.5
```

`ocx agent roles` is for omo (Codex / LazyCodex). It lists each Codex agent role in
`$CODEX_HOME/agents` with its model pin and whether `~/.omo/omo.jsonc` can be updated, or says
LazyCodex is not installed, in which case `set` is refused. `ocx agent roles set <role> <model> [--effort <level>]` rewrites only
that role's root `model` line, and its `model_reasoning_effort` line with `--effort`, and mirrors both into omo.jsonc at
`[codex].agents.<role>` as `model` and `reasoning`. An effort LazyCodex has no level for, such as `ultra`, is written to the role file only. A missing omo.jsonc, or one containing comments, is left unchanged
and the command says so. See [omo (Codex / LazyCodex) role models](/zh-tw/guides/integrations/#omocodex--lazycodex角色模型).

```bash
ocx agent roles set explorer xai/grok-4.5 --effort medium
```

`ocx agent roles suggest` is omo (Codex / LazyCodex) only, refused like `set` when LazyCodex is not
installed. It sizes every role with one call to the default Codex model (or `--model`) and
prints a proposed model and effort per role without writing anything. `--apply` writes every proposal
through the same write as `set`, skipping and naming the roles whose model and effort already match.
See [Auto-assign](/zh-tw/guides/integrations/#自動指派).

Human-readable suggestion output displays terminal control characters as visible escapes.
Use `--json` when you need the original suggestion values without presentation escaping.

`ocx agent injection suggest <work>` does the same for the delegation model: it sizes the described
work, proposes the cheapest sufficient model and an effort from the delegation picker's list, and writes
nothing unless `--apply` is given, which saves through the same write as `injection set`. See
[Delegation model and effort](/zh-tw/guides/sub-agent-surface/#委託模型與推理強度).

`ocx agent sidecar web --list` and `ocx agent sidecar vision --list` print the models the
server currently offers for each sidecar — the exact filtered set the dashboard picker shows
(picker-visible rows plus the login-entitled Luna/Haiku auth slots, intersected with executor
availability for web search, minus provably text-only models for vision). Human-readable lists
show each model's backend in brackets. A web-search `--model` write resolves that server-offered
row and persists its backend and model together, so switching to an Anthropic option cannot keep
an OpenAI backend (or vice versa). Writes go to the same management route as the GUI and are
subject to the same per-sidecar gate: web search refuses a backend/model pair outside the listed
set (closed membership), while vision refuses only a model provably unable to see (unknown ids
stay writable).

```bash
ocx agent sidecar web --list
ocx agent sidecar web --model gpt-5.6-luna
ocx agent sidecar web --enabled off
```

`--enabled off` is the same switch as the Dashboard's Off row: OpenCodex stops running the
sidecar and the Codex integration writes `web_search = "disabled"` into `~/.codex/config.toml`,
which is what lets an MCP search server be the only search path. `--enabled on` removes that
marker-owned line again. When the save actually moves the switch, the command reports the
Codex-side write it triggered (`codexWebSearch` in `--json`, a trailing `Codex config:` line
otherwise) and points at `ocx sync` when it could not happen; a save that leaves the switch
where it was has nothing to report and prints no `Codex config:` line. The flag works for
`vision` too.

### Injection defaults and sidecar runtime settings

```bash
ocx agent injection status --json
ocx agent injection set --sync-codex-defaults off --json
ocx agent injection status --json
ocx agent sidecar web --stream-routed-output on --json
ocx agent sidecar vision --timeout-ms 30000 --json
ocx agent sidecar status --json
```

Run writes only for the requested change. Injection `--sync-codex-defaults on|off`
updates `syncCodexSubagentDefaults`; omitted model/effort/prompt/guidance stay intact,
and `-` clears model/effort/prompt. The receipt has actual normalized
`model`, `effort`, `prompt`, `multiAgentGuidanceEnabled` and
`syncCodexSubagentDefaults`, not a fabricated catalog result.

Web `--reasoning` remains supported. `--max-descriptions` and `--timeout-ms` are
vision-only; timeout accepts integers from 1 to 2147483647 milliseconds.
`--stream-routed-output` is web-only. Partial writes preserve sibling settings.
The new-option receipt exposes only the selected public `webSearch` or `vision`
state and `codexWebSearch` apply report. `{applied:false, reason, retryable}`
distinguishes native apply deferral/refusal from a saved setting; a missing or
mismatched new setting is unverified and nonzero. Read status for full observed
settings, including web reasoning. Do not retry blindly on ownership refusal.

### Memory and compaction routing overrides

```bash
ocx agent memory-models show --json
ocx agent memory-models set --extract-model <route> --extract-effort high --consolidation-model <route> --json
ocx agent memory-models show --json
ocx agent compaction-routing show --json
ocx agent compaction-routing set --model <route> --effort high --triggers manual,auto --sources '<exact-source>,<provider>/*' --json
ocx agent compaction-routing show --json
```

Each set replaces the entire block. Memory accepts extract/consolidation model
and optional effort pairs; an effort without that phase's model is refused.
Omitted phases use their existing/default route, not a stopped pipeline.
`--file memory.json` instead reads the block itself:

```json
{"extract":{"model":"example/model","reasoningEffort":"high"}}
```

An explicit memory file `{}` is valid and remains an empty override block;
`ocx agent memory-models clear --json` writes null. Both mean no custom override,
not disabled memory processing. File mode is exclusive with scalar options.
Regular UTF-8 files or piped `--file -` use the 4 MiB/30-second bounded-input
contract, including a 4 MiB serialized request limit.

Compaction files contain required `model`, optional `reasoningEffort`, `triggers`
and `sourceModels`. Triggers are unique `manual`/`auto`; source selectors must be
exact and unique, or provider/* patterns. Omitted triggers use server defaults;
omitted sources select all sources, not the previous custom scope.
`ocx agent compaction-routing clear --json` writes null and restores ordinary
compaction routing without disabling compaction. No synthetic model call verifies
these saves.

Reads return only `{memoryModels: blockOrNull}` or `{compactionRouting: blockOrNull}`.
Writes add `catalogRefreshPending`: false exits 0 without promising every client
applied, true exits 1 after saving. Missing/malformed pending evidence is null with
`verification:"unverified"` and exit 1. Read back before recovery.

### `ocx effort [status|set|clear]`

透過即時代理檢查或變更主要與子代理的 reasoning-effort 上限；代理無法使用時則改用本機設定。
上限值為 `low`、`medium`、`high`、`xhigh`、`max` 與 `ultra`；`-` 會清除所選的上限。`none`
與 `minimal` 不是有效的上限層級，會在探測代理或送出更新之前就被拒絕，即使同一指令中的另一個
選項有效也一樣。它們對 `--injection` 仍然有效，因為那設定的是獨立的注入 effort，不是上限。

```bash
ocx effort status --json
ocx effort set --main high --subagent low
ocx effort set --subagent -
```

Status 會保留既有已儲存／執行階段的上限值，並在 `warnings` 中回報不支援的值（沒有不支援值時
為空陣列）。人類可讀輸出會顯示相同的警告，並指名被忽略的欄位與修正指令。Status 永不修復或
重寫這些值。被忽略的子代理欄位不會移除有效的主要上限。`ocx effort clear` 會清除兩個上限，
同時保留獨立的注入 effort 設定。上限適用的請求介面請見[子代理介面](/zh-tw/guides/sub-agent-surface/)。

### `ocx v2 <status|on|off|mode <v1|default|v2>|keep-native-v1 <on|off>|threads <n>|mode-hint <text|--clear>>`

管理 Codex 的 `multi_agent_v2` 功能旗標與三態多代理介面模式。

| 子指令 | 動作 |
| --- | --- |
| `status`（預設） | 回報目前 v2 旗標、多代理模式與執行緒並行數。 |
| `on` | 啟用全域 `multi_agent_v2` 功能並重新同步目錄。當 v2 混合 pin 生效中時會被拒絕，因為全域覆寫會破壞它。 |
| `off` | 停用 `multi_agent_v2` 功能並重新同步目錄。 |
| `mode v1` | 將所有模型強制為 v1、停用原生 v2，並保留現用執行緒上限。 |
| `mode default` | 遵循上游模型介面 pin。 |
| `mode v2` | 將模型強制為 v2，並保留現用執行緒上限。當 `keep-native-v1` 關閉時，啟用全域原生 v2；開啟時，停用全域覆寫並改用目錄 pin。 |
| `keep-native-v1 on\|off` | 在 `mode v2` 下，讓 ChatGPT 原生模型維持 v1、路由模型維持 v2。啟用它會在目錄同步前停用全域 V2 覆寫。 |
| `threads <n>` | 將現用 v1/v2 執行緒上限設為不小於 1 的整數。 |
| `mode-hint <text>` | 為每個模型與 effort 設定 Proactive delegation hint（Ultra 模式）。 |
| `mode-hint --clear` | 移除該提示，恢復依 effort 決定的政策（ultra = proactive）。 |

```bash
ocx v2 status
ocx v2 mode v1
ocx v2 mode default
ocx v2 on
ocx v2 threads 16
ocx v2 mode-hint "Proactive multi-agent delegation is active."
ocx v2 mode-hint --clear
```

`mode` 子指令將 `multiAgentMode` 寫入 opencodex 設定並重新同步 Codex 目錄。模式與旗標轉換會在有效的 v1/v2 Codex key 之間移動目前的數值執行緒上限；失敗的轉換會還原原始的 `config.toml`。變更套用於新的 Codex session，執行中的 session 則保留其 pin 的介面。

Codex 會在套用所選模型的目錄 pin 之前，先解析已啟用的全域 `multi_agent_v2` 覆寫。因此混合式
`keep-native-v1` 合約會讓那個全域覆寫保持關閉；否則一個標記為 `v1` 的原生列仍會以 V2 啟動，
並產生後端加密的子任務。

即使 `multi_agent_v2` 目前被停用，`mode-hint` 仍會把
`features.multi_agent_v2.multi_agent_mode_hint_text` 寫入 Codex 的 `$CODEX_HOME/config.toml`。
這個指令只會持久化該覆寫；它不會啟用或停用該功能，所以提示會在相符的 Codex 介面啟用時才生效。
該提示會覆寫 codex-rs 依 effort 決定的多代理政策，因此任何模型與任何 reasoning effort 都會收到
Proactive delegation 提示。它**不會**改變 reasoning effort 本身。缺少引數或只有空白字元的值會被
拒絕；只有 `--clear` 會移除該提示。Subagents 儀表板的 Ultra 模式**開啟**開關有更嚴格的門檻：
它要求原生功能已啟用，且介面明確為 v2（`ocx v2 mode v2`）；單獨執行 `ocx v2 on` 無法滿足該儀表板
門檻。

#### Explicit v2 target and outcome

```bash
ocx v2 status --json
ocx v2 status --live --json
ocx v2 mode v1 --live --json
ocx v2 status --live --json
```

The live write uses the existing management route. Only explicit live `mode`
accepts `--acknowledge-surface-advisory`; add it only when acknowledging that
advisory is requested. Local mode and status/on/off/keep-native/threads/hint reject
it. There is no automatic acknowledgment.

For literal reserved hint text, pass one quoted operand after `--`:

```bash
ocx v2 mode-hint --live --json -- '--clear'
```

This stores literal `--clear`; without `--`, `mode-hint --clear` removes the hint.
The suffix is not scanned for help, live, JSON or clear controls; controls belong
before `--`. Extra operands and duplicate flags refuse before mutation.

Local JSON is `{ok, target:"local", action, changed, state, sync}` using actual
post-write state. Mode/keep-native and changed on/off keep their real sync attempt
even without a discovered port; threads/hints and unchanged on/off add no sync.
An absent/malformed sync result becomes unverified with exit 1, not success.
`changed` or state can be unknown after failure; do not claim rollback.
Live status reports validated state/advisory/recommendation with `target:"live"`;
writes add `ok:true` and `catalogRefresh`. Only committed, nondegraded refresh exits
0. HTTP 502 may mean partially applied native state: inspect before retrying.
Local usage errors retain exit 1; new live usage errors use exit 2.

## 組合路由

### `ocx combo <list|show|set|remove|stats> ...` · `ocx route combo ...`

Manage combo failover and round-robin virtual models. `ocx route combo` is the hierarchical alias;
combos and routing profiles are distinct resources. Combo targets use
`provider/model[:weight],provider/model[:weight]`.

```bash
ocx combo list
ocx route combo set reliable --targets ark/model-a:2,openai/gpt-5.5
```

`set` accepts `--strategy`, `--sticky`, `--effort`, `--alias`, `--rename-from`, `--native-alias`, and
`--display-name <label|->` (`-` clears the label). A native alias captures only one currently supported,
unqualified bare OpenAI model id. Bare `gpt-5.6-*` native aliases use Codex Pool/Direct credentials.
Account-qualified OpenAI routes remain distinct, while provider-qualified routes such as
`openai-apikey/gpt-5.6-*` use their configured API key and never fall through to the native alias.
Read the safety and visibility contract in the guide before enabling the compatibility pair.
With `--strategy jev` only, the decision method is chosen by one of two mutually exclusive flags.
`--decision-provider <provider|->` names a configured `jev-decision` row (for example a self-hosted
Ollama `tev1`) as a System One-compatible server. `--decision-model <route|->` names an ordinary
opencodex route (for example `ollama/qwen3:4b`) that answers the same choice as JSON; it cannot be
this combo or any JEV combo. Omitting both uses TypeSafe. `--decision-timeout <ms|->` sets the
decision deadline (1000–120000, default 4000); `-` clears any of the three.

`ocx combo test [--combo <id>] [--decision-provider <provider|jev> | --decision-model <route>]
[--decision-timeout <ms>]` sends one synthetic decision probe through a saved combo's method or an
unsaved selection and reports the gate, backend, and latency; it may spend one decision call.
`ocx combo discover [--query <text>]` lists configured System One rows and catalog models that look
like decision models, with the derived endpoint.

For structured target metadata, inspect offline help and the current combo:

```bash
ocx combo set --help
ocx combo list --json
ocx combo show reliable --json
```

A `--targets-file` document is a nonempty ordered array, for example this shape
with provider/model values replaced by actual configured candidates:

```json
[{"provider":"example","model":"raw/model","weight":1,"reasoningEfforts":["high"],"modelProfile":"Reasoning tasks","lastResort":false}]
```

Optional fields are `weight`, `reasoningEfforts`, `modelProfile` and `lastResort`.
Efforts are a unique nonempty list of `low`, `medium`, `high`, `xhigh`, `max`, `ultra`;
empty/none/minimal custom-model semantics do not apply. Files or explicit piped
`-` have a 4 MiB limit and 30-second read deadline; the serialized management body
must also fit 4 MiB. Unknown fields refuse before the write.

```bash
ocx combo set reliable --targets-file targets.json --image-input auto --reasoning-effort-mode strict --json
ocx combo show reliable --json
```

`--targets-file` and `--targets` are mutually exclusive. Omitting both preserves
complete target metadata for partial edits; replacement files preserve order and
explicit `lastResort: false`. `--image-input auto|disabled` and
`--reasoning-effort-mode strict|adaptive` preserve omission, while explicit `auto`
and `strict` override saved disabled/adaptive values. Reasoning-effort mode is
separate from `--effort-mode fallback|force`, which governs the default effort.
`--allow-metered-targets on|off` grants or clears operator consent for marked combo targets on a loopback-only proxy; public and linked callers still need configured-key consent.
`--native-alias on|off` preserves explicit false; the legacy bare flag means true.
Turning it off may require the intended alias clear, `--native-alias off --alias -`,
to avoid retaining an incompatible native alias. Set/rename is an upsert without
CAS, so re-read after changes. The receipt is `{success, id, model, combo, catalogRefresh}`;
skipped, failed or degraded catalog refresh returns nonzero after saving.

### Observe combo decision statistics

```bash
ocx combo stats reliable --range 30d --json
```

Use the exact stored combo ID from list/show, not its public model or alias.
Ranges are `7d`, `30d` (default), and `all`. This reads recorded JEV observations
without running a paid decision probe. Inspect decisions, model attempts,
measured attempts, model tokens and decision tokens separately. Keep the
`measuredModelAttempts/modelAttempts` and `decisionUsageReported/decisions`
coverage ratios with the totals. Nullable averages are unavailable, not zero.
Preserve `usageIncomplete`, `historyTruncated`, `entriesTruncated`, dropped-entry
counts and snapshot-window boundaries. Zero observations do not prove success.
There is no monetary cost or comparative savings field in this report.

See [Combos](/zh-tw/guides/combos/) for routing behavior and configuration guidance.

## Routing profiles

Existing profiles support inspection and evaluation through the live API:

```bash
ocx route policy list --json
ocx route policy show reliable --json
ocx route policy dry-run reliable --model-context 128000 --tools --image --structured-output --json
```

Only run this evaluation with authority to activate Lab on the target. The management POST can activate Lab and start automation that is already enabled there, including upstream probes. Use list/show for observation without that activation effect.

Replace `reliable` with a listed ID. `evaluate` is an alias for `dry-run`; both
send requirements to the saved profile's evaluator without an inference request.
Creation, update and deletion use the explicit file/revision workflow below.
Combo writes edit a separate resource. Missing profiles return exit 4 and missing
operands return 2.

### Edit a routing profile with its observed revision

Create/update can activate Lab and already-enabled automation, including upstream
probes. Only run them with that authority. List/show are observational; first
read offline help and save the intended profile:

```bash
ocx route policy update --help
ocx route policy show reliable --json > profile.observed.json
jq 'del(.id, .model, .revision) | if .alias == null then del(.alias) else . end' profile.observed.json > profile.next.json
```

Edit and review the next file; keep the observed file unchanged. Input contains
only editable `alias`, `candidates`, `require`, `optimize`, `limits`,
`unknownEvidence`, and `compatibility` with supported nested fields. `id`, `model`,
`revision`, unknown keys and null alias are not editable input. The server still
validates provider, alias and policy semantics. `--file -` accepts piped stdin;
regular UTF-8 files/stdin have the 4 MiB and 30-second bounded read contract.

```bash
ocx route policy update reliable --file profile.next.json --expected-revision '<exact-revision-from-observed-show>' --json
ocx route policy show reliable --json
```

Use the original opaque revision explicitly. HTTP 409 / exit 5 means read show
again, review concurrent changes and rebuild the edit. Never silently fetch a
replacement revision, retry or convert update into create. For an authorized new
ID use `ocx route policy create <new-id> --file profile.next.json --json` without a
revision. Authorized removal is `ocx route policy remove <id> --yes --json` and
has no revision guard.

Create/update returns `{success, id, model, profile, catalogRefresh}` with the new
`profile.revision`; remove returns `{success, id, catalogRefresh}`. Only committed,
nondegraded refresh exits 0. A saved receipt with skipped/failed/degraded refresh
exits 1: inspect before recovery instead of repeating the configuration write.

## Compatibility Lab

Lab is local inspection **and** explicit evidence/automation management. Reads
use the local projection and do not require a running management API:

```bash
ocx lab status --json
ocx lab catalog --json
ocx lab subjects --limit 10 --json
ocx lab automation status --json
ocx lab automation runs --limit 10 --json
ocx lab public community --json
```

`subject`, `observations`, `event`, `artifact`, and `production-signals` follow
local evidence lineage. The public family offers preview/export by repeated
`--event <id>`, verification/import through `--file <bundle.json>`, and community
context. Export and import write local evidence. Verification can print its
result and still exit nonzero when the bundle is not cryptographically valid.

Automation enable/disable changes local policy; manual `lab run` selects a layer
and scenario and may spend upstream quota. Read `ocx help lab` and the relevant
leaf before these authorized operations. A saved local policy does not prove
that a separately running proxy's scheduler adopted it. Full automation policy
editing and run cancellation are not exposed by these CLI controls.

## 可觀測性與除錯

### `ocx observe <logs|usage|storage|memory|debug|claude-inbound|injection> ...`

檢查代理請求、用量、儲存、記憶體與除錯資料。直接別名如下：

| 別名 | 等效資源 |
| --- | --- |
| `ocx logs [filters] [--follow] [--json|--jsonl]` | `ocx observe logs` |
| `ocx usage [--range <today|1d|7d|30d|all>] [--since <timestamp> --until <timestamp>] [--surface <all|codex|claude|grok>] [--provider <name>] [--model <id>] [--json]` | `ocx observe usage` |
| `ocx storage [--json]` | `ocx observe storage` |
| `ocx memory [--json]` | `ocx observe memory` |

```bash
ocx observe usage --range 30d --json
ocx usage --since 2026-09-01T09:00:00Z --until 2026-09-01T10:59:59.999Z --json
```

`--since` 與 `--until` 必須同時提供。它們接受整數的 epoch 毫秒，或帶有明確時區的完整 ISO
日期時間，會包含兩端點，並會覆寫 `--range`。無效或前後顛倒的範圍會在送出請求前失敗。人類可讀
輸出會印出所請求的區間；`--json` 會包含 `customWindow`、`since` 與 `until`。既有的
surface／provider／model 篩選條件仍然適用。這些指令查詢的是執行中的代理；它們不提供離線報告。

`--range today`（別名 `1d`）回報目前的本機當日資料。`--provider` 與 `--model` 會把報表縮小到
單一上游目標——這與 `--surface` 不同，`--surface` 選擇的是發出呼叫的客戶端（Codex、Claude Code、
Grok），而不是實際服務請求的供應商。

預設檢視會印出請求數、token 數與估計成本總計，以及依供應商與依模型的細分。成本是 API 牌價的
對應值，不是計費收據：訂閱方案與供應商配額是分開計費的，而沒有對應價格列的請求會被計為
`unpriced`/`unmetered`，而不是併入為零。

```bash
ocx usage --range today --provider xai
```

部分用量記錄無法納入時，人類可讀輸出會顯示警告，即使沒有可讀取的記錄也是如此。顯示的總數僅反映可讀取的記錄。如果篩選條件沒有符合的可讀取記錄，輸出將顯示警告和提示，而不顯示總數列；被略過的記錄可能包含符合項目。`--json` 原樣保留回應中的 `usageIncomplete` 診斷及原因。

### Compare a range with the previous equal window

```bash
ocx usage compare --range today --json
ocx usage compare --range 7d --provider xai
```

`ocx observe usage compare` is the equivalent family form. The command reads `GET /api/usage`
twice: the named range ending now, then the same range evaluated one equal window earlier
(one local day for `today`/`1d`, seven for `7d`, thirty for `30d`). Default range is `30d`.
`--range all` is refused because open history has no previous equal window. `--since` and
`--until` are not accepted; the windows are derived. Surface, provider, model, and API-key
filters apply to both reads. Human output prints current, previous, signed delta, and percent
change. `--json` is `{schemaVersion,range,current,previous,delta,change,incomplete}`. The two
reads are sequential, not an atomic snapshot. Custom `since`/`until` on each response must
match the requested window. Both reads use the same connection and credential. If the
connection, account, or credential changes during the command, it reports an owner
mismatch and asks you to retry instead of printing a comparison.

### Page indexed request history

```bash
ocx logs history --provider xai --status 200 --limit 50 --json
ocx logs history --cursor '<nextCursor>' --json
ocx logs get <request-id> --json
```

`ocx observe logs history` and `ocx observe logs get` are the equivalent family
forms. These read the derived request-history index, not the recent `ocx logs`
ring. `--limit` is 1–100 (default 50). `--from` and `--to` accept epoch
milliseconds or full ISO datetimes with a timezone and are inclusive. `--json`
returns `{entries,hasMore,nextCursor,index}`. `--jsonl` emits rows only; when
more pages exist, `nextCursor=…` is printed on stderr so a caller can resume
without mixing the token into the row stream. Empty matches succeed. `get`
returns one canonical row by request ID; `ocx logs explain` remains the
route-decision view for that same ID.

### Filter a bounded log snapshot

```bash
ocx logs filter --surface claude --status errors --time-window 1h --scan-limit 2000 --limit 50 --json
```

`ocx observe logs filter` is the equivalent family form. This reads one recent
window, filters locally, then keeps the newest matches in their original order.
`--scan-limit` controls fetched rows (1–2000, default 2000); `--limit` controls
returned rows (1–2000, default 200). JSON reports
`{schemaVersion:1,logs,cursor,filters,window:{scanLimit,loaded,matched,returned,limit}}`.
Counts describe this observed window, not all history. JSONL emits rows only;
empty matches succeed. Cursor metadata is not a resumable search token.

Selectors include `--surface all|codex|claude|grok`, `--status all|success|errors`,
`--time-window all|15m|1h|24h`, `--model`, `--provider`, `--conversation`
(alias `--conversationId`), `--intercepted-only`, `--min-tok-per-sec`,
`--max-tok-per-sec`, and `--protocol-mode all|native|translated|legacy-bridge|blocked|none`.
Model/provider equality is trimmed and case-insensitive, including
resolved/served models and attempts. Claude includes Desktop; Codex means absent
surface. Success is HTTP 200–299, errors 400–599. Time lower bounds are inclusive.
Speed uses observed value-kind tok/s, with inclusive minimum and exclusive
maximum; unavailable values fail active speed filters. Protocol none includes
absent or invalid traces. Conversation matching uses the same hash-aware IDs as
ordinary logs. Interception selects string-valued rewrite markers.

Unknown/repeated/conflicting flags, invalid bounds, and follow/events fail before
discovery. Malformed, oversized or failed reads are nonzero, not empty results.
To reduce response size, reduce the scan limit; reducing output limit does not
change the fetch. For streaming use the separate follow forms below.

### Search usage model rows

```bash
ocx usage --range 7d --search 'model-a' --json
```

`--search` matches a trimmed case-insensitive substring in model, provider or
resolved model after reading the report. It sorts model rows by descending total
tokens with stable ties and keeps up to 100 by default. JSON adds
`modelView:{query,matchedModelCount,returnedModelCount,limit:100,truncated}`;
human output labels the view and shows its selected model rows. Report totals,
provider/day/account rows, exact filters and incomplete/window metadata remain
unchanged. No model match does not mean no report usage.

An explicit blank query (`--search=`) selects the top-100 view; omitting search
preserves the existing output. Exact `--provider`/`--model` still scope the
underlying report. Search does not broaden selected-key or connected-client
self scope and is never sent as a new Hub API query parameter.

`ocx usage --top 25` (also `ocx observe usage --top 25`) sets the human model table limit to an integer from 1 to 1000. The default is 10, or 100 with `--search`; the limit applies after search filtering. It changes local display only: report totals, provider/account rows and API parameters stay unchanged. With `--json`, a valid `--top` is ignored; JSON retains its existing full report or 100-row search view. Invalid limits return exit 2 before fetching.

### Saved companion usage totals

```bash
ocx companion show --json
ocx companion usage --json
```

The second command reads saved companion settings, then today and 30d usage
sequentially on the same management runtime. It applies the saved `models` and
`hiddenProviders` preferences and preserves unknown/unmeasured costs and tokens.
Null model selection means all; an empty selection means none. It does not
change settings, operate native windows or relay through a connected client.

JSON returns `schemaVersion:1`, `filters`, `settingsUpdatedAt`,
`settingsCorrupt`, `settingsFallback`, `ranges` and `partial`. Each range has
`status:"available"` with filtered `data`, or `status:"unavailable"`.
An unavailable range sets partial and exit 1 while retaining the other range.
Available incomplete data retains its own metadata; it is not measured zero.
Valid server defaults retain a null settings timestamp and set fallback;
corrupt-file defaults additionally set corrupt and warn in human output.
Malformed settings stop before usage reads. These reads are not an atomic
snapshot. Each GET has a 10-second fetch/body deadline after discovery and a
32 MiB response cap; this is not a whole-command deadline. Signals exit 130/143
without late results.

### Follow request windows or injection sequences

```bash
ocx logs --help
ocx logs --limit 200 --json
ocx logs --follow --events --limit 200
```

`--events` requires follow and implies JSONL; redundant `--jsonl` is accepted.
`--json` remains one-shot and conflicts with follow/events. Each events-v1 line
is `{schemaVersion:1,type:"snapshot"|"append",rows,cursor,limit}`. Replace the
consumer window on snapshot, append/trim on append, preserving order and repeated
IDs. Initial empty and reset/removal snapshots are emitted; stable empty polls
remain silent. Legacy arrays are snapshots with cursor null, not invented cursors.
These are observed windows, not a lossless replay of traffic missed between polls
or after ring eviction.

`ocx logs --follow --jsonl --limit 200` retains row-shaped output. It re-emits changed
occurrences, including same-ID status/token amendments and repeated IDs. Do not
collapse everything by request ID. This legacy output cannot encode removals,
resets or exact window order; choose events when those distinctions matter.
Log follow limit is 1–2000, default 200.

```bash
ocx observe injection --limit 500 --json
ocx observe injection --follow --jsonl --limit 500
```

Injection emits ordered `{seq,at,line}` rows, where `at` is epoch milliseconds;
internal `after` advances with seq. Follow limit is 1–2000, default 500. JSON is
one-shot and JSONL requires follow. Observation does not enable capture. Empty
polls do not identify disabled capture or prove absence of gaps. Detectable runtime
drift stops; undetectable restart/latest-N gaps cannot be excluded without an API
epoch/gap marker.

Both follow loops use serial one-second waits, 10-second fetch/body deadlines and
32 MiB response limits. Malformed/oversized/transport errors stop with stderr and
exit 1, without automatic retry/reconnect. Reduce limit for oversized windows.
SIGINT/Ctrl-C exits 130, SIGTERM 143, with no later polls/output. Inspect exit state
and retained rows instead of treating cancellation as complete history.

### Companion timeline and key-scoped usage

```bash
ocx companion timeline --help
ocx companion timeline --hours 24 --bucket-minutes 60 --metric total --aggregation sum --grouping model --model example/model-a --hide-provider excluded-provider --json
```

Replace fictional IDs with the selected filters. Repeat `--model` for individual
provider/model IDs (nested slashes allowed; not CSV); repeat `--hide-provider` to
exclude providers. Positive `--provider` is unsupported. Hours are 6/24/72/168,
bucket minutes 1–1440 with at most 2000 buckets, metric total/input/output/cached,
aggregation sum/average/max, grouping model/modelAccount. The API limits filter
inputs to 100 items. This reads usage without changing companion settings.

Check `appliedFilters.models/hiddenProviders`. Timeline bounds are epoch seconds,
with exclusive end, unlike ordinary usage's millisecond custom window. The end must
match the request-time bucket, or its immediate successor if the request crosses
a bucket boundary; an older aligned window is refused. Empty
series retains bucket/filter metadata. `missingMeasurements` and `truncated` must
remain visible: zero-filled points do not prove complete zero usage.

On a non-client management host:

```bash
ocx access key list --json
ocx usage --api-key-id key-example --range 7d --json
```

Use a non-secret actual key ID. The CLI requires exact response acknowledgment in
`filter.apiKeyId`; ignored filters fail rather than showing unscoped totals.
An unknown acknowledged ID can return `matched:false` and empty traffic, not 404.
Keep incomplete/custom-window facts. Connected clients reject `--api-key-id`
before enrolled-key access or transport; omit it for existing self-only Hub usage
or perform the selected-key view on the Hub. No data key grants management authority.

### `ocx debug <provider|usage|injection|claude> <on|off|status|reset|logs [-f]>`

透過執行中代理的管理 API 讀取或變更執行階段除錯覆寫。

```bash
ocx debug provider on|off|status|reset
ocx debug provider logs [-f|--follow]
ocx debug usage on|off|status|reset
ocx debug usage logs [-f|--follow]
```

無 scope 時，`ocx debug` 印出用量，並在代理停止時印出下次啟動的環境預設值。供應商除錯預設來自 `OCX_DEBUG=1`（舊版 `OCX_DEBUG_FRAMES=1` 亦可）；用量除錯預設來自 `OPENCODEX_USAGE_DEBUG=1`。

## API 存取

### `ocx access <key|endpoints|models|test|audio> ...`

Inspect admission keys, external endpoints and models with the access family.
`ocx api-key` aliases the access-key family. Creation and rotation-start return a
one-time plaintext credential in text and JSON output. Agents must leave those
steps to a human-operated terminal outside the agent session; request only
confirmation and non-secret key/rotation IDs, never the credential.

```bash
ocx access key list --json
```

After the human configures and verifies the replacement, committing its rotation
or removing the old key requires separate explicit revocation authority. Safe
non-secret follow-ups are `ocx access key rotate commit <id> <rotation-id> --json`
and `ocx access key rotate abort <id> <rotation-id> --json`, with authority for
the chosen action. Re-list afterward. Missing pending state alone does not prove
commit: expiry or abort can also clear it. Do not route around consent by issuing
the secret-returning management request directly.

### Rename one key without changing its access policy

```bash
ocx access key rename key-example 'Research client' --json
ocx access key list --json
```

Use an actual unique ID or unambiguous name. Rename sends only `{id,name}` and
preserves provider/model scopes; it does not rotate/delete a key. The response
contains id/name/createdAt and optional allowedProviders/allowedModels, never
plaintext or a prefix. List remains masked. Names are control-free, trimmed,
nonempty and at most 64 JavaScript string units. The read/rename sequence is not
CAS; inspect the masked roster after an unknown outcome before retrying. The
root `api-key rename` alias uses the same command.

### Explicit-key model and audio checks

Discover the installed syntax without contacting upstream:

```bash
ocx access test --help
ocx access audio transcribe --help
ocx access audio live-check --help
```

Model requests, audio uploads and live-session checks require explicit operator
authorization for that particular upstream operation and possible quota/cost.
The operator supplies the selected key from an approved private stdin source in
a human-operated terminal outside the agent session. Agents must not capture it
or ask for it in chat. Never put it in argv/environment. These are the ocx side
of that private pipe, not direct interactive key prompts or an agent-run batch:

```bash
ocx access test example/model --protocol responses --api-key-stdin --json
ocx access audio transcribe sample.wav --model gpt-4o-mini-transcribe --api-key-stdin --json
ocx access audio live-check --model gpt-live-1-codex --api-key-stdin --json
```

Choose only the authorized task and real model/file. TTY input is refused. Input
is bounded to 4096 bytes/30 seconds, valid UTF-8 printable ASCII, without outer
whitespace, controls or extra lines; one final LF/CRLF is allowed. This deliberately
covers currently issued keys, not every Unicode value the server configuration
might accept. Exact supplied-key occurrences in permitted text become `[redacted]`;
arbitrary encodings are not guaranteed detected. No encoded key carrier is printed.

Targets are the checked local serving origin or existing normalized enrolled Hub
origin, with identity checked around asynchronous work. There is no custom-origin,
admin or enrolled-key fallback, redirect following, credential cache or automatic
retry. The operator reports only the non-secret result to the agent.

#### Model control and response limits

Protocols are chat (default), responses or messages. Selected-key mode first
sends one credentialless malformed-JSON control to that endpoint. Only the native
key-required 401 advances to one fixed 16-token model request using the supplied
key. The control has a 5-second/4096-byte response budget; the request has a
60-second/2 MiB response budget including body reads. Authless/unrecognized
controls stop before inference. Local logging/admission bookkeeping may still occur.

JSON is `{schemaVersion:1,control:{outcome,status?},request:{outcome,status?},response?}`.
Safe response contains protocol, ordered text, complete/limited completion and
optional measured token counts. A usable length-limited reply is `limited`;
refusal/content-filter/tool-only or malformed responses are unsupported, even
with HTTP 2xx. Error metadata, IDs, tools and reasoning are not printed.
Operational failure retains one versioned report plus fixed stderr/exit 1;
invalid grammar/key input exits 2 without a fabricated report.

Success says only: “Credentialless request was refused; the model request using
the supplied key succeeded.” Listener/policy changes between calls remain possible;
this does not certify key scope, atomic admission or billing identity. Without
`--api-key-stdin`, legacy test JSON remains its original payload and says nothing
about a newly selected key.

#### Transcription and live readiness

Transcription requires a nonempty regular file of at most 25,000,000 bytes with a
30-second local read limit, and a multipart body capped at 32 MiB. Models are
gpt-4o-transcribe, gpt-4o-mini-transcribe or whisper-1, subject to target support.
Upload/response share 130 seconds; response is capped at 2 MiB. Success returns
only `{text}`, including empty text, with exact-key redaction. Failure leaves
stdout empty and prints fixed stderr/nonzero; no JSON error envelope or raw body.

Audio uses explicit-key admission without the model control. Live-check sends
fixed session.update and session.close only. Readiness requires session.started
or session.updated with nonblank native session ID within 15 seconds; socket-open
or session.created alone is insufficient. After readiness it waits at most 2
seconds for normal code-1000 closure. Each UTF-8 frame is capped at 64 KiB, aggregate
2 MiB; there is no retained frame history.

Live JSON is `{schemaVersion:1,ready,close:"confirmed"|"unverified",check:"session-readiness",event?}`.
Operational failure preserves that observation without raw frames. Partial readiness
with unverified close exits 1; a later normal close cannot erase an earlier error.
Signals exit 130/143. This checks readiness/closure only, not microphone, upload,
tool execution, full voice roundtrip or server lease release. Opening the upstream
session is not guaranteed free. No reconnect or retry is automatic.

### `ocx api <protocols|explain|policy> ...`

檢查並設定請求在用戶端 API 與供應商線路之間如何傳送。詞彙說明見
[協定路徑](/zh-tw/guides/protocol-paths/)。

| 指令 | 路由 | 是否改變狀態 |
| --- | --- | --- |
| `ocx api protocols [--provider <name>] [--json]` | `GET /api/protocols` | 否 |
| `ocx api explain --model <id> --inbound <responses\|chat\|messages> [--feature <key>]... [--json]` | `POST /api/protocols/plan` | 否 |
| `ocx api policy [--json]` | `GET /api/protocols` | 否 |
| `ocx api policy [--messages <on\|off>] [--unrepresentable <legacy\|reject>] [--rollout <switch>=<on\|off>]... [--json]` | `PATCH /api/protocols/settings` | 是 |

- `protocols` 印出合約版本、每個用戶端 API 是否被服務與原因、無法表示的政策、每個分階段開關，
  以及政策修訂版本。`--provider` 會加上該供應商實際收到的上游線路格式、由誰決定，以及在另一個
  線路格式上的模型。
- `explain` 預覽模型從某個用戶端 API 出發會走的路徑。`--feature` 可重複指定，也接受逗號分隔的
  清單；`ocx api protocols --json` 會列出已知的功能鍵。預覽是從設定計算出來的：不會送出任何內容
  給上游，不會推進組合輪換，輸入也不會被記錄。
- `policy` 沒有設定旗標時只會讀取。帶上旗標時，會向執行中的代理送出單一變更，代理驗證後儲存
  設定並回傳新政策。`--messages off` 也會關閉 Claude 整合，如同儀表板的切換開關。開關名稱與
  組合會由代理驗證；例如除非在同一指令中 `managedMessagesNative` 已開啟或同時開啟，否則
  `--rollout managedMessagesNativeOAuth=on` 會被拒絕。

```bash
ocx api explain --model combo/main --inbound chat --feature request.seed,request.tools
ocx api policy --rollout shadowPlan=on
```

用法錯誤會在送出任何請求之前以 exit 2 結束。`--json` 會原樣印出管理 API 的回應內容。
確認新金鑰已設定並通過連線驗證，不等於核准撤銷舊金鑰。確認輪替或刪除舊金鑰前，必須另行取得撤銷該金鑰的明確授權。執行獲准的操作後，請再次檢視清單。不要透過直接呼叫 API 繞過此流程。

## 客戶端整合

### Basic integration commands

| Command | Action |
| --- | --- |
| `ocx integration client status [--client <id>] [--profile <id>] [--json]` | Read all managed file integrations, one client, or Aside profiles. `show` and `list` alias `status`. |
| `ocx integration client history [--client <id>] [--profile <id>] [--json]` | Read rollback operations and snapshot availability. `journal` aliases `history`. |
| `ocx integration client enable --client <id> [--profile <id>] [--overwrite-conflict] [--json]` | Apply the managed file integration. Overwriting a conflicting block requires the explicit flag. |
| `ocx integration client disable --client <id> [--profile <id>] [--json]` | Remove the selected managed integration through its runtime owner. |
| `ocx integration client restore --op <opId> [--client aside --profile <id>] [--confirm-drift] [--json]` | Restore a recorded operation; replacing later edits requires explicit drift confirmation. |
| `ocx integration native [list] [--json]` | Read native integration state. |
| `ocx integration native <claude\|claude-desktop\|codex\|grok> <on\|off> [--json]` | Write the selected native client's configuration through its runtime owner. |

These commands require a running proxy. `--profile` selects a nonnegative Aside account ID and
requires `--client aside`; omitted profiles select the aggregate for reads and all profiles for
unbound enable/disable. Native toggles change client configuration; Cursor has separate read-only
inspection commands below. For preview and bound-write options, continue with the recipes below.

### Preview and recover managed file integrations

```bash
ocx integration client preview --client hermes --operation apply --json
ocx integration client restore --op op-example --preview --json
```

`op-example` is fictional; use an ID from history. Preview operations are apply,
overwrite and disable; restore uses `--preview` on its existing command. Review
structural changes and `canApply`/`willChange`; valid refusal/no-op exits 0 without
applying. Enable/disable/restore accept optional `--plan-fingerprint` for an
explicit bound commit. Direct legacy writes remain available. Aside preview or
bound writes require `--client aside --profile N`. Drift confirmation and overwrite
are never automatic; stale binding exits 5 with empty stdout and a re-preview
instruction on stderr. Follow the [complete preview/commit and drift recipes](/zh-tw/guides/integrations/#preview-and-bind-a-terminal-write).

Droid apply/overwrite supports repeated `--reasoning-default MODEL=EFFORT` for
full map replacement, or exclusive `--clear-reasoning-defaults` for `{}`. Omission
preserves the map. Repeat the exact map in preview and commit; see
[Droid defaults](/zh-tw/guides/integrations/#factory-droid).

History removal is irreversible and requires an exact opId plus `--yes`:
`ocx integration client history remove --op op-example --yes --json` addresses the
global journal. Only `--client aside` and optional `--profile N` provide narrower
delete scopes. The newest row is protected. `snapshotRemoved:false` exits 1 after
retirement with cleanup incomplete; do not retry deletion or claim rollback.

`ocx integration client sync --client aside --json` refreshes eligible profiles
through the attested owner, with no profile selector or local fallback. Empty
`results` is successful observation of no eligible profiles; a failed row makes
the aggregate nonzero while preserving other successes. Read status and recovery
facts before retrying; [Aside controls](/zh-tw/guides/integrations/#aside-profile-controls)
explain profile intent versus file state.

### Inspect Cursor without installing it

```bash
ocx integration native cursor status --json
ocx integration native cursor local-installer --json
```

Status can gather model inventory; installer lookup may fetch a public manifest.
They do not download/install or toggle Cursor. Status distinguishes credential
from placeholder gateway mode; the placeholder is not an access credential.
Installer `{available:false,url:null,version:null,reason:null}` is valid, including
when Private Inference is already installed. A valid unavailable read exits 0.

### `ocx integration <claude|grok> ...`

管理支援的 Claude 與 Grok 整合。下方的直接指令家族暴露其客戶端專屬控制。

### `ocx claude [claude args...]`

確保代理正在執行，然後以 `ANTHROPIC_BASE_URL`、
`ANTHROPIC_AUTH_TOKEN`、`CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY=1`，以及來自
`config.claudeCode` 的模型插槽啟動 Claude Code。在 Claude Code 2.1.129 或更新版本中，路由模型會透過穩定的插槽別名出現在原生 `/model` 選擇器中。在舊版本上，請用 `ANTHROPIC_MODEL` 或 `/model <id>` 選擇。使用者匯出的 `ANTHROPIC_*` 變數恆優先。

Claude Desktop 設定檔指令如下：

```text
ocx claude desktop [apply]                         儲存並套用四家族設定檔
ocx claude desktop show [--json]                   顯示路由、家族與預設值
ocx claude desktop status [--json]                 顯示已套用狀態、drift 與健康狀況
ocx claude desktop move <route> <family> [--default]
ocx claude desktop default <family> <route|none>
ocx claude desktop export <path|->                 匯出版本化 JSON（`-` = stdout）
ocx claude desktop import <path> [--apply]         驗證並匯入 JSON
```

家族為 `opus`、`fable`、`sonnet` 與 `haiku`；新路由從 `opus` 開始。`none` 僅在該家族為空時有效。舊版套用旗標 `--static`、`--hybrid` 與 `--discovery-only` 仍受支援。請用 `ocx claude config <status|set> ...` 管理 Claude Code 設定。

#### Read or save the selected runtime's Desktop profile

The existing show/import commands above are local. The `profile` family targets
the running management runtime and can gather model inventory:

```bash
ocx claude desktop profile show --json > desktop-observed.json
jq '.profile' desktop-observed.json > desktop-profile.json
```

Edit/review the versioned profile, preserving server-owned applied markers. For
an authorized save, then read-back:

```bash
ocx claude desktop profile import desktop-profile.json --json
ocx claude desktop profile show --json
```

Import accepts the profile itself, not the outer `{profile,models,rendered,port}`
response, using bounded regular JSON files or explicit stdin `-` (4 MiB/30 seconds).
It returns those observed fields plus `ok:true`, meaning saved only. `--apply` and
native-mode flags are rejected; failed runtime save has no local fallback. Apply
is a separate existing Desktop action on its machine, so verify host/context
before choosing it. Rendered models are not proof of native application.

### `ocx opencode [opencode args...]`

確保代理正在執行，然後在 OpenCode 的內嵌執行階段層（`OPENCODE_CONFIG_CONTENT`）中以生成的 `provider.opencodex` 與 `providers.opencodex` 區塊啟動 opencode。既有的內嵌設定會被保留，本次啟動僅替換這兩個鍵。全域或專案的 `opencode.json` 檔案可能被讀取以警告既有的覆寫，但磁碟上的檔案永不修改。路由模型以
`opencodex/<provider>/<model>` 出現。之後啟動普通 `opencode` 的行為與之前完全相同。

### `ocx grok <status|exclude|include|set|clear|apply> ...`

管理並套用 Grok Build 模型圍欄。

## 客戶端設定匯出

### `ocx export --client <opencode|pi|omp|hermes|openclaw|kimi|gajae|dsh|mcode|zcode|prime|aside|raycast|omo|cline|kilo|droid>`

印出連接到執行中代理的客戶端設定。此指令會用所選客戶端的原生格式，序列化含有 base URL、模型清單，以及適用的環境變數參考或 loopback 佔位符的 `opencodex` provider 區塊。

代理必須正在執行；指令解析其即時連接埠、讀取 `/api/models`，並只輸出 Codex 目前可見的模型。

| 旗標 | 動作 |
| --- | --- |
| `--client <opencode\|pi\|omp\|hermes\|openclaw\|kimi\|gajae\|dsh\|mcode\|zcode\|prime\|aside\|raycast\|omo\|cline\|kilo\|droid>` | 必填。選擇客戶端設定格式。 |
| `--json` | 在 stdout 印出產生的文件的 JSON 版本，供指令碼使用。即使所選客戶端的原生格式是 YAML、TOML 或 JSON5，這裡輸出的仍是 JSON。 |
| `--out <path>` | 將設定寫入 `<path>`。拒絕覆寫既有檔案。 |
| `--force` | 允許 `--out` 覆寫既有檔案。 |

```bash
ocx export --client opencode                     # 設定加上目的地、合併警告與計數
ocx export --client pi --json > pi-models.json   # 供 pipe 或 diff 用的逐位元組 JSON
ocx export --client omp --out ./omp-models.yml    # 原生 OMP YAML
ocx export --client opencode --out ~/opencodex-opencode.json
```

未指定 `--json` 時，會先輸出客戶端的原生設定格式，接著是標準目的地路徑、合併警告、客戶端專屬提示，以及附帶有多少列省略 context limit 的模型計數（客戶端會對那些套用自身預設值）。

| 客戶端 | 標準目的地 | 下載檔名 | 環境變數 |
| --- | --- | --- | --- |
| `opencode` | `~/.config/opencode/opencode.json`（`XDG_CONFIG_HOME` 設定時優先） | `opencode.json` | `OPENCODEX_OPENCODE_API_KEY` |
| `pi` | `~/.pi/agent/models.json` (設定後 `PI_CODING_AGENT_DIR` 優先；相對路徑會被拒絕) | `pi-models.json` | 無——區塊帶有字面值 `opencodex-loopback` |
| `omp` | `~/.omp/agent/models.yml`（即使是空值，`OMP_PROFILE` 仍優先於 `PI_PROFILE`；具名設定檔會使用相對於 home 目錄的 `PI_CONFIG_DIR` 目錄名稱，並忽略 `PI_CODING_AGENT_DIR`，而預設設定檔則讓 `PI_CODING_AGENT_DIR` 優先） | `omp-models.yaml` | 無——loopback 佔位符 |
| `hermes` | `~/.hermes/config.yaml` | `hermes-config.yaml` | `OPENCODEX_HERMES_API_KEY` |
| `openclaw` | `~/.openclaw/openclaw.json` | `openclaw.json5` | `OPENCODEX_OPENCLAW_API_KEY` |
| `kimi` | `~/.kimi-code/config.toml` | `kimi-config.toml` | 無——loopback 佔位符 |
| `gajae` | `~/.gjc/agent/models.yml` | `gajae-models.yaml` | 非機密的回送佔位值 |
| `dsh` | `$DSH_HOME/settings.yaml`（預設 `~/.dsh/settings.yaml`） | `settings.yaml` | 無——非秘密的 loopback bearer 佔位符 |
| `mcode` | `~/.minimax/config.yaml` (設定後 `MINIMAX_DATA_DIR` 優先，其次為舊的 `MAVIS_DATA_DIR`；相對路徑會被拒絕) | `mcode-config.yaml` | 無——loopback 佔位符 |
| `zcode` | `~/.zcode/v2/config.json` (設定後 `ZCODE_DATA_DIR` 優先；相對路徑會被拒絕) | `config.json` | 無——loopback 佔位符 |
| `prime` | `~/.prime/agent/models.json` (設定後 `PRIME_AGENT_CODING_AGENT_DIR` 優先；相對路徑會被拒絕) | `prime-models.json` | 無——loopback 佔位符 |
| `aside` | `~/.aside/u/<account>/models.json`，對應 Aside 自己的 `accounts.json` 指定的目前帳戶；資訊清單無法讀取時會被拒絕，而不是退回任一帳戶 | `aside-models.json` | 無——loopback 佔位符 |
| `raycast` | `~/.config/raycast/ai/providers.yaml`（macOS 與 Windows 相同；Raycast 不遵循 `XDG_CONFIG_HOME`） | `raycast-providers.yaml` | 無——僅限 loopback，不會寫入 `api_keys` 項目 |
| `omo` | `~/.omo/agent/models.json`（設定後依序由 `OMO_CODING_AGENT_DIR`、`SENPI_CODING_AGENT_DIR`、`PI_CODING_AGENT_DIR` 優先；相對路徑會被拒絕） | `omo-models.json` | 無——loopback 佔位符 |
| `kilo` | `~/.config/kilo` 下最先存在的 `kilo.jsonc`、`kilo.json`、`opencode.jsonc`、`opencode.json` 或 `config.json`（`XDG_CONFIG_HOME` 可變更該目錄）；皆不存在時使用 `kilo.jsonc` | `kilo.jsonc` | `OPENCODEX_KILO_API_KEY` |
| `droid` | `~/.factory/settings.json` (`%USERPROFILE%\.factory\settings.json` on Windows) | `factory-settings.json` | 僅限迴環；不需環境變數 |

受管理的 DSH 匯出需要 DSH 0.1.0-rc.6 或更新版本，且只擁有 `llm-pi-ai.providers.opencodex`。DSH
會熱重載該 provider；使用者的預設模型與 `deepseek-official` 維持不變。這項匯出僅支援 loopback，
且不含真實憑證。

opencode 會插值 `{env:OPENCODEX_OPENCODE_API_KEY}`。產生的 Pi 與 OMP 匯出不需要環境變數：兩者都
帶有字面值 `opencodex-loopback` 佔位符。這一點很關鍵，因為這兩個客戶端在建立模型清單時都會解析
`apiKey`，並在既有設定含有未設定的環境變數參考時隱藏整個 provider。代理在 loopback 上永不檢查
產生的佔位符。OMP 支援 provider 層級的標頭，但這次初期整合刻意維持僅限 loopback；遠端
`x-opencodex-api-key` 的接線工作延後處理。

Raycast 匯出是一份獨立的 `providers.yaml` 文件，在 `providers` 序列中只有一個 `id: opencodex` 元素：`name: OpenCodex`、proxy 的 `/v1` base URL，以及每個路由模型及其 `abilities`（`tools` 與 `system_message` 一律支援，`vision` 依目錄的輸入模態而定，`reasoning_effort` 在模型有 effort 階梯時設定，`temperature` 對推理模型關閉）。Custom Providers 是 Raycast Pro 功能，且 Raycast 會監看該檔案，因此儲存後的變更不需重新啟動即可生效。格式說明見 [manual.raycast.com/ai/custom-providers](https://manual.raycast.com/ai/custom-providers)。不會寫入任何 `api_keys` 項目，所以此匯出僅限 loopback，非 loopback 的 bind 會被拒絕。

MCode、ZCode 與 Prime 的匯出基於相同原因僅限 loopback，同樣帶有 `opencodex-loopback` 佔位符
而非真實憑證。Prime Agent 讀取與 Pi 相同的 `models.json` 合約，所以這兩項匯出會產生相同的文件；
只有目的地不同。這三個環境變數覆寫中，任何一個使用相對路徑都會被拒絕，因為代理與客戶端可能有
不同的工作目錄，否則雙方會對「指的是哪個檔案」產生分歧。

ZCode 3.8.1 可能會把執行階段衍生的 `reasoning`、`limit.output` 與預設 context 中繼資料，寫回
產生的 `provider.opencodex.models` 項目中。受管理整合狀態只把這些有文件記載的新增內容視為
可重新整理的漂移。Provider 身分與連線設定——包括 `options.baseURL`、模型成員、名稱、模態，以及
OpenCodex 具權威性發出的任何 context 上限——仍受保護；編輯它們會回報 `conflict / foreign-edit`，
而不是覆寫該檔案。由較舊 OpenCodex 版本建立的所有權紀錄，在產生的目錄其餘部分未變動時可以自動
復原。若目錄與該區塊都變動了，請先檢視檔案再重新套用，因為較舊的紀錄無法證明哪個變動是
ZCode 造成的。

:::caution[合併，而非取代]
`ocx export` 永不寫入你的真實客戶端設定。目的地僅印出供你手動合併，而 `--out` 在沒有 `--force` 時拒絕覆寫既有檔案，因為取代設定檔會毀掉其中已有的其他供應商、代理與 MCP 項目。
:::

金鑰永不被序列化。設定只帶有文件化的環境變數參考，或非秘密的 loopback 佔位符。loopback 代理（`127.0.0.1`，預設值）完全不需要准入金鑰。只有客戶端 schema 支援、且代理綁定超出 loopback 時，才設定被引用的變數；關於准入金鑰的簽發方式，請見[遠端存取](/zh-tw/reference/configuration/server/#遠端存取)。上游 provider 本身的金鑰是完全不同的事，依[供應商](/zh-tw/guides/providers/)個別設定。

產生的 gjc 整合使用非機密的本機回環佔位值，不需要環境變數。此整合僅支援本機回環，不設定遠端存取憑證。

相同的 payload 亦由 `GET /api/client-config` 提供，並在儀表板的 API 分頁渲染，因此 CLI、API 與 GUI 使用相同的位元組。

## 執行階段與設定

### `ocx system <status|settings|startup|diagnostics|sync|codex-app-server|codex-restart|update|codex-cli-update> ...`

Manage headless runtime settings, startup, sync, diagnostics, and updates.

`ocx system codex-restart --yes` restarts Codex app-servers through the same module as
`ocx sync --restart-codex`. It quits and relaunches the Codex desktop app when the app launched before the current model catalog was written or this request changed
its `model_catalog_json` binding, because the model picker is built at
launch. Otherwise the app stays open, respawns its own app-server, and keeps unsaved drafts and
pending approvals. If the app or catalog state cannot be read, it takes the full restart. When
the proxy itself is running inside the Codex app, the desktop restart refuses with an actionable
message instead of promising a handoff it cannot complete.

A `model_catalog_json` binding changed by this request also forces the desktop restart, even when the shell started after the catalog file was written.

```bash
ocx system settings --stream-mode eager-relay
```

Additional system booleans take on/off: `--show-codex-credits`, `--account-picker`,
`--main-account-hard-lock`, `--ultra-fast-tier`, and `--fast-rows`. They write only
explicit fields and may combine with existing system options. Showing credits is
a display preference, not paid-credit opt-in; system Ultra Fast is separate from
provider Fast.

Ultra Fast is an opt-in setting, default off. With `--ultra-fast-tier on`, the
generated catalog adds the Ultrafast speed choice to native `gpt-6-astra` and
`gpt-6.1-sol` (including account-bound rows), so the Codex picker offers it next to
Fast. Ultrafast requires an eligible ChatGPT plan; the catalog cannot check that,
so turn the setting on only if your plan includes it. Other models and the default
speed are unchanged.

For routed models, sync and catalog convergence retain an existing routed
row's operator-supplied `ultrafast` entries in `service_tiers` and
`additional_speed_tiers` alongside its current Fast capability. Declarations belong
to the exact provider/model slug; they are not copied to other models. The setting
does not create missing declarations or restore removed models. Turning it off
removes Ultra Fast from ordinary routed rows and the generated native choice on the
next catalog regeneration.

The proxy's Fast mode decides what reaches the backend: when it is unset, a selected
Ultrafast request is forwarded as `service_tier: "ultrafast"`; `fastMode: true`
replaces any tier with Fast (`priority`), and `fastMode: false` removes the tier.
Leave Fast mode unset to use Ultrafast.

```bash
ocx system settings --json
ocx system settings --show-codex-credits on --json
ocx system settings --json
```

New-option writes report `{ok:true, settings: observedFields, catalogRefreshPending}`.
Ultra Fast performs same-target GET read-back because PUT omits that value. A
missing/mismatched/read-failed observation stays `verification:"unverified"` with
`unverifiedFields` and a nonzero exit after acceptance; requested values are never
substituted for observations. Combined desktop switches retain stored/effective
and apply facts. Pending catalog or deferred/refused native apply is distinct from
a saved setting. False pending is not proof that every client has reloaded.

`ocx system update` updates OpenCodex itself. The separate Codex CLI inspection surface is:

```bash
ocx system codex-cli-update check --json
```

`check` makes no package-registry request and inspects bounded configured-candidate provenance evidence,
including a redacted executable location and ownership evidence. Trusted published-launcher context authenticates
the candidate snapshot, not successful Codex execution. On POSIX, selection is attested only when the runtime
resolver selects the same canonical environment candidate without executing it. A linked npm-global manifest
can then establish `managed: true` when it proves ownership and, if a candidate version is reported, that version matches the manifest; persisted candidates remain unattested. The JSON report exposes `candidateAvailable`, `candidateVersion`, `candidateSource`,
and `selectionAttested`. Inspecting the configured candidate requires a trusted published-launcher context;
a direct Bun/source launch has no such proof, ignores ambient and persisted candidate state, and may report
`candidate_unavailable` on POSIX. On Windows this first slice performs no candidate or configuration filesystem I/O:
only a proof-captured absolute environment candidate can receive lexical app-bundle or version-manager labels;
every other Windows candidate fails closed. Because that slice never consults persisted state, a Windows run
with no captured environment candidate reports `windows_inspection_deferred` rather than `candidate_unavailable`:
the command cannot observe whether a Codex CLI is installed, so it reports the deferral instead of asserting
that no candidate exists. The command does not execute Codex or a package manager, repair a shim,
write configuration or cache state, stop a process, or install anything. App-bundled, recognized
version-manager, unverified standalone, and ambiguous shim states are reported as unmanaged or unknown
and are never classified as managed.

On Windows, a captured bare command such as `CODEX_CLI_PATH=codex`, a remote path, or a device path reports `candidate_path_unavailable` instead. Those cases have a captured candidate; its path is not eligible for this inspection.

#### Read-only Codex CLI update plan

```bash
ocx system codex-cli-update plan --channel latest --json
```

Run through the published Node launcher with the intended `CODEX_CLI_PATH` in the shell environment.
The plan requires an attested POSIX npm-global installation and a linked package manifest version.
It queries the official npm registry for an exact version, SHA-512 integrity and same-origin tarball,
using the launcher's captured PATH and isolated temporary npm configuration, cache and logs. Proxy
settings and `NODE_EXTRA_CA_CERTS` remain supported; cleanup is best-effort. No Codex command runs.

An applicable plan reports `applicable: true` and a deterministic `planId` binding platform,
installation-root digest, installed version, channel and target version/integrity. The plan is never
persisted. It refuses downgrades, already-current versions, active Codex sessions and incomplete
process observation. Windows returns `windows_inspection_deferred` before registry/process queries.
A refusal exits 0: inspect `applicable` and `refusal`. The printed install argv is indicative; this
command installs nothing, changes no application state and never signals a session. No apply command
is exposed, and a plan ID is not installation authorization.

#### 明確觀測 Windows x64 安裝

```text
ocx system codex-cli-update attest [--json]
ocx system codex-cli-update attest --candidate <absolute-path> --npm-prefix <absolute-path> --npm-cli <absolute-path> --node <absolute-path> [--json]
```

`attest` 是選用的唯讀操作，用於觀測所選或明確指定的 Windows x64 npm 安裝。不帶任何選項時，指令會觀測由可信 launcher 快照識別的所選候選項（已設定的 `CODEX_CLI_PATH` 或所擷取 PATH 中的第一個 `codex`），其中 opencodex 包裝腳本會解析到其重新命名的 `codex.opencodex-real.cmd` npm 備份。提供全部四個絕對路徑可覆寫自動識別；自動識別僅提出路徑，持有控制代碼的觀測才是最終依據。`--candidate` 必須是標準 npm `<prefix>/codex.cmd` 或 `<prefix>/node_modules/@openai/codex/bin/codex.js`。`--npm-cli` 必須以 `node_modules/npm/bin/npm-cli.js` 結尾，`--node` 明確指定 `node.exe`。應用程式封裝、已識別的版本管理工具配置、缺少 npm 備份的 opencodex 自有 shim 與自訂包裝腳本皆會被拒絕。

在有限讀取期間，原生控制代碼保持上層目錄與檔案開啟。未支援的平台、重新剖析點/junction、衝突的寫入者、不安全的路徑及超過大小限制的檔案皆會被拒絕。固定格式報告不含路徑：`status` 為 `observed` 或 `refused`，並提供 `installationIdentityObserved`；`selectionAttested`、`managed` 與 `applyAllowed` 一律為 `false`。回報拒絕時也可能回傳結束代碼 0，因此應檢查 `status`。

識別值或摘要僅描述觀測當下的檔案，不是持續有效的更新許可，也不證明選用的執行階段、過去的安裝程式、實際 npm 設定或工具真實性。明確指定的 Node 也只是被觀測，不能證明啟動器會選用它。命令不會執行目標、請求套件 registry、安裝、寫入設定或控制程序。現有 Windows `check` 仍不執行候選項或設定的檔案系統 I/O。

### `ocx config <show|get|set|unset|validate|export|import> ...`

檢查並安全地修改已驗證的 OpenCodex 設定。`show` 與 `get` 會遮罩秘密。匯入在寫入前驗證且需要 `--yes`。

### 從已連線的用戶端查看用量

`ocx usage` 會用這個用戶端已註冊的資料金鑰讀取已連線的 hub。人類可讀輸出會標明 hub 來源與用戶端
金鑰範圍；`--json` 回傳同一份受範圍限制的資料。區間、介面、供應商／模型過濾條件與自訂的
`--since`／`--until` 邊界都仍然可用。帳號層級的細分與其他用戶端的紀錄不會被分享。過舊或無法使用
的 hub 會產生明確錯誤，而不是拿本機用量頂替；若 hub 不支援這項讀取，請升級它。

唯讀的資料平面端點是 `GET /v1/usage`，使用 `x-opencodex-api-key` 搭配已設定的用戶端金鑰。環境
層級與管理用金鑰會被拒絕。它接受 `range`、`surface`、`provider`、`model`、`since` 與 `until`；
未知或重複的選項，以及呼叫端自選的金鑰 ID 都會被拒絕。被略過的過大資料列仍保有明確的歷史不完整
警告。

## 說明列出的請求

人類可讀的 `ocx logs` 輸出包含 `id=<request-id>`。把該值傳給 `ocx logs explain <request-id>` 以檢視路由決策。沒有 ID 或 ID 含有控制字元的列，會省略該欄位，而不是顯示一個不同的查詢鍵。JSON 與 JSONL 輸出保留既有的 schema。

## 路由設定檔查詢狀態

`ocx route policy show <id>` 在設定檔不存在時以結束碼 4 結束。缺少或無效的指令引數以結束碼 2 結束。腳本可以區分缺少的設定檔與不正確的用法。

## 上游錯誤細節

當上游錯誤封套包含多個訊息欄位時，OpenCodex 會依既定的優先順序使用第一個非空白的字串。空的或格式錯誤的欄位不再遮蔽有效的後備診斷。
### Forced Claude Code subagent model

The Subagents page offers **Force all subagents onto one model**, off by default. Select an exposed roster-style id, such as `combo/tev-auto`, then enable the switch. The roster is offered first; unavailable saved roster entries cannot be force targets.

`ocx agent subagents force combo/tev-auto` sets `claudeCode.subagentModelForce`; `ocx agent subagents force -` clears it. `ocx agent status` reports the setting. `GET /api/subagent-models` returns `force`, `forceAvailable`, and `forceStatus`; `PUT` accepts `{ "force": "combo/tev-auto" }` or `{ "force": null }` without changing the roster. Omitting `force` leaves it unchanged. Invalid or unexposed targets are rejected on write; stale targets are reported and skipped at launch.

This takes effect on the **next routed `ocx claude` launch**, injecting `CLAUDE_CODE_SUBAGENT_MODEL` as an explicit proxy alias (with `[1m]` only for an authoritative million-token window; native Claude targets use a reversible native alias) and `CLAUDE_CODE_SUBAGENT_MODEL_FORCE=1`. Each nonempty shell-exported variable independently wins. Native launches inject neither variable; plain `claude` is not affected. No plugin files or `settings.json` are modified by this setting.

Claude Code **2.1.257 or newer** is required for FORCE. Plugin and built-in agents (including Explore/Plan) and per-call model arguments are overridden. Forks and subagent skills with `model: inherit` keep the main conversation model. The main loop and Haiku/small-fast sidecars are unaffected. Existing roster files remain available.

The dashboard warns about old or unknown CLI versions, unavailable targets, and either variable already present in `settings.json` → `env` (which overrides launch env). Detection is read-only and server-local: it cannot inspect another launch shell, another machine, or project-local settings. An unknown result is not proof of force support.
