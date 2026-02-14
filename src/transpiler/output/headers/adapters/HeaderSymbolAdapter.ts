/**
 * HeaderSymbolAdapter - Converts TSymbol to IHeaderSymbol.
 *
 * ADR-055 Phase 7: This adapter converts the TSymbol discriminated union
 * to IHeaderSymbol for header generation.
 */

import TSymbol from "../../../types/symbols/TSymbol";
import IHeaderSymbol from "../types/IHeaderSymbol";
import IParameterSymbol from "../../../../utils/types/IParameterSymbol";
import TypeResolver from "../../../../utils/TypeResolver";
import SymbolNameUtils from "../../../logic/symbols/cnext/utils/SymbolNameUtils";

/**
 * Adapter to convert TSymbol to IHeaderSymbol
 */
class HeaderSymbolAdapter {
  /**
   * Convert a TSymbol to IHeaderSymbol
   */
  static fromTSymbol(symbol: TSymbol): IHeaderSymbol {
    switch (symbol.kind) {
      case "function":
        return HeaderSymbolAdapter.convertFunction(symbol);
      case "variable":
        return HeaderSymbolAdapter.convertVariable(symbol);
      case "struct":
        return HeaderSymbolAdapter.convertStruct(symbol);
      case "enum":
        return HeaderSymbolAdapter.convertEnum(symbol);
      case "bitmap":
        return HeaderSymbolAdapter.convertBitmap(symbol);
      case "register":
        return HeaderSymbolAdapter.convertRegister(symbol);
      case "scope":
        return HeaderSymbolAdapter.convertScope(symbol);
    }
  }

  /**
   * Convert an array of TSymbols to IHeaderSymbols
   */
  static fromTSymbols(symbols: TSymbol[]): IHeaderSymbol[] {
    return symbols.map((s) => HeaderSymbolAdapter.fromTSymbol(s));
  }

  // ========================================================================
  // Private conversion methods for each TSymbol kind
  // ========================================================================

  private static convertFunction(
    func: import("../../../types/symbols/IFunctionSymbol").default,
  ): IHeaderSymbol {
    // Convert TType return type to string
    const returnTypeStr = TypeResolver.getTypeName(func.returnType);

    // Get mangled name (scope-prefixed)
    const mangledName = SymbolNameUtils.getMangledName(func);
    const isGlobal = func.scope.name === "";

    // Convert parameters to IParameterSymbol[]
    const parameters: IParameterSymbol[] = func.parameters.map((p) => ({
      name: p.name,
      type: TypeResolver.getTypeName(p.type),
      isConst: p.isConst,
      isArray: p.isArray,
      arrayDimensions: p.arrayDimensions?.map((d) =>
        typeof d === "number" ? String(d) : d,
      ),
      isAutoConst: p.isAutoConst,
    }));

    // Build signature
    const paramTypes = func.parameters.map((p) =>
      TypeResolver.getTypeName(p.type),
    );
    const signature = `${returnTypeStr} ${mangledName}(${paramTypes.join(", ")})`;

    return {
      name: mangledName,
      kind: "function",
      type: returnTypeStr,
      isExported: func.isExported,
      parameters,
      signature,
      parent: isGlobal ? undefined : func.scope.name,
      sourceFile: func.sourceFile,
      sourceLine: func.sourceLine,
    };
  }

  private static convertVariable(
    variable: import("../../../types/symbols/IVariableSymbol").default,
  ): IHeaderSymbol {
    // Get mangled name (scope-prefixed)
    const mangledName = SymbolNameUtils.getMangledName(variable);
    const isGlobal = variable.scope.name === "";

    // Convert TType to string
    const typeStr = TypeResolver.getTypeName(variable.type);

    // Convert dimensions to strings and resolve qualified enum access
    const arrayDimensions = variable.arrayDimensions?.map((d) =>
      typeof d === "number"
        ? String(d)
        : HeaderSymbolAdapter.resolveArrayDimension(d),
    );

    return {
      name: mangledName,
      kind: "variable",
      type: typeStr,
      isExported: variable.isExported,
      isConst: variable.isConst,
      isAtomic: variable.isAtomic,
      isArray: variable.isArray,
      arrayDimensions,
      parent: isGlobal ? undefined : variable.scope.name,
      sourceFile: variable.sourceFile,
      sourceLine: variable.sourceLine,
    };
  }

  private static convertStruct(
    struct: import("../../../types/symbols/IStructSymbol").default,
  ): IHeaderSymbol {
    // Get mangled name (scope-prefixed)
    const mangledName = SymbolNameUtils.getMangledName(struct);
    const isGlobal = struct.scope.name === "";

    return {
      name: mangledName,
      kind: "struct",
      isExported: struct.isExported,
      parent: isGlobal ? undefined : struct.scope.name,
      sourceFile: struct.sourceFile,
      sourceLine: struct.sourceLine,
    };
  }

  private static convertEnum(
    enumSym: import("../../../types/symbols/IEnumSymbol").default,
  ): IHeaderSymbol {
    // Get mangled name (scope-prefixed)
    const mangledName = SymbolNameUtils.getMangledName(enumSym);
    const isGlobal = enumSym.scope.name === "";

    return {
      name: mangledName,
      kind: "enum",
      isExported: enumSym.isExported,
      parent: isGlobal ? undefined : enumSym.scope.name,
      sourceFile: enumSym.sourceFile,
      sourceLine: enumSym.sourceLine,
    };
  }

  private static convertBitmap(
    bitmap: import("../../../types/symbols/IBitmapSymbol").default,
  ): IHeaderSymbol {
    // Get mangled name (scope-prefixed)
    const mangledName = SymbolNameUtils.getMangledName(bitmap);
    const isGlobal = bitmap.scope.name === "";

    return {
      name: mangledName,
      kind: "bitmap",
      type: bitmap.backingType,
      isExported: bitmap.isExported,
      parent: isGlobal ? undefined : bitmap.scope.name,
      sourceFile: bitmap.sourceFile,
      sourceLine: bitmap.sourceLine,
    };
  }

  private static convertRegister(
    register: import("../../../types/symbols/IRegisterSymbol").default,
  ): IHeaderSymbol {
    // Get mangled name (scope-prefixed)
    const mangledName = SymbolNameUtils.getMangledName(register);
    const isGlobal = register.scope.name === "";

    return {
      name: mangledName,
      kind: "register",
      isExported: register.isExported,
      parent: isGlobal ? undefined : register.scope.name,
      sourceFile: register.sourceFile,
      sourceLine: register.sourceLine,
    };
  }

  private static convertScope(
    scope: import("../../../types/symbols/IScopeSymbol").default,
  ): IHeaderSymbol {
    return {
      name: scope.name,
      kind: "scope",
      isExported: scope.isExported,
      sourceFile: scope.sourceFile,
      sourceLine: scope.sourceLine,
    };
  }

  /**
   * Convert an array dimension string to C-compatible format.
   * Converts qualified enum access (e.g., "EColor.COUNT") to C-style ("EColor_COUNT").
   * @param dim - The dimension string, may contain qualified enum access
   * @returns C-compatible dimension string with dots replaced by underscores
   * @example resolveArrayDimension("EColor.COUNT") => "EColor_COUNT"
   * @example resolveArrayDimension("10") => "10"
   */
  private static resolveArrayDimension(dim: string): string {
    // Qualified enum access (e.g., "EColor.COUNT") - convert dots to underscores
    if (dim.includes(".")) {
      return dim.replaceAll(".", "_");
    }
    return dim;
  }
}

export default HeaderSymbolAdapter;
