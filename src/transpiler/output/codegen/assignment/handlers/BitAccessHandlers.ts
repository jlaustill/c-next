/**
 * Integer bit access assignment handlers (ADR-109).
 *
 * Handles bit manipulation on integer variables:
 * - INTEGER_BIT: flags[3] <- true
 * - INTEGER_BIT_RANGE: flags[0, 3] <- 5
 * - STRUCT_MEMBER_BIT: item.byte[7] <- true
 * - ARRAY_ELEMENT_BIT: matrix[i][j][FIELD_BIT] <- false
 */
import AssignmentKind from "../AssignmentKind";
import IAssignmentContext from "../IAssignmentContext";
import BitUtils from "../../../../../utils/BitUtils";
import TAssignmentHandler from "./TAssignmentHandler";
import CodeGenState from "../../../../state/CodeGenState";
import type ICodeGenApi from "../../types/ICodeGenApi";

/** Get typed generator reference */
function gen(): ICodeGenApi {
  return CodeGenState.generator as ICodeGenApi;
}

/**
 * Validate compound operators are not used with bit access.
 */
function validateNotCompound(ctx: IAssignmentContext): void {
  if (ctx.isCompound) {
    throw new Error(
      `Compound assignment operators not supported for bit field access: ${ctx.cnextOp}`,
    );
  }
}

/**
 * Handle single bit on integer variable: flags[3] <- true
 * Also handles float bit indexing: f32Var[3] <- true
 * Uses resolvedBaseIdentifier for proper scope prefix support.
 */
function handleIntegerBit(ctx: IAssignmentContext): string {
  validateNotCompound(ctx);

  // Use resolvedBaseIdentifier for type lookup and code generation
  // e.g., "ArrayBug_flags" instead of "flags"
  const name = ctx.resolvedBaseIdentifier;
  const bitIndex = gen().generateExpression(ctx.subscripts[0]);
  const typeInfo = CodeGenState.getVariableTypeInfo(name);

  // Check for float bit indexing
  if (typeInfo) {
    const floatResult = gen().generateFloatBitWrite(
      name,
      typeInfo,
      bitIndex,
      null, // single bit, no width
      ctx.generatedValue,
    );
    if (floatResult !== null) {
      return floatResult;
    }
  }

  // Integer bit write - pass type for 64-bit aware code generation
  return BitUtils.singleBitWrite(
    name,
    bitIndex,
    ctx.generatedValue,
    typeInfo?.baseType,
  );
}

/**
 * Handle bit range on integer variable: flags[0, 3] <- 5
 * Also handles float bit range: f32Var[0, 8] <- 0xFF
 * Uses resolvedBaseIdentifier for proper scope prefix support.
 */
function handleIntegerBitRange(ctx: IAssignmentContext): string {
  validateNotCompound(ctx);

  // Use resolvedBaseIdentifier for type lookup and code generation
  const name = ctx.resolvedBaseIdentifier;
  const start = gen().generateExpression(ctx.subscripts[0]);
  const width = gen().generateExpression(ctx.subscripts[1]);
  const typeInfo = CodeGenState.getVariableTypeInfo(name);

  // Check for float bit indexing
  if (typeInfo) {
    const floatResult = gen().generateFloatBitWrite(
      name,
      typeInfo,
      start,
      width, // pass width for range writes
      ctx.generatedValue,
    );
    if (floatResult !== null) {
      return floatResult;
    }
  }

  // Integer bit range write - pass type for 64-bit aware code generation
  return BitUtils.multiBitWrite(
    name,
    start,
    width,
    ctx.generatedValue,
    typeInfo?.baseType,
  );
}

/**
 * Handle bit on struct member: item.byte[7] <- true
 * This is handled through MEMBER_CHAIN with bit detection.
 */
function handleStructMemberBit(ctx: IAssignmentContext): string {
  validateNotCompound(ctx);

  // The target up to the last subscript is the struct member path
  // The last subscript is the bit index
  // This pattern is complex - the target needs to be built from the member chain
  // For now, delegate to the existing target generator and build the bit op
  const target = gen().generateAssignmentTarget(ctx.targetCtx);

  // Extract the bit index from the last subscript
  const bitIndex = gen().generateExpression(ctx.subscripts.at(-1)!);

  // Limitation: Uses literal "1U" which works for types up to 32 bits.
  // For 64-bit struct members, would need to track member type through chain.
  const one = "1U";
  const intValue = BitUtils.boolToInt(ctx.generatedValue);

  return `${target} = (${target} & ~(${one} << ${bitIndex})) | (${intValue} << ${bitIndex});`;
}

