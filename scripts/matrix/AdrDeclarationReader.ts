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
import MatrixRule from "./MatrixRule";
import IMatrixDeclaration from "../types/IMatrixDeclaration";

const ADR_FILENAME = /^adr-(\d{3})-.*\.md$/;

/**
 * Parse the matrix declaration out of every `adr-NNN-*.md` in `decisionsDir`,
 * keyed by MatrixRule id: the ADR's own table, and one per rule table.
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

    for (const rule of AdrMatrixDeclaration.rulesIn(markdown)) {
      const ruleId = MatrixRule.id(adr, rule);
      const ruleTable = AdrMatrixDeclaration.parse(markdown, ruleId, rule);
      declarations.set(
        ruleId,
        ruleTable.severities.size > 0 || ruleTable.errors.length > 0
          ? ruleTable
          : {
              ...ruleTable,
              errors: [
                `ADR-${ruleId}: MATRIX-SEVERITY marker present but no cell could be read`,
              ],
            },
      );
    }

    // #1620: every code the ADR declares needs its own table, and every code
    // table must name a code the ADR declares. Without the first, a code with
    // no table would be gated by nothing; without the second, a typo'd code
    // table would gate a code no fixture of this ADR can assert.
    if (markdown.includes(AdrMatrixDeclaration.ANY_MARKER)) {
      const declared = AdrMatrixDeclaration.codesIn(markdown);
      const tables = new Set(AdrMatrixDeclaration.rulesIn(markdown));
      for (const code of declared) {
        if (tables.has(code)) continue;
        const codeId = MatrixRule.id(adr, code);
        declarations.set(codeId, {
          adr: codeId,
          severities: new Map(),
          errors: [
            `ADR-${adr}: declares ${code} but has no <!-- MATRIX-SEVERITY code: ${code} --> table`,
          ],
        });
      }
      for (const table of tables) {
        const codeId = MatrixRule.id(adr, table);
        if (!MatrixRule.isCode(codeId) || declared.includes(table)) continue;
        const existing = declarations.get(codeId)!;
        declarations.set(codeId, {
          ...existing,
          errors: [
            ...existing.errors,
            `ADR-${adr}: has a table for ${table}, which its code table does not declare`,
          ],
        });
      }
    }

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
