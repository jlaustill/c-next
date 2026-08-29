/*
 * Helper for issue #1334's cross-language conflict fixture.
 *
 * `helper` is a typedef'd struct: a C DEFINITION, so it collides with a C-Next
 * struct of the same name. It also registers two symbols at one position (the tag
 * and the alias), which is why the diagnostic deduplicates locations.
 *
 * `quiet` is a prototype: a pure DECLARATION, filtered out before conflict
 * detection. It is the negative control -- a C-Next function may implement a
 * C-declared function, and flagging that would be over-enforcement.
 */
#ifndef LEGACY_C_TYPES_H
#define LEGACY_C_TYPES_H

#include <stdint.h>

typedef struct {
    uint8_t v;
} helper;

uint8_t quiet(void);

#endif /* LEGACY_C_TYPES_H */
