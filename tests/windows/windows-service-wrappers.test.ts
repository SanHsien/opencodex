/**
 * The scheduler-wrapper killer must terminate THIS installation's wrappers and
 * nothing else.
 *
 * Two copies of this logic existed. src/service.ts matched canonical full paths
 * as complete command-line tokens; src/update/job.ts matched the bare filenames
 * with -like '*name*'. On a machine with two OpenCodex homes under one account,
 * a dashboard update for home A could force-terminate home B's wrapper, and any
 * unrelated process whose command line contained either filename matched too.
 *
 * The killer spawns PowerShell and reports nothing, so the generated script is
 * the only observable surface. Asserting that the script merely *contains*
 * IndexOf/before/after would pass for a broken matcher that kept those tokens,
 * so these cases port the rule to JS and run real command lines through it. The
 * port is pinned to the shipped script by `matchRuleMatchesScript` below: if
 * the PowerShell changes shape, that test fails and this file must be revisited.
 */
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { windowsWrapperKillScript } from "../../src/lib/windows-service-wrappers";
import { WINDOWS_STANDALONE_RUNTIME_WAIT_LINES } from "../../src/service/windows-taskxml";
import { repoPath } from "../helpers/repo-root";

const read = (rel: string) => readFileSync(repoPath(rel), "utf8");

const HOME_A = "C:\\Users\\ocx\\.opencodex";
const HOME_B = "C:\\Users\\ocx\\other-home\\.opencodex";
const script = (home: string) => join(home, "opencodex-service.cmd");
const launcher = (home: string) => join(home, "opencodex-service-launcher.vbs");

/**
 * The shipped rule, in JS: find the pattern case-insensitively, then require the
 * characters on both sides to be whitespace or a quote (start/end of the line
 * counts as whitespace). Mirrors the PowerShell at
 * src/lib/windows-service-wrappers.ts.
 */
