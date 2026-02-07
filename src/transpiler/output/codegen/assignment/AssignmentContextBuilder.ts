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
}

/**
 * Extract identifiers from legacy memberAccess or arrayAccess patterns.
 * SonarCloud S3776: Extracted from buildAssignmentContext().
 */
function extractFromLegacyAccess(
  targetCtx: Parser.AssignmentTargetContext,
): ITargetExtraction {
  const identifiers: string[] = [];
  const subscripts: Parser.ExpressionContext[] = [];

  const legacyMemberAccess = targetCtx.memberAccess();
  const legacyArrayAccess = targetCtx.arrayAccess();

  if (targetCtx.IDENTIFIER()) {
    identifiers.push(targetCtx.IDENTIFIER()!.getText());
    return {
      identifiers,
      subscripts,
      hasMemberAccess: legacyMemberAccess !== null,
      hasArrayAccess: legacyArrayAccess !== null,
    };
  }

  if (legacyMemberAccess) {
    for (const id of legacyMemberAccess.IDENTIFIER()) {
      identifiers.push(id.getText());
    }
    for (const expr of legacyMemberAccess.expression()) {
      subscripts.push(expr);
    }
    return {
      identifiers,
      subscripts,
      hasMemberAccess: true,
      hasArrayAccess: subscripts.length > 0,
    };
  }

  if (legacyArrayAccess) {
    identifiers.push(legacyArrayAccess.IDENTIFIER().getText());
    for (const expr of legacyArrayAccess.expression()) {
      subscripts.push(expr);
    }
    return {
      identifiers,
      subscripts,
      hasMemberAccess: false,
      hasArrayAccess: true,
    };
  }

  return {
    identifiers,
    subscripts,
    hasMemberAccess: false,
    hasArrayAccess: false,
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
      for (const expr of op.expression()) {
        extraction.subscripts.push(expr);
      }
      extraction.hasArrayAccess = true;
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

  // Check for legacy memberAccess and arrayAccess
  const legacyMemberAccess = targetCtx.memberAccess();
  const legacyArrayAccess = targetCtx.arrayAccess();

  // Extract identifiers and subscripts using helper functions
  const extraction = extractFromLegacyAccess(targetCtx);
  processPostfixOps(postfixOps, extraction);

  const { identifiers, subscripts, hasMemberAccess, hasArrayAccess } =
    extraction;

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
