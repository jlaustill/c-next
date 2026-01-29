// External C status enum for testing
// Simulates status codes from an external library
#pragma once

typedef enum {
    EXT_STATUS_OK = 0,
    EXT_STATUS_ERROR = 1,
    EXT_STATUS_BUSY = 2,
    EXT_STATUS_TIMEOUT = 3
} ExternalStatus;

typedef enum {
    EXT_MODE_IDLE = 0,
    EXT_MODE_ACTIVE = 1,
    EXT_MODE_SLEEP = 2
} ExternalMode;
