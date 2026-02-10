/**
 * Unit tests for CppModeHelper
 * Issue #644: C/C++ mode pattern consolidation
 */

import { describe, it, expect, beforeEach } from "vitest";
import CppModeHelper from "../CppModeHelper";
import CodeGenState from "../../CodeGenState";

describe("CppModeHelper", () => {
  beforeEach(() => {
    CodeGenState.reset();
  });

  describe("C mode (cppMode: false)", () => {
    beforeEach(() => {
      CodeGenState.cppMode = false;
    });

    it("maybeAddressOf adds & prefix", () => {
      expect(CppModeHelper.maybeAddressOf("expr")).toBe("&expr");
      expect(CppModeHelper.maybeAddressOf("foo.bar")).toBe("&foo.bar");
    });

    it("maybeDereference wraps in (*...)", () => {
      expect(CppModeHelper.maybeDereference("ptr")).toBe("(*ptr)");
      expect(CppModeHelper.maybeDereference("param")).toBe("(*param)");
    });

    it("refOrPtr returns *", () => {
      expect(CppModeHelper.refOrPtr()).toBe("*");
    });

    it("memberSeparator returns ->", () => {
      expect(CppModeHelper.memberSeparator()).toBe("->");
    });

    it("nullLiteral returns NULL", () => {
      expect(CppModeHelper.nullLiteral()).toBe("NULL");
    });

    it("cast returns C-style cast", () => {
      expect(CppModeHelper.cast("int", "x")).toBe("(int)x");
      expect(CppModeHelper.cast("uint8_t", "value")).toBe("(uint8_t)value");
    });

    it("reinterpretCast returns C-style cast", () => {
      expect(CppModeHelper.reinterpretCast("char*", "ptr")).toBe("(char*)ptr");
      expect(CppModeHelper.reinterpretCast("uint8_t*", "buf")).toBe(
        "(uint8_t*)buf",
      );
    });

    it("isCppMode returns false", () => {
      expect(CppModeHelper.isCppMode()).toBe(false);
    });
  });

  describe("C++ mode (cppMode: true)", () => {
    beforeEach(() => {
      CodeGenState.cppMode = true;
    });

    it("maybeAddressOf returns expr unchanged", () => {
      expect(CppModeHelper.maybeAddressOf("expr")).toBe("expr");
      expect(CppModeHelper.maybeAddressOf("foo.bar")).toBe("foo.bar");
    });

    it("maybeDereference returns expr unchanged", () => {
      expect(CppModeHelper.maybeDereference("ptr")).toBe("ptr");
      expect(CppModeHelper.maybeDereference("param")).toBe("param");
    });

    it("refOrPtr returns &", () => {
      expect(CppModeHelper.refOrPtr()).toBe("&");
    });

    it("memberSeparator returns .", () => {
      expect(CppModeHelper.memberSeparator()).toBe(".");
    });

    it("nullLiteral returns nullptr", () => {
      expect(CppModeHelper.nullLiteral()).toBe("nullptr");
    });

    it("cast returns static_cast", () => {
      expect(CppModeHelper.cast("int", "x")).toBe("static_cast<int>(x)");
      expect(CppModeHelper.cast("uint8_t", "value")).toBe(
        "static_cast<uint8_t>(value)",
      );
    });

    it("reinterpretCast returns reinterpret_cast", () => {
      expect(CppModeHelper.reinterpretCast("char*", "ptr")).toBe(
        "reinterpret_cast<char*>(ptr)",
      );
      expect(CppModeHelper.reinterpretCast("uint8_t*", "buf")).toBe(
        "reinterpret_cast<uint8_t*>(buf)",
      );
    });

    it("isCppMode returns true", () => {
      expect(CppModeHelper.isCppMode()).toBe(true);
    });
  });

  describe("edge cases", () => {
    it("handles expressions with special characters in C mode", () => {
      CodeGenState.cppMode = false;

      // Parenthesized expressions
      expect(CppModeHelper.maybeAddressOf("(a + b)")).toBe("&(a + b)");

      // Array access
      expect(CppModeHelper.maybeDereference("arr[0]")).toBe("(*arr[0])");
    });

    it("handles expressions with special characters in C++ mode", () => {
      CodeGenState.cppMode = true;

      // Parenthesized expressions
      expect(CppModeHelper.maybeAddressOf("(a + b)")).toBe("(a + b)");

      // Array access
      expect(CppModeHelper.maybeDereference("arr[0]")).toBe("arr[0]");
    });

    it("handles complex type casts in C mode", () => {
      CodeGenState.cppMode = false;

      // Pointer to pointer
      expect(CppModeHelper.cast("int**", "ptr")).toBe("(int**)ptr");

      // Const types
      expect(CppModeHelper.reinterpretCast("const char*", "str")).toBe(
        "(const char*)str",
      );
    });

    it("handles complex type casts in C++ mode", () => {
      CodeGenState.cppMode = true;

      // Pointer to pointer
      expect(CppModeHelper.cast("int**", "ptr")).toBe(
        "static_cast<int**>(ptr)",
      );

      // Const types
      expect(CppModeHelper.reinterpretCast("const char*", "str")).toBe(
        "reinterpret_cast<const char*>(str)",
      );
    });
  });
});
