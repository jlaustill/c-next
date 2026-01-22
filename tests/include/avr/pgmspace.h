/**
 * AVR pgmspace.h compatibility shim for C-Next testing
 *
 * This provides minimal stubs so Arduino headers compile on non-AVR platforms.
 * Real AVR code uses PROGMEM to store data in flash memory; on x86 we just
 * treat it as regular memory.
 */
#ifndef _AVR_PGMSPACE_H_
#define _AVR_PGMSPACE_H_

#include <stdint.h>
#include <string.h>

// PROGMEM is a no-op on non-AVR
#define PROGMEM

// Program memory pointer type
typedef const char* PGM_P;
typedef const void* PGM_VOID_P;

// pgm_read_* macros - just dereference on non-AVR
#define pgm_read_byte(addr)   (*(const uint8_t*)(addr))
#define pgm_read_word(addr)   (*(const uint16_t*)(addr))
#define pgm_read_dword(addr)  (*(const uint32_t*)(addr))
#define pgm_read_float(addr)  (*(const float*)(addr))
#define pgm_read_ptr(addr)    (*(const void* const*)(addr))

// _near and _far variants are the same on non-AVR
#define pgm_read_byte_near(addr)  pgm_read_byte(addr)
#define pgm_read_word_near(addr)  pgm_read_word(addr)
#define pgm_read_dword_near(addr) pgm_read_dword(addr)
#define pgm_read_float_near(addr) pgm_read_float(addr)
#define pgm_read_ptr_near(addr)   pgm_read_ptr(addr)

#define pgm_read_byte_far(addr)   pgm_read_byte(addr)
#define pgm_read_word_far(addr)   pgm_read_word(addr)
#define pgm_read_dword_far(addr)  pgm_read_dword(addr)
#define pgm_read_float_far(addr)  pgm_read_float(addr)
#define pgm_read_ptr_far(addr)    pgm_read_ptr(addr)

// String functions - just use standard versions
#define strlen_P(s)           strlen(s)
#define strcpy_P(d, s)        strcpy(d, s)
#define strncpy_P(d, s, n)    strncpy(d, s, n)
#define strcmp_P(s1, s2)      strcmp(s1, s2)
#define strncmp_P(s1, s2, n)  strncmp(s1, s2, n)
#define memcpy_P(d, s, n)     memcpy(d, s, n)

#endif // _AVR_PGMSPACE_H_
