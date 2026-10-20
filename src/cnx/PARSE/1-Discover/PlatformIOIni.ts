/**
 * The one reader of platformio.ini, and its one editor.
 *
 * Include discovery reads `lib_extra_dirs` from it, and the run's target
 * (ADR-049, the build-system rung) reads each environment's board and
 * platform. Both go through `sections()`, and `--pio-install` and
 * `--pio-uninstall` edit `extra_scripts` through `layout()` (#2174), so the
 * file's continuation and comment rules are decided once.
 */
import { join } from "node:path";

import type IFileSystem from "../../types/IFileSystem";
import type IPlatformIOEnv from "../../types/IPlatformIOEnv";
import type IPlatformIOProject from "../../types/IPlatformIOProject";
import type IPlatformIOIniLayout from "./types/IPlatformIOIniLayout";
import type IPlatformIOIniOption from "./types/IPlatformIOIniOption";
import type IPlatformIOIniSection from "./types/IPlatformIOIniSection";

/** How deep `${section.option}` may nest before a value is taken as cyclic */
const MAX_INTERPOLATION = 8;

/** A `${section.option}` reference, as PlatformIO spells one */
const REFERENCE = /\$\{([^.}]+)\.([^}]+)\}/g;

/** A line starting an option: its key, then everything after the `=` */
const KEY = /^[ \t]*([\w.]+)[ \t]*=(.*)$/;

