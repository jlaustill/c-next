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

  static isScope(symbol: TSymbol): symbol is IScopeSymbol {
    return symbol.kind === "scope";
  }

  static isStruct(symbol: TSymbol): symbol is IStructSymbol {
    return symbol.kind === "struct";
  }

  static isEnum(symbol: TSymbol): symbol is IEnumSymbol {
    return symbol.kind === "enum";
  }

  static isVariable(symbol: TSymbol): symbol is IVariableSymbol {
    return symbol.kind === "variable";
  }

  static isBitmap(symbol: TSymbol): symbol is IBitmapSymbol {
    return symbol.kind === "bitmap";
  }

  static isRegister(symbol: TSymbol): symbol is IRegisterSymbol {
    return symbol.kind === "register";
  }
}

export default SymbolGuards;
