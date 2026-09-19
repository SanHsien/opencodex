---
title: Remote Hub 部署
description: 在 Linux、macOS 或 Docker 上執行單一連接埠的 opencodex hub，涵蓋迴路 companion 監聽器、服務自行發放的資料金鑰、ocx hub invite、僅限迴路的管理入口、Tailscale Serve 與無瀏覽器 OAuth。
---

opencodex hub 把供應商憑證與用量狀態集中保存在一台主機上，讓通過驗證的用戶端從遠端使用它的資料平面。面向瀏覽器的管理平面是分開的：那是一個選用的監聽器，只繫結 `127.0.0.1`，提供儀表板與 `/api/*`，設計上要放在 Tailscale Serve 或其他由維運方自建的 HTTPS 前端後面。

資料平面是**一個連接埠**。遠端機器以自己的 per-client 金鑰連往 `hostname:port`；hub 自己的程序則透過迴路 companion 監聽器，不帶任何憑證連往 `127.0.0.1:<同一個連接埠>`。請從下方的「Linux systemd 或 macOS launchd」一節開始，再用 `ocx hub invite` 把現成指令交給第二台機器。

管理入口從不提供 `/v1/*`、`/healthz` 或 `/readyz`。明確啟用時，Remote Workspace 只准入它配對過、以 bearer 驗證的 agent WebSocket 與一次性配對交換，詳見 [Remote Workspace](/zh-tw/guides/remote-workspace/)。請不要直接發布它的連接埠、不要為它開雲端防火牆規則，也不要使用 Tailscale Funnel。Funnel 是公開網際網路的曝露面，不在本部署模型的範圍內。

啟用管理入口後，本機儀表板指令會開啟 `http://127.0.0.1:<管理連接埠>`，讓位址直接對應僅限 IPv4 的監聽器，不必解析 `localhost`。

## 信任與同意邊界

- 供應商與 OAuth 憑證留在 hub 上。絕不要把它們複製到用戶端、映像層、服務定義、支援封包、螢幕截圖或命令列。
- 資料准入金鑰透過僅擁有者可讀的 `service-api-token` 檔案或 `OCX_API_TOKEN_FILE` 交付。它不是管理憑證。
- 原始的管理 admin token 可以執行一般管理作業，但無法簽發瀏覽器工作階段，也無法授權帶有同意性質的動作（例如為儲存庫按星號）。那些動作需要伺服器簽發的 `gui-session`、相符的瀏覽器 origin 與 CSRF token。
- `Tailscale-User-Login` 只在獨立繫結的管理入口上受信任。同一個標頭出現在公開監聽器上會被忽略。`remoteGui.allowedTailscaleUsers` 控制工作階段的簽發，它不會建立新的通用主體。

## 角色與直接資料流

`standalone` 把資料與管理留在同一台機器上。`hub` 擁有供應商憑證、目錄與用量紀錄。`client` 只保存自己的連線中繼資料與一把 per-client 資料金鑰。Codex 與 Claude 的流量直接從用戶端送往 hub 的資料監聽器，不會經由儀表板或迴路管理中繼通道轉送。

連線時只能使用一種暫時性授權來源。授權從 stdin 讀取，絕不會寫進設定或金鑰檔：

```bash
ocx connect https://hub-name.tailnet-name.ts.net --pairing-code-stdin
ocx connect status
ocx sync
```

供人閱讀的就緒診斷會把目錄值中的控制字元顯示為可見的十六進位跳脫，第一次連線時如此，`ocx sync` 拒絕重新取得的 hub 目錄時也是如此。結構化 JSON 狀態則保留原始的診斷值。

你不必自己拼出那一行。在 hub 上執行 `ocx hub invite` 會鑄造配對碼，並印出要加入的那台機器該執行的完整指令（含兩個 origin）。詳見「邀請另一台機器」。

hub 會自動簽發 per-client 金鑰。用戶端把它寫進既有的、僅擁有者可讀的 `service-api-token`，絕不會寫進 `config.json`。連線期間，用量資料來自 hub 的用量儲存，並過濾成該用戶端穩定的 `apiKeyId`。中斷連線後，用量改用本機儲存。OpenCodex 不會在兩個儲存之間互相同步用量。

以全新的暫時性授權輪替已連線的用戶端：

```bash
ocx connect rotate --pairing-code-stdin
# 或者，只能透過 HTTPS：
ocx connect rotate --admin-token-stdin
```

輪替期間，舊金鑰與新金鑰會在同一個 `apiKeyId` 底下同時有效，最長十分鐘。用戶端會把舊金鑰備份為 `service-api-token.prev`，以原子方式安裝並探測新金鑰，然後才提交。若提交回應不確定，請帶著暫時性授權重跑輪替指令；復原程序會在提交或還原之前同時探測兩個檔案。當復原程序回報兩個候選都被拒絕時，絕對不要刪除其中任何一個檔案。

`ocx disconnect` 是本機動作，在 hub 離線時仍可執行。它會還原本機用戶端狀態，但不會撤銷 hub 上的金鑰。中斷連線後，請到 hub 的 **Integrations → API Keys** 撤銷該金鑰。`ocx connect revoke --admin-token-stdin` 只有在仍然連線時可用，並使用已持久化的 `apiKeyId`，不接受手動指定 id。瀏覽器工作階段的登出／逾期，與資料金鑰的輪替、撤銷、中斷連線是分開的。

### 已連線的用戶端會顯示什麼

`ocx connect` 與 `ocx connect status` 會依選擇順序，對第一個有效的本機 Codex runtime 檢查目錄就緒狀態。偏好的候選失敗時可以退回，但在選定一個有效 runtime 之後，就不再探測優先度較低的替代方案。這項檢查不會更動已儲存的 runtime 選擇。一般的 `ocx status` 仍會為了 runtime 診斷而探索替代方案。

