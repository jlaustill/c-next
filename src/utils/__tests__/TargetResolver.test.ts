/**
 * ADR-049 / #1307: one target name, one set of capabilities, for both the
 * per-file codegen question and the whole-program identifier-budget question.
 */
import { describe, it, expect, vi } from "vitest";
import TargetResolver from "../TargetResolver";
import CNextSourceParser from "../../PARSE/2-Parse/CNextSourceParser";
import type * as Parser from "../../PARSE/2-Parse/grammar/CNextParser";

const HOST = TargetResolver.byName("host")!;

describe("TargetResolver", () => {
  describe("byName", () => {
    it.each([
      { name: "teensy41", word_size: 32, ldrex_strex: true },
      { name: "TEENSY41", word_size: 32, ldrex_strex: true },
      { name: "avr", word_size: 8, ldrex_strex: false },
      { name: "cortex-m0", word_size: 32, ldrex_strex: false },
      { name: "cortex-m0+", word_size: 32, ldrex_strex: false },
    ])(
      "resolves $name case-insensitively",
      ({ name, word_size, ldrex_strex }) => {
        const target = TargetResolver.byName(name);
        expect(target?.word_size).toBe(word_size);
        expect(target?.ldrex_strex).toBe(ldrex_strex);
      },
    );

    it.each([
      { name: undefined, why: "no name given" },
      { name: "", why: "empty name" },
      { name: "definitely-not-a-target", why: "unknown name" },
    ])("returns undefined for $why", ({ name }) => {
      expect(TargetResolver.byName(name)).toBeUndefined();
    });

    it("resolves an alias to the very description it names", () => {
      expect(TargetResolver.byName("teensy41")).toBe(
        TargetResolver.byName("cortex-m7"),
      );
    });
  });

  describe("names", () => {
    it("lists every catalog name, aliases included", () => {
      expect(TargetResolver.names()).toEqual(
        expect.arrayContaining(["cortex-m7", "teensy41", "teensy40", "host"]),
      );
    });
  });

  describe("forFile", () => {
    it("takes a known --target over the file's pragma", () => {
      expect(TargetResolver.forFile("teensy41", "cortex-m0").ldrex_strex).toBe(
        true,
      );
    });

    it("takes the file's pragma when no --target is given", () => {
      expect(TargetResolver.forFile(undefined, "avr").word_size).toBe(8);
    });

    it("falls back to host when neither names a target", () => {
      expect(TargetResolver.forFile(undefined, undefined)).toBe(HOST);
    });

    it("warns on an unknown --target and falls back to the pragma", () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      try {
        expect(TargetResolver.forFile("unknown-target", "avr").word_size).toBe(
          8,
        );
        expect(warn).toHaveBeenCalledWith(
          expect.stringContaining("Unknown target 'unknown-target'"),
        );
      } finally {
        warn.mockRestore();
      }
    });
  });

  describe("fromPragma", () => {
    it.each([
      { source: "#pragma target teensy41\n", expected: "teensy41" },
      { source: "#pragma target TEENSY41\n", expected: "teensy41" },
      { source: "#pragma target avr\n", expected: "avr" },
    ])("reads $expected from the directive", ({ source, expected }) => {
      const { tree } = CNextSourceParser.parse(
        `${source}i32 main() { return 0; }`,
      );
      expect(TargetResolver.fromPragma(tree)).toBe(expected);
    });

    it("returns undefined when the file declares no target", () => {
      const { tree } = CNextSourceParser.parse("i32 main() { return 0; }");
      expect(TargetResolver.fromPragma(tree)).toBeUndefined();
    });

    it("looks past a preprocessor directive that is not a pragma", () => {
      const { tree } = CNextSourceParser.parse(
        '#include "other.cnx"\ni32 main() { return 0; }',
      );
      expect(TargetResolver.fromPragma(tree)).toBeUndefined();
    });

    it("degrades to 'no target' on a pragma shape it does not understand", () => {
      // Today `pragmaDirective` can only be PRAGMA_TARGET, whose lexer rule
      // guarantees the shape -- so this is unreachable through the grammar and
      // has to be driven directly. It is the contract that matters: if a later
      // grammar admits a second pragma, this reports "no target declared"
      // rather than throwing on a null match.
      const tree = {
        preprocessorDirective: () => [
          { pragmaDirective: () => null },
          { pragmaDirective: () => ({ getText: () => "#pragma unrelated" }) },
        ],
      } as unknown as Parser.ProgramContext;

      expect(TargetResolver.fromPragma(tree)).toBeUndefined();
    });
  });

  describe("forRun", () => {
    it("lets an explicit --target decide the whole build", () => {
      const target = TargetResolver.forRun("avr", ["teensy41"]);
      expect(target.word_size).toBe(8);
    });

    it("ignores an unknown --target and falls back", () => {
      const target = TargetResolver.forRun("not-a-target", []);
      expect(target).toBe(HOST);
    });

    it("falls back to the default when no file declares a target", () => {
      expect(TargetResolver.forRun(undefined, [])).toBe(HOST);
    });

    it("takes the narrowest budget across the build's files", () => {
      // An identifier pair that collides for the strictest target in the build
      // collides in that build, so the budget must be the smallest one present.
      const narrow = { ...HOST, external_identifier_chars: 6 };
      const stubbed: Record<string, typeof narrow> = { tiny: narrow };
      const original = TargetResolver.byName;
      TargetResolver.byName = (name?: string) =>
        name === undefined ? undefined : (stubbed[name] ?? original(name));

      try {
        const target = TargetResolver.forRun(undefined, ["teensy41", "tiny"]);
        expect(target.external_identifier_chars).toBe(6);
      } finally {
        TargetResolver.byName = original;
      }
    });

    it("skips unknown pragma names rather than widening the budget", () => {
      const target = TargetResolver.forRun(undefined, ["not-a-target"]);
      expect(target).toBe(HOST);
    });
  });
});
