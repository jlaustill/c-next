import * as vscode from "vscode";
import * as path from "node:path";
import * as fs from "node:fs";
import parseWithSymbols from "../../src/lib/parseWithSymbols";
import ISymbolInfo from "../../src/lib/types/ISymbolInfo";
import TLanguage from "../../src/lib/types/TLanguage";
import WorkspaceIndex from "./workspace/WorkspaceIndex";
import CNextExtensionContext from "./ExtensionContext";

/**
 * Extended symbol info that includes source file path
 */
interface ISymbolWithFile extends ISymbolInfo {
  sourceFile?: string;
}

/**
 * C-Next primitive type info for hover
 */
const TYPE_INFO: Record<string, { description: string; bits: number }> = {
  u8: { description: "Unsigned 8-bit integer", bits: 8 },
  u16: { description: "Unsigned 16-bit integer", bits: 16 },
  u32: { description: "Unsigned 32-bit integer", bits: 32 },
  u64: { description: "Unsigned 64-bit integer", bits: 64 },
  i8: { description: "Signed 8-bit integer", bits: 8 },
  i16: { description: "Signed 16-bit integer", bits: 16 },
  i32: { description: "Signed 32-bit integer", bits: 32 },
  i64: { description: "Signed 64-bit integer", bits: 64 },
  f32: { description: "Single-precision floating point (32-bit)", bits: 32 },
  f64: { description: "Double-precision floating point (64-bit)", bits: 64 },
  bool: { description: "Boolean value (true/false)", bits: 1 },
  void: { description: "No return value", bits: 0 },
  string: {
    description: "Bounded string type. Use string<N> to specify capacity.",
    bits: 0,
  },
  ISR: {
    description:
      "Interrupt Service Routine type - void function with no parameters",
    bits: 0,
  },
};

/**
 * C-Next keyword info for hover
 */
const KEYWORD_INFO: Record<string, string> = {
  // Declaration keywords
  register: "Declares a hardware register binding with memory-mapped I/O",
  scope: "Declares a singleton service with prefixed member names (ADR-016)",
  class: "Declares a type with fields and methods (instances via pointer)",
  struct: "Declares a data structure (ADR-014)",
  enum: "Declares a type-safe enumeration (ADR-017)",
  const: "Declares a compile-time constant value (ADR-013)",

  // Control flow
  if: "Conditional statement",
  else: "Alternative branch of conditional",
  for: "Loop with initialization, condition, and increment",
  while: "Loop with condition",
  do: "Do-while loop - executes at least once (ADR-027)",
  switch: "Multi-way branch with required braces per case (ADR-025)",
  case: "Switch case label - use || for multiple values",
  default: "Default switch case - use default(n) for counted cases",
  break: "Exit from loop or switch",
  continue: "Skip to next loop iteration",
  return: "Return from function",

  // Boolean literals
  true: "Boolean true value",
  false: "Boolean false value",

  // Visibility modifiers (ADR-016)
  public: "Public visibility - accessible from outside the scope",
  private: "Private visibility - only accessible within the scope",

  // Overflow behavior (ADR-044)
  clamp: "Clamp overflow behavior - values saturate at min/max (default)",
  wrap: "Wrap overflow behavior - values wrap around on overflow",

  // Qualification keywords (ADR-016)
  this: "Refers to members of the current scope",
  global: "Refers to global scope members",

  // Operators
  sizeof: "Returns the size of a type or expression in bytes (ADR-023)",

  // Register access modifiers
  rw: "Read-write access modifier for register members",
  ro: "Read-only access modifier for register members",
  wo: "Write-only access modifier for register members",
  w1c: "Write-1-to-clear access modifier for register members",
  w1s: "Write-1-to-set access modifier for register members",

  // Legacy (kept for compatibility)
  namespace: 'Legacy: Use "scope" instead (ADR-016)',

  // ADR-047: NULL keyword for C interop
  NULL: "C library null pointer - only valid in comparison with C stream functions",
};

/**
 * ADR-047: C library function metadata for hover
 * These are whitelisted stream I/O functions that can return NULL
 */
interface ICLibraryFunctionInfo {
  description: string;
  nullMeaning: string;
  docsUrl: string;
  signature: string;
}

