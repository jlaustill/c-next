/**
 * The pass order, as the places a module can sit in, earliest first (#1443).
 *
 * `docs/architecture/README.md` §1: "A pass may read the artifact of a
 * lower-numbered pass in its own layer, or of any earlier layer, and nothing
 * else." So each place below may reach every place before it and none after
 * it, and one rule per place says so. The rules are generated from this list
 * rather than written out because the order is ONE fact: written as pairs it
 * was eight hand-authored rules, each naming one later root, and a pair nobody
 * wrote -- 1.1 reading 1.2, PARSE reading WRITE -- was simply allowed.
 *
 * Two places are not passes. `TranspileState` (with the `ICodeGenApi` slot it
 * holds) is the per-file working state 2.2 and 2.3 both write, so it sits
 * after 2.1 -- an analyzer reaching it read whatever the previous file or RUN
 * left there, which is how #1430 suppressed E0427 and #1432 let a signed
 * subscript reach generated C at exit 0 (#1456) -- and before 2.2. And
 * `CodeGenWalker` drives 2.2 and 2.3 for one file, so it sits after 2.3. Both
 * are directly under `TRANSPILE/` by the owner's ruling on #1443, which
 * README §1 records.
 *
 * One edge into a later place is ruled, and `mayRead` names it. 1.1 lexes a
 * `.cnx` file to find its includes with 1.2's `CNextLexer`, so it and the
 * parser agree on what a comment hides (#1745, owner ruling 2026-09-30,
 * option A: discovery decides which files get parsed, so no `ParsedFile`
 * exists yet when it asks). The lexer only: the parser stays forbidden, and
 * `scripts/__tests__/pass-order.test.ts` checks both.
 *
 * Each rule is `reachable: true`: a layer boundary is a claim about what a
 * module can END UP depending on, not about who wrote the import (#1297,
 * asserted by `scripts/__tests__/layer-rules.test.ts`). `__tests__` is
 * excluded: a test that runs two passes -- which is what the pipeline does --
 * must name both.
 *
 * They replace `parse-cannot-import-render`, `parse-cannot-import-transpile`,
 * `declare-cannot-import-resolve`, `analyze-cannot-import-plan`,
 * `analyze-cannot-import-render`, `analyzers-cannot-reach-codegen-state`,
 * `plan-cannot-import-render` and `state-cannot-import-output`, each of which
 * forbade one later place this list now forbids with all the others.
 */
const PASS_ORDER = [
  {
    rule: "1-1-discover",
    path: "^src/PARSE/1-Discover/",
    mayRead: "^src/PARSE/2-Parse/grammar/CNextLexer\\.ts$",
  },
  { rule: "1-2-parse", path: "^src/PARSE/2-Parse/" },
  { rule: "1-3-declare", path: "^src/PARSE/3-Declare/" },
  { rule: "1-4-resolve", path: "^src/PARSE/4-Resolve/" },
  { rule: "2-1-analyze", path: "^src/TRANSPILE/1-Analyze/" },
  {
    rule: "transpile-state",
    path: "^src/TRANSPILE/(TranspileState\\.ts$|types/)",
  },
  { rule: "2-2-plan", path: "^src/TRANSPILE/2-Plan/" },
  { rule: "2-3-render", path: "^src/TRANSPILE/3-Render/" },
  { rule: "codegen-walker", path: "^src/TRANSPILE/CodeGenWalker\\.ts$" },
  { rule: "3-1-write", path: "^src/WRITE/1-Write/" },
];

const passOrderRules = PASS_ORDER.slice(0, -1).map((place, index) => ({
  name: `${place.rule}-reads-no-later-pass`,
  comment:
    `${place.path} may reach only the places before it in PASS_ORDER. ` +
    "See the comment on PASS_ORDER.",
  severity: "error",
  from: { path: place.path, pathNot: "__tests__" },
  to: {
    path: PASS_ORDER.slice(index + 1).map((later) => later.path),
    ...(place.mayRead === undefined ? {} : { pathNot: place.mayRead }),
    reachable: true,
  },
}));

