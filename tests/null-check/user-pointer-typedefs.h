#ifndef USER_POINTER_TYPEDEFS_H
#define USER_POINTER_TYPEDEFS_H
/* #1610 review: C typedefs that name a pointer type but not a struct pointer */
typedef void *vhandle_t;
typedef int *intp_t;
typedef void (*isr_t)(void);

static int user_slot;
static void user_isr(void) {}
static inline vhandle_t user_handle(void) { return &user_slot; }
static inline intp_t user_int(void) { return &user_slot; }
static inline isr_t user_pick_isr(void) { return user_isr; }
#endif
