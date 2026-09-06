import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export interface WindowsPowerShellFixture {
  executable: string;
  cleanup: () => void | Promise<void>;
}

export interface WindowsPowerShellFixtureOptions {
  /** Test seam for cleanup and failed-compiler regression coverage. */
  platform?: NodeJS.Platform;
  compile?: (source: string, executable: string) => Promise<{ ok: boolean; detail: string }>;
  /** Test seam; production keeps the compiler bounded to 30 seconds. */
  compileTimeoutMs?: number;
  onFixtureDirectory?: (dir: string) => void;
}

const FIXTURE_COMPILE_TIMEOUT_MS = 30_000;
const FIXTURE_OUTPUT_LIMIT = 4_000;
const BUN_WINDOWS_COMPILE_COPY_ENOENT = "failed to copy bun executable into temporary file: ENOENT";

class FixtureCompilerUnreapedError extends Error {}

/**
 * Run the fixture the way production runs PowerShell and return what happened.
 *
 * The collector under test swallows an enumeration error into `state: "unknown"`
 * with no processes, so a fixture that cannot execute is indistinguishable from
 * a machine with no Codex process running. That ambiguity is what made the two
 * #1852 cases read as behavioural failures on the Windows leg. Asserting this
 * first turns "the fixture is broken" into its own named, self-describing
 * failure.
 */
export async function probeWindowsPowerShellFixture(
  fixture: WindowsPowerShellFixture,
  timeoutMs = 5_000,
): Promise<{ ok: boolean; detail: string }> {
  try {
    const child = Bun.spawn([fixture.executable, "-NoProfile", "-NoLogo", "-NonInteractive", "-Command", "probe"], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const stdoutPromise = new Response(child.stdout).text();
    const stderrPromise = new Response(child.stderr).text();
    const completed = await Promise.race([
      Promise.all([stdoutPromise, stderrPromise, child.exited])
        .then(([stdout, stderr, exitCode]) => ({ stdout, stderr, exitCode })),
      Bun.sleep(timeoutMs).then(() => null),
    ]);
    if (!completed) {
      try { child.kill(); } catch { /* already exited */ }
      let reaped = await Promise.race([
        child.exited.then(() => true, () => true),
        Bun.sleep(500).then(() => false),
      ]);
      if (!reaped) {
        try { child.kill(9); } catch { /* already exited */ }
        reaped = await Promise.race([
          child.exited.then(() => true, () => true),
          Bun.sleep(500).then(() => false),
        ]);
      }
      void stdoutPromise.catch(() => {});
      void stderrPromise.catch(() => {});
      return { ok: false, detail: `timed out after ${timeoutMs}ms; reaped=${reaped}` };
    }
    const { stdout, stderr, exitCode } = completed;
    if (exitCode === 0 && stdout.includes("codex app-server")) {
      return { ok: true, detail: `exit=0 stdout=${JSON.stringify(stdout)}` };
    }
    return {
      ok: false,
      detail: `exit=${exitCode} stdout=${JSON.stringify(stdout)} stderr=${JSON.stringify(stderr.slice(0, 400))}`,
    };
  } catch (error) {
    return { ok: false, detail: error instanceof Error ? `${error.name}: ${error.message}` : String(error) };
  }
}

/**
 * Build a real Windows executable for tests that exercise the default execFile path.
 *
 * A .cmd file is not a CreateProcess target, so Node/Bun's shell-free execFile rejects
 * it with EINVAL on Windows. The compiled fixture consumes the same PowerShell-shaped
 * argv as production, waits long enough for an interval to run, and emits deterministic
 * rows for both the process and start-time queries. On POSIX, retain the small shell
 * fixture because the production Windows branch is only reached after the platform is
 * explicitly faked by the tests.
 */
export function createWindowsPowerShellFixture(
  options: WindowsPowerShellFixtureOptions = {},
): Promise<WindowsPowerShellFixture> {
  // Each suite owns its fixture. Sharing one directory across suites lets the
  // first cleanup remove the executable while another suite is still using it.
  return (options.platform ?? process.platform) === "win32"
    ? buildWindowsExecutableFixture(options)
    : Promise.resolve(createPosixShellFixture());
}

async function buildWindowsExecutableFixture(
  options: WindowsPowerShellFixtureOptions,
): Promise<WindowsPowerShellFixture> {
  const dir = mkdtempSync(join(tmpdir(), "ocx-ps-fixture-"));
  options.onFixtureDirectory?.(dir);
  const source = join(dir, "fake-powershell.ts");
  const executable = join(dir, "fake-powershell.exe");
  try {
    writeFileSync(source, [
      "const command = process.argv.slice(2).join(' ');",
      "await new Promise(resolve => setTimeout(resolve, 200));",
      "if (command.includes('CreationDate')) {",
      "  process.stdout.write('42\\t1970-01-01T00:00:00.500Z\\n');",
      "} else {",
      "  process.stdout.write('42\\t/usr/local/bin/codex app-server\\tCONTOSO\\\\jun\\n');",
      "}",
    ].join("\n"));

    const compile = options.compile
      ?? ((nextSource: string, nextExecutable: string) => compileWindowsExecutableFixture(
        nextSource,
        nextExecutable,
        options.compileTimeoutMs,
      ));
    const attempts: string[] = [];
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      // compileWindowsExecutableFixture resolves only after its child has exited or been
      // boundedly reaped. A retry therefore never overlaps the first compiler process.
      const result = await compile(source, executable);
      const missing = !existsSync(executable);
      attempts.push(`attempt ${attempt}: ${result.detail}${missing ? "; compiler produced no executable" : ""}`);
      if (result.ok && !missing) {
        return {
          executable,
          cleanup: () => removeFixtureDirectory(dir),
        };
      }
      if (attempt === 1 && !result.ok && result.detail.includes(BUN_WINDOWS_COMPILE_COPY_ENOENT)) {
        // Bun can leave an empty or partial output at --outfile. Do not let a successful
        // fresh compiler mistake it for its own completed executable.
        rmSync(executable, { force: true });
        continue;
      }
      throw new Error(
        `Could not compile Windows PowerShell test fixture: ${result.detail}${missing ? "; compiler produced no executable" : ""}`
        + `; ${attempts.join("; ")}`,
      );
    }
    throw new Error("Could not compile Windows PowerShell test fixture: compiler attempts exhausted");
  } catch (error) {
    if (error instanceof FixtureCompilerUnreapedError) throw error;
    try {
      await removeFixtureDirectory(dir);
    } catch (cleanupError) {
      const compileDetail = error instanceof Error ? error.message : String(error);
      const cleanupDetail = cleanupError instanceof Error ? cleanupError.message : String(cleanupError);
      throw new Error(`${compileDetail}; fixture cleanup also failed: ${cleanupDetail}`);
    }
    throw error;
  }
}

