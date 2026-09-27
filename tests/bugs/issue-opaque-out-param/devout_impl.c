/**
 * The only translation unit that sees inside `struct Dev`.
 *
 * Each handle counts the pokes that reach it, so a fixture can tell a handle
 * that was written through its out-parameter from one that was not.
 */
#include "devout.h"

struct Dev {
    int32_t pokes;
};

static Dev devices[8];
static int32_t device_count = 0;

Dev* dev_spare = NULL;

static Dev* slot_storage[2] = { NULL, NULL };
Dev** dev_slots = NULL;

void dev_create_into(Dev** out) {
    Dev* d = &devices[device_count];
    device_count++;
    d->pokes = 0;
    *out = d;
}

void dev_poke(Dev* d) {
    d->pokes++;
}

int32_t dev_pokes(Dev* d) {
    return d->pokes;
}

void dev_slots_open(Dev*** where) {
    *where = slot_storage;
}

void dev_slots_fill(Dev** slots) {
    dev_create_into(&slots[0]);
    dev_create_into(&slots[1]);
}

int32_t dev_slots_ready(Dev** slots) {
    return (slots[0] != NULL && slots[1] != NULL) ? 1 : 0;
}
