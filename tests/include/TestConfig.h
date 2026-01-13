#ifndef TEST_CONFIG_H
#define TEST_CONFIG_H

#include <stdint.h>

/* Test struct for C header interop with .length property */
typedef struct {
    uint32_t magic;      /* 32-bit magic number */
    uint16_t version;    /* 16-bit version */
    uint8_t flags;       /* 8-bit flags */
    uint64_t timestamp;  /* 64-bit timestamp */
} AppConfig;

#endif /* TEST_CONFIG_H */
