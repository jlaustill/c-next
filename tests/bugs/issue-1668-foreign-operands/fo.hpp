#pragma once
#include <stdint.h>

class Dev {
public:
    float df;
    float read();
    int32_t readI();
};
extern Dev dev;

namespace NS {
    extern float nf;
    extern int32_t ns;
    struct PS {
        float pf;
    };
    extern PS nps;
}
