#!/usr/bin/env node
"use strict";

Object.defineProperty(exports, "__esModule", { value: true });
const mcp_js_1 = require("@modelcontextprotocol/sdk/server/mcp.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const zod_1 = require("zod");
const context_1 = require("./core/context");
const git_1 = require("./core/git");
const prompt_1 = require("./core/prompt");
const uuid_1 = require("uuid");
const server = new mcp_js_1.McpServer({
    name: "devctx",
    version: "0.5.0",
});
const resumeSchema = {
    branch: zod_1.z.string().optional().describe("Branch name to resume. Defaults to current branch."),
};
server.tool("devctx_resume", "Generate AI-ready context prompt for the current or specified branch", resumeSchema, async ({ branch }) => {
    if (!(await (0, context_1.isInitialized)())) {
        return { content: [{ type: "text", text: "DevContext not initialized. Run `devctx init` first." }] };
    }
    const targetBranch = branch || (await (0, git_1.getCurrentBranch)());
    const entries = await (0, context_1.loadBranchContext)(targetBranch);
    if (entries.length === 0) {
        return {
            content: [{ type: "text", text: `No context found for branch: ${targetBranch}. Run \`devctx save\` first.` }],
        };
    }
    const prompt = (0, prompt_1.generatePrompt)(entries);
    return { content: [{ type: "text", text: prompt }] };
});
const saveSchema = {
    message: zod_1.z.string().describe("Description of what you were working on"),
    goal: zod_1.z.string().optional().describe("Goal or ticket reference"),
    approaches: zod_1.z.array(zod_1.z.string()).optional().describe("Approaches tried"),
    decisions: zod_1.z.array(zod_1.z.string()).optional().describe("Key decisions made"),
    currentState: zod_1.z.string().optional().describe("Current state of the work"),
    nextSteps: zod_1.z.array(zod_1.z.string()).optional().describe("Next steps"),
};
server.tool("devctx_save", "Save current coding context with a message", saveSchema, async ({ message, goal, approaches, decisions, currentState, nextSteps }) => {
    if (!(await (0, context_1.isInitialized)())) {
        return { content: [{ type: "text", text: "DevContext not initialized. Run `devctx init` first." }] };
    }
    const [branch, repo, filesChanged, filesStaged, recentCommits, author] = await Promise.all([
        (0, git_1.getCurrentBranch)(),
        (0, git_1.getRepoName)(),
        (0, git_1.getChangedFiles)(),
        (0, git_1.getStagedFiles)(),
        (0, git_1.getRecentCommits)(),
        (0, git_1.getAuthor)(),
    ]);
    const entry = {
        id: (0, uuid_1.v4)(),
        timestamp: new Date().toISOString(),
        branch,
        repo,
        author,
        task: message,
        goal,
        approaches: approaches || [],
        decisions: decisions || [],
        currentState: currentState || message,
        nextSteps: nextSteps || [],
        filesChanged,
        filesStaged,
        recentCommits,
    };
    await (0, context_1.saveContext)(entry);
    return {
        content: [
            {
                type: "text",
                text: `Context saved for branch: ${branch}\n${filesChanged.length} files changed, ${recentCommits.length} recent commits captured.`,
            },
        ],
    };
});
const logSchema = {
    all: zod_1.z.boolean().optional().describe("Show all branches"),
    count: zod_1.z.number().optional().describe("Number of entries to show"),
};
server.tool("devctx_log", "View context history for the current branch or all branches", logSchema, async ({ all, count }) => {
    if (!(await (0, context_1.isInitialized)())) {
        return { content: [{ type: "text", text: "DevContext not initialized." }] };
    }
    const limit = count || 10;
    if (all) {
        const sessions = await (0, context_1.loadAllSessions)();
        if (sessions.length === 0) {
            return { content: [{ type: "text", text: "No context entries found." }] };
        }
        const lines = sessions.slice(0, limit).map((s) => {
            const date = new Date(s.timestamp).toLocaleString();
            return `[${date}] ${s.branch} — ${s.task}`;
        });
        return { content: [{ type: "text", text: `All branches:\n\n${lines.join("\n")}` }] };
    }
    const branch = await (0, git_1.getCurrentBranch)();
    const entries = await (0, context_1.loadBranchContext)(branch);
    if (entries.length === 0) {
        return { content: [{ type: "text", text: `No context for branch: ${branch}` }] };
    }
    const lines = entries
        .slice(-limit)
        .reverse()
        .map((e) => {
        const date = new Date(e.timestamp).toLocaleString();
        return `[${date}] ${e.task}${e.currentState ? `\n  └─ ${e.currentState}` : ""}`;
    });
    return {
        content: [{ type: "text", text: `Branch: ${branch}\n\n${lines.join("\n")}` }],
    };
});
// --- Resources ---
server.resource("context", "devctx://context", async (uri) => {
    if (!(await (0, context_1.isInitialized)())) {
        return { contents: [{ uri: uri.href, text: "DevContext not initialized.", mimeType: "text/plain" }] };
    }
    const branch = await (0, git_1.getCurrentBranch)();
    const entries = await (0, context_1.loadBranchContext)(branch);
    if (entries.length === 0) {
        return { contents: [{ uri: uri.href, text: "No context found.", mimeType: "text/plain" }] };
    }
    const prompt = (0, prompt_1.generatePrompt)(entries);
    return { contents: [{ uri: uri.href, text: prompt, mimeType: "text/markdown" }] };
});
// --- Start ---
async function main() {
    const transport = new stdio_js_1.StdioServerTransport();
    await server.connect(transport);
}
main().catch((err) => {
    console.error("MCP server error:", err);
    process.exit(1);
});
