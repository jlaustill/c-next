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

import DiagnosticManifest from "../diagnostics/DiagnosticManifest";

describe("DiagnosticManifest.parseCodes", () => {
  it("extracts an E-code from a coded diagnostic", () => {
    expect(
      DiagnosticManifest.parseCodes(
        // Any coded diagnostic will do; this one is verbatim from
        // tests/static-allocation/calloc-error.expected.error so it stays a real
        // sample rather than drifting into a shape the corpus never produces.
        "6:4 error[E0902]: Importing dynamic memory function 'calloc' from C/C++ is forbidden\n",
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

  it("extracts a bare code after a codegen throw", () => {
    // `Code generation failed: E0504: ...` -- 3 fixtures, invisible to the
    // bracket-only pattern, so `code-removed` could never fire for them.
    expect(
      DiagnosticManifest.parseCodes(
        '1:0 Code generation failed: E0504: Found #include "helper.hpp"\n',
      ),
    ).toEqual(["E0504"]);
  });

  it("extracts a capitalized bracketed code after a codegen throw", () => {
    expect(
      DiagnosticManifest.parseCodes(
        "1:0 Code generation failed: Error[E0602]: sizeof() operand must not\n",
      ),
    ).toEqual(["E0602"]);
  });

  it("extracts a capitalized unbracketed code after a codegen throw", () => {
    // The largest missed group: E0701(10) E0702(9) E0707(6) E0705(1).
    expect(
      DiagnosticManifest.parseCodes(
        "1:0 Code generation failed: Error E0702: Function call in condition\n",
      ),
    ).toEqual(["E0702"]);
  });

  it("does not invent a code from a bare four-digit number", () => {
    // Control against over-matching: only E#### and MISRA-x.y are codes. A
    // message quoting a width, an address or a year must stay uncoded.
    expect(
      DiagnosticManifest.parseCodes(
        "1:0 Code generation failed: value 1234 exceeds 0xE0900 at line 8080\n",
      ),
    ).toEqual([]);
  });

  it("returns no codes for an uncoded codegen throw", () => {
    // 116 of 287 fixtures look like this today -- the throws #1313 relocates.
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

describe("DiagnosticManifest.checkOutcome", () => {
  const entry = { fixture: "tests/a.test.cnx", codes: ["E0422"] };
  const rendered = DiagnosticManifest.render([entry]);

  it("fails when the manifest has never been written", () => {
    const outcome = DiagnosticManifest.checkOutcome(null, [entry], rendered);
    expect(outcome.ok).toBe(false);
    expect(outcome.errors.join("\n")).toContain("npm run diagnostics:manifest");
  });

  it("offers regeneration before row deletion when a fixture is lost", () => {
    // A rename is the loss this gate most often sees, and it presents as
    // `assertion-removed`. Advising row deletion first turns a rename into a
    // real loss of coverage: the row is dropped while the fixture still asserts.
    const outcome = DiagnosticManifest.checkOutcome(rendered, [], rendered);
    const text = outcome.errors.join("\n");
    expect(outcome.ok).toBe(false);
    expect(text).toContain("tests/a.test.cnx");
    expect(text).toContain("renamed");
    expect(text.indexOf("npm run diagnostics:manifest")).toBeLessThan(
      text.indexOf("delete its row"),
    );
  });

  it("fails as stale when the committed document is behind", () => {
    const grown = [entry, { fixture: "tests/b.test.cnx", codes: ["E0900"] }];
    const outcome = DiagnosticManifest.checkOutcome(
      rendered,
      grown,
      DiagnosticManifest.render(grown),
    );
    expect(outcome.ok).toBe(false);
    expect(outcome.errors.join("\n")).toContain("stale");
  });

  it("passes and states what was enforced", () => {
    const outcome = DiagnosticManifest.checkOutcome(
      rendered,
      [entry],
      rendered,
    );
    expect(outcome.ok).toBe(true);
    expect(outcome.errors).toEqual([]);
    expect(outcome.info.join("\n")).toContain("1 fixture(s)");
  });
});

describe("DiagnosticManifest.writeOutcome", () => {
  const entry = { fixture: "tests/a.test.cnx", codes: ["E0422"] };
  const rendered = DiagnosticManifest.render([entry]);

  it("names what regenerating is about to erase", () => {
    // `write` is the command that performs the deletion and the check message
    // is what sends people to it. An identical "Wrote ..." line for a clean
    // regeneration and for one that drops an assertion is the same failure this
    // manifest exists to prevent, on the destructive command.
    const outcome = DiagnosticManifest.writeOutcome(rendered, []);
    expect(outcome.ok).toBe(true);
    expect(outcome.warnings.join("\n")).toContain("tests/a.test.cnx");
  });

  it("warns about nothing when regeneration loses nothing", () => {
    // Control: regenerating after adding a fixture must stay quiet, or the
    // warning becomes noise people learn to scroll past.
    const grown = [entry, { fixture: "tests/b.test.cnx", codes: ["E0900"] }];
    expect(DiagnosticManifest.writeOutcome(rendered, grown).warnings).toEqual(
      [],
    );
  });

  it("warns about nothing on a first-ever write", () => {
    expect(DiagnosticManifest.writeOutcome(null, [entry]).warnings).toEqual([]);
  });
});
