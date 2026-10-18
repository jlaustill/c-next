/**
 * 2.2 Plan -- the system headers a file still has to include once its source's
 * own `#include`s are counted (#2188).
 *
 * The `.c` and the `.h` both decide `<stdint.h>`/`<stdbool.h>` (`CTypeIncludes`)
 * and both carry the source's includes through. Only the `.c` dropped a
 * decided header the source already wrote, so a header whose source wrote
 * `#include <stdint.h>` included it twice. One filter now serves both.
 */
class UnwrittenIncludes {
  /** `<stdint.h>` or `"x.h"` from an `#include` line; null for any other line */
  static targetOf(line: string): string | null {
    const match = /^#include\s+(<[^>]+>|"[^"]+")\s*$/.exec(line.trim());
    return match ? match[1] : null;
  }

  /** `candidates` in order, less each target already written and each repeat */
  static of(
    candidates: readonly string[],
    writtenTargets: Iterable<string>,
  ): string[] {
    const already = new Set(writtenTargets);
    const decided: string[] = [];
    for (const target of candidates) {
      if (already.has(target)) continue;
      decided.push(target);
      already.add(target);
    }
    return decided;
  }
}

export default UnwrittenIncludes;
