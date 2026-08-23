import type { Locale } from "./shared";

export type VisionReasoningLabelLevel = "low" | "medium" | "high" | "xhigh" | "max";

const VISION_REASONING_LABELS = {
  en: { low: "Low", medium: "Medium", high: "High", xhigh: "Extra high", max: "Maximum" },
  "zh-TW": { low: "低", medium: "中", high: "高", xhigh: "極高", max: "最大" },
} satisfies Record<Locale, Record<VisionReasoningLabelLevel, string>>;

/** Localized display label for the wire-level vision reasoning value. */
export function visionReasoningLabel(locale: Locale, level: VisionReasoningLabelLevel): string {
  return VISION_REASONING_LABELS[locale][level];
}
