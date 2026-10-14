import type EHeaderLanguage from "../../1-Discover/types/EHeaderLanguage";
import type IDiscoveredFile from "../../1-Discover/types/IDiscoveredFile";
import type IHeaderDeclarationRecord from "../../1-Discover/types/IHeaderDeclarationRecord";
import type TParsedHeader from "./TParsedHeader";

/**
 * #1991: one C/C++ header as 1.2 hands it to 1.3: the cache record 1.1 read,
 * the syntax 1.2 parsed, or what reading or parsing it threw.
 */
type TParsedHeaderEntry = { readonly file: IDiscoveredFile } & (
  | { readonly kind: "cached"; readonly record: IHeaderDeclarationRecord }
  | { readonly kind: "failed"; readonly error: unknown }
  | {
      readonly kind: "parsed";
      readonly language: EHeaderLanguage;
      readonly parsed: TParsedHeader;
    }
);

export default TParsedHeaderEntry;
