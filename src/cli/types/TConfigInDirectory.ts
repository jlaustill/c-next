import type IConfigRead from "../../cnx/PARSE/1-Discover/types/IConfigRead";

/**
 * What one directory holds as a config: its first non-empty config file, or
 * none. Both carry the config files passed because they could not be read: a
 * run warns about them, and `--pio-install` stops at them (#2221 review).
 */
type TConfigInDirectory =
  | {
      readonly kind: "found";
      readonly path: string;
      readonly content: string;
      readonly unreadable: IConfigRead["unreadable"];
    }
  | { readonly kind: "none"; readonly unreadable: IConfigRead["unreadable"] };

export default TConfigInDirectory;
