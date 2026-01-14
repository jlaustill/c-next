/**
 * C-Next Transpiler Library
 * Core transpilation API for use by CLI and VS Code extension
 */

import { CharStream, CommonTokenStream } from "antlr4ng";
import { CNextLexer } from "../parser/grammar/CNextLexer";
import { CNextParser } from "../parser/grammar/CNextParser";
import CodeGenerator from "../codegen/CodeGenerator";
import CommentExtractor from "../codegen/CommentExtractor";
import InitializationAnalyzer from "../analysis/InitializationAnalyzer";
import FunctionCallAnalyzer from "../analysis/FunctionCallAnalyzer";
import NullCheckAnalyzer from "../analysis/NullCheckAnalyzer";
import DivisionByZeroAnalyzer from "../analysis/DivisionByZeroAnalyzer";
import FloatModuloAnalyzer from "../analysis/FloatModuloAnalyzer";
import ITranspileResult from "./types/ITranspileResult";
import ITranspileError from "./types/ITranspileError";
import ITranspileOptions from "./types/ITranspileOptions";

/**
 * Transpile C-Next source code to C
 *
 * @param source - C-Next source code string
 * @param options - Optional transpilation options
 * @returns Transpilation result with code or errors
 *
 * @example
 * ```typescript
 * import transpile from './lib/transpiler';
 *
 * const result = transpile('u32 x <- 5;');
 * if (result.success) {
 *     console.log(result.code);
 * } else {
 *     result.errors.forEach(e => console.error(`${e.line}:${e.column} ${e.message}`));
 * }
 * ```
 */
function transpile(
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

  // Run call analysis (ADR-030: define-before-use)
  const funcAnalyzer = new FunctionCallAnalyzer();
  const funcErrors = funcAnalyzer.analyze(tree);

  // Convert call errors to transpile errors
  for (const funcError of funcErrors) {
    errors.push({
      line: funcError.line,
      column: funcError.column,
      message: `error[${funcError.code}]: ${funcError.message}`,
      severity: "error",
    });
  }

  // If there are call errors, fail compilation
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

  // Run float modulo analysis (catch % with f32/f64 early)
  const floatModAnalyzer = new FloatModuloAnalyzer();
  const floatModErrors = floatModAnalyzer.analyze(tree);

  // Convert float modulo errors to transpile errors
  for (const floatModError of floatModErrors) {
    errors.push({
      line: floatModError.line,
      column: floatModError.column,
      message: `error[${floatModError.code}]: ${floatModError.message}`,
      severity: "error",
    });
  }

  // If there are float modulo errors, fail compilation
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

export default transpile;
