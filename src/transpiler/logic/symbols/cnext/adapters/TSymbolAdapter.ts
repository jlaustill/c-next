/**
 * TSymbolAdapter - Converts TSymbol[] to ISymbol[] for backwards compatibility.
 *
 * This adapter bridges the gap between the new composable collectors (which return
 * rich discriminated union types) and the existing Pipeline/SymbolTable infrastructure
 * (which uses flat ISymbol objects).
 *
 * ADR-055 Phase 3: This enables gradual migration without breaking consumers.
 */

import ISymbol from "../../../../../utils/types/ISymbol";
import SymbolTable from "../../SymbolTable";
import TSymbol from "../../../../types/symbols/TSymbol";
import IBitmapSymbol from "../../../../types/symbols/IBitmapSymbol";
import IEnumSymbol from "../../../../types/symbols/IEnumSymbol";
import IStructSymbol from "../../../../types/symbols/IStructSymbol";
import IFunctionSymbol from "../../../../types/symbols/IFunctionSymbol";
import IVariableSymbol from "../../../../types/symbols/IVariableSymbol";
import IRegisterSymbol from "../../../../types/symbols/IRegisterSymbol";
import IScopeSymbol from "../../../../types/symbols/IScopeSymbol";
import TypeResolver from "../../../../types/TypeResolver";
import ScopeUtils from "../../../../types/ScopeUtils";
import SymbolNameUtils from "../utils/SymbolNameUtils";

/** Get minimum unsigned type width for a bit count */
function getMinBitWidth(width: number): number {
  if (width <= 8) return 8;
  if (width <= 16) return 16;
  return 32;
}

/**
 * Extract the parent scope name from an IBaseSymbol.
 * Returns undefined for global scope (empty name).
 */
function getParentName(symbol: {
  scope: { name: string };
}): string | undefined {
  const scopeName = symbol.scope.name;
  return scopeName === "" ? undefined : scopeName;
}

// Use shared utility for name mangling
const getMangledName = SymbolNameUtils.getMangledName;

/**
 * Adapts TSymbol[] to ISymbol[] and registers struct fields in SymbolTable.
 */
class TSymbolAdapter {
  /**
   * Convert TSymbol[] to ISymbol[] for backwards compatibility.
   * Also registers struct fields in SymbolTable.
   *
   * @param symbols Array of discriminated union symbols from collectors
   * @param symbolTable SymbolTable for struct field registration and type resolution
   * @returns Array of flat ISymbol objects for Pipeline consumption
   */
  static toISymbols(symbols: TSymbol[], symbolTable: SymbolTable): ISymbol[] {
    const result: ISymbol[] = [];

    for (const symbol of symbols) {
      switch (symbol.kind) {
        case "bitmap":
          result.push(...TSymbolAdapter.convertBitmap(symbol));
          break;
        case "enum":
          result.push(...TSymbolAdapter.convertEnum(symbol));
          break;
        case "struct":
          result.push(TSymbolAdapter.convertStruct(symbol, symbolTable));
          break;
        case "function":
          result.push(...TSymbolAdapter.convertFunction(symbol));
          break;
        case "variable":
          result.push(TSymbolAdapter.convertVariable(symbol));
          break;
        case "register":
          result.push(...TSymbolAdapter.convertRegister(symbol));
          break;
        case "scope":
          result.push(TSymbolAdapter.convertScope(symbol));
          break;
      }
    }

    return result;
  }

  /**
   * Convert an array dimension to a string for header generation.
   * Converts qualified enum access (e.g., "EColor.COUNT") to C-style ("EColor_COUNT").
   */
  private static resolveArrayDimension(dim: number | string): string {
    if (typeof dim === "number") {
      return String(dim);
    }

    // Qualified enum access (e.g., "EColor.COUNT") - convert dots to underscores
    if (dim.includes(".")) {
      return dim.replaceAll(".", "_");
    }

    // Pass through as-is (C macros, other identifiers)
    return dim;
  }

