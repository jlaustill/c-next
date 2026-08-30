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
    it("pads table cells the way the committed documents store them", () => {
      // The shape every generator here emits, and the shape that broke the
      // scope-join gate: it wrote padded cells and then parsed with a regex
      // requiring single spaces, so check failed against write's own output.
      const raw = "| File | Sites |\n| --- | --- |\n| `a/b.ts` | 2 |\n";

      return GeneratedMarkdown.format(raw, "docs/x.md").then((out) => {
        expect(out).toContain("| `a/b.ts` |");
        expect(out.split("\n")[0]).toMatch(/\| File\s+\| Sites \|/);
      });
    });

    it("is idempotent, so a second run produces no diff", async () => {
      // A generator whose output is not a fixed point of the formatter churns
      // its committed file on every run, which makes a diff gate useless.
      const once = await GeneratedMarkdown.format("# T\n\ntext\n", "docs/x.md");
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
