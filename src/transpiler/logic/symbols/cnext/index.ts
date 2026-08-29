/**
 * CNextResolver - Orchestrates symbol collection from C-Next parse trees.
 * Uses two-pass collection to handle forward references (bitmaps before registers).
 *
 * Produces TType-based symbols with proper IScopeSymbol references.
 */

import * as Parser from "../../parser/grammar/CNextParser";
import ScopeUtils from "../../../../utils/ScopeUtils";
import TSymbol from "../../../types/symbols/TSymbol";
import SymbolRegistry from "../../../state/SymbolRegistry";
import LiteralUtils from "../../../../utils/LiteralUtils";
import BitmapCollector from "./collectors/BitmapCollector";
import EnumCollector from "./collectors/EnumCollector";
import StructCollector from "./collectors/StructCollector";
import FunctionCollector from "./collectors/FunctionCollector";
import VariableCollector from "./collectors/VariableCollector";
import RegisterCollector from "./collectors/RegisterCollector";
import ScopeCollector from "./collectors/ScopeCollector";
import QualifiedCName from "../../../../utils/QualifiedCName";
import TYPE_FORMING_KINDS from "../TYPE_FORMING_KINDS";
import TSymbolKindCNext from "../../../types/symbol-kinds/TSymbolKindCNext";

/**
 * The declaration node behind any one `scopeMember` alternative.
 *
 * A union of the real parse-tree context types rather than a structural
 * `{ IDENTIFIER(): ... }`: every scopeMember accessor satisfies the structural
 * shape, so a wrong kind/accessor pairing in `byKind` would still compile.
 */
type TScopeMemberDeclaration =
  | Parser.EnumDeclarationContext
  | Parser.StructDeclarationContext
  | Parser.BitmapDeclarationContext
  | Parser.FunctionDeclarationContext
  | Parser.VariableDeclarationContext
  | Parser.RegisterDeclarationContext
  | null;

class CNextResolver {
  /**
   * Resolve all symbols from a C-Next program parse tree.
   *
   * @param tree The program context from the parser
   * @param sourceFile Source file path
   * @returns Array of all collected symbols
   */
  static resolve(
    tree: Parser.ProgramContext,
    sourceFile: string,
    externalScopeTypes?: ReadonlySet<string>,
  ): TSymbol[] {
    const symbols: TSymbol[] = [];
    const knownBitmaps = new Set<string>();
    const constValues = new Map<string, number>();

    // Pass 0: Collect const values (needed for resolving array dimensions)
    CNextResolver.collectConstValuesPass0(tree, constValues);

    // Pass 0b: Collect the qualified names of every type declared inside a
    // scope (ADR-057). This must complete before any type is resolved, so that
    // a bare type name is qualified the same way no matter where its
    // declaration appears relative to its use.
    // #1333: seed with the scope types declared in INCLUDED files. Pass 0b walks
    // one parse tree, which was sufficient only while a scope could not be
    // reopened -- now the other half of a spanned scope lives in another file and
    // this pass cannot see it. Without the seed the symbols layer resolves a bare
    // `Point` unqualified while codegen resolves it to `Lib__Point`, so the `.h`
    // and the `.c` disagree about a function's signature and the file does not
    // compile (CLAUDE.md, "Two resolution points, one decision").
    const scopeTypes = new Set<string>(externalScopeTypes ?? []);
    CNextResolver.collectScopeTypesPass0b(tree, scopeTypes);
    const isScopeType = (qualifiedName: string): boolean =>
      scopeTypes.has(qualifiedName);

    // Pass 1: Collect all bitmap names (needed before registers reference them)
    // This includes bitmaps in scopes
    CNextResolver.collectBitmapsPass1(
      tree,
      sourceFile,
      symbols,
      knownBitmaps,
      constValues,
      isScopeType,
    );

    // Pass 2: Collect everything else (with bitmap set and const values available)
    CNextResolver.collectAllPass2(
      tree,
      sourceFile,
      symbols,
      knownBitmaps,
      constValues,
      isScopeType,
    );

    return symbols;
  }

