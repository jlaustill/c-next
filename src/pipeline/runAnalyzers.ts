/**
 * Run all semantic analyzers on a parsed C-Next program
 *
 * Extracted from transpiler.ts for reuse in the unified pipeline.
 * All 5 analyzers run in sequence, each returning errors that block compilation.
 */

import { CommonTokenStream } from "antlr4ng";
import { ProgramContext } from "../parser/grammar/CNextParser";
import InitializationAnalyzer from "../analysis/InitializationAnalyzer";
import FunctionCallAnalyzer from "../analysis/FunctionCallAnalyzer";
import NullCheckAnalyzer from "../analysis/NullCheckAnalyzer";
import DivisionByZeroAnalyzer from "../analysis/DivisionByZeroAnalyzer";
import FloatModuloAnalyzer from "../analysis/FloatModuloAnalyzer";
import CommentExtractor from "../codegen/CommentExtractor";
import ITranspileError from "../lib/types/ITranspileError";

/**
 * Run all semantic analyzers on a parsed program
 *
 * @param tree - The parsed program AST
 * @param tokenStream - Token stream for comment validation
 * @returns Array of errors (empty if all pass)
 */
function runAnalyzers(
  tree: ProgramContext,
  tokenStream: CommonTokenStream,
): ITranspileError[] {
  const errors: ITranspileError[] = [];

  // 1. Initialization analysis (Rust-style use-before-init detection)
  const initAnalyzer = new InitializationAnalyzer();
  const initErrors = initAnalyzer.analyze(tree);

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

  // 2. Call analysis (ADR-030: define-before-use)
  const funcAnalyzer = new FunctionCallAnalyzer();
  const funcErrors = funcAnalyzer.analyze(tree);

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

  // 3. NULL check analysis (ADR-047: C library interop)
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

  // 4. Division by zero analysis (ADR-051: compile-time detection)
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

  // 5. Float modulo analysis (catch % with f32/f64 early)
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

  // 6. Comment validation (MISRA C:2012 Rules 3.1, 3.2) - ADR-043
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
