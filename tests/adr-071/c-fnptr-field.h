#pragma once
#include <stdint.h>

typedef void (*fill_cb_t)(uint8_t *buf);
typedef void (*peek_cb_t)(const uint8_t *buf);
typedef struct {
    fill_cb_t fill;
    peek_cb_t peek;
} Holder;
