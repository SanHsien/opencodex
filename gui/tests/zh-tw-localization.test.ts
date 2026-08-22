import { describe, expect, test } from "bun:test";
import { formatResetFuture } from "../src/components/QuotaBars";
import { formatUptime } from "../src/formatUptime";
import type { TKey } from "../src/i18n";
import { DICTS, LOCALES } from "../src/i18n/shared";
import { labSupplement } from "../src/i18n/lab-translations";
import { ROUTING_COMPATIBILITY_FIELD_LABELS } from "../src/i18n/routing-compatibility-labels";
import { visionReasoningLabel } from "../src/i18n/vision-reasoning-labels";
import { formatCreditDate, formatCreditDateTime } from "../src/intl-formatters";
import { formatCreatedDate } from "../src/pages/api-keys-utils";
import { statusCodeInfo } from "../src/status-codes";

describe("Traditional Chinese localization surfaces", () => {
  test("registers 繁體中文 with the zh-TW HTML language tag", () => {
    const locale = LOCALES.find(item => item.code === "zh-TW");
    expect(locale).toEqual({ code: "zh-TW", htmlLang: "zh-TW" });
    expect(DICTS["zh-TW"]["lang.nativeName"]).toBe("繁體中文");
  });

  test("localizes Lab copy and supplements", () => {
    expect(DICTS["zh-TW"]["lab.title"]).toBe("相容性實驗室");
    expect(labSupplement("zh-TW", "artifact.present")).toBe("存在");
    expect(labSupplement("zh-TW", "selectVerdict", { subject: "subject-a" })).toContain("subject-a");
    expect(labSupplement("zh-TW", "community.title")).toBe("社群證據");
  });

  test("localizes specific and generic HTTP errors", () => {
    expect(statusCodeInfo(401, "zh-TW")).toEqual({
      label: "未授權",
      description: expect.stringContaining("憑證"),
    });
    expect(statusCodeInfo(418, "zh-TW")?.label).toBe("請求錯誤");
    expect(statusCodeInfo(599, "zh-TW")?.label).toBe("伺服器或上游錯誤");
    expect(statusCodeInfo(401, "zh-CN")?.label).toBe("未授權");
  });

  test("localizes reasoning and routing compatibility labels", () => {
    expect(visionReasoningLabel("zh-TW", "xhigh")).toBe("極高");
    expect(ROUTING_COMPATIBILITY_FIELD_LABELS["zh-TW"]).toEqual({
      maxEvidenceAgeMs: "證據最大有效期限（毫秒）",
      unknownEvidence: "未知證據",
      degradedEvidence: "降級證據",
    });
  });

  test("uses Traditional Chinese date, time, and duration formatting", () => {
    const iso = "2026-07-31T12:34:56Z";
    const date = new Date(iso);
    const expectedDate = new Intl.DateTimeFormat("zh-TW", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(date);
    const expectedDateTime = new Intl.DateTimeFormat("zh-TW", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);

    expect(formatCreditDate(iso, "zh-TW")).toBe(expectedDate);
    expect(formatCreditDateTime(iso, "zh-TW")).toBe(expectedDateTime);
    expect(formatCreatedDate(iso, "zh-TW")).toBe(date.toLocaleDateString("zh-TW"));
    expect(formatUptime(90060, "zh-TW")).toBe("1天 1小時");

    const t = (key: TKey, vars?: Record<string, string | number>) => {
      let value = DICTS["zh-TW"][key];
      for (const [name, replacement] of Object.entries(vars ?? {})) {
        value = value.replaceAll(`{${name}}`, String(replacement));
      }
      return value;
    };
    expect(formatResetFuture(
      Date.UTC(2026, 6, 31, 12, 34),
      t,
      "zh-TW",
      Date.UTC(2026, 6, 31, 10, 34),
    )).toBe("2 小時後重設");
  });
});
