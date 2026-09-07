/**
 * E0424's suggestion: which enums declare a member of this name, and the
 * "did you mean" text that names them.
 *
 * #1322: three codegen sites built this list three times, with two wordings
 * for the several-enums case. One builder, one wording, used by the bare
 * member rule and by the switch analyzer's case-label check.
 */
import ICodeGenSymbols from "../../../transpiler/types/ICodeGenSymbols";

class EnumMemberSuggestion {
  /** The enums that declare `member`, in declaration order. */
  static enumsDeclaring(member: string, symbols: ICodeGenSymbols): string[] {
    const found: string[] = [];
    for (const [enumName, members] of symbols.enumMembers) {
      if (members.has(member)) found.push(enumName);
    }
    return found;
  }

  /** `'X' is not defined; did you mean 'A.X' or 'B.X'?` */
  static message(member: string, enums: readonly string[]): string {
    const spelled = enums.map((e) => `'${e}.${member}'`).join(" or ");
    return `'${member}' is not defined; did you mean ${spelled}?`;
  }
}

export default EnumMemberSuggestion;
