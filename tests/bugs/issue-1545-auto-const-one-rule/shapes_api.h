/**
 * Third-party C header for #1545, second round. Two callback typedefs whose
 * parameter is a pointer C-Next does NOT render through the string branch:
 *
 *   buf_cb_t  takes `const uint8_t *` -- the C-Next handler declares an ARRAY,
 *             and the array branch dropped the typedef's const in BOTH files,
 *             so the two agreed with each other and neither matched the
 *             typedef (-Wincompatible-pointer-types at the registration).
 *
 *   knob_cb_t takes an OPAQUE handle. `knob_t` is incomplete, so it is only
 *             ever a pointer; treating it as "a primitive that became a
 *             pointer to match the typedef" made every whole-value use emit
 *             `(*k)`, which is `error: invalid use of incomplete typedef`.
 *
 * Both registrars are `static inline` so the fixture links without a separate
 * C translation unit, following log_api.h beside it. `register_knob` ignores
 * its handler on purpose: an incomplete type cannot be instantiated here, and
 * the defect is in the handler's generated SHAPE, not in calling it.
 */

#ifndef SHAPES_API_H
#define SHAPES_API_H

#include <stdint.h>

typedef void (*buf_cb_t)(const uint8_t *);

typedef struct _knob knob_t;
typedef void (*knob_cb_t)(knob_t *);

static inline void register_buf(buf_cb_t handler) {
    static const uint8_t bytes[4] = { 7U, 0U, 0U, 0U };
    handler(bytes);
}

/* Reads the handle WITHOUT dereferencing it -- an incomplete type has nothing
   to dereference, which is the whole point of the case below. */
static inline uint8_t knob_id(knob_t *k) {
    return (k == 0) ? 0U : 1U;
}

static inline void register_knob(knob_cb_t handler) {
    (void)handler;
}

#endif /* SHAPES_API_H */
