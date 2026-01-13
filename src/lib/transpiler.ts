/**
 * C-Next Transpiler Library
 * Core transpilation API for use by CLI and VS Code extension
 */

import { CharStream, CommonTokenStream } from "antlr4ng";
import { CNextLexer } from "../parser/grammar/CNextLexer";
import { CNextParser } from "../parser/grammar/CNextParser";
import CodeGenerator from "../codegen/CodeGenerator";
import CommentExtractor from "../codegen/CommentExtractor";
import CNextSymbolCollector from "../symbols/CNextSymbolCollector";
import ESymbolKind from "../types/ESymbolKind";
import InitializationAnalyzer from "../analysis/InitializationAnalyzer";
import FunctionCallAnalyzer from "../analysis/FunctionCallAnalyzer";
import NullCheckAnalyzer from "../analysis/NullCheckAnalyzer";
import DivisionByZeroAnalyzer from "../analysis/DivisionByZeroAnalyzer";
import {
  ITranspileResult,
  ITranspileError,
  ISymbolInfo,
  IParseWithSymbolsResult,
  TSymbolKind,
} from "./types/ITranspileResult";

export {
  ITranspileResult,
  ITranspileError,
  ISymbolInfo,
  IParseWithSymbolsResult,
  TSymbolKind,
};

/**
 * Options for transpilation
 */
export interface ITranspileOptions {
  /** Parse only, don't generate code */
  parseOnly?: boolean;
  /** ADR-044: When true, generate panic-on-overflow helpers instead of clamp helpers */
  debugMode?: boolean;
  /** ADR-049: Target platform for atomic code generation (e.g., "teensy41", "cortex-m0") */
  target?: string;
}

/**
 * Transpile C-Next source code to C
 *
 * @param source - C-Next source code string
 * @param options - Optional transpilation options
 * @returns Transpilation result with code or errors
 *
 * @example
 * ```typescript
 * import { transpile } from './lib/transpiler';
 *
 * const result = transpile('u32 x <- 5;');
 * if (result.success) {
 *     console.log(result.code);
 * } else {
 *     result.errors.forEach(e => console.error(`${e.line}:${e.column} ${e.message}`));
 * }
 * ```
 */
export function transpile(
  source: string,
  options: ITranspileOptions = {},
): ITranspileResult {
  const { parseOnly = false, debugMode = false, target } = options;
  const errors: ITranspileError[] = [];

  // Create the lexer and parser
  const charStream = CharStream.fromString(source);
  const lexer = new CNextLexer(charStream);
  const tokenStream = new CommonTokenStream(lexer);
  const parser = new CNextParser(tokenStream);

  // Custom error listener to collect errors with line/column info
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

  // Parse the input
  let tree;
  try {
    tree = parser.program();
  } catch (e) {
    // Handle catastrophic parse failures
    const errorMessage = e instanceof Error ? e.message : String(e);
    errors.push({
      line: 1,
      column: 0,
      message: `Parse failed: ${errorMessage}`,
      severity: "error",
    });
    return {
      success: false,
      code: "",
      errors,
      declarationCount: 0,
    };
  }

  const declarationCount = tree.declaration().length;

  // If there are parse errors or parseOnly mode, return early
  if (errors.length > 0) {
    return {
      success: false,
      code: "",
      errors,
      declarationCount,
    };
  }

  if (parseOnly) {
    return {
      success: true,
      code: "",
      errors: [],
      declarationCount,
    };
  }

  // Run initialization analysis (Rust-style use-before-init detection)
  const initAnalyzer = new InitializationAnalyzer();
  const initErrors = initAnalyzer.analyze(tree);

  // Convert initialization errors to transpile errors
  for (const initError of initErrors) {
    errors.push({
      line: initError.line,
      column: initError.column,
      message: `error[${initError.code}]: ${initError.message}`,
      severity: "error",
    });
  }

  // If there are initialization errors, fail compilation
  if (errors.length > 0) {
    return {
      success: false,
      code: "",
      errors,
      declarationCount,
    };
  }

  // Run function call analysis (ADR-030: define-before-use)
  const funcAnalyzer = new FunctionCallAnalyzer();
  const funcErrors = funcAnalyzer.analyze(tree);

  // Convert function call errors to transpile errors
  for (const funcError of funcErrors) {
    errors.push({
      line: funcError.line,
      column: funcError.column,
      message: `error[${funcError.code}]: ${funcError.message}`,
      severity: "error",
    });
  }

  // If there are function call errors, fail compilation
  if (errors.length > 0) {
    return {
      success: false,
      code: "",
      errors,
      declarationCount,
    };
  }

  // Run NULL check analysis (ADR-047: C library interop)
  const nullAnalyzer = new NullCheckAnalyzer();
  const nullErrors = nullAnalyzer.analyze(tree);

  // Convert NULL check errors to transpile errors
  for (const nullError of nullErrors) {
    errors.push({
      line: nullError.line,
      column: nullError.column,
      message: `error[${nullError.code}]: ${nullError.message}`,
      severity: "error",
    });
  }

  // If there are NULL check errors, fail compilation
  if (errors.length > 0) {
    return {
      success: false,
      code: "",
      errors,
      declarationCount,
    };
  }

  // Run division by zero analysis (ADR-051: compile-time detection)
  const divZeroAnalyzer = new DivisionByZeroAnalyzer();
  const divZeroErrors = divZeroAnalyzer.analyze(tree);

  // Convert division by zero errors to transpile errors
  for (const divZeroError of divZeroErrors) {
    errors.push({
      line: divZeroError.line,
      column: divZeroError.column,
      message: `error[${divZeroError.code}]: ${divZeroError.message}`,
      severity: "error",
    });
  }

  // If there are division by zero errors, fail compilation
  if (errors.length > 0) {
    return {
      success: false,
      code: "",
      errors,
      declarationCount,
    };
  }

  // Validate comments (MISRA C:2012 Rules 3.1, 3.2) - ADR-043
  const commentExtractor = new CommentExtractor(tokenStream);
  const commentErrors = commentExtractor.validate();

  for (const commentError of commentErrors) {
    errors.push({
      line: commentError.line,
      column: commentError.column,
      message: `error[MISRA-${commentError.rule}]: ${commentError.message}`,
      severity: "error",
    });
  }

  // If there are comment validation errors, fail compilation
  if (errors.length > 0) {
    return {
      success: false,
      code: "",
      errors,
      declarationCount,
    };
  }

  // Generate C code
  try {
    const generator = new CodeGenerator();
    const code = generator.generate(tree, undefined, tokenStream, {
      debugMode,
      target,
    });

    return {
      success: true,
      code,
      errors: [],
      declarationCount,
    };
  } catch (e) {
    // Handle code generation errors
    const errorMessage = e instanceof Error ? e.message : String(e);
    errors.push({
      line: 1,
      column: 0,
      message: `Code generation failed: ${errorMessage}`,
      severity: "error",
    });
    return {
      success: false,
      code: "",
      errors,
      declarationCount,
    };
  }
}

/**
 * Parse C-Next source and return parse result without generating code
 * Convenience wrapper around transpile with parseOnly: true
 */
export function parse(source: string): ITranspileResult {
  return transpile(source, { parseOnly: true });
}

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
 * import { parseWithSymbols } from './lib/transpiler';
 *
 * const result = parseWithSymbols(source);
 * // Find namespace members for autocomplete
 * const ledMembers = result.symbols.filter(s => s.parent === 'LED');
 * ```
 */
export function parseWithSymbols(source: string): IParseWithSymbolsResult {
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

export default transpile;
