import { describe, expect, it } from "vitest";

import CNextSourceParser from "../../../transpiler/logic/parser/CNextSourceParser";
import IncludeDirectiveAnalyzer from "../IncludeDirectiveAnalyzer";

/**
 * #1322. ADR-010's include rules -- E0503 (an implementation file), E0504 (a
 * `.cnx` sits where the header does), E0506 (an included `.cnx` is not there)
 * -- replacing three codegen throws that all reported `1:0`, two of them with
 * the real line appended to the message as `Line N` and the third with no code
 * at all.
 *
 * The 23 cases these replace were handed a directive's TEXT and a line NUMBER,
 * which is precisely why the position defect was invisible to them: there was
 * no position to get wrong. These parse a directive and assert where it is.
 *
 * `fileExists` is injected rather than reached for, so a test says which files
 * exist instead of arranging them on disk -- the same abstraction the run uses.
 */
const analyze = (
  source: string,
  present: readonly string[] = [],
  searchPaths: readonly string[] = [],
) =>
  new IncludeDirectiveAnalyzer().analyze(CNextSourceParser.parse(source).tree, {
    sourcePath: "/project/src/main.cnx",
    searchPaths,
    fileExists: (path) => present.includes(path),
  });

describe("IncludeDirectiveAnalyzer (E0503)", () => {
  it("rejects an implementation file at the directive, not 1:0", () => {
    const [found] = analyze(
      '#include <stdint.h>\n#include "helper.c"\n\nu8 main() {\n    return 0;\n}',
    );
    expect([found.code, found.line, found.column]).toEqual(["E0503", 2, 0]);
    expect(found.message).toBe(
      "Cannot #include implementation file 'helper.c'. Only header files (.h, .hpp) are allowed.",
    );
  });

  it("rejects every implementation extension, in either form", () => {
    const source = [
      '#include "a.c"',
      "#include <b.cpp>",
      '#include "c.CC"',
      "#include <d.cxx>",
      '#include "e.c++"',
      "",
      "u8 main() {",
      "    return 0;",
      "}",
    ].join("\n");
    expect(analyze(source).map((e) => e.code)).toEqual([
      "E0503",
      "E0503",
      "E0503",
      "E0503",
      "E0503",
    ]);
  });

  it("accepts headers and C-Next sources", () => {
    const source = [
      "#include <stdint.h>",
      '#include "sensors/imu.hpp"',
      '#include "helper.cnx"',
      "",
      "u8 main() {",
      "    return 0;",
      "}",
    ].join("\n");
    expect(analyze(source, ["/project/src/helper.cnx"])).toEqual([]);
  });
});

describe("IncludeDirectiveAnalyzer (E0506)", () => {
  it("rejects a quoted C-Next include that is not there", () => {
    const [found] = analyze(
      '#include "missing.cnx"\n\nu8 main() {\n    return 0;\n}',
    );
    expect([found.code, found.line]).toEqual(["E0506", 1]);
    expect(found.message).toBe("Included C-Next file not found: missing.cnx");
    // No absolute path in the help: it would differ on every checkout, and the
    // first fixture written for this rule embedded one in an `.expected.error`.
    expect(found.helpText).not.toMatch(/\//);
  });

  it("resolves relative to the including file, not the working directory", () => {
    expect(
      analyze('#include "../lib/utils.cnx"\n\nu8 main() {\n    return 0;\n}', [
        "/project/lib/utils.cnx",
      ]),
    ).toEqual([]);
  });

  it("accepts the .cnext spelling", () => {
    expect(
      analyze('#include "helper.cnext"\n\nu8 main() {\n    return 0;\n}', [
        "/project/src/helper.cnext",
      ]),
    ).toEqual([]);
  });

  it("stays silent on an angle C-Next include, whose search is discovery's", () => {
    expect(
      analyze("#include <missing.cnx>\n\nu8 main() {\n    return 0;\n}"),
    ).toEqual([]);
  });
});

describe("IncludeDirectiveAnalyzer (E0504)", () => {
  it("names the quoted C-Next twin beside the including file", () => {
    const [found] = analyze(
      '#include <stdint.h>\n#include "helper.h"\n\nu8 main() {\n    return 0;\n}',
      ["/project/src/helper.cnx"],
    );
    expect([found.code, found.line]).toEqual(["E0504", 2]);
    expect(found.message).toContain(
      "Found #include \"helper.h\" but 'helper.cnx' exists at the same location.",
    );
    expect(found.message).toContain('Use #include "helper.cnx" instead');
  });

  it("searches an angle include along the run's paths, in priority order", () => {
    const [found] = analyze(
      "#include <ext.h>\n\nu8 main() {\n    return 0;\n}",
      ["/project/vendor/ext.cnx"],
      ["/project/src", "/project/vendor"],
    );
    expect(found.code).toBe("E0504");
    expect(found.message).toContain("Use #include <ext.cnx> instead");
  });

  it("finds a twin reachable only through an --include directory", () => {
    // The hole this closes: codegen re-derived the search path from the source
    // file's own directory, so a twin that only `--include` made reachable was
    // invisible and the file transpiled at exit 0.
    expect(
      analyze(
        "#include <ext.h>\n\nu8 main() {\n    return 0;\n}",
        ["/elsewhere/inc/ext.cnx"],
        ["/elsewhere/inc"],
      ).map((e) => e.code),
    ).toEqual(["E0504"]);
  });

  it("stays silent when no twin exists, and on a .cnx include itself", () => {
    const source = [
      "#include <stdint.h>",
      '#include "helper.h"',
      '#include "other.cnx"',
      "",
      "u8 main() {",
      "    return 0;",
      "}",
    ].join("\n");
    expect(
      analyze(source, ["/project/src/other.cnx"], ["/project/src"]),
    ).toEqual([]);
  });

  it("reports the implementation-file rule first, and only it", () => {
    // `helper.c` is an implementation file AND has a `.cnx` beside it. One
    // diagnostic, naming the thing the author must fix first.
    expect(
      analyze('#include "helper.c"\n\nu8 main() {\n    return 0;\n}', [
        "/project/src/helper.cnx",
      ]).map((e) => e.code),
    ).toEqual(["E0503"]);
  });
});
