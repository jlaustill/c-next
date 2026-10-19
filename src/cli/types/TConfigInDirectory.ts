import type IConfigRead from "../../cnx/PARSE/1-Discover/types/IConfigRead";
import type IRenamedConfigErrors from "./IRenamedConfigErrors";

/**
 * What one directory holds as a config: an old-name file (E0918), the
 * first non-empty config under a new name, or neither. Both of the last two
 * carry the new-name files passed because they could not be read: a run warns
 * about them, and `--pio-install` stops at them (#2221 review).
 */
type TConfigInDirectory =
  | IRenamedConfigErrors
  | {
      readonly kind: "found";
      readonly path: string;
      readonly content: string;
      readonly unreadable: IConfigRead["unreadable"];
    }
  | { readonly kind: "none"; readonly unreadable: IConfigRead["unreadable"] };

export default TConfigInDirectory;
