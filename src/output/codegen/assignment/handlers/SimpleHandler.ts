/**
 * Handler for simple assignments (ADR-109).
 *
 * The fallback case: generates `target = value;` or `target op= value;`
 * Used when no special handling is needed.
 */
import IAssignmentContext from "../IAssignmentContext";
import IHandlerDeps from "./IHandlerDeps";

/**
 * Handle simple variable assignment.
 *
 * @example
 * x <- 5           =>  x = 5;
 * counter +<- 1    =>  counter += 1;
 */
function handleSimpleAssignment(
  ctx: IAssignmentContext,
  deps: IHandlerDeps,
): string {
  const target = deps.generateAssignmentTarget(ctx.targetCtx);
  return `${target} ${ctx.cOp} ${ctx.generatedValue};`;
}

export default handleSimpleAssignment;
