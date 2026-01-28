#pragma once
#include <cstdint>

// Test header for issue #516: C++ namespace function calls
namespace SeaDash {
    namespace Parse {
        struct ParseResult {
            int data[8];
            int count;
            bool success;
        };

        // Function declaration in nested namespace
        ParseResult parse(const char* input, char delim);
    }

    // Single-level namespace type and function
    struct Config {
        int timeout;
        bool enabled;
    };

    Config getDefaultConfig();
}

// Triple-nested namespace to test deep nesting
namespace Deep {
    namespace Level1 {
        namespace Level2 {
            struct DeepType {
                int value;
            };

            DeepType create(int val);
        }
    }
}
