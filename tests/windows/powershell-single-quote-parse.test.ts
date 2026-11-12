/**
 * Generated PowerShell must survive the real PowerShell tokenizer when a value carries a curly
 * single quote. PowerShell treats U+2018-U+201B as single-quote characters, so an ASCII-only
 * escape lets a path such as O’Brien terminate the literal early. These tests parse the scripts
 * with the PowerShell Parser and never execute them.
 */
import { describe, expect, test } from "bun:test";
import { windowsScheduledTaskStateQuery } from "../../src/service/windows-guarded-manager";
import { windowsWrapperKillScript } from "../../src/lib/windows-service-wrappers";
import { powerShellSingleQuoted } from "../../src/lib/powershell-quote";

const PARSER_SCRIPT = [
  "$tokens = $null; $errors = $null",
  "$ast = [System.Management.Automation.Language.Parser]::ParseInput($env:OCX_PS_UNDER_TEST, [ref]$tokens, [ref]$errors)",
  "$strings = @($ast.FindAll({ param($n) $n -is [System.Management.Automation.Language.StringConstantExpressionAst] }, $true) | ForEach-Object { $_.Value })",
  "$report = [pscustomobject]@{ errors = @($errors | ForEach-Object { $_.Message }); strings = $strings }",
  "[Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes(($report | ConvertTo-Json -Compress -Depth 4)))",
].join("; ");

/** Parse `script` with the PowerShell Parser only (no execution). */
function parsePowerShell(script: string): { errors: string[]; strings: string[] } {
  const result = Bun.spawnSync(["powershell.exe", "-NoProfile", "-NonInteractive", "-Command", PARSER_SCRIPT], {
    env: { ...process.env, OCX_PS_UNDER_TEST: script },
  });
  expect(result.exitCode).toBe(0);
  const json = Buffer.from(result.stdout.toString().trim(), "base64").toString("utf8");
  return JSON.parse(json) as { errors: string[]; strings: string[] };
}

const CURLY_PATH = "C:\\Users\\O\u2019Brien\\.opencodex\\wrapper\u2018a\u2019 \u201Ab\u201B.xml";

describe("powerShellSingleQuoted literal round trip", () => {
  for (const [label, value] of [
    ["ASCII quote", "it's"],
    ["U+2018 left single quotation mark", "a‘b"],
    ["U+2019 right single quotation mark", "O’Brien"],
    ["U+201A single low-9 quotation mark", "x‚y"],
    ["U+201B single high-reversed-9 quotation mark", "x‛y"],
    ["all five quote characters with PowerShell metacharacters", "'‘’‚‛' $h `n \"q\" \\p"],
  ] as const) {
    test.skipIf(process.platform !== "win32")(`parses to the original value: ${label}`, () => {
      const parsed = parsePowerShell(powerShellSingleQuoted(value));
      expect(parsed.errors).toEqual([]);
      expect(parsed.strings).toEqual([value]);
    }, 60_000);
  }
});

describe("generated PowerShell parses when values carry curly single quotes", () => {
  test.skipIf(process.platform !== "win32")("wrapper kill script parses with no errors and keeps the path value", () => {
    const parsed = parsePowerShell(windowsWrapperKillScript([CURLY_PATH]));
    expect(parsed.errors).toEqual([]);
    expect(parsed.strings).toContain(CURLY_PATH);
  }, 60_000);

  test.skipIf(process.platform !== "win32")("scheduled-task state query parses with no errors and keeps the task name", () => {
    const taskName = "OpenCodex O\u2019Brien \u2018task\u2019";
    const parsed = parsePowerShell(windowsScheduledTaskStateQuery(taskName));
    expect(parsed.errors).toEqual([]);
    expect(parsed.strings).toContain(taskName);
  }, 60_000);
});
