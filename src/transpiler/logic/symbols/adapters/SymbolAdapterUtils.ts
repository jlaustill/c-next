/**
 * SymbolAdapterUtils - Shared utilities for C/C++ symbol adapters.
 *
 * Contains common conversion logic used by both CTSymbolAdapter and CppTSymbolAdapter.
 */

import ISymbol from "../../../../utils/types/ISymbol";

/**
 * Parameter with basic info (common to C and C++ parameter types).
 */
interface IParameterLike {
  readonly name: string;
  readonly type: string;
  readonly isConst?: boolean;
  readonly isArray?: boolean;
}

/**
 * Function symbol with parameters (common to C and C++ function symbols).
 */
interface IFunctionLike {
  readonly type: string;
  readonly isDeclaration?: boolean;
  readonly parameters?: ReadonlyArray<IParameterLike>;
}

/**
 * Variable symbol with array dimensions (common to C and C++ variable symbols).
 */
interface IVariableLike {
  readonly type: string;
  readonly isConst?: boolean;
  readonly isArray?: boolean;
  readonly arrayDimensions?: ReadonlyArray<number | string>;
}

class SymbolAdapterUtils {
  /**
   * Apply function-specific properties to base ISymbol.
   */
  static applyFunctionProperties(base: ISymbol, symbol: IFunctionLike): void {
    base.type = symbol.type;
    base.isDeclaration = symbol.isDeclaration;
    if (symbol.parameters) {
      base.parameters = symbol.parameters.map((p) => ({
        name: p.name,
        type: p.type,
        isConst: p.isConst ?? false,
        isArray: p.isArray ?? false,
      }));
    }
  }

  /**
   * Apply variable-specific properties to base ISymbol.
   */
  static applyVariableProperties(base: ISymbol, symbol: IVariableLike): void {
    base.type = symbol.type;
    base.isConst = symbol.isConst;
    base.isArray = symbol.isArray;
    if (symbol.arrayDimensions) {
      base.arrayDimensions = symbol.arrayDimensions.map((d) =>
        typeof d === "number" ? d.toString() : d,
      );
    }
  }
}

export default SymbolAdapterUtils;
