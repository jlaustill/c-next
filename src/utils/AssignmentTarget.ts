import invariant from "./invariant";
import type ISourcePosition from "./types/ISourcePosition";
import type TExpression from "../types/syntax/TExpression";
import type TPostfixOpSyntax from "../types/syntax/TPostfixOpSyntax";

/**
 * An assignment target in the grammar's terms (#1932): `assignmentTarget` is
 * `(this | global) '.' IDENTIFIER ops` or `IDENTIFIER ops`, and its lowered
 * form folds the root's first member into the ops. This splits it back out.
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
    if (target.kind === "identifier") {
      return { root: null, identifier: target.name, ops: [], position };
    }
    if (target.kind === "missing") {
      return { root: null, identifier: null, ops: [], position };
    }
    invariant(
      target.kind === "postfix",
      `an assignment target lowers to an identifier or a postfix chain, not ${target.kind}`,
    );
    const { primary, ops } = target;
    if (primary.kind === "root") {
      const [first, ...rest] = ops;
      return {
        root: primary.root,
        identifier: first?.kind === "member" ? first.name : null,
        ops: rest,
        position,
      };
    }
    return {
      root: null,
      identifier: primary.kind === "identifier" ? primary.name : null,
      ops,
      position,
    };
  }
}

export default AssignmentTarget;
