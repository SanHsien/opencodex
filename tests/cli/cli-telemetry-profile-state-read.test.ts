import { afterEach, beforeEach, expect, spyOn, test } from "bun:test";
import * as fs from "node:fs";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { telemetryProfilePath } from "../../src/telemetry/profile/paths";
import { readTelemetryProfileFile, writeTelemetryProfileState } from "../../src/telemetry/profile/state";
import { removeTreeWithRetry } from "../helpers/remove-tree";

const SECRET = "ocxp_" + "c".repeat(43);
const profile = (secret: string) => ({
  version: 1 as const, handle: "jun", displayName: "Jun", avatar: "blue" as const, secret,
  connectedAt: "2026-11-01T00:00:00.000Z", connectedDay: "2026-11-01", sentDays: {},
  lastSentDay: null, lastSentAt: null, retryAfterUntil: null, pendingDelete: false, revoked: false,
});

let home: string;
beforeEach(() => { home = mkdtempSync(join(tmpdir(), "ocx-profile-read-")); });
afterEach(() => { removeTreeWithRetry(home); });

test("a profile file swapped in after the type check is never adopted for its bearer secret", () => {
  writeTelemetryProfileState(profile(SECRET), home);
  const path = telemetryProfilePath(home);
  const forgedPath = join(home, "forged-profile.json");
  writeFileSync(forgedPath, JSON.stringify(profile("ocxp_" + "d".repeat(43))));
  const lstat = fs.lstatSync;
  const spy = spyOn(fs, "lstatSync");
  let swapped = false;
  let result: ReturnType<typeof readTelemetryProfileFile>;
  try {
    spy.mockImplementation(((target: fs.PathLike, options?: fs.StatOptions) => {
      const stat = lstat(target, options as never);
      if (!swapped && String(target) === path && new Error().stack?.includes("readBoundedRegularFile")) {
        swapped = true;
        fs.renameSync(forgedPath, path);
      }
      return stat;
    }) as typeof fs.lstatSync);
    result = readTelemetryProfileFile(home);
  } finally {
    spy.mockRestore();
  }
  expect(swapped).toBe(true);
  // Untrusted, not "not connected": a disconnect is still offered and nothing is sent over it.
  expect(result).toEqual({ state: null, unreadable: true });
});

test("a missing profile reads as not connected; an oversized one reads as unreadable", () => {
  expect(readTelemetryProfileFile(home)).toEqual({ state: null, unreadable: false });
  writeTelemetryProfileState(profile(SECRET), home);
  expect(readTelemetryProfileFile(home).state?.secret).toBe(SECRET);
  writeFileSync(telemetryProfilePath(home), " ".repeat(64 * 1024 + 1));
  expect(readTelemetryProfileFile(home)).toEqual({ state: null, unreadable: true });
});
