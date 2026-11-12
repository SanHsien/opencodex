/**
 * Shared termination of surviving Windows scheduler launcher/wrapper processes.
 *
 * `schtasks /end` ends the task instance but often leaves wscript/cmd running the
 * `:loop` batch, which brings the proxy back during a stop, a restart, or
 * post-update reclaim. Both the service teardown path and the update job need
 * that guarantee, and they used to carry a copy each.
 *
 * The copies drifted in both directions, which is why this module exists rather
 * than a second careful implementation: the updater received the #1589 argv
 * cleanup that service.ts missed, and service.ts received the canonical-path
 * scoping the updater missed. One of those gaps could force-terminate a wrapper
 * belonging to a DIFFERENT OpenCodex home.
 *
 * Matching is scoped to the CANONICAL paths of one installation, never a bare
 * filename, and the path must appear as a COMPLETE command-line token
 * (wscript.exe spawns the .vbs as an argument; cmd.exe /c runs the .cmd). A
 * substring match is excluded: an unrelated process whose command line merely
 * contains the filename, and a wrapper under another home whose path ends with
 * the same name, must both survive.
 *
 * The path match alone is not enough: an editor or an IDE showing the wrapper
 * file carries the same token on its command line. So the process must also be
 * one of the images that run a wrapper file (WRAPPER_HOST_IMAGE_NAMES); every
 * other image is left alone whatever its command line says.
 */
import { spawnSync } from "node:child_process";

import { resolveTrustedWindowsPowerShellExe } from "./windows-elevation";
import { powerShellSingleQuoted } from "./powershell-quote";

/**
 * The images that execute a scheduler wrapper file: wscript runs the launcher .vbs,
 * which runs the .cmd through cmd.exe, and cscript is the same host with the console
 * subsystem. Shared by the PowerShell kill and the TypeScript "is this a live wrapper"
 * checks so the two cannot disagree about which rows count.
 */
export const WRAPPER_HOST_IMAGE_NAMES = ["wscript", "cscript", "cmd"] as const;

/** Case-insensitive, whole image name: `cmd.exe` matches; `cmd.exe.bak` and `notepad.exe` do not. */
const WRAPPER_HOST_IMAGE_PATTERN = `^(${WRAPPER_HOST_IMAGE_NAMES.join("|")})\\.exe$`;
const WRAPPER_HOST_IMAGE_RE = new RegExp(WRAPPER_HOST_IMAGE_PATTERN, "i");

/** Whether a process image name is one that can run a scheduler wrapper file. */
export function isWrapperHostImage(name: string | null | undefined): boolean {
  return typeof name === "string" && WRAPPER_HOST_IMAGE_RE.test(name);
}

/**
 * The PowerShell that finds and stops the wrappers for exactly these paths.
 * Exported for tests: the matching rule is the whole point of this module, and
 * the spawn itself is best-effort and unobservable.
 */
export function windowsWrapperKillScript(paths: readonly string[]): string {
  return [
    `$pats = @(${paths.map(powerShellSingleQuoted).join(", ")});`,
    "Get-CimInstance Win32_Process | Where-Object {",
    "  if ($_.ProcessId -eq $PID) { return $false };",
    `  if ($_.Name -notmatch '${WRAPPER_HOST_IMAGE_PATTERN}') { return $false };`,
    "  $c = $_.CommandLine; if (-not $c) { return $false };",
    "  foreach ($p in $pats) {",
    "    $i = 0;",
    "    while ($i -lt $c.Length) {",
    "      $i = $c.IndexOf($p, $i, [System.StringComparison]::OrdinalIgnoreCase);",
    "      if ($i -lt 0) { break };",
    "      $before = if ($i -gt 0) { $c.Substring($i - 1, 1) } else { ' ' };",
    "      $end = $i + $p.Length;",
    "      $after = if ($end -lt $c.Length) { $c.Substring($end, 1) } else { ' ' };",
    "      if ($before -match '[\\s\"'']' -and $after -match '[\\s\"'']') { return $true };",
    "      $i = $i + 1;",
    "    }",
    "  };",
    "  $false",
    "} | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }",
  ].join(" ");
}

/**
 * Best-effort: never throws, never reports. A wrapper that survives is handled
 * by the caller's own stop verification.
 */
export function killWindowsSchedulerWrappers(paths: {
  scriptPath: string;
  launcherPath: string;
}, beforeMutation?: () => void): void {
  if (process.platform !== "win32") return;
  let file: string, args: string[];
  try {
    file = resolveTrustedWindowsPowerShellExe();
    args = ["-NoProfile", "-NoLogo", "-NonInteractive", "-Command",
      windowsWrapperKillScript([paths.scriptPath, paths.launcherPath])];
  } catch { return; }
  beforeMutation?.();
  try {
    // windowsHide avoids Bun's direct -WindowStyle argv failure (#1589).
    spawnSync(file, args, { stdio: "ignore", timeout: 5000, windowsHide: true });
  } catch { /* best-effort */ }
}
