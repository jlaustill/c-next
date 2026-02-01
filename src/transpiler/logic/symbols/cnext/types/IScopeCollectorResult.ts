/**
 * Result of collecting a scope declaration.
 * Contains both the scope symbol itself and all nested member symbols.
 */

import IScopeSymbol from "../../types/IScopeSymbol";
import TSymbol from "../../types/TSymbol";

interface IScopeCollectorResult {
  scopeSymbol: IScopeSymbol;
  memberSymbols: TSymbol[];
}

export default IScopeCollectorResult;
