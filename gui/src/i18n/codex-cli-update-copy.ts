/*
 * Copy for the Codex CLI update tab (#2811). One row per key, columns in the order of
 * `locales`, kept apart from the per-locale files like shell-v2-copy.ts so the surface lands as
 * one reviewable table. Reason codes the table does not name are shown raw, in <code>.
 */
type Locale = "en" | "zh-TW";
const locales: readonly Locale[] = ["en", "zh-TW"];
type Row = readonly [string, string];

const rows = {
  tab: ["Codex CLI", "Codex CLI"],
  title: ["Codex CLI update", "Codex CLI 更新"],
  description: ["Check and update the Codex CLI installation OpenCodex uses. This is separate from OpenCodex updates and never touches the Codex desktop app.", "檢查並更新 OpenCodex 使用的 Codex CLI 安裝。這與 OpenCodex 更新分開，也不會觸及 Codex 桌面應用程式。"],
  connectedUnavailable: ["Codex CLI updates run on the computer that serves this dashboard's proxy. Open the dashboard on that computer to check or update its Codex CLI.", "Codex CLI 更新在執行此代理的電腦上進行。請在那台電腦上開啟儀表板來檢查或更新它的 Codex CLI。"],
  check: ["Check for update", "檢查更新"],
  checking: ["Checking…", "正在檢查…"],
  checkHint: ["Checking is read-only: it inspects the installation and the npm registry and changes nothing.", "檢查是唯讀的：只查看安裝和 npm 登錄檔，不做任何變更。"],
  fieldProvenance: ["Installed by", "安裝方式"],
  fieldManaged: ["Managed by OpenCodex", "由 OpenCodex 管理"],
  fieldInstalled: ["Installed version", "已安裝版本"],
  fieldTarget: ["Available version", "可用版本"],
  fieldSession: ["Codex sessions", "Codex 工作階段"],
  fieldLocation: ["Location", "位置"],
  fieldCommand: ["Install command", "安裝指令"],
  yes: ["Yes", "是"],
  no: ["No", "否"],
  unknown: ["Unknown", "未知"],
  provNpmGlobal: ["npm (global)", "npm（全域）"],
  provAppBundle: ["Codex desktop app (bundled)", "Codex 桌面應用程式（內建）"],
  provVersionManager: ["A version manager", "版本管理器"],
  provStandaloneUnverified: ["Standalone installer (unverified)", "獨立安裝程式（未驗證）"],
  sessionNone: ["None running", "沒有執行中的工作階段"],
  sessionActive: ["{count} running", "{count} 個執行中"],
  sessionUnknown: ["Could not be checked", "無法檢查"],
  sessionNotEvaluated: ["Not checked", "未檢查"],
  ready: ["An update is ready to apply.", "有可套用的更新。"],
  refusalWindowsInspectionDeferred: ["This Windows installation can't be inspected for updates yet.", "暫時無法檢查此 Windows 安裝的更新。"],
  refusalWindowsApplyDisabled: ["Updating this Windows installation from OpenCodex is not supported yet.", "暫不支援從 OpenCodex 更新此 Windows 安裝。"],
  refusalNotManaged: ["OpenCodex does not manage this installation. Update it with the tool that installed it.", "OpenCodex 不管理此安裝。請用安裝它的工具來更新。"],
  refusalInstalledVersionUnverified: ["The installed version could not be verified.", "無法驗證已安裝的版本。"],
  refusalInstallContentUnverified: ["The installed files could not be verified, so no update is offered.", "無法驗證已安裝的檔案，因此不提供更新。"],
  refusalTargetUnresolved: ["The latest version could not be resolved from the npm registry.", "無法從 npm 登錄檔確定最新版本。"],
  refusalAlreadyCurrent: ["The Codex CLI is already up to date.", "Codex CLI 已是最新版本。"],
  refusalTargetNotNewer: ["The registry version is not newer than the installed one.", "登錄檔中的版本不比已安裝的新。"],
  refusalBlockedActiveSession: ["A Codex session is using this installation. Close it and check again.", "有 Codex 工作階段正在使用此安裝。請關閉後再檢查。"],
  refusalBlockedProcessStateUnknown: ["Running Codex processes could not be checked, so the update waits.", "無法檢查執行中的 Codex 程序，因此暫緩更新。"],
  confirm: ["I understand this changes only this Codex CLI installation. OpenCodex and the desktop app are not updated or restarted.", "我了解這只會變更這個 Codex CLI 安裝。OpenCodex 和桌面應用程式不會被更新或重新啟動。"],
  apply: ["Update Codex CLI", "更新 Codex CLI"],
  applying: ["Updating…", "正在更新…"],
  jobQueued: ["Waiting to start…", "等待開始…"],
  jobRunning: ["Installing…", "正在安裝…"],
  jobApplied: ["Updated. The installed version was read back and matches.", "已更新。已回讀安裝的版本並確認一致。"],
  jobNotApplied: ["Not updated. The installation was left as it was.", "未更新。安裝保持原樣。"],
  jobRefused: ["Refused before anything was installed.", "在安裝任何內容之前被拒絕。"],
  jobAmbiguous: ["The result is unclear. Check the installation yourself; OpenCodex will not retry or roll back.", "結果不明確。請自行檢查安裝；OpenCodex 不會重試或復原。"],
  reasonOwnerStateUnknown: ["OpenCodex lost track of this job (for example after a restart), so its result is unknown.", "OpenCodex 失去了對此工作的追蹤（例如重新啟動後），因此結果未知。"],
  reasonLabel: ["Reason code", "原因代碼"],
  errPlanUnavailable: ["The update check failed. Try again.", "檢查更新失敗。請重試。"],
  errLocalOnly: ["Applying needs a paired browser on this computer. Pair it below (it runs the ocx gui pair command), or update from a terminal:", "套用需要在這台電腦上已配對的瀏覽器。請在下方配對（會使用 ocx gui pair 指令），或在終端機中更新："],
  errIdempotencyConflict: ["This update request no longer matches. Check again before updating.", "此更新請求已不再相符。更新前請重新檢查。"],
  errStore: ["The update job store on this computer can't be used, so the update can't start.", "此電腦上的更新工作儲存無法使用，因此無法開始更新。"],
  errRetry: ["The update could not start right now. Try again.", "現在無法開始更新。請重試。"],
  errApplyFailed: ["The update could not start. The reason code is below.", "無法開始更新。原因代碼見下方。"],
  retry: ["Try again", "重試"],
  errJobNotFound: ["The job record is gone, so its result is unknown. Check the installation yourself.", "工作紀錄已不存在，結果未知。請自行檢查安裝。"],
  errJobUnreadable: ["The job status can't be read right now. Read it from a terminal:", "現在無法讀取工作狀態。請在終端機中查看："],
} satisfies Record<string, Row>;

export type CodexCliUpdateCopyKey = `codexCliUpdate.${keyof typeof rows}`;

export function codexCliUpdateCopy(locale: Locale): Record<CodexCliUpdateCopyKey, string> {
  const column = locales.indexOf(locale);
  return Object.fromEntries(
    Object.entries(rows).map(([key, row]) => [`codexCliUpdate.${key}`, row[column]!]),
  ) as Record<CodexCliUpdateCopyKey, string>;
}
