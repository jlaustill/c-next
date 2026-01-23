# Changelog

All notable changes to c-next will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.29] - 2026-01-23

### Fixed

- Struct param array member assignment now uses `->` instead of `.` for correct pointer access (PR #363)

### Documentation

- Added ADR-054 for array index overflow semantics with bounded string extension (PR #361, #362)
- Improved ADR accuracy based on Reddit feedback (PR #360)

## [0.1.28] - 2026-01-22

### Fixed

- PlatformIO library headers not discovered causing incorrect array member code generation (Issue #355, PR #358)
- FileDiscovery now includes `.pio/libdeps/` while excluding only `.pio/build/` artifacts
- IncludeDiscovery automatically searches `.pio/libdeps/<env>/<library>/` for headers when `platformio.ini` exists

## [0.1.27] - 2026-01-22

### Added

- `StructFieldAnalyzer` (E0355) rejects struct fields named `length` to prevent shadowing built-in `.length` property
- `SymbolUtils.ts` shared utilities for C/C++ symbol collectors (reduces code duplication)
- Warnings when C/C++ headers have fields that conflict with C-Next reserved property names

### Fixed

- Array member via pointer generates invalid `static_cast` in C++ mode (Issue #355)
- `CSymbolCollector.extractDeclaratorName()` now correctly handles recursive `directDeclarator` nodes for array fields

## [0.1.26] - 2026-01-22

### Added

- Test coverage for named typedef struct array member pattern (Issue #347)

### Fixed

- Generate int return type for main() in header files
- Angle-bracket CNX includes with `--header-out` now get correct directory prefix (Issue #349)
- CLI now shows helpful error for unrecognized flags like `-I`

### Documentation

- Removed status markers from learn-cnext-in-y-minutes.md
- Fixed enum and nested struct syntax examples in learn-cnext doc

## [0.1.25] - 2026-01-22

### Added

- VS Code extension: code snippets for common C-Next patterns
- VS Code extension: file nesting for generated `.c`/`.h` files under source `.cnx`
- VS Code extension: formatter defaults and roadmap documentation

### Fixed

- Array member arguments from typedef'd C++ structs now pass correctly (Issue #342)
- Use relative paths for self-includes with `--header-out` option (Issue #339)

## [0.1.24] - 2026-01-22

### Fixed

- `-o` and `--header-out` now preserve directory structure instead of flattening (Issue #337)

## [0.1.23] - 2026-01-22

### Fixed

- Add `&` operator for C-Next structs passed to external pointer params (Issue #332)
- Deduplicate files when scanning overlapping include paths (Issue #331)

## [0.1.22] - 2026-01-22

### Fixed

- False symbol conflict with C-Next generated headers during incremental migration (Issue #328)

## [0.1.21] - 2026-01-22

### Added

- Cross-file execution test support in test runner
- Validation for incorrect test-execution marker format
- VS Code extension: source traceability in hover tooltips

### Fixed

- Auto address-of for external C++ functions with pointer params (Issue #322)
- Recursive include processing for nested header symbols (Issue #321)
- Use `.` instead of `::` for global object instance method calls

## [0.1.20] - 2026-01-21

### Added

- E0504 error for `.h` includes when `.cnx` alternative exists (PR #316)

### Fixed

- Pass primitive struct members by value in cross-file calls (Issue #315, PR #318)
- Use `::` syntax for `global.X.method()` in C++ mode (Issue #314, PR #317)

## [0.1.19] - 2026-01-21

### Added

- `releasing.md` - comprehensive release process documentation

### Changed

- CHANGELOG.md backfilled with entries for v0.1.8-v0.1.18
- ADR-046 status updated to Implemented
- ADR-047 status updated to Superseded (by ADR-046)
- README.md ADR table updated with ADR-046 and ADR-047 status notes

## [0.1.18] - 2026-01-21

### Fixed

- Use `{}` instead of `{0}` for unknown C++ types (Issue #309)
- Don't add `&` to struct member arrays in function args (Issue #308)

## [0.1.17] - 2026-01-20

### Added

- Vitest unit tests to PR checks workflow

### Fixed

- C++ enum class → integer conversions with `static_cast` (Issue #304)
- Generate C++ scope resolution syntax (`::`) for C++ symbols
- Use `{}` for C++ types initialization
- Cross-file scope function calls converted to underscore notation (Issue #294)
- Cross-scope calls from included files now properly validated
- Use named structs for forward declaration compatibility (Issue #296)
- Use value initialization `{}` for C++ template types (Issue #295)

### Changed

- Refactored `wrapWithCppEnumCast` and `getScopeSeparator` helpers

## [0.1.16] - 2026-01-20

### Added

- C++ template syntax parsing support (Issue #291)
- `Template<T>` patterns now recognized in extern declarations

### Changed

- VS Code extension v0.0.7: template syntax and c\_ interop highlighting

## [0.1.15] - 2026-01-20

### Fixed

- Include `const` qualifier in extern declarations for public const variables (Issue #288)

## [0.1.14] - 2026-01-20

### Fixed

- lowByte header signature regression (Issue #280)
- Multi-file header pass-by-value params handling
- Scope functions correctly omit const for modified pointer params
- Inline scope const values instead of generating local variables (Issue #282)

## [0.1.13] - 2026-01-20

### Added

- Pass-by-value for small unmodified primitives (Issue #269)
- Auto-const inference for unmodified pointer parameters (Issue #268)
- RATS static analysis integration (Issue #271)
- Flawfinder CWE-based security scanner (Issue #270)
- C++ casts (`static_cast`, `reinterpret_cast`) when cppMode enabled (Issue #267)

### Changed

- ADR-013 updated to document auto-const inference feature

### Fixed

- Handle switch and critical statements in pass-by-value analysis

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

## [0.1.11] - 2026-01-19

### Fixed

- Cast string subscripts to integer pointer types (Issue #246)
- Wrap rvalue expressions in compound literals for pointer params (Issue #245)

## [0.1.10] - 2026-01-18

### Added

- Compile-time slice assignment validation - silent overflows now errors (Issue #234)
- Constant folding for arithmetic expressions (Issue #235)
- Self-include for `extern "C"` linkage in generated headers (Issue #230)

### Changed

- Shared test utilities extracted into `test-utils.ts`
- Scope variable persistence semantics clarified (Issue #233)

### Fixed

- GCC `-Wstringop-overflow` false positive in overflow helpers (Issue #231)
- Scope variable reentrancy - single-function vars become local (Issue #232)

## [0.1.9] - 2026-01-17

### Added

- Prettier plugin for C-Next language formatting
- TypeScript type checking to CI workflow (Issue #224)
- Header type generator infrastructure (Issue #220)

### Changed

- Test markers converted from block to line comments (`// test-execution`)

### Fixed

- Function parameters being treated as global symbols (Issue #221)
- Reserved parameter naming pattern validation (Issue #227)
- Scope variable static/extern mismatch in C++ headers (Issue #218)

## [0.1.8] - 2026-01-17

### Added

- Auto-detect C++ features and output `.cpp` by default (Issue #211)

### Fixed

- Scope helper methods with string parameters generating bitwise ops (Issue #213)
- Scope variable named 'length' conflicting with `.length` property accessor (Issue #212)

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

[Unreleased]: https://github.com/jlaustill/c-next/compare/v0.1.29...HEAD
[0.1.29]: https://github.com/jlaustill/c-next/compare/v0.1.28...v0.1.29
[0.1.28]: https://github.com/jlaustill/c-next/compare/v0.1.27...v0.1.28
[0.1.27]: https://github.com/jlaustill/c-next/compare/v0.1.26...v0.1.27
[0.1.26]: https://github.com/jlaustill/c-next/compare/v0.1.25...v0.1.26
[0.1.25]: https://github.com/jlaustill/c-next/compare/v0.1.24...v0.1.25
[0.1.24]: https://github.com/jlaustill/c-next/compare/v0.1.23...v0.1.24
[0.1.23]: https://github.com/jlaustill/c-next/compare/v0.1.22...v0.1.23
[0.1.22]: https://github.com/jlaustill/c-next/compare/v0.1.21...v0.1.22
[0.1.21]: https://github.com/jlaustill/c-next/compare/v0.1.20...v0.1.21
[0.1.20]: https://github.com/jlaustill/c-next/compare/v0.1.19...v0.1.20
[0.1.19]: https://github.com/jlaustill/c-next/compare/v0.1.18...v0.1.19
[0.1.18]: https://github.com/jlaustill/c-next/compare/v0.1.17...v0.1.18
[0.1.17]: https://github.com/jlaustill/c-next/compare/v0.1.16...v0.1.17
[0.1.16]: https://github.com/jlaustill/c-next/compare/v0.1.15...v0.1.16
[0.1.15]: https://github.com/jlaustill/c-next/compare/v0.1.14...v0.1.15
[0.1.14]: https://github.com/jlaustill/c-next/compare/v0.1.13...v0.1.14
[0.1.13]: https://github.com/jlaustill/c-next/compare/v0.1.12...v0.1.13
[0.1.12]: https://github.com/jlaustill/c-next/compare/v0.1.11...v0.1.12
[0.1.11]: https://github.com/jlaustill/c-next/compare/v0.1.10...v0.1.11
[0.1.10]: https://github.com/jlaustill/c-next/compare/v0.1.9...v0.1.10
[0.1.9]: https://github.com/jlaustill/c-next/compare/v0.1.8...v0.1.9
[0.1.8]: https://github.com/jlaustill/c-next/compare/v0.1.7...v0.1.8
[0.1.7]: https://github.com/jlaustill/c-next/compare/v0.1.6...v0.1.7
[0.1.6]: https://github.com/jlaustill/c-next/compare/v0.1.5...v0.1.6
[0.1.5]: https://github.com/jlaustill/c-next/compare/v0.1.1...v0.1.5
[0.1.1]: https://github.com/jlaustill/c-next/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/jlaustill/c-next/releases/tag/v0.1.0
