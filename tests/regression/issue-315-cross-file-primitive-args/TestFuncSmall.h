#ifndef TESTFUNCSMALL_H
#define TESTFUNCSMALL_H

/**
 * Issue #315: Header for TestFuncSmall scope
 * Provides function declarations for cross-file small primitive arg test
 */

#include <stdint.h>
#include <stdbool.h>

#ifdef __cplusplus
extern "C" {
#endif

/* TestFuncSmall scope public functions */
uint8_t TestFuncSmall_addBytes(uint8_t a, uint8_t b);

#ifdef __cplusplus
}
#endif

#endif /* TESTFUNCSMALL_H */
