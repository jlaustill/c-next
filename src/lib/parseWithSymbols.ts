/**
 * Parse C-Next source and extract symbols for IDE features
 */

import CNextSourceParser from "../transpiler/logic/parser/CNextSourceParser";
import CNextResolver from "../transpiler/logic/symbols/cnext/index";
import TSymbolAdapter from "../transpiler/logic/symbols/cnext/adapters/TSymbolAdapter";
import SymbolTable from "../transpiler/logic/symbols/SymbolTable";
import ESymbolKind from "../utils/types/ESymbolKind";
import ISymbolInfo from "./types/ISymbolInfo";
import IParseWithSymbolsResult from "./types/IParseWithSymbolsResult";
import TSymbolKind from "./types/TSymbolKind";

/**
 * Map ESymbolKind to TSymbolKind for extension use
 */
function mapSymbolKind(kind: ESymbolKind): TSymbolKind {
  switch (kind) {
    case ESymbolKind.Namespace:
      return "namespace";
    case ESymbolKind.Struct:
      return "struct";
    case ESymbolKind.Register:
      return "register";
    case ESymbolKind.Function:
      return "function";
    case ESymbolKind.Variable:
      return "variable";
    case ESymbolKind.RegisterMember:
      return "registerMember";
    case ESymbolKind.Enum:
      return "enum";
    case ESymbolKind.EnumMember:
      return "enumMember";
    case ESymbolKind.Bitmap:
      return "bitmap";
    case ESymbolKind.BitmapField:
      return "bitmapField";
    default:
      return "variable";
  }
}

/**
 * Extract local name from full qualified name
 * e.g., "LED_toggle" with parent "LED" -> "toggle"
 */
function extractLocalName(fullName: string, parent?: string): string {
  if (parent && fullName.startsWith(parent + "_")) {
    return fullName.substring(parent.length + 1);
  }
  return fullName;
}

/**
 * Parse C-Next source and extract symbols for IDE features
 *
 * Unlike transpile(), this function attempts to extract symbols even when
 * there are parse errors, making it suitable for autocomplete during typing.
 *
 * @param source - C-Next source code string
 * @returns Parse result with symbols
 *
 * @example
 * ```typescript
 * import parseWithSymbols from './lib/parseWithSymbols';
 *
 * const result = parseWithSymbols(source);
 * // Find namespace members for autocomplete
 * const ledMembers = result.symbols.filter(s => s.parent === 'LED');
 * ```
 */
function parseWithSymbols(source: string): IParseWithSymbolsResult {
  // Parse C-Next source
  const { tree, errors } = CNextSourceParser.parse(source);

  // Collect symbols from the parse tree (ADR-055: use CNextResolver + TSymbolAdapter)
  const tSymbols = CNextResolver.resolve(tree, "<source>");
  const symbolTable = new SymbolTable();
  const rawSymbols = TSymbolAdapter.toISymbols(tSymbols, symbolTable);

  // Transform ISymbol[] to ISymbolInfo[]
  const symbols: ISymbolInfo[] = rawSymbols.map((sym) => ({
    name: extractLocalName(sym.name, sym.parent),
    fullName: sym.name,
    kind: mapSymbolKind(sym.kind),
    type: sym.type,
    parent: sym.parent,
    signature: sym.signature,
    accessModifier: sym.accessModifier,
    line: sym.sourceLine,
    size: sym.size,
  }));

  return {
    success: errors.length === 0,
    errors,
    symbols,
  };
}

export default parseWithSymbols;
