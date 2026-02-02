/**
 * Transpiler
 * Unified transpiler for both single-file and multi-file builds
 *
 * Key insight from ADR-053: "A single file transpilation is just a project
 * with one .cnx file."
 */

import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  statSync,
} from "node:fs";
import { join, basename, dirname, resolve } from "node:path";

import { ProgramContext } from "./logic/parser/grammar/CNextParser";
import CNextSourceParser from "./logic/parser/CNextSourceParser";
import HeaderParser from "./logic/parser/HeaderParser";

import CodeGenerator from "./output/codegen/CodeGenerator";
import HeaderGenerator from "./output/headers/HeaderGenerator";
import ICodeGenSymbols from "./types/ICodeGenSymbols";
import SymbolTable from "./logic/symbols/SymbolTable";
import ESymbolKind from "../utils/types/ESymbolKind";
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
import PathResolver from "./data/PathResolver";

import ITranspilerConfig from "./types/ITranspilerConfig";
import ITranspilerResult from "./types/ITranspilerResult";
import IFileResult from "./types/IFileResult";
import ITranspileContext from "./types/ITranspileContext";
import ITranspileContribution from "./types/ITranspileContribution";
import runAnalyzers from "./logic/analysis/runAnalyzers";
import ModificationAnalyzer from "./logic/analysis/ModificationAnalyzer";
import CacheManager from "../utils/cache/CacheManager";
import detectCppSyntax from "./logic/detectCppSyntax";
import AutoConstUpdater from "./logic/symbols/AutoConstUpdater";
import TransitiveEnumCollector from "./logic/symbols/TransitiveEnumCollector";

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
  /** Issue #220: Store ICodeGenSymbols per file for header generation (ADR-055) */
  private readonly symbolCollectors: Map<string, ICodeGenSymbols> = new Map();
  /** Issue #321: Track processed headers to avoid cycles during recursive include resolution */
  private readonly processedHeaders: Set<string> = new Set();
  /** Issue #280: Store pass-by-value params per file for header generation */
  private readonly passByValueParamsCollectors: Map<
    string,
    ReadonlyMap<string, ReadonlySet<string>>
  > = new Map();
  /** Issue #424: Store user includes per file for header generation */
  private readonly userIncludesCollectors: Map<string, string[]> = new Map();
  /** Issue #465: Store ICodeGenSymbols per file during stage 3 for external enum resolution */
  private readonly symbolInfoByFile: Map<string, ICodeGenSymbols> = new Map();
  /**
   * Issue #497: Map resolved header paths to their include directives.
   * Used to include C headers in generated .h files instead of forward-declaring types.
   */
  private readonly headerIncludeDirectives: Map<string, string> = new Map();
  /**
   * Issue #593: Centralized analyzer for cross-file const inference in C++ mode.
   * Accumulates parameter modifications and param lists across all processed files.
   */
  private readonly modificationAnalyzer = new ModificationAnalyzer();
  /** Issue #586: Centralized path resolution for output files */
  private readonly pathResolver: PathResolver;

  constructor(config: ITranspilerConfig) {
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
    this.pathResolver = new PathResolver({
      inputs: this.config.inputs,
      outDir: this.config.outDir,
      headerOutDir: this.config.headerOutDir,
      basePath: this.config.basePath,
    });

    // Initialize cache manager if caching is enabled
    this.cacheManager = this.config.noCache
      ? null
      : new CacheManager(this.determineProjectRoot());
  }

  /**
   * Execute the unified pipeline
   */
  async run(): Promise<ITranspilerResult> {
    const result: ITranspilerResult = {
      success: true,
      files: [],
      filesProcessed: 0,
      symbolsCollected: 0,
      conflicts: [],
      errors: [],
      warnings: [],
      outputFiles: [],
    };

    try {
      // Initialize cache if enabled
      if (this.cacheManager) {
        await this.cacheManager.initialize();
      }

      // Issue #593: Reset cross-file modification tracking for new run
      this.modificationAnalyzer.clear();

      // Stage 1: Discover source files
      const { cnextFiles, headerFiles } = await this.discoverSources();

      if (cnextFiles.length === 0) {
        result.warnings.push("No C-Next source files found");
        result.warnings = [...result.warnings, ...this.warnings];
        return result;
      }

      // Issue #558: Sort files by dependency order for correct cross-file const inference.
      // Files that are included by others should be processed first so their
      // parameter modifications are available during transitive propagation.
      // Simple heuristic: reverse the discovery order since includes are added
      // after the files that include them.
      if (this.cppDetected) {
        cnextFiles.reverse();
      }

      // Ensure output directory exists if specified
      if (this.config.outDir && !existsSync(this.config.outDir)) {
        mkdirSync(this.config.outDir, { recursive: true });
      }

      // Ensure header output directory exists if specified separately
      if (this.config.headerOutDir && !existsSync(this.config.headerOutDir)) {
        mkdirSync(this.config.headerOutDir, { recursive: true });
      }

      // Stage 2: Collect symbols from C/C++ headers
      for (const file of headerFiles) {
        try {
          await this.collectHeaderSymbols(file);
          result.filesProcessed++;
        } catch (err) {
          this.warnings.push(`Failed to process header ${file.path}: ${err}`);
        }
      }

      // Stage 3: Collect symbols from C-Next files
      for (const file of cnextFiles) {
        try {
          this.collectCNextSymbols(file);
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

      // If there are parse errors, stop here
      if (!result.success) {
        result.warnings = [...result.warnings, ...this.warnings];
        return result;
      }

      // Stage 3b: Issue #461 - Resolve external const array dimensions
      // Now that all symbols are collected, resolve any unresolved array dimensions
      // that reference external constants from included .cnx files
      this.symbolTable.resolveExternalArrayDimensions();

      // Stage 4: Check for symbol conflicts
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
        result.warnings = [...result.warnings, ...this.warnings];
        return result;
      }

      // Build shared context after Stage 4 for transpileSource delegation
      const transpileContext: ITranspileContext = {
        symbolTable: this.symbolTable,
        symbolInfoByFile: this.symbolInfoByFile,
        accumulatedModifications: this.modificationAnalyzer.getModifications(),
        accumulatedParamLists: this.modificationAnalyzer.getParamLists(),
        headerIncludeDirectives: this.headerIncludeDirectives,
        cppMode: this.cppDetected,
        includeDirs: this.config.includeDirs,
        target: this.config.target,
        debugMode: this.config.debugMode,
      };

      // Stage 5: Analyze and transpile each C-Next file via transpileSource
      for (const file of cnextFiles) {
        const source = readFileSync(file.path, "utf-8");
        const fileResult = await this.transpileSource(source, {
          workingDir: dirname(file.path),
          sourcePath: file.path,
          context: transpileContext,
        });

        // Accumulate contributions from this file
        if (fileResult.contribution) {
          // Store symbol info for header generation
          this.symbolCollectors.set(
            file.path,
            fileResult.contribution.symbolInfo,
          );
          this.passByValueParamsCollectors.set(
            file.path,
            fileResult.contribution.passByValueParams,
          );
          this.userIncludesCollectors.set(file.path, [
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

          // Issue #588: Update symbol parameters with auto-const info for header generation
          const symbols = this.symbolTable.getSymbolsByFile(file.path);
          const unmodifiedParams =
            this.codeGenerator.getFunctionUnmodifiedParams();
          const knownEnums =
            this.symbolCollectors.get(file.path)?.knownEnums ??
            new Set<string>();
          AutoConstUpdater.update(symbols, unmodifiedParams, knownEnums);
        }

        // Write output file if output directory specified
        let outputPath: string | undefined;
        if (this.config.outDir && fileResult.success && fileResult.code) {
          outputPath = this.pathResolver.getOutputPath(file, this.cppDetected);
          writeFileSync(outputPath, fileResult.code, "utf-8");
        }

        result.files.push({
          ...fileResult,
          outputPath,
        });
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

      // Stage 6: Generate headers (always - Issue #461)
      if (result.success) {
        for (const file of cnextFiles) {
          const headerPath = this.generateHeader(file);
          if (headerPath) {
            result.outputFiles.push(headerPath);
          }
        }
      }

      result.symbolsCollected = this.symbolTable.size;
      result.warnings = [...result.warnings, ...this.warnings];

      // Flush cache to disk
      if (this.cacheManager) {
        await this.cacheManager.flush();
      }
    } catch (err) {
      result.errors.push({
        line: 1,
        column: 0,
        message: `Pipeline failed: ${err}`,
        severity: "error",
      });
      result.success = false;
      result.warnings = [...result.warnings, ...this.warnings];
    }

    return result;
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

    for (const input of this.config.inputs) {
      const resolvedInput = resolve(input);

      if (!existsSync(resolvedInput)) {
        throw new Error(`Input not found: ${input}`);
      }

      const file = FileDiscovery.discoverFile(resolvedInput);
      if (file?.type === EFileType.CNext) {
        // It's a C-Next file
        cnextFiles.push(file);
      } else if (file?.type !== EFileType.Unknown && file !== null) {
        // It's another supported file type (direct header input)
        // Skip for now - we only want C-Next sources here
      } else {
        // It's a directory - scan for C-Next files
        const discovered = FileDiscovery.discover([resolvedInput], {
          recursive: true,
        });
        cnextFiles.push(...FileDiscovery.getCNextFiles(discovered));
      }
    }

    if (cnextFiles.length === 0) {
      return { cnextFiles: [], headerFiles: [] };
    }

    // Step 2: For each C-Next file, resolve its #include directives
    const headerSet = new Map<string, IDiscoveredFile>();

    // Build set of base names from C-Next files to exclude generated headers
    const cnextBaseNames = new Set(
      cnextFiles.map((f) => basename(f.path).replace(/\.cnx$|\.cnext$/, "")),
    );

    for (const cnxFile of cnextFiles) {
      const content = readFileSync(cnxFile.path, "utf-8");

      // Build search paths for this file
      const sourceDir = dirname(cnxFile.path);
      const additionalIncludeDirs = IncludeDiscovery.discoverIncludePaths(
        cnxFile.path,
      );
      const searchPaths = IncludeResolver.buildSearchPaths(
        sourceDir,
        this.config.includeDirs,
        additionalIncludeDirs,
      );

      // Resolve includes
      const resolver = new IncludeResolver(searchPaths);
      const resolved = resolver.resolve(content, cnxFile.path);

      // Collect headers, filtering out generated ones
      for (const header of resolved.headers) {
        const headerBaseName = basename(header.path).replace(
          /\.h$|\.hpp$|\.hxx$|\.hh$/,
          "",
        );
        if (!cnextBaseNames.has(headerBaseName)) {
          headerSet.set(header.path, header);
          // Issue #497: Store the include directive for this header
          const directive = resolved.headerIncludeDirectives.get(header.path);
          if (directive) {
            this.headerIncludeDirectives.set(header.path, directive);
          }
        }
      }

      // Issue #461: Collect included .cnx files for symbol resolution
      // This ensures constants from included .cnx files are available for array dimension resolution
      for (const cnxInclude of resolved.cnextIncludes) {
        const includePath = resolve(cnxInclude.path);
        const includeBaseName = basename(includePath).replace(
          /\.cnx$|\.cnext$/,
          "",
        );
        // Don't add if already in the list (by base name comparison)
        if (
          !cnextBaseNames.has(includeBaseName) &&
          !cnextFiles.some((f) => resolve(f.path) === includePath)
        ) {
          cnextFiles.push(cnxInclude);
          cnextBaseNames.add(includeBaseName);
        }
      }

      // Collect warnings
      this.warnings.push(...resolved.warnings);
    }

    return { cnextFiles, headerFiles: [...headerSet.values()] };
  }

  /**
   * Stage 2: Collect symbols from C/C++ headers
   * Issue #321: Now recursively processes #include directives to handle
   * nested headers (e.g., Arduino's HardwareSerial.h including Stream.h)
   */
  private async collectHeaderSymbols(file: IDiscoveredFile): Promise<void> {
    // Issue #321: Check if already processed to avoid cycles
    const absolutePath = resolve(file.path);
    if (this.processedHeaders.has(absolutePath)) {
      return;
    }
    this.processedHeaders.add(absolutePath);

    // Check cache first
    if (this.cacheManager?.isValid(file.path)) {
      const cached = this.cacheManager.getSymbols(file.path);
      if (cached) {
        // Restore symbols, struct fields, needsStructKeyword, and enumBitWidth from cache
        this.symbolTable.addSymbols(cached.symbols);
        this.symbolTable.restoreStructFields(cached.structFields);
        this.symbolTable.restoreNeedsStructKeyword(cached.needsStructKeyword);
        this.symbolTable.restoreEnumBitWidths(cached.enumBitWidth);

        // Issue #211: Still check for C++ syntax even on cache hit
        // The detection is cheap (regex only) and ensures cppDetected is set correctly
        if (file.type === EFileType.CHeader) {
          const content = readFileSync(file.path, "utf-8");
          if (detectCppSyntax(content)) {
            this.cppDetected = true;
          }
        } else if (file.type === EFileType.CppHeader) {
          // .hpp files are always C++
          this.cppDetected = true;
        }

        return; // Cache hit - skip full parsing
      }
    }

    // Issue #321: Read original content FIRST to extract includes before preprocessing
    // The preprocessor expands/removes #include directives, so we need the original
    const originalContent = readFileSync(file.path, "utf-8");

    // Issue #328: Skip headers generated by C-Next Transpiler
    // During incremental migration, generated .h files may be discovered via #include
    // recursion from C++ files. These headers contain the same symbols as their .cnx
    // source files, so including them would cause false symbol conflicts.
    if (originalContent.includes("Generated by C-Next Transpiler")) {
      if (this.config.debugMode) {
        console.log(`[DEBUG]   Skipping C-Next generated header: ${file.path}`);
      }
      return;
    }

    // Issue #321: Recursively process #include directives in headers
    // This ensures symbols from nested headers (like Arduino's extern HardwareSerial Serial)
    // are properly collected even when included transitively
    const includes = IncludeDiscovery.extractIncludesWithInfo(originalContent);
    const headerDir = dirname(absolutePath);
    const searchPaths = [headerDir, ...this.config.includeDirs];

    if (this.config.debugMode) {
      console.log(`[DEBUG] Processing includes in ${file.path}:`);
      console.log(`[DEBUG]   Search paths: ${searchPaths.join(", ")}`);
    }

    for (const includeInfo of includes) {
      const resolved = IncludeDiscovery.resolveInclude(
        includeInfo.path,
        searchPaths,
      );
      if (this.config.debugMode) {
        console.log(
          `[DEBUG]   #include "${includeInfo.path}" → ${resolved || "NOT FOUND"}`,
        );
      }
      if (resolved) {
        const includedFile = FileDiscovery.discoverFile(resolved);
        if (
          includedFile &&
          (includedFile.type === EFileType.CHeader ||
            includedFile.type === EFileType.CppHeader)
        ) {
          if (this.config.debugMode) {
            console.log(
              `[DEBUG]     → Recursively processing ${includedFile.path}`,
            );
          }
          await this.collectHeaderSymbols(includedFile);
        }
      } else if (includeInfo.isLocal) {
        // Issue #355: Warn when local includes can't be resolved
        // This helps users diagnose missing struct type information
        this.warnings.push(
          `Warning: #include "${includeInfo.path}" not found (from ${file.path}). ` +
            `Struct field types from this header will not be detected.`,
        );
      }
    }

    // Issue #321: Parse with ORIGINAL content, not preprocessed content
    // The preprocessor expands includes and can lose class definitions.
    // We need the original content to properly detect C++ syntax and parse classes.
    // Note: Preprocessing was previously done here but is no longer needed for symbol collection.

    // Parse based on file type
    if (file.type === EFileType.CHeader) {
      if (this.config.debugMode) {
        console.log(`[DEBUG]   Parsing C header: ${file.path}`);
      }
      this.parseCHeader(originalContent, file.path);
    } else if (file.type === EFileType.CppHeader) {
      // Issue #211: .hpp files are always C++
      this.cppDetected = true;
      if (this.config.debugMode) {
        console.log(`[DEBUG]   Parsing C++ header: ${file.path}`);
      }
      this.parseCppHeader(originalContent, file.path);
    }

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
  private collectCNextSymbols(file: IDiscoveredFile): void {
    const content = readFileSync(file.path, "utf-8");
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
    this.symbolInfoByFile.set(file.path, symbolInfo);

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
   * Issue #465: Collect ICodeGenSymbols from all transitively included .cnx files.
   *
   * Recursively resolves includes to gather enum info from the entire include tree.
   * This ensures that deeply nested enums (A includes B, B includes C with enum)
   * are available for prefixing in the top-level file.
   *
   * @param filePath The file to collect transitive includes for
   * @returns Array of ICodeGenSymbols from all transitively included .cnx files
   */
  private collectTransitiveEnumInfo(filePath: string): ICodeGenSymbols[] {
    const result: ICodeGenSymbols[] = [];
    const visited = new Set<string>();

    const collectRecursively = (currentPath: string): void => {
      if (visited.has(currentPath)) return;
      visited.add(currentPath);

      // Read and parse includes from current file
      const content = readFileSync(currentPath, "utf-8");
      const searchPaths = IncludeResolver.buildSearchPaths(
        dirname(currentPath),
        this.config.includeDirs,
        [],
      );
      const resolver = new IncludeResolver(searchPaths);
      const resolved = resolver.resolve(content, currentPath);

      // Process each included .cnx file
      for (const cnxInclude of resolved.cnextIncludes) {
        const externalInfo = this.symbolInfoByFile.get(cnxInclude.path);
        if (externalInfo) {
          result.push(externalInfo);
        }
        // Recursively collect from this include's includes
        collectRecursively(cnxInclude.path);
      }
    };

    collectRecursively(filePath);
    return result;
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
    const typeInput = this.symbolCollectors.get(file.path);

    // Issue #280: Get pass-by-value params from per-file storage for multi-file consistency
    // This uses the snapshot taken during transpilation, not the current (stale) codeGenerator state.
    // Fallback to empty map if not found (defensive - should always exist after transpilation).
    const passByValueParams =
      this.passByValueParamsCollectors.get(file.path) ??
      new Map<string, Set<string>>();

    // Issue #424: Get user includes for header generation
    const userIncludes = this.userIncludesCollectors.get(file.path) ?? [];

    // Issue #478, #588: Collect all known enum names from all files for cross-file type handling
    const allKnownEnums = TransitiveEnumCollector.aggregateKnownEnums(
      this.symbolCollectors.values(),
    );

    // Issue #497: Build mapping from external types to their C header includes
    const externalTypeHeaders = this.buildExternalTypeHeaders();

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

    writeFileSync(headerPath, headerContent, "utf-8");
    return headerPath;
  }

  /**
   * Issue #424, #461, #478: Collect user includes from parse tree for header generation.
   *
   * Extracts #include directives for .cnx files and transforms them to .h includes.
   * This enables cross-file type definitions in generated headers.
   *
   * @param tree The parsed C-Next program
   * @returns Array of transformed include strings (e.g., '#include "types.h"')
   */
  private collectUserIncludes(tree: ProgramContext): string[] {
    const userIncludes: string[] = [];
    for (const includeDir of tree.includeDirective()) {
      const includeText = includeDir.getText();
      // Include both quoted ("...") and angle-bracket (<...>) .cnx includes
      // These define types used in function signatures that need to be in the header
      if (includeText.includes(".cnx")) {
        // Transform .cnx includes to .h (the generated header for the included .cnx file)
        const transformedInclude = includeText
          .replace(/\.cnx"/, '.h"')
          .replace(/\.cnx>/, ".h>");
        userIncludes.push(transformedInclude);
      }
    }
    return userIncludes;
  }

  /**
   * Issue #497: Build a map from external type names to their C header include directives.
   * This enables header generation to include the original C headers instead of
   * generating conflicting forward declarations for types like anonymous struct typedefs.
   */
  private buildExternalTypeHeaders(): Map<string, string> {
    const typeHeaders = new Map<string, string>();

    // Check each header we have an include directive for
    for (const [headerPath, directive] of this.headerIncludeDirectives) {
      // Get all symbols defined in this header
      const symbols = this.symbolTable.getSymbolsByFile(headerPath);

      // Map each struct/type/enum name to the include directive
      for (const sym of symbols) {
        if (
          sym.kind === ESymbolKind.Struct ||
          sym.kind === ESymbolKind.Type ||
          sym.kind === ESymbolKind.Enum ||
          sym.kind === ESymbolKind.Class
        ) {
          // Only add if we don't already have a mapping (first include wins)
          if (!typeHeaders.has(sym.name)) {
            typeHeaders.set(sym.name, directive);
          }
        }
      }
    }

    return typeHeaders;
  }

  /**
   * Transpile source code provided as a string
   *
   * This method enables string-based transpilation while still parsing headers.
   * Useful for test frameworks that need header type information without reading
   * the source file from disk.
   *
   * When called with a context (from run()), this method:
   * - Uses the shared symbol table (already populated)
   * - Skips header/include parsing (Steps 4a, 4b)
   * - Uses pre-collected symbolInfoByFile for enum resolution
   * - Returns ITranspileContribution in the result
   *
   * When called without context (standalone mode):
   * - Maintains backwards compatibility with existing test framework usage
   * - Parses headers and includes from scratch
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
      }

      // Step 1: Build search paths using unified IncludeResolver
      const searchPaths = IncludeResolver.buildSearchPaths(
        workingDir,
        context?.includeDirs
          ? [...context.includeDirs]
          : this.config.includeDirs,
        additionalIncludeDirs,
      );

      // Step 2: Resolve includes from source content
      const resolver = new IncludeResolver(searchPaths);
      resolved = resolver.resolve(source, sourcePath);

      // Step 3: Collect warnings
      this.warnings.push(...resolved.warnings);

      // Steps 4a, 4b: Parse headers and C-Next includes
      // Skip when context is provided - run() has already done this in Stages 2-3
      if (!context) {
        // Step 4a: Parse C/C++ headers to populate symbol table
        for (const header of resolved.headers) {
          try {
            await this.collectHeaderSymbols(header);
            // Issue #497: Store the include directive for this header
            const directive = resolved.headerIncludeDirectives.get(header.path);
            if (directive) {
              this.headerIncludeDirectives.set(header.path, directive);
            }
          } catch (err) {
            this.warnings.push(
              `Failed to process header ${header.path}: ${err}`,
            );
          }
        }

        // Step 4b: Issue #294 - Parse C-Next includes to populate symbol table
        // This enables cross-file scope references (e.g., decoder.getSpn() -> decoder_getSpn())
        // Issue #465: Recursively process transitive includes for enum info
        const processedCnxIncludes = new Set<string>();
        const processCnxIncludesRecursively = (
          includes: IDiscoveredFile[],
        ): void => {
          for (const cnxInclude of includes) {
            if (processedCnxIncludes.has(cnxInclude.path)) continue;
            processedCnxIncludes.add(cnxInclude.path);

            try {
              this.collectCNextSymbols(cnxInclude);

              // Recursively process this include's includes
              const nestedContent = readFileSync(cnxInclude.path, "utf-8");
              const nestedSearchPaths = IncludeResolver.buildSearchPaths(
                dirname(cnxInclude.path),
                this.config.includeDirs,
                [],
              );
              const nestedResolver = new IncludeResolver(nestedSearchPaths);
              const nestedResolved = nestedResolver.resolve(
                nestedContent,
                cnxInclude.path,
              );
              processCnxIncludesRecursively(nestedResolved.cnextIncludes);
            } catch (err) {
              this.warnings.push(
                `Failed to process C-Next include ${cnxInclude.path}: ${err}`,
              );
            }
          }
        };
        processCnxIncludesRecursively(resolved.cnextIncludes);

        // Re-capture cppMode after header parsing (may have been set to true)
        cppMode = this.cppDetected;
      }

      // Step 5: Parse C-Next source from string
      const { tree, tokenStream, errors, declarationCount } =
        CNextSourceParser.parse(source);

      // Check for parse errors
      if (errors.length > 0) {
        return {
          sourcePath,
          code: "",
          success: false,
          errors,
          declarationCount,
        };
      }

      // Parse only mode
      if (this.config.parseOnly) {
        return {
          sourcePath,
          code: "",
          success: true,
          errors: [],
          declarationCount,
        };
      }

      // Step 6: Run analyzers with struct field info from C/C++ headers
      // Convert struct fields from IStructFieldInfo map to Set<string> for analyzer
      // Issue #355: Exclude array fields from init checking since the analyzer
      // can't prove loop-based array initialization is complete. This maintains
      // backward compatibility while still allowing array field detection for codegen.
      const externalStructFields = new Map<string, Set<string>>();
      const allStructFields = symbolTable.getAllStructFields();
      for (const [structName, fieldMap] of allStructFields) {
        const nonArrayFields = new Set<string>();
        for (const [fieldName, fieldInfo] of fieldMap) {
          // Only include non-array fields in init checking
          if (
            !fieldInfo.arrayDimensions ||
            fieldInfo.arrayDimensions.length === 0
          ) {
            nonArrayFields.add(fieldName);
          }
        }
        if (nonArrayFields.size > 0) {
          externalStructFields.set(structName, nonArrayFields);
        }
      }

      const analyzerErrors = runAnalyzers(tree, tokenStream, {
        externalStructFields,
        symbolTable,
      });
      if (analyzerErrors.length > 0) {
        return {
          sourcePath,
          code: "",
          success: false,
          errors: analyzerErrors,
          declarationCount,
        };
      }

      // Step 7: Generate code with symbol table
      // ADR-055 Phase 5: Create ICodeGenSymbols from TSymbol[] for CodeGenerator
      const tSymbols = CNextResolver.resolve(tree, sourcePath);
      let symbolInfo = TSymbolInfoAdapter.convert(tSymbols);

      // Issue #465: Merge enum info from included .cnx files (including transitive)
      // This enables external enum member references to get the correct type prefix
      const externalEnumSources: ICodeGenSymbols[] = [];

      // Use context.symbolInfoByFile when provided, otherwise use this.symbolInfoByFile
      const symbolInfoByFile =
        context?.symbolInfoByFile ?? this.symbolInfoByFile;

      if (context) {
        // Issue #588: When context is provided, use TransitiveEnumCollector
        // This is more efficient as run() has already populated symbolInfoByFile
        const transitiveInfo = TransitiveEnumCollector.collect(
          sourcePath,
          this.symbolInfoByFile,
          this.config.includeDirs,
        );
        externalEnumSources.push(...transitiveInfo);
      } else if (resolved) {
        // Standalone mode: recursively collect enum info from all transitive includes
        const visitedIncludes = new Set<string>();
        const collectFromIncludes = (includes: IDiscoveredFile[]): void => {
          for (const cnxInclude of includes) {
            if (visitedIncludes.has(cnxInclude.path)) continue;
            visitedIncludes.add(cnxInclude.path);

            const externalInfo = symbolInfoByFile.get(cnxInclude.path);
            if (externalInfo) {
              externalEnumSources.push(externalInfo);
            }

            // Recursively process this include's includes
            const nestedContent = readFileSync(cnxInclude.path, "utf-8");
            const nestedSearchPaths = IncludeResolver.buildSearchPaths(
              dirname(cnxInclude.path),
              this.config.includeDirs,
              [],
            );
            const nestedResolver = new IncludeResolver(nestedSearchPaths);
            const nestedResolved = nestedResolver.resolve(
              nestedContent,
              cnxInclude.path,
            );
            collectFromIncludes(nestedResolved.cnextIncludes);
          }
        };

        collectFromIncludes(resolved.cnextIncludes);
      }

      // Merge external enum info if any includes were found
      if (externalEnumSources.length > 0) {
        symbolInfo = TSymbolInfoAdapter.mergeExternalEnums(
          symbolInfo,
          externalEnumSources,
        );
      }

      // Issue #593: Inject cross-file modification data for const inference
      // When context is provided, use its accumulated data; otherwise use the analyzer
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

      const code = this.codeGenerator.generate(tree, symbolTable, tokenStream, {
        debugMode: context?.debugMode ?? this.config.debugMode,
        target: context?.target ?? this.config.target,
        sourcePath, // Issue #230: For self-include header generation
        cppMode, // Issue #250: C++ compatible code generation
        symbolInfo, // ADR-055: Pre-collected symbol info
      });

      // Issue #461: Always generate header content
      let headerCode: string | undefined;
      // Collect user includes for both header generation and contribution
      const userIncludes = this.collectUserIncludes(tree);

      // Get pass-by-value params (snapshot before next file clears it)
      const passByValue = this.codeGenerator.getPassByValueParams();
      const passByValueCopy = new Map<string, Set<string>>();
      for (const [funcName, params] of passByValue) {
        passByValueCopy.set(funcName, new Set(params));
      }

      {
        // Issue #424/ADR-055: Collect symbols from main source file AFTER code generation
        // This must happen after generate() to avoid interfering with type resolution
        // Skip when context is provided - run() already added symbols in Stage 3
        if (!context) {
          const tSymbols = CNextResolver.resolve(tree, sourcePath);
          const collectedSymbols = TSymbolAdapter.toISymbols(
            tSymbols,
            symbolTable,
          );
          symbolTable.addSymbols(collectedSymbols);

          // Issue #461: Resolve external const array dimensions before header generation
          this.symbolTable.resolveExternalArrayDimensions();
        }

        const symbols = symbolTable.getSymbolsByFile(sourcePath);
        const exportedSymbols = symbols.filter(
          (s: { isExported?: boolean }) => s.isExported,
        );

        if (exportedSymbols.length > 0) {
          const headerName = basename(sourcePath).replace(
            /\.cnx$|\.cnext$/,
            ".h",
          );

          // Get type input from code generator (for struct/enum definitions)
          const typeInput = this.codeGenerator.symbols ?? undefined;

          // Update auto-const info on symbol parameters
          const unmodifiedParams =
            this.codeGenerator.getFunctionUnmodifiedParams();
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
          const externalTypeHeaders = this.buildExternalTypeHeaders();

          // Issue #502: Include symbolTable in typeInput for C++ namespace type detection
          const typeInputWithSymbolTable = typeInput
            ? { ...typeInput, symbolTable }
            : undefined;

          // Issue #478: Pass all known enums for cross-file type handling
          // This includes enums from this file and all transitively included .cnx files
          headerCode = this.headerGenerator.generate(
            exportedSymbols,
            headerName,
            {
              exportedOnly: true,
              userIncludes,
              externalTypeHeaders,
              cppMode,
            },
            typeInputWithSymbolTable,
            passByValueCopy,
            symbolInfo.knownEnums,
          );
        }
      }

      // Flush cache to disk (skip if context provided - run() handles this)
      if (!context && this.cacheManager) {
        await this.cacheManager.flush();
      }

      // Build contribution for run() to accumulate
      let contribution: ITranspileContribution | undefined;
      if (context) {
        // Collect modifications for C++ mode
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

        contribution = {
          symbolInfo,
          passByValueParams: passByValueCopy,
          userIncludes,
          modifiedParameters,
          functionParamLists,
        };
      }

      return {
        sourcePath,
        code,
        headerCode,
        success: true,
        errors: [],
        declarationCount,
        contribution,
      };
    } catch (err) {
      // Match error format from original transpile function
      const errorMessage = err instanceof Error ? err.message : String(err);
      return {
        sourcePath,
        code: "",
        success: false,
        errors: [
          {
            line: 1,
            column: 0,
            message: `Code generation failed: ${errorMessage}`,
            severity: "error",
          },
        ],
        declarationCount: 0,
      };
    }
  }

  /**
   * Get the symbol table (for testing/inspection)
   */
  getSymbolTable(): SymbolTable {
    return this.symbolTable;
  }

  /**
   * Determine the project root directory for cache storage
   * Uses first input's directory, walking up to find existing .cnx/ or config
   */
  private determineProjectRoot(): string {
    // Start from first input
    const firstInput = this.config.inputs[0];
    if (!firstInput) {
      return process.cwd();
    }

    const resolvedInput = resolve(firstInput);
    let startDir: string;

    // If input is a file, start from its directory
    if (existsSync(resolvedInput) && statSync(resolvedInput).isFile()) {
      startDir = dirname(resolvedInput);
    } else {
      startDir = resolvedInput;
    }

    // Walk up looking for existing .cnx/ or cnext.config.json
    let dir = startDir;
    while (dir !== dirname(dir)) {
      // Check for existing .cnx directory
      if (existsSync(join(dir, ".cnx"))) {
        return dir;
      }
      // Check for config file
      if (existsSync(join(dir, "cnext.config.json"))) {
        return dir;
      }
      dir = dirname(dir);
    }

    // Fallback: use first input's directory
    return startDir;
  }
}

export default Transpiler;
