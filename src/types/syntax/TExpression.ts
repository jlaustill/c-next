import type ISyntaxNode from "./ISyntaxNode";
import type TBinaryLevel from "./TBinaryLevel";
import type TBinaryOperator from "./TBinaryOperator";
import type TLiteralKind from "./TLiteralKind";
import type TPostfixOpSyntax from "./TPostfixOpSyntax";
import type TTypeSyntax from "./TTypeSyntax";
import type IFieldInitializerSyntax from "./IFieldInitializerSyntax";

/**
 * An expression as plain data, lowered from the parse tree once, by 1.2 Parse
 * (#1932). Every pass from 2.2 on reads this and never a parse node: the tree
 * is gone before 2.2 (owner ruling on #1932, docs/architecture/README.md §2).
 *
 * The shape is the grammar's, minus its pass-through levels. A precedence
 * level with one operand is its operand, so `x` is an `identifier`, not ten
 * nested levels; a level with several is ONE `binary` node holding all of
 * them, because the rules that read levels (#1668's composites, ADR-044's
 * saturation) read a whole level at once. A postfix chain with no operations
 * is its primary.
 *
 * Plain data: it survives a JSON round trip unchanged, which a parse node,
 * holding its parent, its tokens and its input stream, cannot.
 */
type TExpression = ISyntaxNode &
  (
    | {
        readonly kind: "ternary";
        readonly condition: TExpression;
        readonly whenTrue: TExpression;
        readonly whenFalse: TExpression;
      }
    | {
        readonly kind: "binary";
        readonly level: TBinaryLevel;
        /** Two or more, left to right */
        readonly operands: readonly TExpression[];
        /** `operators[i]` sits between `operands[i]` and `operands[i + 1]` */
        readonly operators: readonly TBinaryOperator[];
      }
    | {
        readonly kind: "unary";
        readonly operator: "!" | "-" | "~" | "&";
        readonly operand: TExpression;
      }
    | {
        readonly kind: "postfix";
        readonly primary: TExpression;
        /** One or more */
        readonly ops: readonly TPostfixOpSyntax[];
      }
    | { readonly kind: "identifier"; readonly name: string }
    /** `this` or `global` with nothing after it, or as a chain's primary */
    | { readonly kind: "root"; readonly root: "this" | "global" }
    | {
        readonly kind: "literal";
        readonly literalKind: TLiteralKind;
        /** The token as written */
        readonly text: string;
      }
    | { readonly kind: "parenthesized"; readonly expression: TExpression }
    | {
        readonly kind: "cast";
        readonly type: TTypeSyntax;
        readonly operand: TExpression;
      }
    | {
        readonly kind: "sizeof";
        /** Exactly one of `type` and `expression` is set */
        readonly type: TTypeSyntax | null;
        readonly expression: TExpression | null;
      }
    | {
        readonly kind: "structInitializer";
        readonly fields: readonly IFieldInitializerSyntax[];
      }
    | {
        readonly kind: "arrayInitializer";
        /** `[a, b, c]`; empty for the fill form */
        readonly elements: readonly TExpression[];
        /** `[v*]`'s `v`; null for a listed initializer */
        readonly fill: TExpression | null;
      }
    /**
     * Where the parser recovered from an error and nothing was written. Only
     * a tree with parse errors has one, which the pipeline stops at; the
     * editor's symbol collection (`parseWithSymbols`) still lowers it.
     */
    | { readonly kind: "missing" }
  );

export default TExpression;
