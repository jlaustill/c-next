/**
 * Issue #1722 control: a COMPLETE struct behind a typedef, so a `Full`
 * parameter is a pointer to a value C can copy. A whole-value use of one must
 * stay `(*f)` -- the opposite of an opaque handle, whose value is the pointer.
 */
#ifndef ISSUE_1722_FULL_H
#define ISSUE_1722_FULL_H

#include <stdint.h>

typedef struct Full {
    uint32_t pokes;
} Full;

#endif /* ISSUE_1722_FULL_H */
