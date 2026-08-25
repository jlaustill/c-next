import JsonCodec from "./JsonCodec";
import ESourceLanguage from "../types/ESourceLanguage";
import TJsonValue from "../types/TJsonValue";
import TCSymbol from "../../transpiler/types/symbols/c/TCSymbol";
import TCppSymbol from "../../transpiler/types/symbols/cpp/TCppSymbol";

/** Kinds a cached C symbol may declare (mirrors TSymbolKindC). */
const C_KINDS: ReadonlySet<string> = new Set([
  "function",
  "variable",
  "struct",
  "enum",
  "enum_member",
  "type",
]);

/** Kinds a cached C++ symbol may declare (mirrors TSymbolKindCpp). */
const CPP_KINDS: ReadonlySet<string> = new Set([
  "function",
  "variable",
  "struct",
  "enum",
  "enum_member",
  "class",
  "namespace",
  "type",
]);

/**
 * CachedSymbolReader
 *
 * Turns the JSON in a cache entry back into real `TCSymbol`/`TCppSymbol`
 * values, or rejects the entry.
 *
 * Validation is deliberately shallow — discriminant, source language, and the
 * fields every symbol has. It does NOT re-check each kind's own fields, and
 * that is the point: re-declaring the symbol model here would recreate exactly
 * the hand-maintained parallel list that issue #1225 exists to remove. Shape
 * fidelity comes from `JsonCodec` copying every field rather than naming any,
 * and staleness is handled by CACHE_VERSION and the transpiler version.
 *
 * What is left to catch is "this file is not symbols at all" — a truncated
 * write, a hand-edited cache, a file from another tool. That warrants
 * discarding the entry, which reads as a cache miss and costs only a re-parse.
 */
class CachedSymbolReader {
  /**
   * Decode a cache entry's symbols.
   *
   * @returns the symbols, or `null` if the entry is not trustworthy — callers
   *   must treat `null` as a cache miss rather than as "no symbols".
   */
  static read(encoded: TJsonValue[]): Array<TCSymbol | TCppSymbol> | null {
    if (!Array.isArray(encoded)) {
      return null;
    }

    const symbols: Array<TCSymbol | TCppSymbol> = [];
    for (const entry of encoded) {
      const decoded = JsonCodec.decode(entry);
      if (!CachedSymbolReader.isCachedSymbol(decoded)) {
        return null;
      }
      symbols.push(decoded);
    }
    return symbols;
  }

  /**
   * Does this decoded value carry the fields every C/C++ symbol has, with a
   * discriminant its language actually defines?
   *
   * C-Next symbols are rejected: they are never written to the cache (they are
   * re-parsed from source every run), so one appearing here means the entry is
   * not what it claims to be.
   */
  private static isCachedSymbol(
    value: unknown,
  ): value is TCSymbol | TCppSymbol {
    if (typeof value !== "object" || value === null) {
      return false;
    }

    const candidate = value as Record<string, unknown>;
    if (
      typeof candidate.name !== "string" ||
      typeof candidate.sourceFile !== "string" ||
      typeof candidate.sourceLine !== "number" ||
      typeof candidate.isExported !== "boolean" ||
      typeof candidate.kind !== "string"
    ) {
      return false;
    }

    if (candidate.sourceLanguage === ESourceLanguage.C) {
      return C_KINDS.has(candidate.kind);
    }
    if (candidate.sourceLanguage === ESourceLanguage.Cpp) {
      return CPP_KINDS.has(candidate.kind);
    }
    return false;
  }
}

export default CachedSymbolReader;
