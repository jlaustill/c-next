// tests/functions/array-member-to-array-param.h
/**
 * C++ header for testing Issue #342
 * Bug: Array member passed to array parameter incorrectly cast to single element
 *
 * When passing msg.buf (uint8_t[8]) to a function expecting const u8 data[8],
 * the transpiler generates: static_cast<uint8_t>(msg.buf)
 * instead of just passing msg.buf directly.
 *
 * Uses C++ typed enums to force C++ compilation mode.
 */

#ifndef ARRAY_MEMBER_TO_ARRAY_PARAM_H
#define ARRAY_MEMBER_TO_ARRAY_PARAM_H

#include <stdint.h>

// Typed enum forces C++ compilation
enum EMessageType : uint8_t {
    MSG_TYPE_DATA = 0,
    MSG_TYPE_CONFIG = 1,
    MSG_TYPE_STATUS = 2
};

// Struct with an array member (simulates CAN_message_t)
typedef struct {
    uint32_t id;
    uint8_t buf[8];  // Array member
    uint8_t len;
} CanMessage;

// Struct with multiple array members for thorough testing
typedef struct {
    uint8_t header[4];
    uint8_t payload[16];
    uint8_t checksum[2];
} PacketData;

#endif // ARRAY_MEMBER_TO_ARRAY_PARAM_H
