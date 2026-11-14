/**
 * Copy for the opencodex.me leaderboard section (TelemetryLeaderboard.astro): connected public
 * profiles only. Same locales as the anonymous dashboard copy, kept in a separate table because
 * profiles are something a person connects, while the anonymous telemetry is on by default.
 */
export const TELEMETRY_LEADERBOARD_LOCALES = ["en", "zh-tw"] as const;
export type TelemetryLeaderboardLocale = (typeof TELEMETRY_LEADERBOARD_LOCALES)[number];

export interface TelemetryLeaderboardCopy {
  title: string;
  subtitle: string;
  periodAria: string;
  periodDay: string;
  periodWeek: string;
  periodMonth: string;
  metricAria: string;
  metricTokens: string;
  metricRequests: string;
  colRank: string;
  colProfile: string;
  colTokens: string;
  colRequests: string;
  loading: string;
  empty: string;
  error: string;
  retry: string;
  findLabel: string;
  findButton: string;
  findInvalid: string;
  profileNotFound: string;
  profileRankOf: string;
  profileNotRanked: string;
  profileFamilies: string;
  profileClose: string;
  howToJoin: string;
}

export const TELEMETRY_LEADERBOARD_STRINGS: Record<TelemetryLeaderboardLocale, TelemetryLeaderboardCopy> = {
  "en": {
    title: "Leaderboard",
    subtitle: "Profiles that people connected from their own opencodex dashboard. Daily totals are self-reported.",
    periodAria: "Leaderboard period",
    periodDay: "Day",
    periodWeek: "Week",
    periodMonth: "Month",
    metricAria: "Rank by",
    metricTokens: "Tokens",
    metricRequests: "Requests",
    colRank: "Rank",
    colProfile: "Profile",
    colTokens: "Tokens",
    colRequests: "Requests",
    loading: "Loading the leaderboard…",
    empty: "No public profiles yet.",
    error: "The leaderboard could not be loaded.",
    retry: "Try again",
    findLabel: "Find a profile by handle",
    findButton: "Find",
    findInvalid: "Handles are 3–24 lowercase letters, digits or hyphens.",
    profileNotFound: "No public profile has that handle.",
    profileRankOf: "#{rank} of {of}",
    profileNotRanked: "Not ranked",
    profileFamilies: "Top model families this month",
    profileClose: "Close",
    howToJoin: "Connect a profile from the Home screen of your opencodex dashboard, or run ocx telemetry profile connect. Disconnecting deletes it.",
  },
  "zh-tw": {
    title: "排行榜",
    subtitle: "由使用者在自己的 opencodex 儀表板中連接的資料。每日合計為自行回報。",
    periodAria: "排行榜期間",
    periodDay: "日",
    periodWeek: "週",
    periodMonth: "月",
    metricAria: "排名依據",
    metricTokens: "Token",
    metricRequests: "請求",
    colRank: "排名",
    colProfile: "資料",
    colTokens: "Token",
    colRequests: "請求",
    loading: "正在載入排行榜…",
    empty: "尚無公開資料。",
    error: "無法載入排行榜。",
    retry: "重試",
    findLabel: "依帳號名稱尋找資料",
    findButton: "尋找",
    findInvalid: "帳號名稱為 3–24 個小寫字母、數字或連字號。",
    profileNotFound: "沒有使用該帳號名稱的公開資料。",
    profileRankOf: "第 {rank} 名 / 共 {of}",
    profileNotRanked: "未排名",
    profileFamilies: "本月主要模型系列",
    profileClose: "關閉",
    howToJoin: "在 opencodex 儀表板的首頁連接資料，或執行 ocx telemetry profile connect。中斷連接會刪除資料。",
  },
};

export function resolveTelemetryLeaderboardLocale(locale: string | null | undefined): TelemetryLeaderboardLocale {
  const normalized = (locale ?? "en").toLowerCase();
  return (TELEMETRY_LEADERBOARD_LOCALES as readonly string[]).includes(normalized)
    ? (normalized as TelemetryLeaderboardLocale)
    : "en";
}

export function getTelemetryLeaderboardCopy(locale: string | null | undefined): TelemetryLeaderboardCopy {
  return TELEMETRY_LEADERBOARD_STRINGS[resolveTelemetryLeaderboardLocale(locale)];
}
