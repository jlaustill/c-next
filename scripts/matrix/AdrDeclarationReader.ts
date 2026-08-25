/**
 * Issue #1219: reads every ADR's declared matrix from a decisions directory.
 *
 * Separate from the CLI so the drop/keep decision is testable. That decision is
 * load-bearing: an ADR silently dropped here takes every obligation it declared
 * with it, and the gate still reports "satisfied".
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import AdrMatrixDeclaration from "./AdrMatrixDeclaration";
import IMatrixDeclaration from "../types/IMatrixDeclaration";

const ADR_FILENAME = /^adr-(\d{3})-.*\.md$/;

/**
 * Parse the matrix declaration out of every `adr-NNN-*.md` in `decisionsDir`.
 *
 * An ADR with no `MATRIX-SEVERITY` marker takes no part and is omitted. An ADR
 * that HAS the marker is always included, even when nothing could be read from
 * it -- "declares a matrix I could not parse" and "declares no matrix" are
 * different facts, and only the first is a fault. Collapsing them is how a
 * malformed table removes every obligation without a word.
 */
function read(decisionsDir: string): Map<string, IMatrixDeclaration> {
  const declarations = new Map<string, IMatrixDeclaration>();
  if (!existsSync(decisionsDir)) return declarations;

  for (const entry of readdirSync(decisionsDir).sort()) {
    const match = ADR_FILENAME.exec(entry);
    if (match === null) continue;

    const adr = match[1];
    const markdown = readFileSync(join(decisionsDir, entry), "utf-8");
    const declaration = AdrMatrixDeclaration.parse(markdown, adr);

    if (declaration.severities.size > 0 || declaration.errors.length > 0) {
      declarations.set(adr, declaration);
      continue;
    }

    if (!markdown.includes(AdrMatrixDeclaration.SEVERITY_MARKER)) continue;

    declarations.set(adr, {
      ...declaration,
      errors: [
        `ADR-${adr}: MATRIX-SEVERITY marker present but no cell could be read`,
      ],
    });
  }

  return declarations;
}

class AdrDeclarationReader {
  static read = read;
}

export default AdrDeclarationReader;
