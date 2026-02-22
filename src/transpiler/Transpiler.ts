/**
 * Transpiler
 * Unified transpiler for both single-file and multi-file builds
 *
 * Key insight from ADR-053: "A single file transpilation is just a project
 * with one .cnx file."
 *
 * Architecture: Both run() and transpileSource() are thin wrappers that
 * discover files and delegate to _executePipeline(). There is ONE pipeline
 * for all transpilation — no branching on context/standalone mode.
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

import ParserUtils from "../utils/ParserUtils";
import ITranspilerConfig from "./types/ITranspilerConfig";
import ITranspilerResult from "./types/ITranspilerResult";
import IFileResult from "./types/IFileResult";
import IPipelineFile from "./types/IPipelineFile";
import IPipelineInput from "./types/IPipelineInput";
import ITranspileError from "../lib/types/ITranspileError";
import TranspilerState from "./state/TranspilerState";
import runAnalyzers from "./logic/analysis/runAnalyzers";
import ModificationAnalyzer from "./logic/analysis/ModificationAnalyzer";
import CacheManager from "../utils/cache/CacheManager";
import MapUtils from "../utils/MapUtils";
import detectCppSyntax from "./logic/detectCppSyntax";
import TransitiveEnumCollector from "./logic/symbols/TransitiveEnumCollector";

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
      inputs: config.inputs,
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
        inputs: this.config.inputs,
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
  // Public API: run() and transpileSource()
  // ===========================================================================

  /**
   * Execute the unified pipeline from CLI inputs.
   *
   * Stage 1 (file discovery) happens here, then delegates to _executePipeline().
   */
  async run(): Promise<ITranspilerResult> {
    const result = this._initResult();

    try {
      await this._initializeRun();

      // Stage 1: Discover source files
      const { cnextFiles, headerFiles } = await this.discoverSources();
      if (cnextFiles.length === 0) {
        return this._finalizeResult(result, "No C-Next source files found");
      }

      this._ensureOutputDirectories();

      // Convert IDiscoveredFile[] to IPipelineFile[] (disk-based, all get code gen)
      const pipelineFiles: IPipelineFile[] = cnextFiles.map((f) => ({
        path: f.path,
        discoveredFile: f,
      }));

      const input: IPipelineInput = {
        cnextFiles: pipelineFiles,
        headerFiles,
        writeOutputToDisk: true,
      };

      await this._executePipeline(input, result);

      return await this._finalizeResult(result);
    } catch (err) {
      return this._handleRunError(result, err);
    }
  }

  /**
   * Transpile source code provided as a string.
   *
   * Discovers includes from the source, builds an IPipelineInput, and
   * delegates to the same _executePipeline() as run().
   *
   * @param source - The C-Next source code as a string
   * @param options - Options for transpilation
   * @returns Promise<IFileResult> with generated code or errors
   */
  async transpileSource(
    source: string,
    options?: {
      workingDir?: string;
      includeDirs?: string[];
      sourcePath?: string;
    },
  ): Promise<IFileResult> {
    const workingDir = options?.workingDir ?? process.cwd();
    const additionalIncludeDirs = options?.includeDirs ?? [];
    const sourcePath = options?.sourcePath ?? "<string>";

    try {
      await this._initializeRun();

      const input = this._discoverFromSource(
        source,
        workingDir,
        additionalIncludeDirs,
        sourcePath,
      );

      const result = this._initResult();
      await this._executePipeline(input, result);

      // Find our main file's result
      const fileResult = result.files.find((f) => f.sourcePath === sourcePath);
      if (fileResult) {
        return fileResult;
      }

      // No file result found — pipeline exited early (e.g., parse errors in Stage 3)
      // Return pipeline errors as a file result
      if (result.errors.length > 0) {
        return this.buildErrorResult(sourcePath, result.errors, 0);
      }
      return this.buildErrorResult(
        sourcePath,
        [
          {
            line: 1,
            column: 0,
            message: "Pipeline produced no result for source file",
            severity: "error",
          },
        ],
        0,
      );
    } catch (err) {
      return this.buildCatchResult(sourcePath, err);
    }
  }

  // ===========================================================================
  // Unified Pipeline
  // ===========================================================================

  /**
   * The single unified pipeline for all transpilation.
   *
   * Both run() and transpileSource() delegate here after file discovery.
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
    this._collectAllHeaderSymbols(input.headerFiles, result);
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

    // Stage 6: Generate headers (only write to disk in run() mode)
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

      // Run analyzers (reads externalStructFields and symbolTable from CodeGenState)
      const analyzerErrors = runAnalyzers(tree, tokenStream);
      if (analyzerErrors.length > 0) {
        return this.buildErrorResult(
          sourcePath,
          analyzerErrors,
          declarationCount,
        );
      }

      // Build symbolInfo for code generation
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

      // Inject cross-file modification data for const inference
      this._setupCrossFileModifications();

      // Generate code
      const code = this.codeGenerator.generate(tree, tokenStream, {
        debugMode: this.config.debugMode,
        target: this.config.target,
        sourcePath,
        cppMode: this.cppDetected,
        symbolInfo,
      });

      // Collect user includes
      const userIncludes = IncludeExtractor.collectUserIncludes(tree);

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

      // ADR-055 Phase 7: Get TSymbols for header generation (auto-const applied during conversion)
      const fileSymbols =
        CodeGenState.symbolTable.getTSymbolsByFile(sourcePath);

      // Generate header content
      const headerCode = this.generateHeaderContent(
        fileSymbols,
        sourcePath,
        this.cppDetected,
        userIncludes,
        passByValueCopy,
        symbolInfo,
      );

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
    const mainFile: IPipelineFile = {
      path: sourcePath,
      source,
      discoveredFile: {
        path: sourcePath,
        type: EFileType.CNext,
        extension: ".cnx",
      },
      cnextIncludes: resolved.cnextIncludes,
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
    CodeGenState.callbackCompatibleFunctions = new Set();
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
   */
  private _collectAllHeaderSymbols(
    headerFiles: IDiscoveredFile[],
    result: ITranspilerResult,
  ): void {
    for (const file of headerFiles) {
      try {
        this.doCollectHeaderSymbols(file);
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
      const headerPath = this.generateHeader(file.discoveredFile);
      if (headerPath) {
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
  // Source Discovery (Stage 1 for run())
  // ===========================================================================

  /**
   * Discover C-Next files from a single input (file or directory).
   */
  private _discoverCNextFromInput(
    input: string,
    cnextFiles: IDiscoveredFile[],
    fileByPath: Map<string, IDiscoveredFile>,
  ): void {
    const resolvedInput = resolve(input);

    if (!this.fs.exists(resolvedInput)) {
      throw new Error(`Input not found: ${input}`);
    }

    const file = FileDiscovery.discoverFile(resolvedInput, this.fs);
    if (file?.type === EFileType.CNext) {
      cnextFiles.push(file);
      fileByPath.set(resolve(file.path), file);
      return;
    }

    if (file?.type !== EFileType.Unknown && file !== null) {
      // Other supported file type (direct header input) - skip for now
      return;
    }

    // It's a directory - scan for C-Next files
    const discovered = FileDiscovery.discover(
      [resolvedInput],
      { recursive: true },
      this.fs,
    );
    for (const f of FileDiscovery.getCNextFiles(discovered)) {
      cnextFiles.push(f);
      fileByPath.set(resolve(f.path), f);
    }
  }

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
  private async discoverSources(): Promise<{
    cnextFiles: IDiscoveredFile[];
    headerFiles: IDiscoveredFile[];
  }> {
    // Step 1: Discover C-Next files from inputs (files or directories)
    const cnextFiles: IDiscoveredFile[] = [];
    const fileByPath = new Map<string, IDiscoveredFile>();

    for (const input of this.config.inputs) {
      this._discoverCNextFromInput(input, cnextFiles, fileByPath);
    }

    if (cnextFiles.length === 0) {
      return { cnextFiles: [], headerFiles: [] };
    }

    // Step 2: For each C-Next file, resolve its #include directives
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

    // Resolve headers transitively for the run() path
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

    return {
      cnextFiles: sortedCnextFiles,
      headerFiles: allHeaders,
    };
  }

  // ===========================================================================
  // Header Symbol Collection
  // ===========================================================================

  /**
   * Stage 2: Collect symbols from a single C/C++ header
   * Issue #592: Recursive include processing moved to IncludeResolver.resolveHeadersTransitively()
   * SonarCloud S3776: Refactored to use helper methods for reduced complexity.
   */
  private doCollectHeaderSymbols(file: IDiscoveredFile): void {
    // Track as processed (for cycle detection)
    const absolutePath = resolve(file.path);
    this.state.markHeaderProcessed(absolutePath);

    // Check cache first
    if (this.tryRestoreFromCache(file)) {
      return; // Cache hit - skip full parsing
    }

    // Read content and parse
    const content = this.fs.readFile(file.path);
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

    // Issue #211: Still check for C++ syntax even on cache hit
    this.detectCppFromFileType(file);

    return true;
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
  private generateHeader(file: IDiscoveredFile): string | null {
    const tSymbols = CodeGenState.symbolTable.getTSymbolsByFile(file.path);
    const exportedSymbols = tSymbols.filter((s) => s.isExported);

    if (exportedSymbols.length === 0) {
      return null;
    }

    const headerName = basename(file.path).replace(/\.cnx$|\.cnext$/, ".h");
    const headerPath = this.pathResolver.getHeaderOutputPath(file);

    // Issue #220: Get SymbolCollector for full type definitions
    const typeInput = this.state.getSymbolInfo(file.path);

    // Issue #280: Get pass-by-value params from per-file storage for multi-file consistency
    // This uses the snapshot taken during transpilation, not the current (stale) codeGenerator state.
    // Fallback to empty map if not found (defensive - should always exist after transpilation).
    const passByValueParams =
      this.state.getPassByValueParams(file.path) ??
      new Map<string, Set<string>>();

    // Issue #424: Get user includes for header generation
    const userIncludes = this.state.getUserIncludes(file.path);

    // Issue #478, #588: Collect all known enum names from all files for cross-file type handling
    const allKnownEnums = TransitiveEnumCollector.aggregateKnownEnums(
      this.state.getAllSymbolInfo(),
    );

    // Issue #497: Build mapping from external types to their C header includes
    const externalTypeHeaders = ExternalTypeHeaderBuilder.build(
      this.state.getAllHeaderDirectives(),
      CodeGenState.symbolTable,
    );

    // Issue #502: Include symbolTable in typeInput for C++ namespace type detection
    const typeInputWithSymbolTable = typeInput
      ? { ...typeInput, symbolTable: CodeGenState.symbolTable }
      : undefined;

    // ADR-055 Phase 7: Convert TSymbol to IHeaderSymbol with auto-const info
    // Issue #817: Apply auto-const info same as generateHeaderContent() does
    const unmodifiedParams = this.codeGenerator.getFunctionUnmodifiedParams();
    const headerSymbols = this.convertToHeaderSymbols(
      exportedSymbols,
      unmodifiedParams,
      allKnownEnums,
    );

    const headerContent = this.headerGenerator.generate(
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
    );

    this.fs.writeFile(headerPath, headerContent);
    return headerPath;
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
   * Generate header content for exported symbols.
   * Issue #591: Extracted from transpileSource() for reduced complexity.
   * ADR-055 Phase 7: Works with TSymbol[], converts to IHeaderSymbol for generation.
   */
  private generateHeaderContent(
    tSymbols: TSymbol[],
    sourcePath: string,
    cppMode: boolean,
    userIncludes: string[],
    passByValueParams: Map<string, Set<string>>,
    symbolInfo: ICodeGenSymbols,
  ): string | undefined {
    const exportedSymbols = tSymbols.filter((s) => s.isExported);

    if (exportedSymbols.length === 0) {
      return undefined;
    }

    // Convert to IHeaderSymbol with auto-const info
    const unmodifiedParams = this.codeGenerator.getFunctionUnmodifiedParams();
    const headerSymbols = this.convertToHeaderSymbols(
      exportedSymbols,
      unmodifiedParams,
      symbolInfo.knownEnums,
    );

    const headerName = basename(sourcePath).replace(/\.cnx$|\.cnext$/, ".h");

    // Get type input from CodeGenState (for struct/enum definitions)
    const typeInput = CodeGenState.symbols;

    // Issue #497: Build mapping from external types to their C header includes
    const externalTypeHeaders = ExternalTypeHeaderBuilder.build(
      this.state.getAllHeaderDirectives(),
      CodeGenState.symbolTable,
    );

    // Issue #502: Include symbolTable in typeInput for C++ namespace type detection
    const typeInputWithSymbolTable = typeInput
      ? { ...typeInput, symbolTable: CodeGenState.symbolTable }
      : undefined;

    // Issue #478: Pass all known enums for cross-file type handling
    return this.headerGenerator.generate(
      headerSymbols,
      headerName,
      {
        exportedOnly: true,
        userIncludes,
        externalTypeHeaders,
        cppMode,
      },
      typeInputWithSymbolTable,
      passByValueParams,
      symbolInfo.knownEnums,
    );
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

      // Apply auto-const to function parameters
      if (
        symbol.kind === "function" &&
        headerSymbol.parameters &&
        headerSymbol.parameters.length > 0
      ) {
        const unmodified = unmodifiedParams.get(headerSymbol.name);
        if (unmodified) {
          // Create a mutable copy of parameters with auto-const applied
          const updatedParams = headerSymbol.parameters.map((param) => {
            const isPointerParam =
              !param.isConst &&
              !param.isArray &&
              param.type !== "f32" &&
              param.type !== "f64" &&
              param.type !== "ISR" &&
              !knownEnums.has(param.type ?? "");
            const isArrayParam = param.isArray && !param.isConst;

            if (
              (isPointerParam || isArrayParam) &&
              unmodified.has(param.name)
            ) {
              return { ...param, isAutoConst: true };
            }
            return param;
          });

          return { ...headerSymbol, parameters: updatedParams };
        }
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
    const firstInput = this.config.inputs[0];
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
