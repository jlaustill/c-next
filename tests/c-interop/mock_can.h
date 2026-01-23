// Mock CAN message struct (simulates FlexCAN_T4's CAN_message_t)
// Used for testing Issue #355: array member access via pointer

#ifndef MOCK_CAN_H
#define MOCK_CAN_H

#include <stdint.h>

// Simulates CAN_message_t from FlexCAN_T4.h
typedef struct MockCanMessage {
    uint32_t id;
    uint16_t timestamp;
    uint8_t len;
    uint8_t buf[8];  // Array field - this is what Issue #355 tests
    uint8_t bus;
} MockCanMessage;

#endif
