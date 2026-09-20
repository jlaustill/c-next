/**
 * 2.2 Plan -- which generated `#include` carries a cppcheck suppression, and
 * under which MISRA rule.
 *
 * The sibling of `ComplianceAnnotations`, and split from `MisraSuppressionUtils`
 * for the same reason: the table decides WHAT is emitted, the render pass only
 * decides how it reads. A suppression is not cosmetic -- drop this table and
 * `#include <stdio.h>` in generated C is reported as a MISRA 21.6 violation
 * against the certification artifact. That is a change to what is emitted, which
 * is the discriminator `docs/architecture/module-destinations.md` gives for this
 * boundary (#1450 box 4).
 *
 * Distinct from `ComplianceAnnotations` in what the comment is FOR -- a
 * suppression tells a TOOL to stop reporting, an annotation tells a READER why
 * the code looks like this -- but not in which pass owns it. Both own a rule
 * citation; neither owns its spelling.
 *
 * Adding a banned header means adding a row.
 */
class MisraSuppressions {
  /**
   * Headers whose use generated C must suppress, mapped to the rule cited.
   *
   * MISRA Rule 21.6: the standard library input/output functions shall not be
   * used. C-Next emits `<stdio.h>` only where a program asked for it.
   */
  private static readonly BANNED_HEADERS: ReadonlyMap<string, string> = new Map(
    [["stdio.h", "misra-c2012-21.6"]],
  );

  /**
   * Header name out of an angle-bracket include.
   *
   * `[^<>]` cannot backtrack across a bracket, so this is linear on any input.
   * A quoted include is a project header and is deliberately not matched: the
   * banned set is about the standard library.
   */
  private static readonly ANGLE_BRACKET_INCLUDE = /<([^<>]+)>/;

  /**
   * The MISRA rule an include must be suppressed under, or `null` when it needs
   * no suppression.
   *
   * One entry point, not two. `needsMisraSuppression` used to answer the same
   * question beside this one, each re-running the regex and re-reading the map
   * -- one decision with two derivations, which is what CLAUDE.md's
   * single-source-of-truth rule is about. It had no production caller at all;
   * its six test callers hid that from knip (#1418).
   *
   * @param includeText - a full include directive, e.g. `#include <stdio.h>`
   */
  static ruleFor(includeText: string): string | null {
    const match = MisraSuppressions.ANGLE_BRACKET_INCLUDE.exec(includeText);
    if (!match) {
      return null;
    }
    return MisraSuppressions.BANNED_HEADERS.get(match[1]) ?? null;
  }
}

export default MisraSuppressions;
