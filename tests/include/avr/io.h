/**
 * AVR io.h compatibility shim for C-Next testing
 *
 * Provides minimal definitions so Arduino headers compile on non-AVR platforms.
 * These are hardware register definitions that don't exist on x86.
 */
#ifndef _AVR_IO_H_
#define _AVR_IO_H_

#include <stdint.h>

// Memory bounds (fake values for non-AVR)
#ifndef RAMSTART
#define RAMSTART 0x100
#endif
#ifndef RAMEND
#define RAMEND   0x8FF  // 2KB RAM
#endif

// UART registers - define UBRR0H to enable Serial extern declaration
// These would normally point to hardware registers on AVR
#define UBRRH   (*(volatile uint8_t*)0)
#define UBRR0H  (*(volatile uint8_t*)0)
#define UBRR1H  (*(volatile uint8_t*)0)

// Common register bits
#define _BV(bit) (1 << (bit))

// Interrupt control
#define sei() ((void)0)
#define cli() ((void)0)

#endif // _AVR_IO_H_
