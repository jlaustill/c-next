#ifndef FAKE_LIB_H
#define FAKE_LIB_H

#include <stdint.h>

#define BUF_SIZE 8

typedef struct {
    uint8_t data[BUF_SIZE];
} msg_t;

/* Inline helper for test - fills data[i] = i + 1 */
static inline void fill_msg(msg_t* m) {
    for (uint8_t i = 0; i < BUF_SIZE; i++) {
        m->data[i] = i + 1;
    }
}

#endif
