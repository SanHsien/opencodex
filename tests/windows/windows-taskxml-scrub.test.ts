/**
 * `taskXmlWithoutCommentsAndCdata` is the scrub six callers run before they read a
 * registered scheduled task: repair.ts checks Triggers, Settings and Priority through
 * it, and windows-taskxml.ts itself checks registration ownership and health through
 * it. Its own comment states the point -- "a commented-out decoy cannot satisfy any
 * check" -- so a comment that survives the scrub is a check passing on XML the
 * operator never wrote.
 *
 * Regex replacement does not hold that line. Removing a span splices its neighbours
 * together, so a decoy reconstitutes a comment that was not there before the pass ran,
 * and repeating the pass only moves the problem one layer along. CodeQL flagged this as
 * js/incomplete-multi-character-sanitization. The scrub is a left-to-right scan instead,
 * and refuses outright on any input whose surviving spans still form an opener; these
 * are the cases that make the difference observable rather than theoretical.
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
    // A parser ends the comment at the first `-->`, so this input settles at
    // `<Task> --></Task>`. That is the correct outcome: a stray `-->` is text, and
    // taskXmlSection reads elements. The property that matters is that nothing which
    // was inside a comment comes back out of it.
    const scrubbed = taskXmlWithoutCommentsAndCdata("<Task><!--<!--<Triggers><LogonTrigger/></Triggers>--> --></Task>");
    expect(scrubbed).not.toContain("<Triggers>");
    expect(scrubbed).not.toContain("<LogonTrigger/>");
  });

  test("a decoy that only forms once the CDATA between its halves is dropped is refused", () => {
    // `<!-` + `-<Triggers/>-` + `->` is not a comment until the CDATA between the halves
    // is deleted. Removing it would hand the caller a Triggers element that the source
    // had commented out, so the scrub returns nothing instead of a repaired string.
    expect(taskXmlWithoutCommentsAndCdata("<Task><!-<![CDATA[x]]>-<Triggers/>-<![CDATA[y]]>-></Task>")).toBe("");
  });

  test("an unterminated opener swallows the rest of the document", () => {
    // Everything after `<!--` is inside the comment as far as a parser is concerned, so
    // no element behind it may be read as if the operator had registered it.
    expect(taskXmlWithoutCommentsAndCdata("<Task><!-- <Triggers><LogonTrigger/></Triggers></Task>")).toBe("<Task>");
  });

  test("CDATA hidden inside a comment does not resurface", () => {
    expect(taskXmlWithoutCommentsAndCdata("<Task><!-- <![CDATA[<Triggers/>]]> --></Task>"))
      .toBe("<Task></Task>");
  });

  test("XML with neither construct is returned unchanged", () => {
    const xml = "<Task><Triggers><LogonTrigger/></Triggers></Task>";
    expect(taskXmlWithoutCommentsAndCdata(xml)).toBe(xml);
  });

  test("a deeply nested input is linear, not a slow path", () => {
    // 500 openers against 500 closers is the shape that made the replacement loop
    // quadratic. One left-to-right scan visits each character a bounded number of times.
    const start = Date.now();
    const result = taskXmlWithoutCommentsAndCdata(`${"<!--".repeat(500)}x${"-->".repeat(500)}`);
    expect(typeof result).toBe("string");
    expect(Date.now() - start).toBeLessThan(5_000);
  });
});
