/**
 * Transpiler
 * Unified transpiler for both single-file and multi-file builds
 *
 * A single file transpilation is just a project with one .cnx file.
 *
 * Architecture: transpile() is the single entry point. It discovers files
 * via discoverIncludes(), then delegates to _executePipeline(). There is
 * ONE pipeline for all transpilation.
 */

import { join, basename, dirname, resolve, relative } from "node:path";
import type IConflict from "./types/IConflict";

import IFileSystem from "./types/IFileSystem";
import NodeFileSystem from "./NodeFileSystem";

import * as Parser from "./logic/parser/grammar/CNextParser";
import CNextSourceParser from "./logic/parser/CNextSourceParser";
import HeaderParser from "./logic/parser/HeaderParser";

import CodeGenerator from "./output/codegen/CodeGenerator";
import CodeGenState from "./state/CodeGenState";
import AdrProvenance from "./state/AdrProvenance";
import CachedSymbolReader from "../utils/cache/CachedSymbolReader";
import TJsonValue from "../utils/types/TJsonValue";
import TypeResolver from "../utils/TypeResolver";
import PublicInterface from "./logic/symbols/PublicInterface";
import HeaderGenerator from "./output/headers/HeaderGenerator";
import ExternalTypeHeaderBuilder from "./output/headers/ExternalTypeHeaderBuilder";
import HeaderGeneratorUtils from "./output/headers/HeaderGeneratorUtils";
import ICodeGenSymbols from "./types/ICodeGenSymbols";
import IncludeExtractor from "./logic/IncludeExtractor";
import SymbolTable from "./logic/symbols/SymbolTable";
import ESourceLanguage from "../utils/types/ESourceLanguage";
import CNextResolver from "./logic/symbols/cnext";
import SymbolRegistry from "./state/SymbolRegistry";
import TSymbolInfoAdapter from "./logic/symbols/cnext/adapters/TSymbolInfoAdapter";
import CResolver from "./logic/symbols/c";
import CppResolver from "./logic/symbols/cpp";
import HeaderSymbolAdapter from "./output/headers/adapters/HeaderSymbolAdapter";
import IHeaderSymbol from "./output/headers/types/IHeaderSymbol";
import TSymbol from "./types/symbols/TSymbol";
import Preprocessor from "./logic/preprocessor/Preprocessor";
import ToolchainDetector from "./logic/preprocessor/ToolchainDetector";
import CompileCommandsReader from "./logic/preprocessor/CompileCommandsReader";
import IToolchain from "./logic/preprocessor/types/IToolchain";
import ICompileCommandsResult from "./logic/preprocessor/types/ICompileCommandsResult";

import FileDiscovery from "./data/FileDiscovery";
import EFileType from "./data/types/EFileType";
import IDiscoveredFile from "./data/types/IDiscoveredFile";
import IncludeDiscovery from "./data/IncludeDiscovery";
import IncludeResolver from "./data/IncludeResolver";
import IncludeTreeWalker from "./data/IncludeTreeWalker";
import DependencyGraph from "./data/DependencyGraph";
import PathResolver from "./data/PathResolver";
import OutputExtensions from "../utils/OutputExtensions";
import type IOutputExtensions from "./types/IOutputExtensions";
import InputExpansion from "./data/InputExpansion";
import CppEntryPointScanner from "./data/CppEntryPointScanner";

import ParserUtils from "../utils/ParserUtils";
import ITranspilerConfig from "./types/ITranspilerConfig";
import ITranspilerResult from "./types/ITranspilerResult";
import IFileResult from "./types/IFileResult";
import IDeclaredFile from "./types/IDeclaredFile";
import IPipelineFile from "./types/IPipelineFile";
import IPipelineInput from "./types/IPipelineInput";
import TTranspileInput from "./types/TTranspileInput";
import ITranspileError from "../lib/types/ITranspileError";
import TranspilerState from "./state/TranspilerState";
import runAnalyzers from "./logic/analysis/runAnalyzers";
import ModificationAnalyzer from "./logic/analysis/ModificationAnalyzer";
import CacheManager from "../utils/cache/CacheManager";
import MapUtils from "../utils/MapUtils";
import detectCppSyntax from "./logic/detectCppSyntax";
import detectAssemblySyntax from "./logic/detectAssemblySyntax";
import ExternalDeclarationOracle from "./logic/preprocessor/ExternalDeclarationOracle";
import TransitiveEnumCollector from "./logic/symbols/TransitiveEnumCollector";
import TypedefParamParser from "./output/codegen/helpers/TypedefParamParser";
import type IRecordedRequirement from "./types/IRecordedRequirement";
import RequirementAggregator from "../utils/RequirementAggregator";
import TargetResolver from "../utils/TargetResolver";

/**
 * Unified transpiler
 */
class Transpiler {
  private readonly config: Required<ITranspilerConfig>;
  private readonly preprocessor: Preprocessor;
  private readonly codeGenerator: CodeGenerator;
  private readonly headerGenerator: HeaderGenerator;
  private readonly warnings: string[];
  private readonly cacheManager: CacheManager | null;
  /**
   * Issue #211: Tracks if C++ output is needed.
   *
   * Issue #1319: a monotone latch -- seeded from `--cpp`, raised when an
   * included header proves the run emits C++, and never lowered. Monotone means
   * order-independent: one settled value per run whatever order the include
   * graph is walked, which is what makes it a legitimate cross-file fact rather
   * than a per-file one.
   *
   * Nothing may assign this outside `raiseCppDetected()`. There is no setter, so
   * "one-way" is a property of the code rather than a comment asking for care --
   * the previous version of this line stated the invariant and nothing checked
   * it. `CppLatchMonotonicity.test.ts` gates it.
   */
  private cppDetectedLatch: boolean = false;

  /** Read the latch. Callers outside this class use `isCppDetected()`. */
  private get cppDetected(): boolean {
    return this.cppDetectedLatch;
  }

  /**
   * Raise the latch. Issue #1319: the only write to `cppDetectedLatch`. There is
   * deliberately no way to lower it.
   */
  private raiseCppDetected(): void {
    this.cppDetectedLatch = true;
  }

  /**
   * Issue #1319: the run's output extensions -- the interim owner of a decision
   * that belongs in pass 2.2 Plan, which does not exist yet.
   *
   * Nine sites across all four layers used to map the mode to an extension
   * themselves. Handing out the extension instead of the mode is what lets
   * `data/` stop naming output files: naming one is a decision, and `data/` is
   * the earliest layer, so it ran before the latch had settled.
   */
  private get outputExtensions(): IOutputExtensions {
    return OutputExtensions.forCppMode(this.cppDetected);
  }

  /**
   * Set when any C header failed standalone preprocessing (fell back to raw
   * text). Gates the ExternalDeclarationOracle recovery pass (Issue #985) so
   * only projects with unresolvable framework headers pay its cost.
   */
  private anyHeaderPreprocessFailed = false;

  /**
   * ADR-049: `#pragma target` names declared by this run's C-Next files.
   *
   * Collected in Stage 3 so the whole-program Rule 5.1 check can resolve one
   * budget for the build. Cleared per run by `_initializeRun()` — a stale entry
   * here would reintroduce exactly the cross-run leak it exists to fix.
   */
  private pragmaTargets: string[] = [];
  /** Issue #587: Encapsulated state for accumulated Maps/Sets */
  private readonly state = new TranspilerState();
  /**
   * #1301: each file's parse and declare, keyed by source path.
   *
   * Stage 3 populates this; Stage 5 consumes it. It is the ONLY path by which
   * Stage 5 obtains a tree -- there is deliberately no parse-if-absent fallback,
   * because that fallback would be the duplicate code path this removes. Every
   * file Stage 5 visits is a member of the same `input.cnextFiles` Stage 3 walked,
   * and Stage 3 aborts the run on a parse error before Stage 5 begins, so a miss
   * is a pipeline-ordering bug rather than a case to recover from.
   *
   * Lives on the orchestrator rather than on `TranspilerState` so that `state/`
   * stays free of ANTLR contexts (#1317).
   */
  private readonly declaredFiles = new Map<string, IDeclaredFile>();
  /**
   * Issue #593: Centralized analyzer for cross-file const inference in C++ mode.
   * Accumulates parameter modifications and param lists across all processed files.
   */
  private readonly modificationAnalyzer = new ModificationAnalyzer();
  /** Issue #586: Centralized path resolution for output files */
  private readonly pathResolver: PathResolver;
  /** File system abstraction for testability */
  private readonly fs: IFileSystem;
  /**
   * Issue #1133: project root, used as the include guard's base directory.
   *
   * The guard must identify a source file the SAME WAY no matter how the
   * transpiler was invoked — building `app.cnx` (which pulls in can/config.cnx)
   * and building `can/config.cnx` directly must agree, or a consumer including
   * both separately-built headers hits the collision again. Anchoring on the
   * input directory does not have that property; the project root does.
   */
  private readonly projectRoot: string | undefined;

  constructor(config: ITranspilerConfig, fs?: IFileSystem) {
    // Use injected file system or default to Node.js implementation
    this.fs = fs ?? new NodeFileSystem();
    // Apply defaults
    this.config = {
      input: config.input,
      includeDirs: config.includeDirs ?? [],
      outDir: config.outDir ?? "",
      headerOutDir: config.headerOutDir ?? "",
      basePath: config.basePath ?? "",
      defines: config.defines ?? {},
      preprocess: config.preprocess ?? true,
      cppRequired: config.cppRequired ?? false,
      parseOnly: config.parseOnly ?? false,
      debugMode: config.debugMode ?? false,
      target: config.target ?? "",
      collectGrammarCoverage: config.collectGrammarCoverage ?? false,
      noCache: config.noCache ?? false,
    };

    // Issue #211: Seed the latch from config (--cpp flag sets this)
    // Issue #1319: seeding raises; it never lowers, so `--cpp` off is the
    // absence of a raise rather than an assignment of false.
    if (this.config.cppRequired) {
      this.raiseCppDetected();
    }

    // Adopt the compiler's own view from the project's compile_commands.json, if
    // present. Every build system (CMake, PlatformIO, Meson, Zephyr, bear-wrapped
    // Make) emits this database; reading it — rather than mirroring framework
    // include paths in cnext.config.json — lets cnext resolve external headers
    // exactly as the compiler will, which is the same reason clangd reads it.
    // The include paths + defines + compiler are the contract every build system
    // converges on. (Issue #985 external-symbol recovery; unblocks ADR-062.)
    const projectRoot = this.determineProjectRoot();
    this.projectRoot = projectRoot;
    const compileDb = projectRoot
      ? CompileCommandsReader.load(join(projectRoot, "compile_commands.json"))
      : null;
    if (compileDb) {
      this._applyCompileCommands(compileDb);
    }

    this.preprocessor = new Preprocessor(
      Transpiler._toolchainForCompileDb(compileDb),
    );
    this.codeGenerator = new CodeGenerator();
    this.headerGenerator = new HeaderGenerator();
    this.warnings = [];

    // Issue #586: Initialize path resolver
    this.pathResolver = new PathResolver(
      {
        inputs: [dirname(resolve(this.config.input))],
        outDir: this.config.outDir,
        headerOutDir: this.config.headerOutDir,
        basePath: this.config.basePath,
      },
      this.fs,
    );

    // Initialize cache manager if caching is enabled and a project root was found.
    this.cacheManager =
      !this.config.noCache && projectRoot
        ? new CacheManager(projectRoot, this.fs)
        : null;
  }

