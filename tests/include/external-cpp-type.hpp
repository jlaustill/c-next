// Stub header for Issue #309 test
// This simulates an external C++ type that the transpiler doesn't parse
// but the compiler needs for syntax checking
#pragma once

#ifdef __cplusplus
// C++ version with constructor (what the real external type would have)
struct ExternalCppType {
    int code;
    const char* message;

    ExternalCppType() : code(0), message(nullptr) {}
    explicit ExternalCppType(int c) : code(c), message(nullptr) {}
};
#else
// C version for GCC syntax checking (plain struct)
typedef struct {
    int code;
    const char* message;
} ExternalCppType;
#endif
