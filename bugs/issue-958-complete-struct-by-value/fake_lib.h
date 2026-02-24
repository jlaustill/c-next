#ifndef FAKE_LIB_H
#define FAKE_LIB_H
#include <stdint.h>

// Include types (has forward declaration)
#include "widget_types.h"

// Include private header (has full definition) - like LVGL v9's transitive includes
#include "widget_private.h"

// C functions that work with widget_t pointers
widget_t * widget_create(void);
int32_t widget_get_value(widget_t * w);
typedef void (*widget_cb_t)(widget_t * w);
void widget_set_callback(widget_t * w, widget_cb_t cb);

#endif