  /**
   * Pass 0: Collect const values for resolving array dimensions.
   * Only collects simple integer literals - complex expressions are not supported.
   */
  private static collectConstValuesPass0(
    tree: Parser.ProgramContext,
    constValues: Map<string, number>,
  ): void {
    for (const decl of tree.declaration()) {
      // Top-level const variables
      if (decl.variableDeclaration()) {
        CNextResolver._collectConstFromVar(
          decl.variableDeclaration()!,
          undefined,
          constValues,
        );
      }

      // Const variables inside scopes
      if (decl.scopeDeclaration()) {
        CNextResolver._collectConstFromScope(
          decl.scopeDeclaration()!,
          constValues,
        );
      }
    }
  }

  /**
   * Collect const value from a single variable declaration
   */
  private static _collectConstFromVar(
    varCtx: Parser.VariableDeclarationContext,
    scopeName: string | undefined,
    constValues: Map<string, number>,
  ): void {
    if (!varCtx.constModifier()) return;

    const exprCtx = varCtx.expression();
    if (!exprCtx) return;

    const value = LiteralUtils.parseIntegerLiteral(exprCtx.getText());
    if (value === undefined) return;

    const name = varCtx.IDENTIFIER().getText();
    constValues.set(name, value);

    // Store scoped name as well for scoped variables.
    // #1295: keyed by the scope LEAF, like scopeMembers and knownScopes. Left
    // as-is deliberately -- its consumers look up with leaf-built keys too, and
    // moving one side alone would break the pairing.
    if (scopeName) {
      constValues.set(QualifiedCName.join(scopeName, name), value);
    }
  }

  /**
   * Collect const values from all variables in a scope
   */
  private static _collectConstFromScope(
    scopeDecl: Parser.ScopeDeclarationContext,
    constValues: Map<string, number>,
  ): void {
    const scopeName = scopeDecl.IDENTIFIER().getText();
    for (const member of scopeDecl.scopeMember()) {
      if (member.variableDeclaration()) {
        CNextResolver._collectConstFromVar(
          member.variableDeclaration()!,
          scopeName,
          constValues,
        );
      }
    }
  }

  /**
   * The declaration inside a scope member that introduces a TYPE NAME, or null.
   *
   * The kind-to-parse-node mapping lives here; whether that kind forms a type
   * is TYPE_FORMING_KINDS' answer, asked rather than restated. Adding a kind to
   * that set is therefore the whole change -- there is no second list to update.
   */
  private static typeFormingDeclaration(
    member: Parser.ScopeMemberContext,
  ): TScopeMemberDeclaration {
    const byKind: ReadonlyArray<[TSymbolKindCNext, TScopeMemberDeclaration]> = [
      ["enum", member.enumDeclaration()],
      ["struct", member.structDeclaration()],
      ["bitmap", member.bitmapDeclaration()],
      ["function", member.functionDeclaration()],
      // All six `scopeMember` alternatives (grammar/CNext.g4:81-88) are listed
      // so TYPE_FORMING_KINDS is the ONLY thing that excludes a kind. Omitting
      // these two instead would put the exclusion here while the reasoning for
      // it lives in TYPE_FORMING_KINDS -- one file apart, which is the shape
      // this work exists to remove. Listing them costs nothing (both are absent
      // from the set, so behavior is unchanged) and makes the exclusions
      // mutation-testable: adding "variable" to the set now actually changes
      // behavior, and a fixture can fail on it.
      ["variable", member.variableDeclaration()],
      ["register", member.registerDeclaration()],
    ];

    for (const [kind, decl] of byKind) {
      if (decl && TYPE_FORMING_KINDS.has(kind)) {
        return decl;
      }
    }
    return null;
  }

