/**
 * Pipeline
 * Unified transpilation pipeline for both single-file and multi-file builds
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
} from "fs";
import { CharStream, CommonTokenStream } from "antlr4ng";
import { join, basename, relative, dirname, resolve } from "path";

import { CNextLexer } from "../antlr_parser/grammar/CNextLexer";
import { CNextParser } from "../antlr_parser/grammar/CNextParser";
import { CLexer } from "../antlr_parser/c/grammar/CLexer";
import { CParser } from "../antlr_parser/c/grammar/CParser";
import { CPP14Lexer } from "../antlr_parser/cpp/grammar/CPP14Lexer";
import { CPP14Parser } from "../antlr_parser/cpp/grammar/CPP14Parser";

import CodeGenerator from "../codegen/CodeGenerator";
import HeaderGenerator from "../codegen/HeaderGenerator";
import SymbolCollector from "../codegen/SymbolCollector";
import SymbolTable from "../symbol_resolution/SymbolTable";
import ESymbolKind from "../types/ESymbolKind";
import CNextSymbolCollector from "../symbol_resolution/CNextSymbolCollector";
import CSymbolCollector from "../symbol_resolution/CSymbolCollector";
import CppSymbolCollector from "../symbol_resolution/CppSymbolCollector";
import Preprocessor from "../preprocessor/Preprocessor";

import FileDiscovery from "../project/FileDiscovery";
import EFileType from "../project/types/EFileType";
import IDiscoveredFile from "../project/types/IDiscoveredFile";
import IncludeDiscovery from "../lib/IncludeDiscovery";
import IncludeResolver from "../lib/IncludeResolver";
import ITranspileError from "../lib/types/ITranspileError";

import IPipelineConfig from "./types/IPipelineConfig";
import IPipelineResult from "./types/IPipelineResult";
import IFileResult from "./types/IFileResult";
import runAnalyzers from "./runAnalyzers";
import CacheManager from "./CacheManager";
import IStructFieldInfo from "../symbol_resolution/types/IStructFieldInfo";
import detectCppSyntax from "./detectCppSyntax";

/**
 * Unified transpilation pipeline
 */
class Pipeline {
  private config: Required<IPipelineConfig>;
  private symbolTable: SymbolTable;
  private preprocessor: Preprocessor;
  private codeGenerator: CodeGenerator;
  private headerGenerator: HeaderGenerator;
  private warnings: string[];
  private cacheManager: CacheManager | null;
  /** Issue #211: Tracks if C++ output is needed (one-way flag, false → true only) */
  private cppDetected: boolean;
  /** Issue #220: Store SymbolCollector per file for header generation */
  private symbolCollectors: Map<string, SymbolCollector> = new Map();
  /** Issue #321: Track processed headers to avoid cycles during recursive include resolution */
  private processedHeaders: Set<string> = new Set();
  /** Issue #280: Store pass-by-value params per file for header generation */
  private passByValueParamsCollectors: Map<
    string,
    ReadonlyMap<string, ReadonlySet<string>>
  > = new Map();
  /** Issue #424: Store user includes per file for header generation */
  private readonly userIncludesCollectors: Map<string, string[]> = new Map();

