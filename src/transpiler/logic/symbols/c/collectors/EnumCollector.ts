/**
 * EnumCollector - Collects enum symbols from C parse trees.
 */

import type { EnumSpecifierContext } from "../../../parser/c/grammar/CParser";
import type ICEnumSymbol from "../../../../types/symbols/c/ICEnumSymbol";
import type ICEnumMemberSymbol from "../../../../types/symbols/c/ICEnumMemberSymbol";
import ESourceLanguage from "../../../../../utils/types/ESourceLanguage";

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
   * @param line Source line number
   */
  static collect(
    enumSpec: EnumSpecifierContext,
    sourceFile: string,
    line: number,
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
              sourceLine: enumeratorDef.start?.line ?? line,
              sourceLanguage: ESourceLanguage.C,
              isExported: true,
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
      sourceLine: line,
      sourceLanguage: ESourceLanguage.C,
      isExported: true,
      members: memberInfos,
    };

    return {
      enum: enumSymbol,
      members: memberSymbols,
    };
  }
}

export default EnumCollector;
