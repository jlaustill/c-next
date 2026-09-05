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
    doNotFollow: {
      path: ["node_modules"],
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
    // Exclude generated parser files from analysis (they have known issues)
    exclude: [
      "src/transpiler/logic/parser/grammar/.*",
      "src/transpiler/logic/parser/c/grammar/.*",
      "src/transpiler/logic/parser/cpp/grammar/.*",
    ],
    // Focus on the pass tree AND what has not moved into it yet. Naming only
    // `^src/transpiler/` here is how the move would have silently taken 63
    // modules out of every rule at once: the checks stay green because
    // nothing is analyzed, which is the shape of #1297 one level up.
    focus: "^src/(PARSE|transpiler)/",
  },
};
