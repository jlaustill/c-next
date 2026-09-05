/**
 * TSymbolInfoAdapter - Converts TSymbol[] to ISymbolInfo for CodeGenerator.
 *
 * ADR-055 Phase 5: This adapter enables CodeGenerator to use pre-collected
 * symbols from CNextResolver instead of creating its own SymbolCollector.
 *
 * The conversion extracts and restructures the rich discriminated union types
 * into the flat map format that CodeGenerator expects via ISymbolInfo.
 */

import type IBitmapFieldLayout from "../../../../types/IBitmapFieldLayout";
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
import ScopeUtils from "../../../../../utils/ScopeUtils";
import QualifiedCName from "../../../../../utils/QualifiedCName";
import PublicInterface from "../../PublicInterface";

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
/**
 * The mutable collections mergeExternalSymbols accumulates into.
 *
 * Grouped into one object rather than passed as eight parameters: adding the
 * three type-forming sets for #1333 took the parameter list past what is
 * readable, and a positional list of eight same-shaped collections is a
 * transposition waiting to happen.
 */
interface IMergeAccumulator {
  readonly knownEnums: Set<string>;
  readonly knownScopes: Set<string>;
  readonly enumMembers: Map<string, Map<string, number>>;
  readonly functionReturnTypes: Map<string, string>;
  readonly scopeMemberVisibility: Map<
    string,
    Map<string, "public" | "private">
  >;
  readonly knownStructs: Set<string>;
  readonly knownBitmaps: Set<string>;
  readonly knownVariables: Set<string>;
  readonly bitmapFields: Map<
    string,
    Map<string, { readonly offset: number; readonly width: number }>
  >;
  readonly bitmapBackingType: Map<string, string>;
  readonly bitmapBitWidth: Map<string, number>;
}