function killsCommandLine(commandLine: string, patterns: readonly string[]): boolean {
  const boundary = /[\s"']/;
  for (const pattern of patterns) {
    let at = 0;
    while (at < commandLine.length) {
      at = commandLine.toLowerCase().indexOf(pattern.toLowerCase(), at);
      if (at < 0) break;
      const before = at > 0 ? commandLine[at - 1]! : " ";
      const end = at + pattern.length;
      const after = end < commandLine.length ? commandLine[end]! : " ";
      if (boundary.test(before) && boundary.test(after)) return true;
      at += 1;
    }
  }
  return false;
}

const patterns = [script(HOME_A), launcher(HOME_A)];

describe("which command lines the wrapper killer stops", () => {
  test("this installation's own wrappers are killed", () => {
    expect(killsCommandLine(`cmd.exe /c "${script(HOME_A)}"`, patterns)).toBe(true);
    expect(killsCommandLine(`wscript.exe "${launcher(HOME_A)}" //B`, patterns)).toBe(true);
    // Unquoted, as Task Scheduler may present it.
    expect(killsCommandLine(`cmd.exe /c ${script(HOME_A)}`, patterns)).toBe(true);
  });

  test("another OpenCodex home under the same account survives", () => {
    // The defect this replaces: -like '*opencodex-service.cmd*' matched here.
    expect(killsCommandLine(`cmd.exe /c "${script(HOME_B)}"`, patterns)).toBe(false);
    expect(killsCommandLine(`wscript.exe "${launcher(HOME_B)}" //B`, patterns)).toBe(false);
  });

  test("a longer path that merely ends with our path is not a token", () => {
    expect(killsCommandLine(`cmd.exe /c "C:\\backup\\${script(HOME_A)}"`, patterns)).toBe(false);
  });

  test("a path that merely starts with ours is not a token", () => {
    expect(killsCommandLine(`cmd.exe /c "${script(HOME_A)}.bak"`, patterns)).toBe(false);
  });

  test("an unrelated process merely naming the file is not killed", () => {
    expect(killsCommandLine("notepad.exe opencodex-service.cmd", patterns)).toBe(false);
    expect(killsCommandLine('findstr /c:"opencodex-service-launcher.vbs" log.txt', patterns)).toBe(false);
  });

  test("a native WinSW command line is not treated as a scheduler wrapper", () => {
    expect(killsCommandLine('"C:\\pkg\\bun.exe" "C:\\pkg\\src\\cli\\index.ts" start --port 10100', patterns)).toBe(false);
  });

  test("matching is case-insensitive, as Windows paths are", () => {
    expect(killsCommandLine(`cmd.exe /c "${script(HOME_A).toUpperCase()}"`, patterns)).toBe(true);
  });
});

test("a look-alike prefix does not hide the real token behind it", () => {
  // A first occurrence that is only a glued suffix must not end the scan: the
  // genuine wrapper path later in the same command line is still a kill match.
  expect(killsCommandLine("cmd.exe /c " + script(HOME_A) + ".bak ^& " + script(HOME_A), patterns)).toBe(true);
  expect(killsCommandLine("cmd.exe /c " + script(HOME_A) + ".bak", patterns)).toBe(false);
});

describe("the generated script still implements that rule", () => {
  test("matchRuleMatchesScript", () => {
    // Pins the JS port above to the shipped PowerShell. If the script stops
    // using ordinal-insensitive IndexOf plus both boundary checks, the port is
    // no longer a faithful model and the cases above prove nothing.
    const ps = windowsWrapperKillScript(patterns);
    expect(ps).toContain("IndexOf($p, $i, [System.StringComparison]::OrdinalIgnoreCase)");
    expect(ps).toContain("$before = if ($i -gt 0)");
    expect(ps).toContain("$after = if ($end -lt $c.Length)");
    expect(ps).toContain("if ($before -match");
    expect(ps).toContain("-and $after -match");
    expect(ps).not.toContain("-like");
  });

  test("the script carries this home's canonical paths, not bare filenames", () => {
    const ps = windowsWrapperKillScript(patterns);
    expect(ps).toContain(script(HOME_A));
    expect(ps).toContain(launcher(HOME_A));
    expect(ps).not.toContain(script(HOME_B));
    expect(ps).not.toContain("@('opencodex-service.cmd'");
  });

  test("the caller's own process is always excluded", () => {
    expect(windowsWrapperKillScript(patterns)).toContain("$_.ProcessId -eq $PID");
  });

  test("a path containing a quote is escaped, not injected", () => {
    const odd = "C:\\Users\\o'brien\\.opencodex\\opencodex-service.cmd";
    expect(windowsWrapperKillScript([odd])).toContain("C:\\Users\\o''brien\\.opencodex\\opencodex-service.cmd");
  });
});

describe("only the interpreters that run a wrapper are stopped", () => {
  // The PowerShell filters on the image name before the command line, so an editor or any other
  // program that merely shows the wrapper path (notepad, an IDE) is never stopped.
  const imageRule = (ps: string): RegExp => {
    const match = /\$_\.Name -notmatch '([^']+)'/.exec(ps);
    if (!match) throw new Error("the kill script has no image-name filter");
    return new RegExp(match[1]!, "i");
  };
  const killsProcess = (name: string, commandLine: string) =>
    imageRule(windowsWrapperKillScript(patterns)).test(name) && killsCommandLine(commandLine, patterns);

  test("the script names the wrapper hosts wscript, cscript and cmd", () => {
    expect(windowsWrapperKillScript(patterns)).toContain("$_.Name -notmatch '^(wscript|cscript|cmd)\\.exe$'");
  });

  test("notepad or an IDE with the full wrapper path on its command line is not killed", () => {
    expect(killsProcess("notepad.exe", `notepad.exe "${script(HOME_A)}"`)).toBe(false);
    expect(killsProcess("Code.exe", `Code.exe --open "${script(HOME_A)}"`)).toBe(false);
  });

  test("the wrapper hosts holding the wrapper path are still killed, whatever the image case", () => {
    expect(killsProcess("wscript.exe", `wscript.exe /b "${launcher(HOME_A)}"`)).toBe(true);
    expect(killsProcess("cscript.exe", `cscript.exe //nologo "${launcher(HOME_A)}"`)).toBe(true);
    expect(killsProcess("cmd.exe", `cmd.exe /c "${script(HOME_A)}"`)).toBe(true);
    expect(killsProcess("CMD.EXE", `CMD.EXE /c "${script(HOME_A)}"`)).toBe(true);
  });
});

