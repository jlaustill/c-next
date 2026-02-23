/**
 * Issue #914: C header with callback typedef for testing header generation
 */
#ifndef WIDGET_H
#define WIDGET_H

#include <stdint.h>
#include <stdbool.h>

/* Opaque type - incomplete struct (forward declaration only) */
typedef struct widget_t widget_t;

/* Complete struct for area rectangles */
typedef struct rect_t {
    uint16_t x;
    uint16_t y;
    uint16_t width;
    uint16_t height;
} rect_t;

/**
 * Flush callback typedef - all params are pointers in the C API
 * widget_t* is opaque (must be pointer)
 * rect_t* is const pointer (read-only area)
 * uint8_t* is buffer pointer (pixel data)
 */
typedef void (*flush_cb_t)(widget_t *, const rect_t *, uint8_t *);

/* Widget API functions */
void widget_set_flush_cb(widget_t *w, flush_cb_t cb);
widget_t *widget_create(void);

#endif /* WIDGET_H */
