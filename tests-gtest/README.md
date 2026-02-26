# C-Next Google Test Suite

This directory contains C-Next tests using Google Test framework.

## Prerequisites

- CMake 3.14+
- C++17 compiler (gcc, clang, or MSVC)
- Node.js (for cnext transpiler)

## Building and Running Tests

```bash
# From project root, ensure cnext is built
npm install
npm run build

# Configure CMake (from tests-gtest directory)
cd tests-gtest
cmake -B build

# Build tests (this transpiles .cnx files automatically)
cmake --build build

# Run all tests
ctest --test-dir build --output-on-failure

# Run specific test
./build/led_test

# Run with filter
./build/led_test --gtest_filter="LEDTest.*"
```

## Adding New Tests

1. Create `mytest.test.cnx` with your C-Next code
2. Create `mytest_test.cpp` with GTest assertions:

```cpp
#include <gtest/gtest.h>

extern "C" {
#include "mytest.test.h"
}

TEST(MyTest, SomeFeature) {
  // Call generated C functions
  EXPECT_EQ(MyScope_getValue(), 42);
}
```

3. Add to CMakeLists.txt or subdirectory CMakeLists.txt:

```cmake
add_cnext_test(mytest)
```

## Test Functions

- `add_cnext_test(name)` - C mode test
- `add_cnext_cpp_test(name)` - C++ mode test
