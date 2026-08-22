import type { TKey } from "./en";

export type LabLocale = "en" | "zh-TW";
export type LabCatalogKey = Exclude<Extract<TKey, `lab.${string}`>, `lab.production.${string}`>;
export type LabSupplementKey =
  | "subjectKindUnknown"
  | "artifact.present"
  | "artifact.corrupt"
  | "artifact.purged_unavailable"
  | "selectVerdict"
  | "community.title"
  | "community.notLocalVerdict"
  | "community.bundles"
  | "community.activeRecords"
  | "community.revokedRecords";

const en: Record<LabCatalogKey, string> = {
  "lab.title": "Compatibility Lab",
  "lab.subtitle": "Read-only compatibility verdict matrix from lab projection evidence.",
  "lab.loadFailed": "Could not load compatibility lab data",
  "lab.projectionUnavailable": "Lab projection is not available. Run conformance or live probes first.",
  "lab.projectionIncompatible": "Lab projection schema is incompatible. Rebuild the projection.",
  "lab.statusTitle": "Projection status",
  "lab.matrixTitle": "Compatibility matrix",
  "lab.verdictsTitle": "Verdict records",
  "lab.filter.layer": "Evidence layer",
  "lab.filter.verdict": "Verdict",
  "lab.filter.subject": "Subject ID",
  "lab.filter.all": "All",
  "lab.col.subject": "Subject",
  "lab.col.layer": "Layer",
  "lab.col.suite": "Suite",
  "lab.col.verdict": "Verdict",
  "lab.col.asOf": "As of",
  "lab.col.protocol": "Protocol conformance",
  "lab.col.live": "Live route compatibility",
  "lab.col.task": "Task effectiveness",
  "lab.empty": "No compatibility verdicts in the projection yet.",
  "lab.subjectKind": "Kind",
  "lab.observationCount": "Observations",
  "lab.eventCount": "Events",
  "lab.verdictCount": "Verdicts",
  "lab.subjectCount": "Subjects",
  "lab.builtAt": "Built",
  "lab.loading": "Loading compatibility evidence…",
  "lab.loadMore": "Load more",
  "lab.detailTitle": "Verdict detail",
  "lab.detailClose": "Close",
  "lab.detailSubject": "Subject",
  "lab.detailObservations": "Observations",
  "lab.detailEvents": "Evidence events",
  "lab.detailArtifacts": "Artifact metadata",
  "lab.detailLoadFailed": "Could not load verdict detail",
  "lab.refresh": "Refresh",
  "lab.verdict.UNKNOWN": "Unknown",
  "lab.verdict.CLAIMED": "Claimed",
  "lab.verdict.PROBED": "Probed",
  "lab.verdict.VERIFIED": "Verified",
  "lab.verdict.DEGRADED": "Degraded",
  "lab.verdict.BLOCKED": "Blocked",
  "lab.verdict.UNSUPPORTED": "Unsupported",
  "lab.layer.protocol_conformance": "Protocol conformance",
  "lab.layer.live_route_compatibility": "Live route compatibility",
  "lab.layer.task_effectiveness": "Task effectiveness",
};

const zhTW: Record<LabCatalogKey, string> = {
  "lab.title": "相容性實驗室",
  "lab.subtitle": "基於實驗室投影證據的唯讀相容性判定矩陣。",
  "lab.loadFailed": "無法載入相容性實驗室資料",
  "lab.projectionUnavailable": "實驗室投影不可用。請先執行一致性探測或即時探測。",
  "lab.projectionIncompatible": "實驗室投影架構不相容。請重新建置投影。",
  "lab.statusTitle": "投影狀態",
  "lab.matrixTitle": "相容性矩陣",
  "lab.verdictsTitle": "判定記錄",
  "lab.filter.layer": "證據層",
  "lab.filter.verdict": "判定",
  "lab.filter.subject": "主體 ID",
  "lab.filter.all": "全部",
  "lab.col.subject": "主體",
  "lab.col.layer": "層",
  "lab.col.suite": "測試套件",
  "lab.col.verdict": "判定",
  "lab.col.asOf": "截至",
  "lab.col.protocol": "協定一致性",
  "lab.col.live": "即時路由相容性",
  "lab.col.task": "任務有效性",
  "lab.empty": "投影中還沒有相容性判定。",
  "lab.subjectKind": "類型",
  "lab.observationCount": "觀測",
  "lab.eventCount": "事件",
  "lab.verdictCount": "判定",
  "lab.subjectCount": "主體",
  "lab.builtAt": "建置時間",
  "lab.loading": "正在載入相容性證據…",
  "lab.loadMore": "載入更多",
  "lab.detailTitle": "判定詳情",
  "lab.detailClose": "關閉",
  "lab.detailSubject": "主體",
  "lab.detailObservations": "觀測",
  "lab.detailEvents": "證據事件",
  "lab.detailArtifacts": "產物中繼資料",
  "lab.detailLoadFailed": "無法載入判定詳情",
  "lab.refresh": "重新整理",
  "lab.verdict.UNKNOWN": "未知",
  "lab.verdict.CLAIMED": "已聲明",
  "lab.verdict.PROBED": "已探測",
  "lab.verdict.VERIFIED": "已驗證",
  "lab.verdict.DEGRADED": "降級",
  "lab.verdict.BLOCKED": "已封鎖",
  "lab.verdict.UNSUPPORTED": "不支援",
  "lab.layer.protocol_conformance": "協定一致性",
  "lab.layer.live_route_compatibility": "即時路由相容性",
  "lab.layer.task_effectiveness": "任務有效性",
};

export const LAB_CATALOG_OVERRIDES: Record<LabLocale, Record<LabCatalogKey, string>> = {
  en,
  "zh-TW": zhTW,
};

const supplements: Record<LabLocale, Record<LabSupplementKey, string>> = {

  en: {
    subjectKindUnknown: "Unknown",
    "artifact.present": "Present",
    "artifact.corrupt": "Corrupt",
    "artifact.purged_unavailable": "Purged / unavailable",
    selectVerdict: "View verdict for {subject}",
    "community.title": "Community evidence",
    "community.notLocalVerdict": "Untrusted read-only context. Not included in this local verdict.",
    "community.bundles": "Bundles",
    "community.activeRecords": "Active records",
    "community.revokedRecords": "Revoked records",
  },

  "zh-TW": {
    subjectKindUnknown: "未知",
    "artifact.present": "存在",
    "artifact.corrupt": "已損壞",
    "artifact.purged_unavailable": "已清除 / 不可用",
    selectVerdict: "查看 {subject} 的判定",
    "community.title": "社群證據",
    "community.notLocalVerdict": "不受信任的唯讀脈絡。不計入此本地判定。",
    "community.bundles": "證據包",
    "community.activeRecords": "有效記錄",
    "community.revokedRecords": "已撤銷記錄",
  }
};

export function labSupplement(
  locale: LabLocale,
  key: LabSupplementKey,
  vars?: Record<string, string | number>,
): string {
  let value = supplements[locale][key];
  if (vars) {
    for (const [name, replacement] of Object.entries(vars)) {
      value = value.split(`{${name}}`).join(String(replacement));
    }
  }
  return value;
}
