---
title: Pi
description: 使用 Pi 的任何路由模型——ocx export 會為 Pi 的 models.json 寫入自訂 provider 區塊，連接到執行中的 proxy。
---

Pi 從單一全域 JSON 檔案讀取供應商。opencodex 不會啟動 Pi；`ocx export` 輸出 `opencodex` 供應商區塊，包含基底 URL、模型清單及非機密的本機金鑰預留位置。請將此區塊合併到現有設定。

## 快速入門

啟動 proxy，然後印出設定：

```bash
ocx start
```

讓此程序繼續執行。在另一個終端機中輸出設定：

```bash
ocx export --client pi
```

JSON 之後會顯示目的地路徑、合併警告、回環使用提示，以及具有已確認內容視窗限制的模型數量。此匯出僅支援不需驗證的回環代理，不會設定遠端存取驗證。

```json
{
  "providers": {
    "opencodex": {
      "baseUrl": "http://127.0.0.1:10100/v1",
      "api": "openai-completions",
      "apiKey": "opencodex-loopback",
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
          "maxTokens": 128000
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

對於巢狀的上游模型 ID，只要執行中的代理證明原始選擇器指向同一個模型，Pi 匯出就會使用帶斜線的原始選擇器：例如，`openrouter/openrouter/free` 會選擇 OpenRouter 的 `openrouter/free` 模型，其 Fast 列為 `openrouter/openrouter/free--fast`。代理無法如此證明的模型（例如其清單尚未載入，或原始寫法已被另一個模型佔用）會保留編碼後的選擇器。自訂別名保留原有名稱。

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

匯出的 `apiKey` 是非機密預留值 `opencodex-loopback`，不需要匯出金鑰環境變數。匯出器只允許不需驗證的回環代理，會拒絕遠端代理或受權杖保護的代理。供應商憑證保留在 opencodex 設定中，請參閱[供應商](/zh-tw/guides/providers/)；不要把上游供應商金鑰放入此 Pi 區塊。遠端存取應使用支援代理存取憑證的整合。修改預留值不會啟用 Pi 遠端匯出。

## 模型中繼資料

`contextWindow` 與 `maxTokens` 只有在目錄回報權威 context window 時才會發出。沒有回報時，
該模型的這兩個欄位都會省略，Pi 會套用自己的預設值；`ocx export` 會印出有多少列屬於這種
情況。

輸出上限使用目錄或產生的中繼資料中已知的模型上限，僅在未知時回退到 `32000`。輸出上限始終不超過 context window；已知低於 `32000` 的上限也會保留。

`cost` 刻意省略：它需要完整的四個價格欄位，而 opencodex 沒有路由模型的價格資料。輸出零值會誤稱所有模型都免費。

當目錄的 effort 階梯**非空**時，匯出 `"reasoning": true`；階梯缺少或明確為空時則不宣告推理支援。`thinkingLevelMap` 以 `null` 隱藏沒有已宣告目標的 Pi 層級，防止顯示或傳送清單以外的值。若宣告了 `ultra` 而沒有 `max`，就將 Pi 的 `max` 對應至 `ultra`。需要其他對應時，請依 Pi 文件手動修改 `thinkingLevelMap`。

`reasoning` 是從目錄衍生的 Pi 介面中繼資料，不證明上游原生支援推理參數。實際 `reasoning_effort` 取決於適配器與模型，可被轉送、轉換、限制、模擬或省略（例如 `noReasoningModels`）。此布林值只決定 Pi 是否提供該控制項。

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

## 附件與請求相容性

:::note[開發中的行為]
以下供應商相容性變更位於開發 PR 中；較舊的已安裝版本可能仍使用先前的轉換行為。
:::

OpenCodex 在選擇原生 Chat 或轉換路由前，先正規化 Pi／MCP 與 Anthropic 格式的使用者影像。工具影像會放在配對工具結果之後的使用者訊息；一般使用者影像與純文字工具結果可保留原生路徑。請使用現代 `tool_calls` 及帶有 `tool_call_id` 的 `role: "tool"`；舊式 `function` 結果影像會被拒絕，不會靜默丟棄。

明確的 `none` 推理強度會保留到 Chat 轉換。一般 API 金鑰 Responses 目的地保留輸出上限與取樣控制；標準 ChatGPT 目的地仍套用自己的限制，並不代表所有供應商控制等價。

使用者訊息或工具結果內嵌的 WAV／MP3 會轉為 OpenAI Chat 的 `input_audio`。Chat 工具訊息僅能含文字，因此工具音訊會移至配對結果後的使用者訊息。使用者訊息中自帶 base64 位元組的文件，也能以 Anthropic 原生文件、OpenAI Chat 檔案部分或 Google inline data 傳送。其他情況會明確報錯：遠端或不支援的音訊、代理無法解析的檔案 ID／遠端參考、system 訊息附件、工具結果中的文件，以及沒有位元組載體的 wire。只有檔案 ID 的影像也受相同限制。請先轉文字，或改用支援該附件的原生 wire 與模型。原生 Chat 與原始 Responses（含 Azure）維持既有行為；這不是對所有模型媒體支援的保證。影片限制仍由適配器決定。
