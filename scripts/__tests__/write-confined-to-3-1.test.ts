/**
 * #1653, carrying #1451 box 1: 3.1 Write is the only place output reaches the
 * filesystem.
 *
 * `node:fs` is confined to the port by depcruise, but the port's own mutating
 * methods are reachable from any module holding an `IFileSystem`, and no import
 * rule can see a method call. This holds the rest: outside `src/WRITE/1-Write/`
 * and the port itself, nothing calls `writeFile`, `mkdir`, `unlink` or
 * `rename`. Reads stay free, since reading changes nothing.
 */
import { describe, expect, it } from "vitest";

import SourceScan from "../utils/SourceScan";

const METHODS = ["writeFile", "mkdir", "unlink", "rename"] as const;
const MUTATING = new RegExp(String.raw`\.(${METHODS.join("|")})\(`, "g");
const WRITE_PASS = "src/WRITE/1-Write/";
const PORT = "src/transpiler/NodeFileSystem.ts";

describe("3.1 Write owns every change to the filesystem", () => {
  const hits = SourceScan.scan(MUTATING);

  it("no module outside 3.1 and the port calls a mutating port method", () => {
    const outside = hits
      .filter((hit) => !hit.file.startsWith(WRITE_PASS) && hit.file !== PORT)
      .map((hit) => `${hit.file}: ${hit.text}`);
    expect(outside).toEqual([]);
  });

  // One control per arm: if the pattern stopped matching a method, 3.1 would
  // read as calling nothing and the assertion above would pass vacuously.
  it.each(METHODS)("3.1 does call %s, so the pattern can see it", (method) => {
    expect(
      hits.some(
        (hit) => hit.file.startsWith(WRITE_PASS) && hit.text === `.${method}(`,
      ),
    ).toBe(true);
  });

  it("does not count a mention in a comment", () => {
    const source = "  // callers used to write fs.writeFile(path) here\n";
    expect(SourceScan.inComment(source, source.indexOf(".writeFile("))).toBe(
      true,
    );
  });
});
