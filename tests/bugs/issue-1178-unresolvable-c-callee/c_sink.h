/*
 * Helper for issue #1178: a C function that takes a non-const pointer to a
 * C-Next struct. It is declared in C, so it never appears in the C-Next
 * functionParamLists the modification propagator consults -- which is exactly
 * the "unresolvable callee" state the issue is about.
 */
#ifndef C_SINK_H
#define C_SINK_H

#include <stdint.h>
#include "unresolvable-c-callee.test.h"

void c_bump(Sample* s);
uint8_t c_read(const Sample* s);

#endif /* C_SINK_H */
