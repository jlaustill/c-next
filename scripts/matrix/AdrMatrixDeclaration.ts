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

import DiagnosticManifest from "../diagnostics/DiagnosticManifest";
import MatrixCell from "./MatrixCell";
import IMatrixDeclaration from "../types/IMatrixDeclaration";
import IMatrixTable from "../types/IMatrixTable";
import TMatrixContext from "../types/TMatrixContext";
import TMatrixRelationship from "../types/TMatrixRelationship";
import TMatrixSeverity from "../types/TMatrixSeverity";

/** Marks the hand-written severity table. Located by marker, not by heading. */
const SEVERITY_MARKER = "<!-- MATRIX-SEVERITY -->";

/**
 * #1731 review: marks the table of one of the ADR's rules, which only that
 * rule's provenance occupies (see MatrixRule).
 */
const RULE_MARKER =
  /<!-- MATRIX-SEVERITY (?:rule: ([a-z0-9-]+)|code: (\S+)) -->/g;

/**
 * #1618: marks a code's position table, occupied by the part of its statement
 * each diagnostic with that code reports.
 */
const POSITION_MARKER = /<!-- MATRIX-POSITION code: (\S+) -->/g;

/** Any severity marker: the ADR's own, a rule's or a code's. */
const ANY_MARKER = "<!-- MATRIX-SEVERITY";

function tableMarker(table: IMatrixTable): string {
  return `<!-- MATRIX-SEVERITY ${table.kind}: ${table.name} -->`;
}

/**
 * The rule and code tables, in the order the ADR declares them. The kind is
 * the marker's (`rule:` or `code:`), never re-derived from the name.
 */
function tablesIn(markdown: string): IMatrixTable[] {
  return [...markdown.matchAll(RULE_MARKER)].map((match) =>
    match[1] === undefined
      ? { kind: "code", name: match[2] }
      : { kind: "rule", name: match[1] },
  );
}

/**
 * #1620: the diagnostic codes an ADR declares -- the first cells of its
 * `| Code | ... |` table. A code `retired` lists needs no table.
 */
function codesIn(
  markdown: string,
  retired: ReadonlySet<string> = new Set(),
): string[] {
  const codes = new Set<string>();
  let header: string | null = null;
  for (const line of markdown.split("\n")) {
    if (!/^\s*\|/.test(line)) {
      header = null;
      continue;
    }
    if (isSeparatorRow(line)) continue;
    const [first] = splitRow(line);
    if (header === null) {
      header = slug(first);
      continue;
    }
    if (header !== "code" || !DiagnosticManifest.isCode(first)) continue;
    if (!retired.has(first)) codes.add(first);
  }
  return [...codes];
}

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
 * The rows of the first table after `marker`, with their source line. Every
 * table kind's parser reads its rows here, so where a table starts and ends is
 * decided once (#1618 review).
 *
 * Anything at all may sit between the marker and the table -- prose,
 * headings, a list. The table starts at its header (first cell `header`) or
 * at the first row at least `width` cells wide, so a narrower stray table
 * before it is not mistaken for it. Once it has begun, any non-table line ends
 * it. The header is recognized by its FIRST cell only: a header whose second
 * column was deleted still marks where the table starts, so its short rows are
 * reported rather than skipped while the walk runs on into the next table.
 */
function tableRows(
  markdown: string,
  marker: string,
  header: string,
  width: number,
): { line: string; cells: string[] }[] {
  const markerIndex = markdown.indexOf(marker);
  if (markerIndex === -1) return [];
  const rows: { line: string; cells: string[] }[] = [];
  let started = false;
  for (const line of markdown.slice(markerIndex + marker.length).split("\n")) {
    if (!/^\s*\|/.test(line)) {
      if (started && line.trim() !== "") break;
      continue;
    }
    if (isSeparatorRow(line)) continue;
    const cells = splitRow(line);
    if (!started && slug(cells[0]) !== header && cells.length < width) {
      continue;
    }
    started = true;
    rows.push({ line, cells });
  }
  return rows;
}

/**
 * Parse the severity table for one ADR, or for one of its rule or code tables.
 *
 * An unrecognized context, relationship or severity is an ERROR rather than a
 * skipped row. Silently ignoring a typo would turn the declared cell into `off`
 * -- the author would believe a cell was gated while nothing checked it, which
 * is the exact failure mode this tool exists to remove.
 */
function parse(
  markdown: string,
  adr: string,
  table?: IMatrixTable,
): IMatrixDeclaration {
  const severities = new Map<string, TMatrixSeverity>();
  const errors: string[] = [];
  const marker = table === undefined ? SEVERITY_MARKER : tableMarker(table);

  for (const { line, cells } of tableRows(markdown, marker, "context", 3)) {
    if (cells.length < 3) {
      errors.push(
        `ADR-${adr}: malformed row "${line.trim()}" (expected context | relationship | severity)`,
      );
      continue;
    }
    if (slug(cells[0]) === "context") continue;

    const [rawContext, rawRelationship, rawSeverity] = cells;

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

/** The codes an ADR declares a position table for, in order. */
function positionCodesIn(markdown: string): string[] {
  return [...markdown.matchAll(POSITION_MARKER)].map((match) => match[1]);
}

/**
 * #1618: parse one code's `| Position | Severity |` table. Like a code table,
 * it declares every position: a row left out is an error, not `off`.
 */
function parsePositions(
  markdown: string,
  id: string,
  code: string,
): IMatrixDeclaration {
  const severities = new Map<string, TMatrixSeverity>();
  const errors: string[] = [];
  const marker = `<!-- MATRIX-POSITION code: ${code} -->`;

  for (const { line, cells } of tableRows(markdown, marker, "position", 2)) {
    if (cells.length < 2) {
      errors.push(
        `ADR-${id}: malformed row "${line.trim()}" (expected position | severity)`,
      );
      continue;
    }
    const [rawPosition, rawSeverity] = cells;
    const position = slug(rawPosition);
    if (position === "position") continue;
    const severity = slug(rawSeverity);
    if (!MatrixCell.isPosition(position)) {
      errors.push(
        `ADR-${id}: unknown position "${rawPosition}" (expected one of ${MatrixCell.POSITIONS.join(", ")})`,
      );
      continue;
    }
    if (!isSeverity(severity)) {
      errors.push(
        `ADR-${id}: unknown severity "${rawSeverity}" (expected off, warn or error)`,
      );
      continue;
    }
    if (severities.has(position)) {
      errors.push(`ADR-${id}: position "${position}" declared more than once`);
      continue;
    }
    severities.set(position, severity);
  }

  for (const position of MatrixCell.POSITIONS) {
    if (!severities.has(position)) {
      errors.push(`ADR-${id}: leaves position "${position}" undeclared`);
    }
  }
  return { adr: id, severities, errors };
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
  static readonly ANY_MARKER = ANY_MARKER;
  static tablesIn = tablesIn;
  static codesIn = codesIn;
  static parse = parse;
  static positionCodesIn = positionCodesIn;
  static parsePositions = parsePositions;
  static severityOf = severityOf;
}

export default AdrMatrixDeclaration;
