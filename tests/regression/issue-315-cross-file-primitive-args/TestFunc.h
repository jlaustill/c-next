#ifndef TESTFUNC_H
#define TESTFUNC_H

/**
 * Issue #315: Header for TestFunc scope
 * Provides function declarations for cross-file primitive arg test
 */

#include <stdint.h>
#include <stdbool.h>

#ifdef __cplusplus
extern "C" {
#endif

/* TestFunc scope public functions */
float TestFunc_addFloats(float a, float b);

#ifdef __cplusplus
}
#endif

#endif /* TESTFUNC_H */
