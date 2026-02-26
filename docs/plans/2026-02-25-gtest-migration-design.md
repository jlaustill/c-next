# Google Test Migration Design

**Date:** 2026-02-25
**Status:** Draft

## Problem Statement

The current custom test framework in `/scripts/test.ts` is ~1200 lines of TypeScript that:

- Requires maintenance as C-Next evolves
- Has limited features compared to mature frameworks
- Creates a learning curve for contributors
- Duplicates functionality that exists in battle-tested tools

## Proposed Solution

Migrate to [Google Test](https://google.github.io/googletest/) with CMake, using `add_custom_command` to run the C-Next transpiler as a code generation step before compilation.

## Architecture

```
tests/
├── led/
│   ├── led.test.cnx          # C-Next source
│   └── led_test.cpp          # GTest wrapper (minimal)
├── CMakeLists.txt
└── ...

Build flow:
1. CMake configures project
2. For each .test.cnx, add_custom_command runs: cnext file.test.cnx
3. Generated .test.c/.test.h are compiled
4. GTest links and runs tests
5. ctest or gtest runs test discovery
```

## CMake Pattern

### Basic Custom Command for Transpilation

```cmake
# Function to add a C-Next test
function(add_cnext_test TEST_NAME CNX_FILE)
  # Get paths
  get_filename_component(CNX_DIR ${CNX_FILE} DIRECTORY)
  get_filename_component(CNX_BASE ${CNX_FILE} NAME_WE)

  set(GENERATED_C "${CNX_DIR}/${CNX_BASE}.c")
  set(GENERATED_H "${CNX_DIR}/${CNX_BASE}.h")

  # Custom command: transpile .cnx -> .c/.h
  add_custom_command(
    OUTPUT ${GENERATED_C} ${GENERATED_H}
    COMMAND cnext ${CNX_FILE}
    DEPENDS ${CNX_FILE}
    WORKING_DIRECTORY ${CNX_DIR}
    COMMENT "Transpiling ${CNX_FILE}"
  )

  # Create test executable
  add_executable(${TEST_NAME}
    ${GENERATED_C}
    ${CNX_DIR}/${TEST_NAME}.cpp  # GTest wrapper
  )

  target_link_libraries(${TEST_NAME} GTest::gtest_main)

  # Register with CTest
  gtest_discover_tests(${TEST_NAME})
endfunction()
```

### Full CMakeLists.txt Example

```cmake
cmake_minimum_required(VERSION 3.14)
project(cnext_tests)

set(CMAKE_CXX_STANDARD 17)

# Find or fetch GoogleTest
include(FetchContent)
FetchContent_Declare(
  googletest
  URL https://github.com/google/googletest/archive/refs/tags/v1.14.0.zip
)
FetchContent_MakeAvailable(googletest)

enable_testing()
include(GoogleTest)

# Find cnext binary (installed globally or local)
find_program(CNEXT_COMPILER cnext REQUIRED)

# Function to add C-Next test
function(add_cnext_test TEST_NAME)
  set(CNX_FILE "${CMAKE_CURRENT_SOURCE_DIR}/${TEST_NAME}.test.cnx")
  set(GENERATED_C "${CMAKE_CURRENT_SOURCE_DIR}/${TEST_NAME}.test.c")
  set(GENERATED_H "${CMAKE_CURRENT_SOURCE_DIR}/${TEST_NAME}.test.h")

  # Transpile .cnx to .c/.h
  add_custom_command(
    OUTPUT ${GENERATED_C} ${GENERATED_H}
    COMMAND ${CNEXT_COMPILER} ${CNX_FILE}
    DEPENDS ${CNX_FILE}
    WORKING_DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR}
    COMMENT "Transpiling ${TEST_NAME}.test.cnx"
    VERBATIM
  )

  # Test executable
  add_executable(${TEST_NAME}_test
    ${GENERATED_C}
    ${TEST_NAME}_test.cpp
  )

  target_include_directories(${TEST_NAME}_test PRIVATE ${CMAKE_CURRENT_SOURCE_DIR})
  target_link_libraries(${TEST_NAME}_test GTest::gtest_main)

  gtest_discover_tests(${TEST_NAME}_test)
endfunction()

# Add tests
add_cnext_test(led)
add_cnext_test(scope)
add_cnext_test(enum)
# ... etc
```

## Test File Structure

### C-Next Source: `led.test.cnx`

```c-next
scope LED {
  u8 state <- 0;

  public void on() {
    state <- 1;
  }

  public void off() {
    state <- 0;
  }

  public u8 getState() {
    return state;
  }
}
```

### GTest Wrapper: `led_test.cpp`

```cpp
#include <gtest/gtest.h>

// Include the generated C-Next header
extern "C" {
#include "led.test.h"
}

TEST(LEDTest, InitialStateIsOff) {
  EXPECT_EQ(LED_getState(), 0);
}

TEST(LEDTest, TurnOn) {
  LED_on();
  EXPECT_EQ(LED_getState(), 1);
}

TEST(LEDTest, TurnOff) {
  LED_on();
  LED_off();
  EXPECT_EQ(LED_getState(), 0);
}
```

### Build & Run

```bash
# Configure
cmake -B build -S tests

# Build (triggers transpilation automatically)
cmake --build build

# Run tests
ctest --test-dir build --output-on-failure

# Or run specific test with verbose output
./build/led_test --gtest_filter="LEDTest.*"
```

## Handling C vs C++ Mode

For tests that need to verify both C and C++ output:

```cmake
function(add_cnext_dual_test TEST_NAME)
  # C mode
  add_custom_command(
    OUTPUT ${TEST_NAME}.c ${TEST_NAME}.h
    COMMAND ${CNEXT_COMPILER} ${TEST_NAME}.test.cnx
    DEPENDS ${TEST_NAME}.test.cnx
    COMMENT "Transpiling ${TEST_NAME} (C mode)"
  )

  # C++ mode
  add_custom_command(
    OUTPUT ${TEST_NAME}.cpp.out ${TEST_NAME}.hpp
    COMMAND ${CNEXT_COMPILER} ${TEST_NAME}.test.cnx --cpp
    DEPENDS ${TEST_NAME}.test.cnx
    COMMENT "Transpiling ${TEST_NAME} (C++ mode)"
  )

  # C test executable
  add_executable(${TEST_NAME}_c_test ...)

  # C++ test executable
  add_executable(${TEST_NAME}_cpp_test ...)
endfunction()
```

## Error Tests

For tests expecting compilation errors:

```cmake
function(add_cnext_error_test TEST_NAME EXPECTED_ERROR)
  add_test(
    NAME ${TEST_NAME}_error
    COMMAND ${CMAKE_COMMAND} -E env
      ${CNEXT_COMPILER} ${TEST_NAME}.test.cnx
  )

  set_tests_properties(${TEST_NAME}_error PROPERTIES
    WILL_FAIL TRUE
    FAIL_REGULAR_EXPRESSION "${EXPECTED_ERROR}"
  )
endfunction()

# Usage
add_cnext_error_test(invalid-syntax "E0001")
```

## Snapshot Testing

For verifying generated output matches expected:

```cmake
function(add_cnext_snapshot_test TEST_NAME)
  add_test(
    NAME ${TEST_NAME}_snapshot
    COMMAND ${CMAKE_COMMAND} -E compare_files
      ${TEST_NAME}.test.c
      ${TEST_NAME}.expected.c
  )
endfunction()
```

## PlatformIO Integration

PlatformIO uses its own build system but can integrate with external test runners:

```ini
; platformio.ini
[env:native]
platform = native
test_framework = googletest

; Pre-build script to run cnext
extra_scripts = pre:transpile_cnext.py
```

```python
# transpile_cnext.py
Import("env")
import subprocess
import glob

for cnx_file in glob.glob("test/**/*.test.cnx", recursive=True):
    subprocess.run(["cnext", cnx_file], check=True)
```

## Migration Path

### Phase 1: Parallel Infrastructure

1. Create `tests-gtest/` directory with CMake setup
2. Port 5-10 representative tests
3. Verify parity with current test framework

### Phase 2: Incremental Migration

1. Port tests category by category
2. Keep old framework running for comparison
3. Update CI to run both

### Phase 3: Deprecation

1. Remove old test framework
2. Update CLAUDE.md and docs
3. Simplify CI configuration

## Benefits

| Aspect                 | Current                       | GTest + CMake            |
| ---------------------- | ----------------------------- | ------------------------ |
| Maintenance            | ~1200 lines custom TypeScript | 0 lines (use upstream)   |
| Test discovery         | Custom implementation         | `gtest_discover_tests()` |
| Parallel execution     | Custom worker pool            | Built-in                 |
| Filtering              | Custom flags                  | `--gtest_filter`         |
| IDE integration        | None                          | VS Code, CLion native    |
| CI integration         | Custom                        | Native GitHub Actions    |
| Contributor onboarding | Learn custom framework        | Already know GTest       |

## Open Questions

1. **Test migration effort**: How many of the 950 tests can be auto-converted?
2. **Execution tests**: Current framework compiles and runs the generated code. Need equivalent in GTest.
3. **MISRA validation**: Current framework runs cppcheck. Add as separate CMake target?

## References

- [GoogleTest CMake Quickstart](https://google.github.io/googletest/quickstart-cmake.html)
- [CMake add_custom_command](https://cmake.org/cmake/help/latest/command/add_custom_command.html)
- [CMake GoogleTest Module](https://cmake.org/cmake/help/latest/module/GoogleTest.html)
