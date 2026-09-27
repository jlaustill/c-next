/**
 * Issue #1725: a quoted `#include` is spelled relative to the file that wrote
 * it. A generated header that needs a header its file reaches only THROUGH
 * another `.cnx` copied that other file's spelling unchanged -- relative to a
 * different directory -- so `src/main.h` said `"dev.h"` for `lib/dev.h`, and
 * gcc failed at exit 0.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import Transpiler from "../Transpiler";

const DEV_H = `#ifndef DEV_H
#define DEV_H
#include <stdint.h>
typedef struct { uint32_t id; } Dev;
#endif
`;

const B_CNX = `struct Pt {
    u32 x;
}
`;

const A_CNX = `#include "dev.h"
#include "b.cnx"

scope A {
    public u32 idOf(Dev d) {
        return d.id;
    }
    public u32 xOf(Pt p) {
        return p.x;
    }
}
`;

function mainIncluding(aSpelling: string): string {
  return `#include "${aSpelling}"

scope M {
    public u32 use(Dev d) {
        return A.idOf(d);
    }
    public u32 usePt(Pt p) {
        return A.xOf(p);
    }
}
`;
}

describe("a header reached through another file's include (#1725)", () => {
  let project: string;

  beforeEach(() => {
    project = mkdtempSync(join(tmpdir(), "cnext-1725-"));
  });

  afterEach(() => {
    rmSync(project, { recursive: true, force: true });
  });

  /** Both modes, each file's generated header, by file name. */
  async function headersOf(mainDir: string, libDir: string, aSpelling: string) {
    mkdirSync(join(project, mainDir), { recursive: true });
    mkdirSync(join(project, libDir), { recursive: true });
    writeFileSync(join(project, libDir, "dev.h"), DEV_H);
    writeFileSync(join(project, libDir, "b.cnx"), B_CNX);
    writeFileSync(join(project, libDir, "a.cnx"), A_CNX);
    const mainPath = join(project, mainDir, "main.cnx");
    const main = mainIncluding(aSpelling);
    writeFileSync(mainPath, main);

    const files = await new Transpiler({
      input: mainPath,
      outDir: join(project, mainDir),
      noCache: true,
    }).transpile({ kind: "files" });
    const source = await new Transpiler({ input: "", noCache: true }).transpile(
      { kind: "source", source: main, sourcePath: mainPath },
    );
    expect(files.errors).toEqual([]);
    expect(source.errors).toEqual([]);
    const headerOf = (result: typeof files, dir: string, name: string) =>
      result.files.find((f) => f.sourcePath === join(project, dir, name))
        ?.headerCode ?? "";
    return {
      files: headerOf(files, mainDir, "main.cnx"),
      source: headerOf(source, mainDir, "main.cnx"),
      a: headerOf(files, libDir, "a.cnx"),
    };
  }

  it("spells it from the file whose header is being written", async () => {
    const headers = await headersOf("src", "lib", "../lib/a.cnx");

    for (const main of [headers.files, headers.source]) {
      expect(main).toContain('#include "../lib/dev.h"');
      expect(main).toContain('#include "../lib/b.h"');
      expect(main).not.toContain('#include "dev.h"');
      expect(main).not.toContain('#include "b.h"');
    }
    // Control: the file that wrote the spelling keeps it, as its own.
    expect(headers.a).toContain('#include "dev.h"');
    expect(headers.a).toContain('#include "b.h"');
  });

  it("control: in one directory the spelling is the same from every file", async () => {
    const headers = await headersOf("flat", "flat", "a.cnx");

    for (const main of [headers.files, headers.source]) {
      expect(main).toContain('#include "dev.h"');
      expect(main).toContain('#include "b.h"');
    }
  });
});
