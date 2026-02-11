/**
 * Handler for simple assignments (ADR-109).
 *
 * The fallback case: generates `target = value;` or `target op= value;`
 * Used when no special handling is needed.
 */
import IAssignmentContext from "../IAssignmentContext";
import CodeGenState from "../../../../state/CodeGenState";
import type ICodeGenApi from "../../types/ICodeGenApi";

/** Get typed generator reference */
function gen(): ICodeGenApi {
  return CodeGenState.generator as ICodeGenApi;
}

/**
 * Handle simple variable assignment.
 *
 * @example
 * x <- 5           =>  x = 5;
 * counter +<- 1    =>  counter += 1;
 */
function handleSimpleAssignment(ctx: IAssignmentContext): string {
  const target = gen().generateAssignmentTarget(ctx.targetCtx);
  return `${target} ${ctx.cOp} ${ctx.generatedValue};`;
}

export default handleSimpleAssignment;
