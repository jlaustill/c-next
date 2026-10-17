import TYPE_MAP from "./types/TYPE_MAP";
import type TArgumentForm from "./types/TArgumentForm";
import type TArgumentShape from "./types/TArgumentShape";

/** Parameter types a string's element is not cast to a pointer of */
const NOT_CAST_TO = new Set(["float", "double", "bool", "void"]);

/**
 * ADR-006: how a by-reference argument is written -- 2.2 plans the C type it
 * writes and 2.3 writes it, from this one decision (#1991)
 */
class ArgumentForm {
  /**
   * How an argument passed by reference is written (#1991): the one decision
   * 2.3 writes it by and 2.2 plans its C type from.
   */
  static of(
    isIdentifier: boolean,
    targetParamBaseType: string | undefined,
    shape: TArgumentShape,
    cppMode: boolean,
  ): TArgumentForm {
    if (isIdentifier) return { kind: "identifier" };

    const lvalueType = shape.getLvalueType();
    if (lvalueType === null) {
      return ArgumentForm.rvalue(targetParamBaseType, shape, cppMode);
    }
    if (lvalueType === "member") {
      return ArgumentForm.member(targetParamBaseType, shape);
    }

    // A string's element goes to an integer pointer parameter cast
    const cType =
      targetParamBaseType && shape.isStringSubscriptAccess()
        ? TYPE_MAP[targetParamBaseType]
        : undefined;
    return {
      kind: "lvalue",
      cast: cType && !NOT_CAST_TO.has(cType) ? cType : null,
    };
  }

  /**
   * C++: an rvalue binds to `const T&`; C takes a compound literal's address,
   * which a struct literal already is (#1530)
   */
  private static rvalue(
    targetParamBaseType: string | undefined,
    shape: TArgumentShape,
    cppMode: boolean,
  ): TArgumentForm {
    if (!cppMode && shape.isStructLiteral()) return { kind: "literal-address" };
    const cType = targetParamBaseType
      ? TYPE_MAP[targetParamBaseType]
      : undefined;
    return {
      kind: "rvalue",
      compoundLiteral: !cType || cType === "void" || cppMode ? null : cType,
    };
  }

  /** A struct member: a whole array, a C++ conversion temporary, or itself */
  private static member(
    targetParamBaseType: string | undefined,
    shape: TArgumentShape,
  ): TArgumentForm {
    const arrayStatus = shape.getMemberAccessArrayStatus();
    if (arrayStatus === "array") return { kind: "array-member" };
    if (
      arrayStatus === "not-array" &&
      targetParamBaseType &&
      shape.isCppMemberConversionRequired(targetParamBaseType)
    ) {
      return {
        kind: "member-temp",
        cType: TYPE_MAP[targetParamBaseType] || "uint8_t",
      };
    }
    return { kind: "lvalue", cast: null };
  }

  /** The C type `form` writes, or null */
  static cTypeOf(form: TArgumentForm): string | null {
    switch (form.kind) {
      case "member-temp":
        return form.cType;
      case "lvalue":
        return form.cast;
      case "rvalue":
        return form.compoundLiteral;
      default:
        return null;
    }
  }
}

export default ArgumentForm;
