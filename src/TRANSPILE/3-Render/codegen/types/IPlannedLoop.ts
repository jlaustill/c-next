/**
 * A loop with a controlling expression: `while` and `do ... while`.
 *
 * ONE shape for both, because they have the same two parts. What differs is
 * the ORDER the generator calls them in -- `while` renders the condition
 * first, `do-while` renders the body first, because that is the order the
 * source reads and the order the temps have to come out in. That order is a
 * property of the statement, not of its parts, so it lives in the two
 * generators and not in two near-identical records.
 *
 * Both are thunks. Issue #250 flushes the temps a condition queues out in
 * front of the loop, and a flush placed after the body has already rendered
 * cannot tell the two clauses' temps apart -- in a `while`, the body's would
 * be hoisted out with the condition's, which is wrong for anything the body
 * re-evaluates per iteration.
 */
interface IPlannedLoop {
  readonly renderCondition: () => string;
  readonly renderBody: () => string;
}

export default IPlannedLoop;
