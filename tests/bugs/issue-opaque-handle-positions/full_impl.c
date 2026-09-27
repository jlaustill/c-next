/**
 * Control helper: takes the ADDRESS of a complete struct, so a caller passing
 * an array element must still write `&arr[i]`.
 */
#include "full.h"

void full_bump(Full* f) {
    f->pokes++;
}
