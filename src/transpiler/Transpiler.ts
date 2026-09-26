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

import * as Parser from "../PARSE/2-Parse/grammar/CNextParser";
import CNextSourceParser from "../PARSE/2-Parse/CNextSourceParser";
import HeaderParser from "../PARSE/2-Parse/HeaderParser";

import CodeGenWalker from "../TRANSPILE/CodeGenWalker";
import invariant from "../utils/invariant";
import ModificationFacts from "./ModificationFacts";
import CallbackCompatibility from "./CallbackCompatibility";
import AutoConstRule from "../utils/AutoConstRule";
import AdrProvenance from "../instrumentation/AdrProvenance";
import ToolchainRequirements from "../instrumentation/ToolchainRequirements";
import CachedSymbolReader from "../utils/cache/CachedSymbolReader";
import TJsonValue from "../utils/types/TJsonValue";
import PublicInterface from "../TRANSPILE/2-Plan/PublicInterface";
import HeaderGenerator from "../TRANSPILE/3-Render/headers/HeaderGenerator";
import HeaderRenderer from "../TRANSPILE/3-Render/headers/HeaderRenderer";
import HeaderTypeNames from "../TRANSPILE/2-Plan/HeaderTypeNames";
import HeaderIncludes from "../TRANSPILE/2-Plan/HeaderIncludes";
import QualifiedCName from "../utils/QualifiedCName";
import ExternalTypeHeaderBuilder from "../TRANSPILE/3-Render/headers/ExternalTypeHeaderBuilder";
import HeaderGeneratorUtils from "../TRANSPILE/3-Render/headers/HeaderGeneratorUtils";
import IHeaderEmissionFacts from "../TRANSPILE/3-Render/headers/types/IHeaderEmissionFacts";
import IHeaderCallbackType from "./types/IHeaderCallbackType";
import IncludeExtractor from "./logic/IncludeExtractor";
import SymbolTable from "../PARSE/3-Declare/SymbolTable";
import type TranspileState from "../TRANSPILE/TranspileState";
import ESourceLanguage from "../utils/types/ESourceLanguage";
import CNextResolver from "../PARSE/3-Declare/cnext/index";
import SymbolRegistry from "../PARSE/3-Declare/SymbolRegistry";
import Program from "../PARSE/4-Resolve/Program";
import type IProgram from "./types/IProgram";
import type IFileSymbols from "./types/IFileSymbols";
import type IParsedFile from "./types/IParsedFile";
import CResolver from "../PARSE/3-Declare/c/index";
import CppResolver from "../PARSE/3-Declare/cpp/index";
import HeaderSymbolAdapter from "../TRANSPILE/3-Render/headers/adapters/HeaderSymbolAdapter";
import IHeaderSymbol from "../TRANSPILE/3-Render/headers/types/IHeaderSymbol";
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
import DependencyGraph from "./data/DependencyGraph";
import PathResolver from "./data/PathResolver";
import OutputExtensions from "../utils/OutputExtensions";
import DeclarationSite from "../utils/DeclarationSite";
import type IOutputExtensions from "./types/IOutputExtensions";
import InputExpansion from "./data/InputExpansion";
import CppEntryPointScanner from "./data/CppEntryPointScanner";

import ParserUtils from "../utils/ParserUtils";
import ITranspilerConfig from "./types/ITranspilerConfig";
import ITranspilerResult from "./types/ITranspilerResult";
import IFileResult from "./types/IFileResult";
import IInMemorySource from "./types/IInMemorySource";
import IPipelineFile from "./types/IPipelineFile";
import IPipelineInput from "./types/IPipelineInput";
import TTranspileInput from "./types/TTranspileInput";
import ITranspileError from "../lib/types/ITranspileError";
import runAnalyzers from "../TRANSPILE/1-Analyze/runAnalyzers";
import Diagnostics from "../TRANSPILE/1-Analyze/Diagnostics";
import type IDiagnostics from "./types/IDiagnostics";
import type ICodeGenSymbols from "./types/ICodeGenSymbols";
import CacheManager from "../utils/cache/CacheManager";
import MapUtils from "../utils/MapUtils";
import detectCppSyntax from "./logic/detectCppSyntax";
import detectAssemblySyntax from "./logic/detectAssemblySyntax";
import ExternalDeclarationOracle from "./logic/preprocessor/ExternalDeclarationOracle";
import TypedefParamParser from "../TRANSPILE/3-Render/codegen/helpers/TypedefParamParser";
import type IRecordedRequirement from "./types/IRecordedRequirement";
import type IRenderedFile from "./types/IRenderedFile";
import RequirementAggregator from "../utils/RequirementAggregator";
import TargetResolver from "../utils/TargetResolver";

/**
 * Unified transpiler
 */
class Transpiler {
  private readonly config: Required<ITranspilerConfig>;
  private readonly preprocessor: Preprocessor;
  private readonly codeGenerator: CodeGenWalker;
  private readonly headerGenerator: HeaderGenerator;
  private readonly warnings: string[];
  private readonly cacheManager: CacheManager | null;
  /**
   * Issue #211, #1319: does this run emit C++?
   *
   * DECLARED, not discovered. It comes from config (`cppRequired`) or `--cpp`,
   * is known before any file is read, and never changes. A C++ header met in a
   * run that did not declare C++ is E0507, not a silent switch to C++ output.
   *
   * It used to be a monotone latch raised by reading an included header, which
   * made it discovered, global and settled *mid-run* at the same time. Any one
   * of those alone is harmless; together they produced #250, #941, #1139, #1425
   * and #1171 -- the last of which gated auto-const inference, so adding an
   * include to one file could change what the transpiler inferred about
   * another. Declaring it removes the class: there is no ordering to get wrong,
   * nothing to read before it settles, and serve mode -- one Transpiler reused
   * for an editor session -- is correct by construction rather than by luck.
   */
  private readonly cppMode: boolean;

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
    return OutputExtensions.forCppMode(this.cppMode);
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
  /**
   * The run's own accumulations (#1452 box 1).
   *
   * These were a `TranspilerState` under `src/transpiler/state/`, which box 1
   * deletes. They are not a pass's facts and never were -- they are what the
   * ORCHESTRATOR accumulates while driving a run, written and read by this
   * class alone, which is why inlining them removes an indirection rather than
   * relocating a state container.
   *
   * `userIncludes` is keyed by source path, and by `${path}\u0000c-headers`
   * for the #424 C-header half. The NUL separator is deliberate: no filesystem
   * path contains one, so the two keyspaces cannot collide.
   */
  private readonly symbolCollectors = new Map<string, ICodeGenSymbols>();

  // eslint-disable-next-line @typescript-eslint/lines-between-class-members
  private readonly perFilePassByValueParams = new Map<
    string,
    ReadonlyMap<string, ReadonlySet<string>>
  >();

  // eslint-disable-next-line @typescript-eslint/lines-between-class-members
  private readonly userIncludes = new Map<string, string[]>();

  // eslint-disable-next-line @typescript-eslint/lines-between-class-members
  private readonly headerIncludeDirectives = new Map<string, string>();

  // eslint-disable-next-line @typescript-eslint/lines-between-class-members
  private readonly processedHeaders = new Set<string>();
  /**
   * #1323: one file's fully-resolved header-render input, captured while its
   * `CodeGenState` was warm. `_renderHeaders` (Stage 5.5) reads this map ONCE,
   * after every file has been transpiled, to render every header -- see
   * `IHeaderEmissionFacts` for why this is what makes issue #1139's failure
   * mode structurally impossible rather than merely fixed.
   *
   * Lives here, on the orchestrator, rather than on `TranspilerState`:
   * `IHeaderEmissionFacts` carries `output/`-layer shapes
   * (`IHeaderSymbol`/`IHeaderOptions`/`IHeaderTypeInput`), and `state/` may
   * never reach `output/`, even transitively (#1297) -- `Transpiler.ts` sits
   * above the 4-layer structure and coordinates all of them, so it alone may
   * hold both. Cleared per run by `_initializeRun()`, matching `pragmaTargets`
   * just above.
   */
  private readonly headerEmissionFactsByPath = new Map<
    string,
    IHeaderEmissionFacts
  >();
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
  /**
   * The artifact 1.4 Resolve emitted for this run.
   *
   * Held so passes after 1.4 read a cross-file fact from here rather than
   * recomputing one. Null until Stage 3 completes, which is the only window
   * in which nothing is entitled to ask.
   */
  /**
   * #1452 box 3: the run's scope graph. One per run, constructed here and
   * threaded -- there is no global to clear, so a test cannot forget to.
   */
  private symbolRegistry = new SymbolRegistry();

  // eslint-disable-next-line @typescript-eslint/lines-between-class-members
  private program: IProgram | null = null;

  /**
   * The parses retained for Stage 5, keyed by source path.
   *
   * #1445 box 2: this was a `Map<string, IDeclaredFile>`, and `IDeclaredFile`
   * was `{ parsed: IParsedFile; symbols: readonly TSymbol[] }` -- so the record
   * 1.3 appeared to hand forward RE-EXPORTED the tree, which is the one thing
   * the lifetime rule forbids. It was never 1.3's artifact: `_declareFile`
   * returns `IFileSymbols`, and this map came from #1301 purely so Stage 5
   * could reuse Stage 3's parse.
   *
   * Its `symbols` half had **no reader** -- every use of the map reached
   * `.parsed` and nothing else -- so the bundle was carrying a dead field in
   * order to look like an artifact. Holding 1.2's artifact under its own name
   * says what is true: retention is the ORCHESTRATOR's bookkeeping, not
   * something a pass passes on.
   */
  /**
   * #1452: 1.1 Discover's include facts, accumulated here and handed to
   * `Program.build` once. They used to live on `TranspilerState`, where they
   * were written in Stage 1 and read in Stages 4d and 5 -- state written by one
   * pass and read by another, which box 4 forbids.
   *
   * Written ONLY by `_resolveCnxIncludes` and read ONLY at the freeze,
   * so no later pass can reach these; what the later passes read is the frozen
   * copy on `IProgram`. See `IDiscoveryFacts` for the ordering that makes that
   * legal.
   */
  private readonly discoveredCnxIncludeRewrites = new Map<
    string,
    Map<string, string>
  >();

  // eslint-disable-next-line @typescript-eslint/lines-between-class-members
  private readonly discoveredIncludeSearchPaths = new Map<
    string,
    readonly string[]
  >();

  // eslint-disable-next-line @typescript-eslint/lines-between-class-members
  private readonly discoveredQuotedIncludeDirectories = new Map<
    string,
    string
  >();

  private readonly retainedParses = new Map<string, IParsedFile>();

