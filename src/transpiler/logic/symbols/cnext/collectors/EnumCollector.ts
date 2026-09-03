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
import ParserUtils from "../../../../../utils/ParserUtils";
import type IEnumMemberSymbol from "../../../../types/symbols/IEnumMemberSymbol";

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
    const span = ParserUtils.getSpan(ctx);

    // Collect member values with auto-increment
    const members = new Map<string, IEnumMemberSymbol>();
    let currentValue = 0;

    // #1318: a member's identity hangs off the ENUM's source-spelled name, not
    // the enclosing scope's. `identityOf` then yields the identifier codegen
    // already emits -- EColor__RED, and Motor__EMode__HIGH for a scope-declared
    // enum, because fromParts expands the dotted component. Derived here once
    // rather than at each consumer (#1285).
    const enumScopedName = ScopeUtils.identityOf({
      name,
      scopePath,
    }).cnxScopedName;

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

      members.set(memberName, {
        kind: "enum_member",
        name: memberName,
        scopePath: enumScopedName,
        ...ScopeUtils.identityOf({
          name: memberName,
          scopePath: enumScopedName,
        }),
        sourceFile,
        // #1318: the MEMBER's span, not the enum's. This is the whole point --
        // a diagnostic naming a member used to point at the enum's first line.
        span: ParserUtils.getSpan(member),
        sourceLanguage: ESourceLanguage.CNext,
        // A member is exactly as visible as the enum declaring it; ADR-016 has
        // no per-member access control, so inheriting is the fact, and a
        // hardcoded "public" beside a private parent is the #1300 defect.
        visibility,
        value: currentValue,
      });
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
      span,
      sourceLanguage: ESourceLanguage.CNext,
      visibility,
      members,
    };
  }
}

export default EnumCollector;
