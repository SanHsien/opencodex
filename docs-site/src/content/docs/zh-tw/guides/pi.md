---
title: Pi
description: 使用 Pi 的任何路由模型——ocx export 會為 Pi 的 models.json 寫入自訂 provider 區塊，連接到執行中的 proxy。
---

Pi 從單一全域 JSON 檔案而非環境變數讀取它的 provider，因此 opencodex 不會啟動它。取而代之，
`ocx export` 會序列化 `opencodex` provider 區塊——base URL、模型清單，以及 Pi 會內插的環境
參考——再由你合併進自己的設定。

## 快速入門

啟動 proxy，然後印出設定：

```bash
ocx start
ocx export --client pi
```

輸出以 JSON 開頭，接著印出目標路徑、合併警告、環境匯出行，以及有多少模型帶有權威的 context
限制。

```json
{
  "providers": {
    "opencodex": {
      "baseUrl": "http://127.0.0.1:10100/v1",
      "api": "openai-completions",
      "apiKey": "$OPENCODEX_API_KEY",
      "compat": {
        "sendSessionAffinityHeaders": true,
        "supportsDeveloperRole": false
      },
      "models": [
        {
          "id": "anthropic/claude-opus-5",
          "name": "Claude Opus 5 (anthropic)",
          "input": ["text"],
          "contextWindow": 200000,
          "maxTokens": 32000
        }
      ]
    }
  }
}
```

產生的 Pi provider 設定會啟用 `compat.sendSessionAffinityHeaders`。合併或手動編輯這個
provider 時請保留這個旗標：Pi 會提供穩定的 session 身分，OpenCodex 據此推導出標準的
OpenCode Go 親和性。當 `cacheRetention` 為 `none` 時，Pi 可能會省略這個身分。

產生的 Pi 供應商設定也會把 `compat.supportsDeveloperRole` 設為 `false`，讓 Pi 以 `system` 而非 `developer` 角色傳送系統提示詞。OpenCodex 會照原樣轉送 Chat Completions 角色，而部分 OpenAI 相容上游會以 400 拒絕 `developer`；所有上游都接受 `system`。

模型 id 是代理的規範選擇器，因此路由模型顯示為 `provider/model`（`anthropic/claude-opus-5`），而原生 OpenAI slug 保持無前綴（`gpt-5.6-sol`）。`name` 後綴 — `(anthropic)`、`(native)`、`(routed)` — 正是讓來自不同上游的兩個同名模型在 Pi 的 picker 中可區分的關鍵。

## 放置位置

Pi 的全域模型設定是：

```text
~/.pi/agent/models.json
```

:::caution[合併，絕不替換]
`ocx export` 絕不會寫入該檔案。請把 `providers.opencodex` 區塊合併進去——替換整個檔案會
毀掉你在那裡設定的所有其他 provider。`--out` 是給暫存路徑用的，且沒有 `--force` 時會拒絕
覆寫既有檔案：

```bash
ocx export --client pi --out ~/opencodex-pi-models.json
ocx export --client pi --json > ~/opencodex-pi-models.json   # 或重導向逐位元組相符的 JSON
```
:::

匯出的區塊是靜態快照，不是即時檢視。新增 provider 或改變模型可見性之後，請重新執行
`ocx export`，並把新區塊合併到舊區塊上。

## 准入金鑰

這裡有兩把容易混淆的 key，而且只有第一把會出現在這個檔案裡：

| Key | 是什麼 | 位於何處 |
| --- | --- | --- |
| Proxy 准入 key | opencodex 自己的憑證，在儀表板的 **API** 分頁產生 | 由 `apiKey` 以 `$OPENCODEX_API_KEY` 參照；值留在你的環境中 |
| Provider key | 你的 Anthropic / OpenAI / OpenRouter key | opencodex 自己的設定，見[Providers](/zh-tw/guides/providers/) |

匯出的設定只帶參考，絕不帶密鑰。Pi 會內插一個裸的 `$NAME`，所以這個變數是：

```bash
export OPENCODEX_API_KEY=<your key>
```

那個名稱只屬於 Pi。opencode 使用不同的變數
（`OPENCODEX_OPENCODE_API_KEY`，以 `{env:…}` 形式）——見 [opencode 指南](/zh-tw/guides/opencode/)。

