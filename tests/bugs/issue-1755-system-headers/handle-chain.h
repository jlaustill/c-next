#ifndef HANDLE_CHAIN_H
#define HANDLE_CHAIN_H

typedef struct handle_s handle_raw_t;
typedef handle_raw_t handle_t;
typedef struct other_s other_t;

handle_t *handle_open(void);
int handle_close(handle_t *);
int other_close(other_t *);

#endif
