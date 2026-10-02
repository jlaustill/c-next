/**
 * What an `#include` directive names.
 *
 * #1322. Four copies of this parse existed: `TypeValidator` held two regexes
 * (one per form) behind ADR-010's two rules, and `FunctionCallAnalyzer` and
 * `NullCheckAnalyzer` each held a third spelling, `#include\s*[<"]([^>"]+)[>"]`,
 * which matches the two delimiters INDEPENDENTLY -- so `#include <foo.h"` is
 * accepted by those two and rejected by the other two. Nothing depended on the
 * disagreement, which is exactly why it survived.
 *
 * #1672: the regexes #1322 left here were a second split of the token 1.1
 * splits, and agreed with it on every fixture. A directive node holds that
 * same token, so it is split the same way. The answer carries the FORM as well
 * as the path, because ADR-010's two forms are searched in different places.
 */

import * as Parser from "../../../PARSE/2-Parse/grammar/CNextParser";
import IncludeDiscovery from "../../../transpiler/data/IncludeDiscovery";

class IncludeDirective {
  /** What a directive node includes, or null when it names nothing. */
  static of(
    ctx: Parser.IncludeDirectiveContext,
  ): { path: string; isLocal: boolean } | null {
    return IncludeDiscovery.specOfDirective(ctx.getText());
  }

  /** Every header a program includes, in source order, by either form. */
  static pathsIn(tree: Parser.ProgramContext): string[] {
    return tree
      .includeDirective()
      .map((directive) => IncludeDirective.of(directive)?.path)
      .filter((path): path is string => path !== undefined);
  }
}

export default IncludeDirective;
