/**
 * Test header for Issue #945
 *
 * This simulates the LVGL/FreeRTOS pattern where functions are guarded by
 * #if MACRO != 0 conditionals that should be evaluated via -D defines.
 */

#ifndef CONDITIONAL_FEATURES_H
#define CONDITIONAL_FEATURES_H

#include <stdint.h>
#include "feature_conf.h"

/* Opaque struct pointer pattern (like lv_obj_t*) */
typedef struct widget_s widget_t;

/* This function is always available */
static inline uint32_t always_available(void) {
    return 42;
}

/*
 * This function is behind a #if FEATURE_LABEL != 0 guard.
 * The transpiler should see this when -D FEATURE_LABEL=1 is passed.
 *
 * Returns a widget_t* (pointer) - this is the key test case.
 * If the transpiler doesn't see this function, it will generate
 * value type (widget_t) instead of pointer type (widget_t*).
 */
#if FEATURE_LABEL != 0
static inline widget_t* create_label(widget_t* parent) {
    /* In real code, this would allocate and return a widget */
    return parent;  /* Just return parent for test */
}
#endif

/*
 * Another conditional function using #ifdef style.
 * This pattern should also be tested.
 */
#ifdef FEATURE_BUTTON
static inline widget_t* create_button(widget_t* parent) {
    return parent;
}
#endif

/*
 * A function behind #if FEATURE_VALUE == 1 style guard
 */
#if FEATURE_CHECKBOX == 1
static inline widget_t* create_checkbox(widget_t* parent) {
    return parent;
}
#endif

#endif /* CONDITIONAL_FEATURES_H */
