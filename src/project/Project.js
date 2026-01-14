"use strict";
/**
 * Project
 * Coordinates multi-file compilation with cross-language symbol resolution
 */
var __createBinding =
  (this && this.__createBinding) ||
  (Object.create
    ? function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        var desc = Object.getOwnPropertyDescriptor(m, k);
        if (
          !desc ||
          ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)
        ) {
          desc = {
            enumerable: true,
            get: function () {
              return m[k];
            },
          };
        }
        Object.defineProperty(o, k2, desc);
      }
    : function (o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        o[k2] = m[k];
      });
var __setModuleDefault =
  (this && this.__setModuleDefault) ||
  (Object.create
    ? function (o, v) {
        Object.defineProperty(o, "default", { enumerable: true, value: v });
      }
    : function (o, v) {
        o["default"] = v;
      });
var __importStar =
  (this && this.__importStar) ||
  (function () {
    var ownKeys = function (o) {
      ownKeys =
        Object.getOwnPropertyNames ||
        function (o) {
          var ar = [];
          for (var k in o)
            if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
          return ar;
        };
      return ownKeys(o);
    };
    return function (mod) {
      if (mod && mod.__esModule) return mod;
      var result = {};
      if (mod != null)
        for (var k = ownKeys(mod), i = 0; i < k.length; i++)
          if (k[i] !== "default") __createBinding(result, mod, k[i]);
      __setModuleDefault(result, mod);
      return result;
    };
  })();
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const antlr4ng_1 = require("antlr4ng");
const path_1 = require("path");
const CNextLexer_1 = require("../parser/grammar/CNextLexer");
const CNextParser_1 = require("../parser/grammar/CNextParser");
const CLexer_1 = require("../parser/c/grammar/CLexer");
const CParser_1 = require("../parser/c/grammar/CParser");
const CPP14Lexer_1 = require("../parser/cpp/grammar/CPP14Lexer");
const CPP14Parser_1 = require("../parser/cpp/grammar/CPP14Parser");
const CodeGenerator_1 = __importDefault(require("../codegen/CodeGenerator"));
const HeaderGenerator_1 = __importDefault(
  require("../codegen/HeaderGenerator"),
);
const SymbolTable_1 = __importDefault(require("../symbols/SymbolTable"));
const CNextSymbolCollector_1 = __importDefault(
  require("../symbols/CNextSymbolCollector"),
);
const CSymbolCollector_1 = __importDefault(
  require("../symbols/CSymbolCollector"),
);
const CppSymbolCollector_1 = __importDefault(
  require("../symbols/CppSymbolCollector"),
);
const Preprocessor_1 = __importDefault(require("../preprocessor/Preprocessor"));
const FileDiscovery_1 = __importStar(require("./FileDiscovery"));
/**
 * Manages multi-file C-Next projects
 */
