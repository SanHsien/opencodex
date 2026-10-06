---
title: Composer 用量閘門備援
description: 在不改變 OpenCodex 路由或桌面驗證、且保留伺服器端額度的情況下，依需求把文字排進既有的 Codex 對話串。
---

桌面版**僅限 composer** 的用量閘門，即使對話串所設定的 OpenCodex 路由仍有可用容量，也可能阻止新的輸入。在相容的安裝上，
`codex queue` 會透過 Codex 原生 app-server 的佇列送出，而不使用那個輸入框。它不會修補 app、攔截 TLS、安裝憑證，或變更驗證。

這**不是每一種用量限制狀態的修正**。它既不會恢復已用盡的額度，也不會解鎖模型選擇器。已經使用 `gpt-reserve` 的對話串會保留
那個模型；排入文字不會把它切換到其他供應商。伺服器端授權、供應商額度、核准，以及對話串的執行設定仍然適用。

## 找出被阻擋的層

送出前就被停用的 composer，與送出後供應商的實際拒絕是不同的事。自訂的模型標籤不能證明有獨立的供應商或可用容量。只對刻意選定、
且路由其餘部分可用的對話串使用這個備援；待處理的核准、進行中的回合與 app-server 連線，請另外檢查。

主帳號的硬鎖定仍然具有權威性。它是用盡之前的准入防護，不是恢復已用盡帳號的方法。這個 helper 既不會停用該防護，也不會改變對話串
使用哪個供應商。不要為了讓排入的原生帳號請求得以執行，而去改動額度回應或關閉該防護。

## OpenCodex 整合與擁有權

請保留既有的 [Codex 整合](/zh-tw/guides/codex-integration)與[模型路由](/zh-tw/guides/model-routing)設定。路徑是：

```text
helper -> native Codex queue -> the selected thread's app-server
       -> the thread's configured provider -> OpenCodex, when already routed there
```

這些 helper 不實作另一個供應商路由器。它們只送出目標與文字，不送出模型、帳號、service tier、核准、sandbox 或 base URL 的覆寫。
路由到 OpenCodex 的內建 `openai` 供應商，以及自訂的 `opencodex` 供應商，都保持原本的設定。Pool／Direct 選擇、帳號綁定、供應商
憑證與准入檢查，仍由 OpenCodex 與提供服務的 daemon 掌管。單憑佇列接受，並不能證明供應商被呼叫過。

請使用與桌面安裝**相同的 `CODEX_HOME` 與相容的 CLI／app-server**。`CODEX_HOME` 預設為 `~/.codex`；另一個 home 可能找到另一個
daemon 與對話串儲存區。`OPENCODEX_HOME` 是 proxy 的 home，不能取代 `CODEX_HOME`。這些 helper 不會改動這兩個變數，也不會改動兩個
應用程式的設定檔。在 PowerShell 上，原生子程序會繼承 shell 的檔案系統位置，即使 `CODEX_HOME` 是相對路徑也一樣。

Proxy 必須已經在執行，且目標對話串必須已經使用預期的路由。這個 helper 不會啟動／同步／重新設定 OpenCodex、不會重新啟用已停用的整合，
也不會悄悄取代直連的 OpenAI 路由。它不需要切換 `codexDesktopAuthless`。遠端的 OpenCodex 供應商 URL，與遠端的 Codex app-server 不是
同一回事：這些 helper 使用本機 daemon 探索，而不是自動路由到另一台電腦上的對話。

這些是**依需求使用的 repository helper**，不是已安裝的 `ocx queue` 指令，也不是儀表板控制項。npm 套件的檔案白名單不包含
`scripts/`；請使用相符的 repository checkout，或原生的 `codex queue` 指令。這個窄範圍的備援，避免為 OpenCodex 新增第二套傳輸、
常駐 listener、帳號狀態快取或用量限制監看程式。

## 開關與一般使用時的行為

**沒有持久性的啟用／停用開關**：執行 helper 就是單次送出的選擇啟用。單純安裝／更新 OpenCodex，或把腳本留在磁碟上，不會執行它們。

