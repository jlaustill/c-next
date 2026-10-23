/**
 * #1618: the position axis. E0869 at a declaration and silence at a return
 * in the same function both filled `top-level function | same file`, so the
 * declaration's fixture greened the cell while every return leaked.
 */

import CnxSourceParser from "../../src/cnx/PARSE/2-Parse/CnxSourceParser";
import AdrMatrixDeclaration from "../matrix/AdrMatrixDeclaration";
import FixturePosition from "../matrix/FixturePosition";
import MatrixCell from "../matrix/MatrixCell";
import MatrixReport from "../matrix/MatrixReport";

const LINES = [
  "struct P { u32 x; }",
  "void take(u32 v) {}",
  "u32 f(u64 wide, u32 c) {",
  "    u32 a <- wide;",
  "    mut u32 b <- 0;",
  "    b <- wide;",
  "    mut u32[2] arr <- [0, 0];",
  "    arr[0] <- wide;",
  "    mut P p <- { x: 0 };",
  "    p.x <- wide;",
  "    b +<- wide;",
  "    take(wide);",
  "    u32[2] l <- [wide, 0];",
  "    P q <- { x: wide };",
  "    u32 t <- (c = 1) ? 0 : wide;",
  "    u32 s <- (wide = 1) ? 0 : 1;",
  "    for (u32 i <- wide; i < 1; i +<- 1) {}",
  "    take((c = 1) ? wide : 0);",
  "    u32[1] m <- [take2({ x: wide })];",
  "    return wide;",
  "}",
];

const TREE = CnxSourceParser.parse(LINES.join("\n")).tree;

/** The position at `wide` on the first line starting with `text`. */
function positionAt(text: string): string | null {
  const index = LINES.findIndex((line) => line.trim().startsWith(text));
  const line = LINES[index];
  return FixturePosition.at(TREE, index + 1, line.indexOf("wide", 4));
}

describe("FixturePosition.at (#1618)", () => {
  it.each([
    ["u32 a <-", "declaration-initializer"],
    ["b <-", "assignment"],
    ["arr[0] <-", "array-element-assignment"],
    ["p.x <-", "struct-field-assignment"],
    ["b +<-", "compound-assignment"],
    ["take(wide)", "call-argument"],
    ["u32[2] l <-", "array-element-initializer"],
    ["P q <-", "struct-field-initializer"],
    ["u32 t <-", "ternary-branch"],
    ["for (", "declaration-initializer"],
    ["return", "return-statement"],
  ])("reads `%s` as %s", (text, position) => {
    expect(positionAt(text)).toBe(position);
  });

  it("does not read a ternary's condition as a branch", () => {
    expect(positionAt("u32 s <-")).toBe("declaration-initializer");
  });

  it("takes the innermost position", () => {
    expect(positionAt("take((c")).toBe("ternary-branch");
    expect(positionAt("u32[1] m <-")).toBe("struct-field-initializer");
  });

  it("finds no position on an assignment's target", () => {
    const index = LINES.indexOf("    b <- wide;");
    expect(FixturePosition.at(TREE, index + 1, 4)).toBeNull();
  });
});

const table = (rows: string[]): string =>
  [
    "<!-- MATRIX-POSITION code: E0869 -->",
    "",
    "| Position | Severity |",
    "| --- | --- |",
    ...rows,
    "",
    "Prose after the table.",
    "| not | read |",
  ].join("\n");

const EVERY_ROW = MatrixCell.POSITIONS.map(
  (position) => `| ${position.replaceAll("-", " ")} | error |`,
);

describe("AdrMatrixDeclaration.parsePositions (#1618)", () => {
  it("reads every row and stops at the table's end", () => {
    const parsed = AdrMatrixDeclaration.parsePositions(
      table(EVERY_ROW),
      "024 E0869",
      "E0869",
    );
    expect(parsed.errors).toEqual([]);
    expect(parsed.severities.size).toBe(10);
    expect(AdrMatrixDeclaration.positionCodesIn(table(EVERY_ROW))).toEqual([
      "E0869",
    ]);
  });

  it("rejects a missing, unknown or repeated row", () => {
    const parsed = AdrMatrixDeclaration.parsePositions(
      table([
        ...EVERY_ROW.slice(1),
        "| return statement | error |",
        "| cast | error |",
      ]),
      "024 E0869",
      "E0869",
    );
    expect(parsed.errors).toEqual([
      'ADR-024 E0869: position "return-statement" declared more than once',
      'ADR-024 E0869: unknown position "cast" (expected one of ' +
        `${MatrixCell.POSITIONS.join(", ")})`,
      'ADR-024 E0869: leaves position "declaration-initializer" undeclared',
    ]);
  });
});

describe("MatrixReport.positionViolations (#1618)", () => {
  const declarations = new Map([
    [
      "024 E0869",
      {
        adr: "024 E0869",
        severities: new Map([
          ["declaration-initializer", "error" as const],
          ["return-statement", "error" as const],
          ["ternary-branch", "off" as const],
        ]),
        errors: [],
      },
    ],
  ]);

  it("reports an `error` row no fixture reaches and an `off` row one does", () => {
    const occupancy = new Map([
      [
        "024 E0869",
        new Map([
          ["declaration-initializer", ["a.test.cnx"]],
          ["ternary-branch", ["b.test.cnx"]],
        ]),
      ],
    ]);
    expect(MatrixReport.positionViolations(declarations, occupancy)).toEqual([
      { id: "024 E0869", position: "return-statement", severity: "error" },
      { id: "024 E0869", position: "ternary-branch", severity: "off" },
    ]);
  });

  it("does not let another code's fixture reach the row", () => {
    const occupancy = new Map([
      [
        "024 E0868",
        new Map([
          ["declaration-initializer", ["a.test.cnx"]],
          ["return-statement", ["a.test.cnx"]],
        ]),
      ],
    ]);
    expect(
      MatrixReport.positionViolations(declarations, occupancy).map(
        (v) => v.position,
      ),
    ).toEqual(["declaration-initializer", "return-statement"]);
  });
});
