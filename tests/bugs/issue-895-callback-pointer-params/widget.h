/**
 * Issue #895: C header with opaque types and callback typedefs
 * Tests that C-Next callback functions generate correct pointer signatures
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
void widget_destroy(widget_t *w);
void widget_trigger_flush(widget_t *w, const rect_t *area, uint8_t *buf);

/* Test helper - tracks if flush was called */
extern bool widget_flush_was_called;
extern uint16_t widget_flush_area_x;
extern uint16_t widget_flush_area_y;
extern uint8_t widget_flush_buf_first_byte;

#endif /* WIDGET_H */
