/**
 * Parameter Naming Analyzer
 * Issue #227: Validates that function parameters don't use reserved naming patterns
 *
 * Parameters cannot start with their containing function's name followed by underscore.
 * This naming pattern is reserved for scope-level variables and would bypass the
 * conflict detection heuristic in SymbolTable.detectConflict().
 */

import { ParseTreeWalker } from "antlr4ng";
import { CNextListener } from "../antlr_parser/grammar/CNextListener";
import * as Parser from "../antlr_parser/grammar/CNextParser";
import IParameterNamingError from "./types/IParameterNamingError";

/**
 * Pure function to check if a parameter name uses a reserved pattern
 *
 * @param parameterName - The parameter name to check
 * @param functionName - The name of the containing function (without scope prefix)
 * @returns true if the parameter name is problematic
 */
function isReservedParameterName(
  parameterName: string,
  functionName: string,
): boolean {
  return parameterName.startsWith(functionName + "_");
}

/**
 * Pure function to create the error message
 *
 * @param parameterName - The parameter name
 * @param functionName - The containing function name
 * @returns The formatted error message
 */
function formatParameterNamingError(
  parameterName: string,
  functionName: string,
): string {
  return (
    `Parameter '${parameterName}' cannot start with function name prefix ` +
    `'${functionName}_'. This naming pattern is reserved for scope-level variables.`
  );
}

/**
 * Listener that walks the parse tree to find parameter naming violations
 */
class ParameterNamingListener extends CNextListener {
  private readonly analyzer: ParameterNamingAnalyzer;

  constructor(analyzer: ParameterNamingAnalyzer) {
    super();
    this.analyzer = analyzer;
  }

  override enterFunctionDeclaration = (
    ctx: Parser.FunctionDeclarationContext,
  ): void => {
    const functionName = ctx.IDENTIFIER().getText();
    const paramList = ctx.parameterList();

    if (paramList) {
      for (const param of paramList.parameter()) {
        const paramIdentifier = param.IDENTIFIER();
        const paramName = paramIdentifier.getText();
        // Use the identifier's position for more precise error location
        const line = paramIdentifier.symbol.line;
        const column = paramIdentifier.symbol.column;

        if (isReservedParameterName(paramName, functionName)) {
          this.analyzer.addError(paramName, functionName, line, column);
        }
      }
    }
  };
}

/**
 * Analyzer for parameter naming violations
 */
class ParameterNamingAnalyzer {
  private errors: IParameterNamingError[] = [];

  /**
   * Analyze the parse tree for parameter naming violations
   *
   * @param tree - The parsed program AST
   * @returns Array of errors (empty if all pass)
   */
  public analyze(tree: Parser.ProgramContext): IParameterNamingError[] {
    this.errors = [];

    const listener = new ParameterNamingListener(this);
    ParseTreeWalker.DEFAULT.walk(listener, tree);

    return this.errors;
  }

  /**
   * Add a parameter naming error
   */
  public addError(
    parameterName: string,
    functionName: string,
    line: number,
    column: number,
  ): void {
    this.errors.push({
      code: "E0227",
      parameterName,
      functionName,
      line,
      column,
      message: formatParameterNamingError(parameterName, functionName),
      helpText: `Consider renaming to a name that doesn't start with '${functionName}_'`,
    });
  }
}

export default ParameterNamingAnalyzer;
