/**
 * Context extracted from an assignment statement for classification (ADR-109).
 *
 * This interface captures all information needed to classify and generate
 * code for an assignment. Built once by the context extractor, then used
 * by the classifier and handlers.
 */
import * as Parser from "../../antlr_parser/grammar/CNextParser";
import TTypeInfo from "../types/TTypeInfo";

/**
 * Context extracted from assignment statement for classification.
 */
interface IAssignmentContext {
  // === Parse tree nodes ===

  /** The full assignment statement context */
  readonly statementCtx: Parser.AssignmentStatementContext;

  /** The assignment target (left-hand side) */
  readonly targetCtx: Parser.AssignmentTargetContext;

  /** The value expression (right-hand side), null if missing */
  readonly valueCtx: Parser.ExpressionContext | null;

  // === Extracted identifiers and expressions ===

  /** All identifiers in the target chain */
  readonly identifiers: readonly string[];

  /** All subscript expressions from [...] access */
  readonly subscripts: readonly Parser.ExpressionContext[];

  /** The postfix operations for detailed analysis */
  readonly postfixOps: readonly Parser.PostfixTargetOpContext[];

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

  // === Type info (looked up from registry) ===

  /** First identifier's type info, if found */
  readonly firstIdTypeInfo: TTypeInfo | null;

  // === Computed properties ===

  /** Number of .member accesses in the chain */
  readonly memberAccessDepth: number;

  /** Number of [index] accesses in the chain */
  readonly subscriptDepth: number;

  /** True if target is a simple identifier (no prefix, no postfix) */
  readonly isSimpleIdentifier: boolean;

  /** True if this is this.member with no further postfix ops */
  readonly isSimpleThisAccess: boolean;

  /** True if this is global.member with no further postfix ops */
  readonly isSimpleGlobalAccess: boolean;
}

export default IAssignmentContext;
