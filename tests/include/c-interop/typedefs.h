#ifndef C_INTEROP_TYPEDEFS_H
#define C_INTEROP_TYPEDEFS_H

#include <stdint.h>
#include <stdbool.h>

/*
 * C Interop Test Typedefs
 * Test typedef declarations for C-Next interop testing
 */

/* Basic type aliases */
typedef uint8_t byte_t;
typedef uint16_t word_t;
typedef uint32_t dword_t;
typedef uint64_t qword_t;
typedef int32_t offset_t;

/* Struct typedefs - anonymous structs with typedef names */
typedef struct {
    int32_t x;
    int32_t y;
} Point2D;

typedef struct {
    float x;
    float y;
    float z;
} Vector3D;

typedef struct {
    uint32_t id;
    uint16_t flags;
    uint8_t status;
    uint8_t reserved;
} Record;

/* Struct with various field sizes for .length testing */
typedef struct {
    uint8_t byte_field;
    uint16_t word_field;
    uint32_t dword_field;
    uint64_t qword_field;
} SizedFields;

/* Array typedefs */
typedef uint8_t buffer16_t[16];
typedef uint32_t quad_t[4];
typedef int32_t matrix3x3_t[3][3];

/* Function pointer typedefs */
typedef int (*compare_fn)(int, int);
typedef void (*callback_fn)(void);
typedef uint32_t (*transform_fn)(uint32_t);

#endif /* C_INTEROP_TYPEDEFS_H */
