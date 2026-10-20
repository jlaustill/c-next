import type TPlannedNarrowing from "./types/TPlannedNarrowing";
import NarrowingCastHelper from "./NarrowingCastHelper";
import type IProgram from "../../types/IProgram";
import type IVariableSymbol from "../../types/symbols/IVariableSymbol";
import ConstLiteral from "../../utils/ConstLiteral";
import ConstantFold from "../../utils/ConstantFold";
import ScopeUtils from "../../utils/ScopeUtils";

/** The most negative i64, which no C literal reaches, and how C spells it */
const I64_MIN = "-9223372036854775808";
const I64_MIN_SPELLING = "(-9223372036854775807LL - 1)";

/**
 * #1739: what a private scope const is written as where it is used, or null
 * when it is emitted as its object instead (ADR-016) -- the one decision the
 * use sites and the declaration's own emission both read.
 *
 * The value is the one 1.4 settled, which is the value the const sizes an
 * array with, so a use and a dimension cannot disagree. Its initializer's text
 * was substituted here before and re-read where the use was: `M <- N * 2`
 * meant the scope's N in a dimension and the global N in a function, and
 * `this.N + 1` reached C as written.
 *
 * A use is a C constant expression, because a use can stand in a static
 * initializer, where C99 6.7.8p4 takes nothing else (a `const` object is not
 * one): an integer is spelled as a literal of its type, a float as its value
 * held at its type, a bool as `true`/`false` and an enum as its member. Each
 * is rendered by `generateLiteral`, so it is spelled as a literal of its
 * declared type. A char literal is that literal, and a name only a header
 * knows (a macro) is that name, which C evaluates. A const with no such value
 * (a string, or one whose initializer is not constant) is emitted.
 */
class PrivateConstSpelling {
  /** Whether `inlined` writes the const as its value: 2.2 decides it (#282) */
  static inlines(program: IProgram, cName: string): boolean {
    const symbol = program.symbolByCName(cName);
    return (
      symbol?.kind === "variable" &&
      PrivateConstSpelling.canInline(symbol) &&
      PrivateConstSpelling.spelling(program, cName) !== null
    );
  }

  /**
   * MISRA 10.3: a char const's literal is an `int` in C, cast to the const's
   * type where it is written; null for any other const
   */
  static narrowingOf(
    program: IProgram,
    cName: string,
  ): TPlannedNarrowing | null {
    const spelling = PrivateConstSpelling.spelling(program, cName);
    if (
      spelling === null ||
      spelling.verbatim ||
      !spelling.text.startsWith("'") ||
      spelling.typeName === null
    ) {
      return null;
    }
    return NarrowingCastHelper.narrowingOf("int", spelling.typeName);
  }

  /**
   * The literal a const is written as and the type it is held at, or null
   * when it has none; `verbatim` is C's own spelling, written as it stands
   */
  static spelling(
    program: IProgram,
    cName: string,
  ): { text: string; typeName: string | null; verbatim: boolean } | null {
    const symbol = program.symbolByCName(cName);
    if (
      symbol?.kind !== "variable" ||
      !ConstantFold.hasCompileTimeValue(symbol) ||
      symbol.isArray ||
      symbol.initialValueExpr === undefined ||
      symbol.initialValue === undefined
    ) {
      return null;
    }
    const settled = program.settledConstOf(cName);
    if (settled?.kind === "value" && settled.digits === I64_MIN) {
      return { text: I64_MIN_SPELLING, typeName: null, verbatim: true };
    }
    const text = ConstLiteral.textOf(program, symbol);
    if (text === null) return null;
    return {
      text,
      typeName: ConstantFold.typeNameOf(symbol.type),
      verbatim: false,
    };
  }

  /** Issue #282: a private scope const, which is never emitted when it has a value */
  static canInline(symbol: IVariableSymbol): boolean {
    return (
      !ScopeUtils.isGlobalScopePath(symbol.scopePath) &&
      symbol.visibility === "private"
    );
  }
}

export default PrivateConstSpelling;
