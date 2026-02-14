/**
 * CTSymbolAdapter - Converts TCSymbol[] to ISymbol[] for backwards compatibility.
 *
 * This adapter allows gradual migration from the legacy ISymbol interface to the
 * new typed TCSymbol interface.
 */

import ISymbol from "../../../../../utils/types/ISymbol";
import ESourceLanguage from "../../../../../utils/types/ESourceLanguage";
import TCSymbol from "../../../../types/symbols/c/TCSymbol";
import SymbolAdapterUtils from "../../adapters/SymbolAdapterUtils";

class CTSymbolAdapter {
  /**
   * Convert an array of TCSymbol to ISymbol for backwards compatibility.
   *
   * @param symbols The typed C symbols
   * @returns Legacy ISymbol array
   */
  static toISymbols(symbols: TCSymbol[]): ISymbol[] {
    return symbols.map((s) => CTSymbolAdapter.toISymbol(s));
  }

  /**
   * Convert a single TCSymbol to ISymbol.
   */
  static toISymbol(symbol: TCSymbol): ISymbol {
    const base: ISymbol = {
      name: symbol.name,
      kind: symbol.kind,
      sourceFile: symbol.sourceFile,
      sourceLine: symbol.sourceLine,
      sourceLanguage: ESourceLanguage.C,
      isExported: symbol.isExported,
    };

    // Add kind-specific properties
    switch (symbol.kind) {
      case "function":
        SymbolAdapterUtils.applyFunctionProperties(base, symbol);
        break;

      case "variable":
        SymbolAdapterUtils.applyVariableProperties(base, symbol);
        break;

      case "struct":
        base.type = symbol.isUnion ? "union" : "struct";
        break;

      case "enum":
        // Enum symbols don't have additional properties in legacy ISymbol
        break;

      case "enum_member":
        base.parent = symbol.parent;
        break;

      case "type":
        base.type = symbol.type;
        break;
    }

    return base;
  }
}

export default CTSymbolAdapter;
