export const TELEMETRY_DASHBOARD_LOCALES = ["en", "zh-tw"] as const;

export type TelemetryDashboardLocale = (typeof TELEMETRY_DASHBOARD_LOCALES)[number];

export interface TelemetryDashboardCopy {
  title: string;
  subtitle: string;
  rangeAria: string;
  range7d: string;
  range30d: string;
  range90d: string;
  range365d: string;
  updatedPrefix: string;
  updatedPending: string;
  privacyBadge: string;
  selfReportedLabel: string;
  privacyBody: string;
  privacyOptOutHint: string;
  privacyGuideLink: string;
  stateLoadingTitle: string;
  stateLoadingBody: string;
  stateEmptyTitle: string;
  stateEmptyBody: string;
  stateErrorTitle: string;
  stateErrorBody: string;
  retryButton: string;
  kpiSectionAria: string;
  kpiActiveInstalls: string;
  kpiNewInstalls: string;
  kpiRequests: string;
  kpiTokens: string;
  kpiActiveHours: string;
  tokenMixTitle: string;
  tokenMixSubtitle: string;
  tokenInput: string;
  tokenCacheRead: string;
  tokenCacheWrite: string;
  tokenOutput: string;
  tokenReasoning: string;
  heatmapTitle: string;
  heatmapSubtitle: string;
  heatmapActiveDays: string;
  heatmapPeakDay: string;
  heatmapLess: string;
  heatmapMore: string;
  heatmapTooltipUnit: string;
  heatmapKeyboardHint: string;
  dailyChartTitle: string;
  dailyChartSubtitle: string;
  metricTokens: string;
  metricRequests: string;
  providersTitle: string;
  providersSubtitle: string;
  modelsTitle: string;
  modelsSubtitle: string;
  colProvider: string;
  colModel: string;
  colRequests: string;
  colTokens: string;
  colShare: string;
  versionsTitle: string;
  versionsSubtitle: string;
  platformsTitle: string;
  platformsSubtitle: string;
  channelsTitle: string;
  channelsSubtitle: string;
  colVersion: string;
  colPlatform: string;
  colChannel: string;
  colInstalls: string;
  colNewInstalls: string;
  colInstallShare: string;
  reliabilityTitle: string;
  reliabilitySubtitle: string;
  completionRateLabel: string;
  outcomeCompleted: string;
  outcomeIncomplete: string;
  outcomeAborted: string;
  outcomeFailed: string;
  topErrorsTitle: string;
  colErrorCause: string;
  colErrorCount: string;
  noErrorsRecorded: string;
  downloadsTitle: string;
  downloadsSubtitle: string;
  npmWeeklyLabel: string;
  npmMonthlyLabel: string;
  npmYearlyLabel: string;
  githubTotalLabel: string;
  githubLatestLabel: string;
  downloadsPartial: string;
  downloadsUnavailable: string;
  noDataInTable: string;
  creditPrefix: string;
  creditSuffix: string;
}

export const TELEMETRY_DASHBOARD_STRINGS: Readonly<
  Record<TelemetryDashboardLocale, TelemetryDashboardCopy>
