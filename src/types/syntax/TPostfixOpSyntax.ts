import type ISyntaxNode from "./ISyntaxNode";
import type TExpression from "./TExpression";

/** One operation of a postfix chain, as the grammar's `postfixOp` */
type TPostfixOpSyntax = ISyntaxNode &
  (
    | { readonly kind: "member"; readonly name: string }
    | {
        readonly kind: "subscript";
        /** `[i]` is one index; a bit range `[start, width]` is two */
        readonly indexes:
          | readonly [TExpression]
          | readonly [TExpression, TExpression];
      }
    | { readonly kind: "call"; readonly arguments: readonly TExpression[] }
    /** Where the parser recovered from an error; see `TExpression`'s */
    | { readonly kind: "missing" }
  );

export default TPostfixOpSyntax;
