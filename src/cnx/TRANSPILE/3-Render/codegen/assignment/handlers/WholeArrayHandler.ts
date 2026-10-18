/**
 * A whole array assigned its list (ADR-035, #1782): `a <- [1, 2, 3, 4]`.
 *
 * C has no array assignment, so `a = {1U, 2U, 3U, 4U};` does not compile. The
 * list initializes a temporary of the target's own type -- the declaration's
 * form, so a fill-all, a string or a struct element is written as it is
 * there -- and the temporary is copied element by element. Every element is
 * read before any is written, so `pair <- [pair[1], pair[0]]` swaps.
 */
import invariant from "../../../../../utils/invariant";
import IAssignmentContext from "../../../../2-Plan/types/IAssignmentContext";
import ArrayInitHelper from "../../helpers/ArrayInitHelper";

const COPY_COMMENT =
  "// C has no array assignment: the list fills a temporary, copied element by element (ADR-035)";

function bound(size: number | string): string {
  return typeof size === "number" ? `${size}U` : size;
}

function handleWholeArray(ctx: IAssignmentContext): string {
  const plan = ctx.plannedWholeArray;
  invariant(plan !== null, "2.2 planned this whole-array write");
  const state = ctx.state;
  const leading = plan.dimensions[0];
  // Read first: the fill-all form is the value's render's, as a declaration's is
  const init = plan.fromList
    ? ArrayInitHelper.expandFillAll(
        ctx.generatedValue,
        typeof leading === "number" ? leading : null,
        state,
      )
    : ctx.generatedValue;
  const shape = plan.dimensions.map((size) => `[${size}]`).join("");
  const lines = [COPY_COMMENT];
  const temp = state.getNextTempVarName();
  lines.push(`const ${plan.elementCType} ${temp}${shape} = ${init};`);

  let target = ctx.renderTarget();
  if (ctx.targetIndexHasSideEffect) {
    // The target's subscripts are evaluated once, as a plain write's are
    const pointer = state.getNextTempVarName();
    lines.push(
      `${plan.elementCType} (*const ${pointer})${shape} = &${target};`,
    );
    target = `(*${pointer})`;
  }

  const indexes = plan.dimensions.map(() => state.getNextTempVarName());
  const subscripts = indexes.map((index) => `[${index}]`).join("");
  plan.dimensions.forEach((size, depth) => {
    const index = indexes[depth];
    lines.push(
      `${"    ".repeat(depth)}for (uint32_t ${index} = 0U; ${index} < ${bound(size)}; ${index}++) {`,
    );
  });
  const depth = plan.dimensions.length;
  lines.push(
    `${"    ".repeat(depth)}${target}${subscripts} = ${temp}${subscripts};`,
  );
  for (let level = depth - 1; level >= 0; level--) {
    lines.push(`${"    ".repeat(level)}}`);
  }
  return lines.join("\n");
}

export default handleWholeArray;
