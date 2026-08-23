import { describe, expect, test } from "bun:test";
import { formatUptime } from "../gui/src/formatUptime";

describe("dashboard uptime formatting", () => {
  test("keeps short uptimes in seconds", () => {
    expect(formatUptime(0, "zh-TW")).toBe("0秒");
    expect(formatUptime(299.9, "zh-TW")).toBe("299秒");
  });

  test("uses minutes after five minutes", () => {
    expect(formatUptime(300, "zh-TW")).toBe("5分鐘");
    expect(formatUptime(3599, "zh-TW")).toBe("59分鐘");
  });

  test("uses hours and minutes after one hour", () => {
    expect(formatUptime(3600, "zh-TW")).toBe("1小時");
    expect(formatUptime(64685, "zh-TW")).toBe("17小時 58分鐘");
  });

  test("uses days and hours after one day", () => {
    expect(formatUptime(86400, "zh-TW")).toBe("1天");
    expect(formatUptime(183600, "zh-TW")).toBe("2天 3小時");
  });

  test("uses compact localized units", () => {
    expect(formatUptime(3720, "en")).toBe("1h 2m");
    expect(formatUptime(93600, "zh-TW")).toBe("1天 2小時");
  });
});
