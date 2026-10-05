#ifndef UNREADABLE_MACROS_H
#define UNREADABLE_MACROS_H

#include <stdint.h>

/* #1688: object-like macros C-Next cannot type from their tokens (ADR-024) */
#define _MMIO_BYTE(mem_addr) (*(volatile uint8_t *)(mem_addr))
#define REG_BYTE _MMIO_BYTE(0x23)
#define SCALED_CALL scale_of(2U)
#define CAST_LIMIT ((uint32_t)7)

static inline uint32_t scale_of(uint32_t x) { return x * 3U; }

#endif /* UNREADABLE_MACROS_H */
