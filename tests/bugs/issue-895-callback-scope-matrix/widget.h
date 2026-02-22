/**
 * Minimal C header modeling the LVGL pattern:
 * opaque handle + struct + buffer pointer in callback typedef.
 */
#ifndef WIDGET_H
#define WIDGET_H

#include <stdint.h>
#include <stdbool.h>

typedef struct widget_t widget_t;

typedef struct {
    int32_t x1;
    int32_t y1;
    int32_t x2;
    int32_t y2;
} rect_t;

typedef void (*flush_cb_t)(widget_t *w, const rect_t *area, uint8_t *buf);

widget_t *widget_create(void);
void widget_set_flush_cb(widget_t *w, flush_cb_t cb);
void widget_flush_ready(widget_t *w);

#endif
