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

  it("reads default_envs at ', ' on one line, by line on several", () => {
    // PlatformIO's parse_multi_values: a value of several lines is split by
    // line only, so `a, b` there is one (unknown) env name, as PlatformIO has it
    const defaultEnvs = (content: string) =>
      PlatformIOIni.project("platformio.ini", content).defaultEnvs;
    expect(defaultEnvs("[platformio]\ndefault_envs = a, b\n")).toEqual([
      "a",
      "b",
    ]);
    expect(defaultEnvs("[platformio]\ndefault_envs = a, b\n    c\n")).toEqual([
      "a, b",
      "c",
    ]);
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
    // Each line trimmed, as configparser has it
    expect(sections.get("env:x")?.get("build_flags")).toBe("\n-O2\n-Wall");
    expect(sections.get("env:x")?.get("board")).toBe("uno");
  });
});

// #1760 review: the file as PlatformIO reads it
describe("PlatformIOIni.project, as PlatformIO reads the file", () => {
  const envsOf = (content: string) =>
    PlatformIOIni.project("platformio.ini", content).envs;

  it("reads a CRLF file", () => {
    expect(
      envsOf("[env:teensy41]\r\nplatform = teensy\r\nboard = teensy41\r\n"),
    ).toEqual([{ name: "teensy41", board: "teensy41", platform: "teensy" }]);
  });

  it("consults every extended section before [env]", () => {
    // [env] answered for the first parent, so the second was never read
    expect(
      envsOf(`[env]
platform = atmelavr
board = uno
[flags]
build_flags = -DFOO
[teensy_base]
platform = teensy
board = teensy41
[env:teensy]
extends = flags, teensy_base
`),
    ).toEqual([{ name: "teensy", board: "teensy41", platform: "teensy" }]);
  });

  it("consults the last-listed parent first, as PlatformIO's walk does", () => {
    expect(
      envsOf(`[a]
board = uno
[b]
board = teensy41
[env:x]
extends = a, b
`)[0].board,
    ).toBe("teensy41");
  });

  it.each([
    ["a versioned spec", "atmelavr@~4.2.0"],
    ["an owner-qualified spec", "platformio/atmelavr"],
    ["both", "platformio/atmelavr@^4.2.0"],
  ])("reads the platform's name from %s", (_label, spec) => {
    expect(
      envsOf(`[env:uno]\nplatform = ${spec}\nboard = uno\n`)[0].platform,
    ).toBe("atmelavr");
  });

  it("expands a ${section.option} reference, from a section or an env", () => {
    expect(
      envsOf(`[common]
board = teensy41
[env:base]
platform = teensy
[env:t]
extends = env:base
board = \${common.board}
platform = \${env:base.platform}
`).find((env) => env.name === "t"),
    ).toEqual({ name: "t", board: "teensy41", platform: "teensy" });
  });

  it("says nothing of a value it cannot expand", () => {
    // `${sysenv.X}` is the build machine's; a missing option is nothing
    expect(
      envsOf(`[env:t]
board = \${sysenv.BOARD}
platform = \${common.missing}
`),
    ).toEqual([{ name: "t" }]);
  });

  it("drops an inline # comment as it drops a ; one", () => {
    expect(envsOf(`[env:uno]\nboard = uno  # the classic\n`)[0].board).toBe(
      "uno",
    );
  });

  // Each expectation below is what a transcription of PlatformIO's
  // config.py (walk_options, parse_multi_values) over configparser gives.
  const defaultEnvsOf = (content: string) =>
    PlatformIOIni.project("platformio.ini", content).defaultEnvs;

  it("keeps a value open across a blank line and a commented-out line", () => {
    expect(
      defaultEnvsOf(`[platformio]
default_envs =
;   uno
    teensy41

    due
`),
    ).toEqual(["teensy41", "due"]);
  });

  it("reads `a,b` as one name: a one-line list splits at ', ' only", () => {
    expect(
      envsOf(`[a]
board = uno
[b]
board = teensy41
[env:x]
extends = a,b
`),
    ).toEqual([{ name: "x" }]);
    expect(defaultEnvsOf("[platformio]\ndefault_envs = a,b\n")).toEqual([
      "a,b",
    ]);
  });

  it("drops a comment before splitting, so a comma in it adds no item", () => {
    expect(
      defaultEnvsOf("[platformio]\ndefault_envs = uno ; not teensy, due\n"),
    ).toEqual(["uno"]);
  });

  it("takes an option from the first section giving it, even empty", () => {
    // [env]'s board is not inherited past the env's own empty one
    expect(
      envsOf(`[env]
board = uno
[env:native]
platform = native
board =
`),
    ).toEqual([{ name: "native", platform: "native" }]);
  });

  it("reads default_envs by its old name, env_default", () => {
    expect(defaultEnvsOf("[platformio]\nenv_default = uno\n")).toEqual(["uno"]);
  });

  it("expands ${this.__env__} to the env's name", () => {
    expect(
      envsOf(`[env]
board = \${this.__env__}
[env:teensy41]
platform = teensy
`),
    ).toEqual([{ name: "teensy41", board: "teensy41", platform: "teensy" }]);
  });

  it("keeps quotes in a name, so a quoted extends names no section", () => {
    expect(
      envsOf(`[base]
board = uno
[env:x]
extends = "base"
`),
    ).toEqual([{ name: "x" }]);
  });
});
