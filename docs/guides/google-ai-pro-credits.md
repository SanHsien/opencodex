# Google AI Pro 每月 10 美元額度領取與 opencodex 配置指南

如果你有訂閱 **Google AI Pro（Google One AI Premium）**，Google 每個月都有隨附贈送 **10 美元（約 NT$318）** 的 Google Cloud / Gen AI API 額度。這筆額度可以用在 Google AI Studio，轉換為官方的 Gemini API Key，供 opencodex 調用，不必另外花費（超出額度的用量仍會計費，請務必先做好步驟 3 的防線）。

---

## 一、 領取五步驟與避坑對照表

### 步驟 1：領取每月額度
* 打開官方福利頁：`https://me.developers.google.com/benefits`
  * ⚠️ **坑一（網址變更）**：請勿使用舊網址 `developers.google.com/profile/benefits`，會出現 404。
* 找到「$10 monthly Gen AI & Cloud credits」卡片：
  * 在「Billing account」選取你的 GCP 帳單帳戶（建議建立獨立的專用帳單帳戶）。
  * 勾選 **「Always use this billing account」**（往後每個月會自動套用到同一個帳戶）。
  * 點擊 **Apply**。
  * ⚠️ **坑二（無跳轉反應）**：按下 Apply 後畫面不會有明顯變化是正常的，千萬不要重複選取帳戶連按。確認方式是到 Google Cloud 控制台的「帳單 > 抵免額」，有列出抵免額即表示成功。若過去數月未領，每張卡片皆可依序套用。

### 步驟 2：在 Google AI Studio 建立 API 金鑰
* 進入 Google AI Studio：`https://aistudio.google.com/app/apikey`。
* 點擊 **Create API key**。
* 下拉選單中務必選取**掛載了剛才那個帳單帳戶的 GCP 專案**，花費才會正確由 10 美元抵免額扣除。
* 複製產生的金鑰（`AIzaSy...`）。

### 步驟 3：設置三道費用防線（防超刷扣到真實信用卡）
* **防線一（每月預算上限）**：
  * 在 AI Studio 點擊左側 **Spend** 頁面。
  * ⚠️ **坑三（幣別預設值過高）**：預設上限可能高達 NT$3,178，請手動將每月上限改為 **NT$318**（或同等 10 美元金額），達到上限即刻停止請求。
* **防線二（儲值與關閉自動加值）**：
  * ⚠️ **坑四（預付制限制）**：若測試金鑰時出現 `prepayment credits are depleted`，表示帳戶屬於預付制，需先儲值最低門檻（NT$150 台幣）。
  * **儲值完成後，務必在帳單頁將「Auto-reload（自動加值）」關閉**，確保最壞情況只消耗 NT$150，絕不無限扣款。

---

## 二、 opencodex 配置方式（Windows）

opencodex 內建 **Google Gemini** 供應商預設（preset id：`google`，走 AI Studio 的 `generativelanguage.googleapis.com`）。它沒有固定讀取某個名為 `GEMINI_API_KEY` 的環境變數；金鑰是存在供應商設定的 `apiKey` 欄位，下列三種方式擇一即可。

### 方式 1：儀表板（建議）
1. 啟動 opencodex：`ocx start`，用 `ocx gui` 開啟 `http://localhost:10100`。
2. 點 **Add Provider**，選 **Google Gemini**，貼上步驟 2 的金鑰（`AIzaSy...`）。
3. 模型會自動探索，立即可用，不必重新啟動。

### 方式 2：PowerShell 命令列
```powershell
ocx provider add google --api-key "AIzaSy_你的金鑰" --set-default
ocx provider test google
```
金鑰會留在 PowerShell 歷史記錄裡；介意的話請改用方式 1 或方式 3。`ocx provider test google --model <模型 id> --yes` 會實際送一次完成請求（會消耗少量額度）。

### 方式 3：用環境變數引用金鑰
`config.json` 的 `apiKey` 可以寫成 `${變數名}` 引用，變數名稱由你自己決定（下例用 `GEMINI_API_KEY` 只是舉例，opencodex 本身不會自動讀它）：
```powershell
[Environment]::SetEnvironmentVariable("GEMINI_API_KEY", "AIzaSy_你的金鑰", "User")
```
再編輯 `%USERPROFILE%\.opencodex\config.json`：
```json
{
  "providers": {
    "google": {
      "adapter": "google",
      "baseUrl": "https://generativelanguage.googleapis.com",
      "apiKey": "${GEMINI_API_KEY}"
    }
  }
}
```
引用在請求時才解析；環境變數要在 opencodex 程序（或背景服務）啟動前就存在，設定後請重新啟動 `ocx start`。

### 選模型
用 `provider/model` 指定，例如：
```powershell
codex -m "google/gemini-3.5-flash" "解釋這個 stack trace"
```
`google` 預設內建的模型清單（隨版本變動）包含 `gemini-3.5-flash`（預設）、`gemini-3.5-flash-lite`、`gemini-3.6-flash`、`gemini-3.7-flash`、`gemini-3.8-flash`、`gemini-3.1-pro-preview` 與 `gemini-4-argon`。實際哪些模型你的金鑰可用，以即時結果為準：
```powershell
ocx models --provider google
ocx models live --provider google
```
或直接看儀表板 Providers 頁的模型清單。Flash 系列偏重速度與成本，要更重的推理再換 Pro／Argon 等級；用量與費用請對照 AI Studio 的 **Spend** 頁。

---

## 三、 安全與合規注意事項

* **官方正式通道**：此方式使用 Google 官方提供、供第三方工具使用的 API Key，是符合條款的正式路徑；但服務條款、配額與計費規則可能調整，本指南不作任何保證，請以 Google 的最新條款為準。
* **切勿使用反向代理偷接桌面端**：不要嘗試撰寫 Adapter 去轉發本地 Antigravity Desktop 的 Connect-RPC 作為 opencodex 的 Provider；無 TTY 與反向包裝可能觸發 Google 的濫用偵測，導致個人席位受限。需要調度本機執行時，請採非同步派工或本機原生會話。
