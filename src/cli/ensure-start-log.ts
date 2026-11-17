import { closeSync, existsSync, openSync, readFileSync, statSync, truncateSync, writeSync } from "node:fs";
import { join } from "node:path";

/**
 * Where `ocx ensure` sends the stdout/stderr of the detached `ocx start` it spawns.
 *
 * The child used to run with stdio ignored, so when it exited before becoming healthy the only
 * trace was "Proxy did not become healthy after starting." (4 of 21 ensures on 2026-11-17, cause
 * unknown). Keeping its output, its exit code and the time it lived turns that into evidence.
 */
export const ENSURE_START_LOG_NAME = "ensure-start.log";
export const ENSURE_START_LOG_MAX_BYTES = 256 * 1024;

export interface EnsureStartLog {
  readonly path: string;
  /** File descriptor for the child's stdout/stderr, or "ignore" when the log could not be opened. */
  readonly stdio: number | "ignore";
  /** Close this process's copy once the child holds its own. */
  readonly closeParentHandle: () => void;
}

export function openEnsureStartLog(configDir: string, now: () => Date = () => new Date()): EnsureStartLog {
  const path = join(configDir, ENSURE_START_LOG_NAME);
  try {
    if (existsSync(path) && statSync(path).size > ENSURE_START_LOG_MAX_BYTES) truncateSync(path, 0);
    const fd = openSync(path, "a", 0o600);
    writeSync(fd, `\n[${now().toISOString()}] ensure spawning ocx start (parent pid ${process.pid})\n`);
    let open = true;
    return {
      path,
      stdio: fd,
      closeParentHandle: () => {
        if (!open) return;
        open = false;
        try { closeSync(fd); } catch { /* the child keeps its own handle */ }
      },
    };
  } catch {
    return { path, stdio: "ignore", closeParentHandle: () => {} };
  }
}

/** Last non-empty lines of the log, bounded; empty when it cannot be read. */
export function tailEnsureStartLog(path: string, maxLines = 8): string[] {
  try {
    const text = readFileSync(path, "utf8");
    const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
    return lines.slice(-maxLines).map(line => (line.length > 300 ? `${line.slice(0, 300)}…` : line));
  } catch {
    return [];
  }
}

export interface EnsureStartOutcome {
  readonly childExited: boolean;
  readonly exitCode: number | null;
  readonly signal: string | null;
  readonly livedMs: number | null;
  readonly waitedMs: number;
}

type ExitEmitter = { once(event: "exit", listener: (code: number | null, signal: NodeJS.Signals | null) => void): unknown };

/** Track when and how the spawned child exits, for the readiness wait and the failure report. */
export function watchEnsureStartChild(child: ExitEmitter, logPath: string, spawnedAt: number = Date.now()) {
  let exit: { code: number | null; signal: string | null; at: number } | null = null;
  child.once("exit", (code, signal) => { exit = { code, signal: signal ?? null, at: Date.now() }; });
  return {
    exited: (): boolean => exit !== null,
    report: (): string => {
      const seen = exit as { code: number | null; signal: string | null; at: number } | null;
      return describeEnsureStartFailure({
        childExited: seen !== null,
        exitCode: seen?.code ?? null,
        signal: seen?.signal ?? null,
        livedMs: seen ? seen.at - spawnedAt : null,
        waitedMs: Date.now() - spawnedAt,
      }, logPath, tailEnsureStartLog(logPath));
    },
  };
}

/** One diagnostic block printed after "Proxy did not become healthy after starting." */
export function describeEnsureStartFailure(outcome: EnsureStartOutcome, logPath: string, tail: readonly string[]): string {
  const child = outcome.childExited
    ? `the ocx start child exited (code ${outcome.exitCode ?? "null"}${outcome.signal ? `, signal ${outcome.signal}` : ""}) after ${outcome.livedMs ?? "?"} ms`
    : "the ocx start child was still running";
  const lines = [`   ${child}; ensure waited ${outcome.waitedMs} ms. Child output: ${logPath}`];
  for (const line of tail) lines.push(`   | ${line}`);
  return lines.join("\n");
}
