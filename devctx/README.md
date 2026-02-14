# DevContext 🧠

> *"Git tracks your code history. DevContext tracks your intent history."*

**Persistent AI coding context for teams.** Never re-explain your codebase to an AI assistant again.

## The Problem

You're deep in a Cursor session refactoring a payment service. You've explained the architecture, tried 3 approaches, finally found the right one. Session dies. Next morning — or worse, your teammate picks it up — and the AI has **zero memory**. You spend 15 min re-explaining everything. Every. Single. Time.

This is broken across **every** AI coding tool: Cursor, Claude Code, Copilot, Windsurf — none of them persist context across sessions, editors, or team members.

## The Solution

**DevContext** is a CLI tool that automatically captures and restores AI coding context, scoped to your repo and branch.

```bash
# Save context after a session
devctx save "Refactoring payment service to use event sourcing"

# Restore context in any editor, any machine
devctx resume
```

## Install

```bash
npm install -g devctx
```

## Quick Start

```bash
# 1. Initialize in your repo
devctx init

# 2. Work on your code... then save context
devctx save
# → Interactive prompts capture: Task, Approaches, Decisions, Next Steps

# 3. Resume in ANY editor
devctx resume
# → Copies a perfectly formatted prompt to your clipboard
# → Paste into Cursor, Claude, or ChatGPT to restore full context
```

## Features & Commands

### Core (No AI Key Required)
**These commands work locally with zero dependencies.**
| Command | Description |
|---------|-------------|
| `devctx init` | Initialize DevContext in current repo |
| `devctx save [msg]` | Save context (interactive or quick mode) |
| `devctx save --auto` | Auto-save context from agent/editor logs (non-interactive) |
| `devctx resume` | Generate AI prompt & copy to clipboard |
| `devctx log` | View context history for current branch |
| `devctx diff` | Show changes since last context save |

### Team & Automation (No AI Key Required)
| Command | Description |
|---------|-------------|
| `devctx handoff @user` | explicit handoff note to a teammate |
| `devctx share` | Commit `.devctx/` folder to git for team sync |
| `devctx watch` | Auto-save context on file changes (using `chokidar`) |
| `devctx hook install` | Install git post-commit hook for auto-capture |

### AI-Powered (Experimental)
### AI-Powered (Experimental)
**Requires an LLM Provider.** Set via `DEVCTX_AI_KEY` env var or `devctx config set aiApiKey <key>`. Defaults to OpenAI-compatible API.
| Command | Description |
|---------|-------------|
| `devctx summarize` | AI-generates context from git diff + recent commits |
| `devctx suggest` | AI suggests next steps based on current context |
| `devctx compress` | detailed history into a concise summary |

### Configuration
| Command | Description |
|---------|-------------|
| `devctx config set <key> <val>` | Set preferences (e.g. `aiProvider`, `watchInterval`) |
| `devctx config list` | View all configuration |

## Integrations

### 🤖 MCP Server (Claude Code, Windsurf)
DevContext provides a Model Context Protocol (MCP) server to allow AI agents to natively read/write context.

**Add to your MCP config:**
```json
{
  "mcpServers": {
    "devctx": {
      "command": "npx",
      "args": ["-y", "devctx", "mcp"]
    }
  }
}
```
*Exposes tools: `devctx_save`, `devctx_resume`, `devctx_log` and resource `devctx://context`.*

### 🆚 VS Code Extension
Auto-resumes context when you open the project.
*Build from source:* `cd vscode-extension && npm install && npm run package` (Marketplace link coming soon).

## How It Works

DevContext stores a `.devctx/` folder in your repo. Each entry captures:
- **Task**: What you are doing
- **Goal**: Why you are doing it
- **Approaches**: What you tried (and what failed)
- **Decisions**: Key architectural choices
- **State**: Where you left off

It works with **every** AI coding tool because it simply manages the *prompt* — the universal interface for LLMs.

## License
MIT
