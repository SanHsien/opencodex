import { copyTable, type Row } from "./copy-table";

/*
 * Copy for the v2 Startup protection, Remote Link and Remote Workspace pages. Columns: en, zh-TW (this fork keeps only these two locales).
 * Keys render as `startupV2.<key>`.
 */
const rows = {
  // ---- Startup protection
  about: ["About: {name}", "說明：{name}"],
  optionsTitle: ["Keep Codex working after a restart", "重新開機後讓 Codex 繼續可用"],
  optionsHint: ["One healthy option is enough. The background service covers the most ways Codex starts.", "只需一個正常運作的方式。背景服務涵蓋的 Codex 啟動方式最多。"],
  recommended: ["Recommended", "推薦"],
  optional: ["Optional", "選用"],
  shimPlain: ["Start with Codex", "隨 Codex 啟動"],
  recoveryMeta: ["Commands to run yourself", "可自行執行的指令"],
  // ---- Remote Link
  off: ["Off", "關閉"],
  on: ["On", "開啟"],
  linkIntroTitle: ["Use one computer's setup on your other computers", "在其他電腦上使用同一台電腦的設定"],
  linkIntroBody: ["Remote Link connects OpenCodex computers over SSH. The Home shares its providers, and a Child uses them without any setup of its own.", "遠端連線透過 SSH 連接 OpenCodex 電腦。主機分享其提供者，子機無需自行設定即可直接使用。"],
  sshTunnel: ["SSH tunnel", "SSH 通道"],
  stepHost: ["Choose a host", "選擇主機"],
  stepVerify: ["Check the host key", "核對主機金鑰"],
  stepConnect: ["Connect", "連線"],
  steps: ["Steps", "步驟"],
} satisfies Record<string, Row>;

export const startupV2Copy = copyTable("startupV2", rows);
