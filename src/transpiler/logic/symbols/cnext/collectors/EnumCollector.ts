/**
 * EnumCollector - Extracts enum type declarations from parse trees.
 * ADR-017: Enums provide named integer constants with auto-increment support.
 */

import * as Parser from "../../../parser/grammar/CNextParser";
import ESourceLanguage from "../../../../../utils/types/ESourceLanguage";
import ESymbolKind from "../../../../../utils/types/ESymbolKind";
import IEnumSymbol from "../../types/IEnumSymbol";
import ExpressionEvaluator from "../utils/ExpressionEvaluator";

class EnumCollector {
  /**
   * Collect an enum declaration and return an IEnumSymbol.
   *
   * @param ctx The enum declaration context
   * @param sourceFile Source file path
   * @param scopeName Optional scope name for nested enums
   * @returns The enum symbol
   * @throws Error if any member has a negative value
   */
  static collect(
    ctx: Parser.EnumDeclarationContext,
    sourceFile: string,
    scopeName?: string,
  ): IEnumSymbol {
    const name = ctx.IDENTIFIER().getText();
    const fullName = scopeName ? `${scopeName}_${name}` : name;
    const line = ctx.start?.line ?? 0;

    // Collect member values with auto-increment
    const members = new Map<string, number>();
    let currentValue = 0;

    for (const member of ctx.enumMember()) {
      const memberName = member.IDENTIFIER().getText();

      if (member.expression()) {
        // Explicit value with <-
        const valueText = member.expression()!.getText();
        const value = ExpressionEvaluator.evaluateConstant(valueText);

        if (value < 0) {
          throw new Error(
            `Error: Negative values not allowed in enum (found ${value} in ${fullName}.${memberName})`,
          );
        }

        currentValue = value;
      }

      members.set(memberName, currentValue);
      currentValue++;
    }

    return {
      name: fullName,
      sourceFile,
      sourceLine: line,
      sourceLanguage: ESourceLanguage.CNext,
      isExported: true,
      kind: ESymbolKind.Enum,
      members,
    };
  }
}

export default EnumCollector;
