/**
 * The JSON-representable form of `T`.
 *
 * `Set` becomes an array and `Map` becomes an array of entry pairs; everything
 * else is structurally unchanged. Because it is a homomorphic mapped type over
 * `keyof T`, a field added to `T` appears here immediately — so a serializer
 * declared to return `TJsonSafe<T>` fails to compile until it writes that field.
 *
 * That is the point. Issue #1225: `IStructSymbolState` gained `pointerTypedefs`
 * and the cache's hand-written capture list did not, which nothing detected.
 */
type TJsonSafe<T> = T extends string | number | boolean | null | undefined
  ? T
  : T extends ReadonlyMap<infer TKey, infer TValue>
    ? Array<[TJsonSafe<TKey>, TJsonSafe<TValue>]>
    : T extends ReadonlySet<infer TMember>
      ? TJsonSafe<TMember>[]
      : T extends readonly (infer TElement)[]
        ? TJsonSafe<TElement>[]
        : T extends object
          ? { [TProperty in keyof T]: TJsonSafe<T[TProperty]> }
          : T;

export default TJsonSafe;
