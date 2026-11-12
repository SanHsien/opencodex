/**
 * Encoder and decoder must agree on PowerShell single-quote doubling. A source that carries curly
 * single quotes must come back byte-identical from the packed-helper decoder, and an interpolated
 * constant that carries any single-quote character must be refused rather than emitted.
 */
import { describe, expect, test } from "bun:test";
import { powerShellSingleQuoted } from "../../src/lib/powershell-quote";
import { windowsScriptHelperSource } from "../../src/link/remote-windows";
import { psLiteral } from "../../src/claude/intercept/picker-trust-windows";

const CURLY_SOURCE = "class A { // it’s ‘x’ ‚y‛ 'q' ''z'' ’’ ‘‘ }";

describe("windowsScriptHelperSource decodes what powerShellSingleQuoted encodes", () => {
  test("ASCII-only source round-trips", () => {
    const source = "class A { // it's 'q' ''z'' }";
    expect(windowsScriptHelperSource(`try{Add-Type ${powerShellSingleQuoted(source)}}catch{Fail}`)).toBe(source);
  });

  test("curly single quotes round-trip unchanged", () => {
    expect(windowsScriptHelperSource(`try{Add-Type ${powerShellSingleQuoted(CURLY_SOURCE)}}catch{Fail}`)).toBe(CURLY_SOURCE);
  });

  test("each curly quote character alone round-trips", () => {
    for (const quote of ["‘", "’", "‚", "‛"]) {
      const source = `a${quote}${quote}b${quote}`;
      expect(windowsScriptHelperSource(`try{Add-Type ${powerShellSingleQuoted(source)}}catch{Fail}`)).toBe(source);
    }
  });
});

describe("psLiteral refuses every single-quote character in an interpolated constant", () => {
  test("accepts a plain value and wraps it in single quotes", () => {
    expect(psLiteral("abc123", "label")).toBe("'abc123'");
  });

  for (const quote of ["'", "‘", "’", "‚", "‛"]) {
    test(`refuses U+${quote.codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0")}`, () => {
      expect(() => psLiteral(`ab${quote}cd`, "label")).toThrow("unsafe label for script literal");
    });
  }
});
