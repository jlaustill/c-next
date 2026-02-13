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
import TSymbol from "../../types/TSymbol";
import IBitmapSymbol from "../../types/IBitmapSymbol";
import IEnumSymbol from "../../types/IEnumSymbol";
import IStructSymbol from "../../types/IStructSymbol";
import IFunctionSymbol from "../../types/IFunctionSymbol";
import IVariableSymbol from "../../types/IVariableSymbol";
import IRegisterSymbol from "../../types/IRegisterSymbol";
import IScopeSymbol from "../../types/IScopeSymbol";

/** Get minimum unsigned type width for a bit count */
function getMinBitWidth(width: number): number {
  if (width <= 8) return 8;
  if (width <= 16) return 16;
  return 32;
}

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

    // Main bitmap symbol
    result.push({
      name: bitmap.name,
      kind: "bitmap",
      type: bitmap.backingType,
      sourceFile: bitmap.sourceFile,
      sourceLine: bitmap.sourceLine,
      sourceLanguage: bitmap.sourceLanguage,
      isExported: bitmap.isExported,
      parent: bitmap.parent,
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
        name: `${bitmap.name}_${fieldName}`,
        kind: "bitmap_field",
        type: width === 1 ? "bool" : `u${getMinBitWidth(width)}`,
        sourceFile: bitmap.sourceFile,
        sourceLine: bitmap.sourceLine,
        sourceLanguage: bitmap.sourceLanguage,
        isExported: bitmap.isExported,
        parent: bitmap.name,
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

    // Main enum symbol
    result.push({
      name: enumSym.name,
      kind: "enum",
      sourceFile: enumSym.sourceFile,
      sourceLine: enumSym.sourceLine,
      sourceLanguage: enumSym.sourceLanguage,
      isExported: enumSym.isExported,
      parent: enumSym.parent,
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
        parent: enumSym.name,
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
    // Register struct fields in SymbolTable for TypeResolver.isStructType()
    for (const [fieldName, fieldInfo] of struct.fields) {
      symbolTable.addStructField(
        struct.name,
        fieldName,
        fieldInfo.type,
        fieldInfo.dimensions,
      );
    }

    return {
      name: struct.name,
      kind: "struct",
      sourceFile: struct.sourceFile,
      sourceLine: struct.sourceLine,
      sourceLanguage: struct.sourceLanguage,
      isExported: struct.isExported,
      parent: struct.parent,
    };
  }

  /**
   * Convert IFunctionSymbol to ISymbol + parameter symbols for hover support.
   * Converts qualified enum names in parameter array dimensions.
   */
  private static convertFunction(func: IFunctionSymbol): ISymbol[] {
    const result: ISymbol[] = [];

    // Build parameter types for signature
    const paramTypes = func.parameters.map((p) => p.type);
    const signature = `${func.returnType} ${func.name}(${paramTypes.join(", ")})`;

    // Build parameter info for header generation
    const parameters = func.parameters.map((p) => ({
      name: p.name,
      type: p.type,
      isConst: p.isConst,
      isArray: p.isArray,
      arrayDimensions: p.arrayDimensions?.map((dim) =>
        TSymbolAdapter.resolveArrayDimension(dim),
      ),
      isAutoConst: p.isAutoConst,
    }));

    // Main function symbol
    result.push({
      name: func.name,
      kind: "function",
      type: func.returnType,
      sourceFile: func.sourceFile,
      sourceLine: func.sourceLine,
      sourceLanguage: func.sourceLanguage,
      isExported: func.isExported,
      parent: func.parent,
      signature,
      parameters,
    });

    // Create parameter symbols for hover support
    for (const param of func.parameters) {
      const displayType = param.isArray ? `${param.type}[]` : param.type;

      result.push({
        name: param.name,
        kind: "variable",
        type: displayType,
        sourceFile: func.sourceFile,
        sourceLine: func.sourceLine,
        sourceLanguage: func.sourceLanguage,
        isExported: false,
        parent: func.name,
      });
    }

    return result;
  }

  /**
   * Convert IVariableSymbol to ISymbol.
   * Converts qualified enum names in array dimensions.
   */
  private static convertVariable(variable: IVariableSymbol): ISymbol {
    // Convert dimensions to string dimensions
    const arrayDimensions = variable.arrayDimensions?.map((dim) =>
      TSymbolAdapter.resolveArrayDimension(dim),
    );

    // Get first dimension for legacy size field (only if numeric)
    const firstDim = variable.arrayDimensions?.[0];
    const size = typeof firstDim === "number" ? firstDim : undefined;

    const result: ISymbol = {
      name: variable.name,
      kind: "variable",
      type: variable.type,
      sourceFile: variable.sourceFile,
      sourceLine: variable.sourceLine,
      sourceLanguage: variable.sourceLanguage,
      isExported: variable.isExported,
      parent: variable.parent,
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

    // Main register symbol
    result.push({
      name: register.name,
      kind: "register",
      sourceFile: register.sourceFile,
      sourceLine: register.sourceLine,
      sourceLanguage: register.sourceLanguage,
      isExported: register.isExported,
      parent: register.parent,
    });

    // Expand members to RegisterMember symbols
    for (const [memberName, memberInfo] of register.members) {
      result.push({
        name: `${register.name}_${memberName}`,
        kind: "register_member",
        type: memberInfo.cType,
        sourceFile: register.sourceFile,
        sourceLine: register.sourceLine,
        sourceLanguage: register.sourceLanguage,
        isExported: register.isExported,
        parent: register.name,
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
