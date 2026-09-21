import type TOverflowBehavior from "./TOverflowBehavior";

/**
 * The assignment in flight, as ADR-044's overflow lowering needs it.
 *
 * `CodeGenState` holds one of these while an assignment's right-hand side is
 * generated, so an arithmetic expression can ask what it is being assigned TO
 * and clamp, wrap or saturate accordingly.
 *
 * #1445: this shape was declared TWICE, in `CodeGenState` and in
 * `AssignmentExpectedTypeResolver`, under the same name and with the same doc
 * comment -- and the resolver's value is assigned straight into
 * `CodeGenState`'s slot, so the two had to agree and nothing said so. They
 * already disagreed about whether a target name can be absent: the resolver
 * declared all three fields non-null while the slot they flow into resets to
 * nulls. TypeScript accepted the assignment because narrower flows into wider,
 * which is exactly why nobody noticed.
 *
 * The nullable spelling is the true one. `reset()` really does clear this to
 * all-nulls between files, and "there is no assignment in flight" is a state
 * every reader already handles. A resolver that has nothing to say returns
 * `null` for the whole object rather than a populated one with empty fields,
 * so nothing is lost by admitting the fields can be null.
 *
 * ## Not to be confused with `IAssignmentContext`
 *
 * That one is ADR-065's classification input -- it carries the parse nodes and
 * the extracted identifier chain, and it is what decides WHICH handler renders
 * an assignment. This one is three facts about the target, consulted while the
 * value is generated. Two different things under one name was the other half
 * of the confusion; naming this for the rule it serves ends it.
 */
interface IAssignmentOverflowContext {
  /** The target's name, or null when no assignment is in flight. */
  targetName: string | null;
  /** The target's declared type, or null. */
  targetType: string | null;
  /** ADR-044: what an overflow on this assignment does. */
  overflowBehavior: TOverflowBehavior;
}

export default IAssignmentOverflowContext;