class Project {
  config;
  symbolTable;
  preprocessor;
  codeGenerator;
  headerGenerator;
  constructor(config) {
    this.config = {
      extensions: [".cnx", ".cnext"],
      generateHeaders: true,
      preprocess: true,
      ...config,
    };
    this.symbolTable = new SymbolTable_1.default();
    this.preprocessor = new Preprocessor_1.default();
    this.codeGenerator = new CodeGenerator_1.default();
    this.headerGenerator = new HeaderGenerator_1.default();
  }
  /**
   * Compile the project
   */
  async compile() {
    const result = {
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
      if (!(0, fs_1.existsSync)(this.config.outDir)) {
        (0, fs_1.mkdirSync)(this.config.outDir, { recursive: true });
      }
      // Phase 1: Collect symbols from all C/C++ headers
      const headerFiles = FileDiscovery_1.default.getHeaderFiles(files);
      for (const file of headerFiles) {
        try {
          await this.collectHeaderSymbols(file, result);
          result.filesProcessed++;
        } catch (err) {
          result.errors.push(`Failed to process ${file.path}: ${err}`);
        }
      }
      // Phase 2: Collect symbols from C-Next files
      const cnextFiles = FileDiscovery_1.default.getCNextFiles(files);
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
  discoverFiles() {
    let files = [];
    // If specific files are provided, use those
    if (this.config.files && this.config.files.length > 0) {
      files = FileDiscovery_1.default.discoverFiles(this.config.files);
      console.log(`[DEBUG] Loaded ${files.length} explicit files`);
    }
    // Also scan directories (especially includeDirs for headers)
    // This ensures headers are discovered even when using explicit .cnx files (Issue #80)
    const allDirs = [...this.config.srcDirs, ...this.config.includeDirs];
    console.log(`[DEBUG] Scanning ${allDirs.length} directories:`, allDirs);
    if (allDirs.length > 0) {
      const discoveredFiles = FileDiscovery_1.default.discover(allDirs, {
        extensions: this.config.extensions,
        recursive: true,
      });
      console.log(
        `[DEBUG] Discovered ${discoveredFiles.length} files from directories`,
      );
      // Merge with explicit files, avoiding duplicates
      const existingPaths = new Set(files.map((f) => f.path));
      for (const file of discoveredFiles) {
        if (!existingPaths.has(file.path)) {
          files.push(file);
          console.log(`[DEBUG] Added: ${file.type} - ${file.path}`);
        }
      }
    }
    console.log(`[DEBUG] Total files to process: ${files.length}`);
    return files;
  }
  /**
   * Collect symbols from a C/C++ header file
   */
  async collectHeaderSymbols(file, result) {
    let content;
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
        content = (0, fs_1.readFileSync)(file.path, "utf-8");
      } else {
        content = preprocessResult.content;
      }
    } else {
      content = (0, fs_1.readFileSync)(file.path, "utf-8");
    }
    // Parse based on file type
    if (file.type === FileDiscovery_1.EFileType.CHeader) {
      this.parseCHeader(content, file.path);
    } else if (file.type === FileDiscovery_1.EFileType.CppHeader) {
      this.parseCppHeader(content, file.path);
    }
  }
  /**
   * Parse a C header and collect symbols
   */
  parseCHeader(content, filePath) {
    const charStream = antlr4ng_1.CharStream.fromString(content);
    const lexer = new CLexer_1.CLexer(charStream);
    const tokenStream = new antlr4ng_1.CommonTokenStream(lexer);
    const parser = new CParser_1.CParser(tokenStream);
    // Suppress error output for header parsing
    parser.removeErrorListeners();
    try {
      const tree = parser.compilationUnit();
      const collector = new CSymbolCollector_1.default(
        filePath,
        this.symbolTable,
      );
      const symbols = collector.collect(tree);
      this.symbolTable.addSymbols(symbols);
    } catch {
      // Silently ignore parse errors in headers - they may have unsupported constructs
    }
  }
  /**
   * Parse a C++ header and collect symbols
   */
  parseCppHeader(content, filePath) {
    const charStream = antlr4ng_1.CharStream.fromString(content);
    const lexer = new CPP14Lexer_1.CPP14Lexer(charStream);
    const tokenStream = new antlr4ng_1.CommonTokenStream(lexer);
    const parser = new CPP14Parser_1.CPP14Parser(tokenStream);
    // Suppress error output for header parsing
    parser.removeErrorListeners();
    try {
      const tree = parser.translationUnit();
      const collector = new CppSymbolCollector_1.default(filePath);
      const symbols = collector.collect(tree);
      this.symbolTable.addSymbols(symbols);
    } catch {
      // Silently ignore parse errors in headers
    }
  }
  /**
   * Collect symbols from a C-Next file
   */
  collectCNextSymbols(file, result) {
    const content = (0, fs_1.readFileSync)(file.path, "utf-8");
    const charStream = antlr4ng_1.CharStream.fromString(content);
    const lexer = new CNextLexer_1.CNextLexer(charStream);
    const tokenStream = new antlr4ng_1.CommonTokenStream(lexer);
    const parser = new CNextParser_1.CNextParser(tokenStream);
    const errors = [];
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
    const collector = new CNextSymbolCollector_1.default(file.path);
    const symbols = collector.collect(tree);
    this.symbolTable.addSymbols(symbols);
  }
  /**
   * Get output path for a file, preserving directory structure if from srcDirs
   *
   * @param file - The discovered file
   * @returns Output path for the generated C file
   */
  getOutputPath(file) {
    const outputName = (0, path_1.basename)(file.path).replace(
      /\.cnx$|\.cnext$/,
      ".c",
    );
    // If file is in a subdirectory of srcDir, preserve structure
    for (const srcDir of this.config.srcDirs) {
      const relativePath = (0, path_1.relative)(srcDir, file.path);
      if (!relativePath.startsWith("..")) {
        // File is under srcDir - preserve directory structure
        const outputRelative = relativePath.replace(/\.cnx$|\.cnext$/, ".c");
        const outputPath = (0, path_1.join)(this.config.outDir, outputRelative);
        // Ensure output directory exists
        const outputDir = (0, path_1.dirname)(outputPath);
        if (!(0, fs_1.existsSync)(outputDir)) {
          (0, fs_1.mkdirSync)(outputDir, { recursive: true });
        }
        return outputPath;
      }
    }
    // Fallback: flat output (for files not in srcDirs)
    return (0, path_1.join)(this.config.outDir, outputName);
  }
  /**
   * Generate C code from a C-Next file
   */
  generateCode(file) {
    const content = (0, fs_1.readFileSync)(file.path, "utf-8");
    const charStream = antlr4ng_1.CharStream.fromString(content);
    const lexer = new CNextLexer_1.CNextLexer(charStream);
    const tokenStream = new antlr4ng_1.CommonTokenStream(lexer);
    const parser = new CNextParser_1.CNextParser(tokenStream);
    const tree = parser.program();
    const code = this.codeGenerator.generate(tree, this.symbolTable);
    // Write output file with directory structure preserved
    const outputPath = this.getOutputPath(file);
    (0, fs_1.writeFileSync)(outputPath, code, "utf-8");
    return outputPath;
  }
  /**
   * Get output path for a header file, preserving directory structure if from srcDirs
   *
   * @param file - The discovered file
   * @returns Output path for the generated header file
   */
  getHeaderOutputPath(file) {
    const headerName = (0, path_1.basename)(file.path).replace(
      /\.cnx$|\.cnext$/,
      ".h",
    );
    // If file is in a subdirectory of srcDir, preserve structure
    for (const srcDir of this.config.srcDirs) {
      const relativePath = (0, path_1.relative)(srcDir, file.path);
      if (!relativePath.startsWith("..")) {
        // File is under srcDir - preserve directory structure
        const outputRelative = relativePath.replace(/\.cnx$|\.cnext$/, ".h");
        const outputPath = (0, path_1.join)(this.config.outDir, outputRelative);
        // Ensure output directory exists
        const outputDir = (0, path_1.dirname)(outputPath);
        if (!(0, fs_1.existsSync)(outputDir)) {
          (0, fs_1.mkdirSync)(outputDir, { recursive: true });
        }
        return outputPath;
      }
    }
    // Fallback: flat output (for files not in srcDirs)
    return (0, path_1.join)(this.config.outDir, headerName);
  }
  /**
   * Generate header file for a C-Next file
   */
  generateHeader(file) {
    const symbols = this.symbolTable.getSymbolsByFile(file.path);
    // Filter to exported symbols only
    const exportedSymbols = symbols.filter((s) => s.isExported);
    if (exportedSymbols.length === 0) {
      return null; // No public symbols, no header needed
    }
    const headerName = (0, path_1.basename)(file.path).replace(
      /\.cnx$|\.cnext$/,
      ".h",
    );
    const headerPath = this.getHeaderOutputPath(file);
    const headerContent = this.headerGenerator.generate(
      exportedSymbols,
      headerName,
      {
        exportedOnly: true,
      },
    );
    (0, fs_1.writeFileSync)(headerPath, headerContent, "utf-8");
    return headerPath;
  }
  /**
   * Get the symbol table (for testing/inspection)
   */
  getSymbolTable() {
    return this.symbolTable;
  }
}
exports.default = Project;
