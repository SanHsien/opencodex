import { copyTable, type Row } from "./copy-table";

/*
 * Copy for the Home "Public profile & rank" card (the opt-in leaderboard profile). Columns: en, zh-TW
 * (this fork keeps only those two locales). Keys render as `telemetryProfile.<key>`.
 */
const rows = {
  title: ["Public profile & rank", "公開資料與排名"],
  lede: ["Join the opencodex.me leaderboard and see where your usage ranks. Off unless you connect it.", "加入 opencodex.me 排行榜，查看你的用量排名。在你主動連接前保持關閉。"],
  publicWhat: ["Public: the handle, name and colour you choose, your rank, and daily request, token and model-family totals.", "公開：你選擇的帳號名稱、名稱與顏色，你的排名，以及每日請求、Token 與模型系列合計。"],
  neverWhat: ["Never shared: prompts, responses, keys, accounts, e-mail, devices or your anonymous telemetry ID.", "絕不分享：提示詞、回覆、金鑰、帳號、電子郵件、裝置或你的匿名遙測 ID。"],
  learnMore: ["How it works", "運作方式"],
  connect: ["Connect", "連接"],
  connecting: ["Connecting…", "正在連接…"],
  cancel: ["Cancel", "取消"],
  handleLabel: ["Handle", "帳號名稱"],
  handleHint: ["3–24 lowercase letters, digits or hyphens", "3–24 個小寫字母、數字或連字號"],
  nameLabel: ["Display name", "顯示名稱"],
  colourLabel: ["Colour", "顏色"],
  acknowledge: ["I understand this profile and its totals are public.", "我了解此資料及其合計是公開的。"],
  errTaken: ["That handle is already taken.", "該帳號名稱已被使用。"],
  errInvalid: ["Check the handle and display name.", "請檢查帳號名稱與顯示名稱。"],
  errRateLimited: ["Too many profiles were created from this network. Try again later.", "此網路建立的資料過多，請稍後再試。"],
  errTelemetryOff: ["Turn anonymous telemetry on first.", "請先開啟匿名遙測。"],
  errSession: ["Connecting needs a dashboard session you opened yourself, or the CLI: ocx telemetry profile connect.", "連接需要你親自開啟的儀表板工作階段，或使用 CLI：ocx telemetry profile connect。"],
  errUnavailable: ["The telemetry service could not be reached. Nothing was saved.", "無法連線至遙測服務，未儲存任何內容。"],
  day: ["Day", "日"],
  week: ["Week", "週"],
  month: ["Month", "月"],
  rankOf: ["#{rank} of {of}", "第 {rank} 名 / 共 {of}"],
  notRanked: ["Not ranked yet", "尚未排名"],
  totals: ["{tokens} tokens · {requests} requests", "{tokens} Token · {requests} 請求"],
  firstRank: ["Your first rank appears after your first full UTC day.", "首個排名會在你的第一個完整 UTC 日之後出現。"],
  topModels: ["Top model families this month", "本月主要模型系列"],
  viewLeaderboard: ["View leaderboard", "查看排行榜"],
  disconnect: ["Disconnect", "中斷連接"],
  disconnectConfirm: ["Delete your public profile and all its data?", "刪除你的公開資料及其全部資料？"],
  disconnectYes: ["Delete profile", "刪除資料"],
  deletionPending: ["Deletion is pending: the telemetry service could not be reached. Nothing more is sent, and the proxy keeps retrying.", "刪除待處理：無法連線至遙測服務。不會再傳送任何內容，代理會持續重試。"],
  retry: ["Retry", "重試"],
  paused: ["Paused while anonymous telemetry is off.", "匿名遙測關閉期間已暫停。"],
  revoked: ["The telemetry service no longer knows this profile. Disconnect and connect again.", "遙測服務已不再識別此資料。請中斷後重新連接。"],
  rankUnavailable: ["Rank is unavailable right now.", "暫時無法取得排名。"],
  unreadable: ["The local profile file cannot be read, so nothing is sent. Disconnect removes it.", "無法讀取本機資料檔案，因此不會傳送任何內容。中斷連接會刪除該檔案。"],
} satisfies Record<string, Row>;

export const telemetryProfileCopy = copyTable("telemetryProfile", rows);
