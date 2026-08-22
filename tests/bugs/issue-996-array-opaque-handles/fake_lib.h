/**
 * Issue #996: Array of opaque handles
 *
 * Opaque handle pattern where the struct is incomplete (never defined
 * in the header). `widget_t` is the opaque struct type; the library
 * hands back `widget_t*` handles.
 */
#ifndef FAKE_LIB_H
#define FAKE_LIB_H

typedef struct _widget widget_t;

widget_t* widget_create(void);
void widget_move(widget_t* w, int x);

#endif /* FAKE_LIB_H */
