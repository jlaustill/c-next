/**
 * ADR-049: the one reader of a file's `#pragma` lines.
 *
 * The grammar lexes each pragma as one token, so the directive is always one
 * line; this splits that token into its key and values. Nothing else reads
 * pragma text -- not the run-target resolution, not the test harness -- so a
 * pragma cannot be understood two ways.
 *
 * #1713: read by 1.1 Discover, which settles the run's target before it
 * preprocesses a header, because a header is read with the target's own
 * compiler. No parse exists yet, so the tokens come from 1.1's include lexer.
 */
import IncludeDiscovery from "./IncludeDiscovery";
import type ITargetDirective from "../../types/ITargetDirective";

class TargetDirectives {
  static read(source: string): ITargetDirective[] {
    return IncludeDiscovery.pragmasWithPositionsOf(source).map((token) => {
      // "#", optional blanks, "pragma", then blank-separated words
      const words = token.text
        .replace(/^#\s*pragma\s+/, "")
        .split(/\s+/)
        .filter((word) => word.length > 0);
      return {
        key: words[0],
        values: words.slice(1),
        line: token.line,
        column: token.column,
      };
    });
  }
}

export default TargetDirectives;
