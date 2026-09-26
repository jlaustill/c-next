/**
 * The one reader of platformio.ini: environments for ADR-049's build-system
 * rung. (Its lib_extra_dirs half is covered through IncludeDiscovery.)
 */
import { describe, it, expect } from "vitest";
import PlatformIOIni from "../PlatformIOIni";

describe("PlatformIOIni.project", () => {
  it("reads each environment's board and platform", () => {
    const project = PlatformIOIni.project(
      "platformio.ini",
      `; comment
[env:teensy41]
platform = teensy
board = teensy41   ; inline comment
framework = arduino

[env:uno]
platform = atmelavr
board = uno
`,
    );
    expect(project.envs).toEqual([
      { name: "teensy41", board: "teensy41", platform: "teensy" },
      { name: "uno", board: "uno", platform: "atmelavr" },
    ]);
    expect(project.defaultEnvs).toEqual([]);
  });

  it("reads default_envs, comma- or line-separated", () => {
    const project = PlatformIOIni.project(
      "platformio.ini",
      `[platformio]
default_envs = a, b
    c
`,
    );
    expect(project.defaultEnvs).toEqual(["a", "b", "c"]);
  });

  it("takes a key from what an environment extends, then from [env]", () => {
    const project = PlatformIOIni.project(
      "platformio.ini",
      `[env]
platform = native

[base]
board = teensy41

[env:child]
extends = base
`,
    );
    expect(project.envs).toEqual([
      { name: "child", board: "teensy41", platform: "native" },
    ]);
  });

  it("stops following an extends cycle", () => {
    const project = PlatformIOIni.project(
      "platformio.ini",
      `[env:a]
extends = env:b
[env:b]
extends = env:a
`,
    );
    expect(project.envs).toEqual([{ name: "a" }, { name: "b" }]);
  });
});

describe("PlatformIOIni.sections", () => {
  it("joins continuation lines and ends a value at the next key", () => {
    const sections = PlatformIOIni.sections(`[env:x]
build_flags =
    -O2
    -Wall
board = uno
`);
    expect(sections.get("env:x")?.get("build_flags")).toBe(
      "\n    -O2\n    -Wall",
    );
    expect(sections.get("env:x")?.get("board")).toBe(" uno");
  });
});
