import { describe, it, expect, beforeEach } from "vitest";
import TypeValidator from "../TypeValidator";
import type ISymbolInfo from "../generators/ISymbolInfo";
import type TTypeInfo from "../types/TTypeInfo";

describe("TypeValidator.resolveBareIdentifier", () => {
  let mockSymbols: ISymbolInfo;
  let scopeMembers: Map<string, Set<string>>;
  let typeRegistry: Map<string, TTypeInfo>;
  let currentScope: string | null;

  beforeEach(() => {
    scopeMembers = new Map([["Motor", new Set(["speed", "maxSpeed"])]]);
    typeRegistry = new Map<string, TTypeInfo>([
      [
        "globalCounter",
        { baseType: "u32", bitWidth: 32, isArray: false, isConst: false },
      ],
      [
        "Motor_speed",
        { baseType: "u32", bitWidth: 32, isArray: false, isConst: false },
      ],
    ]);
    currentScope = "Motor";
    mockSymbols = {
      knownScopes: new Set(["Motor", "LED"]),
      knownRegisters: new Set(["GPIO"]),
      knownEnums: new Set(["State"]),
      knownStructs: new Set(["Point"]),
      knownBitmaps: new Set(),
      scopeMembers: new Map([["Motor", new Set(["speed", "maxSpeed"])]]),
      scopeMemberVisibility: new Map(),
      structFields: new Map(),
      structFieldArrays: new Map(),
      structFieldDimensions: new Map(),
      enumMembers: new Map(),
      bitmapFields: new Map(),
      bitmapBackingType: new Map(),
      bitmapBitWidth: new Map(),
      scopedRegisters: new Map(),
      registerMemberAccess: new Map(),
      registerMemberTypes: new Map(),
      registerBaseAddresses: new Map(),
      registerMemberOffsets: new Map(),
      registerMemberCTypes: new Map(),
      scopeVariableUsage: new Map(),
      scopePrivateConstValues: new Map(),
      functionReturnTypes: new Map(),
      getSingleFunctionForVariable: () => null,
      hasPublicSymbols: () => false,
    } as ISymbolInfo;
  });

  function createValidator(): TypeValidator {
    return new TypeValidator({
      symbols: mockSymbols,
      symbolTable: null,
      typeRegistry,
      typeResolver: {} as never,
      callbackTypes: new Map(),
      knownFunctions: new Set(["globalFunc", "Motor_stop"]),
      knownGlobals: new Set(["globalCounter"]),
      getCurrentScope: () => currentScope,
      getScopeMembers: () => scopeMembers,
      getCurrentParameters: () => new Map(),
      getLocalVariables: () => new Set(),
      resolveIdentifier: (name: string) => name,
      getExpressionType: () => null,
    });
  }

  describe("inside a scope", () => {
    it("returns null for local variables (no transformation needed)", () => {
      const validator = createValidator();
      const result = validator.resolveBareIdentifier(
        "localVar",
        true,
        () => false,
      );
      expect(result).toBeNull();
    });

    it("resolves scope member to prefixed name", () => {
      const validator = createValidator();
      const result = validator.resolveBareIdentifier(
        "speed",
        false,
        () => false,
      );
      expect(result).toBe("Motor_speed");
    });

    it("resolves global variable to itself", () => {
      const validator = createValidator();
      const result = validator.resolveBareIdentifier(
        "globalCounter",
        false,
        () => false,
      );
      expect(result).toBe("globalCounter");
    });

    it("resolves global function to itself", () => {
      const validator = createValidator();
      const result = validator.resolveBareIdentifier(
        "globalFunc",
        false,
        () => false,
      );
      expect(result).toBe("globalFunc");
    });

    it("resolves scope function to prefixed name", () => {
      const validator = createValidator();
      const result = validator.resolveBareIdentifier(
        "stop",
        false,
        () => false,
      );
      // 'stop' should check if Motor_stop exists as a function
      expect(result).toBe("Motor_stop");
    });
  });

  describe("outside a scope", () => {
    beforeEach(() => {
      currentScope = null;
    });

    it("returns null for local variables", () => {
      const validator = createValidator();
      const result = validator.resolveBareIdentifier(
        "localVar",
        true,
        () => false,
      );
      expect(result).toBeNull();
    });

    it("returns null for global variables (no transformation)", () => {
      const validator = createValidator();
      const result = validator.resolveBareIdentifier(
        "globalCounter",
        false,
        () => false,
      );
      expect(result).toBeNull();
    });
  });
});
