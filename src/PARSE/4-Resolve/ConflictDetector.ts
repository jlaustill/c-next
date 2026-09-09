/**
 * Symbol conflicts — one of the twelve Tier 2 cross-file facts (#1511).
 *
 * A conflict is cross-file by construction: it exists only when two files
 * define the same name, so no per-file pass can see one. It lived on
 * `SymbolTable` because that is where symbols accumulated, which made the fact
 * a property of an accumulator rather than of the program — the answer depended
 * on how much had been inserted by the time it was asked.
 *
 * This detector holds no state. It is handed the three languages' symbols and
 * returns the conflicts among them, so the same input always yields the same
 * answer. `Program` supplies that input, and after 1.4 nothing else derives it.
 *
 * The three arrays stay separate rather than arriving pre-merged. Report order
 * is name-first-seen across C-Next, then C, then C++, and each name's
 * definitions are listed in that same language order. Both orderings are
 * observable — they decide which definition a diagnostic reports at — so
 * merging at the call site would hand an unstated invariant to every caller.
 */

import DeclarationSite from "../../utils/DeclarationSite";
import ScopeUtils from "../../utils/ScopeUtils";
import SymbolRegistry from "../../transpiler/state/SymbolRegistry";
import ESourceLanguage from "../../utils/types/ESourceLanguage";
import type IConflict from "../../transpiler/types/IConflict";
import type TSymbol from "../../transpiler/types/symbols/TSymbol";
import type TCSymbol from "../../transpiler/types/symbols/c/TCSymbol";
import type TCppSymbol from "../../transpiler/types/symbols/cpp/TCppSymbol";
import type TAnySymbol from "../../transpiler/types/symbols/TAnySymbol";

class ConflictDetector {
  /**
   * Every conflict among these symbols.
   *
   * Names are visited in the order first seen — C-Next, then C, then C++ — and
   * each name's definitions gathered in that same order.
   */
  static detect(
    cnext: ReadonlyArray<TSymbol>,
    c: ReadonlyArray<TCSymbol>,
    cpp: ReadonlyArray<TCppSymbol>,
  ): IConflict[] {
    const cnextByName = ConflictDetector.indexByName(cnext);
    const cByName = ConflictDetector.indexByName(c);
    const cppByName = ConflictDetector.indexByName(cpp);

    const conflicts: IConflict[] = [];
    const allNames = new Set<string>();
    for (const name of cnextByName.keys()) allNames.add(name);
    for (const name of cByName.keys()) allNames.add(name);
    for (const name of cppByName.keys()) allNames.add(name);

    for (const name of allNames) {
      const symbols = ConflictDetector.overloadsOf(
        name,
        cnextByName,
        cByName,
        cppByName,
      );
      if (symbols.length <= 1) continue;

      const conflict = ConflictDetector.detectConflict(symbols);
      if (conflict) {
        conflicts.push(conflict);
      }
    }

    return conflicts;
  }

  /**
   * Whether this one name is in conflict.
   *
   * The same question `detect` answers, asked of a single name. Kept as its own
   * entry point because a caller wanting yes/no should not have to know that a
   * C-Next duplicate is reported under its `cnxScopedName` rather than under
   * the name asked about.
   */
  static hasConflict(
    name: string,
    cnext: ReadonlyArray<TSymbol>,
    c: ReadonlyArray<TCSymbol>,
    cpp: ReadonlyArray<TCppSymbol>,
  ): boolean {
    const symbols = ConflictDetector.overloadsOf(
      name,
      ConflictDetector.indexByName(cnext),
      ConflictDetector.indexByName(c),
      ConflictDetector.indexByName(cpp),
    );
    if (symbols.length <= 1) {
      return false;
    }

    return ConflictDetector.detectConflict(symbols) !== null;
  }

  /** Every definition of one name, in C-Next, then C, then C++ order. */
  private static overloadsOf(
    name: string,
    cnextByName: ReadonlyMap<string, TAnySymbol[]>,
    cByName: ReadonlyMap<string, TAnySymbol[]>,
    cppByName: ReadonlyMap<string, TAnySymbol[]>,
  ): TAnySymbol[] {
    return [
      ...(cnextByName.get(name) ?? []),
      ...(cByName.get(name) ?? []),
      ...(cppByName.get(name) ?? []),
    ];
  }