async function compileWindowsExecutableFixture(
  source: string,
  executable: string,
  timeoutMs = FIXTURE_COMPILE_TIMEOUT_MS,
): Promise<{ ok: boolean; detail: string }> {
  try {
    const child = Bun.spawn([
      process.execPath,
      "build",
      source,
      "--compile",
      "--target=bun-windows-x64",
      `--outfile=${executable}`,
    ], { stdout: "pipe", stderr: "pipe" });
    const stdoutPromise = new Response(child.stdout).text();
    const stderrPromise = new Response(child.stderr).text();
    const completed = await Promise.race([
      Promise.all([stdoutPromise, stderrPromise, child.exited]),
      Bun.sleep(timeoutMs).then(() => null),
    ]);
    if (!completed) {
      try { child.kill(); } catch { /* already exited */ }
      let reaped = await Promise.race([
        child.exited.then(() => true, () => true),
        Bun.sleep(500).then(() => false),
      ]);
      if (!reaped) {
        try { child.kill(9); } catch { /* already exited */ }
        reaped = await Promise.race([
          child.exited.then(() => true, () => true),
          Bun.sleep(500).then(() => false),
        ]);
      }
      if (!reaped) {
        throw new FixtureCompilerUnreapedError(
          `Could not compile Windows PowerShell test fixture: timed out after ${timeoutMs}ms; `
          + "reaped=false; refusing fixture cleanup while compiler may still be writing",
        );
      }
      return { ok: false, detail: `timed out after ${timeoutMs}ms; reaped=true` };
    }
    const [stdout, stderr, exitCode] = completed;
    const detail = `${stdout}\n${stderr}`.trim().slice(0, FIXTURE_OUTPUT_LIMIT);
    return { ok: exitCode === 0, detail: `exit=${exitCode}${detail ? ` output=${JSON.stringify(detail)}` : ""}` };
  } catch (error) {
    if (error instanceof FixtureCompilerUnreapedError) throw error;
    return { ok: false, detail: error instanceof Error ? `${error.name}: ${error.message}` : String(error) };
  }
}

function createPosixShellFixture(): WindowsPowerShellFixture {
  const dir = mkdtempSync(join(tmpdir(), "ocx-ps-fixture-"));
  const executable = join(dir, "fake-powershell.sh");
  writeFileSync(executable, [
    "#!/bin/sh",
    "sleep 0.2",
    "case \"$*\" in",
    "  *CreationDate*) printf '42\\t1970-01-01T00:00:00.500Z\\n' ;;",
    "  *) printf '42\\t/usr/local/bin/codex app-server\\tCONTOSO\\\\jun\\n' ;;",
    "esac",
  ].join("\n"), { mode: 0o755 });
  return {
    executable,
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  };
}

async function removeFixtureDirectory(dir: string): Promise<void> {
  // Windows can keep a just-exited compiled child image open for a short interval.
  // Retry the temp cleanup so an antivirus/file-close race does not turn an otherwise
  // passing test file into an unnamed afterAll failure.
  const retryableCodes = new Set(["EBUSY", "EPERM", "EACCES"]);
  let lastError: unknown;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      rmSync(dir, { recursive: true, force: true });
      return;
    } catch (error) {
      const code = error && typeof error === "object" && "code" in error
        ? (error as { code?: unknown }).code
        : undefined;
      if (typeof code !== "string" || !retryableCodes.has(code)) throw error;
      lastError = error;
      await Bun.sleep(50);
    }
  }
  const detail = lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(`Could not remove Windows PowerShell test fixture after 2s: ${detail}`);
}
