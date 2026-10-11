/**
 * CNextResolver - Orchestrates symbol collection from C-Next parse trees.
 * Uses two-pass collection to handle forward references (bitmaps before registers).
 *
 * Produces TType-based symbols with proper IScopeSymbol references.
 */

import LexicalScopeCollector from "./collectors/LexicalScopeCollector";
import ModificationCollector from "./collectors/ModificationCollector";
import CallbackUseCollector from "./collectors/CallbackUseCollector";
import * as Parser from "../../2-Parse/grammar/CNextParser";
import ScopeUtils from "../../../utils/ScopeUtils";
import TSymbol from "../../../types/symbols/TSymbol";
import IFileSymbols from "../../../types/IFileSymbols";
import SymbolRegistry from "../SymbolRegistry";
import BitmapCollector from "./collectors/BitmapCollector";
import EnumCollector from "./collectors/EnumCollector";
import StructCollector from "./collectors/StructCollector";
import FunctionCollector from "./collectors/FunctionCollector";
import VariableCollector from "./collectors/VariableCollector";
import RegisterCollector from "./collectors/RegisterCollector";
import ScopeCollector from "./collectors/ScopeCollector";
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
   * @returns `IFileSymbols` -- the symbols this file declares, plus the scope
   *   types it declares. The latter is a per-file fact and travels on the
   *   artifact; the seed it is merged with is cross-file and does not.
   */
  static resolve(
    tree: Parser.ProgramContext,
    sourceFile: string,
    registry: SymbolRegistry,
  ): IFileSymbols {
    const symbols: TSymbol[] = [];
    const knownBitmaps = new Set<string>();
    // There is no const pass. A dimension naming a const keeps its text here
    // and 1.4 folds it, once, with the consts visible where it is declared:
    // the scope's own over file scope's, and a block's locals over both
    // (#1664 box 7). A fold here saw one file, one bare key for every scope
    // (#1538), and no local at all.

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
    // #1472: what THIS FILE declares is collected on its own, into its own set.
    // It is the per-file half of the question, so it is the half that can travel
    // on `IFileSymbols`; the seed cannot, being a union across an include
    // closure. Collecting into one shared set made "declared here" and "visible
    // here" the same object, so neither could be read back afterwards.
    const declaredScopeTypes = new Set<string>();
    CNextResolver.collectScopeTypesPass0b(registry, tree, declaredScopeTypes);

    // What this file can SEE: its own declarations plus its includes'. Same set
    // as before the split, built in the other order -- union is commutative, so
    // every resolution below is unchanged.
    // #1472: what this file DECLARES is the whole answer available here. A
    // bare name this set does not contain is not "not a scope type" -- it may
    // name one declared in an included file -- so `TypeUtils.resolveType`
    // records it as deferred and 1.4 Resolve settles it. Answering `false`
    // here and moving on is what the seed existed to prevent, and it is the
    // guess ADR-057 cannot recover from once the name is a string.
    const isScopeType = (qualifiedName: string): boolean =>
      declaredScopeTypes.has(qualifiedName);

    // Pass 1: Collect all bitmap names (needed before registers reference them)
    // This includes bitmaps in scopes
    CNextResolver.collectBitmapsPass1(
      registry,
      tree,
      sourceFile,
      symbols,
      knownBitmaps,
      isScopeType,
    );

    // Pass 2: Collect everything else (with bitmap set and const values available)
    CNextResolver.collectAllPass2(
      registry,
      tree,
      sourceFile,
      symbols,
      knownBitmaps,
      isScopeType,
    );

    // #1668: the lexical frames, over the same ADR-057 predicate the symbols
    // were collected with.
    const lexicalScopes = LexicalScopeCollector.collect(
      tree,
      registry,
      isScopeType,
    );

    // #1825: ADR-006's and ADR-029's per-file halves. Each records what this
    // file spells; resolving a callee and deciding a callback need every file,
    // so 1.4 does both.
    const modifications = ModificationCollector.collect(tree, (scopeName) =>
      registry.scopePathOf(scopeName),
    );
    const callbackUses = CallbackUseCollector.collect(tree, (scopeName) =>
      registry.scopePathOf(scopeName),
    );

    return {
      sourceFile,
      symbols,
      declaredScopeTypes,
      lexicalScopes,
      modifications,
      callbackUses,
    };
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
    registry: SymbolRegistry,
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
      const scopePath = ScopeUtils.pathOf(
        registry.getOrCreateScope(scopeDecl.IDENTIFIER().getText()),
      );
      for (const member of scopeDecl.scopeMember()) {
        const typeDecl = CNextResolver.typeFormingDeclaration(member);
        if (typeDecl) {
          scopeTypes.add(
            ScopeUtils.qualifyInScope(
              typeDecl.IDENTIFIER().getText(),
              scopePath,
            ),
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
    registry: SymbolRegistry,
    tree: Parser.ProgramContext,
    sourceFile: string,
    symbols: TSymbol[],
    knownBitmaps: Set<string>,
    isScopeType: (qualifiedName: string) => boolean,
  ): void {
    // #1298: file scope is the empty path; the global scope object itself is
    // only needed where a mutable member list is.
    const globalScopePath = "";

    for (const decl of tree.declaration()) {
      // Top-level bitmaps
      if (decl.bitmapDeclaration()) {
        const bitmapCtx = decl.bitmapDeclaration()!;
        const symbol = BitmapCollector.collect(
          bitmapCtx,
          sourceFile,
          globalScopePath,
          ScopeUtils.getTopLevelVisibility(),
        );
        symbols.push(symbol);
        // Use transpiled C name (global bitmaps have no scope prefix)
        knownBitmaps.add(symbol.name);
      }

      // Bitmaps and structs inside scopes (collected early)
      if (decl.scopeDeclaration()) {
        CNextResolver.collectScopedBitmapsAndStructs(
          registry,
          decl.scopeDeclaration()!,
          sourceFile,
          symbols,
          knownBitmaps,
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
    registry: SymbolRegistry,
    scopeDecl: Parser.ScopeDeclarationContext,
    sourceFile: string,
    symbols: TSymbol[],
    knownBitmaps: Set<string>,
    isScopeType: (qualifiedName: string) => boolean,
  ): void {
    const scopeName = scopeDecl.IDENTIFIER().getText();
    const scopePath = ScopeUtils.pathOf(registry.getOrCreateScope(scopeName));

    for (const member of scopeDecl.scopeMember()) {
      // #1300: these are the scoped bitmap and struct symbols that SURVIVE --
      // `collectScopeDeclaration` drops ScopeCollector's copies of both kinds.
      // Ask the same helper that pass 2 asks, so one fact has one answer.
      const visibility = ScopeUtils.getMemberVisibility(member);

      if (member.bitmapDeclaration()) {
        const bitmapCtx = member.bitmapDeclaration()!;
        const symbol = BitmapCollector.collect(
          bitmapCtx,
          sourceFile,
          scopePath,
          visibility,
        );
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
          scopePath,
          visibility,
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
    registry: SymbolRegistry,
    tree: Parser.ProgramContext,
    sourceFile: string,
    symbols: TSymbol[],
    knownBitmaps: Set<string>,
    isScopeType: (qualifiedName: string) => boolean,
  ): void {
    for (const decl of tree.declaration()) {
      // Skip bitmaps (already collected in pass 1)
      if (decl.bitmapDeclaration()) {
        continue;
      }

      CNextResolver._collectDeclaration(
        registry,
        decl,
        sourceFile,
        symbols,
        knownBitmaps,
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
    registry: SymbolRegistry,
    decl: Parser.DeclarationContext,
    sourceFile: string,
    symbols: TSymbol[],
    knownBitmaps: Set<string>,
    isScopeType: (qualifiedName: string) => boolean,
  ): void {
    // #1298: file scope is the empty path.
    const globalScopePath = "";

    // Scopes (ScopeCollector handles nested members)
    if (decl.scopeDeclaration()) {
      CNextResolver._collectScopeDeclaration(
        registry,
        decl.scopeDeclaration()!,
        sourceFile,
        symbols,
        knownBitmaps,
        isScopeType,
      );
      return;
    }

    // Top-level structs
    if (decl.structDeclaration()) {
      const symbol = StructCollector.collect(
        decl.structDeclaration()!,
        sourceFile,
        globalScopePath,
        ScopeUtils.getTopLevelVisibility(),
      );
      symbols.push(symbol);
      return;
    }

    // Top-level enums
    if (decl.enumDeclaration()) {
      const symbol = EnumCollector.collect(
        decl.enumDeclaration()!,
        sourceFile,
        globalScopePath,
        ScopeUtils.getTopLevelVisibility(),
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
        globalScopePath,
        ScopeUtils.getTopLevelVisibility(),
      );
      symbols.push(symbol);
      return;
    }

    // Top-level functions
    if (decl.functionDeclaration()) {
      const funcDecl = decl.functionDeclaration()!;
      // Use collectAndRegister to populate both old symbols and SymbolRegistry
      const symbol = FunctionCollector.collectAndRegister(
        registry,
        funcDecl,
        sourceFile,
        "",
        // ADR-016 (#1161): not a literal that can drift from the ADR. #1300
        // renamed the rule -- a top-level declaration is public because it has
        // no enclosing scope, not because it is a function.
        ScopeUtils.getTopLevelVisibility(),
      );
      symbols.push(symbol);
      return;
    }

    // Top-level variables
    if (decl.variableDeclaration()) {
      const symbol = VariableCollector.collect(
        decl.variableDeclaration()!,
        sourceFile,
        globalScopePath,
        ScopeUtils.getTopLevelVisibility(),
      );
      symbols.push(symbol);
    }
  }

  /**
   * Collect scope declaration and its non-bitmap/non-struct members.
   */
  private static _collectScopeDeclaration(
    registry: SymbolRegistry,
    scopeCtx: Parser.ScopeDeclarationContext,
    sourceFile: string,
    symbols: TSymbol[],
    knownBitmaps: Set<string>,
    isScopeType: (qualifiedName: string) => boolean,
  ): void {
    const result = ScopeCollector.collect(
      registry,
      scopeCtx,
      sourceFile,
      knownBitmaps,
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
