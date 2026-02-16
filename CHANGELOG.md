# Changelog

All notable changes to c-next will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.0] - 2026-02-16

### Changed

- **Milestone**: OSSM (Open Source Syringe Manager) completely rewritten in C-Next and working
- Extend ADR-105 with automatic filename-based namespacing documentation

## [0.1.72] - 2026-02-14

### Fixed

- Make symbol conflict detector scope-aware so symbols in different scopes don't trigger false positive conflicts (Issue #817, PR #818)

### Changed

- Extract `groupCNextSymbolsByScopeAndKind` helper method for cleaner conflict detection logic
- Remove unused `skipConflictCheck` field from `IPipelineInput`

## [0.1.71] - 2026-02-14

### Changed

- Complete ADR-055 Phase 7: Remove legacy ISymbol type system (PR #814, #815)
- Extract TypeRegistrationEngine from CodeGenerator for cleaner architecture (Issue #791)

### Fixed

- Remove redundant undefined argument in resolveBaseType (PR #815)
- Move TypeRegistrationEngine to output/codegen/helpers for architecture compliance (PR #814)

## [0.1.70] - 2026-02-13

### Fixed

- Cross-file enum and function resolution bugs (Issue #786, PR #788)

### Added

- Suggest `global.` prefix when E0422 error would resolve with it (Issue #787, PR #788)

### Changed

- Extract PassByValueAnalyzer from CodeGenerator (-570 lines) (PR #789)
- Move analysis helpers to logic layer for architecture compliance (PR #789)
- Flatten STDLIB_FUNCTIONS to eliminate SonarCloud duplication (PR #790)

## [0.1.69] - 2026-02-12

### Fixed

- Platform-portable IRQ wrappers for critical sections - fixes Teensy 4.0 compilation (Issue #778, PR #782)
- Array member access without `this.` now resolves to scope prefix (Issue #779, PR #780)

### Changed

- Remove dead `GeneratorContext` class and compute unmodified params on-demand (PR #781)
- Make `CodeGenState.scopeMembers` private with accessor methods for encapsulation

## [0.1.68] - 2026-02-12

### Fixed

- Allow enum access inside scopes without `global.` prefix when unambiguous (Issue #774, PR #775)
- Improved error message for enum shadowing conflicts suggests using `global.EnumName.Member`

### Changed

- Consolidate logic layer state into `CodeGenState` — external struct fields now built once per run (PR #776)
- Remove `AnalyzerContextBuilder` class — logic moved to `CodeGenState.buildExternalStructFields()`
- Simplify `runAnalyzers()` API — reads state from `CodeGenState` by default

## [0.1.67] - 2026-02-11

### Added

- Qualified enum access in array dimensions: `u8[EColor.COUNT]` generates `u8[EColor_COUNT]` (PR #772)
- Compile error `error[E0424]` for bare enum members in non-enum contexts with helpful suggestion (Issue #770, PR #772)
- 3 new error tests for bare enum members in comparisons, function args, and array dimensions

### Changed

- Bare enum members now only resolve where `expectedType` is set (assignments, returns, struct inits, switch cases)
- Updated existing tests to use qualified enum access in comparisons and function arguments

### Removed

- `SymbolTable.resolveExternalEnumArrayDimensions()` and Stage 3c pipeline — replaced by qualified access
- `TSymbolAdapter.buildEnumMemberLookup()` — auto-resolution no longer needed

### Fixed

- `CodeGenState` import path after architecture refactoring (PR #768)
- Cross-file enum array dimensions in generated headers (PR #769)

## [0.1.66] - 2026-02-11

### Added

- Dual-mode test infrastructure: tests now run in both C and C++ modes by default (PR #765)
- Test mode markers: `// test-c-only`, `// test-cpp-only`, `// test-no-exec`, `// test-transpile-only`
- C++ snapshot generation for helper `.cnx` files via `#include` directive traversal (PR #766)
- ADR-058 explicit `.length` properties for arrays on structs (PR #761)
- Unified variable declaration formatting for consistent output (PR #763)
- Volta pinning for Node 24.13.1 and npm 11.8.0 in CI (PR #759)
- 74+ new unit tests for CodeGenerator, ParameterInputAdapter, and ADR-058 edge cases

### Changed

- Test framework auto-detects C++ requirements from headers (class, namespace, template)
- `generate-cpp-snapshots.ts` script now processes helper files recursively
- Unified parameter generation pipeline with ParameterInputAdapter

### Fixed

- Fix enum array dimensions in generated headers (PR #761)
- Address ADR-058 review feedback for property handlers (PR #764)
- Reduce cognitive complexity in `_isArrayAccessStringExpression` (PR #765)
- Remove stale `.expected.c` files from cpp-only tests

## [0.1.65] - 2026-02-10

### Added

- Reject unbounded array parameters (`u8[] arr`) for memory safety (PR #757)
- Require C-Next style array parameters (`u8[10] arr` not `u8 arr[10]`)

### Fixed

- Fix string array `.length` property returning wrong value
- Reduce cognitive complexity for SonarCloud compliance (S3776)
- Use nullish coalescing for simpler code (S6606)

## [0.1.64] - 2026-02-10

### Fixed

- Fix C-Next style array types (`CppClass[4] items`) not detected as arrays in C++ mode codegen, causing incorrect scalar reference generation (PR #755)
- Fix constructor detection false-positives on C function prototypes in test framework — `hasCppFeatures()` now excludes C return types and typed arguments (PR #755)
- Unify `_getArrayZeroInitializer` detection logic for C-style and C-Next style arrays (PR #755)

### Changed

- Reuse transpiler's `detectCppSyntax()` in test framework for robust C++ header detection (class, namespace, template, access specifiers) instead of narrow typed-enum regex (PR #755)
- Extract shared `C_KEYWORDS` and `C_TYPES` constants for constructor detection regex patterns (PR #755)

## [0.1.63] - 2026-02-10

### Added

- Enforce C-Next array syntax (`u8[10] arr`) and reject C-style declarations (`u8 arr[10]`) for user types including structs, bitmaps, and enums (ADR-058, PR #749)
- ADR-058 documentation for C-Next array syntax enforcement
- Unit tests for array syntax validation, CodeGenState, resolvers, and generator registration error paths

### Changed

- Migrate 9 helpers from DI to static CodeGenState pattern: CppModeHelper, StringLengthCounter, MemberChainAnalyzer, FloatBitHelper, AssignmentExpectedTypeResolver, AssignmentClassifier, AssignmentValidator, ArrayInitHelper, StringDeclHelper (PRs #750, #753)
- Extract CodeGenState for centralized code generation state management
- Extract ScopeResolver, EnumTypeResolver, SizeofResolver from CodeGenerator
- Convert TypeResolver to static class (PR #749)
- Extract shared ArrayDimensionUtils to eliminate duplication

### Fixed

- Resolve struct enum field assignment via global prefix (PR #751)
- Fix global arrays passed to functions incorrectly using address-of operator (PR #747)
- Fix array subscript bug in TypeResolver refactoring (PR #749)
- Resolve 12 SonarCloud issues: complexity, redundant code, negated conditions (PRs #750, #752)
- Remove duplicate statements and dead code from CodeGenerator

## [0.1.62] - 2026-02-08

### Changed

- Unify transpiler pipeline and eliminate dual code paths (PR #747)
- Inline CodeGenerator delegator methods for simplified architecture (PRs #744-#747)
- Consolidate array/member access grammar paths
- Extract ArrayAccessHelper and CodegenParserUtils utilities

### Fixed

- Inline private const scope members referenced without `this.` prefix
- Reduce cognitive complexity in `transpileSource` for SonarCloud compliance
- Remove orphaned JSDoc and unused methods

### Added

- 35+ CodeGenerator unit tests for improved coverage
- Tests for TypeGenerationHelper array and template types
- Mocked tests for parseCHeader edge cases

## [0.1.61] - 2026-02-07

### Changed

- Remove vscode-extension folder from repo (moved to separate repo)
- Wire serve command to full Transpiler, delete simplified API (ADR-060 Phase 2b)
- Extract CodeGenerator helpers for improved testability

### Fixed

- Reduce cognitive complexity across 20+ functions to meet SonarCloud S3776 thresholds:
  - `doGenerateAssignmentTarget` (26→~10), `getPostfixExpressionType` (20→~8)
  - `transpileSource` (20→~12), `doCollectHeaderSymbols` (19→~8)
  - `buildAssignmentContext` (19→~10), `collectDeclaration` (19→~12)
  - `registerAllVariableTypes` (20→~8), `analyzePassByValue` (17→~8)
  - `enterPostfixExpression` (17→~10), `InitializationAnalyzer`
  - `walkStatementForModifications`, `transformIncludeDirective`
  - `generateCaseLabel`, `generateStruct`, `enterStatement`
  - `collectBitmapsPass1`, `TypeValidator` shift evaluation
  - `TransitiveModificationPropagator` (PRs #726-#730)
- Add lexer error listener removal and unit tests for parseCHeader
- Address 3 new SonarCloud code issues

### Added

- Add `parseCHeader` server method for extension separation (ADR-060 Phase 3 prep)
- Unit tests for GeneratorRegistry `has*` methods

## [0.1.60] - 2026-02-07

### Added

- Add `--serve` flag for JSON-RPC server mode (ADR-060 Phase 1, PR #721)
- Add VS Code extension server client for transpiler communication (ADR-060 Phase 2, PR #722)
- Code analysis tools: ts-prune, madge, jscpd for dead code and duplication detection (PR #703)

### Changed

- Reduce cognitive complexity across 30+ functions to meet SonarCloud S3776 thresholds:
  - `MemberChainAnalyzer` (46→~5), `StringDeclHelper` (45→~12), `generateTypeInfoLength` (35→~10)
  - `ArrayDimensionParser` (33→~12), `CSymbolCollector` (23→~8), `IncludeDiscovery` (27/23→~8)
  - `HeaderGeneratorUtils` (26→~10), `Runner.execute` (24→~8), `handleSingleSubscript` (22→~8)
  - Plus: `Transpiler.run`, `generateScope`, `generateSizeofExpr`, `needsCppMemberConversion`
  - `VariableCollector.collect`, `collectSimpleDeclaration`, `runAnalyzers`, `generateLengthProperty`
  - `generateReturn`, `generateCaseLabel`, `buildMemberAccessChain`, and many more (PRs #703-#723)
- Extract helper classes for improved testability: `BitRangeHelper`, `BooleanHelper`, `CppMemberHelper`, `CppConstructorHelper`, `SetMapHelper`, `SymbolLookupHelper`, `CodeGenErrors` (PR #715)
- Convert `AssignmentHandlerRegistry` from singleton to static class pattern (PR #703)
- Reduce production code duplication via helper extraction (PRs #709, #710)

### Fixed

- Address SonarCloud issues: S1444 (public static mutable), S7780, S7773, S7735 (PRs #709, #710, #714)
- Fix CI flakiness: increase timeout for Transpiler.coverage.test.ts (PR #719)
- Pin npm version to stabilize package-lock.json peer metadata (PR #717)

## [0.1.59] - 2026-02-05

### Fixed

- Unify getMemberTypeInfo across expression and assignment paths, fixing assignment path's inability to resolve C header struct fields (PR #701)
- Show dot notation in hover signature for scope functions (PR #695)
- Prevent doubled string capacity dimension in struct header fields (PR #695)
- Resolve .capacity/.size against struct field type, not primary variable (PR #695)

### Added

- Enable strict CLI options mode for better error messages on unknown flags (PR #697)
- Improve hover provider symbol resolution with proper scope hierarchy (PR #695)
- Cross-file scope tests in DualCodePaths.test.ts for both function calls and variable assignments (PR #701)
- Comprehensive unit tests for TransitiveEnumCollector, CallExprGenerator, analysis module branch coverage (PRs #685, #687, #688, #691, #693, #699)

### Changed

- Reduce cognitive complexity across multiple functions to meet SonarCloud thresholds:
  - `AssignmentClassifier`, `ScopeGenerator`, `generateMemberAccess`, `PostfixExpressionGenerator`
  - `walkOrExpression` (55→1), `generateVariableDecl` (52→~10), `_generatePrimaryExpr` (38→~8)
  - (PRs #684, #686, #690, #694, #696, #698, #700)
- VS Code extension architecture cleanup: injectable context, CSP nonce policy, debounced handlers, workspace boundary validation (PR #689)
- Clean up README badges (PR #692)

## [0.1.58] - 2026-02-04

### Changed

- Switch to ES modules for top-level await support (PR #669)
- Move all test files to `__tests__` directories (PR #668)
- Upgrade GitHub Actions and publish workflow to Node.js 24 (PR #672)
- Extract separator and dereference resolution utilities for improved testability (PR #681)
- Reduce cognitive complexity across multiple functions to meet SonarCloud thresholds:
  - `generate()`, `analyzeModificationsOnly`, `walkPostfixExpressionForCalls`
  - `trackVariableType`, `hasPostfixFunctionCall`, `_getZeroInitializer`
  - `generateAssignment()` (PRs #670, #671, #673, #675, #676, #678, #680, #682)

### Fixed

- Exclude test files from SonarCloud coverage requirements (PR #674)
- Resolve tsx/vitest ESM interop issue with @n1ru4l/toposort (PR #672)
- Remove unnecessary non-null assertions (PR #671)
- Use direct tsx path instead of npx for faster CLI startup (PR #670)
- Update bin script and CLI tests for ESM compatibility (PR #669)

### Added

- Improve unit test coverage for CHeaderGenerator and StringDeclHelper (PR #679)
- Bring lib and Transpiler to near-100% unit test coverage (PR #674)
- Add comprehensive unit tests for transpiler components (PR #668)
- 42 new unit tests for MemberSeparatorResolver and ParameterDereferenceResolver (PR #681)

## [0.1.57] - 2026-02-04

### Fixed

- Scope array return with enum index generates array access instead of bit extraction (Issue #665, PR #666)
  - When returning `this.values[idx]` from a scope with enum-sized array, now correctly generates `Test_values[idx]`
  - Previously generated incorrect bit extraction code `((Test_values >> idx) & 1)`

### Changed

- Fix SonarCloud cognitive complexity issues (PR #663)
- Improve unit test coverage for SonarCloud (PR #664)

## [0.1.56] - 2026-02-04

### Changed

- Update dependencies

## [0.1.55] - 2026-02-03

### Fixed

- Float to integer casts now clamp instead of wrap (Issue #632, PR #633)
  - `(u8)261.7` now produces `255` (clamped) instead of `5` (wrapped)
  - Matches C-Next's default `clamp` overflow semantics
  - Applies to all float-to-integer cast combinations (f32/f64 → u8/u16/u32/u64/i8/i16/i32/i64)

### Added

- ADR-056: Cast Overflow Behavior (Research status) for future discussion on unifying cast behavior
- 11 new tests in `tests/float-cast/` covering all float-to-integer clamp scenarios

### Documentation

- CLAUDE.md updated to reference Issue #634 (dual code paths technical debt)

## [0.1.54] - 2026-02-02

### Added

- Spell checking with cspell for quality checks (PR #622)
- Unit tests for trackVariableTypeWithName helpers (16 tests, PR #627)
- Unit tests for HeaderGeneratorUtils (27 tests, PR #626)
- Unit tests for assignment handlers (PR #618)

### Changed

- Reduce CodeGenerator.trackVariableTypeWithName complexity from 168 to ~15 (PR #627)
- Extract header section generators to HeaderGeneratorUtils (PR #626)
- Separate C and C++ header generators (PR #623)
- Add IFileSystem abstraction to Transpiler for testability (PR #618, #620)
- Migrate to established libraries for reduced maintenance (PR #620)
- Update dependencies to latest versions (PR #619)

### Fixed

- Resolve 25+ SonarCloud issues: String.raw, type assertions, negated conditions (PR #624, #625)
- Rewrite determineProjectRoot to use real project markers (PR #623)

## [0.1.53] - 2026-02-02

### Fixed

- Array indexing on global external struct field generates bit-slice code instead of array access (Issue #612, PR #613)

### Added

- Unit tests for declaration generators: EnumGenerator, BitmapGenerator, RegisterGenerator, ScopedRegisterGenerator, StructGenerator (47 tests, PR #615)

## [0.1.52] - 2026-02-02

### Changed

- Extract file discovery from IncludeGenerator to data layer (PR #611)
- Extract recursive include processing to IncludeResolver (Issue #592, PR #610)
- Encapsulate transpiler state in TranspilerState class (Issue #587, PR #609)
- Extract include/type-header utilities from Transpiler (PR #607)
- Move include path auto-discovery from CLI to Transpiler (PR #604)
- Extract path calculation to PathResolver (PR #603)
- Move symbol mutation methods to logic layer (Issue #588)
- Move resolveExternalArrayDimensions to SymbolTable (PR #601)
- Extract C++ mode modification analysis to ModificationAnalyzer (Issue #593, PR #596)
- Create HeaderParser wrapper for C/C++ header parsing (PR #599)
- Extract CLI logic from index.ts into src/cli/ (PR #581)

### Fixed

- Use DependencyGraph for file ordering (Issue #580, PR #604)
- Reduce transpileSource() complexity (Issue #591, PR #604)
- Array indexing on parameter generates array access (Issue #579)
- Deploy coverage report to GitHub Pages on merge to main

### Added

- Unit tests for SubscriptClassifier (16 tests, PR #600)
- Unit tests for Transpiler parse error handling (PR #597)
- Unit tests for src/cli modules (120 tests, PR #581)

## [0.1.51] - 2026-02-01

### Fixed

- Const inference: propagate transitive modifications across files (Issue #565)
- Const inference: walk RHS of assignments and for-loop init/update (Issue #565)
- GitHub Pages: add .nojekyll to disable Jekyll processing
- Update oxlint ignore pattern for relocated grammar files
- Update paths in package.json and .prettierignore for new structure

### Changed

- 3-layer architecture refactoring: data/, logic/, output/ separation (PR #571, #572)
- Move Transpiler to root as orchestrator with Pipeline renamed to Transpiler
- Move CommentExtractor to logic/analysis/
- Unify run() and transpileSource() code paths (PR #568)
- Extract generic expression walker helpers for const inference (Issue #566)

### Added

- Unit test coverage report for GitHub Pages
- Coverage report badge linking to GitHub Pages
- Bare function call edge cases for const inference tests

## [0.1.50] - 2026-01-31

### Fixed

- C++ mode: `this.method()` calls now correctly resolve for const inference - private functions calling cross-file modifying functions are properly tracked (Issue #561, PR #562)

### Changed

- Unified `Pipeline.run()` and `Pipeline.transpileSource()` code paths for cross-file const inference - both now use the same modification tracking mechanism (Issue #561, PR #562)
- Added `CodeGenerator.analyzeModificationsOnly()` for standalone modification analysis without full code generation

## [0.1.49] - 2026-01-31

### Fixed

- C++ mode: primitive references no longer wrapped in dereference `(*val)` → `val` (Issue #558, PR #559)
- C++ mode: cross-file const inference now correctly tracks parameters passed to modifying functions in other files (Issue #558, PR #559)

### Changed

- Unified parameter modification tracking into single analysis-phase system, removing duplicate generation-phase tracking (Issue #558)

## [0.1.48] - 2026-01-31

### Added

- C++ reference semantics for struct parameters - params become `const T&` with `.` access (Issue #409, PR #555)
- `--target` CLI flag for PlatformIO project integration (Issue #405, PR #554)
- Comprehensive test coverage: forward declarations, headers, warnings, external types, const params, pass-by-value, 2D arrays (Issues #403-412)
- Practical examples directory (`tests/examples/`)
- CppSymbolCollector unit tests (Issue #418, PR #553)

### Fixed

- C++ mode struct param access uses centralized helpers for consistent `->` vs `.` handling (PR #556)
- External types use pass-by-value semantics (Issue #402, PR #552)
- 2D array parameters generate proper array access (PR #547)
- SonarCloud fixes: optional chaining (S6582), node: prefix (S7772), Number methods (S7773), readonly properties (S2933)

### Changed

- Extract CNextSourceParser from Pipeline.ts (Issue #509, PR #530)
- Consolidate parser setup into CNextSourceParser (Issue #513, PR #531)
- Extract shared context from C/C++ symbol collectors (Issue #512, PR #532)
- Extract shared patterns in AccessPatternHandlers and StringHandlers (Issues #514-515)
- Extract enum/bitmap type registration helpers (Issue #510, PR #535)
- Extract IBaseAnalysisError interface for shared error fields (Issue #399, PR #536)
- Add composition helpers to SymbolCollectorContext (Issue #396, PR #537)
- Consolidate multiple array push() calls for performance (SonarCloud S7778)

## [0.1.47] - 2026-01-28

### Fixed

- Add `extern` to top-level const for C++ external linkage (Issue #525, PR #526)
- Test framework validates `.expected.h` for transpile-only tests (PR #528)

### Changed

- Consolidated TYPE_MAP into single source of truth (Issue #511, PR #527)

## [0.1.46] - 2026-01-28

### Fixed

- Filter C++ namespace types from extern "C" headers (Issue #522, PR #524)
- Recognize C++ class variables as initialized (Issue #503, PR #506)
- Convert C++ namespaced types from `_` to `::` in struct init (Issue #502)
- Generate field assignments for C++ classes with constructors (Issue #517, PR #521)
- C++ namespace function calls work without `global.` prefix (Issue #516, PR #519)
- Emit private const arrays instead of inlining (Issue #500, PR #501)
- Include C headers instead of forward declarations for external types (Issue #497, PR #498)
- Preserve subdirectory structure in directory mode output (Issue #494, PR #495)
- Include filename in E0381 error output (Issue #492, PR #493)
- Write header files when headerCode is present in directory mode (PR #491)
- Respect `headerOut` config for single-file inputs + add `--config` option (PR #489)

### Added

- Float bit indexing support using shadow variable + memcpy (PR #490)
- `basePath` option to strip path prefix from header output (PR #489)
- ADR-057: Implicit scope resolution - bare function calls resolve to scope functions (PR #504)
- ADR-109: CodeGenerator decomposition with extracted utilities (PR #447)
- npm scripts for duplication detection (PR #518)
- CallExprUtils and BinaryExprUtils extraction (PR #499, PR #496)

## [0.1.45] - 2026-01-26

### Fixed

- Cross-scope method calls returning enum types now correctly resolved (Issue #483)

### Note

- Re-release of 0.1.44 content due to npm publish issue

## [0.1.43] - 2026-01-26

### Fixed

- Function/method calls returning enum types now correctly recognized as valid enum assignments
- Added `functionReturnTypes` tracking to ISymbolInfo for proper enum type validation
- Supports all patterns: `func()`, `Scope.method()`, `this.method()`, `global.func()`

### Added

- Comprehensive enum test suite covering all usage scenarios (global, scope, cross-scope, loops, atomic, critical)

## [0.1.42] - 2026-01-26

### Fixed

- Reject unqualified enum values in non-enum type contexts with helpful "did you mean" suggestions (Issue #477, PR #480)
- Global type references (e.g., `global.EnumType`) now work correctly inside scopes (Issue #478, PR #479)

### Changed

- Test framework now auto-generates `.expected.h` for helper files in update mode (PR #480)

## [0.1.41] - 2026-01-26

### Fixed

- Use `__cnx_` prefixed IRQ wrapper functions to avoid macro collisions with platform headers (Issue #473, PR #474)
- Resolve unqualified enum members in switch case labels (Issue #471, PR #472)

### Changed

- Add uncommitted changes check to pre-push hook (PR #475)

## [0.1.40] - 2026-01-26

### Fixed

- Add `volatile` qualifier to extern declarations for atomic variables (Issue #468, PR #469)

## [0.1.39] - 2026-01-26

### Fixed

- Enum values from external (included) .cnx files now correctly get type prefix in generated C code (Issue #465, PR #466)

## [0.1.38] - 2026-01-26

### Added

- Pre-push hook with comprehensive quality checks (PR #463)

### Fixed

- External const array dimensions in header generation (Issue #461, PR #462)
- String<N> type filtering in header generation for C++ interop (PR #462)

## [0.1.37] - 2026-01-25

### Fixed

- Preserve const-based array dimensions in struct field declarations (Issue #455, PR #457)
- Support C macro dimensions in array declarations for header interop (PR #456)
- Handle hex and binary constants in array dimension expressions (PR #456)
- Preserve const-based array dimensions in extern header declarations (PR #456)
- Preserve tracked .test.h files and clean up stale test artifacts (PR #458)

## [0.1.36] - 2026-01-25

### Fixed

- Unqualified enum member references now correctly prefixed in generated C with type-aware resolution (Issue #452, PR #453)

## [0.1.35] - 2026-01-25

### Fixed

- Output enums before structs that reference them in headers (Issue #449, PR #450)

## [0.1.34] - 2026-01-25

### Added

- ADR-055: New symbol parser architecture with composable collectors and TSymbol discriminated union type system (PR #434)
- SonarCloud CI-based analysis with coverage reporting (PR #435)
- Dead code detection with knip (PR #439)
- Refresh script for syncing main and rebuilding (PR #443)
- Status badges to README (PR #440)

### Fixed

- ~150 SonarCloud low-hanging fruit issues (PR #446)
- SonarCloud code smells (PR #438)
- Generate `char[N+1]` instead of `string<N>` in headers (Issue #427, PR #433)
- Include macro-defining headers in generated .h files (Issue #424, PR #430, #431)
- Validate `this.method()` calls for undefined functions (PR #429)
- Improve error message for unqualified scope function calls (Issue #422, PR #426)

### Changed

- Remove barrel files, use direct imports (PR #437)
- Extract ParserUtils and reorganize shared utilities (PR #428)
- Extract analyzer utilities for composition over inheritance (PR #423)

### Testing

- Foundational tests in basics directory (Issue #401, PR #445)
- CacheManager unit tests (Issue #421, PR #444)
- NullCheckAnalyzer unit tests (Issue #416, PR #441)
- Analysis error validation tests (Issue #400, PR #442)
- Compiler warning validation tests (Issue #407, PR #432)
- Unsuffixed literal test coverage (Issue #413, PR #425)
- HeaderGenerator unit tests for string<N> handling (PR #433)

## [0.1.33] - 2026-01-24

### Added

- C++ namespace types support for external library interop (Issue #388, PR #390)
- FloatModuloAnalyzer and FunctionCallAnalyzer integration tests (PR #389)

### Fixed

- Unified assignment target grammar rules (Issue #387, PR #392)
- Unified include resolution and pass symbol table to FunctionCallAnalyzer (PR #391)

## [0.1.32] - 2026-01-24

### Added

- Compile-time bounds checking for single-dimensional arrays (PR #385)
- Unit tests for semantic analyzers with extracted ScopeStack utility (PR #384)
- Comprehensive TypeScript unit tests (PR #381)

### Fixed

- C++ class array initialization and header declarations (Issue #379, PR #383)
- Array initializers for bounded string arrays (Issue #380, PR #382)
- Fill-all syntax support for string array initializers

## [0.1.31] - 2026-01-24

### Added

- C++ constructor argument syntax for external library interop (Issue #375)
  - Supports `Type name(constArg1, constArg2);` syntax
  - Arguments must be const variables (enforced at parse and codegen time)
  - Works with template types and inside scopes
- Struct declarations inside scopes (PR #374)

## [0.1.30] - 2026-01-24

### Fixed

- Track scope-qualified calls for auto-const inference (Issue #365)
- Prevent struct/enum/bitmap duplication in .c files when headers generated (Issue #369)
- Recursively detect function calls through unary operators for MISRA 13.5 compliance (Issue #366)
- Array parameter element assignment generates correct array access (Issue #368)

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

[Unreleased]: https://github.com/jlaustill/c-next/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/jlaustill/c-next/compare/v0.1.72...v0.2.0
[0.1.72]: https://github.com/jlaustill/c-next/compare/v0.1.71...v0.1.72
[0.1.71]: https://github.com/jlaustill/c-next/compare/v0.1.70...v0.1.71
[0.1.70]: https://github.com/jlaustill/c-next/compare/v0.1.69...v0.1.70
[0.1.69]: https://github.com/jlaustill/c-next/compare/v0.1.68...v0.1.69
[0.1.68]: https://github.com/jlaustill/c-next/compare/v0.1.67...v0.1.68
[0.1.67]: https://github.com/jlaustill/c-next/compare/v0.1.66...v0.1.67
[0.1.66]: https://github.com/jlaustill/c-next/compare/v0.1.65...v0.1.66
[0.1.65]: https://github.com/jlaustill/c-next/compare/v0.1.64...v0.1.65
[0.1.64]: https://github.com/jlaustill/c-next/compare/v0.1.63...v0.1.64
[0.1.63]: https://github.com/jlaustill/c-next/compare/v0.1.62...v0.1.63
[0.1.62]: https://github.com/jlaustill/c-next/compare/v0.1.61...v0.1.62
[0.1.61]: https://github.com/jlaustill/c-next/compare/v0.1.60...v0.1.61
[0.1.60]: https://github.com/jlaustill/c-next/compare/v0.1.59...v0.1.60
[0.1.59]: https://github.com/jlaustill/c-next/compare/v0.1.58...v0.1.59
[0.1.58]: https://github.com/jlaustill/c-next/compare/v0.1.57...v0.1.58
[0.1.57]: https://github.com/jlaustill/c-next/compare/v0.1.56...v0.1.57
[0.1.56]: https://github.com/jlaustill/c-next/compare/v0.1.55...v0.1.56
[0.1.55]: https://github.com/jlaustill/c-next/compare/v0.1.54...v0.1.55
[0.1.54]: https://github.com/jlaustill/c-next/compare/v0.1.53...v0.1.54
[0.1.53]: https://github.com/jlaustill/c-next/compare/v0.1.52...v0.1.53
[0.1.52]: https://github.com/jlaustill/c-next/compare/v0.1.51...v0.1.52
[0.1.51]: https://github.com/jlaustill/c-next/compare/v0.1.50...v0.1.51
[0.1.50]: https://github.com/jlaustill/c-next/compare/v0.1.49...v0.1.50
[0.1.49]: https://github.com/jlaustill/c-next/compare/v0.1.48...v0.1.49
[0.1.48]: https://github.com/jlaustill/c-next/compare/v0.1.47...v0.1.48
[0.1.47]: https://github.com/jlaustill/c-next/compare/v0.1.46...v0.1.47
[0.1.46]: https://github.com/jlaustill/c-next/compare/v0.1.45...v0.1.46
[0.1.45]: https://github.com/jlaustill/c-next/compare/v0.1.44...v0.1.45
[0.1.44]: https://github.com/jlaustill/c-next/compare/v0.1.43...v0.1.44
[0.1.43]: https://github.com/jlaustill/c-next/compare/v0.1.42...v0.1.43
[0.1.42]: https://github.com/jlaustill/c-next/compare/v0.1.41...v0.1.42
[0.1.41]: https://github.com/jlaustill/c-next/compare/v0.1.40...v0.1.41
[0.1.40]: https://github.com/jlaustill/c-next/compare/v0.1.39...v0.1.40
[0.1.39]: https://github.com/jlaustill/c-next/compare/v0.1.38...v0.1.39
[0.1.38]: https://github.com/jlaustill/c-next/compare/v0.1.37...v0.1.38
[0.1.37]: https://github.com/jlaustill/c-next/compare/v0.1.36...v0.1.37
[0.1.36]: https://github.com/jlaustill/c-next/compare/v0.1.35...v0.1.36
[0.1.35]: https://github.com/jlaustill/c-next/compare/v0.1.34...v0.1.35
[0.1.34]: https://github.com/jlaustill/c-next/compare/v0.1.33...v0.1.34
[0.1.33]: https://github.com/jlaustill/c-next/compare/v0.1.32...v0.1.33
[0.1.54]: https://github.com/jlaustill/c-next/compare/v0.1.53...v0.1.54
[0.1.53]: https://github.com/jlaustill/c-next/compare/v0.1.52...v0.1.53
[0.1.52]: https://github.com/jlaustill/c-next/compare/v0.1.51...v0.1.52
[0.1.51]: https://github.com/jlaustill/c-next/compare/v0.1.50...v0.1.51
[0.1.50]: https://github.com/jlaustill/c-next/compare/v0.1.49...v0.1.50
[0.1.49]: https://github.com/jlaustill/c-next/compare/v0.1.48...v0.1.49
[0.1.48]: https://github.com/jlaustill/c-next/compare/v0.1.47...v0.1.48
[0.1.47]: https://github.com/jlaustill/c-next/compare/v0.1.46...v0.1.47
[0.1.46]: https://github.com/jlaustill/c-next/compare/v0.1.45...v0.1.46
[0.1.45]: https://github.com/jlaustill/c-next/compare/v0.1.44...v0.1.45
[0.1.44]: https://github.com/jlaustill/c-next/compare/v0.1.43...v0.1.44
[0.1.43]: https://github.com/jlaustill/c-next/compare/v0.1.42...v0.1.43
[0.1.42]: https://github.com/jlaustill/c-next/compare/v0.1.41...v0.1.42
[0.1.41]: https://github.com/jlaustill/c-next/compare/v0.1.40...v0.1.41
[0.1.40]: https://github.com/jlaustill/c-next/compare/v0.1.39...v0.1.40
[0.1.39]: https://github.com/jlaustill/c-next/compare/v0.1.38...v0.1.39
[0.1.38]: https://github.com/jlaustill/c-next/compare/v0.1.37...v0.1.38
[0.1.37]: https://github.com/jlaustill/c-next/compare/v0.1.36...v0.1.37
[0.1.36]: https://github.com/jlaustill/c-next/compare/v0.1.35...v0.1.36
[0.1.35]: https://github.com/jlaustill/c-next/compare/v0.1.34...v0.1.35
[0.1.34]: https://github.com/jlaustill/c-next/compare/v0.1.33...v0.1.34
[0.1.33]: https://github.com/jlaustill/c-next/compare/v0.1.32...v0.1.33
[0.1.63]: https://github.com/jlaustill/c-next/compare/v0.1.62...v0.1.63
[0.1.62]: https://github.com/jlaustill/c-next/compare/v0.1.61...v0.1.62
[0.1.32]: https://github.com/jlaustill/c-next/compare/v0.1.31...v0.1.32
[0.1.31]: https://github.com/jlaustill/c-next/compare/v0.1.30...v0.1.31
[0.1.30]: https://github.com/jlaustill/c-next/compare/v0.1.29...v0.1.30
[0.1.29]: https://github.com/jlaustill/c-next/compare/v0.1.28...v0.1.29
[0.1.28]: https://github.com/jlaustill/c-next/compare/v0.1.27...v0.1.28
[0.1.27]: https://github.com/jlaustill/c-next/compare/v0.1.26...v0.1.27
[0.1.26]: https://github.com/jlaustill/c-next/compare/v0.1.25...v0.1.26
[0.1.25]: https://github.com/jlaustill/c-next/compare/v0.1.24...v0.1.25
[0.1.24]: https://github.com/jlaustill/c-next/compare/v0.1.23...v0.1.24
[0.1.23]: https://github.com/jlaustill/c-next/compare/v0.1.22...v0.1.23
[0.1.70]: https://github.com/jlaustill/c-next/compare/v0.1.69...v0.1.70
[0.1.69]: https://github.com/jlaustill/c-next/compare/v0.1.68...v0.1.69
[0.1.68]: https://github.com/jlaustill/c-next/compare/v0.1.67...v0.1.68
[0.1.67]: https://github.com/jlaustill/c-next/compare/v0.1.66...v0.1.67
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
