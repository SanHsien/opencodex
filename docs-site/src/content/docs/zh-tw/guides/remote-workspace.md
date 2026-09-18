---
title: Remote Workspace
description: 讓 Codex、Claude Code、Pi 與它們的登入狀態都留在同一個 OCX Hub 上，而由只裝了 OCX 的電腦提供工作區與建置環境。
---

Remote Workspace 讓一個 OpenCodex Hub 執行你的編碼代理，同時由另一台電腦提供
專案檔案、指令、測試與建置運算。手機或第三台電腦可以透過 Hub 儀表板控制這個工
作階段。

```text
Phone browser -> Computer 1 OCX Hub -> encrypted channel -> Computer 2 OCX Executor
                 Codex / Claude / Pi                       project and commands
                 logins and sessions                      no coding CLI login
```

Executor 只需要 OpenCodex。它不需要 Codex、Claude Code、Pi、ChatGPT 登入，也
不需要供應商 API 金鑰。它會對 Hub 開啟一個對外的 WebSocket 連線，所以 Executor
不需要任何公開連接埠，也不需要路由器的連接埠轉發。

:::caution[實驗性基礎]
Remote Workspace 是選擇加入的功能，不是可正式上線的版本。Linux 提供檔案工具，
以及有條件的 bubblewrap 指令執行。Windows 與 macOS 只提供檔案工具：它們的官方
原生輔助程式會拒絕探測與指令請求。在有經過驗證的生命週期擁有者能透過取消動作
保留清理權限之前，Windows 指令仍不受支援。缺少指令支援絕不會退回到在 Hub 上執
行。
:::

## 設定 Hub

電腦 1 擁有每一個編碼代理的登入狀態與模型工作階段。先在那裡安裝並登入你想使用
的代理，再把 OpenCodex 以 Hub 身分執行：

```bash
ocx config set runtimeRole hub
OCX_REMOTE_WORKSPACE_ENABLED=1 ocx start
ocx gui
```

請在 Hub 程序本身上設定 `OCX_REMOTE_WORKSPACE_ENABLED=1`；只對某個儀表板指令
設定它，並不會啟用一個已經在執行中的服務。沒有明確選擇加入的 Hub，會回傳停用
狀態，不會建立工作區金鑰，也不會探測編碼代理的執行環境。

從手機或另一台電腦開啟儀表板時，請使用已驗證的 HTTPS 部署。支援的管理入口與
Tailscale 模式見 [Remote Hub 部署](/guides/remote-hub/)。請不要發布一個未經驗
證的本機儀表板連接埠。

Codex 版 Remote Workspace 使用目前的 App Server 權限設定檔。如果 Hub 選定的
Codex 設定仍在使用舊式的 `sandbox_mode` 或 `sandbox_workspace_write`，儀表板
會回報 Codex 無法使用，而不是以較弱的邊界啟動。使用這項功能前請先遷移該 Codex
設定檔；不要同時設定舊式沙盒與權限設定檔。

## 配對一個 Executor

1. 在 Hub 儀表板打開 **Remote Workspace**。
2. 選擇 **Create pairing code**。
3. 在電腦 2 上，切換到你想公開的專案目錄。
4. 複製該電腦對應的產生指令——**Linux / macOS terminal** 或
   **Windows PowerShell**。它會配對目前的目錄，並在該終端機中保持
   `ocx remote-workspace agent` 連線。

對應的手動流程是：

```bash
cd /path/to/project
printf '%s\n' 'ONE-TIME-CODE' | ocx remote-workspace pair 'https://your-hub.example' \
  --pairing-code-stdin --root "$PWD"
ocx remote-workspace agent
```

在 Windows PowerShell 上，請使用儀表板顯示的指令。對應的手動形式是：

```powershell
$pairingCode = 'ONE-TIME-CODE'
$pairingCode | ocx remote-workspace pair 'https://your-hub.example' `
  --pairing-code-stdin --root (Get-Location).Path
