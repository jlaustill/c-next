/**
 * #1735: a value in a static-storage initializer that C-Next cannot fix at
 * compile time (E0909), or whose arithmetic would clamp or wrap there
 * (E0910, ADR-044 "Values fixed at compile time"). C requires a constant
 * expression in a file-scope or scope variable's initializer (C99 6.7.8p4),
 * so one that reached render was C the compiler rejects, at exit 0.
 */
import type IProgramSyntax from "../../types/syntax/IProgramSyntax";
import type IValuePositions from "../../types/IValuePositions";
import ConstantDiagnostics from "./helpers/ConstantDiagnostics";
import StaticInitializers from "./helpers/StaticInitializers";
import type IAnalysisContext from "./types/IAnalysisContext";
import type IStaticInitializerError from "./types/IStaticInitializerError";

class StaticInitializerAnalyzer {
  constructor(private readonly context: IAnalysisContext) {}

  public analyze(
    program: IProgramSyntax,
    valuePositions: IValuePositions,
  ): IStaticInitializerError[] {
    const errors: IStaticInitializerError[] = [];
    const { program: resolved, sourceFile } = this.context;
    for (const value of StaticInitializers.values(
      program,
      valuePositions.positions,
    )) {
      const settled = StaticInitializers.settle(value, resolved, sourceFile);
      const at = {
        line: value.value.span.line,
        column: value.value.span.column,
      };
      if (settled?.kind === "overflow") {
        const cast = StaticInitializers.isCast(value);
        errors.push({
          code: "E0910",
          ...at,
          message: cast
            ? `Static initializer overflows ${settled.typeName} at compile time: the value cast to ${settled.typeName} does not fit it (ADR-024, ADR-044)`
            : `Static initializer overflows ${settled.typeName} at compile time: the arithmetic would clamp or wrap (ADR-044)`,
          helpText: cast
            ? "Write a value the type holds, or cast to a type wide enough for it"
            : ConstantDiagnostics.OVERFLOW_HELP,
        });
      } else if (
        settled !== null &&
        settled.kind === "notConstant" &&
        StaticInitializers.lacksValue(value, settled)
      ) {
        const why = ConstantDiagnostics.why(settled);
        if (why === null) continue;
        errors.push({
          code: "E0909",
          ...at,
          message: `Static initializer must be known at compile time: ${why}`,
          helpText:
            "A file-scope or scope variable is initialized before the program runs, so C requires a constant expression (C99 6.7.8p4): literals, read-only bindings that are not `volatile` (ADR-064), length properties (.type_byte_length) and casts",
        });
      }
    }
    return errors;
  }
}

export default StaticInitializerAnalyzer;
