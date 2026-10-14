import type TExpression from "../types/syntax/TExpression";
import type TSyntaxPart from "../types/syntax/TSyntaxPart";
import type TTypeSyntax from "../types/syntax/TTypeSyntax";

/** The types and expressions written inside one type: an array's element and dimensions, a template's type arguments */
class TypeParts {
  static of(type: TTypeSyntax): readonly TSyntaxPart[] {
    switch (type.kind) {
      case "array":
        return [
          { kind: "type", type: type.element },
          ...TypeParts.dimensions(type.dimensions),
        ];
      case "template":
        return type.arguments.flatMap((argument): TSyntaxPart[] =>
          argument.kind === "type"
            ? [{ kind: "type", type: argument.type }]
            : [],
        );
      case "primitive":
      case "string":
      case "scoped":
      case "global":
      case "qualified":
      case "user":
      case "void":
      case "missing":
        return [];
      default: {
        const unhandled: never = type;
        return unhandled;
      }
    }
  }

  static dimensions(
    dimensions: ReadonlyArray<TExpression | null>,
  ): readonly TSyntaxPart[] {
    return dimensions.flatMap((dimension): TSyntaxPart[] =>
      dimension === null
        ? []
        : [{ kind: "expression", expression: dimension, constant: true }],
    );
  }
}

export default TypeParts;
