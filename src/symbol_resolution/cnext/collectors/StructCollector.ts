/**
 * StructCollector - Extracts struct type declarations from parse trees.
 * Handles fields with types, arrays, and const modifiers.
 */

import * as Parser from "../../../antlr_parser/grammar/CNextParser";
import ESourceLanguage from "../../../types/ESourceLanguage";
import ESymbolKind from "../../../types/ESymbolKind";
import IStructSymbol from "../../types/IStructSymbol";
import IFieldInfo from "../../types/IFieldInfo";
import TypeUtils from "../utils/TypeUtils";

class StructCollector {
  /**
   * Collect a struct declaration and return an IStructSymbol.
   *
   * @param ctx The struct declaration context
   * @param sourceFile Source file path
   * @param scopeName Optional scope name for nested structs
   * @returns The struct symbol
   */
  static collect(
    ctx: Parser.StructDeclarationContext,
    sourceFile: string,
    scopeName?: string,
  ): IStructSymbol {
    const name = ctx.IDENTIFIER().getText();
    const fullName = scopeName ? `${scopeName}_${name}` : name;
    const line = ctx.start?.line ?? 0;

    const fields = new Map<string, IFieldInfo>();

    for (const member of ctx.structMember()) {
      const fieldName = member.IDENTIFIER().getText();
      const typeCtx = member.type();
      const fieldType = TypeUtils.getTypeName(typeCtx, scopeName);
      // Note: C-Next struct members don't have const modifier in grammar
      const isConst = false;

      const arrayDims = member.arrayDimension();
      const dimensions: number[] = [];
      let isArray = false;

      // Handle string types specially
      if (typeCtx.stringType()) {
        const stringCtx = typeCtx.stringType()!;
        const intLiteral = stringCtx.INTEGER_LITERAL();

        if (intLiteral) {
          const capacity = parseInt(intLiteral.getText(), 10);

          // If there are array dimensions, they come BEFORE string capacity
          if (arrayDims.length > 0) {
            isArray = true;
            for (const dim of arrayDims) {
              const sizeExpr = dim.expression();
              if (sizeExpr) {
                const size = parseInt(sizeExpr.getText(), 10);
                if (!isNaN(size)) {
                  dimensions.push(size);
                }
              }
            }
          }
          // String capacity becomes final dimension (+1 for null terminator)
          dimensions.push(capacity + 1);
          isArray = true;
        }
      } else if (arrayDims.length > 0) {
        // Non-string array
        isArray = true;
        for (const dim of arrayDims) {
          const sizeExpr = dim.expression();
          if (sizeExpr) {
            const size = parseInt(sizeExpr.getText(), 10);
            if (!isNaN(size)) {
              dimensions.push(size);
            }
          }
        }
      }

      const fieldInfo: IFieldInfo = {
        type: fieldType,
        isArray,
        isConst,
      };

      if (dimensions.length > 0) {
        fieldInfo.dimensions = dimensions;
      }

      fields.set(fieldName, fieldInfo);
    }

    return {
      name: fullName,
      sourceFile,
      sourceLine: line,
      sourceLanguage: ESourceLanguage.CNext,
      isExported: true,
      kind: ESymbolKind.Struct,
      fields,
    };
  }
}

export default StructCollector;
