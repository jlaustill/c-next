/**
 * ADR-050: the `#if` guards of the IRQ wrappers' arms. The wrappers
 * (`InterruptMask.wrappers`) and the toolchain requirements' conditions both
 * read this one spelling (#1789 review: it was written three times).
 */
const IRQ_WRAPPER_GUARDS = {
  /** ARM, bare metal or Arduino: PRIMASK through inline assembly */
  arm: "defined(__arm__) || defined(__ARM_ARCH)",
  /** Inside the ARM arm: Arduino's noInterrupts() */
  arduino: "defined(ARDUINO)",
  /** AVR: avr-libc's SREG and cli() */
  avr: "defined(__AVR__)",
} as const;

export default IRQ_WRAPPER_GUARDS;
