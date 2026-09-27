/**
 * ADR-030: an opaque handle -- `struct Dev` is declared and never defined
 * here, so `Dev` is an incomplete type that C can only hold through a pointer.
 *
 * `<stddef.h>` is included because an opaque scope variable is emitted with a
 * `NULL` initializer, and generated C does not include it itself (#1610).
 */
#ifndef OPAQUE_POSITIONS_DEV_H
#define OPAQUE_POSITIONS_DEV_H

#include <stddef.h>
#include <stdint.h>

typedef struct Dev Dev;

Dev* dev_create(void);
void dev_poke(Dev* d);
int32_t dev_pokes(Dev* d);

/* A C callback registry over an ARRAY of handles, for `callback-compatible-array`. */
typedef void (*dev_pair_cb_t)(Dev* pair[2]);
void dev_pair_register(dev_pair_cb_t cb);
void dev_pair_invoke(Dev* pair[2]);

#endif /* OPAQUE_POSITIONS_DEV_H */