const C_LIBRARY_FUNCTIONS: Record<string, ICLibraryFunctionInfo> = {
  fgets: {
    description: "Read a line from stream into buffer",
    nullMeaning: "Returns NULL on EOF or read error",
    docsUrl: "https://en.cppreference.com/w/c/io/fgets",
    signature: "char* fgets(char* str, int count, FILE* stream)",
  },
  fputs: {
    description: "Write a string to stream",
    nullMeaning: "Returns EOF (negative) on write error",
    docsUrl: "https://en.cppreference.com/w/c/io/fputs",
    signature: "int fputs(const char* str, FILE* stream)",
  },
  fgetc: {
    description: "Read a character from stream",
    nullMeaning: "Returns EOF on end-of-file or read error",
    docsUrl: "https://en.cppreference.com/w/c/io/fgetc",
    signature: "int fgetc(FILE* stream)",
  },
  fputc: {
    description: "Write a character to stream",
    nullMeaning: "Returns EOF on write error",
    docsUrl: "https://en.cppreference.com/w/c/io/fputc",
    signature: "int fputc(int ch, FILE* stream)",
  },
  gets: {
    description: "Read a line from stdin (DEPRECATED - use fgets)",
    nullMeaning: "Returns NULL on EOF or read error",
    docsUrl: "https://en.cppreference.com/w/c/io/gets",
    signature: "char* gets(char* str)",
  },
};

/**
 * ADR-047: Forbidden C library functions that return pointers
 * These require ADR-103 (stream handling) infrastructure
 */
const FORBIDDEN_C_FUNCTIONS: Record<string, string> = {
  fopen: "File operations require ADR-103 stream handling (v2)",
  fclose: "File operations require ADR-103 stream handling (v2)",
  malloc: "Dynamic allocation is forbidden (ADR-003)",
  calloc: "Dynamic allocation is forbidden (ADR-003)",
  realloc: "Dynamic allocation is forbidden (ADR-003)",
  free: "Dynamic allocation is forbidden (ADR-003)",
  getenv: "Environment access requires ADR-103 infrastructure (v2)",
  strstr: "Pointer-returning string functions not yet supported",
  strchr: "Pointer-returning string functions not yet supported",
  strrchr: "Pointer-returning string functions not yet supported",
  memchr: "Pointer-returning memory functions not yet supported",
};

/**
 * Build hover content for a C library function
 */
function buildCLibraryHover(
  funcName: string,
  info: ICLibraryFunctionInfo,
): vscode.MarkdownString {
  const md = new vscode.MarkdownString();
  md.isTrusted = true;

  // [C Library] badge
  md.appendMarkdown(`**[C Library]** \`${funcName}\`\n\n`);
  md.appendMarkdown(`${info.description}\n\n`);
  md.appendCodeblock(info.signature, "c");
  md.appendMarkdown(`\n**NULL Return:** ${info.nullMeaning}\n\n`);
  md.appendMarkdown(`*Must check return value against NULL*\n\n`);
  md.appendMarkdown(`[Documentation](${info.docsUrl})`);

  return md;
}

/**
 * Build hover content for a forbidden C function
 */
function buildForbiddenFunctionHover(
  funcName: string,
  reason: string,
): vscode.MarkdownString {
  const md = new vscode.MarkdownString();
  md.isTrusted = true;

  md.appendMarkdown(`**[C Library - Not Supported]** \`${funcName}\`\n\n`);
  md.appendMarkdown(`⚠️ ${reason}\n\n`);
  md.appendMarkdown(`*This function is not available in C-Next v1.*`);

  return md;
}

/**
 * Get human-readable access modifier description
 */
function getAccessDescription(access: string): string {
  switch (access) {
    case "rw":
      return "read-write";
    case "ro":
      return "read-only";
    case "wo":
      return "write-only";
    case "w1c":
      return "write-1-to-clear";
    case "w1s":
      return "write-1-to-set";
    default:
      return access;
  }
}

/**
 * Detect the language type from a file path
 * For .h files, defaults to C but can be overridden if C++ constructs are detected
 */
function detectLanguage(filePath: string): TLanguage {
  const ext = path.extname(filePath).toLowerCase();

  switch (ext) {
    case ".cnx":
      return "cnext";
    case ".cpp":
    case ".cc":
    case ".cxx":
    case ".hpp":
    case ".hh":
    case ".hxx":
      return "cpp";
    case ".c":
      return "c";
    case ".h":
      // Default to C for .h files
      // Could be enhanced to detect C++ constructs if needed
      return "c";
    default:
      return "c";
  }
}