  /**
   * Pass 0b: Collect the qualified name of every *type* declared inside a
   * scope (ADR-057).
   *
   * Which kinds form a type is NOT decided here. It is read from
   * TYPE_FORMING_KINDS, which is the single owner of that question -- this pass
   * previously hardcoded enum/struct/bitmap, and #1281 proposed a fifth
   * parallel set (`knownCallbackTypes`) for the one kind it had missed. ADR-029
   * makes a function definition create a callback type, so `function` is a
   * type-forming kind and belongs in the same answer rather than in a set of
   * its own (#1285).
   *
   * Only type declarations are collected. A scope VARIABLE sharing a leaf name
   * with a global type must not capture that name at a type position, which is
   * why this cannot key on scope membership generally -- `variable` is
   * deliberately absent from TYPE_FORMING_KINDS.
   *
   * Runs before any collector resolves a type so the answer does not depend on
   * whether the declaration appears above or below its use.
   */
  private static collectScopeTypesPass0b(
    tree: Parser.ProgramContext,
    scopeTypes: Set<string>,
  ): void {
    for (const decl of tree.declaration()) {
      const scopeDecl = decl.scopeDeclaration();
      if (!scopeDecl) continue;

      // #1285: resolve the scope through the registry -- the one thing that
      // builds a real parent chain -- rather than joining one level from the
      // parse-tree identifier. The set this fills is queried with chain-built
      // names, so a leaf-built key here never matched at depth two and the
      // lookup fell silently through to the bare name.
      const scope = SymbolRegistry.getOrCreateScope(
        scopeDecl.IDENTIFIER().getText(),
      );
      for (const member of scopeDecl.scopeMember()) {
        const typeDecl = CNextResolver.typeFormingDeclaration(member);
        if (typeDecl) {
          scopeTypes.add(
            ScopeUtils.qualifyInScope(typeDecl.IDENTIFIER().getText(), scope),
          );
        }
      }
    }
  }

  /**
   * Pass 1: Collect all bitmaps (including those in scopes).
   * Also collects structs in scopes early for type availability.
   * SonarCloud S3776: Refactored to use helper methods.
   */
  private static collectBitmapsPass1(
    tree: Parser.ProgramContext,
    sourceFile: string,
    symbols: TSymbol[],
    knownBitmaps: Set<string>,
    constValues: Map<string, number>,
    isScopeType: (qualifiedName: string) => boolean,
  ): void {
    const globalScope = SymbolRegistry.getGlobalScope();

    for (const decl of tree.declaration()) {
      // Top-level bitmaps
      if (decl.bitmapDeclaration()) {
        const bitmapCtx = decl.bitmapDeclaration()!;
        const symbol = BitmapCollector.collect(
          bitmapCtx,
          sourceFile,
          globalScope,
        );
        symbols.push(symbol);
        // Use transpiled C name (global bitmaps have no scope prefix)
        knownBitmaps.add(symbol.name);
      }

      // Bitmaps and structs inside scopes (collected early)
      if (decl.scopeDeclaration()) {
        CNextResolver.collectScopedBitmapsAndStructs(
          decl.scopeDeclaration()!,
          sourceFile,
          symbols,
          knownBitmaps,
          constValues,
          isScopeType,
        );
      }
    }
  }

  /**
   * Collect bitmaps and structs from within a scope declaration.
   * SonarCloud S3776: Extracted from collectBitmapsPass1().
   */
  private static collectScopedBitmapsAndStructs(
    scopeDecl: Parser.ScopeDeclarationContext,
    sourceFile: string,
    symbols: TSymbol[],
    knownBitmaps: Set<string>,
    constValues: Map<string, number>,
    isScopeType: (qualifiedName: string) => boolean,
  ): void {
    const scopeName = scopeDecl.IDENTIFIER().getText();
    const scope = SymbolRegistry.getOrCreateScope(scopeName);

    for (const member of scopeDecl.scopeMember()) {
      if (member.bitmapDeclaration()) {
        const bitmapCtx = member.bitmapDeclaration()!;
        const symbol = BitmapCollector.collect(bitmapCtx, sourceFile, scope);
        symbols.push(symbol);
        // #1285: the symbol was just built and carries its own identity, so
        // read it rather than re-deriving one. The re-derivation here joined a
        // leaf scope name and the stale comment beside it still said
        // "Timer_ControlBits" -- one underscore, from before ADR-063.
        knownBitmaps.add(symbol.fullyQualifiedCName);
      }

      // Collect structs early so they're available as types
      if (member.structDeclaration()) {
        const structCtx = member.structDeclaration()!;
        const symbol = StructCollector.collect(
          structCtx,
          sourceFile,
          scope,
          constValues,
          isScopeType,
        );
        symbols.push(symbol);
      }
    }
  }

