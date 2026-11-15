import { afterEach, expect, spyOn, test } from "bun:test";
import * as childProcess from "node:child_process";
import { execFileSync } from "node:child_process";
import { installWinswService } from "../../src/lib/winsw";
import { readFileSync } from "node:fs";
import { fixturePath, repoPath } from "../helpers/repo-root";
import { WINDOWS_PROCESS_SNAPSHOT_SCRIPT, windowsProcessSnapshot } from "../../src/service/windows-process-evidence";
import { setWindowsProcessNativeForTests } from "../../src/service/windows-process-native";

const legacy = readFileSync(fixturePath("windows-process-snapshot-cp950.bin"));
const json = new TextDecoder("big5", { fatal: true }).decode(legacy);
const commandLine = JSON.parse(json)[0].CommandLine as string;
afterEach(() => setWindowsProcessNativeForTests(undefined));

test("CP950 Chinese command-line bytes remain unreadable rather than authorizing a stop", async () => {
  setWindowsProcessNativeForTests(null);
  // 功 ends in byte 0x5c in CP950: UTF-8 decoding invents an unescaped JSON backslash.
  expect(commandLine).toContain("功.cmd");
  expect(await windowsProcessSnapshot({ timeoutMs: 1000, run: async () => legacy.toString("utf8") })).toBeNull();
});

test.skipIf(process.platform !== "win32")("snapshot forces UTF-8 before PowerShell 5.1 emits a Chinese command line on a CP950 console", async () => {
  setWindowsProcessNativeForTests(null);
  const encodedFixture = Buffer.from(json).toString("base64");
  const rows = await windowsProcessSnapshot({ timeoutMs: 10000, run: async command => {
    // Only fixture objects: this helper never enumerates or stops real processes.
    const script = `$ProgressPreference='SilentlyContinue'; [Console]::OutputEncoding=[Text.Encoding]::GetEncoding(950); function Get-CimInstance { $items=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${encodedFixture}')) | ConvertFrom-Json; foreach ($item in $items) { $item } }; `
      + command.args[command.args.indexOf("-Command") + 1];
    return execFileSync("C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe", [
      "-NoProfile", "-NonInteractive", "-EncodedCommand", Buffer.from(script, "utf16le").toString("base64"),
    ], { encoding: "utf8", timeout: 10000, windowsHide: true });
  } });
  expect(rows?.[0]?.commandLine).toBe(commandLine);
});

test("snapshot declares UTF-8 at the producer before querying CIM", () => {
  expect(WINDOWS_PROCESS_SNAPSHOT_SCRIPT).toMatch(/^\[Console\]::OutputEncoding = \[Text.Encoding\]::UTF8; /);
});

// These producers return paths or command lines, so the bytes must match their UTF-8 consumers.
test.each([
  ["src/service/windows-guarded-manager.ts", '"[Console]::OutputEncoding = [Text.Encoding]::UTF8; " + command'],
  ["src/service/windows-checked-stop-live.ts", '"[Console]::OutputEncoding = [Text.Encoding]::UTF8; (Get-ScheduledTask'],
  ["src/config/process-state.ts", '`[Console]::OutputEncoding = [Text.Encoding]::UTF8; (Get-CimInstance'],
  ["src/codex/app-server-processes.ts", '"[Console]::OutputEncoding = [Text.Encoding]::UTF8; $ErrorActionPreference'],
  ["src/codex/desktop-app/windows.ts", '"[Console]::OutputEncoding = [Text.Encoding]::UTF8; $ErrorActionPreference'],
  ["src/codex/desktop-compatibility/installed-build.ts", '"[Console]::OutputEncoding = [Text.Encoding]::UTF8; $ErrorActionPreference'],
])("%s pins Unicode stdout to UTF-8 before the query", (file, producer) => {
  expect(readFileSync(repoPath(file), "utf8")).toContain(producer);
});

test("CP950 WinSW account names do not trigger a false install rollback", async () => {
  const qc = Buffer.concat([Buffer.from("SERVICE_START_NAME : DESKTOP\\"), Buffer.from([0xa5, 0x5c]), Buffer.from("\r\n")]);
  const originalUser = process.env.USERNAME;
  const options = new Intl.DateTimeFormat().resolvedOptions();
  const locale = spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions").mockReturnValue({ ...options, locale: "zh-TW" });
  // All process execution is mocked; installer mutations are injected no-ops.
  const command = spyOn(childProcess, "execFileSync").mockImplementation((...args: unknown[]) => {
    expect(args[1]).toEqual(["qc", "opencodex-proxy-native"]);
    return (args[2] as { encoding?: string }).encoding === "buffer" ? qc : qc.toString("utf8");
  });
  process.env.USERNAME = "功";
  try {
    await installWinswService({ bun: "C:\\fixture\\ocx.exe", bunRuntimeSource: "standalone", cli: null }, {
      ensureBinary: async () => "C:\\fixture\\winsw.exe", writeXml: () => {},
      interactive: () => {}, run: () => "", status: () => "nonexistent",
    });
    expect(command).toHaveBeenCalledTimes(1);
  } finally {
    command.mockRestore(); locale.mockRestore();
    if (originalUser === undefined) delete process.env.USERNAME;
    else process.env.USERNAME = originalUser;
  }
});
