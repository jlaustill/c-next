import * as vscode from "vscode";
import * as path from "node:path";
import * as fs from "node:fs";
import parseWithSymbols from "../../src/lib/parseWithSymbols";
import ISymbolInfo from "../../src/lib/types/ISymbolInfo";
import TSymbolKind from "../../src/lib/types/TSymbolKind";
import WorkspaceIndex from "./workspace/WorkspaceIndex";
import CNextExtensionContext from "./ExtensionContext";
import {
  getAccessDescription,
  getCompletionLabel,
  escapeRegex,
  findOutputPath,
  MAX_GLOBAL_COMPLETION_ITEMS,
  MIN_PREFIX_LENGTH_FOR_CPP_QUERY,
} from "./utils";
import ScopeTracker from "./scopeTracker";

/**
 * C-Next keywords for autocomplete
 * Note: Excludes C keywords that are NOT part of C-Next:
 * - namespace, class (use scope instead)
 * - break, continue, goto (not allowed - no unstructured control flow)
 * - static, extern, inline, typedef (not in C-Next)
 */
const KEYWORDS = [
  "register",
  "scope",
  "struct",
  "enum",
  "bitmap",
  "if",
  "else",
  "for",
  "while",
  "do",
  "switch",
  "case",
  "default",
  "return",
  "const",
  "volatile",
  "sizeof",
  "atomic",
  "critical",
  "public",
  "private",
  "this",
  "global",
];

/**
 * C-Next primitive types
 */
const TYPES = [
  "u8",
  "u16",
  "u32",
  "u64",
  "i8",
  "i16",
  "i32",
  "i64",
  "f32",
  "f64",
  "bool",
  "void",
  "string",
  "ISR",
  "bitmap8",
  "bitmap16",
  "bitmap24",
  "bitmap32",
];

/**
 * Register access modifiers
 */
const ACCESS_MODIFIERS = ["rw", "ro", "wo", "w1c", "w1s"];

/**
 * Boolean and null literals
 */
const LITERALS = ["true", "false", "NULL"];

/**
 * Overflow behavior modifiers (ADR-044)
 */
const OVERFLOW_MODIFIERS = ["clamp", "wrap"];

/**
 * Common Arduino symbols that might not be returned by executeCompletionItemProvider
 * These serve as a fallback to ensure essential Arduino functions appear
 */
const ARDUINO_GLOBALS: Array<{
  name: string;
  kind: vscode.CompletionItemKind;
  detail: string;
}> = [
  {
    name: "Serial",
    kind: vscode.CompletionItemKind.Variable,
    detail: "USB serial port (usb_serial_class)",
  },
  {
    name: "Serial1",
    kind: vscode.CompletionItemKind.Variable,
    detail: "Hardware serial port 1",
  },
  {
    name: "Serial2",
    kind: vscode.CompletionItemKind.Variable,
    detail: "Hardware serial port 2",
  },
  {
    name: "pinMode",
    kind: vscode.CompletionItemKind.Function,
    detail: "void pinMode(uint8_t pin, uint8_t mode)",
  },
  {
    name: "digitalWrite",
    kind: vscode.CompletionItemKind.Function,
    detail: "void digitalWrite(uint8_t pin, uint8_t val)",
  },
  {
    name: "digitalRead",
    kind: vscode.CompletionItemKind.Function,
    detail: "int digitalRead(uint8_t pin)",
  },
  {
    name: "analogRead",
    kind: vscode.CompletionItemKind.Function,
    detail: "int analogRead(uint8_t pin)",
  },
  {
    name: "analogWrite",
    kind: vscode.CompletionItemKind.Function,
    detail: "void analogWrite(uint8_t pin, int val)",
  },
  {
    name: "delay",
    kind: vscode.CompletionItemKind.Function,
    detail: "void delay(uint32_t msec)",
  },
  {
    name: "delayMicroseconds",
    kind: vscode.CompletionItemKind.Function,
    detail: "void delayMicroseconds(uint32_t usec)",
  },
  {
    name: "millis",
    kind: vscode.CompletionItemKind.Function,
    detail: "uint32_t millis(void)",
  },
  {
    name: "micros",
    kind: vscode.CompletionItemKind.Function,
    detail: "uint32_t micros(void)",
  },
  {
    name: "HIGH",
    kind: vscode.CompletionItemKind.Constant,
    detail: "Digital HIGH (1)",
  },
  {
    name: "LOW",
    kind: vscode.CompletionItemKind.Constant,
    detail: "Digital LOW (0)",
  },
  {
    name: "INPUT",
    kind: vscode.CompletionItemKind.Constant,
    detail: "Pin mode INPUT",
  },
  {
    name: "OUTPUT",
    kind: vscode.CompletionItemKind.Constant,
    detail: "Pin mode OUTPUT",
  },
  {
    name: "INPUT_PULLUP",
    kind: vscode.CompletionItemKind.Constant,
    detail: "Pin mode INPUT with internal pull-up",
  },
  {
    name: "INPUT_PULLDOWN",
    kind: vscode.CompletionItemKind.Constant,
    detail: "Pin mode INPUT with internal pull-down",
  },
  {
    name: "LED_BUILTIN",
    kind: vscode.CompletionItemKind.Constant,
    detail: "Built-in LED pin number",
  },
];

