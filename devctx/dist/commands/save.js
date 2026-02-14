"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.saveCommand = saveCommand;
const chalk_1 = __importDefault(require("chalk"));
const inquirer_1 = __importDefault(require("inquirer"));
const uuid_1 = require("uuid");
const context_1 = require("../core/context");
const git_1 = require("../core/git");
const parser_1 = require("../core/parser");
async function saveCommand(message, options) {
    if (!(await (0, context_1.isInitialized)())) {
        console.log(chalk_1.default.red("✗ DevContext not initialized. Run `devctx init` first."));
        return;
    }
    try {
        const [branch, repo, filesChanged, filesStaged, recentCommits, author] = await Promise.all([
            (0, git_1.getCurrentBranch)(),
            (0, git_1.getRepoName)(),
            (0, git_1.getChangedFiles)(),
            (0, git_1.getStagedFiles)(),
            (0, git_1.getRecentCommits)(),
            (0, git_1.getAuthor)(),
        ]);
        let task = message || "";
        let approaches = [];
        let decisions = [];
        let currentState = "";
        let nextSteps = [];
        let blockers = [];
        // Check if structured flags were provided (AI agent mode)
        const hasStructuredInput = options?.approaches || options?.decisions || options?.state || options?.nextSteps;
        if (options?.auto) {
            // Auto-extract mode — read from editor session data
            console.log(chalk_1.default.gray("  Scanning editor sessions for context..."));
            const cwd = process.cwd();
            const extracted = await (0, parser_1.extractFromEditorSessions)(cwd);
            if (extracted) {
                task = message || extracted.task;
                approaches = extracted.approaches;
                decisions = extracted.decisions;
                currentState = extracted.currentState;
                nextSteps = extracted.nextSteps;
                blockers = extracted.blockers;
                console.log(chalk_1.default.gray(`  Found context from: ${extracted.source}`));
            }
            else {
                console.log(chalk_1.default.yellow("⚠ No editor session data found. Using message only."));
                task = message || "Session (auto-extract found nothing)";
                currentState = message || "";
            }
        }
        else if (hasStructuredInput && message) {
            // Programmatic mode — AI agent is passing structured context
            task = message;
            approaches = options?.approaches
                ? options.approaches.split(";;").map((s) => s.trim()).filter(Boolean)
                : [];
            decisions = options?.decisions
                ? options.decisions.split(";;").map((s) => s.trim()).filter(Boolean)
                : [];
            currentState = options?.state || message;
            nextSteps = options?.nextSteps
                ? options.nextSteps.split(";;").map((s) => s.trim()).filter(Boolean)
                : [];
            blockers = options?.blockers
                ? options.blockers.split(";;").map((s) => s.trim()).filter(Boolean)
                : [];
        }
        else if (!message) {
            // Interactive mode
            const answers = await inquirer_1.default.prompt([
                {
                    type: "input",
                    name: "task",
                    message: "What were you working on?",
                    validate: (input) => input.length > 0 || "Task description is required",
                },
                {
                    type: "input",
                    name: "approaches",
                    message: "What approaches did you try? (comma-separated, or skip)",
                    default: "",
                },
                {
                    type: "input",
                    name: "decisions",
                    message: "Key decisions made? (comma-separated, or skip)",
                    default: "",
                },
                {
                    type: "input",
                    name: "currentState",
                    message: "Where did you leave off?",
                    validate: (input) => input.length > 0 || "Current state is required",
                },
                {
                    type: "input",
                    name: "nextSteps",
                    message: "What comes next? (comma-separated, or skip)",
                    default: "",
                },
                {
                    type: "input",
                    name: "blockers",
                    message: "Any blockers? (comma-separated, or skip)",
                    default: "",
                },
            ]);
            task = answers.task;
            approaches = answers.approaches
                ? answers.approaches.split(",").map((s) => s.trim()).filter(Boolean)
                : [];
            decisions = answers.decisions
                ? answers.decisions.split(",").map((s) => s.trim()).filter(Boolean)
                : [];
            currentState = answers.currentState;
            nextSteps = answers.nextSteps
                ? answers.nextSteps.split(",").map((s) => s.trim()).filter(Boolean)
                : [];
            blockers = answers.blockers
                ? answers.blockers.split(",").map((s) => s.trim()).filter(Boolean)
                : [];
        }
        else {
            // Simple message mode
            currentState = message;
        }
        const entry = {
            id: (0, uuid_1.v4)(),
            timestamp: new Date().toISOString(),
            branch,
            repo,
            author,
            task,
            goal: options?.goal,
            approaches,
            decisions,
            currentState,
            nextSteps,
            blockers: blockers.length > 0 ? blockers : undefined,
            filesChanged,
            filesStaged,
            recentCommits,
            assignee: options?.assignee,
            handoffNote: options?.handoffNote,
        };
        const savedTo = await (0, context_1.saveContext)(entry);
        console.log(chalk_1.default.green(`✓ Context saved for branch: ${chalk_1.default.bold(branch)}`));
        console.log(chalk_1.default.gray(`  ${filesChanged.length} files changed, ${recentCommits.length} recent commits captured`));
        if (approaches.length > 0) {
            console.log(chalk_1.default.gray(`  ${approaches.length} approaches, ${decisions.length} decisions recorded`));
        }
    }
    catch (err) {
        console.log(chalk_1.default.red(`✗ Error: ${err.message}`));
    }
}
