import { afterEach, beforeAll, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { COLD_SPAWN_WARMUP_HOOK_BUDGET_MS, warmModuleGraph } from "../helpers/cold-spawn-warmup";
import { removeTreeWithRetry } from "../helpers/remove-tree";
import { repoPath } from "../helpers/repo-root";
import { watchdogMs } from "../helpers/ci-watchdog";
import { spawnTestChild, TEST_CHILD_REAP_RESERVE_MS } from "../helpers/spawn-test-child";

const roots: string[] = [];
afterEach(() => {
  while (roots.length) removeTreeWithRetry(roots.pop()!);
});

// Every case runs its real command bodies in a fresh Bun child, and the child's first act is to load
// this module graph. The nightly Windows run 42309802238 (shard 2/11) spent 47.7s and 37.5s in the
// last two cases of this file where run 42130890278, on the same commit, spent about 1.2s and 1.6s
// each, with six cases in between at 2.9s to 7.9s. The log held nothing else: the child's output
// was never read once the test timer killed it (`Received: 143`). So the graph is paid once here,
// in setup, instead of inside a timed child, and the child bound below reports the phase it was in.
const ABSENCE_CHILD_IMPORTS = `
  import * as liveness from ${JSON.stringify(repoPath("src/server/proxy-liveness.ts"))};
  import { readAlivePid, readPidFileValue, removePidIfValueIs } from ${JSON.stringify(repoPath("src/config/process-state.ts"))};
  import { reconcileStartupJournal, markCrossHomeSibling } from ${JSON.stringify(repoPath("src/cli/cross-home-owner.ts"))};
  import { recoverStartStateUnderOwnershipLease } from ${JSON.stringify(repoPath("src/cli/start-owner-fence.ts"))};
  import { decideStartWithLiveOwner } from ${JSON.stringify(repoPath("src/cli/dispatch.ts"))};
`;
const DEAD_OWNER_CHILD_IMPORTS = `
  import { readAlivePid } from ${JSON.stringify(repoPath("src/config/process-state.ts"))};
  import { recoverStartJournalAfterOwnerRecheck, recoverStartStateUnderOwnershipLease } from ${JSON.stringify(repoPath("src/cli/start-owner-fence.ts"))};
`;

beforeAll(async () => {
  await warmModuleGraph({
    graph: "cli-start-owner-absence/children",
    // The union of both children: the dead-owner child's modules are the absence child's plus one
    // export, and concatenating the two lists would redeclare bindings. Each child keeps its own
    // import list, so the warm-up may load a module a given child does not; that costs only the
    // warm-up child a little extra work.
    source: ABSENCE_CHILD_IMPORTS + `
      import { recoverStartJournalAfterOwnerRecheck } from ${JSON.stringify(repoPath("src/cli/start-owner-fence.ts"))};
    `,
  });
}, COLD_SPAWN_WARMUP_HOOK_BUDGET_MS);

// The child's own bound is the one the whole case used to get (watchdogMs(30_000), 45s on Windows
// CI). The case timer gains only the reap headroom: spawnTestChild arms its reap reserve once, after
// the deadline kill, so the worst case is the deadline plus one reserve. That keeps the case timer
// from being the thing that ends a stalled child, and the stall is reported with its phases.
const CHILD_DEADLINE_MS = watchdogMs(30_000);
const CASE_BUDGET_MS = CHILD_DEADLINE_MS + TEST_CHILD_REAP_RESERVE_MS;

/**
 * Phase markers a child writes to stderr, so a stalled case names where it stopped. Stderr is
 * only read when a case fails. A static import is evaluated before the first marker, so
 * `modules-loaded` carries the whole module-graph load time of the child.
 */
const PHASE_MARKER = String.raw`
  const phase = name => process.stderr.write("[owner-absence-child] " + name + " at " + Math.round(performance.now()) + "ms\n");
  phase("modules-loaded");
`;

async function runChild(root: string, home: string, codex: string, script: string): Promise<string> {
  const result = await spawnTestChild([process.execPath, script], {
    cwd: root,
    env: {
      HOME: root, USERPROFILE: root, OPENCODEX_HOME: home, CODEX_HOME: codex,
      OCX_OWNER_REGISTRY_DIR: join(root, "registry"), XDG_RUNTIME_DIR: root,
    },
    deadlineMs: CHILD_DEADLINE_MS,
  });
  const diagnostics = (result.timedOut ? `child killed at the ${CHILD_DEADLINE_MS}ms deadline; ` : "")
    + `exit=${String(result.exitCode)} elapsedMs=${result.elapsedMs.toFixed(0)}\n${result.stderr}`;
  expect(result.timedOut, diagnostics).toBe(false);
  expect(result.exitCode, diagnostics).toBe(0);
  return result.stdout;
}

// Exercise the real command bodies, lease wrapper, liveness retries, cross-home
// discovery and journal recovery. Only command IO and probe transport are supplied.
for (const scenario of ["start", "ensure", "service", "supervised", "sibling", "restart-parent", "connected-client"] as const) {
  test(`consecutive transport misses preserve PID and journal for ${scenario}`, async () => {
    const root = mkdtempSync(join(tmpdir(), "ocx-absence-"));
    roots.push(root);
    const codex = join(root, "codex"), home = join(root, "ocx");
    mkdirSync(codex); mkdirSync(home);
    const configPath = join(codex, "config.toml");
    const journalPath = join(codex, "opencodex-journal.json");
    const pidPath = join(home, "ocx.pid");
    const injected = '# injected\nmodel_provider = "opencodex"\n';
    writeFileSync(configPath, injected);
    writeFileSync(pidPath, String(process.pid));
    writeFileSync(join(home, "config.json"), JSON.stringify({ port: 0, providers: {} }));
    const journal = JSON.stringify({ version: 1,
      originalConfig: Buffer.from('# original\nmodel_provider = "openai"\n').toString("base64"),
      originalProfile: null, injectedConfigHash: createHash("sha256").update(injected).digest("hex"),
      injectedProfileHash: null, pid: 999_999, timestamp: new Date().toISOString(),
    });
    writeFileSync(journalPath, journal);
    const cli = readFileSync(repoPath("src/cli/index.ts"), "utf8");
    const fence = readFileSync(repoPath("src/cli/start-owner-fence.ts"), "utf8");
    const commands = cli.slice(cli.indexOf("async function findProxyOwnerBeforeJournalRecovery("), cli.indexOf("function detachedStartEnvironment("))
      + cli.slice(cli.indexOf("async function handleEnsure("), cli.indexOf("async function handleTrayProxyStart("));
    const recheck = fence.slice(fence.indexOf("export async function recoverStartJournalAfterOwnerRecheck("), fence.indexOf("/** Hold ownership stable"));
    const executable = new Bun.Transpiler({ loader: "ts" }).transformSync(commands + recheck.replace("export ", ""));
    const script = join(root, "consecutive-misses.ts");
    writeFileSync(script, `${ABSENCE_CHILD_IMPORTS}${PHASE_MARKER}
      const events = [], messages = [];
      let probes = 0, attempts = 0, leased = false;
      const scenario = ${JSON.stringify(scenario)}, pid = ${process.pid};
      class StartCommandExit extends Error { constructor(readonly exitCode) { super("exit"); } }
      const fakeProcess = { env: { OCX_SERVICE: ["service", "supervised"].includes(scenario) ? "1" : undefined },
        exitCode: 0, exit(code) { throw new StartCommandExit(code); } };
      const probeIo = budget => {
        if (budget !== liveness.START_OWNERSHIP_LIVENESS) throw new Error("changed liveness budget");
        events.push("probe:" + (++probes) + ":" + leased);
        return { ...budget, readPidFn: readAlivePid,
          readRuntimeFn: () => ({ pid, port: 10100, hostname: "127.0.0.1" }), verifyPidFn: candidate => candidate,
          configFn: () => ({ port: 10100, hostname: "127.0.0.1" }), sleepFn: async () => {},
          loopbackAvailabilityFn: () => "available",
          fetchFn: async () => {
            attempts++;
            if (probes <= 2) throw Object.assign(new Error("untrusted-secret-transport-detail"), { code: "ETIMEDOUT" });
            return Response.json({ service: "opencodex", status: "ok", pid });
          },
        };
      };
      const deps = {
        process: fakeProcess, console: { log() {}, warn() {}, error: message => messages.push(message) }, StartCommandExit,
        START_OWNERSHIP_LIVENESS: liveness.START_OWNERSHIP_LIVENESS,
        findLiveProxy: budget => liveness.findLiveProxy(probeIo(budget)),
        observeProxyLiveness: budget => liveness.observeProxyLiveness(probeIo(budget)),
        readPidFileValue, readRuntimePort: () => ({ pid, port: 10100 }),
        removePidIfValueIs: value => { events.push("pid-remove"); removePidIfValueIs(value); },
        acquireOwnershipMutationLease: () => { leased = true; events.push("lease"); return { release() { leased = false; events.push("release"); } }; },
        recoverStartStateUnderOwnershipLease, decideStartWithLiveOwner,
        serviceStatePaths: () => ({}), serviceChildOwnershipDecisionForClassifiedChild: () => ({ kind: "proceed" }),
        isSupervisedServiceChild: () => scenario === "supervised", serviceStayOutExitCode: () => 0,
        forgetUpdateTeardownHandover() {}, updateRestartChild: null,
        startupDataPlaneToken: () => null, isApiAuthRequired: () => false, loadConfig: () => ({}),
        parseStartCliOptions: () => ({ port: scenario === "sibling" ? 10101 : undefined }),
        honorSiblingMarker: () => null, consumeSiblingHandoff() {},
        takeRestartHandoffMarkers: () => scenario === "restart-parent" ? pid : null,
        probeOwnerPastRestartParent: probe => probe(), duplicateRuntimeMessage: () => "Proxy already running",
        markSiblingStart: () => events.push("sibling"),
        markCrossHomeSibling: async () => { events.push("cross-home"); return markCrossHomeSibling(); },
        markLiveHomeSibling: async () => false,
        reconcileStartupJournal: () => { events.push("recover"); reconcileStartupJournal(); },
        readClientConnectionState: () => ({ kind: scenario === "connected-client" ? "connected" : "disconnected" }),
        inspectClientRotationRecoveryGate: () => ({}),
        startClientRuntimeUnderOwnershipLease: () => { throw new Error("unexpected client bind"); },
        deferServiceChildToNewerRuntime: async () => null, packageVersion: () => "test", currentServingCommand: () => [],
        maybeShowUpdatePrompt: async () => {}, bindAndPublishStartOwnership: async deps => deps.bind(),
        chooseListenPort: () => { throw new Error("unexpected bind"); }, codexAutoStartEnabled: () => false,
      };
      const api = new Function(...Object.keys(deps), ${JSON.stringify(executable)} + "; return { handleStart, handleEnsure };")(...Object.values(deps));
      let refusal;
      try { await (scenario === "ensure" ? api.handleEnsure() : api.handleStart({ block: false })); }
      catch (error) {
        if (error instanceof StartCommandExit) fakeProcess.exitCode = error.exitCode;
        else { refusal = error.message; fakeProcess.exitCode = 1; }
      }
      phase("command-returned");
      console.log(JSON.stringify({ events, probes, attempts, exitCode: fakeProcess.exitCode, refusal, messages }));
    `);
    const stdout = await runChild(root, home, codex, script);
    const result = JSON.parse(stdout);
    expect(readFileSync(configPath, "utf8"), stdout).toBe(injected);
    expect(existsSync(journalPath), stdout).toBe(true);
    expect(readFileSync(journalPath, "utf8")).toBe(journal);
    expect(readFileSync(pidPath, "utf8")).toBe(String(process.pid));
    expect(result.events).toEqual(["probe:1:false", "lease", "probe:2:true", "release"]);
    expect(result.probes).toBe(2);
    expect(result.attempts).toBe(18); // Two endpoints: early single-family + leased two-family, three attempts each.
    expect(result.exitCode).toBe(1);
    expect(result.refusal).toMatch(/ownership.*unverified/i);
    expect(result.refusal).not.toContain("untrusted-secret");
  }, CASE_BUDGET_MS);
}

test("an exited recorded owner on a refused port still recovers its journal and stale PID", async () => {
  const root = mkdtempSync(join(tmpdir(), "ocx-dead-owner-"));
  roots.push(root);
  const home = join(root, "ocx"), codex = join(root, "codex");
  mkdirSync(home); mkdirSync(codex);
  const original = '# original\nmodel_provider = "openai"\n';
  const injected = '# injected\nmodel_provider = "opencodex"\n';
  const configPath = join(codex, "config.toml"), journalPath = join(codex, "opencodex-journal.json");
  writeFileSync(configPath, injected);
  writeFileSync(journalPath, JSON.stringify({ version: 1,
    originalConfig: Buffer.from(original).toString("base64"), originalProfile: null,
    injectedConfigHash: createHash("sha256").update(injected).digest("hex"), injectedProfileHash: null,
    pid: 999_999, timestamp: new Date().toISOString(),
  }));
  const script = join(root, "dead-owner.ts");
  writeFileSync(script, `
    import { writeFileSync } from "node:fs";${DEAD_OWNER_CHILD_IMPORTS}${PHASE_MARKER}
    const dead = Bun.spawn([process.execPath, "--version"], { stdout: "ignore", stderr: "ignore" });
    if (await dead.exited !== 0) throw new Error("fixture child failed");
    phase("fixture-owner-exited");
    const listener = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: () => new Response(null) });
    const port = listener.port;
    await listener.stop(true);
    phase("fixture-port-released");
    writeFileSync(${JSON.stringify(join(home, "config.json"))}, JSON.stringify({ port, hostname: "127.0.0.1", providers: {} }));
    writeFileSync(${JSON.stringify(join(home, "ocx.pid"))}, String(dead.pid));
    writeFileSync(${JSON.stringify(join(home, "runtime-port.json"))}, JSON.stringify({ pid: dead.pid, port, hostname: "127.0.0.1" }));
    if (readAlivePid() !== null) throw new Error("fixture owner is still alive");
    const events = [], owner = { live: null, pidSnapshot: dead.pid };
    const sibling = await recoverStartStateUnderOwnershipLease({ supervised: false,
      acquireLease: () => { events.push("lease"); return { release() { events.push("release"); } }; },
      decide: () => ({ kind: "proceed" }), stayOut: () => { throw new Error("unexpected stay-out"); },
      recover: () => recoverStartJournalAfterOwnerRecheck(owner),
    });
    phase("recovery-returned");
    console.log(JSON.stringify({ sibling, live: owner.live, events }));
  `);
  const stdout = await runChild(root, home, codex, script);
  expect(JSON.parse(stdout.trim().split("\n").at(-1)!)).toEqual({ sibling: false, live: null, events: ["lease", "release"] });
  expect(readFileSync(configPath, "utf8")).toBe(original);
  expect(existsSync(journalPath)).toBe(false);
  expect(existsSync(join(home, "ocx.pid"))).toBe(false);
}, CASE_BUDGET_MS);
