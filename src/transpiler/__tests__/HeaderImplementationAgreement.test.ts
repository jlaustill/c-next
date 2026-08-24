/**
 * Issue #1164 follow-through: the generated `.h` must agree with the generated
 * `.c`.
 *
 * While the `.c` did not include its own header, every disagreement between the
 * two was invisible — no compiler ever saw both. Making the `.c` self-include
 * turned that class of defect into compile errors, and these are the cases it
 * exposed. Each one is a declaration in the header that contradicts the
 * definition in the implementation.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Transpiler from "../Transpiler";
import ITranspilerConfig from "../types/ITranspilerConfig";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("Header/implementation agreement (#1164)", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "cnext-agree-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  async function transpileSource(
    source: string,
  ): Promise<{ code: string; headerCode: string }> {
    const sourcePath = join(tempDir, "sample.cnx");
    writeFileSync(sourcePath, source);
    const config: ITranspilerConfig = {
      input: sourcePath,
      includeDirs: [tempDir],
      outDir: tempDir,
      headerOutDir: tempDir,
    };
    const result = await new Transpiler(config).transpile({
      kind: "source",
      source,
      workingDir: tempDir,
      sourcePath,
    });
    expect(result.success).toBe(true);
    return {
      code: result.files[0].code,
      headerCode: result.files[0].headerCode ?? "",
    };
  }

  it("carries volatile onto the header declaration", async () => {
    const { code, headerCode } = await transpileSource(`
volatile u32 statusFlag <- 0;
u32 readFlag() { return statusFlag; }
`);
    // The .c defines it volatile; a declaration that drops the qualifier is a
    // "conflicting type qualifiers" error once the .c includes the header.
    expect(code).toContain("volatile uint32_t statusFlag");
    expect(headerCode).toContain("volatile");
  });

  it("declares a string constant with its C type, not the C-Next type", async () => {
    const { code, headerCode } = await transpileSource(`
const string VERSION <- "1.0.0";
u8 firstChar() { return VERSION[0]; }
`);
    expect(code).toContain("char VERSION");
    // ADR-045 infers the capacity from the literal. The .c resolves it to
    // char[6]; the header must resolve it the same way — `string` is not a C
    // type, so a header that emits it does not compile.
    expect(headerCode).not.toContain("string VERSION");
    expect(headerCode).toContain("char VERSION");
  });

  it("declares the ISR typedef it uses (ADR-040)", async () => {
    const { headerCode } = await transpileSource(`
ISR globalHandler;
void install(ISR handler) { globalHandler <- handler; }
`);
    // The header references ISR in a declaration, so it must define the type.
    expect(headerCode).toContain("typedef void (*ISR)(void);");
  });
});