  /**
   * Issue #593: Centralized analyzer for cross-file const inference in C++ mode.
   * Accumulates parameter modifications and param lists across all processed files.
   */
  /** Issue #586: Centralized path resolution for output files */
  private readonly pathResolver: PathResolver;

  /**
   * Issue #1467: PathResolver's answer to "where is this .cnx's header
   * reachable from?", bound to the run's header extension. Handed to
   * IncludeResolver so the include text and the header's location are the
   * same derivation rather than two that happen to agree.
   */
  private readonly _headerIncludePathFor = (cnxPath: string): string | null =>
    this.pathResolver.getHeaderIncludePath(
      cnxPath,
      this.outputExtensions.header,
    );
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
      defines: config.defines ?? {},
      preprocess: config.preprocess ?? true,
      cppRequired: config.cppRequired ?? false,
      parseOnly: config.parseOnly ?? false,
      debugMode: config.debugMode ?? false,
      target: config.target ?? "",
      collectGrammarCoverage: config.collectGrammarCoverage ?? false,
      noCache: config.noCache ?? false,
    };

    // Issue #211, #1319: the single source of the fact. Absent means C, which
    // is the default target, not a guess about what the includes might contain.
    this.cppMode = this.config.cppRequired ?? false;

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
    this.codeGenerator = new CodeGenWalker();
    this.headerGenerator = new HeaderGenerator();
    this.warnings = [];

    // Issue #586: Initialize path resolver
    this.pathResolver = new PathResolver(
      {
        inputs: [dirname(resolve(this.config.input))],
        outDir: this.config.outDir,
        headerOutDir: this.config.headerOutDir,
        // Issue #1547: the stable base for files outside the entry's directory.
        // Same value `_guardIdentity` already measures include-guard identity
        // against, so a file's guard and its header path can no longer disagree
        // about where it sits purely because the shell moved.
        projectRoot,
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
      this.retainedParses.clear();

      // #1445 box 2: the walker holds the token stream and the comment scanner
      // over it on its own fields, which the map clear above cannot reach.
      this.codeGenerator.releaseParseState();
    }
  }

  /**
   * Stage 1: Discover files and build pipeline input.
   *
   * Branches on input kind:
   * - 'files': filesystem scan, dependency graph, topological sort
   * - 'source': the same discovery, rooted at an in-memory string
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
    // #1435: ADR-010 resolves a quoted include from the file it appears in.
    // Text given a path lives at that path, resolved exactly as the root's
    // identity is (against the process's working directory), so where the
    // root IS and where it resolves FROM cannot come apart. `workingDir` is
    // where text with no path is resolved from. One directory, decided here,
    // for discovery and for the 2.1 rules that ask where a quoted include is.
    return this._discoverFromSource({
      path: input.sourcePath ?? "<string>",
      source: input.source,
      directory: input.sourcePath
        ? dirname(resolve(input.sourcePath))
        : (input.workingDir ?? process.cwd()),
      includeDirs: input.includeDirs ?? [],
    });
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
   * Stage 3: 1.3 Declare each C-Next file, then 1.4 Resolve the whole program --
   *          the stage spans both passes because a bare type reference cannot be
   *          settled until every file has been declared
   * Stage 4: Check for symbol conflicts
   * Stage 5: Generate code, and capture each file's header-render input
   *          (per-file, while that file's state is warm)
   * Stage 5.5: Render every captured header, once, whole-program (#1323)
   * Stage 6: Write the Stage 5.5 headers to disk (per-file)
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

    // Stage 3: Collect symbols from C-Next files -- 1.3 Declare for every file,
    // then 1.4 Resolve once over all of them.
    if (!this._collectAllCNextSymbolsFromPipeline(input.cnextFiles, result)) {
      return;
    }

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

    // Stage 4d: 2.1 Analyze -- EVERY file, before ANY file is planned (#1320).
    // This is the whole point of the stage existing separately: analysis used
    // to run inside the loop below, so file N was analyzed after files 1..N-1
    // had already been emitted, and an analyzer reading state codegen fills saw
    // the PREVIOUS file's data (#1430).
    const diagnostics = this._analyzeProgram(input);

    // Stage 5: Plan and Render each C-Next file
    //
    // #1233: the .c of a file that succeeded is NOT written as we go. A later
    // file can still fail the run, and Stage 6 gates headers on
    // `result.success`, so writing eagerly produced a .c that #includes a
    // header the same run refused to write -- output that cannot compile on a
    // clean tree and silently compiles against a stale header on a dirty one.
    // Deferring puts the .c under the same gate the .h already had.
    //
    // #1320: a program 2.1 rejected is NOT planned. The loop still runs, so
    // every file still gets a result recorded through the one recording path,
    // but it reports what 2.1 found instead of generating. Disk output is
    // unchanged either way -- both `pendingWrites` and Stage 6 are already
    // gated on `result.success`.
    const rejected = diagnostics.hasErrors();
    const pendingWrites: { path: string; content: string }[] = [];
    for (const file of input.cnextFiles) {
      if (!Transpiler._producesOutput(file)) {
        continue;
      }

      const fileResult = rejected
        ? this._rejectedFileResult(file, diagnostics)
        : this._transpileFile(file);
      this._recordFileResult(
        file.discoveredFile,
        fileResult,
        result,
        input.writeOutputToDisk,
        pendingWrites,
      );
    }

    // Stage 5.5: render every file's captured header input into text, ONCE,
    // now that the loop above is done. Unconditional -- result.files[].headerCode
    // is part of the public ITranspilerResult contract for BOTH 'files' and
    // 'source' input, not only when writeOutputToDisk. See _renderHeaders.
    //
    // #1320: that promise is about a file that reached Plan/Render, not about
    // every `success: true` file. A file 2.1 found clean but that never ran
    // through `_transpileFile` -- because a SIBLING was rejected -- has no
    // captured header input to render either, same as parse-only mode.
    // `_renderHeaders` already treats a missing capture as "no header for this
    // file" rather than an error, so this is a silent no-op for it, not a bug.
    const renderedFiles = this._renderHeaders(result);

    if (result.success && input.writeOutputToDisk) {
      for (const write of pendingWrites) {
        this.fs.writeFile(write.path, write.content);
      }
    }

    // Stage 6: Write the Stage 5.5 headers (only to disk in files mode)
    if (result.success && input.writeOutputToDisk) {
      this._generateAllHeadersFromPipeline(
        input.cnextFiles,
        result,
        renderedFiles,
      );
    }
  }

  /**
   * Stage 5.5: render every file's captured `IHeaderEmissionFacts` into
   * header text, in one batch, after the Stage 5 loop has finished.
   *
   * #1323: `HeaderRenderer.render()` never reads `CodeGenState` -- it
   * only reads the captured records -- so calling it here, once, after every
   * file's state has already moved on, is exactly the timing issue #1139's
   * fix forbade for `generateHeaderForFile`. That method no longer exists;
   * only its decision does, frozen per file in `headerEmissionFactsByPath`.
   *
   * Mutates `result.files[]` in place: `_recordFileResult` already pushed one
   * entry per file with `headerCode: undefined`, and this fills it in (or, on
   * a render failure, downgrades that entry to failed -- mirroring
   * `buildCatchResult`'s shape for the equivalent `.c`/`.cpp` generation
   * failure, and `_recordFileResult`'s own promotion of a file's errors onto
   * `result.errors` with `sourcePath` attached).
   *
   * A file whose `.c` generation already failed (`fileResult.success` is
   * already `false`) has no captured record to render and is skipped --
   * `_captureHeaderEmissionFacts` is only reached from inside the same try
   * block that produced that failure.
   */
  private _renderHeaders(
    result: ITranspilerResult,
  ): ReadonlyMap<string, IRenderedFile> {
    const rendered = HeaderRenderer.render(
      this.headerEmissionFactsByPath,
      this.headerGenerator,
    );

    // 2.3 Render's artifact, assembled here because this is the first moment a
    // file's text is complete: the implementation came from Stage 5, the header
    // from the call above. Stage 6 reads this rather than rebuilding a map from
    // `result.files[].headerCode` -- which is the same fact flattened into
    // per-file fields and then un-flattened one stage later, agreeing only
    // because nothing had yet written one of the two representations.
    const renderedFiles = new Map<string, IRenderedFile>();

    for (const fileResult of result.files) {
      if (!fileResult.success) {
        continue;
      }

      const headerCode = rendered.headersBySourcePath.get(
        fileResult.sourcePath,
      );
      if (headerCode !== undefined) {
        fileResult.headerCode = headerCode;
        renderedFiles.set(fileResult.sourcePath, {
          sourcePath: fileResult.sourcePath,
          implementation: fileResult.code,
          header: headerCode,
        });
        continue;
      }

      const errorMessage = rendered.errorsBySourcePath.get(
        fileResult.sourcePath,
      );
      if (errorMessage === undefined) {
        // No header and no failure: the file has no public interface, so 2.3
        // rendered an implementation and nothing else.
        renderedFiles.set(fileResult.sourcePath, {
          sourcePath: fileResult.sourcePath,
          implementation: fileResult.code,
          header: null,
        });
        continue;
      }

      // Mirrors buildCatchResult's shape for a .c/.cpp generation failure --
      // this is the same kind of thing (a generator exception), for the
      // header instead.
      const parsed = ParserUtils.parseErrorLocation(errorMessage);
      const error: ITranspileError = {
        line: parsed.line,
        column: parsed.column,
        message: `Header generation failed: ${parsed.message}`,
        severity: "error",
      };

      fileResult.success = false;
      fileResult.errors.push(error);

      // Promote to the run-level list with sourcePath, matching
      // _recordFileResult's own promotion of a file's errors.
      result.errors.push({ ...error, sourcePath: fileResult.sourcePath });
      result.success = false;
    }

    return renderedFiles;
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
    // 1.3 Declare, every file. Per-file facts only: a file's symbols are
    // computable with its own parse tree open and nothing else.
    const declared: Array<{
      readonly file: IPipelineFile;
      readonly parsed: IParsedFile;
      readonly fileSymbols: IFileSymbols;
    }> = [];
    for (const file of cnextFiles) {
      const outcome = this._declarePipelineFile(file);
      if (outcome.errors) {
        result.errors.push(...outcome.errors);
        result.success = false;
        continue;
      }
      declared.push({
        file,
        parsed: outcome.parsed,
        fileSymbols: outcome.fileSymbols,
      });
    }

    if (!result.success) {
      return false;
    }

    // 1.4 Resolve. The whole program exists only now that every file has been
    // declared, which is the entire reason the two loops are separate: a file's
    // bare type reference may name a scope type declared in a file that had not
    // been read when the first loop reached it, and no ordering fixes that.
    //
    // Building `Program` settles every deferred type, so nothing below this
    // line can observe an unsettled one.
    try {
      // The symbol table holds only C/C++ header symbols at this point --
      // this run's C-Next symbols are added below, per file -- so this IS
      // the external set, which is what the fact is about.
      //
      // It is also read AFTER `_collectExternalDeclarations`, and that ordering
      // is load-bearing rather than incidental: a struct that becomes known only
      // through #985 recovery has its fields added to the symbol table there, and
      // reading the set any earlier would drop it from `externalStructFields` --
      // silently exempting it from ADR-016 init-completeness checking, which is
      // the one consumer of the fact.
      // #1511: one derivation over every tree, before the artifact exists.
      // This used to run per file inside the loop below, each pass injecting
      // the running total, extracting its own contribution and restoring the
      // globals it clobbered -- so "does this callee modify its parameter?"
      // answered differently depending on how many files had gone before.
      const modifications = ModificationFacts.derive(
        declared,
        this.symbolRegistry,
        this.codeGenerator.transpileState.symbolTable,
      );
      // #1511: derived over every tree before anything renders. Accumulated
      // during rendering, this map was partial for whichever file went first.
      const callbackCompatible = CallbackCompatibility.derive(
        declared,
        this.codeGenerator.transpileState.symbolTable,
        this.symbolRegistry,
      );

      this.program = Program.build(
        declared.map((entry) => entry.fileSymbols),
        {
          headerStructFields:
            this.codeGenerator.transpileState.symbolTable.getAllStructFields(),
          // #1511: everything the C/C++ headers contributed. The opacity inputs
          // are the RAW bookkeeping, not the verdict -- `Program` resolves which
          // typedefs never received a body. Read here because #985 phantom-body
          // recovery has already run (Stage 2), so the state is final.
          foreign: {
            c: this.codeGenerator.transpileState.symbolTable.getAllCSymbols(),
            cpp: this.codeGenerator.transpileState.symbolTable.getAllCppSymbols(),
            opaqueTypedefs: new Set(
              this.codeGenerator.transpileState.symbolTable.getAllOpaqueTypes(),
            ),
            typedefToTag: new Map(
              this.codeGenerator.transpileState.symbolTable.getAllTypedefToTag(),
            ),
            structTagsWithBodies: new Set(
              this.codeGenerator.transpileState.symbolTable.getAllStructTagsWithBodies(),
            ),
          },
          modifications,
          visibility: {
            cnextIncludesByFile: new Map(
              declared.map((entry) => [
                entry.file.path,
                entry.file.cnextIncludes,
              ]),
            ),
          },
          callbackCompatibleFunctions: callbackCompatible,
          discovery: {
            cnxIncludeRewrites: this.discoveredCnxIncludeRewrites,
            includeSearchPaths: this.discoveredIncludeSearchPaths,
            quotedIncludeDirectories: this.discoveredQuotedIncludeDirectories,
          },
          registry: this.symbolRegistry,
        },
      );
      // Passes after 1.4 read cross-file facts from the artifact rather than
      // re-deriving them. Set once per run, not per file.
      this.codeGenerator.transpileState.program = this.program;
    } catch (err) {
      result.errors.push(Transpiler._collectionError(err));
      result.success = false;
      return false;
    }

    for (const entry of declared) {
      const errors = this._publishResolvedFile(
        entry.file,
        entry.parsed,
        this.program.symbolsInFile(entry.file.path),
      );
      if (errors) {
        result.errors.push(...errors);
        result.success = false;
      }
    }

    return result.success;
  }

  /**
   * 1.3 Declare one file: parse it and collect the symbols it declares.
   *
   * Per-file by construction -- nothing here reads another file's symbols, and
   * `_declareFile` no longer receives a cross-file parameter. A bare type name
   * this file cannot settle is recorded as deferred rather than guessed, and
   * `Program.build` settles it once every file has been declared.
   *
   * @returns the parse and the file's artifact, or the errors that stopped it
   */
  private _declarePipelineFile(file: IPipelineFile):
    | {
        readonly errors: ITranspileError[];
        readonly parsed?: undefined;
        readonly fileSymbols?: undefined;
      }
    | {
        readonly errors?: undefined;
        readonly parsed: IParsedFile;
        readonly fileSymbols: IFileSymbols;
      } {
    const content = file.source ?? this.fs.readFile(file.path);
    const parsed = CNextSourceParser.parse(content);

    // Parse errors — return them with original line/column and sourcePath.
    // #1445: 1.2 carries its own errors, so the artifact is what comes back
    // and this stamps the path the text came from -- the one fact 1.2 cannot
    // know, because it parses a string.
    if (parsed.parseErrors.length > 0) {
      return {
        errors: parsed.parseErrors.map((e) => ({
          ...e,
          sourcePath: file.path,
        })),
      };
    }

    // ADR-049: record the file's declared target while its tree is in hand, so
    // Stage 4c can resolve a run-level budget without re-parsing or re-deriving.
    const pragmaTarget = TargetResolver.fromPragma(parsed.tree);
    if (pragmaTarget) {
      this.pragmaTargets.push(pragmaTarget);
    }

    try {
      // ADR-055 Phase 7: Use composable collectors via CNextResolver
      const fileSymbols = this._declareFile(parsed.tree, file.path);
      return { parsed, fileSymbols };
    } catch (err) {
      return { errors: [Transpiler._collectionError(err)] };
    }
  }

  /**
   * Publish one file's RESOLVED symbols to everything downstream of 1.4.
   *
   * Everything below consumed resolved type names before the pass split too;
   * what changed is that the names are now correct for a bare reference to a
   * scope type declared in another file, which no per-file pass could answer.
   *
   * The retention decision lives here rather than in Declare because what is
   * retained must be the SETTLED symbols -- Stage 5 reads this entry instead of
   * re-declaring, so handing it Declare's provisional types would put unsettled
   * names back into codegen through the cache.
   */
  private _publishResolvedFile(
    file: IPipelineFile,
    parsed: IParsedFile,
    tSymbols: ReadonlyArray<TSymbol>,
  ): ITranspileError[] | null {
    try {
      // #1301: Stage 5 consumes this parse and this declare instead of repeating
      // both. Recorded after settlement, so a file that throws while resolving
      // leaves no half-built entry for Stage 5 to find.
      //
      // Only for files that will read it back. A symbol-only file is still DECLARED
      // and RESOLVED -- that is the entire reason it was discovered -- but nothing
      // reads its tree, so retaining one would be pure cost. Retention is this
      // design's one real expense, so it is not paid for a consumer that does not
      // exist.
      if (Transpiler._producesOutput(file)) {
        this.retainedParses.set(file.path, parsed);
      }

      // ADR-055 Phase 7: Store TSymbol directly in SymbolTable (no ISymbol conversion)
      this.codeGenerator.transpileState.symbolTable.addTSymbols(tSymbols);
    } catch (err) {
      return [Transpiler._collectionError(err)];
    }

    return null;
  }

  /**
   * Symbol collection and resolution errors (e.g. BitmapCollector) formatted
   * the way a `.c` generation failure is, so both loops report one shape.
   */
  private static _collectionError(err: unknown): ITranspileError {
    const rawMessage = err instanceof Error ? err.message : String(err);
    const parsed = ParserUtils.parseErrorLocation(rawMessage);
    return {
      line: parsed.line,
      column: parsed.column,
      message: `Code generation failed: ${parsed.message}`,
      severity: "error",
    };
  }

  /**
   * Stage 4d: 2.1 Analyze, over the WHOLE program (#1320).
   *
   * Every file is analyzed here, before Stage 5 plans any of them. That order
   * is the pass boundary `docs/architecture/README.md` specifies -- "After
   * **1.4**, nothing may compute a cross-file fact. A pass that needs one reads
   * it from `Program`, which is complete before 2.1 begins."
   *
   * Analysis used to be the first half of `_transpileFile`, which meant file N
   * was analyzed after files 1..N-1 had been emitted. Nothing made that visible,
   * and #1430 is what it cost: an analyzer read a map codegen fills, so it held
   * the PREVIOUS file's names and `E0427` fired or not depending on include
   * order. Hoisting removes the window rather than the one read that used it.
   *
   * Parse-only mode analyzes nothing, exactly as before: `_transpileFile`
   * returned its parse-only result before reaching the analyzers, so running
   * them here would be new work on a path that asked for none.
   */
  private _analyzeProgram(input: IPipelineInput): IDiagnostics {
    const byFile = new Map<string, readonly ITranspileError[]>();

    if (this.config.parseOnly) {
      return Diagnostics.build(byFile);
    }

    for (const file of input.cnextFiles) {
      if (!Transpiler._producesOutput(file)) {
        continue;
      }
      byFile.set(file.path, this._analyzeFile(file));
    }

    return Diagnostics.build(byFile);
  }

  /**
   * Run 2.1's analyzers over one file and return what they rejected.
   *
   * The per-file `CodeGenState` an analyzer reads is established here, the same
   * way and from the same source as before the hoist -- `symbols` is a view of
   * `Program`, which 1.4 completed, so it does not depend on any file having
   * been emitted.
   */
  private _analyzeFile(file: IPipelineFile): readonly ITranspileError[] {
    const sourcePath = file.path;

    // #1241: attribute ADR provenance to the file being analyzed. Analysis runs
    // before the generator exists, so a rule firing in `runAnalyzers` would
    // otherwise be credited to whichever file was begun last -- or dropped on
    // the first, which reads identically to "this rule never fires".
    AdrProvenance.beginFile(sourcePath);

    try {
      const parsed = this._requireRetainedParse(sourcePath);

      const symbols = this._establishPerFileCodeGenState(sourcePath);

      // #1322: the ADR-010 include facts are handed in rather than read off
      // CodeGenState, whose `sourcePath` is not written until `generate()` and
      // so holds another file's value here.
      // #1452: asserted, not defaulted. Stage 3 builds `Program` and returns
      // false on failure before this runs, so a null here is a broken stage
      // order -- and `?? []` would answer it with an empty search path, which
      // is a REAL answer meaning "discovery never saw this file". E0504 would
      // go blind and nothing would fail. Same reasoning as the conflict check.
      invariant(
        this.program,
        "1.4 Resolve built Program before a later pass read its discovery facts",
      );

      return runAnalyzers(parsed.tree, parsed.comments, {
        cppMode: this.cppMode,
        // #1456: handed over rather than reached for. Nineteen analyzer sites
        // used to read these off `CodeGenState` themselves, for facts this
        // caller is already holding.
        context: {
          symbols,
          program: this.program,
          symbolTable: this.codeGenerator.transpileState.symbolTable,
          reachesForeignHeader: file.reachesForeignHeader ?? true,
        },
        includes: {
          quotedIncludeDirectory:
            this.program.quotedIncludeDirectory(sourcePath),
          searchPaths: this.program.includeSearchPaths(sourcePath),
          fileExists: (candidate: string) => this.fs.exists(candidate),
        },
      });
    } catch (err) {
      return [Transpiler._collectionError(err)];
    }
  }

  /**
   * The result for one file of a program 2.1 rejected (#1320).
   *
   * Reports what 2.1 found and generates nothing. A file 2.1 found nothing
   * wrong with is NOT marked failed -- it carries no errors and no code, which
   * is the honest statement that it was never planned. `_recordFileResult`
   * queues no write for it either way, since its `code` is empty.
   */
  private _rejectedFileResult(
    file: IPipelineFile,
    diagnostics: IDiagnostics,
  ): IFileResult {
    const sourcePath = file.path;
    const errors = diagnostics.forFile(sourcePath);
    const declarationCount =
      this.retainedParses.get(sourcePath)?.declarationCount ?? 0;

    return errors.length > 0
      ? this.buildErrorResult(sourcePath, [...errors], declarationCount)
      : this.buildParseOnlyResult(sourcePath, declarationCount);
  }

  /**
   * The parse and declare Stage 3 already performed for this file (#1301).
   *
   * There is no parse-if-absent fallback on purpose -- that fallback is the
   * duplicate path #1301 removed. Stages 4d and 5 walk a subset of the same
   * `input.cnextFiles` Stage 3 walked, and Stage 3 aborts the run on a parse
   * error before either begins, so a miss means the pipeline ran out of order
   * and must say so rather than quietly reparse.
   *
   * This branch is an ASSERTION, not a covered path, and is deliberately left
   * uncovered: every caller is downstream of a stage 3 that aborts the run on
   * any error, so nothing reachable through the public API can miss. It cannot
   * be mutation-checked either -- mis-keying the cache returns a WRONG entry,
   * never `undefined`, so that mutation exercises the key rather than this
   * guard. It surfaces as a user-facing `Code generation failed: ...` at line 1,
   * since the message carries no `N:M` prefix for `parseErrorLocation` to find.
   */
  private _requireRetainedParse(sourcePath: string): IParsedFile {
    const declared = this.retainedParses.get(sourcePath);
    if (!declared) {
      throw new Error(
        `${sourcePath} reached code generation without being declared`,
      );
    }
    return declared;
  }

  /**
   * This file's view of the resolved program.
   *
   * #1511: composed once, when the whole program was in hand. This used to walk
   * the include closure and merge per file, over a map the publish loop was
   * still filling -- so the same file saw more or less depending on when it was
   * rendered.
   *
   * Asserted rather than defaulted. A per-file view would be the pre-#1301
   * shape -- no cross-file enums, no #1333 struct qualification, no #1398 const
   * names -- and codegen would emit subtly wrong C with no diagnostic. The
   * guarantee that this is present is a key-provenance argument two call sites
   * apart (`Program.build` keys on `IFileSymbols.sourceFile`, set from
   * `file.path`, and this reads the same `file.path`), so it is the kind of
   * invariant that should fail loudly if it ever stops holding. Same treatment
   * as `Program.settleEveryFile`'s deferred-type check.
   */
  private _requireSymbolInfo(sourcePath: string): ICodeGenSymbols {
    // #1452: see `_analyzeFile` -- the include rewrites below are asserted
    // rather than defaulted, for the same reason.
    invariant(
      this.program,
      "1.4 Resolve built Program before a later pass read its discovery facts",
    );
    // Bound to a local because TypeScript drops the narrowing of a mutable
    // class property across any intervening call, and this method makes
    // several before the two reads below.
    const program = this.program;

    const symbolInfo = program.codeGenSymbolsFor(sourcePath);
    if (!symbolInfo) {
      throw new Error(
        `Internal error: no visible symbol view for ${sourcePath}; ` +
          `1.4 Resolve must run before stage 5`,
      );
    }
    return symbolInfo;
  }

  /**
   * The per-file symbol view, required present.
   *
   * This used to PUBLISH the view onto the state as well, and that write is now
   * dead in both directions. `_analyzeFile`'s readers are the analyzers, which
   * take `IAnalysisContext.symbols` since #1456 and are barred from the state by
   * `analyzers-cannot-reach-codegen-state`. `_transpileFile`'s next state access
   * is `generate()`, whose `reset()` sets `symbols = null` before the walker
   * assigns `options.symbolInfo` -- so the value written here was overwritten
   * before anything could read it. Verified by removing the write: 7435 unit
   * tests and 1263 fixtures stay green.
   *
   * It set `currentFileReachesForeignHeader` too, and that went the same way for
   * the same reason: #1456 moved its one reader onto `IAnalysisContext`, which
   * `_analyzeFile` fills from the same expression, and `reset()` restored the
   * declining default over it at the top of `generate()`.
   *
   * What is left is the requirement itself, which is why the method stays: both
   * callers need the view to exist, and `_requireSymbolInfo` throws rather than
   * returning a nullable that every caller would then guard.
   */
  private _establishPerFileCodeGenState(sourcePath: string): ICodeGenSymbols {
    return this._requireSymbolInfo(sourcePath);
  }

  /**
   * Stage 5: Plan and Render a single C-Next file.
   *
   * Assumes the symbol table is already populated (stages 2-3 complete) and
   * that 2.1 Analyze has already accepted the whole program -- #1320 moved
   * analysis to Stage 4d, so by here the question "is this program legal?" has
   * been answered for EVERY file, not just the ones walked so far.
   */
  private _transpileFile(file: IPipelineFile): IFileResult {
    const sourcePath = file.path;

    // #1452: asserted, not defaulted. Stage 3 builds `Program` and returns
    // false on failure before Stage 5 runs, so a null here is a broken stage
    // order -- and defaulting the include rewrites to an empty map would be a
    // REAL answer meaning "this file includes nothing", silently dropping every
    // #1467 rewrite with no diagnostic. Bound to a local because TypeScript
    // drops the narrowing of a mutable class property across any intervening
    // call, and this method makes several before the reads below.
    invariant(
      this.program,
      "1.4 Resolve built Program before Stage 5 read its discovery facts",
    );
    const program = this.program;

    // #1241: attribute ADR provenance from here, not from codegen. A rule firing
    // during header capture below would otherwise be credited to whichever file
    // was begun last -- or dropped on the first, which reads identically to
    // "this rule never fires". Stage 4d begins each file for its own analysis;
    // this re-begins the file for the emission half.
    AdrProvenance.beginFile(sourcePath);

    try {
      const { tree, tokenStream, declarationCount } =
        this._requireRetainedParse(sourcePath);

      // Parse only mode
      if (this.config.parseOnly) {
        return this.buildParseOnlyResult(sourcePath, declarationCount);
      }

      // #1320: 2.1 Analyze already ran, whole-program, in Stage 4d. What is left
      // here is 2.2 Plan and 2.3 Render. The per-file state codegen reads is
      // still established per file -- it is `generate()`'s input, not analysis's.
      const symbolInfo = this._establishPerFileCodeGenState(sourcePath);

      // Generate code
      // Use file's sourceRelativePath (source mode) or compute from PathResolver (files mode)
      const sourceRelativePath =
        file.sourceRelativePath ??
        this.pathResolver.getSourceRelativePath(sourcePath);
      const code = this.codeGenerator.generate(tree, tokenStream, {
        debugMode: this.config.debugMode,
        target: this.config.target,
        sourcePath,
        cppMode: this.cppMode,
        symbolInfo,
        sourceRelativePath,
        cnxIncludeRewrites: program.cnxIncludeRewrites(sourcePath),
        // #1515: decided here, from the rule's owner. 1.3 Declare used to
        // answer this, which put an emission decision in the parse layer.
        hasPublicInterface: PublicInterface.existsIn(
          this.codeGenerator.transpileState.symbolTable.getTSymbolsByFile(
            sourcePath,
          ),
        ),
      });

      // Collect user includes
      const userIncludes = IncludeExtractor.collectUserIncludes(
        tree,
        this.outputExtensions.header,
        program.cnxIncludeRewrites(sourcePath),
      );
      // Issue #424: kept separate — added to the header only when it names a
      // macro that one of these supplies (see _headerNeedsMacroIncludes).
      this.userIncludes.set(
        `${sourcePath}\u0000c-headers`,
        IncludeExtractor.collectCHeaderIncludes(tree),
      );

      // Get pass-by-value params (snapshot before next file clears it)
      const passByValue = this.codeGenerator.getPassByValueParams();
      const passByValueCopy = MapUtils.deepCopyStringSetMap(passByValue);

      // Directly update state (no contribution round-trip)
      this.symbolCollectors.set(sourcePath, symbolInfo);
      this.perFilePassByValueParams.set(sourcePath, passByValueCopy);
      this.userIncludes.set(sourcePath, [...userIncludes]);

      // #1323: resolve this file's header-render input while its state is
      // warm (reads from state populated above), but do not render it here.
      // HeaderRenderer renders every file's header in one step, after
      // this per-file loop finishes -- headerCode is filled in there.
      const headerFacts = this._captureHeaderEmissionFacts(file);
      if (headerFacts) {
        this.headerEmissionFactsByPath.set(sourcePath, headerFacts);
      }

      // Issue #1143: read after header-facts CAPTURE, and before the next
      // file's TranspileState.reset() clears the recording map. This covers a
      // requirement that capturing a header's facts triggers (e.g. through
      // convertToHeaderSymbols) -- it does NOT cover one the RENDER might
      // trigger, since #1323 moved rendering to Stage 5.5, after every file's
      // requirements have already been read here and reset() has run N times.
      // Currently unreachable rather than wrong: TranspileState.requireToolchain
      // has no caller under output/headers/, so no render path records one --
      // but this read does not guarantee that stays true, and #1143 is
      // precisely the bug class where an ordering assumption like that broke
      // under a later refactor.
      const requirements = this.codeGenerator.getToolchainRequirements();

      return this.buildSuccessResult(
        sourcePath,
        code,
        declarationCount,
        requirements,
      );
    } catch (err) {
      return this.buildCatchResult(sourcePath, err);
    }
  }

  // ===========================================================================
  // File Discovery
  // ===========================================================================

  /**
   * Resolve C/C++ headers transitively, wired to this run.
   *
   * There were two call sites -- one per entry shape, source and disk -- and
   * each built the same three-field options bag and pushed the warnings onto
   * the same list, so how a run reaches the filesystem, which processed-path
   * set it shares, and whether it logs was decided twice. This method made it
   * one decision. Since #1435 source mode discovers through
   * `_buildPipelineInput` too, so there is one call site; the options stay
   * decided here, where the roots and the include directories are the
   * caller's only business.
   *
   * ## `processedPaths` is inert today, and stays
   *
   * Dropping it reddens 0 of 1248 fixtures. It seeds the resolver's `visited`
   * set, and the set is empty at the call site: the only production writer is
   * `doCollectHeaderSymbols`, which is Stage 2, and the caller is discovery.
   * `isHeaderProcessed` has no production caller at all -- tests are its only
   * readers, which is why knip and `unused-code:check` stay green over it
   * (#1418).
   *
   * Not deleted. It is a cycle guard that happens to be unreached on the order
   * the pipeline runs in today, not one that cannot fire: a second discovery
   * pass on a live instance would hand it a populated set. #1143 is this
   * repository's record of what removing an unreached defense costs.
   */
  private _resolveHeadersTransitively(
    rootHeaders: IDiscoveredFile[],
    includeDirs: string[],
  ): IDiscoveredFile[] {
    const { headers, warnings } = IncludeResolver.resolveHeadersTransitively(
      rootHeaders,
      includeDirs,
      {
        onDebug: this.config.debugMode
          ? (msg) => console.log(`[DEBUG] ${msg}`)
          : undefined,
        processedPaths: this.processedHeaders,
        fs: this.fs,
      },
    );
    this.warnings.push(...warnings);
    return headers;
  }

  /**
   * Issue #1467: record where each `.cnx` include of `sourcePath` resolves to.
   * MERGED rather than replaced -- a file reached through more than one
   * discovery pass contributes the same answers, and dropping the earlier map
   * would lose the includes of whichever pass ran first.
   */
  private _recordCnxIncludeRewrites(
    sourcePath: string,
    rewrites: ReadonlyMap<string, string>,
  ): void {
    const existing = this.discoveredCnxIncludeRewrites.get(sourcePath);
    if (!existing) {
      this.discoveredCnxIncludeRewrites.set(sourcePath, new Map(rewrites));
      return;
    }
    for (const [spec, headerPath] of rewrites) {
      existing.set(spec, headerPath);
    }
  }

  /**
   * Stage 1 for a `{ kind: "source" }` run: the same discovery as files mode,
   * rooted at text that is supplied rather than read.
   *
   * #1435: this resolved only the root itself and walked the rest with a
   * second walker. That walker rebuilt each include's search path without the
   * PlatformIO and Arduino tiers, read files around the injected filesystem,
   * collected no header an include pulled in, and did not know the root was
   * already in the run -- so a cyclic include enqueued the root a second time
   * and declared it twice (E0203). Discovery is one loop now, and the root is
   * in its graph from the start, so a back edge to it is an edge.
   */
  private _discoverFromSource(entry: IInMemorySource): IPipelineInput {
    const root: IDiscoveredFile = {
      path: entry.path,
      type: EFileType.CNext,
      extension: ".cnx",
    };
    const discovered = this._buildPipelineInput(
      [root],
      new Map([[resolve(entry.path), root]]),
      entry,
    );

    // The root is the one file this run generates; everything it reaches only
    // contributes symbols. Source mode uses the basename for a self-include, to
    // match files mode.
    return {
      ...discovered,
      cnextFiles: discovered.cnextFiles.map((file) =>
        file.path === entry.path
          ? {
              ...file,
              source: entry.source,
              sourceRelativePath: basename(entry.path),
            }
          : { ...file, symbolOnly: true },
      ),
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
    // Issue #587: Reset accumulated state for new run
    this.symbolCollectors.clear();
    this.perFilePassByValueParams.clear();
    this.userIncludes.clear();
    this.headerIncludeDirectives.clear();
    this.processedHeaders.clear();
    // #1452: 1.1 Discover's maps (three since #1435). `TranspilerState.reset()` cleared these
    // alongside the five above, and re-writing that teardown as inline calls
    // dropped them -- the drift this method's own SymbolTable comment below
    // records, in the commit that recorded it. `IDiscoveryFacts` documents
    // "empty means this run never discovered the file" as a REAL answer that
    // ADR-010's E0504 reads, and `Program.build` is handed both by reference,
    // so a retained entry answers for a file the run never saw.
    this.discoveredCnxIncludeRewrites.clear();
    this.discoveredIncludeSearchPaths.clear();
    this.discoveredQuotedIncludeDirectories.clear();
    // ADR-049: the previous run's targets must not decide this run's budget
    this.pragmaTargets = [];
    // #1662: both are run-scoped and both were initialized ONCE, in the
    // constructor, so neither was ever cleared. `warnings` is pushed to per run
    // and copied onto every result, which made three runs of one source on one
    // transpiler report 1, then 2, then 3 copies of the same missing-header
    // warning; `anyHeaderPreprocessFailed` latches, so one failed preprocess
    // left the #985 recovery path armed for every later run. `ServeCommand`
    // holds a static transpiler, so "later run" is the normal case there.
    //
    // `warnings` is `readonly`, so it is emptied rather than replaced -- the
    // result copies it with a spread, so nothing holds the array itself.
    this.warnings.length = 0;
    this.anyHeaderPreprocessFailed = false;
    // #1323: a stale entry here would let one run's header content leak into
    // the next, the same shape #1143's toolchain-requirements leak was.
    this.headerEmissionFactsByPath.clear();
    // Issue #634: Reset symbol table for new run
    // #1452 box 5 / #1177: a run BUILDS its table rather than clearing one.
    // `clear()` listed eleven of twelve indexes -- `externalDeclarationNames`
    // was added and the teardown was not, so names recovered from one run
    // silenced a diagnostic in the next. `ServeCommand` holds a static
    // transpiler, so that second run is a real one. Adding the twelfth line
    // would have fixed this instance and left the shape; construction leaves no
    // teardown to drift from.
    this.codeGenerator.transpileState.symbolTable = new SymbolTable();
    // Reset SymbolRegistry for new run (new IFunctionSymbol type system)
    this.symbolRegistry = new SymbolRegistry();
    // #1452: the callback map needed a per-RUN reset here because it was a
    // mutable static that `TranspileState.reset()` deliberately skipped.
    // `CallbackCompatibility.derive` returns it now, so there is nothing to
    // clear -- the run's answer is built fresh and handed to `Program`.
    // #1447: the previous run's Program is not this run's artifact. Nothing
    // may read one across runs, and leaving a stale one reachable is the
    // shape #1323's header-content leak had.
    this.program = null;
    this.codeGenerator.transpileState.program = null;
    // Issue #1241: the previous run's ADR provenance is not this run's evidence
    AdrProvenance.reset();
    // #1143, #1452: the toolchain ledger, and unlike everything above it this
    // one cannot change any output. It is MEMORY HYGIENE, stated as such.
    //
    // The comment here used to claim it stopped a run that plans nothing from
    // reporting the previous run's cost. It cannot: every reader runs after
    // `generate()`'s own `reset()` -- `collect()` from `buildBanner` inside
    // `generate()` and from `_transpileFile` immediately after it,
    // `takeDeferredSites()` from inside `generate()` -- so a run that plans no
    // file never reads the ledger at all. Verified by deleting this line: 7438
    // unit tests and 1263 fixtures stay green, which is why no regression test
    // could be written for it.
    //
    // Kept because `ServeCommand` holds a `private static transpiler`, so
    // without it the last run's entries sit in a process-wide map until the
    // next file is planned. A line that provably changes no output needs to say
    // so, or the next reader preserves it for the reason it does not have.
    ToolchainRequirements.reset();
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
   * True for a deliberate C-Next diagnostic rather than an incidental failure.
   *
   * Keyed on the `E<NNNN>: ` prefix -- the SHAPE, not any one code -- because
   * that is already this codebase's identity for a diagnostic: `.expected.error`
   * fixtures assert it and `docs/diagnostic-manifest.md` is generated from it.
   * Reading the existing identity avoids inventing a second one to keep in step.
   */
  private static isDiagnostic(err: unknown): boolean {
    return err instanceof Error && /^E\d{4}: /.test(err.message);
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
        // Issue #1319: this catch exists to tolerate third-party headers that
        // will not parse -- a real need, and why it is broad. A C-Next
        // diagnostic is not that: it is a rejection this transpiler made on
        // purpose. Swallowing one turned E0507 into `Warning: ...` followed by
        // `Compiled 1 files` and exit 0, which is the silent-failure shape the
        // diagnostic exists to remove. Diagnostics propagate; parse failures
        // still degrade.
        if (Transpiler.isDiagnostic(err)) {
          throw err;
        }
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
    Transpiler._clearPhantomStructBodies(
      cleanState,
      this.codeGenerator.transpileState,
    );

    // Function-like macros have no declaration to parse; register their names for
    // the undeclared-call check only (a by-value macro invocation is correct).
    if (recovery.macroNames.size > 0) {
      this.codeGenerator.transpileState.symbolTable.addExternalDeclarationNames(
        recovery.macroNames,
      );
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
   * opaque/struct-body truth. parseCHeader (main table) picks the C or C++ parser
   * by content and skips assembler; the isolated table uses the C parser directly
   * (opaque struct typedefs are a C concern) and tolerates slices it cannot
   * parse -- except a deliberate diagnostic, which propagates.
   */
  private _parseRecoveredSlices(
    perFileContent: Map<string, string>,
  ): SymbolTable {
    const cleanState = new SymbolTable();
    for (const [path, content] of perFileContent) {
      try {
        this.parseCHeader(content, path);
      } catch (err) {
        // #1319: same decision as the sibling catch in _collectAllHeaderSymbols.
        // `parseCHeader` now raises E0507, and swallowing it here would produce
        // the `Compiled N files` / exit 0 shape that diagnostic exists to
        // remove -- so "is this a deliberate diagnostic?" is answered in both
        // places or in neither.
        //
        // Reachable by construction rather than by fixture: recovery runs on the
        // PREPROCESSED translation unit where stage 2 saw RAW content, and those
        // differ exactly for headers hiding C++ behind `#ifdef __cplusplus`.
        if (Transpiler.isDiagnostic(err)) {
          throw err;
        }
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
  private static _clearPhantomStructBodies(
    cleanState: SymbolTable,
    state: TranspileState,
  ): void {
    const cleanBodies = new Set(cleanState.getAllStructTagsWithBodies());
    for (const typedefName of cleanState.getAllOpaqueTypes()) {
      if (!cleanState.isOpaqueType(typedefName)) continue;
      const tag = state.symbolTable.getStructTagForTypedef(typedefName);
      if (tag && !cleanBodies.has(tag)) {
        state.symbolTable.clearStructTagHasBody(tag);
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
    // #1511: read from the artifact, not re-derived from the table. Stage 3
    // built it; a null here would mean this ran before 1.4, which the stage
    // order rules out.
    // #1511: asserted, not defaulted -- a missing artifact would report zero
    // conflicts and pass the check. Stage 3 returns false on a build failure
    // before this runs, so reaching here without one is a broken stage order.
    if (!this.program) {
      throw new Error(
        "Internal error: symbol-conflict check ran before 1.4 Resolve built Program",
      );
    }
    const conflicts = this.program.conflicts();
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
    // NOT TranspileState.targetCapabilities: codegen assigns that in Stage 5, one
    // stage after this runs, so it holds the module default on a fresh process
    // and the previous file's target in a long-lived one (#1307 review). The
    // budget a whole-program check reports against has to be the build's.
    const collisions =
      this.codeGenerator.transpileState.symbolTable.detectMISRA51Conflicts(
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
   * Stage 6: Write the headers Stage 5.5 rendered for pipeline files.
   *
   * Issue #1139, historically: this stage used to call generateHeaderForFile()
   * a second time, once per file, after every file had been transpiled. That
   * function read live CodeGenState — which is per-file — so by then it saw
   * only the last-transpiled file's data and rebuilt every other file's
   * header from it. A dependency lost the ADR-006 auto-const its own .c
   * definition carried, giving conflicting types. Single-file builds hid it
   * because the only file is also the last one.
   *
   * #1323: that method no longer exists, and this stage was never the
   * problem — it always just wrote `result.files[].headerCode`. What changed
   * is who fills that field in: `_captureHeaderEmissionFacts` resolves each
   * file's header content, at its own warm moment, into a frozen record;
   * `_renderHeaders` (Stage 5.5) turns every record into text in one batch,
   * reading no CodeGenState at all. Reintroducing #1139 today would mean
   * making this stage call `CodeGenState`-reading logic directly again,
   * instead of reading the already-rendered `headerCode` — there is no
   * "second call" left to make by accident, only a wrong one to add back.
   */
  private _generateAllHeadersFromPipeline(
    cnextFiles: IPipelineFile[],
    result: ITranspilerResult,
    renderedFiles: ReadonlyMap<string, IRenderedFile>,
  ): void {
    for (const file of cnextFiles) {
      if (!Transpiler._producesOutput(file)) {
        continue;
      }
      const headerContent = renderedFiles.get(file.path)?.header;
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
    result.symbolsCollected =
      this.codeGenerator.transpileState.symbolTable.size;
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
      // Issue #1319: the message, not the Error. `${err}` stringifies to
      // "Error: <message>", so a diagnostic surfaced here read
      // "Pipeline failed: Error: E0507: ..." with a doubled prefix the sibling
      // "Code generation failed" wrapper does not have.
      message: `Pipeline failed: ${err instanceof Error ? err.message : String(err)}`,
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
   * Collect the C/C++ headers a file includes.
   *
   * #1435: this skipped any header whose BASENAME matched a C-Next file of the
   * run, a guess from when discovery scanned whole directories and every `.h`
   * beside a `.cnx` was "likely generated output" (77d2a9903). A basename is
   * not an identity -- the #1134 shape -- so `uart.cnx` wrapping ESP-IDF's
   * `<driver/uart.h>` lost the vendor header and failed with E0422. A header
   * the transpiler generated is identified by the marker it carries, and
   * `IncludeResolver.resolveHeadersTransitively` already skips it on that.
   */
  private _collectHeaders(
    resolved: {
      headers: IDiscoveredFile[];
      headerIncludeDirectives: Map<string, string>;
    },
    headerSet: Map<string, IDiscoveredFile>,
  ): void {
    for (const header of resolved.headers) {
      headerSet.set(header.path, header);
      // Issue #497: Store the include directive for this header
      const directive = resolved.headerIncludeDirectives.get(header.path);
      if (directive) {
        this.headerIncludeDirectives.set(header.path, directive);
      }
    }
  }

  /**
   * Process C-Next includes from resolved includes.
   * Issue #461: Collect included .cnx files for symbol resolution
   * Issue #580: Track dependencies for topological sorting
   *
   * @returns this file's direct includes, each as the run's own entry for that
   *   file (#1435), so 1.4's visibility closure keys on the same paths the
   *   files were declared under.
   */
  private _processCnextIncludes(
    resolved: {
      cnextIncludes: IDiscoveredFile[];
      headerIncludeDirectives: Map<string, string>;
    },
    cnxPath: string,
    depGraph: DependencyGraph,
    cnextFiles: IDiscoveredFile[],
    fileByPath: Map<string, IDiscoveredFile>,
  ): IDiscoveredFile[] {
    const direct: IDiscoveredFile[] = [];
    for (const cnxInclude of resolved.cnextIncludes) {
      const includePath = resolve(cnxInclude.path);

      depGraph.addDependency(cnxPath, includePath);

      // Issue #854: Store header directive for cnext include types
      const directive = resolved.headerIncludeDirectives.get(includePath);
      if (directive) {
        this.headerIncludeDirectives.set(includePath, directive);
      }

      // Don't add if already in the list.
      //
      // Issue #1134: identity here is the RESOLVED PATH, never the basename.
      // Keying on the basename made can/config.cnx and uart/config.cnx the same
      // file, so the second was dropped from the compilation entirely — the
      // transpiler exited 0 and emitted C-Next source syntax into the C output.
      const existing = cnextFiles.find((f) => resolve(f.path) === includePath);
      if (!existing) {
        cnextFiles.push(cnxInclude);
        fileByPath.set(includePath, cnxInclude);
      }
      direct.push(existing ?? cnxInclude);
    }
    return direct;
  }

  /**
   * Resolve one `.cnx` file's includes -- the one place discovery decides such
   * a file's text, its directory and its search path. The directory and the
   * search path are recorded, so 2.1's ADR-010 rules read them rather than
   * derive them again. (A C/C++ entry point's marker scan still builds a
   * search path of its own: #1706.)
   *
   * #1435: every file in a run comes through here, including the root of a
   * source run, whose text is `inMemory.source` and whose directory is
   * `inMemory.directory`. The search path is the same computation for both: the
   * caller's include directories, then everything `discoverIncludePaths` finds
   * from the file's directory (the project tiers, PlatformIO libdeps and
   * Arduino libraries), then the configured ones. An in-memory root used to
   * get a path without the PlatformIO and Arduino tiers, so the editor preview
   * could not see a library the CLI compiled -- and, an unresolved `<x.cnx>`
   * reading as a foreign header, emitted `EColor.GREEN` as C at exit 0.
   */
  private _resolveCnxIncludes(
    cnxFile: IDiscoveredFile,
    inMemory?: IInMemorySource,
  ): ReturnType<IncludeResolver["resolve"]> {
    const content = inMemory?.source ?? this.fs.readFile(cnxFile.path);
    const sourceDir = inMemory?.directory ?? dirname(cnxFile.path);
    const searchPaths = IncludeResolver.buildSearchPaths(
      sourceDir,
      this.config.includeDirs,
      [
        ...(inMemory?.includeDirs ?? []),
        ...IncludeDiscovery.discoverIncludePaths(
          join(sourceDir, basename(cnxFile.path)),
          this.fs,
        ),
      ],
      undefined,
      this.fs,
    );

    const resolver = new IncludeResolver(
      searchPaths,
      this.outputExtensions.header,
      this.fs,
      this._headerIncludePathFor,
    );
    const resolved = resolver.resolve(content, cnxFile.path);
    // Issue #1467: one resolution, read later by both the .c and the .h
    this._recordCnxIncludeRewrites(cnxFile.path, resolved.cnextIncludeRewrites);
    // Issue #1322: the same list ADR-010's E0504 asks about in pass 2.1
    this.discoveredIncludeSearchPaths.set(cnxFile.path, [...searchPaths]);
    // #1435: and the same directory its E0506 and quoted E0504 resolve from
    this.discoveredQuotedIncludeDirectories.set(cnxFile.path, sourceDir);
    this.warnings.push(...resolved.warnings);
    return resolved;
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

    // #1541: these are ERRORS, and they now behave like it.
    //
    // They were pushed onto `this.warnings` with a hand-written `Error: `
    // prefix, which produced `Warning: Error: C-Next source not found: x.cnx`
    // and, far worse, exit 0 with zero output files -- while the same fault
    // reached through a quoted include is E0506 and exits 1. Two discovery
    // routes, one class of fault, opposite outcomes.
    //
    // The comment that stood here said the prefix was "to distinguish from
    // informational warnings", which states the conflation rather than
    // resolving it: `IScanResult` already separates the two, and only this
    // consumer merged them.
    //
    // This is the shape #1319 settled twice in the catches above -- a
    // deliberate rejection propagates, an incidental failure degrades. The
    // error was buried doubly here, because a marker found with no source also
    // sets `noCNextFound`, so the run additionally printed the friendly
    // "To get started:" onboarding text at a user whose header path was wrong.
    // The warnings are pushed BEFORE the throw, deliberately. The scan collects
    // `#include "x.h" not found (from ...)` and `Could not read <path>`, and a
    // missing C-Next source is very often downstream of exactly those -- so
    // throwing first would report "that source is not there" while discarding
    // the reason. `ResultPrinter` emits warnings above errors, so they land
    // where a reader looks next.
    this.warnings.push(...scanResult.warnings);

    if (scanResult.errors.length > 0) {
      throw new Error(
        `E0509: ${scanResult.errors.join("\n       ")}\n` +
          `  A generated header records the C-Next source it was written from.\n` +
          `  Check that source is present, and reachable from the include path.`,
      );
    }

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
    inMemory?: IInMemorySource,
  ): IPipelineInput {
    const headerSet = new Map<string, IDiscoveredFile>();
    const depGraph = new DependencyGraph();

    const directForeignHeaderFiles = new Set<string>();
    // #1435: the include graph, kept. It is resolved here once, with the full
    // search path, and 1.4 takes every file's visibility closure over it.
    const includesByPath = new Map<string, IDiscoveredFile[]>();
    // `cnextFiles` grows as includes are found, so this visits the closure.
    for (const cnxFile of cnextFiles) {
      const cnxPath = resolve(cnxFile.path);
      depGraph.addFile(cnxPath);
      const resolved = this._resolveCnxIncludes(
        cnxFile,
        inMemory?.path === cnxFile.path ? inMemory : undefined,
      );
      if (resolved.hasForeignInclude) {
        directForeignHeaderFiles.add(cnxPath);
      }
      this._collectHeaders(resolved, headerSet);
      includesByPath.set(
        cnxPath,
        this._processCnextIncludes(
          resolved,
          cnxPath,
          depGraph,
          cnextFiles,
          fileByPath,
        ),
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
    const allHeaders = this._resolveHeadersTransitively(
      [...headerSet.values()],
      this.config.includeDirs,
    );

    // Convert IDiscoveredFile[] to IPipelineFile[] (disk-based, all get code gen)
    const pipelineFiles: IPipelineFile[] = sortedCnextFiles.map((f) => {
      const cnextIncludes = includesByPath.get(resolve(f.path));
      invariant(
        cnextIncludes !== undefined,
        `discovery resolved no includes for ${f.path}, which it sorted`,
      );
      return {
        path: f.path,
        discoveredFile: f,
        cnextIncludes,
        reachesForeignHeader: reachesForeign.has(resolve(f.path)),
      };
    });

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
    this.processedHeaders.add(absolutePath);

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
      const symbols =
        this.codeGenerator.transpileState.symbolTable.getSymbolsByFile(
          file.path,
        );
      console.log(`[DEBUG]   Found ${symbols.length} symbols in ${file.path}`);
    }

    // Issue #590: Cache the results using simplified API. Issue #985: record when
    // this header fell back to raw content so a warm-cache build re-runs recovery.
    if (this.cacheManager) {
      this.cacheManager.setSymbolsFromTable(
        file.path,
        this.codeGenerator.transpileState.symbolTable,
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

    this.codeGenerator.transpileState.symbolTable.restoreStructFields(
      cached.structFields,
    );
    this.codeGenerator.transpileState.symbolTable.restoreNeedsStructKeyword(
      cached.needsStructKeyword,
    );
    this.codeGenerator.transpileState.symbolTable.restoreEnumBitWidths(
      cached.enumBitWidth,
    );

    // Issue #1225: the whole struct state at once. It used to be four separate
    // restore calls, which is how #1164's pointerTypedefs was missed.
    this.codeGenerator.transpileState.symbolTable.restoreStructState(
      cached.structState,
    );

    // Issue #211: Still check for C++ syntax even on cache hit
    this.rejectUndeclaredCppFromFileType(file);

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
        this.codeGenerator.transpileState.symbolTable.addCSymbol(symbol);
      } else {
        this.codeGenerator.transpileState.symbolTable.addCppSymbol(symbol);
      }
    }

    return true;
  }

  /**
   * Issue #1319: E0507 -- C++ met in a run that did not declare C++.
   *
   * This is the whole of what "detection" is for now. It used to raise a latch
   * and silently change the output language; a transpiler that guesses which
   * language it emits, from a file the user did not write, is guessing about
   * the thing it is least able to guess about. Naming the file and the fix is
   * strictly more useful than being quietly right most of the time.
   */
  private rejectUndeclaredCpp(reason: string, filePath: string): void {
    if (this.cppMode) {
      return;
    }

    throw new Error(
      // #1319: cwd-relative, via the one helper that renders a path for a
      // human. An absolute path here would be the first in any .expected.error
      // and would differ on every machine; a basename would be ambiguous
      // (can/config.h vs uart/config.h). DeclarationSite already settled this.
      `E0507: ${reason} in '${DeclarationSite.displayPath(filePath)}', but ` +
        `this run does not target C++.\n` +
        `  C-Next emits C unless told otherwise. To compile as C++, set\n` +
        `  'cppRequired: true' in your config, or pass --cpp.`,
    );
  }

  /**
   * Reject undeclared C++ reached through a header's type or content.
   * SonarCloud S3776: Extracted from doCollectHeaderSymbols().
   *
   * Issue #1319: when C++ IS declared there is nothing to check, so the file
   * read below is skipped entirely rather than performed and discarded.
   */
  private rejectUndeclaredCppFromFileType(file: IDiscoveredFile): void {
    if (this.cppMode) {
      return;
    }

    if (file.type === EFileType.CppHeader) {
      this.rejectUndeclaredCpp("C++ header", file.path);
      return;
    }

    if (file.type === EFileType.CHeader) {
      const content = this.fs.readFile(file.path);
      if (detectCppSyntax(content)) {
        this.rejectUndeclaredCpp("C++ syntax", file.path);
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
      this.rejectUndeclaredCpp("C++ header", file.path);
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
      // Issue #1319: this predicate answers two questions. Which PARSER the
      // header needs is a parsing fact and still decided here. Whether the RUN
      // emits C++ is not, and is now declared -- so this rejects rather than
      // switches.
      this.rejectUndeclaredCpp("C++ syntax", filePath);
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
        this.codeGenerator.transpileState.symbolTable,
      );
      // ADR-055 Phase 7: Store TCSymbol directly
      this.codeGenerator.transpileState.symbolTable.addCSymbols(result.symbols);
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
        this.codeGenerator.transpileState.symbolTable,
      );
      // ADR-055 Phase 7: Store TCppSymbol directly
      this.codeGenerator.transpileState.symbolTable.addCppSymbols(
        result.symbols,
      );
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
   * Stage 5: Resolve one file's header-render input from its exported symbols.
   * ADR-055 Phase 7: Uses TSymbol directly, converts to IHeaderSymbol for generation.
   *
   * #1323: this decides a header's content -- it no longer renders it. It
   * returns the resolved `IHeaderEmissionFacts` `HeaderRenderer` will
   * later pass to `HeaderGenerator.generate()`, instead of calling that
   * itself. That split is what makes issue #1139 structurally impossible
   * rather than merely fixed: #1139 happened because a SECOND, LATER call
   * re-read live `CodeGenState` after it had moved on to a different file.
   * There is now only one caller, and nothing downstream of this method's
   * return value ever reads `CodeGenState` again -- see `IHeaderEmissionFacts`.
   *
   * Still call this exactly once per file, from `_transpileFile()`, while
   * that file's state is warm: `TranspileState.needsISR`,
   * `generatedStructInits`, `callbackTypes` and the auto-const/opaque
   * resolution inside `convertToHeaderSymbols` are ALL per-file, cleared by
   * `TranspileState.reset()` before the next file transpiles. Capturing them
   * into `IHeaderEmissionFacts` here, at the only moment they are correct for
   * THIS file, is what lets the render move later.
   *
   * **`allKnownEnums`/`externalTypeHeaders` depend on topological file
   * order** for the SAME reason they always have: `state.getAllSymbolInfo()`
   * and `state.getAllHeaderDirectives()` are whole-project accumulators that,
   * from here, hold only the files transpiled *so far* -- sufficient because
   * `_sortFilesByDependency()` orders files by `depGraph.getSortedFiles()`,
   * so every transitive dependency of THIS file has already been transpiled.
   * A dependency cycle would break that ordering (`_sortFilesByDependency`
   * drains `depGraph.getWarnings()` into warnings rather than failing, so
   * cycle order is arbitrary, #1167) -- captured here rather than read by
   * `HeaderRenderer` for exactly that reason: reading it once more,
   * after every file, would make a cycle's header content correct regardless
   * of order, but that is a genuine behavior change belonging to #1167, not
   * a side effect of this refactor.
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
  private static _needsDefiningHeader(
    typeName: string,
    state: TranspileState,
  ): boolean {
    if (state.symbolTable.isPointerTypedef(typeName)) {
      return true;
    }

    // Known to a C/C++ header, but not as something forward-declarable.
    //
    // The C++ index is keyed by the C++ NAME -- `SeaDash::Parse::ParseResult`
    // -- while a C-Next type naming it carries the generated C form,
    // `SeaDash__Parse__ParseResult`. Asking the index with the transpiled name
    // returns nothing for every namespaced type, which reads as "no such
    // symbol" rather than "wrong question" (CLAUDE.md, #1139). That is why
    // #1520's four headers declared a field whose type nothing defined: the
    // lookup could not fail loudly, it just answered no. `toCppQualified` is
    // the single encoder for that key, and it leaves an unqualified name alone.
    const declared =
      state.symbolTable.getCppSymbol(
        QualifiedCName.toCppQualified(typeName, "::"),
      ) ??
      state.symbolTable.getCppSymbol(typeName) ??
      state.symbolTable.getCSymbol(typeName);
    if (!declared) {
      return false;
    }

    return (
      // #1511: the artifact's verdict, not the table's.
      !(state.program?.isOpaqueType(typeName) ?? false) &&
      !declared.sourceFile.endsWith(".cnx")
    );
  }

  /**
   * Whether the header must carry the source's own C/C++ includes.
   *
   * Two reasons, and they are different questions over the same symbols:
   *
   *   - the header names a MACRO it does not define -- an array dimension that
   *     stayed an identifier, which only the source's headers supply (#424); or
   *   - the header names a TYPE whose definition lives in one of them.
   *
   * The second used to be asked per symbol kind, here, and answered `false` for
   * a struct -- so a struct field typed by a C++ header got no include and the
   * header would not compile (#1520). The enumeration is now
   * `HeaderTypeNames.collect`, shared with the other derivation that had the
   * same hole, and this asks only the question it owns.
   */
  private static _headerNeedsUserCHeaders(
    symbols: TSymbol[],
    state: TranspileState,
  ): boolean {
    if (symbols.some(Transpiler._namesMacroDimension)) {
      return true;
    }
    for (const typeName of HeaderTypeNames.collect(symbols)) {
      if (Transpiler._needsDefiningHeader(typeName, state)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Issue #424: an array dimension that is still an identifier is a macro the
   * header names and does not define.
   */
  private static _namesMacroDimension(symbol: TSymbol): boolean {
    return (
      symbol.kind === "variable" &&
      (symbol.arrayDimensions?.some(
        (dimension) => typeof dimension === "string",
      ) ??
        false)
    );
  }

  private _captureHeaderEmissionFacts(
    file: IPipelineFile,
  ): IHeaderEmissionFacts | null {
    const sourcePath = file.path;
    // Issues #1161/#1164: the same predicate decides whether this header is
    // written and whether the generated .c includes it. Do not re-derive it.
    const exportedSymbols = PublicInterface.forFile(
      this.codeGenerator.transpileState.symbolTable,
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

    const typeInput = this.symbolCollectors.get(sourcePath);
    const passByValueParams =
      this.perFilePassByValueParams.get(sourcePath) ??
      new Map<string, Set<string>>();
    const cnxIncludes = this.userIncludes.get(sourcePath) ?? [];
    // Issue #424: a dimension that is not a number is a macro the header names
    // but does not define, so the header must carry its source include.
    const cHeadersIncluded = Transpiler._headerNeedsUserCHeaders(
      exportedSymbols,
      this.codeGenerator.transpileState,
    );
    const userIncludes = cHeadersIncluded
      ? [
          ...cnxIncludes,
          ...(this.userIncludes.get(`${sourcePath}\u0000c-headers`) ?? []),
        ]
      : cnxIncludes;

    // #1447: read from the artifact, not accumulated from the files transpiled
    // so far. The old form was correct only because `_sortFilesByDependency`
    // put every dependency first, and a dependency cycle (#1167) made the order
    // -- and so the answer -- arbitrary. `Program` is complete before any file
    // is rendered, so this cannot depend on where in the run it is asked.
    const allKnownEnums = this.program?.knownEnums() ?? new Set<string>();

    // #1511: which types a header declares comes from the artifact. The
    // include ORDER stays here -- it decides which header wins, and that is not
    // a symbol fact.
    const externalTypeHeaders = ExternalTypeHeaderBuilder.build(
      this.headerIncludeDirectives,
      {
        typesDeclaredIn: (file: string) =>
          this.program?.typesDeclaredIn(file) ?? new Set<string>(),
      },
    );

    // ADR-029: Convert callback types to header format
    const callbackTypesForHeader = this._buildCallbackTypesForHeader();

    const typeInputWithSymbolTable = typeInput
      ? {
          ...typeInput,
          symbolTable: this.codeGenerator.transpileState.symbolTable,
          callbackTypes: callbackTypesForHeader,
        }
      : undefined;

    const unmodifiedParams = this.codeGenerator.getFunctionUnmodifiedParams();
    const headerSymbols = this.convertToHeaderSymbols(
      exportedSymbols,
      unmodifiedParams,
      allKnownEnums,
    );

    return {
      symbols: headerSymbols,
      filename: headerName,
      options: {
        userIncludes,
        cHeadersIncluded,
        // ADR-040: same flag the .c consults, so exactly one file emits it.
        needsIsrTypedef: this.codeGenerator.transpileState.needsISR,
        // #1205: same shape -- the .c records which init functions it
        // emitted, the header declares exactly those. Copied, not aliased:
        // this record must stay frozen once captured, and TranspileState.reset()
        // happens to rebind this field to a new Set rather than clearing it in
        // place (TranspileState.ts) -- true today, but not a contract anything
        // enforces, so a live reference here would be correct only by
        // coincidence with reset()'s current implementation.
        generatedStructInits: new Set(
          this.codeGenerator.transpileState.generatedStructInits,
        ),
        // #1453: same contract, same reason -- copied at capture, never read
        // live by the render.
        registerBlocks: [
          ...this.codeGenerator.transpileState.exportedRegisterBlocks,
        ],
        externalTypeHeaders,
        cppMode: this.cppMode,
        // #1517: 2.2 Plan decides; the header generator prints. Possible only
        // since #1520 made `headerCType` the one answer to "what does this
        // header call this type" -- before that, deciding from the symbols
        // meant deriving the type mapping a second time.
        systemIncludes: HeaderIncludes.decide(
          exportedSymbols,
          this.codeGenerator.transpileState.symbolTable,
        ),
      },
      typeInput: typeInputWithSymbolTable,
      passByValueParams,
      allKnownEnums,
      basename: basename(sourcePath),
    };
  }

  /**
   * ADR-029: Build callback types for header generation.
   * Only includes callbacks that are actually used as struct field types.
   * Converts TranspileState.callbackTypes to the format expected by IHeaderTypeInput.
   */
  private _buildCallbackTypesForHeader(): ReadonlyMap<
    string,
    IHeaderCallbackType
  > {
    const result = new Map<string, IHeaderCallbackType>();

    // Issue #1164: same predicate the .c uses to decide it must NOT emit these.
    const usedCallbackTypes = new Set<string>();
    for (const funcName of this.codeGenerator.transpileState.callbackTypes.keys()) {
      if (
        this.codeGenerator.transpileState.headerOwnsCallbackTypedef(funcName)
      ) {
        usedCallbackTypes.add(funcName);
      }
    }

    for (const funcName of usedCallbackTypes) {
      const cbInfo =
        this.codeGenerator.transpileState.callbackTypes.get(funcName);
      if (cbInfo) {
        result.set(funcName, {
          typedefName: cbInfo.typedefName,
          returnType: cbInfo.returnType,
          // #1164/#1552: pass the parameter through WHOLE. This used to say so
          // while enumerating six of the seven fields below it, and the one it
          // left out was `isString` -- so the formatter's `string<N>` branch
          // never fired and the header's typedef disagreed with its own
          // prototype in a single file. Naming no fields is what makes the
          // comment true; `IHeaderCallbackType` now names the formatter's own
          // parameter type, so a new field cannot go missing here again.
          parameters: cbInfo.parameters,
        });
      }
    }

    return result;
  }

  /**
   * Run pass 1.3 Declare for one file: its own symbols, from its own tree.
   *
   * This docblock used to describe deriving "which scope types are visible
   * from this file" here, first, from the per-file symbol views and
   * `this.config.includeDirs`, and seeding Declare with the result (#1358,
   * #1333). None of that happens here now. #1472 took the seed out of Declare,
   * and what a file can see is 1.4's `Program.deriveVisibleSymbols`: a closure
   * over the include graph discovery resolved (#1435). It reads no include
   * directory, because rebuilding a search path is how it came to disagree
   * with discovery.
   */
  private _declareFile(
    tree: Parser.ProgramContext,
    sourcePath: string,
  ): IFileSymbols {
    // #1472 item 2: no cross-file parameter. Declare is handed one tree and one
    // path, and everything it authors is computable from those alone.
    //
    // The seed this replaced was the union of what each INCLUDED file declared,
    // threaded in so a bare type reference could be qualified here. That made
    // Declare answer a cross-file question, and it also made the answer depend
    // on visit order: under an include cycle the toposort falls back to
    // insertion order (#1167), so an include's entry could be missing and the
    // seed silently short. Neither is true now -- 1.4 Resolve settles those
    // references against the whole program, after every file is declared, so
    // order cannot affect the result.
    const declared = CNextResolver.resolve(
      tree,
      sourcePath,
      this.symbolRegistry,
    );

    return declared;
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
      const headerSymbol = HeaderSymbolAdapter.fromTSymbol(
        symbol,
        this.codeGenerator.transpileState,
      );

      if (
        symbol.kind !== "function" ||
        !headerSymbol.parameters ||
        headerSymbol.parameters.length === 0
      ) {
        return headerSymbol;
      }

      // Issue #914: Resolve callback typedef type for callback-compatible functions.
      // #1545 review: through the one accessor, so this site and the body's
      // cannot spell the predicate differently -- they used to differ on `""`,
      // truthiness here against `!== undefined` there.
      const callbackTypedefType =
        this.codeGenerator.transpileState.callbackTypedefTypeFor(
          headerSymbol.name,
        );

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
        // TranspileState.callbackTypes. Without this the header emitted the bare
        // function name as a type ("const onReceive*"), which both contradicts
        // the .c's "onReceive_fp" and collides with the function's own
        // prototype ("redeclared as different kind of symbol").
        const callbackType =
          this.codeGenerator.transpileState.callbackTypes.get(param.type ?? "");
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
        const isOpaque = this.codeGenerator.transpileState.isOpaqueType(
          param.type ?? "",
        );

        // #1545: the same rule the body paths use, so the .h cannot disagree
        // with the .c (ADR-013, "Header Generation Sync"). The exclusions this
        // site used to spell out inline are now ADR-013's list inside the rule.
        // Note: isAutoConst may be set here, but ParameterSignatureBuilder will
        // suppress it for opaque handles (Issue #995) — single source of truth.
        //
        // isCallbackCompatible is false here because the early return above
        // took every callback whose typedef type resolves, and the body asks
        // the same question at the same granularity since #1545 -- the whole
        // function, not the parameter. #1603 records the remaining case: a
        // callback-compatible function whose typedef type does NOT resolve
        // reaches this line, and both paths then let auto-const apply, which is
        // why nothing reddens for it.
        const shouldAutoConst = AutoConstRule.applies({
          baseType: param.type ?? "",
          isModified: unmodified?.has(param.name) !== true,
          isExplicitlyConst: param.isConst,
          isCallbackCompatible: false,
          isArray: param.isArray,
          // #1545 review: this is the WHOLE-PROGRAM enum view (`allKnownEnums`
          // = program.knownEnums()), while the body supplies the PER-FILE one
          // (TranspileState.isKnownEnum). CLAUDE.md names that pair as #1312 --
          // a sibling never included is absent from one and present in the
          // other. Deliberate on both sides: each matches the enum view ITS
          // OWN pass-by-value decision reads, so neither introduces a new
          // disagreement inside its own file. They are unobservable against
          // each other today because enums route to _buildPassByValueParam,
          // which ignores isAutoConst -- masking, not unification, so this is
          // recorded rather than treated as settled.
          isKnownEnum: knownEnums.has(param.type ?? ""),
          // #995: computed fifteen lines up for the branch below. Supplying it
          // here is behavior-preserving -- ParameterSignatureBuilder already
          // zeroed isAutoConst for an opaque handle -- and moves the seventh
          // ADR-013 exclusion into the rule that claims to hold them all.
          isOpaqueHandle: isOpaque,
        });

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
   *
   * #1323: `headerCode` is filled in later, by `_renderHeaders` (Stage 5.5) --
   * not here. This used to take a `headerCode` parameter, but this is its
   * only caller and it always passed `undefined`, so the parameter was dead:
   * a slot that read as someone's to fill in, which is the second-write-path
   * shape #1139 was.
   */
  private buildSuccessResult(
    sourcePath: string,
    code: string,
    declarationCount: number,
    requirements: readonly IRecordedRequirement[] = [],
  ): IFileResult {
    return {
      sourcePath,
      code,
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
    // #1320: formatted by `_collectionError`, not re-spelled here. How a thrown
    // error becomes a diagnostic is ONE decision; it used to be written out in
    // both places, so changing the wording meant editing two.
    return {
      sourcePath,
      code: "",
      success: false,
      errors: [Transpiler._collectionError(err)],
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
    return this.codeGenerator.transpileState.symbolTable;
  }

  /**
   * The external-struct snapshot `InitializationAnalyzer` consults, for
   * inspection after a run.
   *
   * #1452 box 4: this was reachable as a mutable static, which is why no
   * accessor existed. The state belongs to this transpiler's `CodeGenerator`
   * now, so the one regression that asserts on it -- #985's recovered structs
   * must reach the snapshot, which requires the snapshot to be taken AFTER
   * recovery -- asks the instance that ran.
   */
  getExternalStructFields(): ReadonlyMap<string, ReadonlySet<string>> {
    // From the artifact, which is what `InitializationAnalyzer` reads
    // (`context.program.externalStructFields()`). This delegated to a
    // `TranspileState` method that wrapped the same call and had no production
    // caller left -- so #985's regression asserted on a route the analyzer does
    // not take, which is the #1418 shape with an integration test in front of
    // it.
    return this.program?.externalStructFields() ?? new Map();
  }

  /**
   * Check if C++ output was detected during transpilation.
   * This is set when C++ syntax is found in included headers (e.g., Arduino.h).
   */
  isCppMode(): boolean {
    return this.cppMode;
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
