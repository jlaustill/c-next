import type IParameterSyntax from "../types/syntax/IParameterSyntax";

/**
 * ADR-030: `main(string args[])` (or `u8 args[][]` / `i8 args[][]`) is the
 * language's own form for the command-line args, lowered to `argc`/`argv`.
 * One predicate over the plain-data parameters, for 2.1 and codegen alike.
 */
class MainSignature {
  static takesArgs(
    name: string,
    params: readonly IParameterSyntax[] | null,
  ): boolean {
    if (name !== "main" || params?.length !== 1) {
      return false;
    }
    const [{ type, dimensions }] = params;
    if (type.kind === "string" && dimensions.length === 1) {
      return true;
    }
    return (
      type.kind === "primitive" &&
      (type.name === "u8" || type.name === "i8") &&
      dimensions.length === 2
    );
  }
}

export default MainSignature;