  /**
   * Bare name to its definitions, insertion-ordered.
   *
   * Bare, not transpiled: a scoped member is found by the name it carries
   * inside its scope, which is the name a colliding C symbol would share.
   */
  private static indexByName(
    symbols: ReadonlyArray<TAnySymbol>,
  ): Map<string, TAnySymbol[]> {
    const index = new Map<string, TAnySymbol[]>();
    for (const symbol of symbols) {
      const existing = index.get(symbol.name);
      if (existing) {
        existing.push(symbol);
      } else {
        index.set(symbol.name, [symbol]);
      }
    }
    return index;
  }

  /**
   * Issue #221: function parameters must not count as conflicting definitions.
   * They have a parent, but their name is not qualified with the parent prefix.
   *
   * Only C/C++ symbols are filtered. A C-Next variable is always kept: at this
   * point a scope-level variable and a function parameter are indistinguishable,
   * so the original code returned true down both of its branches.
   */
  private static isNotFunctionParameter(def: TAnySymbol): boolean {
    if (
      def.sourceLanguage === ESourceLanguage.CNext &&
      def.kind === "variable"
    ) {
      return true;
    }
    if ("parent" in def && def.parent) {
      // A non-variable with a parent is a real definition; a variable with a
      // parent may be a function parameter, so it is dropped.
      return def.kind !== "variable";
    }
    return true;
  }

  /**
   * True when every definition is a C++ function and all their signatures
   * differ -- overloads, which are legal rather than a conflict.
   *
   * Currently redundant (#1180): no path in detectConflict reports a conflict
   * between two C++ symbols, so an all-C++ group returns null whether this
   * short-circuits or falls through. Verified by mutation -- forcing this to
   * false left all 49 of the then-owner's tests passing. Carried here
   * rather than deleted, because which way to resolve it (drop the branch, or
   * add the same-signature conflict it implies) is a behavior decision.
   */
  private static areAllDistinctCppOverloads(
    globalDefinitions: TAnySymbol[],
  ): boolean {
    const cppFunctions = globalDefinitions.filter(
      (s) =>
        s.sourceLanguage === ESourceLanguage.Cpp &&
        s.kind === "function" &&
        "parameters" in s,
    );
    if (cppFunctions.length !== globalDefinitions.length) {
      return false;
    }

    const signatures = cppFunctions.map((f) => {
      if ("parameters" in f && f.parameters) {
        const params = f.parameters as ReadonlyArray<{ type?: string }>;
        return params.map((p) => p.type ?? "").join(",");
      }
      return "";
    });
    return new Set(signatures).size === cppFunctions.length;
  }

  /**
   * The blocks declaring the scope these symbols belong to, or "" at global scope.
   *
   * #1334: ADR-016 lets a scope be reopened, so the members that collide may sit
   * in different blocks of a scope spread across several files. Naming only the
   * member definitions leaves the reader to find those blocks themselves.
   */
  private static scopeDeclarationNote(symbol: TSymbol): string {
    // #1298: the symbol names its scope by path; the object -- and the mutable
    // `declarationSites` on it -- is one registry lookup away.
    const scope = SymbolRegistry.getScope(symbol.scopePath);
    // The global-scope disjunct is stated, not merely implied. It never decides
    // the result -- the only `declarationSites` writer targets a grammar-
    // guaranteed non-empty identifier, so the global scope's set is always empty
    // and the third disjunct would catch it -- but "a global symbol gets no
    // declaration note" is the intent, and `getScope("")` returns the global
    // scope object rather than null, so nothing else says it (#1298 review).
    if (
      scope === null ||
      ScopeUtils.isGlobalScopePath(symbol.scopePath) ||
      scope.declarationSites.size === 0
    ) {
      return "";
    }
    // Sorted through DeclarationSite, not `.sort()`: these keys end in a line
    // number, and a text sort orders `:10` ahead of `:3` (SonarCloud S2871).
    const sites = [...scope.declarationSites]
      .sort(DeclarationSite.compare)
      .map(DeclarationSite.displaySite);
    // Indented: the CLI's error format treats an unindented line as a new
    // diagnostic, so an unindented header here is dropped by any consumer that
    // parses stderr -- including the test harness, which kept the sites and lost
    // the sentence introducing them.
    return `\n  scope '${scope.name}' is declared in:\n    ${sites.join("\n    ")}`;
  }

  /**
   * The language a definition came from, as a reader knows it.
   *
   * Private because this detector is the only consumer today; promote it beside
   * ESourceLanguage if a second one appears.
   */
  private static languageName(symbol: TAnySymbol): string {
    const names: Record<ESourceLanguage, string> = {
      [ESourceLanguage.CNext]: "C-Next",
      [ESourceLanguage.C]: "C",
      [ESourceLanguage.Cpp]: "C++",
    };
    return names[symbol.sourceLanguage];
  }

