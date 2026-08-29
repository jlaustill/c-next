import ICodeGenSymbols from "../types/ICodeGenSymbols";

/**
 * A complete, empty `ICodeGenSymbols` for unit tests, with overrides applied.
 *
 * #1285: this existed as NINE independent copies, one per test file, each
 * spelling out all 24 fields. Adding a field to ICodeGenSymbols meant nine edits
 * that had to agree, and a mock that drifted from the others was invisible --
 * jscpd cannot see it because each copy sits in a different file and differs in
 * which overrides it names.
 *
 * It is deliberately PURE: it returns a value and touches no global state, so a
 * caller assigning it to `CodeGenState.symbols` is doing something visible at
 * the call site.
 */

function createMockSymbols(
  overrides?: Partial<ICodeGenSymbols>,
): ICodeGenSymbols {
  return {
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
    ...overrides,
  } as ICodeGenSymbols;
}

export default createMockSymbols;
