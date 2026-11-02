import { mkdtempSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { removeTreeWithRetry } from "./remove-tree";

/** Windows file symlinks need Developer Mode or elevation. Other errors must fail the suite. */
export const canFileSymlink = (() => {
  const root = mkdtempSync(join(tmpdir(), "ocx-file-symlink-probe-"));
  try {
    symlinkSync(join(root, "target"), join(root, "link"), "file");
    return true;
  } catch (error) {
    if (process.platform === "win32" && (error as NodeJS.ErrnoException).code === "EPERM") return false;
    throw error;
  } finally { removeTreeWithRetry(root); }
})();
