import { copyTable, type Row } from "./copy-table";

/*
 * Copy for the v2 Subagents page. Columns: en, zh-TW (this fork keeps only these two locales).
 * Keys render as `subagentsV2.<key>`.
 */
const rows = {
  lede: ["Choose the models Codex and Claude Code hand work to.", "選擇 Codex 和 Claude Code 分派工作時使用的模型。"],
  nowTitle: ["In effect now", "目前生效"],
  nowOrder: ["Codex picker, first choice", "Codex 推薦首選"],
  nowOrderNone: ["Not set, catalog order", "未設定，依目錄順序"],
  nowOrderCaption: ["{n} of {max} picked", "已選 {n}/{max}"],
  firstNoneCaption: ["Codex picks on its own", "由 Codex 自行選擇"],
  nowPin: ["Claude Code pin", "Claude Code 固定模型"],
  pinOffCaption: ["Each agent keeps its own model", "各代理沿用自己的模型"],
  pinOnCaption: ["Every Claude Code subagent", "所有 Claude Code 子代理"],
  off: ["Off", "關閉"],
  change: ["Change", "變更"],
  moreAbout: ["More about {label}", "關於{label}"],
  forceLede: ["When on, every Claude Code subagent runs on the one model you pick.", "開啟後，所有 Claude Code 子代理都使用你選的這一個模型。"],
  budgetLede: ["Per-task caps that stop a runaway task from flooding your providers.", "每個任務的上限，防止失控的任務沖垮提供者。"],
  unsaved: ["Unsaved changes", "有未儲存的變更"],
  noChanges: ["No unsaved changes", "沒有未儲存的變更"],
  featuredLede: ["Codex offers these first, top to bottom. Changes save on their own.", "Codex 會從上到下優先提供這些模型。變更會自動儲存。"],
  emptySlot: ["Empty slot", "空位"],
  modelsLede: ["Add up to {max} models to the picker order.", "最多可將 {max} 個模型加入推薦順序。"],
  rank: ["No. {n}", "第 {n} 位"],
  add: ["Add", "新增"],
  added: ["Added", "已新增"],
  delegationTitle: ["Codex delegation", "Codex 委派"],
  delegationShort: ["Codex calls this model first when it splits work.", "Codex 拆分工作時最先呼叫這個模型。"],
  syncShort: ["Also write it to Codex's config, so new tasks start with it.", "同時寫入 Codex 設定，新任務也從這個模型開始。"],
  guidanceShort: ["Send Codex a short note on how to split work.", "給 Codex 附上一則如何拆分工作的簡短說明。"],
  ultraShort: ["Have every model delegate proactively.", "讓每個模型都主動委派工作。"],
  surfaceShort: ["Which multi-agent surface each model uses.", "每個模型使用哪種多代理介面。"],
  advancedHint: ["Surface, split-work note, proactive delegation", "介面、拆分說明、主動委派"],
} satisfies Record<string, Row>;

export const subagentsV2Copy = copyTable("subagentsV2", rows);
