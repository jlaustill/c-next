import { afterEach, describe, expect, it } from "vitest";

import CNextResolver from "../../../PARSE/3-Declare/cnext";
import CNextSourceParser from "../../../transpiler/logic/parser/CNextSourceParser";
import CodeGenState from "../../../transpiler/state/CodeGenState";
import Program from "../../../PARSE/4-Resolve/Program";
import SymbolRegistry from "../../../transpiler/state/SymbolRegistry";
import ArrayDeclarationAnalyzer from "../ArrayDeclarationAnalyzer";

/**
 * #1322. ADR-036's declaration shape (E0874 C-style, E0875 unbounded
 * parameter) and ADR-035's initializer rules (E0866 list and count, E0876
 * fill-all on an inferred size), replacing five codegen throws and the string
 * analyzer's array arm. Every fact is in the parse tree; a const dimension is
 * sized through the program's const table, which a unit test does not build,
 * so `tests/adr-035/array-init-error` asserts that arm end to end.
 */
const errors = (source: string) => {
  const { tree } = CNextSourceParser.parse(source);
  return new ArrayDeclarationAnalyzer().analyze(tree);
};

/**
 * The same, with a real program artifact behind it, so a const DIMENSION
 * resolves. Built rather than stubbed because the thing under test is which
 * const a scoped dimension resolves to, and a stub would encode the answer.
 */
const errorsWithProgram = (source: string) => {
  const { tree } = CNextSourceParser.parse(source);
  SymbolRegistry.reset();
  CodeGenState.program = Program.build([
    CNextResolver.resolve(tree, "collide.cnx"),
  ]);
  return new ArrayDeclarationAnalyzer().analyze(tree);
};

afterEach(() => {
  CodeGenState.reset();
});

