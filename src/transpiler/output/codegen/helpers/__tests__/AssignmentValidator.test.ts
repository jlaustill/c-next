import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import AssignmentValidator from "../AssignmentValidator.js";
import TypeValidator from "../../TypeValidator.js";
import EnumAssignmentValidator from "../EnumAssignmentValidator.js";
import CNextSourceParser from "../../../../logic/parser/CNextSourceParser.js";

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

describe("AssignmentValidator", () => {
  let typeRegistry: Map<
    string,
    {
      baseType: string;
      bitWidth: number;
      isArray: boolean;
      isConst: boolean;
      isEnum?: boolean;
      enumTypeName?: string;
      arrayDimensions?: number[];
    }
  >;
  let floatShadowCurrent: Set<string>;
  let registerMemberAccess: Map<string, string>;
  let callbackFieldTypes: Map<string, string>;
  let validator: AssignmentValidator;

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

    typeRegistry = new Map();
    floatShadowCurrent = new Set();
    registerMemberAccess = new Map();
    callbackFieldTypes = new Map();

    validator = new AssignmentValidator({
      typeRegistry,
      floatShadowCurrent,
      registerMemberAccess,
      callbackFieldTypes,
      isKnownStruct: () => false,
      isIntegerType: (t) => t.startsWith("u") || t.startsWith("i"),
      getExpressionType: () => null,
      tryEvaluateConstant: () => undefined,
      isCallbackTypeUsedAsFieldType: () => false,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("validate() - simple identifier", () => {
    it("should check const assignment for simple identifier", () => {
      const { target, expression } = parseAssignment("counter");

      validator.validate(target, expression, false, 1);

      expect(TypeValidator.checkConstAssignment).toHaveBeenCalledWith(
        "counter",
      );
    });

    it("should throw when assigning to const variable", () => {
      vi.mocked(TypeValidator.checkConstAssignment).mockReturnValue(
        "cannot assign to const variable 'x'",
      );
      const { target, expression } = parseAssignment("x");

      expect(() => validator.validate(target, expression, false, 1)).toThrow(
        "cannot assign to const variable 'x'",
      );
    });

    it("should invalidate float shadow on assignment", () => {
      floatShadowCurrent.add("__bits_myFloat");
      const { target, expression } = parseAssignment("myFloat");

      validator.validate(target, expression, false, 1);

      expect(floatShadowCurrent.has("__bits_myFloat")).toBe(false);
    });

    it("should validate enum assignment for enum-typed variable", () => {
      typeRegistry.set("status", {
        baseType: "Status",
        bitWidth: 8,
        isArray: false,
        isConst: false,
        isEnum: true,
        enumTypeName: "Status",
      });
      const { target, expression } = parseAssignment("status");

      validator.validate(target, expression, false, 1);

      expect(
        EnumAssignmentValidator.validateEnumAssignment,
      ).toHaveBeenCalledWith("Status", expression);
    });

    it("should validate integer assignment for integer-typed variable", () => {
      typeRegistry.set("counter", {
        baseType: "u32",
        bitWidth: 32,
        isArray: false,
        isConst: false,
      });
      const { target, expression } = parseAssignment("counter");

      validator.validate(target, expression, false, 1);

      expect(TypeValidator.validateIntegerAssignment).toHaveBeenCalledWith(
        "u32",
        expect.any(String),
        null,
        false,
      );
    });

    it("should pass isCompound flag to integer validation", () => {
      typeRegistry.set("counter", {
        baseType: "u32",
        bitWidth: 32,
        isArray: false,
        isConst: false,
      });
      const { target, expression } = parseAssignment("counter");

      validator.validate(target, expression, true, 1);

      expect(TypeValidator.validateIntegerAssignment).toHaveBeenCalledWith(
        "u32",
        expect.any(String),
        null,
        true,
      );
    });

    it("should rethrow validation error with line:column prefix", () => {
      typeRegistry.set("counter", {
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

      expect(() => validator.validate(target, expression, false, 1)).toThrow(
        /^\d+:\d+ Error: Cannot assign u32 to u8 \(narrowing\)/,
      );
    });

    it("should handle non-Error validation exceptions", () => {
      typeRegistry.set("counter", {
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

      expect(() => validator.validate(target, expression, false, 1)).toThrow(
        /^\d+:\d+ string error/,
      );
    });
  });

  describe("validate() - array element", () => {
    it("should check const assignment for array", () => {
      const { target, expression } = parseAssignment("arr[0]");

      validator.validate(target, expression, false, 1);

      expect(TypeValidator.checkConstAssignment).toHaveBeenCalledWith("arr");
    });

    it("should throw with 'array element' suffix for const array", () => {
      vi.mocked(TypeValidator.checkConstAssignment).mockReturnValue(
        "cannot assign to const variable 'arr'",
      );
      const { target, expression } = parseAssignment("arr[0]");

      expect(() => validator.validate(target, expression, false, 1)).toThrow(
        "cannot assign to const variable 'arr' (array element)",
      );
    });

    it("should check array bounds for array with dimensions", () => {
      typeRegistry.set("arr", {
        baseType: "u8",
        bitWidth: 8,
        isConst: false,
        isArray: true,
        arrayDimensions: [10],
      });
      const { target, expression } = parseAssignment("arr[0]");

      validator.validate(target, expression, false, 5);

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

      validator.validate(target, expression, false, 1);

      expect(TypeValidator.checkConstAssignment).toHaveBeenCalledWith("config");
    });

    it("should throw with 'member access' suffix for const struct", () => {
      vi.mocked(TypeValidator.checkConstAssignment).mockReturnValue(
        "cannot assign to const variable 'config'",
      );
      const { target, expression } = parseAssignment("config.value");

      expect(() => validator.validate(target, expression, false, 1)).toThrow(
        "cannot assign to const variable 'config' (member access)",
      );
    });

    it("should throw for read-only register member", () => {
      registerMemberAccess.set("GPIO_PIN", "ro");
      const { target, expression } = parseAssignment("GPIO.PIN");

      expect(() => validator.validate(target, expression, false, 1)).toThrow(
        "cannot assign to read-only register member 'PIN'",
      );
    });

    it("should validate callback assignment for callback field", () => {
      typeRegistry.set("handler", {
        baseType: "Handler",
        bitWidth: 0,
        isArray: false,
        isConst: false,
      });
      callbackFieldTypes.set("Handler.onEvent", "EventCallback");

      const validatorWithStruct = new AssignmentValidator({
        typeRegistry,
        floatShadowCurrent,
        registerMemberAccess,
        callbackFieldTypes,
        isKnownStruct: (name) => name === "Handler",
        isIntegerType: () => false,
        getExpressionType: () => null,
        tryEvaluateConstant: () => undefined,
        isCallbackTypeUsedAsFieldType: () => false,
      });

      const { target, expression } = parseAssignment("handler.onEvent");

      validatorWithStruct.validate(target, expression, false, 1);

      expect(TypeValidator.validateCallbackAssignment).toHaveBeenCalledWith(
        "EventCallback",
        expression,
        "onEvent",
        expect.any(Function),
      );
    });
  });
});
