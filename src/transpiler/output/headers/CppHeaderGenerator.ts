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
   * C++ uses reference syntax for pass-by-reference
   */
  protected getRefSuffix(): string {
    return "&";
  }
}

export default CppHeaderGenerator;
