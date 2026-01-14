/**
 * Parse C-Next source and extract symbols for IDE features
 */

import { CharStream, CommonTokenStream } from "antlr4ng";
import { CNextLexer } from "../parser/grammar/CNextLexer";
import { CNextParser } from "../parser/grammar/CNextParser";
import CNextSymbolCollector from "../symbols/CNextSymbolCollector";
import ESymbolKind from "../types/ESymbolKind";
import ITranspileError from "./types/ITranspileError";
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
    case ESymbolKind.Class:
      return "class";
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
  const errors: ITranspileError[] = [];

  // Create the lexer and parser
  const charStream = CharStream.fromString(source);
  const lexer = new CNextLexer(charStream);
  const tokenStream = new CommonTokenStream(lexer);
  const parser = new CNextParser(tokenStream);

  // Custom error listener to collect errors
  lexer.removeErrorListeners();
  parser.removeErrorListeners();

  const errorListener = {
    syntaxError(
      _recognizer: unknown,
      _offendingSymbol: unknown,
      line: number,
      charPositionInLine: number,
      msg: string,
      _e: unknown,
    ): void {
      errors.push({
        line,
        column: charPositionInLine,
        message: msg,
        severity: "error",
      });
    },
    reportAmbiguity(): void {},
    reportAttemptingFullContext(): void {},
    reportContextSensitivity(): void {},
  };

  lexer.addErrorListener(errorListener);
  parser.addErrorListener(errorListener);

  // Parse the input - continue even with errors to get partial symbols
  let tree;
  try {
    tree = parser.program();
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : String(e);
    errors.push({
      line: 1,
      column: 0,
      message: `Parse failed: ${errorMessage}`,
      severity: "error",
    });
    return {
      success: false,
      errors,
      symbols: [],
    };
  }

  // Collect symbols from the parse tree
  const collector = new CNextSymbolCollector("<source>");
  const rawSymbols = collector.collect(tree);

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
