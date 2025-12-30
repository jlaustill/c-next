import ECommentType from './ECommentType.js';

/**
 * Represents a comment extracted from source (ADR-043)
 */
interface IComment {
    /** Comment type */
    type: ECommentType;
    /** Raw text including comment markers */
    raw: string;
    /** Text content without markers */
    content: string;
    /** Line number (1-based) */
    line: number;
    /** Column (0-based) */
    column: number;
    /** Token index for positioning relative to code */
    tokenIndex: number;
}

export default IComment;
