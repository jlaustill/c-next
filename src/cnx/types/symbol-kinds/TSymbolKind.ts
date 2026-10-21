import TSymbolKindCnx from "./TSymbolKindCnx";
import TSymbolKindC from "./TSymbolKindC";
import TSymbolKindCpp from "./TSymbolKindCpp";

/**
 * Union of all symbol kinds across supported languages.
 */
type TSymbolKind = TSymbolKindCnx | TSymbolKindC | TSymbolKindCpp;

export default TSymbolKind;
