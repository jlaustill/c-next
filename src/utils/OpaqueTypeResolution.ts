/**
 * Is a typedef truly opaque?
 *
 * A header may forward-declare `struct _widget_t`, typedef it, and only later
 * define the struct — in that header or in another one the program includes. So
 * "declared against a forward declaration" is not the answer; the answer is
 * whether a body ever arrived for the tag (#948, #958).
 *
 * The rule lives here because two callers need it and they cannot import each
 * other: `SymbolTable` answers it for a throwaway table during #985 phantom-body
 * recovery, and 1.4 Resolve authors it as a fact of the program. Sharing the
 * DECISION rather than the data is the point — two copies agreeing today would
 * be a latent divergence, and this one already had one: the guard below is
 * truthy, so an empty tag means "no tag", where a `!== undefined` spelling would
 * have treated it as a real one (#1511).
 */
class OpaqueTypeResolution {
  /**
   * @param typeName The typedef being asked about
   * @param opaqueTypedefs Typedefs declared against a forward-declared struct
   * @param typedefToTag Typedef name to the struct tag it aliases
   * @param structTagsWithBodies Tags that received a full definition
   */
  static isOpaque(
    typeName: string,
    opaqueTypedefs: ReadonlySet<string>,
    typedefToTag: ReadonlyMap<string, string>,
    structTagsWithBodies: ReadonlySet<string>,
  ): boolean {
    if (!opaqueTypedefs.has(typeName)) {
      return false;
    }
    const tag = typedefToTag.get(typeName);
    if (tag && structTagsWithBodies.has(tag)) {
      return false;
    }
    return true;
  }

  /** Every truly opaque typedef among those declared. */
  static resolveAll(
    opaqueTypedefs: ReadonlySet<string>,
    typedefToTag: ReadonlyMap<string, string>,
    structTagsWithBodies: ReadonlySet<string>,
  ): Set<string> {
    const opaque = new Set<string>();
    for (const typeName of opaqueTypedefs) {
      if (
        OpaqueTypeResolution.isOpaque(
          typeName,
          opaqueTypedefs,
          typedefToTag,
          structTagsWithBodies,
        )
      ) {
        opaque.add(typeName);
      }
    }
    return opaque;
  }
}

export default OpaqueTypeResolution;
