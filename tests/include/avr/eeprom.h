/**
 * AVR eeprom.h compatibility shim for C-Next testing
 *
 * Provides minimal definitions so Arduino headers compile on non-AVR platforms.
 * Real EEPROM functions would access non-volatile memory on AVR.
 */
#ifndef _AVR_EEPROM_H_
#define _AVR_EEPROM_H_

#include <stdint.h>
#include <stddef.h>

// EEPROM attribute - no-op on non-AVR
#define EEMEM

// EEPROM read functions (stubs - return 0)
static inline uint8_t eeprom_read_byte(const uint8_t* addr) { (void)addr; return 0; }
static inline uint16_t eeprom_read_word(const uint16_t* addr) { (void)addr; return 0; }
static inline uint32_t eeprom_read_dword(const uint32_t* addr) { (void)addr; return 0; }
static inline float eeprom_read_float(const float* addr) { (void)addr; return 0.0f; }
static inline void eeprom_read_block(void* dst, const void* src, size_t n) { (void)dst; (void)src; (void)n; }

// EEPROM write functions (stubs - do nothing)
static inline void eeprom_write_byte(uint8_t* addr, uint8_t val) { (void)addr; (void)val; }
static inline void eeprom_write_word(uint16_t* addr, uint16_t val) { (void)addr; (void)val; }
static inline void eeprom_write_dword(uint32_t* addr, uint32_t val) { (void)addr; (void)val; }
static inline void eeprom_write_float(float* addr, float val) { (void)addr; (void)val; }
static inline void eeprom_write_block(const void* src, void* dst, size_t n) { (void)src; (void)dst; (void)n; }

// EEPROM update functions (stubs - do nothing)
static inline void eeprom_update_byte(uint8_t* addr, uint8_t val) { (void)addr; (void)val; }
static inline void eeprom_update_word(uint16_t* addr, uint16_t val) { (void)addr; (void)val; }
static inline void eeprom_update_dword(uint32_t* addr, uint32_t val) { (void)addr; (void)val; }
static inline void eeprom_update_float(float* addr, float val) { (void)addr; (void)val; }
static inline void eeprom_update_block(const void* src, void* dst, size_t n) { (void)src; (void)dst; (void)n; }

#endif // _AVR_EEPROM_H_
