"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const child_process_1 = require("child_process");
const util_1 = require("util");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
let statusBarItem;
let outputChannel;
function activate(context) {
    outputChannel = vscode.window.createOutputChannel("DevContext");
    // Create status bar item
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    statusBarItem.command = "devctx.resume";
    statusBarItem.tooltip = "Click to resume DevContext";
    context.subscriptions.push(statusBarItem);
    // Register commands
    context.subscriptions.push(vscode.commands.registerCommand("devctx.save", saveContext), vscode.commands.registerCommand("devctx.resume", resumeContext), vscode.commands.registerCommand("devctx.log", showLog), vscode.commands.registerCommand("devctx.diff", showDiff));
    // Auto-resume on workspace open
    autoResume();
    // Update status bar
    updateStatusBar();
}
function deactivate() {
    statusBarItem?.dispose();
    outputChannel?.dispose();
}
async function runDevCtx(args, cwd) {
    const workspaceFolder = cwd || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceFolder) {
        throw new Error("No workspace folder open");
    }
    return execAsync(`npx devctx ${args}`, { cwd: workspaceFolder });
}
async function autoResume() {
    try {
        const { stdout } = await runDevCtx("resume --stdout");
        if (stdout.trim() && !stdout.includes("not initialized") && !stdout.includes("No context")) {
            outputChannel.clear();
            outputChannel.appendLine("═══ DevContext Auto-Resume ═══\n");
            outputChannel.appendLine(stdout);
            outputChannel.show(true); // true = preserve focus
        }
    }
    catch {
        // Silently fail — devctx may not be initialized
    }
}
async function saveContext() {
    const message = await vscode.window.showInputBox({
        prompt: "What were you working on?",
        placeHolder: "e.g., Refactoring payment service to use event sourcing",
    });
    if (!message)
        return;
    try {
        await runDevCtx(`save "${message.replace(/"/g, '\\"')}"`);
        vscode.window.showInformationMessage(`DevContext: Context saved ✓`);
        updateStatusBar();
    }
    catch (err) {
        vscode.window.showErrorMessage(`DevContext: ${err.message}`);
    }
}
async function resumeContext() {
    try {
        const { stdout } = await runDevCtx("resume --stdout");
        outputChannel.clear();
        outputChannel.appendLine("═══ DevContext Resume ═══\n");
        outputChannel.appendLine(stdout);
        outputChannel.show();
    }
    catch (err) {
        vscode.window.showErrorMessage(`DevContext: ${err.message}`);
    }
}
async function showLog() {
    try {
        const { stdout } = await runDevCtx("log");
        outputChannel.clear();
        outputChannel.appendLine("═══ DevContext Log ═══\n");
        outputChannel.appendLine(stdout);
        outputChannel.show();
    }
    catch (err) {
        vscode.window.showErrorMessage(`DevContext: ${err.message}`);
    }
}
async function showDiff() {
    try {
        const { stdout } = await runDevCtx("diff");
        outputChannel.clear();
        outputChannel.appendLine("═══ DevContext Diff ═══\n");
        outputChannel.appendLine(stdout);
        outputChannel.show();
    }
    catch (err) {
        vscode.window.showErrorMessage(`DevContext: ${err.message}`);
    }
}
async function updateStatusBar() {
    try {
        const { stdout } = await runDevCtx("log -n 1");
        if (stdout.includes("[")) {
            // Extract timestamp from log output
            const match = stdout.match(/\[([^\]]+)\]/);
            if (match) {
                statusBarItem.text = `$(history) DevCtx: ${match[1]}`;
                statusBarItem.show();
                return;
            }
        }
        statusBarItem.text = "$(history) DevCtx";
        statusBarItem.show();
    }
    catch {
        statusBarItem.text = "$(history) DevCtx: No context";
        statusBarItem.show();
    }
}
