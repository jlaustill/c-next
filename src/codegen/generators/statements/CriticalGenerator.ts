/**
 * Critical Statement Generator (ADR-053 A3)
 *
 * Generates C code for critical sections (ADR-050):
 * - Wraps block with PRIMASK save/restore for interrupt safety
 * - Ensures atomic execution of multi-variable operations
 */
import { CriticalStatementContext } from "../../../parser/grammar/CNextParser";
import IGeneratorOutput from "../IGeneratorOutput";
import TGeneratorEffect from "../TGeneratorEffect";
import IGeneratorInput from "../IGeneratorInput";
import IGeneratorState from "../IGeneratorState";
import IOrchestrator from "../IOrchestrator";

/**
 * Generate C code for a critical statement (ADR-050).
 *
 * Generates a PRIMASK-based interrupt disable wrapper:
 * ```c
 * {
 *     uint32_t __primask = __get_PRIMASK();
 *     __disable_irq();
 *     // ... block contents ...
 *     __set_PRIMASK(__primask);
 * }
 * ```
 *
 * @param node - The CriticalStatementContext AST node
 * @param _input - Read-only context (unused)
 * @param _state - Current generation state (unused)
 * @param orchestrator - For delegating to generateBlock and validation
 * @returns Generated code and effects (cmsis include)
 */
const generateCriticalStatement = (
  node: CriticalStatementContext,
  _input: IGeneratorInput,
  _state: IGeneratorState,
  orchestrator: IOrchestrator,
): IGeneratorOutput => {
  const effects: TGeneratorEffect[] = [];

  // Validate no early exits inside critical block
  orchestrator.validateNoEarlyExits(node.block());

  // Mark that we need CMSIS headers
  effects.push({ type: "include", header: "cmsis" });

  // Generate the block contents
  const blockCode = orchestrator.generateBlock(node.block());

  // Remove outer braces from block since we're wrapping
  const innerCode = blockCode.slice(1, -1).trim();

  // Generate PRIMASK save/restore wrapper
  const code = `{
    uint32_t __primask = __get_PRIMASK();
    __disable_irq();
    ${innerCode}
    __set_PRIMASK(__primask);
}`;

  return { code, effects };
};

export default generateCriticalStatement;
