/**
 * Expression Generator Entry Point
 *
 * Generates ternary expressions with ADR-022 safety constraints, and passes a
 * non-ternary expression through.
 *
 * #1445 box 3: takes `TPlannedTernary`, not the node. The node was read for
 * exactly one thing -- the number of `orExpression` children -- and each child
 * was handed straight back to the orchestrator. The pass-through
 * `generateExpression` that wrapped this is gone with it: it called
 * `node.ternaryExpression()` and delegated, which is the walker's step, not a
 * generator's.
 */
import IGeneratorOutput from "../IGeneratorOutput";
import TGeneratorEffect from "../TGeneratorEffect";
import IGeneratorInput from "../IGeneratorInput";
import IGeneratorState from "../IGeneratorState";
import IOrchestrator from "../IOrchestrator";
import TGeneratorFn from "../TGeneratorFn";
import type TPlannedTernary from "../../types/TPlannedTernary";

/**
 * Generate C code for a ternary expression (ADR-022).
 *
 * Safety constraints are enforced in pass 2.1, not here: #1322 moved every
 * ADR-022 rule there -- nested ternary (E0710), the controlling-expression
 * rule (E0701) and no function call in a condition (E0702).
 */
const generateTernaryExpr: TGeneratorFn<TPlannedTernary> = (
  planned: TPlannedTernary,
  _input: IGeneratorInput,
  _state: IGeneratorState,
  orchestrator: IOrchestrator,
): IGeneratorOutput => {
  const effects: TGeneratorEffect[] = [];

  if (planned.kind === "value") {
    return { code: planned.code, effects };
  }

  // Parentheses are already present from the grammar.
  //
  // Issue #992: clear inDeclarationInit in the ARMS only -- a struct
  // initializer inside one needs a compound literal, not a plain designated
  // initializer. The condition keeps the flag as it stands.
  const condition = planned.renderCondition();
  const trueCode = orchestrator.state.withoutDeclarationInit(
    planned.renderTrue,
  );
  const falseCode = orchestrator.state.withoutDeclarationInit(
    planned.renderFalse,
  );

  return { code: `(${condition}) ? ${trueCode} : ${falseCode}`, effects };
};

export default generateTernaryExpr;