  /**
   * Where a definition is, as a symbol carries it.
   *
   * #1334: the two conflict producers formatted this differently, so the same fact
   * printed two ways depending on which path found it. The rendering itself lives
   * in DeclarationSite -- see there for why it is a basename and why the ordering
   * needs a comparator.
   *
   * Line-granular ON PURPOSE, not for want of a column. #1318 gave every symbol a
   * `span`, and the three diagnostics below report `span.column`; this renders the
   * `file:line` form that `declarationSites` is keyed on, so adding a column here
   * would stop the two matching. (This comment previously claimed symbols carried
   * no column, and was stacked above `languageName` rather than this function.)
   */
  private static locationOf(symbol: TAnySymbol): string {
    return DeclarationSite.display(symbol.sourceFile, symbol.span.line);
  }

  /**
   * Detect if a set of symbols with the same name represents a conflict
   */
  private static detectConflict(symbols: TAnySymbol[]): IConflict | null {
    // Filter out pure declarations (extern in C) - they don't count as definitions
    const definitions = symbols.filter(
      (s) => !("isDeclaration" in s && s.isDeclaration),
    );

    if (definitions.length <= 1) {
      // 0 or 1 definitions = no conflict
      return null;
    }

    const globalDefinitions = definitions.filter(
      ConflictDetector.isNotFunctionParameter,
    );

    if (globalDefinitions.length <= 1) {
      return null;
    }

    if (ConflictDetector.areAllDistinctCppOverloads(globalDefinitions)) {
      return null;
    }

    // Check for cross-language conflict (C-Next vs C or C++)
    const cnextDefs = globalDefinitions.filter(
      (s) => s.sourceLanguage === ESourceLanguage.CNext,
    );
    const cDefs = globalDefinitions.filter(
      (s) => s.sourceLanguage === ESourceLanguage.C,
    );
    const cppDefs = globalDefinitions.filter(
      (s) => s.sourceLanguage === ESourceLanguage.Cpp,
    );

    // Issue #967: Only global-scope C-Next symbols can conflict with C/C++ symbols.
    // Scoped symbols (e.g., Touch.read) live in a namespace and don't compete
    // with C's global symbols (e.g., POSIX read()).
    const conflictingCnextDefs = cnextDefs.filter((s) => {
      const tSymbol = s as TSymbol;
      return ScopeUtils.isGlobalScopePath(tSymbol.scopePath);
    });

    if (
      conflictingCnextDefs.length > 0 &&
      (cDefs.length > 0 || cppDefs.length > 0)
    ) {
      const conflictingDefs = [...conflictingCnextDefs, ...cDefs, ...cppDefs];
      // #1334: both conflict kinds render the location the same way, through
      // `locationOf` -- these producers used to spell it differently (`LANG
      // (file:line)` here, bare `file:line` below), which is one decision written
      // twice. Only the language ANNOTATION is branch-specific, and it has to stay:
      // the message says the definitions are in multiple languages but not which is
      // which, and for a `.h` the reader cannot tell C from C++ -- the very
      // distinction detectAssemblySyntax points users at this message for.
      //
      // Deduplicated because one C declaration can yield two symbols at one position
      // (`typedef struct {...} helper;` registers both the tag and the alias), which
      // printed the same file:line twice and told the reader nothing.
      const locations = [
        ...new Set(
          conflictingDefs.map(
            (definition) =>
              `${ConflictDetector.locationOf(definition)} (${ConflictDetector.languageName(definition)})`,
          ),
        ),
      ];

      return {
        code: "E0425",
        symbolName: conflictingDefs[0].name,
        definitions: conflictingDefs,
        severity: "error",
        sourceFile: conflictingDefs[0].sourceFile,
        line: conflictingDefs[0].span.line,
        // #1318: the symbol's own column. This was hardcoded 0 because no
        // symbol carried one -- the Tier 1 table promised a symbol-level
        // diagnostic could point as precisely as any other, and it could not.
        column: conflictingDefs[0].span.column,
        // The remediation line is INDENTED like the locations. The CLI's error format
        // treats an unindented line as the start of a new diagnostic, so an
        // unindented sentence here is dropped by any consumer that parses stderr --
        // including the test harness, which would capture the locations and silently
        // lose this line (scripts/test-utils.ts, continuation-line branch).
        message: `Symbol conflict: '${conflictingDefs[0].name}' is defined in multiple languages:\n  ${locations.join("\n  ")}\n  Rename the C-Next symbol to resolve.`,
      };
    }

    // Multiple definitions in same language (excluding overloads) = ERROR
    const cnextConflict = ConflictDetector.detectCNextDuplicate(cnextDefs);
    if (cnextConflict) {
      return cnextConflict;
    }

    // Same symbol in C and C++ - typically OK (same symbol)
    if (cDefs.length > 0 && cppDefs.length > 0) {
      return null;
    }

    return null;
  }

