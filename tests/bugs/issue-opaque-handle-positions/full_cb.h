/**
 * A C callback registry over a COMPLETE struct: the typedef takes `Full*`, so
 * a C-Next function registered with it is callback-compatible (#895) and its
 * `Full` parameter becomes a `Full*` in C and in C++ alike.
 */
#ifndef OPAQUE_POSITIONS_FULL_CB_H
#define OPAQUE_POSITIONS_FULL_CB_H

#include "full.h"

typedef void (*full_cb_t)(Full* f);

void full_register(full_cb_t cb);
void full_invoke(Full* f);

#endif /* OPAQUE_POSITIONS_FULL_CB_H */
