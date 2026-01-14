/**
 * Nested struct test configuration for C-Next
 * Test header for issue #103 - .length property on nested C struct members
 */
#ifndef NESTED_TEST_CONFIG_H
#define NESTED_TEST_CONFIG_H

#include <stdint.h>

/**
 * Inner struct with known-size fields for testing .length resolution
 */
struct InnerConfig {
    uint8_t  byteField;    /* 8 bits */
    uint16_t shortField;   /* 16 bits */
    uint32_t intField;     /* 32 bits */
    float    floatField;   /* 32 bits */
};

/**
 * Outer struct containing nested struct and array of structs
 */
struct OuterConfig {
    uint32_t directField;           /* 32 bits - direct access works */
    struct InnerConfig single;      /* nested struct */
    struct InnerConfig array[4];    /* array of nested structs */
};

/**
 * Deep nested struct for testing 3-level nesting
 */
struct DeepConfig {
    struct OuterConfig outer;       /* 2-level nesting */
    uint64_t timestamp;             /* 64 bits */
};

#endif /* NESTED_TEST_CONFIG_H */
