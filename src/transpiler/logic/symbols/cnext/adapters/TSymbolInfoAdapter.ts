/**
 * TSymbolInfoAdapter - Converts TSymbol[] to ISymbolInfo for CodeGenerator.
 *
 * ADR-055 Phase 5: This adapter enables CodeGenerator to use pre-collected
 * symbols from CNextResolver instead of creating its own SymbolCollector.
 *
 * The conversion extracts and restructures the rich discriminated union types
 * into the flat map format that CodeGenerator expects via ISymbolInfo.
 */

import ICodeGenSymbols from "../../../../types/ICodeGenSymbols";
import CNEXT_TO_C_TYPE_MAP from "../../../../../utils/constants/TypeMappings";
import TSymbol from "../../../../types/symbols/TSymbol";
import IBitmapSymbol from "../../../../types/symbols/IBitmapSymbol";
import IEnumSymbol from "../../../../types/symbols/IEnumSymbol";
import IFunctionSymbol from "../../../../types/symbols/IFunctionSymbol";
import IStructSymbol from "../../../../types/symbols/IStructSymbol";
import IRegisterSymbol from "../../../../types/symbols/IRegisterSymbol";
import IScopeSymbol from "../../../../types/symbols/IScopeSymbol";
import IVariableSymbol from "../../../../types/symbols/IVariableSymbol";
import TypeResolver from "../../../../../utils/TypeResolver";
import SymbolNameUtils from "../utils/SymbolNameUtils";

/**
 * Groups register-related maps for processRegister method.
 * Reduces parameter count for SonarCloud compliance.
 */
