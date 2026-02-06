/**
 * Assignment handler registry (ADR-109).
 *
 * Maps AssignmentKind to handler functions for clean dispatch-based
 * code generation. Each handler is responsible for generating the C
 * code for one specific kind of assignment.
 */
import AssignmentKind from "../AssignmentKind";
import TAssignmentHandler from "./TAssignmentHandler";

/**
 * Static registry mapping AssignmentKind to handler functions.
 *
 * Handlers are registered lazily to avoid circular dependencies.
 * Use getHandler() to retrieve the handler for a given kind.
 */
class AssignmentHandlerRegistry {
  private static readonly handlers = new Map<
    AssignmentKind,
    TAssignmentHandler
  >();

  /**
   * Register a handler for an assignment kind.
   */
  static register(kind: AssignmentKind, handler: TAssignmentHandler): void {
    AssignmentHandlerRegistry.handlers.set(kind, handler);
  }

  /**
   * Register multiple handlers at once.
   */
  static registerAll(
    entries: ReadonlyArray<[AssignmentKind, TAssignmentHandler]>,
  ): void {
    for (const [kind, handler] of entries) {
      AssignmentHandlerRegistry.handlers.set(kind, handler);
    }
  }

  /**
   * Get the handler for an assignment kind.
   * Throws if no handler is registered.
   */
  static getHandler(kind: AssignmentKind): TAssignmentHandler {
    const handler = AssignmentHandlerRegistry.handlers.get(kind);
    if (!handler) {
      throw new Error(
        `No handler registered for assignment kind: ${AssignmentKind[kind]}`,
      );
    }
    return handler;
  }
}

export default AssignmentHandlerRegistry;
