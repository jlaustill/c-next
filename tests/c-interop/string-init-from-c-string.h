// C strings a string<N> is initialized from (#1731 review): a pointer, an
// array, a function's result and a struct's array field.

#ifndef STRING_INIT_FROM_C_STRING_H
#define STRING_INIT_FROM_C_STRING_H

static const char* VERSION = "v1.2";
static char NAME_BUF[16] = "buf";
static inline const char* get_name(void) { return "fn"; }

typedef struct {
    char name[16];
} CCfg;

static CCfg C_CFG = { "cfg" };

#endif
