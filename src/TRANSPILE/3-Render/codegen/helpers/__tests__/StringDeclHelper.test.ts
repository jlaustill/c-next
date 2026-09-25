/**
 * Unit tests for StringDeclHelper
 *
 * Issue #644: Tests for the extracted string declaration helper.
 * Migrated to use TranspileState instead of constructor DI.
 *
 * #1445 box 3: these took hand-built parse nodes -- `{ stringType: () => ({
 * INTEGER_LITERAL: () => ({ getText: () => "64" }) }) } as never` -- one per
 * case, 56 of them. The cast was load-bearing: it silenced the compiler about
 * a shape that was not a `TypeContext`, which also silenced it about the
 * helper's signature changing underneath. They are plain `TPlannedStringDecl`
 * values now, checked by the compiler, and the tree navigation they were
 * imitating is tested in VariableDeclHelper.test.ts where it now lives.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import StringDeclHelper from "../StringDeclHelper";
import TranspileState from "../../../../TranspileState";
import type IPlannedStringInit from "../../types/IPlannedStringInit";
import type IRenderedModifiers from "../../types/IRenderedModifiers";
import type TPlannedStringDecl from "../../types/TPlannedStringDecl";

const NO_MODS: IRenderedModifiers = {
  extern: "",
  const: "",
  atomic: "",
  volatile: "",
};

/**
 * A bounded string's initializer, defaulting every arm to "declines".
 * Each case overrides only the arm it is about, so a test that says nothing
 * about substrings cannot accidentally take that branch.
 */
function init(overrides: Partial<IPlannedStringInit> = {}): IPlannedStringInit {
  return {
    concat: null,
    renderSubstring: () => null,
    text: '""',
    render: () => '""',
    ...overrides,
  };
}

function bounded(
  capacity: number,
  initializer: IPlannedStringInit | null = null,
): TPlannedStringDecl {
  return { kind: "bounded", capacity, init: initializer };
}

// #1322: the `asserts the invariant ...` cases below assert INVARIANTS, not
// diagnostics. ADR-045's declaration rules are E0862-E0866 in pass 2.1, which
// halts before codegen runs, so a declaration reaching this helper has already
// been checked. The assertion is the safety net for a DIVERGENCE between the
// two -- 2.1 accepting something this code cannot emit -- and these cases are
// what prove the net is there. Kept and re-aimed rather than deleted: they
// were the only coverage of these conditions, and an assertion nothing
// exercises is the guard-that-cannot-fail shape.
let state = new TranspileState();