用戶端不保存供應商憑證，也沒有自己的目錄，所以它的本機設定與憑證儲存本來就是空的——而把它們當成事實來讀，會對「hub 能提供什麼」得出一個自信但錯誤的答案。因此在已連線的用戶端上，`ocx status` 會以 `State from hub <origin>` 開頭，並透過資料平面從 hub 取得 OAuth 登入、供應商與可委派模型這幾行，同時把真正描述這台機器的行標記為 `(local)`：proxy、service、Codex 執行檔與 shim，以及本機連接埠。`ocx status --json` 除了 `runtimeRole` 之外還帶有一個 `remoteHub` 區塊，其 `stateSource` 為 `hub`、`cache` 或 `unavailable`，絕不會是用戶端自己的狀態。較舊、尚未提供 `/v1/hub-state` 的 hub 會回報 `unavailable` 並指示你升級 hub，而不是悄悄退回本機登入狀態；用戶端上的 `ocx config show` 也會印出 `_remoteHub` 註記，說明憑證與模型可用性都在 hub 上。這項讀取只使用 per-client 資料金鑰，任何 admin token 與供應商密鑰都不會抵達用戶端。

只有在已儲存的連線仍與狀態快照相符、且資料金鑰檔也與該連線相符時，`ocx status` 才會發出即時的 hub 狀態請求。任一項檢查失敗時，它會略過請求並顯示相符的快取 hub 狀態；沒有相符快取時則顯示 `unavailable`。

## Linux systemd 或 macOS launchd

把資料監聽器繫結到 hub 的 Tailscale 位址，啟用迴路 companion 讓 hub 自己的程序不帶憑證也能連到同一個連接埠，並且把管理平面分開發布。以下數值僅為範例：

```bash
ocx config set runtimeRole hub
ocx config set hostname 100.64.0.10
ocx config set corsAllowOrigins '["http://localhost:10100"]'

# 全新的 standalone 設定沒有 `hub` 或 `remoteGui` 物件，而 `ocx config set` 不會
# 自動建立缺少的父物件：直接寫巢狀路徑會以 `config parent path not found: hub` 失敗。
# 設定 `runtimeRole` 同樣不會建立它。請先建立各個物件，再設定欄位。
ocx config set hub '{}'
ocx config set remoteGui '{}'
ocx config set hub.managementPublicOrigin '"https://hub-name.tailnet-name.ts.net"'
ocx config set hub.dataPublicOrigin '"https://hub-name.tailnet-name.ts.net:8443"'
ocx config set hub.managementIngress '{"enabled":true,"port":10101}'
ocx config set remoteGui.allowedTailscaleUsers '["operator@example.com"]'

# 一個連接埠。遠端機器以自己的金鑰連往 100.64.0.10:10100；hub 自己的本機程序
# 則不帶憑證連往 127.0.0.1:10100，走的是同一個連接埠。
ocx config set unauthenticatedLoopbackListener '{"enabled":true}'

# 沒有金鑰需要匯出：安裝時會發放 hub 自己的資料平面金鑰。詳見下一節。
ocx service install
ocx service status
ocx status                # 「Hub:」區塊會摘要上面每一行的結果
```

若設定確實還是空的，也可以一次寫入整個物件：

```bash
ocx config set hub '{"managementPublicOrigin":"https://hub-name.tailnet-name.ts.net","dataPublicOrigin":"https://hub-name.tailnet-name.ts.net:8443","managementIngress":{"enabled":true,"port":10101}}'
ocx config set remoteGui '{"allowedTailscaleUsers":["operator@example.com"]}'
```

只有在物件尚未存在時才使用這種寫法。整個物件的賦值是**取代**而非合併：對已經含有 `hub.managementIngress` 的設定執行上面那行，該入口會被悄悄丟掉。調整既有設定時父物件已經存在，請逐一設定欄位——巢狀寫法可以運作，而且不會動到其他值。

有兩點決定一行命令能否被接受。值會先以 JSON 解析，失敗才退回原始字串——這就是 URL 要寫成 `'"https://…"'` 的原因，物件、陣列、布林值與數字都必須是合法 JSON。另外 `hub` 與 `remoteGui` 採用嚴格結構，所以鍵名打錯會在寫入當下以 `schema_invalid: hub.<欄位>` 遭拒，而不會變成永遠不生效的設定。`managementPublicOrigin` 與 `dataPublicOrigin` 都必須是不含路徑、查詢與片段的純 origin。

### 資料平面金鑰由服務自行發放

`ocx service install` 之前**沒有** `export OPENCODEX_API_AUTH_TOKEN=…` 這一步。在非迴路繫結上，安裝程式會依下列順序決定 hub 的資料准入金鑰，並把結果寫進僅擁有者可讀的 `service-api-token`（權限 `0600`）：

1. **`OPENCODEX_API_AUTH_TOKEN`**，當安裝時的 shell 有匯出它。想自己掌管該值的維運方仍然掌管它。
2. **既有的 `service-api-token` 檔案。** 沿用它才能讓 `ocx service install`、`ocx service repair` 與重新啟動具有冪等性；重新產生會讓所有已依舊值交換出去的 per-client 金鑰悄悄失效。沿用的檔案會被重新檢查，而不是直接信任——見下方關於 admin token 的段落。
3. **32 個全新隨機位元組的十六進位值。** 這個分支正是手動步驟被移除的原因。

指令只印出**路徑**，絕不印出值。launchd plist 與 systemd user unit 會在程序啟動時讀取那個受保護的檔案，兩者都不內嵌明文金鑰。請不要把該值貼進 `ocx config show` 輸出、unit／plist 內容、螢幕截圖或支援封包。在 hub 上以前景執行 `ocx start` 讀的是同一個檔案，所以同樣不需要匯出金鑰就能繫結非迴路主機名稱。

**管理用的 admin token 出現在哪裡都會被拒絕**，而且拒絕訊息會指出該處的修正方式。出現在 `OPENCODEX_API_AUTH_TOKEN`：`unset OPENCODEX_API_AUTH_TOKEN` 後重跑。出現在沿用的 `service-api-token` 檔案——這正是當初事故的形狀，在曾經手動把 admin token 貼進該檔的機器上仍然可能發生——請刪除該檔後執行 `ocx service repair`，因為取消一個環境變數並不能說明檔案的內容。兩項檢查都在迴路短路之前執行，所以迴路安裝同樣會被檢查：啟動包裝程式無論主機名稱為何，都會把該檔讀進 `OPENCODEX_API_AUTH_TOKEN`，這正是開機時把管理 API 關閉的機制。

