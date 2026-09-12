/**
 * TSymbolInfoAdapter - Converts TSymbol[] to ISymbolInfo for CodeGenerator.
 *
 * ADR-055 Phase 5: This adapter enables CodeGenerator to use pre-collected
 * symbols from CNextResolver instead of creating its own SymbolCollector.
 *
 * The conversion extracts and restructures the rich discriminated union types
 * into the flat map format that CodeGenerator expects via ISymbolInfo.
 */

import type IBitmapFieldLayout from "../../../../transpiler/types/IBitmapFieldLayout";
import ICodeGenSymbols from "../../../../transpiler/types/ICodeGenSymbols";
import CNEXT_TO_C_TYPE_MAP from "../../../../utils/constants/TypeMappings";
import TSymbol from "../../../../transpiler/types/symbols/TSymbol";
import IBitmapSymbol from "../../../../transpiler/types/symbols/IBitmapSymbol";
import IEnumSymbol from "../../../../transpiler/types/symbols/IEnumSymbol";
import IFunctionSymbol from "../../../../transpiler/types/symbols/IFunctionSymbol";
import IStructSymbol from "../../../../transpiler/types/symbols/IStructSymbol";
import IRegisterSymbol from "../../../../transpiler/types/symbols/IRegisterSymbol";
import IScopeSymbol from "../../../../transpiler/types/symbols/IScopeSymbol";
import IVariableSymbol from "../../../../transpiler/types/symbols/IVariableSymbol";
import TypeResolver from "../../../../utils/TypeResolver";
import ScopeUtils from "../../../../utils/ScopeUtils";
import QualifiedCName from "../../../../utils/QualifiedCName";

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

  /**
   * Merge a single external source into the merged data structures
   */
}

export default TSymbolInfoAdapter;
