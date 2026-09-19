import { join } from "node:path";
import { resolveCodexHomeDir } from "./home";
import { readBoundedRegularFile } from "../lib/bounded-file-read";

/** Same bound as the other config.toml readers: it exists to keep the read bounded. */
const MAX_LEGACY_CONFIG_BYTES = 4 * 1024 * 1024;
import { parseTomlDocument } from "./project-config-warnings";
import { redactUserPath } from "../lib/redact";

/**
 * Keys that are valid in model catalog data but not at the top level of the
 * user config. Codex rejects them when strict config parsing is enabled.
 */
const LEGACY_KEYS = ["persistent_instructions"] as const;

export type LegacyCodexConfigKey = (typeof LEGACY_KEYS)[number];

export interface LegacyCodexConfigKeyDiagnostic {
  readonly path: string;
  readonly code: LegacyCodexConfigKey;
  readonly detail: string;
}

export type LegacyCodexConfigKeyDiagnosticsResult =
  | { readonly status: "available"; readonly path: string; readonly diagnostics: readonly LegacyCodexConfigKeyDiagnostic[] }
  | { readonly status: "unavailable"; readonly path: string; readonly reason: "read_failed" | "not_a_file" };

function resolveCodexConfigPath(codexConfigPath?: string): string {
  if (codexConfigPath) return codexConfigPath;
  return join(resolveCodexHomeDir(), "config.toml");
}

export function collectLegacyCodexConfigKeyDiagnostics(
  options: { codexConfigPath?: string } = {},
): LegacyCodexConfigKeyDiagnosticsResult {
  const path = resolveCodexConfigPath(options.codexConfigPath);
  // One open decides all three answers. existsSync, then statSync, then readFileSync resolved
  // the same name three times, and only the last one produced the bytes this function returns.
  const read = readBoundedRegularFile(path, MAX_LEGACY_CONFIG_BYTES);
  if (read.kind === "absent") return { status: "available", path, diagnostics: [] };
  if (read.kind === "refused") {
    return {
      status: "unavailable",
      path,
      reason: read.reason === "not-a-regular-file" ? "not_a_file" : "read_failed",
    };
  }
  const content = read.content;
  const { root } = parseTomlDocument(content);
  const found: LegacyCodexConfigKeyDiagnostic[] = [];
  for (const key of LEGACY_KEYS) {
    if (key in root) {
      found.push({
        path,
        code: key,
        detail: `top-level '${key}' is not a valid Codex config key. `
          + "codex --strict-config rejects the whole file. Remove the key and put durable guidance in AGENTS.md.",
      });
    }
  }
  return { status: "available", path, diagnostics: found };
}

export function formatLegacyCodexConfigKeyDiagnosticsForDoctor(
  result: LegacyCodexConfigKeyDiagnosticsResult,
): string[] {
  const displayPath = redactUserPath(result.path);
  if (result.status === "unavailable") {
    return [`  --     Codex config at ${displayPath} could not be read (${result.reason}); legacy-key check skipped`];
  }
  if (result.diagnostics.length === 0) {
    return ["  ok     no unsupported legacy top-level keys in the Codex config"];
  }
  return result.diagnostics.map(diagnostic => `[WARN] ${redactUserPath(diagnostic.path)}: ${diagnostic.detail}`);
}