/**
 * Get the language label with file extension for display
 */
function getLanguageLabel(language: TLanguage, ext: string): string {
  switch (language) {
    case "cnext":
      return `C-Next (${ext})`;
    case "cpp":
      return `C++ (${ext})`;
    case "c":
      return `C (${ext})`;
  }
}

/**
 * Get a smart display path - filename if unique, relative path if duplicates exist
 */
function getSmartDisplayPath(
  filePath: string,
  workspaceIndex?: WorkspaceIndex,
): string {
  const fileName = path.basename(filePath);

  // If we have workspace index, check for conflicts
  if (workspaceIndex?.hasFilenameConflict(fileName)) {
    // Return relative path from workspace root
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders?.length) {
      const relativePath = path.relative(
        workspaceFolders[0].uri.fsPath,
        filePath,
      );
      return relativePath;
    }
  }

  return fileName;
}

/**
 * Format the source footer line with clickable link
 * Format: "Source: [filename:line](command:...) (Language (.ext))"
 */
function formatSourceFooter(
  filePath: string,
  line: number,
  workspaceIndex?: WorkspaceIndex,
): string {
  const displayPath = getSmartDisplayPath(filePath, workspaceIndex);
  const ext = path.extname(filePath).toLowerCase();
  const language = detectLanguage(filePath);
  const languageLabel = getLanguageLabel(language, ext);

  // Create a clickable link that opens the file at the specific line
  // VS Code markdown supports command URIs - use vscode.open with selection options
  const fileUri = vscode.Uri.file(filePath);
  const openArgs = [
    fileUri.toString(),
    {
      selection: {
        startLineNumber: line,
        startColumn: 1,
        endLineNumber: line,
        endColumn: 1,
      },
    },
  ];
  const commandUri = `command:vscode.open?${encodeURIComponent(JSON.stringify(openArgs))}`;

  return `\n\n---\nSource: [${displayPath}:${line}](${commandUri}) (${languageLabel})`;
}

/**
 * Build hover content for a symbol
 * @param symbol The symbol to build hover for
 * @param sourceFile Optional source file path (for cross-file symbols)
 * @param workspaceIndex Optional workspace index for smart path display
 */
function buildSymbolHover(
  symbol: ISymbolWithFile,
  sourceFile?: string,
  workspaceIndex?: WorkspaceIndex,
): vscode.MarkdownString {
  const md = new vscode.MarkdownString();
  md.isTrusted = true;

  switch (symbol.kind) {
    case "scope":
    case "namespace": // Legacy support
      md.appendMarkdown(`**scope** \`${symbol.name}\`\n\n`);
      md.appendMarkdown(`Singleton service with prefixed member names.`);
      break;

    case "class":
      md.appendMarkdown(`**class** \`${symbol.name}\`\n\n`);
      md.appendMarkdown(`Type with fields and methods.`);
      break;

    case "struct":
      md.appendMarkdown(`**struct** \`${symbol.name}\`\n\n`);
      md.appendMarkdown(`Data structure.`);
      break;

    case "register":
      md.appendMarkdown(`**register** \`${symbol.name}\`\n\n`);
      md.appendMarkdown(`Hardware register binding for memory-mapped I/O.`);
      break;

    case "function":
    case "method":
      md.appendMarkdown(`**function** \`${symbol.fullName}\`\n\n`);
      md.appendCodeblock(
        symbol.signature || `${symbol.type || "void"} ${symbol.name}()`,
        "cnext",
      );
      if (symbol.parent) {
        md.appendMarkdown(
          `\n*Defined in: ${symbol.parent} ${symbol.kind === "method" ? "class" : "namespace"}*`,
        );
      }
      break;

    case "variable":
    case "field":
      md.appendMarkdown(
        `**${symbol.parent ? "field" : "variable"}** \`${symbol.fullName}\`\n\n`,
      );
      md.appendMarkdown(`*Type:* \`${symbol.type || "unknown"}\``);
      if (symbol.size !== undefined) {
        md.appendMarkdown(`\n\n*Size:* ${symbol.size}`);
      }
      if (symbol.parent) {
        md.appendMarkdown(`\n\n*Defined in:* ${symbol.parent}`);
      }
      break;

    case "registerMember":
      const access = symbol.accessModifier || "rw";
      md.appendMarkdown(`**register member** \`${symbol.fullName}\`\n\n`);
      md.appendCodeblock(`${symbol.type || "u32"} ${access}`, "cnext");
      md.appendMarkdown(`\n*Access:* ${getAccessDescription(access)}`);
      if (symbol.parent) {
        md.appendMarkdown(`\n\n*Register:* ${symbol.parent}`);
      }
      break;

    default:
      md.appendMarkdown(`**${symbol.kind}** \`${symbol.name}\``);
  }

  // Add source traceability footer with clickable link
  const displayFile = sourceFile || symbol.sourceFile;
  if (displayFile) {
    md.appendMarkdown(
      formatSourceFooter(displayFile, symbol.line, workspaceIndex),
    );
  } else {
    // Fallback: show just the line number if no source file is available
    md.appendMarkdown(`\n\n*Line ${symbol.line}*`);
  }

  return md;
}

