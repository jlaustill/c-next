/**
 * ADR-017 enum type safety.
 *
 * Error codes:
 * - E0428: a value that is not of the target enum type is assigned to it.
 *   The #1321 throw audit reserved this code for "cannot assign integer to
 *   enum" so it would not be handed out twice; #1322 claims it, widened to the
 *   whole assignment half of the rule, because the three messages the codegen
 *   check produced were one decision with three fallbacks.
 * - E0434: the two operands of a comparison are not the same enum type.
 */
import IBaseAnalysisError from "../../../transpiler/types/IBaseAnalysisError";

interface IEnumTypeSafetyError extends IBaseAnalysisError {}

export default IEnumTypeSafetyError;
