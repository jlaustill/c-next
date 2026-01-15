/**
 * Project
 * Coordinates multi-file compilation with cross-language symbol resolution
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { CharStream, CommonTokenStream } from "antlr4ng";
import { join, basename, relative, dirname } from "path";

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

import IProjectConfig from "./types/IProjectConfig";
import IProjectResult from "./types/IProjectResult";
import FileDiscovery from "./FileDiscovery";
import EFileType from "./types/EFileType";
import IDiscoveredFile from "./types/IDiscoveredFile";

/**
 * Manages multi-file C-Next projects
 */
class Project {
  private config: IProjectConfig;

  private symbolTable: SymbolTable;

  private preprocessor: Preprocessor;

  private codeGenerator: CodeGenerator;

  private headerGenerator: HeaderGenerator;

  constructor(config: IProjectConfig) {
    this.config = {
      extensions: [".cnx", ".cnext"],
      generateHeaders: true,
      preprocess: true,
      ...config,
    };

    this.symbolTable = new SymbolTable();
    this.preprocessor = new Preprocessor();
    this.codeGenerator = new CodeGenerator();
    this.headerGenerator = new HeaderGenerator();
  }

  /**
   * Compile the project
   */
  async compile(): Promise<IProjectResult> {
    const result: IProjectResult = {
      success: true,
      filesProcessed: 0,
      symbolsCollected: 0,
      conflicts: [],
      errors: [],
      warnings: [],
      outputFiles: [],
    };

    try {
      // Discover files
      const files = this.discoverFiles();

      if (files.length === 0) {
        result.warnings.push("No source files found");
        return result;
      }

      // Ensure output directory exists
      if (!existsSync(this.config.outDir)) {
        mkdirSync(this.config.outDir, { recursive: true });
      }

      // Phase 1: Collect symbols from all C/C++ headers
      const headerFiles = FileDiscovery.getHeaderFiles(files);
      for (const file of headerFiles) {
        try {
          await this.collectHeaderSymbols(file, result);
          result.filesProcessed++;
        } catch (err) {
          result.errors.push(`Failed to process ${file.path}: ${err}`);
        }
      }

      // Phase 2: Collect symbols from C-Next files
      const cnextFiles = FileDiscovery.getCNextFiles(files);
      for (const file of cnextFiles) {
        try {
          this.collectCNextSymbols(file, result);
          result.filesProcessed++;
        } catch (err) {
          result.errors.push(`Failed to process ${file.path}: ${err}`);
        }
      }

      // Phase 3: Check for conflicts
      const conflicts = this.symbolTable.getConflicts();
      for (const conflict of conflicts) {
        result.conflicts.push(conflict.message);
        if (conflict.severity === "error") {
          result.success = false;
        }
      }

      // If there are errors, stop here
      if (!result.success) {
        result.errors.push(
          "Symbol conflicts detected - cannot proceed with code generation",
        );
        return result;
      }

      // Phase 4: Generate C code for each C-Next file
      for (const file of cnextFiles) {
        try {
          const outputFile = this.generateCode(file);
          result.outputFiles.push(outputFile);
        } catch (err) {
          result.errors.push(
            `Failed to generate code for ${file.path}: ${err}`,
          );
          result.success = false;
        }
      }

      // Phase 5: Generate headers if enabled
      if (this.config.generateHeaders && result.success) {
        for (const file of cnextFiles) {
          try {
            const headerFile = this.generateHeader(file);
            if (headerFile) {
              result.outputFiles.push(headerFile);
            }
          } catch (err) {
            result.warnings.push(
              `Failed to generate header for ${file.path}: ${err}`,
            );
          }
        }
      }

      result.symbolsCollected = this.symbolTable.size;
    } catch (err) {
      result.errors.push(`Project compilation failed: ${err}`);
      result.success = false;
    }

    return result;
  }

  /**
   * Discover all project files
   */
  private discoverFiles(): IDiscoveredFile[] {
    let files: IDiscoveredFile[] = [];
    const hasExplicitFiles = this.config.files && this.config.files.length > 0;

    // If specific files are provided, use those
    if (hasExplicitFiles) {
      files = FileDiscovery.discoverFiles(this.config.files);
    }

    // Scan srcDirs for source files (when no explicit files provided)
    if (!hasExplicitFiles && this.config.srcDirs.length > 0) {
      const discoveredFiles = FileDiscovery.discover(this.config.srcDirs, {
        recursive: true,
      });
      files.push(...discoveredFiles);
    }

    // Scan includeDirs for headers only (Issue #80)
    // When explicit files are provided, we only want headers from include dirs
    // NOT additional .cnx files that would cause symbol conflicts
    if (this.config.includeDirs.length > 0) {
      const headerExtensions = [".h", ".hpp", ".hxx", ".hh"];
      const discoveredHeaders = FileDiscovery.discover(
        this.config.includeDirs,
        {
          extensions: headerExtensions,
          recursive: true,
        },
      );

      // Merge with explicit files, avoiding duplicates
      const existingPaths = new Set(files.map((f) => f.path));
      for (const file of discoveredHeaders) {
        if (!existingPaths.has(file.path)) {
          files.push(file);
        }
      }
    }

    return files;
  }

