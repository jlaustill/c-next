import TOverflowBehavior from "./TOverflowBehavior";

/**
 * Assignment context for overflow behavior tracking
 */
interface IAssignmentContext {
  targetName: string | null;
  targetType: string | null;
  overflowBehavior: TOverflowBehavior;
}

export default IAssignmentContext;
