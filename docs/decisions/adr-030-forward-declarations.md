# ADR-030: Forward Declarations

## Status
**Implemented**

## Context

Forward declarations are used in C for:
- Mutual recursion (function A calls B, B calls A)
- Opaque types (declare struct without defining)
- Header files (prototypes before definitions)
- Circular dependencies

This ADR investigates whether C-Next should support forward declarations or take a different approach.

## Research Findings

### Current Behavior Gap (2024-12-30)

Testing revealed that C-Next currently does NOT enforce define-before-use:

```cnx
void first() {
    second();  // Calls undefined function - no error from C-Next!
}

void second() { }
```

This transpiles successfully, but the generated C fails compilation because `second()` is called before it's declared. The error is caught by the C compiler, not C-Next.

### Implicit Function Declarations Are Dangerous

Research from [SEI CERT C Coding Standard (DCL31-C)](https://wiki.sei.cmu.edu/confluence/display/c/DCL31-C.+Declare+identifiers+before+using+them) and [CodeQL security analysis](https://codeql.github.com/codeql-query-help/cpp/cpp-implicit-function-declaration/):

**Security vulnerabilities:**
- Without a prototype, C assumes `int` return type and performs no type checking on arguments
- Passing wrong argument types/counts can override the stack (stack smashing)
- Attackers can exploit this to insert malicious code

**64-bit platform hazard:**
- Pointers implicitly converted to `int` get truncated from 64 to 32 bits
- This doesn't occur on 32-bit platforms where int and pointer are same size
- Results in corrupted pointer values and crashes

**Modern standards agree:**
- C23 requires type specifiers and forbids implicit function declarations
- [Clang 16+](https://www.redhat.com/en/blog/new-warnings-and-errors-clang-16) treats implicit declarations as errors by default
- [OpenSSF Compiler Hardening Guide](https://best.openssf.org/Compiler-Hardening-Guides/Compiler-Options-Hardening-Guide-for-C-and-C++.html) recommends `-Werror=implicit`

### Developer Confusion with Forward Declarations

From [Learn C++](https://www.learncpp.com/cpp-tutorial/forward-declarations/) and [developer forums](https://cplusplus.com/forum/beginner/122704/):

- Developers often confused about when to forward declare vs include headers
- Incomplete type errors when using forward-declared types incorrectly
- Declaration/definition signature mismatch bugs are common
- Circular header dependency tangles
- Forward declarations can hide dependencies, breaking when APIs change

### MISRA C Rules

[MISRA C:2012 Rule 8.2](https://www.mathworks.com/help/bugfinder/ref/misrac2012rule8.2.html): Functions shall be in prototype form with named parameters

- K&R style declarations are forbidden
- Parameters must be named for documentation and error detection
- Prototypes should be in header files, included by all source files

### Why Forward Declarations Exist in C

Forward declarations solve specific C problems:

1. **Single-pass compilation** - C compilers read top-to-bottom, need to know about functions before use
2. **Separate compilation** - Header files share declarations across translation units
3. **Mutual recursion** - Two functions that call each other need one declared first

However, these are **C compiler limitations**, not fundamental language requirements.

## Conclusions

### Define-Before-Use: Zero Exceptions

**C-Next enforces define-before-use with no exceptions:**

- Calling a function before it's defined = C-Next compile error
- No forward declaration syntax in C-Next source code
- This eliminates an entire class of bugs at the source level

**Rationale:**
- Catches errors at C-Next compile time, not C compile time or runtime
- Forces logical code organization (dependencies defined first)
- Eliminates declaration/definition mismatch bugs
- No developer confusion about when to use forward declarations
- Aligns with C-Next's philosophy: prevent errors by removal, not addition

### Generated Headers Handle C Compatibility

The C-Next transpiler generates `.h` files with prototypes for all functions:

```c
// generated: myfile.h
#ifndef MYFILE_H
#define MYFILE_H

void helper(void);
void doWork(uint32_t* value);
void main(void);

#endif
```

This provides C compatibility without exposing forward declaration complexity to C-Next developers.

### Parameters Are Always Named

C-Next requires named parameters in all function definitions (per MISRA C:2012 Rule 8.2):

```cnx
// C-Next: parameters must be named
void process(u8 data[]) {
    // Use data.length for size
}

// NOT allowed: unnamed parameters
// void process(u8[]) { }  // ERROR
```

Generated prototypes in `.h` files also include parameter names.

### Mutual Recursion

Without forward declarations, mutual recursion (A calls B, B calls A) is not possible in a single file. This is an intentional constraint:

- Mutual recursion is rare in embedded code
- When needed, split into separate files where header includes provide the declarations
- This forces better code organization

## Implementation Requirements

### 1. Add Define-Before-Use Check

Track defined functions during transpilation. When a function call is encountered:
- If function is not yet defined AND not in symbol table (external) = error
- Error message: `error[E0422]: function 'foo' called before definition`

### 2. Header Generation

Generate `.h` file with prototypes for all non-static functions:
- Include guards
- Named parameters (matching definition)
- C++ compatibility (`extern "C"`)

### 3. Parameter Name Enforcement

Grammar already requires parameter names. Verify CodeGenerator preserves them in output.

## Rejected Alternatives

### Forward Declaration Syntax

```cnx
// REJECTED: No forward declarations in C-Next
void processData(u8 buffer[]);
```

**Why rejected:**
- Adds complexity without sufficient benefit
- Developer confusion about when to use
- Declaration/definition mismatch bugs
- C-Next philosophy: remove features that cause bugs

### Auto-Generated Prototypes in .c File

Could generate prototypes at top of `.c` file to allow any order.

**Why rejected:**
- Hides errors (undefined function would still compile)
- Encourages poor code organization
- Doesn't catch typos in function names until link time

## References

### Security & Standards
- [SEI CERT C: DCL31-C - Declare identifiers before using them](https://wiki.sei.cmu.edu/confluence/display/c/DCL31-C.+Declare+identifiers+before+using+them)
- [CodeQL: Implicit function declaration](https://codeql.github.com/codeql-query-help/cpp/cpp-implicit-function-declaration/)
- [OpenSSF Compiler Hardening Guide](https://best.openssf.org/Compiler-Hardening-Guides/Compiler-Options-Hardening-Guide-for-C-and-C++.html)
- [Clang 16 implicit declaration changes](https://www.redhat.com/en/blog/new-warnings-and-errors-clang-16)

### MISRA C
- [MISRA C:2012 Rule 8.2 - Function prototypes with named parameters](https://www.mathworks.com/help/bugfinder/ref/misrac2012rule8.2.html)

### Developer Experience
- [Learn C++: Forward declarations](https://www.learncpp.com/cpp-tutorial/forward-declarations/)
- [Google C++ Style Guide](https://google.github.io/styleguide/cppguide.html)
