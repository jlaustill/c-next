import type IVariableSymbol from "../../../types/symbols/IVariableSymbol";
import ConstLiteral from "../../../utils/ConstLiteral";
import ConstantFold from "../../../utils/ConstantFold";
import ScopeUtils from "../../../utils/ScopeUtils";
import type TranspileState from "../../TranspileState";
import type IGeneratorOutput from "./generators/IGeneratorOutput";
import type IGeneratorState from "./generators/IGeneratorState";
import generateLiteral from "./generators/expressions/LiteralGenerator";

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
class PrivateConstValue {
  static inlined(
    generatorState: IGeneratorState,
    transpileState: TranspileState,
    cName: string,
  ): IGeneratorOutput | null {
    const symbol = transpileState.typingContext().program.symbolByCName(cName);
    if (symbol?.kind !== "variable" || !PrivateConstValue.canInline(symbol)) {
      return null;
    }
    return PrivateConstValue.constant(generatorState, transpileState, cName);
  }

  /**
   * Any const's value as a C constant expression, or null -- what a `case`
   * label needs of a public or file-scope const too, which is emitted as an
   * object C cannot switch on (C99 6.8.4.2p3)
   */
  static constant(
    generatorState: IGeneratorState,
    transpileState: TranspileState,
    cName: string,
  ): IGeneratorOutput | null {
    const program = transpileState.typingContext().program;
    const symbol = program.symbolByCName(cName);
    if (symbol?.kind !== "variable") return null;
    const text = ConstLiteral.textOf(program, symbol);
    if (text === null) return null;
    const settled = program.settledConstOf(cName);
    if (settled?.kind === "value" && settled.digits === I64_MIN) {
      return { code: I64_MIN_SPELLING, effects: [] };
    }
    // A literal has no sign: a negative value is the negated literal, in
    // parentheses so `-X` does not read as a decrement
    const negative = text.startsWith("-");
    const output = generateLiteral(
      negative ? text.slice(1) : text,
      {
        ...generatorState,
        expectedType: ConstantFold.typeNameOf(symbol.type),
      },
      transpileState,
    );
    return negative ? { ...output, code: `(-${output.code})` } : output;
  }

  /** Issue #282: a private scope const, which is never emitted when it has a value */
  private static canInline(symbol: IVariableSymbol): boolean {
    return (
      !ScopeUtils.isGlobalScopePath(symbol.scopePath) &&
      symbol.visibility === "private"
    );
  }
}

export default PrivateConstValue;
