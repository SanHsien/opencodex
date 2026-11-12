/**
 * PowerShell single-quoted strings end at any of U+0027 ' and the curly forms U+2018 ‘,
 * U+2019 ’, U+201A ‚ and U+201B ‛. Doubling only the ASCII quote lets a value such as
 * `O’Brien` close the literal early, which breaks the script or leaves an injection seam.
 * Every PowerShell literal built in this repo must go through these helpers.
 */
const POWERSHELL_SINGLE_QUOTE_CHARS = /['‘’‚‛]/g;

/** Escape the body of a PowerShell single-quoted string by doubling every single-quote character. */
export function escapePowerShellSingleQuoted(value: string): string {
  return value.replace(POWERSHELL_SINGLE_QUOTE_CHARS, quote => quote + quote);
}

/** A complete PowerShell single-quoted literal for `value`. */
export function powerShellSingleQuoted(value: string): string {
  return `'${escapePowerShellSingleQuoted(value)}'`;
}
