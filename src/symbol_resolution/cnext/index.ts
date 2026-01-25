/**
 * CNextResolver - Orchestrates symbol collection from C-Next parse trees.
 * Uses two-pass collection to handle forward references (bitmaps before registers).
 */

import * as Parser from "../../antlr_parser/grammar/CNextParser";
import TSymbol from "../types/TSymbol";
import BitmapCollector from "./collectors/BitmapCollector";
import EnumCollector from "./collectors/EnumCollector";
import StructCollector from "./collectors/StructCollector";
import FunctionCollector from "./collectors/FunctionCollector";
import VariableCollector from "./collectors/VariableCollector";
import RegisterCollector from "./collectors/RegisterCollector";
import ScopeCollector from "./collectors/ScopeCollector";

class CNextResolver {
  /**
   * Resolve all symbols from a C-Next program parse tree.
   *
   * @param tree The program context from the parser
   * @param sourceFile Source file path
   * @returns Array of all collected symbols
   */
  static resolve(tree: Parser.ProgramContext, sourceFile: string): TSymbol[] {
    const symbols: TSymbol[] = [];
    const knownBitmaps = new Set<string>();

    // Pass 1: Collect all bitmap names (needed before registers reference them)
    // This includes bitmaps in scopes
    CNextResolver.collectBitmapsPass1(tree, sourceFile, symbols, knownBitmaps);

    // Pass 2: Collect everything else (with bitmap set available)
    CNextResolver.collectAllPass2(tree, sourceFile, symbols, knownBitmaps);

    return symbols;
  }

  /**
   * Pass 1: Collect all bitmaps (including those in scopes).
   * Also collects structs in scopes early for type availability.
   */
  private static collectBitmapsPass1(
    tree: Parser.ProgramContext,
    sourceFile: string,
    symbols: TSymbol[],
    knownBitmaps: Set<string>,
  ): void {
    for (const decl of tree.declaration()) {
      // Top-level bitmaps
      if (decl.bitmapDeclaration()) {
        const bitmapCtx = decl.bitmapDeclaration()!;
        const symbol = BitmapCollector.collect(bitmapCtx, sourceFile);
        symbols.push(symbol);
        knownBitmaps.add(symbol.name);
      }

      // Bitmaps and structs inside scopes (collected early)
      if (decl.scopeDeclaration()) {
        const scopeDecl = decl.scopeDeclaration()!;
        const scopeName = scopeDecl.IDENTIFIER().getText();

        for (const member of scopeDecl.scopeMember()) {
          if (member.bitmapDeclaration()) {
            const bitmapCtx = member.bitmapDeclaration()!;
            const symbol = BitmapCollector.collect(
              bitmapCtx,
              sourceFile,
              scopeName,
            );
            symbols.push(symbol);
            knownBitmaps.add(symbol.name);
          }

          // Collect structs early so they're available as types
          if (member.structDeclaration()) {
            const structCtx = member.structDeclaration()!;
            const symbol = StructCollector.collect(
              structCtx,
              sourceFile,
              scopeName,
            );
            symbols.push(symbol);
          }
        }
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
  ): void {
    for (const decl of tree.declaration()) {
      // Skip bitmaps (already collected in pass 1)
      if (decl.bitmapDeclaration()) {
        continue;
      }

      // Scopes (ScopeCollector handles nested members)
      if (decl.scopeDeclaration()) {
        const scopeCtx = decl.scopeDeclaration()!;
        const result = ScopeCollector.collect(
          scopeCtx,
          sourceFile,
          knownBitmaps,
        );

        symbols.push(result.scopeSymbol);

        // Add member symbols, but skip bitmaps and structs (already collected in pass 1)
        for (const memberSymbol of result.memberSymbols) {
          if (
            memberSymbol.kind === "bitmap" ||
            memberSymbol.kind === "struct"
          ) {
            continue;
          }
          symbols.push(memberSymbol);
        }
      }

      // Top-level structs
      if (decl.structDeclaration()) {
        const structCtx = decl.structDeclaration()!;
        const symbol = StructCollector.collect(structCtx, sourceFile);
        symbols.push(symbol);
      }

      // Top-level enums
      if (decl.enumDeclaration()) {
        const enumCtx = decl.enumDeclaration()!;
        const symbol = EnumCollector.collect(enumCtx, sourceFile);
        symbols.push(symbol);
      }

      // Top-level registers
      if (decl.registerDeclaration()) {
        const regCtx = decl.registerDeclaration()!;
        const symbol = RegisterCollector.collect(
          regCtx,
          sourceFile,
          knownBitmaps,
        );
        symbols.push(symbol);
      }

      // Top-level functions
      if (decl.functionDeclaration()) {
        const funcCtx = decl.functionDeclaration()!;
        const symbol = FunctionCollector.collect(funcCtx, sourceFile);
        symbols.push(symbol);
      }

      // Top-level variables
      if (decl.variableDeclaration()) {
        const varCtx = decl.variableDeclaration()!;
        const symbol = VariableCollector.collect(varCtx, sourceFile);
        symbols.push(symbol);
      }
    }
  }
}

export default CNextResolver;
