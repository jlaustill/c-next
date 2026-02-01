/**
 * Struct Field Analyzer
 * Validates that struct field names don't conflict with C-Next reserved property names
 *
 * Fields cannot use reserved names like 'length' which conflict with C-Next's
 * built-in .length property for primitives and arrays.
 */

import { ParseTreeWalker } from "antlr4ng";
import { CNextListener } from "../parser/grammar/CNextListener";
import * as Parser from "../parser/grammar/CNextParser";
import IStructFieldError from "./types/IStructFieldError";
import SymbolUtils from "../symbols/SymbolUtils";

/**
 * Pure function to create the error message
 *
 * @param fieldName - The field name
 * @param structName - The containing struct name
 * @returns The formatted error message
 */
function formatStructFieldError(fieldName: string, structName: string): string {
  return (
    `Struct field '${fieldName}' in '${structName}' uses a reserved C-Next property name. ` +
    `The '.${fieldName}' property is built-in and will shadow this field.`
  );
}

/**
 * Listener that walks the parse tree to find struct field naming violations
 */
class StructFieldListener extends CNextListener {
  private readonly analyzer: StructFieldAnalyzer;

  constructor(analyzer: StructFieldAnalyzer) {
    super();
    this.analyzer = analyzer;
  }

  override enterStructDeclaration = (
    ctx: Parser.StructDeclarationContext,
  ): void => {
    const structName = ctx.IDENTIFIER().getText();
    const members = ctx.structMember();

    for (const member of members) {
      const fieldIdentifier = member.IDENTIFIER();
      const fieldName = fieldIdentifier.getText();
      const line = fieldIdentifier.symbol.line;
      const column = fieldIdentifier.symbol.column;

      if (SymbolUtils.isReservedFieldName(fieldName)) {
        this.analyzer.addError(structName, fieldName, line, column);
      }
    }
  };
}

/**
 * Analyzer for struct field naming violations
 */
class StructFieldAnalyzer {
  private errors: IStructFieldError[] = [];

  /**
   * Analyze the parse tree for struct field naming violations
   *
   * @param tree - The parsed program AST
   * @returns Array of errors (empty if all pass)
   */
  public analyze(tree: Parser.ProgramContext): IStructFieldError[] {
    this.errors = [];

    const listener = new StructFieldListener(this);
    ParseTreeWalker.DEFAULT.walk(listener, tree);

    return this.errors;
  }

  /**
   * Add a struct field naming error
   */
  public addError(
    structName: string,
    fieldName: string,
    line: number,
    column: number,
  ): void {
    const reservedNames = SymbolUtils.getReservedFieldNames().join(", ");
    this.errors.push({
      code: "E0355",
      structName,
      fieldName,
      line,
      column,
      message: formatStructFieldError(fieldName, structName),
      helpText: `Reserved field names: ${reservedNames}. Consider using 'len', 'size', or 'count' instead.`,
    });
  }
}

export default StructFieldAnalyzer;
