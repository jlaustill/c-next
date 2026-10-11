/**
 * ADR-049: the one reader of a file's `#pragma` lines.
 *
 * The grammar lexes each pragma as one token, so the directive is always one
 * line; this splits that token into its key and values. Nothing else reads
 * pragma text -- not the run-target resolution, not the test harness -- so a
 * pragma cannot be understood two ways.
 */
import type * as Parser from "./grammar/CNextParser";
import type ITargetDirective from "../../types/ITargetDirective";

class TargetDirectives {
  static read(tree: Parser.ProgramContext): ITargetDirective[] {
    const directives: ITargetDirective[] = [];
    for (const directive of tree.preprocessorDirective()) {
      const pragma = directive.pragmaDirective();
      if (!pragma) {
        continue;
      }
      // "#", optional blanks, "pragma", then blank-separated words
      const words = pragma
        .getText()
        .replace(/^#\s*pragma\s+/, "")
        .split(/\s+/)
        .filter((word) => word.length > 0);
      directives.push({
        key: words[0],
        values: words.slice(1),
        line: pragma.start!.line,
        column: pragma.start!.column,
      });
    }
    return directives;
  }
}

export default TargetDirectives;
