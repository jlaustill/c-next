/**
 * Shared test utilities for assignment handler tests.
 * Provides common mock setup functions to reduce duplication.
 */

import { vi } from "vitest";
import CodeGenState from "../../../../../state/CodeGenState";
import SymbolTable from "../../../../../logic/symbols/SymbolTable";
import type ICodeGenApi from "../../../types/ICodeGenApi";
import type ICodeGenSymbols from "../../../../../types/ICodeGenSymbols";
import type TTypeInfo from "../../../types/TTypeInfo";

/**
 * Default mock symbols with all required ICodeGenSymbols fields.
 * Override specific fields as needed for individual tests.
 */
function createDefaultMockSymbols(): ICodeGenSymbols {
  return {
    // Known type names
    knownScopes: new Set(),
    knownStructs: new Set(),
    knownRegisters: new Set(),
    knownEnums: new Set(),
    knownBitmaps: new Set(),

    // Scope information
    scopeMembers: new Map(),
    scopeMemberVisibility: new Map(),

    // Struct information
    structFields: new Map(),
    structFieldArrays: new Map(),
    structFieldDimensions: new Map(),

    // Enum information
    enumMembers: new Map(),

    // Bitmap information
    bitmapFields: new Map(),
    bitmapBackingType: new Map(),
    bitmapBitWidth: new Map(),

    // Register information
    scopedRegisters: new Map(),
    registerMemberAccess: new Map(),
    registerMemberTypes: new Map(),
    registerBaseAddresses: new Map(),
    registerMemberOffsets: new Map(),
    registerMemberCTypes: new Map(),

    // Scope variable analysis
    scopeVariableUsage: new Map(),
    scopePrivateConstValues: new Map(),

    // Function return types
    functionReturnTypes: new Map(),

    // Methods
    getSingleFunctionForVariable: () => null,
    hasPublicSymbols: () => false,
  };
}

/**
 * Set up mock symbols on CodeGenState.
 * Provides comprehensive defaults that can be overridden.
 * Issue #831: Also registers struct fields in SymbolTable for single source of truth.
 */
function setupMockSymbols(overrides: Partial<ICodeGenSymbols> = {}): void {
  CodeGenState.symbols = {
    ...createDefaultMockSymbols(),
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
 * Set up mock generator on CodeGenState.
 * Common generator methods are pre-mocked with sensible defaults.
 */
function setupMockGenerator(overrides: Record<string, unknown> = {}): void {
  CodeGenState.generator = {
    generateAssignmentTarget: vi.fn().mockReturnValue("target"),
    generateExpression: vi
      .fn()
      .mockImplementation((ctx) => ctx?.mockValue ?? "0"),
    tryEvaluateConstant: vi.fn().mockReturnValue(undefined),
    validateBitmapFieldLiteral: vi.fn(),
    validateCrossScopeVisibility: vi.fn(),
    getMemberTypeInfo: vi.fn().mockReturnValue(null),
    checkArrayBounds: vi.fn(),
    analyzeMemberChainForBitAccess: vi
      .fn()
      .mockReturnValue({ isBitAccess: false }),
    generateFloatBitWrite: vi.fn().mockReturnValue(null),
    generateAtomicRMW: vi.fn().mockReturnValue("atomic_rmw_result"),
    isKnownScope: vi.fn().mockReturnValue(false),
    isKnownStruct: vi.fn().mockReturnValue(false),
    ...overrides,
  } as unknown as ICodeGenApi;
}

/**
 * Combined setup for both symbols and generator.
 * Convenience function for tests that need both.
 */
function setupMockState(
  symbolOverrides: Partial<ICodeGenSymbols> = {},
  generatorOverrides: Record<string, unknown> = {},
): void {
  setupMockSymbols(symbolOverrides);
  setupMockGenerator(generatorOverrides);
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
  static readonly setupMockState = setupMockState;
  static readonly createDefaultMockSymbols = createDefaultMockSymbols;
  static readonly createTypeInfo = createTypeInfo;
  static readonly setupMockTypeRegistry = setupMockTypeRegistry;
}
