---
title: 為何 v1 是預設的子代理介面
description: v2 加密任務的限制會破壞什麼、為何 OpenCodex 現在改出貨 v1，以及若你仍想用 v2 該怎麼做。
---

OpenCodex 安裝時把子代理介面設為 **v1**。Dashboard、Models 與 Subagents 頁面
都會在切換到 **base** 或 **v2** 之前要求你先確認，而本頁正是那個確認訊息所連
結的頁面。CLI 不會跳出確認。

理由很窄也很具體：在 v2 上，一個從 ChatGPT 原生模型交付給某個路由過的模型的
任務，該路由過的模型無法讀取它。這正是大家最常用的委派方式——一個 GPT 父任務
產生 Grok、Claude 或 GLM 子任務——而在 v2 上，這種情況每次都會失敗。

## 發生時你會看到什麼

產生子任務的動作會被拒絕，而不是悄悄產生一個空的子任務：

```json
{
  "error": {
    "code": "unreadable_encrypted_agent_task",
    "message": "Routed V2 worker task is encrypted for the native ChatGPT backend and cannot be read by the selected provider. Use plaintext V2 agent-message delivery or select a native ChatGPT model."
  }
}
```

回應為 HTTP 400，而密文絕不會被回傳。刻意失敗封閉是有意為之：把一份讀不懂的
內容轉送出去，只會讓子任務拿到一個空指示，卻自信滿滿地給出錯誤答案。

## 為什麼會這樣

![兩條線路比較同一次委派。在 v1 上，ChatGPT 父任務透過 OpenCodex 送出明文任務，跨越供應商邊界，路由過的子任務讀取它。在 v2 上，父任務送出由 ChatGPT 後端鑄造的 encrypted_content；OpenCodex 無法解密它，任務因此停在供應商邊界，請求以 unreadable_encrypted_agent_task 失敗。](../../../../assets/subagent-v2-encrypted-task.svg)

在 v1 上，父任務把子任務以純文字送出。OpenCodex 讀取它、路由它，路由過的子
任務就收到一份能執行的內容。

在 v2 上，父任務把任務包成 `encrypted_content`，由 ChatGPT 後端鑄造。金鑰留
在該後端裡。OpenCodex 從未擁有它，所以 proxy 沒有東西可以解密，也沒有東西可
以改寫——那個值真的就是密文，不是被某個旗標蓋住的明文。這正是為何這個問題是
結構性的，而不是設定錯誤，也是為何沒有任何 proxy 端的設定能修好它。

有三種拓樸不受影響，值得說明一下，因為這能解釋失敗的形狀，而不是讓失敗顯得
莫名其妙：

| 拓樸 | v1 | v2 |
| --- | --- | --- |
| ChatGPT 父任務給路由過的子任務 | 可行 | **失敗** |
| 路由過的父任務給路由過的子任務 | 可行 | 可行 |
| ChatGPT 父任務給 ChatGPT 子任務 | 可行 | 可行——後端可以解密自己鑄造的東西 |

後端永遠讀得懂自己的密文。只有跨越邊界的那一步會壞掉。

## 上游修好了嗎？

還沒，而且真正重要的那一半還沒修。上游已合併
[openai/codex#35845](https://github.com/openai/codex/pull/35845)，它加入了
對明文協作訊息的支援——但那是*接收*端。它處理的是已經產生好的明文；它不會讓
一個 OpenAI 父任務去產生明文。

發送端仍未解決：
[#36376](https://github.com/openai/codex/issues/36376)，在 Windows、macOS 與
Linux 上的 CLI 0.146 到 0.151 版都可重現，以及
[#37197](https://github.com/openai/codex/issues/37197)，它直接點出缺的那一
塊——發送端的交付政策。兩者都沒有維護者的承諾或時程。

OpenCodex 把後果記錄為
[#92](https://github.com/lidge-jun/opencodex/issues/92)，並以「不予處理」關
閉：這個儲存庫裡沒有任何東西能修好它，所以這個 issue 是指向上游工作的指標，
而不是一個等著這裡的維護者處理的任務。

## 三種模式現在各做什麼

| 模式 | 介面 | 何時選它 |
| --- | --- | --- |
| **v1**（預設） | 每個模型都宣告經典的具命名空間產生工具。產生動作可以直接指名另一個模型。 | 任何跨供應商委派的人。這是出貨時的預設值。 |
| **base** | 上游的模型釘選：Sol 與 Terra 使用 v2，Luna 使用 v1，未釘選的模型跟隨 Codex 自己的旗標。 | 你想要 Codex 原本設計的每模型介面，而且你只在單一供應商內部委派。 |
| **v2** | 每個模型都宣告扁平的並行工具。 | 你想要較新的並行工作階段模型，而且你的父任務與子任務位在邊界的同一側。 |

base 之所以排在第二而不是第一，是因為它的釘選把 Sol 與 Terra——大家最常*從*
它們委派出去的兩個模型——放在 v2 上。對這個問題來說，base 不是一個折衷設定；
對一次 ChatGPT 到路由模型的產生動作而言，它的行為就跟 v2 一樣。

## 若你已經選了 base 或 v2

不會有任何東西替你改變。升級到出貨這個預設值的版本，不會改寫既有設定；儀表
板只會提醒一次，然後等你回答。

- **Continue** 保留你目前所在的模式，並停止再問。
- **Switch to v1** 套用 v1，並停止再問。

不論哪個答案都會被記錄下來，提醒不會再出現。若不回答就把它關掉，下次打開儀
表板時它還會再問一次。

模式變更套用在**新**的 Codex 工作階段。選好之後請開一個新工作階段；若某個長
時間執行的 App host 仍顯示舊介面，請執行 `ocx sync` 並重新啟動該介面。

## 若你仍然想要 v2

依照大多數人應該嘗試的順序，有四條路：

1. **讓 ChatGPT 留在 v1。** 在 v2 內部，`keepNativeChatGptOnV1` 開關會讓 Sol
   與 Terra 留在 v1 介面上，讓它們仍能產生 Grok 或 Claude，而路由過的父任務
   則使用 v2。這是最接近「兩者兼得」的做法。
2. **在單一供應商內部委派。** 路由過的父任務產生路由過的子任務，在 v2 上是
   明文，運作正常。
3. **信任一條使用金鑰驗證的直連 Responses 中繼。** 你明確標記
   `allowEncryptedV2AgentTasks: true` 的供應商，會收到不透明的內容而不是
   400。只在你確定該目的地能消化它時才這麼做。
4. **啟用 `agentTaskRecovery`。** 實驗性功能，預設關閉。它能透過 ChatGPT 後
   端恢復大多數全新的產生動作，代價是配額、延遲，以及依賴未記載的行為，而且
   它仍然會遺失訊息類型的後續內容與多部分信封。

各項機制的完整細節見[子代理介面](/zh-tw/guides/sub-agent-surface/)，設定本身見
[Agent 設定](/zh-tw/reference/configuration/agents/)。

## 本頁何時會消失

一旦某個上游版本讓 ChatGPT 原生父任務把路由過的子任務的內容以明文送出，這個
預設值存在的理由就會隨之消失。到那時，預設值會改回 base，確認訊息會停止出
現，而本頁會變成歷史紀錄，而不是建議。

## 更改模式

Dashboard、Models 與 Subagents 都帶有相同的 v1/base/v2 切換開關，三者都會在
切到 base 或 v2 之前先問。從 CLI：

```bash
ocx v2 status
ocx v2 mode v1
```

CLI 不會跳出確認。這是同一個設定，請在了解本頁所述內容之後再做選擇。
