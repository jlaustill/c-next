/**
 * Type for assignment handler functions (ADR-109).
 *
 * Handlers access state via CodeGenState and CodeGenState.generator
 * instead of receiving deps as a parameter.
 */
import IAssignmentContext from "../IAssignmentContext";

/**
 * Handler function that generates C code for an assignment kind.
 * Accesses CodeGenState directly for symbol information and
 * CodeGenState.generator for CodeGenerator methods.
 */
type TAssignmentHandler = (ctx: IAssignmentContext) => string;

export default TAssignmentHandler;
