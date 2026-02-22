/**
 * Issue #895: Widget implementation for testing callback signatures
 */
#include "widget.h"
#include <stdlib.h>

/* Internal widget structure (opaque to callers) */
struct widget_t {
    flush_cb_t flush_cb;
    int id;
};

/* Test tracking variables */
bool widget_flush_was_called = false;
uint16_t widget_flush_area_x = 0;
uint16_t widget_flush_area_y = 0;
uint8_t widget_flush_buf_first_byte = 0;

widget_t *widget_create(void) {
    widget_t *w = (widget_t *)malloc(sizeof(widget_t));
    if (w) {
        w->flush_cb = NULL;
        w->id = 42;
    }
    return w;
}

void widget_destroy(widget_t *w) {
    if (w) {
        free(w);
    }
}

void widget_set_flush_cb(widget_t *w, flush_cb_t cb) {
    if (w) {
        w->flush_cb = cb;
    }
}

void widget_trigger_flush(widget_t *w, const rect_t *area, uint8_t *buf) {
    if (w && w->flush_cb) {
        w->flush_cb(w, area, buf);
    }
}
