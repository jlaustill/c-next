#ifndef FAKE_LIB_H
#define FAKE_LIB_H

#include <stdint.h>

/* A concrete (fully-defined) struct — like lv_font_t */
typedef struct {
    uint32_t size;
    const uint8_t * data;
} font_t;

/* External global defined in another translation unit */
extern const font_t big_font;

/* Pointer to a font — already a pointer, should NOT get & */
extern const font_t *font_ptr;

/* Function that takes a POINTER to font_t */
void set_font(const font_t * font);

/* Function that takes font_t by value — should NOT get & */
void copy_font(font_t font);

/* Test helper — returns 1 if set_font received pointer to big_font */
int was_font_set_correctly(void);

#endif
