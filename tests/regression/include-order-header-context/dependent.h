/* Mirrors FreeRTOS task.h: refuses standalone inclusion (its #error fires when
 * guard.h has not run first, aborting preprocessing), and its declaration is
 * emitted by a predecessor-defined macro. Parsed raw (predecessor missing),
 * only the unexpanded token `DECLARE_DEP` is present, so `dependent_fn` is
 * never collected. It resolves only when preprocessed WITH guard.h in context. */
#ifndef DEP_GUARD
#error "include guard.h before dependent.h"
#endif

#if DEP_FEATURE
DECLARE_DEP
#endif
