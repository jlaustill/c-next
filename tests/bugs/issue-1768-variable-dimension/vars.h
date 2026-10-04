/* Helper for header-variable.test.cnx (#1768): header names, some constant in C. */
#ifndef VARS_H
#define VARS_H
#include <stdint.h>
#define VARS_N 4
typedef enum { RED, GREEN, COLOR_COUNT } color_t;
extern uint32_t runtime_count;
extern const uint32_t const_count;
uint32_t get_count(void);
#endif
