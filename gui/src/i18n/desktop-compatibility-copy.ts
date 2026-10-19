type Locale = "en" | "zh-TW";
const locales: readonly Locale[] = ["en", "zh-TW"];
type Row = readonly [string, string];
const rows = {
  observation: ["Identity-checked usage responses: JSON {json}, SSE {sse}; active bound streams: {streams}. Counts do not identify the sending process or prove composer recovery.", "身分已驗證的用量回應：JSON {json}，SSE {sse}；作用中的綁定串流：{streams}。這些計數無法證明傳送程序或輸入框已恢復。"],
  cacheRefreshHint: ["Stopping correction does not immediately reset the Codex display. Codex must receive fresh usage data; this panel cannot confirm that refresh.", "停止修正不會立即還原 Codex 畫面。Codex 必須收到新的用量資料；此面板無法確認是否已更新。"],
  routingChanged: ["Native Codex routing no longer matches this OpenCodex process. Correction is off; review the integration before restarting observation.", "原生 Codex 路由與此 OpenCodex 程序不再相符。修正已關閉；重新觀察前請檢查整合。"],
  autoStart: ["Resume observation when OpenCodex starts", "OpenCodex 啟動時恢復觀察"],
  autoStartHint: ["Applies at the next proxy start and requires an existing trusted certificate. Does not open Codex, register trust or start a correction trial. Turning this off does not stop a running service.", "從下次代理啟動起生效，需要已受信任的憑證。不會開啟 Codex、註冊信任或啟動修正試驗。關閉此選項不會停止執行中的服務。"],
  connectionUnavailable: ["The saved local connection could not be opened. Its address was not changed automatically.", "無法開啟儲存的本機連線。並未自動變更其位址。"],
  blockedByBuild: ["This Codex build has not been assessed. Compatibility correction is unavailable; refresh alone will not enable it.", "此 Codex 版本尚未評估。相容修正無法使用，重新整理不會啟用它。"],
  blockedByProxy: ["The outbound proxy setting is invalid or unsupported. Correct it before starting observation; no direct fallback was used.", "輸出代理設定無效或不受支援。觀察前請修正；並未改用直接連線。"],
  closeApp: ["Save drafts, close Codex, then refresh status before trying again.", "儲存草稿並關閉 Codex，然後重新整理狀態再重試。"],
  connectedUnavailable: ["These local controls are unavailable in OpenCodex managed client mode.", "OpenCodex 受管理用戶端模式不提供這些本機控制。"],
  title: ["Desktop compatibility", "桌面相容"],
  description: ["Experimental Windows integration. Keeps the Codex login; setup alone does not enable correction.", "實驗性 Windows 整合。保留 Codex 登入；僅完成準備不會啟用修正。"],
  refresh: ["Refresh status", "重新整理狀態"],
  prepare: ["Prepare certificate", "準備憑證"],
  trust: ["Register trust", "註冊信任"],
  remove: ["Remove trust", "移除信任"],
  renew: ["Renew certificate", "更新憑證"],
  start: ["Start observation", "開始觀察"],
  stop: ["Stop service", "停止服務"],
  launch: ["Open Codex", "開啟 Codex"],
  observe: ["Return to observation", "返回觀察"],
  apply: ["Run 3-minute trial", "執行 3 分鐘試驗"],
  confirm: ["Confirm action", "確認操作"],
  acknowledge: ["I understand the scope of this action.", "我了解此操作的範圍。"],
  risk: ["Trust applies to this Windows user and allows the local relay to handle chatgpt.com traffic. Stop the service and close Codex before renewal or removal. Stopping may interrupt active connections.", "信任適用於此 Windows 使用者，允許本機中繼處理 chatgpt.com 流量。更新或移除前請停止服務並關閉 Codex。停止可能中斷使用中的連線。"],
  trialRisk: ["For up to 3 minutes, two UI flags are adjusted for the whole signed-in account, across models. Usage, credits and server limits remain unchanged. Observed exhaustion is required; a response does not prove the composer recovered.", "最多 3 分鐘內，調整整個已登入帳戶的兩個介面旗標，影響所有模型。用量、點數和伺服器限制不變。必須觀察到額度耗盡；收到回應不代表輸入框已恢復。"],
  error: ["Completion could not be confirmed. Refresh status before retrying.", "無法確認是否完成。重試前請重新整理狀態。"],
  done: ["Action confirmed. Status refreshed.", "操作已確認，狀態已重新整理。"],
  certificate: ["Certificate", "憑證"],
  runtime: ["Service", "服務"],
  expiry: ["Expires", "到期"],
  renewalDue: ["Certificate renewal is due soon.", "憑證即將需要更新。"],
  unsupported: ["Available on supported Windows installations only.", "僅適用於受支援的 Windows 安裝。"],
  localOnly: ["Changes require this computer’s local dashboard. Save drafts and close Codex before launching it here.", "變更需要此電腦的本機儀表板。在此啟動前，請儲存草稿並關閉 Codex。"],
  reconnectHint: ["A running service does not confirm that Codex is connected. After a normal app launch or update, close Codex and use Open Codex here to restore the managed connection. An unreviewed app version cannot run a correction trial.", "服務執行不代表 Codex 已連線。一般啟動或更新應用程式後，請關閉 Codex 並使用此處的開啟 Codex 恢復受管理連線。未經驗證的應用程式版本無法執行修正試驗。"],
  assessedPackage: ["Verified package version", "已驗證的套件版本"],
  observedPackage: ["Last observed package version", "上次偵測到的套件版本"],
  lastObservedAt: ["Observed at", "偵測時間"],
  noObservedPackage: ["Not detected", "未偵測到"],
} as const satisfies Record<string, Row>;

export function desktopCompatibilityCopy(locale: Locale): Record<`desktopCompat.${keyof typeof rows}`, string> {
  const index = locales.indexOf(locale);
  return Object.fromEntries(Object.entries(rows).map(([key, values]) => [`desktopCompat.${key}`, values[index]!])) as Record<`desktopCompat.${keyof typeof rows}`, string>;
}
