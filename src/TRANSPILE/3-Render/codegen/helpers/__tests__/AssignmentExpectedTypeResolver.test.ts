import { describe, it, expect, beforeEach } from "vitest";
import AssignmentExpectedTypeResolver from "../AssignmentExpectedTypeResolver";
import analyzePostfixOps from "../../../../../utils/PostfixAnalysisUtils";
import CNextSourceParser from "../../../../../PARSE/2-Parse/CNextSourceParser";
import TranspileState from "../../../../TranspileState";
import SymbolTable from "../../../../../PARSE/3-Declare/SymbolTable";
import type TTypeInfo from "../../../../../transpiler/types/TTypeInfo";

/**
 * Create a mock assignment target context by parsing a minimal assignment statement.
 */
/**
 * Parse a target and reduce it to the shape the resolver now takes (#1445).
 *
 * The parse is still real -- these are not fabricated nodes. What changed is
 * that the resolver no longer walks the node, so the walk happens here,
 * mirroring `CodeGenerator.generateAssignment`. Six lines duplicated into a
 * test is the cost of the resolver naming no parse type; the alternative was
 * exporting the walk as production surface that only a test calls.
 */
function parseAssignmentTarget(target: string) {
  const source = `void test() { ${target} <- 0; }`;
  const { tree } = CNextSourceParser.parse(source);
  const decl = tree.declaration(0);
  const func = decl!.functionDeclaration();
  const block = func!.block();
  const stmt = block!.statement(0)!;
  const assignStmt = stmt.assignmentStatement()!;
  const targetCtx = assignStmt.assignmentTarget();

  const postfixOps = targetCtx.postfixTargetOp();
  const baseId = targetCtx.IDENTIFIER()?.getText();
  const chain =
    baseId && postfixOps.length > 0
      ? analyzePostfixOps(baseId, postfixOps)
      : { identifiers: [] as string[], hasSubscript: false };

  return {
    baseId,
    identifiers: chain.identifiers,
    hasSubscript: chain.hasSubscript,
    hasRangeSubscript: postfixOps.some((op) => op.expression().length === 2),
    hasPostfixOps: postfixOps.length > 0,
    // #1668 (C7): the root's declared type, as the walker binds it
    rootTypeInfo: baseId === undefined ? undefined : declared.get(baseId),
  };
}

/** What each test declares, by name -- the binding the walker would pass */
const declared = new Map<string, TTypeInfo>();
function declare(name: string, info: TTypeInfo): void {
  declared.set(name, info);
}

/**
 * Helper to set up struct fields in state.symbolTable
 * Issue #831: SymbolTable is now the single source of truth for struct fields
 */
function setupStructFields(
  structName: string,
  fields: Map<string, string>,
): void {
  // Initialize symbolTable if not set
  if (!state.symbolTable) {
    state.symbolTable = new SymbolTable();
  }

  // Register struct fields in SymbolTable
  for (const [fieldName, fieldType] of fields) {
    state.symbolTable.addStructField(structName, fieldName, fieldType);
  }

  // Also mark struct as known (for isKnownStruct checks)
  if (!state.symbols) {
    state.symbols = {
      knownStructs: new Set(),
      knownScopes: new Set(),
      knownEnums: new Set(),
      knownBitmaps: new Set(),
      knownVariables: new Set(),
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
      scopePrivateConstValues: new Map(),
      functionReturnTypes: new Map(),
    };
  }
  (state.symbols.knownStructs as Set<string>).add(structName);
}

let state = new TranspileState();

