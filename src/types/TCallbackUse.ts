/**
 * A place one file names a function where a C callback could be expected
 * (#1825): ADR-029's per-file half, collected by 1.3 Declare.
 *
 * Neither shape is a callback yet. Whether it is one needs the C header's
 * typedef, and whether the name is a function needs every file's declarations
 * (#1544), so 1.4 Resolve decides. `functionName` is the lookup key -- the
 * transpiled C name the reference spells -- and the uses are kept in source
 * order, because a later use of a function wins the typedef it is recorded
 * against.
 */
type TCallbackUse =
  /** `PointCallback cb <- my_handler;` */
  | {
      readonly kind: "initializer";
      readonly functionName: string;
      /** The declared type, as written. */
      readonly typeName: string;
    }
  /** `global.widget_set_flush_cb(w, my_flush);` (#895) */
  | {
      readonly kind: "argument";
      readonly functionName: string;
      /** The function called, as its C symbol is named. */
      readonly callee: string;
      readonly argIndex: number;
    };

export default TCallbackUse;
