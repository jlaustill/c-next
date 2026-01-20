# Changelog

All notable changes to c-next will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.12] - 2026-01-19

### Added

- E0908 flow analysis: detect nullable c\_ variables used without NULL check
- While loop condition tracking: `while (c_var != NULL)` marks variable as checked in body
- VS Code completion provider updates for recent language features
- E0905-E0907 errors for c\_ prefix validation (ADR-046)

### Changed

- Nullable C interop now uses c\_ prefix pattern (ADR-046 supersedes ADR-047)
- Functions like `fopen`, `strstr`, `getenv` now allowed with c\_ prefix storage

### Fixed

- C++ struct member arguments now use temp variables for correct compilation (#251, #252)
- C++ compound literals replaced with temp variables (#250)
- Function calls banned in boolean conditions per MISRA C:2012 Rule 13.5 (E0702)

## [0.1.7] - 2026-01-16

### Added

- C++14 typed enum support for `.length` property resolution (Issue #208)
- `detectCppSyntax.ts` utility for heuristic C++ syntax detection in headers
- Enum bit width storage in SymbolTable with cache persistence

### Changed

- Refactored header parsing from dual-parse (both C and C++ parsers) to single-parser strategy based on content detection
- Cache version bumped to 2 for enum bit width support
- Test infrastructure now detects C++14 headers and uses g++ appropriately
- Renamed test directory from `c-11-header` to `cpp14-header`

### Fixed

- `.length` property now correctly resolves typed enum widths (e.g., `enum EPressureType : uint8_t` → 8 bits)

## [0.1.6] - 2026-01-15

### Fixed

- Bitmap array element field access now generates valid C (Issue #201)

## [0.1.5] - 2026-01-14

### Changed

- Unified parsing is now the only mode - removed obsolete `--project` flag documentation (Issue #46)
- CLI help now shows directory mode (`cnext src/`) instead of non-existent project mode

### Added

- E0503 error when `#include` references implementation files (.c, .cpp, etc.)

## [0.1.1] - 2026-01-13

### Fixed

- GitHub Actions publish workflow now has correct permissions to create GitHub releases

## [0.1.0] - 2026-01-13

### Added

- Initial npm registry release
- C-Next transpiler with safety features (bounded strings, overflow protection)
- Support for C/C++ interoperability via unified ANTLR parsing
- CLI supporting single files, multiple files, and directory inputs
- PlatformIO integration
- 313 comprehensive test cases with validation pipeline
- MISRA C compliance checking
- ADR-based architecture documentation

### Known Issues

- 38 legacy ESLint errors (non-blocking, tracked for future cleanup)

[Unreleased]: https://github.com/jlaustill/c-next/compare/v0.1.7...HEAD
[0.1.7]: https://github.com/jlaustill/c-next/compare/v0.1.6...v0.1.7
[0.1.6]: https://github.com/jlaustill/c-next/compare/v0.1.5...v0.1.6
[0.1.5]: https://github.com/jlaustill/c-next/compare/v0.1.1...v0.1.5
[0.1.1]: https://github.com/jlaustill/c-next/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/jlaustill/c-next/releases/tag/v0.1.0
