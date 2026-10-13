import type TValueSite from "./TValueSite";

/** A value's innermost site, and the site that encloses that one (#1991) */
interface IValueSite {
  readonly site: TValueSite;
  /** Null at a statement's outermost value */
  readonly outer: IValueSite | null;
}

export default IValueSite;
