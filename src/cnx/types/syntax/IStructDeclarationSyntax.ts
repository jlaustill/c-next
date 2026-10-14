import type TOverflowBehavior from "../TOverflowBehavior";
import type ISyntaxNode from "./ISyntaxNode";
import type TExpression from "./TExpression";
import type TTypeSyntax from "./TTypeSyntax";

/** `struct name { type field dims*; ... }` */
interface IStructDeclarationSyntax extends ISyntaxNode {
  readonly name: string;
  readonly fields: ReadonlyArray<
    ISyntaxNode & {
      readonly type: TTypeSyntax;
      readonly name: string;
      readonly nameSpan: ISyntaxNode["span"];
      readonly dimensions: ReadonlyArray<TExpression | null>;
      /** ADR-044: the field's own written clamp/wrap, or null when unwritten */
      readonly overflow: TOverflowBehavior | null;
    }
  >;
}

export default IStructDeclarationSyntax;
