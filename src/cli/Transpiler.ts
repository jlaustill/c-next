/**
 * Transpiler
 * Unified transpiler for both single-file and multi-file builds
 *
 * A single file transpilation is just a project with one .cnx file.
 *
 * Architecture: transpile() is the single entry point. 1.1 Discover
 * (`Discover.run`) emits the run's `SourceGraph`, then it delegates to
 * _executePipeline(). There is ONE pipeline for all transpilation.
 */

import type TRunTarget from "../cnx/types/TRunTarget";

import IFileSystem from "../cnx/types/IFileSystem";

import CodeGenWalker from "../cnx/TRANSPILE/CodeGenWalker";
import invariant from "../cnx/utils/invariant";
import AdrProvenance from "../cnx/instrumentation/AdrProvenance";
import ToolchainRequirements from "../cnx/instrumentation/ToolchainRequirements";
import CachedSymbolReader from "./cache/CachedSymbolReader";
import PublicInterface from "../cnx/TRANSPILE/2-Plan/PublicInterface";
import HeaderGenerator from "../cnx/TRANSPILE/3-Render/headers/HeaderGenerator";
import HeaderRenderer from "../cnx/TRANSPILE/3-Render/headers/HeaderRenderer";
import IHeaderEmissionFacts from "../cnx/TRANSPILE/3-Render/headers/types/IHeaderEmissionFacts";
import SymbolTable from "../cnx/PARSE/3-Declare/SymbolTable";
import ESourceLanguage from "../cnx/utils/types/ESourceLanguage";
import SymbolRegistry from "../cnx/PARSE/3-Declare/SymbolRegistry";
import type IProgram from "../cnx/types/IProgram";
import type IAnalyzedFile from "../cnx/types/IAnalyzedFile";

import IDiscoveredFile from "../cnx/PARSE/1-Discover/types/IDiscoveredFile";
import EHeaderLanguage from "../cnx/PARSE/1-Discover/types/EHeaderLanguage";
import type IHeaderSource from "../cnx/PARSE/1-Discover/types/IHeaderSource";
import OutputExtensions from "../cnx/utils/OutputExtensions";
import type IOutputExtensions from "../cnx/types/IOutputExtensions";

import ErrorLocation from "../cnx/utils/ErrorLocation";
import ITranspilerConfig from "../cnx/types/ITranspilerConfig";
import ITranspilerResult from "./types/ITranspilerResult";
import IFileResult from "../cnx/types/IFileResult";
import type IRunAnchor from "../cnx/PARSE/1-Discover/types/IRunAnchor";
import IPipelineFile from "../cnx/PARSE/1-Discover/types/IPipelineFile";
import type ISourceGraph from "../cnx/PARSE/1-Discover/types/ISourceGraph";
import HeaderMacros from "../cnx/PARSE/4-Resolve/HeaderMacros";
import type THeaderMacro from "../cnx/types/THeaderMacro";
import type IOutputPaths from "../cnx/PARSE/1-Discover/types/IOutputPaths";
import type IFileIncludes from "../cnx/PARSE/1-Discover/types/IFileIncludes";
import Discover from "../cnx/PARSE/1-Discover/Discover";
import RunAnchor from "../cnx/PARSE/1-Discover/RunAnchor";
import TTranspileInput from "../cnx/types/TTranspileInput";
import ITranspileError from "../cnx/types/ITranspileError";
import DeclarationSite from "../cnx/utils/DeclarationSite";
import TreePasses from "../cnx/TRANSPILE/1-Analyze/TreePasses";
import type IDeclaredSource from "../cnx/PARSE/3-Declare/types/IDeclaredSource";
import type IDeclaredSources from "../cnx/PARSE/3-Declare/types/IDeclaredSources";
import type TDiscoveryFacts from "../cnx/PARSE/1-Discover/types/TDiscoveryFacts";
import Parse from "../cnx/PARSE/2-Parse/Parse";
import Declare from "../cnx/PARSE/3-Declare/Declare";
import Analyze from "../cnx/TRANSPILE/1-Analyze/Analyze";
import Resolve from "../cnx/PARSE/4-Resolve/Resolve";
import type IResolvedProgram from "../cnx/PARSE/4-Resolve/types/IResolvedProgram";
import type IAnalyzerOptions from "../cnx/TRANSPILE/1-Analyze/types/IAnalyzerOptions";
import type TFrontEndResult from "./types/TFrontEndResult";
import type IDiagnostics from "../cnx/types/IDiagnostics";
import type ICodeGenSymbols from "../cnx/types/ICodeGenSymbols";
import CacheManager from "./cache/CacheManager";
import PreprocessCache from "../cnx/PARSE/1-Discover/preprocessor/PreprocessCache";
import type IRecordedRequirement from "../cnx/types/IRecordedRequirement";
import type IRenderedFile from "./types/IRenderedFile";
import RequirementAggregator from "../cnx/utils/RequirementAggregator";
import Write from "../cnx/WRITE/1-Write/Write";
import CaughtError from "../cnx/utils/CaughtError";
import HeaderDeclarations from "../cnx/PARSE/3-Declare/HeaderDeclarations";
import ProgramChecks from "../cnx/PARSE/4-Resolve/ProgramChecks";
import IncludeGuards from "../cnx/TRANSPILE/3-Render/headers/IncludeGuards";
import HeaderEmissionCapture from "../cnx/TRANSPILE/3-Render/headers/HeaderEmissionCapture";

/** A header's cache entry, as `CacheManager` returns it. */
type TCachedHeader = NonNullable<ReturnType<CacheManager["getSymbols"]>>;

/** A cache entry's symbols, once validated. */
type TCachedSymbols = NonNullable<ReturnType<typeof CachedSymbolReader.read>>;

/**
 * The config with every default filled in, except `cppRequired`: unset is
 * not false (#1844). Unset, 1.1 detects the run's mode from its headers.
 */
type TRunConfig = Required<Omit<ITranspilerConfig, "cppRequired">> &
  Pick<ITranspilerConfig, "cppRequired">;

