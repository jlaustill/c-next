import { describe, it, expect, beforeEach } from "vitest";
import AssignmentExpectedTypeResolver from "../AssignmentExpectedTypeResolver.js";
import CNextSourceParser from "../../../../logic/parser/CNextSourceParser.js";
import CodeGenState from "../../../../state/CodeGenState.js";
import SymbolTable from "../../../../logic/symbols/SymbolTable.js";

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
 * Helper to set up struct fields in CodeGenState.symbolTable
 * Issue #831: SymbolTable is now the single source of truth for struct fields
 */
function setupStructFields(
  structName: string,
  fields: Map<string, string>,
): void {
  // Initialize symbolTable if not set
  if (!CodeGenState.symbolTable) {
    CodeGenState.symbolTable = new SymbolTable();
  }

  // Register struct fields in SymbolTable
  for (const [fieldName, fieldType] of fields) {
    CodeGenState.symbolTable.addStructField(structName, fieldName, fieldType);
  }

  // Also mark struct as known (for isKnownStruct checks)
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
}

describe("AssignmentExpectedTypeResolver", () => {
  beforeEach(() => {
    CodeGenState.reset();
  });

  describe("resolve()", () => {
    describe("simple identifier", () => {
      it("should resolve expected type for known variable", () => {
        CodeGenState.setVariableTypeInfo("counter", {
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
        CodeGenState.setVariableTypeInfo("counter", {
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
        CodeGenState.setVariableTypeInfo("config", {
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
        CodeGenState.setVariableTypeInfo("app", {
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
        CodeGenState.setVariableTypeInfo("counter", {
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
        CodeGenState.setVariableTypeInfo("config", {
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
      // Issue #872: Array element assignments need expectedType for MISRA 7.2 U suffix
      it("should resolve expected type for simple array element access", () => {
        CodeGenState.setVariableTypeInfo("arr", {
          baseType: "u32",
          bitWidth: 32,
          isArray: true,
          isConst: false,
        });
        const target = parseAssignmentTarget("arr[0]");

        const result = AssignmentExpectedTypeResolver.resolve(target);

        expect(result.expectedType).toBe("u32");
      });

      it("should resolve expected type for u8 array element access", () => {
        CodeGenState.setVariableTypeInfo("buffer", {
          baseType: "u8",
          bitWidth: 8,
          isArray: true,
          isConst: false,
        });
        const target = parseAssignmentTarget("buffer[5]");

        const result = AssignmentExpectedTypeResolver.resolve(target);

        expect(result.expectedType).toBe("u8");
      });

      it("should resolve expected type for struct member array access", () => {
        CodeGenState.setVariableTypeInfo("pkt", {
          baseType: "Packet",
          bitWidth: 0,
          isArray: false,
          isConst: false,
        });
        setupStructFields("Packet", new Map([["header", "u8"]]));
        // Mark header as an array field
        if (CodeGenState.symbols) {
          (
            CodeGenState.symbols.structFieldArrays as Map<string, Set<string>>
          ).set("Packet", new Set(["header"]));
        }
        const target = parseAssignmentTarget("pkt.header[0]");

        const result = AssignmentExpectedTypeResolver.resolve(target);

        expect(result.expectedType).toBe("u8");
      });

      it("should resolve expected type for multi-dimensional array element", () => {
        CodeGenState.setVariableTypeInfo("matrix", {
          baseType: "u8",
          bitWidth: 8,
          isArray: true,
          arrayDimensions: [4, 8],
          isConst: false,
        });
        const target = parseAssignmentTarget("matrix[0][0]");

        const result = AssignmentExpectedTypeResolver.resolve(target);

        expect(result.expectedType).toBe("u8");
      });

      it("should return null for unknown array variable", () => {
        const target = parseAssignmentTarget("unknown[0]");

        const result = AssignmentExpectedTypeResolver.resolve(target);

        expect(result.expectedType).toBeNull();
      });
    });
  });
});
