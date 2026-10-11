import TSymbolKindCNext from "./TSymbolKindCNext";
import TSymbolKindC from "./TSymbolKindC";
import TSymbolKindCpp from "./TSymbolKindCpp";

/**
 * Union of all symbol kinds across supported languages.
 */
type TSymbolKind = TSymbolKindCNext | TSymbolKindC | TSymbolKindCpp;

export default TSymbolKind;
