/**
 * 2.2 Plan -- which system headers a file's public header includes.
 *
 * `docs/architecture/README.md` §1: "**2.2 decides, 2.3 formats.** 'Does this
 * file need `<stdint.h>`?' is decided once, in the plan."
 *
 * ## Why this can be a symbol walk now, and could not be before
 *
 * #1517 first made the header precise by scanning the declarations it had just
 * rendered, and deliberately so: deciding from the SYMBOLS would have meant
 * working out, a second time, what `mapType` works out when it renders -- that
 * `u32` becomes `uint32_t`. Two derivations of one mapping is the defect the
 * whole pass exists to remove, and putting one in the plan would only have
 * moved it somewhere more respectable.
 *
 * #1520 removed the second derivation. `headerCType` is now the one answer to
 * "what does this header call this type", shared by struct fields, function
 * returns and parameters -- so asking it here is asking the renderer's own
 * question, not re-deciding it. The scan can go, and with it Render's last
 * say in what a header contains.
 *
 * ## Under-including is the direction that breaks a build
 *
 * A type this misses loses its header. `npm run headers:standalone:check`
 * compiles all 1305 generated headers alone, so a miss is a red build rather
 * than something a consumer discovers -- which is what makes a walk safe to
 * prefer over a text scan that could only ever over-include.
 */

import type SymbolTable from "../../transpiler/logic/symbols/SymbolTable";
import type TSymbol from "../../transpiler/types/symbols/TSymbol";
import SYSTEM_INCLUDE_TARGETS from "../../transpiler/constants/SYSTEM_INCLUDE_TARGETS";
import headerCType from "../../utils/headerCType";
import HeaderTypeNames from "./HeaderTypeNames";

/** Fixed-width integer types, which `<stdint.h>` declares. */
const STDINT_TYPES = /^(?:u?int(?:8|16|32|64)_t|u?intptr_t|u?intmax_t)$/;

class HeaderIncludes {
  /**
   * The system headers this file's public header emits, in emission order.
   *
   * @param exportedSymbols the file's public interface, as `PublicInterface`
   *   settled it -- the same list the header is generated from
   * @param symbolTable for the C++ namespace spelling `headerCType` needs
   */
  static decide(
    exportedSymbols: readonly TSymbol[],
    symbolTable: SymbolTable | undefined,
  ): string[] {
    const cTypes = new Set<string>();
    for (const named of HeaderTypeNames.collect(exportedSymbols)) {
      cTypes.add(HeaderIncludes.baseTypeOf(headerCType(named, symbolTable)));
    }

    const decided: string[] = [];
    if ([...cTypes].some((type) => STDINT_TYPES.test(type))) {
      decided.push(SYSTEM_INCLUDE_TARGETS.stdint!);
    }
    if (cTypes.has("bool")) {
      decided.push(SYSTEM_INCLUDE_TARGETS.stdbool!);
    }
    return decided;
  }

  /**
   * The type without its pointer or array decoration.
   *
   * `mapType` returns `uint8_t*` for a pointer and `char[65]` for a
   * `string<64>`, and the question here is about the element type either way.
   */
  private static baseTypeOf(cType: string): string {
    // Written without regular expressions on purpose. `/\s*\*+$/` and
    // `/\[[^\]]*\]$/` both let one quantifier feed another over the same
    // input, which SonarCloud flags as super-linear backtracking (S5852) --
    // and this runs once per named type per file. Index arithmetic answers the
    // same question in one pass and reads no worse.
    const array = cType.indexOf("[");
    const withoutArray = array === -1 ? cType : cType.slice(0, array);
    return withoutArray.replaceAll("*", "").trim();
  }
}

export default HeaderIncludes;
