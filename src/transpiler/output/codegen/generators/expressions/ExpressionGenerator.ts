/**
 * Expression Generator Entry Point (ADR-053 A2 Phase 7)
 *
 * Top-level entry point for expression code generation.
 * Handles:
 * - Expression entry point (delegates to ternary)
 * - Ternary expressions with ADR-022 safety constraints
 */
import {
  ExpressionContext,
  TernaryExpressionContext,
} from "../../../../logic/parser/grammar/CNextParser";
import IGeneratorOutput from "../IGeneratorOutput";
import TGeneratorEffect from "../TGeneratorEffect";
import IGeneratorInput from "../IGeneratorInput";
import IGeneratorState from "../IGeneratorState";
import IOrchestrator from "../IOrchestrator";

/**
 * Generate C code for an expression (entry point).
 *
 * Simply delegates to ternary expression handling.
 */
const generateExpression = (
  node: ExpressionContext,
  input: IGeneratorInput,
  state: IGeneratorState,
  orchestrator: IOrchestrator,
): IGeneratorOutput => {
  return generateTernaryExpr(
    node.ternaryExpression(),
    input,
    state,
    orchestrator,
  );
};

/**
 * Generate C code for a ternary expression (ADR-022).
 *
 * Handles:
 * - Non-ternary path: single orExpression
 * - Ternary path: condition ? trueExpr : falseExpr
 *
 * Safety constraints enforced via orchestrator:
 * - Condition must be a comparison expression
 * - No nested ternary expressions in branches
 */
const generateTernaryExpr = (
  node: TernaryExpressionContext,
  _input: IGeneratorInput,
  _state: IGeneratorState,
  orchestrator: IOrchestrator,
): IGeneratorOutput => {
  const effects: TGeneratorEffect[] = [];
  const orExprs = node.orExpression();

  // Non-ternary path: just one orExpression
  if (orExprs.length === 1) {
    return { code: orchestrator.generateOrExpr(orExprs[0]), effects };
  }

  // Ternary path: 3 orExpressions (condition, true branch, false branch)
  const condition = orExprs[0];
  const trueExpr = orExprs[1];
  const falseExpr = orExprs[2];

  // ADR-022: Validate ternary constraints
  orchestrator.validateTernaryCondition(condition);
  orchestrator.validateNoNestedTernary(trueExpr, "true branch");
  orchestrator.validateNoNestedTernary(falseExpr, "false branch");

  // Issue #254: Validate no function calls in ternary condition (E0702)
  orchestrator.validateTernaryConditionNoFunctionCall(condition);

  // Generate C output - parentheses already present from grammar
  const condCode = orchestrator.generateOrExpr(condition);
  const trueCode = orchestrator.generateOrExpr(trueExpr);
  const falseCode = orchestrator.generateOrExpr(falseExpr);

  return { code: `(${condCode}) ? ${trueCode} : ${falseCode}`, effects };
};

// Export all generators
const expressionGenerators = {
  generateExpression,
  generateTernaryExpr,
};

export default expressionGenerators;
