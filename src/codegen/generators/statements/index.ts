/**
 * Statement Generators (ADR-053 A3)
 *
 * Modular statement generation extracted from CodeGenerator.ts.
 * Uses the "strangler fig" pattern for incremental migration.
 *
 * Files in this directory:
 * - ControlFlowGenerator.ts - return, if, while, do-while, for
 * - SwitchGenerator.ts - switch, case, default
 * - AssignmentGenerator.ts - assignments
 * - CriticalGenerator.ts - critical sections (ADR-050)
 * - AtomicGenerator.ts - atomic RMW operations (ADR-049)
 * - StatementGenerator.ts - block and statement dispatch
 */

import controlFlowGenerators from "./ControlFlowGenerator";
import generateCriticalStatement from "./CriticalGenerator";
import atomicGenerators from "./AtomicGenerator";
import switchGenerators from "./SwitchGenerator";

// Export all generators as a single object
const generators = {
  ...controlFlowGenerators,
  generateCriticalStatement,
  ...atomicGenerators,
  ...switchGenerators,
};

export default generators;
