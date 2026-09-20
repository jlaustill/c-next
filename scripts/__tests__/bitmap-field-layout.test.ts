/**
 * #1486: the bitmap field-layout shape has ONE name, and re-spelling it inline
 * is caught rather than noticed.
 *
 * `{ offset, width }` was written out independently at five sites. Adding a
 * third property meant editing five places in lockstep -- the duplicate-path
 * shape CLAUDE.md calls the project's worst. `ac629823` named it
 * `IBitmapFieldLayout` and converted every site that existed then.
 *
 * ## Why this is a gate and not a review habit
 *
 * It came back. `9c66c045` (2026-09-09, `refactor(#1511)`) reintroduced the
 * inline spelling in `IMergeAccumulator.bitmapFields` five days after the
 * conversion landed, and nothing went red: `tsc` accepts it because the shapes
 * are structurally identical, which is exactly the property that makes the
 * duplicate invisible. `IBitmapFieldLayout`'s own doc comment names that
 * failure mode -- converting only the consumers "would have left the lockstep
 * intact and made the converted maps flow into unconverted signatures,
 * type-checking by structural typing alone -- agreement by coincidence".
 *
 * A behavioral fixture cannot hold this. Two structurally identical types emit
 * byte-identical C, so there is no output for a snapshot to differ on. The
 * honest artifact is structural, the way `analysis-is-a-pass.test.ts` asserts
 * over the call graph and `layer-rules.test.ts` over the depcruise rules.
 *
 * ## What it forbids, and what it deliberately allows
 *
 * Any declaration carrying BOTH `offset: number` and `width: number`, other
 * than the two in `ALLOWED`. The allow-list is the place a second shape gets
 * justified in review -- an entry is a claim that the declaration is NOT a
 * duplicate, the same way an ADR's `off` cell is a claim a context cannot
 * exist.
 *
 * `IBitmapFieldSymbol` is allowed on purpose and is not an oversight: #1318
 * chose projection over widening, so the SYMBOL (with its `kind`
 * discriminator) and the projected LAYOUT are two deliberate types, not one
 * restated. `IBitmapFieldLayout`'s doc comment records that decision.
 */

import { join } from "node:path";
import { Project, SyntaxKind } from "ts-morph";
import type { SourceFile } from "ts-morph";

const repoRoot = join(__dirname, "..", "..");

/** The one name for the projected `{ offset, width }` shape. */
const LAYOUT_TYPE = "IBitmapFieldLayout";

/**
 * Declarations permitted to carry both properties, and why each is not a
 * duplicate of the other. Adding an entry is a review decision, not a fix.
 */
const ALLOWED = new Map<string, string>([
  [LAYOUT_TYPE, "the one name -- every other site refers to this"],
  [
    "IBitmapFieldSymbol",
    "the symbol, not the projection -- #1318 chose projection over widening",
  ],
]);

/** Where a declaration carrying the shape was found. */
interface IShapeSite {
  /** Repo-relative path and line, e.g. `src/x/Y.ts:45`. */
  readonly where: string;
  /** The declaration's name, or `(inline)` for an anonymous type literal. */
  readonly name: string;
}

/**
 * Every authored TypeScript file, added by glob rather than through the
 * tsconfig graph.
 *
 * `unused-code.ts` discovers its programs from the tsconfig files on disk so a
 * fourth program is covered the day it is added. The same reasoning applies one
 * level down: globbing the source roots means a file outside every tsconfig
 * `include` is still scanned, where following the graph would skip it silently.
 * Generated parsers are excluded -- they are outputs, and nothing in them is
 * authored.
 */
function authoredSources(): SourceFile[] {
  const project = new Project({
    skipAddingFilesFromTsConfig: true,
    skipFileDependencyResolution: true,
    compilerOptions: { allowJs: false },
  });
  project.addSourceFilesAtPaths([
    join(repoRoot, "src/**/*.ts"),
    join(repoRoot, "scripts/**/*.ts"),
    join(repoRoot, "prettier-plugin/**/*.ts"),
    `!${join(repoRoot, "**/node_modules/**")}`,
    `!${join(repoRoot, "**/grammar/**")}`,
  ]);
  return project.getSourceFiles();
}

/** True when these property signatures include `offset: number` and `width: number`. */
function carriesShape(
  members: readonly { name: string; type: string }[],
): boolean {
  const numeric = new Set(
    members.filter((m) => m.type === "number").map((m) => m.name),
  );
  return numeric.has("offset") && numeric.has("width");
}

/** Every declaration in the repo carrying the layout shape. */
function shapeSites(): IShapeSite[] {
  const found: IShapeSite[] = [];

  for (const source of authoredSources()) {
    const rel = source.getFilePath().replace(`${repoRoot}/`, "");

    const record = (name: string, line: number): void => {
      found.push({ where: `${rel}:${line}`, name });
    };

    for (const declaration of source.getDescendantsOfKind(
      SyntaxKind.InterfaceDeclaration,
    )) {
      const members = declaration.getProperties().map((property) => ({
        name: property.getName(),
        type: property.getTypeNode()?.getText() ?? "",
      }));
      if (carriesShape(members)) {
        record(declaration.getName(), declaration.getStartLineNumber());
      }
    }

    // Anonymous `{ offset: number; width: number }`, wherever it appears --
    // a field's type, a parameter, a type argument. This is the shape the
    // regression took, so it is the one the gate must not miss.
    for (const literal of source.getDescendantsOfKind(SyntaxKind.TypeLiteral)) {
      const members = literal.getMembers().map((member) => {
        const property = member.asKind(SyntaxKind.PropertySignature);
        return {
          name: property?.getName() ?? "",
          type: property?.getTypeNode()?.getText() ?? "",
        };
      });
      if (carriesShape(members)) {
        record(
          literal
            .getParent()
            ?.asKind(SyntaxKind.TypeAliasDeclaration)
            ?.getName() ?? "(inline)",
          literal.getStartLineNumber(),
        );
      }
    }
  }

  return found;
}

describe("one name for the bitmap field-layout shape (#1486)", () => {
  const sites = shapeSites();

  it("finds the allowed declarations at all", () => {
    // Vacuity guard: renaming or moving `IBitmapFieldLayout` would otherwise
    // empty the scan and make every assertion below pass on nothing, which is
    // the `// test-no-warnings` failure (#1143) at the gate level.
    expect(
      sites.map((site) => site.name),
      "no declaration carrying { offset, width } was found -- the scan is " +
        "empty, so this gate cannot fail. Did the source roots move?",
    ).toEqual(expect.arrayContaining([...ALLOWED.keys()]));
  });

  it("no other declaration spells the shape", () => {
    const offenders = sites.filter((site) => !ALLOWED.has(site.name));

    expect(
      offenders.map((site) => `${site.where} (${site.name})`),
      `these declare { offset: number; width: number } instead of using ` +
        `${LAYOUT_TYPE}. Two structurally identical types type-check against ` +
        `each other, so this is agreement by coincidence -- adding a third ` +
        `property means editing every one of them in lockstep. Import ` +
        `${LAYOUT_TYPE} from transpiler/types/, which every layer may depend ` +
        `on, or add an entry to ALLOWED saying why it is genuinely a ` +
        `different type.`,
    ).toEqual([]);
  });
});
