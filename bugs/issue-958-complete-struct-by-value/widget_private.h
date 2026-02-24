#ifndef WIDGET_PRIVATE_H
#define WIDGET_PRIVATE_H
#include "widget_types.h"

// Full definition in separate file (like LVGL's _private.h)
struct _widget_t {
    int32_t value;
    uint8_t flags;
};

#endif
