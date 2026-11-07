import { copyTable, type Row } from "./copy-table";

/*
 * Copy for the v2 Proxy details, Advisor and the All settings hub pages. Columns: en, zh-TW (this fork keeps only these two locales).
 * Keys render as `proxyV2.<key>`.
 */
const rows = {
  // ---- Proxy details: page head and in-page index ---------------------------------------------
  pageLede: ["Expert settings for the proxy, grouped by what they change.", "代理的進階設定，依作用分組。"],
  indexLabel: ["On this page", "本頁內容"],
  details: ["Details", "詳情"],
  detailsFor: ["More about {name}", "關於{name}的詳情"],

  // ---- Proxy details: section titles and one-line ledes ----------------------------------------
  secSubagents: ["Subagents", "子代理"],
  secSubagentsLede: ["How Codex hands work to helper agents, and how hard they may think.", "Codex 如何把工作交給輔助代理，以及它們的推理強度。"],
  secCodex: ["Codex app", "Codex 應用程式"],
  secCodexLede: ["How Codex starts, signs in and keeps its model list in step with the proxy.", "Codex 如何啟動、登入，並讓模型清單與代理保持一致。"],
  secSidecars: ["Helper models", "輔助模型"],
  secSidecarsLede: ["Models that do web search, read images or take background calls for routed models.", "為路由模型執行網頁搜尋、讀取圖片或接管背景呼叫的模型。"],
  secCompaction: ["Compaction and reasoning", "壓縮與推理"],
  secCompactionLede: ["Which model summarizes long chats, and what reasoning is kept between turns.", "由哪個模型摘要長對話，以及回合之間保留哪些推理。"],
  secMemory: ["Memory", "記憶體與記憶"],
  secMemoryLede: ["Models for Codex's background memory, and how much memory the proxy itself uses.", "Codex 背景記憶使用的模型，以及代理本身的記憶體用量。"],
  secFallback: ["Fallback", "備援"],
  secFallbackLede: ["What happens when a model or provider fails.", "模型或供應商失敗時的處理方式。"],

  // ---- Proxy details: one-line row hints (the long text stays behind "Details") ---------------
  maModeHint: ["Which subagent engine Codex uses: v1, base or v2.", "Codex 使用的子代理引擎：v1、base 或 v2。"],
  effortCapHint: ["Lowers max-effort requests in ultra mode. It never raises them.", "降低 ultra 模式下的 max 強度請求，絕不提高。"],
  subagentEffortCapHint: ["The same limit, only for spawned child agents.", "同樣的限制，僅用於衍生的子代理。"],
  injectionHint: ["The default model subagent work is handed to.", "子代理工作預設交給的模型。"],
  autoStartShort: ["Start the proxy whenever Codex launches.", "每次啟動 Codex 時一併啟動代理。"],
  authlessShort: ["Skip the separate Desktop sign-in. Off by default.", "略過單獨的桌面版登入。預設關閉。"],
  clientCompactionShort: ["Store compaction summaries as portable plain text. Off by default.", "以可攜的純文字儲存壓縮摘要。預設關閉。"],
  shadowShort: ["Send Codex App background calls, like titles and commit messages, to another model.", "把 Codex 應用程式的背景呼叫（如標題、提交訊息）傳送到另一個模型。"],

  // ---- Advisor ------------------------------------------------------------------------------------
  advisorLede: ["A second model that reviews the worker's progress and sends advice back.", "第二個模型，審查 Worker 的進展並回傳建議。"],
  advisorSettings: ["Advisor settings", "顧問設定"],
  enabledHint: ["Consultations run only while this is on.", "僅在開啟時進行諮詢。"],
  effortHint: ["How hard the advisor thinks before it answers.", "顧問回答前的思考深度。"],
  policyHint: ["When the advisor is consulted.", "何時諮詢顧問。"],
  taskLimitHint: ["The most automatic consultations one task can use.", "單一任務最多可用的自動諮詢次數。"],
  timeoutHint: ["How long to wait for advice before giving up.", "放棄前等待建議的時間。"],
  consentTitle: ["Context sharing", "上下文共享"],
  consentNeeded: ["Required to run", "執行所必需"],
  consentGiven: ["Agreed", "已同意"],
  unsaved: ["Unsaved changes", "有未儲存的變更"],
  activityLede: ["Consultations from the last 24 hours of this process.", "此程序最近 24 小時的諮詢紀錄。"],
  activityEmptyHint: ["Consultations appear here once the advisor runs.", "顧問執行後，諮詢紀錄會顯示在這裡。"],

  // ---- All settings hub ---------------------------------------------------------------------------
  // Descriptive line under a card title (product names such as Advisor or Claude Code stay literal).
  advTermProxy: ["Sidecars · Compaction · Memory", "輔助模型 · 壓縮 · 記憶"],
  advTermRouting: ["Routing profiles · Compatibility", "路由設定檔 · 相容性"],
  advTermPrompt: ["Prompt layers", "提示詞層"],
  advTermProviders: ["Request pacing · Key rotation", "請求節流 · 金鑰輪替"],
  advTermStorage: ["Storage · Log Guard", "儲存空間 · Log Guard"],
  advTermDesktop: ["Desktop compatibility", "Desktop 相容性"],
  hubCount: ["{count} shown", "顯示 {count} 項"],
} satisfies Record<string, Row>;

export const proxyV2Copy = copyTable("proxyV2", rows);
