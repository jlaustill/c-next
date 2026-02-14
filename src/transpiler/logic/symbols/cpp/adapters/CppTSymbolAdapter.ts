/**
 * CppTSymbolAdapter - Converts TCppSymbol[] to ISymbol[] for backwards compatibility.
 *
 * This adapter allows gradual migration from the legacy ISymbol interface to the
 * new typed TCppSymbol interface.
 */

import ISymbol from "../../../../../utils/types/ISymbol";
import ESourceLanguage from "../../../../../utils/types/ESourceLanguage";
import TCppSymbol from "../../../../types/symbols/cpp/TCppSymbol";
import SymbolAdapterUtils from "../../adapters/SymbolAdapterUtils";

class CppTSymbolAdapter {
  /**
   * Convert an array of TCppSymbol to ISymbol for backwards compatibility.
   *
   * @param symbols The typed C++ symbols
   * @returns Legacy ISymbol array
   */
  static toISymbols(symbols: TCppSymbol[]): ISymbol[] {
    return symbols.map((s) => CppTSymbolAdapter.toISymbol(s));
  }

  /**
   * Convert a single TCppSymbol to ISymbol.
   */
  static toISymbol(symbol: TCppSymbol): ISymbol {
    const base: ISymbol = {
      name: symbol.name,
      kind: symbol.kind,
      sourceFile: symbol.sourceFile,
      sourceLine: symbol.sourceLine,
      sourceLanguage: ESourceLanguage.Cpp,
      isExported: symbol.isExported,
      parent: symbol.parent,
    };

    // Add kind-specific properties
    switch (symbol.kind) {
      case "function":
        SymbolAdapterUtils.applyFunctionProperties(base, symbol);
        break;

      case "variable":
        SymbolAdapterUtils.applyVariableProperties(base, symbol);
        break;

      case "class":
      case "struct":
        // Class/struct symbols don't have a type field in legacy ISymbol
        break;

      case "enum":
        // Add bit width as size if present
        if (symbol.bitWidth) {
          base.size = symbol.bitWidth;
        }
        break;

      case "namespace":
      case "type":
      case "enum_member":
        // These kinds don't have additional properties
        break;
    }

    return base;
  }
}

export default CppTSymbolAdapter;
