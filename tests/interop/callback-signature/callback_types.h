/**
 * C header with callback typedefs taking struct parameters.
 * Tests C/C++ interop for callback signatures.
 */

#ifndef CALLBACK_TYPES_H
#define CALLBACK_TYPES_H

typedef struct {
    int x;
    int y;
} Point;

/* C callback typedef - takes struct by value */
typedef void (*PointCallback)(Point p);

/* Struct containing callback */
typedef struct {
    PointCallback on_point;
} PointHandler;

/* Function that accepts a callback - inline implementation for test linking */
static int callback_called = 0;
static inline void register_callback(PointCallback cb) {
    callback_called = 1;
    Point test_point;
    test_point.x = 10;
    test_point.y = 20;
    cb(test_point);
}

#endif /* CALLBACK_TYPES_H */
