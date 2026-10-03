/**
 * A declared type whose own shape is invalid: E0893 (ADR-034) and E0894
 * (ADR-017).
 *
 * #1531. Both rules were throws in 1.3 Declare's collectors, so each reached
 * the user as `1:0 Code generation failed: Error: ...` -- no code, no
 * position, and a prefix naming a pass that never saw the declaration. A
 * throw also stopped the run at the first offender, so a file declaring three
 * bad bitmaps reported one.
 *
 * 1.3 still records the facts: each field's width beside the bitmap's size,
 * and each member's value. This asks the one question of them, so a width or
 * a value is derived once, by its collector, and judged once, here.
 *
 * The declarations are read from the symbol table rather than the tree. That
 * is what makes a scope-declared bitmap or enum one of them with nothing
 * extra: 1.3 registers it under the file like any other.
 */

import type IBitmapSymbol from "../../types/symbols/IBitmapSymbol";
import type IEnumSymbol from "../../types/symbols/IEnumSymbol";
import type IAnalysisContext from "./types/IAnalysisContext";
import type ITypeDeclarationError from "./types/ITypeDeclarationError";

class TypeDeclarationAnalyzer {
  public constructor(private readonly context: IAnalysisContext) {}

  public analyze(): ITypeDeclarationError[] {
    const found: ITypeDeclarationError[] = [];
    const declared = this.context.symbolTable.getTSymbolsByFile(
      this.context.sourceFile,
    );
    for (const symbol of declared) {
      if (symbol.kind === "bitmap") {
        found.push(...TypeDeclarationAnalyzer.bitmapWidth(symbol));
      } else if (symbol.kind === "enum") {
        found.push(...TypeDeclarationAnalyzer.enumValues(symbol));
      }
    }
    // The table's order is registration order, not the source's.
    return found.sort((a, b) => a.line - b.line || a.column - b.column);
  }

  private static bitmapWidth(bitmap: IBitmapSymbol): ITypeDeclarationError[] {
    let totalBits = 0;
    for (const field of bitmap.fields.values()) {
      totalBits += field.width;
    }
    if (totalBits === bitmap.bitWidth) {
      return [];
    }
    // `bitmap${N}` is the keyword itself, not a guess at it: ADR-034 names
    // each bitmap type by the number of bits it holds.
    return [
      {
        code: "E0893",
        line: bitmap.span.line,
        column: bitmap.span.column,
        message: `Bitmap '${bitmap.cnxScopedName}' has ${totalBits} bits but bitmap${bitmap.bitWidth} requires exactly ${bitmap.bitWidth} bits`,
        helpText:
          "A bitmap's field widths must add up to its size (ADR-034). Resize a field, or declare the bitmap with the size its fields add up to",
      },
    ];
  }

  private static enumValues(enumSymbol: IEnumSymbol): ITypeDeclarationError[] {
    const found: ITypeDeclarationError[] = [];
    for (const member of enumSymbol.members.values()) {
      if (member.value >= 0) {
        continue;
      }
      found.push({
        code: "E0894",
        line: member.span.line,
        column: member.span.column,
        message: `Negative values not allowed in enum (found ${member.value} in ${enumSymbol.cnxScopedName}.${member.name})`,
        helpText:
          "An enum member's value is 0 or more (ADR-017). Use a non-negative value",
      });
    }
    return found;
  }
}

export default TypeDeclarationAnalyzer;
