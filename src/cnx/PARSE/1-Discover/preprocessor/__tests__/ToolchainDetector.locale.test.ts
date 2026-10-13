/**
 * #1827 review: `getDefaultIncludePaths` finds the include list by gcc's
 * English banners, and gcc translates them once its message catalogs are
 * installed. CI's gcc has none, so a fake compiler answers the way gcc does:
 * in German unless `LC_ALL=C`.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import ToolchainDetector from "../ToolchainDetector";

// gcc 13's German banners, verbatim:
// cspell:ignore Suche beginnt hier Ende Suchliste
const LOCALIZED_CC = `#!/bin/sh
cat >/dev/null
if [ "$LC_ALL" = C ]; then
  printf '#include <...> search starts here:\\n /fake/include\\nEnd of search list.\\n' >&2
else
  printf 'Suche f\\303\\274r \\302\\273#include <...>\\302\\253 beginnt hier:\\n /fake/include\\nEnde der Suchliste.\\n' >&2
fi
`;

describe("getDefaultIncludePaths under a translated message locale", () => {
  let dir: string;
  let cc: string;
  const saved = { LANGUAGE: process.env.LANGUAGE, LC_ALL: process.env.LC_ALL };

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "cnx-locale-"));
    cc = join(dir, "gcc");
    writeFileSync(cc, LOCALIZED_CC);
    chmodSync(cc, 0o755);
    process.env.LANGUAGE = "de";
    delete process.env.LC_ALL;
  });

  afterEach(() => {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    rmSync(dir, { recursive: true, force: true });
  });

  it("reads the include list in English", () => {
    expect(
      ToolchainDetector.getDefaultIncludePaths({
        name: "gcc",
        cc,
        cxx: cc,
        cpp: cc,
        isCrossCompiler: false,
      }),
    ).toEqual(["/fake/include"]);
  });
});