> = {
  en: {
    title: "Usage Dashboard",
    subtitle:
      "Project-wide anonymous daily aggregates, with all figures self-reported by opencodex installs (on by default after a person has seen the privacy notice, unless declined or turned off).",
    rangeAria: "Reporting window",
    range7d: "7d",
    range30d: "30d",
    range90d: "90d",
    range365d: "365d",
    updatedPrefix: "Updated",
    updatedPending: "Awaiting snapshot",
    privacyBadge: "Anonymous aggregates only",
    selfReportedLabel: "Self-reported by opencodex installs",
    privacyBody:
      "Telemetry is on by default and sends nothing until a person has seen the notice. Reports carry closed-vocabulary daily counts with a rotating daily install hash — never prompts, model outputs, API keys, account identifiers, file paths, or IP addresses.",
    privacyOptOutHint:
      "Disable anytime with ocx telemetry disable, OCX_TELEMETRY=0, or DO_NOT_TRACK=1.",
    privacyGuideLink: "Telemetry & privacy guide",
    stateLoadingTitle: "Loading project telemetry…",
    stateLoadingBody:
      "Fetching aggregate usage snapshot from telemetry.opencodex.me.",
    stateEmptyTitle: "Collector not deployed yet",
    stateEmptyBody:
      "The public collector at telemetry.opencodex.me is not deployed yet or has not recorded daily aggregates for this window.",
    stateErrorTitle: "Could not load live telemetry",
    stateErrorBody:
      "The request to telemetry.opencodex.me did not complete (the collector may not be deployed yet or is temporarily unreachable).",
    retryButton: "Retry",
    kpiSectionAria: "Key usage metrics",
    kpiActiveInstalls: "Avg daily active installs",
    kpiNewInstalls: "New installs",
    kpiRequests: "Requests",
    kpiTokens: "Total tokens",
    kpiActiveHours: "Active hours",
    tokenMixTitle: "Token mix",
    tokenMixSubtitle:
      "Disjoint token buckets across all reported model families — segments sum to 100% of total tokens.",
    tokenInput: "Input",
    tokenCacheRead: "Cache read",
    tokenCacheWrite: "Cache write",
    tokenOutput: "Output",
    tokenReasoning: "Reasoning",
    heatmapTitle: "365-day activity heatmap",
    heatmapSubtitle:
      "Daily reporting installs over the trailing 52 weeks (UTC).",
    heatmapActiveDays: "{count} active days",
    heatmapPeakDay: "Peak: {date} ({count})",
    heatmapLess: "Low",
    heatmapMore: "High",
    heatmapTooltipUnit: "active installs",
    heatmapKeyboardHint:
      "Use arrow keys to inspect adjacent days, Home and End to jump to range boundaries, and Escape to dismiss the tooltip.",
    dailyChartTitle: "Daily usage by provider kind",
    dailyChartSubtitle:
      "Stacked daily volume across the selected reporting window.",
    metricTokens: "Tokens",
    metricRequests: "Requests",
    providersTitle: "Provider kinds",
    providersSubtitle:
      "Closed vendor roster share by tokens and requests.",
    modelsTitle: "Model families",
    modelsSubtitle:
      "Coarse model family share by tokens and requests.",
    colProvider: "Provider kind",
    colModel: "Model family",
    colRequests: "Requests",
    colTokens: "Tokens",
    colShare: "Token share",
    versionsTitle: "Versions",
    versionsSubtitle:
      "Active and newly reporting installs by release version.",
    platformsTitle: "Platforms",
    platformsSubtitle: "OS and CPU architecture distribution.",
    channelsTitle: "Install channels",
    channelsSubtitle: "How reporting proxies were installed.",
    colVersion: "Version",
    colPlatform: "Platform",
    colChannel: "Channel",
    colInstalls: "Installs",
    colNewInstalls: "New",
    colInstallShare: "Share",
    reliabilityTitle: "Reliability & outcomes",
    reliabilitySubtitle:
      "Request outcome ratio and top closed-vocabulary failure causes.",
    completionRateLabel: "Completion rate",
    outcomeCompleted: "Completed",
    outcomeIncomplete: "Incomplete",
    outcomeAborted: "Aborted",
    outcomeFailed: "Failed",
    topErrorsTitle: "Top failure causes",
    colErrorCause: "Failure cause",
    colErrorCount: "Count",
    noErrorsRecorded: "No failure causes recorded in this window.",
    downloadsTitle: "Package & release downloads",
    downloadsSubtitle:
      "Live download counts from npm (@bitkyc08/opencodex) and GitHub release assets (lidge-jun/opencodex).",
    npmWeeklyLabel: "npm (last 7 days)",
    npmMonthlyLabel: "npm (last 30 days)",
    npmYearlyLabel: "npm (last 365 days)",
    githubTotalLabel: "GitHub release assets (total)",
    githubLatestLabel: "Latest release assets",
    downloadsPartial: "partial",
    downloadsUnavailable: "Unavailable",
    noDataInTable: "No data reported for this window.",
    creditPrefix:
      "Visual design and contribution heatmap patterns adapted from",
    creditSuffix: "(MIT License).",
  },
  "zh-tw": {
    title: "使用量儀表板",
    subtitle:
      "由 opencodex 安裝實例自行回報之全專案匿名每日彙總（於使用者查看隱私提示後預設開啟，除非拒絕或關閉）。",
    rangeAria: "統計時間範圍",
    range7d: "7天",
    range30d: "30天",
    range90d: "90天",
    range365d: "365天",
    updatedPrefix: "更新於",
    updatedPending: "等待快照",
    privacyBadge: "僅限匿名彙總資料",
    selfReportedLabel: "由 opencodex 安裝實例自行回報",
    privacyBody:
      "遙測預設開啟，但在人工查看隱私提示前不會傳送任何資料。回報資料僅包含固定詞彙的每日計數與每日輪替的安裝雜湊——絕不包含提示詞、模型輸出、API 金鑰、帳號識別碼、檔案路徑或 IP 位址。",
    privacyOptOutHint:
      "可隨時透過 ocx telemetry disable、OCX_TELEMETRY=0 或 DO_NOT_TRACK=1 關閉。",
    privacyGuideLink: "遙測與隱私指南",
    stateLoadingTitle: "正在載入專案遙測資料…",
    stateLoadingBody: "正在從 telemetry.opencodex.me 取得彙總快照。",
    stateEmptyTitle: "收集器尚未部署",
    stateEmptyBody:
      "位於 telemetry.opencodex.me 的公開收集器尚未部署，或此時間範圍內尚無每日彙總紀錄。",
    stateErrorTitle: "無法載入即時遙測資料",
    stateErrorBody:
      "對 telemetry.opencodex.me 的請求未能完成（收集器可能尚未部署或暫時無法連線）。",
    retryButton: "重試",
    kpiSectionAria: "核心使用指標",
    kpiActiveInstalls: "日均活躍安裝",
    kpiNewInstalls: "新增安裝",
    kpiRequests: "請求數",
    kpiTokens: "總 Token 數",
    kpiActiveHours: "活躍小時數",
    tokenMixTitle: "Token 構成",
    tokenMixSubtitle:
      "輸入、快取讀取、快取寫入、輸出與推理五個互不重疊的 Token 桶，總和為 100%。",
    tokenInput: "輸入",
    tokenCacheRead: "快取讀取",
    tokenCacheWrite: "快取寫入",
    tokenOutput: "輸出",
    tokenReasoning: "推理",
    heatmapTitle: "365 天活躍熱力圖",
    heatmapSubtitle: "過去 52 週每日活躍安裝量（UTC）。",
    heatmapActiveDays: "{count} 個活躍日",
    heatmapPeakDay: "峰值：{date}（{count}）",
    heatmapLess: "低",
    heatmapMore: "高",
    heatmapTooltipUnit: "活躍安裝",
    heatmapKeyboardHint:
      "使用方向鍵瀏覽相鄰日期，Home/End 跳至起訖日期，Escape 關閉提示框。",
    dailyChartTitle: "依供應商類型的每日使用量",
    dailyChartSubtitle: "所選時間視窗內的每日堆疊趨勢。",
    metricTokens: "Token",
    metricRequests: "請求數",
    providersTitle: "供應商類型",
    providersSubtitle: "依 Token 與請求數統計的供應商佔比。",
    modelsTitle: "模型系列",
    modelsSubtitle: "依 Token 與請求數統計的模型系列佔比。",
    colProvider: "供應商類型",
    colModel: "模型系列",
    colRequests: "請求數",
    colTokens: "Token",
    colShare: "Token 佔比",
    versionsTitle: "版本分佈",
    versionsSubtitle: "各發佈版本的活躍安裝與新增安裝。",
    platformsTitle: "平台分佈",
    platformsSubtitle: "作業系統與 CPU 架構分佈。",
    channelsTitle: "安裝管道",
    channelsSubtitle: "回報代理的安裝方式分佈。",
    colVersion: "版本",
    colPlatform: "平台",
    colChannel: "管道",
    colInstalls: "安裝量",
    colNewInstalls: "新增",
    colInstallShare: "佔比",
    reliabilityTitle: "可靠性與請求結果",
    reliabilitySubtitle: "請求完成率與主要失敗原因（固定錯誤碼）。",
    completionRateLabel: "完成率",
    outcomeCompleted: "已完成",
    outcomeIncomplete: "未完成",
    outcomeAborted: "已中止",
    outcomeFailed: "失敗",
    topErrorsTitle: "主要失敗原因",
    colErrorCause: "失敗原因",
    colErrorCount: "次數",
    noErrorsRecorded: "此時間視窗內無失敗紀錄。",
    downloadsTitle: "套件與發行版下載量",
    downloadsSubtitle:
      "來自 npm (@bitkyc08/opencodex) 與 GitHub Release 資產 (lidge-jun/opencodex) 的即時下載統計。",
    npmWeeklyLabel: "npm（最近 7 天）",
    npmMonthlyLabel: "npm（最近 30 天）",
    npmYearlyLabel: "npm（最近 365 天）",
    githubTotalLabel: "GitHub 發行版資產（累計）",
    githubLatestLabel: "最新發行版資產",
    downloadsPartial: "部分統計",
    downloadsUnavailable: "暫不可用",
    noDataInTable: "此時間視窗內暫無回報資料。",
    creditPrefix: "視覺設計與貢獻熱力圖模式改編自",
    creditSuffix: "（MIT 授權條款）。",
  },
};

export function resolveTelemetryDashboardLocale(
  raw: string | null | undefined,
): TelemetryDashboardLocale {
  if (!raw) return "en";
  const normalized = raw.trim().toLowerCase();
  if ((TELEMETRY_DASHBOARD_LOCALES as readonly string[]).includes(normalized)) {
    return normalized as TelemetryDashboardLocale;
  }
  return "en";
}

export function getTelemetryDashboardCopy(
  locale: string | null | undefined,
): TelemetryDashboardCopy {
  return TELEMETRY_DASHBOARD_STRINGS[resolveTelemetryDashboardLocale(locale)];
}
