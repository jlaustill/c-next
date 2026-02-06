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
   * C uses pointers for pass-by-reference
   */
  protected getPassByRefSuffix(): string {
    return "*";
  }
}

export default CHeaderGenerator;
