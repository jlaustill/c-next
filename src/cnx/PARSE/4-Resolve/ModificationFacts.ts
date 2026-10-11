/**
 * The whole-program parameter-modification facts (ADR-006).
 *
 * 1.3 Declare records what each file's functions do to their own parameters
 * (`ModificationCollector`). Whether a call passes a parameter to a callee
 * that modifies it needs the callee, which is routinely in another file -- so
 * resolving the callee and propagating along the call graph are 1.4's, here.
 *
 * #1825: this used to sit in the orchestration layer, running 2.2 Plan's
 * collector over every tree, because it was the one place both halves were
 * reachable and `PARSE/` may not import `TRANSPILE/`. `Program.build` is its
 * one caller now, so the orchestrator and the test harness cannot each spell
 * the sequence -- these facts decide generated signatures, and #1161's fixture
 * caught exactly that kind of divergence between a `.c` and its `.h` (#1511).
 */

import type SymbolTable from "../3-Declare/SymbolTable";
import type SymbolRegistry from "../3-Declare/SymbolRegistry";
import type IFileSymbols from "../../types/IFileSymbols";
import type IModificationFacts from "./types/IModificationFacts";
import type ICallGraphEntry from "../../types/ICallGraphEntry";
import type IDeclaredCall from "../../types/IDeclaredCall";
import TransitiveModificationPropagator from "./TransitiveModificationPropagator";
import ScopeUtils from "../../utils/ScopeUtils";
import QualifiedCName from "../../utils/QualifiedCName";
import ESourceLanguage from "../../utils/types/ESourceLanguage";

class ModificationFacts {
  /**
   * Derive the parameter-modification facts for the WHOLE program.
   *
   * Every file's facts are merged first and the graph is propagated once,
   * which is what makes the result independent of file order. A later file's
   * declaration of a name replaces an earlier one's, as the single walk over
   * every tree that preceded this did.
   *
   * @param files every file's `IFileSymbols`, in declaration order
   * @param registry the run's scope graph; null where a test builds a program
   *        without one, which resolves every bare callee as written
   */
  static derive(
    files: ReadonlyArray<IFileSymbols>,
    registry: SymbolRegistry | null,
    symbolTable: SymbolTable,
  ): IModificationFacts {
    const functionParamLists = new Map<string, ReadonlyArray<string>>();
    // Copied, because propagation adds to these sets and 1.3's artifact must
    // keep saying what each file wrote.
    const modifiedParameters = new Map<string, Set<string>>();
    const declaredCalls = new Map<string, ReadonlyArray<IDeclaredCall>>();
    for (const file of files) {
      const facts = file.modifications;
      for (const [name, params] of facts.functionParamLists) {
        functionParamLists.set(name, params);
      }
      for (const [name, params] of facts.modifiedParameters) {
        modifiedParameters.set(name, new Set(params));
      }
      for (const [name, calls] of facts.calls) {
        declaredCalls.set(name, calls);
      }
    }

    // Resolved only now: the registry holds every file's scopes, so a bare
    // call into a scope reopened elsewhere (#1333) finds its member.
    const callGraph = new Map<string, ReadonlyArray<ICallGraphEntry>>();
    for (const [caller, calls] of declaredCalls) {
      callGraph.set(
        caller,
        calls.map((call) => ({
          callee: call.calleeIsBare
            ? ModificationFacts.resolveBareCallee(registry, caller, call.callee)
            : call.callee,
          paramIndex: call.paramIndex,
          argParamName: call.argParamName,
        })),
      );
    }

    // The C-Next symbols are not in the table yet -- `_publishResolvedFile`
    // puts them there, after this. Without them every scope field holding a
    // callback reads as an undeclared function, so #1178's fail-safe fires on
    // the very calls it exists to spare and the parameter is wrongly promoted
    // to a pointer. They are in hand right here, so the predicate is supplied
    // rather than left to depend on when a mutable table happens to be filled.
    const cnextValueCNames = new Set<string>();
    for (const file of files) {
      for (const symbol of file.symbols) {
        if (symbol.kind === "variable") {
          cnextValueCNames.add(symbol.fullyQualifiedCName);
        }
      }
    }
    ModificationFacts.propagate(
      callGraph,
      functionParamLists,
      modifiedParameters,
      symbolTable,
      (name: string): boolean =>
        cnextValueCNames.has(name) ||
        symbolTable
          .getOverloadsByCName(name)
          .some((symbol) => symbol.kind === "variable"),
    );

    return { modifiedParameters, functionParamLists };
  }

