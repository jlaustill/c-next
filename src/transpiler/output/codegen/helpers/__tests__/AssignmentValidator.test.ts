import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import AssignmentValidator from "../AssignmentValidator.js";
import TypeValidator from "../../TypeValidator.js";
import EnumAssignmentValidator from "../EnumAssignmentValidator.js";
import CNextSourceParser from "../../../../logic/parser/CNextSourceParser.js";
import CodeGenState from "../../../../state/CodeGenState.js";

/**
 * Create a mock assignment target context by parsing a minimal assignment statement.
 */
function parseAssignment(target: string) {
  const source = `void test() { ${target} <- 0; }`;
  const { tree } = CNextSourceParser.parse(source);
  const decl = tree.declaration(0);
  const func = decl!.functionDeclaration();
  const block = func!.block();
  const stmt = block!.statement(0)!;
  const assignStmt = stmt.assignmentStatement()!;
  return {
    target: assignStmt.assignmentTarget(),
    expression: assignStmt.expression(),
  };
}

/**
 * Default callbacks for testing.
 */
const defaultCallbacks = {
  getExpressionType: () => null,
  tryEvaluateConstant: () => undefined,
  isCallbackTypeUsedAsFieldType: () => false,
};

/**
 * Helper to set up CodeGenState.symbols with minimal fields.
 */
function setupSymbols(
  overrides: {
    registerMemberAccess?: Map<string, string>;
  } = {},
): void {
  CodeGenState.symbols = {
    knownScopes: new Set(),
    knownStructs: new Set(),
    knownRegisters: new Set(),
    knownEnums: new Set(),
    knownBitmaps: new Set(),
    scopeMembers: new Map(),
    scopeMemberVisibility: new Map(),
    structFields: new Map(),
    structFieldArrays: new Map(),
    structFieldDimensions: new Map(),
    enumMembers: new Map(),
    bitmapFields: new Map(),
    bitmapBackingType: new Map(),
    bitmapBitWidth: new Map(),
    scopedRegisters: new Map(),
    registerMemberAccess: overrides.registerMemberAccess ?? new Map(),
    registerMemberTypes: new Map(),
    registerBaseAddresses: new Map(),
    registerMemberOffsets: new Map(),
    registerMemberCTypes: new Map(),
    scopeVariableUsage: new Map(),
    scopePrivateConstValues: new Map(),
    functionReturnTypes: new Map(),
    getSingleFunctionForVariable: () => null,
    hasPublicSymbols: () => false,
  };
}

