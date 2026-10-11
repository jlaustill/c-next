/**
 * EnumCollector - Extracts enum type declarations from parse trees.
 * ADR-017: Enums provide named integer constants with auto-increment support.
 *
 * Produces TType-based IEnumSymbol with proper IScopeSymbol references.
 */

import * as Parser from "../../../2-Parse/grammar/CNextParser";
import ESourceLanguage from "../../../../utils/types/ESourceLanguage";
import IEnumSymbol from "../../../../types/symbols/IEnumSymbol";
import ConstExprLowering from "../../../../utils/ConstExprLowering";
import SyntaxLowering from "../../../2-Parse/SyntaxLowering";
import ScopeUtils from "../../../../utils/ScopeUtils";
import TVisibility from "../../../../types/TVisibility";
import ParserUtils from "../../../../utils/ParserUtils";
import type IEnumMemberSymbol from "../../../../types/symbols/IEnumMemberSymbol";
import MemberSymbolBase from "../utils/MemberSymbolBase";

class EnumCollector {
  /**
   * Collect an enum declaration and return an IEnumSymbol.
   *
   * @param ctx The enum declaration context
   * @param sourceFile Source file path
   * @param scopePath The path of the scope this enum belongs to (dotted path, "" at file scope)
   * @param visibility ADR-016 visibility as declared (#1300)
   * @returns The enum symbol with proper scope reference. Each member's value
   *          is recorded as WRITTEN, and its number is left to 1.4 Resolve:
   *          a value may name a const or an earlier member (ADR-017 "Member
   *          Values"), and those settle across the whole program (#1669). A
   *          value 1.4 cannot settle, a negative one, or one outside `i32` is
   *          2.1 Analyze's to report.
   */
  static collect(
    ctx: Parser.EnumDeclarationContext,
    sourceFile: string,
    scopePath: string,
    visibility: TVisibility,
  ): IEnumSymbol {
    const name = ctx.IDENTIFIER().getText();
    const span = ParserUtils.getSpan(ctx);

    const members = new Map<string, IEnumMemberSymbol>();

    // #1318: a member's identity hangs off the ENUM's source-spelled name, not
    // the enclosing scope's. `identityOf` then yields the identifier codegen
    // already emits -- EColor__RED, and Motor__EMode__HIGH for a scope-declared
    // enum, because fromParts expands the dotted component. Derived here once
    // rather than at each consumer (#1285).
    const identity = ScopeUtils.identityOf({ name, scopePath });
    const enumScopedName = identity.cnxScopedName;

    for (const member of ctx.enumMember()) {
      const memberName = member.IDENTIFIER().getText();

      const valueExpression = member.expression();
      members.set(memberName, {
        ...MemberSymbolBase.of({
          kind: "enum_member" as const,
          name: memberName,
          parentScopedName: enumScopedName,
          memberCtx: member,
          parentSpan: span,
          sourceFile,
          visibility,
        }),
        valueExpr: valueExpression
          ? ConstExprLowering.lower(SyntaxLowering.expression(valueExpression))
          : null,
        value: null,
      });
    }

    return {
      kind: "enum",
      name,
      scopePath,
      // #1285: identity computed once, from the scope chain, not
      // re-derived by every consumer.
      // #1318 review: the same identity the members were keyed by, not a
      // second call with the same arguments -- change one and the members
      // would keep the old parent name while this reported the new one.
      ...identity,
      sourceFile,
      span,
      sourceLanguage: ESourceLanguage.CNext,
      visibility,
      members,
    };
  }
}

export default EnumCollector;
