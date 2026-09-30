/**
 * VariableCollector - Extracts variable declarations from parse trees.
 * Handles types, const modifier, arrays, and initial values.
 *
 * Produces TType-based IVariableSymbol with proper IScopeSymbol references.
 */

import * as Parser from "../../../2-Parse/grammar/CNextParser";
import DimensionResolver from "../utils/DimensionResolver";
import ESourceLanguage from "../../../../utils/types/ESourceLanguage";
import IVariableSymbol from "../../../../transpiler/types/symbols/IVariableSymbol";
import ArrayInitializerUtils from "../utils/ArrayInitializerUtils";
import TypeUtils from "../utils/TypeUtils";
import StringUtils from "../../../../utils/StringUtils";
import TTypeUtils from "../../../../utils/TTypeUtils";
import type TType from "../../../../transpiler/types/TType";
import type TOverflowBehavior from "../../../../transpiler/types/TOverflowBehavior";
import ScopeUtils from "../../../../utils/ScopeUtils";
import TVisibility from "../../../../transpiler/types/TVisibility";
import OverflowBehaviorUtils from "../../../../utils/OverflowBehaviorUtils";
import ParserUtils from "../../../../utils/ParserUtils";
import ExpressionUnwrapper from "../../../../utils/ExpressionUnwrapper";

class VariableCollector {
  /**
   * Resolve a variable's declared type.
   *
   * ADR-045: a bare `string` takes its capacity from the initializing literal.
   * TypeResolver cannot do this on the type string alone — bare `string` matches
   * no pattern there and falls through to a *struct* named "string", which the
   * header then emits verbatim (`extern const string VERSION;`). The `.c` path
   * inferred the capacity independently, so the two disagreed silently until
   * the `.c` began including its own header (#1164).
   *
   * The inference rule itself is StringUtils.literalLength, shared with codegen.
   */
  private static resolveDeclaredType(
    typeStr: string,
    ctx: Parser.VariableDeclarationContext | Parser.ForVarDeclContext,
    resolved: TType,
  ): TType {
    if (typeStr !== "string") {
      return resolved;
    }

    const initText = ctx.expression()?.getText() ?? "";
    if (!initText.startsWith('"') || !initText.endsWith('"')) {
      return resolved;
    }

    return TTypeUtils.createString(StringUtils.literalLength(initText));
  }

  /**
   * Resolve a single array dimension to a number or string.
   * Returns undefined if the dimension cannot be resolved.
   */
  private static resolveDimension(
    dim: Parser.ArrayDimensionContext,
    initExpr: Parser.ExpressionContext | null,
  ): number | string | undefined {
    const sizeExpr = dim.expression();

    // A literal folds here; a const or a C macro keeps its text (#455), and
    // 1.4 folds a const where the declaration is written (#1664 box 7)
    if (sizeExpr) {
      return DimensionResolver.resolve(sizeExpr);
    }

    // Issue #636: Empty dimension [] - infer size from array initializer
    if (initExpr) {
      return ArrayInitializerUtils.getInferredSize(initExpr);
    }

    return undefined;
  }

  /**
   * Collect array dimensions from a variable declaration.
   */
  private static collectArrayDimensions(
    arrayDims: Parser.ArrayDimensionContext[],
    initExpr: Parser.ExpressionContext | null,
  ): (number | string)[] {
    const dimensions: (number | string)[] = [];

    for (const dim of arrayDims) {
      const resolved = VariableCollector.resolveDimension(dim, initExpr);
      if (resolved !== undefined) {
        dimensions.push(resolved);
      }
    }

    return dimensions;
  }

