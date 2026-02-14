"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.watchCommand = watchCommand;
const chalk_1 = __importDefault(require("chalk"));
const chokidar_1 = __importDefault(require("chokidar"));
const uuid_1 = require("uuid");
const context_1 = require("../core/context");
const git_1 = require("../core/git");
const parser_1 = require("../core/parser");
const config_1 = require("../utils/config");
async function watchCommand(options) {
    if (!(await (0, context_1.isInitialized)())) {
        console.log(chalk_1.default.red("✗ DevContext not initialized. Run `devctx init` first."));
        return;
    }
    try {
        const config = await (0, config_1.loadConfig)();
        const intervalMinutes = parseInt(options?.interval || String(config.watchInterval), 10);
        const intervalMs = intervalMinutes * 60 * 1000;
        const root = await (0, git_1.getRepoRoot)();
        const devctxDir = await (0, context_1.getDevCtxDir)();
        let changeCount = 0;
        let lastSave = Date.now();
        console.log(chalk_1.default.green("👁  Watch mode started"));
        console.log(chalk_1.default.gray(`  Auto-save every ${intervalMinutes} minutes when changes detected`));
        console.log(chalk_1.default.gray(`  Watching: ${root}`));
        console.log(chalk_1.default.gray("  Press Ctrl+C to stop\n"));
        const watcher = chokidar_1.default.watch(root, {
            ignored: [
                /(^|[\/\\])\../, // dotfiles
                "**/node_modules/**",
                "**/dist/**",
                "**/build/**",
                "**/.devctx/**",
                "**/package-lock.json",
            ],
            persistent: true,
            ignoreInitial: true,
        });
        watcher.on("all", (_event, _filePath) => {
            changeCount++;
        });
        // Periodic auto-save
        const timer = setInterval(async () => {
            if (changeCount === 0)
                return;
            try {
                const [branch, repo, filesChanged, filesStaged, recentCommits, author] = await Promise.all([
                    (0, git_1.getCurrentBranch)(),
                    (0, git_1.getRepoName)(),
                    (0, git_1.getChangedFiles)(),
                    (0, git_1.getStagedFiles)(),
                    (0, git_1.getRecentCommits)(),
                    (0, git_1.getAuthor)(),
                ]);
                // Try to enrich from editor session data
                const chatContext = await (0, parser_1.extractFromEditorSessions)(root);
                const entry = {
                    id: (0, uuid_1.v4)(),
                    timestamp: new Date().toISOString(),
                    branch,
                    repo,
                    author,
                    task: chatContext?.task || `Auto-captured: ${changeCount} file changes`,
                    approaches: chatContext?.approaches || [],
                    decisions: chatContext?.decisions || [],
                    currentState: `${changeCount} files changed since last auto-save`,
                    nextSteps: chatContext?.nextSteps || [],
                    filesChanged,
                    filesStaged,
                    recentCommits,
                };
                await (0, context_1.saveContext)(entry);
                const now = new Date();
                console.log(chalk_1.default.gray(`  [${now.toLocaleTimeString()}] Auto-saved: ${changeCount} changes on ${branch}`));
                changeCount = 0;
                lastSave = Date.now();
            }
            catch (err) {
                console.log(chalk_1.default.yellow(`  ⚠ Auto-save failed: ${err.message}`));
            }
        }, intervalMs);
        // Graceful shutdown
        const cleanup = () => {
            clearInterval(timer);
            watcher.close();
            console.log(chalk_1.default.gray("\n  Watch mode stopped."));
            process.exit(0);
        };
        process.on("SIGINT", cleanup);
        process.on("SIGTERM", cleanup);
    }
    catch (err) {
        console.log(chalk_1.default.red(`✗ Error: ${err.message}`));
    }
}