describe("every teardown path ends wrappers through the checked stop (#7771)", () => {
  test("no stop path keeps a private matcher or the best-effort sweep", () => {
    for (const rel of ["src/service/windows-ops.ts", "src/service/orchestration.ts", "src/update/job-windows-restart.ts", "src/update/guarded-runtime-ops.ts"]) {
      const src = read(rel);
      expect(src).not.toContain("killWindowsSchedulerWrappers");
      expect(src).not.toContain("killWindowsServiceWrapperProcesses");
      expect(src).not.toContain("-like ('*' + $p + '*')");
      expect(src).not.toContain("$pats = @('opencodex-service.cmd'");
    }
    // The one matcher is the binding rule; the service stop and the updater reach it through Part A.
    expect(read("src/service/orchestration.ts")).toContain("runWindowsServiceStopPartA(request)");
    expect(read("src/update/guarded-runtime-ops.ts")).toContain("runWindowsServiceStopPartA({ authorize: mutationGate(authorize, \"service\"), allowUnderOwnWrapper: true })");
  });
});


describe("scheduler child exit contract", () => {
  test("zero and failure exits reach the cooldown; only explicit stay-out terminates", async () => {
    const { buildWindowsServiceScript } = await import("../../src/service/windows-taskxml");
    for (const cli of ["C:\\ocx\\cli.ts", null]) {
      const batch = buildWindowsServiceScript({ bun: "C:\\ocx\\bun.exe", bunRuntimeSource: "bundled", cli }, 10100, []);
      const tail = batch.slice(batch.indexOf(' start --port 10100')).split("\r\n").slice(1);
      expect(tail.slice(0, 6)).toEqual([
        'if "%ERRORLEVEL%"=="42" goto stopped',
        '>>"%OCX_SERVICE_LOG%" echo [%DATE% %TIME%] child exited with code %ERRORLEVEL%; restarting in 5s',
        'ping -n 6 127.0.0.1 >nul',
        'goto loop',
        ':stopped',
        'endlocal',
      ]);
      expect(batch).toContain('set "OCX_WINDOWS_WRAPPER_PROTOCOL=1"');
      expect(batch).toContain('set "ERRORLEVEL="');
      expect(batch).toContain('exit /b 0');
    }
  });
});


test("stay-out exit code is opt-in for new wrappers, preserving legacy services", async () => {
  const { serviceStayOutExitCode } = await import("../../src/service/windows-wrapper-exit");
  expect(serviceStayOutExitCode({})).toBe(0);
  expect(serviceStayOutExitCode({ OCX_SERVICE: "1" })).toBe(0);
  expect(serviceStayOutExitCode({ OCX_WINDOWS_WRAPPER_PROTOCOL: "1" })).toBe(0);
  expect(serviceStayOutExitCode({ OCX_SERVICE: "1", OCX_WINDOWS_WRAPPER_PROTOCOL: "1" })).toBe(42);
  expect(serviceStayOutExitCode({ OCX_SERVICE: "1", OCX_WINDOWS_WRAPPER_PROTOCOL: "2" })).toBe(0);
  const cli = read("src/cli/index.ts");
  const branches = [...cli.matchAll(/if \(decision === "service-stay-out"\) \{([\s\S]*?)\n\s*\}/g)];
  expect(branches).toHaveLength(3);
  for (const branch of branches) expect(branch[1]).toContain("serviceStayOutExitCode()");
});

