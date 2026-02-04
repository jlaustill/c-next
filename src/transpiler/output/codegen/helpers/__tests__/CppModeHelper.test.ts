/**
 * Unit tests for CppModeHelper
 * Issue #644: C/C++ mode pattern consolidation
 */

import { describe, it, expect } from "vitest";
import CppModeHelper from "../CppModeHelper";

describe("CppModeHelper", () => {
  describe("C mode (cppMode: false)", () => {
    const helper = new CppModeHelper({ cppMode: false });

    it("maybeAddressOf adds & prefix", () => {
      expect(helper.maybeAddressOf("expr")).toBe("&expr");
      expect(helper.maybeAddressOf("foo.bar")).toBe("&foo.bar");
    });

    it("maybeDereference wraps in (*...)", () => {
      expect(helper.maybeDereference("ptr")).toBe("(*ptr)");
      expect(helper.maybeDereference("param")).toBe("(*param)");
    });

    it("refOrPtr returns *", () => {
      expect(helper.refOrPtr()).toBe("*");
    });

    it("memberSeparator returns ->", () => {
      expect(helper.memberSeparator()).toBe("->");
    });

    it("nullLiteral returns NULL", () => {
      expect(helper.nullLiteral()).toBe("NULL");
    });

    it("cast returns C-style cast", () => {
      expect(helper.cast("int", "x")).toBe("(int)x");
      expect(helper.cast("uint8_t", "value")).toBe("(uint8_t)value");
    });

    it("reinterpretCast returns C-style cast", () => {
      expect(helper.reinterpretCast("char*", "ptr")).toBe("(char*)ptr");
      expect(helper.reinterpretCast("uint8_t*", "buf")).toBe("(uint8_t*)buf");
    });

    it("isCppMode returns false", () => {
      expect(helper.isCppMode()).toBe(false);
    });
  });

  describe("C++ mode (cppMode: true)", () => {
    const helper = new CppModeHelper({ cppMode: true });

    it("maybeAddressOf returns expr unchanged", () => {
      expect(helper.maybeAddressOf("expr")).toBe("expr");
      expect(helper.maybeAddressOf("foo.bar")).toBe("foo.bar");
    });

    it("maybeDereference returns expr unchanged", () => {
      expect(helper.maybeDereference("ptr")).toBe("ptr");
      expect(helper.maybeDereference("param")).toBe("param");
    });

    it("refOrPtr returns &", () => {
      expect(helper.refOrPtr()).toBe("&");
    });

    it("memberSeparator returns .", () => {
      expect(helper.memberSeparator()).toBe(".");
    });

    it("nullLiteral returns nullptr", () => {
      expect(helper.nullLiteral()).toBe("nullptr");
    });

    it("cast returns static_cast", () => {
      expect(helper.cast("int", "x")).toBe("static_cast<int>(x)");
      expect(helper.cast("uint8_t", "value")).toBe(
        "static_cast<uint8_t>(value)",
      );
    });

    it("reinterpretCast returns reinterpret_cast", () => {
      expect(helper.reinterpretCast("char*", "ptr")).toBe(
        "reinterpret_cast<char*>(ptr)",
      );
      expect(helper.reinterpretCast("uint8_t*", "buf")).toBe(
        "reinterpret_cast<uint8_t*>(buf)",
      );
    });

    it("isCppMode returns true", () => {
      expect(helper.isCppMode()).toBe(true);
    });
  });

  describe("edge cases", () => {
    it("handles expressions with special characters", () => {
      const cHelper = new CppModeHelper({ cppMode: false });
      const cppHelper = new CppModeHelper({ cppMode: true });

      // Parenthesized expressions
      expect(cHelper.maybeAddressOf("(a + b)")).toBe("&(a + b)");
      expect(cppHelper.maybeAddressOf("(a + b)")).toBe("(a + b)");

      // Array access
      expect(cHelper.maybeDereference("arr[0]")).toBe("(*arr[0])");
      expect(cppHelper.maybeDereference("arr[0]")).toBe("arr[0]");
    });

    it("handles complex type casts", () => {
      const cHelper = new CppModeHelper({ cppMode: false });
      const cppHelper = new CppModeHelper({ cppMode: true });

      // Pointer to pointer
      expect(cHelper.cast("int**", "ptr")).toBe("(int**)ptr");
      expect(cppHelper.cast("int**", "ptr")).toBe("static_cast<int**>(ptr)");

      // Const types
      expect(cHelper.reinterpretCast("const char*", "str")).toBe(
        "(const char*)str",
      );
      expect(cppHelper.reinterpretCast("const char*", "str")).toBe(
        "reinterpret_cast<const char*>(str)",
      );
    });
  });
});
