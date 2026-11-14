/*
 * Copy for the v2 shell: the three-tier sidebar, Home, the Set up hub and the Advanced hub.
 * One row per key, columns in the order of `locales`. Kept apart from the per-locale files
 * the same way desktop-compatibility-copy.ts is, so the new surface lands as one reviewable
 * table instead of scattered edits. Plain words first; the original term, where one
 * exists, is shown beside it by the page so docs and CLI names still connect.
 */
type Locale = "en" | "zh-TW";
const locales: readonly Locale[] = ["en", "zh-TW"];
type Row = readonly [string, string];

const rows = {
  // ---- sidebar ----------------------------------------------------------------
  tierDaily: ["Everyday", "日常"],
  tierSetup: ["Set up", "初次設定"],
  tierAdvanced: ["Fine-tuning", "細節設定"],
  navSearch: ["Search menu", "搜尋選單"],
  navSearchPlaceholder: ["Search menu", "搜尋選單"],
  navSearchEmpty: ["No menu matches", "沒有符合的選單"],
  navHome: ["Home", "首頁"],
  navAccounts: ["Accounts & limits", "帳號與額度"],
  navSetup: ["Set up", "設定"],
  navAdvanced: ["Advanced", "進階設定"],
  pageChecklist: ["Checklist", "清單"],
  pageAllSettings: ["All settings", "全部設定"],
  pageProxyDetails: ["Proxy details", "代理詳情"],

  // ---- home -------------------------------------------------------------------
  homeOk: ["Everything is running", "一切正常"],
  homeErrorsUnavailable: ["Recent errors unavailable", "無法取得最近的錯誤"],
  homeDown: ["The proxy is not answering", "代理沒有回應"],
  homeErrorsToday: ["{count} requests failed in the last 24 hours", "過去 24 小時有 {count} 個請求失敗"],
  tileVersion: ["Version", "版本"],
  tileUptime: ["Running for", "已執行"],
  leverHint: ["Pull halfway: {restart}. Pull all the way down: {stop}.", "拉到一半：{restart}；拉到底：{stop}"],
  leverHover: ["Pull: reload · stop", "下拉：重新整理 · 停止"],
  leverCancel: ["Let go to cancel", "放開即取消"],
  leverRelease: ["Let go: {action}", "放開：{action}"],
  leverReload: ["reload models", "重新整理模型"],
  leverStop: ["stop the proxy", "停止代理"],
  uiClassic: ["Classic dashboard", "經典版儀表板"],
  uiClassicHint: ["Switch to the previous dashboard design. Its sidebar has a way back.", "切換到先前設計的儀表板，可從其側欄切換回來。"],
  uiCurrent: ["New dashboard", "新版儀表板"],
  uiCurrentHint: ["Switch back to the current dashboard design.", "切換回目前設計的儀表板。"],
  uptimeValue: ["{h}h {m}m", "{h} 小時 {m} 分"],
  tileRequests: ["Requests · 7 days", "請求 · 7 天"],
  tileTokens: ["Tokens · 7 days", "Token · 7 天"],
  tileProviders: ["Providers", "供應商"],
  openLogs: ["Open request log", "開啟請求記錄"],
  checkUpdate: ["Check for updates", "檢查更新"],
  checklistTitle: ["Getting started", "開始使用"],
  checklistProgress: ["{done} of {total} done", "已完成 {done}/{total}"],
  checklistAllDone: ["All set. opencodex is ready to use.", "全部完成，opencodex 可以使用了。"],
  stepProvider: ["Add a provider", "新增供應商"],
  stepProviderHint: ["Sign in or paste an API key so opencodex has models to offer.", "登入或貼上 API 金鑰，讓 opencodex 有模型可用。"],
  stepFirstRequest: ["Connect your app and send a request", "連接應用程式並送出第一個請求"],
  stepFirstRequestHint: ["Point Codex, Claude Code or another tool at opencodex, then ask it anything.", "把 Codex、Claude Code 等工具連到 opencodex，然後隨便問一句。"],
  stepAutostart: ["Start automatically", "開機自動啟動"],
  stepAutostartHint: ["Keep opencodex running after a restart so your tools never lose it.", "重新開機後 opencodex 仍會執行，工具不會斷線。"],
  stepAutostartDesktop: ["Turn on Start at Login", "開啟登入時啟動"],
  stepAutostartDesktopHint: ["In the OpenCodex app menu, make sure Start at Login is checked. The app then opens when you log in and keeps the proxy running.", "請在 OpenCodex 應用程式選單中確認已勾選「登入時啟動」。這樣登入時應用程式會自動開啟，代理持續執行。"],
  stepOpen: ["Open", "開啟"],
  recentErrors: ["Recent errors", "最近的錯誤"],
  noErrors: ["No failed requests in the last 24 hours.", "過去 24 小時沒有失敗的請求。"],
  viewAll: ["View all", "查看全部"],

  // ---- set up hub ---------------------------------------------------------------
  setupTitle: ["Set up opencodex", "設定 opencodex"],
  setupIntro: ["Things you do once when you install opencodex or connect a new tool. Done steps are checked; you can come back any time.", "安裝或連接新工具時只需做一次的事。完成的步驟會打勾，可以隨時回來。"],
  setupApps: ["Connect apps", "連接應用程式"],
  setupAppsHint: ["Codex, Claude Code, Claude Desktop, Grok, Cursor and 20+ other tools.", "Codex、Claude Code、Claude Desktop、Grok、Cursor 等 20 多個工具。"],
  setupApiKeys: ["API keys for other apps", "給其他應用程式的 API 金鑰"],
  setupApiKeysHint: ["Give any OpenAI-compatible app a key and a ready-made config.", "為任何相容 OpenAI 的應用程式產生金鑰和現成設定。"],
  setupRemote: ["Use from other computers", "在其他電腦上使用"],
  setupRemoteHint: ["Link computers so they share one opencodex.", "連接多台電腦，共用一個 opencodex。"],
  badgeDone: ["Done", "已完成"],
  badgeTodo: ["To do", "待完成"],
  badgeOptional: ["Optional", "選用"],

  // ---- advanced hub ---------------------------------------------------------------
  advancedTitle: ["Advanced settings", "進階設定"],
  advancedIntro: ["Settings most people never need to change. Each card says what it does and when you might want it.", "大多數人不需要改動的設定。每張卡片說明它的作用以及何時需要。"],
  advancedSearch: ["Search settings…", "搜尋設定…"],
  advancedEmpty: ["No setting matches that search.", "沒有符合的設定。"],
  advancedWhen: ["When to change", "何時修改"],
  proxyUptime: ["Up {time}", "已執行 {time}"],
  themeCycle: ["Theme: {mode}. Click for {next}", "主題：{mode}，點擊切換為{next}"],
  advSubagents: ["Helper agents", "輔助代理"],
  advSubagentsWhen: ["You want Codex to hand side tasks to a cheaper or faster model.", "希望 Codex 把旁支任務交給更便宜或更快的模型時。"],
  advAdvisor: ["Expert advisor", "專家顧問"],
  advAdvisorWhen: ["You want a stronger model consulted on hard steps.", "希望在困難步驟諮詢更強的模型時。"],
  advProxy: ["Proxy details", "代理詳細設定"],
  advProxyWhen: ["Web search and image helpers, long-chat summaries, memory, updates and more.", "網頁搜尋與圖片助手、長對話摘要、記憶、更新等。"],
  advRouting: ["Automatic model choice", "自動選擇模型"],
  advRoutingWhen: ["You want requests sent to whichever model fits best, with test results to back it.", "希望依測試結果把請求送給最合適的模型時。"],
  advPrompt: ["Codex prompt sections", "Codex 提示詞分段"],
  advPromptWhen: ["You want to add or turn off instructions Codex sends with every task.", "想新增或關閉 Codex 每次都會送出的指令時。"],
  advClaude: ["Claude Code details", "Claude Code 詳細設定"],
  advClaudeWhen: ["You want to pick default models per tier or swap models by rule.", "想依等級設定預設模型或按規則替換模型時。"],
  advProviders: ["Provider details", "供應商詳細設定"],
  advProvidersWhen: ["You hit rate limits or need to change an endpoint, key rotation or API format.", "遇到速率限制，或需要改位址、金鑰輪換、API 格式時。"],
  advStorage: ["Disk space", "磁碟空間"],
  advStorageWhen: ["Codex data is taking too much space and you want it cleaned up automatically.", "Codex 資料佔用空間太多，想自動清理時。"],
  advDiagnostics: ["Diagnostics", "診斷日誌"],
  advDiagnosticsWhen: ["Something misbehaves and you need detailed logs to report it.", "出現異常、需要詳細日誌回報問題時。"],
  advDesktopCompat: ["Codex Desktop fix (experimental)", "Codex 桌面修正（實驗）"],
  advDesktopCompatWhen: ["Windows only: the Codex app stops letting you type after a usage limit.", "僅 Windows：用量上限後 Codex 應用程式無法輸入時。"],
} satisfies Record<string, Row>;

export type ShellV2Key = `shellV2.${keyof typeof rows}`;

export function shellV2Copy(locale: Locale): Record<ShellV2Key, string> {
  const index = locales.indexOf(locale);
  return Object.fromEntries(
    Object.entries(rows).map(([key, row]) => [`shellV2.${key}`, row[index]!]),
  ) as Record<ShellV2Key, string>;
}
