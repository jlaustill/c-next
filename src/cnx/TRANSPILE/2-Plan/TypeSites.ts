import type IProgramSyntax from "../../types/syntax/IProgramSyntax";
import type TExpression from "../../types/syntax/TExpression";
import type TDeclarationSyntax from "../../types/syntax/TDeclarationSyntax";
import type TTypeSyntax from "../../types/syntax/TTypeSyntax";
import DeclarationParts from "../../utils/DeclarationParts";
import ExpressionNodes from "../../utils/ExpressionNodes";
import MainSignature from "../../utils/MainSignature";
import type ITypeSite from "./types/ITypeSite";

/**
 * Every type 2.3 writes in one file, with the scope it is written in: what
 * 2.2 plans before 2.3 renders any of the file (#1991). A declaration's own types
 * come from `DeclarationParts`; a `cast` or `sizeof` names one inside an
 * expression, a dimension included.
 */
class TypeSites {
  static of(program: IProgramSyntax): readonly ITypeSite[] {
    return program.declarations.flatMap(({ declaration }) =>
      declaration.kind === "scope"
        ? declaration.members
            .filter((member) => !TypeSites.headerText(member.declaration))
            .flatMap((member) =>
              TypeSites.inDeclaration(member.declaration, declaration.name),
            )
        : TypeSites.inDeclaration(declaration, null),
    );
  }

  /**
   * #1300: a scope's struct, enum or bitmap is written into the `.c` as the
   * header's text, so 2.3 renders none of its types
   */
  private static headerText(declaration: TDeclarationSyntax): boolean {
    return (
      declaration.kind === "struct" ||
      declaration.kind === "enum" ||
      declaration.kind === "bitmap"
    );
  }

  private static inDeclaration(
    declaration: TDeclarationSyntax,
    scope: string | null,
  ): ITypeSite[] {
    return DeclarationParts.of(TypeSites.asSpelled(declaration))
      .flatMap((part) => [
        ...(part.kind === "type" ? [part.type] : []),
        ...ExpressionNodes.of(part).flatMap(TypeSites.namedBy),
      ])
      .map((type) => ({ type, scope }));
  }

  /** The type a `cast` or a type-operand `sizeof` names */
  /** `main(string args[])` is written `int main(int argc, char *argv[])`, so 2.3 spells none of its parameter types */
  private static asSpelled(
    declaration: TDeclarationSyntax,
  ): TDeclarationSyntax {
    return declaration.kind === "function" &&
      MainSignature.takesArgs(declaration.name, declaration.parameters)
      ? { ...declaration, parameters: null }
      : declaration;
  }

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
