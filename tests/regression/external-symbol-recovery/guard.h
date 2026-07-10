/* Predecessor header. Mirrors FreeRTOS.h: defines the include guard, an empty
 * function-attribute macro (like PRIVILEGED_FUNCTION), and the macro that
 * expands to widget.h's API. Without this context widget.h has no declarations. */
#define WIDGET_GUARD 1
#define WIDGET_FEATURE 1
#define PRIVILEGED            /* expands to nothing, like PRIVILEGED_FUNCTION */
#define DECLARE_WIDGET_API                                        \
  typedef struct _widget_t widget_t;                              \
  typedef struct { int mode; } widget_cfg_t;                      \
  int widget_install(const widget_cfg_t *config) PRIVILEGED;      \
  widget_t *widget_create(void) PRIVILEGED;