  /**
   * Merge a discovered compile_commands.json into the effective config: union its
   * include search paths into includeDirs (so both preprocessing and include-tree
   * resolution see what the compiler sees) and merge its defines beneath the
   * explicit CLI/config defines, which win on conflict.
   */
  private _applyCompileCommands(db: ICompileCommandsResult): void {
    const merged = [...this.config.includeDirs];
    const seen = new Set(merged);
    for (const path of db.includePaths) {
      if (!seen.has(path)) {
        seen.add(path);
        merged.push(path);
      }
    }
    this.config.includeDirs = merged;
    this.config.defines = { ...db.defines, ...this.config.defines };
  }

  /**
   * The toolchain to preprocess with, given a discovered compile database. An
   * explicit CNEXT_CROSS_COMPILER override always wins (deferred to Preprocessor's
   * own detection); otherwise adopt the database's compiler if it resolves, else
   * fall back to auto-detection.
   */
  private static _toolchainForCompileDb(
    db: ICompileCommandsResult | null,
  ): IToolchain | undefined {
    if (process.env.CNEXT_CROSS_COMPILER) return undefined;
    if (!db?.compiler) return undefined;
    return ToolchainDetector.fromPath(db.compiler) ?? undefined;
  }

  // ===========================================================================
  // Public API
  // ===========================================================================

  /**
   * Unified entry point for all transpilation.
   *
   * @param input - What to transpile:
   *   - { kind: 'files' } — discover from config.inputs, write to disk
   *   - { kind: 'source', source, ... } — transpile in-memory source
   * @returns ITranspilerResult with per-file results in .files[]
   */
  async transpile(input: TTranspileInput): Promise<ITranspilerResult> {
    const result = this._initResult();

    try {
      await this._initializeRun();

      const pipelineInput = await this.discoverIncludes(input);
      if (pipelineInput.cnextFiles.length === 0) {
        return this._finalizeResult(result, "No C-Next source files found");
      }

      if (input.kind === "files") {
        this._ensureOutputDirectories();
      }

      await this._executePipeline(pipelineInput, result);
      return await this._finalizeResult(result);
    } catch (err) {
      return this._handleRunError(result, err);
    } finally {
      // #1301 review: release the parse trees when the run ends, not merely when
      // the next one starts. `Transpiler` is not always per-process --
      // `ServeCommand` holds ONE instance in a static field and reuses it for
      // every request -- so clearing only on entry would leave the language
      // server holding every ProgramContext and CommonTokenStream from the last
      // request for as long as the editor sits idle. Before this cache both were
      // locals that died with `_transpileFile`.
      //
      // Peak-RSS benchmarking cannot see this: it measures the in-run high water
      // mark, and post-run residency is a different number. Stage 6 does not need
      // trees -- `_generateAllHeadersFromPipeline` reads `result.files[].headerCode`
      // -- so the run is genuinely done with them here.
      //
      // This is the ONLY clear site. `_initializeRun` used to clear on entry too,
      // but with this `finally` covering every exit -- success, `_handleRunError`,
      // and a throw -- that one could never observe a non-empty map, so deleting it
      // reddened nothing. Two sites for one invariant is the duplication CLAUDE.md
      // calls the worst anti-pattern, and the unreachable half is the #1143 shape.
      this.declaredFiles.clear();
    }
  }

  /**
   * Stage 1: Discover files and build pipeline input.
   *
   * Branches on input kind:
   * - 'files': filesystem scan, dependency graph, topological sort
   * - 'source': parse in-memory string, walk include tree
   *
   * Header directive storage happens via IncludeResolver.resolve() for both
   * C headers and cnext includes (Issue #854).
   */
  private async discoverIncludes(
    input: TTranspileInput,
  ): Promise<IPipelineInput> {
    if (input.kind === "files") {
      return this._discoverFromFiles();
    }
    return this._discoverFromSource(
      input.source,
      input.workingDir ?? process.cwd(),
      input.includeDirs ?? [],
      input.sourcePath ?? "<string>",
    );
  }

  // ===========================================================================
  // Unified Pipeline
  // ===========================================================================

  /**
   * The single unified pipeline for all transpilation.
   *
   * transpile() delegates here after file discovery via discoverIncludes().
   *
   * Stage 2: Collect symbols from C/C++ headers (includes building analyzer context)
   * Stage 3: Collect symbols from C-Next files
   * Stage 3b: Resolve external const array dimensions
   * Stage 4: Check for symbol conflicts
   * Stage 5: Generate code and its header (per-file, while that file's state is warm)
   * Stage 6: Write the Stage 5 headers to disk (per-file)
   */
  private async _executePipeline(
    input: IPipelineInput,
    result: ITranspilerResult,
  ): Promise<void> {
    // Stage 2: Collect symbols from C/C++ headers and build analyzer context
    // Issue #945: Now async for preprocessing support
    await this._collectAllHeaderSymbols(input.headerFiles, result);

    // Issue #985 recovery: when standalone header preprocessing missed framework
    // symbols, recover their declared names via translation-unit preprocessing.
    await this._collectExternalDeclarations(input);

    // Snapshot external struct fields for InitializationAnalyzer AFTER recovery so
    // structs that only become known through #985 recovery (their fields are added
    // to symbolTable by _collectExternalDeclarations) are folded in and remain
    // subject to init-completeness checking. Nothing consumes externalStructFields
    // before Stage 5, so a single post-recovery build is sufficient.
    CodeGenState.buildExternalStructFields();

    // Stage 3: Collect symbols from C-Next files
    if (!this._collectAllCNextSymbolsFromPipeline(input.cnextFiles, result)) {
      return;
    }

    // Stage 3b: Resolve external const array dimensions
    CodeGenState.symbolTable.resolveExternalArrayDimensions();

    // Stage 4: Check for symbol conflicts
    if (!this._checkSymbolConflicts(result)) {
      return;
    }

    // Stage 4b: Check for include guard collisions (ADR-063, issue #1133)
    if (!this._checkIncludeGuardCollisions(input.cnextFiles, result)) {
      return;
    }

    // Stage 4c: Check external identifier significance (MISRA 5.1, issue #1307)
    if (!this._checkExternalIdentifierSignificance(result)) {
      return;
    }

    // Stage 5: Analyze and transpile each C-Next file
    //
    // #1233: the .c of a file that succeeded is NOT written as we go. A later
    // file can still fail the run, and Stage 6 gates headers on
    // `result.success`, so writing eagerly produced a .c that #includes a
    // header the same run refused to write -- output that cannot compile on a
    // clean tree and silently compiles against a stale header on a dirty one.
    // Deferring puts the .c under the same gate the .h already had.
    const pendingWrites: { path: string; content: string }[] = [];
    for (const file of input.cnextFiles) {
      if (!Transpiler._producesOutput(file)) {
        continue;
      }

      const fileResult = this._transpileFile(file);
      this._recordFileResult(
        file.discoveredFile,
        fileResult,
        result,
        input.writeOutputToDisk,
        pendingWrites,
      );
    }

    if (result.success && input.writeOutputToDisk) {
      for (const write of pendingWrites) {
        this.fs.writeFile(write.path, write.content);
      }
    }

    // Stage 6: Write the Stage 5 headers (only to disk in files mode)
    if (result.success && input.writeOutputToDisk) {
      this._generateAllHeadersFromPipeline(input.cnextFiles, result);
    }
  }

  /**
   * Stage 3 for pipeline files: Collect symbols from all C-Next files.
   *
   * Reads source from file.source or disk, then collects symbols.
   * @returns true if successful, false if errors occurred
   */
  private _collectAllCNextSymbolsFromPipeline(
    cnextFiles: IPipelineFile[],
    result: ITranspilerResult,
  ): boolean {
    for (const file of cnextFiles) {
      const errors = this._doCollectCNextSymbolsFromPipeline(file);
      if (errors) {
        result.errors.push(...errors);
        result.success = false;
      }
    }
    return result.success;
  }

  /**
   * Collect symbols from a single C-Next pipeline file.
   * Uses file.source when available (in-memory), otherwise reads from disk.
   *
   * @returns null on success, or an array of ITranspileError on failure
   */
  private _doCollectCNextSymbolsFromPipeline(
    file: IPipelineFile,
  ): ITranspileError[] | null {
    const content = file.source ?? this.fs.readFile(file.path);
    const { tree, tokenStream, errors, declarationCount } =
      CNextSourceParser.parse(content);

    // Parse errors — return them with original line/column and sourcePath
    if (errors.length > 0) {
      return errors.map((e) => ({ ...e, sourcePath: file.path }));
    }

    // ADR-049: record the file's declared target while its tree is in hand, so
    // Stage 4c can resolve a run-level budget without re-parsing or re-deriving.
    const pragmaTarget = TargetResolver.fromPragma(tree);
    if (pragmaTarget) {
      this.pragmaTargets.push(pragmaTarget);
    }

    try {
      // ADR-055 Phase 7: Use composable collectors via CNextResolver
      const declared = this._declareFile(tree, file.path, file.cnextIncludes);
      const tSymbols = declared.symbols;

      // #1301: Stage 5 consumes this parse and this declare instead of repeating
      // both. Recorded after _declareFile returns, so a file that throws while
      // declaring leaves no half-built entry for Stage 5 to find.
      //
      // Only for files that will read it back. A symbol-only file is still DECLARED
      // above -- that is the entire reason it was discovered -- but nothing reads
      // its tree, so retaining one would be pure cost. Retention is this design's
      // one real expense, so it is not paid for a consumer that does not exist.
      if (Transpiler._producesOutput(file)) {
        this.declaredFiles.set(file.path, {
          tree,
          tokenStream,
          declarationCount,
          symbols: tSymbols,
        });
      }

      // ADR-055 Phase 7: Store TSymbol directly in SymbolTable (no ISymbol conversion)
      CodeGenState.symbolTable.addTSymbols(tSymbols);

      // Issue #465: Store ICodeGenSymbols for external enum resolution in stage 5
      const symbolInfo = TSymbolInfoAdapter.convert(tSymbols);
      this.state.setFileSymbolInfo(file.path, symbolInfo);

      // Issue #593: collect modification analysis.
      // Issue #1171: this ran in C++ mode only, so "does this callee modify
      // its parameter?" was answered from accumulated cross-file data in C++
      // and from per-file data alone in C. The analysis itself is
      // language-neutral, so both modes now share the one answer.
      const results = this.codeGenerator.analyzeModificationsOnly(
        tree,
        this.modificationAnalyzer.getModifications(),
        this.modificationAnalyzer.getParamLists(),
      );
      this.modificationAnalyzer.accumulateResults(results);
    } catch (err) {
      // Symbol collection errors (e.g., BitmapCollector) — format as "Code generation failed"
      const rawMessage = err instanceof Error ? err.message : String(err);
      const parsed = ParserUtils.parseErrorLocation(rawMessage);
      return [
        {
          line: parsed.line,
          column: parsed.column,
          message: `Code generation failed: ${parsed.message}`,
          severity: "error",
        },
      ];
    }

    return null;
  }

