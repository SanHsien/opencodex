---
title: 供應商
description: opencodex 進行身分驗證並與 LLM 供應商通訊的所有方式——OAuth、API 金鑰、ChatGPT 轉送與本機。
---

**供應商（provider）** 是一個上游 LLM 端點，加上存取它的方式：adapter、base URL、認證模式，以及
可選的模型列表。供應商設定放在 `~/.opencodex/config.json` 的 `providers` 下。

儀表板的 provider Overview 會把連線細節、帳號用量與可編輯備註分開顯示。備註只會在連線與認證區塊下方
出現一次。支援 Sponsor 的 preset 還會顯示簡短介紹、Sponsor 標籤，以及供應商官網或 console 的連結；
這些連結會保留 preset 的推薦參數。只有在設定的供應商名稱、adapter 與 endpoint 都與 preset 相符時，才
會顯示 Sponsor 資訊；它絕不會改變路由、帳號選擇或預設值。

## OpenAI 帳號模式

| Provider id | 用途 | 憑證／帳號規則 |
| --- | --- | --- |
| `openai` | Codex 登入 | Pool（預設）選擇主帳號與新增帳號；Direct 只使用目前 caller／主登入。 |
| `openai-apikey` | OpenAI API | 只使用已設定的 API key／key pool；絕不讀取 Codex 帳號。 |

在 Providers 頁面使用裸 `gpt-5.6-sol` 搭配 Pool／Direct 選項，或使用
`openai-apikey/gpt-5.6-sol` 走 API。憑證路徑不會彼此 fallback。API 路徑發布的 metadata 為
1,050,000 context／922,000 max input；`sol-pro`、`terra-pro` 與 `luna-pro` virtual id 會保留使用者
選到的公開 identity，但 wire 會改用 base model 加上 `reasoning.mode: "pro"`。

若內建 `openai` 供應商缺失或已停用，儀表板 Accounts picker 與 Codex Auth 頁面可以恢復它：缺失的 row
會從 canonical preset 建立；已停用的 canonical row 會重新啟用，但不替換已儲存的 mode 或 model 設定；
非 canonical 的 `openai` row 不會提供這條恢復路徑。