if ($LASTEXITCODE -eq 0) { ocx remote-workspace agent }
```

目前的 OCX Bun 執行檔會自動以一個唯讀檔案的形式加進 Linux 沙盒。如果專案需要
系統路徑之外、使用者自行安裝的工具鏈，請明確配對它，同時不暴露 home 目錄的其
他部分：

```bash
printf '%s\n' 'ONE-TIME-CODE' | ocx remote-workspace pair 'https://your-hub.example' \
  --pairing-code-stdin --root "$PWD" \
  --toolchain-root "$HOME/.nvm/versions/node/v24/bin"
```

原生輔助程式的原始碼已打包供審查。建置它並不會在這個版本中啟用 Windows 或
macOS 的指令支援。`--executor-helper` 仍然只是一個「已審查輔助程式」選擇器；
二進位檔存在或設定了路徑，都不能證明指令支援存在。

一次性代碼是從標準輸入讀取的，不是命令列參數。配對會建立一把本機裝置簽章金
鑰，以及一個裝置範圍的 bearer。Hub 只儲存它的雜湊值，絕不會收到真正的
Executor 路徑。用 Ctrl+C 停止前景的 agent；再次執行它會重新連上同一個裝置。

在不印出任何機密的前提下檢查本機的註冊狀態：

```bash
ocx remote-workspace status
```

## 啟動一個遠端編碼工作階段

在儀表板中選擇：

1. 該線上電腦；
2. 一個經本機核准的工作區資料夾；
3. Hub 上的 Codex、Claude Code 或 Pi；以及
4. 一種存取模式。

**唯讀**是預設值，會公開目錄列表與檔案讀取。寫入選項只有在該 Executor 通過指
令沙盒探測後，才會顯示為 **Edit files and run commands**；否則只會顯示為
**Edit files only**。儀表板會顯示兩個獨立的位置，清楚表明模型與登入狀態留在
Hub，而工作區操作則在選定的電腦上執行。

從電腦 1、電腦 3 或手機上的 Hub 儀表板送出提示詞。這個工作階段無法悄悄切換到
另一台電腦或另一個資料夾。若 Executor 斷線，工作階段會進入
**Executor offline** 狀態，絕不會退回到使用 Hub 的檔案系統。

提交提示詞會立即確認已受理；儀表板會輪詢這個工作階段以取得進度與完成狀態。若
確認訊息遺失，草稿仍會顯示，並附上一則「提交狀態未知」的提示。請先確認工作階
段進度，再考慮重新送出；儀表板絕不會自動重試一則提示詞。

在提示詞執行期間，**Stop** 一直可用。它會中斷 Hub 上的編碼代理輪次、取消一個
進行中的 Executor 指令，並防止一個延遲的回應重新開啟已停止的工作階段。

## 重新啟動與重新連線的行為

Hub 會持久化有邊界的工作階段中繼資料，以及一小份最近事件的快照。Hub 重新啟動
後，一個未完成的工作階段會等待它原本的 Executor。等該裝置重新連線後，下一則提
示詞會接續原本的 Codex thread、Claude Code 工作階段，或 Pi 工作階段 ID。

Claude Code 會在第一則完成的提示詞時建立它的持久歷史紀錄。若 Hub 在一個新的
Claude 工作階段完成任何提示詞之前就停止了，就沒有對話可以接續；請改為開啟一個
新的工作階段。

能力清單一旦改變，不會悄悄弱化既有的工作階段。若 Executor 失去指令圍堵能力，
或它可用的工具改變了，請開啟一個新的工作階段。撤銷一台電腦，會關閉它的
socket，並停止綁定在它上面的工作階段。

## 安全邊界

- 供應商憑證與編碼代理的歷史紀錄留在 Hub 上。
- Executor 的私鑰、裝置 bearer 與真正的根目錄路徑，留在它僅擁有者可讀的 OCX
  狀態裡。
- 配對碼失敗次數，會依每個監聽器上、由核心觀察到的對端各自限制。十分鐘內十
  次失敗的代碼，會回傳一個帶有 `Retry-After` 的通用 `429`；Hub 只保留這些來
  源身分的有邊界、會過期的雜湊值。Tailscale Serve 的使用者，與管理監聽器共用
  同一個迴路儲存桶，因為一個直連的本機呼叫端可以偽造它的身分標頭。
- 每個工作階段都使用一次 Ed25519 簽章的暫時性 P-256 ECDH 交握，以及有序的
  AES-256-GCM 訊息。
- 除非雙方都同意目前的能力清單，否則一個 socket 不會顯示為線上。
- 重新連線可能會在本機沙盒不可用時移除某項能力，但絕不會新增配對時所記錄授
  權之外的能力。
- 每個請求都綁定到一個模型 thread、一個裝置、一個根目錄、一種存取模式與一組
  能力集合。
- 路徑一律是相對路徑、經過正規化、有邊界，並且在遇到 symlink、junction 或跳
  出父目錄時會被拒絕。Windows 裝置名稱、替代資料流，以及結尾點／空白別名，
  一律會被拒絕。
- Executor 的操作是序列化執行的，已開啟的檔案身分會被重新檢查，寫入的雜湊值
  也會在原子替換前立即再次檢查。要替換一個已核准的根目錄，需要重新配對；工
  具鏈根目錄則會在每次指令前重新驗證。
- 檔案讀寫會拒絕硬連結檔案。在執行指令之前，OCX 最多會掃描 250,000 個工作區
  項目，只要有任何非目錄項目擁有多個連結，就停用指令路徑；路徑沙盒無法證明
  該 inode 的另一個名稱是否在已核准的根目錄之外。
- Linux 上的指令透過 bubblewrap 執行，具備一個可寫入的工作區、已清空的環境
  變數、私有的行程命名空間、作為唯一唯讀檔案的目前 OCX Bun 執行檔、有邊界的
  輸出與逾時，以及預設停用的網路。專屬的圍堵測試需要一個明確設定的託管環境；
  一份綠燈的一般測試套件並不能證明它們真的跑過。
- macOS 只公開檔案工具。一個行程群組在呼叫 `setsid()` 之後就無法再包含子孫行
  程，而僅為了啟動一個指令就匯入一份範圍廣泛的 Apple Seatbelt 系統設定檔，會
  暴露不相關的主機服務權限。因此原生輔助程式在 OCX 擁有一個範圍狹窄、可撤銷
  的子孫圍堵擁有者之前，會拒絕它自己的探測與直接指令請求。
- Windows 與 macOS 的原生指令請求一律失敗封閉。它們「直連輔助程式拒絕」的測
  試，必須與真正運作中的指令圍堵證據區分開來；Windows 的指令接受狀態目前是
  開放（尚待處理）的。
- 那個固定版本的原生輔助程式，必須位在每一個已核准可寫工作區之外。OCX 會在
  宣告支援指令之前、以及每次指令執行之前立即檢查這一點，這樣工作區裡的程式
  碼就無法替換掉那個負責強制執行下一個沙盒的二進位檔。
- 停止一個工作階段會取消一個進行中的 Executor 指令，並清理 Hub 上的模型行程
  與迴路工具橋接器。Windows 會停止它擁有的 npm-wrapper 行程樹，而不是留下它
  的 Node 子行程；Linux 與 macOS 只有在某個 CLI 無視優雅停止的等待視窗時，才
  會強制停止它。

Hub 之所以刻意看得到提示詞與模型輸出，是因為它就是執行編碼代理的地方。端對端
加密保護的是 Executor 的 RPC 酬載。這個已配對的 Hub 被信任能透過已驗證的 WSS
選擇核准的根目錄；它並不是對自己的模型對話一無所知。

## 目前的範圍

Remote Workspace 不會把憑證複製或同步到其他電腦。它與 Remote Hub 的供應商路
由，以及任何未來的託管運算或 Super Sync 產品，都是分開的。要正式上線，仍需要
簽章過的 Windows 輔助程式封裝、針對確切二進位檔的原生 CI 證明、獨立維護者審
查，以及一次真正的三電腦驗收執行。

## 提示詞受理 API

`POST /api/remote-workspace/sessions/:id/prompt` 回傳 HTTP 202，附上已受理
的工作階段快照。它的工作階段 ID 與單調遞增的事件序號，標識的是這個受理快照；
202 並不代表模型輪次已經完成。請輪詢
`GET /api/remote-workspace/sessions` 取得後續事件與最終狀態。在該輪次進行
期間，重新連線與執行期接續都會維持忙碌狀態。一次遺失的確認訊息，會讓受理狀
態變成未知，所以用戶端必須先輪詢，才能決定要不要重新送出。
