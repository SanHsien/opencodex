import { copyTable, type Row } from "./copy-table";

/*
 * Copy for the v2 Connect (integrations, Claude, API keys) and the Set up hub pages. Columns: en, zh-TW (this fork keeps only these two locales).
 * Keys render as `connectV2.<key>`.
 */
const rows = {
  moreAbout: ["More about {label}", "關於{label}的更多資訊"],
  subtitle: ["Turn an app on and its requests go through opencodex. Before changing an app's settings, opencodex keeps a backup of them.", "開啟某個應用程式後，它的請求會經過 opencodex。修改應用程式設定前，opencodex 會先保留一份備份。"],
  elsewhereTitle: ["Not on this computer ({count})", "此電腦上未安裝（{count}）"],
  elsewhereHint: ["Install one and it moves up to your apps.", "安裝後會移到上方的應用程式清單中。"],
  setupEssentials: ["The essentials", "必做事項"],
  setupOptional: ["When you need them", "需要時再設定"],
} satisfies Record<string, Row>;

export const connectV2Copy = copyTable("connectV2", rows);
