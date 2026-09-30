/**
 * The `awaiting #NNNN` rows `docs/architecture/module-destinations.md` may hold
 * (#1653, owner ruling 17: the set may not grow).
 *
 * An `awaiting` row is allowed, never a failure as such. What fails is a row
 * this list does not hold, and an entry here the map no longer reads as
 * `awaiting` -- so when a module moves, its entry leaves this list in the same
 * commit, and the allowance cannot be reused. Entries are the row's module
 * paths exactly as the map spells them.
 */
const AWAITING_ROWS: readonly string[] = [
  "src/TRANSPILE/2-Plan/TransitiveModificationPropagator.ts",
  "src/TRANSPILE/2-Plan/types/IModificationCollector.ts",
  "src/transpiler/data/CNextMarkerDetector.ts",
  "src/transpiler/data/CppEntryPointScanner.ts",
  "src/transpiler/data/DependencyGraph.ts",
  "src/transpiler/data/FileDiscovery.ts",
  "src/transpiler/data/IncludeDiscovery.ts",
  "src/transpiler/data/IncludeResolver.ts",
  "src/transpiler/data/InputExpansion.ts",
  "src/transpiler/data/PathResolver.ts",
  "src/transpiler/data/PlatformIOIni.ts",
  "src/transpiler/data/TargetCatalogFile.ts",
  "src/transpiler/data/types/**",
  "src/transpiler/data/IncludeRewriter.ts",
  "src/transpiler/logic/preprocessor/**",
  "src/utils/cache/**",
  "src/transpiler/logic/IncludeExtractor.ts",
  "src/transpiler/logic/detectCppSyntax.ts",
  "src/transpiler/logic/detectAssemblySyntax.ts",
  "src/transpiler/NodeFileSystem.ts",
  "src/transpiler/Transpiler.ts",
  "src/transpiler/ModificationFacts.ts",
  "src/transpiler/CallbackCompatibility.ts",
  "src/transpiler/types/**",
  "src/transpiler/constants/BITMAP_BACKING_TYPE.ts",
  "src/transpiler/constants/BITMAP_SIZE.ts",
  "src/transpiler/constants/SMALL_PRIMITIVES.ts",
  "src/transpiler/constants/TARGET_DESCRIPTION_FIELDS.ts",
  "src/transpiler/constants/BUILTIN_TYPE_NAMES.ts",
  "src/transpiler/constants/REJECTED_KEYWORDS.ts",
  "src/transpiler/constants/SYSTEM_INCLUDE_TARGETS.ts",
  "src/transpiler/constants/LANGUAGE_STANDARD_FAMILY.ts",
  "src/transpiler/constants/LANGUAGE_STANDARD_ORDER.ts",
  "src/transpiler/constants/STRUCT_POINTER_C_FUNCTIONS.ts",
  "src/transpiler/constants/TOOLCHAIN_REQUIREMENTS.ts",
  "src/transpiler/constants/TYPE_WIDTH.ts",
  "src/transpiler/constants/UNRESOLVED_DIMENSION.ts",
  "src/transpiler/constants/UNSET_SOURCE_SPAN.ts",
  "src/index.ts",
  "src/tests/utils/FunctionUtils.ts",
];

export default AWAITING_ROWS;
