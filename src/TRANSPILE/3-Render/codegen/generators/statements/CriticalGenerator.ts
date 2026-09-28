/**
 * Critical Statement Generator
 *
 * Generates C code for critical sections (ADR-050):
 * - Wraps block with PRIMASK save/restore for interrupt safety
 * - Ensures atomic execution of multi-variable operations
 */
import IGeneratorOutput from "../IGeneratorOutput";
import InterruptMask from "../../helpers/InterruptMask";
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
 * #1445 box 3: takes the two things it read off the node -- the block's
 * already-rendered code, and the line the `critical` keyword sits on -- rather
 * than the node itself. The delegation inverts: the caller renders the block,
 * this wraps it.
 *
 * `blockCode` MUST be a brace-delimited block, because the wrapper strips the
 * outer braces before re-wrapping. That is an invariant the type cannot state,
 * so it is stated here.
 *
 * Effect ordering is unchanged. The `irq_wrappers` effect is pushed onto this
 * function's local array and only APPLIED by the caller on return, so whether
 * the block renders before or during this call, the block's own effects still
 * land first.
 *
 * @param critical - The rendered block and the source line of the construct
 * @param _input - Read-only context (unused)
 * @param _state - Current generation state (unused)
 * @param _orchestrator - Unused; the block arrives rendered
 * @returns Generated code and effects (irq_wrappers)
 */
interface ICriticalStatement {
  /** The block's generated C, braces included. */
  readonly blockCode: string;
  /** Source line of the `critical` construct, for the #1143 deferred emitter. */
  readonly line: number | undefined;
}

const generateCriticalStatement = (
  critical: ICriticalStatement,
  _input: IGeneratorInput,
  _state: IGeneratorState,
  _orchestrator: IOrchestrator,
): IGeneratorOutput => {
  // #1322: the early-exit check that stood here is E0853 in pass 2.1, which
  // reaches every statement the grammar can nest inside the block -- including
  // `switch`, which the recursion it replaces did not descend into.

  // The IRQ wrappers, not cmsis_gcc.h: this avoids macro collisions with
  // platform headers like Teensy's imxrt.h. Issue #1143: the line is carried
  // so the deferred emitter can tell the user *which* critical block made
  // their project depend on CMSIS or avr-libc. The masked region is the one
  // an atomic read-modify-write takes too (#1146).
  const innerCode = critical.blockCode.slice(1, -1).trim();
  return InterruptMask.wrap(innerCode, critical.line);
};

export default generateCriticalStatement;
