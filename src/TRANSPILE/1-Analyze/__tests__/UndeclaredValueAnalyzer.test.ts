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
import { CNextLexer } from "../../../PARSE/2-Parse/grammar/CNextLexer";
import { CNextParser } from "../../../PARSE/2-Parse/grammar/CNextParser";
import CNextResolver from "../../../PARSE/3-Declare/cnext/index";
import TSymbolInfoAdapter from "../../../PARSE/3-Declare/cnext/adapters/TSymbolInfoAdapter";
import SymbolRegistry from "../../../PARSE/3-Declare/SymbolRegistry";
import RenderState from "../../3-Render/RenderState";
import UndeclaredValueAnalyzer from "../UndeclaredValueAnalyzer";
import testAnalysisContext from "./testAnalysisContext";

function parse(source: string) {
  const charStream = CharStream.fromString(source);
  const lexer = new CNextLexer(charStream);
  const tokenStream = new CommonTokenStream(lexer);
  const parser = new CNextParser(tokenStream);
  return parser.program();
}

function analyze(source: string) {
  const tree = parse(source);
  state.symbols = TSymbolInfoAdapter.convert(
    CNextResolver.resolve(tree, "test.cnx", registry).symbols,
  );
  // Same precondition as E0426: the analyzer declines unless the transpiler
  // knows the file's whole name universe. These sources include nothing.
  state.currentFileReachesForeignHeader = false;
  return new UndeclaredValueAnalyzer(testAnalysisContext(state)).analyze(tree);
}

let registry = new SymbolRegistry();

beforeEach(() => {
  registry = new SymbolRegistry();
});

let state = new RenderState();

describe("UndeclaredValueAnalyzer", () => {
  beforeEach(() => {});

  afterEach(() => {
    state = new RenderState();
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

    it("leaves `this.` outside a scope to E0431, rather than adding a second diagnostic", () => {
      expect(
        analyze(`u32 main() { this.whatever <- 1; return 0; }`),
      ).toHaveLength(0);
    });
  });

  /**
   * #1582. The two positions are reached by two listener hooks -- a write
   * target is its own grammar rule, and a rooted read takes its name from the
   * first postfix op rather than the primary -- but they ask ONE question, and
   * this table is that claim rather than a restatement of it: every row runs
   * BOTH ways and must answer the same.
   *
   * The pair is the assertion, in both directions. The first fix for #1582
   * gave the write position ADR-016's root split and left the read position
   * root-blind, so `this.declaredAtFileScope <- 8` was rejected while
   * `u32 v <- this.declaredAtFileScope` beside it emitted
   * `Motor__declaredAtFileScope` -- a name nothing declares -- at exit 0.
   * A single-position table cannot fail on that.
   */
  describe("reads and writes ask one question", () => {
    const inScope = (body: string): string => `
      u32 declaredAtFileScope <- 0;
      scope Motor {
          u32 speed <- 0;
          public u32 spin() { ${body} return 0; }
      }
    `;

    it.each([
      ["a scope's own member through `this.`", "this.speed", null],
      [
        "a file-scope global through `global.`",
        "global.declaredAtFileScope",
        null,
      ],
      ["a file-scope global bare, inside a scope", "declaredAtFileScope", null],
      // The discriminating row: visible bare, and NOT a member of `Motor`. An
      // implementation that ignores the root finds it on the outward walk and
      // stays silent. Every other rooted row is visible both ways or neither.
      [
        "a file-scope global through `this.`",
        "this.declaredAtFileScope",
        "declaredAtFileScope",
      ],
      ["a scope member through `global.`", "global.speed", "speed"],
      ["a name declared nowhere, bare", "nothingAnywhere", "nothingAnywhere"],
      [
        "a name declared nowhere, through `this.`",
        "this.noSuchMember",
        "noSuchMember",
      ],
      [
        "a name declared nowhere, through `global.`",
        "global.noSuchGlobal",
        "noSuchGlobal",
      ],
    ])(
      "answers %s the same way read and written",
      (_label, spelling, named) => {
        for (const body of [`u32 sink <- ${spelling};`, `${spelling} <- 1;`]) {
          const errors = analyze(inScope(body));
          if (named === null) {
            expect(errors).toHaveLength(0);
            continue;
          }
          expect(errors).toHaveLength(1);
          expect(errors[0].code).toBe("E0427");
          expect(errors[0].identifier).toBe(named);
        }
      },
    );

    it.each([
      ["read", "u32 sink <- this.nope;"],
      ["write", "this.nope <- 1;"],
    ])(
      "puts the caret on the identifier, not the `this` keyword, on a %s",
      (_label, body) => {
        const source = inScope(body);
        const errors = analyze(source);
        expect(errors).toHaveLength(1);
        expect(errors[0].identifier).toBe("nope");

        // Derived from the source rather than written down, so a change to the
        // template's indentation cannot turn this into a stale number. `this` sits exactly
        // five columns earlier -- asserted below so the equality is known to
        // DISCRIMINATE, which `toBeGreaterThan(0)` never did: it holds for the
        // keyword's column too, and the caret regression it is named for would
        // leave it green.
        const line = source.split("\n")[errors[0].line - 1];
        expect(errors[0].column).toBe(line.indexOf("nope"));
        expect(line.indexOf("this.")).toBe(errors[0].column - 5);
      },
    );
  });
});
