/**
 * The `awaiting #NNNN` rows `docs/architecture/module-destinations.md` may hold
 * (#1653, owner ruling 17: the set may not grow).
 *
 * An `awaiting` row is allowed, never a failure as such. Each entry is a row's
 * path, spelled as the map spells it, and the number of modules it covers. A
 * count that rises fails: a module landed under a glob undecided. A count that
 * falls, or an entry the map no longer reads as `awaiting`, fails too, so an
 * allowance cannot outlive its modules (#1826 review: the ratchet used to count
 * pattern strings, which a glob row made blind).
 */
const AWAITING_ROWS: Readonly<Record<string, number>> = {
  "src/TRANSPILE/2-Plan/TransitiveModificationPropagator.ts": 1,
  "src/TRANSPILE/2-Plan/types/IModificationCollector.ts": 1,
  "src/transpiler/data/CNextMarkerDetector.ts": 1,
  "src/transpiler/data/CppEntryPointScanner.ts": 1,
  "src/transpiler/data/DependencyGraph.ts": 1,
  "src/transpiler/data/FileDiscovery.ts": 1,
  "src/transpiler/data/IncludeDiscovery.ts": 1,
  "src/transpiler/data/IncludeResolver.ts": 1,
  "src/transpiler/data/InputExpansion.ts": 1,
  "src/transpiler/data/PathResolver.ts": 1,
  "src/transpiler/data/PlatformIOIni.ts": 1,
  "src/transpiler/data/TargetCatalogFile.ts": 1,
  "src/transpiler/data/types/**": 3,
  "src/transpiler/data/IncludeRewriter.ts": 1,
  "src/transpiler/logic/preprocessor/**": 9,
  "src/utils/cache/**": 4,
  "src/transpiler/logic/IncludeExtractor.ts": 1,
  "src/transpiler/logic/detectCppSyntax.ts": 1,
  "src/transpiler/logic/detectAssemblySyntax.ts": 1,
  "src/transpiler/NodeFileSystem.ts": 1,
  "src/transpiler/Transpiler.ts": 1,
  "src/transpiler/ModificationFacts.ts": 1,
  "src/transpiler/CallbackCompatibility.ts": 1,
  "src/transpiler/types/**": 131,
  "src/transpiler/constants/BITMAP_BACKING_TYPE.ts": 1,
  "src/transpiler/constants/BITMAP_SIZE.ts": 1,
  "src/transpiler/constants/SMALL_PRIMITIVES.ts": 1,
  "src/transpiler/constants/TARGET_DESCRIPTION_FIELDS.ts": 1,
  "src/transpiler/constants/BUILTIN_TYPE_NAMES.ts": 1,
  "src/transpiler/constants/REJECTED_KEYWORDS.ts": 1,
  "src/transpiler/constants/SYSTEM_INCLUDE_TARGETS.ts": 1,
  "src/transpiler/constants/LANGUAGE_STANDARD_FAMILY.ts": 1,
  "src/transpiler/constants/LANGUAGE_STANDARD_ORDER.ts": 1,
  "src/transpiler/constants/STRUCT_POINTER_C_FUNCTIONS.ts": 1,
  "src/transpiler/constants/TOOLCHAIN_REQUIREMENTS.ts": 1,
  "src/transpiler/constants/TYPE_WIDTH.ts": 1,
  "src/transpiler/constants/UNRESOLVED_DIMENSION.ts": 1,
  "src/transpiler/constants/UNSET_SOURCE_SPAN.ts": 1,
  "src/index.ts": 1,
  "src/tests/utils/FunctionUtils.ts": 1,
};

export default AWAITING_ROWS;
