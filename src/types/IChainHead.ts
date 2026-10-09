import type ISourceSpan from "./ISourceSpan";
import type TChainRoot from "./TChainRoot";
import type TExpression from "./syntax/TExpression";
import type TPostfixOpSyntax from "./syntax/TPostfixOpSyntax";

/**
 * Where a lowered chain starts: its root, the name it starts from, and how
 * many of its ops that took. `ExpressionShape.headOf` is the one producer.
 */
interface IChainHead {
  readonly primary: TExpression;
  readonly root: TChainRoot;
  /** Null when the head names nothing: a literal, `(x)`, or `this[0]` */
  readonly identifier: {
    readonly name: string;
    readonly span: ISourceSpan;
  } | null;
  /** Every op, including the `.name` a root consumes */
  readonly ops: readonly TPostfixOpSyntax[];
  /** 1 for a `this.`/`global.` root, whose first op is its name; else 0 */
  readonly opsConsumed: number;
}

export default IChainHead;