describe("AssignmentValidator", () => {
  beforeEach(() => {
    vi.spyOn(TypeValidator, "checkConstAssignment").mockReturnValue(null);
    vi.spyOn(TypeValidator, "checkArrayBounds").mockImplementation(() => {});
    vi.spyOn(TypeValidator, "validateIntegerAssignment").mockImplementation(
      () => {},
    );
    vi.spyOn(TypeValidator, "validateCallbackAssignment").mockImplementation(
      () => {},
    );
    vi.spyOn(
      EnumAssignmentValidator,
      "validateEnumAssignment",
    ).mockImplementation(() => {});

    CodeGenState.reset();
    setupSymbols();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("validate() - simple identifier", () => {
    it("should check const assignment for simple identifier", () => {
      const { target, expression } = parseAssignment("counter");

      AssignmentValidator.validate(
        target,
        expression,
        false,
        1,
        defaultCallbacks,
      );

      expect(TypeValidator.checkConstAssignment).toHaveBeenCalledWith(
        "counter",
      );
    });

    it("should throw when assigning to const variable", () => {
      vi.mocked(TypeValidator.checkConstAssignment).mockReturnValue(
        "cannot assign to const variable 'x'",
      );
      const { target, expression } = parseAssignment("x");

      expect(() =>
        AssignmentValidator.validate(
          target,
          expression,
          false,
          1,
          defaultCallbacks,
        ),
      ).toThrow("cannot assign to const variable 'x'");
    });

    it("should invalidate float shadow on assignment", () => {
      CodeGenState.floatShadowCurrent.add("__bits_myFloat");
      const { target, expression } = parseAssignment("myFloat");

      AssignmentValidator.validate(
        target,
        expression,
        false,
        1,
        defaultCallbacks,
      );

      expect(CodeGenState.floatShadowCurrent.has("__bits_myFloat")).toBe(false);
    });

    it("should validate enum assignment for enum-typed variable", () => {
      CodeGenState.typeRegistry.set("status", {
        baseType: "Status",
        bitWidth: 8,
        isArray: false,
        isConst: false,
        isEnum: true,
        enumTypeName: "Status",
      });
      const { target, expression } = parseAssignment("status");

      AssignmentValidator.validate(
        target,
        expression,
        false,
        1,
        defaultCallbacks,
      );

      expect(
        EnumAssignmentValidator.validateEnumAssignment,
      ).toHaveBeenCalledWith("Status", expression);
    });

    it("should validate integer assignment for integer-typed variable", () => {
      CodeGenState.typeRegistry.set("counter", {
        baseType: "u32",
        bitWidth: 32,
        isArray: false,
        isConst: false,
      });
      const { target, expression } = parseAssignment("counter");

      AssignmentValidator.validate(
        target,
        expression,
        false,
        1,
        defaultCallbacks,
      );

      expect(TypeValidator.validateIntegerAssignment).toHaveBeenCalledWith(
        "u32",
        expect.any(String),
        null,
        false,
      );
    });

    it("should pass isCompound flag to integer validation", () => {
      CodeGenState.typeRegistry.set("counter", {
        baseType: "u32",
        bitWidth: 32,
        isArray: false,
        isConst: false,
      });
      const { target, expression } = parseAssignment("counter");

      AssignmentValidator.validate(
        target,
        expression,
        true,
        1,
        defaultCallbacks,
      );

      expect(TypeValidator.validateIntegerAssignment).toHaveBeenCalledWith(
        "u32",
        expect.any(String),
        null,
        true,
      );
    });

    it("should rethrow validation error with line:column prefix", () => {
      CodeGenState.typeRegistry.set("counter", {
        baseType: "u8",
        bitWidth: 8,
        isArray: false,
        isConst: false,
      });
      vi.mocked(TypeValidator.validateIntegerAssignment).mockImplementation(
        () => {
          throw new Error("Error: Cannot assign u32 to u8 (narrowing)");
        },
      );
      const { target, expression } = parseAssignment("counter");

      expect(() =>
        AssignmentValidator.validate(
          target,
          expression,
          false,
          1,
          defaultCallbacks,
        ),
      ).toThrow(/^\d+:\d+ Error: Cannot assign u32 to u8 \(narrowing\)/);
    });

    it("should handle non-Error validation exceptions", () => {
      CodeGenState.typeRegistry.set("counter", {
        baseType: "u8",
        bitWidth: 8,
        isArray: false,
        isConst: false,
      });
      vi.mocked(TypeValidator.validateIntegerAssignment).mockImplementation(
        () => {
          throw "string error";
        },
      );
      const { target, expression } = parseAssignment("counter");

      expect(() =>
        AssignmentValidator.validate(
          target,
          expression,
          false,
          1,
          defaultCallbacks,
        ),
      ).toThrow(/^\d+:\d+ string error/);
    });
  });

  describe("validate() - array element", () => {
    it("should check const assignment for array", () => {
      const { target, expression } = parseAssignment("arr[0]");

      AssignmentValidator.validate(
        target,
        expression,
        false,
        1,
        defaultCallbacks,
      );

      expect(TypeValidator.checkConstAssignment).toHaveBeenCalledWith("arr");
    });

    it("should throw with 'array element' suffix for const array", () => {
      vi.mocked(TypeValidator.checkConstAssignment).mockReturnValue(
        "cannot assign to const variable 'arr'",
      );
      const { target, expression } = parseAssignment("arr[0]");

      expect(() =>
        AssignmentValidator.validate(
          target,
          expression,
          false,
          1,
          defaultCallbacks,
        ),
      ).toThrow("cannot assign to const variable 'arr' (array element)");
    });

    it("should check array bounds for array with dimensions", () => {
      CodeGenState.typeRegistry.set("arr", {
        baseType: "u8",
        bitWidth: 8,
        isConst: false,
        isArray: true,
        arrayDimensions: [10],
      });
      const { target, expression } = parseAssignment("arr[0]");

      AssignmentValidator.validate(
        target,
        expression,
        false,
        5,
        defaultCallbacks,
      );

      expect(TypeValidator.checkArrayBounds).toHaveBeenCalledWith(
        "arr",
        [10],
        expect.anything(),
        5,
        expect.any(Function),
      );
    });
  });

  describe("validate() - member access", () => {
    it("should check const assignment for struct root", () => {
      const { target, expression } = parseAssignment("config.value");

      AssignmentValidator.validate(
        target,
        expression,
        false,
        1,
        defaultCallbacks,
      );

      expect(TypeValidator.checkConstAssignment).toHaveBeenCalledWith("config");
    });

    it("should throw with 'member access' suffix for const struct", () => {
      vi.mocked(TypeValidator.checkConstAssignment).mockReturnValue(
        "cannot assign to const variable 'config'",
      );
      const { target, expression } = parseAssignment("config.value");

      expect(() =>
        AssignmentValidator.validate(
          target,
          expression,
          false,
          1,
          defaultCallbacks,
        ),
      ).toThrow("cannot assign to const variable 'config' (member access)");
    });

    it("should throw for read-only register member", () => {
      const registerMemberAccess = new Map([["GPIO_PIN", "ro"]]);
      setupSymbols({ registerMemberAccess });
      const { target, expression } = parseAssignment("GPIO.PIN");

      expect(() =>
        AssignmentValidator.validate(
          target,
          expression,
          false,
          1,
          defaultCallbacks,
        ),
      ).toThrow("cannot assign to read-only register member 'PIN'");
    });

    it("should validate callback assignment for callback field", () => {
      CodeGenState.typeRegistry.set("handler", {
        baseType: "Handler",
        bitWidth: 0,
        isArray: false,
        isConst: false,
      });
      CodeGenState.callbackFieldTypes.set("Handler.onEvent", "EventCallback");
      // Mark Handler as a known struct
      if (CodeGenState.symbols) {
        (CodeGenState.symbols.knownStructs as Set<string>).add("Handler");
      }

      const { target, expression } = parseAssignment("handler.onEvent");

      AssignmentValidator.validate(
        target,
        expression,
        false,
        1,
        defaultCallbacks,
      );

      expect(TypeValidator.validateCallbackAssignment).toHaveBeenCalledWith(
        "EventCallback",
        expression,
        "onEvent",
        expect.any(Function),
      );
    });
  });
});
