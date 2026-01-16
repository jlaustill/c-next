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

import { CNextLexer } from "../parser/grammar/CNextLexer";
import { CNextParser } from "../parser/grammar/CNextParser";
import { CLexer } from "../parser/c/grammar/CLexer";
import { CParser } from "../parser/c/grammar/CParser";
import { CPP14Lexer } from "../parser/cpp/grammar/CPP14Lexer";
import { CPP14Parser } from "../parser/cpp/grammar/CPP14Parser";

import CodeGenerator from "../codegen/CodeGenerator";
import HeaderGenerator from "../codegen/HeaderGenerator";
import SymbolTable from "../symbols/SymbolTable";
import ISymbol from "../types/ISymbol";
import CNextSymbolCollector from "../symbols/CNextSymbolCollector";
import CSymbolCollector from "../symbols/CSymbolCollector";
import CppSymbolCollector from "../symbols/CppSymbolCollector";
import Preprocessor from "../preprocessor/Preprocessor";

import FileDiscovery from "../project/FileDiscovery";
import EFileType from "../project/types/EFileType";
import IDiscoveredFile from "../project/types/IDiscoveredFile";
import IncludeDiscovery from "../lib/IncludeDiscovery";
import ITranspileError from "../lib/types/ITranspileError";

import IPipelineConfig from "./types/IPipelineConfig";
import IPipelineResult from "./types/IPipelineResult";
import IFileResult from "./types/IFileResult";
import runAnalyzers from "./runAnalyzers";
import CacheManager from "./CacheManager";
import IStructFieldInfo from "../symbols/types/IStructFieldInfo";

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

  constructor(config: IPipelineConfig) {
    // Apply defaults
    this.config = {
      inputs: config.inputs,
      includeDirs: config.includeDirs ?? [],
      outDir: config.outDir ?? "",
      defines: config.defines ?? {},
      preprocess: config.preprocess ?? true,
      generateHeaders: config.generateHeaders ?? true,
      outputExtension: config.outputExtension ?? ".c",
      parseOnly: config.parseOnly ?? false,
      debugMode: config.debugMode ?? false,
      target: config.target ?? "",
      collectGrammarCoverage: config.collectGrammarCoverage ?? false,
      noCache: config.noCache ?? false,
    };

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
   */
  private async discoverSources(): Promise<{
    cnextFiles: IDiscoveredFile[];
    headerFiles: IDiscoveredFile[];
  }> {
    let allFiles: IDiscoveredFile[] = [];

    // Discover from inputs (files or directories)
    for (const input of this.config.inputs) {
      const resolvedInput = resolve(input);

      if (!existsSync(resolvedInput)) {
        throw new Error(`Input not found: ${input}`);
      }

      const file = FileDiscovery.discoverFile(resolvedInput);
      if (file && file.type !== EFileType.Unknown) {
        // It's a file
        allFiles.push(file);
      } else {
        // It's a directory - scan it
        const discovered = FileDiscovery.discover([resolvedInput], {
          recursive: true,
        });
        allFiles.push(...discovered);
      }
    }

    // Also scan include directories for headers
    if (this.config.includeDirs.length > 0) {
      const headerDiscovered = FileDiscovery.discover(this.config.includeDirs, {
        recursive: true,
      });

      // Merge, avoiding duplicates
      const existingPaths = new Set(allFiles.map((f) => f.path));
      for (const file of headerDiscovered) {
        if (!existingPaths.has(file.path)) {
          allFiles.push(file);
        }
      }
    }

    // Auto-discover include paths from C-Next files
    const cnextFiles = FileDiscovery.getCNextFiles(allFiles);
    if (cnextFiles.length > 0) {
      const additionalIncludeDirs = IncludeDiscovery.discoverIncludePaths(
        cnextFiles[0].path,
      );

      const headerDiscovered = FileDiscovery.discover(additionalIncludeDirs, {
        recursive: true,
      });

      const existingPaths = new Set(allFiles.map((f) => f.path));
      for (const file of headerDiscovered) {
        if (!existingPaths.has(file.path)) {
          allFiles.push(file);
        }
      }
    }

    // Separate C-Next files from headers
    const finalCnextFiles = FileDiscovery.getCNextFiles(allFiles);

    // Build set of base names from C-Next files to exclude generated headers
    const cnextBaseNames = new Set(
      finalCnextFiles.map((f) =>
        basename(f.path).replace(/\.cnx$|\.cnext$/, ""),
      ),
    );

    // Filter headers, excluding generated ones
    const allHeaderFiles = FileDiscovery.getHeaderFiles(allFiles);
    const headerFiles = allHeaderFiles.filter((f) => {
      const headerBaseName = basename(f.path).replace(
        /\.h$|\.hpp$|\.hxx$|\.hh$/,
        "",
      );
      return !cnextBaseNames.has(headerBaseName);
    });

    return { cnextFiles: finalCnextFiles, headerFiles };
  }

  /**
   * Stage 2: Collect symbols from C/C++ headers
   */
  private async collectHeaderSymbols(file: IDiscoveredFile): Promise<void> {
    // Check cache first
    if (this.cacheManager?.isValid(file.path)) {
      const cached = this.cacheManager.getSymbols(file.path);
      if (cached) {
        // Restore symbols and struct fields from cache
        this.symbolTable.addSymbols(cached.symbols);
        this.symbolTable.restoreStructFields(cached.structFields);
        return; // Cache hit - skip parsing
      }
    }

    let content: string;

    // Preprocess if enabled
    if (this.config.preprocess && this.preprocessor.isAvailable()) {
      const preprocessResult = await this.preprocessor.preprocess(file.path, {
        includePaths: this.config.includeDirs,
        defines: this.config.defines,
        keepLineDirectives: false,
      });

      if (!preprocessResult.success) {
        this.warnings.push(
          `Preprocessor warning for ${file.path}: ${preprocessResult.error}`,
        );
        content = readFileSync(file.path, "utf-8");
      } else {
        content = preprocessResult.content;
      }
    } else {
      content = readFileSync(file.path, "utf-8");
    }

    // Parse based on file type
    if (file.type === EFileType.CHeader) {
      this.parseCHeader(content, file.path);
    } else if (file.type === EFileType.CppHeader) {
      this.parseCppHeader(content, file.path);
    }

    // After parsing, cache the results
    if (this.cacheManager) {
      const symbols = this.symbolTable.getSymbolsByFile(file.path);
      const structFields = this.extractStructFieldsForFile(file.path);
      this.cacheManager.setSymbols(file.path, symbols, structFields);
    }
  }

  /**
   * Parse a C header using dual-parse strategy
   */
  private parseCHeader(content: string, filePath: string): void {
    let cSymbols: ISymbol[] = [];
    let cppSymbols: ISymbol[] = [];

    // Try C parser first
    try {
      const charStream = CharStream.fromString(content);
      const lexer = new CLexer(charStream);
      const tokenStream = new CommonTokenStream(lexer);
      const parser = new CParser(tokenStream);
      parser.removeErrorListeners();

      const tree = parser.compilationUnit();
      const collector = new CSymbolCollector(filePath, this.symbolTable);
      cSymbols = collector.collect(tree);
    } catch {
      // C parser failed
    }

    // Also try C++ parser for better C++11 support
    try {
      const cppCharStream = CharStream.fromString(content);
      const cppLexer = new CPP14Lexer(cppCharStream);
      const cppTokenStream = new CommonTokenStream(cppLexer);
      const cppParser = new CPP14Parser(cppTokenStream);
      cppParser.removeErrorListeners();

      const cppTree = cppParser.translationUnit();
      const cppCollector = new CppSymbolCollector(filePath, this.symbolTable);
      cppSymbols = cppCollector.collect(cppTree);
    } catch {
      // C++ parser failed
    }

    // Merge symbols: prefer C++ but supplement with C-only symbols
    const cppSymbolNames = new Set(cppSymbols.map((s) => s.name));
    const additionalSymbols = cSymbols.filter(
      (s) => !cppSymbolNames.has(s.name),
    );

    const allSymbols = [...cppSymbols, ...additionalSymbols];

    if (allSymbols.length > 0) {
      this.symbolTable.addSymbols(allSymbols);
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
      // Silently ignore parse errors in headers
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

    const collector = new CNextSymbolCollector(file.path);
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

    // Run analyzers
    const analyzerErrors = runAnalyzers(tree, tokenStream);
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
        },
      );

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
   * Get output path for a file
   */
  private getOutputPath(file: IDiscoveredFile): string {
    const ext = this.config.outputExtension;
    const outputName = basename(file.path).replace(/\.cnx$|\.cnext$/, ext);

    // Check if file is in any input directory (for preserving structure)
    for (const input of this.config.inputs) {
      const resolvedInput = resolve(input);

      // Skip if input is a file (not a directory) - can't preserve structure
      if (existsSync(resolvedInput) && statSync(resolvedInput).isFile()) {
        continue;
      }

      const relativePath = relative(resolvedInput, file.path);

      // Check if file is under this input directory
      if (relativePath && !relativePath.startsWith("..")) {
        // File is under this input directory - preserve structure
        const outputRelative = relativePath.replace(/\.cnx$|\.cnext$/, ext);
        const outputPath = join(this.config.outDir, outputRelative);

        const outputDir = dirname(outputPath);
        if (!existsSync(outputDir)) {
          mkdirSync(outputDir, { recursive: true });
        }

        return outputPath;
      }
    }

    // Fallback: flat output in outDir
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

    const headerContent = this.headerGenerator.generate(
      exportedSymbols,
      headerName,
      { exportedOnly: true },
    );

    writeFileSync(headerPath, headerContent, "utf-8");
    return headerPath;
  }

  /**
   * Get output path for a header file
   */
  private getHeaderOutputPath(file: IDiscoveredFile): string {
    const headerName = basename(file.path).replace(/\.cnx$|\.cnext$/, ".h");

    // Check if file is in any input directory (for preserving structure)
    for (const input of this.config.inputs) {
      const resolvedInput = resolve(input);

      // Skip if input is a file (not a directory) - can't preserve structure
      if (existsSync(resolvedInput) && statSync(resolvedInput).isFile()) {
        continue;
      }

      const relativePath = relative(resolvedInput, file.path);

      // Check if file is under this input directory
      if (relativePath && !relativePath.startsWith("..")) {
        const outputRelative = relativePath.replace(/\.cnx$|\.cnext$/, ".h");
        const outputPath = join(this.config.outDir, outputRelative);

        const outputDir = dirname(outputPath);
        if (!existsSync(outputDir)) {
          mkdirSync(outputDir, { recursive: true });
        }

        return outputPath;
      }
    }

    // Fallback: flat output in outDir
    return join(this.config.outDir, headerName);
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
}

export default Pipeline;
