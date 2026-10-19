import type IRenamedConfigErrors from "./IRenamedConfigErrors";

/**
 * What one directory holds for the config walk: an old-name file (E0918), the
 * first non-empty config under a new name, or neither.
 */
type TConfigInDirectory =
  | IRenamedConfigErrors
  | {
      readonly kind: "found";
      readonly path: string;
      readonly content: string;
    }
  | { readonly kind: "none" };

export default TConfigInDirectory;
