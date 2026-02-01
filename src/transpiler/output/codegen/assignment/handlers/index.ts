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
 * Registry mapping AssignmentKind to handler functions.
 *
 * Handlers are registered lazily to avoid circular dependencies.
 * Use getHandler() to retrieve the handler for a given kind.
 */
class AssignmentHandlerRegistry {
  private readonly handlers = new Map<AssignmentKind, TAssignmentHandler>();

  /**
   * Register a handler for an assignment kind.
   */
  register(kind: AssignmentKind, handler: TAssignmentHandler): void {
    this.handlers.set(kind, handler);
  }

  /**
   * Register multiple handlers at once.
   */
  registerAll(
    entries: ReadonlyArray<[AssignmentKind, TAssignmentHandler]>,
  ): void {
    for (const [kind, handler] of entries) {
      this.handlers.set(kind, handler);
    }
  }

  /**
   * Get the handler for an assignment kind.
   * Throws if no handler is registered.
   */
  getHandler(kind: AssignmentKind): TAssignmentHandler {
    const handler = this.handlers.get(kind);
    if (!handler) {
      throw new Error(
        `No handler registered for assignment kind: ${AssignmentKind[kind]}`,
      );
    }
    return handler;
  }

  /**
   * Check if a handler is registered for an assignment kind.
   */
  hasHandler(kind: AssignmentKind): boolean {
    return this.handlers.has(kind);
  }

  /**
   * Get all registered kinds (for debugging/testing).
   */
  getRegisteredKinds(): AssignmentKind[] {
    return Array.from(this.handlers.keys());
  }
}

/** Singleton registry instance */
const assignmentHandlers = new AssignmentHandlerRegistry();

export default assignmentHandlers;
