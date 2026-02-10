import { describe, it, expect, beforeEach } from "vitest";
import AssignmentExpectedTypeResolver from "../AssignmentExpectedTypeResolver.js";
import CNextSourceParser from "../../../../logic/parser/CNextSourceParser.js";
import CodeGenState from "../../CodeGenState.js";

/**
 * Create a mock assignment target context by parsing a minimal assignment statement.
 */
function parseAssignmentTarget(target: string) {
  const source = `void test() { ${target} <- 0; }`;
  const { tree } = CNextSourceParser.parse(source);
  const decl = tree.declaration(0);
  const func = decl!.functionDeclaration();
  const block = func!.block();
  const stmt = block!.statement(0)!;
  const assignStmt = stmt.assignmentStatement()!;
  return assignStmt.assignmentTarget();
}

/**
 * Helper to set up struct fields in CodeGenState.symbols
 */
function setupStructFields(
  structName: string,
  fields: Map<string, string>,
): void {
  if (!CodeGenState.symbols) {
    CodeGenState.symbols = {
      knownStructs: new Set(),
      knownScopes: new Set(),
      knownEnums: new Set(),
      knownBitmaps: new Set(),
      knownRegisters: new Set(),
      structFields: new Map(),
      structFieldArrays: new Map(),
      structFieldDimensions: new Map(),
      enumMembers: new Map(),
      bitmapFields: new Map(),
      bitmapBackingType: new Map(),
      bitmapBitWidth: new Map(),
      scopeMembers: new Map(),
      scopeMemberVisibility: new Map(),
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
    };
  }
  (CodeGenState.symbols.knownStructs as Set<string>).add(structName);
  (CodeGenState.symbols.structFields as Map<string, Map<string, string>>).set(
    structName,
    fields,
  );
}

describe("AssignmentExpectedTypeResolver", () => {
  beforeEach(() => {
    CodeGenState.reset();
  });

  describe("resolve()", () => {
    describe("simple identifier", () => {
      it("should resolve expected type for known variable", () => {
        CodeGenState.typeRegistry.set("counter", {
          baseType: "u32",
          bitWidth: 32,
          isArray: false,
          isConst: false,
        });
        const target = parseAssignmentTarget("counter");

        const result = AssignmentExpectedTypeResolver.resolve(target);

        expect(result.expectedType).toBe("u32");
        expect(result.assignmentContext).toEqual({
          targetName: "counter",
          targetType: "u32",
          overflowBehavior: "clamp",
        });
      });

      it("should use specified overflow behavior", () => {
        CodeGenState.typeRegistry.set("counter", {
          baseType: "u8",
          bitWidth: 8,
          isArray: false,
          isConst: false,
          overflowBehavior: "wrap",
        });
        const target = parseAssignmentTarget("counter");

        const result = AssignmentExpectedTypeResolver.resolve(target);

        expect(result.assignmentContext?.overflowBehavior).toBe("wrap");
      });

      it("should return null for unknown variable", () => {
        const target = parseAssignmentTarget("unknown");

        const result = AssignmentExpectedTypeResolver.resolve(target);

        expect(result.expectedType).toBeNull();
        expect(result.assignmentContext).toBeNull();
      });
    });

    describe("member access", () => {
      it("should resolve expected type for struct field", () => {
        CodeGenState.typeRegistry.set("config", {
          baseType: "Config",
          bitWidth: 0,
          isArray: false,
          isConst: false,
        });
        setupStructFields("Config", new Map([["status", "Status"]]));
        const target = parseAssignmentTarget("config.status");

        const result = AssignmentExpectedTypeResolver.resolve(target);

        expect(result.expectedType).toBe("Status");
      });

      it("should walk nested struct chain", () => {
        CodeGenState.typeRegistry.set("app", {
          baseType: "App",
          bitWidth: 0,
          isArray: false,
          isConst: false,
        });
        setupStructFields("App", new Map([["config", "Config"]]));
        setupStructFields("Config", new Map([["mode", "Mode"]]));
        const target = parseAssignmentTarget("app.config.mode");

        const result = AssignmentExpectedTypeResolver.resolve(target);

        expect(result.expectedType).toBe("Mode");
      });

      it("should return null for non-struct root", () => {
        CodeGenState.typeRegistry.set("counter", {
          baseType: "u32",
          bitWidth: 32,
          isArray: false,
          isConst: false,
        });
        const target = parseAssignmentTarget("counter.value");

        const result = AssignmentExpectedTypeResolver.resolve(target);

        expect(result.expectedType).toBeNull();
      });

      it("should return null for unknown field", () => {
        CodeGenState.typeRegistry.set("config", {
          baseType: "Config",
          bitWidth: 0,
          isArray: false,
          isConst: false,
        });
        setupStructFields("Config", new Map([["status", "Status"]]));
        const target = parseAssignmentTarget("config.unknown");

        const result = AssignmentExpectedTypeResolver.resolve(target);

        expect(result.expectedType).toBeNull();
      });
    });

    describe("array access", () => {
      it("should return null for array access target", () => {
        CodeGenState.typeRegistry.set("arr", {
          baseType: "u32",
          bitWidth: 32,
          isArray: true,
          isConst: false,
        });
        const target = parseAssignmentTarget("arr[0]");

        const result = AssignmentExpectedTypeResolver.resolve(target);

        expect(result.expectedType).toBeNull();
        expect(result.assignmentContext).toBeNull();
      });
    });
  });
});
