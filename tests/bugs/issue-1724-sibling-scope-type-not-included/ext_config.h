/**
 * Third-party C header for #1724 (the issue's ext.h). Its typedef is named
 * `Config`, which is also the name motor-config.cnx gives a struct inside
 * `scope Motor`. A file that includes this header and not motor-config.cnx
 * can see only this one.
 */

#ifndef EXT_CONFIG_H
#define EXT_CONFIG_H

#include <stdint.h>

typedef struct {
    int32_t a;
    int32_t b;
} Config;

#endif /* EXT_CONFIG_H */
