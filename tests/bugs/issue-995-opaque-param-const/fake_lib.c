/**
 * Implementation for testing opaque handle parameter passing.
 * Provides a simple widget with x position tracking.
 */
#include "fake_lib.h"
#include <stdlib.h>

struct _widget {
    int32_t x;
};

static struct _widget global_widget = {0};

widget_t* widget_create(void) {
    global_widget.x = 0;
    return &global_widget;
}

void widget_move(widget_t* w, int32_t x) {
    w->x = x;
}

int32_t widget_get_x(widget_t* w) {
    return w->x;
}
