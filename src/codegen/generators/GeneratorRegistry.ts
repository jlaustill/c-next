/**
 * Generator Registry
 *
 * Registry for extracted code generators using the "strangler fig" pattern.
 * Generators are registered here as they're extracted from CodeGenerator.ts.
 *
 * During migration:
 * - The registry starts empty
 * - As generators are extracted (A2-A5), they register here
 * - CodeGenerator checks the registry before falling back to inline methods
 * - Tests pass throughout the migration
 */

import { ParserRuleContext } from "antlr4ng";
import TGeneratorFn from "./TGeneratorFn";

/**
 * Registry for extracted generators.
 *
 * Enables gradual migration from monolithic CodeGenerator to modular generators.
 * Each generator category (declarations, statements, expressions) has its own map
 * keyed by the specific kind of node it handles.
 *
 * Example usage (in future A2-A5 issues):
 * ```typescript
 * // In expressionGenerators/ternary.ts
 * export const generateTernary: TGeneratorFn<TernaryExprContext> = (node, input, state, orch) => {
 *   const condition = orch.generateExpression(node.condition());
 *   // ...
 *   return { code: `${condition} ? ${trueBranch} : ${falseBranch}`, effects: [] };
 * };
 *
 * // In CodeGenerator initialization
 * registry.registerExpression('ternary', generateTernary);
 * ```
 */
export default class GeneratorRegistry {
  /**
   * Declaration generators indexed by declaration kind.
   * Example kinds: 'scope', 'struct', 'enum', 'function', 'variable'
   */
  private declarations = new Map<string, TGeneratorFn<ParserRuleContext>>();

  /**
   * Statement generators indexed by statement kind.
   * Example kinds: 'if', 'while', 'for', 'assignment', 'return', 'switch'
   */
  private statements = new Map<string, TGeneratorFn<ParserRuleContext>>();

  /**
   * Expression generators indexed by expression kind.
   * Example kinds: 'ternary', 'binary', 'unary', 'call', 'member', 'literal'
   */
  private expressions = new Map<string, TGeneratorFn<ParserRuleContext>>();

  // =========================================================================
  // Registration Methods
  // =========================================================================

  /**
   * Register a declaration generator.
   * @param kind - Declaration kind (e.g., 'struct', 'enum', 'function')
   * @param fn - Generator function
   */
  registerDeclaration<T extends ParserRuleContext>(
    kind: string,
    fn: TGeneratorFn<T>,
  ): void {
    this.declarations.set(kind, fn as TGeneratorFn<ParserRuleContext>);
  }

  /**
   * Register a statement generator.
   * @param kind - Statement kind (e.g., 'if', 'while', 'assignment')
   * @param fn - Generator function
   */
  registerStatement<T extends ParserRuleContext>(
    kind: string,
    fn: TGeneratorFn<T>,
  ): void {
    this.statements.set(kind, fn as TGeneratorFn<ParserRuleContext>);
  }

  /**
   * Register an expression generator.
   * @param kind - Expression kind (e.g., 'ternary', 'binary', 'call')
   * @param fn - Generator function
   */
  registerExpression<T extends ParserRuleContext>(
    kind: string,
    fn: TGeneratorFn<T>,
  ): void {
    this.expressions.set(kind, fn as TGeneratorFn<ParserRuleContext>);
  }

  // =========================================================================
  // Query Methods
  // =========================================================================

  /**
   * Check if a declaration generator is registered.
   */
  hasDeclaration(kind: string): boolean {
    return this.declarations.has(kind);
  }

  /**
   * Check if a statement generator is registered.
   */
  hasStatement(kind: string): boolean {
    return this.statements.has(kind);
  }

  /**
   * Check if an expression generator is registered.
   */
  hasExpression(kind: string): boolean {
    return this.expressions.has(kind);
  }

  // =========================================================================
  // Getter Methods
  // =========================================================================

  /**
   * Get a declaration generator by kind.
   * @returns The generator function, or undefined if not registered
   */
  getDeclaration(kind: string): TGeneratorFn<ParserRuleContext> | undefined {
    return this.declarations.get(kind);
  }

  /**
   * Get a statement generator by kind.
   * @returns The generator function, or undefined if not registered
   */
  getStatement(kind: string): TGeneratorFn<ParserRuleContext> | undefined {
    return this.statements.get(kind);
  }

  /**
   * Get an expression generator by kind.
   * @returns The generator function, or undefined if not registered
   */
  getExpression(kind: string): TGeneratorFn<ParserRuleContext> | undefined {
    return this.expressions.get(kind);
  }
}
