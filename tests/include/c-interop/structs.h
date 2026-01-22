#ifndef C_INTEROP_STRUCTS_H
#define C_INTEROP_STRUCTS_H

#include <stdint.h>
#include <stdbool.h>

/*
 * C Interop Test Structs
 * Test struct definitions for C-Next interop testing
 */

/* Named struct (requires 'struct' keyword in C) */
struct NamedPoint {
    int32_t x;
    int32_t y;
};

/* Named struct with more fields */
struct NamedConfig {
    uint32_t magic;
    uint16_t version;
    uint8_t flags;
    uint8_t checksum;
};

/* Anonymous struct with typedef */
typedef struct {
    uint32_t id;
    uint16_t flags;
} SimpleRecord;

/* Struct with array fields */
typedef struct {
    uint8_t data[32];
    uint32_t len;  /* Note: avoid 'length' to not collide with .length property */
} DataBuffer;

/* Struct with fixed array field for .length testing */
typedef struct {
    uint32_t values[8];
    uint8_t count;
} ValueArray;

/* Nested struct using named struct */
typedef struct {
    struct NamedPoint origin;
    uint32_t width;
    uint32_t height;
} Rectangle;

/* Struct with various primitive types */
typedef struct {
    bool active;
    uint8_t byte_val;
    uint16_t word_val;
    uint32_t dword_val;
    int32_t signed_val;
} MixedTypes;

/* Complex nested structure */
typedef struct {
    struct NamedConfig config;
    DataBuffer buffer;
    uint32_t timestamp;
} ComplexStruct;

#endif /* C_INTEROP_STRUCTS_H */
