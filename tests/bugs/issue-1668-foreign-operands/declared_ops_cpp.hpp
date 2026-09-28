#ifndef DECLARED_OPS_CPP_HPP
#define DECLARED_OPS_CPP_HPP
#include <stdint.h>
struct CppOps {
    float (*getf)();
    uint8_t *buf;
    uint8_t arr[4];
    uint8_t flags;
};
extern CppOps cops;
#endif
