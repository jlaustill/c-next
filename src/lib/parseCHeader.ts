/**
 * Parse C/C++ header source and extract symbols for IDE features
 * ADR-055 Phase 7: Direct TCSymbol → ISymbolInfo conversion (no ISymbol intermediate)
 */

import { CharStream, CommonTokenStream } from "antlr4ng";
import { CLexer } from "../transpiler/logic/parser/c/grammar/CLexer";
import { CParser } from "../transpiler/logic/parser/c/grammar/CParser";
import CResolver from "../transpiler/logic/symbols/c";
import ISymbolInfo from "./types/ISymbolInfo";
import IParseWithSymbolsResult from "./types/IParseWithSymbolsResult";
import TSymbolKind from "./types/TSymbolKind";
import TCSymbol from "../transpiler/types/symbols/c/TCSymbol";

/**
 * Map TCSymbol kind to library TSymbolKind
 */
function mapCSymbolKind(kind: TCSymbol["kind"]): TSymbolKind {
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
 * ADR-055 Phase 7: Convert TCSymbol directly to ISymbolInfo.
 * Handles the discriminated union by extracting common fields and type-specific fields.
 */
function convertTCSymbolsToISymbolInfo(
  symbols: TCSymbol[],
  filePath?: string,
): ISymbolInfo[] {
  return symbols.map((sym) => {
    // Extract type and parent based on symbol kind
    let type: string | undefined;
    let parent: string | undefined;

    switch (sym.kind) {
      case "function":
        type = sym.type;
        break;
      case "variable":
        type = sym.type;
        break;
      case "enum_member":
        parent = sym.parent;
        break;
      case "type":
        type = sym.type;
        break;
      // struct and enum have no type field
    }

    return {
      name: sym.name,
      fullName: parent ? `${parent}.${sym.name}` : sym.name,
      kind: mapCSymbolKind(sym.kind),
      type,
      parent,
      line: sym.sourceLine ?? 0,
      sourceFile: filePath,
      language: "c",
    };
  });
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
    const result = CResolver.resolve(tree, filePath ?? "<header>");

    // ADR-055 Phase 7: Direct TCSymbol → ISymbolInfo conversion
    const symbols = convertTCSymbolsToISymbolInfo(result.symbols, filePath);

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
