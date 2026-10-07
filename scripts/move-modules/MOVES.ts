import IMove from "../types/IMove";

/**
 * One entry per directory or file that moves, with the reason it belongs there.
 *
 * The rule is `IFileSymbols`' own admission test: a module belongs to 1.3
 * Declare when everything it computes is computable with one file's parse tree
 * open, and to 1.4 Resolve when it needs more than one file. That test is
 * already authored, so this manifest records the ANSWER for each module rather
 * than inventing a second rule.
 *
 * That test places a module in a PASS, and it is two-way, so it has no answer
 * for a module that belongs to no pass at all. A type named by more than one
 * layer is one of those: it is a shared contract, and `.dependency-cruiser.cjs`
 * already says where those go -- "Any layer -> transpiler/types/ (shared
 * contracts, layer-neutral)", and "If you need shared types, move them to
 * transpiler/types/". So the third destination is `src/transpiler/types/`, and
 * it is reached by asking whether more than one layer names the module, not by
 * asking which pass computes it. Recorded here because a rule that cannot
 * express the move being made is how the wrong row gets written and then
 * defended (#1449).
 */
const DISCOVERS =
  "#1444 box 3: 1.1 Discover authors which files exist, their kind, the " +
  "include graph and every resolved path (§1), and this module computes part " +
  "of that. Its row has read `src/PARSE/1-Discover/`, awaiting #1444, since " +
  "#1653.";

/**
 * #1853: a contract more than one area names goes to §1's `src/types/` root,
 * which every pass may depend on and which authors no facts. The areas are
 * counted by where each importer is GOING, not where it sits: `Transpiler.ts`,
 * `src/utils/cache/**` and `src/index.ts` are bound for `src/cli/`, so a type
 * only they name is a host type and stays behind with them, awaiting #1443.
 * Counting by present location is what made #1853's first table send
 * `ITranspilerResult` here and `ICacheConfig` to `utils/`.
 */
const SHARED_CONTRACT =
  "#1853: named by more than one area, counted by destination, so it is a " +
  "shared contract and goes to §1's `src/types/` root.";

/**
 * The files at the root of `src/transpiler/types/` that are shared. Listed
 * rather than moved as a directory, because four host types stay behind
 * (`IRenderedFile`, `ITranspilerResult`, `ICacheConfig`, `ICachedFileEntry`)
 * and three move into a pass, and `--apply` checks "already moved" against
 * the disk: a directory entry followed by entries moving those files back
 * would be a cycle the second run undoes.
 */
const SHARED_ROOT_TYPES: readonly string[] = [
  "AssignmentKind.ts",
  "ECommentType.ts",
  "FLOAT_TYPES.ts",
  "IBitAccessAnalysis.ts",
  "IBitmapFieldLayout.ts",
  "IBitWidth.ts",
  "ICallbackTypedefParameter.ts",
  "ICallbackTypeInfo.ts",
  "ICallGraphEntry.ts",
  "IChainStep.ts",
  "IChainTyping.ts",
  "ICodeGenSymbols.ts",
  "IComment.ts",
  "ICompilerFloor.ts",
  "IConflict.ts",
  "IDeclarationPlan.ts",
  "IDiagnostics.ts",
  "IEmissionFacts.ts",
  "IEmissionPlan.ts",
  "IFileResult.ts",
  "IFileSymbols.ts",
  "IFileSystem.ts",
  "IFloatBitWrite.ts",
  "IFoldedConstant.ts",
  "IForeignSymbolLookup.ts",
  "IFunctionSignature.ts",
  "IGrammarCoverageReport.ts",
  "IHeaderCallbackType.ts",
  "ILexicalFrame.ts",
  "ILocalDeclaration.ts",
  "INamedTypeResolution.ts",
  "INTEGER_TYPES.ts",
  "IOperandType.ts",
  "IOutputExtensions.ts",
  "IParsedFile.ts",
  "IPlannedBlock.ts",
  "IPlatformIOEnv.ts",
  "IPlatformIOProject.ts",
  "IPostfixOp.ts",
  "IProgram.ts",
  "IRecordedAdrSite.ts",
  "IRecordedRequirement.ts",
  "IRequirementSite.ts",
  "ISourceSpan.ts",
  "ITargetCatalogEntry.ts",
  "ITargetCatalogSource.ts",
  "ITargetDescription.ts",
  "ITargetDirective.ts",
  "IToolchainRequirement.ts",
  "ITranspilerConfig.ts",
  "ITypeAccessors.ts",
  "ITypeBindingDeps.ts",
  "ITypingContext.ts",
  "SIGNED_TYPES.ts",
  "TChainRoot.ts",
  "TCompilerExtension.ts",
  "TDeclarationKind.ts",
  "TEssentialCategory.ts",
  "THeaderExtension.ts",
  "TIncludeHeader.ts",
  "TLanguageStandard.ts",
  "TOutputMode.ts",
  "TOverflowBehavior.ts",
  "TParameterInfo.ts",
  "TPlannedTargetOp.ts",
  "TPrimitiveKind.ts",
  "TRegisterAccessMode.ts",
  "TRequirementKey.ts",
  "TRunTarget.ts",
  "TSourceExtension.ts",
  "TSubscriptKind.ts",
  "TTargetFieldValue.ts",
  "TTranspileInput.ts",
  "TTypeInfo.ts",
  "TType.ts",
  "TValueBinding.ts",
  "TVisibility.ts",
  "UNSIGNED_TYPES.ts",
];

