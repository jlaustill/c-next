/**
 * Fake C library header for issue #986 test
 * C APIs expect mutable buffers for write operations
 */

#ifndef FAKE_LIB_H
#define FAKE_LIB_H

#include <stdint.h>

// C API expecting mutable array for write operations
void process_data(uint8_t data[8]);

#endif
