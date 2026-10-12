/**
 * `IScopeSymbol.functions` is the one alias a 1.4 rebuild cannot rebuild into
 * agreement: `SymbolRegistry.getOrCreateScope` caches the scope by path and
 * `registerFunction` pushes the same function object the file's symbol list
 * holds. So when a pass rebuilds a function, the scope's array is written in
 * place from that pass's own memo, and both readers end on one object.
 *
 * Only entries the memo holds are replaced: a scope spanned across files
 * (#1333) holds its siblings' functions too, and those are their own file's
 * to settle.
 */

import type TSymbol from "../../types/symbols/TSymbol";
import type IFunctionSymbol from "../../types/symbols/IFunctionSymbol";

class ScopeFunctions {
  /**
   * @param symbols one file's symbols, after the pass
   * @param rebuilt each original symbol the pass reached, to what it became
   */
  static adopt(
    symbols: ReadonlyArray<TSymbol>,
    rebuilt: ReadonlyMap<TSymbol, TSymbol>,
  ): void {
    for (const symbol of symbols) {
      if (symbol.kind !== "scope") {
        continue;
      }
      symbol.functions.forEach((func, index) => {
        const already = rebuilt.get(func);
        if (already && already !== func) {
          symbol.functions[index] = already as IFunctionSymbol;
        }
      });
    }
  }
}

export default ScopeFunctions;