test.skipIf(process.platform !== "win32")("cmd restarts zero/crash exits and stops on explicit stay-out", async () => {
  const { mkdtempSync, writeFileSync, rmSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { spawnSync } = await import("node:child_process");
  const { buildWindowsServiceScript } = await import("../../src/service/windows-taskxml");
  const dir = mkdtempSync(join(tmpdir(), "ocx-wrapper-exit-"));
  try {
    const batch = buildWindowsServiceScript({ bun: "bun.exe", bunRuntimeSource: "bundled", cli: null }, 10100, []);
    const tail = batch.slice(batch.indexOf(' start --port 10100')).split("\r\n").slice(1).join("\r\n").split(":restore_backup")[0];
    for (const code of [0, 1, 42, 43, -1073741510]) {
      const file = join(dir, "exit.cmd");
      // Exercise the generated control flow; replace only the cooldown to keep this fast.
      writeFileSync(file, '@echo off\r\nsetlocal EnableExtensions DisableDelayedExpansion\r\nset "ERRORLEVEL="\r\nset "OCX_SERVICE_LOG=NUL"\r\n'
        + `cmd /d /c exit ${code}\r\n` + tail.replace("ping -n 6 127.0.0.1 >nul", "rem skip cooldown")
        + '\r\n:loop\r\nexit /b 99\r\n');
      const result = spawnSync("cmd.exe", ["/d", "/c", file], { timeout: 5000, env: { ...process.env, ERRORLEVEL: "42" } });
      expect(result.error).toBeUndefined();
      expect(result.status).toBe(code === 42 ? 0 : 99);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

for (const date of ["Wed 09/30/2026", "2026-09-30(수)", "2026/09/30 (水)"]) {
  for (const scenario of ["healthy", "missing bun", "missing cli", "restore bun", "restore cli", "empty backup", "standalone healthy", "standalone missing"] as const) {
    test.skipIf(process.platform !== "win32")(`cmd prelaunch with ${date}: ${scenario}`, async () => {
      const { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } = await import("node:fs");
      const { tmpdir } = await import("node:os");
      const { spawnSync } = await import("node:child_process");
      const { buildWindowsServiceScript } = await import("../../src/service/windows-taskxml");
      const dir = mkdtempSync(join(tmpdir(), "ocx-wrapper-locale-"));
      try {
        // Every path used by recovery is disposable, including the live package.
        const pkg = join(dir, "package (test)!");
        const bun = join(pkg, "bun.cmd");
        const cli = join(pkg, "src", "cli", "index.ts");
        const log = join(dir, "service.log");
        const backup = join(dir, ".ocx-backup-20260930 (test)!", "opencodex");
        // Pad past the real-Bun size gate with lines cmd never reaches after `exit /b`.
        const child = '@echo off\r\necho FAKE-CHILD-STARTED\r\nexit /b 42\r\n' + "rem pad past the real-Bun size gate\r\n".repeat(40_000);
        mkdirSync(join(pkg, "src", "cli"), { recursive: true });
        if (scenario !== "missing bun" && scenario !== "restore bun" && scenario !== "empty backup" && scenario !== "standalone missing") writeFileSync(bun, child);
        if (scenario !== "missing cli" && scenario !== "restore cli") writeFileSync(cli, "fixture");
        if (scenario.startsWith("restore") || scenario === "empty backup") {
          mkdirSync(join(backup, "src", "cli"), { recursive: true });
          if (scenario !== "empty backup") {
            writeFileSync(join(backup, "package.json"), "{}");
            writeFileSync(join(backup, "bun.cmd"), child);
            writeFileSync(join(backup, "src", "cli", "index.ts"), "fixture");
          }
        }
        const batch = buildWindowsServiceScript({ bun, bunRuntimeSource: "bundled", cli: scenario.startsWith("standalone") ? null : cli }, 10100, []);
        // Keep the complete generated loop, prelaunch guards and recovery. Replace
        // environment setup with isolated paths; CALL lets our fake .cmd child
        // return to the wrapper just as the real Bun executable would.
        const body = batch.slice(batch.indexOf(":loop\r\n"))
          .replace(/^"%OCX_BUN%" /m, 'call "%OCX_BUN%" ')
          // The bounded installer wait (up to 120s) is covered by its own tests below; here a
          // missing standalone runtime must still reach exit 3 within the harness timeout.
          .replace(WINDOWS_STANDALONE_RUNTIME_WAIT_LINES[1]!, "rem installer wait skipped");
        const file = join(dir, "wrapper.cmd");
        writeFileSync(file, ["@echo off", "setlocal EnableExtensions DisableDelayedExpansion", 'set "ERRORLEVEL="',
          `set "OCX_BUN=${bun}"`, `set "OCX_CLI=${cli}"`, `set "OCX_PKG_DIR=${pkg}"`,
          `set "OCX_SERVICE_LOG=${log}"`, 'set "OCX_API_TOKEN_FILE=fixture"', body].join("\r\n"));
        const result = spawnSync("cmd.exe", ["/d", "/c", file], {
          timeout: 5000, encoding: "utf8", env: { ...process.env, DATE: date, TIME: "12:16:55.17", ERRORLEVEL: "42" },
        });
        expect(result.error).toBeUndefined();
        const started = scenario === "healthy" || scenario === "standalone healthy" || scenario.startsWith("restore");
        expect(result.status).toBe(started ? 0 : 3);
        const output = existsSync(log) ? readFileSync(log, "utf8") : "";
        expect(output.includes("FAKE-CHILD-STARTED")).toBe(started);
        if (!started) expect(output).toContain(`installation is incomplete: ${scenario === "missing cli" ? "CLI entry" : "bundled Bun"} is missing`);
        if (scenario.startsWith("restore")) {
          expect(output).toContain("restored previous install from transactional-update backup");
          expect(existsSync(join(pkg, "package.json"))).toBe(true);
        }
        if (scenario === "empty backup") expect(output).toContain("no restorable backup found");
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });
  }
}

test.skipIf(process.platform !== "win32")("cmd waits out the npm Bun placeholder instead of executing it", async () => {
  const { mkdtempSync, mkdirSync, writeFileSync, rmSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { spawnSync } = await import("node:child_process");
  const { buildWindowsServiceScript } = await import("../../src/service/windows-taskxml");
  const dir = mkdtempSync(join(tmpdir(), "ocx-wrapper-placeholder-"));
  try {
    const pkg = join(dir, "package");
    const bun = join(pkg, "bun.cmd");
    const cli = join(pkg, "src", "cli", "index.ts");
    const log = join(dir, "service.log");
    mkdirSync(join(pkg, "src", "cli"), { recursive: true });
    writeFileSync(cli, "fixture");
    // An in-place npm install extracts bun/bin/bun.exe as a small placeholder that bun's
    // postinstall replaces later; executing it exits 216 behind a modal 16-bit dialog.
    writeFileSync(bun, "@echo off\r\necho PLACEHOLDER-EXECUTED\r\nexit /b 216\r\n");
    writeFileSync(`${bun}.real`, '@echo off\r\necho FAKE-CHILD-STARTED\r\nexit /b 42\r\n' + "rem pad past the real-Bun size gate\r\n".repeat(40_000));
    const batch = buildWindowsServiceScript({ bun, bunRuntimeSource: "bundled", cli }, 10100, []);
    // The cooldown stands in for the postinstall finishing while the wrapper waits.
    const body = batch.slice(batch.indexOf(":loop\r\n"))
      .replace(/^"%OCX_BUN%" /m, 'call "%OCX_BUN%" ')
      .replaceAll("ping -n 6 127.0.0.1 >nul", 'if exist "%OCX_BUN%.real" move /y "%OCX_BUN%.real" "%OCX_BUN%" >nul');
    const file = join(dir, "wrapper.cmd");
    writeFileSync(file, ["@echo off", "setlocal EnableExtensions DisableDelayedExpansion", 'set "ERRORLEVEL="',
      `set "OCX_BUN=${bun}"`, `set "OCX_CLI=${cli}"`, `set "OCX_PKG_DIR=${pkg}"`,
      `set "OCX_SERVICE_LOG=${log}"`, 'set "OCX_API_TOKEN_FILE=fixture"', body].join("\r\n"));
    const result = spawnSync("cmd.exe", ["/d", "/c", file], { timeout: 10000, encoding: "utf8", env: { ...process.env, ERRORLEVEL: "42" } });
    expect(result.error).toBeUndefined();
    const output = readFileSync(log, "utf8");
    expect(output).not.toContain("PLACEHOLDER-EXECUTED");
    expect(output).toContain("bundled Bun is not ready (");
    expect(output).toContain("FAKE-CHILD-STARTED");
    expect(result.status).toBe(0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test.skipIf(process.platform !== "win32")("cmd waits when Bun disappears between the exist check and the size read", async () => {
  const { mkdtempSync, mkdirSync, writeFileSync, rmSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { spawnSync } = await import("node:child_process");
  const { buildWindowsServiceScript } = await import("../../src/service/windows-taskxml");
  const dir = mkdtempSync(join(tmpdir(), "ocx-wrapper-vanish-"));
  try {
    const pkg = join(dir, "package");
    const bun = join(pkg, "bun.cmd");
    const cli = join(pkg, "src", "cli", "index.ts");
    const log = join(dir, "service.log");
    mkdirSync(join(pkg, "src", "cli"), { recursive: true });
    writeFileSync(cli, "fixture");
    writeFileSync(`${bun}.real`, '@echo off\r\necho FAKE-CHILD-STARTED\r\nexit /b 42\r\n' + "rem pad past the real-Bun size gate\r\n".repeat(40_000));
    const batch = buildWindowsServiceScript({ bun, bunRuntimeSource: "bundled", cli }, 10100, []);
    // Neutralise the Bun exist guards so the size read itself meets the missing file, as it
    // does when npm removes the package between those two lines.
    const body = batch.slice(batch.indexOf(":loop\r\n"))
      .replace('if not exist "%OCX_BUN%" (', "if 1==0 (")
      .replace('if not exist "%OCX_BUN%" goto bun_missing', "rem exist guard removed")
      .replace(/^"%OCX_BUN%" /m, 'call "%OCX_BUN%" ')
      .replaceAll("ping -n 6 127.0.0.1 >nul", 'if exist "%OCX_BUN%.real" move /y "%OCX_BUN%.real" "%OCX_BUN%" >nul');
    const file = join(dir, "wrapper.cmd");
    writeFileSync(file, ["@echo off", "setlocal EnableExtensions DisableDelayedExpansion", 'set "ERRORLEVEL="',
      `set "OCX_BUN=${bun}"`, `set "OCX_CLI=${cli}"`, `set "OCX_PKG_DIR=${pkg}"`,
      `set "OCX_SERVICE_LOG=${log}"`, 'set "OCX_API_TOKEN_FILE=fixture"', body].join("\r\n"));
    const result = spawnSync("cmd.exe", ["/d", "/c", file], { timeout: 10000, encoding: "utf8", env: { ...process.env, ERRORLEVEL: "42" } });
    expect(result.error).toBeUndefined();
    const output = readFileSync(log, "utf8");
    expect(output).toContain("bundled Bun is not ready ( bytes");
    expect(output).toContain("FAKE-CHILD-STARTED");
    expect(result.status).toBe(0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("Bun readiness guard precedes launch and preserves its retry block", async () => {
  const { buildWindowsServiceScript } = await import("../../src/service/windows-taskxml");
  const { REAL_BUN_MIN_BYTES } = await import("../../src/lib/bun-binary-validator.mjs");
  const guard = [
    'set "OCX_BUN_BYTES="',
    'for %%F in ("%OCX_BUN%") do set "OCX_BUN_BYTES=%%~zF"',
    'if not defined OCX_BUN_BYTES goto bun_not_ready',
    `if %OCX_BUN_BYTES% LSS ${REAL_BUN_MIN_BYTES} goto bun_not_ready`,
  ];
  // Render and inspect strings only: no generated command or service is executed.
  for (const cli of ["C:\\ocx\\src\\cli\\index.ts", null]) {
    const lines = buildWindowsServiceScript({ bun: "C:\\ocx\\bun.exe", bunRuntimeSource: "bundled", cli }, 10100, []).split("\r\n");
    const launch = cli
      ? '"%OCX_BUN%" "%OCX_CLI%" start --port 10100 >>"%OCX_SERVICE_LOG%" 2>&1'
      : '"%OCX_BUN%" start --port 10100 >>"%OCX_SERVICE_LOG%" 2>&1';
    const guardAt = lines.indexOf(guard[0]!);
    const launchAt = lines.indexOf(launch);
    expect(guardAt).toBeGreaterThan(0);
    expect(lines.filter(line => line === guard[0])).toHaveLength(1);
    expect(lines.slice(guardAt, guardAt + guard.length)).toEqual(guard);
    expect(launchAt).toBeGreaterThan(guardAt + guard.length - 1);
    const retryAt = lines.indexOf(":bun_not_ready");
    expect(retryAt).toBeGreaterThan(launchAt);
    expect(lines.slice(retryAt, retryAt + 4)).toEqual([
      ':bun_not_ready',
      '>>"%OCX_SERVICE_LOG%" echo [%DATE% %TIME%] bundled Bun is not ready (%OCX_BUN_BYTES% bytes, npm placeholder or mid-install); waiting for its postinstall, retrying in 5s - if this persists, reinstall opencodex with bun scripts allowed',
      'ping -n 6 127.0.0.1 >nul',
      'goto loop',
    ]);
  }
});

test("backup success logging never expands a filesystem-derived backup name", async () => {
  const { buildWindowsServiceScript } = await import("../../src/service/windows-taskxml");
  const batch = buildWindowsServiceScript({ bun: "C:\\ocx\\bun.exe", bunRuntimeSource: "bundled", cli: "C:\\ocx\\src\\cli\\index.ts" }, 10100, []);
  expect(batch).toContain('setlocal EnableExtensions DisableDelayedExpansion');
  expect(batch).not.toContain("OCX_RESTORED_BACKUP");
  expect(batch.split(":backup_restored\r\n")[1]).toBe(
    '>>"%OCX_SERVICE_LOG%" echo [%DATE% %TIME%] restored previous install from transactional-update backup\r\ngoto :eof\r\n',
  );
});

for (const name of [
  ".ocx-backup-999999 & echo OCX_CMD_INJECTION_CONFIRMED & rem",
  ".ocx-backup-999999 (test)! & echo OCX_CMD_INJECTION_CONFIRMED & rem",
]) {
  test.skipIf(process.platform !== "win32")(`cmd restores a backup with metacharacters without executing its name: ${name}`, async () => {
    const { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const { spawnSync } = await import("node:child_process");
    const { buildWindowsServiceScript } = await import("../../src/service/windows-taskxml");
    const dir = mkdtempSync(join(tmpdir(), "ocx-wrapper-backup-name-"));
    try {
      const pkg = join(dir, "opencodex");
      const backup = join(dir, name, "opencodex");
      const log = join(dir, "service.log");
      mkdirSync(backup, { recursive: true });
      writeFileSync(join(backup, "package.json"), '{"fixture":"preserved"}');
      const batch = buildWindowsServiceScript({ bun: join(pkg, "bun.exe"), bunRuntimeSource: "bundled", cli: join(pkg, "src", "cli", "index.ts") }, 10100, []);
      const file = join(dir, "restore.cmd");
      // Run the complete generated recovery subroutine against disposable paths.
      // No restored executable is launched by this harness.
      writeFileSync(file, ["@echo off", "setlocal EnableExtensions DisableDelayedExpansion",
        `set "OCX_PKG_DIR=${pkg}"`, `set "OCX_SERVICE_LOG=${log}"`,
        "call :restore_backup", "exit /b 0", batch.slice(batch.indexOf("\r\n:restore_backup\r\n") + 2),
      ].join("\r\n"));
      const result = spawnSync("cmd.exe", ["/d", "/c", file], {
        timeout: 5000, encoding: "utf8", env: { ...process.env, DATE: "2026-09-30(test)", TIME: "12:16:55.17" },
      });
      expect(result.error).toBeUndefined();
      expect(result.status).toBe(0);
      expect(`${result.stdout}${result.stderr}`).not.toContain("OCX_CMD_INJECTION_CONFIRMED");
      expect(readFileSync(join(pkg, "package.json"), "utf8")).toBe('{"fixture":"preserved"}');
      expect(existsSync(backup)).toBe(false);
      const output = readFileSync(log, "utf8");
      expect(output).toContain("restored previous install from transactional-update backup");
      expect(output).not.toContain("OCX_CMD_INJECTION_CONFIRMED");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
}

/**
 * A console Ctrl-C / Ctrl-Break makes cmd.exe ask "Terminate batch job (Y/N)?" once the child
 * it was running returns, and the answer is read from the wrapper's own stdin. The wrapper's
 * console is hidden (wscript window style 0), so nobody answers: the loop sat there with
 * cmd and wscript alive, no "child exited" line, and the proxy stayed down. Reproduced on a
 * fake wrapper under a hidden console: Ctrl-Break + child exit left cmd blocked until the
 * prompt was answered; with the loop run as `call :main <nul` the prompt reads EOF, which
 * cmd treats as "no", and the loop carried on. The loop must therefore run with stdin
 * detached from the console, and the exit code of that call must still reach the scheduler.
 */
describe("wrapper loop survives a console break without waiting for an answer", () => {
  const GUARD = ["call :ocx_service_main <nul", "exit /b %ERRORLEVEL%", ":ocx_service_main", ":loop"];

  test.each([["source", "C:\\ocx\\src\\cli\\index.ts"], ["standalone", null]] as const)(
    "%s wrapper runs its loop with stdin detached and propagates the loop's exit code",
    async (_name, cli) => {
      const { buildWindowsServiceScript } = await import("../../src/service/windows-taskxml");
      const lines = buildWindowsServiceScript({ bun: "C:\\ocx\\bun.exe", bunRuntimeSource: "bundled", cli }, 10100, []).split("\r\n");
      const at = lines.indexOf(GUARD[0]!);
      expect(at).toBeGreaterThan(0);
      expect(lines.slice(at, at + GUARD.length)).toEqual(GUARD);
      // Only one entry into the loop, so nothing can run the child on the console's stdin.
      expect(lines.filter(line => line === ":loop")).toHaveLength(1);
      expect(lines.filter(line => line.startsWith('"%OCX_BUN%"'))).toHaveLength(1);
      expect(lines.indexOf('if exist "%OCX_API_TOKEN_FILE%" (')).toBeLessThan(at);
    },
  );
});

describe("standalone wrapper waits for an installer to put the runtime back", () => {
  const WAIT = 'for /l %%N in (1,1,24) do if not exist "%OCX_BUN%" ping -n 6 127.0.0.1 >nul';

  test("only the standalone wrapper waits, and the wait precedes the terminal exit 3", async () => {
    const { buildWindowsServiceScript } = await import("../../src/service/windows-taskxml");
    const standalone = buildWindowsServiceScript({ bun: "C:\\ocx\\ocx.exe", bunRuntimeSource: "standalone", cli: null }, 10100, []).split("\r\n");
    const source = buildWindowsServiceScript({ bun: "C:\\ocx\\bun.exe", bunRuntimeSource: "bundled", cli: "C:\\ocx\\src\\cli\\index.ts" }, 10100, []).split("\r\n");
    const waitAt = standalone.indexOf(WAIT);
    expect(waitAt).toBeGreaterThan(standalone.indexOf(":loop"));
    expect(waitAt).toBeLessThan(standalone.indexOf('if not exist "%OCX_BUN%" goto bun_missing'));
    expect(standalone[waitAt - 1]).toContain("runtime is missing; waiting up to 120s");
    // The give-up path is unchanged: still the incomplete-install exit, not a retry loop.
    expect(standalone.slice(standalone.indexOf(":bun_missing"))[2]).toBe("exit /b 3");
    // npm installs keep their immediate transactional-backup restore (#1942).
    expect(source).not.toContain(WAIT);
  });

  /** Run the complete generated wrapper against a fake child; only sleeps and header paths are replaced. */
  async function runStandaloneWrapper(opts: { childPresent: boolean; childExit: number }) {
    const { mkdtempSync, writeFileSync, rmSync, readFileSync: rf, existsSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const { spawnSync } = await import("node:child_process");
    const { buildWindowsServiceScript } = await import("../../src/service/windows-taskxml");
    const dir = mkdtempSync(join(tmpdir(), "ocx-wrapper-installer-"));
    try {
      const bun = join(dir, "ocx.cmd");
      const log = join(dir, "service.log");
      const child = `@echo off\r\necho FAKE-CHILD-STARTED\r\nexit /b ${opts.childExit}\r\n` + "rem pad past the real-Bun size gate\r\n".repeat(40_000);
      writeFileSync(opts.childPresent ? bun : `${bun}.real`, child);
      const batch = buildWindowsServiceScript({ bun, bunRuntimeSource: "standalone", cli: null }, 10100, []);
      const body = batch.split("\r\n")
        .filter(line => !line.startsWith('set "PATH='))
        .map(line => line.startsWith('set "OCX_SERVICE_LOG=') ? `set "OCX_SERVICE_LOG=${log}"`
          : line.startsWith('set "OCX_API_TOKEN_FILE=') ? 'set "OCX_API_TOKEN_FILE=fixture"'
          : line.replace(/^"%OCX_BUN%" /, 'call "%OCX_BUN%" ')
            // The installer finishing is the only thing that ends the wait in this harness.
            .replaceAll("ping -n 6 127.0.0.1 >nul", 'if exist "%OCX_BUN%.real" move /y "%OCX_BUN%.real" "%OCX_BUN%" >nul'))
        .join("\r\n");
      const file = join(dir, "wrapper.cmd");
      writeFileSync(file, body);
      const result = spawnSync("cmd.exe", ["/d", "/c", file], { timeout: 20_000, encoding: "utf8", env: { ...process.env, ERRORLEVEL: "42" } });
      expect(result.error).toBeUndefined();
      return { status: result.status, output: existsSync(log) ? rf(log, "utf8") : "" };
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }

  test.skipIf(process.platform !== "win32")("a runtime that reappears while the wrapper waits is started, and its stay-out exit still ends the loop", async () => {
    const { status, output } = await runStandaloneWrapper({ childPresent: false, childExit: 42 });
    expect(output).toContain("runtime is missing; waiting up to 120s");
    expect(output).toContain("FAKE-CHILD-STARTED");
    expect(output).not.toContain("installation is incomplete");
    expect(status).toBe(0);
  });

  test.skipIf(process.platform !== "win32")("an intentional stop (exit 42) ends the loop through the stdin-detached call", async () => {
    const { status, output } = await runStandaloneWrapper({ childPresent: true, childExit: 42 });
    expect(output).toContain("FAKE-CHILD-STARTED");
    expect(output).not.toContain("child exited with code");
    expect(status).toBe(0);
  });
});
