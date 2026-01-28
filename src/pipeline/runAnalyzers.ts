/**
 * Run all semantic analyzers on a parsed C-Next program
 *
 * Extracted from transpiler.ts for reuse in the unified pipeline.
 * All 8 analyzers run in sequence, each returning errors that block compilation.
 */

import { CommonTokenStream } from "antlr4ng";
import { ProgramContext } from "../antlr_parser/grammar/CNextParser";
import ParameterNamingAnalyzer from "../analysis/ParameterNamingAnalyzer";
import StructFieldAnalyzer from "../analysis/StructFieldAnalyzer";
import InitializationAnalyzer from "../analysis/InitializationAnalyzer";
import FunctionCallAnalyzer from "../analysis/FunctionCallAnalyzer";
import NullCheckAnalyzer from "../analysis/NullCheckAnalyzer";
import DivisionByZeroAnalyzer from "../analysis/DivisionByZeroAnalyzer";
import FloatModuloAnalyzer from "../analysis/FloatModuloAnalyzer";
import CommentExtractor from "../codegen/CommentExtractor";
import ITranspileError from "../lib/types/ITranspileError";
import SymbolTable from "../symbol_resolution/SymbolTable";

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

  // 1. Parameter naming validation (Issue #227: reserved naming patterns)
  const paramNamingAnalyzer = new ParameterNamingAnalyzer();
  const paramNamingErrors = paramNamingAnalyzer.analyze(tree);

  for (const paramError of paramNamingErrors) {
    errors.push({
      line: paramError.line,
      column: paramError.column,
      message: paramError.message,
      severity: "error",
    });
  }

  if (errors.length > 0) {
    return errors;
  }

  // 2. Struct field validation (reserved field names like 'length')
  const structFieldAnalyzer = new StructFieldAnalyzer();
  const structFieldErrors = structFieldAnalyzer.analyze(tree);

  for (const fieldError of structFieldErrors) {
    errors.push({
      line: fieldError.line,
      column: fieldError.column,
      message: `error[${fieldError.code}]: ${fieldError.message}`,
      severity: "error",
    });
  }

  if (errors.length > 0) {
    return errors;
  }

  // 3. Initialization analysis (Rust-style use-before-init detection)
  const initAnalyzer = new InitializationAnalyzer();

  // Register external struct fields from C/C++ headers if provided
  if (options?.externalStructFields) {
    initAnalyzer.registerExternalStructFields(options.externalStructFields);
  }

  // Issue #503: Pass symbol table so C++ classes with default constructors
  // are recognized as initialized
  const initErrors = initAnalyzer.analyze(tree, options?.symbolTable);

  for (const initError of initErrors) {
    errors.push({
      line: initError.line,
      column: initError.column,
      message: `error[${initError.code}]: ${initError.message}`,
      severity: "error",
    });
  }

  if (errors.length > 0) {
    return errors;
  }

  // 3. Call analysis (ADR-030: define-before-use)
  // Pass symbol table so external functions from C/C++ headers are recognized
  const funcAnalyzer = new FunctionCallAnalyzer();
  const funcErrors = funcAnalyzer.analyze(tree, options?.symbolTable);

  for (const funcError of funcErrors) {
    errors.push({
      line: funcError.line,
      column: funcError.column,
      message: `error[${funcError.code}]: ${funcError.message}`,
      severity: "error",
    });
  }

  if (errors.length > 0) {
    return errors;
  }

  // 4. NULL check analysis (ADR-047: C library interop)
  const nullAnalyzer = new NullCheckAnalyzer();
  const nullErrors = nullAnalyzer.analyze(tree);

  for (const nullError of nullErrors) {
    errors.push({
      line: nullError.line,
      column: nullError.column,
      message: `error[${nullError.code}]: ${nullError.message}`,
      severity: "error",
    });
  }

  if (errors.length > 0) {
    return errors;
  }

  // 5. Division by zero analysis (ADR-051: compile-time detection)
  const divZeroAnalyzer = new DivisionByZeroAnalyzer();
  const divZeroErrors = divZeroAnalyzer.analyze(tree);

  for (const divZeroError of divZeroErrors) {
    errors.push({
      line: divZeroError.line,
      column: divZeroError.column,
      message: `error[${divZeroError.code}]: ${divZeroError.message}`,
      severity: "error",
    });
  }

  if (errors.length > 0) {
    return errors;
  }

  // 6. Float modulo analysis (catch % with f32/f64 early)
  const floatModAnalyzer = new FloatModuloAnalyzer();
  const floatModErrors = floatModAnalyzer.analyze(tree);

  for (const floatModError of floatModErrors) {
    errors.push({
      line: floatModError.line,
      column: floatModError.column,
      message: `error[${floatModError.code}]: ${floatModError.message}`,
      severity: "error",
    });
  }

  if (errors.length > 0) {
    return errors;
  }

  // 7. Comment validation (MISRA C:2012 Rules 3.1, 3.2) - ADR-043
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

  return errors;
}

export default runAnalyzers;
