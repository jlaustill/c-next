/**
 * The only translation unit that sees inside `struct Dev`.
 *
 * Each handle counts the pokes that reach it, so a fixture can tell a handle
 * that arrived unchanged from one that did not.
 */
#include "dev.h"

struct Dev {
    int32_t pokes;
};

static Dev devices[16];
static int32_t device_count = 0;

Dev* dev_create(void) {
    Dev* d = &devices[device_count];
    device_count++;
    d->pokes = 0;
    return d;
}

void dev_poke(Dev* d) {
    d->pokes++;
}

int32_t dev_pokes(Dev* d) {
    return d->pokes;
}

static dev_pair_cb_t pair_registered = 0;

void dev_pair_register(dev_pair_cb_t cb) {
    pair_registered = cb;
}

void dev_pair_invoke(Dev* pair[2]) {
    if (pair_registered != 0) {
        pair_registered(pair);
    }
}
