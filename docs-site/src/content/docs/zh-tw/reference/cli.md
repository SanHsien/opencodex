---
title: CLI 參考
description: 命令分派、離開碼，以及每個 ocx 命令家族的連結。
---

opencodex 的命令列工具是 `ocx`。它依第一個命令名稱分派，有記載的別名如
`setup`/`init`、`restore`/`eject`、`models`/`model` 都會到達相同操作。
未知命令與無效的命令形狀都是錯誤。

執行 `ocx help`（或 `ocx --help` / `ocx -h`）檢視頂層用法。對幫助表中註冊的命令，
執行 `ocx help <command>`、`ocx <command> --help` 或 `ocx <command> -h`。幫助與版本
命令均為只讀：它們不會啟動、停止、安裝、解除安裝或改寫 Codex／opencodex 狀態。

## Nested help

Family help such as `ocx help models` preserves the family's usage and details, then
lists known declared child paths with summaries. These lists describe declared children;
they do not guarantee exhaustive runtime coverage. Alias help retains the alias's own usage
and details and points to its canonical family: `ocx help model` leads to `ocx help models`.
Models help also links the curated `models context` topic separately from declared capabilities.

Help accepts a path with more than one command word:

```bash
ocx help models context
ocx models context --help
ocx model context --help
ocx help account list
ocx help account main
```

The first three forms show the same context-cap topic, including the `model` alias:

```text
ocx models context <status|value <tokens> [--set-all]|provider <name> on [--value <tokens>]|provider <name> off|all <on|off>> [--json]
```

`ocx models context status --json` reads the current settings. `value <tokens>` sets the
default for future toggles; adding `--set-all` applies it to all routed providers.
`provider <name> on` enables a provider cap, optionally with `--value <tokens>`; `off`
disables it. `all on|off` changes all routed providers together.

Declared capability topics such as `account list` show their summary, known flags and
details, with a pointer to parent help. This metadata does not cover every operand or runtime
subcommand, so a topic can show `Command: ocx ...` without claiming a complete `Usage:` grammar.
A prefix such as `account main` lists its declared children and marks that coverage as incomplete.
An undeclared explicit topic (`ocx help <path>`) exits 1 with a concise detailed-help-unavailable
message and a known-parent or full-reference pointer on standard error. Standard output stays
empty, and no full help banner is printed. Missing detail does not establish whether the runtime command is valid.
Appended `--help`/`-h` preserves existing command-help behavior: when detailed metadata is unavailable,
it displays known parent help successfully, without executing the command.

In the Bun CLI head, bare `help` is recognized only at the root or immediately after the root
command. Use `--help` or `-h` for nested paths. Later values such as the `help` in
`ocx alias set demo help` remain command arguments. An exact `--` ends head help scanning,
so `ocx claude -- --help` preserves the arguments for command dispatch.

## Recovering from command typos

Unknown root commands and unresolved explicit help paths exit 1 with a short diagnostic and
navigation guidance on standard error, leaving standard output empty. Close typos can receive
conservative suggestions drawn from visible command names and the current help family's documented
children. Suggestions are guidance only: the CLI never executes them or retries the command.

| Input | Guidance |
| --- | --- |
| `ocx modles` or `ocx help modles` | Suggests `ocx help models`. |
| `ocx help account lisst` | Suggests `ocx help account list` within the account family. |
| `ocx help qzxv` | Offers `ocx help --all` without guessing a command. |
| `ocx help models qzxv` | Reports unavailable detailed help and points to the known models family. |

The Bun CLI rejects an unknown root before shim auto-restore or other command preflight.
Recognized commands retain their existing preflight; hidden commands and the internal runner
remain valid dispatch targets but are excluded from discovery and suggestions. Appended flag-help
fallback, capability JSON, and provider-specific error handling retain their existing behavior.

## 命令家族

### `ocx message`

`ocx message sessions [--json]` discovers loaded local Codex sessions.
`ocx message send (--thread <uuid> | --name <exact-name>) --stdin [--json]`
submits one correlated peer message, without starting a daemon or resuming a thread.
See [Local Codex Messaging](/zh-tw/reference/cli/messaging/) for sender context, kinds,
the tested runtime and `not_sent`/`queued`/`unknown` receipts. No remote transport is included.

### `ocx provider`

`ocx provider`, `ocx help provider`, `ocx provider help`, `ocx provider --help`, and
`ocx provider -h` show the same provider help, with command syntax, examples, preset/custom
guidance, and declared topic pointers. Successful help prints to standard output and exits 0.
Bare `ocx provider` still follows ordinary command preflight; explicit head-help forms exit
before that preflight. An unknown provider action prints its diagnostic and provider help
to standard error, leaves standard output empty, and exits 1.

