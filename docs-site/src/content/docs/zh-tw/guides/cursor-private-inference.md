---
title: Cursor Private Inference
description: 在 macOS、Windows 或 Linux 上，於 Cursor 的本機代理版本中使用 opencodex 路由的模型，不需要公開通道。
---

一般版 Cursor 無法連到你自己機器上的 proxy。當你設定「Override OpenAI
Base URL」時，Cursor 的後端會建構提示詞，並從 Cursor 自己的伺服器呼叫那個
URL，而那些伺服器會拒絕迴路、LAN 與私有位址。這正是為何每一份「Cursor 搭配本
機模型」的社群食譜，最後都得靠 ngrok、Cloudflare Tunnel 或一台 VPS。

Cursor 還發布了第二個桌面版本，**Cursor Private Inference**，其代理迴圈在本
機執行，並呼叫你設定的、與 OpenAI 相容的 gateway。把它指向 opencodex，就能使
用你路由過的模型，不需要通道、不需要修改 app、也不需要 TLS。本頁涵蓋的正是這
個版本。

## 動手前

請先讀完這一節；這是大家最容易漏掉的部分。

- **opencodex 不發布這個版本。** Cursor 也沒有替它寫文件。cursor.com 上沒有
  連結指向它，它可能未經通知就改變，也可能停止提供。如果你原本就沒有它，本
  指南不適用於你；請改用社群的
  [`ocx-cursor`](https://www.npmjs.com/package/ocx-cursor) 橋接器，搭配一個
  公開的 HTTPS 端點。
- **仍然需要 Cursor 登入。** 登入關卡出現在 gateway 對話框之前。
- **Cursor 自己的模型無法使用。** 在本機模式下，選單只會列出你的 gateway 回
  傳的內容。Tab 補全、Cursor 自己的目錄（Composer、Auto）與 Cloud Agents 都
  是關閉的。若你已設定 Cursor 供應商，仍可透過 opencodex 自己的 `cursor/*`
  路由連到 Cursor 供應商的模型。
- **每一輪都帶著 Cursor 的本機系統提示詞**，在第二輪及之後大約是 23k
  token。挑模型時請把這個算進預算。
- **它與一般版 Cursor 共用身分。** 相同的 bundle id、相同的 `~/.cursor`、相
  同的 `Application Support/Cursor`（macOS）、`%APPDATA%\Cursor`
  （Windows）或 `~/.config/Cursor`（Linux）。用 `--user-data-dir <目錄>` 啟
  動它，可以把兩者分開；除非你想要複製你的設定，否則第一次執行時請不要勾選
  「Import data from existing Cursor installation」。

## 判斷安裝的是哪個版本

兩個版本在 Dock 裡都叫「Cursor」，也共用同一個 bundle id，所以請檢查
`product.json`：

| 平台 | product.json |
|---|---|
| macOS | `/Applications/Cursor Private Inference.app/Contents/Resources/app/product.json` |
| Windows | `%LOCALAPPDATA%\\Programs\\cursor-private-inference\\resources\\app\\product.json` |
| Linux | `<安裝根目錄>/resources/app/product.json`（AppImage 必須先解壓縮） |

本機代理版本的 `nameLong` 是 `"Cursor Private Inference"`，一般版則是
`"Cursor"`；`version` 是版本號（撰寫本文時為 3.18.25）。儀表板的
Integrations > Cursor 卡片會執行同一項檢查，並列出它找到的內容。本機模式是在
workbench 套件內部開關的，不在 `product.json` 裡，所以沒有任何開關可以切換：
如果 `nameLong` 顯示的是一般版 Cursor，那個安裝就連不到迴路 gateway。

與 gateway 對話的代理迴圈，位在同一個安裝根目錄下的一個檔案裡：
`extensions/cursor-agent-exec/dist/main.js`。opencodex 會讀取它（唯讀、有邊
界）來得知 Cursor 的效度表；見「模型與效度」。

## 設定 gateway

opencodex 需要處於執行中（`ocx service status`）。接下來以下任一做法都可
行；兩者最後會殊途同歸。

**在 app 內。** Settings → Models → Gateway → Configure gateway：

| 欄位 | 值 |
|---|---|
| Base URL | `http://127.0.0.1:10100/v1`（要包含 `/v1`；純 `http://` 迴路是可接受的） |
| API Key | 若你的服務使用 API 驗證，填 `OPENCODEX_API_AUTH_TOKEN` 的值；否則填任意佔位值，例如 `opencodex-loopback` |

點選 **Refresh model list**。選單就會填入 opencodex 的 `/v1/models`；打開你
想要的那幾列。

**用環境變數。** app 啟動時會讀取這些變數：

```text
CURSOR_LOCAL_AGENT_BASE_URL=http://127.0.0.1:10100/v1
CURSOR_LOCAL_AGENT_API_KEY=opencodex-loopback
CURSOR_LOCAL_AGENT_HEADERS=            # 選填，以換行分隔的「Header-Name: value」列
```

`CURSOR_LOCAL_AGENT_HEADERS` 會拒絕 `User-Agent`，以及未解析的 `{...}` 佔位
符；`{gitOrgRepo}` 與 `{gitBranch}` 會被展開。

優先順序，由高到低：per-model 憑證 → 儲存在 Settings 裡的 gateway →
`CURSOR_LOCAL_AGENT_*` → `ANTHROPIC_BASE_URL` / `ANTHROPIC_AUTH_TOKEN`（相容
退路）。環境變數不會覆寫已儲存的 gateway；若你打算改用環境變數切換，請先在
Settings 裡清掉它。

Cursor Private Inference 是一個 GUI app，所以光靠互動式 shell 的設定檔並不
夠；這個變數必須存在於啟動這個 app 的那個環境裡。

| 作業系統 | 放在哪裡 |
|---|---|
| macOS | 對目前登入的工作階段執行 `launchctl setenv CURSOR_LOCAL_AGENT_BASE_URL http://127.0.0.1:10100/v1`；或用帶有 `EnvironmentVariables` 的 LaunchAgent 讓它持久化。從終端機啟動這個 app 也可行。 |
| Windows | `setx CURSOR_LOCAL_AGENT_BASE_URL http://127.0.0.1:10100/v1`（使用者範圍；影響新啟動的程序），或走 System Properties → Environment Variables。之後要重新啟動 app。 |
| Linux | 對顯示管理員工作階段，用 `~/.profile` 或 `~/.pam_environment`；若桌面環境跑在使用者的 systemd 工作階段底下，用 `systemctl --user set-environment CURSOR_LOCAL_AGENT_BASE_URL=http://127.0.0.1:10100/v1`。從終端機啟動的 AppImage 會繼承該 shell 的環境。 |

這個版本存在 macOS（arm64、x64、universal）、Windows（x64、arm64）與
Linux（x64、arm64）。各平台的設定方式相同。

## 從儀表板

opencodex 儀表板在 Integrations 底下有一個 **Cursor** 分頁
（`/#integrations/cursor`）。它對 Cursor 是唯讀的：絕不會寫入 Cursor 的設定
資料庫、鑰匙圈項目或 app 套件，所以沒有任何開關可以切換。它做的是把值交給
你，並顯示這些值是否已經生效。

- **已安裝的版本。** Cursor Private Inference（含路徑與版本）與一般版
  Cursor（僅路徑）是否存在。若只找到一般版 Cursor，這個分頁會說明，並連回本
  頁：一般版 Cursor 會把自訂端點透過 Cursor 的伺服器路由，所以沒有公開通道就
  連不到迴路 proxy。
- **Gateway 的值。** proxy 自己監聽連接埠上的 Base URL（來自它的執行期紀
  錄，所以即使儀表板走反向代理，顯示的仍是這台機器上的 Cursor 連得到的那個連
  接埠），附上一個 Copy 按鈕。API Key 那一列取決於繫結方式：當它不需要憑證
  時，該列是 `opencodex-loopback` 並附 Copy；當 API 驗證是開啟的，或設定了
  任何 opencodex API 金鑰時，該列會告訴你使用自己的一把金鑰，並連到 API
  Keys 分頁。任何已設定的金鑰都可以用，不只是 `OPENCODEX_API_AUTH_TOKEN`。
- **連線狀態。** 最近一次 User-Agent 恰好是 `Cursor/<version>`（Cursor 本機
  代理執行環境送出的標頭）的 `/v1/models` 請求，附上時間與版本號。在 Cursor
  呼叫 proxy 之前它會顯示「never seen」；在 Cursor 裡按下 **Refresh model
  list** 就會讓它翻轉。這張卡片在分頁開啟時每 15 秒刷新一次。
- **Cursor 會顯示什麼。** 一張列出 opencodex 宣告之模型的 Model／Reasoning／
  Context 表格（停用的模型與供應商允許清單同樣適用，與原始清單相同），依循
  下一節的規則。這是一個預測：Cursor 是從自己的表格挑選 Reasoning 階梯。

## 模型與效度

選單就是 opencodex 原始的 `/v1/models` 清單。有兩件事決定一列模型是否會出現
**Reasoning** 控制項：

1. opencodex 必須在該列宣告能力（`api_types` 加上一個 `capabilities` 物
   件）。從 v2.41 起確實如此。較舊的 proxy 會顯示模型，但沒有效度控制項。
2. 模型 id 在去掉最後一個 `/` 之前的所有內容與任何 `@…` 後綴之後，必須符合
   Cursor 自己的效度表。那張表編譯在 app 裡
   （`extensions/cursor-agent-exec/dist/main.js`）；opencodex 從偵測到的安
   裝讀取它，所以儀表板的預測會跟著 Cursor 更新走，而卡片會說明它讀到的是
   哪個版本，或在沒找到時顯示「static mirror」。決定階梯的是 Cursor，不是
   opencodex，也沒有任何 `/v1/models` 欄位能把一個模型加進那張表。下表是
   static mirror 攜帶的 3.18.25 快照：

| 模型 id（最後一個 `/` 之後） | Cursor 顯示的階梯 | 傳輸欄位 |
|---|---|---|
| `gpt-5.6-sol`、`gpt-5.6-terra`、`gpt-5.6-luna` | Low、Medium、High、Extra High | `reasoning.effort` |
| `gpt-5`、`gpt-5.x` | Low、Medium、High、Extra High | `reasoning.effort` |
| `claude-opus-5`、`claude-sonnet-5`、`claude-opus-4.7`、`claude-opus-4.8` | Low、Medium、High、Extra High、Max | `output_config.effort` |
| `claude-opus-4.6`、`claude-opus-4.5`、`claude-sonnet-4.6` | Low、Medium、High、Max | `output_config.effort` |
| `grok-4.3`、`grok-4.5`、`grok-4.6`、`grok-build-latest` | Minimal、Low、Medium、High、Extra High | `reasoning_effort` |
| `gemini-*`（需要 `supports_reasoning`） | Minimal、Low、Medium、High | `reasoning_effort` |
| 其他任何情況，包括 `claude-fable-5-1`、`kimi-k3` | 沒有控制項 | — |

所以 `anthropic/claude-opus-5` 可以運作，而 opencodex 為 GPT-5.6 提供的
`max`／`ultra` 層級，在這個選單裡是連不到的。

### 沒有控制項的模型

`anthropic/claude-fable-5-1`、`cursor/kimi-k3`，以及表格之外的任何其他模
型，都不會出現 Reasoning 控制項；當 gateway 宣告 `supports_reasoning` 時，
Cursor 會為每一個這樣的 id 記一行日誌：「Local provider advertises
reasoning support for a model with no hardcoded Bottlerocket effort
family」。仍有兩種方式可以選擇效度：

- **效度列**（opencodex 設定裡的 `cursorEffortRows: true`，預設關閉）：
  gateway 會替沒有表格的模型，為每個效度各發布一筆選單項目，例如
  `anthropic/claude-fable-5-1--high` 或 `cursor/kimi-k3--max`，並把每一筆都
  路由到套用該效度的基礎模型。Cursor 已經自己算繪的模型不會多出這些列，而一
  個確切、已知的模型 id 永遠贏過 `--<效度>` 後綴。打開這個選項之後請按
  Refresh model list。儀表板卡片會統計它為每個模型發布了多少列。選擇某一列
  是明確的選擇，所以它的效度也會贏過請求中的 `ocx-effort` 指示。
- **固定預設值**（供應商上的 `modelDefaultReasoningEfforts`）：當 Cursor 沒
  有送出任何效度時套用。

### 「Max」是兩種不同的東西

一般版 Cursor 在部分模型旁顯示一個 **Max** 切換開關。那是 Max Mode，一個更大
的情境視窗，不是效度階層。在本機代理版本裡，同樣的概念以模型選單中的
**Context** 項目出現，opencodex 為原生的 GPT-5.6 家族點亮它：**272K**（預
設）或 **922K**（選擇加入的 1M，標記為成本較高）。你選的值會限制那一輪的情
境上限。路由過的模型只顯示單一視窗，沒有 Context 項目；供應商的情境上限低於
922K 時，原生那幾列的項目也會被移除。

效度階層裡的 **Max**（opencodex 的 `max`／`ultra`）是另一個意思，而那個是連
不到的：Cursor 是從自己的表格取效度階梯，而不是從 gateway 取，而 GPT-5.6 那
一列停在 Extra High。

因為 opencodex 在 `api_types` 裡宣告了 `responses`，這個版本會把代理輪次送
到 `/v1/responses` 並帶上 `reasoning.effort`，而不是送到
`/v1/chat/completions`。

這個傳輸選擇對 Claude 那幾列有個副作用：Cursor 只在 Anthropic Messages 傳輸
上把 Claude 效度當成 `output_config.effort` 送出，所以用 `/v1` 的 Base URL
時，即使某一列 Claude 確實顯示了控制項，它實際上仍以供應商預設值執行。若
Base URL 改成以 `/messages` 結尾，情況會反過來：Claude 效度會被送出，而
OpenAI 家族的效度會被丟掉。單一個 gateway 項目無法同時服務兩個家族；上述的
效度列可以繞開這個問題，因為效度是 opencodex 自己套用的。

## 驗證

`ocx observe logs` 會把這些輪次顯示為 `inboundProtocol: responses`，帶著
`admissionKind: loopback`。

| 症狀 | 檢查 |
|---|---|
| gateway 回傳 401 | API Key 與 `OPENCODEX_API_AUTH_TOKEN` 不符；對沒有 API 驗證的迴路繫結，任何值都可以 |
| 選單是空的 | opencodex 沒有在執行，或 Base URL 缺少 `/v1`；修好之後按 Refresh model list |
| 列出了模型但沒有 Reasoning 控制項 | opencodex 版本舊於 v2.41，或該 id 不在 Cursor 的表格裡（儀表板會標示為 —）；打開 `cursorEffortRows`，或設定一個供應商預設值 |
| 結構描述變更沒有被讀到 | Cursor 會依 Base URL 字串快取 `/models`，沒有過期時間；Refresh model list 會重新讀取，否則就重新啟動 app，或暫時改存一個不同寫法的 URL（`localhost` 對比 `127.0.0.1`） |
| 第一輪就是 23k token | 預期行為；那是 Cursor 的本機系統提示詞 |