  /**
   * Issue #797: Resolve a bare function name to its scope-qualified name.
   * When inside a scope, bare calls like `fillData()` should resolve to
   * `Scope__fillData`, through ADR-057's scope chain. A name the chain does
   * not resolve -- a C or C++ function, or one this build cannot see -- is
   * the name as written.
   */
  private static resolveBareCallee(
    registry: SymbolRegistry | null,
    callerFuncName: string,
    bareCalleeName: string,
  ): string {
    if (!registry) return bareCalleeName;
    const callerScope = registry.getScopeByCFunctionName(callerFuncName);
    if (!callerScope) return bareCalleeName;
    const callee = registry.resolveFunction(bareCalleeName, callerScope);
    // ScopeUtils.getTranspiledCName is the single encoder for symbol identity.
    return callee ? ScopeUtils.getTranspiledCName(callee) : bareCalleeName;
  }

  /**
   * Run transitive modification propagation with the project's standard
   * callee resolver.
   *
   * Public for the resolver's own tests, which drive it with a call graph
   * rather than a program. `isValueSymbol` is required because the table is
   * filled as files are PUBLISHED, after this runs: asking it alone answers
   * "no" for every C-Next scope field, which turns each callback into an
   * unresolvable callee and fires #1178's fail-safe on exactly the calls #1178
   * exists to spare -- a wrong answer produced by call ORDER, not by the
   * program.
   *
   * @param modifiedParameters added to in place
   */
  static propagate(
    callGraph: ReadonlyMap<string, ReadonlyArray<ICallGraphEntry>>,
    functionParamLists: ReadonlyMap<string, ReadonlyArray<string>>,
    modifiedParameters: Map<string, Set<string>>,
    symbolTable: SymbolTable,
    isValueSymbol: (name: string) => boolean,
  ): void {
    TransitiveModificationPropagator.propagate(
      callGraph,
      functionParamLists,
      modifiedParameters,
      (callerName: string, callee: string, paramIndex: number): boolean =>
        ModificationFacts.calleeMayMutateParameter(
          functionParamLists,
          callerName,
          callee,
          paramIndex,
          isValueSymbol,
          symbolTable,
        ),
    );
  }

  /**
   * Whether this call invokes a value rather than a named function.
   *
   * An ADR-029 callback is called through a parameter (`cb(value)`), a scope
   * field (`listener(s)`) or a struct field (`config.listener(s)`). The name
   * recorded in the call graph is that value's, so no declaration will ever
   * match it -- which is a different fact from "this function is declared
   * somewhere this build cannot see".
   */
  private static calleeIsIndirectCall(
    functionParamLists: ReadonlyMap<string, ReadonlyArray<string>>,
    callerName: string,
    callee: string,
    isValueSymbol: (name: string) => boolean,
  ): boolean {
    const root = QualifiedCName.split(callee)[0];
    const callerParameters = functionParamLists.get(callerName) ?? [];
    if (callerParameters.includes(callee) || callerParameters.includes(root)) {
      return true;
    }
    if (isValueSymbol(callee) || isValueSymbol(root)) {
      return true;
    }

    // A scope field is indexed under its transpiled name (`Bus__listener`),
    // while the call graph records the bare name the source used, so qualify
    // with the caller's own scope before giving up.
    //
    // #1357: swap the caller's own leaf for the field name, keeping every
    // component before it. Taking `split(...)[0]` read only the OUTERMOST
    // component, so at depth two `Outer__Inner__handler` asked about
    // `Outer__field` -- a name that does not exist -- instead of
    // `Outer__Inner__field`.
    const parts = QualifiedCName.split(callerName);
    if (parts.length < 2) return false;
    parts[parts.length - 1] = root;
    return isValueSymbol(QualifiedCName.fromParts(parts));
  }