### `ocx alias`

`ocx alias list [--json]` 顯示生效中的使用者別名與內建別名。使用 `ocx alias set <provider>[/<native-model-id>] <alias>` 與 `ocx alias rm <provider>[/<native-model-id>]` 編輯它們。原生模型 id 可能含有額外的斜線，因為選擇器只在第一個斜線處分割。使用 `ocx alias defaults on|off [--provider <name>]` 啟用內建預設別名。

### `ocx remote-workspace`

`ocx remote-workspace pair <hub-url> --pairing-code-stdin --root <absolute-path>` 把本機電腦註冊為僅限 OCX 的 Executor。重複 `--root` 可核准更多資料夾，使用 `--name` 可覆寫主機名稱。重複 `--toolchain-root <absolute-directory>` 可在命令沙箱內以唯讀方式公開使用者自行安裝的 Node、Rust、Go 或其他工具鏈目錄。在 macOS 與 Windows 的私有 dogfood 建置上，`bun run build:remote-workspace-helper` 會建立 pair 命令自動探索到的 Rust 輔助程式；`--executor-helper <absolute-file>` 可選擇另一個經明確審查的建置，並把其 digest 釘選進本機 Executor 狀態。`ocx remote-workspace agent` 維持出站的加密連線；`ocx remote-workspace status [--json]` 回報 Hub、裝置、roots 與宣告的能力，不會印出其 bearer 或私鑰。詳見 [Remote Workspace](/zh-tw/guides/remote-workspace/)。

- [生命週期](/zh-tw/reference/cli/lifecycle/) — 設定、代理與服務生命週期、健康狀態、
  診斷、目錄同步、儀表板與更新。
- [Providers、帳號與模型](/zh-tw/reference/cli/providers-accounts/) — provider 設定、
  認證、憑證池、配額、自訂模型、可見性、選定模型與 context 上限。
- [Agents、路由與整合](/zh-tw/reference/cli/agents/) — multi-agent 控制、combos、
  可觀測性、admission key、用戶端整合、執行環境設定、已驗證的設定，以及唯讀的
  Codex CLI 更新檢查。

## 無頭（headless）行為

管理命令往返於執行中代理的管理 API，使用記錄的執行環境埠與身分檢查，而非維護第二條
設定路徑。停止或無法連線的代理以 HTTP 503 呈現，並產生非零的 CLI 離開碼。明確記載為
離線設定操作的命令，可以在沒有執行中代理的情況下驗證與編輯設定檔。

