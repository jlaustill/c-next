/**
 * The shared rule for generated Markdown: Prettier-formatted before it is
 * written AND before it is compared.
 *
 * Four generators each carried their own copy of this. The rule is one decision,
 * so a generator falling out of step would emit a document that could never match
 * its own check -- CI red with nothing wrong in the document itself.
 */

import { describe, it, expect, vi, afterEach } from "vitest";

import GeneratedMarkdown from "../utils/GeneratedMarkdown";

describe("GeneratedMarkdown", () => {
  describe("format", () => {
    // Both assertions below must be impossible to satisfy with the INPUT, or the
    // test passes when format() stops calling Prettier at all. The first version
    // of these did exactly that: `toContain("| `a/b.ts` |")` found a string the
    // raw table already had, and `/\| File\s+\|/` matched its single space. A
    // mutation replacing the whole body with `return markdown` left them green.
    const RAW = "| File | Sites |\n| --- | --- |\n| `a/b.ts` | 2 |\n";

    it("aligns every column, which the input does not", async () => {
      const out = await GeneratedMarkdown.format(RAW, "docs/x.md");
      const rows = out.trim().split("\n");
      const secondPipe = rows.map((row) => row.indexOf("|", 1));

      // Prettier pads each cell to its column width, so the pipes line up. In
      // RAW they sit at three different offsets.
      expect(new Set(secondPipe).size).toBe(1);
      expect(
        new Set(
          RAW.trim()
            .split("\n")
            .map((r) => r.indexOf("|", 1)),
        ).size,
      ).toBeGreaterThan(1);
    });

    it("is a fixed point, and does change unformatted input", async () => {
      // Idempotence alone cannot catch an identity function -- it is trivially
      // idempotent. Asserting the FIRST pass changes something is what makes the
      // second assertion mean anything.
      const once = await GeneratedMarkdown.format(RAW, "docs/x.md");
      expect(once).not.toBe(RAW);

      const twice = await GeneratedMarkdown.format(once, "docs/x.md");
      expect(twice).toBe(once);
    });
  });

  describe("parseMode", () => {
    it.each([
      ["write", "write"],
      ["check", "check"],
    ])("accepts %s", (argument, expected) => {
      expect(GeneratedMarkdown.parseMode(argument)).toBe(expected);
    });

    it("defaults to check when no mode is given", () => {
      // CI runs the bare command. Defaulting to write would let an unqualified
      // invocation silently rewrite the document it is supposed to be checking,
      // which is a gate that can never fail.
      expect(GeneratedMarkdown.parseMode(undefined)).toBe("check");
    });

    it.each([["writes"], ["Check"], [""], ["--write"]])(
      "rejects %s",
      (argument) => {
        expect(GeneratedMarkdown.parseMode(argument)).toBeNull();
      },
    );
  });

  describe("requireMode", () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it.each([
      ["write", "write"],
      ["check", "check"],
      [undefined, "check"],
    ])("returns %s as %s without exiting", (argument, expected) => {
      const exit = vi.spyOn(process, "exit").mockImplementation((() => {
        throw new Error("process.exit called");
      }) as never);

      expect(GeneratedMarkdown.requireMode(argument)).toBe(expected);
      expect(exit).not.toHaveBeenCalled();
    });

    it("names the bad argument and exits 1", () => {
      // The message has to quote what was actually typed. An earlier version
      // reported the DEFAULTED value, so `npm run x -- bogus` said
      // "Unknown mode 'check'", which is both wrong and unactionable.
      const errors: unknown[] = [];
      vi.spyOn(console, "error").mockImplementation((...args) => {
        errors.push(args[0]);
      });
      const exit = vi.spyOn(process, "exit").mockImplementation((() => {
        throw new Error("process.exit called");
      }) as never);

      expect(() => GeneratedMarkdown.requireMode("bogus")).toThrow(
        "process.exit called",
      );
      expect(exit).toHaveBeenCalledWith(1);
      expect(String(errors[0])).toContain("bogus");
    });
  });
});