  /**
   * Issue #1178: answer "may this callee mutate the caller's argument through
   * this parameter?" for a callee that is not a C-Next function in this build.
   *
   * The propagator reaches here only when `functionParamLists` has no entry for
   * the callee. That used to mean "assume pure", which applied auto-const on the
   * strength of an absent answer. A C or C++ declaration is a definitive answer,
   * so consult it; only a callee nothing knows about falls back to the safe
   * assumption that it mutates.
   */
  private static calleeMayMutateParameter(
    functionParamLists: ReadonlyMap<string, ReadonlyArray<string>>,
    callerName: string,
    callee: string,
    paramIndex: number,
    isValueSymbol: (name: string) => boolean,
    symbolTable: SymbolTable,
  ): boolean {
    // ADR-029: an indirect call invokes a *value* -- a callback parameter, a
    // scope field, a struct field -- not a function name. Nothing will ever
    // declare it, so failing safe would fire on every callback that forwards
    // one of its caller's parameters, by construction rather than by accident.
    // Keep the pre-#1178 answer there; resolving the callback's declared
    // target is tracked separately.
    if (
      ModificationFacts.calleeIsIndirectCall(
        functionParamLists,
        callerName,
        callee,
        isValueSymbol,
      )
    ) {
      return false;
    }

    const symbols = symbolTable.getOverloadsByCName(callee);
    let sawCandidate = false;

    // Fold across every overload rather than answering from the first one.
    // Returning on the first match made the answer depend on declaration order
    // in the header: `store(const Sample&)` declared before
    // `store(Sample&, bool)` claimed the call could not mutate, for a call that
    // can only resolve to the second. Any candidate that may mutate wins.
    for (const symbol of symbols) {
      if (symbol.kind !== "function") continue;
      // getOverloadsByCName spans all three languages. A C-Next IFunctionSymbol
      // also has kind "function", but its IParameterInfo.type is a TType
      // object rather than a string, so the structural read below would be a
      // lie for it -- and typeIsIndirect would call .replace() on an object.
      // This method's premise is "not a C-Next function in this build", so say
      // so rather than letting the cast paper over it.
      if (symbol.sourceLanguage === ESourceLanguage.CNext) continue;
      const parameters = (
        symbol as {
          parameters?: ReadonlyArray<{
            type?: string;
            isArray?: boolean;
            isConst?: boolean;
          }>;
        }
      ).parameters;
      const parameter = parameters?.[paramIndex];
      if (!parameter) continue;
      sawCandidate = true;
      if (
        ModificationFacts.parameterCarriesIndirection(
          parameter.type ?? "",
          parameter.isArray ?? false,
          parameter.isConst ?? false,
          symbolTable,
        )
      ) {
        return true;
      }
    }

    // Nothing declares this callee at this position -- withhold auto-const
    // rather than assume purity. Explicit rather than a fallthrough.
    return !sawCandidate;
  }

  /**
   * Whether a C/C++ parameter lets the callee change something the caller can
   * observe.
   *
   * A by-value parameter is a copy, so it cannot. An array, pointer or
   * reference can -- unless the declaration says const, in which case the
   * callee may not write through it and auto-const on the caller's parameter
   * is still sound.
   */
  private static parameterCarriesIndirection(
    type: string,
    isArray: boolean,
    isConst: boolean,
    symbolTable: SymbolTable,
  ): boolean {
    if (isConst) return false;
    if (isArray) return true;
    return ModificationFacts.typeIsIndirect(type, symbolTable);
  }

  /**
   * Follow typedef aliases looking for pointer or reference indirection.
   * A typedef can hide it entirely (`typedef struct spi_device_t
   * *spi_device_handle_t`), so the alias chain is followed rather than the
   * spelling pattern-matched. Bounded so a self-referential chain cannot spin.
   */
  private static typeIsIndirect(
    type: string,
    symbolTable: SymbolTable,
  ): boolean {
    let current = type;
    const seen = new Set<string>();
    for (let hop = 0; hop < 8; hop++) {
      if (/[*&]/.test(current)) return true;
      const bare = current
        .replace(/\b(const|volatile|struct|union|enum)\b/g, "")
        .trim();
      // Both exits mean the chain is known and unfinished, exactly as running
      // out of hops does below -- so they answer the same way. An empty type is
      // unknown rather than by-value for the same reason. Neither is reachable
      // from valid C (a self-referential typedef is ill-formed and
      // ICParameterInfo.type is a required string), so nothing observable turns
      // on it; they are aligned so the three exits do not read as disagreeing.
      if (!bare || seen.has(bare)) return true;
      seen.add(bare);
      const alias = ModificationFacts.resolveTypedefTarget(bare, symbolTable);
      // Deliberate exception: an alias this build never parsed (uint8_t,
      // size_t) is treated as a plain value. Calling it indirection would
      // reintroduce exactly the #957/#995 false positives measured for #1178.
      if (alias === null) return false;
      current = alias;
    }
    // Out of hops means the chain is known and unfinished, not unknown --
    // answering "by value" here would be the same collapse of "I cannot tell"
    // into "it is pure" that #1178 removes one level up.
    return true;
  }

  /**
   * The underlying type of a C/C++ typedef, or null when the name is not a
   * typedef this build has seen.
   */
  private static resolveTypedefTarget(
    name: string,
    symbolTable: SymbolTable,
  ): string | null {
    const symbols = symbolTable.getOverloadsByCName(name);
    for (const symbol of symbols) {
      if (symbol.kind !== "type") continue;
      const aliased = (symbol as { type?: string }).type;
      if (typeof aliased === "string" && aliased.length > 0) return aliased;
    }
    return null;
  }
}

export default ModificationFacts;
