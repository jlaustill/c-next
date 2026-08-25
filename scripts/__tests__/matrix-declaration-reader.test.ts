/**
 * Issue #1219: which ADRs take part in the matrix.
 *
 * The dangerous case is the ADR that declares a matrix nobody can read. Dropping
 * it removes every obligation it carried while the gate still reports
 * "satisfied", and the staleness diff cannot catch it either -- the report is
 * rendered from occupancy, so it comes out byte-identical.
 */

import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import AdrDeclarationReader from "../matrix/AdrDeclarationReader";
import AdrMatrixDeclaration from "../matrix/AdrMatrixDeclaration";

let dir: string;

const writeAdr = (name: string, body: string): void => {
  writeFileSync(join(dir, name), body, "utf-8");
};

const wellFormed = [
  AdrMatrixDeclaration.SEVERITY_MARKER,
  "",
  "| Context | Relationship | Severity |",
  "| ------- | ------------ | -------- |",
  "| top-level function | same file | error |",
].join("\n");

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "cnx-matrix-reader-"));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("AdrDeclarationReader.read", () => {
  it("returns an empty map for a directory that does not exist", () => {
    expect(AdrDeclarationReader.read(join(dir, "nope")).size).toBe(0);
  });

  it("omits an ADR with no matrix marker", () => {
    writeAdr("adr-099-something.md", "# ADR-099\n\nNo matrix here.\n");
    expect(AdrDeclarationReader.read(dir).size).toBe(0);
  });

  it("reads a well-formed declaration", () => {
    writeAdr("adr-051-division-by-zero.md", wellFormed);
    const declarations = AdrDeclarationReader.read(dir);
    expect(declarations.get("051")!.severities.size).toBe(1);
    expect(declarations.get("051")!.errors).toEqual([]);
  });

  it("keeps an ADR whose marker is present but whose table is unreadable", () => {
    // Marker present is the statement of intent. Dropping this ADR would take
    // every obligation with it and leave the gate green.
    writeAdr(
      "adr-051-division-by-zero.md",
      [AdrMatrixDeclaration.SEVERITY_MARKER, "", "No table at all.", ""].join(
        "\n",
      ),
    );
    const declarations = AdrDeclarationReader.read(dir);
    expect(declarations.has("051")).toBe(true);
    expect(declarations.get("051")!.errors.join("\n")).toContain(
      "marker present but no cell could be read",
    );
  });

  it("keeps an ADR whose every row is malformed", () => {
    writeAdr(
      "adr-051-division-by-zero.md",
      [
        AdrMatrixDeclaration.SEVERITY_MARKER,
        "",
        "| Context | Severity |",
        "| ------- | -------- |",
        "| top-level function | error |",
      ].join("\n"),
    );
    const declarations = AdrDeclarationReader.read(dir);
    expect(declarations.has("051")).toBe(true);
    expect(declarations.get("051")!.errors.length).toBeGreaterThan(0);
  });

  it("ignores files that are not adr-NNN-*.md", () => {
    writeAdr("README.md", wellFormed);
    writeAdr("adr-template.md", wellFormed);
    expect(AdrDeclarationReader.read(dir).size).toBe(0);
  });
});
