/**
 * ADR-049 / #1307: one target name, one set of capabilities, for both the
 * per-file codegen question and the whole-program identifier-budget question.
 */
import { describe, it, expect } from "vitest";
import TargetResolver from "../TargetResolver";
import CNextSourceParser from "../../transpiler/logic/parser/CNextSourceParser";
import type * as Parser from "../../transpiler/logic/parser/grammar/CNextParser";
import DEFAULT_TARGET from "../../transpiler/constants/DEFAULT_TARGET";

describe("TargetResolver", () => {
  describe("byName", () => {
    it.each([
      { name: "teensy41", wordSize: 32, hasLdrexStrex: true },
      { name: "TEENSY41", wordSize: 32, hasLdrexStrex: true },
      { name: "avr", wordSize: 8, hasLdrexStrex: false },
      { name: "cortex-m0", wordSize: 32, hasLdrexStrex: false },
    ])(
      "resolves $name case-insensitively",
      ({ name, wordSize, hasLdrexStrex }) => {
        const target = TargetResolver.byName(name);
        expect(target?.wordSize).toBe(wordSize);
        expect(target?.hasLdrexStrex).toBe(hasLdrexStrex);
      },
    );

    it.each([
      { name: undefined, why: "no name given" },
      { name: "", why: "empty name" },
      { name: "definitely-not-a-target", why: "unknown name" },
    ])("returns undefined for $why", ({ name }) => {
      expect(TargetResolver.byName(name)).toBeUndefined();
    });

    it("gives every known target an identifier budget", () => {
      // The map spreads DEFAULT_TARGET, so a target cannot silently omit a
      // budget field and leave the Rule 5.1 check reading undefined.
      for (const name of ["teensy41", "teensy40", "cortex-m0+", "avr"]) {
        const target = TargetResolver.byName(name);
        expect(target?.significantExternalIdentifierChars).toBe(31);
        expect(target?.significantInternalIdentifierChars).toBe(63);
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
      expect(target.wordSize).toBe(8);
    });

    it("ignores an unknown --target and falls back", () => {
      const target = TargetResolver.forRun("not-a-target", []);
      expect(target).toEqual(DEFAULT_TARGET);
    });

    it("falls back to the default when no file declares a target", () => {
      expect(TargetResolver.forRun(undefined, [])).toEqual(DEFAULT_TARGET);
    });

    it("takes the narrowest budget across the build's files", () => {
      // An identifier pair that collides for the strictest target in the build
      // collides in that build, so the budget must be the smallest one present.
      const narrow = {
        ...DEFAULT_TARGET,
        significantExternalIdentifierChars: 6,
      };
      const stubbed: Record<string, typeof narrow> = { tiny: narrow };
      const original = TargetResolver.byName;
      TargetResolver.byName = (name?: string) =>
        name === undefined ? undefined : (stubbed[name] ?? original(name));

      try {
        const target = TargetResolver.forRun(undefined, ["teensy41", "tiny"]);
        expect(target.significantExternalIdentifierChars).toBe(6);
      } finally {
        TargetResolver.byName = original;
      }
    });

    it("skips unknown pragma names rather than widening the budget", () => {
      const target = TargetResolver.forRun(undefined, ["not-a-target"]);
      expect(target).toEqual(DEFAULT_TARGET);
    });
  });
});
