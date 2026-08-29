/**
 * Tests for the diagnostic manifest (issue #1316).
 *
 * The manifest is the committed record that a fixture asserts a diagnostic. Its
 * whole purpose is to fail when that record shrinks, so these tests are written
 * against shrinkage specifically -- a manifest that only ever grows is the green
 * suite the issue describes.
 */

import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import DiagnosticManifest from "./diagnostics/DiagnosticManifest";

describe("DiagnosticManifest.parseCodes", () => {
  it("extracts an E-code from a coded diagnostic", () => {
    expect(
      DiagnosticManifest.parseCodes(
        "6:4 error[E0902]: Dynamic allocation function 'calloc' is forbidden\n",
      ),
    ).toEqual(["E0902"]);
  });

  it("extracts a MISRA rule code", () => {
    expect(
      DiagnosticManifest.parseCodes(
        "5:20 error[MISRA-3.1]: Nested comment marker found inside comment\n",
      ),
    ).toEqual(["MISRA-3.1"]);
  });

  it("returns no codes for an uncoded codegen throw", () => {
    // 155 of 287 fixtures look like this today -- the throws #1313 relocates.
    expect(
      DiagnosticManifest.parseCodes(
        "1:0 Code generation failed: cannot assign to const variable 'COUNTER'\n",
      ),
    ).toEqual([]);
  });

  it("deduplicates and sorts multiple codes", () => {
    expect(
      DiagnosticManifest.parseCodes(
        "9:1 error[E0805]: second\n2:0 error[E0424]: first\n7:3 error[E0805]: repeat\n",
      ),
    ).toEqual(["E0424", "E0805"]);
  });
});

describe("DiagnosticManifest.diff", () => {
  it("reports a fixture whose .expected.error disappeared", () => {
    const failures = DiagnosticManifest.diff(
      [{ fixture: "tests/a.test.cnx", codes: ["E0422"] }],
      [],
    );
    expect(failures).toHaveLength(1);
    expect(failures[0].fixture).toBe("tests/a.test.cnx");
    expect(failures[0].reason).toBe("assertion-removed");
  });

  it("reports a fixture that stopped asserting a code", () => {
    const failures = DiagnosticManifest.diff(
      [{ fixture: "tests/a.test.cnx", codes: ["E0422", "E0424"] }],
      [{ fixture: "tests/a.test.cnx", codes: ["E0422"] }],
    );
    expect(failures).toHaveLength(1);
    expect(failures[0].reason).toBe("code-removed");
    expect(failures[0].detail).toContain("E0424");
  });

  it("reports a coded fixture that regressed to uncoded", () => {
    // The #1313 failure shape: a coded diagnostic downgraded to a generic
    // codegen throw. The fixture still errors, so the suite stays green.
    const failures = DiagnosticManifest.diff(
      [{ fixture: "tests/a.test.cnx", codes: ["E0381"] }],
      [{ fixture: "tests/a.test.cnx", codes: [] }],
    );
    expect(failures).toHaveLength(1);
    expect(failures[0].reason).toBe("code-removed");
  });

  it("accepts a fixture that gained a code", () => {
    // Control: the gate guards against loss, not against change. A migration
    // that ADDS codes must not be blocked by its own guard.
    expect(
      DiagnosticManifest.diff(
        [{ fixture: "tests/a.test.cnx", codes: [] }],
        [{ fixture: "tests/a.test.cnx", codes: ["E0381"] }],
      ),
    ).toEqual([]);
  });

  it("accepts a brand new fixture", () => {
    // Control: adding an error fixture is the behavior we want to encourage.
    expect(
      DiagnosticManifest.diff(
        [],
        [{ fixture: "tests/new.test.cnx", codes: ["E0900"] }],
      ),
    ).toEqual([]);
  });

  it("accepts an unchanged manifest", () => {
    const entries = [{ fixture: "tests/a.test.cnx", codes: ["E0422"] }];
    expect(DiagnosticManifest.diff(entries, entries)).toEqual([]);
  });
});

describe("DiagnosticManifest.collect", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "cnx-manifest-"));
    mkdirSync(join(tempDir, "tests", "nested"), { recursive: true });
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("finds error fixtures at any depth, with their codes", () => {
    writeFileSync(
      join(tempDir, "tests", "top.expected.error"),
      "3:1 error[E0422]: called before definition\n",
    );
    writeFileSync(
      join(tempDir, "tests", "nested", "deep.expected.error"),
      "1:0 Code generation failed: no code here\n",
    );

    expect(DiagnosticManifest.collect(tempDir)).toEqual([
      { fixture: "tests/nested/deep.test.cnx", codes: [] },
      { fixture: "tests/top.test.cnx", codes: ["E0422"] },
    ]);
  });

  it("ignores files that are not .expected.error", () => {
    writeFileSync(join(tempDir, "tests", "snap.expected.c"), "int x;\n");
    expect(DiagnosticManifest.collect(tempDir)).toEqual([]);
  });
});

describe("DiagnosticManifest render/parse roundtrip", () => {
  it("reads back exactly what it rendered", () => {
    // The gate compares a parsed committed manifest against a fresh collect, so
    // a lossy roundtrip would report phantom shrinkage on every run.
    const entries = [
      { fixture: "tests/a.test.cnx", codes: ["E0422", "MISRA-3.1"] },
      { fixture: "tests/b.test.cnx", codes: [] },
    ];
    expect(
      DiagnosticManifest.parse(DiagnosticManifest.render(entries)),
    ).toEqual(entries);
  });

  it("renders no timestamp", () => {
    // A timestamp churns every run and makes the staleness diff useless (#1150).
    const rendered = DiagnosticManifest.render([
      { fixture: "tests/a.test.cnx", codes: ["E0422"] },
    ]);
    expect(rendered).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });
});
