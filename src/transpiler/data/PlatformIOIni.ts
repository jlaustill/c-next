/**
 * The one reader of platformio.ini.
 *
 * Include discovery reads `lib_extra_dirs` from it, and the run's target
 * (ADR-049, the build-system rung) reads each environment's board and
 * platform. Both go through `sections()`, so the file's continuation and
 * comment rules are decided once.
 */
import { join } from "node:path";

import type IFileSystem from "../types/IFileSystem";
import type IPlatformIOEnv from "../types/IPlatformIOEnv";
import type IPlatformIOProject from "../types/IPlatformIOProject";

/** How deep `${section.option}` may nest before a value is taken as cyclic */
const MAX_INTERPOLATION = 8;

/** A `${section.option}` reference, as PlatformIO spells one */
const REFERENCE = /\$\{([^.}]+)\.([^}]+)\}/g;

/** `default_envs`, and the old name PlatformIO still reads it by */
const DEFAULT_ENVS: readonly string[] = ["default_envs", "env_default"];

class PlatformIOIni {
  /**
   * Section name -> key -> value, in file order, read as PlatformIO's
   * configparser reads the file. Blank lines and comment lines are skipped,
   * so neither ends a value (#1760 review: both did), and a comment after
   * whitespace is dropped from its line. A value continues onto each
   * following line that is indented, does not start a key of its own, and
   * does not open a section (#1181). Each line is trimmed and the lines are
   * joined with "\n", so a value written below its key starts with one. Keys
   * before any section belong to the section named "".
   */
  static sections(content: string): Map<string, Map<string, string>> {
    const sections = new Map<string, Map<string, string>>();
    // #1760 review: a CRLF file kept `\r` on every line, so no key matched
    const lines = content
      .split(/\r?\n/)
      .filter((line) => !/^\s*(?:[;#]|$)/.test(line));
    let section = "";
    let index = 0;
    while (index < lines.length) {
      const line = lines[index];
      index += 1;
      const header = /^\s*\[([^\]]*)\]/.exec(line);
      if (header) {
        section = header[1].trim();
        continue;
      }
      const key = /^[ \t]*([\w.]+)[ \t]*=(.*)$/.exec(line);
      if (!key) {
        continue;
      }
      const collected = [PlatformIOIni.uncomment(key[2])];
      while (
        index < lines.length &&
        PlatformIOIni.isContinuation(lines[index])
      ) {
        collected.push(PlatformIOIni.uncomment(lines[index]));
        index += 1;
      }
      if (!sections.has(section)) {
        sections.set(section, new Map());
      }
      sections.get(section)!.set(key[1], collected.join("\n"));
    }
    return sections;
  }

  /** Every section's value for `key`, in file order */
  static valuesOf(content: string, key: string): string[] {
    const values: string[] = [];
    for (const keys of PlatformIOIni.sections(content).values()) {
      const value = keys.get(key);
      if (value !== undefined) {
        values.push(value);
      }
    }
    return values;
  }

  /** The platformio.ini in `projectRoot`, or null when there is none */
  static read(projectRoot: string, fs: IFileSystem): IPlatformIOProject | null {
    const path = join(projectRoot, "platformio.ini");
    if (!fs.exists(path)) {
      return null;
    }
    return PlatformIOIni.project(path, fs.readFile(path));
  }

  static project(path: string, content: string): IPlatformIOProject {
    const sections = PlatformIOIni.sections(content);
    const envs: IPlatformIOEnv[] = [];
    for (const name of sections.keys()) {
      if (!name.startsWith("env:")) {
        continue;
      }
      const envName = name.slice("env:".length).trim();
      const board =
        PlatformIOIni.optionValue(sections, name, ["board"])?.trim() ||
        undefined;
      const platform = PlatformIOIni.platformName(
        PlatformIOIni.optionValue(sections, name, ["platform"]),
      );
      envs.push({
        name: envName,
        ...(board === undefined ? {} : { board }),
        ...(platform === undefined ? {} : { platform }),
      });
    }
    const defaultEnvs = PlatformIOIni.list(
      PlatformIOIni.optionValue(sections, "platformio", DEFAULT_ENVS) ?? "",
    );
    return { path, envs, defaultEnvs };
  }

  /**
   * A section's value for an option known by any of `names`, found as
   * PlatformIO finds it (its config's `walk_options`), with its
   * `${section.option}` references expanded: the section's own options, then
   * the sections it `extends` -- the LAST listed first, each one's own parents
   * before the next -- and for an env the common `[env]` section last. The
   * first section giving the option answers, even with an empty value. A
   * section is visited once, so a cyclic `extends` ends. #1760 review: `[env]`
   * answered for the first parent before the rest were read, so
   * `extends = flags, teensy_base` built `[env]`'s board.
   */
  private static optionValue(
    sections: ReadonlyMap<string, ReadonlyMap<string, string>>,
    section: string,
    names: readonly string[],
    depth = 0,
  ): string | undefined {
    const raw = PlatformIOIni.walkValue(sections, section, names);
    return raw === undefined
      ? undefined
      : PlatformIOIni.expand(raw, sections, section, depth);
  }

  private static walkValue(
    sections: ReadonlyMap<string, ReadonlyMap<string, string>>,
    section: string,
    names: readonly string[],
  ): string | undefined {
    const stack = section.startsWith("env:") ? ["env", section] : [section];
    const visited = new Set<string>();
    while (stack.length > 0) {
      const name = stack.pop()!;
      if (visited.has(name)) continue;
      visited.add(name);
      const options = sections.get(name) ?? new Map<string, string>();
      for (const [option, value] of options) {
        if (names.includes(option)) return value;
      }
      stack.push(...PlatformIOIni.list(options.get("extends") ?? ""));
    }
    return undefined;
  }

  /**
   * A value with its `${section.option}` references expanded, as PlatformIO
   * expands them. Undefined when a reference cannot be expanded here -- the
   * build machine's `${sysenv.X}`, a missing option, a cycle -- so the value
   * says nothing. #1760 review: `board = ${common.board}` gave a false E0510.
   */
  private static expand(
    value: string,
    sections: ReadonlyMap<string, ReadonlyMap<string, string>>,
    section: string,
    depth: number,
  ): string | undefined {
    if (!value.includes("${")) return value;
    if (depth >= MAX_INTERPOLATION) return undefined;
    let unexpanded = false;
    const expanded = value.replace(REFERENCE, (_whole, from, option) => {
      const found = PlatformIOIni.reference(
        sections,
        section,
        String(from),
        String(option),
        depth,
      );
      unexpanded ||= found === undefined;
      return found ?? "";
    });
    return unexpanded || expanded.includes("${") ? undefined : expanded;
  }

  /**
   * One `${from.option}`: `this` is the section asked about, whose env name
   * is `${this.__env__}`, and `sysenv` is the build machine's, so unknown here
   */
  private static reference(
    sections: ReadonlyMap<string, ReadonlyMap<string, string>>,
    section: string,
    from: string,
    option: string,
    depth: number,
  ): string | undefined {
    if (from === "sysenv") return undefined;
    if (from === "this" && option === "__env__") {
      return section.startsWith("env:")
        ? section.slice("env:".length)
        : undefined;
    }
    const named = from === "this" ? section : from;
    return PlatformIOIni.optionValue(sections, named, [option], depth + 1);
  }

  /**
   * A platform's name from its PlatformIO spec: `atmelavr` from
   * `atmelavr@~4.2.0` and from `platformio/atmelavr` (#1760 review: both
   * gave a false E0510)
   */
  private static platformName(spec: string | undefined): string | undefined {
    const name = spec?.split("@")[0].split("/").at(-1)?.trim();
    return name || undefined;
  }

  /**
   * A value's items as PlatformIO splits one (`parse_multi_values`): by line
   * when it has several, else at ", " -- so `a,b` is ONE item -- each
   * trimmed, empties dropped. `sections()` has dropped the comments, line by
   * line, so a comma in a comment adds no item. The one list rule `extends`,
   * `default_envs` and `lib_extra_dirs` read. #1760 review: this split at
   * every comma, then cut comments from each piece.
   */
  static list(value: string): string[] {
    return value
      .split(value.includes("\n") ? "\n" : ", ")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }

  /**
   * A line's text without its comment, trimmed. A comment is `;` or `#`
   * after whitespace, as configparser has it (#1760 review:
   * `board = uno  # comment` kept the comment)
   */
  private static uncomment(text: string): string {
    return text.replace(/\s[;#].*$/, "").trim();
  }

  private static isContinuation(line: string): boolean {
    return (
      /^[ \t]+\S/.test(line) &&
      !/^[ \t]*[\w.]+[ \t]*=/.test(line) &&
      !line.trimStart().startsWith("[")
    );
  }
}

export default PlatformIOIni;
