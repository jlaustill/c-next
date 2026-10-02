/* Dependent header (mirrors FreeRTOS task.h): refuses standalone inclusion and
 * emits its declaration via a predecessor-defined macro. Only resolves when
 * predecessor.h is included first in the same translation unit. */
#ifndef PRED_GUARD
#error "include predecessor.h before dependent.h"
#endif
DECLARE_ORACLE_FN
