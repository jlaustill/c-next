/**
 * Assignment module public API (ADR-109).
 *
 * This module initializes the handler registry with all handlers.
 * For Phase 3 integration, CodeGenerator will import directly from:
 * - AssignmentKind (enum)
 * - AssignmentClassifier (classification logic)
 * - AssignmentContextBuilder (context extraction)
 * - handlers/index (registry)
 */
import AssignmentKind from "./AssignmentKind";
import assignmentHandlers from "./handlers/index";

// Import all handler modules
import handleSimple from "./handlers/SimpleHandler";
import bitmapHandlers from "./handlers/BitmapHandlers";
import registerHandlers from "./handlers/RegisterHandlers";
import stringHandlers from "./handlers/StringHandlers";
import bitAccessHandlers from "./handlers/BitAccessHandlers";
import arrayHandlers from "./handlers/ArrayHandlers";
import specialHandlers from "./handlers/SpecialHandlers";
import accessPatternHandlers from "./handlers/AccessPatternHandlers";

/**
 * Initialize the handler registry with all handlers.
 * Called once during module load.
 */
function initializeHandlers(): void {
  assignmentHandlers.register(AssignmentKind.SIMPLE, handleSimple);
  assignmentHandlers.registerAll(bitmapHandlers);
  assignmentHandlers.registerAll(registerHandlers);
  assignmentHandlers.registerAll(stringHandlers);
  assignmentHandlers.registerAll(bitAccessHandlers);
  assignmentHandlers.registerAll(arrayHandlers);
  assignmentHandlers.registerAll(specialHandlers);
  assignmentHandlers.registerAll(accessPatternHandlers);
}

// Initialize handlers on module load
initializeHandlers();

export default assignmentHandlers;
