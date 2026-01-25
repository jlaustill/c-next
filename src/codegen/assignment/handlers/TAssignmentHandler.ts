/**
 * Type for assignment handler functions (ADR-109).
 */
import IAssignmentContext from "../IAssignmentContext";
import IHandlerDeps from "./IHandlerDeps";

/**
 * Handler function that generates C code for an assignment kind.
 */
type TAssignmentHandler = (
  ctx: IAssignmentContext,
  deps: IHandlerDeps,
) => string;

export default TAssignmentHandler;
