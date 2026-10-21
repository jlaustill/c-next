import CROSS_COMPILER_VARIABLE from "../../types/CROSS_COMPILER_VARIABLE";
import CodedErrorText from "../../utils/CodedErrorText";
import type ITranspileError from "../../types/ITranspileError";
import type TEnvironment from "./types/TEnvironment";

/** The name read before the language was named cnx */
const OLD_NAME = "CNEXT_CROSS_COMPILER";

/**
 * Issue #2166: the environment variable that names the compiler a project
 * reads its headers with (#1713), for a target whose headers only its own
 * compiler preprocesses (ESP32/xtensa). 1.1 reads it here, and only here.
 *
 * An empty value is unset, as it always was. A set old name is E0924, so a
 * project that still sets it never has its headers read by another compiler
 * with no diagnostic.
 */
class CrossCompilerVariable {
  /** The compiler the environment names; null when it names none */
  static compiler(environment: TEnvironment): string | null {
    return environment[CROSS_COMPILER_VARIABLE] || null;
  }

  /**
   * E0924 when the environment sets the old name, at `1:0` of the run's
   * input, as every diagnostic about the run is (#1847); null when it does not.
   */
  static errorFor(
    environment: TEnvironment,
    input: string,
  ): ITranspileError | null {
    const old = environment[OLD_NAME];
    if (!old) {
      return null;
    }
    const name = CROSS_COMPILER_VARIABLE;
    return {
      sourcePath: input,
      line: 1,
      column: 0,
      severity: "error",
      message: CodedErrorText.of(
        "E0924",
        `the environment sets ${OLD_NAME}, which cnx no longer reads: it is now ${name}`,
      ),
      helpText:
        CrossCompilerVariable.compiler(environment) === null
          ? `Set ${name} to '${old}' instead, and unset ${OLD_NAME}.`
          : `${name} is set too, and names the compiler cnx reads headers with. Unset ${OLD_NAME}.`,
    };
  }
}

export default CrossCompilerVariable;
