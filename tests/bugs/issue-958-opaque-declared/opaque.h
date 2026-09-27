#ifndef OPAQUE_H
#define OPAQUE_H

/* #958: an opaque handle -- the struct's body is never visible to C-Next. */
typedef struct widget widget_t;

widget_t *widget_create(void);
void widget_use(widget_t *w);

#endif
