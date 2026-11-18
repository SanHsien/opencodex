import {
  waitForWindowsServiceMutationIdle,
  type WaitForServiceMutationIdleOptions,
  type WindowsServiceMutationState,
} from "../lib/windows-service-mutation-lock";

/**
 * Longest an autostart waits for an `ocx service` operation to finish. Measured install,
 * stop and uninstall runs took 28-52 s on the maintainer machine (2026-11-16).
 */
export const AUTOSTART_SERVICE_MUTATION_WAIT_MS = 90_000;

export const AUTOSTART_SERVICE_MUTATION_WAITING_NOTICE =
  "⏳ Waiting for an OpenCodex Windows service operation to finish before starting the proxy (up to 90 s)…";

export const AUTOSTART_SERVICE_MUTATION_BUSY_NOTICE =
  "⚠️  An OpenCodex Windows service operation is still in progress; not starting a proxy behind it. Retry when it finishes.";

export interface AutostartServiceGateDeps {
  wait?: (options: Pick<WaitForServiceMutationIdleOptions, "maxWaitMs" | "onBusy">) => Promise<WindowsServiceMutationState>;
  warn?: (message: string) => void;
  /**
   * Cap on the wait, at most AUTOSTART_SERVICE_MUTATION_WAIT_MS. A caller that retries (ocx ensure)
   * passes what is left of its own deadline so the gate does not grant a fresh full wait each time.
   */
  maxWaitMs?: number;
}

/**
 * Whether a client autostart (`ocx codex`, `ocx claude`, ...) may spawn `ocx start` now.
 *
 * `ocx service install/stop/uninstall` hold the Windows service mutation lock for the whole
 * operation (including any UAC prompt). An autostart that spawns a proxy inside that window
 * makes the stop's port check fail ("could not be confirmed free" / "being respawned"), seen
 * 2 of 26 times on 2026-11-16. So wait for the operation to finish, saying so at once; the
 * caller then re-probes, because an install will already have started the service's proxy.
 * "unknown" keeps the previous behaviour.
 */
export async function autostartMaySpawnProxy(deps: AutostartServiceGateDeps = {}): Promise<boolean> {
  const warn = deps.warn ?? (message => console.error(message));
  const wait = deps.wait ?? (options => waitForWindowsServiceMutationIdle(options));
  const state = await wait({
    maxWaitMs: Math.min(AUTOSTART_SERVICE_MUTATION_WAIT_MS, Math.max(0, deps.maxWaitMs ?? AUTOSTART_SERVICE_MUTATION_WAIT_MS)),
    onBusy: () => warn(AUTOSTART_SERVICE_MUTATION_WAITING_NOTICE),
  });
  if (state !== "busy") return true;
  warn(AUTOSTART_SERVICE_MUTATION_BUSY_NOTICE);
  return false;
}
