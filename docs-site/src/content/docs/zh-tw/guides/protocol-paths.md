---
title: 協定路徑
description: Responses、Chat Completions 或 Messages API 上的請求如何送達供應商、如何預覽與追蹤該路徑，以及會改變它的分階段開關。
---

opencodex 提供三種用戶端 API：**Responses**（`/v1/responses`）、**Chat Completions**
（`/v1/chat/completions`）與 **Messages**（`/v1/messages`）。每個供應商都只接收一種由其適配器決定的上游線路格式。當用戶端 API 與上游線路格式不同時，請求會在送出時轉換、回應會在送回時轉換回來。本頁說明這條路徑如何命名、如何在請求前後查看它，以及哪些設定會改變它。

本頁的每個設定預設都是關閉的。維持預設值時，請求的傳送方式與這些設定出現之前完全相同。

## 傳送模式

路徑是從用戶端 API 到上游線路格式的一串中繼站。中繼站包括三個 API 名稱、`ir`（opencodex 與適配器無關的請求／事件格式），以及 `responses-internal`（只作為內部橋接產生、用戶端永遠看不到的 Responses JSON 或 SSE）。

| 模式 | 意義 | 範例請求路徑 |
| --- | --- | --- |
| `native` | 兩端使用相同 API；供應商收到的就是用戶端傳來的內容 | `chat > chat` |
| `translated` | 經由目標線路格式的編解碼器或 IR 轉換一次 | `chat > responses`、`responses > ir > messages` |
| `legacy-bridge` | 先經由內部 Responses 格式轉換 | `chat > responses-internal > ir > messages` |
| `blocked` | 在送出任何內容之前就被拒絕 | 無 |

`native` 描述的是請求如何傳送，不是相容性的判定：走 native 路徑的請求仍可能遇到拒絕某個欄位的供應商，Compatibility Lab 的驗證結果是另一件事。

在所有開關都關閉時，符合資格的單一供應商路由會採用以下路徑：

| 用戶端 API → 上游 | 路徑 |
| --- | --- |
| Responses → Responses | native |
| Responses → Chat 或 Messages | 經由 IR 轉換 |
| Chat → Chat | native（用戶端傳送 `stream: false` 時為 JSON） |
| Chat → Responses、Messages → Responses | 經由 Responses 編解碼器轉換 |
| Chat → Messages、Messages → Chat | legacy bridge |
| Messages → Messages | 僅當呼叫者轉發自己的 Anthropic 憑證時為 native；使用 opencodex 管理的金鑰時為 legacy bridge |

除非下方開關另有說明，組合（Combos）、路由策略，以及合成的 effort 或 fast model 列，來自 Chat 與 Messages 時都會走 legacy bridge。

## 功能影響

有些請求功能無法在每次轉換後存活。例如 Chat 欄位 `n`、`logprobs`、`logit_bias`、`seed`、`audio` 與 `prediction` 在 Responses 主體中沒有對應位置，Messages 的 `top_k` 欄位在轉往 Responses 時會被捨棄。opencodex 會將每個這類影響記錄為
`passthrough`、`translated`、`degraded` 或 `unsupported`（在儀表板顯示為 *Dropped*）。這些是從轉換器程式碼中宣告出來的,不是量測結果。

## 預覽路徑

預覽僅根據你的設定計算,不會送出任何內容給任何供應商,不會推進組合輪換,也不會被記錄。

- 儀表板：**API** 頁面的 **Request path preview**。
- CLI：

  ```bash
  ocx api explain --model combo/main --inbound chat --feature request.seed
  ocx api explain --model claude-sonnet-4-5 --inbound messages --json
  ```

預覽會列出每個候選路由的請求路徑、傳送模式、功能影響,以及下方的 `reject` 政策是否會拒絕它。`ocx api protocols --json` 會列出它接受的功能名稱。轉發呼叫者自己 Anthropic 憑證的 Messages 請求會顯示為 `caller-credential-required`,而不會被假設,因為預覽沒有呼叫者。

## 追蹤請求

每個送達供應商的請求,或是在送出前就被拒絕的請求,都會在其日誌列中記錄實際採用的路徑：最終模式與路徑、原因、功能影響,以及每次實際嘗試各一條路徑。在儀表板中,**Logs** 會顯示路徑徽章、**Protocol path** 篩選器,以及請求詳情中的 **Protocol path** 區塊。較舊的紀錄沒有路徑資料,並會如此標示;不會猜測。

## 無法表示的功能

`protocols.unrepresentable` 決定當請求帶有其路徑會捨棄的功能時該怎麼處理：

