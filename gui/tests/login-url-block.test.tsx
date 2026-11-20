import { afterEach, beforeEach, expect, test } from "bun:test";
import { Window } from "happy-dom";
import { act } from "react";
import type { Root } from "react-dom/client";
import { LanguageProvider } from "../src/i18n/provider";
import { LoginUrlBlock } from "../src/components/login-url-block";
import { COPY_FEEDBACK_MS } from "../src/components/use-copy-feedback";
import { DOM_RENDER_BUDGET_MS } from "../../tests/helpers/test-budget";

/**
 * Contract for the shared OAuth login-URL block. It owns the copy state for
 * all three login surfaces, so it also owns invalidating that state when the
 * URL changes — the add-provider modal keeps this block mounted across a
 * provider switch and would otherwise show "copied" over a foreign URL.
 */

const URL_A = "https://auth.example.test/oauth/authorize?client_id=aaa&state=111";
const URL_B = "https://auth.example.test/oauth/authorize?client_id=bbb&state=222";

const globals = ["document", "window", "navigator", "localStorage", "IS_REACT_ACT_ENVIRONMENT"] as const;
let previous: Record<(typeof globals)[number], unknown>;
let win: Window;
let host: HTMLElement;
let root: Root | null = null;
let clipboardWrites: string[] = [];
let createRoot: typeof import("react-dom/client").createRoot | undefined;
let feedbackClock: { advance(ms: number): Promise<void>; restore(): void } | undefined;

function installClipboard(available: boolean) {
  clipboardWrites = [];
  Object.defineProperty(win.navigator, "clipboard", {
    configurable: true,
    value: available
      ? { writeText: async (text: string) => { clipboardWrites.push(text); } }
      : undefined,
  });
}

beforeEach(async () => {
  previous = Object.fromEntries(globals.map((k) => [k, Reflect.get(globalThis, k)])) as typeof previous;
  win = new Window({ url: "http://localhost/" });
  Object.defineProperty(win.navigator, "language", { configurable: true, value: "en-US" });
  Object.defineProperties(globalThis, {
    document: { configurable: true, value: win.document },
    window: { configurable: true, value: win },
    navigator: { configurable: true, value: win.navigator },
    localStorage: { configurable: true, value: win.localStorage },
  });
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  installClipboard(true);
  host = win.document.createElement("div") as unknown as HTMLElement;
  win.document.body.appendChild(host as never);
  // react-dom/client decides whether it has a DOM when it is first evaluated, so it is loaded
  // here, after the happy-dom globals exist. Loading it inside the first case charged that case
  // for the module graph: 0.4s idle, and up to 10.3s under load against Bun's 5s default.
  createRoot ??= (await import("react-dom/client")).createRoot;
}, DOM_RENDER_BUDGET_MS);

afterEach(async () => {
  feedbackClock?.restore();
  feedbackClock = undefined;
  if (root) {
    const current = root;
    await act(async () => { current.unmount(); });
    root = null;
  }
  for (const key of globals) {
    Object.defineProperty(globalThis, key, { configurable: true, value: previous[key] });
  }
  await win.happyDOM?.close?.();
});

async function render(url: string) {
  await act(async () => {
    root ??= createRoot!(host);
    root.render(
      <LanguageProvider>
        <LoginUrlBlock url={url} />
      </LanguageProvider>,
    );
  });
}

function copyButton(): HTMLButtonElement {
  const button = host.querySelector(".login-url-block-actions button");
  expect(button).toBeTruthy();
  return button as HTMLButtonElement;
}

async function clickCopy() {
  await act(async () => {
    copyButton().dispatchEvent(new win.MouseEvent("click", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 0));
  });
}

test("renders the URL as selectable text and copies it", async () => {
  await render(URL_A);

  expect(host.textContent).toContain(URL_A);

  await clickCopy();

  expect(clipboardWrites).toEqual([URL_A]);
  expect(host.textContent).toContain("Copied");
});

test("reports an unusable clipboard instead of a false success", async () => {
  installClipboard(false);
  await render(URL_A);

  await clickCopy();

  expect(clipboardWrites).toEqual([]);
  expect(host.textContent).toContain("Clipboard unavailable");
});

