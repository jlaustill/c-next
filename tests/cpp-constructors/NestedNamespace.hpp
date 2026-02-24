// Test helper: Nested namespace C++ classes with constructors
#pragma once

#ifdef __cplusplus
namespace Outer {
    namespace Inner {
        class Widget {
        public:
            Widget() : x(0), y(0) {}  // User-defined constructor
            int x;
            int y;
        };
    }
}
#else
// C version for syntax checking - uses underscore naming
typedef struct {
    int x;
    int y;
} Outer_Inner_Widget;
#endif
