import type EHeaderLanguage from "../../1-Discover/types/EHeaderLanguage";
import type { CompilationUnitContext } from "../c/grammar/CParser";
import type { TranslationUnitContext } from "../cpp/grammar/CPP14Parser";

/**
 * 1.2's artifact for one header: its tree, parsed with the parser of the
 * language 1.1 judged it to be (#1844). `tree` is null when the parse could
 * not proceed. Assembler is not parsed: its `.macro` bodies read as C
 * mis-collect mnemonics like `loop` as C symbols.
 */
type TParsedHeader =
  | {
      readonly language: EHeaderLanguage.C;
      readonly tree: CompilationUnitContext | null;
    }
  | {
      readonly language: EHeaderLanguage.Cpp;
      readonly tree: TranslationUnitContext | null;
    }
  | { readonly language: EHeaderLanguage.Assembler };

export default TParsedHeader;