`check` 不查詢註冊表，也不執行 Codex。在 POSIX 上，當已發布啟動器擷取的環境候選項與執行階段解析器選擇的正規路徑相同時，`selectionAttested` 可以為 `true`；若關聯的 npm-global 套件資訊清單證明了所有權，`managed` 可以為 `true`。持久化候選項仍不獲認證。Windows 不讀取候選項或設定檔，而是延後檢查。直接透過 Bun 或原始碼執行時沒有啟動器證明。`plan` 使用隔離的暫存 npm 設定、快取和日誌查詢官方註冊表，並拒絕活動工作階段或不完整的程序觀測。它不安裝軟體，也不向程序傳送訊號。請參閱[完整命令與拒絕原因（英文）](/zh-tw/reference/cli/agents/#read-only-codex-cli-update-plan)。

觀測 Windows x64 安裝的方式請參閱 [`attest` 命令](/zh-tw/reference/cli/agents/)。未提供明確路徑時，該命令會觀測由受證明約束的啟動器快照識別出的已選候選項；它不授予更新權限，也不證明執行階段選擇。

沒有歧義時，list 或 status 是預設。使用 `--json` 取得結構化快照，並以
`ocx observe logs --follow --jsonl` 取得串流的請求 log feed。佈景主題、語言、導覽與
其他純視覺的瀏覽器狀態沒有 CLI 對應；Cloudflare Tunnel 設定不在此命令集內。

## 存活探測上限覆寫

`ocx health`、`ocx status`、`ocx account *`、`ocx login codex` 與 `ocx ready` 透過短時存活探測尋找執行中的代理：預設每次 750 ms，停止與啟動判斷使用含重試的 1500 ms。若安全層（內容過濾器或 EDR 類網路擴充）替每個回送連線增加固定延遲，健康的代理可能來不及回應就已逾時。

在這類主機上可設定 `OCX_PROBE_TIMEOUT_MS` 提高上限，例如 `OCX_PROBE_TIMEOUT_MS=5000 ocx status`。值為 1 到 30000 的整數毫秒。覆寫只會提高上限：750 ms 預設值與 1500 ms 停止／啟動預算保留下限，因此 `1000` 只會延長預設探測。未設定、空值、小數、負數、0 或更大的值都會被忽略。

## 離開碼與確認

成功的命令離開 0。無效用法、未知命令或資源、失敗的 API 操作以及無法使用的必要服務
會以非零離開。`ocx health` 特別只在代理健康時離開 0，找不到健康的代理時離開 1，參數無效時離開 2，因此可作為服務探針。
腳本應測試離開碼，而不是解析人類可讀的輸出。

具體的離開碼集中定義在單一位置，因此每個管理命令的結果一致：

| 碼 | 原因 |
|---|---|
| 0 | 成功 |
| 2 | 用法錯誤——引數錯誤、缺失或未知；沒有送出任何請求 |
| 4 | HTTP 404——指名的帳號、provider、金鑰或路由不存在 |
| 5 | HTTP 409——衝突；鎖被持有，或狀態已在底層變更 |
| 1 | 其他所有情況，包含傳輸失敗與其他 HTTP 錯誤 |

離開 0 代表沒有回報錯誤。預覽性質的動詞（例如未帶 `--yes` 的 `ocx storage cleanup`）同樣會離開 0 且不做任何變更。命令絕不會在印出錯誤的同時離開 0。

宣告需要確認的破壞性移除、匯入、信用消耗與更新操作，在非互動使用時需要 `--yes`。
該旗標是明確的 opt-in；省略它不得靜默確認該動作。

`ocx storage cleanup` 更進一步：未帶 `--yes` 時，它會執行預覽並印出*將會*釋放的內容，然後在沒有做任何變更的情況下離開 0。這些命令都沒有互動式確認——自動化呼叫端能回答的提示不是安全邊界，所以旗標本身才是邊界。

## 從 agent 驅動 CLI

Discover progressively, without starting a proxy:

```bash
ocx help
ocx help models
ocx help models preset show
```

Read the corresponding chapter in the repository's `skills/ocx/references/01_management_surface.md`
or one of the public command-family pages above. Full `ocx help --all` is an
escape to the top-level reference. A broad machine inventory is optional:

```bash
ocx capabilities --json
ocx capabilities --mutating-only --json
ocx capabilities --route '/api/providers/{provider}/model-costs' --json
```

Route lookup matches the literal declared template, not concrete provider IDs or
an HTTP method. A miss exits 4 and does not prove that a runtime command is absent.
Declarations include local commands as well as management commands; only the
latter need a live target. Before live operations, run `ocx ready --json` and
`ocx status --json`, inspect the target and `versionSkew.relation`, and resolve
version mismatch. `unknown` does not confirm matching builds. Offline help,
local configuration and local Lab inspection do not require startup.

`ocx status --json` includes `cliCommand`: configured Desktop intent, the expected executable, observed PATH candidates, `pathFirst`, `desktopFirstOnPath`, issue codes, and `shellResolution: "unobserved"`. The human status report prints one command-selection line. `ocx doctor` adds an “ocx command selection” section: invalid, unsafe (`record-unsafe`) or enabled-pending records and missing/unusable Desktop targets fail the check, while disabled cleanup-pending records, PATH ordering conflicts and incomplete scans warn. `OCX_NO_DESKTOP_HANDOFF=1` suppresses package-launcher handoff for one invocation; it leaves the Desktop shim and PATH configuration in place. These read-only observations do not execute candidates, resolve parent-shell aliases/functions, or identify the proxy’s runtime owner. On Windows, package-launcher handoff is disabled; user `Path` order selects the Desktop `ocx.exe`. Status and doctor still read the record and report the first PATH candidate. A possible cmd current-directory candidate is reported separately from PATH order.

Output flags are per command. `doctor` rejects `--json` with exit 2;
[`v2` (family reference)](/zh-tw/reference/cli/agents/)
supports `--json` for local and `--live` targets. Even for JSON-capable management commands, API failures
normally use stderr prose with optional `reason:` and `hint:` lines, not a JSON
error envelope. Keep stdout, stderr and exit status separate.

Coverage is measured by named workflows, not by shared route prefixes. Existing
model presets, visibility, account controls and routing-profile reads do not imply
support for discovered-model display-name edits or routing-profile writes.
Session-only consent actions and browser presentation remain separate boundaries.
Access-key creation and rotation-start return plaintext credentials: agents must
hand those steps to a human-operated terminal outside the session and accept only
non-secret IDs and confirmation. Never ask for credentials in chat or bypass a
session-only action with another API client.

## 近期行為變更

以下是對先前錯誤回報自身結果之命令的修正：

- `doctor` 與 `sync-cache` 現在會在失敗時以非零離開。它們先前會印出失敗卻離開 0，導致腳本無法區分成功與失敗。
- 來自 `account` 的用戶端錯誤現在會把 HTTP 404 對應到離開碼 4、HTTP 409 對應到離開碼 5，而不是全部塌縮成 1。
- `--json` 現在在任何引數位置都會被遵循，包含 `ocx restore back --json`，該旗標先前會被接受卻遭忽略。
- `ocx logs --model` 現在真的會過濾。先前它會被接受並靜默忽略，導致輸出看起來像過濾過，實際上卻顯示每一列。
- `ocx storage` 新增了 `cleanup`、`trash` 與 `policy` 子命令。單獨的 `ocx storage` 仍會印出儲存報告，如同它先前作為 `ocx observe storage` 別名時的行為。

## 版本與內部分派目標

`ocx --version`、`ocx -v` 與 `ocx version` 會列印一行適合腳本使用的版本行並結束。

有兩個分派目標刻意不顯示在一般幫助中：`__refresh-version [preview]` 在分離的
程序中重新整理更新通知快取，`__gui-update-worker <job-id> [latest|preview] [restart]`
執行儀表板更新任務。它們是實作細節，不是穩定的使用者面向命令。儀表板會記錄 worker
PID、恢復 worker 已死但仍在進行中的任務、把超過十分鐘且沒有 PID 的舊 active 記錄
視為過期，並保護執行中的 worker 免受並行更新影響。

## 能力引數驗證

`ocx capabilities` 會以結束碼 64 拒絕未知的引數、重複的旗標與空白的 `--route` 值。有效的路由若沒有宣告任何能力，會以結束碼 4 結束。

## 整數選項值

像 `--limit` 這類整數選項，必須是落在 JavaScript 安全整數範圍內的十進位整數。接受 `1_000` 與 `1,000` 這類數字分隔符。空值、十六進位、指數表示法與小數，會在送出請求之前被拒絕。

## Windows JSON 設定檔

`ocx config validate <file>` 與 `ocx config import <file> --yes` 接受有或沒有開頭 BOM 的 UTF-8 JSON，包括 stdin（`-`）。這支援來自 Windows PowerShell 與編輯器的 UTF-8 匯出檔。不接受 UTF-16 輸入。

## 預設別名列表

`ocx alias --json` 等同於 `ocx alias list --json`。輸出旗標可以放在明確的別名動作之前或之後。

## Local config output and validation

`ocx config validate [path|-] [--json]` exits 1 when validation fails. JSON mode emits one `{ok:false,error}` payload; human mode names the validation failure.

When saved config is invalid or unreadable, `ocx config`, `ocx config show`, and `ocx config get` warn on stderr that defaults are being shown for invalid settings and exit nonzero. Stdout retains its existing format. Run `ocx config validate` to inspect the error, or `ocx config show --source` for the config and source diagnostics. The explicit `--source` inspection exits 0 when it successfully reports a fallback and still emits the warning.

`ocx config export <file> --json` writes the raw config to the file and emits only `{ok:true,path}` on stdout. Export to `-` always emits the raw config document, including credentials; keep it out of agent transcripts.

Local `ocx provider add` validates the full candidate config before saving. A validation failure leaves the saved file unchanged. Intentionally local providers require `--allow-private-network` unless their registry entry already permits private destinations. The flag does not permit blocked metadata endpoints.

`ocx health` accepts only one optional `--json` flag. Unknown arguments or repeated flags return exit 2 before probing. Alias usage errors also return exit 2 with a readable error; unknown actions name `ocx help alias`.

### Log model selectors

`ocx logs --model` accepts either a bare model ID or the full `provider/model` label printed in human rows, including models whose bare IDs contain slashes. Failover attempts are matched as complete destinations. Filtering occurs before `--limit`, and `--follow` uses the same server filter. An empty filtered human result says no log entry matched; `--json` and `--jsonl` keep their machine-readable output.

`ocx hub disable [--revoke-clients --client-key <id> ...] [--json]` returns a hub to standalone in one validated config write. Client key revocation requires explicit IDs because key names do not prove origin. See [Return a hub to standalone](/zh-tw/guides/remote-hub/#return-a-hub-to-standalone).
