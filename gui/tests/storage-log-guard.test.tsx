import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import StorageWorkspace, { type StorageReport } from "../src/components/storage-workspace/StorageWorkspace";
import { LanguageProvider } from "../src/i18n/provider";
import { DICTS, I18nContext, interpolate, type TFn } from "../src/i18n/shared";

function report(): StorageReport {
  return {
    codexHome: "/home/user/.codex",
    generatedAt: 1,
    total: { bytes: 1024, fileCount: 1 },
    buckets: [],
    codexLogs: {
      generatedAt: 1,
      externalSqliteHome: true,
      snapshot: "checkpointed",
      files: { databaseBytes: 8192, walBytes: 2048, shmBytes: 0 },
      schema: { state: "compatible" },
      capabilities: {
        inspection: { state: "supported" },
        protection: { state: "supported" },
        reclaim: { state: "supported" },
      },
      metrics: {
        totalRows: 400,
        rowsByLevel: { TRACE: 200, INFO: 200 },
        traceRows: 200,
        traceShare: 0.5,
        topTargets: [{ target: "TARGET_1", rows: 180 }],
        pageSize: 4096,
        pageCount: 2,
        freelistPages: 1,
        reclaimableBytes: 4096,
        estimatedLogBytes: 350,
      },
    },
  };
}

function traditionalT(): TFn {
  return (key, vars) => interpolate(DICTS["zh-TW"][key] ?? DICTS.en[key] ?? key, vars);
}

test("Storage overview renders read-only Codex diagnostic log health", () => {
  const html = renderToStaticMarkup(
    <LanguageProvider>
      <StorageWorkspace report={report()} locale="en" />
    </LanguageProvider>,
  );

  expect(html).toContain('data-testid="codex-log-guard"');
  expect(html).toContain("Logs database");
  expect(html).toContain("Compatible");
  expect(html).not.toContain(">compatible<");
  expect(html).toContain("400");
  expect(html).toContain("50.0%");
  expect(html).toContain("8 KiB");
  expect(html).toContain("2 KiB");
  expect(html).toContain("4 KiB");
  expect(html).toContain("WAL");
  expect(html).toContain("SHM");
  expect(html).toContain("0 B");
  expect(html).toContain("TARGET_1");
  expect(html).not.toContain("codex_api::sse");
  expect(html).toContain("External SQLite storage");
  expect(html).toContain("snapshot=checkpointed");
  expect(html).not.toContain("/state/codex");
  expect(html).not.toContain("Protect");
  expect(html).not.toContain("Compact");
  expect(html).not.toContain("High write activity");
});

test("Storage overview localizes schema, external, and inspect-only labels", () => {
  const value = report();
  value.codexLogs = {
    ...value.codexLogs!,
    schema: { state: "unsupported", reason: "unknown_schema" },
    capabilities: {
      inspection: { state: "supported" },
      protection: { state: "unsupported", reason: "unknown_schema" },
      reclaim: { state: "unsupported", reason: "unknown_schema" },
    },
  };

  const html = renderToStaticMarkup(
    <I18nContext.Provider value={{ locale: "zh-TW", setLocale: () => {}, t: traditionalT() }}>
      <StorageWorkspace report={value} locale="zh-TW" />
    </I18nContext.Provider>,
  );

  expect(html).toContain("不支援");
  expect(html).not.toContain(">unsupported<");
  expect(html).toContain("僅檢查");
  expect(html).toContain("外部 SQLite 儲存空間");
  expect(html).not.toContain("inspection-only");
  expect(html).not.toContain("external sqlite_home");
  expect(html).not.toContain("/state/codex");
});

test("Storage overview renders a fixed localized inspection-failure state", () => {
  const value = report();
  value.codexLogs = null;
  value.codexLogsError = "inspect_failed";

  const html = renderToStaticMarkup(
    <I18nContext.Provider value={{ locale: "zh-TW", setLocale: () => {}, t: traditionalT() }}>
      <StorageWorkspace report={value} locale="zh-TW" />
    </I18nContext.Provider>,
  );

  expect(html).toContain('data-testid="codex-log-guard-unavailable"');
  expect(html).toContain("診斷記錄檢查目前無法使用。");
  expect(html).not.toContain("inspect_failed");
});

test("Storage overview does not render arbitrary Log Guard error strings", () => {
  const value = report();
  value.codexLogs = null;
  value.codexLogsError = "/private/state/logs_2.sqlite failed";

  const html = renderToStaticMarkup(
    <LanguageProvider>
      <StorageWorkspace report={value} locale="en" />
    </LanguageProvider>,
  );

  expect(html).not.toContain('data-testid="codex-log-guard-unavailable"');
  expect(html).not.toContain("/private/state/logs_2.sqlite");
  expect(html).not.toContain("failed");
});
