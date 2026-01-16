/**
 * Support generators barrel export.
 * ADR-053 A5: Modular support/utility code generation
 */
import helperGenerators from "./HelperGenerator";
import includeGenerators from "./IncludeGenerator";
import commentUtils from "./CommentUtils";

// Re-export individual generators for convenience
const { generateOverflowHelpers, generateSafeDivHelpers } = helperGenerators;

const { transformIncludeDirective, processPreprocessorDirective } =
  includeGenerators;

const {
  getLeadingComments,
  getTrailingComments,
  formatLeadingComments,
  formatTrailingComment,
} = commentUtils;

// Combined export
const supportGenerators = {
  // Helper generators
  generateOverflowHelpers,
  generateSafeDivHelpers,
  // Include generators
  transformIncludeDirective,
  processPreprocessorDirective,
  // Comment utilities
  getLeadingComments,
  getTrailingComments,
  formatLeadingComments,
  formatTrailingComment,
};

export default supportGenerators;
