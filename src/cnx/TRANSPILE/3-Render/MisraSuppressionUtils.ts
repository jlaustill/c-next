/**
 * 2.3 Render -- how a MISRA suppression READS.
 *
 * Issue #850: both the `.c` path (`CodeGenerator`) and the `.h` path
 * (`HeaderGeneratorUtils`) emit inline suppressions, and they share this one
 * spelling so the two artifacts cannot drift.
 *
 * #1450 box 4: WHICH header is suppressed, and under which rule, is
 * `MisraSuppressions` in 2.2 Plan. All that is left here is the comment form --
 * the same split `ComplianceAnnotations` already has, where the rule table is
 * planned and only the string is rendered.
 */
import MisraSuppressions from "../2-Plan/MisraSuppressions";

class MisraSuppressionUtils {
  /**
   * The suppression comment for an include directive, or `null` when the plan
   * cites no rule for it.
   *
   * @param includeText - a full include directive, e.g. `#include <stdio.h>`
   */
  static getMisraSuppressionComment(includeText: string): string | null {
    const rule = MisraSuppressions.ruleFor(includeText);
    return rule === null ? null : `// cppcheck-suppress ${rule}`;
  }
}

export default MisraSuppressionUtils;