  /**
   * Stage 5: Transpile a single C-Next file.
   *
   * Assumes the symbol table is already populated (stages 2-3 complete).
   * Directly updates this.state and this.modificationAnalyzer.
   */
  private _transpileFile(file: IPipelineFile): IFileResult {
    const sourcePath = file.path;

    // #1241: attribute ADR provenance from here, not from codegen. Analyzers run
    // before the generator is initialized, so a rule firing in `runAnalyzers`
    // would otherwise be credited to the PREVIOUS file -- or dropped on the
    // first, which reads identically to "this rule never fires".
    AdrProvenance.beginFile(sourcePath);

    try {
      // #1301: the parse and the declare Stage 3 already performed for this file.
      // There is no parse-if-absent fallback on purpose -- that fallback is the
      // duplicate path this removes. Stage 5 walks a subset of the same
      // `input.cnextFiles` Stage 3 walked, and Stage 3 aborts the run on a parse
      // error before Stage 5 begins, so a miss means the pipeline ran out of
      // order and must say so rather than quietly reparse.
      const declared = this.declaredFiles.get(sourcePath);
      // This branch is an ASSERTION, not a covered path, and is deliberately left
      // uncovered: `_transpileFile` has one caller, downstream of a stage 3 that
      // aborts the run on any error, so nothing reachable through the public API
      // can miss. It cannot be mutation-checked either -- mis-keying the cache
      // returns a WRONG entry, never `undefined`, so that mutation exercises the
      // key rather than this guard. It surfaces as a user-facing
      // `Code generation failed: ...` at line 1 via `buildCatchResult`, since the
      // message carries no `N:M` prefix for `parseErrorLocation` to find.
      if (!declared) {
        throw new Error(
          `${sourcePath} reached code generation without being declared`,
        );
      }
      const { tree, tokenStream, declarationCount } = declared;

      // Parse only mode
      if (this.config.parseOnly) {
        return this.buildParseOnlyResult(sourcePath, declarationCount);
      }

      // Build symbolInfo for code generation (before analyzers so they can read it)
      //
      // #1301 review: recomputed here rather than cached with the tree, because
      // unlike the tree it is ORDER-SENSITIVE. `_collectExternalEnumSources` reads
      // `state.getSymbolInfoByFileMap()`, which stage 3 fills incrementally, and
      // `TransitiveEnumCollector` silently skips a file not yet in it. Under a
      // cyclic include graph `DependencyGraph.getSortedFiles()` catches the
      // toposort failure and returns insertion order with only a warning, so a
      // file can be declared before the file defining the scope types it uses.
      // Stage 5 runs after stage 3 has finished and the map is complete, so
      // computing it here is what makes the answer whole -- the pass this issue
      // removed was not only recomputing, it was repairing.
      // Regression: tests/bugs/issue-1301-cyclic-include-enum-sources/.
      const externalEnumSources = this._collectExternalEnumSources(
        sourcePath,
        file.cnextIncludes,
      );
      let symbolInfo = TSymbolInfoAdapter.convert(declared.symbols);

      if (externalEnumSources.length > 0) {
        symbolInfo = TSymbolInfoAdapter.mergeExternalSymbols(
          symbolInfo,
          externalEnumSources,
        );
      }

      // Issue #948/#958: Merge truly opaque types from C/C++ headers
      // Query-time resolution filters out types whose struct body has been found
      const externalOpaqueTypes = CodeGenState.symbolTable
        .getAllOpaqueTypes()
        .filter((t) => CodeGenState.symbolTable.isOpaqueType(t));
      if (externalOpaqueTypes.length > 0) {
        symbolInfo = TSymbolInfoAdapter.mergeOpaqueTypes(
          symbolInfo,
          externalOpaqueTypes,
        );
      }

      // Make symbols available to analyzers (CodeGenerator.generate() sets this too)
      CodeGenState.symbols = symbolInfo;

      // #1399 review: computed during discovery from the resolver's own
      // categorization, not re-derived from `#include` token text here.
      CodeGenState.currentFileReachesForeignHeader =
        file.reachesForeignHeader ?? true;

      // Run analyzers (reads symbols, externalStructFields, and symbolTable from CodeGenState)
      const analyzerErrors = runAnalyzers(tree, tokenStream);
      if (analyzerErrors.length > 0) {
        return this.buildErrorResult(
          sourcePath,
          analyzerErrors,
          declarationCount,
        );
      }

      // Inject cross-file modification data for const inference
      this._setupCrossFileModifications();

      // Generate code
      // Use file's sourceRelativePath (source mode) or compute from PathResolver (files mode)
      const sourceRelativePath =
        file.sourceRelativePath ??
        this.pathResolver.getSourceRelativePath(sourcePath);
      const code = this.codeGenerator.generate(tree, tokenStream, {
        debugMode: this.config.debugMode,
        target: this.config.target,
        sourcePath,
        cppMode: this.cppDetected,
        symbolInfo,
        sourceRelativePath,
      });

      // Collect user includes
      const userIncludes = IncludeExtractor.collectUserIncludes(
        tree,
        this.outputExtensions.header,
      );
      // Issue #424: kept separate — added to the header only when it names a
      // macro that one of these supplies (see _headerNeedsMacroIncludes).
      this.state.setUserIncludes(
        `${sourcePath}\u0000c-headers`,
        IncludeExtractor.collectCHeaderIncludes(tree),
      );

      // Get pass-by-value params (snapshot before next file clears it)
      const passByValue = this.codeGenerator.getPassByValueParams();
      const passByValueCopy = MapUtils.deepCopyStringSetMap(passByValue);

      // Directly update state (no contribution round-trip)
      this.state.setSymbolInfo(sourcePath, symbolInfo);
      this.state.setPassByValueParams(sourcePath, passByValueCopy);
      this.state.setUserIncludes(sourcePath, [...userIncludes]);

      // Issue #1171: accumulate in both modes -- see the gate removed above.
      this._accumulateFileModifications();

      // Generate header content (reads from state populated above)
      const headerCode = this.generateHeaderForFile(file) ?? undefined;

      // Issue #1143: read after header generation -- a header can carry
      // requirements of its own -- and before the next file's
      // CodeGenState.reset() clears the recording map.
      const requirements = this.codeGenerator.getToolchainRequirements();

      return this.buildSuccessResult(
        sourcePath,
        code,
        headerCode,
        declarationCount,
        requirements,
      );
    } catch (err) {
      return this.buildCatchResult(sourcePath, err);
    }
  }

  /**
   * Accumulate cross-file modification data from the code generator into the
   * centralized modification analyzer.
   *
   * Issue #1171: this runs in both C and C++ mode. The data feeds #268
   * auto-const, which is wrong in either language if a parameter forwarded to
   * a cross-file mutating callee is treated as unmodified.
   */
  private _accumulateFileModifications(): void {
    const fileModifications = this.codeGenerator.getModifiedParameters();
    const modifiedParameters = new Map<string, Set<string>>();
    for (const [funcName, params] of fileModifications) {
      modifiedParameters.set(funcName, new Set(params));
    }

    const fileParamLists = this.codeGenerator.getFunctionParamLists();
    const functionParamLists = new Map<string, readonly string[]>();
    for (const [funcName, params] of fileParamLists) {
      functionParamLists.set(funcName, [...params]);
    }

    this.modificationAnalyzer.accumulateModifications(modifiedParameters);
    this.modificationAnalyzer.accumulateParamLists(functionParamLists);
  }

  // ===========================================================================
  // File Discovery
  // ===========================================================================

  /**
   * Build IPipelineInput from a source string (standalone mode).
   *
   * Absorbs what StandaloneContextBuilder used to do, but returns data
   * instead of performing side effects.
   */
  private _discoverFromSource(
    source: string,
    workingDir: string,
    additionalIncludeDirs: string[],
    sourcePath: string,
  ): IPipelineInput {
    // Build search paths
    const searchPaths = IncludeResolver.buildSearchPaths(
      workingDir,
      this.config.includeDirs,
      additionalIncludeDirs,
      undefined,
      this.fs,
    );

    // Resolve includes from source content
    const resolver = new IncludeResolver(
      searchPaths,
      this.outputExtensions.header,
      this.fs,
    );
    const resolved = resolver.resolve(source, sourcePath);
    this.warnings.push(...resolved.warnings);

    // Resolve C/C++ headers transitively
    const { headers: allHeaders, warnings: headerWarnings } =
      IncludeResolver.resolveHeadersTransitively(
        resolved.headers,
        [...this.config.includeDirs],
        {
          onDebug: this.config.debugMode
            ? (msg) => console.log(`[DEBUG] ${msg}`)
            : undefined,
          processedPaths: this.state.getProcessedHeadersSet(),
          fs: this.fs,
        },
      );
    this.warnings.push(...headerWarnings);

    // Store header include directives
    for (const header of allHeaders) {
      const directive = resolved.headerIncludeDirectives.get(header.path);
      if (directive) {
        this.state.setHeaderDirective(header.path, directive);
      }
    }

    // Issue #854: Store header directives for cnext includes
    for (const cnxInclude of resolved.cnextIncludes) {
      const includePath = resolve(cnxInclude.path);
      const directive = resolved.headerIncludeDirectives.get(includePath);
      if (directive) {
        this.state.setHeaderDirective(includePath, directive);
      }
    }

    // Walk C-Next includes transitively to build include file list
    const cnextIncludeFiles: IPipelineFile[] = [];
    IncludeTreeWalker.walk(
      resolved.cnextIncludes,
      this.config.includeDirs,
      (file) => {
        cnextIncludeFiles.push({
          path: file.path,
          discoveredFile: file,
          symbolOnly: true,
        });
      },
    );

    // Build the main file (with in-memory source and cnextIncludes for enum resolution)
    // Source mode uses basename for self-include to match files mode behavior
    const mainFile: IPipelineFile = {
      path: sourcePath,
      source,
      discoveredFile: {
        path: sourcePath,
        type: EFileType.CNext,
        extension: ".cnx",
      },
      cnextIncludes: resolved.cnextIncludes,
      sourceRelativePath: basename(sourcePath),
      // Source mode has a single entry and `allHeaders` is already the
      // transitive header set for the run, so one answer covers every file in
      // it. No graph walk is needed or available here.
      reachesForeignHeader: resolved.hasForeignInclude,
    };

    // Includes first (symbols must be collected before main file code gen),
    // then main file
    return {
      cnextFiles: [
        ...cnextIncludeFiles.map((f) => ({
          ...f,
          reachesForeignHeader: resolved.hasForeignInclude,
        })),
        mainFile,
      ],
      headerFiles: allHeaders,
      writeOutputToDisk: false,
    };
  }

  // ===========================================================================
  // Pipeline Helper Methods
  // ===========================================================================

  /**
   * Initialize a fresh result object
   */
  private _initResult(): ITranspilerResult {
    return {
      success: true,
      files: [],
      filesProcessed: 0,
      symbolsCollected: 0,
      errors: [],
      warnings: [],
      outputFiles: [],
    };
  }

  /**
   * Initialize run state: cache, analyzers, symbol table
   */
  /**
   * Does this file produce output in this run?
   *
   * ONE decision with three consumers: stage 3 caches a parse only for files that
   * will read it back, stage 5 generates the code, stage 6 writes the header. A
   * `symbolOnly` file is discovered purely to contribute symbols, so it is declared
   * like any other but never emitted.
   *
   * #1301 review: stages 5 and 6 already asked this question with their own inline
   * `file.symbolOnly` checks, and gating the stage 3 cache write would have made it
   * a three-place decision -- CLAUDE.md's worst anti-pattern, and pre-existing here
   * rather than introduced. Changing what "produces output" means is now one edit.
   */
  private static _producesOutput(file: IPipelineFile): boolean {
    return !file.symbolOnly;
  }