兩個平面是不同的憑證：資料金鑰只准入 `/v1/*` 呼叫者，不具備任何管理權限。既然服務會自行發放金鑰，兩者都沒有匯出的理由；檔案存在之後，`ocx service repair` 也不會再要求那個環境變數。

`ocx status` 會在不顯示值的前提下回報金鑰狀態：`present (file)`、`unsafe (file)`（檔案存在但不是僅擁有者可讀，請修正權限）、`admin-collision (file)`（事故形狀，該區塊會補上後果與修正方式）或 `missing`。狀態一律是關於**檔案**的，因為啟動包裝程式會在 exec 之前用檔案內容覆寫環境變數；另有一條子行回報你的 shell 是否設了 `OPENCODEX_API_AUTH_TOKEN`，因為那才是在該 shell 裡前景執行 `ocx start` 時會用到的值。

### 一個連接埠，與帶埠的替代寫法

`unauthenticatedLoopbackListener: {"enabled": true}` 且**不**帶 `port`，就是 *companion* 寫法：在 `127.0.0.1:<proxy 連接埠>` 開第二個 socket，連接埠號與公開監聽器在 tailnet 位址上使用的完全相同。那正是每個本機整合早就會寫入的位址，所以 hub 上不需要教任何東西新的連接埠，而一個連接埠就是遠端資料面的全部。

companion 寫法只有在 `hostname` 是明確的非迴路、非萬用位址時才會被接受。在 `127.0.0.1`、`localhost`、`0.0.0.0` 或 `::` 上，公開監聽器已經佔住該迴路位址，所以 opencodex 會在寫入當下以及啟動時再次拒絕這組配對並指出衝突，而不是讓第二次繫結失敗。在那些繫結上你根本不需要這個監聽器：迴路繫結本來就准入本機呼叫者。

較舊的*帶埠*寫法仍然可用，當你想把兩個面放在不同連接埠時就用它：

```bash
ocx config set unauthenticatedLoopbackListener '{"enabled":true,"port":10104}'
```

設了 `port` 之後，本機整合會跟著監聽器改寫成 `http://127.0.0.1:10104`。該連接埠必須與 proxy 連接埠不同，而且絕不會由作業系統指派：臨時連接埠會在每次重新啟動後改變，而已經在執行的 app-server 仍會沿用先前的 `base_url`。

**改動這個欄位之後請重新啟動 proxy。** socket 只在啟動時繫結一次，本機用戶端檔案也是依解析後的值寫出，所以執行中的 hub 會維持舊答案。在帶埠的 hub 上，這正是 `ocx claude` 連得到監聽器、還是從它收到 `404` 的差別。使用背景服務時，對應的動詞是 `ocx service restart`，它一定會重新啟動——見「macOS 服務操作」。`ocx restart` 是另一個動詞：它重啟的是你自己啟動的 proxy 程序，而不是由管理器監督的服務。

### hub 自己的本機用戶端

hub 曾經是唯一不能使用自己的那台機器：`ocx claude`、Claude Desktop、Cursor、`system-env` 注入與路由過的視覺輔助元件全都連往 `http://127.0.0.1:<連接埠>`，而當監聽器繫結在 tailnet 位址上時，那個位址並不存在。啟用迴路監聽器之後，它們在 hub 上就能運作：

```bash
ocx sync          # hub 現在會寫出自己的 Codex/Grok 區塊
ocx claude        # Claude Code 接到 hub 自己的迴路位址
```

該監聽器只承載推論用的線路：`POST /v1/responses` 及其 WebSocket 升級、`POST /v1/responses/compact`、`POST /v1/messages`、`POST /v1/chat/completions`、`POST /v1/alpha/search`、`GET /v1/models`，以及即時語音介面。`POST /v1/messages/count_tokens` 刻意**不**准入，因此 Claude Code 會退回本機 token 估算——那是外觀上的損失，不是啟動失敗。`/api/*`、`/healthz`、`/readyz` 與儀表板在那裡一律回 `404`：像 `ocx claude` 的探索呼叫這類本機管理讀取，會帶著管理憑證走已驗證的管理介面，絕不會走未驗證的 socket。這就是管理入口與這個監聽器始終是兩回事的原因。

監聽器**關閉**時，hub 會刻意不改寫自己的用戶端設定，而且每次略過都會指名擋下它的那道閘門：

```text
This machine is a hub; it does not rewrite its own Codex/Grok/Claude configs unless
unauthenticatedLoopbackListener is enabled.
```

那句話指的是 hub 這道閘門，不是你的 `clientIntegrations` 開關。`ocx ensure` 在被閘門擋下時會保留既有的受管 Grok 區塊而不是把它剝掉，`ocx restore back` 也會回報閘門，而不是歸咎於另一個寫入者。

### 資料平面的驗收

在公開的資料監聽器上證明存活與就緒：

```bash
curl --fail --silent http://100.64.0.10:10100/healthz
curl --fail --silent http://100.64.0.10:10100/readyz
```

`/healthz` 回 `200` 只證明程序仍在執行。部署驗收還需要 `/readyz`、一次已驗證的 `GET /v1/catalog`，以及一次真實的路由回應。

## Tailscale Serve

先證明管理 socket 確實僅限迴路，再透過 Serve 發布它：

```bash
ss -ltnp | grep 10101        # Linux：預期只有 127.0.0.1:10101
lsof -nP -iTCP:10101 -sTCP:LISTEN  # macOS：預期只有 127.0.0.1

tailscale serve --bg --https=443 http://127.0.0.1:10101
tailscale serve status
```

把 `hub.managementPublicOrigin` 設成 Serve 顯示的那個確切 HTTPS origin。把維運方確切的 Tailscale 登入帳號加進 `remoteGui.allowedTailscaleUsers`；空清單表示沒有任何遠端身分能簽發工作階段。請雙向驗證：

```bash
# 反向：僅限迴路的連接埠不得經由節點的 tailnet 位址連到。
curl --fail --connect-timeout 3 http://100.64.0.10:10101/ && echo "unexpected exposure"

# 正向：HTTPS 儀表板可由獲准的 tailnet 使用者透過 Serve 載入。
curl --fail --silent --show-error https://hub-name.tailnet-name.ts.net/ >/dev/null
```

正向的瀏覽器測試必須使用真正已登入的 Tailscale 工作階段；單純的 `curl` 可能不會帶上自動簽發工作階段所需的身分標頭。當 HTTPS 前端無法提供可信的 Tailscale 身分時，配對仍是退路。

