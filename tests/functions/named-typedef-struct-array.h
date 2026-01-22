// tests/functions/named-typedef-struct-array.h
/**
 * Pure C header for testing Issue #355
 * Bug: Array member via pointer generates invalid static_cast in C++ mode
 *
 * IMPORTANT: This header intentionally has NO C++ syntax (no typed enums)
 * so that when compiled with --cpp flag, the bug is triggered.
 * The bug occurs because CSymbolCollector is used for pure C headers,
 * but the field info lookup fails in some cases.
 */

#ifndef NAMED_TYPEDEF_STRUCT_ARRAY_H
#define NAMED_TYPEDEF_STRUCT_ARRAY_H

#include <stdint.h>

/* Named typedef struct pattern (like FlexCAN_T4's CAN_message_t)
 * This is the pattern that triggered issue #355
 */
typedef struct CAN_message_t {
    uint32_t id;
    uint8_t buf[8];  /* Array member - the bug occurs when accessing this */
    uint8_t len;
} CAN_message_t;

/* Struct with multiple array members for comprehensive testing */
typedef struct MultiArray_t {
    uint8_t header[8];
    uint8_t body[16];
    uint8_t sizes[3];
} MultiArray_t;

#endif /* NAMED_TYPEDEF_STRUCT_ARRAY_H */
