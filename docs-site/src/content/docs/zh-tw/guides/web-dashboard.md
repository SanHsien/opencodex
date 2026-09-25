---
title: Web 儀表板
description: 用於管理代理健康狀態、provider、模型、委派指引、認證池、usage 和日誌的 opencodex GUI。
---

opencodex 內建了一個由代理提供服務的本機 web 儀表板（`gui/` 下的 Vite/React 應用）。你可以在
這裡快速管理 provider、Codex/ChatGPT 帳號、目錄模型、sidecar、子代理設定和請求流量。

## 開啟儀表板

```bash
ocx gui
```

該命令會在瀏覽器中開啟 `http://localhost:<port>`；在啟用管理 ingress 的 hub 上則開啟 `http://127.0.0.1:<管理埠>`；如果代理尚未執行，會先自動啟動。開發時也可
讓 GUI dev server 單獨連線到正在執行的代理：

```bash
ocx start
bun run dev:gui
```

## 登入

在預設的 loopback 綁定（`localhost` / `127.0.0.1`）上，儀表板永遠不會要求 token：代理會將短期
GUI session 簽發到服務的頁面中，並在到期或代理重啟時靜默續期。只有綁定到非 loopback 主機名稱的
儀表板才需要 admin token（`OPENCODEX_ADMIN_AUTH_TOKEN`，或自動產生的
`~/.opencodex/admin-api-token` 檔案）。

當遠端儀表板需要該憑證時，它會顯示標準的密碼表單，讓瀏覽器密碼管理員可以提議儲存與自動填入。
儀表板本身仍然只在記憶體中保留 token，不會寫入 `localStorage` 或 `sessionStorage`；是否儲存完全
由瀏覽器或密碼管理員決定。

### 找到 admin token