| 情況 | 這個備援會做什麼 |
| --- | --- |
| 沒有被呼叫，不論額度可用或已用盡 | 什麼都不做：沒有程序、計時器、輪詢、背景 listener，或 helper 發出的請求。 |
| 在用量可用時正常呼叫 | 排入一則普通訊息。不會因為桌面 composer 還能用就略過它。送出時可能適用一般的供應商用量／計費。 |
| 只有 composer 被阻擋時呼叫 | 嘗試相同的原生佇列送出。所設定的路由仍必須被授權且可用。 |
| 實際的供應商沒有容量或授權 | 不會繞過該限制，也不會更換供應商／帳號；佇列接受之後，上游執行仍可能失敗。 |
| `-DryRun` / `--dry-run` | 選定目標並探測 CLI 說明，但絕不送出文字，也不檢查帳號額度、daemon 健康或供應商可用性。 |
| 用量閘門之後解除 | 直接再用一般的 composer。沒有 helper 專屬的設定需要還原。 |

要停止使用這個備援，只要停止呼叫它。**不要**為了關掉這個 helper 而執行 `ocx restore` 或停用 Codex 整合；那也會改變一般的
OpenCodex 路由。如果你另外排程了這個指令，請停用那個外部排程。已經被接受的佇列項目屬於 Codex，仍可能執行：移除腳本、結束它的
程序，或恢復額度都不會取消它們。請在同一個對話中，透過一般的佇列控制項檢查／移除不想要的項目。不要在 helper 與 composer 兩邊
送出同一個提示。

## 送出前檢查相容性

請優先使用 app 內附的 CLI；PATH 上另外安裝的 `codex` 可能比較舊。請用 `codex queue --help` 檢查 `--thread` 與 `--message`。
這些 helper 會探測這項 CLI 能力，但只有實際的請求才能驗證 daemon 是否支援 `thread/queue/add`。如果 Codex 回報不支援佇列方法，
請先儲存進行中的工作，再更新／重新啟動相符的安裝。這些 helper 絕不會重新啟動 daemon，或改用另一個伺服器重試。不要對 queue 指令加上
`--no-daemon`。App／CLI 的更新仍可能改變相容性。

請先開啟預期的對話，確認它的專案、模型與供應商。建議使用它的**明確 UUID**；原生 CLI 也接受完全相符的 session 名稱：

```powershell
codex queue --thread 'my-project-review' --message 'continue with the next step'
```

在 repository checkout 中，Windows helper 可以找出內附的原生 `codex.exe`：

```powershell
.\scripts\codex-queue.ps1 -Thread 'my-project-review' -Message 'continue with the next step'
```

在 macOS／Linux 上請使用 Bash（包含 macOS 的 Bash 3.2）：

```bash
bash scripts/codex-queue.sh --thread 'my-project-review' --message 'continue with the next step'
```

可以用 `-CodexExe 'C:\path\to\codex.exe'`、`--codex '/path/to/codex'` 或 `CODEX_EXE` 釘選相符且受信任的執行檔。無效的明確選擇會失敗，
而不是悄悄挑選另一個執行檔。在 Windows 上請使用原生 `.exe`，而不是 npm 的 `.cmd` 或 PowerShell shim，以免訊息的引號處理落到
`cmd.exe`。支援佇列的 app bundle 與獨立安裝配置會先於 PATH 嘗試。自動的 PATH 探索會忽略空的與相對的項目，而不是隱含地探測目前專案
中的 CLI。仍可用 `--codex './codex'` 或 `-CodexExe '.\codex.exe'` 明確選擇受信任的本機執行檔。已設定的安裝根目錄與 PATH 中的絕對路徑
項目，仍需由操作者信任；這個 helper 不驗證執行檔簽章。探索並不能證明 app 版本相符。

### 私密診斷與選用的最新對話串探索

乾跑預設會隱藏執行檔路徑、對話串 UUID／名稱與訊息本文：

```powershell
.\scripts\codex-queue.ps1 -Thread 'my-project-review' -DryRun
```

它只回報 CLI 能力與目標選擇，不代表伺服器端驗證成功。對於舊式、以 rollout 為基礎的儲存區，`-Latest` / `--latest` 會明確選擇使用
**最新檔案的啟發式**。要查看該選擇，請使用未重新導向的私人終端機：

```powershell
.\scripts\codex-queue.ps1 -Latest -DryRun -ShowTarget
```

```bash
bash scripts/codex-queue.sh --latest --dry-run --show-target
```

`-ShowTarget` / `--show-target` 需要乾跑與本機終端機輸出。它只在這個明確要求下才揭露所選的路徑與 UUID／名稱，會跳脫控制字元，並拒絕
CI 擷取這類被重新導向的輸出。不要在被錄製／共用的終端機中使用它，也不要公開貼出輸出。它絕不會印出訊息。真正送出時原生 Codex 的
一般輸出會被原樣傳遞，可能包含識別碼；分享記錄前請先檢查。

