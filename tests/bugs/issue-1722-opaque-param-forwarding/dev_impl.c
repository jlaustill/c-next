/**
 * Issue #1722: the only translation unit that sees inside `struct Dev`.
 *
 * Each handle counts the pokes that reach it, so a fixture can tell a handle
 * that arrived unchanged from one that did not.
 */
#include "dev.h"

struct Dev {
    int32_t pokes;
};

static Dev devices[8];
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
