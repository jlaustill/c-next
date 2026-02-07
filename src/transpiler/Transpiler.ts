/**
 * Transpiler
 * Unified transpiler for both single-file and multi-file builds
 *
 * Key insight from ADR-053: "A single file transpilation is just a project
 * with one .cnx file."
 */

import { join, basename, dirname, resolve } from "node:path";

import IFileSystem from "./types/IFileSystem";
import NodeFileSystem from "./NodeFileSystem";

import CNextSourceParser from "./logic/parser/CNextSourceParser";
import HeaderParser from "./logic/parser/HeaderParser";

import CodeGenerator from "./output/codegen/CodeGenerator";
import HeaderGenerator from "./output/headers/HeaderGenerator";
import ExternalTypeHeaderBuilder from "./output/headers/ExternalTypeHeaderBuilder";
import ICodeGenSymbols from "./types/ICodeGenSymbols";
import IncludeExtractor from "./logic/IncludeExtractor";
import SymbolTable from "./logic/symbols/SymbolTable";
import ESymbolKind from "../utils/types/ESymbolKind";
import ISymbol from "../utils/types/ISymbol";
import CNextResolver from "./logic/symbols/cnext";
import TSymbolAdapter from "./logic/symbols/cnext/adapters/TSymbolAdapter";
import TSymbolInfoAdapter from "./logic/symbols/cnext/adapters/TSymbolInfoAdapter";
import CSymbolCollector from "./logic/symbols/CSymbolCollector";
import CppSymbolCollector from "./logic/symbols/CppSymbolCollector";
import Preprocessor from "./logic/preprocessor/Preprocessor";

import FileDiscovery from "./data/FileDiscovery";
import EFileType from "./data/types/EFileType";
import IDiscoveredFile from "./data/types/IDiscoveredFile";
import IncludeDiscovery from "./data/IncludeDiscovery";
import IncludeResolver from "./data/IncludeResolver";
import DependencyGraph from "./data/DependencyGraph";
import PathResolver from "./data/PathResolver";

import ParserUtils from "../utils/ParserUtils";
import ITranspilerConfig from "./types/ITranspilerConfig";
import ITranspilerResult from "./types/ITranspilerResult";
import IFileResult from "./types/IFileResult";
import ITranspileContext from "./types/ITranspileContext";
import ITranspileContribution from "./types/ITranspileContribution";
import TranspilerState from "./types/TranspilerState";
import runAnalyzers from "./logic/analysis/runAnalyzers";
import ModificationAnalyzer from "./logic/analysis/ModificationAnalyzer";
import AnalyzerContextBuilder from "./logic/analysis/AnalyzerContextBuilder";
import CacheManager from "../utils/cache/CacheManager";
import detectCppSyntax from "./logic/detectCppSyntax";
import AutoConstUpdater from "./logic/symbols/AutoConstUpdater";
import TransitiveEnumCollector from "./logic/symbols/TransitiveEnumCollector";
import StandaloneContextBuilder from "./logic/StandaloneContextBuilder";

/**
 * Unified transpiler
 */
class Transpiler {
  private readonly config: Required<ITranspilerConfig>;
  private readonly symbolTable: SymbolTable;
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

    this.symbolTable = new SymbolTable();
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