只有非 loopback 綁定才需要這個。本機儀表板永不會詢問；若本機儀表板**確實**詢問，問題不是
token——請見下方的[本機儀表板無法啟動 session 時](#本機儀表板無法啟動-session-時)。

代理第一次啟動時會替你產生這個 token。它刻意不會被印出來，因此請從檔案讀取：

```bash
cat ~/.opencodex/admin-api-token
```

若設定了 `OPENCODEX_HOME`，該檔案改位於 `$OPENCODEX_HOME/admin-api-token`。在 Windows 上則是
`%USERPROFILE%\.opencodex\admin-api-token`。產生的 token 形如 `ocx_admin_` 加上 43 個字元；
代理會拒絕不符合此形狀的檔案，而不是靜默重新產生一個。

若要自行選擇這個值，請在啟動代理之前設定 `OPENCODEX_ADMIN_AUTH_TOKEN`。它優先於檔案，此時
檔案既不會被讀取也不會被建立。請選擇與你的資料平面憑證（`OPENCODEX_API_AUTH_TOKEN` 或已設定
的 API 金鑰）不同的值——重複使用會被拒絕。

沒有任何 CLI 指令會印出這個 token。`ocx doctor` 刻意只回報憑證是否存在，絕不揭露其值。

### 本機儀表板無法啟動 session 時

`localhost` 上的儀表板會自行簽發 session，因此不會要求你輸入 token。若它回報無法啟動 session，
原因是你使用的位址，而不是缺少憑證——代理沒有把該請求識別為 loopback。請在代理啟動時印出的
位址（通常是 `http://127.0.0.1:<port>`）開啟儀表板，並優先使用該確切的主機與連接埠，而不是
LAN IP 或別名。

## 儀表板版面

Overview 使用相符的狀態卡片與全寬設定列。在寬螢幕上，標籤共用一欄，模型／effort 控制項共用
另一欄。在較窄的螢幕上，控制項會依原本的閱讀順序移到標籤下方。過長的版本標籤會在視覺上縮短；
將滑鼠移到版本徽章或版本值上可讀取完整內容。

### 配額摘要列

除啟動安全頁面外，每個頁面頂端的一行摘要會顯示各供應商目前的配額用量，例如
`OpenAI 31% | Claude 54% | xAI 12% | Google 8%`。它讀取與供應商工作區相同的配額報告
（`GET /api/provider-quotas`，分頁可見時每 60 秒一次），且絕不會強制重新整理上游。

- 每個項目顯示優先選用的已回報視窗：依序為每週、30 天、5 小時，然後是供應商自訂視窗或
  預付額度。
- 用量達 70% 時轉為琥珀色，達 90% 時轉為紅色。
- 將游標移到項目上或點擊項目，可查看所有已回報的視窗及其重設時間和讀取時間。按
  Escape 或點擊其他位置可關閉已固定的項目。
- 未回報任何配額視窗的供應商不會顯示。所有供應商都未回報時，整條列會隱藏。
- 右端顯示儀表板上次讀取報告的時間。當最近一次讀取失敗且仍在顯示上一次讀數時，它
  會轉為琥珀色。

## 可以完成哪些操作

| 區域 | 作用 |
| --- | --- |
| **Dashboard 摘要** | 顯示 multi-agent 模式、線上狀態、版本、運行時間、provider 數量、30 天 token 總量、活動 provider 和可用的原生/路由模型。 |
| **Sub-agent delegation** | 為 OpenCodex 委派指引與獨立的原生預設值 opt-in 共用，選擇原生或路由模型，以及可選的 reasoning effort。這不是 proxy 端逐次生成的路由器；詳見下文。 |
| **Sidecar** | 選擇 web-search 模型及強度，以及圖像描述模型；更改從下一次請求開始生效。 |
| **Maintenance** | 重新同步 Codex 模型目錄，檢視專案級設定繞過警告，檢查 latest/preview 版本，並可在更新後重啟代理。 在桌面 shell 中，該更新入口會開啟原生應用程式更新頁面，而不是執行套件更新器。 |
| **啟動安全** | 顯示注入的 Codex 路由能否在重啟後繼續工作，並分別顯示服務、launcher shim 狀態和準確的修復命令。 |
| **Windows 托盤** | 安裝使用者登入托盤，一鍵控制代理啟動、停止、重啟、面板和狀態。托盤不是代理重啟服務。 |
| **Codex 自動啟動** | 允許已安裝的 Codex launcher shim 執行 `ocx ensure`。此開關不會安裝 shim 或後臺服務。 |
| **Providers** | 新增、編輯、設定預設（僅限已啟用的 provider）、啟用/停用與移除 provider；在支援時管理 OAuth 帳號池與 API-key 池。移除目前的預設時，若還有其他已啟用的 provider，會切換到第一個剩餘的已啟用 provider；否則會拒絕刪除並保留目前的預設。Provider Settings 可以為缺失、緩慢或過大的 `/models` 目錄端點停用即時模型探索。對於 Claude（Anthropic）OAuth 池，每個已登入帳號會顯示自己的 5 小時與每週限流條（用量以憑證為單位）；探測失敗會保留最後已知的限流條並標記為不可用，直到下一次成功重新整理。未選取任何 provider 時顯示的 Provider Overview 帶有 **Refresh all quotas** 控制項，會強制對每個已設定的 provider 做一次伺服器端重新讀取；上游探測失敗的 provider 會保留其最後一筆正常資料，因此狀態列回報的是「檢查已完成」而不是宣稱每個值都是最新的，而每一列各自的資料新鮮度仍以該 provider 自己的時間為準。 |
| **Add provider** | 分頁上方的單一搜尋框可同時搜尋帳號、免費、本機、付費四個分頁。搜尋時選取的分頁不會跳轉，結果依分頁分組並顯示數量。本機執行環境（Ollama、vLLM、LM Studio、LiteLLM）有專屬分頁，過長的說明會截斷為兩行，點擊即可查看全文。 |
| **Codex Auth** | 新增 ChatGPT/Codex 池帳號，選擇下一 session 的帳號，重新整理 5h / 每週 / 30d 配額，啟用或停用配額自動切換，設定其 1–100% 閾值和臨時故障 failover。 |
| **Subagents** | 在 `spawn_agent` override 列表中置頂最多五個原生或路由模型。 |
| **Models** | 開關原生 GPT 與路由模型，設定 provider allowlist、上下文上限、v1/base/v2 以及 v2 thread 數量。頁面會區分已儲存至中樞端、此用戶端已取得，以及已在執行中的用戶端生效這三種狀態。取得時間無法證明內容包含中樞端最新儲存，執行階段生效狀態會明確顯示為尚未驗證。 |
| **Logs** | 自動重新整理近期請求，顯示 token、請求強度、實際模型、provider、狀態、request id、耗時和錯誤詳情。 |
| **Usage / Debug** | 檢視 token usage 覆蓋率與趨勢，或啟用可選的 provider transport 和 usage 提取診斷。 |
| **Storage** | 唯讀的 CODEX_HOME 磁碟分佈（sessions、封存、資料庫、附件）。選用的封存清理：預覽最舊的 N%，然後隔離到 `CODEX_HOME/.trash`（預設），或在明確勾選核取方塊後永久刪除。**自動清理政策**是選擇加入，**預設關閉**（`storageCleanupPolicy.enabled`）；在 Storage 頁面設定門檻／目標／排程／模式，或觸發**立即執行**。被隔離的項目可以從 Storage 頁面還原（JSONL + threads）。作用中的 session 維持唯讀。當 Codex 持有最新／作用中的 `state_*.sqlite` 鎖定時，清理與還原會被拒絕。 |
| **Stop** | 優雅地停止代理和已安裝的後臺服務，恢復原生 Codex 並退出（`POST /api/stop`）。在使用工作排程器後端的 Windows 上，儀表板會拒絕並提示改用 `ocx stop`：工作結束後包裝程序仍可能重新啟動 Proxy，只有執行在 Proxy 之外的 stop 才能在還原用戶端設定前確認這個重啟視窗。被拒絕時不會做任何變更。 |

用量、儀表板、供應商工作區、供應商目錄和 API 金鑰頁面會提示部分記錄被排除，即使沒有可讀取的記錄。次數、日期和使用排名僅反映可讀取的記錄。歷史不完整時，無法儲存模型的最常用排序；請選擇其他排序或修復歷史後重試。

### 帳號選擇

帳號選擇與請求路由共用。選擇一個 OAuth 帳號會在下一次請求時生效，即使帳號池已啟用。一個健康的
選擇不會只因為另一個通用 OAuth 帳號有更多未用配額就被取代。若該帳號回傳 429，即使帳號池關閉，
自動容錯移轉仍可以選擇另一個可用帳號。已提交的自動選擇會立即更新儀表板；帳號變更不會等待配額
重新整理計時器。已送往上游的請求會保留其原始憑證。

### 篩選請求日誌

Logs 可組合介面、被攔截請求、供應商、完整模型名稱、狀態、時間、速度和對話 ID，篩選目前已載入的日誌。選項包含回退嘗試；模型比對忽略大小寫及頭尾空白，但不做部分比對。日誌中消失的選項恢復為全部。

時間範圍為最近 15 分鐘、1 小時或 1 天；Logs 分頁在啟用中時每 30 秒更新一次，即使關閉自動重新整理也會更新。時間範圍使用 logs 回應中的 proxy 時間戳，並隨瀏覽器經過的時間往前推進，所以不同的瀏覽器時鐘不會改變截止時間。沒有該時間戳的較舊 proxy，會在取得有效樣本之前保留瀏覽器時鐘的退回機制。速度按完整請求耗時計算每秒輸出 token，分為小於 15、15 至小於 50、至少 50；啟用速度篩選時排除無測量值的請求。成功為 2xx，錯誤為 4xx/5xx。

啟用中的篩選會顯示符合數與已載入總數；重設篩選會恢復全部列，並將鍵盤焦點移回「全部」介面控制項；「無符合的請求」與空的日誌 ring 是不同的狀態。介面選擇器支援方向鍵或 Home/End。這些控制項不會查詢已載入 ring 以外的歷史記錄。

### 連結到某個部分

佈局只有一種，無需切換。Dashboard 的各個部分都有自己的地址：`#dashboard` 開啟 Overview，`#dashboard/providers` 與 `#dashboard/models` 開啟另外兩個。重新整理、收藏和後退都會保留目前所在的部分。**Logs** 同理，使用 `#logs` 與 `#logs/debug`。舊的 `#providers/workspace` 書籤現在會跳轉到 `#providers`。

**Logs** 與 **Usage** 中的費用是根據已回報 token 計算出的 API 牌價對應值。若要查詢自訂的用量
區間，伺服器必須能確認所請求的確切起訖時間；若執行中的 proxy 版本較舊、不支援這些邊界，儀表板與
CLI 會拒絕其回報，請先升級並重新啟動該 proxy 再重試。重設一個手動設定的模型價格只會影響該模型，
其他各自獨立儲存的費率不受影響。這些數字不是帳單，也不是實際扣費的證據；實際情況可能改為計入
訂閱用量或供應商配額。

供應商的模型列可能包含**未解析的請求模型用量**：已儲存的路由把請求的名稱原樣送給了預設供應商。
這些 token 屬於那個實際服務的供應商，不一定是請求中點名的廠牌。儀表板會保留原始名稱與用量，而不是
猜測實際執行的是哪個模型。對於含有斜線的未解析名稱，光靠另一個廠牌的模型價格不足以估計成本；仍會
套用精確的供應商或已設定的價格。模型佔比是在所選供應商內計算的。對未知的保留 `policy/` 名稱發出的
請求，現在會在抵達上游供應商之前就失敗；歷史用量仍會保留。

所選供應商的 **Overview** 與 **Usage** 分頁，會在用量統計下方顯示**目前帳號用量**。**Accounts**
與 **API keys** 會顯示每個受支援憑證各自的配額，包括 credit 餘額。供應商層級的總覽在可取得時仍會
顯示池化容量；它不會取代缺失的目前帳號讀數。不支援查詢、尚無被動觀測、載入中、查詢失敗但保留最後
已知值，以及量測為零，是各自獨立的狀態。**Quota check completed** 代表這次讀取已經結束——不代表
某個被動觀測變成了新資料，也不代表每一筆上游量測都被重新整理過。

## 模型可見性

**Models** 開關表示 Codex 中的最終可見狀態。路由模型只有在 provider allowlist 中（或未設定 allowlist）且未被停用時才會開啟。開啟模型會原子地協調兩個過濾條件；**全部開啟** 會清除 allowlist，因此以後新發現的模型也會開啟。

### 在供應商工作區管理模型

在供應商的**模型**分頁中，**刪除**會移除已儲存的自訂定義。原有的原生模型或即時探索到的模型可能
重新顯示，因此模型數量可能維持不變。**隱藏**只改變目錄可見性，不會刪除定義，也不會改變直接路由規則。
點選**在模型中管理可見性**可開啟**模型**頁面並恢復顯示；即使供應商分頁已沒有任何模型列，也能使用此入口。

**新增**會儲存自訂定義，但不會清除既有的隱藏狀態或供應商選擇規則。儲存後的模型可能仍被隱藏。
如果模型已存在，請在**模型**頁面管理其可見性。已確認儲存時，即使目錄重新整理失敗，定義也已儲存；
請依重新整理提示操作，不要重複新增。若無法確認變更結果，請先重新整理模型狀態，再重試。

供應商的模型數量統計伺服器回傳的目前模型清單中未停用的唯一項目，計數在搜尋與顯示數量限制之前進行。
它不是允許清單的大小或即時探索的模型數量，也不能證明項目來自上游探索。選擇標記與探索資訊和此計數分開顯示。

## 委派選擇器與生成路由的區別

Dashboard 的 **Sub-agent delegation** 選擇器會儲存 `injectionModel`，以及可選的
`injectionEffort`。**OpenCodex multi-agent guidance** 獨立控制使用這些值的委派指示。在合格的 v2
回合上，該指引會告訴父代理該把哪個確切的模型與 reasoning effort 傳給 `spawn_agent`；清除模型
同時也會清除已儲存的 effort。

預設關閉的**做為原生 Codex 子代理預設值使用**開關，會在 OpenCodex 管理現用 Codex 路由的情況下，
於下一次 sync/restart 時把相同的選擇套用到 Codex 原生的 `[agents]` 預設值。外部、由使用者管理的
供應商設定不受影響。這些預設值會影響新建立的 Codex 任務，但它們本身不會觸發委派。既有的、使用者
擁有的 `[agents]` 預設值會被保留而不是覆寫，所以它們可能會繼續覆寫這裡要求的預設值。

:::caution
這兩個控制項都不是 proxy 端的跨模型生成路由器。OpenCodex 指引要求 Codex 把覆寫值傳給
`spawn_agent`；原生的 `[agents]` 預設值只有在同步之後、Codex 建立新任務時才會套用。v1/base/v2 的
規範行為請見 [子代理介面](/zh-tw/guides/sub-agent-surface/)。
:::

## Remote Hub 工作階段、金鑰與用量

儀表板管理平面與 client→hub 模型流量彼此獨立。**Integrations → API Keys** 顯示待處理輪替，只顯示一次替代金鑰，並要求明確提交或中止。瀏覽器 logout 只會使目前工作階段失效。連線時從 hub 依 `apiKeyId` 篩選用量；中斷後使用本機記錄，兩者不會鏡像。

這項生成覆寫保證只適用於**內建**的 v2 指引文字。自訂的 `injectionPrompt` 會完全取代那段文字，
且必須包含 `{{model}}` 與 `{{effort}}` 佔位符（`{{roster}}` 為選用），否則這些值不會出現在注入的
指引中。

選擇器會列出已啟用的原生與路由模型，以及全域 Codex reasoning 階梯。API 會先驗證所選強度是否
屬於全域階梯；Codex 仍會根據目標目錄條目再次校驗該 spawn 強度。

## Codex Auth 與帳號池

**Codex Auth** 頁面用於管理原生 ChatGPT/Codex 路由：

Pool 模式會在主要與已新增的 Codex 帳號之間選擇；Direct 只使用呼叫者／主要登入。進行中的請求會
保留其擷取的憑證，而 401/403 重新認證或 429 冷卻可能會清除親和性，並輪換到另一個合格的 Pool
帳號。這與 `openai-apikey` 及其他供應商是分開的。

:::caution[供應商政策責任]
帳號池是一項技術性的帳號管理、路由與韌性功能。它不代表擁有多個帳號本身是被禁止的；是否合規取決
於帳號的設定方式與使用模式。OpenCodex 不鼓勵使用額外帳號來規避速率限制、配額、方案限制或其他
供應商限制，也不鼓勵在多人之間共用帳號憑證。你有責任讓每個已連接的帳號與使用模式，都符合該供應商
目前的條款。供應商的限制、停權或終止帳號不在 OpenCodex 的控制範圍內；維護者不提供政策建議，也
無法解決供應商的執行措施。請參閱 [OpenAI 目前的使用條款](https://openai.com/policies/terms-of-use/)。
:::

- 手動選擇一個帳號會立即生效：已繫結的 thread 會在下一次請求時轉移過去，只有已經在進行中的請求
  會保留它們擷取的帳號。手動選擇同時也會被 pin 住：卡片會顯示 **PINNED** 徽章，且在該帳號被耗盡、
  你選擇另一個帳號，或你變更任何帳號的選擇順序之前，更高的選擇順序都無法搶占這個帳號。
- 每張帳號卡片都有一個**選擇順序**控制項（First、Earlier、Normal、Later、Last）。順序較高者先被
  使用，只有當它上面的每個帳號都已耗盡或無法使用時，帳號池才會降到較低的順序。變更順序會從下一個
  未繫結的請求開始套用，絕不會移動已經繫結的 thread。Codex Desktop（main）帳號的排序方式與其他
  帳號相同，所以可以把它設為 **Last** 並保留作為後備。透過 `ocx account priority` 設定、超出這
  五種預設值範圍的順序，仍會在卡片上顯示並可被選取。
- Thread affinity 可避免每個請求都來回切換帳號。預設開啟 `pool.cacheAffinity` 後，長時間執行的
  thread 不會只因 usage 達到閾值就重新繫結；它會維持在原帳號上，直到該帳號耗盡或無法繼續服務，
  且只會重新繫結到確有額度餘裕且使用率確實更低的帳號。將此旗標設為 `false` 可恢復依閾值重新繫結，
  但仍然只會繫結到這樣的目標帳號。
- 新 session 可以選擇 usage 最低的可用帳號。付費計劃依已知的 5h、每週或 30d 視窗中使用率最高者
  評分；Go/Free 計劃只使用 30d 視窗。
- 當 WHAM 提供 `limit_window_seconds` 時，Codex Auth 會把至少 28 天的主要視窗分類為 30d，而不是
  假設每個主要視窗都是週視窗。沒有提供時長的回應仍維持舊版的週視窗判讀。
- **Refresh quotas** 會立即重新讀取帳號 usage，使路由邏輯與頁面上的帳號卡片使用同一份資料。
- 池帳號的請求日誌使用 `p3fa91c` 這類不透明標籤，不會記錄帳號郵箱。
- 每張帳號卡片也會顯示這個穩定的日誌標籤、觀測到的 30 天 token 總量、依目前設定的顯示價格估算的
  約略 API 對應成本，以及有量測到用量的嘗試比例。作用中的使用者 `modelCosts` 覆寫優先於內建的已驗證
  目錄與價格退回值，且歷史用量會依讀取當下生效的價格重新估算。這個成本是用於核對的估計值，不是
  ChatGPT Plus/Pro 訂閱帳單。早於明確歸屬存在之前的歷史裸 `openai` 列，仍維持模糊狀態，不會被指派
  給目前的主要帳號。
- **從模型選擇器指定特定 Codex 帳號** 是一個明確的選擇加入功能。啟用時，一般受支援的 GPT 選擇器
  列會被替換為每個公開帳號選擇器各一筆項目。選擇其中之一會把該對話鎖定到對應的帳號：它不會輪換、
  不會 fallback，也不會改變現用的 Pool 帳號。內建的 Codex App 登入有自己的選擇器；產生的對應通常
  使用 `main`，需要時會加上防碰撞的後綴，例如 `main-2`。已新增的帳號會取得穩定、保護隱私的標籤，
  既有的自訂選擇器標籤會被保留。既有的對話與已儲存的模型選擇會繼續正常路由。關閉此設定只會隱藏產生
  的選擇器項目，不會刪除帳號、選擇器或確切的路由。一般的 GPT 模型 id 會繼續使用已設定的 Pool 或
  Direct 行為。
- 帳號的新增、移除，以及選擇器設定的變更，會在模型目錄重新整理之前就先儲存。若那次有時限的重新
  整理無法完成，儀表板會顯示琥珀色的「已成功但需要復原」提示；執行 `ocx sync` 重試。帳號或設定本身
  的變更仍會維持已儲存狀態。

Providers overview 會另外把 Pool 模式的用量彙總成一個僅供顯示的加權容量估計值，並列出目前生效
帳號的原始配額與下一次容量恢復時間。可見欄位、覆蓋不完整的意義，以及路由邊界，請見
[Providers overview 的 pool 容量](/zh-tw/guides/providers/#providers-overview-pool-capacity)。

## 星標是你的決定，不是 agent 的

側邊欄的星標按鈕——以及 `ocx start` 在互動式終端機中詢問的一次性問題——都透過 **你自己的
`gh` 登入** 執行。opencodex 不持有任何 GitHub token，它唯一得知的是你的 yes 或 no。

由於這會寫入你的 GitHub 帳號，agent 驅動的呼叫者會被拒絕，而不是被允許替你回答：

- `ocx start` 與 `ocx service install` 在 agent 或 CI harness 驅動時 **完全略過該提示**
  （`CLAUDECODE`、`CODEX_THREAD_ID`、`CURSOR_TRACE_ID`、`CI` 等）。一次性 marker 保持未寫入，
  因此真正的提示仍會在你下次手動輸入時出現。agent 會被要求改為詢問你——而且是以你必須回答的
  簡單 Yes/No 選擇，而不是它可以繞過的軟性旁白。如果你一直沒有回答，agent 會被要求再次詢問，
  而不是把你的沉默當成 no。
- 當代理在 agent session 下執行且請求沒有 dashboard browser session 時，`POST /api/github/star`
  會以 `code: "agent_consent_required"` 回覆 `403`。持有 admin token 不是同意：你機器上的 agent
  可以讀取該檔案。
- Dashboard 按鈕保持正常運作。真實點擊帶有 same-origin session 證據，因此即使代理啟動了
  proxy，也會被辨識為你本人。
- 說 no 就結束。不會持久化任何東西，也不會在任何模型 prompt 中加入任何東西來日後引導你。

## 儀表板如何與代理通訊

GUI 是代理 JSON 管理 API 之上的輕量用戶端。常用 endpoint 包括：

| Endpoint | 用途 |
| --- | --- |
| `GET` / `PUT /api/settings` | 讀取設定，或更新 Codex 自動啟動、串流／記憶體設定，以及帳號指定選擇器的可見性。 |
| `GET` / `POST /api/github/star` | 讀取由 `gh` 衍生出的星標狀態，或為儲存庫加星。當 POST 由 agent 驅動的呼叫者發出、且沒有 dashboard session 時，會以 `403` `agent_consent_required` 拒絕。 |
| `GET /api/startup-health` | 讀取不含秘密資訊的路由、服務、shim 和重啟安全診斷。 |
| `POST /api/startup-action` | 透過固定的、白名單內的動作，安裝背景服務或 Codex launcher shim。 |
| `GET` / `POST /api/windows-tray` | 讀取或更改 Windows 托盤安裝和顯示狀態；POST 支援 `install`、`start`、`stop`、`uninstall`。 |
| `POST /api/sync` | 重建共享模型目錄，並把 Codex 模型快取標記為過期。 |
| `GET /api/update/check` · `POST /api/update/run` · `GET /api/update/status` | 檢查、執行並監控自我更新任務。Worker PID 會被持久化，因此當機的任務可以自動復原；沒有 PID 的舊版任務會在十分鐘後復原。 |
| `GET` / `PUT /api/sidecar-settings` | 讀取或設定 search/vision sidecar 模型。 |
| `GET` / `PUT /api/injection-model` | 讀取或設定共用的子代理模型／effort 選擇，以及獨立的指引／原生預設值開關。 |
| `GET` / `PUT /api/v2` | 讀取或設定介面模式、Codex feature flag 和 v2 thread 上限。 |
| `GET /api/providers` · `POST /api/providers` · `PATCH /api/providers?name=...` · `DELETE /api/providers?name=...` | 列出、新增／替換、啟用／停用、設定預設，或刪除 provider。`PATCH` 對已啟用的 provider 單獨使用 `{ "setDefault": true }`；`POST` 在建立／替換時可以附帶 `setDefault`（同樣僅限已啟用的 provider）。刪除目前的預設時，若還有其他已啟用的 provider，會重新指派給第一個剩餘的已啟用 provider；否則 API 會回傳 `409`、`code: "last_provider"`，並保留目前的預設。 |
| `GET /api/models` · `PUT /api/disabled-models` | 列出原生/路由模型，並更新共享的 disabled-model 集合。 |
| `GET /api/selected-models` · `PUT /api/model-visibility` | 讀取 provider allowlist，並原子地更改單個模型或 provider 分組的最終可見狀態。 |
| `GET /api/key-providers` · `GET /api/oauth/providers` | 讀取 API key 和 OAuth provider 目錄。 |
| `GET /api/oauth/accounts?provider=...&quota=1` · `GET /api/providers/keys?name=...&quota=1` | 在支援時讀取每個帳號或金鑰的配額，且不會變更現用憑證。加上 `refresh=1` 可略過已結算的配額快取；同一憑證的進行中讀取可以共用。省略 `quota=1` 可取得便宜的本機清單，每一列都帶有 `quotaMode`：`probe`、`passive` 或 `unsupported`。被動讀取回傳既有的觀測值，不會發出網路探測。沒有讀數不等於用量 0%，多把金鑰的配額也不會被加總。 |
| `POST /api/oauth/login` · `GET /api/oauth/status` | 啟動 provider OAuth 流程並輪詢完成狀態。 |
| `GET /api/codex-auth/accounts?refresh=1` | 列出主帳號與池帳號、強制重新整理配額，並回傳主帳號的 `hasCredential` / terminal `needsReauth` 狀態。 |
| `PUT /api/codex-auth/active` · `PUT /api/codex-auth/auto-switch` · `PUT /api/codex-auth/failover` | 選擇下一次請求使用的帳號並設定帳號池路由。 |
| `GET /api/codex-auth/active` · `PUT /api/codex-auth/accounts/priority` | 讀取現用帳號（包含 `pinned` 與哪個帳號是 `pinnedAccountId`），並設定某個帳號的選擇順序。 |
| `POST /api/codex-auth/login` · `GET /api/codex-auth/login-status` | 透過瀏覽器登入新增池帳號。 |
| `GET /api/logs?tail=50&limit=20&offset=0&provider=...&status=5xx` | 使用 tail、provider，以及精確／分類狀態碼篩選近期請求中繼資料。搭配 `limit`／`offset` 時，分頁會從最新的列往回走（`offset=0` 回傳最新一頁）。回應結構為 `{ timeZone, generatedAt, total, logs }`，其中 `total` 是分頁前、已篩選的列數。 |
| `GET` / `PUT /api/subagent-models` | 讀取或設定五個置頂的 `spawn_agent` override 模型。 |
| `POST /api/stop` | 停止代理／服務，恢復原生 Codex 並退出。在 Windows 工作排程器後端會以 `respawnable_service` 拒絕；當這個 proxy 本身就是已安裝的 launchd/systemd 工作時，會以 `self_unload_service` 拒絕；無法讀取工作排程器狀態時會以 `service_state_unknown` 拒絕；以上情況都不會做任何變更。 |

:::tip
從儀表板新增 **Ollama Cloud** 或其他目錄型 provider 時，其文字/視覺模型分類會寫入儲存的
provider 設定。因此無需手動分類，[vision sidecar](/zh-tw/guides/sidecars/) 也能在正確
條件下啟用。
:::

### 把這個瀏覽器與 hub 配對

機器註冊與瀏覽器驗證是分開的。配對面板會標明 hub，並顯示對應你瀏覽器目前開啟之確切 origin 的
`ocx gui pair --origin` 指令。請在 hub 上執行該指令，或把它送給 hub 維運方並索取一次性配對碼。
把該配對碼貼進面板；資料 API 金鑰或 admin token 都不是配對碼。

瀏覽器驗證還在等待期間，儀表板不會建議重新啟動一個健康的已連線用戶端。完成配對會立即刷新儀表板
資料，包括先前快取的驗證失敗。工作階段逾期會回到配對流程；權限遭拒則保有自己的存取設定指引。
其他刷新失敗可能會顯示最後收到的資料，並附上過期資料提示與重試動作。

### 用量圖表的鍵盤與觸控操作

用量熱力圖的每一天只有一個 Tab 進入點。用上／下移到相鄰的日期，左／右移到相鄰的週。週長條在
鍵盤 focus、指標 hover 或觸控時，都會顯示相同的當日細節。日期標籤包含日期、請求數與 token 數；
提示框會保持在可視範圍內。
