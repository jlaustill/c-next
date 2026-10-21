import type IProgramSyntax from "../../types/syntax/IProgramSyntax";
import type TExpression from "../../types/syntax/TExpression";
import type TSyntaxPart from "../../types/syntax/TSyntaxPart";
import type TTypeSyntax from "../../types/syntax/TTypeSyntax";
import WrittenParts from "./WrittenParts";
import type ITypeSite from "./types/ITypeSite";
import type IUnwrittenSyntax from "./types/IUnwrittenSyntax";

const NOTHING_UNWRITTEN: IUnwrittenSyntax = {
  declarations: new Set(),
  values: new Set(),
};

/**
 * Every type 2.3 writes in one file, with the scope it is written in: what
 * 2.2 plans before 2.3 renders any of the file (#1991). A written part's own
 * type, or one a `cast` names inside an expression, except a
 * dimension or enum value, which 1.4 spells.
 */
class TypeSites {
  /** `unwritten`: what 2.2 decided 2.3 writes none of the syntax of */
  static of(
    program: IProgramSyntax,
    unwritten: IUnwrittenSyntax = NOTHING_UNWRITTEN,
  ): readonly ITypeSite[] {
    return WrittenParts.of(program, unwritten).flatMap(({ part, scope }) =>
      TypeSites.inPart(part, unwritten).map((type) => ({ type, scope })),
    );
  }

  private static inPart(
    part: TSyntaxPart,
    unwritten: IUnwrittenSyntax,
  ): TTypeSyntax[] {
    if (part.kind === "type") return [part.type];
    return part.constant
      ? []
      : WrittenParts.nodes(part.expression, unwritten).flatMap(
          TypeSites.namedBy,
        );
  }

  /** The type a `cast` names */
  private static namedBy(expression: TExpression): TTypeSyntax[] {
    return expression.kind === "cast" ? [expression.type] : [];
  }
}

export default TypeSites;