### 為資料監聽器提供 TLS

上面的 Serve 對應只發布**管理**入口。該入口從不提供 `/v1/*`、`/healthz` 或 `/readyz`，因此光靠它並不能讓遠端用戶端取得可用的資料平面。opencodex 本身也不終結 TLS：監聽器是明文 HTTP，HTTPS 一律由維運方自建的前端負責。

資料平面同樣可以交給 Serve，只要再用一個 HTTPS 連接埠。在 macOS 上還要多一跳，因為 Tailscale Serve 只能代理到 `127.0.0.1`——它無法指向你綁在節點自身 tailnet 位址上的監聽器，而 App Store 版的 macOS 用戶端更會直接拒絕遠端目的地。請在 hub 上執行一個迴路轉送器，再讓 Serve 指向它：

```bash
# 任何迴路 TCP 轉送器都可以，socat 只是其中之一。請選一個 hub 尚未佔用的連接埠：
# 啟用迴路 companion 後，127.0.0.1:10100 屬於 opencodex 自己。
socat TCP-LISTEN:10110,bind=127.0.0.1,fork,reuseaddr TCP:100.64.0.10:10100 &

tailscale serve --bg --https=8443 http://127.0.0.1:10110
tailscale serve status   # 應同時出現兩組對應：443 -> 10101、8443 -> 10110
```

**不要改為把 Serve 指向迴路 companion 監聽器。** 它是 `127.0.0.1:10100` 上的真實 socket，所以對應會被建立，然後以下方陷阱描述的同一種方式失敗：companion 執行的是迴路准入政策，那需要迴路的 `Host` 標頭，而 Serve 轉送的是 `Host: hub-name.tailnet-name.ts.net`。companion 的存在是為了 hub *之上*的程序，那些程序會自己送出迴路 `Host`。轉送器承載的是繫結在 tailnet 上的監聽器，它的憑證准入與 `Host` 處理方式才是 TLS 前端需要的。

Serve 只接受有限的幾個 HTTPS 連接埠；請用 `tailscale serve status` 確認對應確實建立，不要假設連接埠已被允許。

請讓轉送器與 hub 有相同的生命週期。背景 shell 工作會在重開機時消失，而服務會自行復原，於是 hub 在執行卻無法經 TLS 連到；請隨 `ocx service install` 一起，用 launchd 或 systemd 託管它。

接著連線時把兩個 origin 分開寫。位置參數 URL 是**資料** origin，`/readyz` 與 `/v1/catalog` 都從這裡取得；`--management-url` 則是用於配對與金鑰簽發的儀表板 origin。兩者不必共用連接埠：

```bash
# 這正是 `ocx hub invite` 印出的那一行，只是把配對碼填好了。
echo '<pairing-code>' | ocx connect https://hub-name.tailnet-name.ts.net:8443 \
  --management-url https://hub-name.tailnet-name.ts.net \
  --pairing-code-stdin
```

請把這兩個 origin 記錄在 hub 上，成為 `hub.dataPublicOrigin` 與 `hub.managementPublicOrigin`，之後 `ocx hub invite` 就會替你印出來，而不必要求你記住。

省略 `--management-url` 時，它取自 `/readyz` 回應，而該回應回報的正是 `hub.managementPublicOrigin`。兩個 origin 不同時，明確寫出更清楚。

**不要為了省事把資料監聽器綁到 `127.0.0.1`。** 迴路繫結正是 opencodex 判定「純本機部署」的依據：它會不再要求資料憑證，改為要求請求的 `Host` 標頭也是迴路位址。TLS 前端會原樣轉送 `Host: hub-name.tailnet-name.ts.net`，於是 `/v1/catalog` 回應 `403 origin_rejected`，而不做這項檢查的 `/readyz` 仍然回應 `200`。部署看起來健康，卻無法提供模型。請求路徑中沒有任何程式碼會讀取 `X-Forwarded-Host`，所以前端也修不了。請把監聽器留在 tailnet 位址上：憑證准入維持開啟，而 `Host` 檢查不會生效。

那個陷阱講的是**繫結**，而且至今仍然成立。要在 hub 上為它自己的程序取得一個 `127.0.0.1` socket 是另一個問題，而 `unauthenticatedLoopbackListener`（見「一個連接埠，與帶埠的替代寫法」）正是官方認可的答案：公開繫結留在 tailnet 位址上並維持准入檢查，另一個 socket 服務本機呼叫者。基於上述理由，它不是 TLS 的目標。

繫結 `0.0.0.0` 同樣可行，而且因為監聽器那時在迴路上也連得到，就不再需要轉送器。但它會把資料連接埠發布到所有介面，所以只在你不在意其他網路的主機上這麼做——另外請注意，`unauthenticatedLoopbackListener` 的 companion 寫法在萬用繫結上會被拒絕，因為公開監聽器在那裡已經佔住 `127.0.0.1:<連接埠>`。

Serve 就緒後，請對 HTTPS 資料 origin 重新執行驗收檢查：`/readyz`、已驗證的 `GET /v1/catalog` 與一次真實的路由回應。

### 維運方自管的 ts.net 憑證 proxy

若你自行運作 TLS proxy，只為完整的 ts.net FQDN 取得憑證：

```bash
tailscale cert hub-name.tailnet-name.ts.net
```

請保護私鑰、透過 Tailscale 支援的機制更新，並且只代理到 `127.0.0.1:10101`。一般的 TLS proxy 無法提供可信的 Tailscale 身分。不要偽造 `Tailscale-User-*` 標頭；請改用一次性、綁定 origin 的配對流程。

## 邀請另一台機器

請在 hub 上執行這個指令，而不是自己手寫 `ocx connect`：

```bash
ocx hub invite
```

它會鑄造一次性、短效的配對碼，並印出要在另一台機器上執行的指令：

```text
# Run on the other machine:
echo '<code>' | ocx connect https://hub-name.tailnet-name.ts.net:8443 --management-url https://hub-name.tailnet-name.ts.net --pairing-code-stdin
```

