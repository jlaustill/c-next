import { resolve } from "node:path";

/** gcc/clang line marker: `# 958 "/path/to/task.h" 2`, or `#line 958 "..."` */
const MARKER = /^#\s*(?:line\s+)?\d+\s+"((?:[^"\\]|\\.)+)"/;
const LINE = /^#\s*(?:line\s+)?(\d+)/;
/** A marker's flags: `1` enters a file, `2` returns to one */
const FLAGS = /"((?:\s+\d)*)\s*$/;

/**
 * The compiler's line markers in preprocessed output, which say which file
 * each line came from.
 */
class LineMarkers {
  /** `content` without its markers */
  static strip(content: string): string {
    return content
      .split("\n")
      .filter((line) => !MARKER.test(line))
      .join("\n");
  }

  /**
   * #1844: the lines `content` holds from `file` itself, without the files it
   * includes -- the header's own text as a C compile meets it. Null when the
   * compile never entered `file`; "" when it entered it and kept no line.
   * Output with no marker at all is all `file`'s: nothing says otherwise.
   */
  static ownText(content: string, file: string): string | null {
    if (!content.split("\n").some((line) => MARKER.test(line))) return content;
    return LineMarkers.byFile(content).get(resolve(file)) ?? null;
  }

  /**
   * #1844: each file `content` entered, by resolved path, with its own lines
   * there -- "" for one entered that kept none.
   */
  static byFile(content: string): ReadonlyMap<string, string> {
    const files = new Map<string, string[]>();
    let current: string[] | null = null;
    for (const line of content.split("\n")) {
      const marker = MARKER.exec(line);
      if (marker) {
        const name = LineMarkers._nameOf(marker);
        if (name.startsWith("<")) {
          current = null;
          continue;
        }
        const path = resolve(name);
        current = files.get(path) ?? [];
        files.set(path, current);
      } else {
        current?.push(line);
      }
    }
    return new Map([...files].map(([path, lines]) => [path, lines.join("\n")]));
  }

  /**
   * #1844: the files a compile of `file` opened from inside it -- each one
   * entered after `file` was, so not those `-imacros` read before it, nor the
   * file that included `file`, which the compile returns to after it.
   */
  static entered(content: string, file: string): ReadonlySet<string> {
    const target = resolve(file);
    const files = new Set<string>();
    let started = false;
    for (const line of content.split("\n")) {
      const marker = MARKER.exec(line);
      if (!marker) continue;
      const name = LineMarkers._nameOf(marker);
      if (name.startsWith("<")) continue;
      const path = resolve(name);
      const enters = FLAGS.exec(line)?.[1].split(/\s+/).includes("1") ?? false;
      if (path === target) {
        // Entered from an includer (flag 1), or `file` is the main file,
        // whose first line follows the command line's (line 0)
        started ||= enters || LINE.exec(line)?.[1] !== "0";
      } else if (started && enters) {
        files.add(path);
      }
    }
    return files;
  }

  /** The compiler escapes a backslash or quote in the name it prints */
  private static _nameOf(marker: RegExpExecArray): string {
    return marker[1].replaceAll(/\\(.)/g, "$1");
  }
}

export default LineMarkers;
