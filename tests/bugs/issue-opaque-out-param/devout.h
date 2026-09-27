/**
 * An opaque handle, and a C function that hands one back through an
 * OUT-parameter. `struct Dev` is declared and never defined here, so `Dev` is
 * an incomplete type that C holds only through a pointer: a handle is a
 * `Dev*`, and `dev_create_into` takes a `Dev**` -- the address of the place
 * the caller keeps its handle.
 *
 * `<stddef.h>` is included because an opaque scope variable is emitted with a
 * `NULL` initializer, and generated C does not include it itself (#1610).
 */
#ifndef OPAQUE_OUT_PARAM_DEVOUT_H
#define OPAQUE_OUT_PARAM_DEVOUT_H

#include <stddef.h>
#include <stdint.h>

typedef struct Dev Dev;

void dev_create_into(Dev** out);
void dev_poke(Dev* d);
int32_t dev_pokes(Dev* d);

/* Handles the C side keeps. Each declared type says its depth: `dev_spare` is
 * one handle, and `dev_slots` reaches an array of them through a `Dev**`. */
extern Dev* dev_spare;
extern Dev** dev_slots;

/* Points `*where` at the slot array: an out-parameter one level deeper. */
void dev_slots_open(Dev*** where);
/* Creates a handle in slots[0] and slots[1]. */
void dev_slots_fill(Dev** slots);
/* 1 when both slots hold a handle, else 0. */
int32_t dev_slots_ready(Dev** slots);

#endif /* OPAQUE_OUT_PARAM_DEVOUT_H */
