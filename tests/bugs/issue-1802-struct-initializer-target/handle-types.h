#ifndef HANDLE_TYPES_H
#define HANDLE_TYPES_H

struct Obj;
typedef struct Obj *Handle;

typedef void (*cb_t)(void);

typedef union {
    int i;
    float f;
} Num;

typedef struct _Tagged {
    int a;
} Tagged;

#endif
