/**
 * Issue #1219: renders the scope-context matrix.
 *
 * Deliberately carries no timestamp. `GRAMMAR-COVERAGE.md` emits one, which
 * churns the file on every run and makes a diff gate permanently red -- so
 * nobody could gate on it and it drifted for seven months (#1150).
 */

import AdrMatrixDeclaration from "./AdrMatrixDeclaration";
import MatrixCell from "./MatrixCell";
import MatrixReport from "./MatrixReport";
import IMatrixDeclaration from "../types/IMatrixDeclaration";
import IMatrixOccupancy from "../types/IMatrixOccupancy";

const BANNER = `<!-- GENERATED FILE - DO NOT EDIT.
     Source: the fixture corpus under tests/ plus each ADR's MATRIX-SEVERITY table.
     Regenerate: npm run coverage:matrix -->`;

/** Column headings, shortened so the grid stays readable. */
const COLUMN_LABELS: Record<string, string> = {
  "same-file": "same file",
  "imported-direct": "direct",
  "imported-transitive": "transitive",
  "exercised-from-one-away": "from 1 away",
  "exercised-through-chain": "thru chain",
};

const ROW_LABELS: Record<string, string> = {
  "global-variable": "global variable",
  "top-level-function": "top-level function",
  "scope-member": "scope member",
  "scope-method": "scope method",
};

/**
 * One cell's rendering.
 *
 * `n/a` and `-` are different claims and must not look alike: `-` means the
 * cell carries no obligation, `n/a` means the tool cannot yet see whether it is
 * occupied. Rendering both as blank is how an unmeasured cell starts reading as
 * a satisfied one.
 */
function renderCell(
  declaration: IMatrixDeclaration | undefined,
  occupancy: IMatrixOccupancy | undefined,
  context: string,
  relationship: string,
): string {
  const severity =
    declaration === undefined
      ? "off"
      : AdrMatrixDeclaration.severityOf(
          declaration,
          context as never,
          relationship as never,
        );
  const occupied = MatrixReport.isOccupied(occupancy, context, relationship);

  if (!MatrixCell.isDerivable(relationship)) return occupied ? "ok" : "n/a";
  if (occupied) return "ok";
  if (severity === "error") return "**MISSING**";
  if (severity === "warn") return "warn";
  return "-";
}

/** The 4x5 grid for one ADR. */
function renderGrid(
  declaration: IMatrixDeclaration | undefined,
  occupancy: IMatrixOccupancy | undefined,
): string {
  const header = `| Context | ${MatrixCell.RELATIONSHIPS.map((r) => COLUMN_LABELS[r]).join(" | ")} |`;
  const divider = `| --- | ${MatrixCell.RELATIONSHIPS.map(() => "---").join(" | ")} |`;
  const rows = MatrixCell.CONTEXTS.map((context) => {
    const cells = MatrixCell.RELATIONSHIPS.map((relationship) =>
      renderCell(declaration, occupancy, context, relationship),
    );
    return `| ${ROW_LABELS[context]} | ${cells.join(" | ")} |`;
  });
  return [header, divider, ...rows].join("\n");
}

/** The whole document. */
function renderDocument(
  declarations: ReadonlyMap<string, IMatrixDeclaration>,
  occupancy: ReadonlyMap<string, IMatrixOccupancy>,
): string {
  const adrs = [
    ...new Set([...declarations.keys(), ...occupancy.keys()]),
  ].sort();
  const parts: string[] = [
    BANNER,
    "",
    "# Scope-Context Test Matrix",
    "",
    "Which structural contexts and file relationships each ADR's fixtures actually",
    "exercise. Occupancy is derived from the fixture corpus; the obligation for each",
    "cell is declared by the ADR that owns it.",
    "",
    "| Legend | Meaning |",
    "| --- | --- |",
    "| `ok` | a fixture occupies this cell |",
    "| `**MISSING**` | the ADR declared `error` and nothing occupies it |",
    "| `warn` | the ADR declared `warn` and nothing occupies it |",
    "| `-` | no obligation declared (`off`) |",
    "| `n/a` | not derivable yet -- provider-side relationships need the emitting file (#1219) |",
    "",
  ];

  if (adrs.length === 0) {
    parts.push(
      "No ADR declares a matrix and no fixture carries a `// test-adr:` marker.",
    );
    parts.push("");
    return parts.join("\n");
  }

  for (const adr of adrs) {
    const declaration = declarations.get(adr);
    const adrOccupancy = occupancy.get(adr);
    parts.push(`## ADR-${adr}`, "");
    parts.push(renderGrid(declaration, adrOccupancy), "");

    const pending = adrOccupancy?.fixturesWithoutContext ?? [];
    if (pending.length > 0) {
      parts.push(
        `${pending.length} linked fixture${pending.length === 1 ? "" : "s"} with no derivable context:`,
        "",
      );
      for (const fixture of [...pending].sort()) parts.push(`- \`${fixture}\``);
      parts.push("");
    }
  }

  return parts.join("\n");
}

class MatrixRenderer {
  static readonly BANNER = BANNER;
  static renderCell = renderCell;
  static renderGrid = renderGrid;
  static renderDocument = renderDocument;
}

export default MatrixRenderer;
