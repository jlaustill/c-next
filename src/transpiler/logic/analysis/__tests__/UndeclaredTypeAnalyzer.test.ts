/**
 * Unit tests for UndeclaredTypeAnalyzer.
 *
 * Issue #1312 (E0426): a type name that denotes nothing this file can see.
 * Issue #1336 (E0429): a name that denotes a REGISTER, which is not a type.
 *
 * The integration fixtures in `tests/bugs/issue-1336-register-in-type-position`
 * assert the diagnostic end to end, but they cannot reach every branch here: a
 * `test-error` fixture stops the analyzer pipeline at the first analyzer that
 * returns errors, and no fixture can construct the "no symbol view" state at all.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { CharStream, CommonTokenStream } from "antlr4ng";
import { CNextLexer } from "../../parser/grammar/CNextLexer";
import { CNextParser } from "../../parser/grammar/CNextParser";
import CNextResolver from "../../../../PARSE/3-Declare/cnext/index";
import TSymbolInfoAdapter from "../../../../PARSE/3-Declare/cnext/adapters/TSymbolInfoAdapter";
import SymbolRegistry from "../../../state/SymbolRegistry";
import CodeGenState from "../../../state/CodeGenState";
import UndeclaredTypeAnalyzer from "../UndeclaredTypeAnalyzer";

function parse(source: string) {
  const charStream = CharStream.fromString(source);
  const lexer = new CNextLexer(charStream);
  const tokenStream = new CommonTokenStream(lexer);
  const parser = new CNextParser(tokenStream);
  return parser.program();
}

/**
 * Analyze with real resolved symbols, so the `known*` sets come from the same
 * source the transpiler uses rather than a hand-built mock that could drift
 * from it -- which is the disagreement #1336 was.
 */
function analyze(source: string) {
  const tree = parse(source);
  CodeGenState.symbols = TSymbolInfoAdapter.convert(
    CNextResolver.resolve(tree, "test.cnx").symbols,
  );
  // Defaults to `true`, and `reset()` restores it to `true` -- the analyzer
  // declines unless the transpiler knows the file's whole name universe, so the
  // fail-safe direction is silence. These sources include nothing.
  CodeGenState.currentFileReachesForeignHeader = false;
  return new UndeclaredTypeAnalyzer().analyze(tree);
}

const REGISTER = `register Control @ 0x40000000 { DR: u32 rw @ 0x00, }`;

describe("UndeclaredTypeAnalyzer", () => {
  beforeEach(() => {
    SymbolRegistry.reset();
  });

  afterEach(() => {
    CodeGenState.reset();
  });

  describe("a register in a type position (E0429, #1336)", () => {
    it("rejects it, and names it a register rather than undefined", () => {
      const errors = analyze(`
        ${REGISTER}
        u32 main() {
            Control c;
            return 0;
        }
      `);
      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0429");
      expect(errors[0].message).toBe("'Control' is a register, not a type");
    });

    it("reports the use site, not the declaration", () => {
      const errors = analyze(
        `${REGISTER}\nu32 main() {\n    Control c;\n    return 0;\n}`,
      );
      expect(errors[0].line).toBe(3);
      expect(errors[0].column).toBe(4);
    });

    it("finds a scope-declared register through its qualified spelling", () => {
      // ADR-057: inside `Board` the bare `Control` is recorded as
      // `Board__Control`, so this exercises the qualified branch rather than
      // the bare one.
      const errors = analyze(`
        scope Board {
            public register Control @ 0x40000000 { DR: u32 rw @ 0x00, }
            public void go() {
                Control c;
            }
        }
      `);
      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0429");
      expect(errors[0].typeName).toBe("Control");
    });
  });

  describe("a name that denotes nothing (E0426, #1312)", () => {
    it("rejects it as undefined, not as a register", () => {
      const errors = analyze(`
        u32 main() {
            Nowhere c;
            return 0;
        }
      `);
      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0426");
      expect(errors[0].message).toBe("type 'Nowhere' is not defined");
    });

    it("reports every undefined type in one walk, not just the first", () => {
      // Why the `Point` control in the integration fixture is live: a second
      // wrongly-rejected type would show up as a second error.
      const errors = analyze(`
        u32 main() {
            Nowhere a;
            Elsewhere b;
            return 0;
        }
      `);
      expect(errors.map((e) => e.typeName)).toEqual(["Nowhere", "Elsewhere"]);
    });
  });

  describe("names that must stay silent", () => {
    it("accepts a struct declared in the file", () => {
      expect(
        analyze(
          `struct Point { u32 x; }\nu32 main() { Point p <- { x: 1 }; return p.x; }`,
        ),
      ).toHaveLength(0);
    });

    it("accepts an enum declared in the file", () => {
      expect(
        analyze(
          `enum EColor { RED, GREEN }\nu32 main() { EColor c <- EColor.RED; return 0; }`,
        ),
      ).toHaveLength(0);
    });

    it("accepts a scope-declared struct by its bare name inside the scope", () => {
      // The qualified branch answering TRUE -- the mirror of the register case.
      expect(
        analyze(`
          scope Board {
              public struct Point { u32 x; }
              public void go() {
                  Point p <- { x: 1 };
              }
          }
        `),
      ).toHaveLength(0);
    });

    it("accepts a primitive", () => {
      expect(analyze(`u32 main() { u32 x <- 1; return x; }`)).toHaveLength(0);
    });

    it("stays silent when there is no symbol view", () => {
      // No evidence is not evidence of absence: with no symbols the analyzer
      // must not reject. No integration fixture can construct this state.
      // The foreign-header precondition is cleared so this proves the SYMBOL
      // guard rather than passing for the other reason.
      const tree = parse(`u32 main() { Nowhere c; return 0; }`);
      CodeGenState.currentFileReachesForeignHeader = false;
      expect(new UndeclaredTypeAnalyzer().analyze(tree)).toHaveLength(0);
    });

    it("stays silent when the file can reach a foreign header (#985)", () => {
      // A C/C++ header is not parsed into the symbol table, so an unresolved
      // name there is indistinguishable from a type the compiler will supply.
      // Rejecting valid interop code is a regression; not diagnosing is the
      // status quo -- so the analyzer declines rather than guesses.
      const tree = parse(`u32 main() { Nowhere c; return 0; }`);
      CodeGenState.symbols = TSymbolInfoAdapter.convert(
        CNextResolver.resolve(tree, "test.cnx").symbols,
      );
      CodeGenState.currentFileReachesForeignHeader = true;
      expect(new UndeclaredTypeAnalyzer().analyze(tree)).toHaveLength(0);
    });
  });
});
