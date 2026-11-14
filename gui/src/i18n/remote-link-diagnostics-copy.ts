/*
 * Copy for the read-only Remote Link diagnostics section (#7297). One row per key, columns in the
 * order of `locales`, kept apart from the per-locale files like codex-cli-update-copy.ts. Event,
 * outcome and state words are machine codes and are shown raw, in <code>.
 */
type Locale = "en" | "zh-TW";
const locales: readonly Locale[] = ["en", "zh-TW"];
type Row = readonly [string, string];

const rows = {
  title: ["Diagnostics", "診斷"],
  hint: ["Recent tunnel and relay events recorded on this computer. Only fixed categories, generated IDs, numbers and times are kept.", "此電腦上記錄的最近通道和中繼事件。只保留固定類別、產生的 ID、數字和時間。"],
  show: ["Show diagnostics", "顯示診斷"],
  hide: ["Hide diagnostics", "隱藏診斷"],
  loading: ["Loading diagnostics…", "正在載入診斷…"],
  error: ["Diagnostics could not be read. Try again.", "無法讀取診斷。請重試。"],
  empty: ["No diagnostics recorded yet.", "尚未記錄任何診斷。"],
  colTime: ["Time", "時間"],
  colEvent: ["Event", "事件"],
  colOutcome: ["Outcome", "結果"],
  colState: ["State", "狀態"],
  colAttempt: ["Attempt", "嘗試"],
  colPort: ["Port", "連接埠"],
  suppressed: ["+{count} suppressed", "+{count} 筆已合併"],
  showing: ["Showing the newest {shown} of {total} records.", "顯示 {total} 筆記錄中最新的 {shown} 筆。"],
  skipped: ["Skipped unreadable or unrecognized lines: {count}.", "已略過 {count} 行無法讀取或無法辨識的內容。"],
  truncated: ["A diagnostics file is larger than 256 KiB; only its newest 256 KiB were read.", "有診斷檔案超過 256 KiB，只讀取了最新的 256 KiB。"],
  refused: ["A diagnostics file was not read because it is not a regular file.", "有診斷檔案不是一般檔案，因此未讀取。"],
  unreadable: ["A diagnostics file exists but could not be read.", "診斷檔案存在，但無法讀取。"],
} satisfies Record<string, Row>;

export type RemoteLinkDiagnosticsCopyKey = `remoteLinkDiagnostics.${keyof typeof rows}`;

export function remoteLinkDiagnosticsCopy(locale: Locale): Record<RemoteLinkDiagnosticsCopyKey, string> {
  const column = locales.indexOf(locale);
  return Object.fromEntries(
    Object.entries(rows).map(([key, row]) => [`remoteLinkDiagnostics.${key}`, row[column]!]),
  ) as Record<RemoteLinkDiagnosticsCopyKey, string>;
}
