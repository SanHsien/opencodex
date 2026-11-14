---
title: 桌面應用程式
description: 在 macOS、Windows 與 Linux 上安裝及使用 OpenCodex 桌面應用程式。
---

OpenCodex 桌面應用程式結合原生系統匣與網頁儀表板。內附的 CLI 會尋找既有本機代理；只有確定沒有代理執行時，應用程式才會啟動內附的執行環境。

儀表板由找到的本機代理端點提供服務（預設連接埠 `10100`）。桌面應用程式是包裝該儀表板及內附執行環境的本機外殼。

## 安裝

### macOS

從[最新版本](https://github.com/lidge-jun/opencodex/releases)下載 `OpenCodex-<version>-macos.dmg`。開啟 DMG，將 `OpenCodex.app` 拖到 Applications。應用程式需要 macOS 13 或更新版本。

正式版 `OpenCodex.app` 使用 Developer ID 簽署並經 Apple 公證，因此第一次啟動時，macOS 通常只會要求確認開啟從網路下載的應用程式。如果 macOS 仍封鎖它，請使用 **System Settings → Privacy & Security → Open Anyway**。

#### Homebrew（桌面應用程式）

也可以透過 Homebrew Cask 安裝桌面應用程式：

```bash
brew install --cask opencodex
```

- **內建更新（`auto_updates`）**：桌面應用程式有內建更新機制，Cask 宣告了 `auto_updates true`。但指定 Cask 的 `brew upgrade --cask opencodex` 或 greedy 升級仍可能取代已透過應用程式內更新升至較新版本的應用程式。使用 Homebrew 升級前，請檢查已安裝應用程式和 Cask 的版本。
- **CLI 與背景服務**：此 Cask 只安裝包含 CLI 和 proxy 執行環境的 `OpenCodex.app`。若需要獨立 CLI 或無介面服務，可透過 npm 或版本發布封包另行安裝 `ocx`；兩者共用 `~/.opencodex` 設定。要將服務交給另行安裝的 CLI，請退出 OpenCodex，明確選擇該 CLI（若已啟用 [Desktop 的套件啟動器交接](/zh-tw/getting-started/installation/)，也須繞過該交接），然後執行 `ocx service install`。請參閱[終端機命令選擇](/zh-tw/guides/desktop-app/#using-the-ocx-cli-with-the-desktop-app)及[執行環境擁有權](/zh-tw/reference/cli/lifecycle/#執行期所有權)。
- **Cask 升級後的服務**：Cask 的解除安裝步驟可能移除屬於獨立 CLI 的 `com.opencodex.proxy` launchd 工作及 plist，導致背景服務停止。升級後請退出 OpenCodex，在 macOS GUI 登入工作階段中使用上述明確選定的獨立 CLI 執行 `ocx service status`。若服務不存在，執行 `ocx service install`；若已安裝但未載入，執行 `ocx service repair`。然後再次執行 `ocx service status` 檢查。 `ocx service install` 會從 `OCX_BAKE_PORT` 或 `config.port` 讀取連接埠，而不是從已移除的工作讀取；如果服務註冊後其中任一值有所變更，請更新仍指向舊連接埠的用戶端。同一解除安裝步驟也會移除 Desktop 本身的 Start at Login 項目（launchd 工作 `OpenCodex`）；如果你有使用，請在 OpenCodex 中重新開啟 **Start at Login**。
- **使用 `--zap` 刪除資料**：`brew uninstall --zap --cask opencodex` 會刪除 `~/.opencodex` 和 `~/.opencodex-desktop`，包括這些目錄中 CLI 和 Desktop 共用的設定及狀態資料。使用 `--zap` 前，請備份要保留的資料。 2.97.0 之前的 Cask 定義沒有列出這兩個目錄，而 Homebrew 可能以安裝時記錄的定義執行解除安裝；請在 `--zap` 後檢查它們是否仍然存在，若要刪除請自行手動刪除。

### Windows

下載 `OpenCodex-<version>-windows-x64.msi` 並執行安裝程式。由於安裝程式尚未經過程式碼簽署，Windows SmartScreen 可能顯示警告；確認檔案來自版本發布頁面後，選擇 **More info → Run anyway**。

> **本 fork 的 MSI 沒有遙測頁。** 下列說明描述的是上游安裝程式；fork 建置不送出遙測，也不連結該安裝頁
> （見[遙測與隱私](/zh-tw/guides/telemetry/)）。

上游安裝程式有一頁說明 OpenCodex 送出的匿名每日使用摘要，連結[隱私聲明](/zh-tw/reference/code-signing/#privacy)，並有預設勾選的 **Send anonymous usage statistics** 核取方塊。取消勾選，應用程式會在第一次啟動時、任何代理執行之前，把停用儲存到你的 opencodex 設定。這個選擇套用於電腦上的每個帳號（每個帳號各一次），所以也適用於管理員或部署工具（Intune、SCCM）執行的靜默安裝。靜默安裝時請傳入 `OCX_TELEMETRY_CHOICE=optout`：

```powershell
msiexec /i OpenCodex-<version>-windows-x64.msi /qn OCX_TELEMETRY_CHOICE=optout
```

安裝程式需要管理員權限，並為整台電腦記錄該選擇。只有 `send` 會保持遙測開啟；任何大小寫的 `optout` 與其他任何值（`off`、`0`）都會關閉它。每次傳入 `OCX_TELEMETRY_CHOICE` 的安裝都會記錄一個新的決定，所以每個版本都重用同一道指令的部署，會在每次升級後再次套用停用，覆蓋期間在儀表板做出的任何選擇。

保持勾選本身不會開始送出：儀表板仍會先顯示一次性的告知，且已勾選的方塊絕不會讓已關閉遙測的帳號重新開啟。應用程式內更新、精簡 UI 安裝（`/qr`）與已安裝版本的維護執行會略過此頁並保留已記錄的選擇。手動執行較新的安裝程式會再次顯示此頁，若你先前已停用則為未勾選。不更動核取方塊直接繼續會保持先前的決定，所以不會再覆蓋你之後在儀表板做出的選擇；更動核取方塊則記錄新的決定。

若你以 `ocx service install` 安裝了背景服務，它可能在登入時不經應用程式就啟動代理。後來的安裝程式記錄的停用，會在應用程式下次啟動時才傳達到該服務的設定；在那之前服務可能仍會送出每日摘要。要立即停止，請執行 `ocx telemetry disable`。

### Linux

從版本發布頁面下載 `OpenCodex-<version>-linux-x86_64.AppImage` 或 `OpenCodex-<version>-linux-amd64.deb`。

使用 AppImage：

```bash
chmod +x OpenCodex-<version>-linux-x86_64.AppImage
./OpenCodex-<version>-linux-x86_64.AppImage
```

使用 Debian 系發行版：

```bash
sudo apt install ./OpenCodex-<version>-linux-amd64.deb
```

系統匣圖示需要支援 AppIndicator 的桌面環境。

## 首次啟動

應用程式會要求內附的 CLI 執行 `ocx resolve --json`；若既有本機代理可連線，就會附著其上。只有 CLI 證實代理不存在時，才會啟動內附執行環境；結果不確定時會顯示啟動失敗。接著儀表板會在應用程式的 webview 中，以找到的 loopback 端點開啟。登入時隱藏在系統匣中啟動的應用程式會保留輕量的啟動頁，直到你第一次從系統匣開啟或再次啟動應用程式時才載入儀表板。

除非你核准 **Take over**，應用程式不會停止或取代已在監聽的代理。由已註冊的背景服務監管的代理（在 Windows 上是 `opencodex-proxy` 排程工作）完全不會被提供接管，因為該服務會依自己的排程重新啟動它：應用程式會以訪客身分附著上去且不詢問，服務與應用程式因此共用連接埠上的同一個代理。對於其他既有代理，在提示中選擇 **Stay a guest** 會依該代理目前的擁有者與設定目錄記住，下次啟動不再出現提示；只有已記錄的擁有者改變時才會再問。若要讓應用程式擁有由服務監管的代理，請先執行 `ocx service uninstall`，再重新啟動應用程式。

若要讓應用程式對所有記住的代理重新詢問，請刪除應用程式設定資料夾中的 `guest-choice.json`。在 Windows 上該資料夾是 `%APPDATA%\com.opencodex.desktop\`，與存放安裝識別碼的資料夾相同。下次啟動就會再詢問。刪除這個檔案會一次忘記所有記住的選擇，不是只忘記單一代理；檔案不存在則代表沒有任何記住的選擇。目前應用程式內還沒有對應的操作入口。

透過系統匣的 **Open dashboard** 或 **Open in browser**，可以在內嵌儀表板與一般瀏覽器間切換。系統匣也提供更新檢查。

在 macOS 上，關閉儀表板後，應用程式會繼續在選單列中執行。從 Dock 或 Finder 再次開啟 OpenCodex 即可恢復儀表板，無須重新啟動代理。

## Using the ocx CLI with the desktop app

On a stable macOS app, Windows installation, or installed Linux deb, Desktop automatically
configures its bundled `ocx` for new terminals at launch. Open **Terminal command** beside
**Desktop update** in the dashboard sidebar, or **Terminal command…** in the tray menu,
to turn it off, repair it, or remove it. Turning off **Use Desktop's ocx command in new
terminals** removes the managed configuration; **Remove terminal command** also keeps
the off choice for future launches. AppImage and development launches do not configure it.

macOS and Linux use a shim in `~/.opencodex-desktop/bin`, a shared `path.sh` helper and
managed blocks in zsh, bash and fish startup files. Desktop records ownership and recovery
information in `~/.opencodex-desktop/cli.json`; deleting that record does not remove the
command or its shell blocks. The Linux deb's `/usr/bin/ocx` remains unchanged. Windows
prepends the installation directory to the user `Path`, preserving its other entries.
A command in the Windows system `Path` can still take precedence; Desktop reports that
conflict as partial configuration and does not change the system `Path`.

After enabling or repairing, open a new terminal. Check `type -a ocx` on macOS/Linux,
or `Get-Command ocx -All` and `where.exe ocx` on Windows. Existing shells, aliases,
absolute commands and later PATH changes can still select another executable.
Configuration persists after Desktop quits. If the bundle is missing, the POSIX shim
fails with repair/removal guidance instead of silently selecting another `ocx`.

On POSIX, the shim preserves shell-exported Anthropic settings when launch-proof tools
are available. If proof generation fails, and for Windows direct execution, the bundled
CLI retains its existing stripping of untrusted Anthropic environment settings.

On macOS, Linux and Windows, `ocx status` and `ocx doctor` identify OpenCodex Desktop
when they verify that the app runs its bundled proxy, even without recorded ownership.
`ocx status` shows `Runtime supervisor: OpenCodex Desktop`; neither command recommends
CLI service repairs for that runtime. On macOS and Linux, turn on **Start at Login**
in the OpenCodex menu instead of installing a background service. Startup safety credits the app only when its login registration is verified;
if it cannot be verified, follow the Desktop guidance in status.
The Startup page then labels the Desktop row **Running · Start at Login not verified**.
On macOS the menu's **Start at Login** item is checked only when Startup safety would
verify the same registration. Otherwise the item is unchecked and its label says why:
**disabled by macOS** opens System Settings → General → Login Items & Extensions, where
you allow OpenCodex to open at login; **another OpenCodex copy** means the login item
belongs to a different copy of the app, so turn it off from that copy; **registered app
is missing** means the login item names an app that no longer exists, so delete
`~/Library/LaunchAgents/OpenCodex.plist` and turn the item on again; **status unknown**
means the registration could not be read. While the app runs the proxy, the Startup page keeps the
background service installer disabled; to use it instead, quit OpenCodex and run
`ocx service install` in a terminal. The Codex launcher shim can still be installed there.
When a Codex launch finds no proxy, the shim waits for OpenCodex to restart it, opens
OpenCodex on macOS if it quit and its recorded ownership matches a valid **Start at Login**
registration, and otherwise reports an error instead of starting a second proxy. Automatic
reopening selects that registration's app bundle path and checks that its declared main
executable matches the registered Desktop executable. If registration is missing, stale or
inconsistent, open OpenCodex manually; another copy with the same bundle identifier is not
selected as a fallback. If the shim reads "activation not confirmed", add
`. ~/.opencodex/codex-shell-env.sh` to your shell startup file after other PATH setup.

The bundled CLI is `/Applications/OpenCodex.app/Contents/MacOS/ocx` on macOS and
`/usr/bin/ocx` for the Linux deb package. Run that executable with `status` to check
the app's proxy. Windows also verifies live supervision, but **Start at Login** remains
unverified there and Desktop receives no startup protection credit.

While the CLI detects Desktop supervising the proxy, `ocx service install`, `repair`,
`start`, and `restart` refuse before changing the service, even without recorded ownership
or verified login registration. Quit OpenCodex, then run `ocx service install` to move
startup management to the CLI. A duplicate `ocx start` names the Desktop supervisor.

Use **Check for Updates…** in the tray to update the app's bundle. The bundled compiled CLI reports `installer: "standalone"` and `reason: "standalone_install"` from `ocx system update check`, with `canUpdate: false` and guidance to use Desktop updates. `ocx update` refuses
package replacement while Desktop supervises the proxy, even for a separate npm/Bun install;
quit OpenCodex first to update that install. An accepted `ocx restart` reports that Desktop
starts the replacement and waits for it to become healthy. A newer PATH CLI cannot use
`ocx restart` to replace the app's proxy with its own runtime.

Terminal `ocx stop` still stops the proxy, but Desktop may start it again after a short
backoff. Use **Stop proxy** or **Quit** in the tray to keep it stopped. Ordinary stop prints
this reminder on stderr; `ocx stop --json` skips the supervision probe and reminder.

These guards are early warnings in current CLIs and runtimes; older versions can lack them.
A probe that saw Desktop but could not finish verification also blocks the operation. Once blocked, a later inconclusive probe
does not clear it; a check must positively show no Desktop supervision. With no prior
Desktop evidence, an inconclusive or unsupported probe keeps the existing command behavior.
Recorded-ownership guards still apply independently.

## Startup safety on macOS and Linux

Startup safety reports **Desktop app** protection when fresh diagnostics verify
live supervision of the bundled proxy and that same app's **Start at Login** registration.
Recorded desktop ownership is preserved separately; supervision does not create a claim.
On Linux, the pinned autostart backend writes the login entry to
`~/.config/autostart/OpenCodex.desktop`, even when `$XDG_CONFIG_HOME` is set. Startup
safety reads that entry and the desktop install-id under `~/.config`. When
`$XDG_CONFIG_HOME` points elsewhere, the login session searches a different autostart
directory, so startup safety stays **At risk** instead of crediting the entry.
The entry counts only while it is not marked `Hidden=true` or
`X-GNOME-Autostart-enabled=false`, and has no `OnlyShowIn`, `NotShowIn`, or `TryExec`
condition. Its `Exec` must be an unquoted absolute path to `opencodex-desktop`, without
spaces, escapes, or field codes, followed by exactly `--autostart`. The resolved
executable must still be named `opencodex-desktop`, with its bundled `ocx` beside it.
Startup safety reads the full evidence chain twice and grants protection only when
both reads agree.

AppImage installations remain **At risk**: the autostart backend registers the outer
AppImage path, while the live desktop process runs inside its mount. Startup safety
cannot verify that relationship and does not credit AppImage protection.
A missing or stale check remains **At risk**. If the desktop app owns the proxy but
protection cannot be verified, reopen OpenCodex and check **Start at Login**. Service
and launcher installation or repair stays disabled while that ownership remains;
`ocx restore` is still available to undo Codex routing.

Normal desktop updates replace the bundled CLI with the fixed startup probe. No local
patch needs to be preserved across an update.

## Zoom

On macOS and Linux, Cmd (macOS) or Ctrl (Linux) with `+`, `-` and `0`, or Ctrl with the mouse wheel,
zooms the window between 50% and 300% in 10% steps, and `0` returns to 100%. The sidebar shows the
same level next to the theme switch, as `-`, the current percentage and `+`; clicking the
percentage returns to 100%. The level is
remembered and applied again the next time the app starts. The dashboard comes from the proxy the
app is attached to, so an app attached to an older proxy keeps the earlier behaviour (20% steps, not
remembered, no sidebar control) until that proxy is updated. Windows uses the browser engine's own
zoom, which is not remembered.

## 保持 proxy 執行

App 會讓它啟動的 proxy 持續執行。當該 proxy 自行重新啟動時——在**連接為 Child**、從儀表板進行記憶體重啟，或中斷 Child 之後——app 會在同一個連接埠啟動新的 proxy，通常在約一秒內（若 proxy 在最近兩分鐘內已重啟過則需數秒），並重新載入開啟中的儀表板，所以系統匣的 Stop 仍能作用到它，Quit 仍會結束它。如果 proxy 在沒有被要求的情況下結束（崩潰，或從終端機執行 `ocx stop`），app 會在一段隨 proxy 持續失敗而從 3 秒增加到 30 秒的短暫延遲後再次啟動它。如果 proxy 在它的連接埠上不再回應，app 會在約 15 秒內察覺並以同樣方式復原；對於不是它啟動的 proxy（背景服務，或你自己啟動的），它會先等待約一分鐘讓該 proxy 恢復。復原期間，它絕不會停止或取代別的東西已在該連接埠上執行的 proxy；它會改為連接到那一個，而不要求接管它。這包括在**連接為 Child** 之後由背景服務重新啟動的 Child proxy：app 會連接上去並顯示 Child 的儀表板。如果連接埠被 app 無法使用的東西佔用，例如綁定在 `127.0.0.1` 以外位址的 proxy，app 會停止重試並等待狀況改變。在更新頁面開啟時完成的復原，會讓該頁面留在畫面上。

系統匣的 **Stop proxy** 與 **Quit** 會讓 proxy 保持停止。儀表板自己的 **Stop** 按鈕不會停止由 app 執行的 proxy，因為 app 會再次啟動它：它會說明這點，並且什麼都不改變。app 做了什麼決定以及原因，會記錄在 app 記錄目錄中的 `runtime-supervisor.log`（macOS 上是 `~/Library/Logs/com.opencodex.desktop`）。

## 系統匣中的用量資訊

在 macOS 與 Windows 上，點擊系統匣圖示可開啟精簡用量視窗。系統匣的 **Show usage** 也能開啟它，包括不會轉送點擊事件的 Linux 桌面環境。Linux 會在啟動時開啟儀表板，即使桌面環境不顯示系統匣圖示也一樣。

用量視窗顯示 Today 與 30 天總量、設定的用量圖表、精簡模型清單，以及 provider／帳號限制。配額重設倒數顯示在進度條旁；滑鼠停留可查看確切重設時間。既有的 **Menu bar & widget** 設定控制可見區塊與圖表。隱藏的 provider 不計入標題、總量、配額或圖表。圖表包含目前時間區間的活動。部分資料指示標記表示某些圖表資料無法可靠地歸屬。缺少的測量值不會顯示成用量為零。在 Windows 與 Linux 上，若帳號清單很長，請在用量視窗中捲動至底部，找到 Refresh 與 Dashboard。

在 macOS 上，此視窗使用原生 SwiftUI 控制項與可捲動的 AppKit 面板。macOS 26 及更新版本使用 Apple Liquid Glass；較舊系統使用原生 popover 材質。捲動長帳號清單時，標題及 Refresh、Dashboard 按鈕仍保持可見。也可以透過 **View → Show Usage** (Command-Shift-U) 開啟。按 Escape 或點擊面板外即可關閉。

系統匣選單顯示今日請求數與 token 數；啟用時也會顯示估計費用。它使用與 widget 相同的本機日期用量。選擇 **Refresh now** 可立即更新；應用程式也會每 60 秒更新一次。顯示偏好仍位於儀表板的 **Menu bar & widget** 區塊。關閉 **Today** 會隱藏摘要，關閉 **Cost** 則會移除其中的費用。

無法取得或明確未測量的用量會顯示為 `—`，而不是測得的零值。選擇只顯示圖示的標題會清除先前的計數。縮寫會保留整數中的零：一千萬 token 顯示為 `10M`，不是 `1M`。

## 更新

選擇系統匣選單中的 **Check for Updates…** 可立即檢查。正式版也會在啟動後及每六小時自動檢查。

當 Tauri updater 找到較新的應用程式版本時，macOS 選單列圖示或具備 tray host 的 Windows/Linux 系統匣圖示會顯示藍點。內嵌儀表板顯示相同的桌面更新訊號。連接同一代理的一般瀏覽器仍顯示代理套件的更新狀態。如果 shell 約三分鐘未回報，內嵌徽章會變為 unknown，直到重新連線。藍點只表示有更新；安裝仍須明確操作。

在桌面應用程式中，選擇儀表板的更新按鈕即可開啟應用程式更新頁面。你可以在其中重新檢查、安裝待處理的已簽署更新，或返回儀表板。系統匣選單也提供相同的安裝操作。如果安裝失敗，更新仍可重試。即使 Linux 桌面沒有系統匣圖示，也可以使用此頁面。一般瀏覽器儀表板則管理該代理的套件安裝。

安裝前，更新會使用專案簽署的 updater 公鑰驗證。在 macOS 上，應用程式內更新會下載 `OpenCodex-<version>-macos.app.tar.gz`；DMG 用於首次安裝。只有設定 updater 金鑰祕密時才會產生版本 manifest，屆時四個平台都必須完成簽署。

## 解除安裝

在 macOS 上，將 `OpenCodex.app` 從 Applications 拖到垃圾桶。在 Windows 上，從 **Installed apps** 移除 OpenCodex。在 Debian 系 Linux 上執行：

```bash
sudo apt remove opencodex
```

若使用 AppImage，請刪除下載的檔案。

若無法讀取已儲存的選單列設定，為保護檔案，系統會拒絕局部編輯。請先還原檔案，或明確重設 companion 設定後再編輯。
