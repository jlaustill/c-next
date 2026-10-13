import type IProgramSyntax from "../../types/syntax/IProgramSyntax";
import type TExpression from "../../types/syntax/TExpression";
import type TDeclarationSyntax from "../../types/syntax/TDeclarationSyntax";
import type TSyntaxPart from "../../types/syntax/TSyntaxPart";
import type TTypeSyntax from "../../types/syntax/TTypeSyntax";
import ExpressionNodes from "../../utils/ExpressionNodes";
import WrittenParts from "./WrittenParts";
import type ITypeSite from "./types/ITypeSite";

/**
 * Every type 2.3 writes in one file, with the scope it is written in: what
 * 2.2 plans before 2.3 renders any of the file (#1991). A written part's own
 * type, or one a `cast` or `sizeof` names inside an expression, except a
 * dimension or enum value, which 1.4 spells.
 */
class TypeSites {
  /** `unwritten`: declarations 2.2 decided 2.3 writes nothing of, e.g. an inlined private const (#282) */
  static of(
    program: IProgramSyntax,
    unwritten: ReadonlySet<TDeclarationSyntax> = new Set(),
  ): readonly ITypeSite[] {
    return WrittenParts.of(program, unwritten).flatMap(({ part, scope }) =>
      TypeSites.inPart(part).map((type) => ({ type, scope })),
    );
  }

  private static inPart(part: TSyntaxPart): TTypeSyntax[] {
    if (part.kind === "type") return [part.type];
    return part.constant
      ? []
      : ExpressionNodes.direct(part.expression).flatMap(TypeSites.namedBy);
  }

  /** The type a `cast` or a type-operand `sizeof` names */
  private static namedBy(expression: TExpression): TTypeSyntax[] {
    if (expression.kind === "cast") {
      return [expression.type];
    }
    return expression.kind === "sizeof" && expression.type !== null
      ? [expression.type]
      : [];
  }
}

export default TypeSites;
