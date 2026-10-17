#ifndef C_WRITER_H
#define C_WRITER_H

#include <stdint.h>

typedef struct Dev Dev;

void c_fill(char *s);
void c_show(const char *s);
void c_fill_bytes(uint8_t *bytes);
void c_show_bytes(const uint8_t *bytes);
Dev *dev_open(void);
void dev_close(Dev *d);

#endif
