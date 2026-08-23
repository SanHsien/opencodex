import type { Locale } from "./catalogs";

export type LogGuardLabelKey =
  | "inspectionOnly"
  | "externalSqliteHome"
  | "inspectionUnavailable"
  | "protection"
  | "compat"
  | "quiet"
  | "disable"
  | "repair"
  | "compact"
  | "pagesUnit"
  | "compactComplete"
  | "compactPartial"
  | "confirmCompact"
  | "cancel"
  | "applying"
  | "error.generic"
  | "error.codex_running"
  | "error.process_enumeration_failed"
  | "error.busy"
  | "error.unsupported_schema"
  | "error.trigger_collision"
  | "error.unsafe_path"
  | "error.database_error"
  | "error.config_write_failed";

const LABELS: Record<Locale, Record<LogGuardLabelKey, string>> = {
  en: {
    compact: 'Compact',
    compactComplete: "Compaction complete (logical / on-disk reclaimed)",
    pagesUnit: "pages",
    compactPartial: "Compaction partial (logical / on-disk reclaimed)",
    confirmCompact: 'Confirm compaction',
    cancel: 'Cancel',
    inspectionOnly: 'Inspection only',
    externalSqliteHome: 'External SQLite storage',
    inspectionUnavailable: "Diagnostic log inspection is unavailable.",
    protection: "Protection",
    compat: "Compatibility",
    quiet: "Quiet",
    disable: "Disable protection",
    repair: "Repair protection",
    applying: "Applying protection…",
    "error.generic": "Could not change Codex log protection.",
    "error.codex_running": "Quit Codex before changing log protection.",
    "error.process_enumeration_failed": "Could not verify that Codex is stopped. Protection was not changed.",
    "error.busy": "The Codex logs database is busy. Quit Codex and try again.",
    "error.unsupported_schema": "This Codex logs schema is not supported for protection.",
    "error.trigger_collision": "A reserved Log Guard trigger name is already in use. Protection was not changed.",
    "error.unsafe_path": "The Codex logs database path failed the safety check.",
    "error.database_error": "Could not update the Codex logs database.",
    "error.config_write_failed": "The database changed, but OpenCodex could not save the protection setting. Fix config storage, then run Repair.",
  },

  "zh-TW": {
    compact: '壓縮',
    compactComplete: "压缩完成（逻辑 / 磁盘回收）",
    pagesUnit: "頁",
    compactPartial: "压缩部分完成（逻辑 / 磁盘回收）",
    confirmCompact: '確認壓縮',
    cancel: '取消',
    inspectionOnly: '僅檢查',
    externalSqliteHome: '外部 SQLite 儲存空間',
    inspectionUnavailable: "診斷記錄檢查目前無法使用。",
    protection: "保護",
    compat: "相容模式",
    quiet: "靜默模式",
    disable: "停用保護",
    repair: "修復保護",
    applying: "正在套用保護…",
    "error.generic": "無法變更 Codex 日誌保護。",
    "error.codex_running": "變更 Codex 日誌保護前請先退出 Codex。",
    "error.process_enumeration_failed": "無法確認 Codex 已停止，因此未變更保護設定。",
    "error.busy": "Codex 日誌資料庫忙碌中。請退出 Codex 後重試。",
    "error.unsupported_schema": "此 Codex 日誌資料庫結構不支援保護功能。",
    "error.trigger_collision": "保留的 Log Guard 觸發器名稱已被使用，因此未變更保護設定。",
    "error.unsafe_path": "Codex 日誌資料庫路徑未通過安全檢查。",
    "error.database_error": "無法更新 Codex 日誌資料庫。",
    "error.config_write_failed": "資料庫已變更，但 OpenCodex 無法儲存保護設定。請先修復設定儲存空間，再執行「修復保護」。",
  },

};

export function logGuardLabel(locale: Locale, key: LogGuardLabelKey): string {
  return LABELS[locale][key];
}
