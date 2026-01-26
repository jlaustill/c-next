/**
 * TSymbolInfoAdapter - Converts TSymbol[] to ISymbolInfo for CodeGenerator.
 *
 * ADR-055 Phase 5: This adapter enables CodeGenerator to use pre-collected
 * symbols from CNextResolver instead of creating its own SymbolCollector.
 *
 * The conversion extracts and restructures the rich discriminated union types
 * into the flat map format that CodeGenerator expects via ISymbolInfo.
 */

import ISymbolInfo from "../../../codegen/generators/ISymbolInfo";
import ESymbolKind from "../../../types/ESymbolKind";
import TSymbol from "../../types/TSymbol";
import IBitmapSymbol from "../../types/IBitmapSymbol";
import IEnumSymbol from "../../types/IEnumSymbol";
import IFunctionSymbol from "../../types/IFunctionSymbol";
import IStructSymbol from "../../types/IStructSymbol";
import IRegisterSymbol from "../../types/IRegisterSymbol";
import IScopeSymbol from "../../types/IScopeSymbol";
import IVariableSymbol from "../../types/IVariableSymbol";

/**
 * Maps C-Next types to C types (for register member type conversion).
 */
const CNEXT_TO_C_TYPE: Record<string, string> = {
  u8: "uint8_t",
  u16: "uint16_t",
  u32: "uint32_t",
  u64: "uint64_t",
  i8: "int8_t",
  i16: "int16_t",
  i32: "int32_t",
  i64: "int64_t",
};

/**
 * Converts TSymbol[] to ISymbolInfo for CodeGenerator.
 * Replaces the need for SymbolCollector during code generation.
 */
class TSymbolInfoAdapter {
  /**
   * Convert TSymbol[] to ISymbolInfo for CodeGenerator consumption.
   *
   * @param symbols Array of discriminated union symbols from CNextResolver
   * @returns ISymbolInfo compatible with CodeGenerator
   */
  static convert(symbols: TSymbol[]): ISymbolInfo {
    // === Known Type Sets ===
    const knownScopes = new Set<string>();
    const knownStructs = new Set<string>();
    const knownEnums = new Set<string>();
    const knownBitmaps = new Set<string>();
    const knownRegisters = new Set<string>();

    // === Scope Information ===
    const scopeMembers = new Map<string, Set<string>>();
    const scopeMemberVisibility = new Map<
      string,
      Map<string, "public" | "private">
    >();
    const scopeVariableUsage = new Map<string, Set<string>>();

    // === Struct Information ===
    const structFields = new Map<string, Map<string, string>>();
    const structFieldArrays = new Map<string, Set<string>>();
    const structFieldDimensions = new Map<string, Map<string, number[]>>();

    // === Enum Information ===
    const enumMembers = new Map<string, Map<string, number>>();

    // === Bitmap Information ===
    const bitmapFields = new Map<
      string,
      Map<string, { offset: number; width: number }>
    >();
    const bitmapBackingType = new Map<string, string>();
    const bitmapBitWidth = new Map<string, number>();

    // === Register Information ===
    const scopedRegisters = new Map<string, string>();
    const registerMemberAccess = new Map<string, string>();
    const registerMemberTypes = new Map<string, string>();
    const registerBaseAddresses = new Map<string, string>();
    const registerMemberOffsets = new Map<string, string>();
    const registerMemberCTypes = new Map<string, string>();

    // === Issue #282: Private const values for inlining ===
    const scopePrivateConstValues = new Map<string, string>();

    // === Function Return Types ===
    const functionReturnTypes = new Map<string, string>();

    // Process each symbol
    for (const symbol of symbols) {
      switch (symbol.kind) {
        case ESymbolKind.Struct:
          TSymbolInfoAdapter.processStruct(
            symbol,
            knownStructs,
            structFields,
            structFieldArrays,
            structFieldDimensions,
          );
          break;

        case ESymbolKind.Enum:
          TSymbolInfoAdapter.processEnum(symbol, knownEnums, enumMembers);
          break;

        case ESymbolKind.Bitmap:
          TSymbolInfoAdapter.processBitmap(
            symbol,
            knownBitmaps,
            bitmapFields,
            bitmapBackingType,
            bitmapBitWidth,
          );
          break;

        case ESymbolKind.Namespace:
          TSymbolInfoAdapter.processScope(
            symbol,
            knownScopes,
            scopeMembers,
            scopeMemberVisibility,
          );
          break;

        case ESymbolKind.Register:
          TSymbolInfoAdapter.processRegister(
            symbol,
            knownRegisters,
            knownBitmaps,
            scopedRegisters,
            registerMemberAccess,
            registerMemberTypes,
            registerBaseAddresses,
            registerMemberOffsets,
            registerMemberCTypes,
          );
          break;

        case ESymbolKind.Variable:
          // Issue #282: Track private const values for inlining
          TSymbolInfoAdapter.processVariable(symbol, scopePrivateConstValues);
          break;

        // Track function return types for enum validation
        case ESymbolKind.Function:
          TSymbolInfoAdapter.processFunction(symbol, functionReturnTypes);
          break;
      }
    }

    // Build the ISymbolInfo result
    const result: ISymbolInfo = {
      // Type sets
      knownScopes,
      knownStructs,
      knownEnums,
      knownBitmaps,
      knownRegisters,

      // Scope info
      scopeMembers,
      scopeMemberVisibility,
      scopeVariableUsage,

      // Struct info
      structFields,
      structFieldArrays,
      structFieldDimensions,

      // Enum info
      enumMembers,

      // Bitmap info
      bitmapFields,
      bitmapBackingType,
      bitmapBitWidth,

      // Register info
      scopedRegisters,
      registerMemberAccess,
      registerMemberTypes,
      registerBaseAddresses,
      registerMemberOffsets,
      registerMemberCTypes,

      // Issue #282: Private const values for inlining
      scopePrivateConstValues,

      // Function return types
      functionReturnTypes,

      // Methods
      getSingleFunctionForVariable: (scopeName: string, varName: string) =>
        TSymbolInfoAdapter.getSingleFunctionForVariable(
          scopeVariableUsage,
          scopeName,
          varName,
        ),

      hasPublicSymbols: () =>
        TSymbolInfoAdapter.checkHasPublicSymbols(scopeMemberVisibility),
    };

    return result;
  }

