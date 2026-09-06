import type TIncludeHeader from "../types/TIncludeHeader";

/**
 * How each system header is spelled when emitted.
 *
 * One table, because two files ask for the same header and a spelling that is
 * written twice can be written differently twice. The implementation file
 * decides from `IEmissionPlan`, and the companion header decides from the
 * declarations it emits -- different questions over different inputs, but the
 * same answer vocabulary, and this is the vocabulary.
 *
 * The three `TIncludeHeader` members that are deferred CODE emission rather
 * than an include -- `isr`, `float_static_assert`, `irq_wrappers` -- have no
 * entry, which is what makes the distinction checkable instead of remembered.
 *
 * #1517 tracks the rest: the two predicates merge when 2.2 Plan owns the
 * header's declarations, which is #1450's work. Until then this is the part of
 * the decision that CAN be single, so it is.
 */
const SYSTEM_INCLUDE_TARGETS: Readonly<
  Partial<Record<TIncludeHeader, string>>
> = {
  stdint: "<stdint.h>",
  stdbool: "<stdbool.h>",
  string: "<string.h>",
  cmsis: "<cmsis_gcc.h>",
  limits: "<limits.h>",
};

export default SYSTEM_INCLUDE_TARGETS;
