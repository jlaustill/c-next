/**
 * C Header Generator
 *
 * Generates C header (.h) files from C-Next source with C semantics
 * (pointer-based pass-by-reference).
 */

import BaseHeaderGenerator from "./BaseHeaderGenerator";

/**
 * Generates C header files with pointer-based semantics
 */
class CHeaderGenerator extends BaseHeaderGenerator {
  /**
   * #1428: this generator writes C
   */
  protected emitsCpp(): boolean {
    return false;
  }
}

export default CHeaderGenerator;
