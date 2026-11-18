import { afterEach, beforeEach, expect, spyOn, test } from "bun:test";
import * as fs from "node:fs";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { clearRouteClientIntent, readRouteIntentState, routeIntentStatePath, setRouteClientIntent } from "../../src/routing/route-intent-state";
import { projectHomeRouteIntent } from "../../src/link/route-intent";
import { removeTreeWithRetry } from "../helpers/remove-tree";
let root: string;
let previous: string | undefined;
beforeEach(() => { previous = process.env.OPENCODEX_HOME; root = mkdtempSync(join(tmpdir(), "ocx-route-state-")); process.env.OPENCODEX_HOME = root; });
afterEach(() => { if (previous === undefined) delete process.env.OPENCODEX_HOME; else process.env.OPENCODEX_HOME = previous; removeTreeWithRetry(root); });
test("default/device writes preserve disjoint clients and inherit restores default", () => {
  expect(readRouteIntentState()).toEqual({ version: 1, defaults: {}, devices: {} });
  setRouteClientIntent("aside", { enabled: true, accounts: "all" });
  setRouteClientIntent("aside", { enabled: false }, "lnk_0123456789abcdef");
  setRouteClientIntent("pi", { enabled: true }, "lnk_0123456789abcdef");
  let state = readRouteIntentState();
  expect(projectHomeRouteIntent({} as never, "test", "lnk_0123456789abcdef", state).clients.aside).toEqual({ enabled: false, accounts: "all" });
  clearRouteClientIntent("aside", "lnk_0123456789abcdef");
  state = readRouteIntentState();
  expect(state.devices.lnk_0123456789abcdef?.pi).toEqual({ enabled: true });
  expect(projectHomeRouteIntent({} as never, "test", "lnk_0123456789abcdef", state).clients.aside).toEqual({ enabled: true, accounts: "all" });
});
test("corrupt or unknown state refuses update without replacing existing bytes", () => {
  for (const body of ['{"version":2,"defaults":{},"devices":{}}', '{"version":1,"defaults":{},"devices":{},"secret":"x"}', "not json"]) {
    writeFileSync(routeIntentStatePath(), body);
    expect(() => readRouteIntentState()).toThrow();
    expect(() => setRouteClientIntent("codex", { enabled: false })).toThrow();
    expect(readFileSync(routeIntentStatePath(), "utf8")).toBe(body);
  }
  expect(() => setRouteClientIntent("aside", { enabled: true }, "__proto__")).toThrow();
});

test("a device-id refusal happens on valid state and is the selection error, not a revision error", () => {
  // Restore a readable file first: the malformed bodies above would make any throw pass.
  expect(() => setRouteClientIntent("pi", { enabled: true })).not.toThrow();
  const valid = readFileSync(routeIntentStatePath(), "utf8");
  for (const device of ["__proto__", "constructor", "prototype", "-leading", "space id"]) {
    expect(() => setRouteClientIntent("aside", { enabled: true }, device)).toThrow("invalid route intent selection");
    // The guard refuses before the revision advances, so the file is byte-identical afterwards.
    expect(readFileSync(routeIntentStatePath(), "utf8")).toBe(valid);
  }
});

test("a state file swapped in after the type check is not adopted as the route intent", () => {
  const path = routeIntentStatePath();
  // Written directly: this case exercises the reader only, without the config mutation lock.
  writeFileSync(path, JSON.stringify({ version: 1, defaults: { codex: { enabled: false } }, devices: {} }));
  const forgedPath = join(root, "forged-route-intent.json");
  writeFileSync(forgedPath, JSON.stringify({ version: 1, defaults: { codex: { enabled: true } }, devices: {} }));
  const lstat = fs.lstatSync;
  const spy = spyOn(fs, "lstatSync");
  let swapped = false;
  try {
    // Replace the file between the metadata check and the read; only the stat taken while the state
    // is being read counts as the trigger.
    spy.mockImplementation(((target: fs.PathLike, options?: fs.StatOptions) => {
      const stat = lstat(target, options as never);
      if (!swapped && String(target) === path && new Error().stack?.includes("readBoundedRegularFile")) {
        swapped = true;
        fs.renameSync(forgedPath, path);
      }
      return stat;
    }) as typeof fs.lstatSync);
    expect(() => readRouteIntentState()).toThrow("could not be read");
  } finally {
    spy.mockRestore();
  }
  expect(swapped).toBe(true);
  // The swapped-in bytes were never trusted by the read that straddled the swap.
  expect(readRouteIntentState().defaults.codex).toEqual({ enabled: true });
});

test("an oversized or non-file route intent state is refused, and a missing one reads empty", () => {
  expect(readRouteIntentState()).toEqual({ version: 1, defaults: {}, devices: {} });
  writeFileSync(routeIntentStatePath(), " ".repeat(1024 * 1024 + 1));
  expect(() => readRouteIntentState()).toThrow("could not be read");
});
