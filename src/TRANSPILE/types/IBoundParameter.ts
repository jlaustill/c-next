import type TParameterInfo from "../../types/TParameterInfo";

/**
 * #1290 review: a parameter a name binds to where it is used, with the C name
 * it is emitted under there (ADR-057). A site that holds the parameter holds
 * its C name too, so none can emit the spelling as written by mistake.
 */
interface IBoundParameter {
  readonly info: TParameterInfo;
  readonly emittedName: string;
}

export default IBoundParameter;
