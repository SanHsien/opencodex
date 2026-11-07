import { copyTable, type Row } from "./copy-table";

/*
 * Copy for the v2 Logs & Debug, Storage page. Columns: en, zh-TW (this fork keeps only these two locales).
 * Keys render as `logsV2.<key>`.
 */
const rows = {
  requests: ["Requests", "請求"],
  live: ["Live", "即時"],
  paused: ["Paused", "已暫停"],
  liveHint: ["New requests appear every 2 seconds", "每 2 秒顯示新請求"],
  filters: ["Filters", "篩選"],
  columns: ["Columns", "欄位"],
  columnsMenu: ["Show or hide columns", "顯示或隱藏欄位"],
  removeFilter: ["Remove filter: {name}", "移除篩選：{name}"],
  countLine: ["{shown} of {total} requests", "{total} 個請求中的 {shown} 個"],
  failedCount: ["{count} failed", "{count} 個失敗"],
  debugLogging: ["Debug logging", "除錯日誌"],
  debugTail: ["Live tail", "即時日誌"],
  debugLines: ["{count} lines", "{count} 行"],
  debugStream: ["Stream", "資料流"],
} satisfies Record<string, Row>;

export const logsV2Copy = copyTable("logsV2", rows);
