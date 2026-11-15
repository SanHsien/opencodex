import { describe, expect, test } from "bun:test";
import { escapeCmdArg, escapeCmdCommand } from "../../src/lib/win-exec";
import { codexExecInvocation, isSpawnableCodexCandidate } from "../../src/codex/catalog";
import { runCodexDebugModels, runCodexDebugModelsAsync } from "../../src/codex/catalog/bundled";
import { resolveCodexRuntime, resolveCodexRuntimeAsync } from "../../src/codex/runtime";

for (const asynchronous of [false, true]) {
  test(`internal ${asynchronous ? "async" : "sync"} version probe bypasses custom shims to prevent ensure recursion`, async () => {
    const environments: NodeJS.ProcessEnv[] = [];
    const capture = (_file: string, _args: string[], options: { env?: NodeJS.ProcessEnv }) => {
      environments.push(options.env ?? {});
      return "codex-cli 0.133.0";
    };
    const deps = {
      platform: "win32" as const,
      env: { OPENCODEX_CODEX_BIN: "C:\\fixture\\codex.cmd", PATH: "", OCX_SHIM_BYPASS: "0" },
      existsSync: () => true,
      execFileSync: capture,
      execFile: async (...args: Parameters<typeof capture>) => capture(...args),
    };
    if (asynchronous) await resolveCodexRuntimeAsync(deps); else resolveCodexRuntime(deps);
    expect(environments.length).toBeGreaterThan(0);
    for (const env of environments) expect(env.OCX_SHIM_BYPASS).toBe("1");
    expect(deps.env.OCX_SHIM_BYPASS).toBe("0");
  });

  test(`internal ${asynchronous ? "async" : "sync"} catalog command bypasses ensure while preserving caller environment`, async () => {
    let observed: NodeJS.ProcessEnv | undefined;
    const capture = (_file: string, _args: string[], options: { env?: NodeJS.ProcessEnv }) => {
      observed = options.env;
      return "{}";
    };
    const deps = { platform: "win32" as const, env: { CODEX_HOME: "fixture-home", OCX_SHIM_BYPASS: "0" } };
    if (asynchronous) await runCodexDebugModelsAsync("C:\\fixture\\codex.cmd", async (...args) => capture(...args), deps);
    else runCodexDebugModels("C:\\fixture\\codex.cmd", capture, deps);
    expect(observed?.OCX_SHIM_BYPASS).toBe("1");
    expect(observed?.CODEX_HOME).toBe("fixture-home");
    expect(deps.env.OCX_SHIM_BYPASS).toBe("0");
  });
}

describe("codexExecInvocation", () => {
  test("routes Windows .cmd/.bat through ComSpec with escaped args (no shell:true)", () => {
    const spaced = "C:\\Users\\John Doe\\AppData\\Roaming\\npm\\codex.cmd";
    const invocation = codexExecInvocation(spaced, ["--version"], "win32", {
      env: { ComSpec: "C:\\Windows\\System32\\cmd.exe" },
    });
    const line = [escapeCmdCommand(spaced), escapeCmdArg("--version")].join(" ");
    expect(invocation).toEqual({
      file: "C:\\Windows\\System32\\cmd.exe",
      args: ["/d", "/s", "/c", `"${line}"`],
      options: { windowsVerbatimArguments: true },
    });
    expect(codexExecInvocation("C:\\npm\\codex.CMD", ["debug", "models"], "win32").file.toLowerCase()).toContain("cmd");
    expect(codexExecInvocation("C:\\npm\\codex.bat", ["--version"], "win32").args[0]).toBe("/d");
  });

  test("keeps Windows .exe and bare names as direct spawns", () => {
    expect(codexExecInvocation("C:\\Tools\\codex.exe", ["--version"], "win32")).toEqual({
      file: "C:\\Tools\\codex.exe",
      args: ["--version"],
      options: {},
    });
    expect(codexExecInvocation("codex", ["--version"], "win32", { env: { PATH: "", PATHEXT: ".EXE" } })).toEqual({
      file: "codex",
      args: ["--version"],
      options: {},
    });
  });

  test("does not special-case .cmd on POSIX", () => {
    expect(codexExecInvocation("/usr/local/bin/codex", ["--version"], "darwin")).toEqual({
      file: "/usr/local/bin/codex",
      args: ["--version"],
      options: {},
    });
    expect(codexExecInvocation("/weird/codex.cmd", ["--version"], "linux")).toEqual({
      file: "/weird/codex.cmd",
      args: ["--version"],
      options: {},
    });
  });

  test("rejects non-spawnable Windows launchers before exec", () => {
    expect(isSpawnableCodexCandidate("C:\\Tools\\codex.exe", "win32")).toBe(true);
    expect(isSpawnableCodexCandidate("C:\\Tools\\codex.cmd", "win32")).toBe(true);
    expect(isSpawnableCodexCandidate("C:\\Tools\\codex", "win32")).toBe(false);
    expect(isSpawnableCodexCandidate("/usr/local/bin/codex", "linux")).toBe(true);
  });

  test("escapes cmd metacharacters in Windows batch paths", () => {
    const evil = "C:\\Users\\x&whoami\\codex.cmd";
    const invocation = codexExecInvocation(evil, ["--version"], "win32", {
      env: { ComSpec: "cmd.exe" },
    });
    expect(invocation.file).toBe("cmd.exe");
    expect(invocation.args[3]).toContain("x^&whoami");
    expect(invocation.options.windowsVerbatimArguments).toBe(true);
  });
});
