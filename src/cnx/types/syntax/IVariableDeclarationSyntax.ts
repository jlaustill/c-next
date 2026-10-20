import type ISourceSpan from "../ISourceSpan";
import type ISyntaxNode from "./ISyntaxNode";
import type TExpression from "./TExpression";
import type TTypeSyntax from "./TTypeSyntax";

/** `[atomic] [volatile] [const] [mut] [clamp|wrap] Type name[dims] [<- value]` */
interface IVariableDeclarationSyntax extends ISyntaxNode {
  readonly modifiers: {
    readonly atomic: boolean;
    readonly volatile: boolean;
    /** ADR-071: parsed only so it can be rejected; always false in a for header */
    readonly const: boolean;
    /** ADR-071: the binding may be written -- `mut`, or `atomic`, which implies it (#2233) */
    readonly mut: boolean;
    /** #2233: `mut` written beside `atomic`; parsed only so E0919 can reject it */
    readonly atomicMut: boolean;
    readonly overflow: "clamp" | "wrap" | null;
  };
  readonly type: TTypeSyntax;
  readonly name: string;
  readonly nameSpan: ISyntaxNode["span"];
  /** Dimensions after the name, `[]` written as null */
  readonly dimensions: ReadonlyArray<TExpression | null>;
  /** Where each of those `[...]` is written, so an unsized `[]` has a position too (#2073) */
  readonly dimensionSpans: readonly ISourceSpan[];
  readonly initializer: TExpression | null;
  /** #1643 (ADR-030): its own name is written bare past the declarator */
  readonly spellsOwnName: boolean;
}

export default IVariableDeclarationSyntax;
