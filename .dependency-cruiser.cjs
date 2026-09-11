/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    // ==========================================================================
    // 3-Layer Architecture Rules (Issue #572)
    // ==========================================================================
    // Architecture: Transpiler orchestrates data/, logic/, output/, state/
    //
    // Allowed dependencies:
    //   - Transpiler.ts → data/, logic/, output/ (orchestrator)
    //   - output/ → logic/ (code gen needs parser types, symbols)
    //   - Any layer → utils/ (shared utilities)
    //   - Any layer → lib/types/ (shared public types)
    //   - Any layer → transpiler/types/ (shared contracts, layer-neutral)
    //
    // Forbidden dependencies:
    //   - data/ → logic/, output/ (data layer is independent)
    //   - logic/ → output/ (logic should not depend on output)
    //   - state/ → output/ (#1297: state is shared, so it must not carry
    //     output's vocabulary into whoever reads it)
    //
    // All four are `reachable: true`: a layer boundary is a claim about what a
    // module can END UP depending on, not about who wrote the import. Asserted
    // mechanically by scripts/__tests__/layer-rules.test.ts, because the
    // missing keyword is invisible on reading -- see #1297.
    // ==========================================================================

    {
      name: "data-cannot-import-logic",
      comment:
        "Data layer must not depend on logic layer, through ANY number of " +
        "hops. #1297: this matched only DIRECT edges, so a data/ module could " +
        "reach logic/ through transpiler/types/ -- one import away, not " +
        "hypothetical -- while the rule reported green.",
      severity: "error",
      from: { path: "^src/transpiler/data/" },
      to: { path: "^src/transpiler/logic/", reachable: true },
    },
    {
      name: "data-cannot-import-output",
      comment:
        "Data layer must not depend on output layer, through ANY number of " +
        "hops. #1297: this matched only DIRECT edges, so a data/ module could " +
        "reach output/ through transpiler/types/ -- one import away, not " +
        "hypothetical -- while the rule reported green.",
      severity: "error",
      from: { path: "^src/transpiler/data/" },
      to: { path: "^src/transpiler/output/", reachable: true },
    },
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
          "^src/transpiler/logic/parser/",
          "^src/transpiler/logic/preprocessor/",
          "^src/transpiler/data/",
        ],
      },
      to: {
        path: "^src/utils/QualifiedCName\\.ts$",
      },
    },
    {
      name: "logic-cannot-import-output",
      comment:
        "Logic layer must not depend on output layer, through ANY number of " +
        "hops. If you need shared types, move them to transpiler/types/. " +
        "#1297: this matched only DIRECT edges, so logic/ -> state/ -> output/ " +
        "satisfied it while violating what it says -- ten analyzers were " +
        "transitively coupled to codegen's type vocabulary and CI reported the " +
        "layering clean. `reachable` is what makes the rule enforce its own " +
        "statement; without it the guard reports green on the case it exists " +
        "to catch.",
      severity: "error",
      from: { path: "^src/transpiler/logic/" },
      to: { path: "^src/transpiler/output/", reachable: true },
    },
    {
      name: "state-cannot-import-output",
      comment:
        "State layer must not depend on output layer. #1297: state/ sat " +
        "outside the layer model entirely, which is precisely why it could " +
        "become the place facts get stashed instead of carried -- it was the " +
        "one module nothing forbade the coupling in. Shared contracts belong " +
        "in transpiler/types/, which both layers may depend on.",
      severity: "error",
      from: { path: "^src/transpiler/state/" },
      to: { path: "^src/transpiler/output/", reachable: true },
    },

    // ==========================================================================
    // General Best Practices
    // ==========================================================================

    {
      name: "parse-cannot-import-render",
      comment:
        "#1447: PARSE is passes 1.x. `output/` is 2.2 Plan and 2.3 Render, so " +
        "an import here would be an earlier pass reading a later one's code -- " +
        "the direction the pass table exists to forbid. `reachable` because a " +
        "layer boundary is a claim about what a module can REACH, not about who " +
        "it names directly (#1297).",
      severity: "error",
      from: { path: "^src/PARSE/" },
      to: { path: "^src/transpiler/output/", reachable: true },
    },
    {
      name: "parse-cannot-import-transpile",
      comment:
        "#1515: PARSE is passes 1.x and TRANSPILE is 2.x, so an import here is " +
        "an earlier LAYER reading a later one -- worse than the one-pass edge " +
        "`declare-cannot-import-resolve` forbids. It is not hypothetical: " +
        "`TSymbolInfoAdapter`, in 1.3 Declare, computed `hasPublicInterface` " +
        "from `PublicInterface`, so the parse layer decided whether the " +
        "generated `.c` includes its own header. Nothing said so while " +
        "`PublicInterface` sat in `logic/symbols/`; placing it in 2.2 Plan is " +
        "what made the edge visible, and this is what keeps it that way. " +
        "`reachable` because a helper is as good a route as a direct import.",
      severity: "error",
      from: { path: "^src/PARSE/", pathNot: "__tests__" },
      to: { path: "^src/TRANSPILE/", reachable: true },
    },
    {
      name: "declare-cannot-import-resolve",
      comment:
        "#1472/#1447: 1.3 Declare must not depend on 1.4 Resolve. Declare emits " +
        "FileSymbols from one parse tree; Resolve consumes every file's. An " +
        "import the other way is the pass order backwards, and it is how the " +
        "cross-file parameter #1472 removed would come back. " +
        "`__tests__` is excluded deliberately: a test that runs BOTH passes -- " +
        "which is what the pipeline does -- must name both, and forbidding that " +
        "would only push the coverage somewhere less honest.",
      severity: "error",
      from: { path: "^src/PARSE/3-Declare/", pathNot: "__tests__" },
      to: { path: "^src/PARSE/4-Resolve/", reachable: true },
    },
    {
      name: "plan-cannot-import-render",
      comment:
        '#1449: `docs/architecture/README.md` §1 -- "**2.2 decides, 2.3 ' +
        'formats.**" A plan that reaches the renderer can ask it what it would ' +
        "emit, and then the decision is made in both places again -- which is " +
        "the duplicate derivation 2.2 exists to remove, reintroduced through " +
        "the back door. The digit is the rule: 2.2 may be read BY 2.3 and " +
        "never the reverse. `reachable` because a helper is as good a route " +
        "as a direct import (#1297).",
      severity: "error",
      from: { path: "^src/TRANSPILE/2-Plan/", pathNot: "__tests__" },
      to: { path: "^src/transpiler/output/", reachable: true },
    },
    {
      name: "nothing-after-resolve-derives-cross-file-facts",
      comment:
        "#1447's definition of done. `docs/architecture/README.md`: \"After 1.4, " +
        "nothing may compute a cross-file fact. A pass that needs one reads it " +
        'from Program, which is complete before 2.1 begins." ' +
        "Stated as an import rule, that is: a pass after 1.4 may depend on the " +
        "TYPE `IProgram` -- which lives in `transpiler/types/`, reachable by " +
        "every layer -- and never on `4-Resolve/` itself. Importing the builder " +
        "or a deriver is how a later pass recomputes what 1.4 authored, which " +
        "is the failure the ownership rule exists to prevent, and it is exactly " +
        "the shape the `externalScopeTypes` seed had before #1472. " +
        "`reachable` because re-derivation arrives through a helper as easily " +
        "as directly (#1297).",
      severity: "error",
      from: {
        // `^src/transpiler/logic/analysis/` was a third alternative here on
        // main. It is gone rather than dropped: #1322 moved that directory
        // whole to `src/TRANSPILE/1-Analyze/`, which the next pattern covers.
        // A path matching nothing is a rule arm that cannot fire.
        path: ["^src/transpiler/output/", "^src/TRANSPILE/"],
        pathNot: "__tests__",
      },
      to: { path: "^src/PARSE/4-Resolve/", reachable: true },
    },
    {
      name: "analyze-cannot-import-plan",
      comment:
        "#1322: 2.1 Analyze answers *is this program legal?* and 2.2 Plan " +
        "answers *what C should exist?*. The digit in the directory name is " +
        "the claim; this is its gate. An import here would let a diagnostic " +
        "depend on an emission decision, which is the pass order backwards " +
        "and the reason `PassByValueAnalyzer` -- named Analyzer, filed under " +
        "`analysis/`, never a `runAnalyzers` step -- moved to 2-Plan rather " +
        "than staying put. `reachable` because a layer boundary is a claim " +
        "about what a module can REACH (#1297).",
      severity: "error",
      from: { path: "^src/TRANSPILE/1-Analyze/", pathNot: "__tests__" },
      to: { path: "^src/TRANSPILE/2-Plan/", reachable: true },
    },
    {
      name: "analyze-cannot-import-render",
      comment:
        "#1322: `output/` is 2.2 Plan and 2.3 Render. 2.1 may not reach it -- " +
        "a diagnostic that needs codegen to decide whether to fire is a " +
        "diagnostic authored in the wrong pass. This is the constraint that " +
        "shapes how the 145 relocated throws are written: 2.1 walks the parse " +
        "tree itself rather than borrowing codegen's chain-walking.",
      severity: "error",
      from: { path: "^src/TRANSPILE/1-Analyze/", pathNot: "__tests__" },
      to: { path: "^src/transpiler/output/", reachable: true },
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
      from: { path: "^src/transpiler/output/", pathNot: "__tests__" },
      to: { path: "^src/TRANSPILE/1-Analyze/", reachable: true },
    },
    {
      name: "parse-tree-confined-to-parser",
      comment:
        "#1317: docs/architecture/README.md makes the AST Tier 1 with a short " +
        "lifetime, and rests the whole lifetime axis on one rule -- 1.3 " +
        "consumes ParsedFile and does not re-export it, so the tree is not " +
        "reachable from any artifact a downstream pass holds. Nothing " +
        "enforced it: 141 modules outside the parser hold a parse context, 44 " +
        "of them in the render layer, which is how a diagnostic can originate " +
        "there at all. " +
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
        "`warn`, and it stays `warn`: some holders are correct (IParsedFile " +
        "IS 1.2's artifact). What must not happen is the count RISING, which " +
        "`npm run parse-tree:check` gates against " +
        "docs/architecture/parse-tree-sites.md. Flipping this to `error` is " +
        "the last card of track D, not this one.",
      severity: "warn",
      from: {
        path: "^src/",
        pathNot: [
          "^src/transpiler/logic/parser/",
          "__tests__/",
          "\\.test\\.ts$",
        ],
      },
      to: {
        path: [
          "^src/transpiler/logic/parser/.*grammar/",
          "node_modules/antlr4ng/",
        ],
      },
    },
    {
      name: "no-circular",
      comment: "No circular dependencies allowed",
      severity: "error",
      from: {
        // Allow circular type-only imports in types/symbols/ folder.
        // IScopeSymbol <-> IFunctionSymbol is an intentional mutual reference,
        // and IBaseSymbol.scope is an IScopeSymbol because every symbol is
        // declared in a scope. Type-only cycles are erased at compile time.
        pathNot:
          "^src/transpiler/types/symbols/I(Scope|Function|Base)Symbol\\.ts$",
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
    // reported a clean zero against 141 real holders, which is the inert-guard
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
        "src/transpiler/logic/parser/grammar/.*",
        "src/transpiler/logic/parser/c/grammar/.*",
        "src/transpiler/logic/parser/cpp/grammar/.*",
      ],
    },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: "tsconfig.json" },
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default"],
      mainFields: ["main", "types", "typings"],
    },
    reporterOptions: {
      text: {
        highlightFocused: true,
      },
    },
    // Focus on the pass tree AND what has not moved into it yet. Naming only
    // `^src/transpiler/` here is how the move would have silently taken 63
    // modules out of every rule at once: the checks stay green because
    // nothing is analyzed, which is the shape of #1297 one level up.
    //
    // `TRANSPILE` is spelled out rather than folded into a case-insensitive
    // pattern: the filesystem is case-sensitive, `transpiler` does not match
    // `TRANSPILE`, and #1449 created `src/TRANSPILE/2-Plan/` -- which the two
    // named alternatives would have left outside every rule on the same day
    // the rules for it were written.
    focus: "^src/(PARSE|TRANSPILE|transpiler)/",
  },
};
