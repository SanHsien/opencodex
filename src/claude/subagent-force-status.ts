import { execFile } from "node:child_process";
import { join } from "node:path";
import { claudeConfigDir } from "./gateway-cache";
import { commandInvocation } from "../lib/win-exec";
import { readBoundedRegularFile } from "../lib/bounded-file-read";

export interface SubagentForceStatus {
  targetValid: boolean;
  version: string | null;
  support: "supported" | "unsupported" | "unknown";
  settingsOverride: boolean;
  settingsReadable: boolean;
}

export function subagentForceSupport(version: string | null): SubagentForceStatus["support"] {
  const match = version?.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) return "unknown";
  const [major, minor, patch] = match.slice(1).map(Number);
  return major! > 2 || (major === 2 && (minor! > 1 || (minor === 1 && patch! >= 257))) ? "supported" : "unsupported";
}

function installedVersion(): Promise<string | null> {
  const invocation = commandInvocation("claude", ["--version"]);
  return new Promise(resolve => {
    execFile(invocation.file, invocation.args, { ...invocation.options, timeout: 1500, maxBuffer: 4096 }, (error, stdout) => {
      resolve(error ? null : /^\s*(\d+\.\d+\.\d+)(?:\s|$)/.exec(String(stdout))?.[1] ?? null);
    });
  });
}

/** Server-local observation only: never returns settings values or modifies settings. */
export async function inspectSubagentForceStatus(
  targetValid: boolean,
  configDir = claudeConfigDir(),
  versionProbe: () => Promise<string | null> = installedVersion,
): Promise<SubagentForceStatus> {
  const version = await versionProbe().catch(() => null);
  let settingsOverride = false;
  let settingsReadable = true;
  try {
    const path = join(configDir, "settings.json");
    const read = readBoundedRegularFile(path, 1_048_576);
    if (read.kind === "absent") return { targetValid, version, support: subagentForceSupport(version), settingsOverride, settingsReadable };
    if (read.kind !== "present") throw new Error("settings unavailable");
    const parsed = JSON.parse(read.content);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("invalid settings");
    const env = parsed.env;
    settingsOverride = !!env && typeof env === "object" && !Array.isArray(env)
      && (Object.hasOwn(env, "CLAUDE_CODE_SUBAGENT_MODEL") || Object.hasOwn(env, "CLAUDE_CODE_SUBAGENT_MODEL_FORCE"));
  } catch (error) {
    settingsReadable = (error as NodeJS.ErrnoException).code === "ENOENT";
  }
  return { targetValid, version, support: subagentForceSupport(version), settingsOverride, settingsReadable };
}
