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
  /**
   * The header line this spawn wrote (timestamp and parent pid). Everything after it in the log is
   * this spawn's window; null when the log could not be opened, so there is nothing to attribute.
   */
  readonly header: string | null;
  /** Close this process's copy once the child holds its own. */
  readonly closeParentHandle: () => void;
}

/** Test seam for the three file operations openEnsureStartLog performs on its descriptor. */
export interface EnsureStartLogIo {
  readonly open: (path: string) => number;
  readonly write: (fd: number, text: string) => void;
  readonly close: (fd: number) => void;
}

const defaultLogIo: EnsureStartLogIo = {
  open: path => openSync(path, "a", 0o600),
  write: (fd, text) => { writeSync(fd, text); },
  close: fd => closeSync(fd),
};

export function openEnsureStartLog(
  configDir: string,
  now: () => Date = () => new Date(),
  io: EnsureStartLogIo = defaultLogIo,
): EnsureStartLog {
  const path = join(configDir, ENSURE_START_LOG_NAME);
  let fd: number | null = null;
  try {
    // Accepted race: two ensures that both see the log over the cap both truncate it, so the later
    // truncation can drop the earlier ensure's header. That ensure then shows no child output and
    // does not infer lease contention from the log (readEnsureStartWindow returns null); it still
    // has the lease polling. Redesigning the log for this is not worth it.
    if (existsSync(path) && statSync(path).size > ENSURE_START_LOG_MAX_BYTES) truncateSync(path, 0);
    fd = io.open(path);
    const header = `\n[${now().toISOString()}] ensure spawning ocx start (parent pid ${process.pid})\n`;
    io.write(fd, header);
    const handle = fd;
    let open = true;
    return {
      path,
      stdio: handle,
      header,
      closeParentHandle: () => {
        if (!open) return;
        open = false;
        try { io.close(handle); } catch { /* the child keeps its own handle */ }
      },
    };
  } catch {
    // The open succeeded but a later step threw: nobody else holds this descriptor, so close it.
    if (fd !== null) { try { io.close(fd); } catch { /* nothing more to release */ } }
    return { path, stdio: "ignore", header: null, closeParentHandle: () => {} };
  }
}

/**
 * Spawn the child with the log's descriptor and always release this process's copy, including when
 * spawn itself throws synchronously (bad argv/env), which would otherwise leak the descriptor.
 */
export function spawnWithEnsureStartLog<T>(log: EnsureStartLog, spawnChild: (stdio: number | "ignore") => T): T {
  try {
    return spawnChild(log.stdio);
  } finally {
    log.closeParentHandle();
  }
}

/**
 * The log text from this spawn's header on (header included), or null when it cannot be read or the
 * header is gone. Earlier ensures' output sits before the header and is never part of the window.
 */
export function readEnsureStartWindow(path: string, header: string | null): string | null {
  if (header === null) return null;
  try {
    const text = readFileSync(path, "utf8");
    const at = text.lastIndexOf(header);
    return at < 0 ? null : text.slice(at);
  } catch {
    return null;
  }
}

/**
 * Last non-empty lines of the log, bounded; empty when it cannot be read. With a header (null
 * included), only this spawn's window is considered, so another ensure's error is never shown as ours.
 */
export function tailEnsureStartLog(path: string, maxLines = 8, header?: string | null): string[] {
  try {
    const text = header === undefined ? readFileSync(path, "utf8") : readEnsureStartWindow(path, header);
    if (text === null) return [];
    const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
    return lines.slice(-maxLines).map(line => (line.length > 300 ? `${line.slice(0, 300)}…` : line));
  } catch {
    return [];
  }
}

/** `ocx start` prints this code (Bun's uncaught-error output lists `code`) when it loses the lease. */
export const OWNERSHIP_LEASE_BUSY_CODE = "OWNERSHIP_MUTATION_LEASE_BUSY";

export interface EnsureStartOutcome {
  readonly childExited: boolean;
  readonly exitCode: number | null;
  readonly signal: string | null;
  readonly livedMs: number | null;
  readonly waitedMs: number;
}

type ExitEmitter = {
  readonly pid?: number | undefined;
  once(event: "exit", listener: (code: number | null, signal: NodeJS.Signals | null) => void): unknown;
};

/** The recorded runtime ownership lease holder, or null when the lease is free. */
export type LeaseHolderReader = () => { pid: number | null; alive: boolean | null } | null;

/**
 * Track when and how the spawned child exits, for the readiness wait and the failure report.
 *
 * Contention is detected two ways. Polling the lease file alone misses a winner that holds the lease
 * for less than one poll interval, so once our child has exited its log window is also searched for
 * the lease-busy code, which does not depend on sampling. The window is "from our header to the
 * end", so another ensure's child that failed on the lease meanwhile also counts; that is still a
 * concurrent start, and the wait stays bounded by the readiness ceiling.
 */
export function watchEnsureStartChild(
  child: ExitEmitter,
  logPath: string,
  spawnedAt: number = Date.now(),
  leaseHolder: LeaseHolderReader = () => null,
  logHeader: string | null = null,
) {
  let exit: { code: number | null; signal: string | null; at: number } | null = null;
  let contentionSeen = false;
  let logChecked = false;
  child.once("exit", (code, signal) => { exit = { code, signal: signal ?? null, at: Date.now() }; });
  return {
    exited: (): boolean => exit !== null,
    /** True when another start was seen holding the runtime ownership lease, or beat our child to it. */
    anotherStartHoldsLease: (): boolean => {
      let other = false;
      try {
        const holder = leaseHolder();
        other = holder !== null && holder.alive === true && holder.pid !== null && holder.pid !== child.pid;
      } catch { /* the log below can still show contention */ }
      if (other) contentionSeen = true;
      // Our child wrote its stderr before it exited, so one read after the exit is complete.
      if (!contentionSeen && exit !== null && !logChecked) {
        logChecked = true;
        if (readEnsureStartWindow(logPath, logHeader)?.includes(OWNERSHIP_LEASE_BUSY_CODE)) contentionSeen = true;
      }
      return other || contentionSeen;
    },
    report: (): string => {
      const seen = exit as { code: number | null; signal: string | null; at: number } | null;
      const contention = contentionSeen ? "\n   another ocx start held the runtime ownership lease during the wait" : "";
      return describeEnsureStartFailure({
        childExited: seen !== null,
        exitCode: seen?.code ?? null,
        signal: seen?.signal ?? null,
        livedMs: seen ? seen.at - spawnedAt : null,
        waitedMs: Date.now() - spawnedAt,
      }, logPath, tailEnsureStartLog(logPath, 8, logHeader)) + contention;
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
