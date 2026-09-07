import { join } from "node:path";

export type ReactDoctorScope = "changed" | "full";

export function resolveReactDoctorInvocation(
  scope: ReactDoctorScope,
  packageSpec = "react-doctor@0.9.11",
  platform = process.platform,
): { command: string; args: string[] } {
  const args = ["--yes", packageSpec, "--verbose", "--scope", scope];
  if (scope === "changed") args.push("--base", "origin/main");
  args.push("--no-telemetry");
  return { command: platform === "win32" ? "npx.cmd" : "npx", args };
}

if (import.meta.main) {
  const scope = process.argv[2];
  const packageSpec = process.argv[3];
  if ((scope !== "changed" && scope !== "full") || !packageSpec?.startsWith("react-doctor@")) {
    console.error("usage: bun scripts/run-react-doctor.ts <changed|full> react-doctor@<version>");
    process.exit(64);
  }
  const { command, args } = resolveReactDoctorInvocation(scope, packageSpec);
  const result = Bun.spawnSync([command, ...args], {
    cwd: join(import.meta.dir, "..", "gui"),
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  });
  process.exit(result.exitCode ?? 1);
}
