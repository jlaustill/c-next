#ifndef C_INTEROP_UNIONS_H
#define C_INTEROP_UNIONS_H

#include <stdint.h>

/*
 * C Interop Test Unions
 * Test union definitions for C-Next interop testing
 */

/* Named union (requires 'union' keyword in C) */
union IntBytes {
    uint32_t value;
    uint8_t bytes[4];
};

/* Typedef union for type punning */
typedef union {
    float f;
    uint32_t u;
} FloatBits;

/* Union with different sized members */
typedef union {
    uint8_t byte_val;
    uint16_t word_val;
    uint32_t dword_val;
    uint64_t qword_val;
} MultiSize;

/* Union for register-style access */
typedef union {
    uint32_t raw;
    struct {
        uint8_t low_byte;
        uint8_t mid_low;
        uint8_t mid_high;
        uint8_t high_byte;
    } bytes;
    struct {
        uint16_t low_word;
        uint16_t high_word;
    } words;
} RegisterAccess;

#endif /* C_INTEROP_UNIONS_H */
