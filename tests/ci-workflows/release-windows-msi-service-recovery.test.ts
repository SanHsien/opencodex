import { expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { repoPath } from "../helpers/repo-root";

const config = JSON.parse(readFileSync(repoPath("desktop/src-tauri/tauri.conf.json"), "utf8"));
test("fork MSI links the service recovery fragment instead of disabling Restart Manager", () => {
  expect(config.bundle.windows.wix.fragmentPaths).toContain("wix/service-recovery.wxs");
  expect(config.bundle.windows.wix.componentGroupRefs).toContain("OcxServiceRecovery");
  const workflow = readFileSync(repoPath(".github/workflows/fork-release-windows.yml"), "utf8");
  expect(workflow).toContain('--config "$RUNNER_TEMP/opencodex-msi.json"');
  expect(workflow).not.toContain("MSIRESTARTMANAGERCONTROL");
});

test("quiet MSI upgrades resume only an existing enabled root task after successful file replacement without elevation", () => {
  const fragment = readFileSync(repoPath("desktop/src-tauri/wix/service-recovery.wxs"), "utf8");
  expect(fragment).toContain('<ComponentGroup Id="OcxServiceRecovery"');
  expect(fragment).toContain('After="InstallFinalize"');
  expect(fragment).toContain('WIX_UPGRADE_DETECTED AND NOT (REMOVE~="ALL")');
  expect(fragment).toContain('Execute="immediate"');
  expect(fragment).toContain('Impersonate="yes"');
  expect(fragment).toContain('Return="ignore"');
  expect(fragment).toContain("Get-ScheduledTask -TaskName 'opencodex-proxy' -TaskPath '\\'");
  expect(fragment).toContain("$null -ne $task");
  expect(fragment).toContain("$task.State -ne 'Disabled'");
  expect(fragment).toContain("$task.State -ne 'Running'");
  expect(fragment).toContain("$task | Start-ScheduledTask -ErrorAction Stop");
  expect(fragment).not.toMatch(/Register-ScheduledTask|RunLevel|RunAs|MSIRESTARTMANAGERCONTROL|UILevel/);
});

test("the recovery action only references directories Tauri's WiX template defines (light fails on an unresolved Directory)", () => {
  // v2.100.5's release build failed in light.exe: Directory="SystemFolder" has no entry in
  // Tauri's main.wxs, which only defines TARGETDIR. Formatted [System64Folder] is a standard
  // property and needs no Directory row; it is also what Tauri's own template uses.
  const fragment = readFileSync(repoPath("desktop/src-tauri/wix/service-recovery.wxs"), "utf8");
  const dirs = [...fragment.matchAll(/\bDirectory="([^"]+)"/g)].map(m => m[1]);
  expect(dirs).toEqual(["TARGETDIR"]);
  expect(fragment).toContain("[System64Folder]WindowsPowerShell\\v1.0\\powershell.exe");
});

test.skipIf(process.platform !== "win32")("MSI recovery does not start missing, disabled, or already running tasks", () => {
  const fragment = readFileSync(repoPath("desktop/src-tauri/wix/service-recovery.wxs"), "utf8");
  const command = /ExeCommand="([^"]+)"/.exec(fragment)![1]!.replace(/&quot;/g, '"');
  const script = command.slice(command.indexOf('-Command "') + 10, -1);
  for (const state of ["missing", "Disabled", "Running", "Ready"]) {
    // Overrides both cmdlets: no query or mutation reaches the real Task Scheduler.
    const setup = `$ProgressPreference='SilentlyContinue'; function Get-ScheduledTask { param($TaskName,$TaskPath,$ErrorAction); if ($TaskName -ne 'opencodex-proxy' -or $TaskPath -ne '\\') { throw 'wrong task' }; `
      + (state === "missing" ? "" : `[pscustomobject]@{State='${state}'}`)
      + ` }; function Start-ScheduledTask { param([Parameter(ValueFromPipeline=$true)]$InputObject); process { 'RESUMED' } }; `;
    const stdout = execFileSync("C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe", [
      "-NoProfile", "-NonInteractive", "-EncodedCommand", Buffer.from(setup + script, "utf16le").toString("base64"),
    ], { encoding: "utf8", timeout: 10000, windowsHide: true });
    expect(stdout.trim()).toBe(state === "Ready" ? "RESUMED" : "");
  }
});