  /**
   * Execute the unified pipeline
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

      // Stage 2: Collect symbols from C/C++ headers
      this._collectAllHeaderSymbols(headerFiles, result);

      // Stage 3: Collect symbols from C-Next files
      if (!this._collectAllCNextSymbols(cnextFiles, result)) {
        return this._finalizeResult(result);
      }

      // Stage 3b: Resolve external const array dimensions
      this.symbolTable.resolveExternalArrayDimensions();

      // Stage 4: Check for symbol conflicts
      if (!this._checkSymbolConflicts(result)) {
        return this._finalizeResult(result);
      }

      // Stage 5: Analyze and transpile each C-Next file
      const context = this._buildTranspileContext();
      await this._transpileAllFiles(cnextFiles, context, result);

      // Stage 6: Generate headers
      if (result.success) {
        this._generateAllHeaders(cnextFiles, result);
      }

      return await this._finalizeResult(result);
    } catch (err) {
      return this._handleRunError(result, err);
    }
  }

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
    this.symbolTable.clear();
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
    const { headers: allHeaders, warnings: headerWarnings } =
      IncludeResolver.resolveHeadersTransitively(
        headerFiles,
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

    for (const file of allHeaders) {
      try {
        this.doCollectHeaderSymbols(file);
        result.filesProcessed++;
      } catch (err) {
        this.warnings.push(`Failed to process header ${file.path}: ${err}`);
      }
    }
  }

  /**
   * Stage 3: Collect symbols from all C-Next files
   * @returns true if successful, false if parse errors occurred
   */
  private _collectAllCNextSymbols(
    cnextFiles: IDiscoveredFile[],
    result: ITranspilerResult,
  ): boolean {
    for (const file of cnextFiles) {
      try {
        this.doCollectCNextSymbols(file);
      } catch (err) {
        result.errors.push({
          line: 1,
          column: 0,
          message: `Failed to collect symbols from ${file.path}: ${err}`,
          severity: "error",
        });
        result.success = false;
      }
    }
    return result.success;
  }

