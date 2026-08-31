/**
 * Run all semantic analyzers on a parsed C-Next program
 *
 * Extracted from transpiler.ts for reuse in the unified pipeline.
 * All 14 analyzers (plus comment validation) run in sequence, each returning
 * errors that block compilation.
 */

import { CommonTokenStream } from "antlr4ng";
import { ProgramContext } from "../parser/grammar/CNextParser";
import IdentifierSyntaxAnalyzer from "./IdentifierSyntaxAnalyzer";
import ParameterNamingAnalyzer from "./ParameterNamingAnalyzer";
import StructFieldAnalyzer from "./StructFieldAnalyzer";
import InitializationAnalyzer from "./InitializationAnalyzer";
import FunctionCallAnalyzer from "./FunctionCallAnalyzer";
import UndeclaredTypeAnalyzer from "./UndeclaredTypeAnalyzer";
import UndeclaredValueAnalyzer from "./UndeclaredValueAnalyzer";
import NullCheckAnalyzer from "./NullCheckAnalyzer";
import DivisionByZeroAnalyzer from "./DivisionByZeroAnalyzer";
import FloatModuloAnalyzer from "./FloatModuloAnalyzer";
import ArrayIndexTypeAnalyzer from "./ArrayIndexTypeAnalyzer";
import SignedShiftAnalyzer from "./SignedShiftAnalyzer";
import BooleanOperandAnalyzer from "./BooleanOperandAnalyzer";
import MixedTypeCategoryAnalyzer from "./MixedTypeCategoryAnalyzer";
import ReturnPathAnalyzer from "./ReturnPathAnalyzer";
import ReturnValueUseAnalyzer from "./ReturnValueUseAnalyzer";
import CommentExtractor from "./CommentExtractor";
import ITranspileError from "../../../lib/types/ITranspileError";
import SymbolTable from "../symbols/SymbolTable";
import CodeGenState from "../../state/CodeGenState";

/**
 * Options for running analyzers
 */
interface IAnalyzerOptions {
  /**
   * Symbol table containing external function definitions from C/C++ headers
   * Used by FunctionCallAnalyzer to recognize external functions.
   * Falls back to CodeGenState.symbolTable if not provided.
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
 * One analysis step.
 *
 * #1399 review: the body was fifteen repetitions of
 * `if (collectErrors(x.analyze(tree), errors, fmt)) return errors;`, which is a
 * table written as control flow -- cognitive complexity 16, over the 15 limit,
 * and growing by one with every analyzer added. The ordering constraints were
 * real but survived only as prose between the blocks; as entries they are data
 * that moves with the step.
 */
interface IAnalyzerStep {
  /** Why this step sits here, when its position matters. */
  readonly label: string;
  readonly run: () => IAnalyzerError[];
  /** Defaults to the `error[CODE]: message` form. */
  readonly format?: (err: IAnalyzerError) => string;
  /** When true, findings are reported and later steps still run. */
  readonly advisory?: boolean;
}

/**
 * Run all semantic analyzers on a parsed program.
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

  // External function definitions from C/C++ headers, for the two steps that
  // need them. Read from CodeGenState unless the caller supplied one.
  const symbolTable = options?.symbolTable ?? CodeGenState.symbolTable;

  const steps: readonly IAnalyzerStep[] = [
    {
      // First: a malformed identifier feeds a bad name into every later analysis.
      label: "identifier syntax (ADR-063: no trailing or consecutive '_')",
      run: () => new IdentifierSyntaxAnalyzer().analyze(tree),
    },
    {
      label: "parameter naming (Issue #227: reserved naming patterns)",
      run: () => new ParameterNamingAnalyzer().analyze(tree),
      // Carries its own message text rather than a code.
      format: (e) => e.message,
    },
    {
      label: "struct fields (reserved field names like 'length')",
      run: () => new StructFieldAnalyzer().analyze(tree),
    },
    {
      label: "initialization (Rust-style use-before-init)",
      run: () => new InitializationAnalyzer().analyze(tree, symbolTable),
    },
    {
      // Before the call and essential-type analyses: a type that denotes
      // nothing feeds an unknown type into every later question, so the
      // diagnostics after it would name a consequence rather than the cause.
      label: "undefined type references (#1312)",
      run: () => new UndeclaredTypeAnalyzer().analyze(tree),
    },
    {
      // After the type check, so a file whose type is undefined reports the
      // type rather than every use of it.
      label: "undefined value references (#1353)",
      run: () => new UndeclaredValueAnalyzer().analyze(tree),
    },
    {
      label: "call analysis (ADR-030: define-before-use)",
      run: () => new FunctionCallAnalyzer().analyze(tree, symbolTable),
    },
    {
      label: "NULL checks (ADR-047: C library interop)",
      run: () => new NullCheckAnalyzer().analyze(tree),
    },
    {
      label: "division by zero (ADR-051: compile-time detection)",
      run: () => new DivisionByZeroAnalyzer().analyze(tree),
    },
    {
      label: "float modulo (% with f32/f64)",
      run: () => new FloatModuloAnalyzer().analyze(tree),
    },
    {
      label: "array index type (ADR-054: unsigned indexes only)",
      run: () => new ArrayIndexTypeAnalyzer().analyze(tree),
    },
    {
      label: "signed shift (MISRA C:2012 Rule 10.1)",
      run: () => new SignedShiftAnalyzer().analyze(tree),
    },
    {
      // Before the Rule 10.4 check, so a bool in an arithmetic expression is
      // reported as "not a number" rather than as a category mismatch with
      // whatever it was combined with.
      label: "boolean operands (MISRA C:2012 Rule 10.1, Issue #1183)",
      run: () => new BooleanOperandAnalyzer().analyze(tree),
    },
    {
      label:
        "mixed essential type category (MISRA C:2012 Rule 10.4, ADR-024 / Issue #1091)",
      run: () => new MixedTypeCategoryAnalyzer().analyze(tree),
    },
    {
      label: "return paths (ADR-067: non-void must return on all paths)",
      run: () => new ReturnPathAnalyzer().analyze(tree),
    },
    {
      label:
        "return-value use (ADR-070 / MISRA C:2012 Rule 17.7 at source level)",
      run: () => ReturnValueUseAnalyzer.analyze(tree),
    },
    {
      // Last, and does not halt: comment findings are reported alongside
      // whatever else the file produced.
      label: "comment validation (MISRA C:2012 Rules 3.1, 3.2 -- ADR-043)",
      run: () => new CommentExtractor(tokenStream).validate(),
      format: (e) => `error[MISRA-${e.rule}]: ${e.message}`,
      advisory: true,
    },
  ];

  for (const step of steps) {
    const found = collectErrors(
      step.run(),
      errors,
      step.format ?? formatWithCode,
    );
    if (found && !step.advisory) {
      return errors;
    }
  }

  return errors;
}

export default runAnalyzers;
