// tests/functions/named-typedef-struct-array.h
/**
 * C++ header for testing Issue #347
 * Named typedef struct pattern: typedef struct Name { ... } Name;
 *
 * This pattern is common in embedded libraries like FlexCAN_T4.
 * Uses C++ typed enums to force C++ compilation mode.
 */

#ifndef NAMED_TYPEDEF_STRUCT_ARRAY_H
#define NAMED_TYPEDEF_STRUCT_ARRAY_H

#include <stdint.h>

// Typed enum forces C++ compilation
enum EMessageType : uint8_t {
    MSG_TYPE_DATA = 0,
    MSG_TYPE_CONFIG = 1,
    MSG_TYPE_STATUS = 2
};

// Named struct with typedef (like FlexCAN_T4's CAN_message_t)
typedef struct CAN_message_t {
    uint32_t id;
    uint8_t buf[8];
    uint8_t len;
} CAN_message_t;

// Another named typedef struct pattern
typedef struct CANFrame_t {
    uint16_t arbitration_id;
    uint8_t data[8];
    uint8_t dlc;
} CANFrame_t;

#endif // NAMED_TYPEDEF_STRUCT_ARRAY_H
