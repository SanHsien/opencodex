[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $repoRoot

function Invoke-BunStep {
    param(
        [Parameter(Mandatory)]
        [string]$Label,
        [Parameter(Mandatory)]
        [string[]]$Arguments
    )

    Write-Host "==> $Label"
    & bun @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "$Label failed with exit code $LASTEXITCODE"
    }
}

if (-not (Get-Command bun -ErrorAction SilentlyContinue)) {
    throw "bun is not on PATH. Install from https://bun.sh and re-run."
}

$lockfile = Join-Path $repoRoot "bun.lock"
$modules = Join-Path $repoRoot "node_modules"
if (-not (Test-Path -LiteralPath $modules) -or -not (Test-Path -LiteralPath $lockfile)) {
    Invoke-BunStep -Label "Install dependencies" -Arguments @("install", "--frozen-lockfile")
}

Invoke-BunStep -Label "Fork hygiene tests" -Arguments @(
    "test", "tests/fork-hygiene.test.ts"
)
Invoke-BunStep -Label "Check fork Markdown links" -Arguments @(
    "tools/check-links.ts"
)

Write-Host "WINDOWS DEV CHECK GREEN"
