/**
 * C++ Header Generator
 *
 * Generates C++ header (.h) files from C-Next source with C++ semantics
 * (reference-based pass-by-reference).
 */

import BaseHeaderGenerator from "./BaseHeaderGenerator";

/**
 * Generates C++ header files with reference-based semantics
 */
class CppHeaderGenerator extends BaseHeaderGenerator {
  /**
   * #1428: this generator writes C++
   */
  protected emitsCpp(): boolean {
    return true;
  }
}

export default CppHeaderGenerator;
