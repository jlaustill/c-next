/**
 * Unit tests for StringOperationsHelper
 *
 * #1445: the helper asks the type registry about NAMES, so these tests hand it
 * names. The tree navigation that used to sit in front of them --
 * "is this a two-operand `+`", "is this an identifier with one subscript" --
 * is asserted in `ExpressionUnwrapper.test.ts`, including both of the
 * regressions it carries (a hyphen inside a literal, a subscripted call).
 */

import { describe, it, expect, beforeEach } from "vitest";
import StringOperationsHelper from "../StringOperationsHelper";
import RenderState from "../../../RenderState";

/** A declared `string<capacity>` in the render-time type registry. */
function declareString(name: string, capacity: number): void {
  state.setVariableTypeInfo(name, {
    baseType: "char",
    bitWidth: 8,
    isArray: true,
    arrayDimensions: [capacity + 1],
    isConst: false,
    isString: true,
    stringCapacity: capacity,
  });
}

let state = new RenderState();

describe("StringOperationsHelper", () => {
  beforeEach(() => {
    state = new RenderState();
  });

  // ========================================================================
  // getStringExprCapacity
  // ========================================================================

  describe("getStringExprCapacity", () => {
    it("returns literal length for string literal", () => {
      const capacity = StringOperationsHelper.getStringExprCapacity(
        '"hello"',
        state,
      );
      expect(capacity).toBe(5);
    });

    it("returns literal length for empty string", () => {
      const capacity = StringOperationsHelper.getStringExprCapacity(
        '""',
        state,
      );
      expect(capacity).toBe(0);
    });

    it.each([
      ["non-string expression", "123"],
      ["unknown variable", "unknownVar"],
      ["complex expression", "a + b"],
    ])("returns null for %s", (_label, expression) => {
      expect(
        StringOperationsHelper.getStringExprCapacity(expression, state),
      ).toBeNull();
    });

    it("returns capacity from type registry for string variable", () => {
      declareString("myStr", 32);

      const capacity = StringOperationsHelper.getStringExprCapacity(
        "myStr",
        state,
      );
      expect(capacity).toBe(32);
    });

    it("returns null for non-string variable", () => {
      state.setVariableTypeInfo("myInt", {
        baseType: "u32",
        bitWidth: 32,
        isArray: false,
        arrayDimensions: [],
        isConst: false,
      });

      const capacity = StringOperationsHelper.getStringExprCapacity(
        "myInt",
        state,
      );
      expect(capacity).toBeNull();
    });
  });

  // ========================================================================
  // getStringConcatOperands
  // ========================================================================

  describe("getStringConcatOperands", () => {
    beforeEach(() => {
      declareString("str1", 32);
      declareString("str2", 16);
    });

    it("returns operands for string variable concatenation", () => {
      const result = StringOperationsHelper.getStringConcatOperands(
        "str1",
        "str2",
        state,
      );

      expect(result).toEqual({
        left: "str1",
        right: "str2",
        leftCapacity: 32,
        rightCapacity: 16,
      });
    });

    it("returns operands for string literal concatenation", () => {
      const result = StringOperationsHelper.getStringConcatOperands(
        '"hello"',
        '"world"',
        state,
      );

      expect(result).toEqual({
        left: '"hello"',
        right: '"world"',
        leftCapacity: 5,
        rightCapacity: 5,
      });
    });

    it("measures a literal that contains a hyphen", () => {
      const result = StringOperationsHelper.getStringConcatOperands(
        "str1",
        '"hello-world"',
        state,
      );

      expect(result).not.toBeNull();
      expect(result!.rightCapacity).toBe(11);
    });

    it.each([
      ["neither operand is a string", "1", "2"],
      ["only the left operand is a string", "str1", "5"],
      ["only the right operand is a string", "5", "str2"],
    ])("returns null when %s", (_label, left, right) => {
      expect(
        StringOperationsHelper.getStringConcatOperands(left, right, state),
      ).toBeNull();
    });
  });

  // ========================================================================
  // getSubstringOperands
  // ========================================================================

  describe("getSubstringOperands", () => {
    beforeEach(() => {
      declareString("myStr", 64);
    });

    it("keeps both generated indexes for the [start, length] form", () => {
      expect(
        StringOperationsHelper.getSubstringOperands(
          "myStr",
          () => ["0", "5"],
          state,
        ),
      ).toEqual({
        source: "myStr",
        start: "0",
        lengthExpression: "5",
        sourceCapacity: 64,
      });
    });

    it("gives the single-index form a length of 1 (issue #140)", () => {
      expect(
        StringOperationsHelper.getSubstringOperands(
          "myStr",
          () => ["3"],
          state,
        ),
      ).toEqual({
        source: "myStr",
        start: "3",
        lengthExpression: "1",
        sourceCapacity: 64,
      });
    });

    it("carries generated code through, not source text", () => {
      const ops = StringOperationsHelper.getSubstringOperands(
        "myStr",
        () => ["generated_idx", "generated_len"],
        state,
      );

      expect(ops).not.toBeNull();
      expect(ops!.start).toBe("generated_idx");
      expect(ops!.lengthExpression).toBe("generated_len");
    });

    it.each([
      ["a non-string variable", "myInt"],
      ["an undeclared name", "unknown"],
    ])("returns null for %s", (_label, sourceName) => {
      state.setVariableTypeInfo("myInt", {
        baseType: "u32",
        bitWidth: 32,
        isArray: false,
        arrayDimensions: [],
        isConst: false,
      });

      expect(
        StringOperationsHelper.getSubstringOperands(
          sourceName,
          () => ["0"],
          state,
        ),
      ).toBeNull();
    });

    /**
     * The ordering invariant, asserted rather than commented: generating an
     * index queues a pending temp declaration in some shapes, so one generated
     * for an expression that is not a substring after all leaks a declaration
     * nothing reads. Reordering the lookup reddens 0 of the 1254 integration
     * fixtures, which is why this test exists here.
     */
    it("does not generate the indexes when the source is not a string", () => {
      let generated = 0;

      const ops = StringOperationsHelper.getSubstringOperands(
        "notAString",
        () => {
          generated += 1;
          return ["0", "5"];
        },
        state,
      );

      expect(ops).toBeNull();
      expect(generated).toBe(0);
    });
  });
});
