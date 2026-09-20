/**
 * #1486: the bitmap field-layout shape has ONE name, and re-spelling it inline
 * is caught rather than noticed.
 *
 * `{ offset, width }` was written out independently at several sites. Adding a
 * third property meant editing every one of them in lockstep -- the
 * duplicate-path shape CLAUDE.md calls the project's worst. `ac629823` named
 * it `IBitmapFieldLayout` and converted the sites it found.
 *
 * ## Why this is a gate and not a review habit
 *
 * Because that conversion was INCOMPLETE, which is a different failure from
 * the one this comment used to claim and needs a different guard. Checked with
 * git rather than recalled: `IMergeAccumulator.bitmapFields` carried the inline
 * spelling from `40ac769a` (2026-08-28) and `9c66c045` only relocated the file
 * it lived in; `generateBitmapHeader.test.ts` had carried it since `a79fea74`
 * (2026-01-17). Both PREDATE `ac629823` (2026-09-04). Nothing regressed -- two
 * sites were missed, and stayed missed for months with every check green.
 *
 * That is the argument for a standing gate rather than a careful sweep: a
 * sweep cannot prove itself exhaustive, and `tsc` will never object, because
 * the shapes are structurally identical -- which is exactly the property that
 * makes the duplicate invisible. `IBitmapFieldLayout`'s own doc comment names
 * that failure mode: converting only the consumers "would have left the
 * lockstep intact and made the converted maps flow into unconverted
 * signatures, type-checking by structural typing alone -- agreement by
 * coincidence".
 *
 * It also sets the gate's priority: since the defect is missed COVERAGE, the
 * scan roots matter more than the shape predicate, which is why they are taken
 * from `knip.json` instead of restated here.
 *
 * A behavioral fixture cannot hold this. Two structurally identical types emit
 * byte-identical C, so there is no output for a snapshot to differ on. The
 * honest artifact is structural, the way `analysis-is-a-pass.test.ts` asserts
 * over the call graph and `layer-rules.test.ts` over the depcruise rules.
 *
 * ## What it checks, exactly
 *
 * An interface, type literal or class declaring BOTH `offset: number` and
 * `width: number` among its OWN properties, anywhere in the authored sources
 * `knip.json` names.
 *
 * `ALLOWED` is keyed by PATH, not by name. An exemption is a claim about one
 * declaration; a name-keyed list exempts the name repo-wide, including a
 * second copy carrying it -- the likeliest way this recurs, since a copy is
 * usually a copy of the name too, and the cheapest way to silence a red gate.
 *
 * ## What it deliberately does not catch
 *
 * The predicate is syntactic, so these evade it and are recorded rather than
 * claimed away: a property typed through an alias (`type Bits = number`), the
 * shape split across `extends` or an intersection, and any other pair of
 * property names. Catching those needs resolved types, hence the whole
 * program, which is a cost this gate does not earn.
 */

import { readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { Project, SyntaxKind } from "ts-morph";
import type { Node, SourceFile } from "ts-morph";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

/** The one name for the projected `{ offset, width }` shape. */
const LAYOUT_TYPE = "IBitmapFieldLayout";

/**
 * The declarations permitted to carry both properties, keyed by the file that
 * declares them. Adding an entry is a review decision, not a fix.
 *
 * One entry, because there is one such shape. `IBitmapFieldSymbol` used to need
 * a second: it restated `offset` and `width` verbatim, so adding a third
 * property to the layout still meant editing two files in lockstep -- the gate
 * standing green over the exact defect it was written for. It now composes
 * `IBitmapFieldLayout` instead, which is why it no longer appears here.
 */
const ALLOWED = new Map<string, string>([
  ["src/transpiler/types/IBitmapFieldLayout.ts", LAYOUT_TYPE],
]);

/** The two properties whose co-occurrence IS the layout shape. */
const SHAPE = ["offset", "width"] as const;

/** Declaration kinds that can carry own properties. */
const SHAPE_BEARING = [
  SyntaxKind.InterfaceDeclaration,
  SyntaxKind.TypeLiteral,
  SyntaxKind.ClassDeclaration,
] as const;

/** Where a declaration carrying the shape was found. */
interface IShapeSite {
  /** Repo-relative path, e.g. `src/x/Y.ts`. */
  readonly file: string;
  /** Repo-relative path and line, e.g. `src/x/Y.ts:45`. */
  readonly where: string;
  /** The declaration's name, or `(inline)` for an anonymous type literal. */
  readonly name: string;
}

/**
 * The authored TypeScript sources, taken from `knip.json` rather than restated.
 *
 * `knip.json` already answers "which files are authored source" for the whole
 * repo -- `project` names the roots and `ignore` removes the generated
 * parsers. Restating either here would make a fourth spelling of that list
 * (after knip, `.jscpd.json` and `oxlint:check`), so a new source root or a
 * moved parser output would need a lockstep edit, which is the anti-pattern
 * this gate exists to police.
 *
 * It also fixes a hole a hand-written list had: `!**\/grammar\/**` is
 * path-agnostic, so an AUTHORED directory named `grammar` anywhere under the
 * roots was silently never scanned. knip names the three generated paths
 * exactly.
 *
 * Note what this inherits: knip ignores `tests/**`, so the dozen authored
 * harnesses there are outside the scan. That is the repo's existing definition
 * of authored source, and following it is the point -- one list to change.
 */
function authoredGlobs(): { positive: string[]; all: string[] } {
  const knip = JSON.parse(
    readFileSync(join(repoRoot, "knip.json"), "utf-8"),
  ) as { project: string[]; ignore: string[] };

  const positive = knip.project.map((pattern) => join(repoRoot, pattern));
  const negative = knip.ignore.map((pattern) => `!${join(repoRoot, pattern)}`);
  return { positive, all: [...positive, ...negative] };
}

/**
 * Files that could declare the shape, parsed; the rest are never parsed.
 *
 * A file whose text lacks either property name cannot declare the shape, so
 * skipping it is exact for what this gate checks. It matters: parsing every
 * source costs ~1s on every `vitest run` and ~3.5s under `--coverage`, against
 * ~50 files here. The ceiling is a unicode-escaped identifier, which is
 * already outside a syntactic check.
 */
function candidateSources(project: Project, paths: string[]): SourceFile[] {
  return paths
    .filter((path) => {
      const text = readFileSync(path, "utf-8");
      return SHAPE.every((property) => text.includes(property));
    })
    .map((path) => project.addSourceFileAtPath(path));
}

/**
 * The names of a declaration's own `: number` properties.
 *
 * One extraction for all three declaration kinds, deliberately. Two
 * member-extraction paths that must agree is the duplicate path this gate
 * forbids, and the two it used to have had already diverged -- an interface's
 * `getProperties()` skips an accessor member that a type literal's
 * `getMembers()` returns.
 *
 * Constructor parameter properties are descended into. A `readonly offset:
 * number` in a constructor signature declares an own property exactly like a
 * field does, but the node is a `Parameter` under the `Constructor` rather than
 * a `PropertyDeclaration` under the class, so a walk of the class's direct
 * children never reaches it. That is live house style here, not a hypothetical
 * -- 17 non-test files declare one, most of them analyzers -- so leaving it out
 * would have been a claimed-away hole rather than a recorded one, in a gate
 * whose whole argument is that a sweep cannot prove itself exhaustive.
 * `getModifiers().length` is what separates a parameter property from a plain
 * constructor parameter, which declares nothing.
 */
function numericPropertyNames(container: Node): Set<string> {
  const names = new Set<string>();
  const members = container
    .forEachChildAsArray()
    .flatMap(
      (child) =>
        child.asKind(SyntaxKind.Constructor)?.getParameters() ?? [child],
    );
  for (const child of members) {
    const parameter = child.asKind(SyntaxKind.Parameter);
    const property =
      child.asKind(SyntaxKind.PropertySignature) ??
      child.asKind(SyntaxKind.PropertyDeclaration) ??
      (parameter?.getModifiers().length ? parameter : undefined);
    if (property?.getTypeNode()?.getText() === "number") {
      names.add(property.getName());
    }
  }
  return names;
}

/** The declaration's own name, or its type alias's, or `(inline)`. */
function declarationName(container: Node): string {
  return (
    container.asKind(SyntaxKind.InterfaceDeclaration)?.getName() ??
    container.asKind(SyntaxKind.ClassDeclaration)?.getName() ??
    container.getParent()?.asKind(SyntaxKind.TypeAliasDeclaration)?.getName() ??
    "(inline)"
  );
}

/** Every declaration in the authored sources carrying the layout shape. */
function shapeSites(sources: readonly SourceFile[]): IShapeSite[] {
  const found: IShapeSite[] = [];

  for (const source of sources) {
    const file = relative(repoRoot, source.getFilePath());

    for (const kind of SHAPE_BEARING) {
      for (const container of source.getDescendantsOfKind(kind)) {
        const numeric = numericPropertyNames(container);
        if (!SHAPE.every((property) => numeric.has(property))) continue;
        found.push({
          file,
          where: `${file}:${container.getStartLineNumber()}`,
          name: declarationName(container),
        });
      }
    }
  }

  return found;
}

describe("one name for the bitmap field-layout shape (#1486)", () => {
  const { positive, all } = authoredGlobs();
  const project = new Project({
    skipAddingFilesFromTsConfig: true,
    skipFileDependencyResolution: true,
  });
  const paths = project.getFileSystem().globSync(all);
  const sites = shapeSites(candidateSources(project, paths));

  it.each(positive)("scans the source root %s", (pattern) => {
    // Vacuity guard, per root. The offender assertion passes on an empty scan,
    // and the previous guard could not see this: it asserted that the allowed
    // NAMES were found, and every allowed name lives under `src/`, so a root
    // that silently matched zero files kept the gate green over it. That is
    // the `// test-no-warnings` failure (#1143) one level up -- a guard that
    // cannot fail on the case it exists for.
    expect(
      project.getFileSystem().globSync([pattern]).length,
      `the source root ${pattern} matched no files, so this gate scans ` +
        `nothing there. Did the roots move, or did knip.json change?`,
    ).toBeGreaterThan(0);
  });

  it(`finds exactly one ${LAYOUT_TYPE}`, () => {
    // Not `arrayContaining`: that checks presence, never multiplicity, so a
    // SECOND declaration of the allowed name read identically to one. Naming
    // the copy `IBitmapFieldLayout` was therefore the cheapest way to silence
    // this gate, which is the opposite of what an allow-list is for.
    expect(
      sites.filter((site) => site.name === LAYOUT_TYPE).map((s) => s.where),
      `expected exactly one declaration of ${LAYOUT_TYPE}. Zero means it was ` +
        `renamed or deleted; two or more means a copy was made instead of an ` +
        `import, which is the duplicate this gate exists to catch.`,
    ).toHaveLength(1);
  });

  it("no other declaration spells the shape", () => {
    const offenders = sites.filter(
      (site) => ALLOWED.get(site.file) !== site.name,
    );

    expect(
      offenders.map((site) => `${site.where} (${site.name})`),
      `these declare { offset: number; width: number } instead of using ` +
        `${LAYOUT_TYPE}. Two structurally identical types type-check against ` +
        `each other, so this is agreement by coincidence -- adding a third ` +
        `property means editing every one of them in lockstep. Import ` +
        `${LAYOUT_TYPE} from transpiler/types/, which every layer may depend ` +
        `on. If the declaration is genuinely a different thing that happens ` +
        `to carry an offset and a width, add its PATH to ALLOWED with the ` +
        `reason -- do not reuse an allowed name to quiet this.`,
    ).toEqual([]);
  });
});
