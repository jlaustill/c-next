/**
 * Integration test for Issue #1139 — struct parameters across a .cnx include.
 *
 * Drives the real Transpiler in files mode over a two-file fixture, because
 * both defects are invisible anywhere else:
 *
 *  - The integration fixtures under tests/ cannot see the header defect. The
 *    harness transpiles each helper .cnx standalone as well, and that pass
 *    rewrites the dependency's header correctly, repairing the artifact before
 *    anything compares it.
 *  - MockFileSystem cannot host the fixture at all: .cnx include resolution
 *    calls existsSync directly rather than the injected IFileSystem (#1137),
 *    so a virtual dependency is reported as "Included C-Next file not found".
 *
 * That leaves a real temp directory plus the real Transpiler, which is what
 * the CLI does and therefore what users actually hit.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Transpiler from "../Transpiler";

// readValue never writes its parameter, so ADR-006 auto-const applies to it.
// bump does write it, so it must stay non-const — together they prove the
// auto-const decision stays per-parameter rather than becoming a blanket
// qualifier.
const SENSORS_CNX = `struct Sample { u8 value; }

scope Sensors {
    public u8 readValue(Sample sample) {
        return sample.value;
    }

    public void bump(Sample sample) {
        sample.value <- sample.value + 1;
    }
}
`;

const CONSUMER_CNX = `#include "sensors.cnx"

u32 main() {
    Sample sample <- {value: 42};
    u8 v <- Sensors.readValue(sample);
    if (v != 42) return 1;
    Sensors.bump(sample);
    if (sample.value != 43) return 2;
    return 0;
}
`;

describe("cross-file struct parameter (integration, #1139)", () => {
  let dir: string;
  let header: string;
  let consumer: string;
  let definition: string;

  beforeAll(async () => {
    dir = mkdtempSync(join(tmpdir(), "cnext-1139-"));
    writeFileSync(join(dir, "sensors.cnx"), SENSORS_CNX);
    writeFileSync(join(dir, "consumer.cnx"), CONSUMER_CNX);

    const transpiler = new Transpiler({
      input: join(dir, "consumer.cnx"),
      outDir: join(dir, "out"),
      noCache: true,
    });
    const result = await transpiler.transpile({ kind: "files" });
    expect(result.success).toBe(true);

    header = readFileSync(join(dir, "out", "sensors.h"), "utf8");
    consumer = readFileSync(join(dir, "out", "consumer.c"), "utf8");
    definition = readFileSync(join(dir, "out", "sensors.c"), "utf8");
  });

  afterAll(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  // Defect 1: headers were generated twice — once per file with that file's
  // state warm, then again for every file after the last file was transpiled.
  // Only the second pass reached disk, so a dependency's header was built from
  // the consumer's unmodified-parameter data and lost its auto-const, leaving
  // the .h prototype and the .c definition in conflict.
  it("keeps auto-const on the dependency header, matching the definition", () => {
    expect(header).toContain(
      "uint8_t Sensors__readValue(const Sample* sample);",
    );
    expect(definition).toContain(
      "uint8_t Sensors__readValue(const Sample* sample)",
    );
  });

  it("leaves a modified struct parameter non-const", () => {
    expect(header).toContain("void Sensors__bump(Sample* sample);");
  });

  // Defect 2: scope functions are stored in the SymbolTable under their bare
  // name but were looked up by their mangled C name, so the cross-file lookup
  // found nothing and the call was generated with C/C++ pass-by-value
  // semantics — a struct passed by value into a pointer parameter.
  it("emits address-of at a cross-file call site", () => {
    expect(consumer).toMatch(/Sensors__readValue\(\s*&sample\s*\)/);
    expect(consumer).toMatch(/Sensors__bump\(\s*&sample\s*\)/);
  });
});
