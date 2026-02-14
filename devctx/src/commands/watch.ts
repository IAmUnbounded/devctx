import chalk from "chalk";
import chokidar from "chokidar";
import { v4 as uuid } from "uuid";
import { isInitialized, saveContext, getDevCtxDir } from "../core/context";
import {
    getCurrentBranch,
    getRepoName,
    getChangedFiles,
    getStagedFiles,
    getRecentCommits,
    getAuthor,
    getRepoRoot,
} from "../core/git";
import { extractFromEditorSessions } from "../core/parser";
import { ContextEntry } from "../core/types";
import { loadConfig } from "../utils/config";

export async function watchCommand(options?: { interval?: string }) {
    if (!(await isInitialized())) {
        console.log(chalk.red("✗ DevContext not initialized. Run `devctx init` first."));
        return;
    }

    try {
        const config = await loadConfig();
        const intervalMinutes = parseInt(options?.interval || String(config.watchInterval), 10);
        const intervalMs = intervalMinutes * 60 * 1000;
        const root = await getRepoRoot();
        const devctxDir = await getDevCtxDir();

        let changeCount = 0;
        let lastSave = Date.now();

        console.log(chalk.green("👁  Watch mode started"));
        console.log(chalk.gray(`  Auto-save every ${intervalMinutes} minutes when changes detected`));
        console.log(chalk.gray(`  Watching: ${root}`));
        console.log(chalk.gray("  Press Ctrl+C to stop\n"));

        const watcher = chokidar.watch(root, {
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

        watcher.on("all", (_event: string, _filePath: string) => {
            changeCount++;
        });

        // Periodic auto-save
        const timer = setInterval(async () => {
            if (changeCount === 0) return;

            try {
                const [branch, repo, filesChanged, filesStaged, recentCommits, author] =
                    await Promise.all([
                        getCurrentBranch(),
                        getRepoName(),
                        getChangedFiles(),
                        getStagedFiles(),
                        getRecentCommits(),
                        getAuthor(),
                    ]);

                // Try to enrich from editor session data
                const chatContext = await extractFromEditorSessions(root);

                const entry: ContextEntry = {
                    id: uuid(),
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

                await saveContext(entry);

                const now = new Date();
                console.log(
                    chalk.gray(
                        `  [${now.toLocaleTimeString()}] Auto-saved: ${changeCount} changes on ${branch}`
                    )
                );

                changeCount = 0;
                lastSave = Date.now();
            } catch (err: any) {
                console.log(chalk.yellow(`  ⚠ Auto-save failed: ${err.message}`));
            }
        }, intervalMs);

        // Graceful shutdown
        const cleanup = () => {
            clearInterval(timer);
            watcher.close();
            console.log(chalk.gray("\n  Watch mode stopped."));
            process.exit(0);
        };

        process.on("SIGINT", cleanup);
        process.on("SIGTERM", cleanup);
    } catch (err: any) {
        console.log(chalk.red(`✗ Error: ${err.message}`));
    }
}
