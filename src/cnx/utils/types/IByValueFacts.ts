import type IProgram from "../../types/IProgram";

/** What the by-value decision reads; each pass hands over its own view */
interface IByValueFacts {
  readonly program: IProgram | null;
  /** The callback types the reader has registered so far */
  readonly callbackTypes: { has(typeName: string): boolean };
  isKnownStruct(typeName: string): boolean;
}

export default IByValueFacts;
