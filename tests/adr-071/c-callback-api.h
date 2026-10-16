#ifndef C_CALLBACK_API_H
#define C_CALLBACK_API_H

typedef struct {
    int value;
} Reading;

typedef void (*WritingHandler)(Reading *);
typedef void (*ReadingHandler)(const Reading *);

static inline void on_write(WritingHandler handler) { (void)handler; }
static inline void on_read(ReadingHandler handler) { (void)handler; }

#endif