資料 origin 依序取自 `--data-url`、`hub.dataPublicOrigin`，最後才是繫結位址。最後那個退路只有在繫結**確實是**另一台機器連得到的位址時才有用：在迴路或萬用繫結上，它會解析成 `http://localhost:<連接埠>`，等於叫另一台機器連自己，白白消耗掉一次性配對碼；因此 `invite` 會改為拒絕，並印出 `ocx config set hub.dataPublicOrigin` 那一行（以及僅適用於本次邀請的 `--data-url` 寫法）。明確指定的 `--data-url` 或 `hub.dataPublicOrigin` 永遠不會被二次猜測——透過 SSH 通道時，迴路資料 origin 是正當的。

管理 origin 來自 `hub.managementPublicOrigin`，而在 `invite` 上，`--management-url` 旗標是**確認而非覆寫**：授權被綁定到設定中的 origin，交換時也會對照它，所以傳入不同的值會被拒絕並同時指出兩個 origin，而不是印出一個 hub 之後會拒絕的配對碼。

每次成功的邀請也會在 stderr 印出**綁定的瀏覽器 origin**。一份授權只綁定一個 origin，而遠端的 `ocx connect` 會呈現 `Origin: http://localhost:<它自己設定的連接埠>`；所以若綁定的 origin 不是預設的 `http://localhost:10100`，另一台機器必須在執行那一行之前就已經跑在該連接埠上，否則 hub 會拒絕交換而配對碼也被消耗掉。該提示會說明是哪個連接埠，並提供改為准入預設 origin 的選項。

當設定根本無法運作時，`invite` 會在鑄造任何東西*之前*就拒絕——`runtimeRole` 不是 `hub`、缺少 `hub.managementPublicOrigin`、非迴路的管理 origin 使用明文、`--data-url` 格式錯誤、資料 origin 會指向這台機器自己的迴路位址，或是沒有執行中且已認證的 proxy。其中一個前提值得單獨一段說明。

**`corsAllowOrigins` 必須指名加入端機器的本機瀏覽器 origin。** `ocx connect` 在交換授權時會送出 `Origin: http://localhost:<它自己的 proxy 連接埠>`，而授權綁定 origin，所以只有 `hub.managementPublicOrigin` 本身或 `corsAllowOrigins` 中的迴路項目才可能相符。兩者皆無時，`invite` 會以非零狀態結束、不鑄造任何東西，並指出確切的指令：

```bash
ocx config set corsAllowOrigins '["http://localhost:10100"]'
```

請使用**加入端**機器的 proxy 所監聽的連接埠；`10100` 是預設值。上面的設定區塊已經設好它。整個陣列的賦值會取代原陣列，所以當 hub 已有項目時，請執行 `invite` 印出的那一行——它會帶上既有項目再加上新的 origin。`ocx config get corsAllowOrigins` 可以看到目前有哪些。

`ocx hub invite --json` 會輸出 `{ code, expiresAt, dataUrl, managementUrl, command }`，其中 `expiresAt` 為 ISO 8601。配對碼是機密：一次性、五分鐘效期、在 hub 端有速率限制，而且不可持久化、記錄，或貼進 issue。`--clients codex,claude` 可以挑選印出的指令要把哪些用戶端設定指向 hub。

`invite` 是既有配對流程之上的便利工具，不是第二套機制。它走的是 `ocx gui pair` 使用的同一條已認證本機路徑，所以不需要 admin token，也不必往 shell 匯出任何東西。「角色與直接資料流」一節中關於輪替、撤銷與中斷連線的所有說明，原封不動適用於以這種方式加入的機器。

## macOS 服務操作

`ocx service install` 與 `ocx service repair` 可以安全地對執行中的 hub 重複執行。repair 會先算出 plist 再比對：當算出的位元組與磁碟上的相同、金鑰檔未變動，而且 `launchctl print` 回報工作正是從該 plist 載入時，repair 會重新宣告 `0600`、刷新安裝狀態、印出 `service is already loaded from the current plist; nothing to do.` 然後返回——完全不會碰 launchd。較早的版本會無條件驅逐健康的工作，讓一個診斷指令變成一次中斷。

**`ocx service restart` 才是一定會重新啟動的動詞。** 它不再是 `repair` 的別名。它會執行同一套刷新，而當刷新沒有重新載入任何東西時（也就是上面那種健康且未變動的情況），它會用 `launchctl kickstart -k` 就地重啟已載入的工作，再讀一次 `launchctl print` 確認工作存活，然後印出一行：

```bash
ocx service restart
# ℹ️  service restarted (launchctl kickstart -k gui/501/com.opencodex.proxy).
```

改動 `unauthenticatedLoopbackListener`、`hostname` 或 `port` 之後要跑的就是它。kickstart 不會開出驅逐視窗，所以它不像舊的無條件 repair 那樣造成中斷。

單獨執行 `ocx service` 仍然選擇 `repair` 而非 `restart`：那是一個冪等的「讓它保持最新」，不是要你去彈跳一個健康的 hub。請把 `ocx service repair` 用在它真正對應的情況——工作從較舊的 plist 載入，或根本沒載入——並且預期它在健康的服務上就是什麼都不做。

手動執行 `launchctl kickstart -k gui/$(id -u)/com.opencodex.proxy`，或是 `ocx service stop` 之後再 `ocx service start`，兩者都仍然可行，錯誤路徑也會把前者列為退路。但兩者都不再是建議路線。

Linux 與 Windows 從來沒有這個落差：在那裡 `ocx service restart` 分別以 `systemctl --user restart` 與排程工作的先停後啟收尾，不論你用哪個動詞。

`ocx service status` 會區分四種 launchd 狀態，而最後一種是最常被誤讀的：

| 摘要 | 意義 |
| --- | --- |
| `installed and loaded` | 有網域回應，而且執行的正是這份 plist 所烘焙的指令。正常。 |
| `installed and loaded from an OLDER plist` | 工作在執行，但來自一份已經不相符的定義。這正是 `ocx service repair` 的用途。 |
| `installed, not loaded` | 每個網域都回答「不存在」，這證明工作確實不見了。repair 會重新註冊它。 |
| `installed; launchd state could not be verified` | 無法詢問 `launchctl`——例如從一個連不到 `gui/<uid>` 網域的情境執行。這**不是** hub 停擺的證據：不會有任何建議要你 repair，而一次無法作答的探測絕不會把執行中的 proxy 標記為已死。 |

