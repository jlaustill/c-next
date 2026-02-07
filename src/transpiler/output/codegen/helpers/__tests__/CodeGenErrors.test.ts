/**
 * Unit tests for CodeGenErrors utility.
 * Tests error message generation for code generation errors.
 */
import { describe, it, expect } from "vitest";
import CodeGenErrors from "../CodeGenErrors";

describe("CodeGenErrors", () => {
  describe("bitmapBracketIndexing", () => {
    it("should include line number in error message", () => {
      const error = CodeGenErrors.bitmapBracketIndexing(
        42,
        "StatusFlags",
        "flags",
      );
      expect(error.message).toContain("line 42");
    });

    it("should include bitmap type name", () => {
      const error = CodeGenErrors.bitmapBracketIndexing(
        1,
        "ConfigBits",
        "config",
      );
      expect(error.message).toContain("ConfigBits");
    });

    it("should include variable name in suggestion", () => {
      const error = CodeGenErrors.bitmapBracketIndexing(1, "Flags", "myFlags");
      expect(error.message).toContain("myFlags.FIELD_NAME");
    });

    it("should suggest using named field access", () => {
      const error = CodeGenErrors.bitmapBracketIndexing(10, "Bits", "b");
      expect(error.message).toContain("Use named field access instead");
    });
  });

  describe("floatBitIndexingAtGlobalScope", () => {
    it("should include variable name in error", () => {
      const error = CodeGenErrors.floatBitIndexingAtGlobalScope(
        "value",
        "0",
        "8",
      );
      expect(error.message).toContain("value");
    });

    it("should include start and width in error", () => {
      const error = CodeGenErrors.floatBitIndexingAtGlobalScope(
        "x",
        "16",
        "32",
      );
      expect(error.message).toContain("x[16, 32]");
    });

    it("should suggest moving to function scope", () => {
      const error = CodeGenErrors.floatBitIndexingAtGlobalScope("f", "0", "8");
      expect(error.message).toContain(
        "Move the initialization inside a function",
      );
    });

    it("should mention global scope limitation", () => {
      const error = CodeGenErrors.floatBitIndexingAtGlobalScope(
        "val",
        "8",
        "16",
      );
      expect(error.message).toContain("global scope");
    });
  });

  describe("scopedTypeOutsideScope", () => {
    it("should mention this.Type syntax", () => {
      const error = CodeGenErrors.scopedTypeOutsideScope();
      expect(error.message).toContain("this.Type");
    });

    it("should explain scope requirement", () => {
      const error = CodeGenErrors.scopedTypeOutsideScope();
      expect(error.message).toContain("inside a scope");
    });
  });

  describe("sizeofArrayParameter", () => {
    it("should include parameter name", () => {
      const error = CodeGenErrors.sizeofArrayParameter("data");
      expect(error.message).toContain("data");
    });

    it("should explain why sizeof fails on array params", () => {
      const error = CodeGenErrors.sizeofArrayParameter("arr");
      expect(error.message).toContain("passed as pointers");
      expect(error.message).toContain("pointer size");
    });

    it("should suggest passing size as separate parameter", () => {
      const error = CodeGenErrors.sizeofArrayParameter("buffer");
      expect(error.message).toContain(
        "Pass the array size as a separate parameter",
      );
    });
  });

  describe("missingTypeContext", () => {
    it("should include context description", () => {
      const error = CodeGenErrors.missingTypeContext("variable declaration");
      expect(error.message).toContain("variable declaration");
    });

    it("should be an Error instance", () => {
      const error = CodeGenErrors.missingTypeContext("parameter");
      expect(error).toBeInstanceOf(Error);
    });
  });

  describe("unsupportedSizeofExpression", () => {
    it("should include expression text", () => {
      const error = CodeGenErrors.unsupportedSizeofExpression("foo()");
      expect(error.message).toContain("foo()");
    });

    it("should explain what sizeof supports", () => {
      const error = CodeGenErrors.unsupportedSizeofExpression("complex.expr");
      expect(error.message).toContain(
        "types, variables, and simple expressions",
      );
    });
  });
});
