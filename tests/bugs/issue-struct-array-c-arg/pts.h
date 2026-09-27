/**
 * A COMPLETE struct, and C functions that take a pointer to one. A whole C-Next
 * array of `CPoint` reaching `pts_bump2` must decay to the pointer to its first
 * element -- the `CPoint*` the function expects -- exactly as a C array does.
 */
#ifndef STRUCT_ARRAY_C_ARG_PTS_H
#define STRUCT_ARRAY_C_ARG_PTS_H

#include <stdint.h>

typedef struct CPoint {
    uint32_t x;
} CPoint;

/* Adds 1 to p[0].x and 2 to p[1].x: a pointer that is not the array's first
 * element changes the wrong values. */
void pts_bump2(CPoint* p);

/* Adds 1 to p->x: one element, passed by address. */
void pts_bump1(CPoint* p);

/* Adds 1 to n[0] and 2 to n[1]. */
void u32s_bump2(uint32_t* n);

#endif /* STRUCT_ARRAY_C_ARG_PTS_H */
