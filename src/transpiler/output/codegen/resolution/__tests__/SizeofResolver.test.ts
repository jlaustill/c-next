/**
 * Tests for SizeofResolver - sizeof expression generation
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import SizeofResolver from "../SizeofResolver";
import CodeGenState from "../../../../state/CodeGenState";

describe("SizeofResolver", () => {
  beforeEach(() => {
    CodeGenState.reset();
  });

  describe("sizeofParameter", () => {
    it("throws E0601 for array parameter", () => {
      // Set up parameter info indicating array
      CodeGenState.currentParameters.set("arr", {
        name: "arr",
        baseType: "u32",
        isArray: true,
        isStruct: false,
        isConst: false,
        isCallback: false,
        isString: false,
      });

      const mockCallbacks = {
        generateType: vi.fn(),
        generateExpression: vi.fn(),
        hasSideEffects: vi.fn().mockReturnValue(false),
      };

      // Create a mock context for sizeof(arr)
      const mockTypeCtx = {
        qualifiedType: () => null,
        userType: () => ({ getText: () => "arr" }),
        getText: () => "arr",
      };

      const mockCtx = {
        type: () => mockTypeCtx,
        expression: () => null,
      };

      expect(() =>
        SizeofResolver.generate(mockCtx as never, mockCallbacks),
      ).toThrow("Error[E0601]");
    });

    it("generates dereference for pass-by-reference parameter", () => {
      // Non-array, non-callback, non-struct parameter is pass-by-reference
      CodeGenState.currentParameters.set("value", {
        name: "value",
        baseType: "u32",
        isArray: false,
        isStruct: false,
        isConst: false,
        isCallback: false,
        isString: false,
      });

      const mockCallbacks = {
        generateType: vi.fn(),
        generateExpression: vi.fn(),
        hasSideEffects: vi.fn().mockReturnValue(false),
      };

      const mockTypeCtx = {
        qualifiedType: () => null,
        userType: () => ({ getText: () => "value" }),
        getText: () => "value",
      };

      const mockCtx = {
        type: () => mockTypeCtx,
        expression: () => null,
      };

      const result = SizeofResolver.generate(mockCtx as never, mockCallbacks);

      expect(result).toBe("sizeof(*value)");
    });
  });

  describe("sizeofQualifiedType", () => {
    it("handles struct.member access for local variable", () => {
      CodeGenState.localVariables.add("myStruct");

      const mockCallbacks = {
        generateType: vi.fn(),
        generateExpression: vi.fn(),
        hasSideEffects: vi.fn().mockReturnValue(false),
      };

      const mockQualifiedCtx = {
        IDENTIFIER: () => [
          { getText: () => "myStruct" },
          { getText: () => "field" },
        ],
      };

      const mockTypeCtx = {
        qualifiedType: () => mockQualifiedCtx,
        userType: () => null,
        getText: () => "myStruct.field",
      };

      const mockCtx = {
        type: () => mockTypeCtx,
        expression: () => null,
      };

      const result = SizeofResolver.generate(mockCtx as never, mockCallbacks);

      expect(result).toBe("sizeof(myStruct.field)");
    });

    it("handles struct parameter with arrow notation", () => {
      CodeGenState.currentParameters.set("param", {
        name: "param",
        baseType: "MyStruct",
        isArray: false,
        isStruct: true,
        isConst: false,
        isCallback: false,
        isString: false,
      });

      const mockCallbacks = {
        generateType: vi.fn(),
        generateExpression: vi.fn(),
        hasSideEffects: vi.fn().mockReturnValue(false),
      };

      const mockQualifiedCtx = {
        IDENTIFIER: () => [
          { getText: () => "param" },
          { getText: () => "field" },
        ],
      };

      const mockTypeCtx = {
        qualifiedType: () => mockQualifiedCtx,
        userType: () => null,
        getText: () => "param.field",
      };

      const mockCtx = {
        type: () => mockTypeCtx,
        expression: () => null,
      };

      const result = SizeofResolver.generate(mockCtx as never, mockCallbacks);

      expect(result).toBe("sizeof(param->field)");
    });

    it("handles non-struct parameter with dot notation", () => {
      CodeGenState.currentParameters.set("param", {
        name: "param",
        baseType: "MyStruct",
        isArray: false,
        isStruct: false,
        isConst: false,
        isCallback: false,
        isString: false,
      });

      const mockCallbacks = {
        generateType: vi.fn(),
        generateExpression: vi.fn(),
        hasSideEffects: vi.fn().mockReturnValue(false),
      };

      const mockQualifiedCtx = {
        IDENTIFIER: () => [
          { getText: () => "param" },
          { getText: () => "field" },
        ],
      };

      const mockTypeCtx = {
        qualifiedType: () => mockQualifiedCtx,
        userType: () => null,
        getText: () => "param.field",
      };

      const mockCtx = {
        type: () => mockTypeCtx,
        expression: () => null,
      };

      const result = SizeofResolver.generate(mockCtx as never, mockCallbacks);

      expect(result).toBe("sizeof(param.field)");
    });
  });

  // Note: sizeofExpression with side effects is tested via integration tests
  // The mock structure required is too complex for unit testing
});
