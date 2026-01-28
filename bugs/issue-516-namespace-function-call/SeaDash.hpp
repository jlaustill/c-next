#pragma once
#include <cstdint>

// Reproducer for issue #516: C++ namespace function calls
namespace SeaDash {
    namespace Parse {
        struct ParseResult {
            int data[8];
            int count;
            bool success;
        };

        ParseResult parse(const char* input, char delim);
    }
}
