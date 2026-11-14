---
title: "Google Vertex AI"
description: Vertex AI 供應商的模型探索、憑證選擇，以及 Gemini 4 的工具影像處理方式。
---

本頁說明 Google Vertex AI 供應商專屬的行為，適用於 `google-vertex` 或設定
`googleMode: "vertex"` 的 Google 供應商。設定與憑證請見[供應商](/zh-tw/guides/providers/)。

## 模型探索

啟用即時模型的 Vertex AI 供應商會列出 Google 發布的模型，並讀取清單的所有分頁。
清單包含 Gemini 與 Gemma 聊天模型，排除嵌入、語音、Live API、Imagen、Veo，
以及 `gemini-3.1-flash-image` 等模型卡註明不支援函式呼叫的 Gemini 影像輸出模型。

探索使用供應商自己的憑證：`gcp-sa:` 服務帳戶或金鑰；兩者都未設定時，依序使用
`GOOGLE_CLOUD_API_KEY` 與 Application Default Credentials。若已設定的 `keychain:`
或 `$VARIABLE` 金鑰無法讀取，探索會停止，不會改試其他憑證，與請求拒絕啟動的行為一致。
清單無法完整讀取時，OpenCodex 保留先前或手動設定的模型，不發布不完整清單。

推理強度遵循預設組合：Gemini 4 Hydrogen 提供 low、medium、high（預設）及 xhigh；
Gemini 4 Carbon 與 Argon 提供 low、medium、high。`gemini-3-pro` 等未在預設組合中宣告
推理強度的模型不顯示選項，因為送往它們的請求不帶 thinking level。

## Gemini 4 的工具影像

在 Vertex AI 上，`gemini-4-argon`、`gemini-4-carbon` 與 `gemini-4-hydrogen` 會在對應的
函式回應中收到工具產生的影像，例如螢幕截圖。對 Argon，這能避免產生影像的工具呼叫後出現
上游 400 錯誤「Requests ending with a model turn are not supported」。Carbon 與 Hydrogen
也採用相同、已文件化的函式回應格式，但未在這兩者重現該錯誤。重複結果或無對應呼叫的結果中，
影像會保留在工具回應之後的獨立訊息，並附上無法配對的說明。無需變更設定；此處理僅適用於
Vertex 上的這些 Gemini 4 模型。