Luna Reserve 相容性是 canonical OpenAI forward 路徑上的 ChatGPT 帳號能力，不是 OpenAI API-key 的權益。
它的手動 stored-main selector 需要有效的本機 authless Desktop 模式，以及目前 credential 綁定的上游
權限；單靠 catalog entry 本身不能授權請求。設定、重新啟動順序、授權需求與不受支援的輔助工具，請見
[Luna Reserve alongside routed models](/zh-tw/reference/cli/providers-accounts/#luna-reserve-alongside-routed-models)。

新增一個 quota 已用盡的帳號，並完成其延後驗證，請見
[Codex account warmup](/zh-tw/guides/codex-integration/#codex-account-warmup)。

### Providers 總覽的池容量

對 Codex 登入的 Pool 模式，Providers 總覽會顯示依設定權重估算的**池已使用容量**，而不是把任一帳號
當成 provider 總量。同一列也會顯示目前有效帳號的原始配額百分比，讓你能區分 pool estimate 與新請求
實際會使用的帳號。

當 reset 資訊可用時，總覽會顯示下一次重置時間，以及預期可恢復的容量，格式為
`+N% pool capacity`。**Incomplete coverage**（不完整覆蓋）代表至少一個 pool 帳號無法安全納入估算，
例如 plan 或 quota 未知、讀值已過期、帳號暫停，或需要重新認證。

**Partial window coverage**（部分視窗覆蓋）警告表示部分納入的帳號只回報了一個 quota window，卻缺少
另一個。總覽會把這些 window 分開，並將受影響的 window 標示為不完整，而不是把缺少的讀值當成該
window 的用量。

此估算僅供顯示，不會改變帳號選擇、session affinity、自動切換、cooldown 或其他路由決策。個別帳號
狀態與路由控制請使用 [Codex Auth 帳號池](/zh-tw/guides/web-dashboard/#codex-auth-與帳號池)。

shipped v1 設定會自動遷移到 marker 2 的 option-aware row。原始設定只會備份一次到
`~/.opencodex/config.json.pre-openai-tiers-v2.bak`；可用下列命令恢復：
`cp ~/.opencodex/config.json.pre-openai-tiers-v2.bak ~/.opencodex/config.json`。

## Anthropic 圖像輸入

內建的 Claude 模型種子資料為 `anthropic`（OAuth）與 `anthropic-apikey` 都宣告文字與圖像輸入，
與 [Anthropic 的模型總覽](https://platform.claude.com/docs/en/models/overview)一致。明確的
逐模型輸入模態覆寫仍具權威性；未知模型不會被假定具備圖像能力。這適用於任何客戶端設定支援圖像
能力中繼資料的整合：OpenClaw 匯出宣告的 `input` 陣列，Kimi Code 只對具圖像能力的模型匯出
`capabilities: ["image_in"]`。OpenClaw 在沒有宣告任何支援模態時省略 `input`；Kimi 對未知或
純文字模型省略 `capabilities`。沒有對應能力欄位的客戶端維持其既有設定形狀。更新 opencodex
之後，請重新產生或重新整理由 opencodex 管理的客戶端設定，以取得更新後的中繼資料。

## 認證模式

provider 設定接受三種 `authMode`，其中 `key` 是預設值。內建 registry 也會另外標示 local preset；這些
preset 通常同時省略 `authMode` 與 `apiKey`。

| `authMode` | 認證方式 | 使用方 |
| --- | --- | --- |
| `key` | 傳送 API 金鑰（`Authorization: Bearer …`，或依 adapter 使用 `x-api-key` / `api-key`）。金鑰可以是字面值，也可以是 `${ENV_VAR}` 引用。 | 大多數供應商。 |
| `forward` | 只轉送允許清單中的 incoming Codex 認證標頭，不儲存任何金鑰。這是 ChatGPT 登入的 passthrough。 | OpenAI（`openai-responses` adapter）。 |
| `oauth` | 讀取已儲存的 OAuth access token（到期前自動 refresh），並把它當成 bearer key 使用。 | xAI、Anthropic、Kimi、Kiro、Google Antigravity、Cursor、Command Code、GitHub Copilot、Nous Portal。 |

[`retryOn429`](/zh-tw/reference/configuration/) 的 same-key 429 replay 只適用於 API-key provider
（`authMode: "key"`）。OAuth、forward 與 local preset 都被排除：它們的 credential 絕不能在同一 token
上重播，而 local runtime 也沒有 remote key 可保留。此功能為 opt-in；未設定時關閉，物件存在時預設
啟用，除非明確設為 `enabled: false`。

### 目前請求會花費哪個帳號

在連線帳號之前，大家最常問的問題是：opencodex 究竟會動用那個登入已經付費的訂閱，還是改成向
另一個獨立的 API 帳號計費。答案取決於上面的 `authMode`，而不是供應商行銷用的方案名稱。

- `forward` — ChatGPT 登入。請求帶著你的 Codex credential，因此會消耗該登入背後的 ChatGPT 方案，
  並回報該方案的 Codex quota window。哪些 window 存在取決於方案：不是每個方案都有五小時 window。
  它絕不會讀取 API 金鑰。
- `oauth` — 訂閱登入。請求帶著已儲存的 access token，因此會消耗你登入時所用的帳號，opencodex 會
  回報該 provider 公開的任何用量 window。
- `key` — 請求帶著你提供的金鑰，因此用量會計入擁有該金鑰的帳號，依該金鑰自己的條款計費。對
  pay-as-you-go 的 API 帳號來說這是計量用量；但當金鑰**本身就是**訂閱時，則是方案額度：Z.AI GLM
  Coding Plan、Kimi Code、BigModel coding plan、Command Code 與 CodeBuddy 都是以這種方式銷售。

一次請求只會用到上述其中一種，opencodex 不會在兩者之間互相 fallback。當 OAuth credential 無法解析
時，請求會直接以認證錯誤失敗，而不會改抓已儲存的金鑰；用來因應 429 或 401 的 key-pool failover，對
OAuth 與 forward provider 一律直接拒絕。

有兩個例外值得知道，因為你可能會遇到：

- `xai` 與 `github-copilot` 在同一個 provider id 上也接受 `authMode: "key"`；若該 provider 原本就已
  儲存金鑰，執行 `ocx login` 可能會讓它停留在 key 模式，而不是切換成訂閱模式。兩者改變的東西不同：
  `xai` 金鑰會把 provider 重新指向 `https://api.x.ai/v1`，因此改由不同帳號付費；而 `github-copilot`
  金鑰仍是對 `api.githubcopilot.com` 的 Copilot credential，因此無論哪種方式都是 Copilot 訂閱付費。
- `orcarouter-oauth` 是一個同意流程，會鑄造使用者自有的 `sk-orca-…` API 金鑰。一旦鑄造完成，請求就
  帶著金鑰，因此遵循上面的 `key` 規則。

#### 同時接受帳號登入與 API 金鑰的供應商

| 供應商 | 訂閱登入 | API 金鑰 |
| --- | --- | --- |
| OpenAI / ChatGPT | `openai` — Codex 登入；消耗其背後的 ChatGPT 方案 | `openai-apikey` — 獨立的 provider；用量計入擁有該金鑰的 OpenAI Platform 帳號 |
| Anthropic | `ocx login anthropic` — 以你的 Claude 帳號登入。opencodex 會讀取其五小時與七天用量 window；該 endpoint 不回報訂閱層級 | `anthropic-apikey` — 直接的 Anthropic API 計費，沒有 Claude 訂閱 |
| xAI | `ocx login xai` — Grok CLI 訂閱 gateway。opencodex 會讀取 SuperGrok 週配額，或 monthly pool | 同一個 `xai` provider 搭配 `authMode: "key"`，指向 `https://api.x.ai/v1`，用量計入該 API 帳號 |
| Kimi | `ocx login kimi` — 以你的 Kimi 帳號登入 | `kimi-code` — 同一個 Kimi Code Plan transport 的 API-key 形式 |
| Command Code | `ocx login command-code` — opencodex 會讀取五小時與週 window，以及 credit 餘額 | `commandcode` — `/provider/v1` 上使用金鑰的同一服務 |
| GitHub Copilot | `ocx login github-copilot` — 需要有效的 Copilot 訂閱 | 同一個 `github-copilot` provider 搭配 `authMode: "key"`。上面的 device flow 是受支援路徑，兩種 credential 都是 Copilot credential，因此仍是訂閱付費 |
| OrcaRouter | `ocx login orcarouter-oauth` — 同意後鑄造使用者自有、長效的 `sk-orca-…` 金鑰，之後請求便帶著金鑰 | `orcarouter` — 手動貼上同一把金鑰 |
| Meta Muse | `ocx login meta-muse` 會匯入 Muse Code CLI 金鑰。Meta 把該 credential 限定在自己的 CLI 內，因此這是不受支援的用法：呼叫如何結算無法從 API 觀察到，你應把每次呼叫都視為會計入你帳號的費用 | `meta-model` 是受支援路徑——每次呼叫都依 token 計量，Muse Code 訂閱在這裡不適用 |

Cursor、Kiro 與 Nous Portal 僅限登入，沒有對應的 API 金鑰形式。Google Antigravity 也僅限登入：
`ocx login google-antigravity` 透過 Cloud Code Assist wire 以你的 Google 帳號登入，旁邊的 `google`
preset 則是 AI Studio 的 Gemini API——是不同產品，需要自己的金鑰，不是同一登入的 key 模式。

要確認某個 provider 實際使用哪種模式，在 Providers 頁面開啟它：**Connection** 區塊的
**Authentication** 列會顯示 `OAuth`、`API key`、`ChatGPT passthrough`、`Local` 或 `No key needed`。
這是 provider 層級的設定，下方的帳號列不會重複顯示。

## 1. ChatGPT 登入（forward / passthrough）

`openai` provider **不需要 API 金鑰**。Direct 直接轉送既有 `codex login` 的 credential；Pool 則先解析
主帳號或新增的 Codex 帳號，再使用相同 backend：

```json
{
  "openai": {
    "adapter": "openai-responses",
    "baseUrl": "https://chatgpt.com/backend-api/codex",
    "authMode": "forward"
  }
}
```

只會轉送經過篩選的標頭集合（`FORWARD_HEADERS`：authorization、ChatGPT account id、OpenAI
beta/originator/session，詳見 [轉接器](/zh-tw/reference/adapters/)）。這條路徑也支援
[web-search 與 vision sidecar](/zh-tw/guides/sidecars/)。

ChatGPT passthrough catalog 也會加入 GPT-5.6 Sol/Terra/Luna 的裸 slug：`gpt-5.6-sol`、
`gpt-5.6-terra`、`gpt-5.6-luna`；帳號具備權限時才能實際使用。

## 2. 帳號登入（OAuth）

Provider preset 可以使用帳號登入——包含透過實驗性非官方 device-flow bridge 的 GitHub Copilot。
opencodex 會把 credential 存在 `~/.opencodex/auth.json`；可 refresh 的 token 會自動 refresh，而
durable key 則會持續重複使用，直到 provider 撤銷為止。登入 CLI 也接受 `ocx login codex`，
但它不是上面的 provider 之一：它會轉到 Codex 帳號池登入——與 `ocx account login codex` 相同的流程，
該帳號池有獨立的帳號 ledger，且需要 proxy 正在執行。`chatgpt` 與 `openai` 是同一條路徑的別名。

```bash
ocx login xai          # xAI Grok
ocx login anthropic    # Anthropic Claude (Pro/Max)
ocx login kimi         # Moonshot Kimi
ocx login nous         # Nous Portal（device grant；免費 + 付費模型）
ocx login kiro         # 匯入 kiro-cli credential（或 token fallback）
ocx login google-antigravity
ocx login cursor       # 獨立 Cursor PKCE 登入
ocx login command-code # Command Code browser OAuth（或匯入 ~/.commandcode/auth.json）
ocx login orcarouter-oauth # OrcaRouter 瀏覽器同意 + PKCE
ocx login devin       # Cognition/Devin：優先匯入 Devin CLI 憑證，否則走 Auth0 瀏覽器登入
ocx login github-copilot  # GitHub device flow → Copilot token（Copilot Pro/Business）
ocx login codex        # Codex 帳號池（別名：chatgpt、openai；需要 proxy 正在執行）
ocx logout <provider>
```

| 供應商 | Adapter | Base URL | 備註 |
| --- | --- | --- | --- |
| `xai` | `openai-chat` | `https://cli-chat-proxy.grok.com/v1` | OAuth 使用獨立的 Grok CLI 訂閱 gateway。API key 覆寫使用 `https://api.x.ai/v1`，並可能注入 Priority Processing。優先使用即時 Grok catalog；fallback 預設為 `grok-4.5`。 |
| `anthropic` | `anthropic` | `https://api.anthropic.com` | Claude 模型；即時模型列表從 `/v1/models` 取得。 |
| `kimi` | `openai-chat` | `https://api.kimi.com/coding/v1` | Kimi Code 模型。`kimi-for-coding` 目前指向 K2.8 Preview，支援 100 萬 token 上下文、`low`/`high`/`max` 推理及文字、圖片輸入。`k3-256k` 的上下文上限固定為 256K。 |
| `kimi-responses` | `openai-responses` | `https://api.kimi.com/coding/v1` | 以 Responses 協定共用 `kimi` 的 OAuth 登入與模型清單。推理內容在伺服器端維持加密，工具呼叫及結果仍可見。 |
| `nous` | `openai-chat` | `https://inference-api.nousresearch.com/v1` | Nous Research 訂閱 gateway（Hermes Agent 使用相同 backend）。透過 `portal.nousresearch.com` 做 device-grant 登入；access token 是每次請求使用的 inference JWT。混合付費與 `:free` 模型 catalog（`tencent/hy3:free`、`stepfun/step-3.7-flash:free` 等）會從已登入帳號即時探索。Refresh token 為單次使用，每次 refresh 都會輪換。 |
| `kiro` | `kiro` | `https://runtime.us-east-1.kiro.dev` | 初次登入會匯入已安裝且已登入的 `kiro-cli` session。Unix 可用 `curl -fsSL https://cli.kiro.dev/install` &#124; `bash` 安裝；Windows PowerShell 使用 `irm 'https://cli.kiro.dev/install.ps1'` &#124; `iex`，再執行 `kiro-cli login`。**Add account** 會先登出 `kiro-cli`、啟動新的 browser login，切換 `kiro-cli` 所使用的帳號並保存 account-scoped profile metadata。既有 OpenCodex 帳號會保留；取消或失敗時會恢復先前的 `kiro-cli` session。 |
| `google-antigravity` | `google` | `https://daily-cloudcode-pa.googleapis.com` | 透過 Cloud Code Assist wire 使用 Google OAuth。即時探索使用 CCA 經認證的 `v1internal:fetchAvailableModels` 端點，發布目前登入帳號可用的 agent 模型；維護中的 catalog 作為 fallback。 |
| `cursor` | `cursor` | `https://api2.cursor.sh` | 實驗性 PKCE 登入、即時 HTTP/2 transport 與按帳號篩選的模型探索。 |
| `orcarouter-oauth` | `openai-chat` | `https://api.orcarouter.ai/v1` | 瀏覽器同意與金鑰交換使用 `https://www.orcarouter.ai`，採 S256 PKCE。回傳的使用者自有 `sk-orca-…` API 金鑰會存進既有 credential store，持續重複使用直到被撤銷為止。 |
| `devin` | `devin` | `https://server.codeium.com` | 實驗性的非官方 Cognition/Devin 橋接。登入會先匯入已安裝 Devin CLI 已持有的憑證（`devin auth login` 會把 `devin-session-token` 寫入它自己的 `credentials.toml`）；沒有則開啟 Auth0 瀏覽器頁面，再以 `RegisterUser` 將貼上的權杖換成長期 API 金鑰。`ocx login devin-cli` 仍作為已棄用別名可用。模型清單依帳號透過 `GetCascadeModelConfigs` 即時取得。預設不在儀表板預設集內。已針對一個真實帳號、跨三個模型驗證過 chat 與用量回報。 |
| `github-copilot` | `openai-chat` | `https://api.githubcopilot.com` | 實驗性。GitHub device flow + `copilot_internal` exchange（VS Code OAuth client）。需要有效 Copilot 訂閱；不是官方第三方 API。 |

Google Antigravity 帳戶與供應商的配額查詢（包括模型清單備援）使用固定的 Google 計量端點。這些目標支援透明 Fake-IP DNS，同時保留 TLS 驗證、重新導向拒絕與私有位址檢查。自訂 base URL 只改變模型請求，不改變配額目標；`NO_PROXY` 仍使用直連政策。

### Google 工具結構描述損失診斷

Google 工具宣告會依所選端點類別進行編譯。透過 `ocx debug provider on`、儀表板 Logs 開關或
`OCX_DEBUG=1` 啟用供應商偵錯後，在省略政策或使用 `compatible` 的路徑上，相容性轉換中的結構描述損失會輸出一筆
`[ocx:google:google-tool-schema-loss]` 記錄（可用 `ocx debug provider logs -f` 持續查看），
其中只包含報告版本、端點類別、`lossy` 指標、有上限的不確定比較計數、帶有上限計數的固定損失類別與截斷旗標，
絕不包含工具名稱、屬性名稱、路徑、值或結構描述文字。省略政策或使用 `compatible` 時只觀察
轉換。在 `reject-lossy` 下，若初始編譯有損或有界比較結果不確定，會在傳送前拒絕；被拒絕的
請求不會另外輸出損失記錄。在 `reject-lossy` 下，會移除限制的
Vertex 或 Cloud Code Assist 修復會輸出同樣不含內容的 `google-tool-schema-repair` 記錄，並在不傳送
修改請求的情況下回傳原始 400；省略政策或使用 `compatible` 時，會像以前一樣重播修復後的請求。
直接 AI Studio 不執行此修復。原生輸出結構描述不屬於這兩條政策路徑。請參閱
[偵錯命令參考](/zh-tw/reference/cli/agents/)。


終端 Nous refresh 失敗後，執行 `ocx login nous` 重新認證。

對 canonical Kimi Coding Plan preset（`kimi` 帳號登入與 `kimi-code` API key），opencodex 只會把 caller
提供且穩定的 `prompt_cache_key` 轉送到 Chat Completions 請求，絕不自行產生。Kimi 文件指出，穩定的
session／task key 有助提升 Code Plan cache hit rate；沒有 key 的請求仍保持 keyless。若已 opt-in 的上游
拒絕此欄位，opencodex 不會移除欄位後重試，也不會修改已儲存設定。其他 provider 預設 deny-by-default。

`kimi`、`kimi-code` 和 `kimi-responses` 的 `k3`、`k3[1m]`、`k3-256k` 費用是採用預設五分鐘
快取寫入費率的 [API 價格](https://platform.kimi.ai/docs/pricing/chat)估算，並非 Code Plan 的實際
帳單或額度用量。K3 的 1M 版本約耗用 `k3-256k` 兩倍額度。`kimi-for-coding` 已轉為 K2.8 Preview，
因此不再套用舊 K2.7 價格；除非使用者設定 `modelCosts`，其費用估算會維持未知。排除未知費用的
路由規則可能因此略過這個別名。

自訂的 `openai-chat` provider 可以在上游文件支援 `prompt_cache_key` 時選擇加入：

```json
{
  "providers": {
    "example-compatible-provider": {
      "adapter": "openai-chat",
      "baseUrl": "https://api.example.com/v1",
      "apiKey": "${EXAMPLE_API_KEY}",
      "promptCacheKey": true
    }
  }
}
```

轉接器只會轉送它收到的 key，絕不自行發明。它仍可能收到呼叫者沒有送出的 key：Claude Messages
轉換會從 `metadata.user_id` 推導一個，或在客戶端未送出中繼資料時從模型／系統／工具的組合推導，
因為 OpenAI 後端對每個無 key 的請求都回報 `cached_tokens: 0`。所以「轉送、不憑空生成」描述的
是這個轉接器，不是整條請求路徑。

新增此選項時請保留其餘 provider 設定，然後重新載入或重啟 opencodex。要驗證快取是否生效，
請比對最初的冷請求與之後帶有相同穩定 key 的請求。對不相容的上游請省略此選項或設為 `false`，
若嚴格的 gateway 回傳 HTTP 400 未知欄位錯誤，請停用或移除它。

也可以從 [web 儀表板](/zh-tw/guides/web-dashboard/) 啟動 OAuth。

### 從另一個瀏覽器設定檔，或另一台機器登入

登入開始時，proxy 會在**它自己**所在的機器上，用作業系統預設瀏覽器開啟授權 URL——也就是預設的瀏覽器
設定檔。對本機桌面情境這是正確行為，但在兩種常見情況下並不適用：你需要用不同的瀏覽器設定檔（例如
工作身分、第二個帳號），或者儀表板連的是執行在別處的 proxy。

每個登入介面都會顯示帶複製按鈕的授權 URL、provider 發放 device code 時的 device code，以及一個可以
貼回 redirect URL 或授權碼的欄位。所以你隨時都能手動完成登入。

若要完全阻止 proxy 開啟瀏覽器，可在登入按鈕旁勾選**不要在 proxy 機器上開啟瀏覽器**，或永久設定：

```json
{ "oauthOpenBrowser": false }
```

省略此設定與設為 `true` 都會開啟瀏覽器，因此既有安裝不會有任何改變；只有明確設為 `false` 才會拒絕。
`POST /api/oauth/login` 與 `POST /api/codex-auth/login` 也接受 per-request 的 `openBrowser` 布林值，
會覆寫該次登入所儲存的設定。

有兩種情況行為不同，值得弄清楚自己屬於哪一種：

- **同一台機器上的不同瀏覽器設定檔**：光靠複製的連結就能完成。`127.0.0.1` 上的迴路 callback 仍會
  完成整個流程。
- **不同機器上的瀏覽器**：還需要貼上的 fallback，因為 redirect URI 仍然是 proxy 主機上的
  `http://127.0.0.1:<port>/callback`。請在那裡完成登入，再把 redirect URL（或只是授權碼）貼回儀表板
  或 `ocx account code`。

Device-code provider 在兩種情況下都不會從 proxy 開啟瀏覽器：它們只會顯示一個代碼與一個驗證 URL，供你
在自己已登入的地方開啟。

### 多個 OAuth 帳號

credential 內含穩定 account id 或 email 的 OAuth provider 可以保存多個登入。Providers 頁面會在下拉
選單顯示這些帳號、允許新增帳號，並在不登出其他帳號的情況下切換目前帳號。一般登入時，沒有 identity 的
Kimi credential 會取代 active slot；明確的 **新增帳號** 會保留原有 slot 並啟用另一個新 slot。Kiro 帳號以
profile ARN 作為 key。`chatgpt` 始終是 single-slot，因為
Codex pool 帳號使用獨立 ledger。Token 仍存放在 `~/.opencodex/auth.json`；`/api/oauth/accounts` 只回傳
遮蔽後的 metadata。

### Cockpit Tools Antigravity 匯入

目前 v1 只會為 `google-antigravity` provider 匯入 **Cockpit Tools Antigravity** JSON export。在 Providers
儀表板中，從該 provider 的 Accounts 分頁選擇本機 JSON 檔案。儀表板不會顯示檔案內容或 credential
值，只會回報 imported、updated、failed 與 unsupported 數量。其他 Cockpit provider 在 v1 會被拒絕。

CLI 只接受來自檔案或標準輸入的 export，絕不要直接貼進 command argument：

```bash
ocx account import google-antigravity --format cockpit-tools --file <path> [--json]
cat accounts.json | ocx account import google-antigravity --format cockpit-tools --stdin [--json]
```

inline JSON 與額外 positional argument 都會被拒絕。請將 export 檔案保持私密，匯入後安全刪除或妥善
保存。

### OAuth 可靠度

opencodex 協調 token refresh 與 Codex pool 路由，避免並行請求競爭 credential store。這是可靠度與診斷
工作，**不**代表能繞過 provider enforcement、rate limit 或帳號動作。

**Refresh 協調。** 路由呼叫前，過期的 access token 每個 `(provider, account)` 只 refresh 一次：

1. In-process single-flight：並行 caller 共用同一個 refresh promise。
2. Per-account file lock：跨 process writer 在同一帳號上序列化。
3. Generation CAS：只有已儲存 credential generation 仍相符時才持久化；較新的 writer 勝出，舊的
   refresh result 不能覆寫它。

終端 refresh 失敗會把帳號標示為需要重新認證，而不是無限重試。

**Cooldown（Codex pool）。** 上游 `429`／quota response 會依 `Retry-After`、quota `reset` header
（有上限）或短預設 backoff 設定 hard cooldown。明確 `Retry-After` cooldown 中的帳號不會被提前 probe；
reset 衍生 cooldown 可能取得節流後的 probe lease，在不淹沒 provider 的情況下偵測恢復。由 reset 衍生的
native-model cooldown 會將共享原生 quota（含 GPT-5.6 Terra/Luna）與 `gpt-reserve` 分開。
共享群組內的模型仍會互相保護；一般請求成功不會清除 Reserve cooldown。明確 `Retry-After` 與預設 cooldown 始終為
account-wide。

**Session affinity。** Codex thread→account affinity 只存在目前 process 記憶體，不會跨 proxy restart
持久化。credential 失敗（`401`／`403`）時，帳號會被 quarantine 等待 reauth，並清除該帳號的 affinity。
收到 `429` 時，帳號進入 cooldown、affinity 被清除，pool selection 可以輪換；thread 不會在 rate-limit
response 後仍被固定在同一帳號。

**Codex client metadata。** ChatGPT forward 路徑會轉送經篩選的 `FORWARD_HEADERS` allowlist
（authorization、`chatgpt-account-id`、originator、session/thread id 與其他相關 Codex header，詳見
[轉接器](/zh-tw/reference/adapters/)）。Pool 模式只覆寫 auth 與 `chatgpt-account-id`，讓它們符合選中的
credential。caller 沒有送出時，opencodex **不會**捏造官方 client identity，例如 `originator`、session
或 thread header。

**診斷與重新認證。** 一般 `ocx status` 會印出 OAuth health 區塊，只顯示遮蔽後 account id，不含 token。
`ocx doctor` 會新增 OAuth reliability 區段，包含 writable-store／single-flight check，以及帶 recovery
Action 的 WARN row。OAuth provider 帳號需要重新認證時，執行 `ocx login <provider>`，或在儀表板使用
Reauthenticate。Codex pool 帳號不是那些 provider 之一，但 `ocx login codex --reauth` 會轉到它們的帳號池
重新認證，儀表板的 Codex account pool 也做同一件事。
相關命令請參見 CLI 參考的 [`ocx status` / `ocx doctor`](/zh-tw/reference/cli/)。

### Kiro credential 匯入

Kiro 登入預期存在 Kiro CLI。Unix 可用 `curl -fsSL https://cli.kiro.dev/install | bash` 安裝；Windows
PowerShell 使用 `irm 'https://cli.kiro.dev/install.ps1' | iex`；接著以 `kiro-cli login` 登入。若沒有
`kiro-cli` session，`ocx login kiro` 會 fallback 到貼上的 access token 或 `KIRO_ACCESS_TOKEN` 環境變數。

`ocx login kiro` 匯入流程會搜尋各平台的 Kiro CLI store，並以唯讀模式開啟 SQLite database。兩個環境
變數可明確指定來源與 token row：

- `KIROCLI_DB_PATH` 指定非標準 Kiro CLI SQLite database。路徑必須已存在；此匯入流程不會建立或修改
  database、WAL 或 SHM 檔案。
- `KIROCLI_TOKEN_KEY` 在 database 有多個 otherwise ambiguous token row 時，指定精確的 `auth_kv`
  token key。未指定時會讓登入失敗，而不是猜測。

Windows 匯入會尋找 `%LOCALAPPDATA%\Kiro-Cli\data.sqlite3`。forced／add-account login 也需要本機 CLI
binary：opencodex 先使用 `PATH`，再 fallback 到 `%LOCALAPPDATA%\Kiro-Cli\kiro-cli.exe` 與
`C:\Program Files\Kiro-Cli\kiro-cli.exe`。
若兩個資料夾都沒有 `kiro-cli.exe`，會改用同樣這兩個 `Kiro-Cli` 資料夾內的 `kiro.exe`。
opencodex 絕不執行在 `PATH` 或 macOS/Linux 共用 bin 目錄中找到的 `kiro` 或 `kiro.exe`，
請在那裡以 `kiro-cli` 名稱安裝或連結 CLI。

成功匯入後，opencodex 會把 credential 寫入 `~/.opencodex/auth.json`。

請將這些變數與所選 database 保持私密。不要把 database 檔案或原始登入診斷附在 bug report。

**Add account** 是獨立的寫入流程：它會 snapshot 目前 session、登出 `kiro-cli`，再匯入新的 browser
login。若登入取消或失敗，包括 OpenCodex 持久化 credential 期間失敗，rollback 會先替換 Kiro CLI
database 並移除目前的 WAL、SHM 與 journal sidecar，再發布先前的 session snapshot。

由於 rollback 只能依賴 snapshot，若 session store 存在卻無法擷取，例如檔案不可讀、schema 不符或 token
選擇有歧義，**Add account** 會拒絕登出 `kiro-cli`。當 `KIROCLI_DB_PATH`／`KIRO_CLI_DB_FILE` 將匯入
讀取重導到 live CLI store 之外，或既有主 CLI database 沒有可識別 token row 時，也會拒絕。請在一般
`kiro-cli` data path 修復或移除不可讀 database、取消這些 import selector 後重試。沒有既有
`kiro-cli` session 的新機器登入不受影響。

## 3. API 金鑰目錄

opencodex 內建 99 個 preset：82 個 key-based、13 個 OAuth、3 個 local，以及 1 個預設 ChatGPT-forward
preset。儀表板的 **Add provider** picker 會開啟 key provider 的 dashboard、驗證金鑰並儲存；驗證方式
依 provider 而異。主要條目如下。

**ClinePass** 使用 Cline API key，搭配[官方訂閱 catalog](https://docs.cline.bot/getting-started/clinepass)
與 [Chat Completions endpoint](https://docs.cline.bot/api/chat-completions)，由 Cline Bot Inc. 依
[Cline terms](https://cline.bot/tos) 提供。像 `cline-pass/cline-pass/kimi-k3` 這類 routed id 是刻意設計：
第一段選擇 opencodex provider，後面的 `cline-pass/kimi-k3` 才是送往上游的完整 model slug。ClinePass
quota 由帳號共用，包含 rolling 5-hour、weekly 與 monthly limit。2026-08-13 的 live probe 已確認所有
靜態 ClinePass model 在 gateway input 邊界都接受 `low`、`medium`、`high`、`xhigh` 與 `max`。opencodex
會保留這些 requested tier；任何 backend-specific 的 normalization 都由 ClinePass 自行負責。

**Cline** 使用相同 API key 與 endpoint，但採 pay-as-you-go 用量計費，可使用 100+ 模型，包括
OpenRouter 風格 id，例如 `anthropic/claude-sonnet-4-6`。Cline 的 promotional free model 只提供給 Cline
IDE／CLI，不透過 API；`minimax/minimax-m2.5` 是文件列出的 API 免費實驗模型。

**OrcaRouter**（[sponsor](https://github.com/lidge-jun/opencodex/blob/main/SPONSORS.md)）是一個
OpenAI-compatible gateway，位於 `https://api.orcarouter.ai/v1`，採用 vendor-namespaced model id
（`openai/gpt-5.5`、`anthropic/claude-opus-4.8`、`deepseek/deepseek-v4-flash` 等），並提供一個自適應
router `orcarouter/auto`，會為每個 prompt 評分並挑選模型。請在
[OrcaRouter console](https://www.orcarouter.ai/console) 建立 key；preset 會把該列釘選在 Add provider
picker 的頂端附近並標記為 sponsor，路由或預設值不會因此改變。

**PackyCode**（[sponsor](https://github.com/lidge-jun/opencodex/blob/main/SPONSORS.md)）是 Claude Code、
Codex、Gemini 等產品的 API relay。preset 指向它們 OpenAI-compatible 的 Chat Completions endpoint
`https://cf.api.fan/v1`，即時模型探索會依你的 token group 權限收窄（預先埋入 `gpt-5.5` 與
`gpt-5.1-codex`）。請在 [packyapi.com](https://www.packyapi.com/register?aff=k5KT) 註冊並建立 Codex-group
token；preset 會把該列釘選在 Add provider picker 的頂端附近並標記為 sponsor，路由或預設值不會因此
改變。

| 供應商 | Base URL |
| --- | --- |
| **OpenAI (API key)** | `https://api.openai.com/v1` |
| **Anthropic (API key)** | `https://api.anthropic.com` |
| **OpenRouter** | `https://openrouter.ai/api/v1` |
| **Cline** | `https://api.cline.bot/api/v1` |
| **ClinePass** | `https://api.cline.bot/api/v1` |
| **Ollama Cloud** | `https://ollama.com/v1` |
| Google Gemini · Google Vertex AI | `https://generativelanguage.googleapis.com` · `https://aiplatform.googleapis.com` |
| Azure OpenAI | `https://{resource}.openai.azure.com/openai` |
| Umans AI · Neuralwatt | `https://api.code.umans.ai` · `https://api.neuralwatt.com/v1` |
| Mistral | `https://api.mistral.ai/v1` |
| MiniMax · MiniMax (CN) | `https://api.minimax.io/v1` · `https://api.minimaxi.com/v1` |
| DeepSeek | `https://api.deepseek.com` |
| Cerebras | `https://api.cerebras.ai/v1` |
| Chutes | `https://llm.chutes.ai/v1` |
| DeepInfra | `https://api.deepinfra.com/v1/openai` |
| Hyperbolic | `https://api.hyperbolic.xyz/v1` |
| Nscale Serverless Inference | `https://inference.api.nscale.com/v1` |
| Vultr Serverless Inference | `https://api.vultrinference.com/v1` |
| Baseten Model APIs | `https://inference.baseten.co/v1` |
| Command Code | `https://api.commandcode.ai/provider/v1` |
| OrcaRouter | `https://api.orcarouter.ai/v1` |
| PackyCode | `https://cf.api.fan/v1` |
| Meta Model API | `https://api.meta.ai/v1` |
| Meta Muse Code（CLI credential） | `https://api.meta.ai/v1` |
| SambaNova Cloud | `https://api.sambanova.ai/v1` |
| Nebius Token Factory | `https://api.tokenfactory.nebius.com/v1` |
| Crusoe | `https://api.inference.crusoecloud.com/v1` |
| DigitalOcean Serverless Inference | `https://inference.do-ai.run/v1` |
| Scaleway Generative APIs | `https://api.scaleway.ai/v1` |
| Featherless AI | `https://api.featherless.ai/v1` |
| Novita AI | `https://api.novita.ai/openai/v1` |
| Together | `https://api.together.xyz/v1` |
| Fireworks | `https://api.fireworks.ai/inference/v1` |
| Moonshot (Kimi API) · Kimi (coding) | `https://api.moonshot.ai/v1` · `https://api.kimi.com/coding/v1` |
| Hugging Face | `https://router.huggingface.co/v1` |
| NVIDIA NIM | `https://integrate.api.nvidia.com/v1` |
| Z.AI (GLM Coding) | `https://api.z.ai` — 預設 Responses 在 `/api/v1/responses`；Chat Completions 在 `/api/coding/paas/v4/chat/completions`，依模型透過 `modelAdapters` 切換 |
| Zhipu AI (BigModel) | `https://open.bigmodel.cn/api/paas/v4` |
| BigModel Coding Plan（Responses，靜態模型清單） | `https://open.bigmodel.cn/api/v1` |
| Qwen Cloud | Token plan（預設）：`https://token-plan.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1` · pay as you go：`https://dashscope.aliyuncs.com/compatible-mode/v1` · 或 Custom |
| Tencent Cloud Coding Plan | `https://api.lkeap.cloud.tencent.com/coding/v3` |
| SiliconFlow | `https://api.siliconflow.cn/v1` |
| Volcengine Ark · Coding Plan · Agent Plan | `https://ark.cn-beijing.volces.com/api/v3` · `https://ark.cn-beijing.volces.com/api/coding/v3` · `https://ark.cn-beijing.volces.com/api/plan/v3` |
| Xiaomi MiMo | `https://api.xiaomimimo.com/anthropic` |
| Xiaomi MiMo (OpenAI Chat) | `https://api.xiaomimimo.com/v1` |
| Kilo | `https://api.kilo.ai/api/gateway` |
| GitLab Duo | `https://cloud.gitlab.com/ai/v1/proxy/openai/v1` |
| Cloudflare AI Gateway | `https://gateway.ai.cloudflare.com/v1/{account-id}/{gateway}/anthropic` |
| …以及更多 | opencode zen、Vercel AI Gateway、Venice、NanoGPT、Synthetic、Qianfan、Alibaba、Parallel、ZenMux、LiteLLM |

**OpenCode Go** 的路由需要穩定的 session identifier。OpenCodex 會從 Codex thread／session header 推導
它的 Go session header；當沒有 Codex header 時，則改用 client 的 `x-opencode-session` header。這適用於
直接的 Chat Completions 請求，以及橋接到 Responses 的請求。即使是帶 `ocx_` 前綴的 inbound 值，也會被
當成 client 輸入並雜湊進 Go affinity；內部 bridge 會攜帶原始值，因此原生 Chat、橋接後的 Chat 與
Responses 會得出相同結果。明確的 provider-config session header 是維運方的覆寫值，會原樣送出。
Client 必須讓 identifier 在同一段對話中保持穩定，並在不同對話間互不相同。沒有任何 session identifier
的請求，不會被賦予推論出的跨請求身分；而是被送進一個只為該請求配置的 session，與所有其他請求隔離
（該值如何攜帶請見 provider 參考）。對 Claude Messages 而言，設定好的 OpenCode Go session header 仍
具最高優先權；否則，有效的明確 session 或 thread header 優先，`metadata.user_id` 中有效的對話身分則
作為 fallback。這個 fallback 會套用到最終的 Go 目的地，包括隨機 combo 選擇與 fallback 嘗試，而不是
初步路由。共享的 system-prompt cache key 不能識別對話，Go 專屬的身分也不會送往非 Go 目標。自動產生的
Pi provider 設定會啟用 `compat.sendSessionAffinityHeaders`，讓 Pi 把它的 per-session 身分送給 proxy。
既有的手動管理 Pi 設定，也能在自己的 `opencodex` provider 上設定此選項。當 `cacheRetention` 為 `none`
時，Pi 可以省略 session affinity；需要穩定上游 session 時，請啟用 cache retention。

**OpenCode Zen**（`opencode-zen`）與無 key 的 **OpenCode Free** preset 共用
`https://opencode.ai/zen/v1`。該 gateway 的免費模型常遇到短時間 burst limit，約 15–20 requests/minute
（社群實測；OpenCode 未公布 RPM）。Zen 可能回傳 generic rate-limit 429，而沒有 `Retry-After`／
`X-RateLimit-*` header。這與 OpenCode 宣告的 keyless desktop quota 是不同限制：`opencode-free` 約每 5
小時 200 次 Big Pickle／free-model request。Zen 在這類 429 省略 `Retry-After` 時，opencodex 會在 client
error 加入 provider guidance 與 synthetic `Retry-After`；若上游有 `Retry-After`，仍以上游值為準。
same-key wait-and-retry 仍需透過 [`retryOn429`](/zh-tw/reference/configuration/) 明確 opt-in。

**無 key 的 `opencode-free` tier 目前對第三方 client 關閉。** Zen 會拒絕任何沒有帶 `x-opencode-session`
header 的 request，回傳 error type `MissingSessionID` 與訊息 "OpenCode's free tier can only be used in
OpenCode"。這道 gate 只檢查該 header 是否存在，因此 proxy 大可捏造一個值通過，但 opencodex 不這麼做。
偽造 session identifier 並附上帶版本號的 `opencode/<version>` User-Agent，等於宣稱自己就是 OpenCode
client，而 OpenCode 並未公布這個 keyless tier 的第三方整合合約；用這種方式取得的 HTTP 200 是繞過
admission check，而不是取得授權。因此 opencodex 選擇如實回報限制：送往 `opencode-free` 的 request 會
收到一則說明上游 gate 的 error。

通往同一批模型的受支援路徑，是使用 [opencode.ai/auth](https://opencode.ai/auth) 取得的 OpenCode Zen API
key，走帶 key 的 **`opencode-zen`** preset。若 OpenCode 日後公布 keyless tier 的第三方路徑，opencodex 可以
跟進；在此之前，這個 preset 的作用是記錄該限制。上游條款：[opencode.ai/docs/zen](https://opencode.ai/docs/zen/)。

大多數 provider 使用帶 bearer key 的 `openai-chat` adapter；**Xiaomi MiMo**（`xiaomi`）等
相容 Anthropic 的 preset 則使用 `anthropic` adapter（`x-api-key`）。Xiaomi 另有 OpenAI Chat
preset `xiaomi-mimo`，以及 token plan preset `mimo`。三者都預設使用 MiMo V2.6
（`mimo-v2.6-pro`；`xiaomi-mimo` 使用 `mimo-v2.6-flash`）。Xiaomi 將於 2026-10-21 停用
`mimo-v2.5` 和 `mimo-v2.5-pro`，且不提供重新導向；請在期限前更換已儲存的 V2.5 預設模型，
opencodex 不會替你改寫。
在已驗證的 Ark Coding Plan 工具 continuation 中，把上一輪 Responses 回傳的 `reasoning` item 原樣送回會得到 `400 InvalidParameter`，因此 Coding Plan preset 會在轉送 continuation input 前移除這類 item；該輪的 reasoning 狀態會因此遺失，可用 `dropResponsesReasoningItems: false` 關閉。已經以 `openai-chat` 儲存的 Coding Plan 設定不會被改寫，仍走 Chat；要切換請手動把 `adapter` 改成 `openai-responses`、`responsesPath` 設為 `/responses`，或刪除後重新加入該 preset。Volcengine Coding Plan 與 Agent Plan 透過
`openai-responses` 使用原生 Responses endpoint。內建 DeepSeek preset 也會把 `deepseek-v4-flash` 路由到
原生 Responses endpoint，並保持上游 SSE streaming。若該模型完成所有 output item 卻省略最後的
Responses event，opencodex 會套用 5 秒、model-scoped 的 grace repair；malformed 或 partial stream 會以
incomplete 關閉，不會被誤報為成功。
第一方 `deepseek-flash` 模型原生宣告支援 `text` 與 `image` 輸入，因此圖片請求預設會直接送往
DeepSeek，不經過 vision sidecar。明確的 `noVisionModels` 或純文字宣告仍然優先。第一方
`deepseek-chat`、`deepseek-reasoner` 與 `deepseek-v4-flash` 預設仍使用 sidecar；Zen 路由維持不變，
本次更新未進行探測。

> **三條 Volcengine 計費路徑：** `volcengine` 是 pay-as-you-go Ark API，
> `volcengine-coding-plan` 消耗 Coding Plan quota，`volcengine-agent-plan` 消耗 Agent Plan quota。請使用
> 同一產品發出的 key 與 endpoint；即使已有 Plan 訂閱，普通 `/api/v3` endpoint 仍可能產生
> pay-as-you-go 費用。preset 使用 curated static model catalog，因為 Ark `/models` 也包含 embedding、
> image、video 與 3D resource，Coding gateway 會回傳相同 broad catalog，而 Agent Plan gateway 沒有
> `/models` resource。Pay-as-you-go 預設 `doubao-seed-2-1-pro-260628`，curated catalog 也包含目前的
> DeepSeek 與 GLM text model。Coding Plan 預設 `ark-code-latest`；Agent Plan 預設 `deepseek-v4-flash`。

> **Volcengine Plan 使用限制：** Volcengine 文件指出 Coding Plan 與 Agent Plan quota 只能在受支援的
> AI coding tool 內使用，並警告把 plan key 用於一般 API call 可能導致訂閱停權或帳號封鎖。透過
> opencodex 路由 Codex 或 Claude Code 屬於文件所述用途；不要把 plan key 指向其他 automation。
> pay-as-you-go 的 `volcengine` 路徑沒有此限制。

**Chutes 探索。** `chutes` preset 使用 Chutes 固定、共用的 OpenAI-compatible LLM gateway。它讀取公開的
`/v1/models` catalog，只保留 `supported_features` 宣告 `tools` 的 row，保留含 `/` 的 model id 與安全
live metadata，並把 discovery 限制在 256 KiB／128 個 raw row。因 catalog 是公開的，不能用成功讀取來
證明提供的 key 有效；chat request 仍使用設定的 Bearer key。使用者自行部署的 custom Chute host 與
Chutes 非 LLM API 仍屬於 custom-provider 範圍。可從 [Chutes dashboard](https://chutes.ai/auth/start) 建立
key。

**DeepInfra 探索。** key-based `deepinfra` OpenAI Chat Completions provider 使用 `openai-chat` adapter 與
Bearer API key。registry 管理的 model-list URL 只保留標為 `chat` 的 row，保留含 `/` 的原生 model id，
並把 live discovery 限制在 512 KiB／512 個 raw row。可在
[DeepInfra dashboard](https://deepinfra.com/dash/api_keys) 建立 key。

**Hyperbolic 探索。** preset 會用設定的 bearer key 讀取 `/v1/models`，保留含 `/` 的原生 model id，
並把 discovery 限制在 256 KiB／256 個 raw row。範圍只涵蓋 serverless text 與 vision-language chat；
Hyperbolic 另外的 image、audio 與 GPU endpoint 不在範圍內。可在
[Hyperbolic](https://app.hyperbolic.ai) 建立 key。

**Nscale 與 Vultr 探索。** 兩個 preset 都讀取 provider 經認證的 `/v1/models` catalog、保留原生 id，並
把 discovery 限制在 256 KiB／256 個 raw row。Nscale catalog 混合 chat、image 與 embedding model，卻
沒有 modality 欄位，因此 preset 只允許 `meta-llama/Llama-3.1-8B-Instruct`，也就是 Nscale 官方
工具呼叫 API 範例使用的模型。Vultr 目前只為 `kimi-k2-instruct` 文件化 tool calling，因此 preset 只
暴露該模型。其他 row 在 provider 發布同等 agent-tool evidence 前保持隱藏。Nscale service token 可在
[Nscale Console](https://console.nscale.com) 建立；Vultr inference key 可從
[Vultr Console](https://my.vultr.com) 的 subscription overview 複製。

**Command Code 探索。** preset 從固定的 Provider API 主機讀取 Command Code 的
`/provider/v1/models` 清單，保留 provider 原生 ID，並將探索限制在 256 KiB／256 筆原始資料。
`ocx login command-code` 支援透過瀏覽器登入 OAuth；既有 Command Code CLI 使用者也可選擇從
`~/.commandcode/auth.json` 匯入本機 CLI 憑證。模型目錄依帳號而定，登入後由經認證的探索端點取得。
Provider-API preset（`commandcode`）會傳送目前設定的有效金鑰：多數模型 ID 使用 Chat Completions
及 Bearer 標頭；`claude-*` ID 則使用 Anthropic Messages 及 `x-api-key`，因為 Command Code 只在
`/provider/v1/messages` 提供這些模型。若其他 provider 將 `commandcode` 名稱用於不同端點，
仍沿用自己的傳輸格式。OAuth preset（`command-code`）使用已儲存的帳號 bearer 進行認證探索，
並從 `/alpha/generate` 以 NDJSON 串流生成內容。若 gateway 將 MiMo 工具呼叫標記以文字回傳，
且與實際呼叫重複，就會移除該標記。對 MiMo 模型而言，呼叫已宣告工具、內容完整但沒有對應原生呼叫的標記，
只會在正常結束後還原；中斷或遭過濾的回合則保留標記文字。Provider-API 金鑰可在
[Command Code Studio](https://commandcode.ai/studio/) 建立。

**OrcaRouter 認證與探索。** 可選擇 `ocx login orcarouter-oauth` 進行一鍵瀏覽器授權，或用
`ocx login orcarouter` 貼上既有 API key。PKCE 流程會先啟動一個迴路 listener，送出全新的 S256
challenge 與 state 到 `https://www.orcarouter.ai/auth`，在 `https://www.orcarouter.ai/api/v1/auth/keys`
交換單次使用的 code，並把回傳、使用者自有的 key 存進 `~/.opencodex/auth.json`。手動填 key 的 preset
仍沿用一般的 provider key store。兩種模式都路由到 `https://api.orcarouter.ai/v1`，並以
`capability=chat` 探索公開的即時 catalog；非 chat 的 media／rerank row 會被排除，回報的 input
modality 則決定 Codex 是否提供圖片附件。因為 catalog 本身是公開的，手動設定 key 時驗證結果會回報為
unknown，而不會把該回應當成 key 有效的證明。

對單一 origin 的自架部署，請在第一次 PKCE 登入前設定共用 origin；儲存的 inference URL 會從同一個
origin 推導：

```bash
ORCAROUTER_BASE_URL=https://router.example ocx login orcarouter-oauth
```

對拆分的自架部署，請分別設定 `ORCAROUTER_API_BASE_URL` 與 `ORCAROUTER_AUTH_BASE_URL`。

此值必須是 HTTPS origin（本機開發可用 HTTP 迴路），不能帶 credential、query 或 fragment。第一次登入
迴路／私有自架 endpoint 之前，請在 `~/.opencodex/config.json` 的 provider row 明確允許該目的地。舉例
來說，把下列項目合併進既有的 `providers` 物件，供本機開發伺服器使用：

```json
{
  "orcarouter-oauth": {
    "adapter": "openai-chat",
    "baseUrl": "http://127.0.0.1:9999/v1",
    "authMode": "oauth",
    "allowPrivateNetwork": true
  }
}
```

接著執行 `ORCAROUTER_BASE_URL=http://127.0.0.1:9999 ocx login orcarouter-oauth`。登入會保留這項明確
同意；單獨設定 URL 絕不會啟用 private-network access。沒有這個 opt-in，目的地驗證會拒絕該 endpoint 的
inference 與 model discovery。這項要求針對 provider endpoint；瀏覽器 callback listener 不需要這種
opt-in。relay 回傳 `401` 後請重新登入；OrcaRouter 金鑰是 durable 的，沒有 refresh-token grant。

**Meta Model API（`meta-model`）。** Muse Spark 架在 Meta 自己的 OpenAI-compatible endpoint 上，走
`/v1/responses`。請在 [Meta developer console](https://dev.meta.ai/docs/authentication) 建立 key——Meta
把這個變數叫做 `MODEL_API_KEY`，但 opencodex 是從 provider id 推導環境變數名稱，因此請匯出成
**`META_MODEL_API_KEY`**（或在 `ocx init` 過程中貼上）。帳號需要先綁定付款方式才會服務請求，且每次
呼叫都依 token 計量。預先埋入兩個模型——`meta-model/muse-spark-1.3` 與
`meta-model/muse-spark-1.3-contributor`——搭配 vendor 的 `minimal`/`low`/`medium`/`high`/`xhigh` 階梯與
1M context window。在已認證的模型清單被驗證之前，discovery 保持關閉，因為 Meta 在同一個 host 上還
提供 image 與 voice 模型。

選用它之前有兩件事值得知道。**Muse Code 訂閱在這裡不適用：** Meta 把該 credential 限定在 Muse Code
CLI 內，任何其他 key 都以 pay-as-you-go 計費。而 Contributor 層之所以便宜，是因為 Meta 會用你的
prompt 做訓練——input 約便宜 92%、output 約便宜 95%、cached input 約便宜 99%——因此請不要把機密內容
放進去。Muse Spark 也能透過經銷商取得，但模型清單較窄：`command-code` 同時提供兩個層級，而
`opencode-go` 只提供 `muse-spark-1.3-contributor`。

**Meta Muse Code（`meta-muse`）。** 在 macOS 上，若你已經在使用 Muse Code CLI，這裡會匯入它在
`muse login` 之後儲存的 API key，而不是要求你再申請第二把。OpenCodex 絕不會自行啟動該 CLI：若沒有
偵測到 credential，會請你自己執行 `muse login`。

其他平台則會要求你貼上 key。Meta 沒有發布原生 Windows CLI；Linux 雖然有 CLI，但它把 credential 存
在哪裡尚未被驗證過，因此 OpenCodex 不會猜測 credential store，而是改為指向
[dev.meta.ai](https://dev.meta.ai)，同一把 key 在那裡也看得到。貼上的 key 會經過與匯入 key 相同的
格式檢查，以及對 Model API 的相同即時驗證。完整的各平台狀況請見
[Platform support](/zh-tw/reference/platform-support/)。

**啟用前請先讀這段。** Meta 把該 credential 限定在 Muse Code CLI 內，因此在這裡使用是*不受支援*的
路徑。Meta 不授權其訂閱涵蓋自家 client 以外的用法，這些呼叫如何結算也無法從 API 觀察到，你應把每次
呼叫都視為會計入你帳號的費用。無論是匯入還是貼上的 key，都會像其他 OAuth credential 一樣複製進
OpenCodex 的 auth store（`~/.opencodex/auth.json`，權限 0600）。儀表板會在第一次登入前與每次
重新認證前顯示 Terms-of-Service 警告——與 Anthropic 及 Google Antigravity 相同的處理方式。

Meta 會在 streaming response 內回報訂閱 window 用量，OpenCodex 就是從那裡讀取。帳號列會顯示最後
一次觀察到的 5 小時與週 window，以及該讀值已經過期多久——Meta 沒有提供可主動查詢的 endpoint，因此
只有透過這個 provider 的另一次 streaming turn 才會刷新數值，而走請求翻譯而非 passthrough 的 turn
不會回報任何值。尚未提供過 streaming turn 的帳號單純不顯示 quota，這不是錯誤。速率限制以 team 為
單位，不是以 key 為單位。

要用受支援的方式，請使用上面的 `meta-model`，搭配你自己的 key。

**Command Code 配額。** 儀表板與 `ocx account refresh` 會在正規主機 `https://api.commandcode.ai` 探測 `/alpha/billing/credits` 視窗（5 小時與每週）。OAuth preset (`command-code`) 使用已儲存的帳號 bearer；Provider-API key preset (`commandcode`) 使用目前設定的有效 key。使用者改寫過的仿冒 base URL 不會被探測。當 Command Code 同時回報週期消耗時，剩餘的 monthly / purchased / free credits 會顯示為 USD 視窗。

OrcaRouter 瀏覽器登入（`ocx login orcarouter-oauth`）的金鑰交換成功回應本文必須是不超過
64 KiB 的有效 UTF-8 JSON。此交換請求原有的 30 秒時限涵蓋回應標頭與完整本文的接收；過大或
格式錯誤的本文會在儲存金鑰前被拒絕。這些限制只適用於登入時的金鑰交換，不是推論請求酬載的
限制。`scope` 驗證規則維持不變：允許省略，明確無效的值仍會被拒絕。

**SambaNova Cloud 探索。** preset 從固定 API host 讀取 SambaNova Cloud 公開的 `/v1/models` 列表，保留
provider-native id，並把 discovery 限制在 128 KiB／128 個 raw row。因 catalog 不需要認證，CLI login
流程會把 key 回報為 unverifiable，而不會把公開 response 當成有效 key 的證明。Chat request 仍使用
設定的 Bearer key，並停用 parallel function call，因 SambaNova 尚未支援。Private SambaStudio deployment
endpoint 不在範圍內。可在 [SambaNova Cloud](https://cloud.sambanova.ai/apis) 建立 key。

**Nebius Token Factory 探索。** preset 請求經認證的 verbose model catalog，只保留 architecture 會輸出
text 的 row，排除 embedding 與 image-generation model。它保留含 `/` 的原生 id，以及回報的 context／
input-modality metadata，並把 discovery 限制在 512 KiB／512 個 raw row。Dedicated deployment host 不在
範圍內。可在 [Nebius Token Factory](https://tokenfactory.nebius.com) 建立 key。

**Crusoe 探索。** key-based preset 使用 `openai-chat` adapter，只把 Bearer key 傳到 Crusoe 固定的
Serverless Inference host。`/v1/models` 會以 401 拒絕未驗證的請求，因此成功列出 model 即視為 key 驗證通過。
discovery 會依 Crusoe 回傳的形式完整保留 `zai-org/GLM-5.3`、`moonshotai/Kimi-K2.6` 這類含 `/` 的原生 id，
並限制在 256 KiB／256 個 raw row。只保留 `is_public: true` 且 `architecture.modality` 為 text 或 multimodal 的 row，因此帳戶私有部署以及 embedding、媒體類 row 會被排除。reasoning model 會透過 Chat Completions 的 `reasoning` 欄位回傳思考內容，
adapter 會讀取該欄位。只有 `openai/gpt-oss-120b` 接受 `reasoning_effort` 等級（`low`、`medium`、`high`），
其他 reasoning model 把該欄位當作開關，因此 preset 不宣告 provider-wide effort 等級，也不宣告
provider-wide parallel tool call。rate limit 以 project 與 model 為單位（超過時回傳 429，共用 deployment
擴容時回傳 503），新帳戶可獲得 $5 免費額度。可在 [Crusoe Cloud console](https://console.crusoecloud.com)
的 Intelligence Foundry > Inference 建立 key。

**DigitalOcean 探索。** preset 以 model access key 存取固定的 shared Serverless Inference host，並把經
認證的 `/v1/models` response 與 DigitalOcean 文件支持的 Chat Completions allowlist 取交集。未知、
Responses-only、embedding 與 media-generation id 都 fail closed。discovery 限制在 256 KiB／256 個 raw
row；agent-specific 與 dedicated host 不在範圍內。可在
[DigitalOcean Control Panel](https://cloud.digitalocean.com/model-studio/manage-keys) 建立 key。

**Scaleway 探索。** preset 把經認證的模型列表與 Scaleway 文件化的 Serverless Chat Completions
allowlist 取交集。未知、Responses-only、embedding、transcription 與其他 media model id 都 fail
closed；discovery 限制在 128 KiB／128 個 raw row。它使用 default Project 的 shared endpoint；
project-qualified URL 與 dedicated deployment 需要 custom provider。可在
[Scaleway console](https://console.scaleway.com/generative-api) 建立 API key。

**Featherless 探索。** preset 對固定 OpenAI-compatible host 認證，並讓上游只回傳前 100 個 popular、
已篩選為 chat 且符合目前 plan 的模型。registry 規則再進一步 fail closed，要求每一 row 都獨立回報 plan
availability、沒有 Hugging Face gate，且 `features.tool_use: true`。discovery 限制在 128 KiB／100 個 raw
row，因此不會下載或快取完整的數萬模型 catalog。因 `/v1/models` 文件指出可帶或不帶認證呼叫，成功
讀取不能證明提供的 key 有效；chat request 仍使用設定的 Bearer key。Featherless terms 將 individual
plan 限定於 interactive／prototyping 使用；任意 application 需要 Scale plan。可在
[Featherless dashboard](https://featherless.ai/account/api-keys) 建立 key。

**Novita 探索。** key-based preset 使用 `openai-chat` adapter，只把 Bearer key 傳到 Novita 固定的
OpenAI-compatible host。公開 model list 會篩選為同時回報 `model_type: chat` 與 `chat/completions`
endpoint 的 row，discovery 限制在 512 KiB／256 個 raw row。model id 必須完整保留 Novita 回傳的形式，
包括含 `/` 的 id；路由前不得 normalize 或 rewrite。因 catalog 是公開的，login 會把 key 回報為
unverifiable，而不會把成功取得列表視為有效 key 的證明。模型能力不同，因此 preset 不會宣告
provider-wide parallel tool call 或 OpenAI `reasoning_effort`。可在
[Novita key manager](https://novita.ai/settings/key-management) 建立 key。

> **Baseten 範圍：** preset 只涵蓋 Baseten 共用的
> [Model APIs](https://docs.baseten.co/inference/model-apis/overview)。本機使用請採 personal
> [API key](https://docs.baseten.co/organization/api-keys)；共用／production 使用則採具備 **Call Model
> APIs** 權限的 team key。Dedicated Truss `predict` endpoint 使用不同 host 與 schema，不會被此 preset
> 路由。此 preset 的 live discovery 上限為 1 MiB response／256 個 raw model row。

### 官方 CodeBuddy Code CLI（Global 與 CN）

OpenCodex 透過 `codebuddy`（Global）與 `codebuddy-cn`（中國）preset，提供 Tencent Cloud CodeBuddy Code
CLI 的官方 adapter 支援。

```json
{
  "providers": {
    "codebuddy": {
      "adapter": "codebuddy",
      "baseUrl": "https://www.codebuddy.ai",
      "apiKey": "${CODEBUDDY_API_KEY}"
    },
    "codebuddy-cn": {
      "adapter": "codebuddy",
      "baseUrl": "https://www.codebuddy.cn",
      "apiKey": "${CODEBUDDY_CN_API_KEY}"
    }
  }
}
```

- **前置需求：** 全域安裝官方 CodeBuddy CLI：
  ```bash
  npm install -g @tencent-ai/codebuddy-code
  ```
- **認證：** 從 vendor console 取得官方 API key：
  - Global：[CodeBuddy Global API Keys](https://www.codebuddy.ai/profile/keys)
  - CN：[CodeBuddy CN API Keys](https://copilot.tencent.com/profile/keys)
- **區域隔離：** `codebuddy` 與 `codebuddy-cn` 使用各自獨立的 canonical endpoint
  （`https://www.codebuddy.ai` 與 `https://www.codebuddy.cn`）與隔離的子環境
  （`CODEBUDDY_INTERNET_ENVIRONMENT=public` 對 `internal`）。credential 嚴格限定於各自區域，絕不會跨環境
  交換。覆寫 canonical base URL 會 fail closed。
- **工具擁有權：** v1 中，CLI 會以 `--tools ""` 與 `--strict-mcp-config` 啟動，確保 Codex 保有工具的
  獨佔擁有權。此 provider 只運作在文字與 reasoning 模式；client 端的工具執行不會委派給 vendor CLI。
- **權益與計費：** 此 provider 使用與 vendor 文件相同的 CodeBuddy 帳號／CLI 認證介面。免費、促銷、
  試用或訂閱額度的可用性與計費，仍由使用者的 CodeBuddy 帳號權益決定。

### 官方 Qoder CLI（Global 與 CN）

OpenCodex 透過 `qoder`（Global）與 `qoder-cn`（中國）preset，提供 Qoder 的官方 adapter 支援。兩者都使用
使用者提供的 Personal Access Token 與 vendor 的 headless CLI；OpenCodex 絕不會讀取 Qoder Desktop
session、瀏覽器 cookie、refresh token 或私有 console API。

```json
{
  "providers": {
    "qoder": {
      "adapter": "qoder",
      "baseUrl": "https://qoder.com",
      "apiKey": "${QODER_PERSONAL_ACCESS_TOKEN}"
    },
    "qoder-cn": {
      "adapter": "qoder",
      "baseUrl": "https://qoder.cn",
      "apiKey": "${QODERCN_PERSONAL_ACCESS_TOKEN}"
    }
  }
}
```

- **前置需求：** 安裝你所使用區域的官方 CLI：
  ```bash
  npm install -g @qoder-ai/qodercli        # Global: qoder / qodercli
  npm install -g @qodercn-ai/qoderclicn    # CN: qodercn / qoderclicn
  ```
- **認證：** 在帳號整合頁面建立 PAT（[Global](https://qoder.com/account/integrations)、
  [CN](https://qoder.cn/account/integrations)），並貼上作為 provider 的 API key。已儲存的 key 只會以
  `QODER_PERSONAL_ACCESS_TOKEN`（Global）或 `QODERCN_PERSONAL_ACCESS_TOKEN`（CN）的形式，在受限的子
  環境中傳給 CLI。
- **區域隔離：** 每個 preset 只接受各自的 canonical 目的地（`https://qoder.com` 或 `https://qoder.cn`），
  並解析各自的執行檔。credential、model cache、用量與健康狀態彼此獨立；兩區不會互相 fallback。既有
  同名為 `qoder` 但目的地不同的 custom provider，會保留原本的 adapter 與 URL。
- **模型探索：** `qoder --list-models` 是目前 PAT 的權威權益清單。cache 綁定 token 不可逆的
  fingerprint，因此切換帳號絕不會沿用另一個帳號的清單。探索失敗時，provider 會降級為過期 cache，
  再退回文件記載的靜態種子清單。
- **工具擁有權：** CLI 以單輪 `stream-json` 執行，帶 `--tools ""`、`--strict-mcp-config`、停用設定
  來源、停用 session persistence，讓 Codex 保有工具的獨佔擁有權。v1 只支援文字與 reasoning；圖片
  輸入會明確失敗。
- **配額：** 沒有公開的 quota API 可用，因此總量與重置時間都無法取得。credit 不足的錯誤（vendor code
  118）會以 HTTP 429 `insufficient_quota` 呈現。
- **維運方：** Qoder Global 由 BRIGHT ZENITH PRIVATE LIMITED 依
  [product service terms](https://qoder.com/product-service) 營運；Qoder CN 由通义云启（杭州）信息
  技术有限公司與 Alibaba Cloud 合作營運。設定完成後請執行 `ocx provider test qoder`（或
  `qoder-cn`）驗證。

### Claude Code CLI（訂閱）

OpenCodex 可以透過 Anthropic 自己的 harness 消耗 Claude 訂閱，而不是對 Messages API 重放
Claude Code 身分。`claude-cli` 預設每輪對話無頭執行一次官方 Claude Code CLI（`claude -p`、
`stream-json`）：

```json
{
  "providers": {
    "claude-cli": {
      "adapter": "claude-cli",
      "baseUrl": "https://api.anthropic.com"
    }
  }
}
```

- **前置需求：** `npm install -g @anthropic-ai/claude-code`，然後用 `claude`（或
  `claude setup-token`）登入一次。CLI 使用這台機器自己的 Claude Code 登入（macOS 上是
  Keychain 項目，其他平台則是 `~/.claude/.credentials.json`）。
- **不儲存任何憑證：** 這一列不持有任何 API 金鑰，OpenCodex 也絕不讀取、複製或轉發 Claude
  token。CLI 自己擁有登入並自行計費該帳號。未登入的 CLI 會以指名該指令的登入錯誤讓這一輪
  失敗，而不是通用的 `401`。分類遵循同樣的事實：此預設是無金鑰列（`keyOptional`），不需要
  API 金鑰，也不會為它提供金鑰欄位。用其他方式儲存在這一列上的 API 金鑰絕不會交給 harness——
  金鑰計費屬於 `anthropic-apikey` 預設。
- **一次登入服務整個代理：** harness 讀取的是執行 OpenCodex 的使用者的 Claude Code 登入，
  因此透過這一列路由的每個請求——來自代理的任何客戶端——都會消耗那一個 Claude 帳號。沒有
  逐客戶端帳號、沒有池化，也沒有多工；要讓多個人各自使用自己的 Claude 用量，需要每個登入
  各自一個代理使用者。
- **輸入媒體：** 此列在 v1 把它的模型公開為純文字。CLI 在其 stream-json 輸入上接受圖像
  frame，但尚未證實任何無頭對話會把那些位元組交給模型，因此直接送到此 provider 的圖像會被
  拒絕（`unsupported_input_modality`，與 Qoder 預設相同的拒絕），而不是被靜默丟棄並盲目回答。
  當視覺 sidecar 在請求路徑上時，圖像會先被轉成文字說明才送到這一列。
- **隔離：** 每一輪對話都在範圍受限的子環境中執行，不繼承任何 `ANTHROPIC_*` 變數（因此一個
  已經指向這個代理的 `claude` 不會迴圈連回自己）、遙測、意見回饋與自動更新程式都被停用，並帶有
  `--tools ""`、`--strict-mcp-config` 與 `--setting-sources ""`。harness 不會從機器載入任何
  CLAUDE.md、skill、hook、plugin 或 MCP 伺服器，也無法讀取、寫入、執行或瀏覽。對話之間不會
  保留任何 session。
- **系統提示：** 呼叫者的系統與開發者提示會取代 Claude Code 預設的提示（`--system-prompt-file`），
  因此這一輪回答的是客戶端的合約，而不是 harness 的人格設定。折疊後的提示會暫存在私有的
  逐輪檔案中（權限 `0600`）並以路徑方式傳入，因為行程引數透過行程列表是全世界可讀的；沒有
  系統或開發者提示的請求會得到一個空檔案，等於用空內容取代該預設提示。
- **工具擁有權：** v1 僅有文字與 reasoning，與 CodeBuddy 及 Qoder 預設完全相同：沒有工具通道，
  核准、沙箱與執行都留在客戶端。共用的 capture-only 工具橋接是已記錄的後續工作。
- **目的地：** 這一列的規範名稱是 `https://api.anthropic.com`，因為訂閱的流量正是送到那裡。
  OpenCodex 自己絕不會發送那個請求，覆寫 base URL 會 fail closed，而不會把這一輪交給另一個
  環境。

> **條款：** 此預設透過 Anthropic 自己的 CLI 消耗你的 Claude 訂閱。從代理無頭驅動該 harness
> 是否符合你的方案條款，是你與 Anthropic 之間的問題。OpenCodex 不會把這個登入轉換成 API
> 金鑰，也不會重現該 CLI 的 HTTP 身分。

### A6API 信用額度

使用 `authMode: "key"`，且 base URL 為 canonical `https://api.a6api.com` 或
`https://api.a6api.com/v1` 的 custom `openai-chat` provider，會在 dashboard 與
`ocx account refresh <provider>` 顯示 A6API credit meter。provider 名稱可自訂；偵測依據 canonical HTTPS
endpoint。meter 會使用帳號的 hard credit limit，把 A6API token unit 換算成 USD，並顯示已使用百分比與
剩餘 credit。Token 到期不會顯示為 quota reset，因為到期不代表 credit 會補充。

```json
{
  "providers": {
    "my-a6": {
      "adapter": "openai-chat",
      "authMode": "key",
      "baseUrl": "https://api.a6api.com/v1",
      "apiKey": "${A6API_API_KEY}"
    }
  }
}
```

quota probe 只會把 active key 傳送到 canonical A6API host，並拒絕 redirect。格式錯誤、負數或內部不一致
的 billing total 不會產生 report，也不會顯示誤導性的 quota bar。

> **Tencent Cloud Coding Plan 使用限制：** Tencent 文件將此訂閱限定為互動式 coding tool。一般 API
> automation、自訂 application backend 與非互動 batch 使用都被禁止，並可能造成 plan key 被停用。

> **GLM 計費路徑：** `zai` 是 Z.AI 國際 Coding Plan 訂閱；`zhipu-bigmodel` 是智譜國內 BigModel
> pay-as-you-go endpoint。兩者 host、key 與 billing 都不同；其中一邊發出的 key 無法在另一邊通過認證。

### BigModel Coding Plan over Responses

選擇 **Zhipu AI — BigModel Coding Plan (Responses)**（`zhipu-bigmodel-responses`），對應
`openai-responses` endpoint `https://open.bigmodel.cn/api/v1`。這與使用 Chat Completions（
`/api/coding/paas/v4`）的 `zhipu-bigmodel-coding` 是分開的。

此 preset 使用**靜態名單**（`liveModels: false`），取自公開的
[GLM Coding Plan 文件](https://docs.bigmodel.cn/cn/coding-plan/tool/codex.md)：

| 模型 | Context tokens | 上游可選 effort | 預設 effort | Reasoning summaries |
| --- | ---: | --- | --- | --- |
| `glm-5.3` | 1,048,576 | `low`、`high`、`max` | `max` | 支援 |
| `glm-5.3-flash` | 1,048,576 | `low`、`high`、`max` | `max` | 支援 |
| `glm-5-turbo` | 204,800 | 無（空清單） | `max` | 支援 |

`glm-5.3` 與 `glm-5-turbo` 宣告上游只支援文字輸入。Codex catalog 仍為它們宣告文字與圖片，因為
opencodex 既有的 vision sidecar 可以為純文字模型描述圖片；這條路徑需要一個可用且已啟用的 vision
sidecar，並不代表 BigModel 原生支援圖片。

`glm-5.3-flash` 是例外：它宣告原生支援 `text` 與 `image` 輸入，因為上游文件記載它是原生多模態模型。
因此它會直接讀取圖片，不會繞經「先描述再處理」的 sidecar 路徑。

預設模型是 `glm-5.3`；Responses 的 reasoning 內容在 replay 時會被保留。既有的 Codex export 會為
GLM-5.3 加上其相容用的 `ultra` 層級，並省略 Turbo 的 default-effort 欄位，因為 Turbo 沒有可選階梯；
provider metadata 仍會為兩個模型都記錄 `max`。對 Turbo 而言，送出的 Responses 請求會省略
`reasoning.effort`，包括 caller 傳入的 `max` 或 `ultra`，但仍會保留 requested reasoning summaries。
這會把 effort 選擇留給上游預設值；opencodex 不會注入可選或寫死的 `max`。

範例中的 `models.json` 是本機 catalog 檔案，不是文件記載的 HTTP model-list response，也不是該
endpoint 實際提供的模型集合——Coding Plan 頁面指出每個方案層級都能使用 GLM-5.3 與 GLM-5.3-Flash，
且 GLM-5-Turbo 呼叫會被自動切換到 Flash，因此此 endpoint 早已在 Turbo id 底下提供 Flash。此 preset
仍不會執行即時模型探索。既有同名的 custom provider 會保留自己設定的目的地與 metadata。CLI key
login 同樣會跳過未文件化的 `/models` 探測，並回報驗證結果為 unknown；成功的 key 認證由後續的
inference 請求確立。

### 多個 API 金鑰

key-based provider 也能保存多個 key。透過 Providers 頁面新增 key 時，會存到 `provider.apiKeyPool`、
設為 active，並同步到 `provider.apiKey`，讓路由與 adapter 繼續讀取原本欄位。同一個下拉選單可切換或
移除 key；管理 API 為 `/api/providers/keys`，而且只回傳遮蔽後的 key。

### 從終端切換帳號

不必開啟儀表板，即可用 `ocx account list`、`ocx account current` 與 `ocx account use` 檢視或切換
同一組 Codex、OAuth 與 API-key pool。完整 command、JSON output 與新 session 生效規則請參見
[CLI 參考](/zh-tw/reference/cli/providers-accounts/#ocx-account-subcommand)。

#### 帳號列表中的訂閱層級

`ocx account list <provider> --json` 與 `GET /api/oauth/accounts` 會在每個 OAuth 帳號上回報 `plan`
欄位，使用與 OpenAI/Codex provider 相同的名稱與位置，讓消費端可以用同一種形狀讀取跨 provider 的資料。

這個欄位一律存在。當層級未知時，它會是 `null`，這是刻意設計：**缺少**該 key 代表這個 proxy 版本早於
此欄位；`null` 則代表這個版本已經查過，但 provider 沒有回報層級。把兩者混為一談，會讓消費端悄悄假設
一個層級。

Anthropic 目前的值一律是 `null`。它的用量 endpoint 只回傳 quota bucket——五小時與七天 window、
model-scoped 的週 window，以及一個 `limits` 陣列——沒有訂閱或層級欄位；OAuth token response 也只帶
帳號 id 與 email。既然沒有東西可以對應，就不會對應任何值。層級也無法從它回傳的 quota 反推，因為
百分比是依帳號 normalize 過的：一個 50% 的 Max ×5 座位，與一個 50% 的 Max ×20 座位無法區分。若你需要
在混合的 Anthropic 層級之間做加權 pool capacity，在上游自己回報層級之前，請把這種對應放在 OpenCodex
之外處理。

### GPT-5.6 預覽路徑

GPT-5.6 Sol/Terra/Luna 會預置在 provider fallback list 中，因此即使即時 catalog 暫時落後，
`ocx sync` 仍可維持模型可見。

| Codex 路由 | 預置 model id | Codex 可見 context |
| --- | --- | --- |
| Codex 登入（Pool 或 Direct） | `gpt-5.6-*` | 922,000 |
| OpenAI (API key) | `openai-apikey/gpt-5.6-*` 加 `*-pro` | 922,000（922,000 max input） |
| OpenRouter | `openrouter/openai/gpt-5.6-sol`、`openrouter/openai/gpt-5.6-terra`、`openrouter/openai/gpt-5.6-luna` | 922,000 |
| Cursor | `cursor/gpt-5.6-sol`、`cursor/gpt-5.6-terra`、`cursor/gpt-5.6-luna` | 1,000,000 |

原生 GPT-5.6 條目保留固定的上游 reasoning ladder，例如 Luna 有 `max` 但沒有 `ultra`。路由條目使用各
provider metadata 與 reasoning mapping。四條路徑最終都受上游權限限制；Cursor 即時探索還會把 static
seed 篩到目前帳號真正能使用的模型。

:::note[Gateway 與訂閱 proxy]
是否納入某個 provider，取決於 opencodex 是否有匹配的 wire adapter，**不**取決於它是否是「agent」
產品。目前 adapter id 為 `openai-chat`、`openai-responses`、`anthropic`、`google`（AI Studio、Vertex、
Antigravity／Cloud Code Assist 模式）、`azure` / `azure-openai`、`kiro`、`cursor`。像原生 Amazon Bedrock
這類沒有對應實作的 proprietary API，不會被直接支援。

Provider 設定決定 adapter；上游 transport 的選擇是另一回事。符合資格的 Responses 流量可以透過
[明確的 proxy 路由](/zh-tw/reference/proxy-formats/#json-and-sse-output) 使用 WSS。無效或不支援的
WebSocket proxy 設定會退回 HTTP/SSE，走的是 Bun 的 HTTP proxy 規則，而不是 WSS 專用的 `ALL_PROXY`
fallback。

**GitHub Copilot** 是 OAuth provider（`ocx login github-copilot`），會把 GitHub device-flow login 換成
短效 Copilot API token，不是貼上 API key。**GitLab Duo** 仍是使用 OpenAI-compatible endpoint 的
key／subscription-token gateway。**Cloudflare AI Gateway** 需要在 URL 填入 account 與 gateway id。

Copilot 的 catalog 混合多種 wire：模型（`gpt-5.3-codex`、`gpt-5.4`、`gpt-5.4-mini`、
`gpt-5.5`、`gpt-5.6-luna`、`gpt-5.6-sol`、`gpt-5.6-terra`、`gpt-6-astra`, `grok-4.5`, `grok-4.6`, `mai-code-1.1-flash`, `mai-code-1-flash-picker`）會拒絕 agent traffic 的
`/chat/completions`，因此 opencodex 會依內建預設把這些模型路由到 Responses API；其他 Copilot 模型
仍使用 chat completions。優先順序為：hard wire pin → 你明確設定的
[`modelAdapters`](/zh-tw/reference/configuration/providers/) → registry default → provider-wide adapter。
若要讓沒有內建 default 的模型，例如 `gpt-5.4-nano`，改走 Responses，可設定
`"modelAdapters": { "gpt-5.4-nano": "openai-responses" }`。

Cursor 另以實驗性 adapter 追蹤。`adapter: "cursor"` 會在 `ocx init` 與 dashboard Add Provider picker
出現為實驗性 local config，並帶 Cursor static fallback model catalog metadata。設定 Cursor access token
後，opencodex 使用 Cursor 即時 HTTP/2 transport。bundled fallback seed 包含 1M context 的
`gpt-5.6-sol`／`terra`／`luna`、500K 的 Grok 4.5/4.6/4.7 一般與 Fast 項目，以及 262K 的 `kimi-k3`；即時探索
決定哪些模型對帳號保持可見。Grok 4.6 與 4.7 的兩種形式都提供 `low`／`medium`／`high`／`xhigh`，4.5 則最高到
`high`。Grok 4.5 與 4.6 的 Fast 請求會傳送對應的基礎模型，並使用獨立的 `effort` 與 `fast=true`
`requested_model` 參數；這兩個版本扁平化的 `cursor-grok-{version}-{effort}-fast` id 僅作為探索與 picker 識別。
Grok 4.7 在清單中沒有 `cursor-` 前綴，直接傳送 `grok-4.7-{effort}-fast`。Cursor 的 Kimi K3
只以帶 effort suffix 的 wire id 提供，因此
`cursor/kimi-k3` 暴露 `low`／`high`／`max` 階梯，預設為 `max`，符合該模型文件化的 API default。
Cursor server-driven native read/write/delete/ls/grep/shell/fetch execution 預設停用，因為它會繞過 Codex
approval 與 sandbox 路徑；只有可信本機實驗才應在 `~/.opencodex/config.json` 的 `providers.cursor`
物件設定 `unsafeAllowNativeLocalExec: true`，也可以透過儀表板 **Providers → Cursor → Edit JSON** 設定。
完整範例參見[設定參考](/zh-tw/reference/configuration/providers/#cursor-供應商adapter-cursor)。MCP、螢幕錄製與
computer-use 可透過 executor hook 使用；未設定本機 executor 時，opencodex 會回傳 typed no-executor
result，而不是用 policy block request。Cursor OAuth 與即時 model discovery 已為此實驗性 adapter 啟用；
Cursor 仍不會出現在 key-login list。
:::

### Ollama Cloud

Ollama Cloud 是 hosted、不是 local 的 Ollama，設定位址為 `https://ollama.com/v1`，
key 來自 [ollama.com/settings/keys](https://ollama.com/settings/keys)。opencodex 以 Ollama 自身的
REST API（`POST /api/chat`）連線，而非 OpenAI-compatible 介面，並向 provider 動態探索模型清單，
因此新的 Ollama Cloud 模型不需改設定就會出現。opencodex 依 vision capability 分類其
cloud lineup，讓 [vision sidecar](/zh-tw/guides/sidecars/) 只對純文字模型生效。純文字模型，例如
`glm-5.2`、`deepseek-v4-flash`、`gpt-oss`、`qwen3-coder`、`minimax-m2.x`、`nemotron-3-*`，會列在
`noVisionModels`；原生 vision 模型，例如 `kimi-k2.6`、`minimax-m3`、`gemma4`、`qwen3.5`、
`gemini-3-flash-preview`，不會列入。matching 可容忍 Ollama 的 `:size` tag，因此 `gpt-oss` 同時涵蓋
`gpt-oss:120b` 與 `gpt-oss:20b`。

Ollama 目前在文件中說明結構化輸出在 Ollama Cloud 上不受支援。因此對正典 `ollama-cloud`，
opencodex 會以明確的錯誤拒絕結構化輸出請求（`text.format`），而不是悄悄回傳不受約束的
散文式文字；本機 / 自訂 `ollama-native` 端點保留 Ollama 原生的 `format` 行為。

## 4. 本機供應商

讓 opencodex 指向本機 OpenAI-compatible server，通常使用空 key：

| 供應商 | Base URL |
| --- | --- |
| Ollama (local) | `http://localhost:11434/v1` |
| vLLM | `http://localhost:8000/v1` |
| LM Studio | `http://localhost:1234/v1` |

## 任意 OpenAI-compatible endpoint

若 provider 使用 Chat Completions，`openai-chat` adapter 就能處理。可在儀表板選 **Custom**，或在
`ocx init` 選 `custom` 並輸入 base URL。所有 provider 欄位（`headers`、`noReasoningModels`、
`noVisionModels`、`models` 等）請參見[設定參考](/zh-tw/reference/configuration/)。

## 每個供應商各自的核准審查者

Codex 會請第二個模型審查核准請求，審查者取自目前 turn 所用模型在 catalog row 上的
`auto_review_model_override`。`$CODEX_HOME/config.toml` 中的根層級 `auto_review_model` 會把同一個
審查者套用到每一 row。要讓某個 routed provider 使用自己的——通常較便宜的——審查者，請在
`~/.opencodex/config.json` 的該 provider row 上設定 selector：

```json
{
  "providers": {
    "blsc": {
      "autoReviewModel": "opencode-go/deepseek-v4-flash",
      "autoReviewModelOverrides": { "kimi-k3": "gpt-5.6-terra" }
    }
  }
}
```

`autoReviewModel` 涵蓋該 provider 的每一個 routed row。`autoReviewModelOverrides` 只針對單一上游
model id，並且優先於前者。值可以是同一 provider 底下的裸 model id，也可以是公開 catalog slug，例如
`opencode-go/deepseek-v4-flash`；provider 層級的設定在自己的 row 上會優先於根層級 selector，根層級
selector 在其他地方仍作為 fallback。

裸值會先對照該 provider 自己的 row 解析，再對照裸 catalog row 解析，這正是像 `gpt-5.6-terra` 這種
原生模型的命名方式；兩者都不相符的值會保持未解析狀態，而解析到 provider 之外的裸值，會印出一則
註記說明是哪個 row 提供了審查者。若審查者是另一個 provider 的 routed model，直接給出完整 slug 可以
完全避開這個問題。

Selector 會在下一次 sync 時對照最終 catalog 各自獨立解析，且各自獨立 fail closed：未能解析的
`autoReviewModel` 會印出診斷訊息，且不會為該 provider 的任何 row 加上設定；未能解析的
`autoReviewModelOverrides` 項目會印出診斷訊息，且不會加上該模型的 override，但仍會保留有效的
provider 層級目標作為 fallback。凡是能解析出來的都會被套用。沒有 provider 層級設定的 row，會沿用
根層級 selector，或在根層級未設定時沿用上游行為。移除根層級 selector 不會動到 provider 層級設定；
移除某個 provider 的 selector 只會清除該 provider 自己的設定。

這些欄位可透過設定檔、`PATCH /api/providers?name=<provider>`，以及儀表板的 raw JSON provider
editor 設定；沒有專屬的表單控制項。canonical 的 `openai` provider 會拒絕這些欄位。逐欄位規則請見
[provider 設定參考](/zh-tw/reference/configuration/providers/#auto-review-approval-model-selection)。

## Providers 總覽的速率限制

Providers 總覽的 **Rate limits** 區段會在 provider 有使用量／billing endpoint 時，顯示從該 endpoint
refresh 的即時 utilization bar。bar 代表特定 window（5 小時、weekly、monthly 或 provider-specific）
已消耗的比例。

具有 live probe 的 provider：OpenAI/Codex、Anthropic、xAI、Cursor、Kimi、Google Antigravity、
OpenCode Go、OpenRouter、DeepSeek、ClinePass、Z.AI、MiniMax、Moonshot、Venice、Synthetic、DeepInfra、
Neuralwatt、Command Code，以及任何由 a6api 支援的 custom provider。

**OpenCode Go 配額。** canonical 的 `opencode-go` preset 會用設定的 key 當作 Bearer token 讀取
`GET https://opencode.ai/zen/go/v1/usage`，且不跟隨 redirect。回應中的 rolling、weekly 與 monthly
`percent` 值就是已消耗的 utilization：rolling 對應 5 小時 bar，weekly 與 monthly 則對應各自的 bar。
OpenCodex 不會從本機用量紀錄反推美元上限，使用非 canonical `baseUrl` 的 provider 絕不會被送出 key
做這項探測。

**Z.AI GLM Coding Plan 配額。** `zai`、`glm`、`glm-cn` 與 `zhipu-bigmodel-coding` preset 會讀取
`GET /api/monitor/usage/quota/limit`，且不跟隨 redirect。探測會依 provider 指向的區域執行：
`api.z.ai`（原樣或 `/api/coding/paas/v4`）或 `open.bigmodel.cn`（原樣、`/api/coding/paas/v4`，或
OpenAI Responses endpoint `/api/v1`）。

不同區域的認證方式不同：`api.z.ai` 把 key 當 Bearer token；`open.bigmodel.cn` 則預期 key 直接放在
`Authorization`，不帶任何 scheme 前綴，且會拒絕 Bearer header。回應中的 `limits` row 會填入
utilization bar：`unit` 3／`number` 5 的 `TOKENS_LIMIT`／`CREDIT_LIMIT` row 填入 5 小時 bar，
`unit` 6／`number` 1 的則填入週 bar。

`TIME_LIMIT` row **不是**模型 quota，會被忽略。它們是 Web Search、Web Reader 與 Zread 共用的每月
MCP call 額度，若把它們當成模型 window，會讓已用掉的 web-search 預算，在 quota-aware 帳號排名中
被誤讀為模型容量耗盡。因此只回報 `TIME_LIMIT` row 的方案不會顯示任何 quota bar，而不是顯示一個
捏造出來的值；方案沒有回報的 window 會保持不存在，而不是顯示成 0%。

使用非 canonical `baseUrl` 的 provider，絕不會被送出 key 做這項探測。

### 診斷 Antigravity 配額刷新

帳號配額檢視與 `ocx account list google-antigravity --quota --refresh` 會區分存取遭拒、rate
limiting、目的地被封鎖或重新導向、DNS／連線／逾時，以及無法使用的 quota 資料。刷新失敗時，最後一次
已知的 bar 仍會顯示，並附上觀察時間。重新認證會清除先前 credential 留下的診斷結果；一次成功的刷新
會清除失敗狀態。

存取遭拒的結果，本身並不能證明登入已過期或方案不合資格。目的地被封鎖是網路政策的決定，不能證明
Fake-IP 有缺陷。canonical 的 Google quota 目的地仍保留 TLS 驗證與 redirect／private-address 限制。
已認證的 TUN 行為必須在受影響的環境中實際檢查；單靠注入的 transport fixture 無法確立這項實際結果。

## Chat 供應商上的大型內嵌圖片

翻譯後的 OpenAI-compatible Chat 請求，在內嵌圖片的合併 base64 資料超過 3.5 MiB 時會加以縮小。較舊的
圖片會優先損失細節。這是盡力而為的圖片預算，因此過大的文字、schema，或無法處理的圖片，仍可能超出
上游的請求限制。遠端圖片 URL 不會被下載，無法縮小的圖片仍會維持附加狀態。原生 Chat passthrough 會
保留原始圖片位元組。
