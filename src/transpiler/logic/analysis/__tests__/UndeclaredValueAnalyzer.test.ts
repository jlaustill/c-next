/**
 * Unit tests for UndeclaredValueAnalyzer (E0427, #1353).
 *
 * The scope-qualified branch is the one no integration fixture reaches: it is
 * taken only when a bare name fails every unqualified lookup and then succeeds
 * under its scope-qualified spelling. A scope-declared register is the clearest
 * case, and it is also what #1336 made the value position responsible for --
 * `isValueName` answers yes for a register while `isTypeName` answers no.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { CharStream, CommonTokenStream } from "antlr4ng";
import { CNextLexer } from "../../parser/grammar/CNextLexer";
import { CNextParser } from "../../parser/grammar/CNextParser";
import CNextResolver from "../../../../PARSE/3-Declare/cnext/index";
import TSymbolInfoAdapter from "../../../../PARSE/3-Declare/cnext/adapters/TSymbolInfoAdapter";
import SymbolRegistry from "../../../state/SymbolRegistry";
import CodeGenState from "../../../state/CodeGenState";
import UndeclaredValueAnalyzer from "../UndeclaredValueAnalyzer";

function parse(source: string) {
  const charStream = CharStream.fromString(source);
  const lexer = new CNextLexer(charStream);
  const tokenStream = new CommonTokenStream(lexer);
  const parser = new CNextParser(tokenStream);
  return parser.program();
}

function analyze(source: string) {
  const tree = parse(source);
  CodeGenState.symbols = TSymbolInfoAdapter.convert(
    CNextResolver.resolve(tree, "test.cnx").symbols,
  );
  // Same precondition as E0426: the analyzer declines unless the transpiler
  // knows the file's whole name universe. These sources include nothing.
  CodeGenState.currentFileReachesForeignHeader = false;
  return new UndeclaredValueAnalyzer().analyze(tree);
}

describe("UndeclaredValueAnalyzer", () => {
  beforeEach(() => {
    SymbolRegistry.reset();
  });

  afterEach(() => {
    CodeGenState.reset();
  });

  describe("the scope-qualified spelling", () => {
    it("accepts a scope-declared register named bare inside its scope", () => {
      // `Control` resolves only as `Board__Control`, and only through
      // `isValueName` -- `isTypeName` rejects a register by design (#1336).
      expect(
        analyze(`
          scope Board {
              public register Control @ 0x40000000 { DR: u32 rw @ 0x00, }
              public void go() {
                  Control.DR <- 0x01;
              }
          }
        `),
      ).toHaveLength(0);
    });

    it("accepts a scope-declared register read bare inside its scope", () => {
      expect(
        analyze(`
          scope Board {
              public register Control @ 0x40000000 { DR: u32 rw @ 0x00, }
              public u32 read() {
                  u32 seen <- Control.DR;
                  return seen;
              }
          }
        `),
      ).toHaveLength(0);
    });

    it("still rejects a name that no spelling resolves, inside a scope", () => {
      const errors = analyze(`
        scope Board {
            public u32 go() {
                return Nowhere;
            }
        }
      `);
      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0427");
      expect(errors[0].identifier).toBe("Nowhere");
    });
  });

  describe("the unqualified spelling", () => {
    it("accepts a global register in a value position", () => {
      expect(
        analyze(`
          register Control @ 0x40000000 { DR: u32 rw @ 0x00, }
          u32 main() {
              u32 seen <- Control.DR;
              return seen;
          }
        `),
      ).toHaveLength(0);
    });

    it("rejects an undeclared name (E0427)", () => {
      const errors = analyze(`u32 main() { return Nowhere; }`);
      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0427");
    });
  });
});
