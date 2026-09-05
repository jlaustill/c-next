/**
 * EnumCollector - Collects enum symbols from C parse trees.
 */

import type { EnumSpecifierContext } from "../../../../transpiler/logic/parser/c/grammar/CParser";
import type ICEnumSymbol from "../../../../transpiler/types/symbols/c/ICEnumSymbol";
import type ICEnumMemberSymbol from "../../../../transpiler/types/symbols/c/ICEnumMemberSymbol";
import ESourceLanguage from "../../../../utils/types/ESourceLanguage";
import type ISourceSpan from "../../../../transpiler/types/ISourceSpan";
import ParserUtils from "../../../../utils/ParserUtils";

/**
 * Result of collecting an enum - includes both the enum symbol and its members.
 */
interface IEnumCollectorResult {
  readonly enum: ICEnumSymbol;
  readonly members: ReadonlyArray<ICEnumMemberSymbol>;
}

class EnumCollector {
  /**
   * Collect an enum symbol and its members from a specifier context.
   *
   * @param enumSpec The enum specifier context
   * @param sourceFile Source file path
   * @param span Source span of the declaration
   */
  static collect(
    enumSpec: EnumSpecifierContext,
    sourceFile: string,
    span: ISourceSpan,
  ): IEnumCollectorResult | null {
    const identifier = enumSpec.Identifier();
    if (!identifier) return null;

    const name = identifier.getText();

    // Collect enum members as separate symbols and as inline member info
    const memberSymbols: ICEnumMemberSymbol[] = [];
    const memberInfos: Array<{
      readonly name: string;
      readonly value?: number;
    }> = [];
    const enumList = enumSpec.enumeratorList();

    for (const enumeratorDef of enumList?.enumerator() ?? []) {
      const memberName = enumeratorDef
        .enumerationConstant()
        ?.Identifier()
        ?.getText();
      if (!memberName) continue;

      memberInfos.push({ name: memberName });
      memberSymbols.push(
        EnumCollector.memberSymbol(
          memberName,
          name,
          sourceFile,
          enumeratorDef,
          span,
        ),
      );
    }

    const enumSymbol: ICEnumSymbol = {
      kind: "enum",
      name,
      sourceFile,
      span,
      sourceLanguage: ESourceLanguage.C,
      visibility: "public",
      members: memberInfos,
    };

    return {
      enum: enumSymbol,
      members: memberSymbols,
    };
  }

  /**
   * One enum member as a symbol.
   *
   * Extracted from `collect` (#1318): adding the member span pushed that
   * method's cognitive complexity to 16 against a limit of 15, and three levels
   * of nesting around one push was the reason it was close to the limit at all.
   */
  private static memberSymbol(
    memberName: string,
    enumName: string,
    sourceFile: string,
    // The real shape, not `{ start?: unknown }`: an `unknown` here threw away
    // what the caller had and forced a cast, which would have waved
    // `{ start: "yes" }` straight through into getSpan (#1318 review).
    enumeratorDef: {
      start?: { line?: number; column?: number } | null;
      stop?: {
        line?: number;
        column?: number;
        text?: string | null;
        start?: number;
        stop?: number;
      } | null;
    },
    enumSpan: ISourceSpan,
  ): ICEnumMemberSymbol {
    return {
      kind: "enum_member",
      name: memberName,
      sourceFile,
      // #1318: a member carries its OWN span, not its parent's -- falling back
      // to the enum's only when the enumerator has no start token. The fallback
      // decision itself lives in `getSpanOr`, so the C-Next path cannot answer
      // it differently, which it did until the #1318 review caught it.
      span: ParserUtils.getSpanOr(enumeratorDef, enumSpan),
      sourceLanguage: ESourceLanguage.C,
      visibility: "public",
      parent: enumName,
    };
  }
}

export default EnumCollector;
