/**
 * MemberChainAnalyzer - Analyzes member access chains for bit access patterns
 *
 * Issue #644: Extracted from CodeGenerator to reduce file size.
 *
 * Used to detect bit access at the end of member chains, e.g.:
 * - grid[2][3].flags[0] - detects that [0] is bit access on flags
 * - s.arr[1][3] - detects that [3] is bit access on an array field's element
 *
 * ## It reads the typer's chain, not its own (#1668, C12)
 *
 * What the final subscript indexes is the one operand typer's answer: the
 * last step of the target's chain says the type before the subscript and the
 * subscript's kind, as 2.1's bit rules and the read path already read them.
 * This class walked the chain itself, through the render state's struct
 * fields, with its own count of how many subscripts an array field takes. That
 * count was wrong for an element of an array field, so `s.arr[1][3] <- true`
 * was emitted as `s.arr[1][3] = true;`, and it knew only C-Next integer names,
 * so a C header's `uint8_t` field was never a bit target. What is left here is
 * rendering: the base target's C text and the bit index.
 */

import IBitAccessAnalysis from "../../../../transpiler/types/IBitAccessAnalysis";
import TPlannedTargetOp from "../../../../transpiler/types/TPlannedTargetOp";
import type IChainStep from "../../../../transpiler/types/IChainStep";

class MemberChainAnalyzer {
  /**
   * Whether the chain's final subscript writes one bit of an integer.
   *
   * @param baseName - The chain's root identifier, as written
   * @param lastStep - The typer's step for the final op, or undefined
   * @param ops - The chain's ops, for rendering the base target
   */
  static analyze(
    baseName: string | null,
    lastStep: IChainStep | undefined,
    ops: readonly TPlannedTargetOp[],
  ): IBitAccessAnalysis {
    if (!baseName || ops.length === 0) {
      return { isBitAccess: false };
    }

    const lastOp = ops.at(-1)!;
    if (lastOp.kind !== "subscript" || lastOp.indexCount !== 1) {
      return { isBitAccess: false };
    }

    const indexed = lastStep?.before ?? null;
    if (lastStep?.subscript !== "bit_single" || indexed === null) {
      return { isBitAccess: false };
    }
    // A bit of an integer whose width is known; the width picks `1U` or
    // `1ULL` for the mask
    const isInteger =
      indexed.category === "signed" || indexed.category === "unsigned";
    if (!isInteger || indexed.typeName === null) {
      return { isBitAccess: false };
    }

    return {
      isBitAccess: true,
      baseTarget: MemberChainAnalyzer.buildBaseTarget(
        baseName,
        ops.slice(0, -1),
      ),
      bitIndex: lastOp.renderIndexes()[0],
      baseType: indexed.typeName,
    };
  }

  /**
   * Build the target expression string from base identifier and postfix operations.
   */
  private static buildBaseTarget(
    baseId: string,
    ops: readonly TPlannedTargetOp[],
  ): string {
    let result = baseId;
    for (const op of ops) {
      if (op.kind === "member") {
        result += "." + op.name;
      } else {
        result += "[" + op.renderIndexes().join(", ") + "]";
      }
    }
    return result;
  }
}

export default MemberChainAnalyzer;