  /**
   * Check if any scope members are public (exported).
   * Used to determine if a self-include header is needed for extern "C" linkage.
   */
  private static checkHasPublicSymbols(
    scopeMemberVisibility: Map<string, Map<string, "public" | "private">>,
  ): boolean {
    for (const [, visibilityMap] of scopeMemberVisibility) {
      for (const [, visibility] of visibilityMap) {
        if (visibility === "public") {
          return true;
        }
      }
    }
    return false;
  }

  // === Private Processing Methods ===

  private static processStruct(
    struct: IStructSymbol,
    knownStructs: Set<string>,
    structFields: Map<string, Map<string, string>>,
    structFieldArrays: Map<string, Set<string>>,
    structFieldDimensions: Map<string, Map<string, number[]>>,
  ): void {
    knownStructs.add(struct.name);

    const fields = new Map<string, string>();
    const arrayFields = new Set<string>();
    const dimensions = new Map<string, number[]>();

    for (const [fieldName, fieldInfo] of struct.fields) {
      fields.set(fieldName, fieldInfo.type);

      if (fieldInfo.isArray) {
        arrayFields.add(fieldName);

        if (fieldInfo.dimensions && fieldInfo.dimensions.length > 0) {
          dimensions.set(fieldName, fieldInfo.dimensions);
        }
      }
    }

    structFields.set(struct.name, fields);
    structFieldArrays.set(struct.name, arrayFields);
    if (dimensions.size > 0) {
      structFieldDimensions.set(struct.name, dimensions);
    }
  }

  private static processEnum(
    enumSym: IEnumSymbol,
    knownEnums: Set<string>,
    enumMembers: Map<string, Map<string, number>>,
  ): void {
    knownEnums.add(enumSym.name);
    enumMembers.set(enumSym.name, new Map(enumSym.members));
  }

