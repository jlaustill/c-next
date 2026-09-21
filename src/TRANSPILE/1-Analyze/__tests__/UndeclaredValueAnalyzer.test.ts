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
import { CNextLexer } from "../../../transpiler/logic/parser/grammar/CNextLexer";
import { CNextParser } from "../../../transpiler/logic/parser/grammar/CNextParser";
import CNextResolver from "../../../PARSE/3-Declare/cnext/index";
import TSymbolInfoAdapter from "../../../PARSE/3-Declare/cnext/adapters/TSymbolInfoAdapter";
import SymbolRegistry from "../../../transpiler/state/SymbolRegistry";
import CodeGenState from "../../../transpiler/state/CodeGenState";
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

  /**
   * #1582. An assignment target is its own grammar rule, so the write position
   * is reached by its own listener hook -- but it must answer the SAME question
   * the read position answers, except where the spelling states otherwise.
   */
  describe("the write position", () => {
    it.each([
      ["a bare name declared nowhere", `u32 main() { nope <- 5; return 0; }`],
      [
        "a name local to another function",
        `void other() { u32 witness <- 1; }
         u32 main() { witness <- 5; return 0; }`,
      ],
      [
        "the base of a subscripted target",
        `u32 main() { nopeArr[0] <- 5; return 0; }`,
      ],
      [
        "the base of a member target",
        `u32 main() { nopeObj.field <- 5; return 0; }`,
      ],
      [
        "a `for` init clause",
        `u32 main() { u32 i <- 0; for (nopeInit <- 0; i < 3; i +<- 1) { } return 0; }`,
      ],
      [
        "a `for` update clause",
        `u32 main() { u32 i <- 0; for (i <- 0; i < 3; nopeUpdate +<- 1) { } return 0; }`,
      ],
    ])("rejects %s", (_label, source) => {
      const errors = analyze(source);
      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe("E0427");
    });

    it.each([
      ["a local", `u32 main() { u32 here <- 0; here <- 1; return 0; }`],
      [
        "a file-scope variable named bare",
        `u32 shared <- 0;
         u32 main() { shared <- 1; return 0; }`,
      ],
      [
        "a file-scope variable named through `global.`",
        `u32 shared <- 0;
         u32 main() { global.shared <- 1; return 0; }`,
      ],
      [
        "a scope member named through `this.`",
        `scope Motor { u32 speed <- 0;
           public u32 spin() { this.speed <- 1; return 0; } }`,
      ],
    ])("accepts %s", (_label, source) => {
      expect(analyze(source)).toHaveLength(0);
    });

    /**
     * The case that tells a root-aware implementation from a root-blind one.
     * Every other qualified write is visible either both ways or neither way,
     * so this is the only shape that discriminates.
     */
    it("rejects `this.name` when the name is a file-scope global, not a member", () => {
      const errors = analyze(`
        u32 loose <- 0;
        scope Motor {
            u32 speed <- 0;
            public u32 spin() { this.loose <- 1; return 0; }
        }
      `);
      expect(errors).toHaveLength(1);
      expect(errors[0].identifier).toBe("loose");
    });

    it("rejects `global.name` when the name is only a scope member", () => {
      const errors = analyze(`
        scope Motor {
            u32 speed <- 0;
            public u32 spin() { global.speed <- 1; return 0; }
        }
      `);
      expect(errors).toHaveLength(1);
      expect(errors[0].identifier).toBe("speed");
    });

    it("leaves `this.` outside a scope to E0431, rather than adding a second diagnostic", () => {
      expect(
        analyze(`u32 main() { this.whatever <- 1; return 0; }`),
      ).toHaveLength(0);
    });

    it("names the identifier, not the `this` keyword the target starts with", () => {
      const errors = analyze(`
        scope Motor {
            public u32 spin() { this.nope <- 1; return 0; }
        }
      `);
      expect(errors).toHaveLength(1);
      // column is 0-based at `nope`, which is 4 past `this.`
      expect(errors[0].identifier).toBe("nope");
      expect(errors[0].column).toBeGreaterThan(0);
    });
  });
});
