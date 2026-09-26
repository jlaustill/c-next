/**
 * Context extracted from an assignment statement for classification (ADR-065).
 *
 * This interface captures all information needed to classify and generate
 * code for an assignment. Built once by the context extractor, then used
 * by the classifier and handlers.
 */
import type IBitAccessAnalysis from "../../../transpiler/types/IBitAccessAnalysis";
import type TPlannedTargetOp from "../../../transpiler/types/TPlannedTargetOp";
import TTypeInfo from "../../../transpiler/types/TTypeInfo";
import type TranspileState from "../../TranspileState";

/**
 * Context extracted from assignment statement for classification.
 */
interface IAssignmentContext {
  /**
   * 2.3 Render's per-file working state (#1452 box 4).
   *
   * Handlers are module-level functions that receive only this context, so it
   * is their channel to the state -- the same role the orchestrator plays for
   * the generators.
   */
  readonly state: TranspileState;

  // === The target, as renders rather than as a node ===

  /**
   * The fully-resolved target, rendered on demand.
   *
   * This renders the SAME text `resolvedTarget` already holds, and that
   * duplication is pre-existing: the builder renders the target once to derive
   * `resolvedTarget` and `resolvedBaseIdentifier`, and six handlers rendered it
   * again from the node. Preserved rather than collapsed here, because
   * `generateAssignmentTarget` renders chain subscripts and so is not obviously
   * free to call once instead of twice -- collapsing it changes emitted C if it
   * is not. Keeping both makes the duplication visible instead of hiding it
   * behind a node that looked like data.
   */
  readonly renderTarget: () => string;

  /** ADR-034 bit-access analysis of the target's member chain. */
  readonly analyzeTargetForBitAccess: () => IBitAccessAnalysis;

  /**
   * The target's source line -- where ADR-044's overflow decision is recorded.
   *
   * #1318: position comes from the span, not from holding the node that had
   * one. This is the only thing any consumer asked `targetCtx.start` for.
   */
  readonly targetLine: number | undefined;

  // === The value, as questions rather than as a node ===

  /** Whether the assignment has a right-hand side at all. */
  readonly hasValue: boolean;

  /**
   * The value's essential type, its integer type, and its constant fold.
   *
   * All three are pure -- they read the type registry and fold literals, and
   * none of them generates. They are thunks so an assignment form that does
   * not ask does not pay, which is what the node gave for free.
   */
  readonly valueExpressionType: () => string | null;
  readonly valueIntegerType: () => string | null;
  readonly foldValue: () => number | undefined;

  // === Extracted identifiers and expressions ===

  /** All identifiers in the target chain */
  readonly identifiers: readonly string[];

  /**
   * How many subscript EXPRESSIONS the target carries, across all of its
   * operations -- `a[i][j]` is 2, and so is `a[start, width]`.
   *
   * The classifier asks only this, at twelve sites, and asked it as
   * `subscripts.length`.
   */
  readonly subscriptCount: number;

  /**
   * One subscript expression, rendered or folded. Indexed as `subscripts` was.
   *
   * Two accessors because the handlers ask two different questions of the same
   * expression: ADR-046's slice needs its offset and length to FOLD at compile
   * time (E0859/E0860 reject a runtime one), while a bit index is RENDERED into
   * the shift. A single accessor returning generated code cannot answer the
   * first, and one returning a number cannot answer the second.
   */
  readonly renderSubscript: (index: number) => string;
  readonly foldSubscript: (index: number) => number | undefined;

  /** The postfix operations, reduced to what is asked of them. */
  readonly postfixOps: readonly TPlannedTargetOp[];

  // #1445 review: `leadingSubscriptCount` stood here, written by the builder
  // and read by NOTHING in production. Its doc said it existed so the two
  // paths would "share the decision rather than each counting for itself" --
  // while `AssignmentClassifier` counts for itself two lines from where it
  // would have read this, off `postfixOps.slice(memberOpCount)`. This one was
  // counted from offset 0, so the two disagree on every scope-qualified chain
  // (`global.Other.buf[3][1]`): a reader who trusted the comment and removed
  // the "duplicate" would have got a wrong depth, silently. Deleted rather
  // than fixed, because the classifier's count is the live one.

  // === Target classification flags ===

  /** Target starts with 'this' keyword */
  readonly hasThis: boolean;

  /** Target starts with 'global' keyword */
  readonly hasGlobal: boolean;

  /** Target has .member access */
  readonly hasMemberAccess: boolean;

  /** Target has [index] access */
  readonly hasArrayAccess: boolean;

  /** Number of postfix operations */
  readonly postfixOpsCount: number;

  // === Operator info ===

  /** C-Next operator (e.g., "<-", "+<-") */
  readonly cnextOp: string;

  /** Mapped C operator (e.g., "=", "+=") */
  readonly cOp: string;

  /** True if compound assignment (+<-, -<-, etc.) */
  readonly isCompound: boolean;

  // === Generated values ===

  /** Generated C expression for the value (right-hand side) */
  readonly generatedValue: string;

  /**
   * Fully-resolved assignment target with scope prefixes applied.
   * Use this instead of raw identifiers to ensure proper scope resolution.
   * Example: "data" inside scope ArrayBug -> "ArrayBug_data"
   */
  readonly resolvedTarget: string;

  /**
   * Resolved base identifier for type lookups.
   * Extracted from resolvedTarget by removing subscripts and member access.
   * Example: "ArrayBug_data[0]" -> "ArrayBug_data"
   * Use this for CodeGenState.typeRegistry lookups instead of identifiers[0].
   */
  readonly resolvedBaseIdentifier: string;

  // === Type info (looked up from registry) ===

  /** First identifier's type info, if found */
  readonly firstIdTypeInfo: TTypeInfo | null;

  // === Computed properties ===

  /** Number of .member accesses in the chain */
  readonly memberAccessDepth: number;

  /** Number of [index] accesses in the chain */
  readonly subscriptDepth: number;

  /** Number of expressions in the last subscript operation (1=element, 2=slice/bit-range) */
  readonly lastSubscriptExprCount: number;

  /** True if target is a simple identifier (no prefix, no postfix) */
  readonly isSimpleIdentifier: boolean;

  /** True if this is this.member with no further postfix ops */
  readonly isSimpleThisAccess: boolean;

  /** True if this is global.member with no further postfix ops */
  readonly isSimpleGlobalAccess: boolean;
}

export default IAssignmentContext;
