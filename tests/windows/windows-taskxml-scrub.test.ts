/**
 * `taskXmlWithoutCommentsAndCdata` is the scrub six callers run before they read a
 * registered scheduled task: repair.ts checks Triggers, Settings and Priority through
 * it, and windows-taskxml.ts itself checks registration ownership and health through
 * it. Its own comment states the point -- "a commented-out decoy cannot satisfy any
 * check" -- so a comment that survives the scrub is a check passing on XML the
 * operator never wrote.
 *
 * A single pass does not hold that line. Removing a span splices its neighbours
 * together, so a nested comment reconstitutes one that was not there before the
 * pass ran. CodeQL flagged this as js/incomplete-multi-character-sanitization; these
 * are the inputs that make the difference observable rather than theoretical.
 */
import { describe, expect, test } from "bun:test";
import { taskXmlWithoutCommentsAndCdata } from "../../src/service/windows-taskxml";

describe("task XML comment and CDATA scrub", () => {
  test("a plain comment is removed", () => {
    expect(taskXmlWithoutCommentsAndCdata("<Task><!-- note --><Triggers/></Task>"))
      .toBe("<Task><Triggers/></Task>");
  });

  test("a plain CDATA section is removed", () => {
    expect(taskXmlWithoutCommentsAndCdata("<Task><![CDATA[<Triggers/>]]></Task>"))
      .toBe("<Task></Task>");
  });

  test("a nested comment yields no element, even though a bare delimiter remains", () => {
    // The non-greedy match runs from the first `<!--` to the first `-->`, so this input
    // settles at `<Task> --></Task>` and stays there. That is the correct outcome and not
    // what the loop is for: a stray `-->` is text, and taskXmlSection reads elements. The
    // property that matters is that nothing which was inside a comment comes back as one.
    const scrubbed = taskXmlWithoutCommentsAndCdata("<Task><!--<!--<Triggers><LogonTrigger/></Triggers>--> --></Task>");
    expect(scrubbed).not.toContain("<Triggers>");
    expect(scrubbed).not.toContain("<LogonTrigger/>");
  });

  test("a decoy that only forms after the first pass is still removed", () => {
    // `<!-` + `-<Triggers/>-` + `->` is not a comment until the inner span between them
    // is deleted. A single-pass scrub hands the caller a Triggers element that was
    // commented out in the source.
    const scrubbed = taskXmlWithoutCommentsAndCdata("<Task><!-<![CDATA[x]]>-<Triggers/>-<![CDATA[y]]>-></Task>");
    expect(scrubbed).not.toContain("<!-");
    expect(scrubbed).not.toContain("->");
  });

  test("CDATA hidden inside a comment does not resurface", () => {
    expect(taskXmlWithoutCommentsAndCdata("<Task><!-- <![CDATA[<Triggers/>]]> --></Task>"))
      .toBe("<Task></Task>");
  });

  test("XML with neither construct is returned unchanged", () => {
    const xml = "<Task><Triggers><LogonTrigger/></Triggers></Task>";
    expect(taskXmlWithoutCommentsAndCdata(xml)).toBe(xml);
  });

  test("the pass cap bounds a pathological input instead of hanging", () => {
    // Deeply nested openers shrink by one layer per pass. The function must return
    // rather than loop, even when the cap stops it before the string is fully clean.
    const start = Date.now();
    const result = taskXmlWithoutCommentsAndCdata(`${"<!--".repeat(500)}x${"-->".repeat(500)}`);
    expect(typeof result).toBe("string");
    expect(Date.now() - start).toBeLessThan(5_000);
  });
});