  private static processBitmap(
    bitmap: IBitmapSymbol,
    knownBitmaps: Set<string>,
    bitmapFields: Map<string, Map<string, { offset: number; width: number }>>,
    bitmapBackingType: Map<string, string>,
    bitmapBitWidth: Map<string, number>,
  ): void {
    knownBitmaps.add(bitmap.name);
    bitmapBackingType.set(bitmap.name, bitmap.backingType);
    bitmapBitWidth.set(bitmap.name, bitmap.bitWidth);

    const fields = new Map<string, { offset: number; width: number }>();
    for (const [fieldName, fieldInfo] of bitmap.fields) {
      fields.set(fieldName, {
        offset: fieldInfo.offset,
        width: fieldInfo.width,
      });
    }
    bitmapFields.set(bitmap.name, fields);
  }

  private static processScope(
    scope: IScopeSymbol,
    knownScopes: Set<string>,
    scopeMembers: Map<string, Set<string>>,
    scopeMemberVisibility: Map<string, Map<string, "public" | "private">>,
  ): void {
    knownScopes.add(scope.name);

    // Convert members array to Set
    scopeMembers.set(scope.name, new Set(scope.members));

    // Copy visibility map
    scopeMemberVisibility.set(scope.name, new Map(scope.memberVisibility));
  }

  private static processRegister(
    register: IRegisterSymbol,
    knownRegisters: Set<string>,
    knownBitmaps: Set<string>,
    scopedRegisters: Map<string, string>,
    registerMemberAccess: Map<string, string>,
    registerMemberTypes: Map<string, string>,
    registerBaseAddresses: Map<string, string>,
    registerMemberOffsets: Map<string, string>,
    registerMemberCTypes: Map<string, string>,
  ): void {
    knownRegisters.add(register.name);
    registerBaseAddresses.set(register.name, register.baseAddress);

    // Check if this is a scoped register (name contains underscore)
    if (register.name.includes("_")) {
      scopedRegisters.set(register.name, register.baseAddress);
    }

    for (const [memberName, memberInfo] of register.members) {
      const fullName = `${register.name}_${memberName}`;

      registerMemberAccess.set(fullName, memberInfo.access);
      registerMemberOffsets.set(fullName, memberInfo.offset);
      registerMemberCTypes.set(
        fullName,
        TSymbolInfoAdapter.cnextTypeToCType(memberInfo.cType),
      );

      // Track bitmap types for register members
      if (memberInfo.bitmapType && knownBitmaps.has(memberInfo.bitmapType)) {
        registerMemberTypes.set(fullName, memberInfo.bitmapType);
      }
    }
  }

  private static processVariable(
    variable: IVariableSymbol,
    scopePrivateConstValues: Map<string, string>,
  ): void {
    // Issue #282: Track private const values for inlining
    // A scoped variable has an underscore in its name (e.g., "Motor_MAX_SPEED")
    const isScoped = variable.name.includes("_");
    const isPrivate = !variable.isExported;

    if (isScoped && isPrivate && variable.isConst && variable.initialValue) {
      scopePrivateConstValues.set(variable.name, variable.initialValue);
    }
  }

  private static processFunction(
    func: IFunctionSymbol,
    functionReturnTypes: Map<string, string>,
  ): void {
    // Track function return types for enum validation in assignments
    // This enables recognizing that Motor.getMode() returns Motor_EMode
    functionReturnTypes.set(func.name, func.returnType);
  }

  private static cnextTypeToCType(typeName: string): string {
    return CNEXT_TO_C_TYPE[typeName] || typeName;
  }

  private static getSingleFunctionForVariable(
    scopeVariableUsage: Map<string, Set<string>>,
    scopeName: string,
    varName: string,
  ): string | null {
    const fullVarName = `${scopeName}_${varName}`;
    const usedIn = scopeVariableUsage.get(fullVarName);

    if (!usedIn || usedIn.size !== 1) {
      return null;
    }

    // Extract the single element from the Set (we know it exists since size === 1)
    return [...usedIn][0];
  }

