import type IProgramSyntax from "../../types/syntax/IProgramSyntax";
import type TExpression from "../../types/syntax/TExpression";
import type TSyntaxPart from "../../types/syntax/TSyntaxPart";
import type TTypeSyntax from "../../types/syntax/TTypeSyntax";
import DeclarationParts from "../../utils/DeclarationParts";
import ExpressionNodes from "../../utils/ExpressionNodes";
import type ITypeSite from "./types/ITypeSite";

/**
 * Every written type in one file, with the scope it is written in: what 2.2
 * plans before 2.3 renders any of the file (#1991). A declaration's own types
 * come from `DeclarationParts`; a `cast` or `sizeof` names one inside an
 * expression, a dimension included.
 */
class TypeSites {
  static of(program: IProgramSyntax): readonly ITypeSite[] {
    return program.declarations.flatMap(({ declaration }) =>
      declaration.kind === "scope"
        ? declaration.members.flatMap((member) =>
            TypeSites.inParts(
              DeclarationParts.of(member.declaration),
              declaration.name,
            ),
          )
        : TypeSites.inParts(DeclarationParts.of(declaration), null),
    );
  }

  private static inParts(
    parts: readonly TSyntaxPart[],
    scope: string | null,
  ): ITypeSite[] {
    return parts
      .flatMap((part) => [
        ...(part.kind === "type" ? [part.type] : []),
        ...ExpressionNodes.of(part).flatMap(TypeSites.namedBy),
      ])
      .map((type) => ({ type, scope }));
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
