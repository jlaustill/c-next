import type TSymbol from "./TSymbol";
import type IFunctionSymbol from "./IFunctionSymbol";
import type IScopeSymbol from "./IScopeSymbol";
import type IStructSymbol from "./IStructSymbol";
import type IEnumSymbol from "./IEnumSymbol";
import type IVariableSymbol from "./IVariableSymbol";
import type IBitmapSymbol from "./IBitmapSymbol";
import type IRegisterSymbol from "./IRegisterSymbol";

/**
 * Type guard functions for TSymbol discriminated union.
 */
class SymbolGuards {
  static isFunction(symbol: TSymbol): symbol is IFunctionSymbol {
    return symbol.kind === "function";
  }

  /** @public member of the TSymbol guard set; tests narrow symbols with it */
  static isScope(symbol: TSymbol): symbol is IScopeSymbol {
    return symbol.kind === "scope";
  }

  /** @public member of the TSymbol guard set; tests narrow symbols with it */
  static isStruct(symbol: TSymbol): symbol is IStructSymbol {
    return symbol.kind === "struct";
  }

  /** @public member of the TSymbol guard set; tests narrow symbols with it */
  static isEnum(symbol: TSymbol): symbol is IEnumSymbol {
    return symbol.kind === "enum";
  }

  /** @public member of the TSymbol guard set; tests narrow symbols with it */
  static isVariable(symbol: TSymbol): symbol is IVariableSymbol {
    return symbol.kind === "variable";
  }

  /** @public member of the TSymbol guard set; tests narrow symbols with it */
  static isBitmap(symbol: TSymbol): symbol is IBitmapSymbol {
    return symbol.kind === "bitmap";
  }

  /** @public member of the TSymbol guard set; tests narrow symbols with it */
  static isRegister(symbol: TSymbol): symbol is IRegisterSymbol {
    return symbol.kind === "register";
  }
}

export default SymbolGuards;
