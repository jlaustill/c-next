/**
 * #1453 / ADR-004: where a register's accessor block is emitted.
 *
 * The header when the register is part of this file's public interface, the
 * `.c` otherwise. A `#define` cannot be exported from a `.c`, so this is what
 * makes `HW.CTRL` resolve in a file that includes the one declaring `HW`.
 *
 * Asked of `PublicInterface`, which owns the rule, rather than re-derived from
 * the `public` keyword: the header and the `.c` are complements of ONE
 * decision (#1300 made the same argument for scope types), and a block
 * emitted in both files would redefine every macro.
 */
import CodeGenState from "../../../../state/CodeGenState";
import PublicInterface from "../../../../../TRANSPILE/2-Plan/PublicInterface";

class RegisterBlockPlacement {
  /**
   * What the `.c` should hold for this register: the block, or nothing once
   * it has been recorded for the header to print.
   *
   * @param cName - The register's transpiled C name (`GPIO7`, `Board__R`)
   * @param block - The rendered comment-and-`#define` block
   */
  static place(cName: string, block: string): string {
    const definedInHeader =
      CodeGenState.sourcePath !== null &&
      PublicInterface.definesTypeInHeader(
        CodeGenState.symbolTable,
        CodeGenState.sourcePath,
        cName,
      );
    if (!definedInHeader) return block;
    CodeGenState.exportedRegisterBlocks.push(block);
    return "";
  }
}

export default RegisterBlockPlacement;