  /**
   * Issue #465: Merge external symbol info into an existing ISymbolInfo.
   *
   * When a file includes other .cnx files, the enum types and scopes from those
   * external files need to be available for code generation. This enables:
   * - Enum member prefixing for external enums
   * - Cross-scope method calls like global.Scope.method() returning enums
   *
   * This method creates a new ISymbolInfo that includes both the base symbols
   * and merged info from external sources.
   *
   * @param base The ISymbolInfo from the current file
   * @param externalEnumSources Array of ISymbolInfo from included .cnx files
   * @returns New ISymbolInfo with merged enum and scope data
   */
  static mergeExternalEnums(
    base: ISymbolInfo,
    externalEnumSources: ISymbolInfo[],
  ): ISymbolInfo {
    // If no external sources, return base unchanged
    if (externalEnumSources.length === 0) {
      return base;
    }

    // Create mutable copies of enum-related data and scope info
    const mergedKnownEnums = new Set(base.knownEnums);
    const mergedKnownScopes = new Set(base.knownScopes);
    const mergedEnumMembers = new Map<string, Map<string, number>>();
    const mergedFunctionReturnTypes = new Map<string, string>();

    // Copy base enum members
    for (const [enumName, members] of base.enumMembers) {
      mergedEnumMembers.set(enumName, new Map(members));
    }

    // Copy base function return types
    for (const [funcName, returnType] of base.functionReturnTypes) {
      mergedFunctionReturnTypes.set(funcName, returnType);
    }

    // Merge in external enum info, function return types, and scopes
    for (const external of externalEnumSources) {
      for (const enumName of external.knownEnums) {
        mergedKnownEnums.add(enumName);
      }
      // Merge scopes from external sources for cross-scope method calls
      for (const scopeName of external.knownScopes) {
        mergedKnownScopes.add(scopeName);
      }
      for (const [enumName, members] of external.enumMembers) {
        // Don't overwrite if already exists (local takes precedence)
        if (!mergedEnumMembers.has(enumName)) {
          mergedEnumMembers.set(enumName, new Map(members));
        }
      }
      // Merge function return types from external sources
      for (const [funcName, returnType] of external.functionReturnTypes) {
        if (!mergedFunctionReturnTypes.has(funcName)) {
          mergedFunctionReturnTypes.set(funcName, returnType);
        }
      }
    }

    // Return new ISymbolInfo with merged enum data and scope info
    // All other fields remain unchanged from base
    return {
      // Type sets - knownEnums and knownScopes are merged
      knownScopes: mergedKnownScopes,
      knownStructs: base.knownStructs,
      knownEnums: mergedKnownEnums,
      knownBitmaps: base.knownBitmaps,
      knownRegisters: base.knownRegisters,

      // Scope info
      scopeMembers: base.scopeMembers,
      scopeMemberVisibility: base.scopeMemberVisibility,
      scopeVariableUsage: base.scopeVariableUsage,

      // Struct info
      structFields: base.structFields,
      structFieldArrays: base.structFieldArrays,
      structFieldDimensions: base.structFieldDimensions,

      // Enum info - merged
      enumMembers: mergedEnumMembers,

      // Bitmap info
      bitmapFields: base.bitmapFields,
      bitmapBackingType: base.bitmapBackingType,
      bitmapBitWidth: base.bitmapBitWidth,

      // Register info
      scopedRegisters: base.scopedRegisters,
      registerMemberAccess: base.registerMemberAccess,
      registerMemberTypes: base.registerMemberTypes,
      registerBaseAddresses: base.registerBaseAddresses,
      registerMemberOffsets: base.registerMemberOffsets,
      registerMemberCTypes: base.registerMemberCTypes,

      // Private const values
      scopePrivateConstValues: base.scopePrivateConstValues,

      // Function return types - merged
      functionReturnTypes: mergedFunctionReturnTypes,

      // Methods - delegate to base's implementation
      getSingleFunctionForVariable: base.getSingleFunctionForVariable,
      hasPublicSymbols: base.hasPublicSymbols,
    };
  }
}

export default TSymbolInfoAdapter;
