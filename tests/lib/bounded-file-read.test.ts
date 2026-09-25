/**
 * `readBoundedRegularFile` replaced `statSync(path)` + `readFileSync(path)` at a dozen call
 * sites that read local state: the service API token, the client's catalog and hub cache, the
 * Remote Workspace stores, the Codex shim state and two config readers. CodeQL flagged the old
 * shape as js/file-system-race, and the reason it matters is narrow but real: the type and size
 * the stat reports describe whatever the NAME pointed at, and the read resolves the name again.
 *
 * These cases pin the properties the call sites depend on. The identity re-check cannot be
 * driven from a single-threaded test without a race, so what is asserted here is the refusal
 * surface -- absent, symlink, over-limit, not-a-file -- plus that a plain read is byte-exact.
 */
import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import * as fs from "node:fs";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readBoundedRegularFile, readBoundedRegularFileText } from "../../src/lib/bounded-file-read";

let dir = "";

beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "ocx-bounded-")); });
afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

describe("readBoundedRegularFile", () => {
  test("a regular file within the limit comes back byte-exact", () => {
    const path = join(dir, "state.json");
    const body = `{"a":1}\n`;
    writeFileSync(path, body);
    const read = readBoundedRegularFile(path, 1024);
    expect(read.kind).toBe("present");
    if (read.kind !== "present") return;
    expect(read.content).toBe(body);
    expect(read.bytes.equals(Buffer.from(body))).toBe(true);
    expect(read.stat.isFile()).toBe(true);
  });

  test("a file the exact size of the limit is allowed, one byte more is not", () => {
    const path = join(dir, "edge");
    writeFileSync(path, "x".repeat(64));
    expect(readBoundedRegularFile(path, 64).kind).toBe("present");
    expect(readBoundedRegularFile(path, 63)).toEqual({ kind: "refused", reason: "too-large" });
  });

  test("a missing file is absent, not a refusal", () => {
    // The call sites rely on this split: absent means "nothing configured yet" and is a normal
    // outcome, while a refusal means something is wrong and several of them throw on it.
    expect(readBoundedRegularFile(join(dir, "nope"), 1024)).toEqual({ kind: "absent" });
  });

  test("a directory is refused rather than read", () => {
    const path = join(dir, "adirectory");
    mkdirSync(path);
    expect(readBoundedRegularFile(path, 1024)).toEqual({ kind: "refused", reason: "not-a-regular-file" });
  });

  test("a symlink is refused even when its target is a small regular file", () => {
    // The whole point of the helper. Following the link would report the TARGET's type and size
    // through fstat, so the bound would describe a file the caller never named.
    const target = join(dir, "target");
    const link = join(dir, "link");
    writeFileSync(target, "secret\n");
    try {
      symlinkSync(target, link);
    } catch {
      return; // Windows without developer mode refuses to create the link; nothing to assert.
    }
    expect(readBoundedRegularFile(link, 1024)).toEqual({ kind: "refused", reason: "not-a-regular-file" });
  });

  test("the text helper collapses every refusal to null", () => {
    const path = join(dir, "big");
    writeFileSync(path, "x".repeat(128));
    expect(readBoundedRegularFileText(path, 128)).toBe("x".repeat(128));
    expect(readBoundedRegularFileText(path, 127)).toBeNull();
    expect(readBoundedRegularFileText(join(dir, "nope"), 1024)).toBeNull();
  });

  test("an open that fails keeps its errno code so a transient lock stays recognisable", () => {
    // A scanner holding the file on Windows surfaces as EBUSY/EACCES on the open. Callers that
    // used to retry on those codes (the Codex history manifest) need the code, not a bare refusal.
    const path = join(dir, "locked.json");
    writeFileSync(path, "{}");
    const open = spyOn(fs, "openSync").mockImplementation(() => {
      throw Object.assign(new Error("EBUSY: resource busy or locked"), { code: "EBUSY" });
    });
    try {
      expect(readBoundedRegularFile(path, 1024)).toEqual({ kind: "refused", reason: "unreadable", code: "EBUSY" });
    } finally {
      open.mockRestore();
    }
  });
});
