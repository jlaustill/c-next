<!-- GENERATED FILE - DO NOT EDIT.
     Source: src/transpiler/constants/TOOLCHAIN_REQUIREMENTS.ts
     Regenerate: npm run docs:toolchain -->

# Toolchain compatibility

## Policy

C-Next's toolchain requirements are **per-feature, not global**.

The baseline is C99 (C++11 with `--cpp`), and code that uses none of the
features below really does compile with any conforming compiler. Each
feature listed here adds a requirement _only to files that use it_: you pay
for CMSIS only if you write a critical section, and for C11 only if you index
the bits of a float.

This file is generated from the transpiler's own requirements registry, so it
cannot fall out of step with what the code generator emits. To see what _your_
project needs -- as opposed to what C-Next might need -- transpile it: the
requirements are reported at the end of the run.

## Baseline

| transpile mode | language standard | compiler       | platform library |
| -------------- | ----------------- | -------------- | ---------------- |
| C (default)    | C99               | any conforming | none             |
| C++ (`--cpp`)  | C++11             | any conforming | none             |

## Conditional requirements

| feature                  | you pay it when                                                           | mode   | language standard      | compiler                         | platform library | emitted                                                 |
| ------------------------ | ------------------------------------------------------------------------- | ------ | ---------------------- | -------------------------------- | ---------------- | ------------------------------------------------------- | ------------ | -------------------------------------------------------------------- |
| float bit indexing       | reading or writing a bit range of an f32 or f64                           | c      | C11                    | any conforming                   | none             | `_Static_assert`                                        |
| float bit indexing       | reading or writing a bit range of an f32 or f64 with --cpp                | cpp    | C++11                  | any conforming                   | none             | `static_assert`                                         |
| critical section         | a critical block, and `defined(**arm**) \\                                | \\     | defined(\_\_ARM_ARCH)` | c, cpp                           | C99              | `GNU inline assembly`, `__attribute__((always_inline))` | ARMv7-M core | `__asm volatile ("MRS %0, primask"), __attribute__((always_inline))` |
| critical section         | a critical block, and `defined(__arm__) && defined(ARDUINO)`              | c, cpp | C99                    | any conforming                   | Arduino core     | `noInterrupts()`                                        |
| critical section         | a critical block, and `defined(__AVR__)`                                  | c, cpp | C99                    | any conforming                   | avr-libc         | `SREG, cli()`                                           |
| critical section         | a critical block, and `neither ARM nor AVR`                               | c, cpp | C99                    | any conforming                   | CMSIS            | `__disable_irq(), __get_PRIMASK(), __set_PRIMASK()`     |
| atomic read-modify-write | compound assignment to an atomic variable on a target with LDREX/STREX    | c, cpp | C99                    | any conforming                   | CMSIS + ARMv7-M  | `__LDREXB/H/W, __STREXB/H/W`                            |
| atomic read-modify-write | compound assignment to an atomic variable on a target without LDREX/STREX | c, cpp | C99                    | any conforming                   | CMSIS            | `__get_PRIMASK(), __disable_irq(), __set_PRIMASK()`     |
| struct initializer       | initializing a struct in --cpp mode                                       | cpp    | C++20                  | `designated initializers in C++` | none             | `.field = value inside a braced initializer`            |
| struct initializer       | a non-declaration struct literal in --cpp mode                            | cpp    | C++11                  | `compound literals in C++`       | none             | `(T){ ... } in C++`                                     |
| overflow panic (--debug) | transpiling with --debug and using a clamp type                           | c, cpp | C99                    | any conforming                   | hosted libc      | `fprintf(stderr, ...), abort()`                         |

## Compiler version floors

**None.** No construct C-Next emits has a minimum compiler version.

C-Next previously required GCC 5+ / Clang 3.8+ wherever an unsigned `clamp`
helper was emitted, because those helpers called `__builtin_add_overflow` and
friends. Those calls were unreachable -- the preceding range check is already
a complete overflow test -- and were removed in #1143.

## Compiler extensions

These are not standard C or C++. GCC and Clang accept them; IAR, TI CGT,
Keil and MSVC may not.

| extension                                               | used by            | emitted                                                              |
| ------------------------------------------------------- | ------------------ | -------------------------------------------------------------------- |
| `GNU inline assembly`, `__attribute__((always_inline))` | critical section   | `__asm volatile ("MRS %0, primask"), __attribute__((always_inline))` |
| `designated initializers in C++`                        | struct initializer | `.field = value inside a braced initializer`                         |
| `compound literals in C++`                              | struct initializer | `(T){ ... } in C++`                                                  |

## Platform libraries

| library         | feature                  | selected when                               | emitted                                                              |
| --------------- | ------------------------ | ------------------------------------------- | -------------------------------------------------------------------- |
| ARMv7-M core    | critical section         | `defined(__arm__) \|\| defined(__ARM_ARCH)` | `__asm volatile ("MRS %0, primask"), __attribute__((always_inline))` |
| Arduino core    | critical section         | `defined(__arm__) && defined(ARDUINO)`      | `noInterrupts()`                                                     |
| avr-libc        | critical section         | `defined(__AVR__)`                          | `SREG, cli()`                                                        |
| CMSIS           | critical section         | `neither ARM nor AVR`                       | `__disable_irq(), __get_PRIMASK(), __set_PRIMASK()`                  |
| CMSIS + ARMv7-M | atomic read-modify-write | always                                      | `__LDREXB/H/W, __STREXB/H/W`                                         |
| CMSIS           | atomic read-modify-write | always                                      | `__get_PRIMASK(), __disable_irq(), __set_PRIMASK()`                  |
| hosted libc     | overflow panic (--debug) | always                                      | `fprintf(stderr, ...), abort()`                                      |

## MISRA C:2012 guidelines affected

See [misra-compliance.md](misra-compliance.md) for the full assessment.

| guideline | features that bear on it                   |
| --------- | ------------------------------------------ |
| 1.1       | baseline, float bit indexing               |
| 1.2       | critical section, struct initializer       |
| 20.8      | critical section                           |
| 20.9      | critical section                           |
| 20.14     | critical section                           |
| 21.6      | overflow panic (--debug)                   |
| 21.8      | overflow panic (--debug)                   |
| Dir 4.3   | critical section                           |
| Dir 4.9   | critical section, atomic read-modify-write |
