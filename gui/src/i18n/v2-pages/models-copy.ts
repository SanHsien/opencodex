import { copyTable, type Row } from "./copy-table";

/*
 * Copy for the v2 Models page. Columns: en, zh-TW (this fork keeps only these two locales).
 * Keys render as `modelsV2.<key>`.
 */
const rows = {
  // ---- page head: one plain line per tab; the long description sits behind "About" ------
  ledeCatalog: ["Choose which models show up in the Codex model picker.", "選擇 Codex 模型選擇器中顯示哪些模型。"],
  ledeCombos: ["Bundle several models under one id that answers in order.", "把多個模型合併到一個 id 下，依序回應。"],
  about: ["About this page", "關於此頁面"],

  // ---- provider card -----------------------------------------------------------------------
  providerTools: ["Provider settings", "提供者設定"],
  bulkLabel: ["Turn every model on or off", "全部開啟或關閉"],
  modelActions: ["Model actions", "模型操作"],
} satisfies Record<string, Row>;

export const modelsV2Copy = copyTable("modelsV2", rows);