  /**
   * Collect symbols from a C/C++ header file
   */
  private async collectHeaderSymbols(
    file: IDiscoveredFile,
    result: IProjectResult,
  ): Promise<void> {
    let content: string;

    // Preprocess if enabled
    if (this.config.preprocess && this.preprocessor.isAvailable()) {
      const preprocessResult = await this.preprocessor.preprocess(file.path, {
        includePaths: this.config.includeDirs,
        defines: this.config.defines,
        keepLineDirectives: false,
      });

      if (!preprocessResult.success) {
        result.warnings.push(
          `Preprocessor warning for ${file.path}: ${preprocessResult.error}`,
        );
        // Fall back to raw content
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
  }

  /**
   * Parse a C header and collect symbols
   * Tries both C and C++ parsers, merging results (Issue #81)
   */
  private parseCHeader(content: string, filePath: string): void {
    let cSymbols: ISymbol[] = [];
    let cppSymbols: ISymbol[] = [];

    // Try C parser first - it populates struct field info in SymbolTable
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

    // Also try C++ parser for better C++11 support (typed enums, etc.)
    // C++ parser now also populates struct field info (Issue #81)
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

    // Merge symbols: use C++ symbols but supplement with C symbols not found by C++
    // This handles cases where C++11 features break C parser for some symbols
    // but C parser successfully collected others (with struct field info)
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
   * Parse a C++ header and collect symbols
   */
  private parseCppHeader(content: string, filePath: string): void {
    const charStream = CharStream.fromString(content);
    const lexer = new CPP14Lexer(charStream);
    const tokenStream = new CommonTokenStream(lexer);
    const parser = new CPP14Parser(tokenStream);

    // Suppress error output for header parsing
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
   * Collect symbols from a C-Next file
   */
  private collectCNextSymbols(
    file: IDiscoveredFile,
    result: IProjectResult,
  ): void {
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
        _e,
      ) {
        errors.push(`${file.path}:${line}:${charPositionInLine} - ${msg}`);
      },
      reportAmbiguity() {},
      reportAttemptingFullContext() {},
      reportContextSensitivity() {},
    });

    const tree = parser.program();

    if (errors.length > 0) {
      for (const err of errors) {
        result.errors.push(err);
      }
      return;
    }

    const collector = new CNextSymbolCollector(file.path);
    const symbols = collector.collect(tree);
    this.symbolTable.addSymbols(symbols);
  }

  /**
   * Get output path for a file, preserving directory structure if from srcDirs
   *
   * @param file - The discovered file
   * @returns Output path for the generated C file
   */
  private getOutputPath(file: IDiscoveredFile): string {
    const outputName = basename(file.path).replace(/\.cnx$|\.cnext$/, ".c");

    // If file is in a subdirectory of srcDir, preserve structure
    for (const srcDir of this.config.srcDirs) {
      const relativePath = relative(srcDir, file.path);
      if (!relativePath.startsWith("..")) {
        // File is under srcDir - preserve directory structure
        const outputRelative = relativePath.replace(/\.cnx$|\.cnext$/, ".c");
        const outputPath = join(this.config.outDir, outputRelative);

        // Ensure output directory exists
        const outputDir = dirname(outputPath);
        if (!existsSync(outputDir)) {
          mkdirSync(outputDir, { recursive: true });
        }

        return outputPath;
      }
    }

    // Fallback: flat output (for files not in srcDirs)
    return join(this.config.outDir, outputName);
  }

  /**
   * Generate C code from a C-Next file
   */
  private generateCode(file: IDiscoveredFile): string {
    const content = readFileSync(file.path, "utf-8");
    const charStream = CharStream.fromString(content);
    const lexer = new CNextLexer(charStream);
    const tokenStream = new CommonTokenStream(lexer);
    const parser = new CNextParser(tokenStream);

    const tree = parser.program();
    const code = this.codeGenerator.generate(tree, this.symbolTable);

    // Write output file with directory structure preserved
    const outputPath = this.getOutputPath(file);

    writeFileSync(outputPath, code, "utf-8");

    return outputPath;
  }

  /**
   * Get output path for a header file, preserving directory structure if from srcDirs
   *
   * @param file - The discovered file
   * @returns Output path for the generated header file
   */
  private getHeaderOutputPath(file: IDiscoveredFile): string {
    const headerName = basename(file.path).replace(/\.cnx$|\.cnext$/, ".h");

    // If file is in a subdirectory of srcDir, preserve structure
    for (const srcDir of this.config.srcDirs) {
      const relativePath = relative(srcDir, file.path);
      if (!relativePath.startsWith("..")) {
        // File is under srcDir - preserve directory structure
        const outputRelative = relativePath.replace(/\.cnx$|\.cnext$/, ".h");
        const outputPath = join(this.config.outDir, outputRelative);

        // Ensure output directory exists
        const outputDir = dirname(outputPath);
        if (!existsSync(outputDir)) {
          mkdirSync(outputDir, { recursive: true });
        }

        return outputPath;
      }
    }

    // Fallback: flat output (for files not in srcDirs)
    return join(this.config.outDir, headerName);
  }

  /**
   * Generate header file for a C-Next file
   */
  private generateHeader(file: IDiscoveredFile): string | null {
    const symbols = this.symbolTable.getSymbolsByFile(file.path);

    // Filter to exported symbols only
    const exportedSymbols = symbols.filter((s) => s.isExported);

    if (exportedSymbols.length === 0) {
      return null; // No public symbols, no header needed
    }

    const headerName = basename(file.path).replace(/\.cnx$|\.cnext$/, ".h");
    const headerPath = this.getHeaderOutputPath(file);

    const headerContent = this.headerGenerator.generate(
      exportedSymbols,
      headerName,
      {
        exportedOnly: true,
      },
    );

    writeFileSync(headerPath, headerContent, "utf-8");

    return headerPath;
  }

  /**
   * Get the symbol table (for testing/inspection)
   */
  getSymbolTable(): SymbolTable {
    return this.symbolTable;
  }
}

export default Project;
