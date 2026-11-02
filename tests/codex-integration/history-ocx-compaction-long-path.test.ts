import { expect, spyOn, test } from "bun:test";
import { Database } from "bun:sqlite";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  recoverOcxCompactionHistory,
} from "../../src/codex/ocx-compaction-history";
import { encodeCompactionSummary, SUMMARY_PREFIX } from "../../src/responses/compaction";
import * as acl from "../../src/lib/windows-secret-acl";
import { removeTreeWithRetry } from "../helpers/remove-tree";

  test.skipIf(process.platform !== "win32")("backs up and repairs rollout and backup paths beyond MAX_PATH", () => {
    const root = mkdtempSync(join(tmpdir(), "ocx-compaction-recovery-"));
    const harden = acl.hardenSecretPath;
    const observed: string[] = [];
    const guard = spyOn(acl, "hardenSecretPath").mockImplementation((path, options) => {
      if (path.length > 260) {
        expect(path.startsWith("\\\\?\\")).toBe(true);
        observed.push(path);
      }
      return harden(path, options);
    });
    try {
      const codexHome = join(root, "codex");
      const rolloutDir = join(codexHome, "sessions", "a".repeat(90), "b".repeat(90));
      const backupRoot = join(root, "backups", "c".repeat(90), "d".repeat(90));
      mkdirSync(rolloutDir, { recursive: true });
      const threadId = "01a018e6-242f-7801-81b8-ffc0a5c6d589";
      const rolloutPath = join(rolloutDir, `rollout-fixture-${threadId}.jsonl`);
      const original = `${JSON.stringify({
        type: "compacted",
        payload: {
          replacement_history: [{
            type: "compaction",
            id: "cmp_fixture",
            encrypted_content: encodeCompactionSummary("recover me"),
          }],
        },
      })}\n`;
      writeFileSync(rolloutPath, original, "utf8");
      const stateDbPath = join(codexHome, "state_5.sqlite");
      const db = new Database(stateDbPath, { create: true });
      db.exec("CREATE TABLE threads (id TEXT PRIMARY KEY, rollout_path TEXT NOT NULL)");
      db.query("INSERT INTO threads (id, rollout_path) VALUES (?, ?)").run(threadId, rolloutPath);
      db.close();

      const result = recoverOcxCompactionHistory({
        threadId,
        codexHome,
        stateDbPath,
        backupRoot,
        now: () => new Date("2026-09-07T00:00:00.000Z"),
      });

      expect(result.replaced).toBe(1);
      expect(observed).toHaveLength(2);
      expect(result.backupPath).not.toBeNull();
      expect(readFileSync(result.backupPath!, "utf8")).toBe(original);
      expect(readFileSync(rolloutPath, "utf8")).toContain(`${SUMMARY_PREFIX}\\nrecover me`);
      expect(readFileSync(rolloutPath, "utf8")).not.toContain("ocx1:");
    } finally {
      guard.mockRestore();
      removeTreeWithRetry(root);
    }
  });
