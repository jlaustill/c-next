/**
 * Parse C/C++ header source and extract symbols for IDE features
 */

import { CharStream, CommonTokenStream } from "antlr4ng";
import { CLexer } from "../transpiler/logic/parser/c/grammar/CLexer";
import { CParser } from "../transpiler/logic/parser/c/grammar/CParser";
import CSymbolCollector from "../transpiler/logic/symbols/CSymbolCollector";
import ISymbolInfo from "./types/ISymbolInfo";
import IParseWithSymbolsResult from "./types/IParseWithSymbolsResult";
import TSymbolKind from "./types/TSymbolKind";
import TInternalSymbolKind from "../transpiler/types/symbol-kinds/TSymbolKind";

/**
 * Map internal TSymbolKind (snake_case) to library TSymbolKind (camelCase) for extension use
 */
function mapSymbolKind(kind: TInternalSymbolKind): TSymbolKind {
  switch (kind) {
    case "struct":
      return "struct";
    case "function":
      return "function";
    case "variable":
      return "variable";
    case "enum":
      return "enum";
    case "enum_member":
      return "enumMember";
    case "type":
      return "type";
    default:
      return "variable";
  }
}

/**
 * Parse C/C++ header source and extract symbols for IDE features
 *
 * Unlike transpilation, this function attempts to extract symbols even when
 * there are parse errors, making it suitable for autocomplete during typing.
 *
 * @param source - C/C++ header source code string
 * @param filePath - Optional file path for symbol source tracking
 * @returns Parse result with symbols
 *
 * @example
 * ```typescript
 * import parseCHeader from './lib/parseCHeader';
 *
 * const result = parseCHeader(headerSource, 'config.h');
 * // Find all functions defined in the header
 * const functions = result.symbols.filter(s => s.kind === 'function');
 * ```
 */
function parseCHeader(
  source: string,
  filePath?: string,
): IParseWithSymbolsResult {
  const errors: Array<{
    line: number;
    column: number;
    message: string;
    severity: "error" | "warning";
  }> = [];

  try {
    // Parse C source
    const charStream = CharStream.fromString(source);
    const lexer = new CLexer(charStream);
    const tokenStream = new CommonTokenStream(lexer);
    const parser = new CParser(tokenStream);

    // Suppress error output for headers (they often have incomplete code)
    lexer.removeErrorListeners();
    parser.removeErrorListeners();

    const tree = parser.compilationUnit();
    const collector = new CSymbolCollector(filePath ?? "<header>");
    const rawSymbols = collector.collect(tree);

    // Transform ISymbol[] to ISymbolInfo[]
    const symbols: ISymbolInfo[] = rawSymbols.map((sym) => ({
      name: sym.name,
      fullName: sym.parent ? `${sym.parent}.${sym.name}` : sym.name,
      kind: mapSymbolKind(sym.kind),
      type: sym.type,
      parent: sym.parent,
      line: sym.sourceLine ?? 0,
      sourceFile: filePath,
      language: "c",
    }));

    return {
      success: true,
      errors,
      symbols,
    };
  } catch (err) {
    errors.push({
      line: 1,
      column: 0,
      message: err instanceof Error ? err.message : String(err),
      severity: "error",
    });

    return {
      success: false,
      errors,
      symbols: [],
    };
  }
}

export default parseCHeader;
