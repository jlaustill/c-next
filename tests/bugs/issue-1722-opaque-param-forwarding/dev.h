/**
 * Issue #1722: an opaque handle -- `struct Dev` is declared and never defined
 * here, so `Dev` is an incomplete type that C can only hold through a pointer.
 *
 * `<stddef.h>` is included because an opaque scope variable is emitted with a
 * `NULL` initializer, and generated C does not include it itself (#1610).
 */
#ifndef ISSUE_1722_DEV_H
#define ISSUE_1722_DEV_H

#include <stddef.h>
#include <stdint.h>

typedef struct Dev Dev;

Dev* dev_create(void);
void dev_poke(Dev* d);
int32_t dev_pokes(Dev* d);

#endif /* ISSUE_1722_DEV_H */
