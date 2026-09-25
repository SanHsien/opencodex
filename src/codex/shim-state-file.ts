import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getConfigDir } from "../config";
import { recordOwnedConfigPath } from "../lib/config-ownership";
import { readBoundedRegularFile } from "../lib/bounded-file-read";

export const CODEX_SHIM_STATE_MAX_BYTES = 1024 * 1024;

interface ShimState {
  platform: NodeJS.Platform;
  wrapperPath: string;
  originalPath: string;
  backupPath: string;
  wrappers?: ShimFileState[];
}

interface ShimFileState {
  wrapperPath: string;
  originalPath: string;
  backupPath: string;
  realPath?: string;
  preserveOnly?: boolean;
}

interface ShimStateReadResult {
  state: ShimState | null;
  present: boolean;
  warning?: string;
}

function fileErrorCode(error: unknown): string | undefined {
  return error && typeof error === "object" && "code" in error
    ? String((error as { code?: unknown }).code)
    : undefined;
}

/**
 * The shim state's own wording over the shared bounded read.
 *
 * The open-then-fstat-then-verify body this used to hold now lives in
 * `lib/bounded-file-read`; only the operator-facing sentences are shim-state business.
 */
function readShimStateFile(path: string, maxBytes: number): { bytes: Buffer; content: string } | { warning: string } | null {
  const result = readBoundedRegularFile(path, maxBytes);
  switch (result.kind) {
    case "absent":
      return null;
    case "present":
      return { bytes: result.bytes, content: result.content };
    case "refused":
      switch (result.reason) {
        case "not-a-regular-file":
          return { warning: `Codex shim state is not a direct regular file at ${path}; auto-restore skipped.` };
        case "too-large":
          return { warning: `Codex shim state exceeds the 1 MiB startup limit at ${path}; auto-restore skipped.` };
        case "changed-while-reading":
          return { warning: `Codex shim state changed while being read at ${path}; auto-restore skipped.` };
        case "unreadable":
          return { warning: `Codex shim state could not be inspected at ${path}.` };
      }
  }
}

function readStateResult(path = statePath()): ShimStateReadResult {
  const bounded = readShimStateFile(path, CODEX_SHIM_STATE_MAX_BYTES);
  if (!bounded) return { state: null, present: false };
  if ("warning" in bounded) return { state: null, present: true, warning: bounded.warning };
  try {
    const value = JSON.parse(bounded.content) as unknown;
    if (!value || typeof value !== "object") return { state: null, present: true };
    const state = value as Record<string, unknown>;
    if (typeof state.platform !== "string") return { state: null, present: true };
    const validFile = (item: unknown): item is ShimFileState => {
      if (!item || typeof item !== "object") return false;
      const file = item as Record<string, unknown>;
      return typeof file.wrapperPath === "string"
        && typeof file.originalPath === "string"
        && typeof file.backupPath === "string"
        && (file.realPath === undefined || typeof file.realPath === "string")
        && (file.preserveOnly === undefined || typeof file.preserveOnly === "boolean");
    };
    if (state.wrappers !== undefined) {
      if (!Array.isArray(state.wrappers) || state.wrappers.length === 0 || !state.wrappers.every(validFile)) return { state: null, present: true };
    } else if (!validFile(state)) {
      return { state: null, present: true };
    }
    return { state: state as unknown as ShimState, present: true };
  } catch {
    return { state: null, present: true };
  }
}

function readState(): ShimState | null {
  return readStateResult().state;
}

function statePath(): string {
  return join(getConfigDir(), "codex-shim.json");
}

function writeState(state: ShimState): void {
  const path = statePath();
  recordOwnedConfigPath(getConfigDir(), path);
  if (!existsSync(getConfigDir())) mkdirSync(getConfigDir(), { recursive: true });
  writeFileSync(path, JSON.stringify(state, null, 2) + "\n", "utf8");
}

function stateFiles(state: ShimState): ShimFileState[] {
  return state.wrappers?.length
    ? state.wrappers
    : [{ wrapperPath: state.wrapperPath, originalPath: state.originalPath, backupPath: state.backupPath }];
}

export type { ShimState, ShimFileState };
export { fileErrorCode, readStateResult, readState, statePath, writeState, stateFiles };
