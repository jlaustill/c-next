import ESymbolKind from "../../../../utils/types/ESymbolKind";
import IBitmapSymbol from "./IBitmapSymbol";
import IEnumSymbol from "./IEnumSymbol";
import IFunctionSymbol from "./IFunctionSymbol";
import IRegisterSymbol from "./IRegisterSymbol";
import IScopeSymbol from "./IScopeSymbol";
import IStructSymbol from "./IStructSymbol";
import IVariableSymbol from "./IVariableSymbol";
import TSymbol from "./TSymbol";

/**
 * Type guards for narrowing TSymbol to specific symbol types.
 */
class SymbolGuards {
  static isStruct(symbol: TSymbol): symbol is IStructSymbol {
    return symbol.kind === ESymbolKind.Struct;
  }

  static isEnum(symbol: TSymbol): symbol is IEnumSymbol {
    return symbol.kind === ESymbolKind.Enum;
  }

  static isBitmap(symbol: TSymbol): symbol is IBitmapSymbol {
    return symbol.kind === ESymbolKind.Bitmap;
  }

  static isFunction(symbol: TSymbol): symbol is IFunctionSymbol {
    return symbol.kind === ESymbolKind.Function;
  }

  static isVariable(symbol: TSymbol): symbol is IVariableSymbol {
    return symbol.kind === ESymbolKind.Variable;
  }

  static isScope(symbol: TSymbol): symbol is IScopeSymbol {
    return symbol.kind === ESymbolKind.Namespace;
  }

  static isRegister(symbol: TSymbol): symbol is IRegisterSymbol {
    return symbol.kind === ESymbolKind.Register;
  }
}

export default SymbolGuards;