  private async _initializeRun(): Promise<void> {
    if (this.cacheManager) {
      await this.cacheManager.initialize();
    }
    // Issue #593: Reset cross-file modification tracking for new run
    this.modificationAnalyzer.clear();
    // Issue #587: Reset accumulated state for new run
    this.state.reset();
    // ADR-049: the previous run's targets must not decide this run's budget
    this.pragmaTargets = [];
    // Issue #634: Reset symbol table for new run
    CodeGenState.symbolTable.clear();
    // Reset SymbolRegistry for new run (new IFunctionSymbol type system)
    SymbolRegistry.reset();
    // Reset callback-compatible functions for new run
    // (populated by FunctionCallAnalyzer, persists through CodeGenState.reset())
    CodeGenState.callbackCompatibleFunctions = new Map();
    // Issue #1241: the previous run's ADR provenance is not this run's evidence
    AdrProvenance.reset();
  }

  /**
   * Ensure output directories exist
   */
  private _ensureOutputDirectories(): void {
    if (this.config.outDir && !this.fs.exists(this.config.outDir)) {
      this.fs.mkdir(this.config.outDir, { recursive: true });
    }
    if (this.config.headerOutDir && !this.fs.exists(this.config.headerOutDir)) {
      this.fs.mkdir(this.config.headerOutDir, { recursive: true });
    }
  }

  /**
   * Stage 2: Collect symbols from all C/C++ headers
   * Issue #945: Made async for preprocessing support.
   */
  private async _collectAllHeaderSymbols(
    headerFiles: IDiscoveredFile[],
    result: ITranspilerResult,
  ): Promise<void> {
    const precedingHeaders: string[] = [];
    for (const file of headerFiles) {
      let usable = false;
      try {
        usable = await this.doCollectHeaderSymbols(file, precedingHeaders);
        result.filesProcessed++;
      } catch (err) {
        this.warnings.push(`Failed to process header ${file.path}: ${err}`);
      }
      // Offer this header as macro context to headers processed after it, but
      // only if it itself preprocessed cleanly — an unpreprocessable predecessor
      // would otherwise make every dependent's -imacros retry fail.
      if (usable) {
        precedingHeaders.push(file.path);
      }
    }
  }

  /**
   * Issue #985 recovery: recover the NAMES of framework functions / function-like
   * macros that standalone header preprocessing missed, by preprocessing each
   * .cnx's C includes as a translation unit (predecessors first — the way the
   * real compiler does). Requires a toolchain that can preprocess the target's
   * headers; for cross targets set CNEXT_CROSS_COMPILER. Gated on a preprocess
   * failure so clean projects pay nothing.
   */
  private async _collectExternalDeclarations(
    input: IPipelineInput,
  ): Promise<void> {
    if (!this.anyHeaderPreprocessFailed) return;

    const directives = this._collectCIncludeDirectives(input);
    if (directives.length === 0) return;

    const recovery = await ExternalDeclarationOracle.recover(
      directives,
      this.preprocessor,
      { includePaths: this.config.includeDirs, defines: this.config.defines },
    );
    if (!recovery) return;

    const cleanState = this._parseRecoveredSlices(recovery.perFileContent);
    Transpiler._clearPhantomStructBodies(cleanState);

    // Function-like macros have no declaration to parse; register their names for
    // the undeclared-call check only (a by-value macro invocation is correct).
    if (recovery.macroNames.size > 0) {
      CodeGenState.symbolTable.addExternalDeclarationNames(recovery.macroNames);
    }
  }

  /** Every C header the .cnx files include, deduped in first-seen source order. */
  private _collectCIncludeDirectives(input: IPipelineInput): string[] {
    const seen = new Set<string>();
    const directives: string[] = [];
    for (const file of input.cnextFiles) {
      const source = file.source ?? this.readFileOrEmpty(file.path);
      for (const directive of Transpiler.extractCIncludeDirectives(source)) {
        if (!seen.has(directive)) {
          seen.add(directive);
          directives.push(directive);
        }
      }
    }
    return directives;
  }

  /**
   * Parse each header's own preprocessed slice with the real header parser so
   * recovered symbols carry FULL types — function signatures, typedefs, opaque
   * structs — not just names. Each slice is macro-expanded (so e.g. FreeRTOS
   * PRIVILEGED_FUNCTION is gone and vTaskDelay parses) yet small (no inlined
   * tree, so ANTLR error-recovery doesn't drop declarations). Codegen needs
   * these to pass structs by address (twai_driver_install(&cfg)) and treat
   * opaque framework types as pointers (lv_obj_t -> lv_obj_t*).
   *
   * A second, isolated table is parsed in parallel and returned: it is clean of
   * the normal pass's degraded-blob data, so it holds the AUTHORITATIVE
   * opaque/struct-body truth. parseCHeader (main table) auto-detects C vs C++ and
   * skips assembler; the isolated table uses the C parser directly (opaque struct
   * typedefs are a C concern) and tolerates slices it cannot parse.
   */
  private _parseRecoveredSlices(
    perFileContent: Map<string, string>,
  ): SymbolTable {
    const cleanState = new SymbolTable();
    for (const [path, content] of perFileContent) {
      try {
        this.parseCHeader(content, path);
      } catch {
        // A slice that won't parse leaves the (already-collected) symbols as they
        // were — skip it rather than fail the build.
      }
      const { tree } = HeaderParser.parseC(content);
      if (!tree) continue;
      try {
        CResolver.resolve(tree, path, cleanState);
      } catch {
        /* isolated best-effort — only its opaque/body verdict is consulted */
      }
    }
    return cleanState;
  }

  /**
   * Undo PHANTOM struct bodies: when the normal pass parsed a header's huge
   * preprocessed blob, ANTLR error-recovery could fabricate a `struct X { ... }`
   * that was never really there (e.g. lvgl `struct _lv_obj_t`), which makes an
   * opaque typedef look complete and defeats pointer codegen. The clean per-file
   * re-parse (`cleanState`) is authoritative, so for every type it proves opaque,
   * clear any body its tag does NOT actually have.
   */
  private static _clearPhantomStructBodies(cleanState: SymbolTable): void {
    const cleanBodies = new Set(cleanState.getAllStructTagsWithBodies());
    for (const typedefName of cleanState.getAllOpaqueTypes()) {
      if (!cleanState.isOpaqueType(typedefName)) continue;
      const tag = CodeGenState.symbolTable.getStructTagForTypedef(typedefName);
      if (tag && !cleanBodies.has(tag)) {
        CodeGenState.symbolTable.clearStructTagHasBody(tag);
      }
    }
  }

