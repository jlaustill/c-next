import type IArgumentGeneratorCallbacks from "./IArgumentGeneratorCallbacks";

/** What decides an argument's form, read off the argument without rendering it */
type TArgumentShape = Omit<IArgumentGeneratorCallbacks, "generateExpression">;

export default TArgumentShape;
