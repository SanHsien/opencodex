import type { Locale } from "./catalogs";

export type LogGuardOperationLabelKey =
  | "applying"
  | "error.generic"
  | "error.codex_running"
  | "error.process_enumeration_failed"
  | "error.busy"
  | "error.unsupported_schema"
  | "error.unsafe_path"
  | "error.database_error"
  | "error.auto_vacuum_not_incremental"
  | "error.integrity_check_failed";

const LABELS: Record<Locale, Record<LogGuardOperationLabelKey, string>> = {
  en: {
    applying: "Applying Log Guard change…",
    "error.generic": "Could not update Codex log storage.",
    "error.codex_running": "Quit Codex before changing Codex log storage.",
    "error.process_enumeration_failed": "Could not verify that Codex is stopped. The Log Guard operation was not started.",
    "error.busy": "The Codex logs database is busy. Quit Codex and try again.",
    "error.unsupported_schema": "This Codex logs schema is not supported for this operation.",
    "error.unsafe_path": "The Codex logs database path failed the safety check.",
    "error.database_error": "Could not update the Codex logs database.",
    "error.auto_vacuum_not_incremental": "This Codex logs database is not configured for incremental vacuum, so space cannot be reclaimed without a full rebuild.",
    "error.integrity_check_failed": "The Codex logs database failed its integrity check. No space was reclaimed.",
  },

  "zh-TW": {
    applying: "正在套用 Log Guard 變更…",
    "error.generic": "無法更新 Codex 日誌儲存空間。",
    "error.codex_running": "變更 Codex 日誌儲存空間前請先退出 Codex。",
    "error.process_enumeration_failed": "無法確認 Codex 已停止，因此未啟動 Log Guard 操作。",
    "error.busy": "Codex 日誌資料庫忙碌中。請退出 Codex 後重試。",
    "error.unsupported_schema": "此 Codex 日誌資料庫結構不支援此操作。",
    "error.unsafe_path": "Codex 日誌資料庫路徑未通過安全檢查。",
    "error.database_error": "無法更新 Codex 日誌資料庫。",
    "error.auto_vacuum_not_incremental": "此 Codex 日志数据库未配置增量清理，因此不完整重建就无法回收空间。",
    "error.integrity_check_failed": "Codex 日志数据库完整性检查失败，未回收任何空间。",
  },

};

export function logGuardOperationLabel(locale: Locale, key: LogGuardOperationLabelKey): string {
  return LABELS[locale][key];
}
