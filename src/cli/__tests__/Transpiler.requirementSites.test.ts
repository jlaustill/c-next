/**
 * #1997: the atomic requirement's site travels from where Render notes the
 * LDREX/STREX loop to the result through `PlannedRequirements`. No fixture
 * can see it -- the banner prints no sites -- so this is the one check that
 * fails if the note and the take stop meeting.
 */
import { describe, it, expect } from "vitest";
import Transpiler from "../Transpiler";
import MockFileSystem from "./MockFileSystem";

describe("Transpiler -- requirement sites (#1997)", () => {
  it("attributes atomic-ldrex-cmsis to the file that emitted the loop", async () => {
    const fs = new MockFileSystem();
    fs.addFile(
      "/project/src/main.cnx",
      "atomic u32 n <- 0;\nvoid bump() { n +<- 1; }\n",
    );
    const transpiler = new Transpiler(
      {
        input: "/project/src/main.cnx",
        outDir: "/project/build",
        noCache: true,
        target: "teensy41",
      },
      fs,
    );

    const result = await transpiler.transpile({ kind: "files" });

    expect(result.requirements).toContainEqual({
      key: "atomic-ldrex-cmsis",
      sites: [{ sourcePath: "/project/src/main.cnx", line: null }],
    });
  });
});
