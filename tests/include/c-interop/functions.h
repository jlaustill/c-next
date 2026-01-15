#ifndef C_INTEROP_FUNCTIONS_H
#define C_INTEROP_FUNCTIONS_H

#include <stdint.h>
#include <stdbool.h>

/*
 * C Interop Test Functions
 * Test function declarations with various signatures for C-Next interop testing
 *
 * Functions are defined as static inline so they can be used in execution tests
 * without requiring separate compilation/linking of a .c file.
 */

/* Basic arithmetic functions */
static inline int add_integers(int a, int b) {
    return a + b;
}

static inline int subtract_integers(int a, int b) {
    return a - b;
}

/* Fixed-width integer functions */
static inline uint8_t add_u8(uint8_t a, uint8_t b) {
    return (uint8_t)(a + b);
}

static inline uint16_t add_u16(uint16_t a, uint16_t b) {
    return (uint16_t)(a + b);
}

static inline uint32_t add_u32(uint32_t a, uint32_t b) {
    return a + b;
}

static inline uint64_t add_u64(uint64_t a, uint64_t b) {
    return a + b;
}

static inline int8_t add_i8(int8_t a, int8_t b) {
    return (int8_t)(a + b);
}

static inline int16_t add_i16(int16_t a, int16_t b) {
    return (int16_t)(a + b);
}

static inline int32_t add_i32(int32_t a, int32_t b) {
    return a + b;
}

static inline int64_t add_i64(int64_t a, int64_t b) {
    return a + b;
}

/* Multiplication */
static inline uint32_t multiply_u32(uint32_t x, uint32_t y) {
    return x * y;
}

/* Floating point functions */
static inline float add_float(float a, float b) {
    return a + b;
}

static inline double add_double(double a, double b) {
    return a + b;
}

/* Functions returning constants */
static inline int32_t get_constant_42(void) {
    return 42;
}

static inline uint32_t get_magic_number(void) {
    return 0xDEADBEEF;
}

/* Global flag for void function testing */
static bool c_interop_global_flag = false;

/* Void functions */
static inline void no_return_no_params(void) {
    /* Does nothing - just tests void function calls */
}

static inline void set_global_flag(bool value) {
    c_interop_global_flag = value;
}

static inline bool get_global_flag(void) {
    return c_interop_global_flag;
}

/* Boolean functions */
static inline bool is_positive(int32_t value) {
    return value > 0;
}

static inline bool is_even(uint32_t value) {
    return (value % 2) == 0;
}

/* Identity functions for type testing */
static inline uint8_t identity_u8(uint8_t x) { return x; }
static inline uint16_t identity_u16(uint16_t x) { return x; }
static inline uint32_t identity_u32(uint32_t x) { return x; }
static inline uint64_t identity_u64(uint64_t x) { return x; }
static inline int8_t identity_i8(int8_t x) { return x; }
static inline int16_t identity_i16(int16_t x) { return x; }
static inline int32_t identity_i32(int32_t x) { return x; }
static inline int64_t identity_i64(int64_t x) { return x; }

#endif /* C_INTEROP_FUNCTIONS_H */
