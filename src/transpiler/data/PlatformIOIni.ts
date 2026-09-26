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

/** How deep `extends` may chain before the file is taken to be cyclic */
const MAX_EXTENDS = 8;

class PlatformIOIni {
  /**
   * Section name -> key -> raw value, in file order. Keys before any section
   * belong to the section named "". A value continues onto each following line
   * that is indented, does not start a key of its own, and does not open a
   * section (#1181); continuation lines are joined with "\n".
   */
  static sections(content: string): Map<string, Map<string, string>> {
    const sections = new Map<string, Map<string, string>>();
    const lines = content.split("\n");
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
      const collected = [key[2]];
      while (
        index < lines.length &&
        PlatformIOIni.isContinuation(lines[index])
      ) {
        collected.push(lines[index]);
        index += 1;
      }
      if (!sections.has(section)) {
        sections.set(section, new Map());
      }
      sections.get(section)!.set(key[1], collected.join("\n"));
    }
    return sections;
  }

  /** Every section's raw value for `key`, in file order */
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
      const board = PlatformIOIni.envValue(sections, name, "board");
      const platform = PlatformIOIni.envValue(sections, name, "platform");
      envs.push({
        name: envName,
        ...(board === undefined ? {} : { board }),
        ...(platform === undefined ? {} : { platform }),
      });
    }
    const defaultEnvs = PlatformIOIni.list(
      sections.get("platformio")?.get("default_envs") ?? "",
    );
    return { path, envs, defaultEnvs };
  }

  /**
   * An env's value for `key`: its own, else the first section it `extends`
   * that has one, else the common `[env]` section's.
   */
  private static envValue(
    sections: ReadonlyMap<string, ReadonlyMap<string, string>>,
    section: string,
    key: string,
    depth = 0,
  ): string | undefined {
    const own = PlatformIOIni.clean(sections.get(section)?.get(key));
    if (own !== undefined || depth >= MAX_EXTENDS) {
      return own ?? PlatformIOIni.clean(sections.get("env")?.get(key));
    }
    for (const parent of PlatformIOIni.list(
      sections.get(section)?.get("extends") ?? "",
    )) {
      const inherited = PlatformIOIni.envValue(
        sections,
        parent,
        key,
        depth + 1,
      );
      if (inherited !== undefined) {
        return inherited;
      }
    }
    return PlatformIOIni.clean(sections.get("env")?.get(key));
  }

  /** A comma- or line-separated value, trimmed, empties dropped */
  private static list(value: string): string[] {
    return value
      .split(/[\n,]/)
      .map((item) => PlatformIOIni.clean(item) ?? "")
      .filter((item) => item.length > 0);
  }

  /** A single value without its inline `;` comment, or undefined if empty */
  private static clean(value: string | undefined): string | undefined {
    const text = value?.replace(/\s;.*$/, "").trim();
    return text ? text : undefined;
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
