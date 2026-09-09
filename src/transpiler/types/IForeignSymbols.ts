import type TCSymbol from "./symbols/c/TCSymbol";
import type TCppSymbol from "./symbols/cpp/TCppSymbol";

/**
 * The symbols this program's C and C++ headers declare.
 *
 * A shared contract rather than a codegen type: 1.4 Resolve takes it to derive
 * the cross-file facts that are ABOUT foreign declarations — symbol conflicts
 * among them, which header declares a type, opaque-vs-defined — and the
 * orchestrator supplies it. `Program` holds C-Next symbols only, which is why
 * those three facts could not previously be authored there (#1511).
 *
 * The two languages stay separate because their order is observable: a
 * conflict report lists definitions C-Next first, then C, then C++.
 */
interface IForeignSymbols {
  readonly c: ReadonlyArray<TCSymbol>;
  readonly cpp: ReadonlyArray<TCppSymbol>;
}

export default IForeignSymbols;
