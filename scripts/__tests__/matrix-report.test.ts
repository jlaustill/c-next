/**
 * Issue #1219: declared severity combined with derived occupancy.
 *
 * The gate's whole value is that it fires on evidence. These tests pin the two
 * ways it could fire on something else: an `off` cell being reported, and a
 * cell being called empty when the tool merely cannot see it.
 */

import AdrMatrixDeclaration from "../matrix/AdrMatrixDeclaration";
import MatrixCell from "../matrix/MatrixCell";
import MatrixReport from "../matrix/MatrixReport";
import IMatrixDeclaration from "../types/IMatrixDeclaration";
import IMatrixOccupancy from "../types/IMatrixOccupancy";

const declare = (
  adr: string,
  rows: [string, string, string][],
): IMatrixDeclaration => ({
  adr,
  severities: new Map(
    rows.map(([context, relationship, severity]) => [
      MatrixCell.key(context as never, relationship as never),
      severity as never,
    ]),
  ),
  errors: [],
});

const occupy = (adr: string, cells: [string, string][]): IMatrixOccupancy => ({
  adr,
  cells: new Map(
    cells.map(([context, relationship]) => [
      MatrixCell.key(context as never, relationship as never),
      ["some/fixture.test.cnx"],
    ]),
  ),
  fixturesWithoutContext: [],
});

describe("MatrixReport.violations", () => {
  it("reports a declared error cell that no fixture occupies", () => {
    const declarations = new Map([
      [
        "051",
        declare("051", [["top-level-function", "imported-direct", "error"]]),
      ],
    ]);
    const found = MatrixReport.violations(declarations, new Map());
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({
      adr: "051",
      context: "top-level-function",
      relationship: "imported-direct",
      severity: "error",
    });
  });

  it("reports nothing when the declared cell is occupied", () => {
    const declarations = new Map([
      ["051", declare("051", [["top-level-function", "same-file", "error"]])],
    ]);
    const occupancy = new Map([
      ["051", occupy("051", [["top-level-function", "same-file"]])],
    ]);
    expect(MatrixReport.violations(declarations, occupancy)).toEqual([]);
  });

  it("never reports an off cell, however empty", () => {
    const declarations = new Map([
      ["051", declare("051", [["scope-member", "imported-transitive", "off"]])],
    ]);
    expect(MatrixReport.violations(declarations, new Map())).toEqual([]);
  });

  it("reports an undeclared cell as nothing, since undeclared means off", () => {
    const declarations = new Map([["051", declare("051", [])]]);
    expect(MatrixReport.violations(declarations, new Map())).toEqual([]);
  });

  it("does not report a cell whose relationship cannot be derived yet", () => {
    // Provider-side relationships need the emitting file, which
    // `.expected.error` does not carry. Reporting these as gaps would fire the
    // gate on the tool's blindness rather than on missing coverage.
    const declarations = new Map([
      [
        "051",
        declare("051", [
          ["top-level-function", "exercised-from-one-away", "error"],
        ]),
      ],
    ]);
    expect(MatrixReport.violations(declarations, new Map())).toEqual([]);
  });

  it("surfaces those cells separately so they are not silently dropped", () => {
    const declarations = new Map([
      [
        "051",
        declare("051", [
          ["top-level-function", "exercised-from-one-away", "error"],
        ]),
      ],
    ]);
    const pending = MatrixReport.undeterminable(declarations);
    expect(pending).toHaveLength(1);
    expect(pending[0].relationship).toBe("exercised-from-one-away");
  });

  it("orders errors before warnings", () => {
    const declarations = new Map([
      [
        "051",
        declare("051", [
          ["top-level-function", "same-file", "warn"],
          ["scope-method", "same-file", "error"],
        ]),
      ],
    ]);
    const found = MatrixReport.violations(declarations, new Map());
    expect(found.map((violation) => violation.severity)).toEqual([
      "error",
      "warn",
    ]);
  });
});

describe("AdrMatrixDeclaration.severityOf", () => {
  it("defaults an undeclared cell to off so the tool blocks nothing on arrival", () => {
    const declaration = declare("999", []);
    for (const { context, relationship } of MatrixCell.all()) {
      expect(
        AdrMatrixDeclaration.severityOf(declaration, context, relationship),
      ).toBe("off");
    }
  });
});
