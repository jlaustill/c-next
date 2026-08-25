/**
 * Issue #1219: reads the severity table an ADR declares for its own matrix.
 *
 * The ADR owns its matrix because the ADR is what the failures are about:
 * #1179 is ADR-049 Q7 and #1173 is ADR-006, codegen bugs with no error code
 * that a diagnostic-keyed matrix could never see.
 *
 * Applicability lives here too. "No cell is exempt" cannot be literally true --
 * a division cannot appear in a file-scope initializer -- so `off` is the
 * recorded claim that a cell cannot exist, reviewed where design decisions are
 * already reviewed rather than assumed silently.
 */

import MatrixCell from "./MatrixCell";
import IMatrixDeclaration from "../types/IMatrixDeclaration";
import TMatrixContext from "../types/TMatrixContext";
import TMatrixRelationship from "../types/TMatrixRelationship";
import TMatrixSeverity from "../types/TMatrixSeverity";

/** Marks the hand-written severity table. Located by marker, not by heading. */
const SEVERITY_MARKER = "<!-- MATRIX-SEVERITY -->";

const SEVERITIES: readonly TMatrixSeverity[] = ["off", "warn", "error"];

/** Human spelling in the table ("top-level function") to the canonical slug. */
function slug(cell: string): string {
  return cell.trim().toLowerCase().replace(/\s+/g, "-");
}

function isContext(value: string): value is TMatrixContext {
  return (MatrixCell.CONTEXTS as readonly string[]).includes(value);
}

function isRelationship(value: string): value is TMatrixRelationship {
  return (MatrixCell.RELATIONSHIPS as readonly string[]).includes(value);
}

function isSeverity(value: string): value is TMatrixSeverity {
  return (SEVERITIES as readonly string[]).includes(value);
}

/** Split a markdown table row into trimmed cells. */
function splitRow(line: string): string[] {
  return line
    .replace(/^\s*\|/, "")
    .replace(/\|\s*$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function isSeparatorRow(line: string): boolean {
  return /^\s*\|[\s:|-]+\|\s*$/.test(line);
}

/**
 * Parse the severity table for one ADR.
 *
 * An unrecognized context, relationship or severity is an ERROR rather than a
 * skipped row. Silently ignoring a typo would turn the declared cell into `off`
 * -- the author would believe a cell was gated while nothing checked it, which
 * is the exact failure mode this tool exists to remove.
 */
function parse(markdown: string, adr: string): IMatrixDeclaration {
  const severities = new Map<string, TMatrixSeverity>();
  const errors: string[] = [];

  const markerIndex = markdown.indexOf(SEVERITY_MARKER);
  if (markerIndex === -1) {
    return { adr, severities, errors };
  }

  const lines = markdown.slice(markerIndex).split("\n");
  let started = false;

  for (const line of lines) {
    const isTableRow = /^\s*\|/.test(line);

    if (!isTableRow) {
      // Blank lines between the marker and the table are fine; anything else
      // after the table has begun ends it.
      if (started && line.trim() !== "") break;
      continue;
    }
    if (isSeparatorRow(line)) continue;

    const cells = splitRow(line);
    if (cells.length < 3) continue;

    const [rawContext, rawRelationship, rawSeverity] = cells;

    // Header row.
    if (slug(rawContext) === "context" && slug(rawSeverity) === "severity") {
      started = true;
      continue;
    }
    started = true;

    const context = slug(rawContext);
    const relationship = slug(rawRelationship);
    const severity = slug(rawSeverity);

    if (!isContext(context)) {
      errors.push(
        `ADR-${adr}: unknown context "${rawContext}" (expected one of ${MatrixCell.CONTEXTS.join(", ")})`,
      );
      continue;
    }
    if (!isRelationship(relationship)) {
      errors.push(
        `ADR-${adr}: unknown relationship "${rawRelationship}" (expected one of ${MatrixCell.RELATIONSHIPS.join(", ")})`,
      );
      continue;
    }
    if (!isSeverity(severity)) {
      errors.push(
        `ADR-${adr}: unknown severity "${rawSeverity}" (expected off, warn or error)`,
      );
      continue;
    }

    const key = MatrixCell.key(context, relationship);
    if (severities.has(key)) {
      errors.push(
        `ADR-${adr}: cell "${context} / ${relationship}" declared more than once`,
      );
      continue;
    }
    severities.set(key, severity);
  }

  return { adr, severities, errors };
}

/** Severity for a cell; undeclared cells are `off`. */
function severityOf(
  declaration: IMatrixDeclaration,
  context: TMatrixContext,
  relationship: TMatrixRelationship,
): TMatrixSeverity {
  return (
    declaration.severities.get(MatrixCell.key(context, relationship)) ?? "off"
  );
}

class AdrMatrixDeclaration {
  static readonly SEVERITY_MARKER = SEVERITY_MARKER;
  static parse = parse;
  static severityOf = severityOf;
}

export default AdrMatrixDeclaration;
