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
import TMatrixContext from "../types/TMatrixContext";
import TMatrixRelationship from "../types/TMatrixRelationship";

/**
 * Is a cell occupied by at least one fixture?
 *
 * The key comes from `MatrixCell.key`, which declares itself the sole encoder.
 * Spelling it out here instead made this a second definition of the encoding:
 * changing the separator in the encoder alone then reported every cell as
 * unoccupied, telling the author they were missing tests when nothing about the
 * corpus had changed.
 */
function isOccupied(
  occupancy: IMatrixOccupancy | undefined,
  context: TMatrixContext,
  relationship: TMatrixRelationship,
): boolean {
  if (occupancy === undefined) return false;
  const occupants = occupancy.cells.get(MatrixCell.key(context, relationship));
  return occupants !== undefined && occupants.length > 0;
}

/** Decides whether a declared cell belongs in the collected set. */
type TCellPredicate = (
  relationship: TMatrixRelationship,
  adr: string,
  context: TMatrixContext,
) => boolean;

/**
 * Walk every declared cell across every ADR, keeping those the predicate accepts.
 *
 * One walker rather than two near-identical loops: adding a context or a
 * relationship must not require the same edit in two places.
 */
function collect(
  declarations: ReadonlyMap<string, IMatrixDeclaration>,
  accept: TCellPredicate,
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
      if (!accept(relationship, adr, context)) continue;
      found.push({ adr, context, relationship, severity });
    }
  }

  return found;
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
  return collect(
    declarations,
    (relationship, adr, context) =>
      MatrixCell.isDerivable(relationship) &&
      !isOccupied(occupancy.get(adr), context, relationship),
  ).sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === "error" ? -1 : 1;
    return a.adr.localeCompare(b.adr);
  });
}

/** Cells declared `warn` or `error` whose relationship cannot be derived yet. */
function undeterminable(
  declarations: ReadonlyMap<string, IMatrixDeclaration>,
): IMatrixViolation[] {
  return collect(
    declarations,
    (relationship) => !MatrixCell.isDerivable(relationship),
  );
}

/** Total number of cells carrying an obligation, across every ADR. */
function obligationCount(
  declarations: ReadonlyMap<string, IMatrixDeclaration>,
): number {
  let total = 0;
  for (const declaration of declarations.values()) {
    for (const severity of declaration.severities.values()) {
      if (severity !== "off") total += 1;
    }
  }
  return total;
}

class MatrixReport {
  static isOccupied = isOccupied;
  static violations = violations;
  static undeterminable = undeterminable;
  static obligationCount = obligationCount;
}

export default MatrixReport;
