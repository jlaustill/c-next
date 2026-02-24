// Test helper: C++ aggregate type (no user-defined constructor)
// This SHOULD use designated initializers since it's an aggregate
#pragma once

#ifdef __cplusplus
struct AggregateType {
    // No constructor - this is an aggregate type
    int value;
    const char* label;
};
#else
// C version for syntax checking
typedef struct {
    int value;
    const char* label;
} AggregateType;
#endif
