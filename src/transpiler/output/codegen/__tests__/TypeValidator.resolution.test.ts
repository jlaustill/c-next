import { describe, it, expect, beforeEach } from "vitest";
import TypeValidator from "../TypeValidator";
import CodeGenState from "../../../state/CodeGenState";
import type ICodeGenSymbols from "../../../types/ICodeGenSymbols";

describe("TypeValidator.resolveBareIdentifier", () => {
  const createMockSymbols = (
    overrides: Partial<ICodeGenSymbols> = {},
  ): ICodeGenSymbols =>
    ({
      knownScopes: new Set(),
      knownRegisters: new Set(),
      knownEnums: new Set(),
      knownStructs: new Set(),
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
      ...overrides,
    }) as ICodeGenSymbols;

  beforeEach(() => {
    CodeGenState.reset();
    CodeGenState.setScopeMembers("Motor", new Set(["speed", "maxSpeed"]));
    CodeGenState.typeRegistry.set("globalCounter", {
      baseType: "u32",
      bitWidth: 32,
      isArray: false,
      isConst: false,
    });
    CodeGenState.typeRegistry.set("Motor_speed", {
      baseType: "u32",
      bitWidth: 32,
      isArray: false,
      isConst: false,
    });
    CodeGenState.currentScope = "Motor";
    CodeGenState.symbols = createMockSymbols({
      knownScopes: new Set(["Motor", "LED"]),
      knownRegisters: new Set(["GPIO"]),
      knownEnums: new Set(["State"]),
      knownStructs: new Set(["Point"]),
      scopeMembers: new Map([["Motor", new Set(["speed", "maxSpeed"])]]),
    });
    CodeGenState.knownFunctions = new Set(["globalFunc", "Motor_stop"]);
  });

  describe("inside a scope", () => {
    it("returns null for local variables (no transformation needed)", () => {
      const result = TypeValidator.resolveBareIdentifier(
        "localVar",
        true,
        () => false,
      );
      expect(result).toBeNull();
    });

    it("resolves scope member to prefixed name", () => {
      const result = TypeValidator.resolveBareIdentifier(
        "speed",
        false,
        () => false,
      );
      expect(result).toBe("Motor_speed");
    });

    it("resolves global variable to itself", () => {
      const result = TypeValidator.resolveBareIdentifier(
        "globalCounter",
        false,
        () => false,
      );
      expect(result).toBe("globalCounter");
    });

    it("resolves global function to itself", () => {
      const result = TypeValidator.resolveBareIdentifier(
        "globalFunc",
        false,
        () => false,
      );
      expect(result).toBe("globalFunc");
    });

    it("resolves scope function to prefixed name", () => {
      const result = TypeValidator.resolveBareIdentifier(
        "stop",
        false,
        () => false,
      );
      // 'stop' should check if Motor_stop exists as a function
      expect(result).toBe("Motor_stop");
    });

    it("returns null for unknown identifiers", () => {
      const result = TypeValidator.resolveBareIdentifier(
        "unknownName",
        false,
        () => false,
      );
      expect(result).toBeNull();
    });
  });

  describe("outside a scope", () => {
    beforeEach(() => {
      CodeGenState.currentScope = null;
    });

    it("returns null for local variables", () => {
      const result = TypeValidator.resolveBareIdentifier(
        "localVar",
        true,
        () => false,
      );
      expect(result).toBeNull();
    });

    it("returns null for global variables (no transformation)", () => {
      const result = TypeValidator.resolveBareIdentifier(
        "globalCounter",
        false,
        () => false,
      );
      expect(result).toBeNull();
    });
  });

  describe("resolveForMemberAccess", () => {
    it("prefers scope name over global variable for member access", () => {
      // Setup: global variable 'LED' exists AND scope 'LED' exists
      CodeGenState.typeRegistry.set("LED", {
        baseType: "u8",
        bitWidth: 8,
        isArray: false,
        isConst: false,
      });

      const result = TypeValidator.resolveForMemberAccess("LED");
      expect(result).toBe("LED"); // Returns scope name, not transformed
      expect(result).not.toBe("Motor_LED"); // Should NOT be scope-prefixed
    });

    it("returns scope name when it exists", () => {
      const result = TypeValidator.resolveForMemberAccess("LED");
      expect(result).toBe("LED");
    });

    it("returns null for unknown identifiers", () => {
      const result = TypeValidator.resolveForMemberAccess("Unknown");
      expect(result).toBeNull();
    });
  });
});
