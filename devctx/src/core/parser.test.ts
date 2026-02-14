import fs from "fs";
import path from "path";
import os from "os";
import { extractFromEditorSessions } from "./parser";

// Mock os.homedir()
jest.mock("os");

const TEST_DIR = path.join(__dirname, "../../test-temp");
const MOCK_HOME = path.join(TEST_DIR, "mock-home");

describe("Parser Auto-Extraction", () => {
    beforeAll(() => {
        if (!fs.existsSync(TEST_DIR)) fs.mkdirSync(TEST_DIR, { recursive: true });
    });

    afterAll(() => {
        if (fs.existsSync(TEST_DIR)) fs.rmSync(TEST_DIR, { recursive: true, force: true });
    });

    beforeEach(() => {
        // Clean up mock home
        if (fs.existsSync(MOCK_HOME)) fs.rmSync(MOCK_HOME, { recursive: true, force: true });
        fs.mkdirSync(MOCK_HOME, { recursive: true });
        (os.homedir as jest.Mock).mockReturnValue(MOCK_HOME);
    });

    test("should extract context from Antigravity brain", async () => {
        // Setup mock Antigravity structure
        const brainId = "test-conversation-id";
        const brainDir = path.join(MOCK_HOME, ".gemini", "antigravity", "brain", brainId);
        fs.mkdirSync(brainDir, { recursive: true });

        // implementation_plan.md
        fs.writeFileSync(
            path.join(brainDir, "implementation_plan.md"),
            `# Fix Layout Bug

## Context
The user reported a layout issue on mobile screens where the header overflows.

#### [NEW] [src/components/Header.tsx]
`
        );

        // task.md
        fs.writeFileSync(
            path.join(brainDir, "task.md"),
            `# Fix Header Overflow
- [x] Analyze bug
- [x] Create reproduction
- [ ] Implement fix
`
        );

        // walkthrough.md
        fs.writeFileSync(
            path.join(brainDir, "walkthrough.md"),
            `# Final Status

## Overview
The bug is reproduced on iPhone SE. Fix involves adding overflow-hidden to container.
`
        );

        const result = await extractFromEditorSessions("/path/to/repo");

        expect(result).not.toBeNull();
        expect(result?.source).toBe("antigravity");
        expect(result?.task).toBe("Fix Layout Bug"); // From implementation_plan.md title
        expect(result?.approaches).toContain("The user reported a layout issue on mobile screens where the header overflows.");
        expect(result?.approaches).toContain("Done: Analyze bug");
        expect(result?.decisions).toContain("Modified: src/components/Header.tsx");
        expect(result?.currentState).toContain("The bug is reproduced on iPhone SE");
        expect(result?.nextSteps).toContain("Implement fix");
    });

    test("should extract context from Claude Code session", async () => {
        // Setup mock Claude Code structure
        const repoPath = "/Users/techie/my-repo";
        const encodedPath = repoPath.replace(/\//g, "-");
        const projectDir = path.join(MOCK_HOME, ".claude", "projects", encodedPath);
        fs.mkdirSync(projectDir, { recursive: true });

        // Session JSONL
        const sessionFile = path.join(projectDir, "session-123.jsonl");
        const sessionData = [
            { type: "user", message: { content: "Refactor auth module to use JWT" } },
            { type: "assistant", message: { content: "Okay, I'll help with that." } },
            { type: "user", message: { content: "Make sure to use RS256 algorithm." } },
            { type: "assistant", message: { content: "I've started refactoring. Decided to use jsonwebtoken library." } },
            { type: "assistant", message: { content: "Current status: Auth middleware is updated. Next steps:\n- Create token generator\n-Add expiration check" } },
        ];

        fs.writeFileSync(sessionFile, sessionData.map(d => JSON.stringify(d)).join("\n"));

        // Ensure Antigravity returns null so it falls back to Claude
        // (In this test setup, Antigravity dir is empty/missing from beforeEach cleanup)

        const result = await extractFromEditorSessions(repoPath);

        expect(result).not.toBeNull();
        expect(result?.source).toBe("claude-code-session");
        expect(result?.task).toBe("Refactor auth module to use JWT");
        expect(result?.approaches).toContain("User also asked: Make sure to use RS256 algorithm.");
        expect(result?.decisions).toContain("Decided to use jsonwebtoken library.");
        expect(result?.currentState).toContain("Auth middleware is updated");
        expect(result?.nextSteps).toContain("Create token generator");
    });
});