  /**
   * Convert IBitmapSymbol to ISymbol + BitmapField symbols.
   */
  private static convertBitmap(bitmap: IBitmapSymbol): ISymbol[] {
    const result: ISymbol[] = [];
    // Use mangled name for C output (e.g., "Motor_Flags")
    const mangledName = getMangledName(bitmap);

    // Main bitmap symbol
    result.push({
      name: mangledName,
      kind: "bitmap",
      type: bitmap.backingType,
      sourceFile: bitmap.sourceFile,
      sourceLine: bitmap.sourceLine,
      sourceLanguage: bitmap.sourceLanguage,
      isExported: bitmap.isExported,
      parent: getParentName(bitmap),
    });

    // Expand fields to BitmapField symbols
    for (const [fieldName, fieldInfo] of bitmap.fields) {
      const width = fieldInfo.width;
      const bitEnd = fieldInfo.offset + width - 1;
      const bitRange =
        width === 1
          ? `bit ${fieldInfo.offset}`
          : `bits ${fieldInfo.offset}-${bitEnd}`;

      result.push({
        name: `${mangledName}_${fieldName}`,
        kind: "bitmap_field",
        type: width === 1 ? "bool" : `u${getMinBitWidth(width)}`,
        sourceFile: bitmap.sourceFile,
        sourceLine: bitmap.sourceLine,
        sourceLanguage: bitmap.sourceLanguage,
        isExported: bitmap.isExported,
        parent: mangledName,
        signature: `${bitRange} (${width} bit${width > 1 ? "s" : ""})`,
      });
    }

    return result;
  }

  /**
   * Convert IEnumSymbol to ISymbol + EnumMember symbols for hover support.
   */
  private static convertEnum(enumSym: IEnumSymbol): ISymbol[] {
    const result: ISymbol[] = [];
    // Use mangled name for C output (e.g., "Motor_EMode")
    const mangledName = getMangledName(enumSym);

    // Main enum symbol
    result.push({
      name: mangledName,
      kind: "enum",
      sourceFile: enumSym.sourceFile,
      sourceLine: enumSym.sourceLine,
      sourceLanguage: enumSym.sourceLanguage,
      isExported: enumSym.isExported,
      parent: getParentName(enumSym),
    });

    // Create EnumMember symbols for hover/autocomplete
    // Note: sourceLine points to the enum declaration — IEnumSymbol.members
    // is Map<string, number> (name → value) with no per-member line info.
    for (const [memberName, memberValue] of enumSym.members) {
      result.push({
        name: memberName,
        kind: "enum_member",
        type: String(memberValue),
        sourceFile: enumSym.sourceFile,
        sourceLine: enumSym.sourceLine,
        sourceLanguage: enumSym.sourceLanguage,
        isExported: enumSym.isExported,
        parent: mangledName,
      });
    }

    return result;
  }

  /**
   * Convert IStructSymbol to ISymbol and register fields in SymbolTable.
   */
  private static convertStruct(
    struct: IStructSymbol,
    symbolTable: SymbolTable,
  ): ISymbol {
    // Use mangled name for C output (e.g., "Geometry_Point")
    const mangledName = getMangledName(struct);

    // Register struct fields in SymbolTable for TypeResolver.isStructType()
    for (const [fieldName, fieldInfo] of struct.fields) {
      // Convert TType to string for SymbolTable
      const typeString = TypeResolver.getTypeName(fieldInfo.type);
      // Filter to only numeric dimensions (SymbolTable doesn't support string dims)
      const numericDims = fieldInfo.dimensions?.filter(
        (d): d is number => typeof d === "number",
      );
      symbolTable.addStructField(
        mangledName,
        fieldName,
        typeString,
        numericDims && numericDims.length > 0 ? numericDims : undefined,
      );
    }

    return {
      name: mangledName,
      kind: "struct",
      sourceFile: struct.sourceFile,
      sourceLine: struct.sourceLine,
      sourceLanguage: struct.sourceLanguage,
      isExported: struct.isExported,
      parent: getParentName(struct),
    };
  }

