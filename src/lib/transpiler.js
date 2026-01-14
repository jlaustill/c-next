"use strict";
/**
 * C-Next Transpiler Library
 * Core transpilation API for use by CLI and VS Code extension
 */
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
Object.defineProperty(exports, "__esModule", { value: true });
exports.transpile = transpile;
exports.parse = parse;
exports.parseWithSymbols = parseWithSymbols;
const antlr4ng_1 = require("antlr4ng");
const CNextLexer_1 = require("../parser/grammar/CNextLexer");
const CNextParser_1 = require("../parser/grammar/CNextParser");
const CodeGenerator_1 = __importDefault(require("../codegen/CodeGenerator"));
const CommentExtractor_1 = __importDefault(
  require("../codegen/CommentExtractor"),
);
const CNextSymbolCollector_1 = __importDefault(
  require("../symbols/CNextSymbolCollector"),
);
const ESymbolKind_1 = __importDefault(require("../types/ESymbolKind"));
const InitializationAnalyzer_1 = __importDefault(
  require("../analysis/InitializationAnalyzer"),
);
const FunctionCallAnalyzer_1 = __importDefault(
  require("../analysis/FunctionCallAnalyzer"),
);
const NullCheckAnalyzer_1 = __importDefault(
  require("../analysis/NullCheckAnalyzer"),
);
const DivisionByZeroAnalyzer_1 = __importDefault(
  require("../analysis/DivisionByZeroAnalyzer"),
);
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
function transpile(source, options = {}) {
  const { parseOnly = false, debugMode = false, target } = options;
  const errors = [];
  // Create the lexer and parser
  const charStream = antlr4ng_1.CharStream.fromString(source);
  const lexer = new CNextLexer_1.CNextLexer(charStream);
  const tokenStream = new antlr4ng_1.CommonTokenStream(lexer);
  const parser = new CNextParser_1.CNextParser(tokenStream);
  // Custom error listener to collect errors with line/column info
  lexer.removeErrorListeners();
  parser.removeErrorListeners();
  const errorListener = {
    syntaxError(
      _recognizer,
      _offendingSymbol,
      line,
      charPositionInLine,
      msg,
      _e,
    ) {
      errors.push({
        line,
        column: charPositionInLine,
        message: msg,
        severity: "error",
      });
    },
    reportAmbiguity() {},
    reportAttemptingFullContext() {},
    reportContextSensitivity() {},
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
  const initAnalyzer = new InitializationAnalyzer_1.default();
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
  const funcAnalyzer = new FunctionCallAnalyzer_1.default();
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
  const nullAnalyzer = new NullCheckAnalyzer_1.default();
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
  const divZeroAnalyzer = new DivisionByZeroAnalyzer_1.default();
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
  const commentExtractor = new CommentExtractor_1.default(tokenStream);
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
    const generator = new CodeGenerator_1.default();
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
function parse(source) {
  return transpile(source, { parseOnly: true });
}
/**
 * Map ESymbolKind to TSymbolKind for extension use
 */
function mapSymbolKind(kind) {
  switch (kind) {
    case ESymbolKind_1.default.Namespace:
      return "namespace";
    case ESymbolKind_1.default.Class:
      return "class";
    case ESymbolKind_1.default.Struct:
      return "struct";
    case ESymbolKind_1.default.Register:
      return "register";
    case ESymbolKind_1.default.Function:
      return "function";
    case ESymbolKind_1.default.Variable:
      return "variable";
    case ESymbolKind_1.default.RegisterMember:
      return "registerMember";
    default:
      return "variable";
  }
}
/**
 * Extract local name from full qualified name
 * e.g., "LED_toggle" with parent "LED" -> "toggle"
 */
function extractLocalName(fullName, parent) {
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
function parseWithSymbols(source) {
  const errors = [];
  // Create the lexer and parser
  const charStream = antlr4ng_1.CharStream.fromString(source);
  const lexer = new CNextLexer_1.CNextLexer(charStream);
  const tokenStream = new antlr4ng_1.CommonTokenStream(lexer);
  const parser = new CNextParser_1.CNextParser(tokenStream);
  // Custom error listener to collect errors
  lexer.removeErrorListeners();
  parser.removeErrorListeners();
  const errorListener = {
    syntaxError(
      _recognizer,
      _offendingSymbol,
      line,
      charPositionInLine,
      msg,
      _e,
    ) {
      errors.push({
        line,
        column: charPositionInLine,
        message: msg,
        severity: "error",
      });
    },
    reportAmbiguity() {},
    reportAttemptingFullContext() {},
    reportContextSensitivity() {},
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
  const collector = new CNextSymbolCollector_1.default("<source>");
  const rawSymbols = collector.collect(tree);
  // Transform ISymbol[] to ISymbolInfo[]
  const symbols = rawSymbols.map((sym) => ({
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
exports.default = transpile;
