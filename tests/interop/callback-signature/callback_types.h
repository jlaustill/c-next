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

/* Function that accepts a callback */
void register_callback(PointCallback cb);

#endif /* CALLBACK_TYPES_H */
