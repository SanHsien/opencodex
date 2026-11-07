import { beforeAll, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { helperPath, repoRoot } from "../helpers/repo-root";
import { COLD_SPAWN_BUDGET_MS } from "../helpers/test-budget";
import { continuationLanes, continuationTails, continuationExpected } from "../helpers/messages-sse-continuation-cases";
const DEADLINE_MS = 2500;
// Fork: the 2500 ms deadline bounds delivery of the later ping and EOF, not the first Bun child's
// cold start. On Windows the first child in a process pays the cold module-graph load and overran
// the deadline (the first case of this file failed alone). Run one throwaway child under the
// shared cold-spawn budget so every measured case below starts warm.
beforeAll(async () => {
  const home = mkdtempSync(join(tmpdir(), "ocx-sse-continuation-warm-"));
  try {
    mkdirSync(join(home, "ocx")); mkdirSync(join(home, "codex"));
    const child = Bun.spawn([process.execPath, helperPath("messages-sse-continuation-run.ts"), continuationLanes[0]!, continuationTails[0]![0], join(home, "warm.json")], { cwd: repoRoot(), env: { ...process.env, OPENCODEX_HOME: join(home, "ocx"), CODEX_HOME: join(home, "codex") }, stdout: "pipe", stderr: "pipe" });
    const timer = setTimeout(() => child.kill(), COLD_SPAWN_BUDGET_MS);
    try { await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]); } finally { clearTimeout(timer); }
  } finally { rmSync(home, { recursive: true, force: true }); }
}, COLD_SPAWN_BUDGET_MS + 5_000);
for (const lane of continuationLanes) for (const tail of continuationTails) test(`${lane}: split error delimiter resumes ${tail[0]} and EOF`, async () => {
  const home = mkdtempSync(join(tmpdir(), "ocx-sse-continuation-"));
  try {
    mkdirSync(join(home, "ocx")); mkdirSync(join(home, "codex"));
    const output = join(home, "result.json");
    const child = Bun.spawn([process.execPath, helperPath("messages-sse-continuation-run.ts"), lane, tail[0], output], { cwd: repoRoot(), env: { ...process.env, OPENCODEX_HOME: join(home, "ocx"), CODEX_HOME: join(home, "codex") }, stdout: "pipe", stderr: "pipe" });
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; child.kill(); }, DEADLINE_MS);
    try {
      const [exit, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()]);
      if (timedOut) throw new Error(`The client did not receive the later ${tail[0]} and EOF within ${DEADLINE_MS}ms`);
      if (exit !== 0) throw new Error(`Split-CRLF fixture exited ${exit}\n${stdout}\n${stderr}`);
      const result = JSON.parse(readFileSync(output, "utf8"));
      const bytes = Buffer.from(result.body, "base64");
      expect(bytes.length).toBeGreaterThan(0);
      expect(bytes.toString()).toContain(tail[1]);
      expect(bytes).toEqual(Buffer.from(continuationExpected(lane, tail)));
      expect(result.readTurn).toBe(lane === "native" || lane === "builtin" ? 5 : 4);
      expect(result.status).toBe(lane === "count-tokens" ? 201 : 200);
      expect(result.sends).toBe(1);
      expect(result.sawEof).toBe(true);
    } finally { clearTimeout(timer); }
  } finally { rmSync(home, { recursive: true, force: true }); }
});
