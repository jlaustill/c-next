/**
 * 2.2 Plan -- which system headers declare the C types a file emits.
 *
 * The one predicate for `<stdint.h>` and `<stdbool.h>` (#1927). The `.c` asks
 * it about the C types render recorded (`IEmissionFacts.emittedCTypes`), and
 * the `.h` about the C types its exported symbols map to (`HeaderIncludes`).
 * Different inputs, one question: "does this text use a name that header
 * declares?".
 *
 * Before #1927 the `.c` asked a different question -- "is this C-Next name in
 * `TYPE_MAP`?" -- so `f32` pulled `<stdint.h>` into the `.c` while the `.h`,
 * asking about `float`, correctly did not.
 */

import SYSTEM_INCLUDE_TARGETS from "./SYSTEM_INCLUDE_TARGETS";

/** Fixed-width integer types, which `<stdint.h>` declares. */
const STDINT_TYPES = /^(?:u?int(?:8|16|32|64)_t|u?intptr_t|u?intmax_t)$/;

class CTypeIncludes {
  /**
   * The system headers declaring any of `cTypes`, `<stdint.h>` first.
   *
   * @param cTypes C type spellings as emitted, decoration included
   *   (`uint8_t*`, `char[65]`)
   */
  static decide(cTypes: Iterable<string>): string[] {
    const bases = new Set<string>();
    for (const cType of cTypes) {
      bases.add(CTypeIncludes.baseTypeOf(cType));
    }

    const decided: string[] = [];
    if ([...bases].some((type) => STDINT_TYPES.test(type))) {
      decided.push(SYSTEM_INCLUDE_TARGETS.stdint);
    }
    if (bases.has("bool")) {
      decided.push(SYSTEM_INCLUDE_TARGETS.stdbool);
    }
    return decided;
  }

  /**
   * The type without its pointer, array or qualifier decoration.
   *
   * `mapType` returns `uint8_t*` for a pointer and `char[65]` for a
   * `string<64>`, and the question here is about the element type either way.
   */
  private static baseTypeOf(cType: string): string {
    // Written without regular expressions on purpose. `/\s*\*+$/` and
    // `/\[[^\]]*\]$/` both let one quantifier feed another over the same
    // input, which SonarCloud flags as super-linear backtracking (S5852).
    // Index arithmetic answers the same question in one pass.
    const array = cType.indexOf("[");
    const withoutArray = array === -1 ? cType : cType.slice(0, array);
    const words = withoutArray.replaceAll("*", " ").trim().split(/\s+/);
    return words.at(-1) ?? "";
  }
}

export default CTypeIncludes;
