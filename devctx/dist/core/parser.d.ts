export interface ExtractedContext {
    task: string;
    approaches: string[];
    decisions: string[];
    currentState: string;
    nextSteps: string[];
    blockers: string[];
    source: string;
}
/**
 * Attempt to auto-extract context from AI editor session data.
 * Scans Claude Code, Antigravity, Cursor, and Windsurf storage.
 */
export declare function extractFromEditorSessions(repoPath: string): Promise<ExtractedContext | null>;
