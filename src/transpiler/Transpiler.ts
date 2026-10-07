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

import type TRunTarget from "../types/TRunTarget";
import { basename, resolve, relative, sep } from "node:path";
import { availableParallelism } from "node:os";
import type IConflict from "../types/IConflict";

import IFileSystem from "../types/IFileSystem";

import * as Parser from "../PARSE/2-Parse/grammar/CNextParser";
import CNextSourceParser from "../PARSE/2-Parse/CNextSourceParser";
import HeaderParser from "../PARSE/2-Parse/HeaderParser";

import CodeGenWalker from "../TRANSPILE/CodeGenWalker";
import invariant from "../utils/invariant";
import CodedErrorText from "../utils/CodedErrorText";
import AutoConstRule from "../utils/AutoConstRule";
import AdrProvenance from "../instrumentation/AdrProvenance";
import ToolchainRequirements from "../instrumentation/ToolchainRequirements";
import CachedSymbolReader from "../utils/cache/CachedSymbolReader";
import PublicInterface from "../TRANSPILE/2-Plan/PublicInterface";
import HeaderGenerator from "../TRANSPILE/3-Render/headers/HeaderGenerator";
import HeaderRenderer from "../TRANSPILE/3-Render/headers/HeaderRenderer";
import HeaderTypeNames from "../TRANSPILE/2-Plan/HeaderTypeNames";
import HeaderIncludes from "../TRANSPILE/2-Plan/HeaderIncludes";
import QualifiedCName from "../utils/QualifiedCName";
import ExternalTypeHeaderBuilder from "../TRANSPILE/3-Render/headers/ExternalTypeHeaderBuilder";
import HeaderGeneratorUtils from "../TRANSPILE/3-Render/headers/HeaderGeneratorUtils";
import IHeaderEmissionFacts from "../TRANSPILE/3-Render/headers/types/IHeaderEmissionFacts";
import IHeaderCallbackType from "../types/IHeaderCallbackType";
import IncludeDirectiveText from "../utils/IncludeDirectiveText";
import SymbolTable from "../PARSE/3-Declare/SymbolTable";
import type TranspileState from "../TRANSPILE/TranspileState";
import ESourceLanguage from "../utils/types/ESourceLanguage";
import CNextResolver from "../PARSE/3-Declare/cnext/index";
import SymbolRegistry from "../PARSE/3-Declare/SymbolRegistry";
import Program from "../PARSE/4-Resolve/Program";
import type IProgram from "../types/IProgram";
import type IFileSymbols from "../types/IFileSymbols";
import type IParsedFile from "../types/IParsedFile";
import CResolver from "../PARSE/3-Declare/c/index";
import CppResolver from "../PARSE/3-Declare/cpp/index";
import HeaderSymbolAdapter from "../TRANSPILE/3-Render/headers/adapters/HeaderSymbolAdapter";
import IHeaderSymbol from "../TRANSPILE/3-Render/headers/types/IHeaderSymbol";
import TSymbol from "../types/symbols/TSymbol";

import IDiscoveredFile from "../PARSE/1-Discover/types/IDiscoveredFile";
import EHeaderLanguage from "../PARSE/1-Discover/types/EHeaderLanguage";
import type IHeaderSource from "../PARSE/1-Discover/types/IHeaderSource";
import type IRecoveredSlice from "../PARSE/1-Discover/types/IRecoveredSlice";
import OutputExtensions from "../utils/OutputExtensions";
import type IOutputExtensions from "../types/IOutputExtensions";