/**
 * Handle bit on multi-dimensional array element: matrix[i][j][FIELD_BIT] <- false
 * Uses resolvedBaseIdentifier for proper scope prefix support.
 */
function handleArrayElementBit(ctx: IAssignmentContext): string {
  validateNotCompound(ctx);

  // Use resolvedBaseIdentifier for type lookup and code generation
  const arrayName = ctx.resolvedBaseIdentifier;
  const typeInfo = CodeGenState.getVariableTypeInfo(arrayName);

  if (!typeInfo?.arrayDimensions) {
    // Use raw identifier in error message for clarity
    const rawName = ctx.identifiers[0];
    throw new Error(`Error: ${rawName} is not an array`);
  }

  const numDims = typeInfo.arrayDimensions.length;

  // Array indices are subscripts[0..numDims-1], bit index is subscripts[numDims]
  const arrayIndices = ctx.subscripts
    .slice(0, numDims)
    .map((e) => `[${gen().generateExpression(e)}]`)
    .join("");
  const bitIndex = gen().generateExpression(ctx.subscripts[numDims]);

  const arrayElement = `${arrayName}${arrayIndices}`;

  // Use 1ULL for 64-bit element types
  const one = BitUtils.oneForType(typeInfo.baseType);
  const intValue = BitUtils.boolToInt(ctx.generatedValue);

  return `${arrayElement} = (${arrayElement} & ~(${one} << ${bitIndex})) | (${intValue} << ${bitIndex});`;
}

/**
 * Handle bit range through struct chain: devices[0].control[0, 4] <- 15
 *
 * The target is a chain like array[idx].member or struct.field with a
 * bit range subscript [start, width] at the end.
 * Uses resolvedBaseIdentifier for proper scope prefix support.
 */
function handleStructChainBitRange(ctx: IAssignmentContext): string {
  validateNotCompound(ctx);

  // Build the base target from postfixOps, excluding the last one (the bit range)
  // Use resolvedBaseIdentifier for the base to include scope prefix
  const baseId = ctx.resolvedBaseIdentifier;
  const opsBeforeLast = ctx.postfixOps.slice(0, -1);

  let baseTarget = baseId;
  for (const op of opsBeforeLast) {
    const memberId = op.IDENTIFIER();
    if (memberId) {
      baseTarget += "." + memberId.getText();
    } else {
      const exprs = op.expression();
      if (exprs.length > 0) {
        baseTarget += "[" + gen().generateExpression(exprs[0]) + "]";
      }
    }
  }

  // Get start and width from the last postfixOp (the bit range)
  const lastOp = ctx.postfixOps.at(-1)!;
  const bitRangeExprs = lastOp.expression();
  const start = gen().generateExpression(bitRangeExprs[0]);
  const width = gen().generateExpression(bitRangeExprs[1]);

  // Generate bit range write
  // Limitation: assumes 32-bit types. For 64-bit struct members,
  // would need to track member type through chain.
  return BitUtils.multiBitWrite(baseTarget, start, width, ctx.generatedValue);
}

/**
 * All bit access handlers for registration.
 * Issue #954: THIS_BIT and THIS_BIT_RANGE reuse the integer bit handlers
 * since they use resolvedBaseIdentifier which includes the scope prefix.
 */
const bitAccessHandlers: ReadonlyArray<[AssignmentKind, TAssignmentHandler]> = [
  [AssignmentKind.INTEGER_BIT, handleIntegerBit],
  [AssignmentKind.INTEGER_BIT_RANGE, handleIntegerBitRange],
  [AssignmentKind.THIS_BIT, handleIntegerBit],
  [AssignmentKind.THIS_BIT_RANGE, handleIntegerBitRange],
  [AssignmentKind.STRUCT_MEMBER_BIT, handleStructMemberBit],
  [AssignmentKind.ARRAY_ELEMENT_BIT, handleArrayElementBit],
  [AssignmentKind.STRUCT_CHAIN_BIT_RANGE, handleStructChainBitRange],
];

export default bitAccessHandlers;
