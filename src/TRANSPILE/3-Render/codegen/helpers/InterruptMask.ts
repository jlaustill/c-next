/**
 * ADR-050: a region run with interrupts masked, through the `__cnx_` IRQ
 * wrappers -- the one lowering a `critical` block and an atomic
 * read-modify-write on a target without LDREX/STREX share.
 *
 * #1146: the atomic path emitted raw CMSIS names (`__get_PRIMASK()`,
 * `__disable_irq()`) with no platform guard, beside `<cmsis_gcc.h>`, while a
 * `critical` block took the wrappers' ARM, AVR and fallback arms. So on AVR
 * the same masking was SREG in one and CMSIS, which avr-libc does not have,
 * in the other.
 */
import type IGeneratorOutput from "../generators/IGeneratorOutput";

class InterruptMask {
  /**
   * `inner` bracketed by saving the mask, disabling interrupts, and
   * restoring the mask; its effect asks for the wrappers.
   *
   * @param inner - The statements run masked, without braces
   * @param line - The construct's source line, for the deferred toolchain
   *   report (Issue #1143), when there is one
   */
  static wrap(inner: string, line: number | undefined): IGeneratorOutput {
    return {
      code: `{
    uint32_t __primask = __cnx_get_PRIMASK();
    __cnx_disable_irq();
    ${inner}
    __cnx_set_PRIMASK(__primask);
}`,
      effects: [{ type: "include", header: "irq_wrappers", line }],
    };
  }
}

export default InterruptMask;