/** A comment: `;` or `#` after whitespace, to the end of the line */
const COMMENT = /\s[;#].*$/;

/** `default_envs`, and the old name PlatformIO still reads it by */
const DEFAULT_ENVS: readonly string[] = ["default_envs", "env_default"];

/**
 * The build machine's variables that add to `default_envs`: the current
 * name, then the old one PlatformIO reads when it is unset. An empty value
 * counts as unset, as PlatformIO's own option reader counts it.
 */
const MACHINE_DEFAULT_ENVS: readonly string[] = [
  "PLATFORMIO_DEFAULT_ENVS",
  "PLATFORMIO_ENV_DEFAULT",
];

/** The build machine's environment variables, as `process.env` holds them */
type TEnvironment = Readonly<Record<string, string | undefined>>;

class PlatformIOIni {
  /**
   * Section name -> key -> value, in file order: `layout()`'s options. Keys
   * before any section belong to the section named "".
   */
  static sections(content: string): Map<string, Map<string, string>> {
    const sections = new Map<string, Map<string, string>>();
    for (const option of PlatformIOIni.layout(content).options) {
      if (!sections.has(option.section)) {
        sections.set(option.section, new Map());
      }
      sections.get(option.section)!.set(option.key, option.value);
    }
    return sections;
  }

  /**
   * The file's section headers and options, read as PlatformIO's
   * configparser reads them. Blank lines and comment lines are skipped, so
   * neither ends a value (#1760 review: both did), and a comment after
   * whitespace is dropped from its line. A value continues onto each
   * following line that is indented, does not start a key of its own, and
   * does not open a section (#1181). Each line is trimmed and the lines are
   * joined with "\n", so a value written below its key starts with one.
   */
  static layout(content: string): IPlatformIOIniLayout {
    // #1760 review: a CRLF file kept `\r` on every line, so no key matched
    const lines = content
      .split(/\r?\n/)
      .map((text, line) => ({ text, line }))
      .filter((entry) => !/^\s*(?:[;#]|$)/.test(entry.text));
    const sections: IPlatformIOIniSection[] = [];
    const options: IPlatformIOIniOption[] = [];
    let section = "";
    let index = 0;
    while (index < lines.length) {
      const entry = lines[index];
      index += 1;
      const header = /^\s*\[([^\]]*)\]/.exec(entry.text);
      if (header) {
        section = header[1].trim();
        sections.push({ name: section, line: entry.line });
        continue;
      }
      const key = KEY.exec(entry.text);
      if (!key) {
        continue;
      }
      const at = [entry.line];
      const lineValues = [PlatformIOIni.uncomment(key[2])];
      while (
        index < lines.length &&
        PlatformIOIni.isContinuation(lines[index].text)
      ) {
        at.push(lines[index].line);
        lineValues.push(PlatformIOIni.uncomment(lines[index].text));
        index += 1;
      }
      options.push({
        section,
        key: key[1],
        value: lineValues.join("\n"),
        lines: at,
        lineValues,
      });
    }
    return { sections, options };
  }

  /**
   * `content` with `option` holding `items`, in the form it was written in.
   * No items removes it, continuation lines too. A one-line value
   * (`isOneLine()`, or one it cannot tell) is rewritten as one line, its items split at ", " as `list()` reads it. In a
   * value written one item per line, each line whose item is gone is
   * dropped (the key's line keeps its key) and each new item is added on a
   * line of its own after the last. Comments and line breaks are kept.
   */
  static withItems(
    content: string,
    option: IPlatformIOIniOption,
    items: readonly string[],
  ): string {
    const lines = content.split(/\r?\n/);
    const keyLine = option.lines[0];
    const replaced = new Map<number, string[]>();
    if (items.length === 0) {
      for (const line of option.lines) {
        replaced.set(line, []);
      }
    } else if (PlatformIOIni.isOneLine(content, option) ?? true) {
      replaced.set(keyLine, [
        PlatformIOIni.keyLine(lines[keyLine], items.join(", ")),
      ]);
    } else {
      option.lines.forEach((line, index) => {
        const value = option.lineValues[index];
        if (value !== "" && !items.includes(value)) {
          replaced.set(
            line,
            line === keyLine ? [PlatformIOIni.keyLine(lines[line], "")] : [],
          );
        }
      });
      const added = items.filter((item) => !option.lineValues.includes(item));
      const last = option.lines.at(-1)!;
      const indent =
        last === keyLine ? "    " : /^[ \t]*/.exec(lines[last])![0];
      if (added.length > 0) {
        replaced.set(last, [
          ...(replaced.get(last) ?? [lines[last]]),
          ...added.map((item) => indent + item),
        ]);
      }
    }
    return lines
      .flatMap((text, line) => replaced.get(line) ?? [text])
      .join(PlatformIOIni.lineBreak(content));
  }

  /**
   * Whether PlatformIO reads `option` as a one-line list, split at ", ". It
   * splits a value after expanding its `${section.option}` references, so
   * `extra_scripts = ${common.extra_scripts}` is a list of lines when
   * `common`'s is (#2174 review: install glued `, pre:cnx_build.py` onto its
   * last item). Undefined when a reference cannot be expanded here, such as
   * `${sysenv.X}`.
   */
  static isOneLine(
    content: string,
    option: IPlatformIOIniOption,
  ): boolean | undefined {
    if (option.lines.length > 1 || option.lineValues[0] === "") {
      return false;
    }
    const expanded = PlatformIOIni.expand(
      option.value,
      PlatformIOIni.sections(content),
      option.section,
      0,
    );
    return expanded === undefined ? undefined : !expanded.includes("\n");
  }

  /** `content` with `key = value` as the first line of `section` */
  static withOption(
    content: string,
    section: IPlatformIOIniSection,
    key: string,
    value: string,
  ): string {
    const lines = content.split(/\r?\n/);
    lines.splice(section.line + 1, 0, `${key} = ${value}`);
    return lines.join(PlatformIOIni.lineBreak(content));
  }

  /** The option line `text` holding `value` instead, its comment kept */
  private static keyLine(text: string, value: string): string {
    const after = KEY.exec(text)![2];
    const key = text.slice(0, text.length - after.length);
    const comment = COMMENT.exec(after)?.[0] ?? "";
    return value === "" ? key + comment : `${key} ${value}${comment}`;
  }

  private static lineBreak(content: string): string {
    return content.includes("\r\n") ? "\r\n" : "\n";
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

  /**
   * The platformio.ini in `projectRoot`, or null when there is none, read with
   * the build machine's `environment` as PlatformIO reads it
   */
  static read(
    projectRoot: string,
    fs: IFileSystem,
    environment: TEnvironment,
  ): IPlatformIOProject | null {
    const path = join(projectRoot, "platformio.ini");
    if (!fs.exists(path)) {
      return null;
    }
    return PlatformIOIni.project(path, fs.readFile(path), environment);
  }

  static project(
    path: string,
    content: string,
    environment: TEnvironment,
  ): IPlatformIOProject {
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
      PlatformIOIni.defaultEnvsValue(sections, environment) ?? "",
    );
    return {
      path,
      envs,
      defaultEnvs,
      machineDefaultEnvs: PlatformIOIni.machineDefaultEnvs(
        sections,
        environment,
        defaultEnvs,
      ),
    };
  }

  /**
   * Which of `defaultEnvs` the build machine's variable added: the names the
   * file's own `default_envs` does not list. The list itself is split once,
   * from the joined value, as PlatformIO splits it; this only attributes it.
   */
  private static machineDefaultEnvs(
    sections: ReadonlyMap<string, ReadonlyMap<string, string>>,
    environment: TEnvironment,
    defaultEnvs: readonly string[],
  ): IPlatformIOProject["machineDefaultEnvs"] {
    const variable = MACHINE_DEFAULT_ENVS.find((name) => environment[name]);
    if (variable === undefined) return null;
    const fromFile = PlatformIOIni.walkValue(
      sections,
      "platformio",
      DEFAULT_ENVS,
    );
    const fileNames = PlatformIOIni.list(
      fromFile === undefined
        ? ""
        : (PlatformIOIni.expand(fromFile, sections, "platformio", 0) ?? ""),
    );
    return {
      variable,
      names: defaultEnvs.filter((name) => !fileNames.includes(name)),
    };
  }

  /**
   * `default_envs` as PlatformIO reads it: the file's value, with the build
   * machine's `PLATFORMIO_DEFAULT_ENVS` appended on a line of its own, or its
   * old name `PLATFORMIO_ENV_DEFAULT` when that is unset. References expand
   * after the append, as PlatformIO's do. #1794, owner ruling 2026-09-28:
   * "yes, if it exists".
   */
  private static defaultEnvsValue(
    sections: ReadonlyMap<string, ReadonlyMap<string, string>>,
    environment: TEnvironment,
  ): string | undefined {
    const fromFile = PlatformIOIni.walkValue(
      sections,
      "platformio",
      DEFAULT_ENVS,
    );
    const fromMachine = MACHINE_DEFAULT_ENVS.map(
      (name) => environment[name],
    ).find(Boolean);
    let raw = fromFile;
    if (fromMachine) {
      raw = fromFile ? `${fromFile}\n${fromMachine}` : fromMachine;
    }
    return raw === undefined
      ? undefined
      : PlatformIOIni.expand(raw, sections, "platformio", 0);
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
    return text.replace(COMMENT, "").trim();
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