  /**
   * Two definitions of the same C-Next symbol in the same scope = ERROR.
   *
   * Issue #817: grouped by scope AND kind — symbols in different scopes do not
   * conflict (`Foo.enabled` and `Bar.enabled` generate distinct C names), and
   * symbols of different kinds do not either (a variable `LED` and a scope `LED`
   * are distinct).
   *
   * Extracted from detectConflict so that method stays under SonarCloud's
   * cognitive-complexity limit; the #1333 scope-reopening branch pushed it over.
   */
  private static detectCNextDuplicate(
    cnextDefs: TAnySymbol[],
  ): IConflict | null {
    if (cnextDefs.length <= 1) {
      return null;
    }

    const byScopeAndKind =
      ConflictDetector.groupCNextSymbolsByScopeAndKind(cnextDefs);

    for (const symbols of byScopeAndKind.values()) {
      if (symbols.length <= 1) {
        continue;
      }

      // #1333: a scope declaration is not a definition in the sense this rule
      // means. Declaring `scope Lib` a second time REOPENS it and adds members;
      // it does not redefine it -- the model ADR-002:256 described ("one
      // namespace can span files") and ADR-016 now carries forward. Without
      // this, a scope could not be split across files, and could not even be
      // reopened within one file, which defeats the organizational purpose
      // scopes exist for.
      //
      // Members still conflict normally: they are grouped by the scope's own
      // identity, so two `Lib.useIt` definitions collide whichever block they
      // were written in.
      if (symbols[0].kind === "scope") {
        continue;
      }

      const locations = symbols.map(ConflictDetector.locationOf);
      // #1285: the symbol's own source-language name. This was built here by
      // hand from `scope.name`, which is the leaf -- at depth two it reported
      // `Inner.tick` for a symbol the author writes as `Outer.Inner.tick`.
      const displayName = symbols[0].cnxScopedName;
      // #1334: when the members belong to a scope, name where that scope is
      // DECLARED as well as where the members are defined. A scope spanning four
      // files is where a duplicate member is hardest to find, and the blocks are
      // exactly what the reader needs to look through.
      //
      // This is also what makes declarationSites observable: without a consumer
      // it would be a write-only field, testable only by unit tests that reach
      // into it -- the shape #1330's review caught as a method with no caller.
      const scopeSites = ConflictDetector.scopeDeclarationNote(symbols[0]);
      return {
        code: "E0425",
        symbolName: displayName,
        definitions: symbols,
        severity: "error",
        // Report at the first offending definition. Each symbol carries its own
        // position, so a member declared in two blocks of a scope spanning four
        // files names the block it actually came from (#1334).
        sourceFile: symbols[0].sourceFile,
        line: symbols[0].span.line,
        // #1318: the symbol's own column, not a hardcoded 0.
        column: symbols[0].span.column,
        message: `Symbol conflict: '${displayName}' is defined multiple times in C-Next:\n  ${locations.join("\n  ")}${scopeSites}`,
      };
    }

    return null;
  }

  /**
   * Issue #817: Group C-Next symbols by scope name and kind.
   *
   * Symbols in different scopes don't conflict (Foo.enabled vs Bar.enabled
   * generate Foo_enabled and Bar_enabled). Symbols with different kinds also
   * don't conflict (variable LED vs scope LED are distinct).
   *
   * @param symbols C-Next symbols to group (must all be TSymbol)
   * @returns Map from "scopeName:kind" key to array of symbols
   */
  private static groupCNextSymbolsByScopeAndKind(
    symbols: TAnySymbol[],
  ): Map<string, TSymbol[]> {
    const byScopeAndKind = new Map<string, TSymbol[]>();

    for (const def of symbols) {
      const tSymbol = def as TSymbol;
      // #1285: key on the scope's own identity, not its leaf name. Two distinct
      // scopes can share a leaf (`Outer.Inner` and `Other.Inner`), and keying on
      // the leaf grouped their members together -- reporting a conflict between
      // symbols that never shared a scope. #1298: the path IS that identity, and
      // is injective for the same reason the C name was.
      const key = `${tSymbol.scopePath}:${tSymbol.kind}`;
      const existing = byScopeAndKind.get(key);
      if (existing) {
        existing.push(tSymbol);
      } else {
        byScopeAndKind.set(key, [tSymbol]);
      }
    }

    return byScopeAndKind;
  }
}

export default ConflictDetector;
