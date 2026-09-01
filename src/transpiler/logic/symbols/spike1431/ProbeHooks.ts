/**
 * SPIKE #1431 — THROWAWAY. Deleted before this branch merges.
 *
 * The one-line call each live accessor makes. Keeping the observation logic here
 * rather than inline in `CodeGenState` means each hooked accessor gains exactly one
 * statement, so the edits are small enough to read and to revert.
 *
 * INVARIANT: nothing under `spike1431/` may import `CodeGenState`, or any other
 * module in `state/`. `state/CodeGenState` imports this file, and ten
 * `logic/analysis/` modules import `CodeGenState`, so an import back into `state/`
 * would close a module cycle that `.dependency-cruiser.cjs`'s `no-circular` rule
 * would reject -- correctly. Everything this needs is passed in as an argument
 * instead, which is why `isOpaqueType` takes the run-wide opaque set rather than
 * reaching for it.
 */
import type IFactStore from "./types/IFactStore";
import ViewProbe from "./ViewProbe";
import Views from "./Views";

class ProbeHooks {
  private static store: IFactStore | null = null;
  private static currentFile: string | null = null;

  static install(store: IFactStore | null, currentFile: string | null): void {
    ProbeHooks.store = store;
    ProbeHooks.currentFile = currentFile;
  }

  private static ready(): boolean {
    return (
      ViewProbe.isArmed() &&
      ProbeHooks.store !== null &&
      ProbeHooks.currentFile !== null
    );
  }

  static observeIsKnownStruct(name: string, live: boolean): void {
    if (!ProbeHooks.ready()) {
      return;
    }
    const derived = Views.isKnownStruct(
      ProbeHooks.store!,
      ProbeHooks.currentFile!,
      name,
    );
    ViewProbe.record(
      "CodeGenState.isKnownStruct",
      name,
      String(live),
      String(derived.asSpecified),
      String(derived.asPrincipled),
    );
  }

  static observeIsScopeType(
    qualifiedName: string,
    live: boolean,
    typeFormingKinds: ReadonlySet<string>,
  ): void {
    if (!ProbeHooks.ready()) {
      return;
    }
    const derived = Views.isScopeType(
      ProbeHooks.store!,
      ProbeHooks.currentFile!,
      qualifiedName,
      typeFormingKinds,
    );
    ViewProbe.record(
      "CodeGenState.isScopeType",
      qualifiedName,
      String(live),
      String(derived.asSpecified),
      String(derived.asPrincipled),
    );
  }

  static observeIsKnownScope(name: string, live: boolean): void {
    if (!ProbeHooks.ready()) {
      return;
    }
    const derived = Views.isKnownScope(
      ProbeHooks.store!,
      ProbeHooks.currentFile!,
      name,
    );
    ViewProbe.record(
      "CodeGenState.isKnownScope",
      name,
      String(live),
      String(derived.asSpecified),
      String(derived.asPrincipled),
    );
  }

  static observeIsOpaqueType(
    typeName: string,
    live: boolean,
    runWideOpaque: ReadonlySet<string>,
  ): void {
    if (!ProbeHooks.ready()) {
      return;
    }
    const derived = Views.isOpaqueType(
      ProbeHooks.store!,
      ProbeHooks.currentFile!,
      typeName,
      runWideOpaque,
    );
    ViewProbe.record(
      "CodeGenState.isOpaqueType",
      typeName,
      String(live),
      String(derived.asSpecified),
      String(derived.asPrincipled),
    );
  }
}

export default ProbeHooks;
