cmake_minimum_required(VERSION 3.14)
project(cnext_gtest VERSION 1.0.0 LANGUAGES C CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_C_STANDARD 11)

# Fetch GoogleTest
include(FetchContent)
FetchContent_Declare(
  googletest
  GIT_REPOSITORY https://github.com/google/googletest.git
  GIT_TAG v1.14.0
)
# For Windows: Prevent overriding the parent project's compiler/linker settings
set(gtest_force_shared_crt ON CACHE BOOL "" FORCE)
FetchContent_MakeAvailable(googletest)

enable_testing()
include(GoogleTest)

# Find cnext - check multiple locations
# 1. Locally built via npm (most common during development)
# 2. Globally installed via volta/npm
find_program(CNEXT_COMPILER
  NAMES cnext
  PATHS
    "${CMAKE_SOURCE_DIR}/../node_modules/.bin"
    "$ENV{HOME}/.volta/bin"
    "$ENV{HOME}/.npm/bin"
  DOC "C-Next transpiler"
)

if(NOT CNEXT_COMPILER)
  message(FATAL_ERROR "cnext compiler not found. Run 'npm install' in the project root first.")
endif()

message(STATUS "Found cnext: ${CNEXT_COMPILER}")

# Include directory for generated headers
set(CNEXT_INCLUDE_DIR "${CMAKE_SOURCE_DIR}/../tests/include")

# Function to add a C-Next test
# Usage: add_cnext_test(test_name)
# Expects: test_name.test.cnx and test_name_test.cpp in current directory
function(add_cnext_test TEST_NAME)
  set(CNX_FILE "${CMAKE_CURRENT_SOURCE_DIR}/${TEST_NAME}.test.cnx")
  set(GENERATED_C "${CMAKE_CURRENT_SOURCE_DIR}/${TEST_NAME}.test.c")
  set(GENERATED_H "${CMAKE_CURRENT_SOURCE_DIR}/${TEST_NAME}.test.h")
  set(TEST_WRAPPER "${CMAKE_CURRENT_SOURCE_DIR}/${TEST_NAME}_test.cpp")

  # Verify source files exist
  if(NOT EXISTS ${CNX_FILE})
    message(FATAL_ERROR "C-Next source not found: ${CNX_FILE}")
  endif()
  if(NOT EXISTS ${TEST_WRAPPER})
    message(FATAL_ERROR "GTest wrapper not found: ${TEST_WRAPPER}")
  endif()

  # Custom command: transpile .cnx -> .c/.h
  add_custom_command(
    OUTPUT ${GENERATED_C} ${GENERATED_H}
    COMMAND ${CNEXT_COMPILER} ${CNX_FILE}
    DEPENDS ${CNX_FILE}
    WORKING_DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR}
    COMMENT "Transpiling ${TEST_NAME}.test.cnx"
    VERBATIM
  )

  # Create test executable
  add_executable(${TEST_NAME}_test
    ${GENERATED_C}
    ${TEST_WRAPPER}
  )

  target_include_directories(${TEST_NAME}_test PRIVATE
    ${CMAKE_CURRENT_SOURCE_DIR}
    ${CNEXT_INCLUDE_DIR}
  )

  target_link_libraries(${TEST_NAME}_test GTest::gtest_main)

  # Register with CTest for auto-discovery
  gtest_discover_tests(${TEST_NAME}_test
    WORKING_DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR}
  )
endfunction()

# Function for C++ mode tests
function(add_cnext_cpp_test TEST_NAME)
  set(CNX_FILE "${CMAKE_CURRENT_SOURCE_DIR}/${TEST_NAME}.test.cnx")
  set(GENERATED_CPP "${CMAKE_CURRENT_SOURCE_DIR}/${TEST_NAME}.test.cpp")
  set(GENERATED_HPP "${CMAKE_CURRENT_SOURCE_DIR}/${TEST_NAME}.test.hpp")
  set(TEST_WRAPPER "${CMAKE_CURRENT_SOURCE_DIR}/${TEST_NAME}_test.cpp")

  # Custom command: transpile .cnx -> .cpp/.hpp (C++ mode)
  add_custom_command(
    OUTPUT ${GENERATED_CPP} ${GENERATED_HPP}
    COMMAND ${CNEXT_COMPILER} ${CNX_FILE} --cpp
    DEPENDS ${CNX_FILE}
    WORKING_DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR}
    COMMENT "Transpiling ${TEST_NAME}.test.cnx (C++ mode)"
    VERBATIM
  )

  add_executable(${TEST_NAME}_cpp_test
    ${GENERATED_CPP}
    ${TEST_WRAPPER}
  )

  target_include_directories(${TEST_NAME}_cpp_test PRIVATE
    ${CMAKE_CURRENT_SOURCE_DIR}
    ${CNEXT_INCLUDE_DIR}
  )

  target_link_libraries(${TEST_NAME}_cpp_test GTest::gtest_main)

  gtest_discover_tests(${TEST_NAME}_cpp_test
    WORKING_DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR}
    TEST_PREFIX "cpp_"
  )
endfunction()

# Add subdirectories for test categories
# add_subdirectory(cpp-entry)  # Will be added in next task
