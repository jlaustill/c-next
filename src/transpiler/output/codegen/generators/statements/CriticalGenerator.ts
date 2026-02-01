/**
 * Critical Statement Generator (ADR-053 A3)
 *
 * Generates C code for critical sections (ADR-050):
 * - Wraps block with PRIMASK save/restore for interrupt safety
 * - Ensures atomic execution of multi-variable operations
 */
import { CriticalStatementContext } from "../../../../logic/parser/grammar/CNextParser";
import IGeneratorOutput from "../IGeneratorOutput";
import TGeneratorEffect from "../TGeneratorEffect";
import IGeneratorInput from "../IGeneratorInput";
import IGeneratorState from "../IGeneratorState";
import IOrchestrator from "../IOrchestrator";

/**
 * Generate C code for a critical statement (ADR-050).
 *
 * Generates a PRIMASK-based interrupt disable wrapper using __cnx_ prefixed
 * wrappers to avoid macro collisions with platform headers (e.g., Teensy's imxrt.h):
 * ```c
 * {
 *     uint32_t __primask = __cnx_get_PRIMASK();
 *     __cnx_disable_irq();
 *     // ... block contents ...
 *     __cnx_set_PRIMASK(__primask);
 * }
 * ```
 *
 * @param node - The CriticalStatementContext AST node
 * @param _input - Read-only context (unused)
 * @param _state - Current generation state (unused)
 * @param orchestrator - For delegating to generateBlock and validation
 * @returns Generated code and effects (irq_wrappers)
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

  // Mark that we need IRQ wrapper functions (not cmsis_gcc.h include)
  // This avoids macro collisions with platform headers like Teensy's imxrt.h
  effects.push({ type: "include", header: "irq_wrappers" });

  // Generate the block contents
  const blockCode = orchestrator.generateBlock(node.block());

  // Remove outer braces from block since we're wrapping
  const innerCode = blockCode.slice(1, -1).trim();

  // Generate PRIMASK save/restore wrapper using __cnx_ prefixed functions
  const code = `{
    uint32_t __primask = __cnx_get_PRIMASK();
    __cnx_disable_irq();
    ${innerCode}
    __cnx_set_PRIMASK(__primask);
}`;

  return { code, effects };
};

export default generateCriticalStatement;
