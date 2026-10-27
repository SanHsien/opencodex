---
title: Windows 上更新失敗
description: ocx update 在 npm install 步驟中失敗後，OpenCodex 安裝處於什麼狀態、如何安全完成更新，以及可以刪除哪些殘留資料夾。
---

本頁適用於 `ocx update` 或儀表板更新中途停止的情況，最常見於 Windows，
會出現類似這樣的結果（回報為 issue
[#5624](https://github.com/lidge-jun/opencodex/issues/5624)）：

```text
update command failed (1)
exit 1 · code: ENOTDIR · syscall: mkdir
```

之後，套件旁邊會出現一個因為 `bunx.exe` 仍在使用而無法刪除的資料夾（`EPERM`）。

## 你目前的狀態

更新程式會先停止代理，把新版本安裝到獨立的暫存資料夾，檢查它，然後才把它換入。安裝步驟
失敗時，換入永遠不會發生：先前的版本仍安裝且可執行，更新程式會在結束前重啟先前的背景服務
（或先前的代理）。你不需要重新安裝才能恢復可用的代理。

用以下方式確認：

```bash
ocx --version
ocx status
```

儀表板的工作只會記錄結束狀態，因為安裝程式自己的輸出可能含有本機路徑。在終端機中執行
`ocx update` 會顯示失敗的步驟以及下一步該做什麼。

## 完成更新

### If npm staging times out

On Windows, the npm-backed `ocx update` staging install has a three-minute budget. A timeout reports
`ETIMEDOUT` with that budget. On Windows, the updater terminates the installer's entire
process tree and confirms its exit before removing the stage and recovering the previous
service. It does not continue extracting into a deleted stage after recovery starts.

If installer exit cannot be confirmed, the update fails and keeps the staging folder and
its ownership marker. Confirm that no installer or OpenCodex process runs from that folder
before removing it. A retained folder does not prevent another update attempt.

Check your registry connection if the install repeatedly exceeds the budget, then retry
`ocx update`. Increasing the budget is not needed to clean up a timed-out install safely.

This process-tree exit guarantee applies to Windows npm updates. POSIX retains its existing
timeout handling; complete-tree timeout cleanup remains open there.

### Retry or reinstall

1. Close anything that may still run OpenCodex files: the Codex app, terminals that started
   `ocx` or `bunx`, and the OpenCodex tray. A running `bun.exe` or `bunx.exe` keeps its files
   locked on Windows.
2. Run `ocx update` again from a terminal.
3. If it fails the same way, run `ocx status` and let any in-progress recovery finish. If the
   updater restarted the proxy, stop it through its owner (`ocx stop`, its service, or the desktop
   app) and confirm it has stopped. Reinstall with the same package manager that owns the install;
   for an npm install managed by the OpenCodex service:

   ```bash
   ocx stop
   npm install -g --allow-scripts=bun @bitkyc08/opencodex@latest
   ocx service restart
   ```

   Restart through the owning service or desktop app after installation completes; use `ocx start`
   when unmanaged. Replace `latest` with `preview` if you follow the preview channel.

## 殘留資料夾

它們位於 npm 全域資料夾中、套件旁邊，在 Windows 上通常是
`%APPDATA%\npm\node_modules\@bitkyc08\`。

| 資料夾 | 由誰建立 | 該怎麼做 |
|---|---|---|
| `.opencodex-<random>` | npm 自己，在直接執行 `npm install -g` 替換套件時建立 | 一旦沒有 OpenCodex 行程從它執行，就可以刪除 |
| `.ocx-staging-<timestamp>` | OpenCodex 更新程式的暫存安裝 | 2.64.0 之後的更新程式會在下一次更新時自行移除；若裡面沒有 `.ocx-update-owner.json` 檔案，代表來自較舊的更新程式，一旦沒有東西從它執行，可手動刪除 |
| `.ocx-backup-<timestamp>` | 更新程式對先前版本的備份 | 保留它；新版本健康啟動後會自動移除，若未成功則會被還原 |

這些資料夾都不會擋住下一次更新：每次嘗試都會暫存到新的資料夾。更新程式只會刪除帶有自己
標記檔、且已超過半小時的暫存資料夾，且絕不跟隨連結。其他所有東西它都只會列出，交由你決定。

若某個資料夾無法刪除，代表仍有行程在使用它。登出或重新啟動 Windows 會釋放該鎖定。

## If the update reports an UNSUPERVISED proxy

When the background service cannot be refreshed after an update, the updater first asks launchd
(macOS) or the systemd user manager (Linux) to restart the service it already has. If that does not
bring back a proxy owned by the service, the updater starts the proxy directly so you are not left
without one, prints a warning that the proxy is running UNSUPERVISED, and exits with a non-zero
status. That proxy works, but nothing restarts it after a crash, and a later service start can
compete with it for the port. Run `ocx service repair` to hand it back to the background service,
then check `ocx status`.

Updates started from the dashboard follow the same order. If only the direct start brings the proxy
back, the dashboard reports the update as failed with the same UNSUPERVISED message even though the
new version is installed and answering; run the same repair to clear it.

## 手動安裝後代理回應 503

在執行中的代理上安裝，會讓它以 `package_tree_changed` 回應 `503`，直到它重啟。2.64.0
之後的版本會在幾秒後自行重啟，`ocx restart` 或 `ocx service restart` 都能找到並重啟處於
該狀態的代理。在 2.64.0 及更早版本中，代理會停留在該狀態，`ocx restart` 可能回報沒有代理
在執行，而舊的代理其實仍佔用該連接埠；此時請用 `ocx service restart`，或結束 `/healthz`
回應所顯示 `pid` 對應的行程，然後執行 `ocx start`。

## 目前尚不清楚的部分

回報中 `mkdir` 的 `ENOTDIR` 代表 npm 嘗試在某個路徑元件其實是檔案的地方建立資料夾。工作
日誌隱去了路徑，因此無法得知是哪個元件，上述殘留資料夾也未被證實會導致這個問題。若持續發生，
請開 issue 並附上 `ocx update` 的完整終端機輸出，以及 `npm config get prefix` 與
`npm config get cache` 的輸出（例如快取位於不同磁碟的情況）。

## Desktop app update stalls or fails on "Installing update…"

In the OpenCodex desktop app, **Install update** downloads the installer from GitHub
Releases before replacing the app and restarting. A failed download or installation with
a known version shows a manual-download hint and a link to that version's release page.

If `Installing update…` stalls or times out, GitHub release downloads may be slow or
blocked by your network. Use the release link in the error, or find the same version on
the [OpenCodex releases page](https://github.com/lidge-jun/opencodex/releases), and download
the installer for your operating system and architecture. Preview versions have their own
release pages; choose the version the app offered.

Before running the installer, stop the proxy through its owner and confirm it has stopped:

1. Quit the OpenCodex desktop app from its tray menu to stop an app-owned proxy.
2. If a service owns the proxy, stop it through the service's controls (`ocx stop` for an
   OpenCodex-managed service). For an unmanaged terminal proxy, stop it in that terminal.
3. On Windows, use this process listing to help identify any remaining runtime:

   ```powershell
   Get-Process -Name ocx, opencodex-desktop, bun, bunx -ErrorAction SilentlyContinue
   ```

   The listing does not establish which app owns a process. Identify the OpenCodex runtime
   and stop it through its owning app or service; a `bun` process may belong to another app.
   Wait for the owning app and proxy to exit before installing.

Run the downloaded installer, then reopen the desktop app or restart the owning service.
