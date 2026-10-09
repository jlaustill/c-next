import ExpressionShape from "./ExpressionShape";
import invariant from "./invariant";
import type ISourcePosition from "./types/ISourcePosition";
import type TExpression from "../types/syntax/TExpression";
import type TPostfixOpSyntax from "../types/syntax/TPostfixOpSyntax";

/**
 * An assignment target in the grammar's terms (#1932): `assignmentTarget` is
 * `(this | global) '.' IDENTIFIER ops` or `IDENTIFIER ops`, and its lowered
 * form folds the root's first member into the ops. This splits it back out,
 * reading the chain head from `ExpressionShape.headOf` -- the one decision.
 */
interface IAssignmentTargetParts {
  readonly root: "this" | "global" | null;
  /** The written name: the head, or the root's first member */
  readonly identifier: string | null;
  /** The `postfixTargetOp`s after `identifier` */
  readonly ops: readonly TPostfixOpSyntax[];
  readonly position: ISourcePosition;
}

class AssignmentTarget {
  static parts(target: TExpression): IAssignmentTargetParts {
    const position = { line: target.span.line, column: target.span.column };
    invariant(
      target.kind === "identifier" ||
        target.kind === "missing" ||
        target.kind === "postfix",
      `an assignment target lowers to an identifier or a postfix chain, not ${target.kind}`,
    );
    const head = ExpressionShape.headOf(target);
    if (target.kind === "postfix") {
      invariant(
        head.root === null || head.identifier !== null,
        `a rooted assignment target names a member first: '${target.written}'`,
      );
      invariant(
        head.root !== null || head.identifier !== null,
        `an assignment target without a root starts with a name: '${target.written}'`,
      );
    }
    return {
      root: head.root,
      identifier: head.identifier?.name ?? null,
      ops: head.ops.slice(head.opsConsumed),
      position,
    };
  }
}

export default AssignmentTarget;
