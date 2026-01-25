#pragma once
#include <cstdint>

// Nested namespace with a type - reproducer for issue #388
namespace MockLib {
    namespace Parse {
        struct ParseResult {
            int data[8];
            int count;
            bool success;
        };

        ParseResult parse(const char* input, char delim);
    }

    // Type at first level for comparison
    struct Config {
        int timeout;
        bool enabled;
    };

    Config getDefaultConfig();
}

// Triple-nested namespace to test deeper nesting
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
