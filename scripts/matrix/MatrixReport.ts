/**
 * Issue #1219: combines declared severity with derived occupancy.
 *
 * A violation is a cell an ADR declared an obligation for that no fixture
 * occupies. `off` cells cannot be violated -- that is the point of `off`.
 */

import AdrMatrixDeclaration from "./AdrMatrixDeclaration";
import MatrixCell from "./MatrixCell";
import IMatrixDeclaration from "../types/IMatrixDeclaration";
import IMatrixOccupancy from "../types/IMatrixOccupancy";
import IMatrixViolation from "../types/IMatrixViolation";

/** Is a cell occupied by at least one fixture? */
function isOccupied(
  occupancy: IMatrixOccupancy | undefined,
  context: string,
  relationship: string,
): boolean {
  if (occupancy === undefined) return false;
  const occupants = occupancy.cells.get(`${context}|${relationship}`);
  return occupants !== undefined && occupants.length > 0;
}

/**
 * Every unmet obligation across all ADRs, most severe first.
 *
 * A cell whose relationship is not derivable yet is skipped rather than
 * reported: the tool cannot tell an empty provider-side cell from one it simply
 * cannot see, and reporting a gap it cannot substantiate would be a guard that
 * fires on ignorance rather than on evidence.
 */
function violations(
  declarations: ReadonlyMap<string, IMatrixDeclaration>,
  occupancy: ReadonlyMap<string, IMatrixOccupancy>,
): IMatrixViolation[] {
  const found: IMatrixViolation[] = [];

  for (const adr of [...declarations.keys()].sort()) {
    const declaration = declarations.get(adr)!;
    for (const { context, relationship } of MatrixCell.all()) {
      const severity = AdrMatrixDeclaration.severityOf(
        declaration,
        context,
        relationship,
      );
      if (severity === "off") continue;
      if (!MatrixCell.isDerivable(relationship)) continue;
      if (isOccupied(occupancy.get(adr), context, relationship)) continue;
      found.push({ adr, context, relationship, severity });
    }
  }

  return found.sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === "error" ? -1 : 1;
    return a.adr.localeCompare(b.adr);
  });
}

/** Cells declared `warn` or `error` whose relationship cannot be derived yet. */
function undeterminable(
  declarations: ReadonlyMap<string, IMatrixDeclaration>,
): IMatrixViolation[] {
  const found: IMatrixViolation[] = [];
  for (const adr of [...declarations.keys()].sort()) {
    const declaration = declarations.get(adr)!;
    for (const { context, relationship } of MatrixCell.all()) {
      const severity = AdrMatrixDeclaration.severityOf(
        declaration,
        context,
        relationship,
      );
      if (severity === "off") continue;
      if (MatrixCell.isDerivable(relationship)) continue;
      found.push({ adr, context, relationship, severity });
    }
  }
  return found;
}

class MatrixReport {
  static isOccupied = isOccupied;
  static violations = violations;
  static undeterminable = undeterminable;
}

export default MatrixReport;
