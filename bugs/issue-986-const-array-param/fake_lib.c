/**
 * Implementation of fake C library for issue #986 test
 */

#include "fake_lib.h"

void process_data(uint8_t data[8]) {
    data[0] = 0xAA;
    data[1] = 0xBB;
}
