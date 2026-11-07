import { copyTable, type Row } from "./copy-table";

/*
 * Copy for the v2 Accounts & limits (Codex Set, Providers) page. Columns: en, zh-TW (this fork keeps only these two locales).
 * Keys render as `accountsV2.<key>`.
 */
const rows = {
  servingNow: ["Serving now", "目前使用"],
  servingPool: ["New sessions start on this account. The pool switches by your rotation strategy.", "新工作階段從此帳號開始，帳號池依輪換策略切換。"],
  servingDirect: ["Direct mode: every request uses the main login.", "直連模式：所有請求都使用主登入。"],
  servingNone: ["No account can take requests right now.", "目前沒有可以接收請求的帳號。"],
  left: ["{pct}% left", "剩餘 {pct}%"],
  quotaUnknown: ["Quota not read yet", "尚未讀取配額"],
  accounts: ["Accounts", "帳號"],
  emptyPoolHint: ["In pool mode, add another ChatGPT account so requests can move to it when one reaches its limit.", "在帳號池模式下，再新增一個 ChatGPT 帳號，某個帳號達到上限時請求就能轉到它上面。"],
  about: ["About: {name}", "說明：{name}"],
  howItWorks: ["How it works", "運作方式"],
  accountSettings: ["Account settings", "帳號設定"],
  mainLogin: ["Main login", "主登入"],
  tabsLabel: ["Codex settings", "Codex 設定"],
  status: ["Status", "狀態"],
  actions: ["Actions", "操作"],
  providersList: ["Providers", "提供者"],
} satisfies Record<string, Row>;

export const accountsV2Copy = copyTable("accountsV2", rows);