最新對話串探索會依修改時間搜尋 `CODEX_HOME/sessions`，以檔名順序作為平手時的判準。它**不是目前的桌面對話**，可能選到另一個專案或
子代理。請確認本機預覽，再用所選的明確 UUID 送出。提供訊息時 Latest 也可以送出，但仍是刻意選擇使用這個啟發式。

可辨識的 `rollout-*.jsonl` 檔名含有一個對話串 UUID，有時後面接著 `_<rollout-uuid>`；helper 使用第一個 UUID。格式錯誤的名稱會被略過。
不存在或無法讀取的儲存區會失敗，而不會從另一個 home 選取。已遷移／僅分頁的儲存區與僅遠端的對話，可能沒有相符的本機 rollout；請使用
明確的 UUID／名稱。

請讓整則訊息保持在同一個引數中。Bash 接受 `--message '- start with this'` 或 `-- '- start with this'`；PowerShell 接受
`-Message '- start with this'`。Shell 歷史與本機程序列表可能暴露命令列文字，所以提示中不要包含憑證。

## 已排入佇列不等於已執行

`Queued message ... for thread ...` 確認的是**佇列接受**，而不是模型執行或完成。忙碌的對話串可能要等它目前的回合或核准。在檢視過的
上游實作中，未載入的已儲存對話串可以保留訊息，直到另一個用戶端恢復它。

請在**同一個對話**中檢查佇列與活動。如果它沒有被載入，請在 app 中開啟它，或使用 `codex resume <thread-id>`，不要再次加上提示。
請檢查待處理的核准與佇列狀態。每次 queue 呼叫都可能建立另一個項目；發生含糊的失敗後，請先檢查再重試。這些 helper 會保留 CLI 的結束狀態，
且絕不自動重送。

原生 CLI 有明確的 `--remote` 選項（見 `codex queue --help`），與假設會重用桌面的遠端控制連線是不同的。保持驗證設定不變，並不會修復
不相關的驗證／網路故障，也不保證遠端控制的連續性。

## 不經 composer 啟動或恢復工作

`codex exec '<prompt>'` 啟動的是非互動任務，**不是**開啟中桌面對話串裡的一則訊息。請檢查它的工作目錄、供應商、權限與設定。
`codex resume <thread-id>` 恢復明確指定的 session。`codex resume --last` 通常依目前工作目錄過濾；`--all` 停用該過濾，但其他資格過濾仍可能
適用。全域的選擇不一定是可見的或檔案系統上最新的 session。進行中的桌面工作請優先使用明確的 ID。

## 範圍與驗證

這個備援不碰帳號權益與 app 檔案。它不是對 composer／模型選擇器的供應商感知修復、不是自動恢復額度的功能，也不是清理先前實驗留下的、
不相關的 proxy／憑證變更。

最初的 Windows 探測（桌面版 `26.917.9434.0`）回報了對一個存活對話串的佇列接受，以及對不存在的對話串的預期錯誤。這不是一般性的端到端
推論、未載入對話串、遠端控制或跨平台的保證。上游原始碼檢查於 `7dae8c53d97e61cd774e4d6bcca5243c29ca615c`：

- [CLI queue 選項](https://github.com/openai/codex/blob/7dae8c53d97e61cd774e4d6bcca5243c29ca615c/codex-rs/cli/src/queue_cmd.rs)
  與 [app-server 送出](https://github.com/openai/codex/blob/7dae8c53d97e61cd774e4d6bcca5243c29ca615c/codex-rs/tui/src/session_queue_commands.rs)。
- [已載入對話串的佇列分派](https://github.com/openai/codex/blob/7dae8c53d97e61cd774e4d6bcca5243c29ca615c/codex-rs/ext/queue/src/service.rs)
  與 [resume 選擇選項](https://github.com/openai/codex/blob/7dae8c53d97e61cd774e4d6bcca5243c29ca615c/codex-rs/cli/src/main.rs)。

用 `node --test scripts/codex-queue.test.mjs`（Node 20+）執行離線的 wrapper 迴歸測試。它們使用假的原生 CLI 與暫存 home，絕不使用真實帳號或
模型請求。**Codex queue helpers** workflow 會在 Windows PowerShell 5.1 與 PowerShell 7、macOS 系統 Bash 與 Linux Bash 上執行這些測試；缺少
必要的 shell 會失敗，而不是悄悄略過。設定保留的夾具涵蓋內建／自訂供應商設定與兩種用量狀態值，但不涵蓋真實的 OpenCodex 路由。請另外在受支援的
安裝上驗證真實的 Desktop 分派、供應商成功與遠端控制的連續性。
