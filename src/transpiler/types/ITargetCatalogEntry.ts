import type TTargetFieldValue from "./TTargetFieldValue";

/**
 * One `const` of the target catalog, read as plain data by 1.2 Parse.
 *
 * `fields` holds a struct initializer's literal fields; `value` a scalar
 * constant's literal. A value that is not a literal is left out here and
 * reported in the source's `errors`, so nothing downstream sees a guess.
 */
interface ITargetCatalogEntry {
  readonly constName: string;
  readonly typeName: string;
  readonly line: number;
  readonly fields: ReadonlyMap<string, TTargetFieldValue>;
  readonly value?: TTargetFieldValue;
}

export default ITargetCatalogEntry;