無法執行的探測過去會被回報成「not loaded」，那會叫維運方去 repair 一個正在服務的 hub，並讓更新程式在服務自己的連接埠上啟動一個互相競爭的 proxy。

## 無瀏覽器 OAuth

在 hub 上停用瀏覽器開啟：

```bash
ocx config set oauthOpenBrowser false
```

1. 從已驗證的遠端儀表板或管理用戶端，對該供應商發起 `POST /api/oauth/login`。hub 會回傳授權 URL 與指示，而不開啟瀏覽器。
2. 在維運方自己的機器上開啟該 URL 並完成授權。
3. 若迴路回呼連不到 hub，請把最終的重新導向 URL 或授權碼貼進儀表板／CLI。它會送出 `POST /api/oauth/login/code`，內容為 `{provider,input}`。
4. 輪詢既有的狀態端點直到完成，然後發出一次路由過的模型請求。

絕對不要把 OAuth 授權碼放進 shell argv、日誌、issue 內文、螢幕截圖或部署證據。手動輸入授權碼的路徑仍保有既有的未知供應商、無進行中流程、授權碼無效與 4096 位元組輸入等檢查。

## Docker Compose

opencodex 不發布官方容器映像。儲存庫確實維護了以原始碼建置的 [`Dockerfile`](https://github.com/lidge-jun/opencodex/blob/main/Dockerfile)、[`compose.yaml`](https://github.com/lidge-jun/opencodex/blob/main/compose.yaml) 與一份範圍狹窄的 `.dockerignore`。該建置以 digest 釘住多平台 Bun 1.4.0 映像索引、以非 root 的 `bun` 使用者執行 proxy、維持根檔案系統唯讀、卸除 Linux capabilities，預設只把資料監聽器發布在主機的 `127.0.0.1:10100`。前景程序使用 `OCX_SERVICE=1`，所以停止或重建容器會保留路由過的 Codex 狀態，而不是還原成原生桌面設定。監督由 Docker 提供，映像中不安裝任何作業系統服務管理器。請用 Compose 來重新啟動／重建容器；這並不表示支援延伸到每一條儀表板重啟路徑。

映像會植入首次執行用的 `hub` 設定，把容器監聽器繫結到 `0.0.0.0`。在第一次正常啟動之前，請把一個全新產生的資料平面金鑰串流進 bootstrap 輔助程式。該輔助程式最多接受一行 4096 位元組、絕不印出金鑰、拒絕取代既有金鑰，並把它持久化成 `ocx-state` volume 中那份標準的、僅擁有者可讀的 `service-api-token`。

此部署會持久化兩個各自獨立的 home：`ocx-state` 位於 `/home/bun/.opencodex`，存放 OpenCodex 設定、供應商憑證與用量；`codex-state` 位於 `/home/bun/.codex`，存放 Codex 狀態與 `opencodex-catalog.json`。映像與 Compose 明確設定 `CODEX_HOME=/home/bun/.codex`，所以即使 `read_only: true`，這條目錄路徑仍可寫入，而且在容器重建後存活。映像會以模式 `0700` 為非 root 的 `bun` 使用者建立這兩個目錄；既有 volume 的擁有者與權限不會自動遷移。

不要把 `CODEX_HOME` 與 `OPENCODEX_HOME` 合在一起：兩個產品都使用名為 `auth.json` 的檔名，但格式不同。這次封裝變更增加的是持久化，而不是目錄產生器。請在執行下方的目錄驗收檢查之前，把一份有效的目錄具現化或匯入到 `/home/bun/.codex/opencodex-catalog.json`；沒有它時，`catalog_not_found` 就是預期的回應。

升級會保留既有的 `ocx-state` volume 並新增 `codex-state`；不會自動遷移任何檔案。若先前的權宜做法把目錄直接放在 `/home/bun/.opencodex` 底下，請先備份，然後刻意只把目錄檔複製到新的 Codex home，並維持僅擁有者可存取。不要把任一產品的 `auth.json` 蓋到另一個上面。使用自訂 `CODEX_HOME` 的部署，應在遷移完成之前保留其明確的環境變數與可寫入的 volume 對應。覆寫 `CODEX_HOME` 時，請把那個確切目錄以可寫入方式掛載，並把預設目錄持久化在 `${CODEX_HOME}/opencodex-catalog.json`。若 `model_catalog_json` 明確指定了別的檔案，那條解析後的路徑同樣必須持久化。

升級期間請維持 Compose 專案名稱不變，才會重用同一組具名 volume。既有外來擁有者的掛載、唯讀掛載，以及使用 `volume-nocopy` 的掛載，都不會被映像的目錄設定程序修復。分開選定的目錄或 SQLite 路徑請分開持久化；作業系統憑證儲存不在這兩個 volume 的備份範圍內。

不使用 Compose 執行時，請明確提供兩個具名掛載。單靠 Dockerfile 的 `VOLUME` 宣告只會建立匿名 volume，之後的 `docker run` 不會自動重用。以下掛載選項使用獨立的範例名稱；若要重用 Compose 的資料，請換成它實際加上專案前綴的 volume 名稱：

```sh
--mount type=volume,src=ocx-state,dst=/home/bun/.opencodex \
--mount type=volume,src=codex-state,dst=/home/bun/.codex
```

請先在主機上安裝 Git 與 Bun。在**每一次**建置映像之前，都要從這份 Git 檢出執行既有的標準產生器。它雜湊的是 Git 追蹤的工作樹原始碼（新加入的原始檔請先 stage），而不是任意的目錄掃描。產生與建置之間不要改動原始檔。只有它未被追蹤的產物 `src/generated/compatibility-version.json` 會進入映像；`.git` 仍在 Docker 脈絡之外。不要提交或手動編輯該清單。建置會拒絕過期的清單：它會把每一筆記錄的 SHA-256 對照唯讀建置脈絡驗證一次，再對照複製後的執行期檔案驗證一次。它需要 `package.json`、`bun.lock` 與 `scripts/model-metadata.source.json`；`scripts/` 的其餘內容不會被納入，只納入那一個確切產物。缺少或不符的檔案、清單中沒有的多餘原始檔，以及符號連結（含父目錄）都會讓建置失敗。唯一豁免於清單的原始檔就是產生出來的清單本身。驗證失敗時，請整理被追蹤的原始碼、移除非預期的原始檔，然後重跑標準產生器。

```bash
git clone https://github.com/lidge-jun/opencodex.git
cd opencodex
bun scripts/generate-compatibility-version.ts
docker compose build
openssl rand -hex 32 | docker compose run --rm -T hub bun run docker/bootstrap-token.ts
docker compose up -d
```

在不改動容器固定的 `10100` 監聽器的前提下，設定不同的主機連接埠：

```bash
OPENCODEX_PORT=10190 docker compose up -d
```

遠端存取是明確的 opt-in。請把 `OPENCODEX_BIND_ADDRESS` 設為主機的 LAN 或 Tailscale IP，或使用 `0.0.0.0` 發布到**所有**主機介面：

```bash
OPENCODEX_BIND_ADDRESS=0.0.0.0 docker compose up -d
```

在曝露連接埠之前，請先架好防火牆與已驗證的 TLS／tailnet 前端。這個繫結覆寫只改變主機端的發布，容器監聽器仍是 `0.0.0.0:10100`。後續會重建 hub 的 Compose 呼叫請沿用同一個繫結覆寫。要更新既有部署，請重新產生清單、執行 `docker compose build`，再以 `docker compose up -d` 重建 hub；不要重複執行一次性的金鑰初始化。

請透過維運方自建的管理前端用儀表板設定供應商，或使用共用該狀態 volume 的一次性 CLI 指令。以下指令展示既有的 Remote Hub 設定；啟用前請先替換範例 origin 與身分：

```bash
docker compose run --rm hub bun run src/cli/index.ts config set hub.managementPublicOrigin '"https://hub-name.tailnet-name.ts.net"'
docker compose run --rm hub bun run src/cli/index.ts config set hub.managementIngress '{"enabled":true,"port":10101}'
docker compose run --rm hub bun run src/cli/index.ts config set remoteGui.allowedTailscaleUsers '["operator@example.com"]'
docker compose restart hub
```

這些巢狀賦值之所以可行，是因為映像已植入首次執行的 `hub` 設定，物件已經存在。在全新的 standalone 安裝上並沒有，同樣這幾行會失敗，直到你先建立它為止——見上方「Linux systemd 或 macOS launchd」。

容器監聽器繫結 `0.0.0.0`，所以它在容器自己的迴路位址上本來就連得到，`unauthenticatedLoopbackListener` 的 companion 寫法在那裡並不適用——它在萬用繫結上會被拒絕。下方的金鑰 bootstrap 是服務自行發放步驟在容器中的對應物，同樣只執行一次。

不要把金鑰放進 `ARG`、`ENV`、`COPY`、Compose YAML、映像歷史或指令參數。不要掛載 Docker socket、主機的 home 或 Codex home、SSH agent，或供應商金鑰檔。容器內繫結在 `127.0.0.1:10101` 的管理入口，只有同一個網路命名空間中的 TLS／tailnet 前端連得到；絕不要為了抄近路而發布 `10101`。

容器健康之後，請另外執行一次就緒升級檢查：

```bash
docker compose exec hub bun -e \
  "const r=await fetch('http://127.0.0.1:10100/readyz');console.log(r.status,await r.text());if(!r.ok)process.exit(1)"

docker compose exec hub bun -e \
  "const t=(await Bun.file('/home/bun/.opencodex/service-api-token').text()).trim();const r=await fetch('http://127.0.0.1:10100/v1/catalog',{headers:{'x-opencodex-api-key':t}});console.log(r.status);if(!r.ok)process.exit(1)"
```

接著用已設定的模型送出一次真實、已驗證且路由過的回應。若密鑰不存在或無法讀取，非迴路的 hub 就不得被視為就緒。絕不要把存活檢查單獨當成證明。

`docker compose down` 會移除容器與網路，但保留兩個具名 volume。請把 `docker compose down --volumes` 當成破壞性操作：它會把設定、OAuth 憑證、用量歷史、資料平面金鑰與持久化的 Codex 狀態一併刪除。

跨平台 CI 會建置原始碼映像，並用一個隔離的 Compose 專案搭配用完即丟的憑證，檢查啟動、資料平面金鑰准入與容器重建。它會驗證兩個具名 volume 與一份合成目錄能在替換後存活。這項檢查不驗證真實的供應商帳號、OAuth 回呼、自訂掛載遷移，或每一種 CPU 架構；請針對你自己的部署執行上面那項已驗證的路由回應檢查。

## 回復

改動之前請先檢視既有的 Serve 對應。`tailscale serve reset` 會移除該節點上的每一個對應；若存在不相關的對應，請改用範圍較窄的支援移除指令。

```bash
tailscale serve status
tailscale serve reset
ocx config set hub.managementIngress '{"enabled":false}'
ocx service repair
```

容器回復時，請保留兩個具名狀態 volume 及其對應。較舊的映像在該目錄仍然掛載時，仍可使用 `CODEX_HOME=/home/bun/.codex`；不要回退到會拿掉 Codex 掛載的舊 Compose 檔。不要合併兩個 home，也不要重跑金鑰 bootstrap。服務回復時，請停止分支版本的服務，並針對同一個 `OPENCODEX_HOME` 修復先前的版本。停用管理入口或 Serve 並不需要改動資料監聽器。

## 疑難排解

- **hub 停擺：** `ocx connect status` 仍會顯示已儲存的連線。`ocx disconnect` 可以離線還原本機狀態，但無法撤銷遠端金鑰。
- **目錄過期：** `ocx sync` 只在 hub 發生暫時性故障時，保留一份已驗證的最後已知良好目錄。驗證、結構、大小與協定失敗都是硬錯誤，絕不會退回本機供應商。
- **金鑰已輪替或需要 `.prev` 復原：** 帶著配對碼或 admin token 重跑 `ocx connect rotate`。在復原探測完成之前，不要編輯或移除任一個候選金鑰檔。
- **協定不相符：** 升級 `hub-too-new` 或 `hub-too-old` 訊息指名的那一端。協商會在金鑰、目錄、日誌或用戶端狀態寫入之前就失敗。
- **配對碼遺失或已被消耗：** 重新執行 `ocx hub invite`。授權只能用一次，而重複失敗會被速率限制，且不會透露某個配對碼是否存在。
- **`ocx hub invite` 說 `No loopback browser origin is admitted for pairing`：** hub 沒有准入任何迴路瀏覽器 origin，所以綁定 origin 的授權永遠不可能相符。沒有鑄造任何東西。請執行錯誤訊息印出的 `ocx config set corsAllowOrigins` 那一行，帶上加入端機器的 proxy 連接埠。見「邀請另一台機器」。
- **`ocx hub invite` 說廣告出去的資料 origin 會是這台機器自己的迴路位址：** 繫結是僅限迴路或萬用位址，而 `hub.dataPublicOrigin` 未設定，所以沒有位址可以廣告，也不會有任何東西去猜測 tailnet 或 LAN 位址。沒有鑄造任何東西。請設定 `hub.dataPublicOrigin`，或只為這次邀請傳入 `--data-url`。
- **加入端機器的交換被拒絕，而配對碼被消耗掉：** 該授權綁定到一個那台機器並未呈現的 origin。請重讀邀請輸出的 `Bound browser origin:` 那一行——它指出另一台機器必須跑在哪個連接埠上，或提供改為在 hub 上准入 `http://localhost:10100` 的選項。
- **`ocx hub invite` 拒絕某個 `--management-url`：** 在 hub 上該旗標是確認 `hub.managementPublicOrigin` 而不是覆寫它，因為授權綁定到設定中的值。請改設定，或拿掉該旗標。
- **hub 上的 `ocx claude` 啟動了原生 Codex/Claude，或 hub 拒絕改寫自己的用戶端設定：** `unauthenticatedLoopbackListener` 是關閉的。略過訊息會指名該閘門。請啟用監聽器並重新啟動 proxy（服務安裝時用 `ocx service restart`）。
- **hub 上的 `ocx claude` 從監聽器收到 `404`：** proxy 仍是那個在監聽器線路存在之前、或在連接埠改變之前就啟動的程序。請用 `ocx service restart` 重啟它——見「macOS 服務操作」。
- **`ocx service repair` 印出 `nothing to do` 而程序沒有彈跳（macOS）：** 這是預期行為。對健康工作執行 repair 刻意是 no-op。當你要的是新程序時，請執行 `ocx service restart`，它會就地 kickstart 已載入的工作並回報 `service restarted (launchctl kickstart -k …)`。只有在它也失敗時，`launchctl kickstart -k gui/$(id -u)/com.opencodex.proxy` 才是手動退路——失敗訊息會指名它。
- **`ocx service install` 拒絕 `OPENCODEX_API_AUTH_TOKEN`：** 那個值是管理用的 admin token。請 `unset OPENCODEX_API_AUTH_TOKEN` 後重跑；服務會自行發放資料平面金鑰。見「資料平面金鑰由服務自行發放」。
- **hub 在開機時反覆崩潰，而 `ocx status` 顯示 `admin-collision (file)`：** `service-api-token` 檔案裡裝的是管理金鑰，所以 hub 會把管理 API 關閉。請刪除該檔並執行 `ocx service repair` 以發放資料平面金鑰。在這裡取消環境變數沒有幫助——來源是那個檔案。
- **明文 HTTP 被拒絕：** 透過非迴路 HTTP 配對會被直接拒絕，而且沒有任何旗標可以豁免。請把管理 origin 放到 HTTPS 後面，或改用迴路配對。admin token 絕不會經由 HTTP 傳送。
- **`/v1/catalog` 回 `403 origin_rejected` 而 `/readyz` 回 `200`：** 資料監聽器被繫結在迴路位址上，卻放在 TLS 前端後面。見「為資料監聽器提供 TLS」。
- **遠端工作階段已結束：** 請重新登入或重新配對。登出與逾期只會使瀏覽器工作階段失效，不影響用戶端資料金鑰。
- **中斷連線後仍有待撤銷的項目：** 請使用 hub 儀表板的 **Integrations → API Keys** 頁面。那是中斷連線後唯一的撤銷路徑。

### 從已連線的用戶端查看用量

`ocx usage` 會用這個用戶端已註冊的資料金鑰讀取已連線的 hub。人類可讀輸出會標明 hub 來源與用戶端金鑰範圍；`--json` 回傳同一份受範圍限制的資料。區間、介面、供應商／模型過濾條件與自訂的 `--since`／`--until` 邊界都仍然可用。帳號層級的細分與其他用戶端的紀錄不會被分享。過舊或無法使用的 hub 會產生明確錯誤，而不是拿本機用量頂替；若 hub 不支援這項讀取，請升級它。

唯讀的資料平面端點是 `GET /v1/usage`，使用 `x-opencodex-api-key` 搭配已設定的用戶端金鑰。環境層級與管理用金鑰會被拒絕。它接受 `range`、`surface`、`provider`、`model`、`since` 與 `until`；未知或重複的選項，以及呼叫端自選的金鑰 ID 都會被拒絕。被略過的過大資料列仍保有明確的歷史不完整警告。

用戶端用量憑證只會經由 HTTPS 或迴路 HTTP 傳送。請求與回應都停用快取。

### 把這個瀏覽器與 hub 配對

機器註冊與瀏覽器驗證是分開的。配對面板會標明 hub，並顯示對應你瀏覽器目前開啟之確切 origin 的 `ocx gui pair --origin` 指令。請在 hub 上執行該指令，或把它送給 hub 維運方並索取一次性配對碼。把該配對碼貼進面板；資料 API 金鑰或 admin token 都不是配對碼。

瀏覽器驗證還在等待期間，儀表板不會建議重新啟動一個健康的已連線用戶端。完成配對會立即刷新儀表板資料，包括先前快取的驗證失敗。工作階段逾期會回到配對流程；權限遭拒則保有自己的存取設定指引。其他刷新失敗可能會顯示最後收到的資料，並附上過期資料提示與重試動作。

若輔助監聽器無法繫結，啟動時會指名 `unauthenticatedLoopbackListener` 或 `hub.managementIngress` 以及實際位址。請修正該監聽器或釋出其位址；只改公開 proxy 連接埠並不能修復固定的輔助連接埠。手動編輯而格式錯誤的監聽器區塊會發出警告並維持停用，同時保留不相關的設定。
