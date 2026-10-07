// Issue #1844: a C header that reaches a C++ one. A C compile of a file
// including this one meets the .hpp through it.
#pragma once

#include "external-cpp-type.hpp"

int external_reading(void);
