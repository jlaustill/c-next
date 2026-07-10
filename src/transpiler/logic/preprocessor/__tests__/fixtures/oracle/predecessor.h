/* Predecessor header (mirrors FreeRTOS.h): defines the guard, a declaration
 * macro, and a function-like macro that dependent.h / callers rely on. */
#define PRED_GUARD 1
#define DECLARE_ORACLE_FN void oracle_fn(int x);
#define ORACLE_TICKS(ms) ((ms) / 10)
