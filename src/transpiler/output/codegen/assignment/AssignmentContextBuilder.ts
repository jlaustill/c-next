/**
 * Builder for IAssignmentContext (ADR-109).
 *
 * Extracts all context from an assignment statement parse tree
 * needed for classification and code generation.
 */
import * as Parser from "../../../logic/parser/grammar/CNextParser";
import IAssignmentContext from "./IAssignmentContext";
import TTypeInfo from "../types/TTypeInfo";

/** Operator mapping from C-Next to C */
const ASSIGNMENT_OPERATOR_MAP: Record<string, string> = {
  "<-": "=",
  "+<-": "+=",
  "-<-": "-=",
  "*<-": "*=",
  "/<-": "/=",
  "%<-": "%=",
  "&<-": "&=",
  "|<-": "|=",
  "^<-": "^=",
  "<<<-": "<<=",
  ">><-": ">>=",
};

/**
 * Dependencies for building context.
 */
interface IContextBuilderDeps {
  /** Type registry: variable name -> type info */
  readonly typeRegistry: ReadonlyMap<string, TTypeInfo>;

  /** Generate C expression for a value */
  generateExpression(ctx: Parser.ExpressionContext): string;
}

/**
 * Result from extracting identifiers and subscripts from assignment target.
 */
interface ITargetExtraction {
  identifiers: string[];
  subscripts: Parser.ExpressionContext[];
  hasMemberAccess: boolean;
  hasArrayAccess: boolean;
  /** Number of expressions in the last subscript operation */
  lastSubscriptExprCount: number;
}

/**
 * Extract base identifier from assignment target.
 * With unified grammar, all patterns use IDENTIFIER postfixTargetOp*.
 */
function extractBaseIdentifier(
  targetCtx: Parser.AssignmentTargetContext,
): ITargetExtraction {
  const identifiers: string[] = [];
  const subscripts: Parser.ExpressionContext[] = [];

  // All patterns now have a base IDENTIFIER
  if (targetCtx.IDENTIFIER()) {
    identifiers.push(targetCtx.IDENTIFIER()!.getText());
  }

  return {
    identifiers,
    subscripts,
    hasMemberAccess: false,
    hasArrayAccess: false,
    lastSubscriptExprCount: 0,
  };
}

/**
 * Process postfix operations and update extraction result.
 * SonarCloud S3776: Extracted from buildAssignmentContext().
 */
function processPostfixOps(
  postfixOps: Parser.PostfixTargetOpContext[],
  extraction: ITargetExtraction,
): void {
  for (const op of postfixOps) {
    if (op.IDENTIFIER()) {
      extraction.identifiers.push(op.IDENTIFIER()!.getText());
      extraction.hasMemberAccess = true;
    } else {
      const exprs = op.expression();
      for (const expr of exprs) {
        extraction.subscripts.push(expr);
      }
      extraction.hasArrayAccess = true;
      // Track the expression count of the last subscript operation
      extraction.lastSubscriptExprCount = exprs.length;
    }
  }
}

/**
 * Build an IAssignmentContext from a parse tree.
 * SonarCloud S3776: Refactored to use helper functions.
 */
function buildAssignmentContext(
  ctx: Parser.AssignmentStatementContext,
  deps: IContextBuilderDeps,
): IAssignmentContext {
  const targetCtx = ctx.assignmentTarget();
  const valueCtx = ctx.expression();

  // Extract operator info
  const operatorCtx = ctx.assignmentOperator();
  const cnextOp = operatorCtx.getText();
  const cOp = ASSIGNMENT_OPERATOR_MAP[cnextOp] || "=";
  const isCompound = cOp !== "=";

  // Generate value expression
  const generatedValue = deps.generateExpression(valueCtx);

  // Extract target info
  const hasGlobal = targetCtx.GLOBAL() !== null;
  const hasThis = targetCtx.THIS() !== null;
  const postfixOps = targetCtx.postfixTargetOp();

  // Extract base identifier and process postfix operations
  const extraction = extractBaseIdentifier(targetCtx);
  processPostfixOps(postfixOps, extraction);

  const {
    identifiers,
    subscripts,
    hasMemberAccess,
    hasArrayAccess,
    lastSubscriptExprCount,
  } = extraction;

  // Get first identifier type info
  const firstId = identifiers[0] ?? "";
  const firstIdTypeInfo = deps.typeRegistry.get(firstId) ?? null;

  // Compute derived properties
  const memberAccessDepth = identifiers.length - 1;
  const subscriptDepth = subscripts.length;

  const isSimpleIdentifier =
    !hasGlobal &&
    !hasThis &&
    !hasMemberAccess &&
    !hasArrayAccess &&
    identifiers.length === 1;

  const isSimpleThisAccess = hasThis && postfixOps.length === 0;

  const isSimpleGlobalAccess = hasGlobal && postfixOps.length === 0;

  return {
    statementCtx: ctx,
    targetCtx,
    valueCtx,
    identifiers,
    subscripts,
    postfixOps,
    hasThis,
    hasGlobal,
    hasMemberAccess,
    hasArrayAccess,
    postfixOpsCount: postfixOps.length,
    cnextOp,
    cOp,
    isCompound,
    generatedValue,
    firstIdTypeInfo,
    memberAccessDepth,
    subscriptDepth,
    lastSubscriptExprCount,
    isSimpleIdentifier,
    isSimpleThisAccess,
    isSimpleGlobalAccess,
  };
}

export default buildAssignmentContext;