describe("AssignmentExpectedTypeResolver", () => {
  beforeEach(() => {
    declared.clear();
    state = new TranspileState();
  });

  describe("resolve()", () => {
    describe("simple identifier", () => {
      it("should resolve expected type for known variable", () => {
        declare("counter", {
          baseType: "u32",
          bitWidth: 32,
          isArray: false,
          isConst: false,
        });
        const target = parseAssignmentTarget("counter");

        const result = AssignmentExpectedTypeResolver.resolve(target, state);

        expect(result).toBe("u32");
      });

      it("should return null for unknown variable", () => {
        const target = parseAssignmentTarget("unknown");

        const result = AssignmentExpectedTypeResolver.resolve(target, state);

        expect(result).toBeNull();
      });
    });

    describe("member access", () => {
      it("should resolve expected type for struct field", () => {
        declare("config", {
          baseType: "Config",
          bitWidth: 0,
          isArray: false,
          isConst: false,
        });
        setupStructFields("Config", new Map([["status", "Status"]]));
        const target = parseAssignmentTarget("config.status");

        const result = AssignmentExpectedTypeResolver.resolve(target, state);

        expect(result).toBe("Status");
      });

      it("should walk nested struct chain", () => {
        declare("app", {
          baseType: "App",
          bitWidth: 0,
          isArray: false,
          isConst: false,
        });
        setupStructFields("App", new Map([["config", "Config"]]));
        setupStructFields("Config", new Map([["mode", "Mode"]]));
        const target = parseAssignmentTarget("app.config.mode");

        const result = AssignmentExpectedTypeResolver.resolve(target, state);

        expect(result).toBe("Mode");
      });

      it("should return null for non-struct root", () => {
        declare("counter", {
          baseType: "u32",
          bitWidth: 32,
          isArray: false,
          isConst: false,
        });
        const target = parseAssignmentTarget("counter.value");

        const result = AssignmentExpectedTypeResolver.resolve(target, state);

        expect(result).toBeNull();
      });

      it("should return null for unknown field", () => {
        declare("config", {
          baseType: "Config",
          bitWidth: 0,
          isArray: false,
          isConst: false,
        });
        setupStructFields("Config", new Map([["status", "Status"]]));
        const target = parseAssignmentTarget("config.unknown");

        const result = AssignmentExpectedTypeResolver.resolve(target, state);

        expect(result).toBeNull();
      });
    });

    describe("array access", () => {
      // Issue #872: Array element assignments need expectedType for MISRA 7.2 U suffix
      it("should resolve expected type for simple array element access", () => {
        declare("arr", {
          baseType: "u32",
          bitWidth: 32,
          isArray: true,
          isConst: false,
        });
        const target = parseAssignmentTarget("arr[0]");

        const result = AssignmentExpectedTypeResolver.resolve(target, state);

        expect(result).toBe("u32");
      });

      it("should resolve expected type for u8 array element access", () => {
        declare("buffer", {
          baseType: "u8",
          bitWidth: 8,
          isArray: true,
          isConst: false,
        });
        const target = parseAssignmentTarget("buffer[5]");

        const result = AssignmentExpectedTypeResolver.resolve(target, state);

        expect(result).toBe("u8");
      });

      it("should resolve expected type for struct member array access", () => {
        declare("pkt", {
          baseType: "Packet",
          bitWidth: 0,
          isArray: false,
          isConst: false,
        });
        setupStructFields("Packet", new Map([["header", "u8"]]));
        // Mark header as an array field
        if (state.symbols) {
          (state.symbols.structFieldArrays as Map<string, Set<string>>).set(
            "Packet",
            new Set(["header"]),
          );
        }
        const target = parseAssignmentTarget("pkt.header[0]");

        const result = AssignmentExpectedTypeResolver.resolve(target, state);

        expect(result).toBe("u8");
      });

      it("should resolve expected type for multi-dimensional array element", () => {
        declare("matrix", {
          baseType: "u8",
          bitWidth: 8,
          isArray: true,
          arrayDimensions: [4, 8],
          isConst: false,
        });
        const target = parseAssignmentTarget("matrix[0][0]");

        const result = AssignmentExpectedTypeResolver.resolve(target, state);

        expect(result).toBe("u8");
      });

      it("should return null for unknown array variable", () => {
        const target = parseAssignmentTarget("unknown[0]");

        const result = AssignmentExpectedTypeResolver.resolve(target, state);

        expect(result).toBeNull();
      });

      // Issue #1085: an array SLICE (2-expression subscript `arr[off, len]`)
      // serializes the source at the SOURCE's own width. Leaking the element type
      // as expectedType truncates a wider source (e.g. a bit-extraction), so the
      // resolver must return null for the slice form — unlike a 1-expression
      // element access, which keeps the element type for the MISRA 7.2 U suffix.
      it("should return null for an array slice (2-expression subscript)", () => {
        declare("buffer", {
          baseType: "u8",
          bitWidth: 8,
          isArray: true,
          isConst: false,
        });
        const target = parseAssignmentTarget("buffer[0, 4]");

        const result = AssignmentExpectedTypeResolver.resolve(target, state);

        expect(result).toBeNull();
      });
    });
  });
});
