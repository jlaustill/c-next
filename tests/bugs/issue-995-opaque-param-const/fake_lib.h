#ifndef FAKE_LIB_H
#define FAKE_LIB_H

#include <stdint.h>

/* Opaque handle type - forward declaration only, no body */
typedef struct _widget widget_t;

/* Factory function returns pointer to opaque type */
widget_t* widget_create(void);

/* Mutating function takes NON-CONST pointer - this is key to the bug */
void widget_move(widget_t* w, int32_t x);

/* For execution testing */
int32_t widget_get_x(widget_t* w);

#endif
