/**
 * Handler for simple assignments (ADR-109).
 *
 * The fallback case: generates `target = value;` or `target op= value;`
 * Used when no special handling is needed.
 *
 * Issue #845: MISRA 10.3 - For compound assignments on narrower types (i8, i16,
 * u8, u16), expands to explicit cast: `target = (type)(target OP value);`
 */
import IAssignmentContext from "../IAssignmentContext";
import CodeGenState from "../../../../state/CodeGenState";
import type ICodeGenApi from "../../types/ICodeGenApi";
import NarrowingCastHelper from "../../helpers/NarrowingCastHelper.js";
import TYPE_MAP from "../../types/TYPE_MAP.js";
import CppModeHelper from "../../helpers/CppModeHelper.js";

/** Get typed generator reference */
function gen(): ICodeGenApi {
  return CodeGenState.generator as ICodeGenApi;
}

/**
 * Map compound assignment operator to its binary operator equivalent.
 */
const COMPOUND_TO_BINARY: Record<string, string> = {
  "+=": "+",
  "-=": "-",
  "*=": "*",
  "/=": "/",
  "%=": "%",
  "&=": "&",
  "|=": "|",
  "^=": "^",
  "<<=": "<<",
  ">>=": ">>",
};

/**
 * Handle simple variable assignment.
 *
 * @example
 * x <- 5           =>  x = 5;
 * counter +<- 1    =>  counter += 1;
 * i16_val &<- 0xFF =>  i16_val = (int16_t)(i16_val & 0xFF);  // MISRA 10.3
 */
function handleSimpleAssignment(ctx: IAssignmentContext): string {
  const target = gen().generateAssignmentTarget(ctx.targetCtx);

  // For compound assignments on narrower types, expand to explicit cast
  if (ctx.isCompound && ctx.firstIdTypeInfo) {
    const baseType = ctx.firstIdTypeInfo.baseType;
    const promotedType = NarrowingCastHelper.getPromotedType(baseType);

    // If the type gets promoted to int, we need explicit cast
    if (promotedType === "int" && baseType !== "int") {
      const binaryOp = COMPOUND_TO_BINARY[ctx.cOp];
      if (binaryOp) {
        const cType = TYPE_MAP[baseType] ?? baseType;
        // Parenthesize the expression to ensure cast applies to full expression
        const expr = `(${target} ${binaryOp} ${ctx.generatedValue})`;
        const castExpr = CppModeHelper.cast(cType, expr);
        return `${target} = ${castExpr};`;
      }
    }
  }

  return `${target} ${ctx.cOp} ${ctx.generatedValue};`;
}

export default handleSimpleAssignment;
