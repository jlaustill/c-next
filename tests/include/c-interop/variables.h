#ifndef C_INTEROP_VARIABLES_H
#define C_INTEROP_VARIABLES_H

#include <stdint.h>

/*
 * C Interop Test Variables
 * Test variable declarations for C-Next interop testing
 *
 * Variables are defined as static to allow execution tests without
 * requiring separate compilation/linking of a .c file.
 */

/* Static constant (can be accessed from C-Next) */
static const uint32_t EXTERN_MAGIC_NUMBER = 0xCAFEBABE;

/* Static variable (can be read/written from C-Next) */
static uint32_t extern_counter = 0;

/* Static const array */
static const uint8_t extern_lookup_table[16] = {
    0x00, 0x11, 0x22, 0x33,
    0x44, 0x55, 0x66, 0x77,
    0x88, 0x99, 0xAA, 0xBB,
    0xCC, 0xDD, 0xEE, 0xFF
};

/* Static volatile (for hardware simulation) */
static volatile uint32_t extern_status_register = 0;

#endif /* C_INTEROP_VARIABLES_H */
