#ifndef INT16_SIZES_H
#define INT16_SIZES_H
/* 256 * 256 overflows a 16-bit int: avr-gcc reads this as 0, not 4 */
#define N_WIDE_HANDLERS (256 * 256 / 16384)
#endif
