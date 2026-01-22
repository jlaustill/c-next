/**
 * AVR interrupt.h compatibility shim for C-Next testing
 *
 * Provides minimal definitions so Arduino headers compile on non-AVR platforms.
 */
#ifndef _AVR_INTERRUPT_H_
#define _AVR_INTERRUPT_H_

#include <stdint.h>

// Interrupt macros - no-ops on non-AVR
#define ISR(vector) void vector##_vect(void)
#define SIGNAL(vector) void vector##_vect(void)

// Interrupt control
#define sei() ((void)0)
#define cli() ((void)0)

// SREG - Status Register (fake)
#define SREG (*(volatile uint8_t*)0)

#endif // _AVR_INTERRUPT_H_
