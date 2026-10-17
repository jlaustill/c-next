#ifndef WORD_H
#define WORD_H
#include <stdint.h>
#if __SIZEOF_POINTER__ == 8
typedef uint64_t uword_t;
#else
typedef uint32_t uword_t;
#endif
#endif
