#ifndef FAKE_LIB_H
#define FAKE_LIB_H
#include <stdint.h>
typedef struct _widget_t widget_t;
widget_t * widget_create(void);
void widget_set_value(widget_t * w, int32_t val);
#endif
