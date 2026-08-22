import { afterEach, beforeEach, expect, test } from "bun:test";
import { Window } from "happy-dom";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { LanguageProvider } from "../src/i18n/provider";
import ConsequenceDialog, { type ConsequenceCopy } from "../src/pages/integrations/ConsequenceDialog";

const globals = ["document", "window", "navigator", "localStorage", "IS_REACT_ACT_ENVIRONMENT"] as const;
let previousGlobals: Record<(typeof globals)[number], unknown>;
let testWindow: Window;
let container: HTMLElement;
let root: Root | null = null;

const COPY: ConsequenceCopy = {
  titleKey: "integrations.dialog.grok.title",
  changesKey: "integrations.dialog.grok.changes",
  breakageKey: "integrations.dialog.grok.breakage",
  undoKey: "integrations.dialog.grok.undo",
  confirmKey: "integrations.dialog.grok.confirm",
};

beforeEach(() => {
  previousGlobals = Object.fromEntries(globals.map(key => [key, Reflect.get(globalThis, key)])) as typeof previousGlobals;
  testWindow = new Window({ url: "http://localhost/" });
  // 本 fork 的 GUI 只保留英文與繁體中文（見 docs/fork/DECISIONS.md），韓文語系已移除。
  // 這個測試要驗的是「四個文案槽依序渲染、路徑代入實際值、沒有副作用」，
  // 換成本 fork 仍支援的 zh-TW 就能完整保留那個保證。
  Object.defineProperty(testWindow.navigator, "language", { configurable: true, value: "zh-TW" });
  Object.defineProperties(globalThis, {
    document: { configurable: true, value: testWindow.document },
    window: { configurable: true, value: testWindow },
    navigator: { configurable: true, value: testWindow.navigator },
    localStorage: { configurable: true, value: testWindow.localStorage },
  });
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  container = testWindow.document.createElement("div") as unknown as HTMLElement;
  testWindow.document.body.appendChild(container as never);
});

afterEach(async () => {
  if (root) {
    const current = root;
    await act(async () => { current.unmount(); });
    root = null;
  }
  for (const key of globals) {
    Object.defineProperty(globalThis, key, { configurable: true, value: previousGlobals[key] });
  }
});

async function mount(options: { path?: string; onClose?: () => void; onConfirm?: () => void | Promise<void> } = {}) {
  const path = options.path ?? "/live/home/.grok/config.toml";
  await act(async () => {
    root = createRoot(container);
    root.render(
      <LanguageProvider>
        <ConsequenceDialog
          copy={{ ...COPY, vars: { path } }}
          onClose={options.onClose ?? (() => {})}
          onConfirm={options.onConfirm ?? (() => {})}
        />
      </LanguageProvider>,
    );
  });
  return container.querySelector("dialog")!;
}

test("renders the four Traditional Chinese slots in order with the live path and no side effect", async () => {
  const livePath = "/custom/grok-home/config.toml";
  await mount({ path: livePath });

  const title = container.querySelector("h3")!;
  const paragraphs = [...container.querySelectorAll(".integration-consequence-body > p")];
  expect([title.textContent, ...paragraphs.map(paragraph => paragraph.textContent)]).toEqual([
    "要停用 Grok Build 整合嗎？",
    `只會從 ${livePath} 移除由 opencodex 標記的區塊。區塊之外寫入的內容將保持不變。`,
    "停用後，Grok Build 中的 opencodex 模型別名將消失。透過 xAI 帳號使用的模型不受影響。",
    "如果 opencodex 正在 loopback 位址上執行，重新啟用時會根據目前可用的模型寫入新的區塊。",
  ]);
  expect(container.querySelector(".integration-consequence-body code")?.textContent).toBe(livePath);
  expect(paragraphs).toHaveLength(3);
  expect(container.querySelector(".modal-actions .btn-primary")?.textContent?.trim()).toBe("停用");
});

test("Escape and backdrop dismissal both invoke onClose", async () => {
  let closes = 0;
  const dialog = await mount({ onClose: () => { closes += 1; } });
  const WindowEvent = (testWindow as unknown as { Event: typeof Event }).Event;
  await act(async () => {
    dialog.dispatchEvent(new WindowEvent("cancel", { bubbles: false, cancelable: true }));
  });
  expect(closes).toBe(1);

  await act(async () => { container.querySelector<HTMLButtonElement>(".modal-backdrop-dismiss")!.click(); });
  expect(closes).toBe(2);
});

test("clicking the action invokes onConfirm", async () => {
  let confirms = 0;
  await mount({ onConfirm: () => { confirms += 1; } });
  await act(async () => { container.querySelector<HTMLButtonElement>(".modal-actions .btn-primary")!.click(); });
  expect(confirms).toBe(1);
});
