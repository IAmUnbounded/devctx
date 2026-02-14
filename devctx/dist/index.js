#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const init_1 = require("./commands/init");
const save_1 = require("./commands/save");
const resume_1 = require("./commands/resume");
const log_1 = require("./commands/log");
const diff_1 = require("./commands/diff");
const handoff_1 = require("./commands/handoff");
const share_1 = require("./commands/share");
const watch_1 = require("./commands/watch");
const hook_1 = require("./commands/hook");
const summarize_1 = require("./commands/summarize");
const suggest_1 = require("./commands/suggest");
const compress_1 = require("./commands/compress");
const config_cmd_1 = require("./commands/config-cmd");
const program = new commander_1.Command();
program
    .name("devctx")
    .description("Persistent AI coding context for teams")
    .version("0.5.0");
program
    .command("init")
    .description("Initialize DevContext in the current repo")
    .action(init_1.initCommand);
program
    .command("save [message]")
    .description("Save current coding context")
    .option("-g, --goal <goal>", "Goal or ticket reference")
    .option("-a, --auto", "Auto-extract context from editor sessions (Claude Code, Antigravity, Cursor)")
    .option("--approaches <approaches>", "Approaches tried (;; separated)")
    .option("--decisions <decisions>", "Key decisions made (;; separated)")
    .option("--state <state>", "Current state / where you left off")
    .option("--next-steps <nextSteps>", "Next steps (;; separated)")
    .option("--blockers <blockers>", "Blockers (;; separated)")
    .action(save_1.saveCommand);
program
    .command("resume")
    .description("Generate context prompt for AI tools")
    .option("-b, --branch <branch>", "Resume context from a specific branch")
    .option("--stdout", "Output to stdout instead of clipboard")
    .action(resume_1.resumeCommand);
program
    .command("log")
    .description("View context history")
    .option("-a, --all", "Show all branches")
    .option("-n, --count <n>", "Number of entries to show", "10")
    .action(log_1.logCommand);
program
    .command("diff")
    .description("Show what changed since the last context save")
    .action(diff_1.diffCommand);
// v0.2 — Team Features
program
    .command("handoff [assignee] [message]")
    .description("Hand off context to a teammate")
    .action(handoff_1.handoffCommand);
program
    .command("share")
    .description("Share .devctx/ via git for team collaboration")
    .option("--stop", "Stop sharing (add .devctx/ back to .gitignore)")
    .action(share_1.shareCommand);
// v0.3 — Auto-Capture
program
    .command("watch")
    .description("Watch for file changes and auto-save context")
    .option("-i, --interval <minutes>", "Auto-save interval in minutes", "5")
    .action(watch_1.watchCommand);
program
    .command("hook <action>")
    .description("Manage git hooks (install/remove)")
    .action(hook_1.hookCommand);
// v0.4 — AI-Powered
program
    .command("summarize")
    .description("Auto-generate context from git diff + commits using AI")
    .action(summarize_1.summarizeCommand);
program
    .command("suggest")
    .description("AI-powered next step suggestions")
    .action(suggest_1.suggestCommand);
program
    .command("compress")
    .description("Compress old context entries using AI")
    .action(compress_1.compressCommand);
program
    .command("config [action] [key] [value]")
    .description("Manage DevContext configuration (list/get/set)")
    .action(config_cmd_1.configCommand);
program.parse();