import ParserUtils from "../utils/ParserUtils";
import ITranspilerConfig from "../types/ITranspilerConfig";
import ITranspilerResult from "./types/ITranspilerResult";
import IFileResult from "../types/IFileResult";
import type IRunAnchor from "../PARSE/1-Discover/types/IRunAnchor";
import IPipelineFile from "../PARSE/1-Discover/types/IPipelineFile";
import type ISourceGraph from "../PARSE/1-Discover/types/ISourceGraph";
import HeaderMacros from "../PARSE/4-Resolve/HeaderMacros";
import type THeaderMacro from "../types/THeaderMacro";
import type IFileIncludes from "../PARSE/1-Discover/types/IFileIncludes";
import Discover from "../PARSE/1-Discover/Discover";
import RunAnchor from "../PARSE/1-Discover/RunAnchor";
import TTranspileInput from "../types/TTranspileInput";
import ITranspileError from "../lib/types/ITranspileError";
import runAnalyzers from "../TRANSPILE/1-Analyze/runAnalyzers";
import Diagnostics from "../TRANSPILE/1-Analyze/Diagnostics";
import type IDiagnostics from "../types/IDiagnostics";
import type ICodeGenSymbols from "../types/ICodeGenSymbols";
import CacheManager from "../utils/cache/CacheManager";
import ConcurrencyLimit from "../utils/ConcurrencyLimit";
import ExternalDeclarationOracle from "../PARSE/1-Discover/preprocessor/ExternalDeclarationOracle";
import TypedefParamParser from "../TRANSPILE/3-Render/codegen/helpers/TypedefParamParser";
import type IRecordedRequirement from "../types/IRecordedRequirement";
import type IRenderedFile from "./types/IRenderedFile";
import RequirementAggregator from "../utils/RequirementAggregator";
import TargetCatalogFile from "../PARSE/1-Discover/TargetCatalogFile";
import Write from "../WRITE/1-Write/Write";
import CaughtError from "../utils/CaughtError";

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
  private readonly headerGenerator: HeaderGenerator;
  private readonly warnings: string[];
  private readonly cacheManager: CacheManager | null;
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
   */
  private cppMode: boolean;

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
  private readonly retainedParses = new Map<string, IParsedFile>();

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

  /**
   * The artifact 1.1 Discover emitted for the current run (#1444).
   *
   * Held as `program` is, so a stage with no graph in hand reads it from
   * here. Null outside a run: it holds every source text, and `ServeCommand`
   * keeps one instance alive between requests, so it is released when the
   * run ends, as the retained parses are.
   */
  private sourceGraph: ISourceGraph | null = null;
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
      preprocess: config.preprocess ?? true,
      cppRequired: config.cppRequired,
      parseOnly: config.parseOnly ?? false,
      debugMode: config.debugMode ?? false,
      target: config.target ?? "",
      pioEnv: config.pioEnv ?? "",
      collectGrammarCoverage: config.collectGrammarCoverage ?? false,
      noCache: config.noCache ?? false,
    };

    // Issue #211, #1319: the single source of the fact. Absent means C, which
    // is the default target, not a guess about what the includes might contain.
    this.cppMode = this.config.cppRequired ?? false;

    this.codeGenerator = new CodeGenWalker();
    this.headerGenerator = new HeaderGenerator();
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
      );
      this.anchor = discovered.anchor;
      this.sourceGraph = discovered.graph;
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
      this.sourceGraph = null;

      // #1445 box 2: the walker holds the token stream and the comment scanner
      // over it on its own fields, which the map clear above cannot reach.
      this.codeGenerator.releaseParseState();
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
    await this._collectHeaderMacros(input);

    if (!this._passesProgramChecks(input, result)) {
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

    // One gate for both halves of the output: a .c is written only when its
    // header is (#1233)
    if (result.success && input.writeOutputToDisk) {
      for (const write of pendingWrites) {
        Write.file(this.fs, write.path, write.content);
      }
      // Stage 6: Write the Stage 5.5 headers (only to disk in files mode)
      this._generateAllHeadersFromPipeline(
        input.cnextFiles,
        result,
        renderedFiles,
      );
    }
  }

  /**
   * Stages 3 to 4c: the whole-program checks every file waits on. Each records
   * its own errors; the first to fail ends the run, in this order.
   */
  private _passesProgramChecks(
    input: ISourceGraph,
    result: ITranspilerResult,
  ): boolean {
    return (
      // Stage 3: 1.3 Declare for every C-Next file, then 1.4 Resolve once
      // over all of them
      this._collectAllCNextSymbolsFromPipeline(input.cnextFiles, result) &&
      // Stage 3b: the program's one target (ADR-049), settled by 1.4. Nothing
      // below may run for a program whose target is unknown or contested.
      this._checkRunTarget(input, result) &&
      // Stage 4: symbol conflicts
      this._checkSymbolConflicts(result) &&
      // Stage 4b: include guard collisions (ADR-063, issue #1133)
      this._checkIncludeGuardCollisions(input.cnextFiles, result) &&
      // Stage 4c: external identifier significance (MISRA 5.1, issue #1307)
      this._checkExternalIdentifierSignificance(result)
    );
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
    cnextFiles: readonly IPipelineFile[],
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
            // #1688: each file's own, from its C includes' macro dump
            macros: this.headerMacrosByFile,
            macrosUnread: this.headerMacrosUnread,
          },
          // #1825: ADR-006's and ADR-029's derivations look callees and
          // typedefs up in it. It holds the headers' symbols only until the
          // files are published below, which is the state they need.
          symbolTable: this.codeGenerator.transpileState.symbolTable,
          // #1175: where a name nothing binds may be a macro -- discovery's
          // one answer, the same 2.1's E0427 reads
          filesReachingForeignHeaders: new Set(
            declared
              .filter((entry) => entry.file.reachesForeignHeader)
              .map((entry) => entry.fileSymbols.sourceFile),
          ),
          visibility: {
            cnextIncludesByFile: new Map(
              declared.map((entry) => [
                entry.file.path,
                entry.file.cnextIncludes,
              ]),
            ),
          },
          registry: this.symbolRegistry,
          target: {
            option: this.config.target,
            // ADR-049's build-system rung, read once by 1.1 from the text its
            // include discovery used (#1444, owner ruling 3)
            platformio: this._requireSourceGraph().anchor.platformio,
            pioEnv: this.config.pioEnv || undefined,
            catalog: TargetCatalogFile.targets(this.fs),
            files: declared.map((entry) => ({
              sourcePath: entry.file.path,
              directives: entry.parsed.targetDirectives,
            })),
          },
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
    const parsed = CNextSourceParser.parse(file.source);

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
    const rawMessage = CaughtError.messageOf(err);
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
  private _analyzeProgram(input: ISourceGraph): IDiagnostics {
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
      // order -- and a default would only move the failure: ADR-010's rules
      // read discovery's per-directive answers through `Program` (#1672), and
      // an empty set of answers is not "this file includes nothing". Same
      // reasoning as the conflict check.
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
          reachesForeignHeader: file.reachesForeignHeader,
          sourceFile: sourcePath,
        },
        includes: {
          resolutions: this._includesOf(sourcePath).resolutions,
          cnextAlternatives: this._includesOf(sourcePath).cnextAlternatives,
          kinds: this._includesOf(sourcePath).kinds,
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
   * guard. If it ever fired it would surface at line 1, since the message
   * carries no `N:M` prefix for `parseErrorLocation` to find -- and as an
   * `Internal:` assertion (#1531), so the reader knows the transpiler broke,
   * not their program.
   */
  private _requireRetainedParse(sourcePath: string): IParsedFile {
    const declared = this.retainedParses.get(sourcePath);
    invariant(
      declared,
      `every file that reaches code generation was declared and its parse retained, ${sourcePath} included`,
    );
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
        this.anchor.pathResolver.getSourceRelativePath(sourcePath);
      const code = this.codeGenerator.generate(tree, tokenStream, {
        debugMode: this.config.debugMode,
        targetDescription: this._runTarget().description,
        sourcePath,
        cppMode: this.cppMode,
        symbolInfo,
        sourceRelativePath,
        cnxIncludeRewrites: this._includesOf(sourcePath).cnxIncludeRewrites,
        includeKinds: this._includesOf(sourcePath).kinds,
        // #1515: decided here, from the rule's owner. 1.3 Declare used to
        // answer this, which put an emission decision in the parse layer.
        hasPublicInterface: PublicInterface.existsIn(
          this.codeGenerator.transpileState.symbolTable.getTSymbolsByFile(
            sourcePath,
          ),
        ),
      });

      // #1323: resolve this file's header-render input while its state is
      // warm (reads from state populated above), but do not render it here.
      // HeaderRenderer renders every file's header in one step, after
      // this per-file loop finishes -- headerCode is filled in there.
      const headerFacts = this._captureHeaderEmissionFacts(
        file,
        program,
        symbolInfo,
      );
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

  private _initializeRun(): void {
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
    if (this.config.outDir) {
      Write.directory(this.fs, this.config.outDir);
    }
    if (this.config.headerOutDir) {
      Write.directory(this.fs, this.config.headerOutDir);
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
        if (Transpiler.isDiagnostic(err)) {
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

    const cleanState = this._parseRecoveredSlices(recovered.slices);
    Transpiler._clearPhantomStructBodies(
      cleanState,
      this.codeGenerator.transpileState,
    );

    // Function-like macros have no declaration to parse; register their names for
    // the undeclared-call check only (a by-value macro invocation is correct).
    if (recovered.macroNames.size > 0) {
      this.codeGenerator.transpileState.symbolTable.addExternalDeclarationNames(
        recovered.macroNames,
      );
    }
  }

  /** One .cnx file's C header includes, as `"x.h"` or `<x.h>`, in source order */
  private _cIncludeDirectivesOf(sourcePath: string): string[] {
    // #1830 review: the directives 1.1 reads, so a commented-out header adds
    // nothing to the translation unit. The regex this replaced did not know
    // about comments, missed `#include"x.h"`, which the grammar allows, and
    // skipped `.cnx` but sent a `.cnext` include in as a header.
    // #1444: and read from 1.1's answer, rather than lexed and classified
    // again here from the file's text.
    return this._includesOf(sourcePath).cHeaderIncludes.flatMap((text) => {
      const spec = IncludeDirectiveText.spec(text);
      return spec === null ? [] : [spec];
    });
  }

  /**
   * #1688: each file's header macros, from the preprocessor's macro dump of
   * that file's own C includes -- so a file sees the macros C sees for it,
   * system headers and compiler builtins included, and no other file's.
   * Without a preprocessor a macro has no type, as before #1688.
   */
  private async _collectHeaderMacros(input: ISourceGraph): Promise<void> {
    const withIncludes = input.cnextFiles.flatMap((file) => {
      const directives = this._cIncludeDirectivesOf(file.path);
      return directives.length === 0 ? [] : [{ file, directives }];
    });
    // Unread is not "no macros": a name the file uses may be one (#1688 review)
    if (
      this.config.preprocess === false ||
      !this.anchor.preprocessor.isAvailable()
    ) {
      for (const { file } of withIncludes)
        this.headerMacrosUnread.add(file.path);
      return;
    }
    const limit = ConcurrencyLimit.create(availableParallelism());
    const defines = { ...this._requireSourceGraph().anchor.defines };
    await Promise.all(
      withIncludes.map(async ({ file, directives }) => {
        const read = await limit(() =>
          ExternalDeclarationOracle.macroDump(
            directives,
            this.anchor.preprocessor,
            {
              // The file's own directory first, as C searches a quoted include
              includePaths: [
                this._includesOf(file.path).quotedIncludeDirectory,
                ...input.includeSearchPaths,
              ],
              defines,
            },
          ),
        );
        if (read?.complete !== true) this.headerMacrosUnread.add(file.path);
        if (read !== null) {
          this.headerMacrosByFile.set(
            file.path,
            HeaderMacros.collect(read.dump),
          );
        }
      }),
    );
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
   * opaque/struct-body truth. The main table parses each slice with the parser
   * of the language 1.1 judged its header to be (#1844); the isolated table uses
   * the C parser directly
   * (opaque struct typedefs are a C concern) and tolerates slices it cannot
   * parse -- except a deliberate diagnostic, which propagates.
   */
  private _parseRecoveredSlices(
    slices: ReadonlyMap<string, IRecoveredSlice>,
  ): SymbolTable {
    const cleanState = new SymbolTable();
    for (const [path, { text: content, language }] of slices) {
      try {
        this._parseHeaderText(content, path, language);
      } catch (err) {
        // #1319: same decision as the sibling catch in _collectAllHeaderSymbols:
        // swallowing a diagnostic here would produce the `Compiled N files` /
        // exit 0 shape diagnostics exist to remove -- so "is this a deliberate
        // diagnostic?" is answered in both places or in neither.
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
    cnextFiles: readonly IPipelineFile[],
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
        message: CodedErrorText.of(
          "E0203",
          `Source files '${basename(existing)}' and '${basename(file.path)}' both ` +
            `produce the include guard '${guard}'. Rename one so the generated headers stay distinguishable.`,
        ),
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
    invariant(
      this.program,
      "1.4 Resolve built Program before the symbol-conflict check ran",
    );
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
      message: CodedErrorText.of(conflict.code, conflict.message),
      severity: conflict.severity,
    };
  }

  /**
   * Stage 3b: report the run's target, or why it has none (ADR-049).
   *
   * 1.4 settled it with the program; this only reports. An error with no
   * position is about the target option rather than a line of source, and is
   * placed on the entry file -- the last file in pipeline order, which lists
   * dependencies first. A parse-only run needs no target, so only an absent
   * one is excused there.
   *
   * @returns true when the run has a target
   */
  private _checkRunTarget(
    input: ISourceGraph,
    result: ITranspilerResult,
  ): boolean {
    invariant(this.program, "Stage 3 built the program");
    const target = this.program.target();
    if (target.kind === "resolved") {
      result.target = { name: target.name, source: target.source };
      return true;
    }
    // ADR-049: a parse-only run needs no target, so an ABSENT one (E0515) is
    // no error there -- but every name the program gives must still be a
    // known target (#1760 second review: `--parse` accepted
    // `#pragma target bogus`, an unknown pragma and two conflicting ones)
    if (this.config.parseOnly && target.absent) {
      return true;
    }
    const entry = input.cnextFiles.at(-1)?.path;
    for (const error of target.errors) {
      result.errors.push(
        error.sourcePath === undefined && entry !== undefined
          ? { ...error, sourcePath: entry }
          : error,
      );
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
    // ADR-049: a parse-only run needs no target, and without one there is no
    // budget to check against. Every other run reaches here with one (3b).
    if (this.config.parseOnly && this.program?.target().kind !== "resolved") {
      return true;
    }
    // NOT TranspileState.targetDescription: codegen assigns that in Stage 5, one
    // stage after this runs, so it holds nothing on a fresh process and the
    // previous file's target in a long-lived one (#1307 review). The budget a
    // whole-program check reports against has to be the build's, which 1.4
    // settled once.
    const collisions =
      this.codeGenerator.transpileState.symbolTable.detectMISRA51Conflicts(
        this._runTarget().description,
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
      outputPath = this.anchor.pathResolver.getOutputPath(
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
        const headerPath = this.anchor.pathResolver.getHeaderOutputPath(
          file.discoveredFile,
          this.outputExtensions.header,
        );
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
    result.symbolsCollected =
      this.codeGenerator.transpileState.symbolTable.size;
    result.warnings = [...result.warnings, ...this.warnings];
    // Issue #1143: union of what each file's emitters recorded.
    result.requirements = RequirementAggregator.merge(result.files);
    // Issue #1241: every position at which an ADR's rule fired this run.
    result.adrSites = AdrProvenance.collect();

    if (this.cacheManager) {
      this.cacheManager.flush();
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
      this._restoreCachedHeader(file, header.entry, header.symbols);
      return; // Cache hit - skip full parsing
    }
    const { preprocessError } = header.source;
    if (preprocessError !== null) {
      // Fell back to raw content, so it was not offered as macro context to
      // the headers after it. 1.1 judged it on its slice of the translation
      // unit instead, which Stage 2 parses too (Issue #985).
      this.warnings.push(
        `Preprocessing failed for ${file.path}: ${preprocessError}. Using raw content.`,
      );
    }
    this.parseHeaderFile(file, header.source);

    // Debug: Show symbols found
    if (this.config.debugMode) {
      const symbols =
        this.codeGenerator.transpileState.symbolTable.getSymbolsByFile(
          file.path,
        );
      console.log(`[DEBUG]   Found ${symbols.length} symbols in ${file.path}`);
    }

    // Issue #590: Cache the results using simplified API
    if (this.cacheManager) {
      this.cacheManager.setSymbolsFromTable(
        file.path,
        this.codeGenerator.transpileState.symbolTable,
      );
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
    file: IDiscoveredFile,
    cached: TCachedHeader,
    symbols: TCachedSymbols,
  ): void {
    for (const symbol of symbols) {
      if (symbol.sourceLanguage === ESourceLanguage.C) {
        this.codeGenerator.transpileState.symbolTable.addCSymbol(symbol);
      } else {
        this.codeGenerator.transpileState.symbolTable.addCppSymbol(symbol);
      }
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
    this._parseHeaderText(source.text, file.path, source.language);
  }

  /**
   * Issue #208: one parser per header, the one its language names. #1844:
   * the language is 1.1's answer; nothing here judges the text again, so a
   * cold run and a warm one cannot disagree (#1851).
   */
  private _parseHeaderText(
    content: string,
    filePath: string,
    language: EHeaderLanguage,
  ): void {
    switch (language) {
      case EHeaderLanguage.Assembler:
        // Not C: parsing its `.macro` bodies as C mis-collects instruction
        // mnemonics like `loop` as C symbols that then false-conflict with
        // C-Next symbols of the same name.
        return;
      case EHeaderLanguage.Cpp:
        // C++14 parser for typed enums, classes, namespaces, templates
        this.parseCppHeader(content, filePath);
        return;
      case EHeaderLanguage.C:
        this.parsePureCHeader(content, filePath);
        return;
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
    const anchor = this._requireSourceGraph().anchor;
    const base = anchor.projectRoot ?? anchor.directory;
    const relativePath = relative(base, resolve(sourcePath));

    return relativePath.startsWith("..") || relativePath === ""
      ? basename(sourcePath)
      : relativePath;
  }

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

  /**
   * The include directive for every header the run reached, spelled as
   * `sourcePath` would spell it, for that file's generated header.
   *
   * #1435: a header the file includes itself takes the file's own spelling.
   * #1725: a header it reaches only through another file takes that file's
   * spelling when it is valid from anywhere -- an angle include, a spelling
   * found along the search path, an output-root path -- and is re-spelled
   * relative to `sourcePath` when it was relative to the file that wrote it.
   * Copied, `"dev.h"` from lib/a.cnx named `src/dev.h` in src/main.h.
   *
   * The ORDER is the run's first-seen order, unchanged, because
   * `ExternalTypeHeaderBuilder` lets the first header declaring a type win,
   * and `Map.set` on a key already present keeps its position.
   */
  private _includeDirectivesSpelledBy(
    sourcePath: string,
  ): ReadonlyMap<string, string> {
    const own = this._includesOf(sourcePath);
    const here = own.quotedIncludeDirectory;
    const directives = new Map<string, string>();
    for (const file of this._requireSourceGraph().includes.values()) {
      for (const [header, directive] of file.headerIncludeDirectives) {
        const named = file.writerRelativeIncludes.get(header);
        directives.set(
          header,
          named === undefined
            ? directive
            : `#include "${relative(here, named).split(sep).join("/")}"`,
        );
      }
    }
    for (const [header, directive] of own.headerIncludeDirectives) {
      directives.set(header, directive);
    }
    return directives;
  }

  /** The run's `SourceGraph`, which every stage after 1.1 runs inside. */
  private _requireSourceGraph(): ISourceGraph {
    invariant(
      this.sourceGraph !== null,
      "1.1 Discover emitted the SourceGraph before a later stage read it",
    );
    return this.sourceGraph;
  }

  /** What 1.1 Discover learned about one file's includes (#1444). */
  private _includesOf(sourcePath: string): IFileIncludes {
    const includes = this._requireSourceGraph().includes.get(sourcePath);
    invariant(
      includes !== undefined,
      `1.1 Discover records the includes of every file it discovers (missing ${sourcePath})`,
    );
    return includes;
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
   * `allKnownEnums` and `externalTypeHeaders` no longer depend on file order.
   * This paragraph used to say they did, citing `state.getAllSymbolInfo()` and
   * `state.getAllHeaderDirectives()` -- neither exists. Both now read complete
   * artifacts: `Program.knownEnums()` is settled before any file renders
   * (#1447), and every file's include directives are recorded when discovery
   * ends, before Stage 2 (#1435).
   */
  private _captureHeaderEmissionFacts(
    file: IPipelineFile,
    program: IProgram,
    typeInput: ICodeGenSymbols,
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

    // #1671: both decided by 1.4 Resolve, the first layer that can see every
    // file. `typeInput` is the view `generate()` received, so the `.h` and the
    // `.c` are built from one object; neither is copied onto this class.
    const passByValueParams = program.passByValueParams();
    const includes = this._includesOf(sourcePath);
    // Issue #424: a dimension that is not a number is a macro the header names
    // but does not define, so the header must carry its source include.
    const cHeadersIncluded = Transpiler._headerNeedsUserCHeaders(
      exportedSymbols,
      this.codeGenerator.transpileState,
    );
    const userIncludes = cHeadersIncluded
      ? [...includes.userIncludes, ...includes.cHeaderIncludes]
      : [...includes.userIncludes];

    // #1447: read from the artifact, not accumulated from the files transpiled
    // so far. The old form was correct only because `_sortFilesByDependency`
    // put every dependency first, and a dependency cycle (#1167) made the order
    // -- and so the answer -- arbitrary. `Program` is complete before any file
    // is rendered, so this cannot depend on where in the run it is asked.
    const allKnownEnums = program.knownEnums();

    // #1511: which types a header declares comes from the artifact. The
    // include ORDER stays here -- it decides which header wins, and that is not
    // a symbol fact.
    const externalTypeHeaders = ExternalTypeHeaderBuilder.build(
      this._includeDirectivesSpelledBy(sourcePath),
      {
        typesDeclaredIn: (file: string) => program.typesDeclaredIn(file),
      },
    );

    // ADR-029: Convert callback types to header format
    const callbackTypesForHeader = this._buildCallbackTypesForHeader();

    const typeInputWithSymbolTable = {
      ...typeInput,
      symbolTable: this.codeGenerator.transpileState.symbolTable,
      callbackTypes: callbackTypesForHeader,
    };

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
    // references against what each file can see, its include closure, after
    // every file is declared, so order cannot affect the result (#1724).
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

        // Issue #995 / ADR-030: whether this parameter is an opaque handle is
        // the decision `HeaderSymbolAdapter` already read onto it -- the one
        // the `.c`'s prototype is spelled from (`isHeldThroughPointer`). This
        // recomputed it from `isOpaqueType` and wrote it back, a second writer
        // of one flag that agreed only while the two predicates did.
        const isOpaque = param.isOpaqueHandle === true;

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
          return { ...param, isAutoConst: shouldAutoConst || undefined };
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
   * Check if C++ output was detected during transpilation.
   * This is set when C++ syntax is found in included headers (e.g., Arduino.h).
   */
  isCppMode(): boolean {
    return this.cppMode;
  }
}

export default Transpiler;
