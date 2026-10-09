"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const os_1 = __importDefault(require("os"));
const parser_1 = require("./parser");
// Mock os.homedir()
jest.mock("os");
const TEST_DIR = path_1.default.join(__dirname, "../../test-temp");
const MOCK_HOME = path_1.default.join(TEST_DIR, "mock-home");
describe("Parser Auto-Extraction", () => {
    beforeAll(() => {
        if (!fs_1.default.existsSync(TEST_DIR))
            fs_1.default.mkdirSync(TEST_DIR, { recursive: true });
    });
    afterAll(() => {
        if (fs_1.default.existsSync(TEST_DIR))
            fs_1.default.rmSync(TEST_DIR, { recursive: true, force: true });
    });
    beforeEach(() => {
        // Clean up mock home
        if (fs_1.default.existsSync(MOCK_HOME))
            fs_1.default.rmSync(MOCK_HOME, { recursive: true, force: true });
        fs_1.default.mkdirSync(MOCK_HOME, { recursive: true });
        os_1.default.homedir.mockReturnValue(MOCK_HOME);
    });
    test("should extract context from Antigravity brain", async () => {
        // Setup mock Antigravity structure
        const brainId = "test-conversation-id";
        const brainDir = path_1.default.join(MOCK_HOME, ".gemini", "antigravity", "brain", brainId);
        fs_1.default.mkdirSync(brainDir, { recursive: true });
        // implementation_plan.md
        fs_1.default.writeFileSync(path_1.default.join(brainDir, "implementation_plan.md"), `# Fix Layout Bug

## Context
The user reported a layout issue on mobile screens where the header overflows.

> [!NOTE]
> Decided to use CSS Grid instead of Flexbox to handle the overflow better.

#### [NEW] [src/components/Header.tsx]
`);
        // task.md
        fs_1.default.writeFileSync(path_1.default.join(brainDir, "task.md"), `# Fix Header Overflow
- [x] Analyze bug
- [x] Create reproduction
- [ ] Implement fix
`);
        // walkthrough.md
        fs_1.default.writeFileSync(path_1.default.join(brainDir, "walkthrough.md"), `# Final Status

## Overview
The bug is reproduced on iPhone SE. Fix involves adding overflow-hidden to container.
`);
        const result = await (0, parser_1.extractFromEditorSessions)("/path/to/repo");
        expect(result).not.toBeNull();
        expect(result?.source).toBe("antigravity");
        expect(result?.task).toBe("Analyze bug + Create reproduction (Structure: Fix Layout Bug)"); // Active task.md items, with the implementation_plan.md title as structure
        expect(result?.approaches).toContain("The user reported a layout issue on mobile screens where the header overflows.");
        expect(result?.approaches).toContain("Done: Analyze bug");
        // Should NOT contain file modifications anymore
        expect(result?.decisions).not.toContain("Modified: src/components/Header.tsx");
        // Should contain the architectural decision from the Note
        expect(result?.decisions).toContain("Decided to use CSS Grid instead of Flexbox to handle the overflow better.");
        expect(result?.currentState).toContain("The bug is reproduced on iPhone SE");
        expect(result?.nextSteps).toContain("Implement fix");
    });
    test("should extract context from Claude Code session", async () => {
        // Setup mock Claude Code structure
        const repoPath = "/Users/techie/my-repo";
        const encodedPath = repoPath.replace(/\//g, "-");
        const projectDir = path_1.default.join(MOCK_HOME, ".claude", "projects", encodedPath);
        fs_1.default.mkdirSync(projectDir, { recursive: true });
        // Session JSONL
        const sessionFile = path_1.default.join(projectDir, "session-123.jsonl");
        const sessionData = [
            { type: "user", message: { content: "Refactor auth module to use JWT" } },
            { type: "assistant", message: { content: "Okay, I'll help with that." } },
            { type: "user", message: { content: "Make sure to use RS256 algorithm." } },
            { type: "assistant", message: { content: "I've started refactoring. Decided to use jsonwebtoken library because it is standard." } },
            { type: "assistant", message: { content: "Current status: Auth middleware is updated. Next steps:\n- Create token generator\n-Add expiration check" } },
        ];
        fs_1.default.writeFileSync(sessionFile, sessionData.map(d => JSON.stringify(d)).join("\n"));
        // Ensure Antigravity returns null so it falls back to Claude
        // (In this test setup, Antigravity dir is empty/missing from beforeEach cleanup)
        const result = await (0, parser_1.extractFromEditorSessions)(repoPath);
        expect(result).not.toBeNull();
        expect(result?.source).toBe("claude-code-session");
        expect(result?.task).toBe("Refactor auth module to use JWT");
        expect(result?.approaches).toContain("User also asked: Make sure to use RS256 algorithm.");
        // Should capture the full sentence with reasoning
        expect(result?.decisions).toContain("Decided to use jsonwebtoken library because it is standard.");
        expect(result?.currentState).toContain("Auth middleware is updated");
        expect(result?.nextSteps).toContain("Create token generator");
    });
});
