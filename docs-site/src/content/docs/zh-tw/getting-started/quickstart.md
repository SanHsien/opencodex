---
title: 快速入門
description: 設定你的第一個 provider,用三條命令讓 OpenAI Codex 透過 opencodex 進行路由。
---

本指南將帶你從全新安裝,一路走到用一個非 OpenAI 模型執行 Codex。

## 1. 執行設定嚮導

```bash
ocx init
```

`ocx init` 會引導你完成:

1. **選擇 provider** —— 從內建 registry 的 79 個預設中選擇一個，或選擇 `custom` 手動輸入
   base URL 和 adapter。
2. **API key** —— 貼上一個 key,或引用一個環境變數,例如 `${ANTHROPIC_API_KEY}`。
3. **預設模型** —— 對於 API key、本機和 custom provider，可接受預設值或輸入模型 id。
4. **代理埠** —— 預設為 `10100`。
5. **注入到 Codex？** —— 在通常的迴環地址設定中，opencodex 會在
   `$CODEX_HOME/config.toml`（預設 `~/.codex/config.toml`）根級新增 `openai_base_url`，讓 Codex
   內建的 `openai` provider 指向代理。監聽遠端或 LAN 地址時，則改用帶 API 認證 header 的專用 provider 條目。
6. **安裝自動啟動 shim？** —— 啟用後，每次啟動 `codex` 都會先執行 `ocx ensure`。

結果會儲存到 `$OPENCODEX_HOME/config.json`（預設 `~/.opencodex/config.json`）。

`ocx init` 只在設定不存在時才建立它。既有的有效設定會被保留、安裝程式直接結束；要更新請用
`ocx config` 或儀表板。無效、無法讀取或是符號連結的設定項目會被保留並回報為錯誤。若精靈執行期間
有另一個程序建立了設定，以該檔案為準，安裝程式會在備份整理與整合提示之前停止。

建立之前按 EOF 或 Ctrl+C 會取消安裝；建立之後才取消則會保留已儲存的設定。初次發布需要設定所在
檔案系統支援硬連結並具備權限，失敗就停止，不會退回覆寫。若發布或暫存檔清理無法完成，重試之前
請先檢查設定目錄：那裡可能留著一份完整的設定或私有暫存檔。

如果安裝程式回報無法確保初始設定權限，表示該檔案系統或帳號無法套用所需的私有權限（Windows 上是
NTFS ACL）。這發生在寫入設定內容之前。硬連結發布錯誤則是另一種失敗：私有權限已套用，但完成檔的
發布失敗或結果不確定。

重試之前請先檢查選定的設定目錄。保留任何既有的 `config.json`，不要為了讓安裝程式繼續而刪除它。
全新安裝請選一個可寫、且同時支援硬連結與私有權限的位置。當你的帳號能套用 ACL 時，本機 NTFS 目錄
是 Windows 上合適的選擇。例如在執行安裝前，於同一個終端機選定新位置：

```powershell
# Windows PowerShell：在本機 NTFS 磁碟區上選一個全新的目錄。
$env:OPENCODEX_HOME = Join-Path $env:LOCALAPPDATA "opencodex-local"
ocx init
```

```sh
# macOS/Linux：選一個支援硬連結與 Unix 權限的檔案系統上的全新目錄。
export OPENCODEX_HOME="$HOME/.opencodex-local"
ocx init
```

後續指令與執行 proxy 的服務都要使用同一個 `OPENCODEX_HOME`。改動這個變數是選擇另一個設定位置，
並不會搬移既有安裝。安裝程式刻意不提供直接寫入或取代式重新命名的退路：先建立獨佔檔案再寫入，
可能會讓不完整的設定內容外露。

:::note[GPT-5.6 釋出條目]
目前的穩定版本會為 ChatGPT 直通、OpenAI API key、OpenRouter 以及實驗性 Cursor adapter
預置 GPT-5.6 Sol/Terra/Luna。只有該上游帳號具備權限時才能實際呼叫。OpenAI API key 與
OpenRouter 預設會宣告 922,000 token 的可用 context window；Cursor 則保留自身 adapter 的
後設資料。
:::

## 2. 啟動代理

```bash
ocx start            # 預設埠 10100
ocx start --port 8080
```

啟動時,opencodex 會:

- 將其 PID 寫入 `~/.opencodex/ocx.pid`(並拒絕重複啟動),
- 在 provider 支援時發現即時模型，並**把原生與已路由條目同步進 Codex 的模型目錄**，以及
- 在 `http://localhost:<port>/v1` 上監聽。

如果請求的埠已被佔用，`ocx start` 會選擇一個空閒埠，將其寫入 `runtime-port.json`，並更新
Codex 設定以使用實際監聽埠。

檢查它:

```bash
ocx status
ocx gui       # 在實際監聽埠開啟儀表板
```

## 3. 使用 Codex

Codex 現在會透明地與 opencodex 通訊:

```bash
codex "Refactor this function for readability"
```

若要指定某個已路由的模型,請使用 Codex 模型選擇器所顯示的 `provider/model` 形式:

```bash
codex -m "anthropic/claude-opus-5" "Explain this stack trace"
codex -m "ollama-cloud/glm-5.2"      "Write a SQL migration"
```

## 選擇 sub-agent 模型（可選）

新設定會讓 Codex 的 sub-agent 選擇器包含五個原生模型：`gpt-5.5`、`gpt-5.6-sol`、
`gpt-5.6-terra`、`gpt-5.6-luna` 和 `gpt-6-astra`。開啟 `ocx gui` 即可替換或重新排序最多五個
原生或已路由模型。儀表板也可以設定一個首選 sub-agent 模型及 reasoning effort。參見
[子代理介面](/zh-tw/guides/sub-agent-surface/) 選擇 v1/base/v2，並了解指引、原生預設與回退
何時生效。

## 登入而非貼上 key

部分 provider 支援真正的帳號登入(OAuth,自動重新整理):

```bash
ocx login xai          # 也可使用 anthropic、kimi、kiro、google-antigravity、cursor
ocx logout xai
```

OpenAI 本身**無需 key** —— 預設 provider 會直接轉發你現有的 `codex login` 憑證
（參見 [Providers](/zh-tw/guides/providers/)）。

## 停止與恢復

```bash
ocx stop          # 停止代理並恢復原生 Codex
ocx restore       # 不停止代理，僅恢復原生 Codex（別名：ocx eject）
ocx restore back  # 讓 Codex 再次使用仍在執行的代理
```

## 下一步

- [運作原理](/zh-tw/getting-started/how-it-works/) —— 每個請求都發生了什麼。
- [Provider](/zh-tw/guides/providers/) —— 各種認證方式。
- [設定](/zh-tw/reference/configuration/) —— 完整的 `config.json` 參考。