describe("StringDeclHelper", () => {
  beforeEach(() => {
    state = new TranspileState();
    state.inFunctionBody = true;
    vi.clearAllMocks();
  });

  describe("bounded strings", () => {
    it("generates bounded string with literal initializer", () => {
      const code = StringDeclHelper.generateStringDecl(
        bounded(64, init({ text: '"Hello"', render: () => '"Hello"' })),
        "greeting",
        NO_MODS,
        false,
        state,
      );

      expect(code).toBe('char greeting[65] = "Hello";');
    });

    it("generates empty bounded string without initializer", () => {
      const code = StringDeclHelper.generateStringDecl(
        bounded(32),
        "buffer",
        NO_MODS,
        false,
        state,
      );

      expect(code).toBe('char buffer[33] = "";');
    });

    it("generates const bounded string", () => {
      const code = StringDeclHelper.generateStringDecl(
        bounded(10, init({ text: '"Test"', render: () => '"Test"' })),
        "label",
        { ...NO_MODS, const: "const " },
        true,
        state,
      );

      expect(code).toBe('const char label[11] = "Test";');
    });

    it("generates extern bounded string", () => {
      const code = StringDeclHelper.generateStringDecl(
        bounded(16),
        "shared",
        { ...NO_MODS, extern: "extern " },
        false,
        state,
      );

      expect(code).toBe('extern char shared[17] = "";');
    });

    it("asserts the invariant for string literal exceeding capacity", () => {
      expect(() =>
        StringDeclHelper.generateStringDecl(
          bounded(5, init({ text: '"This is way too long"' })),
          "small",
          NO_MODS,
          false,
          state,
        ),
      ).toThrow("a string literal fits its declared capacity");
    });
  });

  // #1642: a bounded string WITH an initializer dropped atomic/volatile while
  // the header kept them -- `conflicting types`, in C and C++, exit 0. The
  // qualifiers have to reach every arm, so every arm is asserted rather than
  // the one that was reported.
  describe("atomic/volatile reach every bounded arm (#1164, #1642)", () => {
    const ATOMIC: IRenderedModifiers = { ...NO_MODS, atomic: "volatile " };

    it("carries them with no initializer", () => {
      expect(
        StringDeclHelper.generateStringDecl(
          bounded(16),
          "s",
          ATOMIC,
          false,
          state,
        ),
      ).toBe('volatile char s[17] = "";');
    });

    it("carries them on the literal arm", () => {
      expect(
        StringDeclHelper.generateStringDecl(
          bounded(16, init({ text: '"a"', render: () => '"a"' })),
          "s",
          ATOMIC,
          false,
          state,
        ),
      ).toBe('volatile char s[17] = "a";');
    });

    it("carries them on the copy arm", () => {
      state.setVariableTypeInfo("src", {
        baseType: "char",
        bitWidth: 8,
        isArray: true,
        isConst: false,
        isString: true,
        stringCapacity: 8,
      });

      const code = StringDeclHelper.generateStringDecl(
        bounded(16, init({ text: "src", render: () => "src" })),
        "s",
        ATOMIC,
        false,
        state,
      );

      expect(code.split("\n")[0]).toBe('volatile char s[17] = "";');
    });

    it("carries them on the concat arm", () => {
      const code = StringDeclHelper.generateStringDecl(
        bounded(
          16,
          init({
            concat: {
              left: "a",
              right: "b",
              leftCapacity: 4,
              rightCapacity: 4,
            },
          }),
        ),
        "s",
        ATOMIC,
        false,
        state,
      );

      expect(code.split("\n")[0]).toBe('volatile char s[17] = "";');
    });

    it("carries them on the substring arm", () => {
      const code = StringDeclHelper.generateStringDecl(
        bounded(
          16,
          init({
            renderSubstring: () => ({
              source: "src",
              start: "0",
              lengthExpression: "3",
              sourceCapacity: 8,
            }),
          }),
        ),
        "s",
        ATOMIC,
        false,
        state,
      );

      expect(code.split("\n")[0]).toBe('volatile char s[17] = "";');
    });
  });

  // ADR-045 asks the four initializer forms in a fixed order and the order is
  // load-bearing, because asking costs something on two of the arms: taking a
  // substring generates the index expressions, and rendering the initializer
  // generates the whole thing -- either can request an include or queue a C++
  // temp into the enclosing block. An arm that is not taken must raise no
  // effect at all, so these assert that the unused thunks are never called,
  // not merely that the right code comes out.
  describe("initializer discrimination order", () => {
    it("does not ask for a substring when the initializer is a concatenation", () => {
      const renderSubstring = vi.fn(() => null);
      const render = vi.fn(() => "unused");

      StringDeclHelper.generateStringDecl(
        bounded(
          16,
          init({
            concat: {
              left: "a",
              right: "b",
              leftCapacity: 4,
              rightCapacity: 4,
            },
            renderSubstring,
            render,
          }),
        ),
        "s",
        NO_MODS,
        false,
        state,
      );

      expect(renderSubstring).not.toHaveBeenCalled();
      expect(render).not.toHaveBeenCalled();
    });

    it("does not render the initializer when it is a substring", () => {
      const render = vi.fn(() => "unused");

      StringDeclHelper.generateStringDecl(
        bounded(
          16,
          init({
            renderSubstring: () => ({
              source: "src",
              start: "0",
              lengthExpression: "3",
              sourceCapacity: 8,
            }),
            render,
          }),
        ),
        "s",
        NO_MODS,
        false,
        state,
      );

      expect(render).not.toHaveBeenCalled();
    });

    it("renders the initializer only when neither operand form matched", () => {
      const render = vi.fn(() => '"x"');

      StringDeclHelper.generateStringDecl(
        bounded(16, init({ text: '"x"', render })),
        "s",
        NO_MODS,
        false,
        state,
      );

      expect(render).toHaveBeenCalledTimes(1);
    });
  });

  describe("string variable assignment validation", () => {
    function declareSource(name: string, capacity: number): void {
      state.setVariableTypeInfo(name, {
        baseType: "char",
        bitWidth: 8,
        isArray: true,
        isConst: false,
        isString: true,
        stringCapacity: capacity,
      });
    }

    it("asserts the invariant when source string capacity exceeds destination", () => {
      declareSource("bigString", 100);

      expect(() =>
        StringDeclHelper.generateStringDecl(
          bounded(10, init({ text: "bigString", render: () => "bigString" })),
          "small",
          NO_MODS,
          false,
          state,
        ),
      ).toThrow("a string source fits its destination");
    });

    it("allows assignment when source capacity fits", () => {
      declareSource("src", 20);

      const code = StringDeclHelper.generateStringDecl(
        bounded(50, init({ text: "src", render: () => "src" })),
        "dest",
        NO_MODS,
        false,
        state,
      );

      expect(code).toContain("char dest[51]");
      expect(code).toContain("strncpy");
    });

    it("does not indent continuation lines (the block emitter owns indentation) — Issue #1037", () => {
      declareSource("src", 20);

      const code = StringDeclHelper.generateStringDecl(
        bounded(50, init({ text: "src", render: () => "src" })),
        "dest",
        NO_MODS,
        false,
        state,
      );

      for (const line of code.split("\n").slice(1)) {
        expect(line.startsWith(" ")).toBe(false);
      }
    });

    it("asserts the invariant for string variable initialization at global scope", () => {
      state.inFunctionBody = false;
      declareSource("src", 20);

      expect(() =>
        StringDeclHelper.generateStringDecl(
          bounded(50, init({ text: "src", render: () => "src" })),
          "dest",
          NO_MODS,
          false,
          state,
        ),
      ).toThrow("a string at file scope is initialized by a literal");
    });
  });

  describe("string concatenation", () => {
    const CONCAT = {
      left: "first",
      right: "second",
      leftCapacity: 10,
      rightCapacity: 10,
    };

    it("generates concatenation code in function body", () => {
      const code = StringDeclHelper.generateStringDecl(
        bounded(50, init({ concat: CONCAT })),
        "full",
        NO_MODS,
        false,
        state,
      );

      expect(code).toContain('char full[51] = "";');
      expect(code).toContain("strncpy");
      expect(code).toContain("strncat");
    });

    it("asserts the invariant for concatenation at global scope", () => {
      state.inFunctionBody = false;

      expect(() =>
        StringDeclHelper.generateStringDecl(
          bounded(50, init({ concat: CONCAT })),
          "full",
          NO_MODS,
          false,
          state,
        ),
      ).toThrow("a string at file scope is initialized by a literal");
    });

    it("asserts the invariant when combined capacity exceeds destination", () => {
      expect(() =>
        StringDeclHelper.generateStringDecl(
          bounded(
            10,
            init({
              concat: { ...CONCAT, leftCapacity: 20, rightCapacity: 20 },
            }),
          ),
          "tooSmall",
          NO_MODS,
          false,
          state,
        ),
      ).toThrow("a concatenation fits its destination");
    });

    it("generates const concatenation declaration", () => {
      const code = StringDeclHelper.generateStringDecl(
        bounded(50, init({ concat: CONCAT })),
        "full",
        { ...NO_MODS, const: "const " },
        true,
        state,
      );

      expect(code).toContain('const char full[51] = "";');
    });
  });

  describe("substring extraction", () => {
    function substring(
      overrides: Partial<{
        source: string;
        start: string;
        lengthExpression: string;
        sourceCapacity: number;
      }> = {},
    ): IPlannedStringInit {
      return init({
        renderSubstring: () => ({
          source: "source",
          start: "0",
          lengthExpression: "5",
          sourceCapacity: 20,
          ...overrides,
        }),
      });
    }

    it("generates substring extraction code in function body", () => {
      const code = StringDeclHelper.generateStringDecl(
        bounded(10, substring()),
        "part",
        NO_MODS,
        false,
        state,
      );

      expect(code).toContain('char part[11] = "";');
      expect(code).toContain("strncpy");
    });

    it("asserts the invariant for substring at global scope", () => {
      state.inFunctionBody = false;

      expect(() =>
        StringDeclHelper.generateStringDecl(
          bounded(10, substring()),
          "part",
          NO_MODS,
          false,
          state,
        ),
      ).toThrow("a string at file scope is initialized by a literal");
    });

    it("asserts the invariant when substring bounds exceed source capacity", () => {
      expect(() =>
        StringDeclHelper.generateStringDecl(
          bounded(
            50,
            substring({
              start: "15",
              lengthExpression: "10",
              sourceCapacity: 20,
            }),
          ),
          "part",
          NO_MODS,
          false,
          state,
        ),
      ).toThrow("substring bounds stay within the source");
    });

    it("asserts the invariant when substring length exceeds destination capacity", () => {
      expect(() =>
        StringDeclHelper.generateStringDecl(
          bounded(
            5,
            substring({
              start: "0",
              lengthExpression: "10",
              sourceCapacity: 20,
            }),
          ),
          "part",
          NO_MODS,
          false,
          state,
        ),
      ).toThrow("a substring fits its destination");
    });

    it("skips bounds check when start is not numeric", () => {
      const code = StringDeclHelper.generateStringDecl(
        bounded(50, substring({ start: "offset", lengthExpression: "10" })),
        "part",
        NO_MODS,
        false,
        state,
      );

      expect(code).toContain('char part[51] = "";');
    });

    it("skips length check when length is not numeric", () => {
      const code = StringDeclHelper.generateStringDecl(
        bounded(5, substring({ start: "0", lengthExpression: "len" })),
        "part",
        NO_MODS,
        false,
        state,
      );

      expect(code).toContain('char part[6] = "";');
    });

    it("generates const substring declaration", () => {
      const code = StringDeclHelper.generateStringDecl(
        bounded(10, substring()),
        "part",
        { ...NO_MODS, const: "const " },
        true,
        state,
      );

      expect(code).toContain('const char part[11] = "";');
    });
  });

  describe("unsized const strings", () => {
    it("generates unsized const string with literal initializer", () => {
      // #1642: `NO_MODS` cannot reach this arm -- an unsized string is const,
      // which E0862 enforces in 2.1 -- and passing it here is what let the arm
      // hardcode `const ` and drop `atomic`/`volatile` for years without a
      // test noticing. The realistic input carries the const the caller
      // resolved.
      const code = StringDeclHelper.generateStringDecl(
        { kind: "unsized", initText: '"Hello World"' },
        "message",
        { ...NO_MODS, const: "const " },
        true,
        state,
      );

      expect(code).toBe('const char message[12] = "Hello World";');
    });

    it("carries atomic and volatile onto the unsized arm (#1642)", () => {
      const code = StringDeclHelper.generateStringDecl(
        { kind: "unsized", initText: '"v"' },
        "flag",
        { extern: "", const: "const ", atomic: "", volatile: "volatile " },
        true,
        state,
      );

      // The header derives the qualifier from the SYMBOL, so a definition
      // without it is `conflicting types` at the first translation unit that
      // includes its own header.
      expect(code).toBe('const volatile char flag[2] = "v";');
    });

    it("refuses a non-const unsized string rather than emitting one", () => {
      expect(() =>
        StringDeclHelper.generateStringDecl(
          { kind: "unsized", initText: '"x"' },
          "loose",
          NO_MODS,
          true,
          state,
        ),
      ).toThrow(/unsized string is const/);
    });

    it("registers the inferred capacity in the type registry", () => {
      StringDeclHelper.generateStringDecl(
        { kind: "unsized", initText: '"abc"' },
        "msg",
        { ...NO_MODS, const: "const " },
        true,
        state,
      );

      expect(state.getVariableTypeInfo("msg")?.stringCapacity).toBe(3);
    });

    it("asserts the invariant for non-const unsized string", () => {
      expect(() =>
        StringDeclHelper.generateStringDecl(
          { kind: "unsized", initText: '"x"' },
          "bad",
          { ...NO_MODS, const: "const " },
          false,
          state,
        ),
      ).toThrow("a non-const string states its capacity");
    });

    it("asserts the invariant for unsized const string without initializer", () => {
      expect(() =>
        StringDeclHelper.generateStringDecl(
          { kind: "unsized", initText: null },
          "bad",
          { ...NO_MODS, const: "const " },
          true,
          state,
        ),
      ).toThrow("an unsized const string has an initializer to infer from");
    });

    it("asserts the invariant for unsized const string with non-literal", () => {
      expect(() =>
        StringDeclHelper.generateStringDecl(
          { kind: "unsized", initText: "someVar" },
          "bad",
          { ...NO_MODS, const: "const " },
          true,
          state,
        ),
      ).toThrow("an unsized const string infers from a LITERAL");
    });
  });

  describe("string arrays (Issue #1029)", () => {
    function array(
      overrides: Partial<Extract<TPlannedStringDecl, { kind: "array" }>> = {},
    ): TPlannedStringDecl {
      return {
        kind: "array",
        elementCapacity: 32,
        dimensions: "[4]",
        declaredSize: 4,
        renderInit: null,
        ...overrides,
      };
    }

    it("generates string array without initializer", () => {
      expect(
        StringDeclHelper.generateStringDecl(
          array(),
          "items",
          NO_MODS,
          false,
          state,
        ),
      ).toBe("char items[4][33] = {0};");
    });

    it("generates string array with initializer", () => {
      const code = StringDeclHelper.generateStringDecl(
        array({
          elementCapacity: 10,
          dimensions: "[2]",
          declaredSize: 2,
          renderInit: () => {
            state.lastArrayInitCount = 2;
            state.lastArrayFillValue = undefined;
            return '{"One", "Two"}';
          },
        }),
        "labels",
        NO_MODS,
        false,
        state,
      );

      expect(code).toContain("char labels[2][11]");
      expect(code).toContain('{"One", "Two"}');
    });

    it("carries trailing dimensions the planner already rendered", () => {
      expect(
        StringDeclHelper.generateStringDecl(
          array({ elementCapacity: 10, dimensions: "[2][3]", declaredSize: 2 }),
          "matrix",
          NO_MODS,
          false,
          state,
        ),
      ).toBe("char matrix[2][3][11] = {0};");
    });

    it("validates element count matches declared size", () => {
      expect(() =>
        StringDeclHelper.generateStringDecl(
          array({
            elementCapacity: 10,
            declaredSize: 4,
            renderInit: () => {
              state.lastArrayInitCount = 2;
              state.lastArrayFillValue = undefined;
              return '{"One", "Two"}';
            },
          }),
          "items",
          NO_MODS,
          false,
          state,
        ),
      ).toThrow(
        "a string array initializer matches its declared size -- E0866 rejects [4] against 2 element(s)",
      );
    });

    it("asserts the invariant when the initializer is not a list", () => {
      expect(() =>
        StringDeclHelper.generateStringDecl(
          array({ renderInit: () => "other" }),
          "items",
          NO_MODS,
          false,
          state,
        ),
      ).toThrow("a string array is initialized from literals");
    });

    // #1644: a fill-all expands to one element per DECLARED slot, so a plan
    // whose declaredSize did not fold leaves the literal alone -- which is the
    // shape the hex and const spellings used to produce.
    it("expands a fill-all across every declared slot", () => {
      const code = StringDeclHelper.generateStringDecl(
        array({
          elementCapacity: 8,
          dimensions: "[3]",
          declaredSize: 3,
          renderInit: () => {
            state.lastArrayInitCount = 1;
            state.lastArrayFillValue = '"ab"';
            return '{"ab"}';
          },
        }),
        "filled",
        NO_MODS,
        false,
        state,
      );

      expect(code).toContain('{"ab", "ab", "ab"}');
    });

    it("leaves the fill alone when the declared size did not fold", () => {
      const code = StringDeclHelper.generateStringDecl(
        array({
          elementCapacity: 8,
          dimensions: "[SIZE]",
          declaredSize: null,
          renderInit: () => {
            state.lastArrayInitCount = 1;
            state.lastArrayFillValue = '"ab"';
            return '{"ab"}';
          },
        }),
        "unfolded",
        NO_MODS,
        false,
        state,
      );

      expect(code).toContain('{"ab"}');
    });

    it('does not expand an empty-string fill (C handles {""} correctly)', () => {
      const code = StringDeclHelper.generateStringDecl(
        array({
          elementCapacity: 8,
          dimensions: "[3]",
          declaredSize: 3,
          renderInit: () => {
            state.lastArrayInitCount = 1;
            state.lastArrayFillValue = '""';
            return '{""}';
          },
        }),
        "empties",
        NO_MODS,
        false,
        state,
      );

      expect(code).toContain('{""}');
    });

    it("tracks local arrays in localArrays set", () => {
      StringDeclHelper.generateStringDecl(
        array({ elementCapacity: 20, dimensions: "[3]", declaredSize: 3 }),
        "tracked",
        NO_MODS,
        false,
        state,
      );

      expect(state.localArrays.has("tracked")).toBe(true);
    });

    it("generates string array with modifiers", () => {
      const code = StringDeclHelper.generateStringDecl(
        array({ elementCapacity: 8, dimensions: "[2]", declaredSize: 2 }),
        "data",
        {
          extern: "extern ",
          const: "const ",
          atomic: "",
          volatile: "volatile ",
        },
        true,
        state,
      );

      expect(code).toContain("extern const volatile char data[2][9]");
    });
  });
});
