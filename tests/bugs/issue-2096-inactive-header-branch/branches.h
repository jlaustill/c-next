#pragma once
#define LIVE_FEATURE
#if 0
void a_func(void);
#endif
#ifdef NOT_DEFINED_ANYWHERE
void b_func(void);
#endif
#if 1
static inline int c_func(void) { return 1; }
#endif
#ifdef LIVE_FEATURE
static inline int d_func(void) { return 2; }
#endif
