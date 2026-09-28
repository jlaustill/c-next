/**
 * Unit tests for CppModeHelper
 * Issue #644: C/C++ mode pattern consolidation
 */

import { describe, it, expect, beforeEach } from "vitest";
import CppModeHelper from "../CppModeHelper";
import TranspileState from "../../../../TranspileState";

let state = new TranspileState();

describe("CppModeHelper", () => {
  beforeEach(() => {
    state = new TranspileState();
  });

  describe("C mode (cppMode: false)", () => {
    beforeEach(() => {
      state.cppMode = false;
    });

    it("maybeAddressOf adds & prefix", () => {
      expect(CppModeHelper.maybeAddressOf("expr", state)).toBe("&expr");
      expect(CppModeHelper.maybeAddressOf("foo.bar", state)).toBe("&foo.bar");
    });

    it("maybeDereference wraps in (*...)", () => {
      expect(CppModeHelper.maybeDereference("ptr", state)).toBe("(*ptr)");
      expect(CppModeHelper.maybeDereference("param", state)).toBe("(*param)");
    });

    it("refOrPtr returns *", () => {
      expect(CppModeHelper.refOrPtr(state)).toBe("*");
    });

    it("nullLiteral returns NULL", () => {
      expect(CppModeHelper.nullLiteral(state)).toBe("NULL");
    });

    it("cast returns C-style cast", () => {
      expect(CppModeHelper.cast("int", "x", state)).toBe("(int)x");
      expect(CppModeHelper.cast("uint8_t", "value", state)).toBe(
        "(uint8_t)value",
      );
    });

    // #1760 review: `(float)x << 1` shifted a float, which C rejects
    it.each([
      ["a shift", "x << 1U", "(float)(x << 1U)"],
      ["a ternary", "c ? a : b", "(float)(c ? a : b)"],
      ["a value", "x", "(float)x"],
      ["a unary operator", "-y", "(float)-y"],
      ["a call's arguments", "f(a, b + 1)", "(float)f(a, b + 1)"],
      ["a parenthesized operand", "(a + b)", "(float)(a + b)"],
      ["a subscript", "arr[i + 1]", "(float)arr[i + 1]"],
      ["a literal's space", "g(\"a b\", ' ')", "(float)g(\"a b\", ' ')"],
    ])("casts the whole of %s", (_label, expr, expected) => {
      expect(CppModeHelper.cast("float", expr, state)).toBe(expected);
    });

    it("reinterpretCast casts the whole of an expression too", () => {
      expect(CppModeHelper.reinterpretCast("char*", "p + 1", state)).toBe(
        "(char*)(p + 1)",
      );
    });

    it("reinterpretCast returns C-style cast", () => {
      expect(CppModeHelper.reinterpretCast("char*", "ptr", state)).toBe(
        "(char*)ptr",
      );
      expect(CppModeHelper.reinterpretCast("uint8_t*", "buf", state)).toBe(
        "(uint8_t*)buf",
      );
    });
  });

  describe("C++ mode (cppMode: true)", () => {
    beforeEach(() => {
      state.cppMode = true;
    });

    it("maybeAddressOf returns expr unchanged", () => {
      expect(CppModeHelper.maybeAddressOf("expr", state)).toBe("expr");
      expect(CppModeHelper.maybeAddressOf("foo.bar", state)).toBe("foo.bar");
    });

    it("maybeDereference returns expr unchanged", () => {
      expect(CppModeHelper.maybeDereference("ptr", state)).toBe("ptr");
      expect(CppModeHelper.maybeDereference("param", state)).toBe("param");
    });

    it("refOrPtr returns &", () => {
      expect(CppModeHelper.refOrPtr(state)).toBe("&");
    });

    it("nullLiteral returns nullptr", () => {
      expect(CppModeHelper.nullLiteral(state)).toBe("nullptr");
    });

    it("cast returns static_cast", () => {
      expect(CppModeHelper.cast("int", "x", state)).toBe("static_cast<int>(x)");
      expect(CppModeHelper.cast("uint8_t", "value", state)).toBe(
        "static_cast<uint8_t>(value)",
      );
    });

    it("reinterpretCast returns reinterpret_cast", () => {
      expect(CppModeHelper.reinterpretCast("char*", "ptr", state)).toBe(
        "reinterpret_cast<char*>(ptr)",
      );
      expect(CppModeHelper.reinterpretCast("uint8_t*", "buf", state)).toBe(
        "reinterpret_cast<uint8_t*>(buf)",
      );
    });
  });

  describe("edge cases", () => {
    it("handles expressions with special characters in C mode", () => {
      state.cppMode = false;

      // Parenthesized expressions
      expect(CppModeHelper.maybeAddressOf("(a + b)", state)).toBe("&(a + b)");

      // Array access
      expect(CppModeHelper.maybeDereference("arr[0]", state)).toBe("(*arr[0])");
    });

    it("handles expressions with special characters in C++ mode", () => {
      state.cppMode = true;

      // Parenthesized expressions
      expect(CppModeHelper.maybeAddressOf("(a + b)", state)).toBe("(a + b)");

      // Array access
      expect(CppModeHelper.maybeDereference("arr[0]", state)).toBe("arr[0]");
    });

    it("handles complex type casts in C mode", () => {
      state.cppMode = false;

      // Pointer to pointer
      expect(CppModeHelper.cast("int**", "ptr", state)).toBe("(int**)ptr");

      // Const types
      expect(CppModeHelper.reinterpretCast("const char*", "str", state)).toBe(
        "(const char*)str",
      );
    });

    it("handles complex type casts in C++ mode", () => {
      state.cppMode = true;

      // Pointer to pointer
      expect(CppModeHelper.cast("int**", "ptr", state)).toBe(
        "static_cast<int**>(ptr)",
      );

      // Const types
      expect(CppModeHelper.reinterpretCast("const char*", "str", state)).toBe(
        "reinterpret_cast<const char*>(str)",
      );
    });
  });
});
