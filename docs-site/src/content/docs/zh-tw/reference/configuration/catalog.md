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
