/**
 * CNextResolver - Orchestrates symbol collection from C-Next parse trees.
 * Uses two-pass collection to handle forward references (bitmaps before registers).
 */

import * as Parser from "../../antlr_parser/grammar/CNextParser";
import TSymbol from "../types/TSymbol";
import LiteralUtils from "../../utils/LiteralUtils";
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

    // Pass 1: Collect all bitmap names (needed before registers reference them)
    // This includes bitmaps in scopes
    CNextResolver.collectBitmapsPass1(
      tree,
      sourceFile,
      symbols,
      knownBitmaps,
      constValues,
    );

    // Pass 2: Collect everything else (with bitmap set and const values available)
    CNextResolver.collectAllPass2(
      tree,
      sourceFile,
      symbols,
      knownBitmaps,
      constValues,
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
        const varCtx = decl.variableDeclaration()!;
        if (varCtx.constModifier()) {
          const name = varCtx.IDENTIFIER().getText();
          const exprCtx = varCtx.expression();
          if (exprCtx) {
            const value = LiteralUtils.parseIntegerLiteral(exprCtx.getText());
            if (value !== undefined) {
              constValues.set(name, value);
            }
          }
        }
      }

      // Const variables inside scopes
      if (decl.scopeDeclaration()) {
        const scopeDecl = decl.scopeDeclaration()!;
        const scopeName = scopeDecl.IDENTIFIER().getText();

        for (const member of scopeDecl.scopeMember()) {
          if (member.variableDeclaration()) {
            const varCtx = member.variableDeclaration()!;
            if (varCtx.constModifier()) {
              const name = varCtx.IDENTIFIER().getText();
              const fullName = `${scopeName}_${name}`;
              const exprCtx = varCtx.expression();
              if (exprCtx) {
                const value = LiteralUtils.parseIntegerLiteral(
                  exprCtx.getText(),
                );
                if (value !== undefined) {
                  // Store both bare name and scoped name for flexibility
                  constValues.set(name, value);
                  constValues.set(fullName, value);
                }
              }
            }
          }
        }
      }
    }
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
    constValues: Map<string, number>,
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
              constValues,
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
    constValues: Map<string, number>,
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
          constValues,
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
        const symbol = StructCollector.collect(
          structCtx,
          sourceFile,
          undefined,
          constValues,
        );
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
        const symbol = VariableCollector.collect(
          varCtx,
          sourceFile,
          undefined,
          true,
          constValues,
        );
        symbols.push(symbol);
      }
    }
  }
}

export default CNextResolver;