/**
 * Takes over only the copy-feedback timer, on a clock the test advances. With real
 * timers the check below sat 100ms inside the second click's window, so a loaded
 * machine that ran the 2400ms wait late saw the label already expired (1 of 24 runs
 * with six copies of this file and 48 busy-loop processes). Every other timer,
 * including React's and this file's own zero-delay waits, stays real.
 */
function installFeedbackClock() {
  const realSetTimeout = globalThis.setTimeout;
  const realClearTimeout = globalThis.clearTimeout;
  let now = 0;
  const pending = new Set<{ at: number; run: () => void }>();
  globalThis.setTimeout = ((handler: (...args: unknown[]) => void, delay?: number, ...args: unknown[]) => {
    if (delay !== COPY_FEEDBACK_MS) return realSetTimeout(handler, delay, ...args);
    const timer = { at: now + delay, run: () => handler(...args) };
    pending.add(timer);
    return timer;
  }) as unknown as typeof setTimeout;
  globalThis.clearTimeout = ((handle: unknown) => {
    if (!pending.delete(handle as { at: number; run: () => void })) realClearTimeout(handle as Parameters<typeof clearTimeout>[0]);
  }) as typeof clearTimeout;
  feedbackClock = {
    async advance(ms: number) {
      now += ms;
      for (const timer of [...pending].sort((a, b) => a.at - b.at)) {
        if (timer.at > now || !pending.delete(timer)) continue;
        await act(async () => { timer.run(); });
      }
    },
    restore() {
      globalThis.setTimeout = realSetTimeout;
      globalThis.clearTimeout = realClearTimeout;
    },
  };
  return feedbackClock;
}

test("keeps the latest feedback for its full window across repeated copies", async () => {
  const clock = installFeedbackClock();
  await render(URL_A);

  await clickCopy();
  await clock.advance(200);
  await clickCopy();

  expect(clipboardWrites).toEqual([URL_A, URL_A]);

  // Past the first click's expiry but before the second's: an unguarded timer
  // would already have wiped the second click's label.
  await clock.advance(COPY_FEEDBACK_MS - 100);
  expect(host.textContent).toContain("Copied");

  // The second click's own window still ends.
  await clock.advance(100);
  expect(host.textContent).not.toContain("Copied");
  expect(host.textContent).toContain("Copy link");
});

test("a new URL resets stale copy feedback", async () => {
  await render(URL_A);
  await clickCopy();
  expect(host.textContent).toContain("Copied");

  await render(URL_B);

  expect(host.textContent).toContain(URL_B);
  expect(host.textContent).not.toContain(URL_A);
  expect(host.textContent).not.toContain("Copied");
  expect(host.textContent).toContain("Copy link");
});

test("offers a manual open fallback alongside the copy button", async () => {
  await render(URL_A);

  const anchor = Array.from(host.querySelectorAll("a")).find(
    (el) => el.getAttribute("href") === URL_A,
  );
  expect(anchor).toBeTruthy();
  expect(anchor?.getAttribute("target")).toBe("_blank");
  expect(anchor?.getAttribute("rel")).toBe("noreferrer");
  expect(host.textContent).toContain("Didn't open?");
});

test.each([
  "javascript:alert(document.domain)",
  "file:///etc/passwd",
  "vscode://file/etc/passwd",
  "not a URL",
])("does not make an unsafe authorization URL clickable: %s", async (unsafeUrl) => {
  await render(unsafeUrl);

  expect(host.querySelector(".login-url-block-text")?.textContent).toBe(unsafeUrl);
  expect(host.querySelector(".login-url-block-open")).toBeNull();
  expect(host.textContent).not.toContain("Didn't open?");
});

// The block is shared by three surfaces, so its styles must not read as owned
// by any one of them. Without this the "ownership" claim is unenforceable.
test("carries component-scoped class names, not a host surface's prefix", async () => {
  await render(URL_A);

  expect(host.querySelector(".login-url-block")).toBeTruthy();
  expect(host.querySelector(".login-url-block-text")?.textContent).toBe(URL_A);
  expect(host.querySelector(".login-url-block-actions")).toBeTruthy();
  expect(host.querySelector(".login-url-block-open")).toBeTruthy();
  expect(host.innerHTML).not.toContain("pwi-");
});

test("renders nothing without a URL", async () => {
  await render("");

  expect(host.querySelector(".login-url-block")).toBeNull();
  expect(host.textContent).not.toContain("Copy link");
});
