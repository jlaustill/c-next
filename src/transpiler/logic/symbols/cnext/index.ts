/**
 * CNextResolver - Orchestrates symbol collection from C-Next parse trees.
 * Uses two-pass collection to handle forward references (bitmaps before registers).
 *
 * Produces TType-based symbols with proper IScopeSymbol references.
 */

import * as Parser from "../../parser/grammar/CNextParser";
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

class CNextResolver {
  /**
   * Resolve all symbols from a C-Next program parse tree.
   *
   * @param tree The program context from the parser
   * @param sourceFile Source file path
   * @param externalConstValues Optional map of const values from external files (e.g., #included .cnx files)
   * @returns Array of all collected symbols
   */
  static resolve(
    tree: Parser.ProgramContext,
    sourceFile: string,
    externalConstValues?: Map<string, number>,
  ): TSymbol[] {
    const symbols: TSymbol[] = [];
    const knownBitmaps = new Set<string>();
    const constValues = new Map<string, number>();

    // Issue #461: Start with external const values from included files
    if (externalConstValues) {
      for (const [name, value] of externalConstValues) {
        constValues.set(name, value);
      }
    }

    // Pass 0: Collect const values (needed for resolving array dimensions)
    // Local constants override external ones (unlikely but handles shadowing)
    CNextResolver.collectConstValuesPass0(tree, constValues);

    // Pass 0b: Collect the qualified names of every type declared inside a
    // scope (ADR-057). This must complete before any type is resolved, so that
    // a bare type name is qualified the same way no matter where its
    // declaration appears relative to its use.
    const scopeTypes = new Set<string>();
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

    // Store scoped name as well for scoped variables
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
   * Pass 0b: Collect the qualified name of every *type* declared inside a
   * scope — enums, structs and bitmaps (ADR-057).
   *
   * Only type declarations are collected. A scope function or variable sharing
   * a leaf name with a global type must not capture that name at a type
   * position, which is why this cannot key on scope membership generally.
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

      const scopeName = scopeDecl.IDENTIFIER().getText();
      for (const member of scopeDecl.scopeMember()) {
        const typeDecl =
          member.enumDeclaration() ??
          member.structDeclaration() ??
          member.bitmapDeclaration();
        if (typeDecl) {
          scopeTypes.add(
            QualifiedCName.join(scopeName, typeDecl.IDENTIFIER().getText()),
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
        // Use transpiled C name (e.g., "Timer_ControlBits") for scoped bitmaps
        const cName = QualifiedCName.join(scopeName, symbol.name);
        knownBitmaps.add(cName);
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
        undefined, // global scope name (empty string)
        body,
        "private", // default visibility for global functions
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
