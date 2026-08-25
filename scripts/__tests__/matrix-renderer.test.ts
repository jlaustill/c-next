/**
 * Issue #1219: how one cell's state is rendered.
 *
 * The committed report is diffed by `coverage:matrix:check`, which does protect
 * the renderer -- but only for the branches the report currently exercises.
 * `docs/scope-context-matrix.md` today contains no `-` cell and no `**MISSING**`
 * cell, so those two branches can be rewritten without any committed file
 * changing and without any test failing. Both were verified to survive a
 * deliberate mutation before these tests existed.
 *
 * They are the two that matter most: `**MISSING**` is how a cell that is FAILING
 * its declared obligation appears, and the `-` / `n/a` split is the distinction
 * the renderer's own header calls out -- collapsing them is how an unmeasured
 * cell starts reading as a satisfied one.
 */

import MatrixCell from "../matrix/MatrixCell";
import MatrixRenderer from "../matrix/MatrixRenderer";
import MatrixTestHelpers from "./matrixTestHelpers";

const EMPTY = undefined;

describe("MatrixRenderer.renderCell", () => {
  it("renders an occupied cell as ok", () => {
    expect(
      MatrixRenderer.renderCell(
        MatrixTestHelpers.declare("051", [
          ["scope-method", "same-file", "error"],
        ]),
        MatrixTestHelpers.occupy("051", [["scope-method", "same-file"]]),
        "scope-method",
        "same-file",
      ),
    ).toBe("ok");
  });

  it("renders a declared error cell that nothing occupies as **MISSING**", () => {
    // The gate fails on this cell; the report must say so rather than showing
    // it as satisfied.
    expect(
      MatrixRenderer.renderCell(
        MatrixTestHelpers.declare("051", [
          ["top-level-function", "imported-direct", "error"],
        ]),
        EMPTY,
        "top-level-function",
        "imported-direct",
      ),
    ).toBe("**MISSING**");
  });

  it("renders a declared warn cell that nothing occupies as warn", () => {
    expect(
      MatrixRenderer.renderCell(
        MatrixTestHelpers.declare("051", [
          ["scope-member", "same-file", "warn"],
        ]),
        EMPTY,
        "scope-member",
        "same-file",
      ),
    ).toBe("warn");
  });

  it("renders a cell carrying no obligation as '-'", () => {
    expect(
      MatrixRenderer.renderCell(
        MatrixTestHelpers.declare("051", []),
        EMPTY,
        "global-variable",
        "same-file",
      ),
    ).toBe("-");
  });

  it("renders an unoccupied cell the tool cannot yet see as 'n/a'", () => {
    expect(
      MatrixRenderer.renderCell(
        MatrixTestHelpers.declare("051", []),
        EMPTY,
        "global-variable",
        "exercised-from-one-away",
      ),
    ).toBe("n/a");
  });

  it("keeps 'no obligation' and 'not derivable' distinct", () => {
    // Collapsing these is the failure the renderer's header names: `-` is a
    // reviewed claim that the cell carries no obligation, `n/a` is the tool
    // admitting it cannot tell. They must never render alike.
    const noObligation = MatrixRenderer.renderCell(
      MatrixTestHelpers.declare("051", []),
      EMPTY,
      "global-variable",
      "same-file",
    );
    const notDerivable = MatrixRenderer.renderCell(
      MatrixTestHelpers.declare("051", []),
      EMPTY,
      "global-variable",
      "exercised-from-one-away",
    );
    expect(noObligation).not.toBe(notDerivable);
  });

  it("reports a non-derivable cell as n/a even when the ADR declared it error", () => {
    // Otherwise the gate would fire on the tool's blindness rather than on
    // missing coverage.
    expect(
      MatrixRenderer.renderCell(
        MatrixTestHelpers.declare("051", [
          ["scope-method", "exercised-through-chain", "error"],
        ]),
        EMPTY,
        "scope-method",
        "exercised-through-chain",
      ),
    ).toBe("n/a");
  });

  // NOTE: this state is unreachable through the real pipeline. FixtureOccupancy
  // only writes keys built from MatrixCell.relationshipForDepth, which returns
  // one of the three derivable relationships, so no provider-side cell can
  // carry an occupant until #1241 lands. Unlike every other case in this file
  // it therefore cannot fail for a reason the corpus could produce -- it pins
  // the behavior for when #1241 arrives, not behavior anything exercises now.
  it("renders an occupied non-derivable cell as ok", () => {
    expect(
      MatrixRenderer.renderCell(
        MatrixTestHelpers.declare("051", []),
        MatrixTestHelpers.occupy("051", [
          ["scope-member", "exercised-from-one-away"],
        ]),
        "scope-member",
        "exercised-from-one-away",
      ),
    ).toBe("ok");
  });
});

