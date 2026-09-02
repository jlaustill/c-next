/**
 * EnumCollector - Extracts enum type declarations from parse trees.
 * ADR-017: Enums provide named integer constants with auto-increment support.
 *
 * Produces TType-based IEnumSymbol with proper IScopeSymbol references.
 */

import * as Parser from "../../../parser/grammar/CNextParser";
import ESourceLanguage from "../../../../../utils/types/ESourceLanguage";
import IEnumSymbol from "../../../../types/symbols/IEnumSymbol";
import ExpressionEvaluator from "../utils/ExpressionEvaluator";
import ScopeUtils from "../../../../../utils/ScopeUtils";
import TVisibility from "../../../../types/TVisibility";

class EnumCollector {
  /**
   * Collect an enum declaration and return an IEnumSymbol.
   *
   * @param ctx The enum declaration context
   * @param sourceFile Source file path
   * @param scopePath The path of the scope this enum belongs to (dotted path, "" at file scope)
   * @param visibility ADR-016 visibility as declared (#1300)
   * @returns The enum symbol with proper scope reference
   * @throws Error if any member has a negative value
   */
  static collect(
    ctx: Parser.EnumDeclarationContext,
    sourceFile: string,
    scopePath: string,
    visibility: TVisibility,
  ): IEnumSymbol {
    const name = ctx.IDENTIFIER().getText();
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
            `Error: Negative values not allowed in enum (found ${value} in ${name}.${memberName})`,
          );
        }

        currentValue = value;
      }

      members.set(memberName, currentValue);
      currentValue++;
    }

    return {
      kind: "enum",
      name,
      scopePath,
      // #1285: identity computed once, from the scope chain, not
      // re-derived by every consumer.
      ...ScopeUtils.identityOf({ name, scopePath }),
      sourceFile,
      sourceLine: line,
      sourceLanguage: ESourceLanguage.CNext,
      visibility,
      members,
    };
  }
}

export default EnumCollector;