describe("ArrayDeclarationAnalyzer", () => {
  describe("E0874 -- C-style declarations and parameters", () => {
    it("rejects a trailing dimension on a declaration, naming the prefix form", () => {
      const found = errors("u16 arr[8];");
      expect(found).toHaveLength(1);
      expect(found[0].code).toBe("E0874");
      expect(found[0].message).toContain(
        "Use 'u16[8] arr' instead of 'u16 arr[8]'",
      );
      expect(found[0].line).toBe(1);
    });

    it("rejects the mixed form and every-dimension-after form", () => {
      const found = errors("void f() {\n    u8[4] m[8];\n    u8 n[4][8];\n}");
      expect(found.map((e) => e.line)).toEqual([2, 3]);
      expect(found[0].message).toContain(
        "Use 'u8[4][8] m' instead of 'u8[4] m[8]'",
      );
    });

    it("rejects a C-style parameter", () => {
      const found = errors("void f(u8 data[8]) {\n}");
      expect(found).toHaveLength(1);
      expect(found[0].message).toContain("C-style array parameter");
      expect(found[0].message).toContain("'u8[8] data'");
    });

    it("accepts the prefix form everywhere, and reproduces codegen's scope-member exemption", () => {
      // A scope member with a trailing dimension reached a generator that
      // never rejected it; thirty-one fixtures rely on that, so it is
      // reproduced and recorded rather than closed.
      const source = [
        "u8[4] okGlobal;",
        "void f(u8[8] data, u8[2][4] grid) {",
        "    u8[4][8] okLocal;",
        "}",
        "scope S {",
        "    public u8 legacy[32];",
        "}",
      ].join("\n");
      expect(errors(source)).toEqual([]);
    });
  });

  describe("E0866 -- a scoped const sizes its own scope's array", () => {
    // #1322 review: the program artifact keyed every const by BARE name, so
    // two scopes each declaring `SIZE` shared one slot and the last one derived
    // won. This legal program was REJECTED, `declared [8] but the initializer
    // has 2 element(s)`, against `Small.table` sized by `Large.SIZE`.
    //
    // Asserted here rather than as a fixture because the EMITTED array size
    // still comes from the collided key (#1538, which folds the dimension at
    // declare time), so compiling code in this shape would assert C the static
    // analysis correctly rejects. See
    // `tests/bugs/issue-1322-scoped-const-collision/README.md`.
    const twoScopes = (first: string, second: string) =>
      [
        `scope ${first} { private const u8 SIZE <- ${first === "Small" ? 2 : 8}; public u8[SIZE] table <- [${first === "Small" ? "1, 2" : "1, 2, 3, 4, 5, 6, 7, 8"}]; }`,
        `scope ${second} { private const u8 SIZE <- ${second === "Small" ? 2 : 8}; public u8[SIZE] table <- [${second === "Small" ? "1, 2" : "1, 2, 3, 4, 5, 6, 7, 8"}]; }`,
      ].join("\n");

    it("accepts both arrays whichever scope is declared first", () => {
      expect(errorsWithProgram(twoScopes("Small", "Large"))).toEqual([]);
      expect(errorsWithProgram(twoScopes("Large", "Small"))).toEqual([]);
    });

    it("still counts a genuine mismatch inside a scope", () => {
      // The control: without it, "resolves to nothing" would pass this suite
      // exactly as "resolves correctly" does.
      const found = errorsWithProgram(
        "scope Small { private const u8 SIZE <- 2; public u8[SIZE] table <- [1, 2, 3]; }",
      );
      expect(found.map((e) => e.code)).toEqual(["E0866"]);
      expect(found[0].message).toContain("declared [2]");
    });
  });

  describe("E0875 -- unbounded parameters", () => {
    it("rejects an unbounded dimension on a parameter", () => {
      const found = errors("void f(u8[] data) {\n}");
      expect(found).toHaveLength(1);
      expect(found[0].code).toBe("E0875");
    });

    it("accepts an inferred size on a declaration", () => {
      expect(errors("u8[] data <- [1, 2, 3];")).toEqual([]);
    });
  });

  describe("E0866 -- the initializer against the declaration", () => {
    it("rejects too few and too many elements", () => {
      const found = errors("u8[3] a <- [1, 2];\nu8[3] b <- [1, 2, 3, 4];");
      expect(found.map((e) => [e.code, e.line])).toEqual([
        ["E0866", 1],
        ["E0866", 2],
      ]);
      expect(found[0].message).toBe(
        "Array size mismatch: declared [3] but the initializer has 2 element(s)",
      );
    });

    it("counts every nesting level (the closed hole)", () => {
      // Codegen counted the outer list only; the inner excess reached C.
      const found = errors("u8[2][2] m <- [[1, 2, 3], [4, 5]];");
      expect(found).toHaveLength(1);
      expect(found[0].message).toContain("at nesting level 2");
    });

    it("rejects an initializer that is not a list (the closed hole)", () => {
      // `uint8_t b[2] = a;` is not C.
      const found = errors(
        "void f() {\n    u8[2] a <- [1, 2];\n    u8[2] b <- a;\n}",
      );
      expect(found).toHaveLength(1);
      expect(found[0].message).toContain("must be initialized by a list");
    });

    it("accepts a string literal into a u8 array, fill-all at any level, and exact counts", () => {
      const source = [
        'u8[] text <- "Hello";',
        'u8[6] sized <- "Hello";',
        "u8[4] fill <- [0*];",
        "u8[2][3] inner <- [[1*], [2*]];",
        "u8[2][2] exact <- [[1, 2], [3, 4]];",
        "u8[] inferred <- [1, 2, 3];",
      ].join("\n");
      expect(errors(source)).toEqual([]);
    });

    it("rejects a string literal into a non-u8 array", () => {
      expect(errors('u16[] text <- "Hello";').map((e) => e.code)).toEqual([
        "E0866",
      ]);
    });
  });

  describe("E0876 -- fill-all on an inferred size", () => {
    it("rejects it, with the form as written", () => {
      const found = errors("u8[] d <- [0*];");
      expect(found).toHaveLength(1);
      expect(found[0].code).toBe("E0876");
      expect(found[0].message).toContain("[0*]");
    });
  });
});
