import CROSS_COMPILER_VARIABLE from "../../types/CROSS_COMPILER_VARIABLE";
import type TEnvironment from "./types/TEnvironment";

/**
 * Issue #2166: the environment variable that names the compiler a project
 * reads its headers with (#1713), for a target whose headers only its own
 * compiler preprocesses (ESP32/xtensa). 1.1 reads it here, and only here.
 *
 * An empty value is unset.
 */
class CrossCompilerVariable {
  /** The compiler the environment names; null when it names none */
  static compiler(environment: TEnvironment): string | null {
    return environment[CROSS_COMPILER_VARIABLE] || null;
  }
}

export default CrossCompilerVariable;
