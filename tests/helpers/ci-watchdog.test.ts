import { afterEach, expect, test } from "bun:test";

import { watchdogMs } from "./ci-watchdog";

const initialCi = process.env.CI;
const initialFullSuite = process.env.OCX_TEST_FULL_SUITE;

afterEach(() => {
  if (initialCi === undefined) delete process.env.CI;
  else process.env.CI = initialCi;
  if (initialFullSuite === undefined) delete process.env.OCX_TEST_FULL_SUITE;
  else process.env.OCX_TEST_FULL_SUITE = initialFullSuite;
});

test("full-suite runner context scales watchdogs without CI", () => {
  delete process.env.CI;
  process.env.OCX_TEST_FULL_SUITE = "1";

  expect(watchdogMs(10_000)).toBe(process.platform === "win32" ? 45_000 : 30_000);
});
