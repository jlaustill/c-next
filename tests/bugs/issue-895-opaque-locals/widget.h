#ifndef WIDGET_H
#define WIDGET_H

#include <stdint.h>

/* Opaque type - forward declaration only */
typedef struct widget_t widget_t;

/* Factory function returns pointer to opaque type */
widget_t *widget_create(int32_t width, int32_t height);

/* Functions that take pointer to opaque type */
void widget_destroy(widget_t *w);
int32_t widget_get_width(widget_t *w);

#endif
