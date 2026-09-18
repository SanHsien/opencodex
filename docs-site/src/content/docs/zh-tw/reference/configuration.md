---
title: 設定參考
description: opencodex 存放設定檔的位置、編輯方式的套用規則，以及每個設定領域的連結。
---

opencodex 把持久化設定存放在 `$OPENCODEX_HOME/config.json`，通常是
`~/.opencodex/config.json`。在 Windows 上預設為
`%USERPROFILE%\.opencodex\config.json`。

## 編輯設定的方式

依任務選擇合適的編輯管道：

- **儀表板：** 使用 Web UI 進行引導式的 provider、模型、agent、存取與儲存設定。
- **CLI：** `ocx init` 建立初始檔案，`ocx provider`、`ocx models`、`ocx combo`、
  `ocx agent`、`ocx config` 等命令會更新或檢查各自擁有的設定。
- **檔案：** 對沒有專用 UI 或 CLI 命令的欄位，直接編輯 `config.json`。檔案必須維持
  有效的 JSON。

儀表板、管理 API 與會變更狀態的 CLI 命令都會持久化到同一個檔案。優先使用這些管道，或在
手動編輯前先停止代理。執行中的程序會把設定存放在記憶體中，之後的即時儲存可能用其快照
覆寫手動編輯的內容。對於 `claudeCode` 與 listener 繫結欄位，即時儲存會合併外部編輯——這些
路徑有明確的衝突保護，但該保護並非涵蓋每個子樹。

如果檔案無法解析，opencodex 會把它備份為 `config.json.invalid-<timestamp>`、在 console
警告，並以預設值啟動。檔案缺失時也使用全新安裝的預設：一個 `openai` forward provider。

## 優先順序與預設值

### Provider 與模型別名

別名是選用的短請求名稱。它們絕不改變送往上游的原生模型 id，省略每一個別名欄位會完整保留既有路由。

```jsonc
{
  "providers": {
    "openrouter": {
      "alias": "or",
      "modelAliases": { "anthropic/claude-opus-5": "opus" },
      "defaultAliases": true
    }
  },
  "defaultModelAliases": false
}
```

別名比對不分大小寫。模型別名可寫成 `or/opus`，或在全域唯一時寫成裸 `opus`；有歧義的裸別名會回報其限定候選項。Codex 模型選擇器會顯示限定別名，同時保留原本的 `provider/model` 路由 id。某個 provider 的 `defaultAliases` 值會覆寫 `defaultModelAliases`。當同一個 provider 中有多個模型符合同一個模式時，內建別名會被跳過。

### Cursor effort 列

`cursorEffortRows` 是選用的布林值，預設為 `false`。啟用後，原始的 OpenAI 風格 `/v1/models` 清單會為 Cursor Private Inference 在其已安裝的 effort 表中找不到對應的、支援 reasoning 的模型加上 `<base-id>--<effort>` 選擇器。選擇一個產生出來的列，會路由到基礎模型並套用該列的 effort；Cursor 已經認得的模型不會產生變體。這個旗標會保留一個結尾的 `--<declared-effort>` 後綴供產生的選擇器使用，除非完整的值本身已經是已知的設定模型 id。此設定變更後，Cursor 可能需要重新整理模型清單或重新啟動。

### Fast 列

`fastRows` 是選用的布林值，預設為 `true`。原始的 OpenAI 風格 `/v1/models` 清單、Claude Code 探索與用戶端設定匯出（包含 pi、OpenCode、OMP、Hermes、OpenClaw、Kimi、gjc、DSH、MCode、ZCode、Prime、Aside、Raycast 與 omo）會為每個已解析出的 Fast 政策合格的模型，加上一個 `<base-id>--fast` 選擇器。選擇其中一個會路由到基礎模型，並要求 `priority` 服務層級——與 Codex app 透過其選擇器切換所公開的 Fast 相同。基礎列仍會保留，所以這是新增而非取代。

設定 `"fastRows": false` 可隱藏產生的 Fast 選擇器。格式錯誤的值同樣會停用它們。請重新整理用戶端模型清單，或重新產生／重新整理既有的受管用戶端設定，以取得新項目。已連線的用戶端使用服務端 proxy 的可用性中繼資料；沒有該中繼資料的較舊 proxy 不會取得猜測出的 Fast 項目。Codex 保留自己原生的 Fast 切換開關。

後綴是 `--fast`（兩個連字號），因為結尾的 `-fast` 在多個 provider（`grok-4-fast`、`glm-5.3-fast` 與 Cursor 自己的 fast 變體）已經是真實的模型 id，單一連字號無法區分產品與層級。確切設定的模型 id 永遠勝過產生的後綴，同時帶有這個標記與 effort 標記的 id 兩者都不會解析。

只有在該層級真的能被履行時，該列才會出現：若某個模型的 provider 不支援它，或只在該路由用不到的線路上支援它，就不會產生該列。`fastMode: false` 仍會全域抑制 Fast，且優先於已選定的列；而某個選擇器對應的模型之後失去資格時，會降級為一般請求而不是失敗。

原生模型多一項條件：除了合格的政策之外，上游還必須為該模型宣告 Fast 層級。這與 Codex 選擇器本身切換開關所依據的證據相同，所以這兩個介面對哪些原生模型有 Fast 不會有分歧。

範圍：這涵蓋負責服務請求的介面——`/v1/models`、Claude Code 探索，以及 `/v1/responses`、`/v1/chat/completions`、`/v1/messages`、`/v1/messages/count_tokens` 與 `/v1/responses/compact` 端點，加上 `ocx export`、受管用戶端整合，以及 OpenCode 啟動器。停用 Fast 列之後，請重新整理已儲存的用戶端設定，並改選基礎模型，而不是先前儲存的 Fast 選擇器。

`config.json` 中的有效值會覆寫內建預設。缺失的選用欄位使用各領域頁面記載的預設值。
`OPENCODEX_HOME` 優先於預設的設定目錄。接受環境變數引用的欄位（例如
`apiKey: "${PROVIDER_API_KEY}"`）會在請求時解析該變數。對出站代理，已設定的 `HTTP_PROXY`
或 `HTTPS_PROXY` 優先於頂層 `proxy` 欄位。

路由有自己有序的解析規則；見[路由](/reference/configuration/routing/)。

## 設定領域

- [Providers](/reference/configuration/providers/) — provider 條目、認證、端點、
  目錄、allowlist、context 限制、配額與 provider 專屬選項。
- [路由](/reference/configuration/routing/) — `defaultProvider`、模型解析順序、
  combos、別名與 combo effort 預設值。
- [Agents](/reference/configuration/agents/) — multi-agent 模式、委派指南、
  fallback 模型、原生預設同步與 effort 上限。
- [伺服器與執行環境](/reference/configuration/server/) — listener 與遠端存取、
  admission key、逾時、儲存、sidecars、啟動行為與 shadow calls。

## 不要把 secret 放進檔案

API key 優先使用 `${ENV_VAR}` 引用。字面 `apiKey`、`apiKeyPool[].key` 與
`apiKeys[].key` 值都是 secret；不要 commit、貼進 log 或分享。OAuth 與 forward provider 的
token 存放在個別的憑證儲存中，而非 `config.json`。帳號 id 與信箱也應保持私密；在支援的
地方使用公開的 selector 別名。

:::note[原子寫入]
opencodex 透過臨時檔加上重新命名（`atomicWriteFile`）寫入受管的 `config.toml` 與
`opencodex-catalog.json`。當 `ocx stop` 與代理的 shutdown handler 這類同時寫入者
一起恢復 Codex 時，這可避免只寫了一半的檔案。
:::
