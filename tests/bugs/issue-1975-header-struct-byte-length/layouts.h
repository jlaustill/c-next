#ifndef LAYOUTS_H
#define LAYOUTS_H
#include <stdint.h>

/* An unnamed member: its fields are the struct's, but cnx records none */
typedef struct {
    uint8_t a;
    union {
        uint32_t u;
        uint8_t v;
    };
} AnonUnion;

typedef struct {
    uint8_t a;
    struct {
        uint32_t u;
        uint8_t *p;
    };
} AnonStruct;

/* `bar` is a typedef of `struct foo` and a tag of its own */
typedef struct foo {
    uint32_t a;
} bar;
struct bar {
    bar inner;
    uint8_t z;
};

#endif