class TSymbolInfoAdapter {
  /**
   * Convert TSymbol[] to ISymbolInfo for CodeGenerator consumption.
   *
   * @param symbols Array of discriminated union symbols from CNextResolver
   * @returns ISymbolInfo compatible with CodeGenerator
   */
  static convert(symbols: readonly TSymbol[]): ICodeGenSymbols {
    // === Known Type Sets ===
    const knownScopes = new Set<string>();
    const knownStructs = new Set<string>();
    const knownEnums = new Set<string>();
    const knownBitmaps = new Set<string>();
    const knownRegisters = new Set<string>();

    // === Issue #1398: File-Scope Value Names ===
    const knownVariables = new Set<string>();

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
    const structFieldDimensions = new Map<
      string,
      Map<string, (number | string)[]>
    >();

    // === Enum Information ===
    const enumMembers = new Map<string, Map<string, number>>();

    // === Bitmap Information ===
    const bitmapFields = new Map<string, Map<string, IBitmapFieldLayout>>();
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
          // Track scope membership, private const values, and file-scope names
          TSymbolInfoAdapter.processVariable(
            symbol,
            scopeMembers,
            scopePrivateConstValues,
            knownVariables,
          );
          break;

        // Track function return types for enum validation
        case "function":
          TSymbolInfoAdapter.processFunction(symbol, functionReturnTypes);
          break;
      }
    }

    // Issue #1127: qualify struct field dimensions that name a symbol.
    //
    // A second pass, not inline in processStruct: structs and enums are
    // processed by one loop in symbol order, so knownEnums is still being
    // filled while structs are read. Qualifying inline would make the result
    // depend on whether the enum happens to be declared above the struct.
    TSymbolInfoAdapter.qualifyStructFieldDimensions(
      symbols,
      structFieldDimensions,
      knownEnums,
    );

    // Build the ISymbolInfo result
    const result: ICodeGenSymbols = {
      // Type sets
      knownScopes,
      knownStructs,
      knownEnums,
      knownBitmaps,
      knownRegisters,
      knownVariables,

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
      hasPublicInterface: PublicInterface.existsIn(symbols),

      getSingleFunctionForVariable: (scopeName: string, varName: string) =>
        TSymbolInfoAdapter.getSingleFunctionForVariable(
          scopeVariableUsage,
          scopeName,
          varName,
        ),
    };

    return result;
  }

  // === Private Processing Methods ===

  // Use shared utility for transpiled C names
  private static readonly getTranspiledCName = ScopeUtils.getTranspiledCName;

  private static processStruct(
    struct: IStructSymbol,
    knownStructs: Set<string>,
    structFields: Map<string, Map<string, string>>,
    structFieldArrays: Map<string, Set<string>>,
    structFieldDimensions: Map<string, Map<string, (number | string)[]>>,
  ): void {
    // Use transpiled C name for lookups (e.g., "Geometry_Point")
    const cName = TSymbolInfoAdapter.getTranspiledCName(struct);
    knownStructs.add(cName);

    const fields = new Map<string, string>();
    const arrayFields = new Set<string>();
    const dimensions = new Map<string, (number | string)[]>();

    for (const [fieldName, fieldInfo] of struct.fields) {
      // Convert TType to string for legacy ISymbolInfo format
      const typeStr = TypeResolver.getTypeName(fieldInfo.type);
      fields.set(fieldName, typeStr);

      if (fieldInfo.isArray) {
        arrayFields.add(fieldName);

        if (fieldInfo.dimensions && fieldInfo.dimensions.length > 0) {
          // Issue #1127: keep non-numeric dimensions. Filtering them out
          // dropped enum-qualified counts, so `u8[EColor.COUNT] slots` reached
          // the header as a scalar and the body as a bit-indexed value.
          // Filtering also shifted any dimension that followed a dropped one.
          dimensions.set(fieldName, [...fieldInfo.dimensions]);
        }
      }
    }

    structFields.set(cName, fields);
    structFieldArrays.set(cName, arrayFields);
    if (dimensions.size > 0) {
      structFieldDimensions.set(cName, dimensions);
    }
  }

  /**
   * Resolve struct field dimensions that name a symbol to their C identifier.
   *
   * Runs after every symbol has been seen, so `knownEnums` is complete and the
   * answer does not depend on declaration order. Numeric dimensions and plain
   * macro names pass through untouched.
   */
  private static qualifyStructFieldDimensions(
    symbols: readonly TSymbol[],
    structFieldDimensions: Map<string, Map<string, (number | string)[]>>,
    knownEnums: ReadonlySet<string>,
  ): void {
    const isKnownEnum = (qualifiedName: string): boolean =>
      knownEnums.has(qualifiedName);

    for (const symbol of symbols) {
      if (symbol.kind !== "struct") {
        continue;
      }
      const cName = TSymbolInfoAdapter.getTranspiledCName(symbol);
      const fieldDimensions = structFieldDimensions.get(cName);
      if (!fieldDimensions) {
        continue;
      }
      for (const [fieldName, dimensions] of fieldDimensions) {
        fieldDimensions.set(
          fieldName,
          dimensions.map((dimension) =>
            typeof dimension === "string"
              ? ScopeUtils.resolveDimensionName(
                  dimension,
                  symbol.scopePath,
                  isKnownEnum,
                )
              : dimension,
          ),
        );
      }
    }
  }

  private static processEnum(
    enumSym: IEnumSymbol,
    knownEnums: Set<string>,
    enumMembers: Map<string, Map<string, number>>,
  ): void {
    const cName = TSymbolInfoAdapter.getTranspiledCName(enumSym);
    knownEnums.add(cName);
    // #1318: members are symbols now. `ICodeGenSymbols.enumMembers` is the
    // name-to-value view codegen wants, so project rather than widen it --
    // handing codegen a symbol here would put a second symbol vocabulary in
    // the per-file view for no consumer that asked for one.
    enumMembers.set(
      cName,
      new Map(
        [...enumSym.members].map(([name, member]) => [name, member.value]),
      ),
    );
  }

  private static processBitmap(
    bitmap: IBitmapSymbol,
    knownBitmaps: Set<string>,
    bitmapFields: Map<string, Map<string, IBitmapFieldLayout>>,
    bitmapBackingType: Map<string, string>,
    bitmapBitWidth: Map<string, number>,
  ): void {
    const cName = TSymbolInfoAdapter.getTranspiledCName(bitmap);
    knownBitmaps.add(cName);
    bitmapBackingType.set(cName, bitmap.backingType);
    bitmapBitWidth.set(cName, bitmap.bitWidth);

    const fields = new Map<string, IBitmapFieldLayout>();
    for (const [fieldName, fieldInfo] of bitmap.fields) {
      fields.set(fieldName, {
        offset: fieldInfo.offset,
        width: fieldInfo.width,
      });
    }
    bitmapFields.set(cName, fields);
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
    const cName = TSymbolInfoAdapter.getTranspiledCName(register);
    maps.knownRegisters.add(cName);
    maps.registerBaseAddresses.set(cName, register.baseAddress);

    // Check if this is a scoped register (has non-global scope)
    const isScoped = !ScopeUtils.isGlobalScopePath(register.scopePath);
    if (isScoped) {
      maps.scopedRegisters.set(cName, register.baseAddress);
    }

    for (const [memberName, memberInfo] of register.members) {
      const fullName = QualifiedCName.fromParts([cName, memberName]);

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
    knownVariables: Set<string>,
  ): void {
    const cName = TSymbolInfoAdapter.getTranspiledCName(variable);
    // `scopeMembers` is keyed by the scope's LEAF name -- itself a leaf-only
    // encoder that collides at depth two, tracked as #1295 and unchanged here.
    const scopeName = ScopeUtils.leafOf(variable.scopePath);
    const isScoped = !ScopeUtils.isGlobalScopePath(variable.scopePath);

    // Track scoped variables as scope members (needed for name resolution)
    if (isScoped) {
      let members = scopeMembers.get(scopeName);
      if (!members) {
        members = new Set<string>();
        scopeMembers.set(scopeName, members);
      }
      members.add(variable.name); // Add local name (e.g., "value"), not transpiled C name
    } else {
      // Issue #1398: a file-scope variable is reachable by its bare name, which
      // is the key the run-wide table is indexed by -- so recording it here is
      // what lets the value check ask a per-file question instead of a run-wide
      // one. Scoped variables are excluded because they are NOT reachable bare;
      // they are reached through `scopeMembers` above, which the value check
      // already consults under a scope path.
      knownVariables.add(variable.name);
    }

    // Issue #282: Track private const values for inlining
    const isPrivate = variable.visibility === "private";

    // Issue #500: Only inline SCALAR consts, not arrays - arrays must be emitted
    if (
      isScoped &&
      isPrivate &&
      variable.isConst &&
      variable.initialValue &&
      !variable.isArray
    ) {
      scopePrivateConstValues.set(cName, variable.initialValue);
    }
  }

  private static processFunction(
    func: IFunctionSymbol,
    functionReturnTypes: Map<string, string>,
  ): void {
    // Track function return types for enum validation in assignments
    // This enables recognizing that Motor.getMode() returns Motor_EMode
    // Use transpiled C name (e.g., "Motor_getMode") for lookup consistency
    const cName = TSymbolInfoAdapter.getTranspiledCName(func);
    const returnTypeStr = TypeResolver.getTypeName(func.returnType);
    functionReturnTypes.set(cName, returnTypeStr);
  }

  private static cnextTypeToCType(typeName: string): string {
    return CNEXT_TO_C_TYPE_MAP[typeName] || typeName;
  }

  private static getSingleFunctionForVariable(
    scopeVariableUsage: Map<string, Set<string>>,
    scopeName: string,
    varName: string,
  ): string | null {
    // #1295: scopeVariableUsage is populated with leaf-built keys, so this
    // lookup matches it. Both move together or neither does.
    const fullVarName = QualifiedCName.fromParts([scopeName, varName]);
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
   * Deep-copy a scopeName -> (memberName -> visibility) map so the merged
   * result never aliases the base's inner maps.
   */
  private static _copyScopeMemberVisibility(
    scopeMemberVisibility: ReadonlyMap<
      string,
      ReadonlyMap<string, "public" | "private">
    >,
  ): Map<string, Map<string, "public" | "private">> {
    const copy = new Map<string, Map<string, "public" | "private">>();
    for (const [scopeName, visibility] of scopeMemberVisibility) {
      copy.set(scopeName, new Map(visibility));
    }
    return copy;
  }

  /**
   * Merge a single external source into the merged data structures
   */
  /**
   * Add every member of `from` into `into`. A name-only set: no precedence
   * question arises because the sets carry no payload.
   */
  private static _mergeNames(
    from: ReadonlySet<string>,
    into: Set<string>,
  ): void {
    for (const name of from) {
      into.add(name);
    }
  }

  /**
   * Merge `from` into `into`, **local wins**: an entry already present is never
   * overwritten by an external one.
   *
   * The nine merges in _mergeExternalSource were nine copies of this loop, which
   * is both the duplication and the cognitive complexity SonarCloud flagged
   * (S3776, 22 against 15). More to the point, "local takes precedence" was
   * restated nine times, so a tenth merge could silently choose otherwise.
   *
   * `clone` exists because half the values are Maps that must not be aliased
   * between the base and the merged result.
   */
  private static _mergePreferringLocal<K, V>(
    from: ReadonlyMap<K, V>,
    into: Map<K, V>,
    clone: (value: V) => V = (value) => value,
  ): void {
    for (const [key, value] of from) {
      if (!into.has(key)) {
        into.set(key, clone(value));
      }
    }
  }

  private static _mergeExternalSource(
    external: ICodeGenSymbols,
    into: IMergeAccumulator,
  ): void {
    // #1333: every type-forming kind crosses the include boundary on the same
    // terms. Only knownEnums did, so ADR-057 qualification was kind-dependent: in
    // a scope spanning two files, an enum declared in the other file qualified and
    // a struct did not. Adjacent lines in one function emitted `Lib__Mode m` and
    // bare `Point p` -- the second does not compile. The asymmetry was invisible
    // while a scope could not span files at all, which is the bug this shipped with.
    TSymbolInfoAdapter._mergeNames(external.knownEnums, into.knownEnums);
    TSymbolInfoAdapter._mergeNames(external.knownStructs, into.knownStructs);
    TSymbolInfoAdapter._mergeNames(external.knownBitmaps, into.knownBitmaps);

    // Issue #1190: the visibility map travels with the scope name. Registering a
    // scope as known while leaving its visibility unknown makes every member of an
    // included scope look public, because the access check reads `undefined` and
    // only rejects an explicit "private".
    TSymbolInfoAdapter._mergeNames(external.knownScopes, into.knownScopes);

    // Issue #1398: file-scope VALUE names cross on the same terms as the
    // type-forming kinds above. The #1333 asymmetry this function was written to
    // fix was between two kinds of type; this is the same asymmetry one axis
    // over -- a type declared in an included file resolved and a const declared
    // beside it did not, so E0426 fired cross-file and E0427 could not.
    TSymbolInfoAdapter._mergeNames(
      external.knownVariables,
      into.knownVariables,
    );

    // A type's NAME is not enough; its detail travels with it. enumMembers already
    // moved with knownEnums, which is exactly why enums were the only kind that
    // ever worked -- carrying knownBitmaps alone let a cross-file bitmap type
    // resolve and then hard-error on the field behind it ("Unknown bitmap field
    // 'Mode' on type 'Lib__Flags'"). Same asymmetry, one level down.
    const cloneMap = <K, V>(m: ReadonlyMap<K, V>): Map<K, V> => new Map(m);

    TSymbolInfoAdapter._mergePreferringLocal(
      external.enumMembers,
      into.enumMembers,
      cloneMap,
    );
    TSymbolInfoAdapter._mergePreferringLocal(
      external.bitmapFields,
      into.bitmapFields,
      cloneMap,
    );
    TSymbolInfoAdapter._mergePreferringLocal(
      external.bitmapBackingType,
      into.bitmapBackingType,
    );
    TSymbolInfoAdapter._mergePreferringLocal(
      external.bitmapBitWidth,
      into.bitmapBitWidth,
    );
    TSymbolInfoAdapter._mergePreferringLocal(
      external.scopeMemberVisibility,
      into.scopeMemberVisibility,
      cloneMap,
    );
    TSymbolInfoAdapter._mergePreferringLocal(
      external.functionReturnTypes,
      into.functionReturnTypes,
    );
  }

  /**
   * Issue #465: Merge external symbol info into an existing ISymbolInfo.
   *
   * When a file includes other .cnx files, the enum types and scopes from those
   * external files need to be available for code generation. This enables:
   * - Enum member prefixing for external enums
   * - Cross-scope method calls like global.Scope.method() returning enums
   * - Visibility enforcement on members of included scopes (#1190)
   *
   * This method creates a new ISymbolInfo that includes both the base symbols
   * and merged info from external sources.
   *
   * @param base The ISymbolInfo from the current file
   * @param externalSources Array of ISymbolInfo from included .cnx files
   * @returns New ISymbolInfo with merged enum, scope and visibility data
   */
  static mergeExternalSymbols(
    base: ICodeGenSymbols,
    externalSources: readonly ICodeGenSymbols[],
  ): ICodeGenSymbols {
    // If no external sources, return base unchanged
    if (externalSources.length === 0) {
      return base;
    }

    // Create mutable copies of enum-related data and scope info
    const mergedKnownEnums = new Set(base.knownEnums);
    const mergedKnownScopes = new Set(base.knownScopes);
    const mergedKnownStructs = new Set(base.knownStructs);
    const mergedKnownBitmaps = new Set(base.knownBitmaps);
    const mergedKnownVariables = new Set(base.knownVariables);
    const mergedBitmapFields = new Map(
      [...base.bitmapFields].map(([name, fields]) => [name, new Map(fields)]),
    );
    const mergedBitmapBackingType = new Map(base.bitmapBackingType);
    const mergedBitmapBitWidth = new Map(base.bitmapBitWidth);
    const mergedEnumMembers = this._copyEnumMembers(base.enumMembers);
    const mergedFunctionReturnTypes = new Map(base.functionReturnTypes);
    const mergedScopeMemberVisibility = this._copyScopeMemberVisibility(
      base.scopeMemberVisibility,
    );

    // Merge in external enum info, function return types, scopes and visibility
    for (const external of externalSources) {
      this._mergeExternalSource(external, {
        knownEnums: mergedKnownEnums,
        knownScopes: mergedKnownScopes,
        enumMembers: mergedEnumMembers,
        functionReturnTypes: mergedFunctionReturnTypes,
        scopeMemberVisibility: mergedScopeMemberVisibility,
        knownStructs: mergedKnownStructs,
        knownBitmaps: mergedKnownBitmaps,
        bitmapFields: mergedBitmapFields,
        bitmapBackingType: mergedBitmapBackingType,
        bitmapBitWidth: mergedBitmapBitWidth,
        knownVariables: mergedKnownVariables,
      });
    }

    // Return new ICodeGenSymbols with merged enum data and scope info
    return {
      ...base,
      knownScopes: mergedKnownScopes,
      knownEnums: mergedKnownEnums,
      knownStructs: mergedKnownStructs,
      knownBitmaps: mergedKnownBitmaps,
      bitmapFields: mergedBitmapFields,
      bitmapBackingType: mergedBitmapBackingType,
      bitmapBitWidth: mergedBitmapBitWidth,
      enumMembers: mergedEnumMembers,
      functionReturnTypes: mergedFunctionReturnTypes,
      scopeMemberVisibility: mergedScopeMemberVisibility,
      knownVariables: mergedKnownVariables,
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
    return { ...base, opaqueTypes: mergedOpaqueTypes };
  }
}

export default TSymbolInfoAdapter;
