import { describe, expect, test } from "bun:test";
import { DICTS } from "../src/i18n/catalogs";
import { interpolate, type Locale, type TFn } from "../src/i18n/shared";
import {
  formatEstimatedUsd,
  formatEstimatedUsdValue,
  summarizeEstimatedCosts,
} from "../src/pages/logs-cost-format";

function translator(locale: Locale): TFn {
  return (key, vars) => interpolate(DICTS[locale][key], vars);
}

test("ordinary dashboard costs retain the estimate marker", () => {
  expect(formatEstimatedUsdValue(0.77, translator("en"), "en-US", false)).toBe("~$0.7700");
});

test("priority long-context lower bounds render with a greater-than-or-equal marker", () => {
  expect(formatEstimatedUsdValue(0.77, translator("en"), "en-US", true)).toBe("≥$0.7700");
});

test("USD placement and separators follow Traditional Chinese locale", () => {
  const amount = new Intl.NumberFormat("zh-TW", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  }).format(0.77);
  expect(formatEstimatedUsdValue(0.77, translator("zh-TW"), "zh-TW", false)).toBe(`約 ${amount}`);
  expect(formatEstimatedUsd({ kind: "unavailable" }, translator("zh-TW"), "zh-TW")).toBe("無法估算");
});

describe("conversation cost lower-bound aggregation", () => {
  const priced = (total: number, lowerBound: boolean) => ({
    usageStatus: "reported",
    displayMetrics: {
      cost: {
        kind: "value" as const,
        estimate: { cost: { total }, priorityLowerBound: lowerBound },
      },
    },
  });

  test("marks a total only when every included priced estimate is a lower bound", () => {
    expect(summarizeEstimatedCosts([priced(0.77, true), priced(1.23, true)])).toMatchObject({
      estimatedCostUsd: 2,
      priorityLowerBound: true,
    });
    expect(summarizeEstimatedCosts([priced(0.77, true), priced(1.23, false)])).toMatchObject({
      estimatedCostUsd: 2,
      priorityLowerBound: false,
    });
  });

  test("preserves unpriced and unsupported exclusions without minting a lower bound", () => {
    expect(summarizeEstimatedCosts([
      { usageStatus: "reported", displayMetrics: { cost: { kind: "unavailable" } } },
      { usageStatus: "unsupported" },
    ])).toEqual({
      estimatedCostUsd: 0,
      priorityLowerBound: false,
      unpricedRequests: 1,
      unmeteredRequests: 1,
    });
  });
});
