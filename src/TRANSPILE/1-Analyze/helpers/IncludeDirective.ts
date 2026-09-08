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
 * One parse, one answer, and it carries the FORM as well as the path, because
 * ADR-010's two forms are searched in different places.
 */

import * as Parser from "../../../transpiler/logic/parser/grammar/CNextParser";
import IIncludeSpec from "../types/IIncludeSpec";

/** `#include <path>` and `#include "path"`, each closed by its own delimiter. */
const ANGLE = /#\s*include\s*<([^>]+)>/;
const QUOTED = /#\s*include\s*"([^"]+)"/;

class IncludeDirective {
  /** What `text` includes, or null when it is not an include directive. */
  static parse(text: string): IIncludeSpec | null {
    const quoted = QUOTED.exec(text);
    if (quoted) return { path: quoted[1], isQuoted: true };
    const angle = ANGLE.exec(text);
    if (angle) return { path: angle[1], isQuoted: false };
    return null;
  }

  /** The same for a directive node. */
  static of(ctx: Parser.IncludeDirectiveContext): IIncludeSpec | null {
    return IncludeDirective.parse(ctx.getText());
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
