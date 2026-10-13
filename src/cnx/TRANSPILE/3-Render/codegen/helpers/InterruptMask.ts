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
   * restoring the mask. 2.2 required the wrappers for every region (#1991).
   *
   * @param inner - The statements run masked, without braces
   */
  static wrap(inner: string): IGeneratorOutput {
    return {
      code: `{
    uint32_t __primask = __cnx_get_PRIMASK();
    __cnx_disable_irq();
    ${inner}
    __cnx_set_PRIMASK(__primask);
}`,
      effects: [],
    };
  }
}

export default InterruptMask;
