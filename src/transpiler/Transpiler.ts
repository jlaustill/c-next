/**
 * Transpiler
 * Unified transpiler for both single-file and multi-file builds
 *
 * Key insight from ADR-053: "A single file transpilation is just a project
 * with one .cnx file."
 *
 * Architecture: transpile() is the single entry point. It discovers files
 * via discoverIncludes(), then delegates to _executePipeline(). There is
 * ONE pipeline for all transpilation.
 */

import { join, basename, dirname, resolve } from "node:path";

import IFileSystem from "./types/IFileSystem";
import NodeFileSystem from "./NodeFileSystem";

import CNextSourceParser from "./logic/parser/CNextSourceParser";
import HeaderParser from "./logic/parser/HeaderParser";

import CodeGenerator from "./output/codegen/CodeGenerator";
import CodeGenState from "./state/CodeGenState";
import HeaderGenerator from "./output/headers/HeaderGenerator";
import ExternalTypeHeaderBuilder from "./output/headers/ExternalTypeHeaderBuilder";
import ICodeGenSymbols from "./types/ICodeGenSymbols";
import IncludeExtractor from "./logic/IncludeExtractor";
import SymbolTable from "./logic/symbols/SymbolTable";
import ISerializedSymbol from "./types/ISerializedSymbol";
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

import FileDiscovery from "./data/FileDiscovery";
import EFileType from "./data/types/EFileType";
import IDiscoveredFile from "./data/types/IDiscoveredFile";
import IncludeDiscovery from "./data/IncludeDiscovery";
import IncludeResolver from "./data/IncludeResolver";
import IncludeTreeWalker from "./data/IncludeTreeWalker";
import DependencyGraph from "./data/DependencyGraph";
import PathResolver from "./data/PathResolver";
import InputExpansion from "./data/InputExpansion";
import CppEntryPointScanner from "./data/CppEntryPointScanner";

