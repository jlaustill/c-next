#ifndef C_INTEROP_MACROS_H
#define C_INTEROP_MACROS_H

/*
 * C Interop Test Macros
 * Test #define constants for C-Next interop testing
 * Note: Only constant macros, not function-like macros
 */

/* Integer constants */
#define MAX_SIZE 256
#define MIN_SIZE 1
#define BUFFER_SIZE 64
#define VERSION_MAJOR 1
#define VERSION_MINOR 2
#define VERSION_PATCH 3

/* Hex constants */
#define MAGIC_VALUE 0xDEADBEEF
#define STATUS_MASK 0xFF00
#define FLAG_BITS 0x0F

/* Computed constants */
#define TOTAL_VERSION ((VERSION_MAJOR * 10000) + (VERSION_MINOR * 100) + VERSION_PATCH)

/* Float constants */
#define PI_APPROX 3.14159f
#define E_APPROX 2.71828f

/* Boolean-like constants */
#define FEATURE_ENABLED 1
#define FEATURE_DISABLED 0

#endif /* C_INTEROP_MACROS_H */
