# Changelog

All notable changes to c-next will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.1] - 2026-01-13

### Fixed

- GitHub Actions publish workflow now has correct permissions to create GitHub releases

## [0.1.0] - 2026-01-13

### Added

- Initial npm registry release
- C-Next transpiler with safety features (bounded strings, overflow protection)
- Support for C/C++ interoperability via unified ANTLR parsing
- CLI with project mode and single-file mode
- PlatformIO integration
- 313 comprehensive test cases with validation pipeline
- MISRA C compliance checking
- ADR-based architecture documentation

### Known Issues

- Single-file mode doesn't parse C headers (Issue #45 partial - works in project mode)
- 38 legacy ESLint errors (non-blocking, tracked for future cleanup)

[Unreleased]: https://github.com/jlaustill/c-next/compare/v0.1.1...HEAD
[0.1.1]: https://github.com/jlaustill/c-next/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/jlaustill/c-next/releases/tag/v0.1.0
