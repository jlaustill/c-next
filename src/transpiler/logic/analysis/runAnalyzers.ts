/**
 * Run all semantic analyzers on a parsed C-Next program
 *
 * Extracted from transpiler.ts for reuse in the unified pipeline.
 * All 8 analyzers run in sequence, each returning errors that block compilation.
 */

import { CommonTokenStream } from "antlr4ng";
import { ProgramContext } from "../parser/grammar/CNextParser";
import ParameterNamingAnalyzer from "./ParameterNamingAnalyzer";
import StructFieldAnalyzer from "./StructFieldAnalyzer";
import InitializationAnalyzer from "./InitializationAnalyzer";
import FunctionCallAnalyzer from "./FunctionCallAnalyzer";
import NullCheckAnalyzer from "./NullCheckAnalyzer";
import DivisionByZeroAnalyzer from "./DivisionByZeroAnalyzer";
import FloatModuloAnalyzer from "./FloatModuloAnalyzer";
import CommentExtractor from "./CommentExtractor";
import ITranspileError from "../../../lib/types/ITranspileError";
import SymbolTable from "../symbols/SymbolTable";

/**
 * Options for running analyzers
 */
interface IAnalyzerOptions {
  /**
   * External struct field information from C/C++ headers
   * Maps struct name -> Set of field names
   */
  externalStructFields?: Map<string, Set<string>>;

  /**
   * Symbol table containing external function definitions from C/C++ headers
   * Used by FunctionCallAnalyzer to recognize external functions
   */
  symbolTable?: SymbolTable;
}

/**
 * Generic analyzer error with common fields
 */
interface IAnalyzerError {
  line: number;
  column: number;
  message: string;
  code?: string;
  rule?: string;
}

/**
 * Convert analyzer errors to ITranspileError format and add to accumulator.
 * Returns true if any errors were added (for early return logic).
 */
function collectErrors(
  analyzerErrors: IAnalyzerError[],
  target: ITranspileError[],
  formatMessage?: (err: IAnalyzerError) => string,
): boolean {
  const formatter = formatMessage ?? ((e) => e.message);
  for (const err of analyzerErrors) {
    target.push({
      line: err.line,
      column: err.column,
      message: formatter(err),
      severity: "error",
    });
  }
  return analyzerErrors.length > 0;
}

/**
 * Run all semantic analyzers on a parsed program
 *
 * @param tree - The parsed program AST
 * @param tokenStream - Token stream for comment validation
 * @param options - Optional configuration including external struct info
 * @returns Array of errors (empty if all pass)
 */
function runAnalyzers(
  tree: ProgramContext,
  tokenStream: CommonTokenStream,
  options?: IAnalyzerOptions,
): ITranspileError[] {
  const errors: ITranspileError[] = [];
  const formatWithCode = (e: IAnalyzerError) =>
    `error[${e.code}]: ${e.message}`;

  // 1. Parameter naming validation (Issue #227: reserved naming patterns)
  const paramNamingAnalyzer = new ParameterNamingAnalyzer();
  if (collectErrors(paramNamingAnalyzer.analyze(tree), errors)) {
    return errors;
  }

  // 2. Struct field validation (reserved field names like 'length')
  const structFieldAnalyzer = new StructFieldAnalyzer();
  if (
    collectErrors(structFieldAnalyzer.analyze(tree), errors, formatWithCode)
  ) {
    return errors;
  }

  // 3. Initialization analysis (Rust-style use-before-init detection)
  const initAnalyzer = new InitializationAnalyzer();
  if (options?.externalStructFields) {
    initAnalyzer.registerExternalStructFields(options.externalStructFields);
  }
  // Issue #503: Pass symbol table so C++ classes with default constructors are recognized
  if (
    collectErrors(
      initAnalyzer.analyze(tree, options?.symbolTable),
      errors,
      formatWithCode,
    )
  ) {
    return errors;
  }

  // 4. Call analysis (ADR-030: define-before-use)
  const funcAnalyzer = new FunctionCallAnalyzer();
  if (
    collectErrors(
      funcAnalyzer.analyze(tree, options?.symbolTable),
      errors,
      formatWithCode,
    )
  ) {
    return errors;
  }

  // 5. NULL check analysis (ADR-047: C library interop)
  const nullAnalyzer = new NullCheckAnalyzer();
  if (collectErrors(nullAnalyzer.analyze(tree), errors, formatWithCode)) {
    return errors;
  }

  // 6. Division by zero analysis (ADR-051: compile-time detection)
  const divZeroAnalyzer = new DivisionByZeroAnalyzer();
  if (collectErrors(divZeroAnalyzer.analyze(tree), errors, formatWithCode)) {
    return errors;
  }

  // 7. Float modulo analysis (catch % with f32/f64 early)
  const floatModAnalyzer = new FloatModuloAnalyzer();
  if (collectErrors(floatModAnalyzer.analyze(tree), errors, formatWithCode)) {
    return errors;
  }

  // 8. Comment validation (MISRA C:2012 Rules 3.1, 3.2) - ADR-043
  const commentExtractor = new CommentExtractor(tokenStream);
  collectErrors(
    commentExtractor.validate(),
    errors,
    (e) => `error[MISRA-${e.rule}]: ${e.message}`,
  );

  return errors;
}

export default runAnalyzers;