**回送代理完全不需要 key。** opencodex 預設綁定 `127.0.0.1` 且在那裡不認證任何東西，因此 `$OPENCODEX_API_KEY` 參照是無效的，你可以讓變數未設定。它只在 `hostname` 設定到回送以外時才重要，這也是代理在沒有 token 時拒絕啟動的情況 — 見[遠端存取](/zh-tw/reference/configuration/server/#遠端存取)。

## 模型中繼資料

`contextWindow` 與 `maxTokens` 只有在目錄回報權威 context window 時才會發出。沒有回報時，
該模型的這兩個欄位都會省略，Pi 會套用自己的預設值；`ocx export` 會印出有多少列屬於這種
情況。

`maxTokens` 是滿足 schema 要求的 `32000` 預算，並會限制在不超過 context window，讓小
context 的模型永遠不會被賦予超過其 context 的輸出量。這並不是對任何特定模型真實上限的
聲明。

有兩個欄位是刻意省略的。`cost` 需要全部四個價格欄位，而 opencodex 沒有路由模型的價格
資料——發出零值等於斷言每個模型都是免費的。

`reasoning` 是曾經省略、現在不再省略的欄位：Pi 儲存的是一個布林值，而目錄帶的是 effort
階梯，把一個映射到另一個過去只能用猜的。既然目錄的階梯就是 proxy 自己對「這個模型是否接受
reasoning 參數」的宣告（adapter 會遵守 `reasoning_effort`），現在匯出列只要有**非空**階梯
就會發出 `"reasoning": true`，沒有階梯（或明確為空階梯）的列則維持無 reasoning。這樣 Pi
就只會為 opencodex 真正會接受的那些模型提供 effort 控制項。匯出也會產生一個
`thinkingLevelMap`，把每個沒有宣告對應目標（`null`）的 pi 等級都隱藏起來，所以 pi 永遠不會
提供——也永遠不會送出——階梯中沒有的 effort。有一個退路能讓模型保持可用：當宣告了 `ultra`
卻沒有宣告 `max` 時，pi 的 `max` 等級會對應到 `ultra`（它仍是階梯的成員）。如果你需要不同
的對應方式，請事後依 Pi 的文件手動編輯 `thinkingLevelMap`。

請把 `reasoning` 當成 Pi UI 用的中繼資料：它是從目錄階梯推導出來的，不能證明上游原生支援
reasoning 參數。對於給定的 `reasoning_effort` 值，proxy 實際上會送出什麼，取決於該 provider
的 adapter 與模型——它可能原樣傳遞、翻譯（wire alias）、限制在設定的階梯內、模擬，或完全
省略（例如 `noReasoningModels`）。這個布林值只控制 Pi 要不要提供這個控制項。

## 附件與請求相容性

:::note[開發中的行為]
這裡描述的 provider 對等化變更目前位於開發中的 PR 堆疊上；較舊的已安裝版本可能仍是先前的
轉換行為。
:::

OpenCodex 會先正規化 Pi/MCP 與 Anthropic 格式的使用者圖像，再決定要走原生 Chat 還是轉換
路徑。工具回傳的圖像，在配對的工具結果之後，會使用轉換過的 user-message 載體；一般的使用者
圖像與純文字工具結果則可以維持原生路徑。請使用現代的 `tool_calls` 與帶 `tool_call_id` 的
`role: "tool"`：舊式 `function` 結果的圖像轉換會被拒絕，而不是悄悄捨棄結果。

明確設為 `none` 的 reasoning effort 在轉成 Chat 之後仍會保留。輸出上限與取樣控制對一般
API-key 的 Responses 目標會被保留；標準的 ChatGPT 目標仍會套用自己的限制。這不代表所有
provider 的控制項都是對等的。

**音訊與檔案需要支援它們的原生輸入通道。** OpenCodex 目前還沒有給轉換後請求用的無損音訊／
檔案載體。當 Chat 需要投影轉換，或一個 Responses 請求的目標是轉換過的 adapter 時，已識別
的音訊／檔案附件會回傳明確錯誤，而不是在沒有附件的情況下悄悄成功。僅有 File-ID 的圖像也有
同樣的限制，因為轉換過的 adapter 無法解析那些 ID。請先把附件轉成文字，或改用支援它的原生
通道與模型。原生 Chat 與原始 Responses（包含 Azure）維持既有行為；這不代表保證每個模型的
上游都支援該媒體。影片轉換限制仍依 adapter 而定。

## Schema 狀態

:::note[尚未對真實安裝驗證]
以上的結構是依照 Pi 公開的自訂 provider 文件而來。它**尚未**在裝有 Pi 的機器上，對真實的
`~/.pi/agent/models.json` 驗證過。如果 Pi 拒絕匯出的區塊，落差出在我們這邊——請
[開一個 issue](https://github.com/lidge-jun/opencodex/issues) 並附上 Pi 回報的內容。
:::

## 需求

一個執行中的 opencodex proxy（`ocx start`）與已安裝的 Pi。`ocx export` 會透過 proxy 的
管理 API 讀取即時目錄，所以設定絕不會在模型清單為空的情況下被發出。
</content>