interface IRegisterMaps {
  knownRegisters: Set<string>;
  scopedRegisters: Map<string, string>;
  registerMemberAccess: Map<string, string>;
  registerMemberTypes: Map<string, string>;
  registerBaseAddresses: Map<string, string>;
  registerMemberOffsets: Map<string, string>;
  registerMemberCTypes: Map<string, string>;
}

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
  static convert(symbols: TSymbol[]): ICodeGenSymbols {
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

    // === Issue #948: Opaque Types ===
    // Note: Opaque types are populated from SymbolTable, not TSymbol[]
    // This will be an empty set here; actual values come from Transpiler
    const opaqueTypes = new Set<string>();

    // Process each symbol
    for (const symbol of symbols) {
      switch (symbol.kind) {
        case "struct":
          TSymbolInfoAdapter.processStruct(
            symbol,
            knownStructs,
            structFields,
            structFieldArrays,
            structFieldDimensions,
          );
          break;

        case "enum":
          TSymbolInfoAdapter.processEnum(symbol, knownEnums, enumMembers);
          break;

        case "bitmap":
          TSymbolInfoAdapter.processBitmap(
            symbol,
            knownBitmaps,
            bitmapFields,
            bitmapBackingType,
            bitmapBitWidth,
          );
          break;

        case "scope":
          TSymbolInfoAdapter.processScope(
            symbol,
            knownScopes,
            scopeMembers,
            scopeMemberVisibility,
          );
          break;

        case "register":
          TSymbolInfoAdapter.processRegister(symbol, knownBitmaps, {
            knownRegisters,
            scopedRegisters,
            registerMemberAccess,
            registerMemberTypes,
            registerBaseAddresses,
            registerMemberOffsets,
            registerMemberCTypes,
          });
          break;

        case "variable":
          // Track scope membership and private const values
          TSymbolInfoAdapter.processVariable(
            symbol,
            scopeMembers,
            scopePrivateConstValues,
          );
          break;

        // Track function return types for enum validation
        case "function":
          TSymbolInfoAdapter.processFunction(symbol, functionReturnTypes);
          break;
      }
    }

    // Build the ISymbolInfo result
    const result: ICodeGenSymbols = {
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

      // Issue #948: Opaque types
      opaqueTypes,

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

  // Use shared utility for name mangling
  private static readonly getMangledName = SymbolNameUtils.getMangledName;

  private static processStruct(
    struct: IStructSymbol,
    knownStructs: Set<string>,
    structFields: Map<string, Map<string, string>>,
    structFieldArrays: Map<string, Set<string>>,
    structFieldDimensions: Map<string, Map<string, number[]>>,
  ): void {
    // Use mangled name for lookups (e.g., "Geometry_Point")
    const mangledName = TSymbolInfoAdapter.getMangledName(struct);
    knownStructs.add(mangledName);

    const fields = new Map<string, string>();
    const arrayFields = new Set<string>();
    const dimensions = new Map<string, number[]>();

    for (const [fieldName, fieldInfo] of struct.fields) {
      // Convert TType to string for legacy ISymbolInfo format
      const typeStr = TypeResolver.getTypeName(fieldInfo.type);
      fields.set(fieldName, typeStr);

      if (fieldInfo.isArray) {
        arrayFields.add(fieldName);

        if (fieldInfo.dimensions && fieldInfo.dimensions.length > 0) {
          // Filter to only include numeric dimensions
          const numericDims = fieldInfo.dimensions.filter(
            (d): d is number => typeof d === "number",
          );
          if (numericDims.length > 0) {
            dimensions.set(fieldName, numericDims);
          }
        }
      }
    }

    structFields.set(mangledName, fields);
    structFieldArrays.set(mangledName, arrayFields);
    if (dimensions.size > 0) {
      structFieldDimensions.set(mangledName, dimensions);
    }
  }

  private static processEnum(
    enumSym: IEnumSymbol,
    knownEnums: Set<string>,
    enumMembers: Map<string, Map<string, number>>,
  ): void {
    const mangledName = TSymbolInfoAdapter.getMangledName(enumSym);
    knownEnums.add(mangledName);
    enumMembers.set(mangledName, new Map(enumSym.members));
  }

  private static processBitmap(
    bitmap: IBitmapSymbol,
    knownBitmaps: Set<string>,
    bitmapFields: Map<string, Map<string, { offset: number; width: number }>>,
    bitmapBackingType: Map<string, string>,
    bitmapBitWidth: Map<string, number>,
  ): void {
    const mangledName = TSymbolInfoAdapter.getMangledName(bitmap);
    knownBitmaps.add(mangledName);
    bitmapBackingType.set(mangledName, bitmap.backingType);
    bitmapBitWidth.set(mangledName, bitmap.bitWidth);

    const fields = new Map<string, { offset: number; width: number }>();
    for (const [fieldName, fieldInfo] of bitmap.fields) {
      fields.set(fieldName, {
        offset: fieldInfo.offset,
        width: fieldInfo.width,
      });
    }
    bitmapFields.set(mangledName, fields);
  }

  private static processScope(
    scope: IScopeSymbol,
    knownScopes: Set<string>,
    scopeMembers: Map<string, Set<string>>,
    scopeMemberVisibility: Map<string, Map<string, "public" | "private">>,
  ): void {
    knownScopes.add(scope.name);

    // Use scope.members as the authoritative list of member names
    // This includes functions, variables, enums, structs, etc.
    const members = new Set<string>(scope.members);
    scopeMembers.set(scope.name, members);

    // Copy visibility map
    scopeMemberVisibility.set(scope.name, new Map(scope.memberVisibility));
  }

  private static processRegister(
    register: IRegisterSymbol,
    knownBitmaps: Set<string>,
    maps: IRegisterMaps,
  ): void {
    const mangledName = TSymbolInfoAdapter.getMangledName(register);
    maps.knownRegisters.add(mangledName);
    maps.registerBaseAddresses.set(mangledName, register.baseAddress);

    // Check if this is a scoped register (has non-global scope)
    const isScoped = register.scope.name !== "";
    if (isScoped) {
      maps.scopedRegisters.set(mangledName, register.baseAddress);
    }

    for (const [memberName, memberInfo] of register.members) {
      const fullName = `${mangledName}_${memberName}`;

      maps.registerMemberAccess.set(fullName, memberInfo.access);
      maps.registerMemberOffsets.set(fullName, memberInfo.offset);
      maps.registerMemberCTypes.set(
        fullName,
        TSymbolInfoAdapter.cnextTypeToCType(memberInfo.cType),
      );

      // Track bitmap types for register members
      if (memberInfo.bitmapType && knownBitmaps.has(memberInfo.bitmapType)) {
        maps.registerMemberTypes.set(fullName, memberInfo.bitmapType);
      }
    }
  }

  private static processVariable(
    variable: IVariableSymbol,
    scopeMembers: Map<string, Set<string>>,
    scopePrivateConstValues: Map<string, string>,
  ): void {
    const mangledName = TSymbolInfoAdapter.getMangledName(variable);
    const scopeName = variable.scope.name;
    const isScoped = scopeName !== "";

    // Track scoped variables as scope members (needed for name resolution)
    if (isScoped) {
      let members = scopeMembers.get(scopeName);
      if (!members) {
        members = new Set<string>();
        scopeMembers.set(scopeName, members);
      }
      members.add(variable.name); // Add local name (e.g., "value"), not mangled
    }

    // Issue #282: Track private const values for inlining
    const isPrivate = !variable.isExported;

    // Issue #500: Only inline SCALAR consts, not arrays - arrays must be emitted
    if (
      isScoped &&
      isPrivate &&
      variable.isConst &&
      variable.initialValue &&
      !variable.isArray
    ) {
      scopePrivateConstValues.set(mangledName, variable.initialValue);
    }
  }

  private static processFunction(
    func: IFunctionSymbol,
    functionReturnTypes: Map<string, string>,
  ): void {
    // Track function return types for enum validation in assignments
    // This enables recognizing that Motor.getMode() returns Motor_EMode
    // Use mangled name (e.g., "Motor_getMode") for lookup consistency
    const mangledName = TSymbolInfoAdapter.getMangledName(func);
    const returnTypeStr = TypeResolver.getTypeName(func.returnType);
    functionReturnTypes.set(mangledName, returnTypeStr);
  }

  private static cnextTypeToCType(typeName: string): string {
    return CNEXT_TO_C_TYPE_MAP[typeName] || typeName;
  }

  private static getSingleFunctionForVariable(
    scopeVariableUsage: Map<string, Set<string>>,
    scopeName: string,
    varName: string,
  ): string | null {
    const fullVarName = `${scopeName}_${varName}`;
    const usedIn = scopeVariableUsage.get(fullVarName);

    if (usedIn?.size !== 1) {
      return null;
    }

    // Extract the single element from the Set (we know it exists since size === 1)
    return [...usedIn][0];
  }

  /**
   * Create a deep copy of enum members map
   */
  private static _copyEnumMembers(
    enumMembers: ReadonlyMap<string, ReadonlyMap<string, number>>,
  ): Map<string, Map<string, number>> {
    const copy = new Map<string, Map<string, number>>();
    for (const [enumName, members] of enumMembers) {
      copy.set(enumName, new Map(members));
    }
    return copy;
  }

  /**
   * Merge a single external source into the merged data structures
   */
  private static _mergeExternalSource(
    external: ICodeGenSymbols,
    mergedKnownEnums: Set<string>,
    mergedKnownScopes: Set<string>,
    mergedEnumMembers: Map<string, Map<string, number>>,
    mergedFunctionReturnTypes: Map<string, string>,
  ): void {
    // Merge known enums
    for (const enumName of external.knownEnums) {
      mergedKnownEnums.add(enumName);
    }
    // Merge scopes from external sources for cross-scope method calls
    for (const scopeName of external.knownScopes) {
      mergedKnownScopes.add(scopeName);
    }
    // Merge enum members (local takes precedence)
    for (const [enumName, members] of external.enumMembers) {
      if (!mergedEnumMembers.has(enumName)) {
        mergedEnumMembers.set(enumName, new Map(members));
      }
    }
    // Merge function return types (local takes precedence)
    for (const [funcName, returnType] of external.functionReturnTypes) {
      if (!mergedFunctionReturnTypes.has(funcName)) {
        mergedFunctionReturnTypes.set(funcName, returnType);
      }
    }
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
    base: ICodeGenSymbols,
    externalEnumSources: ICodeGenSymbols[],
  ): ICodeGenSymbols {
    // If no external sources, return base unchanged
    if (externalEnumSources.length === 0) {
      return base;
    }

    // Create mutable copies of enum-related data and scope info
    const mergedKnownEnums = new Set(base.knownEnums);
    const mergedKnownScopes = new Set(base.knownScopes);
    const mergedEnumMembers = this._copyEnumMembers(base.enumMembers);
    const mergedFunctionReturnTypes = new Map(base.functionReturnTypes);

    // Merge in external enum info, function return types, and scopes
    for (const external of externalEnumSources) {
      this._mergeExternalSource(
        external,
        mergedKnownEnums,
        mergedKnownScopes,
        mergedEnumMembers,
        mergedFunctionReturnTypes,
      );
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

      // Issue #948: Opaque types - pass through from base
      opaqueTypes: base.opaqueTypes,

      // Methods - delegate to base's implementation
      getSingleFunctionForVariable: base.getSingleFunctionForVariable,
      hasPublicSymbols: base.hasPublicSymbols,
    };
  }

  /**
   * Issue #948: Merge opaque types from an external source (e.g., SymbolTable)
   * into an existing ICodeGenSymbols.
   *
   * Opaque types are forward-declared struct types (like `typedef struct _foo foo;`)
   * that come from C headers and need to be tracked for correct scope variable
   * generation (as pointers with NULL initialization).
   *
   * @param base The ICodeGenSymbols from the current file
   * @param externalOpaqueTypes Array of opaque type names from external sources
   * @returns New ICodeGenSymbols with merged opaque types
   */
  static mergeOpaqueTypes(
    base: ICodeGenSymbols,
    externalOpaqueTypes: string[],
  ): ICodeGenSymbols {
    // If no external opaque types, return base unchanged
    if (externalOpaqueTypes.length === 0) {
      return base;
    }

    // Create merged set with existing and external opaque types
    const mergedOpaqueTypes = new Set(base.opaqueTypes);
    for (const typeName of externalOpaqueTypes) {
      mergedOpaqueTypes.add(typeName);
    }

    // Return new ICodeGenSymbols with merged opaque types
    // All other fields remain unchanged from base
    return {
      // Type sets
      knownScopes: base.knownScopes,
      knownStructs: base.knownStructs,
      knownEnums: base.knownEnums,
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

      // Enum info
      enumMembers: base.enumMembers,

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

      // Function return types
      functionReturnTypes: base.functionReturnTypes,

      // Issue #948: Opaque types - merged
      opaqueTypes: mergedOpaqueTypes,

      // Methods - delegate to base's implementation
      getSingleFunctionForVariable: base.getSingleFunctionForVariable,
      hasPublicSymbols: base.hasPublicSymbols,
    };
  }
}

export default TSymbolInfoAdapter;
