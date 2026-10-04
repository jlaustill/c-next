/**
 * What a value fixed at compile time is told when it has none (#1175, #1669):
 * the wording for E0909 and E0910, once, for an enum member's value and an
 * array dimension alike.
 */
import type TConstResult from "../../../types/TConstResult";

type TWithoutValue = Extract<
  TConstResult,
  { kind: "notConstant" } | { kind: "foreign" }
>;

/** Each reason's sentence, after the offending part's spelling */
const REASON: Readonly<
  Record<Extract<TConstResult, { kind: "notConstant" }>["reason"], string>
> = {
  variable: "is a variable",
  parameter: "is a parameter",
  function: "is a function",
  call: "is a function call",
  scope: "is a scope",
  unfolded: "has no value known at compile time",
  laterMember: "is declared below it",
  selfMember: "is the member itself",
  unknown: "is not declared",
  subscript: "is an array element",
  float: "is a floating-point value",
  string: "is a string",
  character: "is a character",
  initializer: "is an initializer",
  address: "is an address",
  member: "is a member access",
  leadingZero:
    "is a leading-zero literal, which has no value: C-Next has no octal literal (E0912)",
  divisionByZero: "divides by zero",
  negativeShift:
    "shifts by a negative amount, or shifts a negative value right",
};

class ConstantDiagnostics {
  /**
   * Why `result` has no value, as E0909 says it; null when another code owns
   * the reason -- a division by zero is E0800's, an undeclared name E0427's --
   * so a program is told once.
   */
  static why(result: TWithoutValue): string | null {
    if (result.kind === "foreign") {
      return {
        header: `'${result.spelling}' is defined by a C or C++ header`,
        maybeHeader: `'${result.spelling}' is not declared in C-Next, so only an included C or C++ header can define it`,
        targetSize: `'${result.spelling}' is decided by the target`,
      }[result.why];
    }
    if (result.reason === "divisionByZero" || result.reason === "unknown") {
      return null;
    }
    return result.spelling === ""
      ? `it ${REASON[result.reason]}`
      : `'${result.spelling}' ${REASON[result.reason]}`;
  }

  /** E0910's help: the fix ADR-044 offers */
  static readonly OVERFLOW_HELP =
    "Do the arithmetic at a width that holds the result, for example by casting the operands to a wider type";
}

export default ConstantDiagnostics;
