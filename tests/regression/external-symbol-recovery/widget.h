/* Mirrors FreeRTOS task.h / driver/twai.h: refuses standalone inclusion (its
 * #error fires unless guard.h ran first), and its declarations are emitted by a
 * predecessor-defined macro AND carry a trailing attribute macro (PRIVILEGED).
 * Raw, only the unexpanded token DECLARE_WIDGET_API is present, so nothing is
 * collected; it resolves only when preprocessed WITH guard.h in context. */
#ifndef WIDGET_GUARD
#error "include guard.h before widget.h"
#endif

#if WIDGET_FEATURE
DECLARE_WIDGET_API
#endif
