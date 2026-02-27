#include "fake_lib.h"
#include <stddef.h>

/* Define the external global */
static const uint8_t font_data[] = {0x01, 0x02, 0x03};
const font_t big_font = {16, font_data};

/* Track whether set_font received a valid pointer */
static const font_t * last_font = NULL;

void set_font(const font_t * font) {
    last_font = font;
}

/* Helper for test validation */
int was_font_set_correctly(void) {
    return last_font == &big_font ? 1 : 0;
}