  /**
   * Convert IFunctionSymbol to ISymbol + parameter symbols for hover support.
   * Converts TType to string for legacy ISymbol format.
   */
  private static convertFunction(func: IFunctionSymbol): ISymbol[] {
    const result: ISymbol[] = [];

    // Convert TType to string for signature
    const returnTypeStr = TypeResolver.getTypeName(func.returnType);
    const paramTypes = func.parameters.map((p) =>
      TypeResolver.getTypeName(p.type),
    );

    // Get mangled name for signature
    const mangledName = ScopeUtils.isGlobalScope(func.scope)
      ? func.name
      : `${ScopeUtils.getScopePath(func.scope).join("_")}_${func.name}`;

    const signature = `${returnTypeStr} ${mangledName}(${paramTypes.join(", ")})`;

    // Build parameter info for header generation
    const parameters = func.parameters.map((p) => ({
      name: p.name,
      type: TypeResolver.getTypeName(p.type),
      isConst: p.isConst,
      isArray: p.isArray,
      arrayDimensions: p.arrayDimensions?.map((dim) =>
        TSymbolAdapter.resolveArrayDimension(dim),
      ),
      isAutoConst: p.isAutoConst,
    }));

    // Main function symbol - use mangled name for ISymbol.name
    result.push({
      name: mangledName,
      kind: "function",
      type: returnTypeStr,
      sourceFile: func.sourceFile,
      sourceLine: func.sourceLine,
      sourceLanguage: func.sourceLanguage,
      isExported: func.isExported,
      parent: getParentName(func),
      signature,
      parameters,
    });

    // Create parameter symbols for hover support
    for (const param of func.parameters) {
      const paramTypeStr = TypeResolver.getTypeName(param.type);
      const displayType = param.isArray ? `${paramTypeStr}[]` : paramTypeStr;

      result.push({
        name: param.name,
        kind: "variable",
        type: displayType,
        sourceFile: func.sourceFile,
        sourceLine: func.sourceLine,
        sourceLanguage: func.sourceLanguage,
        isExported: false,
        parent: mangledName,
      });
    }

    return result;
  }

  /**
   * Convert IVariableSymbol to ISymbol.
   * Converts TType to string and qualified enum names in array dimensions.
   */
  private static convertVariable(variable: IVariableSymbol): ISymbol {
    // Use mangled name for C output (e.g., "Motor_speed")
    const mangledName = getMangledName(variable);

    // Convert TType to string
    const typeStr = TypeResolver.getTypeName(variable.type);

    // Convert dimensions to string dimensions
    const arrayDimensions = variable.arrayDimensions?.map((dim) =>
      TSymbolAdapter.resolveArrayDimension(dim),
    );

    // Get first dimension for legacy size field (only if numeric)
    const firstDim = variable.arrayDimensions?.[0];
    const size = typeof firstDim === "number" ? firstDim : undefined;

    const result: ISymbol = {
      name: mangledName,
      kind: "variable",
      type: typeStr,
      sourceFile: variable.sourceFile,
      sourceLine: variable.sourceLine,
      sourceLanguage: variable.sourceLanguage,
      isExported: variable.isExported,
      parent: getParentName(variable),
      isConst: variable.isConst,
      isAtomic: variable.isAtomic,
      isArray: variable.isArray,
      arrayDimensions,
      size,
    };

    // Issue #461: Preserve initialValue for const variables (needed for external array dimension resolution)
    if (variable.initialValue !== undefined) {
      result.initialValue = variable.initialValue;
    }

    return result;
  }

  /**
   * Convert IRegisterSymbol to ISymbol + RegisterMember symbols.
   */
  private static convertRegister(register: IRegisterSymbol): ISymbol[] {
    const result: ISymbol[] = [];
    // Use mangled name for C output (e.g., "Motor_CTRL")
    const mangledName = getMangledName(register);

    // Main register symbol
    result.push({
      name: mangledName,
      kind: "register",
      sourceFile: register.sourceFile,
      sourceLine: register.sourceLine,
      sourceLanguage: register.sourceLanguage,
      isExported: register.isExported,
      parent: getParentName(register),
    });

    // Expand members to RegisterMember symbols
    for (const [memberName, memberInfo] of register.members) {
      result.push({
        name: `${mangledName}_${memberName}`,
        kind: "register_member",
        type: memberInfo.cType,
        sourceFile: register.sourceFile,
        sourceLine: register.sourceLine,
        sourceLanguage: register.sourceLanguage,
        isExported: register.isExported,
        parent: mangledName,
        accessModifier: memberInfo.access,
      });
    }

    return result;
  }

  /**
   * Convert IScopeSymbol to ISymbol.
   * Note: Scope members are collected as separate symbols by ScopeCollector,
   * so we only need to convert the scope itself.
   */
  private static convertScope(scope: IScopeSymbol): ISymbol {
    return {
      name: scope.name,
      kind: "scope",
      sourceFile: scope.sourceFile,
      sourceLine: scope.sourceLine,
      sourceLanguage: scope.sourceLanguage,
      isExported: scope.isExported,
    };
  }
}

export default TSymbolAdapter;
