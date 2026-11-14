---
title: 目錄選項
description: 在產生的 Codex 目錄中選擇性省略原生模型。
---

## 省略已停用的原生模型

`omitDisabledNativeModels` 是 `config.json` 中的選用布林值，預設為 `false`。
啟用後執行 `ocx sync`，就能在不需要原生別名組合的情況下，省略被明確停用的原生資料列：

```json
{
  "omitDisabledNativeModels": true,
  "disabledModels": ["gpt-5.5"]
}
```

此設定適用於同步、收斂、產生的模型快取，以及 Codex 格式的
`/v1/models?client_version=…` 探索。單純停用原生模型會省略該模型及其所有帳號選擇器資料列；
帶帳號限定的停用則只省略該選擇器資料列。
原生繼承模板會在省略之前先驗證並擷取，因此路由資料列會保有相同的輸入與工具中繼資料，
即使唯一的模板資料列已被停用也一樣。

缺少、為 false 或格式錯誤的值，都會維持預設的隱藏資料列行為。
既有的原生別名省略仍獨立於此旗標。此設定只控制探索：對已停用原生 ID 的直接請求仍照常路由，
而且內容未變的同步輸出會維持既有的不寫入、不更新修改時間的行為。

Desktop 的可見性請見 [Codex App 模型](/zh-tw/guides/codex-app-models/#停用原生模型時代表什麼)，
`disabledModels` 請見[供應商設定](/zh-tw/reference/configuration/providers/)。

## 重新載入模型中繼資料

Codex 啟動時載入本機目錄。OpenCodex 更新目錄後，使用 `ocx sync --restart-codex` 重新整理既有用戶端；只發布新檔案不會更新執行中的用戶端。

中繼資料缺少或過期可能讓 Codex 每次主動傳送所有 MCP 定義，增加提示大小。當請求宣告至少 64 個主動 MCP 工具時，OpenCodex 只記錄數量與門檻的警告，原樣轉送，不記工具名稱或內容。`ocx system codex-restart --yes` 會依要求重啟並中斷回合；`ocx sync --restart-codex` 僅在寫入變更後重啟。

每個 session 只警告一次；匿名請求每筆一次，同一筆的重試／壓縮交接不重複。session 清單上限 1024，超出時最久閒置的項目被移除，之後可能再警告一次。計數包含頂層工具、目前請求的 Responses Lite `additional_tools` 與 Code Mode `exec` 描述內的 MCP 工具，也包含用戶端重送的視窗；只排除代理自己從 `previous_response_id` 還原的歷史。壓縮只計頂層工具。辨識依據為標準 Codex 用戶端身分或回合中繼資料，不是名稱偶然包含 codex；明確延遲工具、對話文字與其他 API 用戶端不計。

路由模型宣告支援延遲探索。Code Mode 使用 `ALL_TOOLS` 與 `tools`，無需獨立 `tool_search`；直接工具介面的模型則可提供它。