  /**
   * Collect dimensions from C-Next style arrayType syntax (u16[8] arr, u16[4][4] arr, u16[] arr).
   * Handles size inference from initializer when dimension is empty.
   */
  private static collectArrayTypeDimensions(
    arrayTypeCtx: Parser.ArrayTypeContext,
    initExpr: Parser.ExpressionContext | null,
  ): (number | string)[] {
    const dimensions: (number | string)[] = [];
    for (const dim of arrayTypeCtx.arrayTypeDimension()) {
      const sizeExpr = dim.expression();

      if (!sizeExpr) {
        // Issue #636: Empty dimension [] - infer size from array initializer
        if (initExpr) {
          const inferredSize = ArrayInitializerUtils.getInferredSize(initExpr);
          if (inferredSize !== undefined) {
            dimensions.push(inferredSize);
          }
        }
        continue;
      }

      // Issue #1127: fold through the shared resolver so a dimension resolves
      // identically here and in codegen. Folding only literals and consts here
      // meant `u8[sizeof(u32)]` reached the header as `sizeof(u32)` -- a
      // C-Next type name in generated C, which does not compile -- while the
      // .c correctly said [4]. Text that does not fold is still kept, for macro and
      // enum references.
      dimensions.push(DimensionResolver.resolve(sizeExpr));
    }
    return dimensions;
  }

  /**
   * What a declaration SAYS: its type, modifiers, dimensions and initializer.
   *
   * #1668: shared by a global or scope member (`collect`, below) and a local
   * or `for` variable (`LexicalScopeCollector`), so a declaration means the
   * same thing wherever it is written. No const folds here: a literal or
   * `sizeof` dimension folds, and every name stays its text for 1.4 Resolve
   * to fold in the declaration's lexical environment (#1664 box 7).
   */
  static declaredFacts(
    ctx: Parser.VariableDeclarationContext | Parser.ForVarDeclContext,
    scopePath: string,
    isScopeType?: (qualifiedName: string) => boolean,
  ): {
    type: TType;
    isConst: boolean;
    isAtomic: boolean;
    isVolatile: boolean;
    overflowBehavior: TOverflowBehavior;
    isArray: boolean;
    arrayDimensions: (number | string)[];
    initialValue: string | undefined;
    initializerCallee: string | null;
  } {
    // Get type string and convert to TType
    const typeCtx = ctx.type()!;
    // #1298: members carry the scope's PATH, not the scope object. The path
    // holds every outer component, so nothing downstream can flatten it to a
    // leaf -- which is what the reference threaded here used to protect against.
    const typeStr = TypeUtils.getTypeName(typeCtx, scopePath, isScopeType);
    const type = VariableCollector.resolveDeclaredType(
      typeStr,
      ctx,
      TypeUtils.resolveType(typeCtx, scopePath, isScopeType),
    );

    // Check for const modifier (a `for` variable has none)
    const isConst =
      ctx instanceof Parser.VariableDeclarationContext &&
      ctx.constModifier() !== null;

    // Issue #468: Check for atomic modifier
    const isAtomic = ctx.atomicModifier() !== null;
    const isVolatile = ctx.volatileModifier() !== null;

    // Issue #1303: ADR-044's clamp/wrap is a declared fact like const and
    // volatile above, so it is read HERE and carried on the symbol. Reading it
    // only in codegen meant it existed for the declaring file and nowhere else.
    const overflowBehavior = OverflowBehaviorUtils.fromModifier(
      ctx.overflowModifier(),
    );

    // Check for array dimensions - both C-style (arrayDimension) and C-Next style (arrayType)
    const arrayDims = ctx.arrayDimension();
    const arrayTypeCtx = typeCtx.arrayType();
    const hasArrayTypeSyntax = arrayTypeCtx !== null;
    const isArray = arrayDims.length > 0 || hasArrayTypeSyntax;
    const initExpr = ctx.expression();
    const arrayDimensions: (number | string)[] = [];

    // #1822 (ADR-035): only a one-dimensional array's size is counted from its
    // list. An empty dimension anywhere else is E0892, and counting the OUTER
    // list for it invented a size that another file then bounds-checked
    // against (`u8[2][] m` read as [2][2] for rows of three).
    const dimensionCount =
      (arrayTypeCtx?.arrayTypeDimension().length ?? 0) + arrayDims.length;
    const countedFrom = dimensionCount === 1 ? initExpr : null;

    // Collect dimensions from arrayType syntax (u16[8] arr, u16[4][4] arr, u16[] arr)
    if (hasArrayTypeSyntax) {
      arrayDimensions.push(
        ...VariableCollector.collectArrayTypeDimensions(
          arrayTypeCtx,
          countedFrom,
        ),
      );
    }

    // Collect additional dimensions from arrayDimension syntax
    if (arrayDims.length > 0) {
      arrayDimensions.push(
        ...VariableCollector.collectArrayDimensions(arrayDims, countedFrom),
      );
    }

    // Issue #282: Capture initial value for const inlining
    const initialValue = initExpr?.getText();

    return {
      type,
      isConst,
      isAtomic,
      isVolatile,
      overflowBehavior,
      isArray,
      arrayDimensions,
      initialValue,
      // #895: what the initializer calls, for `DeclaredPointer.of`
      initializerCallee: VariableCollector.calleeOf(initExpr),
    };
  }

