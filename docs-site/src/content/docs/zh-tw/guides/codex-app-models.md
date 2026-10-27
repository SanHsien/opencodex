---
title: Codex App 模型選擇器
description: opencodex 模型如何透過共享 Codex 目錄出現在 Codex App、Codex CLI 和 Codex TUI 中。
---

opencodex 不會修改 Codex App。它會寫入 Codex CLI/TUI 所使用的同一套 Codex 設定和模型目錄。
Codex 的 app-server 會讀取這份共享狀態，但部分 Codex Desktop 版本會在 renderer 套用第二層
遠端模型 allowlist，仍可能把已路由的列從選擇器中移除。

OpenAI 條目使用兩條憑證路線：原生 Codex 登入，以及帶名稱空間的 `openai-apikey/<model>`
API key 傳輸。僅在 Pool 與 Direct 之間切換 `codexAccountMode` 本身不會改變選擇器 id。不過，
當 `codexAccountPickerEnabled` 啟用帳號限定選擇器列，且 `codexAccountNamespaces` 中仍有對應
帳號存在的合格選擇器時，opencodex 會為這些對應帳號新增獨立的 `<selector>/<native-openai-model>`
列，並從 Codex 選擇器中隱藏裸的原生列。選擇器標籤是使用者自訂的公開名稱，本身沒有帳號角色
的語意。選擇限定列只會使用其對應的帳號，不會改變目前 Pool 帳號；當目標不可用時會失敗關閉
（fails closed），而不是切換帳號。參見
[精確 Codex 帳號選擇器](/zh-tw/reference/configuration/routing/#精確-codex-帳號選擇器)。

當 `codexAccountNamespaces` 對應表為空時，帳號限定選擇器列是關閉的。若省略
`codexAccountPickerEnabled` 但對應表非空，基於向後相容會被視為啟用。將其設為 `false` 可以
隱藏生成的限定列並恢復選擇器中的裸原生列，同時不必刪除對應或停用精確的
`<selector>/<native-openai-model>` 路由。

API GPT-5.6 條目使用 1,050,000 context / 922,000 max input；`*-pro` 選擇器 id 會解析為帶
`reasoning.mode: "pro"` 的 base wire 模型，而日誌、用量與選擇器狀態仍保留虛擬 id。API 目錄
固定為恰好八個 id：`gpt-5.5`、`gpt-5.6`、Sol/Terra/Luna，以及它們的三個 Pro 虛擬 id；沒有
通用的 `gpt-5.6-pro` 別名。Compact 請求保留所選 tier，但會在不帶 reasoning 物件的情況下傳送
base 模型。

`gpt-daybreak-blue-latest` 受帳號權限限制。opencodex 會先檢查每個已驗證 ChatGPT 帳號自己的
Codex 模型名冊，才決定要不要宣告或路由它。在 Pool 模式下，只有當至少一個合格的 Pool 帳號回報
該 slug 時，裸的那一列才會存在。在 Direct 模式下，裸列跟隨本機目錄所使用的主帳號，而且每個請求
還會檢查轉送過來的呼叫端憑證（或在 OpenCodex 准入 bearer 被替換時，檢查已儲存的主憑證）。
`<selector>/gpt-daybreak-blue-latest` 這一列只有在該選擇器對應的帳號回報它時才存在。Pool 路由
會排除沒有權限的帳號。若無法確認任何名冊，受限的那一列會關閉失敗，而不是把一次 prompt 花在
上游的 400 上。

`gpt-5.6-sol`、`gpt-5.6-terra`、`gpt-5.6-luna` 與 `gpt-6-astra` 刻意**不**這樣限制：不論權限名冊
怎麼說，每次安裝都會列出它們。opencodex 會用夠新、足以回傳它們的用戶端版本去問上游，但它無法
憑空生出答案——未確認的帳號、逾時的查詢，或是還沒同步到的分片，都會讓模型毫無說明地從選擇器裡
消失。列出它們代表請求會真的送出，你看到的是上游的真實狀態。沒有這些模型的帳號會在送出請求時
收到上游拒絕，而不是看到一列空白；在多帳號的 Pool 中，請求也不再會被優先導向擁有該模型的帳號。
要隱藏其中任何一個，`disabledModels` 才是那個開關。

另外用一個明確的 `customModels` 條目，可以透過標準的 Codex 登入轉送供應商，把與
`openai/gpt-daybreak-blue-latest` 相同的 wire id 暴露出來：

```json
{
  "customModels": [
    {
      "id": "daybreak-codex-forward",
      "provider": "openai",
      "modelId": "gpt-daybreak-blue-latest"
    }
  ]
}
```

只有那個確切的供應商、端點與模型 id 會取得釘住的 Sol 能力快照：922,000 context、829,800 自動
壓縮、原生 reasoning 階梯，以及原生 Codex 工具中繼資料。請求送出的仍然是
`gpt-daybreak-blue-latest`；opencodex 不會把它改寫成 Sol，也不會授予帳號權限。另外計費的
`openai-apikey/daybreak-blue-latest` API 列是另一條路線，它的 1,050,000 / 922,000 上限絕不會被
複製到 Codex 登入的那一列。

對於位在標準 `openai` Codex 轉送目的地上的自訂 Astra 與 Daybreak 列，明確指定的 `reasoningEfforts`
會受該模型釘住的 Codex 能力所限。自訂的 `["none", "minimal", "low"]` 在目錄中會變成 `["low"]`；
非空但沒有任何支援值的清單，同樣會退回原生預設值作為單一選項。明確寫成 `[]` 則維持空的，且不會
宣告預設值。宣告的預設值只有在它屬於最終清單時才保留；否則優先使用存在的原生預設值，再不然就用
第一個存活的選項。已儲存的自訂設定不會被更動，重複同步也不會把 `max` 加回一個收窄過的自訂清單。

選擇選擇器 id 所代表的憑證路線。在 Providers 頁面切換 Pool/Direct；下面的 `<selector>` 是
使用者自訂的公開標籤，透過 `codexAccountNamespaces` 對應：

```text
gpt-5.6-sol                         # 經由 Pool 或 Direct 的裸 Codex 登入路線
<selector>/gpt-5.6-sol              # 由該選擇器對應的已儲存 Codex 帳號
openai-apikey/gpt-5.6-sol           # API key
```

全新安裝以及未儲存模式的設定檔預設為 Pool。目前設定檔使用 marker 2，並在
`~/.opencodex/config.json.pre-openai-tiers-v2.bak` 保留出廠的 v1 原始檔；用以下指令恢復：

```sh
cp ~/.opencodex/config.json.pre-openai-tiers-v2.bak ~/.opencodex/config.json
```

較早的 v1 三 provider 設定會自動遷移為單一的 option-aware 列。

## Desktop 遠端 allowlist 限制

如果 `codex debug models` 和 app-server 的 `model/list` 都包含某個路由模型，但 Desktop 沒有
顯示它，請查看上游的 [Codex issue #19694](https://github.com/openai/codex/issues/19694)。當
遠端 `use_hidden_models` 政策啟用時，Desktop 只能保留其原生 `available_models` 清單中的 id，
而且也可能顯示目錄可見性為 `hide` 的原生列。單靠重新整理目錄或重啟代理無法改變這個 renderer
政策。

對於等效的路由模型，opencodex 提供一個明確、預設關閉的 native-alias combo 模式。它會發布
一個通過 allowlist 的裸 slug（帶誠實的自訂顯示標籤），並在進行正式 OpenAI 路由之前，先把該
精確 slug 經由已設定的 combo 路由。只要相容別名存在，它也把已停用的裸原生列從有效目錄中
省略，因此 Desktop 無法藉由忽略 `visibility` 讓它們復活。指令、停用 key 語意與安全性限制請見
[Codex Desktop native-allowlist 相容性](/zh-tw/guides/combos/)。

### 停用原生模型時代表什麼

未設定 native alias 時，停用一個裸原生 GPT slug 並不會把它從目錄中移除。該列仍會保留，
`visibility: "hide"`——`/v1/models` 與儀表板都會遵守這個標記，不再列出該模型——而 Desktop 在
上述政策下仍可能繼續顯示它。因此你停用之後，該模型仍可能在 Desktop 中被選到，各介面對「它
是否存在」的認定並不一致。

選到它並不會因為已停用而被拒絕。`disabledModels` 控制的是目錄可見性，不是准入，因此請求會
依一般規則路由，就像該模型仍是啟用狀態一樣：這一輪會在你停用的模型上執行，或是在該 id 解析到
的任何路徑上失敗。無論哪種結果，都不是開關暗示的那個結果。

保留該列是刻意的設計。它持有真實的上游中繼資料，因此重新啟用該模型時會還原那份中繼資料，
而不是合成的猜測值。當你需要該列徹底消失而不只是隱藏時，請設定 `nativeAlias` combo：只要
它存在，已停用的裸原生列就會被完全排除於有效目錄之外。

如果 Codex 的 `config.toml` pin 了一個此代理不提供的根層級 `model`——包括某個已停用的模型——
每個新 session 都會從一個 opencodex 不提供服務的模型開始。`ocx doctor` 會在**Codex 預設模型
曝光**下回報這個情況，視為警告而非失敗，並在完全無法判斷曝光集合時也會說明。

## 整合路徑

`ocx init`、`ocx start` 和 `ocx sync` 會把共享的 Codex 設定與目錄接入代理；設定注入、目錄同步、
shim、WebSocket 回退與恢復機制請見 [Codex 整合](/zh-tw/guides/codex-integration/)。

## 為什麼路由模型會顯示

When the Codex app exhausts its native five-hour quota it can switch to a reserve
fallback model and grey out the other rows in its picker. Reported in
[#2813](https://github.com/lidge-jun/opencodex/issues/2813), that gating also hides routed
opencodex rows, even though those use unrelated provider credentials and consume none of the
ChatGPT quota.

This gate is applied by the client before a request reaches the proxy, so opencodex cannot lift
it. Routed rows are written with `visibility: "list"`, catalog filtering consults only
`disabledModels` and each provider's `selectedModels`, and no quota value takes part in routed
visibility.

Selecting a routed model explicitly does not go through the picker. Set the model in
`config.toml`:

```toml
model = "anthropic/claude-sonnet-5"
```

or send it directly:

```bash
ocx access test anthropic/claude-sonnet-5 --protocol responses
```

Both paths route correctly **once the request reaches the proxy** — that part is covered by
tests. The Codex desktop app, however, does not send the configured model while reserve mode is
active: it decides reserve from its own `wham/usage` poll (`luna_reserve` upsell plus an allowed
`gpt-reserve` additional limit) and forces the model setting to `gpt-reserve` before the request
leaves, so the `config.toml` route is overridden in the app. Use `ocx access test`, Claude Code
through the proxy (`ocx claude`), or any direct `/v1` client until the window resets. See
[Routed models during Codex reserve mode](/zh-tw/guides/codex-integration/#codex-保留模式下的路由模型).

Codex's model picker expects Codex-shaped catalog entries. opencodex builds routed entries by cloning
a native Codex model template, then replacing the routed model identity:

```text
slug = "anthropic/claude-sonnet-..."
display_name = "anthropic/claude-sonnet-..."
visibility = "list"
```

The clone keeps strict-parser fields such as reasoning levels, shell type, API support flags, and
base instructions. opencodex then removes native-only capabilities that the route cannot honor,
including OpenAI service-tier metadata.

## 目前穩定模型涵蓋範圍

原生回退列表包含 `gpt-5.5` 以及 GPT-5.6 Sol/Terra/Luna。對於 GPT-5.5 系列，opencodex 會
保留已安裝 Codex 目錄中資訊更完整的即時條目，僅在條目缺失時才合成。內建的上游快照只用於
GPT-5.6，以便提供每個模型真實的身份和後設資料，而不是套用舊模板近似生成。

| 路由 | 選擇器 id 與目錄後設資料 |
| --- | --- |
| Codex 登入（停用帳號限定列） | 裸原生 id，例如 `gpt-5.6-sol`、`gpt-5.6-terra`、`gpt-5.6-luna`；透過 `codexAccountMode` 選擇 Pool 或 Direct。GPT-5.6 列使用 922,000 token 的目錄視窗。 `gpt-6.1-terra`：預設上下文 500,000 / 長上下文 872,000。 |
| Codex 登入（啟用帳號限定列且有合格選擇器） | 每個合格選擇器與受支援的原生模型各有一列 `<selector>/<native-openai-model>`；每列只使用其對應帳號，且裸原生列會從選擇器中隱藏。原生後設資料與 context 視窗保持不變。 |
| OpenAI（API key） | 帶命名空間的模型包括 `gpt-5.5`、`gpt-5.6`、Sol/Terra/Luna、`*-pro` 虛擬 id 與 Daybreak 別名（上下文 1,050,000；最大輸入 922,000）。`openai-apikey/gpt-6.1-terra` 的上下文為 1,050,000，最大輸出為 128,000。 |
| OpenRouter | `openrouter/openai/gpt-5.6-sol`、`openrouter/openai/gpt-5.6-terra`、`openrouter/openai/gpt-5.6-luna`（922,000） |
| OpenRouter | `openrouter/openai/gpt-6.1-terra` (1,050,000) |
| Cursor | 靜態回退目錄包含 `cursor/gpt-5.6-sol`、`cursor/gpt-5.6-terra`、`cursor/gpt-5.6-luna`（1,000,000），以及 Grok 4.5/4.6/4.7 的一般與 Fast 項目（500,000）。4.6 和 4.7 還提供 `xhigh`；帳號的即時發現結果決定最終顯示哪些模型。 |
| xAI | 以即時發現結果為準。回退目錄包含 `xai/grok-4.6` 與 `xai/grok-4.7`，預設模型仍為 `xai/grok-4.5`；三者的 context window 均為 500,000。Grok 4.6 與 4.7 提供 `low` / `medium` / `high` / `xhigh`（上游預設值為 `high`），Grok 4.5 最高為 `high`。 |

固定的 GPT-5.6 條目會保留精確的上游 reasoning 階梯。Sol 和 Terra 從 `low` 到 `ultra`，Luna
最高到 `max`。Sol 預設使用 `low`，Terra 和 Luna 預設使用 `medium`。`ultra` 是用戶端側的
“最大 reasoning + 主動委派”選項，到達後端時會轉換為 `max`。模型出現在選擇器中只表示目錄已經
準備好；關聯的帳號或 API key 仍需具備該模型的實際權限。

## 原生與路由模型開關

儀表板的 Models 頁面為裸原生 id 與路由的 `provider/model` id 提供 `disabledModels` 開關。
帳號限定的 `<selector>/<native-openai-model>` id 也受 `disabledModels` 支援，但儀表板不會列出
或切換這些精確的選擇器列；請手動加入設定檔：

- 路由 id 使用 `provider/model` 名稱空間。停用後，該模型會從同步目錄和 `/v1/models` 中排除。
- 帳號限定的原生 id 使用 `<selector>/<native-openai-model>`。把它加入 `disabledModels` 只會
  隱藏該選擇器列。
- 原生 GPT id 是裸 slug。停用時不會刪除目錄條目，而是將 `visibility` 改為 `hide`，以便稍後
  重新啟用時能精確恢復原條目；它會從自動探索中隱藏該裸列以及該模型的每個選擇器限定複製條目。
- 只要設定至少一個 native-alias combo，已停用的裸原生列就會被省略而非保留為 hidden，因為
  受影響的 Desktop 版本會忽略 hidden 旗標。被 native alias 遮蔽的裸原生 slug 也會從 Models
  頁面省略，因此它在那裡沒有原生開關；只有未被遮蔽的原生列可供切換。重新同步會在重新啟用
  未遮蔽的停用列時恢復原始的原生後設資料。
- 未遮蔽的原生列來自受支援的靜態集合，因此已停用的未遮蔽模型仍會留在儀表板中，可以重新開啟。

可見性處理位於快照升級之後。每次切換模型後，管理 API 都會重新整理目錄，並強制把 Codex 模型快取
標記為過期。

## Multi-agent surface 模式

Models 頁面的 v1/base/v2 控制會改變每個選擇器條目使用的 Codex 協作介面；模式、委派、繼承、
回退與加密任務行為的權威說明請見 [子代理介面](/zh-tw/guides/sub-agent-surface/)。

## 頂級 reasoning 檔位

目錄中顯示哪些 reasoning 檔位與 v1/base/v2 介面模式無關。生成的、支援 reasoning 的條目會提供
`max`，以便直接指定的子代理強度透過校驗；目前生成的路由條目和舊一代原生 GPT 條目還會提供
`ultra`。精確的上游 GPT-5.6 階梯會原樣保留，因此 Luna 只有 `max`，沒有 `ultra`。

在實際請求中，路由 adapter 會對映或限制不受支援的檔位。對於真實最高檔位為 `xhigh` 的舊原生
模型，`nativeEffortClamp` 會把直接指定的 `max` 或 `ultra` 選擇轉換為 `xhigh`，例如 GPT-5.5。
Sol、Terra 和 Luna 都有真實的 `max` 檔位。

## Fast tier 規則

Reasoning-tier visibility is independent of the v1/base/v2 surface mode. Generated reasoning-capable
entries advertise `max` so direct sub-agent effort overrides validate; current generated routed
entries and older native GPT entries also advertise `ultra`. Exact upstream GPT-5.6 ladders are
preserved, so Luna has `max` but no `ultra`.

On the wire, routed adapters map or clamp unsupported tiers. For older native models whose real
ladder stops at `xhigh`, `nativeEffortClamp` maps a direct `max` or an `ultra` selection to `xhigh`
(for example, GPT-5.5). Sol, Terra, and Luna have a real `max` rung.

Catalog advertisement of the two top tiers is unconditional: `ocx sync` no longer removes `max` or
`ultra` when the installed Codex binary is too old to offer them — Codex versions without those
rungs are out of support, and hiding them from current clients costs more than it buys. Other
rungs are still intersected with the observed runtime ladder, and a clamp diagnostic recorded by a
previous binary stops applying once the binary at that path reports a different version (the
in-place upgrade case), so `ocx status` and `ocx doctor` stop warning about a clamp the upgraded
runtime no longer needs.
Catalog visibility is not entitlement: advertising `max`/`ultra` does not guarantee the upstream
account or provider accepts the tier, and for older native models whose real ladder stops at
`xhigh` the wire clamp above still maps the selection down at request time.

## 子代理選擇

Codex stores fast mode as:

```toml
service_tier = "fast"

[features]
fast_mode = true
```

But the model catalog and runtime request tier id use `priority`. opencodex preserves that split.
Native OpenAI passthrough models keep fast support; routed providers are capability-gated —
`service_tier` is stripped only when the provider declares `supportsServiceTier: false` (the registry
classifies canonical OpenAI as `true`, DeepSeek and Volcengine Ark as `false`), while unclassified
custom gateways keep caller-supplied values untouched and never get an injection. A custom gateway
can opt in globally with `supportsServiceTier: true`, or narrowly with
`modelSupportsServiceTier: { "verified-model": true }`; an exact `false` narrows a provider
default of `true`, while provider-level `false` remains fail-closed. The same final adapter/model
decision controls both catalog metadata and runtime injection, so the fast option is never
advertised where it cannot be honored. An `openai-chat` destination can authorize every otherwise
eligible model with `chatServiceTier: true`, or authorize only exact models with
`modelSupportsServiceTier`; Responses routes do not need that extra Chat wire authorization.

### Selecting Flex in Codex

For a routed provider and model verified to accept `service_tier: "flex"`, explicitly
declare Flex support alongside the existing Fast wire. Merge these fields into the
**existing** `providers.nanogpt` entry (do not replace its URL or credentials):

```json
{
  "modelSupportsServiceTier": { "openai/gpt-6-luna": true },
  "fastWire": {
    "kind": "service-tier",
    "canonicalToWire": { "priority": "priority", "flex": "flex" },
    "foreignCallerTiers": "verbatim"
  }
}
```

With an eligible `openai-responses` route, the Luna row advertises Standard,
Fast and Flex in Codex's speed selector. For an `openai-chat` route, also set
`chatServiceTier: true` **only if** the upstream Chat Completions endpoint supports
caller-provided service tiers. The `fastWire` mapping is **provider-wide**:
other service-tier-eligible routed models in the same `providers.nanogpt`
entry can also advertise Flex when the catalog publishes them as ordinary routed
rows, even when they are not listed in `modelSupportsServiceTier`. That map is not
an allowlist excluding other eligible models. Combo-namespace and native-alias
rows are **not** published with Flex. Verify Flex support for **every** eligible
ordinary routed model;
if only Luna supports Flex, configure it in a separate provider entry with
no other Fast-eligible models. Do not infer Flex support from Fast alone.

Keep OpenCodex's global Fast mode on **Auto** (`fastMode` unset), as forcing
Fast or Default overrides the caller's Flex choice. After `ocx sync`, refresh the
Codex model list. Select **Flex** from the speed selector, or use
`/model <routed-id> --speed=flex` in Codex CLI. This is a **selectable tier**,
not a per-model forced default: switching models does not force Flex automatically.
The tier is forwarded as `service_tier: "flex"` and can still be declined by
the upstream; availability, cost and latency depend on the provider. Neither
the menu nor a request alone proves which tier was billed.

### Selecting Ultra Fast in Codex Desktop

For a provider that supports `service_tier: "ultrafast"`, declare that wire mapping once.
opencodex then publishes **Ultra Fast** in the routed model's native Codex speed menu;
there is no need to edit `opencodex-catalog.json` after every sync.
For example, merge these fields into an API provider configured for GPT-6.1 Sol:

```json
{
  "models": ["gpt-6.1-sol"],
  "modelSupportsServiceTier": { "gpt-6.1-sol": true },
  "fastWire": {
    "kind": "service-tier",
    "canonicalToWire": { "priority": "priority", "ultrafast": "ultrafast" },
    "foreignCallerTiers": "verbatim"
  }
}
```

The mapping applies to every Fast-eligible model on that provider. Use a separate provider
entry if only some of its models support Ultra Fast. Keep opencodex's Fast mode on **Auto**
(omit `fastMode`) so the app's speed selection reaches the provider; forced Fast sends
`priority`, and forced Default drops the tier. Refresh the model catalog, restart Codex
Desktop if it still has the old list, select the routed model, then choose **Ultra Fast**
in its speed menu. Standard remains the default.

Only an eligible `service-tier` wire with an explicit `ultrafast → ultrafast` mapping adds
this choice to routed rows; ordinary Fast support or a GPT-like name is insufficient.
That routed mapping does not apply to native/account rows or combo aliases. Removing the
mapping or disabling that model's service-tier support removes the generated routed choice
from both the catalog and cache on the next successful sync.
The active declaration also controls the Ultra Fast choice when Codex loads its model list over HTTP.

For routed rows, `ultraFastTier` retains independently supplied Ultra Fast tiers from the
same exact persisted row; generated routed tiers are not treated as operator-supplied.
For bare native `gpt-6-astra` / `gpt-6.1-sol` rows and their trusted account-bound clones,
enabling `ultraFastTier` also generates a missing Ultrafast choice without changing the
native default tier. Disabling it withdraws only native tier metadata tracked as generated;
independently supplied or edited native tier descriptors are preserved.

[OpenAI's API guide](https://developers.openai.com/api/docs/guides/ultrafast-mode) documents
Ultrafast for GPT-6 Astra and GPT-6.1 Sol. API access and
[Codex plan/workspace access](https://learn.chatgpt.com/docs/agent-configuration/speed)
are separate. A menu choice does not grant provider access or guarantee measured speed;
Ultra Fast increases usage/cost, and Codex's own feature requirements still apply.

## Desktop remote 伺服器

Codex Desktop 的 remote-server 模式會以用戶端自己的 `available_models` allowlist 過濾選擇器
（當遠端 `use_hidden_models` 設定開啟時生效）。路由目錄條目仍會被載入與提供 —— `model/list`
會回傳它們，內建 CLI 也會讀取 —— 但 Desktop 的 renderer 在渲染前會丟棄任何不在該僅原生
allowlist 上的項目。opencodex 無法介入該清單；上游錯誤追蹤於
[openai/codex#19694](https://github.com/openai/codex/issues/19694)。

在 Desktop 公開 allowlist 控制選項之前：

- 直接在遠端機器的 `~/.codex/config.toml` 設定模型，例如 `model = "input/grok-4.5"`。選擇器
  可能顯示 `Custom`，但請求仍會使用已設定的路由模型。
- 改用 Codex CLI 或 TUI 而不是 Desktop 選擇器；它們不會套用 allowlist，會正常列出路由模型。

## 重新整理模型狀態
## 原生配額回退限制

If the picker still shows stale entries, refresh the catalog and restart the target Codex surface:

```bash
ocx sync
```

opencodex rewrites `models_cache.json` with a deliberately stale cache wrapper whenever catalog
visibility, priority, or metadata changes, so the next Codex model refresh reads the new catalog.

After a catalog or model-cache write, OpenCodex invalidates its cached app-server observation so the next request checks process freshness again. A configuration sync also invalidates the observation when catalog contents are unchanged. This refresh does not restart Codex processes.
