# CMSIS-Core, vendored

`cmsis_gcc.h` is ARM's CMSIS-Core header for GCC, copied unchanged from the
[CMSIS_5](https://github.com/ARM-software/CMSIS_5) repository at tag `5.9.0`
(`CMSIS/Core/Include/cmsis_gcc.h`, file version V5.4.1). `LICENSE.txt` is that
repository's license, Apache-2.0.

| file          | sha256                                                             |
| ------------- | ------------------------------------------------------------------ |
| `cmsis_gcc.h` | `43bfd1fe69fbbc2ca70aaf7d43cc3e20f16e0c7f66e1bdef9b51af6dc14b2617` |
| `LICENSE.txt` | `b40930bbcf80744c86c46a12bc9da056641d722716c378f5659b9e555ef833e1` |

## Why it is here

The test harness compiles every fixture for a Cortex-M target as well as the
host (#1668's target matrix). Generated code for a Cortex-M target calls the
CMSIS intrinsics (`__LDREXW`, `__get_PRIMASK`, ...), so that compile needs
their declarations. The owner ruled on 2026-09-26 that they come from the real
header, "as newlib and avr-libc do": no Linux distribution packages CMSIS-Core,
so it is vendored.

The real header is what makes the check able to fail. CMSIS declares the
exclusive-access intrinsics only for architectures that have them, so a target
that falsely claimed LDREX/STREX fails to compile. A stub that declared them for
every CPU let ARMv6-M code with `__LDREXW` compile cleanly for a Cortex-M0+.

## Updating

Replace both files from a newer CMSIS release, update the tag, file version and
checksums above, and run the integration tests: the Cortex-M cells compile
against this header.
