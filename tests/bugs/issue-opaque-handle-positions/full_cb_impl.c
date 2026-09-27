/**
 * The registry behind `full_cb.h`: holds one callback and invokes it on the
 * struct it is handed, by address.
 */
#include "full_cb.h"

static full_cb_t full_registered = 0;

void full_register(full_cb_t cb) {
    full_registered = cb;
}

void full_invoke(Full* f) {
    if (full_registered != 0) {
        full_registered(f);
    }
}
