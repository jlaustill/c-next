import { resolve } from "node:path";

/** gcc/clang line marker: `# 958 "/path/to/task.h" 2`, or `#line 958 "..."` */
const MARKER = /^#\s*(?:line\s+)?\d+\s+"((?:[^"\\]|\\.)+)"/;
const LINE = /^#\s*(?:line\s+)?(\d+)/;

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
    const target = resolve(file);
    const own: string[] = [];
    let entered = false;
    let inside = false;
    let marked = false;
    for (const line of content.split("\n")) {
      const marker = MARKER.exec(line);
      if (marker) {
        marked = true;
        // The compiler escapes a backslash or quote in the name it prints
        const name = marker[1].replaceAll(/\\(.)/g, "$1");
        inside = !name.startsWith("<") && resolve(name) === target;
        entered ||= inside;
      } else if (inside) {
        own.push(line);
      }
    }
    if (!marked) return content;
    return entered ? own.join("\n") : null;
  }

  /**
   * #1844: the files a compile of `file` opened from inside it -- the ones
   * after `file`'s first line, so not those `-imacros` read before it.
   */
  static entered(content: string, file: string): ReadonlySet<string> {
    const target = resolve(file);
    const files = new Set<string>();
    let started = false;
    for (const line of content.split("\n")) {
      const marker = MARKER.exec(line);
      if (!marker) continue;
      const name = marker[1].replaceAll(/\\(.)/g, "$1");
      if (name.startsWith("<")) continue;
      const path = resolve(name);
      if (path === target) {
        started ||= LINE.exec(line)?.[1] !== "0";
      } else if (started) {
        files.add(path);
      }
    }
    return files;
  }
}

export default LineMarkers;
