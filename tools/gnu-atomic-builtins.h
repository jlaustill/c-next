/*
 * #1147: GCC and Clang declare the generic __atomic builtins themselves, on
 * every target, so generated code calls them with no header. cppcheck is not
 * a compiler and knows none of them, so the MISRA pass read each call as an
 * implicit declaration (Rule 17.3). This file gives it the compiler's own
 * declarations, as documented in "Built-in Functions for Memory Model Aware
 * Atomic Operations" of the GCC manual. Only the builtins cnx emits are
 * here; the type-generic `type *` parameters are written as `void *`.
 */
#ifndef CNX_ANALYSIS_GNU_ATOMIC_BUILTINS_H
#define CNX_ANALYSIS_GNU_ATOMIC_BUILTINS_H

#include <stdbool.h>

void __atomic_load(const volatile void *ptr, void *ret, int memorder);
bool __atomic_compare_exchange(volatile void *ptr, void *expected,
                               void *desired, bool weak,
                               int success_memorder, int failure_memorder);

#endif
