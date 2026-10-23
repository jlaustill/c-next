#ifndef ADR024_UNREADABLE_MACROS_H
#define ADR024_UNREADABLE_MACROS_H

#include <stdint.h>

/* Helper (not a test): a macro whose replacement is a call, so cnx cannot
   type it from its tokens (ADR-024). */
#define SCALED_CALL scale_of(2U)

static inline uint32_t scale_of(uint32_t x) { return x * 3U; }

#endif /* ADR024_UNREADABLE_MACROS_H */
