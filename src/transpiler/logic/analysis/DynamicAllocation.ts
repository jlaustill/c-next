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
 * Vendor allocators are overwhelmingly spelled that way -- `heap_caps_malloc`,
 * `pvPort_malloc` -- and ADR-003 extends the prohibition to "any user-defined
 * equivalents", so a deliberate `my_free` wrapper is caught by design. The
 * separator is what keeps `myfree`, `saferealloc` and `free_list_init` legal:
 * those are ordinary names that happen to contain these letters.
 *
 * `getline`/`getdelim` are deliberately absent. They reallocate, but are
 * routinely called with a caller-owned buffer, so listing them would reject
 * correct code.
 *
 * KNOWN LIMITATION: the diagnostic says the IMPORT is forbidden, which is true
 * of every case reachable today -- C-Next cannot allocate, so an allocator is
 * always something a header brought in. A function DEFINED in C-Next whose name
 * fits the rule (`u32 my_free(...)`) is still rejected, per ADR-003 extending the
 * prohibition to user-defined equivalents, but reads the import wording. No such
 * function exists in the corpus. Distinguishing the two needs a pre-pass over
 * declarations that this analyzer does not have.
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
   * The one diagnostic for this condition, reported from two places.
   *
   * Two analyzers see it, decided by whether the header was included: with
   * `#include <stdlib.h>` the call resolves and NULL-check analysis reports it;
   * without, call analysis gets there first and the step loop breaks before
   * NULL-check analysis runs. The user made the same mistake either way, so both
   * report the same code and read the same sentence from here rather than each
   * spelling it out.
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
