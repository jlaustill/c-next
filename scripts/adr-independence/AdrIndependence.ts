import { readFileSync } from "node:fs";
import { basename, join } from "node:path";

import FileScanner from "../utils/FileScanner";
import IAdrIndependenceOutcome from "../types/IAdrIndependenceOutcome";
import IAdrViolation from "../types/IAdrViolation";

/**
 * The rewrite test, enforced (issue #1403).
 *
 * An ADR decides something about the C-Next language. If the transpiler were
 * rebuilt from scratch in another language and stack, every ADR must still be
 * fully applicable. `docs/decisions/README.md` holds the in/out list; this is
 * the mechanical half of it.
 *
 * The rule existed in CLAUDE.md as a bare prohibition for months and 29 of 76
 * ADRs walked past it -- five of them written after it was recorded. A rule
 * with no gate is indistinguishable from one nobody agreed to, which is why
 * this exists rather than a review checklist item.
 *
 * The transpiler identifier vocabulary is DERIVED from `src/` on every run
 * rather than maintained as a denylist. A hand-kept list would go stale in the
 * one direction that matters: a class renamed after an ADR cited it would stop
 * being detected precisely because the ADR is now wrong.
 */
class AdrIndependence {
  /** Fenced languages that only exist because of today's stack. */
  static readonly STACK_LANGUAGES: ReadonlySet<string> = new Set([
    "typescript",
    "ts",
    "javascript",
    "js",
    "json",
    "yaml",
    "yml",
    "xml",
    "bash",
    "sh",
    "shell",
  ]);