  /**
   * The function an initializer calls, when it is shaped `f(...)` or
   * `global.f(...)` -- source text, recorded on the declaration. Whether it
   * names a C function is `DeclaredPointer.of`'s question, asked of the
   * headers once they are known. The call is the chain's LAST operation
   * (#1760 review): `f()[2]` is an element of what `f` returns, not it.
   */
  private static calleeOf(
    expr: Parser.ExpressionContext | null,
  ): string | null {
    const postfix = expr
      ? ExpressionUnwrapper.getPostfixExpression(expr)
      : null;
    if (!postfix) return null;
    const primary = postfix.primaryExpression();
    const ops = postfix.postfixOp();
    if (primary.GLOBAL()) {
      const member = ops[0]?.IDENTIFIER();
      return member && ops.length === 2 && VariableCollector.isCall(ops[1])
        ? member.getText()
        : null;
    }
    const identifier = primary.IDENTIFIER();
    return identifier && ops.length === 1 && VariableCollector.isCall(ops[0])
      ? identifier.getText()
      : null;
  }

  private static isCall(op: Parser.PostfixOpContext | undefined): boolean {
    return (
      op !== undefined &&
      Boolean(op.argumentList() || op.getText().startsWith("("))
    );
  }

  /**
   * A global or scope member: its identity, and what its declaration says.
   * @param ctx The variable declaration context
   * @param sourceFile Source file path
   * @param scopePath The path of the scope this variable belongs to (dotted path, "" at file scope)
   * @param visibility Required: #1161 -- a default here is a third source of
   *   truth for one fact, which is how #1300 happened to the type kinds
   * @param isScopeType ADR-057 predicate: is this *qualified* name a scope type?
   * @returns The variable symbol with TType-based types and scope reference
   */
  static collect(
    ctx: Parser.VariableDeclarationContext,
    sourceFile: string,
    scopePath: string,
    visibility: TVisibility,
    isScopeType?: (qualifiedName: string) => boolean,
  ): IVariableSymbol {
    const name = ctx.IDENTIFIER().getText();
    const span = ParserUtils.getSpan(ctx);
    const facts = VariableCollector.declaredFacts(ctx, scopePath, isScopeType);

    // Build base symbol
    const symbol: IVariableSymbol = {
      kind: "variable",
      name,
      scopePath,
      // #1285: identity computed once, from the scope chain, not
      // re-derived by every consumer.
      ...ScopeUtils.identityOf({ name, scopePath }),
      sourceFile,
      span,
      sourceLanguage: ESourceLanguage.CNext,
      visibility,
      type: facts.type,
      isConst: facts.isConst,
      isAtomic: facts.isAtomic,
      isVolatile: facts.isVolatile,
      overflowBehavior: facts.overflowBehavior,
      isArray: facts.isArray,
      arrayDimensions:
        facts.arrayDimensions.length > 0 ? facts.arrayDimensions : undefined,
      initialValue: facts.initialValue,
      initializerCallee: facts.initializerCallee,
    };

    return symbol;
  }
}

export default VariableCollector;
