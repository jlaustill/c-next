import { describe, it, expect } from "vitest";
import * as fs from "node:fs";

describe("CNextCompletionProvider", () => {
  it("should not write debug files to /tmp", () => {
    const source = fs.readFileSync(
      new URL("../completionProvider.ts", import.meta.url),
      "utf-8",
    );
    expect(source).not.toContain("/tmp/cnext-completions.txt");
    expect(source).not.toContain("/tmp/cnext-workspace-symbols.txt");
  });
});
