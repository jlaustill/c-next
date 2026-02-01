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
 * Build an IAssignmentContext from a parse tree.
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

  // Check for legacy memberAccess and arrayAccess
  const legacyMemberAccess = targetCtx.memberAccess();
  const legacyArrayAccess = targetCtx.arrayAccess();

  // Build identifiers list
  const identifiers: string[] = [];
  const subscripts: Parser.ExpressionContext[] = [];

  // First identifier (may be from IDENTIFIER or memberAccess/arrayAccess)
  // Track if we found array subscripts in legacyMemberAccess
  let memberAccessHasSubscripts = false;

  if (targetCtx.IDENTIFIER()) {
    identifiers.push(targetCtx.IDENTIFIER()!.getText());
  } else if (legacyMemberAccess) {
    // Legacy memberAccess: first identifier
    const memberIds = legacyMemberAccess.IDENTIFIER();
    for (const id of memberIds) {
      identifiers.push(id.getText());
    }
    // Extract subscripts from memberAccess
    const memberExprs = legacyMemberAccess.expression();
    for (const expr of memberExprs) {
      subscripts.push(expr);
    }
    // Mark that we have array access if there were subscripts
    memberAccessHasSubscripts = memberExprs.length > 0;
  } else if (legacyArrayAccess) {
    // Legacy arrayAccess
    identifiers.push(legacyArrayAccess.IDENTIFIER().getText());
    for (const expr of legacyArrayAccess.expression()) {
      subscripts.push(expr);
    }
  }

  // Process postfix operations (unified grammar)
  let hasMemberAccess = legacyMemberAccess !== null;
  let hasArrayAccess = legacyArrayAccess !== null || memberAccessHasSubscripts;

  for (const op of postfixOps) {
    if (op.IDENTIFIER()) {
      identifiers.push(op.IDENTIFIER()!.getText());
      hasMemberAccess = true;
    } else {
      // Array subscript or bit range
      for (const expr of op.expression()) {
        subscripts.push(expr);
      }
      hasArrayAccess = true;
    }
  }

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

  const isSimpleThisAccess =
    hasThis &&
    postfixOps.length === 0 &&
    !legacyMemberAccess &&
    !legacyArrayAccess;

  const isSimpleGlobalAccess =
    hasGlobal &&
    postfixOps.length === 0 &&
    !legacyMemberAccess &&
    !legacyArrayAccess;

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
    isSimpleIdentifier,
    isSimpleThisAccess,
    isSimpleGlobalAccess,
  };
}

export default buildAssignmentContext;
