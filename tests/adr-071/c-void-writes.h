#pragma once
#include <stdint.h>
#include <stddef.h>

void zero_bytes(void* p, size_t n);
void read_bytes(const void* p, size_t n);
