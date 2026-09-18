---
title: MiniMax 用戶端
description: 在不外洩 MiniMax 憑證的前提下，讓 MiniMax Code 與 MiniMax CLI 的文字指令透過 OpenCodex 路由。
---

MiniMax 發布了兩款不同的命令列產品。OpenCodex 在各自實際暴露出來的協定邊界上分
別整合它們：

- **MiniMax Code**（`mcode`）是一個搭配自訂 Anthropic Messages 供應商的編碼代理。
- **MiniMax CLI**（`mmx`）是一個多模態平台 CLI。只有它的 `text` 資源使用
  OpenCodex 能路由的 Anthropic 相容 API。

## MiniMax Code

請先照 MiniMax 的說明安裝並登入 MiniMax Code。接著啟動 OpenCodex，並連接可還
原的檔案整合：

```bash
ocx start
ocx integration client enable --client mcode
ocx mcode
```

![以隔離的範例資料展示 MiniMax Code 整合](/screenshots/minimax-code-integration.png)

這項整合會把一個區塊合併進 `~/.minimax/config.yaml`：

```yaml
custom_provider:
  opencodex:
    name: OpenCodex
    kind: custom
    enabled: true
    api: anthropic-messages
    options:
      apiKey: opencodex-loopback
      baseURL: http://127.0.0.1:10100
      authMode: api-key
    models:
      anthropic/claude-opus-5:
        limit:
          context: 1000000
```

實際產生的模型清單，以及其中已知的情境視窗與效度階梯，都來自正在執行中的
OpenCodex 目錄。沒有權威情境視窗或效度階梯的模型會省略該欄位，而不是給一個用
猜的值。MCode 會把目前選取的效度保留在工作階段中，所以 OpenCodex 匯出
`effortOptions` 時不會覆寫該選擇。這個區塊不會寫入真正的金鑰，不會取代
`defaultModel`，也不會更動你的 MiniMax 登入狀態。在 MCode 中，請在
`custom_provider:opencodex/...` 底下選擇模型。

`ocx mcode` 會先確認這個供應商指向的正是目前正在執行的 proxy，才會啟動用戶
端。一次性啟用之後，當連接埠或目錄能力改變時，`ocx sync` 會刷新這個由
OpenCodex 擁有的區塊。自動同步絕不會建立無主的區塊、絕不會重新建立你已移除的
區塊，也絕不會覆寫在 OpenCodex 寫入之後又被改動過的檔案；當你確實想要重新連接
時，請使用 enable 指令。停用或還原它，一律走同一套具稽核紀錄的整合系統：

```bash
ocx integration client disable --client mcode
ocx integration client history --client mcode
ocx integration client restore --op <opId> [--confirm-drift]
```

`MINIMAX_DATA_DIR` 與舊版的 `MAVIS_DATA_DIR` 都會被遵循。相對路徑的覆寫會被
拒絕，因為 OpenCodex 與 MCode 可能在不同的工作目錄下啟動。

## MiniMax CLI（`mmx`）

請另外安裝官方 CLI：

```bash
npm install -g mmx-cli
mmx --version
```

用這個包裝程式與一個 OpenCodex 模型 id，把文字指令透過 OpenCodex 路由：

```bash
ocx mmx text chat \
  --model anthropic/claude-opus-5 \
  --message "Explain this function"

ocx mmx --output json text chat \
  --model openai/gpt-5.6-sol \
  --message "Return a JSON summary"
```

MMX 把 `/anthropic/v1/messages` 寫死在它的 API base URL 之下。這個包裝程式會
在子程序的生命週期內啟動一個暫時的迴路橋接器。它只接受送往這個 Messages 路徑
與 `/anthropic/v1/messages/count_tokens` 的 POST 請求，並把它們對應到
OpenCodex 既有的 `/v1/messages` 與 `/v1/messages/count_tokens` 資料平面，同時
保留請求主體與查詢資料。OpenCodex 既有的請求轉換、用量計費與已設定的下游供應
商驗證仍然生效；供應商會依其設定收到 `x-api-key` 或 bearer 傳輸。串流會保留
Anthropic 的訊息與內容事件。在轉送之前，橋接器會移除傳入的准入憑證標頭，並固
定使用公開的 `opencodex-loopback` 佔位值。它不會代理任意的 Anthropic 資源，
而且這個橋接器絕不會暴露到迴路以外。

這個包裝程式還會建立一個只含有該佔位值的暫時 `MMX_CONFIG_DIR`，並在 `mmx` 結
束後刪除它。你的 `~/.mmx/config.json`、OAuth token 與 MiniMax API 金鑰絕不會
被讀取或複製。

以下限制是刻意設計的：

- 只有 `text chat` 與 `text repl` 會透過 OpenCodex 路由。
- 包裝程式會拒絕 `--api-key`、`--base-url` 與 `--region`，避免呼叫端的憑證或
  目的地選項與這個隔離的橋接器互相衝突。
- 這個包裝程式僅限迴路，因為 MMX 無法對遠端繫結送出 OpenCodex 專屬的
  `x-opencodex-api-key` 准入標頭。
- 對 `image`、`video`、`speech`、`music`、`vision`、`search`、`quota`、
  `auth`、`config`、`file` 與 `update`，請直接執行原生 `mmx`；那些呼叫的是
  MiniMax 專屬的 API，OpenCodex 並不模擬它們。

`mmx` 的文字模型預設是 `MiniMax-M3`。當你想要指定某個 OpenCodex 路由時，請帶
上 `--model <provider/model>`；否則就由一般的 OpenCodex 模型路由規則決定該預
設 id 是否可用。
