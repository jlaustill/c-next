/**
 * ADR-049: a run's one target -- pragmas first, then the option, then the
 * fallback -- and the two ways a program can fail to have one.
 */
import { describe, it, expect } from "vitest";
import RunTarget from "../RunTarget";
import TargetCatalogFile from "../../../transpiler/data/TargetCatalogFile";
import type ITargetDirective from "../../../transpiler/types/ITargetDirective";
import type ITargetDescription from "../../../transpiler/types/ITargetDescription";
import type IPlatformIOProject from "../../../transpiler/types/IPlatformIOProject";

const catalog = TargetCatalogFile.targets();

/** A file that declares `#pragma target <name>` at `line`, or nothing */
function file(sourcePath: string, name?: string, line = 1) {
  const directives: ITargetDirective[] = name
    ? [{ key: "target", values: [name], line, column: 0 }]
    : [];
  return { sourcePath, directives };
}

function resolve(files: ReturnType<typeof file>[], option?: string) {
  return RunTarget.resolve({ option, catalog, files });
}

describe("RunTarget.resolve", () => {
  it("rejects a program nothing names a target for (E0515)", () => {
    expect(resolve([file("main.cnx")])).toEqual({
      kind: "rejected",
      absent: true,
      errors: [
        expect.objectContaining({
          line: 1,
          message: "error[E0515]: the program names no target",
          helpText: expect.stringContaining("Known targets: cortex-m7"),
        }),
      ],
    });
  });

  it("takes the option when no file declares a target", () => {
    expect(resolve([file("main.cnx")], "avr")).toMatchObject({
      kind: "resolved",
      name: "avr",
      source: "option",
      description: catalog.get("atmega328p"),
    });
  });

  it("takes a pragma over the option", () => {
    const target = resolve([file("main.cnx", "teensy41")], "cortex-m0");
    expect(target).toMatchObject({ name: "teensy41", source: "pragma" });
  });

  it("gives a helper's pragma to the whole program", () => {
    const target = resolve([file("helper.cnx", "teensy41"), file("main.cnx")]);
    expect(target).toMatchObject({
      kind: "resolved",
      name: "teensy41",
      description: catalog.get("cortex-m7"),
    });
  });

  it("treats an empty option as absent", () => {
    expect(resolve([file("main.cnx")], "")).toEqual({
      kind: "rejected",
      absent: true,
      errors: [
        expect.objectContaining({ message: expect.stringContaining("E0515") }),
      ],
    });
  });

  it("accepts files that name the same platform by different names", () => {
    // #1760 review: named by the ENTRY, the last file in pipeline order --
    // this said the helper's teensy41, a dependency's name and toolchain
    const target = resolve([
      file("helper.cnx", "teensy41"),
      file("main.cnx", "cortex-m7"),
    ]);
    expect(target).toMatchObject({ kind: "resolved", name: "cortex-m7" });
  });

  it("carries the entry's toolchain fields, not a dependency's", () => {
    // cortex-m3 and teensy41 describe one platform, and differ in the
    // optional fields that pick a compiler
    const target = resolve([
      file("helper.cnx", "cortex-m3"),
      file("main.cnx", "teensy41"),
    ]);
    expect(target).toMatchObject({
      kind: "resolved",
      name: "teensy41",
      description: catalog.get("teensy41"),
    });
  });

  it("rejects files that name different platforms, at the second (E0511)", () => {
    const target = resolve([
      file("helper.cnx", "teensy41", 3),
      file("main.cnx", "cortex-m0", 5),
    ]);
    expect(target).toEqual({
      kind: "rejected",
      absent: false,
      errors: [
        expect.objectContaining({
          sourcePath: "main.cnx",
          line: 5,
          message: expect.stringMatching(
            /^error\[E0511\]: this file declares target 'cortex-m0', but helper\.cnx:3 declares target 'teensy41'$/,
          ),
        }),
      ],
    });
  });

  it("rejects an unknown pragma name, at the pragma (E0510)", () => {
    const target = resolve([file("main.cnx", "bogus", 2)]);
    expect(target).toEqual({
      kind: "rejected",
      absent: false,
      errors: [
        expect.objectContaining({
          sourcePath: "main.cnx",
          line: 2,
          message: "error[E0510]: 'bogus' is not a known target",
          helpText: expect.stringContaining("teensy41"),
        }),
      ],
    });
  });

  it("matches names exactly", () => {
    expect(resolve([file("main.cnx", "TEENSY41")]).kind).toBe("rejected");
  });

  it("rejects an unknown option even when a pragma decides", () => {
    const target = resolve([file("main.cnx", "teensy41")], "bogus");
    expect(target).toEqual({
      kind: "rejected",
      absent: false,
      errors: [
        expect.objectContaining({
          message:
            "error[E0510]: the target option names 'bogus', which is not a known target",
        }),
      ],
    });
    if (target.kind === "rejected") {
      expect(target.errors[0].sourcePath).toBeUndefined();
    }
  });

  describe("inline descriptions", () => {
    /** Every description pragma, spelled from a catalog row */
    function inline(
      row: string,
      overrides: Record<string, string[] | null> = {},
    ): ITargetDirective[] {
      const description = catalog.get(row) as ITargetDescription;
      const directives: ITargetDirective[] = [];
      let line = 1;
      for (const [key, value] of Object.entries(description)) {
        if (key === "name" || key.startsWith("toolchain_")) continue;
        const values = key in overrides ? overrides[key] : [String(value)];
        if (values !== null) {
          directives.push({ key, values, line: line++, column: 0 });
        }
      }
      return directives;
    }

    function resolveInline(...files: ITargetDirective[][]) {
      return RunTarget.resolve({
        catalog,
        files: files.map((directives, i) => ({
          sourcePath: `f${i}.cnx`,
          directives,
        })),
      });
    }

    function messagesOf(target: ReturnType<typeof resolveInline>) {
      return target.kind === "rejected"
        ? target.errors.map((e) => e.message)
        : [];
    }

    it("resolves a complete description", () => {
      const target = resolveInline(inline("cortex-m7"));
      expect(target).toMatchObject({
        kind: "resolved",
        name: "inline",
        source: "pragma",
        description: { ldrex_strex: true, word_size: 32 },
      });
    });

    it("lists every missing field (E0514)", () => {
      const target = resolveInline(
        inline("cortex-m7", { ldrex_strex: null, basepri: null }),
      );
      expect(target).toEqual({
        kind: "rejected",
        absent: false,
        errors: [
          expect.objectContaining({
            line: 1,
            message: "error[E0514]: incomplete target description",
            helpText: expect.stringMatching(/^missing: ldrex_strex, basepri\./),
          }),
        ],
      });
    });

    it.each([
      [
        "a value the schema does not allow",
        { word_size: ["12"] },
        "word_size must be one of 8, 16, 32, 64",
      ],
      [
        "a Boolean that is not true or false",
        { ldrex_strex: ["yes"] },
        "ldrex_strex must be true or false, not 'yes'",
      ],
      [
        "an integer that is not decimal",
        { int_bits: ["0x20"] },
        "int_bits must be a decimal integer, not '0x20'",
      ],
      [
        "two values",
        { int_bits: ["32", "16"] },
        "'int_bits' takes exactly one value",
      ],
    ])("rejects %s (E0513)", (_why, overrides, problem) => {
      expect(messagesOf(resolveInline(inline("cortex-m7", overrides)))).toEqual(
        [
          `error[E0513]: invalid value for '${Object.keys(overrides)[0]}': ${problem}`,
        ],
      );
    });

    it("rejects a field given twice (E0513)", () => {
      const directives = inline("cortex-m7");
      directives.push({
        key: "word_size",
        values: ["32"],
        line: 99,
        column: 0,
      });
      expect(messagesOf(resolveInline(directives))).toEqual([
        "error[E0513]: invalid value for 'word_size': 'word_size' is given twice",
      ]);
    });

    it("rejects a description that breaks C's width order (E0513)", () => {
      expect(
        messagesOf(
          resolveInline(inline("cortex-m7", { long_double_bits: ["32"] })),
        ),
      ).toEqual([
        "error[E0513]: invalid value for 'target description': double_bits is wider than long_double_bits",
      ]);
    });

    it("rejects a pragma key ADR-049 does not define (E0512)", () => {
      expect(
        messagesOf(
          resolveInline([{ key: "once", values: [], line: 1, column: 0 }]),
        ),
      ).toEqual(["error[E0512]: unknown pragma 'once'"]);
    });

    it("rejects 'target' with more than one value (E0513)", () => {
      expect(
        messagesOf(
          resolveInline([
            {
              key: "target",
              values: ["teensy41", "extra"],
              line: 1,
              column: 0,
            },
          ]),
        ),
      ).toEqual([
        "error[E0513]: invalid value for 'target': 'target' takes exactly one value",
      ]);
    });

    it("accepts two files with equal inline descriptions", () => {
      expect(resolveInline(inline("cortex-m7"), inline("cortex-m7")).kind).toBe(
        "resolved",
      );
    });

    it("rejects two files with different inline descriptions (E0511)", () => {
      expect(
        messagesOf(resolveInline(inline("cortex-m7"), inline("cortex-m0"))),
      ).toEqual([
        "error[E0511]: this file declares an inline target description, but f0.cnx:1 declares an inline target description",
      ]);
    });

    it("rejects a program that both names and describes its target (E0511)", () => {
      const named: ITargetDirective[] = [
        { key: "target", values: ["cortex-m7"], line: 1, column: 0 },
      ];
      expect(messagesOf(resolveInline(named, inline("cortex-m7")))).toEqual([
        "error[E0511]: this file declares an inline target description, but f0.cnx:1 declares target 'cortex-m7'",
      ]);
    });
  });

  describe("the PlatformIO rung", () => {
    function project(
      envs: { name: string; board?: string; platform?: string }[],
      defaultEnvs: string[] = [],
      machineDefaultEnvs: IPlatformIOProject["machineDefaultEnvs"] = null,
    ): IPlatformIOProject {
      return { path: "platformio.ini", envs, defaultEnvs, machineDefaultEnvs };
    }
    const teensy = { name: "teensy41", board: "teensy41", platform: "teensy" };
    const uno = { name: "uno", board: "uno", platform: "atmelavr" };
    const native = { name: "native", platform: "native" };
    const nucleo = {
      name: "nucleo",
      board: "nucleo_f446re",
      platform: "ststm32",
    };

    function build(
      platformio: ReturnType<typeof project>,
      extra: { option?: string; pioEnv?: string; pragma?: string } = {},
    ) {
      return RunTarget.resolve({
        catalog,
        platformio,
        option: extra.option,
        pioEnv: extra.pioEnv,
        files: [file("main.cnx", extra.pragma)],
      });
    }

    it.each([
      ["a board the catalog names", teensy, "teensy41"],
      ["an atmelavr board", uno, "avr"],
      ["a native environment", native, "host"],
    ])("maps %s", (_why, env, name) => {
      expect(build(project([env]))).toMatchObject({
        kind: "resolved",
        name,
        source: "platformio",
      });
    });

    it("rejects an unmapped board when it decides (E0510)", () => {
      const target = build(project([nucleo]));
      expect(target).toEqual({
        kind: "rejected",
        absent: false,
        errors: [
          expect.objectContaining({
            message:
              "error[E0510]: platformio.ini environment 'nucleo' builds board 'nucleo_f446re', which is not a known target",
          }),
        ],
      });
    });

    it.each([
      ["a pragma", { pragma: "cortex-m0" }, "cortex-m0"],
      ["the option", { option: "cortex-m0" }, "cortex-m0"],
    ])("yields to %s, even over an unmapped board", (_why, extra, name) => {
      expect(build(project([nucleo]), extra)).toMatchObject({
        kind: "resolved",
        name,
      });
    });

    it("rejects environments that build different targets (E0511)", () => {
      const target = build(project([teensy, uno]));
      expect(target).toEqual({
        kind: "rejected",
        absent: false,
        errors: [
          expect.objectContaining({
            message:
              "error[E0511]: platformio.ini environments build different targets: 'teensy41' (env:teensy41) and 'avr' (env:uno)",
          }),
        ],
      });
    });

    it("builds only default_envs when it is set", () => {
      expect(build(project([teensy, uno], ["uno"]))).toMatchObject({
        name: "avr",
      });
    });

    it("builds only the environment named by --pio-env", () => {
      expect(
        build(project([teensy, uno], ["uno"]), { pioEnv: "teensy41" }),
      ).toMatchObject({ name: "teensy41" });
    });

    it("rejects a --pio-env the file does not define (E0510)", () => {
      expect(build(project([teensy]), { pioEnv: "missing" })).toEqual({
        kind: "rejected",
        absent: false,
        errors: [
          expect.objectContaining({
            message:
              "error[E0510]: platformio.ini has no environment 'missing'",
          }),
        ],
      });
    });

    it("says nothing when the file has no environments", () => {
      expect(build(project([]))).toEqual({
        kind: "rejected",
        absent: true,
        errors: [
          expect.objectContaining({
            message: expect.stringContaining("E0515"),
          }),
        ],
      });
    });

    // #1760 second review: a name only the machine's variable gave is the
    // variable's, so the diagnostic says so rather than blaming the file
    const byMachine = (names: string[]) => ({
      variable: "PLATFORMIO_DEFAULT_ENVS",
      names,
    });

    it("names the variable for an environment the file does not declare", () => {
      const result = build(project([uno], ["nosuch"], byMachine(["nosuch"])));
      expect(result.kind).toBe("rejected");
      if (result.kind === "rejected") {
        expect(result.errors[0].message).toContain(
          "PLATFORMIO_DEFAULT_ENVS names environment 'nosuch', which platformio.ini does not declare",
        );
      }
    });

    it("names the variable that added a conflicting environment", () => {
      const result = build(
        project([teensy, uno], ["teensy41", "uno"], byMachine(["uno"])),
      );
      expect(result.kind).toBe("rejected");
      if (result.kind === "rejected") {
        expect(result.errors[0].helpText).toContain(
          "PLATFORMIO_DEFAULT_ENVS adds 'uno' to the file's default_envs",
        );
        expect(result.errors[0].helpText).toContain(
          "unset PLATFORMIO_DEFAULT_ENVS",
        );
      }
    });

    it("attributes nothing to the variable when --pio-env chose", () => {
      const result = build(project([uno], ["nosuch"], byMachine(["nosuch"])), {
        pioEnv: "nosuch",
      });
      expect(result.kind).toBe("rejected");
      if (result.kind === "rejected") {
        expect(result.errors[0].message).toContain(
          "platformio.ini has no environment 'nosuch'",
        );
      }
    });
  });
});