describe("MatrixRenderer.renderGrid", () => {
  it("emits a header, a divider and one row per context", () => {
    const grid = MatrixRenderer.renderGrid(
      MatrixTestHelpers.declare("051", []),
      EMPTY,
    );
    const lines = grid.split("\n");
    expect(lines).toHaveLength(MatrixCell.CONTEXTS.length + 2);
    expect(lines[1]).toMatch(/^\| --- \|/);
  });

  it("gives every declared relationship a column", () => {
    const header = MatrixRenderer.renderGrid(
      MatrixTestHelpers.declare("051", []),
      EMPTY,
    ).split("\n")[0];
    expect(header.split("|").filter((c) => c.trim() !== "")).toHaveLength(
      MatrixCell.RELATIONSHIPS.length + 1,
    );
  });
});

describe("MatrixRenderer.renderDocument", () => {
  it("carries the generated-file banner", () => {
    expect(MatrixRenderer.renderDocument(new Map(), new Map())).toContain(
      MatrixRenderer.BANNER,
    );
  });

  it("emits no timestamp, so a diff gate can be trusted", () => {
    // GRAMMAR-COVERAGE.md emitted one, churned on every run, and drifted for
    // seven months because nobody could gate on it (#1150).
    const document = MatrixRenderer.renderDocument(
      new Map([["051", MatrixTestHelpers.declare("051", [])]]),
      new Map(),
    );
    expect(document).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    expect(document).toBe(
      MatrixRenderer.renderDocument(
        new Map([["051", MatrixTestHelpers.declare("051", [])]]),
        new Map(),
      ),
    );
  });

  it("says so plainly when no ADR declares a matrix", () => {
    expect(MatrixRenderer.renderDocument(new Map(), new Map())).toContain(
      "No ADR declares a matrix",
    );
  });

  it("orders ADR sections by number", () => {
    const document = MatrixRenderer.renderDocument(
      new Map([
        ["065", MatrixTestHelpers.declare("065", [])],
        ["006", MatrixTestHelpers.declare("006", [])],
      ]),
      new Map(),
    );
    expect(document.indexOf("## ADR-006")).toBeLessThan(
      document.indexOf("## ADR-065"),
    );
  });

  it("lists fixtures whose context could not be derived instead of folding them into a cell", () => {
    const document = MatrixRenderer.renderDocument(
      new Map([["051", MatrixTestHelpers.declare("051", [])]]),
      new Map([
        [
          "051",
          {
            adr: "051",
            cells: new Map(),
            fixturesWithoutContext: ["b/second.test.cnx", "a/first.test.cnx"],
          },
        ],
      ]),
    );
    expect(document).toContain("2 linked fixtures with no derivable context");
    // Sorted, so the report does not churn on directory-walk order.
    expect(document.indexOf("a/first.test.cnx")).toBeLessThan(
      document.indexOf("b/second.test.cnx"),
    );
  });

  it("uses the singular for a lone fixture with no derivable context", () => {
    const document = MatrixRenderer.renderDocument(
      new Map([["051", MatrixTestHelpers.declare("051", [])]]),
      new Map([
        [
          "051",
          {
            adr: "051",
            cells: new Map(),
            fixturesWithoutContext: ["only/one.test.cnx"],
          },
        ],
      ]),
    );
    expect(document).toContain("1 linked fixture with no derivable context");
  });
});
