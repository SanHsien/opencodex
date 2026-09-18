---
title: Factory Droid 橋接器
description: 透過一個本機的 Responses 相容橋接器，把 Factory Droid 的模型連上 opencodex。
---

Factory Droid 是一個代理執行環境，不是一份有文件記載的、與 OpenAI 相容的推論
端點。如果一個指向 Factory 內部 LLM URL 的自訂供應商回傳 `403 Forbidden`，光
改動 opencodex 的轉接器，或加上供應商標頭，都不會讓那條私有路由變成一個受支
援的公開 API。

可行的整合方式是：

```text
Text-only Responses client
  -> opencodex (http://127.0.0.1:10100/v1/responses)
  -> local Responses bridge (http://127.0.0.1:11435/v1/responses)
  -> official droid exec command
  -> Factory account and selected model
```

這樣可以讓 Factory 的憑證留在官方 Droid 用戶端內部。OpenCodex 收到的是一把
分開的、僅限本機的橋接器 token。

## 失敗的地方與原因

| 症狀 | 原因 | 修法 |
| --- | --- | --- |
| Factory LLM URL 回傳 `403 Forbidden` | 這個 URL 不是給第三方用戶端使用、有文件記載的通用 OpenAI 端點 | 透過官方 Droid CLI 或 SDK 呼叫 Factory |
| `/models/models` 回傳 `404` | 供應商的 base URL 已經以 `/models` 結尾 | 把 `baseUrl` 設成 API 根路徑；絕不要包含探索路徑 |
| 模型搜尋失敗 | 橋接器沒有公開一份完整的即時目錄 | 設定 `liveModels: false`，並提供一份靜態的 `models` 清單 |
| 迴路供應商被拒絕 | 預設會拒絕私有網路存取 | 只對這個迴路橋接器設定 `allowPrivateNetwork: true` |
| `${DROID_BRIDGE_TOKEN}` 未解析 | opencodex 服務環境中缺少這個變數 | 把它注入服務行程本身，而不只是互動式 shell |
| `OutputTextDelta without active item` | 橋接器在開啟輸出項目與內容片段之前就送出了文字差量 | 依序送出完整的 Responses SSE 生命週期 |

因此，同一把 Factory 憑證可以在 `droid exec` 裡正常運作，而直接對一個沒有文
件記載的 LLM URL 發出請求仍會回傳 `403`。這兩個結果測試的是不同的產品，不應
被視為互相矛盾。

## 先決條件

