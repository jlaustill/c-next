import type IPlannedArrayDeclaration from "./IPlannedArrayDeclaration";
import type IRenderedModifiers from "./IRenderedModifiers";
import type TPlannedStringDecl from "./TPlannedStringDecl";
import type TPlannedVariableInitializer from "./TPlannedVariableInitializer";

/**
 * One variable declaration, reduced to which of three forms it takes.
 *
 * #1445 box 3: `VariableDeclHelper` was handed a `VariableDeclarationContext`
 * and asked it the same questions repeatedly -- is there an initializer, is
 * there an arrayType, what are the trailing dimensions -- across four helpers
 * and four callback interfaces, each naming its own subset of grammar types.
 * The questions are answered once now, by `CodeGenerator.planVariableDecl`.
 *
 * ## The planner writes state, and it has to
 *
 * Building this plan registers the variable's type info, marks it as a pointer
 * when its type was inferred as one, and resolves its EMITTED name. Those are
 * writes, and they are ordered against each other and against the reads that
 * follow: `emittedLocalName` is only correct after registration, and ADR-045's
 * string discrimination reads the type registry that registration filled --
 * which is why `string<32> s <- s + "x"` is detected as a concatenation at all.
 *
 * So this is not a pure description computed ahead of time. It is built
 * immediately before it is rendered, in the same call, and the ordering inside
 * the planner is the ordering the renderer used to perform.
 */
type TPlannedVariableDecl =
  /**
   * Issue #375: `Type name(arg, arg);` -- C++ constructor syntax.
   *
   * `emittedName` is the post-registration name (ADR-057): the planner
   * registers the variable in the type registry as an external C++ type and,
   * inside a function body, as a local, and only then asks what it is emitted
   * as. Those writes are the reason this arm is planned rather than described.
   */
  | {
      readonly kind: "constructor";
      readonly type: string;
      readonly emittedName: string;
      readonly args: readonly string[];
    }
  /** ADR-045: a string declaration, in one of its own three forms. */
  | {
      readonly kind: "string";
      readonly string: TPlannedStringDecl;
      readonly emittedName: string;
      readonly modifiers: IRenderedModifiers;
      readonly isConst: boolean;
    }
  /** Everything else. */
  | {
      readonly kind: "plain";
      /**
       * The name AS WRITTEN.
       *
       * ADR-057: every registry keys on this, because it is what references in
       * the source say. Only the emitted text moves.
       */
      readonly sourceName: string;
      /** The identifier this declaration is emitted under (ADR-057). */
      readonly emittedName: string;
      readonly modifierPrefix: string;
      readonly type: string;
      readonly array: IPlannedArrayDeclaration;
      readonly initializer: TPlannedVariableInitializer;
    };

export default TPlannedVariableDecl;
