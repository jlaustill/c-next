/**
 * Issue #1219: shared builders for matrix declarations and occupancy.
 *
 * Extracted when the renderer suite arrived and needed the same two builders
 * the report suite already had. A second copy would be a second definition of
 * what a declaration IS, free to drift from the interface it stands in for --
 * the duplicate path this project forbids.
 */

import MatrixCell from "../matrix/MatrixCell";
import IMatrixDeclaration from "../types/IMatrixDeclaration";
import IMatrixOccupancy from "../types/IMatrixOccupancy";

/** A declaration carrying exactly the listed cells; everything else is off. */
function declare(
  adr: string,
  rows: [string, string, string][],
): IMatrixDeclaration {
  return {
    adr,
    severities: new Map(
      rows.map(([context, relationship, severity]) => [
        MatrixCell.key(context as never, relationship as never),
        severity as never,
      ]),
    ),
    errors: [],
  };
}

/** Occupancy in which every listed cell is reached by one fixture. */
function occupy(adr: string, cells: [string, string][]): IMatrixOccupancy {
  return {
    adr,
    cells: new Map(
      cells.map(([context, relationship]) => [
        MatrixCell.key(context as never, relationship as never),
        ["some/fixture.test.cnx"],
      ]),
    ),
    fixturesWithoutContext: [],
  };
}

export default class MatrixTestHelpers {
  static readonly declare = declare;
  static readonly occupy = occupy;
}
