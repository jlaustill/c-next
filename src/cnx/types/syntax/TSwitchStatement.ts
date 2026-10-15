import type TStatement from "./TStatement";

/** A lowered `switch` statement */
type TSwitchStatement = Extract<TStatement, { kind: "switch" }>;

export default TSwitchStatement;