/**
 * What counts as holding a parse tree -- the one definition, read by both
 * `parse-tree-sites` (the inventory) and `parse-tree-confined-to-parser` (the
 * ruling, #1932).
 */
const PARSE_TREE_TYPES = [
  "^src/PARSE/2-Parse/.*grammar/",
  "node_modules/antlr4ng/",
  // The sanctioned carriers. `IParsedFile` is documented as the way a
  // pass takes the tree "instead of re-parsing", and `IParsedFile["tree"]`
  // IS `ProgramContext` -- so a module reaches the tree through this hop
  // while naming neither the grammar nor the runtime, and the count stays
  // flat as the coupling grows. Measured: a probe in `state/` holding
  // `IParsedFile["tree"]` left the gate at 141 and exit 0, while the same
  // probe spelled `ParserRuleContext` failed loudly. The guard was
  // catching the honest spelling and missing the recommended one.
  // #1445 box 2 removed `IDeclaredFile` from this alternation with the
  // type itself. It was 1.3's apparent artifact and held
  // `parsed: IParsedFile`, so importing it reached the tree in one hop
  // -- exactly what naming the carriers here was for. Its `symbols`
  // half had no reader, so it was a bundle whose only live content was
  // the re-export.
  "^src/types/(IParsedFile|ITypeAccessors)\\.ts$",
];

/**
 * #1932 box 2: the shared helpers that hold a parse tree. Each is allowed only
 * because every caller is 1.2 Parse, 1.3 Declare or 2.1 Analyze, so each is
 * also a `to` of `parse-tree-confined-to-parser`: a later pass importing one
 * fails exactly as if it had imported the grammar.
 */
