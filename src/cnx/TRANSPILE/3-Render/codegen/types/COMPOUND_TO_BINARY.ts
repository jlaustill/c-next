import COMPOUND_BINARY_OPERATORS from "../../../../types/syntax/COMPOUND_BINARY_OPERATORS";
import ASSIGNMENT_OPERATOR_MAP from "../../../../utils/constants/OperatorMappings";

/**
 * Map compound assignment operator to its binary operator equivalent, keyed
 * by its C spelling (`/=` -> `/`), derived from the one C-Next table.
 *
 * Shared constant used by:
 * - SimpleHandler.ts: MISRA 10.3 compound assignment expansion
 * - AtomicGenerator.ts: Atomic compound operation expansion
 */
const COMPOUND_TO_BINARY: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(COMPOUND_BINARY_OPERATORS).map(([spelling, operator]) => [
    ASSIGNMENT_OPERATOR_MAP[spelling],
    operator,
  ]),
);

export default COMPOUND_TO_BINARY;
