/**
 * Shared test utilities for assignment handler tests.
 * Provides common mock setup functions to reduce duplication.
 */

import { vi } from "vitest";
import createMockSymbols from "../../../../../../transpiler/__tests__/codeGenSymbolsHelpers";
import CodeGenState from "../../../../../../transpiler/state/CodeGenState";
import SymbolTable from "../../../../../../PARSE/3-Declare/SymbolTable";
import type ICodeGenApi from "../../../../../../transpiler/types/ICodeGenApi";
import type ICodeGenSymbols from "../../../../../../transpiler/types/ICodeGenSymbols";
import type TTypeInfo from "../../../../../../transpiler/types/TTypeInfo";
import RenderState from "../../../../../../transpiler/state/RenderState";

/**
 * Set up mock symbols on CodeGenState.
 * Provides comprehensive defaults that can be overridden.
 * Issue #831: Also registers struct fields in SymbolTable for single source of truth.
 */
function setupMockSymbols(overrides: Partial<ICodeGenSymbols> = {}): void {
  CodeGenState.symbols = {
    ...createMockSymbols(),
    ...overrides,
  };

  // Also register struct fields in SymbolTable (single source of truth)
  if (overrides.structFields) {
    if (!CodeGenState.symbolTable) {
      CodeGenState.symbolTable = new SymbolTable();
    }
    for (const [structName, fields] of overrides.structFields) {
      for (const [fieldName, fieldType] of fields) {
        CodeGenState.symbolTable.addStructField(
          structName,
          fieldName,
          fieldType,
        );
      }
    }
  }
}

/**
 * The node-taking operations these tests stand in for.
 *
 * #1652: these four used to be declared on `ICodeGenApi` as `ctx: unknown`, and
 * that file said why -- naming the type would have put the production contract
 * in the `parse-tree-confined-to-parser` population. So the contract pretended
 * not to hold a parse node while holding one, and the gate read clean.
 *
 * They had **no production caller**. Declared here instead, where a parse node
 * is honest: `__tests__/` is excluded from that population on purpose, because
 * a fixture builds a tree because that is what it is testing.
 */
interface ITestPlanner {
  generateExpression(ctx: unknown): string;
  generateAssignmentTarget(ctx: unknown): string;
  tryEvaluateConstant(ctx: unknown): number | undefined;
  analyzeMemberChainForBitAccess(ctx: unknown): { isBitAccess: boolean };
}

/**
 * The mock the current test installed, reached DIRECTLY.
 *
 * #1652: the helpers used to route back through
 * `CodeGenState.requireGenerator()`, which is what kept the four members alive
 * on the production interface. A test holding its own mock needs no production
 * contract to hand it back.
 */
let installed: (ICodeGenApi & ITestPlanner) | null = null;

function planner(): ITestPlanner {
  if (!installed) {
    throw new Error("call HandlerTestUtils.setupMockGenerator() first");
  }
  return installed;
}

/**
 * Set up mock generator on CodeGenState.
 * Common generator methods are pre-mocked with sensible defaults.
 */
function setupMockGenerator(overrides: Record<string, unknown> = {}): void {
  installed = {
    // #1452: the orchestrator carries 2.3's per-file state, so a handler
    // reaches it through the API it was given rather than a static class.
    state: new RenderState(),
    generateAssignmentTarget: vi.fn().mockReturnValue("target"),
    generateExpression: vi
      .fn()
      .mockImplementation((ctx) => ctx?.mockValue ?? "0"),
    tryEvaluateConstant: vi.fn().mockReturnValue(undefined),
    getMemberTypeInfo: vi.fn().mockReturnValue(null),
    analyzeMemberChainForBitAccess: vi
      .fn()
      .mockReturnValue({ isBitAccess: false }),
    generateFloatBitWrite: vi.fn().mockReturnValue(null),
    generateAtomicRMW: vi.fn().mockReturnValue("atomic_rmw_result"),
    isKnownScope: vi.fn().mockReturnValue(false),
    isKnownStruct: vi.fn().mockReturnValue(false),
    ...overrides,
  } as unknown as ICodeGenApi & ITestPlanner;

  // Only the members production actually reaches through this door.
  CodeGenState.generator = installed;
}

/**
 * The subscript accessors an `IAssignmentContext` carries, bound to the mocked
 * generator.
 *
 * #1445: the context used to hand the handlers a node, which they passed to
 * `planner().generateExpression(...)`. It hands them a
 * render now, so the cases keep their stand-in nodes -- the default mock reads
 * `mockValue` off one, and several cases override `generateExpression` or
 * `tryEvaluateConstant` outright -- and this routes through the same mock in
 * the same order.
 */
function subscriptsOf(nodes: readonly unknown[]): {
  subscriptCount: number;
  renderSubscript: (index: number) => string;
  foldSubscript: (index: number) => number | undefined;
} {
  return {
    subscriptCount: nodes.length,
    renderSubscript: (index) => planner().generateExpression(nodes[index]),
    foldSubscript: (index) => planner().tryEvaluateConstant(nodes[index]),
  };
}

/** Common type bit widths for test mocks */
const TYPE_BIT_WIDTHS: Record<string, number> = {
  u8: 8,
  i8: 8,
  u16: 16,
  i16: 16,
  u32: 32,
  i32: 32,
  u64: 64,
  i64: 64,
  f32: 32,
  f64: 64,
  bool: 1,
  string: 0,
};

/**
 * Create a TTypeInfo with sensible defaults.
 * Only override the fields you care about in tests.
 */
function createTypeInfo(overrides: Partial<TTypeInfo> = {}): TTypeInfo {
  const baseType = overrides.baseType ?? "u32";
  return {
    baseType,
    bitWidth: overrides.bitWidth ?? TYPE_BIT_WIDTHS[baseType] ?? 32,
    isArray: overrides.isArray ?? false,
    isConst: overrides.isConst ?? false,
    ...overrides,
  };
}

/**
 * Set up CodeGenState type registry with typed entries.
 * Entries only need to specify the fields relevant to the test.
 * Uses setVariableTypeInfo to properly populate the registry.
 */
function setupMockTypeRegistry(
  entries: Array<[string, Partial<TTypeInfo>]>,
): void {
  for (const [name, partial] of entries) {
    CodeGenState.setVariableTypeInfo(name, createTypeInfo(partial));
  }
}

export default class HandlerTestUtils {
  static readonly setupMockSymbols = setupMockSymbols;
  static readonly setupMockGenerator = setupMockGenerator;
  static readonly subscriptsOf = subscriptsOf;
  static readonly planner = planner;
  static readonly setupMockTypeRegistry = setupMockTypeRegistry;
}