1. 安裝並登入 [Droid CLI](https://docs.factory.ai/droid-cli/quickstart)。
2. 確認一次有邊界的無頭請求能運作：

   ```bash
   droid exec --model glm-5.2 --output-format json "Reply with DROID_OK only."
   ```

3. 執行一個會呼叫 `droid exec`（或官方 Droid SDK）的本機橋接器，並公開：

   - `GET /healthz`
   - `GET /v1/models`
   - `POST /v1/responses`

Factory 把 `droid exec` 記載為它的非互動式自動化介面，並建議在腳本中使用
JSON 輸出。對於較長期的整合，Factory 也在
[Droid Exec 指南](https://docs.factory.ai/droid-exec/overview)中記載了串流
JSON-RPC，以及官方的 TypeScript 與 Python SDK。

## 橋接器契約

把橋接器繫結到 `127.0.0.1`，要求一個隨機產生的 bearer token，限制請求大小上
限，並對模型 ID 使用允許清單。這個最小化的橋接器只接受下列 Responses
`input` 形狀：

- 一個非空字串；或
- 一個只含 `message` 項目的陣列。每個訊息都必須有 `user`、`developer`、
  `system` 或 `assistant` 角色，內容則是字串，或只含文字的內容片段（輸入角
  色用 `input_text`，assistant 歷史用 `output_text`）。

在呼叫 Droid 之前，請驗證完整的請求。若某個輸入片段是圖片或檔案、`tools`
包含任何工具定義，或 `input` 包含工具呼叫或結果（`function_call`、
`function_call_output`、`custom_tool_call` 或
`custom_tool_call_output`），請回傳 HTTP `400`，並附上 Responses 風格的
`invalid_request_error`。請使用一個穩定的橋接器專屬代碼，例如
`unsupported_bridge_input`，並在訊息中指出被拒絕的欄位。請在開始 SSE 之前就
這麼做，即使 `stream: true` 也一樣；絕不要把不支援的內容丟棄、字串化，或攤平
塞進提示詞裡。

```json
{
  "error": {
    "type": "invalid_request_error",
    "code": "unsupported_bridge_input",
    "param": "tools",
    "message": "The minimal Droid bridge does not accept tool definitions."
  }
}
```

對於一個被接受的請求，橋接器應該：

1. 把被接受的 Responses `input` 轉換成一個提示詞；
2. 呼叫 `droid exec --model <id> --output-format json <prompt>`；
3. 解析最終的 `result` 與 `session_id`；
4. 回傳一個 OpenAI Responses 信封；並且
5. 在需要延續對話時，把 `previous_response_id` 對應到 Droid 的
   session ID。

對於串流回應，請依序送出下列生命週期：

```text
response.created
response.output_item.added
response.content_part.added
response.output_text.delta
response.output_text.done
response.content_part.done
response.output_item.done
response.completed
```

不要把橋接器公開在 `0.0.0.0` 上，也不要把 Factory 的憑證重複用來當橋接器的
bearer token。

## OpenCodex 供應商設定

用明確的供應商 ID `droid` 建立這個自訂供應商：

```bash
ocx provider add droid \
  --adapter openai-responses \
  --base-url http://127.0.0.1:11435/v1 \
  --default-model glm-5.2 \
  --allow-private-network
```

這會建立 `providers.droid` 設定項目。在儀表板中，打開
**Providers → droid → Edit JSON**，把該供應商的值換成：

```json
{
  "adapter": "openai-responses",
  "baseUrl": "http://127.0.0.1:11435/v1",
  "responsesPath": "/responses",
  "allowPrivateNetwork": true,
  "authMode": "key",
  "apiKey": "${DROID_BRIDGE_TOKEN}",
  "liveModels": false,
  "models": ["glm-5.2", "glm-5.2-fast", "kimi-k3"],
  "defaultModel": "glm-5.2"
}
```

這些模型 ID 只是範例。請只保留已登入的 Factory 帳號、`droid exec` 能實際使
用的那些模型。不要替這個供應商加上 Factory 專屬的推論標頭：它的上游是這個本
機橋接器，不是一個 Factory HTTP 端點。

儲存供應商，或變更它的靜態目錄之後，請同步並重新啟動 Codex，讓新的工作階段
讀到更新後的目錄：

```bash
ocx sync --restart-codex
ocx doctor
```

`--restart-codex` 會重新啟動相符的 app-server，並完整結束、重新啟動 Codex 桌
面 app，這會結束進行中的對話。若想讓桌面 app 保持執行，請用
`--restart-app-server-only`。請等那些工作階段結束或儲存之後，再執行這個重新
啟動。

## 驗證整條路由

分別檢查每一個邊界：

```bash
curl -fsS http://127.0.0.1:11435/healthz
ocx doctor
ocx access test droid/glm-5.2 --protocol responses
```

一列供應商，或選單裡的一個模型項目，只能證明目錄可見，不能證明整合可行。只
有當 Responses 探測透過 `droid/<model>` 這條路由回傳時，整合才算真的在運
作。

## 目前的限制

上面這個最小化橋接器，翻譯的是文字內容與 Responses SSE 生命週期。它**沒有**
實作完整的雙向 Codex function／工具呼叫協定。Codex App 與 `codex exec` 通常
會送出工具定義，即使提示詞說不要呼叫工具，而目前的 Codex CLI 也沒有一個通用
旗標能移除那些定義。這個最小化橋接器必須用上面的 `400` 契約拒絕那些請求。工
具定義、工具呼叫、工具結果、權限、取消，以及豐富的 Droid 事件，都需要一個建
立在 Factory 的串流 JSON-RPC 模式，或官方 Droid SDK 之上的有狀態橋接器。請
把 `ocx access test` 的成功，視為文字路徑的驗證，而不是 Codex agent 或工具
路徑的驗證。