  /**
   * Stage 4: Check for symbol conflicts
   * @returns true if no blocking conflicts, false otherwise
   */
  private _checkSymbolConflicts(result: ITranspilerResult): boolean {
    const conflicts = this.symbolTable.getConflicts();
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
   * Build shared context for transpileSource delegation
   */
  private _buildTranspileContext(): ITranspileContext {
    return {
      symbolTable: this.symbolTable,
      symbolInfoByFile: this.state.getSymbolInfoByFileMap(),
      accumulatedModifications: this.modificationAnalyzer.getModifications(),
      accumulatedParamLists: this.modificationAnalyzer.getParamLists(),
      headerIncludeDirectives: this.state.getAllHeaderDirectives(),
      cppMode: this.cppDetected,
      includeDirs: this.config.includeDirs,
      target: this.config.target,
      debugMode: this.config.debugMode,
    };
  }

  /**
   * Stage 5: Transpile all C-Next files
   */
  private async _transpileAllFiles(
    cnextFiles: IDiscoveredFile[],
    context: ITranspileContext,
    result: ITranspilerResult,
  ): Promise<void> {
    for (const file of cnextFiles) {
      const source = this.fs.readFile(file.path);
      const fileResult = await this.transpileSource(source, {
        workingDir: dirname(file.path),
        sourcePath: file.path,
        context,
      });

      this._processFileContribution(file.path, fileResult);
      this._recordFileResult(file, fileResult, result);
    }
  }

  /**
   * Process contributions from a transpiled file
   */
  private _processFileContribution(
    filePath: string,
    fileResult: IFileResult,
  ): void {
    if (!fileResult.contribution) {
      return;
    }

    // Store symbol info for header generation
    this.state.setSymbolInfo(filePath, fileResult.contribution.symbolInfo);
    this.state.setPassByValueParams(
      filePath,
      fileResult.contribution.passByValueParams,
    );
    this.state.setUserIncludes(filePath, [
      ...fileResult.contribution.userIncludes,
    ]);

    // Issue #593: Merge C++ mode modifications via centralized analyzer
    if (fileResult.contribution.modifiedParameters) {
      this.modificationAnalyzer.accumulateModifications(
        fileResult.contribution.modifiedParameters,
      );
    }
    if (fileResult.contribution.functionParamLists) {
      this.modificationAnalyzer.accumulateParamLists(
        fileResult.contribution.functionParamLists,
      );
    }

    // Issue #588: Update symbol parameters with auto-const info
    const symbols = this.symbolTable.getSymbolsByFile(filePath);
    const unmodifiedParams = this.codeGenerator.getFunctionUnmodifiedParams();
    const knownEnums =
      this.state.getSymbolInfo(filePath)?.knownEnums ?? new Set<string>();
    AutoConstUpdater.update(symbols, unmodifiedParams, knownEnums);
  }

  /**
   * Record file result and write output
   */
  private _recordFileResult(
    file: IDiscoveredFile,
    fileResult: IFileResult,
    result: ITranspilerResult,
  ): void {
    let outputPath: string | undefined;
    if (this.config.outDir && fileResult.success && fileResult.code) {
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
   * Stage 6: Generate headers for all C-Next files
   */
  private _generateAllHeaders(
    cnextFiles: IDiscoveredFile[],
    result: ITranspilerResult,
  ): void {
    for (const file of cnextFiles) {
      const headerPath = this.generateHeader(file);
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
    result.symbolsCollected = this.symbolTable.size;
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
    resolved: { cnextIncludes: IDiscoveredFile[] },
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

    return {
      cnextFiles: sortedCnextFiles,
      headerFiles: [...headerSet.values()],
    };
  }

  /**
   * Stage 2: Collect symbols from a single C/C++ header
   * Issue #592: Recursive include processing moved to IncludeResolver.resolveHeadersTransitively()
   * SonarCloud S3776: Refactored to use helper methods for reduced complexity.
   */
  private doCollectHeaderSymbols(file: IDiscoveredFile): void {
    // Track as processed (for cycle detection in transpileSource path)
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
      const symbols = this.symbolTable.getSymbolsByFile(file.path);
      console.log(`[DEBUG]   Found ${symbols.length} symbols in ${file.path}`);
    }

    // Issue #590: Cache the results using simplified API
    if (this.cacheManager) {
      this.cacheManager.setSymbolsFromTable(file.path, this.symbolTable);
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
    this.symbolTable.addSymbols(cached.symbols);
    this.symbolTable.restoreStructFields(cached.structFields);
    this.symbolTable.restoreNeedsStructKeyword(cached.needsStructKeyword);
    this.symbolTable.restoreEnumBitWidths(cached.enumBitWidth);

    // Issue #211: Still check for C++ syntax even on cache hit
    this.detectCppFromFileType(file);

    return true;
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
   */
  private parsePureCHeader(content: string, filePath: string): void {
    const { tree } = HeaderParser.parseC(content);
    if (tree) {
      const collector = new CSymbolCollector(filePath, this.symbolTable);
      const symbols = collector.collect(tree);
      if (symbols.length > 0) {
        this.symbolTable.addSymbols(symbols);
      }
    }
  }

  /**
   * Parse a C++ header
   */
  private parseCppHeader(content: string, filePath: string): void {
    const { tree } = HeaderParser.parseCpp(content);
    if (tree) {
      const collector = new CppSymbolCollector(filePath, this.symbolTable);
      const symbols = collector.collect(tree);
      this.symbolTable.addSymbols(symbols);
    }
  }

  /**
   * Stage 3: Collect symbols from a C-Next file
   * Issue #561: Also collects modification analysis in C++ mode for unified cross-file const inference
   */
  private doCollectCNextSymbols(file: IDiscoveredFile): void {
    const content = this.fs.readFile(file.path);
    const { tree, errors } = CNextSourceParser.parse(content);

    if (errors.length > 0) {
      // Format errors with file path for better diagnostics
      const formattedErrors = errors.map(
        (e) => `${file.path}:${e.line}:${e.column} - ${e.message}`,
      );
      throw new Error(formattedErrors.join("\n"));
    }

    // ADR-055: Use composable collectors via CNextResolver + TSymbolAdapter
    // TSymbolAdapter.toISymbols registers struct fields in symbolTable for TypeResolver.isStructType()
    const tSymbols = CNextResolver.resolve(tree, file.path);
    const iSymbols = TSymbolAdapter.toISymbols(tSymbols, this.symbolTable);
    this.symbolTable.addSymbols(iSymbols);

    // Issue #465: Store ICodeGenSymbols for external enum resolution in stage 5
    // This ensures enum member info is available for all files before code generation
    const symbolInfo = TSymbolInfoAdapter.convert(tSymbols);
    this.state.setFileSymbolInfo(file.path, symbolInfo);

    // Issue #593: Collect modification analysis in C++ mode for cross-file const inference
    // This unifies behavior between run() and transpileSource() code paths
    // Issue #565: Pass accumulated cross-file data for transitive propagation
    if (this.cppDetected) {
      const results = this.codeGenerator.analyzeModificationsOnly(
        tree,
        this.modificationAnalyzer.getModifications(),
        this.modificationAnalyzer.getParamLists(),
      );

      // Issue #593: Accumulate via centralized analyzer
      this.modificationAnalyzer.accumulateResults(results);
    }
  }

  /**
   * Stage 6: Generate header file for a C-Next file
   */
  private generateHeader(file: IDiscoveredFile): string | null {
    const symbols = this.symbolTable.getSymbolsByFile(file.path);
    const exportedSymbols = symbols.filter((s) => s.isExported);

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
      this.symbolTable,
    );

    // Issue #502: Include symbolTable in typeInput for C++ namespace type detection
    const typeInputWithSymbolTable = typeInput
      ? { ...typeInput, symbolTable: this.symbolTable }
      : undefined;

    const headerContent = this.headerGenerator.generate(
      exportedSymbols,
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
   * Transpile source code provided as a string
   *
   * This method enables string-based transpilation while still parsing headers.
   * Useful for test frameworks that need header type information without reading
   * the source file from disk.
   *
   * ## Issue #634: Consolidated Code Paths
   *
   * Both run() and transpileSource() now use the same symbol collection timing:
   * symbols are collected BEFORE code generation. This eliminates the previous
   * architectural discrepancy where run() collected symbols first but standalone
   * mode collected them after.
   *
   * When called with a context (from run()), this method:
   * - Uses the shared symbol table (already populated in Stage 3)
   * - Skips header/include parsing (Steps 4a, 4b)
   * - Uses pre-collected symbolInfoByFile for enum resolution
   * - Returns ITranspileContribution in the result
   *
   * When called without context (standalone mode):
   * - Parses headers and includes via StandaloneContextBuilder
   * - Collects main file symbols BEFORE code generation (same as run())
   * - Maintains isolation between calls (symbolTable cleared each time)
   *
   * @param source - The C-Next source code as a string
   * @param options - Options for transpilation
   * @returns Promise<IFileResult> with generated code or errors
   */
  async transpileSource(
    source: string,
    options?: {
      workingDir?: string; // For resolving relative #includes
      includeDirs?: string[]; // Additional include paths
      sourcePath?: string; // Optional source path for error messages
      context?: ITranspileContext; // Cross-file context from run()
    },
  ): Promise<IFileResult> {
    const workingDir = options?.workingDir ?? process.cwd();
    const additionalIncludeDirs = options?.includeDirs ?? [];
    const sourcePath = options?.sourcePath ?? "<string>";
    const context = options?.context;

    // Determine which symbol table to use
    const symbolTable = context?.symbolTable ?? this.symbolTable;
    // Note: cppMode may be updated after header parsing in standalone mode
    let cppMode = context?.cppMode ?? this.cppDetected;

    // Used for include resolution in standalone mode
    let resolved: ReturnType<
      InstanceType<typeof IncludeResolver>["resolve"]
    > | null = null;

    try {
      // Initialize cache if enabled (skip if context provided - already done in run())
      if (!context && this.cacheManager) {
        await this.cacheManager.initialize();
      }

      // Issue #593: Clear cross-file modification tracking for fresh analysis
      // Skip if context provided - run() manages the shared accumulated state
      if (!context) {
        this.modificationAnalyzer.clear();
        // Issue #634: Reset symbol table and state for standalone mode
        // This ensures repeated standalone calls don't accumulate symbols
        this.symbolTable.clear();
        this.state.reset();
      }

      // Step 1: Build search paths using unified IncludeResolver
      const searchPaths = IncludeResolver.buildSearchPaths(
        workingDir,
        context?.includeDirs
          ? [...context.includeDirs]
          : this.config.includeDirs,
        additionalIncludeDirs,
        undefined,
        this.fs,
      );

      // Step 2: Resolve includes from source content
      const resolver = new IncludeResolver(searchPaths, this.fs);
      resolved = resolver.resolve(source, sourcePath);

      // Step 3: Collect warnings
      this.warnings.push(...resolved.warnings);

      // Steps 4a, 4b: Parse headers and C-Next includes
      // Skip when context is provided - run() has already done this in Stages 2-3
      // Issue #591: Extracted to StandaloneContextBuilder for reduced complexity
      if (!context) {
        StandaloneContextBuilder.build(this, resolved);

        // Re-capture cppMode after header parsing (may have been set to true)
        cppMode = this.cppDetected;
      }

      // Step 5: Parse C-Next source from string
      const { tree, tokenStream, errors, declarationCount } =
        CNextSourceParser.parse(source);

      // Check for parse errors
      if (errors.length > 0) {
        return this.buildErrorResult(sourcePath, errors, declarationCount);
      }

      // Parse only mode
      if (this.config.parseOnly) {
        return this.buildParseOnlyResult(sourcePath, declarationCount);
      }

      // Step 6: Run analyzers with struct field info from C/C++ headers
      // Issue #591: Struct field conversion extracted to AnalyzerContextBuilder
      const externalStructFields =
        AnalyzerContextBuilder.buildExternalStructFields(symbolTable);

      const analyzerErrors = runAnalyzers(tree, tokenStream, {
        externalStructFields,
        symbolTable,
      });
      if (analyzerErrors.length > 0) {
        return this.buildErrorResult(
          sourcePath,
          analyzerErrors,
          declarationCount,
        );
      }

      // Step 7: Generate code with symbol table
      // ADR-055 Phase 5: Create ICodeGenSymbols from TSymbol[] for CodeGenerator
      const tSymbols = CNextResolver.resolve(tree, sourcePath);
      let symbolInfo = TSymbolInfoAdapter.convert(tSymbols);

      // Issue #634: Consolidate symbol collection timing with run() path
      // In standalone mode, collect main file symbols BEFORE code generation (like run() does)
      // This eliminates the duplicate CNextResolver.resolve() call that was after generate()
      if (!context) {
        const collectedSymbols = TSymbolAdapter.toISymbols(
          tSymbols,
          symbolTable,
        );
        symbolTable.addSymbols(collectedSymbols);
      }

      // Issue #465: Merge enum info from included .cnx files (including transitive)
      // SonarCloud S3776: Extracted to collectExternalEnumSources helper
      const externalEnumSources = this.collectExternalEnumSources(
        context,
        sourcePath,
        resolved,
      );

      // Merge external enum info if any includes were found
      if (externalEnumSources.length > 0) {
        symbolInfo = TSymbolInfoAdapter.mergeExternalEnums(
          symbolInfo,
          externalEnumSources,
        );
      }

      // Issue #593: Inject cross-file modification data for const inference
      // SonarCloud S3776: Extracted to setupCrossFileModifications helper
      this.setupCrossFileModifications(context, cppMode);

      const code = this.codeGenerator.generate(tree, symbolTable, tokenStream, {
        debugMode: context?.debugMode ?? this.config.debugMode,
        target: context?.target ?? this.config.target,
        sourcePath, // Issue #230: For self-include header generation
        cppMode, // Issue #250: C++ compatible code generation
        symbolInfo, // ADR-055: Pre-collected symbol info
      });

      // Issue #461: Always generate header content
      // Collect user includes for both header generation and contribution
      const userIncludes = IncludeExtractor.collectUserIncludes(tree);

      // Get pass-by-value params (snapshot before next file clears it)
      const passByValue = this.codeGenerator.getPassByValueParams();
      const passByValueCopy = new Map<string, Set<string>>();
      for (const [funcName, params] of passByValue) {
        passByValueCopy.set(funcName, new Set(params));
      }

      // Issue #634: Symbol collection moved to before code generation (line ~905)
      // This consolidates the timing with run() path - both now collect symbols before generate()
      // Issue #461: Resolve external const array dimensions before header generation
      if (!context) {
        this.symbolTable.resolveExternalArrayDimensions();
      }

      // Issue #591: Header generation extracted to helper method
      const symbols = symbolTable.getSymbolsByFile(sourcePath);
      const headerCode = this.generateHeaderContent(
        symbols,
        sourcePath,
        symbolTable,
        cppMode,
        userIncludes,
        passByValueCopy,
        symbolInfo,
      );

      // Flush cache to disk (skip if context provided - run() handles this)
      if (!context && this.cacheManager) {
        await this.cacheManager.flush();
      }

      // Build contribution for run() to accumulate
      const contribution = context
        ? this.buildContribution(
            cppMode,
            symbolInfo,
            passByValueCopy,
            userIncludes,
          )
        : undefined;

      return this.buildSuccessResult(
        sourcePath,
        code,
        headerCode,
        declarationCount,
        contribution,
      );
    } catch (err) {
      return this.buildCatchResult(sourcePath, err);
    }
  }

  /**
   * Get the symbol table (for testing/inspection)
   */
  getSymbolTable(): SymbolTable {
    return this.symbolTable;
  }

  /**
   * Check if C++ output was detected during transpilation.
   * This is set when C++ syntax is found in included headers (e.g., Arduino.h).
   */
  isCppDetected(): boolean {
    return this.cppDetected;
  }

  // === IStandaloneTranspiler implementation (Issue #591) ===
  // These methods implement the interface used by StandaloneContextBuilder

  /** @implements IStandaloneTranspiler.collectHeaderSymbols (Issue #592: now sync) */
  collectHeaderSymbols(header: IDiscoveredFile): void {
    this.doCollectHeaderSymbols(header);
  }

  /** @implements IStandaloneTranspiler.collectCNextSymbols */
  collectCNextSymbols(cnxInclude: IDiscoveredFile): void {
    this.doCollectCNextSymbols(cnxInclude);
  }

  /** @implements IStandaloneTranspiler.getIncludeDirs */
  getIncludeDirs(): readonly string[] {
    return this.config.includeDirs;
  }

  /** @implements IStandaloneTranspiler.setHeaderIncludeDirective */
  setHeaderIncludeDirective(headerPath: string, directive: string): void {
    this.state.setHeaderDirective(headerPath, directive);
  }

  /** @implements IStandaloneTranspiler.addWarning */
  addWarning(message: string): void {
    this.warnings.push(message);
  }

  /** @implements IStandaloneTranspiler.getProcessedHeaders (Issue #592) */
  getProcessedHeaders(): Set<string> {
    return this.state.getProcessedHeadersSet();
  }

  /** @implements IStandaloneTranspiler.isDebugMode (Issue #592) */
  isDebugMode(): boolean {
    return this.config.debugMode;
  }

  // === Result builder helper methods (Issue #591) ===

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
    contribution?: ITranspileContribution,
  ): IFileResult {
    return {
      sourcePath,
      code,
      headerCode,
      success: true,
      errors: [],
      declarationCount,
      contribution,
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

  /**
   * Build the contribution object for run() to accumulate.
   */
  private buildContribution(
    cppMode: boolean,
    symbolInfo: ICodeGenSymbols,
    passByValueParams: Map<string, Set<string>>,
    userIncludes: string[],
  ): ITranspileContribution {
    let modifiedParameters: Map<string, Set<string>> | undefined;
    let functionParamLists: Map<string, readonly string[]> | undefined;

    if (cppMode) {
      const fileModifications = this.codeGenerator.getModifiedParameters();
      modifiedParameters = new Map();
      for (const [funcName, params] of fileModifications) {
        modifiedParameters.set(funcName, new Set(params));
      }

      const fileParamLists = this.codeGenerator.getFunctionParamLists();
      functionParamLists = new Map();
      for (const [funcName, params] of fileParamLists) {
        functionParamLists.set(funcName, [...params]);
      }
    }

    return {
      symbolInfo,
      passByValueParams,
      userIncludes,
      modifiedParameters,
      functionParamLists,
    };
  }

  /**
   * Generate header content for exported symbols.
   * Issue #591: Extracted from transpileSource() for reduced complexity.
   */
  private generateHeaderContent(
    symbols: ISymbol[],
    sourcePath: string,
    symbolTable: SymbolTable,
    cppMode: boolean,
    userIncludes: string[],
    passByValueParams: Map<string, Set<string>>,
    symbolInfo: ICodeGenSymbols,
  ): string | undefined {
    const exportedSymbols = symbols.filter(
      (s: { isExported?: boolean }) => s.isExported,
    );

    if (exportedSymbols.length === 0) {
      return undefined;
    }

    const headerName = basename(sourcePath).replace(/\.cnx$|\.cnext$/, ".h");

    // Get type input from code generator (for struct/enum definitions)
    const typeInput = this.codeGenerator.symbols;

    // Update auto-const info on symbol parameters
    const unmodifiedParams = this.codeGenerator.getFunctionUnmodifiedParams();
    for (const symbol of symbols) {
      if (symbol.kind !== ESymbolKind.Function || !symbol.parameters) {
        continue;
      }
      const unmodified = unmodifiedParams.get(symbol.name);
      if (!unmodified) continue;

      for (const param of symbol.parameters) {
        const isPointerParam =
          !param.isConst &&
          !param.isArray &&
          param.type !== "f32" &&
          param.type !== "f64" &&
          param.type !== "ISR";
        if (isPointerParam && unmodified.has(param.name)) {
          param.isAutoConst = true;
        }
      }
    }

    // Issue #497: Build mapping from external types to their C header includes
    const externalTypeHeaders = ExternalTypeHeaderBuilder.build(
      this.state.getAllHeaderDirectives(),
      symbolTable,
    );

    // Issue #502: Include symbolTable in typeInput for C++ namespace type detection
    const typeInputWithSymbolTable = typeInput
      ? { ...typeInput, symbolTable }
      : undefined;

    // Issue #478: Pass all known enums for cross-file type handling
    // This includes enums from this file and all transitively included .cnx files
    return this.headerGenerator.generate(
      exportedSymbols,
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
   * Collect external enum sources from included C-Next files.
   * SonarCloud S3776: Extracted from transpileSource() for reduced complexity.
   */
  private collectExternalEnumSources(
    context: ITranspileContext | undefined,
    sourcePath: string,
    resolved: ReturnType<
      InstanceType<typeof IncludeResolver>["resolve"]
    > | null,
  ): ICodeGenSymbols[] {
    const symbolInfoByFile =
      context?.symbolInfoByFile ?? this.state.getSymbolInfoByFileMap();

    if (context) {
      // Context mode: use TransitiveEnumCollector with pre-populated symbolInfoByFile
      return TransitiveEnumCollector.collect(
        sourcePath,
        this.state.getSymbolInfoByFileMap(),
        this.config.includeDirs,
      );
    }

    if (resolved) {
      // Standalone mode: use unified collectForStandalone method
      return TransitiveEnumCollector.collectForStandalone(
        resolved.cnextIncludes,
        symbolInfoByFile,
        this.config.includeDirs,
      );
    }

    return [];
  }

  /**
   * Setup cross-file modification tracking for const inference.
   * SonarCloud S3776: Extracted from transpileSource() for reduced complexity.
   */
  private setupCrossFileModifications(
    context: ITranspileContext | undefined,
    cppMode: boolean,
  ): void {
    const accumulatedModifications =
      context?.accumulatedModifications ??
      this.modificationAnalyzer.getModifications();
    const accumulatedParamLists =
      context?.accumulatedParamLists ??
      this.modificationAnalyzer.getParamLists();

    if (cppMode && accumulatedModifications.size > 0) {
      this.codeGenerator.setCrossFileModifications(
        accumulatedModifications,
        accumulatedParamLists,
      );
    }
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
