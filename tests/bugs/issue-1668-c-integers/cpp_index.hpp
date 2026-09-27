#ifndef CPP_INDEX_HPP
#define CPP_INDEX_HPP

#include <stdint.h>

/*
 * #1668: a C++ type with its own operator[], which C-Next must leave to C++.
 * Defined static so the execution fixture needs no companion source file.
 */
struct SBuf {
    uint8_t data[4];
    uint8_t operator[](int i) const { return data[i]; }
};

static SBuf sbuf = {{5U, 6U, 7U, 8U}};
static uint32_t cWord = 0x10U;

#endif
