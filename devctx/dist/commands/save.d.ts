interface SaveOptions {
    goal?: string;
    approaches?: string;
    decisions?: string;
    state?: string;
    nextSteps?: string;
    blockers?: string;
    assignee?: string;
    handoffNote?: string;
    auto?: boolean;
}
export declare function saveCommand(message?: string, options?: SaveOptions): Promise<void>;
export {};
