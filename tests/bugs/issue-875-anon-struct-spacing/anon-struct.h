#ifndef ANON_STRUCT_H
#define ANON_STRUCT_H

/* Struct with anonymous struct field containing bitfields */
typedef struct {
    int value;
    struct {
        unsigned int flag_a: 1;
        unsigned int flag_b: 1;
    } flags;
} config_t;

#endif /* ANON_STRUCT_H */
