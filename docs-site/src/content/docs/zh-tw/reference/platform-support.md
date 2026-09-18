---
title: 平台支援
description: OpenCodex 在 macOS、Windows 與 Linux 上能做什麼，以及少數功能為何維持平台專屬。
---

OpenCodex 可在 macOS、Windows 與 Linux 上執行。大部分功能在三個平台上行為一致；
少數功能仰賴作業系統提供的機制，本頁說明是哪些功能，以及原因。

## 隨處可用

| 功能 | 說明 |
| --- | --- |
| Proxy、路由、供應商轉接器 | 核心執行環境與平台無關。 |
| 背景服務 | 三種原生後端：macOS 上是 launchd，Windows 上是 Task Scheduler **或** WinSW，Linux 上是 systemd 使用者單元。 |
| 瀏覽器登入 | 透過平台自己的處理器開啟。 |
| 用戶端偵測 | Cursor、Claude Desktop、Kiro 與 Codex 的安裝位置依平台各自定位。 |

### 作業系統憑證儲存中的供應商金鑰

三個平台都支援，**前提是有已解鎖的作業系統憑證服務**：macOS 上是
Keychain，Windows 上是 Credential Manager，Linux 上是 libsecret。已鎖定的鑰匙圈
或無頭工作階段沒有已解鎖的服務，此時儲存區就不可用，OpenCodex 會明講這一點，
而不是悄悄退回其他方式。儲存規則見[供應商](/reference/configuration/providers/)。

## 僅限 macOS

### Claude Code 自動連線

把 `ANTHROPIC_BASE_URL` 與 Claude Code 的各項開關注入你的工作階段，靠的是
launchd 使用者網域，其他平台沒有單一對應機制。

在 Linux 上，三種看似可行的機制各自只涵蓋不同的一組程序：
`systemctl --user set-environment` 只涵蓋由 systemd 產生的單元，`~/.profile`
只涵蓋登入 shell，`~/.bashrc` 只涵蓋互動式的非登入 shell。沒有單一位置能涵蓋
使用者的整個工作階段。

在 Windows 上，對應的機制是 `HKCU\Environment`，它是真正持久性的，而不是每次
開機才有。這正是問題所在：這會把一個 bearer token，從一個重開機就會清空的網
域，搬進一個不會清空的登錄檔 hive，等於改變了該憑證留在磁碟上的時間長度，以及
誰讀得到它。這個決定需要的是安全審查，而不是單純移植程式碼。

Claude Code 需要的其他一切在所有平台上都能運作。你可以自己設定相同的變數，或
執行 `ocx claude`，它會直接把這些變數傳給子程序。

## 匯入或貼上

### Meta Muse Code

在 macOS 上，OpenCodex 會匯入 Muse Code CLI 在 `muse login` 之後已經儲存的
API 金鑰，所以不會要求你另外設定第二把金鑰。

在其他平台上，則會要求你貼上金鑰。Meta 沒有發布原生的 Windows CLI；在 Linux
上該 CLI 確實存在，但它把憑證存在哪裡尚未經過驗證，所以 OpenCodex 不願意去猜
測某個憑證儲存區。同一把金鑰可以在[Meta 的開發者主控台](https://dev.meta.ai)
看到，而貼上的金鑰會經過與匯入金鑰相同的格式檢查，以及對 Model API 的同一套即
時驗證。

## Windows 備註

Windows 服務可以在 Task Scheduler 底下執行，或以原生 WinSW 服務執行，兩者互
斥。當 `ocx service repair` 同時發現兩者的狀態時會拒絕繼續執行，因為用猜的去
判斷你想要哪一種，正是一台機器最後出現兩個 proxy 搶同一個連接埠的原因。

在非英文的 Windows 安裝上，主控台輸出使用的是系統字碼頁，而不是 UTF-8。
OpenCodex 會據此解碼，所以含有非 ASCII 字元的帳號名稱能正確解析。

## 當某項功能不可用時

OpenCodex 會說明實際原因，而不是悄悄停用某個控制項。若某項功能在你的平台上不
可用，錯誤訊息或儀表板會說明缺少哪個機制、以及支援的替代方案是什麼。若你遇到
沒有這樣說明的情況，那就值得回報成一個 bug。