  /**
   * ANTLR actions with no meaning outside ANTLR. A grammar production is the
   * language's shape and survives a rewrite; `-> channel(HIDDEN)` does not.
   */
  static readonly ANTLR_DIRECTIVE =
    /->\s*(?:skip|channel|type|mode|pushMode|popMode)\b|^\s*@(?:header|members|lexer|parser)\b|^\s*options\s*\{/m;

  /** A source path in the current implementation. */
  static readonly SOURCE_PATH =
    /\b(?:src|scripts)\/[A-Za-z0-9_/.-]+\.(?:ts|js|mjs)\b/g;

  /**
   * Identifiers are only collected when they are long and multi-humped enough
   * that a collision with ordinary prose or a prior-art snippet is implausible.
   * `Point` or `String` in an example would otherwise be flagged.
   */
  static readonly IDENTIFIER_SHAPE = /^[A-Z][a-z]+[A-Z][A-Za-z0-9]*$/;

  static readonly MIN_IDENTIFIER_LENGTH = 7;

  /**
   * An explicit, reviewed claim that the next fenced block survives a rewrite:
   * `<!-- survives-rewrite: Rust's heapless::String, for comparison -->`.
   *
   * Needed because the in/out list admits prior art in ANY language, including
   * TypeScript, and admits language-level artifact formats -- neither of which
   * a grep can tell from implementation code. Modelled on the matrix's `off`:
   * a claim someone writes down and a reviewer can dispute, rather than an
   * inference the tool makes silently. A reason is required; the marker without
   * one does not suppress.
   */
  static readonly SURVIVES_REWRITE =
    /^\s*<!--\s*survives-rewrite:\s*\S.*-->\s*$/;

  /**
   * Exported class, interface and type names declared under `src/`.
   */
  static vocabulary(rootDir: string): Set<string> {
    const names = new Set<string>();
    const declaration =
      /^(?:export\s+default\s+|abstract\s+)?(?:class|interface|type)\s+([A-Za-z0-9_]+)/gm;

    for (const file of FileScanner.findFiles(join(rootDir, "src"), ".ts")) {
      const source = readFileSync(file, "utf-8");
      for (const match of source.matchAll(declaration)) {
        const name = match[1];
        if (
          name.length >= AdrIndependence.MIN_IDENTIFIER_LENGTH &&
          AdrIndependence.IDENTIFIER_SHAPE.test(name)
        ) {
          names.add(name);
        }
      }
    }
    return names;
  }

  /**
   * Every violation in one ADR's text, with line numbers so the report points
   * at something a reader can open.
   */
  static scanDocument(
    file: string,
    markdown: string,
    vocabulary: ReadonlySet<string>,
  ): IAdrViolation[] {
    const violations: IAdrViolation[] = [];
    const lines = markdown.split("\n");

    let fenceLanguage: string | null = null;
    let fenceStart = 0;
    let fenceBody: string[] = [];
    let claimed = false;

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      const fence = /^\s*```(\S*)/.exec(line);

      if (fence) {
        if (fenceLanguage === null) {
          fenceLanguage = (fence[1] || "").toLowerCase();
          fenceStart = index + 1;
          fenceBody = [];
          claimed = AdrIndependence.isClaimed(lines, index);
        } else {
          if (!claimed) {
            AdrIndependence.closeFence(
              violations,
              file,
              fenceLanguage,
              fenceStart,
              fenceBody,
            );
          }
          fenceLanguage = null;
          claimed = false;
        }
        continue;
      }

      if (fenceLanguage !== null) {
        fenceBody.push(line);
      }
      AdrIndependence.scanLine(violations, file, index + 1, line, vocabulary);
    }

    return violations;
  }

  /**
   * Whether the nearest non-blank line above a fence claims it survives a
   * rewrite. Looking upward past blank lines only -- a marker must sit with the
   * block it vouches for, not drift to the top of a section.
   */
  private static isClaimed(
    lines: readonly string[],
    fenceIndex: number,
  ): boolean {
    for (let index = fenceIndex - 1; index >= 0; index -= 1) {
      const line = lines[index];
      if (line.trim() === "") continue;
      return AdrIndependence.SURVIVES_REWRITE.test(line);
    }
    return false;
  }

  /** Records a stack-language block, or an ANTLR block carrying ANTLR actions. */
  private static closeFence(
    violations: IAdrViolation[],
    file: string,
    language: string,
    startLine: number,
    body: readonly string[],
  ): void {
    if (AdrIndependence.STACK_LANGUAGES.has(language)) {
      violations.push({
        file,
        line: startLine,
        kind: "fence",
        detail: `\`\`\`${language} block (${body.length} lines)`,
      });
      return;
    }
    if (
      (language === "antlr" || language === "g4") &&
      AdrIndependence.ANTLR_DIRECTIVE.test(body.join("\n"))
    ) {
      violations.push({
        file,
        line: startLine,
        kind: "directive",
        detail: "ANTLR-only action in a grammar block",
      });
    }
  }

  /** Source paths and transpiler identifiers, wherever they appear. */
  private static scanLine(
    violations: IAdrViolation[],
    file: string,
    line: number,
    text: string,
    vocabulary: ReadonlySet<string>,
  ): void {
    for (const match of text.matchAll(AdrIndependence.SOURCE_PATH)) {
      violations.push({ file, line, kind: "path", detail: match[0] });
    }
    for (const word of new Set(
      text.match(/\b[A-Za-z][A-Za-z0-9_]*\b/g) ?? [],
    )) {
      if (vocabulary.has(word)) {
        violations.push({ file, line, kind: "identifier", detail: word });
      }
    }
  }

  /**
   * Scans every ADR under `docs/decisions/`.
   *
   * There is no exemption mechanism. This landed with a shrinking baseline of 40
   * files (#1403); it reached zero on 2026-08-31 and was deleted along with the
   * branch that read it. A gate that can be opted out of eventually is.
   */
  static run(rootDir: string): IAdrIndependenceOutcome {
    const vocabulary = AdrIndependence.vocabulary(rootDir);
    const decisionsDir = join(rootDir, "docs", "decisions");

    const failures: IAdrViolation[] = [];
    let scanned = 0;

    const adrs = FileScanner.findFiles(decisionsDir, ".md")
      .filter((path) => /^adr-\d+/.test(basename(path)))
      .sort();

    for (const path of adrs) {
      scanned += 1;
      failures.push(
        ...AdrIndependence.scanDocument(
          basename(path),
          readFileSync(path, "utf-8"),
          vocabulary,
        ),
      );
    }

    return { failures, scanned };
  }
}

export default AdrIndependence;
