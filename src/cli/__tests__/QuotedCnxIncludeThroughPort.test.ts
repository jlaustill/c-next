/**
 * #1137: a quoted `.cnx` include is checked through the injected port, never
 * the real disk. `5737557be` fixed it; these pin the fix. The resolver #1137
 * deleted called `existsSync` directly, so a dependency that exists only in a
 * `MockFileSystem` read as missing (E0506) at code generation.
 */
import { describe, expect, it } from "vitest";

import MockFileSystem from "./MockFileSystem";
import Transpiler from "../Transpiler";

async function transpile(withDependency: boolean) {
  const fs = new MockFileSystem();
  if (withDependency) {
    fs.addFile(
      "/project/src/can/config.cnx",
      "scope CanConfig { public u8 bitRate() { return 5; } }",
    );
  }
  fs.addFile(
    "/project/src/app.cnx",
    `#include "can/config.cnx"\nu32 main() { return 0; }\n`,
  );
  const transpiler = new Transpiler(
    { input: "/project/src/app.cnx", noCache: true, target: "host" },
    fs,
  );
  return transpiler.transpile({ kind: "files" });
}

describe("a quoted .cnx include is found through the port (#1137)", () => {
  it("transpiles when the dependency exists only in the mock", async () => {
    const result = await transpile(true);
    expect(result.errors).toEqual([]);
    expect(result.success).toBe(true);
  });

  it("reports exactly one E0506 when the dependency is absent", async () => {
    const result = await transpile(false);
    expect(result.success).toBe(false);
    expect(
      result.errors.filter((e) => e.message.includes("E0506")),
    ).toHaveLength(1);
  });
});
