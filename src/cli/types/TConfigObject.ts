import type IFileConfig from "./IFileConfig";

/**
 * A config file's text read as a config (#2221 review): the object it holds,
 * or why it holds none.
 */
type TConfigObject =
  | { readonly kind: "object"; readonly config: IFileConfig }
  | { readonly kind: "invalid"; readonly reason: string };

export default TConfigObject;