/**
 * C-Next Hover Provider
 * Provides hover information for C-Next source files
 * Supports cross-file symbol lookup via WorkspaceIndex
 * Falls back to C/C++ extension for stdlib functions via generated .c files
 */
export default class CNextHoverProvider implements vscode.HoverProvider {
  constructor(
    private workspaceIndex?: WorkspaceIndex,
    private extensionContext?: CNextExtensionContext,
  ) {}

  /**
   * Provide hover information for the given position
   */
  async provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): Promise<vscode.Hover | null> {
    // Get the word at the cursor position
    const wordRange = document.getWordRangeAtPosition(position, /[a-zA-Z_]\w*/);
    if (!wordRange) {
      return null;
    }

    const word = document.getText(wordRange);
    const lineText = document.lineAt(position).text;
    const charBefore =
      wordRange.start.character > 0
        ? lineText.charAt(wordRange.start.character - 1)
        : "";

    // Check if this is a member access (word after a dot)
    let parentName: string | undefined;
    if (charBefore === ".") {
      // Find the word before the dot
      const beforeDot = lineText.substring(0, wordRange.start.character - 1);
      const parentMatch = beforeDot.match(/(\w+)$/);
      if (parentMatch) {
        parentName = parentMatch[1];
      }
    }

    // Check for primitive type
    if (TYPE_INFO[word]) {
      const info = TYPE_INFO[word];
      const md = new vscode.MarkdownString();
      md.appendMarkdown(`**type** \`${word}\`\n\n`);
      md.appendMarkdown(info.description);
      if (info.bits > 0) {
        md.appendMarkdown(`\n\n*Bit width:* ${info.bits}`);
      }
      return new vscode.Hover(md, wordRange);
    }

    // Check for keyword
    if (KEYWORD_INFO[word]) {
      const md = new vscode.MarkdownString();
      md.appendMarkdown(`**keyword** \`${word}\`\n\n`);
      md.appendMarkdown(KEYWORD_INFO[word]);
      return new vscode.Hover(md, wordRange);
    }

    // ADR-047: Check for C library stream functions
    if (C_LIBRARY_FUNCTIONS[word]) {
      return new vscode.Hover(
        buildCLibraryHover(word, C_LIBRARY_FUNCTIONS[word]),
        wordRange,
      );
    }

    // ADR-047: Check for forbidden C library functions
    if (FORBIDDEN_C_FUNCTIONS[word]) {
      return new vscode.Hover(
        buildForbiddenFunctionHover(word, FORBIDDEN_C_FUNCTIONS[word]),
        wordRange,
      );
    }

    // FAST PATH: Parse current document to get local symbols
    const source = document.getText();
    const parseResult = parseWithSymbols(source);
    const symbols = parseResult.symbols;

    // Look for symbol in current document
    let symbol: ISymbolInfo | undefined;

    if (parentName) {
      symbol = symbols.find((s) => s.name === word && s.parent === parentName);
    } else {
      symbol = symbols.find((s) => s.name === word && !s.parent);
      if (!symbol) {
        symbol = symbols.find((s) => s.fullName === word);
      }
      if (!symbol) {
        symbol = symbols.find((s) => s.name === word);
      }
    }

    if (symbol) {
      // For local symbols, use the current document as the source file
      return new vscode.Hover(
        buildSymbolHover(symbol, document.uri.fsPath, this.workspaceIndex),
        wordRange,
      );
    }

    // CROSS-FILE: Check workspace index for symbols from other files
    if (this.workspaceIndex) {
      const workspaceSymbol = this.workspaceIndex.findDefinition(
        word,
        document.uri,
      ) as ISymbolWithFile;
      if (workspaceSymbol) {
        return new vscode.Hover(
          buildSymbolHover(workspaceSymbol, undefined, this.workspaceIndex),
          wordRange,
        );
      }
    }

    // FALLBACK: Query C/C++ extension via the generated .c file
    const cHover = await this.queryCExtensionHover(document, word, wordRange);
    if (cHover) {
      return cHover;
    }

    return null;
  }

  /**
   * Find the output file path (.c or .cpp) for a .cnx document
   * Uses cache if current files don't exist (allows hover during parse errors)
   */
  private findOutputPath(document: vscode.TextDocument): string | null {
    const cnxPath = document.uri.fsPath;

    // Check for .cpp first (PlatformIO/Arduino projects often use .cpp)
    const cppPath = cnxPath.replace(/\.cnx$/, ".cpp");
    if (fs.existsSync(cppPath)) {
      return cppPath;
    }

    // Check for .c
    const cPath = cnxPath.replace(/\.cnx$/, ".c");
    if (fs.existsSync(cPath)) {
      return cPath;
    }

    // Neither exists - check the cache for last-known-good path
    const outputPathCache =
      this.extensionContext?.lastGoodOutputPath ?? new Map<string, string>();
    const cachedPath = outputPathCache.get(document.uri.toString());
    if (cachedPath && fs.existsSync(cachedPath)) {
      return cachedPath;
    }

    return null;
  }

  /**
   * Query the C/C++ extension for hover info by looking up the symbol
   * in the generated .c/.cpp file
   */
  private async queryCExtensionHover(
    document: vscode.TextDocument,
    word: string,
    wordRange: vscode.Range,
  ): Promise<vscode.Hover | null> {
    // Find the output file (uses cache if current file has parse errors)
    const outputPath = this.findOutputPath(document);
    if (!outputPath) {
      return null;
    }

    try {
      // Read the output file and find the word
      const outputSource = fs.readFileSync(outputPath, "utf-8");
      const wordPosition = this.findWordInSource(outputSource, word);

      if (!wordPosition) {
        return null;
      }

      // Query the C/C++ extension's hover provider
      const outputUri = vscode.Uri.file(outputPath);
      const hovers = await vscode.commands.executeCommand<vscode.Hover[]>(
        "vscode.executeHoverProvider",
        outputUri,
        wordPosition,
      );

      if (hovers?.length) {
        const hover = hovers[0];

        // Try to get the definition location for the source footer
        const definitions = await vscode.commands.executeCommand<
          vscode.Location[]
        >("vscode.executeDefinitionProvider", outputUri, wordPosition);

        // Build the source footer
        let sourceFooter = "";
        if (definitions?.length) {
          const def = definitions[0];
          const defPath = def.uri.fsPath;
          const defLine = def.range.start.line + 1; // Convert to 1-based
          sourceFooter = formatSourceFooter(
            defPath,
            defLine,
            this.workspaceIndex,
          );
        } else {
          // Fallback: use the generated C file as the source
          const line = wordPosition.line + 1; // Convert to 1-based
          sourceFooter = formatSourceFooter(
            outputPath,
            line,
            this.workspaceIndex,
          );
        }

        // Append the source footer to the hover contents
        const contents = [...hover.contents];
        const footerMd = new vscode.MarkdownString(sourceFooter);
        footerMd.isTrusted = true;
        contents.push(footerMd);

        return new vscode.Hover(contents, wordRange);
      }
    } catch (err) {
      // Silently fail - C/C++ extension might not be installed
      console.error("C-Next: Failed to query C/C++ hover:", err);
    }

    return null;
  }

  /**
   * Find a word in source code and return its position
   */
  private findWordInSource(
    source: string,
    word: string,
  ): vscode.Position | null {
    const lines = source.split("\n");

    for (let lineNum = 0; lineNum < lines.length; lineNum++) {
      const line = lines[lineNum];
      // Use word boundary regex to find exact word matches
      const regex = new RegExp(`\\b${word}\\b`);
      const match = regex.exec(line);

      if (match) {
        return new vscode.Position(lineNum, match.index);
      }
    }

    return null;
  }
}
