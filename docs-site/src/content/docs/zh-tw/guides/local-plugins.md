---
title: 本機外掛
description: 在啟動時把你自己的程式碼載入 proxy，改寫對供應商的送出請求，例如在供應商前面放一個本機壓縮 proxy。
---

本機外掛是一個 TypeScript 或 JavaScript 檔案，`ocx start` 會在 proxy 開始服務前載入它。它可以在每一次
對供應商的送出請求離開程序之前看到它，並重新導向或加上標頭——足以在不修改 opencodex 本身的情況下，把本機
sidecar（壓縮 proxy、錄製器）放在供應商前面。

外掛只屬於單一安裝。opencodex 不會下載、更新或簽署它們。

## 外掛放在哪裡

把外掛檔案放在 opencodex home 內的 `plugins/`（`~/.opencodex/plugins/`；設定了 `$OPENCODEX_HOME` 時為
`$OPENCODEX_HOME/plugins/`）：

```text
~/.opencodex/plugins/
  my-sidecar.ts
```

- 副檔名為 `.ts`、`.js` 或 `.mjs` 的檔案會依名稱順序載入。
- 以 `.` 或 `_` 開頭的名稱，以及 `*.d.ts`，會被忽略——把外掛改名為 `_my-sidecar.ts` 即可停用。
- 這個目錄是選用的。沒有它就不會載入任何東西。
- 外掛會帶著你的憑證在 proxy 內執行，因此 opencodex 會拒絕屬於其他使用者、或群組／其他人可寫入的外掛檔案或
  `plugins/` 目錄，也會拒絕符號連結。`plugins/` 以上直到 `/` 的每一層目錄，也必須屬於你或 root，且群組與其他人
  不可寫入，除非它像 `/tmp` 一樣設有 sticky 位元。用 `chmod go-w ~/.opencodex/plugins ~/.opencodex/plugins/*`
  修正權限；預設 umask 是 `002` 的系統，也請檢查上層目錄。在 macOS 上，授予其他使用者或群組、且能寫入、刪除、
  變更權限，或新增／移除路徑項目的 ACL，即使模式是 `0600` 也會擋下載入；請用 `/bin/ls -lebd -- <path>` 檢查路徑
  本身。唯讀、deny、僅繼承，以及只授予路徑擁有者或執行使用者的授權不會擋下載入。`root` 或 `0` 這類 ACL 顯示名稱
  不會被當成數字 UID 的證明。在 Linux 上，安裝了 `getfacl` 時會檢查延伸 ACL；沒有它則只驗證擁有者與模式位元。
- 在 Windows 上，自動載入外掛會一直停用，直到有可用的 ACL 信任檢查。

新增、變更或移除外掛後請重新啟動 proxy（`ocx service restart`，或停止後重新啟動 `ocx start`）。每個載入成功的外掛
會在啟動時印出一行 `Plugin loaded: <name>`；被略過的外掛會印出有界的原因類別。外掛的原始例外文字絕不會自動印出。

若要這一次不載入外掛就啟動，請設定 `OCX_PLUGINS=0`。

## 撰寫外掛

外掛預設匯出一個物件，含選用的 `name` 與一個 `setup` 函式。`setup` 會收到一個 context。非同步的 `setup` 有五秒可以
完成；外掛在 proxy 自己的執行緒內執行，因此同步阻塞的 `setup` 無法被中斷，並會延遲啟動直到它回傳。逾時的
`setup` 也不會被停止：它已經啟動的伺服器或計時器會繼續執行，所以長期存活的資源請在可能失敗的工作之後才啟動。

```ts
interface UpstreamTarget {
  url: string;            // absolute upstream URL; assign a new one to redirect
  headers: Headers;       // outbound headers, including credentials — never log them
  readonly transport: "http" | "websocket";
}

export default {
  name: "my-sidecar",
  setup(ctx: {
    log(message: string): void;
    registerUpstreamRewriter(rewrite: (target: UpstreamTarget) => void): void;
    onShutdown(teardown: () => void): void;
  }) {
    ctx.registerUpstreamRewriter(target => {
      const upstream = new URL(target.url);
      if (!upstream.pathname.endsWith("/chat/completions")) return;
      target.url = `http://127.0.0.1:9000${upstream.pathname}${upstream.search}`;
      target.headers.set("x-original-origin", upstream.origin);
    });
  },
};
```

Context 也帶有 `name`、`configDir`（opencodex home）與 `pluginDir`。

外掛不能匯入 opencodex 的模組——在封裝後的執行檔中它們不在磁碟上。請像上面那樣，在本機宣告你需要的小型介面。

## 改寫的行為

- 改寫器會在 opencodex 選定傳輸方式之後，對每一次經由 HTTP 的供應商送出請求，以及 Codex WebSocket 連線同步執行。
  請保持它快速；網路檢查（健康探測）請在背景進行，並在改寫器中讀取快取的結果。
- 被重新導向到 loopback 位址（`127.0.0.1`、`::1`、`localhost`）的送出請求會直接連線——不論是 HTTP 還是 Codex
  WebSocket——並忽略供應商 proxy 與 `HTTP_PROXY`：其他地方的 proxy 無法連到這台機器的 loopback。任何其他目的地都
  依一般的 egress 設定（包含 `NO_PROXY`），以改寫後的 URL 評估，兩種傳輸皆然。
- Codex WebSocket 的改寫器會在每一回合、重用閒置的連線池 socket 之前執行；socket 只會在目的地與改寫後的標頭都相同時
  重用，但 `x-codex-turn-state` 與 `x-codex-turn-metadata` 這兩個每回合標頭除外。它們隨每個請求 frame 傳送，同一個
  socket 上的不同往返可以不同；改寫器對它們所做的變更會被丟棄。外掛開始或停止重新導向，會在下一回合生效。
- 它在 opencodex 選好供應商、帳號與路由之後才執行，因此不會改變路由、帳號選擇、重試或請求記錄。
- 被重新導向的送出請求會前往你選擇的主機。那台主機看到的請求與供應商看到的完全相同，包含憑證。
- 如果改寫器擲出例外，opencodex 會還原該改寫器對這次送出請求的編輯，並在該程序剩下的時間停用它。在它之前執行的改寫器
  所做的編輯會保留，所以送出的請求就是它們留下的樣子（只有一個外掛時則是未修改）。如果 `setup` 擲出例外或逾時，該外掛
  會被略過，它註冊的所有東西都會被移除，且它之後的註冊嘗試會被忽略；其他外掛與 proxy 照常啟動。
- 存在但無法讀取（例如權限錯誤）的外掛目錄會在啟動時回報，而不是被當成空的。
