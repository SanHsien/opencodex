import { describe, expect, test } from "bun:test";
import { isProviderModerationRefusal } from "../../src/combos/failover";

// The refusal-prose matcher is the last gate before a combo hops on a plain-text moderation refusal.
// It is reachable with provider-controlled text, so it must stay linear on near-miss input.
const REPEAT = ", and retry category: a";
const pathological = (suffix: string): string => {
  let text = "refused category: a";
  while (text.length + REPEAT.length + suffix.length <= 1_990) text += REPEAT;
  return text + suffix;
};
const verdict = (message: string): boolean => isProviderModerationRefusal(400, message, "moderation_refusal", true);

describe("moderation refusal prose matcher", () => {
  test("a long near-miss repetition of the category list is rejected in linear time", () => {
    const hostile = pathological("!");
    expect(hostile.length).toBeGreaterThan(1_900);
    const started = performance.now();
    expect(verdict(hostile)).toBe(false);
    // The exponential form needs minutes at this length; the linear one needs well under a millisecond.
    expect(performance.now() - started).toBeLessThan(250);
  });

  test("the same repetition without the poisoned tail is still a known refusal shape", () => {
    expect(verdict(pathological(""))).toBe(true);
  });

  test("category lists with ', and' separators and trailing advice keep matching", () => {
    for (const message of [
      "Content flagged by the moderation. category: hate, violence and sexual. please retry.",
      "refused category: a, and b",
      "refused category: a, and retry",
      "The request was refused by the content filter. categories: x/y_z-w, and v. Please modify your prompt and retry",
    ]) expect(verdict(message)).toBe(true);
  });
});
