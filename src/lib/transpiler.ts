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
import runAnalyzers from "../transpiler/logic/analysis/runAnalyzers";
import CNextResolver from "../transpiler/logic/symbols/cnext";
import TSymbolInfoAdapter from "../transpiler/logic/symbols/cnext/adapters/TSymbolInfoAdapter";
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

  // Run all semantic analyzers (Issue #707: consolidated analyzer invocation)
  // Note: lib/transpiler is a simple in-memory API without access to external
  // struct fields or symbol table, so options are omitted
  const analyzerErrors = runAnalyzers(tree, tokenStream);

  if (analyzerErrors.length > 0) {
    return {
      success: false,
      code: "",
      errors: analyzerErrors,
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

    return {
      success: false,
      code: "",
      errors: [
        {
          line: parsed.line,
          column: parsed.column,
          message: `Code generation failed: ${parsed.message}`,
          severity: "error",
        },
      ],
      declarationCount,
      grammarCoverage,
    };
  }
}

export default transpile;
