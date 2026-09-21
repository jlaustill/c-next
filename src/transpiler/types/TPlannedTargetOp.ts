/**
 * One step of an assignment target's postfix chain, reduced to what the
 * bit-access analysis asks of it.
 *
 * #1445: `postfixTargetOp` has exactly three alternatives -- `.IDENTIFIER`,
 * `[expression]` and `[expression, expression]` -- so "is this a member access"
 * and "how many indexes" are the only two questions the walk ever asked of a
 * node. As a union the second question answers itself, which is why the
 * producer's `op.expression().length > 0` filter is gone: it distinguished a
 * subscript from a member access, and `kind` does that now.
 *
 * ## The indexes are a thunk
 *
 * Most chains are not bit accesses, and the walk decides that from
 * `CodeGenState` alone -- the indexes are needed only for the target it builds
 * afterwards. Generating an expression queues a pending temp declaration in
 * some shapes, so generating every index up front would leak one for every
 * chain the walk rejects. The thunk keeps each call behind the decision, which
 * is the order the node-walking version had for free.
 */
type TPlannedTargetOp =
  | {
      readonly kind: "member";
      readonly name: string;
    }
  | {
      readonly kind: "subscript";
      /** 1 for `[i]`, 2 for `[start, width]`. The grammar admits no other. */
      readonly indexCount: number;
      readonly renderIndexes: () => readonly string[];
    };

export default TPlannedTargetOp;