/**
 * Map symbol kind to VS Code completion item kind
 */
function mapToCompletionKind(kind: TSymbolKind): vscode.CompletionItemKind {
  switch (kind) {
    case "namespace":
      return vscode.CompletionItemKind.Module;
    case "struct":
      return vscode.CompletionItemKind.Struct;
    case "register":
      return vscode.CompletionItemKind.Module;
    case "function":
    case "method":
      return vscode.CompletionItemKind.Function;
    case "variable":
    case "field":
      return vscode.CompletionItemKind.Variable;
    case "registerMember":
      return vscode.CompletionItemKind.Field;
    default:
      return vscode.CompletionItemKind.Text;
  }
}

/**
 * Create a completion item from a symbol
 */
function createSymbolCompletion(symbol: ISymbolInfo): vscode.CompletionItem {
  const item = new vscode.CompletionItem(
    symbol.name,
    mapToCompletionKind(symbol.kind),
  );

  // Build detail string
  if (symbol.kind === "function" || symbol.kind === "method") {
    item.detail =
      symbol.signature || `${symbol.type || "void"} ${symbol.name}()`;
    item.insertText = symbol.name + (symbol.kind === "function" ? "()" : "()");
  } else if (symbol.kind === "registerMember") {
    const access = symbol.accessModifier || "rw";
    item.detail = `${symbol.type || "u32"} ${access}`;
    item.documentation = new vscode.MarkdownString(
      `**Register member** \`${symbol.fullName}\`\n\n` +
        `Access: ${getAccessDescription(access)}`,
    );
  } else if (symbol.kind === "variable" || symbol.kind === "field") {
    item.detail = symbol.type || "unknown";
  } else {
    item.detail = symbol.kind;
  }

  return item;
}

/**
 * C-Next Completion Provider
 * Provides context-aware autocomplete for C-Next source files
 * Queries C/C++ extension for stdlib and Arduino completions via generated .c/.cpp files
 */
