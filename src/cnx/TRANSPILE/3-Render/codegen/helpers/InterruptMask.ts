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
import PRIMASK_C_TYPE from "../../../2-Plan/types/PRIMASK_C_TYPE";
import IRQ_WRAPPER_GUARDS from "../../../../utils/constants/IRQ_WRAPPER_GUARDS";

class InterruptMask {
  /**
   * The wrappers' last arm: a compiler they have no arm for stops here. It is
   * reached by C compiled for a compiler other than the target's, or by an
   * inline description that says `interrupt_mask: true` for a part the
   * wrappers do not cover (#1147: this arm assumed CMSIS, which no such
   * platform has).
   */
  static readonly NO_ARM_ERROR =
    '#error "cnx: the IRQ wrappers have no arm for this compiler, so a critical section has no lowering (ADR-050)"';

  /**
   * The `__cnx_` IRQ wrappers (ADR-050, Issue #778), one arm per compiler
   * family `IRQ_WRAPPER_GUARDS` names: ARM through inline assembly on
   * PRIMASK (or Arduino's noInterrupts()), AVR through SREG, and
   * `NO_ARM_ERROR` for any other. A target whose description has
   * `interrupt_mask: false` has no critical section (E0916) and lowers its
   * atomics without them (#1789).
   *
   * This avoids dependencies on CMSIS headers which may not be available on
   * all platforms (e.g., Teensy 4.x via Arduino.h doesn't expose
   * __get_PRIMASK/__set_PRIMASK).
   *
   * Spells `uint32_t` / `uint8_t` without recording them (#1927): these are
   * emitted only when `wrap` asks for them, and that effect records
   * `uint32_t`, so `<stdint.h>` is already decided.
   */
  static wrappers(): string[] {
    return [
      "// ADR-050: Platform-portable IRQ wrappers for critical sections",
      `#if ${IRQ_WRAPPER_GUARDS.arm}`,
      "// ARM platforms (including ARM Arduino like Teensy 4.x, Due, Zero)",
      "// Provide inline assembly PRIMASK access to avoid CMSIS header dependencies",
      "__attribute__((always_inline)) static inline uint32_t __cnx_get_PRIMASK(void) {",
      "    uint32_t result;",
      '    __asm volatile ("MRS %0, primask" : "=r" (result));',
      "    return result;",
      "}",
      "__attribute__((always_inline)) static inline void __cnx_set_PRIMASK(uint32_t mask) {",
      '    __asm volatile ("MSR primask, %0" :: "r" (mask) : "memory");',
      "}",
      `#if ${IRQ_WRAPPER_GUARDS.arduino}`,
      "static inline void __cnx_disable_irq(void) { noInterrupts(); }",
      "#else",
      "__attribute__((always_inline)) static inline void __cnx_disable_irq(void) {",
      '    __asm volatile ("cpsid i" ::: "memory");',
      "}",
      "#endif",
      `#elif ${IRQ_WRAPPER_GUARDS.avr}`,
      "// AVR Arduino: use SREG for interrupt state",
      "// SREG is declared by avr-libc's <avr/io.h>, cli() by its <avr/interrupt.h>",
      "#include <avr/io.h>",
      "#include <avr/interrupt.h>",
      "// Note: Uses PRIMASK naming for API consistency across platforms (AVR has no PRIMASK)",
      "// Returns uint8_t which is implicitly widened to uint32_t at call sites - this is intentional",
      "static inline uint8_t __cnx_get_PRIMASK(void) { return SREG; }",
      "static inline void __cnx_set_PRIMASK(uint8_t mask) { SREG = mask; }",
      "static inline void __cnx_disable_irq(void) { cli(); }",
      "#else",
      InterruptMask.NO_ARM_ERROR,
      "#endif",
      "",
    ];
  }

  /**
   * `inner` bracketed by saving the mask, disabling interrupts, and
   * restoring the mask. 2.2 required the wrappers for every region (#1991).
   *
   * @param inner - The statements run masked, without braces
   */
  static wrap(inner: string): IGeneratorOutput {
    return {
      code: `{
    ${PRIMASK_C_TYPE} __primask = __cnx_get_PRIMASK();
    __cnx_disable_irq();
    ${inner}
    __cnx_set_PRIMASK(__primask);
}`,
      effects: [],
    };
  }
}

export default InterruptMask;
