/**
 * Third-party C header for #1545's arity case. The typedef declares ONE
 * parameter; the C-Next handler below declares two, so its second parameter is
 * one the typedef says nothing about.
 *
 * That assignment is ill-formed C and the developer's own error. What is
 * C-Next's error is what it did with it: the body suppressed auto-const per
 * PARAMETER (the typedef describes index 0 and not index 1) while the header
 * suppressed per FUNCTION, so the definition contradicted its own prototype
 * and the file did not compile for a reason the developer never wrote.
 */

#ifndef ARITY_API_H
#define ARITY_API_H

typedef void (*short_cb_t)(char *);

static inline void register_short(short_cb_t handler) {
    (void)handler;
}

#endif /* ARITY_API_H */
