#ifndef CPP_REFERENCES_HPP
#define CPP_REFERENCES_HPP

#include <stdint.h>

/*
 * #2062: C++ reference parameters, which take the argument itself where a
 * pointer parameter takes its address. Defined static so the execution
 * fixture needs no companion source file.
 */
struct Sensor {
    int v;
};

static void touch(Sensor &s) { s.v = 7; }

static int peek(const Sensor &s) { return s.v; }

static void bump(int32_t &n) { n = n + 1; }

static void fill(Sensor *s) { s->v = 11; }

#endif
