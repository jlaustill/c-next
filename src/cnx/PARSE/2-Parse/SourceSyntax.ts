import CnxSourceParser from "./CnxSourceParser";
import type ISourceSyntax from "../../types/ISourceSyntax";

/**
 * 1.2 Parse's entry for the transpile run (#1991): one cnx source in, its
 * plain-data artifact out, and the tree released here -- it never leaves 1.2.
 *
 * `CnxSourceParser.parse` stays for the tools that read the tree itself
 * (the prettier plugin, `format-fidelity`, `grammar-coverage`).
 */
class SourceSyntax {
  /**
   * The comments are read once, here, rather than on first read: holding the
   * scan lazily would hold the token stream past 1.2.
   */
  static of(source: string): ISourceSyntax {
    const parsed = CnxSourceParser.parse(source);
    return {
      declarationCount: parsed.declarationCount,
      comments: parsed.comments,
      program: parsed.program,
      targetDirectives: parsed.targetDirectives,
      parseErrors: parsed.parseErrors,
      formErrors: parsed.formErrors,
    };
  }
}

export default SourceSyntax;
