/**
 * #1664 review of #1668's C11: how every pass folds a constant, from 1.4 on.
 *
 * A name's value is its bound declaration's: the binder decides what a
 * spelling means (a local, then the enclosing scope's member, then a
 * file-scope global -- ADR-057), and only a const that folded has a value.
 * The folds used to be handed maps of the consts that had folded, keyed by
 * name. A name bound to anything else -- a parameter, a variable, a const
 * that did not fold, a scope const declared further down -- was simply
 * absent, so the same spelling one level out answered instead: a false
 * E0854 on `arr[N]` for a parameter `N`, a scope array sized by the global's
 * `N`. Asking the binder has no such fallthrough.
 */
import ArrayDimensionParser from "./ArrayDimensionParser";
import TypeCheckUtils from "./TypeCheckUtils";
import TTypeUtils from "./TTypeUtils";
import TYPE_WIDTH from "../transpiler/constants/TYPE_WIDTH";
import type IConstantEvalOptions from "./types/IConstantEvalOptions";
import type IFoldedConstant from "../transpiler/types/IFoldedConstant";
import type IProgram from "../transpiler/types/IProgram";
import type ISourcePosition from "./types/ISourcePosition";
import type TType from "../transpiler/types/TType";

type TConstantOf = (name: string) => IFoldedConstant | undefined;

class ConstantFold {
  /** The one option set: the names in view, and the widths `sizeof` needs */
  static options(constantOf: TConstantOf): IConstantEvalOptions {
    return { constantOf, typeWidths: TYPE_WIDTH };
  }

  /** The options for an expression written at `at` in `sourceFile` */
  static at(
    program: IProgram,
    sourceFile: string,
    at: ISourcePosition,
  ): IConstantEvalOptions {
    return ConstantFold.options(
      (name) => program.constantAt(sourceFile, name, at) ?? undefined,
    );
  }

  /** An expression's value from its text, or undefined */
  static value(text: string, constantOf: TConstantOf): number | undefined {
    return ArrayDimensionParser.parseText(
      text,
      ConstantFold.options(constantOf),
    );
  }

  /**
   * A const declaration's value: its initializer's, when the declared type
   * holds it. `const u8 B <- 300` has no value, whatever E0868 says of it,
   * and neither does a float or other non-integer const.
   */
  static declared(
    initializer: string,
    type: TType,
    constantOf: TConstantOf,
  ): number | undefined {
    const value = ConstantFold.value(initializer, constantOf);
    if (value === undefined) return undefined;
    const typeName = ConstantFold.typeNameOf(type);
    const range =
      typeName === null ? null : TypeCheckUtils.integerRange(typeName);
    if (range === null) return undefined;
    return BigInt(value) >= range[0] && BigInt(value) <= range[1]
      ? value
      : undefined;
  }

  /** A declared type's C-Next name, for the range a folded value must fit */
  static typeNameOf(type: TType): string | null {
    return TTypeUtils.isPrimitive(type) ? type.primitive : null;
  }
}

export default ConstantFold;