export default class CNextCompletionProvider
  implements vscode.CompletionItemProvider
{
  constructor(
    private workspaceIndex?: WorkspaceIndex,
    private extensionContext?: CNextExtensionContext,
  ) {}

  /**
   * Log debug messages to the output channel and console
   */
  private debug(message: string): void {
    if (this.extensionContext) {
      this.extensionContext.debug(message);
    }
    console.log(message);
  }

  /**
   * Find the output file path (.c or .cpp) for a .cnx document
   * Uses cache if current files don't exist (allows completions during parse errors)
   */
  private findOutputFilePath(document: vscode.TextDocument): string | null {
    const outputPathCache =
      this.extensionContext?.lastGoodOutputPath ?? new Map<string, string>();
    return findOutputPath(
      document.uri.fsPath,
      document.uri.toString(),
      outputPathCache,
    );
  }

  /**
   * Provide completion items for the given position
   */
  async provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken,
    context: vscode.CompletionContext,
  ): Promise<vscode.CompletionItem[]> {
    if (token.isCancellationRequested) return [];

    const lineText = document.lineAt(position).text;
    const linePrefix = lineText.substring(0, position.character);

    this.debug(
      `C-Next: provideCompletionItems called, linePrefix="${linePrefix}"`,
    );

    // Parse document to get symbols
    const source = document.getText();
    const parseResult = parseWithSymbols(source);
    const symbols = parseResult.symbols;

    // Determine current scope context for this/global resolution
    const currentScope = ScopeTracker.getCurrentScope(source, position.line);
    this.debug(
      `C-Next DEBUG: Current scope at cursor: ${currentScope ?? "global"}`,
    );

    // Determine current function (to filter from completions - no recursion allowed)
    const currentFunction = ScopeTracker.getCurrentFunction(
      source,
      position.line,
    );
    this.debug(
      `C-Next DEBUG: Current function at cursor: ${currentFunction ?? "none"}`,
    );

    // Check for member access context (after a dot)
    // Captures chained access like "this.GPIO7." as well as simple "this."
    // Pattern: capture everything before the final dot, then the partial after
    const memberMatch = linePrefix.match(/((?:\w+\.)+)\s*(\w*)$/);
    this.debug(
      `C-Next DEBUG: memberMatch result: ${memberMatch ? JSON.stringify(memberMatch) : "null"}`,
    );

    if (memberMatch) {
      // Parse the chain: "this.GPIO7." -> ["this", "GPIO7"]
      const chainStr = memberMatch[1]; // e.g., "this.GPIO7."
      const chain = chainStr.split(".").filter((s) => s.length > 0);
      const partialMember = memberMatch[2];
      this.debug(
        `C-Next DEBUG: Detected member access - chain=[${chain.join(", ")}], partial="${partialMember}"`,
      );

      // Get C-Next member completions (handles this/global and chained access)
      const cnextMembers = this.getMemberCompletions(
        symbols,
        chain,
        currentScope,
        currentFunction,
      );
      this.debug(
        `C-Next DEBUG: getMemberCompletions returned ${cnextMembers.length} items`,
      );

      // If we found C-Next members, use ONLY those (e.g., GPIO7_CNX.DR)
      // This prevents polluting register completions with C/C++ noise
      if (cnextMembers.length > 0) {
        return cnextMembers;
      }

      // For this/global with no results, don't fall back to C++ (would be confusing)
      if (chain[0] === "this" || chain[0] === "global") {
        return [];
      }

      // No C-Next members found - fall back to C/C++ extension (e.g., Serial.begin)
      // Pass the last element of chain as parentName for C++ lookup
      const cppMembers = await this.queryCExtensionCompletions(
        document,
        position,
        context,
        chain.at(-1)!,
      );
      return cppMembers;
    }

    // Check if we're in a register member context (after access modifier)
    if (this.isInRegisterContext(linePrefix)) {
      return this.getAccessModifierCompletions();
    }

    // Check if we're in a type context
    if (this.isInTypeContext(linePrefix)) {
      return this.getTypeCompletions();
    }

    // Default: return all top-level symbols + keywords + types + header symbols
    const cnextCompletions = this.getGlobalCompletions(symbols, document.uri);
    this.debug(`C-Next: Got ${cnextCompletions.length} C-Next completions`);

    // Get the current word prefix for filtering C/C++ completions
    const wordMatch = linePrefix.match(/(\w+)$/);
    const prefix = wordMatch ? wordMatch[1].toLowerCase() : "";
    this.debug(`C-Next: Word prefix="${prefix}", length=${prefix.length}`);

    // Only query C/C++ if user has typed at least 2 characters (reduces noise)
    if (prefix.length >= MIN_PREFIX_LENGTH_FOR_CPP_QUERY) {
      this.debug(`C-Next: Querying C/C++ extension for prefix "${prefix}"`);
      const cppCompletions = await this.queryCExtensionGlobalCompletions(
        document,
        prefix,
      );
      this.debug(`C-Next: Got ${cppCompletions.length} C/C++ completions`);
      const merged = this.mergeCompletions(cnextCompletions, cppCompletions);
      this.debug(`C-Next: Returning ${merged.length} total completions`);
      return merged;
    }

    this.debug(`C-Next: Prefix too short, returning only C-Next completions`);
    return cnextCompletions;
  }

  /**
   * Resolve a chained member access path like "this.GPIO7.DataRegister" to the fully qualified parent name
   * Uses TYPE-AWARE resolution: looks up each symbol's type to determine the next parent
   *
   * @param chain Array of identifiers like ["this", "GPIO7", "DataRegister"]
   * @param currentScope The current scope name (e.g., "Teensy4")
   * @param symbols Available symbols for lookup
   * @returns Fully qualified parent name for finding members, or null if invalid
   */
  private resolveChainedAccess(
    chain: string[],
    currentScope: string | null,
    symbols: ISymbolInfo[],
  ): string | null {
    if (chain.length === 0) return null;

    let currentParent: string;

    // Start resolution based on first element
    if (chain[0] === "this") {
      if (!currentScope) return null;
      currentParent = currentScope;
    } else if (chain[0] === "global") {
      // global.X means X is a top-level symbol
      if (chain.length === 1) return null;
      // For global, start with empty parent (top-level)
      currentParent = "";
    } else {
      // Regular identifier - start from it directly
      currentParent = chain[0];
    }

    this.debug(
      `C-Next DEBUG: Resolving chain [${chain.join(", ")}], starting parent="${currentParent}"`,
    );

    // Resolve each subsequent element using type-aware lookup
    const startIndex = chain[0] === "global" ? 1 : 1;
    for (let i = startIndex; i < chain.length; i++) {
      const memberName = chain[i];
      const parentToMatch = currentParent; // Capture current value for callback

      // Find the symbol for this member
      // For scoped members, look for: parent_memberName or just memberName with matching parent
      let symbol: ISymbolInfo | undefined;

      if (parentToMatch === "") {
        // Global scope - find top-level symbol
        symbol = symbols.find((s) => s.name === memberName && !s.parent);
      } else {
        // Scoped - find symbol with matching parent
        symbol = symbols.find(
          (s) => s.name === memberName && s.parent === parentToMatch,
        );
      }

      this.debug(
        `C-Next DEBUG:   Step ${i}: Looking for "${memberName}" with parent="${currentParent}" -> ${symbol ? `found (kind=${symbol.kind}, type=${symbol.type})` : "not found"}`,
      );

      if (!symbol) {
        // Symbol not found - try the simple underscore concatenation as fallback
        currentParent = currentParent
          ? `${currentParent}_${memberName}`
          : memberName;
        this.debug(
          `C-Next DEBUG:   Fallback: concatenated to "${currentParent}"`,
        );
        continue;
      }

      // Determine the next parent based on symbol kind and type
      if (symbol.kind === "register" || symbol.kind === "namespace") {
        // For registers/namespaces, the parent for children is scope_name
        currentParent = currentParent
          ? `${currentParent}_${memberName}`
          : memberName;
      } else if (
        symbol.fullName &&
        symbols.some((s) => s.parent === symbol.fullName)
      ) {
        // Symbol has a fullName and there are children using it as parent
        // This handles bitmap/struct TYPE definitions whose fields use fullName as parent
        currentParent = symbol.fullName;
        this.debug(
          `C-Next DEBUG:   Using fullName: "${memberName}" -> parent="${currentParent}"`,
        );
      } else if (symbol.type) {
        // For typed members (registerMember, variable, field), use the TYPE
        // The type needs to be qualified with the scope if it's a scoped type
        const typeName = symbol.type;

        // Check if this type exists as a scoped type (e.g., GPIO7Pins -> Teensy4_GPIO7Pins)
        const scopedTypeName = currentScope
          ? `${currentScope}_${typeName}`
          : typeName;

        // Find the type symbol - could be named either way
        const typeSymbol = symbols.find(
          (s) => s.name === scopedTypeName || s.name === typeName,
        );

        if (typeSymbol) {
          // Use the FULLY QUALIFIED name: if the type symbol has a parent, combine them
          // e.g., symbol named "GPIO7Pins" with parent "Teensy4" -> "Teensy4_GPIO7Pins"
          if (typeSymbol.parent) {
            currentParent = `${typeSymbol.parent}_${typeSymbol.name}`;
          } else {
            currentParent = typeSymbol.name;
          }
          this.debug(
            `C-Next DEBUG:   Type-aware: "${memberName}" has type "${typeName}" -> parent="${currentParent}"`,
          );
        } else {
          // Type not found as symbol, just use the type name with scope prefix
          currentParent = scopedTypeName;
          this.debug(
            `C-Next DEBUG:   Type "${typeName}" not found as symbol, using "${currentParent}"`,
          );
        }
      } else {
        // No type info - fall back to underscore concatenation
        currentParent = currentParent
          ? `${currentParent}_${memberName}`
          : memberName;
      }
    }

    this.debug(
      `C-Next DEBUG: Resolved chain [${chain.join(", ")}] to "${currentParent}"`,
    );
    return currentParent;
  }

  /**
   * Get completions for member access (after a dot)
   * Handles special keywords: this (current scope) and global (top-level)
   * Supports chained access like this.GPIO7.
   *
   * @param symbols All available symbols
   * @param chain The member access chain (e.g., ["this", "GPIO7"] for "this.GPIO7.")
   * @param currentScope Current scope name (e.g., "Teensy4")
   * @param currentFunction Current function name (to filter out - no recursion)
   */
  private getMemberCompletions(
    symbols: ISymbolInfo[],
    chain: string[],
    currentScope: string | null,
    currentFunction: string | null,
  ): vscode.CompletionItem[] {
    this.debug(
      `C-Next DEBUG: getMemberCompletions called with chain=[${chain.join(", ")}], currentScope="${currentScope}", currentFunction="${currentFunction}"`,
    );
    this.debug(`C-Next DEBUG: Total symbols available: ${symbols.length}`);

    // Debug: log all unique parent values
    const uniqueParents = [
      ...new Set(symbols.map((s) => s.parent ?? "<no-parent>")),
    ];
    this.debug(
      `C-Next DEBUG: Unique parent values: ${uniqueParents.join(", ")}`,
    );

    if (chain.length === 0) {
      return [];
    }

    // Handle single-element chains (simple member access)
    if (chain.length === 1) {
      const parentName = chain[0];

      // Handle special keyword: this
      if (parentName === "this") {
        if (!currentScope) {
          this.debug(
            'C-Next DEBUG: "this." used outside of scope - no completions',
          );
          return [];
        }
        this.debug(
          `C-Next DEBUG: "this." resolving to scope "${currentScope}"`,
        );

        // Find all symbols that belong to the current scope
        // Filter out the current function (no recursion allowed)
        const scopeMembers = symbols.filter(
          (s) =>
            s.parent === currentScope &&
            !(s.kind === "function" && s.name === currentFunction),
        );
        this.debug(
          `C-Next DEBUG: Found ${scopeMembers.length} members for scope "${currentScope}"`,
        );
        scopeMembers.forEach((s) =>
          this.debug(
            `C-Next DEBUG:   - ${s.name} (${s.kind}, parent=${s.parent})`,
          ),
        );
        return scopeMembers.map(createSymbolCompletion);
      }

      // Handle special keyword: global
      if (parentName === "global") {
        this.debug('C-Next DEBUG: "global." showing top-level symbols');

        // Find all top-level symbols (no parent, excluding scope definitions themselves)
        // Also filter out current function if at global level
        const globalSymbols = symbols.filter(
          (s) =>
            !s.parent &&
            s.kind !== "namespace" &&
            !(s.kind === "function" && s.name === currentFunction),
        );
        this.debug(
          `C-Next DEBUG: Found ${globalSymbols.length} global symbols`,
        );
        globalSymbols.forEach((s) =>
          this.debug(`C-Next DEBUG:   - ${s.name} (${s.kind})`),
        );
        return globalSymbols.map(createSymbolCompletion);
      }

      // Regular member access: find all symbols with this parent
      const members = symbols.filter((s) => s.parent === parentName);
      this.debug(
        `C-Next DEBUG: Found ${members.length} members with parent="${parentName}"`,
      );

      if (members.length > 0) {
        return members.map(createSymbolCompletion);
      }

      // Check if parentName is a known namespace/class/register
      const parentSymbol = symbols.find(
        (s) => s.name === parentName && !s.parent,
      );
      if (parentSymbol) {
        const memberSymbols = symbols.filter((s) => s.parent === parentName);
        this.debug(
          `C-Next DEBUG: Found parent symbol "${parentName}", ${memberSymbols.length} members`,
        );
        return memberSymbols.map(createSymbolCompletion);
      }

      this.debug(`C-Next DEBUG: No members found for parent="${parentName}"`);
      return [];
    }

    // Handle chained access (e.g., this.GPIO7.)
    // Resolve the chain to a fully qualified parent name
    const resolvedParent = this.resolveChainedAccess(
      chain,
      currentScope,
      symbols,
    );
    if (!resolvedParent) {
      this.debug(`C-Next DEBUG: Could not resolve chain [${chain.join(", ")}]`);
      return [];
    }

    this.debug(
      `C-Next DEBUG: Looking for members with parent="${resolvedParent}"`,
    );

    // Find all symbols with the resolved parent
    const members = symbols.filter((s) => s.parent === resolvedParent);
    this.debug(
      `C-Next DEBUG: Found ${members.length} members for resolved parent "${resolvedParent}"`,
    );
    members.forEach((s) =>
      this.debug(`C-Next DEBUG:   - ${s.name} (${s.kind})`),
    );

    return members.map(createSymbolCompletion);
  }

  /**
   * Get completions for register access modifiers
   */
  private getAccessModifierCompletions(): vscode.CompletionItem[] {
    return ACCESS_MODIFIERS.map((mod) => {
      const item = new vscode.CompletionItem(
        mod,
        vscode.CompletionItemKind.Keyword,
      );
      item.detail = getAccessDescription(mod);
      return item;
    });
  }

  /**
   * Get completions for type contexts
   */
  private getTypeCompletions(): vscode.CompletionItem[] {
    return TYPES.map((type) => {
      const item = new vscode.CompletionItem(
        type,
        vscode.CompletionItemKind.TypeParameter,
      );
      item.detail = "C-Next type";
      return item;
    });
  }

  /**
   * Get global completions (keywords, types, top-level symbols, header symbols)
   */
  private getGlobalCompletions(
    symbols: ISymbolInfo[],
    documentUri?: vscode.Uri,
  ): vscode.CompletionItem[] {
    const items: vscode.CompletionItem[] = [];

    // Add keywords
    for (const keyword of KEYWORDS) {
      const item = new vscode.CompletionItem(
        keyword,
        vscode.CompletionItemKind.Keyword,
      );
      item.detail = "keyword";
      items.push(item);
    }

    // Add types
    for (const type of TYPES) {
      const item = new vscode.CompletionItem(
        type,
        vscode.CompletionItemKind.TypeParameter,
      );
      item.detail = "type";
      items.push(item);
    }

    // Add boolean and null literals
    for (const lit of LITERALS) {
      const item = new vscode.CompletionItem(
        lit,
        vscode.CompletionItemKind.Constant,
      );
      item.detail = lit === "true" || lit === "false" ? "bool" : "null pointer";
      items.push(item);
    }

    // Add overflow modifiers
    for (const mod of OVERFLOW_MODIFIERS) {
      const item = new vscode.CompletionItem(
        mod,
        vscode.CompletionItemKind.Keyword,
      );
      item.detail = "overflow modifier";
      items.push(item);
    }

    // Add top-level symbols (no parent)
    const topLevel = symbols.filter((s) => !s.parent);
    for (const sym of topLevel) {
      items.push(createSymbolCompletion(sym));
    }

    // Add symbols from included headers
    if (this.workspaceIndex && documentUri) {
      const headerSymbols = this.workspaceIndex.getIncludedSymbols(documentUri);
      for (const sym of headerSymbols) {
        const item = createSymbolCompletion(sym);
        // Mark as coming from a header
        if (sym.sourceFile) {
          item.detail = `${item.detail || ""} (${path.basename(sym.sourceFile)})`;
        }
        items.push(item);
      }
    }

    return items;
  }

  /**
   * Check if cursor is in a register member definition context
   */
  private isInRegisterContext(linePrefix: string): boolean {
    // Inside register block, after type declaration
    // e.g., "    DR: u32 " <- expecting access modifier
    return /^\s+\w+\s*:\s*\w+\s+$/.test(linePrefix);
  }

  /**
   * Check if cursor is in a type context
   */
  private isInTypeContext(linePrefix: string): boolean {
    // After colon in register member: "DR: "
    if (/:\s*$/.test(linePrefix)) {
      return true;
    }
    // At start of variable declaration (simplified check)
    if (/^\s*$/.test(linePrefix)) {
      return true;
    }
    return false;
  }

  /**
   * Query the C/C++ extension for completions via the generated .c/.cpp file
   * This gives us Arduino functions, stdlib functions, etc. automatically
   *
   * @param parentName For member access (e.g., "Serial" for "Serial."), search for this in output file
   */
  private async queryCExtensionCompletions(
    document: vscode.TextDocument,
    position: vscode.Position,
    context: vscode.CompletionContext,
    parentName?: string,
  ): Promise<vscode.CompletionItem[]> {
    // Find the output file (uses cache if current file has parse errors)
    const outputPath = this.findOutputFilePath(document);
    if (!outputPath) {
      return [];
    }

    try {
      const outputUri = vscode.Uri.file(outputPath);
      let queryPosition = position;

      // For member access, find the parent symbol in the output file
      // This handles line number mismatches between .cnx and output
      if (parentName) {
        const outputSource = fs.readFileSync(outputPath, "utf-8");
        const memberPosition = this.findMemberAccessPosition(
          outputSource,
          parentName,
        );
        this.debug(`C-Next: Looking for "${parentName}." in output file`);
        if (memberPosition) {
          queryPosition = memberPosition;
          this.debug(
            `C-Next: Found "${parentName}." at ${memberPosition.line}:${memberPosition.character}`,
          );
        } else {
          this.debug(`C-Next: "${parentName}." not found in output file`);
          // Parent not found in output - can't provide completions
          return [];
        }
      }

      // Query the C/C++ extension's completion provider
      const completionList =
        await vscode.commands.executeCommand<vscode.CompletionList>(
          "vscode.executeCompletionItemProvider",
          outputUri,
          queryPosition,
          context.triggerCharacter || ".",
        );

      this.debug(
        `C-Next: Member completion query returned ${completionList?.items?.length || 0} items`,
      );

      if (completionList?.items) {
        // Log first few items for debugging
        const firstFew = completionList.items
          .slice(0, 5)
          .map((i) => getCompletionLabel(i.label));
        this.debug(
          `C-Next: First 5 member completions: ${firstFew.join(", ")}`,
        );

        // Mark items as coming from C/C++ extension
        return completionList.items.map((item) => {
          // Clone the item to avoid modifying the original
          const newItem = new vscode.CompletionItem(
            getCompletionLabel(item.label),
            item.kind,
          );
          newItem.detail = item.detail;
          newItem.documentation = item.documentation;
          newItem.insertText = item.insertText;
          newItem.filterText = item.filterText;
          newItem.sortText = item.sortText;
          newItem.preselect = item.preselect;
          // Add a marker to show this came from C/C++
          if (!newItem.detail) {
            newItem.detail = "(C/C++)";
          }
          return newItem;
        });
      }
    } catch (err) {
      // Silently fail - C/C++ extension might not be installed
      console.error("C-Next: Failed to query C/C++ completions:", err);
    }

    return [];
  }

  /**
   * Query C/C++ extension for global completions (e.g., Serial, pinMode, delay)
   * Queries at a position after includes and filters by prefix
   */
  private async queryCExtensionGlobalCompletions(
    document: vscode.TextDocument,
    prefix: string,
  ): Promise<vscode.CompletionItem[]> {
    this.debug(
      `C-Next: queryCExtensionGlobalCompletions called with prefix="${prefix}"`,
    );

    // Find the output file (uses cache if current file has parse errors)
    const outputPath = this.findOutputFilePath(document);
    this.debug(`C-Next: findOutputPath returned: ${outputPath}`);
    if (!outputPath) {
      console.log("C-Next: No output path found, returning empty");
      return [];
    }

    try {
      const outputUri = vscode.Uri.file(outputPath);

      // Open the document to ensure C/C++ extension has it indexed
      const outputDoc = await vscode.workspace.openTextDocument(outputUri);
      const outputSource = outputDoc.getText();

      // Find a position inside a function body where global objects are valid
      const queryPosition = this.findPositionInsideFunction(outputSource);
      this.debug(
        `C-Next: Querying C/C++ at position ${queryPosition.line}:${queryPosition.character}`,
      );

      // Query C/C++ extension with trigger character to simulate typing
      const completionList =
        await vscode.commands.executeCommand<vscode.CompletionList>(
          "vscode.executeCompletionItemProvider",
          outputUri,
          queryPosition,
          prefix.charAt(0), // Pass first char as trigger
        );

      this.debug(
        `C-Next: C/C++ returned ${completionList?.items?.length || 0} items`,
      );

      const allItems: vscode.CompletionItem[] = [];

      if (completionList?.items) {
        // Add filtered completion items
        for (const item of completionList.items) {
          const label = getCompletionLabel(item.label);
          if (label.toLowerCase().startsWith(prefix)) {
            const newItem = new vscode.CompletionItem(label, item.kind);
            newItem.detail = item.detail || "(C/C++)";
            newItem.documentation = item.documentation;
            newItem.insertText = item.insertText;
            allItems.push(newItem);
          }
        }
      }

      // Also query workspace symbols to find globals like Serial
      this.debug(`C-Next: Querying workspace symbols for "${prefix}"`);
      const symbols = await vscode.commands.executeCommand<
        vscode.SymbolInformation[]
      >("vscode.executeWorkspaceSymbolProvider", prefix);

      if (symbols?.length) {
        this.debug(`C-Next: Found ${symbols.length} workspace symbols`);

        // Add symbols that aren't already in completions
        const existingLabels = new Set(
          allItems.map((i) => getCompletionLabel(i.label)),
        );

        for (const sym of symbols) {
          if (
            !existingLabels.has(sym.name) &&
            sym.name.toLowerCase().startsWith(prefix)
          ) {
            const kind = this.mapSymbolKindToCompletionKind(sym.kind);
            const item = new vscode.CompletionItem(sym.name, kind);
            item.detail = `(${vscode.SymbolKind[sym.kind]})`;
            allItems.push(item);
          }
        }
      }

      // Add Arduino globals as fallback if they match prefix
      // These ensure essential Arduino symbols appear even if C/C++ extension doesn't return them
      const existingLabels = new Set(
        allItems.map((i) => getCompletionLabel(i.label)),
      );

      for (const arduino of ARDUINO_GLOBALS) {
        if (
          arduino.name.toLowerCase().startsWith(prefix) &&
          !existingLabels.has(arduino.name)
        ) {
          const item = new vscode.CompletionItem(arduino.name, arduino.kind);
          item.detail = arduino.detail;
          allItems.push(item);
          this.debug(`C-Next: Added Arduino fallback: ${arduino.name}`);
        }
      }

      // Limit results
      const limited = allItems.slice(0, MAX_GLOBAL_COMPLETION_ITEMS);
      this.debug(`C-Next: Returning ${limited.length} total items`);
      return limited;
    } catch (err) {
      console.error("C-Next: Failed to query C/C++ global completions:", err);
    }

    return [];
  }

  /**
   * Map VS Code SymbolKind to CompletionItemKind
   */
  private mapSymbolKindToCompletionKind(
    kind: vscode.SymbolKind,
  ): vscode.CompletionItemKind {
    switch (kind) {
      case vscode.SymbolKind.Class:
        return vscode.CompletionItemKind.Class;
      case vscode.SymbolKind.Function:
      case vscode.SymbolKind.Method:
        return vscode.CompletionItemKind.Function;
      case vscode.SymbolKind.Variable:
      case vscode.SymbolKind.Field:
        return vscode.CompletionItemKind.Variable;
      case vscode.SymbolKind.Constant:
        return vscode.CompletionItemKind.Constant;
      case vscode.SymbolKind.Struct:
        return vscode.CompletionItemKind.Struct;
      case vscode.SymbolKind.Enum:
        return vscode.CompletionItemKind.Enum;
      case vscode.SymbolKind.Module:
      case vscode.SymbolKind.Namespace:
        return vscode.CompletionItemKind.Module;
      default:
        return vscode.CompletionItemKind.Variable;
    }
  }

  /**
   * Find a position inside a function body where global objects like Serial are valid
   * Returns position at the START of a line inside a function body (where new statements go)
   */
  private findPositionInsideFunction(source: string): vscode.Position {
    const lines = source.split("\n");

    // Strategy: Find a function body and position at the start of an indented line
    // This simulates where a user would type a new statement
    let inFunction = false;
    let braceDepth = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Track function entry
      if (
        trimmed.match(
          /^(void|int|bool|char|float|double|uint\d+_t|int\d+_t)\s+\w+\s*\([^)]*\)\s*\{?$/,
        )
      ) {
        inFunction = true;
      }

      // Track braces
      for (const ch of line) {
        if (ch === "{") braceDepth++;
        if (ch === "}") braceDepth--;
      }

      // If we're inside a function (braceDepth > 0) and see an indented line
      // Return position at the START of the indentation (where typing begins)
      if (
        inFunction &&
        braceDepth > 0 &&
        /^\s{4,}/.test(line) &&
        trimmed.length > 0 &&
        !trimmed.startsWith("//")
      ) {
        // Find the indentation level
        const indent = line.match(/^(\s+)/)?.[1].length || 4;
        this.debug(
          `C-Next: Querying inside function at line ${i}, indent ${indent}: "${trimmed.substring(0, 20)}..."`,
        );
        return new vscode.Position(i, indent);
      }
    }

    // Fallback: look for opening brace of a function and position after it
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (
        line.includes("{") &&
        (line.includes("void ") ||
          line.includes("int ") ||
          line.includes("setup") ||
          line.includes("loop"))
      ) {
        this.debug(`C-Next: Found function opening at line ${i}`);
        return new vscode.Position(i + 1, 4); // Position inside function with indent
      }
    }

    this.debug(`C-Next: Fallback to line 0`);
    return new vscode.Position(0, 0);
  }

  /**
   * Find a position in the source where we can query member completions
   * Searches for "parentName." and returns the position right after the dot
   */
  private findMemberAccessPosition(
    source: string,
    parentName: string,
  ): vscode.Position | null {
    const lines = source.split("\n");
    const pattern = new RegExp("\\b" + escapeRegex(parentName) + "\\.");

    for (let lineNum = 0; lineNum < lines.length; lineNum++) {
      const line = lines[lineNum];
      const match = pattern.exec(line);

      if (match) {
        // Return position right after the dot
        const dotPosition = match.index + parentName.length + 1;
        return new vscode.Position(lineNum, dotPosition);
      }
    }

    return null;
  }

  /**
   * Merge C-Next and C/C++ completions, preferring C-Next items for duplicates
   */
  private mergeCompletions(
    cnextItems: vscode.CompletionItem[],
    cppItems: vscode.CompletionItem[],
  ): vscode.CompletionItem[] {
    // Build a set of C-Next item names for deduplication
    const cnextNames = new Set(
      cnextItems.map((item) => getCompletionLabel(item.label)),
    );

    // Filter out C++ items that duplicate C-Next items
    const uniqueCppItems = cppItems.filter((item) => {
      const name = getCompletionLabel(item.label);
      return !cnextNames.has(name);
    });

    // C-Next items first (higher priority), then C++ items
    return [...cnextItems, ...uniqueCppItems];
  }
}