  constructor(config: IPipelineConfig) {
    // Apply defaults
    this.config = {
      inputs: config.inputs,
      includeDirs: config.includeDirs ?? [],
      outDir: config.outDir ?? "",
      headerOutDir: config.headerOutDir ?? "",
      defines: config.defines ?? {},
      preprocess: config.preprocess ?? true,
      generateHeaders: config.generateHeaders ?? true,
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

    // Initialize cache manager if caching is enabled
    this.cacheManager = this.config.noCache
      ? null
      : new CacheManager(this.determineProjectRoot());
  }

  /**
   * Execute the unified pipeline
   */
  async run(): Promise<IPipelineResult> {
    const result: IPipelineResult = {
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

      // Stage 1: Discover source files
      const { cnextFiles, headerFiles } = await this.discoverSources();

      if (cnextFiles.length === 0) {
        result.warnings.push("No C-Next source files found");
        result.warnings = [...result.warnings, ...this.warnings];
        return result;
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

      // Stage 5: Analyze and transpile each C-Next file
      for (const file of cnextFiles) {
        const fileResult = await this.transpileFile(file);
        result.files.push(fileResult);
        result.filesProcessed++;

        if (!fileResult.success) {
          result.success = false;
          result.errors.push(...fileResult.errors);
        } else if (fileResult.outputPath) {
          result.outputFiles.push(fileResult.outputPath);
        }
      }

      // Stage 6: Generate headers if enabled
      if (this.config.generateHeaders && result.success) {
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
      if (file && file.type === EFileType.CNext) {
        // It's a C-Next file
        cnextFiles.push(file);
      } else if (file && file.type !== EFileType.Unknown) {
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

    // After parsing, cache the results
    if (this.cacheManager) {
      const symbols = this.symbolTable.getSymbolsByFile(file.path);
      const structFields = this.extractStructFieldsForFile(file.path);
      const needsStructKeyword = this.extractNeedsStructKeywordForFile(
        file.path,
      );
      const enumBitWidth = this.extractEnumBitWidthsForFile(file.path);
      this.cacheManager.setSymbols(
        file.path,
        symbols,
        structFields,
        needsStructKeyword,
        enumBitWidth,
      );
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
    try {
      const charStream = CharStream.fromString(content);
      const lexer = new CLexer(charStream);
      const tokenStream = new CommonTokenStream(lexer);
      const parser = new CParser(tokenStream);
      parser.removeErrorListeners();

      const tree = parser.compilationUnit();
      const collector = new CSymbolCollector(filePath, this.symbolTable);
      const symbols = collector.collect(tree);
      if (symbols.length > 0) {
        this.symbolTable.addSymbols(symbols);
      }
    } catch {
      // Silently ignore parse errors in headers
    }
  }

  /**
   * Parse a C++ header
   */
  private parseCppHeader(content: string, filePath: string): void {
    const charStream = CharStream.fromString(content);
    const lexer = new CPP14Lexer(charStream);
    const tokenStream = new CommonTokenStream(lexer);
    const parser = new CPP14Parser(tokenStream);
    parser.removeErrorListeners();

    try {
      const tree = parser.translationUnit();
      const collector = new CppSymbolCollector(filePath, this.symbolTable);
      const symbols = collector.collect(tree);
      this.symbolTable.addSymbols(symbols);
    } catch {
      // Silently ignore parse errors in headers (they may have complex C++ features)
    }
  }

  /**
   * Stage 3: Collect symbols from a C-Next file
   */
  private collectCNextSymbols(file: IDiscoveredFile): void {
    const content = readFileSync(file.path, "utf-8");
    const charStream = CharStream.fromString(content);
    const lexer = new CNextLexer(charStream);
    const tokenStream = new CommonTokenStream(lexer);
    const parser = new CNextParser(tokenStream);

    const errors: string[] = [];
    parser.removeErrorListeners();
    parser.addErrorListener({
      syntaxError(
        _recognizer,
        _offendingSymbol,
        line,
        charPositionInLine,
        msg,
      ) {
        errors.push(`${file.path}:${line}:${charPositionInLine} - ${msg}`);
      },
      reportAmbiguity() {},
      reportAttemptingFullContext() {},
      reportContextSensitivity() {},
    });

    const tree = parser.program();

    if (errors.length > 0) {
      throw new Error(errors.join("\n"));
    }

    // Issue #332: Pass symbolTable to collector so struct fields are registered
    // This enables TypeResolver.isStructType() to identify C-Next structs from included files
    const collector = new CNextSymbolCollector(file.path, this.symbolTable);
    const symbols = collector.collect(tree);
    this.symbolTable.addSymbols(symbols);
  }

  /**
   * Stage 5: Analyze and transpile a single file
   */
  private async transpileFile(file: IDiscoveredFile): Promise<IFileResult> {
    const content = readFileSync(file.path, "utf-8");
    const charStream = CharStream.fromString(content);
    const lexer = new CNextLexer(charStream);
    const tokenStream = new CommonTokenStream(lexer);
    const parser = new CNextParser(tokenStream);

    const errors: ITranspileError[] = [];
    parser.removeErrorListeners();
    parser.addErrorListener({
      syntaxError(
        _recognizer,
        _offendingSymbol,
        line,
        charPositionInLine,
        msg,
      ) {
        errors.push({
          line,
          column: charPositionInLine,
          message: msg,
          severity: "error",
        });
      },
      reportAmbiguity() {},
      reportAttemptingFullContext() {},
      reportContextSensitivity() {},
    });

    const tree = parser.program();
    const declarationCount = tree.declaration().length;

    // Check for parse errors
    if (errors.length > 0) {
      return {
        sourcePath: file.path,
        code: "",
        success: false,
        errors,
        declarationCount,
      };
    }

    // Parse only mode
    if (this.config.parseOnly) {
      return {
        sourcePath: file.path,
        code: "",
        success: true,
        errors: [],
        declarationCount,
      };
    }

    // Run analyzers with symbol table for external function recognition
    const analyzerErrors = runAnalyzers(tree, tokenStream, {
      symbolTable: this.symbolTable,
    });
    if (analyzerErrors.length > 0) {
      return {
        sourcePath: file.path,
        code: "",
        success: false,
        errors: analyzerErrors,
        declarationCount,
      };
    }

    // Generate code
    try {
      const code = this.codeGenerator.generate(
        tree,
        this.symbolTable,
        tokenStream,
        {
          debugMode: this.config.debugMode,
          target: this.config.target,
          sourcePath: file.path, // Issue #230: For self-include header generation
          generateHeaders: this.config.generateHeaders, // Issue #230: Enable self-include when headers are generated
          cppMode: this.cppDetected, // Issue #250: C++ compatible code generation
          sourceRelativePath: this.getSourceRelativePath(file.path), // Issue #339: For correct self-include paths
          includeDirs: this.config.includeDirs, // Issue #349: For angle-bracket include resolution
          inputs: this.config.inputs, // Issue #349: For calculating relative paths
        },
      );

      // Issue #220: Store SymbolCollector for header generation
      if (this.codeGenerator.symbols) {
        this.symbolCollectors.set(file.path, this.codeGenerator.symbols);
      }

      // Issue #280: Store pass-by-value params for header generation (deep copy)
      // Must snapshot before next file's transpilation clears the data.
      // Note: This captures which params are small primitives for pass-by-value optimization,
      // while updateSymbolsAutoConst (below) handles const inference for remaining pointer params.
      // Both are needed for correct header signatures.
      const passByValue = this.codeGenerator.getPassByValueParams();
      const passByValueCopy = new Map<string, Set<string>>();
      for (const [funcName, params] of passByValue) {
        passByValueCopy.set(funcName, new Set(params));
      }
      this.passByValueParamsCollectors.set(file.path, passByValueCopy);

      // Issue #424: Store user includes for header generation
      // These may define macros used in array dimensions
      const userIncludes: string[] = [];
      for (const includeDir of tree.includeDirective()) {
        const includeText = includeDir.getText();
        // Only include quoted includes (user headers), not angle-bracket (system headers)
        if (includeText.includes('"')) {
          userIncludes.push(includeText);
        }
      }
      this.userIncludesCollectors.set(file.path, userIncludes);

      // Issue #268: Update symbol parameters with auto-const info for header generation
      this.updateSymbolsAutoConst(file.path);

      // Write to file if output directory specified
      let outputPath: string | undefined;
      if (this.config.outDir) {
        outputPath = this.getOutputPath(file);
        writeFileSync(outputPath, code, "utf-8");
      }

      return {
        sourcePath: file.path,
        code,
        outputPath,
        success: true,
        errors: [],
        declarationCount,
      };
    } catch (err) {
      return {
        sourcePath: file.path,
        code: "",
        success: false,
        errors: [
          {
            line: 1,
            column: 0,
            message: `Code generation failed: ${err}`,
            severity: "error",
          },
        ],
        declarationCount,
      };
    }
  }

  /**
   * Get relative path from any input directory for a file.
   * Returns the relative path (e.g., "Display/Utils.cnx") or null if the file
   * is not under any input directory.
   *
   * This is the shared logic used by getSourceRelativePath, getOutputPath,
   * and getHeaderOutputPath for directory structure preservation.
   */
  private getRelativePathFromInputs(filePath: string): string | null {
    for (const input of this.config.inputs) {
      const resolvedInput = resolve(input);

      // Skip if input is a file (not a directory) - can't preserve structure
      if (existsSync(resolvedInput) && statSync(resolvedInput).isFile()) {
        continue;
      }

      const relativePath = relative(resolvedInput, filePath);

      // Check if file is under this input directory
      if (relativePath && !relativePath.startsWith("..")) {
        return relativePath;
      }
    }

    return null;
  }

  /**
   * Issue #339: Get relative path from input directory for self-include generation.
   * Returns the relative path (e.g., "Display/Utils.cnx") or just the basename
   * if the file is not in any input directory.
   */
  private getSourceRelativePath(filePath: string): string {
    return this.getRelativePathFromInputs(filePath) ?? basename(filePath);
  }

  /**
   * Get output path for a file
   */
  private getOutputPath(file: IDiscoveredFile): string {
    // Issue #211: Derive extension from cppDetected flag
    const ext = this.cppDetected ? ".cpp" : ".c";

    const relativePath = this.getRelativePathFromInputs(file.path);
    if (relativePath) {
      // File is under an input directory - preserve structure
      const outputRelative = relativePath.replace(/\.cnx$|\.cnext$/, ext);
      const outputPath = join(this.config.outDir, outputRelative);

      const outputDir = dirname(outputPath);
      if (!existsSync(outputDir)) {
        mkdirSync(outputDir, { recursive: true });
      }

      return outputPath;
    }

    // Fallback: flat output in outDir
    const outputName = basename(file.path).replace(/\.cnx$|\.cnext$/, ext);
    return join(this.config.outDir, outputName);
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
    const headerPath = this.getHeaderOutputPath(file);

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

    const headerContent = this.headerGenerator.generate(
      exportedSymbols,
      headerName,
      { exportedOnly: true, userIncludes },
      typeInput,
      passByValueParams,
    );

    writeFileSync(headerPath, headerContent, "utf-8");
    return headerPath;
  }

  /**
   * Issue #268: Update symbol parameters with auto-const info from code generation.
   * This must be called after code generation to set isAutoConst on parameters
   * that were not modified, enabling correct header generation.
   */
  private updateSymbolsAutoConst(filePath: string): void {
    const unmodifiedParams = this.codeGenerator.getFunctionUnmodifiedParams();
    const symbols = this.symbolTable.getSymbolsByFile(filePath);
    const symbolCollector = this.symbolCollectors.get(filePath);

    for (const symbol of symbols) {
      if (symbol.kind !== ESymbolKind.Function || !symbol.parameters) {
        continue;
      }

      const unmodified = unmodifiedParams.get(symbol.name);
      if (!unmodified) continue;

      // Update each parameter's isAutoConst
      for (const param of symbol.parameters) {
        // Only set auto-const for parameters that would get pointer semantics
        const isPointerParam =
          !param.isConst &&
          !param.isArray &&
          param.type !== "f32" &&
          param.type !== "f64" &&
          param.type !== "ISR" &&
          !(symbolCollector?.knownEnums.has(param.type) ?? false);

        // Also check array params (they become pointers in C)
        const isArrayParam = param.isArray && !param.isConst;

        if (isPointerParam || isArrayParam) {
          param.isAutoConst = unmodified.has(param.name);
        }
      }
    }
  }

  /**
   * Get output path for a header file
   * Uses headerOutDir if specified, otherwise falls back to outDir
   */
  private getHeaderOutputPath(file: IDiscoveredFile): string {
    // Use headerOutDir if specified, otherwise fall back to outDir
    const headerDir = this.config.headerOutDir || this.config.outDir;

    const relativePath = this.getRelativePathFromInputs(file.path);
    if (relativePath) {
      // File is under an input directory - preserve structure
      const outputRelative = relativePath.replace(/\.cnx$|\.cnext$/, ".h");
      const outputPath = join(headerDir, outputRelative);

      const outputDir = dirname(outputPath);
      if (!existsSync(outputDir)) {
        mkdirSync(outputDir, { recursive: true });
      }

      return outputPath;
    }

    // Fallback: flat output in headerDir
    const headerName = basename(file.path).replace(/\.cnx$|\.cnext$/, ".h");
    return join(headerDir, headerName);
  }

  /**
   * Transpile source code provided as a string
   *
   * This method enables string-based transpilation while still parsing headers.
   * Useful for test frameworks that need header type information without reading
   * the source file from disk.
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
      generateHeaders?: boolean; // Issue #230: Enable self-include for extern "C" tests
    },
  ): Promise<IFileResult> {
    const workingDir = options?.workingDir ?? process.cwd();
    const additionalIncludeDirs = options?.includeDirs ?? [];
    const sourcePath = options?.sourcePath ?? "<string>";

    try {
      // Initialize cache if enabled
      if (this.cacheManager) {
        await this.cacheManager.initialize();
      }

      // Step 1: Build search paths using unified IncludeResolver
      const searchPaths = IncludeResolver.buildSearchPaths(
        workingDir,
        this.config.includeDirs,
        additionalIncludeDirs,
      );

      // Step 2: Resolve includes from source content
      const resolver = new IncludeResolver(searchPaths);
      const resolved = resolver.resolve(source, sourcePath);

      // Step 3: Collect warnings
      this.warnings.push(...resolved.warnings);

      // Step 4a: Parse C/C++ headers to populate symbol table
      for (const header of resolved.headers) {
        try {
          await this.collectHeaderSymbols(header);
        } catch (err) {
          this.warnings.push(`Failed to process header ${header.path}: ${err}`);
        }
      }

      // Step 4b: Issue #294 - Parse C-Next includes to populate symbol table
      // This enables cross-file scope references (e.g., decoder.getSpn() -> decoder_getSpn())
      for (const cnxInclude of resolved.cnextIncludes) {
        try {
          this.collectCNextSymbols(cnxInclude);
        } catch (err) {
          this.warnings.push(
            `Failed to process C-Next include ${cnxInclude.path}: ${err}`,
          );
        }
      }

      // Step 5: Parse C-Next source from string
      const charStream = CharStream.fromString(source);
      const lexer = new CNextLexer(charStream);
      const tokenStream = new CommonTokenStream(lexer);
      const parser = new CNextParser(tokenStream);

      const errors: ITranspileError[] = [];
      parser.removeErrorListeners();
      parser.addErrorListener({
        syntaxError(
          _recognizer,
          _offendingSymbol,
          line,
          charPositionInLine,
          msg,
        ) {
          errors.push({
            line,
            column: charPositionInLine,
            message: msg,
            severity: "error",
          });
        },
        reportAmbiguity() {},
        reportAttemptingFullContext() {},
        reportContextSensitivity() {},
      });

      const tree = parser.program();
      const declarationCount = tree.declaration().length;

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
      const allStructFields = this.symbolTable.getAllStructFields();
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
        symbolTable: this.symbolTable,
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
      const code = this.codeGenerator.generate(
        tree,
        this.symbolTable,
        tokenStream,
        {
          debugMode: this.config.debugMode,
          target: this.config.target,
          sourcePath, // Issue #230: For self-include header generation
          generateHeaders: options?.generateHeaders, // Issue #230: Enable self-include for extern "C" tests
          cppMode: this.cppDetected, // Issue #250: C++ compatible code generation
        },
      );

      // Issue #424: Generate header content if requested
      let headerCode: string | undefined;
      if (options?.generateHeaders) {
        // Issue #424: Collect symbols from main source file AFTER code generation
        // This must happen after generate() to avoid interfering with type resolution
        const collector = new CNextSymbolCollector(
          sourcePath,
          this.symbolTable,
        );
        const collectedSymbols = collector.collect(tree);
        this.symbolTable.addSymbols(collectedSymbols);

        const symbols = this.symbolTable.getSymbolsByFile(sourcePath);
        const exportedSymbols = symbols.filter((s) => s.isExported);

        if (exportedSymbols.length > 0) {
          const headerName = basename(sourcePath).replace(
            /\.cnx$|\.cnext$/,
            ".h",
          );

          // Get type input from code generator (for struct/enum definitions)
          const typeInput = this.codeGenerator.symbols ?? undefined;

          // Get pass-by-value params (snapshot before next file clears it)
          const passByValue = this.codeGenerator.getPassByValueParams();
          const passByValueCopy = new Map<string, Set<string>>();
          for (const [funcName, params] of passByValue) {
            passByValueCopy.set(funcName, new Set(params));
          }

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

          // Issue #424: Collect user includes for header generation
          // These may define macros used in array dimensions
          const userIncludes: string[] = [];
          for (const includeDir of tree.includeDirective()) {
            const includeText = includeDir.getText();
            // Only include quoted includes (user headers), not angle-bracket (system headers)
            if (includeText.includes('"')) {
              userIncludes.push(includeText);
            }
          }

          headerCode = this.headerGenerator.generate(
            exportedSymbols,
            headerName,
            { exportedOnly: true, userIncludes },
            typeInput,
            passByValueCopy,
          );
        }
      }

      // Flush cache to disk
      if (this.cacheManager) {
        await this.cacheManager.flush();
      }

      return {
        sourcePath,
        code,
        headerCode,
        success: true,
        errors: [],
        declarationCount,
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

  /**
   * Extract struct fields for a specific file
   * Returns only struct fields for structs defined in that file
   */
  private extractStructFieldsForFile(
    filePath: string,
  ): Map<string, Map<string, IStructFieldInfo>> {
    const result = new Map<string, Map<string, IStructFieldInfo>>();

    // Get struct names defined in this file
    const structNames = this.symbolTable.getStructNamesByFile(filePath);

    // Get fields for each struct
    const allStructFields = this.symbolTable.getAllStructFields();
    for (const structName of structNames) {
      const fields = allStructFields.get(structName);
      if (fields) {
        result.set(structName, fields);
      }
    }

    return result;
  }

  /**
   * Issue #196 Bug 3: Extract struct names requiring 'struct' keyword for a specific file
   * Returns struct names from this file that need the 'struct' keyword in C
   */
  private extractNeedsStructKeywordForFile(filePath: string): string[] {
    // Get struct names defined in this file
    const structNames = this.symbolTable.getStructNamesByFile(filePath);

    // Filter to only those that need struct keyword
    const allNeedsKeyword = this.symbolTable.getAllNeedsStructKeyword();
    return structNames.filter((name) => allNeedsKeyword.includes(name));
  }

  /**
   * Issue #208: Extract enum bit widths for a specific file
   * Returns enum bit widths for enums defined in that file
   */
  private extractEnumBitWidthsForFile(filePath: string): Map<string, number> {
    const result = new Map<string, number>();

    // Get enum names defined in this file
    const fileSymbols = this.symbolTable.getSymbolsByFile(filePath);
    const enumNames = fileSymbols
      .filter((s) => s.kind === "enum")
      .map((s) => s.name);

    // Get bit widths for each enum
    const allBitWidths = this.symbolTable.getAllEnumBitWidths();
    for (const enumName of enumNames) {
      const width = allBitWidths.get(enumName);
      if (width !== undefined) {
        result.set(enumName, width);
      }
    }

    return result;
  }
}

export default Pipeline;
