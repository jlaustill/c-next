import type TDeclarationSyntax from "../../../types/syntax/TDeclarationSyntax";
import type TExpression from "../../../types/syntax/TExpression";

/** #1735: one value a static-storage initializer holds, and the type it is held at */
interface IStaticValue {
  readonly declaration: Extract<
    TDeclarationSyntax,
    { kind: "variableDeclaration" }
  >;
  readonly value: TExpression;
  readonly typeName: string;
}

export default IStaticValue;
