---
title: Windows 記憶體成長
description: 為何 Windows 上的 bun 程序可能成長到數 GB 的 RAM、opencodex 目前如何處理，以及上游 Bun 修復釋出前你有哪些選項。
---

部分 Windows 使用者會看到 opencodex 背後的 `bun` 程序，在長時間串流工作階段中成長到數 GB 的 RSS（回報為 issue [#314](https://github.com/lidge-jun/opencodex/issues/314)）。本頁誠實說明實際發生的狀況，以及你可以怎麼做。

## 根本原因：上游 Bun runtime 問題

舊版 OpenCodex 內附 Bun **1.3.14**。下表是 2026-07-23 的歷史調查，不代表目前上游 issue 狀態。現在套件內附 Bun **1.4.4**，stream capability gate 將穩定版 1.4.0 以上視為包含 async-pull cancellation 修復；這不證明 Windows 所有記憶體成長來源都已修復。

| Bun issue | 狀態（於 2026-07-23 查核） |
|---|---|
| [#28035](https://github.com/oven-sh/bun/issues/28035) — `fetch()` 接收 backpressure 未與 JS 消費耦合 | 已由 [PR #29831](https://github.com/oven-sh/bun/pull/29831) 修復；**承載該修復的版本尚未驗證**——我們假設內嵌的 1.3.14 尚未包含 |
| [#32111](https://github.com/oven-sh/bun/issues/32111) — 用戶端中止 async-pull 串流時當機 | 修復 [PR #32120](https://github.com/oven-sh/bun/pull/32120) 於 2026-06-21 合併；不假設已存在於 1.3.14。注意：此當機**並非 Windows 特有**（在 macOS/Linux 亦可重現） |
| [PR #31654](https://github.com/oven-sh/bun/pull/31654) — `node:net` socket handle 洩漏 | 上游仍**開放中** |

舊 runtime 的 Windows 為避開 async-pull cancellation crash 而走保守 tee，慢用戶端仍可能造成 JavaScript 無法限制的原生緩衝。目前穩定 runtime 下，Windows auto 在無需 client rewrite 時選有界 eager relay；明確 legacy-tee 保留舊路徑。macOS auto 仍用 tee，eager relay 需明確選用。診斷前先查實際所選 runtime 與 stream-mode 決策。

## opencodex 目前的作法

有界緩解與可觀測性有助判斷保留來源，但不能證明每份記憶體成長回報都已解決：

- **Memory watchdog** — 代理程式每分鐘取樣自身記憶體，並在觀察到的記憶體超過 4 GiB 時以速率限制記錄警告。觀察到的記憶體是 RSS、`external` 與 `arrayBuffers` 的最大值（非總和），因為 Windows working-set/RSS 計數器可能低估已提交的外部保留。
- **`ocx doctor`** — 「Memory / runtime」區段會顯示*服務*程序的 Bun 版本、RSS、JS-heap 占比與 stream-mode 決策，並告訴你成長看起來是原生端（上游問題）還是 JS 端（你應回報的 opencodex 錯誤）。
- **`GET /api/system/memory`** — 透過已驗證的管理 API 提供相同資料，供儀表板或腳本使用。除了 RSS/heap 數字外，它也會回報純量 `responseState` 區塊（項目數、總計/最大序列化位元組、最舊項目年齡），對應代理程式記憶體內的 `previous_response_id` 延續存放區。這可進一步歸因 *JS-heap* 成長：在 heap 上升時 `responseState.totalBytes` 也上升，指向對話保留（長 `store:false` 鏈在每回合重新展開）；而 `responseState` 持平但 RSS 上升，則指回原生 runtime。這些值僅為純量——沒有請求本體、token、路徑或帳號識別碼——且讀取無副作用（永不修剪或淘汰）。儀表板唯讀的 **Memory observability** 卡片會渲染相同欄位。
- **受閘控的替代串流路徑** — 有界 single-reader relay。Windows auto 在 runtime 與回應形狀符合時選用；明確 legacy-tee 保留 tee。macOS auto 仍用 tee，eager-relay 需主動選用。請讀實際決策。

這些變更在真實環境的 RSS 改善**仍待 Windows 使用者驗證**——我們不聲稱洩漏已修復。

基於閾值的自動重啟刻意**未**出貨。若程序當機，服務管理員（Task Scheduler/WinSW、launchd、systemd）本就會重啟它。

## 你的選項

1. **確認實際 runtime 與串流決策。** 目前內附 Bun 1.4.4，gate 接受穩定版 1.4.0 以上。Windows auto 已能在符合條件時選有界 relay，無需再等待下一次內嵌更新；明確 legacy-tee 保留 tee。這不證明所有記憶體成長來源都已解決。

2. **以 `OPENCODEX_BUN_PATH` 使用可信的 Bun runtime。** 在同一 shell 啟動 `ocx` 前設定變數，再執行 `ocx service repair` 將所選 runtime 寫入服務定義。之後載入的專案 `.env` 不會改變選擇。僅修改環境變數不會更新已安裝的服務。

3. **用 `streamMode: "eager-relay"` 選擇有界 relay。** 可改 config.json 或 PUT /api/settings，API 變更對新回合生效而無需重啟。Bun 1.3.14 的 #32111 當機警告是歷史資訊，當時各平台都可能中斷串流。legacy-tee 強制舊路徑；Windows auto 依 runtime gate 與回應條件選擇，macOS auto 保留 tee。

若你在真實 Windows 工作負載上嘗試上述任一作法，請在 [#314](https://github.com/lidge-jun/opencodex/issues/314) 回報前後的 `ocx doctor` 記憶體區段——這正是此緩解等待的驗證。

## Windows 所選 runtime 寫入被拒絕

Windows 服務安裝、修復及 Codex shim 安裝、更新會檢查所選執行檔能否在 OpenCodex 設定根目錄內建立並移除目錄。這是寫入政策檢查，而非記憶體修復。失敗時會在停止服務、下載、暫存以及寫入權杖或啟動器前拒絕操作。shim 自動修復會延後並顯示指引，啟動繼續。正常或停用的 shim 不會檢查。不自動尋找其他 runtime。 首次排程安裝會在此檢查前登錄工作並認領設定根目錄；被拒絕時會復原新登錄，已認領的根目錄保留以便重試。

> 所選 Bun runtime 無法在設定目錄內建立並移除目錄。Windows 應用程式政策可能禁止來自此執行檔位置的寫入。在啟動 `ocx` 前，將 `OPENCODEX_BUN_PATH` 設為政策允許的可信 Bun 執行檔，或以 `npm install -g --allow-scripts=bun @bitkyc08/opencodex` 重新安裝後重試。未選擇其他 runtime。
