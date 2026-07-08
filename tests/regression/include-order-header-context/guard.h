/* Predecessor header. Mirrors FreeRTOS.h: defines the include guard AND the
 * macro that expands to dependent.h's declaration. Without this context,
 * dependent.h contains no `dependent_fn` declaration at all. */
#define DEP_GUARD 1
#define DEP_FEATURE 1
#define DECLARE_DEP void dependent_fn(int x);