const PARSE_TREE_HELPERS = [
  "^src/utils/ast/(AssignmentTargetExtractor|ChildStatementCollector|StatementExpressionCollector)\\.ts$",
  "^src/utils/(ChainRoot|ExpressionUnwrapper|ExpressionUtils|OverflowBehaviorUtils|ParserUtils|PostfixAnalysisUtils)\\.ts$",
  "^src/types/TAssignmentSite\\.ts$",
  // #1932: reads parse contexts through `ITypeAccessors`; its plain-data half
  // is `utils/TypeNameLadder`, which later passes call instead.
  "^src/PARSE/3-Declare/TypeBinding\\.ts$",
];

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    ...passOrderRules,
    {
      name: "collectors-build-names-from-scopes",
      comment:
        "#1285/#1357: qualified names are built from a scope REFERENCE, through " +
        "ScopeUtils, never from a scope NAME string. Four collectors used to " +
        "flatten `scope.name` and join one level, which is correct only while " +
        "the grammar admits no nested scopes -- a coincidence, not a decision. " +
        "Importing QualifiedCName here is how that comes back, so it fails the " +
        "build rather than review. " +
        "#1357 widened this from the collectors seam to every directory that " +
        "measurably needs nothing from QualifiedCName: parser, preprocessor and " +
        "data, 42 files against the original 7. It stops there because an " +
        "import-level rule is all-or-nothing, and codegen and analysis " +
        "legitimately decode names (split, isQualified, toCppQualified) and " +
        "build whole paths (fromParts). What THEY must not do is a call SHAPE, " +
        "not an import, so it is gated by `npm run scope-joins:check` against " +
        "docs/architecture/scope-join-sites.md instead.",
      severity: "error",
      from: {
        path: [
          "^src/PARSE/3-Declare/cnext/collectors/",
          "^src/PARSE/2-Parse/",
          "^src/PARSE/1-Discover/",
        ],
      },
      to: {
        path: "^src/utils/QualifiedCName\\.ts$",
      },
    },

    // ==========================================================================
    // General Best Practices
    // ==========================================================================

    {
      name: "nothing-after-1-1-discovers",
      comment:
        "#1444 box 4. §1: 'After 1.1, nothing may discover a file.' No pass " +
        "after 1.1 Discover reaches one of its modules, except the types of " +
        "its artifact (`types/`): a later pass may read an earlier pass's " +
        "artifact, and running its primitives again is the re-discovery " +
        "#1435 and #1672 removed. The host roots (`cli/`, `lib/`) construct " +
        "the port and the run, and are not passes. `reachable` because a " +
        "helper is as good a route as a direct import: at `b000ecdd8` all 35 " +
        "violations came from 5 direct edges, 2.1 and render reaching " +
        "discovery's text and classification helpers.",
      severity: "error",
      from: {
        path: "^src/(PARSE/[234]-|TRANSPILE/|WRITE/)",
        pathNot: "__tests__",
      },
      to: {
        path: "^src/PARSE/1-Discover/",
        pathNot: "^src/PARSE/1-Discover/types/",
        reachable: true,
      },
    },
    {
      name: "header-language-is-judged-once",
      comment:
        "#1844. A header's language is 1.1's to judge, once, on the text a C " +
        "compile meets, and is recorded on the `SourceGraph`. It was judged in " +
        "Stage 2 instead, on the raw text when warm and the preprocessed text " +
        "when cold, so a run passed cold and failed warm (#1851). Only " +
        "`HeaderSources` runs the language checks; the orchestrator is not a " +
        "pass, so `nothing-after-1-1-discovers` does not reach it, and this does.",
      severity: "error",
      from: {
        pathNot: [
          "__tests__",
          "^src/PARSE/1-Discover/HeaderSources\\.ts$",
          "^src/PARSE/1-Discover/detect(Cpp|Assembly)Syntax\\.ts$",
        ],
      },
      to: {
        path: "^src/PARSE/1-Discover/detect(Cpp|Assembly)Syntax\\.ts$",
      },
    },
    {
      name: "header-sources-are-settled-by-discover",
      comment:
        "#1844 review. `header-language-is-judged-once` lets `HeaderSources` " +
        "call the language checks, so a stage that called " +
        "`HeaderSources.settle` would judge every header a second time, on " +
        "text of its own choosing, and the rule would pass. Only 1.1's " +
        "orchestrator settles header sources; every later stage reads them " +
        "from the `SourceGraph`.",
      severity: "error",
      from: {
        pathNot: [
          "__tests__",
          "^src/PARSE/1-Discover/(Discover|HeaderSources)\\.ts$",
        ],
      },
      to: {
        path: "^src/PARSE/1-Discover/HeaderSources\\.ts$",
      },
    },
    {
      name: "artifact-types-name-no-discovery-module",
      comment:
        "#1444 review. `nothing-after-1-1-discovers` lets a later pass read " +
        "1.1's `types/`, and that is sound only if `types/` reaches nothing " +
        "else in 1.1. It did not: `ISourceGraph` took the anchor's facts as a " +
        "`Pick` of `IRunAnchor`, which names `PathResolver` and `Preprocessor`, " +
        "so importing the artifact from a later pass gave 21 errors. A false " +
        "positive is an invitation to widen the exemption. `IRunAnchor` is not " +
        "the artifact: it describes the services 1.1 picks, and a later pass " +
        "importing it is caught by the rule above through those services. " +
        "`reachable` because a type reaches through another type.",
      severity: "error",
      from: {
        path: "^src/PARSE/1-Discover/types/",
        pathNot: ["__tests__", "^src/PARSE/1-Discover/types/IRunAnchor\\.ts$"],
      },
      to: {
        path: "^src/PARSE/1-Discover/",
        pathNot: "^src/PARSE/1-Discover/types/",
        reachable: true,
      },
    },
    {
      name: "nothing-after-resolve-derives-cross-file-facts",
      comment:
        "#1447's definition of done. `docs/architecture/README.md`: \"After 1.4, " +
        "nothing may compute a cross-file fact. A pass that needs one reads it " +
        'from Program, which is complete before 2.1 begins." ' +
        "Stated as an import rule, that is: a pass after 1.4 may depend on the " +
        "TYPE `IProgram` -- which lives in `src/types/`, reachable by " +
        "every layer -- and never on `4-Resolve/` itself. Importing the builder " +
        "or a deriver is how a later pass recomputes what 1.4 authored, which " +
        "is the failure the ownership rule exists to prevent, and it is exactly " +
        "the shape the `externalScopeTypes` seed had before #1472. " +
        "`reachable` because re-derivation arrives through a helper as easily " +
        "as directly (#1297).",
      severity: "error",
      from: {
        // `^src/transpiler/logic/analysis/` was a third alternative here on
        // main, and `^src/transpiler/output/` a second. Both are gone rather
        // than dropped: #1322 moved analysis whole to `1-Analyze/` and #1450
        // box 5 moved output whole to `3-Render/`, so `^src/TRANSPILE/` covers
        // each. A path matching nothing is a rule arm that cannot fire -- which
        // this comment said while the arm above it did exactly that (#1589
        // review).
        path: "^src/TRANSPILE/",
        pathNot: "__tests__",
      },
      to: { path: "^src/PARSE/4-Resolve/", reachable: true },
    },
    {
      name: "shared-contracts-cannot-import-a-pass",
      comment:
        "`src/types/` (`transpiler/types/` until #1853) is what CLAUDE.md and " +
        "this file both call the " +
        "place EVERY layer may depend on, and until now that was prose with " +
        "nothing behind it. A contract that imports a pass root drags the pass " +
        "into every layer that names the contract -- transitively and " +
        "invisibly, because the importer names only the type. " +
        "#1452 broke it twice: `IAssignmentContext` gained a " +
        "`TranspileState` member, so adding that import to an analyzer made " +
        "`analyzers-cannot-reach-codegen-state` fire THROUGH it, and " +
        "`ITranspilerResult` named a 2.1 type for a `grammarCoverage?` field. " +
        "Both are moved; this is what stops a third. " +
        "`reachable` because the drag is the whole defect: a contract two hops " +
        "from a pass root is as coupled as one that names it. " +
        "The exceptions are the sanctioned carriers that already have their " +
        "own rules -- `IParsedFile`/`ITypeAccessors` carry the parse tree by " +
        "design (see `parse-tree-confined-to-parser`), and `symbols/` names " +
        "`SymbolRegistry` for the scope back-reference `no-circular` exempts.",
      severity: "error",
      from: {
        // The shared root only. The four host types #1853 left in
        // `src/transpiler/types/` moved to `src/cli/types/` with #1443, and
        // the host is the one root that may name a pass.
        path: "^src/types/",
        pathNot: "(__tests__|__testUtils__)",
      },
      to: {
        path: "^src/(PARSE|TRANSPILE|WRITE)/",
        pathNot: [
          "^src/PARSE/2-Parse/.*grammar/",
          "^src/PARSE/3-Declare/SymbolRegistry\\.ts$",
        ],
        reachable: true,
      },
    },
    {
      name: "instrumentation-cannot-import-a-layer",
      comment:
        "#1452: `instrumentation/` records facts about the RUN -- where an " +
        "ADR's rule fired, which toolchain features a run required. Any layer " +
        "may write to it, which is the point, and it may reach back into " +
        "NONE of them. A module that observed a pass would be deriving the " +
        "report from the thing being reported on, and a pass that could be " +
        "reached from instrumentation could branch on its own observation. " +
        "That is the line `docs/architecture/README.md` draws when it admits " +
        "this root as the one place mutable cross-pass state is allowed, and " +
        "without this rule that paragraph is prose with nothing behind it. " +
        "`reachable` because the edge arrives through a helper as easily as " +
        "directly (#1297). " +
        "The `to` named `transpiler/(data|logic)` as well until #1444 moved " +
        "them into `PARSE/1-Discover/`, and the omission had been real: " +
        "`AdrProvenance` importing `transpiler/data/FileDiscovery` left " +
        "depcruise at exit 0 while the comment above claimed NONE of the " +
        "layers was reachable. `PARSE` names them now.",
      severity: "error",
      from: { path: "^src/instrumentation/", pathNot: "__tests__" },
      to: {
        path: "^src/(PARSE|TRANSPILE|WRITE)/",
        reachable: true,
      },
    },
    {
      name: "render-cannot-import-analyzers",
      comment:
        "#1322, and this is the rule that makes the move real rather than a " +
        "rename. Without it codegen keeps reaching into 2.1 and the new " +
        "directory is decoration -- `docs/architecture/README.md` principle 5 " +
        "says a boundary nothing enforces does not count. It is what forces " +
        "the remaining `output/ -> 1-Analyze` edges to be resolved rather " +
        "than carried across at a new path.",
      severity: "error",
      from: {
        path: "^src/TRANSPILE/3-Render/",
        pathNot: "__tests__",
      },
      to: { path: "^src/TRANSPILE/1-Analyze/", reachable: true },
    },
    {
      name: "node-fs-only-through-the-port",
      severity: "error",
      comment:
        "#1653, carrying #1451 box 4: 3.1 Write owns the filesystem, and the " +
        "port (`NodeFileSystem`) is the only module that imports node:fs. " +
        "Owner ruling 2026-09-30 extends #1451 box 3 to cli/. " +
        "`reachable: true`, so a module that reaches node:fs through a helper " +
        "is caught as readily as one importing it directly; that is how the " +
        "pipeline reached it through seven modules that defaulted the port. " +
        "The host constructs the port, so it reaches node:fs through it by " +
        "design and is exempt here; `host-reads-through-the-port` forbids it " +
        "the direct import. #1444 moved the port into src/PARSE/1-Discover/ " +
        "and re-keyed this exemption in the same commit; layer-rules.test.ts " +
        "checks that every pathNot still names a file, so a stale one cannot " +
        "linger.",
      from: {
        path: "^src/",
        pathNot: [
          "(__tests__|__testUtils__)",
          "^src/PARSE/1-Discover/NodeFileSystem\\.ts$",
          "^src/cli/",
        ],
      },
      to: { path: "^(node:)?fs(/promises)?$", reachable: true },
    },
    {
      name: "host-reads-through-the-port",
      severity: "error",
      comment:
        "#1653: owner ruling 2026-09-30 puts cli/ under #1451 box 3, so the " +
        "host uses the port it constructs rather than node:fs. A direct-edge " +
        "rule, because the host necessarily REACHES node:fs through the port " +
        "it builds; `node-fs-only-through-the-port` exempts it for that reason.",
      from: {
        path: "^src/cli/",
        pathNot: "(__tests__|__testUtils__)",
      },
      to: { path: "^(node:)?fs(/promises)?$" },
    },
    {
      name: "parse-tree-sites",
      comment:
        "#1317: docs/architecture/README.md makes the AST Tier 1 with a short " +
        "lifetime, and rests the whole lifetime axis on one rule -- 1.3 " +
        "consumes ParsedFile and does not re-export it, so the tree is not " +
        "reachable from any artifact a downstream pass holds. Nothing " +
        "enforced it. The population and its per-layer split live in " +
        "docs/architecture/parse-tree-sites.md, which `npm run parse-tree` " +
        "regenerates and `parse-tree:check` gates -- quoted here they would be " +
        "an ungated reading that rots, which is the failure CLAUDE.md names as " +
        "asserting the bound rather than recording the reading. The render " +
        "layer's share is the one that matters: the render layer holding parse " +
        "nodes is how a diagnostic can originate there at all. " +
        "`antlr4ng` is named alongside the generated grammars because " +
        "ParserRuleContext is the BASE CLASS of every generated context: " +
        "seven modules hold one without importing CNextParser, so a gate on " +
        "the grammar path alone is satisfied by rewriting an import rather " +
        "than removing the coupling. The C and C++ grammars are named for the " +
        "same reason -- a foreign parse tree is still a parse tree. " +
        "Direct, NOT `reachable`: the claim is that a pass's SOURCE must not " +
        "name a parse-context type, which is a claim about authorship. " +
        "Reachability is a different question here and answers `yes` for " +
        "almost every module, since everything reaches the grammar through " +
        "the pipeline -- the argument scripts/__tests__/layer-rules.test.ts " +
        "makes for its `collectors-build-names-from-scopes` control. " +
        "`info`: this rule is the INVENTORY, and many holders are correct (IParsedFile " +
        "IS 1.2's artifact), so a holder is not a violation and must not fail " +
        "or warn. `info` still lists every edge in `npm run depcruise`; " +
        "dependency-cruiser has no per-rule reporter filter (`--include-only`, " +
        "`--focus` and `--reaches` all select MODULES), and hiding the list " +
        "would be worse than printing it. " +
        "What must not happen is the count RISING, which " +
        "`npm run parse-tree:check` gates against " +
        "docs/architecture/parse-tree-sites.md. Which holders are allowed is " +
        "ruled by `parse-tree-confined-to-parser`, below (#1932), at `error`.",
      severity: "info",
      from: {
        path: "^src/",
        pathNot: [
          "^src/PARSE/2-Parse/",
          // Tests and their helpers are excluded ON PURPOSE: a fixture builds a
          // parse tree because that is what it is testing, and counting them
          // would make the baseline move whenever the suite grows. It is a
          // POLICY, not an oversight, so it is written down -- measured at 62
          // modules hidden (203 -> 141), which is too large a clause to leave
          // silent in a comment that spends four sentences on `antlr4ng`.
          // `declare-cannot-import-resolve` documents its own carve-out for the
          // same reason. `__testUtils__` is named because `__tests__/` does not
          // match it.
          "__tests__/",
          "__testUtils__/",
          "\\.test\\.ts$",
        ],
      },
      to: { path: PARSE_TREE_TYPES },
    },
    {
      name: "parse-tree-confined-to-parser",
      comment:
        "#1932, owner ruling 2026-10-07: the parse tree is gone before 2.2. " +
        "1.2 Parse makes it; 1.3 Declare and 2.1 Analyze may read it; nothing " +
        "from 2.2 Plan on may -- not Plan, not Render, not CodeGenWalker, not " +
        "Write, and not a helper any of them calls. Also exempt: the helpers in " +
        "PARSE_TREE_HELPERS, which are `to` targets too, so only an allowed pass " +
        "can call one; `cli/Transpiler.ts`, the host that hands 1.2's artifact " +
        "to 1.3 and 2.1 (generation receives the plain-data `IProgramSyntax`); " +
        "1.2's carriers `IParsedFile` and `ITypeAccessors`; " +
        "and 1.1's `IncludeDiscovery`, which lexes with 1.2's `CNextLexer` and " +
        "builds no tree (#1745, owner ruling 2026-09-30; PASS_ORDER `mayRead`). " +
        "A structural stand-in -- a later pass declaring its own copy of a " +
        "context's shape -- names no path this rule can match; " +
        "scripts/__tests__/artifact-lifetime.test.ts asks the type checker " +
        "instead. `parse-tree-sites` above is the inventory.",
      severity: "error",
      from: {
        path: "^src/",
        pathNot: [
          "^src/PARSE/2-Parse/",
          "^src/PARSE/3-Declare/",
          "^src/TRANSPILE/1-Analyze/",
          "^src/types/(IParsedFile|ITypeAccessors)\\.ts$",
          "^src/cli/Transpiler\\.ts$",
          "^src/PARSE/1-Discover/IncludeDiscovery\\.ts$",
          ...PARSE_TREE_HELPERS,
          "__tests__/",
          "__testUtils__/",
          "\\.test\\.ts$",
        ],
      },
      to: { path: [...PARSE_TREE_TYPES, ...PARSE_TREE_HELPERS] },
    },
    {
      name: "no-circular",
      comment: "No circular dependencies allowed",
      severity: "error",
      from: {
        // Allow intentional circular type-only imports.
        // IScopeSymbol <-> IFunctionSymbol is an intentional mutual reference,
        // and IBaseSymbol.scope is an IScopeSymbol because every symbol is
        // declared in a scope. The syntax types (#1932) recurse as the grammar
        // does: an expression holds postfix ops, field initializers and types,
        // and a type holds template arguments and dimension expressions.
        // Type-only cycles are erased at compile time.
        pathNot: [
          "^src/types/symbols/I(Scope|Function|Base)Symbol\\.ts$",
          "^src/types/syntax/(TExpression|TTypeSyntax|TPostfixOpSyntax|TTemplateArgumentSyntax|IFieldInitializerSyntax)\\.ts$",
        ],
      },
      to: { circular: true },
    },
    {
      name: "no-orphans",
      comment:
        "Files that are not reachable from the entry points. " +
        "Consider removing or connecting them.",
      severity: "warn",
      from: {
        orphan: true,
        pathNot: [
          // Test files are allowed to be orphans
          "\\.test\\.ts$",
          // Type definition files
          "\\.d\\.ts$",
          // Generated parser files
          "grammar/.*\\.ts$",
        ],
      },
      to: {},
    },
    {
      name: "no-deprecated-core",
      comment: "Don't use deprecated Node.js core modules",
      severity: "warn",
      from: {},
      to: { dependencyTypes: ["deprecated"] },
    },
    {
      name: "not-to-unresolvable",
      comment: "Don't import modules that cannot be resolved",
      severity: "error",
      from: {},
      to: { couldNotResolve: true },
    },
    {
      name: "no-non-package-json",
      comment: "Don't import packages not in package.json",
      severity: "error",
      from: {},
      to: {
        dependencyTypes: ["npm-no-pkg", "npm-unknown"],
      },
    },
    {
      name: "not-to-dev-dep",
      comment: "Don't import devDependencies from production code",
      severity: "error",
      from: {
        path: "^src/",
        pathNot: ["\\.test\\.ts$", "__tests__/"],
      },
      to: { dependencyTypes: ["npm-dev"] },
    },
  ],
  options: {
    // The generated parser files were `exclude`d here, to keep their known
    // issues out of the analysis. #1317: `exclude` drops a module from the
    // GRAPH, so every edge pointing at it disappears too -- and a rule whose
    // `to` names an excluded path can never fire. `parse-tree-confined-to-parser`
    // reported a clean zero against the entire population, the inert-guard
    // shape (#1143) at config level: nothing missing, nothing skipped, and the
    // rule answering a question with no possible answer.
    //
    // `doNotFollow` keeps them as leaf NODES -- visible as dependency targets,
    // with their own dependencies unanalyzed -- which is what the original
    // comment actually wanted. Measured: 809 -> 818 modules, and the other
    // rules stay at zero violations.
    doNotFollow: {
      path: [
        "node_modules",
        // Same shape the rule's `to` uses, not an enumeration of today's three.
        // Enumerated, a FOURTH grammar directory would be matched by the rule
        // and FOLLOWED by the cruise, re-admitting the generated-code noise this
        // entry exists to keep out, with nothing saying so.
        "^src/PARSE/2-Parse/.*grammar/",
      ],
    },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: "tsconfig.json" },
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default"],
      mainFields: ["main", "types", "typings"],
    },
    // NO `focus`. It was an enumerated list of pass roots, and an enumerated
    // focus is a DENYLIST wearing an allowlist's clothes: whatever it does not
    // name is dropped from the graph, so a rule covering that path cannot fire
    // and reports clean. #1317 shipped exactly that -- `src/cli/`, `src/lib/`
    // and `src/index.ts` were outside the list, `parse-tree-confined-to-parser`
    // could not fire in any of them, and the rule's own documentation said it
    // covered them.
    //
    // The first fix widened it to `^src/`, which is a NO-OP: `npm run depcruise`
    // cruises `src`, so every module already matches. Measured -- with the key
    // and with it deleted, both give 247 violations over 877 modules and the
    // violation sets are byte-identical. Keeping it would have read as
    // "correctly scoped" while meaning "does nothing", which is this file's own
    // guard-passing-by-coincidence failure, and it would leave the affordance to
    // narrow it again later.
    //
    // The lesson it replaces is the same one: naming only `^src/transpiler/`
    // would have silently taken 63 modules out of every rule at once (#1297 one
    // level up), and `TRANSPILE` had to be spelled out because the filesystem is
    // case-sensitive. Cruising everything cannot acquire either failure.
  },
};
