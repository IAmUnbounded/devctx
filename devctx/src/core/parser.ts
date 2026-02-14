import fs from "fs";
import path from "path";
import os from "os";
import readline from "readline";

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
export async function extractFromEditorSessions(
    repoPath: string
): Promise<ExtractedContext | null> {
    // Try each source in priority order
    const extractors = [
        extractFromClaudeCode,
        extractFromAntigravity,
        extractFromCursor,
    ];

    for (const extractor of extractors) {
        try {
            const result = await extractor(repoPath);
            if (result && result.task) return result;
        } catch {
            // Continue to next extractor
        }
    }

    return null;
}

// -------------------------------------------------------------------
// Claude Code: ~/.claude/projects/<encoded-path>/<sessionId>.jsonl
// -------------------------------------------------------------------
async function extractFromClaudeCode(
    repoPath: string
): Promise<ExtractedContext | null> {
    const home = os.homedir();
    const claudeDir = path.join(home, ".claude", "projects");

    if (!fs.existsSync(claudeDir)) return null;

    // Find the project folder matching this repo path
    // Claude encodes paths by replacing / with -
    const encodedPath = repoPath.replace(/\//g, "-");
    const projectDirs = fs.readdirSync(claudeDir);
    const matchingDir = projectDirs.find((d) => encodedPath.endsWith(d) || d.endsWith(encodedPath.slice(1)));

    if (!matchingDir) return null;

    const projectPath = path.join(claudeDir, matchingDir);

    // 1. Try memory files first (most structured)
    const memoryDir = path.join(projectPath, "memory");
    if (fs.existsSync(memoryDir)) {
        const memoryResult = parseClaudeMemory(memoryDir);
        if (memoryResult) return memoryResult;
    }

    // 2. Parse the most recent session JSONL
    const jsonlFiles = fs
        .readdirSync(projectPath)
        .filter((f) => f.endsWith(".jsonl"))
        .map((f) => ({
            name: f,
            mtime: fs.statSync(path.join(projectPath, f)).mtime.getTime(),
        }))
        .sort((a, b) => b.mtime - a.mtime);

    if (jsonlFiles.length === 0) return null;

    const latestSession = path.join(projectPath, jsonlFiles[0].name);
    return await parseClaudeSession(latestSession);
}

function parseClaudeMemory(memoryDir: string): ExtractedContext | null {
    const files = fs.readdirSync(memoryDir).filter((f) => f.endsWith(".md"));
    if (files.length === 0) return null;

    let task = "";
    const decisions: string[] = [];
    const approaches: string[] = [];
    let currentState = "";
    const nextSteps: string[] = [];

    for (const file of files) {
        const content = fs.readFileSync(path.join(memoryDir, file), "utf-8");

        // Extract project description from memory
        if (file === "MEMORY.md") {
            const projectMatch = content.match(/##\s*Project\s*(?:Location|Overview)?\s*\n([\s\S]*?)(?=\n##|$)/i);
            if (projectMatch) {
                const lines = projectMatch[1].trim().split("\n").filter(Boolean);
                task = lines[0]?.replace(/^[-*]\s*\*\*.*?\*\*:\s*/, "").trim() || "";
            }
        }

        // Extract conventions as decisions
        const conventionMatch = content.match(/##\s*Conventions?\s*\n([\s\S]*?)(?=\n##|$)/i);
        if (conventionMatch) {
            const lines = conventionMatch[1].trim().split("\n").filter(Boolean);
            for (const line of lines.slice(0, 5)) {
                const cleaned = line.replace(/^[-*]\s*/, "").trim();
                if (cleaned.length > 10) decisions.push(cleaned);
            }
        }

        // Extract patterns as approaches
        const patternMatch = content.match(/##\s*Patterns?\s*\n([\s\S]*?)(?=\n##|$)/i);
        if (patternMatch) {
            const lines = patternMatch[1].trim().split("\n").filter(Boolean);
            for (const line of lines.slice(0, 5)) {
                const cleaned = line.replace(/^[-*]\s*/, "").trim();
                if (cleaned.length > 10) approaches.push(cleaned);
            }
        }
    }

    if (!task && decisions.length === 0) return null;

    return {
        task: task || "Project session (from Claude Code memory)",
        approaches,
        decisions,
        currentState: currentState || "Loaded from Claude Code memory files",
        nextSteps,
        blockers: [],
        source: "claude-code-memory",
    };
}

async function parseClaudeSession(
    sessionPath: string
): Promise<ExtractedContext | null> {
    // Read ALL lines — we need both the first messages (intent) and last messages (state)
    const allLines = await readLastLines(sessionPath, 500);

    // Separate into first messages (intent) and last messages (current state)
    const firstUserMessages: string[] = [];
    const lastUserMessages: string[] = [];
    const lastAssistantMessages: string[] = [];

    for (const line of allLines) {
        try {
            const entry = JSON.parse(line);
            const text = extractMessageText(entry);
            if (!text || text.length < 5) continue;

            if (entry.type === "user") {
                // Collect first 3 user messages as intent
                if (firstUserMessages.length < 3) {
                    firstUserMessages.push(text);
                }
                lastUserMessages.push(text);
            } else if (entry.type === "assistant" && text.length > 20) {
                lastAssistantMessages.push(text);
            }
        } catch {
            // Skip malformed lines
        }
    }

    if (firstUserMessages.length === 0) return null;

    // The FIRST user message is the intent — what they wanted to do
    const intent = firstUserMessages[0];
    const intentFirstLine = intent.split("\n")[0].trim();
    // Use first line if short, or first 200 chars
    const task = intentFirstLine.length < 300 ? intentFirstLine : intent.slice(0, 200);

    // Later user messages show what else was requested
    const additionalRequests = firstUserMessages.slice(1).map((m) => {
        const line = m.split("\n")[0].trim();
        return line.length < 200 ? line : line.slice(0, 200);
    });

    // Use assistant messages for decisions/approaches/state
    const recentAssistant = lastAssistantMessages.slice(-10);
    const decisions = extractDecisions(recentAssistant);
    const approaches = extractApproaches(recentAssistant);
    const currentState = extractState(recentAssistant);
    const nextSteps = extractNextSteps(recentAssistant);

    return {
        task,
        approaches: [...additionalRequests.map(r => `User also asked: ${r}`), ...approaches],
        decisions,
        currentState: currentState || "Session data parsed from Claude Code",
        nextSteps,
        blockers: [],
        source: "claude-code-session",
    };
}

function extractMessageText(entry: any): string {
    const content = entry.message?.content;
    if (!content) return "";
    if (typeof content === "string") return content;
    if (Array.isArray(content)) {
        return content
            .filter((c: any) => c.type === "text")
            .map((c: any) => c.text)
            .join("\n");
    }
    return "";
}

// -------------------------------------------------------------------
// Antigravity: ~/.gemini/antigravity/brain/<id>/
// -------------------------------------------------------------------
async function extractFromAntigravity(
    repoPath: string
): Promise<ExtractedContext | null> {
    const home = os.homedir();
    const brainDir = path.join(home, ".gemini", "antigravity", "brain");

    if (!fs.existsSync(brainDir)) return null;

    // Find most recent conversation that has artifacts
    const conversations = fs
        .readdirSync(brainDir)
        .map((d) => {
            const dir = path.join(brainDir, d);
            const taskFile = path.join(dir, "task.md");
            try {
                const stat = fs.existsSync(taskFile)
                    ? fs.statSync(taskFile)
                    : fs.statSync(dir);
                return { name: d, dir, taskFile, mtime: stat.mtime.getTime(), valid: true };
            } catch {
                return { name: d, dir, taskFile, mtime: 0, valid: false };
            }
        })
        .filter((d) => d.valid && fs.existsSync(d.taskFile))
        .sort((a, b) => b.mtime - a.mtime);

    if (conversations.length === 0) return null;

    const latest = conversations[0];

    // 1. Try to get the USER'S INTENT from implementation_plan.md
    //    The plan title and overview section capture what the user wanted
    let task = "";
    const decisions: string[] = [];
    const approaches: string[] = [];
    const planFile = path.join(latest.dir, "implementation_plan.md");
    if (fs.existsSync(planFile)) {
        const plan = fs.readFileSync(planFile, "utf-8");

        // First heading is the goal/intent
        const titleMatch = plan.match(/^#\s+(.+)$/m);
        if (titleMatch) {
            task = titleMatch[1].trim();
        }
    }

    // 2. Parse task.md for MORE SPECIFIC active task
    //    If we have a specific checklist item that is In Progress or Recently Done, use that as the main task
    const taskContent = fs.existsSync(latest.taskFile) ? fs.readFileSync(latest.taskFile, "utf-8") : "";
    if (taskContent) {
        // Look for in-progress items first (user specific notations like [-] or [/])
        const inProgressMatch = taskContent.match(/-\s+\[[/-]\]\s+(.+)$/m);
        if (inProgressMatch) {
            task = inProgressMatch[1].trim();
        } else {
            // Look for last completed item (likely what was just finished)
            const completedMatches = [...taskContent.matchAll(/-\s+\[x\]\s+(.+)$/gm)];
            if (completedMatches.length > 0) {
                // Use the last TWO completed items if available, to capture context + verification
                const lastTwo = completedMatches.slice(-2).map(m => m[1].trim());
                const combinedTask = lastTwo.join(" + ");

                // Combine with plan title if available for context
                task = task ? `${combinedTask} (Structure: ${task})` : combinedTask;
            }
        }
    }

    if (fs.existsSync(planFile)) {
        const plan = fs.readFileSync(planFile, "utf-8");

        // Proposed changes sections often contain file lists - WE WANT TO IGNORE THESE
        // Instead, look for "Important" or "Note" alerts which contain architectural decisions
        const alertMatches = plan.matchAll(/>\s*\[!(?:IMPORTANT|NOTE|WARNING|CAUTION)\]\s*\n((?:>\s*.*?\n)+)/gi);
        for (const match of alertMatches) {
            const alertText = match[1].replace(/^>\s*/gm, "").replace(/\*\*/g, "").trim();
            if (alertText.length > 20) {
                // Split into sentences and keep robust ones
                const sentences = alertText.split(/(\. |\n)/).filter(s => s.length > 20);
                decisions.push(...sentences.map(s => s.trim()));
            }
        }

        // Also look for bullet points in text that explain "why" (filtering out file links)
        const bulletPoints = plan.matchAll(/^-\s+(.+?)$/gm);
        for (const match of bulletPoints) {
            const text = match[1].trim();
            // Ignore file links or simple task lists
            if (text.startsWith("[") || text.includes("](file://")) continue;

            const sentences = text.split(/(\. |\n)/).filter(s => s.length > 20);
            for (const sentence of sentences) {
                // Use more flexible matching for decision verbs (decided, choosing, etc.)
                if (sentence.match(/\b(decid|chos|opt|select|prefer|us(?:e|ing)|going with|approach|architect|pattern|instead of)/i)) {
                    const cleaned = sentence.trim();
                    if (cleaned.length > 20) decisions.push(cleaned);
                }
            }
        }
        // Overview/description section captures the WHY
        const overviewMatch = plan.match(/##\s*(?:Overview|Context|Background)\s*\n([\s\S]*?)(?=\n##|$)/i);
        if (overviewMatch) {
            const overviewText = overviewMatch[1].trim();
            if (overviewText.length > 10) {
                approaches.push(overviewText.split("\n")[0].trim());
            }
        }

        // Proposed changes sections capture decisions - OLD LOGIC DEPRECATED
        // We now rely on Alerts and specific text patterns above
        // const decisionPatterns = plan.match(/####\s*\[.*?\]\s*\[(.+?)\]/gm) || [];
        // for (const d of decisionPatterns.slice(0, 5)) {
        //    const fileName = d.match(/\[([^\]]+)\]\s*$/)?.[1]?.trim();
        //    if (fileName) decisions.push(`Modified: ${fileName}`);
        // }
    }

    // 2. Try metadata.json files for stored summaries
    const metaFiles = ["task.md.metadata.json", "implementation_plan.md.metadata.json"];
    for (const metaFile of metaFiles) {
        const metaPath = path.join(latest.dir, metaFile);
        if (fs.existsSync(metaPath)) {
            try {
                const meta = JSON.parse(fs.readFileSync(metaPath, "utf-8"));
                if (meta.Summary && !task) {
                    task = meta.Summary.split("\n")[0].trim();
                }
                if (meta.Summary && meta.Summary.length > 50) {
                    // The metadata summary often contains the full intent
                    approaches.push(meta.Summary.split("\n")[0].trim());
                }
            } catch { }
        }
    }

    // 3. Parse task.md for next steps (already read content above)
    if (!task && taskContent) {
        task = extractTaskFromMarkdown(taskContent);
    }
    const nextSteps = extractIncompleteItems(taskContent);
    const completed = extractCompletedItems(taskContent);

    // 4. Parse walkthrough.md for current state
    let currentState = "";
    const walkthroughFile = path.join(latest.dir, "walkthrough.md");
    if (fs.existsSync(walkthroughFile)) {
        const walkthrough = fs.readFileSync(walkthroughFile, "utf-8");

        // The walkthrough title is often a good summary of what was accomplished
        const walkTitle = walkthrough.match(/^#\s+(.+)$/m);
        if (walkTitle && !currentState) {
            currentState = walkTitle[1].trim();
        }

        // Parse "Changes" or "What Was Built" or "Implementation" sections for Approaches/Decisions
        // These are usually more current than the plan. Support Level 2-4 headers.
        // Priority: Changes > Implementation Details > What Was Built
        let changesMatch = walkthrough.match(/#{2,4}\s*(?:Changes)\s*\n([\s\S]*?)(?=\n#{2,4} |$)/i);
        if (!changesMatch) {
            changesMatch = walkthrough.match(/#{2,4}\s*(?:Implementation Details?|What Was Built)\s*\n([\s\S]*?)(?=\n#{2,4} |$)/i);
        }
        if (changesMatch) {
            const changesText = changesMatch[1].trim();
            const changeLines = changesText.split("\n");

            for (const line of changeLines) {
                const cleaned = line.replace(/^[-*]\s*/, "").trim();
                if (cleaned.length < 10) continue;

                // If line contains decision keywords, treat as decision
                if (cleaned.match(/\b(decid|chos|opt|select|prefer|us(?:e|ing)|going with|approach|architect|pattern|instead of)/i)) {
                    // Only add if not already present (avoid dupes from plan)
                    if (!decisions.includes(cleaned)) {
                        decisions.push(cleaned);
                    }
                } else if (line.trim().startsWith("-") || line.trim().startsWith("*")) {
                    // Treat other bullet points as approaches/actions taken
                    if (!approaches.includes(cleaned) && !cleaned.startsWith("[")) {
                        approaches.push(cleaned);
                    }
                }
            }
        }

        // First section gives more detail for current state
        const firstSection = walkthrough.match(/##\s*.*?\n([\s\S]*?)(?=\n##|$)/);
        if (firstSection && !changesMatch) { // Only use first section if we didn't find specific changes
            const detail = firstSection[1].trim().slice(0, 300);
            currentState = currentState ? `${currentState}. ${detail}` : detail;
        } else if (changesMatch) {
            currentState = currentState ? `${currentState}. See approaches for details.` : "See approaches for details.";
        }
    }

    return {
        task: task || "Antigravity session",
        approaches: [
            ...approaches,
            ...completed.slice(0, 5).map((c) => `Done: ${c}`),
        ],
        decisions,
        currentState: currentState || "Loaded from Antigravity brain artifacts",
        nextSteps,
        blockers: [],
        source: "antigravity",
    };
}

// -------------------------------------------------------------------
// Cursor: ~/.cursor/ (basic search)
// -------------------------------------------------------------------
async function extractFromCursor(
    _repoPath: string
): Promise<ExtractedContext | null> {
    const home = os.homedir();
    const cursorDir = path.join(home, ".cursor");

    if (!fs.existsSync(cursorDir)) return null;

    // Cursor stores workspace state in various places
    const workspaceStorage = path.join(cursorDir, "User", "workspaceStorage");
    if (!fs.existsSync(workspaceStorage)) return null;

    // Look for recent conversation state files
    const workspaces = fs
        .readdirSync(workspaceStorage)
        .map((d) => ({
            name: d,
            path: path.join(workspaceStorage, d),
            mtime: fs.statSync(path.join(workspaceStorage, d)).mtime.getTime(),
        }))
        .sort((a, b) => b.mtime - a.mtime)
        .slice(0, 3);

    for (const ws of workspaces) {
        // Look for AI chat state
        const chatDb = path.join(ws.path, "state.vscdb");
        if (fs.existsSync(chatDb)) {
            // SQLite — would need sqlite3 dependency, skip for now
            return null;
        }
    }

    return null;
}

// -------------------------------------------------------------------
// Helpers
// -------------------------------------------------------------------

async function readLastLines(
    filePath: string,
    maxLines: number
): Promise<string[]> {
    const lines: string[] = [];
    const fileStream = fs.createReadStream(filePath, { encoding: "utf-8" });
    const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

    const buffer: string[] = [];
    for await (const line of rl) {
        buffer.push(line);
        if (buffer.length > maxLines * 2) {
            buffer.splice(0, maxLines); // keep a sliding window
        }
    }

    return buffer.slice(-maxLines);
}

function extractTaskFromMessages(messages: string[]): string {
    // First user message is usually the task
    const first = messages[0] || "";

    // If it starts with "Implement", "Build", "Fix", etc., use first line
    const firstLine = first.split("\n")[0].trim();
    if (firstLine.length > 10 && firstLine.length < 300) {
        return firstLine;
    }

    // Try to find a task-like sentence
    for (const msg of messages) {
        const match = msg.match(
            /(?:implement|build|fix|create|add|refactor|debug|optimize|update|migrate)\s+(.+?)(?:\.|$)/i
        );
        if (match) return match[0].trim().slice(0, 200);
    }

    return first.slice(0, 200);
}

function extractDecisions(messages: string[]): string[] {
    const decisions: string[] = [];
    const patterns = [
        /(?:decided|choosing|using|going with|switched to|picked)\s+(.+?)(?:\.|$)/gi,
        /(?:decision|chose|selected|opted for)\s*:?\s*(.+?)(?:\.|$)/gi,
    ];

    for (const msg of messages.slice(-10)) {
        const sentences = msg.split(/[.!?]\s+/);
        for (const sentence of sentences) {
            // Use more flexible matching for decision verbs (decided, choosing, etc.)
            if (sentence.match(/\b(decid|chos|opt|select|prefer|us(?:e|ing)|going with|approach|architect|pattern|instead of)/i)) {
                const cleaned = sentence.trim();
                // Avoid very short fragments
                if (cleaned.length > 20 && cleaned.length < 300 && !decisions.includes(cleaned)) {
                    decisions.push(cleaned);
                }
            }
        }
    }

    return decisions.slice(0, 10);
}

function extractApproaches(messages: string[]): string[] {
    const approaches: string[] = [];
    const patterns = [
        /(?:tried|approach|attempted|tested|experimented with)\s+(.+?)(?:\.|$)/gi,
        /(?:first|then|alternatively|instead)\s*,?\s*(?:I|we|let's)\s+(.+?)(?:\.|$)/gi,
    ];

    for (const msg of messages.slice(-10)) {
        for (const pattern of patterns) {
            pattern.lastIndex = 0;
            let match: RegExpExecArray | null;
            while ((match = pattern.exec(msg)) !== null) {
                const a = match[0].trim();
                if (a.length > 10 && a.length < 200 && !approaches.includes(a)) {
                    approaches.push(a);
                }
            }
        }
    }

    return approaches.slice(0, 8);
}

function extractState(messages: string[]): string {
    // Look at last assistant message for state
    const last = messages[messages.length - 1] || "";

    // Look for state indicators
    const stateMatch = last.match(
        /(?:currently|now|at this point|so far|status:?)\s*(.+?)(?:\.|$)/i
    );
    if (stateMatch) return stateMatch[0].trim().slice(0, 300);

    // Use last meaningful line
    const lines = last.split("\n").filter((l) => l.trim().length > 20);
    return lines[lines.length - 1]?.trim()?.slice(0, 300) || "";
}

function extractNextSteps(messages: string[]): string[] {
    const steps: string[] = [];

    for (const msg of messages.slice(-5)) {
        const nextMatch = msg.match(
            /(?:next steps?|todo|remaining|still need to|should also)\s*:?\s*\n?((?:\s*[-*\d.]+\s*.+\n?)+)/i
        );
        if (nextMatch) {
            const items = nextMatch[1]
                .split("\n")
                .map((l) => l.replace(/^[\s\-*\d.]+/, "").trim())
                .filter((l) => l.length > 5);
            steps.push(...items);
        }
    }

    return [...new Set(steps)].slice(0, 8);
}

function extractTaskFromMarkdown(content: string): string {
    // Get title from first heading
    const titleMatch = content.match(/^#\s+(.+)$/m);
    return titleMatch?.[1]?.trim() || "";
}

function extractIncompleteItems(content: string): string[] {
    const items: string[] = [];
    const matches = content.matchAll(/-\s+\[\s\]\s+(.+)$/gm);
    for (const m of matches) {
        items.push(m[1].trim());
    }
    return items.slice(0, 8);
}

function extractCompletedItems(content: string): string[] {
    const items: string[] = [];
    const matches = content.matchAll(/-\s+\[x\]\s+(.+)$/gm);
    for (const m of matches) {
        items.push(m[1].trim());
    }
    return items.slice(0, 8);
}