/**
 * #1817: one header, settled before any of its symbols is written: its cache
 * entry, or the source 1.1 settled for it (#1844). A header whose cache entry
 * threw is `failed`.
 */
type THeaderPreparation = {
  readonly file: IDiscoveredFile;
  readonly source: IHeaderSource;
} & (
  | {
      readonly kind: "cached";
      readonly entry: TCachedHeader;
      readonly symbols: TCachedSymbols;
    }
  | { readonly kind: "parse" }
  | { readonly kind: "failed"; readonly error: unknown }
);

/**
 * Unified transpiler
 */
class Transpiler {
  private readonly config: TRunConfig;
  private readonly codeGenerator: CodeGenWalker;
  private readonly warnings: string[];
  private readonly cacheManager: CacheManager | null;
  private readonly preprocessCache: PreprocessCache | null;
  /**
   * Issue #211, #1319, #1844: does this run emit C++? 1.1 Discover's answer
   * (`ISourceGraph.cppMode`), copied here when each run's graph is built so
   * `isCppMode()` still answers between runs (serve reports it after one).
   *
   * Settled once per run, before any file is parsed, and never changed
   * mid-run. It used to be a monotone latch raised by Stage 2 reading an
   * included header, which made it settled *mid-run* -- the cause of #250,
   * #941, #1139, #1425 and #1171. #1319 made it declared-only; #1428 ruled
   * that 1.1 detects it, which is early enough that nothing reads it before
   * it settles.
   *
   * #1428: `undefined` until this run's 1.1 has settled it. It used to start
   * as `cppRequired ?? false`, which answered "C" for a run that had not
   * decided anything yet. Passes do not read this copy: they read the mode
   * from `Program`, which carries the graph's.
   */
  private cppMode: boolean | undefined;

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
    invariant(
      this.cppMode !== undefined,
      "1.1 Discover settled the run's mode before an output file is named",
    );
    return OutputExtensions.forCppMode(this.cppMode);
  }

  /** #1688: each C-Next file's header macros, by the file's path */
  private readonly headerMacrosByFile = new Map<
    string,
    ReadonlyMap<string, THeaderMacro>
  >();

  /** #1688: the C-Next files whose C includes' macros were not all read */
  private readonly headerMacrosUnread = new Set<string>();

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
   * hold both. Cleared per run by `_initializeRun()`.
   */
  private readonly headerEmissionFactsByPath = new Map<
    string,
    IHeaderEmissionFacts
  >();
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
   * 1.3 Declare's header symbols, which 1.4 Resolve takes into `Program` and
   * completes with the C-Next ones. A pass after 1.4 reads the table through
   * `program.symbolTable()`, never this field (#1991).
   */
  private declaredSymbols = new SymbolTable();

  /**
   * What Stage 5 reads (#1932): each file's plain data, as 2.1's `Analyze`
   * returned it. The host never holds a parse tree -- every tree is a local of
   * 1.2's `SourceSyntax.of` and is gone when it returns (#1991).
   */
  private readonly analyzedFiles = new Map<string, IAnalyzedFile>();

  /**
   * Settles when this instance's previous run has (#1721). A run starts by
   * clearing the per-run fields above, so a second run must not start while
   * the first is parked on an `await` -- which `ServeCommand` otherwise does: it
   * holds one instance and dispatches each request without waiting for the
   * one before. Serialized here, once, rather than in each caller.
   */
  private previousRun: Promise<void> = Promise.resolve();

  /**
   * Issue #593: Centralized analyzer for cross-file const inference in C++ mode.
   * Accumulates parameter modifications and param lists across all processed files.
   */
  /**
   * The services of the run's anchor (#1719): the preprocessor the project's
   * compile database picks, and the `PathResolver` (Issue #586) its output
   * paths come from. 1.1 Discover decides the anchor and returns it beside the
   * `SourceGraph`; the next run hands it back, so a run anchored where the
   * last one was keeps its compile database and toolchain probe.
   *
   * #1444: the anchor's FACTS -- project root, directory, defines -- are read
   * from the run's `SourceGraph`, never from here. The constructor anchors at
   * `config.input` only to find the cache's project root.
   */
  private anchor: IRunAnchor;

  /** File system abstraction for testability */
  private readonly fs: IFileSystem;

  constructor(config: ITranspilerConfig, fs: IFileSystem) {
    // The port the host injected; the pipeline never defaults one (#1653)
    this.fs = fs;
    // Apply defaults
    this.config = {
      input: config.input,
      includeDirs: config.includeDirs ?? [],
      outDir: config.outDir ?? "",
      headerOutDir: config.headerOutDir ?? "",
      defines: config.defines ?? {},
      cppRequired: config.cppRequired,
      parseOnly: config.parseOnly ?? false,
      debugMode: config.debugMode ?? false,
      target: config.target ?? "",
      pioEnv: config.pioEnv ?? "",
      collectGrammarCoverage: config.collectGrammarCoverage ?? false,
      noCache: config.noCache ?? false,
    };

    this.codeGenerator = new CodeGenWalker();
    this.warnings = [];
    this.anchor = RunAnchor.at(this.config.input, null, this.config, this.fs);

    // Initialize cache manager if caching is enabled and a project root was
    // found. Instance-scoped, not anchored per run: a source run reads no
    // cache it did not already have, and writes none into a project it was
    // merely pointed at (#1719).
    this.cacheManager =
      !this.config.noCache && this.anchor.projectRoot
        ? new CacheManager(this.anchor.projectRoot, this.fs)
        : null;
    // #1844: and the preprocessor's runs, so a warm run starts none
    this.preprocessCache =
      !this.config.noCache && this.anchor.projectRoot
        ? new PreprocessCache(this.anchor.projectRoot, this.fs)
        : null;
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
   *
   * Runs on one instance execute one at a time, in call order (#1721): a call
   * made while another run is in progress starts when that run settles.
   */
  transpile(input: TTranspileInput): Promise<ITranspilerResult> {
    const run = this.previousRun.then(() => this._run(input));
    // Settled to `undefined` either way, so a failed run does not stall the
    // queue and the last result is not kept alive while the instance idles.
    this.previousRun = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  /** One run, which `transpile` has made the only one in progress. */
  private async _run(input: TTranspileInput): Promise<ITranspilerResult> {
    const result = this._initResult();

    try {
      this._initializeRun();

      // Stage 1: 1.1 Discover
      const discovered = await Discover.run(
        input,
        this.anchor,
        this.config,
        this.fs,
        this.warnings,
        this.preprocessCache,
      );
      this.anchor = discovered.anchor;
      this.cppMode = discovered.graph.cppMode;
      const pipelineInput = discovered.graph;
      if (discovered.errors.length > 0) {
        result.errors.push(...discovered.errors);
        result.success = false;
        return this._finalizeResult(result);
      }
      if (pipelineInput.cnextFiles.length === 0) {
        return this._finalizeResult(result, "No C-Next source files found");
      }

      if (input.kind === "files") {
        this._ensureOutputDirectories();
      }

      await this._executePipeline(pipelineInput, result);
      return this._finalizeResult(result);
    } catch (err) {
      return this._handleRunError(result, err);
    } finally {
      // #1301 review: release the run's per-file artifacts when the run ends,
      // not merely when the next one starts. `Transpiler` is not always
      // per-process -- `ServeCommand` holds ONE instance in a static field and
      // reuses it for every request -- so clearing only on entry would leave the
      // language server holding the last request's files for as long as the
      // editor sits idle. The parse trees need no clearing: since #1991 they are
      // locals of 1.2's `SourceSyntax.of` and never reach this class.
      //
      // Peak-RSS benchmarking cannot see this: it measures the in-run high water
      // mark, and post-run residency is a different number. Stage 6 does not need
      // them -- `_generateAllHeadersFromPipeline` reads `result.files[].headerCode`
      // -- so the run is genuinely done with them here.
      //
      // This is the ONLY clear site. `_initializeRun` used to clear on entry too,
      // but with this `finally` covering every exit -- success, `_handleRunError`,
      // and a throw -- that one could never observe a non-empty map, so deleting it
      // reddened nothing. Two sites for one invariant is the duplication CLAUDE.md
      // calls the worst anti-pattern, and the unreachable half is the #1143 shape.
      this.analyzedFiles.clear();
    }
  }

  // ===========================================================================
  // Unified Pipeline
  // ===========================================================================

  /**
   * The single unified pipeline for all transpilation.
   *
   * transpile() delegates here with the `SourceGraph` 1.1 Discover emitted.
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
    input: ISourceGraph,
    result: ITranspilerResult,
  ): Promise<void> {
    // Stage 2: Collect symbols from C/C++ headers and build analyzer context
    // Issue #945: Now async for preprocessing support
    this._collectAllHeaderSymbols(input, result);

    // Issue #985 recovery: when standalone header preprocessing missed framework
    // symbols, recover their declared names via translation-unit preprocessing.
    this._collectExternalDeclarations(input);

    // #1688: the macros each file's C includes define, typed (ADR-024)
    this._collectHeaderMacros(input);

    // Stages 3 to 4d: 1.2 Parse, 1.3 Declare, then (through `resolve`) 1.4
    // Resolve and the whole-program checks, then 2.1 Analyze -- EVERY file,
    // before ANY file is planned (#1320). Analysis used to run inside the loop
    // below, so file N was analyzed after files 1..N-1 had already been
    // emitted, and an analyzer reading state codegen fills saw the PREVIOUS
    // file's data (#1430).
    //
    // #1991: 1.2, 1.3, 1.4 and 2.1, each taking what the one before returned.
    // Every tree is a local of 1.2; what comes back is plain data.
    //
    // Parse-only mode analyzes nothing, exactly as before: `_transpileFile`
    // returned its parse-only result before reaching the analyzers, so running
    // them would be new work on a path that asked for none.
    const front = this._runParseThroughAnalyze(input, result);
    if (front.kind === "stopped") {
      if (front.errors.length > 0) {
        result.errors.push(...front.errors);
        result.success = false;
      }
      return;
    }
    // 2.1's artifact carries 1.4's program on to Stage 5 (#1991)
    this.program = front.program;
    for (const [path, analyzed] of front.files) {
      this.analyzedFiles.set(path, analyzed);
    }
    const diagnostics = front.diagnostics;

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
    Transpiler._reportWarnings(input.cnextFiles, diagnostics, result);
    const pendingWrites: { path: string; content: string }[] = [];
    for (const file of input.cnextFiles) {
      if (!Transpiler._producesOutput(file)) {
        continue;
      }

      const fileResult = rejected
        ? this._rejectedFileResult(file, diagnostics)
        : this._transpileFile(file, front.discovery);
      this._recordFileResult(
        file.discoveredFile,
        front.discovery,
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

    // One gate for both halves of the output: a .c is written only when its
    // header is (#1233)
    if (result.success && input.writeOutputToDisk) {
      for (const write of pendingWrites) {
        Write.file(this.fs, write.path, write.content);
      }
      // Stage 6: Write the Stage 5.5 headers (only to disk in files mode)
      this._generateAllHeadersFromPipeline(
        front.discovery,
        input.cnextFiles,
        result,
        renderedFiles,
      );
    }
  }

  /**
   * Stages 3 to 4d, one pass at a time (#1991): 1.2 `Parse`, 1.3 `Declare`,
   * 1.4 Resolve with the whole-program checks, then 2.1 `Analyze`.
   */
  private _runParseThroughAnalyze(
    input: ISourceGraph,
    result: ITranspilerResult,
  ): TFrontEndResult {
    const parsed = Parse.sources(input);
    // A file that failed to parse is not declared; the others still are, so
    // one run reports both kinds of error, as it did before #1991.
    const declared = Declare.sources(parsed, this.symbolRegistry);
    const errors = [...parsed.errors, ...declared.errors];
    if (errors.length > 0) {
      return { kind: "stopped", errors };
    }
    const resolved = this._passesProgramChecks(declared, result);
    if (resolved === null) {
      return { kind: "stopped", errors: [] };
    }
    return {
      kind: "analyzed",
      ...Analyze.run(
        resolved.program,
        resolved.sources,
        resolved.discovery,
        this.config.parseOnly
          ? null
          : (file, program, discovery) =>
              this._analysisInputs(file, program, discovery),
      ),
    };
  }

  /**
   * Stages 3 to 4c: the whole-program checks every file waits on. Each records
   * its own errors; the first to fail ends the run, in this order.
   */
  private _passesProgramChecks(
    declared: IDeclaredSources,
    result: ITranspilerResult,
  ): IResolvedProgram | null {
    // Stage 3: 1.4 Resolve once over every file 1.3 `Declare` declared
    const resolved = this._resolveProgram(declared, result);
    if (resolved === null) {
      return null;
    }
    const { program } = resolved;
    const passes =
      // Stage 3b: the program's one target (ADR-049), settled by 1.4. Nothing
      // below may run for a program whose target is unknown or contested.
      this._checkRunTarget(program, resolved.sources, result) &&
      // Stage 4: symbol conflicts
      Transpiler._recordChecked(result, ProgramChecks.conflicts(program)) &&
      // Stage 4b: include guard collisions (ADR-063, issue #1133)
      this._checkIncludeGuardCollisions(resolved, result) &&
      // Stage 4c: external identifier significance (MISRA 5.1, issue #1307)
      this._checkExternalIdentifierSignificance(program, result);
    return passes ? resolved : null;
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
   * `HeaderEmissionCapture.capture` is only reached from inside the same try
   * block that produced that failure.
   */
  private _renderHeaders(
    result: ITranspilerResult,
  ): ReadonlyMap<string, IRenderedFile> {
    invariant(
      this.program,
      "1.4 Resolve built Program before any header is rendered",
    );
    const rendered = HeaderRenderer.render(
      this.headerEmissionFactsByPath,
      new HeaderGenerator(this.program),
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
      const parsed = ErrorLocation.parse(errorMessage);
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
   * Stage 3: 1.4 Resolve over every declared C-Next file, then publish each
   * file's resolved symbols.
   * @returns 1.4's artifact, or null if errors occurred
   */
  private _resolveProgram(
    declared: IDeclaredSources,
    result: ITranspilerResult,
  ): IResolvedProgram | null {
    // 1.4 Resolve. The whole program exists only now that every file has been
    // declared, which is the entire reason the two loops are separate: a file's
    // bare type reference may name a scope type declared in a file that had not
    // been read when the first loop reached it, and no ordering fixes that.
    //
    // Building `Program` settles every deferred type, so nothing below this
    // line can observe an unsettled one.
    try {
      // The symbol table holds only C/C++ header symbols at this point --
      // `Program.build` adds this run's C-Next symbols to it -- so this IS
      // the external set, which is what the fact is about.
      //
      // It is also read AFTER `_collectExternalDeclarations`, and that ordering
      // is load-bearing rather than incidental: a struct that becomes known only
      // through #985 recovery has its fields added to the symbol table there, and
      // reading the set any earlier would drop it from `externalStructFields` --
      // silently exempting it from ADR-016 init-completeness checking, which is
      // the one consumer of the fact.
      const resolved = Resolve.program(declared, {
        headerStructFields: this.declaredSymbols.getAllStructFields(),
        // #1511: everything the C/C++ headers contributed. The opacity inputs
        // are the RAW bookkeeping, not the verdict -- `Program` resolves which
        // typedefs never received a body. Read here because #985 phantom-body
        // recovery has already run (Stage 2), so the state is final.
        foreign: {
          c: this.declaredSymbols.getAllCSymbols(),
          cpp: this.declaredSymbols.getAllCppSymbols(),
          opaqueTypedefs: new Set(this.declaredSymbols.getAllOpaqueTypes()),
          typedefToTag: new Map(this.declaredSymbols.getAllTypedefToTag()),
          structTagsWithBodies: new Set(
            this.declaredSymbols.getAllStructTagsWithBodies(),
          ),
          // #1688: each file's own, from its C includes' macro dump
          macros: this.headerMacrosByFile,
          macrosUnread: this.headerMacrosUnread,
        },
        // #1825: ADR-006's and ADR-029's derivations look callees and
        // typedefs up in it. 1.4 completes it with every file's resolved
        // symbols and hands it on as `program.symbolTable()` (#1991).
        symbolTable: this.declaredSymbols,
        registry: this.symbolRegistry,
        target: {
          option: this.config.target,
          pioEnv: this.config.pioEnv || undefined,
        },
      });
      // Passes after 1.4 read cross-file facts from the artifact rather than
      // re-deriving them. Set once per run, not per file.
      this.codeGenerator.transpileState.program = resolved.program;
      return result.success ? resolved : null;
    } catch (err) {
      result.errors.push(CaughtError.asTranspileError(err));
      result.success = false;
      return null;
    }
  }

  /**
   * One file's 2.1 inputs, which `Analyze` hands its analyzers.
   *
   * Stage 4d, over the WHOLE program (#1320): every file is analyzed before
   * Stage 5 plans any of them. That order is the pass boundary
   * `docs/architecture/README.md` specifies -- "After **1.4**, nothing may
   * compute a cross-file fact. A pass that needs one reads it from `Program`,
   * which is complete before 2.1 begins."
   *
   * The per-file `CodeGenState` an analyzer reads is established here, the same
   * way and from the same source as before the hoist -- `symbols` is a view of
   * `Program`, which 1.4 completed, so it does not depend on any file having
   * been emitted.
   */
  private _analysisInputs(
    file: IPipelineFile,
    program: IProgram,
    discovery: TDiscoveryFacts,
  ): IAnalyzerOptions {
    const sourcePath = file.path;

    // #1241: attribute ADR provenance to the file being analyzed. Analysis runs
    // before the generator exists, so a rule firing in `runAnalyzers` would
    // otherwise be credited to whichever file was begun last -- or dropped on
    // the first, which reads identically to "this rule never fires".
    AdrProvenance.beginFile(sourcePath);

    const symbols = this._establishPerFileCodeGenState(sourcePath, program);
    const includes = Transpiler._includesOf(discovery, sourcePath);

    // #1322: the ADR-010 include facts are handed in rather than read off
    // CodeGenState, whose `sourcePath` is not written until `generate()` and
    // so holds another file's value here.
    // #1452: asserted, not defaulted. Stage 3 builds `Program` and returns
    // false on failure before this runs, so a null here is a broken stage
    // order -- and a default would only move the failure: ADR-010's rules
    // read discovery's per-directive answers through `Program` (#1672), and
    // an empty set of answers is not "this file includes nothing". Same
    // reasoning as the conflict check.
    return {
      // #1456: handed over rather than reached for. Nineteen analyzer sites
      // used to read these off `CodeGenState` themselves, for facts this
      // caller is already holding.
      context: {
        symbols,
        program,
        symbolTable: program.symbolTable(),
        reachesForeignHeader: file.reachesForeignHeader,
        sourceFile: sourcePath,
      },
      includes: {
        resolutions: includes.resolutions,
        cnextAlternatives: includes.cnextAlternatives,
        kinds: includes.kinds,
      },
    };
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
    const errors = diagnostics
      .forFile(sourcePath)
      .filter((e) => e.severity === "error");
    const declarationCount =
      this.analyzedFiles.get(sourcePath)?.declarationCount ?? 0;

    return errors.length > 0
      ? this.buildErrorResult(sourcePath, [...errors], declarationCount)
      : this.buildParseOnlyResult(sourcePath, declarationCount);
  }

  /**
   * 2.1's warnings (E0896), printed as `Warning: file:line:col warning[CODE]:`
   * whether or not the run compiles, with the advice under each.
   */
  private static _reportWarnings(
    files: readonly IPipelineFile[],
    diagnostics: IDiagnostics,
    result: ITranspilerResult,
  ): void {
    for (const file of files) {
      for (const e of diagnostics.forFile(file.path)) {
        if (e.severity !== "warning") continue;
        const help = e.helpText ? `\n       help: ${e.helpText}` : "";
        result.warnings.push(
          `${DeclarationSite.displayPath(file.path)}:${e.line}:${e.column} ${e.message}${help}`,
        );
      }
    }
  }

  /** Stage 5's input for this file, from 2.1's `Analyze` (#1991) */
  private _requireAnalyzedFile(sourcePath: string): IAnalyzedFile {
    const analyzed = this.analyzedFiles.get(sourcePath);
    invariant(
      analyzed,
      `every file that reaches code generation was analyzed and its plain data kept, ${sourcePath} included`,
    );
    return analyzed;
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
  private _requireSymbolInfo(
    sourcePath: string,
    program: IProgram,
  ): ICodeGenSymbols {
    const symbolInfo = program.codeGenSymbolsFor(sourcePath);
    invariant(
      symbolInfo,
      `1.4 Resolve built every file's visible symbol view before stage 5 read one, ${sourcePath}'s included`,
    );
    return symbolInfo;
  }

  /**
   * The per-file symbol view, required present.
   *
   * This used to PUBLISH the view onto the state as well, and that write is now
   * dead in both directions. `_analysisInputs`'s readers are the analyzers, which
   * take `IAnalysisContext.symbols` since #1456 and are barred from the state by
   * `2-1-analyze-reads-no-later-pass`. `_transpileFile`'s next state access
   * is `generate()`, whose `reset()` sets `symbols = null` before the walker
   * assigns `options.symbolInfo` -- so the value written here was overwritten
   * before anything could read it. Verified by removing the write: 7435 unit
   * tests and 1263 fixtures stay green.
   *
   * It set `currentFileReachesForeignHeader` too, and that went the same way for
   * the same reason: #1456 moved its one reader onto `IAnalysisContext`, which
   * `_analysisInputs` fills from the same expression, and `reset()` restored the
   * declining default over it at the top of `generate()`.
   *
   * What is left is the requirement itself, which is why the method stays: both
   * callers need the view to exist, and `_requireSymbolInfo` throws rather than
   * returning a nullable that every caller would then guard.
   */
  private _establishPerFileCodeGenState(
    sourcePath: string,
    program: IProgram,
  ): ICodeGenSymbols {
    return this._requireSymbolInfo(sourcePath, program);
  }

  /**
   * Stage 5: Plan and Render a single C-Next file.
   *
   * Assumes the symbol table is already populated (stages 2-3 complete) and
   * that 2.1 Analyze has already accepted the whole program -- #1320 moved
   * analysis to Stage 4d, so by here the question "is this program legal?" has
   * been answered for EVERY file, not just the ones walked so far.
   */
  private _transpileFile(
    file: IPipelineFile,
    discovery: TDiscoveryFacts,
  ): IFileResult {
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
      const analyzed = this._requireAnalyzedFile(sourcePath);
      const { declarationCount } = analyzed;

      // Parse only mode
      if (this.config.parseOnly) {
        return this.buildParseOnlyResult(sourcePath, declarationCount);
      }

      // #1320: 2.1 Analyze already ran, whole-program, in Stage 4d. What is left
      // here is 2.2 Plan and 2.3 Render. The per-file state codegen reads is
      // still established per file -- it is `generate()`'s input, not analysis's.
      const symbolInfo = this._establishPerFileCodeGenState(
        sourcePath,
        program,
      );

      // Generate code
      const code = this.codeGenerator.generate(analyzed.program, {
        debugMode: this.config.debugMode,
        targetDescription: this._runTarget().description,
        sourcePath,
        symbolInfo,
        sourceRelativePath: Transpiler._outputsOf(discovery, sourcePath)
          .sourceRelativePath,
        cnxIncludeRewrites: Transpiler._includesOf(discovery, sourcePath)
          .cnxIncludeRewrites,
        includeKinds: Transpiler._includesOf(discovery, sourcePath).kinds,
        // #1515: decided here, from the rule's owner. 1.3 Declare used to
        // answer this, which put an emission decision in the parse layer.
        hasPublicInterface: PublicInterface.existsIn(
          program.symbolTable().getTSymbolsByFile(sourcePath),
        ),
      });

      // #1323: resolve this file's header-render input while its state is
      // warm (reads from state populated above), but do not render it here.
      // HeaderRenderer renders every file's header in one step, after
      // this per-file loop finishes -- headerCode is filled in there.
      const headerFacts = HeaderEmissionCapture.capture({
        sourcePath,
        program,
        typeInput: symbolInfo,
        state: this.codeGenerator.transpileState,
        unmodifiedParams: this.codeGenerator.getFunctionUnmodifiedParams(),
        anchor: discovery.anchor,
        headerExtension: this.outputExtensions.header,
        includes: discovery.includes,
        ownIncludes: Transpiler._includesOf(discovery, sourcePath),
      });
      if (headerFacts) {
        this.headerEmissionFactsByPath.set(sourcePath, headerFacts);
      }

      // Issue #1143: the file's one requirement list, a view of the emission
      // plan, which decides every key (#1928, #1997). EmissionPlan.build froze
      // that plan inside generate(), so which line reads it here no longer
      // matters: the boundary is the plan build. A form emitted after it would
      // lose its cost from the banner and from this result alike, so
      // TranspileState's note* methods refuse such a write instead.
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
    return Analyze.producesOutput(file);
  }

  private _initializeRun(): void {
    // #1428: the previous run's mode is not this run's answer
    this.cppMode = undefined;
    if (this.cacheManager) {
      this.cacheManager.initialize();
    }
    // Issue #587: Reset accumulated state for new run
    // #1662: both are run-scoped and both were initialized ONCE, in the
    // constructor, so neither was ever cleared. `warnings` is pushed to per run
    // and copied onto every result, which made three runs of one source on one
    // transpiler report 1, then 2, then 3 copies of the same missing-header
    // warning (#1844: the #985 latch that also stuck is now each run's graph).
    // `ServeCommand`
    // holds a static transpiler, so "later run" is the normal case there.
    //
    // `warnings` is `readonly`, so it is emptied rather than replaced -- the
    // result copies it with a spread, so nothing holds the array itself.
    this.warnings.length = 0;
    this.headerMacrosByFile.clear();
    this.headerMacrosUnread.clear();
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
    this.declaredSymbols = new SymbolTable();
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
    // `generate()`'s own `reset()` -- `takeDeferredSites()` from inside
    // `generate()`, whose sites the plan carries to `buildBanner` and to
    // `_transpileFile` immediately after it -- so a run that plans no
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
    if (this.config.outDir) {
      Write.directory(this.fs, this.config.outDir);
    }
    if (this.config.headerOutDir) {
      Write.directory(this.fs, this.config.headerOutDir);
    }
  }

  /**
   * Stage 2: Collect symbols from all C/C++ headers
   *
   * #1817: in two steps. `_prepareHeaders` settles every header's cache entry
   * first and writes nothing. Symbols are then written here, in header order,
   * because what the symbol table holds depends on it. #1844: each header's
   * text and language are 1.1's; preprocessing them moved there.
   */
  private _collectAllHeaderSymbols(
    input: ISourceGraph,
    result: ITranspilerResult,
  ): void {
    const prepared = this._prepareHeaders(input);
    for (const header of prepared) {
      try {
        this._collectHeaderSymbols(header);
        result.filesProcessed++;
      } catch (err) {
        // Issue #1319: this catch exists to tolerate third-party headers that
        // will not parse -- a real need, and why it is broad. A C-Next
        // diagnostic is not that: it is a rejection this transpiler made on
        // purpose. Swallowing one turned E0507 into `Warning: ...` followed by
        // `Compiled 1 files` and exit 0, which is the silent-failure shape the
        // diagnostic exists to remove. Diagnostics propagate; parse failures
        // still degrade.
        if (CaughtError.isDiagnostic(err)) {
          throw err;
        }
        this.warnings.push(
          `Failed to process header ${header.file.path}: ${err}`,
        );
      }
    }
  }

  /**
   * #1817: every header's cache entry, read before any symbol is written, so
   * the cache decision cannot depend on the symbols of the headers before it.
   */
  private _prepareHeaders(input: ISourceGraph): THeaderPreparation[] {
    return input.headerFiles.map((file) => {
      const source = input.headerSources.get(file.path);
      invariant(
        source !== undefined,
        `1.1 settles the source of every header it resolves (missing ${file.path})`,
      );
      try {
        const cached = this._readCachedHeader(file);
        return cached
          ? { file, source, kind: "cached", ...cached }
          : { file, source, kind: "parse" };
      } catch (error) {
        // Re-thrown by `_collectHeaderSymbols` in header order, where the
        // #1319 catch decides whether it is a diagnostic.
        return { file, source, kind: "failed", error };
      }
    });
  }

  /**
   * Issue #985 recovery: the NAMES of framework functions / function-like
   * macros that standalone header preprocessing missed, from each .cnx's C
   * includes preprocessed as a translation unit (predecessors first -- the way
   * the real compiler does). #1844: 1.1 preprocessed it, when a header could
   * not be preprocessed alone, so a clean project pays nothing.
   */
  private _collectExternalDeclarations(input: ISourceGraph): void {
    const recovered = input.recoveredDeclarations;
    if (recovered === null) return;

    const cleanState = TreePasses.recoverDeclarations(
      recovered.slices,
      this.declaredSymbols,
    );
    HeaderDeclarations.clearPhantomStructBodies(
      cleanState,
      this.declaredSymbols,
    );

    // Function-like macros have no declaration to parse; register their names for
    // the undeclared-call check only (a by-value macro invocation is correct).
    if (recovered.macroNames.size > 0) {
      this.declaredSymbols.addExternalDeclarationNames(recovered.macroNames);
    }
  }

  /**
   * #1688: each file's header macros, from the macro dump 1.1 took of that
   * file's own C includes (#1991). Unread is not "no macros": a name the file
   * uses may be one (#1688 review).
   */
  private _collectHeaderMacros(input: ISourceGraph): void {
    for (const [path, read] of input.headerMacroDumps) {
      if (!read.complete) this.headerMacrosUnread.add(path);
      if (read.dump !== null) {
        this.headerMacrosByFile.set(path, HeaderMacros.collect(read.dump));
      }
    }
  }

  /**
   * Stage 4b: Reject two source files that would produce the same include
   * guard (ADR-063, #1133). The check is `IncludeGuards`'.
   *
   * @returns true when every guard is unique
   */
  private _checkIncludeGuardCollisions(
    resolved: IResolvedProgram,
    result: ITranspilerResult,
  ): boolean {
    return Transpiler._recordChecked(
      result,
      IncludeGuards.collisions(
        resolved.discovery.anchor,
        resolved.sources.map((source) => source.file.path),
      ),
    );
  }

  /**
   * Record a whole-program check's errors on the result.
   *
   * @returns true when the check found nothing
   */
  private static _recordChecked(
    result: ITranspilerResult,
    errors: readonly ITranspileError[],
  ): boolean {
    for (const error of errors) {
      result.errors.push(error);
      result.success = false;
    }
    return result.success;
  }

  /**
   * Stage 3b: report the run's target, or why it has none (ADR-049). The
   * check is `ProgramChecks.runTarget`.
   *
   * @returns true when the run may continue
   */
  private _checkRunTarget(
    program: IProgram,
    sources: readonly IDeclaredSource[],
    result: ITranspilerResult,
  ): boolean {
    const checked = ProgramChecks.runTarget(
      program,
      this.config.parseOnly === true,
      sources.at(-1)?.file.path,
    );
    if (checked.target !== null) {
      result.target = checked.target;
    }
    const recorded = Transpiler._recordChecked(result, checked.errors);
    if (checked.proceed) {
      return recorded;
    }
    result.success = false;
    return false;
  }

  /** The run's target; valid once Stage 3b has passed */
  private _runTarget(): Extract<TRunTarget, { kind: "resolved" }> {
    const target = this.program?.target();
    invariant(
      target?.kind === "resolved",
      "Stage 3b halts a run whose target did not resolve",
    );
    return target;
  }

  /**
   * Stage 4c: Reject external identifiers that are not distinct within the
   * target's significant-character limit (MISRA C:2012 Rule 5.1, issue #1307).
   * The check is `ProgramChecks.externalIdentifiers`.
   *
   * @returns true when every external identifier is distinct within the budget
   */
  private _checkExternalIdentifierSignificance(
    program: IProgram,
    result: ITranspilerResult,
  ): boolean {
    const target = program.target();
    // ADR-049: a parse-only run needs no target, and without one there is no
    // budget to check against. Every other run reaches here with one (3b).
    if (this.config.parseOnly && target.kind !== "resolved") {
      return true;
    }
    invariant(
      target.kind === "resolved",
      "Stage 3b halts a run whose target did not resolve",
    );
    return Transpiler._recordChecked(
      result,
      ProgramChecks.externalIdentifiers(
        program.symbolTable(),
        target.description,
      ),
    );
  }

  /**
   * Record file result and optionally write output to disk
   */
  private _recordFileResult(
    file: IDiscoveredFile,
    discovery: TDiscoveryFacts,
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
      outputPath = Transpiler._outputsOf(discovery, file.path).source;
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
   * is who fills that field in: `HeaderEmissionCapture.capture` resolves each
   * file's header content, at its own warm moment, into a frozen record;
   * `_renderHeaders` (Stage 5.5) turns every record into text in one batch,
   * reading no CodeGenState at all. Reintroducing #1139 today would mean
   * making this stage call `CodeGenState`-reading logic directly again,
   * instead of reading the already-rendered `headerCode` — there is no
   * "second call" left to make by accident, only a wrong one to add back.
   */
  private _generateAllHeadersFromPipeline(
    discovery: TDiscoveryFacts,
    cnextFiles: readonly IPipelineFile[],
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
        const headerPath = Transpiler._outputsOf(discovery, file.path).header;
        Write.file(this.fs, headerPath, headerContent);
        result.outputFiles.push(headerPath);
      }
    }
  }

  /**
   * Finalize result: merge warnings, flush cache
   */
  private _finalizeResult(
    result: ITranspilerResult,
    warning?: string,
  ): ITranspilerResult {
    if (warning) {
      result.warnings.push(warning);
    }
    result.symbolsCollected = this.declaredSymbols.size;
    result.warnings = [...result.warnings, ...this.warnings];
    // Issue #1143: union of what each file's emitters recorded.
    result.requirements = RequirementAggregator.merge(result.files);
    // Issue #1241: every position at which an ADR's rule fired this run.
    result.adrSites = AdrProvenance.collect();

    if (this.cacheManager) {
      this.cacheManager.flush();
    }
    this.preprocessCache?.flush((path, content) =>
      Write.file(this.fs, path, content),
    );
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
      message: `Pipeline failed: ${CaughtError.messageOf(err)}`,
      severity: "error",
    });
    result.success = false;
    result.warnings = [...result.warnings, ...this.warnings];
    return result;
  }

  // ===========================================================================
  // Header Symbol Collection
  // ===========================================================================

  /**
   * Stage 2: Collect symbols from a single prepared C/C++ header, in header order
   * Issue #592: Recursive include processing moved to IncludeResolver.resolveHeadersTransitively()
   * Issue #945: Added preprocessing support for conditional compilation
   * #1817: synchronous. Its content was settled by `_prepareHeaders`; this is
   * every write the header makes, which is why the order is kept here.
   */
  private _collectHeaderSymbols(header: THeaderPreparation): void {
    const file = header.file;

    if (header.kind === "failed") {
      throw header.error;
    }
    if (header.kind === "cached") {
      this._restoreCachedHeader(header.entry, header.symbols);
      return; // Cache hit - skip full parsing
    }
    this.parseHeaderFile(file, header.source);

    // Debug: Show symbols found
    if (this.config.debugMode) {
      const symbols = this.declaredSymbols.getSymbolsByFile(file.path);
      console.log(`[DEBUG]   Found ${symbols.length} symbols in ${file.path}`);
    }

    // Issue #590: Cache the results using simplified API
    if (this.cacheManager) {
      this.cacheManager.setSymbolsFromTable(file.path, this.declaredSymbols);
    }
  }

  /**
   * A header's cache entry, read and validated but not restored, or null on a
   * miss. #1817: split from the restore, so the cache decision is made before
   * any symbol is written.
   */
  private _readCachedHeader(
    file: IDiscoveredFile,
  ): { entry: TCachedHeader; symbols: TCachedSymbols } | null {
    if (!this.cacheManager?.isValid(file.path)) {
      return null;
    }

    const entry = this.cacheManager.getSymbols(file.path);
    if (!entry) {
      return null;
    }

    // Issue #1225: a cache entry that does not validate is a miss, not a
    // degraded hit. Returning null re-parses the header instead of continuing
    // with symbols we could not verify. Every symbol is validated here, before
    // any is added, so a rejected entry cannot leave half its symbols behind.
    const symbols = CachedSymbolReader.read(entry.symbols);
    return symbols === null ? null : { entry, symbols };
  }

  /**
   * Issue #1225: revive a validated cache entry into the symbol table.
   *
   * This used to rebuild each symbol field by field from a flat
   * `ISerializedSymbol` -- the legacy model ADR-055 Phase 7 removed everywhere
   * else -- behind an `as TCSymbol` cast the union could not check. That cast
   * is what let #1214's dropped `isConst` compile, and the same shape dropped
   * `pointerTypedefs` here. The symbols now come back as themselves, so there
   * is nothing to convert and nothing to forget.
   */
  private _restoreCachedHeader(
    cached: TCachedHeader,
    symbols: TCachedSymbols,
  ): void {
    for (const symbol of symbols) {
      if (symbol.sourceLanguage === ESourceLanguage.C) {
        this.declaredSymbols.addCSymbol(symbol);
      } else {
        this.declaredSymbols.addCppSymbol(symbol);
      }
    }

    this.declaredSymbols.restoreStructFields(cached.structFields);
    this.declaredSymbols.restoreNeedsStructKeyword(cached.needsStructKeyword);
    this.declaredSymbols.restoreEnumBitWidths(cached.enumBitWidth);

    // Issue #1225: the whole struct state at once. It used to be four separate
    // restore calls, which is how #1164's pointerTypedefs was missed.
    this.declaredSymbols.restoreStructState(cached.structState);
  }

  /** How a debug log names `language` */
  private static _languageName(language: EHeaderLanguage): string {
    switch (language) {
      case EHeaderLanguage.C:
        return "C";
      case EHeaderLanguage.Cpp:
        return "C++";
      case EHeaderLanguage.Assembler:
        return "assembler";
    }
  }

  /**
   * Parse a header with the parser of the language 1.1 judged it to be
   * (#1844). SonarCloud S3776: Extracted from the Stage 2 per-header method,
   * now `_collectHeaderSymbols` (#1817).
   */
  private parseHeaderFile(file: IDiscoveredFile, source: IHeaderSource): void {
    if (this.config.debugMode) {
      console.log(
        `[DEBUG]   Parsing ${Transpiler._languageName(source.language)} header: ${file.path}`,
      );
    }
    TreePasses.declareHeader(file.path, source, this.declaredSymbols);
  }

  // ===========================================================================
  // Code Generation Helpers
  // ===========================================================================

  /** What 1.1 Discover learned about one file's includes (#1444). */
  private static _includesOf(
    discovery: TDiscoveryFacts,
    sourcePath: string,
  ): IFileIncludes {
    const includes = discovery.includes.get(sourcePath);
    invariant(
      includes !== undefined,
      `1.1 Discover records the includes of every file it discovers (missing ${sourcePath})`,
    );
    return includes;
  }

  /** Where 1.1 Discover named one file's output (#1991) */
  private static _outputsOf(
    discovery: TDiscoveryFacts,
    sourcePath: string,
  ): IOutputPaths {
    const outputs = discovery.outputs.get(sourcePath);
    invariant(
      outputs !== undefined,
      `1.1 Discover names the output of every file it discovers (missing ${sourcePath})`,
    );
    return outputs;
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
    // #1320: formatted by `CaughtError.asTranspileError`, not re-spelled here. How a thrown
    // error becomes a diagnostic is ONE decision; it used to be written out in
    // both places, so changing the wording meant editing two.
    return {
      sourcePath,
      code: "",
      success: false,
      errors: [CaughtError.asTranspileError(err)],
      declarationCount: 0,
    };
  }

  // ===========================================================================
  // Public Accessors
  // ===========================================================================

  /**
   * The external-struct snapshot `InitializationAnalyzer` consults, for
   * inspection after a run.
   *
   * #1452 box 4: this was reachable as a mutable static, which is why no
   * accessor existed. The state belongs to this transpiler's `CodeGenerator`
   * now, so the one regression that asserts on it -- #985's recovered structs
   * must reach the snapshot, which requires the snapshot to be taken AFTER
   * recovery -- asks the instance that ran.
   * @public read by externalSymbolRecovery.integration.test.ts, which asserts what recovery restored
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
   * Whether the last run emits C++, as its 1.1 Discover settled it (#1844).
   * `undefined` when that run stopped before 1.1 settled a mode (#1428).
   */
  isCppMode(): boolean | undefined {
    return this.cppMode;
  }
}

export default Transpiler;