  /** Extract C header include directives (`<...>` / `"..."`, non-.cnx) in order. */
  private static extractCIncludeDirectives(source: string): string[] {
    const directives: string[] = [];
    const re = /^[ \t]*#include\s+([<"][^>"]+[>"])/gm;
    for (const match of source.matchAll(re)) {
      const spec = match[1];
      if (/\.cnx[>"]$/.test(spec)) continue; // C-Next include, not a C header
      directives.push(spec);
    }
    return directives;
  }

  private readFileOrEmpty(path: string): string {
    try {
      return this.fs.readFile(path);
    } catch {
      return "";
    }
  }

  /**
   * Stage 4b: Reject two source files that would produce the same include guard.
   *
   * ADR-063 builds the guard from the project-relative path in upper case, with
   * non-alphanumerics collapsed to `_`. That keeps the generated artifact
   * readable but is NOT injective — the case change is lossy, so `mod-a.cnx` and
   * `mod_a.cnx` both land on CNX_MOD_A_H, as do filenames differing only by
   * case. This check is what makes that residue loud instead of silent: before
   * it, the preprocessor skipped the second header and the program ran with an
   * implicitly-declared function and a wrong value (#1133).
   *
   * @returns true when every guard is unique
   */
  private _checkIncludeGuardCollisions(
    cnextFiles: IPipelineFile[],
    result: ITranspilerResult,
  ): boolean {
    const sourceByGuard = new Map<string, string>();

    for (const file of cnextFiles) {
      const guard = HeaderGeneratorUtils.makeGuard(
        this._guardIdentity(file.path),
      );
      const existing = sourceByGuard.get(guard);

      if (existing === undefined) {
        sourceByGuard.set(guard, file.path);
        continue;
      }

      // The code is embedded in the message: ITranspileError carries no `code`
      // field, and runAnalyzers formats analyzer codes the same way.
      result.errors.push({
        line: 1,
        column: 0,
        message:
          `error[E0203]: Source files '${basename(existing)}' and '${basename(file.path)}' both ` +
          `produce the include guard '${guard}'. Rename one so the generated headers stay distinguishable.`,
        severity: "error",
      });
      result.success = false;
    }

    return result.success;
  }

  /**
   * Stage 4: Check for symbol conflicts
   * @returns true if no blocking conflicts, false otherwise
   */
  private _checkSymbolConflicts(result: ITranspilerResult): boolean {
    const conflicts = CodeGenState.symbolTable.getConflicts();
    for (const conflict of conflicts) {
      // #1334: a conflict is an ordinary diagnostic. It used to reach the user
      // through a SECOND channel -- `result.conflicts`, printed by ResultPrinter
      // with a `Conflict:` prefix that duplicated the message's own `Symbol
      // conflict:` prefix -- plus ONE companion error with no position hardcoded at
      // 1:0. Two outputs for one problem, and the only diagnostic path in the
      // transpiler with no error code.
      //
      // Now: one error per conflict, at the offending definition, coded like
      // every other diagnostic. The code is embedded in the message because
      // ITranspileError carries no `code` field -- the same precedent E0203 uses
      // above, and how runAnalyzers formats analyzer codes.
      //
      // The channel is retired whole: `ITranspilerResult.conflicts` is gone along
      // with its reader, so a conflict has ONE representation in the result. Deleting
      // only the reader would have left a field written here and read nowhere, which
      // `npx knip` cannot see -- it does not analyze interface fields.
      // IConflict.severity is `"error"`, so this is unconditional by construction.
      result.success = false;
      result.errors.push(Transpiler._conflictToError(conflict));
    }

    return result.success;
  }

  /**
   * The one rendering of a conflict as a diagnostic.
   *
   * Both conflict checks used to do this themselves and disagreed on both halves:
   * one read `conflict.line`, the other re-derived it from `definitions[0]`; one
   * hardcoded `error[E0425]`, the other embedded `error[E0204]` in the message
   * text. They were written against different bases and merged into `main`
   * without either CI run seeing the other (#1339 + #1342), which is how `main`
   * came to fail `tsc`.
   *
   * Anchored to a file even in single-file builds: the message runs to several
   * lines, and the CLI's reader only accumulates continuation lines under a
   * `path:line:col` header -- without a sourcePath the colliding names are
   * printed and then dropped on the way to a snapshot.
   */
  private static _conflictToError(conflict: IConflict): ITranspileError {
    return {
      line: conflict.line,
      column: conflict.column,
      sourcePath: conflict.sourceFile,
      message: `error[${conflict.code}]: ${conflict.message}`,
      severity: conflict.severity,
    };
  }

  /**
   * Stage 4c: Reject external identifiers that are not distinct within the
   * target's significant-character limit (MISRA C:2012 Rule 5.1, issue #1307).
   *
   * A sibling of Stage 4b rather than part of Stage 4: a symbol *conflict* is
   * two declarations competing for one name, which is a fact about the symbol
   * table. This is a fact about the C target -- the same two declarations are
   * fine at 63 significant characters and wrong at 31 -- so it is reported as a
   * coded diagnostic against a source line, the way E0203 is, instead of going
   * through the untyped `conflicts` channel.
   *
   * @returns true when every external identifier is distinct within the budget
   */
  private _checkExternalIdentifierSignificance(
    result: ITranspilerResult,
  ): boolean {
    // NOT CodeGenState.targetCapabilities: codegen assigns that in Stage 5, one
    // stage after this runs, so it holds the module default on a fresh process
    // and the previous file's target in a long-lived one (#1307 review). The
    // budget a whole-program check reports against has to be the build's.
    const collisions = CodeGenState.symbolTable.detectMISRA51Conflicts(
      TargetResolver.forRun(this.config.target, this.pragmaTargets),
    );

    for (const collision of collisions) {
      result.errors.push(Transpiler._conflictToError(collision));
      result.success = false;
    }

    return result.success;
  }

  /**
   * Record file result and optionally write output to disk
   */
  private _recordFileResult(
    file: IDiscoveredFile,
    fileResult: IFileResult,
    result: ITranspilerResult,
    writeOutputToDisk: boolean,
    pendingWrites: { path: string; content: string }[],
  ): void {
    let outputPath: string | undefined;
    if (
      writeOutputToDisk &&
      this.config.outDir &&
      fileResult.success &&
      fileResult.code
    ) {
      outputPath = this.pathResolver.getOutputPath(
        file,
        this.outputExtensions.source,
      );
      // #1233: queued, not written -- the caller flushes only if the whole run
      // succeeds, matching how Stage 6 already gates headers.
      pendingWrites.push({ path: outputPath, content: fileResult.code });
    }

    result.files.push({ ...fileResult, outputPath });
    result.filesProcessed++;

    if (!fileResult.success) {
      result.success = false;
      result.errors.push(
        ...fileResult.errors.map((e) => ({
          ...e,
          sourcePath: fileResult.sourcePath,
        })),
      );
    } else if (outputPath) {
      result.outputFiles.push(outputPath);
    }
  }

  /**
   * Stage 6: Write the headers Stage 5 generated for pipeline files.
   *
   * Issue #1139: this stage used to call generateHeaderForFile() a second time,
   * once per file, after every file had been transpiled. That function reads
   * live CodeGenState — which is per-file — so by then it saw only the
   * last-transpiled file's data and rebuilt every other file's header from it.
   * A dependency lost the ADR-006 auto-const its own .c definition carried,
   * giving conflicting types. Single-file builds hid it because the only file
   * is also the last one.
   *
   * The header each file needs was already produced in _transpileFile(), at the
   * one moment its state was warm. Writing that result keeps the derivation in
   * one place instead of performing it twice and shipping the wrong copy.
   */
  private _generateAllHeadersFromPipeline(
    cnextFiles: IPipelineFile[],
    result: ITranspilerResult,
  ): void {
    const headersBySourcePath = new Map<string, string>();
    for (const fileResult of result.files) {
      if (fileResult.headerCode) {
        headersBySourcePath.set(fileResult.sourcePath, fileResult.headerCode);
      }
    }

    for (const file of cnextFiles) {
      if (!Transpiler._producesOutput(file)) {
        continue;
      }
      const headerContent = headersBySourcePath.get(file.path);
      if (headerContent) {
        // Issue #933: .hpp in C++ mode, so C and C++ headers cannot overwrite
        const headerPath = this.pathResolver.getHeaderOutputPath(
          file.discoveredFile,
          this.outputExtensions.header,
        );
        this.fs.writeFile(headerPath, headerContent);
        result.outputFiles.push(headerPath);
      }
    }
  }

  /**
   * Finalize result: merge warnings, flush cache
   */
  private async _finalizeResult(
    result: ITranspilerResult,
    warning?: string,
  ): Promise<ITranspilerResult> {
    if (warning) {
      result.warnings.push(warning);
    }
    result.symbolsCollected = CodeGenState.symbolTable.size;
    result.warnings = [...result.warnings, ...this.warnings];
    // Issue #1143: union of what each file's emitters recorded.
    result.requirements = RequirementAggregator.merge(result.files);
    // Issue #1241: every position at which an ADR's rule fired this run.
    result.adrSites = AdrProvenance.collect();

    if (this.cacheManager) {
      await this.cacheManager.flush();
    }
    return result;
  }

  /**
   * Handle errors during run
   */
  private _handleRunError(
    result: ITranspilerResult,
    err: unknown,
  ): ITranspilerResult {
    result.errors.push({
      line: 1,
      column: 0,
      message: `Pipeline failed: ${err}`,
      severity: "error",
    });
    result.success = false;
    result.warnings = [...result.warnings, ...this.warnings];
    return result;
  }

  // ===========================================================================
  // File Discovery (Stage 1 for files mode)
  // ===========================================================================

  /**
   * Discover C-Next files from a single input (file or directory).
   */
  /**
   * Collect headers from resolved includes, filtering out generated ones.
   */
  private _collectHeaders(
    resolved: {
      headers: IDiscoveredFile[];
      headerIncludeDirectives: Map<string, string>;
    },
    cnextBaseNames: Set<string>,
    headerSet: Map<string, IDiscoveredFile>,
  ): void {
    for (const header of resolved.headers) {
      const headerBaseName = basename(header.path).replace(
        /\.h$|\.hpp$|\.hxx$|\.hh$/,
        "",
      );
      if (cnextBaseNames.has(headerBaseName)) {
        continue;
      }
      headerSet.set(header.path, header);
      // Issue #497: Store the include directive for this header
      const directive = resolved.headerIncludeDirectives.get(header.path);
      if (directive) {
        this.state.setHeaderDirective(header.path, directive);
      }
    }
  }

  /**
   * Process C-Next includes from resolved includes.
   * Issue #461: Collect included .cnx files for symbol resolution
   * Issue #580: Track dependencies for topological sorting
   */
  private _processCnextIncludes(
    resolved: {
      cnextIncludes: IDiscoveredFile[];
      headerIncludeDirectives: Map<string, string>;
    },
    cnxPath: string,
    depGraph: DependencyGraph,
    cnextFiles: IDiscoveredFile[],
    cnextBaseNames: Set<string>,
    fileByPath: Map<string, IDiscoveredFile>,
  ): void {
    for (const cnxInclude of resolved.cnextIncludes) {
      const includePath = resolve(cnxInclude.path);
      const includeBaseName = basename(includePath).replace(
        /\.cnx$|\.cnext$/,
        "",
      );

      depGraph.addDependency(cnxPath, includePath);

      // Issue #854: Store header directive for cnext include types
      const directive = resolved.headerIncludeDirectives.get(includePath);
      if (directive) {
        this.state.setHeaderDirective(includePath, directive);
      }

      // Don't add if already in the list.
      //
      // Issue #1134: identity here is the RESOLVED PATH, never the basename.
      // Keying on the basename made can/config.cnx and uart/config.cnx the same
      // file, so the second was dropped from the compilation entirely — the
      // transpiler exited 0 and emitted C-Next source syntax into the C output.
      // `cnextBaseNames` still tracks base names, but only for header shadowing
      // in _collectHeaders; it is not a file identity.
      const alreadyExists = cnextFiles.some(
        (f) => resolve(f.path) === includePath,
      );
      if (!alreadyExists) {
        cnextFiles.push(cnxInclude);
        cnextBaseNames.add(includeBaseName);
        fileByPath.set(includePath, cnxInclude);
      }
    }
  }

  /**
   * Process a single C-Next file's includes.
   */
  private _processFileIncludes(
    cnxFile: IDiscoveredFile,
    depGraph: DependencyGraph,
    cnextFiles: IDiscoveredFile[],
    cnextBaseNames: Set<string>,
    headerSet: Map<string, IDiscoveredFile>,
    fileByPath: Map<string, IDiscoveredFile>,
    directForeignHeaderFiles: Set<string>,
  ): void {
    const cnxPath = resolve(cnxFile.path);
    depGraph.addFile(cnxPath);

    const content = this.fs.readFile(cnxFile.path);

    // Build search paths for this file
    const sourceDir = dirname(cnxFile.path);
    const additionalIncludeDirs = IncludeDiscovery.discoverIncludePaths(
      cnxFile.path,
      this.fs,
    );
    const searchPaths = IncludeResolver.buildSearchPaths(
      sourceDir,
      this.config.includeDirs,
      additionalIncludeDirs,
      undefined,
      this.fs,
    );

    // Resolve includes
    const resolver = new IncludeResolver(
      searchPaths,
      this.outputExtensions.header,
      this.fs,
    );
    const resolved = resolver.resolve(content, cnxFile.path);

    if (resolved.hasForeignInclude) {
      directForeignHeaderFiles.add(cnxPath);
    }

    this._collectHeaders(resolved, cnextBaseNames, headerSet);
    this._processCnextIncludes(
      resolved,
      cnxPath,
      depGraph,
      cnextFiles,
      cnextBaseNames,
      fileByPath,
    );

    this.warnings.push(...resolved.warnings);
  }

  /**
   * Sort files topologically and convert paths to IDiscoveredFile array.
   */
  private _sortFilesByDependency(
    depGraph: DependencyGraph,
    fileByPath: Map<string, IDiscoveredFile>,
  ): IDiscoveredFile[] {
    const sortedPaths = depGraph.getSortedFiles();
    this.warnings.push(...depGraph.getWarnings());

    const sortedFiles: IDiscoveredFile[] = [];
    for (const path of sortedPaths) {
      const file = fileByPath.get(path);
      if (file) {
        sortedFiles.push(file);
      }
    }
    return sortedFiles;
  }

  /**
   * Stage 1: Discover source files
   *
   * Unified include resolution: Discovers .cnx files from inputs, then
   * reads each file to extract and resolve its #include directives.
   * This ensures headers are found based on what the source actually
   * includes, not by blindly scanning include directories.
   */
  private async _discoverFromFiles(): Promise<IPipelineInput> {
    const entryPath = resolve(this.config.input);

    // Check if this is a C/C++ entry point
    if (InputExpansion.isCppEntryPoint(entryPath)) {
      return this._discoverFromCppEntryPoint(entryPath);
    }

    // Step 1: Discover entry point file (original .cnx entry point logic)
    const cnextFiles: IDiscoveredFile[] = [];
    const fileByPath = new Map<string, IDiscoveredFile>();

    const entryFile = FileDiscovery.discoverFile(entryPath, this.fs);
    if (entryFile?.type !== EFileType.CNext) {
      return { cnextFiles: [], headerFiles: [], writeOutputToDisk: true };
    }
    cnextFiles.push(entryFile);
    fileByPath.set(resolve(entryFile.path), entryFile);

    // Step 2: Build dependency graph, resolve headers, and return pipeline input
    return this._buildPipelineInput(cnextFiles, fileByPath);
  }

  /**
   * Discover C-Next files from a C/C++ entry point.
   *
   * Scans the include tree for headers with C-Next generation markers,
   * extracts the source .cnx paths, and returns them for transpilation.
   */
  private _discoverFromCppEntryPoint(entryPath: string): IPipelineInput {
    const entryDir = dirname(entryPath);
    const searchPaths = IncludeResolver.buildSearchPaths(
      entryDir,
      this.config.includeDirs,
      [],
      undefined,
      this.fs,
    );

    const scanner = new CppEntryPointScanner(searchPaths, this.fs);
    const scanResult = scanner.scan(entryPath);

    // Report errors and warnings
    // Prefix errors to distinguish from informational warnings
    for (const error of scanResult.errors) {
      this.warnings.push(`Error: ${error}`);
    }
    this.warnings.push(...scanResult.warnings);

    if (scanResult.noCNextFound) {
      return { cnextFiles: [], headerFiles: [], writeOutputToDisk: true };
    }

    // Convert discovered .cnx paths to IDiscoveredFile array
    const cnextFiles: IDiscoveredFile[] = scanResult.cnextSources.map(
      (path) => ({
        path,
        type: EFileType.CNext,
        extension: ".cnx",
      }),
    );

    // Build fileByPath map for dependency resolution
    const fileByPath = new Map<string, IDiscoveredFile>();
    for (const cnxFile of cnextFiles) {
      fileByPath.set(resolve(cnxFile.path), cnxFile);
    }

    // Scanner discovers .cnx files via header markers in the C/C++ include tree.
    // _buildPipelineInput then resolves direct .cnx-to-.cnx includes (e.g.,
    // #include "utils.cnx") which the scanner visits but doesn't add to sources.
    return this._buildPipelineInput(cnextFiles, fileByPath);
  }

  /**
   * Shared helper: Build pipeline input from discovered C-Next files.
   *
   * Processes includes, builds dependency graph, resolves headers transitively,
   * and converts to pipeline files. Used by both .cnx and C/C++ entry point paths.
   */
  private _buildPipelineInput(
    cnextFiles: IDiscoveredFile[],
    fileByPath: Map<string, IDiscoveredFile>,
  ): IPipelineInput {
    const headerSet = new Map<string, IDiscoveredFile>();
    const depGraph = new DependencyGraph();
    const cnextBaseNames = new Set(
      cnextFiles.map((f) => basename(f.path).replace(/\.cnx$|\.cnext$/, "")),
    );

    const directForeignHeaderFiles = new Set<string>();
    for (const cnxFile of cnextFiles) {
      this._processFileIncludes(
        cnxFile,
        depGraph,
        cnextFiles,
        cnextBaseNames,
        headerSet,
        fileByPath,
        directForeignHeaderFiles,
      );
    }

    // Include visibility is transitive, so the precondition for E0426/E0427
    // must be too.
    const reachesForeign = depGraph.collectDependentsOf(
      directForeignHeaderFiles,
    );

    // Issue #580: Sort files topologically for correct cross-file const inference
    const sortedCnextFiles = this._sortFilesByDependency(depGraph, fileByPath);

    // Resolve headers transitively
    const { headers: allHeaders, warnings: headerWarnings } =
      IncludeResolver.resolveHeadersTransitively(
        [...headerSet.values()],
        this.config.includeDirs,
        {
          onDebug: this.config.debugMode
            ? (msg) => console.log(`[DEBUG] ${msg}`)
            : undefined,
          processedPaths: this.state.getProcessedHeadersSet(),
          fs: this.fs,
        },
      );
    this.warnings.push(...headerWarnings);

    // Convert IDiscoveredFile[] to IPipelineFile[] (disk-based, all get code gen)
    const pipelineFiles: IPipelineFile[] = sortedCnextFiles.map((f) => ({
      path: f.path,
      discoveredFile: f,
      reachesForeignHeader: reachesForeign.has(resolve(f.path)),
    }));

    return {
      cnextFiles: pipelineFiles,
      headerFiles: allHeaders,
      writeOutputToDisk: true,
    };
  }

  // ===========================================================================
  // Header Symbol Collection
  // ===========================================================================

  /**
   * Stage 2: Collect symbols from a single C/C++ header
   * Issue #592: Recursive include processing moved to IncludeResolver.resolveHeadersTransitively()
   * Issue #945: Added preprocessing support for conditional compilation
   * SonarCloud S3776: Refactored to use helper methods for reduced complexity.
   */
  private async doCollectHeaderSymbols(
    file: IDiscoveredFile,
    precedingHeaders: readonly string[] = [],
  ): Promise<boolean> {
    // Track as processed (for cycle detection)
    const absolutePath = resolve(file.path);
    this.state.markHeaderProcessed(absolutePath);

    // Check cache first
    const restored = this.tryRestoreFromCache(file);
    if (restored) {
      return restored.usable; // Cache hit - skip full parsing
    }

    // Issue #945: Preprocess header to evaluate #if/#ifdef directives
    const { content, usable } = await this.getHeaderContent(
      file,
      precedingHeaders,
    );
    this.parseHeaderFile(file, content);

    // Debug: Show symbols found
    if (this.config.debugMode) {
      const symbols = CodeGenState.symbolTable.getSymbolsByFile(file.path);
      console.log(`[DEBUG]   Found ${symbols.length} symbols in ${file.path}`);
    }

    // Issue #590: Cache the results using simplified API. Issue #985: record when
    // this header fell back to raw content so a warm-cache build re-runs recovery.
    if (this.cacheManager) {
      this.cacheManager.setSymbolsFromTable(
        file.path,
        CodeGenState.symbolTable,
        !usable,
      );
    }

    return usable;
  }

  /**
   * Try to restore symbols from cache. Returns the restored header's usability
   * (whether it preprocessed cleanly) on a cache hit, or null on a miss.
   * SonarCloud S3776: Extracted from doCollectHeaderSymbols().
   */
  private tryRestoreFromCache(
    file: IDiscoveredFile,
  ): { usable: boolean } | null {
    if (!this.cacheManager?.isValid(file.path)) {
      return null;
    }

    const cached = this.cacheManager.getSymbols(file.path);
    if (!cached) {
      return null;
    }

    // Issue #1225: a cache entry that does not validate is a miss, not a
    // degraded hit. Returning null re-parses the header instead of continuing
    // with symbols we could not verify.
    if (!this.restoreCachedSymbols(cached.symbols)) {
      return null;
    }

    CodeGenState.symbolTable.restoreStructFields(cached.structFields);
    CodeGenState.symbolTable.restoreNeedsStructKeyword(
      cached.needsStructKeyword,
    );
    CodeGenState.symbolTable.restoreEnumBitWidths(cached.enumBitWidth);

    // Issue #1225: the whole struct state at once. It used to be four separate
    // restore calls, which is how #1164's pointerTypedefs was missed.
    CodeGenState.symbolTable.restoreStructState(cached.structState);

    // Issue #211: Still check for C++ syntax even on cache hit
    this.detectCppFromFileType(file);

    // Issue #985: The cached symbols of a header that fell back to raw content
    // are degraded. Re-arm the recovery gate so a warm-cache build still runs
    // the external-declaration recovery pass and re-applies its corrections to
    // the in-memory symbol table (the cache itself holds the degraded symbols).
    if (cached.preprocessFailed) {
      this.anyHeaderPreprocessFailed = true;
    }

    return { usable: !cached.preprocessFailed };
  }

  /**
   * Get header content, optionally preprocessed.
   * Issue #945: Evaluates #if/#ifdef directives using system preprocessor.
   *
   * Only preprocesses when necessary to avoid side effects from full expansion.
   * Preprocessing is needed when the file has conditional compilation patterns
   * like #if MACRO != 0 that require expression evaluation.
   */
  private async getHeaderContent(
    file: IDiscoveredFile,
    precedingHeaders: readonly string[] = [],
  ): Promise<{ content: string; usable: boolean }> {
    const rawContent = this.fs.readFile(file.path);

    // Check if preprocessing is disabled
    if (this.config.preprocess === false) {
      return { content: rawContent, usable: true };
    }

    // Check if preprocessing is available
    if (!this.preprocessor.isAvailable()) {
      return { content: rawContent, usable: true };
    }

    // Issue #945: Only preprocess if file has conditional compilation patterns
    // that require expression evaluation (e.g., #if MACRO != 0, #if MACRO == 1)
    // Simple #ifdef/#ifndef patterns are already handled by the parser
    if (!this.needsConditionalPreprocessing(rawContent)) {
      return { content: rawContent, usable: true };
    }

    // Preprocess the header file
    const result = await this.preprocessor.preprocess(file.path, {
      defines: this.config.defines,
      includePaths: this.config.includeDirs,
      keepLineDirectives: false, // We don't need line mappings for symbol collection
    });

    if (!result.success) {
      // Some headers cannot be preprocessed standalone: they require a
      // predecessor to have run first (e.g. FreeRTOS task.h needs FreeRTOS.h to
      // define INC_FREERTOS_H and its attribute macros, and enforces this with
      // its own #error). Retry importing the macros of the headers collected
      // before this one (only those that themselves preprocessed cleanly, so one
      // unpreprocessable predecessor can't defeat the retry).
      if (precedingHeaders.length > 0) {
        const retry = await this.preprocessor.preprocess(file.path, {
          defines: this.config.defines,
          includePaths: this.config.includeDirs,
          keepLineDirectives: false,
          imacros: [...precedingHeaders],
        });
        if (retry.success) {
          return { content: retry.content, usable: true };
        }
      }
      // Fall back to raw content. Mark not-usable so this header is not offered
      // as macro context to headers processed after it, and flag that TU-level
      // external-declaration recovery is warranted (Issue #985).
      this.anyHeaderPreprocessFailed = true;
      this.warnings.push(
        `Preprocessing failed for ${file.path}: ${result.error}. Using raw content.`,
      );
      return { content: rawContent, usable: false };
    }

    return { content: result.content, usable: true };
  }

  /**
   * Check if a header file needs conditional preprocessing.
   * Issue #945: Only preprocess files with #if expressions that need evaluation.
   */
  private needsConditionalPreprocessing(content: string): boolean {
    // Patterns that require the preprocessor for expression evaluation:
    // - #if MACRO != 0
    // - #if MACRO == 1
    // - #if MACRO > 0
    // - #if MACRO (bare macro as truthy check)
    // - #elif MACRO != 0
    // - #if defined(X) && MACRO
    // - etc.
    //
    // Simple patterns handled by the parser without preprocessing:
    // - #ifdef MACRO
    // - #ifndef MACRO
    // - #if defined(MACRO) (single defined check)
    // - #if 1
    // - #if 0
    //
    // Look for #if/#elif followed by an expression (not just defined() or 0/1)
    // Also match bare macro names used as truthy checks (common in config headers)
    const ifExpressionPattern =
      /#(?:if|elif)\s+(?!defined\s*\()(?![01]\s*(?:$|\n|\/\*|\/\/))\w+/m;
    return ifExpressionPattern.test(content);
  }

  /**
   * Issue #1225: revive cached symbols into the symbol table.
   *
   * This used to rebuild each symbol field by field from a flat
   * `ISerializedSymbol` -- the legacy model ADR-055 Phase 7 removed everywhere
   * else -- behind an `as TCSymbol` cast the union could not check. That cast
   * is what let #1214's dropped `isConst` compile, and the same shape dropped
   * `pointerTypedefs` here. The symbols now come back as themselves, so there
   * is nothing to convert and nothing to forget.
   *
   * @returns false if the entry failed validation, so the caller re-parses
   *   rather than continuing with symbols it could not verify.
   */
  private restoreCachedSymbols(encoded: TJsonValue[]): boolean {
    // Validation happens for every symbol before any is added, so a rejected
    // entry cannot leave half its symbols in the table.
    const symbols = CachedSymbolReader.read(encoded);
    if (symbols === null) {
      return false;
    }

    for (const symbol of symbols) {
      if (symbol.sourceLanguage === ESourceLanguage.C) {
        CodeGenState.symbolTable.addCSymbol(symbol);
      } else {
        CodeGenState.symbolTable.addCppSymbol(symbol);
      }
    }

    return true;
  }

  /**
   * Detect C++ mode based on file type and content.
   * SonarCloud S3776: Extracted from doCollectHeaderSymbols().
   */
  private detectCppFromFileType(file: IDiscoveredFile): void {
    if (file.type === EFileType.CppHeader) {
      // .hpp files are always C++
      this.raiseCppDetected();
      return;
    }

    if (file.type === EFileType.CHeader) {
      const content = this.fs.readFile(file.path);
      if (detectCppSyntax(content)) {
        this.raiseCppDetected();
      }
    }
  }

  /**
   * Parse a header file based on its type.
   * SonarCloud S3776: Extracted from doCollectHeaderSymbols().
   */
  private parseHeaderFile(file: IDiscoveredFile, content: string): void {
    if (file.type === EFileType.CHeader) {
      if (this.config.debugMode) {
        console.log(`[DEBUG]   Parsing C header: ${file.path}`);
      }
      this.parseCHeader(content, file.path);
      return;
    }

    if (file.type === EFileType.CppHeader) {
      // Issue #211: .hpp files are always C++
      this.raiseCppDetected();
      if (this.config.debugMode) {
        console.log(`[DEBUG]   Parsing C++ header: ${file.path}`);
      }
      this.parseCppHeader(content, file.path);
    }
  }

  /**
   * Issue #208: Parse a C header using single-parser strategy
   * Uses heuristic detection to choose the appropriate parser
   */
  private parseCHeader(content: string, filePath: string): void {
    // Assembler headers (e.g. xtensa coreasm.h, pulled in transitively by
    // FreeRTOS port headers) are not C. Parsing their `.macro` bodies as C
    // mis-collects instruction mnemonics like `loop` as C symbols that then
    // false-conflict with C-Next symbols of the same name. Skip them entirely.
    if (detectAssemblySyntax(content)) {
      if (this.config.debugMode) {
        console.log(`[DEBUG]   Skipping assembler header: ${filePath}`);
      }
      return;
    }

    if (detectCppSyntax(content)) {
      // Issue #211: C++ detected, set flag for .cpp output
      this.raiseCppDetected();
      // Use C++14 parser for headers with C++ syntax (typed enums, classes, etc.)
      this.parseCppHeader(content, filePath);
    } else {
      // Use C parser for pure C headers
      this.parsePureCHeader(content, filePath);
    }
  }

  /**
   * Issue #208: Parse a pure C header (no C++ syntax detected)
   * Uses CResolver for symbol collection
   * ADR-055 Phase 7: Direct TCSymbol storage (no adapter conversion)
   */
  private parsePureCHeader(content: string, filePath: string): void {
    const { tree } = HeaderParser.parseC(content);
    if (tree) {
      const result = CResolver.resolve(
        tree,
        filePath,
        CodeGenState.symbolTable,
      );
      // ADR-055 Phase 7: Store TCSymbol directly
      CodeGenState.symbolTable.addCSymbols(result.symbols);
    }
  }

  /**
   * Parse a C++ header using CppResolver
   * ADR-055 Phase 7: Direct TCppSymbol storage (no adapter conversion)
   */
  private parseCppHeader(content: string, filePath: string): void {
    const { tree } = HeaderParser.parseCpp(content);
    if (tree) {
      const result = CppResolver.resolve(
        tree,
        filePath,
        CodeGenState.symbolTable,
      );
      // ADR-055 Phase 7: Store TCppSymbol directly
      CodeGenState.symbolTable.addCppSymbols(result.symbols);
    }
  }

  // ===========================================================================
  // Code Generation Helpers
  // ===========================================================================

  /**
   * Path identifying a source file for include-guard construction (issue #1133).
   *
   * Anchored on the PROJECT ROOT, not the input directory, so the guard for a
   * given file does not depend on which entry point pulled it in. Building
   * `app.cnx` and building `can/config.cnx` directly must produce the same guard
   * for can/config.cnx — otherwise separately-compiled translation units
   * reintroduce the collision as soon as a consumer includes both headers.
   *
   * Falls back to the input directory when no project marker is found, and to
   * the basename for a file outside that base. Both fallbacks can in principle
   * map two files onto one guard; that is what E0203 is for.
   */
  private _guardIdentity(sourcePath: string): string {
    const base = this.projectRoot ?? dirname(resolve(this.config.input));
    const relativePath = relative(base, resolve(sourcePath));

    return relativePath.startsWith("..") || relativePath === ""
      ? basename(sourcePath)
      : relativePath;
  }

  /**
   * Stage 5: Generate header content for a single file's exported symbols.
   * ADR-055 Phase 7: Uses TSymbol directly, converts to IHeaderSymbol for generation.
   *
   * Unified method replacing both generateHeader() and generateHeaderContent().
   *
   * Reads live CodeGenState, which holds only the file currently being
   * transpiled. Call this exactly once per file, from _transpileFile(), while
   * that file's state is warm — calling it later rebuilds the header from
   * whichever file ran last (issue #1139).
   *
   * **Depends on topological file order.** Two of the reads below are
   * whole-project accumulators — `state.getAllSymbolInfo()` and
   * `state.getAllHeaderDirectives()` — and from here they hold only the files
   * transpiled *so far*, not the whole project as they did when this ran after
   * every file. That is sufficient because `_sortFilesByDependency()` orders
   * files by `depGraph.getSortedFiles()`, so every transitive dependency has
   * already been transpiled by the time its dependent's header is built.
   *
   * Anything added here that needs to see the *entire* project would therefore
   * be wrong, and a dependency cycle would break the ordering this relies on —
   * `_sortFilesByDependency` currently drains `depGraph.getWarnings()` into
   * warnings rather than failing, so cycle order is arbitrary (#1167).
   */
  /**
   * Issue #424/#1164: does this header name something only the source's own C
   * headers define, so that it cannot compile standalone?
   *
   * Two cases. A non-numeric array dimension is a macro the header uses but does
   * not define. An opaque typedef (`typedef struct opaque_t* handle_t`) cannot be
   * forward-declared as a struct, so it too has to come from its real header.
   *
   * Deliberately narrow: propagating every C include into every generated header
   * would put implementation-only dependencies into the public interface, and
   * would double-include any hand-written header lacking an include guard.
   */
  /**
   * A type the header names but cannot correctly declare for itself.
   *
   * The forward declaration the header would otherwise emit,
   * `typedef struct X X;`, is a guess: it is right only when X really is an
   * opaque struct. For `typedef struct opaque_t* handle_t` it declares a
   * different type and contradicts the real definition. When we know a C/C++
   * header declares the type, including that header beats guessing.
   */
  private static _needsDefiningHeader(typeName: string): boolean {
    if (CodeGenState.symbolTable.isPointerTypedef(typeName)) {
      return true;
    }

    // Known to a C/C++ header, but not as something forward-declarable.
    const declared =
      CodeGenState.symbolTable.getCppSymbol(typeName) ??
      CodeGenState.symbolTable.getCSymbol(typeName);
    if (!declared) {
      return false;
    }

    return (
      !CodeGenState.symbolTable.isOpaqueType(typeName) &&
      !declared.sourceFile.endsWith(".cnx")
    );
  }

  private static _headerNeedsUserCHeaders(symbols: TSymbol[]): boolean {
    return symbols.some((symbol) => {
      if (symbol.kind === "variable") {
        const namesMacroDimension =
          symbol.arrayDimensions?.some(
            (dimension) => typeof dimension === "string",
          ) ?? false;
        return (
          namesMacroDimension ||
          Transpiler._needsDefiningHeader(TypeResolver.getTypeName(symbol.type))
        );
      }

      if (symbol.kind === "function") {
        return (
          Transpiler._needsDefiningHeader(
            TypeResolver.getTypeName(symbol.returnType),
          ) ||
          symbol.parameters.some((parameter) =>
            Transpiler._needsDefiningHeader(
              TypeResolver.getTypeName(parameter.type),
            ),
          )
        );
      }

      return false;
    });
  }

  private generateHeaderForFile(file: IPipelineFile): string | null {
    const sourcePath = file.path;
    // Issues #1161/#1164: the same predicate decides whether this header is
    // written and whether the generated .c includes it. Do not re-derive it.
    const exportedSymbols = PublicInterface.forFile(
      CodeGenState.symbolTable,
      sourcePath,
    );

    if (exportedSymbols.length === 0) {
      return null;
    }

    // Issue #933: Use .hpp extension for include guard in C++ mode
    // Issue #1319: read the run's extension; do not re-derive it from the mode
    const ext = this.outputExtensions.header;
    const headerName = this._guardIdentity(sourcePath).replace(
      /\.cnx$|\.cnext$/,
      ext,
    );

    const typeInput = this.state.getSymbolInfo(sourcePath);
    const passByValueParams =
      this.state.getPassByValueParams(sourcePath) ??
      new Map<string, Set<string>>();
    const cnxIncludes = this.state.getUserIncludes(sourcePath) ?? [];
    // Issue #424: a dimension that is not a number is a macro the header names
    // but does not define, so the header must carry its source include.
    const cHeadersIncluded =
      Transpiler._headerNeedsUserCHeaders(exportedSymbols);
    const userIncludes = cHeadersIncluded
      ? [
          ...cnxIncludes,
          ...(this.state.getUserIncludes(`${sourcePath}\u0000c-headers`) ?? []),
        ]
      : cnxIncludes;

    const allKnownEnums = TransitiveEnumCollector.aggregateKnownEnums(
      this.state.getAllSymbolInfo(),
    );

    const externalTypeHeaders = ExternalTypeHeaderBuilder.build(
      this.state.getAllHeaderDirectives(),
      CodeGenState.symbolTable,
    );

    // ADR-029: Convert callback types to header format
    const callbackTypesForHeader = this._buildCallbackTypesForHeader();

    const typeInputWithSymbolTable = typeInput
      ? {
          ...typeInput,
          symbolTable: CodeGenState.symbolTable,
          callbackTypes: callbackTypesForHeader,
        }
      : undefined;

    const unmodifiedParams = this.codeGenerator.getFunctionUnmodifiedParams();
    const headerSymbols = this.convertToHeaderSymbols(
      exportedSymbols,
      unmodifiedParams,
      allKnownEnums,
    );

    return this.headerGenerator.generate(
      headerSymbols,
      headerName,
      {
        exportedOnly: true,
        userIncludes,
        cHeadersIncluded,
        // ADR-040: same flag the .c consults, so exactly one file emits it.
        needsIsrTypedef: CodeGenState.needsISR,
        externalTypeHeaders,
        cppMode: this.cppDetected,
      },
      typeInputWithSymbolTable,
      passByValueParams,
      allKnownEnums,
      basename(sourcePath),
    );
  }

  /**
   * ADR-029: Build callback types for header generation.
   * Only includes callbacks that are actually used as struct field types.
   * Converts CodeGenState.callbackTypes to the format expected by IHeaderTypeInput.
   */
  private _buildCallbackTypesForHeader(): ReadonlyMap<
    string,
    {
      typedefName: string;
      returnType: string;
      parameters: ReadonlyArray<{ type: string; isStruct: boolean }>;
    }
  > {
    const result = new Map<
      string,
      {
        typedefName: string;
        returnType: string;
        parameters: ReadonlyArray<{ type: string; isStruct: boolean }>;
      }
    >();

    // Issue #1164: same predicate the .c uses to decide it must NOT emit these.
    const usedCallbackTypes = new Set<string>();
    for (const funcName of CodeGenState.callbackTypes.keys()) {
      if (CodeGenState.headerOwnsCallbackTypedef(funcName)) {
        usedCallbackTypes.add(funcName);
      }
    }

    for (const funcName of usedCallbackTypes) {
      const cbInfo = CodeGenState.callbackTypes.get(funcName);
      if (cbInfo) {
        result.set(funcName, {
          typedefName: cbInfo.typedefName,
          returnType: cbInfo.returnType,
          // #1164: pass the parameter through whole. Dropping isConst/isArray
          // here is what made the header's typedef disagree with the .c's.
          parameters: cbInfo.parameters.map((p) => ({
            type: p.type,
            isStruct: p.isStruct,
            isConst: p.isConst,
            isArray: p.isArray,
            arrayDims: p.arrayDims,
            name: p.name,
          })),
        });
      }
    }

    return result;
  }

  /**
   * Derive the Tier 2 facts (pass 1.4 Resolve), then run the Tier 1 declare
   * (pass 1.3), for one file. The inversion is deliberate: declare cannot start
   * until the cross-file facts it reads exist.
   *
   * #1358: the two facts a per-file declare cannot know are authored HERE, once.
   * Both stage 3 and stage 5 previously derived "which scope types are visible
   * from this file" inline, from the same two calls in the same order, and each
   * then passed the result into `CNextResolver.resolve` as an `external*`
   * parameter. That is one decision written twice -- if the visibility rule
   * changed, both copies had to change together.
   *
   * The derivation sits at the orchestrator because it needs orchestrator state
   * -- `this.state.getSymbolInfoByFileMap()` and `this.config.includeDirs`. It is
   * NOT blocked by the layer rule: `ICodeGenSymbols` lives in `transpiler/types/`,
   * not `output/`, and `logic/symbols/TransitiveEnumCollector.ts` already imports
   * it. Moving this into a Tier 2 `logic/symbols/` artifact is DoD items 1-2 of
   * #1358 and remains open.
   *
   * #1333: the seed must be built BEFORE resolving, so the symbols layer and the
   * codegen layer are fed the same set. A reopened scope has half its members in
   * another file; resolving first and merging afterwards let the `.h` see a bare
   * `Point` while the `.c` saw `Lib__Point`, which does not compile. Pipeline
   * files are visited in dependency order, so an included file's symbols are
   * already present.
   */
  private _declareFile(
    tree: Parser.ProgramContext,
    sourcePath: string,
    cnextIncludes?: ReadonlyArray<{ path: string }>,
  ): { symbols: TSymbol[]; externalEnumSources: ICodeGenSymbols[] } {
    const externalEnumSources = this._collectExternalEnumSources(
      sourcePath,
      cnextIncludes,
    );
    const visibleScopeTypes =
      TSymbolInfoAdapter.collectScopeTypeNames(externalEnumSources);

    return {
      symbols: CNextResolver.resolve(tree, sourcePath, visibleScopeTypes),
      externalEnumSources,
    };
  }

  /**
   * Collect external enum sources from included C-Next files.
   */
  private _collectExternalEnumSources(
    sourcePath: string,
    cnextIncludes?: ReadonlyArray<{ path: string }>,
  ): ICodeGenSymbols[] {
    const symbolInfoByFile = this.state.getSymbolInfoByFileMap();

    if (cnextIncludes) {
      // Standalone mode: use unified collectForStandalone method
      return TransitiveEnumCollector.collectForStandalone(
        cnextIncludes,
        symbolInfoByFile,
        this.config.includeDirs,
      );
    }

    // run() mode: use TransitiveEnumCollector with pre-populated symbolInfoByFile
    return TransitiveEnumCollector.collect(
      sourcePath,
      symbolInfoByFile,
      this.config.includeDirs,
    );
  }

  /**
   * Setup cross-file modification tracking for const inference.
   */
  private _setupCrossFileModifications(): void {
    const accumulatedModifications =
      this.modificationAnalyzer.getModifications();
    const accumulatedParamLists = this.modificationAnalyzer.getParamLists();

    // Issue #1171: no cppDetected gate -- C mode needs the same cross-file
    // modification data, or a parameter forwarded only to a cross-file
    // mutating callee wrongly receives #268 auto-const.
    if (accumulatedModifications.size > 0) {
      this.codeGenerator.setCrossFileModifications(
        accumulatedModifications,
        accumulatedParamLists,
      );
    }
  }

  /**
   * Convert TSymbols to IHeaderSymbols with auto-const information applied.
   * ADR-055 Phase 7: Replaces mutation-based auto-const updating.
   */
  private convertToHeaderSymbols(
    symbols: TSymbol[],
    unmodifiedParams: ReadonlyMap<string, ReadonlySet<string>>,
    knownEnums: ReadonlySet<string>,
  ): IHeaderSymbol[] {
    return symbols.map((symbol) => {
      const headerSymbol = HeaderSymbolAdapter.fromTSymbol(symbol);

      if (
        symbol.kind !== "function" ||
        !headerSymbol.parameters ||
        headerSymbol.parameters.length === 0
      ) {
        return headerSymbol;
      }

      // Issue #914: Resolve callback typedef type for callback-compatible functions
      const typedefName = CodeGenState.callbackCompatibleFunctions.get(
        headerSymbol.name,
      );
      const callbackTypedefType = typedefName
        ? CodeGenState.getTypedefType(typedefName)
        : undefined;

      // Issue #914: For callback-compatible functions, bake pointer/const overrides
      // onto each parameter. Skip auto-const (matches CodeGenerator path).
      // Note: isOpaqueHandle is not set here because callback params get their
      // pointer/const semantics from the typedef signature via isCallbackPointer/
      // isCallbackConst, which take precedence over opaque handling in the builder.
      if (callbackTypedefType) {
        const updatedParams = TypedefParamParser.resolveCallbackParams(
          headerSymbol.parameters,
          callbackTypedefType,
        );
        return { ...headerSymbol, parameters: updatedParams };
      }

      // Apply auto-const and resolve opaque type info for non-callback function parameters
      const unmodified = unmodifiedParams.get(headerSymbol.name);
      const updatedParams = headerSymbol.parameters.map((param) => {
        // ADR-029 / #1164: a parameter whose declared type IS a callback
        // function takes that function's typedef, exactly as the .c does via
        // CodeGenState.callbackTypes. Without this the header emitted the bare
        // function name as a type ("const onReceive*"), which both contradicts
        // the .c's "onReceive_fp" and collides with the function's own
        // prototype ("redeclared as different kind of symbol").
        const callbackType = CodeGenState.callbackTypes.get(param.type ?? "");
        if (callbackType) {
          return {
            ...param,
            type: callbackType.typedefName,
            isCallback: true,
            callbackTypedefName: callbackType.typedefName,
            isStruct: false,
          };
        }

        // Issue #995: Resolve opaque type info ONCE onto the symbol.
        // This is the single source of truth for both body (.c/.cpp) and header (.h/.hpp).
        const isOpaque = CodeGenState.isOpaqueType(param.type ?? "");

        // ADR-006: Only non-array pointer params get auto-const.
        // Arrays are pass-by-reference and mutable by default - auto-const would
        // break compatibility with C APIs expecting mutable pointers (issue #986).
        // Note: isAutoConst may be set here, but ParameterSignatureBuilder will
        // suppress it for opaque handles (Issue #995) — single source of truth.
        const isPointerParam =
          !param.isConst &&
          !param.isArray &&
          param.type !== "f32" &&
          param.type !== "f64" &&
          param.type !== "ISR" &&
          !knownEnums.has(param.type ?? "");

        const shouldAutoConst =
          unmodified && isPointerParam && unmodified.has(param.name);

        // Return updated param with resolved flags
        if (shouldAutoConst || isOpaque) {
          return {
            ...param,
            isAutoConst: shouldAutoConst || undefined,
            isOpaqueHandle: isOpaque || undefined,
          };
        }
        return param;
      });

      return { ...headerSymbol, parameters: updatedParams };
    });
  }

  // ===========================================================================
  // Result Builder Helpers
  // ===========================================================================

  /**
   * Build an error result for parse/analyzer failures.
   */
  private buildErrorResult(
    sourcePath: string,
    errors: IFileResult["errors"],
    declarationCount: number,
  ): IFileResult {
    return {
      sourcePath,
      code: "",
      success: false,
      errors,
      declarationCount,
    };
  }

  /**
   * Build a result for parse-only mode.
   */
  private buildParseOnlyResult(
    sourcePath: string,
    declarationCount: number,
  ): IFileResult {
    return {
      sourcePath,
      code: "",
      success: true,
      errors: [],
      declarationCount,
    };
  }

  /**
   * Build a successful transpilation result.
   */
  private buildSuccessResult(
    sourcePath: string,
    code: string,
    headerCode: string | undefined,
    declarationCount: number,
    requirements: readonly IRecordedRequirement[] = [],
  ): IFileResult {
    return {
      sourcePath,
      code,
      headerCode,
      success: true,
      errors: [],
      declarationCount,
      requirements,
    };
  }

  /**
   * Build a catch/exception result.
   */
  private buildCatchResult(sourcePath: string, err: unknown): IFileResult {
    const rawMessage = err instanceof Error ? err.message : String(err);
    const parsed = ParserUtils.parseErrorLocation(rawMessage);

    return {
      sourcePath,
      code: "",
      success: false,
      errors: [
        {
          line: parsed.line,
          column: parsed.column,
          message: `Code generation failed: ${parsed.message}`,
          severity: "error",
        },
      ],
      declarationCount: 0,
    };
  }

  // ===========================================================================
  // Public Accessors
  // ===========================================================================

  /**
   * Get the symbol table (for testing/inspection)
   */
  getSymbolTable(): SymbolTable {
    return CodeGenState.symbolTable;
  }

  /**
   * Check if C++ output was detected during transpilation.
   * This is set when C++ syntax is found in included headers (e.g., Arduino.h).
   */
  isCppDetected(): boolean {
    return this.cppDetected;
  }

  /**
   * Determine the project root by walking up from the first input looking for
   * project markers. Returns undefined if no project root can be established,
   * which disables caching to avoid polluting the filesystem with .cnx directories.
   */
  private determineProjectRoot(): string | undefined {
    // Start from first input
    const firstInput = this.config.input;
    if (!firstInput) {
      return undefined;
    }

    const resolvedInput = resolve(firstInput);
    let startDir: string;

    // Determine starting directory based on whether input exists
    if (this.fs.exists(resolvedInput)) {
      // Input exists - use its directory if file, or itself if directory
      startDir = this.fs.isFile(resolvedInput)
        ? dirname(resolvedInput)
        : resolvedInput;
    } else {
      // Input doesn't exist - assume it's a file path, use parent directory
      startDir = dirname(resolvedInput);
    }

    // Project root indicators (in priority order)
    const projectMarkers = [
      "cnext.config.json", // C-Next config file
      "platformio.ini", // PlatformIO project
      ".git", // Git repository root
      "package.json", // Node.js project
    ];

    // Walk up looking for project markers
    let dir = startDir;
    while (true) {
      // Check each project marker
      for (const marker of projectMarkers) {
        const markerPath = join(dir, marker);
        if (this.fs.exists(markerPath)) {
          return dir;
        }
      }

      // Move to parent directory
      const parent = dirname(dir);
      if (parent === dir) {
        // Reached filesystem root without finding project markers
        break;
      }
      dir = parent;
    }

    // No project root found - return undefined to disable caching
    return undefined;
  }
}

export default Transpiler;
