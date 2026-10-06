---
title: Codex 重試診斷
description: 區分速率限制建議、自動重送、供應商復原，以及 Desktop 通知。
---

OpenCodex 的 [Devin adapter](/zh-tw/reference/adapters/#devin) 會在 Codex 看得懂的錯誤契約中保留可用的重試提示。
這並不保證 Desktop 會顯示重新連線列，也不保證供應商會接受下一個請求。

## 誰在等待

當 `OPENCODEX_DEVIN_STATED_RESET_WAIT_MS` 未設定或為 `0` 時，Devin adapter 不會為了所述的冷卻時間而扣住被拒絕的請求。
Codex 會收到最終的失敗，並自行掌管有界的重試策略。正值表示選擇啟用既有的、由 proxy 持有的等待；它會延遲最終失敗的送達，
並可能與用戶端的重試疊加。這個相容性對應既不改變該設定，也不改變 Codex 的重試次數。僅限程序的覆寫不需要在重新啟動後保留。

`rate_limit_exceeded` 加上 `Please try again in Ns.` 是重試建議，不是倒數事件。Codex 自己的重試策略、取消與生命週期仍然適用。
不要為了讓等待看得見而加入合成的 reasoning、tool、assistant 或成功項目：這些項目可能污染歷史，或暗示有工作發生過。
不要縮短供應商的延遲，也不要為了推進用戶端的重試計數器而刻意觸發額外的請求。

## 為什麼第一個重新連線列可能不出現

公開的 Codex `rust-v0.158.0-alpha.2.1` 原始碼，在
[`handle_response_stream_error`](https://github.com/openai/codex/blob/rust-v0.158.0-alpha.2.1/codex-rs/core/src/responses_retry.rs)
中對一般的串流重試通知設有條件：

```rust
let report_error = retry_count > 1
    || cfg!(debug_assertions)
    || !sess.services.model_client.responses_websocket_enabled();
```

因此在 release 版本中，當內部的 WebSocket 啟用判斷為 true 時，這個迴圈中的第一次重試可以等待而不發出 `Reconnecting...`。
選定的延遲不屬於該通知的判斷條件，且 sleep 位於 `if report_error` 區塊之外。伺服器建議的長時間等待也可以是靜默的。這是
針對特定版本的原始碼觀察，不能證明任何特定的 Desktop 請求走了那條分支。不要從模型名稱、HTTP 狀態，或在某一個 proxy 躍點上
看到的傳輸方式，去推論內部的判斷。

啟用的通知訂閱，以及能繪製該列的 renderer，只能證明接收路徑存在，不能證明引擎針對受影響的回合發出了事件。同樣地，收合起來的
供應商細節可以解釋缺少的細節文字，但單憑它無法解釋缺少的重新連線列。

對應的 app-server
[`ErrorNotification`](https://github.com/openai/codex/blob/rust-v0.158.0-alpha.2.1/codex-rs/app-server-protocol/schema/typescript/v2/ErrorNotification.ts)
包含 `willRetry`、`threadId` 與 `turnId`。請分別觀察事件的發出、送達到對應的回合，以及繪製。proxy 的 `response.failed` frame
本身並不是那則 app-server 通知。改變引擎端的第一次通知策略需要修改 Codex；改寫 OpenCodex 的錯誤訊息，無法強迫事件通過一條
不會發出它的分支。

## 唯讀驗證

蒐集證據時，請保持既有的 app、proxy、設定與測試回合不變。重新啟動、送出新回合，或切換傳輸方式都會改變實驗。在獨立的後續實驗中，
請於兩種內部 WebSocket 狀態下比較同一個受控失敗，並檢查第一次與之後的重試；除非實際觀察到 UI，否則不要稱它為真正的 Desktop
繪製測試。

針對受影響的對話與進行中的回合，請區分下列結果：

| 問題 | 所需證據 |
| --- | --- |
| 是否送達可用的建議？ | 最終失敗的代碼、正規化後的延遲，以及回應結束時間。 |
| 是否發生自動重送？ | 該失敗之後、沒有手動送出的相關聯下一個請求。請從失敗回應結束量到下一個請求開始，而不是從第一個請求開始量。 |
| 供應商是否復原？ | 成功的回應，以及受影響工作的延續，而不只是另一個請求或不相關的成功回合。 |
| 是否發出並送達重試通知？ | 對應的 app-server 錯誤事件與其重試旗標，而不只是訂閱設定。 |
| 通知是否可見？ | 對受影響的 Desktop 回合的觀察；僅靠協定或原始碼檢查並不足夠。 |

近似的供應商建議與排程開銷，可以造成小幅的時間差。如果重送遇到 socket 關閉錯誤，之後的嘗試又收到新的速率限制，請記錄為
重送有運作、但供應商復原不完整。新拒絕的延遲是新的觀察，不是從先前拒絕繼承來的計時器。單憑 `inProgress` 的回合，既不能證明
復原，也不能證明繪製正確。重試用盡、取消與 app 重新啟動後的復原必須分別評估。

只發布驗證範圍與彙總的時間／結果。原始記錄、請求本文、憑證、帳號資料、私人路徑，以及 thread／conversation／request／trace
識別碼，都不要放進公開的 PR 與診斷報告。

## 迴歸測試範圍

`tests/server/retry-delay-hardening.test.ts` 檢查：120、900、1,800、2,460 與 3,600 秒的建議在格式化後保持不變；較長的提示在
同時存在較短提示時仍排在第一；以及中間一次沒有計時的斷線，不會讓之後的拒絕繼承舊的延遲。這些都是純解析器／格式化器的檢查。
它們不會等待一小時、不會測試 Codex 的通知判斷、不會驗證 app 重新啟動，也不能證明從真實供應商失敗中復原。
