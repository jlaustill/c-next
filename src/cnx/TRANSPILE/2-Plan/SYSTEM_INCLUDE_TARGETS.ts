import type TSystemHeader from "../../types/TSystemHeader";

/**
 * How each system header is spelled when emitted.
 *
 * One table, because two files ask for the same header and a spelling that is
 * written twice can be written differently twice. The implementation file and
 * the companion header both decide `<stdint.h>` / `<stdbool.h>` through
 * `CTypeIncludes` (#1927), and the rest through `EmissionPlan`.
 *
 * The three `TIncludeHeader` members that are deferred CODE emission rather
 * than an include -- `isr`, `float_static_assert`, `irq_wrappers` -- are not a
 * `TSystemHeader`, which is what makes the distinction checkable instead of
 * remembered.
 */
const SYSTEM_INCLUDE_TARGETS: Readonly<Record<TSystemHeader, string>> = {
  stdint: "<stdint.h>",
  stdbool: "<stdbool.h>",
  string: "<string.h>",
  cmsis: "<cmsis_gcc.h>",
  limits: "<limits.h>",
};

export default SYSTEM_INCLUDE_TARGETS;
