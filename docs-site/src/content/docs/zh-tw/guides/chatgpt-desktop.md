---
title: ChatGPT Desktop app-server shim（實驗性）
description: 一項選擇性啟用、僅限 macOS 的實驗，會改寫內建 app-server stdout 管線上的單純額度閘門欄位。
---

這項實驗**僅限 macOS，且預設關閉**。它會過濾內建 ChatGPT app-server 的 JSON-RPC stdout，以打開已知的單純額度閘門。它不會
增加帳號的額度，也不會讓上游服務接受它拒絕的請求。

在你的 OpenCodex `config.json` 中啟用：

```json
{
  "chatgptDesktop": { "appServerShim": true }
}
```

然後執行：

```bash
ocx chatgpt launch
ocx chatgpt status
```

`launch` 會在 OpenCodex 設定目錄下建立一個可執行的 launcher，若 ChatGPT 正在執行就先結束它，並以
`open -a <bundle> --env CODEX_CLI_PATH=<launcher>` 重新啟動。app 是依其 bundle identifier `com.openai.codex` 找到的，所以安裝在
`~/Applications` 或其他磁碟區也能運作，而且絕不會結束或開啟另一個同名「ChatGPT」的 app。請先儲存進行中的工作：這會重新啟動
app。它不需要正在執行的 OpenCodex proxy。

若要移除 launcher 並在沒有覆寫的情況下重新啟動：

```bash
ocx chatgpt restore
```

Restore 會保留設定旗標原樣。把 `chatgptDesktop.appServerShim` 設為 `false` 或移除它，即可停用之後的明確 shim 啟動。從 Dock 或
Spotlight 的一般啟動不會自動套用 shim。

如果沒有安裝 ChatGPT（找不到 `com.openai.codex` bundle），`restore` 只會移除 launcher：它無法重新啟動任何東西，並以錯誤結束。

## 改寫邊界

只有 `account/rateLimits/updated` 通知，以及最上層結果包含 `rateLimits`、`rateLimitsByLimitId` 或 `ordinaryUsageAllowed` 的回應符合
資格。單純的 `rate_limit_reached` 標記會被清除；已知的額度閘門旗標（`allowed`、`limit_reached` / `limitReached`、
`ordinaryUsageAllowed`）只有在有單純額度證據時（已清除的單純 reached 類型，或達 100% 的視窗）才會被打開。因酬載中看不到的原因而
關閉的旗標會維持關閉。工作區、點數、未知的 reached 類型與支出控制限制，會讓用量閘門保持關閉。

顯示的用量保持誠實：百分比、重設時間、視窗長度、方案資訊與其他顯示欄位維持收到的樣子。不相關的 JSON-RPC 訊息、巢狀的工具輸出、
對話送出阻擋的中繼資料，以及格式錯誤的行都會原樣通過。只有被改變的行會重新序列化；其他位元組保留原本的編碼與換行。Stdin、stderr
與真實執行檔的結束狀態，仍直接連到 app。

## 執行檔與環境安全

產生的 launcher 權限為 `0755`，並嵌入目前的 OpenCodex 執行檔，以及（對原始碼安裝）CLI 入口路徑。`CODEX_CLI_PATH` 會告訴 ChatGPT
執行這個 launcher，而不是直接執行它內建的執行檔。請讓 launcher、它的設定目錄與 OpenCodex 安裝保持在你的掌控之下：變更這些執行檔
路徑，就是變更 app 所執行的程式碼。launcher 仍會 `exec` 所找到 bundle 的內建執行檔；如果該 bundle 沒有 app-server 執行檔，
`launch` 會拒絕，而不是寫入 launcher。

寫入 launcher 之前，`launch` 還會檢查 bundle 與它的 app-server 執行檔屬於你或 root、群組與其他人不可寫入，並通過以 OpenAI team ID
（`2DC432GLL2`）進行的嚴格程式碼簽章驗證。任一項失敗的 bundle 都會被拒絕，因此別的帳號放置的副本無法被弄成在你的工作階段內執行。
launcher 檔案會先寫成暫存檔再改名就位；該路徑上既有的符號連結會被取代，而不是被跟隨。

這項整合不會安裝憑證、網路 listener、PAC 或背景監看程式。它不會記錄 app 的訊息或環境。Status 會回報正在執行的 ChatGPT bundle
程序是否帶有預期的 launcher 覆寫。

## 失敗行為與已知限制

當平台不是 macOS、OpenCodex runtime 不存在，或過濾器自我測試失敗時，launcher 會以未經修改的 stdout 執行原本的執行檔。內建的
app-server 執行檔不存在是例外：沒有可以退回的東西，所以 launcher 會以錯誤結束（見下文）。
通過自我測試之後才在工作階段中途死掉的過濾器會關閉管線。內建 app-server 在那之後會怎麼做尚未驗證；它可能收到 SIGPIPE 或寫入錯誤，
並由 Desktop 透過同一個 launcher 重新啟動。過濾器的 passthrough 模式把這個情況限制在 exit/crash：改寫例外會讓該行原樣通過，而
意外的改寫機制失敗會把剩餘的串流切換成原始位元組。

這項實驗取決於內建執行檔的路徑、app 是否遵守 `CODEX_CLI_PATH`，以及目前的 RPC 欄位形狀。更新可能改變這些。被移動或移除的
OpenCodex 安裝會讓 launcher 預檢失敗，並執行原本的執行檔。搬移安裝位置後，請再次執行 `ocx chatgpt launch`。如果 app 更新移動或移除了
內建的 app-server 執行檔本身，launcher 就無法啟動它：它會在 stderr 印出指名 `ocx chatgpt launch` 與 `ocx chatgpt restore` 的訊息並
結束，在你執行其中之一之前 Desktop 無法啟動它的 app-server。單行超過 8 MiB 的輸出會原樣通過而不解析，不會被緩衝。

這個獨立的 shim 不會改寫對話中繼資料，也不會路由模型呼叫。其他 app 閘門或上游拒絕仍可能阻止送出。在額度用盡的 Plus 帳號上回報的證據
同時也使用了攔截，所以它並不能證明單靠這個 shim 就能解決每一種桌面送出鎖定。
