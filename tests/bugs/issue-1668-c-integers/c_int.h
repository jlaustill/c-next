#ifndef C_INT_H
#define C_INT_H

#include <stdint.h>

/*
 * #1668: C integers for the operand typer's width and subscript rules.
 * Defined static so the execution fixtures need no companion .c file.
 */

static uint32_t cU32 = 70000U;
static uint16_t cU16 = 1000U;

/* Its width is the C library's choice, not the target's data model. */
static uint_fast16_t cFast = 1000U;

static uint8_t buf[] = {10U, 11U, 12U, 13U, 14U};
static uint8_t fixed[4] = {20U, 21U, 22U, 23U};
static uint8_t *ptr = fixed;
static uint32_t word = 0x10U;

#endif
