#pragma once
#include <stdint.h>

namespace hw {
void bump_ns(uint32_t& v);
}
void put(uint32_t& v);
void put(uint8_t& v);
void show(const uint32_t& v);
void show(const uint8_t& v);
