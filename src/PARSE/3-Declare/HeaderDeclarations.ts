import HeaderParser from "../2-Parse/HeaderParser";
import EHeaderLanguage from "../1-Discover/types/EHeaderLanguage";
import type IRecoveredSlice from "../1-Discover/types/IRecoveredSlice";
import CaughtError from "../../utils/CaughtError";
import CResolver from "./c/index";
import CppResolver from "./cpp/index";
import SymbolTable from "./SymbolTable";

/**
 * 1.3 Declare for C and C++ headers: one header's text, parsed with the parser
 * of the language 1.1 judged it to be, and its symbols written to the table.
 *
 * Moved out of the orchestrator by #1443. Everything here needs one header's
 * text and nothing else, which is `IFileSymbols`' admission test for 1.3.
 */
class HeaderDeclarations {
  /**
   * Issue #208: one parser per header, the one its language names. #1844:
   * the language is 1.1's answer; nothing here judges the text again, so a
   * cold run and a warm one cannot disagree (#1851).
   */
  static declare(
    content: string,
    filePath: string,
    language: EHeaderLanguage,
    symbolTable: SymbolTable,
  ): void {
    switch (language) {
      case EHeaderLanguage.Assembler:
        // Not C: parsing its `.macro` bodies as C mis-collects instruction
        // mnemonics like `loop` as C symbols that then false-conflict with
        // C-Next symbols of the same name.
        return;
      case EHeaderLanguage.Cpp:
        // C++14 parser for typed enums, classes, namespaces, templates
        HeaderDeclarations.declareCpp(content, filePath, symbolTable);
        return;
      case EHeaderLanguage.C:
        HeaderDeclarations.declarePureC(content, filePath, symbolTable);
        return;
    }
  }

  /**
   * Parse every recovered slice (#1279) into the run's table, and return a
   * clean per-file re-parse of the same slices for `clearPhantomStructBodies`.
   *
   * The clean pass parses each slice as C on its own: only its opaque/body
   * verdict is consulted (opaque struct typedefs are a C concern), and it
   * tolerates slices it cannot parse -- except a deliberate diagnostic, which
   * propagates.
   */
  static recoverSlices(
    slices: ReadonlyMap<string, IRecoveredSlice>,
    symbolTable: SymbolTable,
  ): SymbolTable {
    const cleanState = new SymbolTable();
    for (const [path, { text: content, language }] of slices) {
      try {
        HeaderDeclarations.declare(content, path, language, symbolTable);
      } catch (err) {
        // #1319: same decision as the sibling catch in the host's header loop:
        // swallowing a diagnostic here would produce the `Compiled N files` /
        // exit 0 shape diagnostics exist to remove -- so "is this a deliberate
        // diagnostic?" is answered in both places or in neither.
        if (CaughtError.isDiagnostic(err)) {
          throw err;
        }
        // A slice that won't parse leaves the (already-collected) symbols as they
        // were — skip it rather than fail the build.
      }
      const { tree } = HeaderParser.parseC(content);
      if (!tree) continue;
      try {
        CResolver.resolve(tree, path, cleanState);
      } catch {
        /* isolated best-effort — only its opaque/body verdict is consulted */
      }
    }
    return cleanState;
  }

  /**
   * Undo PHANTOM struct bodies: when the normal pass parsed a header's huge
   * preprocessed blob, ANTLR error-recovery could fabricate a `struct X { ... }`
   * that was never really there (e.g. lvgl `struct _lv_obj_t`), which makes an
   * opaque typedef look complete and defeats pointer codegen. The clean per-file
   * re-parse (`cleanState`) is authoritative, so for every type it proves opaque,
   * clear any body its tag does NOT actually have.
   */
  static clearPhantomStructBodies(
    cleanState: SymbolTable,
    symbolTable: SymbolTable,
  ): void {
    const cleanBodies = new Set(cleanState.getAllStructTagsWithBodies());
    for (const typedefName of cleanState.getAllOpaqueTypes()) {
      if (!cleanState.isOpaqueType(typedefName)) continue;
      const tag = symbolTable.getStructTagForTypedef(typedefName);
      if (tag && !cleanBodies.has(tag)) {
        symbolTable.clearStructTagHasBody(tag);
      }
    }
  }

  /**
   * Issue #208: Parse a pure C header (no C++ syntax detected)
   * Uses CResolver for symbol collection
   * ADR-055 Phase 7: Direct TCSymbol storage (no adapter conversion)
   */
  private static declarePureC(
    content: string,
    filePath: string,
    symbolTable: SymbolTable,
  ): void {
    const { tree } = HeaderParser.parseC(content);
    if (tree) {
      const result = CResolver.resolve(tree, filePath, symbolTable);
      // ADR-055 Phase 7: Store TCSymbol directly
      symbolTable.addCSymbols(result.symbols);
    }
  }

  /**
   * Parse a C++ header using CppResolver
   * ADR-055 Phase 7: Direct TCppSymbol storage (no adapter conversion)
   */
  private static declareCpp(
    content: string,
    filePath: string,
    symbolTable: SymbolTable,
  ): void {
    const { tree } = HeaderParser.parseCpp(content);
    if (tree) {
      const result = CppResolver.resolve(tree, filePath, symbolTable);
      // ADR-055 Phase 7: Store TCppSymbol directly
      symbolTable.addCppSymbols(result.symbols);
    }
  }
}

export default HeaderDeclarations;