const MOVES: readonly IMove[] = [
  // --- layer-neutral: reached by more than one pass ----------------------
  {
    from: "src/TRANSPILE/1-Analyze/helpers/AssignmentTargetExtractor.ts",
    to: "src/utils/ast/AssignmentTargetExtractor.ts",
    because:
      "#1322. Filed under `analysis/helpers/` but never a 2.1 fact: its own " +
      "header says it was extracted from `walkStatementForModifications` for " +
      "testability, and `CodeGenerator` reaches it. A generic parse-tree " +
      "walker that two passes use belongs where every layer may depend on it, " +
      "which the dependency-cruiser config already names as `utils/`. Leaving " +
      "it made `render-cannot-import-analyzers` unsatisfiable for a module " +
      "that decides nothing about legality.",
  },
  {
    from: "src/TRANSPILE/1-Analyze/helpers/ChildStatementCollector.ts",
    to: "src/utils/ast/ChildStatementCollector.ts",
    because:
      "Same: 'centralizes recursion patterns', extracted from `CodeGenerator` " +
      "under #566. It answers *what statements are inside this one?*, which is " +
      "a question about the tree, not about the program's legality.",
  },
  {
    from: "src/TRANSPILE/1-Analyze/helpers/StatementExpressionCollector.ts",
    to: "src/utils/ast/StatementExpressionCollector.ts",
    because: "Same shape, same reason (#565).",
  },
  {
    from: "src/TRANSPILE/1-Analyze/types/IBaseAnalysisError.ts",
    to: "src/transpiler/types/IBaseAnalysisError.ts",
    because:
      "#1322. The shape of a diagnostic is a shared contract, and `output/` " +
      "reads it. `logic-cannot-import-output`'s own comment prescribes the " +
      "remedy for exactly this: 'If you need shared types, move them to " +
      "`transpiler/types/`', which is layer-neutral.",
  },
  {
    from: "src/TRANSPILE/1-Analyze/types/INullCheckError.ts",
    to: "src/transpiler/types/INullCheckError.ts",
    because: "Same contract, same reader.",
  },
  // --- 2.2 Plan: what C should exist? -------------------------------------
  {
    from: "src/transpiler/logic/analysis/PassByValueAnalyzer.ts",
    to: "src/TRANSPILE/2-Plan/PassByValueAnalyzer.ts",
    because:
      "Named `Analyzer`, filed under `analysis/`, and not a `runAnalyzers` step: " +
      "its only importer is `CodeGenerator`, and what it computes is whether a " +
      "parameter is passed by value -- an emission decision, which 2.2 owns. " +
      "Leaving it in 1-Analyze would make `analyze-cannot-import-plan` " +
      "unsatisfiable on the day it was written.",
  },
  {
    from: "src/transpiler/logic/analysis/ModificationAnalyzer.ts",
    to: "src/TRANSPILE/2-Plan/ModificationAnalyzer.ts",
    because:
      "Const inference. Also not a step; its importer is `Transpiler`, and " +
      "`const` on a generated declaration is a fact about the C that should " +
      "exist, not about whether the C-Next is legal.",
  },
  {
    from: "src/transpiler/logic/analysis/helpers/TransitiveModificationPropagator.ts",
    to: "src/TRANSPILE/2-Plan/TransitiveModificationPropagator.ts",
    because: "Only `ModificationAnalyzer` uses it; it follows its one caller.",
  },
  // --- 2.1 Analyze: is this program legal? --------------------------------
  {
    from: "src/transpiler/logic/analysis",
    to: "src/TRANSPILE/1-Analyze",
    because:
      "#1322. `docs/architecture/README.md`: 2.1 Analyze owns *is this program " +
      "legal?* -- all diagnostics, codes, positions. This directory already IS " +
      "that pass: `runAnalyzers` and its sixteen steps are what authors every " +
      "coded diagnostic the transpiler emits. It moves whole rather than " +
      "gaining a sibling under `src/TRANSPILE/`, because two homes for one pass " +
      "is the duplicate code path CLAUDE.md calls the project's worst " +
      "anti-pattern -- and #1322 is about to author 145 more diagnostics, each " +
      "of which would have to pick a home.",
  },
  // --- 1.2 Parse: text becomes one tree, once -----------------------------
  {
    from: "src/transpiler/logic/parser",
    to: "src/PARSE/2-Parse",
    because:
      "#1445 box 4, absorbing #1443's 1.2 Parse rows and move at the " +
      "maintainer's direction. `docs/architecture/README.md` \u00a71 places 1.2 " +
      "Parse at `src/PARSE/2-Parse`, and #1443's own table already adjudicates " +
      "this directory there -- so this records an answer that exists rather " +
      "than inventing one. It moves WHOLE: the three hand-written modules " +
      "(`CNextSourceParser`, `CommentScanner`, `HeaderParser`) are the pass, " +
      "and the twelve files under `grammar/`, `c/grammar/` and `cpp/grammar/` " +
      "are ANTLR's output for it. The `antlr*` scripts' `-o` paths move with " +
      "them, or the next `npm run antlr:all` silently recreates the old tree " +
      "beside the new one.",
  },
  // --- 1.3 Declare: per-file identity and declaration ---------------------
  {
    from: "src/transpiler/logic/symbols/cnext",
    to: "src/PARSE/3-Declare/cnext",
    because:
      "collects what ONE C-Next file declares; every collector takes a single parse tree",
  },
  {
    from: "src/transpiler/logic/symbols/c",
    to: "src/PARSE/3-Declare/c",
    because: "collects what one C header declares",
  },
  {
    from: "src/transpiler/logic/symbols/cpp",
    to: "src/PARSE/3-Declare/cpp",
    because: "collects what one C++ header declares",
  },
  {
    from: "src/transpiler/logic/symbols/shared",
    to: "src/PARSE/3-Declare/shared",
    because: "parameter extraction shared by the C and C++ collectors",
  },
  {
    from: "src/transpiler/logic/symbols/TypeBinding.ts",
    to: "src/PARSE/3-Declare/TypeBinding.ts",
    because:
      "the one ladder from a type context to a name; reads only the tree and an injected predicate",
  },
  {
    from: "src/transpiler/logic/symbols/TYPE_FORMING_KINDS.ts",
    to: "src/PARSE/3-Declare/TYPE_FORMING_KINDS.ts",
    because:
      "which symbol kinds introduce a type name -- a constant, no file context",
  },
  {
    from: "src/transpiler/logic/symbols/SymbolUtils.ts",
    to: "src/PARSE/3-Declare/SymbolUtils.ts",
    because: "helpers for the C and C++ collectors, per declaration",
  },
  {
    from: "src/transpiler/logic/symbols/NameExistence.ts",
    to: "src/PARSE/3-Declare/NameExistence.ts",
    because:
      "asks the PER-FILE view whether a name exists; its own header is the statement of that split",
  },

  // --- 1.4 Resolve: facts requiring more than one file --------------------
  {
    from: "src/transpiler/logic/symbols/Program.ts",
    to: "src/PARSE/4-Resolve/Program.ts",
    because: "the artifact 1.4 emits",
  },
  {
    from: "src/transpiler/logic/symbols/DeferredTypes.ts",
    to: "src/PARSE/4-Resolve/DeferredTypes.ts",
    because:
      "settles bare names against the scope types each file's include closure declares, which no single file has",
  },
  {
    from: "src/transpiler/logic/symbols/TransitiveEnumCollector.ts",
    to: "src/PARSE/4-Resolve/TransitiveEnumCollector.ts",
    because:
      "walks the include graph, so it needs the graph rather than a file",
  },

  // --- NOT moved, and the reason is a measurement -------------------------
  // `SymbolTable.ts` and `PublicInterface.ts` stay at their current path with
  // an `awaiting` row in the destination map. Both are 1.4 facts by content --
  // one accumulates the whole run, the other queries it -- but 1.3 Declare
  // imports both today: the C and C++ collectors take a `SymbolTable` and
  // `TSymbolInfoAdapter` calls `PublicInterface.existsIn`. Moving them creates
  // a 3-Declare -> 4-Resolve edge, which is the pass order backwards, and a
  // rule forbidding it would fail on the first run.
  //
  // The edges are type-only -- injected parameters, not reached-for globals --
  // so this is not a deep coupling, but it is real and it is not this card's to
  // remove. `awaiting` is the shape #1443 sanctions for exactly this: a module
  // whose destination is known and whose move is gated on another card.

  // --- tests follow their subject ----------------------------------------
  // Listed one by one rather than moved as a directory: the modules they cover
  // land in two different passes, and `lint:test-location` requires a test to
  // sit in a `__tests__` beside what it tests.
  {
    from: "src/transpiler/logic/symbols/__tests__/NameExistence.test.ts",
    to: "src/PARSE/3-Declare/__tests__/NameExistence.test.ts",
    because: "covers NameExistence",
  },
  {
    from: "src/transpiler/logic/symbols/__tests__/SymbolUtils.test.ts",
    to: "src/PARSE/3-Declare/__tests__/SymbolUtils.test.ts",
    because: "covers SymbolUtils",
  },
  {
    from: "src/transpiler/logic/symbols/__tests__/Program.test.ts",
    to: "src/PARSE/4-Resolve/__tests__/Program.test.ts",
    because: "covers Program",
  },
  {
    from: "src/transpiler/logic/symbols/__tests__/TransitiveEnumCollector.test.ts",
    to: "src/PARSE/4-Resolve/__tests__/TransitiveEnumCollector.test.ts",
    because: "covers TransitiveEnumCollector",
  },

  // --- 2.2 Plan: what C should exist -------------------------------------
  {
    from: "src/transpiler/logic/symbols/PublicInterface.ts",
    to: "src/TRANSPILE/2-Plan/PublicInterface.ts",
    because:
      "decides which symbols form a file's public C interface -- `isExported` minus ADR-030's `main` exemption minus \"a scope is a container\", which `docs/architecture/README.md` §2 assigns to `EmissionPlan`. Its destination map row read `awaiting 1.4 Resolve` because the admission rule was two-way; the move was blocked by 1.3 Declare calling `existsIn`, which #1515 removed",
  },

  // --- type utilities: named by more than one layer -----------------------
  {
    from: "src/transpiler/output/headers/generators/mapType.ts",
    to: "src/utils/mapType.ts",
    because:
      "the C-Next to C type mapping is a translation fact, not a rendering decision: 2.2 Plan asks it to decide a header's includes and 2.3 Render asks it to write a declaration. CLAUDE.md puts type utilities in src/utils/, and leaving it under output/ made `plan-cannot-import-render` fire on a Plan module asking a question Render does not own",
  },
  {
    from: "src/transpiler/output/headers/generators/headerCType.ts",
    to: "src/utils/headerCType.ts",
    because:
      'same: the one answer to "what does a header call this type", asked by both passes since #1520 unified it',
  },
  {
    from: "src/transpiler/output/headers/generators/__tests__/mapType.test.ts",
    to: "src/utils/__tests__/mapType.test.ts",
    because: "covers mapType",
  },

  // --- shared contracts: named by more than one layer ---------------------
  // --- the accumulator: state, not a pass ---------------------------------
  {
    from: "src/transpiler/logic/symbols/SymbolTable.ts",
    to: "src/transpiler/state/SymbolTable.ts",
    because:
      "#1511, and the destination is NOT the one this file recorded. " +
      "`module-destinations.md` said `awaiting 1.4 Resolve`; that is " +
      "unreachable rather than pending. `output/` (6 modules) and " +
      "`TRANSPILE/` (7) import the table, and " +
      "`nothing-after-resolve-derives-cross-file-facts` forbids either from " +
      "reaching `4-Resolve/` transitively -- no interface answers that, " +
      "because the rule is about the destination and not the coupling. The " +
      "admission rule places a module in the pass that computes its fact, and " +
      "this computes none: it ACCUMULATES, filled from C/C++ headers in Stage " +
      "2 and read by every later pass. That is what `state/` holds, alongside " +
      "`CodeGenState` and `SymbolRegistry`. Checked before moving: it imports " +
      "nothing from `output/` or `TRANSPILE/`, so `state-cannot-import-output` " +
      "was already satisfied, and 1.3 Declare already imports `state/`, so the " +
      "edge that blocked 4-Resolve does not arise. Changed with maintainer " +
      "approval, since a decided destination is not a call to make in passing." +
      "\n\nSUPERSEDED by the `3-Declare/` entry at the end of this list " +
      "(#1452 box 1). The move above happened and is kept as the record of it; " +
      "`state/` is no longer a destination, because the card that owns it is " +
      "removing the directory. The premise that needed re-examining is the " +
      'sentence "it computes none: it ACCUMULATES" -- every write to the ' +
      "table is ONE file's declarations, and the accumulation across files is " +
      "`Transpiler`'s loop rather than the table's doing.",
  },
  {
    from: "src/transpiler/logic/symbols/__tests__/SymbolTable.test.ts",
    to: "src/transpiler/state/__tests__/SymbolTable.test.ts",
    because:
      "Follows its subject, and empties `logic/symbols/` -- which is the " +
      "definition-of-done item: the directory ceases to exist.",
  },
  // --- test support: production path, test-only module ------------------
  {
    from: "src/utils/FunctionUtils.ts",
    to: "src/tests/utils/FunctionUtils.ts",
    because:
      "#1511, recorded on #1418. The admission rule places a module in the " +
      "pass that computes its fact; this one computes none, because nothing " +
      "in production imports it -- `grep -rn FunctionUtils src --include=*.ts` " +
      "outside `__tests__` and its own file returns nothing. Both members are " +
      "reached only by tests (`create` 27 refs, `isInGlobalScope` 3), so knip " +
      "counts test callers as usage and reads clean, which is #1418's whole " +
      "mechanism. It is NOT deleted: it is the shared fixture factory for four " +
      "test files, and inlining it would spell the symbol shape 27 times -- " +
      "removing one field from `IFunctionSymbol` in this card was one edit " +
      "here instead of 27. So the defect is the PATH, and the destination is " +
      "the one that says test support out loud.",
  },
  {
    from: "src/utils/__tests__/FunctionUtils.test.ts",
    to: "src/tests/utils/__tests__/FunctionUtils.test.ts",
    because:
      "Follows its subject. Stays under a `__tests__/` directory because " +
      "`npm run lint:test-location` requires every `src/**/*.test.ts` to sit " +
      "in one. Verified before moving that vitest collects the new path: a " +
      "deliberately failing probe at `src/tests/utils/__tests__/` failed the " +
      "UNFILTERED `npm run unit` (334 files, up from 333), so the config's " +
      '`exclude: ["tests/**"]` anchors at the repository root and does not ' +
      "swallow `src/tests/`. A moved test that silently stops running is the " +
      "failure this check exists to rule out.",
  },
  {
    from: "src/transpiler/output/codegen/generators/TIncludeHeader.ts",
    to: "src/transpiler/types/TIncludeHeader.ts",
    because:
      "the include funnel that consumes it moves to CodeGenState, and state/ may not import output/ (`state-cannot-import-output`); a union two layers name is a shared contract, which .dependency-cruiser.cjs sends to transpiler/types/",
  },
  // --- 2.3 Render: what the text looks like -------------------------------
  {
    from: "src/transpiler/output",
    to: "src/TRANSPILE/3-Render",
    because:
      "#1450 box 5. The whole of `output/` IS the render pass -- codegen and " +
      "header generation -- so it moves as a tree, the way 2.1 Analyze did. " +
      "Every module here exists to turn settled decisions into text, and the " +
      "pass's own entry point (`CodeGenerator`) cannot be left behind by a " +
      "partial move without `3-Render/` holding everything except the pass. " +
      "Twenty-seven of the 144 still DECIDE rather than format -- they raise " +
      "an emission fact or expose a classification predicate -- and that is " +
      "box 4's remaining work, not a reason to split the directory: a module " +
      "that decides is in the wrong pass-PHASE, not the wrong pass, and #1443 " +
      "keys destinations on the pass.",
  },
  {
    from: "src/TRANSPILE/3-Render/codegen/subscript/SubscriptClassifier.ts",
    to: "src/TRANSPILE/2-Plan/SubscriptClassifier.ts",
    because:
      "#1450 box 4. `classify` decides WHICH subscript form a target is -- " +
      "array element, bit, bit range, slice -- and both readers act on that " +
      "answer rather than re-deriving it. That is 2.2's question, and the " +
      "module can answer it there: its only imports are its own kind union " +
      "and `TTypeInfo`, which is layer-neutral, so nothing " +
      "`plan-cannot-import-render` forbids comes with it.",
  },
  {
    from: "src/TRANSPILE/3-Render/codegen/subscript/TSubscriptKind.ts",
    to: "src/TRANSPILE/2-Plan/TSubscriptKind.ts",
    because:
      "The decision's own vocabulary; its only readers are the classifier and " +
      "itself, so it moves with it rather than becoming a shared contract.",
  },
  {
    from: "src/TRANSPILE/3-Render/codegen/subscript/__tests__/SubscriptClassifier.test.ts",
    to: "src/TRANSPILE/2-Plan/__tests__/SubscriptClassifier.test.ts",
    because: "Tests live beside the module they exercise.",
  },
  {
    from: "src/TRANSPILE/3-Render/codegen/assignment/AssignmentClassifier.ts",
    to: "src/TRANSPILE/2-Plan/AssignmentClassifier.ts",
    because:
      "#1450 box 4. `classify` decides WHICH form an assignment takes -- which " +
      "of 30 kinds, and therefore which handler emits it. Deciding the form is " +
      "2.2's question; the handlers that act on the answer stay in 2.3. Its " +
      "two render-side imports both resolve: `SubscriptDepthValidator` moves " +
      "with it, and `QualifiedNameGenerator` is a render-pass FACADE over " +
      "`ScopeUtils` (its own header says so), so a module that has left that " +
      "pass calls the `utils/` authority directly instead.",
  },
  {
    from: "src/TRANSPILE/3-Render/codegen/subscript/SubscriptDepthValidator.ts",
    to: "src/TRANSPILE/2-Plan/SubscriptDepthValidator.ts",
    because:
      "Reached by the classifier above and by `PostfixExpressionGenerator`. It " +
      "decides whether a subscript depth is legal against a type, which is the " +
      "same kind of question `SubscriptClassifier` answers next to it; render " +
      "reading it is the allowed direction.",
  },
  {
    from: "src/TRANSPILE/3-Render/codegen/subscript/__tests__/SubscriptDepthValidator.test.ts",
    to: "src/TRANSPILE/2-Plan/__tests__/SubscriptDepthValidator.test.ts",
    because: "Tests live beside the module they exercise.",
  },
  {
    from: "src/TRANSPILE/3-Render/codegen/assignment/AssignmentKind.ts",
    to: "src/transpiler/types/AssignmentKind.ts",
    because:
      "Once the classifier is in 2.2 and the handlers stay in 2.3, this union " +
      "is named by BOTH passes -- and the manifest's own rule sends a type " +
      "named by more than one layer to `transpiler/types/` rather than letting " +
      "either pass own the other's vocabulary.",
  },
  {
    from: "src/TRANSPILE/3-Render/codegen/assignment/IAssignmentContext.ts",
    to: "src/transpiler/types/IAssignmentContext.ts",
    because:
      "Same test, and the sharper case: 2.3 BUILDS it (`AssignmentContextBuilder`) " +
      "and 2.2 READS it. A contract with a producer in one pass and a consumer " +
      "in another is exactly what `transpiler/types/` is for.",
  },
  {
    from: "src/TRANSPILE/3-Render/codegen/assignment/__tests__/AssignmentClassifier.test.ts",
    to: "src/TRANSPILE/2-Plan/__tests__/AssignmentClassifier.test.ts",
    because: "Tests live beside the module they exercise.",
  },
  {
    from: "src/TRANSPILE/3-Render/codegen/types/INTEGER_TYPES.ts",
    to: "src/transpiler/types/INTEGER_TYPES.ts",
    because:
      "#1450 box 4. ADR-024's type classification, and once `CastRequirement` " +
      "in 2.2 reads it alongside 2.3's `TypeResolver` it is named by two " +
      "layers -- which the admission rule sends to `transpiler/types/`.",
  },
  {
    from: "src/TRANSPILE/3-Render/codegen/types/FLOAT_TYPES.ts",
    to: "src/transpiler/types/FLOAT_TYPES.ts",
    because: "Same rule, same pair of readers.",
  },
  {
    from: "src/TRANSPILE/3-Render/codegen/types/SIGNED_TYPES.ts",
    to: "src/transpiler/types/SIGNED_TYPES.ts",
    because:
      "`INTEGER_TYPES` is built from it, so it follows rather than leaving a " +
      "shared contract importing back into a pass.",
  },
  {
    from: "src/TRANSPILE/3-Render/codegen/types/UNSIGNED_TYPES.ts",
    to: "src/transpiler/types/UNSIGNED_TYPES.ts",
    because: "Same.",
  },
  {
    from: "src/TRANSPILE/3-Render/codegen/helpers/types/IPostfixOp.ts",
    to: "src/transpiler/types/IPostfixOp.ts",
    because:
      "#1450 box 4. The abstracted postfix-op shape, named by `CppMemberHelper` " +
      "as it moves to 2.2 and by `PostfixChainBuilder` and `CodeGenerator` " +
      "which stay in 2.3 -- two layers, which the admission rule sends to " +
      "`transpiler/types/`. Not to be confused with `IPostfixOpLike` in " +
      "`SubscriptDepthValidator`: that one wraps the RAW parse-tree op " +
      "(`expression(): unknown[]`), this one is the abstracted boolean form, " +
      "and they are different shapes rather than a duplicate.",
  },
  {
    from: "src/TRANSPILE/3-Render/codegen/helpers/CppMemberHelper.ts",
    to: "src/TRANSPILE/2-Plan/CppMemberHelper.ts",
    because:
      "#1450 box 4. Its four `needs*MemberConversion` methods decide whether a " +
      "C++ conversion TEMPORARY is emitted at all -- a choice about what C++ " +
      "exists, not how it reads. The module's own header says that is its job: " +
      "'handles cases where passing struct members to functions in C++ mode " +
      "requires temporary variables'. Its only render-side import was " +
      "`IPostfixOp`, which becomes a shared contract above.",
  },
  {
    from: "src/TRANSPILE/3-Render/codegen/helpers/__tests__/CppMemberHelper.test.ts",
    to: "src/TRANSPILE/2-Plan/__tests__/CppMemberHelper.test.ts",
    because: "Tests live beside the module they exercise.",
  },
  {
    from: "src/TRANSPILE/3-Render/codegen/analysis/StringLengthCounter.ts",
    to: "src/TRANSPILE/2-Plan/StringLengthCounter.ts",
    because:
      "#1445 box 3. It renders nothing -- it walks a tree and returns " +
      "`Map<string, number>`, the count of `.char_count` accesses per string " +
      "variable, which is the input to the strlen-caching decision. Deciding " +
      "WHICH lengths are worth hoisting into a temp is a choice about what C " +
      "exists, not how it reads, which is 2.2's job by the same argument " +
      "`CppMemberHelper` moved on. It does not belong in 2.1 either: its key " +
      "is the ADR-057 emitted C identifier, which 2.1 cannot produce. Its one " +
      "state touch is `CodeGenState.getVariableTypeInfo`, and 2-Plan already " +
      "reaches that from `AssignmentClassifier` and `PassByValueAnalyzer`, so " +
      "no layer rule moves.",
  },
  {
    from: "src/TRANSPILE/3-Render/codegen/analysis/__tests__/StringLengthCounter.test.ts",
    to: "src/TRANSPILE/2-Plan/__tests__/StringLengthCounter.test.ts",
    because: "Tests live beside the module they exercise.",
  },
  {
    from: "src/TRANSPILE/3-Render/codegen/utils/QualifiedNameGenerator.ts",
    to: "src/utils/QualifiedNameGenerator.ts",
    because:
      "#1445 box 3, enabling. It builds a qualified C name from a scope path " +
      "and a member name -- it imports `IFunctionSymbol`, `SymbolRegistry` " +
      "and `ScopeUtils` and nothing from the render layer, so nothing about " +
      "it was ever render-specific. CLAUDE.md already treats qualified-name " +
      "encoding as `ScopeUtils`' territory (`getTranspiledCName` is named as " +
      "the single encoder, with an instruction never to re-derive a name by " +
      "hand), and this is the builder that instruction points at. Filed under " +
      "render it is unreachable from `2-Plan/` -- `plan-cannot-import-render` " +
      "is `error` and `reachable` -- which is what blocked `TypeResolver` " +
      "below, whose only render import is one `forMember` call. " +
      "`PassByValueAnalyzer` already carries a comment explaining that it " +
      "cannot use this module for exactly that reason.",
  },
  {
    from: "src/TRANSPILE/3-Render/codegen/utils/__tests__/QualifiedNameGenerator.test.ts",
    to: "src/utils/__tests__/QualifiedNameGenerator.test.ts",
    because: "Tests live beside the module they exercise.",
  },
  {
    from: "src/TRANSPILE/3-Render/codegen/TypeResolver.ts",
    to: "src/TRANSPILE/2-Plan/ExpressionTypeResolver.ts",
    because:
      "#1445 box 3. It answers *what is the essential type of this " +
      "expression?* -- `getExpressionType`, `getPostfixExpressionType`, " +
      "`getCompositeIntegerType`, `getCompositeOverflowBehavior` -- and " +
      "returns type names, never C text. It emits no diagnostic (zero " +
      "`throw`/`invariant` sites), so it is a pure query about the program, " +
      "which is 2.2's side of the *decides vs formats* discriminator. Its " +
      "only render import was one `QualifiedNameGenerator.forMember` call, " +
      "and that module moves to `utils/` above.\n\n" +
      "Renamed because the old name collided: `CodeGenerator` imported this " +
      "AND `src/utils/TypeResolver`, aliasing the latter `SymbolTypeResolver` " +
      "at the import site. That alias was the only thing telling a reader " +
      "which of the two answered which question, and it existed in one file. " +
      "`ExpressionTypeResolver` says it in the name.",
  },
  {
    from: "src/TRANSPILE/3-Render/codegen/__tests__/TypeResolver.test.ts",
    to: "src/TRANSPILE/2-Plan/__tests__/ExpressionTypeResolver.test.ts",
    because: "Tests live beside the module they exercise.",
  },
  {
    from: "src/TRANSPILE/3-Render/codegen/helpers/TypeRegistrationEngine.ts",
    to: "src/TRANSPILE/2-Plan/TypeRegistrationEngine.ts",
    because:
      "#1445 box 3. It returns no text -- it walks declarations and writes " +
      "type facts into the registry every later decision reads. The render " +
      "admission test is *would removing this change WHAT is emitted or only " +
      "HOW it reads*, and removing this leaves codegen with no types at all, " +
      "so it fails the test the pass is defined by. It also originates zero " +
      "diagnostics.\n\n" +
      "Recorded honestly: this is a move out of a pass it does not belong " +
      "in, not a claim that 2.2 is its final home. Type facts about " +
      "declarations arguably belong further upstream in 1.3 Declare or 1.4 " +
      "Resolve, and the reason they are computed here at all is that the " +
      "registry is per-file and codegen-scoped. That is a larger question " +
      "than box 3, and this move does not foreclose it.",
  },
  {
    from: "src/TRANSPILE/3-Render/codegen/helpers/__tests__/TypeRegistrationEngine.test.ts",
    to: "src/TRANSPILE/2-Plan/__tests__/TypeRegistrationEngine.test.ts",
    because: "Tests live beside the module they exercise.",
  },
  {
    from: "src/TRANSPILE/3-Render/codegen/TypeRegistrationUtils.ts",
    to: "src/TRANSPILE/2-Plan/TypeRegistrationUtils.ts",
    because:
      "#1445 box 3, with the engine above -- it is the engine's write half " +
      "and has no other production caller. Its imports became layer-neutral " +
      "under #1651, which replaced its hand-spelled enum/bitmap quintuple " +
      "with `DeclaredTypeFacts`; before that it would have dragged the " +
      "render-side derivation along with it.",
  },
  {
    from: "src/TRANSPILE/3-Render/codegen/__tests__/TypeRegistrationUtils.test.ts",
    to: "src/TRANSPILE/2-Plan/__tests__/TypeRegistrationUtils.test.ts",
    because: "Tests live beside the module they exercise.",
  },
  {
    from: "src/TRANSPILE/3-Render/codegen/helpers/dimensionEvalOptions.ts",
    to: "src/TRANSPILE/2-Plan/dimensionEvalOptions.ts",
    because:
      "#1445 box 3, with the engine above. Thirty-two lines binding the " +
      "const-evaluation options both dimension-resolving paths must share; " +
      "`ArrayDimensionParser` in `utils/` names it in a comment as the thing " +
      "that prevents those two diverging. It imports `CodeGenState` and " +
      "`TYPE_WIDTH` and nothing else.",
  },
  {
    from: "src/TRANSPILE/3-Render/codegen/helpers/__tests__/dimensionEvalOptions.test.ts",
    to: "src/TRANSPILE/2-Plan/__tests__/dimensionEvalOptions.test.ts",
    because: "Tests live beside the module they exercise.",
  },
  {
    from: "src/TRANSPILE/3-Render/codegen/assignment/AssignmentContextBuilder.ts",
    to: "src/TRANSPILE/2-Plan/AssignmentContextBuilder.ts",
    because:
      "#1445 box 3. It turns an assignment statement into `IAssignmentContext`, " +
      "which `2-Plan/AssignmentClassifier` consumes to decide the " +
      "`AssignmentKind` -- so it is the input half of a decision 2.2 already " +
      "owns, sitting a pass downstream of it. Remove it and nothing is " +
      "classified at all, which is the render admission test failing.\n\n" +
      "`AssignmentOperatorMapper` deliberately does NOT come along: it is the " +
      "one place a C-Next operator becomes its C FORM, which is text, and it " +
      "is ADR-001's provenance site. Rather than reclassify it to satisfy " +
      "`plan-cannot-import-render`, it is injected through " +
      "`IContextBuilderDeps` -- the interface that already carries seven " +
      "render thunks for exactly this reason, because the builder has always " +
      "needed render capabilities it must not import.",
  },
  // --- 1.3 Declare: what does this file declare? (#1452 box 1) ------------
  {
    from: "src/transpiler/state/SymbolRegistry.ts",
    to: "src/PARSE/3-Declare/SymbolRegistry.ts",
    because:
      "#1452 box 1. The scope graph, and 1.3 Declare authors it: after the " +
      "scope-creation fix, every `getOrCreateScope` caller is under " +
      "`3-Declare/` and the guard in `passes-hold-no-mutable-state.test.ts` " +
      "keeps it that way. It is an instance rather than a static class since " +
      "box 3, so this is a relocation and not a dissolution -- there is no " +
      "mutable static to carry into a pass root. It imports only `utils/` and " +
      "`transpiler/types/`, so no rule constrains it from its own side.",
  },
  {
    from: "src/transpiler/state/SymbolTable.ts",
    to: "src/PARSE/3-Declare/SymbolTable.ts",
    because:
      "#1452 box 1, and this REVERSES the destination #1511 recorded, which " +
      "is why the reasoning is spelled out.\n\n" +
      "#1511 sent it to `state/` on the grounds that it is a mutable " +
      "accumulator filled during Stage 2 and read by every later pass, which " +
      "is what `state/` holds. That is a property of how it is USED, and the " +
      "admission test at the top of this file asks a different question: what " +
      "does the module COMPUTE, and with how many files open? Every write to " +
      "the table is one file's declarations -- four collectors under " +
      "`3-Declare/` plus the orchestrator that drives them per file -- so " +
      "each thing it computes is computable with one parse tree open. The " +
      "accumulation across files is `Transpiler`'s doing, not the table's.\n\n" +
      "#1511 also recorded `4-Resolve/` as unreachable, and that part stands: " +
      "`nothing-after-resolve-derives-cross-file-facts` forbids any pass after " +
      "1.4 from importing it, and 34 modules under `TRANSPILE/` read the " +
      "table. But that rule names `4-Resolve/` specifically. `3-Declare/` is " +
      "already imported from `TRANSPILE/`, so the edge that blocked the one " +
      "destination does not exist for this one.",
  },
  {
    from: "src/transpiler/state/__tests__/SymbolRegistry.test.ts",
    to: "src/PARSE/3-Declare/__tests__/SymbolRegistry.test.ts",
    because: "Follows its subject.",
  },
  {
    from: "src/transpiler/state/__tests__/SymbolTable.test.ts",
    to: "src/PARSE/3-Declare/__tests__/SymbolTable.test.ts",
    because: "Follows its subject.",
  },
  {
    from: "src/transpiler/state/__tests__/SymbolTableRunIsolation.test.ts",
    to: "src/PARSE/3-Declare/__tests__/SymbolTableRunIsolation.test.ts",
    because: "Follows its subject -- #1452 box 5's teardown-absence guard.",
  },
  // --- 2.3 Render: the per-file working state ----------------------------
  {
    from: "src/transpiler/state/RenderState.ts",
    to: "src/TRANSPILE/3-Render/RenderState.ts",
    because:
      "#1452 boxes 1 and 4, and **superseded by the next entry**. `CodeGenState` " +
      "and `TranspilerState` were mutable STATICS, which is why they had a " +
      "directory of their own rather than a pass: a static belongs to the " +
      "process, not to a pass, so the admission test at the top of this file " +
      "had nothing to ask. Merged into one instance owned by `CodeGenerator`, " +
      "the test applies again -- and the answer recorded here was 2.3, on the " +
      "claim that *every write is 2.3's*. That claim was false and `depcruise` " +
      "disproved it on the first run after the move: six modules under " +
      "`2-Plan/` import it and `TypeRegistrationEngine` and " +
      "`TypeRegistrationUtils` WRITE it, through `setVariableTypeInfo`. Kept " +
      "in the manifest rather than edited away, because the wrong destination " +
      "and the reason it was wrong are the reviewable part.",
  },
  {
    from: "src/transpiler/state/__tests__/CodeGenState.test.ts",
    to: "src/TRANSPILE/3-Render/__tests__/RenderState.test.ts",
    because: "Follows its subject, under the name of the class it now tests.",
  },
  {
    from: "src/transpiler/state/__tests__/RenderState.test.ts",
    to: "src/TRANSPILE/3-Render/__tests__/RenderState.includes.test.ts",
    because:
      "Follows its subject. Renamed because it lands beside the file above " +
      "and the two cannot share a name; this is the half that pins the " +
      "include sink and the toolchain-requirement deferrals, with their " +
      "negative controls.",
  },
  {
    from: "src/TRANSPILE/3-Render/RenderState.ts",
    to: "src/TRANSPILE/TranspileState.ts",
    because:
      "The corrected destination. `plan-cannot-import-render` is `error` with " +
      "`reachable: true`, so a module six `2-Plan/` modules import cannot sit " +
      "in `3-Render/` -- the same constraint that put `CodeGenWalker.ts` at " +
      "this level under #1445 box 3, and for the same reason: it spans 2.2 and " +
      "2.3 rather than belonging to either. Measured, not argued: 2.2 Plan " +
      "reads `constValues`, `currentScopePath`, `symbols`, `symbolTable`, " +
      "`program` and `generator` off it, and writes the type registry into it. " +
      "Renamed with the move, because a class called `RenderState` that 2.2 " +
      "Plan writes states something untrue in the place most readers look. " +
      "This does NOT satisfy box 2 -- a fact 2.2 authors still reaches 2.3 " +
      "through a shared mutable object rather than through 2.2's artifact -- " +
      "and box 2 stays unchecked on the card, saying so.",
  },
  {
    from: "src/TRANSPILE/3-Render/__tests__/RenderState.test.ts",
    to: "src/TRANSPILE/__tests__/TranspileState.test.ts",
    because:
      "Follows its subject to the corrected destination above. The row that " +
      "sent it to `3-Render/__tests__/` was left uncorrected while the " +
      "implementation's was fixed, so replaying the manifest landed the class " +
      "at `src/TRANSPILE/` and its tests one directory deeper, with their " +
      "relative imports pointing at a tree the branch does not have. Two of " +
      "the three stale `to:` paths in this file carry a `SUPERSEDED` note; " +
      "these two carried none, so they read as current answers.",
  },
  {
    from: "src/TRANSPILE/3-Render/__tests__/RenderState.includes.test.ts",
    to: "src/TRANSPILE/__tests__/TranspileState.includes.test.ts",
    because: "Follows its subject, for the reason the row above gives.",
  },
  {
    from: "src/transpiler/types/IAssignmentContext.ts",
    to: "src/TRANSPILE/2-Plan/types/IAssignmentContext.ts",
    because:
      "#1657 review. #1452 gave this contract a `state: TranspileState` member " +
      "so handlers could reach 2.3's per-file state, and that made a SHARED " +
      "contract depend on a pass-root implementation: adding an " +
      "`IAssignmentContext` import to `ShiftAnalyzer` made depcruise exit 2 " +
      "with `analyzers-cannot-reach-codegen-state … via " +
      "transpiler/types/IAssignmentContext.ts`. `.dependency-cruiser.cjs` " +
      "calls `transpiler/types/` the place every layer may depend on, so a " +
      "member that reaches into `src/TRANSPILE/` cannot live there. " +
      "It is not layer-neutral anyway: `AssignmentContextBuilder` (2.2 Plan) " +
      "builds it and the handlers (2.3 Render) consume it, which is 2.2 " +
      "deciding and 2.3 formatting -- the one direction the digit rule allows. " +
      "Nothing outside `src/TRANSPILE/` imports it.",
  },
  {
    from: "src/transpiler/state/AdrProvenance.ts",
    to: "src/instrumentation/AdrProvenance.ts",
    because:
      "#1452. Records where an ADR's rule fired, so matrix occupancy can derive " +
      "from codegen decisions and not only from diagnostic positions. It is " +
      "genuinely cross-pass -- 17 `record` sites across 2.1 Analyze and 2.3 " +
      "Render, read once at the end -- which is why it is instrumentation " +
      "rather than a pass artifact, and why box 4 exempts it by the owner's " +
      "call on 2026-09-23 that box 4 governs PROGRAM state. " +
      "Added by the #1657 review: the module moved with the rest of this card " +
      "and had no entry, so `npm run move:modules` against a BASE export left " +
      "it behind. A manifest that cannot replay the move it records is a " +
      "reviewable artifact that cannot be reviewed.",
  },
  {
    from: "src/transpiler/state/__tests__/AdrProvenance.test.ts",
    to: "src/instrumentation/__tests__/AdrProvenance.test.ts",
    because: "Follows its subject.",
  },
  {
    from: "src/transpiler/state/CodeGenState.ts",
    to: "src/transpiler/state/RenderState.ts",
    because:
      "The step the chain below starts AFTER, recorded so a replay does not " +
      "begin at a path that never existed at BASE. This is a rename in place, " +
      "not a relocation: `CodeGenState` and `TranspilerState` were merged into " +
      "one class here before anything moved, because the destination question " +
      "cannot be asked of two classes at once. `RenderState` then moved to " +
      "`3-Render/`, which was wrong, and then to `src/TRANSPILE/TranspileState.ts`, " +
      "which is where it is -- both of those are entries below, with their " +
      "reasons.",
  },
  {
    from: "src/TRANSPILE/1-Analyze/types/IGrammarCoverageReport.ts",
    to: "src/transpiler/types/IGrammarCoverageReport.ts",
    because:
      "#1657 review follow-up. The admission test at the top of this file has a " +
      "third destination for a type NAMED by more than one layer, and this is " +
      "one: `ITranspilerResult` (the public result) declares a " +
      "`grammarCoverage?` field of this type, `GrammarCoverageListener` (2.1) " +
      "produces it, and `scripts/grammar-coverage.ts` consumes it. It is a leaf " +
      "-- zero imports of its own -- so nothing travels with it. " +
      "Left where it was, `transpiler/types/` imported a pass root, which is " +
      "the same boundary break that moved `IAssignmentContext` OUT of that " +
      "directory earlier in this PR, in the opposite direction. CLAUDE.md calls " +
      "`transpiler/types/` the place every layer may depend on; that claim now " +
      "holds with no exception rather than with one recorded in a commit " +
      "message.",
  },
  {
    from: "src/TRANSPILE/1-Analyze/types/TChainRoot.ts",
    to: "src/transpiler/types/TChainRoot.ts",
    because:
      "#1668 (unified operand typing, C2). `IProgram.bindValue` takes a chain " +
      "root, so the shared contract names this type -- and " +
      "`shared-contracts-cannot-import-a-pass` forbids `transpiler/types/` " +
      "reaching `1-Analyze/`. It is a leaf union with no imports, named by 2.1 " +
      "today and by the one operand typer in `utils/` next, so it is exactly " +
      "the kind of type this directory holds.",
  },
  {
    from: "src/TRANSPILE/2-Plan/TSubscriptKind.ts",
    to: "src/transpiler/types/TSubscriptKind.ts",
    because:
      "#1668 (unified operand typing, C3). `IChainStep` is a shared contract " +
      "and names the subscript kind, and `shared-contracts-cannot-import-a-pass` " +
      "forbids `transpiler/types/` reaching `2-Plan/`. A leaf union.",
  },
  {
    from: "src/TRANSPILE/2-Plan/SubscriptClassifier.ts",
    to: "src/utils/SubscriptClassifier.ts",
    because:
      "#1668 (C3). The one element-or-bit decision, now asked by the one " +
      "operand typer in `utils/` for 2.1 and 2.2 alike; `analyze-cannot-" +
      "import-plan` forbids 2.1 reaching it in `2-Plan/`. It imports only " +
      "`TSubscriptKind` and `TTypeInfo`, both shared contracts.",
  },
  {
    from: "src/TRANSPILE/1-Analyze/helpers/ChainRoot.ts",
    to: "src/utils/ChainRoot.ts",
    because:
      "#1668 (C3). Reading a chain's root off a node is what the operand " +
      "typer does first, for 2.1 and 2.2 alike, and `render-cannot-import-" +
      "analyzers` forbids 2.2/2.3 reaching `1-Analyze/`.",
  },
  {
    from: "src/TRANSPILE/2-Plan/__tests__/SubscriptClassifier.test.ts",
    to: "src/utils/__tests__/SubscriptClassifier.test.ts",
    because:
      "#1668 (C3). Follows its module, so the test sits in the `__tests__` " +
      "beside what it tests.",
  },
  {
    from: "src/TRANSPILE/1-Analyze/helpers/PROPERTY_NAMES.ts",
    to: "src/utils/constants/PROPERTY_NAMES.ts",
    because:
      "#1668 (C4). Which member names are ADR-058/ADR-045 properties is one " +
      "fact, and the operand typer had its own copy that lacked " +
      "`char_count`; the typer lives in `utils/`, which may not reach " +
      "`1-Analyze/`.",
  },
  {
    from: "src/transpiler/types/IDiscoveryFacts.ts",
    to: "src/PARSE/4-Resolve/types/IDiscoveryFacts.ts",
    because:
      '#1653, owner ruling 2026-09-30 ("move them"): a shared type that one area alone names moves into it. Its non-test importers at 8127b38f4 are `PARSE/4-Resolve/Program.ts`, plus `IProgramInputs`, which moves to the same place. No type that stays shared imports it, so the move leaves no shared contract importing a pass.',
  },
  {
    from: "src/transpiler/types/IForeignSymbols.ts",
    to: "src/PARSE/4-Resolve/types/IForeignSymbols.ts",
    because:
      '#1653, owner ruling 2026-09-30 ("move them"): a shared type that one area alone names moves into it. Its non-test importers at 8127b38f4 are `PARSE/4-Resolve/Program.ts`, plus `IProgramInputs`, which moves to the same place. No type that stays shared imports it, so the move leaves no shared contract importing a pass.',
  },
  {
    from: "src/transpiler/types/IProgramInputs.ts",
    to: "src/PARSE/4-Resolve/types/IProgramInputs.ts",
    because:
      '#1653, owner ruling 2026-09-30 ("move them"): a shared type that one area alone names moves into it. Its non-test importers at 8127b38f4 are `PARSE/4-Resolve/Program.ts`. No type that stays shared imports it, so the move leaves no shared contract importing a pass.',
  },
  {
    from: "src/transpiler/types/IRunTargetInputs.ts",
    to: "src/PARSE/4-Resolve/types/IRunTargetInputs.ts",
    because:
      '#1653, owner ruling 2026-09-30 ("move them"): a shared type that one area alone names moves into it. Its non-test importers at 8127b38f4 are `PARSE/4-Resolve/RunTarget.ts`, plus `IProgramInputs`, which moves to the same place. No type that stays shared imports it, so the move leaves no shared contract importing a pass.',
  },
  {
    from: "src/transpiler/types/IVisibilityInput.ts",
    to: "src/PARSE/4-Resolve/types/IVisibilityInput.ts",
    because:
      '#1653, owner ruling 2026-09-30 ("move them"): a shared type that one area alone names moves into it. Its non-test importers at 8127b38f4 are `PARSE/4-Resolve/Program.ts`, plus `IProgramInputs`, which moves to the same place. No type that stays shared imports it, so the move leaves no shared contract importing a pass.',
  },
  {
    from: "src/transpiler/types/ITransitiveIncludes.ts",
    to: "src/PARSE/4-Resolve/types/ITransitiveIncludes.ts",
    because:
      '#1653, owner ruling 2026-09-30 ("move them"): a shared type that one area alone names moves into it. Its non-test importers at 8127b38f4 are `PARSE/4-Resolve/TransitiveEnumCollector.ts`. No type that stays shared imports it, so the move leaves no shared contract importing a pass.',
  },
  {
    from: "src/transpiler/types/IBaseAnalysisError.ts",
    to: "src/TRANSPILE/1-Analyze/types/IBaseAnalysisError.ts",
    because:
      '#1653, owner ruling 2026-09-30 ("move them"): a shared type that one area alone names moves into it. Its non-test importers at 8127b38f4 are 41 modules under `TRANSPILE/1-Analyze/types`, plus `INullCheckError`, which moves to the same place. No type that stays shared imports it, so the move leaves no shared contract importing a pass.',
  },
  {
    from: "src/transpiler/types/ICommentError.ts",
    to: "src/TRANSPILE/1-Analyze/types/ICommentError.ts",
    because:
      '#1653, owner ruling 2026-09-30 ("move them"): a shared type that one area alone names moves into it. Its non-test importers at 8127b38f4 are `TRANSPILE/1-Analyze/CommentExtractor.ts`. No type that stays shared imports it, so the move leaves no shared contract importing a pass.',
  },
  {
    from: "src/transpiler/types/INullCheckError.ts",
    to: "src/TRANSPILE/1-Analyze/types/INullCheckError.ts",
    because:
      '#1653, owner ruling 2026-09-30 ("move them"): a shared type that one area alone names moves into it. Its non-test importers at 8127b38f4 are `TRANSPILE/1-Analyze/NullCheckAnalyzer.ts`. No type that stays shared imports it, so the move leaves no shared contract importing a pass.',
  },
  {
    from: "src/transpiler/types/IComplianceAnnotation.ts",
    to: "src/TRANSPILE/2-Plan/types/IComplianceAnnotation.ts",
    because:
      '#1653, owner ruling 2026-09-30 ("move them"): a shared type that one area alone names moves into it. Its non-test importers at 8127b38f4 are `TRANSPILE/2-Plan/ComplianceAnnotations.ts`. No type that stays shared imports it, so the move leaves no shared contract importing a pass.',
  },
  {
    from: "src/transpiler/types/TPassByValueParams.ts",
    to: "src/TRANSPILE/3-Render/headers/types/TPassByValueParams.ts",
    because:
      '#1653, owner ruling 2026-09-30 ("move them"): a shared type that one area alone names moves into it. Its non-test importers at 8127b38f4 are 3 modules under `TRANSPILE/3-Render/headers/types`. No type that stays shared imports it, so the move leaves no shared contract importing a pass.',
  },
  {
    from: "src/transpiler/types/IHeaderRenderResult.ts",
    to: "src/TRANSPILE/3-Render/headers/types/IHeaderRenderResult.ts",
    because:
      '#1653, owner ruling 2026-09-30 ("move them"): a shared type that one area alone names moves into it. Its non-test importers at 8127b38f4 are `TRANSPILE/3-Render/headers/HeaderRenderer.ts`. No type that stays shared imports it, so the move leaves no shared contract importing a pass.',
  },
  {
    from: "src/transpiler/types/IPlannedRegisterMember.ts",
    to: "src/TRANSPILE/3-Render/codegen/types/IPlannedRegisterMember.ts",
    because:
      '#1653, owner ruling 2026-09-30 ("move them"): a shared type that one area alone names moves into it. Its non-test importers at 8127b38f4 are 2 modules under `TRANSPILE/3-Render/codegen/types`. No type that stays shared imports it, so the move leaves no shared contract importing a pass.',
  },
  {
    from: "src/transpiler/types/IDeclaredTypeFacts.ts",
    to: "src/utils/types/IDeclaredTypeFacts.ts",
    because:
      '#1653, owner ruling 2026-09-30 ("move them"): a shared type that one area alone names moves into it. Its non-test importers at 8127b38f4 are `utils/DeclaredTypeFacts.ts`. No type that stays shared imports it, so the move leaves no shared contract importing a pass.',
  },
  {
    from: "src/transpiler/types/IDeclaredTypeSets.ts",
    to: "src/utils/types/IDeclaredTypeSets.ts",
    because:
      '#1653, owner ruling 2026-09-30 ("move them"): a shared type that one area alone names moves into it. Its non-test importers at 8127b38f4 are `utils/DeclaredTypeFacts.ts`. No type that stays shared imports it, so the move leaves no shared contract importing a pass.',
  },
  {
    from: "src/transpiler/types/IStructFieldLookup.ts",
    to: "src/utils/types/IStructFieldLookup.ts",
    because:
      '#1653, owner ruling 2026-09-30 ("move them"): a shared type that one area alone names moves into it. Its non-test importers at 8127b38f4 are `utils/DeclaredTypeFacts.ts`. No type that stays shared imports it, so the move leaves no shared contract importing a pass.',
  },
  {
    from: "src/transpiler/types/IGccToolchain.ts",
    to: "src/utils/types/IGccToolchain.ts",
    because:
      '#1653, owner ruling 2026-09-30 ("move them"): a shared type that one area alone names moves into it. Its non-test importers at 8127b38f4 are `utils/TargetToolchain.ts`. No type that stays shared imports it, so the move leaves no shared contract importing a pass.',
  },
  {
    from: "src/transpiler/types/ICodeGenApi.ts",
    to: "src/TRANSPILE/types/ICodeGenApi.ts",
    because:
      '#1653, owner ruling 2026-09-30 ("move them"): a shared type that one area alone names moves into it. Its non-test importers at 8127b38f4 are `TRANSPILE/TranspileState.ts`. No type that stays shared imports it, so the move leaves no shared contract importing a pass.',
  },
  // --- #1444 box 3: 1.1 Discover's modules join the pass --------------------
  // The map has given each of these `src/PARSE/1-Discover/`, awaiting #1444,
  // since #1653 (owner rulings 16 and 17). Listed file by file, because
  // `IncludeRewriter` leaves `data/` for `utils/` while its siblings go to 1.1.
  {
    from: "src/transpiler/data/CNextMarkerDetector.ts",
    to: "src/PARSE/1-Discover/CNextMarkerDetector.ts",
    because: DISCOVERS,
  },
  {
    from: "src/transpiler/data/CppEntryPointScanner.ts",
    to: "src/PARSE/1-Discover/CppEntryPointScanner.ts",
    because: DISCOVERS,
  },
  {
    from: "src/transpiler/data/DependencyGraph.ts",
    to: "src/PARSE/1-Discover/DependencyGraph.ts",
    because: DISCOVERS,
  },
  {
    from: "src/transpiler/data/FileDiscovery.ts",
    to: "src/PARSE/1-Discover/FileDiscovery.ts",
    because: DISCOVERS,
  },
  {
    from: "src/transpiler/data/IncludeDiscovery.ts",
    to: "src/PARSE/1-Discover/IncludeDiscovery.ts",
    because: DISCOVERS,
  },
  {
    from: "src/transpiler/data/IncludeResolver.ts",
    to: "src/PARSE/1-Discover/IncludeResolver.ts",
    because: DISCOVERS,
  },
  {
    from: "src/transpiler/data/InputExpansion.ts",
    to: "src/PARSE/1-Discover/InputExpansion.ts",
    because: DISCOVERS,
  },
  {
    from: "src/transpiler/data/PathResolver.ts",
    to: "src/PARSE/1-Discover/PathResolver.ts",
    because: DISCOVERS,
  },
  {
    from: "src/transpiler/data/PlatformIOIni.ts",
    to: "src/PARSE/1-Discover/PlatformIOIni.ts",
    because: DISCOVERS,
  },
  {
    from: "src/transpiler/data/TargetCatalogFile.ts",
    to: "src/PARSE/1-Discover/TargetCatalogFile.ts",
    because: DISCOVERS,
  },
  {
    from: "src/transpiler/data/__tests__/CNextMarkerDetector.test.ts",
    to: "src/PARSE/1-Discover/__tests__/CNextMarkerDetector.test.ts",
    because: DISCOVERS,
  },
  {
    from: "src/transpiler/data/__tests__/CppEntryPointScanner.test.ts",
    to: "src/PARSE/1-Discover/__tests__/CppEntryPointScanner.test.ts",
    because: DISCOVERS,
  },
  {
    from: "src/transpiler/data/__tests__/DependencyGraph.test.ts",
    to: "src/PARSE/1-Discover/__tests__/DependencyGraph.test.ts",
    because: DISCOVERS,
  },
  {
    from: "src/transpiler/data/__tests__/FileDiscovery.test.ts",
    to: "src/PARSE/1-Discover/__tests__/FileDiscovery.test.ts",
    because: DISCOVERS,
  },
  {
    from: "src/transpiler/data/__tests__/IncludeDiscovery.test.ts",
    to: "src/PARSE/1-Discover/__tests__/IncludeDiscovery.test.ts",
    because: DISCOVERS,
  },
  {
    from: "src/transpiler/data/__tests__/IncludeResolver.test.ts",
    to: "src/PARSE/1-Discover/__tests__/IncludeResolver.test.ts",
    because: DISCOVERS,
  },
  {
    from: "src/transpiler/data/__tests__/InputExpansion.test.ts",
    to: "src/PARSE/1-Discover/__tests__/InputExpansion.test.ts",
    because: DISCOVERS,
  },
  {
    from: "src/transpiler/data/__tests__/PathResolver.test.ts",
    to: "src/PARSE/1-Discover/__tests__/PathResolver.test.ts",
    because: DISCOVERS,
  },
  {
    from: "src/transpiler/data/__tests__/PlatformIOIni.test.ts",
    to: "src/PARSE/1-Discover/__tests__/PlatformIOIni.test.ts",
    because: DISCOVERS,
  },
  {
    from: "src/transpiler/data/types",
    to: "src/PARSE/1-Discover/types",
    because:
      "#1444: the shapes 1.1 emits -- a discovered file, its kind, a header " +
      "root. Later passes read them as parts of the `SourceGraph`, which §1 " +
      "allows: a later pass may read an earlier pass's artifact.",
  },
  {
    from: "src/transpiler/logic/detectCppSyntax.ts",
    to: "src/PARSE/1-Discover/detectCppSyntax.ts",
    because:
      "#1444: decides a header's kind (C or C++), which §1 gives to 1.1: " +
      '"which files exist, their kind".',
  },
  {
    from: "src/transpiler/logic/detectAssemblySyntax.ts",
    to: "src/PARSE/1-Discover/detectAssemblySyntax.ts",
    because: "#1444: the same, for an assembler header.",
  },
  {
    from: "src/transpiler/logic/__tests__/detectCppSyntax.test.ts",
    to: "src/PARSE/1-Discover/__tests__/detectCppSyntax.test.ts",
    because: "#1444: with its module.",
  },
  {
    from: "src/transpiler/logic/__tests__/detectAssemblySyntax.test.ts",
    to: "src/PARSE/1-Discover/__tests__/detectAssemblySyntax.test.ts",
    because: "#1444: with its module.",
  },
  {
    from: "src/transpiler/logic/preprocessor",
    to: "src/PARSE/1-Discover/preprocessor",
    because:
      "Owner ruling 15 (2026-09-26): the preprocessor goes to 1.1 Discover. " +
      "Its reads go through the port since #1653, and its scratch file is " +
      "the port's `withTempFile`.",
  },
  {
    from: "src/transpiler/NodeFileSystem.ts",
    to: "src/PARSE/1-Discover/NodeFileSystem.ts",
    because:
      "#1444: the production `IFileSystem`, the host port 1.1 publishes. It " +
      "is the only module that imports `node:fs`, and 3.1 Write changes the " +
      "disk through it.",
  },
  {
    from: "src/transpiler/__tests__/NodeFileSystem.withTempFile.test.ts",
    to: "src/PARSE/1-Discover/__tests__/NodeFileSystem.withTempFile.test.ts",
    because: "#1444: with its module.",
  },
  {
    from: "src/transpiler/__tests__/NodeFileSystem.withTempFile.mocked.test.ts",
    to: "src/PARSE/1-Discover/__tests__/NodeFileSystem.withTempFile.mocked.test.ts",
    because: "#1444: with its module.",
  },
  {
    from: "src/transpiler/data/IncludeRewriter.ts",
    to: "src/utils/IncludeRewriter.ts",
    because:
      "#1444: renders a `.cnx` include as C text and decides nothing (#1467). " +
      "1.1 renders a file's user includes with it and 2.3 renders the " +
      "`.c`'s, which is `utils/`' admission test. Whether a directive is " +
      "C-Next is 1.1's answer, which both read (owner ruling 1).",
  },
  {
    from: "src/transpiler/data/__tests__/IncludeRewriter.test.ts",
    to: "src/utils/__tests__/IncludeRewriter.test.ts",
    because: "#1444: with its module.",
  },
  {
    from: "src/transpiler/types/IRunAnchor.ts",
    to: "src/PARSE/1-Discover/types/IRunAnchor.ts",
    because:
      "#1444, by #1653's ruling (\"a shared type that one area alone names " +
      'moves into it"): 1.1 decides the anchor (`RunAnchor.at`), and its ' +
      "only other importer is the orchestrator. Left in the shared root it " +
      "named `PathResolver` and `Preprocessor`, 1.1 modules, which " +
      "`shared-contracts-cannot-import-a-pass` forbids.",
  },
  {
    from: "src/transpiler/types/IPipelineFile.ts",
    to: "src/PARSE/1-Discover/types/IPipelineFile.ts",
    because:
      "#1444, the same ruling: one file of the `SourceGraph` 1.1 emits. Its " +
      "only importers are 1.1 and the orchestrator, and it names " +
      "`IDiscoveredFile`, a 1.1 type.",
  },
  // --- #1853: src/transpiler/types/ and constants/ to their homes ---------
  ...SHARED_ROOT_TYPES.map(
    (name): IMove => ({
      from: `src/transpiler/types/${name}`,
      to: `src/types/${name}`,
      because: SHARED_CONTRACT,
    }),
  ),
  {
    from: "src/transpiler/types/symbols",
    to: "src/types/symbols",
    because:
      "#1853: the symbol model every pass reads. Every module under it is " +
      "shared by the destination count, so the directory moves whole.",
  },
  {
    from: "src/transpiler/types/symbol-kinds",
    to: "src/types/symbol-kinds",
    because: "#1853: same, the kinds the symbol model is discriminated by.",
  },
  {
    from: "src/transpiler/types/__testUtils__",
    to: "src/types/__testUtils__",
    because: "#1853: the test helpers for the types they build.",
  },
  {
    from: "src/transpiler/types/IInMemorySource.ts",
    to: "src/PARSE/1-Discover/types/IInMemorySource.ts",
    because:
      "#1853: named only by 1.1's `Discover.ts`. The map listed it among the " +
      "types the orchestrator alone names, which stopped being true when " +
      "#1444 moved discovery out of the orchestrator.",
  },
  {
    from: "src/transpiler/types/IModificationFacts.ts",
    to: "src/PARSE/4-Resolve/types/IModificationFacts.ts",
    because:
      "#1853: named by 1.4 (`Program`, `IProgramInputs`) and by " +
      "`ModificationFacts.ts`, whose destination is 1.4 (#1825). One area by " +
      "destination, so it moves into it now and its last importer follows.",
  },
  {
    from: "src/transpiler/types/ITargetFieldSpec.ts",
    to: "src/PARSE/4-Resolve/types/ITargetFieldSpec.ts",
    because:
      "#1853: read by 1.4's `TargetDescriptions` and by " +
      "`TARGET_DESCRIPTION_FIELDS`, which moves to 1.4 below.",
  },
  {
    from: "src/transpiler/constants/TYPE_WIDTH.ts",
    to: "src/types/TYPE_WIDTH.ts",
    because:
      "#1853: read by more than one area. A shared constant, like " +
      "`FLOAT_TYPES`, which already sits in the types root.",
  },
  {
    from: "src/transpiler/constants/UNRESOLVED_DIMENSION.ts",
    to: "src/types/UNRESOLVED_DIMENSION.ts",
    because: "#1853: same.",
  },
  {
    from: "src/transpiler/constants/UNSET_SOURCE_SPAN.ts",
    to: "src/types/UNSET_SOURCE_SPAN.ts",
    because: "#1853: same.",
  },
  {
    from: "src/transpiler/constants/BITMAP_BACKING_TYPE.ts",
    to: "src/PARSE/3-Declare/cnext/collectors/BITMAP_BACKING_TYPE.ts",
    because:
      "#1853: read only by 1.3's `BitmapCollector`, so it goes beside it.",
  },
  {
    from: "src/transpiler/constants/BITMAP_SIZE.ts",
    to: "src/PARSE/3-Declare/cnext/collectors/BITMAP_SIZE.ts",
    because: "#1853: same reader.",
  },
  {
    from: "src/transpiler/constants/SMALL_PRIMITIVES.ts",
    to: "src/PARSE/4-Resolve/SMALL_PRIMITIVES.ts",
    because: "#1853: read only by 1.4's `Program`.",
  },
  {
    from: "src/transpiler/constants/TARGET_DESCRIPTION_FIELDS.ts",
    to: "src/PARSE/4-Resolve/TARGET_DESCRIPTION_FIELDS.ts",
    because: "#1853: read only by 1.4's `RunTarget` and `TargetDescriptions`.",
  },
  {
    from: "src/transpiler/constants/BUILTIN_TYPE_NAMES.ts",
    to: "src/TRANSPILE/1-Analyze/BUILTIN_TYPE_NAMES.ts",
    because: "#1853: read only by 2.1's undeclared-name analyzers.",
  },
  {
    from: "src/transpiler/constants/REJECTED_KEYWORDS.ts",
    to: "src/TRANSPILE/1-Analyze/REJECTED_KEYWORDS.ts",
    because:
      "#1853: read only by 2.1 (`LoopAnalyzer`, `UndeclaredValueAnalyzer`).",
  },
  {
    from: "src/transpiler/constants/SYSTEM_INCLUDE_TARGETS.ts",
    to: "src/TRANSPILE/2-Plan/SYSTEM_INCLUDE_TARGETS.ts",
    because: "#1853: read only by 2.2 (`EmissionPlan`, `HeaderIncludes`).",
  },
  {
    from: "src/transpiler/constants/LANGUAGE_STANDARD_FAMILY.ts",
    to: "src/utils/constants/LANGUAGE_STANDARD_FAMILY.ts",
    because:
      "#1853: read only by `utils/ToolchainRequirementUtils`, so it joins " +
      "`src/utils/constants/`, which the map's `constants/**` row places in " +
      "that root.",
  },
  {
    from: "src/transpiler/constants/LANGUAGE_STANDARD_ORDER.ts",
    to: "src/utils/constants/LANGUAGE_STANDARD_ORDER.ts",
    because: "#1853: same reader.",
  },
  {
    from: "src/transpiler/constants/TOOLCHAIN_REQUIREMENTS.ts",
    to: "src/utils/constants/TOOLCHAIN_REQUIREMENTS.ts",
    because: "#1853: same reader.",
  },
  {
    from: "src/transpiler/constants/STRUCT_POINTER_C_FUNCTIONS.ts",
    to: "src/utils/constants/STRUCT_POINTER_C_FUNCTIONS.ts",
    because: "#1853: read only by `utils/DeclaredPointer`.",
  },
  {
    from: "src/transpiler/constants/__tests__/TOOLCHAIN_REQUIREMENTS.test.ts",
    to: "src/utils/constants/__tests__/TOOLCHAIN_REQUIREMENTS.test.ts",
    because: "#1853: with its module.",
  },
  {
    from: "src/transpiler/constants/__tests__/STRUCT_POINTER_C_FUNCTIONS.test.ts",
    to: "src/utils/constants/__tests__/STRUCT_POINTER_C_FUNCTIONS.test.ts",
    because: "#1853: with its module.",
  },
  {
    from: "src/TRANSPILE/2-Plan/types/IModificationCollector.ts",
    to: "src/PARSE/3-Declare/cnext/types/IModificationCollector.ts",
    because:
      "#1825: what the per-file modification walk accumulates, which needs one " +
      "file's parse tree and nothing else. The walk moves to 1.3's collectors " +
      "and its working shape moves beside them, as the map's row decided.",
  },
  {
    from: "src/TRANSPILE/2-Plan/TransitiveModificationPropagator.ts",
    to: "src/PARSE/4-Resolve/TransitiveModificationPropagator.ts",
    because:
      "#1825: propagates parameter modification to a fixed point over the " +
      "whole call graph, a fact that needs every file. It sat in 2.2 only " +
      "because the code that fed it did, and 1.4 may not import TRANSPILE/.",
  },
  {
    from: "src/TRANSPILE/2-Plan/__tests__/TransitiveModificationPropagator.test.ts",
    to: "src/PARSE/4-Resolve/__tests__/TransitiveModificationPropagator.test.ts",
    because: "#1825: with its module.",
  },
  {
    from: "src/transpiler/ModificationFacts.ts",
    to: "src/PARSE/4-Resolve/ModificationFacts.ts",
    because:
      "#1825: derives which parameters the whole program modifies, a fact " +
      "that needs every file. It sat beside the orchestrator only because its " +
      "recognizer lived in 2.2; with the walk in 1.3's collectors, what is " +
      "left -- resolving callees and propagating over the call graph -- is 1.4.",
  },
  {
    from: "src/transpiler/CallbackCompatibility.ts",
    to: "src/PARSE/4-Resolve/CallbackCompatibility.ts",
    because:
      "#1825: decides which functions the whole program uses as ADR-029 " +
      "callbacks, a fact that needs every file (#1544). It sat beside the " +
      "orchestrator only because it ran a 2.1 analyzer for the answer; 1.3 " +
      "now records the uses and this applies the rule to them.",
  },
  {
    from: "src/TRANSPILE/2-Plan/__tests__/PassByValueAnalyzerCalleeResolution.test.ts",
    to: "src/PARSE/4-Resolve/__tests__/ModificationFactsCalleeResolution.test.ts",
    because:
      "#1825: tests the #1178 callee resolver, which moved from " +
      "`PassByValueAnalyzer` into `ModificationFacts` with the propagation it " +
      "serves.",
  },
  {
    from: "src/TRANSPILE/1-Analyze/types/TAssignmentSite.ts",
    to: "src/types/TAssignmentSite.ts",
    because: SHARED_CONTRACT,
  },
  {
    from: "src/lib/types/ITranspileError.ts",
    to: "src/types/ITranspileError.ts",
    because:
      "#1443: named by every layer, `types/` and both host roots. §1 forbids " +
      "going up into another root's interior (`../../lib/types/ITranspileError` " +
      "is its own example), so a contract read from outside `lib/` belongs in " +
      "the shared root.",
  },
  {
    from: "src/transpiler/types",
    to: "src/cli/types",
    because:
      "#1443: the four host types (#1853). Only the orchestrator, `cli/` and " +
      "the cache name them, and all three are the host's now.",
  },
  {
    from: "src/utils/cache",
    to: "src/cli/cache",
    because:
      "#1443: the header-symbol cache serves only the orchestrator, and " +
      "imports 1.3's `SymbolTable` and 3.1's `Write`, so it is not a " +
      "layer-neutral contract. The host owns the cache's lifetime (#1653).",
  },
  {
    from: "src/transpiler/Transpiler.ts",
    to: "src/cli/Transpiler.ts",
    because:
      "#1443: what is left once its pass logic moved into the passes -- " +
      "constructing the pipeline, ordering the stages, building the result " +
      "and owning the caches. README §1: only the host constructs the " +
      "pipeline.",
  },
  {
    from: "src/transpiler/__tests__",
    to: "src/cli/__tests__",
    because: "#1443: tests of the orchestrator, beside it.",
  },
  {
    from: "src/index.ts",
    to: "src/cli/index.ts",
    because:
      "#1443: README §1 -- no bare files at `src/`; each host root is " +
      "entered through its own `index.ts`.",
  },
  {
    from: "src/__tests__/index.test.ts",
    to: "src/cli/__tests__/index.test.ts",
    because: "#1443: the entry point's test follows the entry point.",
  },
  {
    from: "src/tests/utils/FunctionUtils.ts",
    to: "src/PARSE/3-Declare/__tests__/FunctionUtils.ts",
    because:
      "#1443: a test-only fixture factory whose one importer is " +
      "`3-Declare/__tests__/SymbolRegistry.test.ts`; `tests/` is not a §1 root.",
  },
  {
    from: "src/tests/utils/__tests__/FunctionUtils.test.ts",
    to: "src/PARSE/3-Declare/__tests__/FunctionUtils.test.ts",
    because: "#1443: follows `FunctionUtils`.",
  },
];

export default MOVES;
