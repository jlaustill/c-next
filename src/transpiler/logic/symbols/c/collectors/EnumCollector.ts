/**
 * EnumCollector - Collects enum symbols from C parse trees.
 */

import type { EnumSpecifierContext } from "../../../parser/c/grammar/CParser";
import type ICEnumSymbol from "../../../../types/symbols/c/ICEnumSymbol";
import type ICEnumMemberSymbol from "../../../../types/symbols/c/ICEnumMemberSymbol";
import ESourceLanguage from "../../../../../utils/types/ESourceLanguage";
import type ISourceSpan from "../../../../types/ISourceSpan";
import ParserUtils from "../../../../../utils/ParserUtils";

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

    if (enumList) {
      for (const enumeratorDef of enumList.enumerator()) {
        const enumConst = enumeratorDef.enumerationConstant();
        if (enumConst) {
          const memberName = enumConst.Identifier()?.getText();
          if (memberName) {
            memberInfos.push({ name: memberName });
            memberSymbols.push({
              kind: "enum_member",
              name: memberName,
              sourceFile,
              // #1318: a member carries its OWN span, not its parent's.
              // Falls back to the enum's span only when the enumerator has
              // no start token, which is the same fallback the bare line
              // carried -- ParserUtils.getSpan would report 0:0 there, and a
              // diagnostic aimed at the top of the file is worse than one
              // aimed at the enclosing enum.
              span: enumeratorDef.start
                ? ParserUtils.getSpan(enumeratorDef)
                : span,
              sourceLanguage: ESourceLanguage.C,
              visibility: "public",
              parent: name,
            });
          }
        }
      }
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
}

export default EnumCollector;
