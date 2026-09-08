/**
 * Dynamic memory functions C-Next does not admit from C or C++.
 *
 * ADR-003 allows static allocation only. The prohibition is not "C-Next has a
 * `malloc` and forbids it" -- C-Next has no such function at all. What is
 * rejected is IMPORTING one from a C or C++ header into a `.cnx` file, and the
 * diagnostic says so. Code that genuinely needs the heap belongs in C or C++.
 *
 * ## One list, one rule
 *
 * This decision used to be made in two places with different matching, and the
 * two disagreed on real programs (found while regenerating snapshots for #1306):
 *
 *   - a bare `heap_caps_malloc(x);` compiled, while `y <- heap_caps_malloc(x);`
 *     was rejected -- the same call, two answers;
 *   - `u32 y <- myfree(1);` was rejected as `free`, because one path scanned
 *     statement TEXT for `"free("` rather than looking at the callee;
 *   - a declaration reported the same call twice, once from each path.
 *
 * Everything now asks `matches()`, so changing the rule means editing one place.
 *
 * ## Why the suffix rule
 *
 * A name matches when it IS one of these, or ends with `_` followed by one.
 * `k_malloc`/`k_free` (Zephyr) and `heap_caps_malloc` (ESP-IDF) are real
 * allocators spelled that way, and ADR-003 extends the prohibition to "any
 * user-defined equivalents", so a deliberate `my_free` wrapper is caught by
 * design. The separator is what keeps `myfree`, `saferealloc` and
 * `free_list_init` legal: ordinary names that happen to contain these letters.
 *
 * ## What a name rule cannot reach, stated plainly
 *
 * It matches snake_case suffixes and nothing else. FreeRTOS spells its
 * allocators `pvPortMalloc` / `vPortFree`, CMSIS-RTOS `osMemoryPoolAlloc`,
 * ThreadX `tx_byte_allocate`, and newlib's reentrant form is the PREFIXED
 * `_malloc_r`. None of them match, and no widening of a name rule would catch
 * them without also rejecting ordinary code. This is a cheap check for the
 * common spelling, not a guarantee (#1306 review -- an earlier version of this
 * comment claimed vendor allocators are "overwhelmingly" spelled with the
 * separator and offered `pvPort_malloc`, a name that does not exist).
 *
 * It also cannot tell releasing MEMORY from releasing a device: ESP-IDF's
 * `spi_bus_free` matches and is rejected. That follows from the maintainer's
 * rule -- exact, or after an underscore -- and the message stays true, because
 * such a function genuinely is imported from C or C++. An author who needs it
 * calls it from their C or C++ code, which is what ADR-003 asks for anyway.
 *
 * `getline`/`getdelim` are deliberately absent. They reallocate, but are
 * routinely called with a caller-owned buffer, so listing them would reject
 * correct code.
 *
 * ## Where the decision is made -- deliberately not here
 *
 * This class owns the LIST and the MATCH RULE. It does not own the consequence:
 * a match only means E0902 when the callee did not resolve to a C-Next
 * definition, and that is known in exactly one place, the call analyzer's
 * resolution ladder. Asking `matches()` from anywhere else re-derives the
 * consequence from a name alone -- which is how `pool_free` and `slot_is_free`,
 * both written in C-Next three lines above their call, came to be told they had
 * been imported from a header (#1306 review). Sharing the predicate made the two
 * sites agree on the letters and left them disagreeing on the meaning.
 */
const DYNAMIC_MEMORY_FUNCTIONS: ReadonlySet<string> = new Set([
  // C standard
  "malloc",
  "calloc",
  "realloc",
  "free",
  "aligned_alloc",
  // POSIX and common extensions
  "reallocarray",
  "posix_memalign",
  "memalign",
  "valloc",
  "pvalloc",
  // Allocating string/format helpers -- the caller owns the result and must
  // free it, which is the same ownership problem by another name.
  "strdup",
  "strndup",
  "asprintf",
  "vasprintf",
]);

class DynamicAllocation {
  /**
   * Whether calling `name` means allocating or releasing heap memory.
   *
   * Exact match, or the name ends with `_` plus an exact match. See the header
   * comment for why the separator is load-bearing.
   */
  static matches(name: string): boolean {
    if (DYNAMIC_MEMORY_FUNCTIONS.has(name)) return true;
    for (const forbidden of DYNAMIC_MEMORY_FUNCTIONS) {
      if (name.endsWith(`_${forbidden}`)) return true;
    }
    return false;
  }

  /** The listed names, for tests and for anything that must enumerate them. */
  static names(): readonly string[] {
    return [...DYNAMIC_MEMORY_FUNCTIONS];
  }

  /**
   * The one diagnostic for this condition, reported from one place.
   *
   * It used to be two, split by whether the header was included -- with
   * `#include <stdlib.h>` the call resolved and NULL-check analysis reported it,
   * without it call analysis got there first. The author's mistake does not
   * change because a header happened to be present, and neither does the
   * diagnostic; what the split actually bought was a second site with no idea
   * whether the callee was C-Next code.
   */
  static readonly CODE = "E0902";

  /** What the user did wrong. The IMPORT is forbidden, not a C-Next function. */
  static message(name: string): string {
    return `Importing dynamic memory function '${name}' from C/C++ is forbidden`;
  }

  /** What to do instead. */
  static helpText(name: string): string {
    return `C-Next has no dynamic memory allocation (ADR-003). Keep '${name}' in your C or C++ code; a .cnx file cannot call it.`;
  }
}

export default DynamicAllocation;
