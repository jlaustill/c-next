export default class ScopeTracker {
  private static getContext(
    source: string,
    cursorLine: number,
    pattern: RegExp,
  ): string | null {
    const lines = source.split("\n");
    let currentName: string | null = null;
    let braceDepth = 0;
    let blockStartDepth = 0;

    for (
      let lineNum = 0;
      lineNum <= cursorLine && lineNum < lines.length;
      lineNum++
    ) {
      const line = lines[lineNum];
      const trimmed = line.trim();
      if (
        trimmed.startsWith("//") ||
        trimmed.startsWith("/*") ||
        trimmed.startsWith("*")
      )
        continue;
      const clean = line.replace(/\/\/.*$/, "").replace(/\/\*.*?\*\//g, "");
      const match = clean.match(pattern);
      if (match) {
        currentName = match[1];
        blockStartDepth = braceDepth;
        braceDepth++;
        continue;
      }
      for (const ch of clean) {
        if (ch === "{") braceDepth++;
        if (ch === "}") {
          braceDepth--;
          if (currentName && braceDepth <= blockStartDepth) {
            currentName = null;
            blockStartDepth = 0;
          }
        }
      }
    }
    return currentName;
  }

  static getCurrentScope(
    source: string,
    cursorLine: number,
  ): string | null {
    return ScopeTracker.getContext(
      source,
      cursorLine,
      /\bscope\s+(\w+)\s*\{/,
    );
  }

  static getCurrentFunction(
    source: string,
    cursorLine: number,
  ): string | null {
    return ScopeTracker.getContext(
      source,
      cursorLine,
      /(?:public\s+)?(?:\w+)\s+(\w+)\s*\([^)]*\)\s*\{/,
    );
  }
}