import ParserUtils from "../utils/ParserUtils";
import ITranspilerConfig from "./types/ITranspilerConfig";
import ITranspilerResult from "./types/ITranspilerResult";
import IFileResult from "./types/IFileResult";
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
import TransitiveEnumCollector from "./logic/symbols/TransitiveEnumCollector";
import TypedefParamParser from "./output/codegen/helpers/TypedefParamParser";

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
  /** Issue #211: Tracks if C++ output is needed (one-way flag, false → true only) */
  private cppDetected: boolean;
  /** Issue #587: Encapsulated state for accumulated Maps/Sets */
  private readonly state = new TranspilerState();
  /**
   * Issue #593: Centralized analyzer for cross-file const inference in C++ mode.
   * Accumulates parameter modifications and param lists across all processed files.
   */
  private readonly modificationAnalyzer = new ModificationAnalyzer();
  /** Issue #586: Centralized path resolution for output files */
  private readonly pathResolver: PathResolver;
  /** File system abstraction for testability */
  private readonly fs: IFileSystem;

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

    // Issue #211: Initialize cppDetected from config (--cpp flag sets this)
    this.cppDetected = this.config.cppRequired;

    this.preprocessor = new Preprocessor();
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

    // Initialize cache manager if caching is enabled and project root can be determined
    const projectRoot = this.config.noCache
      ? undefined
      : this.determineProjectRoot();
    this.cacheManager = projectRoot
      ? new CacheManager(projectRoot, this.fs)
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
   * Stage 5: Generate code (per-file)
   * Stage 6: Generate headers (per-file)
   */
  private async _executePipeline(
    input: IPipelineInput,
    result: ITranspilerResult,
  ): Promise<void> {
    // Stage 2: Collect symbols from C/C++ headers and build analyzer context
    // Issue #945: Now async for preprocessing support
    await this._collectAllHeaderSymbols(input.headerFiles, result);
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

    // Stage 5: Analyze and transpile each C-Next file
    for (const file of input.cnextFiles) {
      if (file.symbolOnly) {
        continue;
      }

      const fileResult = this._transpileFile(file);
      this._recordFileResult(
        file.discoveredFile,
        fileResult,
        result,
        input.writeOutputToDisk,
      );
    }

    // Stage 6: Generate headers (only write to disk in files mode)
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
    const { tree, errors } = CNextSourceParser.parse(content);

    // Parse errors — return them with original line/column and sourcePath
    if (errors.length > 0) {
      return errors.map((e) => ({ ...e, sourcePath: file.path }));
    }

    try {
      // ADR-055 Phase 7: Use composable collectors via CNextResolver
      const tSymbols = CNextResolver.resolve(tree, file.path);

      // ADR-055 Phase 7: Store TSymbol directly in SymbolTable (no ISymbol conversion)
      CodeGenState.symbolTable.addTSymbols(tSymbols);

      // Issue #465: Store ICodeGenSymbols for external enum resolution in stage 5
      const symbolInfo = TSymbolInfoAdapter.convert(tSymbols);
      this.state.setFileSymbolInfo(file.path, symbolInfo);

      // Issue #593: Collect modification analysis in C++ mode
      if (this.cppDetected) {
        const results = this.codeGenerator.analyzeModificationsOnly(
          tree,
          this.modificationAnalyzer.getModifications(),
          this.modificationAnalyzer.getParamLists(),
        );
        this.modificationAnalyzer.accumulateResults(results);
      }
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
    const source = file.source ?? this.fs.readFile(file.path);

    try {
      // Parse source
      const { tree, tokenStream, errors, declarationCount } =
        CNextSourceParser.parse(source);

      if (errors.length > 0) {
        return this.buildErrorResult(sourcePath, errors, declarationCount);
      }

      // Parse only mode
      if (this.config.parseOnly) {
        return this.buildParseOnlyResult(sourcePath, declarationCount);
      }

      // Build symbolInfo for code generation (before analyzers so they can read it)
      const tSymbols = CNextResolver.resolve(tree, sourcePath);
      let symbolInfo = TSymbolInfoAdapter.convert(tSymbols);

      // Merge enum info from included .cnx files
      const externalEnumSources = this._collectExternalEnumSources(
        sourcePath,
        file.cnextIncludes,
      );
      if (externalEnumSources.length > 0) {
        symbolInfo = TSymbolInfoAdapter.mergeExternalEnums(
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
        this.cppDetected,
      );

      // Get pass-by-value params (snapshot before next file clears it)
      const passByValue = this.codeGenerator.getPassByValueParams();
      const passByValueCopy = MapUtils.deepCopyStringSetMap(passByValue);

      // Directly update state (no contribution round-trip)
      this.state.setSymbolInfo(sourcePath, symbolInfo);
      this.state.setPassByValueParams(sourcePath, passByValueCopy);
      this.state.setUserIncludes(sourcePath, [...userIncludes]);

      // Accumulate C++ modifications directly
      if (this.cppDetected) {
        this._accumulateFileModifications();
      }

      // Generate header content (reads from state populated above)
      const headerCode = this.generateHeaderForFile(file) ?? undefined;

      return this.buildSuccessResult(
        sourcePath,
        code,
        headerCode,
        declarationCount,
      );
    } catch (err) {
      return this.buildCatchResult(sourcePath, err);
    }
  }

  /**
   * Accumulate C++ modification data from the code generator into the
   * centralized modification analyzer.
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
    const resolver = new IncludeResolver(searchPaths, this.fs);
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
    };

    // Includes first (symbols must be collected before main file code gen),
    // then main file
    return {
      cnextFiles: [...cnextIncludeFiles, mainFile],
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
      conflicts: [],
      errors: [],
      warnings: [],
      outputFiles: [],
    };
  }

  /**
   * Initialize run state: cache, analyzers, symbol table
   */
  private async _initializeRun(): Promise<void> {
    if (this.cacheManager) {
      await this.cacheManager.initialize();
    }
    // Issue #593: Reset cross-file modification tracking for new run
    this.modificationAnalyzer.clear();
    // Issue #587: Reset accumulated state for new run
    this.state.reset();
    // Issue #634: Reset symbol table for new run
    CodeGenState.symbolTable.clear();
    // Reset SymbolRegistry for new run (new IFunctionSymbol type system)
    SymbolRegistry.reset();
    // Reset callback-compatible functions for new run
    // (populated by FunctionCallAnalyzer, persists through CodeGenState.reset())
    CodeGenState.callbackCompatibleFunctions = new Map();
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
    for (const file of headerFiles) {
      try {
        await this.doCollectHeaderSymbols(file);
        result.filesProcessed++;
      } catch (err) {
        this.warnings.push(`Failed to process header ${file.path}: ${err}`);
      }
    }
  }

  /**
   * Stage 4: Check for symbol conflicts
   * @returns true if no blocking conflicts, false otherwise
   */
  private _checkSymbolConflicts(result: ITranspilerResult): boolean {
    const conflicts = CodeGenState.symbolTable.getConflicts();
    for (const conflict of conflicts) {
      result.conflicts.push(conflict.message);
      if (conflict.severity === "error") {
        result.success = false;
      }
    }

    if (!result.success) {
      result.errors.push({
        line: 1,
        column: 0,
        message: "Symbol conflicts detected - cannot proceed",
        severity: "error",
      });
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
  ): void {
    let outputPath: string | undefined;
    if (
      writeOutputToDisk &&
      this.config.outDir &&
      fileResult.success &&
      fileResult.code
    ) {
      outputPath = this.pathResolver.getOutputPath(file, this.cppDetected);
      this.fs.writeFile(outputPath, fileResult.code);
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
   * Stage 6: Generate headers for pipeline files
   */
  private _generateAllHeadersFromPipeline(
    cnextFiles: IPipelineFile[],
    result: ITranspilerResult,
  ): void {
    for (const file of cnextFiles) {
      if (file.symbolOnly) {
        continue;
      }
      const headerContent = this.generateHeaderForFile(file);
      if (headerContent) {
        // Issue #933: Pass cppDetected to generate .hpp in C++ mode
        const headerPath = this.pathResolver.getHeaderOutputPath(
          file.discoveredFile,
          this.cppDetected,
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

      // Don't add if already in the list
      const alreadyExists =
        cnextBaseNames.has(includeBaseName) ||
        cnextFiles.some((f) => resolve(f.path) === includePath);
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
    const resolver = new IncludeResolver(searchPaths, this.fs);
    const resolved = resolver.resolve(content, cnxFile.path);

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

    for (const cnxFile of cnextFiles) {
      this._processFileIncludes(
        cnxFile,
        depGraph,
        cnextFiles,
        cnextBaseNames,
        headerSet,
        fileByPath,
      );
    }

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
  private async doCollectHeaderSymbols(file: IDiscoveredFile): Promise<void> {
    // Track as processed (for cycle detection)
    const absolutePath = resolve(file.path);
    this.state.markHeaderProcessed(absolutePath);

    // Check cache first
    if (this.tryRestoreFromCache(file)) {
      return; // Cache hit - skip full parsing
    }

    // Issue #945: Preprocess header to evaluate #if/#ifdef directives
    const content = await this.getHeaderContent(file);
    this.parseHeaderFile(file, content);

    // Debug: Show symbols found
    if (this.config.debugMode) {
      const symbols = CodeGenState.symbolTable.getSymbolsByFile(file.path);
      console.log(`[DEBUG]   Found ${symbols.length} symbols in ${file.path}`);
    }

    // Issue #590: Cache the results using simplified API
    if (this.cacheManager) {
      this.cacheManager.setSymbolsFromTable(
        file.path,
        CodeGenState.symbolTable,
      );
    }
  }

  /**
   * Try to restore symbols from cache. Returns true if cache hit.
   * SonarCloud S3776: Extracted from doCollectHeaderSymbols().
   */
  private tryRestoreFromCache(file: IDiscoveredFile): boolean {
    if (!this.cacheManager?.isValid(file.path)) {
      return false;
    }

    const cached = this.cacheManager.getSymbols(file.path);
    if (!cached) {
      return false;
    }

    // Restore symbols, struct fields, needsStructKeyword, and enumBitWidth from cache
    // ADR-055 Phase 7: Cache returns ISerializedSymbol[], converted to typed symbols
    this.restoreCachedSymbols(cached.symbols, file);
    CodeGenState.symbolTable.restoreStructFields(cached.structFields);
    CodeGenState.symbolTable.restoreNeedsStructKeyword(
      cached.needsStructKeyword,
    );
    CodeGenState.symbolTable.restoreEnumBitWidths(cached.enumBitWidth);

    // Issue #948: Restore opaque types (forward-declared structs)
    CodeGenState.symbolTable.restoreOpaqueTypes(cached.opaqueTypes);

    // Issue #958: Restore typedef struct types (all typedef'd structs)
    CodeGenState.symbolTable.restoreTypedefStructTypes(
      cached.typedefStructTypes,
    );

    // Issue #958: Restore struct tag aliases and body tracking
    CodeGenState.symbolTable.restoreStructTagAliases(cached.structTagAliases);
    CodeGenState.symbolTable.restoreStructTagsWithBodies(
      cached.structTagsWithBodies,
    );

    // Issue #211: Still check for C++ syntax even on cache hit
    this.detectCppFromFileType(file);

    return true;
  }

  /**
   * Get header content, optionally preprocessed.
   * Issue #945: Evaluates #if/#ifdef directives using system preprocessor.
   *
   * Only preprocesses when necessary to avoid side effects from full expansion.
   * Preprocessing is needed when the file has conditional compilation patterns
   * like #if MACRO != 0 that require expression evaluation.
   */
  private async getHeaderContent(file: IDiscoveredFile): Promise<string> {
    const rawContent = this.fs.readFile(file.path);

    // Check if preprocessing is disabled
    if (this.config.preprocess === false) {
      return rawContent;
    }

    // Check if preprocessing is available
    if (!this.preprocessor.isAvailable()) {
      return rawContent;
    }

    // Issue #945: Only preprocess if file has conditional compilation patterns
    // that require expression evaluation (e.g., #if MACRO != 0, #if MACRO == 1)
    // Simple #ifdef/#ifndef patterns are already handled by the parser
    if (!this.needsConditionalPreprocessing(rawContent)) {
      return rawContent;
    }

    // Preprocess the header file
    const result = await this.preprocessor.preprocess(file.path, {
      defines: this.config.defines,
      includePaths: this.config.includeDirs,
      keepLineDirectives: false, // We don't need line mappings for symbol collection
    });

    if (!result.success) {
      // Log warning but fall back to raw content
      this.warnings.push(
        `Preprocessing failed for ${file.path}: ${result.error}. Using raw content.`,
      );
      return rawContent;
    }

    return result.content;
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
   * Restore cached symbols to the symbol table.
   * ADR-055 Phase 7: Converts ISerializedSymbol[] from cache to typed symbols.
   */
  private restoreCachedSymbols(
    symbols: ISerializedSymbol[],
    _file: IDiscoveredFile,
  ): void {
    for (const symbol of symbols) {
      // Determine which storage to use based on source language
      if (symbol.sourceLanguage === ESourceLanguage.CNext) {
        // C-Next symbols are never cached (they use TSymbol format).
        // If we see one here, it indicates a cache format issue - skip silently
        // since C-Next symbols are always re-parsed from source anyway.
        continue;
      } else if (symbol.sourceLanguage === ESourceLanguage.C) {
        // Convert ISymbol to TCSymbol (simplified conversion)
        CodeGenState.symbolTable.addCSymbol({
          kind: symbol.kind as
            | "struct"
            | "enum"
            | "function"
            | "variable"
            | "enum_member"
            | "typedef",
          name: symbol.name,
          sourceFile: symbol.sourceFile,
          sourceLine: symbol.sourceLine,
          sourceLanguage: ESourceLanguage.C,
          type: symbol.type,
          isExported: symbol.isExported ?? true,
          isDeclaration: symbol.isDeclaration,
          parameters: symbol.parameters?.map((p) => ({
            name: p.name,
            type: p.type,
            isArray: p.isArray,
          })),
          arrayDimensions: symbol.arrayDimensions?.map(String),
          members: undefined,
          isUnion: false,
        } as import("./types/symbols/c/TCSymbol").default);
      } else if (symbol.sourceLanguage === ESourceLanguage.Cpp) {
        // Convert ISymbol to TCppSymbol (simplified conversion)
        CodeGenState.symbolTable.addCppSymbol({
          kind: symbol.kind as
            | "class"
            | "struct"
            | "namespace"
            | "enum"
            | "function"
            | "variable"
            | "enum_member"
            | "type_alias",
          name: symbol.name,
          sourceFile: symbol.sourceFile,
          sourceLine: symbol.sourceLine,
          sourceLanguage: ESourceLanguage.Cpp,
          type: symbol.type,
          isExported: symbol.isExported ?? true,
          isDeclaration: symbol.isDeclaration,
          parent: symbol.parent,
          parameters: symbol.parameters?.map((p) => ({
            name: p.name,
            type: p.type,
            isArray: p.isArray,
          })),
          arrayDimensions: symbol.arrayDimensions?.map(String),
        } as import("./types/symbols/cpp/TCppSymbol").default);
      }
    }
  }

  /**
   * Detect C++ mode based on file type and content.
   * SonarCloud S3776: Extracted from doCollectHeaderSymbols().
   */
  private detectCppFromFileType(file: IDiscoveredFile): void {
    if (file.type === EFileType.CppHeader) {
      // .hpp files are always C++
      this.cppDetected = true;
      return;
    }

    if (file.type === EFileType.CHeader) {
      const content = this.fs.readFile(file.path);
      if (detectCppSyntax(content)) {
        this.cppDetected = true;
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
      this.cppDetected = true;
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
    if (detectCppSyntax(content)) {
      // Issue #211: C++ detected, set flag for .cpp output
      this.cppDetected = true;
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
   * Stage 6: Generate header file for a C-Next file
   * ADR-055 Phase 7: Uses TSymbol directly, converts to IHeaderSymbol for generation.
   */
  /**
   * Generate header content for a single file's exported symbols.
   * Unified method replacing both generateHeader() and generateHeaderContent().
   * Reads all needed data from state (populated during Stage 5).
   */
  private generateHeaderForFile(file: IPipelineFile): string | null {
    const sourcePath = file.path;
    const tSymbols = CodeGenState.symbolTable.getTSymbolsByFile(sourcePath);
    const exportedSymbols = tSymbols.filter((s) => s.isExported);

    if (exportedSymbols.length === 0) {
      return null;
    }

    // Issue #933: Use .hpp extension for include guard in C++ mode
    const ext = this.cppDetected ? ".hpp" : ".h";
    const headerName = basename(sourcePath).replace(/\.cnx$|\.cnext$/, ext);

    const typeInput = this.state.getSymbolInfo(sourcePath);
    const passByValueParams =
      this.state.getPassByValueParams(sourcePath) ??
      new Map<string, Set<string>>();
    const userIncludes = this.state.getUserIncludes(sourcePath);

    const allKnownEnums = TransitiveEnumCollector.aggregateKnownEnums(
      this.state.getAllSymbolInfo(),
    );

    const externalTypeHeaders = ExternalTypeHeaderBuilder.build(
      this.state.getAllHeaderDirectives(),
      CodeGenState.symbolTable,
    );

    const typeInputWithSymbolTable = typeInput
      ? { ...typeInput, symbolTable: CodeGenState.symbolTable }
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

    if (this.cppDetected && accumulatedModifications.size > 0) {
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
      if (callbackTypedefType) {
        const updatedParams = TypedefParamParser.resolveCallbackParams(
          headerSymbol.parameters,
          callbackTypedefType,
        );
        return { ...headerSymbol, parameters: updatedParams };
      }

      // Apply auto-const to non-callback function parameters
      const unmodified = unmodifiedParams.get(headerSymbol.name);
      if (unmodified) {
        const updatedParams = headerSymbol.parameters.map((param) => {
          const isPointerParam =
            !param.isConst &&
            !param.isArray &&
            param.type !== "f32" &&
            param.type !== "f64" &&
            param.type !== "ISR" &&
            !knownEnums.has(param.type ?? "");
          const isArrayParam = param.isArray && !param.isConst;

          if ((isPointerParam || isArrayParam) && unmodified.has(param.name)) {
            return { ...param, isAutoConst: true };
          }
          return param;
        });

        return { ...headerSymbol, parameters: updatedParams };
      }

      return headerSymbol;
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
  ): IFileResult {
    return {
      sourcePath,
      code,
      headerCode,
      success: true,
      errors: [],
      declarationCount,
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
