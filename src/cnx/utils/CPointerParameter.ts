import type ICParameterInfo from "../types/symbols/c/ICParameterInfo";

/**
 * What a C function's pointer parameter takes (#1977): 2.1's E0895 and the
 * render's address-of read the one answer.
 */
class CPointerParameter {
  /**
   * What a parameter of exactly one pointer points to, without qualifiers:
   * `const uint8_t*` is `uint8_t`. Null for anything else.
   */
  static pointee(type: string | undefined): string | null {
    const trimmed = type?.trim() ?? "";
    const star = trimmed.indexOf("*");
    if (star < 0 || star !== trimmed.length - 1) return null;
    return trimmed
      .slice(0, star)
      .split(/\s+/)
      .filter((word) => word !== "" && word !== "const" && word !== "volatile")
      .join(" ");
  }

  /** Whether the parameter points to const: the C function will not write through it */
  static pointsToConst(parameter: ICParameterInfo): boolean {
    const star = parameter.type.indexOf("*");
    return (
      parameter.isConst ||
      parameter.type.slice(0, Math.max(star, 0)).split(/\s+/).includes("const")
    );
  }
}

export default CPointerParameter;
