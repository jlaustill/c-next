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
import ESymbolKind from "../../../../../utils/types/ESymbolKind";
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
        case ESymbolKind.Bitmap:
          result.push(...TSymbolAdapter.convertBitmap(symbol));
          break;
        case ESymbolKind.Enum:
          result.push(TSymbolAdapter.convertEnum(symbol));
          break;
        case ESymbolKind.Struct:
          result.push(TSymbolAdapter.convertStruct(symbol, symbolTable));
          break;
        case ESymbolKind.Function:
          result.push(...TSymbolAdapter.convertFunction(symbol));
          break;
        case ESymbolKind.Variable:
          result.push(TSymbolAdapter.convertVariable(symbol));
          break;
        case ESymbolKind.Register:
          result.push(...TSymbolAdapter.convertRegister(symbol));
          break;
        case ESymbolKind.Namespace:
          result.push(TSymbolAdapter.convertScope(symbol));
          break;
      }
    }

    return result;
  }

  /**
   * Convert IBitmapSymbol to ISymbol + BitmapField symbols.
   */
  private static convertBitmap(bitmap: IBitmapSymbol): ISymbol[] {
    const result: ISymbol[] = [];

    // Main bitmap symbol
    result.push({
      name: bitmap.name,
      kind: ESymbolKind.Bitmap,
      type: bitmap.backingType,
      sourceFile: bitmap.sourceFile,
      sourceLine: bitmap.sourceLine,
      sourceLanguage: bitmap.sourceLanguage,
      isExported: bitmap.isExported,
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
        kind: ESymbolKind.BitmapField,
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
   * Convert IEnumSymbol to ISymbol.
   * Note: Enum members are accessed via Enum.Member syntax, so we don't create
   * separate symbols for members (they're stored in IEnumSymbol.members for access).
   */
  private static convertEnum(enumSym: IEnumSymbol): ISymbol {
    return {
      name: enumSym.name,
      kind: ESymbolKind.Enum,
      sourceFile: enumSym.sourceFile,
      sourceLine: enumSym.sourceLine,
      sourceLanguage: enumSym.sourceLanguage,
      isExported: enumSym.isExported,
    };
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
      kind: ESymbolKind.Struct,
      sourceFile: struct.sourceFile,
      sourceLine: struct.sourceLine,
      sourceLanguage: struct.sourceLanguage,
      isExported: struct.isExported,
    };
  }

  /**
   * Convert IFunctionSymbol to ISymbol + parameter symbols for hover support.
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
      arrayDimensions: p.arrayDimensions,
      isAutoConst: p.isAutoConst,
    }));

    // Main function symbol
    result.push({
      name: func.name,
      kind: ESymbolKind.Function,
      type: func.returnType,
      sourceFile: func.sourceFile,
      sourceLine: func.sourceLine,
      sourceLanguage: func.sourceLanguage,
      isExported: func.isExported,
      signature,
      parameters,
    });

    // Create parameter symbols for hover support
    for (const param of func.parameters) {
      const displayType = param.isArray ? `${param.type}[]` : param.type;

      result.push({
        name: param.name,
        kind: ESymbolKind.Variable,
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
   */
  private static convertVariable(variable: IVariableSymbol): ISymbol {
    // Convert dimensions to string dimensions for ISymbol
    const arrayDimensions = variable.arrayDimensions?.map(String);

    // Get first dimension for legacy size field (only if numeric)
    const firstDim = variable.arrayDimensions?.[0];
    const size = typeof firstDim === "number" ? firstDim : undefined;

    const result: ISymbol = {
      name: variable.name,
      kind: ESymbolKind.Variable,
      type: variable.type,
      sourceFile: variable.sourceFile,
      sourceLine: variable.sourceLine,
      sourceLanguage: variable.sourceLanguage,
      isExported: variable.isExported,
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
      kind: ESymbolKind.Register,
      sourceFile: register.sourceFile,
      sourceLine: register.sourceLine,
      sourceLanguage: register.sourceLanguage,
      isExported: register.isExported,
    });

    // Expand members to RegisterMember symbols
    for (const [memberName, memberInfo] of register.members) {
      result.push({
        name: `${register.name}_${memberName}`,
        kind: ESymbolKind.RegisterMember,
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
      kind: ESymbolKind.Namespace,
      sourceFile: scope.sourceFile,
      sourceLine: scope.sourceLine,
      sourceLanguage: scope.sourceLanguage,
      isExported: scope.isExported,
    };
  }
}

export default TSymbolAdapter;
