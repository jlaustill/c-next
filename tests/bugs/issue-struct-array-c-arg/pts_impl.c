/**
 * The C side of `pts.h`.
 */
#include "pts.h"

void pts_bump2(CPoint* p) {
    p[0].x += 1U;
    p[1].x += 2U;
}

void pts_bump1(CPoint* p) {
    p->x += 1U;
}

void u32s_bump2(uint32_t* n) {
    n[0] += 1U;
    n[1] += 2U;
}
