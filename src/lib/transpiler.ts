/**
 * C-Next Transpiler Library
 * Core transpilation API for use by CLI and VS Code extension
 *
 * This module provides a synchronous transpile(source) function for in-memory
 * transpilation without header parsing.
 *
 * For multi-file builds or file-based transpilation with header support,
 * use Transpiler from '../transpiler/Transpiler' directly.
 */

import { ParseTreeWalker } from "antlr4ng";
import { CNextLexer } from "../transpiler/logic/parser/grammar/CNextLexer";
import { CNextParser } from "../transpiler/logic/parser/grammar/CNextParser";
import CNextSourceParser from "../transpiler/logic/parser/CNextSourceParser";
import CodeGenerator from "../transpiler/output/codegen/CodeGenerator";
import CommentExtractor from "../transpiler/logic/analysis/CommentExtractor";
import InitializationAnalyzer from "../transpiler/logic/analysis/InitializationAnalyzer";
import CNextResolver from "../transpiler/logic/symbols/cnext";
import TSymbolInfoAdapter from "../transpiler/logic/symbols/cnext/adapters/TSymbolInfoAdapter";
import FunctionCallAnalyzer from "../transpiler/logic/analysis/FunctionCallAnalyzer";
import NullCheckAnalyzer from "../transpiler/logic/analysis/NullCheckAnalyzer";
import DivisionByZeroAnalyzer from "../transpiler/logic/analysis/DivisionByZeroAnalyzer";
import FloatModuloAnalyzer from "../transpiler/logic/analysis/FloatModuloAnalyzer";
import GrammarCoverageListener from "../transpiler/logic/analysis/GrammarCoverageListener";
import ITranspileResult from "./types/ITranspileResult";
import ITranspileOptions from "./types/ITranspileOptions";
import ParserUtils from "../utils/ParserUtils";
import IGrammarCoverageReport from "../transpiler/logic/analysis/types/IGrammarCoverageReport";

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
  const {
    parseOnly = false,
    debugMode = false,
    target,
    collectGrammarCoverage = false,
  } = options;
  let grammarCoverage: IGrammarCoverageReport | undefined;

  // Parse C-Next source
  const { tree, tokenStream, errors, declarationCount } =
    CNextSourceParser.parse(source);

  // Collect grammar coverage if requested (Issue #35)
  if (collectGrammarCoverage) {
    const coverageListener = new GrammarCoverageListener(
      CNextParser.ruleNames,
      CNextLexer.ruleNames,
    );
    ParseTreeWalker.DEFAULT.walk(coverageListener, tree);
    grammarCoverage = coverageListener.getReport();
  }

  // If there are parse errors or parseOnly mode, return early
  if (errors.length > 0) {
    return {
      success: false,
      code: "",
      errors,
      declarationCount,
      grammarCoverage,
    };
  }

  if (parseOnly) {
    return {
      success: true,
      code: "",
      errors: [],
      declarationCount,
      grammarCoverage,
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
      grammarCoverage,
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
      grammarCoverage,
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
      grammarCoverage,
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
      grammarCoverage,
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
      grammarCoverage,
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
      grammarCoverage,
    };
  }

  // Generate C code
  try {
    // ADR-055: Collect symbols using CNextResolver + TSymbolInfoAdapter
    const tSymbols = CNextResolver.resolve(tree, "<source>");
    const symbolInfo = TSymbolInfoAdapter.convert(tSymbols);

    const generator = new CodeGenerator();
    const code = generator.generate(tree, undefined, tokenStream, {
      debugMode,
      target,
      symbolInfo,
    });

    return {
      success: true,
      code,
      errors: [],
      declarationCount,
      grammarCoverage,
    };
  } catch (e) {
    // Handle code generation errors
    const rawMessage = e instanceof Error ? e.message : String(e);
    const parsed = ParserUtils.parseErrorLocation(rawMessage);

    errors.push({
      line: parsed.line,
      column: parsed.column,
      message: `Code generation failed: ${parsed.message}`,
      severity: "error",
    });
    return {
      success: false,
      code: "",
      errors,
      declarationCount,
      grammarCoverage,
    };
  }
}

export default transpile;
