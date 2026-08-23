import type { Locale } from "./catalogs";

export type LogGuardSchemaState = "compatible" | "missing" | "unreadable" | "unsupported";
export type LogGuardProtectionState = "off" | "active" | "drifted" | "unsupported" | "unknown";
export type LogGuardProtectionMode = "off" | "compat" | "quiet" | "collision";

type StateLabels = {
  schema: Record<LogGuardSchemaState, string>;
  protection: Record<LogGuardProtectionState, string>;
  mode: Record<LogGuardProtectionMode, string>;
};

const LABELS: Record<Locale, StateLabels> = {
  en: {
    schema: { compatible: "Compatible", missing: "Database not found", unreadable: "Database unavailable", unsupported: "Unsupported" },
    protection: { off: "Off", active: "Active", drifted: "Needs repair", unsupported: "Unsupported", unknown: "Unknown" },
    mode: { off: "Off", compat: "Compatibility", quiet: "Quiet", collision: "Unknown" },
  },

  "zh-TW": {
    schema: { compatible: "相容", missing: "找不到資料庫", unreadable: "無法讀取資料庫", unsupported: "不支援" },
    protection: { off: "關閉", active: "已啟用", drifted: "需要修復", unsupported: "不支援", unknown: "未知" },
    mode: { off: "關閉", compat: "相容模式", quiet: "靜默模式", collision: "未知" },
  },

};

export function logGuardSchemaStateLabel(locale: Locale, state: LogGuardSchemaState): string {
  return LABELS[locale].schema[state];
}

export function logGuardProtectionStateLabel(locale: Locale, state: LogGuardProtectionState): string {
  return LABELS[locale].protection[state];
}

export function logGuardProtectionModeLabel(locale: Locale, mode: LogGuardProtectionMode): string {
  return LABELS[locale].mode[mode];
}