  /**
   * Pass 2: Collect all remaining symbols.
   * Bitmaps and scoped structs were already collected in pass 1.
   */
  private static collectAllPass2(
    tree: Parser.ProgramContext,
    sourceFile: string,
    symbols: TSymbol[],
    knownBitmaps: Set<string>,
    constValues: Map<string, number>,
    isScopeType: (qualifiedName: string) => boolean,
  ): void {
    for (const decl of tree.declaration()) {
      // Skip bitmaps (already collected in pass 1)
      if (decl.bitmapDeclaration()) {
        continue;
      }

      CNextResolver._collectDeclaration(
        decl,
        sourceFile,
        symbols,
        knownBitmaps,
        constValues,
        isScopeType,
      );
    }
  }

  /**
   * Collect symbols from a single declaration.
   *
   * Top-level declarations are outside any scope, so ADR-057 scope
   * qualification only applies on the scope path.
   */
  private static _collectDeclaration(
    decl: Parser.DeclarationContext,
    sourceFile: string,
    symbols: TSymbol[],
    knownBitmaps: Set<string>,
    constValues: Map<string, number>,
    isScopeType: (qualifiedName: string) => boolean,
  ): void {
    const globalScope = SymbolRegistry.getGlobalScope();

    // Scopes (ScopeCollector handles nested members)
    if (decl.scopeDeclaration()) {
      CNextResolver._collectScopeDeclaration(
        decl.scopeDeclaration()!,
        sourceFile,
        symbols,
        knownBitmaps,
        constValues,
        isScopeType,
      );
      return;
    }

    // Top-level structs
    if (decl.structDeclaration()) {
      const symbol = StructCollector.collect(
        decl.structDeclaration()!,
        sourceFile,
        globalScope,
        constValues,
      );
      symbols.push(symbol);
      return;
    }

    // Top-level enums
    if (decl.enumDeclaration()) {
      const symbol = EnumCollector.collect(
        decl.enumDeclaration()!,
        sourceFile,
        globalScope,
      );
      symbols.push(symbol);
      return;
    }

    // Top-level registers
    if (decl.registerDeclaration()) {
      const symbol = RegisterCollector.collect(
        decl.registerDeclaration()!,
        sourceFile,
        knownBitmaps,
        globalScope,
      );
      symbols.push(symbol);
      return;
    }

    // Top-level functions
    if (decl.functionDeclaration()) {
      const funcDecl = decl.functionDeclaration()!;
      const body = funcDecl.block();
      // Use collectAndRegister to populate both old symbols and SymbolRegistry
      const symbol = FunctionCollector.collectAndRegister(
        funcDecl,
        sourceFile,
        SymbolRegistry.getGlobalScope(),
        body,
        // ADR-016: functions are public by default (API surface). Scopes are
        // how C-Next expresses privacy — neither `public` nor `private` parses
        // at top level — so this must not be a literal that can drift from the
        // ADR, which is what issue #1161 was.
        ScopeUtils.getDefaultVisibility(true),
      );
      symbols.push(symbol);
      return;
    }

    // Top-level variables
    if (decl.variableDeclaration()) {
      const symbol = VariableCollector.collect(
        decl.variableDeclaration()!,
        sourceFile,
        globalScope,
        true,
        constValues,
      );
      symbols.push(symbol);
    }
  }

  /**
   * Collect scope declaration and its non-bitmap/non-struct members.
   */
  private static _collectScopeDeclaration(
    scopeCtx: Parser.ScopeDeclarationContext,
    sourceFile: string,
    symbols: TSymbol[],
    knownBitmaps: Set<string>,
    constValues: Map<string, number>,
    isScopeType: (qualifiedName: string) => boolean,
  ): void {
    const result = ScopeCollector.collect(
      scopeCtx,
      sourceFile,
      knownBitmaps,
      constValues,
      isScopeType,
    );

    symbols.push(result.scopeSymbol);

    // Add member symbols, but skip bitmaps and structs (already collected in pass 1)
    for (const memberSymbol of result.memberSymbols) {
      if (memberSymbol.kind === "bitmap" || memberSymbol.kind === "struct") {
        continue;
      }
      symbols.push(memberSymbol);
    }
  }
}

export default CNextResolver;
