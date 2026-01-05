/* Stub CMSIS header for C-Next test compilation */
#ifndef CMSIS_GCC_H
#define CMSIS_GCC_H

#include <stdint.h>

/* Stub PRIMASK functions */
static inline uint32_t __get_PRIMASK(void) { return 0; }
static inline void __set_PRIMASK(uint32_t primask) { (void)primask; }
static inline void __disable_irq(void) {}

/* Stub LDREX/STREX functions */
static inline uint8_t __LDREXB(volatile uint8_t* addr) { return *addr; }
static inline uint32_t __STREXB(uint8_t value, volatile uint8_t* addr) { *addr = value; return 0; }
static inline uint16_t __LDREXH(volatile uint16_t* addr) { return *addr; }
static inline uint32_t __STREXH(uint16_t value, volatile uint16_t* addr) { *addr = value; return 0; }
static inline uint32_t __LDREXW(volatile uint32_t* addr) { return *addr; }
static inline uint32_t __STREXW(uint32_t value, volatile uint32_t* addr) { *addr = value; return 0; }

#endif
