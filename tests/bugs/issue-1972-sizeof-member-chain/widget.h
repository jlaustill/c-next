#ifndef WIDGET_H
#define WIDGET_H
#include <stdint.h>
typedef struct {
    uint32_t v;
    uint8_t flags;
} widget_t;
static widget_t the_widget = {5U, 0U};
static widget_t* widget_get(void) {
    return &the_widget;
}
#endif
