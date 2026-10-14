import type EHeaderLanguage from "../../1-Discover/types/EHeaderLanguage";
import type ICHeaderSyntax from "./ICHeaderSyntax";
import type ICppHeaderSyntax from "./ICppHeaderSyntax";

/**
 * 1.2's artifact for one header, parsed with the parser of the language 1.1
 * judged it to be (#1844). Each header arrives lowered to plain data (#1991);
 * `syntax` is null when the parse could not proceed. Assembler is not parsed: its `.macro` bodies read as C
 * mis-collect mnemonics like `loop` as C symbols.
 */
type TParsedHeader =
  | {
      readonly language: EHeaderLanguage.C;
      readonly syntax: ICHeaderSyntax | null;
    }
  | {
      readonly language: EHeaderLanguage.Cpp;
      readonly syntax: ICppHeaderSyntax | null;
    }
  | { readonly language: EHeaderLanguage.Assembler };

export default TParsedHeader;