- `legacy`（預設）：請求照常送出,遺失的部分只會出現在追蹤紀錄的功能影響中。
- `reject`：請求會在送出任何內容之前以 HTTP 400 拒絕,只會指名功能鍵。Chat 回應
  `invalid_request_error`,代碼為 `unsupported_feature`;Messages 回應
  `invalid_request_error`。追蹤紀錄會是 `blocked`。

在 `reject` 下,直接路由一旦確定供應商與線路格式,就會在入口處被判定。組合與策略不會在入口處被判定;開啟 `nativeChatCombos` 時,Chat 組合會逐一判定每個候選項並略過無法承載該請求的候選項。

## 分階段開關

這些開關用於分階段導入新路徑。每個預設關閉,關閉的開關不會改變任何行為。

| 開關 | 開啟時的效果 |
| --- | --- |
| `nativeChatCombos` | 組合中符合資格的 Chat 候選項會以自己那份用戶端主體的副本以 native 方式送出;其餘候選項維持橋接。 |
| `managedMessagesNative` | 當路由是直接、以金鑰驗證的 Anthropic 供應商時,Messages 請求會以 Messages 而非橋接方式送出。需要僅限橋接行為的路由（固定 effort、被封鎖技能的省略、web-search 邊車、視覺前處理、合成列）仍維持橋接。 |
| `managedMessagesNativeOAuth` | 針對未納入帳號池的 `anthropic` OAuth 供應商於 `api.anthropic.com` 上啟用 native Messages。只在與 `managedMessagesNative` 一起啟用時才有效;納入帳號池的 Anthropic OAuth 帳號集仍維持橋接。 |
| `directEncoders` | 對於非 Responses 上游,回覆 Chat 或 Messages 用戶端時會直接從適配器的事件編碼,而不經由內部 Responses 串流。請求端不受影響。 |
| `shadowPlan` | 每個 Chat 或 Messages 請求結束時,會將預覽本應預測的方案與請求實際採用的路徑比較;不一致時會在日誌列的路徑紀錄中加上 `planMismatch: true`。不會送出第二個請求。 |

透過 CLI 或編輯 `config.json` 中的 `protocols` 來變更它們
（[參考文件](/zh-tw/reference/configuration/server/#protocol-paths-protocols)）：

```bash
ocx api policy                                   # 顯示目前政策；不會改變任何內容
ocx api policy --rollout shadowPlan=on           # 變更單一開關
ocx api policy --unrepresentable reject
```

`ocx api policy` 只有在你傳入設定旗標,且實際執行它時才會寫入。

### Shadow plan

`shadowPlan` 是安全的第一步：它不會改變任何請求,只會檢查預覽是否與你實際送出的流量的真實情況一致。比較使用的是請求最終落定的路由（對組合而言,是回應的目標）,並比較傳送模式、上游線路格式與請求路徑。回應路徑不在比較範圍內,因為 `directEncoders` 會改變它,而預覽不會模擬這個開關。由呼叫者轉發的 Messages 請求與 Claude 相容性拒絕不會被比較。Responses 請求也不會被比較。

`planMismatch` 會出現在 `GET /api/logs` 回傳資料列的 `protocolTrace` 中。儀表板目前尚未顯示它。

## 尚未完成的部分

以下路徑仍使用內部 Responses 橋接,或尚未涵蓋：

- Chat 與 Messages 請求在進入 IR 之前,仍會先被解碼成 Responses 格式的主體,即使是走轉換路徑也是如此。
- 路由策略候選項、透過 effort 列到達的組合、`nativeChatCombos` 關閉時的組合候選項,以及 Messages 組合。
- 直接編碼（`directEncoders`）只涵蓋串流傳送中具體、非 Responses 的路由。組合與策略的子項、路由式壓縮、run-turn 適配器（Cursor、Devin、程式碼代理 CLI、CodeBuddy）,以及邊車輪次仍維持橋接。
- 在任何輸出之前就同批失敗的 native Chat 組合候選項不會繼續嘗試下一個候選項;橋接的候選項則會。
- Web search、視覺與圖像產生邊車只在 Responses 管線上執行。
- `previous_response_id`、`store`、`background` 與壓縮仍是 Responses 專屬功能。
- 線路格式不是這三種 API 之一的適配器（Gemini、Kiro、Cursor 及其他）會經由 IR 轉換,不宣告任何功能。
- 未規劃透過 OAuth 使用 native Chat。透過 Anthropic OAuth 使用 native Messages 只涵蓋未納入帳號池的帳號;納入帳號池的帳號集仍維持橋接。
- 受管理的 native Messages 路徑只會從一份簡短的允許清單轉發呼叫者的
  `anthropic-beta` 值,且僅轉發給 `api.anthropic.com`,允許清單以外的頂層欄位會在沒有功能影響記錄的情況下被捨棄,也不會套用
  `claudeCode.stabilizePromptCache`。
