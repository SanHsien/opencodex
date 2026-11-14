---
title: 帳戶自動暫停
description: 選用功能：帳戶收到明確的永久拒絕後，自動暫停使用。
---

## 自動暫停遭永久拒絕的帳戶

`providers.<provider>.accountAutoPause` 預設關閉，需主動啟用。它適用於該供應商的 OAuth
帳戶、Codex 帳戶池（包含池模式下的主帳戶），以及已設定的 API 金鑰池項目。例如：

```sh
ocx config set providers.anthropic.accountAutoPause.enabled true
ocx config set providers.anthropic.accountAutoPause.consecutiveFailures 2
```

`consecutiveFailures` 是 1 至 100 的整數，省略時使用 2。只有明確且屬於帳戶範圍的 HTTP
401/403 拒絕才計入：組織禁止 OAuth、訂閱未啟用或已到期、帳戶被禁止使用 API／Claude Code、
Google 因違反服務條款停用帳戶，或降為沒有點數的免費方案。模型權限錯誤、過期的 access token、
額度視窗、429、5xx、格式錯誤的回應與網路失敗都不會暫停帳戶。

計數器只存在目前程序內，按帳戶序列化處理。成功的 HTTP 回應、明確恢復或重新登入會清零；
單獨更新 token 不會清除 OAuth 帳戶的連續失敗次數。暫時錯誤不改變計數。重啟代理會清除計數，
但已完成的暫停、固定原因碼及時間戳會保存。不同代理程序各自計數。變更、停用或重新啟用政策、
停用供應商或變更端點，都會丟棄處理中的拒絕觀察，因此舊政策下送出的請求不會事後觸發暫停。
只計入實際送達上游的憑證；本機外掛若改寫憑證或目的地，該次傳送不計入。Codex 帳戶池還會
比對請求送出時的工作區（`chatgpt-account-id`）。

達到門檻時，OpenCodex 透過既有暫停機制排除該帳戶，並在既有重試／傳送預算內，為目前請求
嘗試其他合格帳戶。固定的 Codex 帳戶選擇器與綁定帳戶的上傳檔案仍受原有限制。
暫停不會取消已送出的工作或變更憑證，只輸出一行不含帳戶識別資訊與上游錯誤文字的一般日誌。

`ocx account list <provider>` 顯示暫停原因。儀表板的 Paused 標記會顯示原因與時間。
使用 `ocx account resume <provider> <account-id-or-alias>` 清除原因並允許再次選取；
在 API 金鑰列按 Resume 也會啟用該金鑰。此政策不會自動恢復帳戶；明確登入會清除它記錄的暫停，
而 [`resume --if-healthy`](/zh-tw/reference/cli/providers-accounts/#resume-if-healthy) 會先讀取健康狀態再恢復。
