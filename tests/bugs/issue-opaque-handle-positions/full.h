/**
 * Control: a COMPLETE struct behind a typedef. C can hold its value, so a
 * `Full` keeps ADR-006 reference semantics -- the opposite of an opaque
 * handle, whose value is the pointer.
 */
#ifndef OPAQUE_POSITIONS_FULL_H
#define OPAQUE_POSITIONS_FULL_H

#include <stdint.h>

typedef struct Full {
    uint32_t pokes;
} Full;

void full_bump(Full* f);

#endif /* OPAQUE_POSITIONS_FULL_H */
