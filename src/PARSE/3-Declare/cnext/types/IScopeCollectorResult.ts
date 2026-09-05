/**
 * Result of collecting a scope declaration.
 * Contains both the scope symbol itself and all nested member symbols.
 */

import IScopeSymbol from "../../../../transpiler/types/symbols/IScopeSymbol";
import TSymbol from "../../../../transpiler/types/symbols/TSymbol";

interface IScopeCollectorResult {
  scopeSymbol: IScopeSymbol;
  memberSymbols: TSymbol[];
}

export default IScopeCollectorResult;
