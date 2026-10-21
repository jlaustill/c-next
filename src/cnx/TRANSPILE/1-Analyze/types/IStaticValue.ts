import type TDeclarationSyntax from "../../../types/syntax/TDeclarationSyntax";
import type TExpression from "../../../types/syntax/TExpression";

/**
 * #1735: one value a static-storage initializer holds, and the number or bool
 * type it is held at -- null for any other type (an enum, a struct)
 */
interface IStaticValue {
  readonly declaration: Extract<
    TDeclarationSyntax,
    { kind: "variableDeclaration" }
  >;
  readonly value: TExpression;
  readonly typeName: string | null;
}

export default IStaticValue;
